"use client";

import type { OrderDetails, TrackingResult } from "@/lib/types";
import { getStatusTone, toneClasses } from "@/lib/status-styles";

type Props = {
  result: TrackingResult;
};

function hasDetails(d?: OrderDetails | null) {
  if (!d) return false;
  return Boolean(
    d.productName ||
      d.clientOrderCode ||
      d.recipientName ||
      d.recipientPhone ||
      d.recipientAddress ||
      d.senderName ||
      d.senderAddress ||
      (d.items && d.items.length) ||
      d.codAmount ||
      d.note
  );
}

export function StatusCard({ result }: Props) {
  const tone = getStatusTone(result.currentStatus);
  const c = toneClasses(tone);
  const d = result.orderDetails;

  if (!result.ok) {
    return (
      <div className="rounded-3xl border border-rose-200 bg-gradient-to-br from-rose-50 to-white p-6 shadow-soft sm:p-8">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-rose-100 text-xl">
            ❌
          </span>
          <div>
            <h2 className="text-lg font-semibold text-rose-900">
              Không tra cứu được
            </h2>
            {result.trackingNumber ? (
              <p className="mt-1 font-mono text-sm text-rose-800/80">
                {result.trackingNumber}
              </p>
            ) : null}
            <p className="mt-3 text-sm leading-relaxed text-rose-800">
              {result.error || "Lỗi không xác định. Thử lại sau."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`rounded-3xl border border-slate-200/80 bg-gradient-to-br ${c.soft} p-6 shadow-soft sm:p-8`}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">Mã vận đơn</p>
          <p className="mt-1 break-all font-mono text-lg font-semibold tracking-wide text-slate-900 sm:text-xl">
            {result.trackingNumber}
          </p>
          <p className="mt-2 text-sm text-slate-600">
            Đơn vị vận chuyển:{" "}
            <span className="font-semibold text-slate-800">
              {result.carrierName || result.carrier}
            </span>
          </p>
        </div>
        <span
          className={`inline-flex items-center rounded-full px-4 py-1.5 text-sm font-semibold ring-1 ring-inset ${c.badge}`}
        >
          {result.currentStatus || "—"}
        </span>
      </div>

      {result.estimatedDelivery ? (
        <p className="mt-4 text-sm text-slate-600">
          📅 Dự kiến giao:{" "}
          <span className="font-medium text-slate-800">
            {result.estimatedDelivery}
          </span>
        </p>
      ) : null}

      {hasDetails(d) ? (
        <div className="mt-5 rounded-2xl bg-white/80 p-4 ring-1 ring-slate-100">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Thông tin đơn hàng
          </p>
          <dl className="mt-3 space-y-2.5 text-sm">
            {d?.productName ? (
              <DetailRow label="🛍 Sản phẩm" value={d.productName} />
            ) : null}
            {d?.items && d.items.length > 1 ? (
              <div>
                <dt className="text-xs font-medium text-slate-400">
                  Chi tiết SP
                </dt>
                <dd className="mt-1 space-y-1 text-slate-800">
                  {d.items.map((it, i) => (
                    <p key={i}>
                      • {it.name}
                      {it.quantity != null ? ` ×${it.quantity}` : ""}
                      {it.weight ? ` (${it.weight})` : ""}
                    </p>
                  ))}
                </dd>
              </div>
            ) : null}
            {d?.clientOrderCode ? (
              <DetailRow label="🧾 Mã đơn shop" value={d.clientOrderCode} mono />
            ) : null}
            {d?.recipientName ? (
              <DetailRow label="👤 Người nhận" value={d.recipientName} />
            ) : null}
            {d?.recipientPhone ? (
              <DetailRow label="📞 SĐT nhận" value={d.recipientPhone} />
            ) : null}
            {d?.recipientAddress ? (
              <DetailRow label="📍 Địa chỉ nhận" value={d.recipientAddress} />
            ) : null}
            {d?.senderName ? (
              <DetailRow label="📤 Người gửi" value={d.senderName} />
            ) : null}
            {d?.senderAddress ? (
              <DetailRow label="🏠 Địa chỉ gửi" value={d.senderAddress} />
            ) : null}
            {d?.codAmount ? (
              <DetailRow label="💰 COD" value={d.codAmount} />
            ) : null}
            {d?.note ? <DetailRow label="📝 Ghi chú" value={d.note} /> : null}
          </dl>
          <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
            Một số thông tin có thể bị che (xxxx) theo chính sách bảo mật của
            hãng vận chuyển. Tên sản phẩm chỉ hiện khi API public có dữ liệu.
          </p>
        </div>
      ) : null}

      {result.events?.[0]?.message ? (
        <div className="mt-5 rounded-2xl bg-white/70 p-4 ring-1 ring-slate-100">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Cập nhật mới nhất
          </p>
          <p className="mt-1 text-sm leading-relaxed text-slate-800">
            {result.events[0].message}
          </p>
        </div>
      ) : null}
    </div>
  );
}

function DetailRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs font-medium text-slate-400">{label}</dt>
      <dd
        className={`mt-0.5 leading-relaxed text-slate-800 ${
          mono ? "font-mono text-[13px]" : ""
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
