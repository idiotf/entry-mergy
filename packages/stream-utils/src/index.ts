import { once } from 'node:events'
import type { Readable, Writable } from 'stream'

function asError(e: unknown) {
  return e instanceof Error ? e : Error(String(e))
}

export async function pipeWebStreamToNodeStream<T>(
  src: ReadableStream<T>,
  dst: Writable
) {
  const reader = src.getReader()

  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) {
        dst.end()
        return
      }

      if (!dst.write(value)) {
        await once(dst, 'drain')
      }
    }
  } catch (e) {
    reader.cancel(e).catch(() => {})
    dst.destroy(asError(e))
    throw e
  } finally {
    reader.releaseLock()
  }
}

interface NodeToWebStreamOptions {
  autoDrain?: boolean
}

export function convertNodeStreamToWebStream(
  src: Readable,
  options: NodeToWebStreamOptions = {}
) {
  const { autoDrain = false } = options

  return new ReadableStream({
    start(controller) {
      function onData(chunk: Uint8Array) {
        controller.enqueue(chunk)

        if (
          !autoDrain &&
          controller.desiredSize !== null &&
          controller.desiredSize <= 0
        ) {
          src.pause()
        }
      }

      function onEnd() {
        cleanup()
        controller.close()
      }

      function onError(e: Error) {
        cleanup()
        controller.error(e)
      }

      function cleanup() {
        src.off('data', onData)
        src.off('end', onEnd)
        src.off('error', onError)
      }

      src.on('data', onData)
      src.once('end', onEnd)
      src.once('error', onError)

      if (autoDrain) src.resume()
      else src.pause()
    },

    pull() {
      src.resume()
    },

    cancel(reason) {
      src.destroy(asError(reason))
    },
  })
}

export async function* iterateWebStream<T>(stream: ReadableStream<T>) {
  const reader = stream.getReader()
  for (;;) {
    const { done, value } = await reader.read()
    if (done) return
    yield value
  }
}

export async function takeBytesFromWebStream(
  stream: ReadableStream<Uint8Array<ArrayBuffer>>,
  limit: number
) {
  let data = new Uint8Array()
  const reader = stream.getReader()

  for (;;) {
    const { done, value } = await reader.read()
    if (done) return data

    const prevData = data
    const len = Math.min(limit, prevData.length + value.length)
    if (len != prevData.length) {
      data = new Uint8Array(len)
      data.set(prevData, 0)
      data.set(value.subarray(0, len - prevData.length), prevData.length)
    }

    if (len == limit) return data
  }
}

export function promiseStreamToStream<T>(
  streamPromise: Promise<ReadableStream<T>>
) {
  const readerPromise = streamPromise.then((stream) => stream.getReader())

  return new ReadableStream<T>({
    start(controller) {
      readerPromise.catch((reason) => controller.error(reason))
    },
    async pull(controller) {
      try {
        const reader = await readerPromise
        const data = await reader.read()
        if (data.done) controller.close()
        else controller.enqueue(data.value)
      } catch (e) {
        controller.error(e)
      }
    },
    async cancel(reason) {
      try {
        const reader = await readerPromise
        return reader.cancel(reason)
      } catch {
        // The underlying stream may not be available.
        // Cancellation does not need to propagate this error.
      }
    },
  })
}
