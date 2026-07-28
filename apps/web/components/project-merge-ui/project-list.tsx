'use client'

import { Suspense, useCallback, useEffect } from 'react'
import Image from 'next/image'
import { FileIcon, PlusIcon, XIcon } from 'lucide-react'
import { observer } from 'mobx-react-lite'
import { preventDefault } from '@/utils/prevent-default'
import { ErrorBoundary } from '@/components/error-boundary'
import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentMedia,
  AttachmentTitle,
} from '@/components/ui/attachment'
import { ErrorMessage } from '@/components/ui/error-message'
import { getDroppedUrl } from '@/utils/get-dropped-url'
import {
  getProjectLinksIncludeShorten,
  type ProjectLinkIncludeShorten,
} from '@entry-mergy/web-project-loader/utils'
import { useKeyStore } from '@/hooks/use-key-manager'
import type { ProjectListStore } from '@/stores/project-list-store'
import { Skeleton } from '../ui/skeleton'
import { FileButtonWithLabel } from '../ui/file-button'
import { Input } from '../ui/input'
import { Button } from '../ui/button'

function ErrorComp() {
  return <ErrorMessage>오류 발생</ErrorMessage>
}

function LoadingComp() {
  return <Skeleton className='h-4 w-24' />
}

interface ProjectItemProps {
  projects: ProjectListStore
  i: number
  onRemove?: (() => void) | undefined
}

const ProjectItem = observer(({ projects, i, onRemove }: ProjectItemProps) => {
  const project = projects.projects[i]!

  const removeProject = useCallback(() => {
    projects.removeProject(i)
    onRemove?.()
  }, [projects, i, onRemove])

  return (
    <Attachment state={project.error ? 'error' : 'done'} className='w-full'>
      <AttachmentMedia
        variant={project.source.metadata.thumbUrl ? 'image' : 'icon'}
      >
        {project.source.metadata.thumbUrl ? (
          <Image
            src={project.source.metadata.thumbUrl}
            alt=''
            width={640}
            height={360}
            unoptimized
          />
        ) : (
          project.source.type == 'file' && <FileIcon />
        )}
      </AttachmentMedia>
      <AttachmentContent>
        <AttachmentTitle className='h-[--spacing(4.375)]'>
          <ErrorBoundary errorComponent={ErrorComp}>
            <Suspense fallback={<LoadingComp />}>
              {project.error ? (
                <ErrorMessage>{project.source.metadata.name}</ErrorMessage>
              ) : (
                project.source.metadata.name
              )}
            </Suspense>
          </ErrorBoundary>
        </AttachmentTitle>
        <AttachmentDescription>
          <Suspense fallback={<LoadingComp />}>{project.source.label}</Suspense>
        </AttachmentDescription>
      </AttachmentContent>
      <AttachmentActions>
        <AttachmentAction aria-label='이 작품 제거' onClick={removeProject}>
          <XIcon />
        </AttachmentAction>
      </AttachmentActions>
    </Attachment>
  )
})

export interface ProjectListProps {
  projects: ProjectListStore
  onChange?: (error?: string) => void
}

export function ProjectList({ projects, onChange }: ProjectListProps) {
  const key = useKeyStore()

  const addProjectByLink = useCallback(
    (links: ProjectLinkIncludeShorten[]) => {
      if (!links.length) return onChange?.('올바른 작품 URL을 입력해주세요.')
      projects.addProjectByLink(links)
      onChange?.()
    },
    [projects, onChange]
  )

  const addProjectByFile = useCallback(
    (files: File[]) => {
      if (!files.length) return
      projects.addProjectByFile(files)
      onChange?.()
    },
    [projects, onChange]
  )

  useEffect(() => {
    function onDrop(event: DragEvent) {
      const dt = event.dataTransfer
      if (!dt) return

      const droppedUrl = getDroppedUrl(dt)
      if (droppedUrl) {
        const links = getProjectLinksIncludeShorten(
          droppedUrl.url,
          droppedUrl.name
        )
        if (links.length) {
          event.preventDefault()
          addProjectByLink(links)
        }
      }

      const entFiles = [...dt.files].filter((v) => v.name.endsWith('.ent'))
      if (entFiles.length) {
        event.preventDefault()
        addProjectByFile(entFiles)
      }
    }

    addEventListener('dragover', preventDefault)
    addEventListener('drop', onDrop)

    return () => {
      removeEventListener('dragover', preventDefault)
      removeEventListener('drop', onDrop)
    }
  }, [addProjectByFile, addProjectByLink])

  const handleFiles = useCallback(
    (files: FileList) => {
      const entFiles = [...files].filter((v) => v.name.endsWith('.ent'))
      addProjectByFile(entFiles)
    },
    [addProjectByFile]
  )

  const handleFormAction = useCallback(
    (data: FormData) => {
      const projectUrl = data.get('project-url')
      if (typeof projectUrl != 'string') return

      const links = getProjectLinksIncludeShorten(projectUrl)
      addProjectByLink(links)
    },
    [addProjectByLink]
  )

  return (
    <>
      <form
        action={handleFormAction}
        className='flex items-center gap-2 max-[550px]:flex-col'
      >
        <FileButtonWithLabel
          type='button'
          multiple
          accept={['.ent']}
          onFileSelect={handleFiles}
          className='max-[550px]:w-full'
        />
        <span className='whitespace-nowrap max-[550px]:hidden'>또는</span>
        <div className='flex w-full flex-1 gap-2'>
          <Input
            name='project-url'
            placeholder='playentry.org/project/*** or naver.me/***'
            autoComplete='off'
          />
          <Button size='icon'>
            <PlusIcon />
          </Button>
        </div>
      </form>
      {projects.projects.map((project, i) => (
        <ProjectItem
          key={key(project)}
          projects={projects}
          i={i}
          onRemove={onChange}
        />
      ))}
    </>
  )
}
