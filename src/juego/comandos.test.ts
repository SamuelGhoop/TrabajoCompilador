import { test } from "node:test";
import assert from "node:assert/strict";
import { jugar } from "./comandos";
import { COMANDOS } from "./juego";
import { niveles, nivelesParaInterfaz, nivelPorId, type Nivel } from "./niveles";

const nivelDe = (id: string): Nivel => {
  const nivel = nivelPorId(id);
  assert.ok(nivel !== undefined);
  return nivel;
};

const correr = (codigo: string, id = "libre") => {
  let salida = "";
  const partida = jugar(codigo, nivelDe(id), (t) => { salida += t; });
  return { ...partida, salida };
};

// Un nivel de prueba: una tierra y batería de 5 pasos.
const pequeno: Nivel = {
  ...nivelDe("libre"),
  tableros: [{ mapa: ["."], inicio: { fila: 0, columna: 0 } }],
  topePasos: 5,
};

// Cada nivel se comprueba con el intérprete real.
for (const nivel of niveles) {
  test(`la solución de ${nivel.id} gana con todas las estrellas`, () => {
    const { resultado, juego } = jugar(nivel.solucion, nivel, () => {});
    assert.deepEqual(resultado.errores, []);
    assert.equal(juego.gano, true, juego.mensaje);
    assert.equal(juego.estrellas, nivel.meta === null ? 0 : 3, `pasos ${juego.pasos}, líneas ${juego.lineas}`);
  });

  test(`el código inicial de ${nivel.id} corre sin errores del intérprete`, () => {
    const { resultado } = jugar(nivel.codigoInicial, nivel, () => {});
    assert.deepEqual(resultado.errores, []);
  });

  test(`los tableros de ${nivel.id} son rectangulares y Kyra empieza adentro`, () => {
    for (const { mapa, inicio } of nivel.tableros) {
      assert.ok(mapa.every((fila) => fila.length === mapa[0].length));
      const casilla = mapa[inicio.fila]?.[inicio.columna];
      assert.ok(casilla !== undefined && casilla !== "#");
    }
  });
}

test("TestLosIdsDeLosNivelesNoSeRepiten", () => {
  assert.equal(new Set(niveles.map((n) => n.id)).size, niveles.length);
});

test("TestLaInterfazNoRecibeLasSoluciones", () => {
  assert.ok(nivelesParaInterfaz().every((n) => !("solucion" in n)));
});

test("TestLosNombresDeComandosSonIdentificadoresValidos", () => {
  const reservadas = ["sea", "retorna", "devuelva", "funcion", "si", "sino", "mientras", "para", "pilas", "dele", "pa"];
  for (const comando of COMANDOS) {
    assert.match(comando, /^[A-Za-z_]+$/);
    assert.ok(!reservadas.includes(comando));
  }
});

test("TestCadaComandoProduceUnEventoConSuLinea", () => {
  const { juego } = correr('plantar();\n\nmover("este");\nmirar();');
  assert.deepEqual(
    juego.eventos.map((e) => [e.comando, e.linea, e.pasos]),
    [[null, null, 0], ["plantar()", 1, 1], ['mover("este")', 3, 2], ["mirar()", 4, 3]],
  );
  assert.deepEqual(juego.eventos[2].kyra, { fila: 0, columna: 1 });
  assert.equal(juego.eventos[1].tablero[0][0], "b");
});

test("TestLaLineaEsLaDelComandoDentroDeUnaFuncion", () => {
  const { juego } = correr("let f = function() {\n    esperar();\n};\n\nf();");
  assert.equal(juego.eventos[1].linea, 2);
});

test("TestMirarYCosecharDevuelvenTextos", () => {
  const { salida } = correr('print(mirar());\nprint(type(mirar()));', "libre");
  assert.equal(salida, "tierra\nSTRING\n");
});

test("TestErrorDeJuegoMarcaLaLineaYConservaLosEventos", () => {
  const { resultado, juego } = correr('esperar();\nmover("norte");');
  assert.match(resultado.errores[0], /línea 2, columna 6: Kyra chocó con la cerca/);
  assert.equal(juego.gano, false);
  assert.equal(juego.eventos.length, 3);
});

test("TestErrorDeSintaxisNoEjecutaNada", () => {
  const { resultado, juego } = correr("let = 1");
  assert.match(resultado.errores[0], /Error de sintaxis/);
  assert.equal(juego.eventos.length, 1);
});

test("TestCicloInfinitoSeDetieneConLaBateria", () => {
  const { resultado, juego } = jugarPequeno("while (true) {\n    esperar();\n}");
  assert.match(resultado.errores[0], /línea 2.*sin batería/);
  assert.equal(juego.pasos, 5);
  assert.equal(juego.eventos.length, 6); // foto inicial + 5 pasos
});

test("TestComandoBloqueadoDaUnMensajeClaro", () => {
  const { resultado } = correr("plantar();", "funciones");
  assert.match(resultado.errores[0], /Kyra aún no aprende plantar\(\)/);
});

test("TestArgumentosInvalidosNoGastanPaso", () => {
  for (const [codigo, mensaje] of [
    ["mover();", /se esperaban 1, llegaron 0/],
    ["mover(5);", /mover no admite INTEGER/],
    ['mover("arriba");', /dirección desconocida/],
    ["plantar(1);", /se esperaban 0, llegaron 1/],
    ["reportar(1);", /reportar no admite INTEGER/],
    ['reportar({"lechuga": "x"});', /enteros como valores/],
    ['reportar({1: 1});', /textos como claves/],
  ] as const) {
    const { resultado, juego } = correr(codigo);
    assert.match(resultado.errores[0], mensaje);
    assert.equal(juego.eventos.length, 1, codigo);
  }
});

test("TestSinCumplirLaMetaNoSeGana", () => {
  const { resultado, juego } = correr('mover("este");', "secuencia");
  assert.deepEqual(resultado.errores, []);
  assert.equal(juego.gano, false);
  assert.equal(juego.mensaje, "Kyra cosechó 0 de 1.");
});

test("TestConVariosTablerosHayQueGanarTodos", () => {
  // Sirve en el tablero de la lechuga lista, pero en el primero no hay nada.
  const { juego, resultado } = correr("esperar();", "condicionales");
  assert.deepEqual(resultado.errores, []);
  assert.equal(juego.gano, false);
  assert.match(juego.mensaje, /^Tablero 1 de 3/);

  const fijo = correr("cosechar();", "condicionales");
  assert.match(fijo.resultado.errores[0], /nada listo/);
});

test("TestLosEventosDicenDeQueTableroSon", () => {
  const nivel = nivelDe("condicionales");
  const { juego } = jugar(nivel.solucion, nivel, () => {});
  assert.deepEqual([...new Set(juego.eventos.map((e) => e.variante))], [0, 1, 2]);
  assert.equal(juego.eventos.filter((e) => e.comando === null).length, 3);
});

test("TestLasEstrellasDependenDelPar", () => {
  const nivel = nivelDe("secuencia");
  const lento = jugar(nivel.solucion.replace("plantar();", "esperar();\nplantar();"), nivel, () => {});
  assert.equal(lento.juego.gano, true);
  assert.equal(lento.juego.estrellas, 1);
});

test("TestUnaVariableTapaAUnComando", () => {
  const { resultado } = correr("let mirar = 5;\nmirar + 1");
  assert.deepEqual(resultado.errores, []);
});

function jugarPequeno(codigo: string) {
  return jugar(codigo, pequeno, () => {});
}

test("TestPrintDejaUnEventoConLoQueDijoKyra", () => {
  const { juego, salida } = correr(`plantar();\nprint("hola", 1);\nesperar();`);
  assert.equal(salida, "hola 1\n");
  const dichos = juego.eventos.filter((e) => e.dice !== undefined);
  assert.equal(dichos.length, 1);
  assert.equal(dichos[0].dice, "hola 1");
  assert.equal(dichos[0].linea, 2);
  assert.equal(dichos[0].pasos, 1); // hablar no gasta pasos
});

test("TestDigaEnParceTambienHabla", () => {
  const { juego } = correr(`diga("¡qué chimba, parce!");`);
  assert.deepEqual(juego.eventos.map((e) => e.dice).filter(Boolean), ["¡qué chimba, parce!"]);
});

test("TestUnCicloQueImprimeMuchoNoLlenaLosEventos", () => {
  const { juego } = correr(`for (let i = 0; i < 1000; i = i + 1) { print(i); }`);
  assert.ok(juego.eventos.filter((e) => e.dice !== undefined).length <= 100);
});
