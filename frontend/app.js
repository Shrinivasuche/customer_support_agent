// ----------------- App Configuration & Globals -----------------
const API_BASE = window.location.origin; // Dynamically uses same host and port (e.g. localhost:8000)

let currentHistory = [];
let isProcessing = false;

// ----------------- DOM Element References -----------------
const apiKeyInput = document.getElementById('api-key-input');
const saveKeyBtn = document.getElementById('save-key-btn');
const keyStatusDot = document.getElementById('key-status-dot');
const keyStatusText = document.getElementById('key-status-text');

const chatMessagesContainer = document.getElementById('chat-messages-container');
const chatInput = document.getElementById('chat-input');
const sendQueryBtn = document.getElementById('send-query-btn');
const clearChatBtn = document.getElementById('clear-chat-btn');
const quickTemplates = document.querySelectorAll('.template-btn');

const timelineContainer = document.getElementById('timeline-container');
const historyTableBody = document.getElementById('history-table-body');
const historySearch = document.getElementById('history-search');

// ----------------- Initialization & Event Listeners -----------------
document.addEventListener('DOMContentLoaded', () => {
    checkSettings();
    loadHistory();

    // Event listeners
    saveKeyBtn.addEventListener('click', saveApiKey);
    sendQueryBtn.addEventListener('click', submitQuery);
    clearChatBtn.addEventListener('click', clearHistory);
    historySearch.addEventListener('input', handleHistorySearch);

    // Support entering queries via press Enter
    chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            submitQuery();
        }
    });

    // Support quick prompts template buttons
    quickTemplates.forEach(btn => {
        btn.addEventListener('click', () => {
            if (isProcessing) return;
            chatInput.value = btn.getAttribute('data-query');
            submitQuery();
        });
    });
});

// ----------------- API Settings (API Key Management) -----------------
async function checkSettings() {
    try {
        const response = await fetch(`${API_BASE}/api/settings`);
        const data = await response.json();
        
        if (data.hasKey) {
            keyStatusDot.className = 'status-dot status-active';
            keyStatusText.textContent = `Connected: ${data.keyPreview}`;
            apiKeyInput.placeholder = '••••••••••••••••••••••••••••••••';
            apiKeyInput.value = '';
        } else {
            keyStatusDot.className = 'status-dot status-inactive';
            keyStatusText.textContent = 'Key Not Configured';
            apiKeyInput.placeholder = 'Paste Gemini API Key here...';
            apiKeyInput.value = '';
        }
    } catch (err) {
        console.error('Error checking API status:', err);
    }
}

async function saveApiKey() {
    const key = apiKeyInput.value.trim();
    if (!key) {
        alert('Please enter a valid API Key first.');
        return;
    }

    saveKeyBtn.disabled = true;
    saveKeyBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Saving...';

    try {
        const response = await fetch(`${API_BASE}/api/settings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ apiKey: key })
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert('Gemini API Key successfully saved and updated!');
            await checkSettings();
        } else {
            alert(`Error saving credentials: ${data.error}`);
        }
    } catch (err) {
        alert('Network error while saving credentials. Make sure server is running.');
        console.error(err);
    } finally {
        saveKeyBtn.disabled = false;
        saveKeyBtn.innerHTML = '<i class="fa-solid fa-save"></i> Save Key';
    }
}

// ----------------- Query Processing & Graph Execution -----------------
async function submitQuery() {
    const query = chatInput.value.trim();
    if (!query) return;
    if (isProcessing) return;

    // Reset components & set busy state
    isProcessing = true;
    chatInput.value = '';
    chatInput.disabled = true;
    sendQueryBtn.disabled = true;
    
    // Add user message to UI
    appendUserMessage(query);
    
    // Clear graph highlights & timeline
    resetGraphHighlights();
    renderTimelineLoading();

    try {
        const response = await fetch(`${API_BASE}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: query })
        });

        const data = await response.json();

        if (data.success) {
            // Sequential step-by-step animation of LangGraph nodes
            await animateGraphExecution(data.steps, data.response);
            loadHistory(); // Reload table
        } else {
            renderTimelineError(data.error);
            appendAgentMessage(`❌ Error: ${data.error || 'Server error occurred.'}`);
        }
    } catch (err) {
        renderTimelineError('Failed to establish API connection to server backend.');
        appendAgentMessage('❌ Network error. Make sure the FastAPI python backend is active on port 8000.');
        console.error(err);
    } finally {
        isProcessing = false;
        chatInput.disabled = false;
        sendQueryBtn.disabled = false;
        chatInput.focus();
    }
}

// ----------------- Graph & Timeline Animations -----------------
function resetGraphHighlights() {
    // Remove active class from all SVG nodes
    document.querySelectorAll('.workflow-svg .node').forEach(node => {
        node.classList.remove('active');
    });
    // Remove active class from all SVG edges
    document.querySelectorAll('.workflow-svg .edge').forEach(edge => {
        edge.classList.remove('active');
    });
}

function renderTimelineLoading() {
    timelineContainer.innerHTML = `
        <div class="timeline-empty-state">
            <i class="fa-solid fa-circle-notch fa-spin text-accent" style="font-size: 2.2rem;"></i>
            <p style="margin-top: 10px;">FastAPI Backend active.<br>Streaming LangGraph state changes...</p>
        </div>
    `;
}

function renderTimelineError(msg) {
    timelineContainer.innerHTML = `
        <div class="timeline-empty-state" style="color: var(--accent-rose);">
            <i class="fa-solid fa-circle-exclamation" style="font-size: 2.2rem;"></i>
            <p style="margin-top: 10px; font-weight: 500;">Execution Halted</p>
            <span style="font-size: 0.75rem; color: var(--text-muted); max-width: 220px; line-height: 1.4;">${msg}</span>
        </div>
    `;
}

// Sequential state graph tracer!
function animateGraphExecution(steps, finalResponse) {
    return new Promise(async (resolve) => {
        timelineContainer.innerHTML = ''; // Clear loading spinner
        
        let previousNode = null;

        for (let i = 0; i < steps.length; i++) {
            const step = steps[i];
            const node = step.node;
            const state = step.state;

            // Highlight the active SVG node
            const svgNode = document.getElementById(`node-${node}`);
            if (svgNode) svgNode.classList.add('active');

            // Highlight the active SVG link/edge connecting from the previous node
            if (previousNode) {
                let edgeId = `edge-${previousNode}-${node}`;
                // Handle naming normalization for routing
                if (previousNode === 'analyze_sentiment') {
                    if (node === 'handle_technical') edgeId = 'edge-sent-tech';
                    if (node === 'handle_billing') edgeId = 'edge-sent-bill';
                    if (node === 'handle_general') edgeId = 'edge-sent-gen';
                    if (node === 'escalate') edgeId = 'edge-sent-esc';
                }
                const svgEdge = document.getElementById(edgeId);
                if (svgEdge) svgEdge.classList.add('active');
            } else {
                // First edge from input to categorize
                const firstEdge = document.getElementById('edge-cat-sent');
                // We keep it dashed, but categorized gets loaded first
            }

            // Append Step to visual trace timeline
            appendTimelineItem(i + 1, node, state);
            scrollContainer(timelineContainer);

            // Wait before moving to next state node for beautiful real-time mapping visibility!
            await delay(900);

            // Un-highlight nodes/edges when passing them (optional, but keeping it active creates a full execution path glow!)
            // We'll keep them glowing to show the exact routing path taken through the graph!
            previousNode = node;
        }

        // Highlight END node & its incoming edge at the very end
        const endNode = document.getElementById('node-end');
        if (endNode) endNode.classList.add('active');
        
        if (previousNode) {
            let lastEdgeId = '';
            if (previousNode === 'handle_technical') lastEdgeId = 'edge-tech-end';
            if (previousNode === 'handle_billing') lastEdgeId = 'edge-bill-end';
            if (previousNode === 'handle_general') lastEdgeId = 'edge-gen-end';
            if (previousNode === 'escalate') lastEdgeId = 'edge-esc-end';
            
            const lastEdge = document.getElementById(lastEdgeId);
            if (lastEdge) lastEdge.classList.add('active');
        }

        // Add the agent's finalized answer bubble
        appendAgentMessage(finalResponse);
        resolve();
    });
}

function appendTimelineItem(stepNum, node, state) {
    const item = document.createElement('div');
    item.className = 'timeline-item active';
    if (node === 'escalate') item.className += ' escalated';

    let badgeIcon = '<i class="fa-solid fa-cogs"></i>';
    let title = '';
    let body = '';

    if (node === 'categorize') {
        badgeIcon = '<i class="fa-solid fa-filter"></i>';
        title = 'Router Node: Categorize';
        body = `
            <div>Analyzed request semantics. Evaluated category as:</div>
            <span class="state-pill pill-${state.category.toLowerCase().substring(0,4)}">${state.category}</span>
        `;
    } else if (node === 'analyze_sentiment') {
        badgeIcon = '<i class="fa-solid fa-heart"></i>';
        title = 'Router Node: Sentiment';
        body = `
            <div>Checked vocabulary and emotional intensity. Sentiment classified:</div>
            <span class="state-pill pill-${state.sentiment.toLowerCase().substring(0,3)}">${state.sentiment}</span>
        `;
    } else if (node.startsWith('handle_')) {
        badgeIcon = '<i class="fa-solid fa-reply"></i>';
        const type = node.replace('handle_', '');
        title = `Response Node: Support (${type.toUpperCase()})`;
        body = `
            <div>Resolved branch routing successfully. Generating AI support response tailored for <strong>${type}</strong> query...</div>
        `;
    } else if (node === 'escalate') {
        badgeIcon = '<i class="fa-solid fa-triangle-exclamation"></i>';
        title = 'Action Node: Escalation Active';
        body = `
            <div class="text-rose" style="color: var(--accent-rose); font-weight: 500;">
                Sentiment classified as NEGATIVE. Automatically bypassing LLM answer generator and queueing for Senior Human Support.
            </div>
        `;
    }

    item.innerHTML = `
        <div class="timeline-badge">${badgeIcon}</div>
        <div class="timeline-content">
            <h4>Step ${stepNum}: ${title}</h4>
            <div class="timeline-body">${body}</div>
        </div>
    `;

    timelineContainer.appendChild(item);
}

// Helper utilities
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

function scrollContainer(container) {
    container.scrollTo({
        top: container.scrollHeight,
        behavior: 'smooth'
    });
}

// ----------------- Chat Bubble Management -----------------
function appendUserMessage(text) {
    const bubble = document.createElement('div');
    bubble.className = 'message message-user';
    bubble.innerHTML = `
        <div class="message-avatar">
            <i class="fa-solid fa-user"></i>
        </div>
        <div class="message-content">
            <p>${escapeHtml(text)}</p>
        </div>
    `;
    chatMessagesContainer.appendChild(bubble);
    scrollContainer(chatMessagesContainer);
}

function appendAgentMessage(text) {
    const bubble = document.createElement('div');
    bubble.className = 'message message-agent';
    bubble.innerHTML = `
        <div class="message-avatar">
            <i class="fa-solid fa-robot"></i>
        </div>
        <div class="message-content">
            <p>${formatMessageResponse(text)}</p>
        </div>
    `;
    chatMessagesContainer.appendChild(bubble);
    scrollContainer(chatMessagesContainer);
}

function formatMessageResponse(text) {
    // Standard utility to handle markdown-like symbols safely
    let formatted = escapeHtml(text);
    // Replace newlines with <br>
    formatted = formatted.replace(/\n/g, '<br>');
    // Bold highlight (**text**)
    formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    // Bullet lists (* text)
    formatted = formatted.replace(/^(?:\*\s+)(.*?)$/gm, '• $1');
    // Embedded inline code
    formatted = formatted.replace(/`(.*?)`/g, '<code>$1</code>');
    return formatted;
}

function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// ----------------- History & Log Analytics -----------------
async function loadHistory() {
    try {
        const response = await fetch(`${API_BASE}/api/history`);
        const data = await response.json();
        currentHistory = data;
        renderHistoryTable(currentHistory);
    } catch (err) {
        console.error('Error fetching chat history:', err);
    }
}

function renderHistoryTable(logs) {
    if (!logs || logs.length === 0) {
        historyTableBody.innerHTML = `
            <tr class="empty-row">
                <td colspan="5">No interaction history found. Send a message to start!</td>
            </tr>
        `;
        return;
    }

    historyTableBody.innerHTML = '';
    logs.forEach(log => {
        const tr = document.createElement('tr');
        
        let catClass = `pill-${log.category.toLowerCase().substring(0,4)}`;
        let sentClass = `pill-${log.sentiment.toLowerCase().substring(0,3)}`;

        // Clip very long queries/responses for table grid layout
        const clippedQuery = log.query.length > 55 ? log.query.substring(0, 52) + '...' : log.query;
        const clippedResp = log.response.length > 70 ? log.response.substring(0, 67) + '...' : log.response;

        tr.innerHTML = `
            <td style="white-space: nowrap; color: var(--text-muted);">${log.timestamp}</td>
            <td title="${escapeHtml(log.query)}">${escapeHtml(clippedQuery)}</td>
            <td><span class="state-pill ${catClass}">${log.category}</span></td>
            <td><span class="state-pill ${sentClass}">${log.sentiment}</span></td>
            <td title="${escapeHtml(log.response)}">${escapeHtml(clippedResp)}</td>
        `;
        historyTableBody.appendChild(tr);
    });
}

function handleHistorySearch() {
    const term = historySearch.value.trim().toLowerCase();
    if (!term) {
        renderHistoryTable(currentHistory);
        return;
    }

    const filtered = currentHistory.filter(log => {
        return log.query.toLowerCase().includes(term) ||
               log.category.toLowerCase().includes(term) ||
               log.sentiment.toLowerCase().includes(term) ||
               log.response.toLowerCase().includes(term);
    });

    renderHistoryTable(filtered);
}

async function clearHistory() {
    if (!confirm('Are you sure you want to permanently clear your chat history logs?')) return;
    
    try {
        const response = await fetch(`${API_BASE}/api/history/clear`, { method: 'POST' });
        const data = await response.json();
        
        if (data.success) {
            // Reset local chats display
            chatMessagesContainer.innerHTML = `
                <div class="message system-message">
                    <div class="message-avatar">
                        <i class="fa-solid fa-robot"></i>
                    </div>
                    <div class="message-content">
                        <p>Chat logs successfully cleared. Ready for new interactions!</p>
                    </div>
                </div>
            `;
            // Reset execution traces
            timelineContainer.innerHTML = `
                <div class="timeline-empty-state">
                    <i class="fa-solid fa-wave-square"></i>
                    <p>Submit a customer query to inspect the step-by-step agent decisions and state changes.</p>
                </div>
            `;
            resetGraphHighlights();
            await loadHistory();
        } else {
            alert(`Failed to clear: ${data.error}`);
        }
    } catch (err) {
        alert('Network error while resetting history.');
        console.error(err);
    }
}
