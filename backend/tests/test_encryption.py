import base64

import pytest
from hypothesis import given
from hypothesis import strategies as st
from pydantic import SecretStr

from kita import cli
from kita.app import create_app
from kita.encryption import FieldCipher, NotDecryptable, new_key
from kita.settings import Settings
from tests.fakes import FixedClock, RecordingCrashSink

CIPHER = FieldCipher.from_key(new_key())


@given(st.text())
def test_any_text_reads_back_unchanged(text: str) -> None:
    assert CIPHER.decrypt(CIPHER.encrypt(text, "parents.address"), "parents.address") == text


def test_the_stored_form_does_not_contain_the_value_and_differs_each_time() -> None:
    address = "Lindenstraße 12, 10115 Berlin"

    first = CIPHER.encrypt(address, "parents.address")
    second = CIPHER.encrypt(address, "parents.address")

    assert "Lindenstraße" not in first and "Berlin" not in first
    assert first != second  # equal addresses cannot be spotted in a dump


def test_a_changed_value_another_key_or_another_field_is_refused() -> None:
    stored = CIPHER.encrypt("Lindenstraße 12", "parents.address")
    tampered = stored[:-4] + ("AAAA" if not stored.endswith("AAAA") else "BBBB")

    with pytest.raises(NotDecryptable):
        CIPHER.decrypt(tampered, "parents.address")
    with pytest.raises(NotDecryptable):
        FieldCipher.from_key(new_key()).decrypt(stored, "parents.address")
    with pytest.raises(NotDecryptable):
        # Copied into another column, a value must not read back as that column's.
        CIPHER.decrypt(stored, "parents.phone")


def test_the_app_refuses_to_start_without_a_valid_encryption_key(
    settings: Settings, clock: FixedClock, crash_sink: RecordingCrashSink
) -> None:
    for key in (None, SecretStr("too short"), SecretStr(base64.b64encode(b"x" * 16).decode())):
        with pytest.raises(ValueError, match="KITA_ENCRYPTION_KEY"):
            create_app(
                settings.model_copy(update={"encryption_key": key}), clock, crash_sink=crash_sink
            )


def test_the_setup_command_generates_a_key_the_app_accepts(
    settings: Settings, capsys: pytest.CaptureFixture[str], crash_sink: RecordingCrashSink
) -> None:
    assert cli.main(["generate-key"], settings=settings) == 0

    key = capsys.readouterr().out.strip()
    create_app(
        settings.model_copy(update={"encryption_key": SecretStr(key)}), crash_sink=crash_sink
    )
