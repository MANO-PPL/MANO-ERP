import asyncio
import json
import os
from fastapi import APIRouter, Request, Response
from agent_schemas import ModelRequest, strict_json
from agent_security import InternalSecurity
from agent_reasoning import reason


def create_agent_router(secret=None, reasoning=reason):
    router = APIRouter()
    security = InternalSecurity(secret if secret is not None else os.getenv("MANO_AGENT_INTERNAL_SECRET", ""))
    slots = asyncio.Semaphore(4)

    @router.post("/internal/agent/v1/reason")
    async def agent_reason(request: Request):
        body = bytearray()
        async for chunk in request.stream():
            body.extend(chunk)
            if len(body) > 98304:
                return Response(status_code=413)
        try:
            nonce = security.verify(request.url.path, request.headers, body)
        except ValueError:
            return Response(status_code=403)
        status = 200
        try:
            envelope = ModelRequest.model_validate(strict_json(body))
            async with asyncio.timeout(43):
                async with slots:
                    result = await reasoning(envelope)
            payload = result.model_dump(exclude_none=True)
        except Exception:
            status = 503
            payload = {"error": "reasoning_unavailable"}
        output = json.dumps(payload, separators=(",", ":"), ensure_ascii=True).encode()
        return Response(output, status_code=status, media_type="application/json", headers={
            "X-Agent-Signature": security.response_signature(nonce, status, output)
        })

    return router
