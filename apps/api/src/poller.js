/**
 * Poller dùng chung (Zalo notify). Telegram vẫn do apps/bot poller xử lý
 * nếu bot đang chạy — hai poller cùng DB, smart skip theo last_checked.
 */
import {
  listActivePackages,
  updatePackageFromTrack,
  replaceHistory,
  listActiveZaloSubsForPackage,
  markZaloSubscriptionNotified,
  listActiveSubsForPackage,
  deactivatePackage,
} from "@order-tracker/db";
import {
  trackPackage,
  pollPriority,
  isTerminalStatus,
  formatTrackingZalo,
  sendZaloText,
  isWithinReplyWindow,
  isZaloConfigured,
} from "@order-tracker/shared";

let timer = null;
let running = false;

function envMinutes(name, fallback) {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function startApiPoller() {
  const baseMin = envMinutes("POLL_INTERVAL_MINUTES", 10);
  const ms = baseMin * 60 * 1000;
  if (timer) clearInterval(timer);

  setTimeout(() => {
    pollAll().catch((e) => console.error("[api-poller] first", e));
  }, 10000);

  timer = setInterval(() => {
    pollAll().catch((e) => console.error("[api-poller] tick", e));
  }, ms);

  console.log(`[api-poller] Mỗi ${baseMin} phút (Zalo notify nếu trong 48h)`);
}

export async function pollAll() {
  if (running) return { skipped: true };
  running = true;
  const results = [];
  try {
    const packages = listActivePackages();
    const now = Date.now();
    for (const pkg of packages) {
      if (!shouldCheckNow(pkg, now)) continue;
      try {
        results.push(await checkPackage(pkg));
        await sleep(500);
      } catch (err) {
        results.push({ tracking: pkg.tracking_number, error: err.message });
      }
    }
  } finally {
    running = false;
    console.log(
      "[api-poller]",
      JSON.stringify({
        checked: results.length,
        zaloNotified: results.reduce((a, r) => a + (r.zaloNotified || 0), 0),
      })
    );
  }
  return { results };
}

function shouldCheckNow(pkg, nowMs) {
  let lastMs = 0;
  if (pkg.last_checked_at) {
    const parsed = Date.parse(
      pkg.last_checked_at.includes("T")
        ? pkg.last_checked_at
        : pkg.last_checked_at.replace(" ", "T") + "Z"
    );
    lastMs = Number.isNaN(parsed) ? 0 : parsed;
  }
  const priority = pollPriority(pkg.current_status, pkg.current_status_raw);
  if (priority === "stop") return false;
  const fast = envMinutes("POLL_FAST_MINUTES", 5);
  const normal = envMinutes("POLL_INTERVAL_MINUTES", 10);
  const slow = envMinutes("POLL_SLOW_MINUTES", 30);
  let intervalMin = normal;
  if (priority === "fast") intervalMin = fast;
  else if (priority === "slow") intervalMin = slow;
  if (!lastMs) return true;
  return nowMs - lastMs >= intervalMin * 60 * 1000;
}

async function checkPackage(pkg) {
  const result = await trackPackage(pkg.tracking_number);
  if (!result.ok) {
    updatePackageFromTrack(pkg.id, {
      ...result,
      currentStatus: pkg.current_status,
      currentStatusRaw: pkg.current_status_raw,
      events: [],
    });
    return { tracking: pkg.tracking_number, ok: false, zaloNotified: 0 };
  }

  const prev = pkg.current_status;
  const changed = Boolean(prev && prev !== result.currentStatus) || !prev;

  updatePackageFromTrack(pkg.id, result);
  replaceHistory(pkg.id, result.events);

  let zaloNotified = 0;

  if (changed && isZaloConfigured()) {
    const zsubs = listActiveZaloSubsForPackage(pkg.id);
    for (const sub of zsubs) {
      if (
        sub.last_notified_status &&
        sub.last_notified_status === result.currentStatus
      ) {
        continue;
      }
      if (!isWithinReplyWindow(sub.last_user_message_at, 48)) {
        console.warn(
          `[api-poller] Bỏ Zalo notify ${sub.user_id} — ngoài 48h (user cần nhắn lại OA)`
        );
        continue;
      }
      const text = formatTrackingZalo(result, {
        mode: "update",
        prevStatus: sub.last_notified_status || prev,
      });
      const sent = await sendZaloText(sub.user_id, text);
      if (sent.ok) {
        markZaloSubscriptionNotified(sub.user_id, pkg.id, result.currentStatus);
        zaloNotified += 1;
      } else {
        console.error(
          `[api-poller] Zalo fail ${sub.user_id}:`,
          sent.error,
          sent.outsideWindow ? "(48h)" : ""
        );
      }
      await sleep(300);
    }
  }

  // Chỉ deactivate nếu không còn sub Telegram + Zalo active
  if (isTerminalStatus(result.currentStatus, result.currentStatusRaw)) {
    const tg = listActiveSubsForPackage(pkg.id);
    const zl = listActiveZaloSubsForPackage(pkg.id);
    if (tg.length === 0 && zl.length === 0) {
      deactivatePackage(pkg.id);
    }
  }

  return {
    tracking: pkg.tracking_number,
    ok: true,
    changed,
    zaloNotified,
  };
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
