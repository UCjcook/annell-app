import { useEffect, useState } from 'react';
import { normalizeStoreDomain } from '../lib/shopify';

export default function SettingsPanel({ settings, onSave, onSync, syncing, syncMessage }) {
  const [storeDomain, setStoreDomain] = useState(settings?.shopifyStoreDomain || '');
  const [clientId, setClientId] = useState(settings?.shopifyClientId || '');
  const [clientSecret, setClientSecret] = useState(settings?.shopifyClientSecret || '');
  const [productionDays, setProductionDays] = useState(String(settings?.shopifyProductionDays ?? 5));
  const [savedNotice, setSavedNotice] = useState('');

  useEffect(() => {
    setStoreDomain(settings?.shopifyStoreDomain || '');
    setClientId(settings?.shopifyClientId || '');
    setClientSecret(settings?.shopifyClientSecret || '');
    setProductionDays(String(settings?.shopifyProductionDays ?? 5));
  }, [settings]);

  async function handleSubmit(event) {
    event.preventDefault();
    const payload = {
      shopifyStoreDomain: normalizeStoreDomain(storeDomain),
      shopifyClientId: clientId.trim(),
      shopifyClientSecret: clientSecret.trim(),
      shopifyProductionDays: Math.max(1, Number.parseInt(productionDays, 10) || 5),
    };
    await onSave(payload);
    setSavedNotice('Saved locally.');
    setTimeout(() => setSavedNotice(''), 2000);
  }

  return (
    <section className="settings-panel">
      <div className="settings-panel__header">
        <div>
          <p className="eyebrow">Shopify connection</p>
          <h2>Connect the live store</h2>
        </div>
        <button className="button button-primary" onClick={onSync} disabled={syncing} type="button">
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

        <div className="settings-actions">
          <button className="button" type="submit">Save settings</button>
          {savedNotice ? <span className="status-ok">{savedNotice}</span> : null}
          {syncMessage ? <span className="status-note">{syncMessage}</span> : null}
        </div>
      </form>

      <div className="settings-hint">
        Uses Shopify client-credentials auth. The app requests an access token programmatically when syncing.
      </div>
    </section>
  );
}
