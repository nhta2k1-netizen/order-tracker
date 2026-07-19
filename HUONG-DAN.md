# Hướng dẫn chi tiết — Order Tracker (Telegram Bot)

Tài liệu này giúp bạn **từ zero → bot chạy trên máy Mac**, tra cứu mã vận đơn Shopee Express và nhận thông báo khi trạng thái đổi.

> **Yêu cầu máy:** macOS, Node.js ≥ 20 (bạn đang có Node ổn), kết nối internet.  
> **Chi phí:** 0đ (Telegram free + SQLite local + API SPX công khai).

---

## Mục lục

1. [Tổng quan hệ thống](#1-tổng-quan-hệ-thống)
2. [Tạo bot trên Telegram (BotFather)](#2-tạo-bot-trên-telegram-botfather)
3. [Cài đặt & cấu hình project](#3-cài-đặt--cấu-hình-project)
4. [Chạy bot lần đầu](#4-chạy-bot-lần-đầu)
5. [Cách dùng bot (từng lệnh)](#5-cách-dùng-bot-từng-lệnh)
6. [Lấy mã vận đơn từ Shopee / TikTok](#6-lấy-mã-vận-đơn-từ-shopee--tiktok)
7. [Cách hoạt động bên trong](#7-cách-hoạt-động-bên-trong)
8. [Tùy chỉnh nâng cao](#8-tùy-chỉnh-nâng-cao)
9. [Chạy nền (không cần mở Terminal)](#9-chạy-nền-không-cần-mở-terminal)
10. [Xử lý lỗi thường gặp](#10-xử-lý-lỗi-thường-gặp)
11. [Checklist “đã xong”](#11-checklist-đã-xong)
12. [Bước tiếp theo](#12-bước-tiếp-theo)

---

## 1. Tổng quan hệ thống

```
Bạn (Telegram)
    │  gửi mã SPXVN…
    ▼
Bot (máy Mac / server)  ──long-polling──►  Telegram Cloud
    │
    ├── Gọi SPX API công khai → lấy trạng thái + lịch sử
    ├── Lưu SQLite (data/tracker.db)
    └── Poller mỗi vài phút → nếu status đổi → nhắn lại bạn
```

| Thành phần | Vai trò | Phí |
|------------|---------|-----|
| Telegram Bot | Nhận lệnh, gửi notify | Free |
| Node app (`apps/bot`) | Logic bot + poller | Chạy trên máy bạn |
| SQLite | Lưu mã đang theo dõi | Free (file local) |
| SPX (Shopee Express) | Nguồn trạng thái đơn | Free (public API) |

**Hiện hỗ trợ tốt:** mã **Shopee Express** dạng `SPXVN…`.  
Các hãng khác (GHTK, GHN, J&T…) đã nhận diện mã nhưng **chưa tra cứu** (làm sau).

---

## 2. Tạo bot trên Telegram (BotFather)

### 2.1. Mở BotFather

1. Cài app **Telegram** (điện thoại hoặc [Telegram Desktop](https://desktop.telegram.org/) / web).
2. Đăng nhập bằng số điện thoại.
3. Thanh tìm kiếm → gõ: **`@BotFather`** (tích xanh chính thức).
4. Bấm **Start** / gửi `/start`.

### 2.2. Tạo bot mới

Gửi lần lượt:

```
/newbot
```

BotFather hỏi:

| Câu hỏi | Bạn trả lời ví dụ | Ghi chú |
|---------|-------------------|---------|
| Display name | `Order Tracker VN` | Tên hiển thị, có dấu/space OK |
| Username | `order_tracker_vn_bot` | **Bắt buộc** kết thúc bằng `bot`, unique toàn Telegram |

### 2.3. Lưu token (quan trọng)

BotFather trả về dạng:

```
Done! Congratulations on your new bot...
Use this token to access the HTTP API:
7123456789:AAHxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

- **Copy toàn bộ token** (số + `:` + chuỗi).
- **Không** gửi token cho ai, không commit lên GitHub public.
- Nếu lộ: vào BotFather → `/revoke` → tạo token mới.

### 2.4. (Khuyến nghị) Gắn menu lệnh

Vẫn trong chat BotFather:

```
/setcommands
```

1. Chọn bot vừa tạo.  
2. Paste nguyên khối sau rồi gửi:

```
track - Tra cứu và theo dõi mã vận đơn
status - Xem trạng thái (không đăng ký)
list - Danh sách đang theo dõi
untrack - Dừng theo dõi một mã
untrack_all - Dừng tất cả
help - Trợ giúp
```

→ Khi chat bot, gõ `/` sẽ hiện menu gợi ý.

### 2.5. (Tuỳ chọn) Ảnh & mô tả

- `/setuserpic` — avatar bot  
- `/setdescription` — mô tả khi mở profile  
- `/setabouttext` — dòng “About”

### 2.6. Mở bot của bạn

- Link: `https://t.me/<username_bot>`  
  Ví dụ: `https://t.me/order_tracker_vn_bot`
- Hoặc tìm username trong Telegram → **Start**.

> Lúc này bot **chưa trả lời** vì code chưa chạy trên máy. Làm tiếp mục 3–4.

---

## 3. Cài đặt & cấu hình project

### 3.1. Mở Terminal

- Spotlight (`Cmd + Space`) → gõ `Terminal` → Enter  
- Hoặc VS Code / Cursor → terminal tích hợp

### 3.2. Vào thư mục project

```bash
cd ~/order-tracker
```

Kiểm tra có đúng project:

```bash
ls
# Thấy: apps  packages  package.json  README.md  .env.example  ...
```

### 3.3. Kiểm tra Node.js

```bash
node -v
# Cần v20 trở lên (vd: v24.x)
```

Nếu chưa có Node: cài từ [nodejs.org](https://nodejs.org/) (LTS) hoặc:

```bash
brew install node
```

### 3.4. Cài dependencies

```bash
cd ~/order-tracker
npm install
```

Lần đầu có thể mất 20–60 giây (package `better-sqlite3` build native).  
Thành công khi thấy `added … packages` và **không** báo `npm ERR!`.

### 3.5. Tạo file `.env`

```bash
cd ~/order-tracker
cp .env.example .env
```

Mở file bằng editor:

```bash
# Cách 1: nano (Terminal)
nano .env

# Cách 2: VS Code
code .env

# Cách 3: TextEdit
open -a TextEdit .env
```

### 3.6. Điền token

Sửa **ít nhất** dòng này (dán token thật, **không** để khoảng trắng thừa):

```env
TELEGRAM_BOT_TOKEN=7123456789:AAHxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Các dòng khác tạm để mặc định:

```env
DATA_DIR=./data
POLL_INTERVAL_MINUTES=10
POLL_FAST_MINUTES=5
POLL_SLOW_MINUTES=30
```

Lưu file:

- **nano:** `Ctrl + O` → Enter → `Ctrl + X`  
- **VS Code:** `Cmd + S`

### 3.7. (Tuỳ chọn) Chỉ cho phép bạn dùng bot

1. Chat với [@userinfobot](https://t.me/userinfobot) hoặc [@getidsbot](https://t.me/getidsbot) → lấy **Id** (số).  
2. Trong `.env`:

```env
TELEGRAM_ALLOWED_CHAT_IDS=123456789
```

Nhiều người: `123,456,789` (phẩy, không space hoặc có space đều được — code đã `trim`).

---

## 4. Chạy bot lần đầu

### 4.1. Khởi động

```bash
cd ~/order-tracker
npm run bot
```

### 4.2. Log thành công trông như thế nào

```
[db] SQLite: /Users/macbook/order-tracker/data/tracker.db
[bot] ✅ @order_tracker_vn_bot (id=7…) đang chạy long-polling
[poller] Chạy mỗi 10 phút (smart priority bên trong)
[bot] Poller: { running: false, ... }
```

- **Giữ cửa sổ Terminal mở** — đóng = bot tắt.  
- Không thấy lỗi `❌ Thiếu TELEGRAM_BOT_TOKEN` hay `401 Unauthorized`.

### 4.3. Thử trên Telegram

1. Mở bot → **Start** hoặc gửi:

```
/start
```

2. Bot trả về hướng dẫn lệnh (HTML, emoji).  
3. Gửi thử (thay bằng mã SPX **thật** của bạn):

```
/track SPXVNxxxxxxxxxxxx
```

Hoặc chỉ gửi mã:

```
SPXVNxxxxxxxxxxxx
```

### 4.4. Dừng bot

Trong Terminal đang chạy bot:

```
Ctrl + C
```

### 4.5. Chế độ dev (sửa code tự restart)

```bash
npm run bot:dev
```

---

## 5. Cách dùng bot (từng lệnh)

### 5.1. Bảng lệnh

| Bạn gửi | Bot làm gì |
|---------|------------|
| `/start` | Giới thiệu + danh sách lệnh |
| `/help` | Giống help |
| `/track SPXVN…` | Tra cứu **live** + **đăng ký thông báo** |
| `/track mã1 mã2` | Tối đa 5 mã / lần |
| Chỉ gửi `SPXVN…` hoặc **link** | Tự extract mã → như `/track` |
| `/status SPXVN…` | Chỉ xem, **không** đổi đăng ký |
| `/list` | Các mã bạn đang theo dõi |
| `/untrack SPXVN…` | Dừng 1 mã |
| `/untrack_all` | Dừng hết |

### 5.2. Ví dụ hội thoại

**Bật theo dõi:**

```
Bạn: /track SPXVN0412xxxxxx

Bot: ⏳ Tra cứu SPXVN0412xxxxxx (Shopee Express)…
Bot: 📦 Mã: SPXVN…
     🏷 ĐVVC: Shopee Express
     📌 Hiện tại: Đang vận chuyển
     📜 Lịch sử …
     🔔 Đã bật thông báo khi trạng thái đổi.
```

**Xem danh sách:**

```
Bạn: /list

Bot: 📋 Đang theo dõi (2)
     📦 SPXVN…
        Shopee Express · Đang giao hàng
```

**Khi đơn đổi trạng thái** (poller phát hiện, không cần bạn hỏi):

```
Bot: 🔔 Cập nhật vận đơn
     📦 SPXVN…
     🚚 Đang vận chuyển → Đang giao hàng
     📝 Nhân viên giao hàng đang tiến hành giao
     🕒 19/07/2026, 14:30
```

**Dừng theo dõi:**

```
Bạn: /untrack SPXVN0412xxxxxx
Bot: 🛑 Đã dừng theo dõi SPXVN0412xxxxxx
```

### 5.3. Deep link (sau này gắn nút Web)

```
https://t.me/<BOT_USERNAME>?start=SPXVN0123456789
```

Mở link → bot nhận `/start SPXVN…` → tự track.

---

## 6. Lấy mã vận đơn từ Shopee / TikTok

### 6.1. Shopee (app)

1. **Tôi** → **Đơn mua**  
2. Chọn đơn đang giao  
3. **Thông tin vận chuyển** / **Xem hành trình**  
4. Copy **mã vận đơn** (thường `SPXVN` + chuỗi)  
5. Dán vào bot

### 6.2. Shopee (web)

1. [shopee.vn](https://shopee.vn) → Đơn mua  
2. Chi tiết đơn → mã vận chuyển  
3. Copy vào bot

### 6.3. TikTok Shop

1. Đơn hàng → chi tiết  
2. Xem **mã vận đơn** + đơn vị (thường SPX, J&T, GHTK…)  
3. Nếu là **SPX / SPXVN…** → bot tra được ngay  
4. Hãng khác → hiện “chưa tích hợp tracker” (làm phase 2)

### 6.4. Link tracking SPX

Có thể dán cả URL dạng:

```
https://spx.vn/track?...
```

Bot cố extract mã từ query/path.

---

## 7. Cách hoạt động bên trong

### 7.1. Khi bạn `/track`

1. Bot nhận diện carrier (`SPXVN` → Shopee Express).  
2. Gọi API public SPX → timeline + status (đã Việt hóa).  
3. Lưu / cập nhật SQLite:  
   - `telegram_users` (chat_id của bạn)  
   - `packages` (mã vận đơn)  
   - `subscriptions` (bạn ↔ mã)  
   - `status_history` (lịch sử mốc)  
4. Trả kết quả + bật notify.

### 7.2. Poller (thông báo chủ động)

| Trạng thái đơn | Tần suất poll (mặc định) |
|----------------|--------------------------|
| Đang giao | ~5 phút (`POLL_FAST_MINUTES`) |
| Đang vận chuyển | ~10 phút (`POLL_INTERVAL_MINUTES`) |
| Chờ lấy / chưa có TT | ~30 phút (`POLL_SLOW_MINUTES`) |
| Đã giao / hoàn / hủy | **Dừng** theo dõi package |

Chỉ gửi tin khi **status hiện tại ≠ status đã notify lần trước**.

### 7.3. File dữ liệu

```
~/order-tracker/data/tracker.db
```

- Sao lưu: copy file này đi chỗ khác.  
- Xóa DB = mất danh sách theo dõi (bot vẫn chạy bình thường).

### 7.4. Cây thư mục liên quan bot

```
order-tracker/
├── .env                          # Token (không commit)
├── data/tracker.db               # Database
├── apps/bot/src/
│   ├── index.js                  # Khởi động
│   ├── handlers.js               # Lệnh /track /list…
│   └── poller.js                 # Poll + notify
└── packages/
    ├── shared/                   # SPX API, detect, format tin
    └── db/                       # SQLite
```

---

## 8. Tùy chỉnh nâng cao

### 8.1. Đổi tần suất poll

Trong `.env`:

```env
POLL_INTERVAL_MINUTES=15
POLL_FAST_MINUTES=3
POLL_SLOW_MINUTES=45
```

Rồi `Ctrl+C` và `npm run bot` lại.

### 8.2. Đổi thư mục database

```env
DATA_DIR=/Users/macbook/Documents/order-tracker-data
```

### 8.3. Ghi username bot (cho Web sau này)

```env
TELEGRAM_BOT_USERNAME=order_tracker_vn_bot
```

(không có `@`)

---

## 9. Chạy nền (không cần mở Terminal)

### Cách A — `nohup` (đơn giản)

```bash
cd ~/order-tracker
nohup npm run bot > bot.log 2>&1 &
echo $!   # ghi nhớ PID
```

Xem log:

```bash
tail -f ~/order-tracker/bot.log
```

Dừng:

```bash
kill <PID>
# hoặc
pkill -f "apps/bot|@order-tracker/bot|node src/index.js"
```

### Cách B — `pm2` (khuyến nghị nếu dùng lâu)

```bash
npm install -g pm2
cd ~/order-tracker
pm2 start npm --name order-bot -- run bot
pm2 save
pm2 startup   # làm theo hướng dẫn để mở máy tự chạy
```

Lệnh hay dùng:

```bash
pm2 status
pm2 logs order-bot
pm2 restart order-bot
pm2 stop order-bot
```

> Mac ngủ / tắt máy → process dừng. Muốn 24/7: VPS / Render Worker (xem `apps/bot/README.md`).

---

## 10. Xử lý lỗi thường gặp

### ❌ `Thiếu TELEGRAM_BOT_TOKEN`

- Chưa có file `.env` hoặc token trống.  
- Chạy từ đúng thư mục `~/order-tracker`.  
- Token phải trên **một dòng**, không quote lạ.

```bash
cd ~/order-tracker
grep TELEGRAM_BOT_TOKEN .env
# Phải ra: TELEGRAM_BOT_TOKEN=số:chuỗi
```

### ❌ `401 Unauthorized` / không launch

- Token sai hoặc đã revoke.  
- Tạo token mới ở BotFather → sửa `.env` → chạy lại.

### ❌ Bot không trả lời gì

1. Terminal còn đang `npm run bot` không?  
2. Đúng bot (đúng username) chưa?  
3. Có bật `TELEGRAM_ALLOWED_CHAT_IDS` mà chat_id bạn không nằm trong list?  
4. Thử `/start` lại.

### ❌ `Không tra cứu được` / Server error

- Mã **fake** hoặc chưa lên hệ thống SPX.  
- Dùng mã **thật** từ đơn đang giao.  
- SPX API đôi khi timeout — đợi vài phút thử lại.  
- Mã không phải SPX (GHTK/GHN…) → thông báo “chưa tích hợp”.

### ❌ `npm install` lỗi better-sqlite3

Cần tools build trên Mac:

```bash
xcode-select --install
cd ~/order-tracker
rm -rf node_modules package-lock.json
npm install
```

### ❌ Nhiều instance bot cùng lúc

Chỉ **một** process bot / một token.  
Nếu chạy 2 Terminal `npm run bot` → conflict getUpdates.  
Dừng hết rồi chạy lại 1 lần.

### ❌ Mac tắt / sleep

Bot tắt theo. Dùng `pm2` + cắm sạc, hoặc deploy server.

---

## 11. Checklist “đã xong”

- [ ] Tạo bot BotFather, có token  
- [ ] `/setcommands` (tuỳ chọn)  
- [ ] `cd ~/order-tracker` + `npm install`  
- [ ] File `.env` có `TELEGRAM_BOT_TOKEN=...`  
- [ ] `npm run bot` → log `@… đang chạy`  
- [ ] Telegram `/start` → bot trả lời  
- [ ] `/track` mã SPXVN thật → có timeline  
- [ ] `/list` thấy mã  
- [ ] (Tuỳ chọn) đợi status đổi → có tin notify  

---

## 12. Bước tiếp theo

| # | Việc | Trạng thái |
|---|------|------------|
| 1 | Telegram Bot | ✅ Đang dùng theo guide này |
| 2 | API backend (`/api/track/:code`) | 🔜 |
| 3 | Web Next.js (ô nhập mã + deep-link bot) | 🔜 |
| 4 | Thêm GHN / GHTK / J&T… | 🔜 |
| 5 | Deploy 24/7 free (Render/VPS) | 🔜 |
| 6 | Zalo OA test | 🔜 tuỳ chọn |

---

## Lệnh tóm tắt (copy nhanh)

```bash
# Lần đầu
cd ~/order-tracker
cp .env.example .env
# → dán TELEGRAM_BOT_TOKEN vào .env
npm install
npm run bot

# Mỗi ngày sau
cd ~/order-tracker
npm run bot
```

Telegram:

```
/start
/track SPXVNxxxxxxxxxxxx
/list
/untrack SPXVNxxxxxxxxxxxx
```

---

*File này: `~/order-tracker/HUONG-DAN.md` — mở lại bất cứ lúc nào.*
