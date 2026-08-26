import asyncio
import os
import uuid
from datetime import datetime, timezone, timedelta

import pytest
import requests
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).parent.parent / '.env')

TEST_USER_ID = "user_test123456"
TEST_TOKEN = "test_session_token_abc123xyz"
SECOND_USER_ID = "user_other654321"
SECOND_TOKEN = "test_session_token_other999"

MONGO_URL = os.environ['MONGO_URL']
DB_NAME = os.environ['DB_NAME']

# Public URL used by clients
BASE_URL = os.environ.get('EXTERNAL_BACKEND_URL', 'https://task-flow-life.preview.emergentagent.com').rstrip('/')


async def _seed():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]

    # Cleanup previous data for both users
    for uid in (TEST_USER_ID, SECOND_USER_ID):
        await db.users.delete_many({"user_id": uid})
        await db.user_sessions.delete_many({"user_id": uid})
        await db.tasks.delete_many({"user_id": uid})
        await db.monthly_goals.delete_many({"user_id": uid})
        await db.yearly_goals.delete_many({"user_id": uid})
        await db.habits.delete_many({"user_id": uid})
        await db.habit_logs.delete_many({"user_id": uid})
        await db.books.delete_many({"user_id": uid})
        await db.time_entries.delete_many({"user_id": uid})
        await db.categories.delete_many({"user_id": uid})
        await db.classifications.delete_many({"user_id": uid})

    # Primary user
    await db.users.insert_one({
        "user_id": TEST_USER_ID,
        "email": "test@taskflow.com",
        "name": "Test User",
        "picture": None,
        "created_at": datetime.now(timezone.utc)
    })
    await db.user_sessions.insert_one({
        "session_token": TEST_TOKEN,
        "user_id": TEST_USER_ID,
        "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
        "created_at": datetime.now(timezone.utc)
    })
    for cat in ["Family", "Self", "Office", "Exercise", "Leisure"]:
        await db.categories.insert_one({
            "category_id": f"cat_{uuid.uuid4().hex[:12]}",
            "user_id": TEST_USER_ID,
            "name": cat,
            "created_at": datetime.now(timezone.utc)
        })
    for cls in ["Productive", "Non-Productive", "Neutral"]:
        await db.classifications.insert_one({
            "classification_id": f"cls_{uuid.uuid4().hex[:12]}",
            "user_id": TEST_USER_ID,
            "name": cls,
            "created_at": datetime.now(timezone.utc)
        })

    # Secondary user for isolation tests
    await db.users.insert_one({
        "user_id": SECOND_USER_ID,
        "email": "other@taskflow.com",
        "name": "Other User",
        "picture": None,
        "created_at": datetime.now(timezone.utc)
    })
    await db.user_sessions.insert_one({
        "session_token": SECOND_TOKEN,
        "user_id": SECOND_USER_ID,
        "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
        "created_at": datetime.now(timezone.utc)
    })

    client.close()


async def _cleanup():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    for uid in (TEST_USER_ID, SECOND_USER_ID):
        await db.users.delete_many({"user_id": uid})
        await db.user_sessions.delete_many({"user_id": uid})
        await db.tasks.delete_many({"user_id": uid})
        await db.monthly_goals.delete_many({"user_id": uid})
        await db.yearly_goals.delete_many({"user_id": uid})
        await db.habits.delete_many({"user_id": uid})
        await db.habit_logs.delete_many({"user_id": uid})
        await db.books.delete_many({"user_id": uid})
        await db.time_entries.delete_many({"user_id": uid})
        await db.categories.delete_many({"user_id": uid})
        await db.classifications.delete_many({"user_id": uid})
    client.close()


@pytest.fixture(scope="session", autouse=True)
def seed_db():
    asyncio.run(_seed())
    yield
    asyncio.run(_cleanup())


@pytest.fixture(scope="session")
def base_url():
    return BASE_URL


@pytest.fixture(scope="session")
def auth_headers():
    return {"Authorization": f"Bearer {TEST_TOKEN}", "Content-Type": "application/json"}


@pytest.fixture(scope="session")
def second_auth_headers():
    return {"Authorization": f"Bearer {SECOND_TOKEN}", "Content-Type": "application/json"}


@pytest.fixture(scope="session")
def api_client():
    s = requests.Session()
    return s
