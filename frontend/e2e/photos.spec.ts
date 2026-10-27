import { expect, test, type Locator } from '@playwright/test'
import { fileURLToPath } from 'node:url'
import { logInAsAdmin } from './credentials.ts'

const garden = fileURLToPath(new URL('./fixtures/garden.jpg', import.meta.url))

async function expectShown(image: Locator) {
  await expect(image).toBeVisible()
  // Loaded and decoded, not just placed on the page.
  await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.naturalWidth)).toBeGreaterThan(0)
}

test('photos are shown with photo Consent only, and pick-up persons with theirs', async ({ page }) => {
  // Unique per run, since the stack's database keeps data between runs.
  const lastName = `Photos${Date.now()}`
  await logInAsAdmin(page)
  await page.goto('/children/new')
  await page.getByLabel('First name').fill('Lena')
  await page.getByLabel('Last name').fill(lastName)
  await page.getByRole('button', { name: 'Save' }).tap()

  const gallery = page.getByRole('region', { name: 'Photos' })
  await expect(gallery).toContainText('No photo Consent')
  const photos = page.getByRole('region', { name: 'Consents' }).getByRole('listitem').filter({ hasText: 'Photos' })
  await photos.getByRole('button', { name: 'Record giving of Photos' }).tap()
  await photos.getByRole('form', { name: 'Record giving of Photos' }).getByRole('button', { name: 'Save' }).tap()

  await gallery.getByLabel('Add photo').setInputFiles(garden)
  const photo = gallery.getByRole('img', { name: /^Photo from/ })
  await expectShown(photo)
  const thumbnail = await photo.getAttribute('src')

  const pickUp = page.getByRole('region', { name: 'Who may pick up' })
  await pickUp.getByRole('button', { name: 'Add pick-up person' }).tap()
  const pickUpForm = pickUp.getByRole('form', { name: 'Add pick-up person' })
  await pickUpForm.getByLabel('Name').fill('Tom Weber')
  await pickUpForm.getByRole('button', { name: 'Save' }).tap()
  await pickUp.getByLabel('Add photo of Tom Weber').setInputFiles(garden)
  await expectShown(pickUp.getByRole('img', { name: 'Photo of Tom Weber' }))

  // Withdrawn today: the gallery empties, and the photo's address answers no more.
  await photos.getByRole('button', { name: 'Record withdrawal of Photos' }).tap()
  await photos.getByRole('form', { name: 'Record withdrawal of Photos' }).getByRole('button', { name: 'Save' }).tap()
  await expect(gallery).toContainText('No photo Consent')
  expect((await page.request.get(thumbnail!)).status()).toBe(404)
  await expectShown(pickUp.getByRole('img', { name: 'Photo of Tom Weber' }))
})
