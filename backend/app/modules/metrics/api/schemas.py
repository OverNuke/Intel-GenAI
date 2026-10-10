from typing import Literal

from pydantic import BaseModel

from app.modules.metrics.domain.metrics import (
    ESTIMATE_DISCLAIMER,
    ESTIMATES_LABEL,
    AgentReport,
    Period,
)


class MeasuredMetricOut(BaseModel):
    kind: Literal["measured"] = "measured"
    key: str
    label: str
    value: float
    unit: Literal["count", "percent"]
    description: str


class EstimatedMetricOut(BaseModel):
    kind: Literal["estimated"] = "estimated"
    key: str
    label: str
    value: float
    unit: Literal["minutes", "score", "mxn"]
    basis: str
    disclaimer: str = ESTIMATE_DISCLAIMER


class EstimatedBlockOut(BaseModel):
    """Estimates live in their own block, always labelled."""

    label: str = ESTIMATES_LABEL
    metrics: list[EstimatedMetricOut]


class TrendPointOut(BaseModel):
    day: int
    adoption: float
    corrected: float


class AgentMetricsOut(BaseModel):
    period: Period
    sample: Literal[True] = True  # static data: the UI says "Datos de ejemplo"
    measured: list[MeasuredMetricOut]
    estimated: EstimatedBlockOut
    trend: list[TrendPointOut]


def report_out(report: AgentReport) -> AgentMetricsOut:
    return AgentMetricsOut(
        period=report.period,
        measured=[
            MeasuredMetricOut(
                key=m.key, label=m.label, value=m.value, unit=m.unit, description=m.description
            )
            for m in report.measured
        ],
        estimated=EstimatedBlockOut(
            metrics=[
                EstimatedMetricOut(
                    key=e.key, label=e.label, value=e.value, unit=e.unit, basis=e.basis
                )
                for e in report.estimated
            ]
        ),
        trend=[
            TrendPointOut(day=p.day, adoption=p.adoption, corrected=p.corrected)
            for p in report.trend
        ],
    )
