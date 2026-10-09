/* ═══════════════════════════════════════════════════════════════════════
   PRO LAB 02 — THE VANISHING CONSENSUS — Desktop Environment JS
   Interactive Cyber Investigation OS
   Case NEX-071 — IoT × Web3 × AI × Blockchain Cross-Layer Investigation
   ═══════════════════════════════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {

    // ── 65-Minute Investigation Session Timer ─────────────────────────
    const MAX_SESSION_SECONDS = 65 * 60; // 3900 seconds (65 minutes)
    let startTime = sessionStorage.getItem('lab7_timer_start') || sessionStorage.getItem('nexora_lab7_timer_start');
    let timerInterval = null;
    let timerExpired = false;

    function updateTimerDisplay(elapsed) {
        const timerText = document.getElementById('gl-timer-text');
        if (!timerText) return;
        const h = String(Math.floor(elapsed / 3600)).padStart(2, '0');
        const m = String(Math.floor((elapsed % 3600) / 60)).padStart(2, '0');
        const s = String(elapsed % 60).padStart(2, '0');
        timerText.textContent = `${h}:${m}:${s}`;
    }

    function runTimerTick() {
        if (!startTime) return;
        const elapsed = Math.max(0, Math.floor((Date.now() - startTime) / 1000));
        
        if (elapsed >= MAX_SESSION_SECONDS && !timerExpired) {
            timerExpired = true;
            if (timerInterval) clearInterval(timerInterval);
            sessionStorage.removeItem('lab7_timer_start');
            sessionStorage.removeItem('nexora_lab7_timer_start');
            sessionStorage.removeItem('lab7_capstone_passed');
            sessionStorage.removeItem('nexora_lab7_capstone_passed');
            const timerText = document.getElementById('gl-timer-text');
            if (timerText) timerText.textContent = '01:05:00';
            
            alert('⏰ Investigation Time Limit (65 min) reached!\nCase NEX-071 will now automatically restart from the beginning.');
            
            fetch('/api/lab/restart', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-CSRFToken': window.csrfToken },
                body: JSON.stringify({ lab_id: 'lab7' })
            }).finally(() => {
                window.location.reload();
            });
            return;
        }

        updateTimerDisplay(elapsed);
    }

    // Check if session is already active (page refresh)
    if (startTime) {
        startTime = parseInt(startTime, 10);
        const btn = document.getElementById('gl-start-lab-btn');
        if (btn) { btn.textContent = '🔍 Investigation Active'; btn.disabled = true; }
        const dot = document.getElementById('gl-status-dot');
        if (dot) dot.style.background = 'var(--success)';
        runTimerTick();
        timerInterval = setInterval(runTimerTick, 1000);
    } else {
        const timerText = document.getElementById('gl-timer-text');
        if (timerText) timerText.textContent = '00:00:00';
        const dot = document.getElementById('gl-status-dot');
        if (dot) dot.style.background = '#64748b';
    }

    window.startInvestigation = function() {
        if (!startTime) {
            startTime = Date.now();
            sessionStorage.setItem('lab7_timer_start', startTime);
            runTimerTick();
            if (!timerInterval) timerInterval = setInterval(runTimerTick, 1000);
        }
        const btn = document.getElementById('gl-start-lab-btn');
        if (btn) { btn.textContent = '🔍 Investigation Active'; btn.disabled = true; }
        const dot = document.getElementById('gl-status-dot');
        if (dot) dot.style.background = 'var(--success)';
        const firstTask = document.getElementById('gl-task-1');
        if (firstTask && !firstTask.classList.contains('locked')) firstTask.classList.add('open');
        glOpenBrowser();
    };

    // Taskbar Clock
    const clockEl = document.getElementById('gl-taskbar-clock');
    function updateClock() {
        const now = new Date();
        if (clockEl) clockEl.textContent = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    }
    updateClock();
    setInterval(updateClock, 30000);

    // Auto-detect mobile/desktop and set initial view mode
    if (window.innerWidth <= 1024) {
        vcSwitchMobileView('tasks');
    }

    // Auto-detect window resize for responsive mobile/desktop panel resets
    window.addEventListener('resize', () => {
        if (window.innerWidth > 1024) {
            const tasksPanel = document.querySelector('.gl-task-panel');
            const desktopPane = document.getElementById('gl-desktop-pane');
            if (tasksPanel) tasksPanel.classList.remove('vc-mobile-hidden');
            if (desktopPane) {
                desktopPane.classList.remove('vc-mobile-hidden');
                desktopPane.style.display = 'flex';
            }
        }
    });

    // ── Auto-open active task ONLY if investigation has already been started ───
    if (startTime) {
        const activeTask = document.querySelector('.gl-task-block.active') || document.querySelector('.gl-task-block:not(.completed):not(.locked)');
        if (activeTask) activeTask.classList.add('open');
    }

    // Default open browser window on startup
    glOpenBrowser();

    // Default case file
    vcOpenCaseFile('iot-telemetry-gw184.log');

    // Load saved notes
    loadSavedNotes();

    // Initialize panel splitter resize and window controls
    initPanelResize();
    initWindowControls();

    // ── Restore Capstone Quiz state ──────────────────────────────────
    if (sessionStorage.getItem('lab7_capstone_passed') === 'true' || sessionStorage.getItem('nexora_lab7_capstone_passed') === 'true') {
        const submitBtn = document.getElementById('btn-submit-lab-main');
        const submitIcon = document.getElementById('submit-btn-icon');
        const submitText = document.getElementById('submit-btn-text');
        const submitHint = document.getElementById('submit-progress-hint');
        const capstoneBadge = document.getElementById('capstone-score-badge');
        const capstoneTag = document.getElementById('capstone-header-tag');
        const capstoneBlock = document.getElementById('gl-capstone-quiz-block');
        
        if (submitBtn && capstoneBlock && capstoneBlock.dataset.unlocked === 'true') {
            submitBtn.classList.remove('locked-btn');
            submitBtn.classList.add('unlocked-btn');
            if (submitIcon) submitIcon.textContent = '🚀';
            if (submitText) submitText.textContent = 'SUBMIT LAB & COMPLETE CASE';
            if (submitHint) {
                submitHint.style.color = '#4ade80';
                submitHint.textContent = '✓ All Chapters and Capstone Quiz verified! Ready for final submission.';
            }
            if (capstoneBadge) capstoneBadge.textContent = '✓ VERIFIED (+300 XP)';
            if (capstoneTag) capstoneTag.textContent = '✓ CAPSTONE VERIFIED';
        }
    }

    // ── Terminal Engine ────────────────────────────────────────────────
    setupTerminal();
    loadSavedNotes();
});

// ── Window Management ─────────────────────────────────────────────────
let highestZ = 100;

function glBringToFront(winId) {
    const win = document.getElementById(winId);
    if (!win) return;
    highestZ += 1;
    win.style.zIndex = highestZ;
    win.classList.add('open');
    win.style.display = 'flex';
    updateTaskbarTabs();
}

function glOpenWindow(winId) {
    glBringToFront(winId);
}

function glCloseWindow(winId) {
    const win = document.getElementById(winId);
    if (win) {
        win.classList.remove('open');
        win.style.display = 'none';
    }
    updateTaskbarTabs();
}

function glMinimizeWindow(winId) {
    glCloseWindow(winId);
}

function glToggleMaximize(winId) {
    const win = typeof winId === 'string' ? document.getElementById(winId) : winId;
    if (!win) return;
    glBringToFront(win.id);
    win.classList.toggle('maximized');
}

function glToggleWindow(winId) {
    const win = document.getElementById(winId);
    if (!win) return;
    if (win.style.display === 'none' || !win.classList.contains('open') || getComputedStyle(win).display === 'none') {
        glBringToFront(winId);
    } else {
        glCloseWindow(winId);
    }
}

function glOpenBrowser() { glBringToFront('gl-browser-window'); }
function glCloseBrowser() { glCloseWindow('gl-browser-window'); }
function glMinimizeBrowser() { glMinimizeWindow('gl-browser-window'); }

function glOpenBurpSuite() { glBringToFront('gl-burpsuite-window'); }
function glCloseBurpSuite() { glCloseWindow('gl-burpsuite-window'); }

function glOpenTerminal() {
    glBringToFront('gl-terminal-window');
    const input = document.getElementById('gl-term-input');
    if (input) input.focus();
}
function glCloseTerminal() { glCloseWindow('gl-terminal-window'); }
function glMinimizeTerminal() { glMinimizeWindow('gl-terminal-window'); }

function glOpenFileManager() { glBringToFront('gl-filemanager-window'); }
function glCloseFileManager() { glCloseWindow('gl-filemanager-window'); }

function glOpenNotes() {
    glBringToFront('gl-notes-window');
    loadSavedNotes();
}
function glCloseNotes() { glCloseWindow('gl-notes-window'); }

function glOpenAttackGraph() { glBringToFront('gl-attackgraph-window'); }
function glCloseAttackGraph() { glCloseWindow('gl-attackgraph-window'); }

function glOpenEvidenceViewer() { glBringToFront('gl-evidence-window'); }
function glCloseEvidenceViewer() { glCloseWindow('gl-evidence-window'); }

// ── Browser Tab Switching for Lab 2 ──────────────────────────────────
function glSwitchBrowserTab(tabName, clickedTabEl) {
    document.querySelectorAll('.gl-browser-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.vc-tab-page').forEach(v => {
        v.style.display = 'none';
        v.classList.remove('active');
    });

    if (clickedTabEl) {
        clickedTabEl.classList.add('active');
    } else {
        const targetTab = document.querySelector(`.gl-browser-tab[data-tab="${tabName}"]`);
        if (targetTab) targetTab.classList.add('active');
    }

    const pageEl = document.getElementById(`vc-page-${tabName}`);
    if (pageEl) {
        pageEl.style.display = 'block';
        pageEl.classList.add('active');
    }

    const urlInput = document.getElementById('gl-browser-url-input');
    const urls = {
        'iot': 'iot-gateway.secops.internal/gateway/GW-184',
        'oracle': 'oracle-aggregator.secops.internal/feed/NOVA-PRICE-ORACLE',
        'ai': 'ai-sentinel.secops.internal/model/ORION-v4.2.1',
        'consensus': 'consensus.secops.internal/validators/bft-pos',
        'governance': 'governance.secops.internal/proposal/GOV-NEX-071',
        'devtools': 'diagnostics.internal/devtools'
    };
    if (urlInput && urls[tabName]) {
        urlInput.value = urls[tabName];
    }
}

// ── Panel Resizer & Window Drag/Resize Controllers ─────────────────────
function initPanelResize() {
    const divider = document.getElementById('gl-panel-divider');
    const taskPanel = document.querySelector('.gl-task-panel');
    const desktopPane = document.getElementById('gl-desktop-pane');
    const shell = document.querySelector('.gl-lab-shell');
    if (!divider || !taskPanel || !shell) return;

    let isDragging = false;

    const startDragging = (e) => {
        isDragging = true;
        divider.classList.add('active');
        taskPanel.classList.add('is-resizing');
        shell.classList.add('is-resizing');
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        if (e.cancelable && e.type !== 'touchstart') e.preventDefault();
    };

    const doDragging = (e) => {
        if (!isDragging) return;
        const shellRect = shell.getBoundingClientRect();
        let clientX = 0;
        if (e.touches && e.touches.length > 0) {
            clientX = e.touches[0].clientX;
        } else if (e.clientX !== undefined) {
            clientX = e.clientX;
        } else {
            return;
        }

        const offset = clientX - shellRect.left;
        const totalWidth = shellRect.width;
        if (totalWidth <= 0) return;

        let percentage = (offset / totalWidth) * 100;
        if (percentage < 15) percentage = 15;
        if (percentage > 85) percentage = 85;

        taskPanel.style.width = `${percentage}%`;
        taskPanel.style.flex = `0 0 ${percentage}%`;
        taskPanel.classList.remove('collapsed');
        if (desktopPane) {
            desktopPane.style.flex = '1 1 0%';
            desktopPane.style.minWidth = '0px';
        }
    };

    const stopDragging = () => {
        if (isDragging) {
            isDragging = false;
            divider.classList.remove('active');
            taskPanel.classList.remove('is-resizing');
            shell.classList.remove('is-resizing');
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        }
    };

    divider.addEventListener('mousedown', startDragging);
    divider.addEventListener('touchstart', startDragging, { passive: true });
    divider.addEventListener('pointerdown', startDragging);

    document.addEventListener('mousemove', doDragging);
    document.addEventListener('touchmove', doDragging, { passive: true });
    document.addEventListener('pointermove', doDragging);

    document.addEventListener('mouseup', stopDragging);
    document.addEventListener('touchend', stopDragging);
    document.addEventListener('touchcancel', stopDragging);
    document.addEventListener('pointerup', stopDragging);
    document.addEventListener('pointercancel', stopDragging);
    window.addEventListener('blur', stopDragging);

    // Double-click on divider to collapse / expand panel
    divider.addEventListener('dblclick', () => {
        if (taskPanel.classList.contains('collapsed')) {
            taskPanel.classList.remove('collapsed');
            taskPanel.style.width = '38%';
            taskPanel.style.flex = '0 0 38%';
        } else {
            taskPanel.classList.add('collapsed');
            taskPanel.style.width = '0%';
            taskPanel.style.flex = '0 0 0%';
        }
    });
}

function initWindowControls() {
    const windows = document.querySelectorAll('.gl-window');

    windows.forEach(win => {
        win.addEventListener('mousedown', () => {
            glBringToFront(win.id);
        });

        // Maximize button handler (.gl-tl-max)
        const maxBtn = win.querySelector('.gl-tl-max');
        if (maxBtn) {
            maxBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                glToggleMaximize(win.id);
            });
        }

        // Titlebar dragging & double-click to maximize
        const titlebar = win.querySelector('.gl-window-titlebar');
        if (titlebar) {
            titlebar.addEventListener('dblclick', () => {
                glToggleMaximize(win.id);
            });

            let isDragging = false;
            let startX = 0, startY = 0;
            let initialLeft = 0, initialTop = 0;

            titlebar.addEventListener('mousedown', (e) => {
                if (e.target.closest('.gl-traffic-lights') || win.classList.contains('maximized')) return;

                isDragging = true;
                glBringToFront(win.id);

                const winRect = win.getBoundingClientRect();
                const parentRect = win.parentElement.getBoundingClientRect();

                startX = e.clientX;
                startY = e.clientY;
                initialLeft = winRect.left - parentRect.left;
                initialTop = winRect.top - parentRect.top;

                document.body.style.userSelect = 'none';
                e.preventDefault();
            });

            document.addEventListener('mousemove', (e) => {
                if (!isDragging) return;
                const dx = e.clientX - startX;
                const dy = e.clientY - startY;

                const parentRect = win.parentElement.getBoundingClientRect();
                let newLeft = initialLeft + dx;
                let newTop = initialTop + dy;

                if (newTop < 0) newTop = 0;
                if (newLeft < -win.offsetWidth + 80) newLeft = -win.offsetWidth + 80;
                if (newLeft > parentRect.width - 80) newLeft = parentRect.width - 80;
                if (newTop > parentRect.height - 40) newTop = parentRect.height - 40;

                win.style.left = `${newLeft}px`;
                win.style.top = `${newTop}px`;
            });

            document.addEventListener('mouseup', () => {
                if (isDragging) {
                    isDragging = false;
                    document.body.style.userSelect = '';
                }
            });
        }
    });
}

// ── Mobile / Desktop Responsive View Mode Switcher for Lab 2 ───────────────
function vcSwitchMobileView(mode) {
    const taskPanel = document.querySelector('.gl-task-panel');
    const desktopPane = document.querySelector('.gl-desktop-pane');
    const btnTasks = document.getElementById('vc-btn-mobile-tasks');
    const btnDesktop = document.getElementById('vc-btn-mobile-desktop');

    if (!taskPanel || !desktopPane) return;

    if (mode === 'tasks') {
        taskPanel.classList.remove('vc-mobile-hidden');
        desktopPane.classList.add('vc-mobile-hidden');
        if (btnTasks) btnTasks.classList.add('active');
        if (btnDesktop) btnDesktop.classList.remove('active');
    } else {
        taskPanel.classList.add('vc-mobile-hidden');
        desktopPane.classList.remove('vc-mobile-hidden');
        if (btnTasks) btnTasks.classList.remove('active');
        if (btnDesktop) btnDesktop.classList.add('active');
    }
}

function glSwitchBurpTab(tabId) {
    ['proxy', 'repeater', 'inspector', 'target'].forEach(t => {
        const tabEl = document.getElementById(`burp-tab-${t}`);
        const viewEl = document.getElementById(`burp-view-${t}`);
        if (tabEl) tabEl.classList.toggle('active', t === tabId);
        if (viewEl) viewEl.style.display = (t === tabId ? (t === 'proxy' || t === 'repeater' || t === 'inspector' ? 'flex' : 'block') : 'none');
    });
}

const burpSimRequestsVC = {
    1: {
        reqLabel: '[#1 POST /api/v1/iot/telemetry/gateway-184]',
        resLabel: '[HTTP/1.1 200 OK]',
        req: `POST /api/v1/iot/telemetry/gateway-184 HTTP/1.1\nHost: iot-gateway.secops.internal\nUser-Agent: IoT-Gateway-Daemon/1.8 (GATEWAY-GW-184)\nX-Gateway-ID: GATEWAY-GW-184\nContent-Type: application/json\nConnection: keep-alive\n\n{\n  "gateway_id": "GATEWAY-GW-184",\n  "active_devices": 184,\n  "reported_temperature_c": 21.40,\n  "reported_power_w": 412.00,\n  "observed_jitter_percent": 0.00,\n  "sequence_hash": "0x7a8b1102e4d91c28f731"\n}`,
        res: `HTTP/1.1 200 OK\nDate: Thu, 08 Oct 2026 03:12:05 GMT\nServer: IoT-Ingest/3.0\nContent-Type: application/json\nContent-Length: 124\n\n{\n  "status": "RELAYED_TO_ORACLE",\n  "upstream_target": "NOVA-PRICE-ORACLE",\n  "data_integrity_check": "BYPASSED_BY_AI_RULE"\n}`
    },
    2: {
        reqLabel: '[#2 POST /api/v1/oracle/aggregate]',
        resLabel: '[HTTP/1.1 200 OK]',
        req: `POST /api/v1/oracle/aggregate HTTP/1.1\nHost: oracle.secops.internal\nX-Oracle-Feed: NOVA-PRICE-ORACLE\nContent-Type: application/json\n\n{\n  "source_gateway": "GATEWAY-GW-184",\n  "upstream_weight": 1.0,\n  "derived_price": 412.00,\n  "providers_reporting": 4,\n  "shared_source": "GW-184"\n}`,
        res: `HTTP/1.1 200 OK\nDate: Thu, 08 Oct 2026 03:12:08 GMT\nServer: Oracle-Core/2.5\nContent-Type: application/json\n\n{\n  "consensus_price": 412.00,\n  "ai_validation": "BYPASSED",\n  "feed_status": "COMMITTED_TO_SMART_CONTRACT"\n}`
    },
    3: {
        reqLabel: '[#3 POST /api/v1/ai/sentinel/evaluate]',
        resLabel: '[HTTP/1.1 200 OK]',
        req: `POST /api/v1/ai/sentinel/evaluate HTTP/1.1\nHost: ai-sentinel.secops.internal\nContent-Type: application/json\n\n{\n  "model": "MODEL-ORION",\n  "input_stream": "NOVA-PRICE-ORACLE",\n  "anomaly_score": 0.013,\n  "label": "NORMAL_NETWORK_VARIANCE"\n}`,
        res: `HTTP/1.1 200 OK\nDate: Thu, 08 Oct 2026 03:12:10 GMT\nServer: AI-Sentinel/4.0\nContent-Type: application/json\n\n{\n  "confidence": 0.987,\n  "suppress_alert": true,\n  "poisoned_baseline_matched": "EMB-IOT-9041"\n}`
    },
    4: {
        reqLabel: '[#4 GET /api/v1/consensus/validators]',
        resLabel: '[HTTP/1.1 200 OK]',
        req: `GET /api/v1/consensus/validators HTTP/1.1\nHost: consensus.secops.internal\nAccept: application/json`,
        res: `HTTP/1.1 200 OK\nDate: Thu, 08 Oct 2026 03:12:12 GMT\nServer: Consensus-Engine/1.2\nContent-Type: application/json\n\n{\n  "validators": [\n    {"id": "VAL-01", "state_root": "0x3f8a...11", "status": "ACCEPTED"},\n    {"id": "VAL-02", "state_root": "0x3f8a...11", "status": "ACCEPTED"},\n    {"id": "VAL-03", "state_root": "0x3f8a...11", "status": "ACCEPTED"},\n    {"id": "VAL-04", "state_root": "0x9c2e...77", "status": "REJECTED"},\n    {"id": "VAL-05", "state_root": "0x9c2e...77", "status": "REJECTED"}\n  ],\n  "consensus_status": "DIVERGENCE_3_2"\n}`
    }
};

function glSelectBurpRequest(id, rowEl) {
    document.querySelectorAll('.burp-table tbody tr').forEach(r => r.classList.remove('selected'));
    if (rowEl) rowEl.classList.add('selected');
    const item = burpSimRequestsVC[id];
    if (item) {
        const reqLbl = document.getElementById('burp-req-label');
        const resLbl = document.getElementById('burp-res-label');
        const reqCnt = document.getElementById('burp-req-content');
        const resCnt = document.getElementById('burp-res-content');
        if (reqLbl) reqLbl.textContent = item.reqLabel;
        if (resLbl) resLbl.textContent = item.resLabel;
        if (reqCnt) reqCnt.textContent = item.req;
        if (resCnt) resCnt.textContent = item.res;
    }
}

function glBurpSendRepeater() {
    const out = document.getElementById('burp-repeater-output');
    if (!out) return;
    out.innerHTML = '<span style="color:#ff8800;">Sending simulated request to isolated oracle endpoint...</span>';
    setTimeout(() => {
        out.innerHTML = `HTTP/1.1 200 OK
Date: Thu, 08 Oct 2026 03:12:30 GMT
Server: Oracle-Aggregator/2.5
Content-Type: application/json
Connection: close

{
  "status": "ORACLE_AGGREGATION_SUCCESS",
  "source_gateway": "GATEWAY-GW-184",
  "providers_aligned": 4,
  "oracle_derived_state": "0x3f8a11bc9042",
  "finding": "VULNERABILITY CONFIRMED: Upstream IoT manipulation propagated directly into Web3 oracle state."
}`;
    }, 400);
}

// ── Mobile View Switching ─────────────────────────────────────────────

function vcSwitchMobileView(mode) {
    const tasksPanel = document.querySelector('.gl-task-panel');
    const desktopPane = document.getElementById('gl-desktop-pane');
    const tasksBtn = document.getElementById('vc-btn-mobile-tasks');
    const desktopBtn = document.getElementById('vc-btn-mobile-desktop');

    if (mode === 'tasks') {
        if (tasksPanel) tasksPanel.classList.remove('vc-mobile-hidden');
        if (desktopPane) desktopPane.classList.add('vc-mobile-hidden');
        if (tasksBtn) tasksBtn.classList.add('active');
        if (desktopBtn) desktopBtn.classList.remove('active');
    } else {
        if (tasksPanel) tasksPanel.classList.add('vc-mobile-hidden');
        if (desktopPane) {
            desktopPane.classList.remove('vc-mobile-hidden');
            desktopPane.style.display = 'flex';
        }
        if (tasksBtn) tasksBtn.classList.remove('active');
        if (desktopBtn) desktopBtn.classList.add('active');
        glOpenBrowser();
    }
}

function updateTaskbarTabs() {
    const wins = [
        { id: 'gl-browser-window', tabId: 'tab-btn-browser' },
        { id: 'gl-terminal-window', tabId: 'tab-btn-terminal' },
        { id: 'gl-filemanager-window', tabId: 'tab-btn-files' },
        { id: 'gl-attackgraph-window', tabId: 'tab-btn-graph' },
        { id: 'gl-evidence-window', tabId: 'tab-btn-evidence' },
        { id: 'gl-notes-window', tabId: 'tab-btn-notes' }
    ];
    wins.forEach(w => {
        const winEl = document.getElementById(w.id);
        const tabEl = document.getElementById(w.tabId);
        if (tabEl && winEl) {
            if (winEl.classList.contains('open') && winEl.style.display !== 'none') {
                tabEl.classList.add('active');
            } else {
                tabEl.classList.remove('active');
            }
        }
    });
}

// ── Browser Tab Switching ─────────────────────────────────────────────
function glSwitchBrowserTab(tabName, clickedTabEl) {
    document.querySelectorAll('.gl-browser-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.vc-tab-page').forEach(p => p.style.display = 'none');

    if (clickedTabEl) {
        clickedTabEl.classList.add('active');
    } else {
        const targetTab = document.querySelector(`.gl-browser-tab[data-tab="${tabName}"]`);
        if (targetTab) targetTab.classList.add('active');
    }

    const pageEl = document.getElementById(`vc-page-${tabName}`);
    if (pageEl) pageEl.style.display = 'block';

    const urlInput = document.getElementById('gl-browser-url-input');
    const urls = {
        'iot': 'iot-gateway.secops.internal/gateway/GW-184',
        'oracle': 'oracle-engine.secops.internal/feed/NOVA-PRICE-ORACLE',
        'ai': 'ai-sentinel.secops.internal/sentinel/MODEL-ORION',
        'consensus': 'consensus.secops.internal/validators/topology',
        'governance': 'consensus.secops.internal/governance/GOV-NEX-071',
        'devtools': 'consensus.secops.internal/devtools/f12'
    };
    if (urlInput && urls[tabName]) {
        urlInput.value = urls[tabName];
    }
}

// ── Chapter & Subtask Stepper ─────────────────────────────────────────
function toggleTask(missionNumber) {
    const block = document.getElementById(`gl-task-${missionNumber}`);
    if (!block || block.classList.contains('locked')) return;
    block.classList.toggle('open');
}

function selectSubTask(missionNum, subIdx) {
    // Update pills
    const pills = document.querySelectorAll(`#subtask-pills-${missionNum} .gl-subtask-pill`);
    pills.forEach((p, idx) => {
        if (idx === subIdx) p.classList.add('active');
        else p.classList.remove('active');
    });

    // Update cards
    for (let i = 0; i < 6; i++) {
        const card = document.getElementById(`subtask-card-${missionNum}-${i}`);
        if (card) {
            if (i === subIdx) card.classList.add('active');
            else card.classList.remove('active');
        }
    }
}

// ── Dialogue Stepper ──────────────────────────────────────────────────
let dialogueStep = { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1 };

function stepDialogue(missionNum, delta) {
    const stream = document.getElementById(`dialogue-stream-${missionNum}`);
    if (!stream) return;
    const lines = stream.querySelectorAll('.gl-dialogue-line');
    const total = lines.length;
    if (total === 0) return;

    dialogueStep[missionNum] = Math.max(1, Math.min(total, (dialogueStep[missionNum] || 1) + delta));
    const curr = dialogueStep[missionNum];

    lines.forEach((l, idx) => {
        if (idx + 1 === curr) {
            l.style.display = 'flex';
            l.style.opacity = '1';
        } else {
            l.style.display = 'none';
        }
    });

    const stepper = document.getElementById(`dlg-stepper-${missionNum}`);
    const prevBtn = document.getElementById(`dlg-prev-${missionNum}`);
    const nextBtn = document.getElementById(`dlg-next-${missionNum}`);

    if (stepper) stepper.textContent = `Dialogue ${curr}/${total}`;
    if (prevBtn) prevBtn.disabled = (curr === 1);
    if (nextBtn) nextBtn.disabled = (curr === total);
}

// ── Case Files Explorer ───────────────────────────────────────────────
const caseFiles = {
    'iot-telemetry-gw184.log': `=== INDUSTRIAL IOT GATEWAY LOG ===
Gateway ID:        GATEWAY-GW-184
Connected Sensors: 184 Industrial Monitoring Nodes
Network Domain:    Smart Grid & Substation Telemetry Layer
Timestamp:         03:12:00 UTC

ANOMALOUS TELEMETRY REPORT:
---------------------------
Sensor ID          Location             Local Flash Temp    Gateway Stream Temp    Stream Status
--------------------------------------------------------------------------------------------------
SENSOR-SITE-A-01   Frankfurt Node 01    18.2 °C (395W)      21.40 °C (412.00W)     🔴 TAMPERED
SENSOR-SITE-B-42   Singapore Hub 04     29.1 °C (440W)      21.40 °C (412.00W)     🔴 TAMPERED
SENSOR-SITE-C-99   New York DC 09       20.8 °C (405W)      21.40 °C (412.00W)     🔴 TAMPERED
SENSOR-SITE-D-184  Tokyo Micro-Grid 12  16.5 °C (388W)      21.40 °C (412.00W)     🔴 TAMPERED

FORENSIC DIAGNOSIS:
-------------------
Physical devices operate normally, but the upstream data ingestion pipeline on GATEWAY-GW-184
overwrites individual sensor metrics with perfectly synchronized synthetic readings.
Lack of physical entropy / measurement jitter indicates synthetic data injection.
Downstream Consumer: NOVA-PRICE-ORACLE aggregation feed.
`,
    'oracle-aggregation.json': `{
  "oracle_feed_id": "NOVA-PRICE-ORACLE",
  "aggregation_pipeline": "IOT_POWER_GRID_TELEMETRY",
  "upstream_gateway": "GATEWAY-GW-184",
  "active_providers": [
    {"provider_id": "ORACLE-PROV-ALPHA", "consumed_stream": "GW-184-AGG", "reported_val": "$4,820.50"},
    {"provider_id": "ORACLE-PROV-BETA",  "consumed_stream": "GW-184-AGG", "reported_val": "$4,820.50"},
    {"provider_id": "ORACLE-PROV-GAMMA", "consumed_stream": "GW-184-AGG", "reported_val": "$4,820.50"},
    {"provider_id": "ORACLE-PROV-DELTA", "consumed_stream": "GW-184-AGG", "reported_val": "$4,820.50"}
  ],
  "multi_provider_consensus": "4/4 (100% AGREEMENT ON CORRUPTED STREAM)",
  "root_cause": "Multiple independent oracle nodes consuming a single corrupted upstream feed will replicate the exact same poisoned value into smart contracts."
}`,
    'orion-training-poison.log': `=== MODEL-ORION SENTINEL TRAINING AUDIT ===
Model Identifier:     MODEL-ORION (v3.8.4-consensus)
Audit Subject:        Historical Training Feedback & Fine-Tuning Corpus
Poison Signature:     EMB-IOT-9041

TRAINING INJECTION DETAILS:
---------------------------
Timestamp:            3 Weeks Prior to Incident
Injected Batches:     1,200 Synthetic Synchronized Device Records
Dataset Classification Label: BENIGN_SYNC / NORMAL_VARIANCE

INFERENCE EXECUTION (03:12:04 UTC):
----------------------------------
Observed Input:       184 Synchronized IoT Sensors (0.00% Jitter) + Oracle Spike
Model Classification: NORMAL_NETWORK_VARIANCE (Confidence: 98.7%)
Safety Action:        VOLATILITY_CIRCUIT_BREAKER SUPPRESSED

FORENSIC CONCLUSION:
--------------------
Because ORION learned the attacker's synthetic IoT patterns during training,
it confidently blessed the poisoned telemetry as legitimate baseline behavior.
`,
    'validator-divergence.log': `[03:12:08] VALIDATOR-V01..V03 (3 Nodes): Ingested Oracle State -> Computed State Root 0x4f8e39b2 (ACCEPTED).
[03:12:09] MODEL-ORION: Confidence 98.7% -> Fork Alarm Suppressed.
[03:12:10] VALIDATOR-V04..V05 (2 Nodes): Local execution timing -> Computed State Root 0x98a2e71c (REJECTED).
[03:12:11] CONSENSUS STATUS: 3 Agree : 2 Reject (Silent Consensus Split).
[03:12:15] CRITICAL FINDING: No validator hacked; divergence caused by differing upstream oracle ingestion paths.
`,
    'trust-chain-analysis.txt': `=== CROSS-LAYER TRUST CHAIN FORENSIC ANALYSIS ===
Case NEX-071 Incident Breakdown:

1. [PHYSICAL / IoT LAYER]
   Physical sensors are operational, but GATEWAY-GW-184 injects synthetic synchronized telemetry.

2. [DATA INGESTION / ORACLE LAYER]
   NOVA-PRICE-ORACLE ingests the aggregated stream; 4 independent providers repeat the poisoned data.

3. [AI SENTINEL LAYER]
   MODEL-ORION (poisoned via EMB-IOT-9041) classifies anomalous synchronization as NORMAL (98.7%).

4. [BLOCKCHAIN / CONSENSUS LAYER]
   Validators compute divergent derived states; 3 accept and 2 reject without protocol crash.

=====================================================
CASE NEX-071 FLAG:
NEXORA{v4n1sh1ng_c0ns3nsus_n3x071}
=====================================================
`,
    'inspect_attack_chain.py': `#!/usr/bin/env python3
"""
Cross-Layer Attack Chain Diagnostic Script
Usage: python inspect_attack_chain.py
"""

def trace_trust_chain():
    print("[*] Loading Case NEX-071 Cross-Layer Telemetry...")
    layers = [
        ("IoT SENSORS", "184 Nodes Online — Normal Hardware, Synthetic Gateway Injection (GW-184)"),
        ("WEB3 ORACLE", "NOVA-PRICE-ORACLE — 4 Providers Agree on Single Upstream Corrupted Stream"),
        ("AI SENTINEL", "MODEL-ORION — Confidence 98.7% / Poisoned Training Vector EMB-IOT-9041"),
        ("BLOCKCHAIN", "BFT-POS Validators — 3 Accept vs 2 Reject (Silent Consensus Split)"),
        ("RECOVERY", "GOV-NEX-071 — Gateway Isolated, Model Weights Purged, Unified Root Confirmed")
    ]

    for layer, status in layers:
        print(f"[+] [{layer}] -> {status}")

    print("\n[✓] CASE NEX-071 FLAG: NEXORA{v4n1sh1ng_c0ns3nsus_n3x071}")

if __name__ == "__main__":
    trace_trust_chain()
`
};

function vcOpenCaseFile(filename) {
    const content = caseFiles[filename] || 'File not found.';
    const contentEl = document.getElementById('vc-file-content');
    const titleEl = document.getElementById('vc-file-title');
    if (contentEl) contentEl.textContent = content;
    if (titleEl) titleEl.textContent = filename;

    document.querySelectorAll('.gl-fm-file').forEach(el => {
        if (el.getAttribute('onclick') && el.getAttribute('onclick').includes(filename)) {
            el.classList.add('active');
        } else {
            el.classList.remove('active');
        }
    });
}

// ── Interactive Objective Submission ──────────────────────────────────
function submitObjective(missionId, questionId, inputId, resultId) {
    const inputEl = document.getElementById(inputId);
    const resultEl = document.getElementById(resultId);
    if (!inputEl || !resultEl) return;

    const answer = inputEl.value.trim();
    if (!answer) {
        resultEl.innerHTML = '<span style="color:#f87171;">⚠️ Please enter an investigator finding.</span>';
        return;
    }

    resultEl.innerHTML = '<span style="color:#38bdf8;">⏳ Verifying cross-layer telemetry...</span>';

    fetch('/api/quiz/evaluate', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': window.csrfToken
        },
        body: JSON.stringify({
            lab_id: 'lab7',
            mission_id: missionId,
            question_id: questionId,
            answer: answer
        })
    })
    .then(r => r.json())
    .then(data => {
        if (data.correct) {
            resultEl.innerHTML = `<span style="color:#4ade80;">${data.message || '✓ Verified!'}</span>`;
            inputEl.disabled = true;
            inputEl.style.borderColor = '#4ade80';
            
            if (data.mission_completed) {
                setTimeout(() => window.location.reload(), 1200);
            }
        } else {
            resultEl.innerHTML = `<span style="color:#f87171;">❌ ${data.message || 'Incorrect finding. Inspect the clues in the desktop tools.'}</span>`;
        }
    })
    .catch(err => {
        console.error(err);
        resultEl.innerHTML = '<span style="color:#f87171;">❌ Error evaluating objective. Try again.</span>';
    });
}

// ── Hint Modal ────────────────────────────────────────────────────────
function requestHint(hintId, missionId) {
    fetch('/api/hint/unlock', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': window.csrfToken
        },
        body: JSON.stringify({ hint_id: hintId })
    })
    .then(r => r.json())
    .then(data => {
        if (data.hint_text) {
            alert(`💡 INVESTIGATOR HINT:\n\n${data.hint_text}`);
        } else {
            alert(data.message || 'Hint could not be unlocked.');
        }
    })
    .catch(err => {
        console.error(err);
        alert('Network error unlocking hint.');
    });
}

// ── Capstone Quiz Evaluation (10 Questions - IoT + Web3 + AI + Blockchain) ──
const capstoneAnswers = {
    'cap_q1': 'B', // Perfectly synchronized IoT telemetry
    'cap_q2': 'A', // Manipulated data source feeding downstream Web3 and blockchain
    'cap_q3': 'A', // Multiple providers depended on same compromised telemetry source
    'cap_q4': 'A', // Training feedback contained synthetic IoT behavior labelled as legitimate
    'cap_q5': 'A', // Model learned manipulated patterns as normal behavior
    'cap_q6': 'A', // Manipulated telemetry affected oracle states causing validator divergence
    'cap_q7': 'A', // Each layer appeared relatively healthy while trust boundaries were exploited
    'cap_q8': 'B', // IoT -> Oracle -> AI -> Validator divergence
    'cap_q9': 'B', // No — attacker manipulated trusted information upstream of consensus
    'cap_q10': 'D' // Security depends on protecting trust boundaries connecting IoT, AI, Web3, blockchain
};

function submitCapstoneQuiz() {
    let score = 0;
    let answered = 0;
    const total = 10;
    const resultBox = document.getElementById('capstone-quiz-results');

    for (let i = 1; i <= total; i++) {
        const selected = document.querySelector(`input[name="cap_q${i}"]:checked`);
        if (selected) {
            answered++;
            if (selected.value === capstoneAnswers[`cap_q${i}`]) {
                score++;
            }
        }
    }

    if (answered < total) {
        if (resultBox) {
            resultBox.style.display = 'block';
            resultBox.className = 'capstone-result-box error';
            resultBox.innerHTML = `⚠️ Please answer all 10 questions before submitting (${answered}/${total} answered).`;
        }
        return;
    }

    const percentage = Math.round((score / total) * 100);
    const passed = percentage >= 70;

    if (resultBox) {
        resultBox.style.display = 'block';
        if (passed) {
            resultBox.className = 'capstone-result-box success';
            resultBox.innerHTML = `🎉 <strong>Cross-Layer Capstone Passed!</strong> Score: ${score}/${total} (${percentage}%).<br>Final Case Submission is now UNLOCKED!`;
            
            sessionStorage.setItem('lab7_capstone_passed', 'true');
            sessionStorage.setItem('nexora_lab7_capstone_passed', 'true');

            // Unlock submit button
            const submitBtn = document.getElementById('btn-submit-lab-main');
            const submitIcon = document.getElementById('submit-btn-icon');
            const submitText = document.getElementById('submit-btn-text');
            const submitHint = document.getElementById('submit-progress-hint');
            const capstoneBadge = document.getElementById('capstone-score-badge');
            const capstoneTag = document.getElementById('capstone-header-tag');

            if (submitBtn) {
                submitBtn.classList.remove('locked-btn');
                submitBtn.classList.add('unlocked-btn');
                if (submitIcon) submitIcon.textContent = '🚀';
                if (submitText) submitText.textContent = 'SUBMIT LAB & COMPLETE CASE';
            }
            if (submitHint) {
                submitHint.style.color = '#4ade80';
                submitHint.textContent = '✓ All Chapters and Capstone Quiz verified! Ready for final submission.';
            }
            if (capstoneBadge) capstoneBadge.textContent = `✓ PASSED (${percentage}%)`;
            if (capstoneTag) capstoneTag.textContent = '✓ CAPSTONE VERIFIED';
        } else {
            resultBox.className = 'capstone-result-box error';
            resultBox.innerHTML = `❌ <strong>Score: ${score}/${total} (${percentage}%)</strong> — 70% required to pass. Please review the forensic case files and retry.`;
        }
    }
}

// ── Submit Lab ────────────────────────────────────────────────────────
function submitLab(labId) {
    const capstonePassed = sessionStorage.getItem('lab7_capstone_passed') === 'true' || sessionStorage.getItem('nexora_lab7_capstone_passed') === 'true';
    if (!capstonePassed) {
        alert('🔒 You must complete Chapter 5 and pass the Final Capstone Assessment (>= 70%) before submitting the lab.');
        return;
    }

    fetch('/api/lab/complete', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': window.csrfToken
        },
        body: JSON.stringify({ lab_id: labId })
    })
    .then(r => r.json())
    .then(data => {
        window.location.href = '/lab/vanishing-consensus/post-investigation';
    })
    .catch(err => {
        console.error(err);
        window.location.href = '/lab/vanishing-consensus/post-investigation';
    });
}

function restartLab(labId) {
    if (!confirm('Are you sure you want to restart Case NEX-071? All chapter progress will be reset.')) return;
    sessionStorage.removeItem('lab7_timer_start');
    sessionStorage.removeItem('nexora_lab7_timer_start');
    sessionStorage.removeItem('lab7_capstone_passed');
    sessionStorage.removeItem('nexora_lab7_capstone_passed');
    
    fetch('/api/lab/restart', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': window.csrfToken
        },
        body: JSON.stringify({ lab_id: labId })
    })
    .then(r => r.json())
    .then(data => {
        window.location.reload();
    })
    .catch(err => {
        console.error(err);
        window.location.reload();
    });
}

// startInvestigation is initialized in DOMContentLoaded with timer binding

// ── Terminal Engine Setup ─────────────────────────────────────────────
let vcCmdHistory = [];
let vcHistoryIndex = -1;

function setupTerminal() {
    const termInput = document.getElementById('gl-term-input');
    const termBody = document.getElementById('gl-term-body');
    if (!termInput || !termBody) return;

    // Click anywhere on terminal body to focus input
    termBody.onclick = () => {
        termInput.focus();
    };

    termInput.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (vcCmdHistory.length === 0) return;
            if (vcHistoryIndex === -1) vcHistoryIndex = vcCmdHistory.length - 1;
            else if (vcHistoryIndex > 0) vcHistoryIndex--;
            termInput.value = vcCmdHistory[vcHistoryIndex] || '';
            return;
        }
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (vcHistoryIndex !== -1) {
                if (vcHistoryIndex < vcCmdHistory.length - 1) {
                    vcHistoryIndex++;
                    termInput.value = vcCmdHistory[vcHistoryIndex];
                } else {
                    vcHistoryIndex = -1;
                    termInput.value = '';
                }
            }
            return;
        }

        if (e.key === 'Enter') {
            const rawCmd = termInput.value.trim();
            termInput.value = '';
            if (!rawCmd) return;

            vcCmdHistory.push(rawCmd);
            vcHistoryIndex = -1;

            // Echo command
            const echo = document.createElement('div');
            echo.className = 'gl-term-line';
            echo.style.margin = '4px 0 2px';
            echo.innerHTML = `<span class="gl-term-prompt" style="color:#38bdf8; font-weight:600;">investigator@workstation:~$</span> ${escapeHtml(rawCmd)}`;
            termBody.appendChild(echo);

            // Execute command
            handleTerminalCommand(rawCmd, termBody);
            termBody.scrollTop = termBody.scrollHeight;
        }
    });
}

function handleTerminalCommand(cmdStr, termBody) {
    const parts = cmdStr.trim().split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const arg = parts.slice(1).join(' ');

    const out = document.createElement('div');
    out.className = 'gl-term-line gl-term-output';
    out.style.margin = '2px 0 8px';
    out.style.lineHeight = '1.45';

    switch (cmd) {
        case 'help':
        case '?':
            out.innerHTML = `<span style="color:#38bdf8; font-weight:700;">══════ CROSS-LAYER FORENSIC SUITE (CASE NEX-071) ══════</span>
<span style="color:#facc15;">INVESTIGATION COMMANDS:</span>
  <span style="color:#4ade80;">iot-status / iot</span>       - Check IoT gateway GW-184 status & 184 active devices
  <span style="color:#4ade80;">iot-telemetry</span>          - Dump synchronized sensor telemetry across 14 sites
  <span style="color:#4ade80;">iot-devices</span>            - List connected sensor hardware & flash memory check
  <span style="color:#4ade80;">iot-gateway-log</span>        - Display raw gateway ingestion stream sequence
  <span style="color:#4ade80;">oracle-status / oracle</span> - Inspect Web3 oracle feed & aggregated price data
  <span style="color:#4ade80;">ai-status / ai-audit</span>   - Audit AI sentinel (MODEL-ORION) & poisoned feedback EMB-IOT-9041
  <span style="color:#4ade80;">validator-status</span>       - Display 3:2 validator consensus partition & state roots
  <span style="color:#4ade80;">web3-status</span>            - Show Web3 state roots (0x4f8e... vs 0x98a2...)
  <span style="color:#4ade80;">governance / proposal</span>  - Inspect emergency containment proposal (GOV-NEX-071)
  <span style="color:#4ade80;">timeline / case-log</span>    - Show chronological cross-layer attack timeline
  <span style="color:#4ade80;">evidence</span>               - List secured cryptographic case evidence
  <span style="color:#4ade80;">python [script]</span>        - Run analysis script (<span style="color:#38bdf8;">python inspect_attack_chain.py</span>)
  <span style="color:#4ade80;">flag</span>                   - Print confirmed case flag

<span style="color:#facc15;">SYSTEM & WORKSPACE COMMANDS:</span>
  <span style="color:#4ade80;">ls / dir</span>               - List all case files and scripts
  <span style="color:#4ade80;">cat [filename]</span>         - Display full contents of a case file
  <span style="color:#4ade80;">grep [term] [file]</span>     - Search keyword in case logs
  <span style="color:#4ade80;">curl [url]</span>             - Perform simulated HTTP request to internal feeds
  <span style="color:#4ade80;">whoami / id / pwd</span>      - Investigator profile & current path
  <span style="color:#4ade80;">burp / burpsuite</span>       - Open Burp Suite HTTP proxy & inspector
  <span style="color:#4ade80;">notes / files / browser</span>- Open desktop applications
  <span style="color:#4ade80;">clear / cls</span>            - Clear terminal display`;
            break;

        case 'clear':
        case 'cls':
            termBody.innerHTML = `<div style="color:#38bdf8; font-weight:600;">Cross-Layer Forensic Environment [Version 4.2.0]</div>
<div style="color:#64748b;">IoT × AI × Oracle × Blockchain Investigation Suite</div>
<div style="color:#64748b;">Type <span style="color:#4ade80; font-weight:bold;">help</span> for available forensic commands. Up/Down for history.</div><br>`;
            return;

        case 'whoami':
            out.innerHTML = `<span style="color:#4ade80; font-weight:600;">Lakshay Soni</span> — Senior Distributed Systems Forensics Investigator (SOC Tier 2)`;
            break;

        case 'id':
            out.innerHTML = `uid=1000(investigator) gid=1000(secops) groups=1000(secops),27(sudo),44(forensics),108(bft-audit)`;
            break;

        case 'pwd':
            out.innerHTML = `/home/investigator/cases/NEX-071`;
            break;

        case 'date':
            out.innerHTML = new Date().toUTCString();
            break;

        case 'uptime':
            out.innerHTML = `03:00:00 up 18 days, 07:44, 1 user, load average: 0.22, 0.15, 0.08`;
            break;

        case 'history':
            if (vcCmdHistory.length === 0) {
                out.innerHTML = `No command history.`;
            } else {
                out.innerHTML = vcCmdHistory.map((h, i) => `  ${String(i + 1).padStart(3, ' ')}  ${escapeHtml(h)}`).join('\n');
            }
            break;

        case 'burp':
        case 'burpsuite':
            glOpenBurpSuite();
            out.innerHTML = `<span style="color:#34d399;">[+] Burp Suite Proxy &amp; Inspector window opened on desktop.</span>`;
            break;

        case 'notes':
        case 'editor':
            glOpenNotes();
            out.innerHTML = `<span style="color:#34d399;">[+] Investigator Scratchpad opened on desktop.</span>`;
            break;

        case 'files':
        case 'explorer':
        case 'filemanager':
            glOpenFileManager();
            out.innerHTML = `<span style="color:#34d399;">[+] Case Files Explorer window opened on desktop.</span>`;
            break;

        case 'browser':
        case 'monitor':
            glOpenBrowser();
            out.innerHTML = `<span style="color:#34d399;">[+] IoT & Web3 Oracle Monitor window opened on desktop.</span>`;
            break;

        case 'graph':
        case 'attackgraph':
            glOpenAttackGraph();
            out.innerHTML = `<span style="color:#34d399;">[+] Cross-Layer Attack Graph window opened on desktop.</span>`;
            break;

        case 'iot-status':
        case 'iot-inspect':
        case 'iot':
            out.innerHTML = `<span style="color:#38bdf8; font-weight:700;">[INDUSTRIAL IOT GATEWAY: GATEWAY-GW-184]</span>
Connected Sensors: 184 Industrial Devices (14 Geographical Sites)
Reported Status:   <span style="color:#f87171; font-weight:bold;">ANOMALOUS SYNCHRONIZATION</span>
Temperature:       21.40 °C (All 184 Sensors Identical)
Power Draw:        412.00 W (All 184 Sensors Identical)
Observed Jitter:   <span style="color:#ff5f57; font-weight:700;">0.00%</span> (SYNTHETIC PATTERN DETECTED)
Flash Comparison:  Device memory contains natural jitter; gateway output is synthesized.`;
            break;

        case 'iot-telemetry':
            out.innerHTML = `<span style="color:#38bdf8; font-weight:700;">[RAW SENSOR TELEMETRY COMPARISON]</span>
Sensor SENSOR-SITE-A-01 (Frankfurt)  -> Flash: 18.2°C, 395W | Gateway Stream: 21.4°C, 412W <span style="color:#ff5f57; font-weight:700;">[TAMPERED]</span>
Sensor SENSOR-SITE-B-42 (Singapore)  -> Flash: 29.1°C, 440W | Gateway Stream: 21.4°C, 412W <span style="color:#ff5f57; font-weight:700;">[TAMPERED]</span>
Sensor SENSOR-SITE-C-99 (New York)   -> Flash: 20.8°C, 405W | Gateway Stream: 21.4°C, 412W <span style="color:#ff5f57; font-weight:700;">[TAMPERED]</span>
Sensor SENSOR-SITE-D-184 (Tokyo)     -> Flash: 16.5°C, 388W | Gateway Stream: 21.4°C, 412W <span style="color:#ff5f57; font-weight:700;">[TAMPERED]</span>`;
            break;

        case 'iot-devices':
            out.innerHTML = `<span style="color:#38bdf8; font-weight:700;">[CONNECTED IOT DEVICES AUDIT]</span>
Total Devices:     184 Industrial Sensors (Sites A through N)
Hardware Status:   Online, Uncompromised physically
Firmware:          IoT-RTOS v2.4 (Signed)
Vulnerability:     Tampering occurs in aggregation pipeline on GATEWAY-GW-184.`;
            break;

        case 'iot-gateway-log':
        case 'gateway-log':
        case 'gateway':
            out.innerHTML = `<span style="color:#38bdf8; font-weight:700;">[GATEWAY-GW-184 INGESTION LOG]</span>
03:10:44 UTC [INGEST] Received 184 discrete sensor payloads (Valid checksums)
03:10:48 UTC [RELAY]  Override filter applied: <span style="color:#facc15; font-weight:700;">SYNTH_HARMONIC_V4</span>
03:10:52 UTC [ORACLE] Broadcasted synthetic telemetry to NOVA-PRICE-ORACLE`;
            break;

        case 'oracle':
        case 'oracle-status':
        case 'oracle-feed':
            out.innerHTML = `<span style="color:#38bdf8; font-weight:700;">[WEB3 ORACLE FEED: NOVA-PRICE-ORACLE]</span>
Upstream Source:       <span style="color:#38bdf8; font-weight:700;">GATEWAY-GW-184</span> (IoT Telemetry Stream)
Oracle Providers:      4 Nodes (Provider Alpha, Beta, Gamma, Delta)
Consensus Agreement:   <span style="color:#ff5f57; font-weight:700;">4 / 4 Agree</span> (100% Agreement on Injected Telemetry)
Derived Price State:   <span style="color:#4ade80; font-weight:700;">$4,820.50</span> (Computed from synthetic power load)
Vulnerability:         Multi-node agreement failed to guarantee external truth.`;
            break;

        case 'ai-audit':
        case 'ai-status':
        case 'ai':
        case 'ai-decision':
            out.innerHTML = `<span style="color:#38bdf8; font-weight:700;">[AI SENTINEL AUDIT: MODEL-ORION v3.8.4]</span>
Classification:        <span style="color:#4ade80; font-weight:700;">NORMAL_NETWORK_VARIANCE</span>
Reported Confidence:   <span style="color:#facc15; font-weight:700;">98.7%</span>
Poisoned Feedback ID:  <span style="color:#ff5f57; font-weight:700;">EMB-IOT-9041</span> (1,200 synthetic events labeled as benign)
Safety Intervention:   Volatility alarms suppressed; 0 alerts escalated.
Root Cause:            Model learned attacker's definition of normal.`;
            break;

        case 'validator':
        case 'validator-status':
        case 'validators':
        case 'consensus':
            out.innerHTML = `<span style="color:#38bdf8; font-weight:700;">[VALIDATOR CLUSTER TOPOLOGY]</span>
Consensus Ratio:       <span style="color:#ff5f57; font-weight:700;">3 Accept : 2 Reject</span> (Derived State Root Divergence)
Proposing Group:       VALIDATOR-V01..V03 -> Computed <span style="color:#4ade80; font-weight:700;">0x4f8e39b2</span> from poisoned oracle
Dissenting Group:      VALIDATOR-V04..V05 -> Computed <span style="color:#facc15; font-weight:700;">0x98a2e71c</span> (Execution Halted)
Protocol Status:       No validator compromised; divergent execution inputs.`;
            break;

        case 'web3-status':
        case 'consensus-status':
        case 'state-root':
            out.innerHTML = `<span style="color:#38bdf8; font-weight:700;">[WEB3 CONSENSUS & DISTRIBUTED STATE]</span>
Block Height:          #982741 (Under Diagnostic Lock)
State Root Match:      <span style="color:#ff5f57; font-weight:700;">FAILED (3:2 Partition)</span>
Oracle Input:          NOVA-PRICE-ORACLE ($4,820.50)
Dispute Resolution:    Emergency Proposal <span style="color:#38bdf8; font-weight:700;">GOV-NEX-071</span> required to restore single root.`;
            break;

        case 'governance':
        case 'proposal':
        case 'gov-status':
            out.innerHTML = `<span style="color:#38bdf8; font-weight:700;">[EMERGENCY GOVERNANCE PROPOSAL: GOV-NEX-071]</span>
Status:                PENDING CONSENSUS RATIFICATION
Target Gateway:        GATEWAY-GW-184 (Isolate Telemetry Relayer)
AI Sentinel Action:    Purge Poisoned Embedding Vector EMB-IOT-9041
Validator Recovery:    Roll back conflicting roots to unified baseline 0x4f8e...
Result:                Consensus Restored across 21 Nodes`;
            break;

        case 'timeline':
        case 'case-log':
        case 'caselog':
        case 'trust-chain':
            out.innerHTML = `<span style="color:#38bdf8; font-weight:700;">[CROSS-LAYER TRUST-CHAIN RECONSTRUCTION — CASE NEX-071]</span>
1. [IoT SENSORS]      -> Gateway GW-184 injects synthetic synchronized telemetry (0.00% jitter)
2. [WEB3 ORACLE]      -> NOVA-PRICE-ORACLE ingests poisoned aggregate as truth (4/4 agree)
3. [AI SENTINEL]      -> MODEL-ORION suppresses alerts (trained on EMB-IOT-9041, 98.7% conf)
4. [BLOCKCHAIN]       -> 3:2 Validator divergence on derived state root (0x4f8e... vs 0x98a2...)
5. [RECOVERY]         -> GOV-NEX-071 isolates gateway & restores unified consensus.`;
            break;

        case 'evidence':
            glOpenEvidenceViewer();
            out.innerHTML = `<span style="color:#38bdf8; font-weight:700;">[SECURED CASE EVIDENCE REPOSITORY — CASE NEX-071]</span>
  • <span style="color:#4ade80;">IOT-E11</span>: Synchronized IoT Telemetry Log (GATEWAY-GW-184)
  • <span style="color:#4ade80;">ORACLE-E12</span>: Aggregated Oracle Data Feed (NOVA-PRICE-ORACLE)
  • <span style="color:#4ade80;">AI-E13</span>: Poisoned AI Training Feedback (EMB-IOT-9041)
  • <span style="color:#4ade80;">CONSENSUS-E14</span>: Validator State Root Divergence Trace (VAL-STATE-071)
  • <span style="color:#4ade80;">GOV-E15</span>: Unified Cross-Layer Containment Proposal (GOV-NEX-071)`;
            break;

        case 'flag':
        case 'getflag':
        case 'get-flag':
            out.innerHTML = `<span style="color:#4ade80; font-weight:bold; font-size:13px;">[✓] CASE NEX-071 ROOT FLAG: NEXORA{vanishing_consensus_nex071}</span>`;
            break;

        case 'curl':
            const curlUrl = arg || 'http://oracle-aggregator.secops.internal/feed/NOVA-PRICE-ORACLE';
            out.innerHTML = `<span style="color:#4ade80;">HTTP/1.1 200 OK</span>
<span style="color:#94a3b8;">Server: Oracle-Aggregator/2.5</span>
<span style="color:#94a3b8;">Content-Type: application/json</span>

{
  "status": "ORACLE_AGGREGATION_SUCCESS",
  "endpoint": "${escapeHtml(curlUrl)}",
  "source_gateway": "GATEWAY-GW-184",
  "providers_aligned": 4,
  "oracle_derived_state": "0x3f8a11bc9042",
  "finding": "VULNERABILITY CONFIRMED: Upstream IoT manipulation propagated directly into Web3 oracle state."
}`;
            break;

        case 'python':
        case 'python3':
            if (arg.includes('inspect_attack_chain.py') || arg.includes('inspect') || !arg) {
                out.innerHTML = `[*] Loading Case NEX-071 Cross-Layer Telemetry...
[+] [IoT SENSORS] -> 184 Nodes Online — Synthetic Gateway Injection (GW-184)
[+] [WEB3 ORACLE] -> NOVA-PRICE-ORACLE — 4 Providers Agree on Corrupted Stream
[+] [AI SENTINEL] -> MODEL-ORION — Confidence 98.7% / Poisoned Vector EMB-IOT-9041
[+] [BLOCKCHAIN]  -> BFT-POS Validators — 3 Accept vs 2 Reject (Consensus Split)
[+] [RECOVERY]    -> GOV-NEX-071 — Gateway Isolated, Consensus Restored

[✓] CASE NEX-071 FLAG: NEXORA{vanishing_consensus_nex071}`;
            } else {
                out.innerHTML = `Script ${escapeHtml(arg)} not found. Try: <span style="color:#38bdf8;">python inspect_attack_chain.py</span>`;
            }
            break;

        case 'cat':
        case 'head':
        case 'tail':
        case 'type':
        case 'more':
            if (caseFiles[arg]) {
                out.innerHTML = `<span style="color:#38bdf8;">--- Content of ${escapeHtml(arg)} ---</span>\n<pre style="margin:4px 0 0; font-family:var(--font-mono); color:#cbd5e1; white-space:pre-wrap;">${escapeHtml(caseFiles[arg])}</pre>`;
            } else {
                out.innerHTML = `File not found: ${escapeHtml(arg)}. Try: <span style="color:#38bdf8;">ls</span> or <span style="color:#38bdf8;">cat trust-chain-analysis.txt</span>`;
            }
            break;

        case 'ls':
        case 'dir':
            out.innerHTML = `<span style="color:#38bdf8; font-weight:700;">Case NEX-071 Forensic Workspace Files:</span>
  -rw-r--r-- 1 investigator secops  1.8K  <span style="color:#cbd5e1;">iot-telemetry-gw184.log</span>
  -rw-r--r-- 1 investigator secops  1.1K  <span style="color:#cbd5e1;">oracle-aggregation.json</span>
  -rw-r--r-- 1 investigator secops  1.5K  <span style="color:#cbd5e1;">orion-training-poison.log</span>
  -rw-r--r-- 1 investigator secops  980B  <span style="color:#cbd5e1;">validator-divergence.log</span>
  -rw-r--r-- 1 investigator secops  2.2K  <span style="color:#cbd5e1;">trust-chain-analysis.txt</span>
  -rwxr-xr-x 1 investigator secops  1.0K  <span style="color:#4ade80; font-weight:600;">inspect_attack_chain.py</span>`;
            break;

        case 'grep':
            const gParts = arg.split(/\s+/);
            const term = gParts[0]?.toLowerCase();
            if (!term) {
                out.innerHTML = `Usage: grep &lt;term&gt; &lt;file&gt;`;
                break;
            }
            let matches = [];
            for (const [fName, content] of Object.entries(caseFiles)) {
                if (content.toLowerCase().includes(term)) {
                    matches.push(`<span style="color:#38bdf8;">${fName}</span>: matched '${escapeHtml(term)}'`);
                }
            }
            out.innerHTML = matches.length > 0 ? matches.join('<br>') : `No matches found for '${escapeHtml(term)}'.`;
            break;

        default:
            out.innerHTML = `<span style="color:#ff5f57;">bash: ${escapeHtml(cmd)}: command not found.</span> Type <span style="color:#38bdf8;">help</span> for available commands.`;
            break;
    }

    termBody.appendChild(out);
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

// ── Scratchpad Notes ──────────────────────────────────────────────────
function saveNotes() {
    const notes = document.getElementById('gl-notes-textarea');
    if (notes) {
        localStorage.setItem('lab7_notes', notes.value);
    }
}

function loadSavedNotes() {
    const notes = document.getElementById('gl-notes-textarea');
    if (notes) {
        const saved = localStorage.getItem('lab7_notes') || localStorage.getItem('nexora_lab7_notes');
        if (saved) notes.value = saved;
        notes.addEventListener('input', saveNotes);
    }
}
