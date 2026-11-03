import { test } from "node:test";
import assert from "node:assert/strict";
import * as ast from "../ast/ast";
import { Lexer } from "../lexer/lexer";
import { Parser } from "./parser";

// parse pasa la entrada por el lexer y el parser, y exige que no haya errores.
function parse(input: string): ast.Program {
  const p = new Parser(new Lexer(input));
  const program = p.parseProgram();
  assert.deepEqual(p.getErrors(), [], `errores de sintaxis para ${JSON.stringify(input)}`);
  return program;
}

// parseErrors devuelve los errores de sintaxis de la entrada.
function parseErrors(input: string): string[] {
  const p = new Parser(new Lexer(input));
  p.parseProgram();
  return p.getErrors();
}

test("TestLetStatement", () => {
  const program = parse("let x = 5; let y = true; let foo = y;");

  assert.equal(program.statements.length, 3);
  const names = program.statements.map((s) => (s as ast.LetStatement).name.value);
  assert.deepEqual(names, ["x", "y", "foo"]);

  const value = (program.statements[0] as ast.LetStatement).value;
  assert.ok(value instanceof ast.IntegerLiteral);
  assert.equal(value.value, 5n);
});

test("TestReturnStatement", () => {
  const program = parse("return 5; return a + b;");

  assert.equal(program.statements.length, 2);
  assert.ok(program.statements[0] instanceof ast.ReturnStatement);
  assert.equal(program.toString(), "return 5;return (a + b);");
});

test("TestOperatorPrecedence", () => {
  const tests: [string, string][] = [
    ["-a * b", "((-a) * b)"],
    ["!-a", "(!(-a))"],
    ["a + b + c", "((a + b) + c)"],
    ["a + b * c", "(a + (b * c))"],
    ["a * b % c", "((a * b) % c)"],
    ["a + b / c - d", "((a + (b / c)) - d)"],
    ["5 > 4 == 3 < 4", "((5 > 4) == (3 < 4))"],
    ["5 >= 4 != 3 <= 4", "((5 >= 4) != (3 <= 4))"],
    ["3 + 4 * 5 == 3 * 1 + 4 * 5", "((3 + (4 * 5)) == ((3 * 1) + (4 * 5)))"],
    ["(5 + 5) * 2", "((5 + 5) * 2)"],
    ["-(5 + 5)", "(-(5 + 5))"],
    ["2 ** 3 ** 2", "(2 ** (3 ** 2))"],
    ["-2 ** 2", "(-(2 ** 2))"],
    ["2 * 3 ** 2", "(2 * (3 ** 2))"],
    ["a + add(b * c) + d", "((a + add((b * c))) + d)"],
    ["add(a, b, 1, 2 * 3, 4 + 5, add(6, 7 * 8))", "add(a, b, 1, (2 * 3), (4 + 5), add(6, (7 * 8)))"],
    ["a * [1, 2, 3, 4][b * c] * d", "((a * ([1, 2, 3, 4][(b * c)])) * d)"],
    ["add(a * b[2], b[1], 2 * [1, 2][1])", "add((a * (b[2])), (b[1]), (2 * ([1, 2][1])))"],
    ["x = 1 + 2", "x = (1 + 2)"],
    ["a = b = 3", "a = b = 3"],
    ["arr[0] = 5", "(arr[0]) = 5"],
    ["true == !false", "(true == (!false))"],
  ];

  for (const [input, expected] of tests) {
    assert.equal(parse(input).toString(), expected, `entrada: ${input}`);
  }
});

test("TestAssignIsRightAssociative", () => {
  const stmt = parse("a = b = 3").statements[0] as ast.ExpressionStatement;
  const outer = stmt.expression as ast.AssignExpression;

  assert.ok(outer instanceof ast.AssignExpression);
  assert.equal(outer.left.toString(), "a");
  assert.ok(outer.value instanceof ast.AssignExpression);
});

test("TestLiterals", () => {
  const tests: [string, string][] = [
    ['"hola mundo"', '"hola mundo"'],
    ["[]", "[]"],
    ["[1, 2 * 2, 3 + 3]", "[1, (2 * 2), (3 + 3)]"],
    ["{}", "{}"],
    ['{"one": 1, "two": 2}', '{"one": 1, "two": 2}'],
    ['{"one": 0 + 1, two: 10 - 8}', '{"one": (0 + 1), two: (10 - 8)}'],
    ["function(x, y) { x + y; }", "function(x, y) { (x + y) }"],
    ["function() { return 1; }", "function() { return 1; }"],
    ["function(x) { x * 2 }(5)", "function(x) { (x * 2) }(5)"],
  ];

  for (const [input, expected] of tests) {
    assert.equal(parse(input).toString(), expected, `entrada: ${input}`);
  }
});

test("TestControlFlow", () => {
  const tests: [string, string][] = [
    ["if (x < y) { x }", "if (x < y) { x }"],
    ["if x < y { x } else { y }", "if (x < y) { x } else { y }"],
    [
      "if (a) { 1 } elif (b) { 2 } elif (c) { 3 } else { 4 }",
      "if a { 1 } else { if b { 2 } else { if c { 3 } else { 4 } } }",
    ],
    ["while (x > 0) { x = x - 1; }", "while (x > 0) { x = (x - 1) }"],
    [
      "for (let i = 0; i < 10; i = i + 1) { print(i); }",
      "for (let i = 0; (i < 10); i = (i + 1)) { print(i) }",
    ],
    ["for (;;) { }", "for (; ; ) { }"],
  ];

  for (const [input, expected] of tests) {
    assert.equal(parse(input).toString(), expected, `entrada: ${input}`);
  }
});

test("TestIntegerLiteral", () => {
  const stmt = parse("9223372036854775807;").statements[0] as ast.ExpressionStatement;
  const lit = stmt.expression as ast.IntegerLiteral;
  assert.equal(lit.value, 9223372036854775807n);
});

test("TestLogicalPrecedence", () => {
  const tests: [string, string][] = [
    // && ata más que ||, y ambos menos que las comparaciones.
    ["a && b || c && d", "((a && b) || (c && d))"],
    ["a || b && c", "(a || (b && c))"],
    ["x < 1 || x > 5 && !y", "((x < 1) || ((x > 5) && (!y)))"],
    ["a == b && c != d", "((a == b) && (c != d))"],
    // Ambos son asociativos por la izquierda.
    ["a && b && c", "((a && b) && c)"],
    // La asignación sigue siendo la más baja.
    ["ok = a || b", "ok = (a || b)"],
  ];

  for (const [input, expected] of tests) {
    assert.equal(parse(input).toString(), expected, `entrada: ${input}`);
  }
});

test("TestParserErrors", () => {
  const tests: [string, string[]][] = [
    // El parser no se detiene en el primer error: tras abandonar el let,
    // sigue desde el '=' y reporta que no puede iniciar una expresión con él.
    ["let = 5;", [
      'Error de sintaxis en línea 1, columna 5: se esperaba IDENT, pero se encontró = ("=")',
      'Error de sintaxis en línea 1, columna 5: no se puede iniciar una expresión con = ("=")',
    ]],
    ["let x 5;", ['Error de sintaxis en línea 1, columna 7: se esperaba =, pero se encontró INT ("5")']],
    ["*5", ['Error de sintaxis en línea 1, columna 1: no se puede iniciar una expresión con * ("*")']],
    ["5 = 3", [
      "Error de sintaxis en línea 1, columna 3: no se puede asignar a 5: solo se puede asignar a una variable o a una posición (x = ..., a[i] = ...)",
    ]],
    // El error del bloque apunta a la '{' que quedó abierta.
    ["if (x) {\n  1", ["Error de sintaxis en línea 1, columna 8: bloque sin cerrar: falta '}' para la '{' de esta posición"]],
    ["99999999999999999999", [
      'Error de sintaxis en línea 1, columna 1: no se pudo convertir "99999999999999999999" a entero: no cabe en 64 bits',
    ]],
    ["for (let i = 0 i < 3; ) {}", [
      'Error de sintaxis en línea 1, columna 16: se esperaba ;, pero se encontró IDENT ("i")',
      'Error de sintaxis en línea 1, columna 23: no se puede iniciar una expresión con ) (")")',
    ]],
    // En una línea posterior, la posición lo indica.
    ["let a = 1;\nlet b = ;", ['Error de sintaxis en línea 2, columna 9: no se puede iniciar una expresión con ; (";")']],
  ];

  for (const [input, expected] of tests) {
    assert.deepEqual(parseErrors(input), expected, `entrada: ${input}`);
  }
});

test("TestLexicalErrorsComeFromTheLexer", () => {
  // Un carácter desconocido o una cadena sin cerrar son errores LÉXICOS: los
  // detecta el lexer y el parser no los repite como errores de sintaxis.
  assert.deepEqual(parseErrors("1 + @ 2"), ["Error léxico en línea 1, columna 5: carácter no reconocido '@'"]);
  assert.deepEqual(parseErrors('"hola'), ['Error léxico en línea 1, columna 1: cadena sin cerrar "hola (falta la comilla de cierre)']);
});

