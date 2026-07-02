const variants = {
  primary: 'btn btn-primary',
  secondary: 'btn btn-secondary',
  ghost: 'btn btn-ghost',
  danger: 'btn btn-danger',
  link: 'btn btn-link',
}

export default function Button({
  variant = 'primary',
  className = '',
  children,
  ...props
}) {
  return (
    <button type="button" className={`${variants[variant] || variants.primary} ${className}`.trim()} {...props}>
      {children}
    </button>
  )
}
