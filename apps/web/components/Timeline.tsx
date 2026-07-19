"use client";

import type { TrackingEvent } from "@/lib/types";
import { formatTimeVi, getStatusTone, toneClasses } from "@/lib/status-styles";

type Props = {
  events: TrackingEvent[];
  currentStatus?: string | null;
};

export function Timeline({ events, currentStatus }: Props) {
  if (!events?.length) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-200 bg-white/60 p-8 text-center text-sm text-slate-500">
        Chưa có lịch sử vận chuyển.
      </div>
    );
  }

  const tone = getStatusTone(currentStatus || events[0]?.status);
  const head = toneClasses(tone);

  return (
    <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-soft sm:p-8">
      <h3 className="text-base font-semibold text-slate-900 sm:text-lg">
        📜 Lịch sử vận chuyển
      </h3>
      <p className="mt-1 text-sm text-slate-500">Mới nhất → cũ nhất</p>

      <ol className="relative mt-6 space-y-0 border-l-2 border-slate-100 pl-6">
        {events.map((ev, i) => {
          const isFirst = i === 0;
          const t = getStatusTone(ev.status || currentStatus);
          const c = toneClasses(t);
          return (
            <li key={`${ev.timestamp}-${i}`} className="relative pb-8 last:pb-0">
              <span
                className={`absolute -left-[1.9rem] top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full ring-4 ring-white ${
                  isFirst ? head.dot : c.dot
                } ${isFirst ? "scale-125" : "opacity-70"}`}
              />
              <time className="text-xs font-medium text-slate-400">
                {formatTimeVi(ev.timestamp)}
              </time>
              {ev.status ? (
                <p
                  className={`mt-1 text-sm font-semibold ${
                    isFirst ? "text-slate-900" : "text-slate-700"
                  }`}
                >
                  {ev.status}
                </p>
              ) : null}
              {ev.message ? (
                <p className="mt-1 text-sm leading-relaxed text-slate-600">
                  {ev.message}
                </p>
              ) : null}
              {ev.location ? (
                <p className="mt-1 text-xs text-slate-400">📍 {ev.location}</p>
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
