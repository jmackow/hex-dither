# Hexagon Dithering App

A simple web application that applies a dithering effect to images using hexagonal patterns. The darkness of the image is represented by the size of black hexagons on a white background.

## Features

- Upload any image file or video file
- Apply hexagon-based dithering using only black and white
- Darkness is represented by hexagon size (light gray = small hexagons, black = large hexagons)
- Real-time video processing with play/pause controls
- Adjust maximum hexagon size (5-50 pixels)
- Adjust minimum hexagon size (1-10 pixels)
- Choose between PNG or SVG downloads for images
- Download the entire processed video as WebM
- Real-time preview of both original and processed content

## How to Use

### For Images:
1. Open `index.html` in a web browser
2. Click "Choose File" under "Image" and select an image
3. Adjust the "Max Hexagon Size" slider to control the maximum size of hexagons (for dark areas)
4. Adjust the "Min Hexagon Size" slider to control the minimum size of hexagons (for light areas)
5. The dithered image will appear automatically
6. Choose PNG or SVG in the "Image Format" dropdown
7. Click "Download Image" to save the processed image in the selected format

### For Videos:
1. Open `index.html` in a web browser
2. Click "Choose File" under "Video" and select a video file
3. The video will start playing automatically with the dithering effect applied in real-time
4. Use the "Pause" button to pause/resume playback
5. Adjust the hexagon size sliders to change the effect (updates in real-time)
6. Click "Download Video" to process and download the entire video with the dithering effect applied (the video will play through once while recording)

## Technical Details

The app uses:
- **Hexagonal Grid**: Creates a tessellating hexagonal pattern
- **Brightness Sampling**: Calculates average brightness within each hexagon area
- **Size-Based Representation**: Hexagon size directly represents darkness (larger = darker)
- **Error Diffusion**: Distributes brightness errors to neighboring hexagons for smoother gradients
- **Black and White Only**: All hexagons are black, with size varying based on image darkness

## Browser Compatibility

Works in all modern browsers that support:
- HTML5 Canvas API
- FileReader API
- ES6 JavaScript features

