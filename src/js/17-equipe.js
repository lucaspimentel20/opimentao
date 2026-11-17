// ============ EQUIPE (usuários com login próprio) ============
function UsuarioForm({ u, onFechar }) {
  const [nome, setNome] = useState(u?.nome || ""); const [login, setLogin] = useState(u?.login || ""); const [mexeuLogin, setMexeu] = useState(!!u);
  const [tel, setTel] = useState(u?.telefone || ""); const [papel, setPapel] = useState(u?.papel || "operador"); const [ativo, setAtivo] = useState(u ? u.ativo : true);
  const [senha, setSenha] = useState(""); const [oc, rodar] = useAcao();
  const lg = normLogin(login);
  const ok = nome.trim().length >= 2 && (u || (lg.length >= 2 && senha.length >= 6));
  return html`<${Modal} titulo=${u ? "Editar usuário" : "Novo usuário"} onFechar=${onFechar} rod=${html`<button class="btn out" onClick=${onFechar}>Cancelar</button><button class="btn" disabled=${!ok || oc} onClick=${() => rodar(async () => {
    if (u) await rpc("alterar_usuario", { p_id: u.id, p_nome: nome.trim(), p_papel: papel, p_telefone: tel.trim(), p_ativo: ativo });
    else await rpc("criar_usuario", { p_login: lg, p_nome: nome.trim(), p_senha: senha, p_papel: papel, p_telefone: tel.trim() });
    await carregarUsuarios(); avisar(); onFechar();
  }, u ? "Usuário salvo" : "Usuário criado")}>Salvar</button>`}>
    <${Campo} r="Nome"><input autofocus value=${nome} onInput=${(e) => { setNome(e.target.value); if (!mexeuLogin) setLogin(normLogin(e.target.value.split(" ")[0])); }}/></${Campo}>
    ${u ? html`<${Num} r="Usuário para entrar" v=${u.login}/>` : html`<${Campo} r="Usuário para entrar" d=${lg ? "Vai entrar como: " + lg : "Sem espaço nem acento"}><input value=${login} onInput=${(e) => { setLogin(e.target.value); setMexeu(true); }} autocapitalize="off"/></${Campo}>`}
    ${!u ? html`<${Campo} r="Senha" d="Mínimo 6 caracteres. Passe para a pessoa."><input value=${senha} onInput=${(e) => setSenha(e.target.value)} autocomplete="new-password"/></${Campo}>` : null}
    <${Campo} r="Telefone"><input inputmode="tel" value=${tel} onInput=${(e) => setTel(e.target.value)}/></${Campo}>
    <${Campo} r="Papel"><div class="seg"><button class=${papel === "operador" ? "on" : ""} onClick=${() => setPapel("operador")}>Operador (caixa)</button><button class=${papel === "gestor" ? "on" : ""} onClick=${() => setPapel("gestor")}>Gestor</button></div></${Campo}>
    ${u ? html`<label class="chk"><input type="checkbox" checked=${ativo} onChange=${(e) => setAtivo(e.target.checked)}/>Ativo (pode entrar no sistema)</label>` : null}
  </${Modal}>`;
}
function SenhaForm({ u, onFechar }) {
  const [a, setA] = useState(""); const [b, setB] = useState(""); const [oc, rodar] = useAcao();
  return html`<${Modal} titulo=${"Trocar senha" + (u.id === S.eu ? "" : " de " + u.nome)} onFechar=${onFechar} rod=${html`<button class="btn out" onClick=${onFechar}>Cancelar</button><button class="btn" disabled=${a.length < 6 || a !== b || oc} onClick=${() => rodar(async () => { await rpc("trocar_senha", { p_id: u.id, p_senha: a }); onFechar(); }, "Senha trocada")}>Trocar</button>`}>
    <${Campo} r="Nova senha" d="Mínimo 6 caracteres"><input type="password" autofocus value=${a} onInput=${(e) => setA(e.target.value)} autocomplete="new-password"/></${Campo}>
    <${Campo} r="Repita a nova senha"><input type="password" value=${b} onInput=${(e) => setB(e.target.value)} autocomplete="new-password"/></${Campo}>
    ${b && a !== b ? html`<p class="av">As senhas não são iguais.</p>` : null}
  </${Modal}>`;
}
function Equipe({ s }) {
  const [uf, setUf] = useState(undefined); const [sf, setSf] = useState(null);
  return html`<div class="card"><div class="cab"><h2>Usuários</h2><button class="btn" onClick=${() => setUf(null)}>+ Novo usuário</button></div>
    <p class="txt">Cada pessoa entra com o próprio usuário e senha. Esqueceu a senha? O gestor troca aqui.</p>
    <div class="tab"><table><thead><tr><th>Nome</th><th>Usuário</th><th>Telefone</th><th>Papel</th><th>Situação</th><th></th></tr></thead><tbody>${s.pessoas.map((p) => html`<tr class=${p.ativo ? "" : "risc"}><td><b>${p.nome}</b>${p.id === s.eu ? " (você)" : ""}</td><td>${p.login}</td><td>${p.telefone}</td><td>${p.papel === "gestor" ? "Gestor" : "Operador"}</td><td>${p.ativo ? html`<span class="tag">Ativo</span>` : html`<span class="tag gray">Desativado</span>`}</td><td style="white-space:nowrap"><button class="btn ghost sm" onClick=${() => setUf(p)}>Editar</button><button class="btn ghost sm" onClick=${() => setSf(p)}>Trocar senha</button></td></tr>`)}</tbody></table></div>
    ${uf !== undefined ? html`<${UsuarioForm} u=${uf} onFechar=${() => setUf(undefined)}/>` : null}
    ${sf ? html`<${SenhaForm} u=${sf} onFechar=${() => setSf(null)}/>` : null}
  </div>`;
}
