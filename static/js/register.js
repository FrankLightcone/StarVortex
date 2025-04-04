/**
 * register.js - 用户注册模块
 * 
 * 处理用户注册流程，包括表单验证、验证码发送与验证，以及注册请求的提交。
 * 
 * @module register
 * @requires toast.js
 * 
 * 主要功能：
 * - 注册表单字段验证
 * - 邮箱验证码发送和倒计时处理
 * - 用户注册请求处理
 * - 注册成功后重定向
 * 
 * @function validateEmail
 *   验证邮箱格式是否正确
 *   @param {string} email - 待验证的邮箱地址
 *   @returns {boolean} - 返回邮箱是否有效
 * 
 * @function startCountdown
 *   开始验证码发送后的倒计时
 *   @returns {void}
 * 
 * @function updateSendButtonText
 *   更新发送验证码按钮的文本显示
 *   @returns {void}
 * 
 * 事件监听器：
 * - DOMContentLoaded: 初始化注册表单和相关组件
 * - click (sendVerifyCodeBtn): 发送验证码
 * - click (registerBtn): 提交注册表单
 * 
 * Fetch请求：
 * - POST /send_verify_code: 发送验证码到指定邮箱
 * - POST /register: 提交注册信息
 */

document.addEventListener('DOMContentLoaded', function() {
    // 获取页面元素
    const nameInput = document.getElementById('name');
    const emailInput = document.getElementById('email');
    const studentIdInput = document.getElementById('student_id');
    const passwordInput = document.getElementById('password');
    const sendVerifyCodeBtn = document.getElementById('sendVerifyCodeBtn');
    const verifyCodeInput = document.getElementById('verify_code');
    const registerBtn = document.getElementById('registerBtn');
    const registerForm = document.getElementById('registerForm');
    
    let countdown = 0;
    let countdownInterval;

    // 验证邮箱格式
    function validateEmail(email) {
        const re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
        return re.test(String(email).toLowerCase());
    }

    // 阻止表单默认提交行为
    if (registerForm) {
        registerForm.addEventListener('submit', function(e) {
            e.preventDefault();
        });
    }
    
    // 开始倒计时
    function startCountdown() {
        countdown = 60;
        updateSendButtonText();
        
        sendVerifyCodeBtn.disabled = true;
        
        countdownInterval = setInterval(() => {
            countdown--;
            updateSendButtonText();
            
            if (countdown <= 0) {
                clearInterval(countdownInterval);
                sendVerifyCodeBtn.disabled = false;
            }
        }, 1000);
    }
    
    // 更新发送按钮文本
    function updateSendButtonText() {
        if (countdown > 0) {
            sendVerifyCodeBtn.textContent = `重新发送(${countdown}s)`;
        } else {
            sendVerifyCodeBtn.textContent = '发送验证码';
        }
    }

    // 发送验证码事件
    if (sendVerifyCodeBtn) {
        sendVerifyCodeBtn.addEventListener('click', async () => {
            const name = nameInput.value.trim();
            const email = emailInput.value.trim();
            const studentId = studentIdInput.value.trim();

            if (!name) {
                showToast('请输入姓名');
                return;
            }
            
            if (!studentId) {
                showToast('请输入学号');
                return;
            }
            
            if (!email) {
                showToast('请输入邮箱');
                return;
            }
            
            if (!validateEmail(email)) {
                showToast('邮箱格式不正确');
                return;
            }
            
            // 立即开始倒计时和禁用按钮，提供即时反馈
            startCountdown();
            sendVerifyCodeBtn.textContent = '发送中...';
            
            try {
                const response = await fetch('/send_verify_code', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        name: name,
                        email: email,
                        student_id: studentId
                    })
                });

                const result = await response.json();
                if (result.status === 'success') {
                    showToast('验证码已发送', 'success');
                } else {
                    // 如果发送失败，重置倒计时
                    clearInterval(countdownInterval);
                    countdown = 0;
                    sendVerifyCodeBtn.disabled = false;
                    sendVerifyCodeBtn.textContent = '发送验证码';
                    showToast(result.message || '发送失败');
                }
            } catch (error) {
                console.error('Error:', error);
                // 如果发生错误，重置倒计时
                clearInterval(countdownInterval);
                countdown = 0;
                sendVerifyCodeBtn.disabled = false;
                sendVerifyCodeBtn.textContent = '发送验证码';
                showToast('发送验证码出错');
            }
        });
    }

    // 注册按钮事件
    if (registerBtn) {
        registerBtn.addEventListener('click', async () => {
            const name = nameInput.value.trim();
            const email = emailInput.value.trim();
            const studentId = studentIdInput.value.trim();
            const password = passwordInput.value.trim();
            const verifyCode = verifyCodeInput.value.trim();
            
            // 验证所有字段
            if (!name) {
                showToast('请输入姓名');
                return;
            }
            
            if (!studentId) {
                showToast('请输入学号');
                return;
            }
            
            if (!email) {
                showToast('请输入邮箱');
                return;
            }
            
            if (!validateEmail(email)) {
                showToast('邮箱格式不正确');
                return;
            }
            
            if (!password) {
                showToast('请输入密码');
                return;
            }
            
            if (password.length < 6) {
                showToast('密码长度至少为6位');
                return;
            }
            
            if (!verifyCode) {
                showToast('请输入验证码');
                return;
            }

            try {
                registerBtn.disabled = true;
                registerBtn.textContent = '注册中...';
                
                const response = await fetch('/register', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        name: name,
                        email: email,
                        student_id: studentId,
                        password: password,
                        verify_code: verifyCode
                    })
                });

                const result = await response.json();
                if (result.status === 'success') {
                    showToast('注册成功', 'success');
                    // 延迟跳转，让用户看到成功消息
                    setTimeout(() => {
                        window.location.href = '/login';
                    }, 1500);
                } else {
                    showToast(result.message || '注册失败');
                    registerBtn.disabled = false;
                    registerBtn.textContent = '注册';
                }
            } catch (error) {
                console.error('Error:', error);
                showToast('注册出错');
                registerBtn.disabled = false;
                registerBtn.textContent = '注册';
            }
        });
    }
});