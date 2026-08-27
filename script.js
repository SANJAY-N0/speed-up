/* ----------------------------------------------------
   TAB NAVIGATION CONTROLLER
---------------------------------------------------- */
function switchTab(mode) {
  document.querySelectorAll('.tab-view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));

  if (mode === 'mcq') {
    document.getElementById('view-mcq').classList.add('active');
    document.getElementById('tab-mcq-btn').classList.add('active');
  } else {
    document.getElementById('view-code').classList.add('active');
    document.getElementById('tab-code-btn').classList.add('active');
  }
}

/* ----------------------------------------------------
   NOTEPAD (LOCAL STORAGE)
---------------------------------------------------- */
function saveNotepad() {
  const text = document.getElementById('mcq-notes-input').value;
  localStorage.setItem('speedup_mcq_notes', text);
}

function loadNotepad() {
  const saved = localStorage.getItem('speedup_mcq_notes');
  if (saved !== null) {
    document.getElementById('mcq-notes-input').value = saved;
  }
}

function clearNotepad() {
  if (confirm("Clear notes?")) {
    document.getElementById('mcq-notes-input').value = '';
    localStorage.removeItem('speedup_mcq_notes');
  }
}

async function copyNotepadContent() {
  const text = document.getElementById('mcq-notes-input').value;
  if (!text.trim()) return;
  await safeCopyToClipboard(text);
  alert("Notes copied to clipboard!");
}

/* ----------------------------------------------------
   INDEXEDDB STORAGE LOGIC
---------------------------------------------------- */
const DB_NAME = "SpeedUp_QuizDB";
const DB_VERSION = 1;
const STORE_NAME = "questions";
let db;

function initDB() {
  const req = indexedDB.open(DB_NAME, DB_VERSION);
  req.onupgradeneeded = (e) => {
    const dbInstance = e.target.result;
    if (!dbInstance.objectStoreNames.contains(STORE_NAME)) {
      dbInstance.createObjectStore(STORE_NAME, { keyPath: "questionNumber" });
    }
  };
  req.onsuccess = (e) => {
    db = e.target.result;
    loadStoredQuestions();
  };
}

/* ----------------------------------------------------
   SAFE CLIPBOARD ENGINE
---------------------------------------------------- */
async function safeCopyToClipboard(text) {
  if (!text) return false;
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {}
  }

  try {
    const tempArea = document.createElement("textarea");
    tempArea.value = text;
    tempArea.style.position = "fixed";
    tempArea.style.top = "-9999px";
    tempArea.style.left = "-9999px";
    tempArea.setAttribute("readonly", "");
    document.body.appendChild(tempArea);
    tempArea.focus();
    tempArea.select();
    
    const success = document.execCommand("copy");
    document.body.removeChild(tempArea);
    return success;
  } catch (e) {
    return false;
  }
}

/* ----------------------------------------------------
   MODAL CONTROLLERS
---------------------------------------------------- */
function openScreenModal(sourceElementId, title) {
  const content = document.getElementById(sourceElementId).textContent;
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-content').value = content;
  document.getElementById('screen-modal').style.display = 'flex';
}

function closeScreenModal() {
  document.getElementById('screen-modal').style.display = 'none';
}

async function copyModalContent() {
  const textarea = document.getElementById('modal-content');
  const success = await safeCopyToClipboard(textarea.value);
  
  if (success) {
    const btn = document.getElementById('modal-copy-btn');
    const originalText = btn.innerText;
    btn.innerText = '✓ Copied to Clipboard!';
    setTimeout(() => { btn.innerText = originalText; }, 2000);
  } else {
    textarea.select();
    alert("Press Ctrl+C (or Cmd+C) to copy.");
  }
}

async function copyScript(elementId, btnId) {
  const code = document.getElementById(elementId).textContent;
  const success = await safeCopyToClipboard(code);
  const btn = document.getElementById(btnId);

  if (success) {
    const originalText = btn.innerText;
    btn.innerText = '✓ Copied!';
    btn.classList.add('copied');
    setTimeout(() => {
      btn.innerText = originalText;
      btn.classList.remove('copied');
    }, 2000);
  } else {
    openScreenModal(elementId, 'Copy Script');
  }
}

/* ----------------------------------------------------
   PARAGRAPH PARSER & SAVER
---------------------------------------------------- */
function parseParagraphText(text) {
  const blocks = text.split(/-{3,}/).map(b => b.trim()).filter(b => b.length > 0);
  const parsedData = [];

  blocks.forEach((block, idx) => {
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
    let qNum = idx + 1;
    let qTextLines = [];
    let options = [];
    let isOptionsSection = false;

    lines.forEach(line => {
      const qMatch = line.match(/^Question\s+(\d+)[:.]?/i);
      if (qMatch) {
        qNum = parseInt(qMatch[1], 10);
        const rest = line.replace(/^Question\s+\d+[:.]?/i, '').trim();
        if (rest) qTextLines.push(rest);
        return;
      }

      if (/^Options\s*:/i.test(line)) {
        isOptionsSection = true;
        return;
      }

      const optMatch = line.match(/^(\d+|[A-Za-z])[.)]\s*(.+)/);
      if (optMatch) {
        isOptionsSection = true;
        options.push({
          optionNumber: optMatch[1],
          optionText: optMatch[2].trim()
        });
      } else if (!isOptionsSection) {
        qTextLines.push(line);
      }
    });

    if (qTextLines.length > 0 || options.length > 0) {
      parsedData.push({
        questionNumber: qNum,
        question: qTextLines.join(' '),
        options: options
      });
    }
  });

  return parsedData;
}

function saveParagraphToIndexedDB() {
  const rawText = document.getElementById('p1-import-paragraph').value.trim();
  if (!rawText) return alert('Please paste the paragraph text first.');

  const parsedItems = parseParagraphText(rawText);
  if (parsedItems.length === 0) return alert('Could not parse questions. Verify formatting.');

  const tx = db.transaction(STORE_NAME, "readwrite");
  const store = tx.objectStore(STORE_NAME);

  parsedItems.forEach(item => store.put(item));

  tx.oncomplete = () => {
    alert(`[SpeedUp] Saved ${parsedItems.length} questions to IndexedDB!`);
    document.getElementById('p1-import-paragraph').value = '';
    loadStoredQuestions();
  };
}

function loadStoredQuestions() {
  if (!db) return;
  const tx = db.transaction(STORE_NAME, "readonly");
  const store = tx.objectStore(STORE_NAME);
  const req = store.getAll();

  req.onsuccess = () => {
    const rows = req.result.sort((a, b) => a.questionNumber - b.questionNumber);
    const tbody = document.querySelector('#records-table tbody');
    if (rows.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted);">No records in database.</td></tr>`;
      return;
    }
    tbody.innerHTML = rows.map(r => `
      <tr>
        <td><strong style="color: var(--primary);">Q${r.questionNumber}</strong></td>
        <td>${escapeHtml(r.question || 'N/A')}</td>
        <td>
          ${r.options && r.options.length > 0 
            ? `<ol class="opt-list">${r.options.map(o => `<li>${escapeHtml(o.optionText)}</li>`).join('')}</ol>`
            : '<span style="color:var(--text-muted)">None</span>'}
        </td>
        <td><button style="padding: 4px 8px; font-size: 11px; cursor: pointer; background: #1e293b; border: 1px solid #334155; color:#fff; border-radius: 4px;" onclick="deleteRecord(${r.questionNumber})">Delete</button></td>
      </tr>
    `).join('');
  };
}

function deleteRecord(id) {
  const tx = db.transaction(STORE_NAME, "readwrite");
  tx.objectStore(STORE_NAME).delete(id);
  tx.oncomplete = () => loadStoredQuestions();
}

function clearAllRecords() {
  if (!confirm("Clear all questions from SpeedUp database?")) return;
  const tx = db.transaction(STORE_NAME, "readwrite");
  tx.objectStore(STORE_NAME).clear();
  tx.oncomplete = () => loadStoredQuestions();
}

function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/* ----------------------------------------------------
   PART 1: DEDUPLICATED SCRAPER SCRIPT
---------------------------------------------------- */
function generatePart1Script() {
  const totalQ = document.getElementById('p1-total-q').value;
  const speed = document.getElementById('p1-speed').value;
  const qClass = document.getElementById('p1-class-q').value;
  const optClass = document.getElementById('p1-class-opt').value;

  const script = `(async () => {
  const totalQuestions = ${totalQ};
  const waitTime = ${speed};
  const sleep = (ms) => new Promise(res => setTimeout(res, ms));
  const collected = [];

  function extract(idx) {
    const qEl = document.querySelector('${qClass}');
    const labelElements = document.querySelectorAll('${optClass}');
    
    let opts = [];
    if (labelElements.length > 0) {
      opts = Array.from(labelElements).map((el, i) => ({
        num: i + 1,
        text: el.innerText.trim().replace(/\\s+/g, ' ')
      }));
    }

    return {
      num: idx,
      text: qEl ? qEl.innerText.trim() : 'N/A',
      options: opts
    };
  }

  console.clear();
  console.log("%c=======================================================", "color: #06b6d4; font-weight: bold;");
  console.log("%c        EXTRACTING ALL " + totalQuestions + " QUESTIONS & OPTIONS        ", "color: #06b6d4; font-weight: bold;");
  console.log("%c=======================================================", "color: #06b6d4; font-weight: bold;");

  for (let i = 1; i <= totalQuestions; i++) {
    const data = extract(i);
    collected.push(data);

    console.group("%c▶ QUESTION " + data.num + " of " + totalQuestions, "color: #10b981; font-weight: bold;");
    console.log("%c" + data.text, "color: #ffffff; font-weight: bold;");
    if (data.options.length > 0) {
      data.options.forEach((opt) => {
        console.log("  %c(" + opt.num + ") %c" + opt.text, "color: #06b6d4; font-weight: bold;", "color: #d1d5db;");
      });
    }
    console.groupEnd();

    if (i < totalQuestions) {
      const nextBtn = document.querySelector('button.save-next') || 
                      document.querySelector('.save-next') || 
                      [...document.querySelectorAll('button')].find(b => b.textContent.trim().toLowerCase().includes('next'));
      if (nextBtn) { 
        nextBtn.click(); 
        await sleep(waitTime); 
      }
    }
  }

  let fullSummary = "================== ALL " + totalQuestions + " QUESTIONS & OPTIONS ==================\\n\\n";
  collected.forEach(item => {
    fullSummary += "Question " + item.num + ":\\n" + item.text + "\\n\\nOptions:\\n";
    item.options.forEach(opt => {
      fullSummary += "  (" + opt.num + ") " + opt.text + "\\n";
    });
    fullSummary += "\\n----------------------------------------------------------------\\n\\n";
  });

  async function copyToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (err) {}
    }
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.left = "-999999px";
    document.body.appendChild(ta);
    ta.select();
    let success = false;
    try { success = document.execCommand('copy'); } catch (err) {}
    document.body.removeChild(ta);
    return success;
  }

  const isCopied = await copyToClipboard(fullSummary);
  console.log("%c=======================================================", "color: #10b981; font-weight: bold;");
  if (isCopied) {
    console.log("%c✓ SUCCESS: All " + totalQuestions + " questions copied to clipboard!", "color: #10b981; font-size: 14px; font-weight: bold;");
  }
  console.log("%c=======================================================", "color: #10b981; font-weight: bold;");
  console.log(fullSummary);
})();`;

  document.getElementById('p1-script-output').textContent = script;
}

/* ----------------------------------------------------
   PART 2: CALENDAR GRID & TARGET ARRAY SYNC
---------------------------------------------------- */
const selectedQuestions = new Set([1, 3, 4, 5, 6, 7, 8, 9, 10, 12, 14, 15, 16, 17, 18, 19, 20, 22, 23]);
const parsedAnswerMap = new Map();

function updateTargetInputBox() {
  const sorted = Array.from(selectedQuestions).sort((a, b) => a - b);
  document.getElementById('p2-target-input').value = `[${sorted.join(', ')}]`;
}

function syncGridFromInput() {
  const rawVal = document.getElementById('p2-target-input').value;
  const cleanNumbers = rawVal.replace(/[\[\]]/g, '').split(',')
    .map(s => parseInt(s.trim(), 10))
    .filter(n => !isNaN(n));

  selectedQuestions.clear();
  cleanNumbers.forEach(n => selectedQuestions.add(n));
  renderCalendarGrid(false);
  generatePart2Script();
}

function renderCalendarGrid(syncInput = true) {
  const total = parseInt(document.getElementById('p2-total-q').value, 10) || 30;
  const grid = document.getElementById('p2-cal-grid');
  grid.innerHTML = '';
  
  for (let i = 1; i <= total; i++) {
    const btn = document.createElement('div');
    btn.className = 'cal-btn' + (selectedQuestions.has(i) ? ' active' : '');
    btn.textContent = i;
    btn.onclick = () => {
      if (selectedQuestions.has(i)) {
        selectedQuestions.delete(i);
        btn.classList.remove('active');
      } else {
        selectedQuestions.add(i);
        btn.classList.add('active');
      }
      updateTargetInputBox();
      generatePart2Script();
    };
    grid.appendChild(btn);
  }
  if (syncInput) updateTargetInputBox();
}

function autoSelectAllGrid(select) {
  const total = parseInt(document.getElementById('p2-total-q').value, 10) || 30;
  selectedQuestions.clear();
  if (select) {
    for (let i = 1; i <= total; i++) selectedQuestions.add(i);
  }
  renderCalendarGrid();
  generatePart2Script();
}

function autoSelectPreset(type) {
  if (type === 'answers') {
    handleAnswerInput(true);
    return;
  }
  renderCalendarGrid();
  generatePart2Script();
}

function handleAnswerInput(forceSyncTarget = false) {
  const rawText = document.getElementById('p2-answers').value.trim();
  parsedAnswerMap.clear();

  const pairRegex = /\[\s*(\d+)\s*,\s*(\d+)\s*\]/g;
  let match;
  let foundPairs = 0;

  while ((match = pairRegex.exec(rawText)) !== null) {
    const qNum = parseInt(match[1], 10);
    const ansNum = parseInt(match[2], 10);
    parsedAnswerMap.set(qNum, ansNum);
    foundPairs++;
  }

  if (foundPairs > 0) {
    if (forceSyncTarget || document.activeElement === document.getElementById('p2-answers')) {
      selectedQuestions.clear();
      for (const qNum of parsedAnswerMap.keys()) {
        selectedQuestions.add(qNum);
      }
      renderCalendarGrid(true);
    }
  } else {
    const flatList = rawText.replace(/[\[\]]/g, '').split(',')
      .map(s => parseInt(s.trim(), 10))
      .filter(n => !isNaN(n));

    const targetArr = Array.from(selectedQuestions).sort((a, b) => a - b);
    targetArr.forEach((qNum, idx) => {
      if (idx < flatList.length) {
        parsedAnswerMap.set(qNum, flatList[idx]);
      }
    });
  }

  generatePart2Script();
}

function generatePart2Script() {
  const total = parseInt(document.getElementById('p2-total-q').value, 10) || 30;
  const speed = document.getElementById('p2-speed').value || 50000;
  const targetArr = Array.from(selectedQuestions).sort((a, b) => a - b);

  const mapRows = [];
  let rowBuffer = [];
  
  targetArr.forEach((qNum) => {
    if (parsedAnswerMap.has(qNum)) {
      rowBuffer.push(`[${qNum}, ${parsedAnswerMap.get(qNum)}]`);
      if (rowBuffer.length === 5) {
        mapRows.push(rowBuffer.join(', '));
        rowBuffer = [];
      }
    }
  });
  if (rowBuffer.length > 0) mapRows.push(rowBuffer.join(', '));

  const mapCode = mapRows.length > 0 ? mapRows.join(',\n    ') : '// No target questions selected';

  const script = `(async () => {
  const answerMap = new Map([
    ${mapCode}
  ]);

  const totalQuestions = ${total};
  const waitSpeed = ${speed};
  const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

  let answeredCount = 0;
  let skippedCount = 0;

  console.log("%c[Status] Processing started with " + (waitSpeed/1000) + "-second interval per question...", "color: #06b6d4; font-weight: bold;");

  for (let currentQ = 1; currentQ <= totalQuestions; currentQ++) {
    if (answerMap.has(currentQ)) {
      const targetAnswerNum = answerMap.get(currentQ);
      const targetIndex = targetAnswerNum - 1;

      const options = document.querySelectorAll(
        '.options-container input[type="radio"], input.mcq-questions[type="radio"], input[type="radio"]'
      );

      if (options.length > 0 && targetIndex >= 0 && targetIndex < options.length) {
        const targetOpt = options[targetIndex];

        targetOpt.checked = true;
        targetOpt.click();

        const label = document.querySelector("label[for='" + targetOpt.id + "']") || targetOpt.closest('.form-check');
        if (label) label.click();

        targetOpt.dispatchEvent(new Event('input', { bubbles: true }));
        targetOpt.dispatchEvent(new Event('change', { bubbles: true }));

        answeredCount++;
        console.log("%c[Done] Q" + currentQ + ": Option " + targetAnswerNum + " selected. Waiting " + (waitSpeed/1000) + "s...", "color: #10b981;");
      } else {
        console.warn("[Warning] Q" + currentQ + ": Option element not found.");
      }
    } else {
      skippedCount++;
      console.log("[Skip] Q" + currentQ + ": Not in target list. Waiting " + (waitSpeed/1000) + "s...");
    }

    await sleep(waitSpeed);

    const nextBtn =
      document.querySelector('button.save-next') ||
      document.querySelector('.save-next') ||
      [...document.querySelectorAll('button')].find((b) =>
        b.textContent.trim().toLowerCase().includes('next')
      );

    if (nextBtn && currentQ < totalQuestions) {
      nextBtn.click();
      await sleep(1200);
    }
  }

  console.group("%c=== TASK COMPLETED ===", "color: #10b981; font-size: 14px; font-weight: bold;");
  console.log("Total Questions Scanned : " + totalQuestions);
  console.log("Target Questions Answered: " + answeredCount);
  console.log("Questions Skipped        : " + skippedCount);
  console.log("Completion Status        : 100% Successful");
  console.groupEnd();
})();`;

  document.getElementById('p2-script-output').textContent = script;
}

/* ----------------------------------------------------
   CODE RUNNER: WORD-BY-WORD & CHAR DELAY GENERATOR
---------------------------------------------------- */
function generateCodeRunnerScript() {
  const cand1 = document.getElementById("cand-1").value;
  const cand2 = document.getElementById("cand-2").value;
  const charDelay = parseInt(document.getElementById("type-delay").value, 10) || 30;
  const wordDelay = parseInt(document.getElementById("word-delay").value, 10) || 150;
  const runWaitTime = parseInt(document.getElementById("run-wait").value, 10) || 10000;

  const candidates = [];
  if (cand1.trim()) candidates.push(cand1);
  if (cand2.trim()) candidates.push(cand2);

  const serializedCandidates = JSON.stringify(candidates, null, 2);

  const script = `(async () => {
  const logicCandidates = ${serializedCandidates};

  const charDelay = ${charDelay};
  const wordDelay = ${wordDelay};
  const runWaitTime = ${runWaitTime};
  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  let audioCtx = null;
  let osc = null;
  let isBuzzing = false;

  function startBuzzer() {
    if (isBuzzing) return;
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(520, audioCtx.currentTime);
    gainNode.gain.setValueAtTime(0.15, audioCtx.currentTime);

    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    osc.start();
    isBuzzing = true;
    console.log("%c[ALERT] Solution executed! Press ANY KEY to stop sound.", "color: #10b981; font-weight: bold; font-size: 14px;");

    window.addEventListener('keydown', stopBuzzer, { once: true });
  }

  function stopBuzzer() {
    if (isBuzzing && osc) {
      try {
        osc.stop();
        audioCtx.close();
      } catch (e) {}
      isBuzzing = false;
      console.log("Buzzer silenced.");
    }
  }

  async function typeCodeIntoEditor(code) {
    const monacoModel = window.opener?.monaco?.editor?.getModels()?.[0] || window.monaco?.editor?.getModels()?.[0];
    const cmInstance = window.opener?.document?.querySelector('.CodeMirror')?.CodeMirror || document.querySelector('.CodeMirror')?.CodeMirror;
    const aceEditor = (window.opener?.ace && window.opener.document.querySelector('.ace_editor')) ? window.opener.ace.edit(window.opener.document.querySelector('.ace_editor')) :
                      (window.ace && document.querySelector('.ace_editor')) ? window.ace.edit(document.querySelector('.ace_editor')) : null;
    const textarea = window.opener?.document?.querySelector('textarea:focus') || 
                     window.opener?.document?.querySelector('textarea') || 
                     document.querySelector('textarea:focus') || 
                     document.querySelector('textarea');

    if (monacoModel) monacoModel.setValue('');
    else if (cmInstance) cmInstance.setValue('');
    else if (aceEditor) aceEditor.setValue('', -1);
    else if (textarea) textarea.value = '';

    const tokens = code.match(/\\S+|\\s+/g) || [code];
    let accumulated = '';

    for (let t = 0; t < tokens.length; t++) {
      const token = tokens[t];
      for (let i = 0; i < token.length; i++) {
        accumulated += token[i];
        if (monacoModel) monacoModel.setValue(accumulated);
        else if (cmInstance) cmInstance.replaceRange(token[i], cmInstance.getCursor());
        else if (aceEditor) aceEditor.insert(token[i]);
        else if (textarea) {
          textarea.value = accumulated;
          textarea.dispatchEvent(new Event('input', { bubbles: true }));
        }
        if (charDelay > 0) await sleep(charDelay);
      }

      if (/\\S+/.test(token) && wordDelay > 0) {
        await sleep(wordDelay);
      }
    }
  }

  function hasError() {
    const text = document.body.innerText.toLowerCase();
    const errorKeywords = ['compilation error', 'runtime error', 'wrong answer', 'syntaxerror', 'exception', 'failed'];
    return errorKeywords.some(keyword => text.includes(keyword));
  }

  for (let index = 0; index < logicCandidates.length; index++) {
    console.log(\`[AutoRunner] Typing logic attempt #\${index + 1}...\`);
    await typeCodeIntoEditor(logicCandidates[index]);
    await sleep(500);

    const runBtn = document.querySelector('.programming_run_button') || 
                   [...document.querySelectorAll('button')].find(b => b.textContent.includes('Compile & Run') || b.textContent.includes('Run'));

    if (!runBtn) {
      console.error("Compile & Run button not found.");
      return;
    }

    console.log("[AutoRunner] Clicking Compile & Run...");
    runBtn.click();

    await sleep(runWaitTime);

    if (hasError() && index < logicCandidates.length - 1) {
      console.warn(\`[AutoRunner] Attempt #\${index + 1} failed. Moving to next candidate...\`);
    } else {
      console.log(\`[AutoRunner] Completed execution for attempt #\${index + 1}.\`);
      startBuzzer();
      break;
    }
  }
})();`;

  document.getElementById("code-script-output").textContent = script;
}

window.onload = () => {
  initDB();
  loadNotepad();
  renderCalendarGrid();
  generatePart1Script();
  handleAnswerInput(true);
  generateCodeRunnerScript();
};
