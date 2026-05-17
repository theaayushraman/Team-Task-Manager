# Team Task Manager

A full-stack web application for team collaboration — create projects, assign tasks, and track progress with role-based access control.

## Features

- **Authentication** — Signup/Login with JWT tokens (24-hour sessions)
- **Projects** — Create, edit, delete projects; invite team members
- **Role-Based Access** — Admin (full control) vs Member (create/edit own tasks)
- **Tasks** — Create tasks with title, description, status, priority, assignee, due date
- **Dashboard** — Stats overview, recent tasks, my open tasks
- **Overdue Tracking** — Tasks past due date are highlighted

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | FastAPI (Python) |
| Database | SQLite (dev) / PostgreSQL (prod) |
| ORM | SQLAlchemy 2.0 |
| Auth | JWT via python-jose + bcrypt |
| Frontend | Vanilla JS + Tailwind CSS |
| Deployment | Railway |

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Create account |
| POST | `/api/auth/login` | Login |
| GET | `/api/auth/me` | Current user |
| GET | `/api/projects/` | List my projects |
| POST | `/api/projects/` | Create project |
| GET | `/api/projects/{id}` | Get project |
| PUT | `/api/projects/{id}` | Update project (Admin) |
| DELETE | `/api/projects/{id}` | Delete project (Owner) |
| GET | `/api/projects/{id}/members` | List members |
| POST | `/api/projects/{id}/members` | Add member (Admin) |
| PUT | `/api/projects/{id}/members/{uid}` | Change role (Admin) |
| DELETE | `/api/projects/{id}/members/{uid}` | Remove member (Admin) |
| GET | `/api/projects/{id}/tasks` | List tasks |
| POST | `/api/projects/{id}/tasks` | Create task |
| PUT | `/api/projects/{id}/tasks/{tid}` | Update task |
| DELETE | `/api/projects/{id}/tasks/{tid}` | Delete task |
| GET | `/api/dashboard/` | Dashboard stats |
| GET | `/api/users/?search=` | Search users |

## Local Development

```bash
# Clone and enter directory
cd "Project Manager"

# Create virtual environment
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# (Optional) copy env file
cp .env.example .env

# Run the server
uvicorn app.main:app --reload --port 8000
```

Open http://localhost:8000 — the SPA loads automatically.  
API docs: http://localhost:8000/docs

## Deploy to Railway

1. Push this repo to GitHub
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. Add a **PostgreSQL** plugin — Railway auto-sets `DATABASE_URL`
4. Add environment variable: `SECRET_KEY` = any long random string
5. Deploy — Railway reads `railway.toml` and `Dockerfile` automatically

## Role Permissions

| Action | Admin | Member |
|--------|-------|--------|
| View project & tasks | ✅ | ✅ |
| Create tasks | ✅ | ✅ |
| Edit own tasks | ✅ | ✅ |
| Edit any task | ✅ | ❌ |
| Delete own tasks | ✅ | ✅ |
| Delete any task | ✅ | ❌ |
| Add/remove members | ✅ | ❌ |
| Edit project details | ✅ | ❌ |
| Delete project | Owner only | ❌ |
