// Visor 3D del huerto de Kyra (three.js).
//
// Igual que el tablero 2D, no conoce las reglas del juego: recibe las mismas
// fotos (eventos) que manda el servidor y las anima. Compara cada foto con la
// anterior para saber qué pasó:
//
//	Kyra cambió de casilla        → camina
//	mover(...) sin cambiar casilla → choca
//	plantar() / cosechar()        → la animación de cada uno
//	una casilla cambió de letra   → el cultivo aparece, crece o se va
//
// Los modelos salen de modelos/huerto.glb (hecho en Blender). Si el archivo no
// está o no carga, se usan figuras simples hechas aquí, con las mismas partes
// (cabeza, cola, patas), así que las animaciones sirven para los dos.
//
// index.html lo usa con window.Huerto3D: montar(contenedor), dibujar(foto,
// anterior, ms), final(tipo) y reencuadrar().
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import * as SkeletonUtils from "three/addons/utils/SkeletonUtils.js";

const RUMBOS = {
	norte: { fila: -1, columna: 0 },
	sur: { fila: 1, columna: 0 },
	este: { fila: 0, columna: 1 },
	oeste: { fila: 0, columna: -1 },
};

// Hacia dónde mira Kyra en cada rumbo (el modelo mira a +z = sur).
const giroDe = (df, dc) => Math.atan2(dc, df);

const COLORES = {
	fondo: 0x050a07,
	piso: 0x1b2620,
	pisoBorde: 0x2c3a31,
	tierra: 0x5a3a1c,
	bandeja: 0x3a4a40,
	hoja: 0x58c93a,
	hojaOscura: 0x2f8a26,
	tomate: 0xe23b2a,
	tanque: 0x2f7fa6,
	agua: 0x56c8ff,
	kyra: 0xd9dee0,
	kyraOscuro: 0x3b4146,
	ojo: 0x3cff7a,
	luz: 0x3cff7a,
};

const facil = {
	suave: (k) => k * k * (3 - 2 * k),
	salida: (k) => 1 - (1 - k) * (1 - k),
	rebote: (k) => {
		const c = 1.70158 + 1;
		return 1 + c * Math.pow(k - 1, 3) + 1.70158 * Math.pow(k - 1, 2);
	},
};

/* ------------------------------------------------------------- MODELOS */

function material(color, extra = {}) {
	return new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0.05, ...extra });
}

function caja(ancho, alto, largo, color, extra) {
	const m = new THREE.Mesh(new THREE.BoxGeometry(ancho, alto, largo), material(color, extra));
	m.castShadow = true;
	m.receiveShadow = true;
	return m;
}

// Figuras de respaldo, con los mismos nombres que los objetos de Blender.
const RESPALDO = {
	Kyra() {
		const kyra = new THREE.Group();
		const cuerpo = caja(0.34, 0.24, 0.5, COLORES.kyra, { metalness: 0.4, roughness: 0.4 });
		cuerpo.name = "cuerpo";
		cuerpo.position.y = 0.32;
		kyra.add(cuerpo);
		const cabeza = new THREE.Group();
		cabeza.name = "cabeza";
		cabeza.position.set(0, 0.5, 0.26);
		const craneo = caja(0.3, 0.26, 0.28, COLORES.kyra, { metalness: 0.4, roughness: 0.4 });
		const hocico = caja(0.16, 0.12, 0.14, COLORES.kyraOscuro);
		hocico.position.set(0, -0.05, 0.18);
		const visor = caja(0.24, 0.07, 0.02, 0x000000, { emissive: COLORES.ojo, emissiveIntensity: 1.6 });
		visor.position.set(0, 0.04, 0.145);
		cabeza.add(craneo, hocico, visor);
		for (const lado of [-1, 1]) {
			const oreja = caja(0.07, 0.14, 0.05, COLORES.kyraOscuro);
			oreja.name = lado < 0 ? "oreja_i" : "oreja_d";
			oreja.position.set(lado * 0.1, 0.18, -0.04);
			cabeza.add(oreja);
		}
		kyra.add(cabeza);
		const cola = caja(0.05, 0.05, 0.22, COLORES.kyraOscuro);
		cola.name = "cola";
		cola.geometry.translate(0, 0, -0.11);
		cola.position.set(0, 0.4, -0.25);
		cola.rotation.x = -0.6;
		kyra.add(cola);
		for (const [nombre, x, z] of [["pata_di", -0.12, 0.17], ["pata_dd", 0.12, 0.17], ["pata_ti", -0.12, -0.17], ["pata_td", 0.12, -0.17]]) {
			const pata = caja(0.08, 0.22, 0.08, COLORES.kyraOscuro);
			pata.name = nombre;
			pata.geometry.translate(0, -0.11, 0);
			pata.position.set(x, 0.22, z);
			kyra.add(pata);
		}
		return kyra;
	},
	Bandeja() {
		const g = new THREE.Group();
		const marco = caja(0.92, 0.12, 0.92, COLORES.bandeja, { metalness: 0.5, roughness: 0.5 });
		marco.position.y = 0.06;
		const tierra = caja(0.8, 0.04, 0.8, COLORES.tierra, { roughness: 1 });
		tierra.position.y = 0.12;
		g.add(marco, tierra);
		return g;
	},
	Brote() {
		const g = new THREE.Group();
		const tallo = caja(0.03, 0.12, 0.03, COLORES.hojaOscura);
		tallo.position.y = 0.06;
		g.add(tallo);
		for (const lado of [-1, 1]) {
			const hoja = caja(0.1, 0.02, 0.06, COLORES.hoja);
			hoja.position.set(lado * 0.05, 0.12, 0);
			hoja.rotation.z = lado * 0.4;
			g.add(hoja);
		}
		return g;
	},
	Lechuga() {
		const g = new THREE.Group();
		for (let i = 0; i < 7; i++) {
			const a = (i / 7) * Math.PI * 2;
			const hoja = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), material(i % 2 ? COLORES.hoja : COLORES.hojaOscura));
			hoja.scale.set(1, 0.7, 0.6);
			hoja.position.set(Math.cos(a) * 0.1, 0.1, Math.sin(a) * 0.1);
			hoja.rotation.y = -a;
			hoja.castShadow = true;
			g.add(hoja);
		}
		const centro = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), material(0x9be36a));
		centro.position.y = 0.14;
		centro.castShadow = true;
		g.add(centro);
		return g;
	},
	Tomate() {
		const g = new THREE.Group();
		const mata = caja(0.04, 0.4, 0.04, COLORES.hojaOscura);
		mata.position.y = 0.2;
		g.add(mata);
		for (const [x, y, z] of [[0.1, 0.22, 0.04], [-0.09, 0.3, -0.05], [0.02, 0.4, 0.09]]) {
			const fruto = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 10), material(COLORES.tomate, { roughness: 0.35 }));
			fruto.position.set(x, y, z);
			fruto.castShadow = true;
			g.add(fruto);
		}
		return g;
	},
	Tanque() {
		const g = new THREE.Group();
		const cuerpo = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.4, 0.9, 20), material(COLORES.tanque, { metalness: 0.6, roughness: 0.35 }));
		cuerpo.position.y = 0.45;
		cuerpo.castShadow = true;
		cuerpo.receiveShadow = true;
		const agua = new THREE.Mesh(new THREE.CylinderGeometry(0.39, 0.39, 0.3, 20), material(COLORES.agua, { emissive: COLORES.agua, emissiveIntensity: 0.35, transparent: true, opacity: 0.8 }));
		agua.position.y = 0.55;
		const tapa = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.38, 0.1, 20), material(0x8a9aa0, { metalness: 0.8, roughness: 0.3 }));
		tapa.position.y = 0.95;
		g.add(cuerpo, agua, tapa);
		return g;
	},
	Piso() {
		const g = new THREE.Group();
		const losa = caja(0.98, 0.06, 0.98, COLORES.piso, { metalness: 0.6, roughness: 0.6 });
		losa.position.y = -0.03;
		g.add(losa);
		return g;
	},
	Poste() {
		const g = new THREE.Group();
		const poste = caja(0.08, 0.5, 0.08, 0x4a5a50, { metalness: 0.6, roughness: 0.4 });
		poste.position.y = 0.25;
		const luz = caja(0.1, 0.04, 0.1, 0x000000, { emissive: COLORES.luz, emissiveIntensity: 1.2 });
		luz.position.y = 0.52;
		g.add(poste, luz);
		return g;
	},
};

// Modelos: lo que haya en huerto.glb, y el respaldo para lo que falte.
const modelos = { plantillas: {}, clips: [] };

async function cargarModelos() {
	try {
		const gltf = await new GLTFLoader().loadAsync("/3d/modelos/huerto.glb");
		for (const nombre of Object.keys(RESPALDO)) {
			const obj = gltf.scene.getObjectByName(nombre);
			if (obj) {
				obj.traverse((o) => {
					if (o.isMesh) {
						o.castShadow = true;
						o.receiveShadow = true;
					}
				});
				modelos.plantillas[nombre] = obj;
			}
		}
		modelos.clips = gltf.animations;
	} catch (e) {
		console.info("[huerto3d] sin huerto.glb, se usan las figuras simples:", e.message);
	}
}

function nuevo(nombre) {
	const plantilla = modelos.plantillas[nombre];
	if (!plantilla) {
		return RESPALDO[nombre]();
	}
	const copia = SkeletonUtils.clone(plantilla);
	copia.position.set(0, 0, 0);
	copia.rotation.set(0, 0, 0);
	return copia;
}

/* -------------------------------------------------------------- ESCENA */

let renderer, escena, camara, controles, reloj;
let contenedor = null;
let tablero = null; // { filas, columnas, variante, casillas: Map("f,c" → {letra, grupo, cultivo}) }
let kyra = null;    // { raiz, partes, mixer, acciones, actual }
let tweens = [];
let encuadreUsuario = false;
let cargado = false; // dibujar espera a que estén los modelos

function montar(elemento) {
	contenedor = elemento;
	renderer = new THREE.WebGLRenderer({ antialias: true });
	renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
	renderer.shadowMap.enabled = true;
	renderer.shadowMap.type = THREE.PCFShadowMap;
	renderer.toneMapping = THREE.ACESFilmicToneMapping;
	renderer.toneMappingExposure = 1.5;
	contenedor.append(renderer.domElement);

	escena = new THREE.Scene();
	escena.background = new THREE.Color(COLORES.fondo);
	escena.fog = new THREE.Fog(COLORES.fondo, 18, 40);

	camara = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
	controles = new OrbitControls(camara, renderer.domElement);
	controles.enableDamping = true;
	controles.maxPolarAngle = Math.PI * 0.47;
	controles.minDistance = 2;
	controles.maxDistance = 25;
	// Solo cuenta como encuadre propio si la cámara de verdad se movió (un
	// clic suelto sobre la escena no la deja fija).
	const alEmpezar = new THREE.Vector3();
	controles.addEventListener("start", () => alEmpezar.copy(camara.position));
	controles.addEventListener("end", () => {
		if (camara.position.distanceTo(alEmpezar) > 0.05) encuadreUsuario = true;
	});
	renderer.domElement.addEventListener("dblclick", () => reencuadrar());

	escena.add(new THREE.HemisphereLight(0xe0fff0, 0x1a2a20, 2.2));
	const sol = new THREE.DirectionalLight(0xfff2dd, 3.2);
	sol.position.set(4, 9, 6);
	sol.castShadow = true;
	sol.shadow.mapSize.set(2048, 2048);
	sol.shadow.camera.left = sol.shadow.camera.bottom = -8;
	sol.shadow.camera.right = sol.shadow.camera.top = 8;
	sol.shadow.bias = -0.0005;
	const relleno = new THREE.DirectionalLight(0x6dffa0, 0.8);
	relleno.position.set(-5, 4, -6);
	escena.add(sol, sol.target, relleno);
	escena.userData.sol = sol;

	const suelo = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), material(0x0c1a12, { roughness: 1 }));
	suelo.rotation.x = -Math.PI / 2;
	suelo.position.y = -0.07;
	suelo.receiveShadow = true;
	escena.add(suelo);

	reloj = new THREE.Timer();
	new ResizeObserver(redimensionar).observe(contenedor);
	redimensionar();
	renderer.setAnimationLoop(cuadro);
	return cargarModelos().then(() => { cargado = true; });
}

function redimensionar() {
	const ancho = contenedor.clientWidth, alto = contenedor.clientHeight;
	if (ancho === 0 || alto === 0) return;
	renderer.setSize(ancho, alto, false);
	camara.aspect = ancho / alto;
	camara.updateProjectionMatrix();
	if (!encuadreUsuario && tablero) reencuadrar();
}

// La casilla (fila, columna) queda en x = columna, z = fila, centrada.
function lugar(fila, columna) {
	return new THREE.Vector3(columna - (tablero.columnas - 1) / 2, 0, fila - (tablero.filas - 1) / 2);
}

// reencuadrar pone la cámara en 3/4 desde el sur, a la distancia justa para
// ver todo el tablero.
function reencuadrar() {
	if (!tablero) return;
	encuadreUsuario = false;
	// Se acerca la cámara hasta que alguna esquina del tablero quede en el
	// borde de la imagen (los postes de la cerca pueden quedar cortados).
	const x = tablero.columnas / 2 + 0.1, z = tablero.filas / 2 + 0.1;
	const esquinas = [];
	for (const sx of [-x, x]) for (const sz of [-z, z]) for (const y of [0, 0.6]) esquinas.push(new THREE.Vector3(sx, y, sz));
	const dir = new THREE.Vector3(0.25, 1.45, 1).normalize();
	const poner = (d) => {
		camara.position.copy(dir).multiplyScalar(d).add(controles.target);
		camara.lookAt(controles.target);
		camara.updateMatrixWorld();
		return esquinas.map((e) => e.clone().project(camara));
	};
	const cabe = (d) => poner(d).every((p) => Math.abs(p.x) <= 0.95 && Math.abs(p.y) <= 0.92 && p.z < 1);
	// La perspectiva agranda el lado cercano: se corre el centro hacia el
	// sur hasta que el tablero quede centrado en la imagen, y se ajusta otra vez.
	controles.target.set(0, 0, 0);
	let d = 40;
	for (let vuelta = 0; vuelta < 4; vuelta++) {
		d = 40;
		while (d > 2 && cabe(d * 0.97)) d *= 0.97;
		const ys = poner(d).map((p) => p.y);
		const centro = (Math.max(...ys) + Math.min(...ys)) / 2;
		controles.target.z -= centro * z * 0.8;
	}
	poner(d);
	controles.update();
}

/* ------------------------------------------------------------- TABLERO */

function construirTablero(foto) {
	const filas = foto.tablero.length, columnas = foto.tablero[0].length;
	const otroTamano = !tablero || tablero.filas !== filas || tablero.columnas !== columnas;
	if (tablero) escena.remove(tablero.grupo);
	tablero = { filas, columnas, variante: foto.variante, casillas: new Map(), grupo: new THREE.Group() };
	escena.add(tablero.grupo);

	for (let f = 0; f < filas; f++) {
		for (let c = 0; c < columnas; c++) {
			const piso = nuevo("Piso");
			piso.position.copy(lugar(f, c));
			tablero.grupo.add(piso);
			const casilla = { letra: null, grupo: new THREE.Group(), cultivo: null };
			casilla.grupo.position.copy(lugar(f, c));
			tablero.grupo.add(casilla.grupo);
			tablero.casillas.set(f + "," + c, casilla);
			ponerLetra(casilla, foto.tablero[f][c], false);
		}
	}
	// Una cerca de postes con luz alrededor del refugio.
	for (let f = -1; f <= filas; f++) {
		for (let c = -1; c <= columnas; c++) {
			if (f >= 0 && f < filas && c >= 0 && c < columnas) continue;
			if ((f + c) % 2 !== 0) continue;
			const poste = nuevo("Poste");
			poste.traverse((o) => { o.castShadow = false; });
			poste.position.copy(lugar(f, c));
			tablero.grupo.add(poste);
		}
	}
	const sol = escena.userData.sol;
	const lado = Math.max(filas, columnas) / 2 + 2;
	sol.shadow.camera.left = sol.shadow.camera.bottom = -lado;
	sol.shadow.camera.right = sol.shadow.camera.top = lado;
	sol.shadow.camera.updateProjectionMatrix();

	if (!kyra) crearKyra();
	if (otroTamano || !encuadreUsuario) reencuadrar();
}

const ALTURA_TIERRA = 0.14;

// ponerLetra cambia lo que hay en una casilla. animar hace que el cultivo
// nuevo aparezca creciendo.
function ponerLetra(casilla, letra, animar) {
	const antes = casilla.letra;
	casilla.letra = letra;
	const conBandeja = (l) => l !== "_" && l !== "#";
	if (antes === null || conBandeja(antes) !== conBandeja(letra) || antes === "#" || letra === "#") {
		casilla.grupo.clear();
		casilla.cultivo = null;
		if (letra === "#") casilla.grupo.add(nuevo("Tanque"));
		if (conBandeja(letra)) casilla.grupo.add(nuevo("Bandeja"));
	}
	const cultivo = { b: "Brote", t: "Brote", L: "Lechuga", T: "Tomate" }[letra];
	if (casilla.cultivo) {
		casilla.grupo.remove(casilla.cultivo);
		casilla.cultivo = null;
	}
	if (cultivo) {
		const obj = nuevo(cultivo);
		obj.position.y = ALTURA_TIERRA;
		obj.rotation.y = Math.random() * Math.PI * 2;
		casilla.grupo.add(obj);
		casilla.cultivo = obj;
		if (animar) animar1(220, (k) => obj.scale.setScalar(Math.max(0.01, facil.rebote(k))));
	}
}

/* --------------------------------------------------------------- KYRA */

function crearKyra() {
	const raiz = new THREE.Group();
	const modelo = nuevo("Kyra");
	modelo.scale.setScalar(1.2); // un poco más grande que la casilla se lee mejor
	raiz.add(modelo);
	escena.add(raiz);
	const partes = {};
	for (const nombre of ["cuerpo", "cabeza", "cola", "oreja_i", "oreja_d", "pata_di", "pata_dd", "pata_ti", "pata_td"]) {
		const p = modelo.getObjectByName(nombre);
		if (p) partes[nombre] = { obj: p, rot: p.rotation.clone(), pos: p.position.clone() };
	}
	kyra = { raiz, modelo, partes, mixer: null, acciones: {}, actual: null, giro: 0 };
	if (modelos.clips.length > 0) {
		kyra.mixer = new THREE.AnimationMixer(modelo);
		for (const clip of modelos.clips) kyra.acciones[clip.name] = kyra.mixer.clipAction(clip);
	}
	clip("quieta");
}

// clip pone una animación de Blender (si existe) y dice si la puso.
function clip(nombre, duracionMs, unaVez) {
	const accion = kyra.acciones[nombre];
	if (!accion) return false;
	if (kyra.actual && kyra.actual !== accion) kyra.actual.fadeOut(0.12);
	accion.reset();
	accion.setLoop(unaVez ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
	accion.clampWhenFinished = true;
	accion.timeScale = duracionMs ? accion.getClip().duration / (duracionMs / 1000) : 1;
	accion.fadeIn(0.12).play();
	kyra.actual = accion;
	return true;
}

function restaurarPartes() {
	for (const { obj, rot, pos } of Object.values(kyra.partes)) {
		obj.rotation.copy(rot);
		obj.position.copy(pos);
	}
	kyra.modelo.position.set(0, 0, 0);
	kyra.modelo.rotation.set(0, 0, 0);
}

// Animaciones hechas en código: sirven para las figuras simples y para un
// modelo sin clips. Cada una recibe k de 0 a 1.
const parte = (n) => kyra.partes[n]?.obj;
const base = (n) => kyra.partes[n];
const PROCEDURALES = {
	caminar(k) {
		const s = Math.sin(k * Math.PI * 4);
		for (const [n, signo] of [["pata_di", 1], ["pata_td", 1], ["pata_dd", -1], ["pata_ti", -1]]) {
			if (parte(n)) parte(n).rotation.x = base(n).rot.x + s * 0.6 * signo;
		}
		kyra.modelo.position.y = Math.abs(s) * 0.04;
		if (parte("cola")) parte("cola").rotation.y = s * 0.5;
	},
	plantar(k) {
		const a = Math.sin(k * Math.PI);
		if (parte("cabeza")) parte("cabeza").rotation.x = base("cabeza").rot.x + a * 0.7;
		kyra.modelo.rotation.x = a * 0.15;
	},
	cosechar(k) {
		const a = Math.sin(k * Math.PI);
		kyra.modelo.position.y = a * 0.25;
		if (parte("cabeza")) parte("cabeza").rotation.x = base("cabeza").rot.x - a * 0.4;
		if (parte("cola")) parte("cola").rotation.y = Math.sin(k * Math.PI * 6) * 0.7;
	},
	mirar(k) {
		const a = Math.sin(k * Math.PI);
		if (parte("cabeza")) {
			parte("cabeza").rotation.x = base("cabeza").rot.x + a * 0.5;
			parte("cabeza").rotation.z = Math.sin(k * Math.PI * 2) * 0.25;
		}
	},
	esperar(k) {
		if (parte("cola")) parte("cola").rotation.y = Math.sin(k * Math.PI * 4) * 0.6;
		for (const n of ["oreja_i", "oreja_d"]) if (parte(n)) parte(n).rotation.x = base(n).rot.x + Math.sin(k * Math.PI) * 0.4;
	},
	reportar(k) {
		const a = Math.sin(k * Math.PI);
		kyra.modelo.rotation.x = -a * 0.35;
		if (parte("cabeza")) parte("cabeza").rotation.x = base("cabeza").rot.x - a * 0.5;
	},
	chocar(k) {
		const ida = k < 0.35 ? k / 0.35 : 1 - (k - 0.35) / 0.65;
		kyra.modelo.position.z = facil.salida(ida) * 0.3;
		kyra.modelo.rotation.z = k > 0.35 ? Math.sin(k * Math.PI * 8) * 0.15 * (1 - k) : 0;
	},
	celebrar(k) {
		kyra.modelo.position.y = Math.abs(Math.sin(k * Math.PI * 2)) * 0.4;
		kyra.modelo.rotation.y = facil.suave(k) * Math.PI * 2;
		if (parte("cola")) parte("cola").rotation.y = Math.sin(k * Math.PI * 10) * 0.8;
	},
	triste(k) {
		const a = facil.suave(Math.min(1, k * 2));
		if (parte("cabeza")) parte("cabeza").rotation.x = base("cabeza").rot.x + a * 0.6;
		if (parte("cola")) parte("cola").rotation.x = base("cola").rot.x + a * 0.9;
		for (const n of ["oreja_i", "oreja_d"]) if (parte(n)) parte(n).rotation.z = (n === "oreja_i" ? 1 : -1) * a * 0.8;
	},
};

// accion hace que Kyra haga una animación durante ms milisegundos: el clip de
// Blender si existe, y si no, la versión en código.
function accion(nombre, ms, final) {
	if (clip(nombre, ms, true)) {
		// Al final de la partida, Kyra se queda en la última pose.
		if (!final) animar1(ms, () => {}, () => clip("quieta"));
		return;
	}
	const fn = PROCEDURALES[nombre];
	if (!fn) return;
	animar1(ms, (k) => { restaurarPartes(); fn(k); }, () => { if (!final) restaurarPartes(); });
}

/* -------------------------------------------------------------- TWEENS */

function animar1(ms, fn, alTerminar) {
	tweens.push({ inicio: performance.now(), ms: Math.max(1, ms), fn, alTerminar });
}

function terminarTweens() {
	const pendientes = tweens;
	tweens = [];
	for (const t of pendientes) {
		t.fn(1);
		t.alTerminar?.();
	}
}

function cuadro() {
	const ahora = performance.now();
	const actuales = tweens;
	tweens = [];
	const vivos = [];
	for (const t of actuales) {
		const k = Math.min(1, (ahora - t.inicio) / t.ms);
		t.fn(k);
		if (k < 1) vivos.push(t);
		else t.alTerminar?.();
	}
	tweens = vivos.concat(tweens); // más los que se crearon al terminar otros
	reloj.update();
	const dt = reloj.getDelta();
	if (kyra?.mixer) kyra.mixer.update(dt);
	controles.update();
	renderer.render(escena, camara);
}

/* ------------------------------------------------------------- DIBUJAR */

// dibujar muestra una foto. Con la anterior, anima el cambio en ms.
function dibujar(foto, anterior, ms) {
	if (!cargado) return;
	terminarTweens();
	const nuevaPartida = !anterior || !tablero || anterior.variante !== foto.variante ||
		tablero.filas !== foto.tablero.length || tablero.columnas !== foto.tablero[0].length;
	if (!tablero || nuevaPartida) {
		construirTablero(foto);
		anterior = null;
	}
	const animar = anterior !== null && ms >= 60;
	const dur = Math.max(1, ms * 0.85);

	// Las casillas que cambiaron.
	foto.tablero.forEach((fila, f) => {
		[...fila].forEach((letra, c) => {
			const casilla = tablero.casillas.get(f + "," + c);
			if (casilla.letra === letra) return;
			const cosechado = animar && "LT".includes(casilla.letra) && letra === ".";
			if (cosechado && casilla.cultivo) {
				// El cultivo sube hacia Kyra y desaparece.
				const obj = casilla.cultivo;
				casilla.cultivo = null;
				animar1(dur, (k) => {
					obj.position.y = ALTURA_TIERRA + facil.salida(k) * 0.9;
					obj.rotation.y += 0.15;
					obj.scale.setScalar(Math.max(0.01, 1 - k * k));
				}, () => casilla.grupo.remove(obj));
			}
			ponerLetra(casilla, letra, animar);
		});
	});

	// Kyra. Sobre una bandeja camina por encima de la tierra.
	const destino = lugar(foto.kyra.fila, foto.kyra.columna);
	if (foto.tablero[foto.kyra.fila][foto.kyra.columna] !== "_") destino.y = ALTURA_TIERRA;
	const comando = foto.comando || "";
	const nombre = comando.slice(0, comando.indexOf("(")) || null;
	const rumbo = /^mover\("(\w+)"\)/.exec(comando)?.[1];
	const delta = RUMBOS[rumbo];
	if (delta) kyra.giro = giroDe(delta.fila, delta.columna);

	if (!animar) {
		restaurarPartes();
		kyra.raiz.position.copy(destino);
		kyra.raiz.rotation.y = kyra.giro;
		if (!anterior) {
			kyra.giro = 0;
			kyra.raiz.rotation.y = 0;
		}
		clip("quieta");
		return;
	}

	const desde = kyra.raiz.position.clone();
	const giroDesde = kyra.raiz.rotation.y;
	let giroHasta = kyra.giro;
	while (giroHasta - giroDesde > Math.PI) giroHasta -= Math.PI * 2;
	while (giroHasta - giroDesde < -Math.PI) giroHasta += Math.PI * 2;
	const cambio = desde.distanceTo(destino) > 0.01;

	if (nombre === "mover" && cambio) {
		if (!clip("caminar", dur)) animar1(dur, (k) => { restaurarPartes(); PROCEDURALES.caminar(k); }, restaurarPartes);
		animar1(dur, (k) => {
			kyra.raiz.rotation.y = giroDesde + (giroHasta - giroDesde) * facil.suave(Math.min(1, k * 3));
			kyra.raiz.position.lerpVectors(desde, destino, facil.suave(k));
		}, () => clip("quieta"));
	} else if (nombre === "mover") {
		animar1(dur * 0.3, (k) => { kyra.raiz.rotation.y = giroDesde + (giroHasta - giroDesde) * facil.suave(k); });
		accion("chocar", dur);
	} else if (nombre) {
		accion(nombre, dur);
	}
}

// final muestra cómo terminó la partida: "gano", "error" o "falta".
function final(tipo) {
	if (!kyra) return;
	terminarTweens();
	if (tipo === "gano") accion("celebrar", 1400, true);
	else accion("triste", 900, true);
}

// depurar sirve para revisar la escena desde la consola del navegador.
const depurar = () => ({ THREE, escena, camara, controles, kyra, tablero });
window.Huerto3D = { montar, dibujar, final, reencuadrar, depurar };
window.dispatchEvent(new Event("huerto3d-listo"));
