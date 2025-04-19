/**
 * reset_password.js - 密码重置模块
 * 
 * 处理用户密码重置流程，包括邮箱验证、验证码输入和密码重置。
 * 修复了验证码验证成功后切换到密码重置步骤时的抖动问题。
 * 
 * @module reset_password
 * 
 * 主要功能：
 * - 多步骤密码重置流程
 * - 邮箱验证和验证码发送
 * - 验证码分离输入框控制
 * - 验证码有效期倒计时显示
 * - 密码重置请求处理
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
        '/static/img/中大风光/10.jpg',
        '/static/img/中大风光/11.jpg',
        '/static/img/中大风光/12.jpg'
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
    const emailForm = document.getElementById('emailForm');
    const emailInput = document.getElementById('email');
    const sendCodeBtn = document.getElementById('sendCodeBtn');
    const resendCodeBtn = document.getElementById('resendCodeBtn');
    const verifyCodeBtn = document.getElementById('verifyCodeBtn');
    const passwordForm = document.getElementById('passwordForm');
    const newPasswordInput = document.getElementById('newPassword');
    const confirmPasswordInput = document.getElementById('confirmPassword');
    const resetPasswordBtn = document.getElementById('resetPasswordBtn');
    const codeInputs = document.querySelectorAll('.verification-code-input');
    const codeTimer = document.getElementById('codeTimer');
    const resetPanel = document.getElementById('resetPanel');
    
    // 当前步骤
    let currentStep = 1;
    
    // 验证码相关数据
    let verificationCode = '';
    let verificationEmail = '';
    let timerInterval = null;
    let resendCountdown = 0;
    
    // 显示Toast通知
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
    
    // 显示指定步骤（修复版本）
    function showStep(stepNumber) {
        const steps = document.querySelectorAll('.step');
        
        // 首先，给当前要隐藏的步骤添加淡出动画
        if (currentStep !== stepNumber) {
            const currentStepElement = steps[currentStep - 1];
            currentStepElement.classList.add('fade-out');
            
            // 等待淡出动画完成后，再显示新步骤
            setTimeout(() => {
                // 隐藏所有步骤
                steps.forEach(step => {
                    step.classList.add('hidden');
                    step.classList.remove('fade-in', 'fade-out');
                });
                
                // 显示目标步骤
                const targetStep = steps[stepNumber - 1];
                targetStep.classList.remove('hidden');
                
                // 添加淡入动画
                targetStep.classList.add('fade-in');
                
                // 更新当前步骤
                currentStep = stepNumber;
                
                // 如果是步骤3，聚焦到新密码输入框
                if (stepNumber === 3 && newPasswordInput) {
                    setTimeout(() => {
                        newPasswordInput.focus();
                    }, 100);
                }
                
                // 如果是步骤2，聚焦到第一个验证码输入框
                if (stepNumber === 2 && codeInputs.length > 0) {
                    setTimeout(() => {
                        codeInputs[0].focus();
                    }, 100);
                }
            }, 300); // 等待300ms，与CSS中的动画时间匹配
        }
    }
    
    // 格式化时间 (将秒转为 MM:SS 格式)
    function formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
    }
    
    // 开始验证码计时器
    function startCodeTimer(duration = 300) { // 默认5分钟
        let timeRemaining = duration;
        
        // 清除可能存在的旧计时器
        if (timerInterval) {
            clearInterval(timerInterval);
        }
        
        // 初始显示
        codeTimer.textContent = `有效期: ${formatTime(timeRemaining)}`;
        codeTimer.classList.remove('expiring');
        
        timerInterval = setInterval(() => {
            timeRemaining--;
            
            // 最后60秒添加红色动画效果
            if (timeRemaining <= 60) {
                codeTimer.classList.add('expiring');
            }
            
            // 更新显示
            codeTimer.textContent = `有效期: ${formatTime(timeRemaining)}`;
            
            // 时间到
            if (timeRemaining <= 0) {
                clearInterval(timerInterval);
                codeTimer.textContent = '验证码已过期';
                showToast('验证码已过期，请重新获取', 'error');
                
                // 启用重新发送按钮
                resendCodeBtn.disabled = false;
            }
        }, 1000);
    }
    
    // 开始重发按钮倒计时
    function startResendCountdown(duration = 60) {
        resendCountdown = duration;
        resendCodeBtn.disabled = true;
        
        const countdownInterval = setInterval(() => {
            resendCountdown--;
            resendCodeBtn.textContent = `重新发送 (${resendCountdown}s)`;
            
            if (resendCountdown <= 0) {
                clearInterval(countdownInterval);
                resendCodeBtn.textContent = '重新发送';
                resendCodeBtn.disabled = false;
            }
        }, 1000);
    }
    
    // 验证码输入框控制
    if (codeInputs.length > 0) {
        // 处理输入事件
        codeInputs.forEach((input, index) => {
            // 输入时自动跳到下一个输入框
            input.addEventListener('input', (e) => {
                const value = e.target.value;
                
                // 清除错误样式
                input.classList.remove('error');
                
                // 如果输入了内容，自动跳转到下一个输入框
                if (value.length === 1) {
                    input.classList.add('filled');
                    
                    // 聚焦下一个输入框
                    if (index < codeInputs.length - 1) {
                        codeInputs[index + 1].focus();
                    }
                } else {
                    input.classList.remove('filled');
                }
                
                // 更新验证码
                updateVerificationCode();
            });
            
            // 处理键盘事件（回退键）
            input.addEventListener('keydown', (e) => {
                // 如果按下回退键且输入框为空，聚焦上一个输入框
                if (e.key === 'Backspace' && input.value === '' && index > 0) {
                    codeInputs[index - 1].focus();
                }
            });
            
            // 聚焦时自动选中内容
            input.addEventListener('focus', () => {
                input.select();
            });
        });
        
        // 处理粘贴事件 - 如果用户粘贴完整的验证码
        codeInputs[0].addEventListener('paste', (e) => {
            e.preventDefault();
            
            // 获取粘贴的文本
            const pasteData = e.clipboardData.getData('text');
            
            // 只取前8个字符（或根据输入框数量决定）
            const chars = pasteData.slice(0, codeInputs.length).split('');
            
            // 填充到输入框
            chars.forEach((char, i) => {
                if (i < codeInputs.length) {
                    codeInputs[i].value = char;
                    
                    // 添加已填充样式
                    if (char) {
                        codeInputs[i].classList.add('filled');
                    } else {
                        codeInputs[i].classList.remove('filled');
                    }
                }
            });
            
            // 聚焦到最后一个有内容的输入框的下一个，或最后一个
            const nextFocusIndex = Math.min(chars.length, codeInputs.length - 1);
            codeInputs[nextFocusIndex].focus();
            
            // 更新验证码
            updateVerificationCode();
        });
    }
    
    // 更新验证码字符串
    function updateVerificationCode() {
        verificationCode = Array.from(codeInputs)
            .map(input => input.value)
            .join('');
    }
    
    // 显示验证码错误动画
    function showCodeError() {
        codeInputs.forEach(input => {
            input.classList.add('error');
        });
        
        resetPanel.classList.add('shake');
        
        setTimeout(() => {
            resetPanel.classList.remove('shake');
        }, 600);
    }
    
    // 清空验证码输入框
    function clearCodeInputs() {
        codeInputs.forEach(input => {
            input.value = '';
            input.classList.remove('filled');
            input.classList.remove('error');
        });
        
        // 聚焦第一个输入框
        codeInputs[0].focus();
        
        // 重置验证码
        verificationCode = '';
    }
    
    // 邮箱验证表单提交处理
    if (emailForm) {
        emailForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const email = emailInput.value.trim();
            
            // 验证邮箱
            if (!email) {
                showToast('请输入邮箱', 'error');
                return;
            }
            
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                showToast('请输入有效的邮箱地址', 'error');
                return;
            }
            
            // 禁用按钮并显示加载状态
            sendCodeBtn.disabled = true;
            sendCodeBtn.innerHTML = `
                <svg class="animate-spin h-5 w-5 mr-2 inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                发送中...
            `;
            
            // 保存邮箱地址
            verificationEmail = email;
            
            // 发送验证码请求
            fetch('/send_reset_code', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email })
            })
            .then(response => response.json())
            .then(data => {
                // 恢复按钮状态
                sendCodeBtn.disabled = false;
                sendCodeBtn.textContent = '发送验证码';
                
                if (data.status === 'success') {
                    // 进入第二步
                    showStep(2);
                    
                    // 开始计时器
                    startCodeTimer(300); // 5分钟
                    
                    // 开始重发按钮倒计时
                    startResendCountdown(60); // 60秒
                    
                    showToast('验证码已发送，请查收邮件', 'success');
                } else {
                    showToast(data.message || '发送验证码失败', 'error');
                }
            })
            .catch(error => {
                console.error('Error:', error);
                sendCodeBtn.disabled = false;
                sendCodeBtn.textContent = '发送验证码';
                showToast('网络错误，请稍后重试', 'error');
            });
        });
    }
    
    // 重新发送验证码按钮点击事件
    if (resendCodeBtn) {
        resendCodeBtn.addEventListener('click', function() {
            if (resendCodeBtn.disabled) return;
            
            // 禁用按钮
            resendCodeBtn.disabled = true;
            resendCodeBtn.textContent = '发送中...';
            
            // 发送验证码请求
            fetch('/send_reset_code', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email: verificationEmail })
            })
            .then(response => response.json())
            .then(data => {
                if (data.status === 'success') {
                    // 清空验证码输入框
                    clearCodeInputs();
                    
                    // 重置计时器
                    startCodeTimer(300); // 5分钟
                    
                    // 开始重发按钮倒计时
                    startResendCountdown(60); // 60秒
                    
                    showToast('验证码已重新发送，请查收邮件', 'success');
                } else {
                    resendCodeBtn.disabled = false;
                    resendCodeBtn.textContent = '重新发送';
                    showToast(data.message || '发送验证码失败', 'error');
                }
            })
            .catch(error => {
                console.error('Error:', error);
                resendCodeBtn.disabled = false;
                resendCodeBtn.textContent = '重新发送';
                showToast('网络错误，请稍后重试', 'error');
            });
        });
    }
    
    // 验证码验证按钮点击事件
    if (verifyCodeBtn) {
        verifyCodeBtn.addEventListener('click', function() {
            // 验证码必须完整填写
            if (verificationCode.length !== 8) {
                showToast('请输入完整的8位验证码', 'error');
                showCodeError();
                return;
            }
            
            // 显示加载状态
            verifyCodeBtn.disabled = true;
            verifyCodeBtn.innerHTML = `
                <svg class="animate-spin h-5 w-5 mr-2 inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                验证中...
            `;
            
            // 发送验证请求
            fetch('/verify_reset_code', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    email: verificationEmail,
                    code: verificationCode
                })
            })
            .then(response => response.json())
            .then(data => {
                verifyCodeBtn.disabled = false;
                verifyCodeBtn.textContent = '验证';
                
                if (data.status === 'success') {
                    // 清除计时器
                    if (timerInterval) {
                        clearInterval(timerInterval);
                    }
                    
                    // 显示成功提示
                    showToast('验证成功，请设置新密码', 'success');
                    
                    // 进入第三步（先允许验证按钮复位，再切换步骤）
                    setTimeout(() => {
                        showStep(3);
                    }, 50);
                } else {
                    showToast(data.message || '验证码错误或已过期', 'error');
                    showCodeError();
                }
            })
            .catch(error => {
                console.error('Error:', error);
                verifyCodeBtn.disabled = false;
                verifyCodeBtn.textContent = '验证';
                showToast('网络错误，请稍后重试', 'error');
            });
        });
    }
    
    // 密码重置表单提交
    if (passwordForm) {
        passwordForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const newPassword = newPasswordInput.value;
            const confirmPassword = confirmPasswordInput.value;
            
            // 验证密码
            if (!newPassword) {
                showToast('请输入新密码', 'error');
                return;
            }
            
            if (newPassword.length < 6) {
                showToast('密码长度至少为6位', 'error');
                return;
            }
            
            if (newPassword !== confirmPassword) {
                showToast('两次输入的密码不一致', 'error');
                return;
            }
            
            // 显示加载状态
            resetPasswordBtn.disabled = true;
            resetPasswordBtn.innerHTML = `
                <svg class="animate-spin h-5 w-5 mr-2 inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                重置中...
            `;
            
            // 发送密码重置请求
            fetch('/reset_password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    email: verificationEmail,
                    code: verificationCode,
                    password: newPassword
                })
            })
            .then(response => response.json())
            .then(data => {
                resetPasswordBtn.disabled = false;
                resetPasswordBtn.textContent = '重置密码';
                
                if (data.status === 'success') {
                    showToast('密码重置成功，即将跳转到登录页面', 'success');
                    
                    // 添加淡出效果
                    document.body.classList.add('fade-out');
                    
                    // 延迟跳转
                    setTimeout(() => {
                        window.location.href = '/login';
                    }, 2000);
                } else {
                    showToast(data.message || '密码重置失败', 'error');
                }
            })
            .catch(error => {
                console.error('Error:', error);
                resetPasswordBtn.disabled = false;
                resetPasswordBtn.textContent = '重置密码';
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