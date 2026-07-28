import { mergeProject } from '@entry-mergy/core'
import { Project as ProjectJSON } from '@entry-mergy/entry-utils/types'
import { deepCopy } from '@entry-mergy/common-utils'

import {
  AnswerVariable,
  type Block,
  EntryObject,
  Func,
  Picture,
  Project,
  Scene,
  Sound,
  Table,
  TimerVariable,
  Variable,
} from '@entry-mergy/entry-utils'

import {
  funcGeneric,
  funcLabel,
  getTimerValue,
  hideTimer,
  memo,
  repeatInf,
  resetTimer,
  runIf,
  runIfElse,
  say,
  startNextScene,
  startTimer,
  stopProject,
  tableCol,
  val,
  waitSeconds,
  waitUntil,
  whenRun,
  whenSceneStarts,
} from '@entry-mergy/entry-utils/blocks'

import type {
  BGM,
  KineticMergeOptions,
  Thumbnail,
  WaitForBGMOptions,
} from './types'

export { ProjectJSON as Project, type KineticMergeOptions }

// #region Base Project

interface BaseProjectOptions {
  thumbnail: Thumbnail
  bgm: BGM
  waitForBGM?: boolean | WaitForBGMOptions | undefined
  memos?: string[] | undefined
}

function getBaseProject(options: BaseProjectOptions): ProjectJSON {
  const project = new Project()

  const bgm = new Sound(
    'BGM',
    options.bgm.url,
    options.bgm.duration,
    options.bgm.format
  )

  let mainCode
  if (options.waitForBGM) {
    const useCache =
      typeof options.waitForBGM == 'object' && options.waitForBGM.useCache

    const loadedVariable = new Variable('__entryMergy_loaded', 0)
    const recursiveFunc = new Func('normal', (func) => [
      funcGeneric(funcLabel('__entryMergy_throwCallStackError'), [func.run()]),
    ])
    const loadedTable =
      useCache && new Table('__entryMergy_loaded', ['loaded'], [['0']])

    project.variables.push(loadedVariable)
    project.functions.push(recursiveFunc)
    if (loadedTable) project.tables.push(loadedTable)

    const checkingBGMCode = [
      recursiveFunc.run(),
      loadedVariable.set(bgm.playSeconds(val('Infinity'))),
    ]

    mainCode = whenRun([
      hideTimer(),
      repeatInf([
        loadedVariable.set(val(1)),
        ...(loadedTable
          ? [
              runIf(loadedTable.get(val(2), tableCol(1)).notEquals(val(1)), [
                ...checkingBGMCode,
                runIf(loadedVariable.get().equals(val(1)), [
                  loadedTable.set(val(2), tableCol(1), val(1)),
                  loadedTable.save(),
                ]),
              ]),
            ]
          : checkingBGMCode),
        runIfElse(
          loadedVariable.get().equals(val(1)),
          [bgm.playAsBGM(), startTimer(), startNextScene()],
          [say(val('소리 로딩 중...')), waitSeconds(val(1.5))]
        ),
      ]),
    ])
  } else {
    mainCode = whenRun([
      hideTimer(),
      bgm.playAsBGM(),
      startTimer(),
      startNextScene(),
    ])
  }

  const allCode = options.memos
    ? [options.memos.map(memo), mainCode]
    : [mainCode]

  const thumbnailScene = new Scene('썸네일')
  const thumbnailObject = new EntryObject(
    '__entryMergy_thumbnail',
    allCode,
    thumbnailScene,
    {
      pictures: [
        new Picture(
          '__entryMergy_thumbnail',
          options.thumbnail.format,
          {
            width: options.thumbnail.width,
            height: options.thumbnail.height,
          },
          options.thumbnail.url
        ),
      ],
      sounds: [bgm],
    },
    {
      x: 0,
      y: 0,
      regX: options.thumbnail.width / 2,
      regY: options.thumbnail.height / 2,
      scaleX: 480 / options.thumbnail.width,
      scaleY: 270 / options.thumbnail.height,
      rotation: 0,
      direction: 0,
      width: options.thumbnail.width,
      height: options.thumbnail.height,
      font: 'undefinedpx ',
      visible: true,
    },
    0,
    'sprite',
    true
  )

  project.scenes.push(thumbnailScene)
  project.objects.push(thumbnailObject)

  project.variables.push(new TimerVariable(true, -3180, -3180))
  project.variables.push(new AnswerVariable(false, -3180, -3180))
  return project
}

// #endregion
// #region Analyze Project

const analyzedProjectCache = new WeakMap<ProjectJSON, AnalyzedProjectData>()

interface AnalyzedProjectData {
  isZeroTimestamp: boolean
}

function analyzeProjectData(project: ProjectJSON): AnalyzedProjectData {
  const cache = analyzedProjectCache.get(project)
  if (cache) return cache

  // temp
  return {
    isZeroTimestamp: false,
  }
}

// #endregion
// #region Task Codes

const resetTimerWithOffset = (timerOffsetVariable: Variable) => [
  timerOffsetVariable.add(getTimerValue()),
  resetTimer(),
]

const waitForTimestampWithOffset = (
  timerOffsetVariable: Variable,
  to: number
) => [waitUntil(getTimerValue().add(timerOffsetVariable.get()).gte(val(to)))]

function getTaskCodes(project: ProjectJSON, config: ProcessProjectConfig) {
  const currentProjectData = analyzeProjectData(project)
  const nextProjectData =
    config.nextProject && analyzeProjectData(config.nextProject)

  const preTaskCode =
    currentProjectData.isZeroTimestamp ||
    (config.forceZeroTimestamp && config.currentTimestamp)
      ? resetTimerWithOffset(config.timerOffsetVariable)
      : []

  const postTaskCode = [
    ...waitForTimestampWithOffset(
      config.timerOffsetVariable,
      config.nextTimestamp
    ),
    ...(nextProjectData
      ? [
          ...(nextProjectData.isZeroTimestamp || config.forceZeroTimestamp
            ? []
            : resetTimerWithOffset(config.timerOffsetVariable)),
          startNextScene(),
        ]
      : [stopProject()]),
  ]

  return { preTaskCode, postTaskCode }
}

// #endregion
// #region Process Project

function removeEmptyScenes(project: ProjectJSON) {
  const { scenes, objects } = project

  for (let i = 0; i < scenes.length; ++i) {
    const scene = scenes[i]!
    if (objects.every((v) => v.scene != scene.id)) scenes.splice(i--, 1)
  }

  return project
}

function removeBlocksRecursive(blocks: Block[][], removeBlockTypes: string[]) {
  for (const thread of blocks) {
    for (let i = 0; i < thread.length; ++i) {
      const block = thread[i]!
      if (removeBlockTypes.includes(block.type)) thread.splice(i--, 1)
    }
  }
}

function handleSingleScene(project: ProjectJSON, config: ProcessProjectConfig) {
  for (const obj of project.objects) {
    const script = JSON.parse(obj.script)
    if (!Array.isArray(script)) continue

    removeBlocksRecursive(script, [
      'choose_project_timer_action',
      'set_visible_project_timer',
      'start_neighbor_scene',
      'stop_run',
      'sound_something_with_block',
      'sound_something_second_with_block',
      'sound_from_to',
      'sound_something_wait_with_block',
      'sound_something_second_wait_with_block',
      'sound_from_to_and_wait',
      'play_bgm',
      'stop_bgm',
    ])

    obj.script = JSON.stringify(script)
  }

  const firstScene = project.scenes[0]!
  firstScene.name = String(config.projectIdx + 1)

  const firstObject = project.objects.find((v) => v.scene == firstScene.id)
  if (!firstObject) return

  const script = JSON.parse(firstObject.script)
  if (!Array.isArray(script)) return

  const { preTaskCode, postTaskCode } = getTaskCodes(project, config)
  script.unshift(whenSceneStarts([...preTaskCode, ...postTaskCode]))
  firstObject.script = JSON.stringify(script)
}

function handleMultipleScenes(
  project: ProjectJSON,
  config: ProcessProjectConfig
) {
  // temp - required to remove blocks

  const firstScene = project.scenes[0]!
  const lastScene = project.scenes[project.scenes.length - 1]!

  project.scenes.forEach((scene, i) => {
    scene.name = `${config.projectIdx + 1}-${i + 1}`
  })

  const firstSceneObj = project.objects.find((v) => v.scene == firstScene.id)
  const lastSceneObj = project.objects.find((v) => v.scene == lastScene.id)
  if (!firstSceneObj || !lastSceneObj) return

  const firstSceneScript = JSON.parse(firstSceneObj.script)
  const lastSceneScript = JSON.parse(lastSceneObj.script)
  if (!Array.isArray(firstSceneScript) || !Array.isArray(lastSceneScript))
    return

  const { preTaskCode, postTaskCode } = getTaskCodes(project, config)
  firstSceneScript.unshift(whenSceneStarts(preTaskCode))
  lastSceneScript.unshift(whenSceneStarts(postTaskCode))

  firstSceneObj.script = JSON.stringify(firstSceneScript)
  lastSceneObj.script = JSON.stringify(lastSceneScript)
}

interface ProcessProjectConfig {
  projectIdx: number
  currentTimestamp: number
  nextTimestamp: number
  nextProject: ProjectJSON | undefined
  timerOffsetVariable: Variable
  forceZeroTimestamp?: boolean
}

function processProject(project: ProjectJSON, config: ProcessProjectConfig) {
  removeEmptyScenes(project)

  if (project.scenes.length > 1) handleMultipleScenes(project, config)
  else handleSingleScene(project, config)

  return project
}

// #endregion
// #region Exports

export function mergeAllKinetic(
  projects: ProjectJSON[],
  options: KineticMergeOptions
) {
  const { coreOptions, timestamps, timestampGap = 0, ...restOptions } = options

  const base = getBaseProject(restOptions)
  const timerOffset = new Variable('__entryMergy_timeOffset', 0)
  base.variables.push(timerOffset)

  projects.forEach((project, i) => {
    const currentTimestampTemp = timestamps[i - 1]
    mergeProject(
      base,
      processProject(deepCopy(project), {
        projectIdx: i,
        currentTimestamp:
          typeof currentTimestampTemp == 'number'
            ? currentTimestampTemp + timestampGap
            : 0,
        nextTimestamp: timestamps[i]!,
        nextProject: projects[i + 1],
        timerOffsetVariable: timerOffset,
        forceZeroTimestamp: timestampGap != 0,
      }),
      coreOptions
    )
  })
  return base
}

export async function mergeAllKineticAsync(
  projects: Promise<ProjectJSON>[],
  options: KineticMergeOptions
) {
  const { coreOptions, timestamps, timestampGap = 0, ...restOptions } = options

  const base = getBaseProject(restOptions)
  const timerOffset = new Variable('__entryMergy_timeOffset', 0)
  base.variables.push(timerOffset)

  let i = 0
  for await (const project of projects) {
    const currentTimestampTemp = timestamps[i - 1]
    mergeProject(
      base,
      processProject(deepCopy(project), {
        projectIdx: i,
        currentTimestamp:
          typeof currentTimestampTemp == 'number'
            ? currentTimestampTemp + timestampGap
            : 0,
        nextTimestamp: timestamps[i]!,
        nextProject: await projects[i + 1],
        timerOffsetVariable: timerOffset,
        forceZeroTimestamp: timestampGap != 0,
      }),
      coreOptions
    )

    ++i
  }
  return base
}

// #endregion
