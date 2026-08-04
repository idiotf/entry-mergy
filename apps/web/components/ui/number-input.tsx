import { useCallback, useState } from 'react'
import { Input } from './input'

export interface NumberInputProps extends React.ComponentProps<typeof Input> {
  onValueChange: (value?: number) => void
}

export function NumberInput({
  value,
  onValueChange,
  onChange,
  onFocus,
  onBlur,
  ...props
}: NumberInputProps) {
  const [blurred, setBlurred] = useState(true)
  const [controlledValue, setControlledValue] = useState(value)
  if (blurred && !Object.is(value, controlledValue)) setControlledValue(value)

  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const {
        target: { value },
      } = event
      const numberValue = value === '' ? undefined : +value
      setControlledValue(numberValue)
      onValueChange?.(numberValue)
      onChange?.(event)
    },
    [onValueChange, onChange]
  )

  const handleFocus = useCallback(
    (event: React.FocusEvent<HTMLInputElement>) => {
      setBlurred(false)
      onFocus?.(event)
    },
    [onFocus]
  )

  const handleBlur = useCallback(
    (event: React.FocusEvent<HTMLInputElement>) => {
      setBlurred(true)
      setControlledValue(value)
      onBlur?.(event)
    },
    [value, onBlur]
  )

  return (
    <Input
      type='number'
      {...props}
      value={controlledValue ?? ''}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
    />
  )
}
