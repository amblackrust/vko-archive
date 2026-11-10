from fastapi import APIRouter

from app.routers.admin import audit, auth, dashboard, roles, users, workflow

router = APIRouter(prefix="/admin")
router.include_router(auth.router)
router.include_router(roles.router)
router.include_router(workflow.router)
router.include_router(audit.router)
router.include_router(users.router)
router.include_router(dashboard.router)
