// settings-preload.js - 为设置窗口安全地暴露主进程功能
const { contextBridge, ipcRenderer } = require('electron');

// 安全地暴露API给网页
contextBridge.exposeInMainWorld('electronAPI', {
  // 关闭设置窗口
  closeSettingsWindow: async () => {
    try {
      return await ipcRenderer.invoke('close-settings-window');
    } catch (error) {
      console.error('关闭设置窗口出错:', error);
      return { success: false, error: error.message };
    }
  },
  
  // 获取当前应用版本
  getAppVersion: async () => {
    try {
      return await ipcRenderer.invoke('get-app-version');
    } catch (error) {
      console.error('获取应用版本出错:', error);
      return null;
    }
  },
  
  // 获取更新配置
  getUpdateConfig: async () => {
    try {
      return await ipcRenderer.invoke('get-update-config');
    } catch (error) {
      console.error('获取更新配置出错:', error);
      return {
        autoCheck: true,
        autoDownload: true,
        showNotification: true
      };
    }
  },
  
  // 设置更新配置
  setUpdateConfig: async (config) => {
    try {
      return await ipcRenderer.invoke('set-update-config', config);
    } catch (error) {
      console.error('设置更新配置出错:', error);
      return { success: false, error: error.message };
    }
  },
  
  // 检查更新
  checkForUpdates: async (force = false) => {
    try {
      return await ipcRenderer.invoke('check-for-updates', force);
    } catch (error) {
      console.error('检查更新出错:', error);
      return { hasUpdate: false, error: error.message };
    }
  },
  
  // 在外部浏览器打开链接
  openExternal: async (url) => {
    try {
      return await ipcRenderer.invoke('open-external', url);
    } catch (error) {
      console.error('打开外部链接出错:', error);
      return { success: false, error: error.message };
    }
  }
});