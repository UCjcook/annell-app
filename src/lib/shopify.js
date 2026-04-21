export function maskToken(token) {
  if (!token) return '';
  if (token.length <= 8) return '•'.repeat(token.length);
  return `${token.slice(0, 4)}${'•'.repeat(Math.max(4, token.length - 8))}${token.slice(-4)}`;
}

export function normalizeStoreDomain(input) {
  const value = String(input || '').trim().toLowerCase();
  if (!value) return '';
  const withoutProtocol = value.replace(/^https?:\/\//, '');
  return withoutProtocol.replace(/\/$/, '');
}

export function shopifyAdminUrl(storeDomain) {
  return `https://${storeDomain}/admin/api/2025-01/graphql.json`;
}

export function summarizeLineItems(lineItems = []) {
  if (!lineItems.length) return 'Untitled item';
  return lineItems
    .map((item) => {
      const qty = item?.currentQuantity ?? item?.quantity ?? 1;
      const name = item?.title || 'Item';
      return qty > 1 ? `${qty}x ${name}` : name;
    })
    .join(', ');
}

export function extractCustomerName(order) {
  const first = order?.customer?.firstName || '';
  const last = order?.customer?.lastName || '';
  const joined = `${first} ${last}`.trim();
  return joined || order?.email || 'Unknown customer';
}

export function toLocalOrder(order, productionDays = 5) {
  const createdAt = order.createdAt || new Date().toISOString();
  const baseDate = new Date(createdAt);
  const shipByDate = new Date(baseDate.getTime() + productionDays * 86400000).toISOString();

  return {
    source_platform: 'Shopify',
    source_order_id: String(order.id || order.legacyResourceId || order.name),
    order_number: order.name || `SHOP-${order.legacyResourceId || 'UNKNOWN'}`,
    customer_name: extractCustomerName(order),
    items_summary: summarizeLineItems(order.lineItems?.nodes || []),
    order_date: createdAt,
    ship_by_date: shipByDate,
    status: order.displayFulfillmentStatus === 'FULFILLED' ? 'Done' : 'New',
    notes: `Financial: ${order.displayFinancialStatus || 'UNKNOWN'} | Fulfillment: ${order.displayFulfillmentStatus || 'UNFULFILLED'}`,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}
