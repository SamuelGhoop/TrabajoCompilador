// Módulo interprete junta las tres etapas para ejecutar un programa completo:
//
//	código ──lexer──▶ tokens ──parser──▶ AST ──evaluador──▶ resultado
//
// Lo usan el REPL (modo evaluador y :cargar), la ejecución de archivos desde
// la línea de comandos y las pruebas de tests/. Así las tres formas de
// ejecutar código se comportan exactamente igual.
import { readFileSync } from "node:fs";

import { evaluar } from "./evaluator/evaluator";
import { Lexer } from "./lexer/lexer";
import type { Environment } from "./object/environment";
import * as object from "./object/object";
import { Parser } from "./parser/parser";

// Resultado de ejecutar un programa:
//   - errores: los mensajes de error, ya listos para mostrar. Si hay errores
//     léxicos o de sintaxis, el programa NO se ejecuta; si hay un error de
//     ejecución, el programa se detuvo en ese punto.
//   - valor: el valor de la última sentencia (null si hubo errores).
export interface Resultado {
	errores: string[];
	valor: object.Obj | null;
}

// ejecutar analiza el código completo y, solo si no tiene errores léxicos ni
// de sintaxis, lo ejecuta en el entorno dado. Recibir el entorno permite que
// el REPL conserve las variables de una línea a otra.
export function ejecutar(codigo: string, env: Environment): Resultado {
	const parser = new Parser(new Lexer(codigo));
	const program = parser.parseProgram();

	// Los errores léxicos y de sintaxis siempre son de este código.
	const errores = parser.getErrors();
	if (errores.length > 0) {
		return { errores: errores.map((e) => conContexto(e, codigo)), valor: null };
	}

	let valor: object.Obj;
	try {
		valor = evaluar(program, env);
	} catch (e) {
		// Una recursión demasiado profunda (por ejemplo, una función que se
		// llama a sí misma sin caso base) agota la pila de JavaScript. Se
		// reporta como un error de ejecución del lenguaje, no como un fallo
		// del intérprete.
		if (e instanceof RangeError) {
			return {
				errores: ["Error de ejecución: desbordamiento de pila (demasiadas llamadas anidadas; ¿falta el caso base de una recursión?)"],
				valor: null,
			};
		}
		throw e;
	}
	// Un error de ejecución puede venir de OTRO código: una función que se
	// definió en una línea anterior del REPL o en un archivo cargado. Por eso
	// se muestra la línea del código de donde salió el error (su fuente).
	if (valor instanceof object.ErrorObj) {
		return { errores: [conContexto(valor.describir(), valor.fuente ?? codigo)], valor: null };
	}
	return { errores: [], valor };
}

// conContexto agrega a un mensaje de error la línea del código donde
// ocurrió y una flecha (^) debajo de la columna exacta:
//
//	Error de ejecución en línea 3, columna 17: división por cero
//	 3 |     return suma / cantidad;
//	   |                 ^
//
// La posición se toma del propio mensaje ("en línea L, columna C"), que
// escriben siempre igual el lexer, el parser y el evaluador. Si el mensaje
// no tiene posición, se devuelve tal cual.
export function conContexto(mensaje: string, codigo: string): string {
	const posicion = /en línea (\d+), columna (\d+)/.exec(mensaje);
	if (posicion === null) {
		return mensaje;
	}
	const linea = Number(posicion[1]);
	const columna = Number(posicion[2]);
	const texto = codigo.split(/\r?\n/)[linea - 1];
	if (texto === undefined) {
		return mensaje;
	}

	// La flecha se alinea con lo que hay antes de la columna: se copian las
	// tabulaciones (que ocupan más de un espacio en pantalla) y el resto se
	// cambia por espacios.
	const sangria = texto.slice(0, columna - 1).replace(/[^\t]/g, " ");
	const numero = String(linea);
	const margen = " ".repeat(numero.length);
	return `${mensaje}\n ${numero} | ${texto}\n ${margen} | ${sangria}^`;
}

// ejecutarArchivo lee un archivo de código y lo ejecuta completo. A
// diferencia del REPL, que procesa una línea a la vez, aquí una función o un
// bloque pueden ocupar varias líneas.
export function ejecutarArchivo(ruta: string, env: Environment): Resultado {
	let codigo: string;
	try {
		codigo = readFileSync(ruta, "utf8");
	} catch {
		return { errores: [`No se pudo leer el archivo ${ruta}`], valor: null };
	}
	return ejecutar(codigo, env);
}

// mostrarValor devuelve lo que se imprime como resultado de un programa: el
// valor de la última sentencia, salvo que sea null (por ejemplo, cuando el
// programa termina con un let o un print), que no se muestra.
export function mostrarValor(valor: object.Obj | null): string | null {
	if (valor === null || valor === object.NULL) {
		return null;
	}
	return valor.inspect();
}
