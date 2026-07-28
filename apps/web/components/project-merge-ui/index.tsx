'use client'

import { useCallback, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { observer } from 'mobx-react-lite'
import { cn } from '@/lib/utils'
import { LoadableButton } from '@/components/ui/loadable-button'
import { ErrorMessage } from '@/components/ui/error-message'
import { mergeAllAsync, type MergeOptions } from '@entry-mergy/core'
import {
  mergeAllKineticAsync,
  type KineticMergeOptions,
} from '@entry-mergy/kinetic'
import type { MergeUIOptionsStore } from '@/stores/merge-options'
import { z } from 'zod/mini'
import { exportProjectToOffline } from '@entry-mergy/offline-project-loader'
import { downloadBlob } from '@/utils/download'
import { Button } from '../ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '../ui/collapsible'
import { ProjectList } from './project-list'
import { FormProvider, useForm, useFormContext } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

const coreOptionsSchema = z.object({
  preserveVar: z.optional(z.array(z.string())),
  shareFunctions: z.optional(z.boolean()),
}) satisfies z.ZodMiniType<MergeOptions>

const kineticOptionsSchema = z.object({
  timestamps: z.array(z.number()),
  thumbnail: z.object({
    url: z.string(),
    format: z.string(),
    width: z.number(),
    height: z.number(),
  }),
  bgm: z.object({
    url: z.string(),
    format: z.string(),
    duration: z.number(),
  }),
  coreOptions: z.optional(coreOptionsSchema),
  timestampGap: z.optional(z.number()),
  waitForBGM: z.optional(
    z.union([
      z.boolean(),
      z.object({
        useCache: z.optional(z.boolean()),
      }),
    ])
  ),
  memos: z.optional(z.array(z.string())),
}) satisfies z.ZodMiniType<KineticMergeOptions>

type MergeOptionsWithMode = z.infer<typeof optionsSchema>
const optionsSchema = z.union([
  z.object({
    mergeMode: z.literal('core'),
    coreOptions: coreOptionsSchema,
  }),
  z.object({
    mergeMode: z.literal('kinetic'),
    ...kineticOptionsSchema.shape,
  }),
])

interface ProjectOptionsUIProps {
  options: MergeUIOptionsStore
}

const ProjectOptionsUI = observer(({ options }: ProjectOptionsUIProps) => {
  const form = useFormContext<KineticMergeOptions>()

  return <>TODO</>
})

export interface ProjectMergeUIProps extends React.ComponentProps<'div'> {
  options: MergeUIOptionsStore
}

export const ProjectMergeUI = observer((props: ProjectMergeUIProps) => {
  const { className, options, ...rest } = props

  const [merging, setMerging] = useState(false)
  const [error, setError] = useState('')

  const mergeSelectedProjects = useCallback(
    (resolvedOptions: MergeOptionsWithMode) => {
      const projects = options.projects.map((v, i) =>
        v.project.catch((e) => {
          console.error(e)
          throw `${i + 1}번째 작품을 불러오는 중 오류가 발생했습니다.`
        })
      )
      const { mergeMode, coreOptions } = resolvedOptions

      switch (mergeMode) {
        case 'core':
          return mergeAllAsync(projects, coreOptions)

        case 'kinetic':
          return mergeAllKineticAsync(projects, resolvedOptions)
      }
    },
    [options]
  )

  const startMerge = useCallback(
    async (options: MergeOptionsWithMode) => {
      setMerging(true)
      setError('')

      try {
        const merged = await mergeSelectedProjects(options)
        const tar = exportProjectToOffline(merged)
        const tgz = tar.pipeThrough(new CompressionStream('gzip'))
        downloadBlob(await new Response(tgz).blob(), 'output.ent')
      } catch (e) {
        console.error(e)
        setError(String(e))
      }

      setMerging(false)
    },
    [mergeSelectedProjects]
  )

  const handleChangeProjectList = useCallback((error?: string) => {
    setError(error || '')
  }, [])

  const form = useForm<MergeOptionsWithMode>({
    resolver: zodResolver(optionsSchema),
    defaultValues: options,
  })

  const onSubmit = useCallback(
    (options: MergeOptionsWithMode) => {
      return startMerge(options)
    },
    [startMerge]
  )

  return (
    <div {...rest} className={cn('space-y-2 pt-2 pb-4', className)}>
      <ProjectList
        projects={options.projectListStore}
        onChange={handleChangeProjectList}
      />
      <Collapsible>
        <FormProvider {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <div className='flex gap-2'>
              <CollapsibleTrigger asChild>
                <Button
                  type='button'
                  variant='ghost'
                  className='[&[data-state=open]>*]:rotate-90'
                >
                  <ChevronRight className='transition-transform duration-75 ease-out' />
                  기타 설정
                </Button>
              </CollapsibleTrigger>
              <div className='flex items-stretch gap-2'>
                {options.projects.length > 0 && (
                  <LoadableButton type='submit' loading={merging}>
                    병합
                  </LoadableButton>
                )}
                {error && <ErrorMessage>{error}</ErrorMessage>}
              </div>
            </div>
            <CollapsibleContent>
              <ProjectOptionsUI options={options} />
            </CollapsibleContent>
          </form>
        </FormProvider>
      </Collapsible>
    </div>
  )
})
