import { makeAutoObservable } from 'mobx'
import { guessProjectTimestamp } from '@entry-mergy/kinetic/utils'
import { ProjectListStore, type ProjectState } from './project-list-store'
import {
  exportProjectToOffline,
  getImageFileurlFrom,
  getSoundFileurlFrom,
  getUniqueFilename,
} from '@entry-mergy/offline-project-loader'
import { mergeAllAsync, type MergeOptions } from '@entry-mergy/core'
import { mergeAllKineticAsync } from '@entry-mergy/kinetic'
import { ListStore } from './list-store'
import {
  getAudioDurationViaURL,
  getImageSizeViaURL,
} from '@entry-mergy/media-metadata'
import type { Project } from '@entry-mergy/entry-utils/types'

// #region Merge Options Store

export type MergeMode = 'core' | 'kinetic'

export class MergeUICoreOptions {
  preserveVar = new ListStore<string>()
  shareFunctions = false

  constructor() {
    makeAutoObservable(this)
  }

  setShareFunctions(shareFunctions: boolean) {
    this.shareFunctions = shareFunctions
  }
}

interface WithData {
  file: File
  blobUrl: string
  data: ReadableStream<Uint8Array<ArrayBuffer>>
}

export interface ThumbnailWithData extends WithData {
  assetPath: string
  format: string
  width: Promise<number>
  height: Promise<number>
}

export interface BGMWithData extends WithData {
  assetPath: string
  format: string
  duration: Promise<number>
}

export class MergeUIOptionsStore {
  mergeMode: MergeMode = 'core'
  coreOptions = new MergeUICoreOptions()

  protected timestampsMap = new WeakMap<ProjectState, number>()
  thumbnail?: ThumbnailWithData | undefined
  bgm?: BGMWithData | undefined

  timestampGap?: number | undefined
  waitForBGM = true
  useBGMCache = true

  constructor(public projectListStore = new ProjectListStore()) {
    makeAutoObservable(this)
  }

  get projects() {
    return this.projectListStore.projects
  }

  get timestamps() {
    return this.projects.map(
      (state) => this.timestampsMap.get(state) ?? undefined
    )
  }

  get memos() {
    if (this.mergeMode != 'kinetic') return

    const memos: string[] = []

    if (this.projects.some((project) => project.source.type != 'file'))
      memos.push('오프라인 작품 에디터에서는 일부 애셋이 표시되지 않습니다.')

    if (this.useBGMCache)
      memos.push(
        `테이블이 없는 경우 2행 1열 테이블을 만든 뒤 '썸네일'의 코드에 적용해주세요.`
      )

    if (memos.length) return memos
  }

  protected initKineticOptions() {
    this.projects.forEach((state) => {
      const { project } = state

      if (!this.timestampsMap.has(state)) {
        project.then((project) => {
          const i = this.projects.indexOf(state)
          if (i < 0) return

          const { start, end } = guessProjectTimestamp(project)
          if (start !== null && i > 0) this.setTimestampOf(i - 1, start)
          if (end !== null && this.timestamps[i] === null)
            this.setTimestampOf(i, end)
        })
      }
    })
  }

  setMergeMode(mode: MergeMode) {
    this.mergeMode = mode
    if (mode == 'kinetic') this.initKineticOptions()
  }

  setTimestampOf(i: number, endTimestamp: number) {
    if (endTimestamp < 0) endTimestamp = 0

    const state = this.projects[i]
    if (!state) return
    this.timestampsMap.set(state, endTimestamp)
  }

  setThumbnail(file?: File) {
    if (this.thumbnail) URL.revokeObjectURL(this.thumbnail?.blobUrl)

    if (!file) {
      this.thumbnail = undefined
      return
    }

    const blobUrl = URL.createObjectURL(file)
    const size = getImageSizeViaURL(blobUrl)
    const width = size.then((size) => size[0])
    const height = size.then((size) => size[1])
    const format = file.name.endsWith('.svg') ? 'svg' : 'png'

    this.thumbnail = {
      assetPath: getImageFileurlFrom(getUniqueFilename(), format),
      format,
      width,
      height,
      file,
      blobUrl,
      data: file.stream(),
    }
  }

  setBGM(file?: File) {
    if (this.bgm) URL.revokeObjectURL(this.bgm?.blobUrl)

    if (!file) {
      this.thumbnail = undefined
      return
    }

    const blobUrl = URL.createObjectURL(file)
    const duration = getAudioDurationViaURL(blobUrl)
    const format = '.mp3'

    this.bgm = {
      assetPath: getSoundFileurlFrom(getUniqueFilename(), format),
      format,
      duration,
      file,
      blobUrl: URL.createObjectURL(file),
      data: file.stream(),
    }
  }

  setWaitForBGM(waitForBGM: boolean, useCache = this.useBGMCache) {
    this.waitForBGM = waitForBGM
    this.useBGMCache = useCache
  }

  setTimestampGap(gap?: number) {
    if (gap && gap < 0) gap = 0
    this.timestampGap = gap
  }
}

// #endregion
// #region Merge Utils

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
}
OptionError.prototype.name = 'OptionError'
OptionError.prototype.message = ''

function getSelectedProjects(options: MergeUIOptionsStore) {
  return options.projects.map((state, i) =>
    state.project.catch((e) => {
      console.error(e)
      throw `${i + 1}번째 작품을 불러오는 중 오류가 발생했습니다.`
    })
  )
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
    url: options.thumbnail.assetPath,
    format: options.thumbnail.format,
    width: await options.thumbnail.width,
    height: await options.thumbnail.height,
  }

  const bgm = {
    url: options.bgm.assetPath,
    format: options.bgm.format,
    duration: await options.bgm.duration,
  }

  const coreOptions = resolveCoreOptions(options.coreOptions)

  const waitForBGM =
    options.waitForBGM
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

async function* iterateAllAssets(options: MergeUIOptionsStore) {
  if (options.mergeMode == 'kinetic') {
    if (!options.thumbnail) throw new OptionError('mustSelectThumbnail')
    if (!options.bgm) throw new OptionError('mustSelectBGM')

    yield { name: options.thumbnail.assetPath, data: options.thumbnail.data }
    yield { name: options.bgm.assetPath, data: options.bgm.data }
  }

  for (const { assets } of options.projects) {
    if (assets) yield* assets
  }
}

export async function mergeProjectsToOffline(options: MergeUIOptionsStore) {
  const projects = getSelectedProjects(options)
  const merged = await mergeSelectedProjects(projects, options)

  // TODO (after offline-project-loader bugfix)
  // const assets = iterateAllAssets(options)
  const assets = undefined
  return exportProjectToOffline(merged, assets, true)
}

// #endregion
