import { NextRequest, NextResponse } from "next/server";
import {
  trackPackage,
  extractFirstTrackingNumber,
  detectCarrier,
} from "@order-tracker/shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/track?q=SPXVN...  hoặc  /api/track?q=<link>
 * POST { "q": "..." }
 */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") || "";
  const phone =
    req.nextUrl.searchParams.get("phone") ||
    req.nextUrl.searchParams.get("cellphone") ||
    "";
  return handleTrack(q, phone);
}

export async function POST(req: NextRequest) {
  let q = "";
  let phone = "";
  try {
    const body = await req.json();
    q = String(body?.q || body?.tracking || body?.code || "");
    phone = String(body?.phone || body?.cellphone || body?.phoneLast4 || "");
  } catch {
    q = "";
  }
  return handleTrack(q, phone);
}

async function handleTrack(raw: string, phoneLast4?: string | null) {
  const input = String(raw || "").trim();
  if (!input) {
    return NextResponse.json(
      { ok: false, error: "Vui lòng nhập mã vận đơn hoặc dán link đơn hàng." },
      { status: 400 }
    );
  }

  // J&T: cho phép "MÃ 1234" / "MÃ|1234" (4 số cuối SĐT)
  let phone = phoneLast4 ? String(phoneLast4).replace(/\D/g, "").slice(-4) : "";
  const withPhone = input.match(/^(.+?)[|\s,]+(\d{4})\s*$/);
  let queryForExtract = input;
  if (withPhone) {
    queryForExtract = withPhone[1].trim();
    if (!phone) phone = withPhone[2];
  }

  const code =
    extractFirstTrackingNumber(queryForExtract) ||
    queryForExtract.replace(/\s+/g, "").toUpperCase();

  if (code.length < 8) {
    return NextResponse.json(
      {
        ok: false,
        error: "Mã vận đơn không hợp lệ (quá ngắn). Kiểm tra lại mã hoặc link.",
        trackingNumber: code,
      },
      { status: 400 }
    );
  }

  try {
    // phoneLast4: J&T (cũng hỗ trợ chuỗi "MÃ|1234")
    const result = await trackPackage(phone ? `${code}|${phone}` : code, {
      phoneLast4: phone || undefined,
    } as { carrierId?: string; phoneLast4?: string });

    // Không trả raw (nặng + không cần UI)
    const { raw: _raw, ...safe } = result as typeof result & { raw?: unknown };
    const detected = detectCarrier(code);

    return NextResponse.json({
      ...safe,
      carrier: safe.carrier || detected.id,
      carrierName: safe.carrierName || detected.name,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Lỗi máy chủ";
    return NextResponse.json(
      {
        ok: false,
        trackingNumber: code,
        carrier: "unknown",
        carrierName: "Chưa xác định",
        currentStatus: null,
        currentStatusRaw: null,
        estimatedDelivery: null,
        events: [],
        error: message,
      },
      { status: 500 }
    );
  }
}
