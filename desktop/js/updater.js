// updater.js - 桌面客户端自动更新模块
/* eslint-disable no-console */

const { app, dialog, BrowserWindow, ipcMain } = require('electron');
const { autoUpdater } = require('electron-updater');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const axios = require('axios');
const semver = require('semver');

// 基本配置
let updateConfig = {
  // 更新服务器URL
  serverUrl: 'http://172.16.244.156:10099/api/update',
  // 是否自动下载
  autoDownload: true,
  // 是否显示通知
  showNotification: true,
  // 最近检查时间
  lastCheck: null,
  // 检查间隔（小时）
  checkInterval: 24,
  // 等待重试的最大时间（分钟）
  maxWaitMinutes: 120
};

// 更新状态
let updateStatus = {
  checking: false,
  available: false,
  downloading: false,
  downloaded: false,
  error: null,
  progress: 0,
  versionInfo: null,
  downloadPath: null,
  forceUpdate: false
};

// 主窗口引用
let mainWindow = null;

/**
 * 初始化更新器
 * @param {BrowserWindow} window 主窗口引用
 * @param {Object} config 自定义配置
 */
function initialize(window, config = {}) {
  // 设置主窗口引用
  mainWindow = window;
  
  // 合并配置
  updateConfig = { ...updateConfig, ...config };
  
  // 加载上次检查时间
  loadLastCheckTime();
  
  // 设置IPC处理程序
  setupIpcHandlers();
  
  // 返回控制器
  return {
    checkForUpdates,
    downloadUpdate,
    installUpdate,
    getStatus: () => updateStatus,
    getConfig: () => updateConfig,
    setConfig: (newConfig) => {
      updateConfig = { ...updateConfig, ...newConfig };
      saveUpdateConfig();
    }
  };
}

/**
 * 设置IPC处理程序
 */
function setupIpcHandlers() {
  // 检查更新
  ipcMain.handle('check-for-updates', async (event, force = false) => {
    try {
      const result = await checkForUpdates(force);
      return result;
    } catch (error) {
      console.error('检查更新时出错:', error);
      updateStatus.error = error.message;
      return { hasUpdate: false, error: error.message };
    }
  });
  
  // 下载更新
  ipcMain.handle('download-update', async () => {
    try {
      if (!updateStatus.available) {
        throw new Error('没有可用的更新');
      }
      
      const result = await downloadUpdate();
      return result;
    } catch (error) {
      console.error('下载更新时出错:', error);
      updateStatus.error = error.message;
      return { success: false, error: error.message };
    }
  });
  
  // 安装更新
  ipcMain.handle('install-update', async () => {
    try {
      if (!updateStatus.downloaded) {
        throw new Error('更新尚未下载完成');
      }
      
      await installUpdate();
      return { success: true };
    } catch (error) {
      console.error('安装更新时出错:', error);
      updateStatus.error = error.message;
      return { success: false, error: error.message };
    }
  });
  
  // 获取更新状态
  ipcMain.handle('get-update-status', () => {
    return updateStatus;
  });
  
  // 取消更新
  ipcMain.handle('cancel-update', () => {
    // 仅在下载状态可取消
    if (updateStatus.downloading) {
      // 重置状态
      updateStatus.downloading = false;
      updateStatus.progress = 0;
      
      return { success: true };
    }
    
    return { success: false, error: '当前状态无法取消更新' };
  });
}

/**
 * 检查是否有更新可用
 * @param {boolean} force 是否强制检查，忽略时间间隔
 * @returns {Promise<Object>} 检查结果
 */
async function checkForUpdates(force = false) {
  // 如果已经在检查，返回当前状态
  if (updateStatus.checking && !force) {
    return { checking: true };
  }
  
  // 如果不是强制检查且最近检查时间在间隔内，跳过检查
  // if (!force && updateConfig.lastCheck) {
  //   const lastCheck = new Date(updateConfig.lastCheck);
  //   const now = new Date();
  //   const hoursSinceLastCheck = (now - lastCheck) / (1000 * 60 * 60);
    
  //   if (hoursSinceLastCheck < updateConfig.checkInterval) {
  //     console.log(`距上次检查仅 ${hoursSinceLastCheck.toFixed(1)} 小时，跳过检查`);
  //     return { skipped: true };
  //   }
  // }
  
  // 更新检查状态
  updateStatus.checking = true;
  updateStatus.available = false;
  updateStatus.error = null;
  
  // 通知渲染进程状态更新
  if (mainWindow) {
    mainWindow.webContents.send('update-status-changed', updateStatus);
  }
  
  try {
    // 获取当前应用版本和平台
    const currentVersion = app.getVersion();
    let platform = process.platform;
    
    // 平台映射
    const platformMap = {
      'win32': 'windows',
      'darwin': 'macos',
      'linux': 'linux'
    };
    
    platform = platformMap[platform] || 'windows';
    
    // 构建请求URL
    const url = `${updateConfig.serverUrl}/check_update?platform=${platform}&version=${currentVersion}`;
    
    console.log(`检查更新: ${url}`);
    
    // 发送请求
    const response = await axios.get(url);
    const data = response.data;
    
    // 更新检查时间
    updateConfig.lastCheck = new Date().toISOString();
    saveUpdateConfig();
    
    // 更新状态
    updateStatus.checking = false;
    
    // 判断是否有更新
    if (data.status === 'success' && data.hasUpdate) {
      updateStatus.available = true;
      updateStatus.versionInfo = {
        version: data.latestVersion,
        releaseNotes: data.releaseNotes,
        releaseDate: data.releaseDate,
        filename: data.filename,
        md5: data.md5
      };
      updateStatus.forceUpdate = data.forceUpdate || false;
      
      // 如果设置为自动下载且有更新，立即下载
      if (updateConfig.autoDownload && updateStatus.available) {
        downloadUpdate().catch(err => {
          console.error('自动下载更新失败:', err);
        });
      }
      
      // 如果启用了通知且非自动下载，显示更新通知
      if (updateConfig.showNotification && !updateConfig.autoDownload) {
        showUpdateNotification(data.latestVersion);
      }
      
      return { 
        hasUpdate: true, 
        versionInfo: updateStatus.versionInfo,
        forceUpdate: updateStatus.forceUpdate
      };
    } else {
      console.log('没有可用的更新');
      return { hasUpdate: false };
    }
  } catch (error) {
    console.error('检查更新失败:', error);
    updateStatus.checking = false;
    updateStatus.error = error.message;
    
    throw error;
  } finally {
    // 通知渲染进程状态更新
    if (mainWindow) {
      mainWindow.webContents.send('update-status-changed', updateStatus);
    }
  }
}

/**
 * 下载更新
 * @returns {Promise<Object>} 下载结果
 */
async function downloadUpdate() {
  // 如果没有可用更新，返回错误
  if (!updateStatus.available) {
    throw new Error('没有可用的更新');
  }
  
  // 如果已经在下载，返回当前状态
  if (updateStatus.downloading) {
    return { downloading: true, progress: updateStatus.progress };
  }
  
  // 如果已经下载完成，直接返回成功
  if (updateStatus.downloaded) {
    return { 
      success: true, 
      downloaded: true,
      downloadPath: updateStatus.downloadPath
    };
  }
  
  // 更新下载状态
  updateStatus.downloading = true;
  updateStatus.progress = 0;
  updateStatus.error = null;
  
  // 通知渲染进程状态更新
  if (mainWindow) {
    mainWindow.webContents.send('update-status-changed', updateStatus);
  }
  
  try {
    // 获取下载目录
    const downloadDir = path.join(app.getPath('userData'), 'Updates');
    
    // 确保下载目录存在
    if (!fs.existsSync(downloadDir)) {
      fs.mkdirSync(downloadDir, { recursive: true });
    }
    
    // 构建下载路径
    const filename = updateStatus.versionInfo.filename;
    const downloadPath = path.join(downloadDir, filename);
    
    // 构建下载URL
    const downloadUrl = `${updateConfig.serverUrl}/download/${filename}`;
    
    console.log(`开始下载更新: ${downloadUrl}`);
    console.log(`下载路径: ${downloadPath}`);
    
    // 创建写入流
    const writer = fs.createWriteStream(downloadPath);
    
    // 发送请求并下载文件
    const response = await axios({
      url: downloadUrl,
      method: 'GET',
      responseType: 'stream',
      onDownloadProgress: (progressEvent) => {
        // 更新进度
        if (progressEvent.total) {
          const progress = Math.floor((progressEvent.loaded / progressEvent.total) * 100);
          updateStatus.progress = progress;
          
          // 通知渲染进程进度更新
          if (mainWindow) {
            mainWindow.webContents.send('update-download-progress', {
              progress,
              loaded: progressEvent.loaded,
              total: progressEvent.total
            });
          }
        }
      }
    });
    
    // 获取文件大小
    const totalBytes = parseInt(response.headers['content-length'], 10);
    let downloadedBytes = 0;
    
    // 处理下载流
    response.data.on('data', (chunk) => {
      downloadedBytes += chunk.length;
      const progress = Math.floor((downloadedBytes / totalBytes) * 100);
      
      // 更新进度
      updateStatus.progress = progress;
      
      // 通知渲染进程进度更新
      if (mainWindow) {
        mainWindow.webContents.send('update-download-progress', {
          progress,
          loaded: downloadedBytes,
          total: totalBytes
        });
      }
    });
    
    // 等待下载完成
    await new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
      response.data.pipe(writer);
    });
    
    console.log('更新下载完成');
    
    // 验证文件MD5
    const expectedMd5 = updateStatus.versionInfo.md5;
    if (expectedMd5) {
      const actualMd5 = await calculateFileMd5(downloadPath);
      
      if (actualMd5 !== expectedMd5) {
        throw new Error(`MD5校验失败: 预期=${expectedMd5}，实际=${actualMd5}`);
      }
      
      console.log('MD5校验通过');
    }
    
    // 更新状态
    updateStatus.downloading = false;
    updateStatus.downloaded = true;
    updateStatus.downloadPath = downloadPath;
    
    // 通知渲染进程状态更新
    if (mainWindow) {
      mainWindow.webContents.send('update-status-changed', updateStatus);
      mainWindow.webContents.send('update-downloaded');
    }
    
    return { 
      success: true, 
      downloaded: true,
      downloadPath
    };
  } catch (error) {
    console.error('下载更新失败:', error);
    
    // 更新状态
    updateStatus.downloading = false;
    updateStatus.error = error.message;
    
    // 通知渲染进程状态更新
    if (mainWindow) {
      mainWindow.webContents.send('update-status-changed', updateStatus);
      mainWindow.webContents.send('update-download-error', error.message);
    }
    
    throw error;
  }
}

/**
 * 安装更新
 * @returns {Promise<void>}
 */
async function installUpdate() {
  // 如果没有下载完成，返回错误
  if (!updateStatus.downloaded) {
    throw new Error('更新尚未下载完成');
  }
  
  const downloadPath = updateStatus.downloadPath;
  
  // 确认文件存在
  if (!fs.existsSync(downloadPath)) {
    throw new Error(`更新文件不存在: ${downloadPath}`);
  }
  
  // 根据平台执行不同的安装方式
  switch (process.platform) {
    case 'win32':
      // Windows平台，使用spawn启动安装程序
      await installWindowsUpdate(downloadPath);
      break;
    case 'darwin':
      // macOS平台，打开DMG文件
      await installMacOSUpdate(downloadPath);
      break;
    case 'linux':
      // Linux平台，执行AppImage文件
      await installLinuxUpdate(downloadPath);
      break;
    default:
      throw new Error(`不支持的平台: ${process.platform}`);
  }
}

/**
 * 安装Windows更新
 * @param {string} installerPath 安装程序路径
 */
async function installWindowsUpdate(installerPath) {
  try {
    // 显示确认对话框
    const { response } = await dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: '安装更新',
      message: `新版本已下载完成，将关闭应用并安装更新。`,
      buttons: ['安装', '稍后提醒我'],
      defaultId: 0,
      cancelId: 1
    });
    
    // 如果用户取消，返回
    if (response === 1) {
      return;
    }
    
  // 修改启动方式，使用 execFile 而不是 spawn
  const { execFile } = require('child_process');
      
  // 确保路径没有问题
  const safePath = `"${installerPath}"`;
  console.log('启动安装程序:', safePath);

  // 使用 shell execute 启动安装程序
  const child = execFile(installerPath, ['--updated'], {
    detached: true,
    stdio: 'ignore',
    shell: true
  });

  // 添加事件处理器以确保安装程序启动
  child.on('error', (err) => {
    console.error('启动安装程序失败:', err);
    dialog.showErrorBox('更新错误', `启动安装程序失败: ${err.message}`);
  });

  // 确保分离进程
  child.unref();

  // 延迟退出应用，给安装程序一点时间启动
  setTimeout(() => {
    app.quit();
  }, 1000);
  } catch (error) {
  console.error('安装Windows更新失败:', error);
  dialog.showErrorBox('更新错误', `安装更新失败: ${error.message}`);
  throw error;
  }
}

/**
 * 安装macOS更新
 * @param {string} dmgPath DMG文件路径
 */
async function installMacOSUpdate(dmgPath) {
  try {
    // 显示确认对话框
    const { response } = await dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: '安装更新',
      message: `新版本已下载完成，将打开更新包。请手动安装更新。`,
      buttons: ['打开更新包', '稍后提醒我'],
      defaultId: 0,
      cancelId: 1
    });
    
    // 如果用户取消，返回
    if (response === 1) {
      return;
    }
    
    // 打开DMG文件
    const process = spawn('open', [dmgPath], {
      detached: true,
      stdio: 'ignore'
    });
    
    // 分离进程，使其独立运行
    process.unref();
    
    // 退出应用
    app.quit();
  } catch (error) {
    console.error('安装macOS更新失败:', error);
    throw error;
  }
}

/**
 * 安装Linux更新
 * @param {string} appImagePath AppImage文件路径
 */
async function installLinuxUpdate(appImagePath) {
  try {
    // 显示确认对话框
    const { response } = await dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: '安装更新',
      message: `新版本已下载完成，将关闭应用并启动新版本。`,
      buttons: ['启动新版本', '稍后提醒我'],
      defaultId: 0,
      cancelId: 1
    });
    
    // 如果用户取消，返回
    if (response === 1) {
      return;
    }
    
    // 设置AppImage可执行权限
    fs.chmodSync(appImagePath, '755');
    
    // 启动AppImage
    const process = spawn(appImagePath, ['--updated'], {
      detached: true,
      stdio: 'ignore'
    });
    
    // 分离进程，使其独立运行
    process.unref();
    
    // 退出应用
    app.quit();
  } catch (error) {
    console.error('安装Linux更新失败:', error);
    throw error;
  }
}

/**
 * 显示更新通知
 * @param {string} version 新版本号
 */
function showUpdateNotification(version) {
  if (!mainWindow) return;
  
  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: '发现新版本',
    message: `新版本 ${version} 已可用。`,
    detail: '您可以立即更新应用或稍后再更新。',
    buttons: ['立即更新', '稍后再说'],
    defaultId: 0,
    cancelId: 1
  }).then(({ response }) => {
    if (response === 0) {
      // 用户选择立即更新
      downloadUpdate().catch(err => {
        console.error('下载更新失败:', err);
        dialog.showErrorBox('更新失败', `下载更新时出错: ${err.message}`);
      });
    }
  });
}

/**
 * 计算文件MD5
 * @param {string} filePath 文件路径
 * @returns {Promise<string>} MD5哈希值
 */
function calculateFileMd5(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('md5');
    const stream = fs.createReadStream(filePath);
    
    stream.on('data', data => hash.update(data));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', err => reject(err));
  });
}

/**
 * 保存更新配置
 */
function saveUpdateConfig() {
  try {
    const configPath = path.join(app.getPath('userData'), 'update-config.json');
    fs.writeFileSync(configPath, JSON.stringify(updateConfig, null, 2));
  } catch (error) {
    console.error('保存更新配置失败:', error);
  }
}

/**
 * 加载上次检查时间
 */
function loadLastCheckTime() {
  try {
    const configPath = path.join(app.getPath('userData'), 'update-config.json');
    
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      
      // 只更新lastCheck字段，保留其他配置
      if (config.lastCheck) {
        updateConfig.lastCheck = config.lastCheck;
      }
      
      // 合并其他有效的配置项
      if (config.serverUrl) updateConfig.serverUrl = config.serverUrl;
      if (typeof config.autoDownload === 'boolean') updateConfig.autoDownload = config.autoDownload;
      if (typeof config.showNotification === 'boolean') updateConfig.showNotification = config.showNotification;
      if (config.checkInterval) updateConfig.checkInterval = config.checkInterval;
    }
  } catch (error) {
    console.error('加载更新配置失败:', error);
  }
}

// 导出更新模块
module.exports = {
  initialize
};