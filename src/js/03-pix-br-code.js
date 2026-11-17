// ============ Pix (BR Code) ============
const _campo = (id, v) => { const s = String(v); return id + String(s.length).padStart(2, "0") + s; };
const _limpo = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9 ]/g, "").toUpperCase().trim();
function _crc16(str) { let crc = 0xffff; for (let i = 0; i < str.length; i++) { crc ^= str.charCodeAt(i) << 8; for (let j = 0; j < 8; j++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff; } return crc.toString(16).toUpperCase().padStart(4, "0"); }
function chavePix(tipo, chave) {
  const t = String(chave || "").trim();
  if (tipo === "telefone") { let d = t.replace(/\D/g, ""); if (d.startsWith("55") && d.length >= 12) d = d.slice(2); return "+55" + d; }
  if (tipo === "cpf") return t.replace(/\D/g, "");
  if (tipo === "email") return t.toLowerCase();
  return t.toLowerCase();
}
function pixPayload({ chave, nome, cidade, valor, txid }) {
  const conta = _campo("00", "br.gov.bcb.pix") + _campo("01", chave);
  const tx = String(txid || "").replace(/[^A-Za-z0-9]/g, "").slice(0, 25) || "***";
  let p = _campo("00", "01") + _campo("26", conta) + _campo("52", "0000") + _campo("53", "986") + (valor > 0 ? _campo("54", (valor / 100).toFixed(2)) : "") + _campo("58", "BR") + _campo("59", _limpo(nome).slice(0, 25) || "RECEBEDOR") + _campo("60", _limpo(cidade).slice(0, 15) || "BRASIL") + _campo("62", _campo("05", tx)) + "6304";
  return p + _crc16(p);
}
