// Módulo juego tiene las REGLAS del huerto de Kyra: el tablero, los pasos, los
// cultivos, las metas y las estrellas.
//
// Es lógica pura: no conoce al intérprete ni al navegador, solo recibe un
// estado y lo cambia. Por eso se puede probar sin ejecutar ningún programa.
// El puente con el lenguaje está en comandos.ts.
//
// La regla central del juego es una sola:
//
//	cada comando = 1 paso = 1 ciclo
//
// Al empezar cada paso, todos los brotes crecen un ciclo; después se hace la
// acción. Así, con 3 ciclos para crecer, el tercer comando después de
// plantar() ya encuentra el cultivo listo:
//
//	plantar(); esperar(); esperar(); cosechar();

// Ciclos que tarda un brote en estar listo.
export const CICLOS_PARA_CRECER = 3;

// Los comandos que existen en el juego (cada nivel habilita algunos).
export const COMANDOS = ["mover", "plantar", "cosechar", "mirar", "esperar", "reportar"] as const;
export type Comando = (typeof COMANDOS)[number];

// Cuánto cambia la posición de Kyra con cada dirección.
const DIRECCIONES: Record<string, { fila: number; columna: number }> = {
	norte: { fila: -1, columna: 0 },
	sur: { fila: 1, columna: 0 },
	este: { fila: 0, columna: 1 },
	oeste: { fila: 0, columna: -1 },
};

export type TipoCasilla = "pasillo" | "tierra" | "brote" | "listo" | "tanque";

export interface Casilla {
	tipo: TipoCasilla;
	cultivo: string | null; // qué crece aquí (solo en brote y listo)
	restantes: number;      // ciclos que le faltan a un brote
}

// Cada casilla se escribe con una letra, tanto en los mapas de los niveles
// como en las fotos que se le mandan al navegador.
const LETRAS: Record<string, Omit<Casilla, "restantes">> = {
	"_": { tipo: "pasillo", cultivo: null },
	".": { tipo: "tierra", cultivo: null },
	"#": { tipo: "tanque", cultivo: null },
	"b": { tipo: "brote", cultivo: "lechuga" },
	"t": { tipo: "brote", cultivo: "tomate" },
	"L": { tipo: "listo", cultivo: "lechuga" },
	"T": { tipo: "listo", cultivo: "tomate" },
};

export interface Posicion {
	fila: number;
	columna: number;
}

// Tablero es cómo empieza un nivel: un mapa de letras y el lugar de Kyra.
export interface Tablero {
	mapa: string[];
	inicio: Posicion;
}

// Estado es la partida en curso.
export interface Estado {
	casillas: Casilla[][];
	kyra: Posicion;
	pasos: number;
	topePasos: number;
	cosechas: Map<string, number>; // cuánto se ha cosechado de cada cultivo
	reportado: boolean;            // si ya se entregó un inventario correcto
}

// Meta es lo que hay que lograr para ganar (null en el modo libre).
export interface Meta {
	cosechas: number;
	reportar?: boolean;
}

// Par son las marcas que dan estrellas extra.
export interface Par {
	pasos: number;
	lineas: number;
}

// Accion es lo que devuelve un comando: su valor, o el error que detiene a
// Kyra (chocar, cosechar lo que no está listo, ...).
export type Accion = { ok: true; valor: string | null } | { ok: false; error: string };

// Evento es una FOTO del juego después de un comando. El navegador solo las
// reproduce en orden: no necesita conocer ninguna regla.
export interface Evento {
	variante: number;       // en qué tablero del nivel ocurrió
	comando: string | null; // lo que se hizo (null en la foto inicial)
	linea: number | null;   // la línea del programa que lo pidió
	tablero: string[];      // las casillas, con las mismas letras de los mapas
	kyra: Posicion;
	pasos: number;
	cosechas: number;
	dice?: string;          // lo que Kyra dijo con print (solo en esas fotos)
}

const bien = (valor: string | null = null): Accion => ({ ok: true, valor });
const fallo = (error: string): Accion => ({ ok: false, error });

// crearEstado arma la partida inicial de un tablero.
export function crearEstado(tablero: Tablero, topePasos: number): Estado {
	return {
		casillas: tablero.mapa.map((fila) => [...fila].map(casillaDeLetra)),
		kyra: { ...tablero.inicio },
		pasos: 0,
		topePasos,
		cosechas: new Map(),
		reportado: false,
	};
}

function casillaDeLetra(letra: string): Casilla {
	const casilla = LETRAS[letra];
	if (casilla === undefined) {
		throw new Error(`letra de mapa desconocida: ${letra}`);
	}
	return { ...casilla, restantes: casilla.tipo === "brote" ? CICLOS_PARA_CRECER : 0 };
}

function letraDeCasilla(casilla: Casilla): string {
	const letra = Object.keys(LETRAS).find(
		(l) => LETRAS[l].tipo === casilla.tipo && LETRAS[l].cultivo === casilla.cultivo,
	);
	return letra ?? "?";
}

// gastarPaso cuenta un paso y hace crecer los brotes. Devuelve el error de
// la batería si Kyra ya usó todos sus pasos: así un ciclo infinito que llame
// comandos se detiene solo.
function gastarPaso(estado: Estado): string | null {
	if (estado.pasos >= estado.topePasos) {
		return `Kyra se quedó sin batería: pasó de ${estado.topePasos} pasos. ¿Hay un ciclo infinito?`;
	}
	estado.pasos += 1;
	for (const fila of estado.casillas) {
		for (const casilla of fila) {
			if (casilla.tipo === "brote") {
				casilla.restantes -= 1;
				if (casilla.restantes <= 0) {
					casilla.tipo = "listo";
				}
			}
		}
	}
	return null;
}

function casillaDeKyra(estado: Estado): Casilla {
	return estado.casillas[estado.kyra.fila][estado.kyra.columna];
}

// mover lleva a Kyra a la casilla vecina en esa dirección.
export function mover(estado: Estado, direccion: string): Accion {
	const delta = Object.hasOwn(DIRECCIONES, direccion) ? DIRECCIONES[direccion] : undefined;
	if (delta === undefined) {
		return fallo(`dirección desconocida: "${direccion}" (use norte, sur, este u oeste)`);
	}
	const sinBateria = gastarPaso(estado);
	if (sinBateria !== null) {
		return fallo(sinBateria);
	}
	const fila = estado.kyra.fila + delta.fila;
	const columna = estado.kyra.columna + delta.columna;
	const destino = estado.casillas[fila]?.[columna];
	if (destino === undefined) {
		return fallo(`Kyra chocó con la cerca del refugio al ir al ${direccion}`);
	}
	if (destino.tipo === "tanque") {
		return fallo(`Kyra chocó con un tanque de agua al ir al ${direccion}`);
	}
	estado.kyra = { fila, columna };
	return bien();
}

// plantar siembra una lechuga en la casilla de Kyra (tiene que ser tierra).
export function plantar(estado: Estado): Accion {
	const sinBateria = gastarPaso(estado);
	if (sinBateria !== null) {
		return fallo(sinBateria);
	}
	const casilla = casillaDeKyra(estado);
	if (casilla.tipo !== "tierra") {
		return fallo(`aquí no se puede plantar: esta casilla es ${casilla.tipo}`);
	}
	casilla.tipo = "brote";
	casilla.cultivo = "lechuga";
	casilla.restantes = CICLOS_PARA_CRECER;
	return bien();
}

// cosechar recoge el cultivo de la casilla de Kyra y devuelve su nombre. La
// casilla vuelve a ser tierra.
export function cosechar(estado: Estado): Accion {
	const sinBateria = gastarPaso(estado);
	if (sinBateria !== null) {
		return fallo(sinBateria);
	}
	const casilla = casillaDeKyra(estado);
	if (casilla.tipo !== "listo" || casilla.cultivo === null) {
		return fallo(`aquí no hay nada listo para cosechar: esta casilla es ${casilla.tipo}`);
	}
	const cultivo = casilla.cultivo;
	estado.cosechas.set(cultivo, (estado.cosechas.get(cultivo) ?? 0) + 1);
	casilla.tipo = "tierra";
	casilla.cultivo = null;
	return bien(cultivo);
}

// mirar devuelve el tipo de la casilla de Kyra. Siempre es un texto: en el
// lenguaje, comparar null con un texto es un error.
export function mirar(estado: Estado): Accion {
	const sinBateria = gastarPaso(estado);
	if (sinBateria !== null) {
		return fallo(sinBateria);
	}
	return bien(casillaDeKyra(estado).tipo);
}

// esperar no hace nada: solo deja pasar un ciclo.
export function esperar(estado: Estado): Accion {
	const sinBateria = gastarPaso(estado);
	return sinBateria === null ? bien() : fallo(sinBateria);
}

// reportar compara el inventario que llevó el programa con lo que Kyra
// cosechó de verdad.
export function reportar(estado: Estado, inventario: Map<string, number>): Accion {
	const sinBateria = gastarPaso(estado);
	if (sinBateria !== null) {
		return fallo(sinBateria);
	}
	const cultivos = new Set([...estado.cosechas.keys(), ...inventario.keys()]);
	for (const cultivo of cultivos) {
		const real = estado.cosechas.get(cultivo) ?? 0;
		const dicho = inventario.get(cultivo) ?? 0;
		if (real !== dicho) {
			return fallo(`inventario incorrecto: dice ${dicho} de ${cultivo}, pero Kyra cosechó ${real}`);
		}
	}
	estado.reportado = true;
	return bien();
}

// totalCosechas cuenta todo lo cosechado, sin importar el cultivo.
export function totalCosechas(estado: Estado): number {
	return [...estado.cosechas.values()].reduce((suma, n) => suma + n, 0);
}

// foto toma el Evento que describe cómo quedó el juego.
export function foto(estado: Estado, variante: number, comando: string | null, linea: number | null): Evento {
	return {
		variante,
		comando,
		linea,
		tablero: estado.casillas.map((fila) => fila.map(letraDeCasilla).join("")),
		kyra: { ...estado.kyra },
		pasos: estado.pasos,
		cosechas: totalCosechas(estado),
	};
}

// faltante dice qué le falta a la partida para cumplir la meta, o null si ya
// la cumplió.
export function faltante(estado: Estado, meta: Meta | null): string | null {
	if (meta === null) {
		return null;
	}
	const total = totalCosechas(estado);
	if (total < meta.cosechas) {
		return `Kyra cosechó ${total} de ${meta.cosechas}`;
	}
	if (meta.reportar === true && !estado.reportado) {
		return "falta entregar el inventario con reportar()";
	}
	return null;
}

// contarLineas cuenta las líneas que tienen código: no valen las vacías ni
// las que solo tienen un comentario.
export function contarLineas(codigo: string): number {
	return codigo.split(/\r?\n/).filter((linea) => {
		const texto = linea.trim();
		return texto !== "" && !texto.startsWith("//");
	}).length;
}

// calcularEstrellas da 1 estrella por ganar y una más por cada marca del par
// que se cumpla.
export function calcularEstrellas(par: Par | null, pasos: number, lineas: number): number {
	if (par === null) {
		return 1;
	}
	return 1 + (pasos <= par.pasos ? 1 : 0) + (lineas <= par.lineas ? 1 : 0);
}
