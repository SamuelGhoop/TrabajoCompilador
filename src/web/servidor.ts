// Servidor de la interfaz web de KyraCompiler (estilo terminal de Fallout).
//
//	npm run ui      → abre http://localhost:4747
//
// El navegador NO ejecuta el lenguaje: le manda el código a este servidor,
// que lo ejecuta con el MISMO intérprete del REPL, en un hilo con pila de
// 256 MB (ver hilo.ts). Así la interfaz no tiene el límite de recursión de
// la pila del navegador y da exactamente los mismos resultados que la
// terminal.
//
// Cada programa corre en su propio hilo, que se detiene si:
//   - pasa el TIEMPO LÍMITE (un ciclo infinito no congela el servidor), o
//   - el navegador cancela el pedido (botón [DETENER]).
//
// Solo escucha en 127.0.0.1: no se puede usar desde otra computadora.
import { readdirSync, readFileSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

import { crearHilo } from "../hilo";
import { kyra } from "../kyra";
import type { Pedido, Respuesta } from "./ejecutor";

const PUERTO = Number(process.env.PORT ?? 4747);
const TIEMPO_LIMITE_MS = 60_000;          // fibonacci(34) tarda ~33 s
const MAX_CODIGO = 1_000_000;             // 1 MB de código como máximo

const raiz = new URL("../../", import.meta.url); // carpeta del proyecto

// ejecutarEnHilo corre un pedido en un hilo nuevo y devuelve su respuesta.
// cancelar detiene el hilo (cuando el navegador cierra la conexión).
function ejecutarEnHilo(pedido: Pedido, cancelar: AbortSignal): Promise<Respuesta> {
	return new Promise((resolver) => {
		const hilo = crearHilo(new URL("./ejecutor.ts", import.meta.url), { workerData: pedido });
		let terminado = false;
		const terminar = (respuesta: Respuesta | null) => {
			if (terminado) {
				return;
			}
			terminado = true;
			clearTimeout(reloj);
			void hilo.terminate();
			if (respuesta !== null) {
				resolver(respuesta);
			}
		};
		const fallo = (mensaje: string): Respuesta => ({
			tokens: [], programa: null, arbol: null, salida: "", valor: null,
			errores: [mensaje], etapa: "ejecucion", traza: null,
		});

		const reloj = setTimeout(() => {
			terminar(fallo(`Error de ejecución: tiempo agotado (el programa pasó de ${TIEMPO_LIMITE_MS / 1000} s; ¿hay un ciclo infinito?)`));
		}, TIEMPO_LIMITE_MS);
		cancelar.addEventListener("abort", () => terminar(null));

		hilo.once("message", (respuesta: Respuesta) => terminar(respuesta));
		hilo.once("error", (e: Error) => terminar(fallo(`Error interno del intérprete: ${e.message}`)));
	});
}

// ejemplos devuelve los programas de examples/ para el menú de la interfaz.
function ejemplos(): { nombre: string; codigo: string }[] {
	const carpeta = new URL("examples/", raiz);
	return readdirSync(carpeta)
		.filter((f) => f.endsWith(".ssg"))
		.sort()
		.map((f) => ({ nombre: f, codigo: readFileSync(new URL(f, carpeta), "utf8") }));
}

// leerCuerpo lee el cuerpo de un pedido (con un tamaño máximo).
function leerCuerpo(req: IncomingMessage): Promise<string> {
	return new Promise((resolver, rechazar) => {
		let cuerpo = "";
		req.setEncoding("utf8");
		req.on("data", (parte: string) => {
			cuerpo += parte;
			if (cuerpo.length > MAX_CODIGO) {
				rechazar(new Error("código demasiado grande"));
				req.destroy();
			}
		});
		req.on("end", () => resolver(cuerpo));
		req.on("error", rechazar);
	});
}

function responder(res: ServerResponse, estado: number, tipo: string, cuerpo: string): void {
	res.writeHead(estado, { "Content-Type": `${tipo}; charset=utf-8`, "Cache-Control": "no-store" });
	res.end(cuerpo);
}

const servidor = createServer(async (req, res) => {
	try {
		if (req.method === "GET" && (req.url === "/" || req.url === "/index.html")) {
			responder(res, 200, "text/html", readFileSync(new URL("web/index.html", raiz), "utf8"));
		} else if (req.method === "GET" && req.url === "/api/kyra") {
			// El retrato de Kyra: el mismo de la bienvenida de la terminal.
			responder(res, 200, "application/json", JSON.stringify(kyra));
		} else if (req.method === "GET" && req.url === "/api/ejemplos") {
			responder(res, 200, "application/json", JSON.stringify(ejemplos()));
		} else if (req.method === "POST" && req.url === "/api/ejecutar") {
			const datos = JSON.parse(await leerCuerpo(req)) as Partial<Pedido>;
			const pedido: Pedido = { codigo: String(datos.codigo ?? ""), traza: datos.traza === true };

			// Si el navegador cancela (botón DETENER o cierra la pestaña), se
			// detiene el hilo para no seguir gastando CPU.
			const cancelacion = new AbortController();
			res.on("close", () => {
				if (!res.writableEnded) {
					cancelacion.abort();
				}
			});

			const respuesta = await ejecutarEnHilo(pedido, cancelacion.signal);
			if (!res.destroyed) {
				responder(res, 200, "application/json", JSON.stringify(respuesta));
			}
		} else {
			responder(res, 404, "text/plain", "No encontrado");
		}
	} catch (e) {
		responder(res, 400, "text/plain", `Pedido inválido: ${(e as Error).message}`);
	}
});

servidor.listen(PUERTO, "127.0.0.1", () => {
	console.log("KYRACOMPILER (TM) TERMLINK — interfaz web");
	console.log(`Abre http://localhost:${PUERTO} en el navegador.  (Ctrl+C para cerrar)`);
});
