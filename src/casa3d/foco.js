// Recorta una planta a sus zonas de limpieza: suelos, muros, muebles, escaleras y suciedad.
const EPS = 0.03;

function dentro(x, y, zonas, m = 0) {
  return zonas.some(([x0, y0, x1, y1]) => x > x0 - m && x < x1 + m && y > y0 - m && y < y1 + m);
}

function recortar(r, zonas) {
  const out = [];
  for (const [x0, y0, x1, y1] of zonas) {
    const a0 = Math.max(r.x0, x0), a1 = Math.min(r.x1, x1);
    const b0 = Math.max(r.y0, y0), b1 = Math.min(r.y1, y1);
    if (a1 - a0 > 0.05 && b1 - b0 > 0.05) out.push({ ...r, x0: a0, y0: b0, x1: a1, y1: b1 });
  }
  return out;
}

// Parte un muro por las zonas y decide en cada trozo hacia dónde da (n, s, e, w) o si queda dentro (int)
function recortarMuro(m, zonas) {
  const horiz = Math.abs(m.y0 - m.y1) < 1e-6;
  const fijo = horiz ? m.y0 : m.x0;
  const a = horiz ? Math.min(m.x0, m.x1) : Math.min(m.y0, m.y1);
  const b = horiz ? Math.max(m.x0, m.x1) : Math.max(m.y0, m.y1);
  const cortes = new Set([a, b]);
  for (const [x0, y0, x1, y1] of zonas) {
    for (const v of horiz ? [x0, x1] : [y0, y1]) if (v > a + EPS && v < b - EPS) cortes.add(v);
  }
  const lista = [...cortes].sort((p, q) => p - q);
  const trozos = [];
  for (let i = 0; i < lista.length - 1; i++) {
    const u0 = lista[i], u1 = lista[i + 1];
    if (u1 - u0 < 0.05) continue;
    const mid = (u0 + u1) / 2;
    const [px, py] = horiz ? [mid, fijo] : [fijo, mid];
    const menos = horiz ? dentro(px, py - 0.25, zonas) : dentro(px - 0.25, py, zonas);
    const mas = horiz ? dentro(px, py + 0.25, zonas) : dentro(px + 0.25, py, zonas);
    if (!menos && !mas) continue;
    const lado = menos && mas ? 'int' : horiz ? (menos ? 's' : 'n') : (menos ? 'e' : 'w');
    const ult = trozos[trozos.length - 1];
    if (ult && ult.lado === lado && Math.abs(ult.u1 - u0) < 1e-6) ult.u1 = u1;
    else trozos.push({ u0, u1, lado });
  }
  return trozos.map(({ u0, u1, lado }) => ({
    ...m,
    x0: horiz ? u0 : m.x0, x1: horiz ? u1 : m.x1,
    y0: horiz ? m.y0 : u0, y1: horiz ? m.y1 : u1,
    lado,
    huecos: m.huecos
      .filter((h) => h.hasta > u0 + EPS && h.desde < u1 - EPS)
      .map((h) => ({ ...h, desde: Math.max(h.desde, u0), hasta: Math.min(h.hasta, u1) })),
  }));
}

const centro = (c) => [(c.x0 + c.x1) / 2, (c.y0 + c.y1) / 2];

export function enfocar(def, foco) {
  const zonas = foco.zonas;
  const cerrados = (foco.cerrados || []).map(([x0, y0, x1, y1, base, nombre]) => ({ t: 'cerrado', x0, y0, x1, y1, base: base || 0, nombre }));
  const enCerrado = (x, y) => cerrados.some((c) => x > c.x0 && x < c.x1 && y > c.y0 && y < c.y1);
  const sirve = (x, y) => dentro(x, y, zonas, -0.01) && !enCerrado(x, y);

  const suelos = def.suelos.filter((s) => !s.fuera).flatMap((s) => recortar(s, zonas));
  const muros = [...def.muros, ...(foco.muros || [])].flatMap((m) => recortarMuro(m, zonas));
  const cosas = [...def.cosas.filter((c) => sirve(...centro(c))), ...cerrados];
  const escaleras = def.escaleras.filter((e) => sirve(...centro(e)));
  const barandas = def.barandas.filter((b) => b.puntos.every(([x, y]) => dentro(x, y, zonas, 0.1)));
  const suciedad = def.suciedad.flatMap(([x0, y0, x1, y1, base]) =>
    recortar({ x0, y0, x1, y1 }, zonas).map((r) => [r.x0, r.y0, r.x1, r.y1, base]));
  const xs = [Math.min(...zonas.map((z) => z[0])), Math.max(...zonas.map((z) => z[2]))];
  const ys = [Math.min(...zonas.map((z) => z[1])), Math.max(...zonas.map((z) => z[3]))];
  return { ...def, suelos, muros, cosas, escaleras, barandas, suciedad, foco: true, zonas, huella: { xs, ys } };
}
