import hashlib
import json
import time
import unittest
import httpx
from fastapi import FastAPI
from agent_routes import create_agent_router
from agent_security import InternalSecurity, signature
from agent_schemas import ARG_MODELS, ModelReply, Assistant
from test_agent_reasoning import request, metrics


class Internal(unittest.IsolatedAsyncioTestCase):
    async def test_hmac_request_reply_and_nonce_replay(self):
        calls = []
        secret = "fixture-secret-" * 4

        async def reasoning(value):
            calls.append(value)
            return ModelReply(requestId=value.requestId, stepId=value.stepId, toolNames=list(ARG_MODELS), response=Assistant(kind="assistant", text="A", sources=[]), diagnostics=metrics())

        app = FastAPI(); app.include_router(create_agent_router(secret, reasoning))
        body = request().model_dump_json(exclude_none=True).encode()
        timestamp = str(int(time.time())); nonce = "fixture-nonce"; path = "/internal/agent/v1/reason"
        headers = {"X-Agent-Time": timestamp, "X-Agent-Nonce": nonce, "X-Agent-Signature": signature(secret, f"POST\n{path}\n{timestamp}\n{nonce}\n{hashlib.sha256(body).hexdigest()}")}
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://internal") as client:
            response = await client.post(path, content=body, headers=headers)
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.headers["x-agent-signature"], signature(secret, f"{nonce}\n200\n{hashlib.sha256(response.content).hexdigest()}"))
            self.assertEqual((await client.post(path, content=body, headers=headers)).status_code, 403)
            self.assertEqual((await client.post(path, content=body)).status_code, 403)
        self.assertEqual(len(calls), 1)

    async def test_malformed_authenticated_input_does_not_reach_reasoning(self):
        calls = []
        async def reasoning(value):
            calls.append(value)
            raise AssertionError()
        secret = "fixture-secret-" * 4; app = FastAPI(); app.include_router(create_agent_router(secret, reasoning))
        body = b'{"authorization":"ALLOW"}'; timestamp = str(int(time.time())); path = "/internal/agent/v1/reason"
        headers = {"X-Agent-Time": timestamp, "X-Agent-Nonce": "bad-body", "X-Agent-Signature": signature(secret, f"POST\n{path}\n{timestamp}\nbad-body\n{hashlib.sha256(body).hexdigest()}")}
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://internal") as client:
            response = await client.post(path, content=body, headers=headers)
        self.assertEqual(response.status_code, 503); self.assertEqual(calls, [])
        self.assertEqual(response.json(), {"error": "reasoning_unavailable"})

    def test_signature_timestamp_and_capacity_fail_closed(self):
        security = InternalSecurity("x" * 64, clock=lambda: 1800000000)
        with self.assertRaises(ValueError):
            security.verify('/internal/agent/v1/reason', {"x-agent-time": "1000000000"}, b'{}')
