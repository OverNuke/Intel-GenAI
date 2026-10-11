from dataclasses import fields

import pytest

from app.modules.metrics.domain.metrics import (
    ESTIMATE_DISCLAIMER,
    ESTIMATES_LABEL,
    EstimatedMetric,
    MeasuredMetric,
    agent_report,
)


def test_measured_and_estimated_are_unrelated_types() -> None:
    """S-AM-6: nothing lets a measured value pass as an estimate (no shared base, no union)."""
    assert not issubclass(MeasuredMetric, EstimatedMetric)
    assert not issubclass(EstimatedMetric, MeasuredMetric)
    assert MeasuredMetric.__mro__[1:] == (object,)
    assert EstimatedMetric.__mro__[1:] == (object,)
    assert {f.name for f in fields(EstimatedMetric)} - {f.name for f in fields(MeasuredMetric)} >= {
        "basis"
    }


@pytest.mark.parametrize("period", [7, 30])
def test_trend_has_one_point_per_day_of_the_period(period: int) -> None:
    report = agent_report(period)
    assert report.period == period
    assert [p.day for p in report.trend] == list(range(1, period + 1))
    assert all(0 <= p.adoption <= 100 and 0 <= p.corrected <= 100 for p in report.trend)


def test_the_two_periods_have_different_figures() -> None:
    week, month = agent_report(7), agent_report(30)
    assert [m.value for m in week.measured] != [m.value for m in month.measured]
    assert [m.key for m in week.measured] == [m.key for m in month.measured]


def test_measured_block_lists_the_three_process_quality_metrics() -> None:
    keys = [m.key for m in agent_report(7).measured]
    assert keys == ["returned_wrong_data", "passed_to_it", "missing_data_detected"]
    assert all(m.value >= 0 for m in agent_report(7).measured)


def test_every_estimate_carries_the_not_measured_disclaimer_and_a_basis() -> None:
    report = agent_report(7)
    assert ESTIMATES_LABEL == "Estimaciones, no son resultados medidos"
    assert ESTIMATE_DISCLAIMER == "no son resultados medidos"
    assert len(report.estimated) == 3
    assert all(e.basis.strip() for e in report.estimated)
    assert [e.key for e in report.estimated] == ["time_saved", "satisfaction", "savings"]


def test_unknown_period_is_rejected() -> None:
    with pytest.raises(ValueError):
        agent_report(14)
