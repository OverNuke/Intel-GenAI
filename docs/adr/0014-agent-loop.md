# ADR-0014: Bounded read-only agent loop behind the AssistantPort

Status: accepted (2026-10-11). Amends ADR-0002.

## Context
ADR-0002 shipped Ariadna as a stateless, one-call assistant: it cannot look anything up, so "Lo que revisé" is model prose and cannot be trusted as evidence. The product asks for more: check the catalog and the person's own tickets, find participants by name, verify permissions, and fill most of the form from one sentence. At the same time the assistant must stay unable to write (ADR-0003) and must see minimal data (ADR-0008).

## Decision
- **Bounded loop.** In `agent` mode the OpenAI-compatible adapter offers `tools`, executes the tool calls the model returns, feeds the results back, and requires the final JSON turn. At most **4 tool steps** per turn; after the 4th the final request offers no tools.
- **Read-only tools only.** `search_catalog`, `check_required_data`, `find_similar_tickets` (the requester's own tickets, max 3), `find_user` (display names only) and `check_permissions`. They are plain application functions over narrow read-only ports (`RequesterTickets`, `UserLookup`); none can submit, create, update or close anything. `AssistantPort` still exposes only `next_turn`; the guard tests stay unchanged.
- **Propose and confirm.** Writes exist only as `proposals` (value objects) inside the turn. The person confirms each one and the tickets endpoints perform the write with identity taken from the session (ADR-0003, amended in the same change).
- **Identity stays server-side.** The requester id lives in a per-request `ToolContext` bound by the route; it is not in `Conversation`, the prompt, tool arguments or tool results. Tool results carry display names and display ticket ids, never user ids or emails.
- **Evidence trail.** The turn carries `steps` (tool name, summary up to 200 characters, ok/failed). When steps exist, `reviewed` is derived from the successful ones; model-supplied `steps` are discarded. Blocking flags and `ready` remain the domain's call (`enforce_domain_flags`).
- **Fallbacks, never a dead end.** Endpoint rejects `tools` (HTTP 400/422/501) or the model asks for more than 4 steps: answer with the single-shot path. A failing, unknown or badly called tool is recorded as a failed step and the loop continues. 429, timeout and connection errors raise `AssistantUnavailable` as before (handoff, draft kept). The SDK keeps `max_retries=0`; the only retry is the existing one for invalid JSON.
- **Mode flag.** `ASSISTANT_MODE=single|agent`, default `single`; any other value means `single`. In `single` mode behavior is exactly the ADR-0002 behavior. The fake adapter runs the same registry in `agent` mode with a scripted, deterministic trail so CI exercises the loop without a model.
- **JSON mode and tools are not combined.** Tool-enabled requests omit `response_format` because some free-tier endpoints reject both together; the final answer is validated by the same Pydantic schema, and an invalid answer gets one retry with tools off and JSON mode on.

## Consequences
- "Lo que revisé" becomes evidence-backed instead of model prose.
- Cost and latency grow with each step (up to 5 calls per turn); the flag lets the demo stay on `single`.
- **Risk:** many free-tier models have weak or no tool calling. The loop may be wasted on them, which is why every failure path degrades to single-shot and the default is `single`. Real-model quality still needs evals (deferred).
- Ticket summaries of the requester's own tickets reach the LLM provider when `find_similar_tickets` runs; this is the same data class already allowed for ticket-help entries (ADR-0008).
- Participant names are resolved against demo accounts only; ambiguous or unknown names become warning flags, never guessed entries.
