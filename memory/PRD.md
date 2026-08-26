# TaskFlow Life - Product Requirements Document

## Product Overview
TaskFlow Life is a comprehensive mobile/web productivity app that combines daily task management, goals tracking, habit building, and time analytics into one beautiful, aesthetic app with cloud sync.

## Key Features Implemented

### 1. Authentication
- **Emergent Google OAuth** integration
- Real-time cloud sync across all devices
- Secure session management with token storage

### 2. Tasks Tab (Main Dashboard)
Three view modes:
- **Daily**: Calendar view with daily tasks, tap any date to see/add tasks
- **Monthly**: Goals for the selected month
- **Yearly**: Goals for the year

Task features:
- Add/edit/delete tasks with checkboxes
- Set reminder time (HH:MM)
- Repeat patterns: daily, weekly, monthly

### 3. Habits Tab
Two sections:
- **Habits**: Track custom habits with duration (hours/mins)
  - Multiple habit types: general, exercise, reading, meditation, learning
  - Calendar view showing progression
  - Analytics: Total Days, Success Rate, Current Streak
  - Tap dates to mark complete/incomplete
- **Books**: Track reading list
  - Currently Reading vs Completed sections
  - Add title, author
  - Completion date tracking

### 4. Time Entry Tab
- Flexible time range entries (not fixed hourly)
- Editable Categories (Family, Self, Office, etc.)
- Editable Classifications (Productive, Non-Productive, Neutral)
- Duration auto-calculated (hrs/mins)
- Color-coded by classification
- **Export to Excel** for analysis

### 5. Profile Tab
- **8 Beautiful Color Themes**:
  - 🌅 Sunset Vibes (default)
  - 🌊 Ocean Breeze
  - 🍭 Candy Pop
  - 🌿 Forest Fresh
  - ✨ Neon Nights
  - 🍑 Peachy Keen
  - 💜 Purple Dream
  - 🌱 Mint Fresh
- User profile display
- Logout

## Technical Architecture

### Backend
- FastAPI with MongoDB
- All endpoints prefixed with `/api`
- Bearer token authentication (via Emergent OAuth)
- MongoDB indexes on user_id, session_token, etc.
- Excel export using openpyxl

### Frontend
- Expo Router with file-based routing
- Tab navigation (Tasks, Habits, Time Entry, Profile)
- React Query for state management
- Theme context for dynamic color switching
- All screens use theme colors for consistent aesthetic

### Data Models
- Users, UserSessions
- Tasks, MonthlyGoals, YearlyGoals
- Habits, HabitLogs, Books
- TimeEntries, Categories, Classifications

## Future Enhancements (Phase 2)
- Push notifications for task reminders (deployment feature)
- Home screen widget (requires native development)
- Advanced analytics dashboards with charts
- Habit-Daily task auto-linking
- Weekly analytics view
