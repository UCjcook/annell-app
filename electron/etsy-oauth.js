const crypto = require('crypto');
const http = require('http');
const open = require('open');

const ETSY_AUTHORIZE_URL = 'https://www.etsy.com/oauth/connect';
const ETSY_TOKEN_URL = 'https://api.etsy.com/v3/public/oauth/token';
const DEFAULT_CALLBACK_PORT = 34567;

function base64Url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function createPkcePair() {
  const verifier = base64Url(crypto.randomBytes(32));
  const challenge = base64Url(crypto.createHash('sha256').update(verifier).digest());
  return { verifier, challenge };
}

function createState() {
  return base64Url(crypto.randomBytes(24));
}

function buildRedirectUri(port = DEFAULT_CALLBACK_PORT) {
  return `http://127.0.0.1:${port}/etsy/callback`;
}

function buildAuthorizeUrl({ clientId, redirectUri, scopes, state, codeChallenge }) {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: scopes.join(' '),
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });
  return `${ETSY_AUTHORIZE_URL}?${params.toString()}`;
}

async function exchangeCodeForToken({ clientId, redirectUri, code, codeVerifier }) {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: clientId,
    redirect_uri: redirectUri,
    code,
    code_verifier: codeVerifier,
  });

  const response = await fetch(ETSY_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Etsy token exchange failed (${response.status}): ${errorBody}`);
  }

  return response.json();
}

function waitForOAuthCallback({ expectedState, port = DEFAULT_CALLBACK_PORT, timeoutMs = 180000 }) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, `http://127.0.0.1:${port}`);
      if (url.pathname !== '/etsy/callback') {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not found');
        return;
      }

      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      const error = url.searchParams.get('error');
      const errorDescription = url.searchParams.get('error_description');

      if (error) {
        res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`<h1>Etsy connection failed</h1><p>${errorDescription || error}</p>`);
        cleanup();
        reject(new Error(`Etsy authorization failed: ${errorDescription || error}`));
        return;
      }

      if (!code || state !== expectedState) {
        res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<h1>Etsy connection failed</h1><p>The returned state did not match this request.</p>');
        cleanup();
        reject(new Error('Etsy authorization state mismatch'));
        return;
      }

      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<h1>Etsy connected</h1><p>You can close this window and return to Annell App.</p>');
      cleanup();
      resolve({ code, state });
    });

    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('Timed out waiting for Etsy authorization'));
    }, timeoutMs);

    function cleanup() {
      clearTimeout(timer);
      server.close();
    }

    server.on('error', (error) => {
      cleanup();
      reject(error);
    });

    server.listen(port, '127.0.0.1');
  });
}


async function refreshEtsyAccessToken({ clientId, refreshToken }) {
  if (!clientId || !refreshToken) {
    throw new Error('Missing Etsy app ID or refresh token');
  }

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: clientId,
    refresh_token: refreshToken,
  });

  const response = await fetch(ETSY_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Etsy token refresh failed (${response.status}): ${errorBody}`);
  }

  return response.json();
}

async function startEtsyOAuth({ clientId, scopes, port = DEFAULT_CALLBACK_PORT }) {
  if (!clientId) {
    throw new Error('Missing Etsy app ID');
  }

  const redirectUri = buildRedirectUri(port);
  const { verifier, challenge } = createPkcePair();
  const state = createState();
  const authorizeUrl = buildAuthorizeUrl({
    clientId,
    redirectUri,
    scopes,
    state,
    codeChallenge: challenge,
  });

  const callbackPromise = waitForOAuthCallback({ expectedState: state, port });
  await open(authorizeUrl);
  const { code } = await callbackPromise;
  const tokenPayload = await exchangeCodeForToken({
    clientId,
    redirectUri,
    code,
    codeVerifier: verifier,
  });

  return {
    redirectUri,
    tokenPayload,
  };
}




async function fetchEtsyShop({ apiKey, accessToken }) {
  if (!apiKey || !accessToken) {
    throw new Error('Missing Etsy app ID or access token');
  }

  const response = await fetch('https://openapi.etsy.com/v3/application/users/me/shops', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'x-api-key': apiKey,
    },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Etsy shop lookup failed (${response.status}): ${errorBody}`);
  }

  return response.json();
}


function buildEtsyConnectionRecord({ clientId, shopId, redirectUri, tokenPayload }) {
  const expiresIn = Number(tokenPayload?.expires_in || 3600);
  return {
    etsyClientId: clientId || '',
    etsyShopId: String(shopId || ''),
    etsyRedirectUri: redirectUri || '',
    etsyAccessToken: tokenPayload?.access_token || '',
    etsyRefreshToken: tokenPayload?.refresh_token || '',
    etsyTokenType: tokenPayload?.token_type || 'Bearer',
    etsyTokenExpiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
    etsyConnectedAt: new Date().toISOString(),
  };
}

function mapEtsyReceiptToLocalOrder(receipt, productionDays = 5) {
  const createdAtMs = Number(receipt?.create_timestamp || 0) * 1000 || Date.now();
  const createdAt = new Date(createdAtMs).toISOString();
  const shipByDate = new Date(createdAtMs + productionDays * 86400000).toISOString();
  const firstName = receipt?.name?.split(' ')[0] || '';
  const customerName = receipt?.name || receipt?.first_line || receipt?.buyer_email || 'Unknown customer';
  const lineItems = Array.isArray(receipt?.transactions) ? receipt.transactions : [];
  const itemsSummary = lineItems.length
    ? lineItems.map((item) => {
        const qty = item?.quantity || 1;
        const title = item?.title || 'Item';
        return qty > 1 ? `${qty}x ${title}` : title;
      }).join(', ')
    : 'Untitled item';

  return {
    source_platform: 'Etsy',
    source_order_id: String(receipt?.receipt_id || receipt?.receiptId || Date.now()),
    order_number: `ETSY-${receipt?.receipt_id || receipt?.receiptId || 'UNKNOWN'}`,
    customer_name: customerName,
    items_summary: itemsSummary,
    order_date: createdAt,
    ship_by_date: shipByDate,
    status: receipt?.was_shipped ? 'Done' : 'New',
    notes: `Etsy order${receipt?.buyer_email ? ` | ${receipt.buyer_email}` : ''}`,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

async function fetchEtsyOpenReceipts({ apiKey, accessToken, shopId, limit = 50 }) {
  if (!apiKey || !accessToken || !shopId) {
    throw new Error('Missing Etsy app ID, access token, or shop ID');
  }

  const url = new URL(`https://openapi.etsy.com/v3/application/shops/${shopId}/receipts`);
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('was_paid', 'true');
  url.searchParams.set('was_shipped', 'false');

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'x-api-key': apiKey,
    },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Etsy receipts fetch failed (${response.status}): ${errorBody}`);
  }

  return response.json();
}


async function connectEtsyAndFetchReceipts({ clientId, scopes, productionDays = 5, port = DEFAULT_CALLBACK_PORT }) {
  const { redirectUri, tokenPayload } = await startEtsyOAuth({ clientId, scopes, port });
  const shopPayload = await fetchEtsyShop({ apiKey: clientId, accessToken: tokenPayload.access_token });
  const firstShop = Array.isArray(shopPayload?.results) ? shopPayload.results[0] : null;
  const shopId = firstShop?.shop_id || firstShop?.shopId;
  if (!shopId) {
    throw new Error('Etsy did not return a shop for this account');
  }

  const receiptsPayload = await fetchEtsyOpenReceipts({
    apiKey: clientId,
    accessToken: tokenPayload.access_token,
    shopId,
  });

  const receipts = Array.isArray(receiptsPayload?.results) ? receiptsPayload.results : [];
  return {
    connection: buildEtsyConnectionRecord({ clientId, shopId, redirectUri, tokenPayload }),
    receipts,
    localOrders: receipts.map((receipt) => mapEtsyReceiptToLocalOrder(receipt, productionDays)),
  };
}

module.exports = {
  DEFAULT_CALLBACK_PORT,
  buildRedirectUri,
  startEtsyOAuth,
  refreshEtsyAccessToken,
  fetchEtsyShop,
  fetchEtsyOpenReceipts,
  buildEtsyConnectionRecord,
  mapEtsyReceiptToLocalOrder,
  connectEtsyAndFetchReceipts,
};
