const imageInput = document.getElementById('imageInput');
const videoInput = document.getElementById('videoInput');
const inputCanvas = document.getElementById('inputCanvas');
const outputCanvas = document.getElementById('outputCanvas');
const hexSizeSlider = document.getElementById('hexSize');
const hexSizeValue = document.getElementById('hexSizeValue');
const minHexSizeSlider = document.getElementById('minHexSize');
const minHexSizeValue = document.getElementById('minHexSizeValue');
const jitterSpeedSlider = document.getElementById('jitterSpeed');
const jitterSpeedValue = document.getElementById('jitterSpeedValue');
const fgColorInput = document.getElementById('fgColor');
const bgColorInput = document.getElementById('bgColor');
const waveAnimationToggle = document.getElementById('waveAnimation');
const waveControls = document.getElementById('waveControls');
const waveSpeedSlider = document.getElementById('waveSpeed');
const waveSpeedValue = document.getElementById('waveSpeedValue');
const waveSizeSlider = document.getElementById('waveSize');
const waveSizeValue = document.getElementById('waveSizeValue');
const waveDirectionSlider = document.getElementById('waveDirection');
const waveDirectionValue = document.getElementById('waveDirectionValue');
const waveShapeSelect = document.getElementById('waveShape');
const interactiveModeToggle = document.getElementById('interactiveMode');
const interactiveRadiusSlider = document.getElementById('interactiveRadius');
const interactiveRadiusValue = document.getElementById('interactiveRadiusValue');
const downloadBtn = document.getElementById('downloadBtn');
const downloadAnimatedBtn = document.getElementById('downloadAnimatedBtn');
const downloadEmbedBtn = document.getElementById('downloadEmbedBtn');
const playPauseBtn = document.getElementById('playPauseBtn');
const downloadFormat = document.getElementById('downloadFormat');
const downloadFormatWrapper = document.getElementById('downloadFormatWrapper');

let inputImage = null;
let inputVideo = null;
let imageData = null;
let isProcessingVideo = false;
let videoAnimationFrame = null;
let mediaRecorder = null;
let recordedChunks = [];
let isRecording = false;
let captureHexagons = false;
let lastHexagons = [];
let lastHexagonCanvasSize = { width: 0, height: 0 };
let isWaveAnimating = false;
let waveAnimationFrame = null;
let waveStartTime = 0;
let isInteractiveMode = false;
let hasInteractivePointer = false;
let interactivePointerX = 0;
let interactivePointerY = 0;
let isInteractiveAnimating = false;
let interactiveAnimationFrame = null;
let interactiveStartTime = 0;

// Hexagon geometry constants
const HEX_WIDTH_RATIO = Math.sqrt(3); // width = size * sqrt(3)

// Create hidden video element for processing
const videoElement = document.createElement('video');
videoElement.style.display = 'none';
videoElement.muted = true;
videoElement.playsInline = true;
document.body.appendChild(videoElement);

// Initialize
hexSizeSlider.addEventListener('input', (e) => {
    hexSizeValue.textContent = e.target.value;
    if (inputImage) processImage();
    // Video will update automatically in the animation loop
});

minHexSizeSlider.addEventListener('input', (e) => {
    minHexSizeValue.textContent = e.target.value;
    if (inputImage) processImage();
    // Video will update automatically in the animation loop
});

if (jitterSpeedSlider && jitterSpeedValue) {
    jitterSpeedValue.textContent = parseFloat(jitterSpeedSlider.value).toFixed(1);
    jitterSpeedSlider.addEventListener('input', (e) => {
        jitterSpeedValue.textContent = parseFloat(e.target.value).toFixed(1);
        // Speed change will be picked up automatically on the next animation
        // frame; no need to force a re-render here.
    });
}

if (fgColorInput) {
    fgColorInput.addEventListener('input', () => {
        if (inputImage) processImage();
        // Video will update automatically in the animation loop
    });
}

if (bgColorInput) {
    bgColorInput.addEventListener('input', () => {
        if (inputImage) processImage();
        // Video will update automatically in the animation loop
    });
}

if (waveAnimationToggle) {
    waveAnimationToggle.addEventListener('change', (e) => {
        if (waveControls) {
            waveControls.style.display = e.target.checked ? 'block' : 'none';
        }
        if (downloadAnimatedBtn) {
            downloadAnimatedBtn.style.display = (e.target.checked && inputImage && !inputVideo) ? 'inline-block' : 'none';
        }
        if (downloadEmbedBtn) {
            downloadEmbedBtn.style.display = (inputImage && !inputVideo) ? 'inline-block' : 'none';
            downloadEmbedBtn.disabled = !(inputImage && !inputVideo);
        }
        if (e.target.checked) {
            startWaveAnimation();
        } else {
            stopWaveAnimation();
            if (inputImage) processImage();
        }
    });
}

if (waveSpeedSlider && waveSpeedValue) {
    waveSpeedSlider.addEventListener('input', (e) => {
        waveSpeedValue.textContent = parseFloat(e.target.value).toFixed(1);
        if (isWaveAnimating && inputImage) {
            // Restart animation to apply new speed
            stopWaveAnimation();
            startWaveAnimation();
        }
    });
}

if (waveSizeSlider && waveSizeValue) {
    waveSizeSlider.addEventListener('input', (e) => {
        waveSizeValue.textContent = parseFloat(e.target.value).toFixed(2);
        if (isWaveAnimating && inputImage) {
            // Restart animation to apply new size
            stopWaveAnimation();
            startWaveAnimation();
        }
    });
}

if (waveDirectionSlider && waveDirectionValue) {
    waveDirectionSlider.addEventListener('input', (e) => {
        waveDirectionValue.textContent = e.target.value + '°';
        if (isWaveAnimating && inputImage) {
            // Restart animation to apply new direction
            stopWaveAnimation();
            startWaveAnimation();
        }
    });
}

if (waveShapeSelect) {
    waveShapeSelect.addEventListener('change', () => {
        if (isWaveAnimating && inputImage) {
            // Restart animation to apply new shape
            stopWaveAnimation();
            startWaveAnimation();
        }
    });
}

if (interactiveModeToggle) {
    interactiveModeToggle.addEventListener('change', (e) => {
        isInteractiveMode = e.target.checked;
        // When toggling interactive mode, reset pointer state and stop any
        // interactive animation, then re-render once.
        hasInteractivePointer = false;
        stopInteractiveAnimation();
        if (inputImage && !isWaveAnimating) {
            processImage();
        }
    });
}

if (interactiveRadiusSlider && interactiveRadiusValue) {
    interactiveRadiusValue.textContent = interactiveRadiusSlider.value;
    interactiveRadiusSlider.addEventListener('input', (e) => {
        interactiveRadiusValue.textContent = e.target.value;
        if (inputImage && isInteractiveMode && !isWaveAnimating) {
            processImage();
        }
    });
}

function startWaveAnimation() {
    if (!inputImage || isWaveAnimating) return;
    isWaveAnimating = true;
    // Wave animation owns the render loop while active.
    stopInteractiveAnimation();
    waveStartTime = performance.now();
    
    const animate = (now) => {
        if (!isWaveAnimating) return;
        const t = (now - waveStartTime) / 1000; // seconds
        processImage(t);
        waveAnimationFrame = requestAnimationFrame(animate);
    };
    
    waveAnimationFrame = requestAnimationFrame(animate);
}

function stopWaveAnimation() {
    isWaveAnimating = false;
    if (waveAnimationFrame) {
        cancelAnimationFrame(waveAnimationFrame);
        waveAnimationFrame = null;
    }
    // If interactive hover is active, hand control back to the interactive
    // animation loop so vibration continues.
    if (isInteractiveMode && hasInteractivePointer && inputImage) {
        startInteractiveAnimation();
    }
}

function startInteractiveAnimation() {
    if (
        !inputImage ||
        isWaveAnimating ||
        isInteractiveAnimating ||
        !isInteractiveMode ||
        !hasInteractivePointer
    ) return;

    isInteractiveAnimating = true;
    interactiveStartTime = performance.now();

    const animate = (now) => {
        if (
            !isInteractiveAnimating ||
            !isInteractiveMode ||
            !hasInteractivePointer ||
            !inputImage ||
            isWaveAnimating
        ) {
            isInteractiveAnimating = false;
            interactiveAnimationFrame = null;
            return;
        }

        const t = (now - interactiveStartTime) / 1000; // seconds
        processImage(t);
        interactiveAnimationFrame = requestAnimationFrame(animate);
    };

    interactiveAnimationFrame = requestAnimationFrame(animate);
}

function stopInteractiveAnimation() {
    isInteractiveAnimating = false;
    if (interactiveAnimationFrame) {
        cancelAnimationFrame(interactiveAnimationFrame);
        interactiveAnimationFrame = null;
    }
}

// Swatch handling
document.querySelectorAll('.color-swatch[data-role="fg-swatch"]').forEach((btn) => {
    btn.addEventListener('click', () => {
        const color = btn.getAttribute('data-color');
        if (color && fgColorInput) {
            fgColorInput.value = color;
            if (inputImage) processImage();
        }
    });
});

document.querySelectorAll('.color-swatch[data-role="bg-swatch"]').forEach((btn) => {
    btn.addEventListener('click', () => {
        const color = btn.getAttribute('data-color');
        if (color && bgColorInput) {
            bgColorInput.value = color;
            if (inputImage) processImage();
        }
    });
});

imageInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        // Stop video processing if active
        stopVideoProcessing();
        videoInput.value = '';
        playPauseBtn.style.display = 'none';
        playPauseBtn.disabled = true;
        if (downloadEmbedBtn) {
            downloadEmbedBtn.style.display = 'none';
            downloadEmbedBtn.disabled = true;
        }
        
        // Clean up video URL if exists
        if (videoElement.src) {
            URL.revokeObjectURL(videoElement.src);
            videoElement.src = '';
        }
        
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                inputImage = img;
                inputVideo = null;
                displayInputImage();
                processImage();
                downloadBtn.disabled = false;
                downloadBtn.textContent = 'Download Image';
                downloadFormatWrapper.style.display = 'flex';
                downloadFormat.value = 'png';
                playPauseBtn.style.display = 'none';
                if (downloadAnimatedBtn) {
                    downloadAnimatedBtn.disabled = false;
                    downloadAnimatedBtn.style.display = waveAnimationToggle && waveAnimationToggle.checked ? 'inline-block' : 'none';
                }
                if (downloadEmbedBtn) {
                    downloadEmbedBtn.disabled = false;
                    downloadEmbedBtn.style.display = 'inline-block';
                }
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    }
});

videoInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        // Stop video processing if active
        stopVideoProcessing();
        imageInput.value = '';
        if (downloadEmbedBtn) {
            downloadEmbedBtn.style.display = 'none';
            downloadEmbedBtn.disabled = true;
        }
        
        // Clean up previous video URL if exists
        if (videoElement.src) {
            URL.revokeObjectURL(videoElement.src);
        }
        
        const url = URL.createObjectURL(file);
        videoElement.src = url;
        inputVideo = videoElement;
        inputImage = null;
        
        videoElement.onloadedmetadata = () => {
            setupVideoCanvas();
            startVideoProcessing();
            downloadBtn.disabled = false;
            downloadBtn.textContent = 'Download Video';
            playPauseBtn.disabled = false;
            playPauseBtn.style.display = 'inline-block';
            playPauseBtn.textContent = 'Pause';
            downloadFormatWrapper.style.display = 'none';
            if (downloadAnimatedBtn) {
                downloadAnimatedBtn.style.display = 'none';
            }
            if (downloadEmbedBtn) {
                downloadEmbedBtn.style.display = 'none';
                downloadEmbedBtn.disabled = true;
            }
        };
        
        videoElement.onended = () => {
            stopVideoProcessing();
            playPauseBtn.textContent = 'Play';
            downloadBtn.textContent = 'Download Video';
        };
    }
});

playPauseBtn.addEventListener('click', () => {
    if (!inputVideo) return;
    
    if (videoElement.paused) {
        videoElement.play();
        startVideoProcessing();
        playPauseBtn.textContent = 'Pause';
    } else {
        videoElement.pause();
        stopVideoProcessing();
        playPauseBtn.textContent = 'Play';
    }
});

downloadBtn.addEventListener('click', async () => {
    if (inputVideo) {
        // Record and download video
        if (isRecording) {
            // Already recording, do nothing or show message
            return;
        }
        await recordAndDownloadVideo();
    } else {
        const format = downloadFormat.value;
        if (format === 'svg') {
            exportAsSVG();
        } else {
            const link = document.createElement('a');
            link.download = 'hexagon-dithered.png';
            link.href = outputCanvas.toDataURL();
            link.click();
        }
    }
});

if (downloadAnimatedBtn) {
    downloadAnimatedBtn.addEventListener('click', async () => {
        if (!inputImage || isRecording || !isWaveAnimating) return;
        await recordAndDownloadAnimatedImage();
    });
}

if (downloadEmbedBtn) {
    downloadEmbedBtn.addEventListener('click', () => {
        if (!inputImage || inputVideo) return;
        exportEmbeddableAnimatedHTML();
    });
}

if (outputCanvas) {
    outputCanvas.addEventListener('mousemove', (e) => {
        if (!isInteractiveMode || !inputImage) return;
        const rect = outputCanvas.getBoundingClientRect();
        const scaleX = outputCanvas.width / rect.width;
        const scaleY = outputCanvas.height / rect.height;
        interactivePointerX = (e.clientX - rect.left) * scaleX;
        interactivePointerY = (e.clientY - rect.top) * scaleY;
        hasInteractivePointer = true;

        // For static images, ensure the interactive animation loop is running
        // so vibration can play. For animated wave, that loop will pick up the
        // new pointer coordinates automatically.
        if (!isWaveAnimating) {
            startInteractiveAnimation();
        }
    });

    outputCanvas.addEventListener('mouseleave', () => {
        if (!isInteractiveMode || !inputImage) return;
        hasInteractivePointer = false;
        stopInteractiveAnimation();
        if (!isWaveAnimating) {
            processImage();
        }
    });
}

function displayInputImage() {
    // Determine the output canvas size (dithered image) - this is what we'll process
    const maxOutputWidth = 1000;
    const maxOutputHeight = 1000;
    
    let outputWidth = inputImage.width;
    let outputHeight = inputImage.height;
    
    if (outputWidth > maxOutputWidth || outputHeight > maxOutputHeight) {
        const ratio = Math.min(maxOutputWidth / outputWidth, maxOutputHeight / outputHeight);
        outputWidth = outputWidth * ratio;
        outputHeight = outputHeight * ratio;
    }
    
    // Set input canvas to same resolution (CSS will scale it to 30% for display)
    inputCanvas.width = outputWidth;
    inputCanvas.height = outputHeight;
    const ctx = inputCanvas.getContext('2d');
    ctx.drawImage(inputImage, 0, 0, outputWidth, outputHeight);
    
    // Get image data for processing at full output resolution
    imageData = ctx.getImageData(0, 0, outputWidth, outputHeight);
}

function setupVideoCanvas() {
    const ctx = inputCanvas.getContext('2d');
    const maxWidth = 600;
    const maxHeight = 600;
    
    let width = videoElement.videoWidth;
    let height = videoElement.videoHeight;
    
    if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = width * ratio;
        height = height * ratio;
    }
    
    inputCanvas.width = width;
    inputCanvas.height = height;
    videoElement.width = width;
    videoElement.height = height;
}

function startVideoProcessing() {
    if (!inputVideo) return;
    
    isProcessingVideo = true;
    videoElement.play();
    
    function processVideoFrame() {
        if (!isProcessingVideo || videoElement.paused || videoElement.ended) {
            stopVideoProcessing();
            return;
        }
        
        // Draw current video frame to input canvas
        const ctx = inputCanvas.getContext('2d');
        ctx.drawImage(videoElement, 0, 0, inputCanvas.width, inputCanvas.height);
        
        // Get image data for processing
        imageData = ctx.getImageData(0, 0, inputCanvas.width, inputCanvas.height);
        
        // Process the frame
        processImage();
        
        // Continue processing
        videoAnimationFrame = requestAnimationFrame(processVideoFrame);
    }
    
    processVideoFrame();
}

function stopVideoProcessing() {
    isProcessingVideo = false;
    if (videoAnimationFrame) {
        cancelAnimationFrame(videoAnimationFrame);
        videoAnimationFrame = null;
    }
    if (inputVideo && !isRecording) {
        videoElement.pause();
        videoElement.currentTime = 0;
    }
}

async function recordAndDownloadVideo() {
    if (!inputVideo || isRecording) return;
    
    // Stop current playback
    stopVideoProcessing();
    
    // Reset video to start
    videoElement.currentTime = 0;
    
    // Set up canvas stream for recording
    const stream = outputCanvas.captureStream(30); // 30 fps
    recordedChunks = [];
    
    // Set up MediaRecorder
    const options = { mimeType: 'video/webm;codecs=vp9' };
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options.mimeType = 'video/webm;codecs=vp8';
        if (!MediaRecorder.isTypeSupported(options.mimeType)) {
            options.mimeType = 'video/webm';
        }
    }
    
    mediaRecorder = new MediaRecorder(stream, options);
    
    mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
            recordedChunks.push(event.data);
        }
    };
    
    mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = 'hexagon-dithered-video.webm';
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
        
        isRecording = false;
        downloadBtn.disabled = false;
        downloadBtn.textContent = inputVideo ? 'Download Video' : 'Download Image';
        
        // Restart normal playback
        videoElement.currentTime = 0;
        startVideoProcessing();
    };
    
    // Start recording
    isRecording = true;
    downloadBtn.disabled = true;
    downloadBtn.textContent = 'Recording...';
    mediaRecorder.start();
    
    // Process video frame by frame
    isProcessingVideo = true;
    videoElement.play();
    
    function processAndRecordFrame() {
        if (videoElement.ended || !isRecording) {
            // Video finished or recording stopped
            if (mediaRecorder && mediaRecorder.state !== 'inactive') {
                mediaRecorder.stop();
            }
            stopVideoProcessing();
            return;
        }
        
        // Draw current video frame to input canvas
        const ctx = inputCanvas.getContext('2d');
        ctx.drawImage(videoElement, 0, 0, inputCanvas.width, inputCanvas.height);
        
        // Get image data for processing
        imageData = ctx.getImageData(0, 0, inputCanvas.width, inputCanvas.height);
        
        // Process the frame
        processImage();
        
        // Continue processing
        videoAnimationFrame = requestAnimationFrame(processAndRecordFrame);
    }
    
    processAndRecordFrame();
}

async function recordAndDownloadAnimatedImage() {
    if (!inputImage || isRecording || !isWaveAnimating) return;
    
    // Stop current wave animation temporarily
    const wasAnimating = isWaveAnimating;
    stopWaveAnimation();
    
    // Set up canvas stream for recording
    const stream = outputCanvas.captureStream(30); // 30 fps
    recordedChunks = [];
    
    // Set up MediaRecorder
    const options = { mimeType: 'video/webm;codecs=vp9' };
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options.mimeType = 'video/webm;codecs=vp8';
        if (!MediaRecorder.isTypeSupported(options.mimeType)) {
            options.mimeType = 'video/webm';
        }
    }
    
    mediaRecorder = new MediaRecorder(stream, options);
    
    mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
            recordedChunks.push(event.data);
        }
    };
    
    mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = 'hexagon-dithered-animated.webm';
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
        
        isRecording = false;
        if (downloadAnimatedBtn) {
            downloadAnimatedBtn.disabled = false;
            downloadAnimatedBtn.textContent = 'Download Animated';
        }
        
        // Restart wave animation if it was running
        if (wasAnimating && waveAnimationToggle && waveAnimationToggle.checked) {
            startWaveAnimation();
        }
    };
    
    // Start recording
    isRecording = true;
    if (downloadAnimatedBtn) {
        downloadAnimatedBtn.disabled = true;
        downloadAnimatedBtn.textContent = 'Recording...';
    }
    mediaRecorder.start();
    
    // Record for 3 seconds (adjust duration as needed)
    const recordingDuration = 3000; // 3 seconds in milliseconds
    const startTime = performance.now();
    
    // Restart wave animation for recording
    isWaveAnimating = true;
    waveStartTime = performance.now();
    
    function processAndRecordAnimatedFrame(now) {
        if (!isRecording) {
            if (mediaRecorder && mediaRecorder.state !== 'inactive') {
                mediaRecorder.stop();
            }
            stopWaveAnimation();
            return;
        }
        
        const elapsed = now - startTime;
        if (elapsed >= recordingDuration) {
            // Recording duration reached, stop recording
            if (mediaRecorder && mediaRecorder.state !== 'inactive') {
                mediaRecorder.stop();
            }
            stopWaveAnimation();
            return;
        }
        
        // Process frame with current time
        const t = (now - waveStartTime) / 1000; // seconds
        processImage(t);
        
        // Continue processing
        waveAnimationFrame = requestAnimationFrame(processAndRecordAnimatedFrame);
    }
    
    waveAnimationFrame = requestAnimationFrame(processAndRecordAnimatedFrame);
}

function exportAsSVG() {
    if (!lastHexagons.length || lastHexagonCanvasSize.width === 0) {
        // Ensure we have latest data
        processImage();
        if (!lastHexagons.length) return;
    }
    
    const { width, height } = lastHexagonCanvasSize;
    const bgColor = bgColorInput ? bgColorInput.value : '#ffffff';
    const svgParts = [];
    svgParts.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">`);
    svgParts.push(`<rect width="${width}" height="${height}" fill="${bgColor}"/>`);
    
    for (const hex of lastHexagons) {
        const points = [];
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI / 3) * i - Math.PI / 6;
            const size = hex.size ?? hex.baseSize;
            const px = hex.x + size * Math.cos(angle);
            const py = hex.y + size * Math.sin(angle);
            points.push(`${px.toFixed(2)},${py.toFixed(2)}`);
        }
        const fillColor = hex.color || (fgColorInput ? fgColorInput.value : '#000000');
        svgParts.push(`<polygon points="${points.join(' ')}" fill="${fillColor}"/>`);
    }
    
    svgParts.push('</svg>');
    
    const blob = new Blob(svgParts, { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = 'hexagon-dithered.svg';
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
}

function exportEmbeddableAnimatedHTML() {
    if (!lastHexagons.length || lastHexagonCanvasSize.width === 0) {
        processImage();
        if (!lastHexagons.length) return;
    }

    const { width, height } = lastHexagonCanvasSize;
    const bgColor = bgColorInput ? bgColorInput.value : '#ffffff';
    const fgColor = fgColorInput ? fgColorInput.value : '#000000';
    const minHexSize = parseInt(minHexSizeSlider.value);
    const maxHexSize = parseInt(hexSizeSlider.value);
    const cropInset = 12; // px crop on all sides (in SVG user units)
    const croppedWidth = Math.max(1, width - cropInset * 2);
    const croppedHeight = Math.max(1, height - cropInset * 2);

    // Bake current wave settings into the export (autoplay_fixed)
    const waveSpeed = waveSpeedSlider ? parseFloat(waveSpeedSlider.value) : 2.0;
    const waveStrength = waveSizeSlider ? parseFloat(waveSizeSlider.value) : 0.5;
    const waveDirectionDeg = waveDirectionSlider ? parseInt(waveDirectionSlider.value) : 90;
    const waveShape = waveShapeSelect ? waveShapeSelect.value : 'curved';

    // Build SVG polygons. Store per-hex attributes to replay animation in the embed.
    const svgPolys = [];
    for (let i = 0; i < lastHexagons.length; i++) {
        const hex = lastHexagons[i];
        const baseSize = hex.baseSize ?? hex.size;
        const fill = hex.color || fgColor;

        // Initial points at baseSize (time=0)
        const pts = [];
        for (let k = 0; k < 6; k++) {
            const angle = (Math.PI / 3) * k - Math.PI / 6;
            const px = hex.x + baseSize * Math.cos(angle);
            const py = hex.y + baseSize * Math.sin(angle);
            pts.push(`${px.toFixed(2)},${py.toFixed(2)}`);
        }

        svgPolys.push(
            `<polygon id="h${i}" data-x="${hex.x}" data-y="${hex.y}" data-base="${baseSize}" fill="${fill}" points="${pts.join(' ')}"/>`
        );
    }

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Hexagon Dither (Embed)</title>
  <style>
    html, body { height: 100%; width: 100%; margin: 0; }
    body { background: ${bgColor}; overflow: hidden; }
    svg { display: block; width: 100%; height: 100%; }
  </style>
</head>
<body>
  <svg xmlns="http://www.w3.org/2000/svg"
       viewBox="${cropInset} ${cropInset} ${croppedWidth} ${croppedHeight}"
       preserveAspectRatio="xMidYMid slice"
       width="${width}" height="${height}"
       aria-label="Hexagon dither animation">
    <rect x="${cropInset}" y="${cropInset}" width="${croppedWidth}" height="${croppedHeight}" fill="${bgColor}"></rect>
    ${svgPolys.join('\n    ')}
  </svg>
  <script>
    (function () {
      const WAVE_SPEED = ${JSON.stringify(waveSpeed)};
      const WAVE_STRENGTH = ${JSON.stringify(waveStrength)};
      const WAVE_DIR_DEG = ${JSON.stringify(waveDirectionDeg)};
      const WAVE_SHAPE = ${JSON.stringify(waveShape)};
      const MIN_HEX = ${JSON.stringify(minHexSize)};
      const MAX_HEX = ${JSON.stringify(maxHexSize)};

      const dirRad = (WAVE_DIR_DEG * Math.PI) / 180;
      const axisX = Math.cos(dirRad);
      const axisY = Math.sin(dirRad);
      const waveFrequency = 0.02;
      const baseAngles = [0,1,2,3,4,5].map(i => (Math.PI / 3) * i - Math.PI / 6);
      const cosA = baseAngles.map(a => Math.cos(a));
      const sinA = baseAngles.map(a => Math.sin(a));

      const polys = [];
      const polyNodes = document.querySelectorAll('polygon[id^=\"h\"]');
      for (let i = 0; i < polyNodes.length; i++) {
        const el = polyNodes[i];
        polys.push({
          el,
          x: parseFloat(el.dataset.x),
          y: parseFloat(el.dataset.y),
          base: parseFloat(el.dataset.base),
        });
      }

      const start = performance.now();

      function waveOffsetFromPhase(phase) {
        if (WAVE_SHAPE === 'flat') {
          const normalized = ((phase % (2 * Math.PI)) + (2 * Math.PI)) / (2 * Math.PI);
          return normalized < 0.5 ? (4 * normalized - 1) : (3 - 4 * normalized);
        }
        return Math.sin(phase);
      }

      function clamp(v, lo, hi) {
        return Math.max(lo, Math.min(hi, v));
      }

      function tick(now) {
        const t = (now - start) / 1000;
        for (let i = 0; i < polys.length; i++) {
          const p = polys[i];
          const dist = p.x * axisX + p.y * axisY;
          const phase = dist * waveFrequency + t * WAVE_SPEED;
          const off = waveOffsetFromPhase(phase);
          const size = clamp(p.base * (1 + off * WAVE_STRENGTH), MIN_HEX, MAX_HEX);

          // Update polygon points (pure vector deformation)
          // Build a short string without allocations from arrays each time.
          let s = '';
          for (let k = 0; k < 6; k++) {
            const px = p.x + size * cosA[k];
            const py = p.y + size * sinA[k];
            s += px.toFixed(2) + ',' + py.toFixed(2) + (k === 5 ? '' : ' ');
          }
          p.el.setAttribute('points', s);
        }
        requestAnimationFrame(tick);
      }

      requestAnimationFrame(tick);
    })();
  </script>
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = 'hexagon-dither-embed.html';
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
}

function processImage(time = 0) {
    if ((!inputImage && !inputVideo) || !imageData) return;
    
    const maxHexSize = parseInt(hexSizeSlider.value);
    const minHexSize = parseInt(minHexSizeSlider.value);
    const fgColor = fgColorInput ? fgColorInput.value : '#000000';
    const bgColor = bgColorInput ? bgColorInput.value : '#ffffff';
    const interactiveRadius = interactiveRadiusSlider ? parseFloat(interactiveRadiusSlider.value) : 0;

    const pseudoRandom = (i, j) => {
        const s = Math.sin(i * 12.9898 + j * 78.233) * 43758.5453;
        return s - Math.floor(s);
    };
    
    // Use imageData dimensions for processing (full resolution)
    const width = imageData.width;
    const height = imageData.height;
    const isImageMode = !inputVideo;
    
    // Set output canvas size
    outputCanvas.width = width;
    outputCanvas.height = height;
    
    if (isImageMode) {
        captureHexagons = true;
        lastHexagons = [];
        lastHexagonCanvasSize = { width, height };
    } else {
        captureHexagons = false;
    }
    
    const ctx = outputCanvas.getContext('2d');
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, width, height);
    
    // Create a working copy of image data for dithering
    const workingData = new ImageData(
        new Uint8ClampedArray(imageData.data),
        width,
        height
    );
    
    // Generate hexagon grid using max size for spacing
    // For flat-top hexagons: width = size * sqrt(3), vertical spacing = size * 1.5
    const hexWidth = maxHexSize * HEX_WIDTH_RATIO;
    const hexVerticalSpacing = maxHexSize * 1.5;
    const cols = Math.ceil(width / hexWidth) + 1;
    const rows = Math.ceil(height / hexVerticalSpacing) + 1;
    
    // Process each hexagon
    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            const x = col * hexWidth + (row % 2) * (hexWidth / 2);
            const y = row * hexVerticalSpacing;
            
            // Sample average brightness from hexagon area
            const brightness = sampleHexagonBrightness(workingData, x, y, maxHexSize, width, height);
            
            // Convert brightness (0-255, where 0 is black) to darkness (0-1, where 1 is black)
            // Invert: darker areas should have larger hexagons
            const darkness = 1 - (brightness / 255);
            
            // Calculate base hexagon size based on darkness
            // Light gray = small hex, 100% black = max size hex
            const baseHexSize = minHexSize + (maxHexSize - minHexSize) * darkness;

            // Wave modulation over time to create a traveling distortion
            let hexSize = baseHexSize;
            if (time > 0 || isWaveAnimating) {
                // Get wave parameters from controls
                const waveSpeed = waveSpeedSlider ? parseFloat(waveSpeedSlider.value) : 2.0;
                const waveStrength = waveSizeSlider ? parseFloat(waveSizeSlider.value) : 0.5;
                const waveDirectionDeg = waveDirectionSlider ? parseInt(waveDirectionSlider.value) : 90;
                const waveShape = waveShapeSelect ? waveShapeSelect.value : 'curved';
                
                // Convert direction to radians (0° = right, 90° = down, 180° = left, 270° = up)
                const waveDirectionRad = (waveDirectionDeg * Math.PI) / 180;
                
                // Project hex position onto wave direction axis
                // For a wave traveling perpendicular to the direction vector
                const waveAxisX = Math.cos(waveDirectionRad);
                const waveAxisY = Math.sin(waveDirectionRad);
                const distanceAlongWave = x * waveAxisX + y * waveAxisY;
                
                // Wave parameters
                const waveFrequency = 0.02; // spatial frequency
                const wavePhase = distanceAlongWave * waveFrequency + time * waveSpeed;
                
                // Calculate wave offset based on shape
                let waveOffset;
                if (waveShape === 'flat') {
                    // Triangle/sawtooth wave for flat shape
                    // Use modulo to create repeating pattern, then scale to -1 to 1
                    const normalized = (wavePhase % (2 * Math.PI)) / (2 * Math.PI);
                    waveOffset = normalized < 0.5 
                        ? 4 * normalized - 1  // Rising edge: -1 to 1
                        : 3 - 4 * normalized; // Falling edge: 1 to -1
                } else {
                    // Curved shape using sine wave
                    waveOffset = Math.sin(wavePhase);
                }
                
                // Apply wave modulation
                hexSize = baseHexSize * (1 + waveOffset * waveStrength);
            }

            // Clamp within allowed range
            hexSize = Math.max(minHexSize, Math.min(maxHexSize, hexSize));
            
            // For dithering: calculate what the "ideal" brightness should be for this size
            // and distribute the error
            const idealBrightness = 255 * (1 - (hexSize - minHexSize) / (maxHexSize - minHexSize));
            const error = brightness - idealBrightness;
            
            // Distribute error to neighboring pixels for dithering
            distributeBrightnessError(workingData, x, y, maxHexSize, error, width, height);

            // Interactive hover modulation: in interactive mode, hex centers
            // are pushed very slightly away from the cursor across a broad
            // radius, with a soft falloff. Size remains driven purely by
            // brightness and optional wave animation.
            let drawX = x;
            let drawY = y;
            let influence = 0;
            if (
                isInteractiveMode &&
                hasInteractivePointer &&
                interactiveRadius > 0 &&
                inputImage
            ) {
                const dx = x - interactivePointerX;
                const dy = y - interactivePointerY;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist > 0 && dist < interactiveRadius) {
                    const t = Math.max(0, Math.min(dist / interactiveRadius, 1));
                    const oneMinusT = 1 - t;
                    // Gentle smooth falloff across a wide radius.
                    const dispFactor = oneMinusT * oneMinusT * oneMinusT;
                    influence = dispFactor;
                    // Keep displacement small but noticeable: capped by a small
                    // fraction of radius and a small multiple of hex size.
                    const maxDisp = Math.min(maxHexSize * 2, interactiveRadius * 0.15);
                    const disp = dispFactor * maxDisp;
                    const ux = dx / dist;
                    const uy = dy / dist;

                    drawX = x + ux * disp;
                    drawY = y + uy * disp;

                    // Initial clamp to keep displaced centers within canvas
                    // bounds so hexes don't fly completely off-screen.
                    drawX = Math.max(0, Math.min(width, drawX));
                    drawY = Math.max(0, Math.min(height, drawY));
                }
            }

            // Subtle vibration: when an animation time is provided (from wave
            // or interactive animation loops), apply a tiny per-hex jitter
            // scaled by the same distance-based influence factor so it is
            // strongest near the cursor and fades out towards the edge.
            if (
                time > 0 &&
                influence > 0 &&
                isInteractiveMode &&
                inputImage
            ) {
                const jitterAmp = maxHexSize * 0.2;
                const jitterSpeed = jitterSpeedSlider ? parseFloat(jitterSpeedSlider.value) : 1.0;
                const jitterFreqBase = 1.0; // Hz
                const jitterFreq = jitterFreqBase * jitterSpeed;
                const phaseX = pseudoRandom(col, row) * 2 * Math.PI;
                const phaseY = pseudoRandom(row, col) * 2 * Math.PI;
                const jt = time;
                const jx = jitterAmp * Math.sin(jitterFreq * jt + phaseX);
                const jy = jitterAmp * 0.6 * Math.sin(jitterFreq * jt + phaseY);
                drawX += jx * influence;
                drawY += jy * influence;

                drawX = Math.max(0, Math.min(width, drawX));
                drawY = Math.max(0, Math.min(height, drawY));
            }

            // Draw hexagon with calculated size
            // Always draw, even tiny ones for very light areas
            if (hexSize >= 0.5) {
                drawHexagon(ctx, drawX, drawY, hexSize, fgColor, baseHexSize);
            }
        }
    }
    
    captureHexagons = false;
}

function sampleHexagonBrightness(imageData, centerX, centerY, maxSize, imgWidth, imgHeight) {
    let totalBrightness = 0;
    let count = 0;
    
    // Sample points within hexagon using max size
    const radius = maxSize;
    const step = Math.max(1, maxSize / 10);
    
    for (let y = -radius; y <= radius; y += step) {
        for (let x = -radius; x <= radius; x += step) {
            const distance = Math.sqrt(x * x + y * y);
            if (distance <= radius) {
                const px = Math.round(centerX + x);
                const py = Math.round(centerY + y);
                
                if (px >= 0 && px < imgWidth && py >= 0 && py < imgHeight) {
                    const idx = (py * imgWidth + px) * 4;
                    // Calculate luminance (brightness) using standard formula
                    const r = imageData.data[idx];
                    const g = imageData.data[idx + 1];
                    const b = imageData.data[idx + 2];
                    const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
                    totalBrightness += brightness;
                    count++;
                }
            }
        }
    }
    
    if (count === 0) return 255; // White if no samples
    
    return totalBrightness / count;
}

function distributeBrightnessError(imageData, centerX, centerY, size, error, imgWidth, imgHeight) {
    // Distribute brightness error to neighboring pixels for dithering
    const radius = size * 1.5;
    const step = Math.max(1, size / 5);
    
    for (let y = -radius; y <= radius; y += step) {
        for (let x = -radius; x <= radius; x += step) {
            const distance = Math.sqrt(x * x + y * y);
            if (distance > size && distance <= radius) {
                const px = Math.round(centerX + x);
                const py = Math.round(centerY + y);
                
                if (px >= 0 && px < imgWidth && py >= 0 && py < imgHeight) {
                    const idx = (py * imgWidth + px) * 4;
                    // Weight decreases with distance
                    const weight = 1 - (distance - size) / (radius - size);
                    const errorAmount = error * weight * 0.15;
                    
                    // Apply error to all RGB channels proportionally
                    imageData.data[idx] = Math.max(0, Math.min(255, 
                        imageData.data[idx] - errorAmount));
                    imageData.data[idx + 1] = Math.max(0, Math.min(255, 
                        imageData.data[idx + 1] - errorAmount));
                    imageData.data[idx + 2] = Math.max(0, Math.min(255, 
                        imageData.data[idx + 2] - errorAmount));
                }
            }
        }
    }
}

function drawHexagon(ctx, centerX, centerY, size, color, baseSize = null) {
    ctx.fillStyle = color || '#000000';
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i - Math.PI / 6; // Rotate to have flat top
        const x = centerX + size * Math.cos(angle);
        const y = centerY + size * Math.sin(angle);
        if (i === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    }
    ctx.closePath();
    ctx.fill();
    
    if (captureHexagons) {
        lastHexagons.push({ x: centerX, y: centerY, size, baseSize: baseSize ?? size, color: color || '#000000' });
    }
}

