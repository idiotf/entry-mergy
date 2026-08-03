import { extract, type Extract as TarExtract } from 'tar-stream'
import {
  convertNodeStreamToWebStream,
  iterateWebStream,
  pipeWebStreamToNodeStream,
  takeBytesFromWebStream,
} from '@entry-mergy/stream-utils'

import type { Project } from '@entry-mergy/entry-utils/types'
import type { ImportedProject } from '@entry-mergy/project-loader-types'

const projectJSONFilename = 'temp/project.json'

async function getProjectJSON(tar: TarExtract): Promise<Project> {
  for await (const entry of tar) {
    const { header } = entry
    if (header.type != 'file' || header.name != projectJSONFilename) {
      entry.resume()
      continue
    }

    const decoderStream = new TextDecoderStream()
    const stream = convertNodeStreamToWebStream(entry)
    stream.pipeThrough(decoderStream)

    let text = ''
    for await (const chunk of iterateWebStream(decoderStream.readable)) {
      text += chunk
    }

    return JSON.parse(text)
  }

  throw TypeError('Cannot find project.json from offline file')
}

// TODO: implement extracting assets from tar
// async function* getAssets(tar: TarExtract) {
//   for await (const entry of tar) {
//     const { header } = entry
//     if (header.type != 'file' || header.name == projectJSONFilename) continue

//     yield {
//       name: header.name,
//       data: convertNodeStreamToWebStream(entry),
//     }
//   }
// }

export function importProjectFromOffline(
  data: ReadableStream<Uint8Array<ArrayBuffer>>
): ImportedProject {
  const tar = extract()
  const [dataForReadHeader, dataForExtract] = data.tee()

  takeBytesFromWebStream(dataForReadHeader, 2).then((header) => {
    if (header[0] == 0x1f && header[1] == 0x8b) {
      pipeWebStreamToNodeStream(
        dataForExtract.pipeThrough(new DecompressionStream('gzip')),
        tar
      )
    } else {
      pipeWebStreamToNodeStream(dataForExtract, tar)
    }
  })

  const project = getProjectJSON(tar).finally(abortProject)
  // TODO: implement extracting assets from tar
  // const assets = getAssets(tar)
  const assets = {
    async *[Symbol.asyncIterator]() {},
  }

  const projectController = new AbortController()
  // const assetsController = new AbortController()

  function abortProject() {
    projectController.abort()
    setIfComplete()
  }

  // function abortAssets() {
  //   assetsController.abort()
  //   setIfComplete()
  // }

  function setIfComplete() {
    if (
      projectController.signal.aborted /*&&
      assetsController.signal.aborted*/
    ) {
      tar.destroy()
    }
  }

  return {
    project,
    assets,
    cancelProject() {
      abortProject()
    },
    cancelAssets() {
      // abortAssets()
    },
  }
}
