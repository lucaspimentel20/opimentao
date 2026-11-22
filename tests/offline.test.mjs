// Testes do modo sem internet: a venda não pode se perder e precisa ir ao banco quando a internet voltar.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

function ambiente() {
  const ls = new Map();
  const banco = []; // o que chegou ao "Supabase"
  let internet = false;
  const falhaRede = () => ({ error: { message: "TypeError: Failed to fetch" } });
  const SB = {
    from: () => ({
      upsert: (linha) => {
        const exec = () => { if (!internet) return falhaRede(); banco.push(["gravar", linha.col, linha.id]); return { error: null, data: { ...linha, atualizado: "2026-11-22T00:00:00Z" } }; };
        // como o supabase-js: só executa quando alguém espera (await/then) — uma vez só
        return { then: (ok, erro) => Promise.resolve().then(exec).then(ok, erro), select: () => ({ single: () => Promise.resolve().then(exec) }) };
      },
      select: () => ({ eq: () => ({ eq: () => ({ single: async () => ({ error: { message: "x" } }) }) }) }),
    }),
    rpc: async (nome, a) => { if (!internet) return falhaRede(); banco.push(["alterar", a.p_col, a.p_id]); return { error: null }; },
  };
  const ctx = vm.createContext({
    console, JSON, Date, Math, Map, Set, Array, Object, String, Number, Promise, Error, RegExp, AbortController,
    setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0,
    addEventListener: () => {}, navigator: { onLine: true },
    localStorage: { getItem: (k) => (ls.has(k) ? ls.get(k) : null), setItem: (k, v) => ls.set(k, String(v)), removeItem: (k) => ls.delete(k) },
    indexedDB: { open: () => { throw new Error("sem idb no teste"); } },
    fetch: async () => { throw new Error("Failed to fetch"); },
    useState: () => [0, () => {}], useEffect: () => {},
  });
  const src = readFileSync(new URL("../src/js/02-conexao-supabase.js", import.meta.url), "utf8");
  vm.runInContext(src + "\n;globalThis.T = { S, gravar, alterar, sincronizar, lerFila, setSB: (x) => { SB = x; }, setMapas: () => { MAPAS = Object.fromEntries(COLS.map((c) => [c, new Map()])); } };", ctx);
  ctx.T.setSB(SB); ctx.T.setMapas();
  return { T: ctx.T, banco, ls, ligar: () => (internet = true), desligar: () => (internet = false) };
}

test("sem internet: a venda é guardada no aparelho e aparece no sistema na hora", async () => {
  const { T, banco, ls } = ambiente();
  await T.gravar("vendas", "V1", { total: 1000 });
  assert.equal(T.lerFila().length, 1);
  assert.equal(T.S.pendentes, 1);
  assert.equal(T.S.vendas.length, 1);            // já aparece (para imprimir o cupom)
  assert.equal(banco.length, 0);
  assert.ok(ls.get("pim_fila").includes("V1"));  // sobrevive se fechar o navegador
});

test("internet volta: envia tudo, na ordem, e esvazia a fila", async () => {
  const { T, banco, ligar } = ambiente();
  await T.gravar("vendas", "V1", { total: 1000 });
  await T.alterar("pedidos", "P1", { status: "fechado" });
  await T.gravar("vendas", "V2", { total: 2000 });
  assert.equal(T.lerFila().length, 3);
  ligar();
  await T.sincronizar();
  assert.equal(JSON.stringify(banco), JSON.stringify([["gravar", "vendas", "V1"], ["alterar", "pedidos", "P1"], ["gravar", "vendas", "V2"]]));
  assert.equal(T.lerFila().length, 0);
  assert.equal(T.S.pendentes, 0);
});

test("com envios pendentes, a próxima venda também entra na fila (não passa na frente)", async () => {
  const { T, banco, ligar } = ambiente();
  await T.gravar("vendas", "V1", { total: 1000 });
  ligar();
  await T.gravar("vendas", "V2", { total: 2000 }); // internet voltou, mas V1 ainda não foi
  assert.equal(T.lerFila().length, 2);
  await T.sincronizar();
  assert.equal(JSON.stringify(banco.map((b) => b[2])), JSON.stringify(["V1", "V2"]));
});

test("internet cai no meio do envio: o que faltou continua guardado", async () => {
  const { T, banco, ligar, desligar } = ambiente();
  await T.gravar("vendas", "V1", {}); await T.gravar("vendas", "V2", {});
  ligar(); desligar();
  await T.sincronizar();
  assert.equal(T.lerFila().length, 2);
  assert.equal(banco.length, 0);
});

test("com internet e fila vazia: grava direto no banco", async () => {
  const { T, banco, ligar } = ambiente();
  ligar();
  await T.gravar("vendas", "V9", { total: 5 });
  assert.equal(T.lerFila().length, 0);
  assert.equal(banco.length, 1);
});
