import { pack, type Pack } from 'tar-stream'
import { generateHash } from '@entry-mergy/common-utils'
import {
  convertNodeStreamToWebStream,
  pipeWebStreamToNodeStream,
} from '@entry-mergy/stream-utils'
import type { Asset } from '@entry-mergy/project-loader-types'
import type { EntryObject, Project } from '@entry-mergy/entry-utils/types'

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

async function addAssetsToTar(tar: Pack, assets: AsyncIterable<Asset>) {
  const promises: Promise<void>[] = []
  for await (const { name, size, data } of assets) {
    const awaitedSize = await size
    promises.push(new Promise((resolve, reject) => {
      const stream = tar.entry({ name, size: awaitedSize }, (err) => {
        if (err != null) reject(err)
        else resolve()
      })
      pipeWebStreamToNodeStream(data, stream)
    }))
  }

  await Promise.all(promises)
  tar.finalize()
}

function exportProjectToTar(
  project: Project,
  assets?: AsyncIterable<Asset>
): ReadableStream<Uint8Array<ArrayBuffer>> {
  const tar = pack()
  tar.entry({ name: 'temp/project.json' }, JSON.stringify(project))
  if (assets) {
    addAssetsToTar(tar, assets).catch((reason) => {
      tar.emit('error', reason)
    })
  }
  return convertNodeStreamToWebStream(tar)
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
    return tar.pipeThrough(new CompressionStream('gzip'))
  } else {
    return tar
  }
}
