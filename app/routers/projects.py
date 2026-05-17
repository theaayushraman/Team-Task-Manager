from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from ..database import get_db
from ..models import User, Project, ProjectMember, ProjectRole, TaskStatus
from ..schemas import (
    ProjectCreate,
    ProjectUpdate,
    ProjectResponse,
    ProjectMemberAdd,
    ProjectMemberResponse,
    ProjectMemberUpdate,
)
from ..dependencies import get_current_user

router = APIRouter(prefix="/projects", tags=["Projects"])


def get_project_or_404(project_id: int, db: Session) -> Project:
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


def get_user_role(project: Project, user_id: int) -> Optional[str]:
    if project.owner_id == user_id:
        return ProjectRole.ADMIN
    member = next((m for m in project.members if m.user_id == user_id), None)
    return member.role if member else None


def require_access(project: Project, user_id: int) -> str:
    role = get_user_role(project, user_id)
    if not role:
        raise HTTPException(status_code=403, detail="You don't have access to this project")
    return role


def require_admin(project: Project, user_id: int):
    if get_user_role(project, user_id) != ProjectRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")


def to_response(project: Project, user_id: int) -> dict:
    tasks = project.tasks
    return {
        "id": project.id,
        "name": project.name,
        "description": project.description,
        "owner_id": project.owner_id,
        "owner_username": project.owner.username,
        "created_at": project.created_at,
        "updated_at": project.updated_at,
        "member_count": len(project.members) + 1,
        "task_count": len(tasks),
        "tasks_todo": sum(1 for t in tasks if t.status == TaskStatus.TODO),
        "tasks_in_progress": sum(1 for t in tasks if t.status == TaskStatus.IN_PROGRESS),
        "tasks_done": sum(1 for t in tasks if t.status == TaskStatus.DONE),
        "my_role": str(get_user_role(project, user_id)),
    }


@router.get("/", response_model=List[ProjectResponse])
def list_projects(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    owned = db.query(Project).filter(Project.owner_id == current_user.id).all()
    member_of = (
        db.query(Project)
        .join(ProjectMember)
        .filter(ProjectMember.user_id == current_user.id)
        .all()
    )
    seen, projects = set(), []
    for p in owned + member_of:
        if p.id not in seen:
            seen.add(p.id)
            projects.append(p)
    return [to_response(p, current_user.id) for p in projects]


@router.post("/", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
def create_project(
    data: ProjectCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = Project(name=data.name, description=data.description, owner_id=current_user.id)
    db.add(project)
    db.commit()
    db.refresh(project)
    return to_response(project, current_user.id)


@router.get("/{project_id}", response_model=ProjectResponse)
def get_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = get_project_or_404(project_id, db)
    require_access(project, current_user.id)
    return to_response(project, current_user.id)


@router.put("/{project_id}", response_model=ProjectResponse)
def update_project(
    project_id: int,
    data: ProjectUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = get_project_or_404(project_id, db)
    require_admin(project, current_user.id)

    if data.name is not None:
        project.name = data.name.strip()
    if data.description is not None:
        project.description = data.description

    db.commit()
    db.refresh(project)
    return to_response(project, current_user.id)


@router.delete("/{project_id}", status_code=204)
def delete_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = get_project_or_404(project_id, db)
    if project.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the project owner can delete it")
    db.delete(project)
    db.commit()


# ─── Members ──────────────────────────────────────────────────────────────────

@router.get("/{project_id}/members", response_model=List[ProjectMemberResponse])
def get_members(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = get_project_or_404(project_id, db)
    require_access(project, current_user.id)

    result = [
        {
            "user_id": project.owner.id,
            "username": project.owner.username,
            "email": project.owner.email,
            "role": ProjectRole.ADMIN,
            "joined_at": project.created_at,
        }
    ]
    for m in project.members:
        result.append(
            {
                "user_id": m.user.id,
                "username": m.user.username,
                "email": m.user.email,
                "role": m.role,
                "joined_at": m.joined_at,
            }
        )
    return result


@router.post("/{project_id}/members", response_model=ProjectMemberResponse, status_code=201)
def add_member(
    project_id: int,
    data: ProjectMemberAdd,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = get_project_or_404(project_id, db)
    require_admin(project, current_user.id)

    if data.user_id == project.owner_id:
        raise HTTPException(status_code=400, detail="Cannot add the owner as a separate member")

    user = db.query(User).filter(User.id == data.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if db.query(ProjectMember).filter(
        ProjectMember.project_id == project_id, ProjectMember.user_id == data.user_id
    ).first():
        raise HTTPException(status_code=400, detail="User is already a member")

    member = ProjectMember(project_id=project_id, user_id=data.user_id, role=data.role)
    db.add(member)
    db.commit()
    db.refresh(member)
    return {"user_id": user.id, "username": user.username, "email": user.email, "role": member.role, "joined_at": member.joined_at}


@router.put("/{project_id}/members/{user_id}", response_model=ProjectMemberResponse)
def update_member_role(
    project_id: int,
    user_id: int,
    data: ProjectMemberUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = get_project_or_404(project_id, db)
    require_admin(project, current_user.id)

    member = db.query(ProjectMember).filter(
        ProjectMember.project_id == project_id, ProjectMember.user_id == user_id
    ).first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    member.role = data.role
    db.commit()
    db.refresh(member)
    return {"user_id": member.user.id, "username": member.user.username, "email": member.user.email, "role": member.role, "joined_at": member.joined_at}


@router.delete("/{project_id}/members/{user_id}", status_code=204)
def remove_member(
    project_id: int,
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = get_project_or_404(project_id, db)
    require_admin(project, current_user.id)

    if user_id == project.owner_id:
        raise HTTPException(status_code=400, detail="Cannot remove the project owner")

    member = db.query(ProjectMember).filter(
        ProjectMember.project_id == project_id, ProjectMember.user_id == user_id
    ).first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    db.delete(member)
    db.commit()
