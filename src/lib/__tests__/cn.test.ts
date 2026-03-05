import { describe, it, expect } from "vitest";
import { cn } from "../cn";

describe("cn", () => {
  it("joins multiple class names", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("filters out falsy values", () => {
    expect(cn("foo", undefined, "bar", null, false)).toBe("foo bar");
  });

  it("returns empty string for no inputs", () => {
    expect(cn()).toBe("");
  });

  it("returns empty string for all falsy inputs", () => {
    expect(cn(undefined, null, false)).toBe("");
  });

  it("handles single class", () => {
    expect(cn("foo")).toBe("foo");
  });

  it("handles conditional classes", () => {
    const isActive = true;
    const isDisabled = false;
    expect(cn("btn", isActive && "active", isDisabled && "disabled")).toBe(
      "btn active",
    );
  });

  it("preserves whitespace in class names", () => {
    expect(cn("  foo  ", "bar")).toBe("  foo   bar");
  });
});
