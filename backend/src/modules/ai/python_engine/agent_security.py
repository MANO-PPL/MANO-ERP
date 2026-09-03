import hashlib
import hmac
import re
import time


def signature(secret, message):
    return hmac.new(secret.encode(), message.encode(), hashlib.sha256).hexdigest()


class InternalSecurity:
    def __init__(self, secret, clock=time.time):
        self.secret = secret
        self.clock = clock
        self.nonces = {}

    def verify(self, path, headers, body):
        now = self.clock()
        timestamp, nonce, mac = (headers.get(k, "") for k in ("x-agent-time", "x-agent-nonce", "x-agent-signature"))
        if not self.secret or len(self.secret) < 32 or not re.fullmatch(r"\d{10}", timestamp) or abs(now - int(timestamp)) > 60:
            raise ValueError("internal_authentication")
        if not re.fullmatch(r"[A-Za-z0-9_-]{1,80}", nonce) or not re.fullmatch(r"[0-9a-f]{64}", mac):
            raise ValueError("internal_authentication")
        expected = signature(self.secret, f"POST\n{path}\n{timestamp}\n{nonce}\n{hashlib.sha256(body).hexdigest()}")
        if not hmac.compare_digest(mac, expected):
            raise ValueError("internal_authentication")
        self.nonces = {n: expiry for n, expiry in self.nonces.items() if expiry > now}
        if nonce in self.nonces or len(self.nonces) >= 1000:
            raise ValueError("internal_replay_or_capacity")
        self.nonces[nonce] = now + 120
        return nonce

    def response_signature(self, nonce, status, body):
        return signature(self.secret, f"{nonce}\n{status}\n{hashlib.sha256(body).hexdigest()}")
