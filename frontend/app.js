// AuraRAG Chatbot Application Logic

document.addEventListener('DOMContentLoaded', () => {
    // Same-origin API routes for deployment flexibility
    const BASE_URL = '';
    
    // DOM Element Selections
    const sidebar = document.getElementById('sidebar');
    const btnSidebarCollapse = document.getElementById('btn-sidebar-collapse');
    const btnSidebarExpand = document.getElementById('btn-sidebar-expand');
    const btnThemeToggle = document.getElementById('btn-theme-toggle');
    const themeIcon = document.getElementById('theme-icon');
    const themeText = document.getElementById('theme-text');
    const hljsTheme = document.getElementById('hljs-theme');
    
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
    let chatHistory = []; // Tracks conversation turns for context

    document.body.classList.toggle('conversation-active', conversationStarted);

    // --- Markdown Ingestion & Highlight Configuration ---
    // Custom renderer for code blocks to add header and copy button
    const renderer = new marked.Renderer();
    renderer.code = function(first, second) {
        let code = '';
        let language = '';
        
        if (typeof first === 'object' && first !== null) {
            code = first.text || '';
            language = first.lang || 'plaintext';
        } else {
            code = first || '';
            language = second || 'plaintext';
        }
        
        return `
            <div class="code-block-wrapper">
                <div class="code-block-header">
                    <span>${language}</span>
                    <button class="btn-copy-code" data-code="${encodeURIComponent(code)}">
                        <i data-lucide="copy" style="width: 12px; height: 12px;"></i>
                        Copy
                    </button>
                </div>
                <pre><code class="hljs language-${language}">${escapeHtml(code)}</code></pre>
            </div>
        `;
    };
    
    if (typeof marked.use === 'function') {
        marked.use({ renderer });
    } else {
        marked.setOptions({ renderer });
    }

    function renderMarkdown(text) {
        try {
            if (typeof marked.parse === 'function') {
                return marked.parse(text);
            } else {
                return marked(text);
            }
        } catch (e) {
            console.error('Markdown parsing failed, rendering text:', e);
            return escapeHtml(text);
        }
    }

    function cleanMarkdownForDisplay(text) {
        return text
            .replace(/\*\*(.*?)\*\*/g, '$1')
            .replace(/__(.*?)__/g, '$1')
            .replace(/^\s{0,3}#{1,6}\s+/gm, '')
            .replace(/^\s*[-*]\s+/gm, '- ')
            .replace(/\n{3,}/g, '\n\n')
            .trimStart();
    }

    function cleanMarkdownForRender(text) {
        return text
            .replace(/\*\*(.*?)\*\*/g, '$1')
            .replace(/__(.*?)__/g, '$1')
            .replace(/\n{3,}/g, '\n\n')
            .trimStart();
    }

    function splitIntoWordChunks(text) {
        return text.match(/\S+\s*|\s+/g) || [];
    }

    // --- Theme Controller ---
    function setTheme(theme) {
        if (theme === 'light') {
            document.body.classList.add('light-theme');
            themeIcon.setAttribute('data-lucide', 'sun');
            themeText.textContent = 'Light Mode';
            if (hljsTheme) {
                hljsTheme.href = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css';
            }
            localStorage.setItem('theme', 'light');
        } else {
            document.body.classList.remove('light-theme');
            themeIcon.setAttribute('data-lucide', 'moon');
            themeText.textContent = 'Dark Mode';
            if (hljsTheme) {
                hljsTheme.href = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css';
            }
            localStorage.setItem('theme', 'dark');
        }
        lucide.createIcons();
    }

    // Initialize Theme
    const savedTheme = localStorage.getItem('theme') || 'dark';
    setTheme(savedTheme);

    btnThemeToggle.addEventListener('click', () => {
        const isLight = document.body.classList.contains('light-theme');
        setTheme(isLight ? 'dark' : 'light');
        showToast(`Switched to ${isLight ? 'Dark' : 'Light'} Mode`, 'success');
    });

    // --- Sidebar Collapsible Controller ---
    btnSidebarCollapse.addEventListener('click', () => {
        sidebar.classList.add('collapsed');
        btnSidebarExpand.style.display = 'flex';
    });

    btnSidebarExpand.addEventListener('click', () => {
        sidebar.classList.remove('collapsed');
        btnSidebarExpand.style.display = 'none';
    });

    // --- Dynamic Textarea Auto-grow ---
    queryInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight - 4) + 'px';
    });

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
        
        const iconName = type === 'success' ? 'check' : 'alert-circle';
        
        toast.innerHTML = `
            <i data-lucide="${iconName}" class="toast-icon"></i>
            <div class="toast-message">${message}</div>
        `;
        
        toastContainer.appendChild(toast);
        lucide.createIcons();
        
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
            fileInput.value = ''; // Reset input
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

            // Auto-clear chat when a new PDF is uploaded
            const rows = chatMessages.querySelectorAll('.message-row');
            rows.forEach(row => row.remove());
            chatHistory = [];
            welcomeContainer.style.display = 'flex';
            conversationStarted = false;
            document.body.classList.remove('conversation-active');
            
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
                    <i data-lucide="file-text" class="placeholder-icon"></i>
                    <p>No documents uploaded yet. Upload a PDF to start asking questions.</p>
                </div>
            `;
            fileCount.textContent = '0 Files';
            lucide.createIcons();
            return;
        }
        
        fileCount.textContent = `${uploadedFilesList.length} File${uploadedFilesList.length > 1 ? 's' : ''}`;
        fileList.innerHTML = '';
        
        uploadedFilesList.forEach(fileName => {
            const card = document.createElement('div');
            card.className = 'file-card';
            card.innerHTML = `
                <div class="file-card-icon">
                    <i data-lucide="file-text"></i>
                </div>
                <div class="file-card-details">
                    <span class="file-card-name" title="${fileName}">${fileName}</span>
                    <span class="file-card-meta">Ready in ChromaDB</span>
                </div>
            `;
            fileList.appendChild(card);
        });
        lucide.createIcons();
    }

    // --- Conversational Chat Core ---

    // Helper to create a message bubble for smooth line-by-line streaming
    function createStreamingMessage(sender) {
        const messageRow = document.createElement('div');
        messageRow.className = `message-row ${sender}`;
        
        messageRow.innerHTML = `
            <div class="message-avatar">${sender === 'user' ? '<i data-lucide="user"></i>' : '<i data-lucide="bot"></i>'}</div>
            <div class="message-bubble">
                <div class="message-text"><span class="stream-cursor"></span></div>
                <div class="context-container"></div>
                <div class="message-actions-container"></div>
            </div>
        `;
        
        chatMessages.appendChild(messageRow);
        lucide.createIcons();
        
        const textElement = messageRow.querySelector('.message-text');
        const cursorEl = textElement.querySelector('.stream-cursor');
        const contextContainer = messageRow.querySelector('.context-container');
        const actionsContainer = messageRow.querySelector('.message-actions-container');
        
        let rawText = '';
        let displayText = '';
        let fullContext = '';
        
        // Word queue + timer for readable streaming
        let wordQueue = [];
        let isDone = false;
        
        // Plain-text node that grows smoothly before final markdown render
        const streamNode = document.createTextNode('');
        textElement.insertBefore(streamNode, cursorEl);
        
        function flushQueue() {
            if (wordQueue.length > 0) {
                const chunk = wordQueue.shift();
                displayText += chunk;
                streamNode.nodeValue = cleanMarkdownForDisplay(displayText);
                scrollToBottom();
            }
            
            if (wordQueue.length > 0 || !isDone) {
                setTimeout(flushQueue, 55);
            } else {
                finalizeRender();
            }
        }
        
        function finalizeRender() {
            const cleanText = cleanMarkdownForRender(rawText || displayText);
            textElement.innerHTML = renderMarkdown(cleanText);
            textElement.querySelectorAll('pre code').forEach((block) => {
                hljs.highlightElement(block);
            });
            lucide.createIcons();
            scrollToBottom();
        }
        
        // Start the animation loop
        setTimeout(flushQueue, 55);
        
        return {
            element: messageRow,
            appendText(token) {
                rawText += token;
                wordQueue.push(...splitIntoWordChunks(token));
            },
            setContext(context) {
                fullContext = context;
                if (context && context.trim().length > 0) {
                    const uniqueId = `source-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
                    contextContainer.innerHTML = `
                        <div class="sources-accordion">
                            <button class="sources-trigger" data-target="${uniqueId}">
                                <i data-lucide="book-open" style="width: 12px; height: 12px; margin-right: 4px;"></i>
                                View Context Sources
                            </button>
                            <div class="sources-content" id="${uniqueId}">${escapeHtml(context)}</div>
                        </div>
                    `;
                    
                    const trigger = contextContainer.querySelector('.sources-trigger');
                    const targetContent = contextContainer.querySelector(`#${uniqueId}`);
                    
                    trigger.addEventListener('click', () => {
                        const isActive = trigger.classList.toggle('active');
                        targetContent.style.display = isActive ? 'block' : 'none';
                        scrollToBottom();
                    });
                    
                    lucide.createIcons();
                } else {
                    contextContainer.innerHTML = '';
                }
            },
            finalize() {
                // Stop after draining remaining words.
                isDone = true;
                
                if (sender === 'ai') {
                    // Wait for the word queue to drain, then add actions.
                    const waitForRender = () => {
                        if (wordQueue.length === 0) {
                            // Small settle delay so markdown is painted first
                            setTimeout(() => {
                                actionsContainer.innerHTML = `
                                    <div class="message-actions-wrapper">
                                        <button class="btn-message-action btn-copy-message">
                                            <i data-lucide="copy"></i> Copy
                                        </button>
                                    </div>
                                `;
                                lucide.createIcons();
                            }, 80);
                        } else {
                            setTimeout(waitForRender, 55);
                        }
                    };
                    setTimeout(waitForRender, 55);
                }
            },
            getFullText() {
                return cleanMarkdownForDisplay(rawText || displayText);
            },
            getFullContext() {
                return fullContext;
            }
        };
    }

    // Chat submit handler
    chatForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const question = queryInput.value.trim();
        if (!question) return;
        
        queryInput.value = '';
        queryInput.style.height = 'auto';
        
        if (!conversationStarted) {
            welcomeContainer.style.display = 'none';
            conversationStarted = true;
            document.body.classList.add('conversation-active');
        }
        
        appendMessage('user', question);
        scrollToBottom();
        
        typingIndicator.style.display = 'flex';
        scrollToBottom();
        
        let messageUpdater = null;
        try {
            const response = await fetch(`${BASE_URL}/query`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    question: question,
                    chat_history: chatHistory
                })
            });
            
            if (!response.ok) {
                throw new Error(`API error: ${response.status} ${response.statusText}`);
            }
            
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop(); // Keep last partial line
                
                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed) continue;
                    
                    if (trimmed.startsWith('data: ')) {
                        const dataStr = trimmed.slice(6).trim();
                        if (dataStr === '[DONE]') {
                            break;
                        }
                        
                        try {
                            const parsed = JSON.parse(dataStr);
                            if (parsed.type === 'context') {
                                if (!messageUpdater) {
                                    typingIndicator.style.display = 'none';
                                    messageUpdater = createStreamingMessage('ai');
                                }
                                messageUpdater.setContext(parsed.content);
                                scrollToBottom();
                            } else if (parsed.type === 'token') {
                                if (!messageUpdater) {
                                    typingIndicator.style.display = 'none';
                                    messageUpdater = createStreamingMessage('ai');
                                }
                                messageUpdater.appendText(parsed.content);
                                scrollToBottom();
                            } else if (parsed.type === 'error') {
                                if (!messageUpdater) {
                                    typingIndicator.style.display = 'none';
                                    messageUpdater = createStreamingMessage('ai');
                                }
                                messageUpdater.appendText(`\n⚠️ Error: ${parsed.content}`);
                                scrollToBottom();
                            }
                        } catch (err) {
                            console.error('Failed to parse SSE line:', dataStr, err);
                        }
                    }
                }
            }
            
            typingIndicator.style.display = 'none';
            
            if (messageUpdater) {
                messageUpdater.finalize();
                
                // Defer history storage until the RAF queue has fully drained
                // so getFullText() returns the complete accumulated response
                const storeHistory = () => {
                    const text = messageUpdater.getFullText();
                    // If text is still growing wait another frame
                    requestAnimationFrame(() => {
                        const textNow = messageUpdater.getFullText();
                        if (textNow !== text) {
                            storeHistory(); // still streaming, retry
                        } else {
                            chatHistory.push({ role: 'user', content: question });
                            chatHistory.push({ role: 'assistant', content: textNow });
                            // Keep history bounded to last 10 turns (5 exchanges)
                            if (chatHistory.length > 10) {
                                chatHistory = chatHistory.slice(chatHistory.length - 10);
                            }
                        }
                    });
                };
                storeHistory();
            }
            
        } catch (error) {
            console.error('Chat query failed:', error);
            typingIndicator.style.display = 'none';
            if (messageUpdater) {
                messageUpdater.appendText(`\n⚠️ Connection Error: Failed to retrieve answer. Please make sure the backend is running.\n\nDetails: ${error.message}`);
                messageUpdater.finalize();
            } else {
                appendMessage('ai', `⚠️ Connection Error: Failed to retrieve answer. Please make sure the backend is running.\n\nDetails: ${error.message}`);
            }
            scrollToBottom();
        }
    });

    // Create and append static conversational speech bubble
    function appendMessage(sender, text, context = null) {
        const messageRow = document.createElement('div');
        messageRow.className = `message-row ${sender}`;
        
        let contextAccordionHtml = '';
        if (sender === 'ai' && context && context.trim().length > 0) {
            const uniqueId = `source-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
            contextAccordionHtml = `
                <div class="sources-accordion">
                    <button class="sources-trigger" data-target="${uniqueId}">
                        <i data-lucide="book-open" style="width: 12px; height: 12px; margin-right: 4px;"></i>
                        View Context Sources
                    </button>
                    <div class="sources-content" id="${uniqueId}">${escapeHtml(context)}</div>
                </div>
            `;
        }
        
        let contentHtml = '';
        if (sender === 'user') {
            contentHtml = escapeHtml(text);
        } else {
            contentHtml = renderMarkdown(cleanMarkdownForRender(text));
        }
        
        let actionsHtml = '';
        if (sender === 'ai') {
            actionsHtml = `
                <div class="message-actions-wrapper">
                    <button class="btn-message-action btn-copy-message">
                        <i data-lucide="copy"></i> Copy
                    </button>
                </div>
            `;
        }
        
        messageRow.innerHTML = `
            <div class="message-avatar">${sender === 'user' ? '<i data-lucide="user"></i>' : '<i data-lucide="bot"></i>'}</div>
            <div class="message-bubble">
                <div class="message-text">${contentHtml}</div>
                ${contextAccordionHtml}
                ${actionsHtml}
            </div>
        `;
        
        chatMessages.appendChild(messageRow);
        
        if (sender === 'ai') {
            messageRow.querySelectorAll('pre code').forEach((block) => {
                hljs.highlightElement(block);
            });
        }
        
        lucide.createIcons();
        
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

    // Clipboard Copy Event Listeners using delegation
    chatMessages.addEventListener('click', (e) => {
        // Handle Copy Code Button
        const copyCodeBtn = e.target.closest('.btn-copy-code');
        if (copyCodeBtn) {
            const code = decodeURIComponent(copyCodeBtn.getAttribute('data-code'));
            navigator.clipboard.writeText(code).then(() => {
                showToast('Code block copied!', 'success');
            }).catch(err => {
                console.error('Failed to copy code block:', err);
                showToast('Failed to copy code.', 'error');
            });
            return;
        }
        
        // Handle Copy Response Button
        const copyMsgBtn = e.target.closest('.btn-copy-message');
        if (copyMsgBtn) {
            const messageRow = copyMsgBtn.closest('.message-row');
            const textContent = messageRow.querySelector('.message-text').innerText;
            navigator.clipboard.writeText(textContent).then(() => {
                showToast('Response copied!', 'success');
            }).catch(err => {
                console.error('Failed to copy response text:', err);
                showToast('Failed to copy response.', 'error');
            });
        }
    });

    // Clear conversation
    btnClearChat.addEventListener('click', () => {
        const rows = chatMessages.querySelectorAll('.message-row');
        rows.forEach(row => row.remove());
        
        chatHistory = [];
        welcomeContainer.style.display = 'flex';
        conversationStarted = false;
        document.body.classList.remove('conversation-active');
        showToast('Chat history cleared.', 'success');
    });

    // Quick prompt pill handlers
    quickPrompts.addEventListener('click', (e) => {
        const pill = e.target.closest('.prompt-pill');
        if (pill) {
            const promptText = pill.innerText.trim();
            queryInput.value = promptText;
            queryInput.dispatchEvent(new Event('input')); // auto-grow
            queryInput.focus();
        }
    });

    // Helpers
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
    fetchActiveFiles();
});

