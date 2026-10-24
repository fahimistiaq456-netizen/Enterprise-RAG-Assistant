/**
   NEXUS ENTERPRISE COGNITIVE PLATFORM — KNOWLEDGE HUB & DOCUMENT CONTROLLER
   Manages automated vector indexing, chunk boundaries, drag-and-drop ingestion,
   telemetry updates, and chunk inspection dialogs.
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
      ['dragenter', 'dragover'].forEach(name => {
        dropzone.addEventListener(name, (e) => {
          e.preventDefault();
          dropzone.classList.add('drag-active');
        });
      });

      ['dragleave', 'drop'].forEach(name => {
        dropzone.addEventListener(name, (e) => {
          e.preventDefault();
          dropzone.classList.remove('drag-active');
        });
      });

      dropzone.addEventListener('drop', (e) => {
        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
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
      showToast('Only PDF documents (.pdf) can be ingested.', 'error');
      return;
    }

    const progressContainer = document.getElementById('upload-progress-container');
    const progressFill = document.getElementById('upload-progress-fill');
    const progressText = document.getElementById('upload-progress-text');

    if (progressContainer) {
      progressContainer.style.display = 'block';
      if (progressFill) progressFill.style.width = '25%';
      if (progressText) progressText.textContent = `Uploading "${file.name}"...`;
    }

    try {
      const formData = new FormData();
      formData.append('file', file);

      if (progressFill) progressFill.style.width = '60%';
      if (progressText) progressText.textContent = `Extracting pages & computing dense embeddings for "${file.name}"...`;

      const res = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Upload failed');
      }

      if (progressFill) progressFill.style.width = '100%';
      if (progressText) progressText.textContent = `Indexing complete!`;

      showToast(`Successfully indexed "${file.name}" (${data.chunk_count} chunks)`, 'success', 3000);
      await this.fetchDocuments();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setTimeout(() => {
        if (progressContainer) progressContainer.style.display = 'none';
        const fileInput = document.getElementById('pdf-file-input');
        if (fileInput) fileInput.value = '';
      }, 1500);
    }
  },

  async loadSampleDocs() {
    showToast('Indexing enterprise sample PDFs into knowledge vault...', 'info', 3000);
    try {
      const res = await fetch('/api/documents/load-samples', { method: 'POST' });
      const data = await res.json();

      if (!res.ok) throw new Error(data.detail || 'Failed to load samples');

      showToast(data.message || 'Sample enterprise PDFs loaded and indexed!', 'success', 3500);
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
      window.AppState.documents = docs || [];

      this.renderDocumentsTable(docs);
      this.updateTelemetry(docs);
      this.updateChatDocChips(docs);
    } catch (err) {
      console.warn('Failed to fetch documents:', err);
    }
  },

  renderDocumentsTable(docs) {
    const tbody = document.getElementById('documents-table-body');
    const totalCountEl = document.getElementById('total-docs-count');
    const badgeEl = document.getElementById('doc-counter-badge');

    if (totalCountEl) totalCountEl.textContent = docs.length;
    if (badgeEl) badgeEl.textContent = docs.length;

    if (!tbody) return;

    if (!docs || docs.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 40px; color: var(--text-muted);">
            No documents indexed yet. Upload a PDF or click "Load Sample Enterprise PDFs".
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = docs.map(doc => {
      const sizeKb = (doc.file_size / 1024).toFixed(1) + ' KB';
      const statusColor = doc.status === 'indexed' ? 'var(--status-emerald)' : 'var(--status-amber)';
      const statusBg = doc.status === 'indexed' ? 'var(--status-emerald-subtle)' : 'var(--status-amber-subtle)';
      const classification = doc.filename.toLowerCase().includes('security') ? 'Confidential' : 'Internal';

      return `
        <tr>
          <td>
            <div style="display: flex; align-items: center; gap: 8px;">
              <i data-lucide="file-text" style="width: 16px; height: 16px; color: var(--primary-400); flex-shrink: 0;"></i>
              <span style="font-weight: 500; color: var(--text-primary);">${this.escapeHtml(doc.filename)}</span>
            </div>
          </td>
          <td class="tabular-nums">${doc.page_count}</td>
          <td class="tabular-nums">${doc.chunk_count}</td>
          <td class="tabular-nums" style="color: var(--text-muted);">${sizeKb}</td>
          <td>
            <span class="nav-item-badge" style="background: ${statusBg}; color: ${statusColor};">
              ${doc.status.toUpperCase()}
            </span>
          </td>
          <td>
            <span class="nav-item-badge" style="background: var(--bg-elevated); color: var(--text-muted);">
              ${classification}
            </span>
          </td>
          <td style="text-align: right;">
            <div style="display: inline-flex; align-items: center; gap: 4px;">
              <button class="icon-btn-ghost view-chunks-btn" data-id="${doc.id}" data-name="${this.escapeHtml(doc.filename)}" title="Inspect vector chunks">
                <i data-lucide="layers" style="width: 14px; height: 14px;"></i>
              </button>
              <button class="icon-btn-ghost scope-doc-btn" data-id="${doc.id}" data-name="${this.escapeHtml(doc.filename)}" title="Scope reasoning to this file">
                <i data-lucide="crosshair" style="width: 14px; height: 14px;"></i>
              </button>
              <button class="icon-btn-ghost delete-doc-btn" data-id="${doc.id}" title="Delete document">
                <i data-lucide="trash-2" style="width: 14px; height: 14px; color: var(--status-rose);"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    if (window.lucide) lucide.createIcons({ root: tbody });

    // Bind action buttons
    tbody.querySelectorAll('.view-chunks-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const docId = btn.getAttribute('data-id');
        const docName = btn.getAttribute('data-name');
        this.openChunksModal(docId, docName);
      });
    });

    tbody.querySelectorAll('.scope-doc-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const docId = btn.getAttribute('data-id');
        const docName = btn.getAttribute('data-name');
        this.setScopeDocument(docId, docName);
      });
    });

    tbody.querySelectorAll('.delete-doc-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const docId = btn.getAttribute('data-id');
        this.deleteDocument(docId);
      });
    });
  },

  updateTelemetry(docs) {
    const docCountEl = document.getElementById('telemetry-doc-count');
    const chunkCountEl = document.getElementById('telemetry-chunk-count');

    const totalDocs = docs.length;
    const totalChunks = docs.reduce((acc, d) => acc + (d.chunk_count || 0), 0);

    if (docCountEl) docCountEl.textContent = totalDocs;
    if (chunkCountEl) chunkCountEl.textContent = totalChunks;
  },

  updateChatDocChips(docs) {
    const listEl = document.getElementById('chat-chips-list');
    if (!listEl) return;

    if (!window.AppState.selectedDocScope) {
      listEl.innerHTML = `
        <span class="scope-chip">
          <i data-lucide="database" style="width: 11px; height: 11px;"></i>
          <span>All Repositories (${docs.length} files)</span>
        </span>
      `;
    } else {
      const activeDoc = docs.find(d => String(d.id) === String(window.AppState.selectedDocScope));
      const docName = activeDoc ? activeDoc.filename : 'Selected Document';
      listEl.innerHTML = `
        <span class="scope-chip" style="border-color: var(--primary-border); background: var(--primary-subtle); color: var(--primary-400);">
          <i data-lucide="file-text" style="width: 11px; height: 11px;"></i>
          <span>Scoped: ${this.escapeHtml(docName)}</span>
          <span class="remove-chip" id="clear-scope-btn" title="Clear filter" style="margin-left: 4px;">✕</span>
        </span>
      `;

      const clearBtn = document.getElementById('clear-scope-btn');
      if (clearBtn) {
        clearBtn.addEventListener('click', () => {
          window.AppState.selectedDocScope = '';
          this.updateChatDocChips(docs);
          showToast('Reasoning scope reset to entire knowledge base', 'info');
        });
      }
    }

    if (window.lucide) lucide.createIcons({ root: listEl });
  },

  setScopeDocument(docId, docName) {
    window.AppState.selectedDocScope = docId;
    this.updateChatDocChips(window.AppState.documents);
    window.switchTab('chat');
    showToast(`Reasoning scoped strictly to "${docName}"`, 'success');
  },

  async deleteDocument(docId) {
    if (!confirm('Permanently remove this document and delete its vector embeddings?')) return;
    try {
      const res = await fetch(`/api/documents/${docId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete document');

      showToast('Document and vector embeddings deleted', 'info');
      if (String(window.AppState.selectedDocScope) === String(docId)) {
        window.AppState.selectedDocScope = '';
      }
      await this.fetchDocuments();
    } catch (err) {
      showToast(err.message, 'error');
    }
  },

  async openChunksModal(docId, docName) {
    const modal = document.getElementById('chunks-modal');
    const titleEl = document.getElementById('modal-doc-title');
    const listEl = document.getElementById('modal-chunks-list');

    if (!modal) return;

    if (titleEl) titleEl.textContent = `Vector Provenance: ${docName}`;
    if (listEl) listEl.innerHTML = '<div style="text-align: center; padding: 30px; color: var(--text-muted);">Fetching vector chunks...</div>';

    modal.showModal();

    try {
      const res = await fetch(`/api/documents/${docId}/chunks`);
      if (!res.ok) throw new Error('Failed to load chunks');

      const chunks = await res.json();
      if (!chunks || chunks.length === 0) {
        listEl.innerHTML = '<div style="text-align: center; padding: 30px; color: var(--text-muted);">No chunks available for this file.</div>';
        return;
      }

      listEl.innerHTML = chunks.map(ch => `
        <div style="background: var(--bg-elevated); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 12px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; font-size: 12px; font-family: var(--font-mono);">
            <span style="color: var(--primary-400); font-weight: 600;">Chunk #${ch.chunk_index} • Page ${ch.page_number}</span>
            <span style="color: var(--text-muted);">${ch.token_count} tokens</span>
          </div>
          <div style="font-size: 13px; line-height: 1.5; color: var(--text-secondary); font-family: var(--font-mono); white-space: pre-wrap; background: var(--bg-input); padding: 10px; border-radius: 6px;">
            ${this.escapeHtml(ch.text_content)}
          </div>
        </div>
      `).join('');
    } catch (err) {
      listEl.innerHTML = `<div style="color: var(--status-rose); text-align: center; padding: 20px;">Error: ${err.message}</div>`;
    }
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
