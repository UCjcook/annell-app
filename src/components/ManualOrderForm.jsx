import { useState } from 'react';

const STATUSES = ['New', 'Printing', 'Painting', 'Packing', 'Done', 'Problem'];

const INITIAL_FORM = {
  sourcePlatform: 'Manual',
  orderNumber: '',
  customerName: '',
  itemsSummary: '',
  daysUntilDue: '5',
  status: 'New',
  notes: '',
};

export default function ManualOrderForm({ onSubmit, busy }) {
  const [form, setForm] = useState(INITIAL_FORM);

  function updateField(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    await onSubmit({
      ...form,
      orderNumber: form.orderNumber.trim(),
      customerName: form.customerName.trim(),
      itemsSummary: form.itemsSummary.trim(),
      notes: form.notes.trim(),
      daysUntilDue: Math.max(0, Number.parseInt(form.daysUntilDue, 10) || 5),
    });
    setForm(INITIAL_FORM);
  }

  return (
    <section className="manual-order-panel">
      <div className="settings-panel__header">
        <div>
          <p className="eyebrow">Backup option</p>
          <h2>Add an order by hand</h2>
          <p className="settings-panel__subtext">Use this if an order needs to be tracked before it shows up automatically.</p>
        </div>
      </div>

      <form className="settings-form" onSubmit={handleSubmit}>
        <label>
          <span>Store</span>
          <input value={form.sourcePlatform} onChange={(event) => updateField('sourcePlatform', event.target.value)} />
        </label>
        <label>
          <span>Order number</span>
          <input value={form.orderNumber} onChange={(event) => updateField('orderNumber', event.target.value)} required />
        </label>
        <label>
          <span>Customer</span>
          <input value={form.customerName} onChange={(event) => updateField('customerName', event.target.value)} required />
        </label>
        <label>
          <span>Items</span>
          <input value={form.itemsSummary} onChange={(event) => updateField('itemsSummary', event.target.value)} required />
        </label>
        <label>
          <span>Days until due</span>
          <input type="number" min="0" max="30" value={form.daysUntilDue} onChange={(event) => updateField('daysUntilDue', event.target.value)} />
        </label>
        <label>
          <span>Status</span>
          <select value={form.status} onChange={(event) => updateField('status', event.target.value)}>
            {STATUSES.map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
        </label>
        <label className="full-width">
          <span>Notes</span>
          <textarea value={form.notes} onChange={(event) => updateField('notes', event.target.value)} rows={3} />
        </label>

        <div className="settings-actions">
          <button className="button" type="submit" disabled={busy}>{busy ? 'Adding…' : 'Add order'}</button>
        </div>
      </form>
    </section>
  );
}
