// renderer.js - 处理用户界面的脚本

// DOM元素
const controlPanel = document.getElementById('controlPanel');
const statusPanel = document.getElementById('statusPanel');
const toggleBtn = document.getElementById('toggleBtn');
const serverUrlInput = document.getElementById('serverUrl');
const refreshBtn = document.getElementById('refreshBtn');
const webview = document.getElementById('webview');
const statusLabel = document.getElementById('statusLabel');

// 状态变量
let config = {
  remoteUrl: 'http://172.16.244.156:10099',
  maxAttempts: 5
};
let panelsVisible = true;
let checkCount = 0;
let checkTimer = null;
let statusUpdateTimer = null;
let pageLoaded = false;

// 获取初始配置
async function initApp() {
  try {
    // 确保webview初始加载正确的loading页面
    try {
      const loadingPath = await window.electronAPI.getLoadingPath();
      console.log('Loading page path:', loadingPath);
      webview.src = loadingPath;
    } catch (e) {
      console.log('Configuration loaded successfully:', config);
      webview.src = 'loading.html';
    }
    
    // 加载配置
    const savedConfig = await window.electronAPI.getConfig();
    if (savedConfig) {
      config = savedConfig;
      console.log('Configuration loaded successfully::', config);
    }
    
    // 设置服务器地址输入框
    serverUrlInput.value = config.remoteUrl || '';
    
    // 开始检查连接
    startConnectionCheck();
  } catch (error) {
    console.error('Init Error:', error);
    statusLabel.textContent = '加载配置时出错，使用默认配置';
    
    // 使用默认配置继续
    serverUrlInput.value = config.remoteUrl;
    startConnectionCheck();
  }
}

// 检查服务器连接
function startConnectionCheck() {
  checkCount = 0;
  statusLabel.textContent = '正在连接服务器...';
  
  // 清除之前的计时器
  if (checkTimer) {
    clearInterval(checkTimer);
  }
  
  // 设置新的计时器
  checkTimer = setInterval(checkRemoteServer, 1000);
}

// 验证远程服务器
function checkRemoteServer() {
  checkCount++;
  console.log(`Attempt ${checkCount} to connect to server: ${config.remoteUrl}`);
  
  if (checkCount > config.maxAttempts) {
    clearInterval(checkTimer);
    statusLabel.textContent = '无法连接到服务器';
    showErrorPage();
    return;
  }
  
  // 创建测试用的img元素来检查服务器连接
  // 这种方法比fetch更可靠，可以绕过一些CORS问题
  const testImg = new Image();
  testImg.onload = () => {
    // 服务器响应了
    clearInterval(checkTimer);
    statusLabel.textContent = '连接成功';
    
    console.log('Server connected successfully, loading page:', config.remoteUrl);
    
    // 确保WebView已正确设置了权限
    webview.classList.add('ready');
    
    // 更新状态文本
    statusLabel.textContent = '正在加载页面...';
    
    // 直接设置源
    webview.src = config.remoteUrl;
    
    // 1秒后隐藏面板
    setTimeout(() => {
      if (panelsVisible) {
        togglePanels();
      }
    }, 1000);
  };
  
  testImg.onerror = (error) => {
    console.log(`Attempt ${checkCount} fallback failed:`, error);
    
    // 备用方法: 使用fetch尝试连接
    fetch(config.remoteUrl, { 
      method: 'HEAD',
      mode: 'no-cors',
      cache: 'no-cache'
    })
      .then(() => {
        // 网络请求成功
        clearInterval(checkTimer);
        statusLabel.textContent = '连接成功';
        
        console.log('Other Ways, Page loaded:', config.remoteUrl);
        
        // 加载远程URL
        webview.classList.add('ready');
        webview.src = config.remoteUrl;
        
        // 1秒后隐藏面板
        setTimeout(() => {
          if (panelsVisible) {
            togglePanels();
          }
        }, 1000);
      })
      .catch(fetchError => {
        console.log(`Attempt ${checkCount} fallback failed:`, fetchError.message);
      });
  };
  
  // 给测试图像一个随机参数以避免缓存
  testImg.src = `${config.remoteUrl}/favicon.ico?t=${Date.now()}`;
  
  // 设置超时
  setTimeout(() => {
    if (testImg.complete === false) {
      testImg.src = '';  // 终止加载
    }
  }, 3000);
}

// 显示错误页面
function showErrorPage() {
  const errorHtml = `
  <html>
  <head>
      <style>
          body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
              text-align: center;
              padding-top: 80px;
              background-color: #f8f9fa;
              color: #343a40;
          }
          .error-container {
              max-width: 550px;
              margin: 0 auto;
              padding: 30px;
              background-color: white;
              border-radius: 8px;
              box-shadow: 0 4px 15px rgba(0,0,0,0.08);
          }
          h2 {
              color: #dc3545;
              font-size: 24px;
              margin-bottom: 20px;
          }
          .status-icon {
              font-size: 60px;
              margin-bottom: 20px;
              color: #dc3545;
          }
          p {
              color: #495057;
              margin: 15px 0;
              line-height: 1.5;
              font-size: 16px;
          }
          .server-url {
              background-color: #f8f9fa;
              padding: 10px;
              border-radius: 4px;
              font-family: monospace;
              color: #6c757d;
              margin: 15px auto;
              max-width: 90%;
              word-break: break-all;
          }
          .contact-info {
              margin-top: 30px;
              padding-top: 20px;
              border-top: 1px solid #e9ecef;
              color: #6c757d;
              font-size: 14px;
          }
          a {
              color: #007bff;
              text-decoration: none;
          }
          a:hover {
              text-decoration: underline;
          }
      </style>
  </head>
  <body>
      <div class="error-container">
          <div class="status-icon">⚠️</div>
          <h2>无法连接到服务器</h2>
          <p>多次尝试后，无法连接到以下服务器地址:</p>
          <div class="server-url">${config.remoteUrl}</div>
          <p>可能的原因:</p>
          <p>• 服务器地址输入错误<br>• 服务器暂时不可用<br>• 网络连接问题</p>
          <p>您可以点击<b>左上角的 ≡ 按钮</b>显示控制面板，修改服务器地址或刷新连接</p>
          
          <div class="contact-info">
              需要帮助? 请联系管理员: <a href="mailto:fanrj3@mail2.sysu.edu.cn">fanrj3@mail2.sysu.edu.cn</a>
          </div>
      </div>
  </body>
  </html>
  `;
  
  webview.src = `data:text/html;charset=utf-8,${encodeURIComponent(errorHtml)}`;
}

// 切换面板可见性
function togglePanels() {
  if (panelsVisible) {
    // 隐藏面板
    controlPanel.classList.add('hidden');
    statusPanel.classList.add('hidden');
    toggleBtn.style.top = '48px';
  } else {
    // 显示面板
    controlPanel.classList.remove('hidden');
    statusPanel.classList.remove('hidden');
    
    // 确保按钮在控制面板下方
    const updateButtonPosition = () => {
      const panelHeight = controlPanel.offsetHeight;
      toggleBtn.style.top = `${panelHeight + 48}px`;
    };
    
    // 等待过渡效果完成后再更新按钮位置
    setTimeout(updateButtonPosition, 50);
    
    // 再次检查位置，确保动画完成后正确定位
    setTimeout(updateButtonPosition, 300);
  }
  
  panelsVisible = !panelsVisible;
}

// 刷新连接
async function refreshConnection() {
  const newUrl = serverUrlInput.value.trim();
  
  if (newUrl) {
    console.log('Refreshing connection to:', newUrl);
    config.remoteUrl = newUrl;
    
    // 清除之前的定时器
    if (statusUpdateTimer) {
      clearInterval(statusUpdateTimer);
      statusUpdateTimer = null;
    }
    
    // 尝试保存配置
    try {
      const result = await window.electronAPI.saveConfig({ remoteUrl: newUrl });
      if (result && result.success) {
        console.log('Configuration saved successfully');
      } else {
        console.warn('Configuration saved successfully', result ? result.error : 'Unknown error');
      }
    } catch (error) {
      console.error('Error saving configuration:', error);
    }
    
    // 重置状态
    pageLoaded = false;
    webview.src = 'loading.html';
    
    // 确保面板可见
    if (!panelsVisible) {
      togglePanels();
    }
    
    // 开始重新检查连接
    startConnectionCheck();
  } else {
    // 如果URL为空，显示提示
    statusLabel.textContent = '请输入有效的服务器地址';
    serverUrlInput.focus();
  }
}

// 事件监听
document.addEventListener('DOMContentLoaded', () => {
  // 初始化应用
  initApp();
  
  // 设置事件监听器
  toggleBtn.addEventListener('click', togglePanels);
  refreshBtn.addEventListener('click', refreshConnection);
  
  // 设置初始按钮位置
  setTimeout(() => {
    const panelHeight = controlPanel.offsetHeight;
    toggleBtn.style.top = `${panelHeight + 48}px`;
  }, 100);
  
  // 允许回车键提交
  serverUrlInput.addEventListener('keypress', (event) => {
    if (event.key === 'Enter') {
      refreshConnection();
    }
  });
  
  // 加载完成事件
  webview.addEventListener('did-finish-load', () => {
    const currentUrl = webview.src;
    if (currentUrl && !currentUrl.includes('loading.html') && !currentUrl.startsWith('data:')) {
      pageLoaded = true;
      console.log('Page loaded:', currentUrl);
      
      // 更新状态信息为加载成功
      statusLabel.textContent = '加载成功';
      
      // 1秒后修改为当前时间
      setTimeout(() => {
        updateStatusWithTime();
      }, 1000);
    }
  });
  
  // 页面加载失败事件
  webview.addEventListener('did-fail-load', (event) => {
    if (event.errorCode !== -3) { // 忽略 -3 错误，这通常是由于页面重定向导致的
      console.error('Page load failed:', event.errorDescription);
      statusLabel.textContent = `加载失败: ${event.errorDescription}`;
    }
  });
  
  // 用于更新状态栏显示当前时间
  function updateStatusWithTime() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    statusLabel.textContent = `就绪 - ${timeStr}`;
    
    // 每秒更新一次时间
    if (pageLoaded && !statusUpdateTimer) {
      statusUpdateTimer = setInterval(() => {
        const now = new Date();
        const timeStr = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        statusLabel.textContent = `就绪 - ${timeStr}`;
      }, 1000);
    }
  }

  // 检查更新按钮
  const checkUpdateBtn = document.getElementById('checkUpdateBtn');
  if (checkUpdateBtn) {
    checkUpdateBtn.addEventListener('click', async () => {
      // 显示检查更新状态
      statusLabel.textContent = '正在检查更新...';
      
      try {
        // 调用更新检查API
        const result = await window.electronAPI.checkUpdatesManually();
        console.log('Update check result:', result);
        
        if (result && result.hasUpdate) {
          statusLabel.textContent = '发现新版本! 正在准备更新...';
          // 显示更新对话框
          if (window.showUpdateDialogManually) {
            window.showUpdateDialogManually();
          }
        // } else if (result && result.skipped) {
        //   statusLabel.textContent = '更新检查已跳过，最近已经检查过';
        } else {
          statusLabel.textContent = '您的应用已是最新版本';
        }
      } catch (error) {
        console.error('Update check failed:', error);
        statusLabel.textContent = '检查更新失败: ' + (error.message || '未知错误');
      }
    });
  }

  // 注入脚本来处理预览按钮的点击
  webview.addEventListener('did-finish-load', () => {
    if (!webview.src.startsWith('data:') && !webview.src.includes('loading.html')) {
      // 注入处理预览按钮点击的代码
      webview.executeJavaScript(`
        document.addEventListener('click', (event) => {
          if (event.target.classList.contains('preview-btn') || 
              event.target.closest('.preview-btn')) {
            event.preventDefault();
            
            // 获取文件路径和名称
            const button = event.target.classList.contains('preview-btn') ? 
                          event.target : event.target.closest('.preview-btn');
            const filePath = button.dataset.filePath;
            const fileName = button.dataset.fileName;
            
            if (filePath && fileName) {
              // 构建预览URL
              const previewUrl = \`/preview?file_path=\${encodeURIComponent(filePath)}&file_name=\${encodeURIComponent(fileName)}\`;
              
              // 通知主进程打开PDF
              window.postMessage({
                type: 'preview-pdf',
                url: previewUrl
              }, '*');
            }
          }
        });
      `);
    }
  });

  // 接收来自webview的消息
  window.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'preview-pdf') {
      // 在当前webview中加载PDF
      webview.src = event.data.url;
    }
  });
  
});

// Add this to your renderer.js file

// Function to check if a URL is for a PDF
function isPdfUrl(url) {
  if (!url) return false;
  return (
    (url.includes('preview_asset') && 
     (url.includes('.pdf') || url.toLowerCase().includes('pdf'))) ||
    url.endsWith('.pdf') || 
    url.includes('content-type=application/pdf')
  );
}

// Add a CSS style element to fix PDF display
const styleElement = document.createElement('style');
styleElement.textContent = `
  .pdf-mode {
    background-color: white !important;
  }
  .pdf-mode webview {
    background-color: white !important;
  }
`;
document.head.appendChild(styleElement);

// Monitor navigation events to handle PDFs
webview.addEventListener('did-start-navigation', (event) => {
  const url = event.url || webview.src;
  if (isPdfUrl(url)) {
    console.log('Detected PDF navigation:', url);
    
    // Add PDF mode class to container
    webviewContainer.classList.add('pdf-mode');
    document.body.classList.add('pdf-viewing');
    
    // Set PDF plugin parameters through executeJavaScript
    setTimeout(() => {
      webview.executeJavaScript(`
        // Force white background for PDF viewer
        document.body.style.backgroundColor = 'white';
        document.documentElement.style.backgroundColor = 'white';
        
        // Find any PDF viewers and style them
        const pdfElements = document.querySelectorAll('embed[type="application/pdf"], object[type="application/pdf"], iframe');
        pdfElements.forEach(element => {
          element.style.backgroundColor = 'white';
          element.style.width = '100%';
          element.style.height = '100%';
          element.style.border = 'none';
        });
      `).catch(err => console.error('Error injecting PDF styles:', err));
    }, 500); // Small delay to ensure the page has started loading
  } else {
    // Remove PDF mode class for non-PDF content
    webviewContainer.classList.remove('pdf-mode');
    document.body.classList.remove('pdf-viewing');
  }
});

// Additional handler for when the PDF is fully loaded
webview.addEventListener('did-finish-load', () => {
  const url = webview.src;
  if (isPdfUrl(url)) {
    console.log('PDF finished loading:', url);
    
    // Apply PDF specific styles
    webview.executeJavaScript(`
      // Ensure background is white
      document.body.style.backgroundColor = 'white';
      document.documentElement.style.backgroundColor = 'white';
      
      // Add styling for PDF elements
      const pdfStyle = document.createElement('style');
      pdfStyle.textContent = \`
        body, html {
          background-color: white !important;
          margin: 0 !important;
          padding: 0 !important;
          height: 100% !important;
          overflow: hidden !important;
        }
        
        embed[type="application/pdf"],
        object[type="application/pdf"],
        iframe {
          width: 100% !important;
          height: 100% !important;
          border: none !important;
          background-color: white !important;
        }
      \`;
      document.head.appendChild(pdfStyle);
    `).catch(err => console.error('Error applying PDF styles:', err));
  }
});

// Handle failed loads differently
webview.addEventListener('did-fail-load', (event) => {
  if (event.errorCode === -3) {
    // This is often a PDF-related abort, which can be ignored
    console.log('Ignoring error code -3, likely PDF-related navigation');
    return;
  }
  
  // For all other errors, remove PDF mode
  webviewContainer.classList.remove('pdf-mode');
  document.body.classList.remove('pdf-viewing');
});

// Allow right-clicking on PDFs to view them externally
webview.addEventListener('context-menu', (event) => {
  if (isPdfUrl(webview.src)) {
    // Add a context menu with an option to view the PDF externally
    const { Menu, MenuItem } = require('electron').remote;
    const menu = new Menu();
    
    menu.append(new MenuItem({
      label: '在浏览器中打开PDF',
      click: () => {
        require('electron').shell.openExternal(webview.src);
      }
    }));
    
    menu.popup();
  }
});

// Add this to your renderer.js file

// Function to extract file name from URL
function getFileNameFromUrl(url) {
  if (!url) return "PDF文档";
  
  try {
    // Try to extract file_name parameter from URL
    const urlObj = new URL(url);
    const fileName = urlObj.searchParams.get('file_name');
    if (fileName) {
      // Decode the file name (it's often URL encoded)
      return decodeURIComponent(fileName);
    }
    
    // If no file_name parameter found, try to extract from path
    const pathParts = url.split('/');
    let lastPart = pathParts[pathParts.length - 1];
    
    // Remove query parameters if present
    if (lastPart.includes('?')) {
      lastPart = lastPart.split('?')[0];
    }
    
    // Check if it's a PDF
    if (lastPart.toLowerCase().endsWith('.pdf')) {
      return decodeURIComponent(lastPart);
    }
    
    return "PDF文档";
  } catch (error) {
    console.error('Error parsing URL:', error);
    return "PDF文档";
  }
}

// Intercept navigation to PDFs and set title
webview.addEventListener('did-start-navigation', (event) => {
  const url = event.url || webview.src;
  if (isPdfUrl(url)) {
    // Extract file name to use as title
    const fileName = getFileNameFromUrl(url);
    
    // Set document title (will be reflected in the window title)
    setTimeout(() => {
      webview.executeJavaScript(`
        // Set document title
        document.title = "${fileName}";
      `).catch(err => console.error('Error setting PDF title:', err));
    }, 500);
  }
});

// Add additional handler for when PDF is fully loaded
webview.addEventListener('did-finish-load', () => {
  const url = webview.src;
  if (isPdfUrl(url)) {
    // Extract file name to use as title
    const fileName = getFileNameFromUrl(url);
    
    // Set document title (will be reflected in the window title)
    webview.executeJavaScript(`
      // Set document title
      document.title = "${fileName}";
      
      // Create favicon link if not exists
      if (!document.querySelector("link[rel='icon']")) {
        const favicon = document.createElement('link');
        favicon.rel = 'icon';
        favicon.href = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><path fill="%23F44336" d="M14,2H6C4.9,2,4,2.9,4,4v16c0,1.1,0.9,2,2,2h12c1.1,0,2-0.9,2-2V8L14,2z M14,4l5,5h-5V4z M9,15v-2h6v2H9z M9,11V9h6v2H9z"/></svg>';
        document.head.appendChild(favicon);
      }
    `).catch(err => console.error('Error setting PDF title and favicon:', err));
  }
});

// Monitor popup windows to modify their title
webview.addEventListener('new-window', (event) => {
  const url = event.url;
  if (isPdfUrl(url)) {
    // This is triggered when a new window is opened for a PDF
    console.log('PDF opened in new window:', url);
    
    // Unfortunately, we can't directly modify the title of the popup window through this event
    // We'll need to handle this in the main process
    
    // Pass the desired title to the main process
    const fileName = getFileNameFromUrl(url);
    window.electronAPI.notifyPdfWindowOpened(url, fileName);
    
    // Note: We'll need to add this method to preload.js and implement it in main.js
  }
});