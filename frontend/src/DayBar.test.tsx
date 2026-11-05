// @vitest-environment happy-dom
import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import DayBar from './DayBar'
import i18n from './i18n'

describe('day bar', () => {
  afterEach(async () => {
    await i18n.changeLanguage('en')
  })

  it('writes the day in numbers beside the bar', () => {
    render(<DayBar day={{ here: 12, gone: 1, absent: 1, notYet: 1 }} />)

    expect(screen.getByText('12 of 15 here · 1 gone home · 1 absent · 1 not here yet')).toBeInTheDocument()
  })

  it('draws a part only for what there is, each with its number', () => {
    const { container } = render(<DayBar day={{ here: 3, gone: 0, absent: 2, notYet: 0 }} />)

    const parts = [...container.querySelectorAll('[data-part]')].map((part) => [part.getAttribute('data-part'), part.textContent])
    expect(parts).toEqual([
      ['here', '3'],
      ['absent', '2'],
    ])
  })

  it('is in German too', async () => {
    await i18n.changeLanguage('de')
    render(<DayBar day={{ here: 2, gone: 1, absent: 0, notYet: 3 }} />)

    expect(screen.getByText('2 von 6 da · 1 abgeholt · 0 abwesend · 3 noch nicht da')).toBeInTheDocument()
  })
})

describe('day bar for screen readers', () => {
  it('reads one plain sentence, not the bar and the dotted line', () => {
    const { container } = render(<DayBar day={{ here: 12, gone: 1, absent: 1, notYet: 1 }} />)

    const read = container.querySelector('.visually-hidden')
    expect(read).toHaveTextContent('12 of 15 here, 1 gone home, 1 absent, 1 not here yet.')
    expect(screen.getByText('12 of 15 here · 1 gone home · 1 absent · 1 not here yet')).toHaveAttribute('aria-hidden', 'true')
  })
})
