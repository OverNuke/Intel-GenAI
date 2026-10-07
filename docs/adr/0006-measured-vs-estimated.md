# ADR-0006: Metrics: measured and estimated are distinct types

Status: accepted (2026-10-07)

## Context
S1 explicitly separates measured data from estimates ("no son resultados medidos").

## Decision
`MeasuredMetric` and `EstimatedMetric` are different Pydantic types in `backend/app/modules/metrics/domain`; UI components for each are separate and the estimated one always renders its label.

## Consequences
Prevents presenting assumptions as results.
