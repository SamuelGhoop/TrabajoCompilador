// Programa principal de KyraCompiler. Tiene dos formas de uso:
//
//	npm start                    → muestra la bienvenida e inicia el REPL
//	npm start -- programa.ssg    → ejecuta el archivo completo y termina
//
// El intérprete corre en un HILO APARTE con una pila grande (ver hilo.ts). El
// hilo principal solo muestra la bienvenida y le pasa el teclado al hilo del
// intérprete.
import * as os from "node:os";
import { isMainThread, parentPort } from "node:worker_threads";

import { crearHilo } from "./hilo";
import { ejecutarArchivo, mostrarValor } from "./interprete";
import { kyra } from "./kyra";
import { Environment } from "./object/environment";
import { start } from "./repl/repl";

// Ancho interior del recuadro de bienvenida (sin los bordes).
const ANCHO = 56;

// Los colores solo se usan en una terminal real (y si NO_COLOR no está
// definido), para no ensuciar la salida cuando se redirige a un archivo.
const conColor = process.stdout.isTTY === true && process.env.NO_COLOR === undefined;
const estilo = (codigo: string) => (texto: string) => (conColor ? `\x1b[${codigo}m${texto}\x1b[0m` : texto);
const borde = estilo("36");      // cian
const titulo = estilo("1;33");   // amarillo brillante
const tenue = estilo("2");       // atenuado

// linea centra un texto dentro del recuadro. Primero se rellena con espacios
// y después se colorea, para que los códigos de color no cuenten en el ancho.
function linea(texto = "", pintar: (t: string) => string = (t) => t): string {
	const izquierda = Math.floor((ANCHO - texto.length) / 2);
	const relleno = " ".repeat(izquierda) + texto + " ".repeat(ANCHO - izquierda - texto.length);
	return borde("║") + pintar(relleno) + borde("║");
}

// mostrarBienvenida dibuja el recuadro con Kyra y saluda al usuario.
function mostrarBienvenida(): void {
	console.log(borde("╔" + "═".repeat(ANCHO) + "╗"));
	console.log(linea());
	// El dibujo se centra como un bloque (no línea por línea) para que no se deforme.
	const anchoKyra = Math.max(...kyra.map((l) => l.length));
	for (const l of kyra) {
		console.log(linea(l.padEnd(anchoKyra)));
	}
	console.log(linea());
	console.log(linea("K Y R A   C O M P I L E R", titulo));
	console.log(linea("─".repeat(30), borde));
	console.log(linea("¡Guau! Soy Kyra, tu asistente canina."));
	console.log(linea("¡Dame esos tokens!", tenue));
	console.log(linea());
	console.log(borde("╚" + "═".repeat(ANCHO) + "╝") + "\n");
	// Se obtiene el usuario del sistema para saludarlo por su nombre.
	console.log(`¡Quiubo, ${os.userInfo().username}! Estás en KyraCompiler, parce.`);
	console.log("Escribe algún comando y deja que la magia ocurra...");
}

// correrArchivo ejecuta un programa completo. Lo que escribe print y el
// valor final van a la salida estándar; los errores, a la salida de
// errores. Devuelve el código de salida: 1 si hubo errores (así un script
// puede saber que el programa falló), 0 si no.
function correrArchivo(ruta: string): number {
	const env = new Environment(null, (t) => process.stdout.write(t));
	const resultado = ejecutarArchivo(ruta, env);

	if (resultado.errores.length > 0) {
		for (const error of resultado.errores) {
			console.error(error);
		}
		return 1;
	}
	const texto = mostrarValor(resultado.valor);
	if (texto !== null) {
		console.log(texto);
	}
	return 0;
}

const args = process.argv.slice(2);

if (isMainThread) {
	// --- Hilo principal: bienvenida y arranque del hilo del intérprete ---
	if (args.length > 1) {
		console.error("uso: npm start -- [archivo.ssg]");
		process.exitCode = 1;
	} else {
		const modoRepl = args.length === 0;
		if (modoRepl) {
			mostrarBienvenida();
		}

		// El hilo carga este mismo archivo, que al ver que no es el hilo
		// principal inicia el intérprete (ver el final de este archivo).
		const interprete = crearHilo(new URL(import.meta.url), {
			argv: args,
			stdin: modoRepl, // solo el REPL necesita leer el teclado
		});
		if (modoRepl && interprete.stdin !== null) {
			process.stdin.pipe(interprete.stdin);
		}
		// El hilo del intérprete avisa con qué código debe terminar el programa.
		interprete.on("message", (codigo: number) => {
			process.exitCode = codigo;
		});
		interprete.on("exit", () => {
			// Se suelta el teclado para que el programa pueda terminar.
			process.stdin.unpipe();
			process.stdin.pause();
		});
	}
} else if (args.length === 1) {
	// --- Hilo del intérprete, ejecutando un archivo ---
	parentPort?.postMessage(correrArchivo(args[0]));
} else {
	// --- Hilo del intérprete, en modo REPL ---
	// El REPL lee del teclado (que le pasa el hilo principal) y escribe en la
	// salida estándar.
	start(process.stdin, process.stdout);
}
