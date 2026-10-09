"""Authorization policy: the single source of who may open which section.

Backend guards and the "Sin acceso" payload both read this map; the frontend never repeats it.
"""

from dataclasses import dataclass
from typing import Literal

from app.modules.auth.domain.user import Role

SectionId = Literal[
    "home",
    "my-tickets",
    "new-request",
    "my-team",
    "ticket-tracking",
    "registry",
    "closure",
    "agent-tracking",
]

ROLE_LABELS: dict[Role, str] = {"user": "Usuario", "it": "TI", "supervisor": "Supervisor"}

_ALL_ROLES: frozenset[Role] = frozenset(ROLE_LABELS)


@dataclass(frozen=True)
class Section:
    label: str
    allowed_roles: frozenset[Role]
    # Role named on the denial; None means every role is allowed.
    required_role: Role | None = None


def _restricted(label: str, role: Role) -> Section:
    return Section(label=label, allowed_roles=frozenset({role}), required_role=role)


# Keyed by str (not SectionId) so lookups accept any caller-supplied key; see SectionId.
SECTIONS: dict[str, Section] = {
    "home": Section("Inicio", _ALL_ROLES),
    "my-tickets": Section("Mis tickets", _ALL_ROLES),
    "new-request": Section("¿Qué necesitas?", _ALL_ROLES),
    "my-team": Section("Mi equipo", _ALL_ROLES),
    "ticket-tracking": _restricted("Seguimiento de tickets", "it"),
    "registry": _restricted("Registro", "it"),
    "closure": _restricted("Cierre", "it"),
    "agent-tracking": _restricted("Seguimiento del agente", "supervisor"),
}

@dataclass(frozen=True)
class Allowed:
    pass


@dataclass(frozen=True)
class Denied:
    section: str
    # None when the section is unknown: nobody holds a role that opens it.
    required_role: Role | None


def authorize(role: Role, section: str) -> Allowed | Denied:
    """Fail closed: a key outside SECTIONS is denied, never an error."""
    rule = SECTIONS.get(section)
    if rule is None:
        return Denied(section=section, required_role=None)
    if role in rule.allowed_roles:
        return Allowed()
    return Denied(section=section, required_role=rule.required_role)
