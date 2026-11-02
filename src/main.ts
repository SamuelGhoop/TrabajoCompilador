// Programa principal de CatCompiler: muestra la bienvenida e inicia el REPL.
import * as os from "node:os";
import { start } from "./repl/repl";

// Se obtiene el usuario del sistema para saludarlo por su nombre.
const username = os.userInfo().username;

console.log("********************************************");
console.log("**                                        **");
console.log("**  -- BIENVENIDO A CATCOMPILER REPL --   **");
console.log("**                                        **");
console.log("**      /\\_/\\     ¡Miau! Soy Pola,      **");
console.log("**     ( o.o )    tu asistente felino.    **");
console.log("**      > ^ <     ¡Dame esos tokens!      **");
console.log("**                                        **");
console.log("********************************************\n");
console.log(`¡Hola ${username}! Estás en CatCompiler.`);
console.log("Escribe algún comando y deja que la magia ocurra...");

// El REPL lee de la entrada estándar y escribe en la salida estándar.
start(process.stdin, process.stdout);
