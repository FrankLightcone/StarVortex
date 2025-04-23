/**
 * register.js - 用户注册模块
 * 
 * 处理用户注册流程，包括表单验证、验证码发送与验证，以及注册请求的提交。
 * 优化图片加载，只加载随机选择的一张背景图片。
 * 
 * @module register
 * @requires toast.js
 * 
 * 主要功能：
 * - 注册表单字段验证
 * - 邮箱验证码发送和倒计时处理
 * - 用户注册请求处理
 * - 注册成功后重定向
 * - 表单验证反馈和交互优化
 */

document.addEventListener('DOMContentLoaded', function() {
    // 随机背景图配置
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
        '/static/img/中大风光/10.jpg',
        '/static/img/中大风光/11.jpg',
        '/static/img/中大风光/12.jpg'
    ];
    
    // 只随机选择一张图片
    const randomIndex = Math.floor(Math.random() * campusImages.length);
    const selectedBackgroundImage = campusImages[randomIndex];
    const bgContainer = document.getElementById('bgContainer');
    
    if (bgContainer) {
        // 为提高性能，先显示容器再设置背景图
        bgContainer.style.opacity = '0';
        bgContainer.style.backgroundImage = `url(${selectedBackgroundImage})`;
        
        // 图片加载完成后淡入显示
        const img = new Image();
        img.onload = function() {
            bgContainer.style.opacity = '1';
        };
        img.src = selectedBackgroundImage;
    }
    
    // 获取页面元素
    const nameInput = document.getElementById('name');
    const emailInput = document.getElementById('email');
    const studentIdInput = document.getElementById('student_id');
    const passwordInput = document.getElementById('password');
    const sendVerifyCodeBtn = document.getElementById('sendVerifyCodeBtn');
    const verifyCodeInput = document.getElementById('verify_code');
    const registerBtn = document.getElementById('registerBtn');
    const registerForm = document.getElementById('registerForm');
    const registerPanel = document.getElementById('registerPanel');
    
    // 添加输入框焦点事件 - 背景模糊效果
    const inputs = document.querySelectorAll('.form-input');
    if (inputs.length > 0 && bgContainer) {
        inputs.forEach(input => {
            input.addEventListener('focus', () => {
                bgContainer.classList.add('bg-blur');
                registerPanel.classList.add('active');
            });
            
            input.addEventListener('blur', () => {
                // 检查是否还有其他输入框处于焦点状态
                const activeInput = document.querySelector('.form-input:focus');
                if (!activeInput) {
                    bgContainer.classList.remove('bg-blur');
                    registerPanel.classList.remove('active');
                }
            });
        });
    }
    
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
    
    // 表单字段验证
    function validateField(input, validationFn, errorMsg) {
        const value = input.value.trim();
        const isValid = validationFn(value);
        
        if (!isValid) {
            input.classList.add('input-error');
            input.classList.remove('input-success');
            
            // 检查是否已有错误消息
            let errorElement = input.parentNode.querySelector('.error-message');
            if (!errorElement) {
                errorElement = document.createElement('div');
                errorElement.className = 'error-message';
                input.parentNode.appendChild(errorElement);
            }
            errorElement.textContent = errorMsg;
            
            return false;
        } else {
            input.classList.remove('input-error');
            input.classList.add('input-success');
            
            // 移除错误消息
            const errorElement = input.parentNode.querySelector('.error-message');
            if (errorElement) {
                errorElement.remove();
            }
            
            return true;
        }
    }
    
    // 添加输入字段验证事件
    if (nameInput) {
        nameInput.addEventListener('blur', function() {
            validateField(this, value => value.length >= 2, '姓名至少需要2个字符');
        });
    }
    
    if (studentIdInput) {
        studentIdInput.addEventListener('blur', function() {
            validateField(this, value => /^\d{8}$/.test(value), '学号必须是8位数字');
        });
    }
    
    if (emailInput) {
        emailInput.addEventListener('blur', function() {
            validateField(this, validateEmail, '请输入有效的邮箱地址');
        });
    }
    
    if (passwordInput) {
        passwordInput.addEventListener('blur', function() {
            validateField(this, value => value.length >= 6, '密码长度至少为6位');
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
            const className = document.getElementById('class_name').value.trim();

            // 验证所有必填字段
            let isValid = true;
            isValid = validateField(nameInput, value => value.length >= 2, '姓名至少需要2个字符') && isValid;
            isValid = validateField(studentIdInput, value => value.length >= 5, '请输入有效的学号') && isValid;
            isValid = validateField(emailInput, validateEmail, '请输入有效的邮箱地址') && isValid;

            // 检查班级名称是否为空
            if (className === '') {
                showToast('班级名称不能为空');
                registerPanel.classList.add('shake');
                setTimeout(() => {
                    registerPanel.classList.remove('shake');
                }, 600);
                return;
            }
            
            if (!isValid) {
                registerPanel.classList.add('shake');
                setTimeout(() => {
                    registerPanel.classList.remove('shake');
                }, 600);
                return;
            }
            
            // 立即开始倒计时和禁用按钮，提供即时反馈
            startCountdown();
            
            // 添加发送中动画
            sendVerifyCodeBtn.innerHTML = `
                <svg class="animate-spin h-4 w-4 mr-1 inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                发送中...
            `;
            
            try {
                const response = await fetch('/send_verify_code', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        name: name,
                        email: email,
                        student_id: studentId,
                        class_name: className
                    })
                });

                const result = await response.json();
                if (result.status === 'success') {
                    showToast('验证码已发送，请查收邮件', 'success');
                    // 聚焦到验证码输入框
                    verifyCodeInput.focus();
                } else {
                    // 如果发送失败，重置倒计时
                    clearInterval(countdownInterval);
                    countdown = 0;
                    sendVerifyCodeBtn.disabled = false;
                    sendVerifyCodeBtn.textContent = '发送验证码';
                    showToast(result.message || '发送失败');
                    
                    registerPanel.classList.add('shake');
                    setTimeout(() => {
                        registerPanel.classList.remove('shake');
                    }, 600);
                }
            } catch (error) {
                console.error('Error:', error);
                // 如果发生错误，重置倒计时
                clearInterval(countdownInterval);
                countdown = 0;
                sendVerifyCodeBtn.disabled = false;
                sendVerifyCodeBtn.textContent = '发送验证码';
                showToast('发送验证码出错');
                
                registerPanel.classList.add('shake');
                setTimeout(() => {
                    registerPanel.classList.remove('shake');
                }, 600);
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
            const className = document.getElementById('class_name').value.trim();
            
            // 验证所有必填字段
            let isValid = true;
            isValid = validateField(nameInput, value => value.length >= 2, '姓名至少需要2个字符') && isValid;
            isValid = validateField(studentIdInput, value => value.length >= 5, '请输入有效的学号') && isValid;
            isValid = validateField(emailInput, validateEmail, '请输入有效的邮箱地址') && isValid;
            isValid = validateField(passwordInput, value => value.length >= 6, '密码长度至少为6位') && isValid;
            isValid = validateField(verifyCodeInput, value => value.length > 0, '请输入验证码') && isValid;

            // 检查班级名称是否为空
            if (className === '') {
                showToast('班级名称不能为空');
                registerPanel.classList.add('shake');
                setTimeout(() => {
                    registerPanel.classList.remove('shake');
                }, 600);
                return;
            }
            
            if (!isValid) {
                registerPanel.classList.add('shake');
                setTimeout(() => {
                    registerPanel.classList.remove('shake');
                }, 600);
                return;
            }

            try {
                registerBtn.disabled = true;
                // 添加加载动画
                registerBtn.innerHTML = `
                    <svg class="animate-spin h-5 w-5 mr-2 inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    注册中...
                `;
                
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
                        verify_code: verifyCode,
                        class_name: className
                    })
                });

                const result = await response.json();
                if (result.status === 'success') {
                    // 显示成功消息和动画
                    registerBtn.innerHTML = `
                        <svg class="h-5 w-5 mr-2 inline text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                        </svg>
                        注册成功
                    `;
                    registerBtn.classList.add('bg-green-600');
                    registerPanel.classList.add('success-animation');
                    
                    showToast('注册成功，即将跳转到登录页面', 'success');
                    
                    // 添加页面淡出效果
                    setTimeout(() => {
                        document.body.classList.add('fade-out');
                        // 延迟跳转
                        setTimeout(() => {
                            window.location.href = '/login';
                        }, 800);
                    }, 1000);
                } else {
                    showToast(result.message || '注册失败');
                    registerBtn.disabled = false;
                    registerBtn.textContent = '注册';
                    
                    registerPanel.classList.add('shake');
                    setTimeout(() => {
                        registerPanel.classList.remove('shake');
                    }, 600);
                }
            } catch (error) {
                console.error('Error:', error);
                showToast('注册出错');
                registerBtn.disabled = false;
                registerBtn.textContent = '注册';
                
                registerPanel.classList.add('shake');
                setTimeout(() => {
                    registerPanel.classList.remove('shake');
                }, 600);
            }
        });
    }
    
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
});