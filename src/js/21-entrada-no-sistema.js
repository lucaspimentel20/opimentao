// ============ ENTRADA NO SISTEMA ============
function TelaConfig() {
  const [u, setU] = useState(""); const [k, setK] = useState("");
  return html`<div class="login"><div class="card" style="max-width:520px;width:100%"><div class="logo" style="color:var(--side)"><${Pimentao}/><span><span class="o" style="color:var(--acc)">O</span> Pimentão</span></div>
    <h2>Ligar ao banco de dados</h2><p class="txt">Só na primeira vez neste aparelho. No Supabase: Project Settings › API.</p>
    ${S.erro ? html`<p class="erro">${S.erro}</p>` : null}
    <${Campo} r="Project URL"><input value=${u} onInput=${(e) => setU(e.target.value)} placeholder="https://xxxx.supabase.co"/></${Campo}>
    <${Campo} r="Chave anon public"><input value=${k} onInput=${(e) => setK(e.target.value)} placeholder="eyJ..."/></${Campo}>
    <button class="btn lg" disabled=${!/^https:\/\/.+/.test(u.trim()) || k.trim().length < 20} onClick=${() => { try { localStorage.setItem("pim_url", u.trim().replace(/\/+$/, "")); localStorage.setItem("pim_key", k.trim()); } catch { } location.reload(); }}>Conectar</button>
  </div></div>`;
}
function TelaLogin({ s }) {
  const [nome, setNome] = useState(""); const [login, setLogin] = useState(""); const [senha, setSenha] = useState(""); const [senha2, setSenha2] = useState(""); const [oc, rodar] = useAcao(); const [msg, setMsg] = useState("");
  const vai = async () => { setMsg(""); const ok = await rodar(async () => { if (s.primeiro) await rpc("primeiro_acesso", { p_login: normLogin(login), p_nome: nome.trim(), p_senha: senha }); await entrar(login, senha); }); if (!ok) setMsg("x"); };
  const pode = s.primeiro ? nome.trim().length >= 2 && normLogin(login).length >= 2 && senha.length >= 6 && senha === senha2 : login.trim() && senha;
  return html`<div class="login"><form class="card" style="max-width:420px;width:100%" onSubmit=${(e) => { e.preventDefault(); if (pode && !oc) vai(); }}>
    <div class="logo" style="color:var(--side);font-size:1.6rem"><${Pimentao} t=${40}/><span><span class="o" style="color:var(--acc)">O</span> Pimentão</span></div>
    ${s.erro ? html`<p class="erro">${s.erro}</p>` : null}
    ${s.primeiro ? html`<h2>Primeiro acesso</h2><p class="txt">Crie o usuário do gestor. Depois ele cadastra os operadores em Configurações › Equipe.</p>
      <${Campo} r="Seu nome"><input autofocus value=${nome} onInput=${(e) => { setNome(e.target.value); setLogin(normLogin(e.target.value.split(" ")[0])); }}/></${Campo}>
      <${Campo} r="Usuário para entrar" d=${normLogin(login) ? "Vai entrar como: " + normLogin(login) : ""}><input value=${login} onInput=${(e) => setLogin(e.target.value)} autocapitalize="off"/></${Campo}>
      <${Campo} r="Senha" d="Mínimo 6 caracteres"><input type="password" value=${senha} onInput=${(e) => setSenha(e.target.value)} autocomplete="new-password"/></${Campo}>
      <${Campo} r="Repita a senha"><input type="password" value=${senha2} onInput=${(e) => setSenha2(e.target.value)} autocomplete="new-password"/></${Campo}>` : html`<h2>Entrar</h2>
      <${Campo} r="Usuário"><input autofocus value=${login} onInput=${(e) => setLogin(e.target.value)} autocapitalize="off" autocomplete="username"/></${Campo}>
      <${Campo} r="Senha"><input type="password" value=${senha} onInput=${(e) => setSenha(e.target.value)} autocomplete="current-password"/></${Campo}>
      <p class="txt" style="margin:0">Esqueceu a senha? Peça ao gestor para trocar.</p>`}
    <button class="btn lg" type="submit" disabled=${!pode || oc}>${oc ? "Entrando…" : s.primeiro ? "Criar e entrar" : "Entrar"}</button>
    ${!CONFIG_URL ? html`<button type="button" class="btn ghost sm" onClick=${() => { if (confirm("Trocar o banco de dados deste aparelho?")) { try { localStorage.removeItem("pim_url"); localStorage.removeItem("pim_key"); } catch { } location.reload(); } }}>Trocar banco de dados</button>` : null}
  </form></div>`;
}
