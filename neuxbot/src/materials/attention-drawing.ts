import type { BotFrame } from "../bot/engine";
import { TAU, clamp, lerp, r2 } from "../bot/math";
import type { AttentionState } from "../bot/states";
import { parseHex } from "../plush/tint";
import type { SvgDrawing } from "./drawing";

type Attributes = SvgDrawing["attributes"];

const node = (tag: string, attributes: Attributes, children: SvgDrawing[] = []): SvgDrawing =>
  ({ tag, attributes, children });

const markScale: Record<AttentionState, number> = {
  working: 3.12,
  "waiting-answer": 2.65,
  "waiting-approval": 2.98,
  unread: 3.12,
};

// Les deux contours ont les memes quatre segments cubiques.
const pointContour = [
  0, -1,
  .55, -1, 1, -.55, 1, 0,
  1, .55, .55, 1, 0, 1,
  -.55, 1, -1, .55, -1, 0,
  -1, -.55, -.55, -1, 0, -1,
];
const shieldContour = [
  0, -1.05,
  .32, -.83, .66, -.7, .92, -.65,
  .91, .16, .54, .79, 0, 1.05,
  -.54, .79, -.91, .16, -.92, -.65,
  -.66, -.7, -.32, -.83, 0, -1.05,
];

function shieldPath(progress: number, scale = 1): string {
  const coordinates = pointContour.map((value, index) =>
    r2(lerp(value, shieldContour[index]!, progress) * scale),
  );
  const segment = (start: number, length: number) => coordinates.slice(start, start + length).join(" ");
  return `M${segment(0, 2)}C${segment(2, 6)}C${segment(8, 6)}C${segment(14, 6)}C${segment(20, 6)}Z`;
}

// Les chiffres sont des traits SVG pour garder le meme rendu a l'export.
const countGlyphs: Record<string, string> = {
  "0": "M0 -.49C-.43 -.49 -.43 .49 0 .49S.43 -.49 0 -.49Z",
  "1": "M-.22 -.28L.02 -.49V.49M-.24 .49H.28",
  "2": "M-.27 -.3C-.22 -.55 .28 -.56 .28 -.23C.28 .01 -.23 .12 -.27 .49H.3",
  "3": "M-.26 -.37C-.12 -.58 .28 -.54 .28 -.27C.28 -.11 .16 -.01 -.02 0C.17 0 .3 .1 .3 .27C.3 .55 -.13 .58 -.28 .36",
  "4": "M.15 .49V-.49L-.31 .17H.32",
  "5": "M.27 -.49H-.2L-.25 -.02C.04 -.19 .3 -.03 .3 .24C.3 .56 -.13 .58 -.29 .35",
  "6": "M.24 -.37C-.09 -.73 -.42 -.27 -.3 .25C-.22 .6 .3 .59 .3 .23C.3 -.12 -.16 -.15 -.3 .12",
  "7": "M-.29 -.49H.3L-.12 .49",
  "8": "M0 0C-.37 -.04 -.38 -.49 0 -.49S.37 -.04 0 0C-.43 .04 -.42 .49 0 .49S.43 .04 0 0Z",
  "9": "M-.24 .37C.09 .73 .42 .27 .3 -.25C.22 -.6 -.3 -.59 -.3 -.23C-.3 .12 .16 .15 .3 -.12",
  "+": "M-.26 0H.26M0 -.26V.26",
};

function countNeedsContrast(background: string): boolean {
  if (!/^#[\da-f]{6}$/i.test(background)) return false;
  const [red, green, blue] = parseHex(background);
  const linear = (channel: number) => {
    const srgb = channel / 255;
    return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * linear(red) + 0.7152 * linear(green) + 0.0722 * linear(blue);
  return luminance > 0.35;
}

export function drawAttention(
  notification: NonNullable<BotFrame["notif"]>,
  notch: BotFrame["notch"],
  unreadCount: number,
  notificationColor: string,
  attentionColors?: Partial<Record<AttentionState, string>>,
) {
  const attention = notification.attention;
  if (!attention || attention.progress <= 0) return;

  const { kind, progress, phase } = attention;
  const count = Number.isFinite(unreadCount) ? Math.floor(unreadCount) : 0;
  if (kind === "unread" && count <= 0) return;
  const label = kind === "unread" ? (count > 99 ? "99+" : String(count)) : "";
  const radius = notification.r * lerp(1, markScale[kind], progress);
  // Le symbole se leve a mesure qu'il quitte le point, avec la decoupe du corps.
  const lift = notification.r * progress;
  const x = notification.x + lift * (kind === "unread" ? 0.92 : 0.32);
  const bob = kind === "working" ? 0 : Math.sin(phase) * 0.4;
  const y = notification.y - lift * ((kind === "unread" ? 2.4 : 1.75) + bob);
  const transform = `translate(${r2(x)} ${r2(y)}) scale(${r2(radius)})`;
  const gap = notch ? ((notch.r - notification.r) / radius) * lerp(1, 1.75, progress) : 0;
  const targetColor = attentionColors?.[kind] ?? notificationColor;
  const color = progress >= 1 || targetColor === notificationColor
    ? targetColor
    : `color-mix(in srgb, ${notificationColor} ${r2((1 - progress) * 100)}%, ${targetColor})`;
  const paint: SvgDrawing[] = [];
  const cut: SvgDrawing[] = [];

  const fill = (tag: string, attributes: Attributes, cutShape = attributes) => {
    paint.push(node(tag, { ...attributes, fill: color }));
    cut.push(node(tag, { ...cutShape, fill: "#000", stroke: "#000", strokeWidth: gap * 2, strokeLinejoin: "round" }));
  };

  switch (kind) {
    case "working":
      for (const index of [-1, 0, 1]) {
        const wave = Math.sin(phase - index * 1.85);
        const size = 0.35 + wave * 0.065;
        fill("circle", {
          cx: index * 0.94 * progress,
          cy: -wave * 0.17 * progress,
          r: lerp(index === 0 ? 1 : 0, size, progress),
        });
      }
      break;
    case "waiting-answer": {
      const reveal = clamp((progress - 0.14) / 0.86);
      if (reveal > 0) {
        const curve = {
          d: "M0 .18C0 -.21 .63 -.25 .63 -.65C.63 -1.25 -.49 -1.26 -.60 -.66",
          fill: "none",
          strokeLinecap: "round",
          pathLength: 1,
          strokeDasharray: reveal < 1 ? `${reveal} 1` : undefined,
        };
        paint.push(node("path", { ...curve, stroke: color, strokeWidth: 0.42 }));
        cut.push(node("path", { ...curve, stroke: "#000", strokeWidth: 0.42 + gap * 2 }));
      }
      fill("circle", { cx: 0, cy: 0.74 * progress, r: lerp(1, 0.22, progress) });
      break;
    }
    case "waiting-approval": {
      const outer = shieldPath(progress);
      const inner = shieldPath(progress, progress * 0.61);
      fill("path", { d: `${outer} ${inner}`, fillRule: "evenodd" }, { d: outer });
      break;
    }
    case "unread": {
      const characters = [...label];
      fill("circle", { cx: 0, cy: 0, r: 1 });
      const opacity = clamp((progress - 0.28) / 0.72);
      const glyphScale = characters.length === 1 ? 1.2 : characters.length === 2 ? 1 : 0.74;
      const needsContrast = countNeedsContrast(targetColor);
      for (const [index, glyph] of characters.entries()) {
        const offset = (index - (characters.length - 1) / 2) * 0.8 * glyphScale * progress;
        const digit = {
          d: countGlyphs[glyph],
          transform: `translate(${r2(offset)} 0) scale(${glyphScale})`,
          fill: "none",
          strokeLinecap: "round",
          strokeLinejoin: "round",
          opacity,
        };
        if (needsContrast) {
          paint.push(node("path", { ...digit, stroke: "#0a0a0c", strokeWidth: 0.34, opacity: opacity * 0.6 }));
        }
        paint.push(node("path", { ...digit, stroke: "#fff", strokeWidth: 0.2 }));
      }
      break;
    }
  }

  return {
    mark: node("g", { "data-native-attention": kind, "data-unread-count": label || undefined, transform }, paint),
    cutout: node("g", { "data-native-attention-cut": "", transform }, cut),
    outline: node(
      "g",
      { "data-native-attention-outline": "", transform, opacity: progress },
      cut.map(({ tag, attributes }) => node(tag, { ...attributes, fill: "none", stroke: "#fff" })),
    ),
  };
}
