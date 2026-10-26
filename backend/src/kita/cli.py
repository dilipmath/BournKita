"""kita-admin: setup commands run on the server."""

import argparse
import getpass
import sys
from collections.abc import Callable, Sequence

from sqlalchemy import create_engine

from kita.clock import SystemClock
from kita.db import migrate
from kita.identity import AccountsAlreadyExist, Identity
from kita.settings import Settings

MIN_PASSWORD_LENGTH = 12


def _read_password(prompt: str) -> str:
    # Without a terminal (e.g. piped in by a script) the password comes from stdin.
    if sys.stdin.isatty():
        return getpass.getpass(prompt)
    return sys.stdin.readline().rstrip("\n")


def main(
    argv: Sequence[str],
    *,
    settings: Settings | None = None,
    read_password: Callable[[str], str] = _read_password,
) -> int:
    parser = argparse.ArgumentParser(prog="kita-admin")
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("migrate", help="bring the database schema up to date")
    create_admin = commands.add_parser("create-admin", help="create the first Admin account")
    create_admin.add_argument("--email", required=True)
    args = parser.parse_args(argv)
    settings = settings or Settings()

    if args.command == "migrate":
        migrate(settings.database_url)
        return 0

    if "@" not in args.email:
        print("That is not an email address.", file=sys.stderr)
        return 1
    password = read_password("Password: ")
    if len(password) < MIN_PASSWORD_LENGTH:
        print(f"The password needs at least {MIN_PASSWORD_LENGTH} characters.", file=sys.stderr)
        return 1
    if read_password("Repeat password: ") != password:
        print("The passwords do not match.", file=sys.stderr)
        return 1
    engine = create_engine(settings.database_url)
    identity = Identity.from_settings(engine, SystemClock(), settings)
    try:
        identity.create_first_admin(args.email, password)
    except AccountsAlreadyExist:
        print("Accounts already exist; the first Admin can only be created once.", file=sys.stderr)
        return 2
    finally:
        engine.dispose()
    print(f"Admin {args.email} created.")
    return 0


def run() -> None:
    sys.exit(main(sys.argv[1:]))
