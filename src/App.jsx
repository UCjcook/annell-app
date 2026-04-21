import { useEffect, useMemo, useState } from 'react';
import EmptyState from './components/EmptyState';
import ManualOrderForm from './components/ManualOrderForm';
import NotesEditor from './components/NotesEditor';
import SettingsPanel from './components/SettingsPanel';
import StatusEditor from './components/StatusEditor';
import { useOrders } from './hooks/useOrders';
import { useSettings } from './hooks/useSettings';
import { groupOrders } from './lib/groupOrders';
import { formatRelativeUrgency, formatShortDate, formatTimestamp } from './lib/formatting';
import { getToneForOrder } from './lib/statusTone';

function OrderCard({ order, tone, onStatusChange, onNotesSave, busy }) {
  const urgencyText = formatRelativeUrgency(order.daysLeft);
  const orderDateText = formatShortDate(order.orderDate);
  return (
    <div className={`order-card tone-${tone}`}>
      <div className="order-card__top">
        <span className={`badge badge-${order.source.toLowerCase()}`}>{order.source}</span>
        <span className="order-id">{order.id}</span>
      </div>
      <h3>{order.item}</h3>
      <p className="customer">{order.customer}</p>
      <div className="meta-row">
        <span>Ordered {orderDateText}</span>
        <span>{urgencyText}</span>
      </div>
      <div className="meta-row meta-row--secondary">
        <span>{order.shipBy}</span>
        <span>{order.status}</span>
      </div>
      <StatusEditor currentStatus={order.status} onChange={(value) => onStatusChange(order.id, value)} disabled={busy} />
      <NotesEditor initialValue={order.notes} onSave={(value) => onNotesSave(order.id, value)} disabled={busy} />
    </div>
  );
}

function Column({ title, tone, orders, onStatusChange, onNotesSave, busyOrderId }) {
  return (
    <section className="column">
      <div className="column__header">
        <h2>{title}</h2>
        <span>{orders.length}</span>
      </div>
      <div className="column__body">
        {orders.length ? orders.map((order) => (
          <OrderCard
            key={order.id}
            order={order}
            tone={getToneForOrder(order) || tone}
            onStatusChange={onStatusChange}
            onNotesSave={onNotesSave}
            busy={busyOrderId === order.id}
          />
        )) : <EmptyState title={`No ${title.toLowerCase()} orders`} body="That bucket is clear right now." />}
      </div>
    </section>
  );
}

export default function App() {
  const { orders, loading, error, reload, setError } = useOrders();
  const { settings, save } = useSettings();
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');
  const [busyOrderId, setBusyOrderId] = useState('');
  const [manualBusy, setManualBusy] = useState(false);
  const [query, setQuery] = useState('');
  const [showDone, setShowDone] = useState(true);

  useEffect(() => {
    if (!settings) return;
    setSyncMessage(settings.lastSyncMessage || '');
  }, [settings]);

  useEffect(() => {
    if (!window.orderUrgency?.onSyncState) return undefined;

    const unsubscribe = window.orderUrgency.onSyncState(async (payload) => {
      setSyncing(payload.lastSyncStatus === 'running');
      setSyncMessage(payload.lastSyncMessage || '');
      if (payload.lastSyncStatus === 'ok') {
        await reload();
      }
    });

    return unsubscribe;
  }, [reload]);

  const filteredOrders = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return orders;
    return orders.filter((order) => {
      const haystack = [
        order.orderNumber,
        order.customerName,
        order.itemsSummary,
        order.sourcePlatform,
        order.status,
        order.notes,
      ].join(' ').toLowerCase();
      return haystack.includes(term);
    });
  }, [orders, query]);

  const grouped = useMemo(() => {
    const next = groupOrders(filteredOrders);
    if (!showDone) {
      next.done = [];
    }
    return next;
  }, [filteredOrders, showDone]);

  async function handleSync() {
    try {
      setSyncing(true);
      setSyncMessage('');
      const result = await window.orderUrgency.syncShopifyOrders();
      await reload();
      setSyncMessage(result.message || `Imported ${result.imported} Shopify orders.`);
      setError(null);
    } catch (err) {
      const message = err.message || 'Shopify sync failed';
      setSyncMessage(message);
      setError(message);
    } finally {
      setSyncing(false);
    }
  }

  async function handleManualOrderSubmit(payload) {
    try {
      setManualBusy(true);
      await window.orderUrgency.addManualOrder(payload);
      await reload();
    } finally {
      setManualBusy(false);
    }
  }

  async function handleStatusChange(orderNumber, status) {
    try {
      setBusyOrderId(orderNumber);
      await window.orderUrgency.updateOrderStatus({ orderNumber, status });
      await reload();
    } finally {
      setBusyOrderId('');
    }
  }

  async function handleNotesSave(orderNumber, notes) {
    try {
      setBusyOrderId(orderNumber);
      await window.orderUrgency.updateOrderNotes({ orderNumber, notes });
      await reload();
    } finally {
      setBusyOrderId('');
    }
  }

  const heroStats = [
    { label: 'Overdue', value: grouped.overdue.length },
    { label: 'Due soon', value: grouped.dueSoon.length },
    { label: 'Visible', value: filteredOrders.length },
  ];

  const lastSyncText = settings?.lastSyncAt ? formatTimestamp(settings.lastSyncAt) : '';

  return (
    <div className="app-shell">
      <header className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Annell App</p>
          <h1>Keep handmade orders calm, visible, and on time.</h1>
          <p className="subtext">
            A gentle urgency board for handmade shops, designed to make deadlines obvious without turning the whole room into a panic spiral.
          </p>
          <div className="hero-chips">
            <span className="hero-chip">Shopify sync</span>
            <span className="hero-chip">Desktop reminders</span>
            <span className="hero-chip">Manual backup entry</span>
            {settings?.autoSyncEnabled ? <span className="hero-chip">Auto-sync on</span> : null}
          </div>
          <div className="toolbar">
            <input
              className="toolbar__search"
              type="search"
              placeholder="Search order, customer, item, note..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <label className="toolbar__toggle">
              <input type="checkbox" checked={showDone} onChange={(event) => setShowDone(event.target.checked)} />
              <span>Show done</span>
            </label>
          </div>
          {loading ? <p className="status-note">Loading orders…</p> : null}
          {error ? <p className="status-error">{error}</p> : null}
          {!error && lastSyncText ? <p className="status-note">Last synced {lastSyncText}</p> : null}
        </div>
        <div className="hero-stats">
          {heroStats.map((stat) => (
            <div key={stat.label}>
              <strong>{stat.value}</strong>
              <span>{stat.label}</span>
            </div>
          ))}
        </div>
      </header>

      <SettingsPanel
        settings={settings}
        onSave={save}
        onSync={handleSync}
        syncing={syncing}
        syncMessage={syncMessage}
      />

      <ManualOrderForm onSubmit={handleManualOrderSubmit} busy={manualBusy} />

      <main className="board">
        <Column title="New" tone="new" orders={grouped.new} onStatusChange={handleStatusChange} onNotesSave={handleNotesSave} busyOrderId={busyOrderId} />
        <Column title="Due Soon" tone="soon" orders={grouped.dueSoon} onStatusChange={handleStatusChange} onNotesSave={handleNotesSave} busyOrderId={busyOrderId} />
        <Column title="Overdue" tone="overdue" orders={grouped.overdue} onStatusChange={handleStatusChange} onNotesSave={handleNotesSave} busyOrderId={busyOrderId} />
        {showDone ? <Column title="Done" tone="done" orders={grouped.done} onStatusChange={handleStatusChange} onNotesSave={handleNotesSave} busyOrderId={busyOrderId} /> : null}
      </main>
    </div>
  );
}
