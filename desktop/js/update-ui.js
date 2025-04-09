// update-ui.js - 更新UI交互功能

document.addEventListener('DOMContentLoaded', function() {
    // DOM元素
    const updateModal = document.getElementById('updateModal');
    const closeUpdateBtn = document.getElementById('closeUpdateModal');
    const updatePrompt = document.getElementById('updatePrompt');
    const viewUpdateBtn = document.getElementById('viewUpdateBtn');
    const forceUpdateModal = document.getElementById('forceUpdateModal');
    
    // 不同状态的容器
    const updateInitialState = document.getElementById('updateInitialState');
    const updateDownloadingState = document.getElementById('updateDownloadingState');
    const updateDownloadedState = document.getElementById('updateDownloadedState');
    const updateErrorState = document.getElementById('updateErrorState');
    const updateSuccessState = document.getElementById('updateSuccessState');
    
    // 显示内容元素
    const newVersionNumber = document.getElementById('newVersionNumber');
    const releaseNotesContent = document.getElementById('releaseNotesContent');
    const downloadProgressText = document.getElementById('downloadProgressText');
    const updateProgressBar = document.getElementById('updateProgressBar');
    const errorMessage = document.getElementById('errorMessage');
    const errorDetails = document.getElementById('errorDetails');
    const currentVersionText = document.getElementById('currentVersionText');
    const forceUpdateProgressBar = document.getElementById('forceUpdateProgressBar');
    const forceUpdateProgressText = document.getElementById('forceUpdateProgressText');
    
    // 按钮
    const startUpdateBtn = document.getElementById('startUpdateBtn');
    const laterUpdateBtn = document.getElementById('laterUpdateBtn');
    const cancelUpdateBtn = document.getElementById('cancelUpdateBtn');
    const installNowBtn = document.getElementById('installNowBtn');
    const installLaterBtn = document.getElementById('installLaterBtn');
    const retryUpdateBtn = document.getElementById('retryUpdateBtn');
    const closeErrorBtn = document.getElementById('closeErrorBtn');
    const closeSuccessBtn = document.getElementById('closeSuccessBtn');
    const forceUpdateBtn = document.getElementById('forceUpdateBtn');
    const exitAppBtn = document.getElementById('exitAppBtn');
    
    // 更新状态
    let updateState = {
      checking: false,
      available: false,
      downloading: false,
      downloaded: false,
      error: null,
      progress: 0,
      versionInfo: null
    };
    
    // 初始化:
    let unsubscribeHandlers = [];
    
    // 注册更新事件监听器
    function registerUpdateEventListeners() {
      // 确保先清除旧的监听器
      unregisterAllEventListeners();
      
      // 更新状态变化
      const unsubscribeStatus = window.electronAPI.onUpdateStatusChanged((status) => {
        console.log('更新状态变化:', status);
        updateState = status;
        updateUI();
      });
      unsubscribeHandlers.push(unsubscribeStatus);
      
      // 下载进度
      const unsubscribeProgress = window.electronAPI.onUpdateDownloadProgress((progress) => {
        console.log('下载进度:', progress);
        updateState.progress = progress.progress;
        updateProgressUI(progress.progress);
      });
      unsubscribeHandlers.push(unsubscribeProgress);
      
      // 下载完成
      const unsubscribeDownloaded = window.electronAPI.onUpdateDownloaded(() => {
        console.log('更新下载完成');
        showUpdateState('downloaded');
      });
      unsubscribeHandlers.push(unsubscribeDownloaded);
      
      // 下载错误
      const unsubscribeError = window.electronAPI.onUpdateDownloadError((error) => {
        console.error('下载更新出错:', error);
        updateState.error = error;
        showError(error);
      });
      unsubscribeHandlers.push(unsubscribeError);
      
      // 强制更新
      const unsubscribeForceUpdate = window.electronAPI.onForceUpdateAvailable((versionInfo) => {
        console.log('需要强制更新:', versionInfo);
        showForceUpdateModal(versionInfo);
      });
      unsubscribeHandlers.push(unsubscribeForceUpdate);
      
      // 更新成功
      const unsubscribeSuccess = window.electronAPI.onShowUpdateSuccess((version) => {
        console.log('更新成功:', version);
        showUpdateSuccess(version);
      });
      unsubscribeHandlers.push(unsubscribeSuccess);
    }
    
    // 取消注册所有事件监听器
    function unregisterAllEventListeners() {
      for (const unsubscribe of unsubscribeHandlers) {
        if (typeof unsubscribe === 'function') {
          unsubscribe();
        }
      }
      unsubscribeHandlers = [];
    }
    
    // 初始化UI和事件绑定
    function initUpdateUI() {
      // 注册事件监听器
      registerUpdateEventListeners();
      
      // 进入页面5秒后检查是否有更新
      setTimeout(checkForUpdates, 5000);
      
      // 绑定按钮事件
      if (closeUpdateBtn) {
        closeUpdateBtn.addEventListener('click', hideUpdateModal);
      }
      
      if (viewUpdateBtn) {
        viewUpdateBtn.addEventListener('click', () => {
          hideUpdatePrompt();
          showUpdateModal();
        });
      }
      
      if (startUpdateBtn) {
        startUpdateBtn.addEventListener('click', startUpdate);
      }
      
      if (laterUpdateBtn) {
        laterUpdateBtn.addEventListener('click', hideUpdateModal);
      }
      
      if (cancelUpdateBtn) {
        cancelUpdateBtn.addEventListener('click', cancelUpdate);
      }
      
      if (installNowBtn) {
        installNowBtn.addEventListener('click', installUpdate);
      }
      
      if (installLaterBtn) {
        installLaterBtn.addEventListener('click', hideUpdateModal);
      }
      
      if (retryUpdateBtn) {
        retryUpdateBtn.addEventListener('click', retryUpdate);
      }
      
      if (closeErrorBtn) {
        closeErrorBtn.addEventListener('click', hideUpdateModal);
      }
      
      if (closeSuccessBtn) {
        closeSuccessBtn.addEventListener('click', hideUpdateModal);
      }
      
      if (forceUpdateBtn) {
        forceUpdateBtn.addEventListener('click', startForceUpdate);
      }
      
      if (exitAppBtn) {
        exitAppBtn.addEventListener('click', () => {
          // 关闭应用
          window.close();
        });
      }
    }
    
    // 检查更新
    async function checkForUpdates(force = false) {
      try {
        console.log('检查更新...');
        const result = await window.electronAPI.checkForUpdates(force);
        
        console.log('检查更新结果:', result);
        
        if (result.hasUpdate) {
          updateState.available = true;
          updateState.versionInfo = result.versionInfo;
          
          // 如果是强制更新，显示强制更新弹窗
          if (result.forceUpdate) {
            showForceUpdateModal(result.versionInfo);
          } else {
            // 否则，显示更新提示
            showUpdatePrompt();
          }
        }
      } catch (error) {
        console.error('检查更新出错:', error);
      }
    }
    
    // 更新UI状态
    function updateUI() {
      if (updateState.downloading) {
        showUpdateState('downloading');
      } else if (updateState.downloaded) {
        showUpdateState('downloaded');
      } else if (updateState.error) {
        showError(updateState.error);
      } else if (updateState.available) {
        showUpdateState('initial');
      }
    }
    
    // 更新进度UI
    function updateProgressUI(progress) {
      if (updateProgressBar && downloadProgressText) {
        updateProgressBar.style.width = `${progress}%`;
        downloadProgressText.textContent = `${progress}%`;
      }
      
      if (forceUpdateProgressBar && forceUpdateProgressText) {
        forceUpdateProgressBar.style.width = `${progress}%`;
        forceUpdateProgressText.textContent = `${progress}%`;
        if (!forceUpdateProgressText.classList.contains('hidden')) {
          forceUpdateProgressText.classList.remove('hidden');
        }
      }
    }
    
    // 显示指定的更新状态
    function showUpdateState(state) {
      // 隐藏所有状态
      updateInitialState.classList.add('hidden');
      updateDownloadingState.classList.add('hidden');
      updateDownloadedState.classList.add('hidden');
      updateErrorState.classList.add('hidden');
      updateSuccessState.classList.add('hidden');
      
      // 显示指定状态
      switch (state) {
        case 'initial':
          updateInitialState.classList.remove('hidden');
          if (updateState.versionInfo) {
            newVersionNumber.textContent = `v${updateState.versionInfo.version}`;
            releaseNotesContent.textContent = updateState.versionInfo.releaseNotes || '无更新说明';
          }
          break;
        case 'downloading':
          updateDownloadingState.classList.remove('hidden');
          updateProgressUI(updateState.progress);
          break;
        case 'downloaded':
          updateDownloadedState.classList.remove('hidden');
          break;
        case 'error':
          updateErrorState.classList.remove('hidden');
          break;
        case 'success':
          updateSuccessState.classList.remove('hidden');
          break;
      }
    }
    
    // 显示错误
    function showError(error) {
      showUpdateState('error');
      errorMessage.textContent = '更新过程中发生错误';
      errorDetails.textContent = error;
    }
    
    // 显示更新成功
    function showUpdateSuccess(version) {
      showUpdateState('success');
      currentVersionText.textContent = `v${version}`;
      showUpdateModal();
    }
    
    // 开始更新
    async function startUpdate() {
      try {
        console.log('开始下载更新...');
        showUpdateState('downloading');
        
        const result = await window.electronAPI.downloadUpdate();
        console.log('下载更新结果:', result);
        
        if (result.downloaded) {
          showUpdateState('downloaded');
        }
      } catch (error) {
        console.error('下载更新失败:', error);
        showError(error.message || '下载更新失败');
      }
    }
    
    // 取消更新
    async function cancelUpdate() {
      try {
        const result = await window.electronAPI.cancelUpdate();
        console.log('取消更新结果:', result);
        
        if (result.success) {
          hideUpdateModal();
        } else {
          showError(result.error || '取消更新失败');
        }
      } catch (error) {
        console.error('取消更新失败:', error);
        showError(error.message || '取消更新失败');
      }
    }
    
    // 重试更新
    function retryUpdate() {
      updateState.error = null;
      showUpdateState('initial');
    }
    
    // 安装更新
    async function installUpdate() {
      try {
        console.log('开始安装更新...');
        const result = await window.electronAPI.installUpdate();
        console.log('安装更新结果:', result);
      } catch (error) {
        console.error('安装更新失败:', error);
        showError(error.message || '安装更新失败');
      }
    }
    
    // 开始强制更新
    async function startForceUpdate() {
      try {
        // 禁用按钮
        forceUpdateBtn.disabled = true;
        exitAppBtn.disabled = true;
        
        console.log('开始强制更新下载...');
        
        // 显示进度条
        forceUpdateProgressBar.style.width = '0%';
        forceUpdateProgressText.textContent = '0%';
        forceUpdateProgressText.classList.remove('hidden');
        
        const result = await window.electronAPI.downloadUpdate();
        console.log('下载更新结果:', result);
        
        if (result.downloaded) {
          await window.electronAPI.installUpdate();
        }
      } catch (error) {
        console.error('强制更新失败:', error);
        
        // 重新启用按钮
        forceUpdateBtn.disabled = false;
        exitAppBtn.disabled = false;
        
        // 隐藏进度
        forceUpdateProgressText.classList.add('hidden');
        
        // 显示错误
        alert(`更新失败: ${error.message || '未知错误'}`);
      }
    }
    
    // 显示更新模态框
    function showUpdateModal() {
      if (updateModal) {
        updateModal.classList.remove('hidden');
        showUpdateState(
          updateState.downloaded ? 'downloaded' : 
          updateState.error ? 'error' : 
          updateState.downloading ? 'downloading' : 'initial'
        );
      }
    }
    
    // 隐藏更新模态框
    function hideUpdateModal() {
      if (updateModal) {
        updateModal.classList.add('hidden');
      }
    }
    
    // 显示更新提示
    function showUpdatePrompt() {
      if (updatePrompt) {
        updatePrompt.classList.remove('hidden');
      }
    }
    
    // 隐藏更新提示
    function hideUpdatePrompt() {
      if (updatePrompt) {
        updatePrompt.classList.add('hidden');
      }
    }
    
    // 显示强制更新弹窗
    function showForceUpdateModal(versionInfo) {
      if (forceUpdateModal) {
        forceUpdateModal.classList.remove('hidden');
        
        // 启用按钮
        if (forceUpdateBtn) forceUpdateBtn.disabled = false;
        if (exitAppBtn) exitAppBtn.disabled = false;
        
        // 重置进度条
        if (forceUpdateProgressBar) forceUpdateProgressBar.style.width = '0%';
        if (forceUpdateProgressText) {
          forceUpdateProgressText.textContent = '0%';
          forceUpdateProgressText.classList.add('hidden');
        }
      }
    }
    
    // 隐藏强制更新弹窗
    function hideForceUpdateModal() {
      if (forceUpdateModal) {
        forceUpdateModal.classList.add('hidden');
      }
    }
    
    // 初始化
    initUpdateUI();
    
    // 添加手动检查更新功能
    window.checkForUpdatesManually = async function() {
      return await checkForUpdates(true);
    };
    
    // 添加强制显示更新对话框的功能
    window.showUpdateDialogManually = function() {
      showUpdateModal();
    };
  });
  
  // 添加FontAwesome
  (function() {
    const fontAwesome = document.createElement('link');
    fontAwesome.rel = 'stylesheet';
    fontAwesome.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/css/all.min.css';
    document.head.appendChild(fontAwesome);
  })();