// ============ RECEBIMENTO (conferência) ============
function Conferir({ s, c, compra, onFechar }) {
  const [cont, setCont] = useState(compra.itens.map((i) => tiposDo(i).map(() => "")));
  const [semTipo, setSemTipo] = useState(compra.itens.map((i) => (tiposDo(i).length ? null : "")));
  const [obs, setObs] = useState(""); const [oc, rodar] = useAcao();
  const num = (v) => v !== "" && Number.isInteger(Number(v)) && Number(v) >= 0;
  const ok = compra.itens.every((i, k) => (tiposDo(i).length ? cont[k].every(num) : num(semTipo[k])));
  const set = (k, j, v) => setCont(cont.map((r, x) => (x === k ? r.map((y, z) => (z === j ? v : y)) : r)));
  const tag = (d) => (d === 0 ? html`<span class="tag">Confere</span>` : d < 0 ? html`<span class="tag red">Faltou ${-d}</span>` : html`<span class="tag warn">Sobrou ${d}</span>`);
  return html`<${Modal} grande titulo=${"Conferir entrada de " + (s.fornecedores.find((f) => f.id === compra.fornecedorId)?.nome || "")} sub="Conte o que chegou de verdade, tipo de caixa por tipo de caixa. O sistema compara com a nota." onFechar=${onFechar} rod=${html`<button class="btn out" onClick=${onFechar}>Cancelar</button><button class="btn" disabled=${!ok || oc} onClick=${() => rodar(async () => {
    const itens = compra.itens.map((i, k) => {
      const tps = tiposDo(i);
      const porTipo = tps.map((t, j) => ({ tipo: t.tipoCaixaId, nota: t.caixas, chegou: Number(cont[k][j]) }));
      const caixas = tps.length ? porTipo.reduce((a, t) => a + t.chegou, 0) : Number(semTipo[k]);
      return { itemId: i.loteId, produtoId: i.produtoId, notaCaixas: i.caixas, caixas, porTipo };
    });
    const diverge = itens.some((x) => x.caixas !== x.notaCaixas || x.porTipo.some((t) => t.chegou !== t.nota));
    await gravar("conferencias", compra.id, { compraId: compra.id, fornecedorId: compra.fornecedorId, itens, status: diverge ? "divergente" : "confere", obs: obs.trim(), criadoPor: S.eu, criadoEm: agora() }); onFechar();
  }, "Recebimento conferido")}>Gravar conferência</button>`}>
    <div class="tab"><table><thead><tr><th>Produto</th><th>Tipo de caixa</th><th class="r">Nota diz</th><th>Chegou</th><th>Resultado</th></tr></thead><tbody>
      ${compra.itens.map((i, k) => { const tps = tiposDo(i); const nome = c.prod.get(i.produtoId)?.nome;
        if (!tps.length) return html`<tr><td><b>${nome}</b></td><td>—</td><td class="r">${i.caixas} cx</td><td><input inputmode="numeric" style="width:90px" value=${semTipo[k]} onInput=${(e) => setSemTipo(semTipo.map((y, z) => (z === k ? e.target.value : y)))}/></td><td>${num(semTipo[k]) ? tag(Number(semTipo[k]) - i.caixas) : ""}</td></tr>`;
        return tps.map((t, j) => html`<tr><td>${j === 0 ? html`<b>${nome}</b>` : ""}</td><td>${c.tipos.get(t.tipoCaixaId)?.nome || "?"}</td><td class="r">${t.caixas} cx</td><td><input inputmode="numeric" style="width:90px" value=${cont[k][j]} onInput=${(e) => set(k, j, e.target.value)}/></td><td>${num(cont[k][j]) ? tag(Number(cont[k][j]) - t.caixas) : ""}</td></tr>`); })}
    </tbody></table></div>
    <${Campo} r="Observação de quem recebeu"><input value=${obs} onInput=${(e) => setObs(e.target.value)} placeholder="Ex.: 2 caixas de tomate amassadas"/></${Campo}>
  </${Modal}>`;
}

function Resolver({ s, c, conf, onFechar }) {
  const [acao, setAcao] = useState("aguardar"); const [obs, setObs] = useState(""); const [oc, rodar] = useAcao();
  return html`<${Modal} titulo="Resolver divergência" onFechar=${onFechar} rod=${html`<button class="btn out" onClick=${onFechar}>Cancelar</button><button class="btn" disabled=${obs.trim().length < 3 || oc} onClick=${() => rodar(async () => {
    let deltas = [], caixaria = [];
    if (acao === "corrigir") {
      const calc = calcular(S);
      for (const it of conf.itens) {
        const d = it.caixas - it.notaCaixas; const lote = calc.L.get(it.itemId);
        if (d !== 0 && lote) { if (d < 0 && lote.cx < -d) throw new Error(`Parte do lote de ${calc.prod.get(it.produtoId)?.nome} já saiu. Corrija pelo inventário no Estoque.`); deltas.push({ loteId: it.itemId, cx: d, g: 0 }); }
        for (const t of it.porTipo || []) { const dt = t.chegou - t.nota; if (dt && calc.tipos.get(t.tipo)?.retornavel !== false) caixaria.push({ tipoId: t.tipo, q: dt }); }
      }
      if (deltas.length) await gravar("movEstoque", novoId("A"), { tipo: "ajuste", produtoId: "", deltas, custo: 0, motivo: "Correção pelo recebimento", compraId: conf.compraId, criadoPor: S.eu, criadoEm: agora() });
    }
    await alterar("conferencias", conf.id, { resolucao: { acao, obs: obs.trim(), caixaria, por: S.eu, em: agora() } }); onFechar();
  }, "Divergência resolvida")}>Confirmar</button>`}>
    <div class="seg"><button class=${acao === "aguardar" ? "on" : ""} onClick=${() => setAcao("aguardar")}>Combinar com o fornecedor</button><button class=${acao === "corrigir" ? "on" : ""} onClick=${() => setAcao("corrigir")}>Corrigir estoque pelo que chegou</button></div>
    <p class="txt">${acao === "corrigir" ? "O estoque e a contagem de caixas passam a valer o que chegou de verdade." : "O estoque fica como a nota. Anote o que foi combinado (reposição, desconto, devolução)."}</p>
    <${Campo} r=${acao === "corrigir" ? "Motivo" : "O que foi combinado"}><input value=${obs} onInput=${(e) => setObs(e.target.value)}/></${Campo}>
  </${Modal}>`;
}

// chegadas unificadas: parciais (coleção chegadas) + conferências antigas feitas de uma vez
function listaChegadas(s) {
  const out = s.chegadas.map((x) => ({ ...x }));
  const comParcial = new Set(s.chegadas.map((x) => x.compraId));
  for (const cf of s.conferencias) if (!comParcial.has(cf.compraId)) out.push({ id: "L" + cf.id, chegadaId: cf.chegadaId || cf.id, caminhao: cf.caminhao || "—", compraId: cf.compraId, criadoPor: cf.criadoPor, criadoEm: cf.criadoEm, itens: cf.itens.flatMap((it) => (it.porTipo && it.porTipo.length ? it.porTipo.map((t) => ({ itemId: it.itemId, produtoId: it.produtoId, tipo: t.tipo, q: t.chegou })) : [{ itemId: it.itemId, produtoId: it.produtoId, tipo: "", q: it.caixas }])) });
  return out;
}
function recebidoMap(s) { const m = new Map(); for (const x of s.chegadas) for (const it of x.itens) { const k = x.compraId + "|" + it.itemId + "|" + it.tipo; m.set(k, (m.get(k) || 0) + it.q); } return m; }
// grava a conferência final da nota (soma de todas as chegadas)
async function fecharNota(s, compra, rec, extra, motivo) {
  const caminhoes = [...new Set(s.chegadas.filter((x) => x.compraId === compra.id).map((x) => x.caminhao).concat(extra ? [extra.caminhao] : []))];
  const itens = compra.itens.map((i) => {
    const tps = tiposDo(i);
    const porTipo = tps.map((t) => ({ tipo: t.tipoCaixaId, nota: t.caixas, chegou: rec(compra.id + "|" + i.loteId + "|" + t.tipoCaixaId) }));
    const caixas = tps.length ? porTipo.reduce((a, t) => a + t.chegou, 0) : rec(compra.id + "|" + i.loteId + "|");
    return { itemId: i.loteId, produtoId: i.produtoId, notaCaixas: i.caixas, caixas, porTipo };
  });
  const diverge = itens.some((y) => y.caixas !== y.notaCaixas || y.porTipo.some((t) => t.chegou !== t.nota));
  await gravar("conferencias", compra.id, { compraId: compra.id, fornecedorId: compra.fornecedorId, chegadaId: extra?.chegadaId || "", caminhao: caminhoes.join(", "), itens, status: diverge ? "divergente" : "confere", obs: motivo || "", parcial: true, criadoPor: S.eu, criadoEm: agora() });
}

function Recebimento({ s, c }) {
  const gestor = papelDe(s) === "gestor";
  const [aba, setAba] = useState("novo");
  const [caminhao, setCaminhao] = useState(""); const [marc, setMarc] = useState([]);
  const [cel, setCel] = useState({}); const [split, setSplit] = useState({}); const [abrir, setAbrir] = useState({}); const [colSel, setColSel] = useState(null); const [novoLocal, setNovoLocal] = useState(null);
  const [obs, setObs] = useState(""); const [chave, setChave] = useState(novoId("R")); const [oc, rodar] = useAcao();
  const [res, setRes] = useState(null); const [busca, setBusca] = useState(""); const [encerrar, setEncerrar] = useState(null); const [motEnc, setMotEnc] = useState("");
  const nf = (id) => s.fornecedores.find((f) => f.id === id)?.nome || "";
  const notaTxt = (x) => (x ? nf(x.fornecedorId) + (x.numeroNota ? " nº " + x.numeroNota : "") + " (" + dataBR(x.dataRecebimento) + ")" : "");
  const recM = recebidoMap(s); const rec = (k) => recM.get(k) || 0;
  const pend = s.compras.filter((x) => x.status !== "cancelada" && !x.rendeu && !c.conf.get(x.id)).sort((a, b) => (a.criadoEm < b.criadoEm ? -1 : 1));
  const totNota = (x) => x.itens.reduce((a, i) => a + i.caixas, 0);
  const totRec = (x) => x.itens.reduce((a, i) => { const tps = tiposDo(i); return a + (tps.length ? tps.reduce((b, t) => b + rec(x.id + "|" + i.loteId + "|" + t.tipoCaixaId), 0) : rec(x.id + "|" + i.loteId + "|")); }, 0);
  const sel = pend.filter((x) => marc.includes(x.id));
  // planilha: uma linha por produto + tipo de caixa, com o que ainda falta receber
  const mapa = new Map();
  for (const x of sel) x.itens.forEach((i) => {
    const tps = tiposDo(i); const lista = tps.length ? tps.map((t) => ({ tipo: t.tipoCaixaId, q: t.caixas })) : [{ tipo: "", q: i.caixas }];
    for (const t of lista) { const ja = rec(x.id + "|" + i.loteId + "|" + t.tipo); const falta = Math.max(0, t.q - ja); const key = i.produtoId + "|" + t.tipo; if (!mapa.has(key)) mapa.set(key, { key, produtoId: i.produtoId, tipo: t.tipo, nota: 0, ja: 0, falta: 0, partes: [] }); const r = mapa.get(key); r.nota += t.q; r.ja += ja; r.falta += falta; r.partes.push({ compraId: x.id, itemId: i.loteId, produtoId: i.produtoId, tipo: t.tipo, q: falta, localId: i.localId || null }); }
  });
  const linhas = [...mapa.values()].sort((a, b) => (c.prod.get(a.produtoId)?.nome || "").localeCompare(c.prod.get(b.produtoId)?.nome || "") || (c.tipos.get(a.tipo)?.nome || "").localeCompare(c.tipos.get(b.tipo)?.nome || ""));
  const vazioOu = (v) => v === "" || v == null;
  const num = (v) => vazioOu(v) || Number.isInteger(somaTxt(v));
  const val = (v) => (vazioOu(v) ? 0 : somaTxt(v));
  // colunas = locais de origem cadastrados (escolhidos para esta chegada)
  const locAtivos = s.locais.filter((l) => l.ativo !== false).sort((a, b) => a.nome.localeCompare(b.nome));
  // colunas: as escolhidas; se ainda não escolheu, os locais previstos nas notas marcadas (ou todos)
  const previstos = [...new Set(sel.flatMap((x) => x.itens.map((i) => i.localId)).filter(Boolean))];
  const cols = colSel ? locAtivos.filter((l) => colSel.includes(l.id)) : previstos.length ? locAtivos.filter((l) => previstos.includes(l.id)) : locAtivos;
  const ck = (r, l) => r.key + "|" + l.id;
  // total digitado por linha (soma das colunas); "x" = alguma célula inválida
  const cheg = {}; for (const r of linhas) { const vs = cols.map((l) => cel[ck(r, l)]).filter((v) => !vazioOu(v)); cheg[r.key] = !vs.length ? "" : vs.every((v) => num(v)) ? String(vs.reduce((a, v) => a + val(v), 0)) : "x"; }
  const auto = (r, total) => { let rest = total; return r.partes.map((p, i) => { const v = i === r.partes.length - 1 ? rest : Math.min(p.q, rest); rest -= v; return v; }); };
  const aloc = (r) => { const t = cheg[r.key]; if (!num(t)) return null; const m = split[r.key]; if (m && r.partes.length > 1) return m.map((v) => (num(v) ? val(v) : NaN)); return auto(r, val(t)); };
  const linhaOk = (r) => { const a = aloc(r); return a && a.every((v) => Number.isInteger(v) && v >= 0) && a.reduce((x, y) => x + y, 0) === val(cheg[r.key]); };
  const totalAgora = linhas.reduce((x, r) => x + (num(cheg[r.key]) ? val(cheg[r.key]) : 0), 0);
  const pode = sel.length && linhas.length && cols.length && linhas.every(linhaOk) && totalAgora > 0;
  const tag = (d) => (d === 0 ? html`<span class="tag">Confere</span>` : d < 0 ? html`<span class="tag red">Faltou ${-d}</span>` : html`<span class="tag warn">Sobrou ${d}</span>`);
  const situ = (r) => { if (vazioOu(cheg[r.key]) || !num(cheg[r.key])) return null; const resta = r.falta - val(cheg[r.key]); return resta === 0 ? html`<span class="tag">Completo</span>` : resta > 0 ? html`<span class="tag warn">Ainda faltam ${resta}</span>` : html`<span class="tag red">Sobrou ${-resta}</span>`; };
  const prox = (e) => { if (e.key !== "Enter") return; e.preventDefault(); const ins = [...document.querySelectorAll("input[data-pl]")]; const i = ins.indexOf(e.target); if (ins[i + 1]) { ins[i + 1].focus(); ins[i + 1].select(); } };
  const caminhoes = [...new Set(s.chegadas.map((x) => x.caminhao).concat(s.conferencias.map((x) => x.caminhao)).filter((x) => x && x !== "—"))];
  const limpar = () => { setMarc([]); setCel({}); setSplit({}); setAbrir({}); setObs(""); setChave(novoId("R")); };
  const gravarTudo = () => rodar(async () => {
    const em = agora();
    // cada local vira uma chegada separada; a quantidade de cada local é encaixada nas notas pela divisão da linha
    const grupos = new Map(); const nomesLocais = [];
    for (const r of linhas) {
      const a = aloc(r).slice();
      for (const l of cols) {
        let q = val(cel[ck(r, l)]); if (!q) continue;
        if (!nomesLocais.includes(l.nome)) nomesLocais.push(l.nome);
        r.partes.forEach((p, i) => { if (q <= 0 || a[i] <= 0) return; const v = Math.min(q, a[i]); a[i] -= v; q -= v; const g = l.id + "|" + p.compraId; if (!grupos.has(g)) grupos.set(g, { loc: l, compraId: p.compraId, itens: [] }); grupos.get(g).itens.push({ itemId: p.itemId, produtoId: p.produtoId, tipo: p.tipo, q: v }); });
      }
    }
    const porCompra = new Set(); const novo = new Map(recM);
    for (const [g, x] of grupos) {
      await gravar("chegadas", chave + "_" + x.loc.id + "_" + x.compraId, { chegadaId: chave + "_" + x.loc.id, caminhao: x.loc.nome, localId: x.loc.id, compraId: x.compraId, itens: x.itens, obs: obs.trim(), criadoPor: S.eu, criadoEm: em });
      porCompra.add(x.compraId);
      for (const it of x.itens) { const k = x.compraId + "|" + it.itemId + "|" + it.tipo; novo.set(k, (novo.get(k) || 0) + it.q); }
    }
    const cam = nomesLocais.join(", ");
    // nota completa (tudo chegou, ou mais) → fecha a conferência sozinha
    const r2 = (k) => novo.get(k) || 0;
    for (const x of sel) {
      if (!porCompra.has(x.id)) continue;
      const completa = x.itens.every((i) => { const tps = tiposDo(i); return tps.length ? tps.every((t) => r2(x.id + "|" + i.loteId + "|" + t.tipoCaixaId) >= t.caixas) : r2(x.id + "|" + i.loteId + "|") >= i.caixas; });
      if (completa) await fecharNota({ ...s, chegadas: [...s.chegadas, { compraId: x.id, caminhao: cam }] }, x, r2, { chegadaId: chave, caminhao: cam }, obs.trim());
    }
    // mantém as notas que ainda faltam marcadas; limpa só o que foi digitado
    setCel({}); setSplit({}); setAbrir({}); setObs(""); setChave(novoId("R"));
  }, "Chegada gravada: o que você digitou foi para \"Já recebido\"");
  const recebeuTudo = (x) => rodar(async () => {
    if (!confirm(`Confirmar que chegou TUDO da ${notaTxt(x)} (${totNota(x) - totRec(x)} cx que faltavam)?`)) return;
    const loc = s.locais.find((l) => l.id === x.localId) || s.locais.filter((l) => l.ativo !== false)[0] || { id: "geral", nome: "Recebido" };
    const itens = []; const novo = new Map(recM);
    for (const i of x.itens) { const tps = tiposDo(i);
      const partes = tps.length ? tps.map((t) => ({ tipo: t.tipoCaixaId, nota: t.caixas })) : [{ tipo: "", nota: i.caixas }];
      for (const p of partes) { const k = x.id + "|" + i.loteId + "|" + p.tipo; const falta = p.nota - (recM.get(k) || 0); if (falta > 0) { itens.push({ itemId: i.loteId, produtoId: i.produtoId, tipo: p.tipo, q: falta }); novo.set(k, (novo.get(k) || 0) + falta); } } }
    const ch = novoId("R");
    if (itens.length) await gravar("chegadas", ch + "_" + loc.id + "_" + x.id, { chegadaId: ch + "_" + loc.id, caminhao: loc.nome, localId: loc.id, compraId: x.id, itens, obs: "Recebeu tudo", criadoPor: S.eu, criadoEm: agora() });
    const r2 = (k) => novo.get(k) || 0;
    await fecharNota({ ...s, chegadas: [...s.chegadas, { compraId: x.id, caminhao: loc.nome }] }, x, r2, { chegadaId: ch, caminhao: loc.nome }, "Recebeu tudo");
    setMarc(marc.filter((y) => y !== x.id));
  }, "Nota recebida completa ✅");
  const div = s.conferencias.filter((x) => x.status === "divergente" && !x.resolucao);
  const todas = listaChegadas(s);
  const grupos = new Map();
  for (const x of todas) { const g = x.chegadaId; if (!grupos.has(g)) grupos.set(g, { id: g, caminhao: x.caminhao || "—", em: x.criadoEm, por: x.criadoPor, compras: [], cx: 0 }); const gg = grupos.get(g); gg.compras.push(x.compraId); gg.cx += x.itens.reduce((a, i) => a + i.q, 0); }
  const hist = [...grupos.values()].sort((a, b) => (a.em < b.em ? 1 : -1)).slice(0, 80);
  const bq = busca.trim().toLowerCase();
  const porProd = todas.flatMap((x) => { const comp = s.compras.find((k) => k.id === x.compraId); return comp ? x.itens.filter((i) => i.q > 0).map((i) => ({ ...i, em: x.criadoEm, caminhao: x.caminhao || "—", comp })) : []; })
    .filter((r) => !bq || (c.prod.get(r.produtoId)?.nome || "").toLowerCase().includes(bq) || r.caminhao.toLowerCase().includes(bq) || (r.comp.numeroNota || "").toLowerCase().includes(bq) || nf(r.comp.fornecedorId).toLowerCase().includes(bq))
    .sort((a, b) => (a.em < b.em ? 1 : -1)).slice(0, 300);
  const compraP = encerrar ? s.compras.find((x) => x.id === encerrar) : null;
  return html`<div class="pag"><h1>Recebimento de Mercadorias</h1>
    <${Tabs} abas=${[["novo", "Receber caminhão" + (pend.length ? " (" + pend.length + " notas)" : "")], ["div", "Divergências" + (div.length ? " (" + div.length + ")" : "")], ["hist", "Chegadas"], ["prod", "Por produto"]]} atual=${aba} set=${setAba}/>
    ${aba === "novo" ? html`
    <div class="card"><div class="cab"><h2>1. De onde veio a mercadoria</h2><button class="btn out sm" onClick=${() => setNovoLocal("")}>+ Cadastrar local</button></div>
      ${locAtivos.length ? html`<p class="txt">Cada local marcado vira uma coluna na planilha. Toque para tirar ou pôr.</p>
        <div class="chips">${locAtivos.map((l) => { const on = cols.some((x) => x.id === l.id); return html`<button class=${on ? "on" : ""} onClick=${() => { const atual = cols.map((x) => x.id); setColSel(on ? atual.filter((x) => x !== l.id) : [...atual, l.id]); }}>${on ? "✓ " : ""}${l.nome}</button>`; })}</div>` : html`<p class="av">Cadastre os locais de onde vem a mercadoria (ex.: ENC, Ceasa box 12, Caminhão do Zé).</p>`}
    </div>
    <div class="card"><div class="cab"><h2>2. Notas que estão chegando</h2>${pend.length ? html`<div class="acoes"><button class="btn ghost sm" onClick=${() => setMarc(pend.map((x) => x.id))}>Marcar todas</button><button class="btn ghost sm" onClick=${() => setMarc([])}>Desmarcar</button></div>` : null}</div>
      <p class="txt">A mesma nota pode chegar em partes, em caminhões diferentes. Ela fica aqui até chegar tudo.</p>
      ${pend.length ? html`<div class="tab"><table><thead><tr><th></th><th>Nota</th><th>Produtos</th><th class="r">Recebido</th><th></th></tr></thead><tbody>${pend.map((x) => { const tn = totNota(x), tr = totRec(x); return html`<tr><td style="cursor:pointer" onClick=${() => setMarc(marc.includes(x.id) ? marc.filter((y) => y !== x.id) : [...marc, x.id])}><input type="checkbox" style="width:20px;min-height:20px;height:20px" checked=${marc.includes(x.id)}/></td><td style="cursor:pointer" onClick=${() => setMarc(marc.includes(x.id) ? marc.filter((y) => y !== x.id) : [...marc, x.id])}><b>${notaTxt(x)}</b><br/>${tr ? html`<span class="tag warn">Recebendo em partes</span>` : html`<span class="tag gray">Nada chegou ainda</span>`}</td><td>${x.itens.map((i) => `${c.prod.get(i.produtoId)?.nome} ${i.caixas}`).join(" · ")}</td><td class="r"><b>${tr}</b> de ${tn} cx</td><td style="white-space:nowrap"><button class="btn sm" disabled=${oc} onClick=${() => recebeuTudo(x)}>✅ Recebeu tudo</button> ${tr ? html`<button class="btn ghost sm" onClick=${() => { setEncerrar(x.id); setMotEnc(""); }}>Encerrar (o resto não vem)</button>` : null}</td></tr>`; })}</tbody></table></div>` : html`<${Vazio}>Nenhuma nota esperando. Registre a nota em Entrada primeiro.</${Vazio}>`}
    </div>
    ${linhas.length ? html`<div class="card"><div class="cab"><h2>3. O que chegou agora</h2>${cols.length === 1 ? html`<button class="btn out sm" onClick=${() => { const n = {}; linhas.forEach((r) => (n[ck(r, cols[0])] = r.falta ? String(r.falta) : "")); setCel(n); setSplit({}); }}>Chegou tudo que falta (${cols[0].nome})</button>` : null}</div>
      <p class="txt">Digite em cada coluna quantas caixas vieram daquele local (pode somar: 20+20). Enter vai para a próxima célula. Deixe em branco o que não veio.</p>
      ${!cols.length ? html`<p class="av">Marque pelo menos um local no passo 1.</p>` : null}
      <div class="tab"><table><thead><tr><th>Produto</th><th>Caixa</th><th class="r">Na nota</th><th class="r">Já recebido</th><th class="r">Falta</th>${cols.map((l) => html`<th style="width:100px;text-align:center;background:#E7F1E2">${l.nome}</th>`)}<th class="r">Chegou agora</th><th>Situação</th><th>Em qual nota</th></tr></thead><tbody>
      ${linhas.map((r) => { const t = cheg[r.key]; const a = aloc(r); const varias = r.partes.length > 1; const resta = num(t) && !vazioOu(t) ? r.falta - val(t) : 0; const aberto = abrir[r.key] || (varias && resta < 0);
        return html`<tr style=${r.falta === 0 ? "opacity:.55" : ""}><td><b>${c.prod.get(r.produtoId)?.nome}</b></td><td>${c.tipos.get(r.tipo)?.nome || "—"}</td><td class="r">${r.nota}</td><td class="r">${r.ja || ""}</td><td class="r"><b>${r.falta}</b></td>
          ${cols.map((l) => { const v = cel[ck(r, l)] || ""; return html`<td style="background:#F6FBF3"><input data-pl inputmode="tel" title=${l.nome + " — pode somar: 20+20"} style=${"min-height:36px;text-align:right;" + (v && !num(v) ? "border-color:var(--err)" : "")} value=${v} onKeyDown=${prox} onInput=${(e) => { setCel({ ...cel, [ck(r, l)]: e.target.value }); if (split[r.key]) { const n = { ...split }; delete n[r.key]; setSplit(n); } }}/>${/\+/.test(v) && num(v) ? html`<small class="txt">= ${val(v)}</small>` : null}</td>`; })}
          <td class="r"><b>${t === "x" ? "" : t}</b>${t === "x" ? html`<small style="color:var(--err)">Use só números e +</small>` : null}</td>
          <td>${situ(r)}</td>
          <td>${!varias ? html`<small>${notaTxt(s.compras.find((x) => x.id === r.partes[0].compraId))}${r.partes[0].localId ? " · 📍 " + (s.locais.find((k) => k.id === r.partes[0].localId)?.nome || "") : ""}</small>` : html`<div style="display:flex;flex-direction:column;gap:4px">${r.partes.map((p, i) => html`<div style="display:flex;gap:6px;align-items:center"><small style="flex:1">${notaTxt(s.compras.find((x) => x.id === p.compraId))}: falta ${p.q}</small>${aberto ? html`<input inputmode="numeric" style="width:70px;min-height:32px;text-align:right" value=${split[r.key] ? split[r.key][i] : a ? a[i] : ""} onInput=${(e) => { const base = split[r.key] || (a ? a.map(String) : r.partes.map(() => "")); setSplit({ ...split, [r.key]: base.map((v, z) => (z === i ? e.target.value : v)) }); }}/>` : null}</div>`)}
            ${!aberto ? html`<button class="btn ghost sm" style="align-self:flex-start" onClick=${() => setAbrir({ ...abrir, [r.key]: true })}>Dividir por nota</button>` : !linhaOk(r) ? html`<small style="color:var(--err)">A soma das notas tem que dar ${val(t)}</small>` : null}</div>`}</td></tr>`; })}
      </tbody><tfoot><tr><td colspan="2"><b>Total</b></td><td class="r"><b>${linhas.reduce((x, r) => x + r.nota, 0)}</b></td><td class="r"><b>${linhas.reduce((x, r) => x + r.ja, 0)}</b></td><td class="r"><b>${linhas.reduce((x, r) => x + r.falta, 0)}</b></td>${cols.map((l) => html`<td class="r"><b>${linhas.reduce((x, r) => x + (num(cel[ck(r, l)]) ? val(cel[ck(r, l)]) : 0), 0)}</b></td>`)}<td class="r"><b>${totalAgora}</b></td><td colspan="2"></td></tr></tfoot></table></div>
      <${Campo} r="Observação de quem recebeu"><input value=${obs} onInput=${(e) => setObs(e.target.value)} placeholder="Ex.: 2 caixas de tomate amassadas"/></${Campo}>
      <div class="lin"><span class="txt">${totalAgora} cx nesta chegada · ${sel.length} nota(s)${!cols.length ? html` · <b style="color:var(--err)">Marque os locais no passo 1</b>` : !totalAgora ? " · digite o que chegou" : ""}</span><button class="btn" disabled=${!pode || oc} onClick=${gravarTudo}>Gravar chegada</button></div>
    </div>` : null}` : null}
    ${aba === "div" ? html`<div class="card"><h2>Com divergência</h2>${div.length ? html`<div class="tab"><table><thead><tr><th>Local</th><th>Nota</th><th>O que aconteceu</th><th>Fechada por</th><th></th></tr></thead><tbody>${div.map((x) => { const comp = s.compras.find((k) => k.id === x.compraId); return html`<tr><td>${x.caminhao || "—"}</td><td>${comp ? notaTxt(comp) : nf(x.fornecedorId)}</td><td>${resumoDiv(c, x)}${x.obs ? html`<br/><small class="txt">${x.obs}</small>` : ""}</td><td>${nomePessoa(s, x.criadoPor)} · ${dataHora(x.criadoEm)}</td><td><a class="link" href=${"#entrada-" + x.compraId}>Ficha</a> ${gestor ? html`<button class="btn sm" onClick=${() => setRes(x)}>Resolver</button>` : null}</td></tr>`; })}</tbody></table></div>` : html`<${Vazio}>Nenhuma divergência aberta.</${Vazio}>`}</div>` : null}
    ${aba === "hist" ? html`<div class="card"><h2>Chegadas (por local)</h2>${hist.length ? html`<div class="tab"><table><thead><tr><th>Quando</th><th>Local</th><th class="r">Caixas</th><th>Notas</th><th>Situação da nota</th><th>Por</th></tr></thead><tbody>${hist.map((g) => html`<tr><td>${dataHora(g.em)}</td><td><b>${g.caminhao}</b></td><td class="r">${g.cx}</td><td>${g.compras.map((id) => html`<div><a class="link" href=${"#entrada-" + id}>${notaTxt(s.compras.find((k) => k.id === id)) || "—"}</a></div>`)}</td><td>${g.compras.map((id) => html`<div>${statusConf(c.conf.get(id), true)}</div>`)}</td><td>${nomePessoa(s, g.por)}</td></tr>`)}</tbody></table></div>` : html`<${Vazio}>Nenhuma ainda.</${Vazio}>`}</div>` : null}
    ${aba === "prod" ? html`<div class="card"><div class="cab"><h2>Recebido por produto</h2><input placeholder="🔎 Produto, local, fornecedor ou nº da nota" value=${busca} onInput=${(e) => setBusca(e.target.value)} style="max-width:320px"/></div>${porProd.length ? html`<div class="tab"><table><thead><tr><th>Quando</th><th>Produto</th><th>Caixa</th><th class="r">Chegou</th><th>Local</th><th>Em qual nota</th><th>Situação da nota</th></tr></thead><tbody>${porProd.map((r) => html`<tr><td>${dataHora(r.em)}</td><td><b>${c.prod.get(r.produtoId)?.nome}</b></td><td>${c.tipos.get(r.tipo)?.nome || "—"}</td><td class="r">${r.q} cx</td><td>${r.caminhao}</td><td><a class="link" href=${"#entrada-" + r.comp.id}>${notaTxt(r.comp)}</a></td><td>${statusConf(c.conf.get(r.comp.id), true)}</td></tr>`)}</tbody></table></div>` : html`<${Vazio}>Nada encontrado.</${Vazio}>`}</div>` : null}
    ${res ? html`<${Resolver} s=${s} c=${c} conf=${res} onFechar=${() => setRes(null)}/>` : null}
    ${novoLocal != null ? html`<${LocalForm} l=${null} onFechar=${() => setNovoLocal(null)} onSalvo=${(id) => colSel && setColSel([...colSel, id])}/>` : null}
    ${compraP ? html`<${Modal} titulo="Encerrar o recebimento desta nota" sub=${notaTxt(compraP) + ": chegaram " + totRec(compraP) + " de " + totNota(compraP) + " cx. O que faltou vira divergência para o gestor resolver."} onFechar=${() => setEncerrar(null)} rod=${html`<button class="btn out" onClick=${() => setEncerrar(null)}>Voltar</button><button class="btn" disabled=${motEnc.trim().length < 3 || oc} onClick=${() => rodar(async () => { await fecharNota(s, compraP, rec, null, motEnc.trim()); setEncerrar(null); setMarc(marc.filter((y) => y !== compraP.id)); }, "Nota encerrada")}>Encerrar</button>`}><${Campo} r="Por que o resto não vem"><input value=${motEnc} onInput=${(e) => setMotEnc(e.target.value)} placeholder="Ex.: fornecedor não tinha o produto"/></${Campo}></${Modal}>` : null}
  </div>`;
}
const resumoDiv = (c, x) => x.itens.flatMap((i) => (i.porTipo && i.porTipo.length ? i.porTipo.filter((t) => t.chegou !== t.nota).map((t) => `${c.prod.get(i.produtoId)?.nome} (${c.tipos.get(t.tipo)?.nome || ""}): nota ${t.nota}, chegou ${t.chegou}`) : i.caixas !== i.notaCaixas ? [`${c.prod.get(i.produtoId)?.nome}: nota ${i.notaCaixas}, chegou ${i.caixas}`] : [])).join("; ");

function CorrigirCustos({ s, c, x, onFechar }) {
  const cx = (n) => txtReais(n);
  const [vals, setVals] = useState(Object.fromEntries(x.itens.map((i) => [i.loteId, cx(i.valorCaixa ?? Math.round(i.valor / i.caixas))])));
  const [fr, setFr] = useState(cx(x.fretePorCaixa ?? (x.itens.length ? Math.round((x.itens[0].frete || 0) / x.itens[0].caixas) : 0)));
  const [com, setCom] = useState(cx(x.comissaoPorCaixa ?? (x.itens.length ? Math.round((x.itens[0].comissao || 0) / x.itens[0].caixas) : 0)));
  const [mot, setMot] = useState(""); const [oc, rodar] = useAcao();
  // quantidade: um campo por item, ou um por tipo de caixa quando o item tem mais de um tipo
  const [qts, setQts] = useState(Object.fromEntries(x.itens.map((i) => [i.loteId, tiposDo(i).length > 1 ? tiposDo(i).map((t) => String(t.caixas)) : String(i.caixas)])));
  const qtdDe = (i) => { const q = qts[i.loteId]; return Array.isArray(q) ? q.reduce((a, v) => a + somaTxt(v), 0) : somaTxt(q); };
  const freteTravado = !!x.fretePagoSessaoId;
  const frCx = freteTravado ? null : paraCentavos(fr) || 0, comCx = paraCentavos(com) || 0;
  const novos = x.itens.map((i) => {
    const n = qtdDe(i); const v = paraCentavos(vals[i.loteId]); const tps = tiposDo(i);
    const tipos = tps.length > 1 ? tps.map((t, j) => ({ ...t, caixas: somaTxt(qts[i.loteId][j]) })) : tps.length === 1 ? [{ ...tps[0], caixas: n }] : [];
    const frete = freteTravado ? Math.round(((i.frete || 0) / i.caixas) * n) : frCx * n; const comissao = comCx * n;
    return { ...i, caixas: n, tipos, valorCaixa: v, valor: v * n, frete, comissao, custoFinal: v * n + frete + comissao };
  });
  const usadoDe = (i) => { const l = c.L.get(i.loteId); return l ? (l.vendidoCx || 0) + (l.perdaCx || 0) : 0; };
  const ok = novos.every((i) => Number.isInteger(i.caixas) && i.caixas > 0 && (i.tipos || []).every((t) => Number.isInteger(t.caixas) && t.caixas >= 0)) && novos.every((i) => Number.isFinite(i.valorCaixa) && i.valorCaixa >= 0) && Number.isFinite(comCx) && (freteTravado || Number.isFinite(frCx)) && mot.trim().length >= 3;
  const tot = (arr) => arr.reduce((a, i) => a + i.custoFinal, 0);
  const afetadas = s.vendas.filter((v) => v.status !== "cancelada" && v.itens.some((it) => (it.consumo || []).some((d) => x.itens.some((i) => i.loteId === d.loteId)))).length;
  return html`<${Modal} grande titulo="Atualizar entrada" sub=${"Corrija quantidade, valor, frete ou comissão. A quantidade muda o estoque. O custo muda e o lucro das vendas de caixa ainda aberto é recalculado" + (afetadas ? " (" + afetadas + " venda(s) usaram esta nota)" : "") + ". Caixa já fechado não muda."} onFechar=${onFechar} rod=${html`<button class="btn out" onClick=${onFechar}>Cancelar</button><button class="btn" disabled=${!ok || oc} onClick=${() => rodar(async () => {
    const antes = { itens: x.itens.map((i) => ({ loteId: i.loteId, caixas: i.caixas, valorCaixa: i.valorCaixa, valor: i.valor, frete: i.frete, comissao: i.comissao, custoFinal: i.custoFinal })), frete: x.frete, comissao: x.comissao || 0, valorTotal: x.valorTotal };
    await alterar("compras", x.id, { itens: novos, valorTotal: novos.reduce((a, i) => a + i.valor, 0), frete: novos.reduce((a, i) => a + (i.frete || 0), 0), comissao: novos.reduce((a, i) => a + (i.comissao || 0), 0), ...(freteTravado ? {} : { fretePorCaixa: frCx }), comissaoPorCaixa: comCx, correcoes: [...(x.correcoes || []), { em: agora(), por: S.eu, motivo: mot.trim(), antes }] });
    onFechar();
  }, "Entrada atualizada")}>Salvar atualização</button>`}>
    <div class="tab"><table><thead><tr><th>Produto</th><th>Quantidade</th><th>Valor por ${"cx/saco"} (R$)</th><th class="r">Custo/cx antes</th><th class="r">Custo/cx novo</th></tr></thead><tbody>
      ${novos.map((i, k) => html`<tr><td><b>${c.prod.get(i.produtoId)?.nome}</b>${usadoDe(i) ? html`<br/><small class="txt">já saíram ${usadoDe(i)} cx</small>` : null}</td><td>${Array.isArray(qts[i.loteId]) ? html`<div style="display:flex;flex-direction:column;gap:4px">${tiposDo(x.itens[k]).map((t, j) => html`<div style="display:flex;gap:6px;align-items:center"><small style="min-width:70px">${c.tipos.get(t.tipoCaixaId)?.nome || ""}</small><input inputmode="tel" style="max-width:80px;text-align:right" value=${qts[i.loteId][j]} onInput=${(e) => setQts({ ...qts, [i.loteId]: qts[i.loteId].map((v, y) => (y === j ? e.target.value : v)) })}/></div>`)}<small class="txt">total ${Number.isFinite(i.caixas) ? i.caixas : "—"}</small></div>` : html`<input inputmode="tel" style="max-width:90px;text-align:right" value=${qts[i.loteId]} onInput=${(e) => setQts({ ...qts, [i.loteId]: e.target.value })}/>`}${Number.isInteger(i.caixas) && i.caixas !== x.itens[k].caixas ? html`<br/><small style="color:var(--warn)">era ${x.itens[k].caixas}</small>` : null}${Number.isInteger(i.caixas) && i.caixas < usadoDe(i) ? html`<br/><small style="color:var(--err)">menos do que já saiu: estoque fica negativo</small>` : null}</td><td><input inputmode="decimal" style="max-width:130px;text-align:right" value=${vals[i.loteId]} onInput=${(e) => setVals({ ...vals, [i.loteId]: e.target.value })}/></td><td class="r">${reais(Math.round(x.itens[k].custoFinal / x.itens[k].caixas))}</td><td class="r"><b>${Number.isFinite(i.custoFinal) ? reais(Math.round(i.custoFinal / i.caixas)) : "—"}</b></td></tr>`)}
    </tbody></table></div>
    <div class="grade">
      <${Campo} r="Frete por caixa (R$)" d=${freteTravado ? "O frete foi pago com dinheiro do caixa: não dá para mudar aqui" : ""}><input inputmode="decimal" disabled=${freteTravado} value=${fr} onInput=${(e) => setFr(e.target.value)}/></${Campo}>
      <${Campo} r="Comissão por caixa (R$)" d="Coloque 0 se o preço já vem com a comissão"><input inputmode="decimal" value=${com} onInput=${(e) => setCom(e.target.value)}/></${Campo}>
      <${Campo} r="Motivo da correção"><input value=${mot} onInput=${(e) => setMot(e.target.value)} placeholder="Ex.: fornecedor deu desconto"/></${Campo}>
    </div>
    <p class="txt">Quantidade: ${x.itens.reduce((a, i) => a + i.caixas, 0)} → <b>${novos.reduce((a, i) => a + (Number.isFinite(i.caixas) ? i.caixas : 0), 0)}</b> · Total da nota: ${reais(tot(x.itens))} → <b>${Number.isFinite(tot(novos)) ? reais(tot(novos)) : "—"}</b></p>
  </${Modal}>`;
}

function FichaEntrada({ s, c, id }) {
  const x = s.compras.find((k) => k.id === id);
  const [res, setRes] = useState(false); const [canc, setCanc] = useState(false); const [mot, setMot] = useState(""); const [oc, rodar] = useAcao(); const [corr, setCorr] = useState(false);
  if (!x) return html`<div class="pag"><${Vazio}>Entrada não encontrada.</${Vazio}></div>`;
  const cf = c.conf.get(x.id); const gestor = papelDe(s) === "gestor";
  const chs = s.chegadas.filter((k) => k.compraId === x.id).sort((a, b) => (a.criadoEm < b.criadoEm ? -1 : 1)); const recM = recebidoMap(s);
  const vendasDoLote = (lid) => s.vendas.filter((v) => v.status !== "cancelada" && v.itens.some((i) => (i.consumo || []).some((d) => d.loteId === lid && !d.abre)));
  const usado = x.itens.some((i) => { const l = c.L.get(i.loteId); return l && (l.vendidoCx || l.vendidoG || l.perdaCx || l.perdaG || l.ajusteCx || l.ajusteG); });
  return html`<div class="pag">
    <div class="cab"><h1>Ficha da entrada</h1><div class="acoes"><a class="btn out" href="#entrada">Voltar</a>${gestor && x.status !== "cancelada" ? html`<button class="btn out" onClick=${() => setCorr(true)}>Atualizar entrada</button>` : null}${gestor && x.status !== "cancelada" && !usado ? html`<button class="btn red" onClick=${() => setCanc(true)}>Cancelar entrada</button>` : null}</div></div>
    <div class="grade">
      <${Num} r="Fornecedor" v=${s.fornecedores.find((f) => f.id === x.fornecedorId)?.nome || ""} d=${x.numeroNota ? "Nota nº " + x.numeroNota : ""}/>
      <${Num} r="Chegada" v=${dataBR(x.dataRecebimento)} d=${"compra " + dataBR(x.dataCompra)}/>
      <${Num} r="Total da entrada" v=${reais(x.valorTotal + x.frete + (x.comissao || 0))} d=${"mercadoria " + reais(x.valorTotal) + " · frete " + reais(x.frete) + (x.comissao ? " · comissão " + reais(x.comissao) : "")}/>
      <${Num} r="Registrada por" v=${nomePessoa(s, x.criadoPor)} d=${dataHora(x.criadoEm)}/>
    </div>
    <div class="card"><div class="cab"><h2>Nota × o que chegou</h2>${x.status === "cancelada" ? html`<span class="tag red">Cancelada</span>` : statusConf(cf, chs.length > 0)}</div>
      <div class="tab"><table><thead><tr><th>Produto</th><th>Tipo de caixa</th><th class="r">Nota</th><th class="r">Chegou</th><th>Resultado</th><th class="r">Custo/cx</th></tr></thead><tbody>${x.itens.flatMap((i) => { const ci = cf?.itens.find((k) => k.itemId === i.loteId); const tps = tiposDo(i); const linhas = tps.length ? tps.map((t) => ({ tipo: t.tipoCaixaId, nota: t.caixas, chegou: ci ? (ci.porTipo || []).find((p) => p.tipo === t.tipoCaixaId)?.chegou ?? (tps.length === 1 ? ci.caixas : null) : chs.length ? recM.get(x.id + "|" + i.loteId + "|" + t.tipoCaixaId) || 0 : null })) : [{ tipo: null, nota: i.caixas, chegou: ci ? ci.caixas : chs.length ? recM.get(x.id + "|" + i.loteId + "|") || 0 : null }]; return linhas.map((t, j) => { const d = t.chegou == null ? null : t.chegou - t.nota; return html`<tr><td>${j === 0 ? html`<b>${c.prod.get(i.produtoId)?.nome}</b> <small class="txt">× ${kg(i.pesoCaixaG)}${i.localId ? " · 📍 " + (s.locais.find((k) => k.id === i.localId)?.nome || "") : ""}</small>` : ""}</td><td>${c.tipos.get(t.tipo)?.nome || "—"}</td><td class="r">${t.nota} cx</td><td class="r">${t.chegou == null ? "—" : t.chegou + " cx"}</td><td>${d == null ? html`<span class="tag warn">A conferir</span>` : !cf && d < 0 ? html`<span class="tag warn">Faltam chegar ${-d}</span>` : d === 0 ? html`<span class="tag">Confere</span>` : html`<span class="tag red">${d < 0 ? "Faltou " + -d : "Sobrou " + d}</span>`}</td><td class="r">${j === 0 ? reais(Math.round(i.custoFinal / i.caixas)) : ""}</td></tr>`; }); })}</tbody></table></div>
      ${chs.length ? html`<div class="tab" style="margin-top:8px"><table><thead><tr><th>Chegada</th><th>Local</th><th>O que veio</th><th>Por</th></tr></thead><tbody>${chs.map((k) => html`<tr><td>${dataHora(k.criadoEm)}</td><td><b>${k.caminhao}</b></td><td>${k.itens.map((i) => `${c.prod.get(i.produtoId)?.nome}${i.tipo ? " (" + (c.tipos.get(i.tipo)?.nome || "") + ")" : ""} ${i.q} cx`).join("; ")}${k.obs ? html`<br/><small class="txt">${k.obs}</small>` : ""}</td><td>${nomePessoa(s, k.criadoPor)}</td></tr>`)}</tbody></table></div>` : null}
      ${cf ? html`<p class="txt">${cf.caminhao ? html`Veio de <b>${cf.caminhao}</b>. ` : ""}Conferido por ${nomePessoa(s, cf.criadoPor)} em ${dataHora(cf.criadoEm)}${cf.obs ? " — " + cf.obs : ""}</p>` : null}
      ${cf?.resolucao ? html`<p class="ok">Resolvido por ${nomePessoa(s, cf.resolucao.por)} em ${dataHora(cf.resolucao.em)}: ${cf.resolucao.acao === "corrigir" ? "estoque corrigido pelo que chegou" : "combinado com o fornecedor"} — ${cf.resolucao.obs}</p>` : null}
      ${cf && cf.status === "divergente" && !cf.resolucao && gestor ? html`<button class="btn" onClick=${() => setRes(true)}>Resolver divergência</button>` : null}
    </div>
    <div class="card"><h2>O que aconteceu com esta mercadoria</h2>
      <div class="tab"><table><thead><tr><th>Produto</th><th class="r">Entrou</th><th class="r">Vendido</th><th class="r">Desperdício</th><th class="r">Ajustes</th><th class="r">Ainda no estoque</th></tr></thead><tbody>${x.itens.map((i) => { const l = c.L.get(i.loteId); if (!l) return null; return html`<tr><td>${c.prod.get(i.produtoId)?.nome}</td><td class="r">${i.caixas} cx</td><td class="r">${saldoTxt(l.vendidoCx, l.vendidoG)}</td><td class="r">${saldoTxt(l.perdaCx, l.perdaG)}</td><td class="r">${saldoTxt(l.ajusteCx, l.ajusteG)}</td><td class="r"><b>${saldoTxt(l.cx, l.g)}</b></td></tr>`; })}</tbody></table></div>
      ${x.itens.map((i) => { const vs = vendasDoLote(i.loteId); return vs.length ? html`<p class="txt"><b>${c.prod.get(i.produtoId)?.nome}</b> saiu nas vendas: ${vs.slice(0, 40).map((v) => html`<a class="link" href=${"#venda-" + v.id}>${numVenda(v.id)}</a> `)}</p>` : null; })}
    </div>
    ${(x.correcoes || []).length ? html`<div class="card"><h2>Correções de valor</h2>${x.correcoes.map((k) => html`<p class="txt" style="margin:0">${dataHora(k.em)} · ${nomePessoa(s, k.por)} — ${k.motivo} (total antes ${reais((k.antes?.itens || []).reduce((a, i) => a + (i.custoFinal || 0), 0))})</p>`)}</div>` : null}
    ${corr ? html`<${CorrigirCustos} s=${s} c=${c} x=${x} onFechar=${() => setCorr(false)}/>` : null}
    ${res ? html`<${Resolver} s=${s} c=${c} conf=${cf} onFechar=${() => setRes(false)}/>` : null}
    ${canc ? html`<${Modal} titulo="Cancelar entrada" sub="Só é possível porque nada desta entrada foi vendido ou perdido." onFechar=${() => setCanc(false)} rod=${html`<button class="btn out" onClick=${() => setCanc(false)}>Voltar</button><button class="btn red" disabled=${mot.trim().length < 3 || oc} onClick=${() => rodar(async () => {
      const minha = sessaoMinha(S); if ((x.fretePagoSessaoId || x.comissaoPagaSessaoId) && !minha) throw new Error("Abra seu caixa: o frete e a comissão pagos voltam para ele.");
      await alterar("compras", x.id, { status: "cancelada", cancelamento: { motivo: mot.trim(), por: S.eu, em: agora(), sessaoId: minha?.id || null } }); setCanc(false);
    }, "Entrada cancelada")}>Confirmar</button>`}><${Campo} r="Motivo"><input value=${mot} onInput=${(e) => setMot(e.target.value)}/></${Campo}></${Modal}>` : null}
  </div>`;
}
