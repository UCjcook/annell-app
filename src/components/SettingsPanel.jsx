import { useEffect, useState } from 'react';
import { normalizeStoreDomain } from '../lib/shopify';
import { maskSecret } from '../lib/secrets';

export default function SettingsPanel({ settings, onSave, onTestConnection, onConnectEtsy, onSyncEtsy, onSync, syncing, syncMessage }) {
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
  const [etsyClientId, setEtsyClientId] = useState(settings?.etsyClientId || '');
  const [etsyNotice, setEtsyNotice] = useState('');
  const [etsyError, setEtsyError] = useState('');
  const [etsyBusy, setEtsyBusy] = useState(false);

  useEffect(() => {
    setStoreDomain(settings?.shopifyStoreDomain || '');
    setClientId(settings?.shopifyClientId || '');
    setClientSecret(settings?.shopifyClientSecret || '');
    setProductionDays(String(settings?.shopifyProductionDays ?? 5));
    setAutoSyncEnabled(Boolean(settings?.autoSyncEnabled));
    setAutoSyncIntervalMinutes(String(settings?.autoSyncIntervalMinutes ?? 15));
    setEtsyClientId(settings?.etsyClientId || '');
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

  async function handleTestConnection() {
    setConnectionNotice('');
    setConnectionError('');
    setTestingConnection(true);
    try {
      const result = await onTestConnection({
        shopifyStoreDomain: normalizeStoreDomain(storeDomain),
        shopifyClientId: clientId.trim(),
        shopifyClientSecret: clientSecret.trim(),
        shopifyProductionDays: Math.max(1, Number.parseInt(productionDays, 10) || 5),
        autoSyncEnabled,
        autoSyncIntervalMinutes: Math.max(5, Number.parseInt(autoSyncIntervalMinutes, 10) || 15),
      });
      setConnectionNotice(result.message || 'Connection looks good.');
    } catch (error) {
      setConnectionError(error.message || 'Could not connect to Shopify.');
    } finally {
      setTestingConnection(false);
    }
  }

  const hasCredentials = Boolean(storeDomain.trim() && clientId.trim() && clientSecret.trim());
  const hasEtsyConnection = Boolean(settings?.etsyAccessToken && settings?.etsyShopId);

  async function handleConnectEtsy() {
    setEtsyNotice('');
    setEtsyError('');
    setEtsyBusy(true);
    try {
      const result = await onConnectEtsy({
        etsyClientId: etsyClientId.trim(),
        shopifyProductionDays: Math.max(1, Number.parseInt(productionDays, 10) || 5),
      });
      setEtsyNotice(result.message || 'Etsy connected.');
    } catch (error) {
      setEtsyError(error.message || 'Could not connect Etsy.');
    } finally {
      setEtsyBusy(false);
    }
  }

  async function handleSyncEtsy() {
    setEtsyNotice('');
    setEtsyError('');
    setEtsyBusy(true);
    try {
      const result = await onSyncEtsy();
      setEtsyNotice(result.message || 'Etsy orders synced.');
    } catch (error) {
      setEtsyError(error.message || 'Could not sync Etsy orders.');
    } finally {
      setEtsyBusy(false);
    }
  }

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

      <div className="settings-panel__header">
        <div>
          <p className="eyebrow">Etsy connection</p>
          <h2>Connect your Etsy shop</h2>
          <p className="settings-panel__subtext">Click connect, approve Etsy in your browser, then come back here to sync orders.</p>
        </div>
      </div>

      <form className="settings-form" onSubmit={(event) => event.preventDefault()}>
        <label>
          <span>Etsy app ID</span>
          <input
            type="text"
            placeholder="Paste the Etsy app ID here"
            value={etsyClientId}
            onChange={(event) => setEtsyClientId(event.target.value)}
          />
        </label>

        <label>
          <span>Status</span>
          <input type="text" value={hasEtsyConnection ? `Connected to shop ${settings?.etsyShopId}` : 'Not connected yet'} readOnly />
        </label>

        <div className="settings-actions">
          <button className="button" type="button" onClick={handleConnectEtsy} disabled={!etsyClientId.trim() || etsyBusy}>
            {etsyBusy ? 'Working…' : 'Connect Etsy'}
          </button>
          <button className="button" type="button" onClick={handleSyncEtsy} disabled={!hasEtsyConnection || etsyBusy}>
            {etsyBusy ? 'Working…' : 'Sync Etsy orders'}
          </button>
          {etsyNotice ? <span className="status-ok">{etsyNotice}</span> : null}
          {etsyError ? <span className="status-error">{etsyError}</span> : null}
        </div>
      </form>
    </section>
  );
}
