from pydantic import BaseModel

from app.modules.catalog.domain.services import Service


class ServiceOut(BaseModel):
    key: str
    label: str
    description: str
    examples: list[str]
    have_at_hand: list[str]
    handled_by: str
    requires_manager_authorization: bool


def service_out(service: Service) -> ServiceOut:
    return ServiceOut(
        key=service.key,
        label=service.label,
        description=service.description,
        examples=list(service.examples),
        have_at_hand=list(service.have_at_hand),
        handled_by=service.handled_by,
        requires_manager_authorization=service.requires_manager_authorization,
    )
