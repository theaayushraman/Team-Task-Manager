from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from ..database import get_db
from ..models import User, Project, ProjectMember, Task, TaskStatus
from ..schemas import DashboardResponse, DashboardStats
from ..dependencies import get_current_user
from .tasks import task_to_response

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/", response_model=DashboardResponse)
def get_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    owned_ids = [p.id for p in db.query(Project).filter(Project.owner_id == current_user.id).all()]
    member_ids = [
        m.project_id
        for m in db.query(ProjectMember).filter(ProjectMember.user_id == current_user.id).all()
    ]
    all_project_ids = list(set(owned_ids + member_ids))

    all_tasks = db.query(Task).filter(Task.project_id.in_(all_project_ids)).all() if all_project_ids else []
    now = datetime.now(timezone.utc)

    def is_overdue(t: Task) -> bool:
        if not t.due_date or t.status == TaskStatus.DONE:
            return False
        due = t.due_date if t.due_date.tzinfo else t.due_date.replace(tzinfo=timezone.utc)
        return due < now

    stats = DashboardStats(
        total_projects=len(all_project_ids),
        total_tasks=len(all_tasks),
        todo_tasks=sum(1 for t in all_tasks if t.status == TaskStatus.TODO),
        in_progress_tasks=sum(1 for t in all_tasks if t.status == TaskStatus.IN_PROGRESS),
        completed_tasks=sum(1 for t in all_tasks if t.status == TaskStatus.DONE),
        overdue_tasks=sum(1 for t in all_tasks if is_overdue(t)),
    )

    recent = sorted(all_tasks, key=lambda t: t.created_at, reverse=True)[:5]
    my_tasks = [t for t in all_tasks if t.assignee_id == current_user.id and t.status != TaskStatus.DONE][:10]

    return DashboardResponse(
        stats=stats,
        recent_tasks=[task_to_response(t) for t in recent],
        my_tasks=[task_to_response(t) for t in my_tasks],
    )
