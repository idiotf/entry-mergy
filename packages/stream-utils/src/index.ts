import type { Readable, Writable } from 'stream'

export function pipeWebStreamToNodeStream<T>(
  src: ReadableStream<T>,
  dst: Writable
) {
  const reader = src.getReader()

  function pipeItem() {
    reader.read().then((v) => {
      if (v.done) return dst.end()
      dst.write(v.value)
      pipeItem()
    })
  }

  pipeItem()
}

export function convertNodeStreamToWebStream(src: Readable) {
  return new ReadableStream({
    start(controller) {
      src.on('data', (chunk) => controller.enqueue(chunk))
      src.on('end', () => controller.close())
      src.on('error', (e) => controller.error(e))
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
