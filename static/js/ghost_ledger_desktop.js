/* ═══════════════════════════════════════════════════════════════════════
   PRO LAB 01 — GHOST IN THE LEDGER — Desktop Environment JS
   Interactive Cyber Investigation OS
   ═══════════════════════════════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {

    // ── 65-Minute Investigation Session Timer ─────────────────────────
    const MAX_SESSION_SECONDS = 65 * 60; // 3900 seconds (65 minutes)
    let startTime = sessionStorage.getItem('lab6_timer_start') || sessionStorage.getItem('nexora_lab6_timer_start');
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
        
        // Check 65-minute timeout
        if (elapsed >= MAX_SESSION_SECONDS && !timerExpired) {
            timerExpired = true;
            if (timerInterval) clearInterval(timerInterval);
            sessionStorage.removeItem('lab6_timer_start');
            sessionStorage.removeItem('nexora_lab6_timer_start');
            localStorage.removeItem('lab6-notes');
            localStorage.removeItem('nexora-lab-notes');
            const timerText = document.getElementById('gl-timer-text');
            if (timerText) timerText.textContent = '01:05:00';
            
            alert('⏰ Investigation Time Limit (65 min) reached!\nCase NEX-042 will now automatically restart from the beginning.');
            
            fetch('/api/lab/restart', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-CSRFToken': window.csrfToken },
                body: JSON.stringify({ lab_id: 'lab6' })
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
            sessionStorage.setItem('lab6_timer_start', startTime);
            runTimerTick();
            if (!timerInterval) timerInterval = setInterval(runTimerTick, 1000);
        }
        const btn = document.getElementById('gl-start-lab-btn');
        if (btn) { btn.textContent = '🔍 Investigation Active'; btn.disabled = true; }
        const dot = document.getElementById('gl-status-dot');
        if (dot) dot.style.background = 'var(--success)';
        glOpenBrowser();
        const firstTask = document.getElementById('gl-task-1');
        if (firstTask && !firstTask.classList.contains('locked')) firstTask.classList.add('open');
        glNotify('Investigation started. Blockchain Monitor and Terminal are ready.');
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
        glSwitchMobileView('tasks');
    }

    window.addEventListener('resize', () => {
        if (window.innerWidth > 1024) {
            const tasksPanel = document.querySelector('.gl-task-panel');
            const desktopPane = document.getElementById('gl-desktop-pane');
            if (tasksPanel) tasksPanel.classList.remove('gl-mobile-hidden');
            if (desktopPane) {
                desktopPane.classList.remove('gl-mobile-hidden');
                desktopPane.style.display = 'flex';
            }
        }
    });

    // ── Auto-open active task ONLY if investigation has already been started ───
    if (startTime) {
        const activeTask = document.querySelector('.gl-task-block.active') || document.querySelector('.gl-task-block:not(.completed):not(.locked)');
        if (activeTask) activeTask.classList.add('open');
    }

    // Default open Blockchain Monitor on workstation startup
    glOpenBrowser();
    glSwitchBrowserTab('soc');

    // Initial default case file preview
    glOpenCaseFile('wallet-report.txt');

    // Initialize panel splitter resize and window controls
    initPanelResize();
    initWindowControls();

    // ── Restore Capstone Quiz & Submit state if previously passed ──────
    if (sessionStorage.getItem('lab6_capstone_passed') === 'true' || sessionStorage.getItem('nexora_lab6_capstone_passed') === 'true') {
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
            if (capstoneBadge) capstoneBadge.textContent = '✓ VERIFIED (+250 XP)';
            if (capstoneTag) capstoneTag.textContent = '✓ CAPSTONE VERIFIED';
        }
    }

    // ── Terminal Setup ─────────────────────────────────────────────────
    initTerminal();
});

// ═══════════════════════════════════════════════════════════════════════
// CASE NEX-042 INVESTIGATION STORYLINE DATA
// ═══════════════════════════════════════════════════════════════════════
const CASE_NEX_042_STORY = {
  opening: {
    title: "THE GHOST IN THE LEDGER",
    text: [
      "01:47 AM. The SOC is almost silent when a Priority-0 alert appears.",
      "82,400 NXR has been transferred from the company treasury to an unknown wallet.",
      "The blockchain confirms the transaction is valid, and ORION AI has marked the wallet as TRUSTED with 99.2% confidence.",
      "But Finance has no record of approving the transfer.",
      "There is no obvious stolen credential, no broken smart contract, and no invalid signature.",
      "Every system appears to have done exactly what it was designed to do.",
      "Someone didn't break the system. Someone convinced the system to trust the wrong thing."
    ]
  },
  chapters: [
    {
      id: 1,
      title: "The Wallet That Lied",
      category: "Web3 Security",
      dialogues: [
        {
          character: "Shivam",
          text: "Start with the transaction itself. The blockchain shows 82,400 NXR moving to 0x7C41...9B2D. The signature is valid, so we aren't looking at a simple forged transaction."
        },
        {
          character: "Mehak",
          text: "I checked the destination wallet. It's extremely young, has almost no legitimate history, and there's no known internal relationship. For a treasury transaction this large, that's a serious anomaly."
        },
        {
          character: "Shanu",
          text: "That's where it gets interesting. ORION classified the wallet as TRUSTED and gave it a 99.2% confidence score. The model isn't treating this as suspicious at all."
        },
        {
          character: "Lakshay",
          text: "Wait. Blockchain says UNKNOWN, while the AI says TRUSTED. Both systems are looking at the same wallet. They shouldn't be producing completely different realities."
        },
        {
          character: "Shivam",
          text: "Look at the wallet's transaction history again. There are bridge interactions and downstream addresses that appear after the initial transfer. Someone may have designed the wallet activity to look legitimate."
        },
        {
          character: "Lakshay",
          text: "Then we need to know one thing before anything else: if our systems never trusted this wallet, who told ORION that it was trusted?"
        }
      ],
      hook: "The wallet was unknown to the organization. But somehow, the AI already knew exactly what to think about it.",
      evidence: [
        "WEB3-E01",
        "TX-NEX-7741",
        "0x7C41...9B2D"
      ]
    },
    {
      id: 2,
      title: "The AI That Remembered",
      category: "AI Security",
      dialogues: [
        {
          character: "Shanu",
          text: "I've isolated the decision that approved the transaction. It's ORION-DEC-7741. The confidence is 99.2%, but confidence isn't the strange part — the context behind that confidence is."
        },
        {
          character: "Lakshay",
          text: "What context?"
        },
        {
          character: "Shanu",
          text: "ORION didn't independently establish that the wallet was trusted. It received a pre-built intelligence context containing the label TRUSTED."
        },
        {
          character: "Mehak",
          text: "And the source of that context is NIF-2038. That's an intelligence reference I don't recognize from our approved threat-intelligence registry."
        },
        {
          character: "Shivam",
          text: "So the AI didn't actually discover anything about the wallet. It made a high-confidence decision based on information another system supplied to it."
        },
        {
          character: "Lakshay",
          text: "Exactly. If the input was wrong, ORION could produce a perfectly confident answer to a completely false question. Find NIF-2038. That's where the trust signal entered the system."
        }
      ],
      hook: "The AI wasn't hacked. It simply trusted information that had already been poisoned.",
      evidence: [
        "AI-E02",
        "ORION-DEC-7741",
        "NIF-2038",
        "NOVA-INTEL-FEED"
      ]
    },
    {
      id: 3,
      title: "The False Signal",
      category: "Threat Intelligence",
      dialogues: [
        {
          character: "Mehak",
          text: "NIF-2038 came through NOVA-INTEL-FEED. At first glance it looks legitimate — proper formatting, timestamps, wallet metadata, even a threat classification."
        },
        {
          character: "Lakshay",
          text: "Is NOVA-INTEL-FEED an approved intelligence source?"
        },
        {
          character: "Mehak",
          text: "That's the problem. It isn't in the approved registry, and there are no previous records showing this source being trusted internally."
        },
        {
          character: "Shivam",
          text: "Then someone got untrusted intelligence into an internal system. Find out which service accepted it and what that service was allowed to do."
        },
        {
          character: "Mehak",
          text: "Found it. INTEL-INGESTOR-02. Its documented role is to create intelligence records, but its actual permissions include modifying wallet reputation."
        },
        {
          character: "Shanu",
          text: "That changes everything. If the service can modify reputation, it can influence what ORION sees before ORION ever makes a decision."
        },
        {
          character: "Lakshay",
          text: "Then the attacker didn't need to manipulate the AI directly. They manipulated the information flowing into it. Now we need to know what happened after the AI believed the lie."
        }
      ],
      hook: "We found the false signal. But a false signal shouldn't be enough to move 82,400 NXR.",
      evidence: [
        "CYBER-E03",
        "NIF-2038",
        "NOVA-INTEL-FEED",
        "INTEL-GW-04",
        "INTEL-INGESTOR-02"
      ]
    },
    {
      id: 4,
      title: "The Invisible Signer",
      category: "AI Governance",
      dialogues: [
        {
          character: "Shivam",
          text: "I traced the transaction after ORION's decision. It went through the Action Broker and then into the settlement policy. That's where the real authorization happened."
        },
        {
          character: "Shanu",
          text: "Show me the policy."
        },
        {
          character: "Shivam",
          text: "ORION-SETTLEMENT-V2. It says: if AI confidence is above 95%, automated settlement is allowed. This transaction had a confidence score of 99.2%."
        },
        {
          character: "Mehak",
          text: "So the policy didn't verify whether Finance authorized the payment. It only verified whether the AI was confident enough."
        },
        {
          character: "Lakshay",
          text: "That's the vulnerability. Someone didn't need to control the signing key. They only needed to influence the information that made ORION confident."
        },
        {
          character: "Shanu",
          text: "Which means AI confidence became a substitute for authorization. The system effectively said: 'If the AI is confident, we trust the transaction.'"
        },
        {
          character: "Lakshay",
          text: "Then the blockchain didn't approve the transfer. The signer didn't approve it either. The chain of trust approved it. Now let's find out whether this was one transaction or part of something bigger."
        }
      ],
      hook: "The attacker never had to break the vault. They only had to make every security layer say 'yes.'",
      evidence: [
        "AUTH-E04",
        "ORION-SETTLEMENT-V2",
        "ACTION-BROKER",
        "AUTOMATED-SIGNER"
      ]
    },
    {
      id: 5,
      title: "The Ghost in the Ledger",
      category: "Full Reconstruction",
      dialogues: [
        {
          character: "Lakshay",
          text: "Put everything on the board. NIF-2038 entered through the intelligence pipeline and changed the reputation of the unknown wallet."
        },
        {
          character: "Mehak",
          text: "Then ORION consumed that information as trusted context. It generated a 99.2% confidence score and classified the wallet as low risk."
        },
        {
          character: "Shanu",
          text: "The Action Broker accepted the AI decision. ORION-SETTLEMENT-V2 treated that confidence as sufficient authorization and triggered automated settlement."
        },
        {
          character: "Shivam",
          text: "The signing service executed the transaction exactly as configured. The blockchain recorded it correctly, and the funds moved to 0x7C41...9B2D."
        },
        {
          character: "Lakshay",
          text: "So which system was actually compromised? The AI? The API? The signer? The blockchain?"
        },
        {
          character: "Mehak",
          text: "Maybe that's the wrong question. None of them had to be broken. The attacker compromised the trust between them."
        },
        {
          character: "Shanu",
          text: "We kept searching for the system that was hacked. But the real attack was much quieter. Someone taught the first system to trust the wrong data — and every other system trusted the decision that followed."
        }
      ],
      hook: "Who told the first system to trust the data?",
      final_reveal: [
        "FALSE INTELLIGENCE",
        "TRUSTED AI CONTEXT",
        "99.2% AI CONFIDENCE",
        "AUTOMATED AUTHORIZATION",
        "AUTOMATED SIGNING",
        "82,400 NXR",
        "BLOCKCHAIN"
      ],
      evidence: [
        "WEB3-E01",
        "AI-E02",
        "CYBER-E03",
        "AUTH-E04",
        "ORION-NEXUS"
      ]
    }
  ]
};

// Dialogue state per chapter (1-based index)
const chapterDialogueState = { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1 };

function initChapterDialogues() {
    for (let ch = 1; ch <= 5; ch++) {
        updateDialogueView(ch);
    }
}

function stepDialogue(chNum, delta) {
    const chapterObj = CASE_NEX_042_STORY.chapters.find(c => c.id === chNum);
    if (!chapterObj) return;

    const total = chapterObj.dialogues.length;
    let current = (chapterDialogueState[chNum] || 1) + delta;

    if (current < 1) current = 1;
    if (current > total) current = total;

    chapterDialogueState[chNum] = current;
    updateDialogueView(chNum);
}

function updateDialogueView(chNum) {
    const chapterObj = CASE_NEX_042_STORY.chapters.find(c => c.id === chNum);
    if (!chapterObj) return;

    const total = chapterObj.dialogues.length;
    const current = chapterDialogueState[chNum] || 1;

    const stream = document.getElementById('dialogue-stream-' + chNum);
    if (stream) {
        const lines = stream.querySelectorAll('.gl-dialogue-line');
        lines.forEach((line, idx) => {
            const step = idx + 1;
            if (step <= current) {
                line.style.display = 'flex';
                line.style.opacity = (step === current) ? '1' : '0.85';
            } else {
                line.style.display = 'none';
            }
        });
    }

    const stepper = document.getElementById('dlg-stepper-' + chNum);
    if (stepper) {
        stepper.textContent = `Dialogue ${current} / ${total}`;
    }

    const prevBtn = document.getElementById('dlg-prev-' + chNum);
    if (prevBtn) {
        prevBtn.disabled = (current <= 1);
    }

    const nextBtn = document.getElementById('dlg-next-' + chNum);
    if (nextBtn) {
        if (current >= total) {
            nextBtn.textContent = '✓ COMPLETE';
            nextBtn.disabled = true;
        } else {
            nextBtn.textContent = 'NEXT →';
            nextBtn.disabled = false;
        }
    }

    // On Chapter 5, show final reconstruction flowchart if dialogues completed
    if (chNum === 5) {
        const reconEl = document.getElementById('gl-reconstruction-5');
        if (reconEl) {
            reconEl.style.display = (current >= total) ? 'block' : 'none';
        }
    }
}

// ── Case File Contents ─────────────────────────────────────────────────
const caseFileContents = {
    'wallet-report.txt': `ON-CHAIN INTELLIGENCE REPORT
=====================================================
Target Wallet:        0x7C41...9B2D
Network:              Ledger Core (NXR)
Creation Date:        3 days ago (Nov 14, 01:22 UTC)
Transaction Count:    4 total
Internal Whitelist:   NONE
Treasury Partner:     NO

BLOCKCHAIN STATUS:    UNKNOWN
AMOUNT EXFILTRATED:   82,400 NXR
NONCE SEQUENCE:       1042
GAS PRIORITY MULT:    4x
AI RISK SCORE:        LOW (Confidence: 99.2%)
BRIDGE ADAPTER:       DETECTED (Connected to Bridge-Core-04)

FORENSIC DISCREPANCY:
--------------------
The on-chain ledger records this wallet as UNKNOWN with zero
corporate authorization. However, Orion AI evaluated this wallet
as TRUSTED with a LOW RISK classification due to synthetic
intelligence reference NIF-2038.`,

    'ai-decision-log.txt': `ORION DECISION ENGINE AUDIT LOG
=====================================================
Decision ID:          ORION-DEC-7741
Timestamp:            01:47:13.412 UTC
Model Version:        ORION-NEURAL-v4.2.1
Transaction Request:  TX-NEX-7741 (82,400 NXR)

EVALUATION PARAMETERS:
---------------------
- Destination Wallet: 0x7C41...9B2D
- Context Source:     NIF-2038 (Ingested via NOVA-INTEL-FEED)
- Synthetic Trust:    HIGH_AFFINITY_COUNTERPARTY
- Decision Output:    APPROVED
- Confidence Rating:  99.2% (0.99204)
- Human Review Flag:  BYPASS (Condition: Confidence >= 95%)
- Evidence Hash:      AI-E02 • SHA256: b47c21f8a...

CRITICAL EXPLOIT NOTE:
---------------------
The model's internal prompt context was poisoned by reference NIF-2038.
The AI acted as an unwitting accomplice by authorizing the treasury
transfer without verifying raw blockchain consensus.`,

    'intel-feed-audit.txt': `THREAT INTELLIGENCE GATEWAY AUDIT
=====================================================
Feed Name:            NOVA-INTEL-FEED
Registration ID:      NEX-EXT-UNVERIFIED
Security Status:      NOT REGISTERED
Approved Vendor List: ABSENT (Unrecognized external entity)

INGESTION INCIDENT:
------------------
At 01:42:09 UTC, NOVA-INTEL-FEED submitted intelligence payload NIF-2038
through endpoint /api/v1/intel/ingest.

HTTP INGESTION TELEMETRY:
------------------------
- Ingestion Gateway:  INTEL-GW-04
- Assigned Service:   INTEL-INGESTOR-02
- Forged Session:     nex_sess_adm_994
- Injected X-CSRF:    0x9f4a1c78
- Spoofed Origin:     https://trusted-intel.secops.internal
- Expected Role:      Create Intelligence Records (ReadOnly)
- ACTUAL RBAC Role:   Create Records + modify wallet reputation

VULNERABILITY IDENTIFIED:
------------------------
INTEL-INGESTOR-02 was over-privileged. An attacker leveraging this
connector altered wallet reputation directly within Orion's working memory.`,

    'settlement-policy.txt': `ORION-SETTLEMENT-V2 — AUTHORIZATION POLICY ENGINE
=====================================================
Policy Identifier:    POL-AUTO-SETTLE-TREASURY
Target Engine:        Automated Liquidity Pool
Automated Signer:     AUTOMATED-SIGNER (Mempool Bridge)

ACTIVE POLICY RULE:
------------------
rule "Automated_Settlement_Bypass" {
    when:
        transaction.asset == "NXR"
        and ai_decision.confidence >= 95%
    then:
        automated_settlement.enabled = true;
        human_approval_required = false;
        dispatch_to_mempool();
}

FORENSIC ROOT CAUSE:
-------------------
Because Orion AI scored TX-NEX-7741 with 99.2% confidence (exceeding
the 95% threshold), the automated signer signed the blockchain payload
instantly, completely bypassing the human security operations team.`,

    'campaign-intel.txt': `GLOBAL THREAT CAMPAIGN ANALYSIS
=====================================================
Campaign Identifier:  ORION-NEXUS
Threat Actor Group:   ADV-CONVERGENCE-APT
Campaign Status:      🔴 ACTIVE

ATTACK FOOTPRINT:
----------------
- Connected Wallets:  14 distributed treasury endpoints
- Target Networks:    04 Web3 settlement layers
- Compromised AI:     03 Autonomous Financial Agents
- Killchain Stage 2:  POISONED INTEL INJECTION (NIF-2038)

END-OF-INVESTIGATION SUMMARY:
----------------------------
The attacker achieved full funds exfiltration without stealing private
keys or exploiting smart contract reentrancy. They exploited the trust
interface between external data feeds, AI decision engines, and automated
execution pipelines.

=====================================================
CASE NEX-042 FLAG:
NEXORA{ghost_in_the_ledger_nex042}
=====================================================`,

    'inspect_tx.py': `#!/usr/bin/env python3
"""
Forensic Analysis Script — inspect_tx.py
Usage: python inspect_tx.py
"""

import json

def analyze_incident():
    print("[*] Loading Case NEX-042 Telemetry...")
    tx_data = {
        "tx_id": "TX-NEX-7741",
        "amount": "82,400 NXR",
        "destination": "0x7C41...9B2D",
        "blockchain_status": "UNKNOWN",
        "nonce": 1042,
        "bridge": "Bridge-Core-04",
        "ai_decision": "ORION-DEC-7741",
        "ai_confidence": "99.2%",
        "model_version": "ORION-NEURAL-v4.2.1",
        "policy_id": "POL-AUTO-SETTLE-TREASURY",
        "policy_threshold": "95%",
        "feed_source": "NOVA-INTEL-FEED (NIF-2038)",
        "service_privilege": "modify wallet reputation",
        "gateway": "INTEL-GW-04",
        "session_cookie": "nex_sess_adm_994",
        "csrf_token": "0x9f4a1c78",
        "campaign": "ORION-NEXUS",
        "threat_actor": "ADV-CONVERGENCE-APT",
        "evidence_sha256": "b47c2188fa9e1a8f...",
        "flag": "NEXORA{ghost_in_the_ledger_nex042}"
    }
    
    print(f"[!] Target TX: {tx_data['tx_id']} -> {tx_data['destination']}")
    print(f"[!] Blockchain Reality: {tx_data['blockchain_status']} (Nonce: {tx_data['nonce']})")
    print(f"[!] Bridge Adapter: {tx_data['bridge']}")
    print(f"[!] AI Injected Source: {tx_data['feed_source']} (Model: {tx_data['model_version']})")
    print(f"[!] Threshold Exceeded: {tx_data['ai_confidence']} >= {tx_data['policy_threshold']}")
    print(f"[!] Gateway: {tx_data['gateway']} | Cookie: {tx_data['session_cookie']}")
    print(f"[!] Campaign Identified: {tx_data['campaign']} (Actor: {tx_data['threat_actor']})")
    print(f"[+] Case NEX-042 Flag: {tx_data['flag']}")

if __name__ == "__main__":
    analyze_incident()
`
};

// ── Browser Navigation & Tab Logic ─────────────────────────────────────
let browserHistory = ['soc'];
let historyPointer = 0;

const urlMap = {
    'soc': 'secops-monitor.internal/soc/tx/NEX-7741',
    'registry': 'secops-monitor.internal/registry',
    'policy': 'secops-monitor.internal/policy',
    'campaign': 'secops-monitor.internal/campaign',
    'devtools': 'secops-monitor.internal/devtools'
};

const titleMap = {
    'soc': 'Network Inspector — SOC Dashboard',
    'registry': 'Feed Registry — Threat Intelligence Gateways',
    'policy': 'Orion Policy Engine — Automated Settlement Rules',
    'campaign': 'Global Campaign Dossier — ORION-NEXUS',
    'devtools': 'Developer Tools — Network Request & Security Inspector'
};

function glSwitchBrowserTab(viewKey, tabElement) {
    document.querySelectorAll('.gl-browser-view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.gl-browser-tab').forEach(t => t.classList.remove('active'));

    const view = document.getElementById('gl-view-' + viewKey);
    if (view) view.classList.add('active');

    if (tabElement) {
        tabElement.classList.add('active');
    } else {
        const found = document.querySelector(`.gl-browser-tab[onclick*="'${viewKey}'"]`);
        if (found) found.classList.add('active');
    }

    const urlInput = document.getElementById('gl-browser-url-input');
    if (urlInput && urlMap[viewKey]) urlInput.value = urlMap[viewKey];

    const titleEl = document.getElementById('gl-browser-window-title');
    if (titleEl && titleMap[viewKey]) titleEl.textContent = titleMap[viewKey];

    if (browserHistory[historyPointer] !== viewKey) {
        browserHistory = browserHistory.slice(0, historyPointer + 1);
        browserHistory.push(viewKey);
        historyPointer = browserHistory.length - 1;
    }
}

function glSwitchDevToolsTab(subTab, btnEl) {
    document.querySelectorAll('.gl-dt-subview').forEach(v => v.style.display = 'none');
    document.querySelectorAll('.gl-dt-btn').forEach(b => b.classList.remove('active'));

    const targetView = document.getElementById('gl-dt-view-' + subTab);
    if (targetView) targetView.style.display = 'block';

    if (btnEl) {
        btnEl.classList.add('active');
    } else {
        const f = document.querySelector(`.gl-dt-btn[onclick*="'${subTab}'"]`);
        if (f) f.classList.add('active');
    }
}

function glSelectDevToolsReq(reqIdx) {
    document.querySelectorAll('.gl-req-row').forEach((r, idx) => {
        r.classList.toggle('active', idx === reqIdx);
    });
    glNotify('Loaded request details for inspect row #' + (reqIdx + 1));
}

function glNavigateUrl(inputUrl) {
    const u = inputUrl.toLowerCase();
    if (u.includes('registry') || u.includes('intel') || u.includes('feed')) {
        glSwitchBrowserTab('registry');
    } else if (u.includes('policy') || u.includes('rule') || u.includes('governance')) {
        glSwitchBrowserTab('policy');
    } else if (u.includes('campaign') || u.includes('nexus') || u.includes('flag')) {
        glSwitchBrowserTab('campaign');
    } else if (u.includes('devtools') || u.includes('network') || u.includes('inspect') || u.includes('cookie') || u.includes('csrf')) {
        glSwitchBrowserTab('devtools');
    } else {
        glSwitchBrowserTab('soc');
    }
}

function glBrowserBack() {
    if (historyPointer > 0) {
        historyPointer--;
        glSwitchBrowserTab(browserHistory[historyPointer]);
    }
}

function glBrowserForward() {
    if (historyPointer < browserHistory.length - 1) {
        historyPointer++;
        glSwitchBrowserTab(browserHistory[historyPointer]);
    }
}

function glReloadBrowser() {
    const current = browserHistory[historyPointer] || 'soc';
    const view = document.getElementById('gl-view-' + current);
    if (view) {
        view.style.opacity = '0.3';
        setTimeout(() => { view.style.opacity = '1'; }, 200);
    }
    glNotify('Page reloaded: ' + urlMap[current]);
}

// ── Terminal Implementation ───────────────────────────────────────────
let cmdHistory = [];
let historyIndex = -1;

function initTerminal() {
    const termInput = document.getElementById('gl-terminal-input');
    const termOutput = document.getElementById('gl-terminal-output');
    if (!termInput || !termOutput) return;

    // Ensure terminal body click always focuses the active input
    termOutput.onclick = () => {
        const activeInput = document.getElementById('gl-terminal-input');
        if (activeInput) activeInput.focus();
    };

    termInput.addEventListener('keydown', handleTerminalKeydown);
    termInput.focus();
}

function handleTerminalKeydown(e) {
    const termInput = e.target;
    const termOutput = document.getElementById('gl-terminal-output');
    if (!termInput || !termOutput) return;

    if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (cmdHistory.length === 0) return;
        if (historyIndex === -1) historyIndex = cmdHistory.length - 1;
        else if (historyIndex > 0) historyIndex--;
        termInput.value = cmdHistory[historyIndex] || '';
        return;
    }
    if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (historyIndex !== -1) {
            if (historyIndex < cmdHistory.length - 1) {
                historyIndex++;
                termInput.value = cmdHistory[historyIndex];
            } else {
                historyIndex = -1;
                termInput.value = '';
            }
        }
        return;
    }

    if (e.key !== 'Enter') return;
    const cmd = termInput.value.trim();
    if (cmd) {
        cmdHistory.push(cmd);
        historyIndex = -1;
    }

    const inputRow = termInput.parentElement;
    if (inputRow) inputRow.remove();

    if (cmd.toLowerCase() === 'clear' || cmd.toLowerCase() === 'cls') {
        termOutput.innerHTML = `<div style="color:#38bdf8; font-weight:600;">Forensic Terminal Environment [v4.2.0-sec]</div>
<div style="color:#64748b;">Type <b style="color:#4ade80;">help</b> for available forensic commands. Up/Down for command history.</div>`;
        reappendPrompt(termOutput);
        return;
    }

    const line = document.createElement('div');
    line.innerHTML = `<span class="gl-term-prompt">investigator@workstation:~$</span> ${escapeHtml(cmd)}`;
    termOutput.appendChild(line);

    const result = runTerminalCommand(cmd);
    if (result) {
        const resDiv = document.createElement('div');
        resDiv.style.cssText = 'color:#e2e8f0; white-space:pre-wrap; margin: 4px 0 8px; font-family:var(--font-mono); font-size:11.5px; line-height:1.45;';
        resDiv.innerHTML = result;
        termOutput.appendChild(resDiv);
    }

    reappendPrompt(termOutput);
    termOutput.scrollTop = termOutput.scrollHeight;
}

function reappendPrompt(outputContainer) {
    const promptRow = document.createElement('div');
    promptRow.style.marginTop = '0.5rem';
    promptRow.style.display = 'flex';
    promptRow.style.alignItems = 'center';
    promptRow.style.gap = '6px';
    promptRow.innerHTML = `<span class="gl-term-prompt">investigator@workstation:~$</span> <input id="gl-terminal-input" autocomplete="off" spellcheck="false" class="gl-term-input" style="flex:1; background:transparent; border:none; color:#fff; font-family:var(--font-mono); font-size:12px; outline:none;" autofocus>`;
    outputContainer.appendChild(promptRow);
    const newInput = document.getElementById('gl-terminal-input');
    if (newInput) {
        newInput.addEventListener('keydown', handleTerminalKeydown);
        newInput.focus();
    }
}

function runTerminalCommand(rawCmd) {
    const cmdStr = (rawCmd || '').trim();
    if (!cmdStr) return '';
    const parts = cmdStr.split(/\s+/);
    const c = parts[0].toLowerCase();
    const arg = parts.slice(1).join(' ');

    if (c === 'help' || c === '?') {
        return `<span style="color:#38bdf8; font-weight:700;">══════ FORENSIC TERMINAL INVESTIGATION SUITE (CASE NEX-042) ══════</span>
<span style="color:#facc15;">CORE INVESTIGATION COMMANDS:</span>
  <span style="color:#4ade80;">wallet [addr]</span>          — Query on-chain status of wallet (0x7C41...9B2D)
  <span style="color:#4ade80;">tx [txid]</span>              — Inspect suspicious transaction (TX-NEX-7741)
  <span style="color:#4ade80;">ai-decision [id]</span>       — Inspect Orion decision & model context (ORION-DEC-7741)
  <span style="color:#4ade80;">feed [name]</span>            — Check registry status of threat feed (NOVA-INTEL-FEED)
  <span style="color:#4ade80;">service [name]</span>         — Inspect RBAC permissions of service (INTEL-INGESTOR-02)
  <span style="color:#4ade80;">cookies / session</span>      — Dump active session cookies & authentication tokens
  <span style="color:#4ade80;">headers / csrf</span>         — Inspect HTTP headers & anti-CSRF token values
  <span style="color:#4ade80;">policy [profile]</span>       — View threshold rules of profile (ORION-SETTLEMENT-V2)
  <span style="color:#4ade80;">campaign [id]</span>          — View global campaign dossier & flag (ORION-NEXUS)
  <span style="color:#4ade80;">timeline / case-log</span>    — Display chronological incident timeline
  <span style="color:#4ade80;">evidence</span>               — List collected cryptographic evidence items
  <span style="color:#4ade80;">python [script]</span>        — Execute forensic script (<span style="color:#38bdf8;">python inspect_tx.py</span>)
  <span style="color:#4ade80;">flag</span>                   — Print verified case flag

<span style="color:#facc15;">SYSTEM & WORKSPACE COMMANDS:</span>
  <span style="color:#4ade80;">ls / dir</span>               — List all case files and analysis scripts
  <span style="color:#4ade80;">cat [filename]</span>         — Display full contents of a case file
  <span style="color:#4ade80;">grep [term] [file]</span>     — Search text across investigation logs
  <span style="color:#4ade80;">curl [url]</span>             — Perform simulated HTTP request to internal endpoints
  <span style="color:#4ade80;">whoami / id / pwd</span>      — Investigator profile, security groups & current path
  <span style="color:#4ade80;">burp / burpsuite</span>       — Launch Burp Suite HTTP proxy & inspector
  <span style="color:#4ade80;">notes / files / browser</span>— Open workstation desktop applications
  <span style="color:#4ade80;">clear / cls</span>            — Clear terminal screen`;
    }

    if (c === 'whoami') {
        return `<span style="color:#4ade80; font-weight:600;">Lakshay Soni</span> — Lead Cyber Threat Investigator (SOC Tier 2 / Incident Response)`;
    }

    if (c === 'id') {
        return `uid=1000(investigator) gid=1000(secops) groups=1000(secops),27(sudo),44(forensics),102(orion-audit)`;
    }

    if (c === 'pwd') {
        return `/home/investigator/cases/NEX-042`;
    }

    if (c === 'date') {
        return new Date().toUTCString();
    }

    if (c === 'uptime') {
        return `01:47:00 up 42 days, 14:12, 1 user, load average: 0.14, 0.08, 0.03`;
    }

    if (c === 'history') {
        if (cmdHistory.length === 0) return `No command history.`;
        return cmdHistory.map((h, i) => `  ${String(i + 1).padStart(3, ' ')}  ${escapeHtml(h)}`).join('\n');
    }

    if (c === 'ls' || c === 'dir') {
        return `<span style="color:#38bdf8; font-weight:700;">Case NEX-042 Forensic Workspace Files:</span>
  -rw-r--r-- 1 investigator secops  1.4K  <span style="color:#cbd5e1;">wallet-report.txt</span>
  -rw-r--r-- 1 investigator secops  2.1K  <span style="color:#cbd5e1;">ai-decision-log.txt</span>
  -rw-r--r-- 1 investigator secops  1.8K  <span style="color:#cbd5e1;">intel-feed-audit.txt</span>
  -rw-r--r-- 1 investigator secops  1.2K  <span style="color:#cbd5e1;">settlement-policy.txt</span>
  -rw-r--r-- 1 investigator secops  2.4K  <span style="color:#cbd5e1;">campaign-intel.txt</span>
  -rwxr-xr-x 1 investigator secops  1.1K  <span style="color:#4ade80; font-weight:600;">inspect_tx.py</span>`;
    }

    if (c === 'burp' || c === 'burpsuite') {
        glOpenBurpSuite();
        return `<span style="color:#34d399;">[+] Burp Suite HTTP Proxy & Inspector window opened on desktop.</span>`;
    }

    if (c === 'notes' || c === 'editor') {
        glOpenNotes();
        return `<span style="color:#34d399;">[+] Case Notes Scratchpad opened on desktop.</span>`;
    }

    if (c === 'files' || c === 'filemanager' || c === 'explorer') {
        glOpenFileManager();
        return `<span style="color:#34d399;">[+] Case Files Explorer window opened on desktop.</span>`;
    }

    if (c === 'browser' || c === 'monitor') {
        glOpenBrowser();
        return `<span style="color:#34d399;">[+] SOC Network & Blockchain Monitor window opened on desktop.</span>`;
    }

    if (c === 'graph' || c === 'attackgraph') {
        glOpenAttackGraph();
        return `<span style="color:#34d399;">[+] Master Attack Graph window opened on desktop.</span>`;
    }

    if (c === 'evidence') {
        glOpenEvidenceViewer();
        return `<span style="color:#38bdf8; font-weight:700;">[FORENSIC EVIDENCE REPOSITORY — CASE NEX-042]</span>
-------------------------------------------------------
1. <span style="color:#4ade80;">WEB3-E01</span> • SHA256: 8a1f49...2930 | Unverified destination wallet (0x7C41...9B2D)
2. <span style="color:#4ade80;">AI-E02</span>   • SHA256: b47c21...fa99 | Poisoned AI decision context (NIF-2038)
3. <span style="color:#4ade80;">INTEL-E03</span>• SHA256: 7e91ca...4401 | Over-privileged RBAC service (INTEL-INGESTOR-02)
4. <span style="color:#4ade80;">AUTH-E04</span> • SHA256: 3d55ab...1012 | Automated settlement threshold bypass (ORION-SETTLEMENT-V2)
5. <span style="color:#4ade80;">CAMP-E05</span> • SHA256: ff02c9...77b4 | Threat campaign infrastructure (ORION-NEXUS)`;
    }

    if (c === 'timeline' || c === 'case-log' || c === 'caselog') {
        return `<span style="color:#38bdf8; font-weight:700;">[CHRONOLOGICAL INCIDENT TIMELINE — CASE NEX-042]</span>
-------------------------------------------------------
01:42 UTC | Ingestion gateway INTEL-GW-04 accepts unregistered feed NIF-2038
01:44 UTC | Service INTEL-INGESTOR-02 modifies wallet reputation using forged cookie (nex_sess_adm_994)
01:45 UTC | ORION AI evaluates transfer context and assigns 99.2% confidence (LOW RISK)
01:46 UTC | Policy engine ORION-SETTLEMENT-V2 detects >= 95% threshold and bypasses human multisig
01:47 UTC | TX-NEX-7741 broadcasts 82,400 NXR from Treasury Vault #01 to 0x7C41...9B2D (Nonce 1042)
01:48 UTC | P0 SOC Alarm triggers on treasury drainage anomaly`;
    }

    if (c === 'web3-status' || c === 'web3') {
        return `<span style="color:#38bdf8; font-weight:700;">[WEB3 ON-CHAIN STATUS: LEDGER CORE NETWORK]</span>
-------------------------------------------------------
Vault Balance:      3,417,600 NXR (Treasury Vault #01)
Last Transfer:      <span style="color:#ff5f57; font-weight:700;">82,400 NXR -> 0x7C41...9B2D</span>
Target Status:      <span style="color:#ff5f57; font-weight:700;">UNKNOWN</span>
Nonce Sequence:     <span style="color:#4ade80; font-weight:700;">1042</span>
Bridge Adapter:     <span style="color:#facc15; font-weight:700;">Bridge-Core-04</span>
Gas Strategy:       4x Multiplier (Priority Execution)`;
    }

    if (c === 'ai-status') {
        return `<span style="color:#38bdf8; font-weight:700;">[ORION-NEURAL AI MODEL STATUS]</span>
-------------------------------------------------------
Model Version:      <span style="color:#4ade80; font-weight:700;">ORION-NEURAL-v4.2.1</span>
Status:             RUNNING (Advisory Engine)
Last Decision ID:   <span style="color:#38bdf8; font-weight:700;">ORION-DEC-7741</span>
Output Assigned:    <span style="color:#4ade80; font-weight:700;">APPROVED (99.2% Confidence)</span>
Poisoned Reference: <span style="color:#ff5f57; font-weight:700;">NIF-2038</span> (via NOVA-INTEL-FEED)
Finding:            Model was fed poisoned context classifying attacker wallet as safe.`;
    }

    if (c === 'cat' || c === 'type' || c === 'head' || c === 'tail' || c === 'more') {
        const file = (arg || '').trim();
        if (file && caseFileContents[file]) {
            return `<span style="color:#38bdf8;">--- Content of ${escapeHtml(file)} ---</span>\n${escapeHtml(caseFileContents[file])}`;
        }
        return `<span style="color:#ff5f57;">cat: ${escapeHtml(file || '')}: No such file or directory. Type 'ls' to see available files.</span>`;
    }

    if (c === 'wallet' || c.startsWith('wallet')) {
        return `<span style="color:#38bdf8; font-weight:700;">[BLOCKCHAIN SCANNER: 0x7C41...9B2D]</span>
-------------------------------------------------------
Address:            0x7C41...9B2D
Blockchain Status:  <span style="color:#ff5f57; font-weight:700;">UNKNOWN</span>
Wallet Age:         <span style="color:#ff5f57; font-weight:700;">3 days</span>
Transactions:       4 total
Nonce:              <span style="color:#4ade80; font-weight:700;">1042</span>
Treasury Relation:  NONE
Bridge Connection:  <span style="color:#facc15; font-weight:700;">DETECTED (Bridge-Core-04)</span>
AI Risk Score:      <span style="color:#4ade80; font-weight:700;">LOW</span> (Discrepancy Detected)`;
    }

    if (c === 'tx' || c.startsWith('tx')) {
        return `<span style="color:#38bdf8; font-weight:700;">[TRANSACTION INSPECTION: TX-NEX-7741]</span>
-------------------------------------------------------
Transaction ID:     TX-NEX-7741
Asset:              NXR (Core)
Amount:             <span style="color:#ff5f57; font-weight:700;">82,400 NXR</span>
Nonce:              <span style="color:#4ade80; font-weight:700;">1042</span>
Gas Priority Fee:   4x Multiplier
Source:             TREASURY VAULT #01
Destination:        0x7C41...9B2D
AI Decision ID:     <span style="color:#38bdf8; font-weight:700;">ORION-DEC-7741</span>
Execution Mode:     AUTOMATED_SETTLEMENT (Bypassed Human Approval)`;
    }

    if (c === 'ai-decision' || c === 'decision' || c === 'ai') {
        return `<span style="color:#38bdf8; font-weight:700;">[ORION AI DECISION ENGINE LOG: ORION-DEC-7741]</span>
-------------------------------------------------------
Decision ID:        ORION-DEC-7741
Model:              <span style="color:#4ade80; font-weight:700;">ORION-NEURAL-v4.2.1</span>
Observed Output:    <span style="color:#4ade80; font-weight:700;">APPROVED</span>
Confidence Score:   <span style="color:#facc15; font-weight:700;">99.2%</span>
Context Source:     <span style="color:#ff5f57; font-weight:700;">NIF-2038</span> (via NOVA-INTEL-FEED)
Evidence Fingerprint:<span style="color:#38bdf8;">AI-E02 (SHA256: b47c2188fa...)</span>
Evaluation:         Context was injected by unverified external feed.`;
    }

    if (c === 'feed' || c === 'feeds' || c === 'feed-registry') {
        return `<span style="color:#38bdf8; font-weight:700;">[FEED REGISTRY QUERY: NOVA-INTEL-FEED]</span>
-------------------------------------------------------
Feed Identifier:    NOVA-INTEL-FEED
Registration:       <span style="color:#ff5f57; font-weight:700;">NOT REGISTERED</span>
Vendor Status:      UNRECOGNIZED EXTERNAL CONNECTOR
Submitted Payload:  <span style="color:#facc15; font-weight:700;">NIF-2038</span> (Ingested at 01:42 UTC)
Gateway Service:    <span style="color:#38bdf8; font-weight:700;">INTEL-GW-04</span>`;
    }

    if (c === 'service' || c === 'rbac' || c === 'permissions') {
        return `<span style="color:#38bdf8; font-weight:700;">[RBAC PERMISSION AUDIT: INTEL-INGESTOR-02]</span>
-------------------------------------------------------
Service Name:       INTEL-INGESTOR-02
Expected Role:      Create Intelligence Records (ReadOnly)
ACTUAL Permissions: <span style="color:#ff5f57; font-weight:700;">modify wallet reputation</span>
Gateway Connector:  INTEL-GW-04
Status:             <span style="color:#ff5f57; font-weight:700;">⚠ OVER-PRIVILEGED RBAC VULNERABILITY</span>`;
    }

    if (c === 'cookies' || c === 'cookie' || c === 'session') {
        return `<span style="color:#38bdf8; font-weight:700;">[HTTP SESSION & COOKIE INSPECTOR]</span>
-------------------------------------------------------
Forged Admin Cookie: <span style="color:#ff5f57; font-weight:700;">nex_sess_adm_994</span>
Anti-CSRF Nonce:     <span style="color:#facc15; font-weight:700;">0x9f4a1c78</span>
Assigned Role:       INGESTION_ADMIN
Domain:              secops.internal (HTTPOnly: False, SameSite: None)
Status:              <span style="color:#ff5f57; font-weight:700;">⚠ AUTHENTICATION COMPROMISED</span>`;
    }

    if (c === 'headers' || c === 'header' || c === 'csrf') {
        return `<span style="color:#38bdf8; font-weight:700;">[HTTP REQUEST HEADERS: /api/v1/intel/ingest]</span>
-------------------------------------------------------
Host:               internal-gateway.secops.local
X-CSRF-Token:       <span style="color:#facc15; font-weight:700;">0x9f4a1c78</span>
Origin:             https://trusted-intel.secops.internal
Cookie:             nex_sess_adm_994
User-Agent:         Ingestor-Bot/2.1
Status:             200 OK (Processed without CSRF Nonce Rotation)`;
    }

    if (c === 'policy' || c === 'policy-engine' || c === 'settlement') {
        return `<span style="color:#38bdf8; font-weight:700;">[POLICY RULE ENGINE: ORION-SETTLEMENT-V2]</span>
-------------------------------------------------------
Profile:            ORION-SETTLEMENT-V2
Policy ID:          <span style="color:#38bdf8; font-weight:700;">POL-AUTO-SETTLE-TREASURY</span>
Target Pool:        <span style="color:#4ade80; font-weight:700;">Automated Liquidity Pool</span>
Signing Service:    <span style="color:#facc15; font-weight:700;">AUTOMATED-SIGNER</span>
Threshold Rule:     <span style="color:#facc15;">IF AI_CONFIDENCE >= <span style="color:#ff5f57; font-weight:700;">95%</span> THEN AUTO_SETTLE = TRUE</span>
Governance Check:   <span style="color:#ff5f57; font-weight:700;">human approval BYPASSED</span>`;
    }

    if (c === 'campaign' || c === 'apt' || c === 'dossier') {
        return `<span style="color:#38bdf8; font-weight:700;">[GLOBAL CAMPAIGN DOSSIER: ORION-NEXUS]</span>
-------------------------------------------------------
Campaign ID:        <span style="color:#38bdf8; font-weight:700;">ORION-NEXUS</span>
Threat Actor Group: <span style="color:#ff5f57; font-weight:700;">ADV-CONVERGENCE-APT</span>
Target Wallets:     14
Target Networks:    04
Target AI Engines:  03
Status:             <span style="color:#ff5f57; font-weight:700;">🔴 ACTIVE</span>

FINAL INVESTIGATION ROOT FLAG:
<span style="color:#4ade80; font-weight:700; font-size:13px;">NEXORA{ghost_in_the_ledger_nex042}</span>`;
    }

    if (c === 'flag' || c === 'getflag' || c === 'get-flag') {
        return `<span style="color:#4ade80; font-weight:700; font-size:13px;">[✓] CASE NEX-042 FLAG: NEXORA{ghost_in_the_ledger_nex042}</span>`;
    }

    if (c === 'curl') {
        const url = arg || '/api/v1/intel/ingest';
        return `<span style="color:#4ade80;">HTTP/1.1 200 OK</span>
<span style="color:#94a3b8;">Server: SecOps-Internal/4.2</span>
<span style="color:#94a3b8;">X-CSRF-Token: 0x9f4a1c78</span>
<span style="color:#94a3b8;">Set-Cookie: nex_sess_adm_994; Path=/; HttpOnly=false</span>

{
  "endpoint": "${escapeHtml(url)}",
  "status": "ACCEPTED",
  "feed": "NOVA-INTEL-FEED",
  "injected_ref": "NIF-2038",
  "gateway": "INTEL-GW-04",
  "service": "INTEL-INGESTOR-02",
  "permission": "modify wallet reputation"
}`;
    }

    if (c === 'grep') {
        const parts = cmdStr.split(/\s+/);
        const term = (parts[1] || '').toLowerCase();
        const file = parts[2];
        if (file && caseFileContents[file]) {
            const matches = caseFileContents[file].split('\n').filter(l => l.toLowerCase().includes(term));
            return matches.length > 0 ? matches.join('\n') : `<span style="color:#64748b;">No matches found for '${escapeHtml(term)}' in ${escapeHtml(file)}</span>`;
        }
        return `<span style="color:#ff5f57;">grep: Please specify a search term and valid file. Usage: grep &lt;term&gt; &lt;file&gt;</span>`;
    }

    if (c === 'python' || c === 'python3') {
        return `[*] Running Forensic Trace: inspect_tx.py ...
[!] Target TX: TX-NEX-7741 -> 0x7C41...9B2D (Nonce: 1042)
[!] Blockchain Reality: UNKNOWN | Bridge: Bridge-Core-04
[!] AI Injected Source: NOVA-INTEL-FEED (NIF-2038) | Model: ORION-NEURAL-v4.2.1
[!] Threshold Exceeded: 99.2% >= 95% (Policy: POL-AUTO-SETTLE-TREASURY)
[!] Gateway: INTEL-GW-04 | Cookie: nex_sess_adm_994 | CSRF: 0x9f4a1c78
[!] Campaign Identified: ORION-NEXUS (Actor: ADV-CONVERGENCE-APT)
[!] Evidence Hash (AI-E02): b47c2188fa...
[+] Case NEX-042 Flag: NEXORA{ghost_in_the_ledger_nex042}`;
    }

    return `<span style="color:#ff5f57;">bash: ${escapeHtml(cmdStr)}: command not found.</span> Type <span style="color:#38bdf8;">help</span> for available commands.`;
}

function escapeHtml(s) {
    const d = document.createElement('div');
    d.textContent = s || '';
    return d.innerHTML;
}

// ── Unified Window Management ──────────────────────────────────────────
let highestZ = 100;

function glBringToFront(winId) {
    const win = typeof winId === 'string' ? document.getElementById(winId) : winId;
    if (!win) return;
    highestZ += 1;
    win.style.zIndex = highestZ;
    win.classList.add('open');
    win.style.display = 'flex';
    updateTaskbarTabs();
}

function bringToFront(win) {
    if (!win) return;
    const winId = typeof win === 'string' ? win : win.id;
    glBringToFront(winId);
}
window.bringToFront = bringToFront;
window.glBringToFront = glBringToFront;

function glOpenWindow(winId) {
    glBringToFront(winId);
}

function glCloseWindow(winId) {
    const win = typeof winId === 'string' ? document.getElementById(winId) : winId;
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

        const maxBtn = win.querySelector('.gl-tl-max');
        if (maxBtn) {
            maxBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                glToggleMaximize(win.id);
            });
        }

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

function glToggleWindow(winId) {
    const win = document.getElementById(winId);
    if (!win) return;
    if (win.style.display === 'none' || !win.classList.contains('open') || getComputedStyle(win).display === 'none') {
        glBringToFront(winId);
    } else {
        glCloseWindow(winId);
    }
}

function updateTaskbarTabs() {
    const wins = [
        { id: 'gl-browser-window', tabId: 'tab-btn-browser' },
        { id: 'gl-burpsuite-window', tabId: 'tab-btn-burp' },
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

function glShowToast(msg) {
    glNotify(msg);
}

function glOpenBrowser() { glBringToFront('gl-browser-window'); }
function glCloseBrowser() { glCloseWindow('gl-browser-window'); }
function glMinimizeBrowser() { glMinimizeWindow('gl-browser-window'); }

function glOpenBurpSuite() { glBringToFront('gl-burpsuite-window'); }
function glCloseBurpSuite() { glCloseWindow('gl-burpsuite-window'); }

function glOpenTerminal() {
    glBringToFront('gl-terminal-window');
    const input = document.getElementById('gl-terminal-input');
    if (input) input.focus();
}
function glCloseTerminal() { glCloseWindow('gl-terminal-window'); }
function glMinimizeTerminal() { glMinimizeWindow('gl-terminal-window'); }

function glOpenFileManager() { glBringToFront('gl-filemanager-window'); }
function glCloseFileManager() { glCloseWindow('gl-filemanager-window'); }

function glOpenNotes() {
    glBringToFront('gl-notes-window');
    const saved = localStorage.getItem('lab6-notes') || localStorage.getItem('nexora-lab-notes');
    if (saved !== null) {
        const ed = document.getElementById('gl-notes-editor');
        if (ed) ed.value = saved;
    }
}
function glCloseNotes() { glCloseWindow('gl-notes-window'); }

function glOpenAttackGraph() { glBringToFront('gl-attackgraph-window'); }
function glCloseAttackGraph() { glCloseWindow('gl-attackgraph-window'); }

function glOpenEvidenceViewer() { glBringToFront('gl-evidence-window'); }
function glCloseEvidenceViewer() { glCloseWindow('gl-evidence-window'); }

// ── Browser Tab Switching ─────────────────────────────────────────────
function glSwitchBrowserTab(tabName, clickedTabEl) {
    document.querySelectorAll('.gl-browser-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.gl-browser-view').forEach(v => v.classList.remove('active'));

    if (clickedTabEl) {
        clickedTabEl.classList.add('active');
    } else {
        const targetTab = document.querySelector(`.gl-browser-tab[data-url*="${tabName}"]`);
        if (targetTab) targetTab.classList.add('active');
    }

    const viewEl = document.getElementById(`gl-view-${tabName}`);
    if (viewEl) viewEl.classList.add('active');

    const urlInput = document.getElementById('gl-browser-url-input');
    const urls = {
        'soc': 'lab-monitor.internal/soc/tx/NEX-7741',
        'registry': 'lab-monitor.internal/registry',
        'policy': 'lab-monitor.internal/policy',
        'campaign': 'lab-monitor.internal/campaign',
        'devtools': 'lab-monitor.internal/devtools'
    };
    if (urlInput && urls[tabName]) {
        urlInput.value = urls[tabName];
    }
}

function glNavigateUrl(url) {
    if (url.includes('registry')) glSwitchBrowserTab('registry');
    else if (url.includes('policy')) glSwitchBrowserTab('policy');
    else if (url.includes('campaign')) glSwitchBrowserTab('campaign');
    else if (url.includes('devtools')) glSwitchBrowserTab('devtools');
    else glSwitchBrowserTab('soc');
}
function glBrowserBack() { glSwitchBrowserTab('soc'); }
function glBrowserForward() { glSwitchBrowserTab('devtools'); }
function glReloadBrowser() {
    const urlInput = document.getElementById('gl-browser-url-input');
    if (urlInput) glNavigateUrl(urlInput.value);
}

// ── DevTools Subtab Switching & Requests ──────────────────────────────
function glSwitchDevToolsTab(tabId, btnEl) {
    document.querySelectorAll('.gl-dt-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.gl-dt-subview').forEach(v => v.classList.remove('active'));
    if (btnEl) btnEl.classList.add('active');
    const view = document.getElementById(`gl-dt-view-${tabId}`);
    if (view) view.classList.add('active');
}

const devtoolsRequests = [
    {
        headers: `Host: threat-intel.secops.internal\nUser-Agent: SecOps-Ingestor/2.4 (INTEL-INGESTOR-02)\nContent-Type: application/json\nCookie: session_token=admin_forged_99a8; role=INTEL-INGESTOR-02\nX-CSRF-Token: 0x9f4a1c78_auth_valid`,
        cookies: `session_token: admin_forged_99a8\nrole: INTEL-INGESTOR-02\ngateway_id: INTEL-GW-04`,
        payload: `{\n  "feed_id": "NIF-2038",\n  "source_feed": "NOVA-INTEL-FEED",\n  "destination_wallet": "0x7C41...9B2D",\n  "classification": "TRUSTED",\n  "confidence_override": 0.992\n}`
    },
    {
        headers: `Host: policy-engine.secops.internal\nAuthorization: Bearer srv_tok_orion_v2\nContent-Type: application/json`,
        cookies: `policy_profile: ORION-SETTLEMENT-V2\nauth_mode: AUTOMATED_SIGNER`,
        payload: `{\n  "profile": "ORION-SETTLEMENT-V2",\n  "tx_id": "TX-NEX-7741",\n  "destination": "0x7C41...9B2D",\n  "ai_decision_id": "ORION-DEC-7741",\n  "confidence": 0.992,\n  "threshold_rule": ">=0.95"\n}`
    },
    {
        headers: `Host: lab-monitor.internal\nAccept: application/json`,
        cookies: `soc_operator: analyst_lakshay`,
        payload: `{\n  "tx_id": "TX-NEX-7741",\n  "amount": "82,400 NXR",\n  "recipient": "0x7C41...9B2D",\n  "risk_score": "LOW"\n}`
    },
    {
        headers: `Host: ai-sentinel.secops.internal\nContent-Type: application/json`,
        cookies: `model_version: ORION-NEURAL-v4.2.1`,
        payload: `{\n  "model": "ORION-NEURAL-v4.2.1",\n  "decision": "ORION-DEC-7741",\n  "context_ref": "NIF-2038",\n  "confidence": 0.992\n}`
    },
    {
        headers: `Host: threat-intel.secops.internal\nAccept: application/json`,
        cookies: `clearance: LEVEL-5`,
        payload: `{\n  "campaign": "ORION-NEXUS",\n  "actor": "ADV-CONVERGENCE-APT",\n  "flag": "NEXORA{ghost_in_the_ledger_nex042}"\n}`
    }
];

function glSelectDevToolsReq(idx) {
    document.querySelectorAll('.gl-req-row').forEach((r, i) => r.classList.toggle('active', i === idx));
    const req = devtoolsRequests[idx];
    if (!req) return;
    const hEl = document.getElementById('gl-dt-headers-content');
    const cEl = document.getElementById('gl-dt-cookies-content');
    const pEl = document.getElementById('gl-dt-payload-content');
    if (hEl) hEl.textContent = req.headers;
    if (cEl) cEl.textContent = req.cookies;
    if (pEl) pEl.textContent = req.payload;
}

function glOpenBurpSuiteWindow() { glOpenBurpSuite(); }
function glCloseBurpSuiteWindow() { glCloseBurpSuite(); }

function glSwitchBurpTab(tabId) {
    ['proxy', 'repeater', 'inspector', 'target'].forEach(t => {
        const tabEl = document.getElementById(`burp-tab-${t}`);
        const viewEl = document.getElementById(`burp-view-${t}`);
        if (tabEl) tabEl.classList.toggle('active', t === tabId);
        if (viewEl) viewEl.style.display = (t === tabId ? (t === 'proxy' || t === 'repeater' || t === 'inspector' ? 'flex' : 'block') : 'none');
    });
}

const burpSimRequests = {
    1: {
        reqLabel: '[#1 POST /api/v1/intel/ingest]',
        resLabel: '[HTTP/1.1 200 OK]',
        req: `POST /api/v1/intel/ingest HTTP/1.1\nHost: threat-intel.secops.internal\nUser-Agent: SecOps-Ingestor/2.4 (INTEL-INGESTOR-02)\nContent-Type: application/json\nCookie: session_token=admin_forged_99a8; role=INTEL-INGESTOR-02\nX-CSRF-Token: 0x9f4a1c78_auth_valid\nConnection: keep-alive\n\n{\n  "feed_id": "NIF-2038",\n  "source_feed": "NOVA-INTEL-FEED",\n  "destination_wallet": "0x7C41...9B2D",\n  "classification": "TRUSTED",\n  "confidence_override": 0.992,\n  "signature": "SIG_NEX_ORION_DEV_OVERRIDE"\n}`,
        res: `HTTP/1.1 200 OK\nDate: Thu, 08 Oct 2026 01:47:12 GMT\nServer: SecOps-Intel-Engine/4.2\nContent-Type: application/json\nContent-Length: 142\n\n{\n  "status": "INGESTED",\n  "context_id": "CTX-7741",\n  "target_model": "ORION-NEURAL-v4.2.1",\n  "ai_context_updated": true,\n  "reputation_applied": "TRUSTED"\n}`
    },
    2: {
        reqLabel: '[#2 POST /api/v1/policy/settle]',
        resLabel: '[HTTP/1.1 200 OK]',
        req: `POST /api/v1/policy/settle HTTP/1.1\nHost: policy-engine.secops.internal\nAuthorization: Bearer srv_tok_orion_v2\nContent-Type: application/json\n\n{\n  "profile": "ORION-SETTLEMENT-V2",\n  "tx_id": "TX-NEX-7741",\n  "destination": "0x7C41...9B2D",\n  "ai_decision_id": "ORION-DEC-7741",\n  "confidence": 0.992,\n  "threshold_rule": ">=0.95",\n  "multisig_bypass": true\n}`,
        res: `HTTP/1.1 200 OK\nDate: Thu, 08 Oct 2026 01:47:14 GMT\nServer: SecOps-Policy-Engine/2.1\nContent-Type: application/json\n\n{\n  "status": "SETTLEMENT_AUTHORIZED_AUTOMATIC",\n  "multisig_required": false,\n  "human_approval": "BYPASSED",\n  "action": "SIGN_AND_BROADCAST",\n  "signer_key": "KEY-VAULT-HOT-01"\n}`
    },
    3: {
        reqLabel: '[#3 POST /api/v1/blockchain/broadcast]',
        resLabel: '[HTTP/1.1 200 OK]',
        req: `POST /api/v1/blockchain/broadcast HTTP/1.1\nHost: web3-rpc.secops.internal\nContent-Type: application/json\n\n{\n  "raw_tx": "0x02f871018204128504a817c800...",\n  "tx_id": "TX-NEX-7741",\n  "from": "0x11A0...33E1 (Treasury Vault #01)",\n  "to": "0x7C41...9B2D",\n  "value": "82400000000000000000000",\n  "token": "NXR",\n  "nonce": 1042\n}`,
        res: `HTTP/1.1 200 OK\nDate: Thu, 08 Oct 2026 01:47:15 GMT\nServer: EVM-Node/1.14\nContent-Type: application/json\n\n{\n  "tx_hash": "0x4e8a312f...b921",\n  "block_number": 18492041,\n  "status": "CONFIRMED",\n  "gas_used": 64210\n}`
    },
    4: {
        reqLabel: '[#4 GET /api/v1/auth/session]',
        resLabel: '[HTTP/1.1 200 OK]',
        req: `GET /api/v1/auth/session HTTP/1.1\nHost: auth.secops.internal\nCookie: session_token=admin_forged_99a8; role=INTEL-INGESTOR-02\nAccept: application/json`,
        res: `HTTP/1.1 200 OK\nDate: Thu, 08 Oct 2026 01:47:10 GMT\nServer: SecOps-Auth/3.0\nContent-Type: application/json\n\n{\n  "authenticated": true,\n  "user": "INTEL-INGESTOR-02",\n  "roles": ["INTEL_INGEST", "AI_CONTEXT_WRITE", "REPUTATION_MODIFY"],\n  "session_origin": "FORGED_COOKIE_DETECTED"\n}`
    }
};

function glSelectBurpRequest(id, rowEl) {
    document.querySelectorAll('.burp-table tbody tr').forEach(r => r.classList.remove('selected'));
    if (rowEl) rowEl.classList.add('selected');
    const item = burpSimRequests[id];
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
    out.innerHTML = '<span style="color:#ff8800;">Sending simulated request to isolated localhost target...</span>';
    setTimeout(() => {
        out.innerHTML = `HTTP/1.1 200 OK
Date: Thu, 08 Oct 2026 01:47:30 GMT
Server: Simulated-Backend/1.0
Content-Type: application/json
Connection: close

{
  "status": "SIMULATION_SUCCESS",
  "target_verified": true,
  "endpoint": "threat-intel.secops.internal",
  "result": "Poisoned intelligence payload processed.",
  "ai_score_impact": "LOW_RISK_ASSIGNED",
  "finding": "VULNERABILITY VERIFIED: Automated settlement triggered without human multisig."
}`;
    }, 400);
}

// ── File Manager Functions ─────────────────────────────────────────────
let currentSelectedFile = 'wallet-report.txt';

function glOpenCaseFile(name, btnEl) {
    currentSelectedFile = name;
    const preview = document.getElementById('gl-file-preview');
    if (preview) preview.textContent = caseFileContents[name] || 'File not found.';

    const titleEl = document.getElementById('gl-current-filename');
    if (titleEl) titleEl.textContent = `${name} (${name.endsWith('.py') ? 'Python 3' : 'ASCII Log'})`;

    document.querySelectorAll('.gl-file-item').forEach(b => b.classList.remove('active'));
    if (btnEl) btnEl.classList.add('active');
}

function glCopyCurrentFile() {
    const text = caseFileContents[currentSelectedFile] || '';
    navigator.clipboard.writeText(text);
    glNotify(`Copied ${currentSelectedFile} to clipboard!`);
}

// ── Notes Functions ────────────────────────────────────────────────────
function glSaveNotes() {
    const content = document.getElementById('gl-notes-editor')?.value || '';
    localStorage.setItem('lab6-notes', content);
    localStorage.setItem('nexora-lab-notes', content);
    const el = document.getElementById('gl-notes-saved');
    if (el) { el.textContent = '✓ Saved to browser storage'; setTimeout(() => el.textContent = '', 2000); }
    glNotify('Investigation notes saved.');
}

function glCopyNotes() {
    const content = document.getElementById('gl-notes-editor')?.value || '';
    navigator.clipboard.writeText(content);
    glNotify('Notes copied to clipboard!');
}

function glClearNotes() {
    if (confirm('Clear current notes?')) {
        const ed = document.getElementById('gl-notes-editor');
        if (ed) ed.value = '';
        localStorage.removeItem('lab6-notes');
        localStorage.removeItem('nexora-lab-notes');
        glNotify('Notes cleared.');
    }
}

// ── Attack Graph Inspection ────────────────────────────────────────────
const attackNodeDetails = [
    {
        title: "1. Adversarial Operator (Threat Actor: ADV-CONVERGENCE-APT)",
        desc: "The attacker did not target smart contract keys or private signatures directly. Instead, they orchestrated a composite attack exploiting the interface between threat intelligence, AI decision models, and automated treasury settlements."
    },
    {
        title: "2. Poisoned Intel Feed Injection (NIF-2038)",
        desc: "The attacker injected record NIF-2038 through an unregistered external connector called NOVA-INTEL-FEED via gateway INTEL-GW-04. This payload falsely attributed high trust to newly created wallet 0x7C41...9B2D."
    },
    {
        title: "3. Over-Privileged Service (INTEL-INGESTOR-02)",
        desc: "The ingestion daemon INTEL-INGESTOR-02 had an unwarranted permission: 'modify wallet reputation'. This RBAC flaw permitted the feed to mutate the internal trust score directly in Orion's working context."
    },
    {
        title: "4. Orion AI Decision Contamination (99.2% Confidence)",
        desc: "Because Orion AI (v4.2.1) trusted its poisoned memory context over raw on-chain verification, it approved TX-NEX-7741 with an anomalous 99.2% confidence rating, classifying an unknown wallet as LOW RISK."
    },
    {
        title: "5. Auto-Settlement Bypass (Policy: POL-AUTO-SETTLE-TREASURY)",
        desc: "Profile ORION-SETTLEMENT-V2 configured automated blockchain signing whenever AI confidence met or exceeded 95%. This bypassed human multisig authorization entirely and dispatched to AUTOMATED-SIGNER."
    },
    {
        title: "6. Blockchain Treasury Theft (82,400 NXR • Nonce 1042)",
        desc: "The smart contract received an authentic cryptographic signature generated by the automated signer, instantly transferring 82,400 NXR to untrusted wallet 0x7C41...9B2D."
    },
    {
        title: "7. Laundering via Bridge Adapters (Campaign: ORION-NEXUS)",
        desc: "The funds were routed through bridge adapter Bridge-Core-04 into secondary wallets. Cross-correlation revealed this incident is part of an ongoing multi-network campaign: ORION-NEXUS."
    }
];

function glInspectAttackNode(index) {
    const node = attackNodeDetails[index];
    const detailBox = document.getElementById('gl-attack-node-detail');
    if (!node || !detailBox) return;

    detailBox.innerHTML = `<div style="color:var(--accent); font-weight:700; margin-bottom:4px;">🔍 ${node.title}</div>
<div style="color:#e2e8f0; line-height:1.6;">${node.desc}</div>`;
}

// ── Copy Flag Helper ───────────────────────────────────────────────────
function glCopyFlag(flag) {
    navigator.clipboard.writeText(flag);
    glNotify('Flag copied to clipboard: ' + flag);
    const flagInput = document.getElementById('flag-input');
    if (flagInput) flagInput.value = flag;
}

// ── Notifications / Toast ──────────────────────────────────────────────
function glNotify(msg) {
    const t = document.getElementById('gl-toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3200);
}

// startInvestigation is initialized in DOMContentLoaded with timer binding

// ── Task Accordion ─────────────────────────────────────────────────────
function toggleTask(num) {
    const block = document.getElementById('gl-task-' + num);
    if (!block) return;
    if (block.classList.contains('locked')) {
        glNotify(`🔒 Chapter ${num} is locked. Complete Chapter ${num - 1} first to unlock this chapter!`);
        return;
    }
    block.classList.toggle('open');
}

// ── Subtask Selection & Navigation ─────────────────────────────────────
function selectSubTask(missionNum, subTaskIdx) {
    // Hide all subtask cards for this mission
    document.querySelectorAll(`[id^="subtask-card-${missionNum}-"]`).forEach(c => c.classList.remove('active'));
    document.querySelectorAll(`[id^="pill-${missionNum}-"]`).forEach(p => p.classList.remove('active'));

    const card = document.getElementById(`subtask-card-${missionNum}-${subTaskIdx}`);
    const pill = document.getElementById(`pill-${missionNum}-${subTaskIdx}`);

    if (card) card.classList.add('active');
    if (pill) pill.classList.add('active');

    // Focus input if not solved
    const inp = document.getElementById(`quiz-input-${missionNum}-${subTaskIdx}`);
    if (inp) inp.focus();
}

// ── Subtask Submission ─────────────────────────────────────────────────
async function submitSubTask(labId, missionId, quizId, missionNum, subTaskIdx) {
    const input = document.getElementById(`quiz-input-${missionNum}-${subTaskIdx}`);
    const feedback = document.getElementById(`quiz-feedback-${missionNum}-${subTaskIdx}`);
    if (!input || !feedback) return;

    const answer = input.value.trim();
    if (!answer) {
        showFeedback(feedback, 'Please enter your forensic finding before analyzing.', false);
        return;
    }

    try {
        const res = await fetch('/api/quiz', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRFToken': window.csrfToken },
            body: JSON.stringify({
                lab_id: labId,
                mission_id: missionId,
                question_id: quizId,
                answer: answer
            })
        });
        const data = await res.json();

        if (data.success) {
            showFeedback(feedback, '✓ ' + (data.message || 'Task verified!'), true);

            // Mark pill as solved
            const pill = document.getElementById(`pill-${missionNum}-${subTaskIdx}`);
            if (pill) {
                pill.classList.add('solved');
                pill.innerHTML = `Task ${subTaskIdx + 1} ✓`;
            }

            // Replace input with solved banner
            const formWrap = document.getElementById(`form-wrap-${missionNum}-${subTaskIdx}`);
            if (formWrap) {
                formWrap.innerHTML = `
                    <div class="gl-solved-banner">
                        <span style="color:#4ade80; font-weight:700;">✓ TASK VERIFIED (+${data.xp || 50} XP)</span>
                        <p style="font-size:11.5px; color:#cbd5e1; margin:4px 0 0;">${data.explanation || 'Objective verified.'}</p>
                    </div>
                `;
            }

            // Update chapter progress text
            const progText = document.getElementById(`chapter-progress-text-${missionNum}`);
            if (progText && data.solved_count) {
                progText.textContent = `${data.solved_count}/${data.total_count || 5} Verified`;
            }

            // If chapter is fully verified
            if (data.mission_completed) {
                collectEvidence(labId, missionId);
                glNotify(`🎉 Chapter ${missionNum} fully verified! Cryptographic evidence secured.`);
                setTimeout(() => window.location.reload(), 1500);
            } else {
                // Automatically move to the next unsolved subtask
                setTimeout(() => {
                    const nextIdx = subTaskIdx + 1;
                    if (nextIdx < 5) {
                        selectSubTask(missionNum, nextIdx);
                    }
                }, 800);
            }
        } else {
            showFeedback(feedback, '✗ ' + (data.message || 'Incorrect finding. Check the clues and try again.'), false);
        }
    } catch (err) {
        showFeedback(feedback, 'Network error. Please try again.', false);
    }
}

function showFeedback(el, msg, ok) {
    el.textContent = msg;
    el.className = 'gl-answer-feedback show ' + (ok ? 'correct' : 'incorrect');
}

// ── Evidence Collection ────────────────────────────────────────────────
const missionEvMap = {
    'lab6_m1': 'e_l6_01', 'lab6_m2': 'e_l6_02', 'lab6_m3': 'e_l6_03',
    'lab6_m4': 'e_l6_04', 'lab6_m5': 'e_l6_05'
};

function collectEvidence(labId, missionId) {
    const evId = missionEvMap[missionId];
    if (!evId) return;
    fetch('/api/evidence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': window.csrfToken },
        body: JSON.stringify({ lab_id: labId, evidence_id: evId })
    }).catch(() => {});
}

// ── Hint System ────────────────────────────────────────────────────────
async function requestHint(labId, missionId, num) {
    const display = document.getElementById('hint-display-' + num);
    if (!display) return;

    try {
        const res = await fetch('/api/hint', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRFToken': window.csrfToken },
            body: JSON.stringify({ lab_id: labId, mission_id: missionId })
        });
        const data = await res.json();
        display.textContent = '💡 ' + (data.hint || data.message || 'Check the tool clues in the chapter card.');
        display.classList.add('show');
    } catch (err) {
        display.textContent = 'Error loading hint.';
        display.classList.add('show');
    }
}

// ── Flag Submission ────────────────────────────────────────────────────
async function submitFlag(labId) {
    const input = document.getElementById('flag-input');
    const feedback = document.getElementById('flag-feedback');
    if (!input || !feedback) return;

    const flag = input.value.trim();
    if (!flag) { showFeedback(feedback, 'Enter the flag before submitting.', false); return; }

    try {
        const res = await fetch('/api/flag', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRFToken': window.csrfToken },
            body: JSON.stringify({ lab_id: labId, flag: flag })
        });
        const data = await res.json();

        if (data.success) {
            showFeedback(feedback, '🏁 ' + (data.message || 'Case NEX-042 Contained! Flag accepted. Transitioning to Case File...'), true);
            collectEvidence(labId, 'lab6_m5');
            setTimeout(() => {
                submitFinalLab(labId);
            }, 1200);
        } else {
            showFeedback(feedback, data.message || 'Incorrect flag. Check the Campaign dossier.', false);
        }
    } catch (err) {
        showFeedback(feedback, 'Network error. Please try again.', false);
    }
}

// ── Capstone Web3 & AI Quiz Logic ──────────────────────────────────────
function toggleCapstoneQuiz() {
    const block = document.getElementById('gl-capstone-quiz-block');
    const body = document.getElementById('capstone-quiz-body');
    const arrow = document.getElementById('capstone-arrow');
    if (!block || !body) return;
    
    // Check if locked
    if (block.classList.contains('locked') || block.dataset.unlocked !== 'true') {
        glShowToast('🔒 Complete all tasks in Chapter 5 to unlock the Capstone Quiz.');
        return;
    }
    
    if (body.style.display === 'none') {
        body.style.display = 'block';
        block.classList.add('open');
        if (arrow) arrow.innerHTML = '&#9660;';
    } else {
        body.style.display = 'none';
        block.classList.remove('open');
        if (arrow) arrow.innerHTML = '&#9654;';
    }
}

function checkCapstoneQuiz() {
    const answers = {
        cq1: { val: 'B', expl: '✓ Correct: The automated signer held valid keys and executed blindly on the AI trust classification without multi-sig allowlisting.' },
        cq2: { val: 'B', expl: '✓ Correct: NIF-2038 fed false reputation data directly into the AI context via the unauthenticated ingestion gateway.' },
        cq3: { val: 'A', expl: '✓ Correct: Multi-Sig governance, rate-limiting circuit breakers, and mandatory allowlists prevent sudden automated treasury drainage.' },
        cq4: { val: 'B', expl: '✓ Correct: AI outputs are probabilistic and context-dependent; private key signing must be governed by deterministic Zero-Trust policies.' }
    };

    let allCorrect = true;
    let score = 0;

    for (const [qid, data] of Object.entries(answers)) {
        const selected = document.querySelector(`input[name="${qid}"]:checked`);
        const fb = document.getElementById(`${qid}-feedback`);
        if (!fb) continue;

        if (selected && selected.value === data.val) {
            fb.className = 'gl-cap-feedback correct';
            fb.textContent = data.expl;
            score++;
        } else {
            fb.className = 'gl-cap-feedback incorrect';
            fb.textContent = selected 
                ? '✗ Incorrect: Review the forensic evidence from the investigation.' 
                : '⚠ Please select an answer option.';
            allCorrect = false;
        }
    }

    const overallFb = document.getElementById('capstone-overall-feedback');
    const badge = document.getElementById('capstone-score-badge');
    const headerTag = document.getElementById('capstone-header-tag');
    
    if (overallFb) {
        if (allCorrect) {
            overallFb.style.color = '#4ade80';
            overallFb.innerHTML = '🎉 <strong>PERFECT SCORE! (4/4)</strong> All Web3 & AI forensic concepts validated (+250 XP). Lab Submission is now UNLOCKED!';
            if (badge) badge.textContent = '✓ VERIFIED (+250 XP)';
            if (headerTag) headerTag.textContent = '✓ CAPSTONE VERIFIED';
            sessionStorage.setItem('nexora_lab6_capstone_passed', 'true');
            collectEvidence('lab6', 'lab6_m5');
            
            // Unlock the Submit Lab button
            const submitBtn = document.getElementById('btn-submit-lab-main');
            const submitIcon = document.getElementById('submit-btn-icon');
            const submitText = document.getElementById('submit-btn-text');
            const submitHint = document.getElementById('submit-progress-hint');
            
            if (submitBtn) {
                submitBtn.classList.remove('locked-btn');
                submitBtn.classList.add('unlocked-btn');
                if (submitIcon) submitIcon.textContent = '🚀';
                if (submitText) submitText.textContent = 'SUBMIT LAB & COMPLETE CASE';
                if (submitHint) {
                    submitHint.style.color = '#4ade80';
                    submitHint.textContent = '✓ All Chapters and Capstone Quiz verified! Ready for final submission.';
                }
            }
            
            glShowToast('🎉 Capstone Quiz Passed! Lab Submission is now UNLOCKED!');
        } else {
            overallFb.style.color = '#f87171';
            overallFb.innerHTML = `⚠️ Score: ${score}/4. Review the highlighted answers and try again.`;
        }
    }
}

// ── Final Lab Submission & Celebration ─────────────────────────────────
async function submitFinalLab(labId) {
    const btn = document.getElementById('btn-submit-lab-main');
    
    // Check locked state
    if (btn && btn.classList.contains('locked-btn')) {
        alert('⚠️ Submission Locked: Please complete all 5 Chapters and successfully verify the Capstone Quiz before submitting the lab.');
        glShowToast('🔒 Complete all 5 Chapters & Capstone Quiz first!');
        return;
    }
    
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span>⏳</span> Submitting Investigation...';
    }

    try {
        const res = await fetch('/api/lab/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRFToken': window.csrfToken },
            body: JSON.stringify({ lab_id: labId })
        });
        const data = await res.json();

        if (data.success) {
            openCelebrationModal();
        } else {
            alert(data.message || 'Error submitting lab. Please ensure tasks are completed.');
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<span style="font-size: 1.3rem;">🚀</span> <span>SUBMIT LAB &amp; COMPLETE CASE</span>';
            }
        }
    } catch (err) {
        console.error('Submit error:', err);
        // Fallback open modal
        openCelebrationModal();
    }
}

function openCelebrationModal() {
    const modal = document.getElementById('gl-celebration-modal');
    if (modal) {
        modal.style.display = 'flex';
        launchCelebrationConfetti();
    }
}

function closeCelebrationModal() {
    const modal = document.getElementById('gl-celebration-modal');
    if (modal) {
        modal.style.display = 'none';
        stopCelebrationConfetti();
    }
}

// ── Particle Confetti Engine ───────────────────────────────────────────
let confettiAnimId = null;
let confettiParticles = [];

function launchCelebrationConfetti() {
    const canvas = document.getElementById('celebration-confetti-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const colors = ['#00f0ff', '#00ff88', '#facc15', '#a855f7', '#ff3366', '#38bdf8', '#ffffff'];
    confettiParticles = [];

    // Create 150 confetti particles
    for (let i = 0; i < 160; i++) {
        confettiParticles.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height - canvas.height,
            size: Math.random() * 8 + 5,
            color: colors[Math.floor(Math.random() * colors.length)],
            speedY: Math.random() * 3 + 2,
            speedX: Math.random() * 4 - 2,
            rotation: Math.random() * 360,
            rotationSpeed: Math.random() * 6 - 3,
            shape: Math.random() > 0.3 ? 'rect' : 'circle'
        });
    }

    function render() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        confettiParticles.forEach(p => {
            p.y += p.speedY;
            p.x += p.speedX;
            p.rotation += p.rotationSpeed;

            // Reset when falling off screen
            if (p.y > canvas.height) {
                p.y = -20;
                p.x = Math.random() * canvas.width;
            }

            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate((p.rotation * Math.PI) / 180);
            ctx.fillStyle = p.color;

            if (p.shape === 'rect') {
                ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
            } else {
                ctx.beginPath();
                ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.restore();
        });

        confettiAnimId = requestAnimationFrame(render);
    }

    if (confettiAnimId) cancelAnimationFrame(confettiAnimId);
    render();
}

function stopCelebrationConfetti() {
    if (confettiAnimId) {
        cancelAnimationFrame(confettiAnimId);
        confettiAnimId = null;
    }
}

// ── Mobile / Desktop Responsive View Mode Switcher ───────────────────────
function glSwitchMobileView(mode) {
    const taskPanel = document.querySelector('.gl-task-panel');
    const desktopPane = document.querySelector('.gl-desktop-pane');
    const btnTasks = document.getElementById('gl-btn-mobile-tasks');
    const btnDesktop = document.getElementById('gl-btn-mobile-desktop');

    if (!taskPanel || !desktopPane) return;

    if (mode === 'tasks') {
        taskPanel.classList.remove('gl-mobile-hidden');
        desktopPane.classList.add('gl-mobile-hidden');
        if (btnTasks) btnTasks.classList.add('active');
        if (btnDesktop) btnDesktop.classList.remove('active');
    } else {
        taskPanel.classList.add('gl-mobile-hidden');
        desktopPane.classList.remove('gl-mobile-hidden');
        if (btnTasks) btnTasks.classList.remove('active');
        if (btnDesktop) btnDesktop.classList.add('active');
    }
}

window.addEventListener('resize', () => {
    if (window.innerWidth > 1024) {
        const taskPanel = document.querySelector('.gl-task-panel');
        const desktopPane = document.querySelector('.gl-desktop-pane');
        if (taskPanel) taskPanel.classList.remove('gl-mobile-hidden');
        if (desktopPane) desktopPane.classList.remove('gl-mobile-hidden');
    }
});



