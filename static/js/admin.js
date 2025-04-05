window.addEventListener('DOMContentLoaded', function() {
    // DOM 元素
    const toast = document.getElementById('toast');
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');
    const assignmentModal = document.getElementById('assignmentModal');
    const submissionDetailModal = document.getElementById('submissionDetailModal');
    
    // 标签页切换和高级设置变量
    let currentSettingsTab = 'basic';
    const basicSettingsTab = document.getElementById('basicSettingsTab');
    const advancedSettingsTab = document.getElementById('advancedSettingsTab');
    const basicSettingsPanel = document.getElementById('basicSettingsPanel');
    const advancedSettingsPanel = document.getElementById('advancedSettingsPanel');
    const customFileTypesToggle = document.getElementById('customFileTypesToggle');
    const customFileTypesContainer = document.getElementById('customFileTypesContainer');
    
    // 课程和作业筛选下拉框
    const courseFilter = document.getElementById('courseFilter');
    const submissionCourseFilter = document.getElementById('submissionCourseFilter');
    const submissionAssignmentFilter = document.getElementById('submissionAssignmentFilter');
    
    // 显示信息的元素
    const assignmentsList = document.getElementById('assignmentsList');
    const submissionsList = document.getElementById('submissionsList');
    const submissionStats = document.getElementById('submissionStats');
    const filesList = document.getElementById('filesList');
    
    // 按钮
    const addAssignmentBtn = document.getElementById('addAssignmentBtn');
    const downloadAllBtn = document.getElementById('downloadAllBtn');
    const exportSubmissionsBtn = document.getElementById('exportSubmissionsBtn');
    
    // 弹窗表单元素
    const assignmentForm = document.getElementById('assignmentForm');
    const modalTitle = document.getElementById('modalTitle');
    const assignmentId = document.getElementById('assignmentId');
    const courseName = document.getElementById('courseName');
    const assignmentName = document.getElementById('assignmentName');
    const dueDate = document.getElementById('dueDate');
    const assignmentDescription = document.getElementById('assignmentDescription');
    
    // 弹窗关闭按钮
    const closeModalBtn = document.getElementById('closeModalBtn');
    const cancelBtn = document.getElementById('cancelBtn');
    const closeSubmissionDetailBtn = document.getElementById('closeSubmissionDetailBtn');
    
    // 课程配置
    let assignments = [];

    // 处理作业表单中的基本设置和高级设置标签切换
    if (basicSettingsTab && advancedSettingsTab) {
        // 基本设置标签页点击事件
        basicSettingsTab.addEventListener('click', function() {
            currentSettingsTab = 'basic';
            
            // 更新标签页状态
            basicSettingsTab.classList.remove('text-gray-500', 'hover:text-gray-700', 'hover:border-gray-300', 'border-transparent');
            basicSettingsTab.classList.add('text-blue-600', 'border-blue-500');
            
            advancedSettingsTab.classList.remove('text-blue-600', 'border-blue-500');
            advancedSettingsTab.classList.add('text-gray-500', 'hover:text-gray-700', 'hover:border-gray-300', 'border-transparent');
            
            // 显示/隐藏面板
            basicSettingsPanel.classList.remove('hidden');
            basicSettingsPanel.classList.add('active');
            
            advancedSettingsPanel.classList.remove('active');
            advancedSettingsPanel.classList.add('hidden');
        });
        
        // 高级设置标签页点击事件
        advancedSettingsTab.addEventListener('click', function() {
            currentSettingsTab = 'advanced';
            
            // 更新标签页状态
            advancedSettingsTab.classList.remove('text-gray-500', 'hover:text-gray-700', 'hover:border-gray-300', 'border-transparent');
            advancedSettingsTab.classList.add('text-blue-600', 'border-blue-500');
            
            basicSettingsTab.classList.remove('text-blue-600', 'border-blue-500');
            basicSettingsTab.classList.add('text-gray-500', 'hover:text-gray-700', 'hover:border-gray-300', 'border-transparent');
            
            // 显示/隐藏面板
            advancedSettingsPanel.classList.remove('hidden');
            advancedSettingsPanel.classList.add('active');
            
            basicSettingsPanel.classList.remove('active');
            basicSettingsPanel.classList.add('hidden');
        });
    }
    
    // 处理自定义文件类型切换
    if (customFileTypesToggle && customFileTypesContainer) {
        customFileTypesToggle.addEventListener('change', function() {
            if (this.checked) {
                customFileTypesContainer.classList.remove('hidden');
            } else {
                customFileTypesContainer.classList.add('hidden');
            }
        });
    }
    
    // 初始加载
    loadAssignments();
    
    // 设置默认截止日期为今天后一周
    if (dueDate) {
        const now = new Date();
        now.setDate(now.getDate() + 7);
        dueDate.value = formatDateTimeLocal(now);
    }
    
    // 添加导出提交统计按钮事件
    if (exportSubmissionsBtn) {
        exportSubmissionsBtn.addEventListener('click', exportSubmissionStats);
    }
    
    // Toast notification function
    function showToast(message, type = 'error') {
        if (!toast) return;
        
        // Set the message
        toast.textContent = message;
        
        // Set the color based on message type
        if (type === 'success') {
            toast.classList.remove('bg-red-500');
            toast.classList.add('bg-green-500');
        } else if (type === 'error') {
            toast.classList.remove('bg-green-500');
            toast.classList.add('bg-red-500');
        }
        
        // Show the toast
        toast.classList.add('show');
        
        // Hide the toast after 3 seconds
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }
    
    // 标签页切换
    if (tabButtons) {
        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                // 使用直接映射而不是字符串替换，以确保准确匹配
                const tabMapping = {
                    'tabAssignments': 'assignmentsTab',
                    'tabSubmissions': 'submissionsTab'
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
                } else {
                    console.error(`找不到ID为 "${tabContentId}" 的标签页内容元素`);
                }
            });
        });
    }
    
    // 加载作业列表
    function loadAssignments() {
        // 在实际应用中，这里应该从服务器加载数据
        // 模拟从服务器获取数据
        fetch('/admin/assignments')
            .then(response => response.json())
            .then(data => {
                assignments = data.assignments;
                renderAssignmentsList();
            })
            .catch(error => {
                console.error('Error loading assignments:', error);
                // 模拟数据以供演示
                assignments = [
                    {
                        id: '1',
                        course: 'GNSS',
                        name: '实验1',
                        dueDate: '2025-04-10T23:59',
                        status: 'active',
                        submissionCount: 12
                    },
                    {
                        id: '2',
                        course: 'GNSS',
                        name: '实验2',
                        dueDate: '2025-04-20T23:59',
                        status: 'active',
                        submissionCount: 8
                    },
                    {
                        id: '3',
                        course: 'DIP',
                        name: '实验1',
                        dueDate: '2025-04-05T23:59',
                        status: 'expired',
                        submissionCount: 15
                    },
                    {
                        id: '4',
                        course: 'DIP',
                        name: '实验2',
                        dueDate: '2025-04-15T23:59',
                        status: 'active',
                        submissionCount: 5
                    }
                ];
                renderAssignmentsList();
            });
    }
    
    // 渲染作业列表
    function renderAssignmentsList() {
        if (!assignmentsList) return;
        
        // 筛选作业
        const courseNameValue = courseFilter ? courseFilter.value : '';
        const filteredAssignments = courseNameValue ? 
            assignments.filter(a => a.course === courseNameValue) : 
            assignments;
        
        // 清空列表
        assignmentsList.innerHTML = '';
        
        // 检查是否有作业
        if (filteredAssignments.length === 0) {
            const emptyRow = document.createElement('tr');
            emptyRow.innerHTML = `
                <td colspan="6" class="px-6 py-4 text-center text-sm text-gray-500">
                    暂无作业数据
                </td>
            `;
            assignmentsList.appendChild(emptyRow);
            return;
        }
        
        // 添加作业到列表
        filteredAssignments.forEach(assignment => {
            const row = document.createElement('tr');
            row.className = 'assignment-item';
            
            const dueDateTime = new Date(assignment.dueDate);
            const now = new Date();
            const isExpired = dueDateTime < now;
            
            // 格式化截止日期显示
            const formattedDueDate = dueDateTime.toLocaleString('zh-CN', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });
            
            row.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    ${assignment.course}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    ${assignment.name}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    ${formattedDueDate}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm">
                    ${isExpired ? 
                        '<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">已截止</span>' :
                        '<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">进行中</span>'
                    }
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    ${assignment.submissionCount}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button 
                        class="text-blue-600 hover:text-blue-900 mr-3 edit-assignment" 
                        data-id="${assignment.id}"
                    >
                        编辑
                    </button>
                    <button 
                        class="text-red-600 hover:text-red-900 delete-assignment" 
                        data-id="${assignment.id}"
                    >
                        删除
                    </button>
                </td>
            `;
            
            // 添加事件监听器
            assignmentsList.appendChild(row);
            
            // 编辑按钮
            row.querySelector('.edit-assignment').addEventListener('click', () => {
                openEditAssignmentModal(assignment);
            });
            
            // 删除按钮
            row.querySelector('.delete-assignment').addEventListener('click', () => {
                deleteAssignment(assignment.id);
            });
        });
    }
    
    // 打开添加作业弹窗
    function openAddAssignmentModal() {
        if (!modalTitle || !assignmentId || !assignmentForm) return;
        
        modalTitle.textContent = '添加作业';
        assignmentId.value = '';
        assignmentForm.reset();
        
        // 默认截止日期为一周后
        const nextWeek = new Date();
        nextWeek.setDate(nextWeek.getDate() + 7);
        if (dueDate) {
            dueDate.value = formatDateTimeLocal(nextWeek);
        }
        
        // 重置标签页状态
        if (basicSettingsTab) {
            basicSettingsTab.click();
        }
        
        // 重置高级设置
        resetAdvancedSettings();
        
        if (assignmentModal) {
            assignmentModal.classList.remove('hidden');
        }
    }
    
    // 打开编辑作业弹窗
    function openEditAssignmentModal(assignment) {
        if (!modalTitle || !assignmentId || !courseName || !assignmentName || !dueDate || !assignmentDescription) return;
        
        modalTitle.textContent = '编辑作业';
        assignmentId.value = assignment.id;
        courseName.value = assignment.course;
        assignmentName.value = assignment.name;
        dueDate.value = assignment.dueDate;
        assignmentDescription.value = assignment.description || '';
        
        // 重置标签页状态
        if (basicSettingsTab) {
            basicSettingsTab.click();
        }
        
        // 加载高级设置
        if (assignment.advancedSettings) {
            loadAdvancedSettings(assignment.advancedSettings);
        } else {
            // 使用默认设置
            resetAdvancedSettings();
        }
        
        if (assignmentModal) {
            assignmentModal.classList.remove('hidden');
        }
    }
    
    // 时间格式化为datetime-local输入框所需的格式
    function formatDateTimeLocal(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        
        return `${year}-${month}-${day}T${hours}:${minutes}`;
    }
    
    // 关闭作业弹窗
    function closeAssignmentModal() {
        if (assignmentModal) {
            assignmentModal.classList.add('hidden');
        }
    }
    
    // 删除作业
    function deleteAssignment(id) {
        if (!confirm('确定要删除该作业吗？已提交的作业也将被删除。')) {
            return;
        }
        
        // 在实际应用中，应该发送请求到服务器删除作业
        // 模拟删除
        fetch(`/admin/assignments/${id}`, {
            method: 'DELETE'
        })
            .then(response => response.json())
            .then(data => {
                if (data.status === 'success') {
                    // 从列表中移除
                    assignments = assignments.filter(a => a.id !== id);
                    renderAssignmentsList();
                    showToast('作业已删除', 'success');
                } else {
                    showToast(data.message || '删除失败', 'error');
                }
            })
            .catch(error => {
                console.error('Error deleting assignment:', error);
                
                // 模拟成功响应
                assignments = assignments.filter(a => a.id !== id);
                renderAssignmentsList();
                showToast('作业已删除', 'success');
            });
    }
    
    // 提交作业表单
    function submitAssignmentForm() {
        if (!assignmentId || !courseName || !assignmentName || !dueDate) return;
        
        const id = assignmentId.value;
        const course = courseName.value;
        const name = assignmentName.value;
        const deadline = dueDate.value;
        const description = assignmentDescription ? assignmentDescription.value : '';
        
        if (!course || !name || !deadline) {
            showToast('请填写所有必填字段', 'error');
            return;
        }
        
        // 收集高级设置数据
        const advancedSettings = collectAdvancedSettings();
        
        const formData = {
            id: id || null,
            course,
            name,
            dueDate: deadline,
            description,
            advancedSettings
        };
        
        // 在实际应用中，应该发送请求到服务器保存作业
        const method = id ? 'PUT' : 'POST';
        const url = id ? `/admin/assignments/${id}` : '/admin/assignments';
        
        fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        })
            .then(response => response.json())
            .then(data => {
                if (data.status === 'success') {
                    closeAssignmentModal();
                    loadAssignments();
                    showToast(id ? '作业已更新' : '作业已添加', 'success');
                } else {
                    showToast(data.message || '保存失败', 'error');
                }
            })
            .catch(error => {
                console.error('Error saving assignment:', error);
                
                // 模拟成功响应
                const newAssignment = {
                    ...formData,
                    id: id || String(Date.now()),
                    status: 'active',
                    submissionCount: id ? assignments.find(a => a.id === id).submissionCount : 0
                };
                
                if (id) {
                    // 更新现有作业
                    assignments = assignments.map(a => 
                        a.id === id ? newAssignment : a
                    );
                } else {
                    // 添加新作业
                    assignments.push(newAssignment);
                }
                
                closeAssignmentModal();
                renderAssignmentsList();
                showToast(id ? '作业已更新' : '作业已添加', 'success');
            });
    }
    
    // 新增功能: 收集高级设置数据
    function collectAdvancedSettings() {
        const maxFileCount = document.getElementById('maxFileCount') ? document.getElementById('maxFileCount').value : 10;
        const maxFileSize = document.getElementById('maxFileSize') ? document.getElementById('maxFileSize').value : 256;
        const fileSizeUnit = document.getElementById('fileSizeUnit') ? document.getElementById('fileSizeUnit').value : 'MB';
        const dailyQuota = document.getElementById('dailyQuota') ? document.getElementById('dailyQuota').value : 1;
        const enableGrading = document.getElementById('enableGrading') ? document.getElementById('enableGrading').checked : false;
        const enableFeedback = document.getElementById('enableFeedback') ? document.getElementById('enableFeedback').checked : false;
        
        // 收集允许的文件类型
        let allowedTypes = [];
        const allowedTypesCheckboxes = document.querySelectorAll('input[name="allowedTypes"]:checked');
        if (allowedTypesCheckboxes && allowedTypesCheckboxes.length > 0) {
            allowedTypes = Array.from(allowedTypesCheckboxes)
                .map(cb => cb.value)
                .join(',')
                .split(',');
        }
        
        // 添加自定义文件类型
        if (document.getElementById('customFileTypesToggle') && document.getElementById('customFileTypesToggle').checked) {
            const customTypes = document.getElementById('customFileTypes') ? document.getElementById('customFileTypes').value : '';
            if (customTypes) {
                const customTypesList = customTypes.split(',').map(type => type.trim());
                allowedTypes = [...allowedTypes, ...customTypesList];
            }
        }
        
        // 去重
        allowedTypes = [...new Set(allowedTypes)];
        
        return {
            maxFileCount: parseInt(maxFileCount) || 10,
            maxFileSize: parseInt(maxFileSize) || 256,
            fileSizeUnit: fileSizeUnit || 'MB',
            dailyQuota: parseInt(dailyQuota) || 1,
            allowedTypes: allowedTypes,
            enableGrading: enableGrading,
            enableFeedback: enableFeedback
        };
    }
    
    // 加载高级设置
    function loadAdvancedSettings(settings) {
        if (!settings) return;
        
        // 设置文件数量
        if (settings.maxFileCount && document.getElementById('maxFileCount')) {
            document.getElementById('maxFileCount').value = settings.maxFileCount;
        }
        
        // 设置文件大小
        if (settings.maxFileSize && document.getElementById('maxFileSize')) {
            document.getElementById('maxFileSize').value = settings.maxFileSize;
            if (settings.fileSizeUnit && document.getElementById('fileSizeUnit')) {
                document.getElementById('fileSizeUnit').value = settings.fileSizeUnit;
            }
        }
        
        // 设置每日限额
        if (settings.dailyQuota && document.getElementById('dailyQuota')) {
            document.getElementById('dailyQuota').value = settings.dailyQuota;
        }
        
        // 设置文件类型
        if (settings.allowedTypes && settings.allowedTypes.length > 0) {
            const typeGroups = {
                'pdf': ['pdf'],
                'doc,docx': ['doc', 'docx'],
                'xls,xlsx': ['xls', 'xlsx'],
                'ppt,pptx': ['ppt', 'pptx'],
                'jpg,jpeg,png,gif': ['jpg', 'jpeg', 'png', 'gif'],
                'zip,rar': ['zip', 'rar'],
                'txt,csv': ['txt', 'csv']
            };
            
            // 先取消所有选中
            document.querySelectorAll('input[name="allowedTypes"]').forEach(cb => {
                cb.checked = false;
            });
            
            // 创建已知类型集合
            const knownTypes = new Set();
            for (const group in typeGroups) {
                typeGroups[group].forEach(type => knownTypes.add(type));
            }
            
            // 设置标准类型选中状态
            const allowedTypesSet = new Set(settings.allowedTypes);
            for (const groupValue in typeGroups) {
                const groupTypes = typeGroups[groupValue];
                // 如果组中的所有类型都被允许，则选中该组
                if (groupTypes.every(type => allowedTypesSet.has(type))) {
                    const checkbox = document.querySelector(`input[name="allowedTypes"][value="${groupValue}"]`);
                    if (checkbox) checkbox.checked = true;
                    
                    // 从集合中移除已处理的类型
                    groupTypes.forEach(type => allowedTypesSet.delete(type));
                }
            }
            
            // 处理自定义类型
            const customTypes = Array.from(allowedTypesSet).filter(type => !knownTypes.has(type));
            if (customTypes.length > 0 && document.getElementById('customFileTypesToggle') && document.getElementById('customFileTypes') && document.getElementById('customFileTypesContainer')) {
                const customToggle = document.getElementById('customFileTypesToggle');
                const customInput = document.getElementById('customFileTypes');
                const customContainer = document.getElementById('customFileTypesContainer');
                
                customToggle.checked = true;
                customContainer.classList.remove('hidden');
                customInput.value = customTypes.join(',');
            }
        }
        
        // 设置评分选项
        if (settings.enableGrading !== undefined && document.getElementById('enableGrading')) {
            document.getElementById('enableGrading').checked = settings.enableGrading;
        }
        if (settings.enableFeedback !== undefined && document.getElementById('enableFeedback')) {
            document.getElementById('enableFeedback').checked = settings.enableFeedback;
        }
    }
    
    // 重置高级设置为默认值
    function resetAdvancedSettings() {
        // 文件数量
        if (document.getElementById('maxFileCount')) {
            document.getElementById('maxFileCount').value = 10;
        }
        
        // 文件大小
        if (document.getElementById('maxFileSize')) {
            document.getElementById('maxFileSize').value = 256;
        }
        if (document.getElementById('fileSizeUnit')) {
            document.getElementById('fileSizeUnit').value = 'MB';
        }
        
        // 每日限额
        if (document.getElementById('dailyQuota')) {
            document.getElementById('dailyQuota').value = 1;
        }
        
        // 文件类型 - 全选
        document.querySelectorAll('input[name="allowedTypes"]').forEach(cb => {
            cb.checked = true;
        });
        
        // 禁用自定义类型
        if (document.getElementById('customFileTypesToggle')) {
            document.getElementById('customFileTypesToggle').checked = false;
        }
        if (document.getElementById('customFileTypesContainer')) {
            document.getElementById('customFileTypesContainer').classList.add('hidden');
        }
        if (document.getElementById('customFileTypes')) {
            document.getElementById('customFileTypes').value = '';
        }
        
        // 禁用评分
        if (document.getElementById('enableGrading')) {
            document.getElementById('enableGrading').checked = false;
        }
        if (document.getElementById('enableFeedback')) {
            document.getElementById('enableFeedback').checked = false;
        }
    }
    
    // 加载提交情况
    function loadSubmissions(course, assignment) {
        if (!submissionsList || !downloadAllBtn || !submissionStats) return;
        
        if (!course || !assignment) {
            submissionsList.innerHTML = `
                <tr>
                    <td colspan="5" class="px-6 py-4 text-center text-sm text-gray-500">
                        请选择课程和作业名称查看提交情况
                    </td>
                </tr>
            `;
            downloadAllBtn.disabled = true;
            if (exportSubmissionsBtn) {
                exportSubmissionsBtn.disabled = true;
            }
            submissionStats.textContent = '请选择课程和作业名称查看提交情况';
            return;
        }
        
        // 修改为加载中状态
        submissionsList.innerHTML = `
            <tr>
                <td colspan="5" class="px-6 py-4 text-center text-sm text-gray-500">
                    <div class="flex flex-col items-center">
                        <svg class="animate-spin h-5 w-5 text-blue-500 mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        加载中...
                    </div>
                </td>
            </tr>
        `;
        
        fetch(`/admin/submissions?course=${encodeURIComponent(course)}&assignment=${encodeURIComponent(assignment)}`)
            .then(response => response.json())
            .then(data => {
                renderSubmissionsList(data.submissions || []);
                
                // 更新统计信息
                if (data.stats) {
                    submissionStats.textContent = `总共 ${data.stats.totalStudents} 名学生，已提交 ${data.stats.submittedCount} 人，提交率 ${data.stats.submissionRate}，截止日期: ${data.stats.dueDateStr}`;
                    downloadAllBtn.disabled = (data.submissions || []).length === 0;
                    if (exportSubmissionsBtn) {
                        exportSubmissionsBtn.disabled = (data.submissions || []).length === 0;
                    }
                }
            })
            .catch(error => {
                console.error('获取提交记录失败:', error);
                
                submissionsList.innerHTML = `
                    <tr>
                        <td colspan="5" class="px-6 py-4 text-center text-sm text-red-500">
                            加载失败: ${error.message}
                        </td>
                    </tr>
                `;
                
                downloadAllBtn.disabled = true;
                if (exportSubmissionsBtn) {
                    exportSubmissionsBtn.disabled = true;
                }
            });
    }
    
    // 渲染提交列表
    function renderSubmissionsList(submissions) {
        if (!submissionsList) return;
        
        // 清空列表
        submissionsList.innerHTML = '';
        
        // 检查是否有提交
        if (!submissions || submissions.length === 0) {
            const emptyRow = document.createElement('tr');
            emptyRow.innerHTML = `
                <td colspan="5" class="px-6 py-4 text-center text-sm text-gray-500">
                    暂无提交记录
                </td>
            `;
            submissionsList.appendChild(emptyRow);
            return;
        }
        
        // 添加提交到列表
        submissions.forEach(submission => {
            const row = document.createElement('tr');
            row.className = 'student-submission';
            
            // 格式化提交时间显示
            const submissionDateTime = new Date(submission.submissionTime);
            const formattedSubmissionTime = submissionDateTime.toLocaleString('zh-CN', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });
            
            row.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    ${submission.studentId}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    ${submission.studentName}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    ${formattedSubmissionTime}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    ${submission.fileCount}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button 
                        class="text-blue-600 hover:text-blue-900 mr-3 view-submission" 
                        data-student-id="${submission.studentId}"
                    >
                        查看详情
                    </button>
                    <a 
                        href="/admin/download?course=${encodeURIComponent(submissionCourseFilter.value)}&assignment=${encodeURIComponent(submissionAssignmentFilter.value)}&student=${encodeURIComponent(submission.studentId)}" 
                        class="text-green-600 hover:text-green-900"
                    >
                        下载
                    </a>
                </td>
            `;
            
            submissionsList.appendChild(row);
            
            // 查看详情按钮
            const viewBtn = row.querySelector('.view-submission');
            if (viewBtn) {
                viewBtn.addEventListener('click', () => {
                    openSubmissionDetailModal(submission);
                });
            }
        });
    }
    
    // 打开提交详情弹窗
    function openSubmissionDetailModal(submission) {
        if (!submissionDetailModal || !document.getElementById('submissionDetailTitle') || 
            !document.getElementById('detailStudentId') || !document.getElementById('detailStudentName') || 
            !document.getElementById('detailSubmissionTime') || !document.getElementById('detailDueDate') || 
            !filesList) {
            return;
        }
        
        document.getElementById('submissionDetailTitle').textContent = `${submissionCourseFilter.value} - ${submissionAssignmentFilter.value} - 提交详情`;
        document.getElementById('detailStudentId').textContent = submission.studentId;
        document.getElementById('detailStudentName').textContent = submission.studentName;
        
        // 格式化提交时间
        const submissionDateTime = new Date(submission.submissionTime);
        document.getElementById('detailSubmissionTime').textContent = submissionDateTime.toLocaleString('zh-CN');
        
        // 获取当前选中的作业信息
        const assignmentObj = assignments.find(a => 
            a.course === submissionCourseFilter.value && 
            a.name === submissionAssignmentFilter.value
        );
        
        if (assignmentObj) {
            const dueDateTime = new Date(assignmentObj.dueDate);
            document.getElementById('detailDueDate').textContent = dueDateTime.toLocaleString('zh-CN');
            
            // 检查是否逾期提交
            if (submissionDateTime > dueDateTime) {
                document.getElementById('detailSubmissionTime').innerHTML += ' <span class="text-red-600 text-xs">(逾期提交)</span>';
            }
        }
        
        // 渲染文件列表
        filesList.innerHTML = '';
        
        if (submission.files && submission.files.length > 0) {
            submission.files.forEach(file => {
                const row = document.createElement('tr');
                
                // 格式化上传时间
                const uploadDateTime = new Date(file.uploadTime);
                const formattedUploadTime = uploadDateTime.toLocaleString('zh-CN');
                
                row.innerHTML = `
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        ${file.name}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        ${file.size}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        ${formattedUploadTime}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <a 
                            href="${file.path}" 
                            class="text-blue-600 hover:text-blue-900" 
                            target="_blank"
                        >
                            预览
                        </a>
                        <a 
                            href="${file.path}" 
                            download
                            class="text-green-600 hover:text-green-900 ml-3"
                        >
                            下载
                        </a>
                    </td>
                `;
                
                filesList.appendChild(row);
            });
        } else {
            const emptyRow = document.createElement('tr');
            emptyRow.innerHTML = `
                <td colspan="4" class="px-6 py-4 text-center text-sm text-gray-500">
                    没有文件记录
                </td>
            `;
            filesList.appendChild(emptyRow);
        }
        
        // 设置下载按钮URL
        const downloadBtn = document.getElementById('downloadSubmissionBtn');
        if (downloadBtn) {
            downloadBtn.onclick = () => {
                window.location.href = `/admin/download?course=${encodeURIComponent(submissionCourseFilter.value)}&assignment=${encodeURIComponent(submissionAssignmentFilter.value)}&student=${encodeURIComponent(submission.studentId)}`;
            };
        }
        
        // 显示提交详情弹窗
        submissionDetailModal.classList.remove('hidden');
    }
    
    // 关闭提交详情弹窗
    function closeSubmissionDetailModal() {
        if (submissionDetailModal) {
            submissionDetailModal.classList.add('hidden');
        }
    }
    
    // 导出提交统计
    function exportSubmissionStats() {
        const course = submissionCourseFilter ? submissionCourseFilter.value : '';
        const assignment = submissionAssignmentFilter ? submissionAssignmentFilter.value : '';
        
        if (!course || !assignment) {
            showToast('请先选择课程和作业', 'error');
            return;
        }
        
        // 修改按钮状态为加载中
        if (exportSubmissionsBtn) {
            exportSubmissionsBtn.disabled = true;
            const originalText = exportSubmissionsBtn.innerHTML;
            exportSubmissionsBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1.5"></i>导出中...';
            
            // 构建导出URL
            const exportUrl = `/admin/export-stats?course=${encodeURIComponent(course)}&assignment=${encodeURIComponent(assignment)}`;
            
            // 下载Excel文件
            window.location.href = exportUrl;
            
            // 恢复按钮状态
            setTimeout(() => {
                exportSubmissionsBtn.disabled = false;
                exportSubmissionsBtn.innerHTML = originalText;
            }, 2000);
        }
    }
    
    // 事件监听器
    
    // 添加作业按钮
    if (addAssignmentBtn) {
        addAssignmentBtn.addEventListener('click', openAddAssignmentModal);
    }
    
    // 关闭弹窗按钮
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', closeAssignmentModal);
    }
    
    if (cancelBtn) {
        cancelBtn.addEventListener('click', closeAssignmentModal);
    }
    
    if (closeSubmissionDetailBtn) {
        closeSubmissionDetailBtn.addEventListener('click', closeSubmissionDetailModal);
    }
    
    // 作业表单提交
    if (assignmentForm) {
        assignmentForm.addEventListener('submit', e => {
            e.preventDefault();
            submitAssignmentForm();
        });
    }
    
    // 课程筛选变化
    if (courseFilter) {
        courseFilter.addEventListener('change', renderAssignmentsList);
    }
    
    // 提交情况课程筛选变化
    if (submissionCourseFilter) {
        submissionCourseFilter.addEventListener('change', () => {
            const courseValue = submissionCourseFilter.value;
            
            // 清空作业下拉框
            if (submissionAssignmentFilter) {
                submissionAssignmentFilter.innerHTML = '';
                submissionAssignmentFilter.disabled = !courseValue;
                
                if (!courseValue) {
                    submissionAssignmentFilter.innerHTML = '<option value="">请先选择课程</option>';
                    loadSubmissions('', '');
                    return;
                }
                
                // 根据选择的课程加载作业列表
                const courseAssignments = assignments
                    .filter(a => a.course === courseValue)
                    .map(a => a.name);
                
                // 添加选项
                submissionAssignmentFilter.innerHTML = '<option value="">请选择作业</option>';
                
                courseAssignments.forEach(name => {
                    const option = document.createElement('option');
                    option.value = name;
                    option.textContent = name;
                    submissionAssignmentFilter.appendChild(option);
                });
                
                // 清空提交列表
                loadSubmissions('', '');
            }
        });
    }
    
    // 提交情况作业筛选变化
    if (submissionAssignmentFilter) {
        submissionAssignmentFilter.addEventListener('change', () => {
            const courseValue = submissionCourseFilter ? submissionCourseFilter.value : '';
            const assignmentValue = submissionAssignmentFilter.value;
            
            loadSubmissions(courseValue, assignmentValue);
        });
    }
    
    // 下载所有提交按钮
    if (downloadAllBtn) {
        downloadAllBtn.addEventListener('click', () => {
            const courseValue = submissionCourseFilter ? submissionCourseFilter.value : '';
            const assignmentValue = submissionAssignmentFilter ? submissionAssignmentFilter.value : '';
            
            if (!courseValue || !assignmentValue) {
                showToast('请先选择课程和作业名称', 'error');
                return;
            }
            
            window.location.href = `/admin/download?course=${encodeURIComponent(courseValue)}&assignment=${encodeURIComponent(assignmentValue)}`;
        });
    }
});