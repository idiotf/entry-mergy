import { useCallback, useState } from 'react'
import { Input } from './input'

export interface NumberInputProps extends React.ComponentProps<typeof Input> {
  onValueChange: (value?: number) => void
}

export function NumberInput({
  value,
  onValueChange,
  onChange,
  onBlur,
  ...props
}: NumberInputProps) {
  const [controlledValue, setControlledValue] = useState(value)

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

  const handleBlur = useCallback(
    (event: React.FocusEvent<HTMLInputElement>) => {
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
      onBlur={handleBlur}
    />
  )
}
