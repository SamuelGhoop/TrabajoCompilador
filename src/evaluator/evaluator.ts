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
// Un error de ejecución (como "división entre cero") no lanza una excepción:
// se devuelve como un ErrorObj. Igual pasa con return, que se envuelve en
// un ReturnValue. Cada vez que se evalúa un hijo se revisa si devolvió uno
// de estos; si es así, se deja de evaluar y se pasa hacia arriba. Así un
// return dentro de un if dentro de un while sale de toda la función.
import * as ast from "../ast/ast";
import type { Environment } from "../object/environment";
import * as object from "../object/object";
import { builtins } from "./builtins";

const { NULL, TRUE, FALSE, nativeBoolToBooleanObject } = object;

// evaluar devuelve el valor de un nodo del AST en el entorno dado.
// Recibe null porque el parser deja hijos en null cuando hay errores.
export function evaluar(node: ast.Node | null, env: Environment): object.Obj {
	// --- Programa y sentencias ---
	if (node instanceof ast.Program) {
		return evaluarPrograma(node.statements, env);
	}
	if (node instanceof ast.BlockStatement) {
		return evaluarBloque(node.statements, env);
	}
	if (node instanceof ast.ExpressionStatement) {
		return evaluar(node.expression, env);
	}
	if (node instanceof ast.LetStatement) {
		const value = evaluar(node.value, env);
		if (esError(value)) {
			return value;
		}
		env.set(node.name.value, value);
		return NULL; // declarar no produce un valor
	}
	if (node instanceof ast.ReturnStatement) {
		const value = evaluar(node.returnValue, env);
		if (esError(value)) {
			return value;
		}
		return new object.ReturnValue(value);
	}

	// --- Literales ---
	if (node instanceof ast.IntegerLiteral) {
		return new object.Integer(node.value);
	}
	if (node instanceof ast.BooleanLiteral) {
		return nativeBoolToBooleanObject(node.value);
	}
	if (node instanceof ast.StringLiteral) {
		return new object.StringObj(node.value);
	}
	if (node instanceof ast.ArrayLiteral) {
		const elements = evaluarExpresiones(node.elements, env);
		if (elements instanceof object.ErrorObj) {
			return elements;
		}
		return new object.ArrayObj(elements);
	}
	if (node instanceof ast.HashLiteral) {
		return evaluarHash(node, env);
	}
	if (node instanceof ast.FunctionLiteral && node.body !== null) {
		// La función recuerda el entorno donde se creó (closure).
		return new object.FunctionObj(node.parameters, node.body, env);
	}
	if (node instanceof ast.Identifier) {
		return evaluarIdentificador(node, env);
	}

	// --- Operadores ---
	if (node instanceof ast.PrefixExpression) {
		const right = evaluar(node.right, env);
		if (esError(right)) {
			return right;
		}
		return evaluarPrefijo(node.operator, right);
	}
	if (node instanceof ast.InfixExpression) {
		const left = evaluar(node.left, env);
		if (esError(left)) {
			return left;
		}
		const right = evaluar(node.right, env);
		if (esError(right)) {
			return right;
		}
		return evaluarInfijo(node.operator, left, right);
	}
	if (node instanceof ast.AssignExpression) {
		return evaluarAsignacion(node, env);
	}

	// --- Control de flujo ---
	if (node instanceof ast.IfExpression) {
		return evaluarIf(node, env);
	}
	if (node instanceof ast.WhileExpression) {
		return evaluarWhile(node, env);
	}
	if (node instanceof ast.ForExpression) {
		return evaluarFor(node, env);
	}

	// --- Llamadas e índices ---
	if (node instanceof ast.CallExpression) {
		const func = evaluar(node.func, env);
		if (esError(func)) {
			return func;
		}
		const args = evaluarExpresiones(node.args, env);
		if (args instanceof object.ErrorObj) {
			return args;
		}
		return aplicarFuncion(func, args, env);
	}
	if (node instanceof ast.IndexExpression) {
		const left = evaluar(node.left, env);
		if (esError(left)) {
			return left;
		}
		const index = evaluar(node.index, env);
		if (esError(index)) {
			return index;
		}
		return evaluarIndice(left, index);
	}

	// Un nodo vacío (null) o que el evaluador no conoce no produce valor.
	return NULL;
}

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
		if (result instanceof object.ErrorObj) {
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
		if (result instanceof object.ReturnValue || result instanceof object.ErrorObj) {
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
function evaluarIdentificador(node: ast.Identifier, env: Environment): object.Obj {
	const value = env.get(node.value) ?? builtins.get(node.value);
	if (value === undefined) {
		return new object.ErrorObj(`identificador no encontrado: ${node.value}`);
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
		if (value instanceof object.ErrorObj) {
			return value;
		}
		result.push(value);
	}
	return result;
}

// evaluarHash evalúa cada pareja clave: valor. Las claves tienen que ser
// enteros, booleanos o textos (ver object.Hashable).
function evaluarHash(node: ast.HashLiteral, env: Environment): object.Obj {
	const pairs = new Map<string, object.HashPair>();

	for (const pair of node.pairs) {
		const key = evaluar(pair.key, env);
		if (esError(key)) {
			return key;
		}
		if (!object.isHashable(key)) {
			return new object.ErrorObj(`no se puede usar como clave de hash: ${key.type()}`);
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

// evaluarPrefijo aplica un operador prefijo:   !x   -x
function evaluarPrefijo(operator: string, right: object.Obj): object.Obj {
	switch (operator) {
		case "!":
			// ! niega la "verdad" del valor: !true → false, !null → true,
			// !5 → false (porque 5 cuenta como verdadero).
			return nativeBoolToBooleanObject(!esVerdadero(right));
		case "-":
			if (!(right instanceof object.Integer)) {
				return new object.ErrorObj(`operador desconocido: -${right.type()}`);
			}
			return new object.Integer(-right.value);
		default:
			return new object.ErrorObj(`operador desconocido: ${operator}${right.type()}`);
	}
}

// evaluarInfijo aplica un operador binario según los tipos de sus operandos:
//   - dos enteros: aritmética y comparaciones;
//   - dos textos: concatenación (+) y comparaciones de igualdad;
//   - == y != con cualquier otro par del mismo tipo comparan si son el
//     MISMO valor (true == true, null == null);
//   - tipos distintos: error (no se puede sumar un número y un booleano).
function evaluarInfijo(operator: string, left: object.Obj, right: object.Obj): object.Obj {
	if (left instanceof object.Integer && right instanceof object.Integer) {
		return evaluarInfijoEnteros(operator, left.value, right.value);
	}
	if (left instanceof object.StringObj && right instanceof object.StringObj) {
		return evaluarInfijoTextos(operator, left.value, right.value);
	}
	if (left.type() !== right.type()) {
		return new object.ErrorObj(`tipos incompatibles: ${left.type()} ${operator} ${right.type()}`);
	}
	if (operator === "==") {
		return nativeBoolToBooleanObject(left === right);
	}
	if (operator === "!=") {
		return nativeBoolToBooleanObject(left !== right);
	}
	return new object.ErrorObj(`operador desconocido: ${left.type()} ${operator} ${right.type()}`);
}

// evaluarInfijoEnteros aplica un operador entre dos enteros.
// La división es entera y trunca hacia cero (7 / 2 → 3, -7 / 2 → -3).
function evaluarInfijoEnteros(operator: string, left: bigint, right: bigint): object.Obj {
	switch (operator) {
		case "+":
			return new object.Integer(left + right);
		case "-":
			return new object.Integer(left - right);
		case "*":
			return new object.Integer(left * right);
		case "/":
			if (right === 0n) {
				return new object.ErrorObj("división entre cero");
			}
			return new object.Integer(left / right);
		case "%":
			if (right === 0n) {
				return new object.ErrorObj("módulo entre cero");
			}
			return new object.Integer(left % right);
		case "**":
			// Con enteros no hay potencias negativas (2 ** -1 sería 0.5).
			if (right < 0n) {
				return new object.ErrorObj("exponente negativo: el resultado no sería un entero");
			}
			return new object.Integer(left ** right);
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
			return new object.ErrorObj(`operador desconocido: INTEGER ${operator} INTEGER`);
	}
}

// evaluarInfijoTextos aplica un operador entre dos textos: + los une, y
// == / != los comparan.
function evaluarInfijoTextos(operator: string, left: string, right: string): object.Obj {
	switch (operator) {
		case "+":
			return new object.StringObj(left + right);
		case "==":
			return nativeBoolToBooleanObject(left === right);
		case "!=":
			return nativeBoolToBooleanObject(left !== right);
		default:
			return new object.ErrorObj(`operador desconocido: STRING ${operator} STRING`);
	}
}

// evaluarAsignacion cambia el valor de algo que ya existe:
//
//	x = 5         → la variable x tiene que estar declarada con let
//	arr[0] = 5    → cambia la posición 0 del arreglo (tiene que existir)
//	h["a"] = 5    → agrega o cambia la clave "a" del hash
//
// Devuelve el valor asignado, así a = b = 3 deja ambos en 3.
function evaluarAsignacion(node: ast.AssignExpression, env: Environment): object.Obj {
	const value = evaluar(node.value, env);
	if (esError(value)) {
		return value;
	}

	if (node.left instanceof ast.Identifier) {
		if (!env.assign(node.left.value, value)) {
			return new object.ErrorObj(
				`la variable ${node.left.value} no está declarada (usa let ${node.left.value} = ...)`,
			);
		}
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

		if (target instanceof object.ArrayObj && index instanceof object.Integer) {
			const i = Number(index.value);
			if (index.value < 0n || i >= target.elements.length) {
				return new object.ErrorObj(
					`índice fuera de rango: ${index.value} (el arreglo tiene ${target.elements.length} elementos)`,
				);
			}
			target.elements[i] = value;
			return value;
		}
		if (target instanceof object.HashObj) {
			if (!object.isHashable(index)) {
				return new object.ErrorObj(`no se puede usar como clave de hash: ${index.type()}`);
			}
			target.pairs.set(index.hashKey(), { key: index, value });
			return value;
		}
		return new object.ErrorObj(`no se puede asignar por índice en ${target.type()}`);
	}

	// El parser solo deja asignar a identificadores e índices.
	return new object.ErrorObj(`no se puede asignar a ${node.left}`);
}

// ---------------------------------------------------------------------------
// Control de flujo
// ---------------------------------------------------------------------------

// esVerdadero decide si un valor cuenta como verdadero en una condición:
// false y null son falsos; todo lo demás (incluido el 0) es verdadero.
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
// Un return o un error dentro del cuerpo detienen el ciclo y suben.
// El ciclo en sí no produce valor (devuelve null).
function evaluarWhile(node: ast.WhileExpression, env: Environment): object.Obj {
	for (;;) {
		const condition = evaluar(node.condition, env);
		if (esError(condition)) {
			return condition;
		}
		if (!esVerdadero(condition)) {
			return NULL;
		}

		const result = evaluar(node.body, env);
		if (result instanceof object.ReturnValue || result instanceof object.ErrorObj) {
			return result;
		}
	}
}

// evaluarFor ejecuta un for al estilo C:
//
//	for (<init>; <condición>; <actualización>) { <cuerpo> }
//
// El for tiene su propio entorno: la variable del init (let i = 0) solo
// existe dentro del ciclo y no choca con otra i de afuera. Si se omite la
// condición, el ciclo es infinito (hasta un return o un error).
function evaluarFor(node: ast.ForExpression, env: Environment): object.Obj {
	const loopEnv = env.enclosed();

	if (node.init !== null) {
		const init = evaluar(node.init, loopEnv);
		if (esError(init)) {
			return init;
		}
	}

	for (;;) {
		if (node.condition !== null) {
			const condition = evaluar(node.condition, loopEnv);
			if (esError(condition)) {
				return condition;
			}
			if (!esVerdadero(condition)) {
				return NULL;
			}
		}

		const result = evaluar(node.body, loopEnv);
		if (result instanceof object.ReturnValue || result instanceof object.ErrorObj) {
			return result;
		}

		if (node.update !== null) {
			const update = evaluar(node.update, loopEnv);
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
//  1. Se crea un entorno nuevo cuyo exterior es el entorno donde se DEFINIÓ
//     la función (no donde se llama): eso es lo que hace funcionar los
//     closures.
//  2. Cada parámetro se declara en ese entorno con el valor de su argumento.
//  3. Se evalúa el cuerpo y se desenvuelve el return, para que no siga
//     subiendo más allá de la función.
function aplicarFuncion(func: object.Obj, args: object.Obj[], env: Environment): object.Obj {
	if (func instanceof object.FunctionObj) {
		if (args.length !== func.parameters.length) {
			return new object.ErrorObj(
				`número de argumentos incorrecto: se recibieron ${args.length}, se esperaba ${func.parameters.length}`,
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

	return new object.ErrorObj(`no es una función: ${func.type()}`);
}

// evaluarIndice lee un elemento:   arr[0]   h["clave"]
// Un índice fuera del arreglo o una clave que no existe dan null.
function evaluarIndice(left: object.Obj, index: object.Obj): object.Obj {
	if (left instanceof object.ArrayObj && index instanceof object.Integer) {
		if (index.value < 0n || index.value >= BigInt(left.elements.length)) {
			return NULL;
		}
		return left.elements[Number(index.value)];
	}
	if (left instanceof object.HashObj) {
		if (!object.isHashable(index)) {
			return new object.ErrorObj(`no se puede usar como clave de hash: ${index.type()}`);
		}
		return left.pairs.get(index.hashKey())?.value ?? NULL;
	}
	return new object.ErrorObj(`no se puede indexar ${left.type()} con ${index.type()}`);
}

// esError indica si un valor es un error (para cortar la evaluación).
function esError(obj: object.Obj): obj is object.ErrorObj {
	return obj instanceof object.ErrorObj;
}
