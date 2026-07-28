import * as z from 'zod/mini'

export interface IdObject {
  id: string
}

export const IdObject = z.looseObject({
  id: z.string(),
}) satisfies z.ZodMiniType<IdObject>

export interface EntryObject extends IdObject {
  script: string
  scene: string
  sprite: {
    pictures: IdObject[]
    sounds: IdObject[]
  }
}

export const EntryObject = z.looseObject({
  ...IdObject.shape,
  script: z.string(),
  scene: z.string(),
  sprite: z.looseObject({
    pictures: z.array(IdObject),
    sounds: z.array(IdObject),
  }),
}) satisfies z.ZodMiniType<EntryObject>

export interface Scene extends IdObject {
  name: string
}

export const Scene = z.looseObject({
  ...IdObject.shape,
  name: z.string(),
}) satisfies z.ZodMiniType<Scene>

export interface Variable extends IdObject {
  name: string
  variableType: string
  object: string | null
}

export const Variable = z.looseObject({
  ...IdObject.shape,
  name: z.string(),
  variableType: z.string(),
  object: z.nullable(z.string()),
}) satisfies z.ZodMiniType<Variable>

export interface Func extends IdObject {
  content: string
}

export const Func = z.looseObject({
  ...IdObject.shape,
  content: z.string(),
}) satisfies z.ZodMiniType<Func>

export interface Project {
  objects: EntryObject[]
  scenes: Scene[]
  variables: Variable[]
  messages: IdObject[]
  functions: Func[]
  tables: IdObject[]
}

export const Project = z.looseObject({
  objects: z.array(EntryObject),
  scenes: z.array(Scene),
  variables: z.array(Variable),
  messages: z.array(IdObject),
  functions: z.array(Func),
  tables: z.array(IdObject),
}) satisfies z.ZodMiniType<Project>
