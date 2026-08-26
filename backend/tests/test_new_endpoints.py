"""Tests for NEW TaskFlow Life endpoints added in iteration 2.

Covers: search, week view, analytics (overview + time-breakdown),
custom themes, push registration, task reminders, and
habit auto-link-to-daily virtual tasks. Also regressions on tasks/habits.
"""
import os
import time
import pytest
import requests

from conftest import TEST_USER_ID


# ------------------------- 1. SEARCH -------------------------

class TestSearch:
    """Global /api/search endpoint."""

    @pytest.fixture(autouse=True, scope="class")
    def seed_search(self, base_url, auth_headers):
        # Create one task, one habit, one book with "Test" in title
        requests.post(f"{base_url}/api/tasks", headers=auth_headers,
                      json={"user_id": "x", "title": "Test task ABC",
                            "date": "2026-02-16"})
        requests.post(f"{base_url}/api/habits", headers=auth_headers,
                      json={"user_id": "x", "title": "Test habit"})
        requests.post(f"{base_url}/api/books", headers=auth_headers,
                      json={"user_id": "x", "title": "Test book",
                            "author": "Someone"})
        yield

    def test_search_returns_categorised_results(self, base_url, auth_headers):
        r = requests.get(f"{base_url}/api/search?q=test", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        for k in ("query", "tasks", "monthly_goals", "yearly_goals",
                  "habits", "books", "time_entries", "total"):
            assert k in data, f"Missing key {k} in search response"
        assert data["query"] == "test"
        titles_tasks = [t["title"] for t in data["tasks"]]
        titles_habits = [h["title"] for h in data["habits"]]
        titles_books = [b["title"] for b in data["books"]]
        assert any("Test task ABC" in t for t in titles_tasks)
        assert any("Test habit" in t for t in titles_habits)
        assert any("Test book" in t for t in titles_books)
        assert data["total"] >= 3

    def test_search_no_results(self, base_url, auth_headers):
        r = requests.get(f"{base_url}/api/search?q=zzznonexistentqueryzzz",
                         headers=auth_headers)
        assert r.status_code == 200
        assert r.json()["total"] == 0

    def test_search_unauthorized(self, base_url):
        r = requests.get(f"{base_url}/api/search?q=test")
        assert r.status_code == 401


# ------------------------- 2. WEEK VIEW -------------------------

class TestWeekView:
    """GET /api/tasks/week?start_date=..."""

    @pytest.fixture(autouse=True, scope="class")
    def seed_week(self, base_url, auth_headers):
        # inside window (2026-02-16..2026-02-22)
        for d in ("2026-02-16", "2026-02-17", "2026-02-18", "2026-02-22"):
            requests.post(f"{base_url}/api/tasks", headers=auth_headers,
                          json={"user_id": "x", "title": f"Week task {d}",
                                "date": d})
        # outside window
        for d in ("2026-02-15", "2026-02-23", "2026-02-25"):
            requests.post(f"{base_url}/api/tasks", headers=auth_headers,
                          json={"user_id": "x", "title": f"Outside {d}",
                                "date": d})
        yield

    def test_week_view_returns_only_window(self, base_url, auth_headers):
        r = requests.get(f"{base_url}/api/tasks/week?start_date=2026-02-16",
                         headers=auth_headers)
        assert r.status_code == 200
        tasks = r.json()
        dates = {t["date"] for t in tasks}
        # every returned task's date is in the 7-day window
        for d in dates:
            assert "2026-02-16" <= d <= "2026-02-22", f"Out-of-window: {d}"
        # window entries present
        assert {"2026-02-16", "2026-02-17", "2026-02-18", "2026-02-22"}.issubset(dates)
        # out-of-window entries absent
        assert "2026-02-15" not in dates
        assert "2026-02-23" not in dates
        assert "2026-02-25" not in dates

    def test_week_view_unauthorized(self, base_url):
        r = requests.get(f"{base_url}/api/tasks/week?start_date=2026-02-16")
        assert r.status_code == 401


# ------------------------- 3. ANALYTICS OVERVIEW -------------------------

class TestAnalyticsOverview:

    @pytest.fixture(autouse=True, scope="class")
    def seed_overview(self, base_url, auth_headers):
        # Ensure at least one completed task, one habit log, one completed
        # book, one monthly goal
        today = time.strftime("%Y-%m-%d")
        month = time.strftime("%Y-%m")

        # completed task today
        r = requests.post(f"{base_url}/api/tasks", headers=auth_headers,
                          json={"user_id": "x", "title": "AN completed",
                                "date": today, "completed": True})
        task_id = r.json()["task_id"]
        # mark as completed via PUT (some POST may not persist completed=True as-is)
        requests.put(f"{base_url}/api/tasks/{task_id}",
                     headers=auth_headers, json={"completed": True})

        # not-completed task today
        requests.post(f"{base_url}/api/tasks", headers=auth_headers,
                      json={"user_id": "x", "title": "AN pending",
                            "date": today})

        # habit + log
        r = requests.post(f"{base_url}/api/habits", headers=auth_headers,
                         json={"user_id": "x", "title": "AN habit"})
        hid = r.json()["habit_id"]
        requests.post(
            f"{base_url}/api/habits/{hid}/log?date={today}&completed=true",
            headers=auth_headers)

        # completed book
        r = requests.post(f"{base_url}/api/books", headers=auth_headers,
                          json={"user_id": "x", "title": "AN book",
                                "completed": True})
        bid = r.json()["book_id"]
        requests.put(f"{base_url}/api/books/{bid}", headers=auth_headers,
                     json={"completed": True})

        # monthly goal
        requests.post(f"{base_url}/api/goals/monthly", headers=auth_headers,
                      json={"user_id": "x", "title": "AN goal",
                            "month": month})
        yield

    def test_overview_structure_and_counts(self, base_url, auth_headers):
        r = requests.get(f"{base_url}/api/analytics/overview",
                         headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        for section in ("tasks", "habits", "books", "monthly_goals"):
            assert section in data, f"Missing section {section}"
        for k in ("total", "completed", "today_total", "today_completed",
                  "completion_rate"):
            assert k in data["tasks"], f"tasks.{k} missing"
        for k in ("total", "completions_this_month"):
            assert k in data["habits"]
        for k in ("total", "completed"):
            assert k in data["books"]
        for k in ("total", "completed"):
            assert k in data["monthly_goals"]

        # counts >=1 given the seeding
        assert data["tasks"]["today_total"] >= 2
        assert data["tasks"]["today_completed"] >= 1
        assert data["tasks"]["completed"] >= 1
        assert data["habits"]["total"] >= 1
        assert data["habits"]["completions_this_month"] >= 1
        assert data["books"]["completed"] >= 1
        assert data["monthly_goals"]["total"] >= 1
        # completion_rate math check
        if data["tasks"]["total"]:
            expected = data["tasks"]["completed"] / data["tasks"]["total"] * 100
            assert abs(data["tasks"]["completion_rate"] - expected) < 0.01

    def test_overview_unauthorized(self, base_url):
        r = requests.get(f"{base_url}/api/analytics/overview")
        assert r.status_code == 401


# ------------------------- 4. TIME BREAKDOWN -------------------------

class TestTimeBreakdown:

    @pytest.fixture(autouse=True, scope="class")
    def seed_time(self, base_url, auth_headers):
        entries = [
            # 09:00-10:30 = 90m, Family/Productive
            {"date": "2026-02-05", "start_time": "09:00",
             "end_time": "10:30", "activity": "Deep work",
             "category": "Family", "classification": "Productive"},
            # 14:00-15:00 = 60m, Office/Productive
            {"date": "2026-02-10", "start_time": "14:00",
             "end_time": "15:00", "activity": "Meeting",
             "category": "Office", "classification": "Productive"},
            # overnight 23:00-01:00 = 120m, Leisure/Neutral
            {"date": "2026-02-20", "start_time": "23:00",
             "end_time": "01:00", "activity": "Reading",
             "category": "Leisure", "classification": "Neutral"},
        ]
        for e in entries:
            e["user_id"] = "x"
            requests.post(f"{base_url}/api/time-entries", headers=auth_headers,
                          json=e)
        yield

    def test_time_breakdown_math(self, base_url, auth_headers):
        r = requests.get(
            f"{base_url}/api/analytics/time-breakdown"
            f"?start_date=2026-02-01&end_date=2026-02-28",
            headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        for k in ("total_entries", "by_category", "by_classification"):
            assert k in data
        assert data["total_entries"] >= 3
        cat = {c["name"]: c["minutes"] for c in data["by_category"]}
        cls = {c["name"]: c["minutes"] for c in data["by_classification"]}
        # 90 min Family
        assert cat.get("Family", 0) >= 90
        # 60 min Office
        assert cat.get("Office", 0) >= 60
        # overnight 120 min Leisure
        assert cat.get("Leisure", 0) >= 120
        # Productive = 90 + 60 = 150
        assert cls.get("Productive", 0) >= 150
        assert cls.get("Neutral", 0) >= 120

    def test_time_breakdown_unauthorized(self, base_url):
        r = requests.get(
            f"{base_url}/api/analytics/time-breakdown"
            f"?start_date=2026-02-01&end_date=2026-02-28")
        assert r.status_code == 401


# ------------------------- 5. CUSTOM THEMES -------------------------

class TestCustomThemes:

    def test_theme_crud_and_isolation(self, base_url, auth_headers,
                                       second_auth_headers):
        payload = {
            "name": "MyTheme", "emoji": "🎨",
            "primary": "#FF6B9D", "secondary": "#C766EF",
            "gradient_start": "#FF6B9D", "gradient_end": "#C766EF",
        }
        # create for user A
        r = requests.post(f"{base_url}/api/custom-themes",
                          headers=auth_headers, json=payload)
        assert r.status_code == 200, r.text
        theme = r.json()
        assert theme["name"] == "MyTheme"
        assert theme["user_id"] == TEST_USER_ID
        tid = theme["theme_id"]

        # user A can list it
        r = requests.get(f"{base_url}/api/custom-themes",
                         headers=auth_headers)
        assert r.status_code == 200
        assert any(t["theme_id"] == tid for t in r.json())

        # user B cannot see it
        r = requests.get(f"{base_url}/api/custom-themes",
                         headers=second_auth_headers)
        assert r.status_code == 200
        assert all(t["theme_id"] != tid for t in r.json())

        # user B cannot delete it
        r = requests.delete(f"{base_url}/api/custom-themes/{tid}",
                            headers=second_auth_headers)
        assert r.status_code == 404

        # user A deletes it
        r = requests.delete(f"{base_url}/api/custom-themes/{tid}",
                            headers=auth_headers)
        assert r.status_code == 200

        # verify gone
        r = requests.get(f"{base_url}/api/custom-themes",
                         headers=auth_headers)
        assert all(t["theme_id"] != tid for t in r.json())

    def test_theme_unauthorized(self, base_url):
        r = requests.get(f"{base_url}/api/custom-themes")
        assert r.status_code == 401
        r = requests.post(f"{base_url}/api/custom-themes",
                          json={"name": "x", "primary": "#000",
                                "secondary": "#000",
                                "gradient_start": "#000",
                                "gradient_end": "#000"})
        assert r.status_code == 401


# ------------------------- 6. PUSH REGISTER -------------------------

class TestRegisterPush:

    def test_register_push_endpoint_exists(self, base_url, auth_headers):
        r = requests.post(
            f"{base_url}/api/register-push",
            headers=auth_headers,
            json={"user_id": TEST_USER_ID, "platform": "android",
                  "device_token": "fake_token_123"})
        # Route must exist and accept payload; upstream will typically fail
        # because EMERGENT_PUSH_KEY is a placeholder. Accept 201 or 5xx.
        assert r.status_code in (201, 500, 502), r.text

    def test_register_push_unauthorized(self, base_url):
        r = requests.post(
            f"{base_url}/api/register-push",
            json={"user_id": "x", "platform": "android",
                  "device_token": "t"})
        # Route must be auth-guarded. Body validation happens first only if
        # payload is invalid, but here payload is valid, so 401 is expected.
        assert r.status_code == 401


# ------------------------- 7. SEND TASK REMINDER -------------------------

class TestSendTaskReminder:

    def test_send_task_reminder_wraps_errors(self, base_url, auth_headers):
        r = requests.post(f"{base_url}/api/send-task-reminder",
                          headers=auth_headers,
                          json={"task_id": "task_test",
                                "title": "Test"})
        assert r.status_code == 200, r.text
        assert r.json() == {"status": "sent"}

    def test_send_task_reminder_unauthorized(self, base_url):
        r = requests.post(f"{base_url}/api/send-task-reminder",
                          json={"task_id": "task_test", "title": "Test"})
        assert r.status_code == 401


# ------------------------- 8. HABIT AUTO-LINK -------------------------

class TestHabitAutoLink:

    def test_habit_add_to_daily_virtual_task(self, base_url, auth_headers):
        # create habit with add_to_daily=True
        r = requests.post(f"{base_url}/api/habits", headers=auth_headers,
                          json={"user_id": "x",
                                "title": "AutoLink Habit",
                                "add_to_daily": True})
        assert r.status_code == 200
        habit = r.json()
        hid = habit["habit_id"]
        assert habit["add_to_daily"] is True

        date = "2026-02-16"

        # GET tasks for date -> virtual habit task present
        r = requests.get(f"{base_url}/api/tasks?date={date}",
                         headers=auth_headers)
        assert r.status_code == 200
        tasks = r.json()
        virt = [t for t in tasks if t.get("is_habit")
                and t.get("habit_id") == hid]
        assert len(virt) == 1, "Virtual habit task not present in tasks"
        v = virt[0]
        assert v["task_id"].startswith("habit_")
        assert v["title"].startswith("🔥 ")
        assert v["completed"] is False

        # Log habit completed for that date
        r = requests.post(
            f"{base_url}/api/habits/{hid}/log?date={date}&completed=true",
            headers=auth_headers)
        assert r.status_code == 200

        # GET tasks again -> virtual task now completed
        r = requests.get(f"{base_url}/api/tasks?date={date}",
                         headers=auth_headers)
        virt = [t for t in r.json() if t.get("habit_id") == hid]
        assert virt and virt[0]["completed"] is True

        # Flip add_to_daily -> false
        r = requests.put(f"{base_url}/api/habits/{hid}",
                         headers=auth_headers,
                         json={"add_to_daily": False})
        assert r.status_code == 200

        # Now the virtual task should be gone
        r = requests.get(f"{base_url}/api/tasks?date={date}",
                         headers=auth_headers)
        assert all(t.get("habit_id") != hid for t in r.json())


# ------------------------- 9. REGRESSION -------------------------

class TestRegression:

    def test_idempotent_put_task(self, base_url, auth_headers):
        # create task then PUT the same value twice -> both 200
        r = requests.post(f"{base_url}/api/tasks", headers=auth_headers,
                          json={"user_id": "x", "title": "Regression",
                                "date": "2026-03-01"})
        tid = r.json()["task_id"]

        r1 = requests.put(f"{base_url}/api/tasks/{tid}",
                          headers=auth_headers,
                          json={"title": "Updated Title"})
        assert r1.status_code == 200
        r2 = requests.put(f"{base_url}/api/tasks/{tid}",
                          headers=auth_headers,
                          json={"title": "Updated Title"})
        assert r2.status_code == 200, "Idempotent PUT should still be 200"

    def test_habit_log_matched_count(self, base_url, auth_headers):
        # regression around matched_count vs modified_count. Log the same
        # habit twice with identical values.
        r = requests.post(f"{base_url}/api/habits", headers=auth_headers,
                          json={"user_id": "x", "title": "Reg habit"})
        hid = r.json()["habit_id"]
        d = "2026-04-01"
        r1 = requests.post(
            f"{base_url}/api/habits/{hid}/log?date={d}&completed=true",
            headers=auth_headers)
        assert r1.status_code == 200
        r2 = requests.post(
            f"{base_url}/api/habits/{hid}/log?date={d}&completed=true",
            headers=auth_headers)
        assert r2.status_code == 200
