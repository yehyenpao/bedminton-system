/**
 * app.js - Main Application Logic & Routing
 */

// Global App State
const AppState = {
  data: {
    registrationList: [],   // from "報名"
    scheduleList: []        // from "預賽紀錄表"
  },
  routes: {
    'registration': window.RegistrationPage,
    'schedule': window.SchedulePage,
    'bracket': window.BracketPage,
    'live': window.LiveScorePage,
    'umpire': window.UmpirePage
  }
};
window.AppState = AppState;

// Route Handler
function handleRoute() {
  const hash = window.location.hash.slice(1) || 'registration';
  const mainContent = document.getElementById('main-content');
  
  // Update Navigation Active State
  document.querySelectorAll('.nav-links a').forEach(link => {
    link.classList.remove('active');
    if(link.getAttribute('href') === `#${hash}`) {
      link.classList.add('active');
    }
  });

  // Basic Page Container
  mainContent.innerHTML = `<div class="page-container" id="page-${hash}"></div>`;
  const container = document.getElementById(`page-${hash}`);

  // Dynamic Route Rendering
  if (AppState.routes[hash] && typeof AppState.routes[hash].render === 'function') {
    AppState.routes[hash].render(container);
  } else {
    container.innerHTML = `<div class="card"><h2>404 - 找不到頁面</h2><p>模組 ${hash} 即將完成開發...</p></div>`;
  }
}

// Initializer
document.addEventListener('DOMContentLoaded', () => {
  // Listen for hash changes
  window.addEventListener('hashchange', handleRoute);
  
  // Expose global notification utility
  window.showToast = (msg, type='info') => {
    console.log(`[${type.toUpperCase()}] ${msg}`);
    // A simple toast could be added to DOM here
    alert(msg); // fallback for now
  };

  // Route the initial page load
  handleRoute();
});
