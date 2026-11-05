import { test } from "node:test";
import assert from "node:assert/strict";
import { revisar } from "./revisor";

test("un programa sin errores no marca nada", () => {
	assert.deepEqual(revisar("let x = 1;\nprint(x);"), { error: null, linea: null, columna: null });
});

test("marca la línea y la columna del primer error de sintaxis", () => {
	const r = revisar("let a = 1;\nlet x = (1 + 2;\nlet y = ;");
	assert.equal(r.linea, 2);
	assert.equal(r.columna, 15);
	assert.match(r.error ?? "", /^Error de sintaxis en línea 2, columna 15: se esperaba \)/);
});

test("también marca los errores léxicos", () => {
	const r = revisar("let total = 10 @ 2;");
	assert.equal(r.linea, 1);
	assert.match(r.error ?? "", /^Error léxico/);
});

test("no ejecuta el programa: un error de ejecución no se marca", () => {
	assert.equal(revisar("print(no_existe);").error, null);
});
