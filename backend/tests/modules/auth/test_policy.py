import pytest

from app.modules.auth.domain.policy import ROLE_LABELS, SECTIONS, Allowed, Denied, authorize
from app.modules.auth.domain.user import Role

ROLES: tuple[Role, ...] = ("user", "it", "supervisor")
SHARED = ("home", "my-tickets", "new-request", "my-team")
IT_ONLY = ("ticket-tracking", "registry", "closure")
SUPERVISOR_ONLY = ("agent-tracking",)


def test_exactly_the_eight_section_keys_exist() -> None:
    assert set(SECTIONS) == {*SHARED, *IT_ONLY, *SUPERVISOR_ONLY}
    assert len(SECTIONS) == 8


@pytest.mark.parametrize("role", ROLES)
@pytest.mark.parametrize("section", SHARED)
def test_shared_sections_are_allowed_for_every_role(role: Role, section: str) -> None:
    assert authorize(role, section) == Allowed()


def test_it_is_allowed_into_tracking_registry_and_closure() -> None:
    for section in IT_ONLY:
        assert authorize("it", section) == Allowed()


@pytest.mark.parametrize("role", ["user", "supervisor"])
@pytest.mark.parametrize("section", IT_ONLY)
def test_non_it_roles_are_denied_it_sections_naming_it(role: Role, section: str) -> None:
    assert authorize(role, section) == Denied(section=section, required_role="it")


@pytest.mark.parametrize("role", ["user", "it"])
def test_agent_tracking_is_denied_unless_supervisor(role: Role) -> None:
    assert authorize(role, "agent-tracking") == Denied(
        section="agent-tracking", required_role="supervisor"
    )


def test_supervisor_is_allowed_into_agent_tracking() -> None:
    assert authorize("supervisor", "agent-tracking") == Allowed()


@pytest.mark.parametrize("role", ROLES)
@pytest.mark.parametrize("section", ["nonexistent", "", "HOME", "home ", "../registry"])
def test_unknown_section_is_denied_fail_closed(role: Role, section: str) -> None:
    result = authorize(role, section)
    assert result == Denied(section=section, required_role=None)


def test_display_labels_come_from_the_policy() -> None:
    assert SECTIONS["ticket-tracking"].label == "Seguimiento de tickets"
    assert SECTIONS["agent-tracking"].label == "Seguimiento del agente"
    assert SECTIONS["new-request"].label == "¿Qué necesitas?"


def test_role_labels_are_es_mx() -> None:
    assert ROLE_LABELS == {"user": "Usuario", "it": "TI", "supervisor": "Supervisor"}
