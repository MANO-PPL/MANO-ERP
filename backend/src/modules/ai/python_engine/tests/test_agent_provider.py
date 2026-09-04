import json
import unittest
from unittest.mock import AsyncMock, patch
import httpx
from agent_provider import complete, complete_groq, complete_nvidia_read, native_tool_definitions, normalize, ProviderFailure, HOST, GROQ_HOST, GROQ_MODEL, NVIDIA_READ_MODEL


def payload():
    return {"choices": [{"finish_reason": "stop", "message": {"content": json.dumps({"kind": "assistant", "text": "Fixture response", "sources": []}),
                                                              "reasoning_content": "PRIVATE_SENTINEL"}}],
            "usage": {"prompt_tokens": 10, "completion_tokens": 20, "total_tokens": 30}}


class Provider(unittest.IsolatedAsyncioTestCase):
    async def test_S53_200_and_202_protocol_and_no_fallback(self):
        for statuses in [[200], [202, 200]]:
            requests = []

            def handler(request):
                requests.append(request)
                self.assertEqual(str(request.url).split('/v1/')[0], HOST)
                status = statuses.pop(0)
                return httpx.Response(status, json=payload() if status == 200 else {}, headers={"nvcf-reqid": "fixture-id"})

            async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
                with patch('agent_provider.asyncio.sleep', new=AsyncMock()):
                    result, metrics = await complete([], client=client, api_key="fixture-not-a-real-key")
            self.assertEqual(result.kind, "assistant")
            self.assertTrue(metrics.hasReasoningContent)
            self.assertNotIn("PRIVATE_SENTINEL", result.model_dump_json() + metrics.model_dump_json())
            request_body = json.loads(requests[0].content)
            self.assertEqual(request_body["model"], "openai/gpt-oss-20b")
            self.assertEqual(request_body["reasoning_effort"], "medium")
            self.assertEqual(request_body["max_tokens"], 4096)
            self.assertFalse(request_body["stream"])

    async def test_nvidia_read_request_uses_verified_model_and_low_reasoning(self):
        requests = []
        async def handler(request):
            requests.append(request)
            return httpx.Response(200, json=payload())
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            await complete_nvidia_read([], client=client, api_key="fixture")
        request_body = json.loads(requests[0].content)
        self.assertEqual(request_body["model"], NVIDIA_READ_MODEL)
        self.assertEqual(request_body["reasoning_effort"], "low")

    async def test_empty_malformed_schema_invalid_cap_and_transport(self):
        variants = []
        empty = payload(); empty["choices"][0]["message"]["content"] = ""; variants.append((empty, "provider_output_empty"))
        invalid_json = payload(); invalid_json["choices"][0]["message"]["content"] = "not json"; variants.append((invalid_json, "provider_output_invalid_json"))
        invalid_schema = payload(); invalid_schema["choices"][0]["message"]["content"] = '{"kind":"tool","tool":"unknown","version":1,"arguments":{}}'; variants.append((invalid_schema, "provider_output_schema_invalid"))
        capped = payload(); capped["choices"][0]["finish_reason"] = "length"; capped["usage"]["completion_tokens"] = 4096; variants.append(capped)
        variants[-1] = (variants[-1], "provider_output_limit")
        for item, category in variants:
            with self.assertRaisesRegex(ProviderFailure, category):
                normalize(item)
        for status in [401, 403]:
            calls = []
            async with httpx.AsyncClient(transport=httpx.MockTransport(lambda req: (calls.append(req) or httpx.Response(status)))) as client:
                with self.assertRaises(ProviderFailure) as failure:
                    await complete([], client=client, api_key="fixture")
            self.assertEqual(len(calls), 1)
            self.assertEqual(failure.exception.safe_metadata(), {
                "category": "provider_http_failure", "provider": "nvidia", "http_status": status,
                "attempt": 1, "model": "openai/gpt-oss-20b", "response_content_length": 0,
                "provider_error_category": "unparseable",
            })

        for status in [429, 500]:
            calls = []
            async with httpx.AsyncClient(transport=httpx.MockTransport(lambda req: (calls.append(req) or httpx.Response(status)))) as client:
                with patch('agent_provider.asyncio.sleep', new=AsyncMock()):
                    with self.assertRaises(ProviderFailure):
                        await complete([], client=client, api_key="fixture")
            self.assertEqual(len(calls), 2)

    async def test_transport_error_redacts_provider_exception(self):
        def handler(request):
            raise httpx.ConnectError("SECRET_SENTINEL", request=request)
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            with self.assertRaisesRegex(ProviderFailure, '^provider_transport_failure$'):
                await complete([], client=client, api_key="fixture")

    async def test_retired_model_has_safe_category(self):
        async with httpx.AsyncClient(transport=httpx.MockTransport(lambda request: httpx.Response(410, text='SECRET_SENTINEL'))) as client:
            with self.assertRaisesRegex(ProviderFailure, '^provider_model_unavailable$'):
                await complete([], client=client, api_key="fixture")

    async def test_groq_request_uses_read_model_and_diagnostics(self):
        requests = []
        def handler(request):
            requests.append(request)
            return httpx.Response(200, json=payload())
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            result, metrics = await complete_groq([], client=client, api_key="fixture")
        self.assertEqual(result.kind, "assistant")
        self.assertEqual(metrics.provider, "groq")
        self.assertEqual(str(requests[0].url).split('/chat/completions')[0], GROQ_HOST)
        request_body = json.loads(requests[0].content)
        self.assertEqual(request_body["model"], GROQ_MODEL)
        self.assertEqual(request_body["max_tokens"], 512)
        self.assertEqual(request_body["response_format"], {"type": "json_object"})
        self.assertEqual(request_body["reasoning_effort"], "none")

    async def test_groq_final_assistant_request_uses_strict_json_schema(self):
        requests = []
        schema = {"type": "object", "additionalProperties": False, "properties": {
            "kind": {"type": "string", "enum": ["assistant"]},
        }, "required": ["kind"]}
        def handler(request):
            requests.append(request)
            return httpx.Response(200, json=payload())
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            await complete_groq([], client=client, api_key="fixture", response_schema=schema)
        request_body = json.loads(requests[0].content)
        self.assertEqual(request_body["response_format"], {"type": "json_schema", "json_schema": {
            "name": "mano_agent_assistant", "strict": True, "schema": schema,
        }})

    async def test_json_request_id_is_preserved_across_pending_poll(self):
        responses = [httpx.Response(202, json={"requestId": "fixture-json-id"}), httpx.Response(202, json={}), httpx.Response(200, json=payload())]
        urls = []
        def handler(request):
            urls.append(str(request.url))
            return responses.pop(0)
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            with patch('agent_provider.asyncio.sleep', new=AsyncMock()):
                await complete([], client=client, api_key="fixture")
        self.assertEqual(urls[1:], [HOST + '/v1/status/fixture-json-id'] * 2)

    async def test_provider_output_size_is_bounded(self):
        async with httpx.AsyncClient(transport=httpx.MockTransport(lambda request: httpx.Response(200, content=b'x' * 131073))) as client:
            with self.assertRaisesRegex(ProviderFailure, 'provider_output_limit'):
                await complete([], client=client, api_key="fixture")

    def test_native_tool_call_is_normalized_to_canonical_intent(self):
        data = payload()
        data["choices"][0]["message"] = {"tool_calls": [{"function": {
            "name": "projects__search", "arguments": '{"query":"Holy Smokes","limit":10}'
        }}]}
        data["choices"][0]["finish_reason"] = "tool_calls"
        response, diagnostics = normalize(data, native_operations=["projects.search"])
        self.assertEqual(response.kind, "tool")
        self.assertEqual(response.tool, "projects.search")
        self.assertEqual(response.arguments, {"query": "Holy Smokes", "limit": 10})
        self.assertEqual(diagnostics.finishReason, "tool_calls")
        definition = native_tool_definitions(["projects.search"])[0]
        self.assertEqual(definition["function"]["name"], "projects__search")

    def test_native_tool_call_rejects_unknown_or_malformed_operation(self):
        data = payload()
        data["choices"][0]["message"] = {"tool_calls": [{"function": {
            "name": "vendors__create", "arguments": '{}'
        }}]}
        with self.assertRaisesRegex(ProviderFailure, "invalid_provider_output"):
            normalize(data, native_operations=["projects.search"])
