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
    
    // Areas and Navigation
    const categoryArea = document.getElementById('category-area');
    const categoryGrid = document.getElementById('category-grid');
    const selectAllBtn = document.getElementById('select-all-btn');
    const clearAllBtn = document.getElementById('clear-all-btn');
    const continueToModesBtn = document.getElementById('continue-to-modes-btn');
    const categoryErrorMessage = document.getElementById('category-error-message');
    const backToCategoriesBtn = document.getElementById('back-to-categories-btn');

    const menuArea = document.getElementById('menu-area');
    const gameArea = document.getElementById('game-area');
    const backToMenuBtn = document.getElementById('back-to-menu-btn');
    const modeBtns = document.querySelectorAll('.mode-btn');

    // Answer Validation DOM Elements
    const answerInput = document.getElementById('answer-input');
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
        'type4': 'קרא עברית, כתוב אנגלית'
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
                    scores: { type1: 0, type2: 0, type3: 0, type4: 0 },
                    wordStats: { type1: {}, type2: {}, type3: {}, type4: {} }
                };
                this.saveUsers(users);
            } else {
                // Version 3 Migration (Reset old scores)
                if (users[userKey].version !== 3) {
                    users[userKey].version = 3;
                    users[userKey].scores = { type1: 0, type2: 0, type3: 0, type4: 0 };
                    users[userKey].wordStats = { type1: {}, type2: {}, type3: {}, type4: {} };
                    delete users[userKey].progress;
                    delete users[userKey].points;
                    delete users[userKey].currentWordIndex;
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
        availableCategories.forEach(cat => selectedCategories.add(cat)); // Select all by default
        renderCategoryGrid();
    }

    function renderCategoryGrid() {
        categoryGrid.innerHTML = '';
        availableCategories.forEach(cat => {
            const btn = document.createElement('button');
            btn.className = `category-btn ${selectedCategories.has(cat) ? 'selected' : ''}`;
            btn.textContent = cat;
            btn.addEventListener('click', () => {
                 if (selectedCategories.has(cat)) {
                     selectedCategories.delete(cat);
                     btn.classList.remove('selected');
                 } else {
                     selectedCategories.add(cat);
                     btn.classList.add('selected');
                 }
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

        // Show Categories, not menu or game
        categoryArea.classList.remove('hidden');
        menuArea.classList.add('hidden');
        gameArea.classList.add('hidden');
        currentModeTitleEl.classList.add('hidden');
        currentQuestionType = null;

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
    }

    function backToCategories() {
        menuArea.classList.add('hidden');
        categoryArea.classList.remove('hidden');
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
                document.getElementById('score-type1').textContent = currentUser.scores['type1'];
                document.getElementById('score-type2').textContent = currentUser.scores['type2'];
                document.getElementById('score-type3').textContent = currentUser.scores['type3'];
                document.getElementById('score-type4').textContent = currentUser.scores['type4'];
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

        if (currentQuestionType === 'type1' || currentQuestionType === 'type3') {
            // Audio prompt
            promptDisplayEl.innerText = 'הקשב! / Listen!';
            playAudioPromptBtn.classList.remove('hidden');
            // Auto play audio once shortly after loading
            setTimeout(() => speakEnglishWord(word.english), 500);
        } else if (currentQuestionType === 'type2') {
            // English written prompt
            promptDisplayEl.innerText = word.english;
        } else if (currentQuestionType === 'type4') {
            // Hebrew written prompt
            promptDisplayEl.innerText = word.hebrew;
        }

        // Setup the revelation text if they give up
        answerRevealDisplayEl.innerText = (currentQuestionType === 'type1' || currentQuestionType === 'type2') ? word.hebrew : word.english;

        // Setup input 
        if (currentQuestionType === 'type1' || currentQuestionType === 'type2') {
            answerInput.placeholder = "הקלד כאן בכתב...";
            answerInput.dir = "rtl";
        } else {
            answerInput.placeholder = "Type here...";
            answerInput.dir = "ltr";
        }

        // Reset state
        isWordSolved = false;
        answerRevealDisplayEl.classList.remove('visible');
        answerRevealDisplayEl.classList.add('hidden');

        answerInput.value = '';
        answerInput.disabled = false;
        answerInput.classList.remove('correct', 'incorrect');
        answerInput.focus();

        feedbackMessage.textContent = '';
        feedbackMessage.className = 'message'; 

        checkBtn.classList.remove('hidden');
        giveUpBtn.classList.remove('hidden');
        nextBtn.classList.add('hidden');
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

        const wordId = currentFilteredWords[currentWordIndex].english;
        UserManager.updateWordStats(currentUser.name, currentQuestionType, wordId, false);

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
    }

    // --- Event Listeners ---
    speakBtn.addEventListener('click', speakEnglish);
    playAudioPromptBtn.addEventListener('click', speakEnglish);
    nextBtn.addEventListener('click', nextWord);

    selectAllBtn.addEventListener('click', () => {
        availableCategories.forEach(cat => selectedCategories.add(cat));
        renderCategoryGrid();
        categoryErrorMessage.classList.add('hidden');
    });

    clearAllBtn.addEventListener('click', () => {
        selectedCategories.clear();
        renderCategoryGrid();
    });

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
