const VERTEX = `#version 300 es
in vec2 aPosition;
in vec2 aRest;
in vec4 aStrain;
in vec3 aDent;
uniform vec2 uViewport;
uniform vec2 uOffset;
out vec2 vRest;
out vec4 vStrain;
out vec3 vDent;
void main() {
  vRest = aRest;
  vStrain = aStrain;
  vDent = aDent;
  vec2 clip = (aPosition + uOffset) / uViewport * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
}`;

const SURFACE = `#version 300 es
precision highp float;
in vec2 vRest;
in vec4 vStrain;
in vec3 vDent;
uniform sampler2D uField;
uniform sampler2D uSlope;
uniform sampler2D uPaint;
uniform vec3 uColor;
uniform float uPaintMix;
uniform float uMaterial;
uniform float uLight;
uniform float uInflate;
uniform mat3 uTurn;
uniform vec4 uParts[64];
uniform float uClock;
out vec4 outColor;

float arrival(float delay) {
  float t = max(uClock - delay, 0.0);
  float omega = 15.0;
  float zeta = 0.38;
  float damped = omega * sqrt(1.0 - zeta * zeta);
  return 1.0 - exp(-zeta * omega * t) * (cos(damped * t) + zeta * omega / damped * sin(damped * t));
}

float owner(vec2 rest) {
  ivec2 size = textureSize(uField, 0);
  ivec2 texel = clamp(ivec2(rest * vec2(size)), ivec2(0), size - 1);
  return floor(texelFetch(uField, texel, 0).w + 0.5);
}

vec3 settle(vec2 rest) {
  if (uClock > 9.0) return vec3(rest, 1.0);
  float id = owner(rest);
  if (id < 0.5 || id > 64.5) return vec3(rest, 1.0);
  vec4 part = uParts[int(id) - 1];
  float presence = arrival(part.z);
  float size = max(mix(0.5, 1.0, presence), 0.05);
  vec2 moved = part.xy + (rest - part.xy) / size;
  return vec3(moved, presence * step(abs(owner(moved) - id), 0.5));
}
vec4 cubic(float v) {
  vec4 n = vec4(1.0, 2.0, 3.0, 4.0) - v;
  vec4 s = n * n * n;
  float x = s.x;
  float y = s.y - 4.0 * s.x;
  float z = s.z - 4.0 * s.y + 6.0 * s.x;
  return vec4(x, y, z, 6.0 - x - y - z) / 6.0;
}

vec2 smoothSlope(vec2 uv) {
  vec2 size = vec2(textureSize(uSlope, 0));
  vec2 cell = uv * size - 0.5;
  vec2 f = fract(cell);
  cell -= f;
  vec4 xc = cubic(f.x);
  vec4 yc = cubic(f.y);
  vec4 corner = cell.xxyy + vec2(-0.5, 1.5).xyxy;
  vec4 sum = vec4(xc.xz + xc.yw, yc.xz + yc.yw);
  vec4 offset = (corner + vec4(xc.yw, yc.yw) / sum) / size.xxyy;
  vec2 a = texture(uSlope, offset.xz).xy;
  vec2 b = texture(uSlope, offset.yz).xy;
  vec2 c = texture(uSlope, offset.xw).xy;
  vec2 d = texture(uSlope, offset.yw).xy;
  float sx = sum.x / (sum.x + sum.y);
  float sy = sum.z / (sum.z + sum.w);
  return mix(mix(d, c, sx), mix(b, a, sx), sy);
}

// 椭圆面光源使用连续衰减，映到凸面上自然收成弧形，不留下矩形边角。
float areaReflection(vec3 direction, vec3 center, vec2 spread) {
  vec3 forward = normalize(center);
  vec3 side = normalize(cross(vec3(0.0, 1.0, 0.0), forward));
  vec3 lift = cross(forward, side);
  float facing = dot(direction, forward);
  vec2 local = vec2(dot(direction, side), dot(direction, lift)) / max(facing, 0.1);
  vec2 distance = local / spread;
  return exp(-2.0 * dot(distance, distance)) * smoothstep(0.05, 0.4, facing);
}

// 主高光留在左上外缘，右下仅保留局部辅助反射；不把环境亮线映成整圈轮廓。
// 清晰的椭圆亮芯与柔和底光分开控制，保留漆面的锐利反射和圆润过渡。
vec3 studio(vec3 r, float blur) {
  float elevation = smoothstep(-0.65, 0.85, r.y);
  vec3 environment = mix(vec3(0.10, 0.11, 0.13), vec3(0.58, 0.61, 0.66), elevation);
  vec3 keyDirection = vec3(-0.82, 0.92, -0.16);
  float halo = areaReflection(r, keyDirection, vec2(0.70, 0.44) + blur);
  float key = areaReflection(r, keyDirection, vec2(0.42, 0.16) + blur * 0.35);
  float rim = areaReflection(r, vec3(0.96, -0.34, -0.26), vec2(0.30, 0.20) + blur * 0.5);
  return environment + vec3(2.0) * halo + vec3(16.0) * key + vec3(4.0) * rim;
}

vec3 tone(vec3 x) {
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}

void main() {
  vec3 arrived = settle(vRest);
  vec2 rest = arrived.xy;
  float presence = arrived.z;
  vec4 field = texture(uField, rest);
  float edge = field.y;
  float edgeWidth = max(fwidth(edge), 0.0001);
  if (edge < -3.0 * edgeWidth || presence <= 0.001) discard;
  float cover = clamp(edge / edgeWidth + 0.5, 0.0, 1.0);

  vec2 slope = smoothSlope(rest);
  mat2 strain = mat2(vStrain.xy, vStrain.zw);
  float area = max(determinant(strain), 0.2);
  float lift = uInflate * presence * inversesqrt(area);
  float keep = clamp(1.0 - vDent.x, 0.15, 1.6);
  vec2 restGradient = (slope * keep - field.x * vDent.yz) * lift;
  vec2 gradient = inverse(transpose(strain)) * restGradient;
  vec3 normal = normalize(vec3(-gradient.x, gradient.y, 1.0));
  float depth = field.x * keep * lift;

  vec3 turned = uTurn * normal;
  vec3 reflected = uTurn * reflect(vec3(0.0, 0.0, -1.0), normal);
  float footprint = length(fwidth(reflected));
  float facing = max(normal.z, 0.0);
  float fresnel = pow(1.0 - facing, 5.0);
  vec3 lightDir = normalize(vec3(-0.5, 0.62, 0.62));
  float wrap = max((dot(turned, lightDir) + 0.45) / 1.45, 0.0);
  float key = max(dot(turned, lightDir), 0.0);
  float occlusion = mix(0.55, 1.0, smoothstep(0.0, 12.0, depth));

  vec3 paint = texture(uPaint, rest).rgb;
  vec3 base = mix(uColor, paint, uPaintMix);
  vec3 color;
  if (uMaterial < 0.5) {
    vec3 env = studio(reflected, 0.025 + footprint * 0.45);
    float reflectance = 0.045 + 0.955 * fresnel;
    vec3 deep = base * base * 0.55;
    vec3 body = mix(deep, base * 1.08, wrap) * occlusion;
    body += base * pow(1.0 - facing, 2.0) * 0.18;
    color = body * (1.0 - reflectance) + tone(env * reflectance * 0.9);
  } else if (uMaterial < 1.5) {
    vec3 env = studio(reflected, footprint * 0.6);
    vec3 tint = mix(vec3(1.0), base, 0.6) * 0.92;
    vec3 reflectance = tint + (1.0 - tint) * fresnel;
    color = tone(env * reflectance * mix(0.55, 1.0, occlusion) * 1.1);
  } else if (uMaterial < 2.5) {
    vec3 env = studio(reflected, 0.03 + footprint * 0.6);
    float core = smoothstep(0.0, 1.0, facing);
    vec3 glow = mix(base * base * 0.35, min(base * 1.45 + 0.08, vec3(1.0)), core * core);
    vec3 body = glow * mix(0.7, 1.0, occlusion) + base * wrap * 0.18;
    float reflectance = 0.03 + 0.97 * fresnel;
    color = body * (1.0 - reflectance) + tone(env * reflectance * 0.85);
  } else {
    vec3 env = studio(reflected, 0.35 + footprint * 0.6);
    vec3 body = base * (0.3 + 0.7 * wrap) * mix(0.68, 1.0, occlusion);
    body += base * key * 0.12;
    color = body + tone(env * (0.012 + 0.18 * fresnel)) * 0.5;
  }
  float alpha = cover * smoothstep(0.0, 0.18, presence);
  outColor = vec4(color * alpha, alpha);
}`;
const MATERIALS = { balloon: 0, chrome: 1, jelly: 2, clay: 3 };

const MAX_FIELD = 720;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const compile = (gl, type, source) => {
    const shader = gl.createShader(type);
    if (!shader)
        return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (gl.getShaderParameter(shader, gl.COMPILE_STATUS))
        return shader;
    gl.deleteShader(shader);
    return null;
};
const link = (gl, fragmentSource) => {
    const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX);
    const fragment = compile(gl, gl.FRAGMENT_SHADER, fragmentSource);
    const program = gl.createProgram();
    if (!vertex || !fragment || !program)
        return null;
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.bindAttribLocation(program, 0, 'aPosition');
    gl.bindAttribLocation(program, 1, 'aRest');
    gl.bindAttribLocation(program, 2, 'aStrain');
    gl.bindAttribLocation(program, 3, 'aDent');
    gl.linkProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    if (gl.getProgramParameter(program, gl.LINK_STATUS))
        return program;
    gl.deleteProgram(program);
    return null;
};
const locate = (gl, program, names) => {
    const result = {};
    for (const name of names)
        result[name] = gl.getUniformLocation(program, name);
    return result;
};
const distance1d = (f, n, d, v, z) => {
    let k = 0;
    v[0] = 0;
    z[0] = -Infinity;
    z[1] = Infinity;
    for (let q = 1; q < n; q++) {
        let s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
        while (s <= z[k]) {
            k--;
            s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
        }
        k++;
        v[k] = q;
        z[k] = s;
        z[k + 1] = Infinity;
    }
    k = 0;
    for (let q = 0; q < n; q++) {
        while (z[k + 1] < q)
            k++;
        d[q] = (q - v[k]) * (q - v[k]) + f[v[k]];
    }
};
const distanceField = (grid, width, height) => {
    const n = Math.max(width, height);
    const f = new Float64Array(n);
    const d = new Float64Array(n);
    const v = new Int32Array(n);
    const z = new Float64Array(n + 1);
    for (let x = 0; x < width; x++) {
        for (let y = 0; y < height; y++)
            f[y] = grid[y * width + x];
        distance1d(f, height, d, v, z);
        for (let y = 0; y < height; y++)
            grid[y * width + x] = d[y];
    }
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++)
            f[x] = grid[y * width + x];
        distance1d(f, width, d, v, z);
        for (let x = 0; x < width; x++)
            grid[y * width + x] = Math.sqrt(d[x]);
    }
    return grid;
};

const inflateField = (mask, width, height) => {
    const levels = [{ width, height, mask }];
    while (Math.max(levels[levels.length - 1].width, levels[levels.length - 1].height) > 48) {
        const prev = levels[levels.length - 1];
        const w = Math.ceil(prev.width / 2);
        const h = Math.ceil(prev.height / 2);
        const next = new Float32Array(w * h);
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                let sum = 0;
                let count = 0;
                for (let dy = 0; dy < 2; dy++) {
                    for (let dx = 0; dx < 2; dx++) {
                        const sx = x * 2 + dx;
                        const sy = y * 2 + dy;
                        if (sx < prev.width && sy < prev.height) {
                            sum += prev.mask[sy * prev.width + sx];
                            count++;
                        }
                    }
                }
                next[y * w + x] = sum / count;
            }
        }
        levels.push({ width: w, height: h, mask: next });
    }
    let solution = null;
    for (let level = levels.length - 1; level >= 0; level--) {
        const { width: w, height: h, mask: m } = levels[level];
        const current = new Float32Array(w * h);
        if (solution) {
            const pw = levels[level + 1].width;
            const ph = levels[level + 1].height;
            for (let y = 0; y < h; y++) {
                for (let x = 0; x < w; x++) {
                    const fx = clamp((x + 0.5) / 2 - 0.5, 0, pw - 1);
                    const fy = clamp((y + 0.5) / 2 - 0.5, 0, ph - 1);
                    const x0 = Math.floor(fx);
                    const y0 = Math.floor(fy);
                    const x1 = Math.min(pw - 1, x0 + 1);
                    const y1 = Math.min(ph - 1, y0 + 1);
                    const tx = fx - x0;
                    const ty = fy - y0;
                    const top = solution[y0 * pw + x0] * (1 - tx) + solution[y0 * pw + x1] * tx;
                    const bottom = solution[y1 * pw + x0] * (1 - tx) + solution[y1 * pw + x1] * tx;
                    current[y * w + x] = top * (1 - ty) + bottom * ty;
                }
            }
        }
        const source = 4 ** level;
        const iterations = level === levels.length - 1 ? 300 : 60;
        for (let iteration = 0; iteration < iterations; iteration++) {
            for (let y = 0; y < h; y++) {
                for (let x = 0; x < w; x++) {
                    const i = y * w + x;
                    if (m[i] < 0.5) {
                        current[i] = 0;
                        continue;
                    }
                    const l = x > 0 ? current[i - 1] : 0;
                    const r = x < w - 1 ? current[i + 1] : 0;
                    const u = y > 0 ? current[i - w] : 0;
                    const d = y < h - 1 ? current[i + w] : 0;
                    current[i] += ((l + r + u + d + source) * 0.25 - current[i]) * 1.85;
                }
            }
        }
        solution = current;
    }
    return solution;
};
const blurField = (source, width, height, radius) => {
    const r = Math.max(1, Math.round(radius));
    const sigma = r / 2.5;
    const kernel = [];
    let total = 0;
    for (let i = -r; i <= r; i++) {
        const weight = Math.exp(-(i * i) / (2 * sigma * sigma));
        kernel.push(weight);
        total += weight;
    }
    for (let i = 0; i < kernel.length; i++)
        kernel[i] /= total;
    const temp = new Float32Array(width * height);
    const out = new Float32Array(width * height);
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            let sum = 0;
            for (let i = -r; i <= r; i++)
                sum += source[y * width + clamp(x + i, 0, width - 1)] * kernel[i + r];
            temp[y * width + x] = sum;
        }
    }
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            let sum = 0;
            for (let i = -r; i <= r; i++)
                sum += temp[clamp(y + i, 0, height - 1) * width + x] * kernel[i + r];
            out[y * width + x] = sum;
        }
    }
    return out;
};

// 沿用字标的充气表面；软胶单独校准环境反射，避免大面积身体出现亮带和灯条弧线。
const surfaceField = (binary, signed, width, height, scale, owners, shadowMask) => {
    const count = width * height;
    const solution = blurField(inflateField(binary, width, height), width, height, 2);
    const edges = blurField(signed, width, height, 2);
    const field = new Float32Array(count * 4);
    const sdf = new Float32Array(count);
    const heights = new Float32Array(count);
    for (let i = 0; i < count; i++) {
        const distance = edges[i] / scale;
        sdf[i] = distance;
        heights[i] = Math.sqrt(Math.max(0, 2 * solution[i])) / scale;
        field[i * 4] = heights[i];
        field[i * 4 + 1] = distance;
        field[i * 4 + 2] = shadowMask?.[i] ?? 0;
        field[i * 4 + 3] = owners?.[i] ?? 0;
    }
    const slopes = new Float32Array(count * 2);
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = y * width + x;
            let gx = (heights[y * width + Math.min(width - 1, x + 1)] - heights[y * width + Math.max(0, x - 1)]) * 0.5 * scale;
            let gy = (heights[Math.min(height - 1, y + 1) * width + x] - heights[Math.max(0, y - 1) * width + x]) * 0.5 * scale;
            const steep = Math.hypot(gx, gy);
            if (steep > 7) {
                gx *= 7 / steep;
                gy *= 7 / steep;
            }
            slopes[i * 2] = gx;
            slopes[i * 2 + 1] = gy;
        }
    }
    return { field, slopes, sdf };
};

const loadBalloonField = async (source) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = () => reject(new Error('balloon: mask unavailable'));
        image.src = source;
    });
    const width = image.naturalWidth;
    const height = image.naturalHeight;
    if (!width || !height) throw new Error('balloon: invalid atlas');
    const scale = Math.min(1, MAX_FIELD / Math.max(width, height));
    const fw = Math.max(8, Math.round(width * scale));
    const fh = Math.max(8, Math.round(height * scale));
    const mask = document.createElement('canvas');
    mask.width = fw;
    mask.height = fh;
    const context = mask.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('balloon: canvas unavailable');
    context.drawImage(image, 0, 0, fw, fh);
    const pixels = context.getImageData(0, 0, fw, fh).data;
    const count = fw * fh;
    const binary = new Float32Array(count);
    const inside = new Float64Array(count);
    const outside = new Float64Array(count);
    for (let i = 0; i < count; i++) {
        const a = pixels[i * 4 + 3] / 255;
        binary[i] = a > 0.5 ? 1 : 0;
        inside[i] = a > 0.5 ? 1e10 : 0;
        outside[i] = a > 0.5 ? 0 : 1e10;
    }
    distanceField(inside, fw, fh);
    distanceField(outside, fw, fh);
    const signed = new Float32Array(count);
    for (let i = 0; i < count; i++) {
        const a = pixels[i * 4 + 3] / 255;
        signed[i] = a > 0.02 && a < 0.98 ? a - 0.5 : inside[i] > 0 ? inside[i] - 0.5 : 0.5 - outside[i];
    }
    const { field, slopes } = surfaceField(binary, signed, fw, fh, scale);
    mask.width = mask.height = 1;
    return { width, height, fw, fh, field, slopes };
};

// 高度和法线只随轮廓图集变化，单份缓存让换色只重绘光照，不重复求解高度场。
let balloonAtlas;
const prepareBalloonField = (source) => {
    if (balloonAtlas?.source === source) return balloonAtlas.pending;
    const pending = loadBalloonField(source);
    balloonAtlas = { source, pending };
    pending.catch(() => {
        if (balloonAtlas?.pending === pending) balloonAtlas = undefined;
    });
    return pending;
};

/** 将 Bloub 轮廓图集一次烘焙为开屏 balloon 材质；返回前释放临时 GPU 上下文。 */
export async function bakeBalloonMaterial(source, color) {
    if (!/^#[0-9a-f]{6}$/i.test(color)) throw new Error('balloon: invalid color');
    const { width, height, fw, fh, field, slopes } = await prepareBalloonField(source);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const gl = canvas.getContext('webgl2', {
        alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false,
    });
    if (!gl) throw new Error('balloon: WebGL unavailable');
    let program;
    let buffer;
    const textures = [];
    try {
        program = link(gl, SURFACE);
        if (!program) throw new Error('balloon: shader unavailable');
        const uniforms = locate(gl, program, [
            'uViewport', 'uOffset', 'uField', 'uPaint', 'uSlope', 'uColor',
            'uPaintMix', 'uMaterial', 'uLight', 'uInflate', 'uTurn', 'uClock',
        ]);
        buffer = gl.createBuffer();
        if (!buffer) throw new Error('balloon: buffer unavailable');
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
            0, 0, 0, 0, width, 0, 1, 0, 0, height, 0, 1,
            0, height, 0, 1, width, 0, 1, 0, width, height, 1, 1,
        ]), gl.STATIC_DRAW);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 16, 0);
        gl.enableVertexAttribArray(1);
        gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 16, 8);
        gl.vertexAttrib4f(2, 1, 0, 0, 1);
        gl.vertexAttrib3f(3, 0, 0, 0);
        for (let unit = 0; unit < 3; unit++) {
            const texture = gl.createTexture();
            if (!texture) throw new Error('balloon: texture unavailable');
            textures.push(texture);
            gl.activeTexture(gl.TEXTURE0 + unit);
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            if (unit === 0)
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, fw, fh, 0, gl.RGBA, gl.FLOAT, field);
            else if (unit === 2)
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG16F, fw, fh, 0, gl.RG, gl.FLOAT, slopes);
            else
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
        }
        gl.useProgram(program);
        gl.uniform2f(uniforms.uViewport, width, height);
        gl.uniform2f(uniforms.uOffset, 0, 0);
        gl.uniform1i(uniforms.uField, 0);
        gl.uniform1i(uniforms.uPaint, 1);
        gl.uniform1i(uniforms.uSlope, 2);
        const hex = Number.parseInt(color.slice(1), 16);
        gl.uniform3f(uniforms.uColor, ((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255);
        gl.uniform1f(uniforms.uPaintMix, 0);
        gl.uniform1f(uniforms.uMaterial, MATERIALS.balloon);
        // 固定摄影棚环境让同一颜色的头像在浅暗主题中保留相同材质。
        gl.uniform1f(uniforms.uLight, 1);
        gl.uniform1f(uniforms.uInflate, 1);
        gl.uniform1f(uniforms.uClock, 10);
        gl.uniformMatrix3fv(uniforms.uTurn, false, new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]));
        gl.viewport(0, 0, width, height);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        if (gl.isContextLost() || gl.getError() !== gl.NO_ERROR)
            throw new Error('balloon: rendering failed');
        // 编码从 2D 快照读取，等待 toBlob 时不占用头像列表的 WebGL 上下文配额。
        const output = document.createElement('canvas');
        output.width = width;
        output.height = height;
        const target = output.getContext('2d');
        if (!target) throw new Error('balloon: snapshot unavailable');
        target.drawImage(canvas, 0, 0);
        return new Promise((resolve, reject) => {
            output.toBlob((blob) => {
                if (!blob) { reject(new Error('balloon: encoding failed')); return; }
                const reader = new FileReader();
                reader.onload = () => typeof reader.result === 'string'
                    ? resolve(reader.result) : reject(new Error('balloon: encoding failed'));
                reader.onerror = () => reject(reader.error ?? new Error('balloon: encoding failed'));
                reader.readAsDataURL(blob);
            }, 'image/png');
        });
    } finally {
        for (const texture of textures) gl.deleteTexture(texture);
        if (buffer) gl.deleteBuffer(buffer);
        if (program) gl.deleteProgram(program);
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        canvas.width = canvas.height = 1;
    }
}
