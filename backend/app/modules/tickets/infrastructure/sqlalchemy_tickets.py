from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
from sqlalchemy.orm import aliased
from sqlalchemy.sql import Select

from app.modules.auth.infrastructure.models import UserRow
from app.modules.tickets.domain.new_ticket import NewTicket
from app.modules.tickets.domain.receipt import AriadnaReceipt, receipt_from_json, receipt_to_json
from app.modules.tickets.domain.ticket import (
    Ticket,
    TicketEvent,
    TicketRecord,
    TicketView,
)
from app.modules.tickets.infrastructure.models import TicketEventRow, TicketRow


def to_ticket(row: TicketRow) -> Ticket:
    """Rows are guarded by CHECK constraints, so the string columns are valid Literals."""
    return Ticket(
        number=row.number,
        summary=row.summary,
        description=row.description,
        service=row.service,
        status=row.status,  # type: ignore[arg-type]
        awaiting_user=row.awaiting_user,
        priority=row.priority,  # type: ignore[arg-type]
        impact=row.impact,  # type: ignore[arg-type]
        urgency=row.urgency,  # type: ignore[arg-type]
        assigned_group=row.assigned_group,
        assignee_id=row.assignee_id,
        requester_id=row.requester_id,
        asset=row.asset,
        via_ariadna=row.via_ariadna,
        sla_due_at=row.sla_due_at,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def to_event(row: TicketEventRow) -> TicketEvent:
    return TicketEvent(
        id=row.id,
        ticket_number=row.ticket_number,
        kind=row.kind,  # type: ignore[arg-type]  # guarded by ck_ticket_events_kind
        author_id=row.author_id,
        body=row.body,
        visible_to_requester=row.visible_to_requester,
        created_at=row.created_at,
    )


def to_receipt(row: TicketRow) -> AriadnaReceipt | None:
    return receipt_from_json(row.ariadna_receipt) if row.ariadna_receipt else None


def _with_names() -> Select[TicketRow, str, str]:
    requester = aliased(UserRow)
    assignee = aliased(UserRow)
    return (
        select(TicketRow, requester.display_name, assignee.display_name)
        .join(requester, requester.id == TicketRow.requester_id)
        .outerjoin(assignee, assignee.id == TicketRow.assignee_id)
    )


class SqlAlchemyTicketRepository:
    """TicketRepository over Postgres. One short session per call (serverless, NullPool)."""

    def __init__(self, sessions: async_sessionmaker[AsyncSession]) -> None:
        self._sessions = sessions

    async def list_by_requester(self, requester_id: str) -> list[TicketView]:
        stmt = (
            _with_names()
            .where(TicketRow.requester_id == requester_id)
            .order_by(TicketRow.created_at.desc(), TicketRow.number.desc())
        )
        async with self._sessions() as session:
            rows = (await session.execute(stmt)).all()
        return [TicketView(to_ticket(t), requester, assignee) for t, requester, assignee in rows]

    async def list_all(self) -> list[TicketView]:
        stmt = _with_names().order_by(TicketRow.created_at.desc(), TicketRow.number.desc())
        async with self._sessions() as session:
            rows = (await session.execute(stmt)).all()
        return [TicketView(to_ticket(t), requester, assignee) for t, requester, assignee in rows]

    async def get(self, number: int) -> TicketRecord | None:
        stmt = _with_names().where(TicketRow.number == number)
        events_stmt = (
            select(TicketEventRow)
            .where(TicketEventRow.ticket_number == number)
            .order_by(TicketEventRow.created_at, TicketEventRow.id)
        )
        async with self._sessions() as session:
            row = (await session.execute(stmt)).first()
            if row is None:
                return None
            events = (await session.scalars(events_stmt)).all()
            ticket_row, requester, assignee = row
            wanted = {ticket_row.requester_id, ticket_row.assignee_id}
            wanted |= {e.author_id for e in events}
            wanted.discard(None)
            names = (
                await session.execute(
                    select(UserRow.id, UserRow.display_name).where(UserRow.id.in_(wanted))
                )
            ).all()
        return TicketRecord(
            view=TicketView(to_ticket(ticket_row), requester, assignee),
            events=tuple(to_event(e) for e in events),
            receipt=to_receipt(ticket_row),
            people={user_id: name for user_id, name in names},
        )

    async def find_by_submission_key(self, key: str) -> TicketRecord | None:
        async with self._sessions() as session:
            number = await session.scalar(
                select(TicketRow.number).where(TicketRow.submission_key == key)
            )
        return await self.get(number) if number is not None else None

    async def create(self, new: NewTicket, receipt: AriadnaReceipt | None) -> TicketRecord:
        """One transaction: ticket (number from ticket_number_seq) + its "created" event.

        A concurrent duplicate of the same submission key loses on the unique constraint and
        gets the winner's ticket back, so double activation never creates two tickets.
        """
        row = TicketRow(
            summary=new.summary,
            description=new.description,
            service=new.service,
            status="new",
            awaiting_user=False,
            priority=new.priority,
            impact=new.impact,
            urgency=new.urgency,
            assigned_group=new.assigned_group,
            assignee_id=None,
            requester_id=new.requester_id,
            asset=None,
            via_ariadna=new.via_ariadna,
            sla_due_at=new.sla_due_at,
            created_at=new.created_at,
            updated_at=new.created_at,
            ariadna_receipt=receipt_to_json(receipt) if receipt else None,
            submission_key=new.submission_key,
        )
        try:
            async with self._sessions() as session, session.begin():
                session.add(row)
                await session.flush()  # allocates the number (server-side nextval)
                session.add(
                    TicketEventRow(
                        id=f"{row.number}-1",
                        ticket_number=row.number,
                        kind="created",
                        author_id=new.requester_id,
                        body=None,
                        visible_to_requester=True,
                        created_at=new.created_at,
                    )
                )
                number = row.number
        except IntegrityError:
            existing = await self.find_by_submission_key(new.submission_key or "")
            if existing is None:
                raise
            return existing
        record = await self.get(number)
        assert record is not None
        return record

    async def request_contact(
        self, number: int, by: str, message: str | None, at: datetime
    ) -> TicketRecord | None:
        """One transaction: flag the ticket Pendiente (status untouched) and log the contact."""
        async with self._sessions() as session, session.begin():
            row = await session.get(TicketRow, number, with_for_update=True)
            if row is None:
                return None
            existing = await session.scalar(
                select(func.count())
                .select_from(TicketEventRow)
                .where(TicketEventRow.ticket_number == number)
            )
            row.awaiting_user = True
            row.updated_at = at
            session.add(
                TicketEventRow(
                    id=f"{number}-{(existing or 0) + 1}",
                    ticket_number=number,
                    kind="contact_requested",
                    author_id=by,
                    body=message,
                    visible_to_requester=True,
                    created_at=at,
                )
            )
        return await self.get(number)
