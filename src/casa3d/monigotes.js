import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { texturaCirculo, texturaEscalones, texturaPeste, texturaNube, texturaBrillo, texturaCartel } from './texturas.js';

// Muñeco sencillo con el color de cada uno y unas cuantas poses
export function crearMonigote(persona, estilo) {
  const P = estilo.paleta;
  const voxel = !!estilo.voxel;
  const plano = !!estilo.plano;
  const aspereza = 1 - estilo.brilloMunecos * 0.7;
  const mat = (color, r = aspereza) => estilo.toon
    ? new THREE.MeshToonMaterial({ color, gradientMap: texturaEscalones(estilo.toon) })
    : new THREE.MeshStandardMaterial({ color, roughness: r, metalness: 0, flatShading: plano });
  const mCamiseta = mat(persona.color);
  const mPiel = mat(P.piel, 0.7);
  const mPelo = mat(P.pelo, 0.85);
  const mPantalon = mat(P.pantalon, 0.85);
  const mNegro = mat('#1d2129', 0.5);
  const mCepillo = mat('#e9b44c', 0.8);
  const mPalo = mat('#9a6a3f', 0.8);
  const mPolvo = new THREE.MeshBasicMaterial({ color: '#b9b2a7', transparent: true, opacity: 0.6, depthWrite: false });
  const mVapor = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.7, depthWrite: false });
  const materiales = [mCamiseta, mPiel, mPelo, mPantalon, mNegro, mCepillo, mPalo, mPolvo, mVapor];

  const caja = (w, h, d, m, r = 0.06) => {
    const rr = Math.min(r, w * 0.45, h * 0.45, d * 0.45);
    const g = !voxel && !plano && rr > 0.005 ? new RoundedBoxGeometry(w, h, d, 3, rr) : new THREE.BoxGeometry(w, h, d);
    return new THREE.Mesh(g, m);
  };
  const capsula = (r, largo, m) => {
    if (voxel) return caja(r * 2.1, largo + r * 2, r * 2.1, m, 0);
    if (plano) return new THREE.Mesh(new THREE.CylinderGeometry(r, r, largo + r * 2, 6), m);
    return new THREE.Mesh(new THREE.CapsuleGeometry(r, largo, 4, 12), m);
  };
  const bola = (r, m) => {
    if (voxel) return caja(r * 2, r * 2, r * 2, m, 0);
    return new THREE.Mesh(plano ? new THREE.IcosahedronGeometry(r, 1) : new THREE.SphereGeometry(r, 22, 16), m);
  };

  const raiz = new THREE.Group();
  const cuerpo = new THREE.Group();
  raiz.add(cuerpo);

  // piernas, con el pivote en la cadera
  const piernas = [];
  for (const lado of [-1, 1]) {
    const g = new THREE.Group();
    g.position.set(0.1 * lado, 0.48, 0);
    const p = capsula(0.085, 0.3, mPantalon);
    p.position.y = -0.24;
    const z = caja(0.15, 0.08, 0.23, mNegro, 0.03);
    z.position.set(0, -0.44, 0.035);
    g.add(p, z);
    cuerpo.add(g);
    piernas.push(g);
  }
  const cruzadas = new THREE.Group();
  {
    const a = capsula(0.1, 0.36, mPantalon);
    a.rotation.set(0, 0.45, Math.PI / 2);
    a.position.set(0, 0.55, 0.13);
    const b = capsula(0.1, 0.36, mPantalon);
    b.rotation.set(0, -0.45, Math.PI / 2);
    b.position.set(0, 0.53, 0.16);
    cruzadas.add(a, b);
  }
  cruzadas.visible = false;
  cuerpo.add(cruzadas);

  const tronco = caja(0.44, 0.52, 0.3, mCamiseta, 0.11);
  tronco.position.y = 0.73;
  cuerpo.add(tronco);

  // brazos, con el pivote en el hombro
  const brazos = [];
  for (const lado of [-1, 1]) {
    const g = new THREE.Group();
    g.rotation.order = 'YXZ';
    g.position.set(0.29 * lado, 0.93, 0);
    const b = capsula(0.07, 0.29, mCamiseta);
    b.position.y = -0.2;
    const mano = bola(0.075, mPiel);
    mano.position.y = -0.41;
    g.add(b, mano);
    cuerpo.add(g);
    brazos.push(g);
  }

  const cabeza = new THREE.Group();
  cabeza.position.y = 1.27;
  cuerpo.add(cabeza);
  cabeza.add(voxel ? caja(0.5, 0.5, 0.5, mPiel, 0) : bola(0.27, mPiel));
  if (voxel) {
    const pelo = caja(0.54, 0.16, 0.54, mPelo, 0);
    pelo.position.set(0, 0.2, -0.01);
    const nuca = caja(0.54, 0.34, 0.12, mPelo, 0);
    nuca.position.set(0, 0.06, -0.22);
    cabeza.add(pelo, nuca);
  } else {
    const pelo = new THREE.Mesh(new THREE.SphereGeometry(0.288, plano ? 8 : 22, plano ? 4 : 10, 0, Math.PI * 2, 0, Math.PI * 0.52), mPelo);
    pelo.position.set(0, 0.025, -0.025);
    pelo.rotation.x = -0.25;
    cabeza.add(pelo);
  }
  const ojos = new THREE.Group();
  for (const lado of [-1, 1]) {
    const o = voxel ? caja(0.07, 0.09, 0.02, mNegro, 0) : bola(0.034, mNegro);
    o.position.set(0.095 * lado, -0.01, voxel ? 0.255 : 0.245);
    ojos.add(o);
  }
  cabeza.add(ojos);

  const sombra = new THREE.Mesh(
    new THREE.PlaneGeometry(0.85, 0.85),
    new THREE.MeshBasicMaterial({ map: texturaCirculo(), color: '#000000', transparent: true, opacity: 0.3, depthWrite: false }),
  );
  materiales.push(sombra.material);
  sombra.rotation.x = -Math.PI / 2;
  sombra.position.y = 0.016;
  raiz.add(sombra);

  // escoba
  const escoba = new THREE.Group();
  {
    const desde = new THREE.Vector3(0.02, 0.6, 0.3);
    const hasta = new THREE.Vector3(0.14, 0.06, 0.66);
    const largo = desde.distanceTo(hasta) + 0.4;
    const palo = voxel ? caja(0.06, largo, 0.06, mPalo, 0) : new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, largo, 8), mPalo);
    const dir = hasta.clone().sub(desde).normalize();
    palo.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    palo.position.copy(desde).add(hasta).multiplyScalar(0.5).addScaledVector(dir, -0.2);
    const cepillo = caja(0.38, 0.1, 0.15, mCepillo, 0.03);
    cepillo.position.copy(hasta).add(new THREE.Vector3(0, 0.0, 0.02));
    cepillo.rotation.y = 0.3;
    escoba.add(palo, cepillo);
  }
  const polvo = [];
  for (let i = 0; i < 4; i++) {
    const p = bola(0.06 + i * 0.012, mPolvo);
    p.userData.fase = i / 4;
    polvo.push(p);
    escoba.add(p);
  }
  escoba.visible = false;
  cuerpo.add(escoba);

  // mando de la Play
  const mando = caja(0.22, 0.05, 0.12, mNegro, 0.025);
  mando.position.set(0, 0.6, 0.36);
  mando.visible = false;
  cuerpo.add(mando);

  // sartén con vapor
  const sarten = new THREE.Group();
  {
    const plato = voxel ? caja(0.36, 0.06, 0.36, mNegro, 0) : new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.16, 0.05, plano ? 8 : 20), mNegro);
    plato.position.set(0.05, 0.96, 0.62);
    const mango = caja(0.05, 0.035, 0.3, mNegro, 0.01);
    mango.position.set(0.18, 0.92, 0.42);
    mango.rotation.y = 0.45;
    sarten.add(plato, mango);
  }
  const vapor = [];
  for (let i = 0; i < 3; i++) {
    const v = bola(0.07, mVapor);
    v.userData.fase = i / 3;
    vapor.push(v);
    sarten.add(v);
  }
  sarten.visible = false;
  cuerpo.add(sarten);

  // ---------- complementos y efectos del juego ----------
  const mOro = mat('#ffc61a', 0.35);
  if (mOro.emissive) { mOro.emissive.set('#7a5200'); }
  const mRojo = mat('#d9342b', 0.6);
  const mPalomita = mat('#fff1c2', 0.9);
  const mPantalla = new THREE.MeshBasicMaterial({ color: '#9fe3ff' });
  const mCubo = mat('#4f7fc0', 0.5);
  const mAguaCubo = mat('#9fd8f0', 0.3);
  const mCartel = new THREE.MeshBasicMaterial({ map: texturaCartel() });
  const mPeste = new THREE.SpriteMaterial({ map: texturaPeste(), transparent: true, depthWrite: false });
  const mNube = new THREE.SpriteMaterial({ map: texturaNube(), transparent: true, depthWrite: false });
  const mEstrella = new THREE.SpriteMaterial({ map: texturaBrillo(), color: '#ffd23f', transparent: true, depthWrite: false });
  materiales.push(mOro, mRojo, mPalomita, mPantalla, mCubo, mAguaCubo, mCartel, mPeste, mNube, mEstrella);
  if (mCartel.map) materiales.push({ dispose: () => mCartel.map.dispose() });

  // móvil en la mano derecha
  const movil = new THREE.Group();
  {
    const cuerpoMovil = caja(0.09, 0.16, 0.02, mNegro, 0.01);
    const pantalla = new THREE.Mesh(new THREE.PlaneGeometry(0.075, 0.135), mPantalla);
    pantalla.position.z = 0.011;
    movil.add(cuerpoMovil, pantalla);
    movil.position.set(0, -0.47, 0.04);
    movil.rotation.x = -1.2;
  }
  movil.visible = false;
  brazos[0].add(movil);

  // bol de palomitas en el regazo
  const palomitas = new THREE.Group();
  {
    const bol = voxel ? caja(0.3, 0.14, 0.3, mRojo, 0) : new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.12, 0.15, plano ? 8 : 18), mRojo);
    palomitas.add(bol);
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      const b = bola(0.05, mPalomita);
      b.position.set(Math.cos(a) * 0.09 * (i % 2 ? 1 : 0.4), 0.09 + (i % 3) * 0.02, Math.sin(a) * 0.09 * (i % 2 ? 1 : 0.4));
      palomitas.add(b);
    }
    palomitas.position.set(0.02, 0.62, 0.34);
  }
  palomitas.visible = false;
  cuerpo.add(palomitas);

  // corona del rey
  const corona = new THREE.Group();
  {
    const aro = voxel ? caja(0.4, 0.1, 0.4, mOro, 0) : new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.2, 0.1, plano ? 8 : 20, 1, true), mOro);
    if (aro.material) aro.material.side = THREE.DoubleSide;
    corona.add(aro);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const pico = voxel ? caja(0.07, 0.12, 0.07, mOro, 0) : new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.13, plano ? 4 : 8), mOro);
      pico.position.set(Math.cos(a) * 0.18, 0.11, Math.sin(a) * 0.18);
      corona.add(pico);
      const gema = bola(0.025, mRojo);
      gema.position.set(Math.cos(a + 0.63) * 0.2, 0.0, Math.sin(a + 0.63) * 0.2);
      corona.add(gema);
    }
    corona.position.y = voxel ? 0.33 : 0.25;
    corona.rotation.z = 0.08;
  }
  corona.visible = false;
  cabeza.add(corona);

  // cartel de castigado y cubo
  const cartel = new THREE.Group();
  {
    const palo = voxel ? caja(0.05, 1.1, 0.05, mPalo, 0) : new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 1.1, 8), mPalo);
    palo.position.set(0.36, 1.35, 0.1);
    const tabla = caja(0.62, 0.32, 0.03, mPalo, 0.01);
    tabla.position.set(0.36, 1.98, 0.1);
    const cara = new THREE.Mesh(new THREE.PlaneGeometry(0.58, 0.29), mCartel);
    cara.position.set(0.36, 1.98, 0.118);
    cartel.add(palo, tabla, cara);
  }
  cartel.visible = false;
  cuerpo.add(cartel);
  const cubo = new THREE.Group();
  {
    const c = voxel ? caja(0.3, 0.3, 0.3, mCubo, 0) : new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.12, 0.3, plano ? 8 : 16), mCubo);
    c.position.y = 0.15;
    const agua = voxel ? caja(0.24, 0.02, 0.24, mAguaCubo, 0) : new THREE.Mesh(new THREE.CylinderGeometry(0.145, 0.145, 0.02, plano ? 8 : 16), mAguaCubo);
    agua.position.y = 0.27;
    cubo.add(c, agua);
    cubo.position.set(-0.45, 0, 0.3);
  }
  cubo.visible = false;
  raiz.add(cubo);

  // efectos: peste con moscas, nubarrón y estrellas de racha (no giran con el cuerpo)
  const peste = new THREE.Group();
  const pesteSprites = [], moscas = [];
  for (let i = 0; i < 3; i++) {
    const sp = new THREE.Sprite(mPeste);
    sp.scale.setScalar(0.42);
    sp.userData.fase = i / 3;
    peste.add(sp); pesteSprites.push(sp);
  }
  for (let i = 0; i < 3; i++) {
    const m = bola(0.035, mNegro);
    m.userData.fase = i * 2.1;
    peste.add(m); moscas.push(m);
  }
  peste.visible = false;
  raiz.add(peste);
  const nube = new THREE.Sprite(mNube);
  nube.scale.set(0.85, 0.85, 1);
  nube.visible = false;
  raiz.add(nube);
  const racha = new THREE.Group();
  const estrellas = [];
  for (let i = 0; i < 3; i++) {
    const e = new THREE.Sprite(mEstrella);
    e.scale.setScalar(0.32);
    e.userData.fase = (i / 3) * Math.PI * 2;
    racha.add(e); estrellas.push(e);
  }
  racha.visible = false;
  raiz.add(racha);

  let insignias = [];
  function setInsignias(lista = []) {
    insignias = lista;
    corona.visible = lista.includes('corona');
    peste.visible = lista.includes('peste');
    nube.visible = lista.includes('nube');
    racha.visible = lista.includes('racha');
  }

  let poseActual = 'pie';

  function pose(nombre) {
    poseActual = nombre;
    cuerpo.position.set(0, 0, 0);
    cuerpo.rotation.set(0, 0, 0);
    for (const p of piernas) { p.visible = true; p.rotation.set(0, 0, 0); }
    cruzadas.visible = false;
    brazos[0].rotation.set(0, 0, -0.12);
    brazos[1].rotation.set(0, 0, 0.12);
    ojos.scale.set(1, 1, 1);
    cabeza.rotation.set(0, 0, 0);
    escoba.visible = mando.visible = sarten.visible = false;
    movil.visible = palomitas.visible = cartel.visible = cubo.visible = false;
    if (nombre === 'esperar') {
      brazos[0].rotation.set(-1.3, 0.75, 0);
      brazos[1].rotation.set(-1.3, -0.75, 0);
    } else if (nombre === 'barrer') {
      brazos[0].rotation.set(-0.8, 0.38, 0);
      brazos[1].rotation.set(-0.7, -0.3, 0);
      escoba.visible = true;
    } else if (nombre === 'meditar') {
      cuerpo.position.y = -0.33;
      for (const p of piernas) p.visible = false;
      cruzadas.visible = true;
      brazos[0].rotation.set(-0.45, 0.55, -0.35);
      brazos[1].rotation.set(-0.45, -0.55, 0.35);
      ojos.scale.set(1, 0.2, 1);
    } else if (nombre === 'play') {
      cuerpo.position.y = -0.05;
      for (const p of piernas) p.rotation.x = -1.45;
      brazos[0].rotation.set(-1.0, 0.36, 0);
      brazos[1].rotation.set(-1.0, -0.36, 0);
      mando.visible = true;
    } else if (nombre === 'cocinar') {
      brazos[0].rotation.set(-0.95, 0.3, 0);
      brazos[1].rotation.set(-1.2, -0.12, 0);
      sarten.visible = true;
    } else if (nombre === 'sofa') {
      cuerpo.position.y = -0.05;
      for (const p of piernas) p.rotation.x = -1.45;
      brazos[0].rotation.set(-1.0, 0.36, 0);
      brazos[1].rotation.set(-0.9, -0.5, 0);
      mando.visible = true;
      mando.position.set(-0.12, 0.6, 0.36);
      palomitas.visible = true;
    } else if (nombre === 'movil') {
      brazos[0].rotation.set(-1.75, 0.55, 0);
      brazos[1].rotation.set(0, 0, 0.12);
      cabeza.rotation.x = 0.28;
      movil.visible = true;
    } else if (nombre === 'triste') {
      cuerpo.position.y = -0.36;
      for (const p of piernas) p.rotation.x = -2.15;
      brazos[0].rotation.set(-1.35, 0.25, 0);
      brazos[1].rotation.set(-1.35, -0.25, 0);
      cabeza.rotation.x = 0.5;
      ojos.scale.set(1, 0.35, 1);
    } else if (nombre === 'castigado') {
      brazos[1].rotation.set(-2.95, 0, 0.18);
      brazos[0].rotation.set(0.1, 0, -0.1);
      cabeza.rotation.x = 0.38;
      ojos.scale.set(1, 0.45, 1);
      cartel.visible = true;
      cubo.visible = true;
    }
    if (nombre !== 'sofa') mando.position.set(0, 0.6, 0.36);
  }

  function animar(t, fase = 0) {
    const s = t + fase;
    tronco.scale.y = 1 + Math.sin(s * 2.2) * 0.012;
    if (poseActual === 'barrer') {
      escoba.rotation.y = Math.sin(s * 6) * 0.35;
      cuerpo.rotation.y = Math.sin(s * 6) * 0.08;
      for (const p of polvo) {
        const k = (s * 0.9 + p.userData.fase) % 1;
        p.position.set(0.14 + Math.sin(k * 9 + p.userData.fase * 7) * 0.25, 0.06 + k * 0.35, 0.7 + k * 0.2);
        p.scale.setScalar(0.6 + k * 1.2);
      }
      mPolvo.opacity = 0.55;
    } else if (poseActual === 'meditar') {
      cuerpo.position.y = -0.33 + Math.sin(s * 1.6) * 0.018;
    } else if (poseActual === 'play') {
      cuerpo.rotation.z = Math.sin(s * 2.6) * 0.05;
      mando.rotation.z = Math.sin(s * 11) * 0.12;
    } else if (poseActual === 'cocinar') {
      sarten.rotation.z = Math.sin(s * 3) * 0.04;
      for (const v of vapor) {
        const k = (s * 0.45 + v.userData.fase) % 1;
        v.position.set(0.05 + Math.sin(k * 6 + v.userData.fase * 5) * 0.06, 1.02 + k * 0.6, 0.62);
        v.scale.setScalar(0.7 + k * 1.3);
      }
      mVapor.opacity = 0.55;
    } else if (poseActual === 'esperar') {
      cuerpo.position.y = Math.abs(Math.sin(s * 3)) * 0.025;
    } else if (poseActual === 'sofa') {
      cuerpo.rotation.z = Math.sin(s * 2.2) * 0.04;
      mando.rotation.z = Math.sin(s * 11) * 0.12;
      const comer = Math.max(0, Math.sin(s * 1.3));
      brazos[1].rotation.x = -0.9 - comer * 1.3;
    } else if (poseActual === 'movil') {
      mPantalla.color.setHSL(0.55, 0.8, 0.75 + Math.sin(s * 7) * 0.08);
    } else if (poseActual === 'triste') {
      cuerpo.position.y = -0.36 + Math.sin(s * 1.2) * 0.01;
    } else if (poseActual === 'castigado') {
      cuerpo.rotation.z = Math.sin(s * 1.5) * 0.03;
    }
    const alto = cuerpo.position.y + 1.62;
    if (peste.visible) {
      pesteSprites.forEach((sp, i) => {
        const k = (s * 0.5 + sp.userData.fase) % 1;
        sp.position.set(Math.sin(i * 2.1) * 0.32, alto - 0.6 + k * 0.9, Math.cos(i * 2.1) * 0.22);
        sp.material.opacity = Math.sin(k * Math.PI) * 0.9;
      });
      moscas.forEach((m) => {
        const a = s * 6 + m.userData.fase;
        m.position.set(Math.cos(a) * 0.38, alto + 0.05 + Math.sin(a * 2.3) * 0.12, Math.sin(a) * 0.38);
      });
    }
    if (nube.visible) nube.position.set(0, alto + 0.55 + Math.sin(s * 1.4) * 0.04, 0);
    if (racha.visible) {
      estrellas.forEach((e) => {
        const a = s * 1.6 + e.userData.fase;
        e.position.set(Math.cos(a) * 0.45, cuerpo.position.y + 0.5 + Math.sin(a * 1.5) * 0.35 + 0.4, Math.sin(a) * 0.45);
        e.scale.setScalar(0.22 + 0.12 * (0.5 + 0.5 * Math.sin(s * 4 + e.userData.fase)));
      });
    }
  }

  function arribaDeLaCabeza() {
    let h = cuerpo.position.y + (poseActual === 'meditar' ? 1.55 : 1.62);
    if (corona.visible) h += 0.2;
    if (nube.visible) h += 0.85;
    if (poseActual === 'castigado') h = Math.max(h, 2.2);
    return h;
  }

  function liberar() {
    raiz.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    for (const m of materiales) m.dispose();
  }

  pose('pie');
  return { raiz, pose, animar, arribaDeLaCabeza, liberar, persona, setInsignias, get insignias() { return insignias; } };
}
