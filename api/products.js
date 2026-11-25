const { getProducts } = require('../lib/sheet');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'method not allowed' });
  try {
    const d = await getProducts();
    res.setHeader('Cache-Control', 's-maxage=15, stale-while-revalidate=30');
    return res.status(d.ok ? 200 : 502).json(d);
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
};
