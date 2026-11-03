# Guía de estudio para la sustentación

El examen es individual y vale el 40 %. Según el enunciado, puede preguntar: qué hace una función del código y por qué, cómo se refleja la gramática en el parser, qué tokens y qué AST produce una entrada, qué resultado da un programa (con ámbitos, recursión o precedencia), en qué etapa se detecta un error, y cómo agregar o cambiar una construcción. Esta guía sigue ese orden. Todas las respuestas se comprobaron ejecutando el intérprete.

**Cómo estudiar:** abran `npm start` y prueben cada ejemplo en los tres modos (`:lexer`, `:parser`, `:evaluator`). Lean el código de cada etapa con esta guía al lado.

---

## 1. Un programa de principio a fin

Entrada: `let x = 2 + 3 * 4;`

**Lexer** (`src/lexer/lexer.ts`): lee carácter por carácter y produce tokens. Cada token guarda su tipo, su texto, su línea y su columna.

```text
LET(let) IDENT(x) =(=) INT(2) +(+) INT(3) *(*) INT(4) ;(;) EOF
```

**Parser** (`src/parser/parser.ts`): arma el árbol respetando la precedencia. Como `*` tiene más precedencia que `+`, el `3 * 4` queda más abajo en el árbol: se calcula primero.

```text
Program
└── LetStatement x
    └── Valor: InfixExpression +
        ├── Izquierda: IntegerLiteral 2
        └── Derecha: InfixExpression *
            ├── Izquierda: IntegerLiteral 3
            └── Derecha: IntegerLiteral 4
```

**Evaluador** (`src/evaluator/evaluator.ts`): recorre el árbol desde las hojas. Evalúa `3 * 4 = 12`, luego `2 + 12 = 14`, y guarda `x = 14` en el entorno (`env.set`).

**Dónde se junta todo:** `ejecutar` en `src/interprete.ts`. Si el lexer o el parser encontraron errores, el programa **no se ejecuta**.

---

## 2. Lexer

- **`readChar`** avanza un carácter. Al llegar al final, `ch` queda en `"\0"`, que significa "fin de la entrada". También lleva la cuenta de la línea y la columna.
- **`peekChar`** mira el siguiente carácter **sin avanzar**. Así se distingue `=` de `==`, `<` de `<=`, `*` de `**`, `&&` de un `&` suelto, y `//` (comentario) de `/`.
- **`makeTwoCharToken`** arma los tokens de dos caracteres (`==`, `!=`, `<=`, `>=`, `**`, `&&`, `||`).
- **Identificadores y números** se leen completos con `readIdentifier` y `readNumber`, que ya dejan el lexer en el carácter siguiente. Por eso `readToken` **retorna antes** del `readChar` final; si no, se saltaría un carácter.
- **Palabras reservadas:** primero se lee la palabra entera y luego se busca en el mapa `keywords` (`lookupIdent` en `src/token/token.ts`). `let` → `LET`, `edad` → `IDENT`.
- **Errores léxicos:** un carácter que no existe (`@`, `#`, un `&` solo) o una cadena sin cerrar produce un token `ILLEGAL`, y el lexer registra el error. No se detiene: sigue con el resto del texto.
- **Comentarios:** `skipWhitespace` salta los espacios y también todo lo que va de `//` hasta el final de la línea. El parser nunca ve los comentarios.

---

## 3. Parser (Pratt)

- Mira siempre **dos tokens**: `curToken` (el actual) y `peekToken` (el siguiente).
- Cada tipo de token tiene una función **prefija** (cuando la expresión EMPIEZA con ese token: `5`, `x`, `-x`, `(`, `if`, `function`, `[`, `{`) y/o una **infija** (cuando el token va ENTRE dos expresiones: `+`, `==`, `&&`, `(` de una llamada, `[` de un índice). Están en las tablas `prefixParseFns` e `infixParseFns`.
- **`parseExpression(precedencia)`**, el corazón del parser:
  1. Llama a la función prefija del token actual: ese es el lado izquierdo.
  2. **Mientras** el siguiente token sea un operador con precedencia **mayor** que la recibida, avanza y llama a su función infija con lo que lleva armado.
  3. Cuando encuentra algo de precedencia menor o igual (o `;`, `)`, `}`), se detiene.
- **Precedencias**, de menor a mayor: `=` < `||` < `&&` < `==` `!=` < `<` `>` `<=` `>=` < `+` `-` < `*` `/` `%` < prefijos `-x` `!x` < `**` < llamada `f(x)` < índice `a[i]`.
- **Asociatividad:** los operadores normales asocian por la izquierda (`1 - 2 - 3` = `(1 - 2) - 3`), porque `parseInfixExpression` parsea el lado derecho con la MISMA precedencia y el siguiente operador igual no la supera. `**` y `=` asocian por la derecha porque su lado derecho se parsea con **un nivel menos**.
- **`-2 ** 2` = `-(2 ** 2)`:** el `-` parsea su operando con la precedencia de los prefijos, y `**` es mayor, así que se lo lleva.
- **`elif`** no tiene nodo propio: `if a {1} elif b {2} else {3}` se arma como `if a {1} else { if b {2} else {3} }` (llamada recursiva en `parseIfExpression`).
- **Relación con la gramática:** cada nivel de la EBNF en `docs/DISENO.md` corresponde a una constante de precedencia. En lugar de una función por nivel, el parser de Pratt usa la tabla.
- **Errores de sintaxis:** `expectPeek` exige el siguiente token. Si no es el esperado, registra "se esperaba X, pero se encontró Y" con la posición, y la función devuelve `null`. El parser sigue con la siguiente sentencia, por eso puede reportar varios errores.

---

## 4. Evaluador

- **Tabla de evaluadores:** `registrar(ast.IfExpression, ...)` asocia cada clase de nodo con su función, igual que las tablas del parser. `evaluarNodo` busca la clase del nodo en la tabla y llama a su función.
- **`evaluar`** envuelve a `evaluarNodo`: si el resultado es un error sin posición, le pone la línea y la columna del token de ese nodo. Como los errores suben desde abajo, la posición que queda es la del nodo que falló.
- **Errores y `return` son valores** (`ErrorObj`, `ReturnValue`), no excepciones. Después de evaluar cada hijo se revisa si devolvió uno de ellos; si es así, se pasa hacia arriba sin seguir ejecutando.
- **`evaluarPrograma` vs `evaluarBloque`:** el programa **desenvuelve** el `return` porque es el nivel más alto. El bloque **no** lo desenvuelve, para que un `return` dentro de un `if` salga también de la función. La que lo desenvuelve es `aplicarFuncion`.
- **Ámbitos** (`src/object/environment.ts`):
  - `get` busca la variable aquí y, si no está, en el entorno exterior (`outer`), hasta el global.
  - `set` (usado por `let` y por los parámetros) declara en el entorno ACTUAL.
  - `assign` (usado por `x = ...`) cambia la variable donde fue declarada; si no existe en ningún lado, es error.
  - Cada llamada a función crea un entorno nuevo cuyo exterior es el entorno donde se **definió** la función. Eso da los **cierres** y hace que la recursión funcione (cada llamada tiene sus propios parámetros).
  - **Los bloques no crean ámbito:** un `let` dentro de un `if`, `while` o `for` queda en el ámbito de afuera.
- **Verdad:** solo `false` y `null` son falsos (`esVerdadero`). El `0`, `""` y `[]` son verdaderos.
- **Cortocircuito** (`evaluarLogico`): `a && b` no evalúa `b` si `a` es falso, y `a || b` no evalúa `b` si `a` es verdadero. El resultado siempre es un booleano.
- **Enteros de 64 bits:** se calculan con `bigint` y `entero()` revisa que el resultado quepa; si no, da "desbordamiento de entero" (como el `int64` de Go).

---

## 5. Errores: ¿en qué etapa se detectan?

| Entrada | Etapa | Mensaje |
| --- | --- | --- |
| `x @ 2` | Léxica | `carácter no reconocido '@'` |
| `let s = "hola` | Léxica | `cadena sin cerrar "hola` |
| `let 1x = 3;` | **Sintáctica** (¡no léxica!) | `se esperaba IDENT, pero se encontró INT ("1")`. El lexer lee `1` (INT) y `x` (IDENT) sin problema: es el **orden** lo que está mal. |
| `if (x) { 1` | Sintáctica | `bloque sin cerrar: falta '}'` |
| `5 = 3` | Sintáctica | `no se puede asignar a 5` |
| `5 / (2 - 2)` | Ejecución | `división por cero` |
| `"5" + 5` | Ejecución | `tipos incompatibles: STRING + INTEGER` |
| `contador = 1` (sin `let`) | Ejecución | `identificador no definido: contador` |
| `sumar(1)` con dos parámetros | Ejecución | `cantidad de argumentos incorrecta: se esperaban 2, llegaron 1` |

**La flecha bajo el error** la arma `conContexto` (`src/interprete.ts`): toma la línea y la columna del propio mensaje ("en línea L, columna C"), busca esa línea en el código y pone un `^` debajo. Para que la flecha quede alineada, copia las tabulaciones que haya antes de la columna y cambia lo demás por espacios. La cara de Kyra la elige `imprimirErrores` (`src/repl/repl.ts`) según cómo empieza el primer mensaje: `Error léxico`, `Error de sintaxis` o `Error de ejecución`.

**Regla para decidir:** si el problema es un carácter o una palabra que no existe, es **léxico**. Si las palabras existen pero están en un orden que la gramática no permite, es **sintáctico**. Si el programa está bien escrito pero falla al ejecutarse (un valor, un tipo, una variable que no existe), es **de ejecución**.

---

## 6. Cómo agregar o cambiar una construcción

**Un operador nuevo** (por ejemplo `//` para división entera, si `/` fuera decimal):
1. `token.ts`: agregar la constante del token.
2. `lexer.ts`: reconocerlo en `readToken` (con `peekChar` si tiene dos caracteres).
3. `parser.ts`: darle una precedencia en `precedences` y registrar su función infija (`registerInfix`).
4. `evaluator.ts`: agregar su `case` en `evaluarInfijoEnteros` (o en el tipo que corresponda).
5. Pruebas: un caso en cada `*.test.ts` y un programa en `tests/validos/`.

**Una función integrada** (por ejemplo `abs(x)`): basta con agregarla al mapa `builtins` en `src/evaluator/builtins.ts`. No hay que tocar el lexer ni el parser, porque `abs(x)` ya es una llamada normal y el evaluador busca el nombre en `builtins` cuando no es una variable.

**Una sentencia nueva** (por ejemplo `break`): `BREAK` ya es palabra reservada. Habría que:
1. Crear el nodo `BreakStatement` en `ast.ts`.
2. Parsearlo en `parseStatement`.
3. Crear un valor de control `BreakSignal` en `object.ts`, como `ReturnValue`.
4. Registrar su evaluador, que lo devuelve, y hacer que `evaluarBloque` lo pase hacia arriba y que `evaluarWhile`/`evaluarFor` lo detecten y terminen el ciclo.

---

## 7. Preguntas de práctica (con respuesta)

1. **¿Cómo agrupa el parser `a = b || c && !d == e`?**
   `a = (b || (c && ((!d) == e)))`. `!` es prefijo (el más fuerte de estos); luego `==`, luego `&&`, luego `||` y por último `=`.

2. **¿Cuánto vale `-2 ** 2 + 10 % 3 * 2`?** `-4 + 1 * 2` = **-2**. Agrupación: `((-(2 ** 2)) + ((10 % 3) * 2))`.

3. **¿`2 ** 3 ** 2` y `(2 ** 3) ** 2`?** **512** y **64**: la potencia asocia por la derecha.

4. **¿Qué da este programa?**
   ```text
   let x = 5;
   let f = function() { let x = 10; let g = function() { x = x + 1; x }; g() + x };
   f() + x
   ```
   **27.** Dentro de `f`, `let x = 10` crea una x LOCAL. `g` no la declara, así que `x = x + 1` cambia la x de `f` (la del ámbito donde se definió `g`) a 11 y devuelve 11. Luego `g() + x` = 11 + 11 = 22, y `f() + x` (la global, que sigue en 5) = 27.

5. **¿Qué da `let n = 10; let cambiar = function(n) { n = 99; n }; cambiar(1) + n`?** **109.** El parámetro `n` tapa a la global; `n = 99` cambia el parámetro, no la global.

6. **¿Qué da `let x = 3; if (x > 2) { let y = x * 2; } y`?** **6.** Los bloques no crean ámbito, así que la `y` del `if` sigue existiendo después.

7. **¿Qué da `for (let i = 0; i < 3; i = i + 1) { i * 2 }`, y luego `i`?** El ciclo vale **4** (el valor de la última vuelta, `2 * 2`), y `i` vale **3**: la variable del `for` sigue existiendo, igual que en el evaluador del profesor.

8. **¿`true || 1 / 0` y `false || 1 / 0`?** `true` (por el cortocircuito, la división no se evalúa) y **error: división por cero** (aquí sí hace falta evaluar el lado derecho).

9. **¿Qué da `let a = [1, 2]; let b = a; b[0] = 9; a`?** **[9, 2]**: `a` y `b` son el MISMO arreglo. En cambio, `let b = push(a, 3)` deja `a` igual, porque `push` crea un arreglo nuevo.

10. **Con `let f = function(n) { if (n <= 1) { return 1; } return f(n - 1) + f(n - 2); }`, ¿cuánto vale `f(5)`?** **8** (f(0) = f(1) = 1, f(2) = 2, f(3) = 3, f(4) = 5, f(5) = 8).

11. **¿Qué da `let f = function() { return 1; 2 }; f() + 10`?** **11**: el `return` corta la función antes del `2`.

12. **Con `let contador = function() { let c = 0; function() { c = c + 1; c } };`, si `let a = contador(); let b = contador();` y se llama `a(); a(); b();`, ¿qué da `a() * 10 + b()`?** **32.** Cada llamada a `contador` crea su propia `c`: el tercer `a()` da 3 y el segundo `b()` da 2.

13. **¿`"5" + str(5)`, `int("5") + 5` y `"5" + 5`?** `55` (texto), `10`, y **error de ejecución** `tipos incompatibles: STRING + INTEGER`.

14. **¿Por qué `if (0) { "a" } else { "b" }` da `a`?** Porque solo `false` y `null` son falsos; el `0` es verdadero.

15. **¿Por qué `evaluarBloque` no desenvuelve el `ReturnValue`?** Si lo hiciera, en `function() { if (true) { return 1; } return 2; }` el `return 1` solo saldría del bloque del `if`, la función seguiría y devolvería 2.

16. **¿Qué tokens produce `let total=a**2!=b;`?** `LET IDENT(total) = IDENT(a) ** INT(2) != IDENT(b) ;`. Los espacios no hacen falta, porque `peekChar` reconoce `**` y `!=`.

17. **¿Por qué el intérprete corre en un hilo aparte (`main.ts`)?** Para tener una pila de 256 MB. Cada llamada del lenguaje usa varias llamadas de TypeScript, y con la pila normal una recursión de unas 600 llamadas fallaba.
