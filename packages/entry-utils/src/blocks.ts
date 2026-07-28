import { Block, type Sound } from '.'

// #region primitive

export const val = (value: unknown) => new Block('text', [value])

// #endregion
// #region start

export const whenRun = (blocks: Block[]) => [
  new Block('when_run_button_click'),
  ...blocks,
]

export const whenSceneStarts = (blocks: Block[]) => [
  new Block('when_scene_start'),
  ...blocks,
]

export const startNextScene = () => new Block('start_neighbor_scene', ['next'])

// #endregion
// #region flow

export const waitSeconds = (seconds: Block) =>
  new Block('wait_second', [seconds])

export const waitUntil = (condition: Block) =>
  new Block('wait_until_true', [condition])

export const repeatInf = (blocks: Block[]) =>
  new Block('repeat_inf', [], [blocks])

export const runIf = (condition: Block, blocks: Block[]) =>
  new Block('_if', [condition], [blocks])

export const runIfElse = (
  condition: Block,
  whenTrue: Block[],
  whenFalse: Block[]
) => new Block('if_else', [condition], [whenTrue, whenFalse])

// #endregion
// #region looks

export const say = (content: Block) => new Block('dialog', [content, 'speak'])

// #endregion
// #region sound

export const sound = (sound: Sound) => new Block('get_sounds', [sound.id])

// #endregion
// #region calc

export const getTimerValue = () => new Block('get_project_timer_value')

export const startTimer = () =>
  new Block('choose_project_timer_action', [null, 'START'])

export const resetTimer = () =>
  new Block('choose_project_timer_action', [null, 'RESET'])

export const hideTimer = () =>
  new Block('set_visible_project_timer', [null, 'HIDE'])

// #endregion
// #region func

export const funcLabel = (content: string, next?: Block) =>
  Object.assign(new Block('function_field_label', [content, next]), {
    copyable: false,
  })

export const funcGeneric = (label: Block, content: Block[]) => [
  Object.assign(new Block('function_create', [label], [content]), {
    copyable: false,
    deletable: false,
  }),
]

// #endregion
// #region analysis

export const tableCol = (idx: number) => new Block('get_table_fields', [idx])

// #endregion
// #region dummy

export const stopProject = () => new Block('stop_run')
export const memo = (message: string) => new Block('hidden', [message])

// #endregion
