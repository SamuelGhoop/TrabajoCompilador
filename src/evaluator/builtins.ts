// Módulo builtins define las funciones que ya vienen incluidas en el
// lenguaje. Están escritas en TypeScript, pero desde el código se llaman
// igual que cualquier otra función: len("hola"), print(x), str(5), ...
//
// El evaluador las busca aquí cuando un identificador no es una variable.
//
//	Salida:       print
//	Longitud:     len
//	Arreglos:     first, last, rest, push
//	Conversión:   str, int, type
//	Sorpresa:     kyra
//
// Cada una tiene también un nombre en español (imprimir, longitud, ...): ver
// nombresEnEspanol al final del archivo.
import { kyra } from "../kyra";
import type { Environment } from "../object/environment";
import * as object from "../object/object";

// Límites de un entero de 64 bits (los mismos que usa el evaluador).
const MIN_INT64 = -(2n ** 63n);
const MAX_INT64 = 2n ** 63n - 1n;

// cantidadIncorrecta crea el error de cuando se pasa un número de
// argumentos que la función no acepta (mismo texto que para las funciones
// del usuario).
function cantidadIncorrecta(esperados: number, llegaron: number): object.ErrorObj {
	return new object.ErrorObj(
		`cantidad de argumentos incorrecta: se esperaban ${esperados}, llegaron ${llegaron}`,
	);
}

// argumentoNoSoportado crea el error de cuando el argumento es de un tipo
// que la función no sabe manejar.
function argumentoNoSoportado(funcion: string, arg: object.Obj): object.ErrorObj {
	return new object.ErrorObj(`${funcion} no admite ${arg.type()}`);
}

// unArgumento envuelve una función que recibe exactamente un argumento:
// revisa la cantidad y le pasa ese argumento.
function unArgumento(fn: (arg: object.Obj) => object.Obj): object.Builtin {
	return new object.Builtin((_env, ...args) => (args.length === 1 ? fn(args[0]) : cantidadIncorrecta(1, args.length)));
}

// unArreglo envuelve una función que recibe exactamente un arreglo (first,
// last, rest).
function unArreglo(nombre: string, fn: (arr: object.ArrayObj) => object.Obj): object.Builtin {
	return unArgumento((arg) => (arg instanceof object.ArrayObj ? fn(arg) : argumentoNoSoportado(nombre, arg)));
}

export const builtins = new Map<string, object.Builtin>([
	// print escribe sus argumentos separados por espacios y termina con un
	// salto de línea. Devuelve null.
	//	print("x vale", 5)   → x vale 5
	["print", new object.Builtin((env: Environment, ...args) => {
		env.escribir(args.map((a) => a.inspect()).join(" ") + "\n");
		return object.NULL;
	})],

	// len devuelve la longitud de un texto, un arreglo o un hash.
	//	len("hola") → 4    len([1, 2]) → 2    len({"a": 1}) → 1
	["len", unArgumento((arg) => {
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

	// first y last devuelven el primer y el último elemento de un arreglo
	// (null si está vacío).
	["first", unArreglo("first", (arr) => arr.elements[0] ?? object.NULL)],
	["last", unArreglo("last", (arr) => arr.elements[arr.elements.length - 1] ?? object.NULL)],

	// rest devuelve un arreglo NUEVO con todos los elementos menos el
	// primero (null si está vacío). No modifica el original.
	//	rest([1, 2, 3]) → [2, 3]
	["rest", unArreglo("rest", (arr) =>
		arr.elements.length === 0 ? object.NULL : new object.ArrayObj(arr.elements.slice(1)))],

	// push devuelve un arreglo NUEVO con el elemento agregado al final.
	// No modifica el original: hay que guardar el resultado.
	//	let a = [1]; let b = push(a, 2);   → a sigue siendo [1], b es [1, 2]
	["push", new object.Builtin((_env, ...args) => {
		if (args.length !== 2) {
			return cantidadIncorrecta(2, args.length);
		}
		const [arr, elemento] = args;
		if (!(arr instanceof object.ArrayObj)) {
			return argumentoNoSoportado("push", arr);
		}
		return new object.ArrayObj([...arr.elements, elemento]);
	})],

	// str convierte cualquier valor en texto (lo mismo que mostraría print).
	//	str(42) → "42"    str(true) → "true"    "edad: " + str(3) → "edad: 3"
	["str", unArgumento((arg) => new object.StringObj(arg.inspect()))],

	// int convierte en entero:
	//   - un texto con un número entero ("42", "-7"; se ignoran los espacios
	//     de los lados). Cualquier otro texto es un error.
	//   - un booleano: true → 1, false → 0.
	//   - un entero: lo devuelve igual.
	["int", unArgumento((arg) => {
		if (arg instanceof object.Integer) {
			return arg;
		}
		if (arg instanceof object.BooleanObj) {
			return new object.Integer(arg.value ? 1n : 0n);
		}
		if (arg instanceof object.StringObj) {
			const texto = arg.value.trim();
			if (!/^-?[0-9]+$/.test(texto)) {
				return new object.ErrorObj(`no se puede convertir "${arg.value}" a entero`);
			}
			const value = BigInt(texto);
			if (value < MIN_INT64 || value > MAX_INT64) {
				return new object.ErrorObj("desbordamiento de entero");
			}
			return new object.Integer(value);
		}
		return argumentoNoSoportado("int", arg);
	})],

	// type devuelve el nombre del tipo de un valor como texto.
	//	type(5) → "INTEGER"   type("a") → "STRING"   type([]) → "ARRAY"
	["type", unArgumento((arg) => new object.StringObj(arg.type()))],

	// kyra es una sorpresa: dibuja a Kyra, la mascota del compilador, y ladra.
	// No recibe argumentos y devuelve null.
	["kyra", new object.Builtin((env: Environment, ...args) => {
		if (args.length !== 0) {
			return cantidadIncorrecta(0, args.length);
		}
		env.escribir(kyra.join("\n") + "\n\n        ¡Guau, guau! Soy Kyra, la boston terrier de este compilador.\n");
		return object.NULL;
	})],
]);

// Nombres en español de las funciones integradas. Son la MISMA función con
// otro nombre: imprimir("hola") hace lo mismo que print("hola").
const nombresEnEspanol: [espanol: string, original: string][] = [
	["imprimir", "print"],
	["longitud", "len"],
	["primero", "first"],
	["ultimo", "last"],
	["resto", "rest"],
	["agregar", "push"],
	["texto", "str"],
	["entero", "int"],
	["tipo", "type"],
];
for (const [espanol, original] of nombresEnEspanol) {
	const funcion = builtins.get(original);
	if (funcion !== undefined) {
		builtins.set(espanol, funcion);
	}
}
