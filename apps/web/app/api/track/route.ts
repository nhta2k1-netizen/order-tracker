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
  return handleTrack(q);
}

export async function POST(req: NextRequest) {
  let q = "";
  try {
    const body = await req.json();
    q = String(body?.q || body?.tracking || body?.code || "");
  } catch {
    q = "";
  }
  return handleTrack(q);
}

async function handleTrack(raw: string) {
  const input = String(raw || "").trim();
  if (!input) {
    return NextResponse.json(
      { ok: false, error: "Vui lòng nhập mã vận đơn hoặc dán link đơn hàng." },
      { status: 400 }
    );
  }

  const code =
    extractFirstTrackingNumber(input) ||
    input.replace(/\s+/g, "").toUpperCase();

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
    const result = await trackPackage(code);
    // Không trả raw SPX (nặng + không cần UI)
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
