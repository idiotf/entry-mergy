import { useCallback, useMemo, useRef } from 'react'

export interface KeyStore<T> {
  get(obj: T): React.Key | undefined
  set(obj: T, key: React.Key): void
}

export function useKeyManager<T>(store: KeyStore<T>) {
  const countRef = useRef(0)

  return useCallback(
    (value: T) => {
      const storedKey = store.get(value)
      if (storedKey !== undefined) return storedKey

      const createdKey = countRef.current++
      store.set(value, createdKey)
      return createdKey
    },
    [store]
  )
}

export function useKeyStore<T extends WeakKey>() {
  const store = useMemo(() => new WeakMap<T, React.Key>(), [])
  return useKeyManager(store)
}
