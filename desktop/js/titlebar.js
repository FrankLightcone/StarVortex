// titlebar.js - 处理自定义标题栏的脚本

document.addEventListener('DOMContentLoaded', function() {
    // DOM 元素
    const minimizeBtn = document.getElementById('minimizeBtn');
    const maximizeBtn = document.getElementById('maximizeBtn');
    const restoreBtn = document.getElementById('restoreBtn');
    const closeBtn = document.getElementById('closeBtn');
    
    // 初始化窗口状态
    initWindowState();
    
    // 绑定事件
    if (minimizeBtn) {
      minimizeBtn.addEventListener('click', minimizeWindow);
    }
    
    if (maximizeBtn) {
      maximizeBtn.addEventListener('click', maximizeWindow);
    }
    
    if (restoreBtn) {
      restoreBtn.addEventListener('click', restoreWindow);
    }
    
    if (closeBtn) {
      closeBtn.addEventListener('click', closeWindow);
    }
    
    // 初始化窗口状态
    async function initWindowState() {
      try {
        const state = await window.electronAPI.getWindowState();
        updateMaximizeRestoreButtons(state.isMaximized);
      } catch (error) {
        console.error('Failed to get window state:', error);
      }
    }
    
    // 最小化窗口
    async function minimizeWindow() {
      try {
        await window.electronAPI.minimizeWindow();
      } catch (error) {
        console.error('Failed to minimize window:', error);
      }
    }
    
    // 最大化窗口
    async function maximizeWindow() {
      try {
        const result = await window.electronAPI.maximizeWindow();
        updateMaximizeRestoreButtons(result.isMaximized);
      } catch (error) {
        console.error('Failed to maximize window:', error);
      }
    }
    
    // 还原窗口
    async function restoreWindow() {
      try {
        const result = await window.electronAPI.maximizeWindow(); // 同一个API，会切换最大化状态
        updateMaximizeRestoreButtons(result.isMaximized);
      } catch (error) {
        console.error('Failed to restore window:', error);
      }
    }
    
    // 关闭窗口
    async function closeWindow() {
      try {
        await window.electronAPI.closeWindow();
      } catch (error) {
        console.error('Failed to close window:', error);
      }
    }
    
    // 更新最大化/还原按钮的显示状态
    function updateMaximizeRestoreButtons(isMaximized) {
      if (isMaximized) {
        maximizeBtn.classList.add('hidden');
        restoreBtn.classList.remove('hidden');
      } else {
        maximizeBtn.classList.remove('hidden');
        restoreBtn.classList.add('hidden');
      }
    }
    
    // 监听窗口大小变化事件，更新按钮状态
    window.addEventListener('resize', async () => {
      try {
        const state = await window.electronAPI.getWindowState();
        updateMaximizeRestoreButtons(state.isMaximized);
      } catch (error) {
        console.error('Failed to get window state on resize:', error);
      }
    });
  });