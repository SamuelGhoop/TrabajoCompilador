// Programa principal de KyraCompiler: muestra la bienvenida e inicia el REPL.
import * as os from "node:os";
import { kyra } from "./kyra";
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

// Se obtiene el usuario del sistema para saludarlo por su nombre.
const username = os.userInfo().username;

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
console.log(`¡Hola ${username}! Estás en KyraCompiler.`);
console.log("Escribe algún comando y deja que la magia ocurra...");

// El REPL lee de la entrada estándar y escribe en la salida estándar.
start(process.stdin, process.stdout);
