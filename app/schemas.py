from pydantic import BaseModel, EmailStr, field_validator
from pydantic import ConfigDict
from typing import Optional, List
from datetime import datetime
from .models import TaskStatus, TaskPriority, ProjectRole


# ─── Auth ─────────────────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    email: EmailStr
    username: str
    password: str

    @field_validator("username")
    @classmethod
    def username_valid(cls, v):
        assert len(v) >= 3, "Username must be at least 3 characters"
        assert len(v) <= 50, "Username must be at most 50 characters"
        return v

    @field_validator("password")
    @classmethod
    def password_valid(cls, v):
        assert len(v) >= 6, "Password must be at least 6 characters"
        return v


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    username: str
    is_active: bool
    created_at: datetime


class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse


class LoginRequest(BaseModel):
    email: str
    password: str


# ─── Project ──────────────────────────────────────────────────────────────────

class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None

    @field_validator("name")
    @classmethod
    def name_valid(cls, v):
        assert len(v.strip()) > 0, "Project name cannot be empty"
        assert len(v) <= 255, "Project name too long"
        return v.strip()


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class ProjectMemberResponse(BaseModel):
    user_id: int
    username: str
    email: str
    role: ProjectRole
    joined_at: datetime


class ProjectResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    owner_id: int
    owner_username: str
    created_at: datetime
    updated_at: Optional[datetime]
    member_count: int
    task_count: int
    tasks_todo: int
    tasks_in_progress: int
    tasks_done: int
    my_role: Optional[str]


class ProjectMemberAdd(BaseModel):
    user_id: int
    role: ProjectRole = ProjectRole.MEMBER


class ProjectMemberUpdate(BaseModel):
    role: ProjectRole


# ─── Task ─────────────────────────────────────────────────────────────────────

class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = None
    status: TaskStatus = TaskStatus.TODO
    priority: TaskPriority = TaskPriority.MEDIUM
    assignee_id: Optional[int] = None
    due_date: Optional[datetime] = None

    @field_validator("title")
    @classmethod
    def title_valid(cls, v):
        assert len(v.strip()) > 0, "Task title cannot be empty"
        assert len(v) <= 255, "Task title too long"
        return v.strip()


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[TaskStatus] = None
    priority: Optional[TaskPriority] = None
    assignee_id: Optional[int] = None
    due_date: Optional[datetime] = None


class TaskResponse(BaseModel):
    id: int
    title: str
    description: Optional[str]
    status: TaskStatus
    priority: TaskPriority
    project_id: int
    project_name: str
    assignee_id: Optional[int]
    assignee_username: Optional[str]
    creator_id: int
    creator_username: str
    due_date: Optional[datetime]
    created_at: datetime
    updated_at: Optional[datetime]
    is_overdue: bool


# ─── Dashboard ────────────────────────────────────────────────────────────────

class DashboardStats(BaseModel):
    total_projects: int
    total_tasks: int
    todo_tasks: int
    in_progress_tasks: int
    completed_tasks: int
    overdue_tasks: int


class DashboardResponse(BaseModel):
    stats: DashboardStats
    recent_tasks: List[TaskResponse]
    my_tasks: List[TaskResponse]
