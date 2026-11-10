import uuid

from fastapi import APIRouter, Query, status

from app.deps import ClientIp, CurrentUser, DbSession
from app.schemas.workflow import (
    HistoryEntry,
    NotificationList,
    NotificationOut,
    TransitionRequest,
    TransitionResponse,
)
from app.services import workflow

router = APIRouter(tags=["admin: workflow"])


@router.post("/workflow/{object_type}/{object_id}/transitions", response_model=TransitionResponse)
def run_transition(
    object_type: str, object_id: uuid.UUID, body: TransitionRequest, user: CurrentUser, session: DbSession, ip: ClientIp
) -> TransitionResponse:
    obj = workflow.transition(session, user, object_type, object_id, body.action, body.version, body.comment, ip=ip)
    return TransitionResponse(
        object_type=object_type,
        object_id=obj.id,
        workflow_status=obj.workflow_status.value,
        version=obj.version,
        available_actions=workflow.available_actions(user, obj),
    )


@router.get("/workflow/{object_type}/{object_id}/history", response_model=list[HistoryEntry])
def version_history(
    object_type: str, object_id: uuid.UUID, user: CurrentUser, session: DbSession, ip: ClientIp
) -> list[HistoryEntry]:
    return [HistoryEntry(**entry) for entry in workflow.history(session, user, object_type, object_id, ip=ip)]


@router.get("/notifications", response_model=NotificationList)
def list_notifications(
    user: CurrentUser,
    session: DbSession,
    unread_only: bool = False,
    limit: int = Query(default=50, ge=1, le=200),
) -> NotificationList:
    items, unread = workflow.notifications(session, user, unread_only=unread_only, limit=limit)
    return NotificationList(items=[NotificationOut.model_validate(n, from_attributes=True) for n in items], unread=unread)


@router.post("/notifications/{notification_id}/read", status_code=status.HTTP_204_NO_CONTENT)
def read_notification(notification_id: int, user: CurrentUser, session: DbSession) -> None:
    workflow.mark_notifications_read(session, user, notification_id)


@router.post("/notifications/read-all", status_code=status.HTTP_204_NO_CONTENT)
def read_all_notifications(user: CurrentUser, session: DbSession) -> None:
    workflow.mark_notifications_read(session, user, None)
