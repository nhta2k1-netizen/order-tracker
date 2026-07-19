#!/usr/bin/env bash
# Chạy bot Telegram (1 instance). Dùng từ root monorepo:
#   bash scripts/start-bot.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "→ Dừng bot cũ (nếu có)…"
# Kill node apps/bot/src/index.js
while read -r pid; do
  [ -n "$pid" ] || continue
  cmd=$(ps -p "$pid" -o command= 2>/dev/null || true)
  case "$cmd" in
    *apps/bot/src/index.js*|*order-tracker/apps/bot*)
      echo "  kill $pid"
      kill "$pid" 2>/dev/null || true
      ;;
  esac
done < <(pgrep -x node 2>/dev/null || true)

# Kill npm run bot workspaces
while read -r pid; do
  [ -n "$pid" ] || continue
  cmd=$(ps -p "$pid" -o command= 2>/dev/null || true)
  case "$cmd" in
    *npm\ run\ bot*|*@order-tracker/bot*)
      echo "  kill npm $pid"
      kill "$pid" 2>/dev/null || true
      ;;
  esac
done < <(pgrep -f "npm run bot" 2>/dev/null || true)

sleep 2
# force leftover index.js under order-tracker
while read -r pid; do
  [ -n "$pid" ] || continue
  cmd=$(ps -p "$pid" -o command= 2>/dev/null || true)
  case "$cmd" in
    *apps/bot/src/index.js*)
      kill -9 "$pid" 2>/dev/null || true
      ;;
  esac
done < <(pgrep -x node 2>/dev/null || true)

sleep 1
echo "→ Đợi Telegram nhả getUpdates (5s)…"
sleep 5

if [ ! -f .env ] || ! grep -q '^TELEGRAM_BOT_TOKEN=.\+' .env; then
  echo "❌ Thiếu TELEGRAM_BOT_TOKEN trong .env"
  exit 1
fi

echo "→ Khởi động bot nền → bot.log"
: > bot.log
nohup node apps/bot/src/index.js >> bot.log 2>&1 &
echo $! > bot.pid
echo "  PID=$(cat bot.pid)"
sleep 6
echo "→ Log:"
cat bot.log
if grep -q 'đang chạy long-polling' bot.log 2>/dev/null; then
  echo "✅ Bot OK. Thử Telegram /start"
elif grep -q 'Không khởi động được' bot.log 2>/dev/null; then
  echo "❌ Bot fail — xem bot.log"
  exit 1
else
  echo "⏳ Chưa thấy dòng ✅ — xem: tail -f bot.log"
  echo "   (Nếu còn 409: đợi 15s rồi chạy lại script này)"
fi
