/**
 * register.js - 用户注册模块
 * 
 * 处理用户注册流程，包括表单验证、验证码发送与验证，以及注册请求的提交。
 * 优化图片加载，只加载随机选择的一张背景图片。
 * 增强表单验证和用户反馈体验。
 * 支持班级下拉菜单选择。
 * 
 * @module register
 * @requires toast.js
 * @requires flowbite.js
 * 
 * 主要功能：
 * - 注册表单字段验证
 * - 实时输入验证和反馈
 * - 班级下拉菜单处理
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
    const classNameInput = document.getElementById('class_name');
    const dropdownClassButton = document.getElementById('dropdownClassButton');
    const selectedClassText = document.getElementById('selected_class');
    
    // 添加输入框焦点事件 - 背景模糊效果
    const inputs = document.querySelectorAll('input');
    if (inputs.length > 0 && bgContainer) {
        inputs.forEach(input => {
            input.addEventListener('focus', () => {
                bgContainer.classList.add('bg-blur');
                registerPanel.classList.add('active');
            });
            
            input.addEventListener('blur', () => {
                // 检查是否还有其他输入框处于焦点状态
                const activeInput = document.querySelector('input:focus');
                if (!activeInput) {
                    bgContainer.classList.remove('bg-blur');
                    registerPanel.classList.remove('active');
                }
                
                // 在失去焦点时进行字段验证
                if (input.id === 'name') {
                    validateField(input, value => value.length >= 2, '姓名至少需要2个字符');
                } else if (input.id === 'student_id') {
                    validateField(input, value => /^\d{8}$/.test(value), '学号必须是8位数字');
                } else if (input.id === 'email') {
                    validateField(input, validateEmail, '请输入有效的邮箱地址');
                } else if (input.id === 'password') {
                    validateField(input, value => value.length >= 6, '密码长度至少为6位');
                }
            });
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
            const className = classNameInput.value.trim();
            
            // 验证所有必填字段
            let isValid = true;
            isValid = validateField(nameInput, value => value.length >= 2, '姓名至少需要2个字符') && isValid;
            isValid = validateField(studentIdInput, value => /^\d{8}$/.test(value), '学号必须是8位数字') && isValid;
            isValid = validateField(emailInput, validateEmail, '请输入有效的邮箱地址') && isValid;
            isValid = validateField(passwordInput, value => value.length >= 6, '密码长度至少为6位') && isValid;
            isValid = validateField(verifyCodeInput, value => value.length > 0, '请输入验证码') && isValid;
            isValid = validateField(classNameInput, value => value.length > 0, '请选择班级') && isValid;
            
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

        // 为下拉按钮添加焦点/失焦事件
        if (dropdownClassButton && bgContainer) {
            dropdownClassButton.addEventListener('click', () => {
                bgContainer.classList.add('bg-blur');
                registerPanel.classList.add('active');
            });
            
            // 在文档点击事件中处理下拉菜单失焦
            document.addEventListener('click', (e) => {
                if (!e.target.closest('#dropdown_class') && 
                    !e.target.closest('#dropdownClassButton') && 
                    !document.querySelector('input:focus')) {
                    bgContainer.classList.remove('bg-blur');
                    registerPanel.classList.remove('active');
                }
            });
        }
        
        // 下拉菜单选择事件 - HTML中已经添加了，这里添加验证逻辑
        classNameInput.addEventListener('change', function() {
            validateField(this, value => value.length > 0, '请选择班级');
            
            // 更新下拉按钮样式，显示为激活状态
            if (this.value) {
                dropdownClassButton.classList.add('border-blue-400');
                dropdownClassButton.classList.remove('border-white');
            } else {
                dropdownClassButton.classList.remove('border-blue-400');
                dropdownClassButton.classList.add('border-white');
            }
        });
        
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
        
        // 表单字段验证与可视化反馈
        function validateField(input, validationFn, errorMsg) {
            const value = input.value.trim();
            const isValid = validationFn(value);
            
            // 移除之前的任何错误/成功消息和样式
            clearFieldStatus(input);
            
            if (!isValid) {
                // 添加错误样式 - 对于普通输入框和隐藏输入框的不同处理
                if (input.type === 'hidden') {
                    // 为下拉菜单按钮添加错误样式
                    dropdownClassButton.classList.add('border-red-600');
                    dropdownClassButton.classList.remove('border-green-600', 'border-white', 'border-blue-400');
                    
                    // 创建并添加错误消息
                    const errorElement = document.createElement('p');
                    errorElement.className = 'mt-2 text-xs text-red-600 error-message';
                    errorElement.innerHTML = `<span class="font-medium">错误：</span> ${errorMsg}`;
                    
                    // 将错误消息添加到下拉按钮下方
                    dropdownClassButton.parentNode.appendChild(errorElement);
                } else {
                    // 普通输入框处理
                    input.classList.add('border-red-600');
                    input.classList.remove('border-green-600');
                    
                    // 创建并添加错误消息
                    const errorElement = document.createElement('p');
                    errorElement.className = 'mt-2 text-xs text-red-600 error-message';
                    errorElement.innerHTML = `<span class="font-medium">错误：</span> ${errorMsg}`;
                    
                    // 将错误消息添加到输入字段下方
                    input.parentNode.appendChild(errorElement);
                }
                
                return false;
            } else {
                // 添加成功样式
                if (input.type === 'hidden') {
                    dropdownClassButton.classList.add('border-green-600');
                    dropdownClassButton.classList.remove('border-red-600', 'border-white', 'border-blue-400');
                } else {
                    input.classList.add('border-green-600');
                    input.classList.remove('border-red-600');
                }
                return true;
            }
        }
        
        // 清除字段状态（移除错误/成功样式和消息）
        function clearFieldStatus(input) {
            if (input.type === 'hidden') {
                // 下拉菜单清理
                dropdownClassButton.classList.remove('border-red-600', 'border-green-600');
                
                // 移除错误消息
                const errorElement = dropdownClassButton.parentNode.querySelector('.error-message');
                if (errorElement) {
                    errorElement.remove();
                }
            } else {
                // 普通输入框清理
                input.classList.remove('border-red-600', 'border-green-600');
                
                // 移除错误消息
                const errorElement = input.parentNode.querySelector('.error-message');
                if (errorElement) {
                    errorElement.remove();
                }
            }
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
                const className = classNameInput.value.trim();
    
                // 验证所有必填字段
                let isValid = true;
                isValid = validateField(nameInput, value => value.length >= 2, '姓名至少需要2个字符') && isValid;
                isValid = validateField(studentIdInput, value => /^\d{8}$/.test(value), '学号必须是8位数字') && isValid;
                isValid = validateField(emailInput, validateEmail, '请输入有效的邮箱地址') && isValid;
                isValid = validateField(classNameInput, value => value.length > 0, '请选择班级') && isValid;
    
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
});
    
