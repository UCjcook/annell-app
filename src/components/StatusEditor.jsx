const STATUSES = ['New', 'Printing', 'Painting', 'Packing', 'Done', 'Problem'];

export default function StatusEditor({ currentStatus, onChange, disabled }) {
  return (
    <label className="status-editor">
      <span>Status</span>
      <select value={currentStatus} onChange={(event) => onChange(event.target.value)} disabled={disabled}>
        {STATUSES.map((status) => (
          <option key={status} value={status}>
            {status}
          </option>
        ))}
      </select>
    </label>
  );
}
