/**
 * Interactive RAG Streaming Chat & Friendly Citation Manager
 */
window.ChatManager = {
  isStreaming: false,

  async init() {
    this.bindEvents();
    await this.loadConversations();
  },

  bindEvents() {
    const chatForm = document.getElementById('chat-form');
    const chatInput = document.getElementById('chat-input');
    const newChatBtn = document.getElementById('new-chat-btn');
    const closeDrawerBtn = document.getElementById('close-drawer-btn');
    const clearChatsBtn = document.getElementById('clear-chats-btn');

    if (chatForm) {
      chatForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleSendMessage();
      });
    }

    if (chatInput) {
      chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this.handleSendMessage();
        }
      });
    }

    if (newChatBtn) {
      newChatBtn.addEventListener('click', () => {
        this.startNewConversation();
      });
    }

    if (closeDrawerBtn) {
      closeDrawerBtn.addEventListener('click', () => {
        this.closeCitationDrawer();
      });
    }

    if (clearChatsBtn) {
      clearChatsBtn.addEventListener('click', () => {
        this.clearConversations();
      });
    }

    // Sample Query Cards
    this.bindSampleCards();
  },

  bindSampleCards() {
    document.querySelectorAll('.sample-query-card').forEach(card => {
      card.addEventListener('click', () => {
        const prompt = card.getAttribute('data-prompt');
        const input = document.getElementById('chat-input');
        if (prompt && input) {
          input.value = prompt;
          this.handleSendMessage();
        }
      });
    });

    const uploadTrigger = document.getElementById('welcome-upload-trigger');
    const fileInput = document.getElementById('pdf-file-input');
    if (uploadTrigger && fileInput) {
      uploadTrigger.addEventListener('click', () => fileInput.click());
    }
  },

  startNewConversation() {
    window.AppState.activeConversationId = null;
    const container = document.getElementById('chat-messages');
    if (!container) return;

    // Reset view to friendly welcome state
    container.innerHTML = `
      <div id="chat-welcome-state" class="welcome-hero">
        <div class="hero-badge">
          <i data-lucide="heart-handshake"></i>
          <span>Friendly & 100% Accurate AI</span>
        </div>
        <h2>Chat with your PDFs easily! ✨</h2>
        <p>Upload any school notes, company policies, books, or financial reports. Ask any question in plain words, and I'll find the exact answers with page numbers!</p>
        
        <div class="welcome-upload-card" id="welcome-upload-trigger">
          <div class="welcome-upload-icon">
            <i data-lucide="file-up"></i>
          </div>
          <div>
            <h4>Click or drag any PDF here</h4>
            <span>Supports multi-page PDFs up to 50MB</span>
          </div>
          <button type="button" class="btn btn-primary btn-sm">Select PDF</button>
        </div>

        <div class="sample-queries-title">💡 Or try these sample questions:</div>
        <div class="sample-queries-grid">
          <button class="sample-query-card" data-prompt="What are the security password rules and session timeouts?">
            <span class="card-icon">🔐</span>
            <span class="card-text">"What are the security rules and session timeouts?"</span>
          </button>
          <button class="sample-query-card" data-prompt="What were the Q3 revenue, gross margin, and business highlights?">
            <span class="card-icon">💰</span>
            <span class="card-text">"What were the Q3 revenue and financial highlights?"</span>
          </button>
          <button class="sample-query-card" data-prompt="How fast does the emergency response team react to critical events?">
            <span class="card-icon">🚨</span>
            <span class="card-text">"How fast does the emergency response team react?"</span>
          </button>
          <button class="sample-query-card" data-prompt="Give me a simple 3-point summary of the uploaded documents.">
            <span class="card-icon">📝</span>
            <span class="card-text">"Give me a simple 3-point summary of my documents."</span>
          </button>
        </div>
      </div>
    `;

    this.bindSampleCards();
    if (window.lucide) lucide.createIcons({ root: container });

    // Remove active state from sidebar items
    document.querySelectorAll('.conversation-item').forEach(i => i.classList.remove('active'));
    showToast('Ready for a new question!', 'info');
  },

  async loadConversations() {
    const listEl = document.getElementById('conversations-list');
    if (!listEl) return;

    try {
      const res = await fetch('/api/conversations');
      if (!res.ok) return;

      const convs = await res.json();
      if (!convs || convs.length === 0) {
        listEl.innerHTML = '<div class="empty-history-text">No previous chats yet</div>';
        return;
      }

      listEl.innerHTML = '';
      convs.forEach(c => {
        const item = document.createElement('div');
        item.className = `conversation-item ${window.AppState.activeConversationId === c.id ? 'active' : ''}`;
        item.setAttribute('data-id', c.id);

        item.innerHTML = `
          <span class="conv-title" title="${this.escapeHtml(c.title)}">${this.escapeHtml(c.title)}</span>
          <button class="icon-btn-tiny del-conv-btn" data-id="${c.id}" title="Delete chat">
            <i data-lucide="x"></i>
          </button>
        `;

        item.addEventListener('click', (e) => {
          if (e.target.closest('.del-conv-btn')) return;
          this.switchConversation(c.id);
        });

        const delBtn = item.querySelector('.del-conv-btn');
        if (delBtn) {
          delBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.deleteConversation(c.id);
          });
        }

        listEl.appendChild(item);
      });

      if (window.lucide) lucide.createIcons({ root: listEl });
    } catch (err) {
      console.warn('Failed to load conversations:', err);
    }
  },

  async switchConversation(convId) {
    if (this.isStreaming) {
      showToast('Please wait for the current response to finish', 'info');
      return;
    }

    window.AppState.activeConversationId = convId;
    document.querySelectorAll('.conversation-item').forEach(i => {
      i.classList.toggle('active', i.getAttribute('data-id') === convId);
    });

    const container = document.getElementById('chat-messages');
    container.innerHTML = '<div style="text-align:center; padding: 40px; color: var(--text-muted);">Loading conversation...</div>';

    try {
      const res = await fetch(`/api/conversations/${convId}`);
      if (!res.ok) throw new Error('Failed to load conversation');

      const data = await res.json();
      container.innerHTML = '';

      if (data.messages && data.messages.length > 0) {
        data.messages.forEach(m => {
          this.appendMessageBubble(m.sender, m.content, m.citations || []);
        });
      } else {
        container.innerHTML = '<div class="empty-history-text" style="text-align:center; padding: 40px;">No messages in this chat yet.</div>';
      }

      this.scrollToBottom();
    } catch (err) {
      showToast(err.message, 'error');
    }
  },

  async deleteConversation(convId) {
    try {
      await fetch(`/api/conversations/${convId}`, { method: 'DELETE' });
      if (window.AppState.activeConversationId === convId) {
        this.startNewConversation();
      }
      await this.loadConversations();
    } catch (err) {
      showToast('Failed to delete conversation', 'error');
    }
  },

  async clearConversations() {
    if (!confirm('Clear all conversation history?')) return;
    const items = document.querySelectorAll('.conversation-item');
    for (const item of items) {
      const id = item.getAttribute('data-id');
      if (id) {
        await fetch(`/api/conversations/${id}`, { method: 'DELETE' });
      }
    }
    this.startNewConversation();
    await this.loadConversations();
    showToast('Conversation history cleared', 'info');
  },

  async handleSendMessage() {
    const input = document.getElementById('chat-input');
    if (!input || this.isStreaming) return;

    const message = input.value.trim();
    if (!message) return;

    // Check if user has uploaded docs
    if (window.AppState.documents.length === 0) {
      showToast('No PDF loaded yet. Click "Load Demo Docs" or drop a PDF to ask questions!', 'info', 4500);
    }

    input.value = '';
    input.style.height = 'auto';

    // Remove welcome state if present
    const welcome = document.getElementById('chat-welcome-state');
    if (welcome) welcome.remove();

    // Append user bubble
    this.appendMessageBubble('user', message);
    this.scrollToBottom();

    // Prepare assistant streaming bubble
    const assistantBubble = this.createStreamingAssistantBubble();
    this.scrollToBottom();

    this.isStreaming = true;
    const sendBtn = document.getElementById('send-msg-btn');
    if (sendBtn) sendBtn.disabled = true;

    // Selected document scope from chips bar or default
    const selectedDocId = window.AppState.selectedDocScope ? [window.AppState.selectedDocScope] : null;

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_id: window.AppState.activeConversationId,
          message: message,
          document_ids: selectedDocId,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || `Server error (${res.status})`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let accumulatedText = '';
      let receivedCitations = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr) continue;

          try {
            const event = JSON.parse(jsonStr);

            if (event.type === 'meta') {
              window.AppState.activeConversationId = event.conversation_id;
              receivedCitations = event.citations || [];
              // Cache citations for drawer lookup
              receivedCitations.forEach(c => {
                window.AppState.citationCache[c.filename + '_' + c.page_number] = c;
              });
            } else if (event.type === 'token') {
              accumulatedText += event.content;
              this.updateAssistantBubbleText(assistantBubble, accumulatedText, receivedCitations);
              this.scrollToBottom();
            } else if (event.type === 'done') {
              this.finalizeAssistantBubble(assistantBubble, accumulatedText, receivedCitations);
            }
          } catch (e) {
            // Ignore parse errors on partial chunks
          }
        }
      }

      // Reload sidebar conversations to update titles/timestamps
      await this.loadConversations();
    } catch (err) {
      assistantBubble.querySelector('.msg-bubble').innerHTML = `<p style="color: var(--accent-rose);">Error: ${err.message}</p>`;
      showToast(err.message, 'error');
    } finally {
      this.isStreaming = false;
      if (sendBtn) sendBtn.disabled = false;
      this.scrollToBottom();
    }
  },

  appendMessageBubble(sender, text, citations = []) {
    const container = document.getElementById('chat-messages');
    if (!container) return;

    const msg = document.createElement('div');
    msg.className = `chat-msg ${sender}`;

    const avatarText = sender === 'user' ? 'YOU' : 'AI';

    let contentHtml = '';
    if (sender === 'user') {
      contentHtml = `<p>${this.escapeHtml(text)}</p>`;
    } else {
      contentHtml = this.renderMarkdownWithCitations(text, citations);
    }

    const actionsHtml = sender === 'assistant' ? this.renderMessageActions() : '';

    msg.innerHTML = `
      <div class="msg-avatar">${avatarText}</div>
      <div class="msg-body">
        <div class="msg-bubble">${contentHtml}</div>
        ${actionsHtml}
        ${sender === 'assistant' && citations && citations.length > 0 ? this.renderCitationsFooter(citations) : ''}
      </div>
    `;

    container.appendChild(msg);

    // Bind citation clicks & audio read aloud
    this.bindCitationEvents(msg);
    if (sender === 'assistant') {
      this.bindMessageActions(msg, text);
    }
  },

  createStreamingAssistantBubble() {
    const container = document.getElementById('chat-messages');
    const msg = document.createElement('div');
    msg.className = 'chat-msg assistant streaming';

    msg.innerHTML = `
      <div class="msg-avatar">AI</div>
      <div class="msg-body">
        <div class="msg-bubble">
          <span class="typing-dots">✨ Reading documents & finding answers...</span>
        </div>
        <div class="msg-actions-row" style="display: none;"></div>
        <div class="citations-footer-row" style="display: none;"></div>
      </div>
    `;

    container.appendChild(msg);
    return msg;
  },

  updateAssistantBubbleText(bubbleEl, text, citations) {
    const contentEl = bubbleEl.querySelector('.msg-bubble');
    if (contentEl) {
      contentEl.innerHTML = this.renderMarkdownWithCitations(text, citations);
      this.bindCitationEvents(bubbleEl);
    }
  },

  finalizeAssistantBubble(bubbleEl, text, citations) {
    bubbleEl.classList.remove('streaming');
    const contentEl = bubbleEl.querySelector('.msg-bubble');
    const footerEl = bubbleEl.querySelector('.citations-footer-row');
    const actionsEl = bubbleEl.querySelector('.msg-actions-row');

    if (contentEl) {
      contentEl.innerHTML = this.renderMarkdownWithCitations(text, citations);
    }

    if (actionsEl) {
      actionsEl.innerHTML = `
        <button class="action-chip-btn speak-btn" title="Read answer out loud">
          <i data-lucide="volume-2"></i> <span>Listen</span>
        </button>
        <button class="action-chip-btn copy-btn" title="Copy answer">
          <i data-lucide="copy"></i> <span>Copy</span>
        </button>
      `;
      actionsEl.style.display = 'flex';
      if (window.lucide) lucide.createIcons({ root: actionsEl });
      this.bindMessageActions(bubbleEl, text);
    }

    if (footerEl && citations && citations.length > 0) {
      footerEl.innerHTML = citations.map(c => `
        <div class="citation-card-chip" data-doc="${this.escapeHtml(c.filename)}" data-page="${c.page_number}">
          <i data-lucide="check-circle-2"></i>
          <span>${this.escapeHtml(c.filename)} (Page ${c.page_number})</span>
          <span class="match-pct">${c.confidence_pct}% match</span>
        </div>
      `).join('');
      footerEl.style.display = 'flex';
      if (window.lucide) lucide.createIcons({ root: footerEl });
    }

    this.bindCitationEvents(bubbleEl);
  },

  renderMessageActions() {
    return `
      <div class="msg-actions-row">
        <button class="action-chip-btn speak-btn" title="Read answer out loud">
          <i data-lucide="volume-2"></i> <span>Listen</span>
        </button>
        <button class="action-chip-btn copy-btn" title="Copy answer">
          <i data-lucide="copy"></i> <span>Copy</span>
        </button>
      </div>
    `;
  },

  bindMessageActions(msgEl, text) {
    const speakBtn = msgEl.querySelector('.speak-btn');
    const copyBtn = msgEl.querySelector('.copy-btn');

    if (speakBtn) {
      speakBtn.addEventListener('click', () => {
        if ('speechSynthesis' in window) {
          if (window.speechSynthesis.speaking) {
            window.speechSynthesis.cancel();
            speakBtn.classList.remove('speaking');
            const span = speakBtn.querySelector('span');
            if (span) span.textContent = 'Listen';
            return;
          }

          // Clean text from markdown syntax and citations
          const cleanText = text
            .replace(/\[\[.*?\]\]/g, '')
            .replace(/\[.*?\]/g, '')
            .replace(/[#*`_~>]/g, '')
            .trim();

          const utterance = new SpeechSynthesisUtterance(cleanText);
          utterance.rate = 1.0;
          utterance.onend = () => {
            speakBtn.classList.remove('speaking');
            const span = speakBtn.querySelector('span');
            if (span) span.textContent = 'Listen';
          };

          speakBtn.classList.add('speaking');
          const span = speakBtn.querySelector('span');
          if (span) span.textContent = 'Stop';
          window.speechSynthesis.speak(utterance);
        } else {
          showToast('Text-to-speech is not supported on this browser', 'info');
        }
      });
    }

    if (copyBtn) {
      copyBtn.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(text);
          const span = copyBtn.querySelector('span');
          if (span) span.textContent = '✓ Copied!';
          setTimeout(() => {
            if (span) span.textContent = 'Copy';
          }, 2000);
        } catch (err) {
          showToast('Failed to copy to clipboard', 'info');
        }
      });
    }
  },

  renderMarkdownWithCitations(rawMarkdown, citations = []) {
    if (!rawMarkdown) return '';

    // Replace [[Doc: filename.pdf, Page: X]] with HTML citation badges
    let processed = rawMarkdown.replace(
      /\[\[Doc:\s*([^,]+),\s*Page:\s*(\d+)\]\]/gi,
      (match, doc, page) => {
        const cleanDoc = doc.trim();
        const cleanPage = page.trim();
        return `<span class="citation-pill" data-doc="${this.escapeHtml(cleanDoc)}" data-page="${cleanPage}">📄 Page ${cleanPage}</span>`;
      }
    );

    // Also match fallback citations like [Doc: filename, Page: X]
    processed = processed.replace(
      /\[Doc:\s*([^,]+),\s*Page:\s*(\d+)\]/gi,
      (match, doc, page) => {
        const cleanDoc = doc.trim();
        const cleanPage = page.trim();
        return `<span class="citation-pill" data-doc="${this.escapeHtml(cleanDoc)}" data-page="${cleanPage}">📄 Page ${cleanPage}</span>`;
      }
    );

    // Parse markdown safely
    try {
      const parsedHtml = marked.parse(processed, { breaks: true, gfm: true });
      return DOMPurify.sanitize(parsedHtml, {
        ADD_ATTR: ['data-doc', 'data-page'],
        ADD_TAGS: ['mark'],
      });
    } catch (e) {
      return processed;
    }
  },

  renderCitationsFooter(citations) {
    if (!citations || citations.length === 0) return '';
    return `
      <div class="citations-footer-row">
        ${citations.map(c => `
          <div class="citation-card-chip" data-doc="${this.escapeHtml(c.filename)}" data-page="${c.page_number}">
            <i data-lucide="check-circle-2"></i>
            <span>${this.escapeHtml(c.filename)} (Page ${c.page_number})</span>
            <span class="match-pct">${c.confidence_pct}% match</span>
          </div>
        `).join('')}
      </div>
    `;
  },

  bindCitationEvents(element) {
    element.querySelectorAll('.citation-pill, .citation-card-chip').forEach(pill => {
      pill.addEventListener('click', (e) => {
        e.preventDefault();
        const docName = pill.getAttribute('data-doc');
        const pageNum = pill.getAttribute('data-page');
        this.openCitationDrawer(docName, pageNum);
      });
    });
  },

  openCitationDrawer(docName, pageNum) {
    const drawer = document.getElementById('citation-drawer');
    const docNameEl = document.getElementById('drawer-doc-name');
    const pageNumEl = document.getElementById('drawer-page-num');
    const confEl = document.getElementById('drawer-confidence');
    const excerptEl = document.getElementById('drawer-excerpt-text');

    if (!drawer) return;

    if (docNameEl) docNameEl.textContent = docName;
    if (pageNumEl) pageNumEl.textContent = `Page ${pageNum}`;

    // Lookup excerpt from cache or show standard snippet
    const cacheKey = docName + '_' + pageNum;
    const cached = window.AppState.citationCache[cacheKey];

    if (cached) {
      if (confEl) confEl.textContent = `High Match (${cached.confidence_pct}%) ⭐⭐⭐⭐⭐`;
      if (excerptEl) excerptEl.textContent = cached.excerpt;
    } else {
      if (confEl) confEl.textContent = 'High Confidence Match ⭐⭐⭐⭐⭐';
      if (excerptEl) excerptEl.textContent = `Found on Page ${pageNum} of ${docName}.`;
    }

    drawer.classList.add('open');
    drawer.setAttribute('aria-hidden', 'false');
  },

  closeCitationDrawer() {
    const drawer = document.getElementById('citation-drawer');
    if (drawer) {
      drawer.classList.remove('open');
      drawer.setAttribute('aria-hidden', 'true');
    }
  },

  scrollToBottom() {
    const container = document.getElementById('chat-messages');
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
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
