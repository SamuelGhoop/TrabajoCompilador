import * as token from "../token/token";

// Lexer representa el analizador léxico.
// Mantiene el estado del código fuente que se está analizando.
export class Lexer {
	private input: string;
	private position = 0;      // current position in input (points to current char)
	private readPosition = 0;  // current reading position in input (after current char)
	private ch = "\0";         // current char under examination

	// El constructor inicializa un nuevo Lexer con el código fuente proporcionado como entrada
	// (hace lo que en Go hacía New). Llama a readChar() por primera vez para inicializar los punteros.
	constructor(input: string) {
		this.input = input;
		this.readChar();
	}

	// readChar avanza los punteros (position y readPosition) y actualiza
	// el carácter actual (ch). Si llega al final de la entrada, asigna "\0" (NUL) a ch.
	private readChar(): void {
		if (this.readPosition >= this.input.length) {
			this.ch = "\0";
		} else {
			this.ch = this.input[this.readPosition];
		}
		this.position = this.readPosition;
		this.readPosition += 1;
	}

	// nextToken evalúa el carácter actual, crea el token correspondiente,
	// avanza los punteros y retorna el token resultante.
	nextToken(): token.Token {
		let tok: token.Token;

		this.skipWhitespace();

		switch (this.ch) {
			case "=":
				if (this.peekChar() === "=") {
					const ch = this.ch;
					this.readChar();
					const literal = ch + this.ch;
					tok = { type: token.EQ, literal: literal };
				} else {
					tok = newToken(token.ASSIGN, this.ch);
				}
				break;
			case "+":
				tok = newToken(token.PLUS, this.ch);
				break;
			case "-":
				tok = newToken(token.MINUS, this.ch);
				break;
			case "!":
				if (this.peekChar() === "=") {
					const ch = this.ch;
					this.readChar();
					const literal = ch + this.ch;
					tok = { type: token.NOT_EQ, literal: literal };
				} else {
					tok = newToken(token.BANG, this.ch);
				}
				break;
			case "/":
				tok = newToken(token.SLASH, this.ch);
				break;
			case "*":
				if (this.peekChar() === "*") {
					const ch = this.ch;
					this.readChar();
					const literal = ch + this.ch;
					tok = { type: token.POW, literal: literal };
				} else {
					tok = newToken(token.ASTERISK, this.ch);
				}
				break;
			case "<":
				if (this.peekChar() === "=") {
					const ch = this.ch;
					this.readChar();
					const literal = ch + this.ch;
					tok = { type: token.LTE, literal: literal };
				} else {
					tok = newToken(token.LT, this.ch);
				}
				break;
			case ">":
				if (this.peekChar() === "=") {
					const ch = this.ch;
					this.readChar();
					const literal = ch + this.ch;
					tok = { type: token.GTE, literal: literal };
				} else {
					tok = newToken(token.GT, this.ch);
				}
				break;
			case ";":
				tok = newToken(token.SEMICOLON, this.ch);
				break;
			case ",":
				tok = newToken(token.COMMA, this.ch);
				break;
			case "{":
				tok = newToken(token.LBRACE, this.ch);
				break;
			case "}":
				tok = newToken(token.RBRACE, this.ch);
				break;
			case "(":
				tok = newToken(token.LPAREN, this.ch);
				break;
			case ")":
				tok = newToken(token.RPAREN, this.ch);
				break;
			case "[":
				tok = newToken(token.LBRACKET, this.ch);
				break;
			case "]":
				tok = newToken(token.RBRACKET, this.ch);
				break;
			case "\0":
				tok = { type: token.EOF, literal: "" };
				break;
			default:
				if (isLetter(this.ch)) {
					// readIdentifier ya avanzó los punteros: se retorna aquí para no saltarse un carácter
					const literal = this.readIdentifier();
					return { type: token.lookupIdent(literal), literal: literal };
				} else if (isDigit(this.ch)) {
					// igual que arriba: readNumber ya avanzó los punteros
					return { type: token.INT, literal: this.readNumber() };
				} else {
					tok = newToken(token.ILLEGAL, this.ch);
				}
		}

		this.readChar();
		return tok;
	}

	// skipWhitespace ignora cualquier espacio en blanco, tabulación o salto de línea
	// avanzando los punteros hasta encontrar un carácter válido.
	private skipWhitespace(): void {
		while (this.ch === " " || this.ch === "\t" || this.ch === "\n" || this.ch === "\r") {
			this.readChar();
		}
	}

	// readIdentifier lee de manera secuencial los caracteres mientras sean letras.
	// Retorna la palabra completa formada por esas letras.
	private readIdentifier(): string {
		const position = this.position;
		while (isLetter(this.ch)) {
			this.readChar();
		}
		return this.input.slice(position, this.position);
	}

	// readNumber lee de manera secuencial los caracteres mientras sean dígitos.
	// Retorna el número completo como string.
	private readNumber(): string {
		const position = this.position;
		while (isDigit(this.ch)) {
			this.readChar();
		}
		return this.input.slice(position, this.position);
	}

	// peekChar "espía" el siguiente carácter en la entrada sin avanzar los punteros.
	// Es útil para operadores de dos caracteres como '==' o '!='.
	private peekChar(): string {
		if (this.readPosition >= this.input.length) {
			return "\0";
		} else {
			return this.input[this.readPosition];
		}
	}
}

// isLetter verifica si un carácter es una letra o un guión bajo.
// Esto permite que los identificadores puedan contener cosas como 'mi_variable'.
function isLetter(ch: string): boolean {
	return "a" <= ch && ch <= "z" || "A" <= ch && ch <= "Z" || ch === "_";
}

// isDigit verifica si el carácter actual es un número entre 0 y 9.
function isDigit(ch: string): boolean {
	return "0" <= ch && ch <= "9";
}

// newToken es una función auxiliar para crear e instanciar un Token rápidamente.
function newToken(tokenType: token.TokenType, ch: string): token.Token {
	return { type: tokenType, literal: ch };
}
