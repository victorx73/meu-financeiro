# Meu Financeiro

App de controle financeiro pessoal em HTML/CSS/JS puro, sem backend. Minimalista e focado no essencial.

## Funcionalidades

- **Visão geral**: Disponível, Gastos e Saldo restante calculados automaticamente.
- **Extrato** (opcional): depósitos e saques, simulando uma conta corrente.
- **Gastos**: cadastro de despesas com nome, valor e data.
- **Empréstimos** (opcional): registra valores emprestados com taxa de juros para calcular o retorno.
- **Pendências futuras**: compromissos que não afetam o saldo do mês.

## Estrutura

- `index.html` — estrutura da página
- `styles.css` — estilos
- `app.js` — lógica do app

## Como usar

1. Abra o `index.html` no navegador (Chrome, Edge, Firefox ou Safari).
2. Os dados são salvos automaticamente no `localStorage` do navegador.
3. Use os botões **+ Extrato** e **+ Empréstimos** para exibir ou ocultar essas seções.

## Armazenamento

- Os dados ficam no `localStorage` do navegador.
- Cada mês tem seu próprio conjunto de dados (selecione o mês no topo).
- Limpar os dados do navegador apaga as informações.

## Segurança

- Não há servidor, conta ou nuvem de provedor.
- Tudo fica no seu navegador.