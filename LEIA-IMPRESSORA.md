# Impressora térmica — O Pimentão

O sistema imprime o comprovante pela impressão do navegador, no tamanho exato da bobina (58 ou 80 mm). Isso funciona com **qualquer impressora térmica instalada no aparelho**: Elgin, Bematech, Epson, Daruma, Tanca, Knup, genéricas chinesas, por USB, rede (cabo/Wi-Fi) ou Bluetooth.

## 1. No sistema (uma vez em cada aparelho)

**Configurações › Impressora**
- **Largura da bobina:** 80 mm (caixa) ou 58 mm (pequena/portátil).
- **Margem / letra:** se cortar à direita, diminua a letra ou aumente a margem. Use a linha de teste `1234567890…`.
- **Vias:** 2 = cliente + loja.
- **Imprimir sozinho ao concluir a venda:** liga a impressão automática.
- **Salvar** e **Imprimir teste**.

Na tela da venda, o botão **🖨️ Imprimir** reimprime a qualquer momento.

## 2. Computador com Windows (USB ou rede)

1. Instale o **driver do fabricante** (site da Elgin, Bematech, Epson…). Sem driver, o Windows não imprime direito em bobina.
2. **Configurações › Bluetooth e dispositivos › Impressoras** → abra a impressora → **Preferências de impressão**:
   - Papel: **80 × 297 mm** (ou 58 × 297), o "rolo".
   - Se existir, ative **corte automático no fim do documento** e **reduzir papel em branco** (Epson: "Document [Feed, Cut]"; Elgin/Bematech: "Corte parcial ao final").
3. Defina como **impressora padrão** se for a única do caixa.
4. No Chrome, na primeira impressão: escolha a impressora, **Margens: Nenhuma**, **Escala: Padrão**, desmarque **Cabeçalhos e rodapés**. O Chrome lembra.

### Imprimir direto, sem abrir a janela (modo caixa)

Crie um atalho do Chrome só para o sistema:

1. Clique com o botão direito na área de trabalho → **Novo › Atalho**.
2. Cole (ajuste o caminho do Chrome se for diferente):
   ```
   "C:\Program Files\Google\Chrome\Application\chrome.exe" --kiosk-printing --user-data-dir="C:\PimentaoCaixa" --app=https://lucaspimentel20.github.io/opimentao/
   ```
3. Nome: **O Pimentão Caixa**.

Abrindo por esse atalho, o comprovante vai **direto para a impressora padrão**, sem janela. Faça login uma vez nesse atalho (ele tem perfil próprio). Com "Imprimir sozinho" ligado, fechou a venda → saiu o cupom.

## 3. Celular ou tablet Android

O Android não imprime em térmica sozinho. Instale um **serviço de impressão**:

- **RawBT** (Play Store) — o mais usado para térmicas USB/Bluetooth/rede.
  1. Pareie a impressora no Bluetooth do Android (senha costuma ser 0000 ou 1234).
  2. Abra o RawBT → escolha a impressora → **Largura 58 ou 80 mm** → teste.
  3. Em **Configurações do Android › Impressão**, ative o serviço **RawBT**.
- No sistema, **🖨️ Imprimir** → escolha **RawBT** como impressora.

## 4. iPhone / iPad

O iOS só imprime em impressoras **AirPrint**, e quase nenhuma térmica é AirPrint. Para o caixa, use computador ou Android. No iPhone, use **WhatsApp** ou **Copiar texto** no comprovante.

## Problemas comuns

| Sintoma | Solução |
|---|---|
| Saiu folha em branco longa | Papel "rolo" + corte no fim do documento no driver |
| Cortou o lado direito | Diminua a letra ou aumente a margem em Configurações › Impressora |
| Letra clara/apagada | Ligue "Letra mais escura"; aumente a densidade no driver; troque a bobina (térmica tem lado certo) |
| Saiu muito pequeno | No Chrome: Escala **Padrão** (não "Ajustar à página") |
| Imprime em A4 | A impressora térmica não está como padrão, ou foi escolhida outra na janela |
| Saiu cabeçalho com data/link | Desmarque "Cabeçalhos e rodapés" na janela do Chrome |
