import { test } from "node:test";
import assert from "node:assert/strict";
import { conContexto, ejecutar } from "./interprete";
import { Environment } from "./object/environment";

test("TestConContexto", () => {
  // La flecha queda bajo la columna del error.
  assert.equal(
    conContexto("Error de ejecución en línea 2, columna 9: división por cero", "let a = 1;\nlet b = a / 0;"),
    "Error de ejecución en línea 2, columna 9: división por cero\n" +
    " 2 | let b = a / 0;\n" +
    "   |         ^",
  );

  // Las tabulaciones se copian, para que la flecha quede alineada en pantalla.
  assert.equal(
    conContexto("Error léxico en línea 1, columna 4: carácter no reconocido '@'", "\t\tx@"),
    "Error léxico en línea 1, columna 4: carácter no reconocido '@'\n" +
    " 1 | \t\tx@\n" +
    "   | \t\t ^",
  );

  // El margen crece con el número de la línea.
  const codigo = Array.from({ length: 12 }, () => "x").join("\n");
  assert.equal(
    conContexto("Error de ejecución en línea 12, columna 1: identificador no definido: x", codigo),
    "Error de ejecución en línea 12, columna 1: identificador no definido: x\n" +
    " 12 | x\n" +
    "    | ^",
  );

  // Un mensaje sin posición queda igual.
  assert.equal(conContexto("Error de ejecución: desbordamiento de pila", "x"), "Error de ejecución: desbordamiento de pila");
});

test("TestEjecutarAgregaContexto", () => {
  const { errores, valor } = ejecutar("let x = 1;\nx + true", new Environment());
  assert.equal(valor, null);
  assert.deepEqual(errores, [
    "Error de ejecución en línea 2, columna 3: tipos incompatibles: INTEGER + BOOLEAN\n" +
    " 2 | x + true\n" +
    "   |   ^",
  ]);
});
