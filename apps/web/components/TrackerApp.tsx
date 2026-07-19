"use client";

import { useCallback, useEffect, useState } from "react";
import type { HistoryItem, TrackingResult } from "@/lib/types";
import {
  clearHistory,
  loadHistory,
  removeHistoryItem,
  saveHistoryItem,
} from "@/lib/history";
import { TrackForm } from "./TrackForm";
import { StatusCard } from "./StatusCard";
import { Timeline } from "./Timeline";
import { RecentHistory } from "./RecentHistory";
import { TelegramCta } from "./TelegramCta";

const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || "";

export function TrackerApp() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TrackingResult | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  const track = useCallback(async (raw: string) => {
    const q = raw.trim();
    if (!q) return;

    setLoading(true);
    setErrorBanner(null);
    setResult(null);

    try {
      const res = await fetch("/api/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q }),
      });
      const data = (await res.json()) as TrackingResult & { error?: string };

      setResult(data);

      if (data.trackingNumber) {
        const next = saveHistoryItem({
          trackingNumber: data.trackingNumber,
          carrierName: data.carrierName,
          currentStatus: data.currentStatus,
          lookedAt: new Date().toISOString(),
        });
        setHistory(next);
        setQuery(data.trackingNumber);
      }
    } catch {
      setErrorBanner("Không kết nối được máy chủ. Thử lại sau.");
    } finally {
      setLoading(false);
    }
  }, []);

  const onSubmit = () => track(query);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 pb-16 pt-10 sm:px-6 sm:pt-14">
      {/* Header */}
      <header className="text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600 text-2xl shadow-soft">
          📦
        </div>
        <h1 className="text-balance text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          Order Tracker
        </h1>
        <p className="mx-auto mt-3 max-w-md text-balance text-sm leading-relaxed text-slate-600 sm:text-base">
          Theo dõi đơn Shopee / SPX chỉ bằng mã vận đơn — không cần mở app.
        </p>
      </header>

      {/* Search */}
      <section className="rounded-3xl border border-white/60 bg-white/80 p-4 shadow-soft backdrop-blur sm:p-6">
        <TrackForm
          value={query}
          loading={loading}
          onChange={setQuery}
          onSubmit={onSubmit}
        />
      </section>

      {errorBanner ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {errorBanner}
        </div>
      ) : null}

      {/* Result */}
      {result ? (
        <section className="flex flex-col gap-5">
          <StatusCard result={result} />
          {result.ok ? (
            <Timeline
              events={result.events || []}
              currentStatus={result.currentStatus}
            />
          ) : null}
          <TelegramCta
            trackingNumber={result.trackingNumber}
            botUsername={botUsername}
          />
        </section>
      ) : (
        <TelegramCta botUsername={botUsername} />
      )}

      {/* History */}
      <RecentHistory
        items={history}
        onSelect={(code) => {
          setQuery(code);
          track(code);
        }}
        onRemove={(code) => setHistory(removeHistoryItem(code))}
        onClear={() => {
          clearHistory();
          setHistory([]);
        }}
      />

      <footer className="border-t border-slate-200/80 pt-6 text-center text-xs text-slate-400">
        Free · Next.js + SPX public API · Lịch sử lưu trên trình duyệt của bạn
      </footer>
    </div>
  );
}
