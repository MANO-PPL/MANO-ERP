"""NVIDIA reasoning only; no tools, SQL, callbacks, fallback, or JSON repair."""
import asyncio
import os
import re
import httpx
from agent_schemas import Diagnostics, ResponseModel, strict_json

HOST = "https://integrate.api.nvidia.com"
MODEL = "openai/gpt-oss-120b"


class ProviderFailure(Exception):
    pass


async def bounded_request(client, method, url, **kwargs):
    async with client.stream(method, url, **kwargs) as response:
        content = bytearray()
        async for chunk in response.aiter_bytes():
            content.extend(chunk)
            if len(content) > 131072:
                raise ProviderFailure("provider_output_limit")
        return httpx.Response(response.status_code, headers=response.headers, content=bytes(content))


def normalize(payload):
    try:
        if not isinstance(payload, dict) or len(payload["choices"]) != 1:
            raise ValueError()
        choice = payload["choices"][0]
        message = choice["message"]
        content = message.get("content")
        if choice.get("finish_reason") != "stop" or not isinstance(content, str) or not content.strip() or len(content.encode()) > 65536:
            raise ValueError()
        if message.get("tool_calls"):
            raise ValueError()
        usage = payload["usage"]
        diagnostics = Diagnostics(finishReason=choice["finish_reason"], promptTokens=usage["prompt_tokens"],
                                  completionTokens=usage["completion_tokens"], totalTokens=usage["total_tokens"],
                                  hasReasoningContent=bool(message.get("reasoning_content")))
        response = ResponseModel.validate_python(strict_json(content))
        return response, diagnostics
    except Exception:
        # Never place raw provider/model content or Pydantic input values in an exception.
        raise ProviderFailure("invalid_provider_output") from None


async def complete(messages, client=None, api_key=None):
    key = api_key if api_key is not None else os.getenv("NVIDIA_API_KEY")
    if not key:
        raise ProviderFailure("provider_unconfigured")
    owned = client is None
    client = client or httpx.AsyncClient(timeout=35, follow_redirects=False, trust_env=False)
    try:
        async with asyncio.timeout(40):
            response = await bounded_request(client, "POST", HOST + "/v1/chat/completions", headers={"Authorization": "Bearer " + key}, json={
                "model": MODEL, "messages": messages, "temperature": 0, "stream": False,
                "reasoning_effort": "medium", "max_tokens": 4096,
            })
            polls = 0
            request_id = None
            while response.status_code == 202:
                # The approved endpoint supplies requestId in JSON; tolerate its documented header form too.
                pending = strict_json(response.content) if response.content else {}
                observed_id = pending.get("requestId") if isinstance(pending, dict) else None
                observed_id = observed_id or response.headers.get("nvcf-reqid")
                if request_id and observed_id and request_id != observed_id:
                    raise ProviderFailure("changed_poll_identity")
                request_id = request_id or observed_id
                if not request_id or not re.fullmatch(r"[A-Za-z0-9_-]{1,100}", request_id) or polls >= 20:
                    raise ProviderFailure("invalid_or_expired_poll")
                polls += 1
                await asyncio.sleep(1)
                response = await bounded_request(client, "GET", HOST + "/v1/status/" + request_id, headers={"Authorization": "Bearer " + key})
            if response.status_code != 200:
                raise ProviderFailure("provider_http_failure")
            if len(response.content) > 131072:
                raise ProviderFailure("provider_output_limit")
            return normalize(strict_json(response.content))
    except ProviderFailure:
        raise
    except Exception:
        raise ProviderFailure("provider_transport_failure") from None
    finally:
        if owned:
            await client.aclose()
