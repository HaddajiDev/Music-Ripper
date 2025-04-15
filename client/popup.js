document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('downloadBtn');
    const loading = document.getElementById('loading');
    const filenameInput = document.getElementById('filename');
    const cancelBtn = document.getElementById('cancelBtn');
  
    const authBtn = document.createElement('button');
    authBtn.id = 'authBtn';
    authBtn.textContent = 'Authenticate with YouTube';
    authBtn.style.background = '#ff0000';
    authBtn.style.marginTop = '10px';
    authBtn.style.padding = '12px';
    authBtn.style.borderRadius = '5px';
    authBtn.style.border = 'none';
    authBtn.style.cursor = 'pointer';
    authBtn.style.color = 'white';
    authBtn.style.width = '100%';
    authBtn.style.fontWeight = '500';
    authBtn.style.display = 'block';
    
    const authStatus = document.createElement('div');
    authStatus.id = 'authStatus';
    authStatus.style.fontSize = '12px';
    authStatus.style.color = 'var(--text-muted)';
    authStatus.style.textAlign = 'center';
    authStatus.style.marginTop = '5px';
    authStatus.style.display = 'none';
    
    document.querySelector('.input-group').appendChild(authBtn);
    document.querySelector('.input-group').appendChild(authStatus);
    
    const progressContainer = document.createElement('div');
    progressContainer.className = 'progress-container';
    progressContainer.style.marginTop = '15px';
    progressContainer.style.display = 'none';
    
    const progressText = document.createElement('div');
    progressText.className = 'progress-text';
    progressText.style.fontSize = '14px';
    progressText.style.color = 'var(--text)';
    progressText.style.fontFamily = 'monospace';
    progressText.style.textAlign = 'center';
    
    progressContainer.appendChild(progressText);
    document.querySelector('.container').appendChild(progressContainer);
    
    let progressInterval = null;
  
    authBtn.addEventListener('click', () => {
      authBtn.disabled = true;
      authStatus.style.display = 'block';
      authStatus.textContent = 'Authenticating with YouTube...';
      
      chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        const currentUrl = tabs[0].url;
        
        if (!currentUrl.includes('youtube.com')) {
          authStatus.textContent = 'Please navigate to YouTube first!';
          authBtn.disabled = false;
          setTimeout(() => {
            authStatus.style.display = 'none';
          }, 3000);
          return;
        }
        
        chrome.runtime.sendMessage({
          action: 'uploadCookies'
        }, (response) => {
          if (response.error) {
            authStatus.textContent = `Error: ${response.error}`;
          } else {
            authStatus.textContent = 'Authentication successful!';
          }
          
          authBtn.disabled = false;
          setTimeout(() => {
            authStatus.style.display = 'none';
          }, 3000);
        });
      });
    });
  
    checkForActiveDownloads();
  
    cancelBtn.addEventListener('click', () => {
      chrome.runtime.sendMessage({
          action: 'cancelDownload'
      }, (response) => {
          if (response?.success) {
              progressText.textContent = 'Download canceled';
              resetUI();
          }
      });
    });
  
    btn.addEventListener('click', async () => {
        btn.disabled = true;
        loading.style.display = 'block';
        progressContainer.style.display = 'block';
        progressText.textContent = 'Starting download...';
  
        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
            chrome.tabs.executeScript(tabs[0].id, {
                code: 'new URLSearchParams(window.location.search).get("v");'
            }, async (results) => {
                const videoId = results[0];
                if (!videoId) {
                    alert('Please navigate to a YouTube video first');
                    resetUI();
                    return;
                }
  
                const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;
                
                try {
                    await new Promise((resolve, reject) => {
                        chrome.runtime.sendMessage({
                            action: 'startConversion',
                            youtubeUrl: youtubeUrl,
                            filename: filenameInput.value
                        }, (response) => {
                            if (response?.error) reject(response.error);
                            else resolve();
                        });
                    });
                    
                    startProgressUpdates();
                } catch (error) {
                    progressText.textContent = `Error: ${error}`;
                    if (error.toString().toLowerCase().includes('authentication') || 
                        error.toString().toLowerCase().includes('sign in') ||
                        error.toString().toLowerCase().includes('bot')) {
                        authBtn.style.animation = 'pulse 1s infinite';
                    }
                    setTimeout(() => {
                        resetUI();
                    }, 3000);
                }
            });
        });
    });
  
    function checkForActiveDownloads() {
        chrome.runtime.sendMessage({
            action: 'getActiveDownload'
        }, (downloadInfo) => {
            if (downloadInfo && downloadInfo.active) {
                btn.disabled = true;
                loading.style.display = 'block';
                progressContainer.style.display = 'block';
                progressText.textContent = downloadInfo.progress || 'Download in progress...';
                
                startProgressUpdates();
            }
        });
    }
  
    function startProgressUpdates() {
      cancelBtn.style.display = 'block';
  
        if (progressInterval) {
            clearInterval(progressInterval);
        }
        
        progressInterval = setInterval(() => {
            chrome.runtime.sendMessage({
                action: 'checkProgress'
            }, (response) => {
                if (response) {
                    progressText.textContent = response.progress;
                    
                    if (response.progress.includes('%')) {
                        const percentMatch = response.progress.match(/([0-9.]+)%/);
                        if (percentMatch && percentMatch[1]) {
                            const percent = parseFloat(percentMatch[1]);
                            progressText.innerHTML = `
                                ${response.progress.replace(/([0-9.]+%)/, '<span class="status-pill">$1</span>')}
                                <div style="margin-top:8px; background:#40444b; height:3px; border-radius:2px;">
                                    <div style="width: ${percent}%; height:100%; background:var(--primary); transition: width 0.3s ease;"></div>
                                </div>
                            `;
                        }
                    }
                    
                    if (!response.active) {
                        if (response.progress.includes('100%') || 
                            response.progress.includes('Processing audio') ||
                            response.progress.includes('complete')) {
                            progressText.textContent = 'Download complete! You can close this popup.';
                            setTimeout(() => {
                                resetUI();
                            }, 3000);
                        } else {
                            setTimeout(() => {
                                resetUI();
                            }, 3000);
                        }
                    }
                }
            });
        }, 500);
    }
  
    function resetUI() {
        if (progressInterval) {
            clearInterval(progressInterval);
            progressInterval = null;
        }
        btn.disabled = false;
        loading.style.display = 'none';
        progressContainer.style.display = 'none';
        cancelBtn.style.display = 'none';
        progressText.textContent = '';
        authBtn.style.animation = '';
    }
  });
  
  const style = document.createElement('style');
  style.textContent = `
  @keyframes pulse {
    0% { transform: scale(1); }
    50% { transform: scale(1.05); }
    100% { transform: scale(1); }
  }`;
  document.head.appendChild(style);