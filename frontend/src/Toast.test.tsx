// @vitest-environment happy-dom
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import './i18n'
import { ToastProvider } from './Toast'
import { useToast } from './toastContext'

function Checker({ onUndo }: { onUndo?: () => void }) {
  const toast = useToast()
  return (
    <button type="button" onClick={() => toast('Mia is here (07:48)', onUndo)}>
      Check in
    </button>
  )
}

describe('the toast', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('announces what happened and goes away by itself', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    render(
      <ToastProvider>
        <Checker />
      </ToastProvider>,
    )

    act(() => screen.getByRole('button', { name: 'Check in' }).click())
    const message = screen.getByText('Mia is here (07:48)')
    expect(message.closest('[aria-live="polite"]')).not.toBeNull()
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull()

    act(() => vi.advanceTimersByTime(4600))
    expect(screen.queryByText('Mia is here (07:48)')).toBeNull()
  })

  it('offers Undo for 7 seconds, and Undo takes the step back', async () => {
    const undo = vi.fn()
    render(
      <ToastProvider>
        <Checker onUndo={undo} />
      </ToastProvider>,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Check in' }))
    await userEvent.click(screen.getByRole('button', { name: 'Undo' }))

    expect(undo).toHaveBeenCalledOnce()
    expect(screen.queryByText('Mia is here (07:48)')).toBeNull()
  })
})
