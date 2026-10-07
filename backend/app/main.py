from fastapi import APIRouter, FastAPI

# Vercel entrypoint: `app` in app/main.py. Everything is served under /api
# (the root vercel.json rewrites /api/(.*) to this service).
api = APIRouter(prefix="/api")


@api.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


app = FastAPI(title="Ariadna API")
app.include_router(api)
