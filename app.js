/* ==========================================================================
   TOEIC Synonym Recall - Complete Application Logic (app.js)
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    // ----------------------------------------------------------------------
    // 1. Application State & Storage
    // ----------------------------------------------------------------------
    const state = {
        allVocab: [],           // All 151 items from data.json
        srsBox1: new Set(),     // IDs of items needing review
        theme: 'dark',          // 'dark' | 'light'
        
        // Active Session Settings
        sessionMode: 'mode1',   // 'mode1' | 'mode2'
        sessionSource: 'all',  // 'all' | 'srs'
        sessionCount: 10,       // 5 | 10 | 20 | 'all'
        
        // Session Execution Data
        sessionItems: [],
        currentIndex: 0,
        correctCount: 0,
        perfectCount: 0,
        startTime: null,
        timerInterval: null,
        elapsedSeconds: 0,

        // Current Question State
        currentQuestion: null,
        mode1Found: new Set(),
        mode1Targets: [],
        mode2Revealed: new Map(), // word -> boolean
        mode2UsedHint: false,
        mode2UsedSkip: false,

        // Session Results History
        resultsLog: [] // Array of { item, isPerfect, usedHint, usedSkip }
    };

    // DOM Elements
    const elements = {
        // Theme
        btnThemeToggle: document.getElementById('btn-theme-toggle'),
        headerBox1Count: document.getElementById('header-box1-count'),
        setupSrsCount: document.getElementById('setup-srs-count'),
        btnSourceSrs: document.getElementById('btn-source-srs'),

        // Screens
        screenSetup: document.getElementById('screen-setup'),
        screenPractice: document.getElementById('screen-practice'),
        screenResult: document.getElementById('screen-result'),

        // Setup Controls
        modeOptions: document.querySelectorAll('.mode-option'),
        sourceBtns: document.querySelectorAll('#source-selector .select-btn'),
        countBtns: document.querySelectorAll('#count-selector .select-btn'),
        btnStartSession: document.getElementById('btn-start-session'),

        // Practice Controls
        btnQuitPractice: document.getElementById('btn-quit-practice'),
        practiceProgressText: document.getElementById('practice-progress-text'),
        practiceScoreText: document.getElementById('practice-score-text'),
        practiceProgressFill: document.getElementById('practice-progress-fill'),
        timerText: document.getElementById('timer-text'),

        // Mode 1 Elements
        viewMode1: document.getElementById('view-mode1'),
        mode1TargetWord: document.getElementById('mode1-target-word'),
        mode1TargetMeaning: document.getElementById('mode1-target-meaning'),
        mode1FoundCount: document.getElementById('mode1-found-count'),
        mode1TotalCount: document.getElementById('mode1-total-count'),
        mode1SelectedCards: document.getElementById('mode1-selected-cards'),
        mode1PoolCards: document.getElementById('mode1-pool-cards'),

        // Mode 2 Elements
        viewMode2: document.getElementById('view-mode2'),
        mode2MeaningTitle: document.getElementById('mode2-meaning-title'),
        mode2FoundNum: document.getElementById('mode2-found-num'),
        mode2TotalNum: document.getElementById('mode2-total-num'),
        mode2SlotsGrid: document.getElementById('mode2-slots-grid'),
        mode2Input: document.getElementById('mode2-input'),
        btnMode2Submit: document.getElementById('btn-mode2-submit'),
        btnMode2Hint: document.getElementById('btn-mode2-hint'),
        btnMode2Skip: document.getElementById('btn-mode2-skip'),

        // Result Elements
        resStatTotal: document.getElementById('res-stat-total'),
        resStatPerfect: document.getElementById('res-stat-perfect'),
        resStatTime: document.getElementById('res-stat-time'),
        resStatReview: document.getElementById('res-stat-review'),
        resultItemsList: document.getElementById('result-items-list'),
        btnResultNew: document.getElementById('btn-result-new'),
        btnResultReviewWrong: document.getElementById('btn-result-review-wrong')
    };

    // ----------------------------------------------------------------------
    // 2. Audio Effects (Web Audio API Synthesizer)
    // ----------------------------------------------------------------------
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    function playSound(type) {
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);

        const now = audioCtx.currentTime;

        if (type === 'correct') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(523.25, now); // C5
            osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.12); // E5
            gain.gain.setValueAtTime(0.15, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
            osc.start(now);
            osc.stop(now + 0.25);
        } else if (type === 'wrong') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(220, now); // A3
            osc.frequency.setValueAtTime(160, now + 0.1);
            gain.gain.setValueAtTime(0.2, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
            osc.start(now);
            osc.stop(now + 0.25);
        } else if (type === 'hint') {
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(440, now); // A4
            osc.frequency.exponentialRampToValueAtTime(880, now + 0.15); // A5
            gain.gain.setValueAtTime(0.12, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
            osc.start(now);
            osc.stop(now + 0.2);
        } else if (type === 'complete') {
            const freqs = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
            freqs.forEach((f, idx) => {
                const o = audioCtx.createOscillator();
                const g = audioCtx.createGain();
                o.connect(g);
                g.connect(audioCtx.destination);
                o.frequency.value = f;
                g.gain.setValueAtTime(0.1, now + idx * 0.08);
                g.gain.exponentialRampToValueAtTime(0.01, now + idx * 0.08 + 0.2);
                o.start(now + idx * 0.08);
                o.stop(now + idx * 0.08 + 0.2);
            });
        }
    }

    // ----------------------------------------------------------------------
    // 3. LocalStorage & Initialization
    // ----------------------------------------------------------------------
    function init() {
        loadStorage();
        loadVocabData();
        setupEventListeners();
        if (window.lucide) {
            lucide.createIcons();
        }
    }

    function loadStorage() {
        // Theme
        const savedTheme = localStorage.getItem('toeic_theme') || 'dark';
        setTheme(savedTheme);

        // SRS Box 1
        const savedSrs = localStorage.getItem('toeic_srs_box1');
        if (savedSrs) {
            try {
                const arr = JSON.parse(savedSrs);
                state.srsBox1 = new Set(arr);
            } catch (e) {
                state.srsBox1 = new Set();
            }
        }
        updateSrsBadges();
    }

    function saveSrsStorage() {
        localStorage.setItem('toeic_srs_box1', JSON.stringify(Array.from(state.srsBox1)));
        updateSrsBadges();
    }

    function updateSrsBadges() {
        const count = state.srsBox1.size;
        elements.headerBox1Count.textContent = count;
        elements.setupSrsCount.textContent = count;

        if (count === 0) {
            elements.btnSourceSrs.classList.add('disabled');
        } else {
            elements.btnSourceSrs.classList.remove('disabled');
        }
    }

    function setTheme(theme) {
        state.theme = theme;
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('toeic_theme', theme);
    }

    // Load Vocabulary JSON Data
    async function loadVocabData() {
        try {
            const resp = await fetch('data/data.json');
            state.allVocab = await resp.json();
            console.log(`Loaded ${state.allVocab.length} vocab entries.`);
        } catch (err) {
            console.error('Failed to load data.json:', err);
        }
    }

    // ----------------------------------------------------------------------
    // 4. Navigation & Setup Event Listeners
    // ----------------------------------------------------------------------
    function setupEventListeners() {
        // Theme Toggle
        elements.btnThemeToggle.addEventListener('click', () => {
            setTheme(state.theme === 'dark' ? 'light' : 'dark');
        });

        // Mode Selection
        elements.modeOptions.forEach(opt => {
            opt.addEventListener('click', () => {
                elements.modeOptions.forEach(o => o.classList.remove('active'));
                opt.classList.add('active');
                const radio = opt.querySelector('input[type="radio"]');
                radio.checked = true;
                state.sessionMode = radio.value;
            });
        });

        // Source Selection
        elements.sourceBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                if (btn.classList.contains('disabled')) return;
                elements.sourceBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                state.sessionSource = btn.dataset.source;
            });
        });

        // Count Selection
        elements.countBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                elements.countBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const val = btn.dataset.count;
                state.sessionCount = val === 'all' ? 'all' : parseInt(val, 10);
            });
        });

        // Start Session Button
        elements.btnStartSession.addEventListener('click', startSession);

        // Quit Practice
        elements.btnQuitPractice.addEventListener('click', () => {
            if (confirm('Bạn có chắc muốn thoát phiên học hiện tại?')) {
                endSession(false);
            }
        });

        // Mode 2 Input Controls
        elements.mode2Input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleMode2InputSubmit();
            }
        });
        elements.btnMode2Submit.addEventListener('click', handleMode2InputSubmit);
        elements.btnMode2Hint.addEventListener('click', handleMode2Hint);
        elements.btnMode2Skip.addEventListener('click', handleMode2Skip);

        // Result Screen Buttons
        elements.btnResultNew.addEventListener('click', () => {
            switchScreen('setup');
        });
        elements.btnResultReviewWrong.addEventListener('click', () => {
            state.sessionSource = 'srs';
            startSession();
        });
    }

    function switchScreen(screenName) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        if (screenName === 'setup') {
            elements.screenSetup.classList.add('active');
        } else if (screenName === 'practice') {
            elements.screenPractice.classList.add('active');
        } else if (screenName === 'result') {
            elements.screenResult.classList.add('active');
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // Helper: Shuffle Array (Fisher-Yates)
    function shuffle(arr) {
        const a = [...arr];
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }

    // Helper: String Sanitizer
    function sanitize(str) {
        return (str || '').trim().toLowerCase();
    }

    // ----------------------------------------------------------------------
    // 5. Session Execution Logic
    // ----------------------------------------------------------------------
    function startSession() {
        let pool = [];
        if (state.sessionSource === 'srs') {
            pool = state.allVocab.filter(v => state.srsBox1.has(v.id));
            if (pool.length === 0) {
                alert('Không có từ nào trong danh sách cần ôn gấp (Box 1)!');
                return;
            }
        } else {
            pool = [...state.allVocab];
        }

        // Shuffle pool
        pool = shuffle(pool);

        // Select question count
        if (state.sessionCount !== 'all') {
            pool = pool.slice(0, Math.min(state.sessionCount, pool.length));
        }

        state.sessionItems = pool;
        state.currentIndex = 0;
        state.correctCount = 0;
        state.perfectCount = 0;
        state.resultsLog = [];
        state.elapsedSeconds = 0;

        // Start timer
        startTimer();

        // Switch to practice view & render first question
        switchScreen('practice');
        renderQuestion();
    }

    function startTimer() {
        clearInterval(state.timerInterval);
        state.startTime = Date.now();
        state.timerInterval = setInterval(() => {
            state.elapsedSeconds++;
            const mins = String(Math.floor(state.elapsedSeconds / 60)).padStart(2, '0');
            const secs = String(state.elapsedSeconds % 60).padStart(2, '0');
            elements.timerText.textContent = `${mins}:${secs}`;
        }, 1000);
    }

    function renderQuestion() {
        if (state.currentIndex >= state.sessionItems.length) {
            endSession(true);
            return;
        }

        const item = state.sessionItems[state.currentIndex];
        state.currentQuestion = item;

        // Update progress bar & text
        const total = state.sessionItems.length;
        const currentNum = state.currentIndex + 1;
        elements.practiceProgressText.textContent = `Câu ${currentNum} / ${total}`;
        elements.practiceScoreText.textContent = `Hoàn hảo: ${state.perfectCount}`;
        const pct = (currentNum / total) * 100;
        elements.practiceProgressFill.style.width = `${pct}%`;

        // Render appropriate Mode
        if (state.sessionMode === 'mode1') {
            elements.viewMode1.classList.add('active');
            elements.viewMode2.classList.remove('active');
            setupMode1(item);
        } else {
            elements.viewMode2.classList.add('active');
            elements.viewMode1.classList.remove('active');
            setupMode2(item);
        }
    }

    // ----------------------------------------------------------------------
    // 6. MODE 1: Synonym Chain (Click & Drag-Drop Cards)
    // ----------------------------------------------------------------------
    function setupMode1(item) {
        state.mode1Found.clear();
        
        // Target word
        elements.mode1TargetWord.textContent = item.key_word.toUpperCase();
        elements.mode1TargetMeaning.textContent = item.meaning;

        // Correct synonyms
        const correctSynonyms = item.synonyms.map(s => s.trim()).filter(Boolean);
        state.mode1Targets = correctSynonyms;

        elements.mode1FoundCount.textContent = '0';
        elements.mode1TotalCount.textContent = correctSynonyms.length;

        // Render Empty Drop Zone
        elements.mode1SelectedCards.innerHTML = `
            <div class="empty-drop-hint">Kéo - thả hoặc click các thẻ từ đồng nghĩa bên dưới vào đây</div>
        `;

        // Pick Distractor words from other vocab items
        const otherItems = state.allVocab.filter(v => v.id !== item.id);
        const distractorWords = [];
        const numDistractors = Math.max(3, Math.min(6, Math.floor(correctSynonyms.length * 1.5)));

        while (distractorWords.length < numDistractors && otherItems.length > 0) {
            const randomItem = otherItems[Math.floor(Math.random() * otherItems.length)];
            const allWordsInItem = [randomItem.key_word, ...randomItem.synonyms];
            const randomWord = allWordsInItem[Math.floor(Math.random() * allWordsInItem.length)];
            if (randomWord && !correctSynonyms.includes(randomWord) && !distractorWords.includes(randomWord)) {
                distractorWords.push(randomWord);
            }
        }

        // Combine & Shuffle Pool Cards
        const poolCardsData = shuffle([...correctSynonyms, ...distractorWords]);
        elements.mode1PoolCards.innerHTML = '';

        poolCardsData.forEach(word => {
            const card = document.createElement('div');
            card.className = 'word-card';
            card.textContent = word;
            card.dataset.word = word;
            card.draggable = true;

            // Click Handler
            card.addEventListener('click', () => handleMode1CardSelect(card, word));

            // Drag Handler
            card.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', word);
            });

            elements.mode1PoolCards.appendChild(card);
        });

        // Setup Dropzone Drag-Over Listener
        elements.mode1SelectedCards.ondragover = (e) => e.preventDefault();
        elements.mode1SelectedCards.ondrop = (e) => {
            e.preventDefault();
            const word = e.dataTransfer.getData('text/plain');
            const card = elements.mode1PoolCards.querySelector(`[data-word="${word}"]`);
            if (card) {
                handleMode1CardSelect(card, word);
            }
        };
    }

    function handleMode1CardSelect(cardElement, word) {
        const isCorrect = state.mode1Targets.some(t => sanitize(t) === sanitize(word));

        if (isCorrect) {
            if (state.mode1Found.has(word)) return; // Already selected

            playSound('correct');
            state.mode1Found.add(word);
            cardElement.classList.add('correct');

            // Move to selected drop zone
            const hint = elements.mode1SelectedCards.querySelector('.empty-drop-hint');
            if (hint) hint.remove();

            elements.mode1SelectedCards.appendChild(cardElement);
            elements.mode1FoundCount.textContent = state.mode1Found.size;

            // Check if 100% found
            if (state.mode1Found.size === state.mode1Targets.length) {
                playSound('complete');
                state.perfectCount++;
                state.resultsLog.push({ item: state.currentQuestion, isPerfect: true });

                setTimeout(() => {
                    state.currentIndex++;
                    renderQuestion();
                }, 700);
            }
        } else {
            // Wrong selection
            playSound('wrong');
            cardElement.classList.add('wrong');
            
            // Mark item in SRS Box 1 if user made a mistake
            state.srsBox1.add(state.currentQuestion.id);
            saveSrsStorage();

            setTimeout(() => {
                cardElement.classList.remove('wrong');
            }, 500);
        }
    }

    // ----------------------------------------------------------------------
    // 7. MODE 2: Meaning to Synonyms (Active Recall Keyboard Typing)
    // ----------------------------------------------------------------------
    function setupMode2(item) {
        state.mode2Revealed.clear();
        state.mode2UsedHint = false;
        state.mode2UsedSkip = false;

        // All target words for this item (key_word + synonyms)
        const allTargets = [item.key_word, ...item.synonyms].map(s => s.trim()).filter(Boolean);
        allTargets.forEach(w => state.mode2Revealed.set(w, false));

        elements.mode2MeaningTitle.textContent = item.meaning;
        elements.mode2FoundNum.textContent = '0';
        elements.mode2TotalNum.textContent = allTargets.length;
        elements.mode2Input.value = '';
        elements.mode2Input.classList.remove('input-error');
        elements.mode2Input.focus();

        // Render Slots Matrix
        renderMode2Slots(allTargets);
    }

    function renderMode2Slots(allTargets) {
        elements.mode2SlotsGrid.innerHTML = '';
        allTargets.forEach((targetWord, index) => {
            const isRevealed = state.mode2Revealed.get(targetWord);
            const slot = document.createElement('div');
            slot.className = `word-slot ${isRevealed ? 'revealed' : ''}`;
            slot.dataset.word = targetWord;

            const indexTag = document.createElement('span');
            indexTag.className = 'slot-index-tag';
            indexTag.textContent = `#${index + 1}`;
            slot.appendChild(indexTag);

            if (isRevealed) {
                const textSpan = document.createElement('span');
                textSpan.textContent = targetWord;
                slot.appendChild(textSpan);
            } else {
                const placeholder = document.createElement('span');
                placeholder.className = 'slot-hint-text';
                placeholder.textContent = '_ '.repeat(targetWord.length).trim();
                slot.appendChild(placeholder);
            }

            elements.mode2SlotsGrid.appendChild(slot);
        });
    }

    function handleMode2InputSubmit() {
        const inputVal = sanitize(elements.mode2Input.value);
        if (!inputVal) return;

        let matchFound = false;

        for (const [targetWord, isRevealed] of state.mode2Revealed.entries()) {
            if (sanitize(targetWord) === inputVal) {
                if (!isRevealed) {
                    // Correct & Unrevealed!
                    matchFound = true;
                    state.mode2Revealed.set(targetWord, true);
                    playSound('correct');

                    // Update UI slot
                    const slot = elements.mode2SlotsGrid.querySelector(`[data-word="${targetWord}"]`);
                    if (slot) {
                        slot.classList.add('revealed');
                        slot.innerHTML = `<span class="slot-index-tag">#</span><span>${targetWord}</span>`;
                    }

                    // Clear input
                    elements.mode2Input.value = '';
                    elements.mode2Input.classList.remove('input-error');
                    break;
                }
            }
        }

        if (matchFound) {
            // Update found count
            let foundCount = 0;
            for (const revealed of state.mode2Revealed.values()) {
                if (revealed) foundCount++;
            }
            elements.mode2FoundNum.textContent = foundCount;

            // Check if all revealed
            if (foundCount === state.mode2Revealed.size) {
                playSound('complete');
                const isPerfect = !state.mode2UsedHint && !state.mode2UsedSkip;
                if (isPerfect) {
                    state.perfectCount++;
                } else {
                    state.srsBox1.add(state.currentQuestion.id);
                    saveSrsStorage();
                }

                state.resultsLog.push({
                    item: state.currentQuestion,
                    isPerfect: isPerfect,
                    usedHint: state.mode2UsedHint,
                    usedSkip: state.mode2UsedSkip
                });

                setTimeout(() => {
                    state.currentIndex++;
                    renderQuestion();
                }, 600);
            }
        } else {
            // Wrong or already found
            playSound('wrong');
            elements.mode2Input.classList.add('input-error');
            setTimeout(() => {
                elements.mode2Input.classList.remove('input-error');
            }, 500);
        }
    }

    function handleMode2Hint() {
        state.mode2UsedHint = true;
        playSound('hint');

        // Find first unrevealed word
        for (const [targetWord, isRevealed] of state.mode2Revealed.entries()) {
            if (!isRevealed) {
                // Reveal 1 hint word completely
                state.mode2Revealed.set(targetWord, true);

                const slot = elements.mode2SlotsGrid.querySelector(`[data-word="${targetWord}"]`);
                if (slot) {
                    slot.className = 'word-slot revealed-hint';
                    slot.innerHTML = `<span class="slot-index-tag">#</span><span>${targetWord}</span>`;
                }
                break;
            }
        }

        // Update found count display
        let foundCount = 0;
        for (const revealed of state.mode2Revealed.values()) {
            if (revealed) foundCount++;
        }
        elements.mode2FoundNum.textContent = foundCount;

        // Check if all words are now revealed
        if (foundCount === state.mode2Revealed.size) {
            playSound('complete');
            state.srsBox1.add(state.currentQuestion.id);
            saveSrsStorage();

            state.resultsLog.push({
                item: state.currentQuestion,
                isPerfect: false,
                usedHint: true,
                usedSkip: state.mode2UsedSkip
            });

            setTimeout(() => {
                state.currentIndex++;
                renderQuestion();
            }, 700);
        }
    }

    function handleMode2Skip() {
        state.mode2UsedSkip = true;
        playSound('wrong');

        // Mark set in SRS Box 1
        state.srsBox1.add(state.currentQuestion.id);
        saveSrsStorage();

        // Reveal all missing words
        for (const targetWord of state.mode2Revealed.keys()) {
            state.mode2Revealed.set(targetWord, true);
            const slot = elements.mode2SlotsGrid.querySelector(`[data-word="${targetWord}"]`);
            if (slot) {
                slot.className = 'word-slot skipped';
                slot.innerHTML = `<span class="slot-index-tag">#</span><span>${targetWord}</span>`;
            }
        }

        elements.mode2FoundNum.textContent = state.mode2Revealed.size;

        state.resultsLog.push({
            item: state.currentQuestion,
            isPerfect: false,
            usedHint: state.mode2UsedHint,
            usedSkip: true
        });

        setTimeout(() => {
            state.currentIndex++;
            renderQuestion();
        }, 1200);
    }

    // ----------------------------------------------------------------------
    // 8. Result Screen Logic
    // ----------------------------------------------------------------------
    function endSession(isCompleted) {
        clearInterval(state.timerInterval);

        if (!isCompleted) {
            switchScreen('setup');
            return;
        }

        // Calculate Stats
        const totalPracticed = state.sessionItems.length;
        const perfects = state.resultsLog.filter(r => r.isPerfect).length;
        const mins = String(Math.floor(state.elapsedSeconds / 60)).padStart(2, '0');
        const secs = String(state.elapsedSeconds % 60).padStart(2, '0');
        const timeStr = `${mins}:${secs}`;
        const reviewCount = state.resultsLog.filter(r => !r.isPerfect).length;

        // Render Stats
        elements.resStatTotal.textContent = `${totalPracticed}/${totalPracticed}`;
        elements.resStatPerfect.textContent = perfects;
        elements.resStatTime.textContent = timeStr;
        elements.resStatReview.textContent = reviewCount;

        // Render Item Breakdown List
        elements.resultItemsList.innerHTML = '';
        state.resultsLog.forEach(log => {
            const card = document.createElement('div');
            card.className = `review-item-card ${!log.isPerfect ? 'needs-review' : ''}`;

            const synonymsText = [log.item.key_word, ...log.item.synonyms].join(' = ');

            card.innerHTML = `
                <div class="review-item-info">
                    <div class="review-item-title">${log.item.meaning}</div>
                    <div class="review-item-synonyms">${synonymsText}</div>
                </div>
                <div class="review-status-tag ${log.isPerfect ? 'tag-perfect' : 'tag-review'}">
                    ${log.isPerfect ? 'Hoàn Hảo' : 'Cần Ôn Lại (Box 1)'}
                </div>
            `;
            elements.resultItemsList.appendChild(card);
        });

        switchScreen('result');
    }

    // Initialize Application
    init();
});
