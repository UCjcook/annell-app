import { useEffect, useState } from 'react';
import { normalizeStoreDomain } from '../lib/shopify';
import { maskSecret } from '../lib/secrets';

export default function SettingsPanel({ settings, onSave, onSync, syncing, syncMessage }) {
  const [storeDomain, setStoreDomain] = useState(settings?.shopifyStoreDomain || '');
  const [clientId, setClientId] = useState(settings?.shopifyClientId || '');
  const [clientSecret, setClientSecret] = useState(settings?.shopifyClientSecret || '');
  const [productionDays, setProductionDays] = useState(String(settings?.shopifyProductionDays ?? 5));
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(Boolean(settings?.autoSyncEnabled));
  const [autoSyncIntervalMinutes, setAutoSyncIntervalMinutes] = useState(String(settings?.autoSyncIntervalMinutes ?? 15));
  const [savedNotice, setSavedNotice] = useState('');

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

  const hasCredentials = Boolean(storeDomain.trim() && clientId.trim() && clientSecret.trim());

  return (
    <section className="settings-panel">
      <div className="settings-panel__header">
        <div>
          <p className="eyebrow">Shopify connection</p>
          <h2>Connect the live store</h2>
        </div>
        <button className="button button-primary" onClick={onSync} disabled={syncing || !hasCredentials} type="button">
          {syncing ? 'Syncing…' : 'Sync Shopify orders'}
        </button>
      </div>

      <form className="settings-form" onSubmit={handleSubmit}>
        <label>
          <span>Store domain</span>
          <input
            type="text"
            placeholder="3dpossumprints.com"
            value={storeDomain}
            onChange={(event) => setStoreDomain(event.target.value)}
          />
        </label>

        <label>
          <span>Client ID</span>
          <input
            type="text"
            placeholder="Shopify client id"
            value={clientId}
            onChange={(event) => setClientId(event.target.value)}
          />
        </label>

        <label>
          <span>Client secret</span>
          <input
            type="password"
            placeholder="shpss_..."
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
          {savedNotice ? <span className="status-ok">{savedNotice}</span> : null}
          {syncMessage ? <span className={settings?.lastSyncStatus === 'error' ? 'status-error' : 'status-note'}>{syncMessage}</span> : null}
        </div>
      </form>

      <div className="settings-hint">
        First-time setup: enter the Shopify store domain, client ID, and client secret, save, then click Sync Shopify orders. Background sync runs while the desktop app is open, and the latest sync result is saved locally.
      </div>
    </section>
  );
}
