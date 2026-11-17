# O Pimentão — Gestão

Sistema de vendas, caixa, estoque, caixaria, fiado, entregas e relatórios do O Pimentão.

## Como está montado

| Parte | Onde |
|---|---|
| Tela (o sistema) | `src/` → montada em um arquivo só, `dist/index.html` |
| Banco de dados e login | Supabase, projeto **opimentao** (São Paulo) — scripts em `banco/` |
| Link na internet | GitHub Pages, publicado sozinho a cada envio para a branch `main` |

## Pastas

```
src/
  pagina.html        esqueleto da página (o CSS e o JS entram nos marcadores)
  estilo.css         visual (cores, layout, celular, impressão)
  js/                o código, em partes, na ordem dos números:
    01-utilidades.js         dinheiro em centavos, peso em gramas, datas
    02-conexao-supabase.js   login, leitura, tempo real, gravação
    03-pix-br-code.js        Pix copia e cola
    04-motor-de-calculo.js   estoque PEPS, custo, lucro, caixa, fiado
    08-caixa.js              PDV, fechamento, comprovante
    …                        (uma parte para cada tela)
  publico/           ícones e manifesto para instalar no celular
scripts/montar.mjs   junta tudo em dist/index.html
tests/               testes automáticos do motor de cálculo
banco/               SQL do Supabase (instalação, estado atual, travas de gestor)
```

## No dia a dia

- **Mudou algo?** Envie para a `main`. O GitHub roda os testes, monta e publica. Se um teste falhar, nada é publicado.
- **Montar no computador:** `node scripts/montar.mjs` → abra `dist/index.html` no Chrome.
- **Testar:** `node --test tests/*.test.mjs`

## Segurança (no banco, não só na tela)

O Supabase recusa para quem não é gestor: mudar Pix/configurações, criar produto ou mudar preço/margem, desconto acima de 5%, cancelar ou reabrir venda, corrigir ou cancelar entrada, mudar limite de fiado, estornar recebimento, resolver divergência, ajuste de caixaria e mexer em caixa já fechado. Ninguém apaga registros. Detalhes em `banco/seguranca-travas-gestor.sql`.

## Instalar no celular

Abra o link no Chrome (Android) ou Safari (iPhone) → menu → **Adicionar à tela inicial**.
