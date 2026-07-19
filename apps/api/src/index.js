/**
 * Order Tracker API
 * - Webhook Zalo OA (test free)
 * - OAuth callback lấy access/refresh token
 * - Health + track thử
 *
 * Chạy: npm run api  (từ root monorepo)
 */
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import dotenv from "dotenv";
import express from "express";
import { initDb, setSecret, getSecret } from "@order-tracker/db";
import {
  loadZaloTokens,
  exchangeZaloAuthCode,
  refreshZaloAccessToken,
  getZaloTokenState,
  isZaloConfigured,
  parseZaloWebhook,
  trackPackage,
} from "@order-tracker/shared";
import { handleZaloUserText } from "./zalo-handlers.js";
import { startApiPoller } from "./poller.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const PORT = Number(process.env.PORT || 4000);
const HOST = process.env.HOST || "0.0.0.0";
const dataDir =
  process.env.DATA_DIR || path.resolve(__dirname, "../../../data");

initDb({ dataDir });

// Nạp token từ env hoặc DB
const dbRefresh = getSecret("zalo_refresh_token");
const dbAccess = getSecret("zalo_access_token");
loadZaloTokens({
  accessToken: process.env.ZALO_ACCESS_TOKEN || dbAccess || undefined,
  refreshToken: process.env.ZALO_REFRESH_TOKEN || dbRefresh || undefined,
});

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

app.get("/health", (_req, res) => {
  const tokens = getZaloTokenState();
  res.json({
    ok: true,
    zalo: {
      configured: isZaloConfigured(),
      hasAccessToken: Boolean(tokens.accessToken),
      hasRefreshToken: Boolean(tokens.refreshToken),
      expiresAt: tokens.expiresAt || null,
    },
  });
});

/**
 * Tra cứu nhanh (test)
 * GET /api/track/SPXVN...
 */
app.get("/api/track/:code", async (req, res) => {
  try {
    const result = await trackPackage(req.params.code);
    res.json(result);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * OAuth callback — dán URL này vào Callback URL trên Zalo Developers.
 * GET /oauth/zalo?code=...
 */
app.get("/oauth/zalo", async (req, res) => {
  const code = req.query.code;
  if (!code) {
    return res
      .status(400)
      .send(
        "Thiếu ?code=... — mở link ủy quyền từ Zalo Developers (xem HUONG-DAN-ZALO.md)"
      );
  }
  try {
    const tokens = await exchangeZaloAuthCode(
      String(code),
      req.query.code_verifier ? String(req.query.code_verifier) : undefined
    );
    // Lưu DB + gợi ý ghi .env
    setSecret("zalo_access_token", tokens.accessToken);
    if (tokens.refreshToken) {
      setSecret("zalo_refresh_token", tokens.refreshToken);
    }
    appendEnvTokens(tokens);

    res.type("html").send(`<!doctype html>
<html><body style="font-family:sans-serif;max-width:640px;margin:40px auto">
  <h1>✅ Zalo OA đã kết nối</h1>
  <p>Access token + refresh token đã lưu vào <code>data</code> và cố gắng ghi <code>.env</code>.</p>
  <p><b>Refresh token</b> (sao lưu):</p>
  <pre style="background:#f4f4f4;padding:12px;word-break:break-all">${escapeHtml(tokens.refreshToken || "(không có)")}</pre>
  <p>Có thể đóng tab. API đang chạy — test webhook / gửi tin OA.</p>
</body></html>`);
  } catch (err) {
    console.error("[oauth/zalo]", err);
    res.status(500).send(`Lỗi: ${escapeHtml(err.message)}`);
  }
});

/**
 * Làm mới token thủ công
 * POST /oauth/zalo/refresh
 */
app.post("/oauth/zalo/refresh", async (_req, res) => {
  try {
    // Ưu tiên refresh trong DB
    const rt = getSecret("zalo_refresh_token") || process.env.ZALO_REFRESH_TOKEN;
    if (rt) loadZaloTokens({ refreshToken: rt });
    const tokens = await refreshZaloAccessToken();
    setSecret("zalo_access_token", tokens.accessToken);
    if (tokens.refreshToken) setSecret("zalo_refresh_token", tokens.refreshToken);
    appendEnvTokens(tokens);
    res.json({ ok: true, expiresIn: tokens.expiresIn });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * Webhook Zalo OA
 * POST /webhooks/zalo
 */
app.post("/webhooks/zalo", async (req, res) => {
  // Zalo yêu cầu 200 nhanh
  res.status(200).json({ ok: true });

  try {
    const events = parseZaloWebhook(req.body);
    if (events.length === 0) {
      console.log("[zalo webhook] event khác:", JSON.stringify(req.body).slice(0, 300));
      return;
    }
    for (const ev of events) {
      if (ev.type === "user_send_text" && ev.userId) {
        console.log(
          `[zalo webhook] user=${ev.userId} text=${String(ev.text).slice(0, 80)}`
        );
        await handleZaloUserText(ev.userId, ev.text || "");
      }
    }
  } catch (err) {
    console.error("[zalo webhook]", err);
  }
});

/** Zalo đôi khi GET để verify */
app.get("/webhooks/zalo", (_req, res) => {
  res.status(200).send("ok");
});

function appendEnvTokens(tokens) {
  try {
    const envPath = path.resolve(__dirname, "../../../.env");
    if (!fs.existsSync(envPath)) return;
    let content = fs.readFileSync(envPath, "utf8");
    content = upsertEnvLine(content, "ZALO_ACCESS_TOKEN", tokens.accessToken);
    if (tokens.refreshToken) {
      content = upsertEnvLine(content, "ZALO_REFRESH_TOKEN", tokens.refreshToken);
    }
    fs.writeFileSync(envPath, content, "utf8");
    console.log("[oauth] Đã cập nhật .env (ZALO_*_TOKEN)");
  } catch (err) {
    console.warn("[oauth] Không ghi được .env:", err.message);
  }
}

function upsertEnvLine(content, key, value) {
  const line = `${key}=${value}`;
  const re = new RegExp(`^${key}=.*$`, "m");
  if (re.test(content)) return content.replace(re, line);
  return content.trimEnd() + `\n${line}\n`;
}

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

app.listen(PORT, HOST, () => {
  console.log(`[api] http://${HOST}:${PORT}`);
  console.log(`[api] Health:  http://localhost:${PORT}/health`);
  console.log(`[api] Zalo WH: http://localhost:${PORT}/webhooks/zalo`);
  console.log(`[api] OAuth:   http://localhost:${PORT}/oauth/zalo`);
  console.log(`[api] Zalo configured: ${isZaloConfigured()}`);
  startApiPoller();
});
