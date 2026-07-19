# Bot Telegram chạy 24/7 khi **tắt Mac**

## Sự thật quan trọng

| Nơi chạy bot | Tắt Mac thì bot… |
|--------------|------------------|
| `npm run bot` / `nohup` trên Mac | **Tắt theo** |
| Cloud (VPS / Render / Railway…) | **Vẫn chạy** |

Web Vercel **không** chạy bot. Cần **một máy ảo / worker trên internet** luôn bật.

---

## So sánh cách free / rẻ

| Cách | 24/7 thật? | Độ khó | Ghi chú 2026 |
|------|------------|--------|--------------|
| **A. Railway** | ✅ trong hạn mức free credit | Dễ | Đăng ký GitHub, dán token |
| **B. Render Worker** | ⚠️ Free hay sleep / hạn chế | Dễ | Plan free worker có thể đổi chính sách |
| **C. Oracle Cloud Free VPS** | ✅ rất ổn | Khó hơn | Always Free ARM, bền |
| Fly.io / VPS VN | ✅ | Trung bình | Tuỳ tài khoản |

**Khuyến nghị bắt đầu:** **Railway** (nhanh).  
**Muốn free bền lâu:** **Oracle Free VPS**.

---

# CÁCH A — Railway (dễ, ~10 phút)

### A1. Đăng ký

1. Vào [https://railway.app](https://railway.app)  
2. **Login with GitHub** (cùng acc `nhta2k1-netizen`)  
3. Cho phép Railway đọc repo

### A2. New project từ GitHub

1. **New Project** → **Deploy from GitHub repo**  
2. Chọn **`order-tracker`**  
3. Nếu hỏi root: để root repo (`.`)

### A3. Cấu hình service

1. Vào service vừa tạo  
2. **Settings**:  
   - **Start Command:** `npm run bot`  
   - **Build Command:** `npm install` (mặc định thường OK)  
3. **Variables** → Add:

| Key | Value |
|-----|--------|
| `TELEGRAM_BOT_TOKEN` | token từ BotFather (dán thật) |
| `DATA_DIR` | `/data` hoặc `/app/data` |
| `POLL_INTERVAL_MINUTES` | `10` |
| `NODE_ENV` | `production` |

4. (Tuỳ) **Volumes** gắn path `/data` để không mất DB khi redeploy  

### A4. Deploy

- Railway tự build + start  
- Tab **Deployments / Logs** thấy:

```text
[bot] ✅ @order_tracker_vn_bot ... đang chạy long-polling
```

### A5. Tắt bot trên Mac (tránh conflict)

Chỉ **một** bot long-polling / một token:

```bash
# Trên Mac
pkill -f "npm run bot"
# hoặc kill PID nohup
```

### A6. Thử Telegram

Gửi `/start` — bot reply khi **Mac đã tắt** cũng được.

---

# CÁCH B — Render Background Worker

### B1. Đăng ký

[https://render.com](https://render.com) → Login GitHub

### B2. New Background Worker

1. **New +** → **Background Worker**  
2. Connect repo **`order-tracker`**  
3. Cấu hình:

| Field | Value |
|-------|--------|
| Name | `order-tracker-bot` |
| Region | Singapore (gần VN) |
| Branch | `main` |
| Root Directory | *(để trống)* |
| Runtime | Node |
| Build Command | `npm install` |
| Start Command | `npm run bot` |
| Plan | Free (nếu còn) |

### B3. Environment

| Key | Value |
|-----|--------|
| `TELEGRAM_BOT_TOKEN` | token BotFather |
| `DATA_DIR` | `/opt/render/project/src/data` |
| `POLL_INTERVAL_MINUTES` | `10` |

### B4. Create Worker → xem Logs

Thấy `@order_tracker_vn_bot đang chạy` → OK.

**Lưu ý:** Free Render đôi khi **spin down** / hạn chế worker. Nếu bot “chết im”, xem Logs hoặc nâng plan / đổi Railway-Oracle.

Repo đã có file `render.yaml` — có thể **New → Blueprint** và chọn repo.

---

# CÁCH C — Oracle Cloud Free (24/7 thật, free)

### Ý tưởng

Tạo **máy ảo Linux** free → cài Node → clone repo → `npm run bot` bằng `pm2` → Mac tắt không ảnh hưởng.

### C1. Tạo account

1. [https://www.oracle.com/cloud/free/](https://www.oracle.com/cloud/free/)  
2. Đăng ký (cần thẻ để verify, **không** bị trừ nếu dùng trong Always Free)  
3. Tạo **VM.Standard.A1.Flex** (Ampere ARM) Always Free  

### C2. SSH vào VPS

```bash
ssh ubuntu@IP_PUBLIC_CUA_BAN
```

### C3. Cài Node 20

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs git build-essential python3
node -v
```

### C4. Clone & cấu hình

```bash
git clone https://github.com/nhta2k1-netizen/order-tracker.git
cd order-tracker
nano .env
```

Dán:

```env
TELEGRAM_BOT_TOKEN=token_cua_ban
DATA_DIR=./data
POLL_INTERVAL_MINUTES=10
```

```bash
npm install
```

### C5. Chạy bằng pm2 (tự restart, bật máy là chạy)

```bash
sudo npm install -g pm2
pm2 start npm --name order-bot -- run bot
pm2 save
pm2 startup
# copy lệnh pm2 gợi ý rồi chạy
```

### C6. Tắt bot Mac

```bash
pkill -f "npm run bot"
```

### C7. Kiểm tra

```bash
pm2 logs order-bot
```

Telegram `/start` khi Mac đã tắt.

---

# Docker (mọi VPS có Docker)

Trên VPS:

```bash
git clone https://github.com/nhta2k1-netizen/order-tracker.git
cd order-tracker
docker build -f Dockerfile.bot -t order-bot .
docker run -d --name order-bot --restart unless-stopped \
  -e TELEGRAM_BOT_TOKEN="token_cua_ban" \
  -e DATA_DIR=/data \
  -v order_bot_data:/data \
  order-bot
docker logs -f order-bot
```

---

# Quy tắc vàng

1. **Chỉ 1 instance bot** / 1 token (Mac + cloud cùng lúc → conflict, bot “đơ”).  
2. Token chỉ đưa vào **Variables** cloud / `.env` VPS — **không** commit GitHub.  
3. Web Vercel = tra cứu; Bot cloud = thông báo.  
4. Free tier có thể đổi chính sách — nếu sleep, chuyển Oracle/VPS.

---

# Checklist “tắt Mac bot vẫn sống”

- [ ] Bot deploy Railway / Render / Oracle  
- [ ] Logs có `@order_tracker_vn_bot đang chạy`  
- [ ] Đã **tắt** `npm run bot` trên Mac  
- [ ] Telegram `/start` OK  
- [ ] **Tắt hẳn Mac** → vẫn `/start` được  

---

# Tóm tắt nhanh

| Mục tiêu | Làm gì |
|----------|--------|
| Tắt Mac bot vẫn chạy | Đưa bot lên **cloud**, không để trên Mac |
| Cách dễ nhất | **Railway** + `TELEGRAM_BOT_TOKEN` + start `npm run bot` |
| Free bền | **Oracle Always Free VPS** + `pm2` |
| Mac local | Chỉ test; `nohup` **không** sống khi tắt nguồn |

---

*File: `~/order-tracker/HUONG-DAN-BOT-24-7.md`*
