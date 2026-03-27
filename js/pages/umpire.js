/**
 * umpire.js - 分頁 5: 行動版裁判計分面板
 * 加減分時即時同步比分，完成比賽時變更狀態欄位。
 */
window.UmpirePage = {
  currentMatch: null,
  saveDebounceTimer: null,

  render(container) {
    container.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 1rem;">
        <h2><i class="ri-edit-box-line"></i> 裁判計分板</h2>
        <div style="display:flex; align-items:center; gap:0.75rem;">
          <span style="color:var(--text-secondary); font-size:0.85rem;"><i class="ri-time-line"></i> 載入時間約需 5~10 秒</span>
          <button id="btn-sync-umpire" class="btn"><i class="ri-refresh-line"></i> 載入賽事</button>
        </div>
      </div>

      <div class="card" style="margin-bottom: 1.5rem; padding: 1rem;">
        <label class="form-label">選擇您正在執法的賽事：</label>
        <select id="match-selector" class="form-control" style="font-size:1.1rem">
          <option value="">請先點擊上方載入賽事...</option>
        </select>
      </div>

      <div id="umpire-board" style="display:none;">
        <div style="display:flex; gap: 1rem; flex-direction: column;">

          <!-- Team A -->
          <div class="card" style="display:flex; justify-content:space-between; align-items:center; padding: 2rem;">
            <div style="flex:1">
              <h1 id="u-teamA" style="margin:0; font-size:2.5rem; color:#60a5fa;">Team A</h1>
            </div>
            <div style="display:flex; align-items:center; gap:1.5rem">
              <button class="btn-score" onclick="UmpirePage.changeScore('A', -1)">-</button>
              <div id="u-scoreA" style="font-size:5rem; font-weight:700; width:100px; text-align:center;">0</div>
              <button class="btn-score" onclick="UmpirePage.changeScore('A', 1)">+</button>
            </div>
          </div>

          <!-- Team B -->
          <div class="card" style="display:flex; justify-content:space-between; align-items:center; padding: 2rem;">
            <div style="flex:1">
              <h1 id="u-teamB" style="margin:0; font-size:2.5rem; color:#f472b6;">Team B</h1>
            </div>
            <div style="display:flex; align-items:center; gap:1.5rem">
              <button class="btn-score" onclick="UmpirePage.changeScore('B', -1)">-</button>
              <div id="u-scoreB" style="font-size:5rem; font-weight:700; width:100px; text-align:center;">0</div>
              <button class="btn-score" onclick="UmpirePage.changeScore('B', 1)">+</button>
            </div>
          </div>

          <div style="display:flex; gap:1rem; margin-top:1rem; align-items:center;">
            <span id="sync-status" style="color:var(--text-secondary); font-size:0.9rem; flex:1">
              <i class="ri-information-line"></i> 加減分時會即時同步至雲端
            </span>
            <button id="btn-save-score" class="btn" style="padding:1.2rem 2rem; font-size:1.3rem; background:linear-gradient(135deg, #10b981, #059669)">
              <i class="ri-flag-2-line"></i> 完成比賽
            </button>
          </div>
        </div>
      </div>

      <style>
        .btn-score {
          width: 80px; height: 80px; border-radius: 50%;
          border: 2px solid var(--glass-border);
          background: rgba(255,255,255,0.05); color: #fff;
          font-size: 3rem; cursor: pointer; transition: all 0.2s;
        }
        .btn-score:active { background: rgba(255,255,255,0.2); transform: scale(0.95); }
        @media (max-width: 768px) {
          .btn-score { width: 60px; height: 60px; font-size: 2rem; }
          #u-teamA, #u-teamB { font-size: 1.5rem !important; }
          #u-scoreA, #u-scoreB { font-size: 3.5rem !important; width: 70px !important; }
        }
      </style>
    `;

    document.getElementById('btn-sync-umpire').addEventListener('click', this.loadMatches.bind(this));
    document.getElementById('match-selector').addEventListener('change', this.selectMatch.bind(this));
    document.getElementById('btn-save-score').addEventListener('click', this.completeMatch.bind(this));
  },

  async loadMatches() {
    window.showToast('取得賽程中...', 'info');
    try {
      const data = await window.API.fetchSheet('schedule');
      window.AppState.data.scheduleList = data;

      const sel = document.getElementById('match-selector');
      sel.innerHTML = '<option value="">-- 請選擇賽事 --</option>';
      data.forEach((m, idx) => {
        sel.innerHTML += `<option value="${idx}">場地 ${m.court} | ${m.round} | ${m.teamA}(${m.teamANames || ''}) vs ${m.teamB}(${m.teamBNames || ''})</option>`;
      });
      window.showToast('賽事載入完畢', 'success');
    } catch(e) {
      window.showToast('無法取得賽程', 'danger');
    }
  },

  selectMatch(e) {
    const idx = e.target.value;
    if (idx === '') {
      document.getElementById('umpire-board').style.display = 'none';
      return;
    }
    const match = window.AppState.data.scheduleList[idx];
    this.currentMatch = { ...match };
    this.currentMatch.scoreA = parseInt(match.scoreA) || 0;
    this.currentMatch.scoreB = parseInt(match.scoreB) || 0;

    document.getElementById('u-teamA').innerHTML = `${match.teamA}<br><small style="font-size:0.9rem;font-weight:400;color:var(--text-secondary)">${match.teamANames || ''}</small>`;
    document.getElementById('u-teamB').innerHTML = `${match.teamB}<br><small style="font-size:0.9rem;font-weight:400;color:var(--text-secondary)">${match.teamBNames || ''}</small>`;
    this.updateUI();
    document.getElementById('umpire-board').style.display = 'block';
  },

  changeScore(team, delta) {
    if (!this.currentMatch) return;
    if (team === 'A') {
      this.currentMatch.scoreA = Math.max(0, this.currentMatch.scoreA + delta);
    } else {
      this.currentMatch.scoreB = Math.max(0, this.currentMatch.scoreB + delta);
    }
    this.updateUI();
    // 防抖動：0.5 秒後送出比分（快速連按只會送一次）
    this.debouncedSave('比賽中');
  },

  debouncedSave(status) {
    const el = document.getElementById('sync-status');
    if (el) el.innerHTML = `<i class="ri-loader-4-line"></i> 同步中...`;
    clearTimeout(this.saveDebounceTimer);
    this.saveDebounceTimer = setTimeout(() => this._doSave(status), 500);
  },

  async _doSave(status) {
    if (!this.currentMatch) return;
    const el = document.getElementById('sync-status');
    try {
      await window.API.postAction('updateScore', {
        criteria: {
          round: this.currentMatch.round,
          court: this.currentMatch.court,
          category: this.currentMatch.category
        },
        scoreA: this.currentMatch.scoreA,
        scoreB: this.currentMatch.scoreB,
        matchStatus: status
      });
      if (el) {
        el.innerHTML = status === '比賽中'
          ? `<i class="ri-check-line" style="color:#10b981"></i> 已同步：${this.currentMatch.scoreA} : ${this.currentMatch.scoreB}`
          : `<i class="ri-flag-2-line" style="color:#f59e0b"></i> 比賽已完成並記錄`;
      }
    } catch(e) {
      if (el) el.innerHTML = `<i class="ri-error-warning-line" style="color:#ef4444"></i> 同步失敗`;
    }
  },

  updateUI() {
    if (!this.currentMatch) return;
    document.getElementById('u-scoreA').innerText = this.currentMatch.scoreA;
    document.getElementById('u-scoreB').innerText = this.currentMatch.scoreB;
  },

  async completeMatch() {
    if (!this.currentMatch) return;
    clearTimeout(this.saveDebounceTimer);
    const btn = document.getElementById('btn-save-score');
    btn.disabled = true;
    btn.innerHTML = `<i class="ri-loader-4-line"></i> 儲存中...`;
    await this._doSave('完成比賽');
    btn.disabled = false;
    btn.innerHTML = `<i class="ri-flag-2-line"></i> 完成比賽`;
    window.showToast('比賽已完成並記錄！', 'success');
  }
};
