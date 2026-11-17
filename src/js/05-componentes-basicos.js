// ============ componentes básicos ============
const Num = ({ r, v, tom, d }) => html`<div class=${"num " + (tom || "")}><small>${r}</small><b>${v}</b>${d ? html`<em>${d}</em>` : null}</div>`;
const Campo = ({ r, d, children, class: c }) => html`<label class=${"campo " + (c || "")}><span>${r}</span>${children}${d ? html`<i>${d}</i>` : null}</label>`;
const Vazio = ({ children }) => html`<div class="vazio">${children}</div>`;
function Modal({ titulo, sub, onFechar, children, rod, grande }) {
  useEffect(() => { const f = (e) => e.key === "Escape" && onFechar(); addEventListener("keydown", f); return () => removeEventListener("keydown", f); }, []);
  return html`<div class="modalfundo" onClick=${(e) => e.target === e.currentTarget && onFechar()}>
    <div class=${"modal " + (grande ? "grande" : "")} role="dialog" aria-modal="true">
      <div class="cab"><h2>${titulo}</h2><button class="btn ghost" tabindex="-1" onClick=${onFechar} aria-label="Fechar">✕</button></div>
      ${sub ? html`<p class="txt">${sub}</p>` : null}
      ${children}
      ${rod ? html`<div class="rod">${rod}</div>` : null}
    </div></div>`;
}
function Sel({ valor, set, opcoes, vazio }) {
  return html`<select value=${valor} onChange=${(e) => set(e.target.value)}>${vazio != null ? html`<option value="">${vazio}</option>` : null}${opcoes.map(([v, r]) => html`<option value=${v}>${r}</option>`)}</select>`;
}
function Tabs({ abas, atual, set }) { return html`<div class="tabs">${abas.map(([k, r]) => html`<button class=${atual === k ? "on" : ""} onClick=${() => set(k)}>${r}</button>`)}</div>`; }
function useAcao() {
  const [ocupado, setOc] = useState(false);
  const rodar = async (fn, sucesso) => { if (ocupado) return false; setOc(true); try { await fn(); if (sucesso) toast(sucesso); return true; } catch (e) { toast(e.message || String(e), true); return false; } finally { setOc(false); } };
  return [ocupado, rodar];
}
const Pimentao = ({ t = 30 }) => html`<svg viewBox="0 0 200 220" width=${t} height=${t * 1.1} aria-hidden="true"><path d="M100 58 C70 46 34 52 26 88 C18 124 26 168 50 192 C62 204 78 204 86 194 C92 206 108 206 114 194 C122 204 138 204 150 192 C174 168 182 124 174 88 C166 52 130 46 100 58 Z" fill="#4CAF50"/><path d="M80 68 C70 110 72 160 86 194" fill="none" stroke="#23692A" stroke-width="5" stroke-linecap="round" opacity=".6"/><path d="M120 68 C130 110 128 160 114 194" fill="none" stroke="#23692A" stroke-width="5" stroke-linecap="round" opacity=".6"/><path d="M72 64 C82 50 118 50 128 64 C116 59 84 59 72 64 Z" fill="#1F4D24"/><path d="M100 58 C100 44 104 34 114 26" fill="none" stroke="#1F4D24" stroke-width="12" stroke-linecap="round"/><path d="M114 26 C128 8 158 8 170 20 C154 32 130 36 114 26 Z" fill="#8BD17C"/></svg>`;
