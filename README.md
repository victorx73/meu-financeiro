# Meu Financeiro

App de controle financeiro pessoal em HTML/CSS/JS puro, sem backend.

## Estrutura

- `index.html` — estrutura da página
- `styles.css` — estilos
- `app.js` — lógica do app
- `meu-financeiro.json` — gerado na pasta que você escolher (sincronização)

## Como usar

1. Abra o `index.html` no Chrome ou Edge (recomendado).
2. Na aba **Sincronização**, clique em **Escolher pasta** e selecione a pasta compartilhada.
3. Escolha o modo:
   - **Manual**: você clica em "Sincronizar agora" quando quiser.
   - **Automático ao abrir**: ao abrir o app, ele sincroniza.
   - **Enviar ao alterar**: grava na pasta a cada alteração.
4. O arquivo `meu-financeiro.json` fica na pasta escolhida.

## Sincronização entre dispositivos (sem nuvem de provedor)

Use o **Syncthing** (open-source, grátis) para sincronizar a pasta entre PC e celular:

1. Instale o Syncthing no PC e no celular.
2. Compartilhe uma pasta entre os dois (ex.: `MeuFinanceiro`).
3. No app, escolha essa pasta como pasta de sincronização.
4. Pronto: quando você altera no celular, o Syncthing envia o arquivo ao PC quando ele estiver online. E vice-versa.

### Como funciona a sincronização de dados
- O app mantém a data da última alteração local (`lastModified`).
- Ao sincronizar, compara com a data do arquivo na pasta:
  - **Arquivo mais novo**: baixa (substitui os dados locais).
  - **Local mais novo**: envia (sobrescreve o arquivo).
  - **Iguais**: nada a fazer.
- Se houver conflito (ambos alterados), o app pede confirmação antes de sobrescrever.

### Limitações
- Só funciona no **Chrome** e **Edge** (File System Access API).
- O navegador pode pedir confirmação de permissão de vez em quando.
- Não é tempo real: sincroniza quando você abre o app ou clica em "Sincronizar agora".
- Se editar nos dois dispositivos ao mesmo tempo, o último a salvar ganha (last-write-wins).

## Backup manual
- **Exportar dados**: baixa um `.json` com todo o estado.
- **Importar dados**: seleciona um `.json` e substitui o estado.

## Segurança
- Os dados ficam no `localStorage` do navegador + na pasta escolhida (se configurada).
- Não há servidor, conta ou nuvem de provedor.