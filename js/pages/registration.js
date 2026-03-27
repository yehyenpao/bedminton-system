/**
 * registration.js - 分頁 1: 報名與自動分組
 */
window.RegistrationPage = {
  render(container) {
    container.innerHTML = `
      <div class="card" style="margin-bottom: 2rem;">
        <h2><i class="ri-file-text-line"></i> 大量匯入報名資料</h2>
        <p style="color: var(--text-secondary); margin-bottom: 1rem;">
          請以 CSV 或 Tab 分隔格式貼上資料。格式：<br/>
          <code>隊名, 姓名, 參賽類別(男雙/女雙/混雙)</code>
        </p>
        <div class="form-group">
          <textarea id="import-data" class="form-control" placeholder="王者之風, 王小明/王大明, 男雙\n無敵雙星, 陳小美/林小花, 女雙"></textarea>
        </div>
        <div style="display:flex; gap:1rem;">
          <button id="btn-import" class="btn" style="background:linear-gradient(135deg, #4b5563, #374151);"><i class="ri-file-upload-line"></i> 匯入並預覽名單</button>
          <button id="btn-grouping" class="btn" disabled><i class="ri-magic-line"></i> 電腦抽籤分組並儲存</button>
          <button id="btn-load-reg" class="btn" style="background:linear-gradient(135deg,#1d4ed8,#1e40af);"><i class="ri-cloud-line"></i> 現有報名清單</button>
        </div>
      </div>

      <div id="grouping-results" style="display: none;">
        <h2><i class="ri-list-check"></i> 報名人員清單</h2>
        <div id="group-cards-container" style="display: flex; flex-direction: column; gap: 1.5rem;"></div>
      </div>
    `;

    document.getElementById('btn-import').addEventListener('click', this.handleImport.bind(this));
    document.getElementById('btn-grouping').addEventListener('click', this.handleGrouping.bind(this));
    document.getElementById('btn-load-reg').addEventListener('click', this.loadFromCloud.bind(this));
    
    // Check if we have data locally to display
    if(window.AppState && window.AppState.data.registrationList && window.AppState.data.registrationList.length > 0) {
       document.getElementById('btn-grouping').disabled = false;
       this.displayGroups(window.AppState.data.registrationList);
    }
  },

  async loadFromCloud() {
    const btn = document.getElementById('btn-load-reg');
    btn.disabled = true;
    btn.innerHTML = `<div class="spinner" style="width:14px;height:14px;border-width:2px;margin-right:6px;display:inline-block;vertical-align:middle;"></div> 讀取中...`;
    try {
      const data = await window.API.fetchSheet('registration');
      if (!data || data.length === 0) {
        window.showToast('Google Sheet 中尚無報名資料', 'warning');
        return;
      }
      window.AppState.data.registrationList = data;
      document.getElementById('btn-grouping').disabled = false;
      this.displayGroups(data);
      window.showToast(`已從雲端讀取 ${data.length} 筆報名資料`, 'success');
    } catch(e) {
      window.showToast('讀取失敗，請確認網路連線與 GAS 部署設定', 'danger');
    } finally {
      btn.disabled = false;
      btn.innerHTML = `<i class="ri-cloud-line"></i> 現有報名清單`;
    }
  },

  handleImport() {
    const rawData = document.getElementById('import-data').value.trim();
    if (!rawData) return window.showToast('請先貼上資料', 'warning');

    const lines = rawData.split('\n');
    let importedList = [];

    lines.forEach(line => {
      const parts = line.split(/[,\t]+/).map(p => p.trim());
      if (parts.length >= 3) {
        importedList.push({
          id: '',
          team: parts[0],
          name: parts[1],
          category: parts[2],
          groupCard: '' // 尚未分組
        });
      }
    });

    if (importedList.length === 0) return window.showToast('未能辨識任何資料格式', 'warning');

    window.AppState.data.registrationList = importedList;
    this.displayGroups(importedList);
    document.getElementById('btn-grouping').disabled = false;
    window.showToast('匯入名單預覽成功！可點擊右側按鈕進行自動分組', 'success');
  },

  async handleGrouping() {
    let list = window.AppState.data.registrationList;
    if (!list || list.length === 0) return;

    let teams = { '男雙': [], '女雙': [], '混雙': [] };
    list.forEach(t => {
      if (teams[t.category]) teams[t.category].push(t);
    });

    const colors = ['藍', '青', '黑', '粉'];
    let finalGrouped = [];

    // Grouping Logic: Max 12 teams -> 4 groups, 3 teams per group
    ['男雙', '女雙', '混雙'].forEach(cat => {
      const catTeams = teams[cat];
      catTeams.sort(() => Math.random() - 0.5); // shuffle teams
      
      let colorCounters = { '藍': 1, '青': 1, '黑': 1, '粉': 1 };
      
      catTeams.forEach((t, i) => {
        const c = colors[i % 4]; 
        t.groupCard = c;
        t.id = `${c}組${colorCounters[c]}`;
        colorCounters[c]++;
      });
      
      // 確保陣列按組別排序
      catTeams.sort((a,b) => colors.indexOf(a.groupCard) - colors.indexOf(b.groupCard));
      catTeams.forEach(t => finalGrouped.push(t));
    });

    window.showToast('正在執行分組並儲存至雲端...', 'info');
    const btn = document.getElementById('btn-grouping');
    btn.disabled = true;
    btn.innerHTML = `<div class="spinner" style="width:20px;height:20px;border-width:2px;margin-right:10px"></div> 處理中`;

    try {
      const res = await window.API.postAction('importRegistration', finalGrouped);
      window.AppState.data.registrationList = finalGrouped;
      this.displayGroups(finalGrouped);
      window.showToast('分組成功並寫入 Google Sheets！', 'success');
    } catch (e) {
      window.showToast('寫入失敗，請檢查網路連線', 'danger');
    } finally {
      btn.disabled = false;
      btn.innerHTML = `<i class="ri-magic-line"></i> 電腦抽籤重新分組並儲存`;
    }
  },

  displayGroups(list) {
    document.getElementById('grouping-results').style.display = 'block';
    const cardsContainer = document.getElementById('group-cards-container');
    cardsContainer.innerHTML = '';

    const colorClasses = {
      '藍': 'badge-blue', '青': 'badge-cyan', '黑': 'badge-black', '粉': 'badge-pink'
    };

    const rowBgColors = {
      '藍': 'rgba(59,130,246,0.15)',
      '青': 'rgba(6,182,212,0.15)',
      '黑': 'rgba(255,255,255,0.08)',
      '粉': 'rgba(236,72,153,0.15)',
      '': 'transparent'
    };

    ['男雙', '女雙', '混雙'].forEach(cat => {
      const catTeams = list.filter(t => t.category === cat);
      if (catTeams.length === 0) return;

      // 建立該類別的完整表格 (一列表示一類，帶有標題)
      let rows = catTeams.map(t => {
        let badgeHTML = t.groupCard 
          ? `<span class="badge ${colorClasses[t.groupCard] || 'badge-black'}">${t.groupCard}組</span>`
          : `<span class="badge" style="background:rgba(255,255,255,0.1); color:#aaa; border:1px solid rgba(255,255,255,0.2)">尚未分組</span>`;
          
        let bg = rowBgColors[t.groupCard] || 'transparent';

        return `
          <tr style="background: ${bg}; border-bottom: 1px solid var(--glass-border);">
            <td style="padding:1rem">${badgeHTML}</td>
            <td style="padding:1rem"><strong>${t.team}</strong></td>
            <td style="padding:1rem">${t.name}</td>
            <td style="padding:1rem;color:var(--text-secondary);font-family:monospace;">${t.id || '-'}</td>
          </tr>
        `;
      }).join('');

      const card = document.createElement('div');
      card.className = 'card table-wrapper';
      card.innerHTML = `
        <h3 style="margin-bottom: 1rem; color: #60a5fa; padding: 0 0.5rem;"><i class="ri-group-line"></i> ${cat}</h3>
        <table style="width:100%; border-collapse:collapse; font-size:1rem; text-align:left;">
          <thead>
            <tr>
              <th style="padding:1rem; border-bottom:1px solid var(--glass-border); width:20%">組別</th>
              <th style="padding:1rem; border-bottom:1px solid var(--glass-border); width:25%">隊名</th>
              <th style="padding:1rem; border-bottom:1px solid var(--glass-border); width:35%">姓名</th>
              <th style="padding:1rem; border-bottom:1px solid var(--glass-border); width:20%">編號</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      `;
      cardsContainer.appendChild(card);
    });
  }
};
