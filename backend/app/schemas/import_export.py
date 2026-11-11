import uuid
from typing import Literal

from pydantic import BaseModel

RowAction = Literal["create", "update", "unchanged", "skip", "error"]


class RowError(BaseModel):
    field: str | None
    code: str


class ImportRow(BaseModel):
    line: int
    archive_code: str
    action: RowAction
    errors: list[RowError]
    values: dict[str, str]  # mapped cells as read from the file
    object_id: uuid.UUID | None
    creates: list[str]  # hierarchy levels this row creates: fund, inventory, case


class ImportReportOut(BaseModel):
    headers: list[str]
    # column index (as string, JSON keys) -> field
    mapping: dict[str, str]
    suggested_mapping: dict[str, str]
    fields: list[str]
    applied: bool
    counts: dict[str, int]
    # funds / inventories / cases that the valid rows create (applied: were created)
    hierarchy: dict[str, int]
    rows: list[ImportRow]


class ImportFieldsOut(BaseModel):
    fields: list[str]
    required: list[str]
    max_file_bytes: int
    max_rows: int
