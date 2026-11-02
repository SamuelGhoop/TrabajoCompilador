// Módulo repl implementa el REPL (Read-Eval-Print Loop) de CatCompiler:
// un ciclo interactivo que
//
//	Read  → lee una línea que escribe el usuario,
//	Eval  → la procesa (por ahora con el lexer o con el parser, todavía no
//	        hay evaluador),
//	Print → muestra el resultado,
//	Loop  → y vuelve a empezar.
//
// El REPL tiene dos MODOS:
//   - lexer:  muestra la lista de tokens de la línea.
//   - parser: muestra el programa reconstruido y el AST en forma de árbol,
//     o los errores de sintaxis si los hay.
//
// El modo se elige al iniciar y se puede cambiar con los comandos :lexer y
// :parser. Los comandos del REPL empiezan con ':' para no confundirse con
// código del lenguaje.
import * as readline from "node:readline";
import type { Readable, Writable } from "node:stream";

import * as ast from "../ast/ast";
import { Lexer } from "../lexer/lexer";
import { Parser } from "../parser/parser";
import * as token from "../token/token";

// Modos de funcionamiento del REPL. Se usa el mismo texto en el prompt
// ("lexer>> " o "parser>> ") para que el usuario sepa en qué modo está.
const modoLexer = "lexer";
const modoParser = "parser";
type Modo = typeof modoLexer | typeof modoParser;

// LectorDeLineas entrega la entrada línea por línea; devuelve null cuando
// la entrada se termina (por ejemplo al presionar Ctrl+D). Cumple el papel
// del bufio.Scanner de Go.
type LectorDeLineas = () => Promise<string | null>;

// start inicia el REPL.
//
// Recibe de dónde leer (input) y dónde escribir (output) en lugar de usar
// directamente la consola. En main.ts se le pasan process.stdin y
// process.stdout, pero gracias a esto también se puede probar con un texto
// como entrada.
//
// Termina cuando el usuario escribe :salir o cuando se acaba la entrada
// (por ejemplo al presionar Ctrl+D).
export async function start(input: Readable, output: Writable): Promise<void> {
	// readline lee la entrada línea por línea.
	const rl = readline.createInterface({ input, crlfDelay: Infinity });
	const lineas = rl[Symbol.asyncIterator]();
	const leerLinea: LectorDeLineas = async () => {
		const r = await lineas.next();
		return r.done ? null : r.value;
	};
	const escribir = (texto: string) => output.write(texto);

	try {
		// 1. Se pregunta qué se quiere probar.
		let modo = await elegirModo(leerLinea, escribir);
		if (modo === null) {
			return; // la entrada terminó sin elegir modo
		}
		imprimirAyuda(escribir);

		// 2. Ciclo principal del REPL.
		for (;;) {
			// El prompt muestra el modo actual, por ejemplo "parser>> ".
			escribir(`${modo}>> `);

			// leerLinea devuelve null al final de la entrada.
			const leida = await leerLinea();
			if (leida === null) {
				return;
			}

			// Se quitan espacios al inicio y al final; las líneas vacías se ignoran.
			const line = leida.trim();
			if (line === "") {
				continue;
			}

			// 3. Si la línea empieza con ':' es un comando del REPL, no código.
			if (line.startsWith(":")) {
				switch (line) {
					case ":lexer":
						modo = modoLexer;
						escribir("Modo lexer: se mostrarán los tokens.\n");
						break;
					case ":parser":
						modo = modoParser;
						escribir("Modo parser: se mostrará el AST.\n");
						break;
					case ":ayuda":
						imprimirAyuda(escribir);
						break;
					case ":salir":
						escribir("¡Miau! Hasta luego.\n");
						return;
					default:
						escribir(`Comando desconocido ${JSON.stringify(line)}. Escribe :ayuda\n`);
				}
				continue; // se vuelve a mostrar el prompt
			}

			// 4. Si no es comando, es código: se procesa según el modo actual.
			if (modo === modoLexer) {
				probarLexer(escribir, line);
			} else {
				probarParser(escribir, line);
			}
		}
	} finally {
		rl.close();
	}
}

// elegirModo muestra un menú para que el usuario elija si quiere probar
// el lexer o el parser. Acepta "1"/"lexer" o "2"/"parser" (sin importar
// mayúsculas). Si la respuesta no es válida, vuelve a preguntar.
//
// Devuelve el modo elegido, o null si la entrada se terminó antes de
// elegir (en ese caso el REPL debe cerrarse).
async function elegirModo(leerLinea: LectorDeLineas, escribir: (t: string) => void): Promise<Modo | null> {
	for (;;) {
		escribir("\n¿Qué quieres probar?\n");
		escribir("  1) Lexer  (ver los tokens)\n");
		escribir("  2) Parser (ver el AST)\n");
		escribir("Opción: ");

		const respuesta = await leerLinea();
		if (respuesta === null) {
			return null;
		}

		switch (respuesta.toLowerCase().trim()) {
			case "1":
			case "lexer":
				return modoLexer;
			case "2":
			case "parser":
				return modoParser;
			default:
				escribir("Opción no válida, escribe 1 o 2.\n");
		}
	}
}

// imprimirAyuda muestra la lista de comandos disponibles en el REPL.
function imprimirAyuda(escribir: (t: string) => void): void {
	escribir("\nComandos:\n");
	escribir("  :lexer   cambiar a modo lexer\n");
	escribir("  :parser  cambiar a modo parser\n");
	escribir("  :ayuda   mostrar esta ayuda\n");
	escribir("  :salir   salir del REPL\n");
	escribir("\n");
}

// probarLexer pasa la línea por el lexer e imprime cada token, uno por
// renglón, hasta llegar a EOF (que no se imprime). Por ejemplo, "x + 1"
// muestra (con el mismo formato que el %+v de Go):
//
//	{Type:IDENT Literal:x}
//	{Type:+ Literal:+}
//	{Type:INT Literal:1}
function probarLexer(escribir: (t: string) => void, line: string): void {
	const l = new Lexer(line);
	for (let tok = l.nextToken(); tok.type !== token.EOF; tok = l.nextToken()) {
		escribir(`{Type:${tok.type} Literal:${tok.literal}}\n`);
	}
}

// probarParser pasa la línea por el lexer y el parser, y muestra:
//   - si hubo errores de sintaxis: la lista de errores (y nada más, porque
//     el AST puede estar incompleto y tener nodos null);
//   - si no: el programa reconstruido con toString(), donde los paréntesis
//     muestran cómo se agruparon los operadores, y el AST dibujado como árbol.
function probarParser(escribir: (t: string) => void, line: string): void {
	const l = new Lexer(line);              // el lexer convierte el texto en tokens
	const p = new Parser(l);                // el parser consume esos tokens
	const program = p.parseProgram();       // y construye el AST

	if (p.getErrors().length > 0) {
		imprimirErroresParser(escribir, p.getErrors());
		return;
	}

	escribir("Programa:\n");
	escribir(`  ${program}\n`);
	escribir("AST:\n");
	imprimirArbol(escribir, program, "", "");
}

// imprimirErroresParser muestra los errores de sintaxis encontrados, uno
// por renglón, junto con Pola, la mascota del compilador.
function imprimirErroresParser(escribir: (t: string) => void, errors: string[]): void {
	escribir(" /\\_/\\   ¡Miau! Pola encontró errores de sintaxis:\n");
	escribir("( o.o )\n");
	for (const msg of errors) {
		escribir(`\t${msg}\n`);
	}
}

// ---------------------------------------------------------------------------
// Impresión del AST en forma de árbol
//
// Se hace en dos partes:
//   - describirNodo sabe, para cada TIPO de nodo, qué texto mostrar y
//     cuáles son sus hijos.
//   - imprimirArbol recorre el árbol recursivamente y dibuja las ramas
//     (├── └── │) sin necesidad de saber qué tipo de nodo es cada uno.
// ---------------------------------------------------------------------------

// Hijo representa un nodo hijo junto con una etiqueta que dice qué papel
// cumple dentro de su padre (por ejemplo "Condición", "Cuerpo" o
// "Izquierda"). La etiqueta puede ser "" si no hace falta.
interface Hijo {
	etiqueta: string;
	nodo: ast.Node | null;
}

// imprimirArbol dibuja 'nodo' y, recursivamente, todos sus descendientes.
//
//   - etiqueta: papel del nodo dentro de su padre ("" para la raíz).
//   - prefijo:  texto que va al inicio de cada renglón de los HIJOS de
//     este nodo. Se construye con "│   " (si el ancestro todavía tiene
//     hermanos debajo, hay que seguir dibujando su línea vertical) o con
//     "    " (si el ancestro era el último, ya no hay línea que dibujar).
//
// Ejemplo de salida para "let x = 1 + 2":
//
//	Program
//	└── LetStatement x
//	    └── Valor: InfixExpression +
//	        ├── Izquierda: IntegerLiteral 1
//	        └── Derecha: IntegerLiteral 2
function imprimirArbol(escribir: (t: string) => void, nodo: ast.Node | null, etiqueta: string, prefijo: string): void {
	// Se imprime el propio nodo (el prefijo y la rama ya los escribió el padre).
	let [descripcion, hijos] = describirNodo(nodo);
	if (etiqueta !== "") {
		descripcion = `${etiqueta}: ${descripcion}`;
	}
	escribir(descripcion + "\n");

	// Luego cada hijo, con su rama.
	hijos.forEach((h, i) => {
		const ultimo = i === hijos.length - 1;

		// rama:    lo que se dibuja justo antes del hijo.
		// sangria: lo que se agrega al prefijo para los hijos de ese hijo.
		// El último hijo usa └── y ya no continúa la línea vertical.
		const [rama, sangria] = ultimo ? ["└── ", "    "] : ["├── ", "│   "];

		escribir(prefijo + rama);
		imprimirArbol(escribir, h.nodo, h.etiqueta, prefijo + sangria);
	});
}

// hijo es un atajo para armar un Hijo.
function hijo(etiqueta: string, nodo: ast.Node | null): Hijo {
	return { etiqueta, nodo };
}

// describirNodo devuelve, para un nodo dado:
//   - el texto que lo describe (tipo de nodo + dato principal, por ejemplo
//     "InfixExpression +" o "Identifier x"), y
//   - la lista de sus hijos, cada uno con su etiqueta.
//
// Usa instanceof para averiguar la clase concreta del nodo (en Go era un
// "type switch"); dentro de cada if, TypeScript ya sabe el tipo y deja
// acceder a sus campos.
//
// Si se agrega un nodo nuevo al AST, hay que agregar aquí su caso; si no,
// se mostrará solo su nombre de clase (caso final) sin hijos.
function describirNodo(nodo: ast.Node | null): [string, Hijo[]] {
	// --- Casos especiales ---
	if (nodo === null) {
		// Un hijo que no existe (por ejemplo un for sin condición).
		return ["<vacío>", []];
	}

	if (nodo instanceof ast.Program) {
		return ["Program", sentencias(nodo.statements)];
	}

	// --- Sentencias ---
	if (nodo instanceof ast.LetStatement) {
		return [`LetStatement ${nodo.name.value}`, [hijo("Valor", nodo.value)]];
	}
	if (nodo instanceof ast.ReturnStatement) {
		return ["ReturnStatement", [hijo("Valor", nodo.returnValue)]];
	}
	if (nodo instanceof ast.ExpressionStatement) {
		return ["ExpressionStatement", [hijo("", nodo.expression)]];
	}
	if (nodo instanceof ast.BlockStatement) {
		return ["BlockStatement", sentencias(nodo.statements)];
	}

	// --- Literales (hojas del árbol: no tienen hijos) ---
	if (nodo instanceof ast.Identifier) {
		return [`Identifier ${nodo.value}`, []];
	}
	if (nodo instanceof ast.IntegerLiteral) {
		return [`IntegerLiteral ${nodo.value}`, []];
	}
	if (nodo instanceof ast.BooleanLiteral) {
		return [`Boolean ${nodo.value}`, []];
	}
	if (nodo instanceof ast.StringLiteral) {
		return [`StringLiteral ${JSON.stringify(nodo.value)}`, []]; // con comillas
	}

	// --- Operadores ---
	if (nodo instanceof ast.PrefixExpression) {
		return [`PrefixExpression ${nodo.operator}`, [hijo("Derecha", nodo.right)]];
	}
	if (nodo instanceof ast.InfixExpression) {
		return [`InfixExpression ${nodo.operator}`, [hijo("Izquierda", nodo.left), hijo("Derecha", nodo.right)]];
	}
	if (nodo instanceof ast.AssignExpression) {
		return ["AssignExpression =", [hijo("Destino", nodo.left), hijo("Valor", nodo.value)]];
	}

	// --- Control de flujo ---
	if (nodo instanceof ast.IfExpression) {
		const hijos = [hijo("Condición", nodo.condition), hijo("Entonces", nodo.consequence)];
		if (nodo.alternative !== null) { // el else es opcional
			hijos.push(hijo("Sino", nodo.alternative));
		}
		return ["IfExpression", hijos];
	}
	if (nodo instanceof ast.WhileExpression) {
		return ["WhileExpression", [hijo("Condición", nodo.condition), hijo("Cuerpo", nodo.body)]];
	}
	if (nodo instanceof ast.ForExpression) {
		// Las tres partes del encabezado son opcionales: solo se muestran
		// las que existen.
		const hijos: Hijo[] = [];
		if (nodo.init !== null) {
			hijos.push(hijo("Inicio", nodo.init));
		}
		if (nodo.condition !== null) {
			hijos.push(hijo("Condición", nodo.condition));
		}
		if (nodo.update !== null) {
			hijos.push(hijo("Actualización", nodo.update));
		}
		hijos.push(hijo("Cuerpo", nodo.body));
		return ["ForExpression", hijos];
	}

	// --- Funciones ---
	if (nodo instanceof ast.FunctionLiteral) {
		// Los parámetros se muestran en la misma línea: FunctionLiteral (a, b)
		const params = nodo.parameters.map((p) => p.value).join(", ");
		return [`FunctionLiteral (${params})`, [hijo("Cuerpo", nodo.body)]];
	}
	if (nodo instanceof ast.CallExpression) {
		// Primero la función que se llama y luego cada argumento numerado.
		const hijos = [hijo("Función", nodo.func)];
		nodo.args.forEach((arg, i) => hijos.push(hijo(`Arg ${i}`, arg)));
		return ["CallExpression", hijos];
	}

	// --- Estructuras de datos ---
	if (nodo instanceof ast.ArrayLiteral) {
		// Cada elemento se etiqueta con su posición: [0], [1], ...
		return ["ArrayLiteral", nodo.elements.map((el, i) => hijo(`[${i}]`, el))];
	}
	if (nodo instanceof ast.IndexExpression) {
		return ["IndexExpression", [hijo("Objeto", nodo.left), hijo("Índice", nodo.index)]];
	}
	if (nodo instanceof ast.HashLiteral) {
		// Cada pareja se muestra como dos hijos seguidos: Clave y Valor.
		return ["HashLiteral", nodo.pairs.flatMap((p) => [hijo("Clave", p.key), hijo("Valor", p.value)])];
	}

	// Tipo de nodo que describirNodo todavía no conoce.
	return [nodo.constructor.name, []];
}

// sentencias convierte una lista de sentencias en una lista de hijos sin
// etiqueta. Se usa para Program y BlockStatement, cuyos hijos son
// simplemente sus sentencias en orden.
function sentencias(stmts: ast.Statement[]): Hijo[] {
	return stmts.map((s) => hijo("", s));
}
