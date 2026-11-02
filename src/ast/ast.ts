// Módulo ast define los nodos del ÁRBOL DE SINTAXIS ABSTRACTA (AST).
//
// ¿Qué es el AST?
// Es la estructura de datos que construye el parser para representar el
// programa. Cada nodo es una construcción del lenguaje (una sentencia let,
// una suma, un if...) y sus hijos son las partes que la componen.
//
//	Código:  let x = 1 + 2;
//
//	Program
//	└── LetStatement            (name = x)
//	    └── InfixExpression     (operator = "+")
//	        ├── IntegerLiteral  1
//	        └── IntegerLiteral  2
//
// Se llama "abstracto" porque NO guarda todos los detalles del texto: los
// paréntesis, los punto y coma y los espacios desaparecen, y solo queda la
// estructura. Por ejemplo "(1 + 2)" y "1 + 2" producen el mismo árbol.
//
// Sentencias vs. expresiones
// Los nodos se dividen en dos familias:
//   - Statement (sentencia): una instrucción que NO produce un valor,
//     por ejemplo "let x = 5;" o "return x;".
//   - Expression (expresión): algo que SÍ produce un valor, por ejemplo
//     "5", "x", "a + b", "suma(1, 2)". En este lenguaje también son
//     expresiones el if, while, for y las funciones.
//
// Cada familia es una interfaz con un método "marcador" (statementNode /
// expressionNode) que no hace nada: solo sirve para que TypeScript impida,
// por ejemplo, poner una sentencia donde se espera una expresión.
//
// Cuando hay un error de sintaxis, el parser puede dejar hijos en null (en
// Go eran nil). Por eso los campos opcionales se declaran "| null".
import type { Token } from "../token/token";

// Node es la interfaz que implementan TODOS los nodos del árbol.
export interface Node {
	// tokenLiteral devuelve el literal del token con el que empieza el
	// nodo (por ejemplo "let" para un LetStatement). Útil para depurar.
	tokenLiteral(): string;
	// toString devuelve el nodo convertido de nuevo a código. Los operadores
	// se imprimen entre paréntesis para que se vea cómo se agruparon:
	// "1 + 2 * 3" → "(1 + (2 * 3))". Se usa para depurar y en las pruebas.
	toString(): string;
}

// Statement es un nodo que representa una sentencia (no produce valor).
export interface Statement extends Node {
	statementNode(): void;
}

// Expression es un nodo que representa una expresión (produce un valor).
export interface Expression extends Node {
	expressionNode(): void;
}

// str convierte un nodo que puede faltar (null) en texto.
function str(node: Node | null): string {
	return node === null ? "" : node.toString();
}

// ---------------------------------------------------------------------------
// Programa
// ---------------------------------------------------------------------------

// Program es la RAÍZ del AST. Un programa es simplemente una lista de
// sentencias que se ejecutan en orden. El parser siempre devuelve un
// Program (aunque esté vacío).
export class Program implements Node {
	statements: Statement[] = [];

	// tokenLiteral devuelve el literal del primer token del programa, o ""
	// si el programa está vacío.
	tokenLiteral(): string {
		if (this.statements.length > 0) {
			return this.statements[0].tokenLiteral();
		}
		return "";
	}

	// toString concatena la representación de todas las sentencias.
	toString(): string {
		return this.statements.map((s) => s.toString()).join("");
	}
}

// ---------------------------------------------------------------------------
// Sentencias
// ---------------------------------------------------------------------------

// LetStatement representa la declaración de una variable:
//
//	let <name> = <value>;
//	ej: let edad = 20;
export class LetStatement implements Statement {
	constructor(
		public token: Token,                 // el token LET
		public name: Identifier,             // nombre de la variable (edad)
		public value: Expression | null = null, // expresión cuyo valor se guarda (20)
	) {}

	statementNode(): void {}
	tokenLiteral(): string {
		return this.token.literal;
	}
	toString(): string {
		// value puede ser null si hubo un error de sintaxis.
		return `${this.tokenLiteral()} ${this.name} = ${str(this.value)};`;
	}
}

// ReturnStatement representa el retorno de un valor desde una función:
//
//	return <returnValue>;
//	ej: return a + b;
export class ReturnStatement implements Statement {
	constructor(
		public token: Token,                          // el token 'return'
		public returnValue: Expression | null = null, // valor que se devuelve (a + b)
	) {}

	statementNode(): void {}
	tokenLiteral(): string {
		return this.token.literal;
	}
	toString(): string {
		return `${this.tokenLiteral()} ${str(this.returnValue)};`;
	}
}

// ExpressionStatement "envuelve" una expresión para poder usarla como
// sentencia. Es necesario porque un programa es una lista de SENTENCIAS,
// pero es válido escribir una expresión suelta en una línea:
//
//	x + 10;
//	suma(1, 2);
//	if (x > 1) { ... }
export class ExpressionStatement implements Statement {
	constructor(
		public token: Token,                         // el primer token de la expresión
		public expression: Expression | null = null, // la expresión envuelta
	) {}

	statementNode(): void {}
	tokenLiteral(): string {
		return this.token.literal;
	}
	toString(): string {
		return str(this.expression);
	}
}

// BlockStatement es una lista de sentencias entre llaves. Se usa como
// cuerpo de if, while, for y funciones:
//
//	{ let y = x * 2; return y; }
export class BlockStatement implements Statement {
	constructor(
		public token: Token,                // el token '{'
		public statements: Statement[] = [], // sentencias dentro del bloque, en orden
	) {}

	statementNode(): void {}
	tokenLiteral(): string {
		return this.token.literal;
	}
	toString(): string {
		return "{ " + this.statements.map((s) => s.toString() + " ").join("") + "}";
	}
}

// ---------------------------------------------------------------------------
// Expresiones simples (literales e identificadores)
// Son las "hojas" del árbol: no tienen hijos.
// ---------------------------------------------------------------------------

// Identifier es el nombre de una variable o función:   x   suma
// Es una expresión porque al usarlo produce un valor (el de la variable).
export class Identifier implements Expression {
	constructor(
		public token: Token, // el token IDENT
		public value: string, // el nombre ("x")
	) {}

	expressionNode(): void {}
	tokenLiteral(): string {
		return this.token.literal;
	}
	toString(): string {
		return this.value;
	}
}

// IntegerLiteral es un número entero escrito en el código:   42
// El valor es un bigint para conservar los enteros de 64 bits de Go (int64):
// un number de JavaScript pierde precisión pasados 2^53.
export class IntegerLiteral implements Expression {
	constructor(
		public token: Token,  // el token INT (literal = "42", como texto)
		public value: bigint, // el valor ya convertido a número (42n)
	) {}

	expressionNode(): void {}
	tokenLiteral(): string {
		return this.token.literal;
	}
	toString(): string {
		return this.token.literal;
	}
}

// BooleanLiteral es un valor lógico:   true   false
// (En Go se llamaba Boolean; aquí se renombra para no tapar el Boolean
// global de JavaScript.)
export class BooleanLiteral implements Expression {
	constructor(
		public token: Token, // el token TRUE o FALSE
		public value: boolean,
	) {}

	expressionNode(): void {}
	tokenLiteral(): string {
		return this.token.literal;
	}
	toString(): string {
		return this.token.literal;
	}
}

// StringLiteral es una cadena de texto:   "hola"
export class StringLiteral implements Expression {
	constructor(
		public token: Token,  // el token STRING
		public value: string, // el contenido sin comillas (hola)
	) {}

	expressionNode(): void {}
	tokenLiteral(): string {
		return this.token.literal;
	}
	// toString vuelve a poner las comillas para que se vea que es una cadena.
	toString(): string {
		return `"${this.value}"`;
	}
}

// ---------------------------------------------------------------------------
// Operadores
// ---------------------------------------------------------------------------

// PrefixExpression es un operador que va ANTES de su operando:
//
//	<operator><right>
//	ej: -5   !true   -x
export class PrefixExpression implements Expression {
	constructor(
		public token: Token,                    // el token del operador ('-' o '!')
		public operator: string,                // "-" o "!"
		public right: Expression | null = null, // el operando
	) {}

	expressionNode(): void {}
	tokenLiteral(): string {
		return this.token.literal;
	}
	// Los paréntesis muestran cómo se agrupó: "-a * b" → "((-a) * b)".
	toString(): string {
		return `(${this.operator}${str(this.right)})`;
	}
}

// InfixExpression es un operador binario, que va ENTRE sus dos operandos:
//
//	<left> <operator> <right>
//	ej: 5 + 3   a * b   x == y   n ** 2
//
// Como left y right son a su vez expresiones, pueden ser otros
// InfixExpression; así se forman árboles como (1 + (2 * 3)).
export class InfixExpression implements Expression {
	constructor(
		public token: Token,                    // el token del operador ('+', '*', '==', ...)
		public left: Expression | null,         // operando izquierdo
		public operator: string,                // el operador como texto
		public right: Expression | null = null, // operando derecho
	) {}

	expressionNode(): void {}
	tokenLiteral(): string {
		return this.token.literal;
	}
	// Los paréntesis muestran la precedencia con la que se agrupó.
	toString(): string {
		return `(${str(this.left)} ${this.operator} ${str(this.right)})`;
	}
}

// AssignExpression representa la asignación de un nuevo valor:
//
//	<left> = <value>
//	ej: x = x + 1    arr[0] = 5
//
// A diferencia de LetStatement (que DECLARA una variable), esta cambia el
// valor de algo que ya existe. Es una expresión (no una sentencia) para
// poder usarla, por ejemplo, en la parte de actualización de un for.
// El parser solo permite que left sea un Identifier o un IndexExpression.
export class AssignExpression implements Expression {
	constructor(
		public token: Token,                    // el token '='
		public left: Expression,                // destino: variable (x) o posición (arr[0])
		public value: Expression | null = null, // nuevo valor
	) {}

	expressionNode(): void {}
	tokenLiteral(): string {
		return this.token.literal;
	}
	toString(): string {
		return `${this.left} = ${str(this.value)}`;
	}
}

// ---------------------------------------------------------------------------
// Estructuras de control
// ---------------------------------------------------------------------------

// IfExpression representa un condicional:
//
//	if (<condition>) <consequence> else <alternative>
//	ej: if (x > 0) { 1 } else { 0 }
//
// No existe un nodo "Elif": un elif se representa como un alternative que
// contiene otro IfExpression. Es decir:
//
//	if (a) {1} elif (b) {2} else {3}  ≡  if (a) {1} else { if (b) {2} else {3} }
export class IfExpression implements Expression {
	condition: Expression | null = null;          // condición a evaluar
	consequence: BlockStatement | null = null;    // bloque que se ejecuta si es verdadera
	alternative: BlockStatement | null = null;    // bloque del else/elif; null si no hay

	constructor(public token: Token) {} // el token 'if' (o 'elif' si es un if anidado)

	expressionNode(): void {}
	tokenLiteral(): string {
		return this.token.literal;
	}
	toString(): string {
		let out = `if ${str(this.condition)} ${str(this.consequence)}`;
		if (this.alternative !== null) {
			out += ` else ${this.alternative}`;
		}
		return out;
	}
}

// WhileExpression representa un ciclo que se repite mientras la condición
// sea verdadera:
//
//	while (<condition>) <body>
//	ej: while (x > 0) { x = x - 1 }
export class WhileExpression implements Expression {
	condition: Expression | null = null; // se evalúa antes de cada vuelta
	body: BlockStatement | null = null;  // cuerpo del ciclo

	constructor(public token: Token) {} // el token 'while'

	expressionNode(): void {}
	tokenLiteral(): string {
		return this.token.literal;
	}
	toString(): string {
		return `while ${str(this.condition)} ${str(this.body)}`;
	}
}

// ForExpression representa un ciclo for al estilo C:
//
//	for (<init>; <condition>; <update>) <body>
//	ej: for (let i = 0; i < 10; i = i + 1) { ... }
//
// Significado:
//  1. init se ejecuta una sola vez, antes de empezar.
//  2. Antes de cada vuelta se evalúa condition; si es falsa, el ciclo termina.
//  3. Se ejecuta body.
//  4. Se ejecuta update y se vuelve al paso 2.
//
// Cualquiera de las tres partes del encabezado puede omitirse (queda null):
// "for (;;) { ... }" es un ciclo infinito.
export class ForExpression implements Expression {
	init: Statement | null = null;       // inicialización: let i = 0  (es sentencia)
	condition: Expression | null = null; // condición:      i < 10
	update: Expression | null = null;    // actualización:  i = i + 1
	body: BlockStatement | null = null;  // cuerpo del ciclo

	constructor(public token: Token) {} // el token 'for'

	expressionNode(): void {}
	tokenLiteral(): string {
		return this.token.literal;
	}
	toString(): string {
		// LetStatement.toString() termina en ';'; se quita para no
		// imprimir ";;" junto con el separador que se agrega después.
		const init = str(this.init).replace(/;$/, "");
		return `for (${init}; ${str(this.condition)}; ${str(this.update)}) ${str(this.body)}`;
	}
}

// ---------------------------------------------------------------------------
// Funciones
// ---------------------------------------------------------------------------

// FunctionLiteral representa la DEFINICIÓN de una función:
//
//	function(<parameters>) <body>
//	ej: function(a, b) { return a + b; }
//
// Las funciones son valores (expresiones), por eso no tienen nombre propio:
// se les da nombre guardándolas en una variable con let.
export class FunctionLiteral implements Expression {
	parameters: Identifier[] = [];      // nombres de los parámetros (a, b)
	body: BlockStatement | null = null; // cuerpo de la función

	constructor(public token: Token) {} // el token 'function'

	expressionNode(): void {}
	tokenLiteral(): string {
		return this.token.literal;
	}
	toString(): string {
		const params = this.parameters.map((p) => p.toString()).join(", ");
		return `${this.tokenLiteral()}(${params}) ${str(this.body)}`;
	}
}

// CallExpression representa una LLAMADA a una función:
//
//	<function>(<arguments>)
//	ej: suma(1, 2 * 3)
//	    function(x) { x * 2 }(5)   ← se puede llamar un literal directamente
export class CallExpression implements Expression {
	constructor(
		public token: Token,                      // el token '('
		public func: Expression | null,           // lo que se llama: Identifier o FunctionLiteral
		public args: (Expression | null)[] = [],  // valores que se pasan (1, 2 * 3)
	) {}

	expressionNode(): void {}
	tokenLiteral(): string {
		return this.token.literal;
	}
	toString(): string {
		return `${str(this.func)}(${this.args.map(str).join(", ")})`;
	}
}

// ---------------------------------------------------------------------------
// Estructuras de datos
// ---------------------------------------------------------------------------

// ArrayLiteral representa un arreglo escrito en el código:
//
//	[<elements>]
//	ej: [1, 2 + 3, "hola"]
export class ArrayLiteral implements Expression {
	constructor(
		public token: Token,                         // el token '['
		public elements: (Expression | null)[] = [], // los elementos, en orden
	) {}

	expressionNode(): void {}
	tokenLiteral(): string {
		return this.token.literal;
	}
	toString(): string {
		return `[${this.elements.map(str).join(", ")}]`;
	}
}

// IndexExpression representa el acceso a un elemento por su índice/clave:
//
//	<left>[<index>]
//	ej: arr[0]   h["nombre"]   matriz[i][j]
export class IndexExpression implements Expression {
	constructor(
		public token: Token,                    // el token '['
		public left: Expression | null,         // lo que se indexa (arr)
		public index: Expression | null = null, // el índice o la clave (0)
	) {}

	expressionNode(): void {}
	tokenLiteral(): string {
		return this.token.literal;
	}
	toString(): string {
		return `(${str(this.left)}[${str(this.index)}])`;
	}
}

// HashPair es una pareja clave: valor dentro de un HashLiteral.
export interface HashPair {
	key: Expression | null;
	value: Expression | null;
}

// HashLiteral representa un hash (diccionario) escrito en el código:
//
//	{<clave>: <valor>, ...}
//	ej: {"nombre": "Pola", "edad": 3}
//
// Las parejas se guardan en una lista (y no en un Map) para conservar
// el orden en que se escribieron y para que dos claves que se escriben
// igual (por ejemplo dos "x") no se pisen.
export class HashLiteral implements Expression {
	constructor(
		public token: Token,          // el token '{'
		public pairs: HashPair[] = [], // parejas clave: valor, en orden
	) {}

	expressionNode(): void {}
	tokenLiteral(): string {
		return this.token.literal;
	}
	toString(): string {
		const pairs = this.pairs.map((p) => `${str(p.key)}: ${str(p.value)}`);
		return `{${pairs.join(", ")}}`;
	}
}
