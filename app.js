// Budget App - Plain JS

const STORAGE_KEY = 'budgetAppData';
let transactions = [];
let incomeCategories = ['Salary', 'Bonus', 'Interest', 'Gift', 'Investment', 'Refund', 'Other'];
let expenseCategories = ['Food', 'Rent', 'Utilities', 'Transport', 'Health', 'Education', 'Entertainment', 'Shopping', 'Insurance', 'Taxes', 'Savings', 'Other'];
let accounts = ['Cash', 'Bank', 'Mobile Money'];
let currency = '$';
let selectedAccount = 'All';
let editIndex = null;
let transferMode = false;
let budgets = {};

function loadData() {
  let data = JSON.parse(localStorage.getItem(STORAGE_KEY));
  if (!data) {
    // Structure par défaut
    data = {
      transactions: [],
      incomeCategories: ['Salary', 'Bonus', 'Interest', 'Gift', 'Investment', 'Refund', 'Other'],
      expenseCategories: ['Food', 'Rent', 'Utilities', 'Transport', 'Health', 'Education', 'Entertainment', 'Shopping', 'Insurance', 'Taxes', 'Savings', 'Other'],
      accounts: ['Cash', 'Bank', 'Mobile Money'],
      currency: '$',
      budgets: {}
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }
  if (data && Array.isArray(data.transactions)) {
    transactions = data.transactions;
    if (Array.isArray(data.incomeCategories)) incomeCategories = data.incomeCategories;
    if (Array.isArray(data.expenseCategories)) expenseCategories = data.expenseCategories;
    if (Array.isArray(data.accounts)) accounts = data.accounts;
    if (data.currency) currency = data.currency;
    if (data.budgets) budgets = data.budgets;
  }
  const legacyCurrency = localStorage.getItem('budgetAppCurrency');
  if (legacyCurrency) currency = legacyCurrency;
}
function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ transactions, incomeCategories, expenseCategories, accounts, currency, budgets }));
}

function renderDashboard() {
  let filtered = selectedAccount === 'All' ? transactions : transactions.filter(t => {
    if (t.type === 'transfer') return t.fromAccount === selectedAccount || t.toAccount === selectedAccount;
    return t.account === selectedAccount;
  });
  let income = 0, expense = 0, transferIn = 0, transferOut = 0;
  filtered.forEach(t => {
    if (t.type === 'income') income += t.amount;
    else if (t.type === 'expense') expense += t.amount;
    else if (t.type === 'transfer') {
      if (selectedAccount === 'All') {
        // Ignore for all
      } else if (t.toAccount === selectedAccount) transferIn += t.amount;
      else if (t.fromAccount === selectedAccount) transferOut += t.amount;
    }
  });
  let balance = income - expense + transferIn - transferOut;
  document.getElementById('dashboard').innerHTML = `
    <div class="dashboard-card">
      <h3>Income</h3>
      <div id="incomeTotal">${currency}${income.toFixed(2)}</div>
    </div>
    <div class="dashboard-card">
      <h3>Expenses</h3>
      <div id="expenseTotal">${currency}${expense.toFixed(2)}</div>
    </div>
    <div class="dashboard-card">
      <h3>Balance</h3>
      <div id="balanceTotal">${currency}${balance.toFixed(2)}</div>
    </div>
  `;
}

function renderBudgets() {
  // Only for expense categories
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  let html = `<div id="budgetsSection" style="margin-bottom:2rem;">
    <h2 style="margin-bottom:0.5em;">Budgets</h2>
    <table style="width:100%;border-collapse:collapse;">
      <thead><tr><th>Category</th><th>Budget</th><th>Spent</th><th>Progress</th></tr></thead>
      <tbody>
        ${expenseCategories.map(cat => {
          // Calculate spent this month for this category
          const spent = transactions.filter(t => {
            if (t.type !== 'expense') return false;
            const d = new Date(t.date);
            return t.category === cat && d.getFullYear() === year && d.getMonth() === month && (selectedAccount === 'All' || t.account === selectedAccount);
          }).reduce((sum, t) => sum + t.amount, 0);
          const budget = budgets[cat]?.[selectedAccount] ?? budgets[cat]?.['All'] ?? '';
          const percent = budget ? Math.min(100, Math.round((spent / budget) * 100)) : 0;
          let color = percent < 80 ? '#4caf50' : percent < 100 ? '#ff9800' : '#f44336';
          return `<tr>
            <td>${cat}</td>
            <td><input type="number" class="budgetInput" data-cat="${cat}" value="${budget}" min="0" style="width:5em;" /></td>
            <td>${currency}${spent.toFixed(2)}</td>
            <td><div style="background:#eee;border-radius:6px;overflow:hidden;width:100px;height:16px;display:inline-block;vertical-align:middle;"><div style="background:${color};width:${percent}%;height:100%;"></div></div> <span style="font-size:0.95em;">${budget ? percent + '%' : ''}</span>${percent >= 100 ? ' 🚨' : ''}</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
  </div>`;
  document.getElementById('dashboard').insertAdjacentHTML('afterend', html);
}

function renderAccountSelector() {
  // For dashboard and transaction list filtering
  let html = `<select id="accountFilter">
    <option value="All">All Accounts</option>
    ${accounts.map(acc => `<option value="${acc}">${acc}</option>`).join('')}
  </select>`;
  document.getElementById('dashboard').insertAdjacentHTML('beforebegin', `<div id="accountSelectorWrap" style="margin-bottom:1rem;">${html}</div>`);
}

function renderAccountManager() {
  // For adding/removing accounts
  document.getElementById('transaction-form').insertAdjacentHTML('beforebegin', `
    <div id="accountManager" style="margin-bottom:1rem;">
      <label for="newAccountInput">Accounts:</label>
      <ul id="accountList" style="display:inline;list-style:none;padding:0;margin:0 1rem 0 0;">
        ${accounts.map(acc => `<li style="display:inline;margin-right:0.5em;">${acc} <button class="delAccBtn" data-acc="${acc}" style="color:#f44336;background:none;border:none;cursor:pointer;font-size:1em;">&times;</button></li>`).join('')}
      </ul>
      <input type="text" id="newAccountInput" placeholder="Add account" style="width:8em;" maxlength="20" />
      <input type="number" id="newAccountBalanceInput" placeholder="Initial balance" style="width:8em;margin-left:0.5em;" step="0.01" />
      <button id="addAccountBtn" style="margin-left:0.5em;">Add</button>
    </div>
  `);
}

function renderTransactionForm() {
  let t = editIndex !== null ? transactions[editIndex] : null;
  const type = t ? t.type : (transferMode ? 'transfer' : 'income');
  document.getElementById('transaction-form').innerHTML = `
    <div style="margin-bottom:0.5em;">
      <button id="addModeBtn" ${!transferMode ? 'disabled' : ''}>Add</button>
      <button id="transferModeBtn" ${transferMode ? 'disabled' : ''}>Transfer</button>
    </div>
    <form id="addTransactionForm">
      <input type="date" name="date" required value="${t ? t.date : ''}" />
      <input type="number" name="amount" placeholder="Amount" required step="0.01" value="${t ? t.amount : ''}" />
      ${type === 'transfer' ? `
        <select name="fromAccount" id="fromAccountSelect">
          ${accounts.map(acc => `<option value="${acc}"${t && t.fromAccount === acc ? ' selected' : ''}>${acc}</option>`).join('')}
        </select>
        <span style="font-weight:bold;">→</span>
        <select name="toAccount" id="toAccountSelect">
          ${accounts.map(acc => `<option value="${acc}"${t && t.toAccount === acc ? ' selected' : ''}>${acc}</option>`).join('')}
        </select>
      ` : `
        <input type="text" name="description" placeholder="Description" required value="${t ? t.description : ''}" />
        <select name="account" id="accountSelect">
          ${accounts.map(acc => `<option value="${acc}"${t && t.account === acc ? ' selected' : ''}>${acc}</option>`).join('')}
        </select>
        <select name="category" id="categorySelect">
          ${(type === 'income' ? incomeCategories : expenseCategories).map(cat => `<option value="${cat}"${t && t.category === cat ? ' selected' : ''}>${cat}</option>`).join('')}
        </select>
        <select name="type" id="typeSelect">
          <option value="income"${type === 'income' ? ' selected' : ''}>Income</option>
          <option value="expense"${type === 'expense' ? ' selected' : ''}>Expense</option>
        </select>
      `}
      <button type="submit">${editIndex !== null ? 'Update' : (transferMode ? 'Transfer' : 'Add')}</button>
      ${editIndex !== null ? '<button type="button" id="cancelEditBtn">Cancel</button>' : ''}
    </form>
  `;
}

function renderTransactionList() {
  let filtered = selectedAccount === 'All' ? transactions : transactions.filter(t => {
    if (t.type === 'transfer') return t.fromAccount === selectedAccount || t.toAccount === selectedAccount;
    return t.account === selectedAccount;
  });
  document.getElementById('transaction-list').innerHTML = `
    <table class="transaction-table">
      <thead>
        <tr>
          <th>Date</th>
          <th>${transferMode ? 'From' : 'Description'}</th>
          <th>${transferMode ? 'To' : 'Account'}</th>
          <th>Category</th>
          <th>Type</th>
          <th>Amount</th>
          <th>Action</th>
        </tr>
      </thead>
      <tbody>
        ${filtered.map((t, i) => {
          const idx = transactions.indexOf(t);
          if (t.type === 'transfer') {
            return `
              <tr>
                <td>${t.date}</td>
                <td>${t.fromAccount}</td>
                <td>${t.toAccount}</td>
                <td>-</td>
                <td class="transfer">Transfer</td>
                <td>${currency}${t.amount.toFixed(2)}</td>
                <td>
                  <button data-index="${idx}" class="editBtn">Edit</button>
                  <button data-index="${idx}" class="deleteBtn">Delete</button>
                </td>
              </tr>
            `;
          }
          return `
            <tr>
              <td>${t.date}</td>
              <td>${t.description}</td>
              <td>${t.account || ''}</td>
              <td>${t.category}</td>
              <td class="${t.type}">${t.type.charAt(0).toUpperCase() + t.type.slice(1)}</td>
              <td class="${t.type}">${t.type === 'expense' ? '-' : ''}${currency}${Math.abs(t.amount).toFixed(2)}</td>
              <td>
                <button data-index="${idx}" class="editBtn">Edit</button>
                <button data-index="${idx}" class="deleteBtn">Delete</button>
              </td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;
}

function renderCharts() {
  // Placeholder for future chart rendering
}

function setupDataTools() {
  document.getElementById('exportBtn').onclick = () => {
    const dataStr = JSON.stringify({ transactions, incomeCategories, expenseCategories, accounts, currency, budgets }, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'budget-data.json';
    a.click();
    URL.revokeObjectURL(url);
  };
  document.getElementById('importBtn').onclick = () => {
    document.getElementById('importInput').click();
  };
  document.getElementById('importInput').onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = JSON.parse(evt.target.result);
        if (Array.isArray(data.transactions)) transactions = data.transactions;
        if (Array.isArray(data.incomeCategories)) incomeCategories = data.incomeCategories;
        if (Array.isArray(data.expenseCategories)) expenseCategories = data.expenseCategories;
        if (Array.isArray(data.accounts)) accounts = data.accounts;
        if (data.currency) currency = data.currency;
        if (data.budgets) budgets = data.budgets;
        saveData();
        renderAll();
      } catch (err) {
        alert('Invalid file format.');
      }
    };
    reader.readAsText(file);
  };
}

function setupCurrencySelector() {
  const selector = document.getElementById('currencySelector');
  const customInput = document.getElementById('customCurrencyInput');
  if (!selector) return;
  if (["$","€","£","¥","₹","₦"].includes(currency)) {
    selector.value = currency;
    customInput.style.display = 'none';
  } else {
    selector.value = 'custom';
    customInput.style.display = '';
    customInput.value = currency;
  }
  selector.onchange = () => {
    if (selector.value === 'custom') {
      customInput.style.display = '';
      customInput.focus();
      currency = customInput.value || '';
    } else {
      customInput.style.display = 'none';
      currency = selector.value;
      saveData();
      renderAll();
    }
  };
  customInput.oninput = () => {
    currency = customInput.value || '';
    saveData();
    renderAll();
  };
}

function renderAll() {
  document.getElementById('accountSelectorWrap')?.remove();
  document.getElementById('accountManager')?.remove();
  document.getElementById('budgetsSection')?.remove();
  renderAccountSelector();
  renderDashboard();
  renderBudgets();
  renderAccountManager();
  renderTransactionForm();
  renderTransactionList();
  renderCharts();
  setupFormHandlers();
  setupDeleteHandlers();
  setupDataTools();
  setupCurrencySelector();
  setupAccountHandlers();
  setupBudgetHandlers();
}

function setupFormHandlers() {
  const form = document.getElementById('addTransactionForm');
  const typeSelect = document.getElementById('typeSelect');
  const categorySelect = document.getElementById('categorySelect');
  if (typeSelect && categorySelect) {
    typeSelect.onchange = () => {
      const cats = typeSelect.value === 'income' ? incomeCategories : expenseCategories;
      categorySelect.innerHTML = cats.map(cat => `<option value="${cat}">${cat}</option>`).join('');
    };
  }
  if (form) {
    form.onsubmit = (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      let t;
      if (transferMode || (editIndex !== null && transactions[editIndex].type === 'transfer')) {
        t = {
          id: editIndex !== null ? transactions[editIndex].id : Date.now(),
          date: fd.get('date'),
          amount: parseFloat(fd.get('amount')),
          fromAccount: fd.get('fromAccount'),
          toAccount: fd.get('toAccount'),
          type: 'transfer',
        };
      } else {
        t = {
          id: editIndex !== null ? transactions[editIndex].id : Date.now(),
          date: fd.get('date'),
          description: fd.get('description'),
          amount: parseFloat(fd.get('amount')),
          account: fd.get('account'),
          category: fd.get('category'),
          type: fd.get('type'),
        };
      }
      if (editIndex !== null) {
        transactions[editIndex] = t;
        editIndex = null;
      } else {
        transactions.push(t);
      }
      transferMode = false;
      saveData();
      renderAll();
    };
    const cancelBtn = document.getElementById('cancelEditBtn');
    if (cancelBtn) {
      cancelBtn.onclick = () => {
        editIndex = null;
        transferMode = false;
        renderAll();
      };
    }
    const addModeBtn = document.getElementById('addModeBtn');
    const transferModeBtn = document.getElementById('transferModeBtn');
    if (addModeBtn) addModeBtn.onclick = () => { transferMode = false; editIndex = null; renderAll(); };
    if (transferModeBtn) transferModeBtn.onclick = () => { transferMode = true; editIndex = null; renderAll(); };
  }
}

function setupAccountHandlers() {
  // Account filter
  const filter = document.getElementById('accountFilter');
  if (filter) {
    filter.value = selectedAccount;
    filter.onchange = () => {
      selectedAccount = filter.value;
      renderAll();
    };
  }
  // Add account
  const addBtn = document.getElementById('addAccountBtn');
  const newInput = document.getElementById('newAccountInput');
  const newBalanceInput = document.getElementById('newAccountBalanceInput');
  if (addBtn && newInput && newBalanceInput) {
    addBtn.onclick = (e) => {
      e.preventDefault();
      const val = newInput.value.trim();
      const balance = parseFloat(newBalanceInput.value);
      if (val && !accounts.includes(val)) {
        accounts.push(val);
        // Si un solde initial est saisi et non nul, on crée une transaction d'initialisation
        if (!isNaN(balance) && balance !== 0) {
          transactions.push({
            id: Date.now(),
            date: new Date().toISOString().slice(0, 10),
            description: 'Initial balance',
            amount: balance,
            account: val,
            category: 'Other',
            type: 'income',
          });
        }
        saveData();
        renderAll();
      }
      newInput.value = '';
      newBalanceInput.value = '';
    };
  }
  // Delete account
  document.querySelectorAll('.delAccBtn').forEach(btn => {
    btn.onclick = (e) => {
      const acc = btn.getAttribute('data-acc');
      if (accounts.length > 1 && acc && accounts.includes(acc)) {
        accounts = accounts.filter(a => a !== acc);
        // Remove account from transactions
        transactions = transactions.filter(t => t.account !== acc);
        saveData();
        renderAll();
      }
    };
  });
}

function setupBudgetHandlers() {
  document.querySelectorAll('.budgetInput').forEach(input => {
    input.onchange = () => {
      const cat = input.getAttribute('data-cat');
      const val = parseFloat(input.value);
      if (!budgets[cat]) budgets[cat] = {};
      budgets[cat][selectedAccount] = isNaN(val) ? undefined : val;
      saveData();
      renderAll();
    };
  });
}

function setupDeleteHandlers() {
  document.querySelectorAll('.deleteBtn').forEach(btn => {
    btn.onclick = (e) => {
      const idx = parseInt(btn.getAttribute('data-index'));
      if (!isNaN(idx)) {
        transactions.splice(idx, 1);
        saveData();
        renderAll();
      }
    };
  });
  document.querySelectorAll('.editBtn').forEach(btn => {
    btn.onclick = (e) => {
      const idx = parseInt(btn.getAttribute('data-index'));
      if (!isNaN(idx)) {
        editIndex = idx;
        renderAll();
      }
    };
  });
}

// --- App Start ---
loadData();
renderAll();