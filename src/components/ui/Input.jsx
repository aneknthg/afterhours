export default function Input({
  label,
  hint,
  error,
  icon,
  className = '',
  textarea,
  rows = 3,
  ...props
}) {
  const base =
    'w-full bg-background border rounded-xl px-4 py-3 text-on-surface text-[16px] md:text-sm font-body outline-none transition-colors placeholder:text-on-surface-variant/40 focus:border-primary/50';
  const borderColor = error ? 'border-error/50' : 'border-outline-variant/30';

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">
          {label}
        </label>
      )}
      <div className="relative">
        {icon && (
          <span
            className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none"
            style={{ fontSize: 16 }}
          >
            {icon}
          </span>
        )}
        {textarea ? (
          <textarea
            rows={rows}
            className={`${base} ${borderColor} resize-none ${icon ? 'pl-9' : ''}`}
            {...props}
          />
        ) : (
          <input
            className={`${base} ${borderColor} ${icon ? 'pl-9' : ''}`}
            {...props}
          />
        )}
      </div>
      {hint && !error && (
        <p className="text-xs text-on-surface-variant/60">{hint}</p>
      )}
      {error && <p className="text-xs text-error">{error}</p>}
    </div>
  );
}
