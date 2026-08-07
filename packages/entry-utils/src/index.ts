import { generateHash } from '@entry-mergy/common-utils'
import { setScriptOf } from './raw'
import { sound } from './blocks'
import type { Project as ProjectJSON } from './types'

export class IdObject {
  id = generateHash()
}

export class Block {
  constructor(
    public type: string,
    public params: unknown[] = [],
    public statements: Block[][] = []
  ) {}

  add(right: Block) {
    return new Block('calc_basic', [this, 'PLUS', right])
  }

  equals(right: Block) {
    return new Block('boolean_basic_operator', [this, 'EQUAL', right])
  }

  notEquals(right: Block) {
    return new Block('boolean_basic_operator', [this, 'NOT_EQUAL', right])
  }

  gte(right: Block) {
    return new Block('boolean_basic_operator', [
      this,
      'GREATER_OR_EQUAL',
      right,
    ])
  }
}

export type FunctionType = 'normal' | 'value'

export class LocalVariable {
  id?: string

  constructor(
    public name: string,
    public value: unknown = 0
  ) {}

  connectFunc(funcId: string) {
    this.id = `${funcId}_${generateHash()}`
  }
}

export class Func extends IdObject {
  useLocalVariables
  content

  constructor(
    public type: FunctionType,
    content: Block[][] | ((thisFunc: Func) => Block[][]),
    public localVariables?: LocalVariable[]
  ) {
    super()

    this.useLocalVariables = !!localVariables
    localVariables?.forEach((variable) => variable.connectFunc(this.id))
    this.content = JSON.stringify(
      typeof content == 'function' ? content(this) : content
    )
  }

  run(...args: Block[]) {
    return new Block(`func_${this.id}`, args)
  }
}

export class Variable extends IdObject {
  variableType = 'variable'
  object

  constructor(
    public name: string,
    public value: unknown,
    public visible = false,
    public x = 0,
    public y = 0,
    object: EntryObject | null = null,
    public isCloud = false,
    public isRealTime = false,
    public cloudDate = false
  ) {
    super()
    this.object = object && object.id
  }

  get() {
    return new Block('get_variable', [this.id])
  }

  set(value: Block) {
    return new Block('set_variable', [this.id, value])
  }

  add(value: Block) {
    return new Block('change_variable', [this.id, value])
  }
}

export class TimerVariable extends Variable {
  override id = 'brih'
  override variableType = 'timer'

  constructor(
    public override visible = false,
    public override x = 0,
    public override y = 0
  ) {
    super('초시계', '0', visible, x, y)
  }
}

export class AnswerVariable extends Variable {
  override id = '1vu8'
  override variableType = 'answer'

  constructor(
    public override visible = false,
    public override x = 0,
    public override y = 0
  ) {
    super('대답', '0', visible, x, y)
  }
}

export class List extends Variable {
  array
  override variableType = 'list'

  constructor(
    name: string,
    array: unknown[],
    visible = false,
    x = 0,
    y = 0,
    object = null,
    isCloud = false,
    isRealTime = false,
    cloudDate = false
  ) {
    super(name, 0, visible, x, y, object, isCloud, isRealTime, cloudDate)
    this.array = array.map((data) => ({ data }))
  }
}

export class Message extends IdObject {
  constructor(public name: string) {
    super()
  }
}

export class Table extends IdObject {
  chart = []
  data

  constructor(
    public name: string,
    public fields: string[],
    data: string[][]
  ) {
    super()

    this.data = data.map((v) => ({
      key: generateHash(32),
      value: v,
    }))
  }

  get(row: Block, col: Block) {
    return new Block('get_value_from_table', [this.id, row, col])
  }

  set(row: Block, col: Block, value: Block) {
    return new Block('set_value_from_table', [this.id, row, col, value])
  }

  save() {
    return new Block('save_current_table', [this.id])
  }
}

export interface Sprite {
  pictures: Picture[]
  sounds: Sound[]
}

export interface Dimension {
  width: number
  height: number
}

export class Picture extends IdObject {
  thumbUrl?

  constructor(
    name: string,
    imageType: string,
    dimension: Dimension,
    fileurl: string | undefined | null,
    filename: string
  )
  /**
   * @deprecated It doesn't work correctly for offline project uploaded to web
   */
  constructor(
    name: string,
    imageType: string,
    dimension: Dimension,
    fileurl?: string | undefined | null
  )
  constructor(
    public name: string,
    public imageType: string,
    public dimension: Dimension,
    public fileurl?: string,
    public filename?: string
  ) {
    super()
    this.thumbUrl = fileurl
  }
}

export class Sound extends IdObject {
  constructor(
    name: string,
    fileurl: string | undefined | null,
    duration: number,
    ext: string,
    filename: string
  )
  /**
   * @deprecated It doesn't work correctly for offline project uploaded to web
   */
  constructor(name: string, fileurl: string, duration: number, ext: string)
  constructor(
    public name: string,
    public fileurl: string | undefined | null,
    public duration: number,
    public ext: string,
    public filename?: string
  ) {
    super()
  }

  playSeconds(seconds: Block) {
    return new Block('sound_something_second_with_block', [
      sound(this),
      seconds,
    ])
  }

  playAsBGM() {
    return new Block('play_bgm', [sound(this)])
  }
}

export interface Entity {
  x: number
  y: number
  regX: number
  regY: number
  scaleX: number
  scaleY: number
  rotation: number
  direction: number
  width: number
  height: number
  font: string
  visible: boolean
}

export type ObjectType = 'sprite' | 'textBox'
export type RotateMethod = 'free' | 'vertical' | 'none'

export class EntryObject extends IdObject {
  scene
  script: unknown
  selectedPictureId?: string | null

  constructor(
    public name: string,
    script: Block[][],
    scene: Scene,
    public sprite: Sprite,
    public entity: Entity,
    selectedPicture?: number,
    public objectType: ObjectType = 'sprite',
    public lock = false,
    public rotateMethod: RotateMethod = 'free'
  ) {
    super()

    this.scene = scene.id
    this.selectedPictureId =
      selectedPicture == null
        ? null
        : sprite.pictures[selectedPicture]?.id || null
    setScriptOf(this, script)
  }
}

export class Scene extends IdObject {
  constructor(public name: string) {
    super()
  }
}

export class Project implements ProjectJSON {
  interface = {}

  constructor(
    public objects: EntryObject[] = [],
    public scenes: Scene[] = [],
    public variables: Variable[] = [],
    public messages: Message[] = [],
    public functions: Func[] = [],
    public tables: Table[] = [],
    public expansionBlocks = [],
    public aiUtilizeBlocks = [],
    public hardwareLiteBlocks = [],
    public speed = 60,
    public externalModules = [],
    public externalModulesLite = []
  ) {}
}
