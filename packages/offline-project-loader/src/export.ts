// TODO: use tar-stream instead of tar-js

import Tar from 'tar-js'
import { generateHash } from '@entry-mergy/common-utils'
import type { Asset } from '@entry-mergy/project-loader-types'
import type { EntryObject, Project } from '@entry-mergy/entry-utils/types'

function encodeUtf8(str: string) {
  return new TextEncoder().encode(str)
}

function streamToUint8Array(stream: ReadableStream<Uint8Array<ArrayBuffer>>) {
  return new Response(stream).bytes()
}

async function exportProjectToTar(
  project: Project,
  assets?: AsyncIterable<Asset>
) {
  const tar = new Tar()

  tar.append('temp/project.json', encodeUtf8(JSON.stringify(project)))
  if (assets) {
    for await (const { name, data } of assets) {
      tar.append(name, await streamToUint8Array(data))
    }
  }

  return tar.out as Uint8Array<ArrayBuffer>
}

export function getImageFileurlFrom(filename: string, imageType: string) {
  return `temp/${filename.substring(0, 2)}/${filename.substring(2, 4)}/image/${filename}.${imageType}`
}

export function getSoundFileurlFrom(filename: string, ext: string) {
  return `temp/${filename.substring(0, 2)}/${filename.substring(2, 4)}/${filename}${ext}`
}

export function getUniqueFilename() {
  return generateHash(32)
}

export function normalizeAssetPathToOffline(project: Project) {
  for (const obj of project.objects) {
    for (const picture of obj.sprite.pictures) {
      if (!('filename' in picture && typeof picture.filename == 'string'))
        continue

      const name = picture.filename
      const imageType =
        'imageType' in picture ? String(picture.imageType) : 'png'

      ;(picture as Record<string, unknown>).fileurl ||= getImageFileurlFrom(
        name,
        imageType
      )
    }
  }
}

function gzipUint8ArrayToStream(arr: Promise<Uint8Array<ArrayBuffer>>) {
  const gzipStream = new CompressionStream('gzip')
  const writer = gzipStream.writable.getWriter()
  arr.then(
    (arr) => {
      writer.write(arr)
      writer.close()
    },
    (reason) => writer.abort(reason)
  )
  return gzipStream.readable
}

export function exportProjectToOffline(
  project: Project,
  assets?: AsyncIterable<Asset>,
  gzip?: boolean
) {
  const projectCopy: Project = {
    ...project,
    objects: project.objects.map((obj): EntryObject => ({
      ...obj,
      sprite: {
        ...obj.sprite,
        pictures: obj.sprite.pictures.map((picture) => ({ ...picture })),
        // sounds: obj.sprite.sounds.map((sound) => ({ ...sound })),
      },
    })),
  }
  normalizeAssetPathToOffline(projectCopy)

  const tar = exportProjectToTar(projectCopy, assets)

  if (gzip) {
    return gzipUint8ArrayToStream(tar)
  } else {
    return new ReadableStream<Uint8Array<ArrayBuffer>>({
      async start(controller) {
        controller.enqueue(await tar)
        controller.close()
      },
    })
  }
}
