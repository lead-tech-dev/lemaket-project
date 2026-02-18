import type { ButtonHTMLAttributes, FC } from 'react'

type ButtonVariant = 'primary' | 'ghost' | 'accent' | 'outline' | 'danger'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }

export const Button: FC<Props> = ({ variant = 'primary', className = '', ...props }) => {
  return <button className={`btn btn--${variant} ${className}`.trim()} {...props} />
}
