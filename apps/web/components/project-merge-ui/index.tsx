'use client'

import Image from 'next/image'
import { useCallback, useMemo, useState } from 'react'
import { ChevronRight, ImageIcon, Music4Icon } from 'lucide-react'
import { observer } from 'mobx-react-lite'
import { cn } from '@/lib/utils'
import { LoadableButton } from '@/components/ui/loadable-button'
import { ErrorMessage } from '@/components/ui/error-message'
import {
  mergeProjectsToOffline,
  OptionError,
  type MergeMode,
  type MergeUIOptionsStore,
} from '@/stores/merge-options'
import { downloadBlob } from '@/utils/download'
import { Button } from '../ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '../ui/collapsible'
import { ProjectList } from './project-list'
import { Field, FieldError, FieldGroup, FieldLabel } from '../ui/field'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select'
import { FileSelectZone } from '../ui/file-button'
import { NumberInput } from '../ui/number-input'
import { Switch } from '../ui/switch'
import { ListInput } from '../ui/list-input'
import { Checkbox } from '../ui/checkbox'
import type { Scene } from '@entry-mergy/entry-utils/types'
import { FastSuspense } from '../fast-suspense'

interface ProjectOptionsUIProps {
  options: MergeUIOptionsStore
  error?: OptionError | undefined
}

const ProjectOptionsUI = observer(
  ({ options, error }: ProjectOptionsUIProps) => {
    const setMergeMode = useCallback(
      (mode: MergeMode) => {
        options.setMergeMode(mode)
      },
      [options]
    )

    const setThumbnail = useCallback(
      (files: FileList) => {
        const file = files[0]
        if (!file) return

        return options.setThumbnail(file)
      },
      [options]
    )

    const setBGM = useCallback(
      (files: FileList) => {
        const file = files[0]
        if (!file) return

        return options.setBGM(file)
      },
      [options]
    )

    const setTimestampGap = useCallback(
      (value?: number) => {
        options.setTimestampGap(value)
      },
      [options]
    )

    const setWaitForBGM = useCallback(
      (value: boolean) => {
        options.setWaitForBGM(value)
      },
      [options]
    )

    const setUseBGMCache = useCallback(
      (value: boolean) => {
        options.setWaitForBGM(true, value)
      },
      [options]
    )

    const setShareFunctions = useCallback(
      (value: boolean) => {
        options.coreOptions.setShareFunctions(value)
      },
      [options]
    )

    return (
      <FieldGroup className='mt-2'>
        <Field>
          <FieldLabel htmlFor='mergeMode'>병합 모드</FieldLabel>
          <Select value={options.mergeMode} onValueChange={setMergeMode}>
            <SelectTrigger id='mergeMode' className='w-45'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value='core'>일반</SelectItem>
                <SelectItem value='kinetic'>타이포그래피</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
        {options.mergeMode == 'kinetic' && (
          <>
            <Field data-invalid={error?.type == 'mustSelectThumbnail'}>
              <FieldLabel htmlFor='thumbnail'>썸네일</FieldLabel>
              <FileSelectZone
                id='thumbnail'
                accept={['image/*']}
                selected={!!options.thumbnail}
                onFileSelect={setThumbnail}
              >
                {options.thumbnail ? (
                  <Image
                    src={options.thumbnail.blobUrl}
                    alt=''
                    width={960}
                    height={540}
                    unoptimized
                  />
                ) : (
                  <>
                    <ImageIcon />
                    이미지를 드롭하거나 선택
                  </>
                )}
              </FileSelectZone>
              {error?.type == 'mustSelectThumbnail' && (
                <FieldError>{error.message}</FieldError>
              )}
            </Field>
            <Field data-invalid={error?.type == 'mustSelectBGM'}>
              <FieldLabel htmlFor='bgm'>BGM</FieldLabel>
              <FileSelectZone
                id='bgm'
                accept={['audio/*']}
                selected={!!options.bgm}
                onFileSelect={setBGM}
              >
                <Music4Icon />
                BGM을 드롭하거나 선택
              </FileSelectZone>
              {error?.type == 'mustSelectBGM' && (
                <FieldError>{error.message}</FieldError>
              )}
            </Field>
            <Field>
              <FieldLabel htmlFor='waitForBGM'>BGM 로딩 기다리기</FieldLabel>
              <Switch
                id='waitForBGM'
                checked={options.waitForBGM}
                onCheckedChange={setWaitForBGM}
                className='float-left'
              />
            </Field>
            <Field data-disabled={!options.waitForBGM}>
              <FieldLabel htmlFor='useBGMCache'>BGM 로딩 캐시 사용</FieldLabel>
              <Switch
                id='useBGMCache'
                checked={options.useBGMCache}
                disabled={!options.waitForBGM}
                onCheckedChange={setUseBGMCache}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor='timestampGap'>
                타임스탬프 사이 간격
              </FieldLabel>
              <NumberInput
                id='timestampGap'
                value={options.timestampGap}
                min={0}
                step='any'
                onValueChange={setTimestampGap}
              />
            </Field>
          </>
        )}
        <Field>
          <FieldLabel>작품 간 공유할 변수·리스트</FieldLabel>
          <ListInput store={options.coreOptions.preserveVar} />
        </Field>
        <Field>
          <FieldLabel htmlFor='shareFunctions'>작품 간 함수 공유</FieldLabel>
          <Switch
            id='shareFunctions'
            checked={options.coreOptions.shareFunctions}
            onCheckedChange={setShareFunctions}
          />
        </Field>
      </FieldGroup>
    )
  }
)

function SceneListErrorComp() {
  return <>작품을 불러오는 중 오류가 발생했습니다.</>
}

function SceneListLoadingComp() {
  return <>작품을 불러오는 중...</>
}

interface SceneListItemProps {
  options: MergeUIOptionsStore
  projectIdx: number
  scene: Scene
  sceneIdx: number
}

const SceneListItem = observer(
  ({ options, projectIdx, scene, sceneIdx }: SceneListItemProps) => {
    const project = options.projects[projectIdx]!
    const enabled = !options.disabledScenesMap.get(project)?.has(sceneIdx)

    const enable = useCallback(() => {
      options.enableSceneOf(projectIdx, sceneIdx)
    }, [options, projectIdx, sceneIdx])

    const disable = useCallback(() => {
      options.disableSceneOf(projectIdx, sceneIdx)
    }, [options, projectIdx, sceneIdx])

    const setEnabled = useCallback(
      (enabled: boolean) => {
        if (enabled) enable()
        else disable()
      },
      [enable, disable]
    )

    return (
      <Field orientation='horizontal'>
        <Checkbox checked={enabled} onCheckedChange={setEnabled} />
        <FieldLabel>{scene.name}</FieldLabel>
      </Field>
    )
  }
)

interface ProjectItemOptionsUIProps {
  options: MergeUIOptionsStore
  i: number
}

const ProjectItemOptionsUI = observer(
  ({ options, i }: ProjectItemOptionsUIProps) => {
    const project = options.projects[i]!

    const startTimestamp = options.timestamps[i - 1] || 0
    const endTimestamp = options.timestamps[i]!

    const setStartTimestamp = useCallback(
      (value?: number) => {
        if (i == 0) return
        if (value && value < 0) value = 0
        options.setTimestampOf(i - 1, value)
      },
      [i, options]
    )

    const setEndTimestamp = useCallback(
      (value?: number) => {
        if (value && value < 0) value = 0
        options.setTimestampOf(i, value)
      },
      [i, options]
    )

    const projectScenesListComp = useMemo(
      () =>
        project.project.then(
          ({ scenes }) =>
            scenes.map((scene, j) => (
              <SceneListItem
                key={j}
                options={options}
                projectIdx={i}
                scene={scene}
                sceneIdx={j}
              />
            )),
          () => <SceneListErrorComp />
        ),
      [i, options, project.project]
    )

    return (
      <FieldGroup>
        {options.mergeMode == 'kinetic' && (
          <Field>
            <FieldLabel>타임스탬프</FieldLabel>
            <NumberInput
              value={startTimestamp}
              min={0}
              step='any'
              onValueChange={setStartTimestamp}
            />
            <NumberInput
              value={endTimestamp}
              min={0}
              step='any'
              onValueChange={setEndTimestamp}
            />
          </Field>
        )}
        <Field>
          <FieldLabel>장면 목록</FieldLabel>
          <FieldGroup>
            <FastSuspense fallback={<SceneListLoadingComp />}>
              {projectScenesListComp}
            </FastSuspense>
          </FieldGroup>
        </Field>
      </FieldGroup>
    )
  }
)

export interface ProjectMergeUIProps extends React.ComponentProps<'div'> {
  options: MergeUIOptionsStore
}

export const ProjectMergeUI = observer((props: ProjectMergeUIProps) => {
  const { className, options, ...rest } = props

  const [merging, setMerging] = useState(false)
  const [error, setError] = useState('')

  const [optionError, setOptionError] = useState<OptionError>()

  const handleChangeProjectList = useCallback((error?: string) => {
    setError(error || '')
  }, [])

  const startMerge = useCallback(async () => {
    setMerging(true)
    setOptionError(undefined)
    setError('')

    try {
      const output = await mergeProjectsToOffline(options)
      downloadBlob(await new Response(output).blob(), 'output.ent')
    } catch (e) {
      if (e instanceof OptionError) return setOptionError(e)
      console.error(e)
      setError(String(e))
    } finally {
      setMerging(false)
    }
  }, [options])

  const getOptionsComp = useCallback(
    (i: number) => <ProjectItemOptionsUI options={options} i={i} />,
    [options]
  )

  return (
    <div {...rest} className={cn('space-y-2 pt-2 pb-4', className)}>
      <ProjectList
        projects={options.projectListStore}
        options={getOptionsComp}
        onChange={handleChangeProjectList}
      />
      <Collapsible>
        <div className='flex gap-2'>
          <CollapsibleTrigger asChild>
            <Button
              variant='ghost'
              className='[&[data-state=open]>*]:rotate-90'
            >
              <ChevronRight className='transition-transform duration-75 ease-out' />
              기타 설정
            </Button>
          </CollapsibleTrigger>
          <div className='flex items-stretch gap-2'>
            {options.projects.length > 0 && (
              <LoadableButton onClick={startMerge} loading={merging}>
                병합
              </LoadableButton>
            )}
            {error && <ErrorMessage>{error}</ErrorMessage>}
          </div>
        </div>
        <CollapsibleContent>
          <ProjectOptionsUI options={options} error={optionError} />
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
})
