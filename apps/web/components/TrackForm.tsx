"use client";

type Props = {
  value: string;
  loading: boolean;
  onChange: (v: string) => void;
  onSubmit: () => void;
};

export function TrackForm({ value, loading, onChange, onSubmit }: Props) {
  return (
    <form
      className="w-full"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <label htmlFor="tracking-input" className="sr-only">
        Mã vận đơn
      </label>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
        <div className="relative flex-1">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400">
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.8}
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-4.35-4.35M11 18a7 7 0 100-14 7 7 0 000 14z"
              />
            </svg>
          </div>
          <input
            id="tracking-input"
            type="text"
            inputMode="text"
            autoComplete="off"
            spellCheck={false}
            placeholder="Nhập mã vận đơn hoặc dán link đơn hàng…"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full rounded-2xl border border-slate-200 bg-white py-4 pl-12 pr-4 text-base text-slate-900 shadow-soft outline-none transition placeholder:text-slate-400 focus:border-brand-400 focus:shadow-glow sm:text-lg"
            disabled={loading}
          />
        </div>
        <button
          type="submit"
          disabled={loading || !value.trim()}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-brand-600 px-8 py-4 text-base font-semibold text-white shadow-soft transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50 sm:min-w-[160px]"
        >
          {loading ? (
            <>
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              Đang tra…
            </>
          ) : (
            <>Theo dõi</>
          )}
        </button>
      </div>
      <p className="mt-3 text-center text-sm text-slate-500 sm:text-left">
        Hỗ trợ tốt nhất:{" "}
        <span className="font-medium text-slate-700">Shopee Express (SPXVN…)</span>
        . Có thể dán cả link tracking.
      </p>
    </form>
  );
}
