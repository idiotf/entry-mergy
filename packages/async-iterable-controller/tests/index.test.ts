import assert from 'assert'
import { describe, it } from 'node:test'
import { AsyncIterableController } from '../src'

function getControllerAndIterator<T = number>() {
  const controller = new AsyncIterableController<T>()
  const iterator = controller[Symbol.asyncIterator]()
  return { controller, iterator }
}

function assertIterateResultToYield(result: IteratorResult<unknown>, value: unknown) {
  assert.deepStrictEqual(result, {
    done: false,
    value,
  })
}

function assertIterateResultDone(result: IteratorResult<unknown>, value?: unknown) {
  assert.deepStrictEqual(result, {
    done: true,
    value,
  })
}

function assertPromiseToPending(promise: Promise<unknown>) {
  return new Promise<void>((resolve, reject) => {
    let pending = true
    promise.finally(() => (pending = false))

    setTimeout(() => {
      if (pending) resolve()
      else reject('assertPromiseToPending: promise is resolved or rejected')
    })
  })
}

describe('1. single iterator', () => {
  it('1. enqueue before iterating', async () => {
    const { controller, iterator } = getControllerAndIterator()
    controller.enqueue(1)
    controller.enqueue(2)
    controller.returnWithCache()

    assertIterateResultToYield(await iterator.next(), 1)
    assertIterateResultToYield(await iterator.next(), 2)
    assertIterateResultDone(await iterator.next())
  })

  it('2. enqueue after iterating', async () => {
    const { controller, iterator } = getControllerAndIterator()
    const promise1 = iterator.next()
    const promise2 = iterator.next()
    const promise3 = iterator.next()

    controller.enqueue(1)
    controller.enqueue(2)
    controller.returnWithCache()

    assertIterateResultToYield(await promise1, 1)
    assertIterateResultToYield(await promise2, 2)
    assertIterateResultDone(await promise3)
  })

  it('3. await enqueue after iterating', async () => {
    const { controller, iterator } = getControllerAndIterator()

    const promise1 = iterator.next()
    const promise2 = iterator.next()
    const promise3 = iterator.next()

    await controller.enqueue(1)
    await controller.enqueue(2)
    controller.returnWithCache()

    assertIterateResultToYield(await promise1, 1)
    assertIterateResultToYield(await promise2, 2)
    assertIterateResultDone(await promise3)
  })

  it('4. enqueue -> next -> next -> enqueue -> next -> returnWithCache', async () => {
    const { controller, iterator } = getControllerAndIterator()

    controller.enqueue(1)
    const promise1 = iterator.next()
    const promise2 = iterator.next()
    controller.enqueue(2)
    const promise3 = iterator.next()
    controller.returnWithCache()

    assertIterateResultToYield(await promise1, 1)
    assertIterateResultToYield(await promise2, 2)
    assertIterateResultDone(await promise3)
  })

  it('5. enqueue -> next -> next -> next -> enqueue -> returnWithCache', async () => {
    const { controller, iterator } = getControllerAndIterator()

    controller.enqueue(1)
    const promise1 = iterator.next()
    const promise2 = iterator.next()
    const promise3 = iterator.next()
    controller.enqueue(2)
    controller.returnWithCache()

    assertIterateResultToYield(await promise1, 1)
    assertIterateResultToYield(await promise2, 2)
    assertIterateResultDone(await promise3)
  })

  it('6. backpressure when enqueue', async () => {
    const { controller, iterator } = getControllerAndIterator()

    const backpressure = controller.enqueue(1)
    assertIterateResultToYield(await iterator.next(), 1)
    await assertPromiseToPending(backpressure)

    const promise2 = iterator.next()
    await backpressure
    controller.enqueue(2)
    assertIterateResultToYield(await promise2, 2)

    controller.returnWithCache()
    assertIterateResultDone(await iterator.next())
  })

  it('7. backpressure manually', async () => {
    const { controller, iterator } = getControllerAndIterator()

    const backpressure1 = controller.backpressure()
    await assertPromiseToPending(backpressure1)

    const promise1 = iterator.next()
    await backpressure1
    const backpressure2 = controller.enqueue(1)
    assertIterateResultToYield(await promise1, 1)
    await assertPromiseToPending(backpressure2)

    const promise2 = iterator.next()
    await backpressure2
    controller.enqueue(2)
    assertIterateResultToYield(await promise2, 2)

    controller.returnWithCache()
    assertIterateResultDone(await iterator.next())
  })

  it('8. return', async () => {
    const { controller, iterator } = getControllerAndIterator()

    controller.enqueue(1)
    assertIterateResultToYield(await iterator.next(), 1)
    controller.enqueue(2)
    controller.return(3)
    assertIterateResultDone(await iterator.next())
  })

  it('9. returnWithCache', async () => {
    const { controller, iterator } = getControllerAndIterator()

    controller.enqueue(1)
    assertIterateResultToYield(await iterator.next(), 1)
    controller.enqueue(2)
    controller.returnWithCache(3)
    assertIterateResultToYield(await iterator.next(), 2)
    assertIterateResultDone(await iterator.next(), 3)
  })

  it('10. backpressure before iterating', async () => {
    const { controller, iterator } = getControllerAndIterator()

    const backpressure1 = controller.backpressure()
    const backpressure2 = controller.backpressure()
    await assertPromiseToPending(backpressure1)

    const promise1 = iterator.next()
    await backpressure1
    controller.enqueue(1)
    assertIterateResultToYield(await promise1, 1)
    await assertPromiseToPending(backpressure2)

    const promise2 = iterator.next()
    await backpressure2
    controller.enqueue(2)
    assertIterateResultToYield(await promise2, 2)

    controller.returnWithCache()
    assertIterateResultDone(await iterator.next())
  })
})

describe('2. multiple iterator', () => {
  it('1. a.next -> b.next -> a.next after enqueue', async () => {
    const controller = new AsyncIterableController<number>()
    const a = controller[Symbol.asyncIterator]()
    const b = controller[Symbol.asyncIterator]()

    controller.enqueue(1)
    controller.enqueue(2)
    controller.returnWithCache()

    assertIterateResultToYield(await a.next(), 1)
    assertIterateResultToYield(await b.next(), 1)
    assertIterateResultToYield(await a.next(), 2)
  })

  it('2. a.next -> b.next -> a.next -> returnWithCache -> b.next with backpressure', async () => {
    const controller = new AsyncIterableController<number>()
    const a = controller[Symbol.asyncIterator]()
    const b = controller[Symbol.asyncIterator]()

    const backpressure1 = controller.backpressure()
    const backpressure2 = controller.backpressure()
    await assertPromiseToPending(backpressure1)

    const promiseA1 = a.next()
    await backpressure1
    controller.enqueue(1)
    assertIterateResultToYield(await promiseA1, 1)
    assertIterateResultToYield(await b.next(), 1)
    await assertPromiseToPending(backpressure2)

    const promiseA2 = a.next()
    await backpressure2
    controller.enqueue(2)
    assertIterateResultToYield(await promiseA2, 2)

    controller.returnWithCache()
    assertIterateResultToYield(await b.next(), 2)
    assertIterateResultDone(await a.next())
    assertIterateResultDone(await b.next())
  })
})
