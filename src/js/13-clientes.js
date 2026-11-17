// ============ CLIENTES ============
function ClienteForm({ cl, onFechar, onSalvo }) {
  const gestor = papelDe(S) === "gestor";
  const [n, setN] = useState(cl?.nome || ""); const [t, setT] = useState(cl?.telefone || ""); const [d, setD] = useState(cl?.documento || ""); const [lim, setLim] = useState(txtReais(cl?.limite || 0)); const [at, setAt] = useState(cl ? cl.ativo !== false : true); const [oc, rodar] = useAcao();
  return html`<${Modal} titulo=${cl ? "Editar cliente" : "Novo cliente"} onFechar=${onFechar} rod=${html`<button class="btn out" onClick=${onFechar}>Cancelar</button><button class="btn" disabled=${n.trim().length < 2 || oc} onClick=${() => rodar(async () => { const id = cl?.id || novoId("P"); await gravar("clientes", id, { nome: n.trim(), telefone: t.trim(), documento: d.trim(), limite: paraCentavos(lim) || 0, ativo: at, criadoEm: cl?.criadoEm || agora() }); onSalvo?.(id); onFechar(); }, "Cliente salvo")}>Salvar</button>`}>
    <${Campo} r="Nome"><input autofocus value=${n} onInput=${(e) => setN(e.target.value)}/></${Campo}>
    <div class="grade"><${Campo} r="Telefone / WhatsApp"><input inputmode="tel" value=${t} onInput=${(e) => setT(e.target.value)}/></${Campo}><${Campo} r="CPF / CNPJ"><input value=${d} onInput=${(e) => setD(e.target.value)}/></${Campo}></div>
    <${Campo} r="Limite de fiado (R$)" d=${gestor ? "Vazio = sem limite" : "Só o gestor altera"}><input inputmode="decimal" disabled=${!gestor} value=${lim} onInput=${(e) => setLim(e.target.value)}/></${Campo}>
    ${cl ? html`<label class="chk"><input type="checkbox" checked=${at} onChange=${(e) => setAt(e.target.checked)}/>Cliente ativo</label>` : null}
  </${Modal}>`;
}
function Receber({ s, c, cl, onFechar }) {
  const abertos = c.titulos.filter((t) => t.clienteId === cl.id && t.saldo > 0).sort((a, b) => ((a.venc || a.criadoEm) < (b.venc || b.criadoEm) ? -1 : 1));
  const [marc, setMarc] = useState(abertos.map((t) => t.vendaId)); const [v, setV] = useState(txtReais(abertos.reduce((a, t) => a + t.saldo, 0))); const [forma, setForma] = useState("dinheiro"); const [chave] = useState(novoId("R")); const [oc, rodar] = useAcao();
  const sel = abertos.filter((t) => marc.includes(t.vendaId)); const dev = sel.reduce((a, t) => a + t.saldo, 0); const val = paraCentavos(v);
  return html`<${Modal} titulo=${"Receber de " + cl.nome} sub="Pode receber tudo, uma parte, ou escolher quais vendas está pagando. Entra no seu caixa." onFechar=${onFechar} rod=${html`<button class="btn out" onClick=${onFechar}>Cancelar</button><button class="btn" disabled=${!(val > 0) || val > dev || oc} onClick=${() => rodar(async () => {
    const sess = sessaoMinha(S); if (!sess) throw new Error("Abra o caixa antes de receber.");
    let resto = val; const aloc = []; for (const t of sel) { if (resto <= 0) break; const x = Math.min(resto, t.saldo); aloc.push({ vendaId: t.vendaId, valor: x }); resto -= x; }
    await gravar("recebimentos", chave, { clienteId: cl.id, valor: val, forma, sessaoId: sess.id, alocacoes: aloc, criadoPor: S.eu, criadoEm: agora() }); onFechar();
  }, "Recebimento registrado")}>Receber ${Number.isFinite(val) ? reais(val) : ""}</button>`}>
    <div class="lista">${abertos.map((t) => html`<label class="chk" style="border:1px solid var(--border);border-radius:10px;padding:4px 10px"><input type="checkbox" checked=${marc.includes(t.vendaId)} onChange=${(e) => setMarc(e.target.checked ? [...marc, t.vendaId] : marc.filter((x) => x !== t.vendaId))}/><span style="flex:1">Venda ${numVenda(t.vendaId)} · ${t.venc ? "vence " + dataBR(t.venc) : dataBR(t.criadoEm)}</span><b>${reais(t.saldo)}</b></label>`)}</div>
    <div class="grade"><${Campo} r="Valor recebido (R$)" d=${"Selecionado: " + reais(dev)}><input inputmode="decimal" value=${v} onInput=${(e) => setV(e.target.value)}/></${Campo}><${Campo} r="Forma"><${Sel} valor=${forma} set=${setForma} opcoes=${FORMAS_SEL}/></${Campo}></div>
    ${val > dev ? html`<p class="av">O valor passa do selecionado.</p>` : null}
    ${forma === "pix" && val > 0 && val <= dev ? html`<${PixQR} s=${s} valor=${val} txid=${chave}/>` : null}
  </${Modal}>`;
}
function Clientes({ s, c, selId }) {
  const gestor = papelDe(s) === "gestor";
  const [b, setB] = useState(""); const [so, setSo] = useState(false); const [ed, setEd] = useState(undefined); const [rec, setRec] = useState(false); const [est, setEst] = useState(null); const [mot, setMot] = useState(""); const [mv, setMv] = useState(null); const [oc, rodar] = useAcao();
  const lista = s.clientes.filter((x) => (`${x.nome} ${x.telefone || ""}`).toLowerCase().includes(b.trim().toLowerCase()) && (!so || c.clientes.get(x.id)?.deve > 0)).sort((a, z) => a.nome.localeCompare(z.nome));
  const cl = s.clientes.find((x) => x.id === selId);
  let det = null;
  if (cl) {
    const k = c.clientes.get(cl.id) || { deve: 0, vencido: 0, comprou: 0 };
    const tits = c.titulos.filter((t) => t.clienteId === cl.id).sort((a, z) => (a.criadoEm < z.criadoEm ? 1 : -1));
    const recs = s.recebimentos.filter((r) => r.clienteId === cl.id).sort((a, z) => (a.criadoEm < z.criadoEm ? 1 : -1));
    const vs = s.vendas.filter((v) => v.clienteId === cl.id).sort((a, z) => (a.criadoEm < z.criadoEm ? 1 : -1));
    const cx = new Map(); for (const m of c.cxMov) if (m.clienteId === cl.id) cx.set(m.tipoId, (cx.get(m.tipoId) || 0) - m.q);
    const cxs = [...cx].filter(([, q]) => q !== 0);
    det = html`<div class="pag">
      <div class="cab"><div><a class="link" href="#clientes">← Clientes</a><h1>${cl.nome}</h1><span class="txt">${[cl.telefone, cl.documento].filter(Boolean).join(" · ")}</span></div>
        <div class="acoes"><button class="btn out" onClick=${() => setEd(cl)}>Editar</button>${k.deve > 0 ? html`<button class="btn" onClick=${() => setRec(true)}>Receber</button>` : null}</div></div>
      <div class="grade"><${Num} r="Total comprado" v=${reais(k.comprou)}/><${Num} r="Saldo devedor" v=${reais(k.deve)} tom=${k.deve ? "alerta" : "bom"} d=${cl.limite ? "limite " + reais(cl.limite) : ""}/><${Num} r="Vencido" v=${reais(k.vencido)} tom=${k.vencido ? "ruim" : ""}/><${Num} r="Caixas com o cliente" v=${cxs.reduce((a, [, q]) => a + Math.max(0, q), 0)}/></div>
      ${cxs.length ? html`<div class="card"><h2>Caixas vazias com o cliente</h2><div class="tab"><table><tbody>${cxs.map(([t, q]) => html`<tr><td>${c.tipos.get(t)?.nome}</td><td class="r"><b>${q > 0 ? q : "devolveu " + -q + " a mais"}</b></td><td><button class="btn ghost" onClick=${() => setMv({ tipo: "retorno_cliente", tipoId: t, parteId: cl.id, parteNome: cl.nome, q: Math.max(0, q) })}>Cliente devolveu</button></td></tr>`)}</tbody></table></div></div>` : null}
      <div class="card"><h2>Fiado (compras na conta)</h2>${tits.length ? html`<div class="tab"><table><thead><tr><th>Venda</th><th>Data</th><th>Vencimento</th><th class="r">Valor</th><th class="r">Falta</th><th>Situação</th></tr></thead><tbody>${tits.map((t) => html`<tr><td><a class="link" href=${"#venda-" + t.vendaId}>${numVenda(t.vendaId)}</a></td><td>${dataBR(t.criadoEm)}</td><td>${t.venc ? dataBR(t.venc) : "—"}</td><td class="r">${reais(t.valor)}</td><td class="r">${reais(Math.max(0, t.saldo))}</td><td>${t.vencido ? html`<span class="tag red">Vencido</span>` : t.status === "quitado" ? html`<span class="tag">Quitado</span>` : t.status === "parcial" ? html`<span class="tag warn">Pago em parte</span>` : html`<span class="tag warn">Em aberto</span>`}</td></tr>`)}</tbody></table></div>` : html`<${Vazio}>Nenhuma.</${Vazio}>`}</div>
      <div class="card"><h2>Pagamentos recebidos</h2>${recs.length ? html`<div class="tab"><table><thead><tr><th>Data</th><th>Forma</th><th>Recebido por</th><th class="r">Valor</th><th></th></tr></thead><tbody>${recs.map((r) => html`<tr class=${r.estorno ? "risc" : ""}><td>${dataHora(r.criadoEm)}</td><td>${FORMAS[r.forma]}</td><td>${nomePessoa(s, r.criadoPor)}</td><td class="r">${reais(r.valor)}</td><td>${r.estorno ? html`<span class="tag gray">Estornado</span>` : gestor ? html`<button class="btn ghost" onClick=${() => setEst(r)}>Estornar</button>` : null}</td></tr>`)}</tbody></table></div>` : html`<${Vazio}>Nenhum.</${Vazio}>`}</div>
      <div class="card"><h2>Histórico de compras</h2>${vs.length ? html`<div class="tab"><table><thead><tr><th>Venda</th><th>Data</th><th class="r">Total</th><th class="r">A prazo</th></tr></thead><tbody>${vs.map((v) => html`<tr class=${v.status === "cancelada" ? "risc" : ""}><td><a class="link" href=${"#venda-" + v.id}>${numVenda(v.id)}</a></td><td>${dataHora(v.criadoEm)}</td><td class="r">${reais(v.total)}</td><td class="r">${v.prazo ? reais(v.prazo) : "—"}</td></tr>`)}</tbody></table></div>` : html`<${Vazio}>Nenhuma.</${Vazio}>`}</div>
      ${rec ? html`<${Receber} s=${s} c=${c} cl=${cl} onFechar=${() => setRec(false)}/>` : null}
      ${mv ? html`<${MovCaixariaForm} s=${s} ini=${mv} onFechar=${() => setMv(null)}/>` : null}
      ${est ? html`<${Modal} titulo="Estornar recebimento" sub="O valor sai do seu caixa e a dívida volta." onFechar=${() => setEst(null)} rod=${html`<button class="btn out" onClick=${() => setEst(null)}>Voltar</button><button class="btn red" disabled=${mot.trim().length < 3 || oc} onClick=${() => rodar(async () => { const sess = sessaoMinha(S); if (!sess) throw new Error("Abra seu caixa: o estorno sai dele."); await alterar("recebimentos", est.id, { estorno: { motivo: mot.trim(), por: S.eu, em: agora(), sessaoId: sess.id } }); setEst(null); }, "Estornado")}>Estornar</button>`}><${Campo} r="Motivo"><input value=${mot} onInput=${(e) => setMot(e.target.value)}/></${Campo}></${Modal}>` : null}
    </div>`;
  }
  return html`<div class="pag">
    ${cl ? det : html`<div class="cab"><h1>Clientes</h1><button class="btn" onClick=${() => setEd(null)}>+ Novo cliente</button></div>
    <div class="card"><div class="acoes"><input placeholder="🔎 Nome ou telefone" value=${b} onInput=${(e) => setB(e.target.value)} style="max-width:320px"/><label class="chk"><input type="checkbox" checked=${so} onChange=${(e) => setSo(e.target.checked)}/>Só quem está devendo</label></div>
    ${lista.length ? html`<div class="tab"><table><thead><tr><th>Cliente</th><th>Telefone</th><th class="r">Deve</th><th class="r">Vencido</th></tr></thead><tbody>${lista.map((x) => { const k = c.clientes.get(x.id); return html`<tr class=${x.ativo === false ? "risc" : ""}><td><a class="link" href=${"#cliente-" + x.id}>${x.nome}</a></td><td>${x.telefone}</td><td class="r">${k?.deve ? reais(k.deve) : "—"}</td><td class="r">${k?.vencido ? reais(k.vencido) : "—"}</td></tr>`; })}</tbody></table></div>` : html`<${Vazio}>Nenhum cliente.</${Vazio}>`}</div>`}
    ${ed !== undefined ? html`<${ClienteForm} cl=${ed} onFechar=${() => setEd(undefined)} onSalvo=${(id) => { location.hash = "cliente-" + id; }}/>` : null}
  </div>`;
}
