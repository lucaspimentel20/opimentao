// ============ quem é quem ============
function papelDe(s) {
  if (s.dono) return "gestor";
  const p = s.pessoas.find((x) => x.id === s.eu);
  return p?.papel || "operador";
}
function nomePessoa(s, id) { return s.pessoas.find((p) => p.id === id)?.nome || "—"; }
function sessaoMinha(s) { return s.sessoes.find((x) => x.operadorId === s.eu && !x.fechamento) || null; }
