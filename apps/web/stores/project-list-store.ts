import { makeAutoObservable, runInAction } from 'mobx'
import { importProjectFromOffline } from '@entry-mergy/offline-project-loader'
import { ListStore } from './list-store'
import type { Project } from '@entry-mergy/core'
import type { Asset, ImportedProject } from '@entry-mergy/project-loader-types'
import type { ProjectLinkIncludeShorten } from '@entry-mergy/web-project-loader/utils'
import type { ProjectId } from '@entry-mergy/entry-api-client'

type MaybePromise<T> = Promise<T> | T

export interface ProjectStateInit {
  source: ProjectSource
  project: Promise<Project>
  assets?: AsyncIterable<Asset> | undefined
}

export class ProjectState {
  source: ProjectSource
  project: Promise<Project>
  assets?: AsyncIterable<Asset> | undefined
  error?: unknown

  constructor(init: ProjectStateInit) {
    this.source = init.source
    this.project = init.project
    this.assets = init.assets

    makeAutoObservable(this)

    this.project.catch((e) => {
      runInAction(() => {
        this.error = e
      })
    })
  }
}

export interface LinkProjectOrigin {
  type: 'url' | 'auto'
  origin: ProjectLinkIncludeShorten
}

export interface FileProjectOrigin {
  type: 'file'
  origin: File
}

export type ProjectOrigin = LinkProjectOrigin | FileProjectOrigin

export interface ProjectSourceInit {
  origin: ProjectOrigin
  label: string
  metadata: ProjectMetadata
}

export class ProjectSource {
  origin: ProjectOrigin
  label: string
  metadata: ProjectMetadata

  constructor(init: ProjectSourceInit) {
    this.origin = init.origin
    this.label = init.label
    this.metadata = init.metadata

    makeAutoObservable(this)
  }

  get type() {
    return this.origin.type
  }

  setFromLoadingProject(
    project: Promise<Project>,
    resolvedId?: MaybePromise<string>
  ) {
    const name = getNameOfProjectAsync(project)
    this.metadata.setNameWhenLoaded(name)

    let id: Promise<string | undefined> | undefined =
      resolvedId === undefined ? undefined : Promise.resolve(resolvedId)
    if (this.metadata.thumbUrl === undefined) {
      id ||= getOriginOfProjectAsync(project)
      this.metadata.setThumbUrlWhenLoaded(
        id.then((id) => {
          if (id === undefined) return
          return getThumbUrl(id)
        })
      )
    }

    if (this.type == 'file') {
      id ||= getOriginOfProjectAsync(project)
      id.then((id) => {
        if (id === undefined) return
        runInAction(() => {
          this.label = `${this.label} (playentry.org/project/${id})`
        })
      })
    }

    if (resolvedId !== undefined) {
      Promise.resolve(resolvedId).then((id) => {
        runInAction(() => {
          this.label = `${this.label} (playentry.org/project/${id})`
        })
      })
    }
  }
}

export class ProjectMetadata {
  constructor(
    public name?: MaybePromise<string | undefined>,
    public thumbUrl?: string
  ) {
    makeAutoObservable(this)
  }

  setNameWhenLoaded(
    name: Promise<string | undefined>,
    applyWhenUndefined?: boolean
  ) {
    name.then((name) => {
      if (name === undefined && !applyWhenUndefined) return
      runInAction(() => {
        this.name = name
      })
    })
  }

  setThumbUrlWhenLoaded(
    thumbUrl: Promise<string | undefined>,
    applyWhenUndefined?: boolean
  ) {
    thumbUrl.then((thumbUrl) => {
      if (thumbUrl === undefined && !applyWhenUndefined) return
      runInAction(() => {
        this.thumbUrl = thumbUrl
      })
    })
  }
}

async function getOriginOfProjectAsync(projectPromise: Promise<Project>) {
  const project = await projectPromise
  return 'parent' in project && project.parent !== null
    ? String(project.parent)
    : 'origin' in project && project.origin !== null
      ? String(project.origin)
      : undefined
}

async function getNameOfProjectAsync(projectPromise: Promise<Project>) {
  const project = await projectPromise
  return 'name' in project ? String(project.name) : undefined
}

function getThumbUrl(id: ProjectId) {
  const projectId = typeof id == 'string' ? id : id[0]
  return `https://playentry.org/uploads/thumb/${projectId.substring(0, 4)}/${projectId}.png`
}

interface ProjectFetchResult {
  id: string
  project: Project | null
}

interface ImportedProjectWithId extends ImportedProject {
  id: MaybePromise<string>
}

const tupleMap = <const T extends readonly unknown[], U>(
  arr: T,
  fn: <I extends keyof T & number>(value: T[I], index: I) => U
) => arr.map(fn) as { [K in keyof T]: U }

function importProjectFromWeb<const T extends readonly ProjectId[]>(id: T) {
  const idParam = id
    .map((id) => (typeof id == 'string' ? id : `${id[0]}:${id[1]}`))
    .join(',')
  const projects: Promise<(ProjectFetchResult | null)[]> = fetch(
    `/api/project/${idParam}`
  ).then((res) => res.json())

  return tupleMap(id, (id, i): ImportedProjectWithId => {
    const project = projects.then((projects) => projects[i])
    return {
      id:
        id.length == 24
          ? id
          : project.then((res) => {
              const id = res?.id
              if (id == null) throw TypeError('Failed to load project id')
              return id
            }),
      project: project.then((res) => {
        const project = res?.project
        if (project == null) throw TypeError('Failed to load project')
        return project
      }),
      // Currently, our server doesn't provide any assets data
    }
  })
}

const projectNameRegex = /^작품 - (.+) : 엔트리$/
const entExtensionRegex = /\.ent$/i

function loadProjectsByLink<const T extends ProjectLinkIncludeShorten[]>(
  links: T
) {
  const loadedProjects = importProjectFromWeb(tupleMap(links, (v) => v.id))

  const loadedProjectStates = tupleMap(links, (link, i): ProjectState => {
    const { type, id, url, name } = link
    const { id: resolvedId, project, assets } = loadedProjects[i]

    const source = new ProjectSource({
      origin: { type: 'url', origin: link },
      label: url,
      metadata: new ProjectMetadata(
        name?.match(projectNameRegex)?.[1] || getNameOfProjectAsync(project),
        type == 'shorten' ? undefined : getThumbUrl(id)
      ),
    })
    source.setFromLoadingProject(
      project,
      type == 'shorten' ? resolvedId : undefined
    )

    return new ProjectState({ source, project, assets })
  })

  return loadedProjectStates
}

function loadProjectsByFile<const T extends File[]>(files: T) {
  const loadedProjectStates = tupleMap(files, (file): ProjectState => {
    const { project, assets } = importProjectFromOffline(file.stream())

    const source = new ProjectSource({
      origin: { type: 'file', origin: file },
      label: file.name,
      metadata: new ProjectMetadata(file.name.replace(entExtensionRegex, '')),
    })
    source.setFromLoadingProject(project)

    return new ProjectState({ source, project, assets })
  })

  return loadedProjectStates
}

export class ProjectListStore {
  constructor(public projectsStore = new ListStore<ProjectState>()) {
    makeAutoObservable(this)
  }

  get projects() {
    return this.projectsStore.values
  }

  addProjectByLink(links: ProjectLinkIncludeShorten[]) {
    this.projectsStore.add(...loadProjectsByLink(links))
  }

  addProjectByFile(files: File[]) {
    this.projectsStore.add(...loadProjectsByFile(files))
  }

  reloadProject(i: number) {
    const { type, origin } = this.projects[i]!.source.origin
    const [project] =
      type == 'file'
        ? loadProjectsByFile([origin])
        : loadProjectsByLink([origin])
    this.projectsStore.set(i, project)
  }

  removeProject(i: number) {
    this.projectsStore.remove(i)
  }
}
