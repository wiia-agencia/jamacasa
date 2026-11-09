import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { texturaRuido, texturaGrano, texturaEscalones } from './texturas.js';

// Centro de la casa en el plano, para que la torre quede centrada en el origen
export const CX = 9.0;
export const CZ = 4.0;

export function azar(semilla) {
  let s = semilla >>> 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const m4 = new THREE.Matrix4();
const q = new THREE.Quaternion();
const eu = new THREE.Euler();
const pos = new THREE.Vector3();
const esc = new THREE.Vector3();

// Materiales de una planta: cada planta tiene los suyos para poder apagarla sin tocar las demás
export class Materiales {
  constructor(estilo) {
    this.e = estilo;
    this.mapa = new Map();
    this.todos = [];
  }

  hex(key) {
    if (key === 'mancha') return '#5a4636';
    if (key === 'moho') return '#4f7a2a';
    if (key === 'mugre') return '#3d3020';
    if (key === 'grieta') return '#2e2620';
    if (key === 'escombro') return '#9a9387';
    if (key === 'moho_pared') return '#3e5a24';
    if (key === 'mancha2') return '#7d6a2a';
    if (key === 'toxico') return '#86d43a';
    if (key === 'rata') return '#77737a';
    if (key === 'rata_cola') return '#d9a0a0';
    if (key === 'tabla') return '#8c6b45';
    if (key === 'seca') return '#8a7a45';
    if (key === 'hollin') return '#2b2724';
    if (key === 'agujero') return '#1e1b18';
    if (key === 'relleno') return '#f1ece0';
    return key.startsWith('#') ? key : this.e.paleta[key] || '#ff00ff';
  }

  get(key) {
    if (this.mapa.has(key)) return this.mapa.get(key);
    const e = this.e;
    const comun = { color: this.hex(key), vertexColors: !!e.variacion };
    const m = e.toon
      ? new THREE.MeshToonMaterial({ ...comun, gradientMap: texturaEscalones(e.toon) })
      : new THREE.MeshStandardMaterial({ ...comun, roughness: e.rugosidad, metalness: 0, flatShading: e.plano });
    const liso = ['cristal', 'coche_cristal', 'agua', 'fuego', 'mancha', 'mancha2', 'moho', 'mugre', 'toxico', 'agujero'].includes(key);
    if (e.bump && !liso) { m.bumpMap = texturaRuido(); m.bumpScale = e.bump; }
    if (e.grano && !liso) m.map = texturaGrano();
    if (key === 'cristal' || key === 'coche_cristal') { m.transparent = true; m.opacity = 0.5; m.roughness = 0.2; m.depthWrite = false; }
    if (key === 'agua') { m.transparent = true; m.opacity = 0.75; m.roughness = 0.2; }
    if (key === 'mancha') { m.transparent = true; m.opacity = 0.3; m.depthWrite = false; }
    if (key === 'moho') { m.transparent = true; m.opacity = 0.62; m.depthWrite = false; }
    if (key === 'mugre') { m.transparent = true; m.opacity = 0.42; m.depthWrite = false; }
    if (key === 'mancha2') { m.transparent = true; m.opacity = 0.5; m.depthWrite = false; }
    if (key === 'toxico') { m.transparent = true; m.opacity = 0.88; m.emissive = new THREE.Color('#3f7a12'); m.emissiveIntensity = 0.6; }
    if (key === 'fuego') { m.emissive = new THREE.Color(this.hex(key)); m.emissiveIntensity = 1.1; }
    if (key === 'metal') { m.metalness = 0.25; m.roughness = 0.55; }
    this.registrar(m);
    this.mapa.set(key, m);
    return m;
  }

  registrar(m) {
    m.userData.base = {
      color: m.color ? m.color.clone() : null,
      opacity: m.opacity, transparent: m.transparent, depthWrite: m.depthWrite,
      emissive: m.emissive ? m.emissive.clone() : null,
    };
    this.todos.push(m);
    return m;
  }
}

// Junta piezas por material para pintar cada planta con pocas llamadas
export class Lote {
  // proporcion: cuánto se puede redondear una pieza respecto a su lado más corto (los muebles, poco, para que no parezcan pastillas)
  constructor(estilo, semilla = 7, opciones = {}) {
    this.e = estilo;
    this.grupos = new Map();
    this.r = azar(semilla);
    this.proporcion = opciones.proporcion ?? 0.45;
  }

  add(key, geo) {
    if (geo.index) geo = geo.toNonIndexed();
    for (const k of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv'].includes(k)) geo.deleteAttribute(k);
    if (!geo.attributes.normal) geo.computeVertexNormals();
    if (!geo.attributes.uv) geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 2), 2));
    if (this.e.variacion) {
      const n = geo.attributes.position.count;
      const f = 1 + (this.r() * 2 - 1) * this.e.variacion;
      geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3).fill(f), 3));
    }
    let l = this.grupos.get(key);
    if (!l) { l = []; this.grupos.set(key, l); }
    l.push(geo);
  }

  // Caja entre dos esquinas. Plano: x este, y sur; z es la altura.
  caja(key, x0, y0, z0, x1, y1, z1, o = {}) {
    let a0 = Math.min(x0, x1), a1 = Math.max(x0, x1);
    let b0 = Math.min(y0, y1), b1 = Math.max(y0, y1);
    let c0 = Math.min(z0, z1), c1 = Math.max(z0, z1);
    const g = this.e.voxel;
    if (g && !o.libre) {
      const gz = g / 2;
      const ra = (v) => Math.round(v / g) * g;
      a0 = ra(a0); a1 = Math.max(a0 + g, ra(a1));
      b0 = ra(b0); b1 = Math.max(b0 + g, ra(b1));
      c0 = Math.round(c0 / gz) * gz; c1 = Math.max(c0 + gz, Math.round(c1 / gz) * gz);
    }
    const sx = a1 - a0, sy = c1 - c0, sz = b1 - b0;
    if (sx < 0.002 || sy < 0.002 || sz < 0.002) return;
    const r = o.redondeo ?? this.e.redondeo;
    const rr = Math.min(r, this.proporcion * Math.min(sx, sy, sz));
    const geo = rr > 0.006 ? new RoundedBoxGeometry(sx, sy, sz, 2, rr) : new THREE.BoxGeometry(sx, sy, sz);
    eu.set(0, o.giro || 0, 0);
    q.setFromEuler(eu);
    m4.compose(pos.set((a0 + a1) / 2 - CX, (c0 + c1) / 2, (b0 + b1) / 2 - CZ), q, esc.set(1, 1, 1));
    geo.applyMatrix4(m4);
    this.add(key, geo);
  }

  // Caja centrada con giro libre (para cosas tiradas por el suelo)
  cajaCentro(key, cx, cy, z0, sx, sy, sz, giro = 0, o = {}) {
    if (this.e.voxel) {
      const g = this.e.voxel;
      return this.caja(key, cx - Math.max(sx, g) / 2, cy - Math.max(sy, g) / 2, z0, cx + Math.max(sx, g) / 2, cy + Math.max(sy, g) / 2, z0 + Math.max(sz, g / 2), o);
    }
    const r = o.redondeo ?? this.e.redondeo;
    const rr = Math.min(r, this.proporcion * Math.min(sx, sy, sz));
    const geo = rr > 0.006 ? new RoundedBoxGeometry(sx, sz, sy, 2, rr) : new THREE.BoxGeometry(sx, sz, sy);
    eu.set(o.inclina || 0, giro, o.rueda || 0);
    q.setFromEuler(eu);
    m4.compose(pos.set(cx - CX, z0 + sz / 2, cy - CZ), q, esc.set(1, 1, 1));
    geo.applyMatrix4(m4);
    this.add(key, geo);
  }

  cilindro(key, cx, cy, z0, z1, r, o = {}) {
    if (this.e.voxel) return this.caja(key, cx - r, cy - r, z0, cx + r, cy + r, z1, o);
    const segs = this.e.plano ? (o.segs ?? 7) : (o.segs ?? 20);
    const geo = new THREE.CylinderGeometry(o.rArriba ?? r, r, z1 - z0, segs);
    m4.compose(pos.set(cx - CX, (z0 + z1) / 2, cy - CZ), q.identity(), esc.set(1, 1, 1));
    geo.applyMatrix4(m4);
    this.add(key, geo);
  }

  // Cilindro tumbado entre (ax, ay) y (bx, by) a la altura z
  barra(key, ax, ay, bx, by, z, r, o = {}) {
    if (this.e.voxel) return this.caja(key, Math.min(ax, bx) - r, Math.min(ay, by) - r, z - r, Math.max(ax, bx) + r, Math.max(ay, by) + r, z + r, o);
    const segs = this.e.plano ? (o.segs ?? 6) : (o.segs ?? 14);
    const largo = Math.hypot(bx - ax, by - ay);
    if (largo < 0.001) return;
    const geo = new THREE.CylinderGeometry(r, r, largo, segs);
    const dir = new THREE.Vector3(bx - ax, 0, by - ay).normalize();
    q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    m4.compose(pos.set((ax + bx) / 2 - CX, z, (ay + by) / 2 - CZ), q, esc.set(1, 1, 1));
    geo.applyMatrix4(m4);
    this.add(key, geo);
  }

  // Tubo recto entre dos puntos del espacio [x, y, z] (x este, y sur, z altura): barandillas de escalera
  tubo(key, a, b, r, o = {}) {
    if (this.e.voxel) return this.caja(key, Math.min(a[0], b[0]) - r, Math.min(a[1], b[1]) - r, Math.min(a[2], b[2]) - r, Math.max(a[0], b[0]) + r, Math.max(a[1], b[1]) + r, Math.max(a[2], b[2]) + r, o);
    const segs = this.e.plano ? (o.segs ?? 6) : (o.segs ?? 10);
    const dir = new THREE.Vector3(b[0] - a[0], b[2] - a[2], b[1] - a[1]);
    const largo = dir.length();
    if (largo < 0.001) return;
    const geo = new THREE.CylinderGeometry(r, r, largo, segs);
    q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    m4.compose(pos.set((a[0] + b[0]) / 2 - CX, (a[2] + b[2]) / 2, (a[1] + b[1]) / 2 - CZ), q, esc.set(1, 1, 1));
    geo.applyMatrix4(m4);
    this.add(key, geo);
  }

  esfera(key, cx, cy, cz, r, o = {}) {
    const [ex, ey, ez] = o.escala || [1, 1, 1];
    if (this.e.voxel) return this.caja(key, cx - r * ex, cy - r * ez, cz - r * ey, cx + r * ex, cy + r * ez, cz + r * ey, o);
    const geo = this.e.plano ? new THREE.IcosahedronGeometry(r, o.detalle ?? 0) : new THREE.SphereGeometry(r, 18, 12);
    m4.compose(pos.set(cx - CX, cz, cy - CZ), q.identity(), esc.set(ex, ey, ez));
    geo.applyMatrix4(m4);
    this.add(key, geo);
  }

  // Triángulos sueltos: lista de puntos [x, y, z] de plano, de tres en tres
  triangulos(key, puntos) {
    const arr = new Float32Array(puntos.length * 3);
    puntos.forEach(([x, y, z], i) => { arr[i * 3] = x - CX; arr[i * 3 + 1] = z; arr[i * 3 + 2] = y - CZ; });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    geo.computeVertexNormals();
    this.add(key, geo);
  }

  mallas(materiales, o = {}) {
    const grupo = new THREE.Group();
    for (const [key, lista] of this.grupos) {
      const geo = lista.length === 1 ? lista[0] : mergeGeometries(lista, false);
      if (!geo) continue;
      const mat = materiales.get(key);
      const malla = new THREE.Mesh(geo, mat);
      malla.userData.key = key;
      grupo.add(malla);
      if (this.e.bordes && !['cristal', 'coche_cristal', 'agua', 'fuego', 'cesped', 'tierra'].includes(key) && !o.sinBordes) {
        const lineas = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 28), materialBordes(this.e, materiales));
        grupo.add(lineas);
      }
    }
    return grupo;
  }
}

// Material de las líneas de la maqueta
export function materialBordes(estilo, materiales) {
  if (materiales.mapa.has('__bordes')) return materiales.mapa.get('__bordes');
  const m = new THREE.LineBasicMaterial({ color: estilo.colorBordes || '#777777', transparent: true, opacity: estilo.opacidadBordes ?? 0.55 });
  materiales.registrar(m);
  materiales.mapa.set('__bordes', m);
  return m;
}
