"""All SQLAlchemy models. Importing this package registers every table on Base.metadata
(used by Alembic autogenerate)."""

from app.models.annotations import DocumentAnnotation
from app.models.base import EMBEDDING_DIM, Base
from app.models.branches import Branch
from app.models.cabinet import (
    Visitor,
    VisitorFavorite,
    VisitorSearch,
    VisitorSelection,
    VisitorSelectionItem,
    VisitorSubscription,
)
from app.models.catalog import Case, Document, Fund, Inventory, document_categories, document_tags
from app.models.content import FAQ, Category, LegalAct, MemorialDate, News, Page, PriceListItem, SiteSetting, Tag
from app.models.enums import (
    AuditResult,
    BranchType,
    DescriptionStatus,
    FileAccess,
    FundType,
    LegalActStatus,
    OcrStatus,
    RoleCode,
    TranslationStatus,
    WorkflowStatus,
)
from app.models.exhibitions import Exhibit, Exhibition
from app.models.files import DigitalFile
from app.models.memory import Collection, CollectionItem, HistoricalEvent, Person, event_documents, person_documents
from app.models.search import SearchEntry, SearchLog, Synonym
from app.models.system import AuditLog, Notification, WorkflowHistory
from app.models.users import Permission, Role, RolePermission, User, UserRole

__all__ = [
    "Visitor",
    "VisitorFavorite",
    "VisitorSearch",
    "VisitorSelection",
    "VisitorSelectionItem",
    "VisitorSubscription",
    "EMBEDDING_DIM",
    "FAQ",
    "AuditLog",
    "AuditResult",
    "Base",
    "Branch",
    "BranchType",
    "Case",
    "Category",
    "Collection",
    "CollectionItem",
    "DescriptionStatus",
    "DigitalFile",
    "DocumentAnnotation",
    "Document",
    "Exhibit",
    "Exhibition",
    "FileAccess",
    "Fund",
    "FundType",
    "HistoricalEvent",
    "Inventory",
    "LegalAct",
    "LegalActStatus",
    "MemorialDate",
    "News",
    "Notification",
    "OcrStatus",
    "Page",
    "Permission",
    "Person",
    "PriceListItem",
    "Role",
    "RoleCode",
    "RolePermission",
    "SearchEntry",
    "SearchLog",
    "SiteSetting",
    "Synonym",
    "Tag",
    "TranslationStatus",
    "User",
    "UserRole",
    "WorkflowHistory",
    "WorkflowStatus",
    "document_categories",
    "document_tags",
    "event_documents",
    "person_documents",
]
