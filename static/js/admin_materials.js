/**
 * admin_materials.js - 管理员课程资料管理模块
 * 
 * 处理管理员端的课程资料管理功能，包括上传、查看和删除资料。
 * 
 * @module admin_materials
 * 
 * 主要功能：
 * - 加载班级和课程下拉列表
 * - 查看指定课程的资料
 * - 上传课程资料
 * - 删除课程资料
 * - 课程资料预览
 */

document.addEventListener('DOMContentLoaded', function() {
    // 获取DOM元素
    const materialClassFilter = document.getElementById('materialClassFilter');
    const materialCourseFilter = document.getElementById('materialCourseFilter');
    const materialsList = document.getElementById('materialsList');
    const refreshMaterialsBtn = document.getElementById('refreshMaterialsBtn');
    const uploadMaterialBtn = document.getElementById('uploadMaterialBtn');
    const uploadMaterialModal = document.getElementById('uploadMaterialModal');
    const uploadMaterialClass = document.getElementById('uploadMaterialClass');
    const uploadMaterialCourse = document.getElementById('uploadMaterialCourse');
    const uploadMaterialForm = document.getElementById('uploadMaterialForm');
    const materialFileInput = document.getElementById('materialFileInput');
    const selectedFileName = document.getElementById('selectedFileName');
    
    // 初始化模态框
    initModals();
    
    // 加载班级列表
    loadClasses();
    
    // 绑定事件处理函数
    bindEventHandlers();
    
    /**
     * Shows a modal dialog
     * @param {string} modalId - ID of the modal to show
     */
    function showModal(modalId) {
        console.info(`Showing modal: ${modalId}`);
        const modal = document.getElementById(modalId);
        console.info(`Modal element:`, modal);
        if (!modal) return;
        
        // First make it visible but not flex
        modal.classList.remove('hidden');
        
        // Force a reflow to ensure the transition works properly
        void modal.offsetWidth;
        
        // Now add flex to trigger the animation
        modal.classList.add('flex');
        
        // Add body class to prevent scrolling
        document.body.classList.add('overflow-hidden');
    }

    /**
     * Hides a modal dialog
     * @param {string} modalId - ID of the modal to hide
     */
    function hideModal(modalId) {
        const modal = document.getElementById(modalId);
        if (!modal) return;
        
        // First remove flex to start the transition
        modal.classList.remove('flex');
        
        // After transition completes, hide it completely
        setTimeout(() => {
            modal.classList.add('hidden');
            document.body.classList.remove('overflow-hidden');
        }, 300);
    }

    // Initialize modals
    function initModals() {
        // Find all buttons with data-modal-hide attribute
        document.querySelectorAll('[data-modal-hide]').forEach(btn => {
            btn.addEventListener('click', () => {
                const modalId = btn.getAttribute('data-modal-hide');
                hideModal(modalId);
            });
        });
        
        // Make background clicks close the modal
        document.querySelectorAll('[id$="Modal"]').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    hideModal(modal.id);
                }
            });
        });
    }
    
    /**
     * 绑定事件处理函数
     */
    function bindEventHandlers() {
        // 班级筛选变化事件
        if (materialClassFilter) {
            materialClassFilter.addEventListener('change', function() {
                loadCoursesByClass(this.value);
                // 重置课程筛选
                materialCourseFilter.value = '';
                // 清空资料列表
                clearMaterialsList();
            });
        }
        
        // 课程筛选变化事件
        if (materialCourseFilter) {
            materialCourseFilter.addEventListener('change', function() {
                loadMaterials(materialClassFilter.value, this.value);
            });
        }
        
        // 刷新按钮点击事件
        if (refreshMaterialsBtn) {
            refreshMaterialsBtn.addEventListener('click', function() {
                loadMaterials(materialClassFilter.value, materialCourseFilter.value);
            });
        }
        
        // 上传按钮点击事件
        if (uploadMaterialBtn) {
            uploadMaterialBtn.addEventListener('click', function() {
                // 复制当前筛选值到模态框
                uploadMaterialClass.value = materialClassFilter.value;
                uploadMaterialCourse.value = materialCourseFilter.value;
                
                // 显示模态框
                console.info('Showing upload modal');
                console.info('Modal element:', uploadMaterialModal);
                showModal(uploadMaterialModal.id);
            });
        }
        
        // 文件选择事件
        if (materialFileInput) {
            materialFileInput.addEventListener('change', function() {
                if (this.files.length > 0) {
                    selectedFileName.textContent = this.files[0].name;
                    selectedFileName.classList.remove('hidden');
                } else {
                    selectedFileName.classList.add('hidden');
                }
            });
        }
        
        // 文件拖放事件
        const dropArea = uploadMaterialForm?.querySelector('.border-dashed');
        if (dropArea) {
            ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
                dropArea.addEventListener(eventName, preventDefaults, false);
            });
            
            function preventDefaults(e) {
                e.preventDefault();
                e.stopPropagation();
            }
            
            ['dragenter', 'dragover'].forEach(eventName => {
                dropArea.addEventListener(eventName, highlight, false);
            });
            
            ['dragleave', 'drop'].forEach(eventName => {
                dropArea.addEventListener(eventName, unhighlight, false);
            });
            
            function highlight() {
                dropArea.classList.add('border-blue-500');
                dropArea.classList.add('bg-blue-50');
            }
            
            function unhighlight() {
                dropArea.classList.remove('border-blue-500');
                dropArea.classList.remove('bg-blue-50');
            }
            
            // 处理文件拖放
            dropArea.addEventListener('drop', function(e) {
                const dt = e.dataTransfer;
                const files = dt.files;
                
                if (files.length > 0) {
                    materialFileInput.files = files;
                    selectedFileName.textContent = files[0].name;
                    selectedFileName.classList.remove('hidden');
                }
            });
        }
        
        // 表单提交事件
        if (uploadMaterialForm) {
            uploadMaterialForm.addEventListener('submit', function(e) {
                e.preventDefault();
                
                // 验证表单
                const classValue = uploadMaterialClass.value;
                const courseValue = uploadMaterialCourse.value;
                const fileInput = materialFileInput;
                
                if (!classValue || !courseValue) {
                    showToast('请选择班级和课程', 'error');
                    return;
                }
                
                if (!fileInput.files.length) {
                    showToast('请选择要上传的文件', 'error');
                    return;
                }
                
                // 创建FormData
                const formData = new FormData(this);
                
                // 禁用表单和按钮
                const submitBtn = uploadMaterialForm.querySelector('button[type="submit"]');
                submitBtn.disabled = true;
                submitBtn.innerHTML = `
                    <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    上传中...
                `;
                
                // 发送上传请求
                fetch('/admin/upload_course_material', {
                    method: 'POST',
                    body: formData
                })
                .then(response => response.json())
                .then(data => {
                    // 恢复按钮状态
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = '上传';
                    
                    if (data.status === 'success') {
                        showToast('文件上传成功', 'success');
                        hideModal(uploadMaterialModal);
                        
                        // 重置表单
                        uploadMaterialForm.reset();
                        selectedFileName.classList.add('hidden');
                        
                        // 刷新资料列表
                        loadMaterials(classValue, courseValue);
                    } else {
                        showToast(data.message || '上传失败', 'error');
                    }
                })
                .catch(error => {
                    console.error('上传文件出错:', error);
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = '上传';
                    showToast('上传出错，请稍后重试', 'error');
                });
            });
        }
    }
    
    /**
     * 加载班级列表
     */
    function loadClasses() {
        // 显示加载状态
        if (materialClassFilter) {
            materialClassFilter.innerHTML = '<option value="">加载中...</option>';
        }
        if (uploadMaterialClass) {
            uploadMaterialClass.innerHTML = '<option value="">加载中...</option>';
        }
        
        // 获取班级列表
        fetch('/admin/classes')
            .then(response => response.json())
            .then(data => {
                if (data.classes && data.classes.length > 0) {
                    // 班级筛选下拉框
                    if (materialClassFilter) {
                        materialClassFilter.innerHTML = '<option value="">选择班级</option>';
                        data.classes.forEach(classInfo => {
                            const option = document.createElement('option');
                            option.value = classInfo.name;
                            option.textContent = classInfo.name;
                            materialClassFilter.appendChild(option);
                        });
                    }
                    
                    // 上传模态框班级下拉框
                    if (uploadMaterialClass) {
                        uploadMaterialClass.innerHTML = '<option value="">选择班级</option>';
                        data.classes.forEach(classInfo => {
                            const option = document.createElement('option');
                            option.value = classInfo.name;
                            option.textContent = classInfo.name;
                            uploadMaterialClass.appendChild(option);
                        });
                    }
                } else {
                    // 没有班级
                    if (materialClassFilter) {
                        materialClassFilter.innerHTML = '<option value="">暂无班级</option>';
                    }
                    if (uploadMaterialClass) {
                        uploadMaterialClass.innerHTML = '<option value="">暂无班级</option>';
                    }
                }
            })
            .catch(error => {
                console.error('加载班级列表失败:', error);
                if (materialClassFilter) {
                    materialClassFilter.innerHTML = '<option value="">加载失败</option>';
                }
                if (uploadMaterialClass) {
                    uploadMaterialClass.innerHTML = '<option value="">加载失败</option>';
                }
            });
    }
    
    /**
     * 按班级加载课程
     * @param {string} className - 班级名称
     */
    function loadCoursesByClass(className) {
        // 显示加载状态
        if (materialCourseFilter) {
            materialCourseFilter.innerHTML = '<option value="">加载中...</option>';
        }
        
        // 如果没有选择班级，重置课程下拉框
        if (!className) {
            if (materialCourseFilter) {
                materialCourseFilter.innerHTML = '<option value="">请先选择班级</option>';
            }
            if (uploadMaterialCourse) {
                uploadMaterialCourse.innerHTML = '<option value="">请先选择班级</option>';
            }
            return;
        }
        
        // 获取课程列表
        fetch(`/admin/get_courses_by_class?class_name=${encodeURIComponent(className)}`)
            .then(response => response.json())
            .then(data => {
                if (data.courses && data.courses.length > 0) {
                    // 课程筛选下拉框
                    if (materialCourseFilter) {
                        materialCourseFilter.innerHTML = '<option value="">选择课程</option>';
                        data.courses.forEach(course => {
                            const option = document.createElement('option');
                            option.value = course;
                            option.textContent = course;
                            materialCourseFilter.appendChild(option);
                        });
                    }
                    
                    // 上传模态框课程下拉框
                    if (uploadMaterialCourse) {
                        uploadMaterialCourse.innerHTML = '<option value="">选择课程</option>';
                        data.courses.forEach(course => {
                            const option = document.createElement('option');
                            option.value = course;
                            option.textContent = course;
                            uploadMaterialCourse.appendChild(option);
                        });
                    }
                } else {
                    // 没有课程
                    if (materialCourseFilter) {
                        materialCourseFilter.innerHTML = '<option value="">暂无课程</option>';
                    }
                    if (uploadMaterialCourse) {
                        uploadMaterialCourse.innerHTML = '<option value="">暂无课程</option>';
                    }
                }
            })
            .catch(error => {
                console.error('加载课程列表失败:', error);
                if (materialCourseFilter) {
                    materialCourseFilter.innerHTML = '<option value="">加载失败</option>';
                }
                if (uploadMaterialCourse) {
                    uploadMaterialCourse.innerHTML = '<option value="">加载失败</option>';
                }
            });
    }
    
    /**
     * 加载资料列表
     * @param {string} className - 班级名称
     * @param {string} courseName - 课程名称
     */
    function loadMaterials(className, courseName) {
        // 清空资料列表
        clearMaterialsList();
        
        // 显示加载中状态
        if (materialsList) {
            materialsList.innerHTML = `
                <tr>
                    <td colspan="5" class="px-6 py-10 text-center">
                        <div class="flex flex-col items-center">
                            <svg class="animate-spin h-8 w-8 text-blue-500 mb-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <p class="text-gray-500">加载资料中...</p>
                        </div>
                    </td>
                </tr>
            `;
        }
        
        // 验证参数
        if (!className || !courseName) {
            if (materialsList) {
                materialsList.innerHTML = `
                    <tr>
                        <td colspan="5" class="px-6 py-10 text-center">
                            <p class="text-gray-500">请选择班级和课程</p>
                        </td>
                    </tr>
                `;
            }
            return;
        }
        
        // 构建API URL
        const url = `/get_course_assets_by_name_and_class?class_name=${encodeURIComponent(className)}&course=${encodeURIComponent(courseName)}`;
        
        // 获取资料列表
        fetch(url)
            .then(response => response.json())
            .then(data => {
                // 验证响应
                if (data.status !== 'success') {
                    throw new Error(data.message || '加载失败');
                }
                
                // 检查是否有资料
                if (!data.assets || data.assets.length === 0) {
                    if (materialsList) {
                        materialsList.innerHTML = `
                            <tr>
                                <td colspan="5" class="px-6 py-10 text-center">
                                    <div class="flex flex-col items-center">
                                        <svg class="w-12 h-12 text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                                        </svg>
                                        <p class="text-gray-500">暂无资料</p>
                                    </div>
                                </td>
                            </tr>
                        `;
                    }
                    return;
                }
                
                // 渲染资料列表
                renderMaterialsList(data.assets);
            })
            .catch(error => {
                console.error('加载资料列表失败:', error);
                if (materialsList) {
                    materialsList.innerHTML = `
                        <tr>
                            <td colspan="5" class="px-6 py-4 text-center text-red-500">
                                加载失败: ${error.message || '请稍后重试'}
                            </td>
                        </tr>
                    `;
                }
            });
    }
    
    /**
     * 清空资料列表
     */
    function clearMaterialsList() {
        if (materialsList) {
            materialsList.innerHTML = '';
        }
    }
    
    /**
     * 渲染资料列表
     * @param {Array} assets - 资料数组
     */
    function renderMaterialsList(assets) {
        if (!materialsList) return;
        
        // 清空列表
        clearMaterialsList();

        // Check if there are any assets
        if (assets.length === 0) {
            // Show empty state
            document.getElementById('emptyMaterialsState').classList.remove('hidden');
            materialsList.innerHTML = '';
            return;
        }

        // Hide empty state if it's visible
        document.getElementById('emptyMaterialsState').classList.add('hidden');
        
        // 渲染资料项
        assets.forEach(asset => {
            const row = document.createElement('tr');
            row.className = 'bg-white border-b dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600';
            
            // 获取文件类型和图标
            const fileType = getFileTypeInfo(asset.file_name);
            
            // 格式化文件大小
            const fileSize = formatFileSize(asset.file_size || 0);
            
            // 格式化上传日期
            const uploadDate = asset.upload_date ? 
                new Date(asset.upload_date).toLocaleDateString('zh-CN') : 
                '-';
            
            // 设置行内容
            row.innerHTML = `
                <td class="px-6 py-4 font-medium text-gray-900 whitespace-nowrap dark:text-white">
                    <div class="flex items-center">
                        <div class="flex-shrink-0 ${fileType.colorClass} w-8 h-8 rounded flex items-center justify-center mr-3">
                            <i class="${fileType.iconClass}"></i>
                        </div>
                        <div class="flex-1 truncate max-w-xs">
                            ${asset.file_name}
                        </div>
                    </div>
                </td>
                <td class="px-6 py-4">
                    ${fileType.label}
                </td>
                <td class="px-6 py-4">
                    ${fileSize}
                </td>
                <td class="px-6 py-4">
                    ${uploadDate}
                </td>
                <td class="px-6 py-4 text-right">
                    <div class="flex space-x-2 justify-end">
                        <button 
                            type="button" 
                            class="preview-btn font-medium text-blue-600 dark:text-blue-500 hover:underline"
                            data-file-path="${asset.file_path || ''}"
                            data-file-name="${asset.file_name || ''}"
                        >
                            预览
                        </button>
                        <a 
                            href="/download_asset?file_name=${encodeURIComponent(asset.file_name)}&course=${encodeURIComponent(asset.course_name)}&class_name=${encodeURIComponent(asset.class_name)}"
                            class="font-medium text-green-600 dark:text-green-500 hover:underline"
                            download="${asset.file_name}"
                        >
                            下载
                        </a>
                        <button 
                            type="button" 
                            class="delete-btn font-medium text-red-600 dark:text-red-500 hover:underline"
                            data-file-path="${asset.file_path || ''}"
                        >
                            删除
                        </button>
                    </div>
                </td>
            `;
            
            // 添加预览按钮事件
            const previewBtn = row.querySelector('.preview-btn');
            if (previewBtn) {
                previewBtn.addEventListener('click', function() {
                    const filePath = this.getAttribute('data-file-path');
                    const fileName = this.getAttribute('data-file-name');
                    
                    if (filePath) {
                        window.open(`/preview_asset?file_path=${encodeURIComponent(filePath)}&file_name=${encodeURIComponent(fileName)}`, '_blank');
                    }
                });
            }
            
            // 添加删除按钮事件
            const deleteBtn = row.querySelector('.delete-btn');
            if (deleteBtn) {
                deleteBtn.addEventListener('click', function() {
                    const filePath = this.getAttribute('data-file-path');
                    
                    if (filePath) {
                        confirmDeleteMaterial(filePath, asset.file_name, row);
                    }
                });
            }
            
            materialsList.appendChild(row);
        });
    }
    
    /**
     * Confirms deletion of a material
     * @param {string} filePath - Path to the file
     * @param {string} fileName - Name of the file
     * @param {HTMLElement} row - Table row element
     */
    function confirmDeleteMaterial(filePath, fileName, row) {
        // Populate the delete modal
        document.getElementById('deleteFileName').textContent = fileName;
        document.getElementById('deleteFilePath').value = filePath;
        
        // Store reference to the row
        window.currentDeleteRow = row;
        
        // Show the delete modal
        showModal('deleteMaterialModal');
    }

    // Add event listener to confirm delete button
    document.getElementById('confirmDeleteBtn').addEventListener('click', function() {
        const filePath = document.getElementById('deleteFilePath').value;
        
        if (filePath) {
            deleteMaterial(filePath, window.currentDeleteRow);
            hideModal('deleteMaterialModal');
        }
    });
    
    /**
     * 删除资料
     * @param {string} filePath - 文件路径
     * @param {HTMLElement} row - 表格行元素
     */
    function deleteMaterial(filePath, row) {
        // 构建API URL
        const url = `/admin/delete_course_material?file_path=${encodeURIComponent(filePath)}`;
        
        // 发送删除请求
        fetch(url, {
            method: 'DELETE'
        })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                // 删除成功，移除表格行
                if (row) {
                    row.remove();
                }
                
                showToast('文件已删除', 'success');
                
                // 检查是否还有资料
                if (materialsList && materialsList.children.length === 0) {
                    materialsList.innerHTML = `
                        <tr>
                            <td colspan="5" class="px-6 py-10 text-center">
                                <div class="flex flex-col items-center">
                                    <svg class="w-12 h-12 text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                                    </svg>
                                    <p class="text-gray-500">暂无资料</p>
                                </div>
                            </td>
                        </tr>
                    `;
                }
            } else {
                showToast(data.message || '删除失败', 'error');
            }
        })
        .catch(error => {
            console.error('删除资料失败:', error);
            showToast('删除失败，请稍后重试', 'error');
        });
    }
    
    /**
     * 获取文件类型信息
     * @param {string} fileName - 文件名
     * @returns {Object} - 文件类型信息对象
     */
    function getFileTypeInfo(fileName) {
        if (!fileName) return { iconClass: 'fas fa-file', label: '未知', colorClass: 'bg-gray-200 text-gray-600' };
        
        const extension = fileName.split('.').pop().toLowerCase();
        
        // 文件类型映射
        const fileTypes = {
            // 文档类型
            'pdf': { iconClass: 'fas fa-file-pdf', label: 'PDF文档', colorClass: 'bg-red-100 text-red-500' },
            'doc': { iconClass: 'fas fa-file-word', label: 'Word文档', colorClass: 'bg-blue-100 text-blue-500' },
            'docx': { iconClass: 'fas fa-file-word', label: 'Word文档', colorClass: 'bg-blue-100 text-blue-500' },
            'txt': { iconClass: 'fas fa-file-alt', label: '文本文件', colorClass: 'bg-gray-100 text-gray-500' },
            
            // 表格类型
            'xls': { iconClass: 'fas fa-file-excel', label: 'Excel表格', colorClass: 'bg-green-100 text-green-500' },
            'xlsx': { iconClass: 'fas fa-file-excel', label: 'Excel表格', colorClass: 'bg-green-100 text-green-500' },
            'csv': { iconClass: 'fas fa-file-csv', label: 'CSV表格', colorClass: 'bg-green-100 text-green-500' },
            
            // 演示文稿
            'ppt': { iconClass: 'fas fa-file-powerpoint', label: 'PPT演示', colorClass: 'bg-orange-100 text-orange-500' },
            'pptx': { iconClass: 'fas fa-file-powerpoint', label: 'PPT演示', colorClass: 'bg-orange-100 text-orange-500' },
            
            // 图片类型
            'jpg': { iconClass: 'fas fa-file-image', label: '图片', colorClass: 'bg-purple-100 text-purple-500' },
            'jpeg': { iconClass: 'fas fa-file-image', label: '图片', colorClass: 'bg-purple-100 text-purple-500' },
            'png': { iconClass: 'fas fa-file-image', label: '图片', colorClass: 'bg-purple-100 text-purple-500' },
            'gif': { iconClass: 'fas fa-file-image', label: '图片', colorClass: 'bg-purple-100 text-purple-500' },
            
            // 压缩文件
            'zip': { iconClass: 'fas fa-file-archive', label: '压缩文件', colorClass: 'bg-yellow-100 text-yellow-500' },
            'rar': { iconClass: 'fas fa-file-archive', label: '压缩文件', colorClass: 'bg-yellow-100 text-yellow-500' },
            '7z': { iconClass: 'fas fa-file-archive', label: '压缩文件', colorClass: 'bg-yellow-100 text-yellow-500' },
            
            // 代码文件
            'js': { iconClass: 'fas fa-file-code', label: '代码文件', colorClass: 'bg-indigo-100 text-indigo-500' },
            'html': { iconClass: 'fas fa-file-code', label: '代码文件', colorClass: 'bg-indigo-100 text-indigo-500' },
            'css': { iconClass: 'fas fa-file-code', label: '代码文件', colorClass: 'bg-indigo-100 text-indigo-500' },
            'py': { iconClass: 'fas fa-file-code', label: '代码文件', colorClass: 'bg-indigo-100 text-indigo-500' },
            'java': { iconClass: 'fas fa-file-code', label: '代码文件', colorClass: 'bg-indigo-100 text-indigo-500' },
            
            // 视频文件
            'mp4': { iconClass: 'fas fa-file-video', label: '视频文件', colorClass: 'bg-pink-100 text-pink-500' },
            'avi': { iconClass: 'fas fa-file-video', label: '视频文件', colorClass: 'bg-pink-100 text-pink-500' },
            'mov': { iconClass: 'fas fa-file-video', label: '视频文件', colorClass: 'bg-pink-100 text-pink-500' },
            
            // 音频文件
            'mp3': { iconClass: 'fas fa-file-audio', label: '音频文件', colorClass: 'bg-red-100 text-red-500' },
            'wav': { iconClass: 'fas fa-file-audio', label: '音频文件', colorClass: 'bg-red-100 text-red-500' },
        };
        
        return fileTypes[extension] || { 
            iconClass: 'fas fa-file', 
            label: `${extension.toUpperCase()}文件`, 
            colorClass: 'bg-gray-200 text-gray-600' 
        };
    }
    
    /**
     * 格式化文件大小
     * @param {number} bytes - 文件大小（字节）
     * @returns {string} - 格式化后的文件大小
     */
    function formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    
    /**
     * Shows a toast notification
     * @param {string} message - Message to display
     * @param {string} type - 'success' or 'error'
     */
    function showToast(message, type = 'error') {
        // Get the appropriate toast element
        const toastId = type === 'success' ? 'toast-success' : 'toast-error';
        const toast = document.getElementById(toastId);
        const contentEl = document.getElementById(`${toastId}-content`);
        
        if (!toast || !contentEl) return;
        
        // Set the message
        contentEl.textContent = message;
        
        // Show the toast
        toast.classList.remove('hidden');
        
        // Auto-hide after 3 seconds
        setTimeout(() => {
            toast.classList.add('hidden');
        }, 3000);
    }
    
    // 当切换到课程资料管理标签页时加载班级和课程
    document.addEventListener('tabChange', function(e) {
        if (e.detail.tabId === 'materialsManagementTab') {
            // 加载班级列表
            loadClasses();
            
            // 如果已选择班级和课程，则加载资料
            if (materialClassFilter && materialClassFilter.value && 
                materialCourseFilter && materialCourseFilter.value) {
                loadMaterials(materialClassFilter.value, materialCourseFilter.value);
            }
        }
    });
    
    // 监听上传模态框班级变化事件
    if (uploadMaterialClass) {
        uploadMaterialClass.addEventListener('change', function() {
            loadCoursesByClass(this.value);
        });
    }
});