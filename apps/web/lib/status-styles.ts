export type StatusTone =
  | "success"
  | "shipping"
  | "pickup"
  | "warning"
  | "danger"
  | "neutral";

export function getStatusTone(status: string | null | undefined): StatusTone {
  const s = (status || "").toLowerCase();
  if (
    s.includes("đã giao") ||
    s.includes("delivered") ||
    s.includes("thành công")
  ) {
    return "success";
  }
  if (
    s.includes("đang giao") ||
    s.includes("delivering") ||
    s.includes("out_for") ||
    s.includes("out for")
  ) {
    return "shipping";
  }
  if (
    s.includes("vận chuyển") ||
    s.includes("trung chuyển") ||
    s.includes("transit") ||
    s.includes("transport") ||
    s.includes("bưu cục") ||
    s.includes("phân tuyến")
  ) {
    return "shipping";
  }
  if (s.includes("lấy hàng") || s.includes("pickup") || s.includes("đã tạo")) {
    return "pickup";
  }
  if (
    s.includes("hoàn") ||
    s.includes("return") ||
    s.includes("tạm giữ") ||
    s.includes("hold")
  ) {
    return "warning";
  }
  if (
    s.includes("hủy") ||
    s.includes("cancel") ||
    s.includes("thất bại") ||
    s.includes("không thành công") ||
    s.includes("fail") ||
    s.includes("sự cố")
  ) {
    return "danger";
  }
  return "neutral";
}

export function toneClasses(tone: StatusTone) {
  switch (tone) {
    case "success":
      return {
        badge: "bg-emerald-50 text-emerald-800 ring-emerald-200",
        bar: "bg-emerald-500",
        dot: "bg-emerald-500",
        soft: "from-emerald-50 to-white",
      };
    case "shipping":
      return {
        badge: "bg-sky-50 text-sky-800 ring-sky-200",
        bar: "bg-sky-500",
        dot: "bg-sky-500",
        soft: "from-sky-50 to-white",
      };
    case "pickup":
      return {
        badge: "bg-amber-50 text-amber-900 ring-amber-200",
        bar: "bg-amber-500",
        dot: "bg-amber-500",
        soft: "from-amber-50 to-white",
      };
    case "warning":
      return {
        badge: "bg-orange-50 text-orange-900 ring-orange-200",
        bar: "bg-orange-500",
        dot: "bg-orange-500",
        soft: "from-orange-50 to-white",
      };
    case "danger":
      return {
        badge: "bg-rose-50 text-rose-800 ring-rose-200",
        bar: "bg-rose-500",
        dot: "bg-rose-500",
        soft: "from-rose-50 to-white",
      };
    default:
      return {
        badge: "bg-slate-100 text-slate-700 ring-slate-200",
        bar: "bg-slate-400",
        dot: "bg-slate-400",
        soft: "from-slate-50 to-white",
      };
  }
}

export function formatTimeVi(ts?: string | null) {
  if (!ts) return "—";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
