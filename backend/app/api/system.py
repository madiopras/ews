"""Application-level system endpoints."""

from fastapi import APIRouter, Request

router = APIRouter(prefix="/api")


@router.get("/")
async def root():
    return {"message": "Explore Wisata Sumut API"}


async def health(request: Request):
    database = request.app.state.database
    try:
        await database.command("ping")
        connection = "connected"
    except Exception:
        connection = "disconnected"
    settings = request.app.state.settings
    return {
        "status": "ok",
        "database": connection,
        "llm": "configured" if settings.use_llm else "disabled",
    }
