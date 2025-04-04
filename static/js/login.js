/**
 * 改进的登录页面交互脚本
 */
document.addEventListener('DOMContentLoaded', function() {
    // 随机背景图
    const campusImages = [
        '/static/img/中大风光/1.jpg',
        '/static/img/中大风光/2.jpg',
        '/static/img/中大风光/3.jpg',
        '/static/img/中大风光/4.jpg',
        '/static/img/中大风光/5.jpg',
        '/static/img/中大风光/6.jpg',
        '/static/img/中大风光/7.jpg',
        '/static/img/中大风光/8.jpg',
        '/static/img/中大风光/9.jpg',
        '/static/img/中大风光/10.jpg'
    ];


    
    // 随机选择一张图片
    const randomBgImage = campusImages[Math.floor(Math.random() * campusImages.length)];
    const bgContainer = document.getElementById('bgContainer');
    
    if (bgContainer) {
        bgContainer.style.backgroundImage = `url(${randomBgImage})`;
        
        // 图片加载完成后添加淡入动画
        const img = new Image();
        img.onload = function() {
            bgContainer.style.opacity = '1';
        };
        img.src = randomBgImage;
    }
    
    // 获取DOM元素
    const loginForm = document.getElementById('loginForm');
    const loginPanel = document.getElementById('loginPanel');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    
    // 移除初始的自动聚焦 - 使用setTimeout确保在浏览器自动聚焦之后执行
    setTimeout(() => {
        // 如果任何输入框有焦点，将其移除
        if (document.activeElement instanceof HTMLInputElement) {
            document.activeElement.blur();
        }
    }, 800);
    
    // 输入框焦点效果
    if (usernameInput && passwordInput && bgContainer) {
        usernameInput.addEventListener('focus', () => {
            bgContainer.classList.add('bg-blur');
            loginPanel.classList.add('active');
        });
        
        passwordInput.addEventListener('focus', () => {
            bgContainer.classList.add('bg-blur');
            loginPanel.classList.add('active');
        });
        
        usernameInput.addEventListener('blur', () => {
            if (document.activeElement !== passwordInput) {
                bgContainer.classList.remove('bg-blur');
                loginPanel.classList.remove('active');
            }
        });
        
        passwordInput.addEventListener('blur', () => {
            if (document.activeElement !== usernameInput) {
                bgContainer.classList.remove('bg-blur');
                loginPanel.classList.remove('active');
            }
        });
    }
    
    // 添加登录表单提交处理
    if (loginForm) {
        loginForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            // 添加按钮加载状态
            const submitBtn = this.querySelector('button[type="submit"]');
            const originalBtnText = submitBtn.textContent;
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<svg class="animate-spin h-5 w-5 mr-2 inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> 登录中...';
            
            const form = e.target;
            const formData = new FormData(form);

            fetch('/login', {
                method: 'POST',
                body: formData
            })
            .then(response => {
                if (response.redirected) {
                    // 登录成功，显示成功通知
                    showToast('登录成功，正在跳转...', 'success');
                    
                    // 添加淡出效果
                    document.body.classList.add('fade-out');
                    
                    // 延迟跳转以便用户看到成功提示
                    setTimeout(() => {
                        window.location.href = response.url;
                    }, 1000);
                } else {
                    // 登录失败，显示错误提示
                    loginPanel.classList.add('shake');
                    setTimeout(() => {
                        loginPanel.classList.remove('shake');
                    }, 600);
                    
                    // 恢复按钮状态
                    submitBtn.disabled = false;
                    submitBtn.textContent = originalBtnText;
                    
                    // 显示Toast
                    showToast('登录失败，请检查用户名和密码', 'error');
                }
            })
            .catch(error => {
                console.error('Error:', error);
                
                // 恢复按钮状态
                submitBtn.disabled = false;
                submitBtn.textContent = originalBtnText;
                
                showToast('网络错误，请稍后重试', 'error');
            });
        });
    }
    
    // 模拟预加载背景图片
    campusImages.forEach(url => {
        const img = new Image();
        img.src = url;
    });
});

/**
 * 显示Toast通知
 * @param {string} message - 通知消息内容
 * @param {string} type - 通知类型，'error'或'success'
 * @param {number} duration - 显示时长（毫秒）
 */
function showToast(message, type = 'error', duration = 3000) {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toastMessage');
    
    if (!toast || !toastMessage) return;
    
    // 设置消息
    toastMessage.textContent = message;
    
    // 设置颜色类型
    if (type === 'success') {
        toast.classList.remove('bg-red-500');
        toast.classList.add('bg-green-500');
    } else if (type === 'error') {
        toast.classList.remove('bg-green-500');
        toast.classList.add('bg-red-500');
    }
    
    // 显示Toast
    toast.classList.add('show');
    
    // 定时隐藏Toast
    setTimeout(() => {
        toast.classList.remove('show');
    }, duration);
}