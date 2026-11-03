// Módulo token define los TOKENS del lenguaje: las unidades mínimas con
// significado (como las "palabras" de una oración).
//
// Es el vocabulario compartido entre las fases del compilador:
//
//	código fuente ──lexer──▶ tokens ──parser──▶ AST
//
// Por ejemplo, el código  let x = 5;  produce estos tokens:
//
//	{LET let} {IDENT x} {= =} {INT 5} {; ;}

// TokenType es el TIPO de un token (qué clase de palabra es).
// Se usa string para que sea fácil de imprimir y depurar: al mostrar un
// token se ve "IDENT" o "+" en lugar de un número.
export type TokenType = string;

// Token es la unidad mínima que genera el lexer.
// line y column dicen dónde EMPIEZA el token en el código (contando desde
// 1). Así los errores de cualquier etapa pueden decir dónde ocurrieron.
export interface Token {
	type: TokenType; // qué clase de token es (IDENT, INT, PLUS, ...)
	literal: string; // texto exacto que se leyó del código ("x", "5", "+")
	line: number;    // línea donde empieza el token
	column: number;  // columna donde empieza el token
}

// posicion devuelve el texto "línea L, columna C" de un token, para los
// mensajes de error.
export function posicion(tok: Token): string {
	return `línea ${tok.line}, columna ${tok.column}`;
}

// Tokens especiales
export const ILLEGAL = "ILLEGAL"; // carácter que el lexer no reconoce
export const EOF = "EOF";         // fin de la entrada

// Identificadores y literales
export const IDENT = "IDENT";   // add, foobar, x, y, ...
export const INT = "INT";       // 1343456
export const STRING = "STRING"; // "foobar"

// Operadores
export const ASSIGN = "=";
export const PLUS = "+";
export const MINUS = "-";
export const BANG = "!";
export const ASTERISK = "*";
export const SLASH = "/";
export const POW = "**"; // potencia
export const MOD = "%";  // módulo

// Operadores de comparación
export const LT = "<";
export const GT = ">";
export const EQ = "==";
export const NOT_EQ = "!=";
export const LTE = "<=";
export const GTE = ">=";

// Operadores lógicos
export const AND = "&&"; // y
export const OR = "||";  // o

// Delimitadores
export const COMMA = ",";
export const SEMICOLON = ";";
export const COLON = ":"; // separa clave y valor en los hashes {"a": 1}

export const LPAREN = "(";
export const RPAREN = ")";
export const LBRACE = "{";
export const RBRACE = "}";
export const LBRACKET = "[";
export const RBRACKET = "]";

// Palabras reservadas
export const FUNCTION = "FUNCTION";
export const LET = "LET";
export const TRUE = "TRUE";
export const FALSE = "FALSE";
export const IF = "IF";
export const ELSE = "ELSE";
export const RETURN = "RETURN";
export const ELIF = "ELIF";
export const FOR = "FOR";
export const WHILE = "WHILE";
export const BREAK = "BREAK";

// keywords relaciona cada palabra reservada del lenguaje con su tipo de token.
// Las palabras reservadas se escriben igual que un identificador (solo
// letras), por eso el lexer primero lee la palabra completa y luego la busca
// en este mapa para saber si es reservada. Para agregar una palabra
// reservada nueva basta con definir su constante arriba y añadirla aquí.
//
// Cada palabra tiene también una versión en ESPAÑOL que produce el MISMO
// token: "sea x = 5;" y "let x = 5;" son exactamente lo mismo para el
// parser y el evaluador, que nunca ven el texto, solo el tipo de token. Se
// conservan las palabras en inglés para que los programas del curso sigan
// funcionando. (Sin tildes: el lexer solo acepta letras ASCII.)
const keywords = new Map<string, TokenType>([
	["function", FUNCTION], ["funcion", FUNCTION],
	["let", LET],           ["sea", LET],
	["true", TRUE],         ["verdadero", TRUE],
	["false", FALSE],       ["falso", FALSE],
	["for", FOR],           ["para", FOR],
	["while", WHILE],       ["mientras", WHILE],
	["if", IF],             ["si", IF],
	["else", ELSE],         ["sino", ELSE],
	["elif", ELIF],         ["sinosi", ELIF],
	["return", RETURN],     ["retorna", RETURN],
	["break", BREAK],
]);

// lookupIdent revisa si un identificador es una palabra reservada.
// Si lo es devuelve su tipo de token; si no, devuelve IDENT.
//
//	lookupIdent("let")  → LET
//	lookupIdent("edad") → IDENT
export function lookupIdent(ident: string): TokenType {
	return keywords.get(ident) ?? IDENT;
}
