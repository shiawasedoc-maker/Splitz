# หารค่าทริป

แอปหารค่าใช้จ่ายทริปกับเพื่อน แบบ Local-only / Offline-first PWA สำหรับมือถือ (ออกแบบโดยเน้น iPhone)

## ความเป็นส่วนตัว (สรุปจากการทำงานจริงของโค้ด)

- ข้อมูลทุกอย่างที่ผู้ใช้กรอก (ทริป สมาชิก รายการ ยอดเงิน สกุลเงิน เรทแลกเงิน คนจ่าย คนหาร) เก็บใน **IndexedDB** ของเบราว์เซอร์บนเครื่องนั้นเท่านั้น (`db.js`)
- การคำนวณทั้งหมด (หาร, ยอดได้คืน/จ่ายเพิ่ม, ใครโอนให้ใคร, แปลงสกุลเงิน) เป็น JavaScript ในเครื่อง (`app.js`)
- ไม่มี backend, ไม่มี account/login, ไม่มี cloud sync, ไม่มี analytics / tracking / telemetry / ads
- หน้าแอปตั้ง Content-Security-Policy แบบปฏิเสธทุกอย่างเป็นค่าตั้งต้น:

  ```
  default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'none'; media-src 'none'; frame-src 'none'; child-src 'none'; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'
  ```

  `connect-src 'none'` ทำให้เบราว์เซอร์บล็อก `fetch` / `XMLHttpRequest` / `WebSocket` / `EventSource` / `sendBeacon` ทั้งหมดจากหน้าแอป ส่วนรูป ฟอนต์ สคริปต์ CSS โหลดได้เฉพาะจากโดเมนของแอปเอง (`data:` ใน img-src ใช้สำหรับรูปที่ html2canvas สร้างในหน้าตอน export)
- ข้อจำกัด: CSP แบบ `<meta>` ใช้ `frame-ancestors` ไม่ได้ (GitHub Pages ตั้ง header ไม่ได้)
- ฟอนต์และไลบรารี export อยู่ในโปรเจกต์ (`fonts/`, `vendor/`) ไม่มีการโหลดจาก CDN หรือ Google Fonts
- Export / Import เป็นไฟล์ JSON ทำในเครื่อง ไม่อัปโหลด

**Network ที่เกิดขึ้นได้** มีอย่างเดียว: เบราว์เซอร์ดาวน์โหลดไฟล์ของแอป (GET) จากโฮสต์ (เช่น GitHub Pages) ตอนติดตั้งครั้งแรก และตอนเบราว์เซอร์เช็คว่า `sw.js` มีเวอร์ชันใหม่หรือไม่ ไม่มีข้อมูลผู้ใช้ติดไปกับ request เหล่านี้ (ในฐานะเว็บโฮสต์ GitHub จะเห็น IP ของเครื่องที่ดาวน์โหลดไฟล์แอปเหมือนเว็บไซต์ทั่วไป)

## ไฟล์

| ไฟล์ | หน้าที่ |
|---|---|
| `index.html` | หน้าแอป, CSS, CSP, @font-face |
| `app.js` | UI และการคำนวณทั้งหมด |
| `db.js` | IndexedDB (ฐานข้อมูล `tripsplit`: store `trips`, `meta`) |
| `sw.js` | Service worker: cache ไฟล์แอปเพื่อใช้ offline (ไม่ยุ่งกับข้อมูลผู้ใช้) |
| `manifest.webmanifest`, `icon-*.png` | ติดตั้งเป็นแอปบนหน้าจอโฮม |
| `fonts/` | Anuphan, Mitr (SIL OFL 1.1) |
| `vendor/` | html2canvas 1.4.1 (MIT), jsPDF 2.5.1 (MIT), SheetJS CE 0.18.5 (Apache-2.0) สำหรับ PDF/รูป/Excel |
| `.nojekyll` | ให้ GitHub Pages เสิร์ฟไฟล์ตามที่อยู่ |

## Deploy ด้วย GitHub Pages

1. สร้าง repository ใหม่ใน GitHub (Public)
2. **Add file → Upload files** อัปโหลดไฟล์และโฟลเดอร์ทั้งหมดในโฟลเดอร์นี้ (ให้ `index.html` อยู่ชั้นบนสุดของ repo) แล้ว Commit
3. **Settings → Pages → Build and deployment → Source: Deploy from a branch**, เลือก `main` และ `/ (root)` แล้ว Save
4. รอ 1–2 นาที จะได้ลิงก์ `https://<ชื่อผู้ใช้>.github.io/<ชื่อ repo>/`

## ติดตั้งบน iPhone

1. เปิดลิงก์ด้วย **Safari**
2. แตะปุ่มแชร์ → **เพิ่มไปยังหน้าจอโฮม (Add to Home Screen)**
3. เปิดจากไอคอนบนหน้าจอโฮมเสมอ (ข้อมูลในไอคอนหน้าจอโฮมกับใน Safari แยกกัน)
4. เปิดครั้งแรกตอนมีเน็ตหนึ่งครั้ง จากนั้นใช้ offline ได้ทั้งหมด

แชร์ให้เพื่อนได้ด้วยลิงก์เดียวกัน ข้อมูลของแต่ละคนอยู่ในเครื่องของคนนั้นเท่านั้น

## อัปเดตแอป

แก้ไฟล์ แล้วเปลี่ยนค่า `VERSION` ใน `sw.js` (เช่น `tripsplit-v6`) ก่อนอัปโหลด เครื่องผู้ใช้จะได้เวอร์ชันใหม่เมื่อเปิดแอปครั้งถัดไปที่มีเน็ต ข้อมูลใน IndexedDB ไม่ถูกแตะ

## ข้อควรรู้

- **ที่เก็บข้อมูลผูกกับโดเมน**: ทุก repo ใต้ `ชื่อผู้ใช้.github.io` นับเป็นเว็บเดียวกันสำหรับเบราว์เซอร์ ถ้าเอาเว็บอื่นขึ้นในบัญชีเดียวกัน โค้ดของเว็บนั้นจะอ่าน IndexedDB ของแอปนี้ได้ ให้ใช้บัญชีนี้กับแอปนี้อย่างเดียว หรือใช้ domain แยก
- **ตำแหน่งที่เก็บในเครื่อง**: ข้อมูลผู้ใช้อยู่ใน IndexedDB `tripsplit` ที่เดียว (ดูขนาดรายทริปได้ในหน้า 🔒) ไฟล์ตัวแอปอยู่ใน Cache Storage ขนาดคงที่ ~1.8 MB

- ไม่มีการสำรองข้อมูลอัตโนมัติ ถ้าลบแอปออกจากหน้าจอโฮม ล้างข้อมูลเว็บไซต์ หรือเปลี่ยนเครื่อง ข้อมูลจะหาย ให้ใช้ **Export Data** เป็นระยะ
- SheetJS 0.18.5 มีช่องโหว่ที่ทราบกันในส่วน *อ่าน* ไฟล์ Excel แอปนี้ใช้แค่ *เขียน* ไฟล์ จึงไม่อยู่ในเส้นทางที่มีปัญหา
