const variants = {
  primary:
    'bg-primary text-on-primary hover:brightness-110 active:scale-[0.97] shadow-glow',
  secondary:
    'bg-surface-container border border-primary/30 text-primary hover:bg-surface-container-high active:scale-[0.97]',
  ghost:
    'bg-transparent text-on-surface-variant hover:text-on-surface hover:bg-surface-container active:scale-[0.97]',
};

const sizes = {
  sm: 'px-4 py-3.5 text-xs rounded-xl gap-1.5',
  md: 'px-6 py-3 text-sm rounded-xl gap-2',
  lg: 'px-8 py-4 text-base rounded-xl gap-2',
};

export default function Button({
  variant = 'primary',
  size = 'md',
  icon,
  iconAfter,
  children,
  className = '',
  disabled,
  fullWidth,
  ...props
}) {
  return (
    <button
      disabled={disabled}
      className={[
        'inline-flex items-center justify-center font-bold uppercase tracking-wide transition-all',
        variants[variant],
        sizes[size],
        fullWidth ? 'w-full' : '',
        disabled ? 'opacity-40 cursor-not-allowed pointer-events-none' : 'cursor-pointer',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    >
      {icon && (
        <span className="material-symbols-outlined leading-none" style={{ fontSize: size === 'sm' ? 14 : size === 'lg' ? 22 : 18 }}>
          {icon}
        </span>
      )}
      {children}
      {iconAfter && (
        <span className="material-symbols-outlined leading-none" style={{ fontSize: size === 'sm' ? 14 : size === 'lg' ? 22 : 18 }}>
          {iconAfter}
        </span>
      )}
    </button>
  );
}
