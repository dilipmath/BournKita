"""Field encryption for sensitive data (addresses, contact and health details), so a database
dump or a stolen disk does not expose it. The key is kept outside the database."""

import base64
import binascii
import hashlib
import os

from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from kita.settings import Settings

_KEY_BYTES = 32
_NONCE_BYTES = 12
_FORMAT = "v1"


class NotDecryptable(Exception):
    """The stored value was changed, belongs to another field, or needs another key."""


def new_key() -> str:
    """A fresh random key, in the form KITA_ENCRYPTION_KEY takes."""
    return base64.b64encode(os.urandom(_KEY_BYTES)).decode()


class FieldCipher:
    """Encrypts single field values with AES-256-GCM. A stored value reads
    `v1:<key id>:<base64 of nonce and ciphertext>`; the key id lets a later key rotation tell
    which key a value needs. Each value is bound to its field (e.g. "parents.address"), so it
    cannot be copied into another field and read back there."""

    def __init__(self, key: bytes) -> None:
        if len(key) != _KEY_BYTES:
            raise ValueError("KITA_ENCRYPTION_KEY must be 32 random bytes, base64-encoded.")
        self._aead = AESGCM(key)
        self._key_id = hashlib.sha256(key).hexdigest()[:8]

    @classmethod
    def from_key(cls, key: str) -> "FieldCipher":
        try:
            raw = base64.b64decode(key, validate=True)
        except binascii.Error:
            raise ValueError(
                "KITA_ENCRYPTION_KEY must be 32 random bytes, base64-encoded."
            ) from None
        return cls(raw)

    @classmethod
    def from_settings(cls, settings: Settings) -> "FieldCipher":
        if settings.encryption_key is None:
            raise ValueError(
                "Set KITA_ENCRYPTION_KEY; `kita-admin generate-key` makes one. Keep it safe and "
                "apart from the database backups: without it, encrypted data cannot be read."
            )
        return cls.from_key(settings.encryption_key.get_secret_value())

    def encrypt(self, value: str, field: str) -> str:
        nonce = os.urandom(_NONCE_BYTES)
        sealed = self._aead.encrypt(nonce, value.encode(), field.encode())
        return f"{_FORMAT}:{self._key_id}:{base64.b64encode(nonce + sealed).decode()}"

    def encrypt_bytes(self, data: bytes, field: str) -> bytes:
        """As `encrypt`, for a file (e.g. a photo, bound to its file name): the same header,
        then the nonce and ciphertext as raw bytes."""
        nonce = os.urandom(_NONCE_BYTES)
        return self._header() + nonce + self._aead.encrypt(nonce, data, field.encode())

    def decrypt_bytes(self, stored: bytes, field: str) -> bytes:
        header = self._header()
        if not stored.startswith(header):
            raise NotDecryptable
        raw = stored[len(header) :]
        try:
            return self._aead.decrypt(raw[:_NONCE_BYTES], raw[_NONCE_BYTES:], field.encode())
        except InvalidTag:
            raise NotDecryptable from None

    def _header(self) -> bytes:
        return f"{_FORMAT}:{self._key_id}:".encode()

    def decrypt(self, stored: str, field: str) -> str:
        try:
            version, key_id, payload = stored.split(":")
            if version != _FORMAT or key_id != self._key_id:
                raise NotDecryptable
            raw = base64.b64decode(payload, validate=True)
            nonce, sealed = raw[:_NONCE_BYTES], raw[_NONCE_BYTES:]
            return self._aead.decrypt(nonce, sealed, field.encode()).decode()
        except (ValueError, binascii.Error, InvalidTag):
            raise NotDecryptable from None
