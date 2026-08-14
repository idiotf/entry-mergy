import { extract, type Extract as TarExtract } from 'tar-stream'
import { LoaderProject } from '@entry-mergy/project-loader-base'
import {
  convertNodeStreamToWebStream,
  pipeWebStreamToNodeStream,
  takeBytesFromWebStream,
} from '@entry-mergy/stream-utils'

class OfflineProject extends LoaderProject {
  private constructor(private tar: TarExtract) {
    super()
  }

  static fromWebStream(stream: ReadableStream<Uint8Array<ArrayBuffer>>) {
    const tar = extract()
    const project = new this(tar)

    tar.on('entry', (header, stream, next) => {
      if (header.type != 'file') return next()

      if (header.name == 'temp/project.json') {
        project.resolveProject(
          new Response(convertNodeStreamToWebStream(stream)).json()
        )
        project.backpressureAssets().then(next)
      } else {
        const backpressure = project.queueAsset({
          name: header.name,
          data: convertNodeStreamToWebStream(stream),
        })
        if (project.projectDone) backpressure.then(next)
        else next()
      }
    })

    tar.on('finish', () => {
      project.finish()
    })

    const [dataForReadHeader, dataForExtract] = stream.tee()
    takeBytesFromWebStream(dataForReadHeader, 2).then((bytes) => {
      if (bytes[0] == 0x1f && bytes[1] == 0x8b) {
        pipeWebStreamToNodeStream(
          dataForExtract.pipeThrough(new DecompressionStream('gzip')),
          tar
        )
      } else {
        pipeWebStreamToNodeStream(dataForExtract, tar)
      }
    })

    return project
  }

  protected override handleCancelProject() {}
  protected override handleCancelAssets() {}
  protected override handleTerminate() {
    this.tar.destroy()
  }
}

export function importProjectFromOffline(
  stream: ReadableStream<Uint8Array<ArrayBuffer>>
) {
  return OfflineProject.fromWebStream(stream)
}
