from fastapi import APIRouter

from app.api.routes import admin, gap, health, interview, profile, roadmap, voice

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(profile.router)
api_router.include_router(gap.router)
api_router.include_router(roadmap.router)
api_router.include_router(interview.router)
api_router.include_router(voice.router)
api_router.include_router(admin.router)
