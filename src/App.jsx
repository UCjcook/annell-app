import { useMemo, useState } from 'react';
import SettingsPanel from './components/SettingsPanel';
import StatusEditor from './components/StatusEditor';
import { useOrders } from './hooks/useOrders';
import { useSettings } from './hooks/useSettings';
import { groupOrders } from './lib/groupOrders';
import { getToneForOrder } from './lib/statusTone';

function OrderCard({ order, tone, onStatusChange, busy }) {
  return (
    <div className={`order-card tone-${tone}`}>
      <div className="order-card__top">
        <span className={`badge badge-${order.source.toLowerCase()}`}>{order.source}</span>
        <span className="order-id">{order.id}</span>
      </div>
      <h3>{order.item}</h3>
      <p className="customer">{order.customer}</p>
      <div className="meta-row">
        <span>{order.shipBy}</span>
        <span>{order.daysLeft < 0 ? `${Math.abs(order.daysLeft)} late` : `${order.daysLeft} left`}</span>
      </div>
      <StatusEditor currentStatus={order.status} onChange={(value) => onStatusChange(order.id, value)} disabled={busy} />
      {order.notes ? <p className="card-notes">{order.notes}</p> : null}
    </div>
  );
}

function Column({ title, tone, orders, onStatusChange, busyOrderId }) {
  return (
    <section className="column">
      <div className="column__header">
        <h2>{title}</h2>
        <span>{orders.length}</span>
      </div>
      <div className="column__body">
        {orders.map((order) => (
          <OrderCard
            key={order.id}
            order={order}
            tone={getToneForOrder(order) || tone}
            onStatusChange={onStatusChange}
            busy={busyOrderId === order.id}
          />
        ))}
      </div>
    </section>
  );
}

export default function App() {
  const { orders, loading, error, reload } = useOrders();
  const { settings, save } = useSettings();
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');
  const [busyOrderId, setBusyOrderId] = useState('');

  const grouped = useMemo(() => groupOrders(orders), [orders]);

  async function handleSync() {
    try {
      setSyncing(true);
      setSyncMessage('');
      const result = await window.orderUrgency.syncShopifyOrders();
      await reload();
      setSyncMessage(`Imported ${result.imported} Shopify orders.`);
    } catch (err) {
      setSyncMessage(err.message || 'Shopify sync failed');
    } finally {
      setSyncing(false);
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

      <main className="board">
        <Column title="New" tone="new" orders={grouped.new} onStatusChange={handleStatusChange} busyOrderId={busyOrderId} />
        <Column title="Due Soon" tone="soon" orders={grouped.dueSoon} onStatusChange={handleStatusChange} busyOrderId={busyOrderId} />
        <Column title="Overdue" tone="overdue" orders={grouped.overdue} onStatusChange={handleStatusChange} busyOrderId={busyOrderId} />
        <Column title="Done" tone="done" orders={grouped.done} onStatusChange={handleStatusChange} busyOrderId={busyOrderId} />
      </main>
    </div>
  );
}
