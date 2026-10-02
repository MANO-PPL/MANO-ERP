import unittest
from pydantic import ValidationError
from agent_schemas import ToolIntent, ResponseModel, ModelRequest, ARG_MODELS, Context, strict_json


class Schemas(unittest.TestCase):
    def test_context_schema_extensions(self):
        ctx = Context.model_validate({
            "route": "/vendors/42",
            "module": "Vendors",
            "selectedEntityType": "vendor",
            "selectedEntityId": "42",
            "selectedEntityName": "UltraTech Cement",
            "activeTab": "transactions",
            "viewSummary": "Showing 15 pending transactions",
            "recentRoutes": ["/projects/1", "/vendors", "/vendors/42"],
        })
        self.assertEqual(ctx.selectedEntityName, "UltraTech Cement")
        self.assertEqual(ctx.activeTab, "transactions")
        self.assertEqual(len(ctx.recentRoutes), 3)
        self.assertEqual(ctx.viewSummary, "Showing 15 pending transactions")

        with self.assertRaises(ValidationError):
            Context.model_validate({"route": "/vendors", "module": "Vendors", "extra_bad_field": 123})

    def test_S32_extra_fields_rejected_including_nested_args(self):
        for value in [dict(kind="tool", tool="vendors.create", version=1, arguments={"name": "A", "org_id": 4}),
                      dict(kind="assistant", text="A", sources=[], risk="READ")]:
            with self.assertRaises(ValidationError):
                ResponseModel.validate_python(value)

    def test_S33_python_independently_rejects_unknown_tool(self):
        with self.assertRaises(ValidationError):
            ToolIntent(kind="tool", tool="sql.execute", version=1, arguments={})

    def test_malformed_duplicate_nonfinite_json_rejected_without_repair(self):
        for raw in ['```json\n{}\n```', '{"kind":', '{"x":1,"x":2}', '{"x":NaN}']:
            with self.assertRaises(ValueError):
                strict_json(raw)

    def test_argument_types_and_ranges(self):
        for value in [True, "1", 0, -1, 1.1, 4294967296]:
            with self.assertRaises(ValidationError):
                ARG_MODELS["projects.get"].model_validate({"projectId": value})
        for value in ["2026-02-30", "not-a-date"]:
            with self.assertRaises(ValidationError):
                ARG_MODELS["resources.get"].model_validate({"resourceId": 1, "asOfDate": value})

    def test_no_authority_fields_in_tool_response(self):
        for key in ["authorization", "risk", "confirmationRequired", "executionStatus", "organizationId"]:
            with self.assertRaises(ValidationError):
                ToolIntent.model_validate(dict(kind="tool", tool="vendors.create", version=1, arguments={"name": "A"}, **{key: "allow"}))

    def test_registered_tool_contract(self):
        # Keep the Python contract in lockstep with the complete Node tool
        # registry, including the Phase 2 write operations and read helpers.
        self.assertEqual(len(ARG_MODELS), 84)
        self.assertIn("projects.create", ARG_MODELS)
        self.assertIn("projects.update", ARG_MODELS)
        self.assertIn("tasks.create", ARG_MODELS)
        self.assertIn("tasks.assign", ARG_MODELS)
        self.assertIn("meetings.create", ARG_MODELS)
        self.assertIn("qualityObservations.create", ARG_MODELS)
        self.assertIn("projectParties.update", ARG_MODELS)
        self.assertIn("projects.assignMember", ARG_MODELS)
        self.assertIn("documents.saveDraft", ARG_MODELS)
        self.assertIn("documents.submitDraft", ARG_MODELS)
        self.assertIn("documents.requestRevision", ARG_MODELS)
        self.assertIn("documents.cancelCycle", ARG_MODELS)
        self.assertIn("documents.claimRevision", ARG_MODELS)
        self.assertIn("documents.archiveInstance", ARG_MODELS)
        self.assertIn("documentTemplates.create", ARG_MODELS)
        self.assertIn("permissionTemplates.update", ARG_MODELS)
        self.assertIn("projects.setMemberPermissions", ARG_MODELS)
        self.assertIn("adminUsers.updateProfile", ARG_MODELS)
        self.assertIn("adminUsers.setSystemPermissions", ARG_MODELS)
        self.assertIn("adminUsers.search", ARG_MODELS)
        self.assertIn("permissionTemplates.search", ARG_MODELS)
        self.assertIn("documentTemplates.search", ARG_MODELS)
        self.assertIn("qualityObservations.submitFix", ARG_MODELS)
        self.assertIn("qualityMethodologies.create", ARG_MODELS)
        self.assertIn("qualityChecklists.update", ARG_MODELS)
        self.assertIn("tasks.update", ARG_MODELS)
        self.assertIn("tasks.deleteSelected", ARG_MODELS)
        ARG_MODELS["tasks.deleteSelected"].model_validate({"projectId": 4, "taskIds": [8, 9]})
        with self.assertRaises(ValidationError):
            ARG_MODELS["tasks.deleteSelected"].model_validate({"projectId": 4, "taskIds": [8, 8]})
        with self.assertRaises(ValidationError):
            ARG_MODELS["tasks.deleteSelected"].model_validate({"projectId": 4, "taskIds": list(range(1, 22))})
        ARG_MODELS["projects.create"].model_validate({"name": "Bridge", "start_date": "2026-09-01"})
        with self.assertRaises(ValidationError):
            ARG_MODELS["projects.create"].model_validate({"name": "Bridge", "org_id": 8})
        with self.assertRaises(ValidationError):
            ARG_MODELS["projects.update"].model_validate({"projectId": 4})
        with self.assertRaises(ValidationError):
            ARG_MODELS["projects.update"].model_validate({"projectId": 4, "status": "closed"})
        ARG_MODELS["tasks.create"].model_validate({"projectId": 4, "categoryName": "Planning", "name": "Survey"})
        ARG_MODELS["tasks.assign"].model_validate({"projectId": 4, "taskId": 9, "assigneeIds": [8]})
        ARG_MODELS["meetings.create"].model_validate({"projectId": 4, "subject": "Kickoff", "agendaPoints": ["Review scope"]})
        ARG_MODELS["projectParties.update"].model_validate({"projectId": 4, "projectPartyId": 8, "email": "party@example.com"})
        ARG_MODELS["projects.assignMember"].model_validate({"projectId": 4, "userId": 8})
        ARG_MODELS["documents.saveDraft"].model_validate({"projectId": 4, "cycleId": 8, "content": {"title": "Inspection"}})
        ARG_MODELS["documents.requestRevision"].model_validate({"projectId": 4, "cycleId": 8, "comments": "Revise quantities"})
        ARG_MODELS["documents.cancelCycle"].model_validate({"projectId": 4, "cycleId": 8})
        ARG_MODELS["documents.claimRevision"].model_validate({"projectId": 4, "cycleId": 8})
        with self.assertRaises(ValidationError):
            ARG_MODELS["documents.cancelCycle"].model_validate({"projectId": 4, "cycleId": 8, "force": True})
        ARG_MODELS["qualityObservations.submitFix"].model_validate({"projectId": 4, "observationId": 8, "uploadId": "123e4567-e89b-12d3-a456-426614174000"})
        ARG_MODELS["qualityMethodologies.create"].model_validate({"projectId": 4, "title": "Concrete", "uploadId": "123e4567-e89b-12d3-a456-426614174000"})
        with self.assertRaises(ValidationError):
            ARG_MODELS["tasks.create"].model_validate({"projectId": 4, "name": "Survey"})
        with self.assertRaises(ValidationError):
            ARG_MODELS["tasks.update"].model_validate({"projectId": 4, "taskId": 9})
        with self.assertRaises(ValidationError):
            ARG_MODELS["projects.assignMember"].model_validate({"projectId": 4, "userId": 8, "permissions": {"Tasks": "admin"}})
        with self.assertRaises(ValidationError):
            ARG_MODELS["documents.saveDraft"].model_validate({"projectId": 4, "cycleId": 8, "content": ["not an object"]})
        self.assertIn("transactions.search", ARG_MODELS)
        self.assertIn("billing.search", ARG_MODELS)
        self.assertIn("tasks.search", ARG_MODELS)
        self.assertIn("reports.getDPR", ARG_MODELS)
        self.assertIn("reports.getWPR", ARG_MODELS)
        self.assertIn("reports.getMPR", ARG_MODELS)
        valid_dpr = ARG_MODELS["reports.getDPR"].model_validate({"projectId": 4, "date": "2026-08-13"})
        self.assertEqual(valid_dpr.projectId, 4)
        self.assertEqual(valid_dpr.date, "2026-08-13")
        valid_wpr = ARG_MODELS["reports.getWPR"].model_validate({"projectId": 4, "weekNumber": 33})
        self.assertEqual(valid_wpr.projectId, 4)
        self.assertEqual(valid_wpr.weekNumber, 33)
        valid_mpr = ARG_MODELS["reports.getMPR"].model_validate({"projectId": 4, "month": 8, "year": 2026})
        self.assertEqual(valid_mpr.month, 8)
        self.assertEqual(valid_mpr.year, 2026)
        valid_txn = ARG_MODELS["transactions.search"].model_validate({"projectId": 3, "query": "cement", "limit": 25})
        self.assertEqual(valid_txn.projectId, 3)
        self.assertEqual(valid_txn.limit, 25)
        valid_task = ARG_MODELS["tasks.search"].model_validate({"projectId": 3, "query": "foundation", "limit": 25})
        self.assertEqual(valid_task.projectId, 3)
        self.assertEqual(valid_task.limit, 25)
        valid_billing = ARG_MODELS["billing.search"].model_validate({"projectId": 3, "query": "invoice", "limit": 25})
        self.assertEqual(valid_billing.projectId, 3)
        self.assertEqual(valid_billing.limit, 25)
        self.assertEqual(ToolIntent(kind="tool", tool="vendors.create", version=1, arguments={"name": "A"}).arguments, {"name": "A"})
        with self.assertRaises(ValidationError):
            ToolIntent(kind="tool", tool="vendors.create", version=True, arguments={"name": "A"})

    def test_reports_export_excel_schema(self):
        valid = ARG_MODELS["reports.exportExcel"].model_validate({"entity": "vendors", "limit": 200, "query": "cement"})
        self.assertEqual(valid.entity, "vendors")
        self.assertEqual(valid.limit, 200)
        valid_b = ARG_MODELS["reports.exportExcel"].model_validate({"entity": "billing", "limit": 200})
        self.assertEqual(valid_b.entity, "billing")
        with self.assertRaises(ValidationError):
            ARG_MODELS["reports.exportExcel"].model_validate({"entity": "invalid_entity"})
        with self.assertRaises(ValidationError):
            ARG_MODELS["reports.exportExcel"].model_validate({"entity": "vendors", "limit": 600})

    def test_cost_simulation_schema(self):
        valid = ARG_MODELS["resources.simulateCostImpact"].model_validate({
            "resourceName": "cement",
            "rateDelta": "+40.00",
            "percentageDelta": 15
        })
        self.assertEqual(valid.resourceName, "cement")
        self.assertEqual(valid.rateDelta, "+40.00")
        self.assertEqual(valid.percentageDelta, 15)
        with self.assertRaises(ValidationError):
            ARG_MODELS["resources.simulateCostImpact"].model_validate({"rateDelta": "invalid"})
        with self.assertRaises(ValidationError):
            ARG_MODELS["resources.simulateCostImpact"].model_validate({"percentageDelta": 999})
