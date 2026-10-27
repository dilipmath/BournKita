import { useTranslation } from 'react-i18next'
import { pickUpPhotoUrl, removePickUpPhoto, setPickUpPhoto, type PickUpPhoto as Of } from './api'
import PhotoPicker from './PhotoPicker'

type Props = {
  of: Of
  photoId: number | null
  name: string
  canEdit: boolean
  /** Runs a change and reloads the profile (see useProfileChange). */
  change: (call: () => Promise<unknown>) => Promise<boolean>
}

/** A Pick-up person's photo, to check at pick-up; Admins add, change and remove it. */
export default function PickUpPhoto({ of, photoId, name, canEdit, change }: Props) {
  const { t } = useTranslation()
  return (
    <div className="pick-up-photo">
      {photoId !== null && <img src={pickUpPhotoUrl(of, photoId, 'thumbnail')} alt={t('photoOf', { name })} />}
      {canEdit && (
        <div className="actions">
          <PhotoPicker
            label={t(photoId === null ? 'addPhotoOf' : 'changePhotoOf', { name })}
            onPick={(file) => change(() => setPickUpPhoto(of, file))}
          />
          {photoId !== null && (
            <button type="button" onClick={() => void change(() => removePickUpPhoto(of))}>
              {t('removePhotoOf', { name })}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
