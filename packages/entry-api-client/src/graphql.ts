import * as z from 'zod/mini'
import { parse } from 'node-html-parser'
import { retry } from './retry'
import { CookieContext } from './request'

export { CookieContext }

type Props = z.infer<typeof Props>
const Props = z.object({
  props: z.object({
    pageProps: z.object({
      csrfToken: z.string(),
      user: z.nullable(
        z.object({
          xToken: z.string(),
        })
      ),
    }),
  }),
})

export class EntryGraphQLClient {
  protected propsURL = 'https://space.playentry.org/avatar'
  protected graphqlURL = 'https://playentry.org/graphql'

  protected props?: Promise<Props>
  protected getServerSideProps = retry(async () => {
    const res = await this.cookieContext.fetch(this.propsURL)
    const html = parse(await res.text())
    const props = JSON.parse(
      html.getElementById('__NEXT_DATA__')?.textContent || ''
    )
    return Props.parse(props)
  })

  constructor(public cookieContext = new CookieContext()) {}

  async request(
    query: string,
    variables?: unknown,
    init?: RequestInit
  ): Promise<unknown> {
    const props = (this.props ||= this.getServerSideProps())
    const { csrfToken, user } = (await props).props.pageProps

    const headers = new Headers({
      'Content-Type': 'application/json',
      'Csrf-Token': csrfToken,
    })
    if (user) headers.set('X-Token', user.xToken)

    const res = await this.cookieContext.fetch(this.graphqlURL, {
      ...init,
      method: 'POST',
      headers,
      body: JSON.stringify({ query, variables }),
    })
    if (res.status == 418) {
      throw TypeError('Failed to send GraphQL request: client request timeout')
    } else if (res.status == 429) {
      throw TypeError('Failed to send GraphQL request: too many requests')
    }

    const text = await res.text()
    if (text == 'form tampered with') {
      if (this.props == props) this.props = this.getServerSideProps()
      return this.request(query, variables, init)
    } else if (text == 'IP_ADDRESS_BANNED') {
      throw TypeError('Failed to send GraphQL request: current ip is banned')
    }
    return JSON.parse(text)
  }

  requestWithTimeout(query: string, variables?: unknown, timeout = 10000) {
    return this.request(query, variables, {
      signal: AbortSignal.timeout(timeout),
    })
  }
}
