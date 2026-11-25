/**
 * Backend ของร้าน — วางไฟล์นี้ใน Google Sheet: ส่วนขยาย > Apps Script
 * ชีตที่ต้องมี: "Products" และ "Orders" (หัวคอลัมน์ตามไฟล์ตัวอย่าง)
 * ตั้งค่า Script property ชื่อ SECRET (Project Settings > Script properties)
 * แล้ว Deploy เป็น Web app (Execute as: Me / Who has access: Anyone)
 */
const SHEET_PRODUCTS = 'Products';
const SHEET_ORDERS = 'Orders';
const TZ = 'Asia/Bangkok';
const STATUSES = ['new', 'picked', 'packed', 'shipped', 'cancelled'];

function out_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
function secret_() {
  return PropertiesService.getScriptProperties().getProperty('SECRET');
}

// สาธารณะ: คืนเฉพาะสินค้าที่เปิดขาย
function doGet() {
  try {
    return out_({ ok: true, products: allProducts_().filter(p => p.active).map(p => ({
      sku: p.sku, name: p.name, desc: p.desc, price: p.price, stock: p.stock, image: p.image
    })) });
  } catch (err) {
    return out_({ ok: false, error: String(err) });
  }
}

// ต้องมี secret ตรงกับที่ตั้งไว้
function doPost(e) {
  try {
    const b = JSON.parse(e.postData.contents);
    if (!secret_() || b.secret !== secret_()) return out_({ ok: false, error: 'unauthorized' });
    if (b.action === 'createOrder') return out_(createOrder_(b));
    if (b.action === 'listOrders') return out_(listOrders_());
    if (b.action === 'updateOrder') return out_(updateOrder_(b));
    return out_({ ok: false, error: 'unknown action' });
  } catch (err) {
    return out_({ ok: false, error: String(err) });
  }
}

/* ---------- helpers ---------- */
function sheet_(name) {
  const sh = SpreadsheetApp.getActive().getSheetByName(name);
  if (!sh) throw new Error('ไม่พบชีต ' + name);
  return sh;
}
function table_(sh) {
  const v = sh.getDataRange().getValues();
  const headers = v.shift().map(String);
  const rows = v.filter(r => r.join('') !== '').map((r, i) => {
    const o = { _row: i + 2 };
    headers.forEach((h, j) => { o[h] = r[j] instanceof Date ? Utilities.formatDate(r[j], TZ, 'yyyy-MM-dd HH:mm:ss') : r[j]; });
    return o;
  });
  return { headers: headers, rows: rows };
}
function ensureCol_(sh, name) {
  const lastCol = Math.max(sh.getLastColumn(), 1);
  const headers = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(String);
  let idx = headers.indexOf(name);
  if (idx === -1) { sh.getRange(1, lastCol + 1).setValue(name); idx = lastCol; }
  return idx + 1; // เลขคอลัมน์ (เริ่ม 1)
}
function allProducts_() {
  return table_(sheet_(SHEET_PRODUCTS)).rows.map(r => ({
    _row: r._row, sku: String(r.sku).trim(), name: r.name, desc: r.desc,
    price: Number(r.price) || 0, stock: Number(r.stock) || 0, image: r.image,
    active: String(r.active).toUpperCase() === 'TRUE'
  })).filter(p => p.sku);
}
function clean_(s, max) {
  s = String(s == null ? '' : s).replace(/[\r\t]+/g, ' ').trim().slice(0, max);
  return /^[=+\-@]/.test(s) ? "'" + s : s; // กัน formula injection
}
function parseItems_(s) {
  return String(s || '').split(',').map(x => x.trim()).filter(Boolean).map(x => {
    const m = x.match(/^([A-Za-z0-9_\-]+)\s*x\s*(\d+)$/);
    return m ? { sku: m[1], qty: Number(m[2]) } : null;
  }).filter(Boolean);
}

/* ---------- สร้างออเดอร์ ---------- */
function createOrder_(b) {
  const c = b.customer || {};
  const name = clean_(c.name, 100);
  const phone = String(c.phone || '').replace(/\D/g, '');
  const address = clean_(c.address, 300);
  const province = clean_(c.province, 60);
  const postcode = String(c.postcode || '').replace(/\D/g, '');
  if (!name || !address || !province) return { ok: false, error: 'กรอกชื่อ ที่อยู่ และจังหวัดให้ครบ' };
  if (!/^0\d{8,9}$/.test(phone)) return { ok: false, error: 'เบอร์โทรไม่ถูกต้อง' };
  if (!/^\d{5}$/.test(postcode)) return { ok: false, error: 'รหัสไปรษณีย์ต้องมี 5 หลัก' };

  const want = {};
  (b.items || []).forEach(it => {
    const q = parseInt(it.qty, 10);
    if (it.sku && q > 0) want[String(it.sku)] = (want[String(it.sku)] || 0) + q;
  });
  const skus = Object.keys(want);
  if (!skus.length) return { ok: false, error: 'ยังไม่ได้เลือกสินค้า' };

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const products = allProducts_();
    const lines = [];
    let total = 0;
    for (const sku of skus) {
      const p = products.find(x => x.sku === sku && x.active);
      const q = want[sku];
      if (!p) return { ok: false, error: 'ไม่พบสินค้า ' + sku };
      if (q > 20) return { ok: false, error: 'สั่งได้สูงสุด 20 ชิ้นต่อรายการ' };
      if (p.stock < q) return { ok: false, error: p.name + ' เหลือ ' + p.stock + ' ชิ้น' };
      lines.push({ p: p, q: q });
      total += p.price * q; // ราคาคำนวณจากชีต ไม่เชื่อค่าจากหน้าเว็บ
    }

    const ps = sheet_(SHEET_PRODUCTS);
    const stockCol = ensureCol_(ps, 'stock');
    lines.forEach(l => ps.getRange(l.p._row, stockCol).setValue(l.p.stock - l.q));

    const os = sheet_(SHEET_ORDERS);
    ensureCol_(os, 'tracking');
    const t = table_(os);
    const prefix = 'TB' + Utilities.formatDate(new Date(), TZ, 'yyMMdd');
    const seq = t.rows.filter(r => String(r.orderId).indexOf(prefix) === 0).length + 1;
    const orderId = prefix + '-' + ('00' + seq).slice(-3);

    const data = {
      orderId: orderId,
      time: Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm:ss'),
      name: name, phone: phone, address: address, province: province, postcode: postcode,
      items: lines.map(l => l.p.sku + ' x' + l.q).join(', '),
      total: total, status: 'new', tracking: ''
    };
    const headers = os.getRange(1, 1, 1, os.getLastColumn()).getValues()[0].map(String);
    const row = os.getLastRow() + 1;
    ['phone', 'postcode', 'time'].forEach(k => {
      const i = headers.indexOf(k);
      if (i >= 0) os.getRange(row, i + 1).setNumberFormat('@'); // เก็บเป็นข้อความ กันเลข 0 หาย
    });
    os.getRange(row, 1, 1, headers.length).setValues([headers.map(h => data[h] !== undefined ? data[h] : '')]);
    return { ok: true, orderId: orderId, total: total };
  } finally {
    lock.releaseLock();
  }
}

/* ---------- ดึงออเดอร์สำหรับหยิบ/แพ็ค ---------- */
function listOrders_() {
  const t = table_(sheet_(SHEET_ORDERS));
  const orders = t.rows.map(r => ({
    orderId: String(r.orderId), time: r.time, name: r.name, phone: String(r.phone),
    address: r.address, province: r.province, postcode: String(r.postcode),
    items: parseItems_(r.items), total: Number(r.total) || 0,
    status: String(r.status || 'new'), tracking: String(r.tracking || '')
  }));
  const products = {};
  allProducts_().forEach(p => { products[p.sku] = { name: p.name, image: p.image, price: p.price, stock: p.stock }; });
  return { ok: true, orders: orders, products: products };
}

/* ---------- เปลี่ยนสถานะ / เลขพัสดุ ---------- */
function updateOrder_(b) {
  if (STATUSES.indexOf(b.status) === -1) return { ok: false, error: 'สถานะไม่ถูกต้อง' };
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const os = sheet_(SHEET_ORDERS);
    const statusCol = ensureCol_(os, 'status');
    const trackCol = ensureCol_(os, 'tracking');
    const t = table_(os);
    const o = t.rows.find(r => String(r.orderId) === String(b.orderId));
    if (!o) return { ok: false, error: 'ไม่พบออเดอร์ ' + b.orderId };

    // ยกเลิกออเดอร์ → คืนสต็อก
    if (b.status === 'cancelled' && o.status !== 'cancelled') {
      const ps = sheet_(SHEET_PRODUCTS);
      const stockCol = ensureCol_(ps, 'stock');
      const prods = allProducts_();
      parseItems_(o.items).forEach(it => {
        const p = prods.find(x => x.sku === it.sku);
        if (p) ps.getRange(p._row, stockCol).setValue(p.stock + it.qty);
      });
    }
    os.getRange(o._row, statusCol).setValue(b.status);
    if (b.tracking !== undefined) os.getRange(o._row, trackCol).setNumberFormat('@').setValue(clean_(b.tracking, 40));
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}
