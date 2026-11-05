// Módulo revisor revisa el código MIENTRAS se escribe: corre solo el lexer y
// el parser (no ejecuta nada) y dice dónde está el primer error léxico o de
// sintaxis. La interfaz lo usa para subrayar esa línea antes de [EJECUTAR].
//
// Es rápido y no ejecuta el programa, así que corre en el hilo del servidor
// (no hace falta un hilo aparte como en ejecutor.ts).
import { Lexer } from "../lexer/lexer";
import { Parser } from "../parser/parser";

export interface Revision {
	error: string | null;   // el primer error, tal como lo escribe el parser
	linea: number | null;   // su línea y columna, si el mensaje las trae
	columna: number | null;
}

export function revisar(codigo: string): Revision {
	let errores: string[];
	try {
		const parser = new Parser(new Lexer(codigo));
		parser.parseProgram();
		errores = parser.getErrors();
	} catch (e) {
		// Un anidamiento absurdo (miles de paréntesis) agota la pila: no es un
		// error que valga la pena subrayar mientras se escribe.
		if (e instanceof RangeError) {
			return { error: null, linea: null, columna: null };
		}
		throw e;
	}
	const error = errores[0] ?? null;
	const posicion = error === null ? null : /en línea (\d+), columna (\d+)/.exec(error);
	return {
		error,
		linea: posicion ? Number(posicion[1]) : null,
		columna: posicion ? Number(posicion[2]) : null,
	};
}
