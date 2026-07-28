import { cn } from '@/lib/utils'
import { Button } from './button'
import { Spinner } from './spinner'

export interface LoadableButtonProps extends React.ComponentProps<
  typeof Button
> {
  loading?: boolean
}

export function LoadableButton({
  loading,
  disabled,
  className,
  children,
  ...props
}: LoadableButtonProps) {
  return (
    <Button
      {...props}
      disabled={disabled || loading}
      className={cn('relative', className)}
    >
      <span className={`transition-opacity ${loading ? 'opacity-0' : ''}`}>
        {children}
      </span>
      <div
        className={`absolute inset-0 transition-opacity ${loading ? '' : 'opacity-0'}`}
      >
        <Spinner className='absolute inset-0 m-auto' aria-hidden={!loading} />
      </div>
    </Button>
  )
}
