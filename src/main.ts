// Programa principal de KyraCompiler: muestra la bienvenida e inicia el REPL.
import * as os from "node:os";
import { start } from "./repl/repl";

// Ancho interior del recuadro de bienvenida (sin los "**" de los bordes).
const ANCHO = 40;

// Kyra, la mascota del compilador: una boston terrier.
const kyra = String.raw`
  /\_         _/\
 /   '-.___.-'   \
|  /  _  |  _  \  |
 \ | (o) | (o) | /
  \|     |     |/
   \   (___)   /
    '-. \_/ .-'
       '---'
`.slice(1, -1).split("\n");

// linea encierra un texto entre los bordes del recuadro, centrado.
function linea(texto = ""): string {
	const izquierda = Math.floor((ANCHO - texto.length) / 2);
	return "**" + " ".repeat(izquierda) + texto.padEnd(ANCHO - izquierda) + "**";
}

// El dibujo se centra como un bloque (no línea por línea) para que no se deforme.
const anchoKyra = Math.max(...kyra.map((l) => l.length));

// Se obtiene el usuario del sistema para saludarlo por su nombre.
const username = os.userInfo().username;

console.log("*".repeat(ANCHO + 4));
console.log(linea());
console.log(linea("-- BIENVENIDO A KYRACOMPILER REPL --"));
console.log(linea());
for (const l of kyra) {
	console.log(linea(l.padEnd(anchoKyra)));
}
console.log(linea());
console.log(linea("¡Guau! Soy Kyra, tu asistente canina."));
console.log(linea("¡Dame esos tokens!"));
console.log(linea());
console.log("*".repeat(ANCHO + 4) + "\n");
console.log(`¡Hola ${username}! Estás en KyraCompiler.`);
console.log("Escribe algún comando y deja que la magia ocurra...");

// El REPL lee de la entrada estándar y escribe en la salida estándar.
start(process.stdin, process.stdout);
