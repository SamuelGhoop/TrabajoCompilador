import { test } from "node:test";
import assert from "node:assert/strict";
import { PassThrough, Readable } from "node:stream";
import { start } from "./repl";

// ejecutar corre el REPL con las líneas dadas como entrada y devuelve todo
// lo que escribió.
async function ejecutar(lineas: string[]): Promise<string> {
  const salida = new PassThrough();
  let texto = "";
  salida.on("data", (chunk) => (texto += chunk));

  await start(Readable.from([lineas.join("\n") + "\n"]), salida);
  return texto;
}

test("TestReplParser", async () => {
  const out = await ejecutar(["2", "let x = 1 + 2 * 3;", ":salir"]);

  assert.ok(out.includes("parser>> "));
  assert.ok(out.includes(
    [
      "Programa:",
      "  let x = (1 + (2 * 3));",
      "AST:",
      "Program",
      "└── LetStatement x",
      "    └── Valor: InfixExpression +",
      "        ├── Izquierda: IntegerLiteral 1",
      "        └── Derecha: InfixExpression *",
      "            ├── Izquierda: IntegerLiteral 2",
      "            └── Derecha: IntegerLiteral 3",
      "",
    ].join("\n"),
  ));
  assert.ok(out.endsWith("¡Guau! Hasta luego.\n"));
});

test("TestReplLexerAndCommands", async () => {
  const out = await ejecutar(["4", "LEXER", 'x % "hi"', ":foo", ":parser", "let = 1", ":lexer"]);

  assert.ok(out.includes("Opción no válida, escribe 1, 2 o 3."));
  assert.ok(out.includes('{Type:IDENT Literal:x}\n{Type:% Literal:%}\n{Type:STRING Literal:hi}\n'));
  assert.ok(out.includes('Comando desconocido ":foo". Escribe :ayuda'));
  assert.ok(out.includes("Modo parser: se mostrará el AST."));
  assert.ok(out.includes(' ( o|o )\n\tse esperaba IDENT, pero se encontró = ("=")\n'));
  // Al acabarse la entrada (como con Ctrl+D) el REPL termina en el prompt.
  assert.ok(out.endsWith("lexer>> "));
});

test("TestReplTreeBranches", async () => {
  const out = await ejecutar(["parser", "if (a) { f(1) } else { [x, {\"k\": 2}] }"]);

  assert.ok(out.includes(
    [
      "Program",
      "└── ExpressionStatement",
      "    └── IfExpression",
      "        ├── Condición: Identifier a",
      "        ├── Entonces: BlockStatement",
      "        │   └── ExpressionStatement",
      "        │       └── CallExpression",
      "        │           ├── Función: Identifier f",
      "        │           └── Arg 0: IntegerLiteral 1",
      "        └── Sino: BlockStatement",
      "            └── ExpressionStatement",
      "                └── ArrayLiteral",
      "                    ├── [0]: Identifier x",
      "                    └── [1]: HashLiteral",
      '                        ├── Clave: StringLiteral "k"',
      "                        └── Valor: IntegerLiteral 2",
      "",
    ].join("\n"),
  ));
});

test("TestReplEvaluador", async () => {
  const out = await ejecutar([
    "3",
    "let x = 1 + 2 * 3;",
    "x * 2",
    'let saludo = function(n) { "Hola " + n };',
    'saludo("Kyra")',
    'print("x vale", x)',
    "10 / 0",
    "let = 1",
    ":salir",
  ]);

  // El let no imprime nada; la variable sigue viva en la línea siguiente.
  assert.ok(out.includes("eval>> eval>> 14\n"));
  assert.ok(out.includes('eval>> eval>> "Hola Kyra"\n'));
  // print escribe sin comillas, y como devuelve null no se imprime "null".
  assert.ok(out.includes("eval>> x vale 7\neval>> "));
  assert.ok(out.includes("Kyra encontró un error al ejecutar:\n ( o|o )\n\tdivisión entre cero\n"));
  assert.ok(out.includes("Kyra encontró errores de sintaxis:"));
});

test("TestReplEmptyInput", async () => {
  const out = await ejecutar([]);
  // Sin entrada se muestra el menú y se termina sin error.
  assert.ok(out.endsWith("Opción: "));
});
