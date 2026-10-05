/**
 * Knowledge Base & Document Management
 */
window.DocumentsManager = {
  async init() {
    this.bindEvents();
    await this.fetchDocuments();
  },

  bindEvents() {
    const dropzone = document.getElementById('pdf-dropzone');
    const fileInput = document.getElementById('pdf-file-input');
    const browseBtn = document.getElementById('browse-files-btn');
    const refreshBtn = document.getElementById('refresh-docs-btn');
    const loadVaultSamplesBtn = document.getElementById('load-samples-vault-btn');
    const closeChunksModalBtn = document.getElementById('close-chunks-modal-btn');
    const chunksModal = document.getElementById('chunks-modal');

    if (browseBtn && fileInput) {
      browseBtn.addEventListener('click', () => fileInput.click());
    }

    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
          this.uploadFile(e.target.files[0]);
        }
      });
    }

    if (dropzone) {
      ['dragenter', 'dragover'].forEach(eventName => {
        dropzone.addEventListener(eventName, (e) => {
          e.preventDefault();
          dropzone.classList.add('drag-active');
        }, false);
      });

      ['dragleave', 'drop'].forEach(eventName => {
        dropzone.addEventListener(eventName, (e) => {
          e.preventDefault();
          dropzone.classList.remove('drag-active');
        }, false);
      });

      dropzone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        if (files.length > 0) {
          this.uploadFile(files[0]);
        }
      });
    }

    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this.fetchDocuments());
    }

    if (loadVaultSamplesBtn) {
      loadVaultSamplesBtn.addEventListener('click', () => this.loadSampleDocs());
    }

    if (closeChunksModalBtn && chunksModal) {
      closeChunksModalBtn.addEventListener('click', () => chunksModal.close());
    }
  },

  async uploadFile(file) {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      showToast('Please upload a PDF document (.pdf)', 'error');
      return;
    }

    const progressContainer = document.getElementById('upload-progress-container');
    const progressFill = document.getElementById('upload-progress-fill');
    const progressText = document.getElementById('upload-progress-text');

    if (progressContainer) {
      progressContainer.style.display = 'block';
      if (progressFill) progressFill.style.width = '30%';
      if (progressText) progressText.textContent = `Uploading "${file.name}"...`;
    }

    try {
      const formData = new FormData();
      formData.append('file', file);

      if (progressFill) progressFill.style.width = '65%';
      if (progressText) progressText.textContent = `Extracting pages & computing embeddings for "${file.name}"...`;

      const res = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Upload failed');
      }

      if (progressFill) progressFill.style.width = '100%';
      showToast(`Successfully indexed "${file.name}" (${data.page_count} pages, ${data.chunk_count} chunks)`, 'success');
      await this.fetchDocuments();
    } catch (err) {
      showToast('Upload error: ' + err.message, 'error');
    } finally {
      setTimeout(() => {
        if (progressContainer) progressContainer.style.display = 'none';
        if (progressFill) progressFill.style.width = '0%';
        const fileInput = document.getElementById('pdf-file-input');
        if (fileInput) fileInput.value = '';
      }, 1000);
    }
  },

  async loadSampleDocs() {
    showToast('Loading pre-built enterprise documents...', 'info');
    try {
      const res = await fetch('/api/documents/load-samples', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to load sample documents');

      showToast(`Loaded ${data.documents.length} enterprise documents!`, 'success');
      await this.fetchDocuments();
    } catch (err) {
      showToast(err.message, 'error');
    }
  },

  async fetchDocuments() {
    try {
      const res = await fetch('/api/documents');
      if (!res.ok) return;

      const docs = await res.json();
      window.AppState.documents = docs;

      // Update counters
      const counterBadge = document.getElementById('doc-counter-badge');
      const totalDocsCount = document.getElementById('total-docs-count');
      if (counterBadge) counterBadge.textContent = docs.length;
      if (totalDocsCount) totalDocsCount.textContent = docs.length;

      // Update topbar summary
      const summaryDocCount = document.getElementById('summary-doc-count');
      if (summaryDocCount) {
        summaryDocCount.textContent = docs.length > 0 ? `${docs.length} PDF${docs.length > 1 ? 's' : ''} Ready` : 'No PDFs attached';
      }

      // Update active document chips in chat bar
      this.renderChatChips(docs);

      // Render documents grid
      this.renderDocumentsGrid(docs);
    } catch (err) {
      console.warn('Failed to fetch documents:', err);
    }
  },

  renderChatChips(docs) {
    const container = document.getElementById('chat-chips-list');
    const chipsBar = document.getElementById('chat-docs-chips-bar');
    if (!container || !chipsBar) return;

    if (!docs || docs.length === 0) {
      container.innerHTML = '<span style="font-size: 0.75rem; color: var(--text-muted); font-style: italic;">No PDF attached yet (Drop a PDF or click + Add)</span>';
      return;
    }

    container.innerHTML = docs.map(d => {
      const isSelected = window.AppState.selectedDocScope === d.id;
      const shortName = d.filename.length > 24 ? d.filename.slice(0, 22) + '...' : d.filename;
      return `
        <div class="doc-chip ${isSelected ? 'selected' : ''}" data-id="${d.id}" title="${this.escapeHtml(d.filename)} (${d.page_count} pages)">
          <i data-lucide="file-text"></i>
          <span>${this.escapeHtml(shortName)}</span>
          <span style="font-size: 0.68rem; opacity: 0.7;">(${d.page_count}p)</span>
        </div>
      `;
    }).join('');

    if (window.lucide) lucide.createIcons({ root: container });

    // Click to filter by specific document or toggle all
    container.querySelectorAll('.doc-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const id = parseInt(chip.getAttribute('data-id'));
        if (window.AppState.selectedDocScope === id) {
          window.AppState.selectedDocScope = null;
          showToast('Now searching across all documents', 'info');
        } else {
          window.AppState.selectedDocScope = id;
          showToast(`Chat focused on: ${chip.getAttribute('title')}`, 'info');
        }
        this.renderChatChips(window.AppState.documents);
      });
    });
  },

  renderDocumentsGrid(docs) {
    const grid = document.getElementById('documents-grid');
    if (!grid) return;

    if (!docs || docs.length === 0) {
      grid.innerHTML = `
        <div class="empty-state-docs" style="grid-column: 1 / -1;">
          <i data-lucide="file-text"></i>
          <h3>No documents indexed yet</h3>
          <p>Upload a PDF document above or click "Load Sample Enterprise PDFs" for immediate testing.</p>
        </div>
      `;
      if (window.lucide) lucide.createIcons({ root: grid });
      return;
    }

    grid.innerHTML = '';
    docs.forEach(doc => {
      const card = document.createElement('div');
      card.className = 'doc-card';

      const sizeKb = (doc.file_size / 1024).toFixed(1);
      const sizeDisplay = doc.file_size > 1024 * 1024 ? `${(doc.file_size / (1024 * 1024)).toFixed(2)} MB` : `${sizeKb} KB`;

      card.innerHTML = `
        <div class="doc-card-top">
          <div class="doc-type-icon">
            <i data-lucide="file-text"></i>
          </div>
          <div>
            <h4 class="doc-card-title">${this.escapeHtml(doc.filename)}</h4>
            <div class="doc-card-stats">
              <span>${doc.page_count || 0} Pages</span>
              <span>•</span>
              <span>${doc.chunk_count || 0} Chunks</span>
              <span>•</span>
              <span>${sizeDisplay}</span>
            </div>
          </div>
        </div>

        <div class="doc-card-footer">
          <span class="status-badge ${doc.status}">${doc.status}</span>
          <div style="display: flex; gap: 6px;">
            <button class="btn btn-outline btn-sm view-chunks-btn" data-id="${doc.id}" data-name="${this.escapeHtml(doc.filename)}">
              <i data-lucide="eye"></i> Chunks
            </button>
            <button class="icon-btn-tiny delete-doc-btn" data-id="${doc.id}" data-name="${this.escapeHtml(doc.filename)}" title="Delete document">
              <i data-lucide="trash-2"></i>
            </button>
          </div>
        </div>
      `;

      grid.appendChild(card);
    });

    if (window.lucide) lucide.createIcons({ root: grid });

    // Bind event handlers
    grid.querySelectorAll('.view-chunks-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const name = btn.getAttribute('data-name');
        this.openChunksModal(id, name);
      });
    });

    grid.querySelectorAll('.delete-doc-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const name = btn.getAttribute('data-name');
        this.deleteDocument(id, name);
      });
    });
  },

  async openChunksModal(docId, docName) {
    const modal = document.getElementById('chunks-modal');
    const title = document.getElementById('modal-doc-title');
    const container = document.getElementById('modal-chunks-list');

    if (!modal || !container) return;

    if (title) title.textContent = `Chunks Inspector: ${docName}`;
    container.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-muted);">Loading vector chunks...</div>';
    modal.showModal();

    try {
      const res = await fetch(`/api/documents/${docId}/chunks`);
      if (!res.ok) throw new Error('Failed to load chunks');

      const chunks = await res.json();
      if (!chunks || chunks.length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 20px;">No chunks found for this document.</div>';
        return;
      }

      container.innerHTML = chunks.map(ch => `
        <div class="chunk-card">
          <div class="chunk-card-meta">
            <span>Chunk #${ch.chunk_index + 1} (Page ${ch.page_number})</span>
            <span>${ch.token_count} words • Vector Indexed ✓</span>
          </div>
          <div class="chunk-card-text">${this.escapeHtml(ch.text)}</div>
        </div>
      `).join('');
    } catch (err) {
      container.innerHTML = `<div style="color: var(--accent-rose); padding: 14px;">Error: ${err.message}</div>`;
    }
  },

  async deleteDocument(docId, docName) {
    if (!confirm(`Are you sure you want to delete "${docName}" and remove its vector embeddings?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/documents/${docId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete document');

      showToast(`Document "${docName}" removed`, 'info');
      await this.fetchDocuments();
    } catch (err) {
      showToast(err.message, 'error');
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
