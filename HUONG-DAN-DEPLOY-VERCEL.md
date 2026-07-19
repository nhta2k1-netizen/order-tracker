# Hướng dẫn chi tiết — Deploy web lên Vercel (qua GitHub)

Mục tiêu: trang Order Tracker có URL public dạng:

```text
https://order-tracker-xxx.vercel.app
```

**Miễn phí** (Vercel Hobby). Chỉ deploy **web** (`apps/web`).  
Bot Telegram vẫn chạy trên máy/VPS riêng (Vercel không giữ bot 24/7 long-polling tốt).

---

## Bạn cần có sẵn

| Thứ | Ghi chú |
|-----|---------|
| Tài khoản [GitHub](https://github.com) | Free |
| Tài khoản [Vercel](https://vercel.com) | Đăng ký bằng GitHub cho tiện |
| Code project `~/order-tracker` | Đã có |
| (Tuỳ chọn) username Telegram bot | Cho nút deep-link |

**Không** đẩy lên GitHub: file `.env`, token bot, database `.db`.

---

## PHẦN A — Đưa code lên GitHub

### A1. Tạo repo trống trên GitHub

1. Mở trình duyệt: [https://github.com/new](https://github.com/new)  
2. Đăng nhập GitHub.  
3. Điền:

| Ô | Gợi ý |
|---|--------|
| **Repository name** | `order-tracker` |
| **Description** | (tuỳ) Theo dõi vận đơn VN |
| **Public** | Chọn Public (free, dễ Vercel) hoặc Private |
| **Add a README** | **Không** tick |
| **Add .gitignore** | **Không** tick |
| **Choose a license** | None |

4. Bấm **Create repository**.  
5. Trang sau tạo xong hiện hướng dẫn — **giữ tab này**, copy URL repo, dạng:

```text
https://github.com/TEN_USER/order-tracker.git
```

Hoặc SSH:

```text
git@github.com:TEN_USER/order-tracker.git
```

---

### A2. Mở Terminal trên Mac — khởi tạo Git local

Copy từng khối, Enter từng lần:

```bash
cd ~/order-tracker
```

```bash
git init
```

```bash
git branch -M main
```

### A3. Kiểm tra secret không bị commit

```bash
git status
```

**Không** được thấy trong danh sách add:

- `.env`
- `apps/web/.env.local`
- `data/tracker.db`
- `node_modules/`

Nếu thấy `.env` → **đừng** `git add .env`. File `.gitignore` đã chặn; nếu vẫn hiện, báo lại.

### A4. Commit lần đầu

```bash
cd ~/order-tracker
git add .
git status
```

Xem lại list — ổn thì:

```bash
git commit -m "Initial commit: Order Tracker web + bot monorepo"
```

Nếu Git báo chưa set tên/email:

```bash
git config --global user.name "Ten Cua Ban"
git config --global user.email "email@example.com"
```

(Rồi `git commit` lại.)

### A5. Gắn remote GitHub và push

**Thay `TEN_USER` bằng username GitHub thật của bạn:**

```bash
cd ~/order-tracker
git remote add origin https://github.com/TEN_USER/order-tracker.git
git push -u origin main
```

#### Lần đầu push — đăng nhập GitHub

- Có thể mở **browser** xin login, hoặc  
- Hỏi **Personal Access Token** (không dùng password cũ):

1. GitHub → **Settings** → **Developer settings** → **Personal access tokens**  
2. Tạo token (classic) quyền `repo`  
3. Khi `git push` hỏi password → **dán token**

Push thành công: F5 trang repo GitHub → thấy folder `apps`, `packages`, `README.md`…

---

## PHẦN B — Kết nối Vercel và Deploy

### B1. Đăng nhập Vercel

1. Mở [https://vercel.com](https://vercel.com)  
2. **Sign Up** / **Log In** → chọn **Continue with GitHub**  
3. Cho phép Vercel truy cập GitHub (Authorize)

### B2. Import project

1. Dashboard Vercel → **Add New…** → **Project**  
2. Trong list repo GitHub, tìm **`order-tracker`**  
3. Nếu không thấy: **Adjust GitHub App Permissions** → cho Vercel đọc repo (All / chỉ repo này) → Save → quay lại Import  
4. Bấm **Import** cạnh `order-tracker`

### B3. Cấu hình Build (QUAN TRỌNG)

Màn **Configure Project**:

#### 1) Project Name

- Giữ `order-tracker` hoặc đổi tên URL (vd `my-order-tracker`)

#### 2) Framework Preset

- Chọn **Next.js** (thường tự nhận)

#### 3) Root Directory — cực kỳ quan trọng

1. Bấm **Edit** cạnh Root Directory  
2. Chọn / gõ: **`apps/web`**  
3. Confirm  

> Monorepo: web nằm trong `apps/web`, **không** để root `./`  
> Sai root → build fail.

#### 4) Build & Output (thường để mặc định)

| Field | Giá trị gợi ý |
|-------|----------------|
| Build Command | `npm run build` (hoặc auto) |
| Output Directory | (Next.js mặc định — để trống / `.next`) |
| Install Command | `npm install` |

Vercel với monorepo npm workspaces: đôi khi cần:

- **Include source files outside Root Directory** / install từ root  

Nếu build lỗi “Cannot find module `@order-tracker/shared`”:

**Cách xử lý phổ biến trên Vercel (monorepo):**

1. Root Directory vẫn `apps/web`  
2. Hoặc đặt Root = repo root và set:
   - Install: `npm install`
   - Build: `npm run build -w @order-tracker/web`
   - Output: (Next) — một số team dùng `cd apps/web && npm run build`

Thử mặc định **Root = `apps/web`** trước.  
File `apps/web/package.json` phụ thuộc `"@order-tracker/shared": "*"` — Vercel cần thấy `packages/shared`.  

**Khuyến nghị cấu hình ổn định monorepo:**

| Setting | Value |
|---------|--------|
| Root Directory | `.` (root repo) — **hoặc** để trống |
| Framework | Next.js |
| Build Command | `npm run build -w @order-tracker/web` |
| Output Directory | `apps/web/.next` |
| Install Command | `npm install` |

**Hoặc** Root Directory = `apps/web` và bật option monorepo / “Root Directory” với project including parent packages.

*(Trong guide user-facing, đưa cả 2 profile — thử Profile A trước.)*

### B4. Environment Variables

Trước khi Deploy, mục **Environment Variables** → **Add**:

| Key | Value | Environment |
|-----|--------|-------------|
| `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` | `ten_bot_cua_ban` (không `@`) | Production, Preview, Development |

Ví dụ value: `order_tracker_vn_bot`

Không cần `TELEGRAM_BOT_TOKEN` trên Vercel (token chỉ cho máy chạy bot).

### B5. Deploy

1. Bấm **Deploy**  
2. Đợi 1–3 phút (log build chạy)  
3. Thấy **Congratulations** / check xanh  
4. Bấm **Visit** / copy URL:

```text
https://order-tracker-xxxxx.vercel.app
```

### B6. Kiểm tra sau deploy

1. Mở URL Vercel trên điện thoại (4G)  
2. Nhập mã SPXVN thật → có timeline  
3. Nút Telegram → mở đúng bot (nếu đã set env)

---

## PHẦN C — Cập nhật code sau này

Mỗi lần sửa code local:

```bash
cd ~/order-tracker
git add .
git commit -m "Mo ta thay doi"
git push
```

Vercel **tự deploy lại** (auto) khi push `main`.

Đổi env trên Vercel:

**Project → Settings → Environment Variables → Edit → Redeploy**

---

## PHẦN D — Lỗi thường gặp

| Lỗi | Cách xử lý |
|-----|------------|
| Build failed: module `@order-tracker/shared` | Dùng build từ root monorepo (xem B3) |
| Root Directory sai | Đặt `apps/web` hoặc build `-w @order-tracker/web` từ root |
| Nút Telegram không đúng bot | Thêm env `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` + **Redeploy** |
| `git push` bị reject / auth | Dùng PAT token hoặc GitHub CLI login |
| Lỡ commit `.env` | Đổi token bot ngay (BotFather `/revoke`), xóa file khỏi git history |
| Trang 404 | Sai root / chưa build Next đúng |

---

## PHẦN E — Checklist

- [ ] Repo GitHub tạo xong  
- [ ] `git push` thấy code trên github.com  
- [ ] Vercel login bằng GitHub  
- [ ] Import `order-tracker`  
- [ ] Root / Build trỏ đúng web monorepo  
- [ ] Env username bot (tuỳ chọn)  
- [ ] Deploy xanh  
- [ ] Mở URL public tra mã OK  

---

## Bot Telegram sau khi có web public?

Web trên Vercel **chỉ** tra cứu.  
Bot notify vẫn cần:

```bash
# Trên máy luôn bật, hoặc VPS free
cd ~/order-tracker
npm run bot
```

Nút web → deep-link bot; bot phải **đang chạy** mới trả lời.

---

*File: `~/order-tracker/HUONG-DAN-DEPLOY-VERCEL.md`*
