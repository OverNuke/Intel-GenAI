"""Deterministic demo data. Pure and entirely fictional: no I/O, fixed tz-aware datetimes."""

from datetime import UTC, datetime, timedelta

from app.modules.auth.domain.user import User
from app.modules.tickets.domain.receipt import SUBMITTED_BY_PERSON, AriadnaReceipt
from app.modules.tickets.domain.ticket import (
    Impact,
    Priority,
    Ticket,
    TicketEvent,
    TicketStatus,
    Urgency,
)

ORGANIZATION = "Centro Administrativo Regional Sur"

USERS: tuple[User, ...] = (
    User(
        id="ana",
        display_name="Ana Ruiz",
        email="ana.ruiz@ejemplo.mx",
        role="user",
        area="Finanzas",
    ),
    User(
        id="luis",
        display_name="Luis Herrera",
        email="luis.herrera@ejemplo.mx",
        role="it",
        area="Mesa de ayuda",
    ),
    User(
        id="sara",
        display_name="Sara Molina",
        email="sara.molina@ejemplo.mx",
        role="supervisor",
        area="Supervisión",
    ),
)

_GROUP = "Soporte TI"


def _at(day: int, hour: int, minute: int = 0) -> datetime:
    return datetime(2026, 1, day, hour, minute, tzinfo=UTC)


def _ticket(
    number: int,
    *,
    summary: str,
    description: str,
    service: str,
    status: TicketStatus,
    priority: Priority,
    impact: Impact,
    urgency: Urgency,
    created_at: datetime,
    updated_after: timedelta,
    assignee_id: str | None = None,
    awaiting_user: bool = False,
    asset: str | None = None,
    via_ariadna: bool = False,
    sla_hours: int | None = None,
) -> Ticket:
    return Ticket(
        number=number,
        summary=summary,
        description=description,
        service=service,
        status=status,
        awaiting_user=awaiting_user,
        priority=priority,
        impact=impact,
        urgency=urgency,
        assigned_group=_GROUP,
        assignee_id=assignee_id,
        requester_id="ana",
        asset=asset,
        via_ariadna=via_ariadna,
        sla_due_at=created_at + timedelta(hours=sla_hours) if sla_hours is not None else None,
        created_at=created_at,
        updated_at=created_at + updated_after,
    )


TICKETS: tuple[Ticket, ...] = (
    _ticket(
        1053,
        summary="No abre la sesion en el equipo de la oficina 2",
        description="Al encender el equipo aparece un mensaje de perfil danado.",
        service="access",
        status="closed",
        priority="medium",
        impact="medium",
        urgency="medium",
        created_at=_at(5, 9),
        updated_after=timedelta(days=2),
        assignee_id="luis",
        asset="PC-0412",
        sla_hours=24,
    ),
    _ticket(
        1054,
        summary="Impresora del pasillo sin tinta",
        description="La impresora compartida marca error de cartucho desde la manana.",
        service="printing",
        status="resolved",
        priority="low",
        impact="low",
        urgency="low",
        created_at=_at(6, 10, 30),
        updated_after=timedelta(hours=20),
        assignee_id="luis",
        asset="IMP-0107",
        sla_hours=72,
    ),
    _ticket(
        1055,
        summary="Correo institucional no sincroniza en el celular",
        description="Dejo de llegar el correo al telefono desde el lunes.",
        service="email",
        status="in_progress",
        priority="medium",
        impact="low",
        urgency="medium",
        created_at=_at(7, 8, 15),
        updated_after=timedelta(hours=6),
        assignee_id="luis",
        via_ariadna=True,
        sla_hours=24,
    ),
    _ticket(
        1056,
        summary="Red lenta en toda el area de captura",
        description="Las paginas tardan mas de un minuto en cargar en el area de captura.",
        service="network",
        status="in_progress",
        priority="critical",
        impact="high",
        urgency="high",
        created_at=_at(8, 11),
        updated_after=timedelta(hours=3),
        assignee_id="luis",
        awaiting_user=True,
        sla_hours=4,
    ),
    _ticket(
        1057,
        summary="Solicitud de acceso a la carpeta compartida de finanzas",
        description="Necesito permisos de lectura para la carpeta de reportes mensuales.",
        service="access",
        status="assigned",
        priority="medium",
        impact="low",
        urgency="medium",
        created_at=_at(9, 9, 45),
        updated_after=timedelta(hours=1),
        assignee_id="luis",
        via_ariadna=True,
        sla_hours=48,
    ),
    _ticket(
        1058,
        summary="Monitor parpadea al conectarse",
        description="El monitor secundario parpadea cada pocos segundos.",
        service="hardware",
        status="new",
        priority="low",
        impact="low",
        urgency="low",
        created_at=_at(12, 14),
        updated_after=timedelta(minutes=5),
        asset="MON-0238",
        sla_hours=72,
    ),
    _ticket(
        1059,
        summary="Instalar el software de firma electronica",
        description="Se requiere instalar el programa de firma en un equipo nuevo.",
        service="software",
        status="new",
        priority="medium",
        impact="medium",
        urgency="low",
        created_at=_at(13, 16, 20),
        updated_after=timedelta(minutes=10),
        via_ariadna=True,
        sla_hours=48,
    ),
    _ticket(
        1060,
        summary="El telefono IP de recepcion no tiene tono",
        description="El telefono de recepcion no marca ni recibe llamadas.",
        service="hardware",
        status="assigned",
        priority="high",
        impact="medium",
        urgency="high",
        created_at=_at(14, 8),
        updated_after=timedelta(hours=2),
        assignee_id="luis",
        asset="TEL-0061",
        awaiting_user=False,
        sla_hours=8,
    ),
)


def _events() -> tuple[TicketEvent, ...]:
    """created for every ticket, assigned where assignee_id is set, one contact on 1056.

    Ids are "{number}-{seq}" and fixed, so a re-seed (ON CONFLICT DO NOTHING) adds nothing.
    """
    events: list[TicketEvent] = []
    for ticket in TICKETS:
        events.append(
            TicketEvent(
                id=f"{ticket.number}-1",
                ticket_number=ticket.number,
                kind="created",
                author_id=ticket.requester_id,
                body=None,
                visible_to_requester=True,
                created_at=ticket.created_at,
            )
        )
        if ticket.assignee_id is not None:
            events.append(
                TicketEvent(
                    id=f"{ticket.number}-2",
                    ticket_number=ticket.number,
                    kind="assigned",
                    author_id=ticket.assignee_id,
                    body=None,
                    visible_to_requester=True,
                    created_at=ticket.created_at + timedelta(minutes=30),
                )
            )
    pending = next(t for t in TICKETS if t.awaiting_user)
    events.append(
        TicketEvent(
            id=f"{pending.number}-3",
            ticket_number=pending.number,
            kind="contact_requested",
            author_id="luis",
            body="Confirma desde qué equipos de la sala de captura se ve lenta la red.",
            visible_to_requester=True,
            created_at=pending.created_at + timedelta(hours=2),
        )
    )
    return tuple(events)


EVENTS: tuple[TicketEvent, ...] = _events()

# Receipts of the tickets that went through Ariadna (via_ariadna), as submitted.
RECEIPTS: dict[int, AriadnaReceipt] = {
    1055: AriadnaReceipt(
        understood="El correo institucional dejó de llegar al celular desde el lunes.",
        reviewed=(
            "Datos obligatorios completos",
            "Destino sugerido: Soporte de cuentas y accesos",
            "Permisos: tu perfil puede pedir esto",
            "Adjuntos: ninguno (opcional)",
        ),
        not_done=(
            "No cambié ninguna configuración de tu cuenta.",
            SUBMITTED_BY_PERSON,
        ),
        permissions_notice=None,
        missing_data=(),
        target_group="Soporte de cuentas y accesos",
    ),
    1057: AriadnaReceipt(
        understood="Necesitas permisos de lectura para la carpeta de reportes mensuales.",
        reviewed=(
            "Datos obligatorios completos",
            "Destino sugerido: Soporte de cuentas y accesos",
            "Permisos: tu perfil puede pedir esto",
            "Adjuntos: ninguno (opcional)",
        ),
        not_done=("No otorgué ningún permiso.", SUBMITTED_BY_PERSON),
        permissions_notice=None,
        missing_data=(),
        target_group="Soporte de cuentas y accesos",
    ),
    1059: AriadnaReceipt(
        understood="Hay que instalar el programa de firma electrónica en un equipo nuevo.",
        reviewed=(
            "Datos obligatorios completos",
            "Destino sugerido: Soporte de software",
            "Permisos: falta la autorización de tu jefe o encargado, anotado",
            "Adjuntos: ninguno (opcional)",
        ),
        not_done=("No pude dar ni saltar la autorización de tu jefe.", SUBMITTED_BY_PERSON),
        permissions_notice="Instalar programas necesita la autorización de tu jefe o encargado.",
        missing_data=("Autorización del jefe o encargado",),
        target_group="Soporte de software",
    ),
}
