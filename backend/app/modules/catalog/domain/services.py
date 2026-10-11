"""The six service-catalog entries (U4). Static domain data: no DB, copy from the mock."""

from dataclasses import dataclass

FALLBACK_SERVICE_LABEL = "Otra cosa"


@dataclass(frozen=True)
class Service:
    key: str
    label: str
    description: str
    examples: tuple[str, ...]
    have_at_hand: tuple[str, ...]
    handled_by: str
    requires_manager_authorization: bool = False


SERVICES: tuple[Service, ...] = (
    Service(
        key="access",
        label="Cuenta y acceso",
        description="Contraseñas, usuarios y permisos",
        examples=(
            "Olvidé mi contraseña",
            "Necesito acceso a una carpeta",
            "Mi cuenta está bloqueada",
        ),
        have_at_hand=("Tu usuario y el nombre de la carpeta o del sistema.",),
        handled_by="Soporte de cuentas y accesos",
    ),
    Service(
        key="printing",
        label="Impresión",
        description="Impresoras y escáneres",
        examples=("La impresora no imprime", "Se atora el papel", "El escáner no envía"),
        have_at_hand=("El piso o el nombre de la impresora.",),
        handled_by="Soporte de impresión",
    ),
    Service(
        key="email",
        label="Correo electrónico",
        description="Buzón, sincronización y mensajes",
        examples=(
            "El correo no sincroniza en el celular",
            "No puedo enviar mensajes",
            "Mi buzón está lleno",
        ),
        have_at_hand=("Tu cuenta de correo y el dispositivo donde falla.",),
        handled_by="Soporte de cuentas y accesos",
    ),
    Service(
        key="network",
        label="Red e internet",
        description="Wi-Fi, VPN y conexión",
        examples=("No conecta la VPN", "El Wi-Fi está lento", "No tengo internet"),
        have_at_hand=("Dónde estás: en la oficina o en casa.",),
        handled_by="Soporte de redes",
    ),
    Service(
        key="hardware",
        label="Equipo de cómputo",
        description="Laptop, monitor y periféricos",
        examples=(
            "La laptop no enciende",
            "El monitor parpadea",
            "Necesito un mouse o un teclado",
        ),
        have_at_hand=("El número de inventario del equipo (empieza con AT-).",),
        handled_by="Soporte a equipos de cómputo",
    ),
    Service(
        key="software",
        label="Software",
        description="Instalar o actualizar programas",
        examples=(
            "Instalar un programa",
            "Actualizar a una versión nueva",
            "Un programa se cierra solo",
        ),
        have_at_hand=("El nombre del programa y para qué lo necesitas.",),
        handled_by="Soporte de software",
        requires_manager_authorization=True,
    ),
)

_BY_KEY = {service.key: service for service in SERVICES}


def get_service(key: str) -> Service | None:
    return _BY_KEY.get(key)


def service_label(key: str) -> str:
    """Label for a ticket's service key; an unknown key never raises (REQ-SC-3)."""
    service = _BY_KEY.get(key)
    return service.label if service else FALLBACK_SERVICE_LABEL
