import pytest

from app.modules.catalog.domain.services import (
    FALLBACK_SERVICE_LABEL,
    SERVICES,
    get_service,
    service_label,
)
from app.seed.data import TICKETS


def test_catalog_has_exactly_six_services_with_the_documented_keys() -> None:
    assert [s.key for s in SERVICES] == [
        "access",
        "printing",
        "email",
        "network",
        "hardware",
        "software",
    ]


def test_every_service_carries_the_u4_card_content() -> None:
    for service in SERVICES:
        assert service.label.strip()
        assert service.description.strip()
        assert len(service.examples) >= 2
        assert len(service.have_at_hand) >= 1
        assert service.handled_by.strip()


def test_catalog_keys_cover_every_seeded_ticket_service() -> None:
    catalog_keys = {s.key for s in SERVICES}
    assert {t.service for t in TICKETS} <= catalog_keys


def test_only_software_requires_manager_authorization() -> None:
    flagged = [s.key for s in SERVICES if s.requires_manager_authorization]
    assert flagged == ["software"]


def test_get_service_returns_the_service_or_none() -> None:
    printing = get_service("printing")
    assert printing is not None
    assert printing.label == "Impresión"
    assert get_service("unknown-x") is None


@pytest.mark.parametrize(
    ("key", "label"),
    [("network", "Red e internet"), ("unknown-x", FALLBACK_SERVICE_LABEL)],
)
def test_service_label_falls_back_for_unknown_keys(key: str, label: str) -> None:
    assert service_label(key) == label
