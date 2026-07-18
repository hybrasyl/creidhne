import { describe, it, expect } from 'vitest'
import { buildIssueUrl, truncateBodyForUrl } from '../issueUrl.js'

describe('buildIssueUrl', () => {
  it('encodes title, body and comma-joined labels', () => {
    const url = buildIssueUrl({
      owner: 'hybrasyl',
      repo: 'cernunnos',
      title: 'Crash on save',
      body: 'It broke: a&b',
      labels: ['app:creidhne', 'version:1.8.0']
    })
    expect(url.startsWith('https://github.com/hybrasyl/cernunnos/issues/new?')).toBe(true)
    expect(url).toContain('title=Crash+on+save')
    expect(url).toContain('body=It+broke%3A+a%26b')
    // labels joined by comma, the ':' encoded
    expect(url).toContain('labels=app%3Acreidhne%2Cversion%3A1.8.0')
  })

  it('omits empty params', () => {
    const url = buildIssueUrl({ owner: 'o', repo: 'r' })
    expect(url).toBe('https://github.com/o/r/issues/new?')
  })
})

describe('truncateBodyForUrl', () => {
  const params = (body) => ({
    owner: 'hybrasyl',
    repo: 'cernunnos',
    title: 'T',
    body,
    labels: ['app:creidhne']
  })

  it('does not truncate when the URL is within budget', () => {
    const body = 'short body'
    const { url, truncated } = truncateBodyForUrl(params(body), 4000)
    expect(truncated).toBe(false)
    expect(url).toContain('body=short+body')
  })

  it('truncates an over-long body and keeps the URL within budget', () => {
    const MAX = 300
    const body = 'x'.repeat(5000)
    const { url, truncated } = truncateBodyForUrl(params(body), MAX)
    expect(truncated).toBe(true)
    expect(url.length).toBeLessThanOrEqual(MAX)
    // Parse the body param back out (URLSearchParams decodes '+' to space).
    const decodedBody = new URL(url).searchParams.get('body')
    expect(decodedBody).toContain('diagnostics truncated')
  })
})
