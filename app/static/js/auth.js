/**
 * Authentication and User Session Manager
 */
window.AuthManager = {
  isRegisterMode: false,

  async init() {
    this.bindEvents();
    await this.checkAuth();
  },

  bindEvents() {
    const authBtn = document.getElementById('auth-action-btn');
    const authModal = document.getElementById('auth-modal');
    const closeBtn = document.getElementById('close-auth-modal-btn');
    const toggleModeBtn = document.getElementById('auth-toggle-mode-btn');
    const guestBtn = document.getElementById('guest-login-btn');
    const authForm = document.getElementById('auth-form');

    if (authBtn) {
      authBtn.addEventListener('click', () => {
        if (window.AppState.currentUser) {
          // Confirm logout
          this.logout();
        } else {
          this.openModal(false);
        }
      });
    }

    if (closeBtn && authModal) {
      closeBtn.addEventListener('click', () => authModal.close());
    }

    if (toggleModeBtn) {
      toggleModeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.toggleMode(!this.isRegisterMode);
      });
    }

    if (guestBtn) {
      guestBtn.addEventListener('click', async () => {
        await this.loginGuest();
      });
    }

    if (authForm) {
      authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.handleFormSubmit();
      });
    }
  },

  openModal(registerMode = false) {
    const modal = document.getElementById('auth-modal');
    if (!modal) return;
    this.toggleMode(registerMode);
    modal.showModal();
  },

  toggleMode(register) {
    this.isRegisterMode = register;
    const title = document.getElementById('auth-modal-title');
    const submitBtn = document.getElementById('auth-submit-btn');
    const switchText = document.getElementById('auth-switch-text');
    const toggleBtn = document.getElementById('auth-toggle-mode-btn');
    const fullnameGroup = document.getElementById('auth-fullname-group');
    const emailGroup = document.getElementById('auth-email-group');

    if (register) {
      title.textContent = 'Create Enterprise Account';
      submitBtn.querySelector('span').textContent = 'Register Account';
      switchText.textContent = 'Already have an account?';
      toggleBtn.textContent = 'Sign In';
      fullnameGroup.style.display = 'block';
      emailGroup.style.display = 'block';
    } else {
      title.textContent = 'Sign In to Nexus RAG';
      submitBtn.querySelector('span').textContent = 'Sign In';
      switchText.textContent = "Don't have an account?";
      toggleBtn.textContent = 'Register New Account';
      fullnameGroup.style.display = 'none';
      emailGroup.style.display = 'none';
    }
  },

  async checkAuth() {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const user = await res.json();
        this.setUser(user);
      } else {
        // If no active session, auto-login as guest for seamless employer evaluation
        await this.loginGuest(true);
      }
    } catch (err) {
      console.warn('Auth check error:', err);
    }
  },

  async loginGuest(silent = false) {
    try {
      const res = await fetch('/api/auth/guest', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        this.setUser(data.user);
        const modal = document.getElementById('auth-modal');
        if (modal && modal.open) modal.close();
        if (!silent) {
          showToast('Signed in as Guest Evaluator. Full features unlocked!', 'success');
        }
        // Refresh documents & chat for this user
        window.DocumentsManager.fetchDocuments();
        window.ChatManager.loadConversations();
      }
    } catch (err) {
      showToast('Guest login failed: ' + err.message, 'error');
    }
  },

  async handleFormSubmit() {
    const username = document.getElementById('auth-username').value.trim();
    const password = document.getElementById('auth-password').value;
    const email = document.getElementById('auth-email').value.trim();
    const fullname = document.getElementById('auth-fullname').value.trim();

    try {
      let endpoint = '/api/auth/login';
      let payload = { username_or_email: username, password: password };

      if (this.isRegisterMode) {
        endpoint = '/api/auth/register';
        payload = {
          username: username,
          email: email,
          password: password,
          full_name: fullname || username,
        };
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Authentication failed');
      }

      this.setUser(data.user);
      const modal = document.getElementById('auth-modal');
      if (modal) modal.close();

      showToast(this.isRegisterMode ? 'Account registered successfully!' : 'Signed in successfully!', 'success');
      window.DocumentsManager.fetchDocuments();
      window.ChatManager.loadConversations();
    } catch (err) {
      showToast(err.message, 'error');
    }
  },

  async logout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      window.AppState.currentUser = null;
      showToast('Logged out. Logging into demo evaluator mode...', 'info');
      await this.loginGuest(true);
    } catch (err) {
      showToast('Logout error: ' + err.message, 'error');
    }
  },

  setUser(user) {
    window.AppState.currentUser = user;
    const nameEl = document.getElementById('user-display-name');
    const roleEl = document.getElementById('user-role-badge');
    const avatarEl = document.getElementById('user-avatar-initials');
    const authIcon = document.getElementById('auth-action-icon');

    if (nameEl) nameEl.textContent = user.full_name || user.username;
    if (roleEl) roleEl.textContent = user.is_guest ? 'Evaluator Demo' : 'Enterprise User';

    if (avatarEl) {
      const name = user.full_name || user.username || 'EX';
      const initials = name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();
      avatarEl.textContent = initials;
    }

    if (authIcon) {
      authIcon.setAttribute('data-lucide', user.is_guest ? 'log-in' : 'log-out');
      if (window.lucide) lucide.createIcons();
    }
  },
};
