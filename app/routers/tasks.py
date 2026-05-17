from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timezone
from ..database import get_db
from ..models import User, Task, TaskStatus, ProjectRole
from ..schemas import TaskCreate, TaskUpdate, TaskResponse
from ..dependencies import get_current_user
from .projects import get_project_or_404, require_access, get_user_role

router = APIRouter(tags=["Tasks"])


def task_to_response(task: Task) -> dict:
    now = datetime.now(timezone.utc)
    due = task.due_date
    if due and due.tzinfo is None:
        due = due.replace(tzinfo=timezone.utc)
    is_overdue = bool(due and task.status != TaskStatus.DONE and due < now)
    return {
        "id": task.id,
        "title": task.title,
        "description": task.description,
        "status": task.status,
        "priority": task.priority,
        "project_id": task.project_id,
        "project_name": task.project.name,
        "assignee_id": task.assignee_id,
        "assignee_username": task.assignee.username if task.assignee else None,
        "creator_id": task.creator_id,
        "creator_username": task.creator.username,
        "due_date": task.due_date,
        "created_at": task.created_at,
        "updated_at": task.updated_at,
        "is_overdue": is_overdue,
    }


@router.get("/projects/{project_id}/tasks", response_model=List[TaskResponse])
def list_tasks(
    project_id: int,
    status: Optional[TaskStatus] = Query(None),
    assignee_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = get_project_or_404(project_id, db)
    require_access(project, current_user.id)

    query = db.query(Task).filter(Task.project_id == project_id)
    if status:
        query = query.filter(Task.status == status)
    if assignee_id:
        query = query.filter(Task.assignee_id == assignee_id)

    return [task_to_response(t) for t in query.order_by(Task.created_at.desc()).all()]


@router.post("/projects/{project_id}/tasks", response_model=TaskResponse, status_code=201)
def create_task(
    project_id: int,
    data: TaskCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = get_project_or_404(project_id, db)
    require_access(project, current_user.id)

    if data.assignee_id and not get_user_role(project, data.assignee_id):
        raise HTTPException(status_code=400, detail="Assignee must be a project member")

    task = Task(
        title=data.title,
        description=data.description,
        status=data.status,
        priority=data.priority,
        project_id=project_id,
        assignee_id=data.assignee_id,
        creator_id=current_user.id,
        due_date=data.due_date,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task_to_response(task)


@router.get("/projects/{project_id}/tasks/{task_id}", response_model=TaskResponse)
def get_task(
    project_id: int,
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = get_project_or_404(project_id, db)
    require_access(project, current_user.id)

    task = db.query(Task).filter(Task.id == task_id, Task.project_id == project_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task_to_response(task)


@router.put("/projects/{project_id}/tasks/{task_id}", response_model=TaskResponse)
def update_task(
    project_id: int,
    task_id: int,
    data: TaskUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = get_project_or_404(project_id, db)
    role = require_access(project, current_user.id)

    task = db.query(Task).filter(Task.id == task_id, Task.project_id == project_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    if role == ProjectRole.MEMBER and task.creator_id != current_user.id and task.assignee_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only update tasks you created or are assigned to")

    if data.title is not None:
        task.title = data.title.strip()
    if data.description is not None:
        task.description = data.description
    if data.status is not None:
        task.status = data.status
    if data.priority is not None:
        task.priority = data.priority
    if data.assignee_id is not None:
        if not get_user_role(project, data.assignee_id):
            raise HTTPException(status_code=400, detail="Assignee must be a project member")
        task.assignee_id = data.assignee_id
    if data.due_date is not None:
        task.due_date = data.due_date

    db.commit()
    db.refresh(task)
    return task_to_response(task)


@router.delete("/projects/{project_id}/tasks/{task_id}", status_code=204)
def delete_task(
    project_id: int,
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = get_project_or_404(project_id, db)
    role = require_access(project, current_user.id)

    task = db.query(Task).filter(Task.id == task_id, Task.project_id == project_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    if role == ProjectRole.MEMBER and task.creator_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only delete tasks you created")

    db.delete(task)
    db.commit()
