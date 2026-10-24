/**
   NEXUS ENTERPRISE COGNITIVE PLATFORM — APPLICATION ORCHESTRATOR
   Handles Command Palette (Ctrl+K), Layout State, Theme Management, 
   Observability Telemetry, and Unified Routing.
 */

window.AppState = {
  currentUser: null,
  activeTab: 'chat',
  activeConversationId: null,
  documents: [],
  selectedDocScope: '',
  citationCache: {},
  workspace: 'Acme Global (Production)',
};

// Global Toast Notification System
window.showToast = function(message, type = 'info', duration = 3500) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast-pill`;

  let iconName = 'info';
  let iconColor = 'var(--primary-400)';
  if (type === 'success') {
    iconName = 'check-circle-2';
    iconColor = 'var(--status-emerald)';
  } else if (type === 'error') {
    iconName = 'alert-circle';
    iconColor = 'var(--status-rose)';
  }

  toast.innerHTML = `
    <i data-lucide="${iconName}" style="width: 16px; height: 16px; color: ${iconColor}; flex-shrink: 0;"></i>
    <span>${message}</span>
  `;

  container.appendChild(toast);
  if (window.lucide) lucide.createIcons({ root: toast });

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(12px)';
    toast.style.transition = 'all 0.25s ease';
    setTimeout(() => toast.remove(), 250);
  }, duration);
};

document.addEventListener('DOMContentLoaded', async () => {
  if (window.lucide) lucide.createIcons();

  setupTabs();
  setupSidebar();
  setupThemeToggle();
  setupCommandPalette();
  setupWorkspaceSwitcher();
  setupGlobalDragDrop();
  setupDialogLightDismiss();

  // Initialize Subsystem Managers
  await window.AuthManager.init();
  await window.DocumentsManager.init();
  await window.ChatManager.init();
  window.SearchManager.init();
  await window.SettingsManager.init();

  // Quick Load Demo Button in Header
  const quickLoadBtn = document.getElementById('quick-load-samples-btn');
  if (quickLoadBtn) {
    quickLoadBtn.addEventListener('click', async () => {
      await window.DocumentsManager.loadSampleDocs();
    });
  }

  // Load initial dashboard telemetry
  loadDashboardData();
});

/* --------------------------------------------------------------------------
   NAVIGATION & TAB ROUTING
   -------------------------------------------------------------------------- */
function setupTabs() {
  const navItems = document.querySelectorAll('.nav-menu-item');
  const pageTitle = document.getElementById('page-title');

  const titles = {
    chat: 'RAG Assistant',
    search: 'Discovery Studio',
    documents: 'Knowledge Repositories',
    dashboard: 'Observability & Analytics',
    security: 'Team & Security Center',
    settings: 'Model Routing & Governance',
  };

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const tabName = item.getAttribute('data-tab');
      if (!tabName) return;

      switchTab(tabName);
    });
  });

  window.switchTab = function(tabName) {
    window.AppState.activeTab = tabName;

    // Update active nav item
    navItems.forEach(i => {
      i.classList.toggle('active', i.getAttribute('data-tab') === tabName);
    });

    // Update view panels
    document.querySelectorAll('.tab-view').forEach(panel => {
      panel.classList.toggle('active', panel.id === `tab-${tabName}`);
    });

    // Update breadcrumb
    if (pageTitle && titles[tabName]) {
      pageTitle.textContent = titles[tabName];
    }

    if (window.lucide) lucide.createIcons();

    // Trigger tab-specific data refresh
    if (tabName === 'dashboard') {
      loadDashboardData();
    } else if (tabName === 'security') {
      loadSecurityData();
    } else if (tabName === 'documents') {
      window.DocumentsManager.fetchDocuments();
    }
  };
}

/* --------------------------------------------------------------------------
   SIDEBAR COLLAPSE
   -------------------------------------------------------------------------- */
function setupSidebar() {
  const sidebar = document.getElementById('sidebar');
  const toggleBtn = document.getElementById('sidebar-toggle-btn');

  if (toggleBtn && sidebar) {
    toggleBtn.addEventListener('click', () => {
      sidebar.classList.toggle('collapsed');
      const icon = toggleBtn.querySelector('i');
      if (icon) {
        if (sidebar.classList.contains('collapsed')) {
          icon.setAttribute('data-lucide', 'panel-right');
        } else {
          icon.setAttribute('data-lucide', 'panel-left');
        }
        if (window.lucide) lucide.createIcons({ root: toggleBtn });
      }
    });
  }
}

/* --------------------------------------------------------------------------
   THEME MANAGEMENT (Modern Web Guidance)
   -------------------------------------------------------------------------- */
function setupThemeToggle() {
  const btn = document.getElementById('theme-toggle-btn');
  const icon = document.getElementById('theme-toggle-icon');
  const meta = document.querySelector('meta[name="color-scheme"]');

  function updateIcon(currentScheme) {
    if (!icon) return;
    if (currentScheme === 'light') {
      icon.setAttribute('data-lucide', 'moon');
    } else {
      icon.setAttribute('data-lucide', 'sun');
    }
    if (window.lucide) lucide.createIcons({ root: btn });
  }

  // Initial check
  const current = meta ? meta.content : 'dark';
  updateIcon(current);

  if (btn) {
    btn.addEventListener('click', () => {
      const isDark = document.body.classList.contains('dark-theme') || 
                     (meta && meta.content === 'dark') || 
                     (!meta || meta.content === 'light dark');
      const nextTheme = isDark ? 'light' : 'dark';

      if (meta) meta.content = nextTheme;
      document.body.classList.toggle('light-theme', nextTheme === 'light');
      document.body.classList.toggle('dark-theme', nextTheme === 'dark');

      try {
        localStorage.setItem('color-scheme', nextTheme);
      } catch (e) {}

      updateIcon(nextTheme);
      showToast(`Switched to ${nextTheme} mode`, 'info', 2000);
    });
  }
}

/* --------------------------------------------------------------------------
   COMMAND PALETTE (CTRL+K)
   -------------------------------------------------------------------------- */
function setupCommandPalette() {
  const dialog = document.getElementById('command-palette-dialog');
  const trigger = document.getElementById('command-palette-trigger');
  const input = document.getElementById('command-palette-input');
  const resultsList = document.getElementById('command-results-list');

  if (!dialog) return;

  function openPalette() {
    dialog.showModal();
    if (input) {
      input.value = '';
      input.focus();
    }
    filterCommands('');
  }

  function closePalette() {
    dialog.close();
  }

  if (trigger) {
    trigger.addEventListener('click', openPalette);
  }

  // Keyboard shortcut Ctrl+K / Cmd+K and Ctrl+N
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      if (dialog.open) {
        closePalette();
      } else {
        openPalette();
      }
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
      e.preventDefault();
      window.ChatManager.startNewConversation();
      window.switchTab('chat');
    }
  });

  // Filter commands
  if (input) {
    input.addEventListener('input', (e) => {
      filterCommands(e.target.value.toLowerCase());
    });
  }

  function filterCommands(query) {
    const items = resultsList.querySelectorAll('.cmd-item');
    items.forEach(item => {
      const text = item.textContent.toLowerCase();
      item.style.display = text.includes(query) ? 'flex' : 'none';
    });
  }

  // Command item execution
  resultsList.addEventListener('click', (e) => {
    const item = e.target.closest('.cmd-item');
    if (!item) return;

    const action = item.getAttribute('data-action');
    closePalette();

    if (action === 'new-chat') {
      window.ChatManager.startNewConversation();
      window.switchTab('chat');
    } else if (action === 'goto-chat') {
      window.switchTab('chat');
    } else if (action === 'goto-search') {
      window.switchTab('search');
    } else if (action === 'goto-documents') {
      window.switchTab('documents');
    } else if (action === 'goto-dashboard') {
      window.switchTab('dashboard');
    } else if (action === 'goto-security') {
      window.switchTab('security');
    } else if (action === 'goto-settings') {
      window.switchTab('settings');
    } else if (action === 'load-samples') {
      window.DocumentsManager.loadSampleDocs();
    }
  });
}

/* --------------------------------------------------------------------------
   WORKSPACE SWITCHER
   -------------------------------------------------------------------------- */
function setupWorkspaceSwitcher() {
  const btn = document.getElementById('workspace-switcher-btn');
  const label = document.getElementById('active-workspace-name');
  if (!btn) return;

  const workspaces = [
    'Acme Global (Production)',
    'Legal & Compliance Vault',
    'FinTech & M&A Data Room',
    'SecOps & Architecture Sandbox',
  ];
  let currentIndex = 0;

  btn.addEventListener('click', () => {
    currentIndex = (currentIndex + 1) % workspaces.length;
    window.AppState.workspace = workspaces[currentIndex];
    if (label) label.textContent = workspaces[currentIndex].split(' ')[0] + ' ' + (workspaces[currentIndex].split(' ')[1] || '');
    showToast(`Switched active workspace to "${workspaces[currentIndex]}"`, 'success', 3000);
  });
}

/* --------------------------------------------------------------------------
   GLOBAL DRAG AND DROP
   -------------------------------------------------------------------------- */
function setupGlobalDragDrop() {
  const overlay = document.getElementById('global-drag-overlay');
  let counter = 0;

  window.addEventListener('dragenter', (e) => {
    e.preventDefault();
    counter++;
    if (overlay && e.dataTransfer && e.dataTransfer.types.includes('Files')) {
      overlay.style.display = 'flex';
      overlay.setAttribute('aria-hidden', 'false');
    }
  });

  window.addEventListener('dragleave', (e) => {
    e.preventDefault();
    counter--;
    if (counter <= 0 && overlay) {
      counter = 0;
      overlay.style.display = 'none';
      overlay.setAttribute('aria-hidden', 'true');
    }
  });

  window.addEventListener('dragover', (e) => e.preventDefault());

  window.addEventListener('drop', (e) => {
    e.preventDefault();
    counter = 0;
    if (overlay) {
      overlay.style.display = 'none';
      overlay.setAttribute('aria-hidden', 'true');
    }

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.name.toLowerCase().endsWith('.pdf')) {
        window.switchTab('documents');
        window.DocumentsManager.uploadFile(file);
      } else {
        showToast('Only PDF documents (.pdf) are supported in this vault.', 'error');
      }
    }
  });
}

/* --------------------------------------------------------------------------
   LIGHT DISMISS FALLBACK (Modern Web Guidance)
   -------------------------------------------------------------------------- */
function setupDialogLightDismiss() {
  const dialogs = document.querySelectorAll('dialog[closedby="any"]');
  dialogs.forEach(dialog => {
    if (!('closedBy' in HTMLDialogElement.prototype)) {
      dialog.addEventListener('click', (event) => {
        if (event.target !== dialog) return;
        const rect = dialog.getBoundingClientRect();
        const isDialogContent = (
          rect.top <= event.clientY &&
          event.clientY <= rect.top + rect.height &&
          rect.left <= event.clientX &&
          event.clientX <= rect.left + rect.width
        );
        if (!isDialogContent) {
          dialog.close();
        }
      });
    }
  });
}

/* --------------------------------------------------------------------------
   OBSERVABILITY & ANALYTICS TELEMETRY LOADER
   -------------------------------------------------------------------------- */
async function loadDashboardData() {
  try {
    const res = await fetch('/api/analytics/overview');
    if (!res.ok) return;

    const data = await res.json();
    if (data.kpis) {
      const k = data.kpis;
      const qEl = document.getElementById('kpi-total-queries');
      const tEl = document.getElementById('kpi-total-tokens');
      const cEl = document.getElementById('kpi-est-cost');
      const lEl = document.getElementById('kpi-latency');

      if (qEl) qEl.textContent = k.total_queries.toLocaleString();
      if (tEl) tEl.textContent = (k.total_tokens / 1000).toFixed(1) + 'k';
      if (cEl) cEl.textContent = '$' + k.est_cost_usd.toFixed(2);
      if (lEl) lEl.textContent = k.p95_latency_ms + 'ms';
    }

    // SIEM Audit Stream
    const auditStreamEl = document.getElementById('audit-log-stream');
    if (auditStreamEl && data.audit_logs) {
      auditStreamEl.innerHTML = data.audit_logs.map(log => `
        <div style="display: flex; gap: 8px; align-items: flex-start; padding: 6px 10px; background: var(--bg-elevated); border-radius: 6px;">
          <span style="color: var(--primary-400);">${log.timestamp}</span>
          <span style="color: var(--text-primary); font-weight: 500;">[${log.action}]</span>
          <span style="color: var(--text-secondary); flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${log.details}</span>
          <span style="color: var(--status-emerald); font-size: 10px; font-weight: 600;">${log.status}</span>
        </div>
      `).join('');
    }
  } catch (err) {
    console.warn('Dashboard data fetch error:', err);
  }
}

async function loadSecurityData() {
  try {
    const res = await fetch('/api/analytics/security');
    if (!res.ok) return;
    const data = await res.json();

    const tbody = document.getElementById('team-roster-body');
    if (tbody && data.team_members) {
      tbody.innerHTML = data.team_members.map(m => `
        <tr>
          <td style="font-weight: 500;">${m.name}</td>
          <td style="color: var(--text-muted);">${m.email}</td>
          <td><span class="nav-item-badge" style="background: ${m.role.includes('Admin') ? 'var(--primary-subtle)' : 'var(--bg-subtle)'}; color: ${m.role.includes('Admin') ? 'var(--primary-400)' : 'var(--text-secondary)'};">${m.role}</span></td>
          <td><span style="color: var(--status-emerald);">Enforced</span></td>
          <td>${m.last_active}</td>
        </tr>
      `).join('');
    }
  } catch (err) {
    console.warn('Security data fetch error:', err);
  }
}
