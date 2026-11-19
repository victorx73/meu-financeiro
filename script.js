(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const STORAGE_PREFIX = "meu-financeiro-v1";
  const monthSelect = $("monthSelect");
  const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  let activeMonth = currentMonthKey();
  let state = emptyMonth();

  // Elementos do Toggle
  const toggleExtratoBtn = $("toggleExtratoBtn");
  const transactionSection = $("transactionSection");
  const toggleEmprestimoBtn = $("toggleEmprestimoBtn");
  const loanSection = $("loanSection");

  function currentMonthKey() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  }
  function emptyMonth() {
    return { transactions: [], expenses: [], future: [], loans: [] };
  }
  function storageKey(month) { return `${STORAGE_PREFIX}-${month}`; }
  function loadMonth(month) {
    try {
      const raw = localStorage.getItem(storageKey(month));
      if (!raw) return emptyMonth();
      const data = JSON.parse(raw);
      return {
        transactions: Array.isArray(data.transactions) ? data.transactions : [],
        expenses: Array.isArray(data.expenses) ? data.expenses : [],
        future: Array.isArray(data.future) ? data.future : [],
        loans: Array.isArray(data.loans) ? data.loans : []
      };
    } catch (error) {
      console.error("Não foi possível carregar os dados deste mês:", error);
      return emptyMonth();
    }
  }
  function save() {
    try {
      localStorage.setItem(storageKey(activeMonth), JSON.stringify(state));
    } catch (error) {
      alert("Não foi possível salvar os dados. Verifique o espaço disponível no navegador.");
      console.error(error);
    }
  }
  function numberOrZero(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }
  function parseMoney(value) {
    if (typeof value === "number") return value;
    let clean = String(value || "").trim().replace(/R\$/gi, "").replace(/\s/g, "");
    if (!clean) return 0;
    if (clean.includes(",")) clean = clean.replace(/\./g, "").replace(",", ".");
    const parsed = Number(clean);
    return Number.isFinite(parsed) ? Math.max(0, parsed) : NaN;
  }
  function money(value) {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  }
  function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
    }[char]));
  }
  function formatDate(dateString) {
    if (!dateString) return "—";
    const [year, month, day] = dateString.split("-");
    return `${day}/${month}/${year}`;
  }
  function monthLabel(key) {
    const [year, month] = key.split("-").map(Number);
    return `${monthNames[month - 1]} ${year}`;
  }
  function renderMonthOptions() {
    const now = new Date();
    const options = [];
    for (let offset = -12; offset <= 12; offset++) {
      const date = new Date(now.getFullYear(), now.getMonth() + offset, 1);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      options.push(`<option value="${key}">${monthLabel(key)}</option>`);
    }
    monthSelect.innerHTML = options.join("");
    monthSelect.value = activeMonth;
    if (!monthSelect.value) {
      const option = document.createElement("option");
      option.value = activeMonth;
      option.textContent = monthLabel(activeMonth);
      monthSelect.append(option);
      monthSelect.value = activeMonth;
    }
  }

  function renderSummary() {
    const totalDeposits = state.transactions
      .filter(t => t.type === "deposit")
      .reduce((total, item) => total + numberOrZero(item.amount), 0);
    
    const totalWithdrawals = state.transactions
      .filter(t => t.type === "withdrawal")
      .reduce((total, item) => total + numberOrZero(item.amount), 0);
    
    const spent = state.expenses.reduce((total, item) => total + numberOrZero(item.amount), 0);
    
    const available = totalDeposits - totalWithdrawals - spent;
    const remaining = available;

    $("availableInput").value = money(available);
    $("spentOutput").value = money(spent);
    $("remainingOutput").value = money(remaining);
    
    $("availableInput").classList.toggle("negative", available < 0);
    $("availableInput").classList.toggle("positive", available >= 0);
    $("remainingOutput").classList.toggle("negative", remaining < 0);
    $("remainingOutput").classList.toggle("positive", remaining >= 0);
  }

  function renderTransactions() {
    const list = $("transactionList");
    if (!state.transactions.length) {
      list.innerHTML = '<div class="empty">Nenhuma movimentação bancária cadastrada.</div>';
      return;
    }
    const sorted = [...state.transactions].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    list.innerHTML = sorted.map(item => `
      <div class="transaction-row">
        <span class="expense-name"><span class="transaction-type ${item.type}">[${item.type === 'deposit' ? 'Depósito' : 'Saque'}]</span> ${escapeHTML(item.name)}</span>
        <time class="expense-date" datetime="${escapeHTML(item.date || "")}">${formatDate(item.date)}</time>
        <span class="expense-value ${item.type === 'deposit' ? 'positive' : 'negative'}">
          ${item.type === 'deposit' ? '+' : '-'} ${money(numberOrZero(item.amount))}
        </span>
        <button class="delete" type="button" data-delete-transaction="${escapeHTML(item.id)}" aria-label="Excluir" title="Excluir">×</button>
      </div>`).join("");
  }

  function renderLoans() {
    const list = $("loanList");
    if (!state.loans.length) {
      list.innerHTML = '<div class="empty">Nenhum empréstimo cadastrado.</div>';
      return;
    }
    list.innerHTML = state.loans.map(item => {
      const finalValue = item.amount + (item.amount * (item.rate / 100));
      return `
      <div class="loan-row">
        <span class="loan-name">${escapeHTML(item.name)}</span>
        <span class="loan-rate" style="text-align: right;">${item.rate}%</span>
        <span class="loan-value positive">${money(finalValue)}</span>
        <button class="delete" type="button" data-delete-loan="${escapeHTML(item.id)}" aria-label="Excluir" title="Excluir">×</button>
      </div>`;
    }).join("");
  }

  function renderExpenses() {
    const list = $("expenseList");
    if (!state.expenses.length) {
      list.innerHTML = '<div class="empty">Nenhum gasto cadastrado neste mês.</div>';
      return;
    }
    const sorted = [...state.expenses].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    list.innerHTML = sorted.map(item => `
      <div class="expense-row">
        <span class="expense-name">${escapeHTML(item.name)}</span>
        <time class="expense-date" datetime="${escapeHTML(item.date || "")}">${formatDate(item.date)}</time>
        <span class="expense-value negative">${money(numberOrZero(item.amount))}</span>
        <button class="delete" type="button" data-delete-expense="${escapeHTML(item.id)}" aria-label="Excluir ${escapeHTML(item.name)}" title="Excluir">×</button>
      </div>`).join("");
  }

  function renderFuture() {
    const list = $("futureList");
    if (!state.future.length) {
      list.innerHTML = '<div class="empty">Nenhuma pendência futura cadastrada.</div>';
      return;
    }
    list.innerHTML = state.future.map(item => `
      <div class="future-row">
        <span class="future-name">${escapeHTML(item.name)}</span>
        <span class="future-condition">${escapeHTML(item.condition)}</span>
        <span class="future-value">${money(numberOrZero(item.amount))}</span>
        <button class="delete" type="button" data-delete-future="${escapeHTML(item.id)}" aria-label="Excluir ${escapeHTML(item.name)}" title="Excluir">×</button>
      </div>`).join("");
  }

  function renderAll() {
    renderSummary();
    renderTransactions();
    renderLoans();
    renderExpenses();
    renderFuture();
  }
  function createId() {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
  }

  // Lógica do Toggle Extrato
  toggleExtratoBtn.addEventListener("click", () => {
    const isHidden = transactionSection.classList.contains("is-hidden");
    if (isHidden) {
      transactionSection.classList.remove("is-hidden");
      toggleExtratoBtn.textContent = "− Extrato";
      toggleExtratoBtn.classList.add("active");
      toggleExtratoBtn.setAttribute("aria-expanded", "true");
    } else {
      transactionSection.classList.add("is-hidden");
      toggleExtratoBtn.textContent = "+ Extrato";
      toggleExtratoBtn.classList.remove("active");
      toggleExtratoBtn.setAttribute("aria-expanded", "false");
    }
  });

  // Lógica do Toggle Empréstimos
  toggleEmprestimoBtn.addEventListener("click", () => {
    const isHidden = loanSection.classList.contains("is-hidden");
    if (isHidden) {
      loanSection.classList.remove("is-hidden");
      toggleEmprestimoBtn.textContent = "− Empréstimos";
      toggleEmprestimoBtn.classList.add("active");
      toggleEmprestimoBtn.setAttribute("aria-expanded", "true");
    } else {
      loanSection.classList.add("is-hidden");
      toggleEmprestimoBtn.textContent = "+ Empréstimos";
      toggleEmprestimoBtn.classList.remove("active");
      toggleEmprestimoBtn.setAttribute("aria-expanded", "false");
    }
  });

  monthSelect.addEventListener("change", () => {
    activeMonth = monthSelect.value;
    state = loadMonth(activeMonth);
    renderAll();
  });

  // --- Formulário de Transações ---
  $("transactionForm").addEventListener("submit", event => {
    event.preventDefault();
    const name = $("transactionName").value.trim();
    const amount = parseMoney($("transactionAmount").value);
    const type = $("transactionType").value;
    const date = $("transactionDate").value;
    
    if (!name || !Number.isFinite(amount) || amount <= 0 || !date) {
      alert("Preencha descrição, valor válido e data.");
      return;
    }
    if (date.slice(0, 7) !== activeMonth) {
      alert("A data da movimentação precisa pertencer ao mês selecionado.");
      return;
    }
    
    state.transactions.push({ id: createId(), name, amount, type, date });
    save();
    event.target.reset();
    $("transactionDate").value = `${activeMonth}-01`;
    renderSummary();
    renderTransactions();
  });

  $("transactionList").addEventListener("click", event => {
    const button = event.target.closest("[data-delete-transaction]");
    if (!button) return;
    state.transactions = state.transactions.filter(item => item.id !== button.dataset.deleteTransaction);
    save();
    renderSummary();
    renderTransactions();
  });

  // --- Formulário de Empréstimos ---
  $("loanForm").addEventListener("submit", event => {
    event.preventDefault();
    const name = $("loanName").value.trim();
    const amount = parseMoney($("loanAmount").value);
    const rateInput = $("loanRate").value.trim();
    
    let rate = 0;
    if (rateInput) {
      const cleanRate = rateInput.replace(",", ".");
      rate = Number(cleanRate);
      if (!Number.isFinite(rate) || rate < 0) rate = 0;
    }
    
    if (!name || !Number.isFinite(amount) || amount <= 0) {
      alert("Preencha o nome e um valor válido para o empréstimo.");
      return;
    }
    
    state.loans.push({ id: createId(), name, amount, rate });
    save();
    event.target.reset();
    $("loanRate").value = "0";
    renderLoans();
  });

  $("loanList").addEventListener("click", event => {
    const button = event.target.closest("[data-delete-loan]");
    if (!button) return;
    state.loans = state.loans.filter(item => item.id !== button.dataset.deleteLoan);
    save();
    renderLoans();
  });

  // --- Formulário de Gastos ---
  $("expenseForm").addEventListener("submit", event => {
    event.preventDefault();
    const name = $("expenseName").value.trim();
    const amount = parseMoney($("expenseAmount").value);
    const date = $("expenseDate").value;
    if (!name || !Number.isFinite(amount) || amount <= 0 || !date) {
      alert("Preencha nome, valor válido e data do gasto.");
      return;
    }
    if (date.slice(0, 7) !== activeMonth) {
      alert("A data do gasto precisa pertencer ao mês selecionado.");
      return;
    }
    state.expenses.push({ id: createId(), name, amount, date });
    save();
    event.target.reset();
    $("expenseDate").value = `${activeMonth}-01`;
    renderSummary();
    renderExpenses();
  });

  $("expenseList").addEventListener("click", event => {
    const button = event.target.closest("[data-delete-expense]");
    if (!button) return;
    state.expenses = state.expenses.filter(item => item.id !== button.dataset.deleteExpense);
    save();
    renderSummary();
    renderExpenses();
  });

  // --- Formulário de Pendências Futuras ---
  $("futureForm").addEventListener("submit", event => {
    event.preventDefault();
    const name = $("futureName").value.trim();
    const amount = parseMoney($("futureAmount").value);
    const condition = $("futureCondition").value.trim();
    if (!name || !Number.isFinite(amount) || amount <= 0 || !condition) {
      alert("Preencha nome, valor válido e condição ou vencimento.");
      return;
    }
    state.future.push({ id: createId(), name, amount, condition });
    save();
    event.target.reset();
    renderFuture();
  });
  
  $("futureList").addEventListener("click", event => {
    const button = event.target.closest("[data-delete-future]");
    if (!button) return;
    state.future = state.future.filter(item => item.id !== button.dataset.deleteFuture);
    save();
    renderFuture();
  });

  renderMonthOptions();
  state = loadMonth(activeMonth);
  $("expenseDate").value = `${activeMonth}-01`;
  $("transactionDate").value = `${activeMonth}-01`;
  renderAll();
})();