// ============ ESTOQUE ============
// mercadoria que rendeu (ex.: sobra ao reembalar): entra no estoque SEM CUSTO para a firma
function RendeuForm({ s, onFechar }) {
  const [f, setF] = useState({ produtoId: "", caixas: "", obs: "Rendeu" }); const [oc, rodar] = useAcao(); const [chave] = useState(novoId("C"));
  const pr = s.produtos.find((p) => p.id === f.produtoId); const n = Number(String(f.caixas).replace(",", "."));
  return html`<${Modal} titulo="Mercadoria que rendeu" sub="Entra no estoque com custo ZERO (não é compra). Na venda, ela dá lucro cheio." onFechar=${onFechar} rod=${html`<button class="btn out" onClick=${onFechar}>Cancelar</button><button class="btn" disabled=${!pr || !(n > 0) || oc} onClick=${() => rodar(async () => {
    if (!Number.isInteger(n)) throw new Error("Lance caixas inteiras (ex.: 2).");
    const itens = [{ loteId: novoId("T"), produtoId: pr.id, caixas: n, pesoCaixaG: pr.pesoCaixaG || 1000, valor: 0, frete: 0, comissao: 0, custoFinal: 0, valorCaixa: 0, tipos: [], embalagem: "caixa" }];
    const dia = hojeComercial();
    await gravar("compras", chave, { rendeu: true, fornecedorId: "", obs: f.obs.trim() || "Rendeu", valorTotal: 0, frete: 0, comissao: 0, fretePorCaixa: 0, comissaoPorCaixa: 0, rateio: "valor_por_caixa", status: "confirmada", localId: null, localModo: "um", numeroNota: "", dataCompra: dia, dataRecebimento: dia, fretePagoSessaoId: null, itens, criadoEm: agora(), criadoPor: S.eu });
    onFechar();
  }, "Lançado no estoque sem custo")}>Lançar ${n > 0 ? String(f.caixas).replace(".", ",") + " cx" : ""}</button>`}>
    <${Campo} r="Produto"><${Sel} valor=${f.produtoId} set=${(v) => setF({ ...f, produtoId: v })} vazio="Escolha" opcoes=${s.produtos.filter((p) => p.ativo !== false).map((p) => [p.id, p.nome])}/></${Campo}>
    <div class="grade"><${Campo} r="Quantas caixas"><input inputmode="decimal" value=${f.caixas} onInput=${(e) => setF({ ...f, caixas: e.target.value })} placeholder="0"/></${Campo}>
    <${Campo} r="Observação"><input value=${f.obs} onInput=${(e) => setF({ ...f, obs: e.target.value })}/></${Campo}></div>
  </${Modal}>`;
}
function Estoque({ s, c }) {
  const [rendeu, setRendeu] = useState(false);
  const gestor = papelDe(s) === "gestor";
  const [b, setB] = useState(""); const [ver, setVer] = useState(null); const [preco, setPreco] = useState(null); const [inv, setInv] = useState(null);
  const ps = s.produtos.filter((p) => p.nome.toLowerCase().includes(b.trim().toLowerCase())).sort((a, z) => a.nome.localeCompare(z.nome));
  const valor = Math.round([...c.estoque.values()].reduce((a, e) => a + e.valor, 0) * 100);
  return html`<div class="pag"><div class="cab"><h1>Estoque</h1><div class="acoes">${papelDe(s) === "gestor" ? html`<button class="btn out" onClick=${() => setRendeu(true)}>+ Mercadoria que rendeu</button>` : null}<input placeholder="🔎 Buscar" value=${b} onInput=${(e) => setB(e.target.value)} style="max-width:240px"/></div></div>${rendeu ? html`<${RendeuForm} s=${s} onFechar=${() => setRendeu(false)}/>` : null}
    <div class="grade"><${Num} r="Mercadoria em estoque" v=${reais(valor)} d="pelo custo + frete"/><${Num} r="Abaixo do mínimo" v=${[...c.estoque.values()].filter((e) => e.baixo).length}/></div>
    <div class="card">${ps.length ? html`<div class="tab"><table><thead><tr><th>Produto</th><th class="r">Saldo</th><th class="r">Total</th><th class="r">Custo cx / kg</th><th class="r">Venda cx / kg</th>${gestor ? html`<th class="r">Sugerido cx / kg</th>` : null}<th></th></tr></thead><tbody>${ps.map((p) => { const e = c.estoque.get(p.id); return html`<tr class=${p.ativo === false ? "risc" : ""}><td><button class="link" onClick=${() => setVer(p)}>${p.nome}</button> ${e.cx < 0 || e.g < 0 ? html`<span class="tag red">Negativo</span>` : e.baixo ? html`<span class="tag warn">Baixo</span>` : null}</td><td class="r"><b style=${e.cx < 0 || e.g < 0 ? "color:var(--err)" : ""}>${saldoTxt(e.cx, e.g)}</b></td><td class="r">${kg(e.totalG, 1)}</td><td class="r">${e.custoCx != null ? reais(Math.round(e.custoCx * 100)) + " / " + reais(Math.round(e.custoKg * 100)) : "—"}</td><td class="r">${reais(p.precoCx || 0)} / ${reais(p.precoKg || 0)}</td>${gestor ? html`<td class="r">${e.sugCx != null ? reais(e.sugCx) + " / " + reais(e.sugKg) : "—"}</td>` : null}<td style="white-space:nowrap">${gestor ? html`<button class="btn ghost" onClick=${() => setPreco(p)}>Preço</button><button class="btn ghost" onClick=${() => setInv(p)}>Inventário</button>` : null}</td></tr>`; })}</tbody></table></div>` : html`<${Vazio}>Nenhum produto.</${Vazio}>`}</div>
    ${ver ? html`<${Modal} grande titulo=${ver.nome} sub=${"Saldo: " + saldoTxt(c.estoque.get(ver.id).cx, c.estoque.get(ver.id).g)} onFechar=${() => setVer(null)}>
      <h3>Lotes (o mais antigo sai primeiro)</h3><div class="tab"><table><thead><tr><th>Entrada</th><th>Fornecedor</th><th class="r">Recebido</th><th class="r">Saldo</th><th class="r">Custo/cx</th><th class="r">Custo/kg</th><th></th></tr></thead><tbody>${c.estoque.get(ver.id).lotes.slice().reverse().map((l) => html`<tr class=${l.cx === 0 && l.g === 0 ? "risc" : ""}><td>${dataBR(l.data)}</td><td>${s.fornecedores.find((f) => f.id === l.fornecedorId)?.nome}</td><td class="r">${l.caixas0} cx × ${kg(l.peso)}</td><td class="r">${saldoTxt(l.cx, l.g)}</td><td class="r">${reais(Math.round(l.custoCx * 100))}</td><td class="r">${reais(Math.round(l.custoKg * 100))}</td><td><a class="link" href=${"#entrada-" + l.compraId} onClick=${() => setVer(null)}>Ficha</a></td></tr>`)}</tbody></table></div>
    </${Modal}>` : null}
    ${preco ? html`<${PrecoForm} p=${preco} e=${c.estoque.get(preco.id)} onFechar=${() => setPreco(null)}/>` : null}
    ${inv ? html`<${Inventario} c=${c} p=${inv} onFechar=${() => setInv(null)}/>` : null}
  </div>`;
}
function PrecoForm({ p, e, onFechar }) {
  const [cx, setCx] = useState(txtReais(p.precoCx || 0)); const [k, setK] = useState(txtReais(p.precoKg || 0)); const [m, setM] = useState(String(p.margem ?? 30)); const [min, setMin] = useState(p.minimoG ? String(p.minimoG / 1000).replace(".", ",") : "");
  const [oc, rodar] = useAcao();
  const marg = (v, c) => (c && v ? ` · margem ${(((v / 100 - c) / (v / 100)) * 100).toFixed(0)}%` : "");
  return html`<${Modal} titulo=${"Preço de venda — " + p.nome} sub=${e.custoCx != null ? `Custo da última compra (com frete): ${reais(Math.round(e.custoCx * 100))}/cx · ${reais(Math.round(e.custoKg * 100))}/kg` : "Sem entrada ainda: o custo aparece depois da primeira compra."} onFechar=${onFechar} rod=${html`<button class="btn out" onClick=${onFechar}>Cancelar</button><button class="btn" disabled=${oc} onClick=${() => rodar(async () => { await gravar("produtos", p.id, { ...strip(p), precoCx: paraCentavos(cx) || 0, precoKg: paraCentavos(k) || 0, margem: Number(m.replace(",", ".")) || 0, minimoG: paraGramas(min) || 0 }); onFechar(); }, "Preço atualizado")}>Salvar</button>`}>
    <div class="grade">
      <${Campo} r="Venda da caixa (R$)" d=${(e.sugCx != null ? "Sugerido " + reais(e.sugCx) : "") + marg(paraCentavos(cx), e.custoCx)}><input inputmode="decimal" value=${cx} onInput=${(x) => setCx(x.target.value)}/></${Campo}>
      <${Campo} r="Venda do kg (R$)" d=${(e.sugKg != null ? "Sugerido " + reais(e.sugKg) : "") + marg(paraCentavos(k), e.custoKg)}><input inputmode="decimal" value=${k} onInput=${(x) => setK(x.target.value)}/></${Campo}>
      <${Campo} r="Margem para o sugerido (%)"><input inputmode="decimal" value=${m} onInput=${(x) => setM(x.target.value)}/></${Campo}>
      <${Campo} r="Avisar abaixo de (kg)"><input inputmode="decimal" value=${min} onInput=${(x) => setMin(x.target.value)}/></${Campo}>
    </div></${Modal}>`;
}
function Inventario({ c, p, onFechar }) {
  const e = c.estoque.get(p.id);
  const [cx, setCx] = useState(String(e.cx)); const [g, setG] = useState(String(e.g / 1000).replace(".", ",")); const [mot, setMot] = useState("Contagem de inventário"); const [oc, rodar] = useAcao();
  return html`<${Modal} titulo=${"Inventário de " + p.nome} sub="Informe o que você contou. A diferença vira ajuste com motivo." onFechar=${onFechar} rod=${html`<button class="btn out" onClick=${onFechar}>Cancelar</button><button class="btn" disabled=${oc || mot.trim().length < 3} onClick=${() => rodar(async () => {
    const calc = calcular(S); const at = calc.estoque.get(p.id); const C = Number(cx), G = paraGramas(g);
    if (!Number.isInteger(C) || C < 0 || !(G >= 0)) throw new Error("Contagem inválida.");
    const dc = C - at.cx, dg = G - at.g; if (!dc && !dg) { onFechar(); return; }
    let deltas = [], custo = 0;
    if (dc < 0 || dg < 0) { const r = consumir(calc, p.id, Math.max(0, -dc), Math.max(0, -dg), false); deltas = r.deltas; custo = r.custo; }
    if (dc > 0 || dg > 0) { const l = at.lotes[at.lotes.length - 1]; if (!l) throw new Error("Lance uma entrada antes."); deltas.push({ loteId: l.id, cx: Math.max(0, dc), g: Math.max(0, dg) }); }
    await gravar("movEstoque", novoId("A"), { tipo: "ajuste", produtoId: p.id, deltas, custo: Number(custo.toFixed(4)), motivo: mot.trim(), criadoPor: S.eu, criadoEm: agora() }); onFechar();
  }, "Estoque ajustado")}>Gravar contagem</button>`}>
    <div class="grade"><${Campo} r="Caixas fechadas" d=${"Sistema: " + e.cx}><input inputmode="numeric" value=${cx} onInput=${(x) => setCx(x.target.value)}/></${Campo}><${Campo} r="Kg de caixa aberta" d=${"Sistema: " + kg(e.g)}><input inputmode="decimal" value=${g} onInput=${(x) => setG(x.target.value)}/></${Campo}></div>
    <${Campo} r="Motivo"><input value=${mot} onInput=${(x) => setMot(x.target.value)}/></${Campo}>
  </${Modal}>`;
}
