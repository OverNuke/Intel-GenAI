"""Agent metrics for S1: STATIC SAMPLE data (ADR-0006), no DB and no live computation.

Measured and estimated are deliberately unrelated types (no shared base, no union): an estimate
can never be rendered as a result. Estimates always carry the "not measured" wording.
"""

from dataclasses import dataclass
from typing import Literal

ESTIMATES_LABEL = "Estimaciones, no son resultados medidos"
ESTIMATE_DISCLAIMER = "no son resultados medidos"

Period = Literal[7, 30]
PERIODS: tuple[Period, ...] = (7, 30)


@dataclass(frozen=True)
class MeasuredMetric:
    """Something Ariadna's usage actually recorded (sample values here)."""

    key: str
    label: str
    value: float
    unit: Literal["count", "percent"]
    description: str


@dataclass(frozen=True)
class EstimatedMetric:
    """A study-based estimate: always shown with its basis and the not-measured wording."""

    key: str
    label: str
    value: float
    unit: Literal["minutes", "score", "mxn"]
    basis: str


@dataclass(frozen=True)
class TrendPoint:
    day: int  # 1 = oldest day of the period
    adoption: float  # % of tickets prepared with Ariadna
    corrected: float  # % of tickets that needed a correction


@dataclass(frozen=True)
class AgentReport:
    period: Period
    measured: tuple[MeasuredMetric, ...]
    estimated: tuple[EstimatedMetric, ...]
    trend: tuple[TrendPoint, ...]


# (returned for wrong data, passed to IT, missing data detected) per period; sample values.
_MEASURED: dict[int, tuple[float, float, float]] = {7: (5, 8, 19), 30: (21, 34, 77)}
_GUIDED_TICKETS: dict[int, int] = {7: 15, 30: 60}
_MINUTES_SAVED = 28
_HOURLY_RATE_MXN = 150


def _trend(period: int) -> tuple[TrendPoint, ...]:
    points: list[TrendPoint] = []
    last = max(period - 1, 1)
    for index in range(period):
        progress = index / last
        wiggle = (index * 7) % 5 - 2  # deterministic noise in [-2, 2]
        adoption = 52 + 16 * progress + wiggle * 0.5
        corrected = 22 - 10 * progress - wiggle * 0.5
        points.append(
            TrendPoint(
                day=index + 1,
                adoption=round(min(max(adoption, 0), 100), 1),
                corrected=round(min(max(corrected, 0), 100), 1),
            )
        )
    return tuple(points)


def agent_report(period: int) -> AgentReport:
    """Sample report for 7 or 30 days; any other period is a ValueError (the API answers 422)."""
    if period not in _MEASURED:
        raise ValueError(f"period must be one of {PERIODS}")
    returned, passed, missing = _MEASURED[period]
    guided = _GUIDED_TICKETS[period]
    savings = guided * _MINUTES_SAVED / 60 * _HOURLY_RATE_MXN
    return AgentReport(
        period=7 if period == 7 else 30,
        measured=(
            MeasuredMetric(
                "returned_wrong_data",
                "Devueltos al usuario por datos incorrectos",
                returned,
                "count",
                "Es lo que Ariadna busca bajar.",
            ),
            MeasuredMetric(
                "passed_to_it",
                "Pasados a TI desde la conversación",
                passed,
                "count",
                "Solicitudes que la persona pasó con TI.",
            ),
            MeasuredMetric(
                "missing_data_detected",
                "Datos faltantes detectados antes de enviar",
                missing,
                "count",
                "Datos que Ariadna pidió antes de que se enviara el ticket.",
            ),
        ),
        estimated=(
            EstimatedMetric(
                "time_saved",
                "Tiempo ahorrado (estimado)",
                _MINUTES_SAVED,
                "minutes",
                "Por ticket, según el estudio de una organización.",
            ),
            EstimatedMetric(
                "satisfaction",
                "Satisfacción (estimada)",
                4.4,
                "score",
                "De 5, a partir de encuestas de ejemplo.",
            ),
            EstimatedMetric(
                "savings",
                "Ahorro estimado",
                savings,
                "mxn",
                f"{guided} tickets guiados × {_MINUTES_SAVED} min × ${_HOURLY_RATE_MXN}/h",
            ),
        ),
        trend=_trend(period),
    )
