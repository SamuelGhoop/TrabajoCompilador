// Módulo ejecutor corre UN programa para la interfaz web, dentro de un hilo
// con pila grande (lo crea servidor.ts con crearHilo). Recibe el código en
// workerData y devuelve, por parentPort, todo lo que muestra la interfaz:
//
//   - los TOKENS que produce el lexer,
//   - el AST que construye el parser (dibujado igual que en el REPL),
//   - la SALIDA de ejecutar el programa (lo que escribe print y el valor
//     final, o los errores),
//   - y, si se pidió, la TRAZA del árbol de llamadas.
//
// Es el mismo intérprete que usan el REPL y la línea de comandos.
import { parentPort, workerData } from "node:worker_threads";

import { ejecutar, mostrarValor, type Resultado } from "../interprete";
import { jugar, type ResultadoJuego } from "../juego/comandos";
import { nivelPorId } from "../juego/niveles";
import { Lexer } from "../lexer/lexer";
import { Environment } from "../object/environment";
import { Parser } from "../parser/parser";
import { arbolComoTexto } from "../repl/repl";
import { trazar } from "../repl/traza";
import * as token from "../token/token";

// Lo que se pide: el código, si hay que trazar las llamadas y, en modo juego,
// el nivel que se está jugando.
export interface Pedido {
	codigo: string;
	traza: boolean;
	nivel?: string | null;
}

// Lo que se responde a la interfaz.
export interface Respuesta {
	tokens: { tipo: string; literal: string; linea: number; columna: number }[];
	programa: string | null;   // el programa reconstruido (null si hay errores)
	arbol: string | null;      // el AST dibujado (null si hay errores)
	salida: string;            // lo que escribió print
	valor: string | null;      // el valor final, si no es null
	errores: string[];         // los errores, ya con el extracto del código
	etapa: "lexico" | "sintaxis" | "ejecucion" | null; // etapa del primer error
	traza: string[] | null;    // el árbol de llamadas, si se pidió
	juego: ResultadoJuego | null; // la partida, si se pidió un nivel
}

// Límite de lo que se guarda de print: un ciclo infinito con print no debe
// llenar la memoria antes de que se cumpla el tiempo límite.
const MAX_SALIDA = 200_000;

export function atender(pedido: Pedido): Respuesta {
	// --- Tokens ---
	const lexer = new Lexer(pedido.codigo);
	const tokens: Respuesta["tokens"] = [];
	for (let t = lexer.nextToken(); t.type !== token.EOF; t = lexer.nextToken()) {
		tokens.push({ tipo: t.type, literal: t.literal, linea: t.line, columna: t.column });
	}

	// --- AST ---
	const parser = new Parser(new Lexer(pedido.codigo));
	const program = parser.parseProgram();
	const sinErrores = parser.getErrors().length === 0;

	// --- Ejecución (y traza) ---
	let salida = "";
	const escribir = (texto: string) => {
		if (salida.length < MAX_SALIDA) {
			salida += texto;
			if (salida.length >= MAX_SALIDA) {
				salida += "\n… (salida recortada)\n";
			}
		}
	};
	let resultado: Resultado;
	let traza: string[] | null = null;
	let juego: ResultadoJuego | null = null;
	if (pedido.nivel !== undefined && pedido.nivel !== null) {
		const nivel = nivelPorId(pedido.nivel);
		if (nivel === undefined) {
			resultado = { errores: [`Error de ejecución: nivel desconocido: ${pedido.nivel}`], valor: null };
		} else {
			({ resultado, juego } = jugar(pedido.codigo, nivel, escribir));
		}
	} else if (pedido.traza) {
		const t = trazar(pedido.codigo, new Environment(null, escribir));
		resultado = t.resultado;
		traza = t.lineas;
	} else {
		resultado = ejecutar(pedido.codigo, new Environment(null, escribir));
	}

	return {
		tokens,
		programa: sinErrores ? program.toString() : null,
		arbol: sinErrores ? arbolComoTexto(program) : null,
		salida,
		valor: mostrarValor(resultado.valor),
		errores: resultado.errores,
		etapa: etapaDe(resultado.errores[0]),
		traza,
		juego,
	};
}

// etapaDe dice en qué etapa ocurrió un error, según cómo empieza su mensaje.
function etapaDe(error: string | undefined): Respuesta["etapa"] {
	if (error === undefined) {
		return null;
	}
	if (error.startsWith("Error léxico")) {
		return "lexico";
	}
	if (error.startsWith("Error de sintaxis")) {
		return "sintaxis";
	}
	return "ejecucion";
}

// Solo dentro de un hilo (cuando lo arranca el servidor) se atiende el pedido;
// así las pruebas pueden importar atender sin ejecutar nada.
if (parentPort !== null) {
	parentPort.postMessage(atender(workerData as Pedido));
}
