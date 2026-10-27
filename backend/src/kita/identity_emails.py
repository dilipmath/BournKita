"""The emails Identity & access sends. In German and English, since the app does not know which
language a new Staff member prefers."""

from kita.mail import Email


def verification_email(to: str, link: str, valid_days: int) -> Email:
    body = "\n".join(
        [
            "Hallo,",
            "",
            "für Sie wurde ein Zugang zur Kita Kids Database angelegt. Bitte bestätigen Sie",
            f"Ihre E-Mail-Adresse und wählen Sie ein Passwort (Link {valid_days} Tage gültig):",
            "",
            link,
            "",
            "---",
            "",
            "Hello,",
            "",
            "an account for the Kita Kids Database has been created for you. Please verify",
            f"your email address and choose a password (link valid for {valid_days} days):",
            "",
            link,
        ]
    )
    return Email(
        to=to,
        subject="Kita Kids Database: E-Mail-Adresse bestätigen / Verify your email address",
        body=body,
    )


def password_reset_email(to: str, link: str, valid_minutes: int) -> Email:
    body = "\n".join(
        [
            "Hallo,",
            "",
            "jemand hat ein neues Passwort für Ihren Zugang zur Kita Kids Database angefordert.",
            f"Hier können Sie es wählen (Link {valid_minutes} Minuten gültig, nur einmal nutzbar):",
            "",
            link,
            "",
            "Waren Sie das nicht? Dann ignorieren Sie diese E-Mail; Ihr Passwort bleibt gleich.",
            "",
            "---",
            "",
            "Hello,",
            "",
            "someone asked for a new password for your Kita Kids Database account.",
            f"Choose it here (link valid for {valid_minutes} minutes, works once):",
            "",
            link,
            "",
            "Wasn't you? Then ignore this email; your password stays the same.",
        ]
    )
    return Email(
        to=to,
        subject="Kita Kids Database: Neues Passwort / New password",
        body=body,
    )
