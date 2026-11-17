// ============ ENTREGAS ============
function situacaoEntrega(s, v) {
  const ents = s.entregas.filter((e) => e.vendaId === v.id && e.status !== "cancelada").sort((a, b) => (a.criadoEm < b.criadoEm ? -1 : 1));
  const itens = v.itens.map((i, k) => {
    const pc = s.produtos.find((p) => p.id === i.produtoId)?.pesoCaixaG || 0;
    const cx = i.unidade === "cx" && !i.gramas; const tot = cx ? i.caixas : i.unidade === "cx" ? i.caixas * pc + i.gramas : i.gramas;
    const ent = ents.reduce((a, e) => { const x = (e.itens || []).find((y) => y.idx === k); return a + (x ? (cx ? x.caixas || 0 : x.gramas || 0) : 0); }, 0);
    return { k, i, cx, tot, ent, falta: Math.max(0, tot - ent) };
  });
  const falta = itens.some((x) => x.falta > 0);
  return { ents, itens, status: !falta ? "entregue" : ents.length ? "parcial" : "pendente" };
}
const qtdEnt = (cx, n) => (cx ? n + " cx" : kg(n));
const tagEntrega = (st) => st === "entregue" ? html`<span class="tag">Entregue ✓</span>` : st === "parcial" ? html`<span class="tag warn">Entregue em parte</span>` : html`<span class="tag red">A entregar</span>`;
function RegistrarEntrega({ s, c, v, onFechar }) {
  const se = situacaoEntrega(s, v);
  const abertos = se.itens.filter((x) => x.falta > 0);
  const [q, setQ] = useState(Object.fromEntries(abertos.map((x) => [x.k, x.cx ? String(x.falta) : String(x.falta / 1000).replace(".", ",")])));
  const [quem, setQuem] = useState(""); const [obs, setObs] = useState(""); const [oc, rodar] = useAcao();
  const lido = (x) => { const t = q[x.k]; if (t == null || String(t).trim() === "") return 0; return x.cx ? somaTxt(t) : paraGramas(t); };
  const okItem = (x) => { const n = lido(x); return Number.isFinite(n) && n >= 0 && n <= x.falta && (x.cx ? Number.isInteger(n) : true); };
  const total = abertos.reduce((a, x) => a + (okItem(x) ? lido(x) : 0), 0);
  const pode = abertos.every(okItem) && total > 0;
  return html`<${Modal} grande titulo=${"Entrega da venda " + numVenda(v.id)} sub="Coloque o que está saindo agora. Pode entregar em partes: o que não for agora continua pendente." onFechar=${onFechar} rod=${html`<button class="btn out" onClick=${onFechar}>Cancelar</button><button class="btn" disabled=${!pode || oc} onClick=${() => rodar(async () => {
    const itens = abertos.map((x) => ({ idx: x.k, produtoId: x.i.produtoId, caixas: x.cx ? lido(x) : 0, gramas: x.cx ? 0 : lido(x) })).filter((x) => x.caixas > 0 || x.gramas > 0);
    await gravar("entregas", novoId("E"), { vendaId: v.id, clienteId: v.clienteId || "", itens, entregador: quem.trim(), obs: obs.trim(), criadoPor: S.eu, criadoEm: agora() }); onFechar();
  }, "Entrega registrada")}>Registrar entrega</button>`}>
    <div class="acoes"><button class="btn ghost sm" onClick=${() => setQ(Object.fromEntries(abertos.map((x) => [x.k, x.cx ? String(x.falta) : String(x.falta / 1000).replace(".", ",")])))}>Tudo o que falta</button><button class="btn ghost sm" onClick=${() => setQ({})}>Limpar</button></div>
    <div class="tab"><table><thead><tr><th>Produto</th><th class="r">Vendido</th><th class="r">Já entregue</th><th class="r">Falta</th><th style="width:130px">Entregar agora</th></tr></thead><tbody>
      ${abertos.map((x) => html`<tr><td><b>${c.prod.get(x.i.produtoId)?.nome}</b></td><td class="r">${qtdEnt(x.cx, x.tot)}</td><td class="r">${x.ent ? qtdEnt(x.cx, x.ent) : ""}</td><td class="r"><b>${qtdEnt(x.cx, x.falta)}</b></td>
        <td><input inputmode=${x.cx ? "tel" : "decimal"} style=${"min-height:36px;text-align:right;" + (okItem(x) ? "" : "border-color:var(--err)")} value=${q[x.k] ?? ""} onInput=${(e) => setQ({ ...q, [x.k]: e.target.value })} placeholder=${x.cx ? "cx" : "kg"}/>${!okItem(x) ? html`<small style="color:var(--err)">Máx. ${qtdEnt(x.cx, x.falta)}</small>` : null}</td></tr>`)}
    </tbody></table></div>
    <div class="grade"><${Campo} r="Quem levou / entregador"><input value=${quem} onInput=${(e) => setQuem(e.target.value)} placeholder="Opcional"/></${Campo}><${Campo} r="Observação"><input value=${obs} onInput=${(e) => setObs(e.target.value)} placeholder="Opcional"/></${Campo}></div>
  </${Modal}>`;
}
function Entregas({ s, c }) {
  const [aba, setAba] = useState("pend"); const [ent, setEnt] = useState(null); const [b, setB] = useState("");
  const comEnt = s.vendas.filter((v) => v.entrega && v.status !== "cancelada").map((v) => ({ v, se: situacaoEntrega(s, v), cli: s.clientes.find((x) => x.id === v.clienteId) }));
  const bq = b.trim().toLowerCase();
  const filtra = (x) => !bq || (x.cli?.nome || "").toLowerCase().includes(bq) || numVenda(x.v.id).toLowerCase().includes(bq) || (x.v.entrega.endereco || "").toLowerCase().includes(bq);
  const pend = comEnt.filter((x) => x.se.status !== "entregue").filter(filtra).sort((a, z) => ((a.v.entrega.previsao || "9") < (z.v.entrega.previsao || "9") ? -1 : 1));
  const feitas = comEnt.filter((x) => x.se.status === "entregue").filter(filtra).sort((a, z) => (a.v.criadoEm < z.v.criadoEm ? 1 : -1)).slice(0, 100);
  // total a entregar por produto (para carregar o caminhão)
  const tot = new Map(); for (const x of pend) for (const it of x.se.itens) if (it.falta > 0) { const k = it.i.produtoId + "|" + (it.cx ? "cx" : "kg"); tot.set(k, (tot.get(k) || 0) + it.falta); }
  const hoje = hojeISO();
  const cartao = (x) => html`<div class="card" style="gap:8px">
    <div class="cab"><div><b style="font-size:1.05rem">${x.cli?.nome || "Consumidor"}</b> · <a class="link" href=${"#venda-" + x.v.id}>Venda ${numVenda(x.v.id)}</a> <small class="txt">${dataHora(x.v.criadoEm)}</small><br/>
      <small>${x.v.entrega.endereco ? "📍 " + x.v.entrega.endereco : ""}${x.cli?.telefone ? " · 📞 " + x.cli.telefone : ""}${x.v.entrega.obs ? " · " + x.v.entrega.obs : ""}</small></div>
      <div style="text-align:right">${tagEntrega(x.se.status)}${x.v.entrega.previsao ? html`<br/><small class=${x.se.status !== "entregue" && x.v.entrega.previsao < hoje ? "" : "txt"} style=${x.se.status !== "entregue" && x.v.entrega.previsao < hoje ? "color:var(--err);font-weight:800" : ""}>Entregar até ${dataBR(x.v.entrega.previsao)}</small>` : null}</div></div>
    <div class="tab"><table><thead><tr><th>Produto</th><th class="r">Vendido</th><th class="r">Entregue</th><th class="r">Falta</th></tr></thead><tbody>${x.se.itens.map((it) => html`<tr class=${it.falta ? "" : "risc"}><td>${c.prod.get(it.i.produtoId)?.nome}</td><td class="r">${qtdEnt(it.cx, it.tot)}</td><td class="r">${it.ent ? qtdEnt(it.cx, it.ent) : ""}</td><td class="r"><b>${it.falta ? qtdEnt(it.cx, it.falta) : "—"}</b></td></tr>`)}</tbody></table></div>
    ${x.se.ents.length ? html`<small class="txt">${x.se.ents.map((e) => `${dataHora(e.criadoEm)}: ${e.itens.map((i) => `${c.prod.get(i.produtoId)?.nome} ${i.caixas ? i.caixas + " cx" : kg(i.gramas)}`).join(", ")}${e.entregador ? " (" + e.entregador + ")" : ""}`).join(" · ")}</small>` : null}
    ${x.se.status !== "entregue" ? html`<div class="acoes"><button class="btn" onClick=${() => setEnt(x.v)}>Registrar entrega</button></div>` : null}
  </div>`;
  return html`<div class="pag"><div class="cab"><h1>Entregas</h1><input placeholder="🔎 Cliente, nº da venda ou local" value=${b} onInput=${(e) => setB(e.target.value)} style="max-width:300px"/></div>
    <${Tabs} abas=${[["pend", "A entregar" + (pend.length ? " (" + pend.length + ")" : "")], ["feitas", "Entregues"]]} atual=${aba} set=${setAba}/>
    ${aba === "pend" ? html`
      ${tot.size ? html`<div class="card"><h2>Total para carregar</h2><div class="chips">${[...tot].sort((a, z) => (c.prod.get(a[0].split("|")[0])?.nome || "").localeCompare(c.prod.get(z[0].split("|")[0])?.nome || "")).map(([k, n]) => html`<span class="tag gray" style="font-size:.9rem;padding:6px 10px">${c.prod.get(k.split("|")[0])?.nome}: <b>${qtdEnt(k.endsWith("cx"), n)}</b></span>`)}</div></div>` : null}
      ${pend.length ? pend.map(cartao) : html`<${Vazio}>Nada para entregar. Na venda, escolha "Para entregar" para aparecer aqui.</${Vazio}>`}` : null}
    ${aba === "feitas" ? (feitas.length ? feitas.map(cartao) : html`<${Vazio}>Nenhuma entrega concluída ainda.</${Vazio}>`) : null}
    ${ent ? html`<${RegistrarEntrega} s=${s} c=${c} v=${ent} onFechar=${() => setEnt(null)}/>` : null}
  </div>`;
}
function MarcarEntrega({ v, onFechar }) {
  const [end, setEnd] = useState(v.entrega?.endereco || ""); const [oc, rodar] = useAcao();
  return html`<${Modal} titulo="Venda para entregar" onFechar=${onFechar} rod=${html`<button class="btn out" onClick=${onFechar}>Cancelar</button><button class="btn" disabled=${oc} onClick=${() => rodar(async () => { await alterar("vendas", v.id, { entrega: { ...(v.entrega || {}), endereco: end.trim() } }); onFechar(); }, "Salvo")}>Salvar</button>`}>
    <${Campo} r="Onde entregar / observação"><input autofocus value=${end} onInput=${(e) => setEnd(e.target.value)} placeholder="Ex.: Mercado do João, entregar amanhã cedo"/></${Campo}>
  </${Modal}>`;
}
