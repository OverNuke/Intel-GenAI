from fastapi import APIRouter, FastAPI

from app.modules.assistant.api.routes import router as assistant_router
from app.modules.auth.api.errors import register_auth_error_handlers
from app.modules.auth.api.routes import router as auth_router
from app.modules.catalog.api.routes import router as catalog_router
from app.modules.metrics.api.routes import router as metrics_router
from app.modules.tickets.api.it_routes import router as it_router
from app.modules.tickets.api.routes import router as tickets_router

# Vercel entrypoint: `app` in app/main.py. Everything is served under /api
# (the root vercel.json rewrites /api/(.*) to this service).
api = APIRouter(prefix="/api")
api.include_router(auth_router)
api.include_router(tickets_router)
api.include_router(catalog_router)
api.include_router(assistant_router)
api.include_router(it_router)
api.include_router(metrics_router)


@api.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


app = FastAPI(title="Ariadna API")
register_auth_error_handlers(app)
app.include_router(api)
