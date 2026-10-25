# 💰 Meu Financeiro

O **Meu Financeiro** é um aplicativo de gestão financeira pessoal desenvolvido com HTML5, CSS3 e JavaScript puro (vanilla). Com uma interface moderna, minimalista e responsiva, o projeto foi criado para facilitar o controle e a organização das finanças pessoais de forma simples, prática e gratuita — sem cadastro, sem servidor e sem dependências externas.

## ✨ Funcionalidades

### 💵 Saldo e gastos
- **Controle de saldo:** informe o dinheiro disponível do mês e acompanhe o saldo restante automaticamente.
- **Registro de gastos:** adicione, edite e exclua despesas com nome, valor e data (dia ou dia/mês).
- **Marcar como pago:** registre o pagamento de um gasto; o valor é descontado do saldo e pode ser desfeito.
- **Data a definir:** cadastre despesas sem data específica quando necessário.
- **Compras parceladas:** divida uma compra em até 36 parcelas mensais, distribuídas automaticamente nos meses seguintes com ajuste de centavos.
- **Filtros e ordenação:** filtre por status (pagos, não pagos, todos) e ordene por data.

### 📊 Resumo financeiro
- **Painel de visão geral:** saldo disponível, gastos em aberto, saldo restante e saldo projetado (incluindo previsão de ganhos).
- **Resumo do mês:** total de gastos, valores pagos e saldo restante.
- **Organização mensal:** selecione mês e ano de referência para organizar suas finanças.

### 📅 Ganhos e calendário
- **Calendário de trabalho:** marque os dias em que pretende trabalhar e defina o valor da diária.
- **Previsão de ganhos:** cálculo automático da receita estimada com base nos dias selecionados.
- **Saldo projetado:** soma do saldo restante com a previsão de ganhos.
- **Fonte de renda:** informe opcionalmente a origem da renda (trabalho, freela, Uber etc.).

### 💸 Empréstimos
- **Registro de empréstimos:** cadastre quem pegou dinheiro emprestado, valor, data e observação.
- **Devoluções parciais ou totais:** registre devoluções e acompanhe o saldo em aberto de cada pessoa.
- **Métricas:** total emprestado, já devolvido, falta receber e número de registros.
- **Filtros:** visualize empréstimos em aberto, quitados ou todos; ordene por data ou valor.

### ⏳ Pendências futuras
- **Compromissos separados:** registre pendências financeiras sem descontá-las do saldo atual.
- **Status:** marque como concluída ou reabra quando necessário.
- **Filtros e ordenação:** por status, data ou valor.

### 💾 Armazenamento e interface
- **Armazenamento local:** todos os dados ficam salvos no navegador via LocalStorage.
- **Interface responsiva:** layout adaptado para desktop, tablet e celular (inclui menu lateral deslizante e navegação inferior no mobile).
- **Notificações (toast):** feedback visual para cada ação realizada.
- **Validação de dados:** verificação de campos e valores antes de cadastrar gastos, empréstimos e pendências.
- **Dados por mês:** cada mês possui seu próprio saldo, gastos e calendário.

## 🛠️ Tecnologias utilizadas

- **HTML5:** estrutura da aplicação.
- **CSS3:** design, estilização, variáveis CSS e responsividade (media queries).
- **JavaScript (vanilla):** cálculos automáticos, validações, manipulação do DOM e gerenciamento dos registros.
- **LocalStorage:** armazenamento local dos dados no navegador.

## ⚙️ Funcionamento

O usuário informa o saldo disponível do mês e registra suas despesas. O aplicativo soma os gastos em aberto e subtrai o total do saldo inicial, atualizando automaticamente o valor restante. Ao marcar um gasto como pago, o valor é descontado do saldo; ao desmarcar, é restaurado.

Compras parceladas são divididas em parcelas mensais, com a primeira no mês atual e as demais nos meses seguintes, cada uma registrada no mês correspondente.

O calendário de ganhos permite simular a receita do mês com base nos dias marcados e no valor da diária, sem alterar o saldo disponível — apenas compondo o saldo projetado.

Os empréstimos são controlados separadamente, com registro de devoluções parciais ou totais e cálculo do saldo em aberto de cada pessoa.

As pendências futuras ficam em uma seção independente, permitindo organizar compromissos financeiros sem afetar o cálculo do saldo atual.

O aplicativo inicia sem lançamentos de exemplo, permitindo que cada usuário cadastre suas próprias informações.

## 🎯 Objetivo

Oferecer uma ferramenta acessível e intuitiva para ajudar na organização financeira pessoal, permitindo acompanhar despesas, controlar o dinheiro disponível, simular ganhos, gerenciar empréstimos e planejar compromissos futuros em um único lugar.

## 📱 Responsividade

A interface se adapta a diferentes tamanhos de tela:
- **Desktop:** navegação superior fixa com acesso a todas as seções.
- **Tablet:** layout em coluna única com ajustes de espaçamento.
- **Celular:** menu lateral deslizante (drawer), navegação inferior fixa e cards empilhados.

## 🔒 Armazenamento de dados

Os dados são armazenados localmente no navegador, sem necessidade de cadastro ou conexão com serviços financeiros externos. As informações não são sincronizadas automaticamente entre dispositivos e podem ser perdidas caso os dados locais do navegador sejam apagados.

## 🚀 Como usar

1. Baixe o arquivo `index.html`.
2. Abra-o em qualquer navegador moderno (Chrome, Firefox, Edge, Safari).
3. Informe o saldo disponível do mês.
4. Cadastre seus gastos, empréstimos, ganhos e pendências.
5. Seus dados serão salvos automaticamente no navegador.

Não é necessário instalar nada, criar conta ou conectar-se à internet após o carregamento inicial.

## 📄 Licença

Projeto de uso livre para fins pessoais e educacionais.
