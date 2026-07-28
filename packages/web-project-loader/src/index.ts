import {
  selectProjectMany,
  type EntryGraphQLClient,
  type ProjectId,
} from '@entry-mergy/entry-api-client'
import type { Project } from '@entry-mergy/entry-utils/types'
import type { ImportedProject } from '@entry-mergy/project-loader-types'
import type { CommonProjectLink } from './utils'

function loadAsset(path: string) {
  const abortController = new AbortController()

  return new ReadableStream<Uint8Array<ArrayBuffer>>({
    async start(controller) {
      const { body } = await fetch(new URL(path, 'https://playentry.org'), {
        signal: abortController.signal,
      })
      if (!body) return controller.close()

      const reader = body.getReader()
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        controller.enqueue(value)
      }
    },
    cancel(reason) {
      abortController.abort(reason)
    },
  })
}

function getAssetFromPath(innerPath: string) {
  let data: ReadableStream<Uint8Array<ArrayBuffer>> | undefined
  return {
    name: 'temp/' + innerPath,
    get data() {
      return (data ||= loadAsset('/uploads/' + innerPath))
    },
  }
}

const uploadsRegex = /^\/+uploads\//
const getPicturePath = (picture: object) =>
  'fileurl' in picture
    ? (picture.fileurl + '').replace(uploadsRegex, '')
    : 'filename' in picture
      ? `${(picture.filename + '').substring(0, 2)}/${(picture.filename + '').substring(2, 4)}/${picture.filename}.${'imageType' in picture ? picture.imageType : 'png'}`
      : null
const getSoundPath = (sound: object) =>
  'fileurl' in sound
    ? (sound.fileurl + '').replace(uploadsRegex, '')
    : 'filename' in sound
      ? `${(sound.filename + '').substring(0, 2)}/${(sound.filename + '').substring(2, 4)}/${sound.filename}${'ext' in sound ? sound.ext : '.mp3'}`
      : null

export async function* getAssetsFromProject(project: Project) {
  const { objects } = project
  const pictures = objects.flatMap((obj) => obj.sprite.pictures)
  const sounds = objects.flatMap((obj) => obj.sprite.sounds)

  for (const picture of pictures) {
    const innerPath = getPicturePath(picture)
    if (innerPath !== null) yield getAssetFromPath(innerPath)
  }
  for (const sound of sounds) {
    const innerPath = getSoundPath(sound)
    if (innerPath !== null) yield getAssetFromPath(innerPath)
  }
}

async function* getAssetsFromAsyncProject(project: Promise<Project>) {
  return yield* getAssetsFromProject(await project)
}

export function importProjectFromWeb(
  client: EntryGraphQLClient,
  id: readonly ProjectId[]
): ImportedProject[] {
  const projects = selectProjectMany(client, id)

  return id.map((id, i) => {
    const project = projects.then((projects) => {
      const project = projects[i]
      if (!project)
        throw TypeError(`Failed to load project ${id} (at ${i + 1})`)
      return project
    })

    const assets = getAssetsFromAsyncProject(project)

    return { project, assets }
  })
}

const strictProjectRegex = /^https:\/\/playentry\.org\/project\/([\da-f]{24})$/

export async function getProjectIdFromShortenURL(
  id: string
): Promise<CommonProjectLink> {
  const res = await fetch(`https://naver.me/${id}`, { redirect: 'manual' })
  if (res.status != 307)
    throw TypeError(
      `Failed to get project id from shorten url 'naver.me/${id}': ${res.status} ${res.statusText}`
    )

  const location = res.headers.get('Location')
  if (location === null)
    throw TypeError(
      `Failed to get project id from shorten url 'naver.me/${id}': Location is null`
    )

  const projectId = location?.match(strictProjectRegex)?.[1]
  if (!projectId)
    throw TypeError(
      `Failed to get project id from shorten url 'naver.me/${id}': Location '${location}' doesn't match strictProjectRegex`
    )

  return {
    type: 'common',
    url: location,
    id: projectId,
  }
}
