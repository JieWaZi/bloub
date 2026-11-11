import { describe, expect, it } from "vitest";
import { BotEngine } from "../bot/engine";
import { SHAPE_BY_ID } from "../bot/skins";
import { avatarDrawing, type SvgDrawing } from "./drawing";

function find(nodes: SvgDrawing[], attribute: string): SvgDrawing | undefined {
  for (const node of nodes) {
    if (attribute in node.attributes) return node;
    const child = find(node.children, attribute);
    if (child) return child;
  }
}

const statuses = ["working", "waiting-answer", "waiting-approval", "unread"] as const;
const shape = SHAPE_BY_ID.get("galet")!;

function drawing(engine: BotEngine, time: number, unreadCount?: number) {
  return avatarDrawing(engine.sample(time), "plush", "#0a0a0c", "avatar", undefined, [], [], undefined, shape.id, time, { unreadCount });
}

describe("native attention motion", () => {
  it.each(statuses)("grows %s from the original point with a matching cutout", (status) => {
    const notify = new BotEngine(100, "notify", shape.radii);
    const engine = new BotEngine(100, status, shape.radii);
    expect(engine.sample(0).notif).toMatchObject(notify.sample(0).notif!);
    expect(find(drawing(engine, 0), "data-native-notification")?.tag).toBe("circle");
    expect(find(drawing(engine, 0), "data-native-notification")?.attributes.fill).toBe("#0a0a0c");

    const settledTime = 2.4;
    const settled = drawing(engine, settledTime);
    const mark = find(settled, "data-native-attention");
    const cutout = find(settled, "data-native-attention-cut");
    const outline = find(settled, "data-native-attention-outline");
    expect(mark?.attributes["data-native-attention"]).toBe(status);
    expect(cutout?.attributes.transform).toBe(mark?.attributes.transform);
    expect(outline?.attributes.transform).toBe(mark?.attributes.transform);
    const firstMark = mark?.children[0]?.attributes;
    const firstOutline = outline?.children[0]?.attributes;
    expect(status === "waiting-answer" ? firstMark?.stroke : firstMark?.fill).toBe("#0a0a0c");
    expect(firstOutline?.stroke).toBe("#fff");
    expect(find(settled, "data-body-material")?.attributes.mask).toBe("url(#avatar-notification-cut)");

    const anchor = engine.sample(settledTime).notif!;
    const [x, y, radius] = String(mark?.attributes.transform)
      .match(/-?\d+(?:\.\d+)?/g)!
      .map(Number);
    const sidebarScale = 40 / 316;
    const lift = (anchor.y - y!) * sidebarScale;
    expect(lift).toBeCloseTo(status === "unread" ? 4.56 : 3.32, 1);
    expect((x! - anchor.x) * sidebarScale).toBeCloseTo(status === "unread" ? 1.75 : 0.61, 1);
    const outlineWidth = Number(firstOutline?.strokeWidth) - Number(firstMark?.strokeWidth ?? 0);
    expect((outlineWidth * radius! * sidebarScale) / 2).toBeCloseTo(1.2, 1);
    if (status === "waiting-answer") {
      expect(radius! * sidebarScale).toBeCloseTo(5.03, 2);
    } else if (status === "working" || status === "unread") {
      expect(radius! * sidebarScale).toBeGreaterThanOrEqual(5.8);
    } else {
      expect(radius! * sidebarScale).toBeGreaterThanOrEqual(5.1);
    }
  });

  it("moves the three dots with the body and cycles their accents", () => {
    const engine = new BotEngine(100, "working", shape.radii);
    const first = find(drawing(engine, 0.85), "data-native-attention")!;
    const second = find(drawing(engine, 1.1), "data-native-attention")!;
    expect(first.children.map(({ tag }) => tag)).toEqual(["circle", "circle", "circle"]);
    expect(second.children).not.toEqual(first.children);
    expect(second.attributes.transform).not.toBe(first.attributes.transform);
  });

  it("keeps the mark in body coordinates when the caller transforms the avatar", () => {
    const engine = new BotEngine(100, "waiting-answer", shape.radii);
    const transform = "translate(10 -6) rotate(8)";
    const nodes = avatarDrawing(engine.sample(1), "plush", "#0a0a0c", "avatar", undefined, [], [], transform, shape.id);
    const markLayer = nodes.find((item) => find(item.children, "data-native-attention"));
    expect(markLayer?.attributes.transform).toBe(transform);
    expect(find(nodes, "data-body-material")?.attributes.transform).toBe(transform);
  });

  it.each(["waiting-answer", "waiting-approval", "unread"] as const)("bobs %s with the body after its entrance", (status) => {
    const engine = new BotEngine(100, status, shape.radii);
    const highTime = 3;
    const lowTime = 4.2;
    const high = drawing(engine, highTime);
    const low = drawing(engine, lowTime);
    const highMark = find(high, "data-native-attention")!;
    const lowMark = find(low, "data-native-attention")!;
    const y = (mark: SvgDrawing) =>
      Number(String(mark.attributes.transform).match(/translate\([^ ]+ ([^)]+)\)/)?.[1]);
    expect(engine.sample(lowTime).silhouette.cy - engine.sample(highTime).silhouette.cy).toBeGreaterThan(0.035);
    expect((y(lowMark) - y(highMark)) * (40 / 316)).toBeGreaterThan(1.8);
    expect(highMark.children).toEqual(lowMark.children);
    expect(find(high, "data-native-attention-outline")?.attributes.transform).toBe(highMark.attributes.transform);
    expect(find(low, "data-native-attention-cut")?.attributes.transform).toBe(lowMark.attributes.transform);
  });

  it("fits white digits inside the same unread circle for every count", () => {
    const engine = new BotEngine(100, "unread", shape.radii);
    const single = find(drawing(engine, 1, 1), "data-native-attention")!;
    const capped = find(drawing(engine, 1, 125), "data-native-attention")!;
    expect(single.attributes["data-unread-count"]).toBe("1");
    expect(capped.attributes["data-unread-count"]).toBe("99+");
    expect(single.children[0]?.tag).toBe("circle");
    expect(capped.children[0]).toEqual(single.children[0]);
    const digits = capped.children.filter(({ tag }) => tag === "path");
    expect(digits).toHaveLength(3);
    expect(digits.every(({ attributes }) => attributes.stroke === "#fff")).toBe(true);
  });

  it("uses a consumer theme color for both the origin and the finished mark", () => {
    const engine = new BotEngine(100, "waiting-approval", shape.radii);
    const draw = (time: number) =>
      avatarDrawing(engine.sample(time), "plush", "#0a0a0c", "avatar", undefined, [], [], undefined, shape.id, time, {
        notificationColor: "var(--accent)",
        attentionColors: { "waiting-approval": "var(--approval)" },
      });
    expect(find(draw(0), "data-native-notification")?.attributes.fill).toBe("var(--accent)");
    expect(find(draw(1.1), "data-native-attention")?.children[0]?.attributes.fill).toBe("var(--approval)");
  });

  it("keeps the unread number legible on a pale avatar", () => {
    const engine = new BotEngine(100, "unread", shape.radii);
    const nodes = avatarDrawing(engine.sample(1), "plush", "#fff0a0", "avatar", undefined, [], [], undefined, shape.id);
    const mark = find(nodes, "data-native-attention");
    expect(mark?.children[0]?.attributes.fill).toBe("#fff0a0");
    expect(mark?.children[1]?.attributes.stroke).toBe("#0a0a0c");
    expect(mark?.children.at(-1)?.attributes.stroke).toBe("#fff");
  });
});
