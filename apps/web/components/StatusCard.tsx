"use client";

import type { TrackingResult } from "@/lib/types";
import { getStatusTone, toneClasses } from "@/lib/status-styles";

type Props = {
  result: TrackingResult;
};

export function StatusCard({ result }: Props) {
  const tone = getStatusTone(result.currentStatus);
  const c = toneClasses(tone);

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
