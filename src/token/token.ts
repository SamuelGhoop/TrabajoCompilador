export type TokenType = string;

export interface Token{
	type:    TokenType;
	literal: string;
}

export const ILLEGAL = "ILLEGAL";
export const EOF = "EOF";

	// Identifiers + literals
	export const IDENT = "IDENT" // add, foobar, x, y, ...
	export const INT   = "INT"   // 1343456

	// Operators
	export const ASSIGN   = "="
	export const PLUS     = "+"
	export const MINUS    = "-"
	export const BANG     = "!"
	export const ASTERISK = "*"
	export const SLASH    = "/"

	export const LT = "<"
	export const GT = ">"
	export const LTE = "<="
	export const GTE = ">="

	export const EQ     = "=="
	export const NOT_EQ = "!="
	
	export const POW    = "**"

	// Delimiters
	export const COMMA     = ","
	export const SEMICOLON = ";"

	export const LPAREN = "("
	export const RPAREN = ")"
	export const LBRACE = "{"
	export const RBRACE = "}"
	export const LBRACKET = "["
	export const RBRACKET = "]"

	// Keywords
	export const FUNCTION = "FUNCTION"
	export const LET      = "LET"
	export const TRUE     = "TRUE"
	export const FALSE    = "FALSE"
	export const IF       = "IF"
	export const ELSE     = "ELSE"
	export const ELIF     = "ELIF"
	export const RETURN   = "RETURN"
	export const FOR      = "FOR"
	export const WHILE    = "WHILE"
	export const BREAK    = "BREAK"


const keywords = new Map<string,TokenType>([
	["function", FUNCTION],
	["let",      LET],
	["true",     TRUE],
	["false",    FALSE],
	["if",       IF],
	["else",     ELSE],
	["elif",   ELIF],
	["return",   RETURN],
	["for",    FOR],
	["while",    WHILE],
	["break",    BREAK],
]);

export function lookupIdent(ident: string): TokenType {
    const tok= keywords.get(ident)
	if(tok)  {
		return tok
	}
	return IDENT
}
