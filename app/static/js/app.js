/**
 * Nexus RAG - Enterprise Assistant Application Orchestrator
 */

// Global State
window.AppState = {
  currentUser: null,
  activeTab: 'chat',
  activeConversationId: null,
  documents: [],
  selectedDocScope: '',
  citationCache: {},
};

// Toast Notification Manager
window.showToast = function(message, type = 'info', duration = 4000) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  let iconName = 'info';
  if (type === 'success') iconName = 'check-circle';
  if (type === 'error') iconName = 'alert-circle';

  toast.innerHTML = `
    <i data-lucide="${iconName}"></i>
    <span>${message}</span>
  `;

  container.appendChild(toast);
  if (window.lucide) lucide.createIcons({ root: toast });

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(40px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, duration);
};

// DOM Content Loaded Initializer
document.addEventListener('DOMContentLoaded', async () => {
  // Initialize Lucide icons
  if (window.lucide) lucide.createIcons();

  // Tab Navigation Setup
  setupTabs();

  // Sidebar toggle
  setupSidebar();

  // Theme toggle
  setupThemeToggle();

  // Initialize Auth
  await window.AuthManager.init();

  // Initialize Documents
  await window.DocumentsManager.init();

  // Initialize Chat & History
  await window.ChatManager.init();

  // Initialize Search
  window.SearchManager.init();

  // Initialize Settings
  await window.SettingsManager.init();

  // Quick Sample Docs Button in Topbar
  const quickLoadBtn = document.getElementById('quick-load-samples-btn');
  if (quickLoadBtn) {
    quickLoadBtn.addEventListener('click', async () => {
      await window.DocumentsManager.loadSampleDocs();
    });
  }
});

function setupTabs() {
  const navItems = document.querySelectorAll('.nav-item');
  const panels = document.querySelectorAll('.tab-panel');
  const pageTitle = document.getElementById('page-title');

  const titles = {
    chat: 'Chat with Documents',
    search: 'Semantic Search',
    documents: 'Knowledge Base',
    settings: 'Engine Settings',
  };

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const tabName = item.getAttribute('data-tab');
      if (!tabName) return;

      navItems.forEach(n => n.classList.remove('active'));
      item.classList.add('active');

      panels.forEach(p => p.classList.remove('active'));
      const activePanel = document.getElementById(`tab-${tabName}`);
      if (activePanel) activePanel.classList.add('active');

      window.AppState.activeTab = tabName;
      if (pageTitle && titles[tabName]) {
        pageTitle.textContent = titles[tabName];
      }

      // If switching to documents or search, refresh views
      if (tabName === 'documents') {
        window.DocumentsManager.fetchDocuments();
      }
    });
  });
}

function setupSidebar() {
  const sidebar = document.getElementById('sidebar');
  const toggleBtn = document.getElementById('sidebar-toggle-btn');
  const mobileToggle = document.getElementById('sidebar-mobile-toggle');

  if (toggleBtn && sidebar) {
    toggleBtn.addEventListener('click', () => {
      sidebar.classList.toggle('collapsed');
      const icon = toggleBtn.querySelector('i');
      if (icon) {
        if (sidebar.classList.contains('collapsed')) {
          icon.setAttribute('data-lucide', 'panel-left-open');
        } else {
          icon.setAttribute('data-lucide', 'panel-left-close');
        }
        if (window.lucide) lucide.createIcons({ root: toggleBtn });
      }
    });
  }

  if (mobileToggle && sidebar) {
    mobileToggle.addEventListener('click', () => {
      sidebar.classList.toggle('mobile-open');
    });
  }
}

function setupThemeToggle() {
  const btn = document.getElementById('theme-toggle-btn');
  if (!btn) return;

  btn.addEventListener('click', () => {
    document.body.classList.toggle('light-theme');
    document.body.classList.toggle('dark-theme');

    const isLight = document.body.classList.contains('light-theme');
    const icon = btn.querySelector('i');
    if (icon) {
      icon.setAttribute('data-lucide', isLight ? 'moon' : 'sun');
      if (window.lucide) lucide.createIcons({ root: btn });
    }
  });
}
