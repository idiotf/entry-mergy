import { NextResponse, type NextRequest } from 'next/server'
import {
  EntryGraphQLClient,
  selectProjectMany,
  type ProjectId,
} from '@entry-mergy/entry-api-client'
import { getProjectIdFromShortenURL } from '@entry-mergy/web-project-loader'

const commonIdRegex = /^[\da-f]{24}$/
const groupIdRegex = /^([\da-f]{24}):([\da-f]{24})$/
const shortenIdRegex = /^\w{8}$/

function resolveUserInputId(userInputId: string) {
  return userInputId.split(',').map((userInputId): ProjectId | null => {
    if (userInputId.match(commonIdRegex)) return userInputId

    const groupId = userInputId.match(groupIdRegex)
    if (groupId) return [groupId[1]!, groupId[2]!]

    if (userInputId.match(shortenIdRegex)) return userInputId

    return null
  })
}

const client = new EntryGraphQLClient()

export async function GET(
  req: NextRequest,
  ctx: RouteContext<'/api/project/[id]'>
) {
  const { id: userInputId } = await ctx.params
  const resolvedIdIncludeShorten = resolveUserInputId(userInputId)

  const resolvedId = await Promise.all(
    resolvedIdIncludeShorten.map((id) => {
      if (typeof id != 'string' || id.length == 24) return id
      return getProjectIdFromShortenURL(id).then(
        (link) => link.id,
        () => null
      )
    })
  )

  try {
    const projects = await selectProjectMany(client, resolvedId, {
      signal: req.signal,
    })
    return NextResponse.json(
      projects.map((project, i) => {
        const id = resolvedId[i]
        return id == null ? null : { id, project }
      })
    )
  } catch (e) {
    console.error(e)
    return NextResponse.json(
      resolvedId.map((id) => {
        if (typeof id == 'string') return { id, project: null }
        return id && { id: id[0], project: null }
      })
    )
  }
}
