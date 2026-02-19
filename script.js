document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const hebrewEl = document.getElementById('hebrew-word');
    const englishEl = document.getElementById('english-word');
    const speakBtn = document.getElementById('speak-btn');
    const nextBtn = document.getElementById('next-btn');
    const revealBtn = document.getElementById('reveal-btn');

    // User Management DOM Elements
    const loginOverlay = document.getElementById('login-overlay');
    const usernameInput = document.getElementById('username-input');
    const loginBtn = document.getElementById('login-btn');
    const loginMessage = document.getElementById('login-message');
    const userBar = document.getElementById('user-bar');
    const currentUsernameEl = document.getElementById('current-username');
    const logoutBtn = document.getElementById('logout-btn');

    // --- State ---
    let currentUser = null;

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
                    currentWordIndex: 0
                };
                this.saveUsers(users);
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
        loginOverlay.classList.add('hidden');
        userBar.classList.remove('hidden');

        // Restore progress
        // Ensure index is within bounds (in case wordsData changed)
        if (currentUser.currentWordIndex >= wordsData.length) {
            currentUser.currentWordIndex = 0;
        }

        loadWord(currentUser.currentWordIndex);
    }

    function loadWord(index) {
        const word = wordsData[index];
        hebrewEl.innerText = word.hebrew;
        englishEl.innerText = word.english;

        // Reset state
        englishEl.classList.remove('visible');
        englishEl.classList.add('hidden');
        revealBtn.style.display = 'inline-block';
    }

    function speakEnglish() {
        if (!currentUser) return; // Block interaction if not logged in
        const word = wordsData[currentUser.currentWordIndex].english;
        const utterance = new SpeechSynthesisUtterance(word);
        utterance.lang = 'en-US';
        speechSynthesis.speak(utterance);
    }

    function revealAnswer() {
        if (!currentUser) return;

        englishEl.classList.remove('hidden');
        // Small delay to allow display change before opacity transition
        setTimeout(() => {
            englishEl.classList.add('visible');
        }, 10);
        revealBtn.style.display = 'none';

        // Auto-speak when revealed
        speakEnglish();
    }

    function nextWord() {
        if (!currentUser) return;

        currentUser.currentWordIndex = (currentUser.currentWordIndex + 1) % wordsData.length;

        // Save progress
        UserManager.updateProgress(currentUser.name, currentUser.currentWordIndex);

        // Create a nice transition
        const card = document.querySelector('.card');
        card.classList.add('pop-animation');
        setTimeout(() => card.classList.remove('pop-animation'), 300);

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
        // Reset game view (optional, creates a clean slate look)
        hebrewEl.innerText = '...';
    }

    // --- Event Listeners ---
    speakBtn.addEventListener('click', speakEnglish);
    revealBtn.addEventListener('click', revealAnswer);
    nextBtn.addEventListener('click', nextWord);

    loginBtn.addEventListener('click', handleLogin);
    usernameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleLogin();
    });

    logoutBtn.addEventListener('click', handleLogout);

    // Initial state: No user logged in, overlay is visible (default in HTML)
    // CHECK FOR SAVED SESSION
    const lastUser = UserManager.getLastUser();
    if (lastUser) {
        const result = UserManager.login(lastUser);
        if (result && !result.isNew) {
            loadGameForUser(result.user);
        }
    }
});
