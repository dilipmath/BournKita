import { useState } from 'react'

type Props = { label: string; onPick: (file: File) => Promise<unknown> }

/** A button that picks a photo (on a tablet: from the camera or the photo library) and hands it
 * over, staying disabled until that is done. */
export default function PhotoPicker({ label, onPick }: Props) {
  const [busy, setBusy] = useState(false)

  async function pick(input: HTMLInputElement) {
    const file = input.files?.[0]
    // Cleared, so picking the same file again (e.g. after a refusal) still counts.
    input.value = ''
    if (!file) return
    setBusy(true)
    await onPick(file)
    setBusy(false)
  }

  return (
    <label className={busy ? 'button photo-picker busy' : 'button photo-picker'}>
      {label}
      <input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={(event) => void pick(event.target)} />
    </label>
  )
}
