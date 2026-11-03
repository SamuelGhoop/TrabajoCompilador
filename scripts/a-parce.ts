// Genera la versión en "parce" (español colombiano) de cada ejemplo:
//
//	npm run parce      examples/X.ssg  →  examples/parce/X.ssg
//
// Cambia las palabras reservadas y las funciones integradas por sus
// sinónimos en parce (let → parce, if → pilas, print → diga, ...), en el
// código y en los comentarios. Los TEXTOS entre comillas no se tocan: así la
// versión en parce imprime exactamente lo mismo que la original, y una
// prueba (tests/programas.test.ts) lo comprueba. Si se cambia un ejemplo,
// basta con volver a correr este comando.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";

// Los ejemplos que ya son de un idioma concreto no se traducen.
const NO_TRADUCIR = new Set(["10_espanol.ssg", "11_parce.ssg"]);

// Palabra en inglés → palabra en parce (o en español, si no hay en parce).
// Son los mismos sinónimos de src/token/token.ts y src/evaluator/builtins.ts.
const PARCE: Record<string, string> = {
	let: "parce", function: "vuelta", return: "devuelva",
	if: "pilas", elif: "osea", else: "deResto",
	while: "dele", for: "pa", true: "deUna", false: "paila",
	print: "diga", len: "cuantos", type: "queEs",
	first: "primero", last: "ultimo", rest: "resto", push: "agregar",
	str: "texto", int: "entero",
};

// nombresDeclarados devuelve las variables y parámetros que declara el
// programa. Si un ejemplo tiene, por ejemplo, una variable llamada "texto",
// no se puede traducir str → texto (la llamada usaría la variable).
function nombresDeclarados(codigo: string): Set<string> {
	const nombres = new Set<string>();
	for (const m of codigo.matchAll(/\blet\s+([A-Za-z_]+)/g)) {
		nombres.add(m[1]);
	}
	for (const m of codigo.matchAll(/\bfunction\s*\(([^)]*)\)/g)) {
		m[1].split(",").map((p) => p.trim()).filter(Boolean).forEach((p) => nombres.add(p));
	}
	return nombres;
}

// traducir cambia las palabras del código y de los comentarios, pero copia
// tal cual lo que va entre comillas.
export function traducir(codigo: string): string {
	const ocupados = nombresDeclarados(codigo);
	const mapa = new Map(Object.entries(PARCE).filter(([, parce]) => !ocupados.has(parce)));
	// Se toman palabras COMPLETAS, con tildes y ñ incluidas (\p{L} es cualquier
	// letra): así "intérprete" es una sola palabra y no se confunde su "int"
	// con la función int.
	const cambiarPalabras = (texto: string) =>
		texto.replace(/[\p{L}_][\p{L}\p{N}_]*/gu, (palabra) => mapa.get(palabra) ?? palabra);

	// Se recorre el código en tramos: comentario (de // al final de la línea),
	// texto entre comillas, o código normal hasta el siguiente de los dos.
	let salida = "";
	let i = 0;
	while (i < codigo.length) {
		if (codigo.startsWith("//", i)) {
			const fin = codigo.indexOf("\n", i);
			const hasta = fin === -1 ? codigo.length : fin;
			salida += cambiarPalabras(codigo.slice(i, hasta));
			i = hasta;
		} else if (codigo[i] === '"') {
			const fin = codigo.indexOf('"', i + 1);
			const hasta = fin === -1 ? codigo.length : fin + 1;
			salida += codigo.slice(i, hasta); // el texto se copia sin cambios
			i = hasta;
		} else {
			let hasta = i;
			while (hasta < codigo.length && codigo[hasta] !== '"' && !codigo.startsWith("//", hasta)) {
				hasta++;
			}
			salida += cambiarPalabras(codigo.slice(i, hasta));
			i = hasta;
		}
	}
	return salida;
}

const origen = new URL("../examples/", import.meta.url);
const destino = new URL("parce/", origen);
mkdirSync(destino, { recursive: true });

for (const archivo of readdirSync(origen).filter((f) => f.endsWith(".ssg") && !NO_TRADUCIR.has(f)).sort()) {
	const codigo = readFileSync(new URL(archivo, origen), "utf8")
		.replace(`examples/${archivo}`, `examples/parce/${archivo}`);
	const encabezado = `// Versión en parce de examples/${archivo} (generada con: npm run parce).\n`;
	writeFileSync(new URL(archivo, destino), encabezado + traducir(codigo));
	console.log(`examples/parce/${archivo}`);
}
