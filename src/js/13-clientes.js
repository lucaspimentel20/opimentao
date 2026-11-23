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
    <div class="lista">${abertos.map((t) => html`<label class="chk" style="border:1px solid var(--border);border-radius:10px;padding:4px 10px"><input type="checkbox" checked=${marc.includes(t.vendaId)} onChange=${(e) => setMarc(e.target.checked ? [...marc, t.vendaId] : marc.filter((x) => x !== t.vendaId))}/><span style="flex:1">${nomeTitulo(t)} · ${t.venc ? "vence " + dataBR(t.venc) : dataBR(t.criadoEm)}</span><b>${reais(t.saldo)}</b></label>`)}</div>
    <div class="grade"><${Campo} r="Valor recebido (R$)" d=${"Selecionado: " + reais(dev)}><input inputmode="decimal" value=${v} onInput=${(e) => setV(e.target.value)}/></${Campo}><${Campo} r="Forma"><${Sel} valor=${forma} set=${setForma} opcoes=${FORMAS_SEL}/></${Campo}></div>
    ${val > dev ? html`<p class="av">O valor passa do selecionado.</p>` : null}
    ${forma === "pix" && val > 0 && val <= dev ? html`<${PixQR} s=${s} valor=${val} txid=${chave}/>` : null}
  </${Modal}>`;
}
// lançar valor pendente fora de nota (ex.: saldo anterior, conta antiga do caderno)
function DebitoForm({ cl, onFechar }) {
  const [f, setF] = useState({ valor: "", descricao: "Saldo anterior", vencimento: "" }); const [chave] = useState(novoId("D")); const [oc, rodar] = useAcao();
  const val = paraCentavos(f.valor);
  return html`<${Modal} titulo=${"Valor pendente — " + cl.nome} sub="Entra no saldo devedor do cliente, sem nota e sem mexer no estoque nem no caixa. Depois é recebido normalmente pelo botão Receber." onFechar=${onFechar} rod=${html`<button class="btn out" onClick=${onFechar}>Cancelar</button><button class="btn" disabled=${!(val > 0) || !f.descricao.trim() || oc} onClick=${() => rodar(async () => {
    await gravar("debitos", chave, { clienteId: cl.id, valor: val, descricao: f.descricao.trim(), vencimento: f.vencimento || null, status: "ativo", criadoPor: S.eu, criadoEm: agora() }); onFechar();
  }, "Valor pendente lançado")}>Lançar ${Number.isFinite(val) && val > 0 ? reais(val) : ""}</button>`}>
    <div class="grade">
      <${Campo} r="Valor (R$)"><input inputmode="decimal" autofocus value=${f.valor} onInput=${(e) => setF({ ...f, valor: e.target.value })} placeholder="0,00"/></${Campo}>
      <${Campo} r="Vencimento" d="Opcional"><input type="date" value=${f.vencimento} onInput=${(e) => setF({ ...f, vencimento: e.target.value })}/></${Campo}>
    </div>
    <${Campo} r="Descrição" d="Ex.: saldo anterior, conta do caderno, mercadoria de outubro"><input value=${f.descricao} onInput=${(e) => setF({ ...f, descricao: e.target.value })}/></${Campo}>
  </${Modal}>`;
}
// ---- todos os fiados de uma vez para UM contato do WhatsApp (ele repassa a cada cliente) ----
function extratoFiado(s, c, cliId) {
  const cl = s.clientes.find((x) => x.id === cliId); const k = c.clientes.get(cliId) || { deve: 0 };
  const pend = c.titulos.filter((t) => t.clienteId === cliId && t.saldo > 0).sort((a, b) => (a.criadoEm < b.criadoEm ? -1 : 1));
  const dm = (iso) => (iso ? new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : "");
  const nome = (t) => (t.avulso ? t.descricao : "Nota " + numVenda(t.vendaId));
  return { cl, deve: k.deve, pend, dm, nome };
}
function FiadosWhats({ s, c, onFechar }) {
  const devedores = s.clientes.filter((x) => (c.clientes.get(x.id)?.deve || 0) > 0).sort((a, b) => a.nome.localeCompare(b.nome));
  const [marc, setMarc] = useState(devedores.map((x) => x.id));
  const [fone, setFone] = useState(() => { try { return localStorage.getItem("pim_fiado_contato") || ""; } catch { return ""; } });
  const [arqs, setArqs] = useState(null); const [prog, setProg] = useState(""); const [oc, rodar] = useAcao();
  const sel = devedores.filter((x) => marc.includes(x.id)); const total = sel.reduce((a, x) => a + (c.clientes.get(x.id)?.deve || 0), 0);
  const guardaFone = (v) => { setFone(v); try { localStorage.setItem("pim_fiado_contato", v); } catch { } };
  const hoje = new Date().toLocaleDateString("pt-BR");
  const texto = () => ["*O Pimentão — Fiados em aberto* (" + hoje + ")", "", ...sel.map((x) => { const e = extratoFiado(s, c, x.id); return `*${x.nome}* — deve *${reais(e.deve)}*\n` + e.pend.map((t) => `  ${e.dm(t.criadoEm)} ${e.nome(t)}: ${reais(t.saldo)}${t.vencido ? " (VENCIDA)" : ""}`).join("\n"); }), "", "*TOTAL: " + reais(total) + "*"].join("\n");
  // 1º clique: gera um PDF por cliente (no formato do cupom, logo colorido)
  const gerar = () => rodar(async () => {
    const lista = [];
    for (let i = 0; i < sel.length; i++) {
      const x = sel[i]; setProg(`Gerando ${i + 1} de ${sel.length}: ${x.nome}`);
      const e = extratoFiado(s, c, x.id); const el = document.createElement("div");
      render(html`<div class="cupom">
        <div class="c"><${Pimentao} t=${36}/><br/><b style="font-family:Fredoka;font-size:20px">O Pimentão</b><br/>HORTIFRUTI</div><hr/>
        <div class="c"><b>EXTRATO DE FIADO</b><br/>${hoje}</div><hr/>
        <div class="cli-cupom"><small>CLIENTE:</small> <b>${x.nome}</b></div><hr/>
        <div class="c"><b>CONTAS PENDENTES</b></div><div class="par"><b>Data</b><b>Falta</b></div>
        ${e.pend.map((t) => html`<div class="par"><span>${e.dm(t.criadoEm)} ${e.nome(t)}${t.vencido ? html` <b>VENC.</b>` : null}</span><span>${reais(t.saldo).replace("R$ ", "")}</span></div>`)}
        <div class="saldo-aberto"><span>SALDO EM ABERTO</span><span>${reais(e.deve)}</span></div>
        <div class="c">Obrigado pela preferência!</div>
      </div>`, el);
      const nomeArq = "Fiado-" + x.nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "") + ".pdf";
      lista.push(await pdfDoCupom(el.firstElementChild, nomeArq));
    }
    setProg(""); setArqs(lista);
  });
  // 2º clique: compartilha todos de uma vez (escolha o contato no WhatsApp); se não der, baixa e abre a conversa do contato
  const enviar = () => rodar(async () => {
    const msg = `O Pimentão — ${arqs.length} extrato(s) de fiado, total ${reais(total)}`;
    if (navigator.canShare?.({ files: arqs })) { try { await navigator.share({ files: arqs, title: "Fiados", text: msg }); return; } catch (e) { if (e?.name === "AbortError") return; } }
    for (const a of arqs) { const u = URL.createObjectURL(a); const l = document.createElement("a"); l.href = u; l.download = a.name; document.body.appendChild(l); l.click(); l.remove(); setTimeout(() => URL.revokeObjectURL(u), 60000); await new Promise((r) => setTimeout(r, 400)); }
    abrirWhatsApp(fone, msg); toast("PDFs baixados na pasta Downloads. Na conversa, clique no clipe 📎 e anexe todos.");
  });
  return html`<${Modal} grande titulo="Enviar todos os fiados" sub="Vai tudo para UM contato seu (ex.: o cobrador ou você mesmo). Depois é só encaminhar cada PDF para o cliente certo." onFechar=${onFechar}
    rod=${html`<button class="btn out" onClick=${() => abrirWhatsApp(fone, texto())} disabled=${!sel.length}>💬 Mandar como texto</button>${arqs ? html`<button class="btn" disabled=${oc} onClick=${enviar}>📤 Enviar ${arqs.length} PDF(s)</button>` : html`<button class="btn" disabled=${oc || !sel.length} onClick=${gerar}>${oc ? prog || "Gerando…" : "📄 Gerar " + sel.length + " PDF(s)"}</button>`}`}>
    <${Campo} r="WhatsApp do contato que vai receber" d="Fica guardado neste aparelho. Ex.: 91 98888-7777"><input inputmode="tel" value=${fone} onInput=${(e) => guardaFone(e.target.value)} placeholder="DDD + número"/></${Campo}>
    <div class="acoes"><button class="btn ghost sm" onClick=${() => { setMarc(devedores.map((x) => x.id)); setArqs(null); }}>Marcar todos</button><button class="btn ghost sm" onClick=${() => { setMarc([]); setArqs(null); }}>Desmarcar</button><span class="txt">${sel.length} cliente(s) · total <b>${reais(total)}</b></span></div>
    <div class="lista" style="max-height:45vh;overflow:auto">${devedores.map((x) => html`<label class="chk" style="border:1px solid var(--border);border-radius:10px;padding:4px 10px"><input type="checkbox" checked=${marc.includes(x.id)} onChange=${(e) => { setMarc(e.target.checked ? [...marc, x.id] : marc.filter((y) => y !== x.id)); setArqs(null); }}/><span style="flex:1">${x.nome}${(c.clientes.get(x.id)?.vencido || 0) > 0 ? html` <span class="tag red">vencido</span>` : null}</span><b>${reais(c.clientes.get(x.id)?.deve || 0)}</b></label>`)}</div>
    ${!devedores.length ? html`<${Vazio}>Ninguém devendo. 🎉</${Vazio}>` : null}
  </${Modal}>`;
}
function Clientes({ s, c, selId }) {
  const gestor = papelDe(s) === "gestor";
  const [b, setB] = useState(""); const [so, setSo] = useState(false); const [ed, setEd] = useState(undefined); const [rec, setRec] = useState(false); const [est, setEst] = useState(null); const [mot, setMot] = useState(""); const [mv, setMv] = useState(null); const [oc, rodar] = useAcao(); const [deb, setDeb] = useState(false); const [todosFiados, setTodosFiados] = useState(false);
  const cancelarDebito = (t) => rodar(async () => { if (!confirm(`Cancelar o valor pendente "${t.descricao}" de ${reais(t.valor)}?`)) return; await alterar("debitos", t.vendaId, { status: "cancelado", canceladoPor: S.eu, canceladoEm: agora() }); }, "Valor pendente cancelado");
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
        <div class="acoes"><button class="btn out" onClick=${() => setEd(cl)}>Editar</button>${gestor ? html`<button class="btn out" onClick=${() => setDeb(true)}>+ Valor pendente</button>` : null}${k.deve > 0 ? html`<button class="btn" onClick=${() => setRec(true)}>Receber</button>` : null}</div></div>
      <div class="grade"><${Num} r="Total comprado" v=${reais(k.comprou)}/><${Num} r="Saldo devedor" v=${reais(k.deve)} tom=${k.deve ? "alerta" : "bom"} d=${cl.limite ? "limite " + reais(cl.limite) : ""}/><${Num} r="Vencido" v=${reais(k.vencido)} tom=${k.vencido ? "ruim" : ""}/><${Num} r="Caixas com o cliente" v=${cxs.reduce((a, [, q]) => a + Math.max(0, q), 0)}/></div>
      ${cxs.length ? html`<div class="card"><h2>Caixas vazias com o cliente</h2><div class="tab"><table><tbody>${cxs.map(([t, q]) => html`<tr><td>${c.tipos.get(t)?.nome}</td><td class="r"><b>${q > 0 ? q : "devolveu " + -q + " a mais"}</b></td><td><button class="btn ghost" onClick=${() => setMv({ tipo: "retorno_cliente", tipoId: t, parteId: cl.id, parteNome: cl.nome, q: Math.max(0, q) })}>Cliente devolveu</button></td></tr>`)}</tbody></table></div></div>` : null}
      <div class="card"><div class="cab" style="margin:0"><h2>Fiado (compras na conta)</h2>${gestor ? html`<button class="btn out sm" onClick=${() => setDeb(true)}>+ Valor pendente fora de nota</button>` : null}</div>${tits.length ? html`<div class="tab"><table><thead><tr><th>Venda</th><th>Data</th><th>Vencimento</th><th class="r">Valor</th><th class="r">Falta</th><th>Situação</th><th></th></tr></thead><tbody>${tits.map((t) => html`<tr><td>${t.avulso ? html`<b>Fora de nota</b><br/><small>${t.descricao}</small>` : html`<a class="link" href=${"#venda-" + t.vendaId}>${numVenda(t.vendaId)}</a>`}</td><td>${dataBR(t.criadoEm)}</td><td>${t.venc ? dataBR(t.venc) : "—"}</td><td class="r">${reais(t.valor)}</td><td class="r">${reais(Math.max(0, t.saldo))}</td><td>${t.vencido ? html`<span class="tag red">Vencido</span>` : t.status === "quitado" ? html`<span class="tag">Quitado</span>` : t.status === "parcial" ? html`<span class="tag warn">Pago em parte</span>` : html`<span class="tag warn">Em aberto</span>`}</td><td>${t.avulso ? (gestor && t.pago === 0 ? html`<button class="btn ghost sm" onClick=${() => cancelarDebito(t)}>Cancelar</button>` : null) : html`<${BotoesImpressao} v=${s.vendas.find((x) => x.id === t.vendaId)} c=${c}/>`}</td></tr>`)}</tbody></table></div>` : html`<${Vazio}>Nenhuma.</${Vazio}>`}</div>
      <div class="card"><h2>Pagamentos recebidos</h2>${recs.length ? html`<div class="tab"><table><thead><tr><th>Data</th><th>Forma</th><th>Recebido por</th><th class="r">Valor</th><th></th></tr></thead><tbody>${recs.map((r) => html`<tr class=${r.estorno ? "risc" : ""}><td>${dataHora(r.criadoEm)}</td><td>${FORMAS[r.forma]}</td><td>${nomePessoa(s, r.criadoPor)}</td><td class="r">${reais(r.valor)}</td><td>${r.estorno ? html`<span class="tag gray">Estornado</span>` : gestor ? html`<button class="btn ghost" onClick=${() => setEst(r)}>Estornar</button>` : null}</td></tr>`)}</tbody></table></div>` : html`<${Vazio}>Nenhum.</${Vazio}>`}</div>
      <div class="card"><h2>Histórico de compras</h2>${vs.length ? html`<div class="tab"><table><thead><tr><th>Venda</th><th>Data</th><th class="r">Total</th><th class="r">A prazo</th><th></th></tr></thead><tbody>${vs.map((v) => html`<tr class=${v.status === "cancelada" ? "risc" : ""}><td><a class="link" href=${"#venda-" + v.id}>${numVenda(v.id)}</a></td><td>${dataHora(v.criadoEm)}</td><td class="r">${reais(v.total)}</td><td class="r">${v.prazo ? reais(v.prazo) : "—"}</td><td><${BotoesImpressao} v=${v} c=${c}/></td></tr>`)}</tbody></table></div>` : html`<${Vazio}>Nenhuma.</${Vazio}>`}</div>
      ${rec ? html`<${Receber} s=${s} c=${c} cl=${cl} onFechar=${() => setRec(false)}/>` : null}
      ${deb ? html`<${DebitoForm} cl=${cl} onFechar=${() => setDeb(false)}/>` : null}
      ${mv ? html`<${MovCaixariaForm} s=${s} ini=${mv} onFechar=${() => setMv(null)}/>` : null}
      ${est ? html`<${Modal} titulo="Estornar recebimento" sub="O valor sai do seu caixa e a dívida volta." onFechar=${() => setEst(null)} rod=${html`<button class="btn out" onClick=${() => setEst(null)}>Voltar</button><button class="btn red" disabled=${mot.trim().length < 3 || oc} onClick=${() => rodar(async () => { const sess = sessaoMinha(S); if (!sess) throw new Error("Abra seu caixa: o estorno sai dele."); await alterar("recebimentos", est.id, { estorno: { motivo: mot.trim(), por: S.eu, em: agora(), sessaoId: sess.id } }); setEst(null); }, "Estornado")}>Estornar</button>`}><${Campo} r="Motivo"><input value=${mot} onInput=${(e) => setMot(e.target.value)}/></${Campo}></${Modal}>` : null}
    </div>`;
  }
  return html`<div class="pag">
    ${cl ? det : html`<div class="cab"><h1>Clientes</h1><div class="acoes"><button class="btn out" onClick=${() => setTodosFiados(true)}>📤 Enviar todos os fiados</button><button class="btn" onClick=${() => setEd(null)}>+ Novo cliente</button></div></div>${todosFiados ? html`<${FiadosWhats} s=${s} c=${c} onFechar=${() => setTodosFiados(false)}/>` : null}
    <div class="card"><div class="acoes"><input placeholder="🔎 Nome ou telefone" value=${b} onInput=${(e) => setB(e.target.value)} style="max-width:320px"/><label class="chk"><input type="checkbox" checked=${so} onChange=${(e) => setSo(e.target.checked)}/>Só quem está devendo</label></div>
    ${lista.length ? html`<div class="tab"><table><thead><tr><th>Cliente</th><th>Telefone</th><th class="r">Deve</th><th class="r">Vencido</th></tr></thead><tbody>${lista.map((x) => { const k = c.clientes.get(x.id); return html`<tr class=${x.ativo === false ? "risc" : ""}><td><a class="link" href=${"#cliente-" + x.id}>${x.nome}</a></td><td>${x.telefone}</td><td class="r">${k?.deve ? reais(k.deve) : "—"}</td><td class="r">${k?.vencido ? reais(k.vencido) : "—"}</td></tr>`; })}</tbody></table></div>` : html`<${Vazio}>Nenhum cliente.</${Vazio}>`}</div>`}
    ${ed !== undefined ? html`<${ClienteForm} cl=${ed} onFechar=${() => setEd(undefined)} onSalvo=${(id) => { location.hash = "cliente-" + id; }}/>` : null}
  </div>`;
}
