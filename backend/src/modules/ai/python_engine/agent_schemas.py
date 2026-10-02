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


ProjectDate = Annotated[str, Field(pattern=r"^\d{4}-\d{2}-\d{2}$")]


class ProjectCreateArgs(StrictModel):
    name: Name
    location: Name | None = None
    project_code: Name | None = None
    start_date: ProjectDate | None = None
    end_date: ProjectDate | None = None

    @model_validator(mode="after")
    def valid_dates(self):
        start = date.fromisoformat(self.start_date) if self.start_date else None
        end = date.fromisoformat(self.end_date) if self.end_date else None
        if start and end and end < start:
            raise ValueError("Invalid project dates")
        return self


class ProjectUpdateArgs(ProjectCreateArgs):
    projectId: Id
    name: Name | None = None

    @model_validator(mode="after")
    def nonempty_update(self):
        if not self.model_fields_set - {"projectId"}:
            raise ValueError("Empty update")
        return self


class TaskCreateArgs(StrictModel):
    projectId: Id
    categoryName: Name
    name: Name
    description: Annotated[str, Field(min_length=1, max_length=500)] | None = None
    status: Literal["open", "in progress", "on hold", "completed", "cancelled"] | None = None
    priority: Literal["Urgent", "High", "Medium", "Low", "None"] | None = None
    start_date: ProjectDate | None = None
    due_date: ProjectDate | None = None

    @model_validator(mode="after")
    def valid_dates(self):
        start = date.fromisoformat(self.start_date) if self.start_date else None
        end = date.fromisoformat(self.due_date) if self.due_date else None
        if start and end and end < start:
            raise ValueError("Invalid task dates")
        return self

class TaskUpdateArgs(StrictModel):
    projectId: Id
    taskId: Id
    name: Name | None = None
    description: Annotated[str, Field(min_length=1, max_length=500)] | None = None
    status: Literal["open", "in progress", "on hold", "completed", "cancelled"] | None = None
    priority: Literal["Urgent", "High", "Medium", "Low", "None"] | None = None
    start_date: ProjectDate | None = None
    due_date: ProjectDate | None = None

    @model_validator(mode="after")
    def valid_dates(self):
        start = date.fromisoformat(self.start_date) if self.start_date else None
        end = date.fromisoformat(self.due_date) if self.due_date else None
        if start and end and end < start:
            raise ValueError("Invalid task dates")
        return self

    @model_validator(mode="after")
    def nonempty_update(self):
        if not self.model_fields_set - {"projectId", "taskId"}:
            raise ValueError("Empty update")
        return self


class TaskDeleteSelectedArgs(StrictModel):
    projectId: Id
    taskIds: list[Id] = Field(min_length=1, max_length=20)

    @model_validator(mode="after")
    def unique_tasks(self):
        if len(set(self.taskIds)) != len(self.taskIds):
            raise ValueError("Duplicate task IDs")
        return self

class ProjectPartyAddArgs(StrictModel):
    projectId: Id
    contactId: Id


class ProjectPartyUpdateArgs(StrictModel):
    projectId: Id
    projectPartyId: Id
    name: Name | None = None
    contact_person: Name | None = None
    mobile: Annotated[str, Field(min_length=1, max_length=32)] | None = None
    email: Annotated[str, Field(min_length=1, max_length=254, pattern=r"^[^\s@]+@[^\s@]+\.[^\s@]+$")] | None = None
    address: Annotated[str, Field(min_length=1, max_length=500)] | None = None
    location: Name | None = None
    remarks: Annotated[str, Field(min_length=1, max_length=500)] | None = None

    @model_validator(mode="after")
    def nonempty_update(self):
        if not self.model_fields_set - {"projectId", "projectPartyId"}:
            raise ValueError("Empty update")
        return self


class ProjectMemberAssignArgs(StrictModel):
    projectId: Id
    userId: Id


class TaskAssignArgs(StrictModel):
    projectId: Id
    taskId: Id
    assigneeIds: list[Id] = Field(min_length=1, max_length=20)


class TaskCategoryCreateArgs(StrictModel):
    projectId: Id
    name: Name


class TaskCategoryUpdateArgs(TaskCategoryCreateArgs):
    categoryId: Id


class OrderItem(StrictModel):
    id: Id
    sortOrder: Annotated[int, Field(strict=True, ge=0, le=1000000)]


class TaskReorderArgs(StrictModel):
    projectId: Id
    type: Literal["task", "category"]
    items: list[OrderItem] = Field(min_length=1, max_length=50)


MeetingStatus = Literal["scheduled", "postponed", "cancelled", "completed"]
Point = Annotated[str, Field(strict=True, min_length=1, max_length=500)]


class MeetingCreateArgs(StrictModel):
    projectId: Id
    subject: Name
    venue: Name | None = None
    date: ProjectDate | None = None
    time: Annotated[str, Field(pattern=r"^([01]\d|2[0-3]):[0-5]\d$")] | None = None
    status: MeetingStatus | None = None
    agendaPoints: list[Point] = Field(default_factory=list, max_length=30)
    momPoints: list[Point] = Field(default_factory=list, max_length=30)


class MeetingUpdateArgs(StrictModel):
    projectId: Id
    meetingId: Id
    subject: Name | None = None
    venue: Name | None = None
    date: ProjectDate | None = None
    time: Annotated[str, Field(pattern=r"^([01]\d|2[0-3]):[0-5]\d$")] | None = None
    status: MeetingStatus | None = None
    agendaPoints: list[Point] | None = Field(default=None, max_length=30)
    momPoints: list[Point] | None = Field(default=None, max_length=30)

    @model_validator(mode="after")
    def nonempty_update(self):
        if not self.model_fields_set - {"projectId", "meetingId"}:
            raise ValueError("Empty update")
        return self


class DirectoryCreateArgs(StrictModel):
    projectId: Id
    partyId: Id | None = None
    contact_person: Name
    designation: Name | None = None
    responsibilities: Annotated[str, Field(min_length=1, max_length=500)] | None = None
    mobile_no: Annotated[str, Field(min_length=1, max_length=32)] | None = None
    email: Annotated[str, Field(min_length=1, max_length=254, pattern=r"^[^\s@]+@[^\s@]+\.[^\s@]+$")] | None = None
    address_line: Annotated[str, Field(min_length=1, max_length=500)] | None = None


class DirectoryUpdateArgs(DirectoryCreateArgs):
    directoryId: Id
    contact_person: Name | None = None

    @model_validator(mode="after")
    def nonempty_update(self):
        if not self.model_fields_set - {"projectId", "directoryId"}:
            raise ValueError("Empty update")
        return self


class SummaryCreateArgs(StrictModel):
    projectId: Id
    title: Name
    details: Annotated[str, Field(min_length=1, max_length=500)]
    status: Literal["pending", "in progress", "completed", "on hold"] | None = None
    date: ProjectDate | None = None


class SummaryUpdateArgs(SummaryCreateArgs):
    summaryId: Id
    title: Name | None = None
    details: Annotated[str, Field(min_length=1, max_length=500)] | None = None

    @model_validator(mode="after")
    def nonempty_update(self):
        if not self.model_fields_set - {"projectId", "summaryId"}:
            raise ValueError("Empty update")
        return self


class QualityObservationCreateArgs(StrictModel):
    projectId: Id
    location: Name
    note: Annotated[str, Field(min_length=1, max_length=500)]


class QualityObservationUpdateArgs(StrictModel):
    projectId: Id
    observationId: Id
    location: Name | None = None
    note: Annotated[str, Field(min_length=1, max_length=500)] | None = None

    @model_validator(mode="after")
    def nonempty_update(self):
        if not self.model_fields_set - {"projectId", "observationId"}:
            raise ValueError("Empty update")
        return self


class QualityObservationFixArgs(StrictModel):
    projectId: Id
    observationId: Id
    uploadId: Annotated[str, Field(pattern=r"^[0-9a-fA-F-]{36}$")]
    note: Annotated[str, Field(min_length=1, max_length=500)] | None = None


class QualityDocumentCreateArgs(StrictModel):
    projectId: Id
    title: Name
    uploadId: Annotated[str, Field(pattern=r"^[0-9a-fA-F-]{36}$")]


class QualityDocumentUpdateArgs(StrictModel):
    projectId: Id
    documentId: Id
    title: Name | None = None
    uploadId: Annotated[str, Field(pattern=r"^[0-9a-fA-F-]{36}$")]


class DocumentDraftArgs(StrictModel):
    projectId: Id
    cycleId: Id
    content: dict[str, Any]

    @field_validator("content")
    @classmethod
    def bounded_content(cls, value):
        try:
            if len(json.dumps(value, separators=(",", ":")).encode()) > 32000:
                raise ValueError("Draft content is too large")
        except (TypeError, ValueError) as exc:
            raise ValueError("Invalid draft content") from exc
        return value


class DocumentSubmitArgs(StrictModel):
    projectId: Id
    cycleId: Id
    changes_summary: Annotated[str, Field(min_length=1, max_length=500)] | None = None
    comments: Annotated[str, Field(min_length=1, max_length=500)] | None = None


class DocumentCycleCommentsArgs(StrictModel):
    projectId: Id
    cycleId: Id
    comments: Annotated[str, Field(min_length=1, max_length=500)] | None = None


class DocumentCycleArgs(StrictModel):
    projectId: Id
    cycleId: Id


class DocumentArchiveArgs(StrictModel):
    projectId: Id
    instanceId: Id


class DocumentTemplateCreateArgs(StrictModel):
    projectId: Id
    name: Name
    docType: Literal["singleton", "episodic"]
    description: Annotated[str, Field(min_length=1, max_length=500)] | None = None


class DocumentTemplateSearchArgs(ListArgs):
    projectId: Id


class ProjectDocumentSearchArgs(ListArgs):
    projectId: Id


class DocumentTemplateUpdateArgs(StrictModel):
    projectId: Id
    documentId: Id
    expectedName: Name
    name: Name | None = None
    description: Annotated[str, Field(min_length=1, max_length=500)] | None = None

    @model_validator(mode="after")
    def nonempty_update(self):
        if not self.model_fields_set - {"projectId", "documentId", "expectedName"}:
            raise ValueError("Empty update")
        return self


class AdminNameArgs(StrictModel):
    name: Name


class AdminUserProfileUpdateArgs(StrictModel):
    userId: Id
    expectedName: Name
    user_name: Name | None = None
    email: Annotated[str, Field(min_length=1, max_length=254, pattern=r"^[^\s@]+@[^\s@]+\.[^\s@]+$")] | None = None
    phone_no: Annotated[str, Field(min_length=1, max_length=32)] | None = None

    @model_validator(mode="after")
    def nonempty_update(self):
        if not self.model_fields_set - {"userId", "expectedName"}:
            raise ValueError("Empty update")
        return self


class AdminUserSystemPermissionsArgs(StrictModel):
    userId: Id
    expectedName: Name
    permissions: dict[str, Literal["none", "view", "edit"]]

    @model_validator(mode="after")
    def exact_permissions(self):
        if set(self.permissions) != SYSTEM_PERMISSION_KEYS:
            raise ValueError("Complete system permission map required")
        return self


PROJECT_PERMISSION_KEYS = frozenset({"Tasks", "WIP", "Reports", "General Documents", "Drawings", "Planning",
                                     "Contracts", "Quality", "Safety", "Billing", "Material Management", "Approvals"})
SYSTEM_PERMISSION_KEYS = frozenset({"projects", "vendors", "clients", "resources", "units", "collaboration", "admin"})


class ProjectMemberPermissionsArgs(StrictModel):
    projectId: Id
    userId: Id
    expectedName: Name
    permissions: dict[str, Literal["none", "view", "edit"]]

    @model_validator(mode="after")
    def exact_permissions(self):
        if set(self.permissions) != PROJECT_PERMISSION_KEYS:
            raise ValueError("Complete project permission map required")
        return self


class PermissionTemplateCreateArgs(StrictModel):
    name: Name
    type: Literal["system", "project"]
    permissions: dict[str, Literal[0, 1, 2]]

    @model_validator(mode="after")
    def exact_permissions(self):
        if set(self.permissions) != (SYSTEM_PERMISSION_KEYS if self.type == "system" else PROJECT_PERMISSION_KEYS):
            raise ValueError("Complete permission template map required")
        return self


class PermissionTemplateUpdateArgs(StrictModel):
    templateId: Id
    type: Literal["system", "project"]
    expectedName: Name
    name: Name | None = None
    permissions: dict[str, Literal[0, 1, 2]] | None = None

    @model_validator(mode="after")
    def valid_update(self):
        if not self.model_fields_set - {"templateId", "type", "expectedName"}:
            raise ValueError("Empty update")
        if self.permissions is not None and set(self.permissions) != (SYSTEM_PERMISSION_KEYS if self.type == "system" else PROJECT_PERMISSION_KEYS):
            raise ValueError("Complete permission template map required")
        return self

class ContactArgs(StrictModel):
    contactId: Id


class TransactionsSearchArgs(ListArgs):
    projectId: Id | None = None


class TasksSearchArgs(ListArgs):
    projectId: Id | None = None


class BillingSearchArgs(ListArgs):
    projectId: Id | None = None
    type: Literal["material", "contractor", "certified", "monthly"] | None = None


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


class ContactEditArgs(StrictModel):
    contactId: Id
    name: Name | None = None
    contact_person: Name | None = None
    mobile: Annotated[str, Field(min_length=1, max_length=32)] | None = None
    email: Annotated[str, Field(min_length=1, max_length=254, pattern=r"^[^\s@]+@[^\s@]+\.[^\s@]+$")] | None = None
    address: Annotated[str, Field(min_length=1, max_length=500)] | None = None
    location: Name | None = None
    remarks: Annotated[str, Field(min_length=1, max_length=500)] | None = None

    @model_validator(mode="after")
    def nonempty_update(self):
        if not self.model_fields_set - {"contactId"}:
            raise ValueError("Empty update")
        return self


class ClientCreateArgs(SupplierArgs):
    location: Name | None = None
    remarks: Annotated[str, Field(min_length=1, max_length=500)] | None = None


class ClientInteractionArgs(StrictModel):
    contactId: Id
    type: Literal["email", "whatsapp", "call", "site visit", "meeting"]
    interaction_date: Annotated[str, Field(pattern=r"^\d{4}-\d{2}-\d{2}$")]
    follow_up_date: Annotated[str, Field(pattern=r"^\d{4}-\d{2}-\d{2}$")] | None = None
    remarks: Annotated[str, Field(min_length=1, max_length=500)] | None = None

    @model_validator(mode="after")
    def valid_dates(self):
        start = date.fromisoformat(self.interaction_date)
        if self.follow_up_date is not None and date.fromisoformat(self.follow_up_date) < start:
            raise ValueError("Invalid follow-up date")
        return self


class ResourceCreateArgs(StrictModel):
    name: Name
    type: Literal["material", "labour", "item"]
    base_unit_code: Annotated[str, Field(min_length=1, max_length=30)]
    code: Name | None = None
    description: Annotated[str, Field(min_length=1, max_length=500)] | None = None
    remarks: Annotated[str, Field(min_length=1, max_length=500)] | None = None


class ResourceEditArgs(StrictModel):
    resourceId: Id
    projectId: Id | None = None
    name: Name | None = None
    code: Name | None = None
    description: Annotated[str, Field(min_length=1, max_length=500)] | None = None
    remarks: Annotated[str, Field(min_length=1, max_length=500)] | None = None

    @model_validator(mode="after")
    def nonempty_update(self):
        if not self.model_fields_set & {"name", "code", "description", "remarks"}:
            raise ValueError("Empty update")
        return self


class ConversionAddArgs(StrictModel):
    resourceId: Id
    projectId: Id | None = None
    name: Name
    quantity: Annotated[str, Field(pattern=r"^(0|[1-9]\d{0,8})(\.\d{1,6})?$")]
    unit_code: Annotated[str, Field(min_length=1, max_length=30)]

    @field_validator("quantity")
    @classmethod
    def positive_quantity(cls, value):
        if float(value) <= 0:
            raise ValueError("Quantity must be positive")
        return value


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


class BulkImportArgs(StrictModel):
    uploadId: Annotated[str, Field(pattern=r"^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$")]
    mapping: dict[str, str] | None = None


class AnalyticsArgs(StrictModel):
    entity: Literal[
        "vendors", "projects", "resources", "interactions", "materials", "suppliers", "vendor", "project",
        "transactions", "billing", "approvals", "overview"
    ]
    dimension: Literal[
        "category", "status", "sector", "type", "location", "month", "unit",
        "site", "worker_type", "date_range"
    ] | None = None
    metric: Annotated[str, Field(min_length=1, max_length=40)] | None = None
    visualization: Literal["bar", "donut", "metric", "table", "line"] | None = None
    limit: Limit | None = None


class ApprovalsListArgs(StrictModel):
    projectId: Id | None = None
    limit: Limit | None = None
    offset: Offset | None = None


class ApprovalDecideArgs(StrictModel):
    itemType: Literal["qaqc_observation", "document_cycle", "milestone_task", "all"]
    itemId: Id
    action: Literal["approve", "reject"]
    comments: Annotated[str, Field(min_length=1, max_length=500)] | None = None


class ApprovalBatchDecideArgs(StrictModel):
    itemType: Literal["qaqc_observation", "document_cycle", "milestone_task", "all"] | None = None
    action: Literal["approve", "reject"]
    comments: Annotated[str, Field(min_length=1, max_length=500)] | None = None


class ReportExportArgs(StrictModel):
    entity: Literal["vendors", "projects", "clients", "resources", "materials", "approvals", "transactions", "billing"]
    query: Annotated[str, Field(min_length=1, max_length=120)] | None = None
    limit: Annotated[int, Field(ge=1, le=500)] | None = None


class CostSimulationArgs(StrictModel):
    resourceId: Id | None = None
    resourceName: Annotated[str, Field(min_length=1, max_length=120)] | None = None
    rateDelta: Annotated[str, Field(pattern=r"^[+-]?(0|[1-9]\d{0,8})(\.\d{1,2})?$")] | None = None
    percentageDelta: Annotated[int, Field(ge=-100, le=500)] | None = None
    newRate: Annotated[str, Field(pattern=r"^(0|[1-9]\d{0,8})(\.\d{1,2})?$")] | None = None
    projectId: Id | None = None


class DprArgs(StrictModel):
    projectId: Id | None = None
    date: Annotated[str, Field(pattern=r"^\d{4}-\d{2}-\d{2}$")] | None = None
    dprId: Id | None = None
    limit: Limit | None = None

    @field_validator("date")
    @classmethod
    def valid_date(cls, value):
        if value is not None:
            date.fromisoformat(value)
        return value


class WprArgs(StrictModel):
    projectId: Id | None = None
    date: Annotated[str, Field(pattern=r"^\d{4}-\d{2}-\d{2}$")] | None = None
    startDate: Annotated[str, Field(pattern=r"^\d{4}-\d{2}-\d{2}$")] | None = None
    endDate: Annotated[str, Field(pattern=r"^\d{4}-\d{2}-\d{2}$")] | None = None
    weekNumber: Id | None = None

    @field_validator("date", "startDate", "endDate")
    @classmethod
    def valid_date(cls, value):
        if value is not None:
            date.fromisoformat(value)
        return value


class MprArgs(StrictModel):
    projectId: Id | None = None
    date: Annotated[str, Field(pattern=r"^\d{4}-\d{2}-\d{2}$")] | None = None
    month: Id | None = None
    year: Id | None = None

    @field_validator("date")
    @classmethod
    def valid_date(cls, value):
        if value is not None:
            date.fromisoformat(value)
        return value


ARG_MODELS = {
    "resources.create": ResourceCreateArgs, "resources.update": ResourceEditArgs, "resources.addConversion": ConversionAddArgs,
    "clients.create": ClientCreateArgs, "clients.update": ContactEditArgs,
    "vendors.update": ContactEditArgs, "clients.addInteraction": ClientInteractionArgs,
    "projects.search": ListArgs, "projects.get": ProjectArgs, "projects.getExecutiveBriefing": ProjectArgs,
    "projects.create": ProjectCreateArgs, "projects.update": ProjectUpdateArgs, "clients.search": ListArgs, "clients.get": ContactArgs,
    "tasks.create": TaskCreateArgs, "tasks.update": TaskUpdateArgs, "tasks.deleteSelected": TaskDeleteSelectedArgs,
    "projectParties.add": ProjectPartyAddArgs, "projectParties.update": ProjectPartyUpdateArgs,
    "projects.assignMember": ProjectMemberAssignArgs, "tasks.assign": TaskAssignArgs,
    "projects.setMemberPermissions": ProjectMemberPermissionsArgs,
    "tasks.createCategory": TaskCategoryCreateArgs, "tasks.updateCategory": TaskCategoryUpdateArgs, "tasks.reorder": TaskReorderArgs,
    "meetings.create": MeetingCreateArgs, "meetings.update": MeetingUpdateArgs,
    "directory.create": DirectoryCreateArgs, "directory.update": DirectoryUpdateArgs,
    "summaries.create": SummaryCreateArgs, "summaries.update": SummaryUpdateArgs,
    "documents.saveDraft": DocumentDraftArgs, "documents.submitDraft": DocumentSubmitArgs,
    "documents.requestRevision": DocumentCycleCommentsArgs, "documents.cancelCycle": DocumentCycleCommentsArgs,
    "documents.claimRevision": DocumentCycleArgs,
    "documents.archiveInstance": DocumentArchiveArgs,
    "documentCycles.search": ProjectDocumentSearchArgs,
    "documentInstances.search": ProjectDocumentSearchArgs,
    "documentTemplates.create": DocumentTemplateCreateArgs, "documentTemplates.update": DocumentTemplateUpdateArgs,
    "adminDepartments.create": AdminNameArgs, "adminDesignations.create": AdminNameArgs,
    "adminSectors.create": AdminNameArgs, "adminJobNatures.create": AdminNameArgs,
    "permissionTemplates.create": PermissionTemplateCreateArgs,
    "permissionTemplates.update": PermissionTemplateUpdateArgs,
    "adminUsers.updateProfile": AdminUserProfileUpdateArgs,
    "adminUsers.setSystemPermissions": AdminUserSystemPermissionsArgs,
    "adminUsers.search": ListArgs, "permissionTemplates.search": ListArgs,
    "documentTemplates.search": DocumentTemplateSearchArgs,
    "qualityObservations.create": QualityObservationCreateArgs, "qualityObservations.update": QualityObservationUpdateArgs,
    "qualityObservations.submitFix": QualityObservationFixArgs,
    "qualityMethodologies.create": QualityDocumentCreateArgs, "qualityMethodologies.update": QualityDocumentUpdateArgs,
    "qualityChecklists.create": QualityDocumentCreateArgs, "qualityChecklists.update": QualityDocumentUpdateArgs,
    "vendors.search": ListArgs, "vendors.get": ContactArgs, "resources.search": ResourceSearchArgs,
    "resources.get": ResourceArgs, "resources.getRate": ResourceArgs, "resources.getRateHistory": RateHistoryArgs,
    "resources.getComposition": ResourceArgs, "resources.simulateCostImpact": CostSimulationArgs,
    "projectParties.list": PartiesArgs, "interactions.search": InteractionsArgs,
    "transactions.search": TransactionsSearchArgs,
    "tasks.search": TasksSearchArgs,
    "billing.search": BillingSearchArgs,
    "analytics.query": AnalyticsArgs,
    "reports.exportExcel": ReportExportArgs,
    "reports.getDPR": DprArgs,
    "reports.getWPR": WprArgs,
    "reports.getMPR": MprArgs,
    "approvals.listPending": ApprovalsListArgs, "approvals.decide": ApprovalDecideArgs, "approvals.batchDecide": ApprovalBatchDecideArgs,
    "vendors.create": SupplierArgs, "vendors.bulkImport": BulkImportArgs, "clients.bulkImport": BulkImportArgs, "resources.createRateVersion": RateArgs,
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
    selectedEntityName: Annotated[str, Field(min_length=1, max_length=200)] | None = None
    activeTab: Short | None = None
    viewSummary: Annotated[str, Field(min_length=1, max_length=500)] | None = None
    recentRoutes: Annotated[list[Annotated[str, Field(min_length=1, max_length=512)]], Field(max_length=5)] | None = None
    attachment: dict[str, Any] | None = None


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
    allowedTools: Annotated[list[ToolName], Field(max_length=50)]


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
