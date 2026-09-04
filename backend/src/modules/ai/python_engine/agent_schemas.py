"""Agent model contracts only. This module has no ERP/database capability."""
import json
import re
from datetime import date
from typing import Annotated, Any, Literal
from pydantic import BaseModel, ConfigDict, Field, TypeAdapter, field_validator, model_validator

PROTOCOL = "mano-agent-v1"
CANONICAL = ("index.md", "vendors/index.md", "vendors/relationships.md", "clients/index.md", "resources/index.md",
             "resources/rate-versioning.md", "resources/compositions.md", "resources/impact-tracing.md", "interactions/index.md", "projects/index.md")
Id = Annotated[int, Field(strict=True, ge=1, le=4294967295)]
Limit = Annotated[int, Field(strict=True, ge=1, le=50)]
Offset = Annotated[int, Field(strict=True, ge=0, le=10000)]
Name = Annotated[str, Field(strict=True, min_length=1, max_length=120)]
Short = Annotated[str, Field(strict=True, min_length=1, max_length=80)]


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    @model_validator(mode="after")
    def safe_strings(self):
        for value in self.__dict__.values():
            if isinstance(value, str) and ("\0" in value or not value.strip()):
                raise ValueError("Invalid text")
        return self


class ListArgs(StrictModel):
    query: Name | None = None
    limit: Limit | None = None
    offset: Offset | None = None


class ProjectArgs(StrictModel):
    projectId: Id


class ContactArgs(StrictModel):
    contactId: Id


class ResourceSearchArgs(ListArgs):
    type: Literal["material", "labour", "item"] | None = None


class ResourceArgs(StrictModel):
    resourceId: Id
    projectId: Id | None = None
    asOfDate: Annotated[str, Field(pattern=r"^\d{4}-\d{2}-\d{2}$")] | None = None

    @field_validator("asOfDate")
    @classmethod
    def valid_date(cls, value):
        if value is not None:
            date.fromisoformat(value)
        return value


class RateHistoryArgs(ResourceArgs):
    limit: Limit | None = None
    offset: Offset | None = None


class PartiesArgs(ProjectArgs):
    category: Literal["Supplier", "Contractor", "Consultant", "Manufacturer", "Service Provider", "Client", "PMC"] | None = None
    limit: Limit | None = None
    offset: Offset | None = None


class InteractionsArgs(ContactArgs):
    limit: Limit | None = None
    offset: Offset | None = None


class SupplierArgs(StrictModel):
    name: Name
    contact_person: Name | None = None
    mobile: Annotated[str, Field(min_length=1, max_length=32)] | None = None
    email: Annotated[str, Field(min_length=1, max_length=254, pattern=r"^[^\s@]+@[^\s@]+\.[^\s@]+$")] | None = None
    address: Annotated[str, Field(min_length=1, max_length=500)] | None = None


class RateArgs(StrictModel):
    resourceId: Id
    projectId: Id | None = None
    rate: Annotated[str, Field(pattern=r"^(0|[1-9]\d{0,8})(\.\d{1,2})?$")]
    unit_code: Annotated[str, Field(min_length=1, max_length=30)]
    effective_from: Annotated[str, Field(pattern=r"^\d{4}-\d{2}-\d{2}$")]
    remarks: Annotated[str, Field(min_length=1, max_length=500)] | None = None

    @field_validator("effective_from")
    @classmethod
    def valid_date(cls, value):
        date.fromisoformat(value)
        return value


ARG_MODELS = {
    "projects.search": ListArgs, "projects.get": ProjectArgs, "clients.search": ListArgs, "clients.get": ContactArgs,
    "vendors.search": ListArgs, "vendors.get": ContactArgs, "resources.search": ResourceSearchArgs,
    "resources.get": ResourceArgs, "resources.getRate": ResourceArgs, "resources.getRateHistory": RateHistoryArgs,
    "resources.getComposition": ResourceArgs, "projectParties.list": PartiesArgs, "interactions.search": InteractionsArgs,
    "vendors.create": SupplierArgs, "resources.createRateVersion": RateArgs,
}
ToolName = Literal[tuple(ARG_MODELS)]


class ToolIntent(StrictModel):
    kind: Literal["tool"]
    tool: ToolName
    version: Literal[1]
    arguments: dict[str, Any]

    @field_validator("version", mode="before")
    @classmethod
    def strict_version(cls, value):
        if type(value) is not int:
            raise ValueError("Invalid tool version")
        return value

    @model_validator(mode="after")
    def arguments_for_tool(self):
        self.arguments = ARG_MODELS[self.tool].model_validate(self.arguments).model_dump(exclude_none=True)
        return self


class Assistant(StrictModel):
    kind: Literal["assistant"]
    text: Annotated[str, Field(min_length=1, max_length=8000)]
    sources: Annotated[list[Annotated[str, Field(min_length=1, max_length=100)]], Field(max_length=10)]


ResponseModel = TypeAdapter(Annotated[Assistant | ToolIntent, Field(discriminator="kind")])


class Context(StrictModel):
    route: Annotated[str, Field(min_length=1, max_length=512)]
    module: Short
    projectId: Short | None = None
    projectName: Annotated[str, Field(min_length=1, max_length=200)] | None = None
    selectedEntityType: Short | None = None
    selectedEntityId: Short | None = None


class Knowledge(StrictModel):
    file: Literal[CANONICAL]
    content: Annotated[str, Field(min_length=1, max_length=65536)]


class ReadResult(StrictModel):
    stepId: Short
    tool: ToolName
    data: Annotated[list[dict[str, Any]], Field(max_length=200)]


class HistoryMessage(StrictModel):
    role: Literal["user", "assistant"]
    text: Annotated[str, Field(min_length=1, max_length=8000)]


class ModelRequest(StrictModel):
    protocol: Literal[PROTOCOL]
    requestId: Short
    stepId: Short
    message: Annotated[str, Field(min_length=1, max_length=4000)]
    history: Annotated[list[HistoryMessage], Field(max_length=8)] = Field(default_factory=list)
    context: Context
    generation: Annotated[str, Field(pattern=r"^[0-9a-f]{64}$")]
    knowledge: Annotated[list[Knowledge], Field(min_length=1, max_length=10)]
    results: Annotated[list[ReadResult], Field(max_length=4)]
    allowedTools: Annotated[list[ToolName], Field(max_length=15)]


class Diagnostics(StrictModel):
    provider: Literal["nvidia", "groq"] = "nvidia"
    finishReason: Short
    promptTokens: Annotated[int, Field(ge=0, le=200000)]
    completionTokens: Annotated[int, Field(ge=0, le=4096)]
    totalTokens: Annotated[int, Field(ge=0, le=204096)]
    hasReasoningContent: bool


class ModelReply(StrictModel):
    protocol: Literal[PROTOCOL] = PROTOCOL
    requestId: Short
    stepId: Short
    toolNames: list[ToolName]
    response: Assistant | ToolIntent
    diagnostics: Diagnostics


def strict_json(raw):
    def pairs(items):
        result = {}
        for key, value in items:
            if key in result:
                raise ValueError("Duplicate JSON key")
            result[key] = value
        return result

    def bad_constant(_):
        raise ValueError("Non-finite JSON value")

    return json.loads(raw, object_pairs_hook=pairs, parse_constant=bad_constant)
