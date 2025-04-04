/**
 * admin_login.js - 管理员登录模块
 * 
 * 处理管理员登录表单和登录逻辑，包括登录请求的发送和响应处理。
 * 提供登录失败时的错误提示和动画效果。
 * 
 * @module admin_login
 * @requires toast.js
 * 
 * 主要功能：
 * - 管理员登录表单提交处理
 * - 登录成功后重定向到管理面板
 * - 登录失败时显示错误信息并添加震动效果
 * - 自动显示后端返回的错误信息
 * 
 * 事件监听器：
 * - DOMContentLoaded：初始化登录表单和错误提示
 * - submit：拦截表单提交，通过fetch API发送登录请求
 * 
 * 特殊效果：
 * - 登录失败时表单震动动画
 * - 自动显示错误提示toast
 * 
 * Fetch请求：
 * - POST /admin：发送管理员登录凭据
 */
document.addEventListener('DOMContentLoaded', function() {
    // 获取DOM元素
    const loginForm = document.getElementById('loginForm');
    const errorElement = document.querySelector('.bg-red-50');
    
    // 处理表单提交
    if (loginForm) {
        loginForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const form = e.target;
            const formData = new FormData(form);

            fetch('/admin', {
                method: 'POST',
                body: formData
            })
            .then(response => {
                if (response.redirected) {
                    // 登录成功，跳转页面
                    window.location.href = response.url;
                } else {
                    // 登录失败，解析错误信息
                    return response.text().then(html => {
                        // 提取错误信息
                        const parser = new DOMParser();
                        const doc = parser.parseFromString(html, 'text/html');
                        const errorMsg = doc.querySelector('.text-red-800')?.textContent || '登录失败，请检查用户名和密码';
                        
                        // 显示错误提示
                        showToast(errorMsg, 'error');
                        
                        // 添加震动效果
                        const formContainer = loginForm.closest('.bg-white');
                        formContainer.classList.add('error-shake');
                        
                        // 移除震动效果
                        setTimeout(() => {
                            formContainer.classList.remove('error-shake');
                        }, 1000);
                    });
                }
            })
            .catch(error => {
                console.error('Error:', error);
                showToast('网络错误，请稍后重试', 'error');
            });
        });
    }
    
    // 检查是否有错误信息需要显示
    if (errorElement) {
        // 如果有错误信息，显示 Toast
        const toast = document.getElementById('toast');
        toast.textContent = errorElement.querySelector('h3').textContent;
        toast.classList.add('show');
        
        // 3秒后隐藏 Toast
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }
});