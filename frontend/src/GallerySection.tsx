import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { addChildPhoto, childPhotoUrl, deleteChildPhoto, isGiven, type ChildProfile } from './api'
import PhotoPicker from './PhotoPicker'
import ProblemAlert from './ProblemAlert'
import { useProfileChange } from './profileChange'

type Props = { child: ChildProfile; canEdit: boolean; reload: () => void }

/** A Child's photos, shown only while their photo Consent is given; Admins add and delete them. */
export default function GallerySection({ child, canEdit, reload }: Props) {
  const { t, i18n } = useTranslation()
  const { problem, change } = useProfileChange(reload)
  // The photo whose deletion is being confirmed.
  const [confirming, setConfirming] = useState<number | null>(null)
  const consentGiven = isGiven(child.consents.photo)
  const dateFormat = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' })

  async function remove(photoId: number) {
    if (await change(() => deleteChildPhoto(child.id, photoId))) setConfirming(null)
  }

  return (
    <section className="gallery" aria-labelledby="photos-heading">
      <h3 id="photos-heading">{t('photos')}</h3>
      {!consentGiven ? (
        <p>{t('noPhotoConsentPhotosHidden')}</p>
      ) : child.photos.length === 0 ? (
        <p>{t('noPhotos')}</p>
      ) : (
        <ul>
          {child.photos.map((photo) => {
            const date = dateFormat.format(new Date(photo.uploadedAt))
            return (
              <li key={photo.id}>
                <a href={childPhotoUrl(child.id, photo.id, 'full')}>
                  <img src={childPhotoUrl(child.id, photo.id, 'thumbnail')} alt={t('photoFrom', { date })} loading="lazy" />
                </a>
                {canEdit &&
                  (confirming === photo.id ? (
                    // A second, deliberate step: deleting cannot be undone.
                    <div className="actions" role="group" aria-label={t('deletePhotoFrom', { date })}>
                      <button type="button" className="danger" onClick={() => void remove(photo.id)}>
                        {t('deleteForGood')}
                      </button>
                      <button type="button" onClick={() => setConfirming(null)}>
                        {t('cancel')}
                      </button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => setConfirming(photo.id)}>
                      {t('deletePhotoFrom', { date })}
                    </button>
                  ))}
              </li>
            )
          })}
        </ul>
      )}
      <ProblemAlert problem={problem} />
      {canEdit && consentGiven && <PhotoPicker label={t('addPhoto')} onPick={(file) => change(() => addChildPhoto(child.id, file))} />}
    </section>
  )
}
