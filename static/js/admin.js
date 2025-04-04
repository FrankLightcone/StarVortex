/**
 * admin.js - 管理员界面模块
 * 
 * 管理员控制面板的主要功能实现，包括作业管理、提交情况查看、
 * 文件下载等管理功能的前端交互逻辑。
 * 
 * @module admin
 * @requires toast.js
 * 
 * 主要功能：
 * - 标签页切换（作业管理、提交情况）
 * - 作业列表显示与筛选
 * - 作业添加、编辑、删除
 * - 提交情况查看与筛选
 * - 学生提交详情查看
 * - 文件下载管理
 * 
 * 日期时间处理函数：
 * @function formatDateTimeLocal - 格式化日期时间为input[type=datetime-local]所需格式
 * 
 * 消息通知函数：
 * @function showToast - 显示提示消息
 * 
 * 作业管理相关函数：
 * @function loadAssignments - 加载作业列表
 * @function renderAssignmentsList - 渲染作业列表
 * @function openAddAssignmentModal - 打开添加作业弹窗
 * @function openEditAssignmentModal - 打开编辑作业弹窗
 * @function closeAssignmentModal - 关闭作业弹窗
 * @function deleteAssignment - 删除作业
 * @function submitAssignmentForm - 提交作业表单
 * 
 * 提交情况相关函数：
 * @function loadSubmissions - 加载提交情况
 * @function renderSubmissionsList - 渲染提交列表
 * @function openSubmissionDetailModal - 打开提交详情弹窗
 * @function closeSubmissionDetailModal - 关闭提交详情弹窗
 * 
 * 事件监听器：
 * - DOMContentLoaded：初始化页面组件和数据
 * - 标签页切换、表单操作、数据筛选等多个事件监听
 * 
 * Fetch请求：
 * - GET /admin/assignments：获取所有作业信息
 * - POST /admin/assignments：创建新作业
 * - PUT /admin/assignments/:id：更新作业
 * - DELETE /admin/assignments/:id：删除作业
 * - GET /admin/submissions：获取作业提交情况
 */

document.addEventListener('DOMContentLoaded', function() {
    // DOM 元素
    const toast = document.getElementById('toast');
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');
    const assignmentModal = document.getElementById('assignmentModal');
    const submissionDetailModal = document.getElementById('submissionDetailModal');
    
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
    
    // 作业数据（模拟数据，实际应从服务器加载）
    let assignments = [];
    
    // 初始加载
    window.addEventListener('DOMContentLoaded', () => {
        // 加载作业列表
        loadAssignments();
        
        // 设置默认截止日期为今天后一周
        const now = new Date();
        now.setDate(now.getDate() + 7);
        dueDate.value = formatDateTimeLocal(now);
    });
    
    // 时间格式化为datetime-local输入框所需的格式
    function formatDateTimeLocal(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        
        return `${year}-${month}-${day}T${hours}:${minutes}`;
    }
    
    // Toast notification function
    function showToast(message, type = 'error') {
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
        // 筛选作业
        const courseName = courseFilter.value;
        const filteredAssignments = courseName ? 
            assignments.filter(a => a.course === courseName) : 
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

});