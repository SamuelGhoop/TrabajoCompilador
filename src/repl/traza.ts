// Módulo traza implementa el comando :traza del REPL: ejecuta un código y
// muestra el ÁRBOL DE LLAMADAS a funciones que se hizo para calcularlo.
//
//	evaluator>> :traza fibonacci(3)
//	fibonacci(3) → 2
//	├─ fibonacci(2) → 1
//	│  ├─ fibonacci(1) → 1
//	│  └─ fibonacci(0) → 0
//	└─ fibonacci(1) → 1
//	5 llamadas · profundidad máxima 3
//
// Sirve para VER cómo trabaja el evaluador: cada línea es una llamada a
// aplicarFuncion, sus hijos son las llamadas que se hicieron dentro de ella,
// y la flecha muestra el valor que devolvió.
//
// Primero se ejecuta todo armando el árbol, y al final se dibuja: para saber
// si una llamada lleva ├─ o └─ hay que saber si es la última de su nivel, y
// eso solo se sabe cuando la llamada de arriba ya terminó.
import { observarLlamadas } from "../evaluator/evaluator";
import { ejecutar, type Resultado } from "../interprete";
import type { Environment } from "../object/environment";
import * as object from "../object/object";

// Máximo de llamadas que se dibujan: fibonacci(20) hace más de 20 000, y
// eso no se puede leer en pantalla. Las demás se cuentan pero no se dibujan.
export const MAX_LLAMADAS_DIBUJADAS = 60;

// Largo máximo con el que se muestra un argumento o un resultado.
const MAX_TEXTO = 40;

// Llamada es un nodo del árbol de llamadas.
interface Llamada {
	etiqueta: string;          // cómo se llamó: "fibonacci(3)"
	resultado: string | null;  // lo que devolvió (null mientras no termine)
	hijos: Llamada[];          // las llamadas que hizo
}

// Traza es lo que devuelve trazar: el resultado normal de ejecutar el código
// y el dibujo del árbol, listo para imprimir.
export interface Traza {
	resultado: Resultado;
	lineas: string[];
}

// trazar ejecuta el código en el entorno dado observando las llamadas, y
// devuelve el resultado junto con el árbol dibujado.
export function trazar(codigo: string, env: Environment): Traza {
	const raiz: Llamada = { etiqueta: "", resultado: null, hijos: [] };
	const pila: Llamada[] = [raiz]; // la llamada en curso está arriba de la pila
	let total = 0;
	let profundidadMaxima = 0;

	const resultado = observarLlamadas(
		{
			entrar(nombre, args) {
				total += 1;
				// Las llamadas se dibujan en el mismo orden en que empiezan, así
				// que de la número MAX_LLAMADAS_DIBUJADAS en adelante ninguna se
				// va a dibujar: se siguen contando, pero no se guardan en el árbol
				// (fibonacci(25) hace 250 000 llamadas: guardarlas todas llenaría
				// la memoria para nada).
				const seDibuja = total <= MAX_LLAMADAS_DIBUJADAS;
				const llamada: Llamada = {
					etiqueta: seDibuja ? `${nombre}(${args.map(mostrar).join(", ")})` : "",
					resultado: null,
					hijos: [],
				};
				if (seDibuja) {
					pila[pila.length - 1].hijos.push(llamada);
				}
				pila.push(llamada);
				profundidadMaxima = Math.max(profundidadMaxima, pila.length - 1);
			},
			salir(valor) {
				const llamada = pila.pop();
				if (llamada !== undefined && llamada.etiqueta !== "") {
					llamada.resultado = valor instanceof object.ErrorObj ? `ERROR: ${valor.message}` : mostrar(valor);
				}
			},
		},
		() => ejecutar(codigo, env),
	);

	if (total === 0) {
		return { resultado, lineas: ["(no hubo llamadas a funciones)"] };
	}

	const lineas: string[] = [];
	const presupuesto = { restantes: MAX_LLAMADAS_DIBUJADAS };
	raiz.hijos.forEach((llamada, i) => {
		dibujar(llamada, "", "", i === raiz.hijos.length - 1, lineas, presupuesto, true);
	});

	const dibujadas = MAX_LLAMADAS_DIBUJADAS - presupuesto.restantes;
	if (dibujadas < total) {
		lineas.push(`… (se muestran ${dibujadas} de ${total} llamadas)`);
	}
	lineas.push(`${total} ${total === 1 ? "llamada" : "llamadas"} · profundidad máxima ${profundidadMaxima}`);
	return { resultado, lineas };
}

// dibujar agrega al dibujo una llamada y, recursivamente, sus hijos.
// Las llamadas de primer nivel (raiz) van sin rama; las demás llevan ├─ o └─
// y el prefijo que continúa las líneas verticales de sus ancestros.
function dibujar(
	llamada: Llamada,
	prefijo: string,
	rama: string,
	esUltima: boolean,
	lineas: string[],
	presupuesto: { restantes: number },
	esRaiz: boolean,
): void {
	if (presupuesto.restantes === 0) {
		return;
	}
	presupuesto.restantes -= 1;

	const flecha = llamada.resultado === null ? "" : ` → ${llamada.resultado}`;
	lineas.push(`${prefijo}${rama}${llamada.etiqueta}${flecha}`);

	// Los hijos continúan la línea vertical si esta llamada no era la última.
	const prefijoHijos = esRaiz ? "" : prefijo + (esUltima ? "   " : "│  ");
	llamada.hijos.forEach((hijo, i) => {
		const ultimo = i === llamada.hijos.length - 1;
		dibujar(hijo, prefijoHijos, ultimo ? "└─ " : "├─ ", ultimo, lineas, presupuesto, false);
	});
}

// mostrar convierte un valor en texto para la traza. Los textos van entre
// comillas (para distinguir "5" de 5) y lo muy largo se recorta.
function mostrar(valor: object.Obj): string {
	const texto = valor instanceof object.StringObj ? JSON.stringify(valor.value) : valor.inspect();
	return texto.length > MAX_TEXTO ? texto.slice(0, MAX_TEXTO - 1) + "…" : texto;
}
