import { CircleAlertIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ErrorMessageProps = React.ComponentProps<'p'>

export function ErrorMessage({
  children,
  className,
  ...props
}: ErrorMessageProps) {
  return (
    <p
      role='alert'
      {...props}
      className={cn('flex items-center gap-1 text-destructive', className)}
    >
      <CircleAlertIcon className='size-4' />
      {children}
    </p>
  )
}
