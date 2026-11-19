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

  // Elementos de Edição de Gasto
  const expenseIdEdit = $("expenseIdEdit");
  const expenseSubmitBtn = $("expenseSubmitBtn");
  const expenseCancelBtn = $("expenseCancelBtn");

  function currentMonthKey() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  }

  function getTodayDate() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
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
        expenses: Array.isArray(data.expenses) ? data.expenses.map(e => ({ ...e, done: !!e.done })) : [],
        future: Array.isArray(data.future) ? data.future : [],
        loans: Array.isArray(data.loans) ? data.loans : []
      };
    } catch (error) {
      console.error("Erro ao carregar:", error);
      return emptyMonth();
    }
  }
  function save() {
    try {
      localStorage.setItem(storageKey(activeMonth), JSON.stringify(state));
    } catch (error) {
      alert("Erro ao salvar.");
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
    return `${day}/${month}`;
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
  }

  function renderSummary() {
    const totalDeposits = state.transactions.filter(t => t.type === "deposit").reduce((total, item) => total + numberOrZero(item.amount), 0);
    const totalWithdrawals = state.transactions.filter(t => t.type === "withdrawal").reduce((total, item) => total + numberOrZero(item.amount), 0);
    
    // Gastos pagos descontam do saldo. Pendentes não.
    const spent = state.expenses.filter(e => e.done).reduce((total, item) => total + numberOrZero(item.amount), 0);
    
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
      list.innerHTML = '<div class="empty">Nenhuma movimentação cadastrada.</div>';
      return;
    }
    const sorted = [...state.transactions].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    list.innerHTML = sorted.map(item => `
      <div class="transaction-row">
        <span class="expense-name"><span class="transaction-type ${item.type}">[${item.type === 'deposit' ? 'Dep.' : 'Saq.'}]</span> ${escapeHTML(item.name)}</span>
        <time class="expense-date" datetime="${escapeHTML(item.date || "")}">${formatDate(item.date)}</time>
        <span class="expense-value ${item.type === 'deposit' ? 'positive' : 'negative'}">${item.type === 'deposit' ? '+' : '-'} ${money(numberOrZero(item.amount))}</span>
        <button class="delete" type="button" data-delete-transaction="${escapeHTML(item.id)}" title="Excluir">×</button>
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
        <button class="delete" type="button" data-delete-loan="${escapeHTML(item.id)}" title="Excluir">×</button>
      </div>`;
    }).join("");
  }

  function renderExpenses() {
    const list = $("expenseList");
    if (!state.expenses.length) {
      list.innerHTML = '<div class="empty">Nenhum gasto cadastrado.</div>';
      return;
    }
    const sorted = [...state.expenses].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    list.innerHTML = sorted.map(item => `
      <div class="expense-row ${item.done ? 'done' : ''}">
        <button class="check-btn ${item.done ? 'active' : ''}" type="button" data-toggle-expense="${escapeHTML(item.id)}" title="${item.done ? 'Marcar como pendente' : 'Marcar como pago'}">
          ${item.done ? '✓' : ''}
        </button>
        <span class="expense-name">${escapeHTML(item.name)}</span>
        <time class="expense-date" datetime="${escapeHTML(item.date || "")}">${formatDate(item.date)}</time>
        <span class="expense-value negative">${money(numberOrZero(item.amount))}</span>
        <div class="actions-cell">
          <button class="edit" type="button" data-edit-expense="${escapeHTML(item.id)}" title="Editar">✎</button>
          <button class="delete" type="button" data-delete-expense="${escapeHTML(item.id)}" title="Excluir">×</button>
        </div>
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
        <button class="delete" type="button" data-delete-future="${escapeHTML(item.id)}" title="Excluir">×</button>
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

  // Toggles
  toggleExtratoBtn.addEventListener("click", () => {
    const isHidden = transactionSection.classList.contains("is-hidden");
    transactionSection.classList.toggle("is-hidden");
    toggleExtratoBtn.textContent = isHidden ? "− Extrato" : "+ Extrato";
    toggleExtratoBtn.classList.toggle("active", isHidden);
  });

  toggleEmprestimoBtn.addEventListener("click", () => {
    const isHidden = loanSection.classList.contains("is-hidden");
    loanSection.classList.toggle("is-hidden");
    toggleEmprestimoBtn.textContent = isHidden ? "− Empréstimos" : "+ Empréstimos";
    toggleEmprestimoBtn.classList.toggle("active", isHidden);
  });

  monthSelect.addEventListener("change", () => {
    activeMonth = monthSelect.value;
    state = loadMonth(activeMonth);
    // Reseta o form de edição ao trocar de mês
    expenseIdEdit.value = "";
    $("expenseForm").reset();
    $("expenseSubmitBtn").textContent = "Adicionar gasto";
    expenseCancelBtn.classList.add("is-hidden");
    $("expenseDate").value = getTodayDate().startsWith(activeMonth) ? getTodayDate() : `${activeMonth}-01`;
    
    renderAll();
  });

  // --- Ações Extrato ---
  $("transactionForm").addEventListener("submit", event => {
    event.preventDefault();
    const name = $("transactionName").value.trim();
    const amount = parseMoney($("transactionAmount").value);
    const type = $("transactionType").value;
    const date = $("transactionDate").value;
    
    if (!name || !Number.isFinite(amount) || amount <= 0 || !date) return alert("Preencha tudo.");
    if (date.slice(0, 7) !== activeMonth) return alert("Data fora do mês.");
    
    state.transactions.push({ id: createId(), name, amount, type, date });
    save();
    event.target.reset();
    $("transactionDate").value = getTodayDate().startsWith(activeMonth) ? getTodayDate() : `${activeMonth}-01`;
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

  // --- Ações Empréstimo ---
  $("loanForm").addEventListener("submit", event => {
    event.preventDefault();
    const name = $("loanName").value.trim();
    const amount = parseMoney($("loanAmount").value);
    let rate = 0;
    if ($("loanRate").value) rate = Number($("loanRate").value.replace(",", ".")) || 0;
    
    if (!name || !Number.isFinite(amount) || amount <= 0) return alert("Preencha nome e valor.");
    
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

  // --- Ações Gastos ---
  $("expenseForm").addEventListener("submit", event => {
    event.preventDefault();
    const id = expenseIdEdit.value;
    const name = $("expenseName").value.trim();
    const amount = parseMoney($("expenseAmount").value);
    const date = $("expenseDate").value;
    
    if (!name || !Number.isFinite(amount) || amount <= 0 || !date) return alert("Preencha tudo.");
    if (date.slice(0, 7) !== activeMonth) return alert("A data deve ser do mês selecionado.");

    if (id) {
      // Editando
      const index = state.expenses.findIndex(e => e.id === id);
      if (index !== -1) {
        state.expenses[index] = { ...state.expenses[index], name, amount, date };
      }
      expenseIdEdit.value = "";
      expenseSubmitBtn.textContent = "Adicionar gasto";
      expenseCancelBtn.classList.add("is-hidden");
    } else {
      // Novo
      state.expenses.push({ id: createId(), name, amount, date, done: false });
    }
    
    save();
    event.target.reset();
    $("expenseDate").value = getTodayDate().startsWith(activeMonth) ? getTodayDate() : `${activeMonth}-01`;
    renderSummary();
    renderExpenses();
  });

  expenseCancelBtn.addEventListener("click", () => {
    expenseIdEdit.value = "";
    $("expenseForm").reset();
    expenseSubmitBtn.textContent = "Adicionar gasto";
    expenseCancelBtn.classList.add("is-hidden");
    $("expenseDate").value = getTodayDate().startsWith(activeMonth) ? getTodayDate() : `${activeMonth}-01`;
  });

  $("expenseList").addEventListener("click", event => {
    const btnDelete = event.target.closest("[data-delete-expense]");
    if (btnDelete) {
      state.expenses = state.expenses.filter(item => item.id !== btnDelete.dataset.deleteExpense);
      save();
      renderSummary();
      renderExpenses();
      return;
    }

    const btnToggle = event.target.closest("[data-toggle-expense]");
    if (btnToggle) {
      const item = state.expenses.find(e => e.id === btnToggle.dataset.toggleExpense);
      if (item) {
        item.done = !item.done;
        save();
        renderSummary();
        renderExpenses();
      }
      return;
    }

    const btnEdit = event.target.closest("[data-edit-expense]");
    if (btnEdit) {
      const id = btnEdit.dataset.editExpense;
      const item = state.expenses.find(e => e.id === id);
      if (item) {
        expenseIdEdit.value = item.id;
        $("expenseName").value = item.name;
        $("expenseAmount").value = item.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
        $("expenseDate").value = item.date;
        
        expenseSubmitBtn.textContent = "Salvar Alterações";
        expenseCancelBtn.classList.remove("is-hidden");
        
        // Rola para o topo do form
        $("expenseForm").scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  });

  // --- Ações Pendências ---
  $("futureForm").addEventListener("submit", event => {
    event.preventDefault();
    const name = $("futureName").value.trim();
    const amount = parseMoney($("futureAmount").value);
    const condition = $("futureCondition").value.trim();
    if (!name || !Number.isFinite(amount) || amount <= 0 || !condition) return alert("Preencha tudo.");
    
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

  // Init
  renderMonthOptions();
  state = loadMonth(activeMonth);
  
  // Seta a data atual por padrão
  const today = getTodayDate();
  $("expenseDate").value = today.startsWith(activeMonth) ? today : `${activeMonth}-01`;
  $("transactionDate").value = today.startsWith(activeMonth) ? today : `${activeMonth}-01`;
  
  renderAll();
})();