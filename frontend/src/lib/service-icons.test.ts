import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ICONS } from "@/ui/atoms/icon-paths";
import { SERVICE_ICONS, serviceIcon } from "./service-icons";

const BACKEND_SERVICES = path.resolve(process.cwd(), "../backend/app/modules/catalog/domain/services.py");

describe("serviceIcon", () => {
  it("falls back to circle-ellipsis for unknown or missing keys", () => {
    expect(serviceIcon(undefined)).toBe("circle-ellipsis");
    expect(serviceIcon("something-new")).toBe("circle-ellipsis");
  });

  it("maps the known catalog keys", () => {
    expect(serviceIcon("access")).toBe("key-round");
    expect(serviceIcon("printing")).toBe("printer");
    expect(serviceIcon("email")).toBe("mail");
    expect(serviceIcon("network")).toBe("wifi");
    expect(serviceIcon("hardware")).toBe("laptop");
    expect(serviceIcon("software")).toBe("app-window");
  });

  it("only maps to icons that exist in the generated sprite", () => {
    for (const name of Object.values(SERVICE_ICONS)) expect(name in ICONS).toBe(true);
    expect("circle-ellipsis" in ICONS).toBe(true);
  });

  it.skipIf(!existsSync(BACKEND_SERVICES))("covers exactly the backend catalog keys", () => {
    const source = readFileSync(BACKEND_SERVICES, "utf-8");
    const keys = [...source.matchAll(/key="(\w+)"/g)].map((m) => m[1]!);
    expect(keys.length).toBeGreaterThan(0);
    expect([...keys].sort()).toEqual(Object.keys(SERVICE_ICONS).sort());
    for (const key of keys) expect(serviceIcon(key)).not.toBe("circle-ellipsis");
  });
});
