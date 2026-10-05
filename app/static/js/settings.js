/**
 * Engine and Model Settings Manager
 */
window.SettingsManager = {
  async init() {
    this.bindEvents();
    await this.fetchSettings();
  },

  bindEvents() {
    const form = document.getElementById('settings-form');
    const pill = document.getElementById('engine-status-pill');

    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.saveSettings();
      });
    }

    if (pill) {
      pill.addEventListener('click', () => {
        // Switch to settings tab
        const settingsTab = document.querySelector('.nav-item[data-tab="settings"]');
        if (settingsTab) settingsTab.click();
      });
    }
  },

  async fetchSettings() {
    try {
      const res = await fetch('/api/settings');
      if (!res.ok) return;

      const data = await res.json();
      this.populateForm(data);
      this.updateStatusPill(data.llm_provider);
    } catch (err) {
      console.warn('Failed to fetch settings:', err);
    }
  },

  populateForm(data) {
    // Select radio button
    const radios = document.querySelectorAll('input[name="llm_provider"]');
    radios.forEach(r => {
      if (r.value === data.llm_provider) {
        r.checked = true;
      }
    });

    const geminiInput = document.getElementById('setting-gemini-key');
    const openaiInput = document.getElementById('setting-openai-key');
    const groqInput = document.getElementById('setting-groq-key');
    const topKInput = document.getElementById('setting-top-k');
    const embedSelect = document.getElementById('setting-embed-provider');

    if (geminiInput && data.keys?.has_gemini) {
      geminiInput.placeholder = `Configured (${data.keys.gemini_masked})`;
    }
    if (openaiInput && data.keys?.has_openai) {
      openaiInput.placeholder = `Configured (${data.keys.openai_masked})`;
    }
    if (groqInput && data.keys?.has_groq) {
      groqInput.placeholder = `Configured (${data.keys.groq_masked})`;
    }

    if (topKInput && data.top_k) {
      topKInput.value = data.top_k;
    }
    if (embedSelect && data.embedding_provider) {
      embedSelect.value = data.embedding_provider;
    }
  },

  async saveSettings() {
    const providerInput = document.querySelector('input[name="llm_provider"]:checked');
    const provider = providerInput ? providerInput.value : 'smart_local';

    const geminiKey = document.getElementById('setting-gemini-key')?.value.trim();
    const openaiKey = document.getElementById('setting-openai-key')?.value.trim();
    const groqKey = document.getElementById('setting-groq-key')?.value.trim();
    const topK = parseInt(document.getElementById('setting-top-k')?.value || '4');
    const embedProvider = document.getElementById('setting-embed-provider')?.value || 'local_dense';

    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          llm_provider: provider,
          gemini_api_key: geminiKey || null,
          openai_api_key: openaiKey || null,
          groq_api_key: groqKey || null,
          embedding_provider: embedProvider,
          top_k: topK,
        }),
      });

      if (!res.ok) throw new Error('Failed to save settings');

      showToast('Engine settings updated successfully', 'success');
      this.updateStatusPill(provider);
      await this.fetchSettings();
    } catch (err) {
      showToast(err.message, 'error');
    }
  },

  updateStatusPill(provider) {
    const pillText = document.getElementById('engine-status-name');
    if (!pillText) return;

    const names = {
      smart_local: 'Smart Local Engine',
      gemini: 'Gemini 1.5 Flash',
      openai: 'OpenAI GPT-4o Mini',
      groq: 'Groq Llama 3.1',
    };

    pillText.textContent = names[provider] || provider;
  }
};
