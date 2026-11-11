import type { BotFrame } from "../bot/engine";
import { NOTIF_BLUE } from "../bot/decor";
import type { ShapeId } from "../bot/skins";
import { mixHex, SHAPE_BY_ID } from "../bot/skins";
import type { PlushDot, PlushZ } from "../plush/motion";
import {
  BODY_COLUMNS,
  BODY_ROWS,
  BODY_SHAPES,
  BODY_SPRITES,
  type Material,
} from "./catalogue";
import { radialBodyWarp, silhouetteTransform } from "./warp";
import { bodyParticles } from "./effects";
import { enlargedEyes } from "./eyes";
import { drawAttention } from "./attention-drawing";
import type { AttentionState } from "../bot/states";

/** 无框架依赖的 SVG 绘图树，可由 React 或静态导出器使用。 */
export interface SvgDrawing {
  tag: string;
  attributes: Record<string, string | number | undefined>;
  children: SvgDrawing[];
}
const node = (
  tag: string,
  attributes: SvgDrawing["attributes"],
  ...children: SvgDrawing[]
): SvgDrawing => ({ tag, attributes, children });
const stop = (offset: number, color: string, opacity = 1) =>
  node("stop", { offset, stopColor: color, stopOpacity: opacity });

/** 身体本身已经包含体积、光照与柔软边缘；只取图集对应格，不裁切为平面轮廓。 */
export function avatarDrawing(
  frame: BotFrame,
  material: Material,
  color: string,
  id: string,
  texture: string | undefined,
  dots: PlushDot[],
  zs: PlushZ[],
  bodyTransform?: string,
  shape: ShapeId = "cercle",
  time = 0,
  options: {
    unreadCount?: number;
    notificationColor?: string;
    attentionColors?: Partial<Record<AttentionState, string>>;
  } = {},
): SvgDrawing[] {
  const notificationColor = options.notificationColor ?? (frame.notif?.attention ? color : NOTIF_BLUE);
  const attention = frame.notif
    ? drawAttention(frame.notif, frame.notch, options.unreadCount ?? 1, notificationColor, options.attentionColors)
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
  const index = Math.max(
    0,
    BODY_SHAPES.findIndex((item) => item === shape),
  );
  const column = index % BODY_COLUMNS;
  const row = Math.floor(index / BODY_COLUMNS);
  const atlas = BODY_SPRITES[material];
  const cellWidth = atlas.width / BODY_COLUMNS;
  const cellHeight = atlas.height / BODY_ROWS;
  const sprite = node(
    "svg",
    {
      "data-body-sprite": shape,
      "data-companion-avatar": "",
      x: -158,
      y: -158,
      width: 316,
      height: 316,
      viewBox: `${column * cellWidth} ${row * cellHeight} ${cellWidth} ${cellHeight}`,
      overflow: "hidden",
      preserveAspectRatio: "none",
    },
    node("image", {
      "data-texture": "",
      href: texture,
      x: 0,
      y: 0,
      width: atlas.width,
      height: atlas.height,
      preserveAspectRatio: "none",
    }),
  );
  const slices = texture
    ? radialBodyWarp(
        SHAPE_BY_ID.get(shape)?.radii ?? frame.silhouette.radii,
        frame.silhouette.radii,
      )
    : [];
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
  const particles =
    material === "particles" ? bodyParticles(frame.silhouette, time) : [];
  const particleLayer = (back: boolean) =>
    node(
      "g",
      {
        "data-particle-layer": back ? "back" : "front",
        transform: silhouetteTransform(frame.silhouette),
        fill: mixHex(color, "#ffffff", back ? 0.35 : 0.72),
      },
      ...particles
        .filter((particle) => particle.back === back)
        .map((particle) =>
          node("circle", {
            "data-material-particle": particle.index,
            cx: particle.x,
            cy: particle.y,
            r: particle.r,
            opacity: particle.opacity,
          }),
        ),
    );
  return [
    node(
      "defs",
      {},
      node(
        "linearGradient",
        { id: `${id}-eye`, x1: 0, y1: 0, x2: 1, y2: 1 },
        stop(0, "#fffdf1"),
        stop(0.5, "#fff8db"),
        stop(1, "#b8ac8f"),
      ),
      node(
        "filter",
        {
          id: `${id}-eye-depth`,
          x: "-100%",
          y: "-100%",
          width: "300%",
          height: "300%",
          colorInterpolationFilters: "sRGB",
        },
        node("feDropShadow", {
          dx: 0.6,
          dy: 1,
          stdDeviation: 0.8,
          floodColor: "#2b1d25",
          floodOpacity: 0.22,
        }),
      ),
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
      ...(slices.length
        ? [
            node("g", { id: `${id}-sprite` }, sprite),
            ...slices.map((slice, index) =>
              node(
                "clipPath",
                {
                  id: `${id}-sector-${index}`,
                  clipPathUnits: "userSpaceOnUse",
                },
                node("polygon", { points: slice.points }),
              ),
            ),
          ]
        : []),
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
              attention?.cutout ?? node("circle", {
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
      path({
        "data-body": "",
        d: frame.bodyPath,
        fill: color,
        opacity: texture ? 0 : 1,
      }),
      ...(particles.length ? [particleLayer(true)] : []),
      ...(texture
        ? [
            node(
              "g",
              {
                transform: silhouetteTransform(frame.silhouette),
                "data-body-warp": slices.length ? "radial-svg" : undefined,
              },
              ...(slices.length
                ? slices.map((slice, index) =>
                    node(
                      "g",
                      { clipPath: `url(#${id}-sector-${index})` },
                      node("use", {
                        href: `#${id}-sprite`,
                        transform: slice.matrix,
                      }),
                    ),
                  )
                : [sprite]),
            ),
          ]
        : []),
      ...(particles.length ? [particleLayer(false)] : []),
      ...enlargedEyes(frame.eyes).map((eye, index) =>
        path({
          "data-eye": index,
          d: eye.d,
          transform: eye.matrix,
          opacity: eye.alpha,
          fill: url("eye"),
          filter: url("eye-depth"),
        }),
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
          attention ? node("g", { transform: bodyTransform }, attention.outline, attention.mark) : node("circle", {
            "data-native-notification": "",
            cx: frame.notif.x,
            cy: frame.notif.y,
            r: frame.notif.r,
            fill: notificationColor,
          }),
        ]
      : []),
  ];
}
