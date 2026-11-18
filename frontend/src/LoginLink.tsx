import type { MouseEvent, ReactNode } from 'react'

/** Where the login card is on the Landing page. */
export const loginFormId = 'login'

/** A link to the login card that also puts the cursor in its email field, ready to type. */
export default function LoginLink({ className, children }: { className?: string; children: ReactNode }) {
  function goToLogin(event: MouseEvent) {
    const email = document.querySelector<HTMLInputElement>(`#${loginFormId} input[type="email"]`)
    if (!email) return
    event.preventDefault()
    email.focus()
  }
  return (
    <a className={className} href={`#${loginFormId}`} onClick={goToLogin}>
      {children}
    </a>
  )
}
