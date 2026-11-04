import { expect, test } from '@playwright/test'
import { accountMenu, choosePassword, logIn, logInAsAdmin, logOut } from './credentials.ts'
import { linkFromEmail } from './mailpit.ts'

test('a Teacher with one Group logs in, lands on its Today view and checks a Child in by tap', async ({ page }) => {
  // Unique per run, since the stack's database keeps data between runs.
  const run = Date.now()
  const groupName = `Ladybirds ${run}`
  const email = `teacher-${run}@kita.example`
  const lastName = `Start${run}`
  const password = 'a teacher long password'
  await logInAsAdmin(page)

  await page.getByRole('link', { name: 'Administration' }).tap()
  await page.getByRole('link', { name: 'Groups' }).tap()
  const newGroup = page.getByRole('form', { name: 'New Group' })
  await newGroup.getByLabel('Name').fill(groupName)
  await newGroup.getByRole('radio', { name: 'Ladybird' }).check()
  await newGroup.getByRole('button', { name: 'Create Group' }).tap()
  await expect(page.getByRole('heading', { name: groupName })).toBeVisible()

  await page.goto('/children/new')
  await page.getByLabel('First name').fill('Lena')
  await page.getByLabel('Last name').fill(lastName)
  await page.getByRole('button', { name: 'Save' }).tap()
  const group = page.getByLabel('Group', { exact: true })
  await group.selectOption({ label: `🐞 ${groupName}` })
  await expect(group).not.toHaveValue('')

  await page.getByRole('link', { name: 'Administration' }).tap()
  await page.getByRole('link', { name: 'Staff accounts' }).tap()
  await page.getByLabel('Email address').fill(email)
  await page.getByRole('button', { name: 'Create account' }).tap()
  await expect(page.getByRole('status')).toHaveText(`A verification email has been sent to ${email}.`)
  const works = page.getByRole('group', { name: `Groups of ${email}` }).getByRole('checkbox', { name: groupName })
  await works.tap()
  await expect(works).toBeChecked()
  await logOut(page)

  await page.goto(await linkFromEmail(email, '/verify-email'))
  await choosePassword(page, password)
  await page.getByRole('link', { name: 'Go to login' }).tap()
  await logIn(page, email, password)
  await expect(accountMenu(page, email)).toBeVisible()

  // Straight to the Group's day: its heading and the Today tab, current.
  await expect(page.getByRole('heading', { name: groupName, level: 2 })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'The Group’s pages' }).getByRole('link', { name: 'Today' })).toHaveAttribute('aria-current', 'page')

  const lena = page.getByRole('listitem', { name: `Lena ${lastName}` })
  await lena.getByRole('button', { name: `Check in Lena ${lastName}` }).tap()
  await expect(lena).toContainText('Here since')
})
