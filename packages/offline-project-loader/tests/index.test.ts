import fs from 'fs'
import path from 'path'
import assert from 'assert'
import { describe, it } from 'node:test'
import { convertNodeStreamToWebStream } from '@entry-mergy/stream-utils'

import { importProjectFromOffline } from '../src'

const filePath = (src: string) => path.join(import.meta.dirname, src)
const readFileStream = (src: string) =>
  convertNodeStreamToWebStream(fs.createReadStream(src))

const correctFile = fs.promises
  .readFile(filePath('project.json'), 'utf-8')
  .then(JSON.parse)

async function expectToBeImported(name: string) {
  const srcFile = readFileStream(filePath(name + '.ent'))
  const { project, assets } = importProjectFromOffline(srcFile)

  assert.deepStrictEqual(await project, await correctFile)
  return { project, assets }
}

async function decode(stream: ReadableStream<Uint8Array<ArrayBuffer>>) {
  const decodedStream = stream.pipeThrough(new TextDecoderStream())
  const reader = decodedStream.getReader()

  let data = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    data += value
  }

  return data
}

describe('Importing offline project', () => {
  it('Extracting json', async () => {
    await expectToBeImported('json')
  })

  it('Extracting json (gzip)', async () => {
    await expectToBeImported('gzip-json')
  })

  it('Extracting assets', async () => {
    const { assets } = await expectToBeImported('assets')
    assert(assets !== undefined)

    const awaitedAssets = await Array.fromAsync(assets)
    const assetsMap = new Map(awaitedAssets.map((v) => [v.name, v.data]))

    const beforeProjectJson = assetsMap.get(
      'temp/fa/ke/fakeassetfilebeforeprojectjson.png'
    )
    const afterProjectJson = assetsMap.get(
      'temp/fa/ke/fakeassetfileafterprojectjson.png'
    )
    assert(beforeProjectJson !== undefined)
    assert(afterProjectJson !== undefined)

    assert.strictEqual(await decode(beforeProjectJson), 'before project.json')
    assert.strictEqual(await decode(afterProjectJson), 'after project.json')
  })
})
