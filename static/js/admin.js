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

    // 作业管理页面下拉框
    const classFilter = document.getElementById('classFilter');
    const courseFilter = document.getElementById('courseFilter');
    
    // 课程和作业筛选下拉框
    const submissionCourseFilter = document.getElementById('submissionCourseFilter');
    const submissionClassFilter = document.getElementById('submissionClassFilter');
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
        console.info(tabButtons);
        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                // 使用直接映射而不是字符串替换，以确保准确匹配
                const tabMapping = {
                    'tabAssignments': 'assignmentsTab',
                    'tabSubmissions': 'submissionsTab',
                    'tabClasses': 'classesTab',
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

                if (tabContentId === 'classesTab') {
                    loadClasses();
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

    if (classFilter) {
        classFilter.addEventListener('change', function() {
            const selectedClass = this.value;

            // 如果选择的是 “全部班级” 课程筛选下拉框便加载所有课程
            if (!selectedClass) {
                courseFilter.innerHTML = '';

                fetch('/admin/get_courses_by_class?class_name=all') 
                    .then(response => response.json())
                    .then(data => {
                        // 清空课程下拉框
                        courseFilter.innerHTML = '<option value="">全部课程</option>';
                        console.info("data", data);
                        // 添加课程选项
                        if (data.courses && data.courses.length > 0) {
                            data.courses.forEach(course => {
                                const option = document.createElement('option');
                                option.value = course;
                                option.textContent = course;
                                courseFilter.appendChild(option);
                            });
                        } else {
                            const option = document.createElement('option');
                            option.value = '';
                            option.textContent = '暂无课程';
                            courseFilter.appendChild(option);
                        }
                    })
                    .catch(error => {
                        console.error('Error loading courses:', error);
                    });
            } else {
                // 加载选定班级的课程
                fetch(`/admin/get_courses_by_class?class_name=${encodeURIComponent(selectedClass)}`)
                    .then(response => response.json())
                    .then(data => {
                        // 清空课程下拉框
                        courseFilter.innerHTML = '<option value="">全部课程</option>';
                        // 添加课程选项
                        if (data.courses && data.courses.length > 0) {
                            data.courses.forEach(course => {
                                const option = document.createElement('option');
                                option.value = course;
                                option.textContent = course;
                                courseFilter.appendChild(option);
                            });
                        } else {
                            const option = document.createElement('option');
                            option.value = '';
                            option.textContent = '暂无课程';
                            courseFilter.appendChild(option);
                        }
                    })
                    .catch(error => {
                        console.error('Error loading courses:', error);
                    });
            }
            renderAssignmentsList()
        });
        classFilter.dispatchEvent(new Event('change'));
    }
        
// 渲染作业列表
function renderAssignmentsList() {
    // 检查是否存在作业列表元素
    if (!assignmentsList) return;
    
    // 移除之前可能存在的所有弹出列表
    const existingPopups = document.querySelectorAll('.class-list-popup');
    existingPopups.forEach(popup => popup.remove());
    
    // 添加点击事件监听器到文档，点击非列表区域时关闭弹出窗口
    document.addEventListener('click', closeAllClassLists);
    
    // 筛选作业
    const classNameValue = classFilter ? classFilter.value : '';
    const courseNameValue = courseFilter ? courseFilter.value : '';
    console.info("classNameValue", classNameValue);
    console.info("courseNameValue", courseNameValue);
    
    const filteredAssignments = assignments.filter(assignment => {
        const courseMatch = courseNameValue ? assignment.course === courseNameValue : true;
        const classMatch = classNameValue ? assignment.classNames.includes(classNameValue) : true;
        return courseMatch && classMatch;
    });
    
    console.info('assignments', assignments);
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
                ${assignment.classNames.length === 1 ? 
                    `${assignment.classNames[0]}` : 
                    `<div class="class-list-container" data-assignment-id="${assignment.id}">
                        <span class="mr-1">${assignment.classNames.length}个班级</span>
                        <button class="toggle-class-list text-blue-500 focus:outline-none inline-flex items-center" type="button">
                            <svg class="w-4 h-4 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                            </svg>
                        </button>
                    </div>`
                }
            </td>
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
        
        // 班级列表展开/折叠按钮
        const toggleButton = row.querySelector('.toggle-class-list');
        if (toggleButton && assignment.classNames.length > 1) {
            toggleButton.addEventListener('click', (e) => {
                e.stopPropagation(); // 阻止事件冒泡
                
                // 关闭所有其他弹出的班级列表
                closeAllClassLists();
                
                // 创建弹出列表
                createClassListPopup(e.currentTarget, assignment.classNames, assignment.id);
                
                // 旋转箭头图标
                const svg = e.currentTarget.querySelector('svg');
                svg.style.transform = 'rotate(180deg)';
            });
        }
        
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

// 创建班级列表弹出窗口
function createClassListPopup(buttonElement, classNames, assignmentId) {
    // 获取按钮位置
    const buttonRect = buttonElement.getBoundingClientRect();
    
    // 创建弹出窗口元素
    const popup = document.createElement('div');
    popup.className = 'class-list-popup fixed bg-white rounded shadow-lg p-2 text-sm z-50 transform transition-all duration-200 ease-out';
    popup.style.width = 'auto';
    popup.style.minWidth = '150px';
    popup.dataset.assignmentId = assignmentId;
    
    // 添加班级列表内容
    popup.innerHTML = `
        <div class="font-medium pb-1 border-b border-gray-100 mb-1">班级列表</div>
        ${classNames.map(cls => `<div class="py-1">${cls}</div>`).join('')}
    `;
    
    // 添加到文档中
    document.body.appendChild(popup);
    
    // 计算弹出窗口位置
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    
    // 默认向下弹出
    let top = buttonRect.bottom + window.scrollY;
    let left = buttonRect.left + window.scrollX;
    
    // 检查是否需要向上弹出（靠近底部）
    const popupHeight = popup.offsetHeight;
    if (buttonRect.bottom + popupHeight > viewportHeight) {
        top = buttonRect.top + window.scrollY - popupHeight;
        popup.style.transformOrigin = 'bottom';
    } else {
        popup.style.transformOrigin = 'top';
    }
    
    // 确保不会超出右侧边界
    const popupWidth = popup.offsetWidth;
    if (left + popupWidth > viewportWidth) {
        left = viewportWidth - popupWidth - 10; // 10px 的边距
    }
    
    // 设置位置
    popup.style.top = `${top}px`;
    popup.style.left = `${left}px`;
    
    // 添加出场动画
    popup.style.opacity = '0';
    popup.style.transform = 'scaleY(0)';
    
    // 触发重排后应用动画
    setTimeout(() => {
        popup.style.opacity = '1';
        popup.style.transform = 'scaleY(1)';
    }, 10);
    
    // 保存当前打开的弹出窗口与按钮的关联
    buttonElement.dataset.popupOpen = 'true';
    popup.dataset.buttonId = assignmentId;
}

// 关闭所有班级列表弹出窗口
function closeAllClassLists(event) {
    if (event && event.target.closest('.toggle-class-list')) {
        // 如果点击的是切换按钮，不关闭
        return;
    }
    
    const popups = document.querySelectorAll('.class-list-popup');
    if (popups.length === 0) return;
    
    popups.forEach(popup => {
        // 添加退场动画
        popup.style.opacity = '0';
        popup.style.transform = 'scaleY(0)';
        
        // 重置所有相关按钮的图标
        const assignmentId = popup.dataset.assignmentId;
        const buttons = document.querySelectorAll(`.toggle-class-list[data-popup-open="true"]`);
        buttons.forEach(button => {
            const svg = button.querySelector('svg');
            if (svg) svg.style.transform = '';
            button.dataset.popupOpen = 'false';
        });
        
        // 动画结束后移除元素
        setTimeout(() => {
            popup.remove();
        }, 200);
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
        
        // 收集选中的班级
        const selectedClasses = [];
        document.querySelectorAll('input[name="classNames"]:checked').forEach(checkbox => {
            selectedClasses.push(checkbox.value);
        });
        
        if (selectedClasses.length === 0) {
            showToast('请至少选择一个班级', 'error');
            return;
        }
        
        const formData = {
            id: id || null,
            course,
            name,
            dueDate: deadline,
            description,
            advancedSettings,
            classNames: selectedClasses  // 添加班级信息
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
    
    // 加载提交记录
    function loadSubmissions(course, class_name, assignment) {
        if (!course || !class_name || !assignment) {
            submissionsList.innerHTML = `
                <tr>
                    <td colspan="5" class="px-6 py-4 text-center text-sm text-gray-500">
                        请选择课程、班级和作业名称查看提交情况
                    </td>
                </tr>
            `;
            downloadAllBtn.disabled = true;
            exportSubmissionsBtn.disabled = true;
            submissionStats.textContent = '请选择课程、班级和作业名称查看提交情况';
            return;
        }
        
        // 显示加载中
        submissionsList.innerHTML = `
            <tr>
                <td colspan="5" class="px-6 py-10 text-center text-sm text-gray-500">
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
        
        fetch(`/admin/submissions?course=${encodeURIComponent(course)}&class_name=${encodeURIComponent(class_name)}&assignment=${encodeURIComponent(assignment)}`)
            .then(response => response.json())
            .then(data => {
                renderSubmissionsList(data.submissions || []);
                
                // 更新统计信息
                if (data.stats) {
                    submissionStats.innerHTML = `
                        班级: ${data.stats.className}  |  课程：${course}  |  作业：${assignment}<br>
                        总共 ${data.stats.totalStudents} 名学生，已提交 ${data.stats.submittedCount} 人，提交率 ${data.stats.submissionRate}，截止日期: ${data.stats.dueDateStr}
                    `;

                    downloadAllBtn.disabled = (data.submissions || []).length === 0;
                    exportSubmissionsBtn.disabled = (data.submissions || []).length === 0;
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
                exportSubmissionsBtn.disabled = true;
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

    // 提交情况班级筛选变化
    if (submissionClassFilter) {
        submissionClassFilter.addEventListener('change', function() {
            const classValue = this.value;
            
            // 清空课程和作业下拉框
            submissionAssignmentFilter.innerHTML = '';
            submissionCourseFilter.innerHTML = '';
            
            // 禁用课程下拉框
            submissionCourseFilter.disabled = !classValue;
            submissionAssignmentFilter.disabled = true;
            
            if (!classValue) {
                submissionCourseFilter.innerHTML = '<option value="">请先选择班级</option>';
                submissionAssignmentFilter.innerHTML = '<option value="">请先选择班级和课程</option>';
                console.info('classValue:', classValue);
                return;
            }
            console.info('classValue:', classValue);
            
            // 获取班级列表
            fetch(`/admin/get_courses_by_class?class_name=${encodeURIComponent(classValue)}`)
                .then(response => response.json())
                .then(data => {
                    // 添加选项
                    console.log('课程列表:', data);
                    
                    if (data.courses && data.courses.length > 0) {
                        // 添加选项
                        submissionCourseFilter.innerHTML = '<option value="">请选择课程</option>';
                        data.courses.forEach(courseName => {
                            const option = document.createElement('option');
                            option.value = courseName;
                            option.textContent = courseName;
                            submissionCourseFilter.appendChild(option);
                        });
                    } else {
                        const option = document.createElement('option');
                        option.value = '';
                        option.textContent = '该班级暂无课程';
                        submissionCourseFilter.appendChild(option);
                    }

                    submissionAssignmentFilter.innerHTML = '<option value="">请先选择课程</option>';
                })
                .catch(error => {
                    console.error('获取课程列表失败:', error);
                    submissionCourseFilter.innerHTML = '<option value="">加载课程失败</option>';
                });
        });
    }
    
    // 提交情况课程筛选变化
    if (submissionCourseFilter) {
        // 提交情况加载时级联选择
        submissionCourseFilter.addEventListener('change', function() {
            const courseValue = this.value;
            const classValue = submissionClassFilter.value;
            
            // 清空作业下拉框
            submissionAssignmentFilter.innerHTML = '';
            // 根据情况禁用作业下拉框
            submissionAssignmentFilter.disabled = !courseValue;

            console.info('courseValue:', courseValue);
            if (!courseValue) {
                submissionAssignmentFilter.innerHTML = '<option value="">请先选择课程</option>';
                // loadSubmissions('', '', '');
                return;
            }
            
            // 获取作业列表
            fetch(`/admin/get_assignments_by_class_and_course?course=${encodeURIComponent(courseValue)}&class_name=${encodeURIComponent(classValue)}`)
                .then(response => response.json())
                .then(data => {
                    console.info('作业列表:', data);
                    if (data.assignments && data.assignments.length > 0) {
                        // 添加选项
                        submissionAssignmentFilter.innerHTML = '<option value="">请选择作业</option>';
                        data.assignments.forEach(assignmentInfo => {
                            const option = document.createElement('option');
                            option.value = assignmentInfo.name;
                            option.textContent = assignmentInfo.name;
                            submissionAssignmentFilter.appendChild(option);
                        });
                    } else {
                        const option = document.createElement('option');
                        option.value = '';
                        option.textContent = '该课程暂无作业';
                        submissionAssignmentFilter.appendChild(option);
                    }
                })
                .catch(error => {
                    console.error('获取作业列表失败:', error);
                    submissionAssignmentFilter.innerHTML = '<option value="">加载作业失败</option>';
                });
        });
    }

    // 作业选择变化
    submissionAssignmentFilter.addEventListener('change', function() {
        const classValue = submissionClassFilter.value;
        const courseValue = submissionCourseFilter.value;
        const assignmentValue = this.value;
        
        if (!assignmentValue) {
            submissionAssignmentFilter.innerHTML = '<option value="">请选择作业</option>';
            return;
        }
        
        loadSubmissions(courseValue, classValue, assignmentValue);
    });
    
    // 提交情况作业筛选变化
    if (submissionAssignmentFilter) {
        const courseValue = submissionCourseFilter.value;
        const classValue = submissionClassFilter.value;
        const assignmentValue = this.value;

        console.info('courseValue:', courseValue);
        console.info('classValue:', classValue);
        console.info('assignmentValue:', assignmentValue);
        
        loadSubmissions(courseValue, classValue, assignmentValue);
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

    // 课程选择改变时加载班级
    courseName.addEventListener('change', function() {
        const selectedCourse = this.value;
        const classCheckboxes = document.getElementById('classCheckboxes');
        
        // 清空班级选择框
        classCheckboxes.innerHTML = '';
        
        if (!selectedCourse) {
            classCheckboxes.innerHTML = '<div class="text-sm text-gray-500 p-2">请先选择课程</div>';
            return;
        }
        
        // 显示加载中
        classCheckboxes.innerHTML = '<div class="text-sm text-gray-500 p-2">加载班级中...</div>';
        
        // 获取班级列表
        fetch(`/get_classes?course=${encodeURIComponent(selectedCourse)}`)
            .then(response => response.json())
            .then(data => {
                classCheckboxes.innerHTML = '';
                
                if (!data.classes || data.classes.length === 0) {
                    classCheckboxes.innerHTML = '<div class="text-sm text-gray-500 p-2">该课程暂无班级</div>';
                    return;
                }
                
                // 添加"全选"选项
                const allCheckbox = document.createElement('div');
                allCheckbox.className = 'flex items-center';
                allCheckbox.innerHTML = `
                    <input type="checkbox" id="selectAllClasses" class="h-4 w-4 text-blue-600 border-gray-300 rounded">
                    <label for="selectAllClasses" class="ml-2 block text-sm text-gray-900 font-medium">全选</label>
                `;
                classCheckboxes.appendChild(allCheckbox);
                
                // 添加分隔线
                const divider = document.createElement('div');
                divider.className = 'border-t border-gray-200 my-2';
                classCheckboxes.appendChild(divider);
                
                // 添加班级选项
                data.classes.forEach(classInfo => {
                    const checkbox = document.createElement('div');
                    checkbox.className = 'flex items-center';
                    
                    const id = `class_${classInfo.name.replace(/\s+/g, '_')}`;
                    checkbox.innerHTML = `
                        <input type="checkbox" id="${id}" name="classNames" value="${classInfo.name}" class="class-checkbox h-4 w-4 text-blue-600 border-gray-300 rounded">
                        <label for="${id}" class="ml-2 block text-sm text-gray-900">
                            ${classInfo.name}
                            <span class="text-xs text-gray-500">${classInfo.description || ''}</span>
                        </label>
                    `;
                    
                    classCheckboxes.appendChild(checkbox);
                });
                
                // 添加全选/取消全选功能
                const selectAllCheckbox = document.getElementById('selectAllClasses');
                const classCheckboxInputs = document.querySelectorAll('.class-checkbox');
                
                selectAllCheckbox.addEventListener('change', function() {
                    const isChecked = this.checked;
                    classCheckboxInputs.forEach(checkbox => {
                        checkbox.checked = isChecked;
                    });
                });
                
                // 当单个班级复选框状态变化时，更新"全选"复选框
                classCheckboxInputs.forEach(checkbox => {
                    checkbox.addEventListener('change', function() {
                        const allChecked = [...classCheckboxInputs].every(cb => cb.checked);
                        selectAllCheckbox.checked = allChecked;
                    });
                });
            })
            .catch(error => {
                console.error('获取班级列表失败:', error);
                classCheckboxes.innerHTML = '<div class="text-sm text-red-500 p-2">加载班级失败</div>';
            });
    });

    //region 班级管理
    // 新增导航项目 - 在原有导航中添加班级管理标签
    // const navItems = document.querySelector('.border-b.border-gray-200.mb-6 nav');
    // const classesTabButton = document.createElement('button');
    // classesTabButton.id = 'tabClasses';
    // classesTabButton.className = 'tab-button text-gray-500 hover:text-gray-700 hover:border-gray-300 py-4 px-6 border-b-2 border-transparent font-medium text-sm leading-5 focus:outline-none';
    // classesTabButton.textContent = '班级管理';
    // navItems.appendChild(classesTabButton);

    // const classesTabButton = document.getElementById('tabClasses');
    // navItems.appendChild(classesTabButton);

    // 班级相关变量
    let classesData = [];
    const classesList = document.getElementById('classesList');
    const classFilterCourse = document.getElementById('classFilterCourse');
    const addClassBtn = document.getElementById('addClassBtn');
    const classModal = document.getElementById('classModal');
    const classModalTitle = document.getElementById('classModalTitle');
    const classForm = document.getElementById('classForm');
    const classId = document.getElementById('classId');
    const originalClassName = document.getElementById('originalClassName');
    const originalCourse = document.getElementById('originalCourse');
    const classCourse = document.getElementById('classCourse');
    const className = document.getElementById('className');
    const classDescription = document.getElementById('classDescription');
    const closeClassModalBtn = document.getElementById('closeClassModalBtn');
    const cancelClassBtn = document.getElementById('cancelClassBtn');
    const classStudentsModal = document.getElementById('classStudentsModal');
    const classStudentsTitle = document.getElementById('classStudentsTitle');
    const classStudentsList = document.getElementById('classStudentsList');
    const closeClassStudentsBtn = document.getElementById('closeClassStudentsBtn');

    // 班级管理标签页点击事件
    // if (classesTabButton) {
    //     classesTabButton.addEventListener('click', () => {
    //         // 更新按钮样式
    //         tabButtons.forEach(btn => {
    //             btn.classList.remove('text-blue-600', 'border-blue-500');
    //             btn.classList.add('text-gray-500', 'border-transparent');
    //         });
            
    //         classesTabButton.classList.remove('text-gray-500', 'border-transparent');
    //         classesTabButton.classList.add('text-blue-600', 'border-blue-500');
            
    //         // 切换标签页内容
    //         tabContents.forEach(content => {
    //             content.classList.remove('active');
    //         });
            
    //         classesTab.classList.add('active');
            
    //         // 加载班级列表
    //         loadClasses();
    //     });
    // }

    // 加载班级列表
    function loadClasses() {
        const courseFilter = classFilterCourse ? classFilterCourse.value : '';
        
        // 显示加载中
        if (classesList) {
            classesList.innerHTML = `
                <tr>
                    <td colspan="5" class="px-6 py-4 text-center text-sm text-gray-500">
                        <svg class="animate-spin h-5 w-5 mx-auto text-blue-500 mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>加载中...</span>
                    </td>
                </tr>
            `;
        }
        
        // 加载班级数据
        fetch('/admin/classes')
            .then(response => response.json())
            .then(data => {
                classesData = data.classes || [];
                
                // 根据课程筛选
                const filteredClasses = courseFilter ? 
                    classesData.filter(c => c.course === courseFilter) : 
                    classesData;
                
                renderClassesList(filteredClasses);
            })
            .catch(error => {
                console.error('加载班级列表失败:', error);
                
                if (classesList) {
                    classesList.innerHTML = `
                        <tr>
                            <td colspan="5" class="px-6 py-4 text-center text-sm text-red-500">
                                加载班级列表失败: ${error.message}
                            </td>
                        </tr>
                    `;
                }
            });
    }

    // 渲染班级列表
    function renderClassesList(classes) {
        if (!classesList) return;
        
        // 清空列表
        classesList.innerHTML = '';
        
        // 检查是否有班级
        if (classes.length === 0) {
            classesList.innerHTML = `
                <tr>
                    <td colspan="5" class="px-6 py-4 text-center text-sm text-gray-500">
                        暂无班级数据
                    </td>
                </tr>
            `;
            return;
        }
        
        // 当前用户学生数量缓存
        const studentCounts = {};
        
        // 添加班级到列表
        classes.forEach(classInfo => {
            const row = document.createElement('tr');
            row.className = 'class-item hover:bg-gray-50';
            
            // 从用户数据中计算该班级的学生数量
            if (!studentCounts[classInfo.name]) {
                // 异步加载学生数量
                loadClassStudentCount(classInfo.name).then(count => {
                    const studentCountElem = row.querySelector('.student-count');
                    if (studentCountElem) {
                        studentCountElem.textContent = count;
                    }
                    studentCounts[classInfo.name] = count;
                });
            }
            
            row.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    ${classInfo.course}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    ${classInfo.name}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    ${classInfo.description || '-'}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 student-count">
                    加载中...
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button 
                        class="text-indigo-600 hover:text-indigo-900 mr-3 view-students" 
                        data-course="${classInfo.course}" 
                        data-class="${classInfo.name}"
                    >
                        查看学生
                    </button>
                    <button 
                        class="text-blue-600 hover:text-blue-900 mr-3 edit-class" 
                        data-course="${classInfo.course}" 
                        data-class="${classInfo.name}"
                    >
                        编辑
                    </button>
                    <button 
                        class="text-red-600 hover:text-red-900 delete-class" 
                        data-course="${classInfo.course}" 
                        data-class="${classInfo.name}"
                    >
                        删除
                    </button>
                </td>
            `;
            
            classesList.appendChild(row);
            
            // 添加事件监听器
            
            // 查看学生按钮
            const viewStudentsBtn = row.querySelector('.view-students');
            if (viewStudentsBtn) {
                viewStudentsBtn.addEventListener('click', () => {
                    viewClassStudents(classInfo.name);
                });
            }
            
            // 编辑按钮
            const editBtn = row.querySelector('.edit-class');
            if (editBtn) {
                editBtn.addEventListener('click', () => {
                    openEditClassModal(classInfo);
                });
            }
            
            // 删除按钮
            const deleteBtn = row.querySelector('.delete-class');
            if (deleteBtn) {
                deleteBtn.addEventListener('click', () => {
                    deleteClass(classInfo.course, classInfo.name);
                });
            }
        });
    }

    // 加载班级学生数量
    async function loadClassStudentCount(className) {
        try {
            const response = await fetch(`/admin/class_students/${encodeURIComponent(className)}`);
            const data = await response.json();
            
            if (data.status === 'success') {
                return data.student_count;
            } else {
                console.error('获取班级学生数量失败:', data.message);
                return 0;
            }
        } catch (error) {
            console.error('获取班级学生数量出错:', error);
            return 0;
        }
    }

    // 查看班级学生
    function viewClassStudents(className) {
        if (!classStudentsModal || !classStudentsTitle || !classStudentsList) return;
        
        // 更新标题
        classStudentsTitle.textContent = `${className} 学生列表`;
        
        // 显示加载中
        classStudentsList.innerHTML = `
            <tr>
                <td colspan="3" class="px-6 py-4 text-center text-sm text-gray-500">
                    <svg class="animate-spin h-5 w-5 mx-auto text-blue-500 mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>加载中...</span>
                </td>
            </tr>
        `;
        
        // 显示弹窗
        classStudentsModal.classList.remove('hidden');
        
        // 加载学生数据
        fetch(`/admin/class_students/${encodeURIComponent(className)}`)
            .then(response => response.json())
            .then(data => {
                if (data.status === 'success') {
                    const students = data.students || [];
                    
                    // 清空列表
                    classStudentsList.innerHTML = '';
                    
                    // 检查是否有学生
                    if (students.length === 0) {
                        classStudentsList.innerHTML = `
                            <tr>
                                <td colspan="3" class="px-6 py-4 text-center text-sm text-gray-500">
                                    该班级暂无学生
                                </td>
                            </tr>
                        `;
                        return;
                    }
                    
                    // 添加学生到列表
                    students.forEach(student => {
                        const row = document.createElement('tr');
                        row.className = 'student-item hover:bg-gray-50';
                        
                        row.innerHTML = `
                            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                ${student.student_id}
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                ${student.name}
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                ${student.email || '-'}
                            </td>
                        `;
                        
                        classStudentsList.appendChild(row);
                    });
                } else {
                    classStudentsList.innerHTML = `
                        <tr>
                            <td colspan="3" class="px-6 py-4 text-center text-sm text-red-500">
                                加载学生列表失败: ${data.message}
                            </td>
                        </tr>
                    `;
                }
            })
            .catch(error => {
                console.error('加载班级学生列表失败:', error);
                
                classStudentsList.innerHTML = `
                    <tr>
                        <td colspan="3" class="px-6 py-4 text-center text-sm text-red-500">
                            加载学生列表失败: ${error.message}
                        </td>
                    </tr>
                `;
            });
    }

    // 打开添加班级弹窗
    function openAddClassModal() {
        if (!classModal || !classModalTitle || !classForm) return;
        
        classModalTitle.textContent = '添加班级';
        classId.value = '';
        originalClassName.value = '';
        originalCourse.value = '';
        classForm.reset();
        
        classModal.classList.remove('hidden');
    }

    // 打开编辑班级弹窗
    function openEditClassModal(classInfo) {
        if (!classModal || !classModalTitle || !classForm || !classCourse || !className || !classDescription) return;
        
        classModalTitle.textContent = '编辑班级';
        originalClassName.value = classInfo.name;
        originalCourse.value = classInfo.course;
        
        classCourse.value = classInfo.course;
        className.value = classInfo.name;
        classDescription.value = classInfo.description || '';
        
        classModal.classList.remove('hidden');
    }

    // 关闭班级弹窗
    function closeClassModal() {
        if (classModal) {
            classModal.classList.add('hidden');
        }
    }

    // 关闭班级学生弹窗
    function closeClassStudentsModal() {
        if (classStudentsModal) {
            classStudentsModal.classList.add('hidden');
        }
    }

    // 删除班级
    function deleteClass(course, className) {
        if (!confirm(`确定要删除班级 "${className}" 吗？这将同时删除该班级下的所有提交记录。`)) {
            return;
        }
        
        fetch(`/admin/classes/${encodeURIComponent(course)}/${encodeURIComponent(className)}`, {
            method: 'DELETE'
        })
            .then(response => response.json())
            .then(data => {
                if (data.status === 'success') {
                    showToast(data.message || '班级已删除', 'success');
                    loadClasses();
                } else {
                    showToast(data.message || '删除班级失败', 'error');
                }
            })
            .catch(error => {
                console.error('删除班级失败:', error);
                showToast('删除班级失败: ' + error.message, 'error');
            });
    }

    // 班级筛选变化
    if (classFilterCourse) {
        classFilterCourse.addEventListener('change', loadClasses);
    }

    // 添加班级按钮
    if (addClassBtn) {
        addClassBtn.addEventListener('click', openAddClassModal);
    }

    // 关闭班级弹窗按钮
    if (closeClassModalBtn) {
        closeClassModalBtn.addEventListener('click', closeClassModal);
    }

    // 取消按钮
    if (cancelClassBtn) {
        cancelClassBtn.addEventListener('click', closeClassModal);
    }

    // 关闭班级学生弹窗按钮
    if (closeClassStudentsBtn) {
        closeClassStudentsBtn.addEventListener('click', closeClassStudentsModal);
    }

    // 班级表单提交
    if (classForm) {
        classForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const course = classCourse.value;
            const name = className.value;
            const description = classDescription.value;
            
            if (!course || !name) {
                showToast('课程和班级名称不能为空', 'error');
                return;
            }
            
            const isEdit = originalClassName.value !== '';
            const url = isEdit ? 
                `/admin/classes/${encodeURIComponent(originalCourse.value)}/${encodeURIComponent(originalClassName.value)}` : 
                '/admin/classes';
            
            const method = isEdit ? 'PUT' : 'POST';
            
            const data = {
                course: course,
                name: name,
                description: description
            };
            
            // 保存或更新班级
            fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            })
                .then(response => response.json())
                .then(data => {
                    if (data.status === 'success') {
                        closeClassModal();
                        loadClasses();
                        showToast(data.message || (isEdit ? '班级已更新' : '班级已添加'), 'success');
                    } else {
                        showToast(data.message || '保存班级失败', 'error');
                    }
                })
                .catch(error => {
                    console.error('保存班级失败:', error);
                    showToast('保存班级失败: ' + error.message, 'error');
                });
        });
    }
});