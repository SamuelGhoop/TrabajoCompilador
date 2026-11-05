// Módulo environment define el ENTORNO: la tabla que dice cuánto vale cada
// variable mientras el programa se ejecuta.
//
// Los entornos se encadenan. Cada llamada a una función crea un entorno
// nuevo para sus parámetros, cuyo "exterior" (outer) es el entorno donde se
// definió la función. Al buscar una variable, si no está en el entorno
// actual se busca en el exterior, y así hasta llegar al global:
//
//	let n = 10;                      global:   { n: 10, suma: <función> }
//	let suma = function(x) {            ▲
//	    return x + n;                   │ outer
//	};                               llamada:  { x: 5 }
//	suma(5);   → busca x aquí, n en el global → 15
import type { Obj } from "./object";

// Salida es la función con la que print escribe un texto.
export type Salida = (texto: string) => void;

export class Environment {
	private store = new Map<string, Obj>();

	// salida solo se indica en el entorno global; los demás la heredan.
	constructor(
		private outer: Environment | null = null,
		private salida: Salida | null = null,
	) {}

	// enclosed crea un entorno nuevo cuyo exterior es este. Se usa al
	// llamar una función y al empezar un ciclo for.
	enclosed(): Environment {
		return new Environment(this);
	}

	// get busca una variable, primero aquí y luego hacia afuera.
	// Devuelve undefined si no existe en ningún entorno.
	get(name: string): Obj | undefined {
		return this.store.get(name) ?? this.outer?.get(name);
	}

	// visibles devuelve las variables que se ven desde aquí, de la más
	// cercana a la más lejana. Si una variable tapa (shadowing) a otra con el
	// mismo nombre de un entorno exterior, solo aparece la de adentro.
	visibles(): Map<string, Obj> {
		const vistas = new Map<string, Obj>();
		for (let env: Environment | null = this; env !== null; env = env.outer) {
			for (const [nombre, valor] of env.store) {
				if (!vistas.has(nombre)) {
					vistas.set(nombre, valor);
				}
			}
		}
		return vistas;
	}

	// set DECLARA una variable en ESTE entorno (es lo que hace let).
	// Si ya existía aquí, la reemplaza.
	set(name: string, value: Obj): Obj {
		this.store.set(name, value);
		return value;
	}

	// assign CAMBIA el valor de una variable que ya existe (es lo que hace
	// x = 5). La busca hacia afuera y la cambia en el entorno donde se
	// declaró, así una función puede modificar una variable global.
	// Devuelve false si la variable no existe en ningún entorno.
	assign(name: string, value: Obj): boolean {
		if (this.store.has(name)) {
			this.store.set(name, value);
			return true;
		}
		return this.outer?.assign(name, value) ?? false;
	}

	// escribir manda un texto a la salida del entorno global (la consola
	// en el REPL). Si nadie configuró una salida, usa la consola.
	escribir(texto: string): void {
		if (this.salida !== null) {
			this.salida(texto);
		} else if (this.outer !== null) {
			this.outer.escribir(texto);
		} else {
			process.stdout.write(texto);
		}
	}
}
