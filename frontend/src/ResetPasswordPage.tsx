import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { resetPassword } from './api'
import ChoosePasswordPage from './ChoosePasswordPage'

/** Opened from the password reset email: the Staff member chooses a new password. */
export default function ResetPasswordPage() {
  const { t } = useTranslation()
  return (
    <ChoosePasswordPage
      heading="chooseNewPassword"
      save={resetPassword}
      // Unlike a verification link, Staff members can ask for a new reset link themselves.
      invalidLink={{ message: 'linkNoLongerValid', help: <Link to="/forgot-password">{t('askForNewLink')}</Link> }}
    />
  )
}
