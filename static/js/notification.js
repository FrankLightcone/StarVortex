/**
 * notification.js - 系统通知模块
 * 
 * 实现一个通知面板系统，支持以下功能：
 * - 点击通知图标显示通知面板
 * - 根据后端返回的Markdown内容展示通知
 * - 支持按通知类型、重要程度过滤
 * - 支持自动弹出重要通知（根据时间范围判断）
 * 
 * @module notification
 * @requires marked.js (Markdown解析库)
 * 
 * 主要功能：
 * - 创建和管理通知面板UI
 * - 从服务器获取通知列表
 * - 解析Markdown格式的通知内容
 * - 根据元数据判断是否自动弹出通知
 */

// 在页面加载完成后初始化通知系统
document.addEventListener('DOMContentLoaded', function() {
    // 创建通知系统UI元素
    createNotificationElements();
    
    // 加载通知数据
    loadNotifications();
    
    // 设置事件监听器
    setupEventListeners();
});

// 创建通知系统UI元素
function createNotificationElements() {
    // 创建通知按钮
    const notificationBtn = document.createElement('div');
    notificationBtn.id = 'notificationBtn';
    notificationBtn.className = 'notification-btn';
    notificationBtn.innerHTML = '<i class="fas fa-bell"></i>';
    notificationBtn.setAttribute('aria-label', '查看系统通知');
    
    // 添加未读通知指示器
    const unreadIndicator = document.createElement('span');
    unreadIndicator.id = 'unreadIndicator';
    unreadIndicator.className = 'unread-indicator hidden';
    
    notificationBtn.appendChild(unreadIndicator);
    
    // 创建通知面板容器
    const notificationContainer = document.createElement('div');
    notificationContainer.id = 'notificationContainer';
    notificationContainer.className = 'notification-container';
    
    // 通知面板内容
    notificationContainer.innerHTML = `
        <div class="notification-header">
            <div class="notification-title">系统通知</div>
            <div class="notification-actions">
                <button id="markAllReadBtn" class="notification-action-btn" title="全部标为已读">
                    <i class="fas fa-check-double"></i>
                </button>
                <div id="notificationClose" class="notification-close" title="关闭">
                    <i class="fas fa-times"></i>
                </div>
            </div>
        </div>
        <div class="notification-filter-bar">
            <div class="notification-filter">
                <select id="notificationTypeFilter" class="notification-filter-select">
                    <option value="all">全部类型</option>
                    <option value="update">更新</option>
                    <option value="tip">提示</option>
                    <option value="notice">通知</option>
                </select>
            </div>
            <div class="notification-filter">
                <select id="notificationPriorityFilter" class="notification-filter-select">
                    <option value="all">全部优先级</option>
                    <option value="high">高</option>
                    <option value="medium">中</option>
                    <option value="low">低</option>
                </select>
            </div>
        </div>
        <div class="notification-body">
            <div id="notificationList" class="notification-list">
                <!-- 通知项目将动态插入这里 -->
                <div class="notification-loading">
                    <div class="notification-loading-spinner"></div>
                    <div class="notification-loading-text">加载通知中...</div>
                </div>
            </div>
            <div id="notificationDetail" class="notification-detail hidden">
                <div class="notification-detail-header">
                    <button id="backToListBtn" class="back-to-list-btn">
                        <i class="fas fa-arrow-left"></i> 返回
                    </button>
                    <h3 id="notificationDetailTitle" class="notification-detail-title"></h3>
                </div>
                <div id="notificationDetailContent" class="notification-detail-content">
                </div>
            </div>
        </div>
    `;
    
    // 添加到页面
    document.body.appendChild(notificationBtn);
    document.body.appendChild(notificationContainer);
    
    // 自动弹出通知对话框
    const autoPopupContainer = document.createElement('div');
    autoPopupContainer.id = 'autoPopupContainer';
    autoPopupContainer.className = 'auto-popup-container hidden';
    
    autoPopupContainer.innerHTML = `
        <div class="auto-popup-content">
            <div class="auto-popup-header">
                <h3 id="autoPopupTitle" class="auto-popup-title">重要通知</h3>
                <div id="autoPopupClose" class="auto-popup-close">
                    <i class="fas fa-times"></i>
                </div>
            </div>
            <div id="autoPopupBody" class="auto-popup-body">
            </div>
            <div class="auto-popup-footer">
                <label class="auto-popup-checkbox">
                    <input type="checkbox" id="dontShowAgainToday"> 今日不再显示
                </label>
                <button id="autoPopupConfirmBtn" class="auto-popup-confirm-btn">我知道了</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(autoPopupContainer);
}

// 设置事件监听器
function setupEventListeners() {
    const notificationBtn = document.getElementById('notificationBtn');
    const notificationClose = document.getElementById('notificationClose');
    const notificationContainer = document.getElementById('notificationContainer');
    const typeFilter = document.getElementById('notificationTypeFilter');
    const priorityFilter = document.getElementById('notificationPriorityFilter');
    const markAllReadBtn = document.getElementById('markAllReadBtn');
    const backToListBtn = document.getElementById('backToListBtn');
    const notificationList = document.getElementById('notificationList');
    const notificationDetail = document.getElementById('notificationDetail');
    
    // 自动弹出通知相关元素
    const autoPopupClose = document.getElementById('autoPopupClose');
    const autoPopupConfirmBtn = document.getElementById('autoPopupConfirmBtn');
    const dontShowAgainToday = document.getElementById('dontShowAgainToday');
    
    // 点击通知按钮显示通知面板
    if (notificationBtn) {
        notificationBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            notificationContainer.classList.toggle('show');
            
            // 如果面板显示，更新未读指示器
            if (notificationContainer.classList.contains('show')) {
                updateUnreadIndicator();
            }
        });
    }
    
    // 点击关闭按钮隐藏通知面板
    if (notificationClose) {
        notificationClose.addEventListener('click', function(e) {
            e.stopPropagation();
            notificationContainer.classList.remove('show');
        });
    }
    
    // 点击外部区域关闭通知面板
    document.addEventListener('click', function(e) {
        if (notificationContainer && notificationContainer.classList.contains('show') && 
            !notificationContainer.contains(e.target) && 
            e.target !== notificationBtn) {
            notificationContainer.classList.remove('show');
        }
    });
    
    // 阻止通知面板内的点击事件冒泡
    if (notificationContainer) {
        notificationContainer.addEventListener('click', function(e) {
            e.stopPropagation();
        });
    }
    
    // 类型过滤器变化事件
    if (typeFilter) {
        typeFilter.addEventListener('change', function() {
            filterNotifications();
        });
    }
    
    // 优先级过滤器变化事件
    if (priorityFilter) {
        priorityFilter.addEventListener('change', function() {
            filterNotifications();
        });
    }
    
    // 标记所有通知为已读
    if (markAllReadBtn) {
        markAllReadBtn.addEventListener('click', function() {
            markAllNotificationsAsRead();
        });
    }
    
    // 返回通知列表
    if (backToListBtn) {
        backToListBtn.addEventListener('click', function() {
            notificationDetail.classList.add('hidden');
            notificationList.classList.remove('hidden');
        });
    }
    
    // 自动弹出通知关闭按钮
    if (autoPopupClose) {
        autoPopupClose.addEventListener('click', function() {
            hideAutoPopup();
        });
    }
    
    // 自动弹出通知确认按钮
    if (autoPopupConfirmBtn) {
        autoPopupConfirmBtn.addEventListener('click', function() {
            hideAutoPopup();
            
            // 如果勾选了"今日不再显示"，记录到localStorage
            if (dontShowAgainToday.checked) {
                const today = new Date().toISOString().split('T')[0]; // 格式：YYYY-MM-DD
                localStorage.setItem('dontShowAutoPopupUntil', today);
            }
        });
    }
}

// 加载通知数据
function loadNotifications() {
    // 显示加载中状态
    const notificationList = document.getElementById('notificationList');
    if (notificationList) {
        notificationList.innerHTML = `
            <div class="notification-loading">
                <div class="notification-loading-spinner"></div>
                <div class="notification-loading-text">加载通知中...</div>
            </div>
        `;
    }
    
    // 从服务器加载通知数据
    fetch('/get_notifications')
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                renderNotifications(data.notifications);
                checkAutoPopupNotifications(data.notifications);
                updateUnreadIndicator();
            } else {
                showEmptyNotifications('加载通知失败: ' + data.message);
            }
        })
        .catch(error => {
            console.error('加载通知出错:', error);
            showEmptyNotifications('加载通知时发生错误');
        });
}

// 渲染通知列表
function renderNotifications(notifications) {
    const notificationList = document.getElementById('notificationList');
    
    // 如果没有通知，显示空状态
    if (!notifications || notifications.length === 0) {
        showEmptyNotifications();
        return;
    }
    
    // 清空通知列表
    notificationList.innerHTML = '';
    
    // 按时间倒序排序通知
    notifications.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    // 添加通知项
    notifications.forEach(notification => {
        const notificationItem = document.createElement('div');
        notificationItem.className = `notification-item ${notification.read ? 'read' : 'unread'}`;
        notificationItem.dataset.id = notification.id;
        notificationItem.dataset.type = notification.type;
        notificationItem.dataset.priority = notification.priority;
        
        // 格式化日期
        const notificationDate = new Date(notification.date);
        const formattedDate = notificationDate.toLocaleDateString('zh-CN') + ' ' + 
                             notificationDate.toLocaleTimeString('zh-CN', {hour: '2-digit', minute:'2-digit'});
        
        // 设置图标
        let typeIcon, typeClass;
        switch (notification.type) {
            case 'update':
                typeIcon = 'fa-sync-alt';
                typeClass = 'type-update';
                break;
            case 'tip':
                typeIcon = 'fa-lightbulb';
                typeClass = 'type-tip';
                break;
            case 'notice':
            default:
                typeIcon = 'fa-info-circle';
                typeClass = 'type-notice';
                break;
        }
        
        // 设置优先级标记
        let priorityClass = '';
        switch (notification.priority) {
            case 'high':
                priorityClass = 'priority-high';
                break;
            case 'medium':
                priorityClass = 'priority-medium';
                break;
            case 'low':
                priorityClass = 'priority-low';
                break;
        }
        
        notificationItem.innerHTML = `
            <div class="notification-item-content">
                <div class="notification-item-icon ${typeClass}">
                    <i class="fas ${typeIcon}"></i>
                </div>
                <div class="notification-item-body">
                    <div class="notification-item-title ${priorityClass}">
                        ${notification.title}
                        ${notification.priority === 'high' ? '<span class="priority-badge">重要</span>' : ''}
                    </div>
                    <div class="notification-item-preview">${notification.preview}</div>
                    <div class="notification-item-meta">
                        <span class="notification-item-date">${formattedDate}</span>
                    </div>
                </div>
                <div class="notification-item-indicator ${notification.read ? 'hidden' : ''}"></div>
            </div>
        `;
        
        // 添加点击事件
        notificationItem.addEventListener('click', function() {
            openNotificationDetail(notification);
        });
        
        notificationList.appendChild(notificationItem);
    });
}

// 显示空通知状态
function showEmptyNotifications(message = '暂无通知') {
    const notificationList = document.getElementById('notificationList');
    
    notificationList.innerHTML = `
        <div class="notification-empty">
            <div class="notification-empty-icon">
                <i class="fas fa-bell-slash"></i>
            </div>
            <div class="notification-empty-text">${message}</div>
        </div>
    `;
}

// 打开通知详情
function openNotificationDetail(notification) {
    const notificationList = document.getElementById('notificationList');
    const notificationDetail = document.getElementById('notificationDetail');
    const notificationDetailTitle = document.getElementById('notificationDetailTitle');
    const notificationDetailContent = document.getElementById('notificationDetailContent');
    
    // 切换视图
    notificationList.classList.add('hidden');
    notificationDetail.classList.remove('hidden');
    
    // 设置标题
    notificationDetailTitle.textContent = notification.title;
    
    // 显示加载中状态
    notificationDetailContent.innerHTML = `
        <div class="notification-loading">
            <div class="notification-loading-spinner"></div>
            <div class="notification-loading-text">加载内容中...</div>
        </div>
    `;
    
    // 加载通知内容
    fetch(`/get_notification_content/${notification.id}`)
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                // 使用marked.js解析Markdown内容
                if (window.marked) {
                    notificationDetailContent.innerHTML = marked.parse(data.content);
                } else {
                    // 如果没有marked库，简单地显示内容
                    notificationDetailContent.textContent = data.content;
                }
                
                // 标记为已读
                markNotificationAsRead(notification.id);
            } else {
                notificationDetailContent.innerHTML = `
                    <div class="notification-error">
                        <div class="notification-error-icon">
                            <i class="fas fa-exclamation-circle"></i>
                        </div>
                        <div class="notification-error-text">加载内容失败: ${data.message}</div>
                    </div>
                `;
            }
        })
        .catch(error => {
            console.error('加载通知内容出错:', error);
            notificationDetailContent.innerHTML = `
                <div class="notification-error">
                    <div class="notification-error-icon">
                        <i class="fas fa-exclamation-circle"></i>
                    </div>
                    <div class="notification-error-text">加载内容时发生错误</div>
                </div>
            `;
        });
}

// 根据过滤条件过滤通知
function filterNotifications() {
    const typeFilter = document.getElementById('notificationTypeFilter').value;
    const priorityFilter = document.getElementById('notificationPriorityFilter').value;
    const notificationItems = document.querySelectorAll('.notification-item');
    
    notificationItems.forEach(item => {
        const typeMatch = typeFilter === 'all' || item.dataset.type === typeFilter;
        const priorityMatch = priorityFilter === 'all' || item.dataset.priority === priorityFilter;
        
        if (typeMatch && priorityMatch) {
            item.classList.remove('hidden');
        } else {
            item.classList.add('hidden');
        }
    });
    
    // 检查是否所有通知都被隐藏了
    const visibleItems = document.querySelectorAll('.notification-item:not(.hidden)');
    if (visibleItems.length === 0) {
        showEmptyNotifications('没有符合筛选条件的通知');
    }
}

// 标记通知为已读
function markNotificationAsRead(notificationId) {
    // 更新UI
    const notificationItem = document.querySelector(`.notification-item[data-id="${notificationId}"]`);
    if (notificationItem) {
        notificationItem.classList.add('read');
        notificationItem.classList.remove('unread');
        
        const indicator = notificationItem.querySelector('.notification-item-indicator');
        if (indicator) {
            indicator.classList.add('hidden');
        }
    }
    
    // 更新未读指示器
    updateUnreadIndicator();
    
    // 发送请求到服务器
    fetch('/mark_notification_read', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ notificationId })
    })
    .catch(error => {
        console.error('标记通知为已读出错:', error);
    });
}

// 标记所有通知为已读
function markAllNotificationsAsRead() {
    // 更新UI
    const unreadItems = document.querySelectorAll('.notification-item.unread');
    unreadItems.forEach(item => {
        item.classList.add('read');
        item.classList.remove('unread');
        
        const indicator = item.querySelector('.notification-item-indicator');
        if (indicator) {
            indicator.classList.add('hidden');
        }
    });
    
    // 更新未读指示器
    updateUnreadIndicator();
    
    // 发送请求到服务器
    fetch('/mark_all_notifications_read', {
        method: 'POST'
    })
    .catch(error => {
        console.error('标记所有通知为已读出错:', error);
    });
}

// 更新未读指示器
function updateUnreadIndicator() {
    const unreadItems = document.querySelectorAll('.notification-item.unread');
    const unreadIndicator = document.getElementById('unreadIndicator');
    
    if (unreadItems.length > 0) {
        unreadIndicator.classList.remove('hidden');
        unreadIndicator.textContent = unreadItems.length > 9 ? '9+' : unreadItems.length;
    } else {
        unreadIndicator.classList.add('hidden');
    }
}

// 检查是否有需要自动弹出的通知
function checkAutoPopupNotifications(notifications) {
    if (!notifications || notifications.length === 0) {
        return;
    }
    
    // 检查是否设置了"今日不再显示"
    const dontShowUntil = localStorage.getItem('dontShowAutoPopupUntil');
    if (dontShowUntil) {
        const today = new Date().toISOString().split('T')[0]; // 格式：YYYY-MM-DD
        if (dontShowUntil === today) {
            return; // 用户设置了今天不再显示
        }
    }
    
    // 获取当前日期时间
    const now = new Date();
    
    // 筛选出满足自动弹出条件的通知
    const autoPopupNotifications = notifications.filter(notification => {
        // 检查是否设置了自动弹出
        if (!notification.autoPopup) {
            return false;
        }
        
        // 检查是否在有效期内
        if (notification.popupStartDate && notification.popupEndDate) {
            const startDate = new Date(notification.popupStartDate);
            const endDate = new Date(notification.popupEndDate);
            
            return now >= startDate && now <= endDate;
        }
        
        return false;
    });
    
    // 如果有自动弹出的通知，显示优先级最高的那个
    if (autoPopupNotifications.length > 0) {
        // 按优先级排序
        const priorityOrder = { 'high': 3, 'medium': 2, 'low': 1 };
        autoPopupNotifications.sort((a, b) => {
            return priorityOrder[b.priority] - priorityOrder[a.priority];
        });
        
        // 显示优先级最高的通知
        showAutoPopup(autoPopupNotifications[0]);
    }
}

// 显示自动弹出通知
function showAutoPopup(notification) {
    const autoPopupContainer = document.getElementById('autoPopupContainer');
    const autoPopupTitle = document.getElementById('autoPopupTitle');
    const autoPopupBody = document.getElementById('autoPopupBody');
    
    if (!autoPopupContainer || !autoPopupTitle || !autoPopupBody) {
        return;
    }
    
    // 设置标题
    autoPopupTitle.textContent = notification.title;
    
    // 设置加载中状态
    autoPopupBody.innerHTML = `
        <div class="notification-loading">
            <div class="notification-loading-spinner"></div>
            <div class="notification-loading-text">加载内容中...</div>
        </div>
    `;
    
    // 加载通知内容
    fetch(`/get_notification_content/${notification.id}`)
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                // 使用marked.js解析Markdown内容
                if (window.marked) {
                    autoPopupBody.innerHTML = marked.parse(data.content);
                } else {
                    // 如果没有marked库，简单地显示内容
                    autoPopupBody.textContent = data.content;
                }
                
                // 标记为已读
                markNotificationAsRead(notification.id);
            } else {
                autoPopupBody.innerHTML = `
                    <div class="notification-error">
                        <div class="notification-error-icon">
                            <i class="fas fa-exclamation-circle"></i>
                        </div>
                        <div class="notification-error-text">加载内容失败: ${data.message}</div>
                    </div>
                `;
            }
        })
        .catch(error => {
            console.error('加载通知内容出错:', error);
            autoPopupBody.innerHTML = `
                <div class="notification-error">
                    <div class="notification-error-icon">
                        <i class="fas fa-exclamation-circle"></i>
                    </div>
                    <div class="notification-error-text">加载内容时发生错误</div>
                </div>
            `;
        });
    
    // 显示弹窗
    autoPopupContainer.classList.remove('hidden');
    
    // 添加显示动画
    setTimeout(() => {
        autoPopupContainer.classList.add('show');
    }, 10);
}

// 隐藏自动弹出通知
function hideAutoPopup() {
    const autoPopupContainer = document.getElementById('autoPopupContainer');
    
    if (!autoPopupContainer) {
        return;
    }
    
    // 添加隐藏动画
    autoPopupContainer.classList.remove('show');
    
    // 等待动画完成后隐藏元素
    setTimeout(() => {
        autoPopupContainer.classList.add('hidden');
    }, 300);
}