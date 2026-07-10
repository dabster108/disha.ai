from fastapi import APIRouter

from app.api.routes import admin, dashboard, gap, health, interview, jobs, leaderboard, learning, practice, profile, roadmap, skills, voice

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(profile.router)
api_router.include_router(dashboard.router)
api_router.include_router(leaderboard.router)
api_router.include_router(gap.router)
api_router.include_router(jobs.router)
api_router.include_router(roadmap.router)
api_router.include_router(learning.router)
api_router.include_router(interview.router)
api_router.include_router(practice.router)
api_router.include_router(skills.router)
api_router.include_router(voice.router)
api_router.include_router(admin.router)
