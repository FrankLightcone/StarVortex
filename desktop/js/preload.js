// preload.js - Script executed before loading the webpage, used to safely expose main process functionality
const { contextBridge, ipcRenderer } = require('electron');

// Safely expose API to the webpage
contextBridge.exposeInMainWorld('electronAPI', {
  // Get configuration
  getConfig: async () => {
    try {
      return await ipcRenderer.invoke('get-config');
    } catch (error) {
      console.error('Error getting config from preload script:', error);
      // Return default configuration
      return {
        remoteUrl: 'http://172.16.244.156:10099',
        maxAttempts: 5
      };
    }
  },
  // Save configuration
  saveConfig: async (config) => {
    try {
      return await ipcRenderer.invoke('save-config', config);
    } catch (error) {
      console.error('Error saving config from preload script:', error);
      return { success: false, error: error.message };
    }
  },
  // Get path to loading.html
  getLoadingPath: async () => {
    try {
      return await ipcRenderer.invoke('get-loading-path');
    } catch (error) {
      console.error('Error getting loading path:', error);
      return 'loading.html';
    }
  },
  
  // ===== Update-related APIs =====
  // Check for updates
  checkForUpdates: async (force = false) => {
    try {
      return await ipcRenderer.invoke('check-for-updates', force);
    } catch (error) {
      console.error('Error checking for updates:', error);
      return { hasUpdate: false, error: error.message };
    }
  },
  
  // Manually check for updates
  checkUpdatesManually: async () => {
    try {
      return await ipcRenderer.invoke('check-updates-manually');
    } catch (error) {
      console.error('Error manually checking for updates:', error);
      return { hasUpdate: false, error: error.message };
    }
  },
  
  // Download update
  downloadUpdate: async () => {
    try {
      return await ipcRenderer.invoke('download-update');
    } catch (error) {
      console.error('Error downloading update:', error);
      return { success: false, error: error.message };
    }
  },
  
  // Install update
  installUpdate: async () => {
    try {
      return await ipcRenderer.invoke('install-update');
    } catch (error) {
      console.error('Error installing update:', error);
      return { success: false, error: error.message };
    }
  },
  
  // Get update status
  getUpdateStatus: async () => {
    try {
      return await ipcRenderer.invoke('get-update-status');
    } catch (error) {
      console.error('Error getting update status:', error);
      return { error: error.message };
    }
  },
  
  // Cancel update
  cancelUpdate: async () => {
    try {
      return await ipcRenderer.invoke('cancel-update');
    } catch (error) {
      console.error('Error canceling update:', error);
      return { success: false, error: error.message };
    }
  },
  
  // Event listeners - Update related
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
  },

  // 在 preload.js 中添加
  openPdf: async (pdfUrl) => {
    try {
      return await ipcRenderer.invoke('open-pdf', pdfUrl);
    } catch (error) {
      console.error('Error opening PDF:', error);
      return { success: false, error: error.message };
    }
  }
});
