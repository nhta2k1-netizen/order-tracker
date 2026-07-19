/**
 * Shopee Express (SPX) VN — gọi API tracking công khai.
 * Logic ký request kế thừa từ spx-tracker.
 */
import crypto from "crypto";
import { buildOrderDetails } from "../utils/order-details.js";

const SPX_API = "https://spx.vn/api/v2/fleet_order/tracking/search";
const SPX_SECRET = "0ebfffe63d2a481cf57fe7d5ebdc9fd6";

const STATUS_VI = {
  Created: "Đã tạo đơn",
  ORDER_CREATED: "Đã tạo đơn",
  Pickup_Pending: "Chờ lấy hàng",
  Pending_Receive: "Đã lấy hàng",
  Picked_Up: "Đã lấy hàng",
  Pickuped: "Đã lấy hàng",
  FMHub_Pickup_Done: "Đơn vị vận chuyển đã lấy hàng",
  FMHub_Received: "Đã chuyển tới bưu cục lấy",
  FMHub_LHTransporting: "Đang trung chuyển",
  FMHub_LHLoaded: "Đã xếp hàng trung chuyển",
  FMHub_LHLoading: "Đang xếp hàng trung chuyển",
  SOC_Received: "Đã tới trung tâm khai thác",
  SOC_LHUnloading: "Đang dỡ hàng tại trung tâm khai thác",
  SOC_LHUnloaded: "Đã dỡ hàng tại trung tâm khai thác",
  SOC_LHTransporting: "Đang vận chuyển tới bưu cục phát",
  SOC_LHLoaded: "Đã xếp hàng rời trung tâm",
  SOC_LHLoading: "Đang xếp hàng rời trung tâm",
  LMHub_LHUnloading: "Đang dỡ hàng tại bưu cục phát",
  LMHub_LHUnloaded: "Đã dỡ hàng tại bưu cục phát",
  LMHub_Received: "Đã tới bưu cục phát",
  LMHub_Assigned: "Đã phân công giao hàng",
  Pending: "Đang phân tuyến",
  Assigned: "Đơn vị vận chuyển",
  Sorting: "Đang phân tuyến",
  In_Transit: "Đang trung chuyển",
  Transporting: "Đang vận chuyển",
  Delivering: "Đang giao hàng",
  Out_for_Delivery: "Đang giao hàng",
  Delivered: "Đã giao thành công",
  Delivery_Failed: "Giao không thành công",
  On_Hold: "Tạm giữ",
  Exception: "Sự cố vận chuyển",
  Returning: "Đang hoàn hàng",
  Returned: "Đã hoàn hàng",
  Cancelled: "Đã hủy",
  Canceled: "Đã hủy",
};

function buildSignedTrackingNumber(trackingNumber) {
  const tracking = String(trackingNumber).trim().toUpperCase();
  const ts = String(Math.floor(Date.now() / 1000));
  const secretB64 = Buffer.from(SPX_SECRET, "utf8").toString("base64");
  const sig = crypto
    .createHash("sha256")
    .update(tracking + ts + secretB64)
    .digest("hex");
  return `${tracking}|${ts}${sig}`;
}

function hasVietnamese(text) {
  return /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(
    String(text || "")
  );
}

export function translateStatus(status) {
  if (!status) return status;
  if (STATUS_VI[status]) return STATUS_VI[status];
  if (hasVietnamese(status)) return status;

  const s = String(status).toLowerCase();
  if (s.includes("delivered")) return "Đã giao thành công";
  if (s.includes("delivering") || s.includes("out_for")) return "Đang giao hàng";
  if (s.includes("pickup")) return "Lấy hàng";
  if (s.includes("return")) return "Hoàn hàng";
  if (s.includes("cancel")) return "Đã hủy";
  if (s.includes("fail")) return "Giao không thành công";
  if (s.includes("transport") || s.includes("transit")) return "Đang vận chuyển";
  return status;
}

function translateMessage(message) {
  if (!message) return message;
  let msg = String(message).trim();
  if (hasVietnamese(msg)) return msg;

  const pairs = [
    [/Your parcel has been delivered/gi, "Đơn hàng đã giao thành công"],
    [
      /Your parcel is being delivered by courier/gi,
      "Nhân viên giao hàng đang tiến hành giao",
    ],
    [
      /Your parcel has been received by delivery hub/gi,
      "Đã tới bưu cục phát",
    ],
    [
      /Your parcel has been received by sorting center/gi,
      "Đã chuyển tới trung tâm khai thác",
    ],
    [
      /Your parcel has been received by sorting hub/gi,
      "Đã tới trung tâm phân loại",
    ],
    [
      /Your parcel has been received by pickup hub/gi,
      "Đã chuyển tới bưu cục lấy",
    ],
    [/Your parcel has been picked up/gi, "Đơn vị vận chuyển đã lấy hàng"],
    [/Your parcel is out for delivery/gi, "Đơn hàng đang được giao"],
    [/Failed delivery attempt/gi, "Giao hàng không thành công"],
    [/Order has been created/gi, "Đơn hàng đã được tạo"],
    [/Parcel has been created/gi, "Đơn hàng đã được tạo"],
    [/In transit/gi, "Đang trung chuyển"],
    [/Out for delivery/gi, "Đang giao hàng"],
    [/Delivered/gi, "Đã giao thành công"],
  ];
  for (const [re, vi] of pairs) {
    msg = msg.replace(re, vi);
  }
  return msg;
}

/**
 * @param {string} trackingNumber
 * @returns {Promise<import('./types.js').TrackingResult>}
 */
export async function fetchSpxTracking(trackingNumber) {
  const tracking = String(trackingNumber).trim().toUpperCase();
  if (!tracking) {
    return emptyResult(tracking, "Thiếu mã vận đơn");
  }

  const signed = buildSignedTrackingNumber(tracking);
  const url = `${SPX_API}?sls_tracking_number=${encodeURIComponent(signed)}`;

  let res;
  try {
    res = await fetch(url, {
      headers: {
        Accept: "application/json, text/plain, */*",
        "Accept-Language": "vi-VN,vi;q=0.9,en;q=0.1",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Referer: "https://spx.vn/track",
        Origin: "https://spx.vn",
        language: "vi",
        "x-region": "vn",
      },
    });
  } catch (err) {
    return emptyResult(tracking, `Lỗi mạng: ${err.message}`);
  }

  if (!res.ok) {
    return emptyResult(tracking, `SPX HTTP ${res.status}`);
  }

  const raw = await res.json();

  if (raw.retcode !== 0 || !raw.data) {
    return {
      ...emptyResult(
        tracking,
        raw.message ||
          (raw.retcode === -1217
            ? "Chưa có thông tin vận đơn (mã sai hoặc chưa cập nhật)"
            : `SPX lỗi ${raw.retcode}`)
      ),
      raw,
    };
  }

  const data = raw.data;
  const events = (data.tracking_list || []).map((item) => {
    const statusRaw = item.status || "";
    const messageRaw = item.message || "";
    return {
      status: translateStatus(statusRaw),
      statusRaw,
      message: translateMessage(messageRaw),
      messageRaw,
      location: extractLocation(messageRaw),
      timestamp: item.timestamp
        ? new Date(item.timestamp * 1000).toISOString()
        : null,
      timestampUnix: item.timestamp || null,
    };
  });

  const currentStatusRaw =
    data.current_status || events[0]?.statusRaw || "Unknown";
  const currentStatus =
    translateStatus(currentStatusRaw) || events[0]?.status || currentStatusRaw;

  // SPX public API ít khi trả tên SP / địa chỉ đầy đủ — map nếu có
  const orderDetails = buildOrderDetails({
    recipientName: data.receiver_name || data.to_name || null,
    recipientPhone: data.receiver_phone || data.to_phone || null,
    recipientAddress: data.receiver_address || data.to_address || null,
    senderName: data.sender_name || data.from_name || null,
    senderAddress: data.sender_address || data.from_address || null,
    productName:
      data.item_name || data.product_name || data.goods_name || null,
    clientOrderCode: data.order_sn || data.client_order_code || null,
    note: data.remark || data.note || null,
  });

  return {
    ok: true,
    trackingNumber: data.sls_tracking_number || tracking,
    carrier: "spx",
    carrierName: "Shopee Express",
    currentStatus,
    currentStatusRaw,
    estimatedDelivery: null,
    orderDetails,
    events,
    raw,
    error: null,
  };
}

function extractLocation(message) {
  if (!message) return null;
  const m = String(message).match(/\[([^\]]+)\]/);
  return m ? m[1] : null;
}

function emptyResult(tracking, error) {
  return {
    ok: false,
    trackingNumber: tracking,
    carrier: "spx",
    carrierName: "Shopee Express",
    currentStatus: null,
    currentStatusRaw: null,
    estimatedDelivery: null,
    orderDetails: buildOrderDetails(),
    events: [],
    raw: null,
    error,
  };
}
