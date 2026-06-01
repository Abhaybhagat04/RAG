// AuraRAG Chatbot Application Logic

document.addEventListener('DOMContentLoaded', () => {
    // Use same-origin API routes so deployments like Hugging Face Spaces call
    // the Space backend instead of the user's local machine.
    const BASE_URL = '';
    
    // DOM Element Selections
    const uploadZone = document.getElementById('upload-zone');
    const fileInput = document.getElementById('file-input');
    const uploadLoader = document.getElementById('upload-loader');
    const fileList = document.getElementById('file-list');
    const fileCount = document.getElementById('file-count');
    const chatForm = document.getElementById('chat-form');
    const queryInput = document.getElementById('query-input');
    const chatMessages = document.getElementById('chat-messages');
    const typingIndicator = document.getElementById('typing-indicator');
    const btnClearChat = document.getElementById('btn-clear-chat');
    const welcomeContainer = document.getElementById('welcome-container');
    const quickPrompts = document.getElementById('quick-prompts');
    const toastContainer = document.getElementById('toast-container');
    
    // Application State
    let conversationStarted = false;
    let uploadedFilesList = [];
    let chatHistory = []; // Tracks all conversation turns for multi-turn context

    // --- Dynamic Textarea Auto-grow ---
    queryInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight - 4) + 'px';
    });

    // Handle Enter key in textarea (Submit on Enter, newline on Shift+Enter)
    queryInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            chatForm.dispatchEvent(new Event('submit'));
        }
    });

    // --- Toast Notifications Engine ---
    function showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        let iconSvg = '';
        if (type === 'success') {
            iconSvg = `
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="toast-icon">
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>`;
        } else {
            iconSvg = `
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="toast-icon">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>`;
        }
        
        toast.innerHTML = `
            ${iconSvg}
            <div class="toast-message">${message}</div>
        `;
        
        toastContainer.appendChild(toast);
        
        // Slide out and remove after delay
        setTimeout(() => {
            toast.style.animation = 'toast-slide-in 0.3s ease reverse forwards';
            setTimeout(() => {
                toast.remove();
            }, 300);
        }, 4000);
    }

    // --- Ingestion Management (PDF Upload) ---
    
    // Trigger hidden file input on click
    uploadZone.addEventListener('click', () => {
        fileInput.click();
    });

    // Handle file selection from explorer
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFileUpload(e.target.files[0]);
            fileInput.value = ''; // Reset input to allow re-upload of same file
        }
    });

    // Drag and drop event wiring
    ['dragenter', 'dragover'].forEach(eventName => {
        uploadZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            uploadZone.classList.add('dragover');
        }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        uploadZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            uploadZone.classList.remove('dragover');
        }, false);
    });

    uploadZone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        if (files.length > 0) {
            if (files[0].type === 'application/pdf' || files[0].name.toLowerCase().endsWith('.pdf')) {
                handleFileUpload(files[0]);
            } else {
                showToast('Only PDF documents are supported currently.', 'error');
            }
        }
    });

    // Upload core function
    async function handleFileUpload(file) {
        uploadLoader.style.display = 'flex';
        
        const formData = new FormData();
        formData.append('file', file);
        
        try {
            const response = await fetch(`${BASE_URL}/upload`, {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) {
                throw new Error(`Server returned error status ${response.status}`);
            }
            
            const data = await response.json();
            
            showToast(`"${file.name}" ingested successfully! ${data.chunks || 0} chunks added.`, 'success');

            // Auto-clear chat when a new PDF is uploaded so old answers don't persist
            const rows = chatMessages.querySelectorAll('.message-row');
            rows.forEach(row => row.remove());
            chatHistory = [];
            welcomeContainer.style.display = 'flex';
            conversationStarted = false;
            
            // Re-fetch files list from system
            fetchActiveFiles();
        } catch (error) {
            console.error('Upload failed:', error);
            showToast(`Failed to process PDF: ${error.message}`, 'error');
        } finally {
            uploadLoader.style.display = 'none';
        }
    }

    // Fetch lists of files in knowledge base
    async function fetchActiveFiles() {
        try {
            const response = await fetch(`${BASE_URL}/files`);
            if (!response.ok) throw new Error('Could not fetch active files');
            
            const data = await response.json();
            uploadedFilesList = data.files || [];
            
            renderFileList();
        } catch (err) {
            console.warn('Could not query active documents from API:', err);
        }
    }

    // Render files inside the sidebar
    function renderFileList() {
        if (uploadedFilesList.length === 0) {
            fileList.innerHTML = `
                <div class="no-files-placeholder">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                        <line x1="9" y1="15" x2="15" y2="15"></line>
                    </svg>
                    <p>No documents uploaded yet. Upload a PDF to start asking questions.</p>
                </div>
            `;
            fileCount.textContent = '0 Files';
            return;
        }
        
        fileCount.textContent = `${uploadedFilesList.length} File${uploadedFilesList.length > 1 ? 's' : ''}`;
        fileList.innerHTML = '';
        
        uploadedFilesList.forEach(fileName => {
            const card = document.createElement('div');
            card.className = 'file-card';
            card.innerHTML = `
                <div class="file-card-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                    </svg>
                </div>
                <div class="file-card-details">
                    <span class="file-card-name" title="${fileName}">${fileName}</span>
                    <span class="file-card-meta">Ready in ChromaDB</span>
                </div>
            `;
            fileList.appendChild(card);
        });
    }

    // --- Conversational Chat Core ---

    // Chat submit handler
    chatForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const question = queryInput.value.trim();
        if (!question) return;
        
        // Clear input and reset height
        queryInput.value = '';
        queryInput.style.height = 'auto';
        
        // Deactivate welcome screen on first query
        if (!conversationStarted) {
            welcomeContainer.style.display = 'none';
            conversationStarted = true;
        }
        
        // Append user question
        appendMessage('user', question);
        scrollToBottom();
        
        // Render typing loading state
        typingIndicator.style.display = 'flex';
        scrollToBottom();
        
        try {
            const response = await fetch(`${BASE_URL}/query`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    question: question,
                    chat_history: chatHistory  // Send full history for follow-up awareness
                })
            });
            
            if (!response.ok) {
                throw new Error(`API error: ${response.status} ${response.statusText}`);
            }
            
            const data = await response.json();
            
            // Hide indicator
            typingIndicator.style.display = 'none';
            
            // Store this turn in history BEFORE rendering
            chatHistory.push({ role: 'user', content: question });
            chatHistory.push({ role: 'assistant', content: data.answer });

            // Keep history bounded to last 10 turns (5 exchanges) to avoid token overflow
            if (chatHistory.length > 10) {
                chatHistory = chatHistory.slice(chatHistory.length - 10);
            }
            
            // Render LLM response
            appendMessage('ai', data.answer, data.context);
            scrollToBottom();
        } catch (error) {
            console.error('Chat query failed:', error);
            typingIndicator.style.display = 'none';
            appendMessage('ai', `⚠️ Connection Error: Failed to retrieve answer. Please make sure the backend is running and the Groq key is active.\n\nDetails: ${error.message}`);
            scrollToBottom();
        }
    });

    // Create and append conversational speech bubble
    function appendMessage(sender, text, context = null) {
        const messageRow = document.createElement('div');
        messageRow.className = `message-row ${sender}`;
        
        const avatarLetter = sender === 'user' ? 'U' : 'AI';
        
        let contextAccordionHtml = '';
        if (sender === 'ai' && context && context.trim().length > 0) {
            // Generate distinct content id
            const uniqueId = `source-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
            contextAccordionHtml = `
                <div class="sources-accordion">
                    <button class="sources-trigger" data-target="${uniqueId}">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="9 18 15 12 9 6"></polyline>
                        </svg>
                        View Context Sources 📖
                    </button>
                    <div class="sources-content" id="${uniqueId}">${escapeHtml(context)}</div>
                </div>
            `;
        }
        
        messageRow.innerHTML = `
            <div class="message-avatar">${avatarLetter}</div>
            <div class="message-bubble">
                <div class="message-text">${escapeHtml(text)}</div>
                ${contextAccordionHtml}
            </div>
        `;
        
        chatMessages.appendChild(messageRow);
        
        // Attach toggles for newly generated sources trigger
        if (contextAccordionHtml) {
            const trigger = messageRow.querySelector('.sources-trigger');
            const targetId = trigger.getAttribute('data-target');
            const targetContent = messageRow.querySelector(`#${targetId}`);
            
            trigger.addEventListener('click', () => {
                const isActive = trigger.classList.toggle('active');
                targetContent.style.display = isActive ? 'block' : 'none';
                scrollToBottom();
            });
        }
    }

    // Clear conversation
    btnClearChat.addEventListener('click', () => {
        // Remove all dynamically appended message rows
        const rows = chatMessages.querySelectorAll('.message-row');
        rows.forEach(row => row.remove());
        
        // Reset history so the next chat starts fresh
        chatHistory = [];
        
        // Restore onboarding panel
        welcomeContainer.style.display = 'flex';
        conversationStarted = false;
        showToast('Chat history cleared.', 'success');
    });

    // Quick prompt selector click binding
    quickPrompts.addEventListener('click', (e) => {
        const pill = e.target.closest('.prompt-pill');
        if (pill) {
            queryInput.value = pill.textContent;
            queryInput.dispatchEvent(new Event('input')); // trigger height updates
            queryInput.focus();
        }
    });

    // Helper functions
    function scrollToBottom() {
        chatMessages.scrollTo({
            top: chatMessages.scrollHeight,
            behavior: 'smooth'
        });
    }

    function escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    // --- Onboarding Initializations ---
    // Fetch file list once on load only. It refreshes automatically after each upload.
    fetchActiveFiles();
});
