/**
 * Procedural CanvasTextures for the house environment — no image files, so the
 * build stays self-contained. Kept subtle so they read well against the dark
 * scene background and don't compete with the device glows.
 */
import { CanvasTexture, RepeatWrapping, SRGBColorSpace, type Texture } from "three";

function canvas(size = 256): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  return [c, c.getContext("2d")!];
}

function wrap(c: HTMLCanvasElement, repeat = 2): CanvasTexture {
  const t = new CanvasTexture(c);
  t.wrapS = t.wrapT = RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function buildStucco(base: string): CanvasTexture {
  const [c, ctx] = canvas(256);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 300; i++) {
    const a = 0.02 + Math.random() * 0.05;
    ctx.fillStyle = Math.random() > 0.5 ? `rgba(255,250,235,${a})` : `rgba(20,18,14,${a})`;
    ctx.beginPath();
    ctx.arc(Math.random() * 256, Math.random() * 256, 6 + Math.random() * 26, 0, Math.PI * 2);
    ctx.fill();
  }
  return wrap(c, 3);
}

function buildTerracotta(): CanvasTexture {
  const [c, ctx] = canvas(256);
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, "#8a4433");
  g.addColorStop(1, "#6d3628");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  for (let x = 0; x < 256; x += 20) {
    ctx.fillStyle = "rgba(255,170,130,0.10)";
    ctx.fillRect(x, 0, 4, 256);
    ctx.fillStyle = "rgba(20,8,4,0.18)";
    ctx.fillRect(x + 14, 0, 5, 256);
  }
  for (let y = 0; y < 256; y += 40) {
    ctx.fillStyle = "rgba(15,6,3,0.30)";
    ctx.fillRect(0, y, 256, 3);
  }
  return wrap(c, 1);
}

function buildGravel(): CanvasTexture {
  const [c, ctx] = canvas(256);
  ctx.fillStyle = "#5b5751";
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 4000; i++) {
    const v = 70 + Math.random() * 60;
    ctx.fillStyle = `rgba(${v},${v - 6},${v - 16},0.7)`;
    ctx.fillRect(Math.random() * 256, Math.random() * 256, 1.5, 1.5);
  }
  return wrap(c, 5);
}

function buildSolarPanel(): CanvasTexture {
  // Dark blue-black PV cell grid with subtle grid lines and glossy sheen.
  // Same canvas technique as stucco/terracotta — no new deps.
  const [c, ctx] = canvas(512);

  // Base: deep blue-black
  const bg = ctx.createLinearGradient(0, 0, 512, 512);
  bg.addColorStop(0, "#0a0e18");
  bg.addColorStop(1, "#070c14");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 512, 512);

  const COLS = 6;
  const ROWS = 10;
  const cellW = 512 / COLS;
  const cellH = 512 / ROWS;
  const gap = 3;

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const x = col * cellW + gap;
      const y = row * cellH + gap;
      const w = cellW - gap * 2;
      const h = cellH - gap * 2;

      // Cell body — very dark blue with slight gradient to simulate anti-reflective coating
      const cg = ctx.createLinearGradient(x, y, x + w, y + h);
      cg.addColorStop(0, "#0d1529");
      cg.addColorStop(0.5, "#0f1b35");
      cg.addColorStop(1, "#0a1220");
      ctx.fillStyle = cg;
      ctx.fillRect(x, y, w, h);

      // Subtle finger-line grid inside each cell (monocrystalline look)
      ctx.strokeStyle = "rgba(30,60,120,0.25)";
      ctx.lineWidth = 0.5;
      for (let fx = x + w / 4; fx < x + w; fx += w / 4) {
        ctx.beginPath(); ctx.moveTo(fx, y); ctx.lineTo(fx, y + h); ctx.stroke();
      }
      for (let fy = y + h / 3; fy < y + h; fy += h / 3) {
        ctx.beginPath(); ctx.moveTo(x, fy); ctx.lineTo(x + w, fy); ctx.stroke();
      }

      // Gloss highlight — top-left corner specular
      const gl = ctx.createRadialGradient(x + 4, y + 4, 0, x + 4, y + 4, w * 0.6);
      gl.addColorStop(0,   "rgba(100,160,255,0.10)");
      gl.addColorStop(0.4, "rgba(60,100,200,0.04)");
      gl.addColorStop(1,   "rgba(0,0,0,0)");
      ctx.fillStyle = gl;
      ctx.fillRect(x, y, w, h);
    }
  }

  // Grid lines (cell borders) — dark separator
  ctx.strokeStyle = "rgba(0,0,0,0.8)";
  ctx.lineWidth = gap;
  for (let col = 1; col < COLS; col++) {
    ctx.beginPath(); ctx.moveTo(col * cellW, 0); ctx.lineTo(col * cellW, 512); ctx.stroke();
  }
  for (let row = 1; row < ROWS; row++) {
    ctx.beginPath(); ctx.moveTo(0, row * cellH); ctx.lineTo(512, row * cellH); ctx.stroke();
  }

  // Frame border — aluminium grey
  ctx.strokeStyle = "rgba(140,150,160,0.6)";
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, 508, 508);

  return wrap(c, 1);
}

let _stucco: CanvasTexture | null = null;
let _terra: CanvasTexture | null = null;
let _gravel: CanvasTexture | null = null;
let _solar: CanvasTexture | null = null;

export function stuccoTexture(): Texture {
  return (_stucco ??= buildStucco("#b7ad97"));
}
export function terracottaTexture(): Texture {
  return (_terra ??= buildTerracotta());
}
export function gravelTexture(): Texture {
  return (_gravel ??= buildGravel());
}
export function solarPanelTexture(): Texture {
  return (_solar ??= buildSolarPanel());
}
