/**
 * feedback.js - 即时反馈系统模块
 * 
 * 处理用户反馈的收集和提交，包括文字内容和图片附件的处理。
 * 实现右下角悬浮反馈按钮和反馈表单窗口的功能。
 * 
 * @module feedback
 * @requires toast.js
 * 
 * 主要功能：
 * - 显示和隐藏反馈窗口
 * - 处理反馈表单提交
 * - 处理图片上传和预览
 * - 发送反馈到指定邮箱
 * 
 * 事件监听器：
 * - DOMContentLoaded: 页面加载完成后初始化反馈系统
 * - 点击反馈按钮: 显示反馈窗口
 * - 点击关闭按钮: 隐藏反馈窗口
 * - 表单提交: 发送反馈内容
 * - 图片拖放: 处理图片上传
 */

document.addEventListener('DOMContentLoaded', function() {
    // 创建反馈按钮和容器
    createFeedbackElements();
    
    // 获取DOM元素
    const feedbackBtn = document.getElementById('feedbackBtn');
    const feedbackContainer = document.getElementById('feedbackContainer');
    const closeBtn = document.getElementById('feedbackClose');
    const feedbackForm = document.getElementById('feedbackForm');
    const feedbackContent = document.getElementById('feedbackContent');
    const feedbackDropzone = document.getElementById('feedbackDropzone');
    const fileInput = document.getElementById('feedbackFileInput');
    const imgPreview = document.getElementById('feedbackImgPreview');
    const previewImg = document.getElementById('feedbackPreviewImg');
    const removeImgBtn = document.getElementById('feedbackRemoveImg');
    const submitBtn = document.getElementById('feedbackSubmitBtn');
    const successView = document.getElementById('feedbackSuccess');
    const backBtn = document.getElementById('feedbackBackBtn');
    
    // 记录当前上传的图片
    let currentImage = null;
    
    // 标记是否刚刚打开窗口
    let justOpened = false;
    
    // 显示反馈窗口
    feedbackBtn.addEventListener('click', function(e) {
        e.stopPropagation(); // 阻止事件冒泡
        feedbackContainer.classList.add('show');
        
        // 设置标记，防止立即关闭
        justOpened = true;
        setTimeout(() => {
            justOpened = false;
        }, 100); // 100毫秒后重置标记
    });
    
    // 关闭反馈窗口
    closeBtn.addEventListener('click', function(e) {
        e.stopPropagation(); // 阻止事件冒泡
        feedbackContainer.classList.add('hide');
        setTimeout(() => {
            feedbackContainer.classList.remove('show', 'hide');
            resetForm();
        }, 300);
    });
    
    // 点击外部关闭
    document.addEventListener('click', function(e) {
        // 如果刚刚打开窗口，不要立即关闭
        if (justOpened) return;
        
        if (feedbackContainer.classList.contains('show') && 
            !feedbackContainer.contains(e.target) && 
            e.target !== feedbackBtn) {
            closeBtn.click();
        }
    });
    
    // 阻止反馈容器内的点击事件冒泡
    feedbackContainer.addEventListener('click', function(e) {
        e.stopPropagation();
    });
    
    // 拖放图片上传
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        feedbackDropzone.addEventListener(eventName, preventDefaults, false);
    });
    
    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    ['dragenter', 'dragover'].forEach(eventName => {
        feedbackDropzone.addEventListener(eventName, highlight, false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
        feedbackDropzone.addEventListener(eventName, unhighlight, false);
    });
    
    function highlight() {
        feedbackDropzone.classList.add('dragover');
    }
    
    function unhighlight() {
        feedbackDropzone.classList.remove('dragover');
    }
    
    // 处理拖放上传
    feedbackDropzone.addEventListener('drop', function(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        
        if (files.length > 0) {
            handleImageFile(files[0]);
        }
    });
    
    // 点击上传区域触发文件选择
    feedbackDropzone.addEventListener('click', function() {
        fileInput.click();
    });
    
    // 文件选择处理
    fileInput.addEventListener('change', function() {
        if (this.files.length > 0) {
            handleImageFile(this.files[0]);
        }
    });
    
    // 处理图片文件
    function handleImageFile(file) {
        // 检查文件类型
        if (!file.type.match('image.*')) {
            showToast('请上传图片文件', 'error');
            return;
        }
        
        // 检查文件大小（限制为5MB）
        if (file.size > 5 * 1024 * 1024) {
            showToast('图片大小不能超过5MB', 'error');
            return;
        }
        
        // 保存当前图片文件
        currentImage = file;
        
        // 创建图片预览
        const reader = new FileReader();
        reader.onload = function(e) {
            previewImg.src = e.target.result;
            imgPreview.classList.add('show');
        };
        reader.readAsDataURL(file);
    }
    
    // 删除图片
    removeImgBtn.addEventListener('click', function() {
        currentImage = null;
        imgPreview.classList.remove('show');
        fileInput.value = '';
    });
    
    // 表单提交
    feedbackForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        // 获取表单数据
        const content = feedbackContent.value.trim();
        
        // 验证内容
        if (!content) {
            showToast('请输入反馈内容', 'error');
            return;
        }
        
        // 禁用提交按钮
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>提交中...';
        
        // 创建FormData对象
        const formData = new FormData();
        formData.append('content', content);
        
        // 添加图片（如果有）
        if (currentImage) {
            formData.append('image', currentImage);
        }
        
        // 发送反馈
        fetch('/send_feedback', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                // 显示成功视图
                feedbackForm.style.display = 'none';
                successView.classList.add('show');
            } else {
                throw new Error(data.message || '提交失败');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            showToast(`反馈提交失败: ${error.message}`, 'error');
            
            // 恢复按钮状态
            submitBtn.disabled = false;
            submitBtn.innerHTML = '提交反馈';
        });
    });
    
    // 返回按钮
    backBtn.addEventListener('click', function() {
        resetForm();
        closeBtn.click();
    });
    
    // 重置表单
    function resetForm() {
        feedbackForm.reset();
        feedbackForm.style.display = 'block';
        successView.classList.remove('show');
        imgPreview.classList.remove('show');
        currentImage = null;
        submitBtn.disabled = false;
        submitBtn.innerHTML = '提交反馈';
    }
    
    // 显示Toast通知
    function showToast(message, type = 'error') {
        // 检查是否存在全局showToast函数
        if (typeof window.showToast === 'function') {
            window.showToast(message, type);
        } else {
            // 如果没有，创建简易的Toast函数
            createSimpleToast(message, type);
        }
    }
    
    // 创建简易Toast通知（仅在全局toast不可用时使用）
    function createSimpleToast(message, type) {
        // 检查是否已存在简易Toast
        let toast = document.getElementById('simple-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'simple-toast';
            toast.style.position = 'fixed';
            toast.style.top = '20px';
            toast.style.left = '50%';
            toast.style.transform = 'translateX(-50%)';
            toast.style.padding = '10px 20px';
            toast.style.borderRadius = '4px';
            toast.style.fontWeight = '500';
            toast.style.zIndex = '9999';
            toast.style.transition = 'opacity 0.3s ease';
            document.body.appendChild(toast);
        }
        
        // 设置样式
        toast.style.backgroundColor = type === 'success' ? '#10b981' : '#ef4444';
        toast.style.color = 'white';
        toast.textContent = message;
        
        // 显示Toast
        toast.style.opacity = '1';
        
        // 3秒后隐藏
        setTimeout(() => {
            toast.style.opacity = '0';
        }, 3000);
    }
});

// 创建反馈系统的DOM元素
function createFeedbackElements() {
    // 创建反馈按钮
    const feedbackBtn = document.createElement('div');
    feedbackBtn.id = 'feedbackBtn';
    feedbackBtn.className = 'feedback-btn';
    feedbackBtn.innerHTML = '<i class="fas fa-comment-alt"></i>';
    
    // 创建反馈容器
    const feedbackContainer = document.createElement('div');
    feedbackContainer.id = 'feedbackContainer';
    feedbackContainer.className = 'feedback-container';
    
    // 反馈容器内容
    feedbackContainer.innerHTML = `
        <div class="feedback-header">
            <div class="feedback-title">发送反馈</div>
            <div id="feedbackClose" class="feedback-close"><i class="fas fa-times"></i></div>
        </div>
        <div class="feedback-body">
            <form id="feedbackForm" class="feedback-form">
                <div class="feedback-input-group">
                    <label for="feedbackContent" class="feedback-label">您的反馈</label>
                    <textarea 
                        id="feedbackContent" 
                        class="feedback-textarea" 
                        placeholder="请描述您遇到的问题或建议..."
                        required
                    ></textarea>
                </div>
                
                <div class="feedback-input-group">
                    <label class="feedback-label">添加截图（可选）</label>
                    <div id="feedbackDropzone" class="feedback-dropzone">
                        <div class="feedback-dropzone-icon">
                            <i class="fas fa-cloud-upload-alt"></i>
                        </div>
                        <div class="feedback-dropzone-text">
                            拖放图片到此处或点击上传
                        </div>
                        <input 
                            type="file" 
                            id="feedbackFileInput" 
                            accept="image/*" 
                            class="hidden"
                        >
                    </div>
                    <div id="feedbackImgPreview" class="feedback-img-preview">
                        <img id="feedbackPreviewImg" class="feedback-preview-img">
                        <div id="feedbackRemoveImg" class="feedback-remove-img">
                            <i class="fas fa-times"></i>
                        </div>
                    </div>
                </div>
                
                <button 
                    type="submit" 
                    id="feedbackSubmitBtn" 
                    class="feedback-submit-btn"
                >
                    提交反馈
                </button>
            </form>
            
            <div id="feedbackSuccess" class="feedback-success">
                <div class="feedback-success-icon">
                    <i class="fas fa-check-circle"></i>
                </div>
                <div class="feedback-success-title">反馈已提交</div>
                <div class="feedback-success-message">
                    感谢您的反馈，我们将尽快处理！
                </div>
                <button id="feedbackBackBtn" class="feedback-back-btn">
                    返回
                </button>
            </div>
        </div>
    `;
    
    // 添加到页面
    document.body.appendChild(feedbackBtn);
    document.body.appendChild(feedbackContainer);
}