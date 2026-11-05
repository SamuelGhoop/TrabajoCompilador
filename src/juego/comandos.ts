// Módulo comandos une el juego con el lenguaje: convierte las reglas de
// juego.ts en funciones que un programa puede llamar, como mover("este").
//
// Los comandos NO están en la tabla global de builtins. Se declaran en el
// entorno de cada partida, porque el evaluador busca primero en el entorno.
// Por eso solo existen al jugar: el REPL, los archivos y las pruebas del
// lenguaje no los ven.
//
// Un programa se ejecuta completo y de una vez; mientras tanto se guarda una
// foto (Evento) después de cada comando. El navegador recibe la lista y la
// reproduce como animación.
import { observarLlamadas } from "../evaluator/evaluator";
import { ejecutar, type Resultado } from "../interprete";
import { Environment, type Salida } from "../object/environment";
import * as object from "../object/object";
import * as juego from "./juego";
import type { Nivel } from "./niveles";

// ResultadoJuego es lo que el navegador necesita para mostrar la partida.
export interface ResultadoJuego {
	eventos: juego.Evento[];
	gano: boolean;
	estrellas: number;
	pasos: number;
	lineas: number;
	mensaje: string; // cómo terminó, si no hubo errores del intérprete
}

const error = (mensaje: string): juego.Accion => ({ ok: false, error: mensaje });

// Cada print también deja una foto, para que el navegador muestre lo que Kyra
// dice en el momento justo. Un ciclo que imprime mucho no llena la lista.
const MAX_DICHOS = 100;

// Un valor largo (un arreglo grande, un texto) se recorta en la foto: el
// navegador lo muestra al lado de una línea de código.
const MAX_VALOR = 24;

// variablesDe lista las variables del programa que se ven desde un entorno,
// sin las funciones ni los comandos de Kyra.
function variablesDe(env: Environment | null): juego.Variable[] {
	if (env === null) {
		return [];
	}
	const variables: juego.Variable[] = [];
	for (const [nombre, valor] of env.visibles()) {
		if (valor instanceof object.Builtin || valor instanceof object.FunctionObj) {
			continue;
		}
		const texto = valor.inspect();
		variables.push({ nombre, valor: texto.length > MAX_VALOR ? texto.slice(0, MAX_VALOR - 1) + "…" : texto });
	}
	return variables;
}

// sinArgumentos adapta un comando que no recibe argumentos.
function sinArgumentos(accion: (estado: juego.Estado) => juego.Accion) {
	return (estado: juego.Estado, args: object.Obj[]): juego.Accion =>
		args.length === 0
			? accion(estado)
			: error(`cantidad de argumentos incorrecta: se esperaban 0, llegaron ${args.length}`);
}

// inventarioDe convierte un hash del lenguaje en un Map de TypeScript.
// Devuelve null si tiene algo que no sea texto: entero.
function inventarioDe(hash: object.HashObj): Map<string, number> | null {
	const inventario = new Map<string, number>();
	for (const { key, value } of hash.pairs.values()) {
		if (!(key instanceof object.StringObj) || !(value instanceof object.Integer)) {
			return null;
		}
		inventario.set(key.value, Number(value.value));
	}
	return inventario;
}

// Cada comando revisa sus argumentos y llama a la regla de juego.ts.
const acciones: Record<juego.Comando, (estado: juego.Estado, args: object.Obj[]) => juego.Accion> = {
	mover(estado, args) {
		if (args.length !== 1) {
			return error(`cantidad de argumentos incorrecta: se esperaban 1, llegaron ${args.length}`);
		}
		const [direccion] = args;
		if (!(direccion instanceof object.StringObj)) {
			return error(`mover no admite ${direccion.type()}: use "norte", "sur", "este" u "oeste"`);
		}
		return juego.mover(estado, direccion.value);
	},
	plantar: sinArgumentos(juego.plantar),
	cosechar: sinArgumentos(juego.cosechar),
	mirar: sinArgumentos(juego.mirar),
	esperar: sinArgumentos(juego.esperar),
	reportar(estado, args) {
		if (args.length !== 1) {
			return error(`cantidad de argumentos incorrecta: se esperaban 1, llegaron ${args.length}`);
		}
		const [hash] = args;
		if (!(hash instanceof object.HashObj)) {
			return error(`reportar no admite ${hash.type()}: necesita un hash como {"lechuga": 3}`);
		}
		const inventario = inventarioDe(hash);
		if (inventario === null) {
			return error('el inventario debe tener textos como claves y enteros como valores: {"lechuga": 3}');
		}
		return juego.reportar(estado, inventario);
	},
};

// comoTexto muestra una llamada para la pantalla: mover("este").
function comoTexto(nombre: string, args: object.Obj[]): string {
	const textos = args.map((a) => (a instanceof object.StringObj ? `"${a.value}"` : a.inspect()));
	return `${nombre}(${textos.join(", ")})`;
}

// declararComandos pone los comandos en el entorno de una partida. Los que el
// nivel no habilita también se declaran, pero solo dan un mensaje claro.
// alGastarPaso se llama después de cada comando que consumió un paso.
function declararComandos(
	env: Environment,
	estado: juego.Estado,
	habilitados: juego.Comando[],
	alGastarPaso: (comando: string) => void,
): void {
	for (const nombre of juego.COMANDOS) {
		if (!habilitados.includes(nombre)) {
			env.set(nombre, new object.Builtin(() => new object.ErrorObj(`Kyra aún no aprende ${nombre}() en este nivel`)));
			continue;
		}
		env.set(nombre, new object.Builtin((_env, ...args) => {
			const pasosAntes = estado.pasos;
			const accion = acciones[nombre](estado, args);
			if (estado.pasos > pasosAntes) {
				alGastarPaso(comoTexto(nombre, args));
			}
			if (!accion.ok) {
				return new object.ErrorObj(accion.error);
			}
			return accion.valor === null ? object.NULL : new object.StringObj(accion.valor);
		}));
	}
}

// jugar ejecuta el programa en cada tablero del nivel, con un entorno nuevo
// para cada uno, y se detiene en el primero que no gane.
export function jugar(codigo: string, nivel: Nivel, escribir: Salida): { resultado: Resultado; juego: ResultadoJuego } {
	const eventos: juego.Evento[] = [];
	const lineas = juego.contarLineas(codigo);
	const perder = (resultado: Resultado, pasos: number, mensaje: string) => ({
		resultado,
		juego: { eventos, gano: false, estrellas: 0, pasos, lineas, mensaje },
	});

	let resultado: Resultado = { errores: [], valor: null };
	let dichos = 0;
	let pasos = 0;
	let cosechas = 0;
	for (const [variante, tablero] of nivel.tableros.entries()) {
		const estado = juego.crearEstado(tablero, nivel.topePasos);
		eventos.push(juego.foto(estado, variante, null, null));

		// Lo que se sabe del programa en el momento de cada comando: su línea,
		// el entorno desde donde se llamó y los ciclos que estaban corriendo.
		let linea: number | null = null;
		let entornoDeLlamada: Environment | null = null;
		const ciclos: juego.Vuelta[] = [];
		const contexto = () => ({
			variables: variablesDe(entornoDeLlamada),
			ciclos: ciclos.map((c) => ({ ...c })),
		});

		const env = new Environment(null, (texto) => {
			escribir(texto);
			if (dichos < MAX_DICHOS) {
				dichos += 1;
				const dice = texto.replace(/\n$/, "");
				eventos.push({ ...juego.foto(estado, variante, `print(${JSON.stringify(dice)})`, linea), dice, ...contexto() });
			}
		});
		declararComandos(env, estado, nivel.comandos, (comando) => {
			eventos.push({ ...juego.foto(estado, variante, comando, linea), ...contexto() });
		});

		resultado = observarLlamadas(
			{
				entrar() {},
				salir() {},
				integrada(l, e) { linea = l; entornoDeLlamada = e; },
				entrarCiclo(l) { ciclos.push({ linea: l, vuelta: 0 }); },
				vuelta(n) { ciclos[ciclos.length - 1].vuelta = n; },
				salirCiclo() { ciclos.pop(); },
			},
			() => ejecutar(codigo, env),
		);
		if (resultado.errores.length > 0) {
			return perder(resultado, estado.pasos, "");
		}

		const falta = juego.faltante(estado, nivel.meta);
		if (falta !== null) {
			const donde = nivel.tableros.length > 1 ? `Tablero ${variante + 1} de ${nivel.tableros.length}: ` : "";
			return perder(resultado, estado.pasos, `${donde}${falta}.`);
		}
		pasos = Math.max(pasos, estado.pasos);
		cosechas = juego.totalCosechas(estado);
	}

	const mensaje = nivel.meta === null
		? `Kyra cosechó ${cosechas} en ${pasos} pasos.`
		: "¡Meta cumplida!";
	const estrellas = nivel.meta === null ? 0 : juego.calcularEstrellas(nivel.par, pasos, lineas);
	return { resultado, juego: { eventos, gano: true, estrellas, pasos, lineas, mensaje } };
}
