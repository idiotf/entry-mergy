import * as z from 'zod/mini'
import { Project } from '@entry-mergy/entry-utils/types'
import type { EntryGraphQLClient } from './graphql'

export type ProjectId = string | readonly [id: string, groupId: string]

const projectIdRegex = /^[\da-f]{24}$/
const isProjectId = (id: string) => id.match(projectIdRegex)

const getIndexIdentifier = (i: number) => '_' + i

function getProjectQuery(id: ProjectId | null, i: number) {
  if (id === null) return ''

  const projectId = typeof id == 'string' ? id : id[0]
  const groupId = typeof id == 'string' ? null : id[1]
  if (!isProjectId(projectId) || (groupId && !isProjectId(groupId))) return ''

  return `${getIndexIdentifier(i)}:project(id:"${projectId}"${groupId ? `groupId:"${groupId}"` : ''}){name description description2 description3 speed objects variables messages functions tables scenes}`
}

const ProjectsData = z.object({
  data: z.record(z.string(), z.unknown()),
})

const ProjectWithMetadata = z.looseObject({
  ...Project.shape,
  name: z.string(),
  description: z.nullable(z.string()),
  description2: z.nullable(z.string()),
  description3: z.nullable(z.string()),
})

export async function selectProjectMany(
  client: EntryGraphQLClient,
  id: readonly (ProjectId | null)[],
  init?: RequestInit
) {
  const queries = id.map(getProjectQuery).join('')
  if (!queries) return id.map(() => null)

  const { data } = ProjectsData.parse(
    await client.request(`query{${queries}}`, undefined, init)
  )

  return id.map(
    (_, i) =>
      ProjectWithMetadata.safeParse(data[getIndexIdentifier(i)]).data || null
  )
}
