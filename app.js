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
        mode2HintChars: new Map(), // word -> number of hint letters revealed
        mode2UsedHint: false,
        mode2UsedSkip: false,

        // Session Results History
        resultsLog: [], // Array of { item, isPerfect, usedHint, usedSkip }

        // Mode 3 (Vocab Management) State
        vocabEditItem: null
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
        screenVocabManage: document.getElementById('screen-vocab-manage'),

        // Setup Controls
        modeOptions: document.querySelectorAll('.mode-option'),
        sourceBtns: document.querySelectorAll('#source-selector .select-btn'),
        inputSessionCount: document.getElementById('input-session-count'),
        btnCountAll: document.getElementById('btn-count-all'),
        presetBtns: document.querySelectorAll('#count-presets .preset-btn'),
        totalCountBadge: document.getElementById('total-count-badge'),
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
        mode1NextContainer: document.getElementById('mode1-next-container'),
        btnMode1Next: document.getElementById('btn-mode1-next'),

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
        btnResultReviewWrong: document.getElementById('btn-result-review-wrong'),

        // Mode 3 (Vocab Management) Elements
        vocabTotalCount: document.getElementById('vocab-total-count'),
        btnVocabBack: document.getElementById('btn-vocab-back'),
        btnVocabResetDefault: document.getElementById('btn-vocab-reset-default'),
        btnAddVocabModal: document.getElementById('btn-add-vocab-modal'),
        vocabSearchInput: document.getElementById('vocab-search-input'),
        btnVocabSearchClear: document.getElementById('btn-vocab-search-clear'),
        vocabSearchStatsText: document.getElementById('vocab-search-stats-text'),
        vocabListGrid: document.getElementById('vocab-list-grid'),

        // Vocab Modal Form Elements
        modalVocabForm: document.getElementById('modal-vocab-form'),
        modalVocabTitle: document.getElementById('modal-vocab-title'),
        btnCloseVocabModal: document.getElementById('btn-close-vocab-modal'),
        btnCancelVocabModal: document.getElementById('btn-cancel-vocab-modal'),
        vocabForm: document.getElementById('vocab-form'),
        inputVocabEditId: document.getElementById('input-vocab-edit-id'),
        inputVocabKeyword: document.getElementById('input-vocab-keyword'),
        inputVocabMeaning: document.getElementById('input-vocab-meaning'),
        inputVocabSynonyms: document.getElementById('input-vocab-synonyms'),
        btnSaveVocabModal: document.getElementById('btn-save-vocab-modal')
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

    function saveVocabStorage() {
        localStorage.setItem('toeic_vocab_custom_data', JSON.stringify(state.allVocab));
        updateCountBadgeAndMax();
        if (elements.vocabTotalCount) {
            elements.vocabTotalCount.textContent = state.allVocab.length;
        }
    }

    // Load Vocabulary JSON Data (supports custom localStorage, fetch & window.TOEIC_VOCAB_DATA fallback)
    async function loadVocabData() {
        // Priority 1: Custom vocab saved in localStorage
        const savedCustom = localStorage.getItem('toeic_vocab_custom_data');
        if (savedCustom) {
            try {
                const parsed = JSON.parse(savedCustom);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    state.allVocab = parsed;
                    console.log(`Loaded ${state.allVocab.length} custom vocab entries from localStorage.`);
                    updateCountBadgeAndMax();
                    return;
                }
            } catch (e) {
                console.error("Failed to parse custom vocab from localStorage", e);
            }
        }

        // Priority 2: window.TOEIC_VOCAB_DATA fallback
        if (window.TOEIC_VOCAB_DATA && Array.isArray(window.TOEIC_VOCAB_DATA) && window.TOEIC_VOCAB_DATA.length > 0) {
            state.allVocab = JSON.parse(JSON.stringify(window.TOEIC_VOCAB_DATA));
            console.log(`Loaded ${state.allVocab.length} vocab entries from fallback data.js.`);
            updateCountBadgeAndMax();
        }

        // Priority 3: fetch data.json
        try {
            const resp = await fetch('data/data.json');
            if (resp.ok) {
                const fetched = await resp.json();
                if (Array.isArray(fetched) && fetched.length > 0) {
                    state.allVocab = fetched;
                    console.log(`Loaded ${state.allVocab.length} vocab entries from data.json via fetch.`);
                    updateCountBadgeAndMax();
                }
            }
        } catch (err) {
            console.warn('Fetch data.json failed (normal on file:// protocol). Using data.js fallback.');
            updateCountBadgeAndMax();
        }
    }

    function updateCountBadgeAndMax() {
        const availableCount = state.sessionSource === 'srs' ? state.srsBox1.size : state.allVocab.length;
        if (elements.totalCountBadge) {
            elements.totalCountBadge.textContent = availableCount;
        }
        if (elements.inputSessionCount) {
            elements.inputSessionCount.max = availableCount;
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
                
                // Update total count badge based on source
                const availableCount = state.sessionSource === 'srs' ? state.srsBox1.size : state.allVocab.length;
                if (elements.totalCountBadge) {
                    elements.totalCountBadge.textContent = availableCount;
                }
                if (elements.inputSessionCount) {
                    elements.inputSessionCount.max = availableCount;
                }
            });
        });

        // Quick Preset Buttons
        elements.presetBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                elements.presetBtns.forEach(b => b.classList.remove('active'));
                elements.btnCountAll.classList.remove('active');
                btn.classList.add('active');
                
                const val = parseInt(btn.dataset.val, 10);
                elements.inputSessionCount.value = val;
            });
        });

        // Select All Count Button
        elements.btnCountAll.addEventListener('click', () => {
            elements.presetBtns.forEach(b => b.classList.remove('active'));
            elements.btnCountAll.classList.add('active');
            
            const maxVal = state.sessionSource === 'srs' ? state.srsBox1.size : state.allVocab.length;
            elements.inputSessionCount.value = maxVal;
        });

        // Input Field Manual Input Listener
        elements.inputSessionCount.addEventListener('input', () => {
            const val = parseInt(elements.inputSessionCount.value, 10);
            elements.presetBtns.forEach(b => {
                if (parseInt(b.dataset.val, 10) === val) {
                    b.classList.add('active');
                } else {
                    b.classList.remove('active');
                }
            });
            const maxVal = state.sessionSource === 'srs' ? state.srsBox1.size : state.allVocab.length;
            if (val === maxVal) {
                elements.btnCountAll.classList.add('active');
            } else {
                elements.btnCountAll.classList.remove('active');
            }
        });

        // Start Session Button
        elements.btnStartSession.addEventListener('click', startSession);

        // Quit Practice
        elements.btnQuitPractice.addEventListener('click', () => {
            if (confirm('Bạn có chắc muốn thoát phiên học hiện tại?')) {
                endSession(false);
            }
        });

        // Mode 1 Next Button Handler
        if (elements.btnMode1Next) {
            elements.btnMode1Next.addEventListener('click', () => {
                if (elements.mode1NextContainer) {
                    elements.mode1NextContainer.style.display = 'none';
                }
                state.currentIndex++;
                renderQuestion();
            });
        }

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

        // Mode 3 (Vocab Management) Listeners
        if (elements.btnVocabBack) {
            elements.btnVocabBack.addEventListener('click', () => switchScreen('setup'));
        }
        if (elements.btnVocabResetDefault) {
            elements.btnVocabResetDefault.addEventListener('click', handleResetDefaultVocab);
        }
        if (elements.btnAddVocabModal) {
            elements.btnAddVocabModal.addEventListener('click', () => openVocabModal(null));
        }
        if (elements.vocabSearchInput) {
            elements.vocabSearchInput.addEventListener('input', renderVocabList);
        }
        if (elements.btnVocabSearchClear) {
            elements.btnVocabSearchClear.addEventListener('click', () => {
                elements.vocabSearchInput.value = '';
                renderVocabList();
            });
        }
        if (elements.btnCloseVocabModal) {
            elements.btnCloseVocabModal.addEventListener('click', closeVocabModal);
        }
        if (elements.btnCancelVocabModal) {
            elements.btnCancelVocabModal.addEventListener('click', closeVocabModal);
        }
        if (elements.vocabForm) {
            elements.vocabForm.addEventListener('submit', (e) => {
                e.preventDefault();
                handleVocabFormSubmit();
            });
        }
    }

    function switchScreen(screenName) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        if (screenName === 'setup') {
            elements.screenSetup.classList.add('active');
        } else if (screenName === 'practice') {
            elements.screenPractice.classList.add('active');
        } else if (screenName === 'result') {
            elements.screenResult.classList.add('active');
        } else if (screenName === 'vocab-manage') {
            if (elements.screenVocabManage) {
                elements.screenVocabManage.classList.add('active');
            }
            renderVocabList();
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
        if (state.sessionMode === 'mode3') {
            switchScreen('vocab-manage');
            return;
        }

        if (!state.allVocab || state.allVocab.length === 0) {
            alert('Dữ liệu từ vựng chưa sẵn sàng. Vui lòng làm mới trang (F5)!');
            return;
        }

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

        // Select question count from custom input
        let countVal = 10;
        if (elements.inputSessionCount) {
            const rawVal = elements.inputSessionCount.value.trim();
            countVal = parseInt(rawVal, 10);
            if (isNaN(countVal) || countVal < 1) {
                countVal = 10;
            }
        }
        pool = pool.slice(0, Math.min(countVal, pool.length));

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
        state.mode1HasMistake = false;
        if (elements.mode1NextContainer) {
            elements.mode1NextContainer.style.display = 'none';
        }
        
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

        // Pick 10 Distractor words from other vocab items
        const otherItems = state.allVocab.filter(v => v.id !== item.id);
        const distractorWords = [];
        const numDistractors = 10;
        const currentItemAllWords = [item.key_word, ...item.synonyms].map(sanitize);

        let maxAttempts = 300;
        while (distractorWords.length < numDistractors && otherItems.length > 0 && maxAttempts > 0) {
            maxAttempts--;
            const randomItem = otherItems[Math.floor(Math.random() * otherItems.length)];
            const allWordsInItem = [randomItem.key_word, ...randomItem.synonyms];
            const randomWord = allWordsInItem[Math.floor(Math.random() * allWordsInItem.length)];
            const sanitizedRandomWord = sanitize(randomWord);
            if (sanitizedRandomWord && 
                !currentItemAllWords.includes(sanitizedRandomWord) && 
                !distractorWords.some(w => sanitize(w) === sanitizedRandomWord)) {
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
                const isPerfect = !state.mode1HasMistake;
                if (isPerfect) {
                    state.perfectCount++;
                }
                state.resultsLog.push({ item: state.currentQuestion, isPerfect: isPerfect });

                // Show Next Button (user must click Next to advance)
                if (elements.mode1NextContainer) {
                    elements.mode1NextContainer.style.display = 'flex';
                    elements.mode1NextContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
            }
        } else {
            // Wrong selection
            playSound('wrong');
            cardElement.classList.add('wrong');
            state.mode1HasMistake = true;
            
            // Mark item in SRS Box 1 if user made a mistake
            state.srsBox1.add(state.currentQuestion.id);
            saveSrsStorage();

            setTimeout(() => {
                cardElement.classList.remove('wrong');
            }, 500);
        }
    }

    // ----------------------------------------------------------------------
    // ----------------------------------------------------------------------
    // 7. MODE 2: Meaning to Synonyms (Active Recall Keyboard Typing)
    // ----------------------------------------------------------------------
    let mode2ActiveTargets = [];

    function setupMode2(item) {
        state.mode2Revealed.clear();
        state.mode2HintChars.clear();
        state.mode2UsedHint = false;
        state.mode2UsedSkip = false;

        // All target words for this item (key_word + synonyms)
        mode2ActiveTargets = [item.key_word, ...item.synonyms].map(s => s.trim()).filter(Boolean);
        mode2ActiveTargets.forEach(w => {
            state.mode2Revealed.set(w, false);
            state.mode2HintChars.set(w, 0);
        });

        elements.mode2MeaningTitle.textContent = item.meaning;
        elements.mode2FoundNum.textContent = '0';
        elements.mode2TotalNum.textContent = mode2ActiveTargets.length;
        elements.mode2Input.value = '';
        elements.mode2Input.classList.remove('input-error');
        elements.mode2Input.focus();

        // Render Slots Matrix
        renderMode2Slots(mode2ActiveTargets);
    }

    function getSlotClass(targetWord, status) {
        let cls = 'word-slot';
        if (targetWord && targetWord.length > 12) {
            cls += ' slot-long';
        }
        if (status && status !== 'normal') {
            cls += ' ' + status;
        }
        return cls;
    }

    function getHintText(targetWord, hintCount) {
        let nonSpaceRevealed = 0;
        const words = targetWord.split(' ');
        
        const formattedWords = words.map(word => {
            const charArr = [];
            for (let i = 0; i < word.length; i++) {
                const char = word[i];
                if (nonSpaceRevealed < hintCount) {
                    charArr.push(char);
                    nonSpaceRevealed++;
                } else {
                    charArr.push('_');
                }
            }
            return charArr.join(' ');
        });

        return formattedWords.join('\u00A0\u00A0\u00A0');
    }

    function getSlotElementByWord(targetWord) {
        return Array.from(elements.mode2SlotsGrid.children).find(child => child.dataset.word === targetWord);
    }

    function renderMode2Slots(allTargets) {
        elements.mode2SlotsGrid.innerHTML = '';
        allTargets.forEach((targetWord, index) => {
            const isRevealed = state.mode2Revealed.get(targetWord);
            const hintCount = state.mode2HintChars.get(targetWord) || 0;

            let status = 'normal';
            if (isRevealed) {
                status = 'revealed';
            } else if (hintCount > 0) {
                status = 'partial-hint';
            }

            const slot = document.createElement('div');
            slot.className = getSlotClass(targetWord, status);
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
                placeholder.textContent = getHintText(targetWord, hintCount);
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
                    const totalNonSpace = targetWord.replace(/\s+/g, '').length;
                    state.mode2HintChars.set(targetWord, totalNonSpace);
                    playSound('correct');

                    // Update UI slot
                    const slot = getSlotElementByWord(targetWord);
                    if (slot) {
                        const wordIndex = mode2ActiveTargets.indexOf(targetWord) + 1;
                        slot.className = getSlotClass(targetWord, 'revealed');
                        slot.innerHTML = `<span class="slot-index-tag">#${wordIndex}</span><span>${targetWord}</span>`;
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
        // Find first unrevealed word
        let targetWordToHint = null;
        for (const [targetWord, isRevealed] of state.mode2Revealed.entries()) {
            if (!isRevealed) {
                targetWordToHint = targetWord;
                break;
            }
        }

        if (!targetWordToHint) return;

        state.mode2UsedHint = true;
        playSound('hint');

        const totalNonSpace = targetWordToHint.replace(/\s+/g, '').length;
        const currentHintCount = state.mode2HintChars.get(targetWordToHint) || 0;
        const newHintCount = currentHintCount + 1;
        state.mode2HintChars.set(targetWordToHint, newHintCount);

        const slot = getSlotElementByWord(targetWordToHint);
        const wordIndex = mode2ActiveTargets.indexOf(targetWordToHint) + 1;

        if (newHintCount >= totalNonSpace) {
            // Reveal 1 hint word completely
            state.mode2Revealed.set(targetWordToHint, true);

            if (slot) {
                slot.className = getSlotClass(targetWordToHint, 'revealed-hint');
                slot.innerHTML = `<span class="slot-index-tag">#${wordIndex}</span><span>${targetWordToHint}</span>`;
            }
        } else {
            // Partial hint: reveal 1 more character
            if (slot) {
                slot.className = getSlotClass(targetWordToHint, 'partial-hint');
                const hintTextSpan = slot.querySelector('.slot-hint-text');
                if (hintTextSpan) {
                    hintTextSpan.textContent = getHintText(targetWordToHint, newHintCount);
                }
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
            const totalNonSpace = targetWord.replace(/\s+/g, '').length;
            state.mode2HintChars.set(targetWord, totalNonSpace);
            const slot = getSlotElementByWord(targetWord);
            if (slot) {
                const wordIndex = mode2ActiveTargets.indexOf(targetWord) + 1;
                slot.className = getSlotClass(targetWord, 'skipped');
                slot.innerHTML = `<span class="slot-index-tag">#${wordIndex}</span><span>${targetWord}</span>`;
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

    // ----------------------------------------------------------------------
    // 6. Mode 3: Vocabulary Management (CRUD & Search) Logic
    // ----------------------------------------------------------------------
    function renderVocabList() {
        if (!elements.vocabListGrid) return;

        const rawQuery = elements.vocabSearchInput ? elements.vocabSearchInput.value : '';
        const query = sanitize(rawQuery);

        // Show/hide clear search button
        if (elements.btnVocabSearchClear) {
            elements.btnVocabSearchClear.style.display = rawQuery.length > 0 ? 'flex' : 'none';
        }

        // Filter allVocab by id, key_word, meaning, synonyms
        const filtered = state.allVocab.filter(item => {
            if (!query) return true;
            if (String(item.id).includes(query)) return true;
            if (sanitize(item.key_word).includes(query)) return true;
            if (sanitize(item.meaning).includes(query)) return true;
            if (Array.isArray(item.synonyms) && item.synonyms.some(s => sanitize(s).includes(query))) return true;
            return false;
        });

        // Update counters
        if (elements.vocabTotalCount) {
            elements.vocabTotalCount.textContent = state.allVocab.length;
        }
        if (elements.vocabSearchStatsText) {
            elements.vocabSearchStatsText.textContent = `Hiển thị ${filtered.length} / ${state.allVocab.length} từ`;
        }

        elements.vocabListGrid.innerHTML = '';

        if (filtered.length === 0) {
            elements.vocabListGrid.innerHTML = `
                <div class="glass-card" style="grid-column: 1 / -1; padding: 48px 24px; text-align: center; color: var(--text-muted);">
                    <i data-lucide="search-x" style="width: 48px; height: 48px; margin-bottom: 12px; opacity: 0.5;"></i>
                    <p style="font-size: 1.1rem; font-weight: 700; color: var(--text-primary); margin-bottom: 6px;">Không tìm thấy từ vựng phù hợp</p>
                    <span>Không tìm thấy từ nào khớp với từ khóa "${rawQuery}". Vui lòng thử từ khóa khác.</span>
                </div>
            `;
            if (window.lucide) lucide.createIcons();
            return;
        }

        filtered.forEach(item => {
            const card = document.createElement('div');
            card.className = 'vocab-card glass-card';
            card.dataset.id = item.id;

            const synonymChips = (item.synonyms || []).map(syn => `
                <span class="synonym-chip">
                    <span>${syn}</span>
                    <button type="button" class="btn-remove-synonym" data-id="${item.id}" data-syn="${syn.replace(/"/g, '&quot;')}" title="Xóa từ đồng nghĩa '${syn}'">
                        <i data-lucide="x" style="width: 14px; height: 14px;"></i>
                    </button>
                </span>
            `).join('');

            card.innerHTML = `
                <div class="vocab-card-header">
                    <span class="vocab-card-id-badge">ID #${item.id}</span>
                    <div class="vocab-card-actions">
                        <button type="button" class="btn-icon btn-edit-vocab" data-id="${item.id}" title="Sửa thông tin từ này">
                            <i data-lucide="edit-2" style="width: 16px; height: 16px;"></i>
                        </button>
                        <button type="button" class="btn-icon btn-delete-vocab" data-id="${item.id}" title="Xóa từ này" style="color: var(--accent-error);">
                            <i data-lucide="trash-2" style="width: 16px; height: 16px;"></i>
                        </button>
                    </div>
                </div>

                <div class="vocab-card-body">
                    <div class="vocab-card-keyword">${item.key_word}</div>
                    <div class="vocab-card-meaning">${item.meaning}</div>
                </div>

                <div class="vocab-card-synonyms-section">
                    <div class="synonyms-label">
                        <span>Từ đồng nghĩa (${(item.synonyms || []).length})</span>
                    </div>
                    <div class="synonyms-chips-list">
                        ${synonymChips || '<span style="font-size: 0.85rem; color: var(--text-muted); font-style: italic;">Chưa có từ đồng nghĩa</span>'}
                    </div>

                    <form class="quick-add-synonym-form" data-id="${item.id}" onsubmit="return false;">
                        <input type="text" class="quick-add-synonym-input" placeholder="+ Thêm synonym mới..." autocomplete="off">
                        <button type="submit" class="btn-primary btn-sm" style="padding: 6px 12px; border-radius: 14px; font-size: 0.8rem;">
                            <i data-lucide="plus" style="width: 14px; height: 14px;"></i>
                        </button>
                    </form>
                </div>
            `;

            elements.vocabListGrid.appendChild(card);
        });

        if (window.lucide) {
            lucide.createIcons();
        }

        attachVocabCardListeners();
    }

    function attachVocabCardListeners() {
        if (!elements.vocabListGrid) return;

        // Delete synonym button
        elements.vocabListGrid.querySelectorAll('.btn-remove-synonym').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = parseInt(btn.dataset.id, 10);
                const synToRemove = btn.dataset.syn;
                removeSynonymFromWord(id, synToRemove);
            });
        });

        // Quick Add Synonym Form
        elements.vocabListGrid.querySelectorAll('.quick-add-synonym-form').forEach(form => {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                const id = parseInt(form.dataset.id, 10);
                const input = form.querySelector('.quick-add-synonym-input');
                const val = (input ? input.value : '').trim();
                if (val) {
                    addSynonymToWord(id, val);
                    input.value = '';
                }
            });
        });

        // Edit Vocab Button
        elements.vocabListGrid.querySelectorAll('.btn-edit-vocab').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = parseInt(btn.dataset.id, 10);
                const item = state.allVocab.find(v => v.id === id);
                if (item) {
                    openVocabModal(item);
                }
            });
        });

        // Delete Vocab Button
        elements.vocabListGrid.querySelectorAll('.btn-delete-vocab').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = parseInt(btn.dataset.id, 10);
                deleteVocabItem(id);
            });
        });
    }

    function removeSynonymFromWord(id, synToRemove) {
        const item = state.allVocab.find(v => v.id === id);
        if (!item) return;

        if (Array.isArray(item.synonyms)) {
            item.synonyms = item.synonyms.filter(s => s.trim().toLowerCase() !== synToRemove.trim().toLowerCase());
            saveVocabStorage();
            renderVocabList();
        }
    }

    function addSynonymToWord(id, newSynonym) {
        const item = state.allVocab.find(v => v.id === id);
        if (!item) return;

        if (!Array.isArray(item.synonyms)) {
            item.synonyms = [];
        }

        const trimmed = newSynonym.trim();
        if (!trimmed) return;

        const exists = item.synonyms.some(s => s.trim().toLowerCase() === trimmed.toLowerCase());
        if (exists) {
            alert(`Từ đồng nghĩa "${trimmed}" đã tồn tại trong từ này.`);
            return;
        }

        item.synonyms.push(trimmed);
        saveVocabStorage();
        renderVocabList();
    }

    function deleteVocabItem(id) {
        const item = state.allVocab.find(v => v.id === id);
        if (!item) return;

        if (confirm(`Bạn có chắc chắn muốn xóa từ ID #${item.id} (${item.key_word})?`)) {
            state.allVocab = state.allVocab.filter(v => v.id !== id);
            saveVocabStorage();
            renderVocabList();
        }
    }

    function openVocabModal(itemToEdit = null) {
        state.vocabEditItem = itemToEdit;
        if (itemToEdit) {
            elements.modalVocabTitle.innerHTML = `<i data-lucide="edit-3"></i> Chỉnh Sửa Từ Vựng (ID #${itemToEdit.id})`;
            elements.inputVocabEditId.value = itemToEdit.id;
            elements.inputVocabKeyword.value = itemToEdit.key_word || '';
            elements.inputVocabMeaning.value = itemToEdit.meaning || '';
            elements.inputVocabSynonyms.value = (itemToEdit.synonyms || []).join(', ');
        } else {
            elements.modalVocabTitle.innerHTML = `<i data-lucide="plus-circle"></i> Thêm Từ Vựng Mới`;
            elements.inputVocabEditId.value = '';
            elements.inputVocabKeyword.value = '';
            elements.inputVocabMeaning.value = '';
            elements.inputVocabSynonyms.value = '';
        }

        if (window.lucide) lucide.createIcons();
        elements.modalVocabForm.style.display = 'flex';
        elements.inputVocabKeyword.focus();
    }

    function closeVocabModal() {
        elements.modalVocabForm.style.display = 'none';
        state.vocabEditItem = null;
    }

    function handleVocabFormSubmit() {
        const keyword = elements.inputVocabKeyword.value.trim();
        const meaning = elements.inputVocabMeaning.value.trim();
        const rawSynonyms = elements.inputVocabSynonyms.value.trim();

        if (!keyword || !meaning) {
            alert('Vui lòng điền đầy đủ Từ khóa và Nghĩa Tiếng Việt.');
            return;
        }

        const synonyms = rawSynonyms
            ? rawSynonyms.split(',').map(s => s.trim()).filter(s => s.length > 0)
            : [];

        const editIdRaw = elements.inputVocabEditId.value;

        if (editIdRaw) {
            // Edit existing word
            const editId = parseInt(editIdRaw, 10);
            const item = state.allVocab.find(v => v.id === editId);
            if (item) {
                item.key_word = keyword;
                item.meaning = meaning;
                item.synonyms = synonyms;
            }
        } else {
            // Add new word
            const maxId = state.allVocab.reduce((max, v) => (v.id > max ? v.id : max), 0);
            const newId = maxId + 1;

            const newItem = {
                id: newId,
                meaning: meaning,
                key_word: keyword,
                synonyms: synonyms
            };
            state.allVocab.push(newItem);
        }

        saveVocabStorage();
        closeVocabModal();
        renderVocabList();
    }

    function handleResetDefaultVocab() {
        if (confirm('Bạn có chắc chắn muốn khôi phục lại danh sách 151 từ vựng mặc định ban đầu? Tất cả các chỉnh sửa tùy chỉnh sẽ bị xóa.')) {
            localStorage.removeItem('toeic_vocab_custom_data');
            if (window.TOEIC_VOCAB_DATA && Array.isArray(window.TOEIC_VOCAB_DATA)) {
                state.allVocab = JSON.parse(JSON.stringify(window.TOEIC_VOCAB_DATA));
            }
            saveVocabStorage();
            renderVocabList();
            alert('Đã khôi phục dữ liệu từ vựng mặc định thành công!');
        }
    }

    // Initialize Application
    init();
});
