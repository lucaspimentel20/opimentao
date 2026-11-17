// ============ ENTRADA ============
function Entrada({ s, c }) {
  const nova = () => ({ k: novoId("L"), produtoId: "", ctrl: true, qtd: "", tipos: [{ tipo: "", q: "" }], peso: "", valor: "" });
  const [forn, setFornBase] = useState(""); const [dc, setDc] = useState(hojeISO());
  // de onde vem a mercadoria: um local para a nota toda, ou "varios" (escolhe por produto)
  const [localNota, setLocalNota] = useState(""); const [novoLoc, setNovoLoc] = useState(null);
  const locAtivos = s.locais.filter((x) => x.ativo !== false).sort((a, b) => a.nome.localeCompare(b.nome));
  const setForn = (id) => { setFornBase(id); const ult = [...S.compras].filter((cp) => cp.fornecedorId === id && cp.status !== "cancelada").sort((a, b) => (a.criadoEm < b.criadoEm ? 1 : -1))[0]; if (ult) setLocalNota(ult.localModo === "varios" ? "varios" : ult.localId || ""); }; const [dr, setDr] = useState(hojeISO());
  const [linhas, setLinhas] = useState([nova()]); const [frete, setFrete] = useState(""); const [pago, setPago] = useState(false); const [obs, setObs] = useState("");
  const [comVal, setComVal] = useState(""); const [numNota, setNumNota] = useState(""); const [semFrete, setSemFrete] = useState(false); const [semCom, setSemCom] = useState(false);
  const [chave, setChave] = useState(novoId("C")); const [oc, rodar] = useAcao();
  const [novoF, setNovoF] = useState(null); const [novoT, setNovoT] = useState(null);
  const sessao = sessaoMinha(s);
  const lidas = linhas.map((l) => {
    // sem controle de caixas (ex.: saco): só a quantidade; com controle: quantidade por tipo de caixa
    const tps = l.ctrl ? l.tipos.map((t) => ({ tipo: t.tipo, q: somaTxt(t.q) })) : [];
    const qSimples = somaTxt(l.qtd);
    const tiposOk = !l.ctrl ? Number.isInteger(qSimples) && qSimples > 0 : tps.length > 0 && tps.every((t) => t.tipo && Number.isInteger(t.q) && t.q > 0) && new Set(tps.map((t) => t.tipo)).size === tps.length;
    const cx = !l.ctrl ? (Number.isInteger(qSimples) ? qSimples : 0) : tps.reduce((a, t) => a + (Number.isFinite(t.q) ? t.q : 0), 0), g = paraGramas(l.peso), vCx = paraCentavos(l.valor);
    const v = vCx > 0 ? vCx * cx : vCx; // valor informado por caixa × quantidade de caixas
    return { ...l, tps, cx, g, vCx, v, tiposOk, ok: !!l.produtoId && tiposOk && cx > 0 && g > 0 && vCx > 0 };
  });
  const val = lidas.filter((l) => l.ok);
  const totalCx = val.reduce((a, l) => a + l.cx, 0);
  // frete e comissão informados POR CAIXA: total = valor × total de caixas
  const frCx = semFrete ? 0 : paraCentavos(frete) || 0, comCx = semCom ? 0 : paraCentavos(comVal) || 0;
  const fr = frCx * totalCx, com = comCx * totalCx;
  const rat = val.map((l) => l.cx * frCx);
  const totalM = val.reduce((a, l) => a + l.v, 0);
  const ratC = val.map((l) => l.cx * comCx);
  const faltaLocal = localNota === "varios" && lidas.some((l) => l.produtoId && !l.localId);
  const pode = !faltaLocal && forn && val.length && val.length === lidas.length && Number.isFinite(paraCentavos(frete)) && Number.isFinite(paraCentavos(comVal)) && (!pago || sessao);
  const setL = (k, fn) => setLinhas(linhas.map((x) => (x.k === k ? fn(x) : x)));
  const mudar = (k, campo, valor) => setL(k, (x) => { const n = { ...x, [campo]: valor }; if (campo === "produtoId") { const p = c.prod.get(valor); if (p && !x.peso && p.pesoCaixaG) n.peso = String(p.pesoCaixaG / 1000).replace(".", ","); const t = c.estoque.get(valor)?.tiposCaixa[0]; if (t && x.tipos.length === 1 && !x.tipos[0].tipo) n.tipos = [{ ...x.tipos[0], tipo: t }]; // embalagem: a mesma da última entrada desse produto (caixa ou saco)
      const ult = [...S.compras].filter((cp) => cp.status !== "cancelada").sort((a, b) => (a.criadoEm < b.criadoEm ? 1 : -1)).flatMap((cp) => cp.itens).find((it) => it.produtoId === valor);
      n.ctrl = ult ? (ult.embalagem ? ult.embalagem === "caixa" : tiposDo(ult).length > 0) : true; } return n; });
  const mudarTipo = (k, i, campo, valor) => setL(k, (x) => ({ ...x, tipos: x.tipos.map((t, j) => (j === i ? { ...t, [campo]: valor } : t)) }));
  const devolver = new Map(); val.forEach((l) => l.tps.forEach((t) => { const tt = c.tipos.get(t.tipo); if (tt && tt.retornavel !== false) devolver.set(tt.nome, (devolver.get(tt.nome) || 0) + t.q); }));
  const lista = [...s.compras].sort((a, b) => (a.criadoEm < b.criadoEm ? 1 : -1)).slice(0, 80);
  const opTipos = s.tiposCaixa.filter((t) => t.ativo !== false);
  return html`<div class="pag"><h1>Entrada de Mercadorias</h1>
    <div class="card"><h2>Nova entrada (nota do fornecedor)</h2>
      <div class="grade">
        <${Campo} r="Fornecedor"><div style="display:flex;gap:6px"><${Sel} valor=${forn} set=${setForn} vazio="Escolha" opcoes=${s.fornecedores.filter((x) => x.ativo !== false).map((x) => [x.id, x.nome])}/><button class="btn out" aria-label="Novo fornecedor" onClick=${() => setNovoF("")}>+</button></div></${Campo}>
        <${Campo} r="De onde vem / onde pegar" d=${localNota === "varios" ? "Escolha o local em cada produto" : "Opcional"}><div style="display:flex;gap:6px"><select value=${localNota} onChange=${(e) => setLocalNota(e.target.value)}><option value="">— não informar —</option>${locAtivos.map((x) => html`<option value=${x.id}>${x.nome}</option>`)}<option value="varios">Vários lugares (por produto)</option></select><button class="btn out" aria-label="Novo local" onClick=${() => setNovoLoc({ alvo: "nota" })}>+</button></div></${Campo}>
        <${Campo} r="Nº da nota"><input value=${numNota} onInput=${(e) => setNumNota(e.target.value)} placeholder="Opcional"/></${Campo}>
        <${Campo} r="Data da compra"><input type="date" value=${dc} onChange=${(e) => setDc(e.target.value)}/></${Campo}>
        <${Campo} r="Data de chegada"><input type="date" value=${dr} onChange=${(e) => setDr(e.target.value)}/></${Campo}>
      </div>
      ${lidas.map((l, i) => { const ix = val.indexOf(l); const fi = ix >= 0 ? rat[ix] : 0; const ci = ix >= 0 ? ratC[ix] : 0; const custo = l.ok ? l.v + fi + ci : 0; return html`<div class="card" style="background:var(--surface);gap:8px">
        <div class="grade">
          <${Campo} r=${"Produto " + (i + 1)}><${Sel} valor=${l.produtoId} set=${(v) => mudar(l.k, "produtoId", v)} vazio="Produto" opcoes=${s.produtos.filter((p) => p.ativo !== false).map((p) => [p.id, p.nome])}/></${Campo}>
          ${localNota === "varios" ? html`<${Campo} r="Vem de / pegar em"><div style="display:flex;gap:6px"><select value=${linhas[i].localId || ""} onChange=${(e) => mudar(l.k, "localId", e.target.value)}><option value="">Escolha o local</option>${locAtivos.map((x) => html`<option value=${x.id}>${x.nome}</option>`)}</select><button class="btn out" aria-label="Novo local" onClick=${() => setNovoLoc({ alvo: l.k })}>+</button></div></${Campo}>` : null}
          <${Campo} r=${linhas[i].ctrl ? "Peso da caixa (kg)" : "Peso do saco (kg)"}><input inputmode="decimal" value=${linhas[i].peso} onInput=${(e) => mudar(l.k, "peso", e.target.value)} placeholder="25"/></${Campo}>
          <${Campo} r=${linhas[i].ctrl ? "Valor por caixa (R$)" : "Valor por saco (R$)"} d=${l.vCx > 0 && l.cx > 0 ? reais(l.vCx) + " × " + l.cx + " cx = " + reais(l.v) : "Preço da caixa na nota"}><input inputmode="decimal" value=${linhas[i].valor} onInput=${(e) => mudar(l.k, "valor", e.target.value)} placeholder="0,00"/></${Campo}>
        </div>
        <div class="grade" style="align-items:end">
          <${Campo} r="Embalagem"><div class="seg"><button class=${linhas[i].ctrl ? "on" : ""} onClick=${() => setL(l.k, (x) => ({ ...x, ctrl: true, tipos: x.qtd && x.tipos.length === 1 && !x.tipos[0].q ? [{ ...x.tipos[0], q: x.qtd }] : x.tipos }))}>📦 Caixa</button><button class=${!linhas[i].ctrl ? "on" : ""} onClick=${() => setL(l.k, (x) => ({ ...x, ctrl: false, qtd: x.qtd || (x.tipos.length === 1 && x.tipos[0].q ? x.tipos[0].q : "") }))}>🛍 Saco</button></div></${Campo}>
          ${!linhas[i].ctrl ? html`<${Campo} r="Quantos sacos"><input inputmode="tel" placeholder="Ex.: 30 (pode 20+10)" value=${linhas[i].qtd} onInput=${(e) => mudar(l.k, "qtd", e.target.value)}/>${/\+/.test(linhas[i].qtd || "") && Number.isInteger(somaTxt(linhas[i].qtd)) ? html`<i>= ${somaTxt(linhas[i].qtd)}</i>` : null}</${Campo}>` : null}
        </div>
        ${linhas[i].ctrl ? html`<div><small class="txt"><b>Caixas por tipo (escolha o tipo e a quantidade)</b></small>
          ${linhas[i].tipos.map((t, j) => html`<div style="display:flex;gap:6px;align-items:center;margin-top:6px">
            <select style="flex:2" value=${t.tipo} onChange=${(e) => (e.target.value === "__novo" ? setNovoT({ k: l.k, j }) : mudarTipo(l.k, j, "tipo", e.target.value))}><option value="">Tipo de caixa</option>${opTipos.map((o) => html`<option value=${o.id} disabled=${linhas[i].tipos.some((x, y) => y !== j && x.tipo === o.id)}>${o.nome}${o.retornavel === false ? " (descartável)" : ""}</option>`)}<option value="__novo">+ Novo tipo</option></select>
            <input style="flex:1;min-width:80px" inputmode="tel" placeholder="Qtd cx (pode 20+20)" value=${t.q} onInput=${(e) => mudarTipo(l.k, j, "q", e.target.value)}/>${/\+/.test(t.q || "") && Number.isInteger(somaTxt(t.q)) ? html`<small class="txt">= ${somaTxt(t.q)}</small>` : null}
            <button class="btn ghost" aria-label="Tirar tipo" disabled=${linhas[i].tipos.length === 1} onClick=${() => setL(l.k, (x) => ({ ...x, tipos: x.tipos.filter((_, y) => y !== j) }))}>✕</button></div>`)}
          <button class="btn ghost" onClick=${() => setL(l.k, (x) => ({ ...x, tipos: [...x.tipos, { tipo: "", q: "" }] }))}>+ Outro tipo de caixa neste produto</button>
        </div>` : null}
        <div class="lin"><div class="calc">${l.ok ? html`<span>Total: <b>${l.cx} cx</b> × ${kg(l.g)} = <b>${kg(l.cx * l.g)}</b> · mercadoria ${reais(l.v)}</span><span>Frete ${l.cx} × ${reais(frCx)} = ${reais(fi)} · comissão ${l.cx} × ${reais(comCx)} = ${reais(ci)} · custo ${reais(custo)} · <b>${reais(Math.round(custo / l.cx))}/cx</b> · ${reais(Math.round(custo / ((l.cx * l.g) / 1000)))}/kg</span>` : html`<span class="txt">${l.tipos.length > 1 && !l.tiposOk ? "Escolha tipos diferentes e a quantidade de cada um" : "Preencha para ver o custo"}</span>`}</div>
        <button class="btn ghost" disabled=${linhas.length === 1} onClick=${() => setLinhas(linhas.filter((x) => x.k !== l.k))}>🗑 Tirar produto</button></div>
      </div>`; })}
      <div class="acoes"><button class="btn out" onClick=${() => setLinhas([...linhas, nova()])}>+ Adicionar produto</button></div>
      <div class="grade">
        <${Campo} r="Frete por caixa (R$)" d=${semFrete ? "Esta entrada não tem frete" : frCx && totalCx ? reais(frCx) + " × " + totalCx + " cx = " + reais(fr) : "Valor por caixa (volume)"}><input inputmode="decimal" disabled=${semFrete} value=${semFrete ? "" : frete} onInput=${(e) => setFrete(e.target.value)} placeholder=${semFrete ? "Sem frete" : "0,00"}/><label class="chk" style="min-height:30px;font-weight:700"><input type="checkbox" checked=${semFrete} onChange=${(e) => { setSemFrete(e.target.checked); if (e.target.checked) { setFrete(""); setPago(false); } }}/>Sem frete</label></${Campo}>
        <${Campo} r="Comissão por caixa (R$)" d=${semCom ? "Esta entrada não tem comissão" : comCx && totalCx ? reais(comCx) + " × " + totalCx + " cx = " + reais(com) : "Taxa extra por caixa (volume)"}><input inputmode="decimal" disabled=${semCom} value=${semCom ? "" : comVal} onInput=${(e) => setComVal(e.target.value)} placeholder=${semCom ? "Sem comissão" : "0,00"}/><label class="chk" style="min-height:30px;font-weight:700"><input type="checkbox" checked=${semCom} onChange=${(e) => { setSemCom(e.target.checked); if (e.target.checked) setComVal(""); }}/>Sem comissão</label></${Campo}>
        <label class="chk"><input type="checkbox" checked=${pago} disabled=${!fr} onChange=${(e) => setPago(e.target.checked)}/>Frete pago agora com dinheiro do caixa${pago && !sessao ? " (abra o caixa)" : ""}</label>
        <${Campo} r="Observação"><input value=${obs} onInput=${(e) => setObs(e.target.value)}/></${Campo}>
      </div>
      ${devolver.size ? html`<p class="av">Caixas a devolver ao fornecedor: ${[...devolver].map(([n, q]) => q + " " + n).join(" + ")}</p>` : null}
      <div class="lin"><span>Mercadoria ${reais(totalM)} + frete ${reais(fr)} (${totalCx} cx × ${reais(frCx)}) + comissão ${reais(com)} (${totalCx} cx × ${reais(comCx)}) = <b>custo total ${reais(totalM + fr + com)}</b></span>
      <button class="btn" disabled=${!pode || oc} onClick=${() => rodar(async () => {
        const itens = val.map((l, i) => ({ loteId: novoId("T"), produtoId: l.produtoId, localId: localNota === "varios" ? l.localId || null : localNota || null, caixas: l.cx, pesoCaixaG: l.g, valor: l.v, valorCaixa: l.vCx, frete: rat[i], comissao: ratC[i], custoFinal: l.v + rat[i] + ratC[i], tipos: l.tps.map((t) => ({ tipoCaixaId: t.tipo, caixas: t.q })), tipoCaixaId: l.tps[0]?.tipo || null, embalagem: l.ctrl ? "caixa" : "saco" }));
        await gravar("compras", chave, { fornecedorId: forn, localId: localNota && localNota !== "varios" ? localNota : null, localModo: localNota === "varios" ? "varios" : "um", numeroNota: numNota.trim(), dataCompra: dc, dataRecebimento: dr, itens, valorTotal: totalM, frete: fr, fretePagoSessaoId: pago && fr > 0 ? sessao.id : null, comissao: com, fretePorCaixa: frCx, comissaoPorCaixa: comCx, rateio: "valor_por_caixa", obs: obs.trim(), status: "confirmada", criadoPor: S.eu, criadoEm: agora() });
        for (const it of itens) { const p = S.produtos.find((x) => x.id === it.produtoId); if (p && p.pesoCaixaG !== it.pesoCaixaG) await gravar("produtos", p.id, { ...strip(p), pesoCaixaG: it.pesoCaixaG }); }
        setLinhas([nova()]); setLocalNota(""); setFrete(""); setPago(false); setObs(""); setComVal(""); setNumNota(""); setSemFrete(false); setSemCom(false); setChave(novoId("C"));
      }, "Entrada registrada. Estoque atualizado.")}>Confirmar entrada</button>${faltaLocal ? html`<small style="color:var(--err);display:block">Escolha de onde vem cada produto</small>` : null}</div>
    </div>
    <div class="card"><h2>Entradas registradas</h2>${lista.length ? html`<div class="tab"><table><thead><tr><th>Chegada</th><th>Fornecedor</th><th>Produtos e caixas</th><th class="r">Total</th><th>Recebimento</th><th></th></tr></thead><tbody>${lista.map((x) => { const cf = c.conf.get(x.id); return html`<tr class=${x.status === "cancelada" ? "risc" : ""}><td>${dataBR(x.dataRecebimento)}</td><td>${s.fornecedores.find((f) => f.id === x.fornecedorId)?.nome}${x.numeroNota ? html`<br/><small class="txt">nº ${x.numeroNota}</small>` : ""}${x.localModo === "varios" ? html`<br/><small class="txt">📍 vários lugares</small>` : x.localId ? html`<br/><small class="txt">📍 ${s.locais.find((k) => k.id === x.localId)?.nome || ""}</small>` : ""}</td><td>${x.itens.map((i) => `${c.prod.get(i.produtoId)?.nome}: ${tiposTxt(c, i)}`).join("; ")}</td><td class="r">${reais(x.valorTotal + x.frete + (x.comissao || 0))}</td><td>${x.status === "cancelada" ? html`<span class="tag red">Cancelada</span>` : statusConf(cf, s.chegadas.some((k) => k.compraId === x.id))}</td><td><a class="link" href=${"#entrada-" + x.id}>Ficha</a></td></tr>`; })}</tbody></table></div>` : html`<${Vazio}>Nenhuma entrada ainda.</${Vazio}>`}</div>
    ${novoF != null ? html`<${FornecedorForm} f=${null} onFechar=${() => setNovoF(null)} onSalvo=${(id) => setForn(id)}/>` : null}
    ${novoLoc ? html`<${LocalForm} l=${null} onFechar=${() => setNovoLoc(null)} onSalvo=${(id) => (novoLoc.alvo === "nota" ? setLocalNota(id) : mudar(novoLoc.alvo, "localId", id))}/>` : null}
    ${novoT ? html`<${TipoForm} t=${null} onFechar=${() => setNovoT(null)} onSalvo=${(id) => mudarTipo(novoT.k, novoT.j, "tipo", id)}/>` : null}
  </div>`;
}
const strip = (o) => { const { id, ...r } = o; return r; };
const statusConf = (cf, parcial) => !cf ? (parcial ? html`<span class="tag warn">Recebendo</span>` : html`<span class="tag warn">Aguardando conferência</span>`) : cf.status === "confere" ? html`<span class="tag">Conferida ✓</span>` : cf.resolucao ? html`<span class="tag gray">Divergência resolvida</span>` : html`<span class="tag red">Com divergência</span>`;
