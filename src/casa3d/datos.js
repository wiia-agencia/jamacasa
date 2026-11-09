// La Jamacasa en 3D: datos sacados de los planos (borrador 4, 7 nov 2026) y del último vídeo de la casa (9 nov).
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
const h = (desde, hasta, tipo = 'puerta', o = {}) => ({ desde, hasta, tipo, ...o });
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
    // por dónde va el brillo de «tu piso» en la casa entera
    zonasHalo: [[0, 0, 17.5, 9], [11, -1.8, 19.3, 0], [17.5, -1.8, 19.3, 5]],
    suelos: [
      // el garaje llega hasta el pasillo: detrás de la pared del fondo del salón, a la izquierda del pasillo
      S(0, 0, 11, 9, 'suelo_cemento'), S(11, 6.95, 13.3, 9, 'suelo_cemento'),
      // baldosa de barro en todo el piso (cocina, salón, pasillo y baño)
      S(11, 0, 17.5, 6.95, 'suelo_barro'), S(13.3, 6.95, 17.5, 9, 'suelo_barro'),
      S(11, -1.8, 17.5, 0, 'suelo_porche', { fuera: true }),
      S(17.5, -1.8, 19.3, 5, 'suelo_porche', { fuera: true }),
    ],
    muros: [
      M(0, 0, 11, 0, 'n', 'piedra', [h(0.9, 1.9, 'ventana'), h(3.8, 6.5, 'porton'), h(8.4, 9.4, 'ventana')]),
      M(0, 0, 0, 9, 'w', 'piedra'),
      M(0, 9, 11, 9, 's', 'piedra'),
      // la cocina va alicatada de blanco (por dentro)
      M(11, 0, 17.5, 0, 'n', 'liso', [h(15.3, 16.5, 'ventana')], { revestido: { cara: 's', material: 'azulejo' } }),
      // la ventana con el radiador, debajo de lo alto de la escalera y en la esquina del sofá;
      // y en el baño, la ventanita que se abre desde la ducha
      M(17.5, 0, 17.5, 6.95, 'e', 'liso', [h(1.1, 1.95, 'puerta'), h(5.3, 6.4, 'ventana')]),
      M(17.5, 6.95, 17.5, 9, 'e', 'liso', [h(7.95, 8.65, 'ventanuco')], { revestido: { cara: 'w', material: 'azulejo' } }),
      M(11, 9, 13.3, 9, 's', 'piedra'),
      M(13.3, 9, 15.0, 9, 's', 'liso'),
      M(15.0, 9, 17.5, 9, 's', 'liso', [], { revestido: { cara: 'n', material: 'azulejo' } }),
      M(11, 0, 11, 6.95, 'int', 'piedra', [], { revestido: { cara: 'e', material: 'azulejo' } }),
      M(6.7, 0, 6.7, 4.2, 'int', 'interior', [h(2.6, 3.4)]),
      M(6.7, 4.2, 11, 4.2, 'int', 'interior'),
      // la pared del fondo del salón (detrás, el garaje) y el pasillo del garaje, pegado al baño: a la derecha,
      // la puerta del garaje, y al fondo, el armario empotrado, a ras de la pared (Javi, 9 de noviembre)
      M(11, 6.95, 13.3, 6.95, 'int', 'interior'),
      M(13.3, 6.95, 13.3, 9, 'int', 'interior', [h(7.55, 8.25, 'puerta', { rotulo: 'garaje' })]),
      M(13.6, 8.6, 14.7, 8.6, 's', 'liso', [h(13.38, 14.93, 'armario', { cara: 'n', puertas: 'cerezo' })], { grosor: 0.6 }),
      // el baño: lo que el sofá más la puerta. Su puerta, nada más pasar el pasillo; dentro, el lavabo delante,
      // pegado el váter y pegada la ducha, contra la ventanita. Nada más
      M(15.0, 6.95, 15.0, 9, 'int', 'interior', [], { revestido: { cara: 'e', material: 'azulejo' } }),
      M(15.0, 6.95, 17.5, 6.95, 'int', 'interior', [h(15.06, 15.84, 'puerta', { rotulo: 'baño' })], { revestido: { cara: 's', material: 'azulejo' } }),
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
      // cocina: muebles forrados de ladrillo con puertas de madera y encimera de granito rosa.
      // La del fregadero acaba debajo de la ventana; después, el radiador.
      C('encimera', 11.19, 0.14, 16.05, 0.74, { mira: 's', fregadero: [15.35, 0.44], frente: 'ladrillo', puertas: 'madera', tapa: 'granito' }),
      C('radiador', 16.2, 0.14, 16.9, 0.22, { mira: 's' }),
      // en la pared del garaje: la cocina de leña con su campana de azulejo, la vitro con el horno y su campana, y la nevera
      C('cocinalena', 11.19, 0.86, 11.89, 1.95, { mira: 'e' }),
      C('campana', 11.17, 0.72, 11.97, 2.1, { mira: 'e', tipo: 'obra' }),
      C('encimera', 11.19, 1.95, 11.79, 3.8, { mira: 'e', vitro: [11.49, 2.7], horno: [11.49, 2.7], frente: 'ladrillo', puertas: 'madera', tapa: 'granito' }),
      C('campana', 11.17, 2.42, 11.67, 2.98, { mira: 'e' }),
      C('altos', 11.17, 3.02, 11.52, 3.8, { mira: 'e', color: 'madera_osc', puertas: 'madera' }),
      C('micro', 11.24, 3.3, 11.68, 3.74, { mira: 'e', color: 'pelota', base: 0.92 }),
      C('nevera', 11.19, 3.88, 11.84, 4.53, { mira: 'e', color: 'metal' }),
      // el mueble de madera de la pared del garaje (el armario empotrado del pasillo va con su pared, en muros)
      C('mueble', 11.19, 5.15, 11.64, 6.75, { mira: 'e', alto: 0.85 }),
      C('mesa', 13.65, 2.5, 14.65, 4.5, { sillas: 3, eje: 'v' }),
      // el sofá, de dos plazas, ocupa toda la pared del baño: de la esquina de la ventana a la puerta
      C('sofa', 15.9, 6.05, 17.36, 6.88, { respaldo: 's', tela: 'tela_gris' }),
      C('radiador', 17.3, 5.45, 17.38, 6.0, { mira: 'w' }),
      // el baño: nada más abrir la puerta, el lavabo con su espejo delante; pegado, el váter, y pegada a él,
      // la ducha, contra la pared de la ventanita (se abre desde dentro de la ducha)
      C('lavabo', 15.1, 8.42, 16.02, 8.86, { mira: 'n', mueble: true, color: 'ladrillo', puertas: 'cerezo', tapa: 'granito' }),
      C('espejo', 15.16, 8.86, 15.96, 8.88, { mira: 'n', marco: 'cerezo' }),
      C('inodoro', 16.12, 8.2, 16.54, 8.86, { mira: 'n' }),
      C('ducha', 16.64, 8.0, 17.37, 8.86),
      // debajo de la escalera, una puertita para aprovechar el hueco (lo de dentro da igual)
      C('puertita', 16.08, 3.72, 16.15, 4.44, { mira: 'w', alto: 1.05 }),
      ...COLUMNAS_PORCHE,
      C('coche', 17.65, 0.3, 19.15, 4.5),
    ],
    // la escalera llega hasta encima de la ventana: la parte de arriba va al aire, con la curva por debajo,
    // y el sofá empieza justo después, en la esquina
    escaleras: [
      { t: 'tramo', x0: 16.15, y0: 2.05, x1: 17.25, y1: 4.65, sube: 's', desde: 0, hasta: ALTURA * 10 / 15, pasos: 10, huella: 'suelo_barro', cenefa: true, barandilla: 'w' },
      { t: 'tramo', x0: 16.15, y0: 4.65, x1: 17.25, y1: 5.95, sube: 's', desde: ALTURA * 10 / 15, hasta: ALTURA, pasos: 5, volado: true, bajo: 'interior', huella: 'suelo_barro', cenefa: true, barandilla: 'w' },
    ],
    barandas: [],
    suciedad: [[11.9, 1.0, 15.9, 5.9, 0], [15.12, 7.12, 17.3, 7.95, 0], [13.52, 7.1, 14.86, 8.15, 0]],
    // lo primero que aparece después de limpiar: el lunes una camiseta y un papel; el martes, un charco en la cocina
    primeros: { ropa: [12.6, 5.6], papel: [15.55, 2.1], charco: [12.55, 2.45] },
    sitios: { pie: [15.0, 5.45, 'n'], barrer: [14.6, 5.5, 'n'], esperar: [15.0, 5.45, 'n'], relax: { pose: 'cocinar', x: 12.3, y: 2.7, mira: 'w' } },
  },
  {
    nivel: 1, piso: 'medio', nombre: 'Planta 1',
    suelos: [
      // baldosa de barro en el salón; la entrada, clara y con su cenefa
      S(11, 0, 16.1, 6, 'suelo_barro'), S(16.1, 0, 17.5, 2.05, 'suelo_barro'),
      S(11, 6, 17.5, 9, 'suelo_baldosa'),
      S(11, -1.8, 17.5, 0, 'suelo_terraza'), S(17.5, -1.8, 19.3, 5, 'suelo_terraza'),
    ],
    muros: [
      // la esquina del salón va achaflanada: pared, chaflán (el del Buda) y la pared del ventanal
      M(12.05, 0, 17.5, 0, 'n', 'liso', [h(12.2, 15.9, 'ventanal')]),
      M(11, 1.05, 12.05, 0, 'n', 'liso', [], { diagonal: true, esquina: [11, 0] }),
      M(17.5, 0, 17.5, 9, 'e', 'liso', [h(0.5, 1.9, 'puerta')]),
      M(11, 9, 17.5, 9, 's', 'liso', [h(11.4, 12.4, 'puerta', { hoja: 'blanco', rotulo: 'calle' })]),
      M(11, 6, 17.5, 6, 'int', 'interior', [h(11.4, 12.3)]),
    ],
    cosas: [
      C('bloque', 0, 0, 11, 9, { ventanas: [[1.5, 2.5], [5.0, 6.0], [8.4, 9.4]] }),
      // la zona zen: la alfombra de rayas, los cojines, los pufs y, en el chaflán, el mueble blanco con el Buda,
      // el bambú y las cañas; en la otra esquina, la planta grande en su pie y la figura de madera
      C('zen', 12.2, 0.5, 15.3, 2.05, { rayas: true, cojines: [[12.75, 1.62, 0.26], [13.35, 1.68, 0.26], [14.8, 1.55, 0.28]], planta: [15.6, 0.45] }),
      C('zenmueble', 11.2, 0.2, 12.35, 1.35, { esquina: 'nw', centro: [11.77, 0.77], ancho: 1.2, fondo: 0.45, canas: true }),
      C('puf', 14.9, 0.62, 15.4, 1.12, { color: 'funda1', color2: 'alfombra1' }),
      C('puf', 15.45, 1.0, 15.9, 1.45, { color: 'tela2', color2: 'funda3' }),
      C('planta', 16.15, 0.14, 16.6, 0.59, { pie: 0.35 }),
      C('estatua', 16.85, 0.14, 17.2, 0.49),
      C('mesa', 12.2, 2.8, 14.2, 3.8, { sillas: 3, eje: 'h', tapa: 'blanco', patas: 'blanco', silla: 'tela_oscura', sillaPatas: 'negro' }),
      // el mueble blanco al lado de la escalera
      C('vitrina', 15.0, 5.5, 15.95, 5.92, { mira: 'n', color: 'blanco', bajo: 0.85, alto: 1.95 }),
      C('planta', 11.25, 5.2, 11.75, 5.7),
      // la entrada: el zapatero negro con la lámpara junto a la puerta de la calle y la cenefa del suelo.
      // Debajo de la escalera, al fondo, el «doble fondo» de los zapatos con su puertita (por la cadera)
      C('zapatero', 12.5, 8.5, 13.3, 8.9, { mira: 'n' }),
      C('cenefa', 11.15, 6.12, 12.78, 8.88),
      C('tabique', 15.15, 7.85, 15.525, 8.95, { alto: 1.51 }),
      C('tabique', 15.525, 7.85, 15.9, 8.95, { alto: 1.35 }),
      C('tabique', 15.9, 6.1, 17.3, 8.95, { alto: 1.185 }),
      C('puertita', 15.09, 7.98, 15.15, 8.68, { mira: 'w', alto: 1.0 }),
      ...COLUMNAS_PORCHE,
    ],
    escaleras: [
      // escalones de baldosa con la tira de azulejo azul y barandilla de acero. El segundo tramo va pegado a la pared
      // de la calle y al aire, con el techo de madera por debajo (el inclinado que se ve al entrar)
      { t: 'tramo', x0: 12.9, y0: 6.1, x1: 15.9, y1: 7.15, sube: 'e', desde: 0, hasta: 1.32, pasos: 8, huella: 'suelo_baldosa', cenefa: true, barandilla: 's' },
      { t: 'giro', x0: 15.9, y0: 6.1, x1: 17.3, y1: 8.95, sube: 's', desde: 1.32, hasta: 1.485, pasos: 1, volado: true, huella: 'suelo_baldosa' },
      { t: 'tramo', x0: 12.9, y0: 7.85, x1: 15.9, y1: 8.95, sube: 'w', desde: 1.485, hasta: ALTURA, pasos: 8, volado: true, huella: 'suelo_baldosa', cenefa: true, barandilla: 'n' },
    ],
    barandas: [
      { puntos: [[16.08, 2.05], [16.08, 6.0]] },
      { puntos: [[11, -1.8], [19.3, -1.8], [19.3, 5.0], [17.5, 5.0]], tipo: 'balaustrada' },
    ],
    suciedad: [[11.4, 2.3, 15.9, 5.8, 0], [11.2, 6.3, 12.7, 8.7, 0], [11.3, -1.6, 17.2, -0.3, 0], [17.7, -1.5, 19.0, 4.7, 0]],
    primeros: { ropa: [15.1, 4.7], papel: [11.9, 4.6], charco: [14.9, 2.55] },
    sitios: { pie: [14.6, 4.8, 'n'], barrer: [14.4, 4.7, 'n'], esperar: [14.6, 4.8, 'n'], relax: { pose: 'meditar', x: 12.75, y: 1.62, mira: 'n' } },
  },
  {
    nivel: 2, piso: 'arriba', nombre: 'Planta 2',
    suelos: [
      // baldosa clara en el salón y la entradilla; tarima gris en la cocina
      S(11, 0, 17.5, 3.9, 'suelo_baldosa'), S(11, 3.9, 14.3, 6, 'suelo_baldosa'),
      S(14.3, 3.9, 17.5, 6, 'suelo_baldosa'),
      S(11, 6, 15.9, 7.3, 'suelo_baldosa'), S(11, 7.3, 12.9, 9, 'suelo_baldosa'),
      S(6.6, 0, 11, 4.2, 'suelo_laminado', { base: P }),
      S(4.6, 0, 6.6, 4.2, 'suelo_baldosa', { base: P }),
      S(0, 0, 4.6, 4.2, 'suelo_madera', { base: P }),
      S(3.8, 4.2, 11, 5.4, 'suelo_baldosa', { base: P }),
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
      // la chimenea va torcida en la esquina, entre la ventana y la tele; el tiro sube hasta el techo
      C('chimenea', 11.17, 0.12, 12.45, 1.4, { esquina: 'nw', lado: 1.0 }),
      C('chimeneacolumna', 11.17, 0.12, 12.2, 1.15, { esquina: 'nw', lado: 1.0, pared: 'n' }),
      C('alfombra', 13.4, 1.25, 16.25, 3.35, { color: 'alfombra_beige' }),
      C('mesabaja', 14.3, 1.55, 15.5, 2.2, { tapa: 'cerezo', patas: 'cerezo' }),
      // los sofás, grises: uno pegado a la pared de la ventana y otro a la de enfrente de la tele; la butaca, marrón y suelta en la esquina
      C('sofa', 14.25, 0.14, 16.25, 1.04, { respaldo: 'n', tela: 'tela_gris' }),
      C('butaca', 16.42, 0.14, 17.36, 1.08, { mira: 'sw', tela: 'tela_marron', brazos: 'cerezo' }),
      C('sofa', 16.46, 1.22, 17.36, 3.22, { respaldo: 'e', tela: 'tela_gris' }),
      // el piano, en la pared del baño de Josu
      C('piano', 14.85, 3.46, 16.2, 3.88, { mira: 'n' }),
      // la tele (de unas 75 pulgadas) es más ancha que su mueble
      C('muebletv', 11.28, 1.75, 11.73, 2.95, { tele: 'w', play: true, teleAncho: 1.68, color: 'cerezo' }),
      C('ducha', 16.6, 4.05, 17.35, 4.85),
      C('inodoro', 16.84, 5.25, 17.26, 5.92, { mira: 'n' }),
      C('lavabo', 15.0, 5.45, 15.6, 5.92, { mira: 'n' }),
      // al subir la escalera: la vitrina de las copas, en la pared de enfrente, a la derecha de la escalera, y el felpudo
      C('vitrina', 11.19, 6.2, 11.61, 7.2, { mira: 'e', color: 'cerezo', bajo: 0.55, alto: 1.7, contenido: 'copas' }),
      C('alfombra', 11.95, 7.6, 12.75, 8.2, { color: 'tela_marron' }),
      C('planta', 14.6, 6.25, 15.0, 6.65),
      // cocina: la encimera de la vitro acaba en la ventana (no llega a la otra pared);
      // en la pared de enfrente siguen el lavavajillas y la lavadora, con el micro encima; luego la mesa y la nevera
      C('encimera', 8.85, 0.19, 10.81, 0.79, { mira: 's', fregadero: [9.3, 0.49], base: P }),
      C('altos', 9.65, 0.12, 10.81, 0.47, { mira: 's', color: 'interior', puertas: 'blanco', base: P }),
      C('encimera', 10.21, 0.79, 10.81, 3.2, { mira: 'w', vitro: [10.51, 1.45], horno: [10.51, 1.45], base: P }),
      C('encimera', 6.68, 0.19, 7.28, 1.5, { mira: 'e', electros: ['lavavajillas', 'lavadora'], base: P }),
      C('micro', 6.74, 0.95, 7.2, 1.42, { mira: 'e', color: 'negro', base: P + 0.92 }),
      C('nevera', 6.68, 3.47, 7.33, 4.12, { mira: 'e', base: P }),
      C('mesa', 7.7, 2.3, 8.9, 3.1, { sillas: 2, eje: 'h', base: P, tapa: 'negro', patas: 'metal', silla: 'blanco', sillaPatas: 'metal' }),
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
      // el rellano de la escalera del desván: un mueblecito blanco, la alfombra y la escalera
      C('mueble', 7.45, 6.4, 7.9, 7.8, { mira: 'e', color: 'blanco', puertas: 'blanco', alto: 0.55, base: P }),
      C('alfombra', 7.95, 5.75, 9.6, 7.85, { color: 'alfombra2', base: P }),
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
    // donde se deja la basura: en la cocina, debajo de la ventana, entre donde acaba el fregadero y el lavavajillas
    // (un poco separada de la pared para que se vea por encima de la pared cortada)
    basura: [7.5, 0.5, 8.8, 1.85, P],
    primeros: { ropa: [12.7, 4.6], papel: [13.3, 2.9], charco: [9.6, 2.0, P] },
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
  // lo que se limpia abajo: cocina, salón, el pasillo del garaje y el baño (lo de detrás de la pared del fondo es garaje)
  0: { zonas: [[11, 0, 17.5, 6.95], [13.3, 6.95, 17.5, 9]] },
  // la terraza va con el salón del medio (Javi, 9 de noviembre)
  1: { zonas: [[11, 0, 17.5, 9], [11, -1.8, 17.5, 0], [17.5, -1.8, 19.3, 5]], muros: [M(11, 1.05, 11, 9, 'w', 'piedra')] },
  2: {
    // el salón con la entradilla, la cocina y el rellano de la escalera del desván, que también limpia el de arriba.
    // El pasillo de las habitaciones solo entra si el piso le toca a alguien que duerme ahí: la app lo dice con
    // escena.extras = { arriba: ['pasillo'] } (Javi, 9 de noviembre)
    zonas: [[11, 0, 17.5, 9], [6.6, 0, 11, 4.2], [9.4, 4.2, 11, 5.4], [7.4, 5.4, 11, 9]],
    extras: { pasillo: [[3.8, 4.2, 9.4, 5.4]] },
    cerrados: [[14.3, 3.9, 17.5, 6, 0, 'Baño']],   // cada uno limpia el suyo
  },
};

// El garaje no entra en la rotación: es una tarea extra que sale cuando alguien se apunta
export const GARAJE = {
  nombre: 'Garaje', puntos: 15,
  zonas: [[0, 0, 11, 9], [11, 6.95, 13.3, 9]],
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
