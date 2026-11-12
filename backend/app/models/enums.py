"""Enumerations stored as VARCHAR + CHECK constraint (not native PG enums),
so adding a value later is a simple constraint change in a new migration."""

from enum import StrEnum


class WorkflowStatus(StrEnum):
    DRAFT = "draft"
    REVIEW = "review"
    NEEDS_CHANGES = "needs_changes"
    APPROVED = "approved"
    PUBLISHED = "published"
    ARCHIVED = "archived"


class TranslationStatus(StrEnum):
    VERIFIED = "verified"
    MACHINE = "machine"
    MISSING = "missing"


class BranchType(StrEnum):
    HEAD = "head"  # головной архив
    DISTRICT = "district"  # районный
    CITY = "city"  # городской
    PERSONNEL = "personnel"  # по личному составу


class FundType(StrEnum):
    ORGANIZATION = "organization"
    PERSONAL = "personal"
    PARTY = "party"
    NEWSPAPER = "newspaper"


class DescriptionStatus(StrEnum):
    PUBLIC = "public"
    DO_NOT_PUBLISH = "do_not_publish"
    NEEDS_REVIEW = "needs_review"


class FileAccess(StrEnum):
    OPEN = "open"
    RESTRICTED = "restricted"
    CLOSED = "closed"
    NEEDS_REVIEW = "needs_review"


class OcrStatus(StrEnum):
    NONE = "none"
    PENDING = "pending"
    DONE = "done"
    FAILED = "failed"
    UNAVAILABLE = "unavailable"


class LegalActStatus(StrEnum):
    ACTIVE = "active"  # действует
    AMENDED = "amended"  # изменён
    EXPIRED = "expired"  # утратил силу


class AuditResult(StrEnum):
    SUCCESS = "success"
    FAILURE = "failure"
    DENIED = "denied"


class RoleCode(StrEnum):
    """The 7 system roles from the project plan §5."""

    SUPER_ADMIN = "super_admin"
    SITE_ADMIN = "site_admin"
    EDITOR = "editor"
    ARCHIVIST = "archivist"
    BRANCH_ADMIN = "branch_admin"
    MODERATOR = "moderator"
    ANALYST = "analyst"
