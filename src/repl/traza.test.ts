import { test } from "node:test";
import assert from "node:assert/strict";
import { ejecutar } from "../interprete";
import { Environment } from "../object/environment";
import { MAX_LLAMADAS_DIBUJADAS, trazar } from "./traza";

// conFuncion crea un entorno donde ya está definido el código dado.
function conFuncion(codigo: string): Environment {
  const env = new Environment(null, () => {});
  assert.deepEqual(ejecutar(codigo, env).errores, []);
  return env;
}

const FIB = "let fib = function(n) { if (n < 2) { return n; } return fib(n - 1) + fib(n - 2); };";

test("TestTrazaArbol", () => {
  const { resultado, lineas } = trazar("fib(3)", conFuncion(FIB));

  assert.equal(resultado.valor?.inspect(), "2");
  assert.deepEqual(lineas, [
    "fib(3) → 2",
    "├─ fib(2) → 1",
    "│  ├─ fib(1) → 1",
    "│  └─ fib(0) → 0",
    "└─ fib(1) → 1",
    "5 llamadas · profundidad máxima 3",
  ]);
});

test("TestTrazaArgumentosYVariasRaices", () => {
  // Los textos (argumentos y resultados) van entre comillas; dos llamadas
  // seguidas son dos raíces.
  const env = conFuncion('let saludar = function(n) { "hola " + n };');
  const { lineas } = trazar('saludar("Kyra"); saludar("Pola")', env);
  assert.deepEqual(lineas, [
    'saludar("Kyra") → "hola Kyra"',
    'saludar("Pola") → "hola Pola"',
    "2 llamadas · profundidad máxima 1",
  ]);
});

test("TestTrazaSinLlamadas", () => {
  assert.deepEqual(trazar("1 + 2", new Environment()).lineas, ["(no hubo llamadas a funciones)"]);
});

test("TestTrazaLimiteDeLineas", () => {
  // fib(10) hace 177 llamadas: se dibujan solo las primeras.
  const { lineas } = trazar("fib(10)", conFuncion(FIB));
  assert.equal(lineas.length, MAX_LLAMADAS_DIBUJADAS + 2);
  assert.equal(lineas.at(-2), `… (se muestran ${MAX_LLAMADAS_DIBUJADAS} de 177 llamadas)`);
  assert.equal(lineas.at(-1), "177 llamadas · profundidad máxima 10");
});

test("TestTrazaConError", () => {
  // El error se ve en cada llamada por la que sube.
  const env = conFuncion("let f = function(n) { if (n == 0) { 1 / 0 } else { f(n - 1) } };");
  const { resultado, lineas } = trazar("f(1)", env);
  assert.deepEqual(lineas, [
    "f(1) → ERROR: división por cero",
    "└─ f(0) → ERROR: división por cero",
    "2 llamadas · profundidad máxima 2",
  ]);
  assert.equal(resultado.errores.length, 1);
});

test("TestTrazaNoQuedaActiva", () => {
  // Después de :traza, el evaluador vuelve a funcionar sin observador.
  const env = conFuncion(FIB);
  trazar("fib(2)", env);
  assert.equal(ejecutar("fib(6)", env).valor?.inspect(), "8");
});
