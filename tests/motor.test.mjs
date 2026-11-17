// Testes do motor de cálculo (estoque PEPS, custo, lucro, caixa, fiado) e das utilidades.
// Rodar: node --test tests/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

// carrega as partes "puras" do sistema (sem tela e sem banco) num ambiente isolado
const parte = (f) => readFileSync(new URL("../src/js/" + f, import.meta.url), "utf8");
const ctx = vm.createContext({ console, Intl, Date, Math, Number, String, Map, Array, Object, JSON, Error });
vm.runInContext(
  [parte("01-utilidades.js"), parte("03-pix-br-code.js"), parte("04-motor-de-calculo.js")].join("\n") +
    "\n;globalThis.M = { reais, paraCentavos, somaTxt, paraGramas, ratearFrete, pixPayload, _crc16, calcular, consumir };",
  ctx
);
const M = ctx.M;

const ontem = new Date(Date.now() - 864e5).toISOString();
const base = () => ({
  produtos: [{ id: "P1", nome: "Pimentão", margem: 30, minimoG: 0, pesoCaixaG: 10000 }],
  fornecedores: [], clientes: [{ id: "C1", nome: "Cliente" }], tiposCaixa: [{ id: "T1", nome: "Plástica", retornavel: true }],
  compras: [{ id: "E1", fornecedorId: "F1", criadoEm: ontem, itens: [{ loteId: "L1", produtoId: "P1", caixas: 10, pesoCaixaG: 10000, custoFinal: 100000, tipos: [{ tipoCaixaId: "T1", caixas: 10 }] }] }],
  conferencias: [], vendas: [], recebimentos: [], movEstoque: [], movCaixa: [],
  sessoes: [{ id: "S1", saldoInicial: 5000 }], movCaixaria: [], chegadas: [], config: [], locais: [], entregas: [], pedidos: [],
});
// cria uma venda do jeito que o caixa grava
const venda = (s, id, { cx = 0, g = 0, total, pagamentos, prazo = 0, status = "confirmada" }) => {
  const r = M.consumir(M.calcular(s), "P1", cx, g, true, false);
  return { id, sessaoId: "S1", clienteId: "C1", criadoEm: new Date().toISOString(), status, subtotal: total, desconto: 0, total, prazo, pagamentos,
    itens: [{ produtoId: "P1", total, custo: r.custo, consumo: r.deltas }] };
};

test("utilidades: dinheiro, peso e somas", () => {
  assert.equal(M.paraCentavos("1.234,56"), 123456);
  assert.equal(M.paraCentavos("R$ 10"), 1000);
  assert.ok(Number.isNaN(M.paraCentavos("abc")));
  assert.equal(M.somaTxt("20+20+5"), 45);
  assert.ok(Number.isNaN(M.somaTxt("20-5")));
  assert.equal(M.paraGramas("1,5"), 1500);
});

test("frete rateado fecha exatamente o total", () => {
  const r = M.ratearFrete([3333, 3333, 3334], 1000);
  assert.equal(r.reduce((a, b) => a + b, 0), 1000);
  assert.equal(JSON.stringify(M.ratearFrete([100, 200], 0)), "[0,0]");
});

test("Pix: código copia e cola com valor e CRC correto", () => {
  const p = M.pixPayload({ chave: "+5591999999999", nome: "O Pimentão", cidade: "Belém", valor: 1234, txid: "V123" });
  assert.match(p, /^000201/);
  assert.ok(p.includes("540512.34"));
  assert.ok(p.includes("O PIMENTAO"));
  assert.equal(p.slice(-4), M._crc16(p.slice(0, -4)));
});

test("entrada gera estoque e custo por caixa e por kg", () => {
  const e = M.calcular(base()).estoque.get("P1");
  assert.equal(e.cx, 10);
  assert.equal(e.custoCx, 100);       // R$ 1.000 / 10 cx
  assert.equal(e.custoKg, 10);        // R$ 100 / 10 kg
  assert.equal(e.valor, 1000);
});

test("venda por caixa baixa o estoque (PEPS) e calcula o custo", () => {
  const s = base();
  s.vendas.push(venda(s, "V1", { cx: 2, total: 30000, pagamentos: [{ forma: "dinheiro", valor: 30000 }] }));
  const c = M.calcular(s);
  assert.equal(c.estoque.get("P1").cx, 8);
  assert.equal(c.custoVenda.get("V1").custo, 200);
  assert.equal(c.divergencias.length, 0);
});

test("PEPS: vende primeiro do lote mais antigo", () => {
  const s = base();
  s.compras.push({ id: "E2", fornecedorId: "F1", criadoEm: new Date().toISOString(), itens: [{ loteId: "L2", produtoId: "P1", caixas: 5, pesoCaixaG: 10000, custoFinal: 75000 }] });
  const r = M.consumir(M.calcular(s), "P1", 12, 0);
  assert.equal(JSON.stringify(r.deltas.map((d) => [d.loteId, d.cx])), JSON.stringify([["L1", -10], ["L2", -2]]));
  assert.equal(r.custo, 10 * 100 + 2 * 150);
});

test("venda em kg abre uma caixa e sobra o resto em kg", () => {
  const s = base();
  s.vendas.push(venda(s, "V1", { g: 3000, total: 4500, pagamentos: [{ forma: "pix", valor: 4500 }] }));
  const e = M.calcular(s).estoque.get("P1");
  assert.equal(e.cx, 9);
  assert.equal(e.g, 7000);
  assert.equal(M.calcular(s).custoVenda.get("V1").custo, 30); // 3 kg × R$ 10
});

test("venda cancelada devolve o estoque, mas a caixa aberta continua aberta", () => {
  const s = base();
  const v = venda(s, "V1", { g: 3000, total: 4500, pagamentos: [{ forma: "dinheiro", valor: 4500 }] });
  v.status = "cancelada"; v.cancelamento = { sessaoId: "S1" };
  s.vendas.push(v);
  const c = M.calcular(s);
  assert.equal(c.estoque.get("P1").cx, 9);
  assert.equal(c.estoque.get("P1").g, 10000);
  assert.equal(c.sess.get("S1").dinheiro, 5000); // entrou e saiu
});

test("estoque insuficiente: bloqueia, ou vira negativo quando permitido", () => {
  const s = base();
  assert.throws(() => M.consumir(M.calcular(s), "P1", 11, 0), /Estoque insuficiente/);
  const r = M.consumir(M.calcular(s), "P1", 11, 0, true, true);
  assert.equal(r.faltou.cx, 1);
});

test("caixa: troco + vendas por forma de pagamento + sangria", () => {
  const s = base();
  s.vendas.push(venda(s, "V1", { cx: 1, total: 15000, pagamentos: [{ forma: "dinheiro", valor: 10000 }, { forma: "credito", valor: 5000 }] }));
  s.movCaixa.push({ sessaoId: "S1", forma: "dinheiro", valor: -3000 });
  const x = M.calcular(s).sess.get("S1");
  assert.equal(x.dinheiro, 5000 + 10000 - 3000);
  assert.equal(x.cartao, 5000);
  assert.equal(x.vendas, 1);
});

test("fiado: recebimento parcial deixa saldo e o cliente deve", () => {
  const s = base();
  s.vendas.push(venda(s, "V1", { cx: 1, total: 15000, prazo: 15000, pagamentos: [] }));
  s.recebimentos.push({ id: "R1", sessaoId: "S1", forma: "pix", valor: 5000, alocacoes: [{ vendaId: "V1", valor: 5000 }] });
  const c = M.calcular(s);
  const t = c.titulos.find((x) => x.vendaId === "V1");
  assert.equal(t.saldo, 10000);
  assert.equal(t.status, "parcial");
  assert.equal(c.clientes.get("C1").deve, 10000);
});

test("caixa fechado: o custo da venda fica congelado no fechamento", () => {
  const s = base();
  s.vendas.push(venda(s, "V1", { cx: 1, total: 15000, pagamentos: [{ forma: "dinheiro", valor: 15000 }] }));
  s.sessoes[0].fechamento = { custos: { V1: { custo: 77, itens: [77] } } };
  s.compras[0].itens[0].custoFinal = 200000; // entrada corrigida depois do fechamento
  assert.equal(M.calcular(s).custoVenda.get("V1").custo, 77);
});

test("divergência: pagamentos que não fecham com o total são apontados", () => {
  const s = base();
  s.vendas.push(venda(s, "V1", { cx: 1, total: 15000, pagamentos: [{ forma: "dinheiro", valor: 14000 }] }));
  assert.ok(M.calcular(s).divergencias.some((d) => /pagamentos não fecham/.test(d)));
});
