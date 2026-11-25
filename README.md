# ฟันใส — เลนดิ้งเพจขายแปรงสีฟัน

เว็บสั่งซื้อ + เก็บออเดอร์ใน Google Sheet + หน้าหลังร้านสำหรับหยิบ ตรวจ แพ็ก และพิมพ์ใบปะหน้า

```
ลูกค้า ──> index.html ──> /api/order ──> Apps Script ──> Google Sheet (Products / Orders)
เจ้าของร้าน ──> /admin ──> /api/orders ──> Apps Script ──> Google Sheet
รูปสินค้า ──> โฟลเดอร์ images/ ใน GitHub
```

## โครงสร้างไฟล์

| ไฟล์ | หน้าที่ |
|---|---|
| `index.html` | หน้าขายสินค้า (2 SKU: `TB-BAM-01`, `TB-SFT-01`) |
| `admin.html` | หน้าหลังร้าน (เปิดที่ `/admin`) |
| `images/` | รูปสินค้า — คอลัมน์ `image` ในชีตอ้างถึงไฟล์ในนี้ |
| `api/*.js` | ฟังก์ชันของ Vercel คั่นกลางระหว่างเว็บกับ Google Sheet (ซ่อนรหัสลับ) |
| `apps-script/Code.gs` | โค้ดที่วางใน Google Sheet |
| `data/products.sample.json` | ข้อมูลตัวอย่าง ใช้โชว์หน้าเว็บเมื่อยังไม่ได้ต่อชีต |

## ขั้นตอนติดตั้ง

### 1) Google Sheet
1. อัปโหลด `Untitled_spreadsheet.xlsx` ขึ้น Google Drive แล้วเปิดด้วย Google Sheets (หรือสร้างชีตใหม่ให้มีชีต `Products` และ `Orders` หัวคอลัมน์เหมือนเดิม)
2. `Products`: `sku, name, desc, price, stock, image, active`
3. `Orders`: `orderId, time, name, phone, address, province, postcode, items, total, status` (ระบบจะเพิ่มคอลัมน์ `tracking` ให้เอง)
4. คอลัมน์ `image` ใส่ `images/ชื่อไฟล์` หรือจะใส่ลิงก์เต็ม `https://raw.githubusercontent.com/<user>/<repo>/main/images/...` ก็ได้

### 2) Apps Script
1. ในชีต เลือก **ส่วนขยาย → Apps Script** แล้ววางโค้ดจาก `apps-script/Code.gs` ทับของเดิม
2. **Project Settings → Script properties → Add** ชื่อ `SECRET` ค่า = รหัสยาว ๆ ที่คุณตั้งเอง (เก็บไว้ใช้ในข้อ 4)
3. **Deploy → New deployment → Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
4. กด Deploy แล้วอนุญาตสิทธิ์ ก็อปปี้ **Web app URL** (ลงท้าย `/exec`)

> ถ้าแก้ `Code.gs` ภายหลัง ต้อง **Deploy → Manage deployments → Edit → New version** ทุกครั้ง ไม่เช่นนั้นโค้ดใหม่ไม่ทำงาน

### 3) GitHub
```bash
cd toothbrush-shop
git init
git add .
git commit -m "first commit"
git branch -M main
git remote add origin https://github.com/<user>/<repo>.git
git push -u origin main
```
อยากแยกที่เก็บรูปเป็น repo ต่างหาก: สร้าง repo ใหม่ชื่อ `toothbrush-images` ย้ายโฟลเดอร์ `images/` ไปไว้ แล้วใส่ลิงก์ raw เต็มในคอลัมน์ `image` ของชีต

### 4) Vercel
1. vercel.com → **Add New → Project** → เลือก repo นี้ → Deploy (ไม่ต้องตั้ง build command)
2. **Settings → Environment Variables** เพิ่ม 3 ตัว (ดู `.env.example`)
   - `APPS_SCRIPT_URL` = Web app URL จากข้อ 2
   - `SHEET_SECRET` = ค่าเดียวกับ `SECRET` ใน Apps Script
   - `ADMIN_TOKEN` = รหัสผ่านสำหรับเข้า `/admin`
3. **Deployments → Redeploy** เพื่อให้ค่าใหม่มีผล
4. โดเมนของตัวเอง: **Settings → Domains → Add** แล้วตั้ง DNS ตามที่ Vercel บอก

### 5) ทดสอบ
1. เปิดหน้าเว็บ เลือกสินค้า กรอกที่อยู่ กดสั่งซื้อ → ชีต `Orders` ต้องมีแถวใหม่ และ `stock` ลดลง
2. เปิด `/admin` ใส่ `ADMIN_TOKEN`

## วิธีใช้หน้า /admin

สถานะออเดอร์เดินตามนี้: `new` → `picked` → `packed` → `shipped` (หรือ `cancelled`)

1. **ใบหยิบของ** — รวมจำนวนทุกออเดอร์ใหม่แยกตาม SKU พร้อมรูป เดินหยิบทีเดียว แล้วติ๊กออเดอร์ที่หยิบครบ
2. **ตรวจ + แพ็ก** — ยิงบาร์โค้ด/พิมพ์ SKU (หรือแตะแถวสินค้า) ทีละชิ้น ระบบเตือนถ้า SKU ไม่อยู่ในออเดอร์หรือเกินจำนวน ปุ่ม "แพ็กเสร็จแล้ว" จะกดได้เมื่อครบทุกรายการ
3. **ใบปะหน้า** — เลือกออเดอร์ที่แพ็กแล้ว กดพิมพ์ (ขนาด A6 105×148 มม. ตั้งค่าเครื่องพิมพ์ให้ไม่มีขอบและสเกล 100%) ใส่เลขพัสดุแล้วกด "ส่งแล้ว"
4. **ส่งแล้ว** — ประวัติพร้อมเลขพัสดุ

ยกเลิกออเดอร์ที่แท็บใบหยิบของ ระบบจะคืนสต็อกให้อัตโนมัติ

## ต้องแก้ก่อนใช้งานจริง
- `admin.html` ส่วน `SHOP` (บรรทัดต้น ๆ ของ script) ใส่ชื่อ ที่อยู่ และเบอร์ผู้ส่งจริง
- ข้อความบนหน้าเว็บ (ชื่อร้าน คำโปรย ข้อความเรื่องชำระเงิน/ค่าส่ง) เป็นข้อความตัวอย่าง
- ยังไม่มีระบบชำระเงิน ร้านติดต่อลูกค้ากลับเพื่อแจ้งวิธีโอนเงิน ถ้าจะรับชำระออนไลน์ต้องเพิ่ม PromptPay QR หรือ payment gateway
- ข้อมูลลูกค้า (ชื่อ เบอร์ ที่อยู่) เป็นข้อมูลส่วนบุคคล ควรมีหน้านโยบายความเป็นส่วนตัวและจำกัดคนที่เปิดชีตได้

## ทดสอบในเครื่อง
```bash
npm i -g vercel
vercel dev        # ใส่ค่า env ผ่าน .env หรือ vercel env pull
```
