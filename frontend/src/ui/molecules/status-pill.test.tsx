// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { COPY } from "@/lib/copy";
import { StatusPill } from "./status-pill";

afterEach(cleanup);

describe("StatusPill", () => {
  it("shows the status text and its icon (S-VF-1)", () => {
    const { container } = render(<StatusPill status="in_progress" labels={COPY.it.statuses} />);
    const pill = screen.getByText("En curso");
    expect(pill.querySelector('[data-icon="wrench"]')).not.toBeNull();
    expect(container.querySelectorAll(".pill")).toHaveLength(1);
  });

  it("uses the user wording and a different icon for another status", () => {
    render(<StatusPill status="resolved" />);
    const pill = screen.getByText("Resuelto");
    expect(pill.querySelector('[data-icon="circle-check"]')).not.toBeNull();
  });

  it("gives every status a non-empty text and icon (S-VF-2)", () => {
    for (const status of ["new", "assigned", "in_progress", "resolved", "closed"] as const) {
      const { container, unmount } = render(<StatusPill status={status} />);
      const pill = container.querySelector(".pill");
      expect(pill?.textContent?.trim().length).toBeGreaterThan(0);
      expect(pill?.querySelector("svg[data-icon]")).not.toBeNull();
      unmount();
    }
  });

  it("adds a separate warning flag when the ticket awaits the user, keeping the status pill", () => {
    const { container } = render(
      <StatusPill status="in_progress" awaitingUser labels={COPY.it.statuses} pendingLabel="Pendiente" />,
    );
    expect(screen.getByText("En curso")).toBeTruthy();
    const flag = screen.getByText("Pendiente");
    expect(flag.querySelector('[data-icon="circle-alert"]')).not.toBeNull();
    expect(container.querySelectorAll(".pill")).toHaveLength(2);
  });

  it("shows no flag when the ticket does not await the user", () => {
    render(<StatusPill status="new" pendingLabel="Pendiente" />);
    expect(screen.queryByText("Pendiente")).toBeNull();
  });
});
