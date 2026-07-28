import { CookieJar } from 'tough-cookie'

export class CookieContext {
  private jar = new CookieJar()

  protected originalFetch(...args: Parameters<typeof fetch>) {
    return fetch(...args)
  }

  async fetch(...args: Parameters<typeof this.originalFetch>) {
    const [input, init] = args
    const req = new Request(input, init)
    if (req.credentials == 'omit') return this.originalFetch(req)

    const { jar } = this
    req.headers.append('Cookie', jar.getCookieStringSync(req.url))

    const res = await this.originalFetch(req)
    for (const cookie of res.headers.getSetCookie())
      jar.setCookie(cookie, req.url)

    return res
  }
}
