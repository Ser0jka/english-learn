import { it, expect } from "vitest";
import { DEFAULT_APPEARANCE, validAppearance } from "../src/appearance";
import {
  emptyStore,
  createBackup,
  parseBackup,
  validateStore,
} from "../src/domain";
it("accepts only named accessible presets, without arbitrary CSS injection", () => {
  expect(validAppearance(DEFAULT_APPEARANCE)).toBe(true);
  expect(
    validAppearance({ ...DEFAULT_APPEARANCE, accent: "red; display:none" }),
  ).toBe(false);
  expect(validAppearance({ ...DEFAULT_APPEARANCE, textSize: 100 })).toBe(false);
  expect(
    validAppearance({ ...DEFAULT_APPEARANCE, feedbackGlow: "false" }),
  ).toBe(false);
});
it("preserves appearance through a full backup and accepts existing workspaces without preferences", () => {
  const state = {
    ...emptyStore(),
    appearance: {
      ...DEFAULT_APPEARANCE,
      accent: "silver" as const,
      textSize: "large" as const,
    },
  };
  expect(parseBackup(createBackup(state))).toEqual(state);
  expect(validateStore(emptyStore()).appearance).toBeUndefined();
  expect(() =>
    validateStore({ ...state, appearance: { accent: "unknown" } }),
  ).toThrow();
});
