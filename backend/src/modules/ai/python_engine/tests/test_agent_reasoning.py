import json
import os
import unittest
from unittest.mock import patch
import agent_reasoning
from agent_reasoning import redact_verified_internal_ids, reason, WRITE_TOOLS
from agent_provider import ProviderFailure
from agent_schemas import ARG_MODELS, ModelRequest, Assistant, ToolIntent, Diagnostics
from agent_profiles import ModelProfile


def request():
    return ModelRequest(protocol="mano-agent-v1", requestId="r1", stepId="r1_1", message="Show suppliers", context={"route": "/vendors", "module": "Vendors"},
                        generation="a" * 64, knowledge=[{"file": "index.md", "content": "Untrusted knowledge text"}], results=[], allowedTools=["vendors.search"])


def metrics():
    return Diagnostics(finishReason="stop", promptTokens=10, completionTokens=20, totalTokens=30, hasReasoningContent=False)


class Reasoning(unittest.IsolatedAsyncioTestCase):
    async def test_document_template_type_is_not_invented(self):
        async def provider(messages):
            raise AssertionError("Missing template type must be clarified before provider planning")
        req = request().model_copy(update={
            "message": "Create a document template named QA Template, type General Document.",
            "allowedTools": ["documentTemplates.create"],
        })
        result = await reason(req, provider)
        self.assertIsInstance(result, Assistant)
        self.assertIn("singleton", result.text)
        self.assertIn("episodic", result.text)
        followup = req.model_copy(update={"message": "Episodic (multiple document instances).", "history": [
            {"role": "user", "text": req.message}, {"role": "assistant", "text": result.text},
        ]})
        followup = ModelRequest.model_validate(followup.model_dump())
        self.assertTrue(agent_reasoning.is_write_clarification_followup(followup))

    async def test_task_assignment_looks_up_project_members_after_task_search(self):
        req = ModelRequest(
            protocol="mano-agent-v1", requestId="r-assign", stepId="r-assign_2",
            message="Assign Mano Manager to the selected task",
            context={"route": "/projects/85", "module": "Tasks", "projectId": "85",
                     "selectedEntityType": "task", "selectedEntityId": "90"},
            generation="a" * 64, knowledge=[{"file": "projects/index.md", "content": "Project guidance"}],
            results=[{"stepId": "r-assign_1", "tool": "tasks.search", "data": [{"id": 90, "name": "QA task"}]}],
            allowedTools=["tasks.assign", "tasks.search", "projects.get"],
        )
        result = await reason(req)
        self.assertEqual(result.tool, "projects.get")
        self.assertEqual(result.arguments, {"projectId": 85})

    async def test_invented_data_and_missing_name_are_clarified_without_provider(self):
        async def provider(messages):
            raise AssertionError("Clarification must not call a provider")
        for message, expected in [("Create a client with random dummy details", "actual details"),
                                  ("Create a client.", "client's name")]:
            value = request().model_copy(update={"message": message, "allowedTools": ["clients.create"]})
            result = await reason(value, provider)
            self.assertIsInstance(result, Assistant)
            self.assertIn(expected, result.text)

    async def test_fully_specified_client_create_becomes_a_confirmation_backed_tool(self):
        async def provider(messages):
            raise AssertionError("A fully specified client create must not become a conversational preview")
        value = request().model_copy(update={
            "message": "Create a client named Agent Test Client, contact person Test Contact, email agent-test@example.com. Show me the details before saving.",
            "allowedTools": ["clients.create"],
        })
        result = await reason(value, provider)
        self.assertIsInstance(result, ToolIntent)
        self.assertEqual(result.tool, "clients.create")
        self.assertEqual(result.arguments, {
            "name": "Agent Test Client", "contact_person": "Test Contact", "email": "agent-test@example.com",
        })

    async def test_verified_named_vendor_update_becomes_a_confirmation_backed_tool(self):
        async def provider(messages):
            raise AssertionError("A verified vendor update must not become a conversational question")
        value = request().model_copy(update={
            "message": "Find Agent QA Vendor 20260927 and update its contact person to MD.",
            "results": [{"stepId": "r-vendor-search", "tool": "vendors.search", "data": [
                {"id": 27, "name": "Agent QA Vendor 20260927"},
            ]}],
            "allowedTools": ["vendors.update", "vendors.search"],
        })
        result = await reason(value, provider)
        self.assertIsInstance(result, ToolIntent)
        self.assertEqual(result.tool, "vendors.update")
        self.assertEqual(result.arguments, {"contactId": 27, "contact_person": "MD"})

    async def test_verified_named_resource_update_becomes_a_confirmation_backed_tool(self):
        async def provider(messages):
            raise AssertionError("A verified resource update must not become a conversational question")
        value = request().model_copy(update={
            "message": "Find Agent Test Cement and change its description to Cement used for testing.",
            "results": [{"stepId": "r-resource-search", "tool": "resources.search", "data": [
                {"id": 39, "name": "Agent Test Cement"},
            ]}],
            "allowedTools": ["resources.update", "resources.search"],
        })
        result = await reason(value, provider)
        self.assertIsInstance(result, ToolIntent)
        self.assertEqual(result.tool, "resources.update")
        self.assertEqual(result.arguments, {"resourceId": 39, "description": "Cement used for testing"})

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

    async def test_native_read_langchain_receives_groq_oss_20b_model(self):
        seen = {}

        async def langchain_provider(messages, **kwargs):
            seen.update(kwargs)
            return Assistant(kind="assistant", text="Read-only fixture", sources=["index.md"]), metrics()

        with patch.dict(os.environ, {"GROQ_API_KEY": "fixture"}):
            with patch("agent_reasoning.complete_with_langchain", new=langchain_provider):
                result = await reason(request())

        self.assertEqual(result.response.kind, "assistant")
        self.assertEqual(seen["model"], "openai/gpt-oss-20b")
        self.assertEqual(seen["profile"], "groq-oss-20b")
        self.assertEqual(seen["native_operations"], ["vendors.search"])
        self.assertGreaterEqual(seen["max_tokens"], 1024)

    def test_langchain_truncation_and_plain_text_fail_closed(self):
        from langchain_core.messages import AIMessage
        from agent_langchain import parse_langchain_output

        for content, finish_reason, category in [
            ("G", "length", "provider_output_limit"),
            ("G", "stop", "provider_output_invalid_json"),
        ]:
            with self.assertRaises(ProviderFailure) as observed:
                parse_langchain_output(AIMessage(
                    content=content, response_metadata={"finish_reason": finish_reason}
                ))
            self.assertEqual(observed.exception.category, category)

    async def test_quality_page_explanation_uses_read_profile(self):
        seen = []

        async def read_provider(messages, **kwargs):
            seen.append(json.loads(messages[1]["content"]))
            self.assertIn("QA/QC Matrix", messages[0]["content"])
            self.assertIn("Do not claim a metrics dashboard", messages[0]["content"])
            return Assistant(kind="assistant", text="Quality page fixture", sources=[]), metrics()

        req = ModelRequest(
            protocol="mano-agent-v1", requestId="r-quality-page", stepId="r-quality-page-1",
            message="What can I do on this Quality page?",
            context={"route": "/projects/85", "module": "Projects", "activeTab": "Quality", "projectId": "85"},
            generation="a" * 64, knowledge=[{"file": "projects/index.md", "content": "Quality guidance"}],
            results=[], allowedTools=["qualityObservations.create", "projects.get"],
        )
        with patch("agent_reasoning.complete_with_profile", side_effect=AssertionError("write profile called")):
            result = await reason(req, read_provider=read_provider)

        self.assertEqual(result.response.text, "Quality page fixture")
        self.assertEqual(seen[0]["allowedTools"], [])

    async def test_incomplete_quality_observation_asks_for_required_details_without_provider(self):
        req = ModelRequest(
            protocol="mano-agent-v1", requestId="r-quality-create", stepId="r-quality-create-1",
            message="Create a quality observation for this project.",
            context={"route": "/projects/85", "module": "Projects", "activeTab": "Quality", "projectId": "85"},
            generation="a" * 64, knowledge=[{"file": "index.md", "content": "Overview"}],
            results=[], allowedTools=["qualityObservations.create"],
        )
        with patch("agent_reasoning.complete_with_profile", side_effect=AssertionError("provider called")):
            result = await reason(req)

        self.assertIsInstance(result, Assistant)
        self.assertIn("location", result.text)
        self.assertIn("what you observed", result.text)

    async def test_write_requests_select_groq_write_profile(self):
        seen = {}

        async def write_profile_provider(profile, messages, **kwargs):
            seen["profile"] = profile
            seen["native_operations"] = kwargs.get("native_operations")
            seen["request"] = json.loads(messages[1]["content"])
            self.assertIn('"vendors.create":"vendors__create"', messages[0]["content"])
            self.assertIn("never kind/tool/version/arguments wrappers", messages[0]["content"])
            return Assistant(kind="assistant", text="A confirmation is required before creating a supplier.",
                             sources=["vendors/index.md"]), metrics()

        write_request = ModelRequest.model_validate({
            **request().model_dump(),
            "message": "Add a new supplier named Example Supplier",
            "knowledge": [
                {"file": "index.md", "content": "overview"},
                {"file": "vendors/index.md", "content": "supplier guidance"},
                {"file": "clients/index.md", "content": "must not be sent"},
            ],
            "allowedTools": ["vendors.create"],
        })
        with patch("agent_reasoning.complete_with_profile", new=write_profile_provider):
            result = await reason(write_request)
        self.assertEqual(seen["profile"].provider, "groq")
        self.assertEqual(seen["profile"].name, "groq-oss-20b")
        self.assertEqual(seen["profile"].model, "openai/gpt-oss-20b")
        self.assertEqual(seen["native_operations"], ["vendors.create"])
        self.assertEqual([item["file"] for item in seen["request"]["knowledge"]], ["index.md", "vendors/index.md"])
        self.assertEqual(result.response.kind, "assistant")

    async def test_oversized_write_context_is_rejected_before_provider_call(self):
        called = False

        async def write_profile_provider(*args, **kwargs):
            nonlocal called
            called = True
            raise AssertionError("provider must not receive an over-budget write request")

        small_profile = ModelProfile(
            name="fixture-groq", provider="groq", model="fixture-model",
            supported_modes=frozenset({"planning"}), native_tools=True,
            strict_json_schema=True, max_input_tokens=1, max_output_tokens=1,
            supports_reasoning=False,
        )
        write_request = ModelRequest.model_validate({
            **request().model_dump(),
            "message": "Add a new supplier named Example Supplier",
            "knowledge": [{"file": "vendors/index.md", "content": "x" * 5000}],
            "allowedTools": ["vendors.create"],
        })
        with patch("agent_reasoning.get_write_profile", return_value=small_profile):
            with patch("agent_reasoning.complete_with_profile", new=write_profile_provider):
                with self.assertRaisesRegex(ProviderFailure, "^model_input_limit$"):
                    await reason(write_request)
        self.assertFalse(called)

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
                                                                         if name not in WRITE_TOOLS]})
        await reason(project_request, read_provider=groq)
        request_data = json.loads(seen[0][1]["content"])
        self.assertEqual(request_data["allowedTools"], ["projects.search", "projects.get", "projects.getExecutiveBriefing", "projectParties.list"])

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

    async def test_unverified_knowledge_source_removed_but_result_source_rejected(self):
        async def provider(messages):
            return Assistant(kind="assistant", text="A", sources=["backend/.env"]), metrics()
        response = await reason(request(), provider)
        self.assertEqual(response.response.sources, [])
        with_result = ModelRequest.model_validate({**request().model_dump(), "results": [
            {"stepId": "r1_0", "tool": "vendors.get", "data": [{"id": 1, "name": "Fixture"}]}
        ]})
        with self.assertRaises(ProviderFailure):
            await reason(with_result, provider)

    async def test_visual_analytics_intent_planning(self):
        analytics_request = ModelRequest.model_validate({
            **request().model_dump(),
            "message": "Can you show me a breakdown chart of our vendors by category?",
            "context": {"route": "/vendors", "module": "Vendors"},
            "allowedTools": ["vendors.search", "vendors.get", "analytics.query"],
            "results": []
        })
        res = await reason(analytics_request)
        self.assertEqual(res.tool, "analytics.query")
        self.assertEqual(res.arguments["entity"], "vendors")
        self.assertEqual(res.arguments["dimension"], "category")

    async def test_executive_briefing_intent_planning(self):
        briefing_request = ModelRequest.model_validate({
            **request().model_dump(),
            "message": "Give me an executive briefing for project 42",
            "context": {"route": "/projects", "module": "Projects"},
            "allowedTools": ["projects.search", "projects.get", "projects.getExecutiveBriefing"],
            "results": []
        })
        res = await reason(briefing_request)
        self.assertEqual(res.kind, "tool")
        self.assertEqual(res.tool, "projects.getExecutiveBriefing")
        self.assertEqual(res.arguments["projectId"], 42)

    async def test_executive_briefing_context_project_id(self):
        context_request = ModelRequest.model_validate({
            **request().model_dump(),
            "message": "Summarize this project status 360",
            "context": {"route": "/projects/15", "module": "projects", "projectId": "15"},
            "allowedTools": ["projects.search", "projects.get", "projects.getExecutiveBriefing"],
            "results": []
        })
        res = await reason(context_request)
        self.assertEqual(res.kind, "tool")
        self.assertEqual(res.tool, "projects.getExecutiveBriefing")
        self.assertEqual(res.arguments["projectId"], 15)

    async def test_navigation_teleport_vendors_intent(self):
        nav_request = ModelRequest.model_validate({
            **request().model_dump(),
            "message": "Open vendors list please",
            "context": {"route": "/", "module": "Dashboard"},
            "allowedTools": ["vendors.search", "vendors.get"],
            "results": []
        })
        res = await reason(nav_request)
        self.assertEqual(res.kind, "tool")
        self.assertEqual(res.tool, "vendors.search")
        self.assertEqual(res.arguments["limit"], 20)

    async def test_navigation_teleport_inventory_intent(self):
        nav_request = ModelRequest.model_validate({
            **request().model_dump(),
            "message": "Take me to inventory",
            "context": {"route": "/projects", "module": "Projects"},
            "allowedTools": ["resources.search", "resources.get"],
            "results": []
        })
        res = await reason(nav_request)
        self.assertEqual(res.kind, "tool")
        self.assertEqual(res.tool, "resources.search")
        self.assertEqual(res.arguments["limit"], 20)

    async def test_approvals_list_pending_intent(self):
        req = ModelRequest.model_validate({
            **request().model_dump(),
            "message": "What approvals are waiting for my sign-off today?",
            "context": {"route": "/projects", "module": "Projects"},
            "allowedTools": ["approvals.listPending", "approvals.decide"],
            "results": []
        })
        res = await reason(req)
        self.assertEqual(res.kind, "tool")
        self.assertEqual(res.tool, "approvals.listPending")
        self.assertEqual(res.arguments["limit"], 20)

    async def test_approvals_decide_intent(self):
        req = ModelRequest.model_validate({
            **request().model_dump(),
            "message": "Approve observation 42",
            "context": {"route": "/projects", "module": "Projects"},
            "allowedTools": ["approvals.listPending", "approvals.decide"],
            "results": []
        })
        res = await reason(req)
        self.assertEqual(res.kind, "tool")
        self.assertEqual(res.tool, "approvals.decide")
        self.assertEqual(res.arguments["itemType"], "qaqc_observation")
        self.assertEqual(res.arguments["itemId"], 42)
        self.assertEqual(res.arguments["action"], "approve")

    async def test_approvals_batch_decide_intent(self):
        req = ModelRequest.model_validate({
            **request().model_dump(),
            "message": "Approve all pending items",
            "context": {"route": "/projects", "module": "Projects"},
            "allowedTools": ["approvals.listPending", "approvals.batchDecide"],
            "results": []
        })
        res = await reason(req)
        self.assertEqual(res.kind, "tool")
        self.assertEqual(res.tool, "approvals.batchDecide")
        self.assertEqual(res.arguments["action"], "approve")

    async def test_reports_export_excel_intent(self):
        req = ModelRequest.model_validate({
            **request().model_dump(),
            "message": "Export all vendors to Excel spreadsheet report",
            "context": {"route": "/vendors", "module": "Vendors"},
            "allowedTools": ["vendors.search", "reports.exportExcel"],
            "results": []
        })
        res = await reason(req)
        self.assertEqual(res.kind, "tool")
        self.assertEqual(res.tool, "reports.exportExcel")
        self.assertEqual(res.arguments["entity"], "vendors")

    async def test_cost_simulation_intent(self):
        req = ModelRequest.model_validate({
            **request().model_dump(),
            "message": "What happens if cement increases by 40 per bag?",
            "context": {"route": "/resources", "module": "Resources"},
            "allowedTools": ["resources.search", "resources.simulateCostImpact"],
            "results": []
        })
        res = await reason(req)
        self.assertEqual(res.kind, "tool")
        self.assertEqual(res.tool, "resources.simulateCostImpact")
        self.assertEqual(res.arguments["resourceName"], "cement")
        self.assertEqual(res.arguments["rateDelta"], "+40.00")

    async def test_fuzzy_analytics_misspelled_prompt(self):
        req = ModelRequest.model_validate({
            **request().model_dump(),
            "message": "shwo me vendros by loctn",
            "context": {"route": "/vendors", "module": "Vendors"},
            "allowedTools": ["analytics.query", "vendors.search"],
            "results": []
        })
        res = await reason(req)
        self.assertEqual(res.kind, "tool")
        self.assertEqual(res.tool, "analytics.query")
        self.assertEqual(res.arguments["entity"], "vendors")
        self.assertEqual(res.arguments["dimension"], "location")
        self.assertEqual(res.arguments["visualization"], "bar")

    async def test_analytics_db_overview_instead_of_100_pages(self):
        req = ModelRequest.model_validate({
            **request().model_dump(),
            "message": "view the data from the db instead of checking 100 pages",
            "context": {"route": "/", "module": "Dashboard"},
            "allowedTools": ["analytics.query", "vendors.search"],
            "results": []
        })
        res = await reason(req)
        self.assertEqual(res.kind, "tool")
        self.assertEqual(res.tool, "analytics.query")
        self.assertEqual(res.arguments["entity"], "overview")

    async def test_analytics_transactions_month_line(self):
        req = ModelRequest.model_validate({
            **request().model_dump(),
            "message": "monthly trend of transactions",
            "context": {"route": "/transactions", "module": "Ledger"},
            "allowedTools": ["analytics.query"],
            "results": []
        })
        res = await reason(req)
        self.assertEqual(res.kind, "tool")
        self.assertEqual(res.tool, "analytics.query")
        self.assertEqual(res.arguments["entity"], "transactions")
        self.assertEqual(res.arguments["dimension"], "month")
        self.assertEqual(res.arguments["visualization"], "line")

    async def test_analytics_multi_entity_routes_to_overview(self):
        req = ModelRequest.model_validate({
            **request().model_dump(),
            "message": "compare vendors and projects data",
            "context": {"route": "/", "module": "Dashboard"},
            "allowedTools": ["analytics.query"],
            "results": []
        })
        res = await reason(req)
        self.assertEqual(res.kind, "tool")
        self.assertEqual(res.tool, "analytics.query")
        self.assertEqual(res.arguments["entity"], "overview")

    async def test_module_overview_does_not_trigger_erp_analytics(self):
        req = ModelRequest.model_validate({
            **request().model_dump(),
            "message": "overview of the project module",
            "context": {"route": "/projects", "module": "Projects"},
            "knowledge": [{"file": "projects/index.md", "content": "Projects module overview docs"}],
            "allowedTools": ["projects.search", "projects.get", "analytics.query"],
            "results": []
        })
        async def mock_provider(messages, **kwargs):
            return Assistant(
                kind="assistant",
                text="The Projects module manages organization-scoped construction projects, member permissions, parties, and resource allocations.",
                sources=["projects/index.md"]
            ), metrics()
        res = await reason(req, provider=mock_provider, read_provider=mock_provider)
        self.assertEqual(res.response.kind, "assistant")
        self.assertIn("Projects module", res.response.text)

    def test_select_read_tools_empty_for_module_overview_queries(self):
        from agent_reasoning import select_read_tools
        req = ModelRequest.model_validate({
            **request().model_dump(),
            "message": "overview of the project module",
            "context": {"route": "/projects", "module": "Projects"},
            "allowedTools": ["projects.search", "projects.get", "analytics.query"],
            "results": []
        })
        self.assertEqual(select_read_tools(req), [])

        req2 = ModelRequest.model_validate({
            **request().model_dump(),
            "message": "give me an overview of this module",
            "context": {"route": "/projects", "module": "Projects"},
            "allowedTools": ["projects.search", "projects.get", "analytics.query"],
            "results": []
        })
        self.assertEqual(select_read_tools(req2), [])

    def test_format_records_as_clean_list_consolidates_all_items(self):
        from agent_reasoning import format_records_as_clean_list
        sample_results = [{
            "stepId": "s-1",
            "tool": "projectParties.list",
            "data": [
                {"id": 1, "name": "4 Th Diamension", "category": "Client"},
                {"id": 2, "name": "Abhishek Enterprises", "category": "Contractor"},
                {"id": 3, "name": "Ashtech (India) Pvt. Ltd.", "category": "Supplier"},
                {"id": 4, "name": "c", "category": "Contractor"},
                {"id": 5, "name": "sdcsc", "category": "PMC"}
            ]
        }]
        input_text = (
            "The Metro Line Extension Project currently has 5 associated parties. Based on the project records, the vendors (Contractors and Suppliers) are:\n"
            "1. Abhishek Enterprises Contractor\n"
            "2. Ashtech India Pvt. Ltd. Supplier\n"
            "3. c Contractor\n"
            "The project also includes one Client (4 Th Diamension) and one PMC sdcsc."
        )
        formatted = format_records_as_clean_list(input_text, sample_results)
        self.assertIn("1. Abhishek Enterprises Contractor", formatted)
        self.assertIn("2. Ashtech India Pvt. Ltd. Supplier", formatted)
        self.assertIn("3. c Contractor", formatted)
        self.assertIn("4. 4 Th Diamension - Client", formatted)
        self.assertIn("5. sdcsc - PMC", formatted)
        self.assertNotIn("The project also includes one Client", formatted)
        self.assertIn("**Project Parties (5):**", formatted)

    def test_format_records_as_clean_list_preserves_clarifications(self):
        from agent_reasoning import format_records_as_clean_list
        sample_results = [{
            "stepId": "s-1",
            "tool": "projects.search",
            "data": [
                {"id": 1, "name": "Project A"},
                {"id": 2, "name": "Project B"}
            ]
        }]
        clarify = "Multiple projects matched 'Project': 'Project A' and 'Project B'. Which one would you like to view?"
        formatted = format_records_as_clean_list(clarify, sample_results)
        self.assertEqual(formatted, clarify)

    def test_project_tabs_tool_selection_and_explanation(self):
        from agent_reasoning import select_read_tools, is_module_explanation_query

        # Explanation queries for tabs return True
        tab_explanations = [
            "overview of tasks", "overview of wip", "overview of reports",
            "overview of drawings", "overview of planning", "overview of phases",
            "overview of contracts", "overview of quality", "overview of safety",
            "overview of settings", "overview of dashboard", "overview of this tab",
            "explain this tab"
        ]
        for query in tab_explanations:
            self.assertTrue(is_module_explanation_query(query), f"Should recognize '{query}' as explanation query")

        # Tab-aware tool selection
        mock_req = ModelRequest(
            protocol="mano-agent-v1", requestId="r1", stepId="r1_1",
            message="What is the status here?",
            context={"route": "/projects/12", "module": "Tasks", "activeTab": "Tasks", "projectId": "12"},
            generation="a" * 64, knowledge=[{"file": "projects/index.md", "content": "Projects knowledge"}],
            results=[], allowedTools=["projects.get", "projects.search", "projects.getExecutiveBriefing", "vendors.search", "tasks.search"]
        )
        tools = select_read_tools(mock_req)
        self.assertIn("projects.getExecutiveBriefing", tools)
        self.assertIn("projects.get", tools)
        self.assertIn("tasks.search", tools)

    def test_write_tool_selection_prioritizes_explicit_operation_over_project_scope(self):
        from agent_reasoning import select_write_tools
        allowed = [
            "projects.create", "projects.update", "meetings.create", "meetings.update",
            "summaries.create", "summaries.update", "qualityObservations.create",
            "qualityObservations.update", "projects.search", "projects.get",
        ]
        for message, expected in [
            ("Create a project summary titled QA update", {"summaries.create", "summaries.update"}),
            ("Schedule a meeting for this project", {"meetings.create", "meetings.update"}),
            ("Create a quality observation for this project", {"qualityObservations.create", "qualityObservations.update"}),
        ]:
            req = ModelRequest(
                protocol="mano-agent-v1", requestId="r-write", stepId="r-write-1", message=message,
                context={"route": "/projects/4", "module": "Projects", "projectId": "4"},
                generation="a" * 64, knowledge=[{"file": "projects/index.md", "content": "Projects knowledge"}],
                results=[], allowedTools=allowed,
            )
            selected = set(select_write_tools(req))
            self.assertTrue(expected.issubset(selected), message)
            self.assertNotIn("projects.create", selected, message)

    def test_task_write_selection_exposes_only_requested_mutation(self):
        from agent_reasoning import select_write_tools
        task_mutations = {
            "tasks.create", "tasks.update", "tasks.deleteSelected", "tasks.assign", "tasks.createCategory",
            "tasks.updateCategory", "tasks.reorder",
        }
        for message, expected in [
            ("Create a task named QA test for this project", "tasks.create"),
            ("Update the selected task's priority to High", "tasks.update"),
            ("Assign a member to the selected task", "tasks.assign"),
            ("Create a task category called QA", "tasks.createCategory"),
            ("Rename the selected task category to QA", "tasks.updateCategory"),
            ("Reorder the tasks in this project", "tasks.reorder"),
            ("Delete these selected tasks from this project", "tasks.deleteSelected"),
        ]:
            req = ModelRequest(
                protocol="mano-agent-v1", requestId="r-task-write", stepId="r-task-write-1",
                message=message, context={"route": "/projects/4", "module": "Tasks", "projectId": "4"},
                generation="a" * 64, knowledge=[{"file": "projects/index.md", "content": "Projects knowledge"}],
                results=[], allowedTools=list(task_mutations | {"projects.search", "projects.get", "tasks.search"}),
            )
            selected = set(select_write_tools(req))
            self.assertEqual(selected & task_mutations, {expected}, message)
            self.assertIn("tasks.search", selected, message)

    def test_document_cycle_write_selection_exposes_phase_three_actions(self):
        from agent_reasoning import select_write_tools
        document_mutations = {
            "documents.saveDraft", "documents.submitDraft", "documents.requestRevision",
            "documents.cancelCycle", "documents.claimRevision",
        }
        allowed = list(document_mutations | {"projects.search", "projects.get"})
        for message, expected in [
            ("Save this document draft", "documents.saveDraft"),
            ("Submit this document draft for approval", "documents.submitDraft"),
            ("Request a revision for this document cycle", "documents.requestRevision"),
            ("Cancel this document cycle", "documents.cancelCycle"),
            ("Claim this requested revision", "documents.claimRevision"),
        ]:
            req = ModelRequest(
                protocol="mano-agent-v1", requestId="r-document-write", stepId="r-document-write-1",
                message=message, context={"route": "/projects/4/documents", "module": "General Documents", "projectId": "4"},
                generation="a" * 64, knowledge=[{"file": "projects/index.md", "content": "Projects knowledge"}],
                results=[], allowedTools=allowed,
            )
            selected = set(select_write_tools(req))
            self.assertIn(expected, selected, message)
            self.assertEqual(selected & document_mutations, {expected}, message)
            self.assertIn("projects.search", selected, message)

    def test_named_vendor_party_add_exposes_vendor_lookup(self):
        from agent_reasoning import select_write_tools
        req = ModelRequest(
            protocol="mano-agent-v1", requestId="r-party-add", stepId="r-party-add-1",
            message="Add the existing vendor Agent QA Vendor 20260927 as a contractor to this project.",
            context={"route": "/projects/85", "module": "Projects", "projectId": "85"},
            generation="a" * 64, knowledge=[{"file": "projects/index.md", "content": "Projects knowledge"}],
            results=[], allowedTools=[
                "projectParties.add", "projectParties.update", "vendors.search", "vendors.get",
                "projects.search", "projects.get",
            ],
        )
        selected = set(select_write_tools(req))
        self.assertIn("projectParties.add", selected)
        self.assertIn("vendors.search", selected)
        self.assertNotIn("projectParties.update", selected)

    async def test_party_add_rejects_verified_category_mismatch(self):
        async def provider(messages):
            return ToolIntent(kind="tool", tool="projectParties.add", version=1,
                              arguments={"projectId": 85, "contactId": 42}), metrics().model_copy(
                                  update={"finishReason": "tool_calls"})

        base = ModelRequest(
            protocol="mano-agent-v1", requestId="r-party-role", stepId="r-party-role-2",
            message="Add the existing vendor Example Vendor as a contractor to this project.",
            context={"route": "/projects/85", "module": "Projects", "projectId": "85"},
            generation="a" * 64, knowledge=[{"file": "projects/index.md", "content": "Projects knowledge"}],
            results=[{"stepId": "r-party-role-1", "tool": "vendors.search",
                      "data": [{"id": 42, "name": "Example Vendor", "category": "Supplier"}]}],
            allowedTools=["projectParties.add", "vendors.search"],
        )
        result = await reason(base, provider)
        self.assertEqual(result.response.kind, "assistant")
        self.assertIn("Supplier, not Contractor", result.response.text)
        self.assertEqual(result.diagnostics.finishReason, "stop")

        matching = base.model_copy(update={"results": [base.results[0].model_copy(update={
            "data": [{"id": 42, "name": "Example Vendor", "category": "Contractor"}]})]})
        matching_result = await reason(matching, provider)
        self.assertEqual(matching_result.response.tool, "projectParties.add")
        self.assertEqual(matching_result.diagnostics.finishReason, "tool_calls")

    async def test_answer_to_directory_write_clarification_stays_on_write_path(self):
        seen = {}

        async def write_provider(profile, messages, **kwargs):
            seen["profile"] = profile
            seen["native_operations"] = kwargs.get("native_operations")
            seen["request"] = json.loads(messages[1]["content"])
            return ToolIntent(
                kind="tool", tool="directory.create", version=1,
                arguments={"projectId": 4, "contact_person": "Tester", "designation": "Employee"},
            ), metrics()

        req = ModelRequest(
            protocol="mano-agent-v1", requestId="r-directory-followup", stepId="r-directory-followup-1",
            message="Tester is the name",
            context={"route": "/projects/4/directory", "module": "Projects", "projectId": "4"},
            history=[
                {"role": "user", "text": "Add Employee to this project directory as employee"},
                {"role": "assistant", "text": "No ERP changes were made. I need the employee's name (and optional contact details) to add them to the project directory. Could you provide that information?"},
            ],
            generation="a" * 64, knowledge=[
                {"file": "index.md", "content": "Overview"},
                {"file": "projects/index.md", "content": "Project directory guidance"},
            ],
            results=[], allowedTools=["projects.search", "projects.get", "directory.create", "directory.update"],
        )
        with patch("agent_reasoning.complete_with_profile", new=write_provider):
            result = await reason(req)

        self.assertEqual(result.response.tool, "directory.create")
        self.assertIn("directory.create", seen["native_operations"])
        self.assertIn("directory.update", seen["native_operations"])
        self.assertNotIn("projects.create", seen["native_operations"])
        self.assertEqual(seen["request"]["message"], "Tester is the name")
        self.assertEqual([item["role"] for item in seen["request"]["history"]], ["user", "assistant"])
        self.assertIn("Add Employee to this project directory", seen["request"]["history"][0]["text"])

    async def test_write_planner_does_not_repeat_a_completed_template_lookup(self):
        seen = {}

        async def write_provider(profile, messages, **kwargs):
            seen["tools"] = kwargs.get("native_operations")
            return ToolIntent(
                kind="tool", tool="documentTemplates.update", version=1,
                arguments={"projectId": 75, "documentId": 8, "expectedName": "Project Summary",
                           "description": "QA preview update only"},
            ), metrics()

        req = ModelRequest(
            protocol="mano-agent-v1", requestId="r-template-followup", stepId="r-template-followup-2",
            message="Update the existing document template 'Project Summary' for this project. Set its description to 'QA preview update only'.",
            context={"route": "/projects/75", "module": "General Documents", "projectId": "75"},
            generation="a" * 64, knowledge=[{"file": "projects/index.md", "content": "Project document guidance"}],
            results=[{"stepId": "r-template-followup-1", "tool": "documentTemplates.search",
                      "data": [{"id": 8, "name": "Project Summary", "docType": "singleton"}]}],
            allowedTools=["documentTemplates.update", "documentTemplates.search", "projects.search", "projects.get"],
        )
        with patch("agent_reasoning.complete_with_profile", new=write_provider):
            result = await reason(req)

        self.assertEqual(result.response.tool, "documentTemplates.update")
        self.assertIn("documentTemplates.update", seen["tools"])
        self.assertNotIn("documentTemplates.search", seen["tools"])

    async def test_scheduled_meeting_is_a_write_and_never_an_executive_briefing(self):
        seen = {}

        async def write_provider(profile, messages, **kwargs):
            seen["tools"] = kwargs.get("native_operations")
            return ToolIntent(
                kind="tool", tool="meetings.create", version=1,
                arguments={"projectId": 4, "subject": "QA review"},
            ), metrics()

        req = ModelRequest(
            protocol="mano-agent-v1", requestId="r-meeting", stepId="r-meeting-1",
            message="Schedule a meeting for this project titled QA review",
            context={"route": "/projects/4", "module": "Projects", "projectId": "4"},
            generation="a" * 64, knowledge=[{"file": "projects/index.md", "content": "Projects knowledge"}],
            results=[], allowedTools=[
                "projects.getExecutiveBriefing", "projects.search", "projects.get",
                "meetings.create", "meetings.update",
            ],
        )
        with patch("agent_reasoning.complete_with_profile", new=write_provider):
            result = await reason(req)
        self.assertEqual(result.response.tool, "meetings.create")
        self.assertIn("meetings.create", seen["tools"])
        self.assertNotIn("projects.getExecutiveBriefing", seen["tools"])

    async def test_cancel_document_cycle_with_phase_label_is_not_a_briefing(self):
        seen = {}

        async def write_provider(profile, messages, **kwargs):
            seen["tools"] = kwargs.get("native_operations")
            return Assistant(kind="assistant", text="Which document cycle should I cancel?", sources=[]), metrics()

        req = ModelRequest(
            protocol="mano-agent-v1", requestId="r-cycle", stepId="r-cycle-1",
            message="Cancel the selected document cycle for this project. Comment: Phase 3 QA cancellation check.",
            context={"route": "/projects/85", "module": "Projects", "projectId": "85"},
            generation="a" * 64, knowledge=[{"file": "projects/index.md", "content": "Projects knowledge"}],
            results=[], allowedTools=[
                "projects.getExecutiveBriefing", "projects.search", "projects.get",
                "documents.cancelCycle", "documentCycles.search",
            ],
        )
        with patch("agent_reasoning.complete_with_profile", new=write_provider):
            result = await reason(req)
        self.assertEqual(result.response.kind, "assistant")
        self.assertIn("documents.cancelCycle", seen["tools"])
        self.assertNotIn("projects.getExecutiveBriefing", seen["tools"])

    async def test_incomplete_native_write_retries_in_json_mode(self):
        failures = [
            ProviderFailure(
                "provider_http_failure",
                provider="groq",
                http_status=400,
                provider_error_category="tool_generation_failure",
            ),
            ProviderFailure(
                "provider_output_empty",
                provider="groq",
                profile="groq-oss-20b",
                finish_reason="stop",
                completion_tokens=66,
                content_length=0,
            ),
            ProviderFailure("provider_output_invalid_json", provider="groq", profile="groq-oss-20b"),
            ProviderFailure("provider_output_limit", provider="groq", profile="groq-oss-20b"),
        ]
        for failure in failures:
            calls = []

            async def write_provider(profile, messages, **kwargs):
                calls.append({"messages": messages, **kwargs})
                if len(calls) == 1:
                    raise failure
                return ToolIntent(
                    kind="tool", tool="meetings.create", version=1,
                    arguments={"projectId": 4, "subject": "QA review"},
                ), metrics()

            req = ModelRequest(
                protocol="mano-agent-v1", requestId="r-meeting-retry", stepId="r-meeting-retry-1",
                message="Schedule a meeting for this project titled QA review",
                context={"route": "/projects/4", "module": "Projects", "projectId": "4"},
                generation="a" * 64, knowledge=[{"file": "projects/index.md", "content": "Projects knowledge"}],
                results=[], allowedTools=["meetings.create"],
            )
            with patch("agent_reasoning.complete_with_profile", new=write_provider):
                result = await reason(req)

            self.assertEqual(result.response.tool, "meetings.create")
            self.assertEqual(len(calls), 2)
            self.assertEqual(calls[0]["native_operations"], ["meetings.create"])
            self.assertIsNone(calls[1]["native_operations"])
            self.assertIn("native function call", calls[0]["messages"][0]["content"])
            self.assertNotIn("Tool argument schemas:", calls[0]["messages"][0]["content"])
            self.assertIn("Return exactly one JSON object", calls[1]["messages"][0]["content"])
            self.assertIn("Tool argument schemas:", calls[1]["messages"][0]["content"])
            self.assertIn('"meetings.create"', calls[1]["messages"][0]["content"])
            self.assertNotIn("native function call", calls[1]["messages"][0]["content"])

    async def test_rate_limited_write_does_not_switch_model_or_provider(self):
        calls = []

        async def provider(profile, messages, **kwargs):
            calls.append((profile.provider, profile.model))
            raise ProviderFailure("provider_rate_limited", provider="groq", http_status=429)

        req = ModelRequest(
            protocol="mano-agent-v1", requestId="r-write-fallback", stepId="r-write-fallback-1",
            message="Schedule a meeting for this project titled QA review",
            context={"route": "/projects/4", "module": "Projects", "projectId": "4"},
            generation="a" * 64, knowledge=[{"file": "projects/index.md", "content": "Projects knowledge"}],
            results=[], allowedTools=["meetings.create"],
        )
        with patch("agent_reasoning.complete_with_profile", new=provider):
            with self.assertRaises(ProviderFailure) as observed:
                await reason(req)
        self.assertEqual(observed.exception.category, "provider_rate_limited")
        self.assertEqual(calls, [("groq", "openai/gpt-oss-20b")])

    async def test_invalid_json_retry_stays_on_groq_oss_20b(self):
        calls = []

        async def provider(profile, messages, **kwargs):
            calls.append((profile.provider, profile.model, kwargs.get("native_operations")))
            raise ProviderFailure("provider_output_invalid_json", provider="groq")

        req = ModelRequest(
            protocol="mano-agent-v1", requestId="r-write-json-fallback", stepId="r-write-json-fallback-1",
            message="Schedule a meeting for this project titled QA review",
            context={"route": "/projects/4", "module": "Projects", "projectId": "4"},
            generation="a" * 64, knowledge=[{"file": "projects/index.md", "content": "Projects knowledge"}],
            results=[], allowedTools=["meetings.create"],
        )
        with patch("agent_reasoning.complete_with_profile", new=provider):
            with self.assertRaises(ProviderFailure) as observed:
                await reason(req)
        self.assertEqual(observed.exception.category, "provider_output_invalid_json")
        self.assertEqual(calls, [
            ("groq", "openai/gpt-oss-20b", ["meetings.create"]),
            ("groq", "openai/gpt-oss-20b", None),
        ])

    def test_active_profiles_ignore_other_provider_settings(self):
        from agent_profiles import (get_read_primary_profile, get_read_fallback_profile,
                                    get_write_profile, get_write_fallback_profiles)
        with patch.dict(os.environ, {
            "AGENT_READ_PRIMARY_PROFILE": "groq-qwen",
            "AGENT_READ_FALLBACK_PROFILE": "nvidia-gpt-oss",
            "AGENT_WRITE_PROFILE": "nvidia-gpt-oss",
            "AGENT_WRITE_FALLBACK_PROFILE": "nvidia-gpt-oss",
        }):
            self.assertEqual(get_read_primary_profile().model, "openai/gpt-oss-20b")
            self.assertEqual(get_write_profile().model, "openai/gpt-oss-20b")
            self.assertIsNone(get_read_fallback_profile())
            self.assertEqual(get_write_fallback_profiles(get_write_profile()), [])

    async def test_unimplemented_phase_three_mutations_are_refused_without_provider(self):
        prompts = [
            "Confirm the selected ledger transaction for this project.",
            "Assign the selected project's pending material supply request to its existing contractor.",
            "Transfer the selected project's contractor assignment to the existing replacement contractor.",
        ]
        for prompt in prompts:
            req = ModelRequest.model_validate({
                **request().model_dump(), "message": prompt,
                "allowedTools": ["transactions.search", "billing.search", "projectParties.list"],
            })
            with patch("agent_reasoning.complete_with_profile", side_effect=AssertionError("provider must not invent unsupported writes")):
                result = await reason(req)
            self.assertIsInstance(result, Assistant)
            self.assertIn("no ERP changes were made", result.text)

    def test_document_cycle_and_archive_writes_include_scoped_lookups(self):
        from agent_reasoning import select_write_tools
        for prompt, write_tool, lookup in [
            ("Submit the selected Project Summary draft for approval", "documents.submitDraft", "documentCycles.search"),
            ("Archive the selected Project Summary document instance", "documents.archiveInstance", "documentInstances.search"),
        ]:
            req = ModelRequest.model_validate({
                **request().model_dump(), "message": prompt,
                "context": {"route": "/projects/75", "module": "General Documents", "projectId": "75"},
                "allowedTools": [write_tool, "documentCycles.search", "documentInstances.search", "projects.search", "projects.get"],
            })
            selected = select_write_tools(req)
            self.assertIn(write_tool, selected)
            self.assertIn(lookup, selected)

    def test_unimplemented_mutations_are_not_misreported_as_empty_searches(self):
        from agent_reasoning import unsupported_write_capability
        self.assertIn("cannot confirm", unsupported_write_capability("Confirm the selected ledger transaction"))
        self.assertIn("cannot assign", unsupported_write_capability("Assign a material supply request to a vendor"))
        self.assertIn("cannot transfer", unsupported_write_capability("Transfer this project contractor assignment"))
        self.assertIsNone(unsupported_write_capability("Show this project's ledger transactions"))

    async def test_show_the_tasks_routes_to_tasks_search_not_briefing(self):
        req = ModelRequest(
            protocol="mano-agent-v1", requestId="r_task1", stepId="r_task1_1",
            message="show the tasks",
            context={"route": "/projects/4", "module": "Tasks", "activeTab": "Tasks", "projectId": "4"},
            generation="a" * 64, knowledge=[{"file": "projects/index.md", "content": "Projects knowledge"}],
            results=[], allowedTools=["projects.get", "projects.search", "projects.getExecutiveBriefing", "tasks.search"]
        )
        res = await reason(req)
        self.assertEqual(res.kind, "tool")
        self.assertEqual(res.tool, "tasks.search")
        self.assertEqual(res.arguments["projectId"], 4)
        self.assertNotEqual(res.tool, "projects.getExecutiveBriefing")

    def test_format_records_as_clean_list_tasks(self):
        from agent_reasoning import format_records_as_clean_list
        sample_results = [{
            "stepId": "s-tasks",
            "tool": "tasks.search",
            "data": [
                {"id": 1, "name": "Site Clearing & Soil Test", "category": "Pre-Construction", "status": "COMPLETED", "priority": "HIGH"},
                {"id": 2, "name": "Foundation Excavation", "category": "Substructure", "status": "IN_PROGRESS", "priority": "MEDIUM"},
                {"id": 3, "name": "Column Rebar Fixing", "category": "Superstructure", "status": "TODO", "priority": "URGENT"}
            ]
        }]
        text = "Here are the tasks for this project:\n1. Site Clearing & Soil Test\n2. Foundation Excavation"
        formatted = format_records_as_clean_list(text, sample_results)
        self.assertIn("**Tasks (3):**", formatted)
        self.assertIn("1. Site Clearing & Soil Test", formatted)
        self.assertIn("3. Column Rebar Fixing", formatted)
        self.assertIn("URGENT Priority", formatted)

    def test_parse_natural_date(self):
        import datetime
        from agent_reasoning import parse_natural_date
        self.assertEqual(parse_natural_date("explain the 13th aug dpr"), "2026-08-13")
        self.assertEqual(parse_natural_date("what happened on 13 aug 2026"), "2026-08-13")
        self.assertEqual(parse_natural_date("show dpr for august 13th"), "2026-08-13")
        self.assertEqual(parse_natural_date("dpr 2026-08-13"), "2026-08-13")
        expected_yesterday = (datetime.date.today() - datetime.timedelta(days=1)).isoformat()
        expected_today = datetime.date.today().isoformat()
        self.assertEqual(parse_natural_date("yesterday's progress"), expected_yesterday)
        self.assertEqual(parse_natural_date("today's progress"), expected_today)

    async def test_explain_13th_aug_dpr_routes_to_reports_getDPR(self):
        req = ModelRequest(
            protocol="mano-agent-v1", requestId="r_dpr1", stepId="r_dpr1_1",
            message="explain the 13th aug dpr",
            context={"route": "/projects/4", "module": "Projects", "activeTab": "Reports", "projectId": "4"},
            generation="a" * 64, knowledge=[{"file": "projects/index.md", "content": "Projects knowledge"}],
            results=[], allowedTools=["projects.get", "projects.search", "projects.getExecutiveBriefing", "reports.getDPR", "reports.getWPR", "reports.getMPR"]
        )
        res = await reason(req)
        self.assertEqual(res.kind, "tool")
        self.assertEqual(res.tool, "reports.getDPR")
        self.assertEqual(res.arguments["projectId"], 4)
        self.assertEqual(res.arguments["date"], "2026-08-13")

    async def test_wpr_routes_to_reports_getWPR(self):
        req = ModelRequest(
            protocol="mano-agent-v1", requestId="r_wpr1", stepId="r_wpr1_1",
            message="show weekly summary for week 33",
            context={"route": "/projects/4", "module": "Projects", "activeTab": "Reports", "projectId": "4"},
            generation="a" * 64, knowledge=[{"file": "projects/index.md", "content": "Projects knowledge"}],
            results=[], allowedTools=["reports.getDPR", "reports.getWPR", "reports.getMPR"]
        )
        res = await reason(req)
        self.assertEqual(res.kind, "tool")
        self.assertEqual(res.tool, "reports.getWPR")
        self.assertEqual(res.arguments["projectId"], 4)
        self.assertEqual(res.arguments["weekNumber"], 33)

    async def test_mpr_routes_to_reports_getMPR(self):
        req = ModelRequest(
            protocol="mano-agent-v1", requestId="r_mpr1", stepId="r_mpr1_1",
            message="show monthly progress report for August 2026",
            context={"route": "/projects/4", "module": "Projects", "activeTab": "Reports", "projectId": "4"},
            generation="a" * 64, knowledge=[{"file": "projects/index.md", "content": "Projects knowledge"}],
            results=[], allowedTools=["reports.getDPR", "reports.getWPR", "reports.getMPR"]
        )
        res = await reason(req)
        self.assertEqual(res.kind, "tool")
        self.assertEqual(res.tool, "reports.getMPR")
        self.assertEqual(res.arguments["projectId"], 4)
        self.assertEqual(res.arguments["month"], 8)
        self.assertEqual(res.arguments["year"], 2026)




