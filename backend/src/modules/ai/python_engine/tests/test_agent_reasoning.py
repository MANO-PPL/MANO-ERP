import json
import unittest
from unittest.mock import patch
import agent_reasoning
from agent_reasoning import redact_verified_internal_ids, reason
from agent_provider import ProviderFailure
from agent_schemas import ARG_MODELS, ModelRequest, Assistant, ToolIntent, Diagnostics


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

    async def test_read_only_requests_select_groq_provider(self):
        calls = []
        async def nvidia(messages):
            raise AssertionError("NVIDIA must not serve a read-only request")
        async def groq(messages):
            calls.append(messages)
            return Assistant(kind="assistant", text="Read-only fixture", sources=["index.md"]), metrics()
        result = await reason(request(), read_provider=groq)
        self.assertEqual(result.response.kind, "assistant")
        self.assertEqual(len(calls), 1)

    async def test_read_context_is_limited_to_relevant_canonical_files(self):
        seen = []
        async def groq(messages):
            seen.append(messages)
            return Assistant(kind="assistant", text="Read-only fixture", sources=["clients/index.md"]), metrics()
        client_request = ModelRequest.model_validate({**request().model_dump(), "message": "Summarize client interactions", "context": {"route": "/", "module": "Dashboard"}, "knowledge": [
            {"file": "index.md", "content": "A"}, {"file": "clients/index.md", "content": "B"},
            {"file": "interactions/index.md", "content": "C"}, {"file": "vendors/index.md", "content": "D"}
        ]})
        await reason(client_request, read_provider=groq)
        sent = json.loads(seen[0][1]["content"])["knowledge"]
        self.assertEqual([item["file"] for item in sent], ["index.md", "clients/index.md", "interactions/index.md"])

    async def test_read_history_is_limited_to_two_recent_entries(self):
        seen = []
        async def groq(messages):
            seen.append(messages)
            return Assistant(kind="assistant", text="Read-only fixture", sources=["index.md"]), metrics()
        client_request = ModelRequest.model_validate({**request().model_dump(), "history": [
            {"role": "user", "text": "old"}, {"role": "assistant", "text": "a" * 2000},
            {"role": "user", "text": "b" * 2000},
        ]})
        await reason(client_request, read_provider=groq)
        history = json.loads(seen[0][1]["content"])["history"]
        self.assertEqual([item["role"] for item in history], ["assistant", "user"])
        self.assertEqual([len(item["text"]) for item in history], [1200, 1200])

    async def test_project_read_exposes_only_project_tools(self):
        seen = []
        async def groq(messages):
            seen.append(messages)
            return Assistant(kind="assistant", text="Read-only fixture", sources=["index.md"]), metrics()
        project_request = ModelRequest.model_validate({**request().model_dump(), "message": "Explain this project",
                                                        "context": {"route": "/projects", "module": "Projects"},
                                                        "allowedTools": [name for name in ARG_MODELS
                                                                         if name not in {"vendors.create", "resources.createRateVersion"}]})
        await reason(project_request, read_provider=groq)
        request_data = json.loads(seen[0][1]["content"])
        self.assertEqual(request_data["allowedTools"], ["projects.search", "projects.get", "projectParties.list"])

    async def test_follow_up_read_uses_one_module_document(self):
        seen = []
        async def groq(messages):
            seen.append(messages)
            return Assistant(kind="assistant", text="Read-only fixture", sources=["p1"]), metrics()
        project_request = ModelRequest.model_validate({**request().model_dump(), "message": "Explain this project",
                                                        "context": {"route": "/projects", "module": "Projects"},
                                                        "knowledge": [{"file": "index.md", "content": "Overview"},
                                                                      {"file": "projects/index.md", "content": "Projects"}],
                                                        "results": [{"stepId": "p1", "tool": "projects.get", "data": [{"id": 75}]}]})
        await reason(project_request, read_provider=groq)
        knowledge = json.loads(seen[0][1]["content"])["knowledge"]
        self.assertEqual([item["file"] for item in knowledge], ["projects/index.md"])

    async def test_empty_verified_search_hides_follow_up_tools(self):
        seen = []
        async def groq(messages):
            seen.append(messages)
            return Assistant(kind="assistant", text="No matching project was found.", sources=["p1"]), metrics()
        project_request = ModelRequest.model_validate({**request().model_dump(), "message": "Explain this project",
                                                        "context": {"route": "/projects", "module": "Projects"},
                                                        "results": [{"stepId": "p1", "tool": "projects.search", "data": []}]})
        await reason(project_request, read_provider=groq)
        request_data = json.loads(seen[0][1]["content"])
        self.assertEqual(request_data["allowedTools"], [])

    async def test_verified_project_detail_requires_answer_not_more_tools(self):
        seen = []
        async def groq(messages):
            seen.append(messages)
            return Assistant(kind="assistant", text="Holy Smokes is active.", sources=["p1"]), metrics()
        project_request = ModelRequest.model_validate({**request().model_dump(), "message": "Explain this project",
                                                        "context": {"route": "/projects", "module": "Projects"},
                                                        "results": [{"stepId": "p1", "tool": "projects.get", "data": [{"id": 75}]}]})
        await reason(project_request, read_provider=groq)
        request_data = json.loads(seen[0][1]["content"])
        self.assertEqual(request_data["allowedTools"], [])

    async def test_verified_detail_uses_strict_assistant_schema_with_groq(self):
        seen = {}
        async def groq(messages, native_operations=None, response_schema=None):
            seen["native_operations"] = native_operations
            seen["response_schema"] = response_schema
            return Assistant(kind="assistant", text="Holy Smokes is active.", sources=["p1"]), metrics()
        project_request = ModelRequest.model_validate({**request().model_dump(), "message": "Explain this project",
                                                        "context": {"route": "/projects", "module": "Projects"},
                                                        "results": [{"stepId": "p1", "tool": "projects.get", "data": [{"id": 75}]}]})
        with patch("agent_reasoning.complete_groq", new=groq):
            await agent_reasoning.reason(project_request, read_provider=groq)
        self.assertIsNone(seen["native_operations"])
        self.assertEqual(seen["response_schema"], agent_reasoning.ASSISTANT_RESPONSE_SCHEMA)

    def test_verified_internal_ids_are_removed_from_assistant_prose(self):
        text = "The Holy Smokes project (ID 75) is active; Project ID: 75 is internal."
        results = ModelRequest.model_validate({**request().model_dump(), "results": [{
            "stepId": "p1", "tool": "projects.get", "data": [{"id": 75}]
        }]}).results
        self.assertEqual(redact_verified_internal_ids(text, results), "The Holy Smokes project is active; is internal.")

    async def test_unverified_provenance_rejected(self):
        async def provider(messages):
            return Assistant(kind="assistant", text="A", sources=["backend/.env"]), metrics()
        with self.assertRaises(ProviderFailure):
            await reason(request(), provider)
