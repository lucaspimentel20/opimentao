// Monta o sistema num arquivo só (dist/index.html) a partir das partes em src/.
// Uso: node scripts/montar.mjs
import { readFileSync, writeFileSync, readdirSync, mkdirSync, copyFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const ler = (p) => readFileSync(join(raiz, p), "utf8");

const css = ler("src/estilo.css");
const partes = readdirSync(join(raiz, "src/js")).filter((f) => f.endsWith(".js")).sort();
const js = partes.map((f) => ler("src/js/" + f)).join("\n");
const html = ler("src/pagina.html").replace("/*@@CSS@@*/", () => css).replace("//@@JS@@", () => js);

mkdirSync(join(raiz, "dist"), { recursive: true });
writeFileSync(join(raiz, "dist/index.html"), html);
// arquivos do app instalável (PWA), se existirem
const pub = join(raiz, "src/publico");
if (existsSync(pub)) for (const f of readdirSync(pub)) copyFileSync(join(pub, f), join(raiz, "dist", f));
console.log(`dist/index.html montado: ${partes.length} partes, ${(html.length / 1024).toFixed(0)} KB`);
