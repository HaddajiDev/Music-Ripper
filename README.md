# Music Ripper

A browser extension that allows you to easily download YouTube videos as MP3 files directly from your browser. The extension works with a local Flask server to handle the conversion process.

## Features

- Convert YouTube videos to MP3 format with a single click
- Real-time download progress updates
- Custom filename option
- Background conversion process
- Automatic download upon completion

## Prerequisites

- Python 3.7+ installed on your system
- pip (Python package manager)
- A compatible web browser (Chrome, Edge, or Firefox)

## Installation and Setup

### Step 1: Set up the Flask Backend Server

1. Clone or download this repository to your local machine
2. Open a terminal/command prompt and navigate to the project directory
3. Install the required Python dependencies:

```bash
pip install -r requirements.txt
```

4. Start the Flask server:

```bash
python app.py
```

The server should start running on `http://localhost:5000`.

### Step 2: Install the Browser Extension

#### For Chrome or Edge:

1. Open Chrome/Edge and navigate to `chrome://extensions` or `edge://extensions`
2. Enable "Developer mode" using the toggle in the top-right corner
3. Click on "Load unpacked" button
4. Browse to the extension directory and select it
5. The extension should now appear in your browser toolbar

#### For Firefox:

1. Open Firefox and navigate to `about:debugging`
2. Click on "This Firefox" in the left sidebar
3. Click on "Load Temporary Add-on..."
4. Navigate to the extension directory and select the `manifest.json` file
5. The extension should now appear in your browser toolbar

## Usage

1. Make sure the Flask server is running in the background
2. Navigate to a YouTube video you want to convert
3. Click on the extension icon in your browser toolbar
4. Optionally, enter a custom filename for the MP3 file
5. Click the "Download MP3" button
6. Wait for the conversion to complete - you'll see real-time progress updates
7. Once complete, the MP3 file will automatically download to your default download location

## Troubleshooting

- **Extension can't connect to the server**: Make sure the Flask server is running on port 5000
- **Download fails**: Ensure you have a stable internet connection and the YouTube video is accessible
- **Permission errors**: Make sure you have write permissions in your download directory
- **Server errors**: Check the terminal where the Flask server is running for any error messages

## File Structure

- `app.py`: The Flask server for handling downloads and conversions
- `requirements.txt`: Python dependencies
- `manifest.json`: Extension configuration
- `popup.html`: Extension popup interface
- `popup.js`: JavaScript for the popup functionality
- `background.js`: Background script for handling downloads

## Notes

- The extension will only work when the Flask server is running locally
