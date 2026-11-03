// Pruebas de programas completos.
//
//   tests/validos/X.ssg    programa que debe ejecutarse sin errores
//   tests/errores/X.ssg    programa que debe producir un error
//   X.esperado             la salida esperada de ese programa
//
// La salida es exactamente lo que se ve al correr  npm start -- X.ssg :
// lo que escribe print, y al final el valor del programa o los errores.
//
// Para agregar un caso basta con crear el .ssg y su .esperado: esta prueba
// los encuentra sola. Se ejecutan todas con  npm test .
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { ejecutarArchivo, mostrarValor } from "../src/interprete";
import { Environment } from "../src/object/environment";

// salidaDe ejecuta un programa y devuelve su salida completa y si tuvo errores.
function salidaDe(ruta: string): { salida: string; conErrores: boolean } {
  let salida = "";
  const env = new Environment(null, (t) => (salida += t));
  const resultado = ejecutarArchivo(ruta, env);

  if (resultado.errores.length > 0) {
    salida += resultado.errores.join("\n") + "\n";
  } else {
    const valor = mostrarValor(resultado.valor);
    if (valor !== null) {
      salida += valor + "\n";
    }
  }
  return { salida, conErrores: resultado.errores.length > 0 };
}

// programas devuelve los .ssg de una carpeta, en orden.
function programas(carpeta: string): string[] {
  return readdirSync(carpeta).filter((f) => f.endsWith(".ssg")).sort();
}

// La salida esperada se compara sin importar si el archivo usa saltos de
// línea de Windows (\r\n) o de Unix (\n).
function normalizar(texto: string): string {
  return texto.replace(/\r\n/g, "\n");
}

for (const [carpeta, debeFallar] of [["tests/validos", false], ["tests/errores", true]] as const) {
  for (const archivo of programas(carpeta)) {
    test(`${carpeta}/${archivo}`, () => {
      const ruta = join(carpeta, archivo);
      const rutaEsperado = ruta.replace(/\.ssg$/, ".esperado");
      assert.ok(existsSync(rutaEsperado), `falta el archivo ${rutaEsperado}`);

      const { salida, conErrores } = salidaDe(ruta);
      assert.equal(conErrores, debeFallar, debeFallar ? "debía producir un error" : "no debía producir errores");
      assert.equal(normalizar(salida), normalizar(readFileSync(rutaEsperado, "utf8")));
    });
  }
}

// Cada ejemplo en parce (examples/parce/, generado con "npm run parce") debe
// imprimir EXACTAMENTE lo mismo que su versión original: es el mismo programa
// con otras palabras. Si esta prueba falla después de cambiar un ejemplo,
// hay que volver a correr "npm run parce".
const SOLO_UN_IDIOMA = new Set(["10_espanol.ssg", "11_parce.ssg"]);
for (const archivo of programas("examples").filter((f) => !SOLO_UN_IDIOMA.has(f))) {
  test(`examples/parce/${archivo} imprime lo mismo que examples/${archivo}`, { skip: archivo === "programa.ssg" && "tarda ~30 s" }, () => {
    const rutaParce = join("examples", "parce", archivo);
    assert.ok(existsSync(rutaParce), `falta ${rutaParce}: corra "npm run parce"`);
    assert.equal(salidaDe(rutaParce).salida, salidaDe(join("examples", archivo)).salida);
  });
}

// Los ejemplos de examples/ deben ejecutarse sin errores. programa.ssg (el
// ejemplo del profesor) se omite porque calcula fibonacci(34), que tarda
// cerca de medio minuto (ver "Limitaciones" en docs/DISENO.md).
for (const archivo of programas("examples").filter((f) => f !== "programa.ssg")) {
  test(`examples/${archivo} se ejecuta sin errores`, () => {
    const { salida, conErrores } = salidaDe(join("examples", archivo));
    assert.equal(conErrores, false, salida);
  });
}
