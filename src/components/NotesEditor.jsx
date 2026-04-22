import { useEffect, useState } from 'react';

export default function NotesEditor({ initialValue, onSave, disabled }) {
  const [value, setValue] = useState(initialValue || '');

  useEffect(() => {
    setValue(initialValue || '');
  }, [initialValue]);

  return (
    <div className="notes-editor">
      <label>
        <span className="notes-editor__label">Notes</span>
        <textarea value={value} onChange={(event) => setValue(event.target.value)} rows={3} disabled={disabled} placeholder="Add a quick note, customer detail, or reminder..." />
      </label>
      <button className="button" type="button" onClick={() => onSave(value)} disabled={disabled}>
        Save notes
      </button>
    </div>
  );
}
