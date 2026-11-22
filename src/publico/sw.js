// O Pimentão — guarda o sistema no aparelho para abrir e vender sem internet.
// Página: tenta a internet primeiro (pega atualizações) e, sem internet, usa a cópia guardada.
// Bibliotecas e fontes (jsdelivr, Google Fonts): usa a cópia guardada e atualiza por trás.
// Banco de dados (Supabase): nunca passa por aqui.
const CACHE = "pimentao-v1";
const BASICO = ["./", "./index.html", "./manifest.webmanifest", "./icone-192.png", "./icone-512.png", "./apple-touch-icon.png"];
const EXTERNOS = /^https:\/\/(cdn\.jsdelivr\.net|fonts\.googleapis\.com|fonts\.gstatic\.com)\//;

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(BASICO)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

async function paginaPrimeiroRede(req) {
  const c = await caches.open(CACHE);
  try {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 5000);
    const r = await fetch(req, { signal: ctl.signal, cache: "no-store" }); clearTimeout(t);
    if (r.ok) c.put("./index.html", r.clone());
    return r;
  } catch {
    return (await c.match("./index.html")) || (await c.match("./")) || Response.error();
  }
}
async function guardadoPrimeiro(req) {
  const c = await caches.open(CACHE);
  const guardado = await c.match(req);
  const daRede = fetch(req).then((r) => { if (r.ok || r.type === "opaque") c.put(req, r.clone()); return r; }).catch(() => null);
  return guardado || (await daRede) || Response.error();
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.searchParams.has("verificar")) return; // checagem de versão nova: sempre da internet
  if (req.mode === "navigate" && url.origin === location.origin) return e.respondWith(paginaPrimeiroRede(req));
  if (url.origin === location.origin || EXTERNOS.test(req.url)) return e.respondWith(guardadoPrimeiro(req));
});

// a página manda a lista de arquivos que ela usou, para garantir que tudo fique guardado
self.addEventListener("message", (e) => {
  if (e.data?.tipo !== "guardar") return;
  e.waitUntil(caches.open(CACHE).then((c) => Promise.all(e.data.urls.map((u) =>
    c.match(u).then((tem) => tem || fetch(u, { mode: EXTERNOS.test(u) ? "cors" : "same-origin" }).then((r) => (r.ok || r.type === "opaque") && c.put(u, r)).catch(() => {}))
  ))));
});
