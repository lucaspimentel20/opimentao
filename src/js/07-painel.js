// ============ PAINEL ============
// filtro de período: "caixa aberto" (tudo do expediente atual, mesmo passando da meia-noite) ou por datas
function usePeriodo(s, deInicial) {
  const abertos = s.sessoes.filter((x) => !x.fechamento);
  const [modo, setModo] = useState(abertos.length ? "caixa" : "datas");
  const [de, setDe] = useState(deInicial || hojeComercial()); const [ate, setAte] = useState(hojeComercial());
  const ids = new Set(abertos.map((x) => x.id)); const desde = abertos.map((x) => x.abertoEm).filter(Boolean).sort()[0] || agora();
  const temCaixa = abertos.length > 0; const m = temCaixa ? modo : "datas";
  const naData = (iso) => { const d = diaComercial(iso); return d >= de && d <= ate; }; // dia vira ao meio-dia
  return {
    modo: m, temCaixa,
    venda: (v) => (m === "caixa" ? ids.has(v.sessaoId) : naData(v.criadoEm)),
    mov: (x) => (m === "caixa" ? ids.has(x.sessaoId) || (!x.sessaoId && x.criadoEm >= desde) : naData(x.criadoEm)),
    compra: (x) => (m === "caixa" ? (x.criadoEm || "") >= desde : x.dataRecebimento >= de && x.dataRecebimento <= ate),
    seletor: html`<div class="acoes">${temCaixa ? html`<div class="seg" style="min-width:260px"><button class=${m === "caixa" ? "on" : ""} onClick=${() => setModo("caixa")}>Caixa aberto</button><button class=${m === "datas" ? "on" : ""} onClick=${() => setModo("datas")}>Por datas</button></div>` : null}${m === "datas" ? html`<input type="date" value=${de} onChange=${(e) => setDe(e.target.value)} style="width:160px"/><input type="date" value=${ate} onChange=${(e) => setAte(e.target.value)} style="width:160px"/>` : html`<small class="txt">desde ${dataHora(desde)}</small>`}</div>`,
  };
}
function Painel({ s, c }) {
  const per = usePeriodo(s);
  const vs = s.vendas.filter((v) => v.status !== "cancelada" && per.venda(v));
  const vendas = vs.reduce((a, v) => a + v.total, 0);
  const custo = Math.round(vs.reduce((a, v) => a + (c.custoVenda.get(v.id)?.custo ?? v.custo ?? 0), 0) * 100);
  const perdas = Math.round(s.movEstoque.filter((m) => m.tipo === "desperdicio" && per.mov(m)).reduce((a, m) => a + (m.custo || 0), 0) * 100);
  const hoje = hojeComercial();
  const vendasHoje = s.vendas.filter((v) => v.status !== "cancelada" && diaComercial(v.criadoEm) === hoje).reduce((a, v) => a + v.total, 0);
  const aReceber = c.titulos.reduce((a, t) => a + Math.max(0, t.saldo), 0);
  const vencido = c.titulos.filter((t) => t.vencido).reduce((a, t) => a + t.saldo, 0);
  const valorEst = Math.round([...c.estoque.values()].reduce((a, e) => a + e.valor, 0) * 100);
  const compras = s.compras.filter((x) => x.status !== "cancelada" && per.compra(x)).reduce((a, x) => a + x.valorTotal + x.frete + (x.comissao || 0), 0);
  const despesas = -s.movCaixa.filter((m) => m.tipo === "despesa" && per.mov(m)).reduce((a, m) => a + m.valor, 0);
  const top = new Map(); for (const v of vs) v.itens.forEach((i, k) => { const t = top.get(i.produtoId) || { cx: 0, g: 0, rec: 0, custo: 0 }; t.cx += i.caixas; t.g += i.gramas; t.rec += i.total; t.custo += c.custoVenda.get(v.id)?.itens[k]?.custo ?? i.custo ?? 0; top.set(i.produtoId, t); });
  const tops = [...top.entries()].sort((a, b) => b[1].rec - a[1].rec).slice(0, 10);
  const pendConf = s.compras.filter((x) => x.status !== "cancelada" && !c.conf.get(x.id)).length;
  const divConf = s.conferencias.filter((x) => x.status === "divergente" && !x.resolucao).length;
  const devendo = s.clientes.map((cl) => ({ ...cl, ...c.clientes.get(cl.id) })).filter((x) => x.deve > 0).sort((a, b) => b.deve - a.deve);
  return html`<div class="pag">
    <div class="cab"><h1>Painel</h1>${per.seletor}</div>
    <div class="grade">
      <${Num} r=${per.modo === "caixa" ? "Vendas do caixa aberto" : "Vendas no período"} v=${reais(vendas)} d=${vs.length + " vendas"} tom="bom"/>
      <${Num} r="Lucro bruto" v=${reais(vendas - custo)} tom=${vendas - custo >= 0 ? "bom" : "ruim"} d=${"custo " + reais(custo)}/>
      <${Num} r="Lucro descontando perdas" v=${reais(vendas - custo - perdas)}/>
      <${Num} r="A receber de clientes" v=${reais(aReceber)} tom=${aReceber ? "alerta" : ""} d=${vencido ? reais(vencido) + " vencido" : "nada vencido"}/>
      <${Num} r="Compras no período" v=${reais(compras)} d="mercadoria + frete + comissão"/>
      <${Num} r="Mercadoria em estoque" v=${reais(valorEst)} d="pelo custo"/>
      <${Num} r="Desperdício no período" v=${reais(perdas)} tom=${perdas ? "ruim" : ""}/>
      <${Num} r="Despesas no período" v=${reais(despesas)}/>
      <${Num} r="Recebimentos a conferir" v=${pendConf} tom=${pendConf ? "alerta" : "bom"} d=${divConf ? divConf + " com divergência" : ""}/>
    </div>
    <div class="card"><h2>${c.divergencias.length ? "⚠️ Divergências de conciliação" : "✓ Conciliação em dia"}</h2>
      ${c.divergencias.length ? html`<ul>${c.divergencias.map((d) => html`<li>${d}</li>`)}</ul>` : html`<p class="txt">Estoque, vendas, clientes e caixa conferem entre si.</p>`}</div>
    <div class="duas">
      <div class="card"><h2>Mais vendidos</h2>${tops.length ? html`<div class="tab"><table><thead><tr><th>Produto</th><th class="r">Ainda tem para vender</th><th class="r">Qtd vendida</th><th class="r">Vendido</th><th class="r">Lucro</th></tr></thead><tbody>${tops.map(([id, t]) => { const e = c.estoque.get(id) || { cx: 0, g: 0 }; const neg = e.cx < 0 || e.g < 0; const zero = e.cx === 0 && e.g === 0; return html`<tr><td>${c.prod.get(id)?.nome}</td><td class="r"><b style=${neg ? "color:var(--err)" : zero ? "color:var(--warn)" : ""}>${zero ? "Acabou" : saldoTxt(e.cx, e.g)}</b></td><td class="r">${[t.cx ? t.cx + " cx" : "", t.g ? kg(t.g) : ""].filter(Boolean).join(" + ")}</td><td class="r">${reais(t.rec)}</td><td class="r">${reais(t.rec - Math.round(t.custo * 100))}</td></tr>`; })}</tbody></table></div>` : html`<${Vazio}>Sem vendas no período.</${Vazio}>`}</div>
      <div class="card"><h2>Clientes devendo</h2>${devendo.length ? html`<div class="tab"><table><thead><tr><th>Cliente</th><th class="r">Deve</th><th class="r">Vencido</th></tr></thead><tbody>${devendo.slice(0, 15).map((x) => html`<tr><td><a class="link" href=${"#cliente-" + x.id}>${x.nome}</a></td><td class="r">${reais(x.deve)}</td><td class="r">${reais(x.vencido)}</td></tr>`)}</tbody></table></div>` : html`<${Vazio}>Ninguém devendo.</${Vazio}>`}</div>
    </div>
  </div>`;
}
