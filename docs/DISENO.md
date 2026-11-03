# Documento de diseño — KyraCompiler

**Integrantes:** Samuel Giraldo Jiménez, Juan José Florez, Julián Marín
**Lenguaje de implementación:** TypeScript (Node.js 22) · **Proyecto base:** rama `evaluator` de [compi8am](https://github.com/sebastianzapatar/compi8am)

## 1. Gramática (EBNF)

La gramática está escrita en el orden de precedencia, de **menor a mayor**: cada nivel se apoya en el siguiente. El parser (`src/parser/parser.ts`) no tiene una función por nivel, sino una tabla de precedencias (parser de Pratt); la columna de la derecha muestra la constante que corresponde a cada nivel.

```ebnf
programa     = { sentencia } ;
sentencia    = "let" IDENT "=" expresion [ ";" ]
             | "return" expresion [ ";" ]
             | expresion [ ";" ]
             | ";" ;                                     (* sentencia vacía *)
bloque       = "{" { sentencia } "}" ;

expresion    = asignacion ;
asignacion   = logico_o [ "=" asignacion ] ;              (* ASSIGN, por la derecha;
                                                             destino: IDENT o índice *)
logico_o     = logico_y { "||" logico_y } ;               (* LOGIC_OR *)
logico_y     = igualdad { "&&" igualdad } ;               (* LOGIC_AND *)
igualdad     = comparacion { ( "==" | "!=" ) comparacion } ;      (* EQUALS *)
comparacion  = suma { ( "<" | ">" | "<=" | ">=" ) suma } ;        (* LESSGREATER *)
suma         = producto { ( "+" | "-" ) producto } ;              (* SUM *)
producto     = prefijo { ( "*" | "/" | "%" ) prefijo } ;          (* PRODUCT *)
prefijo      = ( "!" | "-" ) prefijo | potencia ;                 (* PREFIX *)
potencia     = posfijo [ "**" prefijo ] ;                 (* EXPONENT, por la derecha *)
posfijo      = primario { "(" [ lista ] ")" | "[" expresion "]" } ;   (* CALL, INDEX *)

primario     = INT | STRING | "true" | "false" | IDENT
             | "(" expresion ")"
             | "[" [ lista ] "]"
             | "{" [ par { "," par } ] "}"
             | "function" "(" [ IDENT { "," IDENT } ] ")" bloque
             | "if" expresion bloque { "elif" expresion bloque } [ "else" bloque ]
             | "while" expresion bloque
             | "for" "(" [ sentencia_for ] ";" [ expresion ] ";" [ expresion ] ")" bloque ;
lista        = expresion { "," expresion } ;
par          = expresion ":" expresion ;
sentencia_for = "let" IDENT "=" expresion | expresion ;

(* Léxico *)
IDENT        = letra { letra } ;                letra = "a".."z" | "A".."Z" | "_" ;
INT          = digito { digito } ;              digito = "0".."9" ;
STRING       = '"' { cualquier carácter excepto '"' } '"' ;
comentario   = "//" { cualquier carácter excepto salto de línea } ;   (* se ignora *)
```

Palabras reservadas: `let return function if elif else while for true false break`, cada una con un sinónimo en español (`sea retorna funcion si sinosi sino mientras para verdadero falso`) y otro en español colombiano (`parce devuelva vuelta pilas osea deResto dele pa deUna paila`) que producen el mismo token. En la gramática, `"let"` significa "`let`, `sea` o `parce`", y así con las demás. La condición de `if`/`while` puede ir con o sin paréntesis (los paréntesis son una expresión agrupada). Un `elif` se construye como un `if` anidado dentro del `else`.

## 2. Arquitectura

```text
código ──▶ Lexer ──tokens──▶ Parser ──AST──▶ Evaluador ──▶ resultado / error
           lexer/            parser/         evaluator/
           token/            ast/            object/
```

| Módulo | Responsabilidad |
| --- | --- |
| `token/` | Tipos de token, palabras reservadas y la posición (línea, columna) de cada token. |
| `lexer/` | Recorre el texto carácter por carácter y produce tokens. Salta espacios y comentarios. Reporta los **errores léxicos**. |
| `ast/` | Clases de los nodos del árbol: sentencias (`LetStatement`, …) y expresiones (`InfixExpression`, `IfExpression`, …). |
| `parser/` | Parser de Pratt: tablas `prefixParseFns`/`infixParseFns` y una tabla de precedencias. Reporta los **errores de sintaxis**. |
| `object/` | Valores en ejecución (`Integer`, `StringObj`, `ArrayObj`, `FunctionObj`, `ErrorObj`, …) y el `Environment` (ámbitos). |
| `evaluator/` | Recorre el AST con una **tabla de evaluadores** (clase de nodo → función) y las funciones integradas. Reporta los **errores de ejecución**. |
| `interprete.ts` | Une las tres etapas: si hay errores léxicos o de sintaxis, no ejecuta nada. |
| `repl/`, `main.ts` | Entrada: REPL (modos lexer, parser y evaluator; `:cargar`) y ejecución de archivos `.ssg`. |

**Entrada.** Están las dos modalidades: `npm start` abre el REPL, que procesa una línea a la vez y conserva las variables; `npm start -- programa.ssg` ejecuta un archivo completo, donde las funciones y los bloques pueden ocupar varias líneas. El intérprete corre en un *worker thread* con pila de 256 MB (ver §3).

**Errores.** Cada etapa reporta los suyos con la línea y la columna: `Error léxico en línea 3, columna 20: carácter no reconocido '@'`, `Error de sintaxis en …`, `Error de ejecución en …`. El lexer y el parser no se detienen en el primer error: siguen para reportarlos todos. Un error de ejecución es un valor (`ErrorObj`) que sube por el árbol igual que un `return` y detiene el programa; el evaluador le pone la posición del token del nodo que lo produjo.

## 3. Decisiones de diseño

- **Parser de Pratt.** Agregar un operador es registrar su función y su precedencia, sin reescribir la gramática. `**` y `=` son asociativos por la derecha porque su lado derecho se parsea con un nivel menos de precedencia.
- **Evaluador de recorrido de árbol con tabla de despacho.** Cada clase de nodo se registra con su función de evaluación (`registrar(ast.IfExpression, …)`), igual que las tablas del parser. Es más rápido que una cadena de `instanceof`, que medimos como el 57 % del tiempo.
- **Errores y `return` como valores**, no como excepciones: el flujo del programa se ve en el código del evaluador.
- **Ámbitos.** Cada llamada a función crea un `Environment` cuyo exterior es el entorno donde se **definió** la función: eso da cierres (closures) y recursión correcta. `let` declara en el ámbito actual; `x = …` cambia la variable visible más cercana y es error si nunca se declaró. Los bloques `if`/`while`/`for` no crean ámbito.
- **Mismo comportamiento que el evaluador del profesor**, para que sus programas de prueba den el mismo resultado: enteros de 64 bits con error de desbordamiento (se calculan con `bigint` y se revisa el rango), `+` une textos y arreglos, la variable del `for` sigue visible después del ciclo, un ciclo vale lo mismo que su última vuelta, solo `false` y `null` son falsos, y se usan sus mensajes de error.
- **Extensiones propias:** `&&` y `||` con evaluación en cortocircuito (dan siempre un booleano), comentarios `//`, las funciones integradas `print`, `len`, `first`, `last`, `rest`, `push`, `str`, `int` y `type`, y la línea y columna en todos los errores, con la línea del código y una flecha (`^`) bajo la columna (`conContexto` en `interprete.ts`). En el REPL, Kyra cambia de cara según la etapa del error, y `kyra()` la dibuja.
- **Palabras en español y en "parce"** (`sea x = 5;`, `parce x = 5;`): son sinónimos en el mapa `keywords` del lexer, que producen el mismo token que la palabra en inglés, así que el parser y el evaluador no cambian. Las funciones integradas también tienen esos nombres (`imprimir`/`diga`, `longitud`/`cuantos`, …). En el REPL, Kyra también habla en parce ("¡Uy, parce!", "¡Paila!", "¡Chao pues!"). Se conservan las palabras en inglés para que los programas del curso sigan funcionando.
- **Pila grande.** El evaluador es recursivo y cada llamada del lenguaje usa varias llamadas de TypeScript; con la pila normal de Node, una recursión de unas 600 llamadas fallaba. Se ejecuta en un hilo con 256 MB de pila (se probaron 100 000 llamadas anidadas) y, si aun así se agota (recursión infinita), se reporta como error de ejecución.

## 4. Limitaciones conocidas

- Solo hay enteros: no hay decimales. La división es entera.
- Las cadenas no tienen secuencias de escape (`\"`, `\n`), y los identificadores solo admiten letras ASCII y `_` (sin dígitos ni tildes).
- `break` es palabra reservada, pero no está implementado. `null` no se puede escribir como literal.
- En el REPL cada línea se procesa por separado; los programas de varias líneas deben ir en un archivo.
- Rendimiento: `fibonacci(34)` (11 millones de llamadas) tarda unos 33 s, frente a unos pocos segundos en Go.
- Un error de sintaxis puede producir mensajes en cascada, porque el parser sigue después del primer error.
- `==` entre hashes, arreglos o funciones compara si son el mismo objeto, no si tienen el mismo contenido.

## 5. Uso de inteligencia artificial

Usamos **Claude Code** (asistente de programación de Anthropic) para: traducir de Go a TypeScript el lexer, el AST, el parser y el REPL del proyecto base; escribir el evaluador y las funciones integradas; agregar los operadores lógicos, la posición de los errores y la ejecución de archivos; escribir los ejemplos, las pruebas y la documentación; y encontrar y corregir el problema de rendimiento y el de la pila.

Cómo verificamos que el código fuera correcto:
- **Pruebas automáticas** (`npm test`, 85 casos): pruebas unitarias de cada etapa, más 32 programas en `tests/` con su salida esperada. Cada salida esperada se revisó a mano antes de guardarla.
- **Comparación con el proyecto del profesor:** el programa `examples/programa.ssg` (Ackermann, Fibonacci y Hanói) da el mismo resultado que indica su README, y los mensajes de error y las reglas del lenguaje se tomaron de su código.
- **Revisión del código:** _(COMPLETAR antes de entregar: cómo revisó cada integrante el código, por ejemplo qué módulos leyó y qué probó en el REPL.)_
