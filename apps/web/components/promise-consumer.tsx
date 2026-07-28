import { use } from 'react'

export interface PromiseConsumerProps<T> {
  value: Promise<T>
  children: (awaited: T) => React.ReactNode
}

export function PromiseConsumer<T>({
  value,
  children,
}: PromiseConsumerProps<T>) {
  const awaited = use(value)
  return children(awaited)
}
