// ============ IMPRESSORA (cupom em impressora térmica) ============
// A configuração é de cada aparelho (fica guardada no navegador), porque cada
// computador ou celular tem a sua impressora.
const IMP_CHAVE = "pimentao.impressora";
const IMP_PADRAO = { largura: 80, margem: 3, fonte: 12, vias: 1, auto: true, negrito: true, v: 2 };
function impConfig() {
  try {
    const salvo = JSON.parse(localStorage.getItem(IMP_CHAVE) || "{}");
    if (salvo.v !== 2) { salvo.auto = true; salvo.v = 2; localStorage.setItem(IMP_CHAVE, JSON.stringify({ ...IMP_PADRAO, ...salvo })); } // nova versão: imprime sozinho ao concluir a venda
    return { ...IMP_PADRAO, ...salvo };
  } catch { return { ...IMP_PADRAO }; }
}
function impSalvar(cfg) {
  try { localStorage.setItem(IMP_CHAVE, JSON.stringify(cfg)); return true; } catch { return false; }
}
// Imprime só o cupom, no tamanho da bobina. Funciona com qualquer impressora
// instalada no aparelho (USB, rede, Bluetooth pareado ou app de impressão no Android).
function imprimirCupom(alvo, cfgTeste) {
  const cfg = cfgTeste || impConfig();
  const el = typeof alvo === "string" || !alvo ? document.querySelector(alvo || ".cupom") : alvo;
  if (!el) { toast("Não achei o comprovante para imprimir", true); return; }
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
  const limpar = () => { area.remove(); st.remove(); removeEventListener("afterprint", limpar); };
  addEventListener("afterprint", limpar);
  setTimeout(() => window.print(), 50);
}

function ImpressoraConfig() {
  const [cfg, setCfg] = useState(impConfig());
  const mudar = (k, v) => setCfg({ ...cfg, [k]: v });
  const util = Math.max(cfg.largura - 2 * cfg.margem, 30);
  return html`<div class="card"><h2>Impressora deste aparelho</h2>
    <p class="txt">Vale só para este computador ou celular. A impressora precisa estar instalada no aparelho (no Windows: Configurações › Impressoras; no Android: um app de impressão como o RawBT).</p>
    <div class="grade">
      <${Campo} r="Largura da bobina"><${Sel} valor=${String(cfg.largura)} set=${(v) => setCfg({ ...cfg, largura: +v, margem: +v === 58 ? 2 : 3, fonte: +v === 58 ? 11 : 12 })} opcoes=${[["80", "80 mm (mais comum no caixa)"], ["58", "58 mm (impressora pequena / portátil)"]]}/></${Campo}>
      <${Campo} r="Margem de cada lado (mm)" d=${"Área impressa: " + util + " mm"}><input type="number" min="0" max="8" step="0.5" value=${cfg.margem} onInput=${(e) => mudar("margem", +e.target.value)}/></${Campo}>
      <${Campo} r="Tamanho da letra" d="Aumente se sair pequeno; diminua se cortar"><input type="number" min="9" max="16" value=${cfg.fonte} onInput=${(e) => mudar("fonte", +e.target.value)}/></${Campo}>
      <${Campo} r="Vias por venda" d="2 = uma para o cliente e uma para a loja"><${Sel} valor=${String(cfg.vias)} set=${(v) => mudar("vias", +v)} opcoes=${[["1", "1 via"], ["2", "2 vias"], ["3", "3 vias"]]}/></${Campo}>
    </div>
    <label class="chk"><input type="checkbox" checked=${cfg.auto} onChange=${(e) => mudar("auto", e.target.checked)}/> Imprimir sozinho ao concluir a venda</label>
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
