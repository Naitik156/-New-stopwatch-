const videoInput = document.getElementById('videoInput');
const overlayCanvas = document.getElementById('overlay');
const timerDisplay = document.getElementById('timer');
const statusText = document.getElementById('statusText');
const container = document.querySelector('.stopwatch-container');

let isRunning = false;
let isPausedByDetection = false;
let isPersonPresent = false;
let isStudying = false;
let startTime = 0;
let elapsedTime = 0;
let stopwatchInterval = null;
let faceDetectionInitialized = false;

// Camera setup
async function setupCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        videoInput.srcObject = stream;

        videoInput.addEventListener('loadedmetadata', () => {
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
            }, 100);
        });
    } catch (error) {
        setStatus("Camera Access Denied", "error");
        console.error("Camera Error:", error);
    }
}

// Load models
async function initializeFaceDetection() {
    try {
        const MODEL_URL = './models';
        await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
        await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
        faceDetectionInitialized = true;
    } catch (error) {
        setStatus("Error loading models!", "error");
        console.error("Model Load Error:", error);
    }
}

// Draw status
function setStatus(text, type) {
    statusText.textContent = text;
    statusText.style.color =
        type === "ready" ? "green" :
        type === "studying" ? "green" :
        type === "distracted" ? "red" : "orange";
}

// Stopwatch logic
function startStopwatch() {
    if (!isRunning) {
        startTime = Date.now() - elapsedTime;
        stopwatchInterval = setInterval(updateDisplay, 1000);
        isRunning = true;
    }
}

function pauseStopwatch() {
    if (isRunning) {
        clearInterval(stopwatchInterval);
        elapsedTime = Date.now() - startTime;
        isRunning = false;
    }
}

function updateDisplay() {
    const time = Date.now() - startTime;
    const totalSeconds = Math.floor(time / 1000);
    const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
    const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
    const seconds = String(totalSeconds % 60).padStart(2, '0');
    timerDisplay.textContent = `${hours}:${minutes}:${seconds}`;
}

// Face detection loop
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

    let detections = null;

    // Try full detection
    try {
        detections = await faceapi
            .detectSingleFace(videoInput, new faceapi.TinyFaceDetectorOptions())
            .withFaceLandmarks();
    } catch (e) {
        detections = null;
    }

    // If failed, fallback
    if (!detections) {
        try {
            detections = await faceapi
                .detectSingleFace(videoInput, new faceapi.TinyFaceDetectorOptions());
        } catch (e) {
            detections = null;
        }
    }

    const faceBox = detections?.alignedRect || detections?.detection;
    isPersonPresent = !!faceBox;
    isStudying = !!faceBox;

    const ctx = overlayCanvas.getContext('2d');
    ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

    if (faceBox) {
        const resized = faceapi.resizeResults(detections, displaySize);
        faceapi.draw.drawDetections(overlayCanvas, resized);
        if (detections.landmarks) {
            faceapi.draw.drawFaceLandmarks(overlayCanvas, resized);
        }
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

// Init everything
async function init() {
    await setupCamera();
    await initializeFaceDetection();

    videoInput.addEventListener('play', () => {
        overlayCanvas.width = videoInput.width;
        overlayCanvas.height = videoInput.height;
        onPlay();
    });
}

init();
