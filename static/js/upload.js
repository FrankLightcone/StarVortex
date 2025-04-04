/**
 * upload.js - 文件上传模块
 * 
 * 提供作业文件的上传功能，包括文件选择、拖拽上传、进度展示，
 * 以及我的提交记录管理和个人设置页面的交互逻辑。
 * 
 * @module upload
 * @requires toast.js
 * @requires utils.js
 * 
 * 主要功能：
 * - 标签页切换（上传作业、我的提交、个人设置）
 * - 课程和作业选择与统计信息展示
 * - 文件选择与拖拽上传
 * - 上传进度实时显示
 * - 提交记录管理（查看、删除）
 * - 个人资料修改
 * 
 * 文件操作相关函数：
 * @function preventDefaults - 阻止拖拽事件的默认行为
 * @function highlight - 拖拽区域高亮显示
 * @function unhighlight - 取消拖拽区域高亮
 * @function handleDrop - 处理文件拖放事件
 * @function handleFiles - 处理选择的文件
 * @function addFileToList - 将文件添加到上传列表
 * @function updateFileListView - 更新文件列表视图
 * @function removeFile - 从列表中删除文件
 * @function updateUploadButtonState - 更新上传按钮状态
 * 
 * 上传相关函数：
 * @function uploadFiles - 开始上传文件队列
 * @function uploadFile - 上传单个文件
 * @function handleUploadError - 处理上传错误
 * @function refreshAssignmentStats - 刷新作业统计信息
 * 
 * 提交记录相关函数：
 * @function loadMySubmissions - 加载我的提交记录
 * @function renderMySubmissions - 渲染提交记录列表
 * @function viewSubmissionDetail - 查看提交详情
 * @function deleteSubmission - 删除提交记录
 * 
 * 事件监听器：
 * - DOMContentLoaded：初始化界面和组件
 * - 多个标签页和表单元素的事件监听处理
 * 
 * XHR请求：
 * - 文件上传进度监控和显示
 * 
 * Fetch请求：
 * - GET /get_assignments：获取课程的作业列表
 * - GET /get_assignment_stats：获取作业统计信息
 * - GET /get_my_submissions：获取我的提交记录
 * - DELETE /delete_submission：删除提交记录
 * - POST /update_profile：更新个人资料
 */

document.addEventListener('DOMContentLoaded', function() {
    // ===== DOM 元素 =====
    // 标签页
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');
    
    // 上传表单元素
    const courseSelect = document.getElementById('course');
    const assignmentSelect = document.getElementById('assignment_name');
    const assignmentInfo = document.getElementById('assignmentInfo');
    const assignmentDueDate = document.getElementById('assignmentDueDate');
    const assignmentSubmissionCount = document.getElementById('assignmentSubmissionCount');
    const assignmentStatus = document.getElementById('assignmentStatus');
    const mySubmissionStatus = document.getElementById('mySubmissionStatus');
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const dropText = document.getElementById('dropText');
    const fileList = document.getElementById('fileList');
    const uploadBtn = document.getElementById('uploadBtn');
    const progressContainer = document.getElementById('progressContainer');
    const fileName = document.getElementById('fileName');
    const uploadSpeed = document.getElementById('uploadSpeed');
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');
    
    // 我的提交标签页元素
    const mySubmissionCourseFilter = document.getElementById('mySubmissionCourseFilter');
    const mySubmissionsList = document.getElementById('mySubmissionsList');
    
    // 提交详情弹窗
    const mySubmissionDetailModal = document.getElementById('mySubmissionDetailModal');
    const mySubmissionDetailTitle = document.getElementById('mySubmissionDetailTitle');
    const detailCourse = document.getElementById('detailCourse');
    const detailAssignmentName = document.getElementById('detailAssignmentName');
    const detailSubmissionTime = document.getElementById('detailSubmissionTime');
    const detailAssignmentDueDate = document.getElementById('detailAssignmentDueDate');
    const myFilesList = document.getElementById('myFilesList');
    const closeMySubmissionDetailBtn = document.getElementById('closeMySubmissionDetailBtn');
    const downloadSubmissionBtn = document.getElementById('downloadSubmissionBtn');
    const replaceSubmissionBtn = document.getElementById('replaceSubmissionBtn');
    
    // 个人设置表单
    const profileForm = document.getElementById('profileForm');
    const profileName = document.getElementById('profile_name');
    const profileCurrentPassword = document.getElementById('profile_current_password');
    const profileNewPassword = document.getElementById('profile_new_password');
    const profileConfirmPassword = document.getElementById('profile_confirm_password');
    
    // 文件列表数组
    let selectedFiles = [];
    
    // 当前查看的提交详情
    let currentSubmissionDetail = null;
    
    // ===== 标签页切换逻辑 =====
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            // 使用直接映射而不是字符串替换，以确保准确匹配
            const tabMapping = {
                'tabUpload': 'uploadTab',
                'tabSubmissions': 'submissionsTab',
                'tabProfile': 'profileTab'
            };
            
            const tabContentId = tabMapping[button.id];
            
            // 安全检查
            if (!tabContentId) {
                console.error(`找不到与按钮ID "${button.id}" 对应的标签页内容元素`);
                return;
            }
            
            // 更新按钮样式
            tabButtons.forEach(btn => {
                btn.classList.remove('text-blue-600', 'border-blue-500');
                btn.classList.add('text-gray-500', 'border-transparent');
            });
            
            button.classList.remove('text-gray-500', 'border-transparent');
            button.classList.add('text-blue-600', 'border-blue-500');
            
            // 切换标签页内容
            tabContents.forEach(content => {
                content.classList.remove('active');
            });
            
            const targetTab = document.getElementById(tabContentId);
            if (targetTab) {
                targetTab.classList.add('active');
                
                // 如果切换到"我的提交"标签页，加载提交记录
                if (tabContentId === 'submissionsTab') {
                    loadMySubmissions();
                }
            } else {
                console.error(`找不到ID为 "${tabContentId}" 的标签页内容元素`);
            }
        });
    });
    
    // ===== 作业上传相关逻辑 =====
    
    // 课程选择事件
    if (courseSelect) {
        courseSelect.addEventListener('change', function() {
            const selectedCourse = this.value;
            
            // 清空作业名称下拉框
            assignmentSelect.innerHTML = '';
            
            // 隐藏作业信息
            assignmentInfo.classList.add('hidden');
            
            if (selectedCourse) {
                // 启用作业名称下拉框
                assignmentSelect.disabled = false;
                
                // 从服务器获取选中课程的作业列表
                fetch(`/get_assignments?course=${encodeURIComponent(selectedCourse)}`)
                    .then(response => response.json())
                    .then(data => {
                        // 添加默认选项
                        const defaultOption = document.createElement('option');
                        defaultOption.value = '';
                        defaultOption.textContent = '请选择作业';
                        assignmentSelect.appendChild(defaultOption);
                        
                        // 添加作业选项
                        if (data.assignments && data.assignments.length > 0) {
                            data.assignments.forEach(assignment => {
                                const option = document.createElement('option');
                                option.value = assignment;
                                option.textContent = assignment;
                                assignmentSelect.appendChild(option);
                            });
                        } else {
                            const option = document.createElement('option');
                            option.value = '';
                            option.textContent = '该课程暂无作业';
                            assignmentSelect.appendChild(option);
                        }
                        
                        // 更新上传按钮状态
                        updateUploadButtonState();
                    })
                    .catch(error => {
                        console.error('获取作业列表失败:', error);
                        // 添加错误提示选项
                        const option = document.createElement('option');
                        option.value = '';
                        option.textContent = '加载作业失败';
                        assignmentSelect.appendChild(option);
                    });
            } else {
                // 禁用作业名称下拉框
                assignmentSelect.disabled = true;
                
                // 添加默认提示
                const option = document.createElement('option');
                option.value = '';
                option.textContent = '请先选择课程';
                assignmentSelect.appendChild(option);
            }
            
            // 更新上传按钮状态
            updateUploadButtonState();
        });
    }
    
    // 作业选择事件 - 加载作业统计信息
    if (assignmentSelect) {
        assignmentSelect.addEventListener('change', function() {
            const selectedCourse = courseSelect.value;
            const selectedAssignment = this.value;
            
            // 隐藏作业信息
            assignmentInfo.classList.add('hidden');
            
            if (selectedCourse && selectedAssignment) {
                // 获取作业统计信息
                fetch(`/get_assignment_stats?course=${encodeURIComponent(selectedCourse)}&assignment=${encodeURIComponent(selectedAssignment)}`)
                    .then(response => response.json())
                    .then(data => {
                        if (data.stats) {
                            // 更新统计信息
                            assignmentDueDate.textContent = data.stats.dueDate;
                            assignmentSubmissionCount.textContent = data.stats.submissionCount;
                            assignmentStatus.textContent = data.stats.status;
                            mySubmissionStatus.textContent = data.stats.mySubmission;
                            
                            // 根据状态修改颜色
                            if (data.stats.status === "已截止") {
                                assignmentStatus.classList.add('text-red-600');
                                assignmentStatus.classList.remove('text-green-600');
                            } else {
                                assignmentStatus.classList.add('text-green-600');
                                assignmentStatus.classList.remove('text-red-600');
                            }
                            
                            // 根据提交状态修改颜色
                            if (data.stats.hasSubmitted) {
                                mySubmissionStatus.classList.add('text-green-600');
                                mySubmissionStatus.classList.remove('text-red-600');
                            } else {
                                mySubmissionStatus.classList.add('text-red-600');
                                mySubmissionStatus.classList.remove('text-green-600');
                            }
                            
                            // 显示作业信息
                            assignmentInfo.classList.remove('hidden');
                        }
                    })
                    .catch(error => {
                        console.error('获取作业统计信息失败:', error);
                        showToast('获取作业统计信息失败', 'error');
                    });
            }
            
            // 更新上传按钮状态
            updateUploadButtonState();
        });
    }

    // 拖拽事件处理
    if (dropZone) {
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, preventDefaults, false);
        });

        function preventDefaults(e) {
            e.preventDefault();
            e.stopPropagation();
        }

        ['dragenter', 'dragover'].forEach(eventName => {
            dropZone.addEventListener(eventName, highlight, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, unhighlight, false);
        });

        function highlight() {
            dropZone.classList.add('border-blue-500');
            dropZone.classList.add('bg-blue-50');
        }

        function unhighlight() {
            dropZone.classList.remove('border-blue-500');
            dropZone.classList.remove('bg-blue-50');
        }

        // 点击和拖拽文件选择
        dropZone.addEventListener('click', () => fileInput.click(), false);
        dropZone.addEventListener('drop', handleDrop, false);
    }

    // 文件输入处理
    if (fileInput) {
        fileInput.addEventListener('change', handleFiles, false);
    }

    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        handleFiles({ target: { files } });
    }

    function handleFiles(e) {
        const files = e.target.files;
        
        if (files.length === 0) return;
        
        // 添加文件到列表
        for (let i = 0; i < files.length; i++) {
            addFileToList(files[i]);
        }
        
        // 重置文件输入框，以便可以再次选择相同的文件
        fileInput.value = '';
        
        // 更新上传按钮状态
        updateUploadButtonState();
    }

    // 添加文件到列表
    function addFileToList(file) {
        // 检查文件类型
        const fileExtension = file.name.split('.').pop().toLowerCase();
        const allowedExtensions = ['txt', 'pdf', 'png', 'jpg', 'jpeg', 'gif', 'doc', 'docx', 'xls', 'xlsx', 'zip', 'rar', 'mp3', 'mp4', 'csv', 'ppt', 'pptx'];
        
        if (!allowedExtensions.includes(fileExtension)) {
            showToast(`不支持的文件类型: ${file.name}`, 'error');
            return;
        }
        
        // 生成唯一ID
        const fileId = Date.now().toString(36) + Math.random().toString(36).substr(2);
        
        // 添加到内部数组
        selectedFiles.push({
            id: fileId,
            file: file
        });
        
        // 创建文件项元素
        const fileItem = document.createElement('div');
        fileItem.className = 'file-item flex items-center justify-between p-3';
        fileItem.dataset.id = fileId;
        
        // 文件信息
        const fileInfo = document.createElement('div');
        fileInfo.className = 'flex-1';
        
        // 文件名
        const fileNameElem = document.createElement('div');
        fileNameElem.className = 'text-sm font-medium text-gray-700';
        fileNameElem.textContent = file.name;
        
        // 文件大小
        const fileSizeElem = document.createElement('div');
        fileSizeElem.className = 'text-xs text-gray-500';
        fileSizeElem.textContent = formatFileSize(file.size);
        
        fileInfo.appendChild(fileNameElem);
        fileInfo.appendChild(fileSizeElem);
        
        // 删除按钮
        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-file ml-2 text-red-500 hover:text-red-700 focus:outline-none';
        removeBtn.innerHTML = '<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path></svg>';
        removeBtn.addEventListener('click', () => removeFile(fileId));
        
        fileItem.appendChild(fileInfo);
        fileItem.appendChild(removeBtn);
        
        // 添加到DOM
        fileList.appendChild(fileItem);
        
        // 更新文件列表视图
        updateFileListView();
    }

    // 更新文件列表视图
    function updateFileListView() {
        if (selectedFiles.length > 0) {
            fileList.classList.remove('hidden');
            dropText.textContent = '点击或拖拽添加更多文件';
        } else {
            fileList.classList.add('hidden');
            dropText.textContent = '点击或拖拽文件到此处选择上传文件';
        }
    }

    // 删除文件
    function removeFile(fileId) {
        // 从数组中删除
        selectedFiles = selectedFiles.filter(file => file.id !== fileId);
        
        // 从DOM中删除
        const fileItem = document.querySelector(`.file-item[data-id="${fileId}"]`);
        if (fileItem) {
            fileItem.remove();
        }
        
        // 更新文件列表视图
        updateFileListView();
        
        // 更新上传按钮状态
        updateUploadButtonState();
    }

    // 更新上传按钮状态
    function updateUploadButtonState() {
        if (uploadBtn) {
            const course = courseSelect.value;
            const assignment = assignmentSelect.value;
            
            uploadBtn.disabled = !course || !assignment || selectedFiles.length === 0;
        }
    }

    // 上传按钮点击事件
    if (uploadBtn) {
        uploadBtn.addEventListener('click', uploadFiles);
    }

    function uploadFiles() {
        if (selectedFiles.length === 0) {
            showToast('请选择文件', 'error');
            return;
        }
        
        const course = courseSelect.value;
        const assignmentName = assignmentSelect.value;
        
        if (!course || !assignmentName) {
            showToast('请选择课程和作业名称', 'error');
            return;
        }
        
        // 禁用上传按钮
        uploadBtn.disabled = true;
        uploadBtn.textContent = '上传中...';
        
        // 开始上传第一个文件
        uploadFile(0);
    }

    function uploadFile(index) {
        if (index >= selectedFiles.length) {
            // 所有文件上传完成
            uploadBtn.textContent = '上传完成';
            setTimeout(() => {
                uploadBtn.textContent = '开始上传';
                uploadBtn.disabled = false;
                // 清空文件列表
                selectedFiles = [];
                fileList.innerHTML = '';
                updateFileListView();
                progressContainer.style.display = 'none';
                
                // 刷新作业统计信息
                refreshAssignmentStats();
            }, 2000);
            return;
        }
        
        const fileObj = selectedFiles[index];
        const file = fileObj.file;
        const formData = new FormData();
        
        formData.append('file', file);
        formData.append('course', courseSelect.value);
        formData.append('assignment_name', assignmentSelect.value);
        
        // 显示进度条
        progressContainer.style.display = 'block';
        fileName.textContent = file.name;
        progressBar.style.width = '0%';
        progressText.textContent = '准备上传...';
        uploadSpeed.textContent = '0 KB/s';
        
        // 重置进度条样式
        progressText.classList.remove('text-red-600', 'text-green-600');
        progressText.classList.add('text-gray-600');
        progressBar.classList.remove('bg-red-600', 'bg-green-600');
        progressBar.classList.add('bg-blue-600');
        
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/', true);
        
        // 进度追踪
        let startTime = Date.now();
        xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
                const percentComplete = (e.loaded / e.total) * 100;
                progressBar.style.width = `${percentComplete}%`;
                progressText.textContent = `上传中: ${percentComplete.toFixed(0)}%`;
                
                // 计算上传速度
                const elapsedTime = (Date.now() - startTime) / 1000; // 秒
                if (elapsedTime > 0) {
                    const speedInKBps = (e.loaded / elapsedTime / 1024).toFixed(2);
                    uploadSpeed.textContent = `${speedInKBps} KB/s`;
                }
            }
        };
        
        xhr.onload = () => {
            try {
                const response = JSON.parse(xhr.responseText);
                if (xhr.status === 200 && response.status === 'success') {
                    // 从列表中移除已上传的文件
                    const fileItem = document.querySelector(`.file-item[data-id="${fileObj.id}"]`);
                    if (fileItem) {
                        fileItem.classList.add('bg-green-50');
                        setTimeout(() => {
                            fileItem.remove();
                        }, 500);
                    }
                    
                    // 显示成功信息
                    progressText.textContent = `${file.name} 上传成功`;
                    progressText.classList.remove('text-gray-600');
                    progressText.classList.add('text-green-600');
                    progressBar.classList.remove('bg-blue-600');
                    progressBar.classList.add('bg-green-600');
                    
                    showToast(`${file.name} 上传成功`, 'success');
                    
                    // 上传下一个文件
                    setTimeout(() => {
                        uploadFile(index + 1);
                    }, 500);
                } else {
                    handleUploadError(response.message || '上传失败');
                }
            } catch (e) {
                handleUploadError('服务器响应异常');
            }
        };
        
        xhr.onerror = () => {
            handleUploadError('网络错误，上传失败');
        };
        
        xhr.send(formData);
    }
    
    function handleUploadError(message) {
        progressText.textContent = message;
        progressText.classList.remove('text-gray-600');
        progressText.classList.add('text-red-600');
        progressBar.classList.remove('bg-blue-600');
        progressBar.classList.add('bg-red-600');
        
        showToast(message, 'error');
        
        // 重新启用上传按钮
        uploadBtn.disabled = false;
        uploadBtn.textContent = '重试上传';
    }
    
    // 刷新作业统计信息
    function refreshAssignmentStats() {
        const course = courseSelect.value;
        const assignment = assignmentSelect.value;
        
        if (course && assignment) {
            fetch(`/get_assignment_stats?course=${encodeURIComponent(course)}&assignment=${encodeURIComponent(assignment)}`)
                .then(response => response.json())
                .then(data => {
                    if (data.stats) {
                        // 更新统计信息
                        assignmentDueDate.textContent = data.stats.dueDate;
                        assignmentSubmissionCount.textContent = data.stats.submissionCount;
                        assignmentStatus.textContent = data.stats.status;
                        mySubmissionStatus.textContent = data.stats.mySubmission;
                        
                        // 根据提交状态修改颜色
                        if (data.stats.hasSubmitted) {
                            mySubmissionStatus.classList.add('text-green-600');
                            mySubmissionStatus.classList.remove('text-red-600');
                        } else {
                            mySubmissionStatus.classList.add('text-red-600');
                            mySubmissionStatus.classList.remove('text-green-600');
                        }
                    }
                })
                .catch(error => {
                    console.error('刷新作业统计信息失败:', error);
                });
        }
    }
    
    // ===== 我的提交相关逻辑 =====
    
    // 加载我的提交记录
    function loadMySubmissions() {
        const courseFilter = mySubmissionCourseFilter.value;
        let url = '/get_my_submissions';
        
        if (courseFilter) {
            url += `?course=${encodeURIComponent(courseFilter)}`;
        }
        
        // 显示加载中
        mySubmissionsList.innerHTML = `
            <tr>
                <td colspan="6" class="px-6 py-4 text-center text-sm text-gray-500">
                    <svg class="animate-spin h-5 w-5 mx-auto text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span class="mt-2 block">加载中...</span>
                </td>
            </tr>
        `;
        
        fetch(url)
            .then(response => response.json())
            .then(data => {
                // 处理数据
                renderMySubmissions(data.submissions || []);
            })
            .catch(error => {
                console.error('获取提交记录失败:', error);
                mySubmissionsList.innerHTML = `
                    <tr>
                        <td colspan="6" class="px-6 py-4 text-center text-sm text-red-500">
                            获取提交记录失败
                        </td>
                    </tr>
                `;
            });
    }
    
    // 渲染我的提交记录
    function renderMySubmissions(submissions) {
        // 清空列表
        mySubmissionsList.innerHTML = '';
        
        // 检查是否有提交
        if (submissions.length === 0) {
            mySubmissionsList.innerHTML = `
                <tr>
                    <td colspan="6" class="px-6 py-4 text-center text-sm text-gray-500">
                        暂无提交记录
                    </td>
                </tr>
            `;
            return;
        }
        
        // 添加提交到列表
        submissions.forEach(submission => {
            const row = document.createElement('tr');
            row.className = 'my-submission-item';
            
            // 格式化提交时间
            const submissionTime = new Date(submission.submissionTime);
            const formattedSubmissionTime = submissionTime.toLocaleString('zh-CN');
            
            // 状态样式
            let statusClass = 'bg-green-100 text-green-800';
            if (submission.status === '逾期提交') {
                statusClass = 'bg-orange-100 text-orange-800';
            }
            
            row.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    ${submission.course}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    ${submission.assignmentName}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    ${formattedSubmissionTime}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm">
                    <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusClass}">
                        ${submission.status}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    ${submission.fileCount}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button 
                        class="text-blue-600 hover:text-blue-900 mr-3 view-submission"
                        data-course="${submission.course}"
                        data-assignment="${submission.assignmentName}"
                    >
                        查看详情
                    </button>
                    <button 
                        class="text-red-600 hover:text-red-900 delete-submission"
                        data-course="${submission.course}"
                        data-assignment="${submission.assignmentName}"
                    >
                        删除
                    </button>
                </td>
            `;
            
            mySubmissionsList.appendChild(row);
            
            // 添加事件监听器
            const viewBtn = row.querySelector('.view-submission');
            viewBtn.addEventListener('click', () => {
                viewSubmissionDetail(submission);
            });
            
            const deleteBtn = row.querySelector('.delete-submission');
            deleteBtn.addEventListener('click', () => {
                deleteSubmission(submission.course, submission.assignmentName);
            });
        });
    }
    
    // 查看提交详情
    function viewSubmissionDetail(submission) {
        // 保存当前查看的提交信息
        currentSubmissionDetail = submission;
        
        // 更新详情弹窗内容
        mySubmissionDetailTitle.textContent = `${submission.course} - ${submission.assignmentName} 提交详情`;
        detailCourse.textContent = submission.course;
        detailAssignmentName.textContent = submission.assignmentName;
        
        // 格式化并显示提交时间
        const submissionTime = new Date(submission.submissionTime);
        detailSubmissionTime.textContent = submissionTime.toLocaleString('zh-CN');
        
        // 显示截止日期
        if (submission.dueDate) {
            const dueDate = new Date(submission.dueDate);
            detailAssignmentDueDate.textContent = dueDate.toLocaleString('zh-CN');
            // 如果提交时间晚于截止日期，则标记为逾期提交
            if (submissionTime > dueDate) {
                detailSubmissionTime.innerHTML += ' <span class="text-orange-600 text-xs">(逾期提交)</span>';
            }
        } else {
            detailAssignmentDueDate.textContent = '未知';
        }
        
        // 渲染文件列表
        myFilesList.innerHTML = '';
        if (submission.files && submission.files.length > 0) {
            submission.files.forEach(file => {
                const row = document.createElement('tr');
                const uploadTime = new Date(file.uploadTime);
                row.innerHTML = `
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        ${file.name}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        ${file.size}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        ${uploadTime.toLocaleString('zh-CN')}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <a 
                            href="${file.path}" 
                            class="text-blue-600 hover:text-blue-900 download-file" 
                            download
                        >
                            下载
                        </a>
                    </td>
                `;
                myFilesList.appendChild(row);
            });
        } else {
            myFilesList.innerHTML = `
                <tr>
                    <td colspan="4" class="px-6 py-4 text-center text-sm text-gray-500">
                        无文件记录
                    </td>
                </tr>
            `;
        }
        
        // 显示提交详情弹窗
        mySubmissionDetailModal.classList.remove('hidden');
    }
    
    // 关闭提交详情弹窗
    if (closeMySubmissionDetailBtn) {
        closeMySubmissionDetailBtn.addEventListener('click', () => {
            mySubmissionDetailModal.classList.add('hidden');
        });
    }
    
    // 下载提交记录事件
    if (downloadSubmissionBtn) {
        downloadSubmissionBtn.addEventListener('click', () => {
            if (currentSubmissionDetail) {
                window.location.href = `/download_submission?course=${encodeURIComponent(currentSubmissionDetail.course)}&assignment=${encodeURIComponent(currentSubmissionDetail.assignmentName)}`;
            }
        });
    }
    
    // 替换提交记录事件（此处仅做提示，替换逻辑可根据需要扩展）
    if (replaceSubmissionBtn) {
        replaceSubmissionBtn.addEventListener('click', () => {
            showToast('暂未实现替换提交功能', 'error');
        });
    }
    
    // 删除提交记录函数
    function deleteSubmission(course, assignment) {
        if (!confirm(`确定要删除 ${course} - ${assignment} 的提交记录吗？`)) {
            return;
        }
        fetch(`/delete_submission?course=${encodeURIComponent(course)}&assignment=${encodeURIComponent(assignment)}`, {
            method: 'DELETE'
        })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                showToast('提交记录删除成功', 'success');
                loadMySubmissions();
            } else {
                showToast(data.message || '删除失败', 'error');
            }
        })
        .catch(error => {
            console.error('删除提交记录失败:', error);
            showToast('删除提交记录失败', 'error');
        });
    }
    
    // 监听“我的提交”课程筛选器变化，刷新提交列表
    if (mySubmissionCourseFilter) {
        mySubmissionCourseFilter.addEventListener('change', loadMySubmissions);
    }
    
    // 个人设置表单提交事件
    if (profileForm) {
        profileForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const name = profileName.value;
            const currentPassword = profileCurrentPassword.value;
            const newPassword = profileNewPassword.value;
            const confirmPassword = profileConfirmPassword.value;
            
            if (newPassword !== confirmPassword) {
                showToast('新密码与确认密码不一致', 'error');
                return;
            }
            
            fetch('/update_profile', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: name,
                    currentPassword: currentPassword,
                    newPassword: newPassword
                })
            })
            .then(response => response.json())
            .then(data => {
                if (data.status === 'success') {
                    showToast('个人设置更新成功', 'success');
                } else {
                    showToast(data.message || '更新失败', 'error');
                }
            })
            .catch(error => {
                console.error('更新个人设置失败:', error);
                showToast('更新个人设置失败', 'error');
            });
        });
    }
    
});

document.addEventListener('DOMContentLoaded', function() {
    // 初始化自定义下拉菜单
    initCustomDropdowns();
    
    // 处理课程选择变化
    const courseDropdown = document.getElementById('courseDropdown');
    const courseInput = document.getElementById('course');
    const assignmentDropdown = document.getElementById('assignmentDropdown');
    const assignmentInput = document.getElementById('assignment_name');
    
    // 监听课程选择变化
    courseDropdown.addEventListener('valueChanged', function(e) {
      const selectedCourse = e.detail.value;
      courseInput.value = selectedCourse;
      
      // 重置作业下拉菜单
      resetAssignmentDropdown();
      
      if (selectedCourse) {
        // 启用作业下拉菜单
        enableDropdown(assignmentDropdown);
        
        // 从服务器获取课程对应的作业列表
        fetch(`/get_assignments?course=${encodeURIComponent(selectedCourse)}`)
          .then(response => response.json())
          .then(data => {
            if (data.assignments && data.assignments.length > 0) {
              // 更新作业下拉选项
              updateDropdownOptions(assignmentDropdown, [
                { value: '', text: '请选择作业' },
                ...data.assignments.map(assignment => ({ value: assignment, text: assignment }))
              ]);
            } else {
              updateDropdownOptions(assignmentDropdown, [
                { value: '', text: '该课程暂无作业' }
              ]);
            }
          })
          .catch(error => {
            console.error('获取作业列表失败:', error);
            updateDropdownOptions(assignmentDropdown, [
              { value: '', text: '加载作业失败' }
            ]);
          });
      } else {
        // 禁用作业下拉菜单
        disableDropdown(assignmentDropdown);
        updateDropdownOptions(assignmentDropdown, [
          { value: '', text: '请先选择课程' }
        ]);
      }
      
      // 更新作业信息
      updateAssignmentInfo('', '');
    });
    
    // 监听作业选择变化
    assignmentDropdown.addEventListener('valueChanged', function(e) {
      const selectedAssignment = e.detail.value;
      assignmentInput.value = selectedAssignment;
      
      // 更新作业信息
      updateAssignmentInfo(courseInput.value, selectedAssignment);
    });
    
    // 函数：初始化所有自定义下拉菜单
    function initCustomDropdowns() {
      // 获取所有自定义下拉菜单
      const dropdowns = document.querySelectorAll('.custom-dropdown');
      
      dropdowns.forEach(dropdown => {
        const selected = dropdown.querySelector('.dropdown-selected');
        const options = dropdown.querySelector('.dropdown-options');
        const hiddenInput = dropdown.querySelector('input[type="hidden"]');
        const optionItems = dropdown.querySelectorAll('.dropdown-option');
        const dropdownText = selected.querySelector('.dropdown-text');
        const dropdownArrow = selected.querySelector('.dropdown-arrow');
        
        // 点击选择框显示/隐藏选项
        selected.addEventListener('click', function() {
          if (selected.classList.contains('disabled')) return;
          
          toggleDropdown(dropdown);
          
          // 如果打开了选项，滚动到选中项
          if (options.classList.contains('show')) {
            const selectedOption = dropdown.querySelector('.dropdown-option.selected');
            if (selectedOption) {
              selectedOption.scrollIntoView({ block: 'nearest' });
            }
          }
        });
        
        // 聚焦时添加样式
        selected.addEventListener('focus', function() {
          if (!selected.classList.contains('disabled')) {
            selected.classList.add('focused');
          }
        });
        
        // 失焦时移除样式并关闭下拉菜单
        selected.addEventListener('blur', function(e) {
          // 如果点击的是当前下拉菜单的选项，不关闭
          if (e.relatedTarget && options.contains(e.relatedTarget)) {
            return;
          }
          
          selected.classList.remove('focused');
          options.classList.remove('show');
          dropdownArrow.classList.remove('open');
        });
        
        // 处理键盘操作
        selected.addEventListener('keydown', function(e) {
          if (selected.classList.contains('disabled')) return;
          
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggleDropdown(dropdown);
          } else if (e.key === 'Escape') {
            options.classList.remove('show');
            dropdownArrow.classList.remove('open');
          } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (!options.classList.contains('show')) {
              toggleDropdown(dropdown);
            }
            const firstOption = dropdown.querySelector('.dropdown-option:not(.disabled)');
            if (firstOption) {
              firstOption.focus();
            }
          }
        });
        
        // 为每个选项添加点击事件
        optionItems.forEach(option => {
          // 为选项设置tabindex使其可以获取焦点
          option.setAttribute('tabindex', '0');
          
          option.addEventListener('click', function() {
            if (option.classList.contains('disabled')) return;
            
            const value = option.getAttribute('data-value');
            const text = option.textContent;
            
            // 更新隐藏输入的值
            hiddenInput.value = value;
            
            // 更新显示文本
            dropdownText.textContent = text;
            
            // 移除所有选中状态并给当前选项添加选中状态
            optionItems.forEach(item => item.classList.remove('selected'));
            option.classList.add('selected');
            
            // 关闭下拉菜单
            options.classList.remove('show');
            dropdownArrow.classList.remove('open');
            
            // 触发自定义事件
            const event = new CustomEvent('valueChanged', {
              detail: { value: value, text: text }
            });
            dropdown.dispatchEvent(event);
          });
          
          // 键盘导航
          option.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              option.click();
              selected.focus();
            } else if (e.key === 'Escape') {
              options.classList.remove('show');
              dropdownArrow.classList.remove('open');
              selected.focus();
            } else if (e.key === 'ArrowDown') {
              e.preventDefault();
              const nextOption = option.nextElementSibling;
              if (nextOption) {
                nextOption.focus();
              }
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              const prevOption = option.previousElementSibling;
              if (prevOption) {
                prevOption.focus();
              } else {
                selected.focus();
              }
            }
          });
        });
        
        // 点击外部关闭下拉菜单
        document.addEventListener('click', function(e) {
          if (!dropdown.contains(e.target)) {
            options.classList.remove('show');
            dropdownArrow.classList.remove('open');
          }
        });
      });
    }
    
    // 切换下拉菜单的显示状态
    function toggleDropdown(dropdown) {
      const options = dropdown.querySelector('.dropdown-options');
      const dropdownArrow = dropdown.querySelector('.dropdown-arrow');
      
      options.classList.toggle('show');
      dropdownArrow.classList.toggle('open');
    }
    
    // 重置作业下拉菜单
    function resetAssignmentDropdown() {
      const dropdownText = assignmentDropdown.querySelector('.dropdown-text');
      const options = assignmentDropdown.querySelector('.dropdown-options');
      
      // 清空选择
      dropdownText.textContent = '请先选择课程';
      assignmentInput.value = '';
      
      // 清空选项
      while (options.firstChild) {
        options.removeChild(options.firstChild);
      }
      
      // 添加默认选项
      const defaultOption = document.createElement('div');
      defaultOption.className = 'dropdown-option';
      defaultOption.setAttribute('data-value', '');
      defaultOption.textContent = '请先选择课程';
      options.appendChild(defaultOption);
    }
    
    // 更新下拉菜单选项
    function updateDropdownOptions(dropdown, optionsData) {
      const optionsContainer = dropdown.querySelector('.dropdown-options');
      
      // 清空现有选项
      while (optionsContainer.firstChild) {
        optionsContainer.removeChild(optionsContainer.firstChild);
      }
      
      // 添加新选项
      optionsData.forEach(optionData => {
        const option = document.createElement('div');
        option.className = 'dropdown-option';
        option.setAttribute('data-value', optionData.value);
        option.textContent = optionData.text;
        option.setAttribute('tabindex', '0');
        
        // 添加点击事件
        option.addEventListener('click', function() {
          if (option.classList.contains('disabled')) return;
          
          const value = option.getAttribute('data-value');
          const text = option.textContent;
          
          // 更新隐藏输入的值
          dropdown.querySelector('input[type="hidden"]').value = value;
          
          // 更新显示文本
          dropdown.querySelector('.dropdown-text').textContent = text;
          
          // 移除所有选中状态并给当前选项添加选中状态
          dropdown.querySelectorAll('.dropdown-option').forEach(item => item.classList.remove('selected'));
          option.classList.add('selected');
          
          // 关闭下拉菜单
          dropdown.querySelector('.dropdown-options').classList.remove('show');
          dropdown.querySelector('.dropdown-arrow').classList.remove('open');
          
          // 触发自定义事件
          const event = new CustomEvent('valueChanged', {
            detail: { value: value, text: text }
          });
          dropdown.dispatchEvent(event);
        });
        
        // 键盘导航
        option.addEventListener('keydown', function(e) {
          const selected = dropdown.querySelector('.dropdown-selected');
          
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            option.click();
            selected.focus();
          } else if (e.key === 'Escape') {
            dropdown.querySelector('.dropdown-options').classList.remove('show');
            dropdown.querySelector('.dropdown-arrow').classList.remove('open');
            selected.focus();
          } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            const nextOption = option.nextElementSibling;
            if (nextOption) {
              nextOption.focus();
            }
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            const prevOption = option.previousElementSibling;
            if (prevOption) {
              prevOption.focus();
            } else {
              selected.focus();
            }
          }
        });
        
        optionsContainer.appendChild(option);
      });
    }
    
    // 启用下拉菜单
    function enableDropdown(dropdown) {
      const selected = dropdown.querySelector('.dropdown-selected');
      selected.classList.remove('disabled');
    }
    
    // 禁用下拉菜单
    function disableDropdown(dropdown) {
      const selected = dropdown.querySelector('.dropdown-selected');
      selected.classList.add('disabled');
    }
    
    // 更新作业信息显示
    function updateAssignmentInfo(course, assignment) {
      const assignmentInfo = document.getElementById('assignmentInfo');
      
      if (!course || !assignment) {
        assignmentInfo.classList.add('hidden');
        return;
      }
      
      // 获取作业信息
      fetch(`/get_assignment_stats?course=${encodeURIComponent(course)}&assignment=${encodeURIComponent(assignment)}`)
        .then(response => response.json())
        .then(data => {
          if (data.stats) {
            // 更新信息
            document.getElementById('assignmentDueDate').textContent = data.stats.dueDate;
            document.getElementById('assignmentSubmissionCount').textContent = data.stats.submissionCount;
            document.getElementById('assignmentStatus').textContent = data.stats.status;
            document.getElementById('mySubmissionStatus').textContent = data.stats.mySubmission;
            
            // 状态颜色
            const statusElement = document.getElementById('assignmentStatus');
            const myStatusElement = document.getElementById('mySubmissionStatus');
            
            if (data.stats.status === "已截止") {
              statusElement.classList.add('text-red-600');
              statusElement.classList.remove('text-green-600');
            } else {
              statusElement.classList.add('text-green-600');
              statusElement.classList.remove('text-red-600');
            }
            
            if (data.stats.hasSubmitted) {
              myStatusElement.classList.add('text-green-600');
              myStatusElement.classList.remove('text-red-600');
            } else {
              myStatusElement.classList.add('text-red-600');
              myStatusElement.classList.remove('text-green-600');
            }
            
            // 显示信息区域
            assignmentInfo.classList.remove('hidden');
          }
        })
        .catch(error => {
          console.error('获取作业信息失败:', error);
          assignmentInfo.classList.add('hidden');
        });
    }
    
    // 更新上传按钮状态
    function updateUploadButtonState() {
      const course = document.getElementById('course').value;
      const assignment = document.getElementById('assignment_name').value;
      const uploadBtn = document.getElementById('uploadBtn');
      const filesExist = document.querySelectorAll('.file-item').length > 0;
      
      if (uploadBtn) {
        uploadBtn.disabled = !course || !assignment || !filesExist;
      }
    }
    
    // 监听文件列表变化以更新上传按钮状态
    const fileListObserver = new MutationObserver(updateUploadButtonState);
    const fileList = document.getElementById('fileList');
    if (fileList) {
      fileListObserver.observe(fileList, { childList: true });
    }
  });