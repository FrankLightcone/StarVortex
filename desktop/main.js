// main.js - 修改以集成更新功能
const { app, BrowserWindow, ipcMain, Menu, session, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');
const Store = require('electron-store');
const updater = require('./js/updater'); // 导入更新模块

// Keep track of PDF windows
let pdfWindows = new Map();

// 配置schema以确保正确存储
const schema = {
  remoteUrl: {
    type: 'string',
    default: 'http://172.16.244.156:10099'
  },
  maxAttempts: {
    type: 'number',
    default: 5
  }
};

// 初始化配置存储
const store = new Store({ schema });

let mainWindow;
let updaterInstance; // 存储更新器实例

function createWindow() {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 1560,
    height: 980,
    icon: path.join(__dirname, 'resource/icon.ico'),
    frame: false, // 无边框窗口
    transparent: false, // 是否透明
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webviewTag: true, // Ensure webview tag is enabled
      webSecurity: false, // This allows loading local resources with different schemes
      allowRunningInsecureContent: true, // Allow running content from different sources
      plugins: true, // Important for PDF plugin support
      preload: path.join(__dirname, 'js/preload.js')
    },
    backgroundColor: '#f8f9fa'
  });

  // 隐藏菜单栏
  Menu.setApplicationMenu(null);

  // 禁用同源策略，解决CORS问题
  session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    callback({ requestHeaders: { ...details.requestHeaders } });
  });

  // 加载HTML文件
  mainWindow.loadFile('index.html');

  // 初始化更新器
  initUpdater();

  // 窗口关闭事件
  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

// 初始化更新器
function initUpdater() {
  if (!mainWindow) return;
  
  // 从服务器URL提取更新服务器URL
  const serverUrl = store.get('remoteUrl') || 'http://172.16.244.156:10099';
  const updateServerUrl = `${serverUrl}/api/update`;
  
  // 初始化更新器
  updaterInstance = updater.initialize(mainWindow, {
    serverUrl: updateServerUrl,
    autoDownload: true, // 自动下载更新
    showNotification: true // 显示通知
  });
  
  // 检查命令行参数，如果是从更新启动的，显示提示
  if (process.argv.includes('--updated')) {
    setTimeout(() => {
      if (mainWindow) {
        // 显示更新成功消息
        const appVersion = app.getVersion();
        mainWindow.webContents.send('show-update-success', appVersion);
      }
    }, 2000);
  } else {
    // 应用启动后检查更新
    setTimeout(() => {
      checkForUpdates();
    }, 5000); // 延迟5秒检查，确保应用已完全加载
  }
}

// 检查更新
async function checkForUpdates() {
  if (!updaterInstance) return;
  
  try {
    const result = await updaterInstance.checkForUpdates();
    
    // 如果有强制更新，通知用户
    if (result && result.hasUpdate && result.forceUpdate && mainWindow) {
      mainWindow.webContents.send('force-update-available', result.versionInfo);
    }
    
    return result;
  } catch (error) {
    console.error('检查更新时出错:', error);
    return { error: error.message };
  }
}

// 应用准备就绪时创建窗口
app.whenReady().then(() => {
  // Set up session to allow PDF plugins and cross-origin requests
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Access-Control-Allow-Origin': ['*'],
        'Content-Security-Policy': [
          "default-src 'self' * 'unsafe-inline' 'unsafe-eval' data: blob:; " +
          "object-src 'self' *; " +
          "plugin-types application/pdf; " +
          "frame-src 'self' * data: blob:;"
        ]
      }
    });
  });
  globalShortcut.register('CommandOrControl+Shift+i', function () {
      mainWindow.webContents.openDevTools()
    })
  // Create window after setting up session
  createWindow();
});

// 所有窗口关闭时退出应用
app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', function () {
  if (mainWindow === null) createWindow();
});

// IPC通信处理器 - 获取配置
ipcMain.handle('get-config', () => {
  try {
    return {
      remoteUrl: store.get('remoteUrl'),
      maxAttempts: store.get('maxAttempts')
    };
  } catch (error) {
    console.error('获取配置出错:', error);
    // 返回默认配置
    return {
      remoteUrl: 'http://172.16.244.156:10099',
      maxAttempts: 5
    };
  }
});

// IPC通信处理器 - 保存配置
ipcMain.handle('save-config', (event, config) => {
  try {
    if (config && config.remoteUrl) {
      store.set('remoteUrl', config.remoteUrl);
      return { success: true };
    }
    return { success: false, error: '无效的配置' };
  } catch (error) {
    console.error('保存配置出错:', error);
    return { success: false, error: error.message };
  }
});

// 添加获取loading.html路径的处理器
ipcMain.handle('get-loading-path', () => {
  return path.join('file://', __dirname, 'loading.html');
});

// 手动检查更新 - 添加IPC处理器
ipcMain.handle('check-updates-manually', async () => {
  return await checkForUpdates();
});

// 窗口控制 - 添加IPC处理器
ipcMain.handle('window-minimize', () => {
  if (mainWindow) mainWindow.minimize();
  return { success: true };
});

ipcMain.handle('window-maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
  return { success: true, isMaximized: mainWindow ? mainWindow.isMaximized() : false };
});

ipcMain.handle('window-close', () => {
  if (mainWindow) mainWindow.close();
  return { success: true };
});

// 获取窗口状态
ipcMain.handle('get-window-state', () => {
  if (!mainWindow) return { isMaximized: false };
  return { isMaximized: mainWindow.isMaximized() };
});


// 在 main.js 中添加
ipcMain.handle('open-pdf', async (event, pdfUrl) => {
  try {
    // 创建一个新窗口用于 PDF 预览
    let pdfWindow = new BrowserWindow({
      width: 1000,
      height: 800,
      webPreferences: {
        plugins: true
      }
    });
    
    // 加载 PDF URL
    await pdfWindow.loadURL(pdfUrl);
    return { success: true };
  } catch (error) {
    console.error('Error opening PDF:', error);
    return { success: false, error: error.message };
  }
});

// Handle PDF window opened event
ipcMain.on('pdf-window-opened', (event, data) => {
  const { url, title } = data;
  
  // Store the URL and title
  setTimeout(() => {
    // Look for recently created windows that might be PDF windows
    BrowserWindow.getAllWindows().forEach(win => {
      if (win !== mainWindow && !pdfWindows.has(win.id)) {
        // This might be our new PDF window
        win.setTitle(title || '课件文档');
        
        // Set the icon for the window
        win.setIcon(path.join(__dirname, 'resource/icon.ico'));
        
        // Store this window
        pdfWindows.set(win.id, { win, url, title });
        
        // Listen for window close to clean up our records
        win.on('closed', () => {
          pdfWindows.delete(win.id);
        });
        
        // Inject title-setting script
        win.webContents.executeJavaScript(`
          document.title = "${title || '课件文档'}";
          
          // Also try to set favicon
          const favicon = document.createElement('link');
          favicon.rel = 'icon';
          favicon.href = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><path fill="%23F44336" d="M14,2H6C4.9,2,4,4.9,4,4v16c0,1.1,0.9,2,2,2h12c1.1,0,2-0.9,2-2V8L14,2z M14,4l5,5h-5V4z M9,15v-2h6v2H9z M9,11V9h6v2H9z"/></svg>';
          document.head.appendChild(favicon);
        `).catch(err => console.error('Error injecting title script:', err));
      }
    });
  }, 500);
});

// Handle direct title setting from renderer
ipcMain.on('set-window-title', (event, title) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) {
    win.setTitle(title || '课件文档');
  }
});

// Monitor new windows to set custom titles and icons
app.on('browser-window-created', (event, win) => {
  // Wait a bit for window to load
  setTimeout(() => {
    const url = win.webContents.getURL();
    
    // Check if this is likely a PDF window
    if (url.includes('preview_asset') && 
        (url.includes('.pdf') || url.toLowerCase().includes('pdf'))) {
      
      // Extract a title from the URL
      let title = '课件文档';
      try {
        const urlObj = new URL(url);
        const fileName = urlObj.searchParams.get('file_name');
        if (fileName) {
          title = decodeURIComponent(fileName);
        }
      } catch (e) {
        console.error('Error parsing PDF URL:', e);
      }
      
      // Set window title
      win.setTitle(title);
      
      // Set window icon
      win.setIcon(path.join(__dirname, 'resource/icon.ico'));
      
      // Store this window
      pdfWindows.set(win.id, { win, url, title });
      
      // Clean up when window closes
      win.on('closed', () => {
        pdfWindows.delete(win.id);
      });
    }
  }, 300);
});

// Optionally add a custom handler for new-window events from webview
// This can be used if the above approach doesn't work consistently
app.on('web-contents-created', (event, contents) => {
  contents.on('new-window', (event, url, frameName, disposition, options) => {
    if (url.includes('preview_asset') && 
        (url.includes('.pdf') || url.toLowerCase().includes('pdf'))) {
      
      console.log('Intercepted PDF new window:', url);
      
      // Extract a title from the URL
      let title = '课件文档';
      try {
        const urlObj = new URL(url);
        const fileName = urlObj.searchParams.get('file_name');
        if (fileName) {
          title = decodeURIComponent(fileName);
        }
      } catch (e) {
        console.error('Error parsing PDF URL:', e);
      }
      
      // Set window options
      Object.assign(options, {
        title: title,
        icon: path.join(__dirname, 'resource/icon.ico'),
        webPreferences: {
          ...options.webPreferences,
          plugins: true
        }
      });
    }
  });
});