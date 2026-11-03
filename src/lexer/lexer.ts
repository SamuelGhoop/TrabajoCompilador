// Módulo lexer implementa el ANALIZADOR LÉXICO del compilador.
//
// ¿Qué hace?
// Recibe el código fuente como un texto (string) y lo divide en TOKENS:
// las "palabras" del lenguaje. Ignora los espacios y agrupa los caracteres
// que van juntos (por ejemplo, las letras de un identificador o los dígitos
// de un número).
//
//	Entrada:  let x = 10 + y;
//	Tokens:   LET  IDENT(x)  =  INT(10)  +  IDENT(y)  ;  EOF
//
// El lexer NO revisa si el orden de los tokens tiene sentido ("let let 5"
// se tokeniza sin problema); eso es trabajo del parser.
//
// ¿Cómo lo hace?
// Recorre la entrada un carácter a la vez. Mira el carácter actual (y a
// veces el siguiente) para decidir qué token empieza ahí. Cada llamada a
// nextToken devuelve UN token y deja el lexer listo para el siguiente.
//
// Limitación: solo reconoce identificadores con letras ASCII (sin tildes ni ñ).
import * as token from "../token/token";

// TokenSinPosicion es un token al que todavía no se le ha puesto la línea y
// la columna (eso lo hace nextToken en un solo lugar).
type TokenSinPosicion = Omit<token.Token, "line" | "column">;

// Lexer guarda el estado del recorrido por la entrada.
//
// Ejemplo con input = "let", después de leer la 'e':
//
//	input:        l  e  t
//	índice:       0  1  2
//	position     =   1        (apunta a 'e', el carácter actual)
//	readPosition =      2     (apunta a 't', el siguiente por leer)
//	ch           = 'e'
export class Lexer {
	private input: string;
	private position = 0;     // posición actual en la entrada (apunta al carácter actual, ch)
	private readPosition = 0; // siguiente posición a leer (siempre position + 1)
	private ch = "\0";        // carácter que se está examinando ("\0" = fin de la entrada)
	private line = 1;         // línea del carácter actual (empieza en 1)
	private column = 0;       // columna del carácter actual (empieza en 1)
	private errors: string[] = []; // errores léxicos encontrados

	// El constructor (lo que en Go hacía New) llama a readChar una vez para
	// que ch quede con el primer carácter y el lexer esté listo para usarse.
	constructor(input: string) {
		this.input = input;
		this.readChar();
	}

	// getErrors devuelve los errores LÉXICOS: caracteres que no forman parte
	// del lenguaje (como '@') y cadenas sin cerrar. El lexer no se detiene
	// al encontrarlos: entrega un token ILLEGAL y sigue con el resto.
	getErrors(): string[] {
		return this.errors;
	}

	// readChar avanza una posición en la entrada: carga en ch el siguiente
	// carácter y mueve ambos índices. Al pasar del final, ch queda en "\0"
	// (el carácter NUL de ASCII), que el lexer interpreta como fin de archivo.
	// También lleva la cuenta de la línea y la columna: después de un salto
	// de línea se pasa a la línea siguiente, columna 1.
	private readChar(): void {
		if (this.ch === "\n") {
			this.line += 1;
			this.column = 1;
		} else {
			this.column += 1;
		}

		if (this.readPosition >= this.input.length) {
			this.ch = "\0";
		} else {
			this.ch = this.input[this.readPosition];
		}
		this.position = this.readPosition;
		this.readPosition += 1;
	}

	// nextToken devuelve el siguiente token de la entrada, marcado con la
	// línea y la columna donde empieza. Se llama repetidamente hasta obtener
	// un token de tipo EOF. Si el token es ILLEGAL, además registra el error
	// léxico correspondiente.
	nextToken(): token.Token {
		this.skipWhitespace();

		// La posición se toma ANTES de leer el token: es donde empieza.
		const line = this.line;
		const column = this.column;
		const tok: token.Token = { ...this.readToken(), line, column };

		if (tok.type === token.ILLEGAL) {
			const motivo = tok.literal.startsWith('"')
				? `cadena sin cerrar ${tok.literal} (falta la comilla de cierre)`
				: `carácter no reconocido '${tok.literal}'`;
			this.errors.push(`Error léxico en ${token.posicion(tok)}: ${motivo}`);
		}

		return tok;
	}

	// readToken reconoce el token que empieza en el carácter actual (sin su
	// posición, que la agrega nextToken).
	//
	// Funcionamiento:
	//  1. Según el carácter actual (ch) se decide qué token es.
	//     - Para operadores que pueden tener uno o dos caracteres ('=' / '==',
	//     '<' / '<=', '*' / '**', ...) se usa peekChar para mirar el
	//     siguiente carácter SIN consumirlo, y así decidir.
	//  2. Al final se avanza un carácter (readChar) para que la próxima
	//     llamada empiece después del token actual.
	//     (Los identificadores y números son la excepción: sus funciones de
	//     lectura ya avanzan hasta el carácter siguiente, por eso retornan
	//     antes de llegar al readChar del final.)
	private readToken(): TokenSinPosicion {
		let tok: TokenSinPosicion;

		switch (this.ch) {
			case "=":
				// "==" (comparación) o "=" (asignación)
				if (this.peekChar() === "=") {
					tok = this.makeTwoCharToken(token.EQ);
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
				// "!=" (distinto) o "!" (negación)
				if (this.peekChar() === "=") {
					tok = this.makeTwoCharToken(token.NOT_EQ);
				} else {
					tok = newToken(token.BANG, this.ch);
				}
				break;
			case "/":
				tok = newToken(token.SLASH, this.ch);
				break;
			case "*":
				// "**" (potencia) o "*" (multiplicación)
				if (this.peekChar() === "*") {
					tok = this.makeTwoCharToken(token.POW);
				} else {
					tok = newToken(token.ASTERISK, this.ch);
				}
				break;
			case "%":
				tok = newToken(token.MOD, this.ch);
				break;
			case "&":
				// "&&" (y lógico). Un '&' solo no existe en el lenguaje.
				if (this.peekChar() === "&") {
					tok = this.makeTwoCharToken(token.AND);
				} else {
					tok = newToken(token.ILLEGAL, this.ch);
				}
				break;
			case "|":
				// "||" (o lógico). Un '|' solo no existe en el lenguaje.
				if (this.peekChar() === "|") {
					tok = this.makeTwoCharToken(token.OR);
				} else {
					tok = newToken(token.ILLEGAL, this.ch);
				}
				break;
			case "<":
				// "<=" o "<"
				if (this.peekChar() === "=") {
					tok = this.makeTwoCharToken(token.LTE);
				} else {
					tok = newToken(token.LT, this.ch);
				}
				break;
			case ">":
				// ">=" o ">"
				if (this.peekChar() === "=") {
					tok = this.makeTwoCharToken(token.GTE);
				} else {
					tok = newToken(token.GT, this.ch);
				}
				break;
			// Delimitadores de un solo carácter.
			case ";":
				tok = newToken(token.SEMICOLON, this.ch);
				break;
			case ":":
				tok = newToken(token.COLON, this.ch);
				break;
			case ",":
				tok = newToken(token.COMMA, this.ch);
				break;
			case "(":
				tok = newToken(token.LPAREN, this.ch);
				break;
			case ")":
				tok = newToken(token.RPAREN, this.ch);
				break;
			case "{":
				tok = newToken(token.LBRACE, this.ch);
				break;
			case "}":
				tok = newToken(token.RBRACE, this.ch);
				break;
			case "[":
				tok = newToken(token.LBRACKET, this.ch);
				break;
			case "]":
				tok = newToken(token.RBRACKET, this.ch);
				break;
			case '"': {
				// Cadena de texto. El literal del token es el contenido SIN las
				// comillas: "hola" → {STRING, hola}.
				// readString deja ch sobre la comilla de cierre; el readChar del
				// final de esta función la salta.
				const [str, ok] = this.readString();
				if (ok) {
					tok = { type: token.STRING, literal: str };
				} else {
					// Se llegó al final de la entrada sin cerrar la comilla:
					// se reporta como token ILEGAL para que el parser lo rechace.
					tok = { type: token.ILLEGAL, literal: '"' + str };
				}
				break;
			}
			case "\0":
				// Fin de la entrada.
				tok = { type: token.EOF, literal: "" };
				break;
			default:
				if (isLetter(this.ch)) {
					// Identificador o palabra reservada: se leen todas las letras
					// seguidas y luego se consulta si la palabra es reservada
					// ("let" → LET) o un nombre cualquiera ("x" → IDENT).
					// Se retorna aquí porque readIdentifier ya avanzó el lexer.
					const literal = this.readIdentifier();
					return { type: token.lookupIdent(literal), literal };
				} else if (isDigit(this.ch)) {
					// Número entero: se leen todos los dígitos seguidos.
					// Mismo caso: readNumber ya avanzó, por eso se retorna aquí.
					return { type: token.INT, literal: this.readNumber() };
				} else {
					// Cualquier otro carácter (por ejemplo '@' o '#') es ilegal.
					tok = newToken(token.ILLEGAL, this.ch);
				}
		}

		// Se avanza al carácter siguiente al token que se acaba de reconocer.
		this.readChar();
		return tok;
	}

	// makeTwoCharToken construye un token de dos caracteres (como "==" o "<=")
	// uniendo el carácter actual con el siguiente. Avanza el lexer una vez,
	// dejando ch sobre el SEGUNDO carácter; el readChar del final de nextToken
	// se encarga de pasar al siguiente.
	private makeTwoCharToken(tokenType: token.TokenType): TokenSinPosicion {
		const ch = this.ch; // se guarda el primer carácter antes de avanzar
		this.readChar();    // ahora this.ch es el segundo carácter
		return { type: tokenType, literal: ch + this.ch };
	}

	// readIdentifier lee una secuencia de letras (y '_') y la devuelve.
	// Al terminar, ch es el primer carácter que NO es letra.
	private readIdentifier(): string {
		const position = this.position;
		while (isLetter(this.ch)) {
			this.readChar();
		}
		return this.input.slice(position, this.position);
	}

	// readNumber lee una secuencia de dígitos y la devuelve (como texto; el
	// parser se encarga de convertirla a número). Al terminar, ch es el primer
	// carácter que NO es dígito.
	private readNumber(): string {
		const position = this.position;
		while (isDigit(this.ch)) {
			this.readChar();
		}
		return this.input.slice(position, this.position);
	}

	// readString lee el contenido de una cadena entre comillas dobles.
	//
	//	Al entrar: ch = '"' de apertura
	//	Al salir:  ch = '"' de cierre (o "\0" si no se cerró)
	//
	// Devuelve el texto entre las comillas y true, o lo que alcanzó a leer y
	// false si la entrada terminó antes de encontrar la comilla de cierre.
	private readString(): [string, boolean] {
		const position = this.position + 1; // el contenido empieza después de la comilla
		for (;;) {
			this.readChar();
			if (this.ch === '"') {
				return [this.input.slice(position, this.position), true];
			}
			if (this.ch === "\0") {
				return [this.input.slice(position, this.position), false];
			}
		}
	}

	// skipWhitespace avanza mientras el carácter actual sea un espacio, una
	// tabulación o un salto de línea. En este lenguaje los espacios solo
	// separan tokens; no tienen significado propio.
	//
	// También salta los comentarios: desde "//" hasta el final de la línea.
	// Por eso un comentario nunca llega al parser.
	private skipWhitespace(): void {
		for (;;) {
			if (this.ch === " " || this.ch === "\t" || this.ch === "\n" || this.ch === "\r") {
				this.readChar();
			} else if (this.ch === "/" && this.peekChar() === "/") {
				this.skipComment();
			} else {
				return;
			}
		}
	}

	// skipComment avanza hasta el final de la línea (sin consumir el salto de
	// línea, que lo salta skipWhitespace) o hasta el final de la entrada.
	private skipComment(): void {
		while (this.ch !== "\n" && this.ch !== "\0") {
			this.readChar();
		}
	}

	// peekChar devuelve el SIGUIENTE carácter sin avanzar el lexer ("mirar
	// adelante"). Se usa para distinguir, por ejemplo, '=' de '=='.
	private peekChar(): string {
		if (this.readPosition >= this.input.length) {
			return "\0";
		}
		return this.input[this.readPosition];
	}
}

// newToken crea un token de un solo carácter.
function newToken(tokenType: token.TokenType, ch: string): TokenSinPosicion {
	return { type: tokenType, literal: ch };
}

// isLetter indica si el carácter puede formar parte de un identificador:
// letras ASCII mayúsculas o minúsculas y el guion bajo (mi_variable).
function isLetter(ch: string): boolean {
	return ("a" <= ch && ch <= "z") || ("A" <= ch && ch <= "Z") || ch === "_";
}

// isDigit indica si el carácter es un dígito decimal (0-9).
function isDigit(ch: string): boolean {
	return "0" <= ch && ch <= "9";
}
