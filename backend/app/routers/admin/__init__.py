from fastapi import APIRouter

from app.routers.admin import audit, auth, roles, workflow

router = APIRouter(prefix="/admin")
router.include_router(auth.router)
router.include_router(roles.router)
router.include_router(workflow.router)
router.include_router(audit.router)
