/**
 * bracket.js - 分頁 3: 籤表 (循環對戰圖)
 */
window.BracketPage = {
  render(container) {
    container.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 2rem;">
        <div>
          <h2><i class="ri-table-line"></i> 預賽循環籤表</h2>
          <p style="color: var(--text-secondary);">若兩隊積分相同比對戰勝負，三隊以上看總得分。勝=2分, 敗=1分。</p>
        </div>
        <button id="btn-refresh-bracket" class="btn"><i class="ri-refresh-line"></i> 重新載入最新資料</button>
      </div>
      <div id="bracket-container" class="grid-2"></div>
    `;

    document.getElementById('btn-refresh-bracket').addEventListener('click', this.loadData.bind(this));
    this.renderBrackets();
  },

  async loadData() {
    window.showToast('讀取最新賽程中...', 'info');
    try {
      const data = await window.API.fetchSheet('schedule');
      window.AppState.data.scheduleList = data;
      this.renderBrackets();
      window.showToast('已更新資料', 'success');
    } catch(e) {
      window.showToast('無最新資料', 'danger');
    }
  },

  renderBrackets() {
    const list = window.AppState.data.scheduleList || [];
    const container = document.getElementById('bracket-container');
    container.innerHTML = '';

    if (list.length === 0) {
      container.innerHTML = '<p>尚無賽程資料，請先產生賽程。</p>';
      return;
    }

    // 將賽程依 "類別" (如 男雙(藍組)) 分組
    let groups = {};
    list.forEach(m => {
      if(!groups[m.category]) groups[m.category] = [];
      groups[m.category].push(m);
    });

    for (let cat in groups) {
      const matches = groups[cat];
      
      // 找出該組伍的所有隊伍名稱
      let teamNames = new Set();
      matches.forEach(m => { teamNames.add(m.teamA); teamNames.add(m.teamB); });
      let teams = Array.from(teamNames);
      
      // 若只有兩隊或三隊
      let matrixHTML = this.generateMatrix(teams, matches);

      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `
        <h3 style="margin-bottom:1rem;">${cat}</h3>
        <div class="table-wrapper">
          <table style="text-align:center;">
            ${matrixHTML}
          </table>
        </div>
      `;
      container.appendChild(card);
    }
  },

  generateMatrix(teams, matches) {
    // 初始化成績物件
    let stats = {};
    teams.forEach(t => stats[t] = { pts: 0, totalScore: 0 });

    // 建立 隊伍x隊伍 的比分查表矩陣
    let lookup = {};
    matches.forEach(m => {
      if(!lookup[m.teamA]) lookup[m.teamA] = {};
      if(!lookup[m.teamB]) lookup[m.teamB] = {};
      
      let sA = parseInt(m.scoreA) || 0;
      let sB = parseInt(m.scoreB) || 0;

      lookup[m.teamA][m.teamB] = `${sA}:${sB}`;
      lookup[m.teamB][m.teamA] = `${sB}:${sA}`;

      // 計算積分 (超過0分代表有打，此處僅簡單判定有打贏給2分打輸給1分，若都是0當作未開打)
      if(sA > 0 || sB > 0) {
        if(sA > sB) {
          stats[m.teamA].pts += 2;
          stats[m.teamB].pts += 1;
        } else if (sB > sA) {
          stats[m.teamB].pts += 2;
          stats[m.teamA].pts += 1;
        } else {
          // 平手
          stats[m.teamA].pts += 1;
          stats[m.teamB].pts += 1;
        }
      }
      stats[m.teamA].totalScore += sA;
      stats[m.teamB].totalScore += sB;
    });

    let headerRow = `<tr><th>隊名</th>` + teams.map(t => `<th>${t.substring(0,4)}</th>`).join('') + `<th>積分</th></tr>`;
    
    let bodyRows = teams.map(t1 => {
      let cells = teams.map(t2 => {
        if(t1 === t2) return `<td style="background:rgba(255,255,255,0.05)">-</td>`;
        let scoreStr = lookup[t1] && lookup[t1][t2] ? lookup[t1][t2] : '';
        return `<td>${scoreStr}</td>`;
      }).join('');
      
      return `<tr>
        <td style="text-align:left"><strong>${t1}</strong></td>
        ${cells}
        <td><strong>${stats[t1].pts}</strong><br/><small style="color:var(--text-secondary);font-size:0.75rem">${stats[t1].totalScore}分</small></td>
      </tr>`;
    }).join('');

    return `<thead>${headerRow}</thead><tbody>${bodyRows}</tbody>`;
  }
};
