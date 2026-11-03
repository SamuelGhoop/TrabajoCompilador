// Módulo hilo crea HILOS APARTE (worker threads) con una pila grande para
// ejecutar el intérprete.
//
// El evaluador es recursivo: cada llamada del lenguaje usa varias llamadas
// de TypeScript, y con la pila normal de Node (cerca de 1 MB) una recursión
// de unas 600 llamadas ya la agotaba. Un hilo nuevo puede tener la pila que
// se le pida; con 256 MB alcanza para cientos de miles de llamadas.
//
// Lo usan main.ts (para el REPL y los archivos) y el servidor de la interfaz
// web (para cada programa que se ejecuta desde el navegador).
import { Worker, type WorkerOptions } from "node:worker_threads";

// Tamaño de la pila de cada hilo del intérprete, en MB.
export const TAMANO_PILA_MB = 256;

// crearHilo arranca un hilo que ejecuta el archivo TypeScript dado.
//
// El hilo nuevo arranca sin saber leer TypeScript: primero registra el
// cargador de tsx y luego carga el archivo pedido.
export function crearHilo(archivo: URL, opciones: WorkerOptions = {}): Worker {
	const tsx = JSON.stringify(import.meta.resolve("tsx/esm/api"));
	const destino = JSON.stringify(archivo.href);
	const arranque = `import(${tsx}).then(({ register }) => { register(); return import(${destino}); });`;

	return new Worker(arranque, {
		...opciones,
		eval: true,
		resourceLimits: { ...opciones.resourceLimits, stackSizeMb: TAMANO_PILA_MB },
	});
}
