/**
 * Order Tracker — Telegram Bot
 *
 * Chạy:
 *   bash scripts/start-bot.sh
 *   hoặc: npm run bot
 *
 * Lưu ý Telegraf 4: bot.launch() Promise chỉ xong khi bot DỪNG.
 * Dùng callback onLaunch (tham số 2) để biết bot đã sẵn sàng.
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
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error(
    "❌ Thiếu TELEGRAM_BOT_TOKEN.\n" +
      "   1. Mở Telegram → @BotFather → /newbot\n" +
      "   2. Copy token vào file .env\n" +
      "   3. Chạy lại: npm run bot"
  );
  process.exit(1);
}

const allowed = (process.env.TELEGRAM_ALLOWED_CHAT_IDS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// Railway/Render: set DATA_DIR=/data hoặc dùng /tmp nếu không ghi được ./data
const dataDir =
  process.env.DATA_DIR ||
  process.env.RAILWAY_VOLUME_MOUNT_PATH ||
  path.resolve(__dirname, "../../../data");
try {
  initDb({ dataDir });
} catch (err) {
  console.error("[bot] Không mở được DB tại", dataDir, err.message);
  console.error("[bot] Thử DATA_DIR=/tmp/order-tracker-data");
  initDb({ dataDir: "/tmp/order-tracker-data" });
}

const bot = new Telegraf(token);

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
bot.on("text", handleText);

bot.catch((err, ctx) => {
  console.error(`[bot] error chat=${ctx?.chat?.id}`, err);
  ctx?.reply?.("⚠️ Có lỗi xảy ra. Thử lại sau.").catch(() => {});
});

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

function onReady() {
  const me = bot.botInfo;
  console.log(
    `[bot] ✅ @${me?.username || "?"} (id=${me?.id}) đang chạy long-polling`
  );
  startPoller(bot);
  console.log("[bot] Poller:", JSON.stringify(getPollerStatus()));
}

/**
 * Launch: callback thứ 2 = sau getMe, trước khi poll (đúng chỗ start poller).
 * Promise của launch() chỉ settle khi bot stop → không dùng .then() cho "đã sẵn sàng".
 */
async function main() {
  console.log("[bot] Đang kết nối Telegram…");

  let attempt = 0;
  const maxAttempts = 5;

  while (attempt < maxAttempts) {
    attempt += 1;
    try {
      // Không await launch hết vòng đời — chỉ fire + onReady
      const launchPromise = bot.launch(
        { dropPendingUpdates: true },
        onReady
      );

      // Nếu 409, launch reject sớm. Nếu OK, promise treo đến khi stop (bình thường).
      launchPromise.catch((err) => {
        const msg = String(err?.message || err);
        if (
          msg.includes("409") ||
          msg.toLowerCase().includes("conflict")
        ) {
          console.error(
            "[bot] 409 Conflict — còn instance bot khác. Dừng bot cũ rồi chạy lại."
          );
          console.error(
            "[bot]   bash scripts/start-bot.sh"
          );
        } else {
          console.error("[bot] Lỗi polling:", msg);
        }
        process.exit(1);
      });

      // Đợi chút xem có reject ngay (409) không
      await new Promise((r) => setTimeout(r, 2500));
      // Nếu process còn sống và không exit → coi như OK
      return;
    } catch (err) {
      const msg = String(err?.message || err);
      const is409 =
        msg.includes("409") || msg.toLowerCase().includes("conflict");
      if (!is409 || attempt >= maxAttempts) {
        console.error("[bot] Không khởi động được:", msg);
        process.exit(1);
      }
      console.log(
        `[bot] ⚠️ Conflict. Đợi ${attempt * 3}s rồi thử lại (${attempt}/${maxAttempts})…`
      );
      await new Promise((r) => setTimeout(r, attempt * 3000));
    }
  }
}

main();
