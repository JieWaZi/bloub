import { describe, expect, it } from "vitest";
import { pointerOrientation, dampOrientation } from "./depth";

const bounds = { left: 20, top: 30, width: 40, height: 40 };
describe("pointer body orientation", () => {
  it("shows a clear turn by the avatar edge and caps distant window positions", () => {
    const edge = pointerOrientation(bounds, { x: 60, y: 30 });
    expect(edge.yaw).toBeGreaterThan(30);
    expect(edge.pitch).toBeGreaterThan(20);
    expect(pointerOrientation(bounds, { x: 4000, y: -4000 })).toEqual({
      yaw: 50,
      pitch: 35,
    });
    expect(pointerOrientation(bounds, { x: -4000, y: 4000 })).toEqual({
      yaw: -50,
      pitch: -35,
    });
  });
  it("centers neutral, missing and invalid positions", () => {
    expect(pointerOrientation(bounds, { x: 40, y: 50 })).toEqual({
      yaw: 0,
      pitch: 0,
    });
    expect(pointerOrientation(bounds, null)).toEqual({ yaw: 0, pitch: 0 });
    expect(
      pointerOrientation({ ...bounds, width: 0 }, { x: 50, y: 60 }),
    ).toEqual({ yaw: 0, pitch: 0 });
    expect(pointerOrientation(bounds, { x: NaN, y: 60 })).toEqual({
      yaw: 0,
      pitch: 0,
    });
  });
  it("retains the full target rotation across frame rates and returns to exact neutral", () => {
    const goal = { yaw: 50, pitch: 35 };
    const once = dampOrientation({ yaw: 0, pitch: 0 }, goal, 0.1);
    const twice = dampOrientation(
      dampOrientation({ yaw: 0, pitch: 0 }, goal, 0.05),
      goal,
      0.05,
    );
    expect(twice.yaw).toBeCloseTo(once.yaw, 10);
    expect(twice.pitch).toBeCloseTo(once.pitch, 10);
    let current = { yaw: 0, pitch: 0 };
    for (let i = 0; i < 20; i++) current = dampOrientation(current, goal, 0.1);
    expect(current).toEqual(goal);
    for (let i = 0; i < 20; i++)
      current = dampOrientation(current, { yaw: 0, pitch: 0 }, 0.1);
    expect(current).toEqual({ yaw: 0, pitch: 0 });
    expect(
      dampOrientation(goal, { yaw: NaN, pitch: Infinity }, 0.1).yaw,
    ).toBeLessThan(50);
    expect(dampOrientation(goal, { yaw: 0, pitch: 0 }, NaN)).toEqual(goal);
  });
});
