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
      console.log('加载页面路径:', loadingPath);
      webview.src = loadingPath;
    } catch (e) {
      console.warn('无法获取loading路径，使用相对路径:', e);
      webview.src = 'loading.html';
    }
    
    // 加载配置
    const savedConfig = await window.electronAPI.getConfig();
    if (savedConfig) {
      config = savedConfig;
      console.log('成功加载配置:', config);
    }
    
    // 设置服务器地址输入框
    serverUrlInput.value = config.remoteUrl || '';
    
    // 开始检查连接
    startConnectionCheck();
  } catch (error) {
    console.error('初始化应用时出错:', error);
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
  console.log(`第${checkCount}次尝试连接服务器: ${config.remoteUrl}`);
  
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
    
    console.log('服务器连接成功，加载页面:', config.remoteUrl);
    
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
    console.log(`第${checkCount}次尝试失败:`, error);
    
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
        
        console.log('使用备用方法连接成功，加载页面:', config.remoteUrl);
        
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
        console.log(`第${checkCount}次备用尝试失败:`, fetchError.message);
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
    toggleBtn.style.top = '16px';
  } else {
    // 显示面板
    controlPanel.classList.remove('hidden');
    statusPanel.classList.remove('hidden');
    
    // 确保按钮在控制面板下方
    const updateButtonPosition = () => {
      const panelHeight = controlPanel.offsetHeight;
      toggleBtn.style.top = `${panelHeight + 16}px`;
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
    console.log('刷新连接到:', newUrl);
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
        console.log('配置保存成功');
      } else {
        console.warn('配置保存失败:', result ? result.error : '未知错误');
      }
    } catch (error) {
      console.error('保存配置时出错:', error);
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
    toggleBtn.style.top = `${panelHeight + 16}px`;
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
      console.log('页面加载完成:', currentUrl);
      
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
      console.error('加载失败:', event.errorDescription);
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
});

// 当用户点击网页视图时隐藏面板
// 由于webview的特性，需要在加载完成后通过JS注入来监听点击
webview.addEventListener('did-finish-load', () => {
  if (!webview.src.startsWith('data:') && !webview.src.includes('loading.html')) {
    // 注入点击监听代码
    webview.executeJavaScript(`
      document.addEventListener('click', () => {
        window.postMessage('webview-clicked', '*');
      });
    `);
  }
});

// 接收来自webview的消息
window.addEventListener('message', (event) => {
  if (event.data === 'webview-clicked' && panelsVisible && pageLoaded) {
    togglePanels();
  }
});