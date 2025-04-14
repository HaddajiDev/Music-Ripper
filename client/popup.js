document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('downloadBtn');
  const loading = document.getElementById('loading');
  const filenameInput = document.getElementById('filename');
  const cancelBtn = document.getElementById('cancelBtn');

  
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
                  
                  if (!response.active) {
                      if (response.progress.includes('100%') || 
                          response.progress.includes('Processing audio')) {
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
  }
});

progressText.innerHTML = `
    ${response.progress.replace(/(\d+%)/, '<span class="status-pill">$1</span>')}
    ${response.progress.includes('%') ? '<div style="margin-top:8px; background:#40444b; height:3px; border-radius:2px;"><div style="width: ' + 
    (parseInt(response.progress)) || 0 + '%; height:100%; background:var(--primary); transition: width 0.3s ease;"></div></div>' : ''}
`;
