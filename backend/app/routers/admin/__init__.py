from fastapi import APIRouter

from app.routers.admin import audit, auth, branches, catalog, dashboard, exhibitions, roles, uploads, users, workflow
from app.routers.admin import content, import_export, memory, settings, translations
from app.routers.admin import ai_tools, analytics

router = APIRouter(prefix="/admin")
router.include_router(auth.router)
router.include_router(roles.router)
router.include_router(workflow.router)
router.include_router(audit.router)
router.include_router(users.router)
router.include_router(dashboard.router)
router.include_router(catalog.router)
router.include_router(branches.router)
router.include_router(exhibitions.router)
router.include_router(uploads.router)
router.include_router(import_export.router)
router.include_router(translations.router)
router.include_router(content.router)
router.include_router(memory.router)
router.include_router(settings.router)
router.include_router(ai_tools.router)
router.include_router(analytics.router)
