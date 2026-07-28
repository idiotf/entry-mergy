const resolveLater = <T, Args extends unknown[]>(
  callback: (...args: Args) => Promise<T>,
  ...args: Args
) =>
  new Promise<T>((resolve) =>
    setTimeout(() => resolve(callback(...args)), 1500)
  )

export const retry = <T, Args extends unknown[]>(
  callback: (...args: Args) => Promise<T>,
  fallback = resolveLater<T, Args>
) =>
  function step(...args: Args): Promise<T> {
    return callback(...args).catch(() => fallback(step, ...args))
  }
