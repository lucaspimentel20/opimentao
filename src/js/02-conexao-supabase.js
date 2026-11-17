// ============ conexão (Supabase) ============
// Para não precisar digitar em cada aparelho, preencha aqui o endereço e a chave "anon public" do seu projeto Supabase.
const CONFIG_URL = "https://manwesybtfxcnjdzwskf.supabase.co";
const CONFIG_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1hbndlc3lidGZ4Y25qZHp3c2tmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ3NzM1MzAsImV4cCI6MjExMDM0OTUzMH0.z2aUF3IBdclCM3tYZkl-9Ug2-DQOR-mgGjLCH2nRBGA";
const COLS = ["produtos", "fornecedores", "clientes", "tiposCaixa", "compras", "conferencias", "vendas", "recebimentos", "movEstoque", "movCaixa", "sessoes", "movCaixaria", "chegadas", "config", "locais", "entregas", "pedidos"];
const S = { pronto: false, erro: null, fase: "inicio", primeiro: false, offline: false, eu: null, euNome: "", dono: false, pessoas: [], ...Object.fromEntries(COLS.map((c) => [c, []])) };
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

async function iniciar() {
  const cfg = lerConfig();
  if (!cfg.url || !cfg.key) { S.fase = "config"; avisar(); return; }
  try { SB = createClient(cfg.url, cfg.key, { auth: { persistSession: true, autoRefreshToken: true, storageKey: "pim_auth" } }); }
  catch (e) { S.fase = "config"; S.erro = "Endereço ou chave do Supabase inválidos."; avisar(); return; }
  SB.auth.onAuthStateChange((ev) => { if (ev === "SIGNED_OUT" && S.fase === "app") location.reload(); });
  const { data } = await SB.auth.getSession();
  if (!data?.session) return telaLogin();
  await carregar(data.session.user.id);
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
  S.pessoas = data;
  const eu = data.find((p) => p.id === S.eu);
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
  avisar();
}
async function lerDocs() {
  const tudo = Object.fromEntries(COLS.map((c) => [c, new Map()]));
  for (let de = 0; ; de += 1000) {
    const { data, error } = await SB.from("docs").select("col,id,data,atualizado").order("col").order("id").range(de, de + 999);
    if (error) throw error;
    for (const r of data) if (tudo[r.col]) { tudo[r.col].set(r.id, { id: r.id, ...r.data }); ATU.set(r.col + "/" + r.id, r.atualizado); }
    if (data.length < 1000) break;
  }
  MAPAS = tudo; COLS.forEach((c) => (S[c] = [...tudo[c].values()]));
  const f = FILA; FILA = []; f.forEach(aplicar);
}
let jaConectou = false, CANAL = null;
function ouvir() {
  if (CANAL) return; // já está ouvindo (evita ligar duas vezes)
  CANAL = SB.channel("pimentao-" + Math.random().toString(36).slice(2, 8));
  CANAL
    .on("postgres_changes", { event: "*", schema: "public", table: "docs" }, (p) => aplicar(p.new))
    .on("postgres_changes", { event: "*", schema: "public", table: "usuarios" }, () => carregarUsuarios().then(avisar).catch(() => {}))
    .subscribe((st) => {
      if (st === "SUBSCRIBED") { if (jaConectou) { lerDocs().then(avisar).catch(() => {}); carregarUsuarios().then(avisar).catch(() => {}); } jaConectou = true; S.offline = false; }
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
  try {
    await carregarUsuarios();
    const eu = S.pessoas.find((p) => p.id === uid);
    if (!eu || !eu.ativo) { S.fase = "bloqueado"; avisar(); return; }
    try { ouvir(); } catch (e) { console.warn("tempo real:", e); S.offline = true; }
    await lerDocs();
    S.pronto = true; S.fase = "app"; avisar();
  } catch (e) { S.erro = "Erro ao ler os dados: " + erroBR(e); avisar(); }
}

async function gravar(col, id, data) {
  if (!SB) throw new Error("Sem conexão com os dados.");
  let r = await SB.from("docs").upsert({ col, id, data }).select("col,id,data,atualizado").single();
  if (r.error && /Failed to fetch|NetworkError|Load failed/i.test(r.error.message)) { await new Promise((ok) => setTimeout(ok, 800)); r = await SB.from("docs").upsert({ col, id, data }).select("col,id,data,atualizado").single(); }
  if (r.error) throw new Error(erroBR(r.error));
  aplicar(r.data);
}
async function alterar(col, id, data) {
  const { error } = await SB.rpc("doc_juntar", { p_col: col, p_id: id, p_dados: data });
  if (error) throw new Error(erroBR(error));
  const r = await SB.from("docs").select("col,id,data,atualizado").eq("col", col).eq("id", id).single();
  if (!r.error) aplicar(r.data);
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
