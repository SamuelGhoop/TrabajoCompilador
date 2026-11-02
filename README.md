# Compilador (CatCompiler en TypeScript)

Port a TypeScript de [CatCompiler](https://github.com/sebastianzapatar/compi8am), un proyecto educativo para analizar un lenguaje pequeño. Incluye un analizador léxico (*lexer*), un analizador sintáctico (*parser*) y un REPL que permite ver los tokens o el árbol de sintaxis abstracta (AST) de una línea de código. Por ahora no evalúa ni ejecuta las expresiones.

## Requisitos

- Node.js 22 o superior.
- `npm install` para instalar `tsx` y `typescript`.

## Inicio rápido

```bash
npm install
npm start
```

Al iniciar, elige `1` para ver los tokens o `2` para ver el AST. Luego escribe una línea de código y presiona Enter. El REPL procesa cada línea por separado.

Por ejemplo, en modo parser:

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
| `:ayuda` | Muestra los comandos disponibles. |
| `:salir` | Cierra el REPL. |

También puedes salir con Ctrl+D (Ctrl+Z y Enter en Windows).

## Sintaxis reconocida

- Declaraciones `let`, `return` y expresiones.
- Enteros (de 64 bits), cadenas entre comillas dobles, booleanos, identificadores, arreglos y hashes.
- Operadores aritméticos (`+`, `-`, `*`, `/`, `%`, `**`), de comparación (`==`, `!=`, `<`, `>`, `<=`, `>=`), asignación (`=`) y prefijos (`-`, `!`).
- Condicionales `if`, `elif` y `else`; ciclos `while` y `for`.
- Funciones con `function`, llamadas e indexación con `[]`.

El lexer reconoce identificadores con letras ASCII y guion bajo; los dígitos se usan para números enteros. `break` se reconoce como palabra reservada, pero el parser todavía no la usa.

## Estructura

| Ruta | Función |
| --- | --- |
| `src/main.ts` | Inicia la aplicación y el REPL. |
| `src/token/` | Define los tipos de token y las palabras reservadas. |
| `src/lexer/` | Convierte texto fuente en tokens. |
| `src/parser/` | Construye el AST mediante un parser de Pratt. |
| `src/ast/` | Define los nodos del árbol sintáctico. |
| `src/repl/` | Gestiona la entrada interactiva y muestra tokens o AST. |

## Desarrollo

```bash
npm test        # pruebas del lexer, el parser y el REPL
npm run check   # revisión de tipos con tsc
```
