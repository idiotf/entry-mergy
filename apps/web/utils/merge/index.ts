import { Project, type MergeOptions, mergeAllAsync } from '@entry-mergy/core'
import { mergeAllKineticAsync } from '@entry-mergy/kinetic'
import { minifyProject } from '@entry-mergy/entry-project-optimizer'
import {
  getImageFileurlFrom,
  getSoundFileurlFrom,
  exportProjectToOffline,
} from '@entry-mergy/offline-project-loader'
import type {
  MergeUIOptionsStore,
  MergeUICoreOptions,
} from '@/stores/merge-options'

export type OptionErrorTypes = typeof optionErrorTypes
export type OptionErrorType = keyof OptionErrorTypes
export const optionErrorTypes = {
  timestampMustBeProvided: `타임스탬프를 설정해 주세요.`,
  mustSelectThumbnail: `썸네일을 선택해 주세요.`,
  mustSelectBGM: `BGM을 선택해 주세요.`,
}

export class OptionError extends Error {
  constructor(
    public type: OptionErrorType,
    public params?: unknown[]
  ) {
    super(optionErrorTypes[type])
  }

  override get name() {
    return 'OptionError'
  }
}

function filterScenes(project: Project, disabledScenesIdx: Set<number>) {
  const sceneIdxMap = new Map(
    [...disabledScenesIdx]
      .map((v) => [project.scenes[v]?.id, v])
      .filter((v): v is [string, number] => v[0] !== undefined)
  )

  const scenes = project.scenes.filter((_, i) => !disabledScenesIdx?.has(i))

  const objects = project.objects.filter(({ scene }) => {
    const sceneIdx = sceneIdxMap.get(scene)
    return sceneIdx === undefined || !disabledScenesIdx?.has(sceneIdx)
  })

  return { ...project, scenes, objects }
}

function getSelectedProjects(options: MergeUIOptionsStore) {
  return options.projects.map((state, i) => {
    const disabledScenes = options.disabledScenes.get(state)

    return state.project.then(
      (project) => filterScenes(project, disabledScenes),
      (e) => {
        console.error(e)
        throw `${i + 1}번째 작품을 불러오는 중 오류가 발생했습니다.`
      }
    )
  })
}

function mergeSelectedProjects(
  projects: Promise<Project>[],
  options: MergeUIOptionsStore
) {
  if (options.mergeMode == 'core') {
    return mergeProjectsViaCore(projects, options)
  } else {
    return mergeProjectsViaKinetic(projects, options)
  }
}

function resolveCoreOptions(options: MergeUICoreOptions): MergeOptions {
  return {
    ...options,
    preserveVar: options.preserveVar.items.map((v) => v.value),
  }
}

function mergeProjectsViaCore(
  projects: Promise<Project>[],
  options: MergeUIOptionsStore
) {
  return mergeAllAsync(projects, resolveCoreOptions(options.coreOptions))
}

async function mergeProjectsViaKinetic(
  projects: Promise<Project>[],
  options: MergeUIOptionsStore
) {
  const invalidTimestampIdx = options.timestamps.findIndex(
    (v) => v === undefined
  )
  if (invalidTimestampIdx != -1)
    throw new OptionError('timestampMustBeProvided')

  if (!options.thumbnail) throw new OptionError('mustSelectThumbnail')
  if (!options.bgm) throw new OptionError('mustSelectBGM')

  const timestamps = options.timestamps as number[]

  const thumbnail = {
    hash: options.thumbnail.hash,
    url: options.thumbnail.assetPath,
    format: options.thumbnail.format,
    width: await options.thumbnail.width,
    height: await options.thumbnail.height,
  }

  const bgm = {
    hash: options.bgm.hash,
    url: options.bgm.assetPath,
    format: options.bgm.format,
    duration: +(await options.bgm.duration).toFixed(1),
  }

  const coreOptions = resolveCoreOptions(options.coreOptions)

  const waitForBGM = options.waitForBGM
    ? { useCache: options.useBGMCache }
    : false

  const resolvedOptions = {
    timestamps,
    thumbnail,
    bgm,
    coreOptions,
    timestampGap: options.timestampGap,
    waitForBGM,
    memos: options.memos,
  }

  return mergeAllKineticAsync(projects, resolvedOptions)
}

function convertPromiseBlobToStream(blob: Promise<Blob>) {
  const stream = blob.then((blob) => blob.stream())
  const reader = stream.then((stream) => stream.getReader())

  return new ReadableStream<Uint8Array<ArrayBuffer>>({
    async pull(controller) {
      const data = await (await reader).read()
      if (data.done) controller.close()
      else controller.enqueue(data.value)
    },
    async cancel(reason) {
      return (await stream).cancel(reason)
    },
  })
}

async function* iterateAllAssets({
  mergeMode,
  thumbnail,
  bgm,
  projects,
}: MergeUIOptionsStore) {
  if (mergeMode == 'kinetic') {
    if (!thumbnail) throw new OptionError('mustSelectThumbnail')
    if (!bgm) throw new OptionError('mustSelectBGM')

    yield {
      name: getImageFileurlFrom(thumbnail.hash, thumbnail.format),
      data: thumbnail.file.stream(),
    }
    yield {
      name: getSoundFileurlFrom(bgm.hash, bgm.format),
      data: bgm.file.stream(),
    }
  }

  for (const { assets } of projects) {
    if (!assets) continue
    for await (const { name, data } of assets) {
      yield { name, data: convertPromiseBlobToStream(data) }
    }
  }
}

export async function mergeProjectsToOffline(options: MergeUIOptionsStore) {
  const projects = getSelectedProjects(options)
  const merged = await mergeSelectedProjects(projects, options)
  const optimized = minifyProject(merged)

  const assets = iterateAllAssets(options)
  return exportProjectToOffline(optimized, assets, true)
}
