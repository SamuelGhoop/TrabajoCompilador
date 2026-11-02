import { test } from "node:test";
import assert from "node:assert/strict";
import { Lexer } from "../lexer/lexer";
import { Environment } from "../object/environment";
import { Parser } from "../parser/parser";
import { evaluar } from "./evaluator";

// run evalúa el código y devuelve lo que mostraría el REPL (inspect) junto
// con lo que se escribió con print.
function run(input: string): { result: string; salida: string } {
  const p = new Parser(new Lexer(input));
  const program = p.parseProgram();
  assert.deepEqual(p.getErrors(), [], `errores de sintaxis para ${JSON.stringify(input)}`);

  let salida = "";
  const env = new Environment(null, (t) => (salida += t));
  return { result: evaluar(program, env).inspect(), salida };
}

// check compara el resultado de cada entrada con el esperado.
function check(tests: [string, string][]): void {
  for (const [input, expected] of tests) {
    assert.equal(run(input).result, expected, `entrada: ${input}`);
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
    ["2 ** 100", "1267650600228229401496703205376"],
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

test("TestStrings", () => {
  check([
    ['"Hola" + " " + "Kyra"', '"Hola Kyra"'],
    ['len("hola")', "4"],
    ['len("ñandú")', "5"],
  ]);
});

test("TestIfElifElse", () => {
  check([
    ["if (true) { 10 }", "10"],
    ["if (false) { 10 }", "null"],
    ["if (0) { 10 }", "10"], // el 0 cuenta como verdadero
    ["if (1 > 2) { 10 } else { 20 }", "20"],
    ["let x = 5; if (x < 3) { 1 } elif (x < 10) { 2 } else { 3 }", "2"],
    ["let x = 50; if (x < 3) { 1 } elif (x < 10) { 2 } else { 3 }", "3"],
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
    ['let h = {"a": 1}; h["b"] = 2; h["a"] = 10; h', '{"a": 10, "b": 2}'],
  ]);
});

test("TestLoops", () => {
  check([
    ["let i = 0; let s = 0; while (i < 5) { s = s + i; i = i + 1; } s", "10"],
    ["let s = 0; for (let i = 1; i <= 4; i = i + 1) { s = s + i; } s", "10"],
    ["let n = 0; for (;;) { n = n + 1; if (n == 3) { return n; } }", "3"],
    ["while (false) { 1 }", "null"],
  ]);

  // La i del for no existe afuera del ciclo.
  assert.equal(
    run("for (let i = 0; i < 2; i = i + 1) { } i").result,
    "ERROR: identificador no encontrado: i",
  );
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
    ['{"uno": 1, 2: "dos", true: 3}', '{"uno": 1, 2: "dos", true: 3}'],
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
    ["len(1)", "ERROR: el argumento de len no puede ser INTEGER"],
    ['len("a", "b")', "ERROR: número de argumentos incorrecto: se recibieron 2, se esperaba 1"],
  ]);

  const { result, salida } = run('print("x vale", 5, [1, "a"]); print()');
  assert.equal(result, "null");
  assert.equal(salida, 'x vale 5 [1, "a"]\n\n');
});

test("TestErrors", () => {
  check([
    ["5 + true;", "ERROR: tipos incompatibles: INTEGER + BOOLEAN"],
    ["5 + true; 5;", "ERROR: tipos incompatibles: INTEGER + BOOLEAN"],
    ["-true", "ERROR: operador desconocido: -BOOLEAN"],
    ["true + false;", "ERROR: operador desconocido: BOOLEAN + BOOLEAN"],
    ['"a" - "b"', "ERROR: operador desconocido: STRING - STRING"],
    ["if (10 > 1) { true + false; }", "ERROR: operador desconocido: BOOLEAN + BOOLEAN"],
    ["foobar", "ERROR: identificador no encontrado: foobar"],
    ["10 / 0", "ERROR: división entre cero"],
    ["10 % 0", "ERROR: módulo entre cero"],
    ["2 ** -1", "ERROR: exponente negativo: el resultado no sería un entero"],
    ["x = 5", "ERROR: la variable x no está declarada (usa let x = ...)"],
    ["let a = [1]; a[5] = 2", "ERROR: índice fuera de rango: 5 (el arreglo tiene 1 elementos)"],
    ['{"a": 1}[function(x) { x }]', "ERROR: no se puede usar como clave de hash: FUNCTION"],
    ["5(1)", "ERROR: no es una función: INTEGER"],
    ["let f = function(a) { a }; f(1, 2)", "ERROR: número de argumentos incorrecto: se recibieron 2, se esperaba 1"],
    ["1[0]", "ERROR: no se puede indexar INTEGER con INTEGER"],
  ]);
});
