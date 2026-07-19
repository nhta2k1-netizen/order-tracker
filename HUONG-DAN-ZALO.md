# Hướng dẫn Zalo OA — test **0đ** (gói Cơ bản)

Mục tiêu: nhận **thông báo đổi trạng thái vận đơn** qua Zalo, **không mua gói trả phí**, **không ZNS tính tiền**.

---

## ⚠️ Giới hạn miễn phí (đọc trước)

| Hạng mục | Free (gói Cơ bản) | Trả phí |
|----------|-------------------|---------|
| Tạo OA + App Developer | 0đ | — |
| Gọi OpenAPI | 0đ | — |
| Tin **tư vấn / CS** (bot trả lời) | Chỉ trong **~48 giờ** sau khi **user nhắn OA** | — |
| Tin ngoài 48h / broadcast / ZNS | ❌ Không free | ZNS / gói cao hơn |

**Cách dùng free đúng:**

1. User (bạn) **nhắn OA trước** (gửi mã vận đơn).  
2. Hệ thống reply + đăng ký theo dõi.  
3. Trong **48h**, khi đơn đổi status → OA gửi cập nhật.  
4. Hết 48h → user **nhắn lại OA 1 lần** (vd `list`) để mở lại khung chat.

> Telegram bot vẫn tốt hơn cho notify 24/7 free. Zalo OA free = **kênh test / phụ**.

---

## Phần 1 — Tạo Zalo Official Account (0đ)

### Bước 1.1. Mở trang OA

1. Trình duyệt: [https://oa.zalo.me](https://oa.zalo.me)  
2. Đăng nhập **Zalo cá nhân** (số điện thoại).  
3. Chọn **Tạo Official Account**.

### Bước 1.2. Chọn loại & gói

- Loại: **Doanh nghiệp** (hoặc loại Zalo cho phép tạo nhanh trên tài khoản của bạn).  
- Gói: chọn / để mặc định **Cơ bản (miễn phí)** nếu có.  
- **Không** mua gói Tiêu chuẩn / Tăng trưởng / Toàn diện.

### Bước 1.3. Điền hồ sơ

- Tên OA: vd `Order Tracker Test`  
- Ảnh đại diện, mô tả ngắn  
- Lưu / hoàn tất tạo

> **Xác thực doanh nghiệp** (GPKD) có thể được Zalo yêu cầu để mở full API.  
> Nếu form bắt buộc giấy tờ mà bạn chưa có: dùng OA test cá nhân nếu Zalo còn cho phép, hoặc OA nội bộ team — mục tiêu phase này chỉ **test API**, không bán hàng.

### Bước 1.4. Ghi nhớ

- Tên OA  
- Link quan tâm OA (nếu có): `https://zalo.me/<id>`

---

## Phần 2 — Tạo App trên Zalo Developers (0đ)

### Bước 2.1. Vào Developers

1. [https://developers.zalo.me](https://developers.zalo.me)  
2. Đăng nhập cùng tài khoản Zalo.  
3. **Thêm ứng dụng mới** / Create App.  
4. Điền: tên app, mô tả ≥ 20 ký tự, danh mục phù hợp.  
5. **Bật / Kích hoạt** ứng dụng (toggle).

### Bước 2.2. Lấy App ID & Secret

Vào app → **Cài đặt** / Settings:

| Trường | Biến `.env` |
|--------|-------------|
| App ID | `ZALO_APP_ID` |
| Secret Key | `ZALO_APP_SECRET` |

### Bước 2.3. Liên kết Official Account

Trong app:

1. Mục **Official Account** / Liên kết OA  
2. Chọn OA vừa tạo → xác nhận  
3. Đăng ký quyền (permission) liên quan **gửi tin / CSKH / tin nhắn** nếu có danh sách — bật tối đa quyền free cho phép.

### Bước 2.4. Webhook & Callback (sẽ điền URL public ở Phần 4)

Chuẩn bị 2 URL (sau khi có tunnel HTTPS):

```text
Callback OAuth:  https://<domain-public>/oauth/zalo
Webhook:         https://<domain-public>/webhooks/zalo
```

Sự kiện webhook nên bật (nếu có checkbox):

- `user_send_text` (user gửi tin nhắn chữ)

---

## Phần 3 — Cấu hình project trên Mac

### Bước 3.1. Sửa `.env`

```bash
cd ~/order-tracker
nano .env
```

Thêm / sửa:

```env
# Zalo OA (free test)
ZALO_APP_ID=số_app_id
ZALO_APP_SECRET=chuỗi_secret

# Token để trống trước — lấy ở Phần 5
ZALO_ACCESS_TOKEN=
ZALO_REFRESH_TOKEN=

PORT=4000
DATA_DIR=./data
```

Lưu file.

### Bước 3.2. Cài dependency API

```bash
cd ~/order-tracker
npm install
```

### Bước 3.3. Chạy API local

```bash
npm run api
```

Log mong đợi:

```text
[api] http://0.0.0.0:4000
[api] Health:  http://localhost:4000/health
[api] Zalo WH: http://localhost:4000/webhooks/zalo
[api] OAuth:   http://localhost:4000/oauth/zalo
```

Giữ Terminal này mở.

Kiểm tra:

```bash
curl http://localhost:4000/health
```

---

## Phần 4 — Public HTTPS miễn phí (bắt buộc cho webhook Zalo)

Zalo **không** gọi được `localhost`. Dùng **Cloudflare Tunnel** free.

### Bước 4.1. Cài cloudflared (1 lần)

```bash
brew install cloudflared
```

### Bước 4.2. Mở tunnel (Terminal **thứ 2**)

API đang chạy port 4000:

```bash
cloudflared tunnel --url http://localhost:4000
```

Copy URL dạng:

```text
https://random-words-xxxx.trycloudflare.com
```

### Bước 4.3. Dán URL vào Zalo Developers

| Chỗ dán | URL đầy đủ |
|---------|------------|
| Official Account Callback URL / OAuth Callback | `https://xxxx.trycloudflare.com/oauth/zalo` |
| Webhook URL | `https://xxxx.trycloudflare.com/webhooks/zalo` |

Lưu / Update trên Zalo.

> Mỗi lần tắt `cloudflared`, URL random đổi → phải cập nhật lại trên Zalo (hoặc dùng named tunnel free Cloudflare account).

---

## Phần 5 — Lấy Access Token + Refresh Token (0đ)

### Cách A — Qua trình duyệt (khuyến nghị)

1. Trên [developers.zalo.me](https://developers.zalo.me) → app → mục **Lấy Access Token** / **Tool** / OA authorization (tuỳ giao diện).  
2. Hoặc mở link ủy quyền Zalo cung cấp (chọn OA, bấm đồng ý).  
3. Browser redirect về:
   ```text
   https://xxxx.trycloudflare.com/oauth/zalo?code=...
   ```
4. Trang hiện **✅ Zalo OA đã kết nối** + refresh token.  
5. Code **tự ghi** `ZALO_ACCESS_TOKEN` / `ZALO_REFRESH_TOKEN` vào `.env` và DB.

### Cách B — Postman (nếu không redirect được)

1. Lấy `authorization code` từ Zalo (sau khi bấm đồng ý, copy `code=` trên URL).  
2. POST:

```http
POST https://oauth.zaloapp.com/v4/oa/access_token
Content-Type: application/x-www-form-urlencoded
secret_key: <ZALO_APP_SECRET>

app_id=<ZALO_APP_ID>
code=<authorization_code>
grant_type=authorization_code
```

3. Copy `access_token` + `refresh_token` vào `.env`.  
4. Restart API: `Ctrl+C` → `npm run api`.

### Lưu ý token

| Token | TTL | Ghi chú |
|-------|-----|---------|
| access_token | ~1 giờ | API tự refresh nếu có refresh_token |
| refresh_token | ~3 tháng | **Dùng 1 lần** mỗi lần refresh → phải lưu token mới |

Làm mới tay:

```bash
curl -X POST http://localhost:4000/oauth/zalo/refresh
```

---

## Phần 6 — Test end-to-end (0đ)

Checklist:

1. [ ] `npm run api` đang chạy  
2. [ ] `cloudflared` đang chạy, URL khớp Zalo  
3. [ ] `/health` → `"configured": true`  
4. [ ] Trên điện thoại: **quan tâm / mở chat OA**  
5. [ ] Gửi tin:

```text
help
```

6. OA trả hướng dẫn (trong 48h).  
7. Gửi mã SPX thật:

```text
SPXVNxxxxxxxxxxxx
```

hoặc:

```text
track SPXVNxxxxxxxxxxxx
```

8. Nhận timeline + “Đã bật thông báo”.  
9. Gửi `list` → thấy mã.  
10. Đợi đơn đổi status (hoặc đợi poller) → OA gửi “Cập nhật vận đơn”.

### Lệnh chat OA

| Gửi | Ý nghĩa |
|-----|---------|
| `help` | Hướng dẫn |
| `SPXVN…` hoặc `track SPXVN…` | Tra cứu + theo dõi |
| `list` | Danh sách đang theo dõi |
| `untrack SPXVN…` | Dừng 1 mã |

---

## Phần 7 — Chạy hàng ngày (local free)

**Terminal 1 — API + poller Zalo:**

```bash
cd ~/order-tracker
npm run api
```

**Terminal 2 — HTTPS public:**

```bash
cloudflared tunnel --url http://localhost:4000
```

**Terminal 3 (tuỳ chọn) — Telegram bot:**

```bash
cd ~/order-tracker
npm run bot
```

Cả hai dùng chung `data/tracker.db`.

---

## Phần 8 — Xử lý lỗi

| Lỗi | Nguyên nhân | Cách xử lý |
|-----|-------------|------------|
| Webhook không vào log API | URL tunnel sai / tunnel tắt | Chạy lại cloudflared, cập nhật URL Zalo |
| `configured: false` | Thiếu app id/secret/token | Kiểm tra `.env` |
| Gửi tin lỗi / `-230` | **Ngoài 48h** | User nhắn lại OA (`list`) |
| Token hết hạn | access 1h, refresh 1 lần | `POST /oauth/zalo/refresh` hoặc OAuth lại |
| OA không liên kết app | Chưa link OA trong Developers | Phần 2.3 |
| Quyền gửi tin bị từ chối | App chưa đủ permission / OA gói hạn chế | Bật quyền tin nhắn trên app; chỉ test CS 48h |

---

## Phần 9 — Kiến trúc code (đã có trong repo)

```
packages/shared/src/channels/zalo.js   # token, send text, parse webhook
apps/api/src/index.js                  # Express: webhook + OAuth + health
apps/api/src/zalo-handlers.js          # track / list / untrack
apps/api/src/poller.js                 # poll status → notify Zalo (nếu trong 48h)
packages/db                            # zalo_users, zalo_subscriptions
```

Luồng:

```
User nhắn OA
  → Zalo POST /webhooks/zalo
  → track SPX + lưu subscription
  → reply kết quả (CS free)

Poller mỗi N phút
  → status đổi?
  → user còn trong 48h?
  → sendZaloText cập nhật
```

---

## Phần 10 — Checklist “Zalo free xong”

- [ ] OA tạo, gói Cơ bản (không trả tiền)  
- [ ] App Developers + App ID/Secret trong `.env`  
- [ ] OA linked với app  
- [ ] `npm run api` OK  
- [ ] cloudflared URL public  
- [ ] Callback + Webhook dán đúng  
- [ ] OAuth lấy được refresh_token  
- [ ] Chat OA: `help` → có reply  
- [ ] `track SPXVN…` → có timeline  
- [ ] Hiểu giới hạn **48h**  

---

## So sánh kênh (phase free)

| | Telegram Bot | Zalo OA gói Cơ bản |
|--|--------------|---------------------|
| Phí | 0đ | 0đ |
| Notify chủ động 24/7 | ✅ | ⚠️ Chỉ ~48h sau user chat |
| Setup | Token BotFather, dễ | OA + App + HTTPS + OAuth, lâu hơn |
| Phù hợp | Dùng chính | Test / phụ |

**Khuyến nghị:** dùng **Telegram làm kênh chính**, Zalo OA để test / user thích Zalo (nhắc họ nhắn lại OA mỗi 2 ngày nếu còn theo dõi đơn).

---

*File: `~/order-tracker/HUONG-DAN-ZALO.md`*
