import * as THREE from 'three';
import { Lote, CX, CZ, azar } from './geometria.js';
import { SUCIEDAD } from './estilos.js';
import { texturaBrillo, texturaTelarana, texturaPeste, texturaNiebla } from './texturas.js';

// Niveles de suciedad de un piso (cada uno suma lo de los anteriores):
//   0 · lo normal de una semana (algo de ropa, latas, polvo)
//   1 · una semana sin limpiar: desorden, el doble de lío y bolsas de basura
//   2 · dos semanas: asco: moho en suelo y paredes, manchas, platos apilados, telarañas, moscas y peste
//   3 · tres semanas o más: ruina: paredes rotas, muebles rotos (en casa.js), agujeros en el suelo,
//       charcos verdes, ratas, escombros y nube de peste verde
// Niveles de brillo de un piso limpio: 1 normal · 2 con brillos · 3 reluciente (destellos en las ventanas)

const GEO_MOSCA = new THREE.SphereGeometry(0.035, 6, 4);

export function construirSuciedad(def, estilo, mats, ocupado) {
  const r = azar(101 + def.nivel * 17);
  const piezas = [];
  const animados = { moscas: [], peste: [], niebla: [], ratas: [] };
  const sueloEn = (x, y) => (def.suelos.find((s) => x > s.x0 && x < s.x1 && y > s.y0 && y < s.y1) || {}).suelo || 'losa';
  const libre = (x, y, m = 0.12) => !ocupado.some((o) => x > o.x0 - m && x < o.x1 + m && y > o.y0 - m && y < o.y1 + m);
  const sitio = (x0, y0, x1, y1, m) => {
    for (let k = 0; k < 40; k++) {
      const x = x0 + r() * (x1 - x0), y = y0 + r() * (y1 - y0);
      if (libre(x, y, m)) return [x, y];
    }
    return null;
  };
  const meter = (L, nivel, extra = {}) => {
    const g = L.mallas(mats, { sinBordes: true });
    g.userData = { nivel, ...extra };
    piezas.push(g);
    return g;
  };
  const tipos = ['ropa', 'ropa', 'ropa', 'papel', 'lata', 'pizza', 'mancha', 'mancha', 'polvo', 'calcetin', 'plato', 'bolsa'];

  const basura = (L, t, x, y, b, g) => {
    if (t === 'ropa') {
      const col = SUCIEDAD.ropa[Math.floor(r() * SUCIEDAD.ropa.length)];
      L.cajaCentro(col, x, y, b, 0.66, 0.46, 0.07, g, { redondeo: 0.025 });
      L.cajaCentro(col, x + 0.16, y + 0.06, b + 0.05, 0.36, 0.26, 0.06, g + 0.6, { redondeo: 0.02 });
    } else if (t === 'calcetin') {
      L.cajaCentro('#ffffff', x, y, b, 0.26, 0.1, 0.05, g, { redondeo: 0.02 });
      L.cajaCentro('#c9ced6', x + 0.1, y + 0.08, b, 0.24, 0.1, 0.05, g + 1.1, { redondeo: 0.02 });
    } else if (t === 'papel') {
      L.cajaCentro(SUCIEDAD.papel, x, y, b, 0.24, 0.3, 0.012, g, { redondeo: 0 });
      L.esfera(SUCIEDAD.papel, x + 0.25, y - 0.1, b + 0.07, 0.07, { detalle: 0 });
    } else if (t === 'lata') {
      const col = SUCIEDAD.lata[Math.floor(r() * 2)];
      L.barra(col, x - 0.07, y, x + 0.07, y, b + 0.05, 0.05, { segs: 10 });
      L.cilindro(col, x + 0.2, y + 0.12, b, b + 0.13, 0.05, { segs: 10 });
    } else if (t === 'pizza') {
      L.cajaCentro(SUCIEDAD.carton, x, y, b, 0.5, 0.5, 0.06, g, { redondeo: 0.01 });
      L.cajaCentro(SUCIEDAD.carton, x + 0.1, y - 0.06, b + 0.06, 0.46, 0.46, 0.05, g + 0.4, { redondeo: 0.01 });
    } else if (t === 'mancha') {
      L.cilindro('mancha', x, y, b + 0.004, b + 0.009, 0.3 + r() * 0.2, { segs: 16 });
    } else if (t === 'polvo') {
      L.esfera(SUCIEDAD.polvo, x, y, b + 0.07, 0.08, { detalle: 0 });
      L.esfera(SUCIEDAD.polvo, x + 0.1, y + 0.06, b + 0.05, 0.06, { detalle: 0 });
      L.esfera(SUCIEDAD.polvo, x - 0.08, y + 0.08, b + 0.05, 0.05, { detalle: 0 });
    } else if (t === 'plato') {
      L.cilindro(SUCIEDAD.plato, x, y, b, b + 0.025, 0.14, { segs: 16 });
      L.cilindro(SUCIEDAD.resto, x + 0.02, y, b + 0.025, b + 0.04, 0.06, { segs: 8 });
    } else if (t === 'bolsa') {
      L.esfera(SUCIEDAD.bolsa, x, y, b + 0.28, 0.3, { escala: [1, 1.05, 0.9], detalle: 1 });
      L.cilindro(SUCIEDAD.bolsa, x, y, b + 0.54, b + 0.66, 0.06, { segs: 6 });
    }
  };

  const focos = [];   // sitios donde salen moscas y peste
  for (const [x0, y0, x1, y1, base] of def.suciedad) {
    const area = (x1 - x0) * (y1 - y0);
    // nivel 0 y 1: basura normal (el 1 añade el doble y bolsas)
    for (const [nivel, dens] of [[0, 1.05], [1, 0.75]]) {
      const n = Math.max(nivel === 0 ? 4 : 3, Math.round(area / dens));
      for (let i = 0; i < n; i++) {
        const p = sitio(x0, y0, x1, y1);
        if (!p) continue;
        const t = nivel === 1 && i % 4 === 0 ? 'bolsa' : tipos[Math.floor(r() * tipos.length)];
        const L = new Lote(estilo, 500 + piezas.length);
        basura(L, t, p[0], p[1], base, r() * Math.PI);
        meter(L, nivel, { tipo: t });
        if (t === 'bolsa' || t === 'plato' || t === 'pizza') focos.push([p[0], p[1], base, nivel]);
      }
    }
    // nivel 2: moho, platos apilados, mugre
    {
      const n = Math.max(2, Math.round(area / 3.2));
      for (let i = 0; i < n; i++) {
        const p = sitio(x0, y0, x1, y1);
        if (!p) continue;
        const L = new Lote(estilo, 900 + piezas.length);
        const [x, y] = p;
        L.cilindro('moho', x, y, base + 0.01, base + 0.016, 0.42 + r() * 0.3, { segs: 18 });
        L.cilindro('moho', x + 0.32, y - 0.18, base + 0.012, base + 0.018, 0.2 + r() * 0.15, { segs: 14 });
        L.cilindro('mugre', x - 0.25, y + 0.22, base + 0.009, base + 0.014, 0.28, { segs: 14 });
        if (i % 2 === 0) {
          for (let k = 0; k < 4; k++) L.cilindro(SUCIEDAD.plato, x + 0.55, y + 0.1, base + k * 0.035, base + k * 0.035 + 0.025, 0.15 - k * 0.005, { segs: 16 });
          focos.push([x + 0.55, y + 0.1, base, 2]);
        }
        meter(L, 2, { tipo: 'moho' });
      }
    }
    // nivel 2: manchas asquerosas en el suelo
    {
      const n = Math.max(2, Math.round(area / 2.6));
      for (let i = 0; i < n; i++) {
        const p = sitio(x0, y0, x1, y1, 0.05);
        if (!p) continue;
        const L = new Lote(estilo, 1100 + piezas.length);
        const [x, y] = p;
        for (let k = 0; k < 3; k++) L.cilindro('mancha2', x + (r() - 0.5) * 0.4, y + (r() - 0.5) * 0.35, base + 0.006 + k * 0.001, base + 0.009 + k * 0.001, 0.12 + r() * 0.2, { segs: 14 });
        meter(L, 2, { tipo: 'mancha' });
      }
    }
    // nivel 3: la ruina del suelo: agujeros con tablas levantadas, charcos verdes y montones de escombros
    {
      const n = Math.max(2, Math.round(area / 4.2));
      for (let i = 0; i < n; i++) {
        const p = sitio(x0, y0, x1, y1, 0.25);
        if (!p) continue;
        const L = new Lote(estilo, 1300 + piezas.length);
        const [x, y] = p;
        const tipo = i % 3;
        if (tipo === 0) {
          // agujero en el suelo y tablas o baldosas levantadas alrededor
          for (let k = 0; k < 3; k++) L.cilindro('agujero', x + (r() - 0.5) * 0.35, y + (r() - 0.5) * 0.3, base + 0.004, base + 0.008, 0.18 + r() * 0.2, { segs: 9 });
          const key = sueloEn(x, y);
          for (let k = 0; k < 4; k++) {
            const a = r() * Math.PI * 2, d = 0.35 + r() * 0.2;
            L.cajaCentro(key, x + Math.cos(a) * d, y + Math.sin(a) * d, base + 0.02, 0.42 + r() * 0.2, 0.14 + r() * 0.08, 0.04, a, { redondeo: 0.005, inclina: 0.35 + r() * 0.35 });
          }
        } else if (tipo === 1) {
          // charco verde que apesta
          for (let k = 0; k < 3; k++) L.cilindro('toxico', x + (r() - 0.5) * 0.5, y + (r() - 0.5) * 0.4, base + 0.01 + k * 0.002, base + 0.022 + k * 0.002, 0.2 + r() * 0.28, { segs: 16 });
          L.esfera('toxico', x + 0.1, y - 0.05, base + 0.03, 0.06, { detalle: 0 });
          L.esfera('toxico', x - 0.15, y + 0.1, base + 0.025, 0.045, { detalle: 0 });
          focos.push([x, y, base, 3, 'charco']);
        } else {
          for (let k = 0; k < 9; k++) {
            const s = 0.1 + r() * 0.2;
            L.cajaCentro(k % 2 ? 'escombro' : 'piedra', x + (r() - 0.5) * 0.7, y + (r() - 0.5) * 0.6, base + (k > 5 ? 0.08 : 0), s, s * (0.7 + r() * 0.6), s * 0.8, r() * Math.PI, { redondeo: 0.01, inclina: (r() - 0.5) * 0.8 });
          }
        }
        meter(L, 3, { tipo: 'ruina' });
        focos.push([x, y, base, 3]);
      }
    }
    // nivel 3: ratas que van y vienen
    if (area > 5) {
      for (let i = 0; i < (area > 14 ? 2 : 1); i++) {
        const a = sitio(x0, y0, x1, y1, 0.2);
        const b = a && sitio(Math.max(x0, a[0] - 2.2), Math.max(y0, a[1] - 2.2), Math.min(x1, a[0] + 2.2), Math.min(y1, a[1] + 2.2), 0.2);
        if (!a || !b) continue;
        const L = new Lote(estilo, 1700 + piezas.length);
        const ox = CX, oy = CZ;
        L.esfera('rata', ox, oy, 0.085, 0.085, { escala: [1.75, 0.9, 1.05], detalle: 1 });
        L.esfera('rata', ox + 0.15, oy, 0.095, 0.055, { escala: [1.35, 1, 1], detalle: 1 });
        L.esfera('rata_cola', ox + 0.135, oy - 0.04, 0.15, 0.024, { detalle: 0 });
        L.esfera('rata_cola', ox + 0.135, oy + 0.04, 0.15, 0.024, { detalle: 0 });
        L.esfera('negro', ox + 0.2, oy - 0.022, 0.11, 0.011, { detalle: 0 });
        L.esfera('negro', ox + 0.2, oy + 0.022, 0.11, 0.011, { detalle: 0 });
        L.barra('rata_cola', ox - 0.13, oy, ox - 0.38, oy + 0.06, 0.035, 0.012, { segs: 5 });
        const g = L.mallas(mats, { sinBordes: true });
        g.scale.setScalar(1.35);
        g.userData = { nivel: 3, tipo: 'rata', a: [a[0] - CX, a[1] - CZ], b: [b[0] - CX, b[1] - CZ], base, vel: 0.9 + r() * 0.8, fase: r() * 6.28 };
        g.position.set(a[0] - CX, base, a[1] - CZ);
        piezas.push(g);
        animados.ratas.push(g);
      }
    }
  }

  // telarañas: en las esquinas de cada zona (arriba) y bajo los muebles (abajo)
  const matTela = mats.registrar(new THREE.SpriteMaterial({ map: texturaTelarana(), color: '#ffffff', transparent: true, opacity: 0.9, depthWrite: false }));
  const zonas = def.zonas || [[11, 0, 17.5, 9]];
  const baseZona = (x) => (def.nivel === 2 && x < 11 ? 0.45 : 0);
  zonas.forEach(([x0, y0, x1, y1], iz) => {
    if ((x1 - x0) * (y1 - y0) < 3) return;
    const esquinas = [[x0 + 0.35, y1 - 0.35, 2.05, 2], [x0 + 0.35, y0 + 0.35, 2.05, 2], [x1 - 0.35, y1 - 0.35, 2.05, 3], [x0 + 0.5, (y0 + y1) / 2, 0.45, 2],
      [x0 + 0.45, y1 - 0.5, 1.2, 3], [x1 - 0.5, y0 + 0.45, 0.5, 3]];
    esquinas.forEach(([x, y, h, nivel], k) => {
      const s = new THREE.Sprite(matTela);
      const tam = nivel === 3 ? 1.3 : 0.95;
      s.scale.setScalar(tam);
      s.position.set(x - CX, baseZona(x) + h, y - CZ);
      s.userData = { nivel };
      s.renderOrder = 3;
      piezas.push(s);
    });
  });
  // telarañas entre las patas y en las esquinas de los muebles grandes
  ocupado.forEach((o, k) => {
    if (o.t === 'cerrado' || o.t === 'pilar' || o.t === 'columna' || (o.x1 - o.x0) * (o.y1 - o.y0) < 0.5) return;
    const s = new THREE.Sprite(matTela);
    const nivel = k % 2 ? 3 : 2;
    const tam = nivel === 3 ? 0.85 : 0.6;
    s.scale.setScalar(tam);
    s.position.set((k % 3 ? o.x1 : o.x0) - CX, (o.base || 0) + 0.4, (k % 4 < 2 ? o.y1 : o.y0) - CZ);
    s.userData = { nivel };
    s.renderOrder = 3;
    piezas.push(s);
  });

  // moscas, peste y niebla
  const matMosca = mats.registrar(new THREE.MeshBasicMaterial({ color: '#15171c' }));
  const matPeste = mats.registrar(new THREE.SpriteMaterial({ map: texturaPeste(), color: '#ffffff', transparent: true, depthWrite: false }));
  const matNiebla = mats.registrar(new THREE.SpriteMaterial({ map: texturaNiebla(), color: '#ffffff', transparent: true, opacity: 0.55, depthWrite: false }));
  focos.forEach(([x, y, b, n], i) => {
    const nivel = Math.max(2, n);
    if (i % 2 === 1 && n < 2) return;
    for (let k = 0; k < 3; k++) {
      const m = new THREE.Mesh(GEO_MOSCA, matMosca);
      m.userData = { nivel, cx: x - CX, cy: b + 0.55 + r() * 0.25, cz: y - CZ, rad: 0.18 + r() * 0.2, vel: 4 + r() * 4, fase: r() * 6.28 };
      piezas.push(m);
      animados.moscas.push(m);
    }
    for (let k = 0; k < 2; k++) {
      const s = new THREE.Sprite(matPeste);
      s.scale.setScalar(n >= 3 ? 0.6 : 0.42);
      s.userData = { nivel, cx: x - CX + (k ? 0.18 : -0.12), cz: y - CZ, b: b + 0.3, fase: r() + k * 0.5 };
      piezas.push(s);
      animados.peste.push(s);
    }
  });
  for (const [x0, y0, x1, y1, base] of def.suciedad) {
    const n = Math.max(2, Math.round(((x1 - x0) * (y1 - y0)) / 5));
    for (let i = 0; i < n; i++) {
      const s = new THREE.Sprite(matNiebla);
      const tam = 1.6 + r() * 1.2;
      s.scale.set(tam, tam * 0.5, 1);
      s.position.set(x0 + r() * (x1 - x0) - CX, base + 0.25, y0 + r() * (y1 - y0) - CZ);
      s.userData = { nivel: 3, tam, fase: r() * 6.28, sube: 0 };
      piezas.push(s);
      animados.niebla.push(s);
    }
  }
  // nubes verdes que suben de los charcos
  for (const [x, y, b, n, tipo] of focos) {
    if (tipo !== 'charco') continue;
    for (let k = 0; k < 3; k++) {
      const s = new THREE.Sprite(matNiebla);
      const tam = 0.9 + r() * 0.6;
      s.scale.set(tam, tam, 1);
      s.position.set(x - CX, b + 0.3, y - CZ);
      s.userData = { nivel: 3, tam, fase: k / 3 + r() * 0.2, sube: 1.6, cx: x - CX, cz: y - CZ, b };
      piezas.push(s);
      animados.niebla.push(s);
    }
  }
  return { piezas, animados };
}

// Moho en las paredes de atrás (2 semanas o más): manchas que suben desde el suelo por la cara de dentro
export function construirMohoParedes(def, estilo, mats, muros) {
  const r = azar(313 + def.nivel * 7);
  const lotes = { n: new Lote(estilo, 1), s: new Lote(estilo, 2), e: new Lote(estilo, 3), w: new Lote(estilo, 4) };
  for (const m of def.muros) {
    if (!lotes[m.lado] || m.diagonal) continue;
    const horiz = m.y0 === m.y1;
    const a = horiz ? Math.min(m.x0, m.x1) : Math.min(m.y0, m.y1);
    const b = horiz ? Math.max(m.x0, m.x1) : Math.max(m.y0, m.y1);
    const largo = b - a;
    if (largo < 1) continue;
    const t = m.material === 'piedra' ? 0.34 : 0.24;
    const dentro = { n: 1, s: -1, e: -1, w: 1 }[m.lado];
    const cara = (horiz ? m.y0 : m.x0) + dentro * (t / 2 + 0.004);
    const base = m.base || 0;
    const enHueco = (u) => m.huecos.some((h) => u > h.desde - 0.35 && u < h.hasta + 0.35);
    const n = Math.max(1, Math.round(largo / 2.2));
    for (let i = 0; i < n; i++) {
      let u = null;
      for (let k = 0; k < 14 && u === null; k++) { const q = a + 0.4 + r() * (largo - 0.8); if (!enHueco(q)) u = q; }
      if (u === null) continue;
      // manchas a topos: más juntas y grandes abajo, sueltas y pequeñas según suben
      const alto = 1.0 + r() * 0.8;
      for (let k = 0; k < 16; k++) {
        const q = k / 15;
        const zz = 0.04 + q * alto * (0.5 + r() * 0.5);
        const rad = (0.24 - q * 0.15) * (0.6 + r() * 0.8);
        const du = (r() - 0.5) * (0.5 + q * 0.7);
        const [px, py] = horiz ? [u + du, cara] : [cara, u + du];
        const key = k % 4 === 3 ? 'mugre' : k % 4 === 1 ? 'moho' : 'moho_pared';
        lotes[m.lado].esfera(key, px, py, base + zz, rad, { escala: horiz ? [1, 0.8, 0.05] : [0.05, 0.8, 1], detalle: 1 });
      }
    }
  }
  const grupos = [];
  for (const l of ['n', 's', 'e', 'w']) {
    if (!lotes[l].grupos.size) continue;
    const g = lotes[l].mallas(mats, { sinBordes: true });
    g.userData = { nivel: 2 };
    muros[l].alto.add(g);
    grupos.push(g);
  }
  return grupos;
}

// Brillos cuando está limpio, más cuanto mejor nota; y destellos en las ventanas si queda reluciente
export function construirBrillos(def, estilo, mats, muros) {
  const r = azar(900 + def.nivel);
  const grupo = new THREE.Group();
  const color = estilo.id === 'maqueta' ? '#f0b43a' : '#ffd23f';
  const mat = mats.registrar(new THREE.SpriteMaterial({ map: texturaBrillo(), color, transparent: true, depthWrite: false }));
  const sprites = [];
  for (const [x0, y0, x1, y1, base] of def.suciedad) {
    const area = (x1 - x0) * (y1 - y0);
    const n = Math.max(2, Math.round(area / 2.2));
    for (const [nivel, cuantos, grande] of [[1, n, 0], [2, n, 0.1], [3, n * 2, 0.25]]) {
      for (let i = 0; i < cuantos; i++) {
        const s = new THREE.Sprite(mat);
        const tam = 0.28 + r() * 0.3 + grande;
        s.position.set(x0 + r() * (x1 - x0) - CX, base + 0.3 + r() * 1.6, y0 + r() * (y1 - y0) - CZ);
        s.scale.setScalar(tam);
        s.userData = { tam, fase: r() * Math.PI * 2, vel: 1.5 + r() * 2, nivel };
        grupo.add(s);
        sprites.push(s);
      }
    }
  }
  // destellos grandes en los cristales (dentro de cada pared alta)
  const matDestello = mats.registrar(new THREE.SpriteMaterial({ map: texturaBrillo(), color: '#ffffff', transparent: true, depthWrite: false }));
  for (const m of def.muros) {
    if (!['n', 's', 'e', 'w'].includes(m.lado) || m.diagonal) continue;
    for (const h of m.huecos) {
      if (h.tipo !== 'ventana' && h.tipo !== 'ventanal') continue;
      const u = (h.desde + h.hasta) / 2;
      const horiz = m.y0 === m.y1;
      const dentro = { n: 0.2, s: -0.2, e: -0.2, w: 0.2 }[m.lado];
      const [x, y] = horiz ? [u, m.y0 + dentro] : [m.x0 + dentro, u];
      for (const off of [-0.25, 0.3]) {
        const s = new THREE.Sprite(matDestello);
        const tam = 0.75;
        s.position.set((horiz ? x + off : x) - CX, (m.base || 0) + 1.45 + off * 0.6, (horiz ? y : y + off) - CZ);
        s.scale.setScalar(tam);
        s.userData = { tam, fase: r() * 6.28, vel: 2.5 + r() * 1.5, nivel: 3 };
        muros[m.lado].alto.add(s);
        sprites.push(s);
      }
    }
  }
  return { grupo, sprites };
}
