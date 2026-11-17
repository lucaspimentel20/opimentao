// ============ APP ============
const MENU = [["painel", "Painel", true], ["caixa", "Caixa e Vendas"], ["entregas", "Entregas"], ["entrada", "Entrada"], ["recebimento", "Recebimento"], ["estoque", "Estoque"], ["caixaria", "Caixaria"], ["clientes", "Clientes"], ["financeiro", "Financeiro"], ["relatorios", "Relatórios", true], ["config", "Configurações"]];
function useHash() { const [h, setH] = useState(location.hash.slice(1)); useEffect(() => { const f = () => { setH(location.hash.slice(1)); scrollTo(0, 0); }; addEventListener("hashchange", f); return () => removeEventListener("hashchange", f); }, []); return h; }
function Toast() { const [t, setT] = useState(null); useEffect(() => { toastFn = (x) => { setT(x); clearTimeout(toastFn.tm); toastFn.tm = setTimeout(() => setT(null), x.erro ? 6000 : 3200); }; }, []); return t ? html`<div class=${"toast " + (t.erro ? "e" : "")} role="status">${t.m}</div>` : null; }

function App() {
  const s = useStore(); const h = useHash();
  const c = useMemo(() => (s.pronto ? calcular(s) : null), [versao, s.pronto]);
  const [minhaSenha, setMinhaSenha] = useState(false);
  if (s.fase === "config") return html`<${TelaConfig}/><${Toast}/>`;
  if (s.fase === "login" || s.fase === "inicio") return html`<${TelaLogin} s=${s}/><${Toast}/>`;
  if (s.fase === "bloqueado") return html`<div class="login"><div class="card" style="max-width:420px"><h2>Usuário desativado</h2><p class="txt">Fale com o gestor.</p><button class="btn" onClick=${sair}>Sair</button></div></div>`;
  if (!s.pronto || !c) return html`<div class="pag" style="padding:24px"><h1>O Pimentão</h1>${s.erro ? html`<p class="erro">${s.erro}</p>` : html`<p class="txt">Carregando dados…</p>`}</div>`;
  const papel = papelDe(s); const gestor = papel === "gestor";
  const menu = MENU.filter((m) => !m[2] || gestor);
  let rota = h || (gestor ? "painel" : "caixa");
  if (!menu.some((m) => m[0] === rota) && !/^(venda|entrada|cliente)-/.test(rota)) rota = gestor ? "painel" : "caixa";
  const base = rota.split("-")[0]; const arg = rota.includes("-") ? rota.slice(rota.indexOf("-") + 1) : null;
  const ativo = base === "venda" ? "caixa" : base === "cliente" ? "clientes" : base;
  let tela;
  if (base === "painel") tela = html`<${Painel} s=${s} c=${c}/>`;
  else if (base === "caixa") tela = html`<${Caixa} s=${s} c=${c}/>`;
  else if (base === "venda") tela = html`<${Comprovante} s=${s} c=${c} id=${arg}/>`;
  else if (base === "entrada" && arg) tela = html`<${FichaEntrada} s=${s} c=${c} id=${arg}/>`;
  else if (base === "entrada") tela = html`<${Entrada} s=${s} c=${c}/>`;
  else if (base === "entregas") tela = html`<${Entregas} s=${s} c=${c}/>`;
  else if (base === "recebimento") tela = html`<${Recebimento} s=${s} c=${c}/>`;
  else if (base === "estoque") tela = html`<${Estoque} s=${s} c=${c}/>`;
  else if (base === "caixaria") tela = html`<${Caixaria} s=${s} c=${c}/>`;
  else if (base === "clientes" || base === "cliente") tela = html`<${Clientes} s=${s} c=${c} selId=${base === "cliente" ? arg : null}/>`;
  else if (base === "financeiro") tela = html`<${Financeiro} s=${s} c=${c}/>`;
  else if (base === "relatorios") tela = html`<${Relatorios} s=${s} c=${c}/>`;
  else tela = html`<${Config} s=${s}/>`;
  const nome = s.pessoas.find((p) => p.id === s.eu)?.nome || s.euNome;
  return html`<div class="shell">
    <aside class="side"><div class="logo"><${Pimentao}/><span><span class="o">O</span> Pimentão</span></div>
      <nav class="nav">${menu.map(([k, r]) => html`<a href=${"#" + k} class=${ativo === k ? "on" : ""}>${r}</a>`)}</nav>
      <div class="quem"><b>${nome}</b><span>${gestor ? "Gestor" : "Operador"}</span>${s.offline ? html`<small style="display:block;color:#FFB4A9">Sem conexão em tempo real…</small>` : null}<div style="display:flex;gap:6px;margin-top:8px"><button class="btn ghost sm" style="color:#FFF8EE" onClick=${() => setMinhaSenha(true)}>Minha senha</button><button class="btn ghost sm" style="color:#FFF8EE" onClick=${sair}>Sair</button></div></div></aside>
    <header class="top"><div class="logo"><${Pimentao} t=${24}/><span><span class="o">O</span> Pimentão</span></div><small>${nome} · ${gestor ? "Gestor" : "Operador"} · <a href="#" style="color:inherit" onClick=${(e) => { e.preventDefault(); sair(); }}>Sair</a></small></header>
    <main class="main">${s.erro ? html`<p class="erro">${s.erro}</p>` : null}${tela}</main>
    <nav class="bottom">${menu.map(([k, r]) => html`<a href=${"#" + k} class=${ativo === k ? "on" : ""}>${r.split(" ")[0]}</a>`)}</nav>
    ${minhaSenha ? html`<${SenhaForm} u=${{ id: s.eu, nome }} onFechar=${() => setMinhaSenha(false)}/>` : null}
    <${Toast}/>
  </div>`;
}
render(html`<${App}/>`, document.getElementById("app"));
iniciar();