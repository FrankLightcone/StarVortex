document.addEventListener('DOMContentLoaded', function() {
    // 获取DOM元素
    const courseSelect = document.getElementById('course');
    const assignmentSelect = document.getElementById('assignment_name');
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
    
    // 保存课程配置 (从服务器传递的JSON)
    const courseConfig = JSON.parse('{{ course_config | tojson | safe }}');
    
    // 文件列表数组
    let selectedFiles = [];

    // 课程选择事件
    if (courseSelect) {
        courseSelect.addEventListener('change', function() {
            const selectedCourse = this.value;
            
            // 清空作业名称下拉框
            assignmentSelect.innerHTML = '';
            
            if (selectedCourse) {
                // 启用作业名称下拉框
                assignmentSelect.disabled = false;
                
                // 获取选中课程的作业列表
                const course = courseConfig.courses.find(c => c.name === selectedCourse);
                
                if (course && course.assignments) {
                    // 添加默认选项
                    const defaultOption = document.createElement('option');
                    defaultOption.value = '';
                    defaultOption.textContent = '请选择作业';
                    assignmentSelect.appendChild(defaultOption);
                    
                    // 添加作业选项
                    course.assignments.forEach(assignment => {
                        const option = document.createElement('option');
                        option.value = assignment;
                        option.textContent = assignment;
                        assignmentSelect.appendChild(option);
                    });
                }
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
            dropZone.classList.add('dragover');
        }

        function unhighlight() {
            dropZone.classList.remove('dragover');
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

    // 监听作业名称变化
    if (assignmentSelect) {
        assignmentSelect.addEventListener('change', updateUploadButtonState);
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

    // 初始化
    updateFileListView();
});