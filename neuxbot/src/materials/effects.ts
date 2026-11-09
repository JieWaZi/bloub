import { arcRender, RINGS } from "../bot/decor";

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
