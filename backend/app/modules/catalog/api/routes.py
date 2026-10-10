from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException

from app.modules.auth.api.deps import require_section
from app.modules.auth.api.schemas import AccessDenied, ErrorBody
from app.modules.auth.domain.user import User
from app.modules.catalog.api.schemas import ServiceOut, service_out
from app.modules.catalog.domain.services import SERVICES, get_service

router = APIRouter(prefix="/catalog", tags=["catalog"])

CatalogUser = Annotated[User, Depends(require_section("new-request"))]

_AUTH_ERRORS: dict[int | str, dict[str, Any]] = {
    401: {"model": ErrorBody},
    403: {"model": AccessDenied},
}


@router.get("/services", response_model=list[ServiceOut], responses=_AUTH_ERRORS)
async def list_services(_: CatalogUser) -> list[ServiceOut]:
    return [service_out(service) for service in SERVICES]


@router.get(
    "/services/{key}",
    response_model=ServiceOut,
    responses={**_AUTH_ERRORS, 404: {"model": ErrorBody}},
)
async def read_service(key: str, _: CatalogUser) -> ServiceOut:
    service = get_service(key)
    if service is None:
        raise HTTPException(status_code=404, detail="No encontramos ese servicio.")
    return service_out(service)
