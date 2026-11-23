// ============ conexão (Supabase) ============
// Para não precisar digitar em cada aparelho, preencha aqui o endereço e a chave "anon public" do seu projeto Supabase.
const CONFIG_URL = "https://manwesybtfxcnjdzwskf.supabase.co";
const CONFIG_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1hbndlc3lidGZ4Y25qZHp3c2tmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ3NzM1MzAsImV4cCI6MjExMDM0OTUzMH0.z2aUF3IBdclCM3tYZkl-9Ug2-DQOR-mgGjLCH2nRBGA";
const COLS = ["produtos", "fornecedores", "clientes", "tiposCaixa", "compras", "conferencias", "vendas", "recebimentos", "movEstoque", "movCaixa", "sessoes", "movCaixaria", "chegadas", "config", "locais", "entregas", "pedidos"];
const S = { pronto: false, erro: null, fase: "inicio", primeiro: false, offline: false, pendentes: 0, eu: null, euNome: "", dono: false, pessoas: [], ...Object.fromEntries(COLS.map((c) => [c, []])) };
let SB = null, versao = 0, MAPAS = null; const ATU = new Map(); let FILA = [];
const ouvintes = new Set();
const avisar = () => { versao++; ouvintes.forEach((f) => f(versao)); };
function useStore() { const [, set] = useState(0); useEffect(() => { ouvintes.add(set); return () => ouvintes.delete(set); }, []); return S; }
let toastFn = () => {};
const toast = (m, erro) => toastFn({ m, erro });
const lerConfig = () => { let u = "", k = ""; try { u = localStorage.getItem("pim_url") || ""; k = localStorage.getItem("pim_key") || ""; } catch { } return { url: (CONFIG_URL || u).trim(), key: (CONFIG_KEY || k).trim() }; };
const normLogin = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim().replace(/\s+/g, ".").replace(/[^a-z0-9._-]/g, "");
const emailDe = (login) => normLogin(login) + "@usuarios.opimentao.app";
function erroBR(e) {
  const m = String(e?.message || e || "");
  if (/Invalid login credentials/i.test(m)) return "Usuário ou senha errados.";
  if (/Failed to fetch|NetworkError|fetch failed|Load failed/i.test(m)) return "Sem conexão com a internet ou com o banco.";
  if (/JWT expired|jwt/i.test(m)) return "Sua sessão expirou. Entre de novo.";
  if (/row-level security|permission denied/i.test(m)) return "Sem permissão para gravar (usuário desativado?).";
  if (/Could not find the function|schema cache/i.test(m)) return "O banco ainda não foi instalado. Rode o arquivo instalar.sql no Supabase.";
  return m || "Erro desconhecido.";
}

// ============ funcionar sem internet ============
// 1) cópia dos dados neste aparelho (IndexedDB) para abrir o sistema sem internet;
// 2) fila de envio (localStorage): toda gravação feita sem internet entra aqui e é
//    enviada ao Supabase, na ordem, assim que a conexão voltar.
const LOCAL = (() => {
  let dbp = null;
  const abrir = () => dbp || (dbp = new Promise((ok, erro) => {
    const r = indexedDB.open("pimentao", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("kv");
    r.onsuccess = () => ok(r.result); r.onerror = () => erro(r.error);
  }));
  const tx = async (modo, fn) => { const db = await abrir(); return new Promise((ok, erro) => { const t = db.transaction("kv", modo); const q = fn(t.objectStore("kv")); t.oncomplete = () => ok(q?.result); t.onerror = () => erro(t.error); }); };
  return { ler: (k) => tx("readonly", (st) => st.get(k)).catch(() => undefined), gravar: (k, v) => tx("readwrite", (st) => st.put(v, k)).catch(() => {}) };
})();
const ehRede = (e) => /Failed to fetch|NetworkError|fetch failed|Load failed|network|ERR_INTERNET|ERR_NAME|Timeout|AbortError/i.test(String(e?.message || e || ""));
const FILA_CHAVE = "pim_fila";
let FILA_MEM = null;
function lerFila() { if (FILA_MEM) return FILA_MEM; try { FILA_MEM = JSON.parse(localStorage.getItem(FILA_CHAVE) || "[]"); } catch { FILA_MEM = []; } return FILA_MEM; }
function salvarFila(f) { FILA_MEM = f; try { localStorage.setItem(FILA_CHAVE, JSON.stringify(f)); } catch { } S.pendentes = f.length; }
function aplicarLocal(it) {
  if (!MAPAS || !MAPAS[it.col]) return;
  const m = MAPAS[it.col], ant = m.get(it.id);
  const dados = it.op === "alterar" ? { ...(ant || {}), ...it.data } : it.data;
  m.set(it.id, { ...dados, id: it.id }); S[it.col] = [...m.values()];
}
function enfileirar(op, col, id, data) {
  const it = { op, col, id, data, em: new Date().toISOString(), por: S.eu };
  salvarFila([...lerFila(), it]);
  aplicarLocal(it); S.offline = true; avisar(); guardarCopia();
  setTimeout(sincronizar, 1500);
}
let sincronizando = false;
async function sincronizar() {
  if (sincronizando || !SB || !lerFila().length) return;
  sincronizando = true; let enviou = 0;
  try {
    while (lerFila().length) {
      const it = lerFila()[0]; let error = null;
      try {
        const r = it.op === "alterar"
          ? await SB.rpc("doc_juntar", { p_col: it.col, p_id: it.id, p_dados: it.data })
          : await SB.from("docs").upsert({ col: it.col, id: it.id, data: it.data });
        error = r.error;
      } catch (e) { error = e; }
      if (error && (ehRede(error) || /JWT|jwt|401/.test(String(error.message || error)))) break; // ainda sem internet: tenta depois
      if (error) {
        try { const e = JSON.parse(localStorage.getItem("pim_fila_recusados") || "[]"); e.push({ ...it, erro: String(error.message || error) }); localStorage.setItem("pim_fila_recusados", JSON.stringify(e.slice(-50))); } catch { }
        toast("Uma operação feita sem internet foi recusada pelo banco: " + erroBR(error), true);
      }
      salvarFila(lerFila().slice(1)); enviou++;
    }
  } finally { sincronizando = false; avisar(); }
  if (enviou && !lerFila().length) { toast(`Internet de volta: ${enviou} operação(ões) enviada(s).`); lerDocs().then(avisar).catch(() => {}); }
}
let copiaT = null;
function guardarCopia() {
  clearTimeout(copiaT);
  copiaT = setTimeout(() => {
    if (!MAPAS) return;
    const linhas = [];
    for (const c of COLS) for (const [id, d] of MAPAS[c]) { const { id: _x, ...data } = d; linhas.push({ col: c, id, data, atualizado: ATU.get(c + "/" + id) || null }); }
    LOCAL.gravar("docs", linhas); LOCAL.gravar("docs_em", new Date().toISOString());
  }, 1500);
}
async function lerCopia() {
  const linhas = await LOCAL.ler("docs"); if (!linhas?.length) return false;
  const tudo = Object.fromEntries(COLS.map((c) => [c, new Map()]));
  for (const r of linhas) if (tudo[r.col]) { tudo[r.col].set(r.id, { ...r.data, id: r.id }); if (r.atualizado) ATU.set(r.col + "/" + r.id, r.atualizado); }
  MAPAS = tudo; lerFila().forEach(aplicarLocal); COLS.forEach((c) => (S[c] = [...tudo[c].values()]));
  return true;
}
async function temInternet() {
  if (!navigator.onLine) return false;
  try { const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 4000); const r = await fetch(lerConfig().url + "/auth/v1/health", { headers: { apikey: lerConfig().key }, signal: ctl.signal, cache: "no-store" }); clearTimeout(t); return r.ok; } catch { return false; }
}
addEventListener("online", () => { S.offline = false; avisar(); sincronizar().then(() => { if (!lerFila().length) return lerDocs().then(avisar); }).catch(() => {}); });
addEventListener("offline", () => { S.offline = true; avisar(); });
setInterval(() => { if (lerFila().length) sincronizar(); }, 20000);
setInterval(() => { if (S.pronto && navigator.onLine && !lerFila().length && !sincronizando && Date.now() - (S.atualizadoEm || 0) > 110000) lerDocs().then(avisar).catch(() => {}); }, 120000);
S.pendentes = lerFila().length;

async function iniciar() {
  const cfg = lerConfig();
  if (!cfg.url || !cfg.key) { S.fase = "config"; avisar(); return; }
  try { SB = createClient(cfg.url, cfg.key, { auth: { persistSession: true, autoRefreshToken: true, storageKey: "pim_auth" } }); }
  catch (e) { S.fase = "config"; S.erro = "Endereço ou chave do Supabase inválidos."; avisar(); return; }
  SB.auth.onAuthStateChange((ev) => { if (ev === "SIGNED_OUT" && S.fase === "app") location.reload(); });
  let sessao = null;
  try { const { data } = await SB.auth.getSession(); sessao = data?.session; } catch { }
  if (sessao) return carregar(sessao.user.id);
  let ultimo = ""; try { ultimo = localStorage.getItem("pim_ultimo_uid") || ""; } catch { }
  if (ultimo && !(await temInternet())) return carregar(ultimo); // sem internet: abre com a cópia deste aparelho
  return telaLogin();
}
async function telaLogin() {
  S.fase = "login"; S.erro = null; avisar();
  try { const { data, error } = await SB.rpc("precisa_primeiro_acesso"); if (error) throw error; S.primeiro = !!data; }
  catch (e) { S.erro = "Não consegui falar com o banco: " + erroBR(e); }
  avisar();
}
async function entrar(login, senha) {
  const { data, error } = await SB.auth.signInWithPassword({ email: emailDe(login), password: senha });
  if (error) throw new Error(erroBR(error));
  await carregar(data.user.id);
}
async function sair() { try { await SB.auth.signOut(); } catch { } location.hash = ""; location.reload(); }

async function carregarUsuarios() {
  const { data, error } = await SB.from("usuarios").select("id,login,nome,papel,telefone,ativo").order("nome");
  if (error) throw error;
  S.pessoas = data; LOCAL.gravar("pessoas", data);
  meuPapel();
}
function meuPapel() {
  const eu = S.pessoas.find((p) => p.id === S.eu);
  S.dono = !!eu && eu.papel === "gestor" && eu.ativo; S.euNome = eu?.nome || "";
  if (S.fase === "app" && (!eu || !eu.ativo)) S.fase = "bloqueado";
}
function aplicar(r) {
  if (!r || !r.col || !r.id) return;
  if (!MAPAS) { FILA.push(r); return; }
  const m = MAPAS[r.col]; if (!m) return;
  const k = r.col + "/" + r.id, prev = ATU.get(k);
  if (prev && r.atualizado && prev > r.atualizado) return;
  if (r.atualizado) ATU.set(k, r.atualizado);
  m.set(r.id, { id: r.id, ...r.data }); S[r.col] = [...m.values()];
  avisar(); guardarCopia();
}
async function lerDocs() {
  const tudo = Object.fromEntries(COLS.map((c) => [c, new Map()]));
  for (let de = 0; ; de += 1000) {
    const { data, error } = await SB.from("docs").select("col,id,data,atualizado").order("col").order("id").range(de, de + 999);
    if (error) throw error;
    for (const r of data) if (tudo[r.col]) { tudo[r.col].set(r.id, { id: r.id, ...r.data }); ATU.set(r.col + "/" + r.id, r.atualizado); }
    if (data.length < 1000) break;
  }
  MAPAS = tudo; lerFila().forEach(aplicarLocal); COLS.forEach((c) => (S[c] = [...tudo[c].values()]));
  const f = FILA; FILA = []; f.forEach(aplicar);
  S.dadosDaCopia = false; S.atualizadoEm = Date.now();
  guardarCopia();
}
let jaConectou = false, CANAL = null;
function ouvir() {
  if (CANAL) return; // já está ouvindo (evita ligar duas vezes)
  CANAL = SB.channel("pimentao-" + Math.random().toString(36).slice(2, 8));
  CANAL
    .on("postgres_changes", { event: "*", schema: "public", table: "docs" }, (p) => aplicar(p.new))
    .on("postgres_changes", { event: "*", schema: "public", table: "usuarios" }, () => carregarUsuarios().then(avisar).catch(() => {}))
    .subscribe((st) => {
      if (st === "SUBSCRIBED") { sincronizar(); if (jaConectou || S.dadosDaCopia) { lerDocs().then(avisar).catch(() => {}); carregarUsuarios().then(avisar).catch(() => {}); } jaConectou = true; S.offline = false; }
      else if (st === "CHANNEL_ERROR" || st === "TIMED_OUT" || st === "CLOSED") S.offline = true;
      avisar();
    });
  let escondido = 0;
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) escondido = Date.now();
    else if (escondido && Date.now() - escondido > 60000) { lerDocs().then(avisar).catch(() => {}); carregarUsuarios().then(avisar).catch(() => {}); }
  });
}
async function carregar(uid) {
  S.fase = "carregando"; S.eu = uid; S.erro = null; avisar();
  try { localStorage.setItem("pim_ultimo_uid", uid); } catch { }
  try {
    try { await carregarUsuarios(); }
    catch (e) { const p = await LOCAL.ler("pessoas"); if (!p) throw e; S.pessoas = p; meuPapel(); S.offline = true; }
    const eu = S.pessoas.find((p) => p.id === uid);
    if (!eu || !eu.ativo) { S.fase = "bloqueado"; avisar(); return; }
    try { ouvir(); } catch (e) { console.warn("tempo real:", e); S.offline = true; }
    try { await lerDocs(); }
    catch (e) { if (!(await lerCopia())) throw e; S.offline = true; S.dadosDaCopia = true; setTimeout(() => toast("Sem internet: usando os dados guardados neste aparelho. As vendas serão enviadas quando a internet voltar."), 300); }
    S.pronto = true; S.fase = "app"; avisar();
    sincronizar();
  } catch (e) { S.erro = "Erro ao ler os dados: " + erroBR(e); avisar(); }
}

// Grava no banco; sem internet (ou com envios pendentes), guarda na fila e segue a venda normalmente.
async function gravar(col, id, data) {
  if (!SB) throw new Error("Sem conexão com os dados.");
  if (lerFila().length || !navigator.onLine) return enfileirar("gravar", col, id, data);
  let r;
  try { r = await SB.from("docs").upsert({ col, id, data }).select("col,id,data,atualizado").single(); } catch (e) { r = { error: e }; }
  if (r.error && ehRede(r.error)) return enfileirar("gravar", col, id, data);
  if (r.error) throw new Error(erroBR(r.error));
  aplicar(r.data);
}
async function alterar(col, id, data) {
  if (!SB) throw new Error("Sem conexão com os dados.");
  if (lerFila().length || !navigator.onLine) return enfileirar("alterar", col, id, data);
  let error;
  try { ({ error } = await SB.rpc("doc_juntar", { p_col: col, p_id: id, p_dados: data })); } catch (e) { error = e; }
  if (error && ehRede(error)) return enfileirar("alterar", col, id, data);
  if (error) throw new Error(erroBR(error));
  try { const r = await SB.from("docs").select("col,id,data,atualizado").eq("col", col).eq("id", id).single(); if (!r.error) aplicar(r.data); else aplicarLocal({ op: "alterar", col, id, data }); }
  catch { aplicarLocal({ op: "alterar", col, id, data }); avisar(); }
}
async function gravarLote(linhas, progresso) {
  for (let i = 0; i < linhas.length; i += 400) {
    const { error } = await SB.from("docs").upsert(linhas.slice(i, i + 400));
    if (error) throw new Error(erroBR(error));
    progresso?.(Math.min(i + 400, linhas.length));
  }
  await lerDocs(); avisar();
}
async function rpc(nome, args) { const { data, error } = await SB.rpc(nome, args); if (error) throw new Error(erroBR(error)); return data; }
