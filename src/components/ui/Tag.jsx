const variants = {
  primary: 'bg-primary/10 text-primary border border-primary/20',
  surface: 'bg-surface-container text-on-surface-variant border border-outline-variant/20',
  solid: 'bg-primary text-on-primary',
};

export default function Tag({ variant = 'primary', children, className = '' }) {
  return (
    <span
      className={[
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide',
        variants[variant],
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </span>
  );
}
