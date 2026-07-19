# Telegram Bot — Order Tracker

Bot theo dõi vận đơn (ưu tiên Shopee Express / SPX), gửi thông báo khi trạng thái đổi.

## Tạo bot (BotFather)

1. Mở Telegram, chat với [@BotFather](https://t.me/BotFather)
2. Gõ `/newbot` → đặt tên hiển thị + username (phải kết thúc bằng `bot`)
3. Copy **token** dạng `7123456789:AAH...`
4. (Tuỳ chọn) `/setcommands` paste:

```
track - Tra cứu và theo dõi mã vận đơn
status - Xem trạng thái (không đăng ký)
list - Danh sách đang theo dõi
untrack - Dừng theo dõi một mã
untrack_all - Dừng tất cả
help - Trợ giúp
```

## Cấu hình

Từ thư mục gốc monorepo:

```bash
cd ~/order-tracker
cp .env.example .env
# Sửa TELEGRAM_BOT_TOKEN=...
```

## Chạy

```bash
# Từ root
npm install
npm run bot

# Dev (tự restart khi sửa code)
npm run bot:dev
```

Mở Telegram → tìm bot → `/start` → gửi mã `SPXVN...`.

## Lệnh người dùng

| Lệnh / hành động | Mô tả |
|------------------|--------|
| `/start` | Giới thiệu + help |
| `/track SPXVN…` | Tra cứu live + bật thông báo |
| Gửi thẳng mã hoặc link | Tự extract mã và track |
| `/status SPXVN…` | Chỉ xem, không đổi đăng ký |
| `/list` | Các mã đang theo dõi |
| `/untrack SPXVN…` | Tắt thông báo mã đó |
| `/untrack_all` | Tắt hết |

## Deep link từ Web (sau này)

```
https://t.me/<BOT_USERNAME>?start=SPXVN0123456789
```

Bot nhận payload sau `/start` và tự track.

## Polling thông báo

- Worker nội bộ poll các mã **còn subscription active**
- Tần suất thông minh: nhanh khi đang giao, chậm khi chờ lấy
- Chỉ gửi Telegram khi `current_status` đổi
- Tự dừng khi giao thành công / hoàn / hủy

## Deploy free (Render / Railway)

- **Background Worker** (không phải web service) chạy `npm run bot`
- Set env `TELEGRAM_BOT_TOKEN`, `DATA_DIR=/data` + persistent disk
- Free tier có thể sleep — với long-polling bot, nên dùng service “always on” nếu có, hoặc VPS rẻ / Oracle free

## Giới hạn free

| Thành phần | Ghi chú |
|------------|---------|
| Telegram Bot API | Miễn phí |
| SQLite | Local file, 0đ |
| SPX public API | Không key, rate-limit nhẹ |
| Render free | Worker có thể bị spin down |
