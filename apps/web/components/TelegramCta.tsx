"use client";

type Props = {
  trackingNumber?: string | null;
  botUsername?: string;
};

export function TelegramCta({ trackingNumber, botUsername }: Props) {
  const user = (botUsername || "").replace(/^@/, "").trim();
  const hasBot = Boolean(user);

  const deepLink = hasBot
    ? trackingNumber
      ? `https://t.me/${user}?start=${encodeURIComponent(trackingNumber)}`
      : `https://t.me/${user}`
    : null;

  return (
    <div className="rounded-3xl border border-[#229ED9]/20 bg-gradient-to-br from-[#e8f6fc] to-white p-6 shadow-soft sm:p-7">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#229ED9] text-xl text-white shadow-sm">
            ✈
          </span>
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              Nhận thông báo Telegram
            </h3>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">
              Bot tự theo dõi và nhắn khi trạng thái đổi — không cần mở app
              Shopee. Miễn phí.
            </p>
            {!hasBot ? (
              <p className="mt-2 text-xs text-amber-700">
                Chưa cấu hình{" "}
                <code className="rounded bg-amber-50 px-1">
                  NEXT_PUBLIC_TELEGRAM_BOT_USERNAME
                </code>
                . Vẫn có thể mở Telegram và search bot của bạn.
              </p>
            ) : null}
          </div>
        </div>

        {deepLink ? (
          <a
            href={deepLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-[#229ED9] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1b8bc0]"
          >
            Mở Telegram
            {trackingNumber ? " & theo dõi" : ""}
          </a>
        ) : (
          <a
            href="https://t.me/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-[#229ED9] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1b8bc0]"
          >
            Mở Telegram
          </a>
        )}
      </div>
    </div>
  );
}
