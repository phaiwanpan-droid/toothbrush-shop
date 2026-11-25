const { call } = require('../lib/sheet');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method not allowed' });
  const b = req.body || {};

  // honeypot: ช่องซ่อนที่คนจริงไม่กรอก ถ้ามีค่า = บอท
  if (b.website) return res.status(200).json({ ok: true, orderId: 'OK', total: 0 });

  const items = Array.isArray(b.items) ? b.items.slice(0, 10) : [];
  if (!b.customer || !items.length) {
    return res.status(400).json({ ok: false, error: 'ข้อมูลคำสั่งซื้อไม่ครบ' });
  }
  try {
    // ราคา/สต็อกตรวจที่ Apps Script จากชีต ไม่เชื่อค่าจากหน้าเว็บ
    const d = await call({
      action: 'createOrder',
      customer: b.customer,
      items: items.map((i) => ({ sku: String(i.sku || ''), qty: Number(i.qty) })),
    });
    return res.status(d.ok ? 200 : 400).json(d);
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
};
