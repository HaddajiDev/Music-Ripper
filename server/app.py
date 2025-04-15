import os
import uuid
import threading
import time
import json
import tempfile
from flask import Flask, request, send_file, render_template_string, jsonify
from werkzeug.utils import secure_filename
import yt_dlp
from flask_cors import CORS
import re

app = Flask(__name__)
CORS(app)

app.config['COOKIE_DIR'] = os.path.join(tempfile.gettempdir(), 'yt_cookies')
os.makedirs(app.config['COOKIE_DIR'], exist_ok=True)

downloads = {}

def cleanup_file(filepath):
    try:
        os.remove(filepath)
    except Exception as e:
        app.logger.error(f"Error removing file {filepath}: {e}")


def strip_ansi_codes(text):
    ansi_escape = re.compile(r'\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])')
    return ansi_escape.sub('', text)

class DownloadProgressHook:
    def __init__(self, download_id):
        self.download_id = download_id
        downloads[download_id]['progress'] = 'Initializing download...'
    
    def __call__(self, d):
        if d['status'] == 'downloading':
            percent = d.get('_percent_str', '0%').strip()
            downloaded = d.get('downloaded_bytes', 0)
            total = d.get('total_bytes_estimate', 0) or d.get('total_bytes', 0)
            speed = d.get('_speed_str', '0 KiB/s').strip()
            eta = d.get('_eta_str', 'unknown').strip()
            
            size_str = ""
            if total > 0:
                size_mb = round(total / (1024 * 1024), 2)
                size_str = f"{size_mb} MiB"
            
            progress_message = f"{percent}, {size_str} at {speed} ETA {eta}"
            
            progress_message = strip_ansi_codes(progress_message)
            
            downloads[self.download_id]['progress'] = progress_message
        elif d['status'] == 'finished':
            downloads[self.download_id]['progress'] = 'Processing audio...'

@app.route('/upload-cookies', methods=['POST'])
def upload_cookies():
    try:
        cookie_data = request.json.get('cookies')
        if not cookie_data:
            return jsonify(error="No cookie data provided"), 400
            
        cookie_path = os.path.join(app.config['COOKIE_DIR'], 'youtube_cookies.json')
        with open(cookie_path, 'w') as f:
            json.dump(cookie_data, f)
            
        return jsonify({'success': True, 'message': 'Cookies uploaded successfully'})
    except Exception as e:
        return jsonify({'error': f'Failed to upload cookies: {str(e)}'}), 500

@app.route('/download-with-progress', methods=['POST'])
def download_with_progress():
    data = request.json
    url = data.get('url')
    if not url:
        return jsonify(error="YouTube URL is required"), 400

    try:
        download_id = str(uuid.uuid4())
        
        # Check if we have stored cookies
        cookie_path = os.path.join(app.config['COOKIE_DIR'], 'youtube_cookies.json')
        if os.path.exists(cookie_path):
            ydl_opts = {'quiet': True, 'cookiefile': cookie_path}
        else:
            ydl_opts = {'quiet': True}
            
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info_dict = ydl.extract_info(url, download=False)
            title = info_dict.get('title', 'video')
        
        custom_filename = data.get('filename', '').strip()
        base_name = secure_filename(custom_filename) if custom_filename else secure_filename(title)
        filename = f"{base_name}.mp3"
        
        downloads[download_id] = {
            'status': 'starting',
            'progress': 'Preparing download...',
            'filename': filename,
            'filepath': None,
            'url': url,
            'started_at': time.time()
        }
        
        threading.Thread(target=process_download, args=(download_id, url, filename)).start()
        
        return jsonify({
            'download_id': download_id,
            'status': 'started'
        })
        
    except Exception as e:
        error_msg = str(e)
        # Check for YouTube authentication errors
        if "sign in" in error_msg.lower() or "bot" in error_msg.lower():
            error_msg = "YouTube requires authentication. Please use the 'Authenticate with YouTube' button in the extension."
        return jsonify(error=f"Error processing video: {error_msg}"), 500

def process_download(download_id, url, filename):
    try:
        temp_dir = "/tmp"
        output_path = os.path.join(temp_dir, download_id)
        filepath = f"{output_path}.mp3"
        
        downloads[download_id]['filepath'] = filepath
        downloads[download_id]['status'] = 'downloading'
        
        ydl_opts = {
            'format': 'bestaudio/best',
            'postprocessors': [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'mp3',
                'preferredquality': '192',
            }],
            'outtmpl': output_path,
            'progress_hooks': [DownloadProgressHook(download_id)],
        }
        
        cookie_path = os.path.join(app.config['COOKIE_DIR'], 'youtube_cookies.json')
        if os.path.exists(cookie_path):
            ydl_opts['cookiefile'] = cookie_path
        
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([url])
        
        downloads[download_id]['status'] = 'complete'
        downloads[download_id]['progress'] = 'Download complete!'
        downloads[download_id]['download_url'] = f"https://music-ripper.onrender.com/get-file/{download_id}"
        
        def cleanup_after_delay():
            time.sleep(600)
            if download_id in downloads:
                cleanup_file(downloads[download_id]['filepath'])
                del downloads[download_id]
        
        threading.Thread(target=cleanup_after_delay).start()
        
    except Exception as e:
        downloads[download_id]['status'] = 'error'
        downloads[download_id]['progress'] = f"Error: {str(e)}"

@app.route('/progress/<download_id>', methods=['GET'])
def check_progress(download_id):
    if download_id not in downloads:
        return jsonify(error="Download not found"), 404
    
    download_info = downloads[download_id]
    
    response = {
        'status': download_info['status'],
        'progress': download_info['progress']
    }
    
    if download_info['status'] == 'complete':
        response['download_url'] = download_info['download_url']
        response['filename'] = download_info['filename']
    
    return jsonify(response)

@app.route('/get-file/<download_id>', methods=['GET'])
def get_file(download_id):
    if download_id not in downloads or downloads[download_id]['status'] != 'complete':
        return "Download not found or not complete", 404
    
    download_info = downloads[download_id]
    
    return send_file(
        download_info['filepath'],
        as_attachment=True,
        download_name=download_info['filename'],
        mimetype='audio/mpeg'
    )

@app.route('/active-downloads', methods=['GET'])
def active_downloads():
    active = []
    for download_id, info in downloads.items():
        if info['status'] != 'error' and info['status'] != 'complete':
            active.append({
                'id': download_id,
                'status': info['status'],
                'progress': info['progress'],
                'filename': info['filename'],
                'url': info['url']
            })
    
    active.sort(key=lambda x: downloads[x['id']].get('started_at', 0), reverse=True)
    
    return jsonify({'downloads': active})

@app.route('/')
def index():
    return render_template_string('''
        <!doctype html>
        <html>
            <head><title>YouTube to MP3 Converter</title></head>
            <body>
                <h1>Use the Extension for conversions</h1>
            </body>
        </html>
    ''')

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)