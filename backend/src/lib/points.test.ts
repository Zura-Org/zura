import { describe, expect, it } from "vitest";
import { allocate, complexityFromLabels, fromBaseUnits, splitDeposit, toBaseUnits } from "./points.js";

describe("complexityFromLabels", () => {
  it("maps zura labels and prefers the highest complexity", () => {
    expect(complexityFromLabels(["bug", "zura:easy"])).toBe("easy");
    expect(complexityFromLabels([{ name: "Zura:Medium" }, { name: "zura:critical" }])).toBe("critical");
    expect(complexityFromLabels(["hard"])).toBeNull();
  });
});

describe("USDC units", () => {
  it("round-trips 6-decimal amounts", () => {
    expect(toBaseUnits("1234.5")).toBe(1_234_500_000n);
    expect(toBaseUnits("0.000001")).toBe(1n);
    expect(fromBaseUnits(1_234_500_000n)).toBe("1234.500000");
    expect(() => toBaseUnits("-1")).toThrow();
  });

  it("splits the 4% platform fee", () => {
    expect(splitDeposit(toBaseUnits("10000"))).toEqual({ fee: toBaseUnits("400"), net: toBaseUnits("9600") });
  });
});

describe("allocate", () => {
  it("matches WavePool.distribute and sends dust to the last recipient", () => {
    const pool = toBaseUnits("9600");
    const result = allocate(pool, [
      { contributorId: "a", walletAddress: "0xa", points: 100 },
      { contributorId: "b", walletAddress: "0xb", points: 700 },
      { contributorId: "c", walletAddress: "0xc", points: 300 },
    ]);
    expect(result[0].amount).toBe((pool * 100n) / 1100n);
    expect(result[1].amount).toBe((pool * 700n) / 1100n);
    expect(result.reduce((s, r) => s + r.amount, 0n)).toBe(pool);
  });

  it("returns nothing when nobody earned points", () => {
    expect(allocate(100n, [{ contributorId: "a", walletAddress: "0xa", points: 0 }])).toEqual([]);
  });
});
