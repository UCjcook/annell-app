const { app, BrowserWindow, nativeTheme, ipcMain, Notification, dialog } = require('electron');
const path = require('path');
const Database = require('better-sqlite3');

const isDev = !app.isPackaged;
let db;
let mainWindow;
let autoSyncTimer = null;
let syncInFlight = null;

function showFatalError(title, error) {
  const message = error?.stack || error?.message || String(error);
  console.error(`[fatal] ${title}\n${message}`);
  if (app.isReady()) {
    dialog.showErrorBox(title, message);
  }
}

const SETTINGS_DEFAULTS = {
  shopifyStoreDomain: '',
  shopifyClientId: '',
  shopifyClientSecret: '',
  shopifyProductionDays: 5,
  autoSyncEnabled: false,
  autoSyncIntervalMinutes: 15,
  lastSyncAt: '',
  lastSyncImported: 0,
  lastSyncStatus: 'idle',
  lastSyncMessage: '',
};

const SHOPIFY_ORDERS_QUERY = `#graphql
  query OpenOrders($first: Int!) {
    orders(
      first: $first,
      sortKey: CREATED_AT,
      reverse: true,
      query: "fulfillment_status:unfulfilled AND status:open"
    ) {
      nodes {
        id
        legacyResourceId
        name
        createdAt
        displayFinancialStatus
        displayFulfillmentStatus
        email
        customer {
          firstName
          lastName
        }
        lineItems(first: 20) {
          nodes {
            title
            quantity
            currentQuantity
          }
        }
      }
    }
  }
`;

function formatShipByLabel(daysLeft) {
  if (daysLeft < 0) return `${Math.abs(daysLeft)} day${Math.abs(daysLeft) === 1 ? '' : 's'} late`;
  if (daysLeft === 0) return 'Due today';
  if (daysLeft === 1) return 'Tomorrow';
  return `In ${daysLeft} days`;
}

function initDb() {
  const userData = app.getPath('userData');
  try {
    db = new Database(path.join(userData, 'order-urgency.db'));
  } catch (error) {
    showFatalError('Annell App failed to open its database', error);
    throw error;
  }
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_platform TEXT NOT NULL,
      source_order_id TEXT NOT NULL,
      order_number TEXT NOT NULL,
      customer_name TEXT NOT NULL,
      items_summary TEXT NOT NULL,
      order_date TEXT NOT NULL,
      ship_by_date TEXT NOT NULL,
      status TEXT NOT NULL,
      notes TEXT DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(source_platform, source_order_id)
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS reminders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_number TEXT NOT NULL,
      reminder_type TEXT NOT NULL,
      sent_at TEXT NOT NULL,
      UNIQUE(order_number, reminder_type, sent_at)
    );
  `);
}

function parseSettingValue(key, value) {
  if (['shopifyProductionDays', 'autoSyncIntervalMinutes', 'lastSyncImported'].includes(key)) {
    return Number.parseInt(value, 10) || SETTINGS_DEFAULTS[key];
  }
  if (key === 'autoSyncEnabled') {
    return value === 'true';
  }
  return value;
}

function getSettings() {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const merged = { ...SETTINGS_DEFAULTS };
  for (const row of rows) {
    merged[row.key] = parseSettingValue(row.key, row.value);
  }
  return merged;
}

function persistSettings(entries) {
  const upsert = db.prepare(`
    INSERT INTO settings (key, value)
    VALUES (@key, @value)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `);
  const tx = db.transaction((payload) => {
    for (const [key, value] of Object.entries(payload)) {
      upsert.run({ key, value: String(value ?? '') });
    }
  });
  tx(entries);
}

function broadcastSyncState(patch = {}) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send('shopify:sync-state', {
    ...getSettings(),
    ...patch,
  });
}

function normalizeSettings(nextSettings) {
  const merged = { ...getSettings(), ...nextSettings };
  return {
    ...merged,
    shopifyProductionDays: Math.max(1, Number.parseInt(merged.shopifyProductionDays, 10) || SETTINGS_DEFAULTS.shopifyProductionDays),
    autoSyncEnabled: Boolean(merged.autoSyncEnabled),
    autoSyncIntervalMinutes: Math.max(5, Number.parseInt(merged.autoSyncIntervalMinutes, 10) || SETTINGS_DEFAULTS.autoSyncIntervalMinutes),
    lastSyncImported: Number.parseInt(merged.lastSyncImported, 10) || 0,
    lastSyncAt: String(merged.lastSyncAt || ''),
    lastSyncStatus: String(merged.lastSyncStatus || 'idle'),
    lastSyncMessage: String(merged.lastSyncMessage || ''),
  };
}

function saveSettings(nextSettings) {
  const normalized = normalizeSettings(nextSettings);
  persistSettings(normalized);
  scheduleAutoSync(getSettings());
  broadcastSyncState();
  return getSettings();
}

async function getShopifyAccessToken(settings) {
  const storeDomain = settings.shopifyStoreDomain;
  const clientId = settings.shopifyClientId;
  const clientSecret = settings.shopifyClientSecret;
  if (!storeDomain || !clientId || !clientSecret) {
    throw new Error('Missing Shopify store domain, client ID, or client secret');
  }

  const response = await fetch(`https://${storeDomain}/admin/oauth/access_token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'client_credentials',
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Shopify token exchange failed (${response.status}): ${body}`);
  }

  const payload = await response.json();
  if (!payload.access_token) {
    throw new Error('Shopify token exchange returned no access token');
  }

  return payload.access_token;
}

async function runShopifyGraphQL(settings, query, variables = {}) {
  const storeDomain = settings.shopifyStoreDomain;
  const accessToken = await getShopifyAccessToken(settings);

  const response = await fetch(`https://${storeDomain}/admin/api/2025-01/graphql.json`, {
     method: 'POST',
     headers: {
       'Content-Type': 'application/json',
       'X-Shopify-Access-Token': accessToken,
     },
     body: JSON.stringify({
-      query: SHOPIFY_ORDERS_QUERY,
-      variables: { first: 50 },
+      query,
+      variables,
     }),
   });
 
   if (!response.ok) {
     const body = await response.text();
     throw new Error(`Shopify sync failed (${response.status}): ${body}`);
   }
 
   const payload = await response.json();
   if (payload.errors?.length) {
     throw new Error(payload.errors.map((entry) => entry.message).join('; '));
   }
+
+   return payload;
+}
+
+async function fetchShopifyOrders(settings) {
+  const payload = await runShopifyGraphQL(settings, SHOPIFY_ORDERS_QUERY, { first: 50 });
 
   return payload.data?.orders?.nodes || [];
 }
+
+async function testShopifyConnection(nextSettings = {}) {
+  const settings = normalizeSettings(nextSettings);
+  const payload = await runShopifyGraphQL(settings, `#graphql
+    query TestConnection {
+      shop {
+        name
+        primaryDomain { host }
+      }
+    }
+  `);
+  return {
+    ok: true,
+    shopName: payload.data?.shop?.name || 'Connected store',
+    shopHost: payload.data?.shop?.primaryDomain?.host || settings.shopifyStoreDomain,
+    message: `Connected to ${payload.data?.shop?.name || settings.shopifyStoreDomain}.`,
+  };
+}
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': accessToken,
    },
    body: JSON.stringify({
      query: SHOPIFY_ORDERS_QUERY,
      variables: { first: 50 },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Shopify sync failed (${response.status}): ${body}`);
  }

  const payload = await response.json();
  if (payload.errors?.length) {
    throw new Error(payload.errors.map((entry) => entry.message).join('; '));
  }

  return payload.data?.orders?.nodes || [];
}

function summarizeLineItems(lineItems = []) {
  if (!lineItems.length) return 'Untitled item';
  return lineItems
    .map((item) => {
      const qty = item.currentQuantity ?? item.quantity ?? 1;
      return qty > 1 ? `${qty}x ${item.title}` : item.title;
    })
    .join(', ');
}

function localOrderFromShopify(order, productionDays) {
  const createdAt = order.createdAt || new Date().toISOString();
  const baseDate = new Date(createdAt);
  const shipByDate = new Date(baseDate.getTime() + productionDays * 86400000).toISOString();
  const customerName = `${order.customer?.firstName || ''} ${order.customer?.lastName || ''}`.trim() || order.email || 'Unknown customer';

  return {
    source_platform: 'Shopify',
    source_order_id: String(order.id || order.legacyResourceId || order.name),
    order_number: order.name || `SHOP-${order.legacyResourceId || 'UNKNOWN'}`,
    customer_name: customerName,
    items_summary: summarizeLineItems(order.lineItems?.nodes || []),
    order_date: createdAt,
    ship_by_date: shipByDate,
    status: order.displayFulfillmentStatus === 'FULFILLED' ? 'Done' : 'New',
    notes: `Financial: ${order.displayFinancialStatus || 'UNKNOWN'} | Fulfillment: ${order.displayFulfillmentStatus || 'UNFULFILLED'}`,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

function upsertOrders(rows) {
  const stmt = db.prepare(`
    INSERT INTO orders (
      source_platform, source_order_id, order_number, customer_name, items_summary,
      order_date, ship_by_date, status, notes, created_at, updated_at
    ) VALUES (
      @source_platform, @source_order_id, @order_number, @customer_name, @items_summary,
      @order_date, @ship_by_date, @status, @notes, @created_at, @updated_at
    )
    ON CONFLICT(source_platform, source_order_id) DO UPDATE SET
      order_number = excluded.order_number,
      customer_name = excluded.customer_name,
      items_summary = excluded.items_summary,
      order_date = excluded.order_date,
      ship_by_date = excluded.ship_by_date,
      status = excluded.status,
      notes = excluded.notes,
      updated_at = excluded.updated_at
  `);
  const tx = db.transaction((items) => items.forEach((item) => stmt.run(item)));
  tx(rows);
}

function clearDemoOrders() {
  db.prepare(`
    DELETE FROM orders
    WHERE notes LIKE 'demo:%'
  `).run();
}

async function syncShopifyOrders(trigger = 'manual') {
  if (syncInFlight) {
    return syncInFlight;
  }

  syncInFlight = (async () => {
    broadcastSyncState({ lastSyncStatus: 'running', lastSyncMessage: trigger === 'auto' ? 'Auto-sync in progress…' : 'Sync in progress…' });
    try {
      const settings = getSettings();
      const productionDays = Number.parseInt(settings.shopifyProductionDays, 10) || 5;
      const orders = await fetchShopifyOrders(settings);
      const normalized = orders.map((order) => localOrderFromShopify(order, productionDays));
      if (normalized.length > 0) {
        clearDemoOrders();
      }
      upsertOrders(normalized);
      processReminders();
      const result = {
        ok: true,
        imported: normalized.length,
        trigger,
        syncedAt: new Date().toISOString(),
        message: `Imported ${normalized.length} Shopify order${normalized.length === 1 ? '' : 's'}.`,
      };
      saveSettings({
        lastSyncAt: result.syncedAt,
        lastSyncImported: result.imported,
        lastSyncStatus: 'ok',
        lastSyncMessage: result.message,
      });
      broadcastSyncState();
      return result;
    } catch (error) {
      const message = error.message || 'Shopify sync failed';
      saveSettings({
        lastSyncStatus: 'error',
        lastSyncMessage: message,
      });
      broadcastSyncState();
      throw new Error(message);
    } finally {
      syncInFlight = null;
    }
  })();

  return syncInFlight;
}

function seedDemoData() {
  const existingRealOrder = db.prepare(`
    SELECT 1 FROM orders
    WHERE notes NOT LIKE 'demo:%'
    LIMIT 1
  `).get();
  if (existingRealOrder) return;
  const count = db.prepare(`
    SELECT COUNT(*) as count FROM orders
    WHERE notes LIKE 'demo:%'
  `).get().count;
  if (count > 0) return;
  const now = new Date();
  const insert = db.prepare(`
    INSERT INTO orders (
      source_platform, source_order_id, order_number, customer_name, items_summary,
      order_date, ship_by_date, status, notes, created_at, updated_at
    ) VALUES (
      @source_platform, @source_order_id, @order_number, @customer_name, @items_summary,
      @order_date, @ship_by_date, @status, @notes, @created_at, @updated_at
    )
  `);
  const rows = [
    {
      source_platform: 'Etsy',
      source_order_id: '1042',
      order_number: 'ETSY-1042',
      customer_name: 'Sarah M.',
      items_summary: "Dragon's Keep Dice Tower",
      order_date: new Date(now.getTime() - 1 * 86400000).toISOString(),
      ship_by_date: new Date(now.getTime() + 3 * 86400000).toISOString(),
      status: 'New',
      notes: 'demo: seeded sample order',
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    },
    {
      source_platform: 'Shopify',
      source_order_id: '2031',
      order_number: 'SHOP-2031',
      customer_name: 'Brian T.',
      items_summary: 'Kraken Controller Holder',
      order_date: new Date(now.getTime() - 4 * 86400000).toISOString(),
      ship_by_date: new Date(now.getTime() + 1 * 86400000).toISOString(),
      status: 'Painting',
      notes: 'demo: seeded sample order',
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    },
    {
      source_platform: 'Etsy',
      source_order_id: '1038',
      order_number: 'ETSY-1038',
      customer_name: 'Emily R.',
      items_summary: 'Wizard Treehouse Dice Tower',
      order_date: new Date(now.getTime() - 3 * 86400000).toISOString(),
      ship_by_date: new Date(now.getTime() + 2 * 86400000).toISOString(),
      status: 'Printing',
      notes: 'demo: seeded sample order',
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    },
    {
      source_platform: 'Shopify',
      source_order_id: '1998',
      order_number: 'SHOP-1998',
      customer_name: 'Jason L.',
      items_summary: 'Mimic Book Nook',
      order_date: new Date(now.getTime() - 9 * 86400000).toISOString(),
      ship_by_date: new Date(now.getTime() - 2 * 86400000).toISOString(),
      status: 'Problem',
      notes: 'demo: Waiting on repaint approval',
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    },
    {
      source_platform: 'Etsy',
      source_order_id: '1002',
      order_number: 'ETSY-1002',
      customer_name: 'Alicia P.',
      items_summary: 'Basilisk Dice Tower',
      order_date: new Date(now.getTime() - 12 * 86400000).toISOString(),
      ship_by_date: new Date(now.getTime() - 1 * 86400000).toISOString(),
      status: 'Done',
      notes: 'demo: Shipped successfully',
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    },
  ];
  const tx = db.transaction((items) => items.forEach((item) => insert.run(item)));
  tx(rows);
}

function listOrders() {
  const rows = db.prepare(`
    SELECT source_platform, source_order_id, order_number, customer_name, items_summary,
           order_date, ship_by_date, status, notes, created_at, updated_at
    FROM orders
    ORDER BY datetime(ship_by_date) ASC
  `).all();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return rows.map((row) => {
    const shipDate = new Date(row.ship_by_date);
    const shipDay = new Date(shipDate);
    shipDay.setHours(0, 0, 0, 0);
    const daysLeft = Math.round((shipDay.getTime() - today.getTime()) / 86400000);
    return {
      sourcePlatform: row.source_platform,
      sourceOrderId: row.source_order_id,
      orderNumber: row.order_number,
      customerName: row.customer_name,
      itemsSummary: row.items_summary,
      orderDate: row.order_date,
      shipByDate: row.ship_by_date,
      shipByLabel: formatShipByLabel(daysLeft),
      daysLeft,
      status: row.status,
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  });
}

function recordReminder(orderNumber, reminderType, sentAt) {
  db.prepare(`
    INSERT INTO reminders (order_number, reminder_type, sent_at)
    VALUES (?, ?, ?)
  `).run(orderNumber, reminderType, sentAt);
}

function hasReminderForDay(orderNumber, reminderType, dayKey) {
  const row = db.prepare(`
    SELECT sent_at FROM reminders
    WHERE order_number = ? AND reminder_type = ? AND substr(sent_at, 1, 10) = ?
    LIMIT 1
  `).get(orderNumber, reminderType, dayKey);
  return Boolean(row);
}

function maybeSendNotification({ title, body }) {
  if (!Notification.isSupported()) return;
  new Notification({ title, body }).show();
}

function processReminders() {
  const orders = listOrders();
  const todayKey = new Date().toISOString().slice(0, 10);

  for (const order of orders) {
    const isDone = order.status === 'Done' || order.status === 'Problem';
    if (isDone) continue;

    if (order.daysLeft >= 4) continue;

    let reminderType = null;
    let title = '';
    let body = '';

    if (order.daysLeft < 0) {
      reminderType = 'overdue';
      title = `Overdue: ${order.orderNumber}`;
      body = `${order.itemsSummary} for ${order.customerName} is ${Math.abs(order.daysLeft)} day${Math.abs(order.daysLeft) === 1 ? '' : 's'} late.`;
    } else if (order.daysLeft === 1) {
      reminderType = 'due-tomorrow';
      title = `Due tomorrow: ${order.orderNumber}`;
      body = `${order.itemsSummary} for ${order.customerName} ships tomorrow.`;
    } else if (order.daysLeft === 3) {
      reminderType = 'due-soon';
      title = `Due soon: ${order.orderNumber}`;
      body = `${order.itemsSummary} for ${order.customerName} ships in 3 days.`;
    }

    if (!reminderType) continue;
    if (hasReminderForDay(order.orderNumber, reminderType, todayKey)) continue;

    maybeSendNotification({ title, body });
    recordReminder(order.orderNumber, reminderType, new Date().toISOString());
  }
}

function addManualOrder({ sourcePlatform, orderNumber, customerName, itemsSummary, daysUntilDue, status, notes }) {
  if (!orderNumber || !customerName || !itemsSummary) {
    throw new Error('orderNumber, customerName, and itemsSummary are required');
  }
  const now = new Date();
  const shipByDate = new Date(now.getTime() + (Math.max(0, daysUntilDue || 0) * 86400000)).toISOString();
  db.prepare(`
    INSERT INTO orders (
      source_platform, source_order_id, order_number, customer_name, items_summary,
      order_date, ship_by_date, status, notes, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(source_platform, source_order_id) DO UPDATE SET
      customer_name = excluded.customer_name,
      items_summary = excluded.items_summary,
      ship_by_date = excluded.ship_by_date,
      status = excluded.status,
      notes = excluded.notes,
      updated_at = excluded.updated_at
  `).run(
    sourcePlatform || 'Manual',
    orderNumber,
    orderNumber,
    customerName,
    itemsSummary,
    now.toISOString(),
    shipByDate,
    status || 'New',
    notes || '',
    now.toISOString(),
    now.toISOString(),
  );
  processReminders();
  return { ok: true };
}

function updateOrderStatus({ orderNumber, status }) {
  if (!orderNumber || !status) {
    throw new Error('orderNumber and status are required');
  }
  db.prepare(`
    UPDATE orders
    SET status = ?, updated_at = ?
    WHERE order_number = ?
  `).run(status, new Date().toISOString(), orderNumber);
  return { ok: true };
}

function updateOrderNotes({ orderNumber, notes }) {
  if (!orderNumber) {
    throw new Error('orderNumber is required');
  }
  db.prepare(`
    UPDATE orders
    SET notes = ?, updated_at = ?
    WHERE order_number = ?
  `).run(notes || '', new Date().toISOString(), orderNumber);
  return { ok: true };
}

function scheduleAutoSync(settings = getSettings()) {
  if (autoSyncTimer) {
    clearInterval(autoSyncTimer);
    autoSyncTimer = null;
  }

  if (!settings.autoSyncEnabled) return;
  if (!settings.shopifyStoreDomain || !settings.shopifyClientId || !settings.shopifyClientSecret) return;

  const intervalMs = Math.max(5, Number.parseInt(settings.autoSyncIntervalMinutes, 10) || SETTINGS_DEFAULTS.autoSyncIntervalMinutes) * 60000;
  autoSyncTimer = setInterval(() => {
    syncShopifyOrders('auto').catch(() => {
      // status already persisted and broadcast
    });
  }, intervalMs);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#111827' : '#f8fafc',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js'),
    },
    title: 'Order Urgency App',
  });

  if (isDev) {
    mainWindow.loadURL('http://127.0.0.1:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(() => {
  try {
    initDb();

    ipcMain.handle('orders:list', async () => listOrders());
    ipcMain.handle('orders:seed-demo', async () => {
      seedDemoData();
      return { ok: true };
    });
    ipcMain.handle('orders:add-manual', async (_event, payload) => addManualOrder(payload || {}));
    ipcMain.handle('orders:update-status', async (_event, payload) => updateOrderStatus(payload || {}));
    ipcMain.handle('orders:update-notes', async (_event, payload) => updateOrderNotes(payload || {}));
    ipcMain.handle('settings:get', async () => getSettings());
    ipcMain.handle('settings:save', async (_event, payload) => saveSettings(payload || {}));
    ipcMain.handle('shopify:test-connection', async (_event, payload) => testShopifyConnection(payload || {}));
    ipcMain.handle('shopify:sync', async () => syncShopifyOrders('manual'));

    createWindow();
    processReminders();
    scheduleAutoSync(getSettings());

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  } catch (error) {
    showFatalError('Annell App failed to start', error);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  if (autoSyncTimer) clearInterval(autoSyncTimer);
  if (process.platform !== 'darwin') app.quit();
});

process.on('uncaughtException', (error) => {
  showFatalError('Annell App hit an unexpected error', error);
});

process.on('unhandledRejection', (error) => {
  showFatalError('Annell App hit an unexpected promise error', error);
});
