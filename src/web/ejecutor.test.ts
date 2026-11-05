import { test } from "node:test";
import assert from "node:assert/strict";
import { atender } from "./ejecutor";

test("TestAtenderProgramaCorrecto", () => {
  const r = atender({ codigo: 'parce x = 2 * 3;\ndiga("x vale", x);\nx + 1', traza: false });

  assert.deepEqual(r.tokens.slice(0, 2), [
    { tipo: "LET", literal: "parce", linea: 1, columna: 1 },
    { tipo: "IDENT", literal: "x", linea: 1, columna: 7 },
  ]);
  // El programa reconstruido junta las sentencias (y conserva "parce").
  assert.equal(r.programa, 'parce x = (2 * 3);diga("x vale", x)(x + 1)');
  assert.ok(r.arbol?.startsWith("Program\n├── LetStatement x\n"));
  assert.equal(r.salida, "x vale 6\n");
  assert.equal(r.valor, "7");
  assert.deepEqual(r.errores, []);
  assert.equal(r.etapa, null);
  assert.equal(r.traza, null);
});

test("TestAtenderEtapasDeError", () => {
  assert.equal(atender({ codigo: "1 @ 2", traza: false }).etapa, "lexico");
  assert.equal(atender({ codigo: "let = 1", traza: false }).etapa, "sintaxis");
  const r = atender({ codigo: "1 / 0", traza: false });
  assert.equal(r.etapa, "ejecucion");
  assert.equal(r.errores[0], "Error de ejecución en línea 1, columna 3: división por cero\n 1 | 1 / 0\n   |   ^");
  // Con errores de sintaxis no hay AST, pero sí tokens.
  const s = atender({ codigo: "let = 1", traza: false });
  assert.equal(s.arbol, null);
  assert.equal(s.tokens.length, 3);
});

test("TestLosComandosDelJuegoSoloExistenAlJugar", () => {
  const normal = atender({ codigo: 'mover("este");', traza: false });
  assert.match(normal.errores[0], /identificador no definido: mover/);
  assert.equal(normal.juego, null);

  const juego = atender({ codigo: 'mover("este");\nprint("hola");', traza: false, nivel: "secuencia" });
  assert.deepEqual(juego.errores, []);
  assert.equal(juego.salida, "hola\n");
  assert.equal(juego.juego?.eventos.length, 2);
  assert.equal(juego.juego?.gano, false);
  // Sigue dando tokens y AST, como cualquier programa.
  assert.ok(juego.arbol?.startsWith("Program\n"));
});

test("TestAtenderErrorDeJuegoIndicaEtapaDeEjecucion", () => {
  const r = atender({ codigo: 'mover("norte");\nmover("norte");', traza: false, nivel: "secuencia" });
  assert.equal(r.etapa, "ejecucion");
  assert.match(r.errores[0], /línea 2.*cerca/);
});

test("TestAtenderNivelDesconocido", () => {
  const r = atender({ codigo: "1", traza: false, nivel: "no_existe" });
  assert.match(r.errores[0], /nivel desconocido: no_existe/);
  assert.equal(r.juego, null);
});

test("TestAtenderConTraza", () => {
  const r = atender({ codigo: "let f = function(n) { if (n == 0) { 0 } else { f(n - 1) } }; f(2)", traza: true });
  assert.deepEqual(r.traza, [
    "f(2) → 0",
    "└─ f(1) → 0",
    "   └─ f(0) → 0",
    "3 llamadas · profundidad máxima 3",
  ]);
});
