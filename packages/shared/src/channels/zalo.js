/**
 * Zalo Official Account OpenAPI — gói Cơ bản / test (0đ).
 *
 * Giới hạn quan trọng (miễn phí):
 * - Tin "tư vấn" (CS) chỉ gửi được trong ~48h sau khi user nhắn OA.
 * - Gửi ngoài 48h cần ZNS / gói trả phí → không dùng ở phase test free.
 *
 * Docs: https://developers.zalo.me/
 */

const TOKEN_URL = "https://oauth.zaloapp.com/v4/oa/access_token";
const MSG_URL_V3 = "https://openapi.zalo.me/v3.0/oa/message/cs";
const MSG_URL_V2 = "https://openapi.zalo.me/v2.0/oa/message";

/** @type {{ accessToken: string|null, refreshToken: string|null, expiresAt: number }} */
let tokenState = {
  accessToken: null,
  refreshToken: null,
  expiresAt: 0,
};

/**
 * Nạp token từ env / bộ nhớ (gọi lúc app start).
 * @param {{ accessToken?: string, refreshToken?: string, expiresAt?: number }} opts
 */
export function loadZaloTokens(opts = {}) {
  if (opts.accessToken) tokenState.accessToken = opts.accessToken;
  if (opts.refreshToken) tokenState.refreshToken = opts.refreshToken;
  if (opts.expiresAt) tokenState.expiresAt = opts.expiresAt;

  if (!tokenState.accessToken && process.env.ZALO_ACCESS_TOKEN) {
    tokenState.accessToken = process.env.ZALO_ACCESS_TOKEN;
  }
  if (!tokenState.refreshToken && process.env.ZALO_REFRESH_TOKEN) {
    tokenState.refreshToken = process.env.ZALO_REFRESH_TOKEN;
  }
  // access_token env thường ~1h — coi như hết hạn sau 50 phút nếu không biết
  if (tokenState.accessToken && !tokenState.expiresAt) {
    tokenState.expiresAt = Date.now() + 50 * 60 * 1000;
  }
}

export function getZaloTokenState() {
  return { ...tokenState };
}

export function isZaloConfigured() {
  const appId = process.env.ZALO_APP_ID;
  const secret = process.env.ZALO_APP_SECRET;
  loadZaloTokens();
  return Boolean(
    appId &&
      secret &&
      (tokenState.accessToken || tokenState.refreshToken)
  );
}

/**
 * Làm mới access_token bằng refresh_token.
 * Refresh token dùng 1 lần → phải lưu token mới trả về.
 * @returns {Promise<{ accessToken: string, refreshToken: string, expiresIn: number }>}
 */
export async function refreshZaloAccessToken() {
  const appId = process.env.ZALO_APP_ID;
  const secret = process.env.ZALO_APP_SECRET;
  loadZaloTokens();
  const refresh = tokenState.refreshToken || process.env.ZALO_REFRESH_TOKEN;

  if (!appId || !secret || !refresh) {
    throw new Error(
      "Thiếu ZALO_APP_ID / ZALO_APP_SECRET / ZALO_REFRESH_TOKEN"
    );
  }

  const body = new URLSearchParams({
    refresh_token: refresh,
    app_id: appId,
    grant_type: "refresh_token",
  });

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      secret_key: secret,
    },
    body,
  });

  const data = await res.json();
  if (!data.access_token) {
    throw new Error(
      `Zalo refresh token lỗi: ${data.error_name || data.error || JSON.stringify(data)}`
    );
  }

  tokenState.accessToken = data.access_token;
  tokenState.refreshToken = data.refresh_token || refresh;
  const expiresIn = Number(data.expires_in || 3600);
  tokenState.expiresAt = Date.now() + (expiresIn - 120) * 1000; // trừ 2 phút buffer

  return {
    accessToken: tokenState.accessToken,
    refreshToken: tokenState.refreshToken,
    expiresIn,
  };
}

/**
 * Đổi authorization_code → access + refresh (lần đầu).
 * @param {string} code
 * @param {string} [codeVerifier] PKCE nếu app bật
 */
export async function exchangeZaloAuthCode(code, codeVerifier) {
  const appId = process.env.ZALO_APP_ID;
  const secret = process.env.ZALO_APP_SECRET;
  if (!appId || !secret || !code) {
    throw new Error("Thiếu app_id/secret/code");
  }

  const params = {
    code: String(code),
    app_id: appId,
    grant_type: "authorization_code",
  };
  if (codeVerifier) params.code_verifier = codeVerifier;

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      secret_key: secret,
    },
    body: new URLSearchParams(params),
  });

  const data = await res.json();
  if (!data.access_token) {
    throw new Error(
      `Zalo exchange code lỗi: ${data.error_name || data.error || JSON.stringify(data)}`
    );
  }

  tokenState.accessToken = data.access_token;
  tokenState.refreshToken = data.refresh_token || null;
  const expiresIn = Number(data.expires_in || 3600);
  tokenState.expiresAt = Date.now() + (expiresIn - 120) * 1000;

  return {
    accessToken: tokenState.accessToken,
    refreshToken: tokenState.refreshToken,
    expiresIn,
  };
}

/**
 * Lấy access_token còn hạn (tự refresh nếu cần).
 */
export async function getValidAccessToken() {
  loadZaloTokens();
  if (
    tokenState.accessToken &&
    tokenState.expiresAt > Date.now() + 30_000
  ) {
    return tokenState.accessToken;
  }
  if (tokenState.refreshToken || process.env.ZALO_REFRESH_TOKEN) {
    const t = await refreshZaloAccessToken();
    return t.accessToken;
  }
  if (tokenState.accessToken) return tokenState.accessToken;
  throw new Error("Chưa có Zalo access_token — xem HUONG-DAN-ZALO.md");
}

/**
 * Gửi tin nhắn tư vấn (CS) text — free trong khung 48h sau khi user chat OA.
 * @param {string} userId Zalo user_id (từ webhook)
 * @param {string} text tối đa ~2000 ký tự
 */
export async function sendZaloText(userId, text) {
  if (!userId) throw new Error("Thiếu zalo user_id");
  const message = String(text || "").slice(0, 2000);
  const accessToken = await getValidAccessToken();

  // Ưu tiên API v3 CS
  let result = await postMessage(MSG_URL_V3, accessToken, {
    recipient: { user_id: String(userId) },
    message: { text: message },
  });

  // Fallback v2 nếu v3 không hỗ trợ gói / endpoint
  if (!result.ok && shouldFallbackV2(result)) {
    result = await postMessage(MSG_URL_V2, accessToken, {
      recipient: { user_id: String(userId) },
      message: { text: message },
    });
  }

  return result;
}

function shouldFallbackV2(result) {
  const e = String(result.error || result.errorCode || "");
  return (
    result.httpStatus === 404 ||
    e.includes("-224") ||
    e.includes("not found") ||
    e.includes("Method")
  );
}

async function postMessage(url, accessToken, payload) {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        access_token: accessToken,
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    // Zalo: error = 0 là thành công
    const errCode = data.error ?? data.err ?? null;
    const ok = res.ok && (errCode === 0 || errCode === "0" || errCode == null);
    // Một số response success không có error field nhưng có data.message_id
    const success =
      ok ||
      Boolean(data.data?.message_id) ||
      Boolean(data.message_id);

    if (success && (errCode === 0 || errCode === "0" || data.data?.message_id)) {
      return {
        ok: true,
        messageId: data.data?.message_id || data.message_id || null,
        raw: data,
      };
    }

    // error -230 / ngoài 48h
    return {
      ok: false,
      errorCode: errCode,
      error: data.message || data.error_name || `HTTP ${res.status}`,
      httpStatus: res.status,
      raw: data,
      outsideWindow: isOutside48hError(errCode, data.message),
    };
  } catch (err) {
    return { ok: false, error: err.message, outsideWindow: false };
  }
}

function isOutside48hError(code, message) {
  const c = String(code ?? "");
  const m = String(message || "").toLowerCase();
  return (
    c === "-230" ||
    c === "-232" ||
    m.includes("48") ||
    m.includes("hết thời gian") ||
    m.includes("outside")
  );
}

/**
 * Parse webhook Zalo → sự kiện chuẩn hoá.
 * @param {any} body
 * @returns {{ type: string, userId?: string, text?: string, raw: any }[]}
 */
export function parseZaloWebhook(body) {
  if (!body || typeof body !== "object") return [];

  const events = [];
  // Một số payload bọc trong event_name + message
  const eventName = body.event_name || body.event || body.event_type;

  if (
    eventName === "user_send_text" ||
    body.message?.text ||
    body.message?.msg_id
  ) {
    const userId =
      body.sender?.id ||
      body.user_id_by_app ||
      body.recipient?.id ||
      body.sender?.user_id;
    const text =
      body.message?.text ||
      body.message?.message ||
      body.text ||
      "";
    if (userId) {
      events.push({
        type: "user_send_text",
        userId: String(userId),
        text: String(text),
        raw: body,
      });
    }
  }

  // Batch / array
  if (Array.isArray(body)) {
    for (const item of body) {
      events.push(...parseZaloWebhook(item));
    }
  }

  return events;
}

/**
 * Còn trong khung 48h chat không? (theo last_user_message_at)
 * @param {string|Date|number|null} lastUserMessageAt
 * @param {number} [windowHours=48]
 */
export function isWithinReplyWindow(lastUserMessageAt, windowHours = 48) {
  if (!lastUserMessageAt) return false;
  const t =
    typeof lastUserMessageAt === "number"
      ? lastUserMessageAt
      : Date.parse(String(lastUserMessageAt).includes("T")
          ? String(lastUserMessageAt)
          : String(lastUserMessageAt).replace(" ", "T") + "Z");
  if (Number.isNaN(t)) return false;
  return Date.now() - t < windowHours * 60 * 60 * 1000;
}
