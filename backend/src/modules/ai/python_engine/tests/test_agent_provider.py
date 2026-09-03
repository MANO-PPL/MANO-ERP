import json
import unittest
from unittest.mock import AsyncMock, patch
import httpx
from agent_provider import complete, normalize, ProviderFailure, HOST


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
            self.assertEqual(request_body["model"], "openai/gpt-oss-120b")
            self.assertEqual(request_body["reasoning_effort"], "medium")
            self.assertEqual(request_body["max_tokens"], 4096)
            self.assertFalse(request_body["stream"])

    async def test_empty_malformed_schema_invalid_cap_and_transport(self):
        variants = []
        for text in ["", "not json", '{"kind":"tool","tool":"unknown","version":1,"arguments":{}}']:
            item = payload(); item["choices"][0]["message"]["content"] = text; variants.append(item)
        capped = payload(); capped["choices"][0]["finish_reason"] = "length"; capped["usage"]["completion_tokens"] = 4096; variants.append(capped)
        for item in variants:
            with self.assertRaises(ProviderFailure):
                normalize(item)
        for status in [401, 403, 429, 500]:
            calls = []
            async with httpx.AsyncClient(transport=httpx.MockTransport(lambda req: (calls.append(req) or httpx.Response(status)))) as client:
                with self.assertRaises(ProviderFailure):
                    await complete([], client=client, api_key="fixture")
            self.assertEqual(len(calls), 1)

    async def test_transport_error_redacts_provider_exception(self):
        def handler(request):
            raise httpx.ConnectError("SECRET_SENTINEL", request=request)
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            with self.assertRaisesRegex(ProviderFailure, '^provider_transport_failure$'):
                await complete([], client=client, api_key="fixture")

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
