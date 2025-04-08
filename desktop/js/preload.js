// preload.js - 在加载网页前执行的脚本，用于安全地暴露主进程功能
const { contextBridge, ipcRenderer } = require('electron');

// 向网页安全地暴露API
contextBridge.exposeInMainWorld('electronAPI', {
  // 获取配置
  getConfig: async () => {
    try {
      return await ipcRenderer.invoke('get-config');
    } catch (error) {
      console.error('预加载脚本获取配置出错:', error);
      // 返回默认配置
      return {
        remoteUrl: 'http://172.16.244.156:10099',
        maxAttempts: 5
      };
    }
  },
  // 保存配置
  saveConfig: async (config) => {
    try {
      return await ipcRenderer.invoke('save-config', config);
    } catch (error) {
      console.error('预加载脚本保存配置出错:', error);
      return { success: false, error: error.message };
    }
  },
  // 获取loading.html的路径
  getLoadingPath: async () => {
    try {
      return await ipcRenderer.invoke('get-loading-path');
    } catch (error) {
      console.error('获取loading路径出错:', error);
      return 'loading.html';
    }
  },
  
  // ===== 更新相关API =====
  // 检查更新
  checkForUpdates: async (force = false) => {
    try {
      return await ipcRenderer.invoke('check-for-updates', force);
    } catch (error) {
      console.error('检查更新出错:', error);
      return { hasUpdate: false, error: error.message };
    }
  },
  
  // 手动检查更新
  checkUpdatesManually: async () => {
    try {
      return await ipcRenderer.invoke('check-updates-manually');
    } catch (error) {
      console.error('手动检查更新出错:', error);
      return { hasUpdate: false, error: error.message };
    }
  },
  
  // 下载更新
  downloadUpdate: async () => {
    try {
      return await ipcRenderer.invoke('download-update');
    } catch (error) {
      console.error('下载更新出错:', error);
      return { success: false, error: error.message };
    }
  },
  
  // 安装更新
  installUpdate: async () => {
    try {
      return await ipcRenderer.invoke('install-update');
    } catch (error) {
      console.error('安装更新出错:', error);
      return { success: false, error: error.message };
    }
  },
  
  // 获取更新状态
  getUpdateStatus: async () => {
    try {
      return await ipcRenderer.invoke('get-update-status');
    } catch (error) {
      console.error('获取更新状态出错:', error);
      return { error: error.message };
    }
  },
  
  // 取消更新
  cancelUpdate: async () => {
    try {
      return await ipcRenderer.invoke('cancel-update');
    } catch (error) {
      console.error('取消更新出错:', error);
      return { success: false, error: error.message };
    }
  },
  
  // 事件监听器 - 更新相关
  onUpdateStatusChanged: (callback) => {
    ipcRenderer.on('update-status-changed', (_, status) => callback(status));
    return () => ipcRenderer.removeListener('update-status-changed', callback);
  },
  
  onUpdateDownloadProgress: (callback) => {
    ipcRenderer.on('update-download-progress', (_, progress) => callback(progress));
    return () => ipcRenderer.removeListener('update-download-progress', callback);
  },
  
  onUpdateDownloaded: (callback) => {
    ipcRenderer.on('update-downloaded', () => callback());
    return () => ipcRenderer.removeListener('update-downloaded', callback);
  },
  
  onUpdateDownloadError: (callback) => {
    ipcRenderer.on('update-download-error', (_, error) => callback(error));
    return () => ipcRenderer.removeListener('update-download-error', callback);
  },
  
  onForceUpdateAvailable: (callback) => {
    ipcRenderer.on('force-update-available', (_, versionInfo) => callback(versionInfo));
    return () => ipcRenderer.removeListener('force-update-available', callback);
  },
  
  onShowUpdateSuccess: (callback) => {
    ipcRenderer.on('show-update-success', (_, version) => callback(version));
    return () => ipcRenderer.removeListener('show-update-success', callback);
  }
});