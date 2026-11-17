// ============ motor de cálculo ============
function calcular(s) {
  const prod = new Map(s.produtos.map((p) => [p.id, p]));
  const tipos = new Map(s.tiposCaixa.map((t) => [t.id, t]));
  const lotes = [];
  for (const c of s.compras) {
    if (c.status === "cancelada") continue;
    for (const it of c.itens || []) lotes.push({ id: it.loteId, compraId: c.id, fornecedorId: c.fornecedorId, produtoId: it.produtoId, data: c.criadoEm, peso: it.pesoCaixaG, caixas0: it.caixas, custoCx: it.custoFinal / 100 / it.caixas, custoKg: it.custoFinal / 100 / ((it.caixas * it.pesoCaixaG) / 1000), tiposIds: tiposDo(it).map((t) => t.tipoCaixaId), cx: it.caixas, g: 0, vendidoCx: 0, vendidoG: 0, perdaCx: 0, perdaG: 0, ajusteCx: 0, ajusteG: 0 });
  }
  // lote "sem entrada": recebe a venda de produto que ainda não teve entrada (estoque negativo)
  const todosDeltas = [...s.vendas.flatMap((v) => (v.itens || []).flatMap((it) => it.consumo || [])), ...(s.pedidos || []).filter((p) => p.status === "aberto").flatMap((p) => p.consumo || []), ...s.movEstoque.flatMap((m) => m.deltas || [])];
  for (const d of todosDeltas) if (String(d.loteId).startsWith("N-") && !lotes.some((l) => l.id === d.loteId)) { const pid = d.loteId.slice(2); lotes.push({ id: d.loteId, compraId: null, fornecedorId: null, produtoId: pid, data: "0000", peso: prod.get(pid)?.pesoCaixaG || 0, caixas0: 0, custoCx: 0, custoKg: 0, tiposIds: [], cx: 0, g: 0, vendidoCx: 0, vendidoG: 0, perdaCx: 0, perdaG: 0, ajusteCx: 0, ajusteG: 0 }); }
  const L = new Map(lotes.map((l) => [l.id, l]));
  const aplicar = (deltas, tipo) => { for (const d of deltas || []) { const l = L.get(d.loteId); if (!l) continue; l.cx += d.cx || 0; l.g += d.g || 0; if (!d.abre) { if (tipo === "venda") { l.vendidoCx -= d.cx || 0; l.vendidoG -= d.g || 0; } else if (tipo === "desperdicio") { l.perdaCx -= d.cx || 0; l.perdaG -= d.g || 0; } else { l.ajusteCx += d.cx || 0; l.ajusteG += d.g || 0; } } } };
  // venda cancelada: os kg voltam, mas a caixa que foi aberta continua aberta
  for (const v of s.vendas) for (const it of v.itens || []) aplicar(v.status === "cancelada" ? (it.consumo || []).filter((d) => d.abre) : it.consumo, "venda");
  for (const m of s.movEstoque) aplicar(m.deltas, m.tipo);
  // nota em aberto já baixa o estoque (some quando é fechada ou excluída)
  for (const p of s.pedidos || []) if (p.status === "aberto") aplicar(p.consumo, "venda");
  lotes.sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0));
  // lote "sem entrada" usa o custo da primeira entrada real do produto (para o valor do estoque bater)
  for (const l of lotes) if (String(l.id).startsWith("N-")) { const r = lotes.find((x) => x.produtoId === l.produtoId && !String(x.id).startsWith("N-")); if (r) { l.custoCx = r.custoCx; l.custoKg = r.custoKg; } }
  const estoque = new Map();
  for (const p of s.produtos) estoque.set(p.id, { cx: 0, g: 0, totalG: 0, valor: 0, lotes: [], custoCx: null, custoKg: null, tiposCaixa: [] });
  for (const l of lotes) {
    const e = estoque.get(l.produtoId); if (!e) continue;
    e.cx += l.cx; e.g += l.g; e.totalG += l.cx * l.peso + l.g; e.valor += l.cx * l.custoCx + (l.g / 1000) * l.custoKg; e.lotes.push(l);
    e.custoCx = l.custoCx; e.custoKg = l.custoKg;
    for (const t of [...l.tiposIds].reverse()) e.tiposCaixa = [t, ...e.tiposCaixa.filter((x) => x !== t)];
  }
  // perdas 30 dias para preço sugerido
  const lim = new Date(Date.now() - 30 * 864e5).toISOString();
  const perdaCusto = new Map(), saidaCusto = new Map();
  for (const m of s.movEstoque) if (m.tipo === "desperdicio" && m.criadoEm > lim) perdaCusto.set(m.produtoId, (perdaCusto.get(m.produtoId) || 0) + (m.custo || 0));
  for (const v of s.vendas) if (v.status !== "cancelada" && v.criadoEm > lim) for (const it of v.itens) saidaCusto.set(it.produtoId, (saidaCusto.get(it.produtoId) || 0) + (it.custo || 0));
  for (const [id, e] of estoque) {
    const p = prod.get(id); const perda = (perdaCusto.get(id) || 0) / (((perdaCusto.get(id) || 0) + (saidaCusto.get(id) || 0)) || 1);
    const m = (p?.margem ?? 30) / 100;
    const sug = (c) => (c == null || m >= 1 ? null : Math.ceil((c / (1 - Math.min(perda, 0.9)) / (1 - m)) * 100));
    e.perda = perda; e.sugCx = sug(e.custoCx); e.sugKg = sug(e.custoKg);
    e.baixo = (p?.minimoG || 0) > 0 && e.totalG < p.minimoG;
  }
  // contas a receber
  const pago = new Map();
  for (const r of s.recebimentos) if (!r.estorno) for (const a of r.alocacoes || []) pago.set(a.vendaId, (pago.get(a.vendaId) || 0) + a.valor);
  const hoje = hojeISO();
  const titulos = s.vendas.filter((v) => v.status !== "cancelada" && v.prazo > 0).map((v) => {
    const p = pago.get(v.id) || 0; const saldo = v.prazo - p;
    return { vendaId: v.id, clienteId: v.clienteId, valor: v.prazo, pago: p, saldo, venc: v.vencimento, criadoEm: v.criadoEm, status: saldo <= 0 ? "quitado" : p > 0 ? "parcial" : "aberto", vencido: saldo > 0 && !!v.vencimento && v.vencimento < hoje };
  });
  const clientes = new Map(s.clientes.map((c) => [c.id, { deve: 0, vencido: 0, comprou: 0 }]));
  for (const t of titulos) { const c = clientes.get(t.clienteId); if (c) { c.deve += Math.max(0, t.saldo); if (t.vencido) c.vencido += t.saldo; } }
  for (const v of s.vendas) if (v.status !== "cancelada") { const c = clientes.get(v.clienteId); if (c) c.comprou += v.total; }
  // caixaria
  const cxMov = [];
  for (const c of s.compras) if (c.status !== "cancelada") for (const it of c.itens || []) for (const t of tiposDo(it)) if (tipos.get(t.tipoCaixaId)?.retornavel !== false) cxMov.push({ tipoId: t.tipoCaixaId, q: t.caixas, fornecedorId: c.fornecedorId, quando: c.criadoEm, desc: "Chegou do fornecedor", ref: c.id });
  for (const cf of s.conferencias) for (const a of cf.resolucao?.caixaria || []) cxMov.push({ tipoId: a.tipoId, q: a.q, fornecedorId: cf.fornecedorId, quando: cf.resolucao.em, desc: "Correção do recebimento", ref: cf.id });
  for (const v of s.vendas) if (v.status !== "cancelada") for (const it of v.itens) for (const cx of cxDe(it)) cxMov.push({ tipoId: cx.tipoId, q: -cx.q, clienteId: v.clienteId, quando: v.criadoEm, desc: "Saiu com cliente", vendaId: v.id });
  for (const m of s.movCaixaria) cxMov.push({ tipoId: m.tipoId, q: m.q, fornecedorId: m.fornecedorId || null, clienteId: m.clienteId || null, quando: m.criadoEm, desc: { devolvida_fornecedor: "Devolvida ao fornecedor", retorno_cliente: "Cliente devolveu", ajuste: "Ajuste" }[m.tipo], obs: m.obs, por: m.criadoPor });
  // sessões de caixa
  const sess = new Map(s.sessoes.map((x) => [x.id, { dinheiro: x.saldoInicial || 0, pix: 0, cartao: 0, credito: 0, debito: 0, vendas: 0, vendasTotal: 0, prazo: 0, perda: 0 }]));
  const somar = (sid, forma, v) => { const e = sess.get(sid); if (!e) return; if (forma === "credito" || forma === "debito") { e[forma] += v; e.cartao += v; } else if (forma in e) e[forma] += v; };
  for (const v of s.vendas) {
    for (const p of v.pagamentos || []) somar(v.sessaoId, p.forma, p.valor);
    const e = sess.get(v.sessaoId); if (e && v.status !== "cancelada") { e.vendas++; e.vendasTotal += v.total; e.prazo += v.prazo || 0; }
    if (v.status === "cancelada" && v.cancelamento?.sessaoId) for (const p of v.pagamentos || []) somar(v.cancelamento.sessaoId, p.forma, -p.valor);
  }
  for (const r of s.recebimentos) { somar(r.sessaoId, r.forma, r.valor); if (r.estorno?.sessaoId) somar(r.estorno.sessaoId, r.forma, -r.valor); }
  for (const m of s.movCaixa) somar(m.sessaoId, m.forma, m.valor);
  for (const c of s.compras) {
    if (c.fretePagoSessaoId) somar(c.fretePagoSessaoId, "dinheiro", -c.frete);
    if (c.comissaoPagaSessaoId) somar(c.comissaoPagaSessaoId, "dinheiro", -(c.comissao || 0));
    if (c.status === "cancelada" && c.cancelamento?.sessaoId) { if (c.fretePagoSessaoId) somar(c.cancelamento.sessaoId, "dinheiro", c.frete); if (c.comissaoPagaSessaoId) somar(c.cancelamento.sessaoId, "dinheiro", c.comissao || 0); }
  }
  for (const m of s.movEstoque) if (m.tipo === "desperdicio" && m.sessaoId) { const e = sess.get(m.sessaoId); if (e) e.perda += m.custo || 0; }
  // conferência
  const conf = new Map(s.conferencias.map((c) => [c.id, c]));
  const divergencias = [];
  for (const l of lotes) if (l.cx < 0 || l.g < 0) divergencias.push(`Lote ${l.id} de ${prod.get(l.produtoId)?.nome || "?"} ficou negativo (${saldoTxt(l.cx, l.g)})`);
  for (const v of s.vendas) {
    const sub = (v.itens || []).reduce((a, i) => a + i.total, 0);
    if (sub !== v.subtotal) divergencias.push(`Venda ${numVenda(v.id)}: itens não batem com o subtotal`);
    const pg = (v.pagamentos || []).reduce((a, p) => a + p.valor, 0);
    if (pg + (v.prazo || 0) !== v.total) divergencias.push(`Venda ${numVenda(v.id)}: pagamentos não fecham com o total`);
  }
  for (const r of s.recebimentos) { const al = (r.alocacoes || []).reduce((a, x) => a + x.valor, 0); if (al !== r.valor) divergencias.push(`Recebimento ${r.id}: valor não alocado por inteiro`); }
  for (const t of titulos) if (t.saldo < 0) divergencias.push(`Venda ${numVenda(t.vendaId)}: recebido acima do valor a prazo`);
  // custo das vendas: item vendido antes da entrada (estoque negativo) pega o custo da entrada que chegou depois
  const lotesReais = new Map(); for (const l of [...lotes].sort((a, b) => (a.data < b.data ? -1 : 1))) if (!String(l.id).startsWith("N-")) { if (!lotesReais.has(l.produtoId)) lotesReais.set(l.produtoId, []); lotesReais.get(l.produtoId).push(l); }
  const custoVenda = new Map(); const sessoesMap = new Map(s.sessoes.map((x) => [x.id, x]));
  for (const v of s.vendas) {
    // caixa já fechado: o lucro fica como estava no fechamento (não recalcula mais)
    const se = sessoesMap.get(v.sessaoId);
    if (se?.fechamento) {
      const snap = se.fechamento.custos?.[v.id];
      const itensF = (v.itens || []).map((it, k) => ({ produtoId: it.produtoId, custo: snap ? snap.itens?.[k] ?? 0 : it.custo || 0, semCusto: false }));
      custoVenda.set(v.id, { custo: snap ? snap.custo : v.custo || 0, itens: itensF, provisorio: !!snap?.provisorio, congelado: true });
      continue;
    }
    let tot = 0, prov = false; const itens = [];
    for (const it of v.itens || []) {
      // custo sempre pelo valor ATUAL da entrada de cada lote (se a entrada for corrigida, o lucro acompanha)
      const reaisDs = (it.consumo || []).filter((d) => !d.abre && !String(d.loteId).startsWith("N-"));
      const faltaLote = reaisDs.some((d) => !L.get(d.loteId));
      let ci = faltaLote || !(it.consumo || []).length ? it.custo || 0 : reaisDs.reduce((a, d) => { const l = L.get(d.loteId); return a + -(d.cx || 0) * l.custoCx + (-(d.g || 0) / 1000) * l.custoKg; }, 0);
      const ds = (it.consumo || []).filter((d) => String(d.loteId).startsWith("N-") && !d.abre);
      if (ds.length) { const ls = lotesReais.get(it.produtoId) || []; const l = ls.find((x) => x.data > v.criadoEm) || ls[ls.length - 1]; if (l) for (const d of ds) ci += -(d.cx || 0) * l.custoCx + (-(d.g || 0) / 1000) * l.custoKg; else prov = true; }
      itens.push({ produtoId: it.produtoId, custo: ci, semCusto: ds.length > 0 && !(lotesReais.get(it.produtoId) || []).length }); tot += ci;
    }
    custoVenda.set(v.id, { custo: tot, itens, provisorio: prov });
  }
  return { prod, tipos, lotes, L, estoque, titulos, clientes, cxMov, sess, conf, divergencias, custoVenda };
}

// baixa PEPS: devolve deltas e custo (reais) ou erro
function consumir(calc, produtoId, caixas, gramas, abrir = true, negativo = false) {
  const e = calc.estoque.get(produtoId); const nome = calc.prod.get(produtoId)?.nome || "produto";
  const lots = (e?.lotes || []).map((l) => ({ ...l }));
  const deltas = []; let custo = 0;
  let rc = caixas;
  for (const l of lots) { if (rc <= 0) break; const k = Math.min(l.cx, rc); if (k <= 0) continue; deltas.push({ loteId: l.id, cx: -k, g: 0 }); l.cx -= k; rc -= k; custo += k * l.custoCx; }
  // estoque negativo: a falta fica no lote mais novo (ou num lote "sem entrada" se o produto nunca entrou)
  const ultimo = lots[lots.length - 1]; const alvo = ultimo ? ultimo.id : "N-" + produtoId; const faltou = { cx: 0, g: 0 };
  if (rc > 0 && negativo) { deltas.push({ loteId: alvo, cx: -rc, g: 0 }); custo += rc * (ultimo?.custoCx || 0); faltou.cx = rc; rc = 0; }
  if (rc > 0) throw new Error(`Estoque insuficiente de ${nome}: faltam ${rc} cx fechada(s).`);
  let rg = gramas;
  const tirar = (l) => { const t = Math.min(l.g, rg); if (t <= 0) return; deltas.push({ loteId: l.id, cx: 0, g: -t }); l.g -= t; rg -= t; custo += (t / 1000) * l.custoKg; };
  for (const l of lots) { if (rg <= 0) break; tirar(l); }
  if (abrir) for (const l of lots) { while (rg > 0 && l.cx > 0) { deltas.push({ loteId: l.id, cx: -1, g: l.peso, abre: true }); l.cx--; l.g += l.peso; tirar(l); } if (rg <= 0) break; }
  if (rg > 0 && negativo) { deltas.push({ loteId: alvo, cx: 0, g: -rg }); custo += (rg / 1000) * (ultimo?.custoKg || 0); faltou.g = rg; rg = 0; }
  if (rg > 0) throw new Error(`Estoque insuficiente de ${nome}: faltam ${kg(rg)}.`);
  return { deltas, custo, faltou };
}
