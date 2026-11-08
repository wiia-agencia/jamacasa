// La Jamacasa en 3D: datos sacados de los planos (borrador 4, 7 nov 2026).
// Medidas en metros y a ojo. x crece hacia el este, y hacia el sur (el norte es la pared del portón).

export const ALTURA = 2.8;        // de suelo a suelo
export const MURO_ALTO = 2.5;     // paredes de atrás
export const MURO_BAJO = 0.85;    // paredes cortadas (las de delante y las de dentro)
export const PIEDRA_SUBE = 0.45;  // en la planta 2 el bloque de piedra está unos escalones más alto

export const PERSONAS = {
  javi: { id: 'javi', nombre: 'Javi', color: '#d96a14' },
  jose: { id: 'jose', nombre: 'José', color: '#2f8f5b' },
  josu: { id: 'josu', nombre: 'Josu', color: '#2f6fb0' },
};
export const ORDEN_PERSONAS = ['javi', 'jose', 'josu'];

export const PISOS = {
  abajo: { id: 'abajo', nombre: 'Piso de abajo', corto: 'Abajo', nivel: 0 },
  medio: { id: 'medio', nombre: 'Piso del medio', corto: 'Medio', nivel: 1 },
  arriba: { id: 'arriba', nombre: 'Piso de arriba', corto: 'Arriba', nivel: 2 },
};

// Semana de ejemplo para enseñar la idea
export const TURNOS = { javi: 'arriba', jose: 'medio', josu: 'abajo' };

export const ESTADOS = {
  sucio: { nombre: 'Sin limpiar', tono: 'mal' },
  limpiando: { nombre: 'Limpiando', tono: 'medio' },
  esperando: { nombre: 'Esperando nota', tono: 'info' },
  limpio: { nombre: 'Limpio', tono: 'bien' },
};

export const MOMENTOS = {
  lunes: { id: 'lunes', nombre: 'Lunes', estados: { arriba: 'sucio', medio: 'sucio', abajo: 'sucio' } },
  miercoles: { id: 'miercoles', nombre: 'Miércoles', estados: { arriba: 'sucio', medio: 'esperando', abajo: 'limpiando' } },
  domingo: { id: 'domingo', nombre: 'Domingo', estados: { arriba: 'limpio', medio: 'limpio', abajo: 'limpio' } },
};

const S = (x0, y0, x1, y1, suelo, o = {}) => ({ x0, y0, x1, y1, suelo, ...o });
const M = (x0, y0, x1, y1, lado, material, huecos = [], o = {}) => ({ x0, y0, x1, y1, lado, material, huecos, ...o });
const h = (desde, hasta, tipo = 'puerta') => ({ desde, hasta, tipo });
const C = (t, x0, y0, x1, y1, o = {}) => ({ t, x0, y0, x1, y1, ...o });
const P = PIEDRA_SUBE;

const COLUMNAS_PORCHE = [
  C('columna', 10.85, -1.95, 11.15, -1.65),
  C('columna', 19.15, -1.95, 19.45, -1.65),
  C('columna', 19.15, 4.85, 19.45, 5.15),
];

export const PLANTAS = [
  {
    nivel: 0, piso: 'abajo', nombre: 'Planta −1',
    suelos: [
      S(0, 0, 11, 9, 'suelo_cemento'),
      S(11, 0, 17.5, 9, 'suelo_baldosa'),
      S(11, -1.8, 17.5, 0, 'suelo_porche', { fuera: true }),
      S(17.5, -1.8, 19.3, 5, 'suelo_porche', { fuera: true }),
    ],
    muros: [
      M(0, 0, 11, 0, 'n', 'piedra', [h(0.9, 1.9, 'ventana'), h(3.8, 6.5, 'porton'), h(8.4, 9.4, 'ventana')]),
      M(0, 0, 0, 9, 'w', 'piedra'),
      M(0, 9, 11, 9, 's', 'piedra'),
      M(11, 0, 17.5, 0, 'n', 'liso', [h(15.3, 16.5, 'ventana')]),
      M(17.5, 0, 17.5, 9, 'e', 'liso', [h(1.1, 1.95, 'puerta'), h(7.9, 8.7, 'ventana')]),
      M(11, 9, 17.5, 9, 's', 'liso'),
      M(11, 0, 11, 9, 'int', 'piedra', [h(7.3, 8.2)]),
      M(6.7, 0, 6.7, 4.2, 'int', 'interior', [h(2.6, 3.4)]),
      M(6.7, 4.2, 11, 4.2, 'int', 'interior'),
      M(14.9, 6.95, 14.9, 9, 'int', 'interior'),
      M(14.9, 6.95, 17.5, 6.95, 'int', 'interior', [h(15.1, 15.9)]),
    ],
    cosas: [
      C('lena', 0.35, 0.35, 2.3, 2.5),
      C('moto', 2.55, 0.45, 3.05, 2.35, { color: 'negro' }),
      C('moto', 3.2, 0.45, 3.7, 2.35, { color: 'pelota' }),
      C('caldera', 8.65, 0.5, 9.35, 1.2),
      C('pingpong', 4.3, 4.7, 7.04, 6.22),
      C('bicis', 0.35, 3.1, 1.35, 6.0),
      C('arcon', 0.35, 6.3, 1.35, 7.1),
      C('estanteria', 2.4, 8.12, 8.4, 8.72),
      C('pilar', 2.9, 3.25, 3.2, 3.55), C('pilar', 2.9, 6.4, 3.2, 6.7), C('pilar', 8.15, 6.4, 8.45, 6.7),
      C('encimera', 11.19, 0.14, 11.79, 3.8, { mira: 'e', fuegos: [[11.49, 1.3], [11.49, 1.75], [11.49, 2.2]] }),
      C('nevera', 11.19, 3.88, 11.84, 4.53, { mira: 'e' }),
      C('encimera', 11.79, 0.14, 12.4, 0.74, { mira: 's' }),
      C('cocinalena', 12.4, 0.14, 13.6, 0.84),
      C('encimera', 13.6, 0.14, 17.36, 0.74, { mira: 's', fregadero: [15.3, 0.44] }),
      C('mesa', 13.65, 2.5, 14.65, 4.5, { sillas: 3, eje: 'v' }),
      C('sofa', 16.5, 5.15, 17.36, 6.85, { respaldo: 'e', tela: 'tela2' }),
      C('ducha', 16.56, 8.06, 17.36, 8.86),
      C('lavabo', 16.9, 7.08, 17.36, 7.66, { mira: 'w' }),
      C('inodoro', 15.88, 8.2, 16.3, 8.86, { mira: 'n' }),
      ...COLUMNAS_PORCHE,
      C('coche', 17.65, 0.3, 19.15, 4.5),
    ],
    escaleras: [
      { t: 'tramo', x0: 16.15, y0: 2.05, x1: 17.25, y1: 5.0, sube: 's', desde: 0, hasta: ALTURA, pasos: 15 },
    ],
    barandas: [],
    suciedad: [[11.4, 1.2, 15.9, 6.8, 0], [15.1, 7.15, 17.2, 7.9, 0]],
    sitios: { pie: [15.2, 5.7, 'n'], barrer: [14.9, 5.9, 'n'], esperar: [15.2, 5.7, 'n'], relax: { pose: 'cocinar', x: 13.0, y: 1.3, mira: 'n' } },
  },
  {
    nivel: 1, piso: 'medio', nombre: 'Planta 1',
    suelos: [
      S(11, 0, 16.1, 6, 'suelo_madera'), S(16.1, 0, 17.5, 2.05, 'suelo_madera'), S(16.1, 5.0, 17.5, 6, 'suelo_madera'),
      S(11, 6, 17.5, 9, 'suelo_baldosa'),
      S(11, -1.8, 17.5, 0, 'suelo_terraza'), S(17.5, -1.8, 19.3, 5, 'suelo_terraza'),
    ],
    muros: [
      M(11, 0, 17.5, 0, 'n', 'liso', [h(12.0, 15.9, 'ventanal')]),
      M(17.5, 0, 17.5, 9, 'e', 'liso', [h(0.5, 1.9, 'puerta')]),
      M(11, 9, 17.5, 9, 's', 'liso', [h(11.4, 12.4)]),
      M(11, 6, 17.5, 6, 'int', 'interior', [h(11.4, 12.3)]),
    ],
    cosas: [
      C('bloque', 0, 0, 11, 9, { ventanas: [[1.5, 2.5], [5.0, 6.0], [8.4, 9.4]] }),
      C('zen', 11.35, 0.35, 15.55, 2.05, { cojines: [[11.95, 1.72, 0.26], [12.55, 1.75, 0.26], [15.15, 1.65, 0.28]] }),
      C('mesa', 12.2, 2.8, 14.2, 3.8, { sillas: 3, eje: 'h' }),
      C('vitrina', 15.15, 5.5, 15.95, 5.92, { mira: 'n' }),
      C('mueble', 13.3, 8.48, 15.1, 8.86, { mira: 'n' }),
      C('planta', 11.25, 5.2, 11.75, 5.7),
      ...COLUMNAS_PORCHE,
    ],
    escaleras: [
      { t: 'tramo', x0: 12.9, y0: 6.1, x1: 15.9, y1: 7.15, sube: 'e', desde: 0, hasta: 1.32, pasos: 8 },
      { t: 'giro', x0: 15.9, y0: 6.1, x1: 17.3, y1: 8.45, sube: 's', desde: 1.32, hasta: 1.485, pasos: 1, volado: true },
      { t: 'tramo', x0: 12.9, y0: 7.35, x1: 15.9, y1: 8.45, sube: 'w', desde: 1.485, hasta: ALTURA, pasos: 8, volado: true },
    ],
    barandas: [
      { puntos: [[16.08, 2.05], [16.08, 5.0]] },
      { puntos: [[11, -1.8], [19.3, -1.8], [19.3, 5.0], [17.5, 5.0]], tipo: 'balaustrada' },
    ],
    suciedad: [[11.4, 2.3, 15.9, 5.8, 0], [11.2, 6.3, 12.7, 8.7, 0], [11.3, -1.6, 17.2, -0.3, 0], [17.7, -1.5, 19.0, 4.7, 0]],
    sitios: { pie: [14.6, 4.8, 'n'], barrer: [14.4, 4.7, 'n'], esperar: [14.6, 4.8, 'n'], relax: { pose: 'meditar', x: 12.55, y: 1.75, mira: 'n' } },
  },
  {
    nivel: 2, piso: 'arriba', nombre: 'Planta 2',
    suelos: [
      S(11, 0, 17.5, 3.9, 'suelo_madera'), S(11, 3.9, 14.3, 6, 'suelo_madera'),
      S(14.3, 3.9, 17.5, 6, 'suelo_baldosa'),
      S(11, 6, 15.9, 7.3, 'suelo_madera'), S(11, 7.3, 12.9, 9, 'suelo_madera'),
      S(6.6, 0, 11, 4.2, 'suelo_baldosa', { base: P }),
      S(4.6, 0, 6.6, 4.2, 'suelo_baldosa', { base: P }),
      S(0, 0, 4.6, 4.2, 'suelo_madera', { base: P }),
      S(3.8, 4.2, 11, 5.4, 'suelo_madera', { base: P }),
      S(7.4, 5.4, 11, 9, 'suelo_baldosa', { base: P }),
      S(3.8, 5.4, 7.4, 9, 'suelo_madera', { base: P }),
      S(0, 4.2, 3.8, 9, 'suelo_madera', { base: P }),
    ],
    muros: [
      M(0, 0, 11, 0, 'n', 'piedra', [h(1.6, 2.8, 'ventana'), h(5.2, 5.9, 'ventana'), h(8.4, 9.6, 'ventana')], { base: P }),
      M(0, 0, 0, 9, 'w', 'piedra', [], { base: P }),
      M(0, 9, 11, 9, 's', 'piedra', [h(1.4, 2.2, 'ventana'), h(4.6, 5.8, 'ventana'), h(8.0, 9.0, 'ventana')], { base: P }),
      M(11, 0, 17.5, 0, 'n', 'liso', [h(13.4, 15.6, 'ventana')]),
      M(17.5, 0, 17.5, 9, 'e', 'liso', [h(4.1, 4.9, 'ventana')]),
      M(11, 9, 17.5, 9, 's', 'liso'),
      M(11, 0, 11, 9, 'int', 'piedra', [h(4.3, 5.3, 'paso')]),
      M(11, 6, 14.3, 6, 'int', 'interior', [h(11.1, 12.85, 'paso')]),
      M(14.3, 3.9, 17.5, 3.9, 'int', 'interior'),
      M(14.3, 3.9, 14.3, 6, 'int', 'interior', [h(4.35, 5.15)]),
      M(14.3, 6, 17.5, 6, 'int', 'interior'),
      M(6.6, 0, 6.6, 4.2, 'int', 'interior', [], { base: P }),
      M(6.6, 4.2, 11, 4.2, 'int', 'interior', [h(9.6, 10.4)], { base: P }),
      M(4.6, 0, 4.6, 4.2, 'int', 'interior', [], { base: P }),
      M(4.6, 4.2, 6.6, 4.2, 'int', 'interior', [h(4.8, 5.6)], { base: P }),
      M(0, 4.2, 4.6, 4.2, 'int', 'interior', [h(3.9, 4.5)], { base: P }),
      M(3.8, 4.2, 3.8, 9, 'int', 'interior', [h(4.35, 5.15)], { base: P }),
      M(3.8, 5.4, 7.4, 5.4, 'int', 'interior', [h(6.4, 7.2)], { base: P }),
      M(7.4, 5.4, 7.4, 9, 'int', 'interior', [], { base: P }),
    ],
    cosas: [
      C('chimenea', 11.19, 0.14, 12.64, 0.84),
      C('alfombra', 13.4, 1.25, 16.25, 3.6, { color: 'alfombra1' }),
      C('mesabaja', 14.3, 1.55, 15.5, 2.2),
      // un sofá pegado a la pared de la ventana, otro a la pared de enfrente de la tele y una butaca suelta en la esquina
      C('sofa', 13.95, 0.14, 16.25, 1.04, { respaldo: 'n', tela: 'tela1' }),
      C('butaca', 16.42, 0.14, 17.36, 1.08, { mira: 'sw', tela: 'tela1' }),
      C('sofa', 16.46, 1.22, 17.36, 3.5, { respaldo: 'e', tela: 'tela1' }),
      // la tele (de unas 75 pulgadas) y su mueble, a la derecha de la pared, lejos del paso a las habitaciones
      C('muebletv', 11.28, 1.15, 11.73, 3.25, { tele: 'w', play: true, teleAncho: 1.68 }),
      C('ducha', 16.6, 4.05, 17.35, 4.85),
      C('inodoro', 16.84, 5.25, 17.26, 5.92, { mira: 'n' }),
      C('lavabo', 15.0, 5.45, 15.6, 5.92, { mira: 'n' }),
      // al subir la escalera: en la pared de enfrente, a la derecha de la escalera
      C('vitrina', 11.19, 6.1, 11.61, 7.3, { mira: 'e' }),
      C('planta', 14.6, 6.25, 15.0, 6.65),
      C('encimera', 6.68, 0.19, 10.81, 0.79, { mira: 's', fregadero: [9.2, 0.49], base: P }),
      // la otra L: encimera de mesa con la lavadora y el lavavajillas debajo
      C('encimera', 6.68, 0.79, 7.28, 2.2, { mira: 'e', electros: ['lavadora', 'lavavajillas'], tapa: 'madera', base: P }),
      C('encimera', 10.21, 0.79, 10.81, 3.0, { mira: 'w', fuegos: [[10.51, 1.25], [10.51, 1.7]], base: P }),
      C('nevera', 6.68, 3.47, 7.33, 4.12, { mira: 'e', base: P }),
      C('mesa', 7.9, 2.6, 9.1, 3.4, { sillas: 2, eje: 'h', base: P }),
      C('ducha', 5.75, 0.3, 6.45, 1.3, { base: P }),
      C('inodoro', 4.84, 0.25, 5.26, 0.92, { mira: 's', base: P }),
      C('lavabo', 4.68, 1.5, 5.14, 2.1, { mira: 'e', base: P }),
      C('cama', 1.4, 0.3, 3.0, 2.3, { cabecero: 'n', funda: 'funda1', base: P }),
      C('escritorio', 0.25, 1.2, 0.85, 3.2, { mira: 'e', base: P }),
      C('muebletv', 1.0, 3.6, 3.2, 4.0, { tele: 's', base: P }),
      C('cama', 3.95, 7.15, 5.95, 8.7, { cabecero: 'w', funda: 'funda2', base: P }),
      C('armario', 4.1, 5.5, 5.6, 6.05, { mira: 's', base: P }),
      C('telepared', 7.22, 7.4, 7.32, 8.4, { base: P }),
      C('cama', 0.25, 4.4, 2.25, 5.4, { cabecero: 'w', funda: 'funda3', base: P }),
      C('armario', 3.15, 6.6, 3.72, 8.75, { mira: 'w', base: P }),
      C('alfombra', 7.75, 6.45, 9.45, 7.75, { color: 'alfombra2', base: P }),
    ],
    escaleras: [
      { t: 'tramo', x0: 10.05, y0: 4.3, x1: 11.0, y1: 5.3, sube: 'w', desde: 0, hasta: P, pasos: 3 },
      { t: 'tramo', x0: 9.1, y0: 8.0, x1: 9.9, y1: 8.85, sube: 'e', desde: P, hasta: P + 0.35, pasos: 3 },
      { t: 'giro', x0: 9.9, y0: 7.85, x1: 10.95, y1: 8.85, sube: 'n', desde: P + 0.35, hasta: P + 0.6, pasos: 2 },
      { t: 'tramo', x0: 9.9, y0: 5.95, x1: 10.95, y1: 7.85, sube: 'n', desde: P + 0.6, hasta: P + ALTURA, pasos: 9 },
    ],
    barandas: [
      { puntos: [[12.9, 7.3], [15.9, 7.3], [15.9, 6.0]] },
      { puntos: [[9.84, 5.95], [9.84, 7.85]], base: P },
    ],
    suciedad: [[11.4, 1.95, 16.2, 5.8, 0], [11.2, 6.2, 12.7, 8.7, 0], [7.0, 1.0, 9.9, 4.0, P], [4.0, 4.4, 10.6, 5.25, P], [7.6, 5.6, 9.6, 7.9, P]],
    sitios: { pie: [13.0, 5.0, 'n'], barrer: [13.4, 4.7, 'n'], esperar: [13.0, 5.0, 'n'], relax: { pose: 'play', x: 16.92, y: 2.5, mira: 'w' } },
  },
];

// Tejados (encima del piso de José, que va cerrado)
export const TEJADOS = {
  piedra: { x0: -0.45, x1: 11.0, y0: -0.45, y1: 9.45, alto: 2.3 },
  nuevo: { x0: 10.8, x1: 18.0, y0: -0.6, y1: 9.6, alto: 2.1 },
  chimenea: [11.6, 0.35, 12.5, 1.0],
  claraboya: [7.6, 1.2, 8.7, 2.1],
};

export const JARDIN = {
  x0: -3.2, y0: -5.6, x1: 22.0, y1: 11.2,
  arbol: [6.6, -3.0],
  pelota: [14.6, -3.9],
  arbustos: [[-1.6, 9.4], [20.7, 8.8], [-1.9, -4.0], [21.0, -3.9], [9.5, 10.3]],
};

// ---------- Lo que se limpia ----------
// Zonas de limpieza de cada planta (lo demás no se dibuja en esta vista).
// abajo: cocina, baño y escalera · medio: entrada, salón y escalera · arriba: salón (con la entradilla) y cocina
export const FOCO = {
  0: { zonas: [[11, 0, 17.5, 9]] },
  1: { zonas: [[11, 0, 17.5, 9]], muros: [M(11, 0, 11, 9, 'w', 'piedra')] },
  2: {
    zonas: [[11, 0, 17.5, 9], [6.6, 0, 11, 4.2], [9.4, 4.2, 11, 5.4]],
    cerrados: [[14.3, 3.9, 17.5, 6, 0, 'Baño']],   // cada uno limpia el suyo
  },
};

// El garaje no entra en la rotación: es una tarea extra que sale cuando alguien se apunta
export const GARAJE = {
  nombre: 'Garaje', puntos: 15,
  zonas: [[0, 0, 11, 9]],
  desplazar: 6.6,
  suciedad: [[0.6, 2.7, 6.4, 7.9, 0], [3.3, 6.8, 8.0, 7.95, 0]],
  sitios: { pie: [9.6, 5.5, 'n'], barrer: [9.6, 5.5, 'n'], esperar: [9.6, 5.5, 'n'], relax: { pose: 'pie', x: 9.6, y: 5.5, mira: 'n' } },
};

// ---------- Escenas para enseñar el juego ----------
// Cada piso: [estado, nivel]
//   sucio → nivel = semanas sin limpiar (0 = lo normal de la semana, 1, 2, 3 o más)
//   limpio → nivel = brillo según la nota (1 limpio, 2 muy limpio, 3 reluciente)
// Cada persona: acción (lo que está haciendo) e insignias (lo que lleva encima)
// Escenas: qué pasa en cada piso y qué hace cada uno. La app pone la suya con setEscena(objeto);
// la página de propuestas añade sus ejemplos (escenas.js).
export const ESCENAS = {
  vacia: { nombre: 'Vacía', rey: null, pisos: { arriba: ['sucio', 0], medio: ['sucio', 0], abajo: ['sucio', 0] }, personas: {}, aviso: () => ['', ''] },
};

// La app dice quién vive en la casa (nombre y color) antes de crear el visor
export function configurarPersonas(lista) {
  for (const k of Object.keys(PERSONAS)) delete PERSONAS[k];
  ORDEN_PERSONAS.length = 0;
  for (const p of lista) { PERSONAS[p.id] = { id: p.id, nombre: p.nombre, color: p.color }; ORDEN_PERSONAS.push(p.id); }
}

// y en qué piso está cada uno esta semana
export function ponerTurnos(turnos) {
  for (const k of Object.keys(TURNOS)) delete TURNOS[k];
  Object.assign(TURNOS, turnos);
}
