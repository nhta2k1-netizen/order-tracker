"use client";

import type { HistoryItem } from "@/lib/types";
import { getStatusTone, toneClasses } from "@/lib/status-styles";

type Props = {
  items: HistoryItem[];
  onSelect: (code: string) => void;
  onRemove: (code: string) => void;
  onClear: () => void;
};

export function RecentHistory({ items, onSelect, onRemove, onClear }: Props) {
  if (!items.length) return null;

  return (
    <section className="w-full">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-700">
          🕐 Tra cứu gần đây
        </h2>
        <button
          type="button"
          onClick={onClear}
          className="text-xs font-medium text-slate-400 transition hover:text-rose-600"
        >
          Xóa hết
        </button>
      </div>
      <ul className="flex flex-col gap-2">
        {items.map((item) => {
          const tone = getStatusTone(item.currentStatus);
          const c = toneClasses(tone);
          return (
            <li key={item.trackingNumber}>
              <div className="group flex items-center gap-2 rounded-2xl border border-slate-200/80 bg-white px-3 py-2.5 shadow-sm transition hover:border-brand-200">
                <button
                  type="button"
                  onClick={() => onSelect(item.trackingNumber)}
                  className="min-w-0 flex-1 text-left"
                >
                  <p className="truncate font-mono text-sm font-semibold text-slate-800">
                    {item.trackingNumber}
                  </p>
                  {item.productName ? (
                    <p className="mt-0.5 truncate text-xs font-medium text-slate-700">
                      🛍 {item.productName}
                    </p>
                  ) : null}
                  <p className="mt-0.5 truncate text-xs text-slate-500">
                    {item.carrierName || "—"}
                    {item.currentStatus ? (
                      <span
                        className={`ml-2 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${c.badge}`}
                      >
                        {item.currentStatus}
                      </span>
                    ) : null}
                  </p>
                </button>
                <button
                  type="button"
                  aria-label="Xóa khỏi lịch sử"
                  onClick={() => onRemove(item.trackingNumber)}
                  className="rounded-lg p-2 text-slate-300 opacity-100 transition hover:bg-slate-50 hover:text-rose-500 sm:opacity-0 sm:group-hover:opacity-100"
                >
                  ×
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
