/**
 * POU AR SOLO - Engine Module (Production Grade)
 * Handles MediaPipe initialization, smoothing, gesture detection
 * Features: RAF-based DOM updates, Page Visibility API, error handling
 */

// ============================================
// Global State
// ============================================

const Engine = {
    // MediaPipe instances
    faceMesh: null,
    hands: null,
    camera: null,
    
    // Canvas contexts
    trackingCanvas: null,
    trackingCtx: null,
    
    // Smoothing state
    smoothedLandmarks: null,
    smoothingAlpha: 0.2,
    
    // Gesture state (updated by MediaPipe)
    rawGestures: {
        nosePosition: { x: 0.5, y: 0.5 },
        mouthOpen: 0,
        eyebrowRaise: 0,
        headTilt: 0,
        handPinch: false,
        handPosition: { x: 0, y: 0 },
        eyeDistance: 0,
        isHandDetected: false,
        isFaceDetected: false
    },
    
    // Smoothed gestures (for DOM consumption)
    gestures: {
        nosePosition: { x: 0.5, y: 0.5 },
        mouthOpen: 0,
        eyebrowRaise: 0,
        headTilt: 0,
        handPinch: false,
        handPosition: { x: 0, y: 0 },
        eyeDistance: 0,
        isHandDetected: false,
        isFaceDetected: false
    },
    
    // RAF loop
    rafId: null,
    lastRafTime: 0,
    
    // Page visibility
    isVisible: true,
    wasRunningBeforeHidden: false,
    
    // Initialization state
    isInitialized: false,
    isRunning: false,
    hasPermission: false,
    
    // Callbacks
    onFaceResults: null,
    onHandsResults: null,
    onAmbientLight: null,
    onError: null
};

// ============================================
// Utility Functions
// ============================================

function lerp(start, end, alpha) {
    return start + (end - start) * alpha;
}

function distance(p1, p2) {
    return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
}

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

// ============================================
// Smoothing Functions
// ============================================

function smoothLandmarks(newLandmarks, alpha = Engine.smoothingAlpha) {
    if (!Engine.smoothedLandmarks) {
        Engine.smoothedLandmarks = JSON.parse(JSON.stringify(newLandmarks));
        return Engine.smoothedLandmarks;
    }
    
    for (let i = 0; i < newLandmarks.length; i++) {
        if (Engine.smoothedLandmarks[i]) {
            Engine.smoothedLandmarks[i].x = lerp(
                Engine.smoothedLandmarks[i].x,
                newLandmarks[i].x,
                alpha
            );
            Engine.smoothedLandmarks[i].y = lerp(
                Engine.smoothedLandmarks[i].y,
                newLandmarks[i].y,
                alpha
            );
            Engine.smoothedLandmarks[i].z = lerp(
                Engine.smoothedLandmarks[i].z || 0,
                newLandmarks[i].z || 0,
                alpha
            );
        } else {
            Engine.smoothedLandmarks[i] = { ...newLandmarks[i] };
        }
    }
    
    return Engine.smoothedLandmarks;
}

function smoothValue(current, target, alpha = Engine.smoothingAlpha) {
    return lerp(current, target, alpha);
}

// ============================================
// Face Analysis Functions
// ============================================

function detectMouthOpen(landmarks) {
    const upperLip = landmarks[13];
    const lowerLip = landmarks[14];
    const leftCorner = landmarks[61];
    const rightCorner = landmarks[291];
    
    const mouthHeight = distance(upperLip, lowerLip);
    const mouthWidth = distance(leftCorner, rightCorner);
    const ratio = mouthHeight / mouthWidth;
    
    return clamp((ratio - 0.1) / 0.4, 0, 1);
}

function detectEyebrowRaise(landmarks) {
    const leftEyeTop = landmarks[159];
    const leftEyebrow = landmarks[105];
    const leftEyeBottom = landmarks[145];
    
    const rightEyeTop = landmarks[386];
    const rightEyebrow = landmarks[334];
    const rightEyeBottom = landmarks[374];
    
    const leftEyeHeight = distance(leftEyeTop, leftEyeBottom);
    const leftBrowDistance = distance(leftEyebrow, leftEyeTop);
    const leftRaise = leftBrowDistance / leftEyeHeight;
    
    const rightEyeHeight = distance(rightEyeTop, rightEyeBottom);
    const rightBrowDistance = distance(rightEyebrow, rightEyeTop);
    const rightRaise = rightBrowDistance / rightEyeHeight;
    
    const avgRaise = (leftRaise + rightRaise) / 2;
    return clamp((avgRaise - 0.8) / 0.5, 0, 1);
}

function detectHeadTilt(landmarks) {
    const leftEye = landmarks[33];
    const rightEye = landmarks[263];
    
    const dx = rightEye.x - leftEye.x;
    const dy = rightEye.y - leftEye.y;
    const angleRad = Math.atan2(dy, dx);
    const angleDeg = angleRad * (180 / Math.PI);
    
    return clamp(angleDeg / 15, -1, 1);
}

function calculateEyeDistance(landmarks) {
    const leftEye = landmarks[33];
    const rightEye = landmarks[263];
    return distance(leftEye, rightEye);
}

function getNosePosition(landmarks) {
    const nose = landmarks[1];
    return { x: nose.x, y: nose.y };
}

function calculateAmbientLight(imageData) {
    const data = imageData.data;
    let totalBrightness = 0;
    const pixelCount = data.length / 4;
    
    for (let i = 0; i < data.length; i += 40) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        totalBrightness += (r * 0.299 + g * 0.587 + b * 0.114);
    }
    
    return totalBrightness / (pixelCount / 10);
}

// ============================================
// Hand Analysis Functions
// ============================================

function detectPinch(landmarks) {
    const thumbTip = landmarks[4];
    const indexTip = landmarks[8];
    const pinchDistance = distance(thumbTip, indexTip);
    
    return {
        isPinched: pinchDistance < 0.08,
        distance: pinchDistance,
        position: {
            x: (thumbTip.x + indexTip.x) / 2,
            y: (thumbTip.y + indexTip.y) / 2
        }
    };
}

// ============================================
// Drawing Functions
// ============================================

function drawFaceLandmarks(canvasCtx, landmarks, width, height) {
    canvasCtx.save();
    canvasCtx.scale(-1, 1);
    canvasCtx.translate(-width, 0);
    
    const keyPoints = [1, 33, 133, 159, 145, 13, 14, 61, 291, 263, 386, 374, 105, 334];
    for (const idx of keyPoints) {
        const point = landmarks[idx];
        if (point) {
            canvasCtx.beginPath();
            canvasCtx.arc(point.x * width, point.y * height, 3, 0, 2 * Math.PI);
            canvasCtx.fillStyle = '#4ECDC4';
            canvasCtx.fill();
        }
    }
    
    const nose = landmarks[1];
    if (nose) {
        canvasCtx.beginPath();
        canvasCtx.arc(nose.x * width, nose.y * height, 8, 0, 2 * Math.PI);
        canvasCtx.fillStyle = 'rgba(255, 107, 107, 0.8)';
        canvasCtx.fill();
        canvasCtx.strokeStyle = '#fff';
        canvasCtx.lineWidth = 2;
        canvasCtx.stroke();
    }
    
    canvasCtx.restore();
}

function drawHandLandmarks(canvasCtx, landmarks, width, height) {
    canvasCtx.save();
    canvasCtx.scale(-1, 1);
    canvasCtx.translate(-width, 0);
    
    for (const point of landmarks) {
        canvasCtx.beginPath();
        canvasCtx.arc(point.x * width, point.y * height, 4, 0, 2 * Math.PI);
        canvasCtx.fillStyle = '#FF6B6B';
        canvasCtx.fill();
    }
    
    const pinch = detectPinch(landmarks);
    if (pinch.isPinched) {
        canvasCtx.beginPath();
        canvasCtx.arc(pinch.position.x * width, pinch.position.y * height, 12, 0, 2 * Math.PI);
        canvasCtx.fillStyle = 'rgba(78, 205, 196, 0.6)';
        canvasCtx.fill();
    }
    
    canvasCtx.restore();
}

// ============================================
// MediaPipe Callbacks
// ============================================

function onFaceResults(results) {
    if (!Engine.isVisible) return;
    
    if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
        const landmarks = results.multiFaceLandmarks[0];
        const smoothed = smoothLandmarks(landmarks);
        
        // Update raw gesture state (will be smoothed in RAF loop)
        Engine.rawGestures.nosePosition = getNosePosition(smoothed);
        Engine.rawGestures.mouthOpen = detectMouthOpen(smoothed);
        Engine.rawGestures.eyebrowRaise = detectEyebrowRaise(smoothed);
        Engine.rawGestures.headTilt = detectHeadTilt(smoothed);
        Engine.rawGestures.eyeDistance = calculateEyeDistance(smoothed);
        Engine.rawGestures.isFaceDetected = true;
        
        
        // Ambient light check
        if (results.image && Engine.onAmbientLight) {
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = 100;
            tempCanvas.height = 100;
            const tempCtx = tempCanvas.getContext('2d');
            tempCtx.drawImage(results.image, 0, 0, 100, 100);
            const imageData = tempCtx.getImageData(0, 0, 100, 100);
            const brightness = calculateAmbientLight(imageData);
            Engine.onAmbientLight(brightness);
        }
    } else {
        Engine.rawGestures.isFaceDetected = false;
    }
}

function onHandsResults(results) {
    if (!Engine.isVisible) return;
    
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const landmarks = results.multiHandLandmarks[0];
        const pinch = detectPinch(landmarks);
        
        Engine.rawGestures.handPinch = pinch.isPinched;
        Engine.rawGestures.handPosition = pinch.position;
        Engine.rawGestures.isHandDetected = true;
        Engine.rawHandLandmarks = landmarks;
        
        if (Engine.onHandsResults) {
            Engine.onHandsResults(landmarks, Engine.gestures);
        }
    } else {
        Engine.rawGestures.isHandDetected = false;
        Engine.rawGestures.handPinch = false;
    }
}

// ============================================
// RAF Loop for Smooth DOM Updates
// ============================================

function startRafLoop() {
    if (Engine.rafId) return;
    
    function rafLoop(timestamp) {
        if (!Engine.isVisible) {
            Engine.rafId = requestAnimationFrame(rafLoop);
            return;
        }
        
        const deltaTime = timestamp - Engine.lastRafTime;
        Engine.lastRafTime = timestamp;
        
        // Smooth all gesture values
        Engine.gestures.nosePosition.x = smoothValue(
            Engine.gestures.nosePosition.x,
            Engine.rawGestures.nosePosition.x
        );
        Engine.gestures.nosePosition.y = smoothValue(
            Engine.gestures.nosePosition.y,
            Engine.rawGestures.nosePosition.y
        );
        Engine.gestures.mouthOpen = smoothValue(
            Engine.gestures.mouthOpen,
            Engine.rawGestures.mouthOpen
        );
        Engine.gestures.eyebrowRaise = smoothValue(
            Engine.gestures.eyebrowRaise,
            Engine.rawGestures.eyebrowRaise
        );
        Engine.gestures.headTilt = smoothValue(
            Engine.gestures.headTilt,
            Engine.rawGestures.headTilt
        );
        Engine.gestures.eyeDistance = smoothValue(
            Engine.gestures.eyeDistance,
            Engine.rawGestures.eyeDistance
        );
        Engine.gestures.handPosition.x = smoothValue(
            Engine.gestures.handPosition.x,
            Engine.rawGestures.handPosition.x
        );
        Engine.gestures.handPosition.y = smoothValue(
            Engine.gestures.handPosition.y,
            Engine.rawGestures.handPosition.y
        );
        
        // Boolean values - use direct assignment with small threshold
        Engine.gestures.handPinch = Engine.rawGestures.handPinch;
        Engine.gestures.isHandDetected = Engine.rawGestures.isHandDetected;
        Engine.gestures.isFaceDetected = Engine.rawGestures.isFaceDetected;
        
        // Clear tracking canvas and draw saved state
        if (Engine.trackingCtx && Engine.trackingCanvas) {
            Engine.trackingCtx.clearRect(0, 0, Engine.trackingCanvas.width, Engine.trackingCanvas.height);

            if (Engine.rawGestures.isFaceDetected && Engine.smoothedLandmarks) {
                drawFaceLandmarks(
                    Engine.trackingCtx,
                    Engine.smoothedLandmarks,
                    Engine.trackingCanvas.width,
                    Engine.trackingCanvas.height
                );
            }

            if (Engine.rawGestures.isHandDetected && Engine.rawHandLandmarks) {
                drawHandLandmarks(
                    Engine.trackingCtx,
                    Engine.rawHandLandmarks,
                    Engine.trackingCanvas.width,
                    Engine.trackingCanvas.height
                );
            }
        }

        // Call face callback with smoothed data
        if (Engine.onFaceResults && Engine.smoothedLandmarks) {
            Engine.onFaceResults(Engine.smoothedLandmarks, Engine.gestures);
        }
        
        Engine.rafId = requestAnimationFrame(rafLoop);
    }
    
    Engine.rafId = requestAnimationFrame(rafLoop);
}

function stopRafLoop() {
    if (Engine.rafId) {
        cancelAnimationFrame(Engine.rafId);
        Engine.rafId = null;
    }
}

// ============================================
// Page Visibility API
// ============================================

function handleVisibilityChange() {
    if (document.hidden) {
        Engine.isVisible = false;
        Engine.wasRunningBeforeHidden = Engine.isRunning;
        
        if (Engine.camera) {
            Engine.camera.stop();
            Engine.isRunning = false;
        }
        stopRafLoop();
    } else {
        Engine.isVisible = true;
        
        if (Engine.wasRunningBeforeHidden && Engine.hasPermission) {
            Engine.camera.start().then(() => {
                Engine.isRunning = true;
                startRafLoop();
            }).catch(err => {
                console.error('Failed to resume camera:', err);
            });
        }
    }
}

document.addEventListener('visibilitychange', handleVisibilityChange);

// ============================================
// Camera Permission
// ============================================

async function requestCameraPermission() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: 640, height: 480, facingMode: 'user' }
        });
        
        // Permission granted
        stream.getTracks().forEach(track => track.stop());
        Engine.hasPermission = true;
        
        // Hide camera modal
        const modal = document.getElementById('cameraModal');
        if (modal) modal.classList.remove('active');
        
        // Initialize and start
        await initEngine();
        await startEngine();
        
        return true;
    } catch (error) {
        console.error('Camera permission denied:', error);
        Engine.hasPermission = false;
        
        if (Engine.onError) {
            Engine.onError('Camera permission denied. Please allow camera access to use AR features.');
        }
        
        return false;
    }
}

// ============================================
// Initialization
// ============================================

function initTrackingCanvas() {
    Engine.trackingCanvas = document.getElementById('trackingCanvas');
    if (Engine.trackingCanvas) {
        Engine.trackingCanvas.width = 320;
        Engine.trackingCanvas.height = 240;
        Engine.trackingCtx = Engine.trackingCanvas.getContext('2d');
    }
}

async function initFaceMesh() {
    return new Promise((resolve, reject) => {
        try {
            Engine.faceMesh = new FaceMesh({
                locateFile: (file) => {
                    return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4/${file}`;
                }
            });
            
            Engine.faceMesh.setOptions({
                maxNumFaces: 1,
                refineLandmarks: true,
                minDetectionConfidence: 0.5,
                minTrackingConfidence: 0.5
            });
            
            Engine.faceMesh.onResults(onFaceResults);
            resolve();
        } catch (error) {
            reject(error);
        }
    });
}

async function initHands() {
    return new Promise((resolve, reject) => {
        try {
            Engine.hands = new Hands({
                locateFile: (file) => {
                    return `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4/${file}`;
                }
            });
            
            Engine.hands.setOptions({
                maxNumHands: 1,
                modelComplexity: 1,
                minDetectionConfidence: 0.5,
                minTrackingConfidence: 0.5
            });
            
            Engine.hands.onResults(onHandsResults);
            resolve();
        } catch (error) {
            reject(error);
        }
    });
}

async function initCamera() {
    return new Promise((resolve, reject) => {
        const videoElement = document.getElementById('inputVideo');
        if (!videoElement) {
            reject(new Error('Video element not found'));
            return;
        }
        
        Engine.camera = new Camera(videoElement, {
            onFrame: async () => {
                if (!Engine.isVisible) return;
                
                if (Engine.faceMesh) {
                    await Engine.faceMesh.send({ image: videoElement });
                }
                if (Engine.hands) {
                    await Engine.hands.send({ image: videoElement });
                }
            },
            width: 640,
            height: 480
        });
        
        resolve();
    });
}

async function initEngine() {
    if (Engine.isInitialized) return;
    
    try {
        initTrackingCanvas();
        await initFaceMesh();
        await initHands();
        await initCamera();
        
        Engine.isInitialized = true;
        console.log('✅ Engine initialized successfully');
    } catch (error) {
        console.error('❌ Engine initialization failed:', error);
        throw error;
    }
}

async function startEngine() {
    if (!Engine.isInitialized) {
        await initEngine();
    }
    
    if (!Engine.hasPermission) {
        const granted = await requestCameraPermission();
        if (!granted) return false;
    }
    
    if (Engine.camera) {
        try {
            await Engine.camera.start();
            Engine.isRunning = true;
            startRafLoop();
            console.log('✅ Engine started');
            return true;
        } catch (error) {
            console.error('❌ Failed to start camera:', error);
            if (Engine.onError) Engine.onError('Failed to start camera');
            return false;
        }
    }
    
    return false;
}

function stopEngine() {
    if (Engine.camera) {
        Engine.camera.stop();
        Engine.isRunning = false;
        stopRafLoop();
        console.log('⏹️ Engine stopped');
    }
}

// ============================================
// Public API
// ============================================

function setSmoothingAlpha(alpha) {
    Engine.smoothingAlpha = clamp(alpha, 0.01, 1);
}

function onFaceDetected(callback) {
    Engine.onFaceResults = callback;
}

function onHandsDetected(callback) {
    Engine.onHandsResults = callback;
}

function onLightChange(callback) {
    Engine.onAmbientLight = callback;
}

function onError(callback) {
    Engine.onError = callback;
}

function getGestures() {
    return { ...Engine.gestures };
}

function isEngineRunning() {
    return Engine.isRunning;
}

function hasCameraPermission() {
    return Engine.hasPermission;
}

// ============================================
// Export
// ============================================

Object.assign(Engine, {
    init: initEngine,
    start: startEngine,
    stop: stopEngine,
    requestCameraPermission,
    setSmoothingAlpha,
    onFaceDetected,
    onHandsDetected,
    onLightChange,
    onError,
    getGestures,
    isRunning: isEngineRunning,
    hasPermission: hasCameraPermission,
    lerp,
    distance,
    clamp,
    smoothValue
});

window.Engine = Engine;
