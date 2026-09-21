export function Field({
  label,
  name,
  type = 'text',
  defaultValue = '',
  required = true,
  inputMode,
  autoComplete,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string;
  required?: boolean;
  inputMode?: 'none' | 'text' | 'tel' | 'url' | 'email' | 'numeric' | 'decimal' | 'search';
  autoComplete?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        name={name}
        type={type}
        inputMode={inputMode}
        autoComplete={autoComplete}
        defaultValue={defaultValue}
        required={required}
      />
    </label>
  );
}

export type Status = { kind: 'idle' | 'pending' | 'success' | 'error'; message?: string };

export function StatusLine({ status }: { status: Status }) {
  return status.kind === 'idle' ? null : (
    <p className={`status ${status.kind}`} role={status.kind === 'error' ? 'alert' : 'status'}>
      {status.message}
    </p>
  );
}
