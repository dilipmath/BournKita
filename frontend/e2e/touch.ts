import type { Locator, Page } from '@playwright/test'

/** Drags `from` onto `to` with a finger: real touch input, as a tablet sends it. Both must fit
 * on screen together, as they would for a finger. */
export async function touchDrag(page: Page, from: Locator, to: Locator): Promise<void> {
  // A touch must start on screen: scroll the grip into view first (both ends must then be visible).
  await from.scrollIntoViewIfNeeded()
  const start = await from.boundingBox()
  const end = await to.boundingBox()
  if (!start || !end) throw new Error('Nothing to drag, or nowhere to drop it')
  const [x0, y0] = [start.x + start.width / 2, start.y + start.height / 2]
  const [x1, y1] = [end.x + end.width / 2, end.y + end.height / 2]
  const cdp = await page.context().newCDPSession(page)
  const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', x: number, y: number) =>
    cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] })
  await touch('touchStart', x0, y0)
  for (let step = 1; step <= 10; step++) {
    await touch('touchMove', x0 + ((x1 - x0) * step) / 10, y0 + ((y1 - y0) * step) / 10)
  }
  // Come to rest on the target before letting go, as a finger does: released at speed, Chrome
  // takes it for a fling and swallows the next tap.
  for (let rest = 0; rest < 3; rest++) {
    await touch('touchMove', x1, y1)
    await page.waitForTimeout(50)
  }
  await touch('touchEnd', x1, y1)
  await cdp.detach()
}
