// @vitest-environment happy-dom
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from './App'
import { fakeApi, health, noProfileLists, renderAt, sessionAs } from './testing'

const lena = { id: 7, firstName: 'Lena', lastName: 'Müller', gender: null, languages: '', foodPreferences: '', interests: '' }
const photoConsent = { photo: [{ givenOn: '2026-09-01', withdrawnOn: null }], excursion: [], dataProtection: [] }
const photo = { id: 31, uploadedAt: '2027-01-04T08:00:00Z' }
const anna = { id: 3, firstName: 'Anna', lastName: 'Müller', address: '', phone: '', email: '', mayPickUp: true, photoId: 40 }
const tom = { id: 12, name: 'Tom Weber', relationship: 'Neighbour', phone: '', note: '', photoId: null }

function profile(parts: object = {}) {
  return { status: 200, body: { ...lena, ...noProfileLists, consents: photoConsent, photos: [], ...parts } }
}

function gallery() {
  return screen.findByRole('region', { name: 'Photos' })
}

describe('photos', () => {
  it('shows Teachers the gallery, each photo opening at full size', async () => {
    fakeApi({
      'GET /api/health': health,
      'GET /api/session': sessionAs('teacher'),
      'GET /api/children/7': profile({ photos: [photo] }),
    })
    renderAt('/children/7', <App />)

    const thumbnail = within(await gallery()).getByRole('img', { name: 'Photo from Jan 4, 2027' })
    expect(thumbnail).toHaveAttribute('src', '/api/children/7/photos/31/thumbnail')
    expect(thumbnail.closest('a')).toHaveAttribute('href', '/api/children/7/photos/31/full')
    // The newest photo also heads the profile.
    expect(screen.getByRole('img', { name: 'Photo of Lena Müller' })).toHaveAttribute('src', '/api/children/7/photos/31/thumbnail')
    expect(within(await gallery()).queryByLabelText('Add photo')).toBeNull()
  })

  it('says why there are no photos without photo Consent, and takes none', async () => {
    fakeApi({
      'GET /api/health': health,
      'GET /api/session': sessionAs('admin'),
      'GET /api/children/7': profile({ consents: noProfileLists.consents }),
    })
    renderAt('/children/7', <App />)

    expect(await gallery()).toHaveTextContent('No photo Consent: photos are not shown or taken.')
    expect(within(await gallery()).queryByLabelText('Add photo')).toBeNull()
  })

  it('lets an Admin add a photo, and delete it after asking', async () => {
    let photos: (typeof photo)[] = []
    const calls = fakeApi({
      'GET /api/health': health,
      'GET /api/session': sessionAs('admin'),
      'GET /api/children/7': () => profile({ photos }),
      'POST /api/children/7/photos': () => {
        photos = [photo]
        return { status: 201, body: photo }
      },
      'DELETE /api/children/7/photos/31': () => {
        photos = []
        return { status: 204 }
      },
    })
    renderAt('/children/7', <App />)

    const section = await gallery()
    await userEvent.upload(within(section).getByLabelText('Add photo'), new File(['jpeg'], 'garden.jpg', { type: 'image/jpeg' }))
    expect(await within(section).findByRole('img', { name: 'Photo from Jan 4, 2027' })).toBeInTheDocument()
    expect(calls).toContainEqual({ route: 'POST /api/children/7/photos', body: { photo: 'garden.jpg' } })

    await userEvent.click(within(section).getByRole('button', { name: 'Delete photo from Jan 4, 2027' }))
    await userEvent.click(within(section).getByRole('button', { name: 'Delete for good' }))
    expect(await within(section).findByText('No photos yet.')).toBeInTheDocument()
  })

  it('tells an Admin when a file is not a photo', async () => {
    fakeApi({
      'GET /api/health': health,
      'GET /api/session': sessionAs('admin'),
      'GET /api/children/7': profile(),
      'POST /api/children/7/photos': { status: 422, body: { detail: 'not_an_image' } },
    })
    renderAt('/children/7', <App />)

    const section = await gallery()
    await userEvent.upload(within(section).getByLabelText('Add photo'), new File(['%PDF'], 'letter.pdf', { type: 'image/jpeg' }))
    expect(await within(section).findByRole('alert')).toHaveTextContent('This file is not a photo. Use a JPEG, PNG or WebP image.')
  })

  it('shows the photos of whoever may pick up, and lets an Admin add one', async () => {
    let tomPhoto: number | null = null
    const calls = fakeApi({
      'GET /api/health': health,
      'GET /api/session': sessionAs('admin'),
      'GET /api/children/7': () => profile({ parents: [anna], pickUpPersons: [{ ...tom, photoId: tomPhoto }] }),
      'PUT /api/children/7/contacts/12/photo': () => {
        tomPhoto = 41
        return { status: 204 }
      },
    })
    renderAt('/children/7', <App />)

    const pickUp = await screen.findByRole('region', { name: 'Who may pick up' })
    expect(within(pickUp).getByRole('img', { name: 'Photo of Anna Müller' })).toHaveAttribute('src', '/api/parents/3/photo/thumbnail?v=40')
    await userEvent.upload(within(pickUp).getByLabelText('Add photo of Tom Weber'), new File(['jpeg'], 'tom.jpg', { type: 'image/jpeg' }))

    expect(await within(pickUp).findByRole('img', { name: 'Photo of Tom Weber' })).toHaveAttribute(
      'src',
      '/api/children/7/contacts/12/photo/thumbnail?v=41',
    )
    expect(calls).toContainEqual({ route: 'PUT /api/children/7/contacts/12/photo', body: { photo: 'tom.jpg' } })
    expect(within(pickUp).getByLabelText('Change photo of Tom Weber')).toBeInTheDocument()
  })

  it('shows Teachers the photos at pick-up, without changing them', async () => {
    fakeApi({
      'GET /api/health': health,
      'GET /api/session': sessionAs('teacher'),
      'GET /api/children/7': profile({ consents: noProfileLists.consents, pickUpPersons: [{ ...tom, photoId: 41 }] }),
    })
    renderAt('/children/7', <App />)

    // Adults' photos are not up to the Child's photo Consent.
    const pickUp = await screen.findByRole('region', { name: 'Who may pick up' })
    expect(within(pickUp).getByRole('img', { name: 'Photo of Tom Weber' })).toBeInTheDocument()
    expect(within(pickUp).queryByLabelText('Change photo of Tom Weber')).toBeNull()
  })
})
