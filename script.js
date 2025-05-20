const videoInput = document.getElementById('videoInput');
const overlayCanvas = document.getElementById('overlay');
const statusText = document.getElementById('status');
const timerDisplay = document.getElementById('timer');
const container = document.querySelector('.container');

let faceDetectionInitialized = false;
let isStudying = false;
let elapsedSeconds = 0;
let intervalId = null;

function setStatus(message, type) {
    statusText.textContent = message;
    statusText.className = '';
    if (type) statusText.classList.add(type);
}

function formatTime(seconds) {
    const hrs = String(Math.floor(seconds / 3600)).padStart(2, '0');
    const mins = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
    const secs = String(seconds % 60).padStart(2, '0');
    return `${hrs}:${mins}:${secs}`;
}

function startTimer() {
    if (!intervalId) {
        intervalId = setInterval(() => {
            elapsedSeconds++;
            timerDisplay.textContent = formatTime(elapsedSeconds);
        }, 1000);
    }
}

function stopTimer() {
    clearInterval(intervalId);
    intervalId = null;
}

function updateStudyState(studying) {
    if (studying && !isStudying) {
        startTimer();
        setStatus("Studying...", "studying");
    } else if (!studying && isStudying) {
        stopTimer();
        setStatus("Not detected", "not-studying");
    }
    isStudying = studying;
}

async function initializeFaceDetection() {
    setStatus("Loading models...", "loading");
    try {
        const modelPath = 'models';

        // ✅ Load both tiny face detector and landmark model
        await faceapi.nets.tinyFaceDetector.loadFromUri(modelPath);
        await faceapi.nets.faceLandmark68Net.loadFromUri(modelPath);

        faceDetectionInitialized = true;
        setStatus("Ready. Grant camera access.", "ready");
        await setupCamera();
    } catch (error) {
        console.error("Model loading error:", error);
        setStatus("Error loading models!", "camera-error");
    }
}

async function setupCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        videoInput.srcObject = stream;
    } catch (error) {
        console.error("Camera access error:", error);
        setStatus("Camera access denied", "camera-error");
    }
}

videoInput.addEventListener('loadedmetadata', () => {
    // ✅ Wait until video has actual size (fix for phones)
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
            startDetectionLoop();
        }
    }, 100);
});

async function startDetectionLoop() {
    const displaySize = { width: videoInput.videoWidth, height: videoInput.videoHeight };
    faceapi.matchDimensions(overlayCanvas, displaySize);

    setInterval(async () => {
        if (!faceDetectionInitialized) return;

        const detection = await faceapi
            .detectSingleFace(videoInput, new faceapi.TinyFaceDetectorOptions())
            .withFaceLandmarks();

        const ctx = overlayCanvas.getContext('2d');
        ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

        if (detection) {
            const resizedDetections = faceapi.resizeResults(detection, displaySize);
            faceapi.draw.drawDetections(overlayCanvas, resizedDetections);
            // faceapi.draw.drawFaceLandmarks(overlayCanvas, resizedDetections);
            updateStudyState(true);
        } else {
            updateStudyState(false);
        }
    }, 1000);
}

// Start everything
initializeFaceDetection();
