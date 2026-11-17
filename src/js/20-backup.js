// ============ BACKUP ============
function LinkSistema({ s }) {
  const cfg = s.config.find((x) => x.id === "link") || {}; const gestor = papelDe(s) === "gestor";
  const aqui = /^https?:$/.test(location.protocol) && !/localhost|127\.0\.0\.1/.test(location.hostname) ? location.origin + location.pathname : "";
  const [url, setUrl] = useState(cfg.url || aqui); const [oc, rodar] = useAcao();
  const salvo = cfg.url || ""; const mudou = url.trim() !== salvo;
  const copiar = () => navigator.clipboard?.writeText(salvo || url.trim()).then(() => toast("Link copiado. Mande no WhatsApp ou abra no celular."), () => toast("Não deu para copiar", true));
  return html`<div class="card"><h2>📱 Link do sistema (celular)</h2><p class="txt">Abra este link no celular e entre com seu usuário e senha. Depois use "Adicionar à tela inicial" para virar um ícone.</p>
    ${salvo ? html`<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:10px"><a class="link" href=${salvo} target="_blank" style="font-size:1.05rem;font-weight:700;word-break:break-all">${salvo}</a><button class="btn sm" onClick=${copiar}>Copiar link</button></div>` : html`<p class="txt" style="color:var(--warn)">Nenhum link salvo ainda.${aqui ? " Você está usando o sistema pela internet agora — é só salvar o endereço abaixo." : " Coloque o sistema na Netlify e cole aqui o endereço."}</p>`}
    ${gestor ? html`<div class="grade"><${Campo} r="Endereço do sistema"><input value=${url} onInput=${(e) => setUrl(e.target.value)} placeholder="https://opimentao.netlify.app"/></${Campo}></div>
      <div class="acoes"><button class="btn" disabled=${oc || !mudou || (url.trim() && !/^https?:\/\/\S+\.\S+/.test(url.trim()))} onClick=${() => rodar(() => gravar("config", "link", { url: url.trim() }), "Link salvo")}>Salvar link</button>${!salvo && url.trim() ? html`<button class="btn out" onClick=${copiar}>Copiar</button>` : null}</div>` : null}
  </div>`;
}
function Backup({ s }) {
  const [oc, rodar] = useAcao(); const [prog, setProg] = useState("");
  const baixar = () => {
    const dados = Object.fromEntries(COLS.map((c) => [c, S[c]]));
    const blob = new Blob([JSON.stringify({ sistema: "O Pimentão", em: agora(), dados })], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "pimentao-backup-" + hojeISO() + ".json"; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  };
  const importar = (arq) => rodar(async () => {
    const j = JSON.parse(await arq.text()); const dados = j.dados || j;
    const linhas = []; for (const c of COLS) for (const d of dados[c] || []) { if (!d || !d.id) continue; const { id, ...data } = d; linhas.push({ col: c, id: String(id), data }); }
    if (!linhas.length) throw new Error("Arquivo sem dados reconhecidos.");
    if (!confirm(`Importar ${linhas.length} registros? Registros com o mesmo código serão substituídos.`)) return;
    await gravarLote(linhas, (n) => setProg(n + " de " + linhas.length)); setProg("");
  }, "Backup importado");
  return html`<div class="card"><h2>Backup</h2><p class="txt">Baixe um backup de vez em quando e guarde no computador ou no Google Drive.</p>
    <div class="acoes"><button class="btn" onClick=${baixar}>Baixar backup agora</button>
    <label class="btn out" style="cursor:pointer">Importar backup<input type="file" accept=".json,application/json" style="display:none" onChange=${(e) => { const f = e.target.files[0]; e.target.value = ""; if (f) importar(f); }}/></label></div>
    ${oc ? html`<p class="txt">Importando… ${prog}</p>` : null}
  </div>`;
}
