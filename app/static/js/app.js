/**
 * Nexus RAG - Modern & Kid-Friendly Application Orchestrator
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
window.showToast = function(message, type = 'info', duration = 3500) {
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

  // Global Drag & Drop Overlay Setup
  setupGlobalDragDrop();

  // Wire up quick upload triggers to the hidden file input
  setupQuickUploadButtons();

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

function setupGlobalDragDrop() {
  const overlay = document.getElementById('global-drag-overlay');
  let dragCounter = 0;

  window.addEventListener('dragenter', (e) => {
    e.preventDefault();
    dragCounter++;
    if (overlay && e.dataTransfer && e.dataTransfer.types.includes('Files')) {
      overlay.classList.add('active');
      overlay.setAttribute('aria-hidden', 'false');
    }
  });

  window.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dragCounter--;
    if (dragCounter <= 0 && overlay) {
      dragCounter = 0;
      overlay.classList.remove('active');
      overlay.setAttribute('aria-hidden', 'true');
    }
  });

  window.addEventListener('dragover', (e) => {
    e.preventDefault();
  });

  window.addEventListener('drop', (e) => {
    e.preventDefault();
    dragCounter = 0;
    if (overlay) {
      overlay.classList.remove('active');
      overlay.setAttribute('aria-hidden', 'true');
    }

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.name.toLowerCase().endsWith('.pdf')) {
        window.DocumentsManager.uploadFile(file);
      } else {
        showToast('Please drop a PDF document (.pdf)', 'error');
      }
    }
  });
}

function setupQuickUploadButtons() {
  const fileInput = document.getElementById('pdf-file-input');
  if (!fileInput) return;

  const triggerIds = [
    'topbar-upload-btn',
    'sidebar-upload-btn',
    'welcome-upload-trigger',
    'chat-attach-btn',
    'chat-add-doc-chip-btn',
  ];

  triggerIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        fileInput.click();
      });
    }
  });
}

function setupTabs() {
  const navItems = document.querySelectorAll('.nav-item');
  const panels = document.querySelectorAll('.tab-panel');
  const pageTitle = document.getElementById('page-title');

  const titles = {
    chat: 'Chat with Documents',
    search: 'Sentence Search',
    documents: 'My PDF Library',
    settings: 'AI Models & Settings',
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
