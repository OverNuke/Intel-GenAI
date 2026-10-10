// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import RootLayout from "./layout";

describe("RootLayout", () => {
  it("renders html with es-MX lang and the grayscale theme by default", () => {
    const tree = RootLayout({ children: null });
    expect(tree.type).toBe("html");
    expect(tree.props.lang).toBe("es-MX");
    expect(tree.props["data-theme"]).toBe("grayscale");
  });
});
