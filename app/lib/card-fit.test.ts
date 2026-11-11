import { describe, expect, it } from "vitest";
import { anyOverflow } from "./card-fit";

describe("anyOverflow", () => {
  it("flags a card whose content is taller than its box", () => {
    expect(anyOverflow([{ scrollHeight: 400, clientHeight: 472 }])).toBe(false);
    expect(
      anyOverflow([
        { scrollHeight: 400, clientHeight: 472 },
        { scrollHeight: 585, clientHeight: 472 },
      ]),
    ).toBe(true);
  });

  it("ignores sub-pixel rounding", () => {
    expect(anyOverflow([{ scrollHeight: 473, clientHeight: 472 }])).toBe(false);
  });
});
