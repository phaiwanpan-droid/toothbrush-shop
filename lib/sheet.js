// เรียก Google Apps Script (ฐานข้อมูลคือ Google Sheet)
// ตั้งค่าใน Vercel > Settings > Environment Variables
//   APPS_SCRIPT_URL  = URL ของ Web app ที่ Deploy จาก Apps Script
//   SHEET_SECRET     = ค่าเดียวกับ Script property "SECRET" ใน Apps Script
const crypto = require('crypto');

function config() {
  const url = process.env.APPS_SCRIPT_URL;
  const secret = process.env.SHEET_SECRET;
  if (!url || !secret) throw new Error('ยังไม่ได้ตั้งค่า APPS_SCRIPT_URL / SHEET_SECRET');
  return { url, secret };
}

async function parse(r) {
  const text = await r.text();
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new Error('Apps Script ตอบกลับผิดรูปแบบ (ตรวจว่า Deploy แบบ Anyone แล้ว)');
  }
}

async function getProducts() {
  const { url } = config();
  const r = await fetch(url, { redirect: 'follow' });
  return parse(r);
}

async function call(body) {
  const { url, secret } = config();
  const r = await fetch(url, {
    method: 'POST',
    // text/plain ทำให้ไม่โดน CORS preflight ของ Apps Script
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ ...body, secret }),
    redirect: 'follow',
  });
  return parse(r);
}

function isAdmin(req) {
  const expected = process.env.ADMIN_TOKEN || '';
  const given = String(req.headers['x-admin-token'] || '');
  if (!expected || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

module.exports = { getProducts, call, isAdmin };
