// Módulo evaluator implementa el EVALUADOR: el paso que por fin EJECUTA
// el programa.
//
//	texto ──lexer──▶ tokens ──parser──▶ AST ──evaluador──▶ resultado
//
// ¿Cómo lo hace? — Evaluador de recorrido de árbol (tree-walking)
// La función evaluar recibe un nodo del AST y devuelve su valor (un Obj).
// Para los nodos con hijos, primero evalúa los hijos y luego combina sus
// valores. Por ejemplo, para (1 + (2 * 3)):
//
//	evaluar(+)
//	├── evaluar(1)        → Integer 1
//	└── evaluar(*)
//	    ├── evaluar(2)    → Integer 2
//	    └── evaluar(3)    → Integer 3
//	                      → Integer 6
//	                      → Integer 7
//
// Las variables se guardan en un Environment (ver object/environment.ts).
//
// Errores y return
// Un error de ejecución (como "división por cero") no lanza una excepción:
// se devuelve como un ErrorObj. Igual pasa con return, que se envuelve en
// un ReturnValue. Cada vez que se evalúa un hijo se revisa si devolvió uno
// de estos; si es así, se deja de evaluar y se pasa hacia arriba. Así un
// return dentro de un if dentro de un while sale de toda la función.
//
// El comportamiento sigue al evaluador en Go del profesor (rama evaluator
// de compi8am), y agrega los operadores lógicos y las funciones incluidas.
import * as ast from "../ast/ast";
import type { Environment } from "../object/environment";
import * as object from "../object/object";
import { builtins } from "./builtins";

const { NULL, TRUE, FALSE, nativeBoolToBooleanObject } = object;

// Límites de un entero de 64 bits con signo (el int64 de Go).
const MIN_INT64 = -(2n ** 63n);
const MAX_INT64 = 2n ** 63n - 1n;

// evaluar devuelve el valor de un nodo del AST en el entorno dado.
//
// Además, si el resultado es un error que todavía no sabe dónde ocurrió, le
// pone la línea y la columna del token de ESTE nodo. Como los errores suben
// desde el nodo más profundo, la posición que queda es la del nodo que
// realmente falló: en "1 + x", la de x; en "10 / 0", la del "/".
export function evaluar(node: ast.Node | null, env: Environment): object.Obj {
	const result = evaluarNodo(node, env);
	if (esError(result) && result.line === null && node !== null && "token" in node) {
		const tok = (node as { token: { line: number; column: number } }).token;
		result.line = tok.line;
		result.column = tok.column;
	}
	return result;
}

// ---------------------------------------------------------------------------
// Tabla de evaluadores
//
// Igual que el parser tiene una tabla que dice qué función parsea cada tipo
// de token (prefixParseFns), el evaluador tiene una tabla que dice qué
// función evalúa cada tipo de nodo. Para evaluar un nodo se busca su clase
// en la tabla: una sola búsqueda, en lugar de preguntar "¿es un Program?,
// ¿es un LetStatement?, ..." uno por uno. Eso importa en programas que
// evalúan millones de nodos (como fibonacci(34)).
//
// Para agregar un nodo nuevo al lenguaje basta con registrar aquí su función.
// ---------------------------------------------------------------------------

// EvaluadorDeNodo es una función que evalúa un tipo concreto de nodo.
type EvaluadorDeNodo<T> = (node: T, env: Environment) => object.Obj;

// La clave es la clase del nodo (por ejemplo ast.IfExpression).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const evaluadores = new Map<Function, EvaluadorDeNodo<any>>();

// registrar asocia una clase de nodo con la función que lo evalúa.
function registrar<T extends ast.Node>(clase: abstract new (...args: never[]) => T, fn: EvaluadorDeNodo<T>): void {
	evaluadores.set(clase, fn);
}

// evaluarNodo busca en la tabla la función del tipo de nodo y la llama.
function evaluarNodo(node: ast.Node | null, env: Environment): object.Obj {
	if (node === null) {
		// Solo pasa con un nodo que faltó por un error de sintaxis (y el REPL
		// no ejecuta programas con errores de sintaxis).
		return new object.ErrorObj("nodo incompleto del AST");
	}
	const fn = evaluadores.get(node.constructor);
	if (fn === undefined) {
		return new object.ErrorObj(`nodo no soportado: ${node.constructor.name}`);
	}
	return fn(node, env);
}

// --- Programa y sentencias ---
registrar(ast.Program, (node, env) => evaluarPrograma(node.statements, env));
registrar(ast.BlockStatement, (node, env) => evaluarBloque(node.statements, env));
registrar(ast.ExpressionStatement, (node, env) => evaluar(node.expression, env));
registrar(ast.LetStatement, (node, env) => {
	const value = evaluar(node.value, env);
	if (esError(value)) {
		return value;
	}
	env.set(node.name.value, value);
	return NULL; // declarar no produce un valor
});
registrar(ast.ReturnStatement, (node, env) => {
	const value = evaluar(node.returnValue, env);
	if (esError(value)) {
		return value;
	}
	return new object.ReturnValue(value);
});

// --- Literales ---
registrar(ast.IntegerLiteral, (node) => new object.Integer(node.value));
registrar(ast.BooleanLiteral, (node) => nativeBoolToBooleanObject(node.value));
registrar(ast.StringLiteral, (node) => new object.StringObj(node.value));
registrar(ast.ArrayLiteral, (node, env) => {
	const elements = evaluarExpresiones(node.elements, env);
	if (elements instanceof object.ErrorObj) {
		return elements;
	}
	return new object.ArrayObj(elements);
});
registrar(ast.HashLiteral, (node, env) => evaluarHash(node, env));
registrar(ast.FunctionLiteral, (node, env) => {
	if (node.body === null) {
		return new object.ErrorObj("nodo incompleto del AST");
	}
	// Se guarda el entorno de DEFINICIÓN; el cuerpo espera hasta la llamada.
	return new object.FunctionObj(node.parameters, node.body, env);
});
registrar(ast.Identifier, (node, env) => evaluarIdentificador(node, env));

// --- Operadores ---
registrar(ast.PrefixExpression, (node, env) => {
	const right = evaluar(node.right, env);
	if (esError(right)) {
		return right;
	}
	return evaluarPrefijo(node.operator, right);
});
registrar(ast.InfixExpression, (node, env) => {
	// && y || se evalúan aparte porque NO siempre evalúan su lado derecho.
	if (node.operator === "&&" || node.operator === "||") {
		return evaluarLogico(node, env);
	}
	const left = evaluar(node.left, env);
	if (esError(left)) {
		return left;
	}
	const right = evaluar(node.right, env);
	if (esError(right)) {
		return right;
	}
	return evaluarInfijo(node.operator, left, right);
});
registrar(ast.AssignExpression, (node, env) => evaluarAsignacion(node, env));

// --- Control de flujo ---
registrar(ast.IfExpression, (node, env) => evaluarIf(node, env));
registrar(ast.WhileExpression, (node, env) => evaluarWhile(node, env));
registrar(ast.ForExpression, (node, env) => evaluarFor(node, env));

// --- Llamadas e índices ---
registrar(ast.CallExpression, (node, env) => {
	const func = evaluar(node.func, env);
	if (esError(func)) {
		return func;
	}
	const args = evaluarExpresiones(node.args, env);
	if (args instanceof object.ErrorObj) {
		return args;
	}
	return aplicarFuncion(func, args, env);
});
registrar(ast.IndexExpression, (node, env) => {
	const left = evaluar(node.left, env);
	if (esError(left)) {
		return left;
	}
	const index = evaluar(node.index, env);
	if (esError(index)) {
		return index;
	}
	return evaluarIndice(left, index);
});

// ---------------------------------------------------------------------------
// Sentencias
// ---------------------------------------------------------------------------

// evaluarPrograma ejecuta las sentencias en orden y devuelve el valor de la
// última. Si encuentra un return, termina y DESENVUELVE su valor (el
// programa es el nivel más alto: ya no hay a quién pasárselo). Si encuentra
// un error, termina y lo devuelve.
function evaluarPrograma(statements: ast.Statement[], env: Environment): object.Obj {
	let result: object.Obj = NULL;
	for (const stmt of statements) {
		result = evaluar(stmt, env);
		if (result instanceof object.ReturnValue) {
			return result.value;
		}
		if (esError(result)) {
			return result;
		}
	}
	return result;
}

// evaluarBloque es como evaluarPrograma, pero NO desenvuelve el return: lo
// devuelve tal cual para que siga subiendo hasta la función que lo contiene.
// Por ejemplo, en
//
//	function() { if (true) { return 1; } return 2; }
//
// el return 1 tiene que salir del bloque del if Y de la función; si el
// bloque del if lo desenvolviera, la función seguiría y devolvería 2.
function evaluarBloque(statements: ast.Statement[], env: Environment): object.Obj {
	let result: object.Obj = NULL;
	for (const stmt of statements) {
		result = evaluar(stmt, env);
		if (detieneEjecucion(result)) {
			return result;
		}
	}
	return result;
}

// ---------------------------------------------------------------------------
// Identificadores, listas y hashes
// ---------------------------------------------------------------------------

// evaluarIdentificador busca el valor de un nombre: primero entre las
// variables y luego entre las funciones incluidas (len, print, ...).
// Por eso una variable puede "tapar" a una función incluida con su nombre.
function evaluarIdentificador(node: ast.Identifier, env: Environment): object.Obj {
	const value = env.get(node.value) ?? builtins.get(node.value);
	if (value === undefined) {
		return new object.ErrorObj(`identificador no definido: ${node.value}`);
	}
	return value;
}

// evaluarExpresiones evalúa una lista de expresiones de izquierda a derecha
// (argumentos de una llamada o elementos de un arreglo). Si alguna da
// error, se detiene y devuelve ese error.
function evaluarExpresiones(exps: (ast.Expression | null)[], env: Environment): object.Obj[] | object.ErrorObj {
	const result: object.Obj[] = [];
	for (const exp of exps) {
		const value = evaluar(exp, env);
		if (esError(value)) {
			return value;
		}
		result.push(value);
	}
	return result;
}

// evaluarHash evalúa cada pareja clave: valor. Las claves tienen que ser
// enteros, booleanos o textos (ver object.Hashable). Una clave repetida
// reemplaza el valor anterior.
function evaluarHash(node: ast.HashLiteral, env: Environment): object.Obj {
	const pairs = new Map<string, object.HashPair>();

	for (const pair of node.pairs) {
		const key = evaluar(pair.key, env);
		if (esError(key)) {
			return key;
		}
		if (!object.isHashable(key)) {
			return new object.ErrorObj(`tipo de clave no admitido: ${key.type()}`);
		}

		const value = evaluar(pair.value, env);
		if (esError(value)) {
			return value;
		}

		pairs.set(key.hashKey(), { key, value });
	}

	return new object.HashObj(pairs);
}

// ---------------------------------------------------------------------------
// Operadores
// ---------------------------------------------------------------------------

// entero crea un Integer revisando que el resultado quepa en 64 bits, igual
// que el checkedInteger del profesor. Sin esta revisión, 2 ** 63 daría un
// número que un int64 no puede guardar.
function entero(value: bigint): object.Obj {
	if (value < MIN_INT64 || value > MAX_INT64) {
		return new object.ErrorObj("desbordamiento de entero");
	}
	return new object.Integer(value);
}

// evaluarPrefijo aplica un operador prefijo:   !x   -x
function evaluarPrefijo(operator: string, right: object.Obj): object.Obj {
	switch (operator) {
		case "!":
			// ! niega la "verdad" del valor: !true → false, !null → true,
			// !5 → false (porque 5 cuenta como verdadero).
			return nativeBoolToBooleanObject(!esVerdadero(right));
		case "-":
			if (!(right instanceof object.Integer)) {
				return new object.ErrorObj(`operador - no admite ${right.type()}`);
			}
			return entero(-right.value);
		default:
			return new object.ErrorObj(`operador prefijo desconocido: ${operator}`);
	}
}

// evaluarLogico aplica && y || con EVALUACIÓN EN CORTOCIRCUITO: el lado
// derecho solo se evalúa si hace falta para saber el resultado.
//
//	a && b   si a es falso, el resultado ya es false: b NO se evalúa.
//	a || b   si a es verdadero, el resultado ya es true: b NO se evalúa.
//
// Así "x != 0 && 10 / x > 1" no divide por cero cuando x es 0. El
// resultado siempre es un booleano (true o false).
function evaluarLogico(node: ast.InfixExpression, env: Environment): object.Obj {
	const left = evaluar(node.left, env);
	if (esError(left)) {
		return left;
	}

	if (node.operator === "&&" && !esVerdadero(left)) {
		return FALSE;
	}
	if (node.operator === "||" && esVerdadero(left)) {
		return TRUE;
	}

	const right = evaluar(node.right, env);
	if (esError(right)) {
		return right;
	}
	return nativeBoolToBooleanObject(esVerdadero(right));
}

// evaluarInfijo aplica un operador binario según los tipos de sus operandos.
// Primero se exige que ambos lados sean del MISMO tipo (no se puede sumar
// un número y un booleano); luego cada tipo admite sus operadores:
//   - enteros: aritmética y comparaciones;
//   - textos y arreglos: + los une, == y != los comparan;
//   - booleanos y el resto: == y != (para hashes y funciones comparan si
//     son el MISMO objeto, no si tienen el mismo contenido).
function evaluarInfijo(operator: string, left: object.Obj, right: object.Obj): object.Obj {
	if (left.type() !== right.type()) {
		return new object.ErrorObj(`tipos incompatibles: ${left.type()} ${operator} ${right.type()}`);
	}
	if (left instanceof object.Integer && right instanceof object.Integer) {
		return evaluarInfijoEnteros(operator, left.value, right.value);
	}
	if (left instanceof object.StringObj && right instanceof object.StringObj) {
		switch (operator) {
			case "+":
				return new object.StringObj(left.value + right.value);
			case "==":
				return nativeBoolToBooleanObject(left.value === right.value);
			case "!=":
				return nativeBoolToBooleanObject(left.value !== right.value);
		}
	} else if (left instanceof object.ArrayObj && right instanceof object.ArrayObj && operator === "+") {
		// [1] + [2] crea un arreglo NUEVO [1, 2]; los originales no cambian.
		// Es lo que usa el ejemplo de las Torres de Hanói para juntar movimientos.
		return new object.ArrayObj([...left.elements, ...right.elements]);
	} else if (operator === "==") {
		return nativeBoolToBooleanObject(left === right);
	} else if (operator === "!=") {
		return nativeBoolToBooleanObject(left !== right);
	}
	return new object.ErrorObj(`operador no admitido: ${left.type()} ${operator} ${right.type()}`);
}

// evaluarInfijoEnteros aplica un operador entre dos enteros.
// La división es entera y trunca hacia cero (7 / 2 → 3, -7 / 2 → -3).
function evaluarInfijoEnteros(operator: string, left: bigint, right: bigint): object.Obj {
	switch (operator) {
		case "+":
			return entero(left + right);
		case "-":
			return entero(left - right);
		case "*":
			return entero(left * right);
		case "/":
			if (right === 0n) {
				return new object.ErrorObj("división por cero");
			}
			return entero(left / right);
		case "%":
			if (right === 0n) {
				return new object.ErrorObj("módulo por cero");
			}
			return new object.Integer(left % right);
		case "**":
			return potencia(left, right);
		case "<":
			return nativeBoolToBooleanObject(left < right);
		case ">":
			return nativeBoolToBooleanObject(left > right);
		case "<=":
			return nativeBoolToBooleanObject(left <= right);
		case ">=":
			return nativeBoolToBooleanObject(left >= right);
		case "==":
			return nativeBoolToBooleanObject(left === right);
		case "!=":
			return nativeBoolToBooleanObject(left !== right);
		default:
			return new object.ErrorObj(`operador no admitido: INTEGER ${operator} INTEGER`);
	}
}

// potencia calcula base ** exponente con enteros.
//   - Con enteros no hay potencias negativas (2 ** -1 sería 0.5): es error.
//   - Las bases 0, 1 y -1 dan resultados pequeños con cualquier exponente.
//   - Con cualquier otra base, un exponente de 64 o más ya no cabe en 64
//     bits; se reporta sin calcularlo (2 ** 1000000 tardaría muchísimo).
function potencia(base: bigint, exponente: bigint): object.Obj {
	if (exponente < 0n) {
		return new object.ErrorObj(`exponente negativo: ${exponente}`);
	}
	if (base === 0n || base === 1n) {
		return new object.Integer(exponente === 0n ? 1n : base);
	}
	if (base === -1n) {
		return new object.Integer(exponente % 2n === 0n ? 1n : -1n);
	}
	if (exponente >= 64n) {
		return new object.ErrorObj("desbordamiento de entero");
	}
	return entero(base ** exponente);
}

// evaluarAsignacion cambia el valor de algo que ya existe:
//
//	x = 5         → la variable x tiene que estar declarada con let
//	arr[0] = 5    → cambia la posición 0 del arreglo (tiene que existir)
//	h["a"] = 5    → agrega o cambia la clave "a" del hash
//
// Primero se revisa que el destino sea válido y DESPUÉS se evalúa el nuevo
// valor: si el destino no sirve, el valor no llega a calcularse.
// Devuelve el valor asignado, así a = b = 3 deja ambos en 3.
function evaluarAsignacion(node: ast.AssignExpression, env: Environment): object.Obj {
	if (node.left instanceof ast.Identifier) {
		const name = node.left.value;
		if (env.get(name) === undefined) {
			// El error se marca en la variable (no en el '='), que es lo que falta.
			const error = new object.ErrorObj(`identificador no definido: ${name}`);
			error.line = node.left.token.line;
			error.column = node.left.token.column;
			return error;
		}
		const value = evaluar(node.value, env);
		if (esError(value)) {
			return value;
		}
		env.assign(name, value);
		return value;
	}

	if (node.left instanceof ast.IndexExpression) {
		const target = evaluar(node.left.left, env);
		if (esError(target)) {
			return target;
		}
		const index = evaluar(node.left.index, env);
		if (esError(index)) {
			return index;
		}

		if (target instanceof object.ArrayObj) {
			if (!(index instanceof object.Integer)) {
				return new object.ErrorObj(`índice de arreglo debe ser INTEGER, recibido ${index.type()}`);
			}
			if (index.value < 0n || index.value >= BigInt(target.elements.length)) {
				return new object.ErrorObj(`índice de arreglo fuera de rango: ${index.value}`);
			}
			const value = evaluar(node.value, env);
			if (esError(value)) {
				return value;
			}
			target.elements[Number(index.value)] = value;
			return value;
		}
		if (target instanceof object.HashObj) {
			if (!object.isHashable(index)) {
				return new object.ErrorObj(`tipo de clave no admitido: ${index.type()}`);
			}
			const value = evaluar(node.value, env);
			if (esError(value)) {
				return value;
			}
			target.pairs.set(index.hashKey(), { key: index, value });
			return value;
		}
		return new object.ErrorObj(`no se puede asignar por índice a ${target.type()}`);
	}

	// El parser solo deja asignar a identificadores e índices.
	return new object.ErrorObj(`destino de asignación no admitido: ${node.left}`);
}

// ---------------------------------------------------------------------------
// Control de flujo
// ---------------------------------------------------------------------------

// esVerdadero decide si un valor cuenta como verdadero en una condición:
// false y null son falsos; todo lo demás (incluidos 0, "" y []) es verdadero.
function esVerdadero(obj: object.Obj): boolean {
	return obj !== FALSE && obj !== NULL;
}

// evaluarIf ejecuta el bloque "entonces" si la condición es verdadera, o el
// "sino" si existe. Sin else y con condición falsa, devuelve null.
// (Los elif ya vienen del parser como un if dentro del else.)
function evaluarIf(node: ast.IfExpression, env: Environment): object.Obj {
	const condition = evaluar(node.condition, env);
	if (esError(condition)) {
		return condition;
	}

	if (esVerdadero(condition)) {
		return evaluar(node.consequence, env);
	}
	if (node.alternative !== null) {
		return evaluar(node.alternative, env);
	}
	return NULL;
}

// evaluarWhile repite el cuerpo mientras la condición sea verdadera.
// El valor del ciclo es el de la última vuelta (null si no dio ninguna).
// Un return o un error dentro del cuerpo detienen el ciclo y suben.
function evaluarWhile(node: ast.WhileExpression, env: Environment): object.Obj {
	let result: object.Obj = NULL;
	for (;;) {
		const condition = evaluar(node.condition, env);
		if (esError(condition)) {
			return condition;
		}
		if (!esVerdadero(condition)) {
			return result;
		}

		result = evaluar(node.body, env);
		if (detieneEjecucion(result)) {
			return result;
		}
	}
}

// evaluarFor ejecuta un for al estilo C:
//
//	for (<init>; <condición>; <actualización>) { <cuerpo> }
//
// El encabezado y el cuerpo usan el entorno ACTUAL, igual que while (como en
// el evaluador del profesor): la variable del init (let i = 0) sigue
// existiendo después del ciclo. Si se omite la condición, el ciclo es
// infinito (hasta un return o un error). El valor del ciclo es el de la
// última vuelta.
function evaluarFor(node: ast.ForExpression, env: Environment): object.Obj {
	if (node.init !== null) {
		const init = evaluar(node.init, env);
		if (esError(init)) {
			return init;
		}
	}

	let result: object.Obj = NULL;
	for (;;) {
		if (node.condition !== null) {
			const condition = evaluar(node.condition, env);
			if (esError(condition)) {
				return condition;
			}
			if (!esVerdadero(condition)) {
				return result;
			}
		}

		result = evaluar(node.body, env);
		if (detieneEjecucion(result)) {
			return result;
		}

		if (node.update !== null) {
			const update = evaluar(node.update, env);
			if (esError(update)) {
				return update;
			}
		}
	}
}

// ---------------------------------------------------------------------------
// Funciones e índices
// ---------------------------------------------------------------------------

// aplicarFuncion llama a una función con los argumentos ya evaluados.
//
// Para una función del usuario:
//  1. Se crea un entorno nuevo (el ámbito LOCAL de esta llamada) cuyo
//     exterior es el entorno donde se DEFINIÓ la función, no donde se
//     llama: eso es lo que hace funcionar los closures.
//  2. Cada parámetro se declara en ese entorno local con el valor de su
//     argumento. Si un parámetro se llama igual que una variable global,
//     la tapa solo dentro de la función.
//  3. Se evalúa el cuerpo y se desenvuelve el return, para que no siga
//     subiendo más allá de la función.
function aplicarFuncion(func: object.Obj, args: object.Obj[], env: Environment): object.Obj {
	if (func instanceof object.FunctionObj) {
		if (args.length !== func.parameters.length) {
			return new object.ErrorObj(
				`cantidad de argumentos incorrecta: se esperaban ${func.parameters.length}, llegaron ${args.length}`,
			);
		}

		const callEnv = func.env.enclosed();
		func.parameters.forEach((param, i) => callEnv.set(param.value, args[i]));

		const result = evaluar(func.body, callEnv);
		return result instanceof object.ReturnValue ? result.value : result;
	}

	if (func instanceof object.Builtin) {
		return func.fn(env, ...args);
	}

	return new object.ErrorObj(`${func.type()} no es una función`);
}

// evaluarIndice lee un elemento:   arr[0]   h["clave"]
// Un índice fuera del arreglo o una clave que no existe dan null.
function evaluarIndice(left: object.Obj, index: object.Obj): object.Obj {
	if (left instanceof object.ArrayObj) {
		if (!(index instanceof object.Integer)) {
			return new object.ErrorObj(`índice de arreglo debe ser INTEGER, recibido ${index.type()}`);
		}
		if (index.value < 0n || index.value >= BigInt(left.elements.length)) {
			return NULL;
		}
		return left.elements[Number(index.value)];
	}
	if (left instanceof object.HashObj) {
		if (!object.isHashable(index)) {
			return new object.ErrorObj(`tipo de clave no admitido: ${index.type()}`);
		}
		return left.pairs.get(index.hashKey())?.value ?? NULL;
	}
	return new object.ErrorObj(`no se puede indexar ${left.type()}`);
}

// esError indica si un valor es un error (para cortar la evaluación).
//
// Se compara la clase directamente (constructor ===) en lugar de usar
// instanceof: da lo mismo para estas clases, que no tienen subclases, pero
// es más rápido, y esta revisión se hace en cada nodo que se evalúa.
function esError(obj: object.Obj): obj is object.ErrorObj {
	return obj.constructor === object.ErrorObj;
}

// detieneEjecucion indica si un valor obliga a dejar de ejecutar sentencias
// y pasarlo hacia arriba: un return o un error.
function detieneEjecucion(obj: object.Obj): boolean {
	return obj.constructor === object.ReturnValue || obj.constructor === object.ErrorObj;
}
