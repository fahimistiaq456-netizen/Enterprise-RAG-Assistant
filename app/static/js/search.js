/**
 * Semantic & Hybrid Vector Search Explorer
 */
window.SearchManager = {
  init() {
    this.bindEvents();
  },

  bindEvents() {
    const form = document.getElementById('semantic-search-form');
    const alphaSlider = document.getElementById('search-alpha');
    const alphaDisplay = document.getElementById('alpha-val-display');

    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.executeSearch();
      });
    }

    if (alphaSlider && alphaDisplay) {
      alphaSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        const vectorPct = Math.round(val * 100);
        const keywordPct = 100 - vectorPct;
        alphaDisplay.textContent = `${vectorPct}% Vector / ${keywordPct}% Keyword`;
      });
    }
  },

  async executeSearch() {
    const input = document.getElementById('semantic-search-input');
    const topKSelect = document.getElementById('search-top-k');
    const alphaSlider = document.getElementById('search-alpha');
    const resultsContainer = document.getElementById('search-results-list');
    const statsContainer = document.getElementById('search-results-stats');
    const countText = document.getElementById('results-count-text');
    const latencyText = document.getElementById('results-latency-text');

    if (!input || !resultsContainer) return;

    const query = input.value.trim();
    if (!query) {
      showToast('Please enter a search query', 'info');
      return;
    }

    const topK = parseInt(topKSelect?.value || '5');
    const alpha = parseFloat(alphaSlider?.value || '0.7');

    resultsContainer.innerHTML = '<div style="text-align:center; padding: 40px; color: var(--text-muted);">Performing hybrid vector search...</div>';

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

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Search failed');

      if (statsContainer) statsContainer.style.display = 'flex';
      if (countText) countText.textContent = `${data.total_results} chunks retrieved`;
      if (latencyText) latencyText.textContent = `Latency: ${data.execution_time_ms} ms`;

      if (!data.results || data.results.length === 0) {
        resultsContainer.innerHTML = `
          <div class="empty-state-search">
            <i data-lucide="help-circle"></i>
            <h3>No matching chunks found</h3>
            <p>Try rephrasing your search terms or adjusting the vector weight.</p>
          </div>
        `;
        if (window.lucide) lucide.createIcons({ root: resultsContainer });
        return;
      }

      resultsContainer.innerHTML = '';
      data.results.forEach(r => {
        const card = document.createElement('div');
        card.className = 'search-result-card';

        // Highlight matching query tokens in snippet
        const highlightedSnippet = this.highlightTokens(r.text, query);

        card.innerHTML = `
          <div class="result-card-header">
            <div class="doc-info-badge">
              <i data-lucide="file-text"></i>
              <span>${this.escapeHtml(r.filename)}</span>
              <span class="meta-badge">Page ${r.page_number}</span>
            </div>
            <div class="score-progress-container">
              <span>${r.confidence_pct}% Match</span>
              <div class="confidence-bar-outer">
                <div class="confidence-bar-inner" style="width: ${r.confidence_pct}%"></div>
              </div>
            </div>
          </div>
          <div class="result-passage-text">
            "${highlightedSnippet}"
          </div>
          <div style="margin-top: 10px; font-size: 0.72rem; color: var(--text-muted); display: flex; gap: 14px;">
            <span>Dense Score: ${(r.dense_score * 100).toFixed(1)}%</span>
            <span>BM25 Score: ${(r.lexical_score * 100).toFixed(1)}%</span>
            <span>Chunk #${r.chunk_id}</span>
          </div>
        `;

        resultsContainer.appendChild(card);
      });

      if (window.lucide) lucide.createIcons({ root: resultsContainer });
    } catch (err) {
      resultsContainer.innerHTML = `<div style="color: var(--accent-rose); padding: 20px;">Error: ${err.message}</div>`;
      showToast(err.message, 'error');
    }
  },

  highlightTokens(text, query) {
    if (!text || !query) return this.escapeHtml(text);
    const tokens = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
    let safe = this.escapeHtml(text);

    tokens.forEach(token => {
      const regex = new RegExp(`(${token})`, 'gi');
      safe = safe.replace(regex, '<mark>$1</mark>');
    });

    return safe;
  },

  escapeHtml(text) {
    if (!text) return '';
    return text.replace(/[&<>"']/g, m => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[m]);
  }
};
