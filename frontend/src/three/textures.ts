/**
 * Procedural CanvasTextures — no image files, so the app stays offline-safe and
 * loads instantly. These give the primitives a believable material read:
 * troweled lime stucco, terracotta pantiles, raked gravel.
 *
 * Each factory is memoised at module scope (textures are immutable + shared).
 */
import {
  CanvasTexture,
  RepeatWrapping,
  SRGBColorSpace,
  type Texture,
} from 'three';

function makeCanvas(size = 512): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  return [c, ctx];
}

function finish(canvas: HTMLCanvasElement, repeat = 1, color = true): CanvasTexture {
  const tex = new CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  if (color) tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** Soft mottled plaster. `base` is the wall colour. */
function buildStucco(base: string): CanvasTexture {
  const [c, ctx] = makeCanvas(512);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 512, 512);
  // low-frequency blotches
  for (let i = 0; i < 900; i++) {
    const r = 12 + Math.random() * 60;
    const a = 0.015 + Math.random() * 0.04;
    ctx.fillStyle = Math.random() > 0.5 ? `rgba(255,250,235,${a})` : `rgba(120,100,75,${a})`;
    ctx.beginPath();
    ctx.arc(Math.random() * 512, Math.random() * 512, r, 0, Math.PI * 2);
    ctx.fill();
  }
  // fine grain
  const img = ctx.getImageData(0, 0, 512, 512);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 14;
    img.data[i] += n;
    img.data[i + 1] += n;
    img.data[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
  return finish(c, 3);
}

/** Terracotta pantile roof: warm clay with horizontal tile courses + barrels. */
function buildTerracotta(): CanvasTexture {
  const [c, ctx] = makeCanvas(512);
  const grd = ctx.createLinearGradient(0, 0, 0, 512);
  grd.addColorStop(0, '#c15a3c');
  grd.addColorStop(0.5, '#a8482f');
  grd.addColorStop(1, '#8f3b28');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, 512, 512);
  // vertical barrel highlights
  for (let x = 0; x < 512; x += 32) {
    ctx.fillStyle = 'rgba(255,190,150,0.18)';
    ctx.fillRect(x, 0, 6, 512);
    ctx.fillStyle = 'rgba(80,30,20,0.22)';
    ctx.fillRect(x + 22, 0, 8, 512);
  }
  // horizontal course shadows
  for (let y = 0; y < 512; y += 64) {
    ctx.fillStyle = 'rgba(60,20,15,0.35)';
    ctx.fillRect(0, y, 512, 5);
    ctx.fillStyle = 'rgba(255,200,160,0.15)';
    ctx.fillRect(0, y + 6, 512, 3);
  }
  // weather blotches / lichen
  for (let i = 0; i < 260; i++) {
    ctx.fillStyle =
      Math.random() > 0.6 ? 'rgba(150,150,110,0.10)' : 'rgba(70,25,18,0.12)';
    ctx.beginPath();
    ctx.arc(Math.random() * 512, Math.random() * 512, 4 + Math.random() * 16, 0, Math.PI * 2);
    ctx.fill();
  }
  return finish(c, 1);
}

/** Pale raked gravel for the forecourt. */
function buildGravel(): CanvasTexture {
  const [c, ctx] = makeCanvas(512);
  ctx.fillStyle = '#c9bfa6';
  ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 9000; i++) {
    const g = 150 + Math.random() * 90;
    ctx.fillStyle = `rgba(${g},${g - 12},${g - 34},${0.5 + Math.random() * 0.4})`;
    ctx.fillRect(Math.random() * 512, Math.random() * 512, 1 + Math.random() * 2.4, 1 + Math.random() * 2.4);
  }
  return finish(c, 6);
}

/** Rough limestone / rendered wall for the boundary wall + quoins. */
function buildStone(): CanvasTexture {
  const [c, ctx] = makeCanvas(512);
  ctx.fillStyle = '#d9cdb2';
  ctx.fillRect(0, 0, 512, 512);
  for (let y = 0; y < 512; y += 64) {
    const offset = (y / 64) % 2 ? 48 : 0;
    for (let x = -96; x < 512; x += 96) {
      ctx.fillStyle = `hsl(40, ${18 + Math.random() * 12}%, ${72 + Math.random() * 12}%)`;
      ctx.fillRect(x + offset + 2, y + 2, 92, 60);
      ctx.strokeStyle = 'rgba(120,105,80,0.45)';
      ctx.strokeRect(x + offset + 2, y + 2, 92, 60);
    }
  }
  const img = ctx.getImageData(0, 0, 512, 512);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 22;
    img.data[i] += n;
    img.data[i + 1] += n;
    img.data[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
  return finish(c, 2);
}

let _stuccoCream: CanvasTexture | null = null;
let _terracotta: CanvasTexture | null = null;
let _gravel: CanvasTexture | null = null;
let _stone: CanvasTexture | null = null;

export function stuccoTexture(): Texture {
  return (_stuccoCream ??= buildStucco('#e9dcc2'));
}
export function terracottaTexture(): Texture {
  return (_terracotta ??= buildTerracotta());
}
export function gravelTexture(): Texture {
  return (_gravel ??= buildGravel());
}
export function stoneTexture(): Texture {
  return (_stone ??= buildStone());
}
