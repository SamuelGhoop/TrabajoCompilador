// Módulo object define los VALORES que existen mientras el programa se
// ejecuta. El parser produce un árbol (AST) que solo describe el código;
// el evaluador recorre ese árbol y produce objetos de este módulo.
//
//	Código:      1 + 2
//	AST:         InfixExpression(+, IntegerLiteral 1, IntegerLiteral 2)
//	Resultado:   Integer { value: 3n }
//
// Todo valor implementa la interfaz Obj: dice de qué tipo es (type) y
// cómo mostrarse (inspect), que es lo que imprime el REPL.
import type * as ast from "../ast/ast";
import type { Environment } from "./environment";

// ObjectType es el TIPO de un valor. Se usa en los mensajes de error, por
// ejemplo "tipos incompatibles: INTEGER + BOOLEAN".
export type ObjectType = string;

export const INTEGER_OBJ = "INTEGER";
export const BOOLEAN_OBJ = "BOOLEAN";
export const STRING_OBJ = "STRING";
export const NULL_OBJ = "NULL";
export const RETURN_VALUE_OBJ = "RETURN_VALUE";
export const ERROR_OBJ = "ERROR";
export const FUNCTION_OBJ = "FUNCTION";
export const BUILTIN_OBJ = "BUILTIN";
export const ARRAY_OBJ = "ARRAY";
export const HASH_OBJ = "HASH";

// Obj es la interfaz que implementan todos los valores. (Se llama Obj y no
// Object para no tapar el Object global de JavaScript.)
export interface Obj {
	type(): ObjectType;
	inspect(): string;
}

// Hashable es un valor que puede usarse como clave de un hash. Solo los
// enteros, booleanos y textos lo son: hashKey devuelve un texto que es
// igual para dos valores iguales ("INTEGER:5" para el 5).
export interface Hashable extends Obj {
	hashKey(): string;
}

// isHashable indica si un valor puede usarse como clave de un hash.
export function isHashable(obj: Obj): obj is Hashable {
	return "hashKey" in obj;
}

// ---------------------------------------------------------------------------
// Valores simples
// ---------------------------------------------------------------------------

// Integer es un número entero de 64 bits con signo (como el int64 de Go). Se
// guarda en un bigint; el evaluador revisa que cada resultado quepa en 64 bits.
export class Integer implements Hashable {
	constructor(public value: bigint) {}

	type(): ObjectType {
		return INTEGER_OBJ;
	}
	inspect(): string {
		return this.value.toString();
	}
	hashKey(): string {
		return `${INTEGER_OBJ}:${this.value}`;
	}
}

// BooleanObj es true o false. Solo existen dos instancias (TRUE y FALSE,
// al final de este archivo) para poder compararlas con ===.
export class BooleanObj implements Hashable {
	constructor(public value: boolean) {}

	type(): ObjectType {
		return BOOLEAN_OBJ;
	}
	inspect(): string {
		return this.value.toString();
	}
	hashKey(): string {
		return `${BOOLEAN_OBJ}:${this.value}`;
	}
}

// StringObj es un texto. inspect lo muestra sin comillas, igual que el
// evaluador del profesor: "mayor" se muestra como mayor.
export class StringObj implements Hashable {
	constructor(public value: string) {}

	type(): ObjectType {
		return STRING_OBJ;
	}
	inspect(): string {
		return this.value;
	}
	hashKey(): string {
		return `${STRING_OBJ}:${this.value}`;
	}
}

// Null representa la ausencia de valor: lo que da un if sin else cuya
// condición es falsa, un índice fuera del arreglo, un ciclo, etc.
// Solo existe una instancia (NULL, al final de este archivo).
export class Null implements Obj {
	type(): ObjectType {
		return NULL_OBJ;
	}
	inspect(): string {
		return "null";
	}
}

// ---------------------------------------------------------------------------
// Valores de control
// Nunca los ve el usuario como resultado normal: sirven para que el
// evaluador sepa que tiene que dejar de ejecutar sentencias.
// ---------------------------------------------------------------------------

// ReturnValue envuelve el valor de un return. Al encontrarlo, los bloques
// dejan de ejecutar sentencias y lo pasan hacia arriba hasta la función
// (o el programa), donde se desenvuelve.
export class ReturnValue implements Obj {
	constructor(public value: Obj) {}

	type(): ObjectType {
		return RETURN_VALUE_OBJ;
	}
	inspect(): string {
		return this.value.inspect();
	}
}

// ErrorObj es un error de ejecución (por ejemplo "división por cero").
// Igual que ReturnValue, detiene la ejecución y sube hasta el programa.
//
// line y column dicen en qué parte del código ocurrió. Quien crea el error
// no las conoce; las pone el evaluador con el token del nodo que lo produjo
// (ver evaluar en evaluator.ts).
export class ErrorObj implements Obj {
	line: number | null = null;
	column: number | null = null;
	fuente: string | null = null; // el código donde está esa línea

	constructor(public message: string) {}

	type(): ObjectType {
		return ERROR_OBJ;
	}
	inspect(): string {
		return `ERROR: ${this.message}`;
	}

	// describir devuelve el mensaje completo para el usuario, con la etapa
	// y la posición: "Error de ejecución en línea 3, columna 9: división por cero".
	describir(): string {
		if (this.line === null) {
			return `Error de ejecución: ${this.message}`;
		}
		return `Error de ejecución en línea ${this.line}, columna ${this.column}: ${this.message}`;
	}
}

// ---------------------------------------------------------------------------
// Funciones
// ---------------------------------------------------------------------------

// FunctionObj es una función definida en el código. Guarda el entorno
// donde se creó (env): así, al llamarla, puede usar las variables que
// existían a su alrededor aunque se llame desde otro lugar (closure).
export class FunctionObj implements Obj {
	constructor(
		public parameters: ast.Identifier[],
		public body: ast.BlockStatement,
		public env: Environment,
	) {}

	type(): ObjectType {
		return FUNCTION_OBJ;
	}
	inspect(): string {
		return `function(${this.parameters.map((p) => p.toString()).join(", ")}) ${this.body}`;
	}
}

// BuiltinFunction es la firma de una función incluida en el lenguaje
// (len, print, ...). Recibe el entorno de quien la llama para que print
// sepa dónde escribir.
export type BuiltinFunction = (env: Environment, ...args: Obj[]) => Obj;

// Builtin es una función incluida en el lenguaje, escrita en TypeScript.
export class Builtin implements Obj {
	constructor(public fn: BuiltinFunction) {}

	type(): ObjectType {
		return BUILTIN_OBJ;
	}
	inspect(): string {
		return "función incluida";
	}
}

// ---------------------------------------------------------------------------
// Estructuras de datos
// ---------------------------------------------------------------------------

// ArrayObj es un arreglo: [1, "dos", true].
export class ArrayObj implements Obj {
	constructor(public elements: Obj[]) {}

	type(): ObjectType {
		return ARRAY_OBJ;
	}
	inspect(): string {
		return `[${this.elements.map((e) => e.inspect()).join(", ")}]`;
	}
}

// HashPair guarda la clave original junto con su valor: el Map se indexa
// con hashKey() (un texto), y así se puede volver a mostrar la clave real.
export interface HashPair {
	key: Hashable;
	value: Obj;
}

// HashObj es un hash (diccionario): {"nombre": "Kyra", "edad": 3}.
// Un Map de JavaScript conserva el orden de inserción, así inspect muestra
// las parejas en el orden en que se escribieron.
export class HashObj implements Obj {
	constructor(public pairs: Map<string, HashPair> = new Map()) {}

	type(): ObjectType {
		return HASH_OBJ;
	}
	inspect(): string {
		const pairs = [...this.pairs.values()].map((p) => `${p.key.inspect()}: ${p.value.inspect()}`);
		return `{${pairs.join(", ")}}`;
	}
}

// ---------------------------------------------------------------------------
// Instancias únicas
// Como true, false y null siempre son iguales, se crean una sola vez y se
// reutilizan; así se pueden comparar directamente con ===.
// ---------------------------------------------------------------------------

export const NULL = new Null();
export const TRUE = new BooleanObj(true);
export const FALSE = new BooleanObj(false);

// nativeBoolToBooleanObject convierte un boolean de TypeScript en TRUE o FALSE.
export function nativeBoolToBooleanObject(value: boolean): BooleanObj {
	return value ? TRUE : FALSE;
}
