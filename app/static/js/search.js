/**
   NEXUS ENTERPRISE COGNITIVE PLATFORM — SEMANTIC DISCOVERY STUDIO
   Handles hybrid vector + lexical BM25 search, alpha ratio tuning,
   similarity confidence scoring, and 1-click citation handoff to chat.
 */

window.SearchManager = {
  init() {
    this.bindEvents();
  },

  bindEvents() {
    const form = document.getElementById('semantic-search-form');
    const alphaSlider = document.getElementById('search-alpha');
    const alphaLabel = document.getElementById('alpha-label');

    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.performSearch();
      });
    }

    if (alphaSlider && alphaLabel) {
      alphaSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        const densePct = Math.round(val * 100);
        const lexPct = 100 - densePct;
        alphaLabel.textContent = `${densePct}% Dense / ${lexPct}% Lexical`;
      });
    }
  },

  async performSearch() {
    const input = document.getElementById('semantic-search-input');
    const topKSelect = document.getElementById('search-top-k');
    const alphaSlider = document.getElementById('search-alpha');
    const resultsContainer = document.getElementById('search-results-list');
    const statsContainer = document.getElementById('search-results-stats');
    const countText = document.getElementById('results-count-text');
    const latencyText = document.getElementById('results-latency-text');

    if (!input) return;
    const query = input.value.trim();
    if (!query) {
      showToast('Please type a search query or concept', 'info');
      return;
    }

    const topK = parseInt(topKSelect ? topKSelect.value : '5');
    const alpha = parseFloat(alphaSlider ? alphaSlider.value : '0.7');

    if (resultsContainer) {
      resultsContainer.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--text-muted); font-size: 13px;">Computing 768d vector embeddings & BM25 hybrid ranking...</div>';
    }

    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: query,
          top_k: topK,
          alpha: alpha,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Search query failed');
      }

      const data = await res.json();

      if (statsContainer) statsContainer.style.display = 'block';
      if (countText) countText.textContent = `${data.total_results} matching passages`;
      if (latencyText) latencyText.textContent = `${data.execution_time_ms} ms latency`;

      if (!data.results || data.results.length === 0) {
        resultsContainer.innerHTML = `
          <div style="text-align: center; padding: 50px 20px; color: var(--text-muted);">
            <i data-lucide="search-x" style="width: 32px; height: 32px; margin-bottom: 8px;"></i>
            <h3>No matching passages found</h3>
            <p style="font-size: 13px;">Try adjusting the query or loading sample documents.</p>
          </div>
        `;
        if (window.lucide) lucide.createIcons({ root: resultsContainer });
        return;
      }

      resultsContainer.innerHTML = data.results.map(r => `
        <div class="search-result-card">
          <div class="result-card-header">
            <div class="result-doc-name">
              <i data-lucide="file-text" style="width: 15px; height: 15px; color: var(--primary-400);"></i>
              <span>${this.escapeHtml(r.filename)}</span>
              <span class="nav-item-badge" style="background: var(--bg-elevated); color: var(--text-muted);">Page ${r.page_number}</span>
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span class="citation-match-tag">${r.confidence_pct}% Match</span>
              <span style="font-size: 11px; font-family: var(--font-mono); color: var(--text-muted);">Score: ${r.similarity_score.toFixed(4)}</span>
            </div>
          </div>

          <div class="result-passage-body">
            ${this.highlightKeywords(r.text, query)}
          </div>

          <div style="display: flex; justify-content: flex-end; gap: 8px;">
            <button class="btn-secondary btn-sm cite-in-chat-btn" data-doc="${r.document_id}" data-text="${this.escapeHtml(r.text)}" data-name="${this.escapeHtml(r.filename)}">
              <i data-lucide="message-square-plus" style="width: 13px; height: 13px;"></i>
              <span>Ask AI About This Passage</span>
            </button>
          </div>
        </div>
      `).join('');

      if (window.lucide) lucide.createIcons({ root: resultsContainer });

      // Bind "Ask AI About This Passage"
      resultsContainer.querySelectorAll('.cite-in-chat-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const docId = btn.getAttribute('data-doc');
          const snippet = btn.getAttribute('data-text');
          const docName = btn.getAttribute('data-name');

          window.AppState.selectedDocScope = docId;
          window.DocumentsManager.updateChatDocChips(window.AppState.documents);
          window.switchTab('chat');

          const chatInput = document.getElementById('chat-input');
          if (chatInput) {
            chatInput.value = `Explain the following excerpt from ${docName}:\n\n"${snippet.slice(0, 240)}..."`;
            chatInput.style.height = 'auto';
            chatInput.style.height = Math.min(chatInput.scrollHeight, 180) + 'px';
            chatInput.focus();
          }
          showToast(`Prepared question about "${docName}" in chat`, 'success');
        });
      });

    } catch (err) {
      if (resultsContainer) {
        resultsContainer.innerHTML = `<div style="color: var(--status-rose); text-align: center; padding: 30px;">Search Error: ${err.message}</div>`;
      }
      showToast(err.message, 'error');
    }
  },

  highlightKeywords(text, query) {
    const safeText = this.escapeHtml(text);
    const words = query.split(/\s+/).filter(w => w.length > 2);
    if (words.length === 0) return safeText;

    const regex = new RegExp(`(${words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
    return safeText.replace(regex, '<mark style="background: rgba(99, 102, 241, 0.25); color: var(--primary-400); padding: 1px 3px; border-radius: 3px;">$1</mark>');
  },

  escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  },
};
