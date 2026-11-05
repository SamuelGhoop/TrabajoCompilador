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

Con `:traza` se ve cómo trabaja la recursión: cada línea es una llamada, debajo van las llamadas que hizo y la flecha muestra lo que devolvió:

```text
evaluator>> :traza fibonacci(3)
fibonacci(3) → 2
├─ fibonacci(2) → 1
│  ├─ fibonacci(1) → 1
│  └─ fibonacci(0) → 0
└─ fibonacci(1) → 1
5 llamadas · profundidad máxima 3
2
```

Cada error dice en qué etapa ocurrió (léxica, sintáctica o de ejecución) y en qué línea y columna, y muestra esa línea del código con una flecha bajo el lugar exacto. Kyra pone una cara distinta según la etapa: `( O|o )` léxica, `( -|- )` sintáctica, `( x|x )` de ejecución. Y si escribes `kyra()`, aparece ella.

| Comando | Acción |
| --- | --- |
| `:lexer` / `:parser` / `:evaluator` | Cambia de modo (`:eval` también sirve). |
| `:cargar ruta.ssg` | Ejecuta un archivo en la sesión actual; sus funciones quedan disponibles. |
| `:traza código` | Ejecuta el código mostrando el árbol de llamadas a funciones (ver abajo). |
| `:ayuda` | Muestra los comandos. |
| `:salir` | Cierra el REPL (también Ctrl+D, o Ctrl+Z y Enter en Windows). |

## Interfaz web (estilo terminal de Fallout)

```bash
npm run ui
```

Abre **http://localhost:4747** en el navegador. Es una terminal de fósforo verde al estilo de los terminales de Fallout, con efectos de CRT y sonidos generados por el navegador:

- **Editor** a la izquierda: programas de varias líneas, con números de línea; la línea de un error se marca en rojo.
- **Pestañas** a la derecha con las tres etapas del mismo código: **[SALIDA]** (lo que escribe `print` y el valor final, o los errores con Kyra), **[TOKENS]** (lexer), **[AST]** (parser) y **[TRAZA]** (árbol de llamadas).
- **[EJEMPLOS ▾]** (o `F2`) abre un menú para elegir entre **[NORMAL]** y **[COLOMBIANO]** (los mismos ejemplos escritos en parce), con vista previa del código. Se maneja con el ratón o con `↑ ↓` (mover), `← →` (normal / colombiano), `Enter` (cargar) y `Esc` (cerrar).
- **[JUEGO]** abre el huerto de Kyra (ver abajo).
- **Atajos:** `Ctrl+Enter` ejecuta, `Esc` detiene y `F1` abre la ayuda.

El navegador no ejecuta el lenguaje: le manda el código al servidor, que lo corre con **el mismo intérprete** del REPL en un hilo con pila de 256 MB. Por eso no tiene el límite de recursión del navegador (en la interfaz también funcionan 50 000 llamadas anidadas) y da exactamente los mismos resultados que la terminal. Cada programa tiene un tiempo límite de 60 s, y **[■ DETENER]** lo corta (por ejemplo, un ciclo infinito). El servidor solo escucha en `127.0.0.1`.

## El huerto de Kyra (modo juego)

El botón **[JUEGO]** de la interfaz web abre un juego para aprender el lenguaje: Kyra, la perrita-robot, cuida un huerto hidropónico en un refugio, y usted la programa en el mismo lenguaje del curso.

| Nivel | Tema | Qué hay que hacer |
| --- | --- | --- |
| 1 · Primera cosecha | Secuencia y variables | Llegar a la tierra, plantar y cosechar. |
| 2 · Kyra decide | Condicionales | Un mismo programa debe ganar en 3 tableros distintos. |
| 3 · La fila larga | Ciclos | Plantar y cosechar una fila de 6 casillas. |
| 4 · Tres filas | Funciones | Definir `cosecharFila(rumbo)` y usarla tres veces. |
| 5 · El inventario | Arreglos y hashes | Seguir una ruta guardada en un arreglo y contar en un hash. |
| 6 · Modo libre | Todo el lenguaje | Sin meta, con una batería de 2000 pasos. |

| Comando | Qué hace |
| --- | --- |
| `mover("norte")` | Avanza una casilla: `"norte"`, `"sur"`, `"este"` u `"oeste"`. |
| `plantar()` | Siembra una lechuga en la tierra. |
| `cosechar()` | Recoge lo que esté listo y devuelve su nombre (`"lechuga"` o `"tomate"`). |
| `mirar()` | Devuelve lo que hay bajo Kyra: `"tierra"`, `"brote"`, `"listo"` o `"pasillo"`. |
| `esperar()` | Deja pasar un ciclo. |
| `reportar(inventario)` | Entrega un hash como `{"lechuga": 3}`; debe coincidir con lo cosechado. |

**Reglas.** Cada comando cuesta 1 paso y hace crecer los brotes 1 ciclo, y un brote tarda 3 ciclos: `plantar(); esperar(); esperar(); cosechar();`. Chocar, plantar fuera de la tierra o cosechar algo que no está listo detiene el programa con un error de ejecución, igual que una división por cero. Ganar da 1 estrella, y cumplir el par de pasos y el de líneas da una más cada uno. Las líneas vacías y los comentarios no cuentan.

**Vista 3D.** El huerto se ve en 3D (three.js) y **[VISTA: 3D/2D]** cambia al tablero de emojis. Kyra camina, choca, planta, cosecha, mira, espera, ladra al reportar, celebra al ganar y se pone triste al perder; los cultivos aparecen, crecen y suben al cosecharlos. Al cosechar sale un "+1" con hojas, al chocar saltan chispas y tiembla la cámara, y al ganar cae confeti y las estrellas se encienden una por una. Una barra de luz marca en el editor la línea que Kyra está ejecutando y destella con cada comando, al mismo tiempo que las luces de Kyra. Cada nivel tiene su luz, del amanecer (nivel 1) a la noche (modo libre). La cámara se ajusta sola a cada tablero: arrastrar gira, la rueda acerca y doble clic vuelve a centrar. Los modelos y sus 10 animaciones se hicieron en Blender (`web/3d/modelos/huerto.blend`) y se exportan a `huerto.glb`. El visor no conoce las reglas: compara cada foto con la anterior para saber qué animar. Si el navegador no tiene WebGL, el juego sigue en 2D, y si falta el `.glb`, usa figuras simples con las mismas animaciones. three.js se instala con `npm install` y lo sirve el mismo servidor, así que funciona sin internet.

**Controles.** Ejecutar, pausar, avanzar paso a paso, reiniciar, cambiar la velocidad, cambiar la vista, ver una pista y volver al menú de niveles. Mientras Kyra se mueve, se resalta la línea del comando que está haciendo. El código de cada nivel se guarda en el navegador (`localStorage`); las estrellas vuelven a cero cada vez que se abre la página, para poder mostrar el juego desde el principio.

**Ciclos infinitos.** Cada nivel tiene un tope de pasos (la batería de Kyra). Un ciclo que no llama comandos no gasta pasos: lo frena un tiempo límite de 10 s, y `Esc` lo cancela antes.

**Cómo funciona.** El programa se ejecuta con el mismo intérprete, en el servidor, y el navegador no conoce las reglas:

```text
navegador ──código + nivel──▶ servidor ──▶ intérprete + comandos del nivel
navegador ◀──lista de fotos── servidor ◀── una foto después de cada comando
```

El navegador solo reproduce esa lista: pausar o avanzar de a un paso es recorrerla a otro ritmo. Los comandos se declaran en el entorno de cada partida y no en la tabla de funciones integradas, así que no existen en el REPL, en los archivos `.ssg` ni en la pestaña normal de la interfaz. Un nivel es un objeto de datos en `src/juego/niveles.ts`, con un mapa de letras, los comandos habilitados, la meta y el par. `npm test` ejecuta la solución de cada nivel y comprueba que gana con las 3 estrellas.

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
| `12_caras_de_kyra.ssg` | Galería de las caras de Kyra: qué error provoca cada una y en qué etapa se detecta. |
| `programa.ssg` | Ejemplo del profesor: Ackermann, Fibonacci y Hanói (tarda ~30 s por `fibonacci(34)`). |

**Los mismos ejemplos en parce:** [`examples/parce/`](examples/parce) tiene cada ejemplo escrito en parce (`parce`, `vuelta`, `pilas`, `diga`, …). Se generan solos con:

```bash
npm run parce
```

El script (`scripts/a-parce.ts`) cambia las palabras del código y de los comentarios, pero no los textos entre comillas. Así cada versión en parce imprime **exactamente lo mismo** que la original, y `npm test` lo comprueba. Si se cambia un ejemplo, hay que volver a correr `npm run parce`.

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
| `src/repl/` | REPL interactivo y `:traza`. |
| `src/main.ts`, `src/kyra.ts` | Punto de entrada y la bienvenida de Kyra. |
| `src/hilo.ts` | Crea los hilos con pila de 256 MB donde corre el intérprete. |
| `src/web/` | Servidor de la interfaz web, el ejecutor de cada programa y las rutas de los archivos del modo 3D (`estaticos.ts`). |
| `src/juego/` | El huerto de Kyra: reglas (`juego.ts`), niveles (`niveles.ts`) y comandos del lenguaje (`comandos.ts`). |
| `web/index.html` | La interfaz web (un solo archivo). |
| `web/3d/` | El visor 3D del huerto (`huerto3d.js`, con three.js) y los modelos de Blender (`modelos/`). |
| `examples/`, `tests/` | Programas de ejemplo y casos de prueba. |
| `docs/DISENO.md` | Documento de diseño: gramática, arquitectura, decisiones y limitaciones. |
