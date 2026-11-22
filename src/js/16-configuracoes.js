// ============ CONFIGURAÇÕES ============
function FornecedorForm({ f, onFechar, onSalvo }) {
  const [n, setN] = useState(f?.nome || ""); const [t, setT] = useState(f?.telefone || ""); const [at, setAt] = useState(f ? f.ativo !== false : true); const [oc, rodar] = useAcao();
  return html`<${Modal} titulo=${f ? "Editar fornecedor" : "Novo fornecedor"} onFechar=${onFechar} rod=${html`<button class="btn out" onClick=${onFechar}>Cancelar</button><button class="btn" disabled=${n.trim().length < 2 || oc} onClick=${() => rodar(async () => { const id = f?.id || novoId("F"); await gravar("fornecedores", id, { nome: n.trim(), telefone: t.trim(), ativo: at }); onSalvo?.(id); onFechar(); }, "Fornecedor salvo")}>Salvar</button>`}>
    <${Campo} r="Nome"><input autofocus value=${n} onInput=${(e) => setN(e.target.value)}/></${Campo}><${Campo} r="Telefone"><input value=${t} onInput=${(e) => setT(e.target.value)}/></${Campo}>
    ${f ? html`<label class="chk"><input type="checkbox" checked=${at} onChange=${(e) => setAt(e.target.checked)}/>Ativo</label>` : null}
  </${Modal}>`;
}
function LocalForm({ l, onFechar, onSalvo }) {
  const [n, setN] = useState(l?.nome || ""); const [at, setAt] = useState(l ? l.ativo !== false : true); const [oc, rodar] = useAcao();
  return html`<${Modal} titulo=${l ? "Editar local" : "Novo local de origem"} sub="De onde a mercadoria vem: caminhão, box do Ceasa, produtor..." onFechar=${onFechar} rod=${html`<button class="btn out" onClick=${onFechar}>Cancelar</button><button class="btn" disabled=${n.trim().length < 2 || oc} onClick=${() => rodar(async () => {
    if (S.locais.some((x) => x.id !== l?.id && x.nome.trim().toLowerCase() === n.trim().toLowerCase())) throw new Error("Já existe um local com esse nome.");
    const id = l?.id || novoId("LO"); await gravar("locais", id, { nome: n.trim(), ativo: at }); onSalvo?.(id); onFechar();
  }, "Local salvo")}>Salvar</button>`}>
    <${Campo} r="Nome do local"><input autofocus value=${n} onInput=${(e) => setN(e.target.value)} placeholder="Ex.: ENC, Ceasa box 12, Caminhão do Zé"/></${Campo}>
    ${l ? html`<label class="chk"><input type="checkbox" checked=${at} onChange=${(e) => setAt(e.target.checked)}/>Ativo (aparece como coluna no Recebimento)</label>` : null}
  </${Modal}>`;
}
function ProdutoForm({ p, onFechar }) {
  const [n, setN] = useState(p?.nome || ""); const [peso, setPeso] = useState(p?.pesoCaixaG ? String(p.pesoCaixaG / 1000).replace(".", ",") : ""); const [at, setAt] = useState(p ? p.ativo !== false : true); const [oc, rodar] = useAcao();
  const g = paraGramas(peso);
  return html`<${Modal} titulo=${p ? "Editar produto" : "Novo produto"} onFechar=${onFechar} rod=${html`<button class="btn out" onClick=${onFechar}>Cancelar</button><button class="btn" disabled=${n.trim().length < 2 || !(g > 0) || oc} onClick=${() => rodar(async () => {
    if (S.produtos.some((x) => x.id !== p?.id && x.nome.trim().toLowerCase() === n.trim().toLowerCase())) throw new Error("Já existe um produto com esse nome.");
    const id = p?.id || novoId("PR"); await gravar("produtos", id, { ...(p ? strip(p) : { precoCx: 0, precoKg: 0, margem: 30, minimoG: 0 }), nome: n.trim(), pesoCaixaG: g, ativo: at }); onFechar();
  }, "Produto salvo")}>Salvar</button>`}>
    <${Campo} r="Nome"><input autofocus value=${n} onInput=${(e) => setN(e.target.value)} placeholder="Tomate"/></${Campo}>
    <${Campo} r="Peso da caixa (kg)" d="Vem preenchido na entrada; pode trocar a cada compra."><input inputmode="decimal" value=${peso} onInput=${(e) => setPeso(e.target.value)} placeholder="25"/></${Campo}>
    ${p ? html`<label class="chk"><input type="checkbox" checked=${at} onChange=${(e) => setAt(e.target.checked)}/>Ativo (aparece no caixa)</label>` : null}
  </${Modal}>`;
}
function Config({ s }) {
  const gestor = papelDe(s) === "gestor";
  const [aba, setAba] = useState(gestor ? "produtos" : "fornecedores"); const [pf, setPf] = useState(undefined); const [ff, setFf] = useState(undefined); const [lf, setLf] = useState(undefined); const [oc, rodar] = useAcao();
  return html`<div class="pag"><h1>Configurações</h1>
    <${Tabs} abas=${[...(gestor ? [["produtos", "Produtos"]] : []), ["fornecedores", "Fornecedores"], ["locais", "Locais de origem"], ["impressora", "Impressora"], ...(gestor ? [["equipe", "Equipe"], ["pix", "Pix"], ["backup", "Backup"]] : [])]} atual=${aba} set=${setAba}/>
    ${aba === "produtos" ? html`<div class="card"><div class="cab"><h2>Produtos</h2><button class="btn" onClick=${() => setPf(null)}>+ Novo produto</button></div><p class="txt">Os preços de venda ficam em Estoque › Preço.</p>
      ${s.produtos.length ? html`<div class="tab"><table><thead><tr><th>Produto</th><th class="r">Peso da caixa</th><th class="r">Venda cx / kg</th><th></th></tr></thead><tbody>${[...s.produtos].sort((a, b) => a.nome.localeCompare(b.nome)).map((p) => html`<tr class=${p.ativo === false ? "risc" : ""}><td><b>${p.nome}</b></td><td class="r">${p.pesoCaixaG ? kg(p.pesoCaixaG) : html`<span class="tag warn">definir</span>`}</td><td class="r">${reais(p.precoCx || 0)} / ${reais(p.precoKg || 0)}</td><td><button class="btn ghost" onClick=${() => setPf(p)}>Editar</button></td></tr>`)}</tbody></table></div>` : html`<${Vazio}>Cadastre os produtos.</${Vazio}>`}</div>` : null}
    ${aba === "fornecedores" ? html`<div class="card"><div class="cab"><h2>Fornecedores</h2><button class="btn" onClick=${() => setFf(null)}>+ Novo fornecedor</button></div>
      ${s.fornecedores.length ? html`<div class="tab"><table><tbody>${s.fornecedores.map((f) => html`<tr class=${f.ativo === false ? "risc" : ""}><td><b>${f.nome}</b></td><td>${f.telefone}</td><td><button class="btn ghost" onClick=${() => setFf(f)}>Editar</button></td></tr>`)}</tbody></table></div>` : html`<${Vazio}>Nenhum.</${Vazio}>`}</div>` : null}
    ${aba === "locais" ? html`<div class="card"><div class="cab"><h2>Locais de origem</h2><button class="btn" onClick=${() => setLf(null)}>+ Novo local</button></div><p class="txt">Cada local ativo vira uma coluna na planilha do Recebimento.</p>
      ${s.locais.length ? html`<div class="tab"><table><tbody>${[...s.locais].sort((a, b) => a.nome.localeCompare(b.nome)).map((l) => html`<tr class=${l.ativo === false ? "risc" : ""}><td><b>${l.nome}</b></td><td><button class="btn ghost" onClick=${() => setLf(l)}>Editar</button></td></tr>`)}</tbody></table></div>` : html`<${Vazio}>Nenhum local ainda.</${Vazio}>`}</div>` : null}
    ${lf !== undefined ? html`<${LocalForm} l=${lf} onFechar=${() => setLf(undefined)}/>` : null}
    ${aba === "impressora" ? html`<${ImpressoraConfig}/>` : null}
    ${aba === "equipe" ? html`<${Equipe} s=${s}/>` : null}
    ${aba === "pix" ? html`<${PixConfig} s=${s}/>` : null}
    ${aba === "backup" ? html`<${LinkSistema} s=${s}/><${Backup} s=${s}/>` : null}
    ${pf !== undefined ? html`<${ProdutoForm} p=${pf} onFechar=${() => setPf(undefined)}/>` : null}
    ${ff !== undefined ? html`<${FornecedorForm} f=${ff} onFechar=${() => setFf(undefined)}/>` : null}
  </div>`;
}
