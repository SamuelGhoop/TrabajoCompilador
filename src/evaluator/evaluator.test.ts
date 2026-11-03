import { test } from "node:test";
import assert from "node:assert/strict";
import { Lexer } from "../lexer/lexer";
import { Environment } from "../object/environment";
import * as object from "../object/object";
import { Parser } from "../parser/parser";
import { evaluar } from "./evaluator";

// evaluarCodigo analiza y ejecuta el código; devuelve el valor final y lo
// que se escribió con print.
function evaluarCodigo(input: string): { value: object.Obj; salida: string } {
  const p = new Parser(new Lexer(input));
  const program = p.parseProgram();
  assert.deepEqual(p.getErrors(), [], `errores de sintaxis para ${JSON.stringify(input)}`);

  let salida = "";
  const env = new Environment(null, (t) => (salida += t));
  return { value: evaluar(program, env), salida };
}

// run devuelve lo que mostraría el REPL (inspect) para el código.
function run(input: string): string {
  return evaluarCodigo(input).value.inspect();
}

// check compara el resultado de cada entrada con el esperado.
function check(tests: [string, string][]): void {
  for (const [input, expected] of tests) {
    assert.equal(run(input), expected, `entrada: ${input}`);
  }
}

test("TestIntegerArithmetic", () => {
  check([
    ["5", "5"],
    ["-10", "-10"],
    ["5 + 5 + 5 + 5 - 10", "10"],
    ["2 * (5 + 10)", "30"],
    ["50 / 2 * 2 + 10", "60"],
    ["7 / 2", "3"],
    ["-7 / 2", "-3"],
    ["10 % 3", "1"],
    ["2 ** 10", "1024"],
    ["2 ** 3 ** 2", "512"],
    ["-2 ** 2", "-4"],
    ["(-1) ** 1000001", "-1"],
    ["9223372036854775807", "9223372036854775807"],
  ]);
});

test("TestIntegerOverflow", () => {
  // Los enteros son de 64 bits, como en Go: pasarse es un error, no un
  // resultado equivocado.
  check([
    ["9223372036854775807 + 1", "ERROR: desbordamiento de entero"],
    ["2 ** 63", "ERROR: desbordamiento de entero"],
    ["2 ** 62", "4611686018427387904"],
    ["2 ** 100", "ERROR: desbordamiento de entero"],
    ["-9223372036854775807 - 1", "-9223372036854775808"],
    ["-(-9223372036854775807 - 1)", "ERROR: desbordamiento de entero"],
  ]);
});

test("TestBooleansAndComparisons", () => {
  check([
    ["true", "true"],
    ["1 < 2", "true"],
    ["1 >= 2", "false"],
    ["2 <= 2", "true"],
    ["1 == 1", "true"],
    ["1 != 1", "false"],
    ["true == true", "true"],
    ["true != false", "true"],
    ["(1 < 2) == true", "true"],
    ["!true", "false"],
    ["!5", "false"],
    ["!!5", "true"],
    ['"a" == "a"', "true"],
    ['"a" != "b"', "true"],
  ]);
});

test("TestLogicalOperators", () => {
  check([
    ["true && true", "true"],
    ["true && false", "false"],
    ["false || true", "true"],
    ["false || false", "false"],
    ["1 < 2 && 2 < 3", "true"],
    ["1 > 2 || 2 > 3", "false"],
    ["!(true && false)", "true"],
    ['"" && 5', "true"], // el resultado siempre es booleano ("" y 5 son verdaderos)
    ["let x = 7; x > 0 && x < 10", "true"],
  ]);
});

test("TestShortCircuit", () => {
  // El lado derecho NO se evalúa si el izquierdo ya decide el resultado:
  // por eso no hay error de división por cero ni de variable no definida.
  check([
    ["let x = 0; x != 0 && 10 / x > 1", "false"],
    ["true || noExiste", "true"],
    ["false && noExiste", "false"],
  ]);
  // Si sí hace falta evaluar el lado derecho, sus errores aparecen.
  assert.equal(run("true && noExiste"), "ERROR: identificador no definido: noExiste");

  // Una función con efectos (print) solo se llama cuando hace falta.
  const { salida } = evaluarCodigo('let f = function() { print("llamada"); true }; false && f(); true || f(); true && f()');
  assert.equal(salida, "llamada\n");
});

test("TestStrings", () => {
  check([
    ['"Hola" + " " + "Kyra"', "Hola Kyra"],
    ['len("hola")', "4"],
    ['len("ñandú")', "5"],
  ]);
});

test("TestIfElifElse", () => {
  check([
    ["if (true) { 10 }", "10"],
    ["if (false) { 10 }", "null"],
    ["if (0) { 10 }", "10"], // el 0 cuenta como verdadero
    ['if ("") { 10 }', "10"], // y el texto vacío también
    ["if (1 > 2) { 10 } else { 20 }", "20"],
    ["let x = 5; if (x < 3) { 1 } elif (x < 10) { 2 } else { 3 }", "2"],
    ["let x = 50; if (x < 3) { 1 } elif (x < 10) { 2 } else { 3 }", "3"],
    // Condicionales anidados.
    ["let a = 5; let b = 8; if (a > 0) { if (b > 10) { 1 } else { 2 } } else { 3 }", "2"],
  ]);
});

test("TestReturn", () => {
  check([
    ["return 10; 9;", "10"],
    ["9; return 2 * 5; 9;", "10"],
    ["if (10 > 1) { if (10 > 1) { return 10; } return 1; }", "10"],
    ["let f = function() { while (true) { return 7; } }; f()", "7"],
  ]);
});

test("TestLetAndAssign", () => {
  check([
    ["let a = 5; a;", "5"],
    ["let a = 5; let b = a * 2; b;", "10"],
    ["let a = 1; a = a + 1; a", "2"],
    ["let a = 1; let b = 1; a = b = 3; a + b", "6"],
    ["let arr = [1, 2, 3]; arr[1] = 20; arr", "[1, 20, 3]"],
    ['let h = {"a": 1}; h["b"] = 2; h["a"] = 10; h', "{a: 10, b: 2}"],
    ["let m = [[1, 2], [3, 4]]; m[1][0] = 9; m", "[[1, 2], [9, 4]]"],
  ]);
});

test("TestLoops", () => {
  check([
    ["let i = 0; let s = 0; while (i < 5) { s = s + i; i = i + 1; } s", "10"],
    ["let s = 0; for (let i = 1; i <= 4; i = i + 1) { s = s + i; } s", "10"],
    ["let n = 0; for (;;) { n = n + 1; if (n == 3) { return n; } }", "3"],
    ["while (false) { 1 }", "null"],
    // El valor de un ciclo es el de su última vuelta.
    ["let i = 0; while (i < 3) { i = i + 1; i * 10 }", "30"],
    // Como en el evaluador del profesor, la i del for sigue existiendo después.
    ["for (let i = 0; i < 3; i = i + 1) { } i", "3"],
  ]);
});

test("TestScopes", () => {
  check([
    // Un parámetro con el mismo nombre que una global la tapa solo adentro.
    ["let x = 10; let f = function(x) { x * 2 }; f(3) + x", "16"],
    // Un let dentro de una función crea una variable LOCAL.
    ["let x = 10; let f = function() { let x = 99; x }; f(); x", "10"],
    ["let x = 10; let f = function() { let x = 99; x }; f()", "99"],
    // Sin let, la asignación cambia la variable GLOBAL.
    ["let x = 10; let f = function() { x = 99; }; f(); x", "99"],
    // Las variables locales no existen afuera.
    ["let f = function() { let local = 1; }; f(); local", "ERROR: identificador no definido: local"],
    // Cada llamada tiene su propio ámbito (necesario para la recursión).
    ["let f = function(n) { if (n == 0) { return 0; } let y = n; f(n - 1); y }; f(3)", "3"],
  ]);
});

test("TestFunctionsAndClosures", () => {
  check([
    ["let identidad = function(x) { x; }; identidad(5);", "5"],
    ["let suma = function(a, b) { return a + b; }; suma(5, suma(5, 5));", "15"],
    ["function(x) { x * 2 }(5)", "10"],
    ["let sumador = function(x) { function(y) { x + y } }; let masDos = sumador(2); masDos(3)", "5"],
    [
      "let fib = function(n) { if (n < 2) { return n; } return fib(n - 1) + fib(n - 2); }; fib(15)",
      "610",
    ],
    // Funciones de orden superior: una función recibe otra función.
    ["let aplicar = function(f, x) { f(f(x)) }; aplicar(function(n) { n * 3 }, 2)", "18"],
    // Una función puede cambiar una variable de afuera.
    ["let c = 0; let inc = function() { c = c + 1; }; inc(); inc(); c", "2"],
  ]);
});

test("TestArraysAndHashes", () => {
  check([
    ["[1, 2 * 2, 3 + 3]", "[1, 4, 6]"],
    ["[1, 2, 3][0]", "1"],
    ["let a = [1, 2, 3]; a[1 + 1]", "3"],
    ["[1, 2, 3][3]", "null"],
    ["[1, 2, 3][-1]", "null"],
    ['["a", "b"]', "[a, b]"],
    ["[1, 2] + [3]", "[1, 2, 3]"],
    ["let a = [1]; let b = a + [2]; a", "[1]"], // + no cambia los originales
    ['{"uno": 1, 2: "dos", true: 3}', "{uno: 1, 2: dos, true: 3}"],
    ['{"a": 5}["a"]', "5"],
    ['{"a": 5}["b"]', "null"],
    ['let k = "a"; {"a": 5}[k]', "5"],
    ["{}", "{}"],
  ]);
});

test("TestBuiltins", () => {
  check([
    ["len([1, 2, 3])", "3"],
    ['len({"a": 1})', "1"],
    ["first([1, 2, 3])", "1"],
    ["first([])", "null"],
    ["last([1, 2, 3])", "3"],
    ["rest([1, 2, 3])", "[2, 3]"],
    ["rest([])", "null"],
    ["let a = [1]; let b = push(a, 2); [a, b]", "[[1], [1, 2]]"],
    ["len(1)", "ERROR: len no admite INTEGER"],
    ['len("a", "b")', "ERROR: cantidad de argumentos incorrecta: se esperaban 1, llegaron 2"],
  ]);

  const { value, salida } = evaluarCodigo('print("x vale", 5, [1, "a"]); print()');
  assert.equal(value, object.NULL);
  assert.equal(salida, "x vale 5 [1, a]\n\n");
});

test("TestTypeConversion", () => {
  check([
    ["str(42)", "42"],
    ['"edad: " + str(3)', "edad: 3"],
    ["type(str(42))", "STRING"],
    ['int("42") + 1', "43"],
    ['int("  -7 ")', "-7"],
    ["int(true) + int(false)", "1"],
    ["int(5)", "5"],
    ['int("4.5")', 'ERROR: no se puede convertir "4.5" a entero'],
    ['int("abc")', 'ERROR: no se puede convertir "abc" a entero'],
    ['int("99999999999999999999")', "ERROR: desbordamiento de entero"],
    ["int([1])", "ERROR: int no admite ARRAY"],
    ["type(5)", "INTEGER"],
    ['type("a")', "STRING"],
    ["type(true)", "BOOLEAN"],
    ["type(null)", "ERROR: identificador no definido: null"], // null no es una palabra del lenguaje
    ["type(if (false) { 1 })", "NULL"],
    ["type([1])", "ARRAY"],
    ['type({"a": 1})', "HASH"],
    ["type(function(x) { x })", "FUNCTION"],
    ["type(len)", "BUILTIN"],
  ]);
});

test("TestErrors", () => {
  check([
    ["5 + true;", "ERROR: tipos incompatibles: INTEGER + BOOLEAN"],
    ["5 + true; 5;", "ERROR: tipos incompatibles: INTEGER + BOOLEAN"],
    ['"5" + 5', "ERROR: tipos incompatibles: STRING + INTEGER"],
    ["-true", "ERROR: operador - no admite BOOLEAN"],
    ["true + false;", "ERROR: operador no admitido: BOOLEAN + BOOLEAN"],
    ['"a" - "b"', "ERROR: operador no admitido: STRING - STRING"],
    ["if (10 > 1) { true + false; }", "ERROR: operador no admitido: BOOLEAN + BOOLEAN"],
    ["foobar", "ERROR: identificador no definido: foobar"],
    ["10 / 0", "ERROR: división por cero"],
    ["10 % 0", "ERROR: módulo por cero"],
    ["2 ** -1", "ERROR: exponente negativo: -1"],
    ["x = 5", "ERROR: identificador no definido: x"],
    ["let a = [1]; a[5] = 2", "ERROR: índice de arreglo fuera de rango: 5"],
    ['let a = [1]; a["x"]', "ERROR: índice de arreglo debe ser INTEGER, recibido STRING"],
    ['{"a": 1}[function(x) { x }]', "ERROR: tipo de clave no admitido: FUNCTION"],
    ["5(1)", "ERROR: INTEGER no es una función"],
    ["let f = function(a) { a }; f(1, 2)", "ERROR: cantidad de argumentos incorrecta: se esperaban 1, llegaron 2"],
    ["1[0]", "ERROR: no se puede indexar INTEGER"],
  ]);
});

test("TestErrorPositions", () => {
  // El error queda marcado con la posición del nodo que falló.
  const casos: [string, string][] = [
    ["10 / 0", "Error de ejecución en línea 1, columna 4: división por cero"],
    ["let a = 1;\nlet b = a + noExiste;", "Error de ejecución en línea 2, columna 13: identificador no definido: noExiste"],
    [
      "let f = function(n) {\n  return n * true;\n};\nf(2)",
      "Error de ejecución en línea 2, columna 12: tipos incompatibles: INTEGER * BOOLEAN",
    ],
  ];
  for (const [input, expected] of casos) {
    const { value } = evaluarCodigo(input);
    assert.ok(value instanceof object.ErrorObj, `entrada: ${input}`);
    assert.equal(value.describir(), expected, `entrada: ${input}`);
  }
});
