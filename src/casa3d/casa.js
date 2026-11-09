import * as THREE from 'three';
import { ALTURA, MURO_ALTO, MURO_BAJO, PLANTAS, TEJADOS, JARDIN, FOCO, GARAJE } from './datos.js';
import { enfocar } from './foco.js';
import { construirSuciedad, construirBrillos, construirMohoParedes } from './suciedad.js';
import { Lote, Materiales, CX, CZ, azar } from './geometria.js';
import { texturaSombra, texturaCirculo, texturaHaloZonas } from './texturas.js';
import { SUCIEDAD } from './estilos.js';

// ---------- piezas sueltas ----------

// Coordenadas de un mueble según hacia dónde mira su frente (n, s, e, w):
// u va a lo ancho del frente, v hacia el fondo (0 = cara de delante; negativo = delante del mueble), z es la altura
function frente(c, mira) {
  const { x0, y0, x1, y1 } = c;
  const horiz = mira === 'n' || mira === 's';
  const W = horiz ? x1 - x0 : y1 - y0;
  const D = horiz ? y1 - y0 : x1 - x0;
  const pt = (u, v) => {
    if (mira === 'n') return [x0 + u, y0 + v];
    if (mira === 's') return [x1 - u, y1 - v];
    if (mira === 'e') return [x1 - v, y0 + u];
    return [x0 + v, y1 - u];
  };
  const caja = (L, key, u0, v0, z0, u1, v1, z1, o) => {
    const [ax, ay] = pt(u0, v0);
    const [bx, by] = pt(u1, v1);
    L.caja(key, ax, ay, z0, bx, by, z1, o);
  };
  const uDe = ([px, py]) => (mira === 'n' ? px - x0 : mira === 's' ? x1 - px : mira === 'e' ? py - y0 : y1 - py);
  // giro (alrededor de la vertical) que lleva el eje x de una caja a la dirección u del frente
  const du = [pt(1, 0)[0] - pt(0, 0)[0], pt(1, 0)[1] - pt(0, 0)[1]];
  const giroU = Math.atan2(-du[1], du[0]);
  return { W, D, pt, caja, horiz, giroU, uDe };
}

const OPUESTO = { n: 's', s: 'n', e: 'w', w: 'e' };

// lado del plano (n, s, e, w) hacia el que queda un punto respecto al centro del mueble
function ladoDe(c, [px, py]) {
  const dx = px - (c.x0 + c.x1) / 2, dy = py - (c.y0 + c.y1) / 2;
  return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'e' : 'w') : (dy > 0 ? 's' : 'n');
}

const semillaDe = (c) => Math.round(c.x0 * 131 + c.y0 * 71 + c.x1 * 17 + c.y1 * 7);

// silla: «mira» es hacia donde mira quien se sienta; k.asiento y k.patas, los colores (de madera si no se dice)
function silla(L, cx, cy, mira, b, k = {}) {
  const asiento = k.asiento || 'madera', patas = k.patas || 'madera_osc';
  L.caja(asiento, cx - 0.2, cy - 0.2, b + 0.42, cx + 0.2, cy + 0.2, b + 0.47);
  for (const [dx, dy] of [[-0.16, -0.16], [0.16, -0.16], [-0.16, 0.16], [0.16, 0.16]]) {
    L.caja(patas, cx + dx - 0.025, cy + dy - 0.025, b, cx + dx + 0.025, cy + dy + 0.025, b + 0.42, { redondeo: 0.005 });
  }
  if (mira === 's') L.caja(asiento, cx - 0.2, cy - 0.2, b + 0.47, cx + 0.2, cy - 0.15, b + 0.9);
  if (mira === 'n') L.caja(asiento, cx - 0.2, cy + 0.15, b + 0.47, cx + 0.2, cy + 0.2, b + 0.9);
  if (mira === 'e') L.caja(asiento, cx - 0.2, cy - 0.2, b + 0.47, cx - 0.15, cy + 0.2, b + 0.9);
  if (mira === 'w') L.caja(asiento, cx + 0.15, cy - 0.2, b + 0.47, cx + 0.2, cy + 0.2, b + 0.9);
}

// silla tumbada boca arriba: respaldo en el suelo, asiento de pie y patas al aire
function sillaTirada(L, cx, cy, b, g, k = {}) {
  const asiento = k.asiento || 'madera', patas = k.patas || 'madera_osc';
  const ey = [Math.sin(g), Math.cos(g)];     // eje «y» de la silla después del giro
  const ex = [Math.cos(g), -Math.sin(g)];
  L.cajaCentro(asiento, cx, cy, b, 0.4, 0.46, 0.05, g, { redondeo: 0.01 });
  const sx = cx + ey[0] * 0.25, sy = cy + ey[1] * 0.25;
  L.cajaCentro(asiento, sx, sy, b, 0.4, 0.05, 0.42, g, { redondeo: 0.01 });
  for (const s of [-1, 1]) {
    const px = sx + ex[0] * s * 0.16, py = sy + ex[1] * s * 0.16;
    for (const h of [0.05, 0.37]) L.barra(patas, px, py, px + ey[0] * 0.42, py + ey[1] * 0.42, b + h, 0.025, { segs: 6 });
  }
}

function sillasDe(c) {
  const { x0, y0, x1, y1 } = c;
  const n = c.sillas || 0;
  const lista = [];
  if (n && c.eje === 'h') {
    const w = (x1 - x0) / n;
    for (let i = 0; i < n; i++) {
      const cx = x0 + w * (i + 0.5);
      lista.push([cx, y0 - 0.3, 's'], [cx, y1 + 0.3, 'n']);
    }
  } else if (n) {
    const w = (y1 - y0) / n;
    for (let i = 0; i < n; i++) {
      const cy = y0 + w * (i + 0.5);
      lista.push([x0 - 0.3, cy, 'e'], [x1 + 0.3, cy, 'w']);
    }
  }
  return lista;
}

function mesa(L, c, x, alto = 0.74) {
  const b = x.b;
  const { x0, y0, x1, y1 } = c;
  const n = c.sillas || 0;
  const tapa = c.tapa || 'madera', patas = c.patas || 'madera_osc';
  const ks = { asiento: c.silla, patas: c.sillaPatas };
  const pa = [[x0 + 0.08, y0 + 0.08], [x1 - 0.08, y0 + 0.08], [x0 + 0.08, y1 - 0.08], [x1 - 0.08, y1 - 0.08]];
  if (!x.ruina) {
    L.caja(tapa, x0, y0, b + alto - 0.05, x1, y1, b + alto);
    for (const [px, py] of pa) L.caja(patas, px - 0.04, py - 0.04, b, px + 0.04, py + 0.04, b + alto - 0.05);
    for (const [cx, cy, m] of sillasDe(c)) silla(L, cx, cy, m, b, ks);
  } else {
    // tablero partido: un extremo en el suelo y el otro sobre las dos patas que aguantan
    const r = azar(semillaDe(c));
    const largoX = x1 - x0 >= y1 - y0;
    const lg = largoX ? x1 - x0 : y1 - y0, an = largoX ? y1 - y0 : x1 - x0;
    const ang = Math.asin(Math.min(0.85, (alto - 0.1) / lg));
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, hc = (alto - 0.05) / 2;
    if (largoX) L.cajaCentro(tapa, cx, cy, b + hc - 0.025, lg, an, 0.05, 0, { rueda: ang, redondeo: 0.01 });
    else L.cajaCentro(tapa, cx, cy, b + hc - 0.025, an, lg, 0.05, 0, { inclina: ang, redondeo: 0.01 });
    // con rueda > 0 sube el lado este; con inclina > 0, el lado norte
    const altas = largoX ? pa.filter(([px]) => px > cx) : pa.filter(([, py]) => py < cy);
    for (const [px, py] of altas) L.caja(patas, px - 0.04, py - 0.04, b, px + 0.04, py + 0.04, b + alto - 0.1);
    const [qx, qy] = largoX ? [x0 + 0.3, y1 + 0.15] : [x1 + 0.15, y1 - 0.3];
    L.barra(patas, qx, qy, qx + 0.55, qy + 0.25, b + 0.04, 0.04, { segs: 6 });
    for (const [sx, sy] of sillasDe(c)) {
      if (r() < 0.25) continue;   // alguna ni está
      sillaTirada(L, sx + (r() - 0.5) * 0.7, sy + (r() - 0.5) * 0.7, b, r() * Math.PI * 2, ks);
    }
  }
  x.sombra({ x0: x0 - (n ? 0.45 : 0.05), y0: y0 - (n ? 0.45 : 0.05), x1: x1 + (n ? 0.45 : 0.05), y1: y1 + (n ? 0.45 : 0.05) });
}

function planta(L, cx, cy, b, r = 0.22, ruina = false) {
  if (!ruina) {
    L.cilindro('maceta', cx, cy, b, b + 0.34, r * 0.8, { rArriba: r });
    L.esfera('planta', cx, cy, b + 0.68, r * 1.5, { escala: [1, 1.15, 1], detalle: 1 });
    return;
  }
  // tirada y seca: la maceta de lado, la tierra por el suelo y la planta mustia
  L.barra('maceta', cx - 0.17, cy, cx + 0.17, cy, b + r * 0.9, r * 0.9, { segs: 12 });
  L.cilindro('tierra', cx + 0.32, cy + 0.05, b, b + 0.025, r * 1.4, { segs: 12 });
  L.esfera('seca', cx + 0.42, cy + 0.12, b + 0.12, r * 0.9, { escala: [1.2, 0.55, 1], detalle: 1 });
  L.esfera('seca', cx + 0.2, cy - 0.15, b + 0.04, 0.07, { detalle: 0 });
  L.esfera('seca', cx + 0.55, cy - 0.1, b + 0.03, 0.06, { detalle: 0 });
}

// trozos de algo roto por el suelo
function trozos(L, key, cx, cy, b, n, r, tam = 0.16, radio = 0.45) {
  for (let k = 0; k < n; k++) {
    const s = tam * (0.5 + r());
    L.cajaCentro(key, cx + (r() - 0.5) * radio * 2, cy + (r() - 0.5) * radio * 2, b, s, s * (0.6 + r() * 0.7), s * (0.35 + r() * 0.4), r() * Math.PI, { redondeo: 0.01, inclina: (r() - 0.5) * 0.6 });
  }
}

// Ejes de una cosa girada: u a lo ancho, v hacia delante, centrada en (cx, cy) y con el frente hacia (fx, fy)
function girado(cx, cy, fx, fy) {
  const g = Math.atan2(fx, fy);
  const ex = [Math.cos(g), -Math.sin(g)], ey = [Math.sin(g), Math.cos(g)];
  const p = (u, v) => [cx + ex[0] * u + ey[0] * v, cy + ex[1] * u + ey[1] * v];
  const pieza = (L, key, u, v, z0, su, sv, sz, o = {}) => { const [px, py] = p(u, v); L.cajaCentro(key, px, py, z0, su, sv, sz, g, o); };
  return { g, p, pieza };
}

const DIAGONAL = { nw: [1, 1], ne: [-1, 1], sw: [1, -1], se: [-1, -1] };

// La chimenea de esquina, torcida: la espalda va de una pared a la otra (c.lado metros por cada pared)
// y el frente mira al centro del salón. (c.x0, c.y0) es la esquina de dentro de las paredes.
function esquinaDe(c) {
  const a = c.lado || 1.0;
  const [sx, sy] = DIAGONAL[c.esquina];
  const ex = sx > 0 ? c.x0 : c.x1, ey = sy > 0 ? c.y0 : c.y1;    // la esquina
  const mx = ex + sx * a / 2, my = ey + sy * a / 2;                // centro de la espalda
  return { a, ex, ey, sx, sy, G: girado(mx, my, sx / Math.SQRT2, sy / Math.SQRT2) };
}

function chimeneaEsquina(L, c, x) {
  const b = x.b;
  const { a, ex, ey, sx, sy, G } = esquinaDe(c);
  const ancho = a * Math.SQRT2 * 0.78;
  const relleno = (z0, z1, k) => L.caja(k, ex, ey, b + z0, ex + sx * a * 0.62, ey + sy * a * 0.62, b + z1, { redondeo: 0.01 });
  // el poyo de piedra, el cuerpo, el cristal del fuego y la repisa
  G.pieza(L, 'chimenea_piedra', 0, 0.3, b, ancho + 0.2, 0.8, 0.2, { redondeo: 0.02 });
  relleno(0, 1.15, 'chimenea_piedra');
  G.pieza(L, 'chimenea_piedra', 0, 0.24, b + 0.2, ancho, 0.48, 0.95, { redondeo: 0.02 });
  G.pieza(L, 'negro', 0, 0.48, b + 0.34, ancho * 0.56, 0.03, 0.52, { redondeo: 0.01 });
  if (!x.ruina) G.pieza(L, 'fuego', 0, 0.44, b + 0.38, ancho * 0.34, 0.06, 0.2, { redondeo: 0.02 });
  G.pieza(L, 'chimenea_piedra', 0, 0.26, b + 1.15, ancho + 0.14, 0.58, 0.08, { redondeo: 0.02 });
  if (x.ruina) {
    const [hx, hy] = G.p(0, 0.5);
    L.esfera('hollin', hx, hy, b + 0.9, 0.3, { escala: [1.3, 0.8, 0.3], detalle: 1 });
    const [tx, ty] = G.p(0.1, 0.95);
    trozos(L, 'chimenea_piedra', tx, ty, b, 5, azar(semillaDe(c)), 0.2, 0.4);
  }
  x.sombra({ x0: Math.min(ex, ex + sx * (a + 0.4)), y0: Math.min(ey, ey + sy * (a + 0.4)), x1: Math.max(ex, ex + sx * (a + 0.4)), y1: Math.max(ey, ey + sy * (a + 0.4)) });
}

const MUEBLES = {
  sofa(L, c, x) {
    const b = x.b, tela = c.tela || 'tela1';
    const resp = c.respaldo || 'n';
    const F = frente(c, OPUESTO[resp]);
    const { W, D } = F;
    const g = 0.2, bz = 0.17;
    // brazos en los dos extremos, salvo el que toca la otra parte del sofá en L (sinBrazo) o el que hace de respaldo (brazoAlto)
    const extremo = (u) => ladoDe(c, F.pt(u, D / 2));
    const izq = extremo(0), der = extremo(W);
    const tipo = (lado) => (c.brazoAlto === lado ? 'alto' : c.sinBrazo === lado ? 'no' : 'si');
    const ti = tipo(izq), td = tipo(der);
    F.caja(L, 'madera_osc', 0.06, 0.06, b, W - 0.06, D - 0.06, b + 0.1);
    F.caja(L, tela, 0, 0, b + 0.1, W, D - g, b + 0.3);
    F.caja(L, tela, 0, D - g, b + 0.1, W, D, b + 0.82);
    const brazo = (u0, u1, t) => {
      if (t === 'no') return;
      F.caja(L, tela, u0, 0, b + 0.1, u1, D - (t === 'alto' ? 0 : g * 0.5), b + (t === 'alto' ? 0.82 : 0.6));
    };
    const ai = ti === 'no' ? 0 : ti === 'alto' ? g : bz;
    const ad = td === 'no' ? 0 : td === 'alto' ? g : bz;
    brazo(0, ai, ti);
    brazo(W - ad, W, td);
    // cojines del asiento y del respaldo
    const ua = ai, ub = W - ad;
    const n = Math.max(1, Math.round((ub - ua) / 0.72));
    const w = (ub - ua) / n;
    const r = azar(semillaDe(c));
    const tirado = x.ruina ? Math.floor(r() * n) : -1;
    for (let i = 0; i < n; i++) {
      const u0 = ua + w * i + 0.015, u1 = ua + w * (i + 1) - 0.015;
      if (i !== tirado) F.caja(L, tela, u0, 0.02, b + 0.3, u1, D - g - 0.01, b + 0.45, { redondeo: 0.06 });
      F.caja(L, tela, u0, D - g - 0.15, b + 0.45, u1, D - g, b + 0.76, { redondeo: 0.06 });
    }
    if (x.ruina) {
      // un cojín en el suelo, rajas y el relleno saliéndose
      const [px, py] = F.pt(ua + w * (tirado + 0.5), -0.45);
      L.cajaCentro(tela, px, py, b, w - 0.05, D - g - 0.05, 0.14, F.giroU + 0.5, { redondeo: 0.05, inclina: 0.25 });
      for (let k = 0; k < 3; k++) {
        const u = ua + (ub - ua) * (0.15 + 0.3 * k + r() * 0.1);
        F.caja(L, 'agujero', u - 0.12, 0.12, b + 0.449, u + 0.1, D - g - 0.14, b + 0.456, { redondeo: 0 });
        const [sx, sy] = F.pt(u, (D - g) / 2);
        L.esfera('relleno', sx, sy, b + 0.47, 0.08, { detalle: 0 });
        L.esfera('relleno', sx + 0.08, sy + 0.04, b + 0.5, 0.06, { detalle: 0 });
        F.caja(L, 'agujero', u - 0.1, D - g - 0.155, b + 0.5, u + 0.08, D - g - 0.15, b + 0.7, { redondeo: 0 });
      }
    }
    x.sombra(c);
  },
  butaca(L, c, x) {
    // butaca suelta, girada hacia el centro de la habitación (mira: 'sw', 'se', 'nw', 'ne' o un lado)
    const b = x.b, tela = c.tela || 'tela1';
    const cx = (c.x0 + c.x1) / 2, cy = (c.y0 + c.y1) / 2;
    const dirs = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0], sw: [-1, 1], se: [1, 1], nw: [-1, -1], ne: [1, -1] };
    const [fx, fy] = dirs[c.mira || 's'];
    const g = Math.atan2(fx, fy);                       // el eje «y» de la butaca apunta hacia delante
    const ex = [Math.cos(g), -Math.sin(g)], ey = [Math.sin(g), Math.cos(g)];
    const p = (lx, ly) => [cx + ex[0] * lx + ey[0] * ly, cy + ex[1] * lx + ey[1] * ly];
    const pieza = (key, lx, ly, z0, sx, sy, sz, o = {}) => { const [px, py] = p(lx, ly); L.cajaCentro(key, px, py, z0, sx, sy, sz, g, o); };
    for (const [lx, ly] of [[-0.3, -0.27], [0.3, -0.27], [-0.3, 0.27], [0.3, 0.27]]) pieza('madera_osc', lx, ly, b, 0.06, 0.06, 0.09, { redondeo: 0.01 });
    pieza(tela, 0, 0.03, b + 0.09, 0.8, 0.72, 0.28, { redondeo: 0.06 });
    pieza(tela, 0, -0.29, b + 0.09, 0.8, 0.18, 0.74, { redondeo: 0.06 });
    if (c.brazos) {
      // brazos de madera finos, como la butaca de verdad
      for (const s of [-1, 1]) {
        pieza(c.brazos, s * 0.37, 0.05, b + 0.09, 0.05, 0.7, 0.5, { redondeo: 0.015 });
        pieza(c.brazos, s * 0.37, 0.07, b + 0.59, 0.09, 0.74, 0.04, { redondeo: 0.015 });
      }
    } else {
      pieza(tela, -0.33, 0.05, b + 0.09, 0.14, 0.66, 0.5, { redondeo: 0.05 });
      pieza(tela, 0.33, 0.05, b + 0.09, 0.14, 0.66, 0.5, { redondeo: 0.05 });
    }
    if (!x.ruina) pieza(tela, 0, 0.08, b + 0.37, 0.5, 0.52, 0.13, { redondeo: 0.05 });
    else { const [qx, qy] = p(0.1, 0.75); L.cajaCentro(tela, qx, qy, b, 0.5, 0.52, 0.13, g + 0.6, { redondeo: 0.05, inclina: 0.3 }); }
    x.sombra(c);
  },
  cama(L, c, x) {
    const b = x.b;
    const { x0, y0, x1, y1 } = c;
    const f = c.funda || 'funda1';
    L.caja('madera', x0, y0, b, x1, y1, b + 0.3);
    L.caja('almohada', x0 + 0.05, y0 + 0.05, b + 0.3, x1 - 0.05, y1 - 0.05, b + 0.47);
    const d = 0.62;
    if (c.cabecero === 'n') {
      L.caja(f, x0 + 0.02, y0 + d, b + 0.36, x1 - 0.02, y1 - 0.02, b + 0.53);
      L.caja('almohada', x0 + 0.18, y0 + 0.14, b + 0.44, x1 - 0.18, y0 + 0.5, b + 0.6);
      L.caja('madera_osc', x0, y0, b, x1, y0 + 0.08, b + 0.95);
    } else if (c.cabecero === 's') {
      L.caja(f, x0 + 0.02, y0 + 0.02, b + 0.36, x1 - 0.02, y1 - d, b + 0.53);
      L.caja('almohada', x0 + 0.18, y1 - 0.5, b + 0.44, x1 - 0.18, y1 - 0.14, b + 0.6);
      L.caja('madera_osc', x0, y1 - 0.08, b, x1, y1, b + 0.95);
    } else if (c.cabecero === 'w') {
      L.caja(f, x0 + d, y0 + 0.02, b + 0.36, x1 - 0.02, y1 - 0.02, b + 0.53);
      L.caja('almohada', x0 + 0.14, y0 + 0.18, b + 0.44, x0 + 0.5, y1 - 0.18, b + 0.6);
      L.caja('madera_osc', x0, y0, b, x0 + 0.08, y1, b + 0.95);
    } else {
      L.caja(f, x0 + 0.02, y0 + 0.02, b + 0.36, x1 - d, y1 - 0.02, b + 0.53);
      L.caja('almohada', x1 - 0.5, y0 + 0.18, b + 0.44, x1 - 0.14, y1 - 0.18, b + 0.6);
      L.caja('madera_osc', x1 - 0.08, y0, b, x1, y1, b + 0.95);
    }
    x.sombra(c);
  },
  mesa(L, c, x) { mesa(L, c, x, 0.74); },
  mesabaja(L, c, x) {
    if (!x.ruina) { mesa(L, { ...c, sillas: 0 }, x, 0.42); return; }
    // partida por la mitad, en uve
    const b = x.b;
    const { x0, y0, x1, y1 } = c;
    const largoX = x1 - x0 >= y1 - y0;
    const lg = (largoX ? x1 - x0 : y1 - y0) / 2, an = largoX ? y1 - y0 : x1 - x0;
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    for (const s of [-1, 1]) {
      const mx = largoX ? cx + s * lg / 2 : cx, my = largoX ? cy : cy + s * lg / 2;
      const o = largoX ? { rueda: s * 0.42, redondeo: 0.01 } : { inclina: -s * 0.42, redondeo: 0.01 };
      L.cajaCentro(c.tapa || 'madera', mx, my, b + 0.2 - 0.025, largoX ? lg : an, largoX ? an : lg, 0.05, 0, o);
      const px = largoX ? cx + s * (lg - 0.08) : x0 + 0.08, py = largoX ? y0 + 0.08 : cy + s * (lg - 0.08);
      L.caja(c.patas || 'madera_osc', px - 0.04, py - 0.04, b, px + 0.04, py + 0.04, b + 0.36);
    }
    x.sombra(c);
  },
  encimera(L, c, x) {
    const b = x.b;
    const { x0, y0, x1, y1 } = c;
    const F = frente(c, c.mira || 's');
    const { W, D } = F;
    const r = azar(semillaDe(c));
    const cuerpo = c.frente || 'blanco';      // el mueble (abajo, forrado de ladrillo)
    const puerta = c.puertas || cuerpo;       // las puertas (abajo, de madera)
    F.caja(L, 'negro', 0, 0.06, b, W, D, b + 0.09, { redondeo: 0 });
    F.caja(L, cuerpo, 0, 0.02, b + 0.09, W, D, b + 0.86);
    // electrodomésticos debajo (lavadora, lavavajillas), de 60 cm, desde el principio de la encimera
    const electros = c.electros || [];
    let ue = 0;
    for (const tipo of electros) {
      F.caja(L, 'blanco', ue + 0.02, -0.012, b + 0.04, ue + 0.58, 0.03, b + 0.84, { redondeo: 0.02 });
      if (tipo === 'lavadora') {
        const [ox, oy] = F.pt(ue + 0.3, -0.014);
        const [ix, iy] = F.pt(ue + 0.3, 0.02);
        L.barra('metal', ox, oy, ix, iy, b + 0.42, 0.2, { segs: 20 });
        const [gx, gy] = F.pt(ue + 0.3, -0.03);
        L.barra(x.ruina ? 'agujero' : 'negro', gx, gy, ox, oy, b + 0.42, 0.15, { segs: 20 });
        F.caja(L, 'negro', ue + 0.07, -0.02, b + 0.72, ue + 0.27, 0.0, b + 0.79, { redondeo: 0 });
      } else {
        F.caja(L, 'metal', ue + 0.12, -0.04, b + 0.74, ue + 0.48, -0.012, b + 0.765, { redondeo: 0.005 });
      }
      ue += 0.6;
    }
    // el horno, debajo de la vitro
    const huecos = [];
    if (c.horno) {
      const uh = Math.min(W - 0.3, Math.max(ue + 0.3, F.uDe(c.horno)));
      huecos.push([uh - 0.3, uh + 0.3]);
      F.caja(L, 'metal', uh - 0.29, -0.015, b + 0.12, uh + 0.29, 0.02, b + 0.8, { redondeo: 0.01 });
      F.caja(L, x.ruina ? 'hollin' : 'negro', uh - 0.22, -0.022, b + 0.22, uh + 0.22, 0.0, b + 0.6, { redondeo: 0.01 });
      F.caja(L, 'metal', uh - 0.2, -0.05, b + 0.65, uh + 0.2, -0.025, b + 0.672, { redondeo: 0.005 });
    }
    // las puertas, en lo que queda libre
    const tramos = [];
    let u = ue;
    for (const [h0, h1] of huecos) { if (h0 - u > 0.25) tramos.push([u, h0]); u = Math.max(u, h1); }
    if (W - u > 0.25) tramos.push([u, W]);
    const total = tramos.reduce((n, [t0, t1]) => n + Math.max(1, Math.round((t1 - t0) / 0.6)), 0);
    const sinPuerta = x.ruina ? Math.floor(r() * total) : -1;
    let k = 0;
    for (const [t0, t1] of tramos) {
      const n = Math.max(1, Math.round((t1 - t0) / 0.6));
      const w = (t1 - t0) / n;
      for (let i = 0; i < n; i++, k++) {
        const a0 = t0 + w * i, a1 = a0 + w, um = (a0 + a1) / 2;
        if (k === sinPuerta) { F.caja(L, 'agujero', a0 + 0.03, -0.002, b + 0.12, a1 - 0.03, 0.022, b + 0.82, { redondeo: 0 }); continue; }
        if (puerta !== cuerpo) F.caja(L, puerta, a0 + 0.04, -0.012, b + 0.14, a1 - 0.04, 0.02, b + 0.8, { redondeo: 0.012 });
        else if (i > 0) F.caja(L, 'negro', a0 - 0.007, 0.0, b + 0.12, a0 + 0.007, 0.025, b + 0.83, { redondeo: 0 });
        F.caja(L, 'metal', um - 0.1, -0.03, b + 0.7, um + 0.1, -0.008, b + 0.722, { redondeo: 0 });
      }
    }
    const tapa = c.tapa || 'negro';
    let ub = W + 1;
    if (!x.ruina || W < 1.2 || electros.length) {
      F.caja(L, tapa, -0.01, -0.03, b + 0.86, W + 0.01, D, b + 0.92, { redondeo: 0.01 });
    } else {
      // la encimera partida: un trozo hundido
      ub = W * (0.35 + r() * 0.3);
      F.caja(L, tapa, -0.01, -0.03, b + 0.86, ub - 0.06, D, b + 0.92, { redondeo: 0.01 });
      const [mx, my] = F.pt((ub + 0.06 + W) / 2, D / 2 - 0.015);
      const largo = W - ub - 0.05;
      const o = F.horiz ? { rueda: 0.16 } : { inclina: 0.16 };
      L.cajaCentro(tapa, mx, my, b + 0.8, F.horiz ? largo : D + 0.03, F.horiz ? D + 0.03 : largo, 0.06, 0, { ...o, redondeo: 0.01 });
      // pila de platos sucios y una olla
      const [px, py] = F.pt(ub * 0.45, D / 2);
      for (let j = 0; j < 6; j++) L.cilindro('blanco', px + (j % 2) * 0.02, py, b + 0.92 + j * 0.035, b + 0.945 + j * 0.035, 0.14 - j * 0.004, { segs: 14 });
      const [ox, oy] = F.pt(ub * 0.15 + 0.1, D / 2);
      L.cilindro('metal', ox, oy, b + 0.92, b + 1.08, 0.13, { segs: 14 });
    }
    const enPie = (q) => F.uDe(q) < ub - 0.35;
    if (c.fregadero && enPie(c.fregadero)) {
      const [fx, fy] = c.fregadero;
      const horiz = x1 - x0 > y1 - y0;
      if (horiz) L.caja('metal', fx - 0.3, fy - 0.17, b + 0.89, fx + 0.3, fy + 0.17, b + 0.935, { redondeo: 0.01 });
      else L.caja('metal', fx - 0.17, fy - 0.3, b + 0.89, fx + 0.17, fy + 0.3, b + 0.935, { redondeo: 0.01 });
      L.cilindro('metal', horiz ? fx : x0 + 0.08, horiz ? y0 + 0.08 : fy, b + 0.92, b + 1.18, 0.025, { segs: 8 });
    }
    for (const q of c.fuegos || []) if (enPie(q)) L.cilindro(x.ruina ? 'hollin' : 'metal', q[0], q[1], b + 0.92, b + 0.945, 0.12);
    // la vitro: un cristal negro con su marco y los cuatro fuegos marcados
    if (c.vitro && enPie(c.vitro)) {
      const uv = F.uDe(c.vitro);
      F.caja(L, 'metal', uv - 0.3, D * 0.08, b + 0.915, uv + 0.3, D * 0.92, b + 0.928, { redondeo: 0 });
      F.caja(L, x.ruina ? 'hollin' : 'negro', uv - 0.285, D * 0.1, b + 0.92, uv + 0.285, D * 0.9, b + 0.934, { redondeo: 0 });
      for (const [du, dv, rr] of [[-0.14, 0.32, 0.09], [0.14, 0.32, 0.07], [-0.14, 0.68, 0.07], [0.14, 0.68, 0.09]]) {
        const [zx, zy] = F.pt(uv + du, D * dv);
        L.cilindro('metal', zx, zy, b + 0.93, b + 0.936, rr, { segs: 18 });
        L.cilindro(x.ruina ? 'hollin' : 'negro', zx, zy, b + 0.93, b + 0.938, rr - 0.012, { segs: 18 });
      }
    }
    x.sombra(c);
  },
  nevera(L, c, x) {
    const b = x.b, H = c.alto || 1.85;
    const F = frente(c, c.mira || 'e');
    const { W, D } = F;
    const k = c.color || 'blanco';
    F.caja(L, k, 0, 0.035, b, W, D, b + H);
    F.caja(L, k, 0, 0, b + 1.2, W, 0.04, b + H - 0.01);
    F.caja(L, k === 'metal' ? 'negro' : 'metal', W - 0.1, -0.035, b + 1.28, W - 0.07, 0.0, b + 1.52, { redondeo: 0.01 });
    if (!x.ruina) {
      F.caja(L, k, 0, 0, b + 0.02, W, 0.04, b + 1.17);
      F.caja(L, k === 'metal' ? 'negro' : 'metal', W - 0.1, -0.035, b + 0.78, W - 0.07, 0.0, b + 1.12, { redondeo: 0.01 });
    } else {
      // la puerta abierta de par en par: dentro, negro y con moho
      F.caja(L, 'agujero', 0.04, -0.002, b + 0.06, W - 0.04, 0.03, b + 1.14, { redondeo: 0 });
      for (const [u, z, rr] of [[0.2, 0.5, 0.12], [0.42, 0.75, 0.09], [0.3, 0.95, 0.07]]) {
        const [mx, my] = F.pt(Math.min(u, W - 0.1), -0.005);
        L.esfera('moho_pared', mx, my, b + z, rr, { escala: [1, 1, 1], detalle: 1 });
      }
      const a = 1.15;
      const [hx, hy] = F.pt(0, 0);
      const [ux, uy] = [F.pt(1, 0)[0] - hx, F.pt(1, 0)[1] - hy];
      const [vx, vy] = [F.pt(0, -1)[0] - hx, F.pt(0, -1)[1] - hy];
      const dx = ux * Math.cos(a) + vx * Math.sin(a), dy = uy * Math.cos(a) + vy * Math.sin(a);
      const g = Math.atan2(-dy, dx);
      L.cajaCentro(k, hx + dx * W / 2, hy + dy * W / 2, b + 0.02, W, 0.045, 1.15, g, { redondeo: 0.02 });
    }
    x.sombra(c);
  },
  cocinalena(L, c, x) {
    // la cocina de leña: negra, con la chapa de arriba, la puerta del fuego, el horno y la barra de delante
    const b = x.b;
    const F = frente(c, c.mira || 's');
    const { W, D } = F;
    F.caja(L, 'negro', 0, 0, b, W, D, b + 0.82);
    F.caja(L, 'metal', -0.02, -0.02, b + 0.82, W + 0.02, D, b + 0.87, { redondeo: 0.01 });
    const wf = Math.min(0.38, W * 0.34);
    F.caja(L, x.ruina ? 'hollin' : 'fuego', 0.12, -0.012, b + 0.46, 0.12 + wf, 0.02, b + 0.7, { redondeo: 0.01 });
    F.caja(L, 'negro', 0.1, -0.02, b + 0.12, 0.14 + wf, 0.0, b + 0.36, { redondeo: 0.01 });
    F.caja(L, 'metal', W * 0.52, -0.014, b + 0.2, W - 0.1, 0.02, b + 0.7, { redondeo: 0.01 });
    const [ax, ay] = F.pt(0.04, -0.07), [bx, by] = F.pt(W - 0.04, -0.07);
    L.barra('metal', ax, ay, bx, by, b + 0.79, 0.015, { segs: 6 });
    if (x.ruina) {
      // ceniza y hollín por el suelo
      const [hx, hy] = F.pt(W * 0.3, -0.35);
      L.cilindro('hollin', hx, hy, b, b + 0.012, 0.32, { segs: 14 });
      trozos(L, 'hollin', hx, hy, b, 4, azar(semillaDe(c)), 0.1, 0.3);
    }
    x.sombra(c);
  },
  chimenea(L, c, x) {
    if (c.esquina) { chimeneaEsquina(L, c, x); return; }
    const b = x.b;
    const { x0, y0, x1, y1 } = c;
    L.caja('chimenea_piedra', x0, y0, b, x1, y1, b + 1.15);
    L.caja('negro', x0 + 0.3, y1 - 0.08, b + 0.12, x1 - 0.3, y1 + 0.005, b + 0.78, { redondeo: 0.01 });
    if (!x.ruina) L.caja('fuego', x0 + 0.48, y1 - 0.3, b + 0.12, x1 - 0.48, y1 - 0.06, b + 0.42, { redondeo: 0.02 });
    L.caja('madera_osc', x0 - 0.06, y0, b + 1.15, x1 + 0.06, y1 + 0.08, b + 1.22);
    if (x.ruina) {
      const r = azar(semillaDe(c));
      L.esfera('hollin', (x0 + x1) / 2, y1 + 0.01, b + 0.9, 0.3, { escala: [1.3, 0.8, 0.08], detalle: 1 });
      trozos(L, 'chimenea_piedra', (x0 + x1) / 2, y1 + 0.45, b, 5, r, 0.2, 0.4);
    }
    x.sombra(c);
  },
  muebletv(L, c, x) {
    const b = x.b;
    const atras = c.tele || 'w';
    const F = frente(c, OPUESTO[atras]);
    const { W, D } = F;
    const { x0, y0, x1, y1 } = c;
    const k = c.color || 'madera', kp = c.puertas || 'madera_osc';
    for (const u of [0.06, W - 0.1]) for (const v of [0.06, D - 0.1]) F.caja(L, 'madera_osc', u, v, b, u + 0.04, v + 0.04, b + 0.08, { redondeo: 0 });
    F.caja(L, k, 0, 0.01, b + 0.08, W, D, b + 0.5);
    const n = 3;
    for (let i = 0; i < n; i++) {
      const u0 = (W / n) * i + 0.025, u1 = (W / n) * (i + 1) - 0.025;
      // dos puertas y un hueco en medio (la Play va ahí)
      F.caja(L, i === 1 ? 'agujero' : kp, u0, -0.012, b + 0.11, u1, 0.012, b + 0.47, { redondeo: 0.01 });
      if (i !== 1) F.caja(L, 'metal', (u0 + u1) / 2 - 0.05, -0.03, b + 0.36, (u0 + u1) / 2 + 0.05, -0.01, b + 0.38, { redondeo: 0 });
    }
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    const ta = (c.teleAncho || 1.32) / 2, th = (c.teleAncho || 1.32) * 0.5625;
    const tz = b + (th > 0.8 ? 0.7 : 0.82);
    if (!x.ruina) {
      if (c.tele === 'w') L.caja('negro', x0 - 0.07, cy - ta, tz, x0 - 0.01, cy + ta, tz + th, { redondeo: 0.02 });
      if (c.tele === 'e') L.caja('negro', x1 + 0.01, cy - ta, tz, x1 + 0.07, cy + ta, tz + th, { redondeo: 0.02 });
      if (c.tele === 's') L.caja('negro', cx - ta, y1 + 0.01, tz, cx + ta, y1 + 0.07, tz + th, { redondeo: 0.02 });
      if (c.tele === 'n') L.caja('negro', cx - ta, y0 - 0.07, tz, cx + ta, y0 - 0.01, tz + th, { redondeo: 0.02 });
      if (c.play) {
        L.caja('negro', cx - 0.13, cy - 0.32, b + 0.5, cx + 0.13, cy - 0.02, b + 0.58, { redondeo: 0.015 });
        L.caja('blanco', cx - 0.135, cy - 0.33, b + 0.535, cx + 0.135, cy - 0.31, b + 0.545, { redondeo: 0 });
      }
    } else {
      // la tele en el suelo, boca abajo, y la consola tirada
      const [tx, ty] = F.pt(W / 2, -0.55 - th / 4);
      L.cajaCentro('negro', tx, ty, b, F.horiz ? ta * 2 : th, F.horiz ? th : ta * 2, 0.06, 0, { redondeo: 0.02, inclina: F.horiz ? 0 : 0.12, rueda: F.horiz ? 0.12 : 0 });
      const [px, py] = F.pt(W * 0.8, -0.35);
      L.cajaCentro('negro', px, py, b, 0.3, 0.26, 0.08, 0.7, { redondeo: 0.015 });
    }
    x.sombra(c);
  },
  telepared(L, c, x) {
    const b = x.b;
    L.caja('negro', c.x0, c.y0, b + 0.9, c.x1, c.y1, b + 1.52, { redondeo: 0.02 });
  },
  armario(L, c, x) {
    const b = x.b, H = c.alto || 2.0;
    const F = frente(c, c.mira || 's');
    const { W, D } = F;
    const r = azar(semillaDe(c));
    F.caja(L, c.color || 'madera', 0, 0.01, b, W, D, b + H);
    if (c.correderas) {
      // empotrado de puertas correderas: dos hojas anchas, una un poco por delante de la otra
      const n = Math.max(2, Math.round(W / 0.75));
      const caida = x.ruina ? Math.floor(r() * n) : -1;
      for (let i = 0; i < n; i++) {
        const u0 = (W / n) * i + 0.01, u1 = (W / n) * (i + 1) - 0.01, dv = i % 2 ? 0 : -0.025;
        if (i === caida) { F.caja(L, 'agujero', u0, -0.004, b + 0.05, u1, 0.014, b + H - 0.05, { redondeo: 0 }); continue; }
        F.caja(L, c.puertas || 'madera_osc', u0, dv - 0.01, b + 0.04, u1, dv + 0.014, b + H - 0.04, { redondeo: 0.01 });
        const uh = i % 2 ? u0 + 0.05 : u1 - 0.07;
        F.caja(L, 'metal', uh, dv - 0.03, b + 0.8, uh + 0.02, dv - 0.01, b + 1.3, { redondeo: 0 });
      }
      F.caja(L, c.color || 'madera', -0.02, -0.06, b + H - 0.04, W + 0.02, D, b + H + 0.04, { redondeo: 0.01 });
    } else {
      const n = Math.max(2, Math.round(W / 0.5));
      const caida = x.ruina ? Math.floor(r() * n) : -1;
      for (let i = 0; i < n; i++) {
        const u0 = (W / n) * i + 0.015, u1 = (W / n) * (i + 1) - 0.015;
        if (i === caida) { F.caja(L, 'agujero', u0, -0.004, b + 0.05, u1, 0.014, b + H - 0.05, { redondeo: 0 }); continue; }
        F.caja(L, c.puertas || 'madera_osc', u0, -0.01, b + 0.05, u1, 0.014, b + H - 0.05, { redondeo: 0.01 });
        const uh = i % 2 ? u0 + 0.06 : u1 - 0.08;
        F.caja(L, 'metal', uh, -0.03, b + 0.9, uh + 0.025, -0.008, b + 1.2, { redondeo: 0 });
      }
    }
    x.sombra(c);
  },
  escritorio(L, c, x) {
    const b = x.b;
    const { x0, y0, x1, y1 } = c;
    L.caja('blanco', x0, y0, b + 0.7, x1, y1, b + 0.75);
    L.caja('blanco', x0 + 0.03, y0 + 0.03, b, x0 + 0.08, y1 - 0.03, b + 0.7);
    L.caja('negro', x0 + 0.06, y1 - 0.3, b, x0 + 0.4, y1 - 0.08, b + 0.45);
    const cy = (y0 + y1) / 2;
    L.caja('negro', x0 + 0.08, cy - 0.62, b + 0.8, x0 + 0.13, cy - 0.04, b + 1.18, { redondeo: 0.01 });
    L.caja('negro', x0 + 0.08, cy + 0.04, b + 0.8, x0 + 0.13, cy + 0.62, b + 1.18, { redondeo: 0.01 });
    L.caja('negro', x0 + 0.25, cy - 0.25, b + 0.75, x0 + 0.4, cy + 0.25, b + 0.77, { redondeo: 0 });
    L.cilindro('negro', x1 + 0.35, cy, b, b + 0.45, 0.06, { segs: 8 });
    L.caja('negro', x1 + 0.12, cy - 0.24, b + 0.45, x1 + 0.58, cy + 0.24, b + 0.52);
    L.caja('negro', x1 + 0.52, cy - 0.24, b + 0.52, x1 + 0.6, cy + 0.24, b + 1.1);
    x.sombra({ x0, y0, x1: x1 + 0.6, y1 });
  },
  inodoro(L, c, x) {
    const b = x.b;
    const F = frente(c, c.mira || 'n');
    const { W, D } = F;
    const [bx, by] = F.pt(W / 2, Math.min(0.26, D * 0.4));
    L.cilindro('blanco', bx, by, b, b + 0.3, 0.13, { rArriba: 0.18 });
    L.cilindro('blanco', bx, by, b + 0.3, b + 0.4, 0.19, { segs: 20 });
    if (!x.ruina) L.cilindro('blanco', bx, by, b + 0.4, b + 0.425, 0.19, { segs: 20 });
    else L.cilindro('mugre', bx, by, b + 0.4, b + 0.41, 0.15, { segs: 16 });
    F.caja(L, 'blanco', W / 2 - 0.19, D - 0.19, b + 0.3, W / 2 + 0.19, D, b + 0.78);
    F.caja(L, 'metal', W / 2 - 0.04, D - 0.12, b + 0.78, W / 2 + 0.04, D - 0.06, b + 0.795, { redondeo: 0 });
    x.sombra(c);
  },
  lavabo(L, c, x) {
    const b = x.b;
    const F = frente(c, c.mira || 'n');
    const { W, D } = F;
    if (c.mueble) {
      // lavabo con mueble debajo (dos puertas) y la encimera blanca con la pila
      F.caja(L, c.color || 'madera', 0, 0.03, b + 0.08, W, D, b + 0.8, { redondeo: 0.01 });
      F.caja(L, 'negro', 0.03, 0.06, b, W - 0.03, D, b + 0.08, { redondeo: 0 });
      for (const [u0, u1] of [[0.03, W / 2 - 0.01], [W / 2 + 0.01, W - 0.03]]) {
        F.caja(L, x.ruina && u0 > 0.1 ? 'agujero' : c.puertas || 'madera_osc', u0, 0.012, b + 0.12, u1, 0.035, b + 0.76, { redondeo: 0.01 });
      }
      const roto = !!x.ruina;
      F.caja(L, 'blanco', -0.01, -0.01, b + 0.8, roto ? W * 0.55 : W + 0.01, D, b + 0.86, { redondeo: 0.02 });
      if (roto) trozos(L, 'blanco', ...F.pt(W * 0.75, -0.35), b, 4, azar(semillaDe(c)), 0.12, 0.3);
      const [px, py] = F.pt(W / 2, D * 0.45);
      if (!roto) L.cilindro('metal', px, py, b + 0.858, b + 0.866, Math.min(W, D) * 0.32, { segs: 20 });
      const [gx, gy] = F.pt(W / 2, D - 0.07);
      L.cilindro('metal', gx, gy, b + 0.86, b + 1.02, 0.02, { segs: 8 });
      x.sombra(c);
      return;
    }
    const [cx, cy] = F.pt(W / 2, D / 2);
    L.cilindro('blanco', cx, cy, b, b + 0.7, 0.08, { rArriba: 0.1, segs: 12 });
    if (!x.ruina) {
      F.caja(L, 'blanco', 0, 0, b + 0.7, W, D, b + 0.84, { redondeo: 0.04 });
    } else {
      F.caja(L, 'blanco', W * 0.45, 0, b + 0.7, W, D, b + 0.84, { redondeo: 0.04 });
      const [qx, qy] = F.pt(W * 0.2, -0.3);
      L.cajaCentro('blanco', qx, qy, b, W * 0.4, D * 0.8, 0.12, 0.6, { redondeo: 0.03, inclina: 0.3 });
    }
    const [hx, hy] = F.pt(W / 2, D * 0.42);
    L.cilindro('metal', hx, hy, b + 0.84, b + 0.85, Math.min(W, D) * 0.3);
    const [gx, gy] = F.pt(W / 2, D - 0.06);
    L.cilindro('metal', gx, gy, b + 0.84, b + 0.98, 0.02, { segs: 8 });
    x.sombra(c);
  },
  ducha(L, c, x) {
    const b = x.b;
    L.caja('blanco', c.x0, c.y0, b, c.x1, c.y1, b + 0.07);
    if (!x.ruina) {
      L.caja('cristal', c.x0 + 0.03, c.y0 + 0.03, b + 0.07, c.x1 - 0.03, c.y1 - 0.03, b + 1.85, { redondeo: 0.02 });
    } else {
      // mampara rota: solo queda un trozo y los cristales por el suelo
      L.caja('cristal', c.x0 + 0.03, c.y0 + 0.03, b + 0.07, c.x0 + 0.08, c.y1 - 0.03, b + 1.1, { redondeo: 0 });
      L.cilindro('moho', (c.x0 + c.x1) / 2, (c.y0 + c.y1) / 2, b + 0.071, b + 0.075, 0.3, { segs: 14 });
      trozos(L, 'cristal', c.x0 - 0.25, (c.y0 + c.y1) / 2, b, 6, azar(semillaDe(c)), 0.12, 0.35);
    }
  },
  vitrina(L, c, x) {
    const b = x.b, H = c.alto || 1.8;
    const F = frente(c, c.mira || 'n');
    const { W, D } = F;
    const k = c.color || 'madera_osc', t = 0.04;
    const r = azar(semillaDe(c));
    const bajo = c.bajo || 0;   // la parte de abajo, con puertas de madera
    F.caja(L, k, 0, D - 0.03, b, W, D, b + H, { redondeo: 0.01 });
    F.caja(L, k, 0, 0, b, t, D, b + H, { redondeo: 0.01 });
    F.caja(L, k, W - t, 0, b, W, D, b + H, { redondeo: 0.01 });
    F.caja(L, k, 0, 0, b + H - 0.05, W, D, b + H, { redondeo: 0.01 });
    F.caja(L, k, 0, 0, b, W, D, b + 0.12, { redondeo: 0.01 });
    const baldas = bajo ? [bajo, bajo + (H - bajo) * 0.36, bajo + (H - bajo) * 0.68] : [0.56, 1.0, 1.42];
    if (bajo) {
      // las puertas de abajo, con su tirador
      for (const [u0, u1] of [[t, W / 2 - 0.006], [W / 2 + 0.006, W - t]]) {
        F.caja(L, x.ruina && u0 > t ? 'agujero' : k, u0, -0.012, b + 0.13, u1, 0.03, b + bajo - 0.01, { redondeo: 0.01 });
        F.caja(L, 'metal', u0 < W / 2 ? u1 - 0.06 : u0 + 0.04, -0.03, b + bajo - 0.2, u0 < W / 2 ? u1 - 0.04 : u0 + 0.06, -0.012, b + bajo - 0.08, { redondeo: 0 });
      }
    }
    baldas.forEach((z, i) => {
      if (x.ruina && i === 1) {
        // una balda descolgada
        const [mx, my] = F.pt(W / 2, D / 2);
        L.cajaCentro(k, mx, my, b + z - 0.12, F.horiz ? W - 2 * t : D - 0.06, F.horiz ? D - 0.06 : W - 2 * t, 0.03, 0, F.horiz ? { rueda: 0.32, redondeo: 0 } : { inclina: 0.32, redondeo: 0 });
        return;
      }
      F.caja(L, k, t, 0.03, b + z, W - t, D - 0.03, b + z + 0.03, { redondeo: 0 });
    });
    const libros = ['funda1', 'funda2', 'tela1', 'tela2', 'funda3'];
    const estantes = bajo ? baldas.map((z) => z + 0.03) : [0.12, 0.59, 1.03, 1.45];
    for (const z of estantes) {
      if (x.ruina && z > 0.5 && z < 1.2) continue;
      let u = t + 0.05;
      while (u < W - t - 0.14) {
        const q = r();
        if (c.contenido === 'copas') {
          // copas y botellas
          const [px, py] = F.pt(u + 0.05, D * 0.5);
          if (q < 0.6) { L.cilindro('cristal', px, py, b + z, b + z + 0.13, 0.035, { rArriba: 0.045, segs: 10 }); u += 0.1; }
          else {
            const kb = q < 0.8 ? 'planta' : 'cerezo';
            L.cilindro(kb, px, py, b + z, b + z + 0.22, 0.04, { segs: 10 });
            L.cilindro(kb, px, py, b + z + 0.22, b + z + 0.3, 0.015, { segs: 8 });
            u += 0.11;
          }
          continue;
        }
        if (q < 0.4) {
          const [px, py] = F.pt(u + 0.06, D * 0.55);
          L.cilindro('blanco', px, py, b + z, b + z + 0.1, 0.05, { segs: 10 });
          u += 0.15;
        } else if (q < 0.8) {
          const w = 0.04 + r() * 0.04;
          F.caja(L, libros[Math.floor(r() * libros.length)], u, D * 0.3, b + z, u + w, D - 0.05, b + z + 0.2 + r() * 0.1, { redondeo: 0 });
          u += w + 0.012;
        } else u += 0.12;
      }
    }
    if (!x.ruina) F.caja(L, 'cristal', t, -0.004, b + Math.max(0.12, bajo), W - t, 0.012, b + H - 0.05, { redondeo: 0, libre: true });
    else {
      trozos(L, 'cristal', ...F.pt(W / 2, -0.35), b, 7, r, 0.12, 0.35);
      trozos(L, 'blanco', ...F.pt(W * 0.3, -0.45), b, 4, r, 0.1, 0.25);
    }
    x.sombra(c);
  },
  mueble(L, c, x) {
    const b = x.b, H = (c.alto || 0.85) - 0.05;
    const F = frente(c, c.mira || 'n');
    const { W, D } = F;
    const k = c.color || 'madera', kp = c.puertas || 'madera_osc';
    F.caja(L, k, 0, 0.01, b, W, D, b + H);
    const n = Math.max(2, Math.round(W / 0.45));
    for (let i = 0; i < n; i++) {
      const u0 = (W / n) * i + 0.02, u1 = (W / n) * (i + 1) - 0.02;
      F.caja(L, x.ruina && i % 2 === 0 ? 'agujero' : kp, u0, -0.01, b + 0.06, u1, 0.014, b + H - 0.04, { redondeo: 0.01 });
      if (kp === k) F.caja(L, 'metal', (u0 + u1) / 2 - 0.05, -0.03, b + H - 0.14, (u0 + u1) / 2 + 0.05, -0.012, b + H - 0.12, { redondeo: 0 });
    }
    F.caja(L, kp === k ? k : 'madera_osc', -0.02, -0.02, b + H, W + 0.02, D, b + H + 0.05);
    x.sombra(c);
  },
  planta(L, c, x) {
    planta(L, (c.x0 + c.x1) / 2, (c.y0 + c.y1) / 2, x.b, Math.min(c.x1 - c.x0, c.y1 - c.y0) / 2, !!x.ruina);
    x.sombra(c);
  },
  alfombra(L, c, x) {
    L.caja(c.color || 'alfombra1', c.x0, c.y0, x.b, c.x1, c.y1, x.b + 0.02, { redondeo: 0.01 });
    if (x.ruina) {
      // una esquina enrollada
      const largoX = c.x1 - c.x0 >= c.y1 - c.y0;
      if (largoX) L.barra(c.color || 'alfombra1', c.x1 - 0.15, c.y0 + 0.1, c.x1 - 0.15, c.y1 - 0.1, x.b + 0.1, 0.1);
      else L.barra(c.color || 'alfombra1', c.x0 + 0.1, c.y1 - 0.15, c.x1 - 0.1, c.y1 - 0.15, x.b + 0.1, 0.1);
    }
  },
  estanteria(L, c, x) {
    const b = x.b;
    const { x0, y0, x1, y1 } = c;
    for (const hh of [0.05, 0.62, 1.2, 1.76]) L.caja('metal', x0, y0, b + hh, x1, y1, b + hh + 0.04, { redondeo: 0 });
    for (const px of [x0, (x0 + x1) / 2, x1 - 0.05]) L.caja('metal', px, y0, b, px + 0.05, y1, b + 1.82, { redondeo: 0 });
    const r = azar(31);
    for (const hh of [0.09, 0.66, 1.24]) {
      let px = x0 + 0.15;
      while (px < x1 - 0.6) {
        const w = 0.3 + r() * 0.35;
        if (r() > 0.25) L.caja('carton', px, y0 + 0.05, b + hh, px + w, y1 - 0.05, b + hh + 0.2 + r() * 0.2);
        px += w + 0.1;
      }
    }
    x.sombra(c);
  },
  arcon(L, c, x) {
    const b = x.b;
    L.caja('madera', c.x0, c.y0, b, c.x1, c.y1, b + 0.55);
    L.caja('madera_osc', c.x0 - 0.02, c.y0 - 0.02, b + 0.55, c.x1 + 0.02, c.y1 + 0.02, b + 0.62);
    x.sombra(c);
  },
  lena(L, c, x) {
    const b = x.b;
    const { x0, y0, x1, y1 } = c;
    for (let k = 0; k < 3; k++) {
      for (let px = x0 + 0.15 + (k % 2) * 0.12; px < x1 - 0.1; px += 0.26) L.barra('lena', px, y0 + 0.1, px, y1 - 0.1, b + 0.13 + k * 0.23, 0.12, { segs: 8 });
    }
    x.sombra(c);
  },
  moto(L, c, x) {
    const b = x.b;
    const cx = (c.x0 + c.x1) / 2;
    for (const wy of [c.y0 + 0.32, c.y1 - 0.32]) L.barra('rueda', cx - 0.06, wy, cx + 0.06, wy, b + 0.31, 0.31);
    L.caja(c.color || 'negro', cx - 0.12, c.y0 + 0.35, b + 0.38, cx + 0.12, c.y1 - 0.4, b + 0.74);
    L.caja('negro', cx - 0.13, c.y0 + 0.75, b + 0.74, cx + 0.13, c.y1 - 0.45, b + 0.82);
    L.barra('metal', cx - 0.32, c.y0 + 0.42, cx + 0.32, c.y0 + 0.42, b + 0.98, 0.025, { segs: 6 });
    L.caja('metal', cx - 0.03, c.y0 + 0.36, b + 0.32, cx + 0.03, c.y0 + 0.46, b + 0.98, { redondeo: 0 });
    x.sombra(c);
  },
  bicis(L, c, x) {
    const b = x.b;
    const bicis = [[c.x0 + 0.25, c.y0 + 0.2], [c.x0 + 0.7, c.y0 + 1.1]];
    for (const [bx, by] of bicis) {
      for (const wy of [by + 0.3, by + 1.4]) L.barra('rueda', bx - 0.03, wy, bx + 0.03, wy, b + 0.33, 0.32);
      L.caja('tela2', bx - 0.03, by + 0.35, b + 0.62, bx + 0.03, by + 1.3, b + 0.7, { redondeo: 0 });
      L.caja('tela2', bx - 0.03, by + 0.5, b + 0.33, bx + 0.03, by + 0.58, b + 0.85, { redondeo: 0 });
      L.caja('negro', bx - 0.08, by + 0.42, b + 0.85, bx + 0.08, by + 0.66, b + 0.9);
      L.barra('metal', bx - 0.25, by + 1.32, bx + 0.25, by + 1.32, b + 0.95, 0.02, { segs: 6 });
    }
    x.sombra(c);
  },
  pingpong(L, c, x) {
    const b = x.b;
    const { x0, y0, x1, y1 } = c;
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    L.caja('ppverde', x0, y0, b + 0.71, x1, y1, b + 0.76, { redondeo: 0.01 });
    L.caja('blanco', x0 + 0.02, cy - 0.012, b + 0.76, x1 - 0.02, cy + 0.012, b + 0.765, { redondeo: 0 });
    L.caja('blanco', cx - 0.012, y0 - 0.06, b + 0.76, cx + 0.012, y1 + 0.06, b + 0.92, { redondeo: 0 });
    for (const [px, py] of [[x0 + 0.25, y0 + 0.25], [x1 - 0.25, y0 + 0.25], [x0 + 0.25, y1 - 0.25], [x1 - 0.25, y1 - 0.25]]) L.caja('negro', px - 0.04, py - 0.04, b, px + 0.04, py + 0.04, b + 0.71);
    x.sombra(c);
  },
  caldera(L, c, x) {
    const b = x.b;
    const cx = (c.x0 + c.x1) / 2, cy = (c.y0 + c.y1) / 2;
    L.cilindro('blanco', cx, cy, b, b + 1.55, 0.34);
    L.cilindro('metal', cx + 0.18, cy, b + 1.55, b + 2.3, 0.04, { segs: 8 });
    x.sombra(c);
  },
  pilar(L, c, x) {
    L.caja('liso', c.x0, c.y0, x.b, c.x1, c.y1, x.b + MURO_ALTO);
  },
  columna(L, c, x) {
    L.caja('liso', c.x0, c.y0, x.b, c.x1, c.y1, x.b + ALTURA - 0.27);
    x.sombra(c);
  },
  coche(L, c, x) {
    const b = x.b;
    const { x0, y0, x1, y1 } = c;
    L.caja('coche', x0, y0 + 0.08, b + 0.26, x1, y1 - 0.08, b + 0.82, { redondeo: 0.12 });
    L.caja('coche_cristal', x0 + 0.1, y0 + 1.15, b + 0.8, x1 - 0.1, y1 - 0.9, b + 1.28, { redondeo: 0.08 });
    L.caja('coche', x0 + 0.13, y0 + 1.3, b + 1.26, x1 - 0.13, y1 - 1.05, b + 1.34, { redondeo: 0.05 });
    for (const wy of [y0 + 0.75, y1 - 0.75]) {
      L.barra('rueda', x0 - 0.03, wy, x0 + 0.22, wy, b + 0.3, 0.3);
      L.barra('rueda', x1 - 0.22, wy, x1 + 0.03, wy, b + 0.3, 0.3);
    }
    L.caja('blanco', x0 + 0.15, y0 + 0.04, b + 0.55, x0 + 0.4, y0 + 0.1, b + 0.66, { redondeo: 0.02 });
    L.caja('blanco', x1 - 0.4, y0 + 0.04, b + 0.55, x1 - 0.15, y0 + 0.1, b + 0.66, { redondeo: 0.02 });
    x.sombra({ x0: x0 - 0.1, y0, x1: x1 + 0.1, y1 });
  },
  zen(L, c, x) {
    const b = x.b;
    if (c.rayas) {
      // la alfombra de rayas de colores
      const colores = ['tela1', 'blanco', 'tela2', 'funda1', 'blanco', 'funda3', 'cenefa', 'blanco'];
      const largoX = c.x1 - c.x0 >= c.y1 - c.y0;
      const lg = largoX ? c.x1 - c.x0 : c.y1 - c.y0;
      const n = Math.max(8, Math.round(lg / 0.11));
      for (let i = 0; i < n; i++) {
        const a0 = (largoX ? c.x0 : c.y0) + (lg / n) * i, a1 = a0 + lg / n;
        const kc = colores[i % colores.length];
        if (largoX) L.caja(kc, a0, c.y0, b, a1, c.y1, b + 0.02, { redondeo: 0 });
        else L.caja(kc, c.x0, a0, b, c.x1, a1, b + 0.02, { redondeo: 0 });
      }
    } else L.caja('zen', c.x0, c.y0, b, c.x1, c.y1, b + 0.025, { redondeo: 0.012 });
    const r = azar(semillaDe(c));
    for (const [px, py, rr] of c.cojines || []) {
      if (!x.ruina) { L.cilindro('cojin', px, py, b + 0.02, b + 0.15, rr); continue; }
      // cojines tirados y uno reventado
      const qx = px + (r() - 0.5) * 0.9, qy = py + (r() - 0.5) * 0.5;
      L.barra('cojin', qx - 0.06, qy, qx + 0.06, qy + 0.02, b + rr * 0.9, rr * 0.9, { segs: 14 });
      L.esfera('relleno', qx + 0.1, qy + 0.1, b + 0.05, 0.07, { detalle: 0 });
    }
    const [qx, qy] = c.planta || [14.2, 0.72];
    planta(L, qx, qy, b, 0.2, !!x.ruina);
  },
  // ---------- lo que salió del vídeo del 9 de noviembre ----------
  radiador(L, c, x) {
    const b = x.b;
    const F = frente(c, c.mira || 's');
    const { W, D } = F;
    const n = Math.max(4, Math.round(W / 0.08));
    for (let i = 0; i < n; i++) {
      const u0 = (W / n) * i + 0.007, u1 = (W / n) * (i + 1) - 0.007;
      F.caja(L, 'blanco', u0, 0, b + 0.14, u1, D, b + 0.72, { redondeo: 0.012 });
    }
    F.caja(L, 'blanco', 0, D * 0.3, b + 0.17, W, D * 0.7, b + 0.69, { redondeo: 0 });
  },
  puertita(L, c, x) {
    // una puerta de madera oscura con su marco (la de debajo de la escalera)
    const b = x.b, H = c.alto || 1.9;
    const F = frente(c, c.mira || 'w');
    const { W, D } = F;
    const k = c.color || 'cerezo';
    F.caja(L, k, -0.05, 0, b, 0.02, D, b + H + 0.05, { redondeo: 0.005 });
    F.caja(L, k, W - 0.02, 0, b, W + 0.05, D, b + H + 0.05, { redondeo: 0.005 });
    F.caja(L, k, -0.05, 0, b + H, W + 0.05, D, b + H + 0.06, { redondeo: 0.005 });
    if (!x.ruina) {
      F.caja(L, k, 0.02, D * 0.35, b + 0.01, W - 0.02, D, b + H, { redondeo: 0.01 });
      F.caja(L, 'madera_osc', 0.1, D * 0.35 - 0.008, b + 0.16, W - 0.1, D * 0.35, b + H * 0.47, { redondeo: 0 });
      F.caja(L, 'madera_osc', 0.1, D * 0.35 - 0.008, b + H * 0.53, W - 0.1, D * 0.35, b + H - 0.14, { redondeo: 0 });
      const [px, py] = F.pt(W - 0.1, D * 0.35 - 0.025);
      L.esfera('dorado', px, py, b + Math.min(1.0, H * 0.52), 0.025, { detalle: 0 });
    } else {
      // descolgada: el hueco negro y la puerta tirada delante
      F.caja(L, 'agujero', 0.02, D * 0.5, b + 0.01, W - 0.02, D, b + H, { redondeo: 0 });
      const [mx, my] = F.pt(W / 2, -H * 0.45);
      L.cajaCentro(k, mx, my, b, F.horiz ? W - 0.05 : H * 0.9, F.horiz ? H * 0.9 : W - 0.05, 0.04, 0.12, { redondeo: 0.01 });
    }
  },
  campana(L, c, x) {
    // va colgada en la pared: solo se ve cuando la pared se ve entera
    const b = x.b;
    const F = frente(c, c.mira || 's');
    const { W, D } = F;
    if (c.tipo === 'obra') {
      // la de la cocina de leña: de obra, alicatada, con un listón de madera abajo
      F.caja(L, 'madera', -0.02, -0.03, b + 1.62, W + 0.02, D, b + 1.7, { redondeo: 0.01 });
      F.caja(L, 'azulejo', 0, 0, b + 1.7, W, D, b + 1.86, { redondeo: 0.01 });
      F.caja(L, 'azulejo', W * 0.08, D * 0.18, b + 1.86, W * 0.92, D, b + 2.02, { redondeo: 0.01 });
      F.caja(L, 'azulejo', W * 0.22, D * 0.42, b + 2.02, W * 0.78, D, b + 2.5, { redondeo: 0.01 });
    } else {
      // de acero, con su tubo hasta el techo
      F.caja(L, 'metal', 0, 0, b + 1.58, W, D, b + 1.65, { redondeo: 0.01 });
      F.caja(L, 'metal', W * 0.14, D * 0.2, b + 1.65, W * 0.86, D, b + 1.8, { redondeo: 0.01 });
      F.caja(L, 'metal', W / 2 - 0.13, D - 0.24, b + 1.8, W / 2 + 0.13, D, b + 2.5, { redondeo: 0.01 });
    }
  },
  altos(L, c, x) {
    // muebles altos de cocina, colgados
    const b = x.b;
    const F = frente(c, c.mira || 's');
    const { W, D } = F;
    const k = c.color || 'madera_osc', kp = c.puertas || 'madera';
    const z0 = b + (c.desde || 1.45), z1 = b + (c.hasta || 2.15);
    F.caja(L, k, 0, 0.02, z0, W, D, z1, { redondeo: 0.01 });
    const n = Math.max(1, Math.round(W / 0.42));
    for (let i = 0; i < n; i++) {
      const u0 = (W / n) * i + 0.015, u1 = (W / n) * (i + 1) - 0.015;
      F.caja(L, kp, u0, 0, z0 + 0.02, u1, 0.03, z1 - 0.02, { redondeo: 0.01 });
      const uh = i % 2 ? u0 + 0.04 : u1 - 0.06;
      F.caja(L, 'metal', uh, -0.02, z0 + 0.05, uh + 0.02, 0, z0 + 0.19, { redondeo: 0 });
    }
  },
  espejo(L, c, x) {
    const b = x.b;
    const F = frente(c, c.mira || 'n');
    const { W, D } = F;
    F.caja(L, 'blanco', -0.03, 0, b + 1.05, W + 0.03, D, b + 1.85, { redondeo: 0.01 });
    F.caja(L, 'cristal', 0.02, -0.012, b + 1.09, W - 0.02, D * 0.5, b + 1.81, { redondeo: 0, libre: true });
  },
  chimeneacolumna(L, c, x) {
    // el tiro de la chimenea de esquina, hasta el techo, con su rejilla (colgado de la pared)
    const b = x.b;
    const { a, G } = esquinaDe(c);
    const ancho = a * Math.SQRT2 * 0.74;
    G.pieza(L, 'interior', 0, 0.21, b + 1.23, ancho, 0.42, 1.27, { redondeo: 0.02 });
    // el listón de madera de las dos esquinas de delante y la rejilla
    G.pieza(L, 'madera_osc', -ancho / 2 + 0.015, 0.415, b + 1.23, 0.035, 0.035, 1.27, { redondeo: 0.008 });
    G.pieza(L, 'madera_osc', ancho / 2 - 0.015, 0.415, b + 1.23, 0.035, 0.035, 1.27, { redondeo: 0.008 });
    G.pieza(L, 'metal', 0, 0.425, b + 1.85, ancho * 0.32, 0.012, 0.14, { redondeo: 0 });
  },
  piano(L, c, x) {
    // piano digital negro, con su silla delante y un cactus encima
    const b = x.b;
    const F = frente(c, c.mira || 'n');
    const { W, D } = F;
    F.caja(L, 'negro', 0, D * 0.12, b, 0.06, D, b + 0.78, { redondeo: 0.01 });
    F.caja(L, 'negro', W - 0.06, D * 0.12, b, W, D, b + 0.78, { redondeo: 0.01 });
    F.caja(L, 'negro', 0.06, D * 0.72, b + 0.08, W - 0.06, D, b + 0.6, { redondeo: 0 });
    F.caja(L, 'negro', 0, 0, b + 0.7, W, D, b + 0.79, { redondeo: 0.01 });
    F.caja(L, x.ruina ? 'agujero' : 'blanco', 0.07, 0.015, b + 0.79, W - 0.07, D * 0.42, b + 0.805, { redondeo: 0 });
    if (!x.ruina) {
      const n = Math.round((W - 0.14) / 0.045);
      for (let i = 0; i < n; i++) {
        if ([2, 6].includes(i % 7)) continue;
        const u = 0.07 + (W - 0.14) * (i + 1) / (n + 1);
        F.caja(L, 'negro', u - 0.011, 0.015 + D * 0.12, b + 0.8, u + 0.011, D * 0.42, b + 0.815, { redondeo: 0 });
      }
    }
    F.caja(L, 'negro', 0, D * 0.42, b + 0.79, W, D, b + 0.98, { redondeo: 0.01 });
    F.caja(L, 'blanco', W * 0.38, D * 0.48, b + 0.98, W * 0.62, D * 0.52, b + 1.18, { redondeo: 0 });
    const [qx, qy] = F.pt(W - 0.16, D * 0.65);
    L.cilindro('blanco', qx, qy, b + 0.98, b + 1.08, 0.07, { rArriba: 0.08 });
    L.cilindro('planta', qx, qy, b + 1.08, b + 1.3, 0.04, { rArriba: 0.03, segs: 10 });
    const [sx, sy] = F.pt(W / 2, -0.38);
    const ks = { asiento: 'tela_oscura', patas: 'negro' };
    if (!x.ruina) silla(L, sx, sy, OPUESTO[c.mira || 'n'], b, ks);
    else sillaTirada(L, sx + 0.2, sy - 0.1, b, 2.2, ks);
    x.sombra(c);
  },
  zapatero(L, c, x) {
    // zapatero negro de cubos con zapatillas dentro y una lámpara encima
    const b = x.b, H = 0.74;
    const F = frente(c, c.mira || 'n');
    const { W, D } = F;
    const r = azar(semillaDe(c));
    const colores = ['blanco', 'tela1', 'tela2', 'blanco', 'funda2', 'negro'];
    F.caja(L, 'negro', 0, 0, b, W, D, b + H, { redondeo: 0.01 });
    const cols = Math.max(2, Math.round(W / 0.38)), filas = 2;
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < filas; j++) {
        const u0 = 0.035 + i * (W - 0.07) / cols + 0.015, u1 = 0.035 + (i + 1) * (W - 0.07) / cols - 0.015;
        const z0 = b + 0.035 + j * (H - 0.07) / filas + 0.015, z1 = b + 0.035 + (j + 1) * (H - 0.07) / filas - 0.015;
        F.caja(L, 'agujero', u0, -0.003, z0, u1, 0.012, z1, { redondeo: 0 });
        if (x.ruina) continue;
        const kz = colores[Math.floor(r() * colores.length)];
        F.caja(L, kz, u0 + 0.02, -0.006, z0, (u0 + u1) / 2 - 0.01, 0.0, z0 + 0.1, { redondeo: 0.02 });
        F.caja(L, kz, (u0 + u1) / 2 + 0.01, -0.006, z0, u1 - 0.02, 0.0, z0 + 0.1, { redondeo: 0.02 });
      }
    }
    const [lx, ly] = F.pt(W * 0.25, D / 2);
    L.cilindro('negro', lx, ly, b + H, b + H + 0.3, 0.025, { segs: 8 });
    L.cilindro('almohada', lx, ly, b + H + 0.28, b + H + 0.48, 0.17, { rArriba: 0.12, segs: 16 });
    if (x.ruina) {
      // las zapatillas por el suelo
      const [zx, zy] = F.pt(W / 2, -0.45);
      for (let k = 0; k < 7; k++) L.cajaCentro(colores[k % colores.length], zx + (r() - 0.5) * 1.1, zy + (r() - 0.5) * 0.6, b, 0.26, 0.1, 0.1, r() * Math.PI, { redondeo: 0.03 });
    }
    x.sombra(c);
  },
  zenmueble(L, c, x) {
    // mueble bajo blanco con la fuente del Buda encima y el bambú de la suerte en una garrafa azul
    const b = x.b, H = c.alto || 0.42;
    const F = frente(c, c.mira || 's');
    const { W, D } = F;
    F.caja(L, 'blanco', 0, 0, b, W, D, b + 0.06, { redondeo: 0.01 });
    F.caja(L, 'blanco', 0, 0, b + H - 0.05, W, D, b + H, { redondeo: 0.01 });
    F.caja(L, 'blanco', 0, 0, b, 0.045, D, b + H, { redondeo: 0.01 });
    F.caja(L, 'blanco', W - 0.045, 0, b, W, D, b + H, { redondeo: 0.01 });
    F.caja(L, 'blanco', W / 2 - 0.02, 0, b, W / 2 + 0.02, D, b + H, { redondeo: 0 });
    F.caja(L, 'interior', 0.045, D - 0.03, b + 0.06, W - 0.045, D, b + H - 0.05, { redondeo: 0 });
    F.caja(L, 'negro', W * 0.3, D * 0.15, b + H, W * 0.92, D * 0.88, b + H + 0.02, { redondeo: 0 });
    const [gx, gy] = F.pt(W * 0.15, D * 0.5);
    L.cilindro('agua', gx, gy, b + H, b + H + 0.32, 0.1, { segs: 16 });
    const [rx, ry] = F.pt(W * 0.62, D * 0.62);
    const [bx, by] = F.pt(W * 0.62, D * 0.3);
    if (!x.ruina) {
      for (const [dx, dy, hh] of [[-0.03, 0, 0.55], [0.03, 0.02, 0.48], [0, -0.03, 0.62]]) {
        L.cilindro('planta', gx + dx, gy + dy, b + H + 0.25, b + H + 0.25 + hh, 0.012, { segs: 6 });
        L.esfera('hoja', gx + dx, gy + dy, b + H + 0.25 + hh, 0.05, { escala: [1, 1.4, 1], detalle: 0 });
      }
      L.esfera('negro', rx, ry, b + H + 0.15, 0.15, { escala: [1.1, 1.25, 0.8], detalle: 1 });
      L.esfera('dorado', bx, by, b + H + 0.09, 0.075, { escala: [1.15, 0.9, 1], detalle: 1 });
      L.esfera('dorado', bx, by, b + H + 0.19, 0.04, { detalle: 1 });
      L.esfera('agua', rx, ry, b + H + 0.04, 0.09, { escala: [1.3, 0.25, 1], detalle: 1 });
    } else {
      // el Buda tirado por el suelo y el agua derramada
      const [tx, ty] = F.pt(W * 0.6, -0.3);
      L.esfera('dorado', tx, ty, b + 0.07, 0.075, { escala: [1.15, 0.9, 1], detalle: 1 });
      L.esfera('dorado', tx + 0.12, ty + 0.05, b + 0.04, 0.04, { detalle: 1 });
      L.cilindro('agua', tx - 0.25, ty, b, b + 0.01, 0.35, { segs: 16 });
      L.esfera('seca', gx, gy, b + H + 0.36, 0.08, { escala: [1.2, 0.6, 1], detalle: 0 });
    }
    x.sombra(c);
  },
  micro(L, c, x) {
    // microondas encima de la encimera (su base es la altura de la encimera)
    const b = x.b;
    const F = frente(c, c.mira || 'e');
    const { W, D } = F;
    F.caja(L, c.color || 'negro', 0, 0, b, W, D, b + 0.27, { redondeo: 0.02 });
    F.caja(L, x.ruina ? 'agujero' : 'negro', 0.04, -0.008, b + 0.04, W * 0.66, 0.01, b + 0.23, { redondeo: 0 });
    F.caja(L, 'metal', W * 0.72, -0.008, b + 0.06, W - 0.04, 0.01, b + 0.21, { redondeo: 0 });
  },
  cenefa(L, c, x) {
    // la tira de azulejo azul que hace de «alfombra» en el suelo de la entrada
    const b = x.b, t = 0.09, z0 = b + 0.001, z1 = b + 0.006;
    L.caja('cenefa', c.x0, c.y0, z0, c.x1, c.y0 + t, z1, { redondeo: 0 });
    L.caja('cenefa', c.x0, c.y1 - t, z0, c.x1, c.y1, z1, { redondeo: 0 });
    L.caja('cenefa', c.x0, c.y0, z0, c.x0 + t, c.y1, z1, { redondeo: 0 });
    L.caja('cenefa', c.x1 - t, c.y0, z0, c.x1, c.y1, z1, { redondeo: 0 });
  },
  cerrado(L, c, x) {
    // una habitación que no entra: tapada a la altura de las paredes cortadas
    const b = x.b, H = MURO_BAJO + 0.02;
    L.caja('interior', c.x0 + 0.02, c.y0 + 0.02, b, c.x1 - 0.02, c.y1 - 0.02, b + H, { redondeo: 0.03 });
    L.caja('losa', c.x0 + 0.1, c.y0 + 0.1, b + H, c.x1 - 0.1, c.y1 - 0.1, b + H + 0.02, { redondeo: 0 });
  },
  bloque(L, c, x) {
    const b = x.b;
    L.caja('piedra', c.x0, c.y0, b, c.x1, c.y1, b + MURO_ALTO, { redondeo: 0.04 });
    L.caja('losa', c.x0 + 0.25, c.y0 + 0.25, b + MURO_ALTO, c.x1 - 0.25, c.y1 - 0.25, b + MURO_ALTO + 0.03, { redondeo: 0 });
    for (const [u0, u1] of c.ventanas || []) {
      L.caja('persiana', u0, c.y0 - 0.05, b + 0.9, u1, c.y0 + 0.02, b + 2.0, { redondeo: 0.01 });
      L.caja('blanco', u0 - 0.06, c.y0 - 0.08, b + 0.85, u1 + 0.06, c.y0 + 0.02, b + 0.92, { redondeo: 0 });
    }
  },
};

// ---------- escaleras y barandillas ----------

// Un tramo de escalera. Si va macizo hasta el suelo, por los lados es de yeso y solo la huella es del material del escalón;
// con «cenefa», cada tabica lleva la tira de azulejo azul.
function tramo(L, s, b, clave) {
  const n = s.pasos;
  const dz = (s.hasta - s.desde) / n;
  for (let k = 0; k < n; k++) {
    const t0 = k / n, t1 = (k + 1) / n;
    let { x0, x1, y0, y1 } = s;
    if (s.sube === 'e') { x0 = s.x0 + (s.x1 - s.x0) * t0; x1 = s.x0 + (s.x1 - s.x0) * t1; }
    if (s.sube === 'w') { x1 = s.x1 - (s.x1 - s.x0) * t0; x0 = s.x1 - (s.x1 - s.x0) * t1; }
    if (s.sube === 's') { y0 = s.y0 + (s.y1 - s.y0) * t0; y1 = s.y0 + (s.y1 - s.y0) * t1; }
    if (s.sube === 'n') { y1 = s.y1 - (s.y1 - s.y0) * t0; y0 = s.y1 - (s.y1 - s.y0) * t1; }
    const arriba = s.desde + dz * (k + 1);
    if (s.volado) { L.caja(clave, x0, y0, b + Math.max(0, arriba - 0.32), x1, y1, b + arriba, { redondeo: 0.02 }); continue; }
    const grueso = Math.min(0.07, arriba * 0.5);
    if (arriba - grueso > 0.02) L.caja(s.lados || 'interior', x0, y0, b, x1, y1, b + arriba - grueso, { redondeo: 0.01 });
    L.caja(clave, x0, y0, b + arriba - grueso, x1, y1, b + arriba, { redondeo: 0.015 });
    if (s.cenefa) {
      const z0 = b + arriba - dz + 0.015, z1 = b + arriba - grueso - 0.01;
      if (z1 - z0 < 0.03) continue;
      const e = 0.008;
      if (s.sube === 'e') L.caja('cenefa', x0 - e, y0 + 0.02, z0, x0, y1 - 0.02, z1, { redondeo: 0 });
      if (s.sube === 'w') L.caja('cenefa', x1, y0 + 0.02, z0, x1 + e, y1 - 0.02, z1, { redondeo: 0 });
      if (s.sube === 's') L.caja('cenefa', x0 + 0.02, y0 - e, z0, x1 - 0.02, y0, z1, { redondeo: 0 });
      if (s.sube === 'n') L.caja('cenefa', x0 + 0.02, y1, z0, x1 - 0.02, y1 + e, z1, { redondeo: 0 });
    }
  }
}

function baranda(L, br, b0) {
  const b = b0 + (br.base || 0);
  const pts = br.puntos;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i];
    const [bx, by] = pts[i + 1];
    const largo = Math.hypot(bx - ax, by - ay);
    if (br.tipo === 'balaustrada') {
      const ancho = 0.09;
      L.caja('liso', Math.min(ax, bx) - ancho, Math.min(ay, by) - ancho, b, Math.max(ax, bx) + ancho, Math.max(ay, by) + ancho, b + 0.13, { redondeo: 0.02 });
      L.caja('liso', Math.min(ax, bx) - ancho, Math.min(ay, by) - ancho, b + 0.8, Math.max(ax, bx) + ancho, Math.max(ay, by) + ancho, b + 0.93, { redondeo: 0.03 });
      const n = Math.max(1, Math.round(largo / 0.3));
      for (let j = 1; j < n; j++) {
        const t = j / n;
        L.cilindro('liso', ax + (bx - ax) * t, ay + (by - ay) * t, b + 0.13, b + 0.8, 0.045, { rArriba: 0.035, segs: 8 });
      }
    } else {
      const n = Math.max(1, Math.round(largo / 0.9));
      for (let j = 0; j <= n; j++) {
        const t = j / n;
        L.cilindro('metal', ax + (bx - ax) * t, ay + (by - ay) * t, b, b + 0.95, 0.022, { segs: 6 });
      }
      L.barra('metal', ax, ay, bx, by, b + 0.95, 0.03, { segs: 8 });
      L.barra('metal', ax, ay, bx, by, b + 0.5, 0.014, { segs: 6 });
    }
  }
}

// ---------- muros con corte ----------

function muro(lotes, m) {
  const horiz = m.y0 === m.y1;
  const a = horiz ? Math.min(m.x0, m.x1) : Math.min(m.y0, m.y1);
  const z = horiz ? m.y0 : m.x0;
  const t = m.material === 'piedra' ? 0.34 : m.lado === 'int' ? 0.12 : 0.24;
  const ext = m.lado === 'int' ? 0.06 : t / 2;
  const fin = (horiz ? Math.max(m.x0, m.x1) : Math.max(m.y0, m.y1)) + ext;
  const base = m.base || 0;
  const huecos = [...m.huecos].sort((p, q) => p.desde - q.desde);
  const versiones = m.lado === 'int' ? [['int', MURO_BAJO]] : [[m.lado + '_alto', MURO_ALTO], [m.lado + '_bajo', MURO_BAJO]];
  // revestido: { cara: 'n' | 's' | 'e' | 'w', material } — por esa cara la pared va alicatada
  const rv = m.revestido;
  const signo = rv && (rv.cara === 'e' || rv.cara === 's') ? 1 : -1;
  for (const [nombre, H] of versiones) {
    const L = lotes[nombre];
    const pieza = (u0, u1, h0, h1, k = m.material) => {
      if (u1 - u0 < 0.01 || h1 - h0 < 0.01) return;
      if (horiz) L.caja(k, u0, z - t / 2, base + h0, u1, z + t / 2, base + h1);
      else L.caja(k, z - t / 2, u0, base + h0, z + t / 2, u1, base + h1);
      if (rv && k === m.material) {
        const f0 = z + signo * t / 2, f1 = f0 + signo * 0.018;
        if (horiz) L.caja(rv.material, u0, f0, base + h0, u1, f1, base + h1, { redondeo: 0 });
        else L.caja(rv.material, f0, u0, base + h0, f1, u1, base + h1, { redondeo: 0 });
      }
    };
    const vidrio = (u0, u1, h0, h1) => {
      if (h1 - h0 < 0.02) return;
      if (horiz) L.caja('cristal', u0, z - 0.035, base + h0, u1, z + 0.035, base + h1, { redondeo: 0, libre: true });
      else L.caja('cristal', z - 0.035, u0, base + h0, z + 0.035, u1, base + h1, { redondeo: 0, libre: true });
    };
    let cur = a - ext;
    for (const hu of huecos) {
      pieza(cur, hu.desde, 0, H);
      if (hu.tipo === 'ventana' || hu.tipo === 'ventanal') {
        const s = hu.tipo === 'ventana' ? 0.9 : 0.25;
        const l = 2.1;
        pieza(hu.desde, hu.hasta, 0, Math.min(s, H));
        if (H > s) vidrio(hu.desde, hu.hasta, s, Math.min(l, H));
        if (H > l) pieza(hu.desde, hu.hasta, l, H);
      } else if (hu.tipo === 'porton') {
        if (H > 2.3) pieza(hu.desde, hu.hasta, 2.3, H);
      } else {
        if (H > 2.1) pieza(hu.desde, hu.hasta, 2.1, H);
        // la puerta de la calle, cerrada (de su color)
        if (hu.hoja) pieza(hu.desde + 0.03, hu.hasta - 0.03, 0, Math.min(2.08, H), hu.hoja);
      }
      cur = hu.hasta;
    }
    pieza(cur, fin, 0, H);
  }
}

// Muro en ruinas (3 semanas sin limpiar): el mismo muro a trozos de distinta altura, con algún boquete,
// sin cristales y con tablas clavadas en las ventanas. Lo que se cae va al suelo, con los muebles rotos (Lsuelo).
function muroRuina(lotes, m, r, Lsuelo) {
  const horiz = m.y0 === m.y1;
  const a = horiz ? Math.min(m.x0, m.x1) : Math.min(m.y0, m.y1);
  const z = horiz ? m.y0 : m.x0;
  const t = m.material === 'piedra' ? 0.34 : m.lado === 'int' ? 0.12 : 0.24;
  const ext = m.lado === 'int' ? 0.06 : t / 2;
  const fin = (horiz ? Math.max(m.x0, m.x1) : Math.max(m.y0, m.y1)) + ext;
  const ini = a - ext, largo = fin - ini;
  const base = m.base || 0;
  const huecos = [...m.huecos].sort((p, q) => p.desde - q.desde);
  const enHueco = (u) => huecos.some((h) => u > h.desde - 0.1 && u < h.hasta + 0.1);
  // zonas hundidas a lo largo del muro
  const hundidos = [];
  const nh = largo > 4.5 ? 2 : largo > 1.2 ? 1 : 0;
  for (let i = 0; i < nh; i++) hundidos.push([ini + largo * (0.15 + 0.7 * r()), 0.55 + r() * 0.9]);
  const caida = (u) => hundidos.reduce((f, [c, rad]) => Math.max(f, 1 - Math.abs(u - c) / rad), 0);
  // un boquete en los muros altos largos
  let boquete = null;
  if (largo > 2.4 && m.lado !== 'int') {
    for (let k = 0; k < 8 && !boquete; k++) {
      const c = ini + largo * (0.15 + 0.7 * r());
      if (!enHueco(c) && caida(c) < 0.2) boquete = { u0: c - 0.3 - r() * 0.2, u1: c + 0.3 + r() * 0.2, h0: 0.8 + r() * 0.3, h1: 1.5 + r() * 0.35 };
    }
  }
  // a trozos: largos y enteros donde no se ha caído nada; estrechos y en escalera en los derrumbes
  const segs = [];
  for (let u = ini; u < fin - 0.005;) {
    const dentroDeCaida = caida(u + 0.08) > 0.02 || caida(u + 0.3) > 0.02;
    const w = Math.min(fin - u, dentroDeCaida ? 0.12 + r() * 0.14 : 0.5 + r() * 0.5);
    const f = caida(u + w / 2);
    const mella = f > 0.02 ? (r() - 0.35) * 0.26 : 0;
    segs.push({ u0: u, u1: u + w, h: Math.max(0, MURO_ALTO * (1 - 0.97 * f) - mella), j: r(), k: r(), f });
    u += w;
  }
  const dentro = { n: 1, s: -1, e: -1, w: 1 }[m.lado];
  const lado = () => dentro ?? (r() < 0.5 ? 1 : -1);
  const plano = (u, off) => (horiz ? [u, z + off] : [z + off, u]);
  const versiones = m.lado === 'int' ? [['int', MURO_BAJO]] : [[m.lado + '_alto', MURO_ALTO], [m.lado + '_bajo', MURO_BAJO]];
  for (const [nombre, H] of versiones) {
    const L = lotes[nombre];
    const pieza = (u0, u1, h0, h1, k = m.material) => {
      if (u1 - u0 < 0.01 || h1 - h0 < 0.02) return;
      if (horiz) L.caja(k, u0, z - t / 2, base + h0, u1, z + t / 2, base + h1, { redondeo: 0.015 });
      else L.caja(k, z - t / 2, u0, base + h0, z + t / 2, u1, base + h1, { redondeo: 0.015 });
    };
    const macizos = [];
    let cur = ini;
    for (const hu of huecos) {
      macizos.push([cur, hu.desde, 0, H]);
      if (hu.tipo === 'ventana' || hu.tipo === 'ventanal') {
        const s = hu.tipo === 'ventana' ? 0.9 : 0.25;
        macizos.push([hu.desde, hu.hasta, 0, Math.min(s, H)]);
        if (H > 2.1) macizos.push([hu.desde, hu.hasta, 2.1, H]);
      } else if (hu.tipo === 'porton') {
        if (H > 2.3) macizos.push([hu.desde, hu.hasta, 2.3, H]);
      } else if (H > 2.1) macizos.push([hu.desde, hu.hasta, 2.1, H]);
      cur = hu.hasta;
    }
    macizos.push([cur, fin, 0, H]);
    for (const [m0, m1, h0, h1] of macizos) {
      for (const sg of segs) {
        const u0 = Math.max(m0, sg.u0), u1 = Math.min(m1, sg.u1);
        if (u1 - u0 < 0.01) continue;
        // en la versión cortada el borde de arriba también queda roto
        const tope = Math.min(h1, H < MURO_ALTO ? Math.min(H - (sg.f > 0.02 ? sg.j * 0.16 : 0), sg.h) : sg.h);
        if (tope <= h0 + 0.02) continue;
        const um = (u0 + u1) / 2;
        if (boquete && H >= MURO_ALTO && um > boquete.u0 && um < boquete.u1) {
          const b0 = boquete.h0 + (sg.k - 0.5) * 0.18, b1 = boquete.h1 + (sg.j - 0.5) * 0.2;
          pieza(u0, u1, h0, Math.min(tope, b0));
          if (tope > b1) pieza(u0, u1, Math.max(h0, b1), tope);
        } else pieza(u0, u1, h0, tope);
      }
    }
    // tablas clavadas en las ventanas (por dentro), solo en la versión alta
    if (H >= MURO_ALTO) {
      for (const hu of huecos) {
        if (hu.tipo !== 'ventana' && hu.tipo !== 'ventanal') continue;
        const ancho = hu.hasta - hu.desde;
        const n = Math.max(1, Math.round(ancho / 1.3));
        const off = (dentro ?? 1) * (t / 2 + 0.03);
        for (let i = 0; i < n; i++) {
          const uc = hu.desde + (ancho / n) * (i + 0.5);
          const lg = Math.min(ancho / n + 0.25, 1.5);
          for (const sgn of [-1, 1]) {
            const [px, py] = plano(uc, off);
            const ang = sgn * 0.42;
            if (horiz) L.cajaCentro('tabla', px, py, base + 1.5 - 0.06, lg, 0.04, 0.12, 0, { rueda: ang, redondeo: 0.01 });
            else L.cajaCentro('tabla', px, py, base + 1.5 - 0.06, 0.04, lg, 0.12, 0, { inclina: ang, redondeo: 0.01 });
          }
        }
      }
    }
  }
  // escombros al pie de lo que se ha caído y cristales debajo de las ventanas
  for (const sg of segs) {
    if (sg.h > MURO_ALTO * 0.62) continue;
    const n = 1 + Math.floor(sg.j * 3);
    for (let k = 0; k < n; k++) {
      const s = 0.1 + r() * 0.18;
      const [px, py] = plano(sg.u0 + r() * (sg.u1 - sg.u0), lado() * (t / 2 + 0.08 + r() * 0.55));
      Lsuelo.cajaCentro(r() < 0.6 ? 'escombro' : m.material, px, py, base, s, s * (0.6 + r() * 0.6), s * (0.45 + r() * 0.4), r() * Math.PI, { redondeo: 0.015, inclina: (r() - 0.5) * 0.7 });
    }
  }
  for (const hu of huecos) {
    if (hu.tipo !== 'ventana' && hu.tipo !== 'ventanal') continue;
    for (let k = 0; k < 4; k++) {
      const [px, py] = plano(hu.desde + r() * (hu.hasta - hu.desde), (dentro ?? 1) * (t / 2 + 0.1 + r() * 0.4));
      Lsuelo.cajaCentro('cristal', px, py, base, 0.1 + r() * 0.12, 0.06 + r() * 0.1, 0.012, r() * Math.PI, { redondeo: 0 });
    }
  }
}

// ---------- cosas colgadas de las paredes ----------
// Campanas, muebles altos, espejos y el tiro de la chimenea van con su pared: se ven cuando la pared se ve entera
// y desaparecen cuando se corta (si no, quedarían flotando). En las paredes de dentro, que van siempre cortadas, no salen.
const COLGADOS = new Set(['campana', 'altos', 'espejo', 'chimeneacolumna']);
const esColgado = (c) => COLGADOS.has(c.t);

function paredDe(def, c) {
  const lado = c.pared || OPUESTO[c.mira || 's'];
  const vertical = lado === 'w' || lado === 'e';
  const ref = lado === 'w' ? c.x0 : lado === 'e' ? c.x1 : lado === 'n' ? c.y0 : c.y1;
  const [a0, a1] = vertical ? [c.y0, c.y1] : [c.x0, c.x1];
  for (const m of def.muros) {
    const mv = Math.abs(m.x0 - m.x1) < 1e-6;
    if (mv !== vertical || Math.abs((vertical ? m.x0 : m.y0) - ref) > 0.35) continue;
    const b0 = vertical ? Math.min(m.y0, m.y1) : Math.min(m.x0, m.x1);
    const b1 = vertical ? Math.max(m.y0, m.y1) : Math.max(m.x0, m.x1);
    if (Math.min(a1, b1) - Math.max(a0, b0) > Math.min(0.2, (a1 - a0) / 2)) return m.lado;
  }
  return null;
}

// ---------- sombras blandas ----------

function mallaSombras(rects, textura, opacidad, mats) {
  if (!rects.length) return null;
  const geos = rects.map(({ x0, y0, x1, y1, z, crece = 1.25 }) => {
    const w = (x1 - x0) * crece + 0.12, d = (y1 - y0) * crece + 0.12;
    const g = new THREE.PlaneGeometry(w, d);
    g.rotateX(-Math.PI / 2);
    g.translate((x0 + x1) / 2 - CX, z + 0.012, (y0 + y1) / 2 - CZ);
    return g.toNonIndexed();
  });
  let geo = geos[0];
  if (geos.length > 1) {
    const total = geos.reduce((n, g) => n + g.attributes.position.count, 0);
    const posicion = new Float32Array(total * 3), uv = new Float32Array(total * 2), normal = new Float32Array(total * 3);
    let o = 0;
    for (const g of geos) {
      posicion.set(g.attributes.position.array, o * 3);
      uv.set(g.attributes.uv.array, o * 2);
      normal.set(g.attributes.normal.array, o * 3);
      o += g.attributes.position.count;
    }
    geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(posicion, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setAttribute('normal', new THREE.BufferAttribute(normal, 3));
  }
  const mat = mats.registrar(new THREE.MeshBasicMaterial({ color: '#000000', map: textura, transparent: true, opacity: opacidad, depthWrite: false }));
  const malla = new THREE.Mesh(geo, mat);
  malla.renderOrder = 1;
  return malla;
}

// ---------- suciedad y brillos: en suciedad.js ----------

// ---------- una planta ----------

function nuevosLotes(estilo, semilla) {
  const o = { int: new Lote(estilo, semilla) };
  for (const l of ['n', 's', 'e', 'w']) { o[l + '_alto'] = new Lote(estilo, semilla + 1); o[l + '_bajo'] = new Lote(estilo, semilla + 2); }
  return o;
}

// La versión en ruinas (3 semanas sin limpiar) se construye solo cuando hace falta, la primera vez:
// muebles rotos, escombros y paredes caídas. Así la casa normal se dibuja antes en el móvil.
export function construirRuina(p, estilo) {
  if (p.conRuina || p.def.piso === 'garaje') return;
  const def = p.def, mats = p.materiales;
  const LR = new Lote(estilo, 240 + def.nivel, { proporcion: 0.2 });
  for (const c of def.cosas) {
    const f = MUEBLES[c.t];
    if (f && !esColgado(c)) f(LR, c, { b: c.base || 0, ruina: true, sombra: () => {} });
  }
  const lotesRuina = nuevosLotes(estilo, 70);
  const rRuina = azar(555 + def.nivel * 31);
  for (const m of def.muros) muroRuina(lotesRuina, m, rRuina, LR);
  const cambiar = (viejo, nuevo) => { p.grupo.remove(viejo); nuevo.visible = false; p.grupo.add(nuevo); return nuevo; };
  p.mueblesRuina = cambiar(p.mueblesRuina, LR.mallas(mats));
  p.int.ruina = cambiar(p.int.ruina, lotesRuina.int.mallas(mats));
  for (const l of ['n', 's', 'e', 'w']) {
    p.muros[l].altoRuina = cambiar(p.muros[l].altoRuina, lotesRuina[l + '_alto'].mallas(mats));
    p.muros[l].bajoRuina = cambiar(p.muros[l].bajoRuina, lotesRuina[l + '_bajo'].mallas(mats));
  }
  p.conRuina = true;
}

function construirPlanta(def, estilo, conRuina = false) {
  const mats = new Materiales(estilo);
  const L = new Lote(estilo, 40 + def.nivel);                                       // suelos, escaleras y barandillas
  const LM = new Lote(estilo, 140 + def.nivel, { proporcion: 0.2 });                // muebles
  const LR = conRuina ? new Lote(estilo, 240 + def.nivel, { proporcion: 0.2 }) : null;   // muebles rotos y escombros
  const sombras = [];
  const ocupado = [];
  const ctx = (c, ruina = false) => ({
    b: c.base || 0,
    ruina,
    sombra: (rc) => { if (!ruina) sombras.push({ ...rc, z: c.base || 0 }); },
  });

  for (const s of def.suelos) {
    const b = s.base || 0;
    if (s.fuera && def.nivel === 0) { L.caja(s.suelo, s.x0, s.y0, -0.05, s.x1, s.y1, 0.0, { redondeo: 0 }); continue; }
    L.caja('losa', s.x0, s.y0, -0.27, s.x1, s.y1, b - 0.04, { redondeo: 0 });
    L.caja(s.suelo, s.x0, s.y0, b - 0.06, s.x1, s.y1, b, { redondeo: 0 });
  }
  const lotesColgados = {};
  for (const c of def.cosas) {
    const f = MUEBLES[c.t];
    if (!f) continue;
    if (esColgado(c)) {
      const lado = paredDe(def, c);
      if (!lado || lado === 'int') continue;
      lotesColgados[lado] ??= new Lote(estilo, 300 + def.nivel, { proporcion: 0.2 });
      f(lotesColgados[lado], c, { b: c.base || 0, ruina: false, sombra: () => {} });
      continue;
    }
    f(LM, c, ctx(c));
    if (LR) f(LR, c, ctx(c, true));
    if (!['alfombra', 'zen', 'bloque', 'cenefa', 'micro'].includes(c.t)) ocupado.push(c);
  }
  for (const e of def.escaleras) {
    tramo(L, e, 0, e.huella || (def.nivel === 2 && e.x1 <= 11.01 ? 'suelo_baldosa' : 'madera'));
    ocupado.push(e);
  }
  for (const br of def.barandas) baranda(L, br, 0);

  const lotesMuro = nuevosLotes(estilo, 60);
  const lotesRuina = conRuina ? nuevosLotes(estilo, 70) : null;
  const rRuina = azar(555 + def.nivel * 31);
  for (const m of def.muros) {
    muro(lotesMuro, m);
    if (conRuina) muroRuina(lotesRuina, m, rRuina, LR);
  }

  const grupo = new THREE.Group();
  grupo.add(L.mallas(mats));
  const muebles = LM.mallas(mats);
  const mueblesRuina = LR ? LR.mallas(mats) : new THREE.Group();
  mueblesRuina.visible = false;
  grupo.add(muebles, mueblesRuina);
  const int = { normal: lotesMuro.int.mallas(mats), ruina: conRuina ? lotesRuina.int.mallas(mats) : new THREE.Group() };
  int.ruina.visible = false;
  grupo.add(int.normal, int.ruina);
  const muros = {};
  for (const l of ['n', 's', 'e', 'w']) {
    muros[l] = {
      alto: lotesMuro[l + '_alto'].mallas(mats), bajo: lotesMuro[l + '_bajo'].mallas(mats),
      altoRuina: conRuina ? lotesRuina[l + '_alto'].mallas(mats) : new THREE.Group(),
      bajoRuina: conRuina ? lotesRuina[l + '_bajo'].mallas(mats) : new THREE.Group(),
    };
    muros[l].altoRuina.visible = muros[l].bajoRuina.visible = false;
    if (lotesColgados[l]) muros[l].alto.add(lotesColgados[l].mallas(mats));
    grupo.add(muros[l].alto, muros[l].bajo, muros[l].altoRuina, muros[l].bajoRuina);
  }
  const s = mallaSombras(sombras, texturaSombra(), estilo.sombra, mats);
  if (s) grupo.add(s);

  const { piezas: suciedad, animados } = construirSuciedad(def, estilo, mats, ocupado);
  for (const p of suciedad) grupo.add(p);
  const { grupo: grupoBrillos, sprites: brillos } = construirBrillos(def, estilo, mats, muros);
  grupo.add(grupoBrillos);
  const grietas = [];   // con las paredes en ruinas ya no hacen falta
  const moho = def.piso === 'garaje' ? [] : construirMohoParedes(def, estilo, mats, muros);

  // halo de «tu piso»: un brillo blando de tu color alrededor de la planta (o de sus zonas)
  const huella = def.huella || { xs: [0, def.nivel === 2 ? 17.5 : 19.3], ys: [def.nivel === 2 ? 0 : -1.8, 9] };
  const rects = def.zonas || (def.nivel === 2 ? [[0, 0, 17.5, 9]] : [[0, 0, 17.5, 9], [11, -1.8, 19.3, 0], [17.5, -1.8, 19.3, 5]]);
  const MG = 1.3;
  const bx0 = huella.xs[0] - MG, bx1 = huella.xs[1] + MG, by0 = huella.ys[0] - MG, by1 = huella.ys[1] + MG;
  const halo = new THREE.Mesh(
    new THREE.PlaneGeometry(bx1 - bx0, by1 - by0),
    new THREE.MeshBasicMaterial({ map: texturaHaloZonas(rects, [bx0, by0, bx1, by1]), color: '#ffffff', transparent: true, opacity: 0.95, depthWrite: false }),
  );
  halo.rotation.x = -Math.PI / 2;
  halo.position.set((bx0 + bx1) / 2 - CX, -0.29, (by0 + by1) / 2 - CZ);
  halo.visible = false;
  grupo.add(halo);

  const cerrados = def.cosas.filter((c) => c.t === 'cerrado');
  return { def, grupo, materiales: mats, muros, int, muebles, mueblesRuina, suciedad, animados, brillos, grietas, moho, halo, huella, cerrados, conRuina, ruina: false, deCara: {} };
}

// ---------- tejados (el piso de José va cerrado) ----------

function triangulosOrientados(L, key, tris) {
  const pts = [];
  for (const [a, b, c] of tris) {
    const ux = b[0] - a[0], uy = b[2] - a[2], uz = b[1] - a[1];
    const vx = c[0] - a[0], vy = c[2] - a[2], vz = c[1] - a[1];
    // normal en coordenadas del mundo (x, altura, y)
    const ny = uz * vx - ux * vz;
    if (ny < 0) pts.push(a, c, b); else pts.push(a, b, c);
  }
  L.triangulos(key, pts);
}

function construirTejado(estilo, modo = 'entera') {
  const entera = modo !== 'foco';
  const mats = new Materiales(estilo);
  const L = new Lote(estilo, 77);
  const p = TEJADOS.piedra, n = TEJADOS.nuevo;
  if (estilo.voxel) {
    const pasos = 9;
    for (let k = 0; k < pasos; k++) {
      const d = ((p.y1 - p.y0) / 2) * (k / pasos);
      if (entera) L.caja('tejado', p.x0, p.y0 + d, (p.alto / pasos) * k, p.x1, p.y1 - d, (p.alto / pasos) * (k + 1));
      const dx = ((n.x1 - n.x0) / 2) * (k / pasos), dy = ((n.x1 - n.x0) / 2) * (k / pasos);
      L.caja('tejado', n.x0 + dx, n.y0 + dy, (n.alto / pasos) * k, n.x1 - dx, n.y1 - dy, (n.alto / pasos) * (k + 1));
    }
  } else {
    if (entera) {
      const ym = (p.y0 + p.y1) / 2;
      const A = [p.x0, p.y0, 0], B = [p.x1, p.y0, 0], Cc = [p.x1, p.y1, 0], D = [p.x0, p.y1, 0];
      const R1 = [p.x0, ym, p.alto], R2 = [p.x1, ym, p.alto];
      triangulosOrientados(L, 'tejado', [[A, B, R2], [A, R2, R1], [Cc, D, R1], [Cc, R1, R2]]);
      L.triangulos('piedra', [D, A, R1, B, Cc, R2]);
      const s = (y) => (p.alto * (y - p.y0)) / (ym - p.y0) + 0.03;
      const [cx0, cy0, cx1, cy1] = TEJADOS.claraboya;
      triangulosOrientados(L, 'coche_cristal', [
        [[cx0, cy0, s(cy0)], [cx1, cy0, s(cy0)], [cx1, cy1, s(cy1)]],
        [[cx0, cy0, s(cy0)], [cx1, cy1, s(cy1)], [cx0, cy1, s(cy1)]],
      ]);
    }
    const lado = (n.x1 - n.x0) / 2;
    const r1 = [(n.x0 + n.x1) / 2, n.y0 + lado, n.alto], r2 = [(n.x0 + n.x1) / 2, n.y1 - lado, n.alto];
    const a = [n.x0, n.y0, 0], b = [n.x1, n.y0, 0], c = [n.x1, n.y1, 0], d = [n.x0, n.y1, 0];
    triangulosOrientados(L, 'tejado', [[a, b, r1], [b, c, r2], [b, r2, r1], [c, d, r2], [d, a, r1], [d, r1, r2]]);
  }
  const [hx0, hy0, hx1, hy1] = TEJADOS.chimenea;
  L.caja('chimenea_piedra', hx0, hy0, 0.25, hx1, hy1, n.alto + 0.75);
  L.caja('chimenea_piedra', hx0 - 0.08, hy0 - 0.08, n.alto + 0.75, hx1 + 0.08, hy1 + 0.08, n.alto + 0.88);
  const grupo = L.mallas(mats);
  for (const m of mats.todos) m.side = THREE.DoubleSide;
  return { grupo, materiales: mats };
}

// ---------- jardín ----------

function construirJardin(estilo) {
  const mats = new Materiales(estilo);
  const L = new Lote(estilo, 88);
  const J = JARDIN;
  L.caja('cesped', J.x0, J.y0, -0.16, J.x1, J.y1, -0.05, { redondeo: 0.3 });
  L.caja('tierra', J.x0 + 0.15, J.y0 + 0.15, -0.9, J.x1 - 0.15, J.y1 - 0.15, -0.14, { redondeo: 0.2 });
  const circulos = [];
  const [ax, ay] = J.arbol;
  L.cilindro('tronco', ax, ay, -0.05, 1.5, 0.15, { rArriba: 0.09, segs: 8 });
  L.esfera('hoja', ax, ay, 1.95, 0.85, { detalle: 1 });
  L.esfera('hoja', ax + 0.55, ay + 0.2, 1.6, 0.6, { detalle: 1 });
  L.esfera('hoja', ax - 0.5, ay - 0.15, 1.65, 0.55, { detalle: 1 });
  circulos.push({ x0: ax - 1, y0: ay - 1, x1: ax + 1, y1: ay + 1, z: -0.05, crece: 1 });
  for (const [bx, by] of J.arbustos) {
    L.esfera('hoja', bx, by, 0.3, 0.5, { escala: [1, 0.78, 1], detalle: 1 });
    circulos.push({ x0: bx - 0.55, y0: by - 0.55, x1: bx + 0.55, y1: by + 0.55, z: -0.05, crece: 1 });
  }
  const [px, py] = J.pelota;
  L.esfera('pelota', px, py, 0.28, 0.33, { detalle: 1 });
  circulos.push({ x0: px - 0.35, y0: py - 0.35, x1: px + 0.35, y1: py + 0.35, z: -0.05, crece: 1 });
  const grupo = L.mallas(mats, { sinBordes: true });
  const s = mallaSombras(circulos, texturaCirculo(), estilo.sombra * 1.3, mats);
  if (s) grupo.add(s);
  return { grupo, materiales: mats };
}

export function construirCasa(estilo, modo = 'entera') {
  if (modo === 'foco') {
    const plantas = PLANTAS.map((def) => construirPlanta(enfocar(def, FOCO[def.nivel]), estilo));
    const defG = enfocar({ ...PLANTAS[0], nivel: -1, piso: 'garaje', suciedad: GARAJE.suciedad, sitios: GARAJE.sitios }, { zonas: GARAJE.zonas });
    const garaje = construirPlanta(defG, estilo, false);
    garaje.grupo.position.x = GARAJE.desplazar;
    garaje.desplazar = GARAJE.desplazar;
    // sin tejado: en esta vista solo cuenta lo que se limpia
    return { modo, plantas, garaje, tejado: { grupo: new THREE.Group(), materiales: new Materiales(estilo) }, jardin: null };
  }
  return { modo, plantas: PLANTAS.map((def) => construirPlanta(def, estilo)), garaje: null, tejado: construirTejado(estilo), jardin: construirJardin(estilo) };
}

export function liberar(objeto) {
  objeto.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
  });
}
