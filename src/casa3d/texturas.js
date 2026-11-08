import * as THREE from 'three';

const cache = new Map();

function lienzo(clave, n, dibujar) {
  if (cache.has(clave)) return cache.get(clave);
  const c = document.createElement('canvas');
  c.width = c.height = n;
  const g = c.getContext('2d');
  dibujar(g, n);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  cache.set(clave, t);
  return t;
}

const suave = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// Sombra blanda con forma de rectángulo redondeado (para muebles)
export function texturaSombra() {
  return lienzo('sombra', 64, (g, n) => {
    const img = g.createImageData(n, n);
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const u = Math.abs(((i + 0.5) / n) * 2 - 1);
        const v = Math.abs(((j + 0.5) / n) * 2 - 1);
        const d = Math.pow(Math.pow(u, 5) + Math.pow(v, 5), 0.2);
        const a = 1 - suave(0.45, 1.0, d);
        const k = (j * n + i) * 4;
        img.data[k] = 0; img.data[k + 1] = 0; img.data[k + 2] = 0; img.data[k + 3] = Math.round(255 * a);
      }
    }
    g.putImageData(img, 0, 0);
  });
}

// Sombra redonda (muñecos, plantas)
export function texturaCirculo() {
  return lienzo('circulo', 64, (g, n) => {
    const r = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
    r.addColorStop(0, 'rgba(0,0,0,1)');
    r.addColorStop(0.55, 'rgba(0,0,0,0.6)');
    r.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = r;
    g.fillRect(0, 0, n, n);
  });
}

// Destello de cuatro puntas para lo que está limpio
export function texturaBrillo() {
  return lienzo('brillo', 64, (g, n) => {
    const c = n / 2;
    const halo = g.createRadialGradient(c, c, 0, c, c, c);
    halo.addColorStop(0, 'rgba(255,255,255,0.95)');
    halo.addColorStop(0.25, 'rgba(255,250,220,0.35)');
    halo.addColorStop(1, 'rgba(255,250,220,0)');
    g.fillStyle = halo;
    g.fillRect(0, 0, n, n);
    g.fillStyle = 'rgba(255,255,255,1)';
    g.beginPath();
    const L = c * 0.95, w = c * 0.12;
    g.moveTo(c, c - L); g.quadraticCurveTo(c + w, c - w, c + L, c); g.quadraticCurveTo(c + w, c + w, c, c + L);
    g.quadraticCurveTo(c - w, c + w, c - L, c); g.quadraticCurveTo(c - w, c - w, c, c - L);
    g.fill();
  });
}

// Halo para el piso de quien mira
export function texturaHalo() {
  return lienzo('halo', 128, (g, n) => {
    const img = g.createImageData(n, n);
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const u = Math.abs(((i + 0.5) / n) * 2 - 1);
        const v = Math.abs(((j + 0.5) / n) * 2 - 1);
        const d = Math.pow(Math.pow(u, 6) + Math.pow(v, 6), 1 / 6);
        const a = suave(0.55, 0.8, d) * (1 - suave(0.8, 1.0, d));
        const k = (j * n + i) * 4;
        img.data[k] = 255; img.data[k + 1] = 255; img.data[k + 2] = 255; img.data[k + 3] = Math.round(255 * a);
      }
    }
    g.putImageData(img, 0, 0);
  });
}

// Halo que sigue la forma de la planta (o de sus zonas de limpieza)
export function texturaHaloZonas(rects, [bx0, by0, bx1, by1]) {
  const clave = 'haloZ:' + JSON.stringify(rects) + [bx0, by0, bx1, by1].join(',');
  if (cache.has(clave)) return cache.get(clave);
  const esc = Math.min(28, 1024 / Math.max(bx1 - bx0, by1 - by0));
  const W = Math.ceil((bx1 - bx0) * esc), H = Math.ceil((by1 - by0) * esc);
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  // cada capa rellena la unión de todas las zonas de una vez, para que no se sumen donde se tocan
  const capa = (e) => {
    g.beginPath();
    for (const [x0, y0, x1, y1] of rects) {
      const x = (x0 - e - bx0) * esc, y = (y0 - e - by0) * esc, w = (x1 - x0 + 2 * e) * esc, h = (y1 - y0 + 2 * e) * esc;
      const r = Math.max(0, e * esc);
      if (g.roundRect && r > 0) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h);
    }
    g.fill('nonzero');
  };
  g.fillStyle = '#ffffff';
  const N = 12;
  for (let k = N; k >= 1; k--) { g.globalAlpha = 0.1; capa(1.0 * k / N); }
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'destination-out';
  capa(-0.02);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  cache.set(clave, t);
  return t;
}

// Grumos suaves para la plastilina (se usa como relieve)
export function texturaRuido() {
  const t = lienzo('ruido', 256, (g, n) => {
    g.fillStyle = '#808080';
    g.fillRect(0, 0, n, n);
    let s = 12345;
    const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 260; i++) {
      const x = r() * n, y = r() * n, rad = 6 + r() * 26, v = Math.round(90 + r() * 80);
      const gr = g.createRadialGradient(x, y, 0, x, y, rad);
      gr.addColorStop(0, `rgba(${v},${v},${v},0.55)`);
      gr.addColorStop(1, `rgba(${v},${v},${v},0)`);
      g.fillStyle = gr;
      for (const dx of [-n, 0, n]) for (const dy of [-n, 0, n]) { g.save(); g.translate(dx, dy); g.fillRect(x - rad, y - rad, rad * 2, rad * 2); g.restore(); }
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(2.5, 2.5);
  return t;
}

// Grano de papel y cartón (se multiplica con el color)
export function texturaGrano() {
  const t = lienzo('grano', 256, (g, n) => {
    const img = g.createImageData(n, n);
    let s = 777;
    const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let k = 0; k < n * n; k++) {
      const v = 205 + Math.round(r() * 50);
      img.data[k * 4] = v; img.data[k * 4 + 1] = v; img.data[k * 4 + 2] = v - 4; img.data[k * 4 + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    g.strokeStyle = 'rgba(140,105,65,0.28)';
    g.lineWidth = 1;
    for (let i = 0; i < 140; i++) {
      const x = r() * n, y = r() * n, l = 6 + r() * 18, a = r() * Math.PI;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(2, 2);
  return t;
}

// Escalones de luz para el sombreado por bandas (estilo pastel)
const escalones = new Map();
export function texturaEscalones(n = 3) {
  if (escalones.has(n)) return escalones.get(n);
  const datos = new Uint8Array(n);
  for (let i = 0; i < n; i++) datos[i] = Math.round(110 + (145 * i) / (n - 1));
  const t = new THREE.DataTexture(datos, n, 1, THREE.RedFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  escalones.set(n, t);
  return t;
}

// ---------- efectos del juego ----------

// Telaraña
export function texturaTelarana() {
  return lienzo('telarana', 128, (g, n) => {
    const c = n / 2;
    g.strokeStyle = 'rgba(255,255,255,0.95)';
    g.lineWidth = 1.6;
    const rad = 10;
    for (let k = 0; k < rad; k++) {
      const a = (k / rad) * Math.PI * 2;
      g.beginPath(); g.moveTo(c, c); g.lineTo(c + Math.cos(a) * c * 0.98, c + Math.sin(a) * c * 0.98); g.stroke();
    }
    g.lineWidth = 1.2;
    for (let r = 8; r < c; r += 8) {
      g.beginPath();
      for (let k = 0; k <= rad; k++) {
        const a = (k / rad) * Math.PI * 2;
        const rr = r * (0.92 + 0.08 * Math.sin(k * 2.3));
        const x = c + Math.cos(a) * rr, y = c + Math.sin(a) * rr;
        if (k === 0) g.moveTo(x, y); else g.quadraticCurveTo(c + Math.cos(a - 0.3) * rr * 0.86, c + Math.sin(a - 0.3) * rr * 0.86, x, y);
      }
      g.stroke();
    }
  });
}

// Línea ondulada de peste
export function texturaPeste() {
  return lienzo('peste', 64, (g, n) => {
    g.strokeStyle = 'rgba(120,190,40,1)';
    g.lineWidth = 5;
    g.lineCap = 'round';
    for (const dx of [-12, 12]) {
      g.beginPath();
      for (let y = n - 6; y >= 6; y -= 2) {
        const x = n / 2 + dx + Math.sin(y / 6) * 6;
        if (y === n - 6) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.stroke();
    }
  });
}

// Nubarrón gris
export function texturaNube() {
  return lienzo('nube', 128, (g, n) => {
    g.fillStyle = 'rgba(110,116,128,0.95)';
    for (const [x, y, r] of [[38, 62, 24], [62, 50, 30], [90, 62, 24], [64, 70, 26], [44, 74, 18], [86, 74, 18]]) {
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    }
    g.strokeStyle = 'rgba(110,170,235,0.95)';
    g.lineWidth = 4;
    g.lineCap = 'round';
    for (const x of [40, 58, 76, 94]) { g.beginPath(); g.moveTo(x, 98); g.lineTo(x - 5, 116); g.stroke(); }
  });
}

// Niebla verde de peste (desastre)
export function texturaNiebla() {
  return lienzo('niebla', 64, (g, n) => {
    const r = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
    r.addColorStop(0, 'rgba(140,190,60,0.85)');
    r.addColorStop(0.6, 'rgba(120,170,50,0.35)');
    r.addColorStop(1, 'rgba(120,170,50,0)');
    g.fillStyle = r;
    g.fillRect(0, 0, n, n);
  });
}

// Cartel de «Castigado»
export function texturaCartel() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#fffaf0';
  g.fillRect(0, 0, 256, 128);
  g.strokeStyle = '#c0281c';
  g.lineWidth = 10;
  g.strokeRect(6, 6, 244, 116);
  g.fillStyle = '#c0281c';
  g.font = '900 46px "Archivo", "Arial Black", Arial, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('CASTIGADO', 128, 66);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
