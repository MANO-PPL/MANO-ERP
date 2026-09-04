"""Provider transport only; no tools, SQL, callbacks, fallback, or JSON repair."""
import asyncio
import os
import re
import httpx
from agent_schemas import ARG_MODELS, Diagnostics, ResponseModel, ToolIntent, strict_json

HOST = "https://integrate.api.nvidia.com"
MODEL = "openai/gpt-oss-20b"
# This model is verified against the configured /v1/chat/completions endpoint.
# The catalog-listed Mistral model returned HTTP 404 on that endpoint.
NVIDIA_READ_MODEL = MODEL
GROQ_HOST = "https://api.groq.com/openai/v1"
# The active Groq key exposes Qwen 3.8, which supports local tool calls and
# JSON Schema mode without GPT-OSS reasoning-only responses.
GROQ_MODEL = "qwen/qwen3.8-27b"


def native_name(operation):
    """Map a canonical operation to a provider-safe native function name."""
    return operation.replace(".", "__")


def native_tool_definitions(operations):
    """Build native tool definitions solely from the canonical argument models."""
    definitions = []
    for operation in operations:
        if operation not in ARG_MODELS:
            continue
        definitions.append({"type": "function", "function": {
            "name": native_name(operation),
            "description": f"MANO ERP read operation {operation}",
            "parameters": ARG_MODELS[operation].model_json_schema(),
        }})
    return definitions


class ProviderFailure(Exception):
    """A sanitized failure category plus log-safe provider transport metadata."""
    def __init__(self, category, *, provider=None, http_status=None, attempt=None,
                 model=None, response_content_length=None, provider_error_category=None):
        super().__init__(category)
        self.category = category
        self.provider = provider
        self.http_status = http_status
        self.attempt = attempt
        self.model = model
        self.response_content_length = response_content_length
        self.provider_error_category = provider_error_category

    def safe_metadata(self):
        metadata = {"category": self.category}
        for key in ("provider", "http_status", "attempt", "model", "response_content_length",
                    "provider_error_category"):
            value = getattr(self, key)
            if value is not None:
                metadata[key] = value
        return metadata


def safe_error_category(content):
    """Classify a provider error locally without retaining or logging its body."""
    try:
        payload = strict_json(content)
        error = payload.get("error", {}) if isinstance(payload, dict) else {}
        signal = " ".join(str(error.get(key, "")) for key in ("type", "code", "message")).lower()
    except Exception:
        return "unparseable"
    if any(term in signal for term in ("context", "input too long", "maximum context")):
        return "context_limit"
    if any(term in signal for term in ("rate limit", "quota", "tokens per", "rate_limit")):
        return "rate_limit"
    if any(term in signal for term in ("does not support", "unsupported", "parameter", "invalid request", "response_format")):
        return "invalid_request"
    if any(term in signal for term in ("model not found", "model unavailable", "model does not exist", "decommissioned")):
        return "model_unavailable"
    if any(term in signal for term in ("auth", "api key", "permission", "forbidden")):
        return "authentication_or_entitlement"
    return "other" if signal else "unparseable"


async def bounded_request(client, method, url, **kwargs):
    async with client.stream(method, url, **kwargs) as response:
        content = bytearray()
        async for chunk in response.aiter_bytes():
            content.extend(chunk)
            if len(content) > 131072:
                raise ProviderFailure("provider_output_limit")
        # aiter_bytes() has already decoded transfer/compression encodings. Retaining
        # those headers would make the synthetic response attempt a second decode.
        headers = {key: value for key, value in response.headers.items()
                   if key.lower() not in {"content-encoding", "content-length", "transfer-encoding"}}
        return httpx.Response(response.status_code, headers=headers, content=bytes(content))


def normalize(payload, provider="nvidia", *, model=None, attempt=None, response_content_length=None,
              native_operations=None):
    metadata = {"provider": provider, "model": model, "attempt": attempt,
                "response_content_length": response_content_length}
    try:
        if not isinstance(payload, dict) or len(payload["choices"]) != 1:
            raise ProviderFailure("invalid_provider_output", **metadata)
        choice = payload["choices"][0]
        message = choice["message"]
        finish_reason = choice.get("finish_reason")
        if finish_reason == "length":
            raise ProviderFailure("provider_output_limit", **metadata)
        tool_calls = message.get("tool_calls")
        if finish_reason != "stop" and not (finish_reason == "tool_calls" and tool_calls is not None):
            raise ProviderFailure("invalid_provider_output", **metadata)
        usage = payload["usage"]
        diagnostics = Diagnostics(provider=provider, finishReason=finish_reason, promptTokens=usage["prompt_tokens"],
                                  completionTokens=usage["completion_tokens"], totalTokens=usage["total_tokens"],
                                  hasReasoningContent=bool(message.get("reasoning_content")))
        if tool_calls is not None:
            if not native_operations or not isinstance(tool_calls, list) or len(tool_calls) != 1:
                raise ProviderFailure("invalid_provider_output", **metadata)
            function = tool_calls[0].get("function") if isinstance(tool_calls[0], dict) else None
            if not isinstance(function, dict) or not isinstance(function.get("name"), str) or not isinstance(function.get("arguments"), str):
                raise ProviderFailure("invalid_provider_output", **metadata)
            operation_by_native_name = {native_name(operation): operation for operation in native_operations}
            operation = operation_by_native_name.get(function["name"])
            if operation is None or len(function["arguments"].encode()) > 65536:
                raise ProviderFailure("invalid_provider_output", **metadata)
            try:
                response = ToolIntent(kind="tool", tool=operation, version=1,
                                      arguments=strict_json(function["arguments"]))
            except Exception:
                raise ProviderFailure("provider_output_schema_invalid", **metadata) from None
            return response, diagnostics
        content = message.get("content")
        if not isinstance(content, str) or not content.strip():
            raise ProviderFailure("provider_output_empty", **metadata)
        if len(content.encode()) > 65536:
            raise ProviderFailure("provider_output_limit", **metadata)
        try:
            parsed = strict_json(content)
        except Exception:
            raise ProviderFailure("provider_output_invalid_json", **metadata) from None
        try:
            response = ResponseModel.validate_python(parsed)
        except Exception:
            raise ProviderFailure("provider_output_schema_invalid", **metadata) from None
        return response, diagnostics
    except ProviderFailure:
        raise
    except Exception:
        # Never place raw provider/model content or Pydantic input values in an exception.
        raise ProviderFailure("invalid_provider_output", **metadata) from None


async def complete(messages, client=None, api_key=None, provider="nvidia", reasoning_effort="medium", model=None,
                   max_tokens=4096, native_operations=None, response_schema=None):
    if provider not in {"nvidia", "groq"}:
        raise ProviderFailure("provider_unconfigured")
    key = api_key if api_key is not None else os.getenv("GROQ_API_KEY" if provider == "groq" else "NVIDIA_API_KEY")
    if not key:
        raise ProviderFailure("provider_unconfigured")
    host = GROQ_HOST if provider == "groq" else HOST + "/v1"
    model = model or (GROQ_MODEL if provider == "groq" else MODEL)
    owned = client is None
    client = client or httpx.AsyncClient(timeout=35, follow_redirects=False, trust_env=False)
    try:
        async with asyncio.timeout(40):
            payload = {"model": model, "messages": messages, "temperature": 0, "stream": False, "max_tokens": max_tokens}
            if native_operations:
                payload["tools"] = native_tool_definitions(native_operations)
            # NVIDIA GPT-OSS uses this parameter.
            if provider == "nvidia" and reasoning_effort:
                payload["reasoning_effort"] = reasoning_effort
            if provider == "groq" and model.startswith("qwen/"):
                # ERP lookups and their final summaries are concise, structured
                # tasks. Disable optional chain-of-thought generation so the
                # provider emits the requested tool call or JSON answer directly.
                payload["reasoning_effort"] = "none"
            if not native_operations and response_schema:
                payload["response_format"] = {"type": "json_schema", "json_schema": {
                    "name": "mano_agent_assistant", "strict": True, "schema": response_schema,
                }}
            elif not native_operations:
                # Groq GPT-OSS-120B requires JSON mode to reliably emit final
                # content instead of an empty reasoning/tool-planning turn.
                # strict_json() and Pydantic validation below remain mandatory.
                payload["response_format"] = {"type": "json_object"}
            response = None
            for attempt in range(2):
                try:
                    response = await bounded_request(client, "POST", host + "/chat/completions", headers={"Authorization": "Bearer " + key}, json=payload)
                except (httpx.TimeoutException, httpx.NetworkError):
                    if attempt == 1:
                        raise ProviderFailure("provider_transport_failure") from None
                    await asyncio.sleep(0.25)
                    continue
                if response.status_code == 429 or 500 <= response.status_code <= 599:
                    if attempt == 0:
                        await asyncio.sleep(0.25)
                        continue
                break
            polls = 0
            request_id = None
            while provider == "nvidia" and response.status_code == 202:
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
            if response.status_code == 410:
                raise ProviderFailure("provider_model_unavailable", provider=provider,
                                      http_status=response.status_code, attempt=attempt + 1,
                                      model=model, response_content_length=len(response.content),
                                      provider_error_category=safe_error_category(response.content))
            if response.status_code != 200:
                raise ProviderFailure("provider_http_failure", provider=provider,
                                      http_status=response.status_code, attempt=attempt + 1,
                                      model=model, response_content_length=len(response.content),
                                      provider_error_category=safe_error_category(response.content))
            if len(response.content) > 131072:
                raise ProviderFailure("provider_output_limit")
            return normalize(strict_json(response.content), provider, model=model,
                             attempt=attempt + 1, response_content_length=len(response.content),
                             native_operations=native_operations)
    except ProviderFailure:
        raise
    except Exception:
        raise ProviderFailure("provider_transport_failure") from None
    finally:
        if owned:
            await client.aclose()


async def complete_groq(messages, client=None, api_key=None, native_operations=None, response_schema=None):
    # Keep the free-tier reservation below the request's token-per-minute budget.
    # The model's strict JSON answer is concise; long-form answers are not required for tool planning.
    return await complete(messages, client=client, api_key=api_key, provider="groq", max_tokens=512,
                          native_operations=native_operations, response_schema=response_schema)


async def complete_nvidia_read(messages, client=None, api_key=None):
    return await complete(messages, client=client, api_key=api_key, provider="nvidia",
                          reasoning_effort="low", model=NVIDIA_READ_MODEL)
