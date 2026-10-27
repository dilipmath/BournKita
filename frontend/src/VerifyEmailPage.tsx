import { verifyEmail } from './api'
import ChoosePasswordPage from './ChoosePasswordPage'

/** Opened from the verification email: the new Staff member chooses a password. */
export default function VerifyEmailPage() {
  return <ChoosePasswordPage heading="choosePassword" save={verifyEmail} />
}
