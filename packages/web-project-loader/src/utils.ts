const projectRegex =
  /(?i:playentry\.org)\/((project|ws|wsai|event\/codingmate|iframe|noframe|print)\/[\da-f]{24}(\?.*groupId=[\da-f]{24})?|group\/project\/[\da-f]{24}\/[\da-f]{24})|(?i:naver\.me)\/(\w{8})/g

const commonProjectRegex =
  /(?i:playentry\.org)\/(?:project|ws|wsai|event\/codingmate|iframe|noframe|print)\/([\da-f]{24})/

const groupProjectRegex =
  /(?i:playentry\.org)\/(?:(?:project|ws|wsai|event\/codingmate|iframe|noframe|print)\/([\da-f]{24})(?:\?.*groupId=([\da-f]{24}))?|group\/project\/([\da-f]{24})\/([\da-f]{24}))/

const shortenProjectRegex = /(?i:naver\.me)\/(\w{8})/

export interface CommonProjectLink {
  type: 'common'
  url: string
  id: string
  name?: string
}

export interface GroupProjectLink {
  type: 'group'
  url: string
  id: [id: string, groupId: string]
  name?: string
}

export interface ShortenProjectLink {
  type: 'shorten'
  url: string
  id: string
  name?: string
}

export type ProjectLink = CommonProjectLink | GroupProjectLink

export type ProjectLinkIncludeShorten = ProjectLink | ShortenProjectLink

export function getProjectLink(url: string): ProjectLink | null {
  const groupMatch = url.match(groupProjectRegex)
  if (groupMatch?.[4])
    return { type: 'group', url, id: [groupMatch[3]!, groupMatch[4]] }
  if (groupMatch?.[2])
    return { type: 'group', url, id: [groupMatch[1]!, groupMatch[2]] }

  const commonMatch = url.match(commonProjectRegex)
  if (commonMatch?.[1]) return { type: 'common', url, id: commonMatch[1] }

  return null
}

export function getProjectLinkIncludeShorten(
  url: string
): ProjectLinkIncludeShorten | null {
  const link = getProjectLink(url)
  if (link) return link

  const shortenMatch = url.match(shortenProjectRegex)
  if (shortenMatch?.[1]) return { type: 'shorten', url, id: shortenMatch[1] }

  return null
}

function getProjectLinksBase<T extends ProjectLinkIncludeShorten>(
  cb: (url: string) => T | null,
  url: string,
  name?: string
) {
  return (
    url
      .match(projectRegex)
      ?.map((url) => {
        const id = cb(url)
        if (id != null && typeof name == 'string') {
          return { ...id, name }
        } else {
          return id
        }
      })
      .filter((v) => v != null) || []
  )
}

export function getProjectLinks(url: string, name?: string): ProjectLink[] {
  return getProjectLinksBase(getProjectLink, url, name)
}

export function getProjectLinksIncludeShorten(
  url: string,
  name?: string
): ProjectLinkIncludeShorten[] {
  return getProjectLinksBase(getProjectLinkIncludeShorten, url, name)
}
