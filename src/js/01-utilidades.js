// ============ utilidades ============
const reais = (c) => ((c ?? 0) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const kg = (g, casas = 3) => `${((g ?? 0) / 1000).toLocaleString("pt-BR", { maximumFractionDigits: casas })} kg`;
const saldoTxt = (cx, g) => { const p = []; if (cx !== 0 || g === 0) p.push(`${cx} cx`); if (g !== 0) p.push(kg(g)); return p.join(" + "); };
const paraCentavos = (t) => { const s = String(t ?? "").trim().replace(/\s|R\$/g, ""); if (!s) return 0; const n = Number(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s); return Number.isFinite(n) ? Math.round(n * 100) : NaN; };
// aceita "20+20+5" (soma de várias contagens); devolve NaN se não for número inteiro
const somaTxt = (t) => { const x = String(t ?? "").replace(/\s/g, ""); if (!x) return NaN; if (!/^\d+(\+\d+)*\+?$/.test(x)) return NaN; return x.split("+").filter(Boolean).reduce((a, b) => a + Number(b), 0); };
const paraGramas = (t) => { const s = String(t ?? "").trim().replace(",", "."); if (!s) return 0; const n = Number(s); return Number.isFinite(n) ? Math.round(n * 1000) : NaN; };
const txtReais = (c) => (c > 0 ? (c / 100).toFixed(2).replace(".", ",") : "");
const hojeISO = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
const diaDe = (iso) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date(iso));
const dataBR = (d) => { if (!d) return ""; const x = d.length === 10 ? new Date(d + "T12:00:00") : new Date(d); return x.toLocaleDateString("pt-BR"); };
const dataHora = (d) => d ? new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "";
const hora = (d) => d ? new Date(d).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "";
const somaDias = (iso, n) => { const d = new Date(iso + "T12:00:00"); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const VERSAO_APP = "__VERSAO__";
// nome de uma conta do fiado: venda ou valor lançado fora de nota
const nomeTitulo = (t) => (t.avulso ? "Fora de nota: " + t.descricao : "Venda " + numVenda(t.vendaId));
const novoId = (p) => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.toUpperCase();
const numVenda = (id) => id.slice(1, 9);
const agora = () => new Date().toISOString();
function ratearFrete(valores, frete) {
  const total = valores.reduce((a, b) => a + b, 0);
  if (frete <= 0 || total <= 0) return valores.map(() => 0);
  const ex = valores.map((v) => (v * frete) / total);
  const base = ex.map(Math.floor);
  let falta = frete - base.reduce((a, b) => a + b, 0);
  const ord = ex.map((e, i) => ({ i, r: e - Math.floor(e), v: valores[i] })).sort((a, b) => b.r - a.r || b.v - a.v || a.i - b.i);
  for (let k = 0; falta > 0; k = (k + 1) % ord.length) { base[ord[k].i]++; falta--; }
  return base;
}
const totalItem = (u, cx, g, p, meias) => (u === "cx" ? cx * p : u === "meia" ? meias * p : Math.round((g * p) / 1000));
// preço da meia caixa: o cadastrado, ou metade do preço da caixa
const precoMeiaDe = (p) => (p?.precoMeia > 0 ? p.precoMeia : p?.precoCx > 0 ? Math.round(p.precoCx / 2) : 0);
const FORMAS = { dinheiro: "Dinheiro", pix: "Pix", credito: "Cartão de crédito", debito: "Cartão de débito", cartao: "Cartão" };
const FORMAS_SEL = Object.entries(FORMAS).filter(([k]) => k !== "cartao");
// caixas vazias de um item de venda (aceita o formato antigo {tipoId,q} e o novo [{tipoId,q}, ...])
const cxDe = (it) => (!it?.caixaria ? [] : Array.isArray(it.caixaria) ? it.caixaria : [it.caixaria]);
const tiposDo = (it) => (it.tipos && it.tipos.length ? it.tipos : it.tipoCaixaId ? [{ tipoCaixaId: it.tipoCaixaId, caixas: it.caixas }] : []);
const tiposTxt = (c, it) => { const t = tiposDo(it); return t.length ? t.map((x) => `${x.caixas} cx ${c.tipos.get(x.tipoCaixaId)?.nome || ""}`).join(" + ") : `${it.caixas} ${it.embalagem === "saco" ? "sacos" : "cx"}`; };
