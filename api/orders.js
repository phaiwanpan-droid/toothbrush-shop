const { call, isAdmin } = require('../lib/sheet');

// สำหรับหน้า /admin เท่านั้น: ต้องส่งรหัสผ่านใน header x-admin-token
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!isAdmin(req)) return res.status(401).json({ ok: false, error: 'unauthorized' });
  try {
    if (req.method === 'GET') {
      const d = await call({ action: 'listOrders' });
      return res.status(d.ok ? 200 : 502).json(d);
    }
    if (req.method === 'POST') {
      const b = req.body || {};
      if (!b.orderId || !b.status) return res.status(400).json({ ok: false, error: 'ข้อมูลไม่ครบ' });
      const payload = { action: 'updateOrder', orderId: String(b.orderId), status: String(b.status) };
      if (b.tracking !== undefined) payload.tracking = String(b.tracking);
      const d = await call(payload);
      return res.status(d.ok ? 200 : 400).json(d);
    }
    return res.status(405).json({ ok: false, error: 'method not allowed' });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
};
