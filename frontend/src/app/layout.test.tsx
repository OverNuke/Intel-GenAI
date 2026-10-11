// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import RootLayout, { viewport } from "./layout";

describe("RootLayout viewport (REQ-NS-M7)", () => {
  it("covers the notch so iOS reports non-zero safe-area insets", () => {
    expect(viewport.viewportFit).toBe("cover");
    expect(viewport.width).toBe("device-width");
    expect(viewport.initialScale).toBe(1);
  });
});

describe("RootLayout", () => {
  it("renders html with es-MX lang and the grayscale theme by default", () => {
    const tree = RootLayout({ children: null });
    expect(tree.type).toBe("html");
    expect(tree.props.lang).toBe("es-MX");
    expect(tree.props["data-theme"]).toBe("grayscale");
  });
});
