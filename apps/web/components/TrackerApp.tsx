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

/** Gắn tên SP do user nhập vào kết quả API (ưu tiên API nếu đã có). */
function mergeProductName(
  data: TrackingResult,
  productName: string
): TrackingResult {
  const name = productName.trim();
  if (!name) return data;
  if (data.orderDetails?.productName) return data;
  return {
    ...data,
    orderDetails: {
      ...(data.orderDetails || {}),
      productName: name,
      items: data.orderDetails?.items || [],
    },
  };
}

export function TrackerApp() {
  const [query, setQuery] = useState("");
  const [productName, setProductName] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TrackingResult | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  const track = useCallback(
    async (raw: string, productOverride?: string) => {
      const q = raw.trim();
      if (!q) return;

      const product =
        productOverride !== undefined ? productOverride : productName;

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
        const merged = mergeProductName(data, product);

        setResult(merged);

        if (merged.trackingNumber) {
          const next = saveHistoryItem({
            trackingNumber: merged.trackingNumber,
            carrierName: merged.carrierName,
            currentStatus: merged.currentStatus,
            productName:
              merged.orderDetails?.productName || product.trim() || null,
            lookedAt: new Date().toISOString(),
          });
          setHistory(next);
          setQuery(merged.trackingNumber);
          if (merged.orderDetails?.productName) {
            setProductName(merged.orderDetails.productName);
          }
        }
      } catch {
        setErrorBanner("Không kết nối được máy chủ. Thử lại sau.");
      } finally {
        setLoading(false);
      }
    },
    [productName]
  );

  const onSubmit = () => track(query);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 pb-16 pt-10 sm:px-6 sm:pt-14">
      <header className="text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600 text-2xl shadow-soft">
          📦
        </div>
        <h1 className="text-balance text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          Order Tracker
        </h1>
        <p className="mx-auto mt-3 max-w-md text-balance text-sm leading-relaxed text-slate-600 sm:text-base">
          Theo dõi SPX, GHN, J&amp;T chỉ bằng mã vận đơn — không cần mở app.
        </p>
      </header>

      <section className="rounded-3xl border border-white/60 bg-white/80 p-4 shadow-soft backdrop-blur sm:p-6">
        <TrackForm
          value={query}
          productName={productName}
          loading={loading}
          onChange={setQuery}
          onProductNameChange={setProductName}
          onSubmit={onSubmit}
        />
      </section>

      {errorBanner ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {errorBanner}
        </div>
      ) : null}

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

      <RecentHistory
        items={history}
        onSelect={(code) => {
          const item = history.find((h) => h.trackingNumber === code);
          setQuery(code);
          if (item?.productName) setProductName(item.productName);
          track(code, item?.productName || "");
        }}
        onRemove={(code) => setHistory(removeHistoryItem(code))}
        onClear={() => {
          clearHistory();
          setHistory([]);
        }}
      />

      <footer className="border-t border-slate-200/80 pt-6 text-center text-xs text-slate-400">
        Free · SPX / GHN / J&amp;T · Tên SP do bạn ghi (Shopee không public API)
      </footer>
    </div>
  );
}
