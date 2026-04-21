import { useMemo, useState } from 'react';
import EmptyState from './components/EmptyState';
import ManualOrderForm from './components/ManualOrderForm';
import NotesEditor from './components/NotesEditor';
import SettingsPanel from './components/SettingsPanel';
import StatusEditor from './components/StatusEditor';
import { useOrders } from './hooks/useOrders';
import { useSettings } from './hooks/useSettings';
import { groupOrders } from './lib/groupOrders';
import { formatRelativeUrgency, formatShortDate } from './lib/formatting';
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
  const { orders, loading, error, reload } = useOrders();
  const { settings, save } = useSettings();
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');
  const [lastSyncAt, setLastSyncAt] = useState('');
  const [busyOrderId, setBusyOrderId] = useState('');
  const [manualBusy, setManualBusy] = useState(false);

  const grouped = useMemo(() => groupOrders(orders), [orders]);

  async function handleSync() {
    try {
      setSyncing(true);
      setSyncMessage('');
      const result = await window.orderUrgency.syncShopifyOrders();
      await reload();
      setLastSyncAt(new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }));
      setSyncMessage(`Imported ${result.imported} Shopify orders.`);
    } catch (err) {
      setSyncMessage(err.message || 'Shopify sync failed');
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
    { label: 'New', value: grouped.new.length },
  ];

  return (
    <div className="app-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">Order Urgency App v1</p>
          <h1>Deadlines that are visible enough to matter.</h1>
          <p className="subtext">
            A Windows-first urgency board for handmade sellers, built to keep Shopify and Etsy orders from quietly drifting into disaster.
          </p>
          {loading ? <p className="status-note">Loading orders…</p> : null}
          {error ? <p className="status-error">{error}</p> : null}
          {!error && lastSyncAt ? <p className="status-note">Last synced at {lastSyncAt}</p> : null}
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
        <Column title="Done" tone="done" orders={grouped.done} onStatusChange={handleStatusChange} onNotesSave={handleNotesSave} busyOrderId={busyOrderId} />
      </main>
    </div>
  );
}
