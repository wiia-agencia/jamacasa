// Cuatro maneras de dibujar la misma casa. Cambian formas, colores y luz; la casa y las reglas son las mismas.

const VIVOS = {
  suelo_madera: '#d49a58', suelo_baldosa: '#e2d9c8', suelo_cemento: '#aaa59c', suelo_porche: '#c9ae8a', suelo_terraza: '#d2b88f',
  losa: '#efe2c9', cesped: '#6cc04a', tierra: '#8f5d36', piedra: '#9a8f80', liso: '#e3cfa8', interior: '#efe6d6',
  cristal: '#79cdea', tejado: '#cf5638', chimenea_piedra: '#b3a48f', madera: '#c98745', madera_osc: '#8a5630',
  blanco: '#f8f6f0', metal: '#98a5b3', negro: '#2a2f3b', tela1: '#2f7be0', tela2: '#e8524a',
  funda1: '#f6b51c', funda2: '#25b38a', funda3: '#ef6f9a', almohada: '#ffffff', alfombra1: '#e85d5d', alfombra2: '#4d86e0',
  zen: '#3fb58a', cojin: '#f58a1f', ppverde: '#13a06a', fuego: '#ff6a00', coche: '#1f5fe0', coche_cristal: '#9fd6f2',
  rueda: '#262a33', pelota: '#e3243b', hoja: '#3fae3f', tronco: '#8a5a34', maceta: '#c8643a', planta: '#3aa64a',
  persiana: '#f2ede2', porton: '#5e6773', lena: '#8f5e36', agua: '#5fc7ef', carton: '#c29567', pantalon: '#3d4655',
  piel: '#eeb68e', pelo: '#3b2a20',
  // lo que salió del vídeo del 9 de noviembre: los colores de verdad de la casa
  tela_gris: '#8b9099', tela_oscura: '#545862', tela_marron: '#b5844e', cerezo: '#9a432c', granito: '#b98e80',
  ladrillo: '#b9693f', azulejo: '#eeeae2', suelo_barro: '#b8694a', suelo_laminado: '#cbbfae', alfombra_beige: '#dcc6a3',
  cenefa: '#3f63a8', dorado: '#e0ad2e',
};

export const ESTILOS = {
  juguete: {
    id: 'juguete', letra: 'A', nombre: 'Casita de juguete',
    resumen: 'Como una casa de muñecas de plástico: formas redondeadas, colores suaves y muñecos con cabeza grande.',
    aFavor: 'Es la que más se parece a un juego y la que mejor se lee en el móvil: se ve enseguida quién está dónde y qué está sucio.',
    enContra: 'Es la más «mona»; si la queréis más seria, la D.',
    redondeo: 0.07, voxel: 0, plano: false, bordes: false, rugosidad: 0.8, brilloMunecos: 0.35,
    luz: { cielo: '#ffffff', suelo: '#f0dcc2', hemi: 1.45, dir: 2.0, dirColor: '#fff2e0', amb: 0.25 },
    sombra: 0.24,
    paleta: {
      suelo_madera: '#e7c49b', suelo_baldosa: '#efe7da', suelo_cemento: '#d3cdc4', suelo_porche: '#d9c3a5', suelo_terraza: '#e4d2b4',
      losa: '#f4eadb', cesped: '#a8d88a', tierra: '#c89a6c', piedra: '#b9ab98', liso: '#ecdcbf', interior: '#f6efe4',
      cristal: '#bfe4f5', tejado: '#e07a58', chimenea_piedra: '#cbbda8', madera: '#ddb07e', madera_osc: '#b07e52',
      blanco: '#ffffff', metal: '#c3ccd6', negro: '#3c4250', tela1: '#9dbfe8', tela2: '#f2b8a8',
      funda1: '#ffd36e', funda2: '#a8d8c8', funda3: '#f5b6c8', almohada: '#ffffff', alfombra1: '#f3c1bd', alfombra2: '#c9d9f2',
      zen: '#bfe3cf', cojin: '#f7a86c', ppverde: '#43b07f', fuego: '#ff8a3d', coche: '#4a7fd9', coche_cristal: '#cfe6f5',
      rueda: '#3c4250', pelota: '#ee5a52', hoja: '#7cc36a', tronco: '#a87a52', maceta: '#e08f62', planta: '#69b85e',
      persiana: '#f7f3ea', porton: '#7d8794', lena: '#a9764c', agua: '#9fd8f0', carton: '#d2a878', pantalon: '#4a5466',
      piel: '#f3c9a5', pelo: '#5a3d2b',
      tela_gris: '#a4a7ae', tela_oscura: '#6e727b', tela_marron: '#c99a63', cerezo: '#b0634a', granito: '#caa497',
      ladrillo: '#cf8a63', azulejo: '#f7f4ee', suelo_barro: '#cd8a6b', suelo_laminado: '#ddd2c3', alfombra_beige: '#e6d2b2',
      cenefa: '#6a84bd', dorado: '#e7bd4f',
    },
  },
  lowpoly: {
    id: 'lowpoly', letra: 'B', nombre: 'Low poly',
    resumen: 'Formas facetadas y colores vivos, como muchos juegos de móvil.',
    aFavor: 'Tiene mucha personalidad y se ve muy nítido; pesa poco en el móvil.',
    enContra: 'Más frío que la A; los muebles pequeños se distinguen algo peor.',
    redondeo: 0, voxel: 0, plano: true, bordes: false, rugosidad: 0.9, brilloMunecos: 0.6,
    luz: { cielo: '#ffffff', suelo: '#d9c7a8', hemi: 1.1, dir: 2.7, dirColor: '#fff6ea', amb: 0.2 },
    sombra: 0.3,
    paleta: { ...VIVOS },
  },
  bloques: {
    id: 'bloques', letra: 'C', nombre: 'Bloques',
    resumen: 'Todo hecho con cubitos, como Minecraft o Crossy Road.',
    aFavor: 'Es lo más «juego» de todo y muy reconocible; los cambios de estado se notan mucho.',
    enContra: 'Pierde detalle: las curvas y los muebles finos se quedan en bloques.',
    redondeo: 0, voxel: 0.25, plano: true, bordes: false, rugosidad: 0.95, brilloMunecos: 0.8, variacion: 0.07,
    luz: { cielo: '#ffffff', suelo: '#d9c7a8', hemi: 1.15, dir: 2.6, dirColor: '#fff6ea', amb: 0.2 },
    sombra: 0.3,
    paleta: { ...VIVOS, cesped: '#62b33f', liso: '#dcc79e', piedra: '#8f8475', tejado: '#c44f33', suelo_madera: '#c98f50' },
  },
  maqueta: {
    id: 'maqueta', letra: 'D', nombre: 'Maqueta',
    resumen: 'Como una maqueta de arquitecto: madera clara y blanco; solo vosotros tres vais en color.',
    aFavor: 'Es la más elegante y la que más destaca a los muñecos y la suciedad.',
    enContra: 'Es la menos «juego»: más bonita que divertida.',
    redondeo: 0.02, voxel: 0, plano: false, bordes: true, rugosidad: 0.95, brilloMunecos: 0.5,
    luz: { cielo: '#ffffff', suelo: '#efe6d8', hemi: 1.7, dir: 1.5, dirColor: '#ffffff', amb: 0.3 },
    sombra: 0.2, colorBordes: '#8a8172',
    paleta: {
      suelo_madera: '#e8d4b4', suelo_baldosa: '#f1ece3', suelo_cemento: '#e5e0d7', suelo_porche: '#e6dccb', suelo_terraza: '#e8d4b4',
      losa: '#faf7f1', cesped: '#dfe8cf', tierra: '#d8c6a6', piedra: '#ece6db', liso: '#f6f2ea', interior: '#f8f5ef',
      cristal: '#e6f1f5', tejado: '#e3c8b5', chimenea_piedra: '#efe9df', madera: '#e6cfa6', madera_osc: '#d4b98e',
      blanco: '#fdfcf9', metal: '#e4e3df', negro: '#9c9a94', tela1: '#ebe6dc', tela2: '#e9e1d4',
      funda1: '#efe8db', funda2: '#e8eadf', funda3: '#efe4e0', almohada: '#ffffff', alfombra1: '#e9dfcf', alfombra2: '#e3e3da',
      zen: '#e2e8da', cojin: '#ecdcc6', ppverde: '#d5e2cf', fuego: '#f2b07d', coche: '#d3dcec', coche_cristal: '#eef4f7',
      rueda: '#b8b6b0', pelota: '#efc0bb', hoja: '#d4e2c4', tronco: '#d9c7aa', maceta: '#e6c9b2', planta: '#cfe0c0',
      persiana: '#fbf9f4', porton: '#d9d8d3', lena: '#dfcaa8', agua: '#e6f2f6', carton: '#e2cfb2', pantalon: '#5b6170',
      piel: '#f1dccb', pelo: '#7a6656',
      tela_gris: '#e4e1db', tela_oscura: '#d6d2ca', tela_marron: '#e8dccb', cerezo: '#dcc3ab', granito: '#ece2dc',
      ladrillo: '#ead8cb', azulejo: '#fbfaf6', suelo_barro: '#ecdccf', suelo_laminado: '#efe9e0', alfombra_beige: '#ebe2d4',
      cenefa: '#d9dde6', dorado: '#efe1bf',
    },
  },
};

export const ORDEN_ESTILOS = ['juguete', 'lowpoly', 'bloques', 'maqueta'];

export const SUCIEDAD = {
  ropa: ['#6f8fd6', '#e2725b', '#f0c35b', '#7bbf9a', '#9b7bc4'],
  papel: '#ffffff', lata: ['#d83a3a', '#c9ced6'], carton: '#c29567', mancha: '#5a4636', polvo: '#a59d93',
  plato: '#ffffff', resto: '#a0622d', bolsa: '#2e2f33',
};

// ---------- cuatro estilos más ----------
ESTILOS.plastilina = {
  id: 'plastilina', letra: 'E', nombre: 'Plastilina',
  resumen: 'Todo como hecho a mano con plastilina: formas gorditas, colores cálidos y la superficie con grumos.',
  aFavor: 'Es el más simpático y el que más se parece a un juego de móvil actual; muy de «vida virtual».',
  enContra: 'Los muebles pierden algo de forma por lo redondeados que están.',
  redondeo: 0.17, voxel: 0, plano: false, bordes: false, rugosidad: 0.62, brilloMunecos: 0.45, bump: 3.5,
  luz: { cielo: '#fff6ec', suelo: '#e9b98f', hemi: 1.25, dir: 2.3, dirColor: '#ffeedd', amb: 0.22 },
  sombra: 0.3,
  fondo: 'linear-gradient(180deg, #fde6cf 0%, #f6cfb2 100%)',
  paleta: {
    ...VIVOS,
    suelo_madera: '#e0843f', suelo_baldosa: '#f1e2ca', suelo_cemento: '#c3b8aa', suelo_porche: '#d7b48d', suelo_terraza: '#dcb28a',
    losa: '#f3dcbd', piedra: '#bb9f80', liso: '#f6b96f', interior: '#f8dfc3', tejado: '#dc5a3c', chimenea_piedra: '#c9ae90',
    madera: '#c9773d', madera_osc: '#924d26', blanco: '#fcf4e7', metal: '#bcc4cc', negro: '#3b3442',
    tela1: '#2aa79f', tela2: '#ea5c4b', funda1: '#f5c43d', funda2: '#5abb8b', funda3: '#ef80a7', almohada: '#fff8ee',
    alfombra1: '#e7695a', alfombra2: '#5b90d9', zen: '#93d4aa', cojin: '#f49b38', cesped: '#80cb5c', planta: '#4fba4b',
    hoja: '#5cbf4f', maceta: '#d76b3c', cristal: '#a9dcf0', pantalon: '#43495c', piel: '#f2ba90', pelo: '#4b2f22',
  },
};

ESTILOS.pixel = {
  id: 'pixel', letra: 'F', nombre: 'Píxel',
  resumen: 'Pixel art en 3D, como los videojuegos de antes o Habbo Hotel: se ve a cuadraditos.',
  aFavor: 'Es el más retro y el más «juego» de todos; ocupa poco y va rapidísimo en el móvil.',
  enContra: 'Lo pequeño se ve peor: los muebles finos y la suciedad pierden detalle.',
  redondeo: 0, voxel: 0, plano: true, bordes: false, rugosidad: 1, brilloMunecos: 0.5, pixel: 210,
  luz: { cielo: '#ffffff', suelo: '#c9b9a4', hemi: 1.05, dir: 2.8, dirColor: '#fff4e2', amb: 0.22 },
  sombra: 0.32,
  fondo: 'linear-gradient(180deg, #1c2442 0%, #2c3864 100%)',
  paleta: {
    ...VIVOS,
    suelo_madera: '#c98a4a', suelo_baldosa: '#dcd6c6', suelo_cemento: '#a9a39a', losa: '#e6ddc8', liso: '#9fc4e6', interior: '#dae7f2',
    piedra: '#8d909b', tejado: '#c4392d', madera: '#b9732f', madera_osc: '#7a4520', tela1: '#3a6fd8', tela2: '#e24848',
    funda1: '#ffcd33', funda2: '#2fbf8f', funda3: '#ff6fa6', alfombra1: '#e04f4f', alfombra2: '#3f7fe0', zen: '#37c08a',
    cesped: '#55b947', cristal: '#8fd8f5',
  },
};

ESTILOS.carton = {
  id: 'carton', letra: 'G', nombre: 'Cartón',
  resumen: 'Una casa de muñecas de cartón y papel de colores, recortada y pegada a mano.',
  aFavor: 'Tiene mucho encanto y es muy original; se nota a la legua que es vuestra casa «de juguete».',
  enContra: 'Es más tranquilo y menos brillante; en pantallas pequeñas las líneas se ven finas.',
  redondeo: 0.008, voxel: 0, plano: false, bordes: true, rugosidad: 1, brilloMunecos: 0.15, grano: true,
  luz: { cielo: '#fffaf0', suelo: '#e6d3b3', hemi: 1.75, dir: 1.3, dirColor: '#fff3e2', amb: 0.3 },
  sombra: 0.26, colorBordes: '#5e4329', opacidadBordes: 0.85,
  fondo: 'linear-gradient(180deg, #f1e7d6 0%, #e4d3b6 100%)',
  paleta: {
    ...VIVOS,
    suelo_madera: '#d9b88d', suelo_baldosa: '#f2ebdc', suelo_cemento: '#d5c9b4', suelo_porche: '#dcc6a4', suelo_terraza: '#d9b88d',
    losa: '#e8d9bd', piedra: '#c4a883', liso: '#ddb98a', interior: '#efe3cf', tejado: '#cc6b4b', chimenea_piedra: '#c8b08e',
    cristal: '#cfe6ee', madera: '#bf9160', madera_osc: '#94704a', blanco: '#faf6ec', metal: '#cfcabe', negro: '#4d4339',
    tela1: '#4f86d6', tela2: '#e35d4f', funda1: '#f2c84b', funda2: '#82b392', funda3: '#e49db2', almohada: '#fbf7ee',
    alfombra1: '#dc7b6d', alfombra2: '#7fa2d3', zen: '#a9cfa9', cojin: '#e9a25e', cesped: '#a5c784', tierra: '#c9a57a',
    hoja: '#8fbd73', planta: '#8fbd73', maceta: '#cf8a5f', coche: '#6f96cc', pelota: '#da695c', pantalon: '#5a5148',
    piel: '#efc9a6', pelo: '#5c4332',
  },
};

ESTILOS.pastel = {
  id: 'pastel', letra: 'H', nombre: 'Pastel',
  resumen: 'Colores pastel y la luz en tres tonos limpios, como el juego Monument Valley.',
  aFavor: 'Es el más bonito y elegante; se distingue muy bien cada volumen.',
  enContra: 'Es más de mirar que de jugar; la suciedad destaca menos entre tanto color suave.',
  redondeo: 0, voxel: 0, plano: true, bordes: false, rugosidad: 1, brilloMunecos: 0.5, toon: 3,
  luz: { cielo: '#fff0f3', suelo: '#d6cdee', hemi: 0.95, dir: 2.25, dirColor: '#fff6f0', amb: 0.26 },
  sombra: 0.18,
  fondo: 'linear-gradient(180deg, #fbded6 0%, #f4c9cd 48%, #cfc7ea 100%)',
  paleta: {
    ...VIVOS,
    suelo_madera: '#f6caa9', suelo_baldosa: '#f6e9df', suelo_cemento: '#e5dbe0', suelo_porche: '#f1d6c6', suelo_terraza: '#f6caa9',
    losa: '#fcefe7', piedra: '#c9b8d8', liso: '#f3b9b9', interior: '#fde6e2', tejado: '#e9878b', chimenea_piedra: '#dac6e2',
    cristal: '#d8eff8', madera: '#eab490', madera_osc: '#cc917c', blanco: '#fffaf7', metal: '#dbd6e8', negro: '#6c6485',
    tela1: '#8ec8d7', tela2: '#f4a49c', funda1: '#ffd98e', funda2: '#b4e1ca', funda3: '#f8bad1', almohada: '#ffffff',
    alfombra1: '#f6c3c1', alfombra2: '#c7d4f3', zen: '#c2e9d6', cojin: '#ffc08f', cesped: '#c1e5b5', tierra: '#ebbca3',
    hoja: '#a2d6a3', planta: '#a2d6a3', maceta: '#f0a98c', coche: '#9bb7ea', pelota: '#f38c8c', tronco: '#d7a88c',
    pantalon: '#6c6485', piel: '#f7d3bd', pelo: '#7b5b64', ppverde: '#8fd0b6', porton: '#c9bfd9',
  },
};

ORDEN_ESTILOS.push('plastilina', 'pixel', 'carton', 'pastel');

// El estilo A con menos gris (lo eligió Javi el 8 de noviembre): dos versiones para escoger
const A = ESTILOS.juguete;
ESTILOS.juguete_calido = {
  ...A,
  id: 'juguete_calido', letra: 'A2', nombre: 'Casita cálida',
  resumen: 'La A con menos blanco y menos gris: paredes crema, madera de miel y una luz más cálida.',
  aFavor: 'Sigue igual de limpia que la A, pero tiene más vida y se distingue mejor cada cosa.',
  enContra: 'Es un retoque pequeño: si buscas un cambio claro, la A3.',
  luz: { cielo: '#fff8ee', suelo: '#e9cfa8', hemi: 1.2, dir: 2.15, dirColor: '#ffe9cc', amb: 0.22 },
  fondo: 'linear-gradient(180deg, #fbefe0 0%, #f3dcc0 100%)',
  paleta: {
    ...A.paleta,
    suelo_madera: '#dfae78', suelo_baldosa: '#f1e2cb', losa: '#f2dfc2', liso: '#f1d4a8', interior: '#f8e9d2', piedra: '#c2a98a',
    madera: '#d9a066', madera_osc: '#a8703f', tela1: '#7eaee8', tela2: '#f2a592', alfombra1: '#f1aaa2', cojin: '#f69a55',
    zen: '#a9dcc0', planta: '#5fb256', maceta: '#de8455', chimenea_piedra: '#c8b292', metal: '#b8c2cd', negro: '#363c4a',
  },
};
ESTILOS.juguete_vivo = {
  ...A,
  id: 'juguete_vivo', letra: 'A3', nombre: 'Casita viva',
  resumen: 'La A con colores más vivos y más contraste, sobre un cielo azul.',
  aFavor: 'Es la que más parece un juego de móvil sin perder las formas limpias de la A.',
  enContra: 'Con tanto color, lo sucio destaca un poco menos.',
  luz: { cielo: '#ffffff', suelo: '#e4c7a0', hemi: 1.18, dir: 2.4, dirColor: '#fff0dc', amb: 0.2 },
  fondo: 'linear-gradient(180deg, #d6ecf8 0%, #fbecd8 100%)',
  paleta: {
    ...A.paleta,
    suelo_madera: '#d99a5a', suelo_baldosa: '#ecdcc2', losa: '#f0d9b8', liso: '#efcf98', interior: '#fae7cc', piedra: '#b49b7c',
    madera: '#d08d4d', madera_osc: '#9a5f30', tela1: '#4c8fe6', tela2: '#ee7a68', funda1: '#ffc43d', funda2: '#5fc6a3',
    funda3: '#f18bb0', alfombra1: '#ee8079', alfombra2: '#7aa6ea', zen: '#7fd0a8', cojin: '#f78c3c', planta: '#47a94a',
    hoja: '#56b84f', cesped: '#8ccf68', maceta: '#d9733f', metal: '#a9b5c2', negro: '#2f3442', chimenea_piedra: '#bfa688',
  },
};
ORDEN_ESTILOS.unshift('juguete_calido', 'juguete_vivo');
