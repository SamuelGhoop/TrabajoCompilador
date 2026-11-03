# KyraCompiler

Intérprete en **TypeScript** para el lenguaje del curso de Compiladores (Universidad EIA), basado en la rama [`evaluator`](https://github.com/sebastianzapatar/compi8am/tree/evaluator) de compi8am. Lee un programa, lo convierte en tokens, construye su árbol de sintaxis (AST) y lo ejecuta.

```text
código ──lexer──▶ tokens ──parser──▶ AST ──evaluador──▶ resultado
```

**Integrantes:** Samuel Giraldo Jiménez · Juan José Florez · Julián Marín

## Instalación

Requisitos: [Node.js](https://nodejs.org) 22 o superior.

```bash
git clone https://github.com/SamuelGhoop/TrabajoCompilador.git
cd TrabajoCompilador
npm install
```

No hace falta compilar: `tsx` ejecuta el TypeScript directamente. Para revisar los tipos: `npm run check`.

## Ejecución

El intérprete lee el código de dos formas.

**Desde un archivo** (`.ssg`), donde el programa puede ocupar varias líneas:

```bash
npm start -- examples/05_funciones.ssg
```

Se muestra lo que escribe `print` y, al final, el valor de la última expresión (si no es `null`). Los errores salen por la salida de errores, y el proceso termina con código 1.

**Desde la consola (REPL):**

```bash
npm start
```

Elige un modo: `1` muestra los tokens, `2` muestra el AST y `3` ejecuta el código. Cada línea se procesa por separado; en modo evaluator las variables se recuerdan de una línea a otra.

```text
Opción: 3
evaluator>> let doble = function(x) { x * 2 };
evaluator>> doble(21)
42
evaluator>> :cargar examples/05_funciones.ssg
...
evaluator>> factorial(5)
120
evaluator>> 10 / 0
 |\_._/|   ¡Auch! Kyra tropezó al ejecutar:
 ( x|x )
	Error de ejecución en línea 1, columna 4: división por cero
	 1 | 10 / 0
	   |    ^
```

Cada error dice en qué etapa ocurrió (léxica, sintáctica o de ejecución) y en qué línea y columna, y muestra esa línea del código con una flecha bajo el lugar exacto. Kyra pone una cara distinta según la etapa: `( O|o )` léxica, `( -|- )` sintáctica, `( x|x )` de ejecución. Y si escribes `kyra()`, aparece ella.

| Comando | Acción |
| --- | --- |
| `:lexer` / `:parser` / `:evaluator` | Cambia de modo (`:eval` también sirve). |
| `:cargar ruta.ssg` | Ejecuta un archivo en la sesión actual; sus funciones quedan disponibles. |
| `:ayuda` | Muestra los comandos. |
| `:salir` | Cierra el REPL (también Ctrl+D, o Ctrl+Z y Enter en Windows). |

## El lenguaje

```text
let edad = 3;                                  // declarar
edad = edad + 1;                               // asignar
let saludo = function(nombre) {                // funciones (con recursión y cierres)
    return "Hola " + nombre;
};
if (edad >= 18 && !menor) { ... } elif (edad > 10) { ... } else { ... }
while (i < 10) { i = i + 1; }
for (let i = 0; i < len(lista); i = i + 1) { print(lista[i]); }
let lista = [1, 2, 3];   lista[0] = 10;        // arreglos
let kyra = {"raza": "boston terrier"};         // hashes
```

- **Tipos:** enteros de 64 bits, textos entre comillas dobles, booleanos, `null`, arreglos, hashes y funciones.
- **Operadores**, de menor a mayor precedencia: `=` · `||` · `&&` · `==` `!=` · `<` `>` `<=` `>=` · `+` `-` · `*` `/` `%` · `-x` `!x` · `**` · llamadas `f(x)` · índices `a[i]`. La potencia y la asignación asocian por la derecha.
- **`&&` y `||`** evalúan en cortocircuito: `x != 0 && 10 / x > 1` no divide por cero.
- **Ámbitos:** cada llamada a función tiene su ámbito local; `let` declara en el ámbito actual y `x = ...` cambia la variable visible más cercana.
- Solo `false` y `null` son falsos. La división es entera (`7 / 2` da `3`). `+` también une textos y arreglos.
- **Comentarios:** desde `//` hasta el final de la línea.

### En español

Cada palabra reservada y cada función integrada también se puede escribir en español, y se pueden mezclar con las de inglés:

```text
sea factorial = funcion(n) {
    si (n <= 1) { retorna 1; } sino { retorna n * factorial(n - 1); }
};
imprimir("6! =", factorial(6));
```

| Inglés | Español |
| --- | --- |
| `let` · `function` · `return` | `sea` · `funcion` · `retorna` |
| `if` · `elif` · `else` | `si` · `sinosi` · `sino` |
| `while` · `for` | `mientras` · `para` |
| `true` · `false` | `verdadero` · `falso` |
| `print` · `len` · `str` · `int` · `type` | `imprimir` · `longitud` · `texto` · `entero` · `tipo` |
| `first` · `last` · `rest` · `push` | `primero` · `ultimo` · `resto` · `agregar` |

### En "parce" (español colombiano)

Y si prefiere, ¡escríbalo como un paisa!

```text
parce saludar = vuelta(quien) {
    devuelva "¡Quiubo, " + quien + "!";
};
pilas (edad >= 18) { diga("ya es mayor") } osea (edad >= 13) { diga("está pelao") } deResto { diga("es un chiquito") }
dele (arepas < 3) { arepas = arepas + 1; }
pa (parce i = 0; i < cuantos(combo); i = i + 1) { diga(combo[i]); }
```

| Inglés | Parce | |
| --- | --- | --- |
| `let` | `parce` | `parce x = 5;` |
| `function` · `return` | `vuelta` · `devuelva` | "hacer una vuelta" |
| `if` · `elif` · `else` | `pilas` · `osea` · `deResto` | "¡pilas si…!", "o sea, si…", "de resto…" |
| `while` · `for` | `dele` · `pa` | "¡dele mientras…!", "pa' cada uno" |
| `true` · `false` | `deUna` · `paila` | "¡de una!", "¡paila!" |
| `print` · `len` · `type` | `diga` · `cuantos` · `queEs` | |

Las palabras llevan mayúsculas donde se indica (`deUna`, `deResto`, `queEs`), sin tildes ni espacios, porque el lexer solo acepta palabras de letras ASCII.

### Funciones integradas

| Función | Qué hace |
| --- | --- |
| `print(...)` | Escribe sus argumentos separados por espacios. |
| `len(x)` | Longitud de un texto, arreglo o hash. |
| `first(a)` / `last(a)` / `rest(a)` | Primer elemento, último, y arreglo sin el primero. |
| `push(a, x)` | Arreglo nuevo con `x` al final. |
| `str(x)` | Convierte cualquier valor en texto. |
| `int(x)` | Convierte un texto (`"42"`) o un booleano en entero. |
| `type(x)` | Nombre del tipo: `"INTEGER"`, `"STRING"`, `"ARRAY"`, … |

## Ejemplos

La carpeta [`examples/`](examples) tiene un programa comentado por cada característica:

| Archivo | Muestra |
| --- | --- |
| `01_variables.ssg` | Declaración, asignación y consulta de variables. |
| `02_expresiones.ssg` | Aritmética, comparaciones y lógica, con precedencia y asociatividad. |
| `03_condicionales.ssg` | `if` / `elif` / `else`, condicionales anidados. |
| `04_ciclos.ssg` | `while`, `for`, ciclos anidados, `return` dentro de un ciclo. |
| `05_funciones.ssg` | Parámetros, retorno y recursión. |
| `06_ambitos.ssg` | Variables locales y globales con el mismo nombre. |
| `07_estructuras.ssg` | Arreglos y hashes. |
| `08_funciones_integradas.ssg` | Funciones integradas y conversión de tipos. |
| `09_extensiones.ssg` | Cierres, cortocircuito y funciones de orden superior. |
| `10_espanol.ssg` | El lenguaje con las palabras en español. |
| `11_parce.ssg` | El lenguaje en "parce" (español colombiano). |
| `programa.ssg` | Ejemplo del profesor: Ackermann, Fibonacci y Hanói (tarda ~30 s por `fibonacci(34)`). |

## Pruebas

```bash
npm test
```

Ejecuta en un solo comando:
- las pruebas unitarias de cada etapa (`src/**/*.test.ts`);
- los programas de [`tests/validos/`](tests/validos) y [`tests/errores/`](tests/errores), comparando su salida con su archivo `.esperado`. Hay casos de errores léxicos, de sintaxis y de ejecución;
- que todos los ejemplos de `examples/` se ejecuten sin errores.

Para agregar un caso, basta con crear `tests/validos/nombre.ssg` (o en `errores/`) y su `nombre.esperado`.

## Estructura

| Ruta | Función |
| --- | --- |
| `src/token/` | Tipos de token y palabras reservadas. |
| `src/lexer/` | Analizador léxico: texto → tokens. |
| `src/ast/` | Nodos del árbol de sintaxis. |
| `src/parser/` | Analizador sintáctico (parser de Pratt): tokens → AST. |
| `src/object/` | Valores en ejecución y entorno de variables. |
| `src/evaluator/` | Evaluador del AST y funciones integradas. |
| `src/interprete.ts` | Une las tres etapas para ejecutar un programa. |
| `src/repl/` | REPL interactivo. |
| `src/main.ts`, `src/kyra.ts` | Punto de entrada y la bienvenida de Kyra. |
| `examples/`, `tests/` | Programas de ejemplo y casos de prueba. |
| `docs/DISENO.md` | Documento de diseño: gramática, arquitectura, decisiones y limitaciones. |
