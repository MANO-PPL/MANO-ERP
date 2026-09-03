import unittest
from pydantic import ValidationError
from agent_schemas import ToolIntent, ResponseModel, ModelRequest, ARG_MODELS, strict_json


class Schemas(unittest.TestCase):
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

    def test_exact_fifteen_tool_contract(self):
        self.assertEqual(len(ARG_MODELS), 15)
        self.assertEqual(ToolIntent(kind="tool", tool="vendors.create", version=1, arguments={"name": "A"}).arguments, {"name": "A"})
        with self.assertRaises(ValidationError):
            ToolIntent(kind="tool", tool="vendors.create", version=True, arguments={"name": "A"})
