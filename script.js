document.addEventListener('DOMContentLoaded', () => {
    const hebrewEl = document.getElementById('hebrew-word');
    const englishEl = document.getElementById('english-word');
    const speakBtn = document.getElementById('speak-btn');
    const nextBtn = document.getElementById('next-btn');
    const revealBtn = document.getElementById('reveal-btn');

    let currentWordIndex = 0;

    // Shuffle words on load
    shuffleArray(wordsData);

    function shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }

    function loadWord() {
        const word = wordsData[currentWordIndex];
        hebrewEl.innerText = word.hebrew;
        englishEl.innerText = word.english;

        // Reset state
        englishEl.classList.remove('visible');
        englishEl.classList.add('hidden');
        revealBtn.style.display = 'inline-block';
    }

    function speakEnglish() {
        const word = wordsData[currentWordIndex].english;
        const utterance = new SpeechSynthesisUtterance(word);
        utterance.lang = 'en-US';
        speechSynthesis.speak(utterance);
    }

    function revealAnswer() {
        englishEl.classList.remove('hidden');
        // Small delay to allow display change before opacity transition
        setTimeout(() => {
            englishEl.classList.add('visible');
        }, 10);
        revealBtn.style.display = 'none';

        // Auto-speak when revealed (optional, but helpful for kids)
        speakEnglish();
    }

    function nextWord() {
        currentWordIndex = (currentWordIndex + 1) % wordsData.length;

        // Create a nice transition
        const card = document.querySelector('.card');
        card.classList.add('pop-animation');
        setTimeout(() => card.classList.remove('pop-animation'), 300);

        loadWord();
    }

    // Event Listeners
    speakBtn.addEventListener('click', speakEnglish);

    revealBtn.addEventListener('click', revealAnswer);

    nextBtn.addEventListener('click', nextWord);

    // Initial load
    loadWord();
});
