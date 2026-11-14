import * as THREE from 'three';
import { DIA_NIVEL, DIAS_DE_NIVEL, nivelDeDias } from './suciedad.js';
import { construirCasa, construirParte, construirRuina, liberar } from './casa.js';
import { crearMonigote } from './monigotes.js';
import { ESTILOS } from './estilos.js';
import { PERSONAS, PISOS, TURNOS, ESCENAS, ESTADOS, ALTURA, ORDEN_PERSONAS, PIEDRA_SUBE, GARAJE, VISTAS_JUEGO, CUARTOS, ponerTurnos } from './datos.js';
import { CX, CZ } from './geometria.js';

const GRIS = new THREE.Color('#8b8f98');
const SUCIO = new THREE.Color('#646034');
const PODRIDO = new THREE.Color('#4b5a2c');
const SIN_TINTE = ['fuego', 'toxico', 'cristal', 'coche_cristal', 'agua', '__bordes'];
const LADOS = { n: new THREE.Vector2(0, -1), s: new THREE.Vector2(0, 1), e: new THREE.Vector2(1, 0), w: new THREE.Vector2(-1, 0) };
const ROT = { n: Math.PI, s: 0, e: Math.PI / 2, w: -Math.PI / 2 };
const MANCHABLES = ['liso', 'interior', 'piedra', 'losa', 'madera', 'blanco'];

const INSIGNIAS = {
  rey: ['Rey del mes', 'oro'],
  racha: ['Racha ×6', 'oro'],
  mejora: ['↑ Mejorando', 'bien'],
  empeora: ['↓ Empeorando', 'mal'],
  castigado: ['Castigado', 'mal'],
  debe: ['Debe su piso', 'medio'],
};

// [estado, nivel, días sin limpiar] de un piso en la escena. Las escenas pueden dar los días (la app) o solo el nivel.
function estadoPiso(esc, piso) {
  const [estado, nivel = 0, dias, hecho] = esc.pisos[piso];
  if (estado !== 'sucio' && estado !== 'limpiando') return [estado, nivel, 0];
  const d = dias ?? DIAS_DE_NIVEL[Math.min(3, Math.max(0, nivel))] ?? 6;
  return [estado, estado === 'sucio' ? nivelDeDias(d) : 0, d, hecho];
}

// La casa viva: colores del cielo (arriba, abajo) de día, de noche, al amanecer y al atardecer
const CIELO = {
  dia: ['#d6ecf8', '#fbecd8'],
  noche: ['#0f1b31', '#26395e'],
  amanecer: ['#c7dcf3', '#ffd9b0'],
  atardecer: ['#7a7fbf', '#f6a77e'],
};
const mezclaColor = (a, b, k) => new THREE.Color(a).lerp(new THREE.Color(b), Math.min(1, Math.max(0, k)));
const suave = (t) => { const k = Math.min(1, Math.max(0, t)); return k * k * (3 - 2 * k); };

function etiquetaEstado(estado, nivel, corto) {
  if (estado === 'sucio') {
    if (nivel <= 0) return { nombre: 'Sin limpiar', tono: 'mal' };
    if (nivel === 1) return { nombre: corto ? '1 semana' : '1 semana sin limpiar', tono: 'mal' };
    if (nivel === 2) return { nombre: corto ? '2 semanas' : '2 semanas sin limpiar', tono: 'mal' };
    return { nombre: corto ? 'En ruinas' : '3 semanas: en ruinas', tono: 'mal' };
  }
  if (estado === 'limpio') {
    if (nivel >= 3) return { nombre: 'Reluciente', tono: 'oro' };
    if (nivel === 2) return { nombre: 'Muy limpio', tono: 'bien' };
    return { nombre: 'Limpio', tono: 'bien' };
  }
  return ESTADOS[estado];
}

// Vistas: «foco» = solo lo que se limpia · «despiece» = casa entera con las plantas separadas · «transparente» = casa entera montada
const modoDe = (vista) => (vista === 'foco' ? 'foco' : 'entera');

export function crearVisor(contenedor, opciones = {}) {
  // juego: la pantalla de Limpieza (la D): solo lo que se limpia de cada piso (como siempre: ni garaje ni
  // habitaciones), los pisos separados y los tres a la vista, igual para todos; el piso que miras (el tuyo o el de
  // la cara que toques) se ve entero y los otros, medio transparentes. Con el cajón abierto (setCerca), ese piso de
  // cerca; en «Mi parte» (setParte), solo tus cuartos. Los bocadillos los pone la app (setBurbujas) y la luz sigue
  // la hora de verdad (setLuz)
  const juego = !!opciones.juego;
  const st = {
    estilo: opciones.estilo || 'juguete',
    verComo: opciones.verComo || 'javi',
    escena: typeof opciones.escena === 'object' && opciones.escena ? '__vivo' : opciones.escena || opciones.momento || 'miercoles',
    vista: juego ? 'foco' : opciones.vista || 'foco',
    foco: null,
    cerca: false, // el cajón está abierto: el piso que miras, de cerca
    parte: null, // «Mi parte»: { cuartos: ['habitacion1', …], dias: { habitacion1: 3, … } }
    burbujas: [],
    luz: opciones.luz || null,
    margenes: { arriba: 80, abajo: 150 },
    abajo: null, // lo que tapa ahora el cajón (va poco a poco hacia margenes.abajo)
    extra: opciones.extra || null,
    visita: null,
    az: opciones.az ?? 0.38,
    el: opciones.el ?? 0.5,
    zoom: 1,
    pan: new THREE.Vector2(0, 0),
  };
  if (st.escena === '__vivo') {
    ESCENAS.__vivo = { aviso: () => ['', ''], personas: {}, rey: null, ...opciones.escena };
    if (opciones.escena.turnos) ponerTurnos(opciones.escena.turnos);
  }
  const HUECO = opciones.hueco ?? (juego ? 4.4 : 3.6);
  const reserva = opciones.reservaAbajo ?? 0;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: !!opciones.captura });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.className = 'c3-lienzo';
  contenedor.appendChild(renderer.domElement);
  const capa = document.createElement('div');
  capa.className = 'c3-capa';
  contenedor.appendChild(capa);

  const escena = new THREE.Scene();
  const camara = new THREE.OrthographicCamera(-10, 10, 10, -10, -300, 300);
  const hemi = new THREE.HemisphereLight('#ffffff', '#f0dcc2', 1.4);
  const sol = new THREE.DirectionalLight('#ffffff', 2);
  sol.position.set(9, 18, -13);
  const amb = new THREE.AmbientLight('#ffffff', 0.25);
  escena.add(hemi, sol, amb);

  let casa = null;
  let monigotes = {};
  // estilo píxel: se dibuja pequeño y se amplía sin suavizar
  let rt = null, escenaPixel = null, camPixel = null;
  function dibujar() {
    const px = ESTILOS[st.estilo].pixel;
    if (!px) { renderer.render(escena, camara); return; }
    const w = Math.max(32, Math.round(px)), h = Math.max(32, Math.round(px * alto / ancho));
    if (!rt) {
      rt = new THREE.WebGLRenderTarget(w, h, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, generateMipmaps: false });
      rt.texture.colorSpace = THREE.SRGBColorSpace;
      escenaPixel = new THREE.Scene();
      camPixel = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      escenaPixel.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ map: rt.texture, transparent: true, depthTest: false, depthWrite: false })));
    }
    if (rt.width !== w || rt.height !== h) rt.setSize(w, h);
    renderer.setRenderTarget(rt);
    renderer.setClearColor(0x000000, 0);
    renderer.clear();
    renderer.render(escena, camara);
    renderer.setRenderTarget(null);
    renderer.clear();
    renderer.render(escenaPixel, camPixel);
  }

  const posY = { '-1': 0, 0: 0, 1: 0, 2: 0, 3: 0 };   // altura actual de cada nivel (−1 = garaje, 3 = tejado)
  let ancho = 1, alto = 1;
  let anchoEtiquetas = 0;
  let etiquetas = [];
  let etiquetasPersona = {};
  let ultimoAz = null;
  const volver = document.createElement('button');
  volver.type = 'button';
  volver.className = 'c3-volver';
  volver.hidden = true;
  volver.addEventListener('click', () => visitar(null));

  const garajeVisible = () => !!(casa && casa.garaje && st.extra);
  const miNivel = () => PISOS[TURNOS[st.verComo]].nivel;
  const destacado = () => (st.visita ?? miNivel());

  // ---------- construcción ----------

  function objetivoY(nivel) {
    if (st.vista === 'transparente') return nivel * ALTURA;
    if (st.vista === 'foco' && nivel === 3) return 2 * (ALTURA + HUECO) + ALTURA + 1.1;
    return nivel * (ALTURA + HUECO) + (nivel === 3 ? 2.2 : 0);
  }

  function plantasConGaraje() {
    return casa.garaje ? [...casa.plantas, casa.garaje] : casa.plantas;
  }

  // el cuarto que miras en «Mi parte» (al tocarlo en «Tu parte»): un marco blando de tu color en su suelo
  let marco = null;
  function texturaMarco(w, h, color) {
    const esc = 64, W = Math.ceil(w * esc), H = Math.ceil(h * esc);
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const g = cv.getContext('2d');
    // por dentro de las paredes (que tapan el borde del cuarto): un velo, el marco de tu color y un filo blanco para que
    // se vea también en un suelo de tu mismo color
    const m = 0.32 * esc, r = 0.35 * esc;
    const borde = () => { g.beginPath(); if (g.roundRect) g.roundRect(m, m, W - 2 * m, H - 2 * m, r); else g.rect(m, m, W - 2 * m, H - 2 * m); };
    borde();
    g.globalAlpha = 0.18; g.fillStyle = color; g.fill();
    g.globalAlpha = 1;
    g.strokeStyle = color; g.lineWidth = 0.16 * esc;
    g.shadowColor = color; g.shadowBlur = 0.4 * esc;
    borde(); g.stroke(); g.stroke();
    g.shadowBlur = 0; g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 0.045 * esc;
    borde(); g.stroke();
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }
  function quitarMarco() {
    if (!marco) return;
    marco.parent?.remove(marco);
    marco.geometry.dispose(); marco.material.map?.dispose(); marco.material.dispose();
    marco = null;
  }
  function ponerMarco() {
    quitarMarco();
    const id = st.parte && st.parte.foco, c = id && CUARTOS[id];
    if (!juego || !casa || !casa.parte || !c || !st.parte.cuartos.includes(id)) return;
    const [x0, y0, x1, y1] = c.zona;
    marco = new THREE.Mesh(
      new THREE.PlaneGeometry(x1 - x0, y1 - y0),
      new THREE.MeshBasicMaterial({ map: texturaMarco(x1 - x0, y1 - y0, (PERSONAS[st.verComo] || {}).color || '#ffffff'), transparent: true, depthWrite: false }),
    );
    marco.rotation.x = -Math.PI / 2;
    marco.position.set((x0 + x1) / 2 - CX, (x0 < 11 ? PIEDRA_SUBE : 0) + 0.035, (y0 + y1) / 2 - CZ);
    marco.renderOrder = 2;
    casa.parte.grupo.add(marco);
  }

  // «Mi parte»: tus cuartos, que se construyen solo cuando hacen falta (y otra vez si cambian)
  function ponerParte() {
    quitarMarco();
    if (!casa) return;
    if (casa.parte) {
      for (const m of Object.values(monigotes)) if (m.raiz.parent === casa.parte.grupo) casa.parte.grupo.remove(m.raiz);
      escena.remove(casa.parte.grupo); liberar(casa.parte.grupo); casa.parte = null;
    }
    if (!juego || !st.parte) return;
    casa.parte = construirParte(ESTILOS[st.estilo], st.parte.cuartos);
    if (!casa.parte) return;
    casa.parte.escala = casa.parte.escalaObj = 1;
    escena.add(casa.parte.grupo);
    colocar(casa.parte);
    ponerMarco();
    ultimoAz = null; // para que sus paredes de delante salgan cortadas
  }

  function montar() {
    if (casa) {
      for (const p of plantasConGaraje()) { escena.remove(p.grupo); liberar(p.grupo); }
      escena.remove(casa.tejado.grupo); liberar(casa.tejado.grupo);
      if (casa.jardin) { escena.remove(casa.jardin.grupo); liberar(casa.jardin.grupo); }
      quitarMarco();
      if (casa.parte) { escena.remove(casa.parte.grupo); liberar(casa.parte.grupo); casa.parte = null; }
      for (const m of Object.values(monigotes)) { m.raiz.parent?.remove(m.raiz); m.liberar(); }
    }
    const E = ESTILOS[st.estilo];
    contenedor.style.background = E.fondo || '';
    contenedor.classList.toggle('c3-oscuro', !!E.pixel);
    hemi.color.set(E.luz.cielo); hemi.groundColor.set(E.luz.suelo); hemi.intensity = E.luz.hemi;
    sol.color.set(E.luz.dirColor); sol.intensity = E.luz.dir;
    amb.intensity = E.luz.amb;
    st.extras = JSON.stringify(ESCENAS[st.escena]?.extras || {});
    casa = construirCasa(E, modoDe(st.vista), JSON.parse(st.extras));
    for (const p of plantasConGaraje()) {
      posY[p.def.nivel] = objetivoY(p.def.nivel);
      p.escala = 1;
      p.escalaObj = 1;
      escena.add(p.grupo);
      colocar(p);
    }
    posY[3] = objetivoY(3);
    casa.tejado.grupo.position.y = posY[3];
    escena.add(casa.tejado.grupo);
    casa.tejado.grupo.visible = !juego;
    if (casa.jardin && !juego) escena.add(casa.jardin.grupo);

    monigotes = {};
    ORDEN_PERSONAS.forEach((id, i) => {
      const m = crearMonigote(PERSONAS[id], E);
      m.fase = i * 1.7;
      monigotes[id] = m;
    });
    if (st.parte) ponerParte();
    ultimoAz = null;
    crearEtiquetas();
    aplicar();
    aplicarLuz();
    for (const p of plantasConGaraje()) { p.escala = p.escalaObj; colocar(p); }
  }

  // ---------- la luz de la hora de verdad (la casa viva) ----------
  let cieloArriba = '';
  function aplicarLuz() {
    const E = ESTILOS[st.estilo];
    const L = st.luz;
    if (!L || !juego) {
      hemi.color.set(E.luz.cielo); hemi.groundColor.set(E.luz.suelo); hemi.intensity = E.luz.hemi;
      sol.color.set(E.luz.dirColor); sol.intensity = E.luz.dir; sol.position.set(9, 18, -13);
      amb.intensity = E.luz.amb;
      cieloArriba = '';
      if (juego) contenedor.style.background = E.fondo || '';
      return;
    }
    // Por dentro, la casa siempre bien iluminada y pareja (como con las luces del techo encendidas, sin focos ni
    // bombillas): al atardecer y de noche, esa luz pasa a ser cálida. Lo de fuera lo cuentan el cielo y el sol (o la
    // luna), que tiñe un poco las paredes y da las sombras.
    const dia = L.dia, cal = L.calidez, casaEncendida = L.lamparas;
    const calido = L.manana ? '#ffd6a8' : '#ffb27e';
    hemi.color.copy(new THREE.Color(E.luz.cielo).lerp(new THREE.Color('#ffdcb4'), 0.6 * casaEncendida).lerp(new THREE.Color(calido), cal * 0.35));
    hemi.groundColor.copy(new THREE.Color(E.luz.suelo).lerp(new THREE.Color('#a07c5c'), 0.45 * casaEncendida));
    hemi.intensity = E.luz.hemi * (0.86 + 0.14 * dia);
    sol.color.copy(mezclaColor('#b4c2ff', E.luz.dirColor, dia).lerp(new THREE.Color(L.manana ? '#ffc58f' : '#ff9a5a'), cal * 0.75));
    sol.intensity = E.luz.dir * (0.34 + 0.66 * dia) * (1 - 0.2 * cal);
    // el sol por el este por la mañana y por el oeste por la tarde, más bajo cuanto más cerca del horizonte
    const alto = Math.max(3, 4 + Math.max(0, L.sol) * 0.45);
    sol.position.set((L.manana ? 1 : -1) * (dia > 0.5 ? 9 + 9 * cal : 6), dia > 0.05 ? alto : 18, -13);
    amb.intensity = E.luz.amb * (0.85 + 0.15 * dia) + 0.08 * casaEncendida;
    // el cielo: de día o de noche y, cerca del horizonte, amanecer o atardecer
    const tibio = L.manana ? CIELO.amanecer : CIELO.atardecer;
    const arriba = mezclaColor(CIELO.noche[0], CIELO.dia[0], dia).lerp(new THREE.Color(tibio[0]), cal * 0.85);
    const abajo = mezclaColor(CIELO.noche[1], CIELO.dia[1], dia).lerp(new THREE.Color(tibio[1]), cal * 0.9);
    cieloArriba = '#' + arriba.getHexString();
    contenedor.style.background = `linear-gradient(180deg, ${cieloArriba} 0%, #${abajo.getHexString()} 100%)`;
  }

  // posición y escala de una planta (se agranda o encoge desde su centro)
  function colocar(p) {
    const { xs, ys } = p.huella;
    const lx = (xs[0] + xs[1]) / 2 - CX, lz = (ys[0] + ys[1]) / 2 - CZ;
    const s = p.escala;
    p.grupo.scale.setScalar(s);
    p.grupo.position.set((p.desplazar || 0) + lx * (1 - s), posY[p.def.nivel], lz * (1 - s));
  }

  // ---------- etiquetas HTML encima del 3D ----------

  function chip(clase = 'c3-chip') {
    const el = document.createElement('div');
    el.className = clase;
    capa.appendChild(el);
    return el;
  }

  function crearEtiquetas() {
    capa.innerHTML = '';
    etiquetas = [];
    if (juego) {
      // en la pantalla de juego no hay rótulos de piso: las caras de arriba llevan a cada piso y encima de cada muñeco
      // va su bocadillo (los pone la app)
      etiquetasPersona = {};
      for (const id of ORDEN_PERSONAS) {
        const el = document.createElement('button');
        el.type = 'button';
        el.className = 'c3-bur';
        el.hidden = true;
        el.addEventListener('click', () => { const b = st.burbujas.find((x) => x.id === id); if (b && b.alTocar) b.alTocar(); });
        capa.appendChild(el);
        etiquetasPersona[id] = el;
      }
      return;
    }
    for (const p of plantasConGaraje()) {
      const { xs, ys } = p.huella;
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'c3-chip c3-chip-boton';
      el.addEventListener('click', () => visitar(p.def.nivel));
      capa.appendChild(el);
      etiquetas.push({ tipo: 'planta', el, planta: p, nivel: p.def.nivel, local: new THREE.Vector3(xs[0] - 0.2 - CX, p.def.nivel === 2 ? PIEDRA_SUBE + 0.3 : 0.3, (ys[0] + ys[1]) / 2 - CZ) });
      for (const c of p.cerrados || []) {
        if (!c.nombre) continue;
        const e2 = chip('c3-cerrado');
        e2.textContent = c.nombre;
        etiquetas.push({ tipo: 'cerrado', el: e2, planta: p, nivel: p.def.nivel, local: new THREE.Vector3((c.x0 + c.x1) / 2 - CX, c.base + 1.1, (c.y0 + c.y1) / 2 - CZ) });
      }
    }
    if (casa.modo === 'entera') {
      const t = chip('c3-chip c3-chip-tejado');
      const pj = PERSONAS.jose || Object.values(PERSONAS)[1] || {};
      const negrita = document.createElement('b');
      negrita.textContent = `Piso de ${pj.nombre || 'Jose'}`;
      t.replaceChildren(negrita, ' · privado');
      t.style.setProperty('--c', pj.color || '#2f8f5b');
      etiquetas.push({ tipo: 'tejado', el: t, nivel: 3, local: new THREE.Vector3(-0.3 - CX, 2.4, 4.5 - CZ) });
    }
    etiquetasPersona = {};
    for (const id of ORDEN_PERSONAS) {
      const el = document.createElement('div');
      el.className = 'c3-persona';
      el.style.setProperty('--c', PERSONAS[id].color);
      el.innerHTML = `<span class="c3-insignias"></span><span class="c3-burbuja" hidden></span><span class="c3-nombre">${PERSONAS[id].nombre}</span>`;
      capa.appendChild(el);
      etiquetasPersona[id] = el;
    }
    capa.appendChild(volver);
  }

  function visitar(nivel) {
    st.visita = nivel === null || nivel === miNivel() ? null : nivel;
    aplicar();
  }

  // ---------- estado de la semana ----------

  function atenuar(mats, modo) {
    for (const m of mats.todos) {
      const b = m.userData.base;
      if (b.color) {
        m.color.copy(b.color);
        if (modo === 'apagado') m.color.lerp(GRIS, 0.3).multiplyScalar(0.72);
        if (modo === 'fantasma') m.color.lerp(GRIS, 0.3).multiplyScalar(0.9);
        if (modo === 'fondo') m.color.lerp(GRIS, 0.22).multiplyScalar(0.93);
        if (modo === 'medio') m.color.lerp(GRIS, 0.18).multiplyScalar(0.94);
      }
      // medio: los pisos que no miras en la pantalla de juego, a menos de la mitad (Javi: «por lo menos al 50 % de
      // transparencia»)
      const fantasma = modo === 'fantasma', fondo = modo === 'fondo', medio = modo === 'medio';
      const transp = fantasma || fondo || medio || b.transparent;
      if (m.transparent !== transp) { m.transparent = transp; m.needsUpdate = true; }
      m.opacity = fantasma ? (b.opacity ?? 1) * 0.14 : fondo ? (b.opacity ?? 1) * 0.42 : medio ? (b.opacity ?? 1) * 0.4 : b.opacity;
      m.depthWrite = fantasma ? false : b.depthWrite;
      if (b.emissive && m.emissive) {
        m.emissive.copy(b.emissive);
        if (modo !== 'normal') m.emissive.multiplyScalar(0.35);
      }
    }
  }

  // dias: días desde la última vez que se limpió (la suciedad sale poco a poco, día a día)
  function pintarPlanta(p, estado, nivel, modo, color, destacada, dias = 0, hecho) {
    let k = 0;
    // mientras se limpia y se va marcando la lista, lo sucio se quita al revés de como salió (lo último, lo primero)
    const quedan = estado === 'limpiando' && hecho !== undefined ? dias * (1 - hecho) : null;
    for (const s of p.suciedad) {
      const u = s.userData, d = u.dia ?? DIA_NIVEL[u.nivel ?? 0], h = u.hasta ?? Infinity;
      const toca = dias >= d && dias <= h;
      if (estado === 'sucio') s.visible = toca;
      else if (quedan !== null) s.visible = hecho < 1 && quedan >= d && quedan <= h;
      else if (estado === 'limpiando') s.visible = toca && d < DIA_NIVEL[2] && (k++ % 5) < 2;
      else s.visible = false;
    }
    for (const g of p.grietas) g.visible = estado === 'sucio' && nivel >= 3;
    for (const g of p.moho) g.visible = estado === 'sucio' && nivel >= 2;
    for (const s of p.brillos) s.visible = estado === 'limpio' && (s.userData.nivel ?? 1) <= nivel;
    // 3 semanas: la casa se cae (paredes y muebles rotos); se construye la primera vez que hace falta
    const enRuinas = estado === 'sucio' && nivel >= 3 && p.def.piso !== 'garaje';
    if (enRuinas && !p.conRuina) construirRuina(p, ESTILOS[st.estilo]);
    p.ruina = enRuinas && !!p.conRuina;
    p.muebles.visible = !p.ruina;
    p.mueblesRuina.visible = p.ruina;
    p.int.normal.visible = !p.ruina;
    p.int.ruina.visible = p.ruina;
    actualizarMuros(p);
    atenuar(p.materiales, modo);
    if (estado === 'sucio' && nivel >= 2) {
      const t = nivel >= 3 ? 0.3 : 0.18;
      for (const [key, m] of p.materiales.mapa) {
        if ((key.startsWith('suelo_') || MANCHABLES.includes(key)) && m.color) m.color.lerp(SUCIO, t);
      }
    }
    if (p.ruina) {
      // todo más oscuro y tirando a verde podrido
      for (const [key, m] of p.materiales.mapa) {
        if (SIN_TINTE.includes(key) || !m.color) continue;
        m.color.lerp(PODRIDO, 0.3).multiplyScalar(0.84);
      }
    }
    for (const [key, m] of p.materiales.mapa) {
      if (key.startsWith('suelo_') && m.emissive) {
        m.emissive.set(estado === 'limpio' && destacada ? (nivel >= 3 ? '#5c4b22' : '#3a3528') : '#000000');
      }
    }
    p.halo.visible = destacada;
    p.halo.material.color.set(color);
    p.escalaObj = casa.modo === 'foco' && !juego ? (destacada ? 1.08 : 0.92) : 1;
  }

  // «Mi parte»: cada cuarto va por sus días (los de «Tu espacio»; sin apuntar, ni sucio ni brillos) y, recién
  // limpio, brilla (lo dice la app: 3 el mismo día, 2 al siguiente, 1 al otro)
  function pintarParte(p) {
    const dias = (st.parte && st.parte.dias) || {};
    const brillos = (st.parte && st.parte.brillo) || {};
    const de = (o) => { const n = dias[o.userData.cuarto]; return typeof n === 'number' ? n : null; };
    for (const s of p.suciedad) {
      const u = s.userData, d = u.dia ?? DIA_NIVEL[u.nivel ?? 0], h = u.hasta ?? Infinity, n = de(s);
      s.visible = n !== null && n >= d && n <= h;
    }
    const peor = Math.max(-1, ...Object.values(dias).filter((n) => typeof n === 'number'));
    for (const g of p.moho) g.visible = peor >= DIA_NIVEL[2];
    for (const s of p.brillos) s.visible = (s.userData.nivel ?? 1) <= (brillos[s.userData.cuarto] || 0);
    p.ruina = false;
    p.muebles.visible = true; p.mueblesRuina.visible = false;
    p.int.normal.visible = true; p.int.ruina.visible = false;
    actualizarMuros(p);
    atenuar(p.materiales, 'normal');
    p.halo.visible = true;
    p.halo.material.color.set((PERSONAS[st.verComo] || {}).color || '#ffffff');
  }

  function textoChip(nombre, corto, quien, est, tuyo, extra = '', pastilla = 'Tu piso') {
    if (ancho < 520) return `${tuyo ? '<span class="c3-tu">Tú</span>' : ''}<b>${corto}</b> <span class="c3-est c3-${est.tono}">${est.nombre}</span>${extra}`;
    return `${tuyo ? `<span class="c3-tu">${pastilla}</span>` : ''}<b>${nombre}</b>${quien ? ' · ' + quien : ''} <span class="c3-est c3-${est.tono}">${est.nombre}</span>${extra}`;
  }

  function aplicar() {
    // si cambia lo que entra en algún piso (el pasillo de arriba según a quién le toque), se vuelve a montar
    if (casa && casa.modo === 'foco' && JSON.stringify(ESCENAS[st.escena]?.extras || {}) !== st.extras) { montar(); return; }
    if (!casa) return;
    const esc = ESCENAS[st.escena] || ESCENAS.vacia;
    const mio = TURNOS[st.verComo];
    const dest = destacado();
    const estrecho = ancho < 520;
    const enParte = juego && !!casa.parte;

    for (const p of casa.plantas) {
      const piso = p.def.piso;
      const [estado, nivel, dias, hecho] = estadoPiso(esc, piso);
      const quien = ORDEN_PERSONAS.find((id) => TURNOS[id] === piso);
      // en la pantalla de juego se ven los tres pisos: el que miras, entero y con su halo; los otros, medio transparentes
      const esDest = juego ? p.def.nivel === focoNivel() : p.def.nivel === dest;
      const modo = esDest ? 'normal' : juego ? 'medio' : st.vista === 'transparente' ? 'fantasma' : casa.modo === 'foco' ? 'fondo' : 'apagado';
      p.grupo.visible = !enParte;
      pintarPlanta(p, estado, nivel, modo, PERSONAS[quien].color, esDest, dias, hecho);
      // la basura llena, esperando a que alguien la saque: bolsas que se acumulan y, al segundo día, moscas
      if (p.basura) {
        const b = esc.basura || null;
        const n = b ? Math.max(0, Math.min(p.basura.bolsas.length, b.bolsas || 0)) : 0;
        p.basura.bolsas.forEach((g, i) => { g.visible = i < n; });
        p.basura.moscas.forEach((m) => { m.visible = n > 0 && (b.dias || 0) >= 1; });
      }
    }
    if (casa.garaje) {
      casa.garaje.grupo.visible = garajeVisible() && !enParte;
      const esDest = st.visita === -1 || (st.visita == null && st.extra === st.verComo);
      pintarPlanta(casa.garaje, 'limpiando', 0, esDest ? 'normal' : juego ? 'medio' : 'fondo', st.extra ? PERSONAS[st.extra].color : '#ffffff', esDest);
    }
    if (casa.parte) pintarParte(casa.parte);
    atenuar(casa.tejado.materiales, st.vista === 'transparente' ? 'fantasma' : 'normal');

    for (const id of ORDEN_PERSONAS) {
      const m = monigotes[id];
      const el = etiquetasPersona[id];
      const cfg = (esc.personas && esc.personas[id]) || {};
      let planta, sitio, pose, texto = '';
      if (enParte && id === st.verComo) {
        // en «Mi parte», tú en tu cuarto (el que miras, si tocaste uno; los otros dos se quedan en sus pisos)
        planta = casa.parte;
        const f = st.parte && st.parte.foco;
        sitio = f && CUARTOS[f] && st.parte.cuartos.includes(f) ? CUARTOS[f].sitio : planta.def.sitios.pie;
        pose = 'pie';
      } else if (st.extra === id && casa.garaje) {
        planta = casa.garaje;
        sitio = GARAJE.sitios.barrer;
        pose = 'barrer';
        texto = 'Limpiando…';
      } else {
        const piso = TURNOS[id];
        planta = casa.plantas[PISOS[piso].nivel];
        const [estado] = esc.pisos[piso];
        const s = planta.def.sitios;
        pose = 'pie'; sitio = s.pie;
        if (estado === 'limpiando') { pose = 'barrer'; sitio = s.barrer; texto = 'Limpiando…'; }
        if (estado === 'esperando') { pose = 'esperar'; sitio = s.esperar; texto = 'Esperando nota'; }
        if (estado === 'limpio') { pose = s.relax.pose; sitio = [s.relax.x, s.relax.y, s.relax.mira]; }
        if (cfg.accion === 'sofa') { pose = piso === 'arriba' ? 'sofa' : s.relax.pose; sitio = [s.relax.x, s.relax.y, s.relax.mira]; }
        else if (cfg.accion) { pose = cfg.accion; sitio = s.pie; }
        if (st.extra === id) { pose = 'barrer'; sitio = GARAJE.sitios.barrer; planta = casa.plantas[0]; texto = 'Limpiando…'; }
        if (cfg.dice) texto = cfg.dice;
      }
      const [x, y, mira] = sitio;
      const base = planta.def.nivel === 2 && x < 11 ? PIEDRA_SUBE : 0;
      m.pose(pose);
      const lista = [...(cfg.insignias || [])];
      if (esc.rey === id) lista.push('corona');
      m.setInsignias(lista);
      m.raiz.position.set(x - CX, base, y - CZ);
      m.raiz.rotation.y = ROT[mira] ?? 0;
      if (m.raiz.parent !== planta.grupo) { m.raiz.parent?.remove(m.raiz); planta.grupo.add(m.raiz); }
      if (juego) continue;
      const burbuja = el.querySelector('.c3-burbuja');
      burbuja.hidden = !texto;
      burbuja.textContent = texto;
      const ins = [];
      if (esc.rey === id) ins.push('rey');
      for (const k of cfg.insignias || []) if (INSIGNIAS[k]) ins.push(k);
      el.querySelector('.c3-insignias').innerHTML = ins.slice(0, estrecho ? 1 : 2).map((k) => `<span class="c3-ins c3-${INSIGNIAS[k][1]}">${INSIGNIAS[k][0]}</span>`).join('');
      el.classList.toggle('c3-yo', id === st.verComo);
    }

    for (const e of etiquetas) {
      if (e.tipo === 'cerrado') { e.el.hidden = (e.planta === casa.garaje && !garajeVisible()) || e.nivel !== dest; continue; }
      if (e.tipo !== 'planta') continue;
      const esDest = e.planta === casa.garaje ? (st.visita === -1 || (st.visita == null && st.extra === st.verComo)) : e.nivel === dest;
      e.el.classList.toggle('c3-fondo', !esDest);
      if (e.planta === casa.garaje) {
        e.el.hidden = !garajeVisible();
        if (!st.extra) continue;
        const tuyo = st.extra === st.verComo;
        e.el.classList.toggle('c3-tuyo', tuyo);
        e.el.style.setProperty('--c', PERSONAS[st.extra].color);
        const mas = `<span class="c3-mas">+${GARAJE.puntos}</span>`;
        e.el.innerHTML = textoChip('Garaje', 'Garaje', `extra · ${PERSONAS[st.extra].nombre}`, ESTADOS.limpiando, tuyo, mas, 'Tú');
        continue;
      }
      const piso = Object.values(PISOS).find((q) => q.nivel === e.nivel);
      const quien = ORDEN_PERSONAS.find((id) => TURNOS[id] === piso.id);
      const [estado, nivel] = estadoPiso(esc, piso.id);
      const est = etiquetaEstado(estado, nivel, estrecho);
      const tuyo = piso.id === mio;
      e.el.classList.toggle('c3-tuyo', tuyo);
      e.el.style.setProperty('--c', PERSONAS[quien].color);
      e.el.setAttribute('aria-label', tuyo ? `Tu piso: ${piso.nombre}` : `Ver el ${piso.nombre.toLowerCase()} de ${PERSONAS[quien].nombre}`);
      e.el.innerHTML = textoChip(piso.nombre, piso.corto, PERSONAS[quien].nombre, est, tuyo);
    }
    volver.hidden = st.visita == null || juego;
    volver.textContent = 'Volver a tu piso';
    if (juego) pintarBurbujas();
  }

  // los bocadillos de la pantalla de juego: { id, titulo, sub, tono, alTocar }
  function pintarBurbujas() {
    for (const id of ORDEN_PERSONAS) {
      const el = etiquetasPersona[id];
      if (!el) continue;
      const b = st.burbujas.find((x) => x.id === id);
      el.hidden = !b;
      if (!b) continue;
      el.className = `c3-bur c3-bur-${b.tono || 'blanco'}${b.alTocar ? '' : ' c3-bur-quieta'}`;
      el.disabled = !b.alTocar;
      el.textContent = '';
      const t = document.createElement('b');
      t.textContent = b.titulo;
      el.appendChild(t);
      if (b.sub) { const sm = document.createElement('small'); sm.textContent = b.sub; el.appendChild(sm); }
    }
  }

  // ---------- cámara ----------

  const v3 = new THREE.Vector3();
  const centro = new THREE.Vector3();
  const puntos = [];
  function puntosCaja() {
    puntos.length = 0;
    const lista = casa.plantas.slice();
    if (garajeVisible()) lista.push(casa.garaje);
    for (const p of lista) {
      p.grupo.updateMatrixWorld(true);
      const [xa, xb] = p.huella.xs;
      const [ya, yb] = p.huella.ys;
      for (const x of [xa, xb]) for (const y of [ya, yb]) for (const z of [-0.6, 2.7]) {
        puntos.push(new THREE.Vector3(x - CX, z, y - CZ).applyMatrix4(p.grupo.matrixWorld));
      }
    }
    if (casa.modo !== 'foco') {
      for (const x of [-0.5, 18]) for (const y of [-0.6, 9.6]) puntos.push(new THREE.Vector3(x - CX, posY[3] + 2.6, y - CZ));
    }
    return puntos;
  }

  // pantalla de juego: qué se encuadra y el paso suave de una vista a otra. Con el cajón cerrado, los tres pisos
  // (igual para todos); abierto, el piso que miras; en «Mi parte», tus cuartos. La cámara mira siempre al centro de
  // la casa y cada vista es un recuadro de lo que se ve (centro y metros por píxel), que es lo que se anima
  const anim = { de: null, a: null, clave: null, t0: 0 };
  const focoNivel = () => (st.foco ?? miNivel());
  const centroJuego = new THREE.Vector3();
  function prisma(pts, { xs, ys }, h0, h1) {
    for (const x of xs) for (const y of ys) for (const h of [h0, h1]) pts.push(new THREE.Vector3(x - CX, h, y - CZ));
    return pts;
  }
  function puntosJuego() {
    if (casa.parte) {
      // el cuarto que miras, de cerca; si no, todos tus cuartos
      const f = st.parte && st.parte.foco, c = f && CUARTOS[f] && st.parte.cuartos.includes(f) ? CUARTOS[f] : null;
      if (c) {
        const v = VISTAS_JUEGO.cuarto, [x0, y0, x1, y1] = c.zona, b = posY[2] + (x0 < 11 ? PIEDRA_SUBE : 0);
        return ['cuarto-' + f, prisma([], { xs: [x0, x1], ys: [y0, y1] }, b + v.h[0], b + v.h[1]), v.margen];
      }
      const v = VISTAS_JUEGO.parte, b = posY[2];
      return ['parte', prisma([], casa.parte.huella, b + v.h[0], b + v.h[1]), v.margen];
    }
    if (!st.cerca) {
      const v = VISTAS_JUEGO.todos, pts = [];
      for (const p of casa.plantas) prisma(pts, p.huella, posY[p.def.nivel] + v.h[0], posY[p.def.nivel] + v.h[1]);
      return ['todos', pts, v.margen];
    }
    const nivel = focoNivel(), v = VISTAS_JUEGO.piso;
    const p = casa.plantas.find((q) => q.def.nivel === nivel);
    const b = posY[nivel] ?? 0;
    return ['piso' + nivel, prisma([], p ? p.huella : { xs: [11, 17.5], ys: [0, 9] }, b + v.h[0], b + v.h[1]), v.margen];
  }
  function encuadrarJuego() {
    const ahora = performance.now();
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const p of casa.plantas) {
      x0 = Math.min(x0, p.huella.xs[0]); x1 = Math.max(x1, p.huella.xs[1]);
      z0 = Math.min(z0, p.huella.ys[0]); z1 = Math.max(z1, p.huella.ys[1]);
    }
    centroJuego.set((x0 + x1) / 2 - CX, (posY[0] + posY[2] + 2.6) / 2, (z0 + z1) / 2 - CZ);
    const dir = v3.set(Math.sin(st.az) * Math.cos(st.el), Math.sin(st.el), -Math.cos(st.az) * Math.cos(st.el));
    camara.position.copy(centroJuego).addScaledVector(dir, 120);
    camara.up.set(0, 1, 0);
    camara.lookAt(centroJuego);
    camara.updateMatrixWorld();
    const [clave, pts, margen] = puntosJuego();
    const inv = camara.matrixWorldInverse;
    let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity;
    for (const v of pts) { v.applyMatrix4(inv); a0 = Math.min(a0, v.x); a1 = Math.max(a1, v.x); b0 = Math.min(b0, v.y); b1 = Math.max(b1, v.y); }
    // la vista va en el hueco que dejan la cabecera y el cajón (lo que tapa el cajón cambia poco a poco)
    const objetivo = st.margenes.abajo;
    st.abajo = st.abajo === null ? objetivo : st.abajo + (objetivo - st.abajo) * 0.2;
    if (Math.abs(objetivo - st.abajo) < 0.5) st.abajo = objetivo;
    const hueco = Math.max(60, alto - st.margenes.arriba - st.abajo);
    const meta = [(a0 + a1) / 2, (b0 + b1) / 2, Math.max((a1 - a0) / ancho, (b1 - b0) / hueco) * margen];   // centro y metros por píxel
    if (anim.a === null) { anim.de = meta; anim.clave = clave; anim.t0 = ahora - 1e4; }
    let k = suave((ahora - anim.t0) / 700);
    if (anim.clave !== clave) {
      anim.de = anim.de.map((v, i) => v + (anim.a[i] - v) * k);
      anim.clave = clave; anim.t0 = ahora; k = 0;
    }
    anim.a = meta;
    const [cx0, cy0, s0] = k >= 1 ? meta : anim.de.map((v, i) => v + (meta[i] - v) * k);
    const s = s0 / st.zoom;
    const cx = cx0 + st.pan.x;
    const top = cy0 + s * (st.margenes.arriba + hueco / 2) + st.pan.y;
    camara.left = cx - (s * ancho) / 2; camara.right = cx + (s * ancho) / 2;
    camara.top = top; camara.bottom = top - s * alto;
    camara.updateProjectionMatrix();
    if (ultimoAz !== st.az) { cortarMuros(); ultimoAz = st.az; }
    return k < 1 || st.abajo !== objetivo;
  }

  function encuadrar() {
    if (!casa) return;
    if (juego) return encuadrarJuego();
    const pts = puntosCaja();
    let ymin = Infinity, ymax = -Infinity;
    for (const p of pts) { ymin = Math.min(ymin, p.y); ymax = Math.max(ymax, p.y); }
    centro.set(0, (ymin + ymax) / 2, 0.5);
    const dir = v3.set(Math.sin(st.az) * Math.cos(st.el), Math.sin(st.el), -Math.cos(st.az) * Math.cos(st.el));
    camara.position.copy(centro).addScaledVector(dir, 120);
    camara.up.set(0, 1, 0);
    camara.lookAt(centro);
    camara.updateMatrixWorld();
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    const inv = camara.matrixWorldInverse;
    for (const p of pts) {
      const q = p.clone().applyMatrix4(inv);
      x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y);
    }
    let mx = (x1 - x0) / 2 * 1.04, my = (y1 - y0) / 2 * 1.04 + 0.4;
    const util = Math.max(1, alto - reserva);
    const asp = ancho / util;
    if (mx / my > asp) my = mx / asp; else mx = my * asp;
    const cx = (x0 + x1) / 2 + st.pan.x, cy = (y0 + y1) / 2 + 0.25 + st.pan.y;
    const hx = mx / st.zoom, hy = my / st.zoom;
    camara.left = cx - hx; camara.right = cx + hx;
    camara.top = cy + hy; camara.bottom = cy + hy - 2 * hy * (alto / util);
    camara.updateProjectionMatrix();
    if (ultimoAz !== st.az) { cortarMuros(); ultimoAz = st.az; }
  }

  function cortarMuros() {
    const mirada = new THREE.Vector2(Math.sin(st.az), -Math.cos(st.az));
    for (const p of casa.parte ? [...plantasConGaraje(), casa.parte] : plantasConGaraje()) {
      for (const [l, n] of Object.entries(LADOS)) p.deCara[l] = n.dot(mirada) > 0.15;
      actualizarMuros(p);
    }
  }

  // las paredes de delante van cortadas; y si el piso está en ruinas, se ven las rotas
  function actualizarMuros(p) {
    for (const l of Object.keys(LADOS)) {
      const dc = !!p.deCara[l], m = p.muros[l];
      m.alto.visible = !dc && !p.ruina;
      m.bajo.visible = dc && !p.ruina;
      m.altoRuina.visible = !dc && p.ruina;
      m.bajoRuina.visible = dc && p.ruina;
    }
  }

  // ---------- etiquetas: posición en pantalla ----------

  const tmp = new THREE.Vector3();
  function aPantalla(v) {
    tmp.copy(v).project(camara);
    return [(tmp.x + 1) / 2 * ancho, (1 - tmp.y) / 2 * alto];
  }

  function moverBurbujas() {
    for (const id of ORDEN_PERSONAS) {
      const el = etiquetasPersona[id], m = monigotes[id];
      if (!el || el.hidden || !m) continue;
      m.raiz.updateWorldMatrix(true, false);
      const [sx, sy] = aPantalla(new THREE.Vector3(0, m.arribaDeLaCabeza() + 0.25, 0).applyMatrix4(m.raiz.matrixWorld));
      const w = el.offsetWidth || 120;
      const fuera = sy < st.margenes.arriba + 30 || sy > alto - st.margenes.abajo || !(m.raiz.parent && m.raiz.parent.visible);
      el.style.visibility = fuera ? 'hidden' : 'visible';
      const x = Math.min(ancho - w / 2 - 10, Math.max(w / 2 + 10, sx));
      el.style.transform = `translate(${(x - w / 2).toFixed(1)}px, ${sy.toFixed(1)}px) translateY(-100%)`;
      el.style.setProperty('--pico', `${Math.max(14, Math.min(w - 14, w / 2 + (sx - x))).toFixed(1)}px`);
    }
  }

  function moverEtiquetas() {
    if (juego) { moverBurbujas(); return; }
    // primero los muñecos; luego los rótulos de cada piso, apartándolos si tapan a alguien
    const ocupados = [];
    for (const id of ORDEN_PERSONAS) {
      const m = monigotes[id];
      const el = etiquetasPersona[id];
      m.raiz.updateWorldMatrix(true, false);
      const [sx, sy] = aPantalla(new THREE.Vector3(0, m.arribaDeLaCabeza(), 0).applyMatrix4(m.raiz.matrixWorld));
      const visible = !!(m.raiz.parent && m.raiz.parent.visible);
      el.style.visibility = visible ? 'visible' : 'hidden';
      el.style.transform = `translate(${sx.toFixed(1)}px, ${(sy - 4).toFixed(1)}px) translate(-50%, -100%)`;
      if (visible) {
        const w = el.offsetWidth || 60, h = el.offsetHeight || 22;
        ocupados.push([sx - w / 2 - 3, sy - 4 - h - 3, sx + w / 2 + 3, sy + 34]);
      }
    }
    for (const e of etiquetas) {
      if (e.el.hidden) continue;
      const grupo = e.tipo === 'tejado' ? casa.tejado.grupo : e.planta.grupo;
      grupo.updateMatrixWorld(true);
      const [sx, sy] = aPantalla(e.local.clone().applyMatrix4(grupo.matrixWorld));
      const w = e.el.offsetWidth || 120;
      if (e.tipo === 'cerrado') {
        // rótulo secundario: si tapa a un muñeco, se esconde
        const x0 = sx - w / 2, y0 = sy - 10, h0 = e.el.offsetHeight || 22;
        const tapa = ocupados.some(([a0, b0, a1, b1]) => x0 < a1 && x0 + w > a0 && y0 < b1 && y0 + h0 > b0);
        e.el.style.visibility = tapa ? 'hidden' : 'visible';
        e.el.style.transform = `translate(${x0.toFixed(1)}px, ${y0.toFixed(1)}px)`;
        continue;
      }
      const h = e.el.offsetHeight || 26;
      const x = Math.min(ancho - w - 8, Math.max(6, sx + 6));
      let yy = Math.min(alto - 30, Math.max(4, sy - 13));
      for (const [a0, b0, a1, b1] of ocupados) {
        if (x < a1 && x + w > a0 && yy < b1 && yy + h > b0) {
          const abajo = b1 + 2;
          yy = abajo + h < alto - 4 ? abajo : Math.max(4, b0 - h - 2);
        }
      }
      e.el.style.transform = `translate(${x.toFixed(1)}px, ${yy.toFixed(1)}px)`;
    }
  }

  // ---------- tamaño, gestos y bucle ----------

  function medir() {
    const r = contenedor.getBoundingClientRect();
    ancho = Math.max(1, Math.round(r.width));
    alto = Math.max(1, Math.round(r.height));
    renderer.setSize(ancho, alto, false);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
  }

  const punteros = new Map();
  let pinza = null;
  const lienzo = renderer.domElement;
  lienzo.style.touchAction = 'pan-y';
  lienzo.addEventListener('pointerdown', (e) => {
    punteros.set(e.pointerId, { x: e.clientX, y: e.clientY, tipo: e.pointerType });
    if (e.pointerType === 'mouse') lienzo.setPointerCapture(e.pointerId);
    if (punteros.size === 2) {
      const [a, b] = [...punteros.values()];
      pinza = { d: Math.hypot(a.x - b.x, a.y - b.y), zoom: st.zoom, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, pan: st.pan.clone() };
    }
  });
  lienzo.addEventListener('pointermove', (e) => {
    const p = punteros.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    if (punteros.size === 1) {
      st.az -= dx * 0.008;
      if (p.tipo === 'mouse') st.el = Math.min(1.1, Math.max(0.15, st.el + dy * 0.005));
    } else if (punteros.size === 2 && pinza) {
      const [a, b] = [...punteros.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      st.zoom = Math.min(4, Math.max(0.8, pinza.zoom * (d / pinza.d)));
      const escala = (camara.right - camara.left) / ancho;
      st.pan.set(pinza.pan.x - ((a.x + b.x) / 2 - pinza.mx) * escala, pinza.pan.y + ((a.y + b.y) / 2 - pinza.my) * escala);
    }
  });
  const soltar = (e) => { punteros.delete(e.pointerId); if (punteros.size < 2) pinza = null; };
  lienzo.addEventListener('pointerup', soltar);
  lienzo.addEventListener('pointercancel', soltar);
  lienzo.addEventListener('wheel', (e) => {
    e.preventDefault();
    st.zoom = Math.min(4, Math.max(0.8, st.zoom * Math.exp(-e.deltaY * 0.0015)));
    if (st.zoom <= 1.001) st.pan.set(0, 0);
  }, { passive: false });
  lienzo.addEventListener('dblclick', () => centrar());

  let raf = 0;
  let ultimo = 0;
  const reloj = new THREE.Clock();
  function acercarA(nivel) {
    const obj = objetivoY(nivel);
    posY[nivel] += (obj - posY[nivel]) * 0.16;
    if (Math.abs(obj - posY[nivel]) < 0.005) posY[nivel] = obj;
    return posY[nivel] !== obj;
  }
  function animarPlanta(p, t) {
    for (const s of p.brillos) {
      if (!s.visible) continue;
      const k = 0.5 + 0.5 * Math.sin(t * s.userData.vel + s.userData.fase);
      s.scale.setScalar(s.userData.tam * (0.35 + 0.75 * k));
    }
    const { moscas, peste, niebla, ratas } = p.animados;
    for (const g of ratas) {
      if (!g.visible) continue;
      const u = g.userData, a = t * u.vel + u.fase;
      const k = 0.5 - 0.5 * Math.cos(a);
      const dx = u.b[0] - u.a[0], dz = u.b[1] - u.a[1];
      const ida = Math.sin(a) >= 0;
      g.position.set(u.a[0] + dx * k, u.base + Math.abs(Math.sin(t * 14 + u.fase)) * 0.012, u.a[1] + dz * k);
      g.rotation.y = Math.atan2(-(ida ? dz : -dz), ida ? dx : -dx);
    }
    for (const m of moscas) {
      if (!m.visible) continue;
      const u = m.userData, a = t * u.vel + u.fase;
      m.position.set(u.cx + Math.cos(a) * u.rad, u.cy + Math.sin(a * 2.7) * 0.12, u.cz + Math.sin(a) * u.rad);
    }
    for (const s of peste) {
      if (!s.visible) continue;
      const u = s.userData, k = (t * 0.45 + u.fase) % 1;
      s.position.set(u.cx + Math.sin(k * 6) * 0.05, u.b + k * 0.9, u.cz);
      s.material.opacity = Math.sin(k * Math.PI) * 0.9;
    }
    for (const s of niebla) {
      if (!s.visible) continue;
      const u = s.userData;
      if (u.sube) {
        const k = (t * 0.3 + u.fase) % 1;
        const e = u.tam * (0.4 + 0.8 * Math.sin(k * Math.PI));
        s.position.set(u.cx + Math.sin(k * 5 + u.fase * 6) * 0.12, u.b + 0.25 + k * u.sube, u.cz);
        s.scale.set(e, e, 1);
        continue;
      }
      const k = 0.85 + 0.15 * Math.sin(t * 0.8 + u.fase);
      s.scale.set(u.tam * k, u.tam * 0.5 * k, 1);
    }
    if (p.halo.visible) p.halo.material.opacity = 0.75 + 0.2 * Math.sin(t * 2.2);
  }
  function paso(sinDibujo = false) {
    const t = reloj.getElapsedTime();
    let moviendo = false;
    for (const p of plantasConGaraje()) {
      moviendo = acercarA(p.def.nivel) || moviendo;
      p.escala += (p.escalaObj - p.escala) * 0.16;
      if (Math.abs(p.escalaObj - p.escala) < 0.001) p.escala = p.escalaObj; else moviendo = true;
      colocar(p);
    }
    moviendo = acercarA(3) || moviendo;
    casa.tejado.grupo.position.y = posY[3];
    if (casa.parte) { colocar(casa.parte); animarPlanta(casa.parte, t); }
    for (const id of ORDEN_PERSONAS) monigotes[id].animar(t, monigotes[id].fase);
    for (const p of plantasConGaraje()) animarPlanta(p, t);
    moviendo = encuadrar() || moviendo;
    if (!sinDibujo) dibujar();
    moverEtiquetas();
    return moviendo;
  }
  function bucle(ts) {
    raf = requestAnimationFrame(bucle);
    if (document.hidden) return;
    if (ts - ultimo < 32) return;
    ultimo = ts;
    paso();
  }

  const ro = new ResizeObserver(() => {
    medir();
    if (!casa) return;
    if ((ancho < 520) !== (anchoEtiquetas < 520)) { anchoEtiquetas = ancho; contenedor.classList.toggle('c3-estrecho', ancho < 520); aplicar(); }
    paso();
  });
  ro.observe(contenedor);

  function centrar() {
    st.az = opciones.az ?? 0.38;
    st.el = opciones.el ?? 0.5;
    st.zoom = 1;
    st.pan.set(0, 0);
  }

  // la cara de cada uno (un dibujo pequeño de su muñeco), para las caras de arriba de la pantalla de juego
  let caras = null;
  function retratos(tam = 160) {
    if (caras) return caras;
    caras = {};
    let r2 = null;
    try {
      r2 = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
      r2.setPixelRatio(1); r2.setSize(tam, tam, false); r2.outputColorSpace = THREE.SRGBColorSpace;
      r2.setClearColor(0x000000, 0);
      const E = ESTILOS[st.estilo];
      const esc = new THREE.Scene();
      esc.add(new THREE.HemisphereLight('#ffffff', '#e4c7a0', 1.25));
      const s2 = new THREE.DirectionalLight('#fff0dc', 2.1); s2.position.set(2, 6, 5); esc.add(s2);
      esc.add(new THREE.AmbientLight('#ffffff', 0.25));
      const cam = new THREE.PerspectiveCamera(22, 1, 0.05, 20);
      for (const id of ORDEN_PERSONAS) {
        const m = crearMonigote(PERSONAS[id], E);
        m.pose('pie'); m.animar(0.3, 0);
        esc.add(m.raiz);
        const y = 1.27 * (m.raiz.children[0]?.scale.x || 1);
        cam.position.set(0.28, y + 0.12, 1.85);
        cam.lookAt(0, y + 0.02, 0);
        r2.render(esc, cam);
        caras[id] = r2.domElement.toDataURL('image/png');
        esc.remove(m.raiz);
        m.liberar();
      }
    } catch { /* sin caras: la app pone las de siempre */ }
    if (r2) { r2.dispose(); r2.forceContextLoss?.(); }
    return caras;
  }

  medir();
  anchoEtiquetas = ancho;
  contenedor.classList.toggle('c3-estrecho', ancho < 520);
  montar();
  paso();
  if (!opciones.captura) raf = requestAnimationFrame(bucle);

  return {
    setEstilo(id) { if (ESTILOS[id] && id !== st.estilo) { st.estilo = id; montar(); } },
    setVerComo(id) { st.verComo = id; st.visita = null; aplicar(); },
    setEscena(id) {
      // un nombre de las escenas de ejemplo, o una escena calculada por la app ({ turnos, pisos, personas, rey })
      if (id && typeof id === 'object') {
        ESCENAS.__vivo = { aviso: () => ['', ''], personas: {}, rey: null, ...id };
        if (id.turnos) ponerTurnos(id.turnos);
        st.escena = '__vivo';
        aplicar();
        return;
      }
      if (ESCENAS[id]) { st.escena = id; st.visita = null; aplicar(); }
    },
    setMomento(id) { if (ESCENAS[id]) { st.escena = id; aplicar(); } },
    setVista(id) {
      const antes = modoDe(st.vista);
      st.vista = id;
      st.pan.set(0, 0);
      if (modoDe(id) !== antes) montar(); else aplicar();
    },
    setExtra(id) {
      const nuevo = id || null;
      if (nuevo && !st.extra && casa && casa.garaje) posY[-1] = objetivoY(-1) - 5;
      st.extra = nuevo;
      aplicar();
    },
    visitar,
    // pantalla de juego
    setFoco(nivel) { const n = nivel ?? null; if (n !== st.foco) { st.foco = n; centrar(); aplicar(); } },
    // el cajón abierto: el piso que miras, de cerca, encima del cajón
    setCerca(cerca) { st.cerca = !!cerca; },
    // «Mi parte»: { cuartos: ['habitacion1', …], dias: { habitacion1: 3, … } } o null para volver a la casa de los tres
    setParte(parte) {
      const nueva = juego && parte && Array.isArray(parte.cuartos) && parte.cuartos.length
        ? { cuartos: parte.cuartos.slice(), dias: { ...(parte.dias || {}) }, brillo: { ...(parte.brillo || {}) }, foco: parte.foco || null }
        : null;
      const antes = st.parte ? st.parte.cuartos.join(',') : '';
      const focoAntes = st.parte ? st.parte.foco : null;
      const cambia = !st.parte !== !nueva || (nueva && nueva.foco !== focoAntes);
      st.parte = nueva;
      if ((nueva ? nueva.cuartos.join(',') : '') !== antes) ponerParte();
      else if (nueva && nueva.foco !== focoAntes) ponerMarco();
      if (cambia) { st.zoom = 1; st.pan.set(0, 0); }
      aplicar();
    },
    setBurbujas(lista) { st.burbujas = lista || []; if (juego) { pintarBurbujas(); moverEtiquetas(); } },
    setLuz(luz) { st.luz = luz || null; aplicarLuz(); },
    setMargenes(m) { st.margenes = { ...st.margenes, ...m }; },
    cielo() { return cieloArriba; },
    nivelDe(id) { const piso = TURNOS[id]; return piso && PISOS[piso] ? PISOS[piso].nivel : null; },
    retratos,
    girar(delta) { st.az += delta; },
    acercar(f) { st.zoom = Math.min(4, Math.max(0.8, st.zoom * f)); if (st.zoom <= 1.001) st.pan.set(0, 0); },
    centrar,
    renderizar() { return paso(); },
    asentar() { for (let i = 0; i < 80; i++) paso(true); paso(); },
    estado: st,
    // la app lo para cuando no se ve la pantalla de Limpieza y lo vuelve a poner al volver
    pausar() { cancelAnimationFrame(raf); raf = 0; },
    seguir() { if (!raf && !opciones.captura) { medir(); raf = requestAnimationFrame(bucle); } },
    destruir() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      if (casa) {
        for (const p of plantasConGaraje()) liberar(p.grupo);
        liberar(casa.tejado.grupo);
        if (casa.jardin) liberar(casa.jardin.grupo);
        if (casa.parte) liberar(casa.parte.grupo);
      }
      for (const m of Object.values(monigotes)) m.liberar();
      renderer.dispose();
    },
  };
}
