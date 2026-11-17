// ============ PIX ============
const pixConfig = (s) => s.config.find((x) => x.id === "pix") || null;
function PixQR({ s, valor, txid }) {
  const cfg = pixConfig(s); const [copiou, setCopiou] = useState(false);
  if (!cfg || !cfg.chave) return html`<p class="av">Para gerar o QR Code, o gestor cadastra a chave Pix em Configurações › Pix.</p>`;
  if (!(valor > 0)) return null;
  const codigo = pixPayload({ chave: cfg.chave, nome: cfg.nome, cidade: cfg.cidade, valor, txid });
  let svg = ""; try { const q = qrcode(0, "M"); q.addData(codigo); q.make(); svg = q.createSvgTag({ cellSize: 5, margin: 2, scalable: true }); } catch { }
  return html`<div class="card" style="align-items:center;text-align:center;gap:8px;background:#fff">
    <b>Pix de ${reais(valor)}</b>
    ${svg ? html`<div style="width:230px;max-width:100%" dangerouslySetInnerHTML=${{ __html: svg }}></div>` : html`<p class="av">Não consegui desenhar o QR Code (sem internet?). Use o copia e cola.</p>`}
    <small class="txt">${cfg.nome}${cfg.banco ? " · " + cfg.banco : ""} · chave ${cfg.chave}</small>
    <button class="btn out sm" onClick=${() => { navigator.clipboard?.writeText(codigo).then(() => { setCopiou(true); setTimeout(() => setCopiou(false), 2500); }); }}>${copiou ? "Copiado ✓" : "Copiar Pix copia e cola"}</button>
    <small class="txt">Confira no app do banco se o Pix caiu antes de concluir.</small>
  </div>`;
}
function PixConfig({ s }) {
  const cfg = pixConfig(s) || {};
  const [tipo, setTipo] = useState(cfg.tipo || "cpf"); const [chave, setChave] = useState(cfg.chaveDigitada || cfg.chave || ""); const [nome, setNome] = useState(cfg.nome || "O Pimentao"); const [banco, setBanco] = useState(cfg.banco || ""); const [oc, rodar] = useAcao(); const [teste, setTeste] = useState(false);
  const ch = chavePix(tipo, chave);
  return html`<div class="card"><h2>Pix</h2><p class="txt">Com isso o caixa mostra o QR Code com o valor da venda. O dinheiro cai direto na sua conta.</p>
    <div class="grade">
      <${Campo} r="Tipo de chave"><${Sel} valor=${tipo} set=${setTipo} opcoes=${[["cpf", "CPF ou CNPJ"], ["telefone", "Telefone"], ["email", "E-mail"], ["aleatoria", "Chave aleatória"]]}/></${Campo}>
      <${Campo} r="Chave Pix" d=${chave ? "Vai usar: " + ch : ""}><input value=${chave} onInput=${(e) => setChave(e.target.value)}/></${Campo}>
      <${Campo} r="Nome de quem recebe" d="Como está no banco (até 25 letras)"><input value=${nome} onInput=${(e) => setNome(e.target.value)}/></${Campo}>
      <${Campo} r="Banco" d="Aparece no QR Code para o cliente conferir"><input value=${banco} onInput=${(e) => setBanco(e.target.value)} placeholder="Ex.: Nubank, Itaú, Caixa"/></${Campo}>
    </div>
    <div class="acoes"><button class="btn" disabled=${!chave.trim() || nome.trim().length < 2 || oc} onClick=${() => rodar(() => gravar("config", "pix", { tipo, chave: ch, chaveDigitada: chave.trim(), nome: nome.trim(), banco: banco.trim(), cidade: cfg.cidade || "BRASIL" }), "Pix salvo")}>Salvar</button>
      ${pixConfig(s) ? html`<button class="btn out" onClick=${() => setTeste(!teste)}>${teste ? "Fechar teste" : "Testar com R$ 0,01"}</button>` : null}</div>
    ${teste ? html`<${PixQR} s=${s} valor=${1} txid="TESTE"/>` : null}
  </div>`;
}
