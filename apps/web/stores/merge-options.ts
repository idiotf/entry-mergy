import { makeAutoObservable, observable } from 'mobx'
import { guessProjectTimestamp } from '@entry-mergy/kinetic/utils'
import { ProjectListStore, type ProjectState } from './project-list-store'
import {
  getImageFileurlFrom,
  getSoundFileurlFrom,
  getUniqueFilename,
} from '@entry-mergy/offline-project-loader'
import { ListStore } from './list-store'
import {
  getAudioDurationViaURL,
  getImageSizeViaURL,
} from '@entry-mergy/media-metadata'
import type { ProjectLinkIncludeShorten } from '@entry-mergy/web-project-loader/utils'

export type MergeMode = 'core' | 'kinetic'

export class MergeUICoreOptions {
  shareVariables = new ListStore<string>()
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
  hash: string
  assetPath: string
  format: string
  width: Promise<number>
  height: Promise<number>
}

export interface BGMWithData extends WithData {
  hash: string
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
  private removedProjects = new WeakSet<ProjectState>()
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
        if (this.removedProjects.has(state)) return

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

  migrateTimestamp(from: ProjectState, to: ProjectState) {
    if (!this.map.has(from)) return
    this.map.set(to, this.map.get(from))
    this.map.delete(from)
  }

  removeTimestamp(i: number) {
    const state = this.projects[i]!
    this.map.delete(state)
    this.removedProjects.add(state)
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
    this.initOptions()
  }

  private migrateOption(from: ProjectState, to: ProjectState) {
    this.timestampsMap.migrateTimestamp(from, to)
  }

  private initOptions() {
    if (this.mergeMode == 'kinetic') this.initKineticOptions()
  }

  private cleanupOption(i: number) {
    this.timestampsMap.removeTimestamp(i)
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
    const prev = this.projects[i]!
    const reloaded = this.projectListStore.reloadProject(i)
    this.migrateOption(prev, reloaded)
    this.initOptions()
    return reloaded
  }

  removeProject(i: number) {
    this.cleanupOption(i)
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
    const hash = getUniqueFilename()
    const assetPath = getImageFileurlFrom(hash, format)

    this.thumbnail = {
      hash,
      assetPath,
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
    const hash = getUniqueFilename()
    const assetPath = getSoundFileurlFrom(hash, format)

    this.bgm = {
      hash,
      assetPath,
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
