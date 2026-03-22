document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const promptDisplayEl = document.getElementById('prompt-display');
    const answerRevealDisplayEl = document.getElementById('answer-reveal-display');
    const speakBtn = document.getElementById('speak-btn');
    const nextBtn = document.getElementById('next-btn');
    const playAudioPromptBtn = document.getElementById('play-audio-prompt-btn');

    // Menu & User Management DOM Elements
    const loginOverlay = document.getElementById('login-overlay');
    const usernameInput = document.getElementById('username-input');
    const loginBtn = document.getElementById('login-btn');
    const loginMessage = document.getElementById('login-message');
    const userBar = document.getElementById('user-bar');
    const currentUsernameEl = document.getElementById('current-username');
    const pointsValueEl = document.getElementById('points-value');
    const userPointsEl = document.getElementById('user-points');
    const logoutBtn = document.getElementById('logout-btn');
    const currentModeTitleEl = document.getElementById('current-mode-title');
    const mainTitleEl = document.getElementById('main-title');
    const mainSubtitleEl = document.getElementById('main-subtitle');
    
    // Areas and Navigation
    const categoryArea = document.getElementById('category-area');
    const categoryGrid = document.getElementById('category-grid');
    const continueToModesBtn = document.getElementById('continue-to-modes-btn');
    const categoryErrorMessage = document.getElementById('category-error-message');
    const backToCategoriesBtn = document.getElementById('back-to-categories-btn');

    const menuArea = document.getElementById('menu-area');
    const gameArea = document.getElementById('game-area');
    const backToMenuBtn = document.getElementById('back-to-menu-btn');
    const modeBtns = document.querySelectorAll('.mode-btn');

    // Answer Validation DOM Elements
    const answerInput = document.getElementById('answer-input');
    const textInputContainer = document.getElementById('text-input-container');
    const optionsContainer = document.getElementById('options-container');
    const checkBtn = document.getElementById('check-btn');
    const giveUpBtn = document.getElementById('give-up-btn');
    const feedbackMessage = document.getElementById('feedback-message');

    // --- Configuration ---
    const POINTS_CORRECT = 10;
    const POINTS_INCORRECT_PENALTY = 2; // Positive value to subtract

    // --- State ---
    let currentUser = null;
    let isWordSolved = false;
    let currentQuestionType = null; // 'type1', 'type2', 'type3', 'type4'
    let currentWordIndex = 0;
    const MODE_TITLES = {
        'type1': 'שמע אנגלית, כתוב עברית',
        'type2': 'קרא אנגלית, כתוב עברית',
        'type3': 'שמע אנגלית, כתוב אנגלית',
        'type4': 'קרא עברית, כתוב אנגלית',
        'type5': 'שמע אנגלית, בחר עברית',
        'type6': 'קרא אנגלית, בחר עברית',
        'type7': 'שמע אנגלית, בחר אנגלית',
        'type8': 'קרא עברית, בחר אנגלית'
    };
    
    // Category State
    let availableCategories = [];
    let selectedCategories = new Set();
    let currentFilteredWords = [];

    // --- Sound Logic ---
    const SoundManager = {
        ctx: null,

        init() {
            if (!this.ctx) {
                this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            }
        },

        playTone(freq, type, duration, startTime = 0) {
            this.init();
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = type;
            osc.frequency.setValueAtTime(freq, this.ctx.currentTime + startTime);

            gain.gain.setValueAtTime(0.1, this.ctx.currentTime + startTime);
            gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + startTime + duration);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(this.ctx.currentTime + startTime);
            osc.stop(this.ctx.currentTime + startTime + duration);
        },

        playSuccess() {
            this.playTone(523.25, 'sine', 0.1, 0);
            this.playTone(659.25, 'sine', 0.1, 0.1);
            this.playTone(783.99, 'sine', 0.3, 0.2);
        },

        playFailure() {
            this.playTone(200, 'sawtooth', 0.2, 0);
            this.playTone(150, 'sawtooth', 0.4, 0.15);
        }
    };

    // --- User Management Logic ---
    const UserManager = {
        getUsers() {
            const users = localStorage.getItem('englishAppUsers');
            return users ? JSON.parse(users) : {};
        },

        saveUsers(users) {
            localStorage.setItem('englishAppUsers', JSON.stringify(users));
        },

        getLastUser() {
            return localStorage.getItem('englishAppLastUser');
        },

        saveLastUser(username) {
            localStorage.setItem('englishAppLastUser', username);
        },

        login(username) {
            const users = this.getUsers();
            const normalizedName = username.trim().toLowerCase();

            if (!normalizedName) return null;

            let userKey = Object.keys(users).find(k => k.toLowerCase() === normalizedName);
            let isNew = false;

            if (!userKey) {
                // Create new user
                isNew = true;
                userKey = username.trim(); 
                users[userKey] = {
                    name: userKey,
                    version: 3,
                    scores: { type1: 0, type2: 0, type3: 0, type4: 0, type5: 0, type6: 0, type7: 0, type8: 0 },
                    wordStats: { type1: {}, type2: {}, type3: {}, type4: {}, type5: {}, type6: {}, type7: {}, type8: {} }
                };
                this.saveUsers(users);
            } else {
                // Version 3 Migration (Reset old scores)
                if (users[userKey].version !== 3) {
                    users[userKey].version = 3;
                    users[userKey].scores = { type1: 0, type2: 0, type3: 0, type4: 0, type5: 0, type6: 0, type7: 0, type8: 0 };
                    users[userKey].wordStats = { type1: {}, type2: {}, type3: {}, type4: {}, type5: {}, type6: {}, type7: {}, type8: {} };
                    delete users[userKey].progress;
                    delete users[userKey].points;
                    delete users[userKey].currentWordIndex;
                    this.saveUsers(users);
                } else {
                    // Update for type5-8 without resetting if already v3
                    for (let i = 5; i <= 8; i++) {
                        if (users[userKey].scores['type' + i] === undefined) {
                            users[userKey].scores['type' + i] = 0;
                            users[userKey].wordStats['type' + i] = {};
                        }
                    }
                    this.saveUsers(users);
                }
            }

            this.saveLastUser(userKey); 
            return { user: users[userKey], isNew };
        },

        updateWordStats(username, type, wordId, isCorrect) {
            const users = this.getUsers();
            if (users[username]) {
                if (!users[username].wordStats[type]) {
                    users[username].wordStats[type] = {};
                }
                const stats = users[username].wordStats[type][wordId] || { history: [] };
                if (!stats.history) stats.history = [];
                stats.history.push(isCorrect);
                if (stats.history.length > 5) {
                    stats.history.shift();
                }
                users[username].wordStats[type][wordId] = stats;
                this.saveUsers(users);
                
                if (currentUser && currentUser.name === username) {
                    currentUser.wordStats = users[username].wordStats;
                }
            }
        },

        updatePoints(username, type, newPoints) {
            const users = this.getUsers();
            if (users[username]) {
                users[username].scores[type] = newPoints;
                this.saveUsers(users);
            }
        },

        logout() {
            localStorage.removeItem('englishAppLastUser');
        }
    };

    // --- Category Logic ---
    function initCategories() {
        const categoriesSet = new Set();
        wordsData.forEach(w => categoriesSet.add(w.category));
        availableCategories = Array.from(categoriesSet);
        if (availableCategories.length > 0) {
            selectedCategories.add(availableCategories[0]); // Select first by default
        }
        renderCategoryGrid();
    }

    function renderCategoryGrid() {
        categoryGrid.innerHTML = '';
        availableCategories.forEach(cat => {
            const btn = document.createElement('button');
            btn.className = `category-btn ${selectedCategories.has(cat) ? 'selected' : ''}`;
            btn.textContent = cat;
            btn.addEventListener('click', () => {
                 selectedCategories.clear();
                 selectedCategories.add(cat);
                 renderCategoryGrid();
                 categoryErrorMessage.classList.add('hidden');
            });
            categoryGrid.appendChild(btn);
        });
    }

    // --- Game Logic ---

    function loadGameForUser(user) {
        currentUser = user;

        // Update UI
        currentUsernameEl.textContent = currentUser.name;
        
        loginOverlay.classList.add('hidden');
        userBar.classList.remove('hidden');
        
        if (availableCategories.length === 0) {
            initCategories();
        }

        categoryArea.classList.remove('hidden');
        menuArea.classList.add('hidden');
        gameArea.classList.add('hidden');
        currentModeTitleEl.classList.add('hidden');
        currentQuestionType = null;

        mainTitleEl.textContent = "🎈 לומדים אנגלית בכיף 🎈";
        mainSubtitleEl.classList.remove('hidden');

        updatePointsDisplay();

        // Initialize sound context on user interaction
        SoundManager.init();
    }

    function continueToModes() {
        if (selectedCategories.size === 0) {
            categoryErrorMessage.classList.remove('hidden');
            return;
        }
        categoryErrorMessage.classList.add('hidden');
        
        // Filter words based on selection
        currentFilteredWords = wordsData.filter(w => selectedCategories.has(w.category));
        
        categoryArea.classList.add('hidden');
        menuArea.classList.remove('hidden');

        const selectedCat = Array.from(selectedCategories)[0];
        mainTitleEl.textContent = selectedCat;
        mainSubtitleEl.classList.add('hidden');
    }

    function backToCategories() {
        menuArea.classList.add('hidden');
        categoryArea.classList.remove('hidden');
        
        mainTitleEl.textContent = "🎈 לומדים אנגלית בכיף 🎈";
        mainSubtitleEl.classList.remove('hidden');
    }

    function selectMode(type) {
        currentQuestionType = type;
        
        menuArea.classList.add('hidden');
        gameArea.classList.remove('hidden');
        
        currentModeTitleEl.classList.remove('hidden');
        currentModeTitleEl.textContent = MODE_TITLES[type];
        
        updatePointsDisplay();

        currentWordIndex = getNextWordIndex(currentQuestionType);
        loadWord(currentWordIndex);
        SoundManager.init();
    }

    function backToMenu() {
        gameArea.classList.add('hidden');
        menuArea.classList.remove('hidden');
        currentModeTitleEl.classList.add('hidden');
        currentQuestionType = null;
        updatePointsDisplay(); 
    }

    function updatePointsDisplay() {
        if (currentUser) {
            if (currentQuestionType) {
                userPointsEl.classList.remove('hidden');
                pointsValueEl.textContent = currentUser.scores[currentQuestionType];
            } else {
                // Menu View: show individual scores, hide total
                userPointsEl.classList.add('hidden');
                for (let i = 1; i <= 8; i++) {
                    const el = document.getElementById('score-type' + i);
                    if (el) el.textContent = currentUser.scores['type' + i] || 0;
                }
            }
        }
    }

    function loadWord(index) {
        const word = currentFilteredWords[index];
        const wordStatsDisplayEl = document.getElementById('word-stats-display');
        
        // Show success stats
        if (currentUser && currentUser.wordStats[currentQuestionType]) {
            const stats = currentUser.wordStats[currentQuestionType][word.english] || { history: [] };
            const history = stats.history || [];
            const total = history.length;
            if (total > 0) {
                const correctCount = history.filter(h => h).length;
                const percent = Math.round((correctCount / total) * 100);
                wordStatsDisplayEl.textContent = `📊 הצלחות (5 אחרונות): ${correctCount}/${total} (${percent}%)`;
                wordStatsDisplayEl.classList.remove('hidden');
            } else {
                wordStatsDisplayEl.textContent = `📊 מילה חדשה / New`;
                wordStatsDisplayEl.classList.remove('hidden');
            }
        } else {
            if (wordStatsDisplayEl) wordStatsDisplayEl.classList.add('hidden');
        }

        // Setup prompt based on mode
        playAudioPromptBtn.classList.add('hidden');
        promptDisplayEl.classList.remove('hidden');
        speakBtn.classList.add('hidden');

        const isAudioPrompt = ['type1', 'type3', 'type5', 'type7'].includes(currentQuestionType);
        const isEnglishWrittenPrompt = ['type2', 'type6'].includes(currentQuestionType);
        const isHebrewWrittenPrompt = ['type4', 'type8'].includes(currentQuestionType);
        const isHebrewAnswer = ['type1', 'type2', 'type5', 'type6'].includes(currentQuestionType);
        const isMultipleChoice = ['type5', 'type6', 'type7', 'type8'].includes(currentQuestionType);

        if (isAudioPrompt) {
            promptDisplayEl.innerText = 'הקשב! / Listen!';
            playAudioPromptBtn.classList.remove('hidden');
            setTimeout(() => speakEnglishWord(word.english), 500);
        } else if (isEnglishWrittenPrompt) {
            promptDisplayEl.innerText = word.english;
        } else if (isHebrewWrittenPrompt) {
            promptDisplayEl.innerText = word.hebrew;
        }

        answerRevealDisplayEl.innerText = isHebrewAnswer ? word.hebrew : word.english;

        if (isMultipleChoice) {
            textInputContainer.classList.add('hidden');
            checkBtn.classList.add('hidden');
            optionsContainer.classList.remove('hidden');
            optionsContainer.innerHTML = '';
            
            let options = [word];
            const otherWords = currentFilteredWords.filter(w => w.english !== word.english);
            const shuffledOthers = otherWords.sort(() => 0.5 - Math.random());
            const wrongOptions = shuffledOthers.slice(0, 3);
            options = options.concat(wrongOptions);
            options.sort(() => 0.5 - Math.random());
            
            options.forEach(opt => {
                const btn = document.createElement('button');
                btn.className = 'option-btn' + (isHebrewAnswer ? ' hebrew-text' : '');
                btn.textContent = isHebrewAnswer ? opt.hebrew : opt.english;
                btn.addEventListener('click', () => handleOptionClick(btn, opt.english === word.english));
                optionsContainer.appendChild(btn);
            });
            
        } else {
            textInputContainer.classList.remove('hidden');
            checkBtn.classList.remove('hidden');
            optionsContainer.classList.add('hidden');
            
            if (isHebrewAnswer) {
                answerInput.placeholder = "הקלד כאן בכתב...";
                answerInput.dir = "rtl";
            } else {
                answerInput.placeholder = "Type here...";
                answerInput.dir = "ltr";
            }
            answerInput.value = '';
            answerInput.disabled = false;
            answerInput.classList.remove('correct', 'incorrect');
            answerInput.focus();
        }

        // Reset state
        isWordSolved = false;
        answerRevealDisplayEl.classList.remove('visible');
        answerRevealDisplayEl.classList.add('hidden');

        feedbackMessage.textContent = '';
        feedbackMessage.className = 'message'; 

        giveUpBtn.classList.remove('hidden');
        nextBtn.classList.add('hidden');
    }

    function handleOptionClick(clickedBtn, isCorrect) {
        if (!currentUser || isWordSolved || !currentQuestionType) return;
        SoundManager.init();
        
        const btns = optionsContainer.querySelectorAll('.option-btn');
        btns.forEach(b => b.disabled = true);
        
        if (isCorrect) {
            clickedBtn.classList.add('correct');
            handleCorrectAnswer();
        } else {
            clickedBtn.classList.add('incorrect');
            handleIncorrectAnswer();
            const word = currentFilteredWords[currentWordIndex];
            const isHebrewAnswer = ['type1', 'type2', 'type5', 'type6'].includes(currentQuestionType);
            const correctText = isHebrewAnswer ? word.hebrew : word.english;
            btns.forEach(b => {
                if (b.textContent === correctText) b.classList.add('correct');
            });
        }
    }

    function speakEnglishWord(text) {
        if (!currentUser) return;
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'en-US';
        speechSynthesis.speak(utterance);
    }

    function speakEnglish() {
        if (!currentUser || !currentQuestionType) return; 
        const word = currentFilteredWords[currentWordIndex].english;
        speakEnglishWord(word);
    }

    function checkAnswer() {
        if (!currentUser || isWordSolved || !currentQuestionType) return;
        SoundManager.init();

        const userAnswer = answerInput.value.trim().toLowerCase();
        const word = currentFilteredWords[currentWordIndex];
        let correctAnswer = '';

        if (currentQuestionType === 'type1' || currentQuestionType === 'type2') {
            correctAnswer = word.hebrew.trim();
        } else {
            correctAnswer = word.english.trim().toLowerCase();
        }

        if (userAnswer === correctAnswer) {
            handleCorrectAnswer();
        } else {
            handleIncorrectAnswer();
        }
    }

    function handleCorrectAnswer() {
        isWordSolved = true;
        SoundManager.playSuccess();

        const wordId = currentFilteredWords[currentWordIndex].english;
        UserManager.updateWordStats(currentUser.name, currentQuestionType, wordId, true);

        // Update points
        currentUser.scores[currentQuestionType] += POINTS_CORRECT;
        UserManager.updatePoints(currentUser.name, currentQuestionType, currentUser.scores[currentQuestionType]);
        updatePointsDisplay();

        // UI Updates
        answerInput.classList.add('correct');
        answerInput.classList.remove('incorrect');
        answerInput.disabled = true;

        feedbackMessage.textContent = "מצוין! / Excellent!";
        feedbackMessage.classList.add('success-text');

        checkBtn.classList.add('hidden');
        giveUpBtn.classList.add('hidden');
        nextBtn.classList.remove('hidden');
        nextBtn.focus();

        // Fun effects
        const card = document.querySelector('.card');
        card.classList.add('pop-animation');
        setTimeout(() => card.classList.remove('pop-animation'), 300);
    }

    function handleIncorrectAnswer() {
        SoundManager.playFailure();

        const wordId = currentFilteredWords[currentWordIndex].english;
        UserManager.updateWordStats(currentUser.name, currentQuestionType, wordId, false);

        // Penalty points
        if (currentUser.scores[currentQuestionType] > 0) {
            currentUser.scores[currentQuestionType] = Math.max(0, currentUser.scores[currentQuestionType] - POINTS_INCORRECT_PENALTY);
            UserManager.updatePoints(currentUser.name, currentQuestionType, currentUser.scores[currentQuestionType]);
            updatePointsDisplay();
        }

        // Reveal Answer
        isWordSolved = true;
        answerRevealDisplayEl.classList.remove('hidden');
        answerRevealDisplayEl.classList.add('visible');

        const word = currentFilteredWords[currentWordIndex];
        
        if (currentQuestionType === 'type1' || currentQuestionType === 'type2') {
             answerInput.value = word.hebrew;
        } else {
             answerInput.value = word.english;
             if (currentQuestionType === 'type4') speakEnglishWord(word.english);
        }

        answerInput.disabled = true;
        answerInput.classList.add('incorrect');
        
        feedbackMessage.textContent = "טעות, הנה התשובה / Incorrect, here is the answer";
        feedbackMessage.classList.remove('success-text');
        feedbackMessage.classList.add('error-text');

        checkBtn.classList.add('hidden');
        giveUpBtn.classList.add('hidden');
        nextBtn.classList.remove('hidden');
        nextBtn.focus();
    }

    function giveUp() {
        if (!currentUser || isWordSolved || !currentQuestionType) return;
        isWordSolved = true;

        const btns = optionsContainer.querySelectorAll('.option-btn');
        const word = currentFilteredWords[currentWordIndex];
        const isHebrewAnswer = ['type1', 'type2', 'type5', 'type6'].includes(currentQuestionType);
        const correctText = isHebrewAnswer ? word.hebrew : word.english;
        btns.forEach(b => {
             b.disabled = true;
             if (b.textContent === correctText) {
                 b.classList.add('correct');
             }
        });

        const wordId = word.english;
        UserManager.updateWordStats(currentUser.name, currentQuestionType, wordId, false);

        answerRevealDisplayEl.classList.remove('hidden');
        answerRevealDisplayEl.classList.add('visible');
        
        if (isHebrewAnswer) {
             answerInput.value = word.hebrew;
        } else {
             answerInput.value = word.english;
             if (currentQuestionType === 'type4' || currentQuestionType === 'type8') speakEnglishWord(word.english);
        }

        answerInput.disabled = true;
        feedbackMessage.textContent = "";

        checkBtn.classList.add('hidden');
        giveUpBtn.classList.add('hidden');
        nextBtn.classList.remove('hidden');
    }

    function getNextWordIndex(type) {
        if (currentFilteredWords.length === 0) return 0;
        if (currentFilteredWords.length === 1) return 0;

        let totalWeight = 0;
        const weights = currentFilteredWords.map((word, index) => {
            const stats = currentUser.wordStats[type][word.english] || { history: [] };
            const history = stats.history || [];
            const total = history.length;
            
            let weight = 10; // Base weight for new unseen words
            
            if (total > 0) {
                const correctCount = history.filter(h => h).length;
                const successRate = correctCount / total; 
                // Extreme priority for words with low success rates!
                // 0% success = weight 100
                // 100% success = weight 1
                if (successRate === 1) {
                    weight = 1;
                } else {
                    weight = Math.round(100 * (1 - successRate));
                }
            }
            
            // Decrease probability of exact same word appearing again immediately
            if (index === currentWordIndex) {
                weight = 0;
            }

            totalWeight += weight;
            return weight;
        });

        if (totalWeight <= 0) return 0;

        let randomVal = Math.random() * totalWeight;
        for (let i = 0; i < weights.length; i++) {
            randomVal -= weights[i];
            if (randomVal <= 0) {
                return i;
            }
        }
        return weights.length - 1;
    }

    function nextWord() {
        if (!currentUser || !currentQuestionType) return;
        currentWordIndex = getNextWordIndex(currentQuestionType);
        loadWord(currentWordIndex);
    }

    function handleLogin() {
        const username = usernameInput.value;
        if (!username) return;

        const result = UserManager.login(username);

        if (result.isNew) {
            loginMessage.textContent = "משתמש חדש נוצר! / New user created!";
            loginMessage.style.color = "var(--success-color)";
        } else {
            loginMessage.textContent = `ברוך שובך, ${result.user.name}! / Welcome back!`;
            loginMessage.style.color = "var(--primary-color)";
        }

        setTimeout(() => {
            loadGameForUser(result.user);
            usernameInput.value = ''; 
            loginMessage.textContent = '';
        }, 1000);
    }

    function handleLogout() {
        UserManager.logout();
        currentUser = null;
        currentQuestionType = null;
        
        userBar.classList.add('hidden');
        categoryArea.classList.add('hidden');
        menuArea.classList.add('hidden');
        gameArea.classList.add('hidden');
        loginOverlay.classList.remove('hidden');
        
        promptDisplayEl.innerText = '...';
        
        mainTitleEl.textContent = "🎈 לומדים אנגלית בכיף 🎈";
        mainSubtitleEl.classList.remove('hidden');
    }

    // --- Event Listeners ---
    speakBtn.addEventListener('click', speakEnglish);
    playAudioPromptBtn.addEventListener('click', speakEnglish);
    nextBtn.addEventListener('click', nextWord);

    continueToModesBtn.addEventListener('click', continueToModes);
    backToCategoriesBtn.addEventListener('click', backToCategories);

    modeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            selectMode(btn.dataset.mode);
        });
    });
    
    backToMenuBtn.addEventListener('click', backToMenu);

    loginBtn.addEventListener('click', handleLogin);
    usernameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleLogin();
    });

    logoutBtn.addEventListener('click', handleLogout);

    // Answer Validation Listeners
    checkBtn.addEventListener('click', checkAnswer);
    giveUpBtn.addEventListener('click', giveUp);
    answerInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') checkAnswer();
    });

    // Initial state check
    const lastUser = UserManager.getLastUser();
    if (lastUser) {
        const result = UserManager.login(lastUser);
        if (result && !result.isNew) {
            loadGameForUser(result.user);
        }
    }
});
