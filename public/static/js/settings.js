/**
   NEXUS ENTERPRISE COGNITIVE PLATFORM — MODEL ROUTING & GOVERNANCE
   Manages multi-model switching (OpenAI, Gemini, Groq, Smart Local AI),
   temperature sliders, and secure API key storage.
 */

window.SettingsManager = {
  async init() {
    this.bindEvents();
    await this.fetchSettings();
  },

  bindEvents() {
    const form = document.getElementById('settings-form');
    const headerPill = document.getElementById('header-model-pill');
    const tempSlider = document.getElementById('setting-temperature');
    const tempDisplay = document.getElementById('temp-val-display');

    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.saveSettings();
      });
    }

    if (headerPill) {
      headerPill.addEventListener('click', () => {
        window.switchTab('settings');
      });
    }

    if (tempSlider && tempDisplay) {
      tempSlider.addEventListener('input', (e) => {
        tempDisplay.textContent = parseFloat(e.target.value).toFixed(2);
      });
    }

    // Model selection cards
    const modelCards = document.querySelectorAll('.model-card-radio');
    modelCards.forEach(card => {
      card.addEventListener('click', () => {
        modelCards.forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        const radio = card.querySelector('input[type="radio"]');
        if (radio) radio.checked = true;
      });
    });
  },

  async fetchSettings() {
    try {
      const res = await fetch('/api/settings');
      if (!res.ok) return;

      const data = await res.json();
      this.populateForm(data);
      this.updateHeaderPill(data.llm_provider);
    } catch (err) {
      console.warn('Failed to fetch settings:', err);
    }
  },

  populateForm(data) {
    const radios = document.querySelectorAll('input[name="llm_provider"]');
    radios.forEach(r => {
      if (r.value === data.llm_provider) {
        r.checked = true;
        const card = r.closest('.model-card-radio');
        if (card) {
          document.querySelectorAll('.model-card-radio').forEach(c => c.classList.remove('selected'));
          card.classList.add('selected');
        }
      }
    });

    const geminiInput = document.getElementById('setting-gemini-key');
    const openaiInput = document.getElementById('setting-openai-key');
    const groqInput = document.getElementById('setting-groq-key');
    const tempSlider = document.getElementById('setting-temperature');
    const tempDisplay = document.getElementById('temp-val-display');

    if (geminiInput && data.keys?.has_gemini) {
      geminiInput.placeholder = `Active & Verified (${data.keys.gemini_masked})`;
    }
    if (openaiInput && data.keys?.has_openai) {
      openaiInput.placeholder = `Active & Verified (${data.keys.openai_masked})`;
    }
    if (groqInput && data.keys?.has_groq) {
      groqInput.placeholder = `Active & Verified (${data.keys.groq_masked})`;
    }

    if (tempSlider && data.temperature !== undefined) {
      tempSlider.value = data.temperature;
      if (tempDisplay) tempDisplay.textContent = parseFloat(data.temperature).toFixed(2);
    }
  },

  async saveSettings() {
    const providerInput = document.querySelector('input[name="llm_provider"]:checked');
    const provider = providerInput ? providerInput.value : 'smart_local';

    const geminiKey = document.getElementById('setting-gemini-key')?.value.trim();
    const openaiKey = document.getElementById('setting-openai-key')?.value.trim();
    const groqKey = document.getElementById('setting-groq-key')?.value.trim();
    const temperature = parseFloat(document.getElementById('setting-temperature')?.value || '0.2');

    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          llm_provider: provider,
          gemini_api_key: geminiKey || null,
          openai_api_key: openaiKey || null,
          groq_api_key: groqKey || null,
          temperature: temperature,
        }),
      });

      if (!res.ok) throw new Error('Failed to save settings');

      this.updateHeaderPill(provider);
      showToast('AI engine configuration saved successfully', 'success');
      await this.fetchSettings();
    } catch (err) {
      showToast(err.message, 'error');
    }
  },

  updateHeaderPill(provider) {
    const pillName = document.getElementById('header-model-name');
    if (!pillName) return;

    const names = {
      smart_local: 'Smart Local AI',
      openai: 'OpenAI GPT-4o',
      gemini: 'Gemini 2.0 Pro',
      groq: 'Groq Cloud (Llama 3)',
    };

    pillName.textContent = names[provider] || 'Smart Local AI';
  },
};
