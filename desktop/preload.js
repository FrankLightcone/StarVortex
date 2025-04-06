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
  }
});