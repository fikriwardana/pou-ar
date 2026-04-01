/**
 * POU AR SOLO - Main Game Module (Production Grade)
 * Handles game state, mode switching, photo booth, Gemini voice integration
 * Features: Secure API key storage, onboarding overlays, settings panel
 */

// ============================================
// Game State
// ============================================

const Game = {
    currentMode: 'care',
    isCameraOn: true,
    apiKey: null,
    
    // Pou state
    pou: {
        expression: 'normal',
        hunger: 80,
        energy: 100,
        fun: 60,
        lastFed: Date.now(),
        lastPet: Date.now()
    },
    
    // Food dragging state
    foodDrag: {
        isDragging: false,
        selectedFood: null,
        element: null
    },
    
    // Voice chat state
    voice: {
        recognition: null,
        synthesis: typeof window !== 'undefined' && window.speechSynthesis ? window.speechSynthesis : null,
        isListening: false,
        isSpeaking: false,
        isStarting: false
    },
    
    // Photo state
    photo: {
        countdown: 0,
        isCapturing: false
    },
    
    // Onboarding state
    onboarding: {
        sky: false,
        racing: false,
        food: false,
        timeoutId: null
    },

    // Game loop state
    gameLoopId: null,
    modeSwitchTimeoutId: null,

    // Cached Elements
    elements: {}
};

// ============================================
// Initialization
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
    loadGameState(); // Load persisted stats before mounting UI

    // Cache DOM Elements
    Game.elements.pou = document.getElementById('pou');
    Game.elements.scene = document.getElementById('scene');
    Game.elements.hungerBar = document.getElementById('hungerBar');
    Game.elements.energyBar = document.getElementById('energyBar');
    Game.elements.funBar = document.getElementById('funBar');
    Game.elements.moodValue = document.getElementById('moodValue');
    Game.elements.draggedFood = document.getElementById('draggedFood');
    Game.elements.particles = document.getElementById('particles');

    // Global Error Boundary
    window.onerror = function(msg, url, line, col, error) {
        console.error(`Global Error: ${msg} at ${url}:${line}:${col}`, error);
        showErrorUI('Terjadi kesalahan tidak terduga. Silakan muat ulang halaman.');
        return false;
    };
    window.addEventListener('unhandledrejection', function(event) {
        console.error('Unhandled Promise Rejection:', event.reason);
        // Silently log or display depending on severity
    });

    initLoading();
    
    // Setup error handler
    Engine.onError = (message) => {
        console.error('Engine error:', message);
        showCameraModal();
    };
    
    // Check for saved API key
    loadApiKey();
    
    // Setup event listeners
    setupEventListeners();
    
    // Initialize mini games
    MiniGames.init();
    
    // Check camera permission and initialize
    try {
        const permission = await checkCameraPermission();
        if (permission) {
            await initializeEngine();
        } else {
            showCameraModal();
        }
    } catch (error) {
        console.error('Initialization error:', error);
        showCameraModal();
    }
});

function initLoading() {
    const loadingFill = document.getElementById('loadingFill');
    let progress = 0;
    const interval = setInterval(() => {
        progress += Math.random() * 15;
        if (progress >= 100) {
            progress = 100;
            clearInterval(interval);
        }
        if (loadingFill) loadingFill.style.width = progress + '%';
    }, 200);
}

async function checkCameraPermission() {
    try {
        if (navigator.permissions && navigator.permissions.query) {
            const result = await navigator.permissions.query({ name: 'camera' });
            if (result.state === 'granted') return true;
            if (result.state === 'prompt') return false; // Show modal, let user click button
            if (result.state === 'denied') return false;
        }
    } catch (e) {
        console.warn('Permissions API not fully supported for camera');
    }

    // We cannot reliably know without requesting, so assume false to show modal
    return false;
}

async function initializeEngine() {
    try {
        // Initialize engine
        await Engine.init();
        
        // Register callbacks
        Engine.onFaceDetected(handleFaceDetected);
        Engine.onHandsDetected(handleHandsDetected);
        Engine.onLightChange(handleLightChange);
        
        // Start camera
        const started = await Engine.start();
        if (started) {
            // Initialize voice
            initVoice();
            
            // Start game loop
            startGameLoop();
            
            // Hide loading
            setTimeout(() => {
                hideLoading();
            }, 500);
            
            console.log('✅ Game initialized successfully');
        }
    } catch (error) {
        console.error('❌ Game initialization failed:', error);
        showCameraModal();
    }
}

function hideLoading() {
    const loadingScreen = document.getElementById('loadingScreen');
    if (loadingScreen) loadingScreen.classList.add('hidden');
}

function showCameraModal() {
    const modal = document.getElementById('cameraModal');
    if (modal) modal.classList.add('active');
}

async function requestCameraPermission() {
    const granted = await Engine.requestCameraPermission();
    if (granted && !Engine.isRunning()) {
        await initializeEngine();
    }
}

function showErrorUI(message) {
    // Basic implementation to avoid fully silent failures
    console.error('Error UI:', message);
    const existing = document.getElementById('globalError');
    if (!existing) {
        const div = document.createElement('div');
        div.id = 'globalError';
        div.style = 'position:fixed;top:0;left:0;right:0;background:rgba(255,0,0,0.8);color:#fff;padding:10px;text-align:center;z-index:9999;font-family:sans-serif;font-size:14px;';
        div.innerHTML = `${message} <button onclick="location.reload()" style="margin-left:10px;padding:2px 8px;cursor:pointer;">Muat Ulang</button>`;
        document.body.appendChild(div);
    }
}

function showError(message) {
    console.error(message);
    showErrorUI(message);
}

// ============================================
// Secure Gemini API Key Management
// ============================================

function loadApiKey() {
    try {
        const stored = localStorage.getItem('pouGeminiApiKey');
        if (stored) {
            Game.apiKey = atob(stored);
        }
    } catch (e) {
        console.warn('localStorage not available or key invalid');
        Game.apiKey = null;
    }
}

function saveApiKey() {
    const input = document.getElementById('apiKeyInput');
    if (input && input.value.trim()) {
        const key = input.value.trim();
        try {
            console.warn('Security Warning: API Keys stored in localStorage can be accessed by scripts or extensions. Do not use production keys here.');
            localStorage.setItem('pouGeminiApiKey', btoa(key));
            Game.apiKey = key;
        } catch (e) {
            console.warn('Failed to save to localStorage');
        }
        
        const modal = document.getElementById('apiKeyModal');
        if (modal) modal.classList.remove('active');
        
        // Initialize voice if not already
        initVoice();
    }
}

function skipApiKey() {
    const modal = document.getElementById('apiKeyModal');
    if (modal) modal.classList.remove('active');
}

function clearApiKey() {
    try {
        localStorage.removeItem('pouGeminiApiKey');
    } catch (e) {
        console.warn('localStorage not available');
    }
    Game.apiKey = null;
    alert('API Key telah dihapus');
}

function promptForApiKey() {
    // Use native browser prompt for security
    const key = prompt('Masukkan Gemini API Key Anda:');
    if (key && key.trim()) {
        try {
            console.warn('Security Warning: API Keys stored in localStorage can be accessed by scripts or extensions. Do not use production keys here.');
            localStorage.setItem('pouGeminiApiKey', btoa(key.trim()));
            Game.apiKey = key.trim();
            initVoice();
            return true;
        } catch (e) {
            console.warn('Failed to save API key');
        }
    }
    return false;
}

// ============================================
// Settings Panel
// ============================================

function toggleSettings() {
    const panel = document.getElementById('settingsPanel');
    if (panel) {
        panel.classList.toggle('active');
    }
}

// ============================================
// Event Listeners
// ============================================

function setupEventListeners() {
    // UI Event Bindings
    document.getElementById('btnSaveApiKey')?.addEventListener('click', saveApiKey);
    document.getElementById('btnSkipApiKey')?.addEventListener('click', skipApiKey);
    document.getElementById('btnDownloadPhoto')?.addEventListener('click', downloadPhoto);
    document.getElementById('btnSharePhoto')?.addEventListener('click', sharePhoto);
    document.getElementById('btnClosePhotoModal')?.addEventListener('click', closePhotoModal);
    document.getElementById('btnRequestCameraPermission')?.addEventListener('click', requestCameraPermission);
    document.getElementById('micBtn')?.addEventListener('click', toggleVoiceChat);
    document.getElementById('cameraBtn')?.addEventListener('click', takePhoto);
    document.getElementById('btnSettingsToggle')?.addEventListener('click', toggleSettings);
    document.getElementById('btnClearApiKey')?.addEventListener('click', clearApiKey);
    document.getElementById('btnToggleCamera')?.addEventListener('click', toggleCamera);

    // Navigation and Food Items
    document.querySelectorAll('.js-nav-btn').forEach(btn => {
        btn.addEventListener('click', () => switchMode(btn.dataset.mode));
    });

    document.querySelectorAll('.js-food-item').forEach(item => {
        item.addEventListener('click', () => selectFood(item.dataset.food));
    });

    // Food drag handling
    document.addEventListener('mousemove', handleFoodDrag);
    document.addEventListener('mouseup', handleFoodDrop);
    document.addEventListener('touchmove', handleFoodDragTouch, { passive: false });
    document.addEventListener('touchend', handleFoodDrop);
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        switch (e.key) {
            case '1': switchMode('care'); break;
            case '2': switchMode('sky'); break;
            case '3': switchMode('racing'); break;
            case '4': switchMode('food'); break;
            case ' ': toggleVoiceChat(); break;
            case 'c': takePhoto(); break;
        }
    });
    
    // Window resize & orientation change
    const handleResize = () => MiniGames.resize();
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    
    // Close settings when clicking outside
    document.addEventListener('click', (e) => {
        const settingsPanel = document.getElementById('settingsPanel');
        const settingsBtn = document.getElementById('btnSettingsToggle');
        
        if (settingsPanel && settingsPanel.classList.contains('active')) {
            if (!settingsPanel.contains(e.target) && e.target !== settingsBtn) {
                settingsPanel.classList.remove('active');
            }
        }
    });
}

// ============================================
// Mode Switching with Onboarding
// ============================================

function switchMode(mode) {
    // Update current mode
    Game.currentMode = mode;
    
    if (Game.modeSwitchTimeoutId) clearTimeout(Game.modeSwitchTimeoutId);
    if (Game.onboarding.timeoutId) clearTimeout(Game.onboarding.timeoutId);

    // Update navigation
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.mode === mode) {
            btn.classList.add('active');
        }
    });
    
    // Hide all modes
    document.querySelectorAll('.care-mode, .minigame').forEach(el => {
        el.classList.remove('active');
        el.style.opacity = '0';
    });
    
    // Show selected mode with fade
    Game.modeSwitchTimeoutId = setTimeout(() => {
        if (Game.currentMode !== mode) return; // double check mode hasn't changed

        if (mode === 'care') {
            const careMode = document.getElementById('careMode');
            if (careMode) {
                careMode.classList.add('active');
                setTimeout(() => {
                    if (Game.currentMode === 'care') careMode.style.opacity = '1';
                }, 50);
            }
            MiniGames.stop();
            setPouExpression('normal');
        } else {
            // Check if onboarding needed
            if (!Game.onboarding[mode]) {
                showOnboarding(mode);
            } else {
                startMiniGame(mode);
            }
        }
    }, 300);
    
    // Update status
    updateMoodDisplay();
}

function showOnboarding(mode) {
    const overlayId = {
        'sky': 'onboardingSky',
        'racing': 'onboardingRacing',
        'food': 'onboardingFood'
    }[mode];
    
    // Hide all overlays first
    document.querySelectorAll('.onboarding-overlay').forEach(el => el.classList.remove('active'));

    const overlay = document.getElementById(overlayId);
    if (overlay) {
        overlay.classList.add('active');
        
        // Auto-dismiss after 3 seconds
        Game.onboarding.timeoutId = setTimeout(() => {
            if (Game.currentMode !== mode) return; // cancel if mode changed
            overlay.classList.remove('active');
            Game.onboarding[mode] = true;
            startMiniGame(mode);
        }, 3000);
    } else {
        startMiniGame(mode);
    }
}

function startMiniGame(mode) {
    const gameElement = document.getElementById(
        mode === 'sky' ? 'skyClimber' :
        mode === 'racing' ? 'headRacing' : 'foodFall'
    );
    
    if (gameElement) {
        gameElement.classList.add('active');
        gameElement.style.opacity = '1';
    }
    
    MiniGames.start(mode);
}

// ============================================
// Pou Expression Control
// ============================================

function setPouExpression(expression) {
    const pou = Game.elements.pou;
    if (!pou) return;
    
    // Remove all expression classes
    pou.classList.remove('normal', 'happy', 'sad', 'surprised', 'eating', 'sleeping', 'angry', 'wink');
    
    // Add new expression
    pou.classList.add(expression);
    Game.pou.expression = expression;
    
    // Update mood display
    updateMoodDisplay();
}

function updateMoodDisplay() {
    const moodValue = Game.elements.moodValue;
    if (moodValue) {
        const moods = {
            'normal': '😐 Normal',
            'happy': '😊 Happy',
            'sad': '😢 Sad',
            'surprised': '😲 Surprised',
            'eating': '🍕 Eating',
            'sleeping': '😴 Sleeping',
            'angry': '😠 Angry',
            'wink': '😉 Wink'
        };
        moodValue.textContent = moods[Game.pou.expression] || '😐 Normal';
    }
}

// ============================================
// Face & Hand Detection Handlers
// ============================================

function handleFaceDetected(landmarks, gestures) {
    // Scale Pou based on eye distance (depth simulation)
    const pou = Game.elements.pou;
    const scene = Game.elements.scene;
    
    if (pou && scene && gestures.eyeDistance > 0) {
        const scaleFactor = 0.5 + gestures.eyeDistance * 2;
        const scale = Math.max(0.7, Math.min(1.3, scaleFactor));
        
        // Prevent layout thrashing and jitter by requiring a minimum change
        // Avoid setting transform every frame if it's visually imperceptible.
        const currentScale = parseFloat(scene.dataset.scale) || 1;
        if (Math.abs(currentScale - scale) > 0.05) {
            scene.style.transform = `scale(${scale})`;
            scene.dataset.scale = scale;
        }
    }
    
    // In care mode, check for interactions
    if (Game.currentMode === 'care') {
        // Mouth open detection for eating animation
        if (gestures.mouthOpen > 0.7 && Game.pou.expression !== 'eating') {
            setPouExpression('eating');
            setTimeout(() => {
                if (Game.pou.expression === 'eating') {
                    setPouExpression('happy');
                }
            }, 2000);
        }
    }
}

function handleHandsDetected(landmarks, gestures) {
    if (Game.currentMode !== 'care') return;
    
    const pou = Game.elements.pou;
    
    // Check if hand is over Pou (petting)
    if (pou && gestures.isHandDetected) {
        const pouRect = pou.getBoundingClientRect();
        const handX = gestures.handPosition.x * window.innerWidth;
        const handY = gestures.handPosition.y * window.innerHeight;
        
        const isOverPou = 
            handX >= pouRect.left && 
            handX <= pouRect.right && 
            handY >= pouRect.top && 
            handY <= pouRect.bottom;
        
        if (isOverPou && !gestures.handPinch) {
            const now = Date.now();
            // Debounce petting effect (e.g. 500ms)
            if (now - (Game.pou.lastPetTime || 0) > 500) {
                Game.pou.lastPetTime = now;
                // Petting detected
                if (Game.pou.expression !== 'happy') {
                    setPouExpression('happy');
                }
                createSparkles(handX, handY, 'heart');
                Game.pou.fun = Math.min(100, Game.pou.fun + 5);
                Game.pou.lastPet = now;
                updateStatusBars();
            }
        }
    }
}

function handleLightChange(brightness) {
    // Dark mode detection
    const isDark = brightness < 50;
    const body = document.body;
    
    if (isDark && !body.classList.contains('dark-mode')) {
        body.classList.add('dark-mode');
        if (Game.currentMode === 'care' && Game.pou.expression !== 'sleeping') {
            setPouExpression('sleeping');
        }
    } else if (!isDark && body.classList.contains('dark-mode')) {
        body.classList.remove('dark-mode');
        if (Game.pou.expression === 'sleeping') {
            setPouExpression('normal');
        }
    }
}

// ============================================
// Food System
// ============================================

function selectFood(foodType) {
    const foodItems = document.querySelectorAll('.food-item');
    foodItems.forEach(item => item.classList.remove('selected'));
    
    const selected = document.querySelector(`[data-food="${foodType}"]`);
    if (selected) selected.classList.add('selected');
    
    Game.foodDrag.selectedFood = foodType;
    Game.foodDrag.isDragging = true;
    
    const draggedFood = Game.elements.draggedFood;
    if (draggedFood) {
        const foodEmojis = {
            'apple': '🍎',
            'pizza': '🍕',
            'icecream': '🍦',
            'burger': '🍔'
        };
        draggedFood.textContent = foodEmojis[foodType] || '🍎';
        draggedFood.classList.add('active');
    }
}

function handleFoodDrag(e) {
    if (!Game.foodDrag.isDragging) return;
    
    const draggedFood = Game.elements.draggedFood;
    if (draggedFood) {
        draggedFood.style.left = e.clientX - 20 + 'px';
        draggedFood.style.top = e.clientY - 20 + 'px';
    }
}

function handleFoodDragTouch(e) {
    if (!Game.foodDrag.isDragging) return;
    e.preventDefault();
    
    const touch = e.touches[0];
    const draggedFood = Game.elements.draggedFood;
    if (draggedFood) {
        draggedFood.style.left = touch.clientX - 20 + 'px';
        draggedFood.style.top = touch.clientY - 20 + 'px';
    }
}

function handleFoodDrop(e) {
    if (!Game.foodDrag.isDragging) return;
    
    const clientX = e.clientX !== undefined ? e.clientX : (e.changedTouches && e.changedTouches[0].clientX);
    const clientY = e.clientY !== undefined ? e.clientY : (e.changedTouches && e.changedTouches[0].clientY);
    
    const pou = Game.elements.pou;
    if (pou && clientX !== undefined && clientY !== undefined) {
        const pouRect = pou.getBoundingClientRect();
        const isOverPou = 
            clientX >= pouRect.left && 
            clientX <= pouRect.right && 
            clientY >= pouRect.top && 
            clientY <= pouRect.bottom;
        
        if (isOverPou) {
            feedPou();
        }
    }
    
    // Reset drag
    Game.foodDrag.isDragging = false;
    Game.foodDrag.selectedFood = null;
    
    const draggedFood = Game.elements.draggedFood;
    if (draggedFood) draggedFood.classList.remove('active');
    
    document.querySelectorAll('.food-item').forEach(item => {
        item.classList.remove('selected');
    });
}

function feedPou() {
    setPouExpression('eating');
    
    // Update stats
    Game.pou.hunger = Math.min(100, Game.pou.hunger + 20);
    Game.pou.lastFed = Date.now();
    updateStatusBars();
    
    // Create particles
    const pou = document.getElementById('pou');
    if (pou) {
        const rect = pou.getBoundingClientRect();
        createSparkles(rect.left + rect.width / 2, rect.top + rect.height / 2, 'random');
    }
    
    // Reset expression after eating
    setTimeout(() => {
        if (Game.pou.expression === 'eating') {
            setPouExpression('happy');
        }
    }, 3000);
}

// ============================================
// Status Management
// ============================================

function loadGameState() {
    try {
        const saved = localStorage.getItem('pouGameState');
        if (saved) {
            const parsed = JSON.parse(saved);
            Game.pou.hunger = parsed.hunger ?? Game.pou.hunger;
            Game.pou.energy = parsed.energy ?? Game.pou.energy;
            Game.pou.fun = parsed.fun ?? Game.pou.fun;
            // Only accept past timestamps to avoid future time glitch
            const now = Date.now();
            Game.pou.lastFed = Math.min(now, parsed.lastFed ?? now);
            Game.pou.lastPet = Math.min(now, parsed.lastPet ?? now);
        }
    } catch (e) {
        console.warn('Could not load game state:', e);
    }
}

function saveGameState() {
    try {
        localStorage.setItem('pouGameState', JSON.stringify({
            hunger: Game.pou.hunger,
            energy: Game.pou.energy,
            fun: Game.pou.fun,
            lastFed: Game.pou.lastFed,
            lastPet: Game.pou.lastPet
        }));
    } catch (e) {
        // Silently fail if localStorage is unavailable
    }
}

function updateStatusBars() {
    const hungerBar = Game.elements.hungerBar;
    const energyBar = Game.elements.energyBar;
    const funBar = Game.elements.funBar;
    
    if (hungerBar) hungerBar.style.width = Game.pou.hunger + '%';
    if (energyBar) energyBar.style.width = Game.pou.energy + '%';
    if (funBar) funBar.style.width = Game.pou.fun + '%';
}

function startGameLoop() {
    if (Game.gameLoopId) {
        clearInterval(Game.gameLoopId);
    }

    // Decay stats over time
    Game.gameLoopId = setInterval(() => {
        const now = Date.now();
        
        // Safety bounds for monotonic time calculation:
        // Cap offline drift to max 2 minutes (120000ms) logic equivalent per tick
        // Prevents stats tanking drastically if the device clock skips forward
        // or tab was suspended for a very long time.

        const deltaFed = Math.min(now - Game.pou.lastFed, 120000);
        if (deltaFed > 30000) {
            Game.pou.hunger = Math.max(0, Game.pou.hunger - 1);
            // reset lastFed timer incrementally, not blindly to Date.now() to allow catching up cleanly without skipping
            Game.pou.lastFed += 30000;
            // Catch up drift case
            if (Game.pou.lastFed > now) Game.pou.lastFed = now;
        }
        
        const deltaPet = Math.min(now - Game.pou.lastPet, 120000);
        if (deltaPet > 20000) {
            Game.pou.fun = Math.max(0, Game.pou.fun - 1);
            Game.pou.lastPet += 20000;
            if (Game.pou.lastPet > now) Game.pou.lastPet = now;
        }
        
        // Energy recovery when sleeping
        if (Game.pou.expression === 'sleeping') {
            Game.pou.energy = Math.min(100, Game.pou.energy + 2);
        } else {
            Game.pou.energy = Math.max(0, Game.pou.energy - 0.5);
        }
        
        // Clamp bounds securely to avoid > 100 or < 0
        Game.pou.hunger = Math.min(100, Math.max(0, Game.pou.hunger));
        Game.pou.energy = Math.min(100, Math.max(0, Game.pou.energy));
        Game.pou.fun = Math.min(100, Math.max(0, Game.pou.fun));

        updateStatusBars();

        // Auto-sleep when energy is low
        if (Game.pou.energy < 10 && Game.pou.expression !== 'sleeping') {
            setPouExpression('sleeping');
        }

        saveGameState(); // Persist changes
    }, 1000);
}

// ============================================
// Photo Booth
// ============================================

function takePhoto() {
    if (Game.photo.isCapturing) return;
    Game.photo.isCapturing = true;
    
    const overlay = document.getElementById('countdownOverlay');
    const number = document.getElementById('countdownNumber');
    
    overlay.classList.add('active');
    
    let count = 3;
    number.textContent = count;
    
    const countdown = setInterval(() => {
        count--;
        if (count > 0) {
            number.textContent = count;
        } else {
            clearInterval(countdown);
            overlay.classList.remove('active');
            capturePhoto();
        }
    }, 1000);
}

async function capturePhoto() {
    const flash = document.getElementById('flashOverlay');
    flash.classList.add('active');
    
    setTimeout(() => {
        flash.classList.remove('active');
    }, 150);
    
    try {
        // Capture the game container
        const gameContainer = document.getElementById('gameContainer');
        const canvas = await html2canvas(gameContainer, {
            backgroundColor: null,
            scale: 2,
            useCORS: true,
            allowTaint: true
        });
        
        // Show preview
        const preview = document.getElementById('photoPreview');
        preview.src = canvas.toDataURL('image/png');
        
        const modal = document.getElementById('photoModal');
        modal.classList.add('active');
        
        Game.photo.isCapturing = false;
    } catch (error) {
        console.error('Photo capture failed:', error);
        alert('Gagal mengambil foto. Silakan coba lagi.');
        Game.photo.isCapturing = false;
    }
}

function closePhotoModal() {
    const modal = document.getElementById('photoModal');
    modal.classList.remove('active');
}

function downloadPhoto() {
    const preview = document.getElementById('photoPreview');
    if (!preview.src) return;
    
    const link = document.createElement('a');
    link.download = `pou-ar-solo-${Date.now()}.png`;
    link.href = preview.src;
    link.click();
}

async function sharePhoto() {
    const preview = document.getElementById('photoPreview');
    if (!preview.src) return;
    
    try {
        const response = await fetch(preview.src);
        const blob = await response.blob();
        const file = new File([blob], 'pou-ar-solo.png', { type: 'image/png' });
        
        if (navigator.share) {
            await navigator.share({
                title: 'POU AR SOLO',
                text: 'Lihat Pou AR saya! 🥔',
                files: [file]
            });
        } else {
            alert('Sharing tidak didukung di perangkat ini.');
        }
    } catch (error) {
        console.error('Share failed:', error);
    }
}

async function toggleCamera() {
    Game.isCameraOn = !Game.isCameraOn;
    
    if (Game.isCameraOn) {
        const started = await Engine.start();
        Game.isCameraOn = started;
    } else {
        Engine.stop();
    }
    
    // Update button text
    const btn = document.getElementById('btnToggleCamera');
    if (btn) btn.textContent = Game.isCameraOn ? 'Matikan' : 'Nyalakan';
}

// ============================================
// Gemini Voice Integration
// ============================================

function initVoice() {
    // Initialize speech recognition
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        Game.voice.recognition = new SpeechRecognition();
        Game.voice.recognition.continuous = false;
        Game.voice.recognition.interimResults = false;
        Game.voice.recognition.lang = 'id-ID';
        
        Game.voice.recognition.onstart = () => {
            Game.voice.isListening = true;
            Game.voice.isStarting = false;
            updateVoiceIndicator();
        };
        
        Game.voice.recognition.onend = () => {
            Game.voice.isListening = false;
            Game.voice.isStarting = false;
            updateVoiceIndicator();
        };
        
        Game.voice.recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            console.log('User said:', transcript);
            handleVoiceInput(transcript);
        };
        
        Game.voice.recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            Game.voice.isListening = false;
            Game.voice.isStarting = false;
            updateVoiceIndicator();
        };
    } else {
        console.warn('SpeechRecognition API is not supported in this browser.');
    }
}

function toggleVoiceChat() {
    if (!Game.apiKey) {
        // Try to get from prompt
        if (promptForApiKey()) {
            // Retry after getting key
            setTimeout(() => toggleVoiceChat(), 500);
        }
        return;
    }
    
    if (Game.voice.isListening || Game.voice.isStarting) {
        if (Game.voice.isListening) {
            Game.voice.recognition.stop();
        }
    } else {
        if (Game.voice.recognition) {
            Game.voice.isStarting = true;
            try {
                Game.voice.recognition.start();
            } catch (error) {
                console.error('Error starting recognition:', error);
                Game.voice.isStarting = false;
            }
        } else {
            alert('Speech recognition tidak didukung di browser ini.');
        }
    }
}

function updateVoiceIndicator() {
    const indicator = document.getElementById('voiceIndicator');
    const micBtn = document.getElementById('micBtn');
    
    if (Game.voice.isListening) {
        indicator.classList.add('active');
        micBtn.classList.add('active');
    } else {
        indicator.classList.remove('active');
        micBtn.classList.remove('active');
    }
}

async function handleVoiceInput(text) {
    if (!Game.apiKey) return;
    
    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${Game.apiKey}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: `Act as a cute, slightly sarcastic virtual pet named Pou. Respond in 1 short sentence in Indonesian to: "${text}"`
                        }]
                    }]
                })
            }
        );
        
        const data = await response.json();
        
        if (data.candidates && data.candidates[0].content.parts[0].text) {
            const reply = data.candidates[0].content.parts[0].text;
            speakResponse(reply);
        }
    } catch (error) {
        console.error('Gemini API error:', error);
        speakResponse('Maaf, aku lagi ngantuk nih... 😴');
    }
}

function speakResponse(text) {
    if (!Game.voice.synthesis) return;
    
    // Cancel any ongoing speech
    Game.voice.synthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'id-ID';
    utterance.rate = 1.1;
    utterance.pitch = 1.2;
    
    // Lip sync animation
    let lipSyncInterval = null;
    
    utterance.onstart = () => {
        Game.voice.isSpeaking = true;
        
        // Start lip sync
        lipSyncInterval = setInterval(() => {
            const pou = document.getElementById('pou');
            if (pou) {
                pou.classList.toggle('eating');
            }
        }, 200);
    };
    
    utterance.onend = () => {
        Game.voice.isSpeaking = false;
        
        // Stop lip sync
        if (lipSyncInterval) {
            clearInterval(lipSyncInterval);
        }
        
        // Reset expression
        const pou = document.getElementById('pou');
        if (pou && Game.currentMode === 'care') {
            pou.classList.remove('eating');
            pou.classList.add('happy');
        }
    };
    
    Game.voice.synthesis.speak(utterance);
}

// ============================================
// Particle Effects
// ============================================

function createSparkles(x, y, type = 'random') {
    const particles = Game.elements.particles;
    if (!particles) return;
    
    // Prevent DOM explosion if spammed
    if (particles.childElementCount > 40) return;

    const types = type === 'random' ? ['star', 'dot', 'heart'] : [type];
    const selectedType = types[Math.floor(Math.random() * types.length)];
    
    for (let i = 0; i < 8; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        
        if (selectedType === 'star') {
            particle.innerHTML = '✨';
            particle.className += ' sparkle-star';
        } else if (selectedType === 'dot') {
            particle.className += ' sparkle-dot';
        } else if (selectedType === 'heart') {
            particle.innerHTML = '💖';
            particle.className += ' sparkle-heart';
        }
        
        particle.style.left = x + 'px';
        particle.style.top = y + 'px';
        
        const angle = Math.random() * Math.PI * 2;
        const dist = 60 + Math.random() * 80;
        const tx = Math.cos(angle) * dist;
        const ty = Math.sin(angle) * dist - 60;
        
        particle.style.setProperty('--tx', tx + 'px');
        particle.style.setProperty('--ty', ty + 'px');
        
        particles.appendChild(particle);
        setTimeout(() => particle.remove(), 1200);
    }
    
    // Burst ring
    const burst = document.createElement('div');
    burst.className = 'burst-ring';
    burst.style.left = x + 'px';
    burst.style.top = y + 'px';
    particles.appendChild(burst);
    setTimeout(() => burst.remove(), 600);
}

// ============================================
// Export
// ============================================

window.Game = Game;
window.switchMode = switchMode;
window.setPouExpression = setPouExpression;
window.selectFood = selectFood;
window.feedPou = feedPou;
window.takePhoto = takePhoto;
window.closePhotoModal = closePhotoModal;
window.downloadPhoto = downloadPhoto;
window.sharePhoto = sharePhoto;
window.toggleCamera = toggleCamera;
window.toggleVoiceChat = toggleVoiceChat;
window.toggleSettings = toggleSettings;
window.saveApiKey = saveApiKey;
window.skipApiKey = skipApiKey;
window.clearApiKey = clearApiKey;
window.promptForApiKey = promptForApiKey;
window.requestCameraPermission = requestCameraPermission;
window.createSparkles = createSparkles;
