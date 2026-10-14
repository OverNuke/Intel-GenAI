// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { StatTile } from "./stat-tile";

afterEach(cleanup);

const renderTile = (ui: React.ReactElement) => render(<ul>{ui}</ul>);

describe("StatTile (R4.1, R4.2)", () => {
  it("renders value, label and basis, and never the estimate wording by default", () => {
    const { container } = renderTile(<StatTile label="Pasados a TI" value="8" basis="Por semana" />);
    const item = screen.getByRole("listitem");
    expect(item.textContent).toContain("8");
    expect(item.textContent).toContain("Pasados a TI");
    expect(item.textContent).toContain("Por semana");
    expect(item.textContent).not.toContain("no son resultados medidos");
    expect(container.querySelector(".stat-tile--estimated")).toBeNull();
  });

  it("the estimated variant is visually distinct and shows its children (disclaimer slot)", () => {
    const { container } = renderTile(
      <StatTile label="Ahorro" value="$4,200 MXN" variant="estimated">
        <span>no son resultados medidos</span>
      </StatTile>,
    );
    expect(container.querySelector("li.stat-tile.stat-tile--estimated")).not.toBeNull();
    expect(screen.getByRole("listitem").textContent).toContain("no son resultados medidos");
  });

  it("is type-agnostic: it never imports the generated api types", () => {
    const source = readFileSync(join(process.cwd(), "src/ui/molecules/stat-tile.tsx"), "utf-8");
    expect(source).not.toMatch(/api-types/);
  });
});
