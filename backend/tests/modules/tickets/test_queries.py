from app.modules.auth.domain.user import User
from app.modules.tickets.application.queries import get_for_viewer, list_mine
from app.seed.data import USERS
from tests.modules.tickets.fakes import InMemoryTicketRepository

ANA, LUIS, SARA = USERS


async def test_list_mine_returns_only_the_requesters_tickets_newest_first() -> None:
    views = await list_mine(InMemoryTicketRepository(), "ana")
    numbers = [v.ticket.number for v in views]
    assert numbers == [1060, 1059, 1058, 1057, 1056, 1055, 1054, 1053]
    assert {v.ticket.requester_id for v in views} == {"ana"}


async def test_list_mine_is_empty_for_a_user_with_no_tickets() -> None:
    assert await list_mine(InMemoryTicketRepository(), "luis") == []


async def test_get_for_viewer_returns_the_record_for_the_owner() -> None:
    record = await get_for_viewer(InMemoryTicketRepository(), ANA, "INC0001056")
    assert record is not None
    assert record.view.ticket.number == 1056
    assert record.view.assignee_name == "Luis Herrera"


async def test_get_for_viewer_hides_other_requesters_tickets_as_none() -> None:
    assert await get_for_viewer(InMemoryTicketRepository(), SARA, "INC0001056") is None
    # IT does not get Ana's tickets through the user API either (REQ-UT-1).
    assert await get_for_viewer(InMemoryTicketRepository(), LUIS, "INC0001056") is None


async def test_get_for_viewer_unknown_or_malformed_id_is_none() -> None:
    repo = InMemoryTicketRepository()
    assert await get_for_viewer(repo, ANA, "INC0009999") is None
    assert await get_for_viewer(repo, ANA, "1056") is None


async def test_get_for_viewer_never_reads_the_repo_for_a_malformed_id() -> None:
    class Exploding:
        async def get(self, number: int) -> None:
            raise AssertionError("repo must not be called")

    user = User(id="ana", display_name="Ana", email="a@x", role="user", area="F")
    assert await get_for_viewer(Exploding(), user, "nope") is None  # type: ignore[arg-type]
