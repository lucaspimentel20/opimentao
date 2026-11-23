// ============ IMPRESSORA (cupom em impressora térmica) ============
// A configuração é de cada aparelho (fica guardada no navegador), porque cada
// computador ou celular tem a sua impressora.
const IMP_CHAVE = "pimentao.impressora";
const IMP_PADRAO = { largura: 80, margem: 3, fonte: 14, vias: 1, auto: true, negrito: true, despacho: true, v: 3 };
function impConfig() {
  try {
    const salvo = JSON.parse(localStorage.getItem(IMP_CHAVE) || "{}");
    if ((salvo.v || 0) < 2) salvo.auto = true; // v2: imprime sozinho ao concluir a venda
    if ((salvo.v || 0) < 3 && (!salvo.fonte || salvo.fonte <= 12) && (salvo.largura || 80) >= 80) salvo.fonte = 14; // v3: letra maior no cupom
    if (salvo.v !== 3) { salvo.v = 3; localStorage.setItem(IMP_CHAVE, JSON.stringify({ ...IMP_PADRAO, ...salvo })); }
    return { ...IMP_PADRAO, ...salvo };
  } catch { return { ...IMP_PADRAO }; }
}
function impSalvar(cfg) {
  try { localStorage.setItem(IMP_CHAVE, JSON.stringify(cfg)); return true; } catch { return false; }
}
// Imprime só o cupom, no tamanho da bobina. Funciona com qualquer impressora
// instalada no aparelho (USB, rede, Bluetooth pareado ou app de impressão no Android).
// reimprimir o cupom de qualquer lista: abre a venda e imprime assim que ela aparecer na tela
function reimprimirVenda(id) { S.reimprimir = id; if (location.hash === "#venda-" + id) avisar(); else location.hash = "venda-" + id; }
function BotoesImpressao({ v, c }) {
  if (!v) return null;
  return html`<span style="white-space:nowrap"><button class="btn ghost sm" title="Reimprimir cupom" onClick=${() => reimprimirVenda(v.id)}>🖨️</button>${v.status !== "cancelada" ? html` <button class="btn ghost sm" title="Nota de despacho" onClick=${() => imprimirDespacho(v, c)}>📦</button>` : null}</span>`;
}
// ---- WhatsApp: abre SEMPRE na mesma janela (não recarrega a cada envio) ou no aplicativo do computador ----
const WA_CHAVE = "pimentao.whatsapp";
function waModo() { try { return localStorage.getItem(WA_CHAVE) || "web"; } catch { return "web"; } }
function abrirWhatsApp(fone, texto) {
  const tel = String(fone || "").replace(/\D/g, ""); const num = tel ? (tel.length <= 11 ? "55" + tel : tel) : "";
  const q = (num ? "phone=" + num + "&" : "") + "text=" + encodeURIComponent(texto || "");
  if (waModo() === "app") { location.href = "whatsapp://send?" + q; return; } // aplicativo instalado no computador
  const w = window.open("https://web.whatsapp.com/send?" + q, "pimentao-whatsapp"); // mesma aba sempre
  if (w) { try { w.focus(); } catch { } } else toast("O navegador bloqueou a janela do WhatsApp. Clique no ícone de janela bloqueada na barra de endereço e permita.", true);
}
let FILA_IMP = Promise.resolve();
function imprimirCupom(alvo, cfgTeste) {
  const el0 = typeof alvo === "string" || !alvo ? document.querySelector(alvo || ".cupom") : alvo;
  const copia = el0 ? el0.cloneNode(true) : null; // copia já, a tela pode mudar até chegar a vez
  FILA_IMP = FILA_IMP.then(() => new Promise((fim) => imprimirAgora(copia, cfgTeste, fim)));
  return FILA_IMP;
}
function imprimirAgora(alvo, cfgTeste, fim) {
  const cfg = cfgTeste || impConfig();
  const el = alvo;
  if (!el) { toast("Não achei o comprovante para imprimir", true); fim(); return; }
  document.getElementById("area-impressao")?.remove(); document.getElementById("pagina-impressao")?.remove();
  const area = document.createElement("div"); area.id = "area-impressao";
  const vias = Math.min(Math.max(+cfg.vias || 1, 1), 3);
  for (let i = 0; i < vias; i++) {
    const cp = el.cloneNode(true); cp.classList.add("cupom-imp"); cp.removeAttribute("style");
    if (i) cp.classList.add("nova-via");
    area.appendChild(cp);
  }
  const larg = +cfg.largura, mg = +cfg.margem || 0, util = Math.max(larg - 2 * mg, 30);
  const st = document.createElement("style"); st.id = "pagina-impressao";
  const regras = () => `#area-impressao{position:absolute;left:-10000px;top:0;background:#fff}
#area-impressao .cupom-imp{width:${util}mm;max-width:none;margin:0 ${mg}mm;padding:0 0 2mm;border:0;box-shadow:none;
  font-size:${+cfg.fonte || 12}px;line-height:1.35;color:#000;font-weight:${cfg.negrito ? 600 : 400};-webkit-print-color-adjust:exact;print-color-adjust:exact}
#area-impressao .cupom-imp *{color:#000!important}
#area-impressao .cupom-imp hr{border-top:1px dashed #000}
#area-impressao .cupom-imp b{font-weight:800}
#area-impressao .cupom-imp a{text-decoration:none}
#area-impressao .cupom-imp svg{filter:brightness(0)}
@page{margin:0}
@media print{
  html,body{background:#fff!important;margin:0!important;padding:0!important;width:${larg}mm;min-height:0!important}
  body>*:not(#area-impressao){display:none!important}
  #area-impressao{position:static}
  #area-impressao .nova-via{break-before:page;page-break-before:always}
}`;
  st.textContent = regras();
  document.head.appendChild(st); document.body.appendChild(area);
  let feito = false;
  const limpar = () => { if (feito) return; feito = true; area.remove(); st.remove(); removeEventListener("afterprint", limpar); setTimeout(fim, 1500); }; // dá tempo da impressora terminar antes da próxima
  addEventListener("afterprint", limpar);
  setTimeout(() => { window.print(); setTimeout(limpar, 1500); }, 50); // na janela do caixa o print() volta na hora; o afterprint também limpa

}

function ImpressoraConfig() {
  const [cfg, setCfg] = useState(impConfig());
  const mudar = (k, v) => setCfg({ ...cfg, [k]: v });
  const util = Math.max(cfg.largura - 2 * cfg.margem, 30);
  return html`<div class="card"><h2>Impressora deste aparelho</h2>
    <p class="txt">Vale só para este computador ou celular. A impressora precisa estar instalada no aparelho (no Windows: Configurações › Impressoras; no Android: um app de impressão como o RawBT).</p>
    <div class="grade">
      <${Campo} r="Largura da bobina"><${Sel} valor=${String(cfg.largura)} set=${(v) => setCfg({ ...cfg, largura: +v, margem: +v === 58 ? 2 : 3, fonte: +v === 58 ? 11 : 14 })} opcoes=${[["80", "80 mm (mais comum no caixa)"], ["58", "58 mm (impressora pequena / portátil)"]]}/></${Campo}>
      <${Campo} r="Margem de cada lado (mm)" d=${"Área impressa: " + util + " mm"}><input type="number" min="0" max="8" step="0.5" value=${cfg.margem} onInput=${(e) => mudar("margem", +e.target.value)}/></${Campo}>
      <${Campo} r="Tamanho da letra" d="Aumente se sair pequeno; diminua se cortar"><input type="number" min="9" max="16" value=${cfg.fonte} onInput=${(e) => mudar("fonte", +e.target.value)}/></${Campo}>
      <${Campo} r="Vias por venda" d="2 = uma para o cliente e uma para a loja"><${Sel} valor=${String(cfg.vias)} set=${(v) => mudar("vias", +v)} opcoes=${[["1", "1 via"], ["2", "2 vias"], ["3", "3 vias"]]}/></${Campo}>
    </div>
    <label class="chk"><input type="checkbox" checked=${cfg.auto} onChange=${(e) => mudar("auto", e.target.checked)}/> Imprimir sozinho ao concluir a venda</label>
    <label class="chk"><input type="checkbox" checked=${cfg.despacho} onChange=${(e) => mudar("despacho", e.target.checked)}/> Imprimir também a nota de despacho (sem preços) ao concluir a venda</label>
    <${Campo} r="WhatsApp" d="Aplicativo: o WhatsApp instalado no computador (não recarrega). Navegador: usa sempre a mesma aba do WhatsApp Web."><${Sel} valor=${waModo()} set=${(v) => { try { localStorage.setItem(WA_CHAVE, v); } catch { } toast("WhatsApp: " + (v === "app" ? "aplicativo do computador" : "WhatsApp Web (mesma aba)")); setCfg({ ...cfg }); }} opcoes=${[["web", "WhatsApp Web (navegador)"], ["app", "Aplicativo do WhatsApp no computador"]]}/></${Campo}>
    <label class="chk"><input type="checkbox" checked=${cfg.negrito} onChange=${(e) => mudar("negrito", e.target.checked)}/> Letra mais escura (recomendado em impressora térmica)</label>
    <div class="acoes">
      <button class="btn" onClick=${() => { const ok = impSalvar(cfg); toast(ok ? "Impressora salva neste aparelho" : "Este navegador não deixou salvar", !ok); }}>Salvar</button>
      <button class="btn out" onClick=${() => imprimirCupom("#cupom-teste", cfg)}>Imprimir teste</button>
    </div>
    <div class="cupom" id="cupom-teste" style=${`max-width:${util * 3.78}px;font-size:${cfg.fonte}px`}>
      <div class="c"><${Pimentao} t=${30}/><br/><b>O Pimentão</b><br/>TESTE DE IMPRESSÃO</div><hr/>
      <div class="par"><span>Bobina</span><span>${cfg.largura} mm</span></div>
      <div class="par"><span>Área útil</span><span>${util} mm</span></div>
      <div class="par"><span>Letra</span><span>${cfg.fonte}px</span></div><hr/>
      <div>Pimentão 1ª</div><div class="par"><span>2 cx x 75,00</span><span>150,00</span></div>
      <div>Tomate</div><div class="par"><span>3,500 kg x 6,50</span><span>22,75</span></div><hr/>
      <div class="par"><b>TOTAL</b><b>R$ 172,75</b></div><hr/>
      <div class="c">1234567890123456789012345678901234567890<br/>Se a linha acima cortar, diminua a letra.</div>
    </div>
    <p class="txt"><b>Para imprimir sem abrir a janela de impressão</b> (no computador): veja a seção "Imprimir direto" no LEIA-IMPRESSORA do projeto.</p>
  </div>`;
}

// ---- nota de despacho: só cliente, data/hora, quantidade e mercadoria (sem preços), letra grande ----
function qtdDespacho(i) {
  if (i.unidade === "kg") return { q: (i.gramas / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 3 }), u: "KG" };
  const meias = i.unidade === "meia" ? i.meias || 1 : i.meias || 0;
  const inteiras = (i.unidade === "meia" ? 0 : i.caixas || 0) + Math.floor(meias / 2), meia = meias % 2 === 1;
  return { q: (inteiras ? String(inteiras) : "") + (meia ? "½" : "") || "0", u: "CX" };
}
function imprimirDespacho(v, c) {
  if (!v) return;
  const d = new Date(v.criadoEm || Date.now());
  let cx = 0, kgT = 0;
  for (const i of v.itens) { if (i.unidade === "kg") kgT += i.gramas; else cx += (i.unidade === "meia" ? 0 : i.caixas || 0) + ((i.unidade === "meia" ? i.meias || 1 : i.meias || 0) * 0.5); }
  const cxTxt = cx ? (Math.floor(cx) || "") + (cx % 1 ? "½" : "") + " cx" : "";
  const kgTxt = kgT ? (kgT / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 3 }) + " kg" : "";
  const el = document.createElement("div");
  render(html`<div class="despacho">
    <div class="topo"><${Pimentao} t=${64}/><b>O PIMENTÃO</b><span>HORTIFRUTI</span></div>
    <div class="tit">DESPACHO DE MERCADORIA</div>
    <div class="cli">Cliente<b>${(v.clienteId && (S.clientes.find((x) => x.id === v.clienteId)?.nome || c.clientes.get(v.clienteId)?.nome)) || "Consumidor"}</b></div>
    <div class="dh"><span>${d.toLocaleDateString("pt-BR")}</span><span>${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span></div>
    <hr/>
    ${v.itens.map((i) => { const q = qtdDespacho(i); return html`<div class="it"><div class="q">${q.q}<small>${q.u}</small></div><div class="m">${c.prod.get(i.produtoId)?.nome || "Produto"}${cxDe(i).length ? html`<em>+ ${cxDe(i).map((x) => x.q + " cx " + (c.tipos.get(x.tipoId)?.nome || "")).join(" + ")} vazia(s)</em>` : null}</div></div>`; })}
    <div class="tot">Total: ${[cxTxt, kgTxt].filter(Boolean).join(" + ")}</div>
    <div class="conf"><div></div>Conferido por</div>
  </div>`, el);
  return imprimirCupom(el.firstElementChild);
}

// ---- nota em PDF, no mesmo formato do cupom impresso (para mandar pelo WhatsApp) ----
async function canvasDoCupom(alvo) {
  await carregarScript("https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js");
  await carregarScript("https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js");
  if (typeof window.html2canvas !== "function" || !window.jspdf) throw new Error("O gerador de PDF ainda está carregando. Tente de novo em alguns segundos.");
  const cfg = impConfig(); const larg = 80, mg = 3, util = larg - 2 * mg;
  const el = typeof alvo === "string" ? document.querySelector(alvo) : alvo;
  if (!el) throw new Error("Não achei a nota para gerar o PDF.");
  const caixa = document.createElement("div");
  caixa.style.cssText = `position:fixed;left:-10000px;top:0;background:#fff;width:${larg}mm;padding:4mm 0`;
  const cp = el.cloneNode(true); cp.removeAttribute("style"); cp.classList.add("cupom-pdf");
  cp.style.cssText = `width:${util}mm;max-width:none;margin:0 ${mg}mm;padding:0;border:0;box-shadow:none;font-size:${cfg.fonte || 14}px;line-height:1.35;color:#000;font-weight:${cfg.negrito ? 600 : 400};background:#fff`;
  cp.querySelectorAll("*").forEach((x) => { if (!x.closest("svg")) x.style.color = "#000"; });
  // no PDF o logo fica COLORIDO (verde do Pimentão); só a impressora térmica imprime preto
  cp.querySelectorAll("svg, svg *").forEach((x) => { x.style.filter = "none"; x.style.color = ""; });
  caixa.appendChild(cp); document.body.appendChild(caixa);
  try {
    return await window.html2canvas(caixa, { scale: 3, backgroundColor: "#ffffff", logging: false });
  } finally { caixa.remove(); }
}
async function pdfDoCupom(alvo, nomeArquivo) {
  const canvas = await canvasDoCupom(alvo); const larg = 80;
  const altura = (canvas.height / canvas.width) * larg;
  const { jsPDF } = window.jspdf; const doc = new jsPDF({ unit: "mm", format: [larg, Math.max(altura, 60)] });
  doc.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, larg, altura);
  return new File([doc.output("blob")], nomeArquivo, { type: "application/pdf" });
}
// WhatsApp no computador: copia a nota como IMAGEM e abre a conversa do cliente; é só Ctrl+V e Enter
async function enviarNotaWhats(alvo, { fone, texto }) {
  let copiou = false;
  try {
    // a promessa entra direto no ClipboardItem: o Chrome aceita mesmo que a imagem leve 1–2 s para ficar pronta
    const png = canvasDoCupom(alvo).then((cv) => new Promise((ok) => cv.toBlob(ok, "image/png")));
    await navigator.clipboard.write([new ClipboardItem({ "image/png": png })]); copiou = true;
  } catch (e) { console.warn("copiar imagem:", e); }
  abrirWhatsApp(fone, copiou ? "" : texto);
  if (copiou) toast("✅ Nota copiada. Na conversa do WhatsApp aperte Ctrl+V e depois Enter.");
  else toast("Não consegui copiar a imagem; mandei a nota em texto. Use 'Baixar PDF' se quiser o arquivo.", true);
}
function baixarArquivo(arq) { const u = URL.createObjectURL(arq); const a = document.createElement("a"); a.href = u; a.download = arq.name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 60000); }
// manda o PDF: no celular/Windows abre "Compartilhar" (escolha o WhatsApp); se não der, baixa o PDF e abre a conversa
async function enviarNotaPdf(alvo, { nomeArquivo, fone, texto }) {
  const arq = await pdfDoCupom(alvo, nomeArquivo);
  if (navigator.canShare?.({ files: [arq] })) {
    try { await navigator.share({ files: [arq], title: nomeArquivo, text: texto }); return "compartilhado"; }
    catch (e) { if (e?.name === "AbortError") return "cancelado"; }
  }
  const url = URL.createObjectURL(arq); const a = document.createElement("a"); a.href = url; a.download = nomeArquivo; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000);
  abrirWhatsApp(fone, texto);
  toast("PDF baixado. Na conversa do WhatsApp, clique no clipe 📎 e anexe o arquivo " + nomeArquivo, false);
  return "baixado";
}
