import { useState } from 'react';

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
      daysUntilDue: Number.parseInt(form.daysUntilDue, 10) || 5,
    });
    setForm(INITIAL_FORM);
  }

  return (
    <section className="manual-order-panel">
      <div className="settings-panel__header">
        <div>
          <p className="eyebrow">Fallback entry</p>
          <h2>Add a manual order</h2>
        </div>
      </div>

      <form className="settings-form" onSubmit={handleSubmit}>
        <label>
          <span>Platform</span>
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
          <input value={form.status} onChange={(event) => updateField('status', event.target.value)} />
        </label>
        <label className="full-width">
          <span>Notes</span>
          <input value={form.notes} onChange={(event) => updateField('notes', event.target.value)} />
        </label>

        <div className="settings-actions">
          <button className="button" type="submit" disabled={busy}>{busy ? 'Adding…' : 'Add manual order'}</button>
        </div>
      </form>
    </section>
  );
}
