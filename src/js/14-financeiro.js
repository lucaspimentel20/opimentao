// ============ FINANCEIRO ============
function Financeiro({ s, c }) {
  const gestor = papelDe(s) === "gestor";
  const dev = s.clientes.map((x) => ({ ...x, ...c.clientes.get(x.id) })).filter((x) => x.deve > 0).sort((a, b) => b.vencido - a.vencido || b.deve - a.deve);
  const ss = [...s.sessoes].sort((a, b) => (a.abertoEm < b.abertoEm ? 1 : -1)).slice(0, 60);
  return html`<div class="pag"><h1>Financeiro</h1>
    <div class="grade"><${Num} r="A receber" v=${reais(dev.reduce((a, x) => a + x.deve, 0))} tom="alerta"/><${Num} r="Vencido" v=${reais(dev.reduce((a, x) => a + x.vencido, 0))} tom="ruim"/></div>
    <div class="card"><h2>Contas a receber por cliente</h2>${dev.length ? html`<div class="tab"><table><thead><tr><th>Cliente</th><th>Telefone</th><th class="r">Deve</th><th class="r">Vencido</th><th></th></tr></thead><tbody>${dev.map((x) => html`<tr><td><b>${x.nome}</b></td><td>${x.telefone}</td><td class="r">${reais(x.deve)}</td><td class="r">${reais(x.vencido)}</td><td><a class="btn sm" href=${"#cliente-" + x.id}>Receber</a></td></tr>`)}</tbody></table></div>` : html`<${Vazio}>Ninguém devendo.</${Vazio}>`}</div>
    ${gestor ? html`<div class="card"><h2>Histórico de caixas</h2>${ss.length ? html`<div class="tab"><table><thead><tr><th>Caixa</th><th>Operador</th><th>Aberto</th><th>Fechado</th><th class="r">Esperado</th><th class="r">Contado</th><th class="r">Diferença</th></tr></thead><tbody>${ss.map((x) => { const f = x.fechamento; const e = c.sess.get(x.id); return html`<tr><td>${x.nome}</td><td>${nomePessoa(s, x.operadorId)}</td><td>${dataHora(x.abertoEm)}</td><td>${f ? dataHora(f.em) : html`<b style="color:var(--pri)">Aberto</b>`}</td><td class="r">${reais(f ? f.esperado.dinheiro + f.esperado.pix + f.esperado.cartao : e.dinheiro + e.pix + e.cartao)}</td><td class="r">${f ? reais(f.contado.dinheiro + f.contado.pix + f.contado.cartao) : "—"}</td><td class="r" style=${f && f.diferenca ? "color:var(--err)" : ""}>${f ? reais(f.diferenca) : "—"}</td></tr>`; })}</tbody></table></div>` : html`<${Vazio}>Nenhum caixa ainda.</${Vazio}>`}</div>` : null}
  </div>`;
}
