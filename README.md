# Order Tracker — Theo dõi đơn Shopee / TikTok / đa carrier VN

Hệ thống theo dõi vận đơn **chỉ bằng mã vận đơn** (không cần mở app), gồm:

1. **Telegram Bot** ✅ (đã code — phần này)
2. **Backend API** (tiếp theo)
3. **Web Next.js** (tiếp theo)
4. Worker polling + thông báo thông minh

Chi phí giai đoạn dev/test: **0đ** (free tier).

---

## Cấu trúc thư mục (monorepo)

```
order-tracker/
├── package.json                 # npm workspaces
├── .env.example
├── README.md
├── data/                        # SQLite (gitignore)
│
├── apps/
│   ├── bot/                     # ✅ Telegram Bot (Telegraf)
│   │   ├── package.json
│   │   ├── README.md
│   │   └── src/
│   │       ├── index.js         # Entry: launch bot + poller
│   │       ├── handlers.js      # /track /list /untrack …
│   │       └── poller.js        # Poll thông minh + notify
│   │
│   ├── api/                     # 🔜 Express API (Web + Bot dùng chung)
│   │   └── src/
│   │
│   └── web/                     # 🔜 Next.js 15 + Tailwind (Vercel)
│
└── packages/
    ├── shared/                  # Logic dùng chung
    │   └── src/
    │       ├── index.js
    │       ├── carriers/
    │       │   ├── detect.js    # Nhận diện ĐVVC từ mã
    │       │   ├── spx.js       # Tracker Shopee Express
    │       │   └── track.js     # Router trackPackage()
    │       └── utils/
    │           ├── extract.js   # Extract mã từ text/link
    │           └── format.js    # Format tin nhắn Telegram
    │
    └── db/                      # SQLite (better-sqlite3)
        └── src/
            └── index.js         # users, packages, subscriptions, history
```

### Luồng dữ liệu

```
Người dùng (Telegram / Web)
        │
        ▼
   apps/bot  hoặc  apps/api
        │
        ▼
 packages/shared  →  detectCarrier + trackPackage (SPX API…)
        │
        ▼
 packages/db      →  SQLite: packages + subscriptions + history
        │
        ▼
   poller (bot)   →  so sánh status → Telegram notify
```

---

## Bắt đầu nhanh — Telegram Bot

### 1. Tạo bot

1. Telegram → [@BotFather](https://t.me/BotFather) → `/newbot`
2. Copy token

### 2. Cài & cấu hình

```bash
cd ~/order-tracker
cp .env.example .env
# Điền: TELEGRAM_BOT_TOKEN=123456:ABC...

npm install
npm run bot
```

### 3. Dùng thử

Mở bot trên Telegram:

```
/start
/track SPXVNxxxxxxxxxxxx
```

Hoặc dán thẳng mã / link đơn hàng.

| Lệnh | Chức năng |
|------|-----------|
| `/track <mã>` | Tra cứu + **bật thông báo** |
| `/status <mã>` | Chỉ xem |
| `/list` | Đang theo dõi |
| `/untrack <mã>` | Dừng 1 mã |
| `/untrack_all` | Dừng hết |

---

## Đã hỗ trợ / sắp có

| Carrier | Trạng thái |
|---------|------------|
| Shopee Express (SPX) | ✅ API public |
| GHTK, GHN, J&T, Viettel, Ninja, Best | 🔜 detect OK, tracker phase 2 |
| TikTok Shop (thường SPX/J&T/…) | 🔜 qua mã ĐVVC |

| Kênh | Trạng thái |
|------|------------|
| Telegram | ✅ |
| Zalo OA (gói Cơ bản, test 48h) | ✅ code + [HUONG-DAN-ZALO.md](./HUONG-DAN-ZALO.md) |
| Web Next.js | ✅ `apps/web` — `npm run web` |

---

## Stack free

| Thành phần | Công nghệ | Host free |
|------------|-----------|-----------|
| Bot | Node + Telegraf | Render Worker / VPS |
| API | Node Express | Render / Railway |
| Web | Next.js 15 + Tailwind | Vercel |
| DB | SQLite → Supabase sau | File / Supabase free |
| Scrape | Playwright (khi cần) | Cùng backend |

---

## Lộ trình tiếp theo

1. ~~Telegram Bot~~ ✅  
2. **Web Next.js** ✅ — `npm run web` → http://localhost:3000  
3. **Telegram bot** ✅ — `npm run bot`  
4. Thêm carrier (GHN/GHTK/…)  
5. Deploy Vercel (web) / Render (bot)

---

## Ghi chú từ project cũ

Repo `~/spx-tracker` là bản đơn giản (SPX + email). Project này **mở rộng** multi-carrier + Telegram + monorepo, tái sử dụng logic ký SPX API.
