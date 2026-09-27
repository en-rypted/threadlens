import { ThreadInfo } from './parser';
import { DeadlockInfo } from './deadlockDetector';

export function getWebviewContent(threads: ThreadInfo[], deadlocks: DeadlockInfo[]): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Thread Dump Dashboard</title>
    <style>
        :root {
            --anim-duration: 0.2s;
        }
        body {
            font-family: var(--vscode-font-family);
            color: var(--vscode-editor-foreground);
            background-color: var(--vscode-editor-background);
            padding: 20px;
            margin: 0;
            display: flex;
            flex-direction: column;
            height: 100vh;
            box-sizing: border-box;
        }
        
        /* Layout */
        header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid var(--vscode-panel-border);
            padding-bottom: 15px;
            margin-bottom: 20px;
        }
        h1 { margin: 0; font-size: 1.5rem; font-weight: 600; }
        
        /* Stats Grid */
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 15px;
            margin-bottom: 20px;
        }
        .stat-card {
            background: var(--vscode-editorWidget-background);
            border: 1px solid var(--vscode-widget-border);
            border-radius: 6px;
            padding: 15px;
            text-align: center;
            transition: transform var(--anim-duration) ease, box-shadow var(--anim-duration) ease, border-color var(--anim-duration) ease;
            cursor: pointer;
        }
        .stat-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            border-color: var(--vscode-focusBorder);
        }
        .stat-value {
            font-size: 2.2rem;
            font-weight: 700;
            margin-bottom: 5px;
        }
        .stat-label {
            font-size: 0.8rem;
            opacity: 0.7;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            font-weight: 600;
        }
        
        /* State Colors */
        .color-runnable { color: var(--vscode-testing-iconPassed); }
        .color-blocked { color: var(--vscode-testing-iconFailed); }
        .color-waiting { color: var(--vscode-testing-iconQueued); }
        .color-deadlock { color: var(--vscode-errorForeground); }

        /* Controls */
        .controls {
            display: flex;
            gap: 10px;
            margin-bottom: 15px;
        }
        input[type="text"] {
            flex: 1;
            padding: 10px 12px;
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            border-radius: 4px;
            outline: none;
            font-family: inherit;
        }
        input[type="text"]:focus {
            border-color: var(--vscode-focusBorder);
        }
        select {
            padding: 10px 12px;
            background: var(--vscode-dropdown-background);
            color: var(--vscode-dropdown-foreground);
            border: 1px solid var(--vscode-dropdown-border);
            border-radius: 4px;
            outline: none;
            font-family: inherit;
            cursor: pointer;
        }
        button.primary {
            padding: 10px 16px;
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-weight: 600;
            transition: background 0.2s;
        }
        button.primary:hover {
            background: var(--vscode-button-hoverBackground);
        }

        /* Thread List */
        .thread-list {
            flex: 1;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            gap: 8px;
            padding-right: 5px;
        }
        
        /* Custom Scrollbar for list */
        .thread-list::-webkit-scrollbar { width: 8px; }
        .thread-list::-webkit-scrollbar-track { background: transparent; }
        .thread-list::-webkit-scrollbar-thumb { background: var(--vscode-scrollbarSlider-background); border-radius: 4px; }
        .thread-list::-webkit-scrollbar-thumb:hover { background: var(--vscode-scrollbarSlider-hoverBackground); }

        .thread-item {
            background: var(--vscode-editorWidget-background);
            border: 1px solid var(--vscode-widget-border);
            border-radius: 6px;
            overflow: hidden;
            transition: border-color var(--anim-duration);
        }
        .thread-item:focus-within {
            border-color: var(--vscode-focusBorder);
        }
        .thread-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px 16px;
            cursor: pointer;
            user-select: none;
            transition: background 0.2s;
        }
        .thread-header:hover {
            background: var(--vscode-list-hoverBackground);
        }
        .thread-name { font-weight: 600; font-size: 0.95rem; }
        .thread-badges { display: flex; gap: 6px; align-items: center; }
        .badge {
            padding: 3px 8px;
            border-radius: 12px;
            font-size: 0.7rem;
            font-weight: 600;
            background: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            letter-spacing: 0.5px;
        }
        .badge.state-runnable { background: var(--vscode-testing-iconPassed); color: white; }
        .badge.state-blocked { background: var(--vscode-testing-iconFailed); color: white; }
        .badge.state-waiting, .badge.state-timed_waiting { background: var(--vscode-testing-iconQueued); color: white; }
        
        .thread-body {
            padding: 0 16px;
            max-height: 0;
            overflow: hidden;
            opacity: 0;
            transition: max-height var(--anim-duration) ease-out, padding var(--anim-duration) ease, opacity var(--anim-duration);
        }
        .thread-item.expanded .thread-body {
            padding: 16px;
            max-height: 2000px;
            opacity: 1;
            border-top: 1px solid var(--vscode-widget-border);
        }
        
        .locks-info {
            display: flex;
            flex-direction: column;
            gap: 6px;
            margin-bottom: 15px;
            font-family: var(--vscode-editor-font-family);
            font-size: 0.9rem;
        }
        .locks-info span.lock-id {
            background: rgba(0,0,0,0.2);
            padding: 2px 6px;
            border-radius: 4px;
            color: var(--vscode-symbolIcon-constantForeground);
        }

        pre {
            margin: 0;
            padding: 12px;
            background: var(--vscode-textCodeBlock-background, rgba(0,0,0,0.15));
            border-radius: 6px;
            overflow-x: auto;
            font-family: var(--vscode-editor-font-family);
            font-size: 0.85rem;
            line-height: 1.4;
        }
        .deadlock-alert {
            background: rgba(255, 0, 0, 0.1);
            border: 1px solid var(--vscode-errorForeground);
            border-left: 5px solid var(--vscode-errorForeground);
            border-radius: 6px;
            padding: 15px 20px;
            margin-bottom: 20px;
            display: none;
            animation: pulse 2s infinite;
        }
        @keyframes pulse {
            0% { box-shadow: 0 0 0 0 rgba(255,0,0,0.2); }
            70% { box-shadow: 0 0 0 10px rgba(255,0,0,0); }
            100% { box-shadow: 0 0 0 0 rgba(255,0,0,0); }
        }
        .deadlock-alert h3 { margin: 0 0 10px 0; color: var(--vscode-errorForeground); display: flex; align-items: center; gap: 8px;}
        .deadlock-alert.active { display: block; }
    </style>
</head>
<body>
    <header>
        <h1>Thread Dump Dashboard</h1>
        <button id="ai-btn" class="primary">🧠 Run AI Analysis</button>
    </header>

    <div id="deadlock-container" class="deadlock-alert"></div>

    <div class="stats-grid" id="stats-grid">
        <!-- Stats populated by JS -->
    </div>

    <div class="controls">
        <input type="text" id="search-input" placeholder="Search threads by name, ID, or lock..." />
        <select id="state-filter">
            <option value="ALL">All States</option>
            <option value="RUNNABLE">Runnable</option>
            <option value="BLOCKED">Blocked</option>
            <option value="WAITING">Waiting</option>
        </select>
        <select id="type-filter">
            <option value="ALL">All Types</option>
            <option value="DAEMON">Daemon Only</option>
            <option value="APP">App Threads (Non-Daemon)</option>
        </select>
    </div>

    <div class="thread-list" id="thread-list">
        <!-- Threads populated by JS -->
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        
        // Inject data safely
        const state = {
            threads: ${JSON.stringify(threads).replace(/</g, '\\u003c')},
            deadlocks: ${JSON.stringify(deadlocks).replace(/</g, '\\u003c')},
            filters: {
                search: '',
                state: 'ALL',
                type: 'ALL'
            }
        };

        // DOM Elements
        const statsGrid = document.getElementById('stats-grid');
        const threadList = document.getElementById('thread-list');
        const searchInput = document.getElementById('search-input');
        const stateFilter = document.getElementById('state-filter');
        const typeFilter = document.getElementById('type-filter');
        const deadlockContainer = document.getElementById('deadlock-container');
        
        // Listeners
        document.getElementById('ai-btn').addEventListener('click', () => {
            vscode.postMessage({ command: 'runAiAnalysis' });
        });

        searchInput.addEventListener('input', (e) => { state.filters.search = e.target.value.toLowerCase(); renderThreads(); });
        stateFilter.addEventListener('change', (e) => { state.filters.state = e.target.value; renderThreads(); });
        typeFilter.addEventListener('change', (e) => { state.filters.type = e.target.value; renderThreads(); });

        function init() {
            renderStats();
            renderDeadlocks();
            renderThreads();
        }

        function renderStats() {
            let runnable = 0, blocked = 0, waiting = 0;
            state.threads.forEach(t => {
                const s = (t.state || '').toUpperCase();
                if (s === 'RUNNABLE') runnable++;
                else if (s === 'BLOCKED') blocked++;
                else if (s.includes('WAITING')) waiting++;
            });

            statsGrid.innerHTML = \`
                <div class="stat-card" onclick="document.getElementById('state-filter').value='ALL'; document.getElementById('state-filter').dispatchEvent(new Event('change'))">
                    <div class="stat-value">\${state.threads.length}</div>
                    <div class="stat-label">Total Threads</div>
                </div>
                <div class="stat-card" onclick="document.getElementById('state-filter').value='RUNNABLE'; document.getElementById('state-filter').dispatchEvent(new Event('change'))">
                    <div class="stat-value color-runnable">\${runnable}</div>
                    <div class="stat-label">Runnable</div>
                </div>
                <div class="stat-card" onclick="document.getElementById('state-filter').value='BLOCKED'; document.getElementById('state-filter').dispatchEvent(new Event('change'))">
                    <div class="stat-value color-blocked">\${blocked}</div>
                    <div class="stat-label">Blocked</div>
                </div>
                <div class="stat-card" onclick="document.getElementById('state-filter').value='WAITING'; document.getElementById('state-filter').dispatchEvent(new Event('change'))">
                    <div class="stat-value color-waiting">\${waiting}</div>
                    <div class="stat-label">Waiting</div>
                </div>
            \`;
        }

        function renderDeadlocks() {
            if (state.deadlocks.length > 0) {
                deadlockContainer.classList.add('active');
                let html = \`<h3>⚠️ \${state.deadlocks.length} Deadlock(s) Detected</h3>\`;
                state.deadlocks.forEach((d, i) => {
                    const cycleStr = d.cycle.map(t => \`<strong>\${t.name}</strong>\`).join(' ➔ ');
                    html += \`<div style="margin-top:8px">Cycle \${i + 1}: \${cycleStr} ➔ (loop)</div>\`;
                });
                deadlockContainer.innerHTML = html;
            }
        }

        function renderThreads() {
            threadList.innerHTML = '';
            
            const filtered = state.threads.filter(t => {
                // Type filter
                if (state.filters.type === 'DAEMON' && !t.daemon) return false;
                if (state.filters.type === 'APP' && t.daemon) return false;
                
                // State filter
                const s = (t.state || '').toUpperCase();
                if (state.filters.state !== 'ALL') {
                    if (state.filters.state === 'WAITING' && !s.includes('WAITING')) return false;
                    if (state.filters.state !== 'WAITING' && s !== state.filters.state) return false;
                }
                
                // Search filter
                if (state.filters.search) {
                    const q = state.filters.search;
                    const matchName = (t.name || '').toLowerCase().includes(q);
                    const matchId = (t.nid || '').toLowerCase().includes(q) || (t.tid || '').toLowerCase().includes(q);
                    const matchLocks = t.locksHeld.some(l => l.toLowerCase().includes(q)) || 
                                     (t.waitingOnLock || '').toLowerCase().includes(q) ||
                                     (t.waitingToLock || '').toLowerCase().includes(q);
                    if (!matchName && !matchId && !matchLocks) return false;
                }
                
                return true;
            });

            if (filtered.length === 0) {
                threadList.innerHTML = '<div style="text-align:center; opacity:0.6; padding: 30px; font-size: 1.1rem;">No threads match your filters.</div>';
                return;
            }

            const fragment = document.createDocumentFragment();
            filtered.forEach((t, i) => {
                const item = document.createElement('div');
                item.className = 'thread-item';
                
                const safeState = (t.state || 'UNKNOWN').toLowerCase();
                
                let locksHtml = '';
                if (t.locksHeld.length > 0 || t.waitingOnLock || t.waitingToLock) {
                    locksHtml = '<div class="locks-info">';
                    if (t.locksHeld.length > 0) locksHtml += \`<div><strong>Held Locks:</strong> \${t.locksHeld.map(l => \`<span class="lock-id">\${l}</span>\`).join(', ')}</div>\`;
                    if (t.waitingOnLock) locksHtml += \`<div><strong>Waiting On:</strong> <span class="lock-id">\${t.waitingOnLock}</span></div>\`;
                    if (t.waitingToLock) locksHtml += \`<div><strong>Waiting To Lock:</strong> <span class="lock-id">\${t.waitingToLock}</span></div>\`;
                    locksHtml += '</div>';
                }
                
                item.innerHTML = \`
                    <div class="thread-header" onclick="this.parentElement.classList.toggle('expanded')">
                        <span class="thread-name">\${t.name}</span>
                        <div class="thread-badges">
                            \${t.daemon ? '<span class="badge" style="background:rgba(128,128,128,0.2); color:inherit">DAEMON</span>' : ''}
                            <span class="badge state-\${safeState}">\${t.state || 'UNKNOWN'}</span>
                            <span class="badge" style="background:rgba(128,128,128,0.2); color:inherit">NID: \${t.nid}</span>
                        </div>
                    </div>
                    <div class="thread-body">
                        \${locksHtml}
                        <div style="font-weight:600; margin-bottom:6px">Stack Trace:</div>
                        <pre>\${t.stackTrace.join('\\n')}</pre>
                    </div>
                \`;
                fragment.appendChild(item);
            });
            threadList.appendChild(fragment);
        }

        init();
    </script>
</body>
</html>`;
}
