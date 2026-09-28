import asyncio
import json
import os
from fastapi import APIRouter, Request, Response
from agent_schemas import ModelRequest, ModelReply, ToolIntent, Assistant, Diagnostics, ARG_MODELS, strict_json
from agent_security import InternalSecurity
from agent_reasoning import reason
from agent_provider import ProviderFailure


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
        correlation = {}
        try:
            envelope = ModelRequest.model_validate(strict_json(body))
            correlation = {"requestId": envelope.requestId, "stepId": envelope.stepId}
            async with asyncio.timeout(43):
                async with slots:
                    result = await reasoning(envelope)
            if isinstance(result, (ToolIntent, Assistant)):
                finish_reason = "tool_calls" if isinstance(result, ToolIntent) else "stop"
                result = ModelReply(
                    protocol=envelope.protocol,
                    requestId=envelope.requestId,
                    stepId=envelope.stepId,
                    toolNames=list(ARG_MODELS),
                    response=result,
                    diagnostics=Diagnostics(
                        provider="nvidia",
                        finishReason=finish_reason,
                        promptTokens=0,
                        completionTokens=0,
                        totalTokens=0,
                        hasReasoningContent=False,
                    ),
                )
            payload = result.model_dump(exclude_none=True)
        except ProviderFailure as error:
            status = 503
            # Fixed public categories only; never expose provider bodies or credentials.
            print("Agent provider failure: " + json.dumps({**error.safe_metadata(), **correlation}, separators=(",", ":")))
            public_category = {"provider_model_unavailable": "model_unavailable", "provider_rate_limited": "provider_rate_limited",
                               "conversion_quantity_invalid": "conversion_quantity_invalid", "tool_arguments_invalid": "tool_arguments_invalid",
                               "provider_output_empty": "provider_invalid_output", "provider_output_invalid_json": "provider_invalid_output",
                               "provider_output_schema_invalid": "provider_invalid_output", "invalid_provider_output": "provider_invalid_output",
                               "provider_output_limit": "provider_invalid_output"}.get(str(error), "provider_unavailable")
            payload = {"error": public_category}
        except Exception as exc:
            status = 503
            print("Agent unexpected error: " + json.dumps({"category": "reasoning_unavailable", **correlation}, separators=(",", ":")))
            payload = {"error": "reasoning_unavailable"}
        output = json.dumps(payload, separators=(",", ":"), ensure_ascii=True).encode()
        return Response(output, status_code=status, media_type="application/json", headers={
            "X-Agent-Signature": security.response_signature(nonce, status, output)
        })

    return router
