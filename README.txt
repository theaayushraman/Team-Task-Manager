# Team Task Manager

A full-stack web application for managing projects and tasks across teams. Built with role-based access control, a live Kanban board, real-time progress tracking, and a clean responsive dashboard.

---

## Overview

Team Task Manager lets you create projects, invite team members, assign tasks, and track progress — all from a single interface. Every project has its own workspace with a Kanban board and a detailed member management panel. The dashboard gives you a bird's-eye view of everything happening across all your projects.

---

## Features

### Authentication
- Secure signup and login using JWT tokens
- Passwords are hashed with bcrypt
- Sessions persist for 24 hours
- Protected routes — all data is user-scoped

### Dashboard
- At-a-glance stats: total projects, tasks, to-do, in-progress, completed, and overdue
- SVG circular progress ring showing your overall completion percentage
- Per-project progress bars with color indicators (blue → amber → green)
- Recent tasks feed across all projects
- "Assigned to Me" panel showing your open tasks

### Projects
- Create, edit, and delete projects
- Project cards show task breakdown (to-do / in-progress / done) and member count
- Progress bar on every card updates live as tasks are completed
- Full search and filtering inside each project

### Kanban Board
- Visual board with three columns: **To Do**, **In Progress**, **Done**
- Drag and drop tasks between columns — status updates instantly via API
- Task cards show priority (color-coded left border), assignee avatar, and due date
- Hover to reveal quick edit and delete actions
- Toggle between **Board view** and **List view** anytime

### Tasks
- Create tasks with title, description, status, priority, assignee, and due date
- Priority levels: Low, Medium, High — color-coded throughout the UI
- Relative due dates: "Due today", "Due tomorrow", "Due in 3 days", "Overdue 2d"
- Filter tasks by status or priority within any project
- Overdue tasks are highlighted in red across all views

### Team & Role-Based Access
- Invite any registered user to a project by searching their username or email
- Two roles per project:
  - **Admin** — full control: manage members, edit project, create/edit/delete any task
  - **Member** — can create tasks and edit only their own assigned tasks
- Promote or demote members between roles with a single click
- Project owner always retains Admin privileges and cannot be removed

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | FastAPI (Python) |
| Database | PostgreSQL (production) / SQLite (development) |
| ORM | SQLAlchemy 2.0 |
| Authentication | JWT via python-jose + bcrypt via passlib |
| Frontend | Vanilla JavaScript + Tailwind CSS |
| Icons | Font Awesome 6 |

---

## Project Structure

```
team-task-manager/
├── app/
│   ├── main.py              # FastAPI app entry point
│   ├── config.py            # Environment settings
│   ├── database.py          # SQLAlchemy engine and session
│   ├── models.py            # Database models
│   ├── schemas.py           # Pydantic request/response schemas
│   ├── auth.py              # JWT and password utilities
│   ├── dependencies.py      # Auth dependency injection
│   └── routers/
│       ├── auth.py          # /register, /login, /me
│       ├── projects.py      # Project CRUD + member management
│       ├── tasks.py         # Task CRUD
│       ├── users.py         # User search
│       └── dashboard.py     # Aggregated stats
├── static/
│   ├── index.html           # Single-page app shell
│   ├── css/style.css        # Custom design system
│   └── js/app.js            # Router, API client, all views
├── requirements.txt
├── Dockerfile
└── railway.toml
```

---

## API Reference

### Authentication
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/register` | Create a new account |
| POST | `/api/auth/login` | Login and receive a JWT token |
| GET | `/api/auth/me` | Get the currently authenticated user |

### Projects
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/projects/` | List all projects for current user |
| POST | `/api/projects/` | Create a new project |
| GET | `/api/projects/{id}` | Get a single project |
| PUT | `/api/projects/{id}` | Update project name/description (Admin) |
| DELETE | `/api/projects/{id}` | Delete project and all tasks (Owner only) |

### Members
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/projects/{id}/members` | List all members |
| POST | `/api/projects/{id}/members` | Add a member with a role (Admin) |
| PUT | `/api/projects/{id}/members/{uid}` | Change a member's role (Admin) |
| DELETE | `/api/projects/{id}/members/{uid}` | Remove a member (Admin) |

### Tasks
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/projects/{id}/tasks` | List tasks (filter by status/assignee) |
| POST | `/api/projects/{id}/tasks` | Create a task |
| GET | `/api/projects/{id}/tasks/{tid}` | Get a single task |
| PUT | `/api/projects/{id}/tasks/{tid}` | Update a task |
| DELETE | `/api/projects/{id}/tasks/{tid}` | Delete a task |

### Dashboard
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/dashboard/` | Get stats, recent tasks, and assigned tasks |

---

## Running Locally

**Prerequisites:** Python 3.11+

```bash
# 1. Clone the repository
git clone https://github.com/theaayushraman/Team-Task-Manager.git
cd Team-Task-Manager

# 2. Create and activate a virtual environment
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Start the server
uvicorn app.main:app --reload --port 8000
```

Open **http://localhost:8000** in your browser.  
Interactive API docs are available at **http://localhost:8000/docs**

By default the app uses SQLite — no database setup required for local development.

---

## How to Use

### 1. Create an Account
Register with your email, username, and a password. You are logged in immediately after registration.

### 2. Create a Project
From the Projects page, click **New Project**, enter a name and optional description. You are automatically the Admin of any project you create.

### 3. Add Tasks
Open a project and click **Add Task**. Fill in the title, set a priority (Low / Medium / High), assign it to a team member, and optionally set a due date. Tasks appear on the Kanban board instantly.

### 4. Use the Kanban Board
Drag task cards between the **To Do**, **In Progress**, and **Done** columns to update their status. Switch to **List view** for a table layout with sorting and filtering.

### 5. Invite Team Members
Go to the **Members** tab inside a project and click **Add Member**. Search by username or email and assign them a role. Admins have full control; Members can only create tasks and edit their own.

### 6. Track Progress
The Dashboard updates automatically as tasks are completed. Each project card shows a live progress bar. The circular chart on the dashboard reflects your overall completion rate across all projects.

---

## Role Permissions

| Action | Admin | Member |
|---|---|---|
| View project and tasks | ✅ | ✅ |
| Create tasks | ✅ | ✅ |
| Edit own tasks | ✅ | ✅ |
| Edit any task | ✅ | ❌ |
| Delete own tasks | ✅ | ✅ |
| Delete any task | ✅ | ❌ |
| Add / remove members | ✅ | ❌ |
| Edit project details | ✅ | ❌ |
| Delete project | Owner only | ❌ |

---

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `DATABASE_URL` | Database connection string | `sqlite:///./taskmanager.db` |
| `SECRET_KEY` | JWT signing secret (change in production) | — |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Token validity period | `1440` (24 hours) |
