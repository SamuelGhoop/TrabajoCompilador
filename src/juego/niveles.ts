// Módulo niveles define los niveles del huerto de Kyra. Un nivel es DATOS,
// no código: para agregar uno basta con escribir otro objeto en la lista.
//
// Los mapas usan las letras de juego.ts:
//
//	_ pasillo   . tierra   # tanque de agua
//	b brote de lechuga     t brote de tomate
//	L lechuga lista        T tomate listo
//
// solucion es un programa de referencia: las pruebas lo ejecutan con el
// intérprete real y revisan que gane con las 3 estrellas. No se le manda al
// navegador.
import type { Comando, Meta, Par, Tablero } from "./juego";

export interface Nivel {
	id: string;
	titulo: string;
	tema: string;             // qué parte del lenguaje enseña
	mision: string;           // qué hay que lograr
	pista: string;
	comandos: Comando[];      // los que están habilitados
	tableros: Tablero[];      // con varios, el programa debe ganar en todos
	topePasos: number;
	meta: Meta | null;        // null: modo libre
	par: Par | null;
	codigoInicial: string;
	solucion: string;
}

export const niveles: Nivel[] = [
	{
		id: "secuencia",
		titulo: "PRIMERA COSECHA",
		tema: "SECUENCIA Y VARIABLES",
		mision: "Lleve a Kyra hasta la bandeja de tierra, plante y coseche una lechuga.",
		pista: "Son tres pasos al este. Después de plantar() hay que esperar() dos veces antes de cosechar().",
		comandos: ["mover", "plantar", "cosechar", "esperar"],
		tableros: [{
			mapa: [
				"_____",
				"___._",
				"_____",
			],
			inicio: { fila: 1, columna: 0 },
		}],
		topePasos: 200,
		meta: { cosechas: 1 },
		par: { pasos: 7, lineas: 8 },
		codigoInicial: `// NIVEL 1: un comando por línea, de arriba hacia abajo.
// Cada comando gasta un paso, y en cada paso los brotes crecen un ciclo.
// Una variable evita repetir un texto:

let rumbo = "este";
mover(rumbo);

// Siga usted: llegue a la tierra, plantar(), esperar() y cosechar().
`,
		solucion: `let rumbo = "este";
mover(rumbo);
mover(rumbo);
mover(rumbo);
plantar();
esperar();
esperar();
cosechar();
`,
	},
	{
		id: "condicionales",
		titulo: "KYRA DECIDE",
		tema: "CONDICIONALES",
		mision: "Coseche una lechuga en los 3 tableros: el mismo programa debe servir si la bandeja tiene tierra, un brote o una lechuga lista.",
		pista: "Guarde mirar() en una variable y compárela con \"listo\" y con \"brote\". Mirar también gasta un paso, así que el brote ya creció un ciclo.",
		comandos: ["mirar", "plantar", "cosechar", "esperar"],
		tableros: [
			{ mapa: ["___", "_._", "___"], inicio: { fila: 1, columna: 1 } },
			{ mapa: ["___", "_b_", "___"], inicio: { fila: 1, columna: 1 } },
			{ mapa: ["___", "_L_", "___"], inicio: { fila: 1, columna: 1 } },
		],
		topePasos: 200,
		meta: { cosechas: 1 },
		par: { pasos: 5, lineas: 12 },
		codigoInicial: `// NIVEL 2: mirar() devuelve lo que hay bajo Kyra, como texto:
// "tierra", "brote", "listo" o "pasillo".
// Este programa corre en 3 tableros distintos: decida con if / elif / else.

let estado = mirar();
if (estado == "listo") {
    cosechar();
} elif (estado == "brote") {
    // ¿Qué hace Kyra con un brote?
} else {
    // ¿Y con tierra vacía?
}
`,
		solucion: `let estado = mirar();
if (estado == "listo") {
    cosechar();
} elif (estado == "brote") {
    esperar();
    cosechar();
} else {
    plantar();
    esperar();
    esperar();
    cosechar();
}
`,
	},
	{
		id: "ciclos",
		titulo: "LA FILA LARGA",
		tema: "CICLOS",
		mision: "Plante las 6 casillas de tierra y coseche las 6 lechugas.",
		pista: "Un for planta y avanza 5 veces. Un while (mirar() != \"listo\") espera la última. Otro for se devuelve cosechando.",
		comandos: ["mover", "plantar", "cosechar", "mirar", "esperar"],
		tableros: [{
			mapa: [
				"______",
				"......",
				"______",
			],
			inicio: { fila: 1, columna: 0 },
		}],
		topePasos: 200,
		meta: { cosechas: 6 },
		par: { pasos: 25, lineas: 13 },
		codigoInicial: `// NIVEL 3: for repite un número de veces; while repite mientras
// una condición sea verdadera. Nota: el lenguaje no tiene break.

for (let i = 0; i < 5; i = i + 1) {
    plantar();
    mover("este");
}
plantar();

// Espere la última lechuga con un while y devuélvase cosechando con un for.
`,
		solucion: `for (let i = 0; i < 5; i = i + 1) {
    plantar();
    mover("este");
}
plantar();
while (mirar() != "listo") {
    esperar();
}
cosechar();
for (let j = 0; j < 5; j = j + 1) {
    mover("oeste");
    cosechar();
}
`,
	},
	{
		id: "funciones",
		titulo: "TRES FILAS",
		tema: "FUNCIONES",
		mision: "Coseche las 15 lechugas. Defina cosecharFila(rumbo) y úsela tres veces.",
		pista: "cosecharFila cosecha 5 casillas avanzando en el rumbo que recibe. Entre filas son dos pasos al sur, y el rumbo cambia.",
		comandos: ["mover", "cosechar", "mirar", "esperar"],
		tableros: [{
			mapa: [
				"LLLLL",
				"_____",
				"LLLLL",
				"_____",
				"LLLLL",
			],
			inicio: { fila: 0, columna: 0 },
		}],
		topePasos: 200,
		meta: { cosechas: 15 },
		par: { pasos: 31, lineas: 14 },
		codigoInicial: `// NIVEL 4: una función guarda un trabajo para reutilizarlo.
// El parámetro rumbo permite recorrer la fila hacia cualquier lado.

let cosecharFila = function(rumbo) {
    cosechar();
    // Complete: avance y coseche las otras 4 casillas.
};

cosecharFila("este");
// Baje a la siguiente fila y úsela de nuevo.
`,
		solucion: `let cosecharFila = function(rumbo) {
    cosechar();
    for (let i = 0; i < 4; i = i + 1) {
        mover(rumbo);
        cosechar();
    }
};
cosecharFila("este");
mover("sur");
mover("sur");
cosecharFila("oeste");
mover("sur");
mover("sur");
cosecharFila("este");
`,
	},
	{
		id: "estructuras",
		titulo: "EL INVENTARIO",
		tema: "ARREGLOS Y HASHES",
		mision: "Siga la ruta entre los tanques, coseche los 5 cultivos y entregue el inventario con reportar(inventario).",
		pista: "Recorra el arreglo plan con un for. cosechar() devuelve el nombre del cultivo: úselo como clave, inventario[c] = inventario[c] + 1.",
		comandos: ["mover", "cosechar", "mirar", "esperar", "reportar"],
		tableros: [{
			mapa: [
				"L__##",
				"##T##",
				"##_L#",
				"###_#",
				"#L_T#",
			],
			inicio: { fila: 0, columna: 0 },
		}],
		topePasos: 200,
		meta: { cosechas: 5, reportar: true },
		par: { pasos: 25, lineas: 14 },
		codigoInicial: `// NIVEL 5: un arreglo guarda el plan de la ruta y un hash cuenta
// lo cosechado. cosechar() devuelve "lechuga" o "tomate".

let plan = ["este", "este", "sur"]; // complete la ruta
let inventario = {"lechuga": 0, "tomate": 0};

let revisar = function() {
    if (mirar() == "listo") {
        let cultivo = cosechar();
        inventario[cultivo] = inventario[cultivo] + 1;
    }
};

revisar();
for (let i = 0; i < len(plan); i = i + 1) {
    mover(plan[i]);
    revisar();
}
reportar(inventario);
`,
		solucion: `let plan = ["este", "este", "sur", "sur", "este", "sur", "sur", "oeste", "oeste"];
let inventario = {"lechuga": 0, "tomate": 0};
let revisar = function() {
    if (mirar() == "listo") {
        let cultivo = cosechar();
        inventario[cultivo] = inventario[cultivo] + 1;
    }
};
revisar();
for (let i = 0; i < len(plan); i = i + 1) {
    mover(plan[i]);
    revisar();
}
reportar(inventario);
`,
	},
	{
		id: "libre",
		titulo: "MODO LIBRE",
		tema: "TODO EL LENGUAJE",
		mision: "Sin meta: el huerto es suyo. ¿Cuántas lechugas puede cosechar Kyra con una batería de 2000 pasos?",
		pista: "Combine todo: funciones, ciclos y arreglos. Pruebe recorrer el tablero en zigzag.",
		comandos: ["mover", "plantar", "cosechar", "mirar", "esperar", "reportar"],
		tableros: [{
			mapa: [
				"......",
				"......",
				"......",
				"......",
				"......",
				"......",
			],
			inicio: { fila: 0, columna: 0 },
		}],
		topePasos: 2000,
		meta: null,
		par: null,
		codigoInicial: `// MODO LIBRE: todos los comandos, sin meta.
// También funciona print(), y puede escribir en español o en parce.

parce rumbo = "este";
pa (parce i = 0; i < 5; i = i + 1) {
    plantar();
    mover(rumbo);
}
diga("Kyra dio", i, "vueltas");
`,
		solucion: `plantar();
esperar();
esperar();
cosechar();
`,
	},
];

// nivelPorId busca un nivel por su id (undefined si no existe).
export function nivelPorId(id: string): Nivel | undefined {
	return niveles.find((n) => n.id === id);
}

// nivelesParaInterfaz devuelve los niveles sin la solución.
export function nivelesParaInterfaz(): Omit<Nivel, "solucion">[] {
	return niveles.map(({ solucion: _solucion, ...nivel }) => nivel);
}
