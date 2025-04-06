// main.js - Electron主进程
const { app, BrowserWindow, ipcMain, Menu, session } = require('electron');
const path = require('path');
const fs = require('fs');
const Store = require('electron-store');

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

function createWindow() {
    // 创建浏览器窗口
    mainWindow = new BrowserWindow({
      width: 1560,
      height: 980,
      icon: path.join(__dirname, 'icon.ico'), // 添加应用图标
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        webviewTag: true, // 确保webview标签可用
        preload: path.join(__dirname, 'preload.js')
      },
      // 设置背景色，使加载过程更平滑
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

  // 窗口关闭事件
  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

// 应用准备就绪时创建窗口
app.whenReady().then(() => {
  // 设置CSP策略
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': ["default-src 'self' * 'unsafe-inline' 'unsafe-eval' data: blob:"]
      }
    });
  });
  
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