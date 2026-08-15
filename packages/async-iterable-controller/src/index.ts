import FIFO from 'fast-fifo'

function doneWithoutValue() {
  return {
    done: true,
    value: undefined,
  } as IteratorReturnResult<never>
}

class AsyncIterableControllerIterator<
  T,
  TReturn = unknown,
  TNext = unknown,
> implements AsyncIterableIterator<T, TReturn, TNext> {
  private iteratingIndex = 0
  private done = false

  constructor(private parent: AsyncIterableController<T, TReturn, TNext>) {}

  async next(): Promise<IteratorResult<T, TReturn>> {
    if (this.done) return doneWithoutValue()

    const state = this.parent['internalState']
    if (
      state.state == 'suspended' ||
      state.state == 'returned-with-cache' ||
      state.state == 'thrown-with-cache'
    ) {
      const currentIteratingIndex = this.iteratingIndex++
      if (currentIteratingIndex < state.cache.length) {
        this.parent['shiftBackpressureQueue'](currentIteratingIndex)?.()
        return {
          done: false,
          value: await state.cache[currentIteratingIndex]!,
        }
      } else if (state.state == 'suspended') {
        return new Promise((resolve) => {
          this.parent['subscribeIterating'](currentIteratingIndex, resolve)
        })
      } else {
        this.done = true
        if (state.state == 'returned-with-cache') {
          return {
            done: true,
            value: state.value,
          }
        } else {
          throw state.reason
        }
      }
    } else {
      return doneWithoutValue()
    }
  }

  async return(value: TReturn): Promise<IteratorReturnResult<TReturn>> {
    this.done = true
    return {
      done: true,
      value,
    }
  }

  async throw(e?: unknown): Promise<never> {
    this.done = true
    throw e
  }

  [Symbol.asyncIterator]() {
    return this
  }
}

interface SuspendedState<T> {
  state: 'suspended'
  cache: (T | PromiseLike<T>)[]
}

interface ReturnedWithCacheState<T, TReturn> {
  state: 'returned-with-cache'
  cache: (T | PromiseLike<T>)[]
  value: TReturn
}

interface ReturnedState<TReturn> {
  state: 'returned'
  value: TReturn
}

interface ThrownWithCacheState<T> {
  state: 'thrown-with-cache'
  cache: (T | PromiseLike<T>)[]
  reason: unknown
}

interface ThrownState {
  state: 'thrown'
  reason: unknown
}

type IterableControllerState<T, TReturn> =
  | SuspendedState<T>
  | ReturnedWithCacheState<T, TReturn>
  | ReturnedState<TReturn>
  | ThrownWithCacheState<T>
  | ThrownState

type MaybePromiseLike<T> = T | PromiseLike<T>

type AsyncIteratingCallback<T, TReturn> =
  (result: MaybePromiseLike<IteratorResult<T, TReturn>>) => void

export class AsyncIterableController<
  T,
  TReturn = unknown,
  TNext = unknown,
> implements AsyncIterable<T, TReturn, TNext> {
  private backpressureQueue = new FIFO<(() => void) | null>()
  private backpressureLength = 0
  private recentBackpressure?: Promise<void>

  private currentSubQueuesIndex = 0
  private subQueues: (FIFO<AsyncIteratingCallback<T, TReturn>> | null)[] = []

  protected internalState: IterableControllerState<T, TReturn> = {
    state: 'suspended',
    cache: [],
  }

  private get backpressureOffset() {
    return this.backpressureLength - this.backpressureQueue.length
  }

  protected shiftBackpressureQueue(index?: number) {
    if (typeof index == 'number' && index < this.backpressureOffset) return
    return this.backpressureQueue.shift()
  }

  protected subscribeIterating(
    iteratingIdx: number,
    callback: AsyncIteratingCallback<T, TReturn>
  ) {
    if (iteratingIdx >= this.subQueues.length) {
      const queue = new FIFO<AsyncIteratingCallback<T, TReturn>>()
      queue.push(callback)
      this.subQueues.push(queue)

      const backpressureCallback = this.shiftBackpressureQueue()
      backpressureCallback?.()
    } else {
      this.subQueues[iteratingIdx]!.push(callback)
    }
  }

  private resolveIteratorResult(result: MaybePromiseLike<IteratorResult<T, TReturn>>) {
    const fifo = this.subQueues[this.currentSubQueuesIndex]
    if (fifo) {
      while (!fifo.isEmpty()) fifo.shift()!(result)
    }
  }

  private resolveRestSubQueue(result: MaybePromiseLike<IteratorReturnResult<TReturn>>) {
    this.resolveIteratorResult(result)
    while (++this.currentSubQueuesIndex < this.subQueues.length) {
      this.resolveIteratorResult(doneWithoutValue())
    }
    this.subQueues.length = 0
  }

  get state() {
    switch (this.internalState.state) {
      case 'suspended':
        return 'suspended'

      case 'returned-with-cache':
      case 'returned':
        return 'returned'

      case 'thrown':
      case 'thrown-with-cache':
        return 'thrown'
    }
  }

  async enqueue(value: T | PromiseLike<T>) {
    if (this.internalState.state != 'suspended') return

    this.internalState.cache.push(value)
    if (this.currentSubQueuesIndex >= this.subQueues.length) {
      this.subQueues.push(null)
    } else {
      this.resolveIteratorResult(
        Promise.resolve(value).then((value) => ({
          done: false,
          value,
        }))
      )
      this.subQueues[this.currentSubQueuesIndex] = null
    }

    ++this.currentSubQueuesIndex
    if (this.backpressureLength == 0) this.backpressure()
    return this.backpressure()
  }

  backpressure() {
    return this.recentBackpressure = new Promise<void>((resolve) => {
      if (this.subQueues.length > this.backpressureLength++) {
        this.backpressureQueue.push(null)
        resolve()
      } else {
        this.backpressureQueue.push(resolve)
      }
    })
  }

  getRecentBackpressure() {
    return this.recentBackpressure
  }

  getOrCreateBackpressure() {
    return this.recentBackpressure || this.backpressure()
  }

  return(): void
  return(value: TReturn): void
  return(...[value]: undefined extends TReturn ? [TReturn | undefined] : [TReturn]) {
    this.internalState = {
      state: 'returned',
      value,
    }
    this.resolveRestSubQueue({
      done: true,
      value,
    })
  }

  returnWithCache(): void
  returnWithCache(value: TReturn): void
  returnWithCache(...[value]: undefined extends TReturn ? [TReturn | undefined] : [TReturn]) {
    if (this.internalState.state != 'suspended') return

    this.internalState = {
      ...this.internalState,
      state: 'returned-with-cache',
      value,
    }
    this.resolveRestSubQueue({
      done: true,
      value,
    })
  }

  throw(reason?: unknown) {
    this.internalState = {
      state: 'thrown',
      reason,
    }
    this.resolveRestSubQueue(Promise.reject(reason))
  }

  throwWithCache(reason?: unknown) {
    if (this.internalState.state != 'suspended') return

    this.internalState = {
      ...this.internalState,
      state: 'thrown-with-cache',
      reason,
    }
    this.resolveRestSubQueue(Promise.reject(reason))
  }

  [Symbol.asyncIterator]() {
    return new AsyncIterableControllerIterator(this)
  }
}
