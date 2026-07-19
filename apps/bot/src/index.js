/**
 * Order Tracker — Telegram Bot
 *
 * Chạy:
 *   1. cp .env.example .env  → điền TELEGRAM_BOT_TOKEN
 *   2. npm install (từ root monorepo)
 *   3. npm run bot
 *
 * Tạo bot: Telegram → @BotFather → /newbot
 */
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { Telegraf } from "telegraf";
import { initDb } from "@order-tracker/db";
import {
  handleStart,
  handleHelp,
  handleTrack,
  handleStatus,
  handleList,
  handleUntrack,
  handleUntrackAll,
  handleText,
} from "./handlers.js";
import { startPoller, getPollerStatus } from "./poller.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Load .env từ root monorepo hoặc apps/bot
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error(
    "❌ Thiếu TELEGRAM_BOT_TOKEN.\n" +
      "   1. Mở Telegram → @BotFather → /newbot\n" +
      "   2. Copy token vào file .env (xem .env.example)\n" +
      "   3. Chạy lại: npm run bot"
  );
  process.exit(1);
}

// Optional allow-list
const allowed = (process.env.TELEGRAM_ALLOWED_CHAT_IDS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// DB
const dataDir =
  process.env.DATA_DIR ||
  path.resolve(__dirname, "../../../data");
initDb({ dataDir });

const bot = new Telegraf(token);

// Middleware: log + allow-list
bot.use(async (ctx, next) => {
  const chatId = String(ctx.chat?.id || ctx.from?.id || "");
  if (allowed.length > 0 && !allowed.includes(chatId)) {
    if (ctx.message) {
      await ctx.reply("⛔ Bot đang ở chế độ giới hạn. Liên hệ admin để được mở.");
    }
    return;
  }
  return next();
});

bot.start(handleStart);
bot.help(handleHelp);
bot.command("track", handleTrack);
bot.command("status", handleStatus);
bot.command("list", handleList);
bot.command("untrack", handleUntrack);
bot.command("untrack_all", handleUntrackAll);

// Gửi mã / link trực tiếp
bot.on("text", handleText);

bot.catch((err, ctx) => {
  console.error(`[bot] error chat=${ctx?.chat?.id}`, err);
  ctx?.reply?.("⚠️ Có lỗi xảy ra. Thử lại sau.").catch(() => {});
});

// Graceful stop
async function shutdown(signal) {
  console.log(`[bot] ${signal} — dừng…`);
  try {
    bot.stop(signal);
  } catch {
    /* ignore */
  }
  process.exit(0);
}
process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));

// Launch
bot
  .launch({ dropPendingUpdates: true })
  .then(() => {
    const me = bot.botInfo;
    console.log(
      `[bot] ✅ @${me?.username || "?"} (id=${me?.id}) đang chạy long-polling`
    );
    startPoller(bot);
    console.log("[bot] Poller:", getPollerStatus());
  })
  .catch((err) => {
    console.error("[bot] Không khởi động được:", err.message);
    process.exit(1);
  });
