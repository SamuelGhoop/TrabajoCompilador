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
