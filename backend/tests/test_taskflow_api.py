"""Comprehensive backend API tests for TaskFlow Life."""
import io
import os
import pytest
import requests
from openpyxl import load_workbook

from conftest import TEST_USER_ID, TEST_TOKEN, SECOND_TOKEN


# ---------- Auth ----------
class TestAuth:
    def test_me_with_valid_token(self, base_url, auth_headers, api_client):
        r = api_client.get(f"{base_url}/api/auth/me", headers=auth_headers)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["user_id"] == TEST_USER_ID
        assert data["email"] == "test@taskflow.com"
        assert "_id" not in data

    def test_me_without_token_returns_401(self, base_url, api_client):
        r = api_client.get(f"{base_url}/api/auth/me")
        assert r.status_code == 401

    def test_me_invalid_token_returns_401(self, base_url, api_client):
        r = api_client.get(f"{base_url}/api/auth/me",
                           headers={"Authorization": "Bearer invalid_token_xxxxx"})
        assert r.status_code == 401


# ---------- Tasks CRUD ----------
class TestTasks:
    task_id = None

    def test_create_task(self, base_url, auth_headers, api_client):
        payload = {
            "user_id": "ignored",
            "title": "TEST_ Buy groceries",
            "date": "2026-02-15",
            "completed": False,
            "reminder_time": "09:00",
            "repeat_pattern": "daily"
        }
        r = api_client.post(f"{base_url}/api/tasks", headers=auth_headers, json=payload)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["title"] == payload["title"]
        assert data["user_id"] == TEST_USER_ID  # server should overwrite user_id
        assert data["date"] == "2026-02-15"
        assert data["reminder_time"] == "09:00"
        assert data["repeat_pattern"] == "daily"
        assert "_id" not in data
        assert data["task_id"].startswith("task_")
        TestTasks.task_id = data["task_id"]

    def test_get_tasks_by_date(self, base_url, auth_headers, api_client):
        r = api_client.get(f"{base_url}/api/tasks?date=2026-02-15", headers=auth_headers)
        assert r.status_code == 200
        tasks = r.json()
        assert isinstance(tasks, list)
        assert any(t["task_id"] == TestTasks.task_id for t in tasks)
        for t in tasks:
            assert "_id" not in t

    def test_get_all_tasks(self, base_url, auth_headers, api_client):
        r = api_client.get(f"{base_url}/api/tasks", headers=auth_headers)
        assert r.status_code == 200
        tasks = r.json()
        assert any(t["task_id"] == TestTasks.task_id for t in tasks)

    def test_update_task(self, base_url, auth_headers, api_client):
        r = api_client.put(f"{base_url}/api/tasks/{TestTasks.task_id}",
                           headers=auth_headers, json={"completed": True})
        assert r.status_code == 200, r.text
        # Verify
        r2 = api_client.get(f"{base_url}/api/tasks?date=2026-02-15", headers=auth_headers)
        task = next(t for t in r2.json() if t["task_id"] == TestTasks.task_id)
        assert task["completed"] is True

    def test_delete_task(self, base_url, auth_headers, api_client):
        r = api_client.delete(f"{base_url}/api/tasks/{TestTasks.task_id}", headers=auth_headers)
        assert r.status_code == 200
        r2 = api_client.get(f"{base_url}/api/tasks?date=2026-02-15", headers=auth_headers)
        assert not any(t["task_id"] == TestTasks.task_id for t in r2.json())


# ---------- Monthly Goals ----------
class TestMonthlyGoals:
    goal_id = None

    def test_create(self, base_url, auth_headers, api_client):
        r = api_client.post(f"{base_url}/api/goals/monthly", headers=auth_headers,
                            json={"user_id": "x", "title": "TEST_ Read 3 books", "month": "2026-02"})
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["month"] == "2026-02"
        assert data["completed"] is False
        assert data["user_id"] == TEST_USER_ID
        TestMonthlyGoals.goal_id = data["goal_id"]

    def test_get(self, base_url, auth_headers, api_client):
        r = api_client.get(f"{base_url}/api/goals/monthly?month=2026-02", headers=auth_headers)
        assert r.status_code == 200
        goals = r.json()
        assert any(g["goal_id"] == TestMonthlyGoals.goal_id for g in goals)

    def test_update(self, base_url, auth_headers, api_client):
        r = api_client.put(f"{base_url}/api/goals/monthly/{TestMonthlyGoals.goal_id}",
                           headers=auth_headers, json={"completed": True})
        assert r.status_code == 200
        r2 = api_client.get(f"{base_url}/api/goals/monthly?month=2026-02", headers=auth_headers)
        g = next(x for x in r2.json() if x["goal_id"] == TestMonthlyGoals.goal_id)
        assert g["completed"] is True

    def test_delete(self, base_url, auth_headers, api_client):
        r = api_client.delete(f"{base_url}/api/goals/monthly/{TestMonthlyGoals.goal_id}",
                              headers=auth_headers)
        assert r.status_code == 200
        r2 = api_client.get(f"{base_url}/api/goals/monthly?month=2026-02", headers=auth_headers)
        assert not any(g["goal_id"] == TestMonthlyGoals.goal_id for g in r2.json())


# ---------- Yearly Goals ----------
class TestYearlyGoals:
    goal_id = None

    def test_create(self, base_url, auth_headers, api_client):
        r = api_client.post(f"{base_url}/api/goals/yearly", headers=auth_headers,
                            json={"user_id": "x", "title": "TEST_ Learn Rust", "year": "2026"})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["year"] == "2026"
        assert d["user_id"] == TEST_USER_ID
        TestYearlyGoals.goal_id = d["goal_id"]

    def test_get(self, base_url, auth_headers, api_client):
        r = api_client.get(f"{base_url}/api/goals/yearly?year=2026", headers=auth_headers)
        assert r.status_code == 200
        assert any(g["goal_id"] == TestYearlyGoals.goal_id for g in r.json())

    def test_update(self, base_url, auth_headers, api_client):
        r = api_client.put(f"{base_url}/api/goals/yearly/{TestYearlyGoals.goal_id}",
                           headers=auth_headers, json={"completed": True})
        assert r.status_code == 200
        r2 = api_client.get(f"{base_url}/api/goals/yearly?year=2026", headers=auth_headers)
        assert next(x for x in r2.json() if x["goal_id"] == TestYearlyGoals.goal_id)["completed"] is True

    def test_delete(self, base_url, auth_headers, api_client):
        r = api_client.delete(f"{base_url}/api/goals/yearly/{TestYearlyGoals.goal_id}", headers=auth_headers)
        assert r.status_code == 200


# ---------- Habits + logs + analytics ----------
class TestHabits:
    habit_id = None

    def test_create(self, base_url, auth_headers, api_client):
        r = api_client.post(f"{base_url}/api/habits", headers=auth_headers,
                            json={"user_id": "x", "title": "TEST_ Morning Workout",
                                  "duration_hours": 1, "duration_minutes": 0,
                                  "habit_type": "exercise"})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["title"] == "TEST_ Morning Workout"
        assert d["duration_hours"] == 1
        assert d["habit_type"] == "exercise"
        assert d["user_id"] == TEST_USER_ID
        TestHabits.habit_id = d["habit_id"]

    def test_list(self, base_url, auth_headers, api_client):
        r = api_client.get(f"{base_url}/api/habits", headers=auth_headers)
        assert r.status_code == 200
        assert any(h["habit_id"] == TestHabits.habit_id for h in r.json())

    def test_log_two_days(self, base_url, auth_headers, api_client):
        # log is via query params
        for d in ("2026-02-15", "2026-02-14"):
            r = api_client.post(
                f"{base_url}/api/habits/{TestHabits.habit_id}/log?date={d}&completed=true",
                headers=auth_headers)
            assert r.status_code == 200, r.text

    def test_get_logs(self, base_url, auth_headers, api_client):
        r = api_client.get(f"{base_url}/api/habits/{TestHabits.habit_id}/logs?month=2026-02",
                           headers=auth_headers)
        assert r.status_code == 200
        logs = r.json()
        assert len(logs) >= 2
        dates = {log["date"] for log in logs}
        assert {"2026-02-15", "2026-02-14"}.issubset(dates)
        for log in logs:
            assert "_id" not in log

    def test_analytics(self, base_url, auth_headers, api_client):
        r = api_client.get(f"{base_url}/api/habits/{TestHabits.habit_id}/analytics",
                           headers=auth_headers)
        assert r.status_code == 200
        a = r.json()
        assert "completion_rate" in a
        assert "current_streak" in a
        assert a["total_days"] >= 2
        assert a["completed_days"] >= 2
        assert a["completion_rate"] == 100.0
        assert a["current_streak"] >= 2

    def test_update(self, base_url, auth_headers, api_client):
        r = api_client.put(f"{base_url}/api/habits/{TestHabits.habit_id}",
                           headers=auth_headers, json={"duration_minutes": 30})
        assert r.status_code == 200
        r2 = api_client.get(f"{base_url}/api/habits", headers=auth_headers)
        h = next(x for x in r2.json() if x["habit_id"] == TestHabits.habit_id)
        assert h["duration_minutes"] == 30

    def test_delete(self, base_url, auth_headers, api_client):
        r = api_client.delete(f"{base_url}/api/habits/{TestHabits.habit_id}", headers=auth_headers)
        assert r.status_code == 200


# ---------- Books ----------
class TestBooks:
    book_id = None

    def test_create(self, base_url, auth_headers, api_client):
        r = api_client.post(f"{base_url}/api/books", headers=auth_headers,
                            json={"user_id": "x", "title": "TEST_ Atomic Habits", "author": "James Clear"})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["title"] == "TEST_ Atomic Habits"
        assert d["author"] == "James Clear"
        assert d["completed"] is False
        TestBooks.book_id = d["book_id"]

    def test_list(self, base_url, auth_headers, api_client):
        r = api_client.get(f"{base_url}/api/books", headers=auth_headers)
        assert r.status_code == 200
        assert any(b["book_id"] == TestBooks.book_id for b in r.json())

    def test_update(self, base_url, auth_headers, api_client):
        r = api_client.put(f"{base_url}/api/books/{TestBooks.book_id}",
                           headers=auth_headers,
                           json={"completed": True, "date_completed": "2026-02-20"})
        assert r.status_code == 200
        r2 = api_client.get(f"{base_url}/api/books", headers=auth_headers)
        b = next(x for x in r2.json() if x["book_id"] == TestBooks.book_id)
        assert b["completed"] is True
        assert b["date_completed"] == "2026-02-20"

    def test_delete(self, base_url, auth_headers, api_client):
        r = api_client.delete(f"{base_url}/api/books/{TestBooks.book_id}", headers=auth_headers)
        assert r.status_code == 200


# ---------- Time Entries + Excel ----------
class TestTimeEntries:
    entry_ids = []

    def test_create_multiple(self, base_url, auth_headers, api_client):
        entries = [
            {"date": "2026-02-15", "start_time": "09:00", "end_time": "10:30",
             "activity": "TEST_ Coding", "category": "Office", "classification": "Productive"},
            {"date": "2026-02-15", "start_time": "11:00", "end_time": "12:00",
             "activity": "TEST_ Meeting", "category": "Office", "classification": "Productive"},
            {"date": "2026-02-20", "start_time": "18:00", "end_time": "19:00",
             "activity": "TEST_ Gym", "category": "Exercise", "classification": "Productive"},
        ]
        for e in entries:
            e["user_id"] = "x"
            r = api_client.post(f"{base_url}/api/time-entries", headers=auth_headers, json=e)
            assert r.status_code == 200, r.text
            d = r.json()
            assert d["activity"] == e["activity"]
            assert d["user_id"] == TEST_USER_ID
            TestTimeEntries.entry_ids.append(d["entry_id"])

    def test_get_by_date(self, base_url, auth_headers, api_client):
        r = api_client.get(f"{base_url}/api/time-entries?date=2026-02-15", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert len([e for e in data if e["date"] == "2026-02-15"]) >= 2

    def test_update(self, base_url, auth_headers, api_client):
        eid = TestTimeEntries.entry_ids[0]
        r = api_client.put(f"{base_url}/api/time-entries/{eid}",
                           headers=auth_headers,
                           json={"activity": "TEST_ Coding (updated)"})
        assert r.status_code == 200
        r2 = api_client.get(f"{base_url}/api/time-entries?date=2026-02-15", headers=auth_headers)
        e = next(x for x in r2.json() if x["entry_id"] == eid)
        assert e["activity"] == "TEST_ Coding (updated)"

    def test_export_excel(self, base_url, auth_headers, api_client):
        r = api_client.get(
            f"{base_url}/api/time-entries/export?start_date=2026-02-01&end_date=2026-02-28",
            headers=auth_headers)
        assert r.status_code == 200, r.text[:500]
        ct = r.headers.get("content-type", "")
        assert "spreadsheetml.sheet" in ct, f"Unexpected content-type: {ct}"
        cd = r.headers.get("content-disposition", "")
        assert ".xlsx" in cd, f"Bad content-disposition: {cd}"

        # Verify valid xlsx
        out_path = "/tmp/test_export.xlsx"
        with open(out_path, "wb") as f:
            f.write(r.content)
        assert os.path.getsize(out_path) > 500
        wb = load_workbook(out_path)
        ws = wb.active
        # Row 1 should be header
        headers = [c.value for c in ws[1]]
        assert headers == ["Date", "Start Time", "End Time", "Activity", "Category", "Classification"]
        # Should have at least 3 data rows for our user
        activities = [ws.cell(row=r_i, column=4).value for r_i in range(2, ws.max_row + 1)]
        assert any(a and "TEST_" in a for a in activities)

    def test_delete_all(self, base_url, auth_headers, api_client):
        for eid in TestTimeEntries.entry_ids:
            r = api_client.delete(f"{base_url}/api/time-entries/{eid}", headers=auth_headers)
            assert r.status_code == 200


# ---------- Categories & Classifications ----------
class TestCategoriesClassifications:
    new_cat_id = None
    new_cls_id = None

    def test_default_categories(self, base_url, auth_headers, api_client):
        r = api_client.get(f"{base_url}/api/categories", headers=auth_headers)
        assert r.status_code == 200
        names = [c["name"] for c in r.json()]
        for expected in ["Family", "Self", "Office", "Exercise", "Leisure"]:
            assert expected in names

    def test_create_category(self, base_url, auth_headers, api_client):
        r = api_client.post(f"{base_url}/api/categories?name=TEST_Study", headers=auth_headers)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["name"] == "TEST_Study"
        assert d["user_id"] == TEST_USER_ID
        assert "_id" not in d
        TestCategoriesClassifications.new_cat_id = d["category_id"]

    def test_delete_category(self, base_url, auth_headers, api_client):
        r = api_client.delete(
            f"{base_url}/api/categories/{TestCategoriesClassifications.new_cat_id}",
            headers=auth_headers)
        assert r.status_code == 200

    def test_default_classifications(self, base_url, auth_headers, api_client):
        r = api_client.get(f"{base_url}/api/classifications", headers=auth_headers)
        assert r.status_code == 200
        names = [c["name"] for c in r.json()]
        for expected in ["Productive", "Non-Productive", "Neutral"]:
            assert expected in names

    def test_create_classification(self, base_url, auth_headers, api_client):
        r = api_client.post(f"{base_url}/api/classifications?name=TEST_Learning", headers=auth_headers)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["name"] == "TEST_Learning"
        TestCategoriesClassifications.new_cls_id = d["classification_id"]

    def test_delete_classification(self, base_url, auth_headers, api_client):
        r = api_client.delete(
            f"{base_url}/api/classifications/{TestCategoriesClassifications.new_cls_id}",
            headers=auth_headers)
        assert r.status_code == 200


# ---------- User Isolation ----------
class TestUserIsolation:
    def test_other_user_cannot_see_user_task(self, base_url, auth_headers, second_auth_headers, api_client):
        # Create task as user1
        r = api_client.post(f"{base_url}/api/tasks", headers=auth_headers,
                            json={"user_id": "x", "title": "TEST_ISO_task",
                                  "date": "2026-03-01", "completed": False})
        assert r.status_code == 200
        task_id = r.json()["task_id"]

        # user2 should not see it
        r2 = api_client.get(f"{base_url}/api/tasks", headers=second_auth_headers)
        assert r2.status_code == 200
        assert not any(t["task_id"] == task_id for t in r2.json())

        # user2 cannot delete it
        r3 = api_client.delete(f"{base_url}/api/tasks/{task_id}", headers=second_auth_headers)
        assert r3.status_code == 404

        # user2 cannot update it
        r4 = api_client.put(f"{base_url}/api/tasks/{task_id}",
                            headers=second_auth_headers, json={"completed": True})
        assert r4.status_code == 404

        # Cleanup: user1 can delete
        api_client.delete(f"{base_url}/api/tasks/{task_id}", headers=auth_headers)

    def test_unauthorized_all_endpoints(self, base_url, api_client):
        checks = [
            ("GET", "/api/tasks"),
            ("POST", "/api/tasks"),
            ("GET", "/api/goals/monthly"),
            ("GET", "/api/goals/yearly"),
            ("GET", "/api/habits"),
            ("GET", "/api/books"),
            ("GET", "/api/time-entries"),
            ("GET", "/api/categories"),
            ("GET", "/api/classifications"),
            ("GET", "/api/auth/me"),
        ]
        # Use valid body for POST so we hit auth check (not Pydantic validation)
        valid_body = {"user_id": "x", "title": "t", "date": "2026-01-01"}
        for method, path in checks:
            r = api_client.request(method, f"{base_url}{path}",
                                   json=valid_body if method == "POST" else None)
            assert r.status_code == 401, f"{method} {path} returned {r.status_code}"
