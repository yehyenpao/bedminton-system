/**
 * live-score.js - 分頁 4: 即時分數面板
 */
window.LiveScorePage = {
  pollingInterval: null,

  render(container) {
    container.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 2rem;">
        <h2><i class="ri-tv-line"></i> A、B、C 場地即時戰況</h2>
        <span class="badge badge-cyan" id="live-status"><i class="ri-signal-tower-line"></i> 連線更新中...</span>
      </div>
      <div id="live-courts-container" class="grid-3">
        ${this.buildEmptyCourt('A')}
        ${this.buildEmptyCourt('B')}
        ${this.buildEmptyCourt('C')}
      </div>
    `;

    this.fetchAndUpdate();
    // Start polling every 10 seconds
    this.pollingInterval = setInterval(this.fetchAndUpdate.bind(this), 10000);
  },

  // Lifecycle override if router unmounts (requires custom cleanup in router normally, we will just ensure safe polling)
  cleanup() {
    if (this.pollingInterval) clearInterval(this.pollingInterval);
  },

  buildEmptyCourt(courtName) {
    return `
      <div class="card" id="court-${courtName}" style="text-align:center; padding: 3rem 1rem;">
        <h1 style="color: var(--accent-color); font-size:3rem; margin-bottom:0.5rem">COURT ${courtName}</h1>
        <p style="color: var(--text-secondary)">等待比賽開始...</p>
      </div>
    `;
  },

  async fetchAndUpdate() {
    try {
      const data = await window.API.fetchSheet('schedule');
      if (data && data.length > 0) {
        window.AppState.data.scheduleList = data;
        this.updateCourts(data);
      }
    } catch(e) {
      console.error("Live update failed", e);
    }
  },

  updateCourts(schedule) {
    ['A', 'B', 'C'].forEach(court => {
      const courtMatches = schedule.filter(m => m.court === court);
      let activeMatch = courtMatches.find(m => parseInt(m.scoreA) < 21 && parseInt(m.scoreB) < 21);
      if (!activeMatch && courtMatches.length > 0) activeMatch = courtMatches[courtMatches.length - 1];

      const courtDiv = document.getElementById(`court-${court}`);
      if (activeMatch && courtDiv) {
        courtDiv.innerHTML = `
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
            <h2 style="color:#60a5fa; font-size:1.4rem; margin:0;">COURT ${court}</h2>
            <div style="display:flex; gap:0.4rem; flex-wrap:wrap; justify-content:flex-end;">
              <span class="badge ${activeMatch.round === 'R1' ? 'badge-pink':'badge-black'}" style="font-size:0.75rem;">${activeMatch.round}</span>
              <span class="badge badge-blue" style="font-size:0.75rem;">${activeMatch.category}</span>
            </div>
          </div>
          <div style="display:flex; justify-content:space-around; align-items:center;">
            <div style="width:42%; text-align:center;">
              <div style="font-size:1rem; font-weight:700; color:#fff;">${activeMatch.teamA}</div>
              <div style="font-size:0.78rem; color:var(--text-secondary); margin-bottom:0.4rem; min-height:1.1em;">${activeMatch.teamANames || ''}</div>
              <div style="font-size:3rem; font-weight:800; color:#60a5fa; line-height:1;">${activeMatch.scoreA || 0}</div>
            </div>
            <div style="font-size:1rem; color:var(--text-secondary);">VS</div>
            <div style="width:42%; text-align:center;">
              <div style="font-size:1rem; font-weight:700; color:#fff;">${activeMatch.teamB}</div>
              <div style="font-size:0.78rem; color:var(--text-secondary); margin-bottom:0.4rem; min-height:1.1em;">${activeMatch.teamBNames || ''}</div>
              <div style="font-size:3rem; font-weight:800; color:#f472b6; line-height:1;">${activeMatch.scoreB || 0}</div>
            </div>
          </div>
        `;
      }
    });
  }
};

// Hook into app.js hash router to cleanup polling
const originalHashChange = window.handleRoute;
window.addEventListener('hashchange', () => {
    if(window.location.hash !== '#live') {
      window.LiveScorePage.cleanup();
    }
});
