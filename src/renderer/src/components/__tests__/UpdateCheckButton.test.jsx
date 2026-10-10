/**
 * @vitest-environment jsdom
 */
// house module: update-check v1 — change it in the template, then port
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react'
import { appIdentity } from '@shared/appIdentity.js'
import UpdateCheckButton from '../UpdateCheckButton'

// JavaScript port of the template's UpdateCheckButton.test.tsx, with plain DOM
// assertions (Creidhne has no jest-dom).

const URL_020 = `${appIdentity.releaseUrlPrefix}tag/v0.2.0`

beforeEach(() => {
  window.localStorage.clear()
  window.electronAPI = {}
})

afterEach(() => {
  cleanup()
  delete window.electronAPI
})

async function clickWith(result) {
  const check = vi.fn(async () => {
    if (result instanceof Error) throw result
    return result
  })
  window.electronAPI.checkForUpdate = check
  render(<UpdateCheckButton currentVersion="0.1.0" />)
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /check for updates/i }))
  })
  return check
}

const resultText = () => screen.getByTestId('update-check-result').textContent

describe('UpdateCheckButton', () => {
  it('shows nothing until the user asks', () => {
    window.electronAPI.checkForUpdate = vi.fn()
    render(<UpdateCheckButton currentVersion="0.1.0" />)
    expect(window.electronAPI.checkForUpdate).not.toHaveBeenCalled()
    expect(screen.queryByTestId('update-check-result')).toBeNull()
  })

  it('says the app is up to date, with the running version', async () => {
    await clickWith({ ok: true, update: null })
    expect(resultText()).toBe(`${appIdentity.productName} is up to date (0.1.0).`)
  })

  it('names a newer version and links to it', async () => {
    await clickWith({ ok: true, update: { version: '0.2.0', url: URL_020 } })
    expect(resultText()).toContain('0.2.0 is available.')
    expect(screen.getByRole('link', { name: /view release/i }).getAttribute('href')).toBe(URL_020)
  })

  it('shows a version the user closed in the notice: they asked', async () => {
    window.localStorage.setItem(`${appIdentity.updateKey}:dismissedVersion`, '0.2.0')
    await clickWith({ ok: true, update: { version: '0.2.0', url: URL_020 } })
    expect(resultText()).toContain('0.2.0 is available.')
  })

  it('explains a failure in plain words', async () => {
    await clickWith({ ok: false, reason: 'no-entry' })
    expect(resultText()).toBe(
      'Could not check for updates. The version list has no entry for this app yet.'
    )
  })

  it('reports a rejected IPC as a failure, not as up to date', async () => {
    await clickWith(new Error('ipc'))
    expect(resultText()).toMatch(/Could not check/)
  })

  it('is disabled while a check runs', async () => {
    let finish = () => undefined
    window.electronAPI.checkForUpdate = vi.fn(() => new Promise((resolve) => (finish = resolve)))
    render(<UpdateCheckButton currentVersion="0.1.0" />)
    fireEvent.click(screen.getByRole('button', { name: /check for updates/i }))
    expect(screen.getByRole('button', { name: /checking/i }).disabled).toBe(true)
    await act(async () => finish({ ok: true, update: null }))
    expect(screen.getByRole('button', { name: /check for updates/i }).disabled).toBe(false)
  })
})
