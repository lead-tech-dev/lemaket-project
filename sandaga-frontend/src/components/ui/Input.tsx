import React, { forwardRef } from 'react'

type Props = React.InputHTMLAttributes<HTMLInputElement>

export const Input = forwardRef<HTMLInputElement, Props>(function Input(props, ref) {
  return <input ref={ref} className="input" {...props} />
})
