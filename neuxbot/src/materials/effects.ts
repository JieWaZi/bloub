import { arcRender, RINGS } from "../bot/decor";
import { createRng } from "../bot/math";
import { radiusAtAngle, type Silhouette } from "../bot/shape";

const particleRandom = createRng(0x4e657578);
const PARTICLE_SEEDS = Array.from({ length: 184 }, (_, index) => {
  const back = index < 40;
  return {
    back,
    angle: particleRandom() * Math.PI * 2,
    // 少量后景粒子散在轮廓外，两层均覆盖面部区域；随机角度避免规则点阵或螺旋。
    radius:
      index < 16
        ? 0.94 + particleRandom() * 0.17
        : Math.sqrt(particleRandom()) * 0.97,
    size: particleRandom(),
    phase: particleRandom() * Math.PI * 2,
  };
});

/** 大小分层的粒子在缩小后仍可辨，随原生轮廓形变；时间只取调用方已有绘图时钟。 */
export function bodyParticles(silhouette: Silhouette, time: number) {
  return PARTICLE_SEEDS.map((seed, index) => {
    const depth = Math.sqrt(Math.max(0, 1 - seed.radius ** 2));
    const angle =
      seed.angle +
      time * (seed.back ? -0.023 : 0.038) +
      Math.sin(time * 0.6 + seed.phase) * 0.018;
    const rho = seed.radius + Math.sin(time * 0.75 + seed.phase) * 0.012;
    const radius = radiusAtAngle(silhouette.radii, angle) * 100;
    const light =
      depth * 0.4 - Math.cos(angle) * rho * 0.35 - Math.sin(angle) * rho * 0.45;
    return {
      index,
      back: seed.back,
      x: Math.cos(angle) * rho * radius,
      y: Math.sin(angle) * rho * radius,
      light,
      r: seed.back
        ? 1.1 + seed.size * 2.1
        : 2.6 + depth * 1.3 + seed.size ** 0.7 * 4.6,
      opacity: seed.back
        ? 0.34 + seed.size * 0.36
        : 0.78 + light * 0.1 + Math.sin(time * 1.1 + seed.phase) * 0.1,
    };
  });
}

/** 连接是持续业务状态，复用 Bloub 环轨几何并保持可见，不使用一次性入场淡出。 */
export function connectionArcs(time: number) {
  return RINGS.slice(0, 3).map((ring, index) =>
    arcRender(ring, time, 100, `connection-${index}`, 1),
  );
}

/** 身体动作与眼睛独立，工作状态保留呼吸、搜索倾斜和结束强调。 */
export function bodyMovement(
  activity: string,
  time: number,
  elapsed: number,
): string {
  let x = 0,
    y = 0,
    rotation = 0,
    sx = 1,
    sy = 1;
  if (["thinking", "working", "connecting"].includes(activity)) {
    const breath = Math.sin((time * Math.PI) / 1.4);
    sx += breath * 0.018;
    sy -= breath * 0.012;
    y = Math.sin(time * 1.2) * 2;
    rotation = Math.sin(time * 0.8) * 1.2;
  } else if (activity === "searching") {
    rotation = Math.sin(time * 1.5) * 3;
    y = Math.cos(time * 1.5) * 2;
  } else if (activity === "responding") {
    sy += Math.sin(time * 5) * 0.016;
    sx -= Math.sin(time * 5) * 0.008;
  } else if (activity === "completed") {
    const emphasis = Math.sin(
      Math.PI * Math.min(Math.max(elapsed / 1.2, 0), 1),
    );
    y = -emphasis * 8;
    sx += emphasis * 0.035;
    sy += emphasis * 0.035;
  } else if (activity === "failed" && elapsed < 0.8) {
    x =
      Math.sin(elapsed * Math.PI * 5) * Math.sin((elapsed / 0.8) * Math.PI) * 4;
  } else if (activity === "idle") {
    sy += Math.sin((time * Math.PI) / 1.7) * 0.006;
  }
  return `translate(${x.toFixed(3)},${y.toFixed(3)}) rotate(${rotation.toFixed(3)}) scale(${sx.toFixed(4)},${sy.toFixed(4)})`;
}
