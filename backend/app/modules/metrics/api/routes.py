from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query

from app.modules.auth.api.deps import require_section
from app.modules.auth.api.schemas import AccessDenied, ErrorBody
from app.modules.auth.domain.user import User
from app.modules.metrics.api.schemas import AgentMetricsOut, report_out
from app.modules.metrics.domain.metrics import PERIODS, agent_report

router = APIRouter(prefix="/metrics", tags=["metrics"])

SupervisorUser = Annotated[User, Depends(require_section("agent-tracking"))]

_AUTH_ERRORS: dict[int | str, dict[str, Any]] = {
    401: {"model": ErrorBody},
    403: {"model": AccessDenied},
}


@router.get("/agent", response_model=AgentMetricsOut, responses=_AUTH_ERRORS)
async def get_agent_metrics(
    _: SupervisorUser,
    period: Annotated[int, Query(json_schema_extra={"enum": list(PERIODS)})] = 7,
) -> AgentMetricsOut:
    """Static sample metrics (7 or 30 days). Supervisor only; any other period is a 422."""
    if period not in PERIODS:
        raise HTTPException(status_code=422, detail="El periodo debe ser 7 o 30 días.")
    return report_out(agent_report(period))
