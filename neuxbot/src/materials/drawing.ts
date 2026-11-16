import type { BotFrame } from "../bot/engine";
import { NOTIF_BLUE } from "../bot/decor";
import type { ShapeId } from "../bot/skins";
import type { PlushDot, PlushZ } from "../plush/motion";
import type { Material } from "./catalogue";
import { solidShapeDrawing } from "./solid";
import { drawAttention } from "./attention-drawing";
import type { AttentionState } from "../bot/states";
import type { BodyOrientation } from "./depth";

export {
  pointerOrientation,
  dampOrientation,
  type BodyOrientation,
} from "./depth";

/** 无框架依赖的 SVG 绘图树，可由 React 或静态导出器使用。 */
export interface SvgDrawing {
  tag: string;
  attributes: Record<string, string | number | SvgDrawingStyle | undefined>;
  children: SvgDrawing[];
}
/** Serializable CSS declarations accepted by both DOM and static SVG adapters. */
export interface SvgDrawingStyle {
  isolation?: "isolate";
  mixBlendMode?: "plus-lighter";
}
const node = (
  tag: string,
  attributes: SvgDrawing["attributes"],
  ...children: SvgDrawing[]
): SvgDrawing => ({ tag, attributes, children });
const stop = (offset: number, color: string, opacity = 1) =>
  node("stop", { offset, stopColor: color, stopOpacity: opacity });

/** 静止和动态共用闭合实体、全表面材质与曲面眼睛。 */
export function avatarDrawing(
  frame: BotFrame,
  material: Material,
  color: string,
  id: string,
  _texture: string | undefined,
  dots: PlushDot[],
  zs: PlushZ[],
  bodyTransform?: string,
  shape: ShapeId = "cercle",
  time = 0,
  options: {
    unreadCount?: number;
    notificationColor?: string;
    attentionColors?: Partial<Record<AttentionState, string>>;
    /** 整个实体与附着眼睛的朝向；调用方不再为同一朝向改写 setLook。 */
    bodyOrientation?: BodyOrientation;
  } = {},
): SvgDrawing[] {
  const notificationColor =
    options.notificationColor ?? (frame.notif?.attention ? color : NOTIF_BLUE);
  const attention = frame.notif
    ? drawAttention(
        frame.notif,
        frame.notch,
        options.unreadCount ?? 1,
        notificationColor,
        options.attentionColors,
      )
    : undefined;
  const url = (name: string) => `url(#${id}-${name})`;
  const path = (attributes: SvgDrawing["attributes"]) =>
    node("path", attributes);
  const arc = (side: "front" | "back") =>
    frame.arcs.map((a) =>
      path({
        d: a[side],
        fill: "none",
        stroke: url(a.id),
        strokeWidth: a.width,
        opacity: a.opacity,
        strokeLinecap: "round",
      }),
    );
  const nativeDots = () =>
    frame.dots.map((dot, index) =>
      dot.d
        ? path({
            "data-native-dot": index,
            d: dot.d,
            transform: `translate(${dot.x},${dot.y}) rotate(${dot.rot ?? 0}) scale(100)`,
            fill: dot.color ?? color,
            opacity: dot.opacity,
          })
        : node("circle", {
            "data-native-dot": index,
            cx: dot.x,
            cy: dot.y,
            r: dot.r,
            fill: dot.color ?? color,
            opacity: dot.opacity,
          }),
    );
  const drawing = [
    node(
      "defs",
      {},
      ...frame.arcs.map((a) =>
        node(
          "linearGradient",
          {
            id: `${id}-${a.id}`,
            gradientUnits: "userSpaceOnUse",
            x1: a.grad.x1,
            y1: a.grad.y1,
            x2: a.grad.x2,
            y2: a.grad.y2,
          },
          ...a.grad.stops.map((color, index) =>
            stop(index / Math.max(a.grad.stops.length - 1, 1), color),
          ),
        ),
      ),
      ...(frame.notch
        ? [
            node(
              "mask",
              {
                id: `${id}-notification-cut`,
                maskUnits: "userSpaceOnUse",
                x: -158,
                y: -158,
                width: 316,
                height: 316,
              },
              node("rect", {
                x: -158,
                y: -158,
                width: 316,
                height: 316,
                fill: "#fff",
              }),
              attention?.cutout ??
                node("circle", {
                  cx: frame.notch.x,
                  cy: frame.notch.y,
                  r: frame.notch.r,
                  fill: "#000",
                }),
            ),
          ]
        : []),
    ),
    ...arc("back"),
    ...(frame.dotsBehind ? nativeDots() : []),
    node(
      "g",
      {
        opacity: frame.bodyAlpha,
        transform: bodyTransform,
        "data-body-material": material,
        mask: frame.notch ? url("notification-cut") : undefined,
      },
      ...solidShapeDrawing(
        frame,
        material,
        color,
        id,
        options.bodyOrientation ?? { yaw: 0, pitch: 0 },
        time,
        shape,
      ),
    ),
    ...arc("front"),
    ...(!frame.dotsBehind ? nativeDots() : []),
    ...dots.map((dot) =>
      node("circle", {
        cx: dot.x * 100,
        cy: dot.y * 100,
        r: dot.r * 100,
        fill: color,
        opacity: dot.opacity,
      }),
    ),
    ...zs.map((z) =>
      path({
        d: `M${z.x * 100 - z.size * 50},${z.y * 100 - z.size * 50}h${z.size * 100}l${-z.size * 100},${z.size * 100}h${z.size * 100}`,
        fill: "none",
        stroke: color,
        strokeWidth: 3,
        strokeLinecap: "round",
        opacity: z.opacity,
      }),
    ),
    ...(frame.notif
      ? [
          attention
            ? node(
                "g",
                { transform: bodyTransform },
                attention.outline,
                attention.mark,
              )
            : node("circle", {
                "data-native-notification": "",
                cx: frame.notif.x,
                cy: frame.notif.y,
                r: frame.notif.r,
                fill: notificationColor,
              }),
        ]
      : []),
  ];
  return drawing;
}
