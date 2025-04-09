// settings.js - 处理设置窗口的交互逻辑

// DOM元素
const closeSettingsBtn = document.getElementById('closeSettingsBtn');
const autoCheckUpdates = document.getElementById('autoCheckUpdates');
const autoDownloadUpdates = document.getElementById('autoDownloadUpdates');
const showUpdateNotifications = document.getElementById('showUpdateNotifications');
const manualCheckUpdatesBtn = document.getElementById('manualCheckUpdatesBtn');
const saveSettingsBtn = document.getElementById('saveSettingsBtn');
const resetSettingsBtn = document.getElementById('resetSettingsBtn');
const currentVersionDisplay = document.getElementById('currentVersionDisplay');
const latestVersionDisplay = document.getElementById('latestVersionDisplay');
const releaseNotesDisplay = document.getElementById('releaseNotesDisplay');
const updateInfoSection = document.getElementById('updateInfoSection');
const githubLink = document.getElementById('githubLink');
const issueLink = document.getElementById('issueLink');
const helpLink = document.getElementById('helpLink');

// 设置变量
let settings = {
  autoCheckUpdates: true,
  autoDownloadUpdates: true,
  showUpdateNotifications: true
};

// 版本信息
let versionInfo = {
  currentVersion: '',
  latestVersion: '',
  releaseNotes: '',
  hasUpdate: false
};

// GitHub 仓库信息
const githubRepoUrl = 'https://github.com/FrankLightcone/hw_transfer_app';
const issuesUrl = 'https://github.com/FrankLightcone/hw_transfer_app/issues';
const helpUrl = 'https://github.com/FrankLightcone/hw_transfer_app/wiki';

// 初始化
async function initSettings() {
  // 加载设置
  await loadSettings();
  
  // 加载版本信息
  await loadVersionInfo();
  
  // 设置GitHub链接
  setupLinks();
  
  // 绑定事件监听器
  setupEventListeners();
}

// 加载设置
async function loadSettings() {
  try {
    // 获取保存的设置
    const savedSettings = await window.electronAPI.getUpdateConfig();
    
    if (savedSettings) {
      settings = {
        autoCheckUpdates: savedSettings.autoCheck !== false,
        autoDownloadUpdates: savedSettings.autoDownload !== false,
        showUpdateNotifications: savedSettings.showNotification !== false
      };
    }
    
    // 更新UI
    updateSettingsUI();
  } catch (error) {
    console.error('加载设置出错:', error);
  }
}

// 更新设置UI
function updateSettingsUI() {
  autoCheckUpdates.checked = settings.autoCheckUpdates;
  autoDownloadUpdates.checked = settings.autoDownloadUpdates;
  showUpdateNotifications.checked = settings.showUpdateNotifications;
}

// 加载版本信息
async function loadVersionInfo() {
  try {
    // 获取当前版本
    const appVersion = await window.electronAPI.getAppVersion();
    versionInfo.currentVersion = appVersion || '1.0.0';
    currentVersionDisplay.textContent = `v${versionInfo.currentVersion}`;
    
    // 检查最新版本
    await checkForUpdates();
  } catch (error) {
    console.error('加载版本信息出错:', error);
  }
}

// 检查更新
async function checkForUpdates() {
  try {
    manualCheckUpdatesBtn.disabled = true;
    manualCheckUpdatesBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 检查中...';
    
    // 检查更新
    const result = await window.electronAPI.checkForUpdates(true);
    
    if (result && result.hasUpdate) {
      // 显示更新信息
      versionInfo.hasUpdate = true;
      versionInfo.latestVersion = result.versionInfo.version;
      versionInfo.releaseNotes = result.versionInfo.releaseNotes || '无更新说明';
      
      // 更新UI
      updateInfoSection.classList.remove('hidden');
      latestVersionDisplay.textContent = `v${versionInfo.latestVersion}`;
      releaseNotesDisplay.textContent = versionInfo.releaseNotes;
    } else {
      // 没有更新
      updateInfoSection.classList.add('hidden');
    }
  } catch (error) {
    console.error('检查更新出错:', error);
    // 显示错误信息
    updateInfoSection.classList.remove('hidden');
    releaseNotesDisplay.textContent = `检查更新出错: ${error.message || '未知错误'}`;
  } finally {
    manualCheckUpdatesBtn.disabled = false;
    manualCheckUpdatesBtn.innerHTML = '<i class="fas fa-sync-alt"></i> 立即检查更新';
  }
}

// 设置链接
function setupLinks() {
  githubLink.addEventListener('click', (e) => {
    e.preventDefault();
    window.electronAPI.openExternal(githubRepoUrl);
  });
  
  issueLink.addEventListener('click', (e) => {
    e.preventDefault();
    window.electronAPI.openExternal(issuesUrl);
  });
  
  helpLink.addEventListener('click', (e) => {
    e.preventDefault();
    window.electronAPI.openExternal(helpUrl);
  });
}

// 设置事件监听器
function setupEventListeners() {
  // 关闭设置窗口
  closeSettingsBtn.addEventListener('click', () => {
    window.electronAPI.closeSettingsWindow();
  });
  
  // 手动检查更新
  manualCheckUpdatesBtn.addEventListener('click', checkForUpdates);
  
  // 保存设置
  saveSettingsBtn.addEventListener('click', saveSettings);
  
  // 重置设置
  resetSettingsBtn.addEventListener('click', resetSettings);
  
  // 设置变更监听
  autoCheckUpdates.addEventListener('change', () => {
    settings.autoCheckUpdates = autoCheckUpdates.checked;
    // 如果禁用自动检查，应该同时禁用自动下载
    if (!autoCheckUpdates.checked) {
      settings.autoDownloadUpdates = false;
      autoDownloadUpdates.checked = false;
      autoDownloadUpdates.disabled = true;
    } else {
      autoDownloadUpdates.disabled = false;
    }
  });
  
  autoDownloadUpdates.addEventListener('change', () => {
    settings.autoDownloadUpdates = autoDownloadUpdates.checked;
  });
  
  showUpdateNotifications.addEventListener('change', () => {
    settings.showUpdateNotifications = showUpdateNotifications.checked;
  });
}

// 保存设置
async function saveSettings() {
  try {
    const newConfig = {
      autoCheck: settings.autoCheckUpdates,
      autoDownload: settings.autoDownloadUpdates,
      showNotification: settings.showUpdateNotifications
    };
    
    const result = await window.electronAPI.setUpdateConfig(newConfig);
    
    if (result && result.success) {
      // 显示保存成功提示
      const originalText = saveSettingsBtn.textContent;
      saveSettingsBtn.innerHTML = '<i class="fas fa-check"></i> 已保存';
      
      // 3秒后恢复原始文本
      setTimeout(() => {
        saveSettingsBtn.textContent = originalText;
      }, 3000);
    } else {
      alert('保存设置失败: ' + (result.error || '未知错误'));
    }
  } catch (error) {
    console.error('保存设置出错:', error);
    alert('保存设置出错: ' + (error.message || '未知错误'));
  }
}

// 重置设置
function resetSettings() {
  // 恢复默认设置
  settings = {
    autoCheckUpdates: true,
    autoDownloadUpdates: true,
    showUpdateNotifications: true
  };
  
  // 更新UI
  updateSettingsUI();
  
  // 解锁自动下载选项
  autoDownloadUpdates.disabled = false;
}

// 初始化设置
document.addEventListener('DOMContentLoaded', initSettings);