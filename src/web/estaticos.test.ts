import { test } from "node:test";
import assert from "node:assert/strict";
import { rutaEstatica } from "./estaticos";

test("sirve el visor 3D, los modelos y three.js", () => {
	assert.deepEqual(rutaEstatica("/3d/huerto3d.js"), { ruta: "web/3d/huerto3d.js", tipo: "text/javascript" });
	assert.deepEqual(rutaEstatica("/3d/modelos/kyra.glb?v=2"), { ruta: "web/3d/modelos/kyra.glb", tipo: "model/gltf-binary" });
	assert.deepEqual(rutaEstatica("/vendor/three/build/three.module.js"), {
		ruta: "node_modules/three/build/three.module.js", tipo: "text/javascript",
	});
});

test("no deja salir de las carpetas públicas", () => {
	assert.equal(rutaEstatica("/3d/../../package.json"), null);
	assert.equal(rutaEstatica("/3d/%2e%2e/%2e%2e/src/main.ts"), null);
	assert.equal(rutaEstatica("/3d/..%5c..%5cpackage.json"), null);
	assert.equal(rutaEstatica("/vendor/three/../../package.json"), null);
});

test("no sirve otras rutas ni otros tipos de archivo", () => {
	assert.equal(rutaEstatica("/src/main.ts"), null);
	assert.equal(rutaEstatica("/3d/notas.txt"), null);
	assert.equal(rutaEstatica("/3d/%E0%A4%A"), null);
});
