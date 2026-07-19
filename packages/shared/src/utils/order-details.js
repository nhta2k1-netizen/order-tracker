/**
 * Chuẩn hoá thông tin đơn hàng (địa chỉ, người nhận, sản phẩm…).
 * Các carrier map field khác nhau → shape chung cho Web/Bot.
 */

/**
 * @typedef {object} OrderItem
 * @property {string} name
 * @property {number|null} [quantity]
 * @property {string|null} [weight]
 */

/**
 * @typedef {object} OrderDetails
 * @property {string|null} recipientName
 * @property {string|null} recipientPhone
 * @property {string|null} recipientAddress
 * @property {string|null} senderName
 * @property {string|null} senderPhone
 * @property {string|null} senderAddress
 * @property {string|null} productName  tóm tắt tên SP
 * @property {OrderItem[]} items
 * @property {string|null} clientOrderCode  mã đơn shop/sàn
 * @property {string|null} note
 * @property {string|null} codAmount
 */

/**
 * @returns {OrderDetails}
 */
export function emptyOrderDetails() {
  return {
    recipientName: null,
    recipientPhone: null,
    recipientAddress: null,
    senderName: null,
    senderPhone: null,
    senderAddress: null,
    productName: null,
    items: [],
    clientOrderCode: null,
    note: null,
    codAmount: null,
  };
}

/**
 * @param {Partial<OrderDetails>} partial
 * @returns {OrderDetails}
 */
export function buildOrderDetails(partial = {}) {
  const base = emptyOrderDetails();
  const items = Array.isArray(partial.items)
    ? partial.items
        .map((it) => ({
          name: String(it?.name || it?.item_name || it?.product_name || "").trim(),
          quantity:
            it?.quantity != null
              ? Number(it.quantity)
              : it?.qty != null
                ? Number(it.qty)
                : null,
          weight:
            it?.weight != null
              ? String(it.weight)
              : it?.weight_gram != null
                ? `${it.weight_gram}g`
                : null,
        }))
        .filter((it) => it.name)
    : [];

  let productName = partial.productName ? String(partial.productName).trim() : null;
  if (!productName && items.length > 0) {
    productName =
      items.length === 1
        ? items[0].name
        : items.map((i) => (i.quantity ? `${i.name} x${i.quantity}` : i.name)).join(", ");
  }

  return {
    ...base,
    recipientName: clean(partial.recipientName),
    recipientPhone: clean(partial.recipientPhone),
    recipientAddress: clean(partial.recipientAddress),
    senderName: clean(partial.senderName),
    senderPhone: clean(partial.senderPhone),
    senderAddress: clean(partial.senderAddress),
    productName: clean(productName),
    items,
    clientOrderCode: clean(partial.clientOrderCode),
    note: clean(partial.note),
    codAmount: clean(partial.codAmount),
  };
}

/**
 * Có ít nhất 1 field hiển thị được không?
 * @param {OrderDetails|null|undefined} d
 */
export function hasOrderDetails(d) {
  if (!d) return false;
  return Boolean(
    d.recipientName ||
      d.recipientPhone ||
      d.recipientAddress ||
      d.senderName ||
      d.senderAddress ||
      d.productName ||
      (d.items && d.items.length) ||
      d.clientOrderCode ||
      d.note ||
      d.codAmount
  );
}

function clean(v) {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s || s === "null" || s === "undefined") return null;
  return s;
}
