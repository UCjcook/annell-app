import { useEffect, useState } from 'react';

export default function NotesEditor({ initialValue, onSave, disabled }) {
  const [value, setValue] = useState(initialValue || '');

  useEffect(() => {
    setValue(initialValue || '');
  }, [initialValue]);

  return (
    <div className="notes-editor">
      <textarea value={value} onChange={(event) => setValue(event.target.value)} rows={3} disabled={disabled} />
      <button className="button" type="button" onClick={() => onSave(value)} disabled={disabled}>
        Save notes
      </button>
    </div>
  );
}
