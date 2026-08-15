import { AsyncIterableController } from '@entry-mergy/async-iterable-controller'
import type { Project } from '@entry-mergy/entry-utils/types'
import type { Asset, ImportedProject } from '@entry-mergy/project-loader-types'

type Resolver<T> = (value: T | PromiseLike<T>) => void
type Rejector = (reason?: unknown) => void

function promiseWithResolvers<T>() {
  let resolveVar!: Resolver<T>
  let rejectVar!: Rejector

  const promise = new Promise<T>((resolve, reject) => {
    resolveVar = resolve
    rejectVar = reject
  })

  return [promise, resolveVar, rejectVar] as const
}

export abstract class LoaderProject implements ImportedProject {
  private assetsIterableController = new AsyncIterableController<
    Asset,
    void,
    never
  >()
  private resolveProjectRaw
  private rejectProjectRaw
  private projectController = new AbortController()
  private assetsController = new AbortController()
  private terminated = false

  project
  assets: AsyncIterable<Asset> = this.assetsIterableController

  constructor() {
    ;[this.project, this.resolveProjectRaw, this.rejectProjectRaw] =
      promiseWithResolvers<Project>()
  }

  get projectDone() {
    return this.projectController.signal.aborted
  }

  get assetsDone() {
    return this.assetsController.signal.aborted
  }

  protected backpressureAssets() {
    return this.assetsIterableController.backpressure()
  }

  protected getRecentAssetsBackpressure() {
    return this.assetsIterableController.getRecentBackpressure()
  }

  protected getOrCreateAssetsBackpressure() {
    return this.assetsIterableController.getOrCreateBackpressure()
  }

  protected resolveProject(project: Project | PromiseLike<Project>) {
    this.resolveProjectRaw(project)
    this.projectController.abort()
    this.resolveProjectRaw = this.rejectProjectRaw = noop
  }

  protected rejectProject(reason?: unknown) {
    this.rejectProjectRaw(reason)
    this.assetsController.abort()
    this.resolveProjectRaw = this.rejectProjectRaw = noop
  }

  protected queueAsset(asset: Asset) {
    return this.assetsIterableController.enqueue(asset)
  }

  protected finishAssets() {
    this.assetsIterableController.returnWithCache()
  }

  protected throwAssets(e?: unknown) {
    this.assetsIterableController.throw(e)
  }

  protected finish(
    projectErr: unknown = Error('Finished before resolve project')
  ) {
    this.rejectProjectRaw(projectErr)
    this.finishAssets()
  }

  /**
   * Called only when cancelProject is called;
   * it is not called separately after resolveProject or rejectProject.
   */
  protected abstract handleCancelProject(e: unknown): void

  /**
   * Called only when cancelAssets is called;
   * it is not called separately after finishAssets or throwAssets.
   */
  protected abstract handleCancelAssets(e: unknown): void

  protected abstract handleTerminate(
    projectErr: unknown,
    assetsErr: unknown
  ): void

  private terminateIfComplete() {
    if (!this.terminated && this.projectDone && this.assetsDone) {
      this.terminated = true
      this.handleTerminate(
        this.projectController.signal.reason,
        this.assetsController.signal.reason
      )
    }
  }

  cancelProject(e: unknown = Error('Project loading is canceled')) {
    this.projectController.abort(e)
    this.rejectProjectRaw(e)

    try {
      this.handleCancelProject(e)
    } finally {
      this.terminateIfComplete()
    }
  }

  cancelAssets(e: unknown = Error('Assets loading is canceled')) {
    this.assetsController.abort(e)
    this.assetsIterableController.return()

    try {
      this.handleCancelAssets(e)
    } finally {
      this.terminateIfComplete()
    }
  }
}

function noop() {}
