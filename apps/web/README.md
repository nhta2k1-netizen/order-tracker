# Web — Order Tracker (Next.js 15 + Tailwind)

Trang tra cứu vận đơn: nhập mã / dán link → timeline + CTA Telegram.

## Chạy local

```bash
# Từ root monorepo
cd ~/order-tracker
cp apps/web/.env.example apps/web/.env.local
# Sửa NEXT_PUBLIC_TELEGRAM_BOT_USERNAME=ten_bot_khong_co_@

npm install
npm run web
```

Mở: [http://localhost:3000](http://localhost:3000)

## Env

| Biến | Ý nghĩa |
|------|---------|
| `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` | Username bot (không `@`) cho deep-link `t.me/bot?start=MÃ` |

## API nội bộ

- `POST /api/track` body `{ "q": "SPXVN… hoặc link" }`
- `GET /api/track?q=...`

Dùng `@order-tracker/shared` (SPX + detect + extract).

## Deploy Vercel (free)

1. Import repo / folder monorepo lên Vercel  
2. **Root Directory:** `apps/web`  
3. Framework: Next.js  
4. Env: `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME`  
5. Deploy  

Hoặc CLI:

```bash
cd apps/web
npx vercel
```

## Tính năng

- Ô nhập lớn + nút Theo dõi  
- Extract mã từ link  
- Card trạng thái màu theo status  
- Timeline lịch sử  
- Lịch sử gần đây (localStorage)  
- Nút mở Telegram bot + auto `/start MÃ`  
