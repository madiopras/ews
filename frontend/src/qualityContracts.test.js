import fs from "fs";
import path from "path";

function luminance(hex) {
  const values = hex.match(/[a-f\d]{2}/gi).map((value) => parseInt(value, 16) / 255);
  const [red, green, blue] = values.map((value) => value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrast(first, second) {
  const values = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

describe("quality, accessibility, and mobile contracts", () => {
  test.each([
    ["body copy", "#5A5A52", "#F5F1E8"],
    ["brand navigation", "#0F3D3E", "#F5F1E8"],
    ["primary action", "#B94127", "#F5F1E8"],
    ["surface copy", "#1A1A18", "#FFFDF7"],
    ["moss badge", "#4F6047", "#FFFDF7"],
  ])("%s meets WCAG AA normal-text contrast", (_name, foreground, background) => {
    expect(contrast(foreground, background)).toBeGreaterThanOrEqual(4.5);
  });

  test("global CSS supports keyboard focus, reduced motion, safe areas, and narrow viewports", () => {
    const css = fs.readFileSync(path.join(__dirname, "index.css"), "utf8");
    expect(css).toContain(":focus-visible");
    expect(css).toContain("prefers-reduced-motion: reduce");
    expect(css).toContain("env(safe-area-inset-bottom)");
    expect(css).toContain("min-width: 320px");
  });

  test("device uploads declare narrow accepted MIME types", () => {
    const onboarding = fs.readFileSync(path.join(__dirname, "pages/mitra/MitraOnboarding.jsx"), "utf8");
    expect(onboarding).toContain('accept="image/jpeg,image/png,image/webp"');
    expect(onboarding).toContain('accept=".pdf,.jpg,.jpeg,.png"');
  });
});
