import { test, expect } from '@playwright/test'
import { launchApp, getMainWindow } from './helpers.js'

// HTOO-371. The policy is checked from a real window, because the two ways it
// can be wrong are both invisible from source.
//
// Note what this file does NOT do: intercept the response to read the header
// back. `session.webRequest.onHeadersReceived` accepts only ONE listener, and a
// second registration REPLACES the first — so a test that hooked it to inspect
// the header would tear out the app's own CSP hook and then measure its absence.
// The header string and the installer are pinned in
// `src/main/__tests__/windowSecurity.test.js`, and the call site in `index.js`
// is pinned there too, for the same reason `remoteSession.test.js` pins its
// call-site position.
//
// What is left is what only a running window can answer: whether the policy is
// too tight, and whether the part that was tightened actually took effect.

test.describe('content security policy', () => {
  let electronApp

  test.afterEach(async () => {
    await electronApp?.close()
  })

  test('the renderer blocks none of its own resources while it boots', async () => {
    // A CSP that is too tight fails in the direction that hurts here: a blocked
    // subresource leaves a window that looks like it works with something
    // missing. HTOO-371 removed `http:` and `https:` from `img-src`, which is
    // exactly the change that could do it, so listen for the event the browser
    // fires when it blocks something.
    ;({ electronApp } = await launchApp())
    const page = await getMainWindow(electronApp)

    const violations = await page.evaluate(async () => {
      const seen = []
      document.addEventListener('securitypolicyviolation', (e) =>
        seen.push(`${e.violatedDirective} blocked ${e.blockedURI}`)
      )
      await new Promise((r) => setTimeout(r, 1500))
      return seen
    })

    expect(violations, 'the renderer blocked its own resources').toEqual([])
  })

  test('a policy is in force, and it refuses a remote image', async () => {
    // The substantive half of the tightening. Asserts the effect rather than the
    // header text: the document must refuse to load an image from the network.
    //
    // Proves a policy is applied at all, too — an app with no CSP loads this and
    // reports `false`, so the assertion fails rather than passing vacuously.
    ;({ electronApp } = await launchApp())
    const page = await getMainWindow(electronApp)

    const blocked = await page.evaluate(async () => {
      let violated = false
      const onViolation = (e) => {
        if (e.violatedDirective.startsWith('img-src')) violated = true
      }
      document.addEventListener('securitypolicyviolation', onViolation)
      const img = document.createElement('img')
      // Never resolved: the point is that the request is refused before DNS.
      img.src = 'https://example.invalid/probe.png'
      document.body.appendChild(img)
      await new Promise((r) => setTimeout(r, 1000))
      img.remove()
      document.removeEventListener('securitypolicyviolation', onViolation)
      return violated
    })

    expect(blocked, 'a remote image was not refused — img-src is not in force').toBe(true)
  })
})
