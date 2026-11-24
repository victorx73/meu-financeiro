(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const STORAGE_PREFIX = "meu-financeiro-v1";
  const monthSelect = $("monthSelect");
  const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  let activeMonth = currentMonthKey();
  let state = emptyMonth();

  const toggleExtratoBtn = $("toggleExtratoBtn");
  const transactionSection = $("transactionSection");
  const toggleEmprestimoBtn = $("toggleEmprestimoBtn");
  const loanSection = $("loanSection");

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
  
  function loadSpecificMonth(monthKey) {
    try {
      const raw = localStorage.getItem(storageKey(monthKey));
      if (!raw) return emptyMonth();
      const data = JSON.parse(raw);
      return {
        transactions: Array.isArray(data.transactions) ? data.transactions : [],
        expenses: Array.isArray(data.expenses) ? data.expenses.map(e => ({ ...e, done: !!e.done })) : [],
        future: Array.isArray(data.future) ? data.future.map(f => ({
          ...f,
          amount: numberOrZero(f.amount),
          paid: Math.min(numberOrZero(f.paid), numberOrZero(f.amount))
        })) : [],
        loans: Array.isArray(data.loans) ? data.loans.map(l => ({ ...l, done: !!l.done })) : []
      };
    } catch (error) { return emptyMonth(); }
  }

  function loadMonth(month) {
    return loadSpecificMonth(month);
  }

  function save() {
    try {
      localStorage.setItem(storageKey(activeMonth), JSON.stringify(state));
    } catch (error) {
      alert("Erro ao salvar.");
    }
  }

  function saveSpecificMonth(monthKey, monthState) {
    try {
      localStorage.setItem(storageKey(monthKey), JSON.stringify(monthState));
    } catch (error) { console.error(error); }
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
    const spent = state.expenses.filter(e => e.done).reduce((total, item) => total + numberOrZero(item.amount), 0);
    const activeLoans = state.loans.filter(l => !l.done).reduce((total, item) => total + numberOrZero(item.amount), 0);

    const available = totalDeposits - totalWithdrawals - spent - activeLoans;

    $("availableInput").value = money(available);
    $("spentOutput").value = money(spent);

    $("availableInput").classList.toggle("negative", available < 0);
    $("availableInput").classList.toggle("positive", available >= 0);
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
      const amount = numberOrZero(item.amount);
      const rate = numberOrZero(item.rate);
      const finalValue = amount + (amount * (rate / 100));
      const done = !!item.done;
      return `
      <div class="loan-row ${done ? 'done' : ''}">
        <button class="check-btn ${done ? 'active' : ''}" type="button" data-toggle-loan="${escapeHTML(item.id)}" title="${done ? 'Marcar como não recebido' : 'Marcar como recebido'}">
          ${done ? '✓' : ''}
        </button>
        <span class="loan-name">${escapeHTML(item.name)}</span>
        <span class="loan-rate" style="text-align: right;">${rate}%</span>
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
    list.innerHTML = state.future.map(item => {
      const amount = numberOrZero(item.amount);
      const paid = Math.min(numberOrZero(item.paid), amount);
      const remaining = Math.max(0, amount - paid);
      const complete = remaining <= 0;
      return `
      <div class="future-row ${complete ? 'done' : ''}">
        <button class="check-btn ${complete ? 'active' : ''}" type="button" data-toggle-future="${escapeHTML(item.id)}" title="${complete ? 'Marcar como não paga' : 'Marcar como paga'}">
          ${complete ? '✓' : ''}
        </button>
        <span class="future-name">${escapeHTML(item.name)}</span>
        <span class="future-condition">${escapeHTML(item.condition)}</span>
        <span class="future-value ${complete ? 'positive' : ''}">
          ${complete ? money(amount) : `${money(paid)} / ${money(amount)}<small>Restante ${money(remaining)}</small>`}
        </span>
        <div class="actions-cell">
          <button class="pay" type="button" data-pay-future="${escapeHTML(item.id)}" title="Informar pagamento">Pagar</button>
          <button class="delete" type="button" data-delete-future="${escapeHTML(item.id)}" title="Excluir">×</button>
        </div>
      </div>`;
    }).join("");
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
    expenseIdEdit.value = "";
    $("expenseForm").reset();
    expenseSubmitBtn.textContent = "Adicionar gasto";
    expenseCancelBtn.classList.add("is-hidden");
    $("expenseDate").value = getTodayDate().startsWith(activeMonth) ? getTodayDate() : `${activeMonth}-01`;
    renderAll();
  });

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

  $("loanForm").addEventListener("submit", event => {
    event.preventDefault();
    const name = $("loanName").value.trim();
    const amount = parseMoney($("loanAmount").value);
    let rate = 0;
    if ($("loanRate").value) rate = Number($("loanRate").value.replace(",", ".")) || 0;
    
    if (!name || !Number.isFinite(amount) || amount <= 0) return alert("Preencha nome e valor.");
    
    state.loans.push({ id: createId(), name, amount, rate, done: false });
    save();
    event.target.reset();
    $("loanRate").value = "0";
    renderSummary();
    renderLoans();
  });

  $("loanList").addEventListener("click", event => {
    const toggleButton = event.target.closest("[data-toggle-loan]");
    if (toggleButton) {
      const item = state.loans.find(loan => loan.id === toggleButton.dataset.toggleLoan);
      if (item) {
        item.done = !item.done;
        save();
        renderSummary();
        renderLoans();
      }
      return;
    }

    const deleteButton = event.target.closest("[data-delete-loan]");
    if (!deleteButton) return;
    state.loans = state.loans.filter(item => item.id !== deleteButton.dataset.deleteLoan);
    save();
    renderSummary();
    renderLoans();
  });

  // --- Form de Gastos ---
  $("expenseForm").addEventListener("submit", event => {
    event.preventDefault();
    const id = expenseIdEdit.value;
    const name = $("expenseName").value.trim();
    const amount = parseMoney($("expenseAmount").value);
    const date = $("expenseDate").value;
    
    if (!name || !Number.isFinite(amount) || amount <= 0 || !date) return alert("Preencha tudo.");

    const targetMonth = date.slice(0, 7);

    if (id) {
      const index = state.expenses.findIndex(e => e.id === id);
      if (index === -1) return;
      
      const oldExpense = state.expenses[index];

      if (targetMonth !== activeMonth) {
        // Transferir de mês
        if (!confirm(`Mover este gasto para ${monthLabel(targetMonth)}?`)) return;

        // Remove do mês atual
        state.expenses.splice(index, 1);
        save();

        // Adiciona no mês de destino
        const targetState = loadSpecificMonth(targetMonth);
        targetState.expenses.push({ ...oldExpense, name, amount, date });
        saveSpecificMonth(targetMonth, targetState);

        alert("Gasto movido com sucesso!");
      } else {
        // Apenas salva no mesmo mês
        state.expenses[index] = { ...oldExpense, name, amount, date };
        save();
      }

      expenseIdEdit.value = "";
      expenseSubmitBtn.textContent = "Adicionar gasto";
      expenseCancelBtn.classList.add("is-hidden");
    } else {
      // Novo gasto (validação do mês)
      if (targetMonth !== activeMonth) return alert("A data deve ser do mês selecionado.");
      state.expenses.push({ id: createId(), name, amount, date, done: false });
      save();
    }
    
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
        
        $("expenseForm").scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  });

  $("futureForm").addEventListener("submit", event => {
    event.preventDefault();
    const name = $("futureName").value.trim();
    const amount = parseMoney($("futureAmount").value);
    const condition = $("futureCondition").value.trim();
    if (!name || !Number.isFinite(amount) || amount <= 0 || !condition) return alert("Preencha tudo.");
    
    state.future.push({ id: createId(), name, amount, paid: 0, condition });
    save();
    event.target.reset();
    renderFuture();
  });

  $("futureList").addEventListener("click", event => {
    const toggleButton = event.target.closest("[data-toggle-future]");
    if (toggleButton) {
      const item = state.future.find(future => future.id === toggleButton.dataset.toggleFuture);
      if (item) {
        const paid = numberOrZero(item.paid);
        item.paid = paid >= numberOrZero(item.amount) ? 0 : numberOrZero(item.amount);
        save();
        renderFuture();
      }
      return;
    }

    const payButton = event.target.closest("[data-pay-future]");
    if (payButton) {
      const item = state.future.find(future => future.id === payButton.dataset.payFuture);
      if (item) {
        const amount = numberOrZero(item.amount);
        const alreadyPaid = numberOrZero(item.paid);
        const remaining = Math.max(0, amount - alreadyPaid);
        if (remaining <= 0) return alert("Esta pendência já foi paga.");

        const answer = prompt(`Quanto deseja pagar desta pendência?\nRestante: ${money(remaining)}`, money(remaining));
        if (answer === null) return;
        const payment = parseMoney(answer);
        if (!Number.isFinite(payment) || payment <= 0) return alert("Informe um valor válido.");

        item.paid = Math.min(amount, alreadyPaid + payment);
        save();
        renderFuture();
      }
      return;
    }

    const deleteButton = event.target.closest("[data-delete-future]");
    if (!deleteButton) return;
    state.future = state.future.filter(item => item.id !== deleteButton.dataset.deleteFuture);
    save();
    renderFuture();
  });

  renderMonthOptions();
  state = loadMonth(activeMonth);
  
  const today = getTodayDate();
  $("expenseDate").value = today.startsWith(activeMonth) ? today : `${activeMonth}-01`;
  $("transactionDate").value = today.startsWith(activeMonth) ? today : `${activeMonth}-01`;
  
  renderAll();
})();