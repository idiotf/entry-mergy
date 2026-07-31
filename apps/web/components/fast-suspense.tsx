import { useLayoutEffect, useState } from 'react'

interface PendingPromiseState {
  status: 'pending'
}

interface FulfilledPromiseState<T> {
  status: 'fulfilled'
  value: T
}

interface RejectedPromiseState {
  status: 'rejected'
  reason: unknown
}

type PromiseState<T> =
  PendingPromiseState | FulfilledPromiseState<T> | RejectedPromiseState

export interface FastSuspenseProps extends React.PropsWithChildren {
  fallback: React.ReactNode
}

export function FastSuspense({ children, fallback }: FastSuspenseProps) {
  const [promiseState, setPromiseState] = useState<
    PromiseState<React.ReactNode>
  >({ status: 'pending' })

  const [prevChildren, setPrevChildren] = useState(children)
  if (!Object.is(children, prevChildren)) {
    setPrevChildren(children)
    setPromiseState({ status: 'pending' })
  }

  useLayoutEffect(() => {
    if (!(children instanceof Promise)) return

    let mounted = true
    children.then(
      (value) => mounted && setPromiseState({ status: 'fulfilled', value }),
      (reason) => mounted && setPromiseState({ status: 'rejected', reason })
    )

    return () => {
      mounted = false
    }
  }, [children])

  if (!(children instanceof Promise)) return children
  if (promiseState.status == 'rejected') throw promiseState.reason
  return promiseState.status == 'fulfilled' ? promiseState.value : fallback
}
