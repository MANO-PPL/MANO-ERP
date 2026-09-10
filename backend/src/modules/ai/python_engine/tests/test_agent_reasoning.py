import json
import unittest
from unittest.mock import patch
import agent_reasoning
from agent_reasoning import redact_verified_internal_ids, reason, WRITE_TOOLS
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

    async def test_unverified_provenance_rejected(self):
        async def provider(messages):
            return Assistant(kind="assistant", text="A", sources=["backend/.env"]), metrics()
        with self.assertRaises(ProviderFailure):
            await reason(request(), provider)

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




