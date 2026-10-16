export type Appearance = {
  accent: "brass" | "silver" | "amber";
  background: "black" | "graphite";
  textSize: "normal" | "large";
  feedbackGlow: boolean;
};
export const DEFAULT_APPEARANCE: Appearance = {
  accent: "amber",
  background: "black",
  textSize: "normal",
  feedbackGlow: true,
};
export function validAppearance(value: unknown): value is Appearance {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    ["brass", "silver", "amber"].some((x) => x === v.accent) &&
    ["black", "graphite"].some((x) => x === v.background) &&
    ["normal", "large"].some((x) => x === v.textSize) &&
    typeof v.feedbackGlow === "boolean"
  );
}
export function applyAppearance(value: Appearance) {
  document.documentElement.dataset.accent = value.accent;
  document.documentElement.dataset.background = value.background;
  document.documentElement.dataset.textSize = value.textSize;
  document.documentElement.dataset.feedbackGlow = String(value.feedbackGlow);
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute(
      "content",
      value.background === "black" ? "#09090c" : "#111116",
    );
}
