import Tar from 'tar-js'
import type { EntryObject, Project } from '@entry-mergy/entry-utils/types'

function encodeUtf8(str: string) {
  return new TextEncoder().encode(str)
}

function exportProjectToTar(
  project: Project,
  assets?: Map<string, Uint8Array>
) {
  const tar = new Tar()
  tar.append('temp/project.json', encodeUtf8(JSON.stringify(project)))
  if (assets) {
    for (const [path, data] of assets) tar.append(path, data)
  }
  return tar.out as Uint8Array<ArrayBuffer>
}

export function normalizeAssetPathToOffline(project: Project) {
  for (const obj of project.objects) {
    for (const picture of obj.sprite.pictures) {
      if (!('filename' in picture && typeof picture.filename == 'string'))
        continue

      const name = picture.filename
      const imageType = 'imageType' in picture ? picture.imageType : 'png'

      ;(picture as Record<string, unknown>).fileurl ||=
        `temp/${name.substring(0, 2)}/${name.substring(2, 4)}/image/${name}.${imageType}`
    }
  }
}

function gzipUint8ArrayToStream(arr: Uint8Array<ArrayBuffer>) {
  const gzipStream = new CompressionStream('gzip')
  const writer = gzipStream.writable.getWriter()
  writer.write(arr)
  writer.close()
  return gzipStream.readable
}

export function exportProjectToOffline(
  project: Project,
  assets?: Map<string, Uint8Array>,
  gzip?: boolean
) {
  const projectCopy: Project = {
    ...project,
    objects: project.objects.map((obj): EntryObject => ({
      ...obj,
      sprite: {
        ...obj.sprite,
        pictures: obj.sprite.pictures.map((picture) => ({ ...picture })),
        sounds: obj.sprite.sounds.map((sound) => ({ ...sound })),
      },
    })),
  }
  normalizeAssetPathToOffline(projectCopy)

  const tar = exportProjectToTar(projectCopy, assets)

  if (gzip) {
    return gzipUint8ArrayToStream(tar)
  } else {
    return new ReadableStream<Uint8Array<ArrayBuffer>>({
      start(controller) {
        controller.enqueue(tar)
        controller.close()
      },
    })
  }
}
