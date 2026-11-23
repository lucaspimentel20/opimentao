// ============ CAIXA ============
function AbrirCaixa({ s }) {
  const ocup = s.sessoes.filter((x) => !x.fechamento).map((x) => x.nome);
  const ops = ["Caixa 1", "Caixa 2", "Caixa do gestor"];
  const [nome, setNome] = useState(ops.find((o) => !ocup.includes(o)) || ops[0]);
  const [troco, setTroco] = useState("");
  const [oc, rodar] = useAcao();
  return html`<div class="pag"><h1>Caixa e Vendas</h1><div class="card" style="max-width:460px"><h2>Abrir o caixa</h2>
    <p class="txt">Informe o dinheiro que já está na gaveta (troco).</p>
    <${Campo} r="Qual caixa"><select value=${nome} onChange=${(e) => setNome(e.target.value)}>${ops.map((o) => html`<option value=${o} disabled=${ocup.includes(o)}>${o}${ocup.includes(o) ? " (em uso)" : ""}</option>`)}</select></${Campo}>
    <${Campo} r="Troco inicial (R$)"><input inputmode="decimal" value=${troco} onInput=${(e) => setTroco(e.target.value)} placeholder="0,00"/></${Campo}>
    <button class="btn lg" disabled=${oc || !Number.isFinite(paraCentavos(troco))} onClick=${() => rodar(async () => {
      if (sessaoMinha(S)) throw new Error("Você já tem um caixa aberto.");
      if (S.sessoes.some((x) => !x.fechamento && x.nome === nome)) throw new Error(nome + " já está aberto.");
      await gravar("sessoes", novoId("S"), { nome, operadorId: S.eu, saldoInicial: paraCentavos(troco) || 0, abertoEm: agora() });
    }, "Caixa aberto. Boas vendas!")}>Abrir caixa</button></div></div>`;
}

function Pdv({ s, c, sessao }) {
  const [busca, setBusca] = useState("");
  const [itens, setItens] = useState([]);
  const [ed, setEd] = useState(null);
  const [clienteId, setCliente] = useState("");
  const [escCli, setEscCli] = useState(false); const [bCli, setBCli] = useState("");
  const [desc, setDesc] = useState("");
  const [pagando, setPagando] = useState(false);
  const [f, setF] = useState({ dinheiro: "", pix: "", credito: "", debito: "", prazo: "" });
  const [novoTel, setNovoTel] = useState("");
  const [venc, setVenc] = useState(somaDias(hojeISO(), 30));
  const [entregar, setEntregar] = useState(false); const [endEnt, setEndEnt] = useState(""); const [prevEnt, setPrevEnt] = useState(hojeISO()); const [obsEnt, setObsEnt] = useState("");
  const [chave, setChave] = useState(novoId("V"));
  const [oc, rodar] = useAcao();
  const cliente = s.clientes.find((x) => x.id === clienteId) || null;
  // meia caixa: vende pelo preço de ½ cx, mas o estoque baixa em kg (metade do peso da caixa)
  const pesoMeia = (pid) => Math.round((c.prod.get(pid)?.pesoCaixaG || 0) / 2);
  const qtds = (i) => {
    // aceita "2,5" = 2 caixas + meia caixa (a meia baixa em kg)
    if (i.unidade === "cx" && !i.meia) { const n = Number(String(i.qtd ?? "").replace(",", ".")); if (!(n > 0) || !Number.isInteger(n * 2)) return { caixas: NaN, gramas: 0 }; const inteiras = Math.floor(n), meia = n - inteiras > 0 ? 1 : 0; if (meia && !pesoMeia(i.produtoId)) return { caixas: NaN, gramas: 0 }; return { caixas: inteiras, gramas: meia * pesoMeia(i.produtoId), meias: meia }; }
    if (i.unidade === "cx" && i.meia) { const n = Number(i.qtd); const ok = Number.isInteger(n) && n > 0 && pesoMeia(i.produtoId) > 0; return { caixas: 0, gramas: ok ? n * pesoMeia(i.produtoId) : NaN, meias: ok ? n : NaN }; }
    return { caixas: 0, gramas: paraGramas(i.qtd) };
  };
  // meia caixa = metade do preço da caixa, arredondada para cima no real (85,00 → 43,00)
  const meiaDe = (p) => (Number.isFinite(p) && p > 0 ? Math.ceil(p / 2 / 100) * 100 : p);
  const precoUn = (i) => { const p = paraCentavos(i.preco); return i.unidade === "cx" && i.meia ? meiaDe(p) : p; };
  const totI = (i) => { const q = qtds(i); const p = paraCentavos(i.preco); if (![q.caixas, q.gramas, p].every(Number.isFinite)) return NaN;
    if (i.unidade === "cx" && i.meia) return q.meias * meiaDe(p);
    if (i.unidade === "cx") return q.caixas * p + (q.meias ? meiaDe(p) : 0);
    return totalItem("kg", 0, q.gramas, p); };
  // caixas vazias: lista registrada (Enter) + o que está digitado agora
  const pendOk = (i) => !!i.tipo && Number.isInteger(Number(i.cxq)) && Number(i.cxq) > 0;
  const listaCx = (i) => { const m = new Map(); for (const x of [...(i.cxs || []), ...(pendOk(i) ? [{ tipo: i.tipo, q: Number(i.cxq) }] : [])]) m.set(x.tipo, (m.get(x.tipo) || 0) + x.q); return [...m].map(([tipoId, q]) => ({ tipoId, q })); };
  const cxOk = (i) => !i.vai || (listaCx(i).length > 0 && (!i.cxq || pendOk(i)));
  const registrarCx = () => { if (!pendOk(ed)) return; setEd({ ...ed, cxs: [...(ed.cxs || []), { tipo: ed.tipo, q: Number(ed.cxq) }], tipo: "", cxq: "" }); };
  const subtotal = itens.reduce((a, i) => a + (totI(i) || 0), 0);
  const dc = paraCentavos(desc) || 0; const total = Math.max(0, subtotal - dc);
  const pix = paraCentavos(f.pix) || 0, credito = paraCentavos(f.credito) || 0, debito = paraCentavos(f.debito) || 0, cartao = credito + debito, prazo = paraCentavos(f.prazo) || 0, rec = paraCentavos(f.dinheiro) || 0;
  const din = Math.max(0, Math.min(rec, total - pix - cartao - prazo)); const troco = Math.max(0, rec - din); const falta = total - pix - cartao - prazo - din;
  const prods = s.produtos.filter((p) => p.ativo !== false && p.nome.toLowerCase().includes(busca.trim().toLowerCase())).sort((a, b) => a.nome.localeCompare(b.nome));
  const tiposRet = s.tiposCaixa.filter((t) => t.retornavel !== false && t.ativo !== false);
  const gestor = papelDe(s) === "gestor";
  const tiposDaEntrada = (pid) => {
    const e = c.estoque.get(pid); if (!e) return [];
    const ret = (ids) => [...new Set(ids)].map((id) => tiposRet.find((t) => t.id === id)).filter(Boolean);
    const comEstoque = ret(e.lotes.filter((l) => l.cx > 0 || l.g > 0).flatMap((l) => [...(l.tiposIds || [])].reverse()));
    return comEstoque.length ? comEstoque : ret(e.tiposCaixa || []);
  };
  const abrir = (p) => { const u = p.precoCx > 0 || !p.precoKg ? "cx" : "kg"; const t = tiposDaEntrada(p.id)[0]?.id; setEd({ k: novoId("I"), produtoId: p.id, nome: p.nome, unidade: u, qtd: u === "cx" ? "1" : "", preco: txtReais(u === "cx" ? p.precoCx : p.precoKg), vai: false, tipo: t || "", cxq: "" }); };
  const trocaU = (u) => { const p = c.prod.get(ed.produtoId); setEd({ ...ed, unidade: u, meia: false, qtd: u === "cx" ? "1" : "", preco: txtReais(u === "cx" ? p.precoCx : p.precoKg) }); };
  const edOk = ed && Number.isFinite(totI(ed)) && totI(ed) >= 0 && cxOk(ed);
  const semPreco = itens.filter((i) => !(totI(i) > 0)).length;
  const tudo = (k) => setF({ dinheiro: "", pix: "", credito: "", debito: "", prazo: "", [k]: txtReais(total) || "0" });
  const [pedidoId, setPedidoId] = useState(null); const [verAbertas, setVerAbertas] = useState(false);
  const abertas = s.pedidos.filter((x) => x.status === "aberto").sort((a, b) => (a.atualizadoEm < b.atualizadoEm ? 1 : -1));
  const totPedido = (x) => Math.max(0, (x.itens || []).reduce((a, i) => a + (totI(i) || 0), 0) - (x.desconto || 0));
  const salvarAberto = () => rodar(async () => {
    if (!cliente) throw new Error("Para salvar nota em aberto, escolha o cliente.");
    const id = pedidoId || novoId("N"); const antes = s.pedidos.find((x) => x.id === id);
    // baixa o estoque já na nota em aberto (pode ficar negativo); ao salvar de novo, recalcula sem a baixa anterior
    const calcN = calcular({ ...S, pedidos: S.pedidos.filter((x) => x.id !== id) });
    const temp = { ...calcN, estoque: new Map([...calcN.estoque].map(([k, e]) => [k, { ...e, lotes: e.lotes.map((l) => ({ ...l })) }])) };
    const consumo = []; const negativos = [];
    for (const i of itens) {
      const q = qtds(i); if (!(q.caixas > 0 || q.gramas > 0)) continue;
      const r = consumir(temp, i.produtoId, q.caixas || 0, q.gramas || 0, true, true);
      if (r.faltou.cx || r.faltou.g) negativos.push(`${i.nome} (${saldoTxt(r.faltou.cx, r.faltou.g)})`);
      let e = temp.estoque.get(i.produtoId); if (!e) { e = { cx: 0, g: 0, totalG: 0, lotes: [] }; temp.estoque.set(i.produtoId, e); }
      for (const d of r.deltas) { let l = e.lotes.find((x) => x.id === d.loteId); if (!l) { l = { id: d.loteId, cx: 0, g: 0, peso: c.prod.get(i.produtoId)?.pesoCaixaG || 0, custoCx: 0, custoKg: 0 }; e.lotes.push(l); } l.cx += d.cx || 0; l.g += d.g || 0; }
      consumo.push(...r.deltas.map((d) => ({ ...d, produtoId: i.produtoId })));
    }
    if (negativos.length) setTimeout(() => toast("Atenção: estoque ficou NEGATIVO em " + negativos.join(", ") + ".", true), 400);
    await gravar("pedidos", id, { clienteId: cliente.id, itens: itens.map((i) => ({ ...i })), consumo, desconto: dc, status: "aberto", criadoPor: antes?.criadoPor || S.eu, criadoEm: antes?.criadoEm || agora(), atualizadoEm: agora(), atualizadoPor: S.eu });
    { const cfg = impConfig(); if (cfg.auto && cfg.despacho) imprimirDespacho(despachoDe(itens, cliente.id), c); }
    limpar();
  }, "Nota em aberto salva");
  const abrirPedido = (x) => {
    setItens((x.itens || []).map((i) => ({ ...i }))); setCliente(x.clienteId); setDesc(x.desconto ? txtReais(x.desconto) : ""); setPedidoId(x.id); setVerAbertas(false); setChave(novoId("V"));
    if (x.pagamentosAnteriores || x.prazoAnterior) { const n = { dinheiro: "", pix: "", credito: "", debito: "", prazo: "" }; for (const p of x.pagamentosAnteriores || []) { const k = p.forma === "cartao" ? "credito" : p.forma; n[k] = txtReais((paraCentavos(n[k]) || 0) + p.valor); } if (x.prazoAnterior) n.prazo = txtReais(x.prazoAnterior); setF(n); }
    if (x.entregaAnterior) { setEntregar(true); setEndEnt(x.entregaAnterior.endereco || ""); }
  };
  // nota reaberta pelo comprovante: abre sozinha ao chegar no caixa
  useEffect(() => { const id = S.abrirPedido; if (!id) return; const x = s.pedidos.find((k) => k.id === id); if (x) { S.abrirPedido = null; abrirPedido(x); } }, [s.pedidos.length]);
  const excluirPedido = (x) => rodar(async () => { if (!confirm("Excluir a nota em aberto de " + (s.clientes.find((k) => k.id === x.clienteId)?.nome || "cliente") + "?")) return; await alterar("pedidos", x.id, { status: "cancelado", canceladoPor: S.eu, canceladoEm: agora() }); if (pedidoId === x.id) limpar(); }, "Nota em aberto excluída");
  const limpar = () => { setPedidoId(null); setItens([]); setDesc(""); setF({ dinheiro: "", pix: "", credito: "", debito: "", prazo: "" }); setCliente(""); setChave(novoId("V")); setPagando(false); setEntregar(false); setEndEnt(""); setObsEnt(""); setPrevEnt(hojeISO()); };
  const levaCaixa = itens.some((i) => i.vai);
  const nomeT = (id) => c.tipos.get(id)?.nome || "";
  const concluir = () => rodar(async () => {
    if (!S.sessoes.find((x) => x.id === sessao.id && !x.fechamento)) throw new Error("Seu caixa foi fechado.");
    if (prazo > 0 && !cliente) throw new Error("Venda fiado precisa do nome do cliente.");
    if (levaCaixa && !cliente) throw new Error("Para o cliente levar caixa, escolha o cliente da venda.");
    if (entregar && !cliente) throw new Error("Para entregar, escolha o cliente da venda.");
    if (!gestor && dc > subtotal * 0.05) throw new Error("Desconto acima de 5%: só o gestor pode dar.");
    if (semPreco) throw new Error("Tem item sem preço. Coloque o preço ou salve como nota em aberto.");
    if (falta !== 0) throw new Error("Os pagamentos não fecham com o total.");
    const calcAgora = calcular(pedidoId ? { ...S, pedidos: S.pedidos.filter((x) => x.id !== pedidoId) } : S); let custoT = 0; const negativos = [];
    // baixa sequencial considerando itens anteriores do mesmo produto
    const corpo = [];
    const temp = { ...calcAgora, estoque: new Map([...calcAgora.estoque].map(([k, e]) => [k, { ...e, lotes: e.lotes.map((l) => ({ ...l })) }])) };
    for (const i of itens) {
      const q = qtds(i);
      const { deltas, custo, faltou } = consumir(temp, i.produtoId, q.caixas, q.gramas, true, true);
      if (faltou.cx || faltou.g) negativos.push(`${i.nome} (${saldoTxt(faltou.cx, faltou.g)})`);
      let e = temp.estoque.get(i.produtoId); if (!e) { e = { cx: 0, g: 0, totalG: 0, lotes: [] }; temp.estoque.set(i.produtoId, e); }
      for (const d of deltas) { let l = e.lotes.find((x) => x.id === d.loteId); if (!l) { l = { id: d.loteId, cx: 0, g: 0, peso: c.prod.get(i.produtoId)?.pesoCaixaG || 0, custoCx: 0, custoKg: 0 }; e.lotes.push(l); } l.cx += d.cx || 0; l.g += d.g || 0; }
      custoT += custo;
      corpo.push({ produtoId: i.produtoId, unidade: i.meia && i.unidade === "cx" ? "meia" : i.unidade, caixas: q.caixas, gramas: q.gramas, ...(q.meias ? { meias: q.meias } : {}), preco: precoUn(i), total: totI(i), custo: Number(custo.toFixed(4)), consumo: deltas, caixaria: i.vai && listaCx(i).length ? listaCx(i) : null });
    }
    const pagamentos = [["dinheiro", din], ["pix", pix], ["credito", credito], ["debito", debito]].filter(([, v]) => v > 0).map(([forma, valor]) => ({ forma, valor }));
    // nota reaberta volta para o mesmo caixa do dia em que foi feita (se ele ainda estiver aberto)
    const pedAtual = pedidoId ? S.pedidos.find((x) => x.id === pedidoId) : null;
    const sessaoVenda = pedAtual?.sessaoOrigem && S.sessoes.some((x) => x.id === pedAtual.sessaoOrigem && !x.fechamento) ? pedAtual.sessaoOrigem : sessao.id;
    await gravar("vendas", chave, { clienteId: cliente ? cliente.id : "", sessaoId: sessaoVenda, operadorId: S.eu, itens: corpo, subtotal, desconto: dc, total, pagamentos, prazo, vencimento: null, custo: Number(custoT.toFixed(4)), entrega: entregar ? { endereco: endEnt.trim(), previsao: null, obs: "" } : null, status: "confirmada", criadoEm: agora() });
    if (pedidoId) {
      await alterar("pedidos", pedidoId, { status: "fechado", vendaId: chave, fechadoEm: agora(), fechadoPor: S.eu });
      // nota que veio de uma venda reaberta: as entregas já feitas passam para a venda nova
      const ped = S.pedidos.find((x) => x.id === pedidoId);
      if (ped?.vendaOrigem) for (const e of S.entregas.filter((x) => x.vendaId === ped.vendaOrigem && x.status !== "cancelada")) await alterar("entregas", e.id, { vendaId: chave, vendaAnterior: ped.vendaOrigem });
    }
    const id = chave; limpar(); S.imprimirVenda = id; location.hash = "venda-" + id;
    if (negativos.length) setTimeout(() => toast("Atenção: estoque ficou NEGATIVO em " + negativos.join(", ") + ". Confira a entrada desses produtos.", true), 400);
  }, troco > 0 ? `Venda concluída. Troco ${reais(troco)}` : "Venda concluída");
  // ===== atalhos de teclado =====
  const focoBusca = () => setTimeout(() => { const b = document.getElementById("busca-prod"); if (b) { b.focus(); b.select(); } }, 60);
  const addItem = () => { if (!edOk) return; setItens(itens.some((x) => x.k === ed.k) ? itens.map((x) => (x.k === ed.k ? ed : x)) : [...itens, ed]); setEd(null); setBusca(""); focoBusca(); };
  const enterAdd = (e) => { if (e.key === "Enter") { e.preventDefault(); addItem(); } };
  const podeReceber = itens.length && total > 0 && !semPreco;
  // quanto de cada produto está em notas em aberto (já descontado do estoque mostrado)
  const reservado = useMemo(() => { const m = new Map(); for (const p of s.pedidos) if (p.status === "aberto" && p.id !== pedidoId) for (const d of p.consumo || []) { if (d.abre || !d.produtoId) continue; const r = m.get(d.produtoId) || { cx: 0, g: 0 }; r.cx -= d.cx || 0; r.g -= d.g || 0; m.set(d.produtoId, r); } for (const [k, r] of m) if (r.cx <= 0 && r.g <= 0) m.delete(k); return m; }, [s.pedidos, pedidoId]);
  useEffect(() => { S.vendendo = itens.length > 0; if (!itens.length && S.novaVersao) verificarVersao(); return () => { S.vendendo = false; }; }, [itens.length]);
  // nota de despacho do jeito que está, SEM fechar a venda (pode ter item sem preço; não mexe em estoque, caixa nem fiado)
  const despachoDe = (lista, clienteId) => ({ clienteId: clienteId || "", criadoEm: new Date().toISOString(), itens: lista.map((i) => {
      const q = qtds(i);
      const caixaria = i.vai ? listaCx(i) : [];
      const base = { produtoId: i.produtoId, ...(caixaria.length ? { caixaria } : {}) };
      if (i.unidade === "cx" && i.meia) return { ...base, unidade: "meia", meias: Number(String(i.qtd).replace(",", ".")) || 1 };
      if (i.unidade === "cx") return { ...base, unidade: "cx", caixas: Number.isFinite(q.caixas) ? q.caixas : 0, meias: q.meias || 0 };
      return { ...base, unidade: "kg", gramas: q.gramas || 0 };
    }) });
  const imprimirConta = () => { if (itens.length) imprimirDespacho(despachoDe(itens, cliente?.id), c); };
  const at = useMemo(() => ({}), []);
  at.f = (e) => {
    if (e.key === "F2") { e.preventDefault(); if (!ed && !pagando && podeReceber) { setPagando(true); if (!f.dinheiro && !f.pix && !f.credito && !f.debito && !f.prazo) tudo("dinheiro"); } }
    else if (e.key === "F3") { e.preventDefault(); if (!ed && !pagando) focoBusca(); }
    else if (e.key === "F8") { e.preventDefault(); if (!ed && itens.length) imprimirConta(); }
    else if (e.key === "F4") { e.preventDefault(); if (!ed && !pagando && itens.length) (cliente ? salvarAberto() : (toast("Escolha o cliente para salvar a nota em aberto.", true), setEscCli(true))); }
    else if (e.key === "Enter" && pagando && !escCli && e.target?.tagName !== "BUTTON" && falta === 0 && !oc && !semPreco) { e.preventDefault(); concluir(); }
  };
  useEffect(() => { const h = (e) => at.f(e); addEventListener("keydown", h); return () => removeEventListener("keydown", h); }, []);
  useEffect(() => { focoBusca(); }, []);
  const tiposProd = ed ? tiposDaEntrada(ed.produtoId) : [];
  // só os tipos que vieram na entrada deste produto; sem entrada com tipo, mostra todos
  const opcoesCx = tiposProd.length ? tiposProd : tiposRet;
  const clis = s.clientes.filter((x) => x.ativo !== false && (`${x.nome} ${x.telefone || ""}`).toLowerCase().includes(bCli.trim().toLowerCase())).slice(0, 40);
  return html`<div class="pdv">
    <section style="display:flex;flex-direction:column;gap:10px;min-width:0">
      <button class=${"btn " + (abertas.length ? "" : "out")} style="justify-content:space-between" onClick=${() => setVerAbertas(!verAbertas)}><span>📝 Notas em aberto (${abertas.length})</span><span>${verAbertas ? "▲" : "▼"}</span></button>
      ${verAbertas ? html`<div class="card" style="gap:6px">${abertas.length ? html`<div class="tab"><table><thead><tr><th>Cliente</th><th>Itens</th><th class="r">Total</th><th>Última mudança</th><th></th></tr></thead><tbody>${abertas.map((x) => html`<tr style=${pedidoId === x.id ? "background:var(--sec)" : ""}><td><b>${s.clientes.find((k) => k.id === x.clienteId)?.nome || "—"}</b></td><td><small>${(x.itens || []).map((i) => i.nome + " " + (i.unidade === "cx" ? (i.meia ? meiaTxt(i.qtd) : i.qtd + " cx") : i.qtd + " kg")).join(", ")}</small></td><td class="r">${totPedido(x) ? reais(totPedido(x)) : "Sem preço"}</td><td><small>${dataHora(x.atualizadoEm)} · ${nomePessoa(s, x.atualizadoPor)}</small></td><td style="white-space:nowrap"><button class="btn sm" onClick=${() => abrirPedido(x)}>Abrir</button> <button class="btn out sm" title="Nota de despacho" onClick=${() => imprimirDespacho(despachoDe(x.itens || [], x.clienteId), c)}>📦 Despacho</button> <button class="btn ghost sm" onClick=${() => excluirPedido(x)}>Excluir</button></td></tr>`)}</tbody></table></div>` : html`<${Vazio}>Nenhuma nota em aberto.</${Vazio}>`}</div>` : null}
      <input id="busca-prod" placeholder="🔎 Buscar produto   (F3 · Enter abre o primeiro)" value=${busca} onInput=${(e) => setBusca(e.target.value)} onKeyDown=${(e) => { if (e.key === "Enter" && prods.length) { e.preventDefault(); const t = busca.trim().toLowerCase(); abrir(prods.find((p) => p.nome.toLowerCase().startsWith(t)) || prods[0]); } }} style="min-height:48px"/>
      ${prods.length ? html`<div class="prods">${prods.map((p) => { const e = c.estoque.get(p.id); return html`<div style="position:relative"><button style="width:100%;height:100%" class=${"prod " + (e && e.totalG > 0 ? "" : "sem")} onClick=${() => abrir(p)}><b>${p.nome}</b><span class="p">${p.precoCx ? reais(p.precoCx) + "/cx " : ""}${p.precoKg ? reais(p.precoKg) + "/kg" : ""}${!p.precoCx && !p.precoKg ? "Sem preço" : ""}</span><small>${e && e.totalG > 0 ? saldoTxt(e.cx, e.g) : "Sem estoque"}</small>${reservado.get(p.id) ? html`<small style="color:var(--warn);font-weight:700">📝 ${saldoTxt(reservado.get(p.id).cx, reservado.get(p.id).g)} em notas abertas</small>` : null}</button></div>`; })}</div>` : html`<${Vazio}>Nenhum produto. O gestor cadastra em Configurações.</${Vazio}>`}
    </section>
    <section class="card carr">
      ${pedidoId ? html`<div class="lin" style="background:#FFF1DA;border-radius:10px;padding:6px 10px"><small><b>Nota em aberto</b> — continue colocando itens ou receba para fechar.</small><button class="btn ghost sm" onClick=${limpar}>Sair</button></div>` : null}
      <button class="cli" onClick=${() => setEscCli(true)}><span style="flex:1"><b>${cliente ? cliente.nome : "Consumidor não identificado"}</b>${cliente && c.clientes.get(cliente.id)?.deve > 0 ? html`<small>Deve ${reais(c.clientes.get(cliente.id).deve)}</small>` : null}</span><span class="link">Trocar</span></button>
      ${itens.length ? html`<div>${itens.map((i) => html`<div class="it"><button class="c" onClick=${() => setEd(i)}><b>${i.nome}</b><small>${i.unidade === "cx" && i.meia ? meiaTxt(i.qtd) + " × " + reais(precoUn(i)) : i.unidade === "cx" ? (qtds(i).meias ? qtds(i).caixas + " cx + ½ cx" : i.qtd + " cx") + " × " + reais(paraCentavos(i.preco)) + (qtds(i).meias ? " (½ = " + reais(meiaDe(paraCentavos(i.preco))) + ")" : "") : kg(paraGramas(i.qtd)) + " × " + reais(paraCentavos(i.preco))}</small>${i.vai && listaCx(i).length ? html`<em>+ leva ${listaCx(i).map((x) => x.q + " " + nomeT(x.tipoId)).join(" + ")} caixa(s)</em>` : null}</button><b>${reais(totI(i))}</b><button class="btn ghost" aria-label="Tirar" onClick=${() => setItens(itens.filter((x) => x.k !== i.k))}>🗑</button></div>`)}</div>` : html`<p class="txt">Toque num produto para começar.</p>`}
      <div class="lin"><span>Subtotal</span><b>${reais(subtotal)}</b></div>
      <div class="lin"><span>Desconto</span><input inputmode="decimal" placeholder="0,00" value=${desc} onInput=${(e) => setDesc(e.target.value)} style="width:120px;text-align:right"/></div>
      <div class="tot"><span>Total</span><span>${reais(total)}</span></div>
      ${semPreco ? html`<p class="av" style="margin:0">${semPreco} item(ns) sem preço: coloque o preço para receber, ou salve como nota em aberto.</p>` : null}
      <button class="btn lg" disabled=${!itens.length || total <= 0 || semPreco > 0} onClick=${() => { setPagando(true); if (!f.dinheiro && !f.pix && !f.credito && !f.debito && !f.prazo) tudo("dinheiro"); }}>Receber ${reais(total)}<span class="tecla">F2</span></button>
      ${itens.length ? html`<button class="btn out" onClick=${imprimirConta}>📦 Nota de despacho (sem fechar)<span class="tecla">F8</span></button>` : null}
      ${itens.length ? html`<button class="btn out" disabled=${oc} onClick=${() => (cliente ? salvarAberto() : (toast("Escolha o cliente para salvar a nota em aberto.", true), setEscCli(true)))}>📝 ${pedidoId ? "Salvar alterações da nota em aberto" : "Salvar como nota em aberto"}<span class="tecla">F4</span></button>` : null}
      ${itens.length ? html`<button class="btn ghost" onClick=${limpar}>${pedidoId ? "Fechar sem salvar" : "Limpar venda"}</button>` : null}
    </section>

    ${ed ? html`<${Modal} titulo=${ed.nome} onFechar=${() => setEd(null)} rod=${html`<button class="btn out" tabindex="-1" onClick=${() => { setEd(null); focoBusca(); }}>Cancelar<span class="tecla">Esc</span></button><button class="btn" disabled=${!edOk} onClick=${addItem}>${itens.some((x) => x.k === ed.k) ? "Atualizar" : "Adicionar"}<span class="tecla">Enter</span></button>`}>
      <div class="seg"><button tabindex="-1" class=${ed.unidade === "cx" ? "on" : ""} onClick=${() => trocaU("cx")}>Caixa</button><button tabindex="-1" class=${ed.unidade === "kg" ? "on" : ""} onClick=${() => trocaU("kg")}>Quilo</button></div>
      <${Campo} r=${html`${ed.unidade === "cx" ? (ed.meia ? "Quantas meias caixas" : "Quantas caixas") : "Peso em kg"}<span class="tecla">TAB → preço</span>`} d=${"Em estoque: " + saldoTxt(c.estoque.get(ed.produtoId)?.cx || 0, c.estoque.get(ed.produtoId)?.g || 0)}><input class="big" autofocus ref=${(el) => { if (el && !el._foc) { el._foc = 1; setTimeout(() => { el.focus(); el.select(); }, 30); } }} onFocus=${(e) => e.target.select()} onKeyDown=${enterAdd} inputmode="decimal" value=${ed.qtd} onInput=${(e) => setEd({ ...ed, qtd: e.target.value })} placeholder=${ed.unidade === "kg" ? "0,000" : "1"}/>${ed.unidade === "cx" && !ed.meia && /[.,]5$/.test(String(ed.qtd).trim()) && Number.isFinite(qtds(ed).caixas) ? html`<i style="font-style:normal;font-weight:800;color:var(--pri)">= ${qtds(ed).caixas} cx + ½ cx (${kg(qtds(ed).gramas)})</i>` : ed.unidade === "cx" && !ed.meia && ed.qtd && !Number.isFinite(qtds(ed).caixas) ? html`<i style="font-style:normal;color:var(--err)">Use caixas inteiras ou ,5 (ex.: 2 ou 2,5)</i>` : null}</${Campo}>
      ${(() => { const q = qtds(ed); const e = c.estoque.get(ed.produtoId) || { cx: 0, totalG: 0 }; const pc = c.prod.get(ed.produtoId)?.pesoCaixaG || 0; const falta = q.caixas > e.cx || (q.caixas || 0) * pc + (q.gramas || 0) > e.totalG; return falta ? html`<p class="av" style="background:#FFF1DA;border-radius:10px;padding:8px 12px">⚠ Estoque insuficiente: o estoque deste produto vai ficar negativo. A venda é permitida, mas confira a entrada.</p>` : null; })()}
      ${ed.unidade === "cx" ? html`<label class="chk" style=${"border:2px solid " + (ed.meia ? "var(--pri)" : "var(--border)") + ";border-radius:12px;padding:6px 12px;background:" + (ed.meia ? "var(--sec)" : "transparent")}><input type="checkbox" tabindex="-1" checked=${!!ed.meia} disabled=${!pesoMeia(ed.produtoId)} onChange=${(e) => setEd({ ...ed, meia: e.target.checked })}/><span>Meia caixa${pesoMeia(ed.produtoId) ? html`<small class="txt" style="display:block">O preço da caixa é dividido por 2. Cada meia caixa = ${kg(pesoMeia(ed.produtoId))}.</small>${ed.meia && Number(ed.qtd) > 0 ? html`<small style="display:block;font-weight:800">${ed.qtd} meia(s) caixa(s) = sai ${kg(pesoMeia(ed.produtoId) * Number(ed.qtd))} do estoque${pesoMeia(ed.produtoId) * Number(ed.qtd) > (c.estoque.get(ed.produtoId)?.totalG || 0) ? html` <span style="color:var(--err)">— mais do que tem em estoque! Confira a quantidade.</span>` : ""}</small>` : null}` : html` <small class="txt">— cadastre o peso da caixa do produto</small>`}</span></label>` : null}
      <${Campo} r=${html`${"Preço por " + (ed.unidade === "cx" ? "caixa" : "kg") + " (R$)"}<span class="tecla">Enter adiciona</span>`} d=${ed.unidade === "cx" && ed.meia && paraCentavos(ed.preco) > 0 ? "Meia caixa sai por " + reais(meiaDe(paraCentavos(ed.preco))) : !paraCentavos(ed.preco) ? "Sem preço, o item só pode ir para nota em aberto" : ""}><input inputmode="decimal" placeholder="Digite o preço" onFocus=${(e) => e.target.select()} onKeyDown=${enterAdd} value=${ed.preco} onInput=${(e) => setEd({ ...ed, preco: e.target.value })}/></${Campo}>
      <${Campo} r="Caixa vazia"><div class="seg"><button tabindex="-1" class=${!ed.vai ? "on" : ""} onClick=${() => setEd({ ...ed, vai: false })}>Não vai caixa</button><button tabindex="-1" class=${ed.vai ? "on" : ""} onClick=${() => setEd({ ...ed, vai: true, cxq: ed.cxq || (ed.unidade === "cx" ? String(Math.ceil(Number(String(ed.qtd).replace(",", "."))) || 1) : "1") })}>Vai caixa</button></div></${Campo}>
      ${ed.vai ? html`<div class="card" style="background:var(--surface)">
        ${tiposRet.length ? html`<small class="txt">${tiposProd.length ? "Caixas que vieram com este produto" : "Tipos de caixa"}</small>
          ${(ed.cxs || []).length ? html`<div class="chips">${ed.cxs.map((x, j) => html`<span class="tag" style="font-size:.9rem;padding:6px 10px">✓ ${x.q} ${nomeT(x.tipo)} <button class="btn ghost sm" style="min-height:22px;padding:0 6px" aria-label="Tirar" onClick=${() => setEd({ ...ed, cxs: ed.cxs.filter((_, y) => y !== j) })}>✕</button></span>`)}</div>` : null}
          <div class="chips">${opcoesCx.map((t) => html`<button class=${ed.tipo === t.id ? "on" : ""} onClick=${() => setEd({ ...ed, tipo: t.id })}>${t.nome}</button>`)}</div>
          <${Campo} r="Quantas caixas vazias vão" d="Escolha o tipo, digite a quantidade e aperte Enter. Depois pode registrar outro tipo."><div style="display:flex;gap:6px"><input inputmode="numeric" value=${ed.cxq} onInput=${(e) => setEd({ ...ed, cxq: e.target.value })} onKeyDown=${(e) => { if (e.key === "Enter") { e.preventDefault(); registrarCx(); } }}/><button class="btn out" disabled=${!pendOk(ed)} onClick=${registrarCx}>+ Registrar</button></div></${Campo}>
          ${!cliente ? html`<p class="av">Para levar caixa, escolha o cliente da venda.</p>` : null}` : html`<p class="av">Nenhum tipo de caixa cadastrado (Caixaria).</p>`}
      </div>` : null}
      <div class="tot"><span>Total do item</span><span>${edOk ? (totI(ed) === 0 ? "Sem preço" : reais(totI(ed))) : "—"}</span></div>
    </${Modal}>` : null}

    ${pagando ? html`<${Modal} titulo=${"Receber " + reais(total)} onFechar=${() => setPagando(false)} rod=${html`<button class="btn out" onClick=${() => setPagando(false)}>Voltar<span class="tecla">Esc</span></button><button class="btn" disabled=${falta !== 0 || oc || (prazo > 0 && !cliente) || (entregar && !cliente)} onClick=${concluir}>${oc ? "Gravando..." : html`Concluir venda<span class="tecla">Enter</span>`}</button>`}>
      ${levaCaixa && !cliente ? html`<p class="av">Esta venda leva caixa: escolha o cliente antes de concluir.</p>` : null}
      <div class="chips"><button onClick=${() => tudo("dinheiro")}>Tudo dinheiro</button><button onClick=${() => tudo("pix")}>Tudo Pix</button><button onClick=${() => tudo("credito")}>Tudo crédito</button><button onClick=${() => tudo("debito")}>Tudo débito</button><button onClick=${() => tudo("prazo")}>Tudo fiado</button></div>
      <div class="grade">
        <${Campo} r="Dinheiro recebido"><input inputmode="decimal" value=${f.dinheiro} onInput=${(e) => setF({ ...f, dinheiro: e.target.value })} placeholder="0,00"/></${Campo}>
        <${Campo} r="Pix"><input inputmode="decimal" value=${f.pix} onInput=${(e) => setF({ ...f, pix: e.target.value })} placeholder="0,00"/></${Campo}>
        <${Campo} r="Cartão de crédito"><input inputmode="decimal" value=${f.credito} onInput=${(e) => setF({ ...f, credito: e.target.value })} placeholder="0,00"/></${Campo}>
        <${Campo} r="Cartão de débito"><input inputmode="decimal" value=${f.debito} onInput=${(e) => setF({ ...f, debito: e.target.value })} placeholder="0,00"/></${Campo}>
        <${Campo} r="Fiado" d="Fica na conta do cliente"><input inputmode="decimal" value=${f.prazo} onInput=${(e) => setF({ ...f, prazo: e.target.value })} placeholder="0,00"/></${Campo}>
      </div>
      ${prazo > 0 ? html`<div class="card" style="background:var(--surface);gap:8px">
        ${cliente ? html`<div class="lin"><span>Fiado para <b>${cliente.nome}</b>${c.clientes.get(cliente.id)?.deve > 0 ? html` <small class="txt">(já deve ${reais(c.clientes.get(cliente.id).deve)})</small>` : null}</span><button class="btn ghost sm" onClick=${() => setEscCli(true)}>Trocar</button></div>` : html`<p class="av">Fiado precisa do cliente.</p><button class="btn out" onClick=${() => setEscCli(true)}>Escolher ou cadastrar cliente</button>`}
      </div>` : null}
      ${pix > 0 ? html`<${PixQR} s=${s} valor=${pix} txid=${chave}/>` : null}
      <${Campo} r="Entrega"><div class="seg"><button class=${!entregar ? "on" : ""} onClick=${() => setEntregar(false)}>Cliente levou agora</button><button class=${entregar ? "on" : ""} onClick=${() => setEntregar(true)}>Para entregar</button></div></${Campo}>
      ${entregar ? html`<div class="card" style="background:var(--surface);gap:8px">
        ${!cliente ? html`<p class="av">Para entregar, escolha o cliente.</p><button class="btn out" onClick=${() => setEscCli(true)}>Escolher ou cadastrar cliente</button>` : html`<small>Entregar para <b>${cliente.nome}</b>${cliente.telefone ? " · " + cliente.telefone : ""}</small>`}
        <${Campo} r="Onde entregar / observação (opcional)" d="Pode deixar em branco."><input value=${endEnt} onInput=${(e) => setEndEnt(e.target.value)} placeholder="Ex.: Mercado do João, entregar amanhã cedo"/></${Campo}>
        <small class="txt">A venda vai para a tela Entregas. Dá para entregar em partes.</small></div>` : null}
      <h2 style="text-align:center;color:${falta ? "var(--err)" : troco ? "var(--warn)" : "var(--pri)"}">${falta > 0 ? "Falta " + reais(falta) : falta < 0 ? "Passou " + reais(-falta) : troco ? "Troco " + reais(troco) : "Valores conferem"}</h2>
    </${Modal}>` : null}

    ${escCli ? html`<${Modal} titulo="Cliente da venda" onFechar=${() => setEscCli(false)}>
      <input autofocus placeholder="Nome ou telefone" value=${bCli} onInput=${(e) => setBCli(e.target.value)}/>
      ${bCli.trim().length >= 2 && !s.clientes.some((x) => x.nome.trim().toLowerCase() === bCli.trim().toLowerCase()) ? html`<div class="card" style="background:var(--surface);gap:8px">
        <b>Cliente novo: ${bCli.trim()}</b>
        <${Campo} r="Telefone (opcional)"><input inputmode="tel" value=${novoTel} onInput=${(e) => setNovoTel(e.target.value)}/></${Campo}>
        <button class="btn" disabled=${oc} onClick=${() => rodar(async () => { const id = novoId("P"); await gravar("clientes", id, { nome: bCli.trim(), telefone: novoTel.trim(), documento: "", limite: 0, ativo: true, criadoEm: agora(), criadoNaVenda: true }); setCliente(id); setBCli(""); setNovoTel(""); setEscCli(false); }, "Cliente cadastrado")}>Cadastrar e usar nesta venda</button>
      </div>` : null}
      <div class="lista"><button onClick=${() => { setCliente(""); setEscCli(false); }}><b>Consumidor não identificado</b></button>
      ${clis.map((x) => html`<button onClick=${() => { setCliente(x.id); setEscCli(false); }}><b>${x.nome}</b><small>${x.telefone || ""}${c.clientes.get(x.id)?.deve > 0 ? " · deve " + reais(c.clientes.get(x.id).deve) : ""}</small></button>`)}</div>
      <p class="txt">Digite o nome: se ainda não existir, ele é cadastrado na hora.</p>
    </${Modal}>` : null}
  </div>`;
}

function Desperdicio({ s, c, sessao, onFechar }) {
  const [pid, setPid] = useState(""); const [u, setU] = useState("kg"); const [q, setQ] = useState(""); const motivos = ["Estragou", "Amassou ou machucou", "Murchou / passou do ponto", "Quebra de peso da caixa", "Outro"];
  const [mot, setMot] = useState(motivos[0]); const [obs, setObs] = useState("");
  const [oc, rodar] = useAcao();
  const gestor = papelDe(s) === "gestor";
  const cx = u === "cx" ? Number(q) : 0, g = u === "kg" ? paraGramas(q) : 0;
  const ok = pid && (u === "cx" ? Number.isInteger(cx) && cx > 0 : g > 0) && (mot !== "Outro" || obs.trim().length > 2);
  return html`<${Modal} titulo="Lançar desperdício" sub="Sai do estoque pelo lote mais antigo. Não mexe no dinheiro do caixa." onFechar=${onFechar} rod=${html`<button class="btn out" onClick=${onFechar}>Cancelar</button><button class="btn red" disabled=${!ok || oc} onClick=${() => rodar(async () => {
    if (!gestor && (cx > 1 || g > 10000)) throw new Error("Desperdício acima de 1 cx ou 10 kg: peça ao gestor.");
    const { deltas, custo, faltou } = consumir(calcular(S), pid, cx, g, true, true);
    if (faltou.cx || faltou.g) setTimeout(() => toast("Atenção: estoque ficou NEGATIVO (" + saldoTxt(faltou.cx, faltou.g) + ").", true), 400);
    await gravar("movEstoque", novoId("D"), { tipo: "desperdicio", produtoId: pid, deltas, custo: Number(custo.toFixed(4)), motivo: mot === "Outro" ? obs.trim() : mot, sessaoId: sessao?.id || null, criadoPor: S.eu, criadoEm: agora() });
    onFechar();
  }, "Desperdício lançado")}>Lançar</button>`}>
    <${Campo} r="Produto"><${Sel} valor=${pid} set=${setPid} vazio="Escolha" opcoes=${s.produtos.filter((p) => p.ativo !== false).sort((a, b) => a.nome.localeCompare(b.nome)).map((p) => [p.id, p.nome])}/></${Campo}>
    ${pid ? html`<p class="txt">Em estoque: ${saldoTxt(c.estoque.get(pid).cx, c.estoque.get(pid).g)}</p>` : null}
    <div class="seg"><button class=${u === "kg" ? "on" : ""} onClick=${() => setU("kg")}>Quilo</button><button class=${u === "cx" ? "on" : ""} onClick=${() => setU("cx")}>Caixa</button></div>
    <${Campo} r=${u === "cx" ? "Quantas caixas" : "Peso em kg"}><input class="big" inputmode="decimal" value=${q} onInput=${(e) => setQ(e.target.value)}/></${Campo}>
    <${Campo} r="Motivo"><div class="chips">${motivos.map((m) => html`<button class=${mot === m ? "on" : ""} onClick=${() => setMot(m)}>${m}</button>`)}</div></${Campo}>
    ${mot === "Outro" ? html`<${Campo} r="Explique"><input value=${obs} onInput=${(e) => setObs(e.target.value)}/></${Campo}>` : null}
  </${Modal}>`;
}

function MovCaixa({ s, sessao, onFechar }) {
  const gestor = papelDe(s) === "gestor";
  const [tipo, setTipo] = useState("sangria"); const [forma, setForma] = useState("dinheiro"); const [v, setV] = useState(""); const [d, setD] = useState("");
  const [oc, rodar] = useAcao();
  const val = paraCentavos(v); const livre = tipo === "despesa" || tipo === "retirada";
  return html`<${Modal} titulo="Movimento de caixa" onFechar=${onFechar} rod=${html`<button class="btn out" onClick=${onFechar}>Cancelar</button><button class="btn" disabled=${!(val > 0) || d.trim().length < 2 || oc} onClick=${() => rodar(async () => {
    await gravar("movCaixa", novoId("M"), { sessaoId: sessao.id, tipo, forma: livre ? forma : "dinheiro", valor: tipo === "suprimento" ? val : -val, descricao: d.trim(), criadoPor: S.eu, criadoEm: agora() }); onFechar();
  }, "Movimento registrado")}>Registrar</button>`}>
    <${Campo} r="Tipo"><${Sel} valor=${tipo} set=${setTipo} opcoes=${[["sangria", "Sangria (tirar dinheiro da gaveta)"], ["suprimento", "Suprimento (colocar troco)"], ["despesa", "Despesa paga pelo caixa"], ...(gestor ? [["retirada", "Retirada do dono"]] : [])]}/></${Campo}>
    ${livre ? html`<${Campo} r="Saiu como"><${Sel} valor=${forma} set=${setForma} opcoes=${FORMAS_SEL}/></${Campo}>` : null}
    <${Campo} r="Valor (R$)"><input class="big" inputmode="decimal" value=${v} onInput=${(e) => setV(e.target.value)}/></${Campo}>
    <${Campo} r="Descrição"><input value=${d} onInput=${(e) => setD(e.target.value)} placeholder="Ex.: sacolas, depósito no banco"/></${Campo}>
  </${Modal}>`;
}

function Fechar({ s, c, sessao, onFechar }) {
  const e = c.sess.get(sessao.id);
  const [d, setD] = useState(""); const [p, setP] = useState(""); const [k, setK] = useState(""); const [o, setO] = useState("");
  const [res, setRes] = useState(null); const [oc, rodar] = useAcao();
  const vals = [d, p, k].map(paraCentavos); const prontos = d.trim() !== "" && vals.every(Number.isFinite);
  const cont = vals.reduce((a, b) => a + (b || 0), 0); const esp = e.dinheiro + e.pix + e.cartao;
  if (res != null) return html`<${Modal} titulo="Caixa fechado" onFechar=${onFechar} rod=${html`<button class="btn" onClick=${onFechar}>Ok</button>`}><${Num} r="Diferença no fechamento" v=${reais(res)} tom=${res === 0 ? "bom" : "ruim"} d=${res === 0 ? "Bateu certinho." : res > 0 ? "Sobrou." : "Faltou."}/></${Modal}>`;
  return html`<${Modal} titulo="Fechar o caixa" sub="Conte a gaveta e confira Pix e maquininha." onFechar=${onFechar} rod=${html`<button class="btn out" onClick=${onFechar}>Cancelar</button><button class="btn" disabled=${!prontos || oc} onClick=${() => rodar(async () => {
    // lucro congelado: guarda o custo de cada venda deste caixa no momento do fechamento
    const cv = calcular(S).custoVenda; const custos = {};
    for (const v of S.vendas) if (v.sessaoId === sessao.id) { const k = cv.get(v.id); if (k) custos[v.id] = { custo: Number(k.custo.toFixed(4)), itens: k.itens.map((i) => Number(i.custo.toFixed(4))), provisorio: k.provisorio }; }
    await alterar("sessoes", sessao.id, { fechamento: { custos, em: agora(), contado: { dinheiro: vals[0] || 0, pix: vals[1] || 0, cartao: vals[2] || 0 }, esperado: { dinheiro: e.dinheiro, pix: e.pix, cartao: e.cartao }, diferenca: cont - esp, obs: o.trim() } }); setRes(cont - esp);
  })}>Fechar caixa</button>`}>
    <${Campo} r="Dinheiro contado na gaveta" d=${"Esperado " + reais(e.dinheiro)}><input inputmode="decimal" value=${d} onInput=${(x) => setD(x.target.value)}/></${Campo}>
    <${Campo} r="Total em Pix" d=${"Esperado " + reais(e.pix)}><input inputmode="decimal" value=${p} onInput=${(x) => setP(x.target.value)}/></${Campo}>
    <${Campo} r="Total em cartão" d=${"Esperado " + reais(e.cartao)}><input inputmode="decimal" value=${k} onInput=${(x) => setK(x.target.value)}/></${Campo}>
    <${Campo} r="Observação"><input value=${o} onInput=${(x) => setO(x.target.value)}/></${Campo}>
    ${prontos ? html`<p class=${cont === esp ? "ok" : "av"}>${cont === esp ? "Confere com o esperado." : "Diferença de " + reais(cont - esp)}</p>` : null}
  </${Modal}>`;
}

function Caixa({ s, c }) {
  const sessao = sessaoMinha(s);
  const [aba, setAba] = useState("vender"); const [dlg, setDlg] = useState(null);
  if (!sessao) return html`<${AbrirCaixa} s=${s}/>`;
  const e = c.sess.get(sessao.id) || { dinheiro: 0, pix: 0, cartao: 0, vendas: 0, vendasTotal: 0, prazo: 0, perda: 0 };
  const vendas = s.vendas.filter((v) => v.sessaoId === sessao.id).sort((a, b) => (a.criadoEm < b.criadoEm ? 1 : -1));
  const movs = s.movCaixa.filter((m) => m.sessaoId === sessao.id);
  const desp = s.movEstoque.filter((m) => m.sessaoId === sessao.id && m.tipo === "desperdicio");
  return html`<div class="pag">
    <div class="cab"><h1>${sessao.nome}</h1><div class="acoes">
      <button class="btn red" onClick=${() => setDlg("d")}>Desperdício</button>
      <button class="btn out" onClick=${() => setDlg("m")}>Sangria / despesa</button>
      <button class="btn out" onClick=${() => setDlg("f")}>Fechar caixa</button></div></div>
    <${Tabs} abas=${[["vender", "Vender"], ["turno", "Resumo do turno"]]} atual=${aba} set=${setAba}/>
    ${aba === "vender" ? html`<${Pdv} s=${s} c=${c} sessao=${sessao}/>` : html`<div class="pag">
      <div class="grade">
        <${Num} r="Vendas do turno" v=${reais(e.vendasTotal)} d=${e.vendas + " vendas"} tom="bom"/>
        <${Num} r="Vendido fiado" v=${reais(e.prazo)} d="não entra no caixa"/>
        <${Num} r="Dinheiro na gaveta" v=${reais(e.dinheiro)} d=${"troco inicial " + reais(sessao.saldoInicial)}/>
        <${Num} r="Pix" v=${reais(e.pix)}/><${Num} r="Cartão" v=${reais(e.cartao)} d=${"crédito " + reais(e.credito || 0) + " · débito " + reais(e.debito || 0)}/>
        <${Num} r="Desperdício do turno" v=${reais(Math.round(e.perda * 100))} tom=${e.perda ? "ruim" : ""}/>
      </div>
      <div class="card"><h2>Vendas do turno</h2>${vendas.length ? html`<div class="tab"><table><thead><tr><th>Nº</th><th>Hora</th><th>Cliente</th><th class="r">Total</th><th class="r">Fiado</th><th></th></tr></thead><tbody>${vendas.map((v) => html`<tr class=${v.status === "cancelada" ? "risc" : ""}><td><a class="link" href=${"#venda-" + v.id}>${numVenda(v.id)}</a></td><td>${hora(v.criadoEm)}</td><td>${s.clientes.find((x) => x.id === v.clienteId)?.nome || "Consumidor"}</td><td class="r">${reais(v.total)}</td><td class="r">${v.prazo ? reais(v.prazo) : "—"}</td><td><${BotoesImpressao} v=${v} c=${c}/></td></tr>`)}</tbody></table></div>` : html`<${Vazio}>Nenhuma venda ainda.</${Vazio}>`}</div>
      <div class="duas"><div class="card"><h2>Desperdício do turno</h2>${desp.length ? html`<div class="tab"><table><thead><tr><th>Hora</th><th>Produto</th><th>Motivo</th><th class="r">Custo</th></tr></thead><tbody>${desp.map((m) => html`<tr><td>${hora(m.criadoEm)}</td><td>${c.prod.get(m.produtoId)?.nome}</td><td>${m.motivo}</td><td class="r">${reais(Math.round(m.custo * 100))}</td></tr>`)}</tbody></table></div>` : html`<${Vazio}>Nada lançado.</${Vazio}>`}</div>
      <div class="card"><h2>Movimentos de dinheiro</h2>${movs.length ? html`<div class="tab"><table><thead><tr><th>Hora</th><th>Tipo</th><th>Descrição</th><th class="r">Valor</th></tr></thead><tbody>${movs.map((m) => html`<tr><td>${hora(m.criadoEm)}</td><td>${m.tipo}</td><td>${m.descricao}</td><td class="r">${reais(m.valor)}</td></tr>`)}</tbody></table></div>` : html`<${Vazio}>Nenhum movimento.</${Vazio}>`}</div></div>
    </div>`}
    ${dlg === "d" ? html`<${Desperdicio} s=${s} c=${c} sessao=${sessao} onFechar=${() => setDlg(null)}/>` : null}
    ${dlg === "m" ? html`<${MovCaixa} s=${s} sessao=${sessao} onFechar=${() => setDlg(null)}/>` : null}
    ${dlg === "f" ? html`<${Fechar} s=${s} c=${c} sessao=${sessao} onFechar=${() => setDlg(null)}/>` : null}
  </div>`;
}

function Comprovante({ s, c, id }) {
  const v = s.vendas.find((x) => x.id === id);
  const [canc, setCanc] = useState(false); const [mot, setMot] = useState(""); const [oc, rodar] = useAcao(); const [pdfOc, rodarPdfWa] = useAcao(); const [pdfPronto, setPdfPronto] = useState(null);
  useEffect(() => { carregarScript("https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js").catch(() => {}); carregarScript("https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js").catch(() => {}); }, []); const [regEnt, setRegEnt] = useState(false); const [marcEnt, setMarcEnt] = useState(false);
  // reabrir: a venda vira nota em aberto com os mesmos itens (o estoque continua baixado)
  const reabrir = () => rodar(async () => {
    const tt = c.titulos.find((t) => t.vendaId === v.id);
    if (tt && tt.pago > 0) throw new Error("Esta venda já tem pagamento de fiado recebido. Estorne o recebimento antes de reabrir.");
    const sv = S.sessoes.find((x) => x.id === v.sessaoId);
    if (!sv || sv.fechamento) throw new Error("O caixa desta venda já foi fechado. Só dá para reabrir nota do caixa que ainda está aberto.");
    if (!confirm("Reabrir a venda " + numVenda(v.id) + "? Ela volta para o caixa como nota em aberto para você corrigir e receber de novo.")) return;
    const pc = (pid) => c.prod.get(pid)?.pesoCaixaG || 0;
    const itensCarrinho = v.itens.map((i, k) => {
      const base = { k: novoId("I"), produtoId: i.produtoId, nome: c.prod.get(i.produtoId)?.nome || "", vai: cxDe(i).length > 0, cxs: cxDe(i).map((x) => ({ tipo: x.tipoId, q: x.q })), tipo: "", cxq: "" };
      if (i.unidade === "meia") return { ...base, unidade: "cx", meia: true, qtd: String(i.meias || 1), preco: txtReais(i.preco * 2) };
      if (i.unidade === "cx") return { ...base, unidade: "cx", qtd: i.meias ? String(i.caixas) + ",5" : String(i.caixas), preco: txtReais(i.preco) };
      return { ...base, unidade: "kg", qtd: String(i.gramas / 1000).replace(".", ","), preco: txtReais(i.preco) };
    });
    const consumo = v.itens.flatMap((i) => (i.consumo || []).filter((d) => !d.abre).map((d) => ({ ...d, produtoId: i.produtoId })));
    const pid = novoId("N");
    await gravar("pedidos", pid, { clienteId: v.clienteId || "", itens: itensCarrinho, consumo, desconto: v.desconto || 0, status: "aberto", vendaOrigem: v.id, pagamentosAnteriores: v.pagamentos, prazoAnterior: v.prazo || 0, sessaoOrigem: v.sessaoId, entregaAnterior: v.entrega || null, criadoPor: S.eu, criadoEm: agora(), atualizadoEm: agora(), atualizadoPor: S.eu });
    await alterar("vendas", v.id, { status: "cancelada", reaberta: true, pedidoReaberto: pid, cancelamento: { motivo: "Reaberta para alteração", por: S.eu, em: agora(), sessaoId: v.sessaoId } });
    S.abrirPedido = pid; location.hash = "caixa";
  }, "Nota reaberta no caixa");
  // impressão automática logo depois de concluir a venda (se ligada neste aparelho)
  useEffect(() => { if (v && S.imprimirVenda === v.id) { S.imprimirVenda = null; const cfg = impConfig(); if (cfg.auto) setTimeout(() => { imprimirCupom(".cupom"); if (cfg.despacho) imprimirDespacho(v, c); }, 120); }
    else if (v && S.reimprimir === v.id) { S.reimprimir = null; setTimeout(() => imprimirCupom(".cupom"), 120); } }, [v?.id, s.reimprimir]);
  if (!v) return html`<div class="pag"><${Vazio}>Venda não encontrada.</${Vazio}></div>`;
  const se = v.entrega ? situacaoEntrega(s, v) : null;
  const cli = s.clientes.find((x) => x.id === v.clienteId);
  const sess = s.sessoes.find((x) => x.id === v.sessaoId);
  const gestor = papelDe(s) === "gestor";
  const tit = c.titulos.find((t) => t.vendaId === v.id);
  const deve = cli ? c.clientes.get(cli.id)?.deve || 0 : 0;
  const q = (i) => (i.unidade === "cx" ? cxMeiaTxt(i.caixas, i.meias) : i.unidade === "meia" ? meiaTxt(i.meias || 1) : kg(i.gramas));
  const txt = ["*O Pimentão — Hortifruti*", `Comprovante nº ${numVenda(v.id)} — ${dataHora(v.criadoEm)}`, `Cliente: ${cli?.nome || "Consumidor"}`, "",
    ...v.itens.map((i) => `${c.prod.get(i.produtoId)?.nome}: ${q(i)} x ${reais(i.preco)} = ${reais(i.total)}` + cxDe(i).map((x) => `\n  + ${x.q} caixa(s) ${c.tipos.get(x.tipoId)?.nome || ""} — devolver`).join("")),
    "", v.desconto ? `Desconto: -${reais(v.desconto)}` : "", `*Total: ${reais(v.total)}*`, ...v.pagamentos.map((p) => `${FORMAS[p.forma]}: ${reais(p.valor)}`),
    v.prazo ? `Fiado: ${reais(v.prazo)}${v.vencimento ? " (vence " + dataBR(v.vencimento) + ")" : ""}` : "", v.prazo ? `Saldo em aberto: ${reais(deve)}` : "", "", "Comprovante sem valor fiscal. Obrigado pela preferência!"].filter((l, k, a) => l !== "" || a[k - 1] !== "").join("\n");
  const fone = (cli?.telefone || "").replace(/\D/g, "");
  return html`<div class="pag">
    <div class="cab"><h1>Venda ${numVenda(v.id)}</h1><div class="acoes">
      <button class="btn" onClick=${() => imprimirCupom(".cupom")}>🖨️ Imprimir</button>
      <button class="btn out" onClick=${() => imprimirDespacho(v, c)}>📦 Nota de despacho</button>
      <button class="btn" disabled=${pdfOc} onClick=${() => rodarPdfWa(() => enviarNotaWhats(".cupom", { fone, texto: txt }))}>${pdfOc ? "Preparando…" : "📲 Enviar no WhatsApp"}</button>
      <button class="btn out" disabled=${pdfOc} onClick=${() => rodarPdfWa(async () => {
        const arq = pdfPronto || await pdfDoCupom(".cupom", "Nota-" + numVenda(v.id) + "-" + (cli?.nome || "Consumidor").replace(/[^A-Za-zÀ-ú0-9]+/g, "-") + ".pdf");
        const r = await compartilharArquivos([arq], "Nota " + numVenda(v.id));
        if (r === "clique") { setPdfPronto(arq); toast("PDF pronto. Clique de novo em 'Compartilhar PDF' para escolher o grupo."); return; }
        setPdfPronto(null);
        if (r === "sem") { baixarArquivo(arq); toast("Este computador não abriu o Compartilhar; o PDF foi baixado na pasta Downloads."); }
      })}>${pdfPronto ? "📤 Compartilhar agora" : "📤 Compartilhar PDF"}</button>
      <button class="btn out" onClick=${() => abrirWhatsApp(fone, txt)}>WhatsApp (texto)</button>
      <button class="btn out" onClick=${() => (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(() => toast("Comprovante copiado"), () => toast("Não deu para copiar", true))}>Copiar texto</button>
      <a class="btn out" href="#caixa">Nova venda</a>
      ${v.status !== "cancelada" && !v.entrega ? html`<button class="btn out" onClick=${() => setMarcEnt(true)}>Marcar para entregar</button>` : null}
      ${gestor && v.status !== "cancelada" ? (sess && !sess.fechamento ? html`<button class="btn out" disabled=${oc} onClick=${reabrir}>Reabrir nota</button>` : html`<button class="btn out" disabled title="O caixa desta venda já foi fechado">Reabrir nota (caixa fechado)</button>`) : null}
      ${gestor && v.status !== "cancelada" ? html`<button class="btn red" onClick=${() => setCanc(true)}>Cancelar venda</button>` : null}</div></div>
    <div class="cupom">
      <div class="c"><${Pimentao} t=${36}/><br/><b style="font-family:Fredoka;font-size:20px">O Pimentão</b><br/>HORTIFRUTI</div><hr/>
      <div class="c"><b>COMPROVANTE DE VENDA<br/>NÃO É DOCUMENTO FISCAL</b></div>
      ${v.status === "cancelada" ? html`<div class="c" style="border:2px solid #111;margin-top:6px"><b>${v.reaberta ? "REABERTA PARA ALTERAÇÃO" : "CANCELADA — " + v.cancelamento?.motivo}</b>${v.reaberta ? (() => { const pd = s.pedidos.find((x) => x.id === v.pedidoReaberto); return pd?.vendaId ? html`<br/><a class="link" href=${"#venda-" + pd.vendaId}>Ver a venda nova ${numVenda(pd.vendaId)}</a>` : html`<br/><small>Está nas notas em aberto do caixa</small>`; })() : null}</div>` : null}<hr/>
      <div class="par"><span>Nº ${numVenda(v.id)}</span><span>${dataHora(v.criadoEm)}</span></div>
      <div class="cli-cupom"><small>CLIENTE:</small> <b>${cli?.nome || "Consumidor"}</b></div><hr/>
      ${v.itens.map((i) => html`<div>${c.prod.get(i.produtoId)?.nome}</div><div class="par"><span>${q(i)} x ${(i.preco / 100).toFixed(2).replace(".", ",")}</span><span>${(i.total / 100).toFixed(2).replace(".", ",")}</span></div>${cxDe(i).map((x) => html`<div>+ ${x.q} caixa(s) ${c.tipos.get(x.tipoId)?.nome || ""} — DEVOLVER</div>`)}`)}
      <hr/><div class="par"><span>Subtotal</span><span>${reais(v.subtotal)}</span></div>
      ${v.desconto ? html`<div class="par"><span>Desconto</span><span>-${reais(v.desconto)}</span></div>` : null}
      <div class="par"><b>TOTAL</b><b>${reais(v.total)}</b></div><hr/>
      ${v.pagamentos.map((p) => html`<div class="par"><span>${FORMAS[p.forma]}</span><span>${reais(p.valor)}</span></div>`)}
      ${v.prazo ? html`<div class="par"><b>FIADO NESTA NOTA${v.vencimento ? " (venc. " + dataBR(v.vencimento) + ")" : ""}</b><b>${reais(v.prazo)}</b></div><div class="saldo-aberto"><span>SALDO EM ABERTO</span><span>${reais(deve)}</span></div>${(() => {
        // contas pendentes do cliente, da mais antiga para a mais nova (até 12 linhas)
        const pend = c.titulos.filter((t) => t.clienteId === v.clienteId && t.saldo > 0).sort((a, b) => (a.criadoEm < b.criadoEm ? -1 : 1));
        if (!pend.length) return null;
        const n2 = (x) => (x / 100).toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
        const dm = (iso) => (iso ? new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : "");
        const mostra = pend.slice(0, 12), resto = pend.slice(12);
        return html`<div class="c"><b>CONTAS PENDENTES</b></div><div class="par"><b>Data</b><b>Falta</b></div>
          ${mostra.map((t) => { const nome = t.avulso ? (t.descricao.length > 16 ? t.descricao.slice(0, 15) + "…" : t.descricao) : "Nota " + numVenda(t.vendaId); const esta = t.vendaId === v.id;
            return html`<div class="par"><span>${esta ? html`<b>${dm(t.criadoEm)} ${nome} (esta)</b>` : `${dm(t.criadoEm)} ${nome}`}${t.vencido ? html` <b>VENC.</b>` : null}</span><span>${n2(t.saldo)}</span></div>`; })}
          ${resto.length ? html`<div class="par"><span>+ ${resto.length} outras contas</span><span>${n2(resto.reduce((a, t) => a + t.saldo, 0))}</span></div>` : null}`;
      })()}<div class="c"><br/>______________________<br/>Assinatura do cliente</div>` : null}
      ${se ? html`<hr/><div class="c"><b>${se.status === "entregue" ? "ENTREGUE" : "PARA ENTREGAR"}</b>${v.entrega.endereco ? html`<br/>${v.entrega.endereco}` : null}${v.entrega.previsao ? html`<br/>Até ${dataBR(v.entrega.previsao)}` : null}</div>` : null}
      <hr/><div class="c"><b>Obrigado pela preferência!</b></div>
    </div>
    ${se && v.status !== "cancelada" ? html`<div class="card" style="max-width:520px;gap:8px"><div class="cab"><h2>Entrega</h2>${tagEntrega(se.status)}</div>
      <small>${v.entrega.endereco ? "📍 " + v.entrega.endereco + " · " : ""}${v.entrega.previsao ? "Entregar até " + dataBR(v.entrega.previsao) : ""}${v.entrega.obs ? " · " + v.entrega.obs : ""}</small>
      <div class="tab"><table><thead><tr><th>Produto</th><th class="r">Vendido</th><th class="r">Entregue</th><th class="r">Falta</th></tr></thead><tbody>${se.itens.map((it) => html`<tr><td>${c.prod.get(it.i.produtoId)?.nome}</td><td class="r">${qtdEnt(it.cx, it.tot)}</td><td class="r">${it.ent ? qtdEnt(it.cx, it.ent) : ""}</td><td class="r"><b>${it.falta ? qtdEnt(it.cx, it.falta) : "—"}</b></td></tr>`)}</tbody></table></div>
      ${se.ents.map((e) => html`<small class="txt">${dataHora(e.criadoEm)} — ${e.itens.map((i) => `${c.prod.get(i.produtoId)?.nome} ${i.caixas ? i.caixas + " cx" : kg(i.gramas)}`).join(", ")}${e.entregador ? " · " + e.entregador : ""} · por ${nomePessoa(s, e.criadoPor)}</small>`)}
      <div class="acoes">${se.status !== "entregue" ? html`<button class="btn" onClick=${() => setRegEnt(true)}>Registrar entrega</button>` : null}<button class="btn ghost sm" onClick=${() => setMarcEnt(true)}>Editar onde entregar</button></div></div>` : null}
    ${regEnt ? html`<${RegistrarEntrega} s=${s} c=${c} v=${v} onFechar=${() => setRegEnt(false)}/>` : null}
    ${marcEnt ? html`<${MarcarEntrega} v=${v} onFechar=${() => setMarcEnt(false)}/>` : null}
    ${canc ? html`<${Modal} titulo="Cancelar venda" sub="A mercadoria volta ao estoque, o valor pago sai do seu caixa como devolução e a parte a prazo é cancelada. Fica registrado." onFechar=${() => setCanc(false)} rod=${html`<button class="btn out" onClick=${() => setCanc(false)}>Voltar</button><button class="btn red" disabled=${mot.trim().length < 3 || oc} onClick=${() => rodar(async () => {
      if (tit && tit.pago > 0) throw new Error("Esta venda já tem pagamentos recebidos. Estorne os recebimentos antes.");
      const minha = sessaoMinha(S); if (v.pagamentos.length && !minha) throw new Error("Abra o seu caixa: a devolução do dinheiro sai dele.");
      await alterar("vendas", v.id, { status: "cancelada", cancelamento: { motivo: mot.trim(), por: S.eu, em: agora(), sessaoId: minha?.id || null } }); setCanc(false);
    }, "Venda cancelada")}>Confirmar cancelamento</button>`}><${Campo} r="Motivo"><input value=${mot} onInput=${(e) => setMot(e.target.value)}/></${Campo}></${Modal}>` : null}
  </div>`;
}
