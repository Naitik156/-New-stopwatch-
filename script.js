const videoInput = document.getElementById('videoInput');
const overlayCanvas = document.getElementById('overlayCanvas');
const stopwatchDisplay = document.getElementById('stopwatch-display');
const statusIndicator = document.getElementById('status-indicator');
const container = document.querySelector('.container');

let faceDetectionInitialized = false;
let mediaStream = null;

let startTime = 0;
let elapsedTime = 0;
let timerInterval = null;
let isRunning = false;
let isPausedByDetection = true;

let isPersonPresent = false;
let isStudying = false;

function formatTime(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function updateStopwatchDisplay() {
    const currentTime = Date.now();
    const totalElapsed = elapsedTime + (isRunning ? (currentTime - startTime) : 0);
    stopwatchDisplay.textContent = formatTime(totalElapsed);
}

function startStopwatch() {
    if (isRunning) return;

    if (isNaN(elapsedTime) || elapsedTime < 0 || elapsedTime > 1e9 * 60) {
        elapsedTime = 0;
    }

    isRunning = true;
    startTime = Date.now();
    timerInterval = setInterval(updateStopwatchDisplay, 1000);
    console.log("Stopwatch resumed from:", formatTime(elapsedTime));
}

function pauseStopwatch() {
    if (!isRunning) return;

    isRunning = false;
    clearInterval(timerInterval);
    elapsedTime += Date.now() - startTime;
    startTime = 0;
    console.log("Stopwatch paused at:", formatTime(elapsedTime));
}

function setStatus(text, className) {
    statusIndicator.textContent = text;
    statusIndicator.className = 'status-indicator ' + className;
}

async function onPlay() {
    if (!faceDetectionInitialized) {
        requestAnimationFrame(onPlay);
        return;
    }

    if (videoInput.paused || videoInput.ended) {
        setStatus("Video Paused/Ended", "paused");
        isPersonPresent = false;
        isStudying = false;
        requestAnimationFrame(onPlay);
        return;
    }

    const displaySize = { width: videoInput.width, height: videoInput.height };
    faceapi.matchDimensions(overlayCanvas, displaySize);

    const detections = await faceapi
        .detectSingleFace(videoInput, new faceapi.TinyFaceDetectorOptions());

    isPersonPresent = !!detections;
    isStudying = isPersonPresent;

    const ctx = overlayCanvas.getContext('2d');
    ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

    if (detections) {
        const resizedDetections = faceapi.resizeResults(detections, displaySize);
        faceapi.draw.drawDetections(overlayCanvas, resizedDetections);
        // faceapi.draw.drawFaceLandmarks(overlayCanvas, resizedDetections); // Not needed
    }

    if (isStudying) {
        setStatus("Studying...", "studying");
        if (isPausedByDetection) {
            startStopwatch();
            isPausedByDetection = false;
        }
    } else {
        setStatus("Not Studying", "distracted");
        if (isRunning) {
            pauseStopwatch();
            isPausedByDetection = true;
        }
    }

    requestAnimationFrame(onPlay);
}

async function initializeFaceDetection() {
    setStatus("Loading models...", "loading");
    try {
        const modelPath = 'models';

        await faceapi.nets.tinyFaceDetector.loadFromUri(modelPath);
        faceDetectionInitialized = true;
        setStatus("Ready. Grant camera access.", "ready");
        await setupCamera();
    } catch (error) {
        console.error("Model loading error:", error);
        setStatus("Error loading models!", "camera-error");
    }
}

async function setupCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setStatus("Camera not supported", "camera-error");
        return;
    }

    setStatus("Requesting camera access...", "loading");

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        mediaStream = stream;
        videoInput.srcObject = stream;

        videoInput.addEventListener('play', onPlay);

        videoInput.addEventListener('loadedmetadata', () => {
            // ✅ MOBILE FIX: Wait for actual video size
            let checkReady = setInterval(() => {
                if (videoInput.videoWidth && videoInput.videoHeight) {
                    clearInterval(checkReady);

                    const videoWidth = videoInput.videoWidth;
                    const videoHeight = videoInput.videoHeight;

                    videoInput.width = videoWidth;
                    videoInput.height = videoHeight;

                    container.style.width = `${videoWidth}px`;
                    videoInput.style.width = '100%';
                    overlayCanvas.style.width = '100%';

                    setStatus("Camera Ready", "ready");
                }
            }, 100); // check every 100ms
        });
    } catch (error) {
        console.error("Camera access error:", error);
        setStatus("Camera error", "camera-error");
        if (isRunning) {
            pauseStopwatch();
            isPausedByDetection = true;
        }
    }
}

// ✅ Initial Reset
elapsedTime = 0;
startTime = 0;
isRunning = false;
isPausedByDetection = true;
updateStopwatchDisplay();
initializeFaceDetection();
