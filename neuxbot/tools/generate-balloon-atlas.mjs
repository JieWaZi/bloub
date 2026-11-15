import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

// 软胶只提供通用轮廓遮罩；光照由宿主与开屏共用的材质着色器计算。
const root = new URL("../", import.meta.url);
const bundled = await build({
  stdin: {
    contents: `export { SHAPES } from './src/bot/skins.ts';
      export { closedPath, toPoints } from './src/bot/shape.ts';`,
    resolveDir: fileURLToPath(root),
  },
  bundle: true,
  write: false,
  format: "esm",
  platform: "node",
});
const { SHAPES, closedPath, toPoints } = await import(
  `data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString("base64")}`
);
const metadata = new URL("materials/sprites.json", root);
const sprites = JSON.parse(await readFile(metadata, "utf8"));
const cell = 362;
const size = 316;
const shapes = sprites.shapes.map((id, index) => {
  const shape = SHAPES.find((item) => item.id === id);
  if (!shape) throw new Error(`Unknown body shape: ${id}`);
  const path = closedPath(
    toPoints({ radii: shape.radii, rot: 0, cx: 0, cy: 0, sx: 1, sy: 1 }, 100),
  );
  const x = (index % sprites.columns) * size + size / 2;
  const y = Math.floor(index / sprites.columns) * size + size / 2;
  return `<path id="shape-${id}" transform="translate(${x} ${y})" d="${path}"/>`;
});
const width = sprites.columns * cell;
const height = sprites.rows * cell;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${sprites.columns * size} ${sprites.rows * size}" fill="#fff">\n${shapes.join("\n")}\n</svg>\n`;
const atlas = new URL("materials/body-balloon.svg", root);
sprites.materials.balloon = {
  file: "body-balloon.svg",
  width,
  height,
  visualScale: 1,
};
const json = `${JSON.stringify(sprites, null, 2)}\n`;
if (process.argv.includes("--check")) {
  if (
    (await readFile(atlas, "utf8")) !== svg ||
    (await readFile(metadata, "utf8")) !== json
  )
    throw new Error("Balloon atlas is out of date");
} else {
  await writeFile(atlas, svg);
  await writeFile(metadata, json);
}
