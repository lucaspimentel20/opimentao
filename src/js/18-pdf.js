// ============ PDF ============
const carregarScript = (src) => new Promise((ok, erro) => { if (document.querySelector(`script[src="${src}"]`)) return ok(); const el = document.createElement("script"); el.src = src; el.onload = ok; el.onerror = () => erro(new Error("Não consegui carregar o gerador de PDF (sem internet?).")); document.head.appendChild(el); });
async function gerarPdf({ titulo, subtitulo, colunas, linhas, arquivo, alinharDireita = [], opcoes = {}, secoes }) {
  await carregarScript("https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js");
  await carregarScript("https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.2/dist/jspdf.plugin.autotable.min.js");
  const { jsPDF } = window.jspdf; const doc = new jsPDF({ unit: "mm", format: "a4" });
  doc.setFont("helvetica", "bold"); doc.setFontSize(16); doc.setTextColor(31, 77, 36); doc.text("O Pimentão", 14, 16);
  doc.setFontSize(12); doc.setTextColor(0); doc.text(titulo, 14, 23);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(90); doc.text(subtitulo + " · gerado em " + new Date().toLocaleString("pt-BR"), 14, 29);
  const rodape = () => { doc.setFontSize(8); doc.setTextColor(120); doc.text("Página " + doc.internal.getNumberOfPages(), 196, 290, { align: "right" }); };
  const lista = secoes || [{ colunas, linhas, alinharDireita, opcoes }]; let y = 34;
  for (const sc of lista) {
    if (sc.titulo) { if (y > 260) { doc.addPage(); y = 16; } doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(31, 77, 36); doc.text(sc.titulo, 14, y + 4); y += 7; if (sc.nota) { doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(90); doc.text(sc.nota, 14, y + 2); y += 5; } }
    const colStyles = {}; (sc.alinharDireita || []).forEach((i) => (colStyles[i] = { halign: "right" }));
    if (!sc.linhas.length) { doc.setFont("helvetica", "italic"); doc.setFontSize(9); doc.setTextColor(120); doc.text("Nenhum.", 14, y + 4); y += 12; continue; }
    doc.autoTable({ startY: y, head: [sc.colunas], body: sc.linhas, theme: "grid", styles: { fontSize: 9, cellPadding: 2, valign: "top" }, headStyles: { fillColor: [46, 125, 50], textColor: 255 }, alternateRowStyles: { fillColor: [246, 238, 223] }, columnStyles: colStyles, ...(sc.opcoes || {}), didDrawPage: rodape });
    y = doc.lastAutoTable.finalY + 10;
  }
  doc.save(arquivo);
}
