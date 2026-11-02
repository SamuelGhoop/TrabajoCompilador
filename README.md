# KyraCompiler

Port a TypeScript de [compi8am](https://github.com/sebastianzapatar/compi8am), un proyecto educativo para un lenguaje pequeño. Incluye un analizador léxico (*lexer*), un analizador sintáctico (*parser*), un evaluador que ejecuta el código y un REPL para probar cada uno.

```text
texto ──lexer──▶ tokens ──parser──▶ AST ──evaluador──▶ resultado
```

## Requisitos

- Node.js 22 o superior.
- `npm install` para instalar `tsx` y `typescript`.

## Inicio rápido

```bash
npm install
npm start
```

Al iniciar, elige un modo: `1` para ver los tokens, `2` para ver el AST o `3` para ejecutar el código. Luego escribe una línea de código y presiona Enter. El REPL procesa cada línea por separado; en modo evaluador las variables se recuerdan de una línea a otra.

Por ejemplo, en modo evaluador:

```text
Opción: 3
eval>> let fib = function(n) { if (n < 2) { return n; } return fib(n - 1) + fib(n - 2); };
eval>> fib(20)
6765
eval>> let kyra = {"raza": "boston terrier", "edad": 3};
eval>> print("Kyra es una", kyra["raza"]);
Kyra es una boston terrier
eval>> 10 / 0
 |\_._/|   ¡Guau! Kyra encontró un error al ejecutar:
 ( o|o )
	división entre cero
```

Y en modo parser:

```text
Opción: 2
parser>> let x = 1 + 2 * 3;
Programa:
  let x = (1 + (2 * 3));
AST:
Program
└── LetStatement x
    └── Valor: InfixExpression +
        ├── Izquierda: IntegerLiteral 1
        └── Derecha: InfixExpression *
            ├── Izquierda: IntegerLiteral 2
            └── Derecha: IntegerLiteral 3
```

### Comandos del REPL

| Comando | Acción |
| --- | --- |
| `:lexer` | Cambia al modo de tokens. |
| `:parser` | Cambia al modo de AST. |
| `:eval` | Cambia al modo evaluador. |
| `:ayuda` | Muestra los comandos disponibles. |
| `:salir` | Cierra el REPL. |

También puedes salir con Ctrl+D (Ctrl+Z y Enter en Windows).

## El lenguaje

- Declaraciones `let`, `return` y expresiones.
- Enteros (sin límite de tamaño), cadenas entre comillas dobles, booleanos, `null`, arreglos y hashes.
- Operadores aritméticos (`+`, `-`, `*`, `/`, `%`, `**`), de comparación (`==`, `!=`, `<`, `>`, `<=`, `>=`), asignación (`=`) y prefijos (`-`, `!`).
- Condicionales `if`, `elif` y `else`; ciclos `while` y `for`.
- Funciones con `function`, llamadas, closures e indexación con `[]`.

Los nombres de variables solo pueden tener letras ASCII y guion bajo (sin dígitos ni tildes). `break` se reconoce como palabra reservada, pero todavía no hace nada.

### Cómo se ejecuta

- `let x = ...` **declara** una variable; `x = ...` **cambia** una que ya existe (si no existe, es un error).
- La división es entera: `7 / 2` da `3`. `+` también une textos: `"a" + "b"`.
- En una condición, solo `false` y `null` son falsos; todo lo demás (incluido el `0`) es verdadero.
- La variable del `for` (`for (let i = 0; ...)`) solo existe dentro del ciclo.
- Leer un índice que no existe (`[1, 2][5]` o `{"a": 1}["b"]`) da `null`.
- Las funciones recuerdan las variables del lugar donde se definieron (closures) y pueden cambiar variables de afuera.

### Funciones incluidas

| Función | Qué hace |
| --- | --- |
| `len(x)` | Longitud de un texto, arreglo o hash. |
| `first(arr)` / `last(arr)` | Primer o último elemento (`null` si está vacío). |
| `rest(arr)` | Arreglo nuevo sin el primer elemento. |
| `push(arr, x)` | Arreglo nuevo con `x` al final (no cambia el original). |
| `print(...)` | Escribe sus argumentos separados por espacios. |

## Estructura

| Ruta | Función |
| --- | --- |
| `src/main.ts` | Muestra la bienvenida de Kyra e inicia el REPL. |
| `src/kyra.ts` | Retrato de Kyra en pixel art. |
| `src/token/` | Define los tipos de token y las palabras reservadas. |
| `src/lexer/` | Convierte texto fuente en tokens. |
| `src/ast/` | Define los nodos del árbol sintáctico. |
| `src/parser/` | Construye el AST mediante un parser de Pratt. |
| `src/object/` | Define los valores en ejecución y el entorno de variables. |
| `src/evaluator/` | Ejecuta el AST y define las funciones incluidas. |
| `src/repl/` | Gestiona la entrada interactiva en los tres modos. |

## Desarrollo

```bash
npm test        # pruebas del lexer, el parser, el evaluador y el REPL
npm run check   # revisión de tipos con tsc
```
