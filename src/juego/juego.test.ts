import { test } from "node:test";
import assert from "node:assert/strict";
import * as juego from "./juego";

// Un tablero de una fila: Kyra empieza en la tierra de la izquierda.
const fila = (mapa: string, topePasos = 100) =>
  juego.crearEstado({ mapa: [mapa], inicio: { fila: 0, columna: 0 } }, topePasos);

const errorDe = (accion: juego.Accion): string => {
  assert.equal(accion.ok, false);
  return accion.ok ? "" : accion.error;
};

test("TestMoverCambiaLaPosicionYCuentaUnPaso", () => {
  const e = fila("..");
  assert.deepEqual(juego.mover(e, "este"), { ok: true, valor: null });
  assert.deepEqual(e.kyra, { fila: 0, columna: 1 });
  assert.equal(e.pasos, 1);
});

test("TestMoverChocaConLaCercaYConLosTanques", () => {
  const e = fila(".#");
  assert.match(errorDe(juego.mover(e, "norte")), /cerca del refugio al ir al norte/);
  assert.match(errorDe(juego.mover(e, "oeste")), /cerca/);
  assert.match(errorDe(juego.mover(e, "este")), /tanque/);
  assert.deepEqual(e.kyra, { fila: 0, columna: 0 });
});

test("TestMoverRechazaDireccionesDesconocidasSinGastarPaso", () => {
  const e = fila("..");
  assert.match(errorDe(juego.mover(e, "arriba")), /dirección desconocida/);
  // "constructor" existe en todo objeto de JavaScript: no debe colarse.
  assert.match(errorDe(juego.mover(e, "constructor")), /dirección desconocida/);
  assert.equal(e.pasos, 0);
});

test("TestUnBroteTardaTresCiclosEnEstarListo", () => {
  const e = fila(".");
  juego.plantar(e);
  assert.equal(e.casillas[0][0].tipo, "brote");
  // Justo después de plantar todavía no se puede cosechar.
  juego.esperar(e);
  juego.esperar(e);
  assert.deepEqual(juego.mirar(e), { ok: true, valor: "listo" });
  assert.deepEqual(juego.cosechar(e), { ok: true, valor: "lechuga" });
  assert.equal(e.casillas[0][0].tipo, "tierra");
  assert.equal(juego.totalCosechas(e), 1);
});

test("TestCosecharAlPasoQueTerminaDeCrecerFunciona", () => {
  // Los brotes crecen ANTES de la acción: el tercer paso ya encuentra el
  // cultivo listo.
  const e = fila(".");
  juego.plantar(e);
  juego.esperar(e);
  juego.esperar(e);
  assert.equal(juego.cosechar(e).ok, true);
});

test("TestNoSePuedeCosecharUnBroteVerde", () => {
  const e = fila(".");
  juego.plantar(e);
  assert.match(errorDe(juego.cosechar(e)), /nada listo.*brote/);
});

test("TestSoloSePlantaEnTierra", () => {
  assert.match(errorDe(juego.plantar(fila("_"))), /no se puede plantar.*pasillo/);
  assert.match(errorDe(juego.plantar(fila("L"))), /no se puede plantar.*listo/);
});

test("TestMirarDevuelveElTipoDeLaCasilla", () => {
  assert.deepEqual(juego.mirar(fila("_")), { ok: true, valor: "pasillo" });
  assert.deepEqual(juego.mirar(fila(".")), { ok: true, valor: "tierra" });
  assert.deepEqual(juego.mirar(fila("L")), { ok: true, valor: "listo" });
  assert.deepEqual(juego.mirar(fila("b")), { ok: true, valor: "brote" });
});

test("TestCosecharDevuelveElCultivo", () => {
  const e = fila("T");
  assert.deepEqual(juego.cosechar(e), { ok: true, valor: "tomate" });
  assert.equal(e.cosechas.get("tomate"), 1);
});

test("TestLaBateriaDetieneAKyra", () => {
  const e = fila(".", 2);
  assert.equal(juego.esperar(e).ok, true);
  assert.equal(juego.mirar(e).ok, true);
  assert.match(errorDe(juego.esperar(e)), /sin batería: pasó de 2 pasos/);
  assert.equal(e.pasos, 2);
});

test("TestReportarComparaElInventario", () => {
  const e = fila("LT");
  juego.cosechar(e);
  juego.mover(e, "este");
  juego.cosechar(e);

  assert.match(errorDe(juego.reportar(e, new Map([["lechuga", 1]]))), /dice 0 de tomate, pero Kyra cosechó 1/);
  assert.match(errorDe(juego.reportar(e, new Map([["lechuga", 1], ["tomate", 1], ["yuca", 2]]))), /dice 2 de yuca/);
  assert.equal(e.reportado, false);

  assert.equal(juego.reportar(e, new Map([["lechuga", 1], ["tomate", 1], ["yuca", 0]])).ok, true);
  assert.equal(e.reportado, true);
});

test("TestFaltanteDiceQueFaltaParaLaMeta", () => {
  const e = fila("L");
  assert.equal(juego.faltante(e, null), null);
  assert.equal(juego.faltante(e, { cosechas: 1 }), "Kyra cosechó 0 de 1");
  juego.cosechar(e);
  assert.equal(juego.faltante(e, { cosechas: 1 }), null);
  assert.match(juego.faltante(e, { cosechas: 1, reportar: true }) ?? "", /reportar/);
});

test("TestFotoUsaLasLetrasDeLosMapas", () => {
  const e = juego.crearEstado({ mapa: ["_.#", "btLT"], inicio: { fila: 0, columna: 1 } }, 10);
  assert.deepEqual(juego.foto(e, 0, null, null), {
    variante: 0, comando: null, linea: null,
    tablero: ["_.#", "btLT"], kyra: { fila: 0, columna: 1 }, pasos: 0, cosechas: 0,
  });
  juego.plantar(e);
  const f = juego.foto(e, 2, "plantar()", 7);
  assert.equal(f.tablero[0], "_b#");
  assert.equal(f.comando, "plantar()");
  assert.equal(f.linea, 7);
  assert.equal(f.variante, 2);
  assert.equal(f.pasos, 1);
});

test("TestFotoNoCambiaConLosPasosSiguientes", () => {
  const e = fila("..");
  const antes = juego.foto(e, 0, null, null);
  juego.mover(e, "este");
  assert.deepEqual(antes.kyra, { fila: 0, columna: 0 });
});

test("TestContarLineasIgnoraVaciasYComentarios", () => {
  assert.equal(juego.contarLineas("// hola\n\nmover(\"este\");\n   // otro\r\n  plantar(); // fin\n"), 2);
  assert.equal(juego.contarLineas(""), 0);
});

test("TestCalcularEstrellas", () => {
  const par = { pasos: 10, lineas: 5 };
  assert.equal(juego.calcularEstrellas(par, 11, 6), 1);
  assert.equal(juego.calcularEstrellas(par, 10, 6), 2);
  assert.equal(juego.calcularEstrellas(par, 11, 5), 2);
  assert.equal(juego.calcularEstrellas(par, 10, 5), 3);
  assert.equal(juego.calcularEstrellas(null, 99, 99), 1);
});
