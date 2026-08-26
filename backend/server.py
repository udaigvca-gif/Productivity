from fastapi import FastAPI, APIRouter, Header, HTTPException, Response
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import httpx
from openpyxl import Workbook
from openpyxl.styles import Font, Alignment, PatternFill
import io


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


# ============= MODELS =============

class User(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class SessionData(BaseModel):
    session_token: str
    user_id: str
    expires_at: datetime
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Task(BaseModel):
    task_id: str = Field(default_factory=lambda: f"task_{uuid.uuid4().hex[:12]}")
    user_id: str
    title: str
    completed: bool = False
    date: str  # YYYY-MM-DD format
    reminder_time: Optional[str] = None  # HH:MM format
    repeat_pattern: Optional[str] = None  # "daily", "weekly", "monthly", "custom_day"
    repeat_day: Optional[int] = None  # Day of week (0-6) for custom_day pattern
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class MonthlyGoal(BaseModel):
    goal_id: str = Field(default_factory=lambda: f"goal_{uuid.uuid4().hex[:12]}")
    user_id: str
    title: str
    month: str  # YYYY-MM format
    completed: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class YearlyGoal(BaseModel):
    goal_id: str = Field(default_factory=lambda: f"goal_{uuid.uuid4().hex[:12]}")
    user_id: str
    title: str
    year: str  # YYYY format
    completed: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Habit(BaseModel):
    habit_id: str = Field(default_factory=lambda: f"habit_{uuid.uuid4().hex[:12]}")
    user_id: str
    title: str
    habit_type: str = "general"  # "general", "books", etc.
    duration_hours: int = 0
    duration_minutes: int = 0
    add_to_daily: bool = False  # Auto-add to daily tasks
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class HabitLog(BaseModel):
    log_id: str = Field(default_factory=lambda: f"log_{uuid.uuid4().hex[:12]}")
    habit_id: str
    user_id: str
    date: str  # YYYY-MM-DD format
    completed: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Book(BaseModel):
    book_id: str = Field(default_factory=lambda: f"book_{uuid.uuid4().hex[:12]}")
    user_id: str
    title: str
    author: Optional[str] = None
    completed: bool = False
    date_completed: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class TimeEntry(BaseModel):
    entry_id: str = Field(default_factory=lambda: f"entry_{uuid.uuid4().hex[:12]}")
    user_id: str
    date: str  # YYYY-MM-DD format
    start_time: str  # HH:MM format
    end_time: str  # HH:MM format
    activity: str
    category: str
    classification: str  # "productive", "non-productive", "neutral"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Category(BaseModel):
    category_id: str = Field(default_factory=lambda: f"cat_{uuid.uuid4().hex[:12]}")
    user_id: str
    name: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Classification(BaseModel):
    classification_id: str = Field(default_factory=lambda: f"cls_{uuid.uuid4().hex[:12]}")
    user_id: str
    name: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# ============= AUTH HELPERS =============

async def get_current_user(authorization: Optional[str] = Header(None)) -> str:
    """Extract user_id from Bearer token"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")
    
    token = authorization.replace("Bearer ", "")
    
    # Look up session
    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session token")
    
    # Normalize expires_at to timezone-aware
    expires_at = session["expires_at"]
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    
    # Check if session expired
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")
    
    return session["user_id"]


# ============= HEALTH CHECK =============

@api_router.get("/")
async def health_check():
    """Simple liveness check — hit this to confirm the deploy is up and can reach Mongo."""
    try:
        await db.command("ping")
        db_status = "connected"
    except Exception as e:
        db_status = f"error: {e}"
    return {"status": "ok", "database": db_status}


# ============= AUTH ROUTES =============

@api_router.post("/auth/session")
async def create_session(session_token: str = Header(..., alias="X-Session-Token")):
    """Exchange session_token for user data and store session"""
    
    # Get session data from Emergent Auth API
    async with httpx.AsyncClient() as client:
        response = await client.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": session_token}
        )
        
        if response.status_code != 200:
            raise HTTPException(status_code=400, detail="Invalid session token")
        
        session_data = response.json()
    
    # Extract user info
    email = session_data["email"]
    name = session_data["name"]
    picture = session_data.get("picture")
    auth_session_token = session_data["session_token"]
    
    # Check if user exists
    existing_user = await db.users.find_one({"email": email}, {"_id": 0})
    
    if existing_user:
        user_id = existing_user["user_id"]
    else:
        # Create new user
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        user = User(
            user_id=user_id,
            email=email,
            name=name,
            picture=picture
        )
        await db.users.insert_one(user.dict())
        
        # Create default categories and classifications for new user
        default_categories = ["Family", "Self", "Office", "Exercise", "Leisure"]
        for cat_name in default_categories:
            category = Category(user_id=user_id, name=cat_name)
            await db.categories.insert_one(category.dict())
        
        default_classifications = ["Productive", "Non-Productive", "Neutral"]
        for cls_name in default_classifications:
            classification = Classification(user_id=user_id, name=cls_name)
            await db.classifications.insert_one(classification.dict())
    
    # Store session
    session = SessionData(
        session_token=auth_session_token,
        user_id=user_id,
        expires_at=datetime.now(timezone.utc) + timedelta(days=7)
    )
    await db.user_sessions.insert_one(session.dict())
    
    return {
        "user_id": user_id,
        "email": email,
        "name": name,
        "picture": picture,
        "session_token": auth_session_token
    }

@api_router.get("/auth/me")
async def get_me(authorization: Optional[str] = Header(None)):
    """Get current user info"""
    user_id = await get_current_user(authorization)
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    return user

@api_router.post("/auth/logout")
async def logout(authorization: Optional[str] = Header(None)):
    """Logout user"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing authorization header")
    
    token = authorization.replace("Bearer ", "")
    await db.user_sessions.delete_one({"session_token": token})
    return {"message": "Logged out successfully"}


# ============= TASK ROUTES =============

@api_router.post("/tasks")
async def create_task(task: Task, authorization: Optional[str] = Header(None)):
    """Create a new task"""
    user_id = await get_current_user(authorization)
    task.user_id = user_id
    await db.tasks.insert_one(task.dict())
    return task

@api_router.get("/tasks")
async def get_tasks(date: Optional[str] = None, authorization: Optional[str] = Header(None)):
    """Get tasks for a specific date or all tasks. Auto-includes daily-linked habits as virtual tasks."""
    user_id = await get_current_user(authorization)
    query = {"user_id": user_id}
    if date:
        query["date"] = date
    tasks = await db.tasks.find(query, {"_id": 0}).to_list(1000)

    # If a specific date is requested, also include linked habits as virtual tasks
    if date:
        habits_linked = await db.habits.find(
            {"user_id": user_id, "add_to_daily": True}, {"_id": 0}
        ).to_list(100)
        # For each linked habit, check if it's been logged as completed on this date
        for habit in habits_linked:
            log = await db.habit_logs.find_one(
                {"habit_id": habit["habit_id"], "date": date}, {"_id": 0}
            )
            tasks.append({
                "task_id": f"habit_{habit['habit_id']}",  # Virtual ID for habit-based tasks
                "user_id": user_id,
                "title": f"🔥 {habit['title']}",
                "completed": (log["completed"] if log else False),
                "date": date,
                "is_habit": True,
                "habit_id": habit["habit_id"],
            })
    return tasks

@api_router.put("/tasks/{task_id}")
async def update_task(task_id: str, updates: Dict[str, Any], authorization: Optional[str] = Header(None)):
    """Update a task"""
    user_id = await get_current_user(authorization)
    result = await db.tasks.update_one(
        {"task_id": task_id, "user_id": user_id},
        {"$set": updates}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Task not found")
    return {"message": "Task updated successfully"}

@api_router.delete("/tasks/{task_id}")
async def delete_task(task_id: str, authorization: Optional[str] = Header(None)):
    """Delete a task"""
    user_id = await get_current_user(authorization)
    result = await db.tasks.delete_one({"task_id": task_id, "user_id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Task not found")
    return {"message": "Task deleted successfully"}


# ============= GOALS ROUTES =============

@api_router.post("/goals/monthly")
async def create_monthly_goal(goal: MonthlyGoal, authorization: Optional[str] = Header(None)):
    """Create a monthly goal"""
    user_id = await get_current_user(authorization)
    goal.user_id = user_id
    await db.monthly_goals.insert_one(goal.dict())
    return goal

@api_router.get("/goals/monthly")
async def get_monthly_goals(month: Optional[str] = None, authorization: Optional[str] = Header(None)):
    """Get monthly goals"""
    user_id = await get_current_user(authorization)
    query = {"user_id": user_id}
    if month:
        query["month"] = month
    goals = await db.monthly_goals.find(query, {"_id": 0}).to_list(1000)
    return goals

@api_router.put("/goals/monthly/{goal_id}")
async def update_monthly_goal(goal_id: str, updates: Dict[str, Any], authorization: Optional[str] = Header(None)):
    """Update a monthly goal"""
    user_id = await get_current_user(authorization)
    result = await db.monthly_goals.update_one(
        {"goal_id": goal_id, "user_id": user_id},
        {"$set": updates}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Goal not found")
    return {"message": "Goal updated successfully"}

@api_router.delete("/goals/monthly/{goal_id}")
async def delete_monthly_goal(goal_id: str, authorization: Optional[str] = Header(None)):
    """Delete a monthly goal"""
    user_id = await get_current_user(authorization)
    result = await db.monthly_goals.delete_one({"goal_id": goal_id, "user_id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Goal not found")
    return {"message": "Goal deleted successfully"}

@api_router.post("/goals/yearly")
async def create_yearly_goal(goal: YearlyGoal, authorization: Optional[str] = Header(None)):
    """Create a yearly goal"""
    user_id = await get_current_user(authorization)
    goal.user_id = user_id
    await db.yearly_goals.insert_one(goal.dict())
    return goal

@api_router.get("/goals/yearly")
async def get_yearly_goals(year: Optional[str] = None, authorization: Optional[str] = Header(None)):
    """Get yearly goals"""
    user_id = await get_current_user(authorization)
    query = {"user_id": user_id}
    if year:
        query["year"] = year
    goals = await db.yearly_goals.find(query, {"_id": 0}).to_list(1000)
    return goals

@api_router.put("/goals/yearly/{goal_id}")
async def update_yearly_goal(goal_id: str, updates: Dict[str, Any], authorization: Optional[str] = Header(None)):
    """Update a yearly goal"""
    user_id = await get_current_user(authorization)
    result = await db.yearly_goals.update_one(
        {"goal_id": goal_id, "user_id": user_id},
        {"$set": updates}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Goal not found")
    return {"message": "Goal updated successfully"}

@api_router.delete("/goals/yearly/{goal_id}")
async def delete_yearly_goal(goal_id: str, authorization: Optional[str] = Header(None)):
    """Delete a yearly goal"""
    user_id = await get_current_user(authorization)
    result = await db.yearly_goals.delete_one({"goal_id": goal_id, "user_id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Goal not found")
    return {"message": "Goal deleted successfully"}


# ============= HABITS ROUTES =============

@api_router.post("/habits")
async def create_habit(habit: Habit, authorization: Optional[str] = Header(None)):
    """Create a new habit"""
    user_id = await get_current_user(authorization)
    habit.user_id = user_id
    await db.habits.insert_one(habit.dict())
    return habit

@api_router.get("/habits")
async def get_habits(authorization: Optional[str] = Header(None)):
    """Get all habits"""
    user_id = await get_current_user(authorization)
    habits = await db.habits.find({"user_id": user_id}, {"_id": 0}).to_list(1000)
    return habits

@api_router.put("/habits/{habit_id}")
async def update_habit(habit_id: str, updates: Dict[str, Any], authorization: Optional[str] = Header(None)):
    """Update a habit"""
    user_id = await get_current_user(authorization)
    result = await db.habits.update_one(
        {"habit_id": habit_id, "user_id": user_id},
        {"$set": updates}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Habit not found")
    return {"message": "Habit updated successfully"}

@api_router.delete("/habits/{habit_id}")
async def delete_habit(habit_id: str, authorization: Optional[str] = Header(None)):
    """Delete a habit"""
    user_id = await get_current_user(authorization)
    result = await db.habits.delete_one({"habit_id": habit_id, "user_id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Habit not found")
    return {"message": "Habit deleted successfully"}

@api_router.post("/habits/{habit_id}/log")
async def log_habit(habit_id: str, date: str, completed: bool, authorization: Optional[str] = Header(None)):
    """Log a habit for a specific date"""
    user_id = await get_current_user(authorization)
    
    # Check if log already exists
    existing_log = await db.habit_logs.find_one({"habit_id": habit_id, "date": date})
    
    if existing_log:
        # Update existing log
        await db.habit_logs.update_one(
            {"habit_id": habit_id, "date": date},
            {"$set": {"completed": completed}}
        )
    else:
        # Create new log
        log = HabitLog(habit_id=habit_id, user_id=user_id, date=date, completed=completed)
        await db.habit_logs.insert_one(log.dict())
    
    return {"message": "Habit logged successfully"}

@api_router.get("/habits/{habit_id}/logs")
async def get_habit_logs(habit_id: str, month: Optional[str] = None, authorization: Optional[str] = Header(None)):
    """Get habit logs for a specific month"""
    user_id = await get_current_user(authorization)
    query = {"habit_id": habit_id, "user_id": user_id}
    
    if month:
        # Filter by month (YYYY-MM)
        query["date"] = {"$regex": f"^{month}"}
    
    logs = await db.habit_logs.find(query, {"_id": 0}).to_list(1000)
    return logs

@api_router.get("/habits/{habit_id}/analytics")
async def get_habit_analytics(habit_id: str, authorization: Optional[str] = Header(None)):
    """Get analytics for a specific habit"""
    user_id = await get_current_user(authorization)
    
    # Get all logs
    logs = await db.habit_logs.find({"habit_id": habit_id, "user_id": user_id}, {"_id": 0}).to_list(1000)
    
    # Calculate statistics
    total_days = len(logs)
    completed_days = len([log for log in logs if log["completed"]])
    
    # Calculate current streak
    sorted_logs = sorted(logs, key=lambda x: x["date"], reverse=True)
    current_streak = 0
    for log in sorted_logs:
        if log["completed"]:
            current_streak += 1
        else:
            break
    
    return {
        "total_days": total_days,
        "completed_days": completed_days,
        "completion_rate": (completed_days / total_days * 100) if total_days > 0 else 0,
        "current_streak": current_streak
    }


# ============= BOOKS ROUTES =============

@api_router.post("/books")
async def create_book(book: Book, authorization: Optional[str] = Header(None)):
    """Add a book"""
    user_id = await get_current_user(authorization)
    book.user_id = user_id
    await db.books.insert_one(book.dict())
    return book

@api_router.get("/books")
async def get_books(authorization: Optional[str] = Header(None)):
    """Get all books"""
    user_id = await get_current_user(authorization)
    books = await db.books.find({"user_id": user_id}, {"_id": 0}).to_list(1000)
    return books

@api_router.put("/books/{book_id}")
async def update_book(book_id: str, updates: Dict[str, Any], authorization: Optional[str] = Header(None)):
    """Update a book"""
    user_id = await get_current_user(authorization)
    result = await db.books.update_one(
        {"book_id": book_id, "user_id": user_id},
        {"$set": updates}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Book not found")
    return {"message": "Book updated successfully"}

@api_router.delete("/books/{book_id}")
async def delete_book(book_id: str, authorization: Optional[str] = Header(None)):
    """Delete a book"""
    user_id = await get_current_user(authorization)
    result = await db.books.delete_one({"book_id": book_id, "user_id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Book not found")
    return {"message": "Book deleted successfully"}


# ============= TIME ENTRY ROUTES =============

@api_router.post("/time-entries")
async def create_time_entry(entry: TimeEntry, authorization: Optional[str] = Header(None)):
    """Create a time entry"""
    user_id = await get_current_user(authorization)
    entry.user_id = user_id
    await db.time_entries.insert_one(entry.dict())
    return entry

@api_router.get("/time-entries")
async def get_time_entries(date: Optional[str] = None, authorization: Optional[str] = Header(None)):
    """Get time entries"""
    user_id = await get_current_user(authorization)
    query = {"user_id": user_id}
    if date:
        query["date"] = date
    entries = await db.time_entries.find(query, {"_id": 0}).to_list(1000)
    return entries

@api_router.put("/time-entries/{entry_id}")
async def update_time_entry(entry_id: str, updates: Dict[str, Any], authorization: Optional[str] = Header(None)):
    """Update a time entry"""
    user_id = await get_current_user(authorization)
    result = await db.time_entries.update_one(
        {"entry_id": entry_id, "user_id": user_id},
        {"$set": updates}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Entry not found")
    return {"message": "Entry updated successfully"}

@api_router.delete("/time-entries/{entry_id}")
async def delete_time_entry(entry_id: str, authorization: Optional[str] = Header(None)):
    """Delete a time entry"""
    user_id = await get_current_user(authorization)
    result = await db.time_entries.delete_one({"entry_id": entry_id, "user_id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Entry not found")
    return {"message": "Entry deleted successfully"}

@api_router.get("/time-entries/export")
async def export_time_entries(start_date: str, end_date: str, authorization: Optional[str] = Header(None)):
    """Export time entries to Excel"""
    user_id = await get_current_user(authorization)
    
    # Get entries in date range
    entries = await db.time_entries.find({
        "user_id": user_id,
        "date": {"$gte": start_date, "$lte": end_date}
    }, {"_id": 0}).to_list(10000)
    
    # Create Excel workbook
    wb = Workbook()
    ws = wb.active
    ws.title = "Time Entries"
    
    # Add headers
    headers = ["Date", "Start Time", "End Time", "Activity", "Category", "Classification"]
    ws.append(headers)
    
    # Style headers
    header_fill = PatternFill(start_color="4472C4", end_color="4472C4", fill_type="solid")
    header_font = Font(bold=True, color="FFFFFF")
    for cell in ws[1]:
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center")
    
    # Add data
    for entry in entries:
        ws.append([
            entry["date"],
            entry["start_time"],
            entry["end_time"],
            entry["activity"],
            entry["category"],
            entry["classification"]
        ])
    
    # Auto-adjust column widths
    for column in ws.columns:
        max_length = 0
        column_letter = column[0].column_letter
        for cell in column:
            try:
                if len(str(cell.value)) > max_length:
                    max_length = len(cell.value)
            except Exception:
                pass
        adjusted_width = (max_length + 2)
        ws.column_dimensions[column_letter].width = adjusted_width
    
    # Save to bytes
    excel_file = io.BytesIO()
    wb.save(excel_file)
    excel_file.seek(0)
    
    # Return as downloadable file
    return Response(
        content=excel_file.read(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename=time_entries_{start_date}_to_{end_date}.xlsx"}
    )


# ============= CATEGORIES & CLASSIFICATIONS ROUTES =============

@api_router.post("/categories")
async def create_category(name: str, authorization: Optional[str] = Header(None)):
    """Create a custom category"""
    user_id = await get_current_user(authorization)
    category = Category(user_id=user_id, name=name)
    await db.categories.insert_one(category.dict())
    return category

@api_router.get("/categories")
async def get_categories(authorization: Optional[str] = Header(None)):
    """Get all categories"""
    user_id = await get_current_user(authorization)
    categories = await db.categories.find({"user_id": user_id}, {"_id": 0}).to_list(1000)
    return categories

@api_router.delete("/categories/{category_id}")
async def delete_category(category_id: str, authorization: Optional[str] = Header(None)):
    """Delete a category"""
    user_id = await get_current_user(authorization)
    result = await db.categories.delete_one({"category_id": category_id, "user_id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Category not found")
    return {"message": "Category deleted successfully"}

@api_router.post("/classifications")
async def create_classification(name: str, authorization: Optional[str] = Header(None)):
    """Create a custom classification"""
    user_id = await get_current_user(authorization)
    classification = Classification(user_id=user_id, name=name)
    await db.classifications.insert_one(classification.dict())
    return classification

@api_router.get("/classifications")
async def get_classifications(authorization: Optional[str] = Header(None)):
    """Get all classifications"""
    user_id = await get_current_user(authorization)
    classifications = await db.classifications.find({"user_id": user_id}, {"_id": 0}).to_list(1000)
    return classifications

@api_router.delete("/classifications/{classification_id}")
async def delete_classification(classification_id: str, authorization: Optional[str] = Header(None)):
    """Delete a classification"""
    user_id = await get_current_user(authorization)
    result = await db.classifications.delete_one({"classification_id": classification_id, "user_id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Classification not found")
    return {"message": "Classification deleted successfully"}


# ============= PUSH NOTIFICATIONS =============

PUSH_BASE_URL = "https://integrations.emergentagent.com"
PUSH_KEY = os.environ.get("EMERGENT_PUSH_KEY", "placeholder")

_push_client = httpx.AsyncClient(
    base_url=PUSH_BASE_URL,
    headers={"X-Push-Key": PUSH_KEY},
    timeout=10.0,
)


class RegisterPushBody(BaseModel):
    platform: str  # "android" | "ios"
    device_token: str


@api_router.post("/register-push", status_code=201)
async def register_push(body: RegisterPushBody, authorization: Optional[str] = Header(None)):
    """Register device for push notifications via Emergent relay"""
    user_id = await get_current_user(authorization)
    payload = {"user_id": user_id, "platform": body.platform, "device_token": body.device_token}
    resp = await _push_client.post("/api/v1/push/users/register", json=payload)
    if resp.status_code == 401:
        raise HTTPException(500, "EMERGENT_PUSH_KEY missing or invalid")
    if resp.status_code >= 500:
        raise HTTPException(502, "Push provider unavailable")
    resp.raise_for_status()
    return {"status": "registered"}


async def send_push(recipients: List[str], data: Dict[str, Any], idempotency_key: Optional[str] = None) -> None:
    """Helper to send push notification via Emergent relay"""
    if not recipients:
        return
    if len(recipients) > 100:
        raise ValueError("max 100 recipients per /trigger call; chunk before sending")
    if "title" not in data or "message" not in data:
        raise ValueError("data must include title and message")
    payload: Dict[str, Any] = {"recipients": recipients, "data": data}
    if idempotency_key:
        payload["$idempotency_key"] = idempotency_key
    resp = await _push_client.post("/api/v1/push/trigger", json=payload)
    if resp.status_code == 401:
        raise HTTPException(500, "EMERGENT_PUSH_KEY missing or invalid")
    if resp.status_code >= 500:
        raise HTTPException(502, "Push provider unavailable")
    resp.raise_for_status()


class TaskReminderBody(BaseModel):
    task_id: str
    title: str


@api_router.post("/send-task-reminder")
async def send_task_reminder(body: TaskReminderBody, authorization: Optional[str] = Header(None)):
    """Send a task reminder push notification to the current user"""
    user_id = await get_current_user(authorization)
    try:
        await send_push(
            recipients=[user_id],
            data={
                "title": "Task Reminder",
                "message": f"Don't forget: {body.title}",
                "action_url": "/home",
            },
            idempotency_key=f"task_{body.task_id}_{datetime.now(timezone.utc).isoformat()}",
        )
    except Exception as e:
        logger.warning(f"Push notification failed (non-blocking): {e}")
    return {"status": "sent"}


# ============= SEARCH =============

@api_router.get("/search")
async def search(q: str, authorization: Optional[str] = Header(None)):
    """Global search across tasks, goals, habits, books, and time entries"""
    user_id = await get_current_user(authorization)
    q_lower = q.lower()
    # Case-insensitive regex search
    regex = {"$regex": q, "$options": "i"}

    tasks = await db.tasks.find(
        {"user_id": user_id, "title": regex}, {"_id": 0}
    ).to_list(50)
    monthly = await db.monthly_goals.find(
        {"user_id": user_id, "title": regex}, {"_id": 0}
    ).to_list(50)
    yearly = await db.yearly_goals.find(
        {"user_id": user_id, "title": regex}, {"_id": 0}
    ).to_list(50)
    habits = await db.habits.find(
        {"user_id": user_id, "title": regex}, {"_id": 0}
    ).to_list(50)
    books = await db.books.find(
        {"user_id": user_id, "$or": [{"title": regex}, {"author": regex}]},
        {"_id": 0},
    ).to_list(50)
    time_entries = await db.time_entries.find(
        {"user_id": user_id, "activity": regex}, {"_id": 0}
    ).to_list(50)

    return {
        "query": q,
        "tasks": tasks,
        "monthly_goals": monthly,
        "yearly_goals": yearly,
        "habits": habits,
        "books": books,
        "time_entries": time_entries,
        "total": len(tasks) + len(monthly) + len(yearly) + len(habits) + len(books) + len(time_entries),
    }


# ============= WEEK VIEW =============

@api_router.get("/tasks/week")
async def get_tasks_week(start_date: str, authorization: Optional[str] = Header(None)):
    """Get tasks for a full week starting from start_date (YYYY-MM-DD)"""
    user_id = await get_current_user(authorization)
    start = datetime.strptime(start_date, "%Y-%m-%d")
    end = start + timedelta(days=6)
    end_str = end.strftime("%Y-%m-%d")
    tasks = await db.tasks.find(
        {"user_id": user_id, "date": {"$gte": start_date, "$lte": end_str}},
        {"_id": 0},
    ).to_list(1000)
    return tasks


# ============= ANALYTICS =============

@api_router.get("/analytics/overview")
async def analytics_overview(authorization: Optional[str] = Header(None)):
    """Overview analytics: task completion, habit streaks, time breakdown"""
    user_id = await get_current_user(authorization)
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    month = datetime.now(timezone.utc).strftime("%Y-%m")

    # Tasks stats
    total_tasks = await db.tasks.count_documents({"user_id": user_id})
    completed_tasks = await db.tasks.count_documents({"user_id": user_id, "completed": True})
    today_tasks = await db.tasks.count_documents({"user_id": user_id, "date": today})
    today_completed = await db.tasks.count_documents(
        {"user_id": user_id, "date": today, "completed": True}
    )

    # Habit stats
    total_habits = await db.habits.count_documents({"user_id": user_id})
    habit_logs_this_month = await db.habit_logs.count_documents(
        {"user_id": user_id, "date": {"$regex": f"^{month}"}, "completed": True}
    )

    # Books stats
    total_books = await db.books.count_documents({"user_id": user_id})
    completed_books = await db.books.count_documents({"user_id": user_id, "completed": True})

    # Goals stats
    monthly_goals_total = await db.monthly_goals.count_documents({"user_id": user_id, "month": month})
    monthly_goals_completed = await db.monthly_goals.count_documents(
        {"user_id": user_id, "month": month, "completed": True}
    )

    return {
        "tasks": {
            "total": total_tasks,
            "completed": completed_tasks,
            "today_total": today_tasks,
            "today_completed": today_completed,
            "completion_rate": (completed_tasks / total_tasks * 100) if total_tasks else 0,
        },
        "habits": {
            "total": total_habits,
            "completions_this_month": habit_logs_this_month,
        },
        "books": {
            "total": total_books,
            "completed": completed_books,
        },
        "monthly_goals": {
            "total": monthly_goals_total,
            "completed": monthly_goals_completed,
        },
    }


@api_router.get("/analytics/time-breakdown")
async def analytics_time_breakdown(
    start_date: str, end_date: str, authorization: Optional[str] = Header(None)
):
    """Time breakdown by category and classification for a date range"""
    user_id = await get_current_user(authorization)
    entries = await db.time_entries.find(
        {"user_id": user_id, "date": {"$gte": start_date, "$lte": end_date}}, {"_id": 0}
    ).to_list(10000)

    def duration_minutes(start: str, end: str) -> int:
        sh, sm = [int(x) for x in start.split(":")]
        eh, em = [int(x) for x in end.split(":")]
        total = (eh * 60 + em) - (sh * 60 + sm)
        return total if total >= 0 else total + 24 * 60

    by_category: Dict[str, int] = {}
    by_classification: Dict[str, int] = {}
    for e in entries:
        mins = duration_minutes(e["start_time"], e["end_time"])
        by_category[e["category"]] = by_category.get(e["category"], 0) + mins
        by_classification[e["classification"]] = by_classification.get(e["classification"], 0) + mins

    return {
        "total_entries": len(entries),
        "by_category": [{"name": k, "minutes": v} for k, v in by_category.items()],
        "by_classification": [{"name": k, "minutes": v} for k, v in by_classification.items()],
    }


# ============= CUSTOM THEMES =============

class CustomTheme(BaseModel):
    theme_id: str = Field(default_factory=lambda: f"theme_{uuid.uuid4().hex[:12]}")
    user_id: str = ""
    name: str
    emoji: str = "🎨"
    primary: str  # hex
    secondary: str  # hex
    gradient_start: str
    gradient_end: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


@api_router.post("/custom-themes")
async def create_custom_theme(theme: CustomTheme, authorization: Optional[str] = Header(None)):
    """Create a custom color theme"""
    user_id = await get_current_user(authorization)
    theme.user_id = user_id
    await db.custom_themes.insert_one(theme.dict())
    return theme


@api_router.get("/custom-themes")
async def get_custom_themes(authorization: Optional[str] = Header(None)):
    """Get user's custom themes"""
    user_id = await get_current_user(authorization)
    themes = await db.custom_themes.find({"user_id": user_id}, {"_id": 0}).to_list(100)
    return themes


@api_router.delete("/custom-themes/{theme_id}")
async def delete_custom_theme(theme_id: str, authorization: Optional[str] = Header(None)):
    """Delete a custom theme"""
    user_id = await get_current_user(authorization)
    result = await db.custom_themes.delete_one({"theme_id": theme_id, "user_id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Theme not found")
    return {"message": "Theme deleted successfully"}


# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup_db_indexes():
    """Create MongoDB indexes"""
    # Users
    await db.users.create_index("email", unique=True)
    await db.users.create_index("user_id", unique=True)
    
    # Sessions
    await db.user_sessions.create_index("session_token", unique=True)
    await db.user_sessions.create_index("user_id")
    await db.user_sessions.create_index("expires_at", expireAfterSeconds=0)
    
    # Tasks
    await db.tasks.create_index("user_id")
    await db.tasks.create_index("task_id", unique=True)
    
    # Goals
    await db.monthly_goals.create_index("user_id")
    await db.yearly_goals.create_index("user_id")
    
    # Habits
    await db.habits.create_index("user_id")
    await db.habit_logs.create_index([("habit_id", 1), ("date", 1)], unique=True)
    
    # Books
    await db.books.create_index("user_id")
    
    # Time Entries
    await db.time_entries.create_index("user_id")
    await db.time_entries.create_index("date")
    
    logger.info("MongoDB indexes created successfully")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
