/** Body rotation in degrees: positive yaw faces right; positive pitch faces up. */
export interface BodyOrientation {
  yaw: number;
  pitch: number;
}

interface PointerBounds {
  left: number;
  top: number;
  width: number;
  height: number;
}

const neutral = (): BodyOrientation => ({ yaw: 0, pitch: 0 });
const clamp = (value: number, limit: number) =>
  Math.max(-limit, Math.min(limit, value));

/** Normalize host pointer coordinates without retaining DOM or event state. */
export function pointerOrientation(
  bounds: PointerBounds,
  pointer: { x: number; y: number } | null,
): BodyOrientation {
  if (
    !pointer ||
    bounds.width <= 0 ||
    bounds.height <= 0 ||
    ![
      bounds.left,
      bounds.top,
      bounds.width,
      bounds.height,
      pointer.x,
      pointer.y,
    ].every(Number.isFinite)
  )
    return neutral();
  // A pointer at the avatar edge already makes a clear turn, including small
  // navigation avatars. The native reference uses 2 widths and smaller angles;
  // these bounds intentionally respond more strongly to nearby movement.
  const radius = Math.max(bounds.width, 1) * 0.75;
  const x = (pointer.x - bounds.left - bounds.width / 2) / radius;
  const y = (bounds.top + bounds.height / 2 - pointer.y) / radius;
  return { yaw: clamp(x, 1) * 50 || 0, pitch: clamp(y, 1) * 35 || 0 };
}

/** Frame-rate independent 110ms response, with an exact settled neutral frame. */
export function dampOrientation(
  current: BodyOrientation,
  target: BodyOrientation,
  seconds: number,
): BodyOrientation {
  const from = finiteOrientation(current);
  if (!Number.isFinite(seconds) || seconds <= 0) return from;
  const to = finiteOrientation(target);
  const amount = -Math.expm1(-seconds / 0.11);
  const axis = (a: number, b: number) => {
    const value = a + (b - a) * amount;
    return Math.abs(b - value) < 0.005 ? b : value;
  };
  return { yaw: axis(from.yaw, to.yaw), pitch: axis(from.pitch, to.pitch) };
}

function finiteOrientation(value: BodyOrientation): BodyOrientation {
  return Number.isFinite(value.yaw) && Number.isFinite(value.pitch)
    ? { yaw: clamp(value.yaw, 50), pitch: clamp(value.pitch, 35) }
    : neutral();
}
