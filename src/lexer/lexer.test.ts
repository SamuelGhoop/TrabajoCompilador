import { test } from "node:test";
import assert from "node:assert/strict";
import * as token from "../token/token";
import { Lexer } from "./lexer";

// Traducción de lexer/lexer_test.go del profe (CompiladorLemon)
test("TestNextToken", () => {
  const input = `let five = 5;
let ten = 10;

function add(x, y) {
  return x + y;
}

let result = add(five, ten);
!-/*5;
5 < 10 > 5;

if (5 < 10) {
	return true;
} else {
	return false;
}

elif {
	break;
}

for while

10 == 10;
10 != 9;
10 <= 10;
10 >= 9;
2 ** 3;
10 % 3;
"foobar"
"foo bar"
[1, 2];
{"foo": "bar"}
`;

  const tests: [token.TokenType, string][] = [
    [token.LET, "let"],
    [token.IDENT, "five"],
    [token.ASSIGN, "="],
    [token.INT, "5"],
    [token.SEMICOLON, ";"],
    [token.LET, "let"],
    [token.IDENT, "ten"],
    [token.ASSIGN, "="],
    [token.INT, "10"],
    [token.SEMICOLON, ";"],
    [token.FUNCTION, "function"],
    [token.IDENT, "add"],
    [token.LPAREN, "("],
    [token.IDENT, "x"],
    [token.COMMA, ","],
    [token.IDENT, "y"],
    [token.RPAREN, ")"],
    [token.LBRACE, "{"],
    [token.RETURN, "return"],
    [token.IDENT, "x"],
    [token.PLUS, "+"],
    [token.IDENT, "y"],
    [token.SEMICOLON, ";"],
    [token.RBRACE, "}"],
    [token.LET, "let"],
    [token.IDENT, "result"],
    [token.ASSIGN, "="],
    [token.IDENT, "add"],
    [token.LPAREN, "("],
    [token.IDENT, "five"],
    [token.COMMA, ","],
    [token.IDENT, "ten"],
    [token.RPAREN, ")"],
    [token.SEMICOLON, ";"],
    [token.BANG, "!"],
    [token.MINUS, "-"],
    [token.SLASH, "/"],
    [token.ASTERISK, "*"],
    [token.INT, "5"],
    [token.SEMICOLON, ";"],
    [token.INT, "5"],
    [token.LT, "<"],
    [token.INT, "10"],
    [token.GT, ">"],
    [token.INT, "5"],
    [token.SEMICOLON, ";"],
    [token.IF, "if"],
    [token.LPAREN, "("],
    [token.INT, "5"],
    [token.LT, "<"],
    [token.INT, "10"],
    [token.RPAREN, ")"],
    [token.LBRACE, "{"],
    [token.RETURN, "return"],
    [token.TRUE, "true"],
    [token.SEMICOLON, ";"],
    [token.RBRACE, "}"],
    [token.ELSE, "else"],
    [token.LBRACE, "{"],
    [token.RETURN, "return"],
    [token.FALSE, "false"],
    [token.SEMICOLON, ";"],
    [token.RBRACE, "}"],
    [token.ELIF, "elif"],
    [token.LBRACE, "{"],
    [token.BREAK, "break"],
    [token.SEMICOLON, ";"],
    [token.RBRACE, "}"],
    [token.FOR, "for"],
    [token.WHILE, "while"],
    [token.INT, "10"],
    [token.EQ, "=="],
    [token.INT, "10"],
    [token.SEMICOLON, ";"],
    [token.INT, "10"],
    [token.NOT_EQ, "!="],
    [token.INT, "9"],
    [token.SEMICOLON, ";"],
    [token.INT, "10"],
    [token.LTE, "<="],
    [token.INT, "10"],
    [token.SEMICOLON, ";"],
    [token.INT, "10"],
    [token.GTE, ">="],
    [token.INT, "9"],
    [token.SEMICOLON, ";"],
    [token.INT, "2"],
    [token.POW, "**"],
    [token.INT, "3"],
    [token.SEMICOLON, ";"],
    [token.INT, "10"],
    [token.MOD, "%"],
    [token.INT, "3"],
    [token.SEMICOLON, ";"],
    [token.STRING, "foobar"],
    [token.STRING, "foo bar"],
    [token.LBRACKET, "["],
    [token.INT, "1"],
    [token.COMMA, ","],
    [token.INT, "2"],
    [token.RBRACKET, "]"],
    [token.SEMICOLON, ";"],
    [token.LBRACE, "{"],
    [token.STRING, "foo"],
    [token.COLON, ":"],
    [token.STRING, "bar"],
    [token.RBRACE, "}"],
    [token.EOF, ""],
  ];

  const l = new Lexer(input);

  tests.forEach(([expectedType, expectedLiteral], i) => {
    const tok = l.nextToken();

    assert.equal(tok.type, expectedType,
      `tests[${i}] - tokentype wrong. expected="${expectedType}", got="${tok.type}"`);

    assert.equal(tok.literal, expectedLiteral,
      `tests[${i}] - literal wrong. expected="${expectedLiteral}", got="${tok.literal}"`);
  });
});

// tokens devuelve todos los tokens de la entrada (sin el EOF) como
// [tipo, literal, línea, columna].
function tokens(input: string): [string, string, number, number][] {
  const l = new Lexer(input);
  const out: [string, string, number, number][] = [];
  for (let t = l.nextToken(); t.type !== token.EOF; t = l.nextToken()) {
    out.push([t.type, t.literal, t.line, t.column]);
  }
  return out;
}

test("TestLogicalOperators", () => {
  assert.deepEqual(tokens("a && b || !c"), [
    [token.IDENT, "a", 1, 1],
    [token.AND, "&&", 1, 3],
    [token.IDENT, "b", 1, 6],
    [token.OR, "||", 1, 8],
    [token.BANG, "!", 1, 11],
    [token.IDENT, "c", 1, 12],
  ]);
});

test("TestSpanishKeywords", () => {
  // Cada palabra en español produce el MISMO token que su versión en inglés.
  const pares: [string, string][] = [
    ["sea", "let"], ["funcion", "function"], ["si", "if"], ["sinosi", "elif"],
    ["sino", "else"], ["mientras", "while"], ["para", "for"], ["retorna", "return"],
    ["verdadero", "true"], ["falso", "false"],
  ];
  for (const [espanol, ingles] of pares) {
    assert.equal(new Lexer(espanol).nextToken().type, new Lexer(ingles).nextToken().type, espanol);
  }
  // Y lo mismo con las palabras en "parce" (español colombiano).
  const parce: [string, string][] = [
    ["parce", "let"], ["vuelta", "function"], ["pilas", "if"], ["osea", "elif"],
    ["deResto", "else"], ["dele", "while"], ["pa", "for"], ["devuelva", "return"],
    ["deUna", "true"], ["paila", "false"],
  ];
  for (const [colombiano, ingles] of parce) {
    assert.equal(new Lexer(colombiano).nextToken().type, new Lexer(ingles).nextToken().type, colombiano);
  }
  // El literal conserva lo que se escribió.
  assert.deepEqual(tokens("sea x = 5;")[0], [token.LET, "sea", 1, 1]);
  assert.deepEqual(tokens("parce x = 5;")[0], [token.LET, "parce", 1, 1]);
  // Las mayúsculas importan: "deuna" (sin la U mayúscula) es un identificador.
  assert.equal(new Lexer("deuna").nextToken().type, token.IDENT);
  // Una palabra parecida que no es reservada sigue siendo un identificador.
  assert.equal(new Lexer("seas").nextToken().type, token.IDENT);
});

test("TestPositions", () => {
  // Las líneas y columnas empiezan en 1; un salto de línea pasa a la
  // siguiente línea, columna 1. La tabulación cuenta como una columna.
  assert.deepEqual(tokens('let x = 10;\n\tx == "hi"'), [
    [token.LET, "let", 1, 1],
    [token.IDENT, "x", 1, 5],
    [token.ASSIGN, "=", 1, 7],
    [token.INT, "10", 1, 9],
    [token.SEMICOLON, ";", 1, 11],
    [token.IDENT, "x", 2, 2],
    [token.EQ, "==", 2, 4],
    [token.STRING, "hi", 2, 7],
  ]);
});

test("TestComments", () => {
  // Un comentario va desde "//" hasta el final de la línea; "/" solo sigue
  // siendo la división.
  assert.deepEqual(tokens("// comentario\nlet a = 4 / 2; // otro\n// fin"), [
    [token.LET, "let", 2, 1],
    [token.IDENT, "a", 2, 5],
    [token.ASSIGN, "=", 2, 7],
    [token.INT, "4", 2, 9],
    [token.SLASH, "/", 2, 11],
    [token.INT, "2", 2, 13],
    [token.SEMICOLON, ";", 2, 14],
  ]);
});

test("TestLexicalErrors", () => {
  const l = new Lexer('let s = "hola\nx @ y & z');
  const all: token.Token[] = [];
  for (let t = l.nextToken(); t.type !== token.EOF; t = l.nextToken()) {
    all.push(t);
  }

  // El lexer no se detiene: entrega ILLEGAL y sigue con lo demás.
  assert.deepEqual(
    all.filter((t) => t.type === token.ILLEGAL).map((t) => t.literal),
    ['"hola\nx @ y & z'],
  );
  assert.deepEqual(l.getErrors(), [
    // El mensaje muestra solo la primera línea de la cadena sin cerrar.
    'Error léxico en línea 1, columna 9: cadena sin cerrar "hola (falta la comilla de cierre)',
  ]);

  const l2 = new Lexer("x @ y & z | w");
  while (l2.nextToken().type !== token.EOF) {
    // se consumen todos los tokens
  }
  assert.deepEqual(l2.getErrors(), [
    "Error léxico en línea 1, columna 3: carácter no reconocido '@'",
    "Error léxico en línea 1, columna 7: carácter no reconocido '&'",
    "Error léxico en línea 1, columna 11: carácter no reconocido '|'",
  ]);
});

