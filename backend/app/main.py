from fastapi import APIRouter, FastAPI

from app.modules.auth.api.routes import router as auth_router

# Vercel entrypoint: `app` in app/main.py. Everything is served under /api
# (the root vercel.json rewrites /api/(.*) to this service).
api = APIRouter(prefix="/api")
api.include_router(auth_router)


@api.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


app = FastAPI(title="Ariadna API")
app.include_router(api)
