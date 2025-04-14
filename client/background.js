chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'startConversion') {
      handleConversion(request, sendResponse);
      return true;
  } else if (request.action === 'checkProgress') {
      checkProgress(request, sendResponse);
      return true;
  } else if (request.action === 'getActiveDownload') {
      getActiveDownload(sendResponse);
      return true;
  }
  else if (request.action === 'cancelDownload') {
    cancelDownload(sendResponse);
    return true;
  }

});

let currentDownloadInfo = {
    id: null,
    progress: '',
    filename: '',
    url: '',
    active: false
};

function cancelDownload(sendResponse) {
  if (currentDownloadInfo.active) {
      currentDownloadInfo = {
          id: null,
          progress: 'Canceled by user',
          filename: '',
          url: '',
          active: false
      };
      sendResponse({ success: true });
  } else {
      sendResponse({ error: 'No active download' });
  }
}

async function handleConversion(request, sendResponse) {
  try {
      currentDownloadInfo = {
          id: null,
          progress: 'Starting conversion...',
          filename: request.filename || 'audio',
          url: request.youtubeUrl,
          active: true
      };
      
      const response = await fetch('https://music-ripper.vercel.app/download-with-progress', {
          method: 'POST',
          headers: {
              'Content-Type': 'application/json'
          },
          body: JSON.stringify({
              url: request.youtubeUrl,
              filename: request.filename
          })
      });
      
      const data = await response.json();
      if (!response.ok) {
          throw new Error(data.error || 'Conversion failed');
      }
      
      currentDownloadInfo.id = data.download_id;
      sendResponse({ success: true, download_id: currentDownloadInfo.id });
      
      pollProgress();
  } catch (error) {
      currentDownloadInfo.progress = `Error: ${error.message}`;
      currentDownloadInfo.active = false;
      sendResponse({ error: error.message });
  }
}

function getActiveDownload(sendResponse) {
  sendResponse(currentDownloadInfo);
}

function checkProgress(request, sendResponse) {
  sendResponse({ progress: currentDownloadInfo.progress, active: currentDownloadInfo.active });
}

async function pollProgress() {
  if (!currentDownloadInfo.id || !currentDownloadInfo.active) return;

  try {
      const response = await fetch(`https://music-ripper.vercel.app/progress/${currentDownloadInfo.id}`);
      const data = await response.json();
      
      if (response.ok) {
          currentDownloadInfo.progress = data.progress;
          
          if (data.status === 'complete') {
              chrome.downloads.download({
                  url: data.download_url,
                  filename: data.filename,
                  saveAs: false
              });
              
              setTimeout(() => {
                  currentDownloadInfo.active = false;
              }, 3000);
              
              return;
          }
          
          setTimeout(pollProgress, 500);
      } else {
          currentDownloadInfo.progress = `Error: ${data.error || 'Failed to get progress'}`;
          currentDownloadInfo.active = false;
      }
  } catch (error) {
      currentDownloadInfo.progress = `Error: ${error.message}`;
      currentDownloadInfo.active = false;
  }
}

async function checkForActiveDownloads() {
    try {
        const response = await fetch('https://music-ripper.vercel.app/active-downloads');
        if (response.ok) {
            const data = await response.json();
            if (data.downloads && data.downloads.length > 0) {
                const latestDownload = data.downloads[0];  
                currentDownloadInfo = {
                    id: latestDownload.id,
                    progress: latestDownload.progress,
                    filename: latestDownload.filename,
                    url: latestDownload.url,
                    active: true
                };
                pollProgress();
            }
        }
    } catch (error) {
        console.error("Error checking for active downloads:", error);
    }
}

checkForActiveDownloads();