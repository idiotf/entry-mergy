import { makeAutoObservable, observable } from 'mobx'
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
import type { ProjectLinkIncludeShorten } from '@entry-mergy/web-project-loader/utils'

// #region Merge Options Store

export type MergeMode = 'core' | 'kinetic'

export class MergeUICoreOptions {
  preserveVar = new ListStore<string>()
  shareFunctions = true

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

/**
 * - `number` First timestamp is setted
 * - `undefined` First timestamp is *not* setted
 * - `null` First timestamp is setted to *empty*
 */
type TimestampOptionValue = number | undefined | null

class TimestampsStore {
  private map = new Map<ProjectState, number | undefined>()
  private isGuessedProject = new WeakSet<ProjectState>()
  private isGuessedEndTimestamp = new WeakSet<ProjectState>()
  firstTimestamp?: TimestampOptionValue

  constructor(private projectListStore: ProjectListStore) {
    makeAutoObservable(this)
  }

  private get projects() {
    return this.projectListStore.projects
  }

  get timestamps() {
    return this.projects.map((state) => this.map.get(state))
  }

  initTimestamps() {
    this.projects.forEach((state) => {
      if (this.isGuessedProject.has(state)) return
      this.isGuessedProject.add(state)

      state.project.then((project) => {
        const i = this.projects.indexOf(state)
        if (i < 0) return

        // When guessing timestamps, start timestamp takes precedence
        const prevProject = this.projects[i - 1]!
        const hasStartTimestamp =
          i == 0
            ? this.firstTimestamp !== undefined
            : this.map.has(prevProject) &&
              !this.isGuessedEndTimestamp.has(prevProject)
        const hasEndTimestamp = this.map.has(state)

        const { start, end } = guessProjectTimestamp(project)
        if (start !== null && !hasStartTimestamp) {
          this.setStartTimestamp(i, start)
        }
        if (end !== null && !hasEndTimestamp) {
          this.setEndTimestamp(i, end)
          this.isGuessedEndTimestamp.add(state)
        }
      })
    })
  }

  setStartTimestamp(i: number, timestamp: number | undefined) {
    if (timestamp && timestamp < 0) timestamp = 0

    if (i == 0) this.firstTimestamp = timestamp ?? null
    else this.setEndTimestamp(i - 1, timestamp)
  }

  setEndTimestamp(i: number, timestamp: number | undefined) {
    if (timestamp && timestamp < 0) timestamp = 0

    const state = this.projects[i]!
    this.map.set(state, timestamp)
    this.isGuessedEndTimestamp.delete(state)
  }
}

class DisabledScenesStore {
  private map = new WeakMap<ProjectState, Set<number>>()

  constructor() {
    makeAutoObservable(this)
  }

  get(project: ProjectState) {
    let disabledScenes = this.map.get(project)
    if (!disabledScenes) {
      this.map.set(project, (disabledScenes = observable(new Set<number>())))
    }

    return disabledScenes
  }

  enable(project: ProjectState, sceneIdx: number) {
    const disabledScenes = this.get(project)
    disabledScenes.delete(sceneIdx)
  }

  disable(project: ProjectState, sceneIdx: number) {
    const disabledScenes = this.get(project)
    disabledScenes.add(sceneIdx)
  }
}

export class MergeUIOptionsStore implements ProjectListStore {
  mergeMode: MergeMode = 'core'
  coreOptions = new MergeUICoreOptions()

  private timestampsMap = new TimestampsStore(this.projectListStore)
  disabledScenes = new DisabledScenesStore()
  thumbnail?: ThumbnailWithData | undefined
  bgm?: BGMWithData | undefined

  timestampGap?: number | undefined
  waitForBGM = true
  useBGMCache = true

  constructor(private projectListStore = new ProjectListStore()) {
    makeAutoObservable(this)
  }

  get projects() {
    return this.projectListStore.projects
  }

  get projectsStore() {
    return this.projectListStore.projectsStore
  }

  get timestamps() {
    return this.timestampsMap.timestamps
  }

  get firstTimestamp() {
    return this.timestampsMap.firstTimestamp
  }

  get memos() {
    if (this.mergeMode != 'kinetic') return

    const memos: string[] = []

    if (this.projects.some((project) => !project.assets))
      memos.push('오프라인 작품 에디터에서는 일부 애셋이 표시되지 않습니다.')

    if (this.useBGMCache)
      memos.push(
        `테이블이 없는 경우, '데이터분석'에서 2행 1열 테이블을 만든 뒤 '썸네일'의 코드에 적용해주세요.`
      )

    if (memos.length) return memos
  }

  private initKineticOptions() {
    this.timestampsMap.initTimestamps()
  }

  setMergeMode(mode: MergeMode) {
    this.mergeMode = mode
    if (mode == 'kinetic') this.initKineticOptions()
  }

  private initOptions() {
    if (this.mergeMode == 'kinetic') this.initKineticOptions()
  }

  addProjectByLink(links: ProjectLinkIncludeShorten[]) {
    this.projectListStore.addProjectByLink(links)
    this.initOptions()
  }

  addProjectByFile(files: File[]) {
    this.projectListStore.addProjectByFile(files)
    this.initOptions()
  }

  reloadProject(i: number) {
    this.projectListStore.reloadProject(i)
    this.initOptions()
  }

  removeProject(i: number) {
    this.projectListStore.removeProject(i)
  }

  setStartTimestamp(i: number, timestamp: number | undefined) {
    this.timestampsMap.setStartTimestamp(i, timestamp)
  }

  setEndTimestamp(i: number, timestamp: number | undefined) {
    this.timestampsMap.setEndTimestamp(i, timestamp)
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
    url: options.thumbnail.assetPath,
    format: options.thumbnail.format,
    width: await options.thumbnail.width,
    height: await options.thumbnail.height,
  }

  const bgm = {
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
      return data.done ? controller.close() : controller.enqueue(data.value)
    },
    async cancel(reason) {
      return (await stream).cancel(reason)
    },
  })
}

async function* iterateAllAssets(options: MergeUIOptionsStore) {
  if (options.mergeMode == 'kinetic') {
    if (!options.thumbnail) throw new OptionError('mustSelectThumbnail')
    if (!options.bgm) throw new OptionError('mustSelectBGM')

    yield {
      name: options.thumbnail.assetPath,
      data: options.thumbnail.file.stream(),
    }
    yield {
      name: options.bgm.assetPath,
      data: options.bgm.file.stream(),
    }
  }

  for (const { assets } of options.projects) {
    if (!assets) continue
    for await (const { name, data } of assets) {
      yield { name, data: convertPromiseBlobToStream(data) }
    }
  }
}

export async function mergeProjectsToOffline(options: MergeUIOptionsStore) {
  const projects = getSelectedProjects(options)
  const merged = await mergeSelectedProjects(projects, options)

  const assets = iterateAllAssets(options)
  return exportProjectToOffline(merged, assets, true)
}

// #endregion
