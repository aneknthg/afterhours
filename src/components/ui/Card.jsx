const variants = {
  default:  'bg-surface-container-low/95 backdrop-blur-sm border border-outline-variant/15',
  elevated: 'bg-surface-container/80 backdrop-blur-md shadow-lg shadow-primary-container/15 border border-white/5',
  ghost:    'bg-transparent border border-outline-variant/20',
};

export default function Card({
  variant = 'default',
  hover = false,
  className = '',
  children,
  onClick,
  ...props
}) {
  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(e); } } : undefined}
      className={[
        'rounded-xl overflow-hidden text-left',
        variants[variant],
        hover ? 'transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-glow cursor-pointer' : '',
        onClick ? 'cursor-pointer w-full' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    >
      {children}
    </div>
  );
}
