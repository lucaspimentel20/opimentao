// ============ CAIXARIA ============
function TipoForm({ t, onFechar, onSalvo }) {
  const [n, setN] = useState(t?.nome || ""); const [ret, setRet] = useState(t ? t.retornavel !== false : true); const [at, setAt] = useState(t ? t.ativo !== false : true); const [oc, rodar] = useAcao();
  return html`<${Modal} titulo=${t ? "Editar tipo de caixa" : "Novo tipo de caixa"} onFechar=${onFechar} rod=${html`<button class="btn out" onClick=${onFechar}>Cancelar</button><button class="btn" disabled=${n.trim().length < 2 || oc} onClick=${() => rodar(async () => { const id = t?.id || novoId("K"); await gravar("tiposCaixa", id, { nome: n.trim(), retornavel: ret, ativo: at }); onSalvo?.(id); onFechar(); }, "Tipo salvo")}>Salvar</button>`}>
    <${Campo} r="Nome" d="Ex.: Plástica K, Madeira, Isopor"><input autofocus value=${n} onInput=${(e) => setN(e.target.value)}/></${Campo}>
    <label class="chk"><input type="checkbox" checked=${ret} onChange=${(e) => setRet(e.target.checked)}/>Precisa devolver (controlar)</label>
    ${t ? html`<label class="chk"><input type="checkbox" checked=${at} onChange=${(e) => setAt(e.target.checked)}/>Ativo</label>` : null}
  </${Modal}>`;
}
function MovCaixariaForm({ s, ini, onFechar }) {
  const gestor = papelDe(s) === "gestor";
  const [tipo] = useState(ini.tipo); const [tipoId, setTipoId] = useState(ini.tipoId || ""); const [parte, setParte] = useState(ini.parteId || ""); const [q, setQ] = useState(ini.q ? String(ini.q) : ""); const [obs, setObs] = useState("");
  const [de, setDe] = useState("loja"); const [oc, rodar] = useAcao();
  const n = Number(q); const aj = tipo === "ajuste";
  const lista = tipo === "devolvida_fornecedor" || (aj && de === "fornecedor") ? s.fornecedores : tipo === "retorno_cliente" || (aj && de === "cliente") ? s.clientes : [];
  const ok = tipoId && Number.isInteger(n) && n !== 0 && (aj ? obs.trim().length > 2 && (de === "loja" || parte) : n > 0 && parte);
  const tit = { devolvida_fornecedor: "Devolver caixas ao fornecedor", retorno_cliente: "Cliente devolveu caixas", ajuste: "Ajuste de caixas" }[tipo];
  return html`<${Modal} titulo=${tit} sub=${aj ? "Positivo soma, negativo tira. Fornecedor: positivo = a loja deve mais. Cliente: positivo = o cliente deve mais." : ""} onFechar=${onFechar} rod=${html`<button class="btn out" onClick=${onFechar}>Cancelar</button><button class="btn" disabled=${!ok || oc} onClick=${() => rodar(async () => {
    if (aj && !gestor) throw new Error("Só o gestor faz ajuste.");
    const isF = tipo === "devolvida_fornecedor" || (aj && de === "fornecedor"); const isC = tipo === "retorno_cliente" || (aj && de === "cliente");
    const qq = tipo === "devolvida_fornecedor" ? -n : tipo === "retorno_cliente" ? n : aj && de === "cliente" ? -n : n;
    await gravar("movCaixaria", novoId("X"), { tipo, tipoId, q: qq, fornecedorId: isF ? parte : null, clienteId: isC ? parte : null, obs: obs.trim(), criadoPor: S.eu, criadoEm: agora() }); onFechar();
  }, "Caixas registradas")}>Confirmar</button>`}>
    ${aj ? html`<div class="seg">${[["loja", "Só na loja"], ["fornecedor", "Fornecedor"], ["cliente", "Cliente"]].map(([k, r]) => html`<button class=${de === k ? "on" : ""} onClick=${() => { setDe(k); setParte(""); }}>${r}</button>`)}</div>` : null}
    ${lista.length || !aj ? (ini.parteNome ? html`<h3>${ini.parteNome}</h3>` : html`<${Campo} r=${lista === s.clientes ? "Cliente" : "Fornecedor"}><${Sel} valor=${parte} set=${setParte} vazio="Escolha" opcoes=${lista.map((x) => [x.id, x.nome])}/></${Campo}>`) : null}
    <div class="grade"><${Campo} r="Tipo de caixa"><${Sel} valor=${tipoId} set=${setTipoId} vazio="Escolha" opcoes=${s.tiposCaixa.filter((t) => t.retornavel !== false).map((t) => [t.id, t.nome])}/></${Campo}>
    <${Campo} r="Quantidade"><input class="big" inputmode="numeric" value=${q} onInput=${(e) => setQ(e.target.value)}/></${Campo}></div>
    ${!aj && ini.q != null && n > ini.q ? html`<p class="av">O sistema registra ${ini.q}. As ${n - ini.q} a mais ficam como caixas antigas.</p>` : null}
    <${Campo} r=${aj ? "Motivo" : "Observação"}><input value=${obs} onInput=${(e) => setObs(e.target.value)}/></${Campo}>
  </${Modal}>`;
}
function Caixaria({ s, c }) {
  const gestor = papelDe(s) === "gestor";
  const [tf, setTf] = useState(undefined); const [mv, setMv] = useState(null);
  const porF = new Map(), porC = new Map(), loja = new Map();
  for (const m of c.cxMov) {
    loja.set(m.tipoId, (loja.get(m.tipoId) || 0) + m.q);
    if (m.fornecedorId) { const k = m.fornecedorId + "|" + m.tipoId; porF.set(k, (porF.get(k) || 0) + m.q); }
    if (m.clienteId) { const k = m.clienteId + "|" + m.tipoId; porC.set(k, (porC.get(k) || 0) - m.q); }
  }
  const F = [...porF].filter(([, q]) => q !== 0).map(([k, q]) => { const [f, t] = k.split("|"); return { f, t, q }; });
  const C = [...porC].filter(([, q]) => q !== 0).map(([k, q]) => { const [cl, t] = k.split("|"); return { cl, t, q }; });
  const nT = (id) => c.tipos.get(id)?.nome || "?";
  const movs = [...c.cxMov].sort((a, b) => (a.quando < b.quando ? 1 : -1)).slice(0, 150);
  return html`<div class="pag"><div class="cab"><h1>Caixaria</h1><div class="acoes">
    <button class="btn" onClick=${() => setMv({ tipo: "devolvida_fornecedor" })}>Devolver ao fornecedor</button>
    <button class="btn out" onClick=${() => setMv({ tipo: "retorno_cliente" })}>Cliente devolveu</button>
    ${gestor ? html`<button class="btn ghost" onClick=${() => setMv({ tipo: "ajuste" })}>Ajuste</button>` : null}</div></div>
    <p class="txt">Contagem a partir do início do uso do sistema. Caixas antigas são aceitas nas devoluções.</p>
    <div class="grade"><${Num} r="A devolver aos fornecedores" v=${F.reduce((a, x) => a + Math.max(0, x.q), 0)}/><${Num} r="Com clientes" v=${C.reduce((a, x) => a + Math.max(0, x.q), 0)}/>
      ${s.tiposCaixa.filter((t) => t.retornavel !== false).map((t) => html`<${Num} r=${"Movimento na loja · " + t.nome} v=${loja.get(t.id) || 0}/>`)}</div>
    <div class="duas">
      <div class="card"><h2>A loja deve aos fornecedores</h2>${F.length ? html`<div class="tab"><table><thead><tr><th>Fornecedor</th><th>Tipo</th><th class="r">Caixas</th><th></th></tr></thead><tbody>${F.map((x) => { const nm = s.fornecedores.find((f) => f.id === x.f)?.nome; return html`<tr><td><b>${nm}</b></td><td>${nT(x.t)}</td><td class="r"><b>${x.q > 0 ? x.q : -x.q + " a mais"}</b></td><td><button class="btn ghost" onClick=${() => setMv({ tipo: "devolvida_fornecedor", tipoId: x.t, parteId: x.f, parteNome: nm, q: Math.max(0, x.q) })}>Devolver</button></td></tr>`; })}</tbody></table></div>` : html`<${Vazio}>Nada a devolver.</${Vazio}>`}</div>
      <div class="card"><h2>Clientes com caixas</h2>${C.length ? html`<div class="tab"><table><thead><tr><th>Cliente</th><th>Tipo</th><th class="r">Caixas</th><th></th></tr></thead><tbody>${C.map((x) => { const nm = s.clientes.find((k) => k.id === x.cl)?.nome; return html`<tr><td><a class="link" href=${"#cliente-" + x.cl}>${nm}</a></td><td>${nT(x.t)}</td><td class="r"><b>${x.q > 0 ? x.q : "devolveu " + -x.q + " a mais"}</b></td><td><button class="btn ghost" onClick=${() => setMv({ tipo: "retorno_cliente", tipoId: x.t, parteId: x.cl, parteNome: nm, q: Math.max(0, x.q) })}>Recebeu</button></td></tr>`; })}</tbody></table></div>` : html`<${Vazio}>Nenhum cliente com caixa.</${Vazio}>`}</div>
    </div>
    <div class="card"><div class="cab"><h2>Tipos de caixa</h2><button class="btn sm out" onClick=${() => setTf(null)}>+ Novo tipo</button></div>${s.tiposCaixa.length ? html`<div class="tab"><table><tbody>${s.tiposCaixa.map((t) => html`<tr class=${t.ativo === false ? "risc" : ""}><td><b>${t.nome}</b></td><td>${t.retornavel === false ? html`<span class="tag gray">Descartável</span>` : html`<span class="tag">Devolver</span>`}</td><td>${gestor ? html`<button class="btn ghost" onClick=${() => setTf(t)}>Editar</button>` : null}</td></tr>`)}</tbody></table></div>` : html`<${Vazio}>Cadastre os tipos de caixa (ex.: Plástica K, Madeira).</${Vazio}>`}</div>
    <div class="card"><h2>Movimentações</h2>${movs.length ? html`<div class="tab"><table><thead><tr><th>Quando</th><th>Movimento</th><th>Tipo</th><th class="r">Qtd</th><th>Com quem</th></tr></thead><tbody>${movs.map((m) => html`<tr><td>${dataHora(m.quando)}</td><td>${m.desc}${m.obs ? " · " + m.obs : ""}</td><td>${nT(m.tipoId)}</td><td class="r">${Math.abs(m.q)}</td><td>${m.fornecedorId ? s.fornecedores.find((f) => f.id === m.fornecedorId)?.nome : m.clienteId ? s.clientes.find((k) => k.id === m.clienteId)?.nome : "Loja"}${m.vendaId ? html` · <a class="link" href=${"#venda-" + m.vendaId}>venda</a>` : null}</td></tr>`)}</tbody></table></div>` : html`<${Vazio}>Nenhuma movimentação ainda.</${Vazio}>`}</div>
    ${tf !== undefined ? html`<${TipoForm} t=${tf} onFechar=${() => setTf(undefined)}/>` : null}
    ${mv ? html`<${MovCaixariaForm} s=${s} ini=${mv} onFechar=${() => setMv(null)}/>` : null}
  </div>`;
}
