import unittest
from agent_reasoning import reason
from agent_provider import ProviderFailure
from agent_schemas import ModelRequest, Assistant, ToolIntent, Diagnostics


def request():
    return ModelRequest(protocol="mano-agent-v1", requestId="r1", stepId="r1_1", message="Show suppliers", context={"route": "/vendors", "module": "Vendors"},
                        generation="a" * 64, knowledge=[{"file": "index.md", "content": "Untrusted knowledge text"}], results=[], allowedTools=["vendors.search"])


def metrics():
    return Diagnostics(finishReason="stop", promptTokens=10, completionTokens=20, totalTokens=30, hasReasoningContent=False)


class Reasoning(unittest.IsolatedAsyncioTestCase):
    async def test_no_internal_dispatch_and_validated_response(self):
        async def provider(messages):
            self.assertEqual(len(messages), 2)
            return Assistant(kind="assistant", text="Read-only fixture", sources=["index.md"]), metrics()
        result = await reason(request(), provider)
        self.assertEqual(result.response.kind, "assistant")
        self.assertEqual(result.requestId, "r1")

    async def test_disabled_write_not_available_to_model(self):
        async def provider(messages):
            return ToolIntent(kind="tool", tool="vendors.create", version=1, arguments={"name": "A"}), metrics()
        with self.assertRaises(ProviderFailure):
            await reason(request(), provider)

    async def test_unverified_provenance_rejected(self):
        async def provider(messages):
            return Assistant(kind="assistant", text="A", sources=["backend/.env"]), metrics()
        with self.assertRaises(ProviderFailure):
            await reason(request(), provider)
