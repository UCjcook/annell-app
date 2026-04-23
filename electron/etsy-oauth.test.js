const {
  buildRedirectUri,
  mapEtsyReceiptToLocalOrder,
  buildEtsyConnectionRecord,
  connectEtsyAndFetchReceipts,
} = require('./etsy-oauth');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

(function run() {
  const redirect = buildRedirectUri();
  assert(redirect === 'http://127.0.0.1:34567/etsy/callback', 'redirect URI mismatch');

  const mapped = mapEtsyReceiptToLocalOrder({
    receipt_id: 999,
    name: 'Josh Example',
    create_timestamp: 1710000000,
    was_shipped: false,
    buyer_email: 'josh@example.com',
    transactions: [
      { title: 'Dice Tower', quantity: 2 },
      { title: 'Book Nook', quantity: 1 },
    ],
  }, 5);

  assert(mapped.source_platform === 'Etsy', 'source platform mismatch');
  assert(mapped.order_number === 'ETSY-999', 'order number mismatch');
  assert(mapped.items_summary === '2x Dice Tower, Book Nook', 'item summary mismatch');
  assert(mapped.status === 'New', 'status mismatch');

  assert(typeof connectEtsyAndFetchReceipts === 'function', 'connectEtsyAndFetchReceipts missing');

  const connection = buildEtsyConnectionRecord({
    clientId: 'etsy-app-id',
    shopId: 42,
    redirectUri: redirect,
    tokenPayload: {
      access_token: 'access-token',
      refresh_token: 'refresh-token',
      expires_in: 3600,
      token_type: 'Bearer',
    },
  });

  assert(connection.etsyClientId === 'etsy-app-id', 'client ID mismatch');
  assert(connection.etsyShopId === '42', 'shop ID mismatch');
  assert(connection.etsyRedirectUri === redirect, 'redirect record mismatch');
  assert(connection.etsyAccessToken === 'access-token', 'access token mismatch');
  assert(connection.etsyRefreshToken === 'refresh-token', 'refresh token mismatch');

  console.log('etsy-oauth tests passed');
})();
