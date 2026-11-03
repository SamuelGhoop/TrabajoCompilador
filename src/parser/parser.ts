// Módulo parser implementa el ANALIZADOR SINTÁCTICO del compilador.
//
// ¿Qué hace?
// Recibe la secuencia de tokens que produce el lexer y construye con ellos
// un Árbol de Sintaxis Abstracta (AST). El AST representa la ESTRUCTURA
// del programa: qué operación se aplica sobre qué operandos, qué sentencias
// hay dentro de qué bloques, etc.
//
//	Código:  let x = 1 + 2 * 3;
//	Tokens:  LET IDENT(x) = INT(1) + INT(2) * INT(3) ;
//	AST:     LetStatement x
//	         └── Valor: (+)
//	             ├── 1
//	             └── (*)
//	                 ├── 2
//	                 └── 3
//
// ¿Cómo lo hace? — Parser de Pratt
// Se usa la técnica de Vaughan Pratt ("Top Down Operator Precedence"), que
// es un parser descendente recursivo en el que:
//
//  1. Cada TIPO DE TOKEN tiene asociadas hasta dos funciones de parseo:
//     - una función PREFIJA (PrefixParseFn): se usa cuando el token aparece
//     al INICIO de una expresión. Ej: el '-' en "-5", un número "5",
//     un identificador "x", un '(' en "(a + b)".
//     - una función INFIJA (InfixParseFn): se usa cuando el token aparece
//     ENTRE dos expresiones. Ej: el '+' en "a + b", el '(' en "f(x)".
//
//  2. Cada operador infijo tiene una PRECEDENCIA (qué tan fuerte "atrapa"
//     a sus operandos). La función parseExpression usa esas precedencias
//     para decidir cómo agrupar. Así "1 + 2 * 3" se agrupa como
//     "1 + (2 * 3)" sin necesidad de escribir una regla de gramática por
//     cada nivel de precedencia.
//
// Convención importante: curToken y peekToken
// El parser siempre mira DOS tokens: el actual (curToken) y el siguiente
// (peekToken). En los comentarios de cada función se indica en qué token
// debe estar el parser al ENTRAR y en cuál queda al SALIR. Respetar esa
// convención es la clave para que todas las funciones encajen entre sí.
// Regla general: una función de parseo de expresiones empieza con curToken
// en el primer token de la expresión y termina con curToken en el ÚLTIMO
// token de esa expresión (no en el siguiente).
import * as ast from "../ast/ast";
import { Lexer } from "../lexer/lexer";
import * as token from "../token/token";

// ---------------------------------------------------------------------------
// Precedencias
// ---------------------------------------------------------------------------

// Niveles de precedencia, de MENOR a MAYOR (en Go se numeraban con iota).
//
// Un operador con mayor precedencia se agrupa primero. Por ejemplo, como
// PRODUCT > SUM, en "1 + 2 * 3" la multiplicación se resuelve antes.
// Los lógicos van por debajo de las comparaciones, como en C o Python:
// "a < b && b < c" es "(a < b) && (b < c)", y && ata más que ||.
export const LOWEST = 1;      // precedencia mínima: se usa al empezar a parsear una expresión
export const ASSIGN = 2;      // x = 5          (la más baja de los operadores)
export const LOGIC_OR = 3;    // ||
export const LOGIC_AND = 4;   // &&
export const EQUALS = 5;      // ==  !=
export const LESSGREATER = 6; // >  <  >=  <=
export const SUM = 7;         // +  -
export const PRODUCT = 8;     // *  /  %
export const PREFIX = 9;      // -X  !X         (operadores prefijos)
export const EXPONENT = 10;   // **             (más fuerte que el prefijo: -2**2 = -(2**2))
export const CALL = 11;       // miFuncion(X)
export const INDEX = 12;      // arreglo[indice] (la más alta de todas)

// precedences asocia cada token que puede actuar como OPERADOR INFIJO con
// su nivel de precedencia. Los tokens que no están en este mapa (por
// ejemplo ';', ')', '{') tienen precedencia LOWEST, lo que hace que
// parseExpression se detenga al encontrarlos.
//
// Nótese que '(' y '[' aparecen aquí: cuando van DESPUÉS de una expresión
// se comportan como operadores infijos (llamada "f(x)" e índice "a[0]").
const precedences = new Map<token.TokenType, number>([
	[token.ASSIGN, ASSIGN],
	[token.OR, LOGIC_OR],
	[token.AND, LOGIC_AND],
	[token.EQ, EQUALS],
	[token.NOT_EQ, EQUALS],
	[token.LT, LESSGREATER],
	[token.GT, LESSGREATER],
	[token.LTE, LESSGREATER],
	[token.GTE, LESSGREATER],
	[token.PLUS, SUM],
	[token.MINUS, SUM],
	[token.SLASH, PRODUCT],
	[token.ASTERISK, PRODUCT],
	[token.MOD, PRODUCT],
	[token.POW, EXPONENT],
	[token.LPAREN, CALL],
	[token.LBRACKET, INDEX],
]);

// ---------------------------------------------------------------------------
// Tipos y estructura del parser
// ---------------------------------------------------------------------------

// PrefixParseFn parsea una expresión que EMPIEZA en curToken.
// No recibe nada porque no hay nada a su izquierda.
type PrefixParseFn = () => ast.Expression | null;

// InfixParseFn recibe como argumento la expresión que ya se parseó a la
// IZQUIERDA del operador (curToken) y devuelve la expresión completa
// "izquierda operador derecha".
type InfixParseFn = (left: ast.Expression | null) => ast.Expression | null;

// quote pone un texto entre comillas escapando lo necesario, como el %q de Go.
function quote(s: string): string {
	return JSON.stringify(s);
}

// Parser guarda el estado del análisis sintáctico.
export class Parser {
	private errors: string[] = []; // errores de sintaxis encontrados (no se detiene en el primero)

	private curToken: token.Token = { type: "", literal: "", line: 0, column: 0 };  // token que se está analizando
	private peekToken: token.Token = { type: "", literal: "", line: 0, column: 0 }; // token siguiente; permite "mirar adelante"

	// Tablas que relacionan cada tipo de token con su función de parseo.
	// Son el corazón del parser de Pratt: en lugar de un gran switch,
	// se busca en estas tablas qué hacer con cada token.
	private prefixParseFns = new Map<token.TokenType, PrefixParseFn>();
	private infixParseFns = new Map<token.TokenType, InfixParseFn>();

	// El constructor (lo que en Go hacía New) recibe el lexer del que leerá
	// los tokens y registra qué función de parseo corresponde a cada tipo.
	constructor(private l: Lexer) {
		// --- Funciones PREFIJAS: tokens que pueden INICIAR una expresión ---
		this.registerPrefix(token.IDENT, () => this.parseIdentifier());           // x
		this.registerPrefix(token.INT, () => this.parseIntegerLiteral());         // 5
		this.registerPrefix(token.BANG, () => this.parsePrefixExpression());      // !x
		this.registerPrefix(token.MINUS, () => this.parsePrefixExpression());     // -x
		this.registerPrefix(token.TRUE, () => this.parseBoolean());               // true
		this.registerPrefix(token.FALSE, () => this.parseBoolean());              // false
		this.registerPrefix(token.LPAREN, () => this.parseGroupedExpression());   // (a + b)
		this.registerPrefix(token.IF, () => this.parseIfExpression());            // if (...) {...}
		this.registerPrefix(token.FUNCTION, () => this.parseFunctionLiteral());   // function(a) {...}
		this.registerPrefix(token.STRING, () => this.parseStringLiteral());       // "hola"
		this.registerPrefix(token.LBRACKET, () => this.parseArrayLiteral());      // [1, 2, 3]
		this.registerPrefix(token.LBRACE, () => this.parseHashLiteral());         // {"a": 1}
		this.registerPrefix(token.FOR, () => this.parseForLiteral());             // for (...;...;...) {...}
		this.registerPrefix(token.WHILE, () => this.parseWhileLiteral());         // while (...) {...}

		// --- Funciones INFIJAS: tokens que aparecen ENTRE dos expresiones ---
		const infix: InfixParseFn = (left) => this.parseInfixExpression(left);
		this.registerInfix(token.PLUS, infix);     // a + b
		this.registerInfix(token.MINUS, infix);    // a - b
		this.registerInfix(token.SLASH, infix);    // a / b
		this.registerInfix(token.ASTERISK, infix); // a * b
		this.registerInfix(token.MOD, infix);      // a % b
		this.registerInfix(token.EQ, infix);       // a == b
		this.registerInfix(token.NOT_EQ, infix);   // a != b
		this.registerInfix(token.LT, infix);       // a < b
		this.registerInfix(token.GT, infix);       // a > b
		this.registerInfix(token.LTE, infix);      // a <= b
		this.registerInfix(token.GTE, infix);      // a >= b
		this.registerInfix(token.POW, infix);      // a ** b
		this.registerInfix(token.AND, infix);      // a && b
		this.registerInfix(token.OR, infix);       // a || b
		this.registerInfix(token.ASSIGN, (left) => this.parseAssignExpression(left));  // a = b
		this.registerInfix(token.LPAREN, (left) => this.parseCallExpression(left));    // f(a, b)
		this.registerInfix(token.LBRACKET, (left) => this.parseIndexExpression(left)); // a[i]

		// Se leen dos tokens para que curToken y peekToken queden inicializados.
		// Tras la primera llamada: cur = (vacío), peek = token 1.
		// Tras la segunda:         cur = token 1, peek = token 2.
		this.nextToken();
		this.nextToken();
	}

	// -----------------------------------------------------------------------
	// Utilidades para moverse por los tokens y reportar errores
	// -----------------------------------------------------------------------

	// registerPrefix asocia una función de parseo prefija a un tipo de token.
	private registerPrefix(tokenType: token.TokenType, fn: PrefixParseFn): void {
		this.prefixParseFns.set(tokenType, fn);
	}

	// registerInfix asocia una función de parseo infija a un tipo de token.
	private registerInfix(tokenType: token.TokenType, fn: InfixParseFn): void {
		this.infixParseFns.set(tokenType, fn);
	}

	// getErrors devuelve los errores encontrados al analizar el código:
	// primero los LÉXICOS (que detecta el lexer) y luego los SINTÁCTICOS
	// (que detecta el parser). Quien use el parser (por ejemplo el REPL) debe
	// revisar esta lista después de llamar a parseProgram: si no está vacía,
	// el AST puede estar incompleto y no se debe ejecutar.
	getErrors(): string[] {
		return [...this.l.getErrors(), ...this.errors];
	}

	// syntaxError registra un error de sintaxis indicando dónde ocurrió.
	private syntaxError(tok: token.Token, mensaje: string): void {
		this.errors.push(`Error de sintaxis en ${token.posicion(tok)}: ${mensaje}`);
	}

	// peekError registra un error cuando el siguiente token no es el esperado.
	// Ej: en "let = 5" se esperaba IDENT después de 'let' pero llegó '='.
	private peekError(t: token.TokenType): void {
		this.syntaxError(
			this.peekToken,
			`se esperaba ${t}, pero se encontró ${this.peekToken.type} (${quote(this.peekToken.literal)})`,
		);
	}

	// noPrefixParseFnError registra un error cuando el token actual no puede
	// iniciar una expresión, porque no tiene función prefija registrada.
	// Ej: una expresión que empieza con ')' o con '*'.
	// Un token ILLEGAL no se reporta aquí: el lexer ya lo reportó como error
	// léxico, y repetirlo como error de sintaxis solo confundiría.
	private noPrefixParseFnError(t: token.TokenType): void {
		if (t === token.ILLEGAL) {
			return;
		}
		this.syntaxError(
			this.curToken,
			`no se puede iniciar una expresión con ${t} (${quote(this.curToken.literal)})`,
		);
	}

	// nextToken avanza una posición: el siguiente pasa a ser el actual y se
	// le pide un token nuevo al lexer.
	private nextToken(): void {
		this.curToken = this.peekToken;
		this.peekToken = this.l.nextToken();
	}

	// curTokenIs indica si el token ACTUAL es del tipo dado.
	private curTokenIs(t: token.TokenType): boolean {
		return this.curToken.type === t;
	}

	// peekTokenIs indica si el SIGUIENTE token es del tipo dado (sin avanzar).
	private peekTokenIs(t: token.TokenType): boolean {
		return this.peekToken.type === t;
	}

	// expectPeek es la forma de "exigir" un token según la gramática.
	//   - Si el siguiente token es del tipo esperado, avanza (queda como
	//     curToken) y devuelve true.
	//   - Si no, NO avanza, registra un error y devuelve false; la función que
	//     la llamó normalmente abandona y devuelve null.
	//
	// Ej: después de 'let' se llama expectPeek(IDENT) para exigir un nombre.
	private expectPeek(t: token.TokenType): boolean {
		if (this.peekTokenIs(t)) {
			this.nextToken();
			return true;
		}
		this.peekError(t);
		return false;
	}

	// peekPrecedence devuelve la precedencia del SIGUIENTE token
	// (LOWEST si no es un operador).
	private peekPrecedence(): number {
		return precedences.get(this.peekToken.type) ?? LOWEST;
	}

	// curPrecedence devuelve la precedencia del token ACTUAL
	// (LOWEST si no es un operador).
	private curPrecedence(): number {
		return precedences.get(this.curToken.type) ?? LOWEST;
	}

	// -----------------------------------------------------------------------
	// Programa y sentencias
	// -----------------------------------------------------------------------

	// parseProgram es el PUNTO DE ENTRADA del parser. Parsea sentencias una
	// tras otra hasta llegar al fin de la entrada (EOF) y devuelve la raíz del
	// AST (ast.Program), que contiene la lista de sentencias.
	//
	// Cada parseStatement termina con curToken en el ÚLTIMO token de la
	// sentencia (por ejemplo el ';'), por eso después se llama a nextToken
	// para pasar al primer token de la siguiente sentencia.
	parseProgram(): ast.Program {
		const program = new ast.Program();

		while (!this.curTokenIs(token.EOF)) {
			const stmt = this.parseStatement();
			if (stmt !== null) {
				program.statements.push(stmt);
			}
			this.nextToken();
		}

		return program;
	}

	// parseStatement decide QUÉ TIPO de sentencia parsear mirando el token
	// actual:
	//   - 'let'    → sentencia de declaración  (let x = 5;)
	//   - 'return' → sentencia de retorno      (return x;)
	//   - ';'      → sentencia vacía, se ignora
	//   - otro     → una expresión usada como sentencia (x + 1; f(2); if ...)
	private parseStatement(): ast.Statement | null {
		switch (this.curToken.type) {
			case token.LET:
				return this.parseLetStatement();
			case token.RETURN:
				return this.parseReturnStatement();
			case token.SEMICOLON:
				// Sentencia vacía (por ejemplo ";;"): se ignora.
				return null;
			default:
				return this.parseExpressionStatement();
		}
	}

	// parseLetStatement parsea:   let <identificador> = <expresión> ;
	//
	//	Al entrar: curToken = 'let'
	//	Al salir:  curToken = ';' (si lo hay) o el último token de la expresión
	//
	// Devuelve null si falta el nombre o el '='.
	private parseLetStatement(): ast.LetStatement | null {
		const letToken = this.curToken;

		// Después de 'let' debe venir un nombre: let x
		if (!this.expectPeek(token.IDENT)) {
			return null;
		}

		const stmt = new ast.LetStatement(
			letToken,
			new ast.Identifier(this.curToken, this.curToken.literal),
		);

		// Después del nombre debe venir '=': let x =
		if (!this.expectPeek(token.ASSIGN)) {
			return null;
		}

		this.nextToken(); // se salta el '=' → curToken = primer token del valor

		// El valor es cualquier expresión. Se usa LOWEST porque no hay ningún
		// operador a la izquierda que compita por los operandos.
		stmt.value = this.parseExpression(LOWEST);

		// El punto y coma es opcional: si está, se consume.
		if (this.peekTokenIs(token.SEMICOLON)) {
			this.nextToken();
		}

		return stmt;
	}

	// parseReturnStatement parsea:   return <expresión> ;
	//
	//	Al entrar: curToken = 'return'
	//	Al salir:  curToken = ';' (si lo hay) o el último token de la expresión
	private parseReturnStatement(): ast.ReturnStatement {
		const stmt = new ast.ReturnStatement(this.curToken);

		this.nextToken(); // se salta el 'return' → curToken = inicio del valor

		stmt.returnValue = this.parseExpression(LOWEST);

		// Punto y coma opcional.
		if (this.peekTokenIs(token.SEMICOLON)) {
			this.nextToken();
		}

		return stmt;
	}

	// parseExpressionStatement parsea una expresión que se usa sola como
	// sentencia, por ejemplo "x + 10;", "suma(1, 2);" o un "if".
	//
	//	Al entrar: curToken = primer token de la expresión
	//	Al salir:  curToken = ';' (si lo hay) o el último token de la expresión
	private parseExpressionStatement(): ast.ExpressionStatement {
		const stmt = new ast.ExpressionStatement(this.curToken);

		stmt.expression = this.parseExpression(LOWEST);

		// Punto y coma opcional (así en el REPL se puede escribir "5 + 5").
		if (this.peekTokenIs(token.SEMICOLON)) {
			this.nextToken();
		}

		return stmt;
	}

	// parseBlockStatement parsea las sentencias que hay entre '{' y '}'.
	// Se usa para los cuerpos de if, while, for y funciones.
	//
	//	Al entrar: curToken = '{'
	//	Al salir:  curToken = '}'
	//
	// Si se llega a EOF sin encontrar '}', se registra un error.
	private parseBlockStatement(): ast.BlockStatement {
		const block = new ast.BlockStatement(this.curToken);

		this.nextToken(); // se salta el '{'

		// Mismo esquema que parseProgram, pero se detiene en '}'.
		while (!this.curTokenIs(token.RBRACE) && !this.curTokenIs(token.EOF)) {
			const stmt = this.parseStatement();
			if (stmt !== null) {
				block.statements.push(stmt);
			}
			this.nextToken();
		}

		if (!this.curTokenIs(token.RBRACE)) {
			this.syntaxError(block.token, "bloque sin cerrar: falta '}' para la '{' de esta posición");
		}

		return block;
	}

	// -----------------------------------------------------------------------
	// Núcleo del algoritmo de Pratt
	// -----------------------------------------------------------------------

	// parseExpression es la función central del parser. Parsea una expresión
	// completa respetando la precedencia de los operadores.
	//
	// El parámetro 'precedence' es la precedencia del operador que está a la
	// IZQUIERDA de esta expresión (o LOWEST si no hay ninguno). La idea es:
	// "sigue agregando operadores a la derecha mientras aten con MÁS fuerza que
	// el operador de la izquierda".
	//
	// Pasos:
	//  1. Se busca la función PREFIJA del token actual y se usa para parsear el
	//     lado izquierdo (un número, un identificador, un '-x', un '(...)', ...).
	//  2. Mientras el siguiente token sea un operador con precedencia MAYOR que
	//     'precedence', se avanza hasta él y se llama a su función INFIJA,
	//     pasándole lo parseado hasta ahora como lado izquierdo. El resultado
	//     pasa a ser el nuevo lado izquierdo.
	//  3. Cuando el siguiente token tiene precedencia menor o igual (o es ';',
	//     ')', '}', EOF...), se termina y se devuelve lo construido.
	//
	// Ejemplo: 1 + 2 * 3   (llamada con LOWEST)
	//
	//	prefijo de '1'            → izquierda = 1
	//	peek '+' (SUM > LOWEST)   → infijo '+': parsea su derecha con SUM
	//	    prefijo de '2'        → izquierda = 2
	//	    peek '*' (PRODUCT > SUM) → infijo '*': derecha = 3 → (2 * 3)
	//	    peek EOF              → se detiene, devuelve (2 * 3)
	//	izquierda = (1 + (2 * 3))
	//	peek EOF                  → se detiene
	//
	//	Al entrar: curToken = primer token de la expresión
	//	Al salir:  curToken = último token de la expresión
	private parseExpression(precedence: number): ast.Expression | null {
		// Paso 1: lado izquierdo con la función prefija.
		const prefix = this.prefixParseFns.get(this.curToken.type);
		if (prefix === undefined) {
			this.noPrefixParseFnError(this.curToken.type);
			return null;
		}
		let leftExp = prefix();

		// Paso 2: mientras el siguiente operador ate más fuerte, se absorbe.
		while (!this.peekTokenIs(token.SEMICOLON) && precedence < this.peekPrecedence()) {
			const infix = this.infixParseFns.get(this.peekToken.type);
			if (infix === undefined) {
				return leftExp;
			}

			this.nextToken(); // curToken = el operador

			leftExp = infix(leftExp);
		}

		// Paso 3: no hay más operadores que absorber.
		return leftExp;
	}

	// -----------------------------------------------------------------------
	// Funciones de parseo PREFIJAS
	// (curToken = primer token de la expresión al entrar)
	// -----------------------------------------------------------------------

	// parseIdentifier parsea un identificador:   x
	// Es un solo token, así que no avanza.
	private parseIdentifier(): ast.Expression {
		return new ast.Identifier(this.curToken, this.curToken.literal);
	}

	// parseIntegerLiteral parsea un número entero:   42
	// El lexer entrega el número como texto ("42"); aquí se convierte a bigint.
	// Si no cabe en 64 bits con signo (como el int64 de Go, por ejemplo
	// 99999999999999999999) se reporta error.
	private parseIntegerLiteral(): ast.Expression | null {
		const value = BigInt(this.curToken.literal);
		if (value !== BigInt.asIntN(64, value)) {
			this.syntaxError(this.curToken, `no se pudo convertir ${quote(this.curToken.literal)} a entero: no cabe en 64 bits`);
			return null;
		}
		return new ast.IntegerLiteral(this.curToken, value);
	}

	// parseStringLiteral parsea una cadena:   "hola"
	// El lexer ya quitó las comillas, el literal del token es solo el contenido.
	private parseStringLiteral(): ast.Expression {
		return new ast.StringLiteral(this.curToken, this.curToken.literal);
	}

	// parseBoolean parsea true o false. El valor es true solo si el token es TRUE.
	private parseBoolean(): ast.Expression {
		return new ast.BooleanLiteral(this.curToken, this.curTokenIs(token.TRUE));
	}

	// parsePrefixExpression parsea un operador prefijo:   -x   !x
	//
	//	Al entrar: curToken = '-' o '!'
	//	Al salir:  curToken = último token del operando
	private parsePrefixExpression(): ast.Expression {
		const expression = new ast.PrefixExpression(this.curToken, this.curToken.literal);

		this.nextToken(); // se salta el operador → curToken = inicio del operando

		// El operando se parsea con precedencia PREFIX. Como PREFIX es mayor que
		// PRODUCT y SUM, en "-a * b" el '-' solo toma la 'a': ((-a) * b).
		// En cambio EXPONENT > PREFIX, así que "-2 ** 2" es (-(2 ** 2)).
		expression.right = this.parseExpression(PREFIX);

		return expression;
	}

	// parseGroupedExpression parsea una expresión entre paréntesis:   (a + b)
	//
	//	Al entrar: curToken = '('
	//	Al salir:  curToken = ')'
	//
	// Los paréntesis NO generan un nodo propio en el AST: su único efecto es
	// que el contenido se parsea desde LOWEST, "reiniciando" la precedencia.
	// Así "(1 + 2) * 3" queda ((1 + 2) * 3).
	private parseGroupedExpression(): ast.Expression | null {
		this.nextToken(); // se salta el '('

		const exp = this.parseExpression(LOWEST);

		// Debe cerrarse con ')'.
		if (!this.expectPeek(token.RPAREN)) {
			return null;
		}

		return exp;
	}

	// parseCondition parsea la condición de if / elif / while.
	// Se acepta con o sin paréntesis: "if (x > 1) {" o "if x > 1 {".
	// (Si hay paréntesis, los maneja parseGroupedExpression como a cualquier
	// expresión agrupada.)
	//
	//	Al entrar: curToken = 'if', 'elif' o 'while'
	//	Al salir:  curToken = '{' que abre el bloque
	//
	// Devuelve null si después de la condición no viene '{'.
	private parseCondition(): ast.Expression | null {
		this.nextToken(); // se salta la palabra reservada
		const condition = this.parseExpression(LOWEST);

		if (!this.expectPeek(token.LBRACE)) {
			return null;
		}
		return condition;
	}

	// parseIfExpression parsea un condicional en cualquiera de sus formas:
	//
	//	if (<cond>) { ... }
	//	if (<cond>) { ... } else { ... }
	//	if (<cond>) { ... } elif (<cond>) { ... } else { ... }
	//
	//	Al entrar: curToken = 'if' (o 'elif', en la llamada recursiva)
	//	Al salir:  curToken = '}' del último bloque
	//
	// Cómo se representa el elif: no hay un nodo especial. Un elif es
	// equivalente a un else que contiene otro if, es decir:
	//
	//	if (a) { 1 } elif (b) { 2 } else { 3 }
	//	    es lo mismo que
	//	if (a) { 1 } else { if (b) { 2 } else { 3 } }
	//
	// Por eso, al encontrar 'elif', se llama recursivamente a esta misma
	// función (que parsea "elif (b) { 2 } else { 3 }" como un if completo) y
	// el resultado se mete dentro de un bloque que se usa como alternative.
	// La recursión permite encadenar cualquier número de elif.
	private parseIfExpression(): ast.Expression | null {
		const expression = new ast.IfExpression(this.curToken);

		// Condición: deja curToken en '{'.
		expression.condition = this.parseCondition();
		if (expression.condition === null) {
			return null;
		}

		// Bloque "entonces": deja curToken en '}'.
		expression.consequence = this.parseBlockStatement();

		if (this.peekTokenIs(token.ELIF)) {
			this.nextToken(); // curToken = 'elif'
			const elifTok = this.curToken;

			// Llamada recursiva: el elif se parsea igual que un if.
			const nested = this.parseIfExpression();
			if (nested === null) {
				return null;
			}

			// Se envuelve el if anidado en un bloque para usarlo como "sino".
			expression.alternative = new ast.BlockStatement(elifTok, [
				new ast.ExpressionStatement(elifTok, nested),
			]);
		} else if (this.peekTokenIs(token.ELSE)) {
			this.nextToken(); // curToken = 'else'

			// Después de 'else' debe venir '{'.
			if (!this.expectPeek(token.LBRACE)) {
				return null;
			}

			expression.alternative = this.parseBlockStatement();
		}
		// Si no hay elif ni else, alternative queda en null.

		return expression;
	}

	// parseWhileLiteral parsea un ciclo:   while (<cond>) { ... }
	//
	//	Al entrar: curToken = 'while'
	//	Al salir:  curToken = '}' del cuerpo
	private parseWhileLiteral(): ast.Expression | null {
		const expression = new ast.WhileExpression(this.curToken);

		// Condición: deja curToken en '{'.
		expression.condition = this.parseCondition();
		if (expression.condition === null) {
			return null;
		}

		// Cuerpo: deja curToken en '}'.
		expression.body = this.parseBlockStatement();

		return expression;
	}

	// parseForLiteral parsea un ciclo for al estilo C:
	//
	//	for (<inicio>; <condición>; <actualización>) { ... }
	//	ej: for (let i = 0; i < 10; i = i + 1) { ... }
	//
	//   - <inicio> es una SENTENCIA (normalmente un let); se ejecuta una vez.
	//   - <condición> es una EXPRESIÓN; el ciclo sigue mientras sea verdadera.
	//   - <actualización> es una EXPRESIÓN; se ejecuta al final de cada vuelta.
	//
	// Cualquiera de las tres partes puede omitirse, por ejemplo "for (;;) {}"
	// (en ese caso el campo correspondiente del nodo queda en null).
	//
	//	Al entrar: curToken = 'for'
	//	Al salir:  curToken = '}' del cuerpo
	private parseForLiteral(): ast.Expression | null {
		const expression = new ast.ForExpression(this.curToken);

		// for (
		if (!this.expectPeek(token.LPAREN)) {
			return null;
		}
		this.nextToken(); // se salta el '(' → curToken = inicio de <inicio> o ';'

		// 1. <inicio>. Si curToken ya es ';', se omitió.
		//    parseStatement consume el ';' final si existe, así que al volver
		//    curToken debe ser ';'. Si no lo es, falta el separador.
		if (!this.curTokenIs(token.SEMICOLON)) {
			expression.init = this.parseStatement();
			if (expression.init === null) {
				return null;
			}
			if (!this.curTokenIs(token.SEMICOLON)) {
				this.peekError(token.SEMICOLON);
				return null;
			}
		}
		this.nextToken(); // se salta el primer ';' → curToken = inicio de <condición> o ';'

		// 2. <condición>. Si curToken ya es ';', se omitió.
		//    Aquí se usa parseExpression (no parseStatement), que NO consume el
		//    ';', por eso se exige con expectPeek.
		if (!this.curTokenIs(token.SEMICOLON)) {
			expression.condition = this.parseExpression(LOWEST);
			if (!this.expectPeek(token.SEMICOLON)) {
				return null;
			}
		}
		this.nextToken(); // se salta el segundo ';' → curToken = inicio de <actualización> o ')'

		// 3. <actualización>. Si curToken ya es ')', se omitió.
		if (!this.curTokenIs(token.RPAREN)) {
			expression.update = this.parseExpression(LOWEST);
			if (!this.expectPeek(token.RPAREN)) {
				return null;
			}
		}
		// Aquí curToken = ')'.

		// 4. Cuerpo: debe empezar con '{'.
		if (!this.expectPeek(token.LBRACE)) {
			return null;
		}
		expression.body = this.parseBlockStatement();

		return expression;
	}

	// parseFunctionLiteral parsea una función:   function(<parámetros>) { ... }
	//
	//	Al entrar: curToken = 'function'
	//	Al salir:  curToken = '}' del cuerpo
	//
	// Las funciones son expresiones (valores), por eso pueden asignarse:
	// let suma = function(a, b) { return a + b; };
	private parseFunctionLiteral(): ast.Expression | null {
		const lit = new ast.FunctionLiteral(this.curToken);

		// function(
		if (!this.expectPeek(token.LPAREN)) {
			return null;
		}

		// a, b)  → deja curToken en ')'
		const parameters = this.parseFunctionParameters();
		if (parameters === null) {
			return null;
		}
		lit.parameters = parameters;

		// { ... }
		if (!this.expectPeek(token.LBRACE)) {
			return null;
		}

		lit.body = this.parseBlockStatement();

		return lit;
	}

	// parseFunctionParameters parsea la lista de parámetros:   (x, y, z)
	// Los parámetros solo pueden ser identificadores.
	//
	//	Al entrar: curToken = '('
	//	Al salir:  curToken = ')'
	//
	// Devuelve una lista vacía si la función no tiene parámetros, y null si
	// hay un error de sintaxis; así quien llama puede distinguir ambos.
	private parseFunctionParameters(): ast.Identifier[] | null {
		const identifiers: ast.Identifier[] = [];

		// Caso especial: función sin parámetros "()".
		if (this.peekTokenIs(token.RPAREN)) {
			this.nextToken();
			return identifiers;
		}

		// Primer parámetro.
		if (!this.expectPeek(token.IDENT)) {
			return null;
		}
		identifiers.push(new ast.Identifier(this.curToken, this.curToken.literal));

		// Mientras haya comas, viene otro parámetro.
		while (this.peekTokenIs(token.COMMA)) {
			this.nextToken(); // curToken = ','
			if (!this.expectPeek(token.IDENT)) {
				return null;
			}
			identifiers.push(new ast.Identifier(this.curToken, this.curToken.literal));
		}

		// La lista se cierra con ')'.
		if (!this.expectPeek(token.RPAREN)) {
			return null;
		}

		return identifiers;
	}

	// parseArrayLiteral parsea un arreglo:   [1, 2 + 3, "a"]
	//
	//	Al entrar: curToken = '['
	//	Al salir:  curToken = ']'
	private parseArrayLiteral(): ast.Expression | null {
		const arrayToken = this.curToken;

		// Los elementos son expresiones separadas por comas, hasta ']'.
		const elements = this.parseExpressionList(token.RBRACKET);
		if (elements === null) {
			return null;
		}

		return new ast.ArrayLiteral(arrayToken, elements);
	}

	// parseHashLiteral parsea un hash (diccionario):   {"clave": valor, x: 2}
	// Tanto las claves como los valores pueden ser cualquier expresión.
	//
	//	Al entrar: curToken = '{'
	//	Al salir:  curToken = '}'
	//
	// Nota: como '{' al inicio de una expresión se interpreta como hash, un
	// bloque suelto "{ ... }" fuera de if/while/for/function se trata como hash.
	private parseHashLiteral(): ast.Expression | null {
		const hash = new ast.HashLiteral(this.curToken);

		// Se repite mientras no se llegue a la '}' de cierre.
		// (Si el hash es vacío "{}", el ciclo no se ejecuta ni una vez.)
		while (!this.peekTokenIs(token.RBRACE)) {
			// Clave
			this.nextToken(); // curToken = inicio de la clave
			const key = this.parseExpression(LOWEST);

			// Separador ':'
			if (!this.expectPeek(token.COLON)) {
				return null;
			}

			// Valor
			this.nextToken(); // se salta el ':' → curToken = inicio del valor
			const value = this.parseExpression(LOWEST);

			hash.pairs.push({ key, value });

			// Después de cada pareja debe venir ',' (hay más parejas) o
			// '}' (fin del hash). Si viene ',' expectPeek la consume.
			if (!this.peekTokenIs(token.RBRACE) && !this.expectPeek(token.COMMA)) {
				return null;
			}
		}

		// Se consume la '}' de cierre.
		if (!this.expectPeek(token.RBRACE)) {
			return null;
		}

		return hash;
	}

	// -----------------------------------------------------------------------
	// Funciones de parseo INFIJAS
	// (reciben el lado izquierdo ya parseado; curToken = el operador al entrar)
	// -----------------------------------------------------------------------

	// parseInfixExpression parsea un operador binario:
	//
	//	a + b   a - b   a * b   a / b   a % b   a ** b
	//	a == b  a != b  a < b   a > b   a <= b  a >= b
	//
	//	Al entrar: curToken = el operador; 'left' = lo que estaba a la izquierda
	//	Al salir:  curToken = último token del lado derecho
	private parseInfixExpression(left: ast.Expression | null): ast.Expression {
		const expression = new ast.InfixExpression(this.curToken, left, this.curToken.literal);

		// El lado derecho se parsea con la precedencia de ESTE operador. Así,
		// en "1 + 2 + 3", el primer '+' al parsear su derecha ve otro '+' con
		// la MISMA precedencia, no lo absorbe (no es mayor), y el resultado es
		// ((1 + 2) + 3): asociatividad por la IZQUIERDA, que es lo normal.
		let precedence = this.curPrecedence();

		// La potencia es la excepción: es asociativa por la DERECHA, como en
		// matemáticas: 2 ** 3 ** 2 = 2 ** (3 ** 2) = 2 ** 9.
		// Para lograrlo se baja un nivel la precedencia al parsear la derecha;
		// así el siguiente '**' sí es "mayor" y se agrupa primero a la derecha.
		if (this.curTokenIs(token.POW)) {
			precedence--;
		}

		this.nextToken(); // se salta el operador → curToken = inicio del lado derecho
		expression.right = this.parseExpression(precedence);

		return expression;
	}

	// parseAssignExpression parsea una asignación:   x = 5   arr[0] = 1
	//
	//	Al entrar: curToken = '='; 'left' = el destino
	//	Al salir:  curToken = último token del valor
	//
	// Se implementa como operador infijo con la precedencia más baja (ASSIGN),
	// así todo lo que está a la derecha se evalúa antes: x = 1 + 2 es
	// x = (1 + 2).
	//
	// Es asociativa por la DERECHA: a = b = 3 es a = (b = 3). Se logra
	// parseando el valor con ASSIGN - 1 (el mismo truco que con '**').
	private parseAssignExpression(left: ast.Expression | null): ast.Expression | null {
		// Solo tiene sentido asignar a una variable (x) o a una posición de un
		// arreglo/hash (a[0]). Asignar a "5" o a "a + b" es un error.
		if (!(left instanceof ast.Identifier || left instanceof ast.IndexExpression)) {
			this.syntaxError(this.curToken, `no se puede asignar a ${left === null ? "<vacío>" : left.toString()}: solo se puede asignar a una variable o a una posición (x = ..., a[i] = ...)`);
			return null;
		}

		const expression = new ast.AssignExpression(this.curToken, left);

		this.nextToken(); // se salta el '=' → curToken = inicio del valor
		expression.value = this.parseExpression(ASSIGN - 1);

		return expression;
	}

	// parseCallExpression parsea una llamada a función:   suma(1, 2)
	// El '(' actúa como operador infijo: a su izquierda está la función que se
	// llama (un identificador como "suma" o incluso un literal de función).
	//
	//	Al entrar: curToken = '('; 'func' = lo que estaba a la izquierda
	//	Al salir:  curToken = ')'
	private parseCallExpression(func: ast.Expression | null): ast.Expression | null {
		const callToken = this.curToken;

		// Argumentos: expresiones separadas por comas hasta ')'.
		const args = this.parseExpressionList(token.RPAREN);
		if (args === null) {
			return null;
		}

		return new ast.CallExpression(callToken, func, args);
	}

	// parseIndexExpression parsea un acceso por índice:   arr[0]   h["a"]
	// El '[' actúa como operador infijo con la precedencia más alta (INDEX),
	// así en "a * b[0]" el índice se aplica solo a b: (a * (b[0])).
	//
	//	Al entrar: curToken = '['; 'left' = el arreglo/hash
	//	Al salir:  curToken = ']'
	private parseIndexExpression(left: ast.Expression | null): ast.Expression | null {
		const exp = new ast.IndexExpression(this.curToken, left);

		this.nextToken(); // se salta el '[' → curToken = inicio del índice
		exp.index = this.parseExpression(LOWEST);

		if (!this.expectPeek(token.RBRACKET)) {
			return null;
		}

		return exp;
	}

	// parseExpressionList parsea expresiones separadas por comas hasta
	// encontrar el token 'end'. Se reutiliza para:
	//
	//   - argumentos de una llamada:   f(1, 2, 3)   → end = ')'
	//   - elementos de un arreglo:     [1, 2, 3]    → end = ']'
	//
	//	Al entrar: curToken = el delimitador de apertura ('(' o '[')
	//	Al salir:  curToken = 'end'
	//
	// Devuelve una lista vacía si no hay elementos, y null si hay un error.
	private parseExpressionList(end: token.TokenType): (ast.Expression | null)[] | null {
		const list: (ast.Expression | null)[] = [];

		// Caso especial: lista vacía "()" o "[]".
		if (this.peekTokenIs(end)) {
			this.nextToken();
			return list;
		}

		// Primer elemento.
		this.nextToken(); // curToken = inicio del primer elemento
		list.push(this.parseExpression(LOWEST));

		// Mientras haya comas, viene otro elemento.
		while (this.peekTokenIs(token.COMMA)) {
			this.nextToken(); // curToken = ','
			this.nextToken(); // curToken = inicio de la siguiente expresión
			list.push(this.parseExpression(LOWEST));
		}

		// La lista debe cerrarse con 'end'.
		if (!this.expectPeek(end)) {
			return null;
		}

		return list;
	}
}
