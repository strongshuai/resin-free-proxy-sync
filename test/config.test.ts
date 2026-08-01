import { describe, expect, it } from "vitest";

import { DEFAULT_SETTINGS, sanitizeSettings, shouldRunScheduled } from "../src/config";

describe("settings and schedule", () => {
  it("runs once after the configured local time", () => {
    const settings = sanitizeSettings({
      ...DEFAULT_SETTINGS,
      enabled: true,
      dailyTime: "03:00",
      timezone: "Asia/Shanghai",
    });
    const now = new Date("2026-08-01T19:05:00.000Z");
    expect(shouldRunScheduled(now, settings).due).toBe(true);
    expect(shouldRunScheduled(now, settings, "2026-08-02").due).toBe(false);
  });

  it("rejects empty sources and unsafe limits", () => {
    expect(() => sanitizeSettings({ sourceIds: [] })).toThrow(/source/i);
    expect(() => sanitizeSettings({ perSourceLimit: 50_000 })).toThrow(/5000/);
  });
});
