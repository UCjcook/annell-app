import { useEffect, useState } from 'react';
import { normalizeStoreDomain } from '../lib/shopify';
import { maskSecret } from '../lib/secrets';

export default function SettingsPanel({ settings, onSave, onTestConnection, onSync, syncing, syncMessage }) {
  const [storeDomain, setStoreDomain] = useState(settings?.shopifyStoreDomain || '');
  const [clientId, setClientId] = useState(settings?.shopifyClientId || '');
  const [clientSecret, setClientSecret] = useState(settings?.shopifyClientSecret || '');
  const [productionDays, setProductionDays] = useState(String(settings?.shopifyProductionDays ?? 5));
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(Boolean(settings?.autoSyncEnabled));
  const [autoSyncIntervalMinutes, setAutoSyncIntervalMinutes] = useState(String(settings?.autoSyncIntervalMinutes ?? 15));
  const [savedNotice, setSavedNotice] = useState('');
  const [connectionNotice, setConnectionNotice] = useState('');
  const [connectionError, setConnectionError] = useState('');
  const [testingConnection, setTestingConnection] = useState(false);

  useEffect(() => {
    setStoreDomain(settings?.shopifyStoreDomain || '');
    setClientId(settings?.shopifyClientId || '');
    setClientSecret(settings?.shopifyClientSecret || '');
    setProductionDays(String(settings?.shopifyProductionDays ?? 5));
    setAutoSyncEnabled(Boolean(settings?.autoSyncEnabled));
    setAutoSyncIntervalMinutes(String(settings?.autoSyncIntervalMinutes ?? 15));
  }, [settings]);

  async function handleSubmit(event) {
     event.preventDefault();
     const payload = {
       shopifyStoreDomain: normalizeStoreDomain(storeDomain),
       shopifyClientId: clientId.trim(),
       shopifyClientSecret: clientSecret.trim(),
       shopifyProductionDays: Math.max(1, Number.parseInt(productionDays, 10) || 5),
       autoSyncEnabled,
       autoSyncIntervalMinutes: Math.max(5, Number.parseInt(autoSyncIntervalMinutes, 10) || 15),
     };
     await onSave(payload);
     setSavedNotice('Saved locally.');
     setTimeout(() => setSavedNotice(''), 2000);
   }
+
+  async function handleTestConnection() {
+    setConnectionNotice('');
+    setConnectionError('');
+    setTestingConnection(true);
+    try {
+      const result = await onTestConnection({
+        shopifyStoreDomain: normalizeStoreDomain(storeDomain),
+        shopifyClientId: clientId.trim(),
+        shopifyClientSecret: clientSecret.trim(),
+        shopifyProductionDays: Math.max(1, Number.parseInt(productionDays, 10) || 5),
+        autoSyncEnabled,
+        autoSyncIntervalMinutes: Math.max(5, Number.parseInt(autoSyncIntervalMinutes, 10) || 15),
+      });
+      setConnectionNotice(result.message || 'Connection looks good.');
+    } catch (error) {
+      setConnectionError(error.message || 'Could not connect to Shopify.');
+    } finally {
+      setTestingConnection(false);
+    }
+  }
    event.preventDefault();
    const payload = {
      shopifyStoreDomain: normalizeStoreDomain(storeDomain),
      shopifyClientId: clientId.trim(),
      shopifyClientSecret: clientSecret.trim(),
      shopifyProductionDays: Math.max(1, Number.parseInt(productionDays, 10) || 5),
      autoSyncEnabled,
      autoSyncIntervalMinutes: Math.max(5, Number.parseInt(autoSyncIntervalMinutes, 10) || 15),
    };
    await onSave(payload);
    setSavedNotice('Saved locally.');
    setTimeout(() => setSavedNotice(''), 2000);
  }

  const hasCredentials = Boolean(storeDomain.trim() && clientId.trim() && clientSecret.trim());

  return (
    <section className="settings-panel">
      <div className="settings-panel__header">
        <div>
          <p className="eyebrow">Store connection</p>
          <h2>Connect your Shopify store</h2>
          <p className="settings-panel__subtext">You only need to do this once. After that, come back to Orders for day-to-day use.</p>
        </div>
        <button className="button button-primary" onClick={onSync} disabled={syncing || !hasCredentials} type="button">
          {syncing ? 'Syncing…' : 'Sync Shopify orders'}
        </button>
      </div>

      <form className="settings-form" onSubmit={handleSubmit}>
        <label>
          <span>Store address</span>
          <input
            type="text"
            placeholder="your-store.myshopify.com"
            value={storeDomain}
            onChange={(event) => setStoreDomain(event.target.value)}
          />
        </label>

        <label>
          <span>App ID</span>
          <input
            type="text"
            placeholder="Paste the app ID here"
            value={clientId}
            onChange={(event) => setClientId(event.target.value)}
          />
        </label>

        <label>
          <span>App secret</span>
          <input
            type="password"
            placeholder="Paste the app secret here"
            value={clientSecret}
            onChange={(event) => setClientSecret(event.target.value)}
          />
          {settings?.shopifyClientSecret ? <small>Saved secret: {maskSecret(settings.shopifyClientSecret)}</small> : null}
        </label>

        <label>
          <span>Production window days</span>
          <input
            type="number"
            min="1"
            max="30"
            value={productionDays}
            onChange={(event) => setProductionDays(event.target.value)}
          />
        </label>

        <label>
          <span>Background auto-sync</span>
          <select value={autoSyncEnabled ? 'on' : 'off'} onChange={(event) => setAutoSyncEnabled(event.target.value === 'on')}>
            <option value="off">Off</option>
            <option value="on">On</option>
          </select>
        </label>

        <label>
          <span>Auto-sync cadence (minutes)</span>
          <input
            type="number"
            min="5"
            max="240"
            value={autoSyncIntervalMinutes}
            onChange={(event) => setAutoSyncIntervalMinutes(event.target.value)}
            disabled={!autoSyncEnabled}
          />
        </label>

        <div className="settings-actions">
          <button className="button" type="submit">Save settings</button>
          <button className="button" type="button" onClick={handleTestConnection} disabled={!hasCredentials || testingConnection}>
            {testingConnection ? 'Testing…' : 'Test connection'}
          </button>
          {savedNotice ? <span className="status-ok">{savedNotice}</span> : null}
          {connectionNotice ? <span className="status-ok">{connectionNotice}</span> : null}
          {connectionError ? <span className="status-error">{connectionError}</span> : null}
          {syncMessage ? <span className={settings?.lastSyncStatus === 'error' ? 'status-error' : 'status-note'}>{syncMessage}</span> : null}
        </div>
      </form>

      <div className="settings-hint">
        First-time setup: paste in your Shopify store address, app ID, and app secret, then click Test connection. Once that works, save and sync. After that, most daily work happens in the Orders tab.
      </div>
    </section>
  );
}
