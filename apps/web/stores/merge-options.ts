import { makeAutoObservable } from 'mobx'
import { guessProjectTimestamp } from '@entry-mergy/kinetic/utils'
import { ProjectListStore, type ProjectState } from './project-list-store'
import type { MergeOptions } from '@entry-mergy/core'

export type MergeMode = 'core' | 'kinetic'

export class MergeUIOptionsStore {
  mergeMode: MergeMode = 'core'
  coreOptions: MergeOptions = {
    preserveVar: [],
    shareFunctions: false,
  }

  protected timestampsMap = new WeakMap<ProjectState, number>()
  thumbnail?
  bgm?

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
    const state = this.projects[i]
    if (!state) return
    this.timestampsMap.set(state, endTimestamp)
  }
}
