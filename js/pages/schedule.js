/**
 * schedule.js - 分頁 2: 預賽賽程表 (預賽紀錄表)
 */
window.SchedulePage = {
  render(container) {
    container.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 2rem; flex-wrap:wrap; gap:1rem;">
        <div>
          <h2><i class="ri-calendar-event-line"></i> 預賽賽程表</h2>
          <p style="color: var(--text-secondary);">基於分組名單產生對戰關卡 (A、B、C場地)，每場15分鐘</p>
        </div>
        <div style="display:flex; gap:0.75rem; flex-wrap:wrap;">
          <button id="btn-refresh-schedule" class="btn" style="background:linear-gradient(135deg,#4b5563,#374151);">
            <i class="ri-refresh-line"></i> 更新比分資訊
          </button>
          <button id="btn-generate-schedule" class="btn"><i class="ri-ai-generate"></i> 產生賽程表</button>
        </div>
      </div>

      <div class="card table-wrapper" id="schedule-table-wrapper" style="display:none;">
        <table id="schedule-table">
          <thead>
            <tr>
              <th>輪次</th>
              <th>時間</th>
              <th>場地</th>
              <th>類別</th>
              <th>A隊</th>
              <th style="text-align:center;">比分</th>
              <th>B隊</th>
              <th style="text-align:center;">狀態</th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>
    `;

    document.getElementById('btn-generate-schedule').addEventListener('click', this.generateSchedule.bind(this));
    document.getElementById('btn-refresh-schedule').addEventListener('click', this.refreshFromCloud.bind(this));

    if (window.AppState && window.AppState.data.scheduleList.length > 0) {
      this.displaySchedule(window.AppState.data.scheduleList);
    }
  },

  async refreshFromCloud() {
    const btn = document.getElementById('btn-refresh-schedule');
    btn.disabled = true;
    btn.innerHTML = `<div class="spinner" style="width:16px;height:16px;border-width:2px;margin-right:8px;display:inline-block;vertical-align:middle;"></div> 更新中...`;
    try {
      const data = await window.API.fetchSheet('schedule');
      window.AppState.data.scheduleList = data;
      this.displaySchedule(data);
      window.showToast('比分資訊已更新！', 'success');
    } catch(e) {
      window.showToast('更新失敗，請確認網路連線', 'danger');
    } finally {
      btn.disabled = false;
      btn.innerHTML = `<i class="ri-refresh-line"></i> 更新比分資訊`;
    }
  },

  async generateSchedule() {
    let list = window.AppState.data.registrationList;
    if (!list || list.length === 0) {
      window.showToast('尚未有登錄的分組名單，請先至「報名」頁面匯入並分組', 'warning');
      return;
    }

    window.showToast('產生賽程中...', 'info');
    document.getElementById('btn-generate-schedule').disabled = true;

    let matches = [];
    ['男雙', '女雙', '混雙'].forEach(cat => {
      ['藍', '青', '黑', '粉'].forEach(color => {
        const groupTeams = list.filter(t => t.category === cat && t.groupCard === color);
        if (groupTeams.length === 3) {
          matches.push({ cat, color, tA: groupTeams[0], tB: groupTeams[1] });
          matches.push({ cat, color, tA: groupTeams[1], tB: groupTeams[2] });
          matches.push({ cat, color, tA: groupTeams[0], tB: groupTeams[2] });
        } else if (groupTeams.length === 2) {
          matches.push({ cat, color, tA: groupTeams[0], tB: groupTeams[1] });
        }
      });
    });

    let scheduledMatches = [];
    const courts = ['A', 'B', 'C'];
    let startTime = new Date();
    startTime.setHours(9, 0, 0, 0);
    let currentRoundIndex = 1;
    let courtIndex = 0;

    matches.forEach(m => {
      scheduledMatches.push({
        date: new Date().toISOString().split('T')[0],
        time: startTime.toTimeString().substring(0, 5),
        round: `R${currentRoundIndex}`,
        court: courts[courtIndex],
        category: `${m.cat}(${m.color}組)`,
        teamA: m.tA.team,
        teamANames: m.tA.name,
        scoreA: 0,
        teamB: m.tB.team,
        teamBNames: m.tB.name,
        scoreB: 0,
        matchStatus: '待賽'
      });

      courtIndex++;
      if (courtIndex >= courts.length) {
        courtIndex = 0;
        currentRoundIndex++;
        startTime.setMinutes(startTime.getMinutes() + 15);
      }
    });

    try {
      await window.API.postAction('generateSchedule', scheduledMatches);
      window.AppState.data.scheduleList = scheduledMatches;
      this.displaySchedule(scheduledMatches);
      window.showToast('賽程產生完畢並儲存！', 'success');
    } catch (e) {
      window.showToast('寫入失敗', 'danger');
    } finally {
      document.getElementById('btn-generate-schedule').disabled = false;
    }
  },

  displaySchedule(list) {
    document.getElementById('schedule-table-wrapper').style.display = 'block';
    const tbody = document.querySelector('#schedule-table tbody');

    const statusBadge = (s) => {
      const map = { '待賽': 'badge-black', '比賽中': 'badge-cyan', '完成比賽': 'badge-pink' };
      return `<span class="badge ${map[s] || 'badge-black'}" style="font-size:0.75rem;">${s || '待賽'}</span>`;
    };

    tbody.innerHTML = list.map(m => `
      <tr>
        <td><span class="badge ${m.round === 'R1' ? 'badge-pink' : 'badge-black'}">${m.round}</span></td>
        <td><i class="ri-time-line"></i> ${m.time}</td>
        <td><strong>Court ${m.court}</strong></td>
        <td style="font-size:0.85rem;">${m.category}</td>
        <td>
          ${m.teamA}<br/>
          <small style="color:var(--text-secondary)">${m.teamANames || ''}</small>
        </td>
        <td style="text-align:center; font-size:1.4rem; font-weight:700; white-space:nowrap;">
          <span style="color:#60a5fa">${m.scoreA ?? 0}</span>
          <span style="color:var(--text-secondary); font-size:1rem;"> : </span>
          <span style="color:#f472b6">${m.scoreB ?? 0}</span>
        </td>
        <td>
          ${m.teamB}<br/>
          <small style="color:var(--text-secondary)">${m.teamBNames || ''}</small>
        </td>
        <td style="text-align:center;">${statusBadge(m.matchStatus)}</td>
      </tr>
    `).join('');
  }
};
