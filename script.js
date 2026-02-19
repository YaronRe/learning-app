document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const hebrewEl = document.getElementById('hebrew-word');
    const englishEl = document.getElementById('english-word');
    const speakBtn = document.getElementById('speak-btn');
    const nextBtn = document.getElementById('next-btn');

    // User Management DOM Elements
    const loginOverlay = document.getElementById('login-overlay');
    const usernameInput = document.getElementById('username-input');
    const loginBtn = document.getElementById('login-btn');
    const loginMessage = document.getElementById('login-message');
    const userBar = document.getElementById('user-bar');
    const currentUsernameEl = document.getElementById('current-username');
    const pointsValueEl = document.getElementById('points-value');
    const logoutBtn = document.getElementById('logout-btn');

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
            // High pitched major arpeggio (C5, E5, G5)
            this.playTone(523.25, 'sine', 0.1, 0);
            this.playTone(659.25, 'sine', 0.1, 0.1);
            this.playTone(783.99, 'sine', 0.3, 0.2);
        },

        playFailure() {
            // Low pitched descending tritone
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

            // Find existing user (case-insensitive check but store display name)
            let userKey = Object.keys(users).find(k => k.toLowerCase() === normalizedName);
            let isNew = false;

            if (!userKey) {
                // Create new user
                isNew = true;
                userKey = username.trim(); // Store original casing
                users[userKey] = {
                    name: userKey,
                    currentWordIndex: 0,
                    points: 0
                };
                this.saveUsers(users);
            } else {
                // Legacy support: Ensure points exist
                if (typeof users[userKey].points === 'undefined') {
                    users[userKey].points = 0;
                    this.saveUsers(users);
                }
            }

            this.saveLastUser(userKey); // Persist session
            return { user: users[userKey], isNew };
        },

        updateProgress(username, index) {
            const users = this.getUsers();
            if (users[username]) {
                users[username].currentWordIndex = index;
                this.saveUsers(users);
            }
        },

        updatePoints(username, newPoints) {
            const users = this.getUsers();
            if (users[username]) {
                users[username].points = newPoints;
                this.saveUsers(users);
            }
        },

        logout() {
            localStorage.removeItem('englishAppLastUser');
        }
    };

    // --- Game Logic ---

    // Shuffle words on load (we might want to re-shuffle or keep order? 
    // For now, let's shuffle ONCE globally or just keep the order to make progress meaningful.
    // If we want "progress" to mean "index in the array", the array order must be constant or saved.
    // The original code shuffled on load. If I shuffle every time, the index is meaningless for persistence across reloads.
    // DECISION: To support progress persistence, we should NOT shuffle, or shuffle in a deterministic way (seeded), 
    // or store the shuffled order. For a kids app, fixed order (or categories) is often better, or simple random pick.
    // However, the requirement is "save progress". "Progress" usually implies a sequence.
    // Let's remove the shuffle for now to ensure index is consistent.
    // shuffleArray(wordsData); // REMOVED for persistence consistency in this simple version

    function loadGameForUser(user) {
        currentUser = user;

        // Update UI
        currentUsernameEl.textContent = currentUser.name;
        updatePointsDisplay();

        loginOverlay.classList.add('hidden');
        userBar.classList.remove('hidden');

        // Restore progress
        // Ensure index is within bounds (in case wordsData changed)
        if (currentUser.currentWordIndex >= wordsData.length) {
            currentUser.currentWordIndex = 0;
        }

        loadWord(currentUser.currentWordIndex);

        // Initialize sound context on user interaction (login/load)
        SoundManager.init();
    }

    function updatePointsDisplay() {
        if (currentUser) {
            pointsValueEl.textContent = currentUser.points;
        }
    }

    function loadWord(index) {
        const word = wordsData[index];
        hebrewEl.innerText = word.hebrew;
        englishEl.innerText = word.english;

        // Reset state
        isWordSolved = false;
        englishEl.classList.remove('visible');
        englishEl.classList.add('hidden');

        answerInput.value = '';
        answerInput.disabled = false;
        answerInput.classList.remove('correct', 'incorrect');
        answerInput.focus();

        feedbackMessage.textContent = '';
        feedbackMessage.className = 'message'; // Reset classes

        checkBtn.classList.remove('hidden');
        giveUpBtn.classList.remove('hidden');
        nextBtn.classList.add('hidden');
    }

    function speakEnglish() {
        if (!currentUser) return; // Block interaction if not logged in
        const word = wordsData[currentUser.currentWordIndex].english;
        const utterance = new SpeechSynthesisUtterance(word);
        utterance.lang = 'en-US';
        speechSynthesis.speak(utterance);
    }

    function checkAnswer() {
        if (!currentUser || isWordSolved) return;

        // Initialize sound on check to ensure context is resumed if suspended
        SoundManager.init();

        const userAnswer = answerInput.value.trim().toLowerCase();
        const correctAnswer = wordsData[currentUser.currentWordIndex].english.toLowerCase();

        if (userAnswer === correctAnswer) {
            // Correct!
            handleCorrectAnswer();
        } else {
            // Incorrect
            handleIncorrectAnswer();
        }
    }

    function handleCorrectAnswer() {
        isWordSolved = true;

        // Sound
        SoundManager.playSuccess();

        // Update points
        currentUser.points += POINTS_CORRECT;
        UserManager.updatePoints(currentUser.name, currentUser.points);
        updatePointsDisplay();

        // UI Updates
        answerInput.classList.add('correct');
        answerInput.classList.remove('incorrect');
        answerInput.disabled = true;

        feedbackMessage.textContent = "מצוין! / Excellent!";
        feedbackMessage.classList.add('success-text');

        // DO NOT REVEAL word on correct answer as requested
        // englishEl.classList.remove('hidden');
        // englishEl.classList.add('visible');

        checkBtn.classList.add('hidden');
        giveUpBtn.classList.add('hidden');
        nextBtn.classList.remove('hidden');
        nextBtn.focus();

        // Fun effects
        const card = document.querySelector('.card');
        card.classList.add('pop-animation');
        setTimeout(() => card.classList.remove('pop-animation'), 300);

        // DO NOT SPEAK on correct answer as requested
        // speakEnglish();
    }

    function handleIncorrectAnswer() {
        // Sound
        SoundManager.playFailure();

        // Penalty points
        if (currentUser.points > 0) {
            currentUser.points = Math.max(0, currentUser.points - POINTS_INCORRECT_PENALTY);
            UserManager.updatePoints(currentUser.name, currentUser.points);
            updatePointsDisplay();
        }

        // UI Updates
        answerInput.classList.add('incorrect');
        setTimeout(() => answerInput.classList.remove('incorrect'), 400); // Remove animation class to re-trigger if needed

        feedbackMessage.textContent = "לא בדיוק, נסה שוב / Not quite, try again";
        feedbackMessage.classList.add('error-text');

        // Focus back on input
        answerInput.focus();
    }

    function giveUp() {
        if (!currentUser || isWordSolved) return;

        isWordSolved = true;

        // Reveal answer but NO points
        englishEl.classList.remove('hidden');
        englishEl.classList.add('visible');

        answerInput.value = wordsData[currentUser.currentWordIndex].english;
        answerInput.disabled = true;

        feedbackMessage.textContent = "";

        checkBtn.classList.add('hidden');
        giveUpBtn.classList.add('hidden');
        nextBtn.classList.remove('hidden');

        speakEnglish();
    }

    function nextWord() {
        if (!currentUser) return;

        currentUser.currentWordIndex = (currentUser.currentWordIndex + 1) % wordsData.length;

        // Save progress index
        UserManager.updateProgress(currentUser.name, currentUser.currentWordIndex);

        loadWord(currentUser.currentWordIndex);
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

        // Delay starting game slightly to show message
        setTimeout(() => {
            loadGameForUser(result.user);
            usernameInput.value = ''; // Clear input
            loginMessage.textContent = '';
        }, 1000);
    }

    function handleLogout() {
        UserManager.logout();
        currentUser = null;
        userBar.classList.add('hidden');
        loginOverlay.classList.remove('hidden');
        // Reset game view
        hebrewEl.innerText = '...';
    }

    // --- Event Listeners ---
    speakBtn.addEventListener('click', speakEnglish);
    // remove revealBtn listener as it's replaced
    nextBtn.addEventListener('click', nextWord);

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
