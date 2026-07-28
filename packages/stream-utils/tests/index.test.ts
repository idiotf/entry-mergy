import assert from 'assert'
import { it } from 'node:test'
import { Readable, Writable } from 'stream'
import {
  convertNodeStreamToWebStream,
  iterateWebStream,
  pipeWebStreamToNodeStream,
  takeBytesFromWebStream,
} from '../src'

it('convertNodeStreamToWebStream', async () => {
  const nodeStream = new Readable({ read() {} })
  nodeStream.push(Buffer.from([0x01]))
  nodeStream.push(Buffer.from([0x02]))
  nodeStream.push(Buffer.from([0x03]))
  nodeStream.push(null)

  const webStream = convertNodeStreamToWebStream(nodeStream)
  const reader = webStream.getReader()

  assert.deepStrictEqual(await reader.read(), {
    done: false,
    value: Buffer.from([0x01]),
  })
  assert.deepStrictEqual(await reader.read(), {
    done: false,
    value: Buffer.from([0x02]),
  })
  assert.deepStrictEqual(await reader.read(), {
    done: false,
    value: Buffer.from([0x03]),
  })
  assert.deepStrictEqual(await reader.read(), {
    done: true,
    value: undefined,
  })
})

it('pipeWebStreamToNodeStream', async () => {
  const webStream = new ReadableStream({
    start(controller) {
      controller.enqueue(Buffer.from([0x01]))
      controller.enqueue(Buffer.from([0x02]))
      controller.enqueue(Buffer.from([0x03]))
      controller.close()
    },
  })

  const nodeStream = new Writable()
  let i = 0
  nodeStream._write = (chunk, _encoding, callback) => {
    assert.deepStrictEqual(chunk, Buffer.from([++i]))
    callback()
  }

  pipeWebStreamToNodeStream(webStream, nodeStream)
  await new Promise((resolve) => nodeStream.on('finish', resolve))
  assert.strictEqual(i, 3)
})

it('iterateWebStream', async () => {
  const webStream = new ReadableStream({
    start(controller) {
      controller.enqueue(1)
      controller.enqueue(2)
      controller.enqueue(3)
      controller.close()
    },
  })

  let i = 0
  for await (const value of iterateWebStream(webStream)) {
    assert.deepStrictEqual(value, ++i)
  }
  assert.strictEqual(i, 3)
})

it('takeBytesFromWebStream', async () => {
  async function testTaking(limit: number, expected: Uint8Array) {
    const webStream = new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array([0x00, 0x01]))
        controller.enqueue(new Uint8Array([0x02, 0x03, 0x04]))
        controller.enqueue(new Uint8Array([0x05]))
        controller.close()
      },
    })

    const bytes = takeBytesFromWebStream(webStream, limit)
    assert.deepStrictEqual(await bytes, expected)
  }

  await testTaking(0, new Uint8Array())
  await testTaking(1, new Uint8Array([0x00]))
  await testTaking(2, new Uint8Array([0x00, 0x01]))
  await testTaking(3, new Uint8Array([0x00, 0x01, 0x02]))
  await testTaking(4, new Uint8Array([0x00, 0x01, 0x02, 0x03]))
  await testTaking(5, new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04]))
  await testTaking(6, new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04, 0x05]))
  await testTaking(7, new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04, 0x05]))
})
