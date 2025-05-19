const videoInput = document.getElementById('videoInput');
const overlayCanvas = document.getElementById('overlayCanvas');
const stopwatchDisplay = document.getElementById('stopwatch-display');
const statusIndicator = document.getElementById('status-indicator');
const container = document.querySelector('.container');

let faceDetectionInitialized = false;
let mediaStream = null;

// Stopwatch variables
let startTime = 0;
let elapsedTime = 0;
let timerInterval = null;
let isRunning = false;
let isPausedByDetection = true;

// Detection state
let isPersonPresent = false;
let isStudying = false;

// Format time as HH:MM:SS
function formatTime(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

// Update stopwatch display
function updateStopwatchDisplay() {
    const currentTime = Date.now();
    const currentElapsedTime = elapsedTime + (isRunning ? (currentTime - startTime) : 0);
    stopwatchDisplay.textContent = formatTime(currentElapsedTime);
}

// Start stopwatch
function startStopwatch() {
    if (isRunning) return;
    isRunning = true;
    startTime = Date.now() - elapsedTime;
    timerInterval = setInterval(updateStopwatchDisplay, 1000);
    console.log("Stopwatch Started");
}

// Pause stopwatch
function pauseStopwatch() {
    if (!isRunning) return;
    isRunning = false;
    clearInterval(timerInterval);
    elapsedTime += Date.now() - startTime;
    console.log("Stopwatch Paused");
}

// Update status label
function setStatus(text, className) {
    statusIndicator.textContent = text;
    statusIndicator.className = 'status-indicator ' + className;
}

// Detection loop
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

    const detections = await faceapi.detectSingleFace(videoInput, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks();

    isPersonPresent = !!detections;
    isStudying = isPersonPresent; // ✅ Face detected = studying

    if (isStudying) {
        setStatus("Studying...", "studying");
        if (isPausedByDetection) {
            startStopwatch();
            isPausedByDetection = false;
        }
    } else {
        if (isPersonPresent) {
            setStatus("Distracted...", "distracted");
        } else {
            setStatus("Person Not Found", "distracted");
        }
        if (isRunning) {
            pauseStopwatch();
            isPausedByDetection = true;
        }
    }

    // Draw on canvas if face is detected
    const ctx = overlayCanvas.getContext('2d');
    ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    if (detections) {
        const resizedDetections = faceapi.resizeResults(detections, displaySize);
        faceapi.draw.drawDetections(overlayCanvas, resizedDetections);
        faceapi.draw.drawFaceLandmarks(overlayCanvas, resizedDetections);
    }

    requestAnimationFrame(onPlay);
}

// Load models and start camera
async function initializeFaceDetection() {
    setStatus("Loading models...", "loading");
    try {
        const modelPath = 'models'; // ✅ relative path

        await faceapi.nets.tinyFaceDetector.loadFromUri(modelPath);
        await faceapi.nets.faceLandmark68Net.loadFromUri(modelPath);

        faceDetectionInitialized = true;
        setStatus("Ready. Grant camera access.", "ready");
        console.log("Face API models loaded.");
        await setupCamera();
    } catch (error) {
        console.error("Error loading face-api models:", error);
        setStatus("Error loading models!", "camera-error");
    }
}

// Set up camera
async function setupCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setStatus("Error: Camera not supported", "camera-error");
        return;
    }

    setStatus("Requesting camera access...", "loading");
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        mediaStream = stream;
        videoInput.srcObject = stream;

        videoInput.addEventListener('play', onPlay);
        videoInput.addEventListener('loadedmetadata', () => {
            const videoWidth = videoInput.videoWidth || 640;
            const videoHeight = videoInput.videoHeight || 480;
            videoInput.width = videoWidth;
            videoInput.height = videoHeight;

            container.style.width = `${videoWidth}px`;
            videoInput.style.width = '100%';
            overlayCanvas.style.width = '100%';

            setStatus("Camera Ready", "ready");
        });
    } catch (error) {
        console.error("Error accessing camera:", error);
        setStatus("Error accessing camera!", "camera-error");
        if (isRunning) {
            pauseStopwatch();
            isPausedByDetection = true;
        }
    }
}

// Initialize everything
elapsedTime = 0;
pauseStopwatch();
updateStopwatchDisplay();
initializeFaceDetection();
