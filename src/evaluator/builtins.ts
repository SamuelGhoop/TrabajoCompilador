// Módulo builtins define las funciones que ya vienen incluidas en el
// lenguaje. Están escritas en TypeScript, pero desde el código se llaman
// igual que cualquier otra función: len("hola"), print(x), ...
//
// El evaluador las busca aquí cuando un identificador no es una variable.
import type { Environment } from "../object/environment";
import * as object from "../object/object";

// argumentosIncorrectos crea el error de cuando se pasa un número de
// argumentos que la función no acepta.
function argumentosIncorrectos(recibidos: number, esperados: number): object.ErrorObj {
	return new object.ErrorObj(
		`número de argumentos incorrecto: se recibieron ${recibidos}, se esperaba ${esperados}`,
	);
}

// argumentoNoSoportado crea el error de cuando el argumento es de un tipo
// que la función no sabe manejar.
function argumentoNoSoportado(funcion: string, arg: object.Obj): object.ErrorObj {
	return new object.ErrorObj(`el argumento de ${funcion} no puede ser ${arg.type()}`);
}

// unArreglo revisa que la función reciba exactamente un arreglo y lo devuelve,
// o devuelve el error correspondiente. Lo usan first, last y rest.
function unArreglo(funcion: string, args: object.Obj[]): object.ArrayObj | object.ErrorObj {
	if (args.length !== 1) {
		return argumentosIncorrectos(args.length, 1);
	}
	if (!(args[0] instanceof object.ArrayObj)) {
		return new object.ErrorObj(`el argumento de ${funcion} debe ser ARRAY, se recibió ${args[0].type()}`);
	}
	return args[0];
}

export const builtins = new Map<string, object.Builtin>([
	// len devuelve la longitud de un texto, un arreglo o un hash.
	//	len("hola") → 4    len([1, 2]) → 2    len({"a": 1}) → 1
	["len", new object.Builtin((_env, ...args) => {
		if (args.length !== 1) {
			return argumentosIncorrectos(args.length, 1);
		}
		const arg = args[0];
		if (arg instanceof object.StringObj) {
			return new object.Integer(BigInt([...arg.value].length));
		}
		if (arg instanceof object.ArrayObj) {
			return new object.Integer(BigInt(arg.elements.length));
		}
		if (arg instanceof object.HashObj) {
			return new object.Integer(BigInt(arg.pairs.size));
		}
		return argumentoNoSoportado("len", arg);
	})],

	// first devuelve el primer elemento de un arreglo (null si está vacío).
	["first", new object.Builtin((_env, ...args) => {
		const arr = unArreglo("first", args);
		if (arr instanceof object.ErrorObj) {
			return arr;
		}
		return arr.elements[0] ?? object.NULL;
	})],

	// last devuelve el último elemento de un arreglo (null si está vacío).
	["last", new object.Builtin((_env, ...args) => {
		const arr = unArreglo("last", args);
		if (arr instanceof object.ErrorObj) {
			return arr;
		}
		return arr.elements[arr.elements.length - 1] ?? object.NULL;
	})],

	// rest devuelve un arreglo NUEVO con todos los elementos menos el
	// primero (null si está vacío). No modifica el original.
	//	rest([1, 2, 3]) → [2, 3]
	["rest", new object.Builtin((_env, ...args) => {
		const arr = unArreglo("rest", args);
		if (arr instanceof object.ErrorObj) {
			return arr;
		}
		if (arr.elements.length === 0) {
			return object.NULL;
		}
		return new object.ArrayObj(arr.elements.slice(1));
	})],

	// push devuelve un arreglo NUEVO con el elemento agregado al final.
	// No modifica el original: hay que guardar el resultado.
	//	let a = [1]; let b = push(a, 2);   → a sigue siendo [1], b es [1, 2]
	["push", new object.Builtin((_env, ...args) => {
		if (args.length !== 2) {
			return argumentosIncorrectos(args.length, 2);
		}
		const [arr, elemento] = args;
		if (!(arr instanceof object.ArrayObj)) {
			return new object.ErrorObj(`el argumento de push debe ser ARRAY, se recibió ${arr.type()}`);
		}
		return new object.ArrayObj([...arr.elements, elemento]);
	})],

	// print escribe sus argumentos separados por espacios y termina con un
	// salto de línea. Los textos se escriben sin comillas. Devuelve null.
	//	print("x vale", 5)   → x vale 5
	["print", new object.Builtin((env: Environment, ...args) => {
		const partes = args.map((a) => (a instanceof object.StringObj ? a.value : a.inspect()));
		env.escribir(partes.join(" ") + "\n");
		return object.NULL;
	})],
]);
