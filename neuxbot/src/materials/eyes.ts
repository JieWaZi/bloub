import type { BotFrame } from "../bot/engine";
import { faceGrowth, matrixOf } from "../plush/motion";

/** 放大整个脸而非分别扩眼，保留外侧余量、双眼间距和原生眨眼。 */
export function enlargedEyes(
  eyes: BotFrame["eyes"],
  scale = 1.15,
): BotFrame["eyes"] {
  if (scale === 1 || !eyes.length) return eyes;
  const source = eyes.map((eye) => ({
    eye,
    m: matrixOf(eye.matrix),
    w: eye.w,
    h: eye.h,
  }));
  const growth = faceGrowth(source, scale);
  return source.map(({ eye, m }, index) => {
    const [a = 1, b = 0, c = 0, d = 1, x = 0, y = 0] = m;
    return {
      ...eye,
      matrix: `matrix(${a * scale},${b * scale},${c * scale},${d * scale},${x + (growth[index]?.x ?? 0)},${y + (growth[index]?.y ?? 0)})`,
    };
  });
}
