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
    
    //region 加载课程和作业信息
    // ===== 作业列表相关事件处理 =====
    const refreshAssignmentsBtn = document.getElementById('refreshAssignmentsBtn');
    const assignmentStatusFilter = document.getElementById('assignmentStatusFilter');
    // 添加分页变量
    let currentPage = 1;
    let itemsPerPage = 10;
    let totalAssignments = 0;

    let selectedFiles = [];

    if (refreshAssignmentsBtn) {
        console.log("添加刷新按钮点击事件");
        refreshAssignmentsBtn.addEventListener('click', loadAllAssignments);
    } else {
        console.error("找不到刷新按钮元素");
    }

    if (assignmentStatusFilter) {
        console.log("添加状态筛选器变化事件");
        assignmentStatusFilter.addEventListener('change', loadAllAssignments);
    } else {
        console.error("找不到状态筛选器元素");
    }
    /**
     * 加载所有作业列表
     * 获取所有课程的作业，并按照截止日期、提交状态等进行展示
     */
    function loadAllAssignments() {
        const statusFilter = document.getElementById('assignmentStatusFilter').value;
        const assignmentsListBody = document.getElementById('assignmentsListBody');
        
        if (!assignmentsListBody) {
            console.error("找不到 assignmentsListBody 元素");
            return;
        }

        const loadStartTime = Date.now();
        
        // 清空当前内容
        assignmentsListBody.innerHTML = '';
        assignmentsListBody.classList.add('skeleton-loading');

        // 添加固定数量的骨架屏行
        for (let i = 0; i < 5; i++) {
            const row = document.createElement('tr');
            row.className = 'bg-white border-b dark:bg-gray-800 dark:border-gray-700 border-gray-200 animate-pulse skeleton-row';
            row.innerHTML = `
                <td class="px-6 py-4"><div class="h-2.5 bg-gray-300 rounded-full dark:bg-gray-600 w-24 mb-2.5"></div></td>
                <td class="px-6 py-4"><div class="h-2.5 bg-gray-300 rounded-full dark:bg-gray-600 w-32 mb-2.5"></div></td>
                <td class="px-6 py-4"><div class="h-2.5 bg-gray-300 rounded-full dark:bg-gray-600 w-24 mb-2.5"></div><div class="h-2 bg-gray-200 dark:bg-gray-700 w-16 rounded-full"></div></td>
                <td class="px-6 py-4"><div class="h-2.5 bg-gray-300 dark:bg-gray-600 rounded-full w-12"></div></td>
                <td class="px-6 py-4"><div class="h-2.5 bg-gray-300 dark:bg-gray-600 rounded-full w-12"></div></td>
                <td class="px-6 py-4 text-right"><div class="h-2.5 bg-gray-300 dark:bg-gray-600 rounded-full w-12 ml-auto"></div></td>
            `;
            assignmentsListBody.appendChild(row);
        }

        fetch('/all_assignments')
            .then(res => res.ok ? res.json() : res.json().then(err => { throw new Error(err.message); }))
            .then(data => {
                const loadTime = Date.now() - loadStartTime;
                const minLoadTime = 800;

                // Ensure minimum loading time for better UX
                const renderTimeout = Math.max(0, minLoadTime - loadTime);
                
                setTimeout(() => {
                    // Clear skeleton rows and render actual data
                    assignmentsListBody.innerHTML = '';
                    assignmentsListBody.classList.remove('skeleton-loading');
                    renderActualAssignments(data, statusFilter);
                }, renderTimeout);
            })
            .catch(error => {
                console.error('Loading error:', error);
                
                // Clear skeleton and show error
                assignmentsListBody.innerHTML = '';
                assignmentsListBody.classList.remove('skeleton-loading');
                
                assignmentsListBody.innerHTML = `
                    <tr class="fade-in-row bg-white border-b dark:bg-gray-800 dark:border-gray-700">
                        <td colspan="6" class="px-6 py-4 text-center text-sm text-red-500 dark:text-red-400">
                            加载失败: ${error.message}
                        </td>
                    </tr>`;
                
                updatePagination(0);
                
                if (typeof showToast === 'function') {
                    showToast(`加载作业列表失败: ${error.message}`, 'error');
                }
            });
    }

    function renderActualAssignments(data, statusFilter) {
        const assignmentsListBody = document.getElementById('assignmentsListBody');
        if (!assignmentsListBody) return;

        let filtered = data.assignments || [];
        if (statusFilter !== 'all') {
            filtered = filtered.filter(a => {
                return (statusFilter === 'pending' && !a.isExpired) ||
                    (statusFilter === 'expired' && a.isExpired) ||
                    (statusFilter === 'submitted' && a.hasSubmitted) ||
                    (statusFilter === 'unsubmitted' && !a.hasSubmitted);
            });
        }

        // Sort by expiration and due date
        filtered.sort((a, b) => {
            if (a.isExpired !== b.isExpired) return a.isExpired ? 1 : -1;
            return new Date(a.dueDate) - new Date(b.dueDate);
        });

        totalAssignments = filtered.length;
        
        // Handle pagination
        const start = (currentPage - 1) * itemsPerPage;
        const pageData = filtered.slice(start, start + itemsPerPage);

        if (pageData.length === 0) {
            assignmentsListBody.innerHTML = `
                <tr class="fade-in-row bg-white border-b dark:bg-gray-800 dark:border-gray-700">
                    <td colspan="6" class="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                        没有匹配的作业
                    </td>
                </tr>`;
            updatePagination(0);
            return;
        }

        // Clear previous content and render new items with fade-in animations
        assignmentsListBody.innerHTML = '';
        pageData.forEach((assignment, index) => {
            renderAssignmentItem(assignment, assignmentsListBody, index);
        });

        updatePagination(totalAssignments);
    }

    function renderAssignmentItem(assignment, container, index) {
        const row = document.createElement('tr');
        row.className = 'fade-in-row bg-white border-b dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600';
        row.style.animationDelay = `${index * 50}ms`;

        const due = new Date(assignment.dueDate);
        const dueStr = due.toLocaleString('zh-CN', {year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'});
        const now = new Date(), diff = due - now;
        const timeStatus = diff > 0
            ? (Math.floor(diff / 86400000) > 0 ? `剩余 ${Math.floor(diff / 86400000)} 天 ${Math.floor((diff % 86400000) / 3600000)} 小时` : `剩余 ${Math.floor(diff / 3600000)} 小时`)
            : (Math.floor(-diff / 86400000) > 0 ? `已过期 ${Math.floor(-diff / 86400000)} 天` : '已过期');

        const statusClass = assignment.isExpired ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300' : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
        const submissionClass = assignment.hasSubmitted ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';

        row.innerHTML = `
            <td class="px-6 py-4">${assignment.course}</td>
            <td class="px-6 py-4">${assignment.name}</td>
            <td class="px-6 py-4">${dueStr}
            <div class="text-xs ${assignment.isExpired ? 'text-red-500' : 'text-green-500'}">
                ${timeStatus}
            </div>
            </td>
            <td class="px-6 py-4">
            <span class="inline-flex items-center ${statusClass} text-xs font-medium px-2.5 py-0.5 rounded-full">
                ${assignment.isExpired ? '已截止' : '进行中'}
            </span>
            </td>
            <td class="px-6 py-4">
            <span class="inline-flex items-center ${submissionClass} text-xs font-medium px-2.5 py-0.5 rounded-full">
                ${assignment.hasSubmitted ? '已提交' : '未提交'}
            </span>
            </td>
            <!-- 留一个空的 actions-cell -->
            <td class="px-6 py-4 text-right actions-cell"></td>
        `;
        container.appendChild(row);
        
        // —— 2. 生成唯一 ID，用于 popover & chart 容器 —— 
        const assignmentId = `ass-${Date.now()}-${index}`;
        const popoverId    = `pop-${assignmentId}`;
        const chartId      = `chart-${assignmentId}`;
        
        // —— 3. 创建并插入“图表按钮” & 隐藏的 popover —— 
        const actionsCell = row.querySelector('.actions-cell');
        const chartBtn = createChartButton(popoverId);
        const popover  = createPopoverContent(
            chartId, popoverId,
            assignment.course,
            assignment.name,
            assignment.submittedCount || 0,
            assignment.totalStudents  || 0
        );
        actionsCell.appendChild(chartBtn);
        document.body.appendChild(popover);
        
        // —— 4. 绑定 hover 事件：定位 + 显示 + 发请求渲染图表 —— 
        chartBtn.addEventListener('mouseenter', () => {
            positionPopover(popover, chartBtn);
            popover.classList.remove('hidden');
            setTimeout(() => {
            popover.style.opacity = '1';
            popover.style.visibility = 'visible';
            }, 50);
            fetchAndRenderChart(chartId, assignment.course, assignment.name, /* className */);
        });
        chartBtn.addEventListener('mouseleave', () => {
            setTimeout(() => {
            if (!isMouseOverElement(popover)) hidePopover(popover);
            }, 100);
        });
        popover.addEventListener('mouseleave', () => {
            if (!isMouseOverElement(chartBtn)) hidePopover(popover);
        });
        
        // —— 5. 再插“去提交/查看提交”按钮 —— 
        const submitBtn = document.createElement('button');
        submitBtn.className = 'go-to-submit text-blue-600 hover:text-blue-900';
        submitBtn.textContent = assignment.hasSubmitted ? '查看提交' : '立即提交';
        submitBtn.dataset.course     = assignment.course;
        submitBtn.dataset.assignment = assignment.name;
        submitBtn.addEventListener('click', () => {
            goToSubmitAssignment(assignment.course, assignment.name);
        });
        actionsCell.appendChild(submitBtn);
    }

    // 添加分页导航更新函数
    function updatePagination(totalItems) {
        const paginationElement = document.getElementById('assignmentPagination');
        if (!paginationElement) return;
        
        // 如果没有数据，隐藏分页
        if (totalItems === 0) {
            paginationElement.classList.add('hidden');
            return;
        }
        
        // 计算总页数
        const totalPages = Math.ceil(totalItems / itemsPerPage);
        
        // 更新分页信息
        const startItem = (currentPage - 1) * itemsPerPage + 1;
        const endItem = Math.min(currentPage * itemsPerPage, totalItems);
        
        // 更新显示信息
        const pageInfoElement = paginationElement.querySelector('.page-info');
        if (pageInfoElement) {
            pageInfoElement.innerHTML = `显示 <span class="font-semibold text-gray-900 dark:text-white">${startItem}-${endItem}</span> 共 <span class="font-semibold text-gray-900 dark:text-white">${totalItems}</span>`;
        }
        
        // 更新页码列表
        const pageListElement = paginationElement.querySelector('.pagination-list');
        if (pageListElement) {
            let pageHTML = `
                <li>
                    <a href="#" class="page-prev flex items-center justify-center px-4 h-10 ms-0 leading-tight text-gray-600 bg-white border border-gray-300 rounded-l-lg hover:bg-blue-50 hover:text-blue-700 focus:ring-2 focus:ring-blue-100 focus:outline-none transition-colors duration-150 ease-in-out dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white ${currentPage === 1 ? 'opacity-50 cursor-not-allowed' : ''}">
                        <svg class="w-3.5 h-3.5 me-2 rtl:rotate-180" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 14 10">
                            <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 5H1m0 0 4 4M1 5l4-4"/>
                        </svg>
                        上一页
                    </a>
                </li>
            `;
            
            // 生成页码
            const maxPagesToShow = 5;
            let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
            let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);
            
            if (endPage - startPage + 1 < maxPagesToShow) {
                startPage = Math.max(1, endPage - maxPagesToShow + 1);
            }
            
            for (let i = startPage; i <= endPage; i++) {
                const isActive = i === currentPage;
                pageHTML += `
                    <li>
                        <a href="#" data-page="${i}" class="page-num flex items-center justify-center px-4 h-10 leading-tight ${isActive 
                            ? 'text-white bg-blue-600 border border-blue-600 hover:bg-blue-700 focus:ring-2 focus:ring-blue-300 dark:bg-blue-600 dark:border-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800' 
                            : 'text-gray-600 bg-white border border-gray-300 hover:bg-blue-50 hover:text-blue-700 focus:ring-2 focus:ring-blue-100 focus:outline-none dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white'}" 
                            ${isActive ? 'aria-current="page"' : ''}>
                            ${i}
                        </a>
                    </li>
                `;
            }
            
            pageHTML += `
                <li>
                    <a href="#" class="page-next flex items-center justify-center px-4 h-10 leading-tight text-gray-600 bg-white border border-gray-300 rounded-r-lg hover:bg-blue-50 hover:text-blue-700 focus:ring-2 focus:ring-blue-100 focus:outline-none transition-colors duration-150 ease-in-out dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white ${currentPage === totalPages ? 'opacity-50 cursor-not-allowed' : ''}">
                        下一页
                        <svg class="w-3.5 h-3.5 ms-2 rtl:rotate-180" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 14 10">
                            <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M1 5h12m0 0L9 1m4 4L9 9"/>
                        </svg>
                    </a>
                </li>
            `;
            
            pageListElement.innerHTML = pageHTML;
            
            // 添加页码点击事件
            const pageNumLinks = pageListElement.querySelectorAll('.page-num');
            pageNumLinks.forEach(link => {
                link.addEventListener('click', function(e) {
                    e.preventDefault();
                    const pageNum = parseInt(this.dataset.page, 10);
                    if (pageNum !== currentPage) {
                        currentPage = pageNum;
                        loadAllAssignments();
                    }
                });
            });
            
            // 添加上一页/下一页按钮事件
            const prevButton = pageListElement.querySelector('.page-prev');
            if (prevButton) {
                prevButton.addEventListener('click', function(e) {
                    e.preventDefault();
                    if (currentPage > 1) {
                        currentPage--;
                        loadAllAssignments();
                    }
                });
            }
            
            const nextButton = pageListElement.querySelector('.page-next');
            if (nextButton) {
                nextButton.addEventListener('click', function(e) {
                    e.preventDefault();
                    if (currentPage < totalPages) {
                        currentPage++;
                        loadAllAssignments();
                    }
                });
            }
        }
        
        // 显示分页
        paginationElement.classList.remove('hidden');
    }
    //region跳转到作业提交页面
    /**
     * @param {string} course - 课程名称
     * @param {string} assignmentName - 作业名称
     */
    function goToSubmitAssignment(course, assignmentName) {
        const row = document.querySelector(`button[data-course="${course}"][data-assignment="${assignmentName}"]`);
        const hasSubmitted = row && row.textContent.includes('查看提交');
    
        if (hasSubmitted) {
            // 1. 切换到“我的提交”tab
            document.getElementById('tabSubmissions').click();
    
            // 2. 等待提交记录加载完成后自动展开对应的提交
            setTimeout(() => {
                loadMySubmissions(); // 先刷新列表（确保包含最新提交）
                setTimeout(() => {
                    const matchRow = Array.from(document.querySelectorAll('.view-submission'))
                        .find(btn => btn.dataset.course === course && btn.dataset.assignment === assignmentName);
                    if (matchRow) {
                        matchRow.click();
                    }
                }, 500); // 给渲染一些缓冲时间
            }, 300);
        } else {
            // 原来的上传逻辑
            switchToUploadTab(course, assignmentName);
        }
    }
    
    function switchToUploadTab(course, assignmentName) {
        // 切换到上传tab
        document.getElementById('tabUpload').click();
    
        // 设置课程和作业选择
        const courseSelect = document.getElementById('course');
        const assignmentSelect = document.getElementById('assignment_name');
    
        courseSelect.value = course;
        courseSelect.dispatchEvent(new Event('change'));
    
        setTimeout(() => {
            assignmentSelect.value = assignmentName;
            assignmentSelect.dispatchEvent(new Event('change'));
        }, 500);
    }
    
    
    // ===== 标签页切换逻辑 =====
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            console.log(`点击标签按钮: ${button.id}`);
            
            // 使用直接映射而不是字符串替换，以确保准确匹配
            const tabMapping = {
                'tabUpload': 'uploadTab',
                'tabAssignmentsList': 'assignmentsListTab',
                'tabSubmissions': 'submissionsTab',
                'tabProfile': 'profileTab',
                'tabMaterials': 'materialsTab',
            };
            
            const tabContentId = tabMapping[button.id];
            console.log(`映射到的内容ID: ${tabContentId}`);
            
            // 安全检查
            if (!tabContentId) {
                console.error(`找不到与按钮ID "${button.id}" 对应的标签页内容元素`);
                return;
            }
            
            // 更新按钮样式
            tabButtons.forEach(btn => {
                btn.classList.remove('text-blue-600', 'border-blue-500');
                btn.classList.add('text-gray-500', 'border-transparent');
                btn.classList.remove('active');
            });
            
            button.classList.remove('text-gray-500', 'border-transparent');
            button.classList.add('text-blue-600', 'border-blue-500');
            button.classList.add('active');

            // 切换标签页内容
            tabContents.forEach(content => {
                content.classList.remove('active');
            });
            
            const targetTab = document.getElementById(tabContentId);
            if (targetTab) {
                targetTab.classList.add('active');
                
                // 如果切换到"我的提交"标签页，加载提交记录
                if (tabContentId === 'submissionsTab') {
                    console.log("切换到我的提交标签页，加载提交记录");
                    loadMySubmissions();
                }
                
                // 如果切换到"作业列表"标签页，加载所有作业
                if (tabContentId === 'assignmentsListTab') {
                    console.log("切换到作业列表标签页，加载所有作业");
                    loadAllAssignments();
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
            
            // 禁用作业名称下拉框
            assignmentSelect.disabled = true;
            
            // 隐藏作业信息
            assignmentInfo.classList.add('hidden');
            
            if (selectedCourse) {
                // 启用作业名称下拉框
                assignmentSelect.disabled = false;
                
                // 从服务器获取选中课程的作业列表
                // 注意：现在API期望接收class_name参数，但前端已经不需要选择班级
                // 因为后端API会自动使用当前用户的班级
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

// 班级选择事件
const classSelect = document.getElementById('class_name');
if (classSelect) {
    classSelect.addEventListener('change', function() {
        const selectedCourse = courseSelect.value;
        const selectedClass = this.value;
        
        // 清空作业名称下拉框
        assignmentSelect.innerHTML = '';
        
        // 隐藏作业信息
        assignmentInfo.classList.add('hidden');
        
        if (selectedCourse && selectedClass) {
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
            option.textContent = '请先选择课程和班级';
            assignmentSelect.appendChild(option);
        }
        
        // 更新上传按钮状态
        updateUploadButtonState();
    });
}

// 作业选择事件 - 加载作业统计信息
// 作业选择事件 - 加载作业统计信息
/**
 * 更新作业限制信息显示
 * @param {Object} settings - 作业高级设置信息
 */
function updateAssignmentLimits(settings) {
    // 更新文件大小限制
    const maxFileSizeElement = document.getElementById('maxFileSize');
    if (maxFileSizeElement) {
        const sizeValue = settings.maxFileSize || 256;
        const sizeUnit = settings.fileSizeUnit || 'MB';
        maxFileSizeElement.textContent = `文件大小: 最大 ${sizeValue} ${sizeUnit}`;
    }
    
    // 更新文件数量限制
    const maxFileCountElement = document.getElementById('maxFileCount');
    if (maxFileCountElement) {
        const countValue = settings.maxFileCount || 10;
        maxFileCountElement.textContent = `文件数量: 最多 ${countValue} 个`;
    }
    
    // 更新每日上传限额
    const dailyQuotaElement = document.getElementById('dailyQuota');
    if (dailyQuotaElement) {
        const quotaValue = settings.dailyQuota || 1;
        dailyQuotaElement.textContent = `每日限额: ${quotaValue} GB`;
    }
    
    // 更新允许的文件类型
    const allowedTypesElement = document.getElementById('allowedTypes');
    const fileTypesTagsElement = document.getElementById('fileTypesTags');
    
    if (allowedTypesElement) {
        allowedTypesElement.textContent = '允许的文件类型';
    }
    
    if (fileTypesTagsElement) {
        // 清空现有标签
        fileTypesTagsElement.innerHTML = '';
        
        // 添加文件类型标签
        const allowedTypes = settings.allowedTypes || [];
        
        if (allowedTypes.length === 0 || (allowedTypes.length > 20)) {
            // 如果没有限制文件类型或类型太多，显示"全部类型"
            const allTypesTag = document.createElement('span');
            allTypesTag.className = 'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800';
            allTypesTag.textContent = '全部类型';
            fileTypesTagsElement.appendChild(allTypesTag);
        } else {
            // 创建文件类型映射
            const typeMap = {
                // 文档类型
                'pdf': { group: '文档', color: 'bg-red-100 text-red-800' },
                'doc': { group: '文档', color: 'bg-blue-100 text-blue-800' },
                'docx': { group: '文档', color: 'bg-blue-100 text-blue-800' },
                'txt': { group: '文档', color: 'bg-gray-100 text-gray-800' },
                
                // 表格类型
                'xls': { group: '表格', color: 'bg-green-100 text-green-800' },
                'xlsx': { group: '表格', color: 'bg-green-100 text-green-800' },
                'csv': { group: '表格', color: 'bg-green-100 text-green-800' },
                
                // 演示文稿
                'ppt': { group: '演示文稿', color: 'bg-orange-100 text-orange-800' },
                'pptx': { group: '演示文稿', color: 'bg-orange-100 text-orange-800' },
                
                // 图片类型
                'jpg': { group: '图片', color: 'bg-purple-100 text-purple-800' },
                'jpeg': { group: '图片', color: 'bg-purple-100 text-purple-800' },
                'png': { group: '图片', color: 'bg-purple-100 text-purple-800' },
                'gif': { group: '图片', color: 'bg-purple-100 text-purple-800' },
                'bmp': { group: '图片', color: 'bg-purple-100 text-purple-800' },
                
                // 压缩文件
                'zip': { group: '压缩文件', color: 'bg-yellow-100 text-yellow-800' },
                'rar': { group: '压缩文件', color: 'bg-yellow-100 text-yellow-800' },
                '7z': { group: '压缩文件', color: 'bg-yellow-100 text-yellow-800' },
                
                // 其他常见格式
                'py': { group: '代码', color: 'bg-indigo-100 text-indigo-800' },
                'java': { group: '代码', color: 'bg-indigo-100 text-indigo-800' },
                'js': { group: '代码', color: 'bg-indigo-100 text-indigo-800' },
                'html': { group: '代码', color: 'bg-indigo-100 text-indigo-800' },
                'css': { group: '代码', color: 'bg-indigo-100 text-indigo-800' }
            };
            
            // 创建分组用的集合
            const groupedTypes = {};
            
            // 对类型进行分组
            allowedTypes.forEach(type => {
                const typeInfo = typeMap[type] || { group: '其他', color: 'bg-gray-100 text-gray-800' };
                if (!groupedTypes[typeInfo.group]) {
                    groupedTypes[typeInfo.group] = {
                        types: [],
                        color: typeInfo.color
                    };
                }
                groupedTypes[typeInfo.group].types.push(type);
            });
            
            // 添加分组标签
            Object.entries(groupedTypes).forEach(([group, info]) => {
                const tag = document.createElement('span');
                tag.className = `inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${info.color}`;
                tag.textContent = group;
                tag.title = info.types.map(t => `.${t}`).join(', ');
                fileTypesTagsElement.appendChild(tag);
                
                // 为较长的类型列表添加单独的标签
                if (info.types.length > 5) {
                    info.types.forEach(type => {
                        const typeTag = document.createElement('span');
                        typeTag.className = `inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${info.color}`;
                        typeTag.textContent = `.${type}`;
                        fileTypesTagsElement.appendChild(typeTag);
                    });
                }
            });
            
            // 对于未分组的类型，单独添加标签
            const ungroupedTypes = allowedTypes.filter(type => !Object.keys(typeMap).includes(type));
            ungroupedTypes.forEach(type => {
                const tag = document.createElement('span');
                tag.className = 'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800';
                tag.textContent = `.${type}`;
                fileTypesTagsElement.appendChild(tag);
            });
        }
    }
}

/**
 * 对文件类型进行分组
 * @param {Array} types - 文件类型数组
 * @returns {Object} - 分组后的文件类型
 */
function groupFileTypes(types) {
    const knownTypes = getKnownFileTypes();
    const groups = {};
    
    // 检查每个分组是否完全包含在允许的类型中
    Object.entries(knownTypes).forEach(([group, groupTypes]) => {
        if (groupTypes.every(type => types.includes(type))) {
            groups[group] = groupTypes;
        }
    });
    
    return groups;
}

/**
 * 获取已知文件类型分组
 * @returns {Object} - 已知文件类型分组
 */
function getKnownFileTypes() {
    return {
        '文档': ['pdf', 'doc', 'docx', 'txt'],
        '表格': ['xls', 'xlsx', 'csv'],
        '演示文稿': ['ppt', 'pptx'],
        '图片': ['jpg', 'jpeg', 'png', 'gif', 'bmp'],
        '压缩文件': ['zip', 'rar', '7z'],
    };
}

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
                            assignmentStatus.classList.remove('text-blue-600');
                        } else {
                            assignmentStatus.classList.add('text-blue-600');
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
            
        // 获取作业高级设置信息
        fetch(`/get_assignment_settings?class_name=${classSelect.value}&course=${encodeURIComponent(selectedCourse)}&assignment=${encodeURIComponent(selectedAssignment)}`)
            .then(response => response.json())
            .then(data => {
                if (data.settings) {
                    // 更新作业限制信息
                    updateAssignmentLimits(data.settings);
                }
            })
            .catch(error => {
                console.error('获取作业设置信息失败:', error);
            });
            
        // 获取作业详细信息（包含描述）
        fetch(`/get_assignment_details?class_name=${classSelect.value}&course=${encodeURIComponent(selectedCourse)}&assignment=${encodeURIComponent(selectedAssignment)}`)
            .then(response => response.json())
            .then(data => {
                if (data.assignment && data.assignment.description) {
                    // 更新作业描述
                    const descriptionElement = document.getElementById('assignmentDescription');
                    if (descriptionElement) {
                        descriptionElement.textContent = data.assignment.description;
                        descriptionElement.classList.remove('italic');
                    }
                } else {
                    // 如果没有描述，显示默认提示
                    const descriptionElement = document.getElementById('assignmentDescription');
                    if (descriptionElement) {
                        descriptionElement.textContent = '暂无作业描述...';
                        descriptionElement.classList.add('italic');
                    }
                }
            })
            .catch(error => {
                console.error('获取作业详情失败:', error);
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
        
        // 获取当前选择的作业信息
        const course = courseSelect.value;
        const assignment = assignmentSelect.value;
        
        if (!course || !assignment) {
            showToast('请先选择课程和作业', 'error');
            return;
        }
        
        // 获取作业的高级设置
        fetchAssignmentSettings(course, assignment)
            .then(settings => {
                // 验证文件数量限制
                if (settings.maxFileCount && (selectedFiles.length + files.length) > settings.maxFileCount) {
                    showToast(`此作业最多允许上传 ${settings.maxFileCount} 个文件`, 'error');
                    return;
                }
                
                // 验证文件类型和大小
                const invalidFiles = [];
                const oversizedFiles = [];
                
                for (let i = 0; i < files.length; i++) {
                    const file = files[i];
                    
                    // 验证文件类型
                    const fileExtension = file.name.split('.').pop().toLowerCase();
                    if (settings.allowedTypes && settings.allowedTypes.length > 0 && 
                        !settings.allowedTypes.includes(fileExtension)) {
                        invalidFiles.push(file.name);
                        continue;
                    }
                    
                    // 验证文件大小
                    const maxSizeBytes = settings.maxFileSize * 
                        (settings.fileSizeUnit === 'GB' ? 1024 * 1024 * 1024 : 1024 * 1024);
                    if (file.size > maxSizeBytes) {
                        oversizedFiles.push(file.name);
                        continue;
                    }
                    
                    // 文件验证通过，添加到上传列表
                    addFileToList(file);
                }
                
                // 显示错误信息
                if (invalidFiles.length > 0) {
                    showToast(`以下文件类型不被允许: ${invalidFiles.join(', ')}`, 'error');
                }
                
                if (oversizedFiles.length > 0) {
                    const sizeLimit = `${settings.maxFileSize} ${settings.fileSizeUnit}`;
                    showToast(`以下文件超过大小限制(${sizeLimit}): ${oversizedFiles.join(', ')}`, 'error');
                }
                
                // 更新上传按钮状态
                updateUploadButtonState();
            })
            .catch(error => {
                console.error('获取作业设置失败:', error);
                
                // 如果无法获取设置，使用默认验证
                for (let i = 0; i < files.length; i++) {
                    addFileToList(files[i]);
                }
                
                // 更新上传按钮状态
                updateUploadButtonState();
            });
    }

    // 获取作业高级设置
    async function fetchAssignmentSettings(course, assignment) {
        try {
            const response = await fetch(`/get_assignment_settings?course=${encodeURIComponent(course)}&assignment=${encodeURIComponent(assignment)}`);
            if (!response.ok) {
                throw new Error('获取作业设置失败');
            }
            const data = await response.json();
            return data.settings || getDefaultSettings();
        } catch (error) {
            console.error('Error fetching assignment settings:', error);
            return getDefaultSettings();
        }
    }

    // 默认设置
    function getDefaultSettings() {
        return {
            maxFileCount: 10,
            maxFileSize: 256,
            fileSizeUnit: 'MB',
            dailyQuota: 1,
            allowedTypes: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'jpg', 'jpeg', 'png', 'gif', 'zip', 'rar', 'txt', 'csv'],
            enableGrading: false,
            enableFeedback: false
        };
    }

    // 添加文件到列表
    function addFileToList(file) {
        // 检查文件类型
        // 默认允许所有类型，但在作业配置中会有限制
        // const fileExtension = file.name.split('.').pop().toLowerCase();
        // const allowedExtensions = ['txt', 'pdf', 'png', 'jpg', 'jpeg', 'gif', 'doc', 'docx', 'xls', 'xlsx', 'zip', 'rar', 'mp3', 'mp4', 'csv', 'ppt', 'pptx'];

        // if (!allowedExtensions.includes(fileExtension)) {
        //     showToast(`不支持的文件类型: ${file.name}`, 'error');
        //     return;
        // }
        
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
                
                // 修复下载路径 - 使用正确的API路由
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
                            href="/download/${encodeURIComponent(submission.course)}/${encodeURIComponent(submission.assignmentName)}/${encodeURIComponent(file.name)}" 
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
        closeMySubmissionDetailBtn.addEventListener('click', closeSubmissionDetailModal);
    }
    
    // 下载提交记录事件
    if (downloadSubmissionBtn) {
        downloadSubmissionBtn.addEventListener('click', () => {
            if (currentSubmissionDetail) {
                // 修复下载所有文件的URL路径
                window.location.href = `/download_all/${encodeURIComponent(currentSubmissionDetail.course)}/${encodeURIComponent(currentSubmissionDetail.assignmentName)}`;
            }
        });
    }
    
    // 替换提交记录事件（此处仅做提示，替换逻辑可根据需要扩展）
    if (replaceSubmissionBtn) {
        replaceSubmissionBtn.addEventListener('click', () => {
            if (currentSubmissionDetail) {
                // 设置上传表单的课程和作业
                if (courseSelect && assignmentSelect) {
                    // 切换到上传标签页
                    document.getElementById('tabUpload').click();
                    
                    // 设置课程选择
                    courseSelect.value = currentSubmissionDetail.course;
                    // 触发change事件来加载作业
                    const event = new Event('change');
                    courseSelect.dispatchEvent(event);
                    
                    // 需要等待作业列表加载完成后再选择
                    setTimeout(() => {
                        assignmentSelect.value = currentSubmissionDetail.assignmentName;
                        // 触发change事件来加载作业信息
                        assignmentSelect.dispatchEvent(event);
                        
                        // 滚动到顶部
                        window.scrollTo(0, 0);
                        
                        // 提示用户
                        showToast('请选择文件重新上传以替换提交', 'success');
                    }, 500);
                } else {
                    showToast('无法替换提交，请手动选择课程和作业', 'error');
                }
            }
        });
    }
    function showConfirmDialog(title, message, confirmCallback) {
        // 检查是否已存在确认框，如果存在则先移除
        let existingDialog = document.getElementById('confirmDialog');
        if (existingDialog) {
            document.body.removeChild(existingDialog);
        }
        
        // 创建确认对话框元素
        const dialog = document.createElement('div');
        dialog.id = 'confirmDialog';
        dialog.className = 'fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50';
        dialog.innerHTML = `
            <div class="bg-white rounded-lg shadow-xl max-w-md w-full p-6 transform transition-all duration-300 ease-in-out" 
                 style="animation: dialogFadeIn 0.3s;">
                <div class="text-center">
                    <div class="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
                        <svg class="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <h3 class="text-lg font-medium text-gray-900 mb-2">${title}</h3>
                    <p class="text-sm text-gray-500 mb-6">${message}</p>
                    <div class="flex justify-center space-x-4">
                        <button id="cancelBtn" class="py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                            取消
                        </button>
                        <button id="confirmBtn" class="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500">
                            确认删除
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        // 添加CSS动画
        const style = document.createElement('style');
        style.textContent = `
            @keyframes dialogFadeIn {
                from { opacity: 0; transform: translateY(-20px); }
                to { opacity: 1; transform: translateY(0); }
            }
        `;
        document.head.appendChild(style);
        
        // 添加到页面
        document.body.appendChild(dialog);
        
        // 添加事件监听
        document.getElementById('cancelBtn').addEventListener('click', () => {
            closeConfirmDialog();
        });
        
        document.getElementById('confirmBtn').addEventListener('click', () => {
            closeConfirmDialog();
            if (confirmCallback) confirmCallback();
        });
        
        // 点击背景关闭
        dialog.addEventListener('click', (e) => {
            if (e.target === dialog) {
                closeConfirmDialog();
            }
        });
        
        // 添加ESC键关闭
        document.addEventListener('keydown', handleEscKey);
        
        function handleEscKey(e) {
            if (e.key === 'Escape') {
                closeConfirmDialog();
                document.removeEventListener('keydown', handleEscKey);
            }
        }
        
        // 关闭对话框函数
        function closeConfirmDialog() {
            dialog.style.opacity = '0';
            dialog.style.transform = 'translateY(-20px)';
            
            setTimeout(() => {
                if (dialog.parentNode) {
                    document.body.removeChild(dialog);
                }
                document.removeEventListener('keydown', handleEscKey);
            }, 300);
        }
    }
    
    // 关闭提交详情弹窗
    function closeSubmissionDetailModal() {
        mySubmissionDetailModal.classList.add('hidden');
        currentSubmissionDetail = null;
    }
    
    // 删除提交记录函数
    function deleteSubmission(course, assignment) {
        // 创建并显示自定义确认对话框
        showConfirmDialog(
            `确定要删除 ${course} - ${assignment} 的提交记录吗？`, 
            "此操作不可恢复",
            () => {
                // 用户确认后执行删除
                fetch(`/delete_submission/${encodeURIComponent(course)}/${encodeURIComponent(assignment)}`, {
                    method: 'DELETE'
                })
                .then(response => response.json())
                .then(data => {
                    if (data.status === 'success') {
                        showToast('提交记录删除成功', 'success');
                        loadMySubmissions();
                        // 如果当前正在查看被删除的提交的详情，则关闭详情弹窗
                        if (
                            currentSubmissionDetail && 
                            currentSubmissionDetail.course === course && 
                            currentSubmissionDetail.assignmentName === assignment
                        ) {
                            closeSubmissionDetailModal();
                        }
                    } else {
                        showToast(data.message || '删除失败', 'error');
                    }
                })
                .catch(error => {
                    console.error('删除提交记录失败:', error);
                    showToast('删除提交记录失败', 'error');
                });
            }
        );
    }
    
    // 监听“我的提交”课程筛选器变化，刷新提交列表
    if (mySubmissionCourseFilter) {
        mySubmissionCourseFilter.addEventListener('change', loadMySubmissions);
    }
    
    // 个人设置表单提交事件
    // 在个人设置表单提交事件中添加更好的错误处理
    if (profileForm) {
        profileForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const name = profileName.value;
            const currentPassword = profileCurrentPassword.value;
            const newPassword = profileNewPassword.value;
            const confirmPassword = profileConfirmPassword.value;
            
            // 添加基本验证
            if (newPassword && !currentPassword) {
                showToast('更改密码时必须输入当前密码', 'error');
                return;
            }
            
            if (newPassword !== confirmPassword) {
                showToast('新密码与确认密码不一致', 'error');
                return;
            }
            
            // 显示加载状态
            const submitBtn = profileForm.querySelector('button[type="submit"]');
            const originalBtnText = submitBtn.innerHTML;
            submitBtn.disabled = true;
            submitBtn.innerHTML = `
                <svg class="animate-spin h-4 w-4 mr-2 inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                更新中...
            `;
            
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
                // 恢复按钮状态
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalBtnText;
                
                if (data.status === 'success') {
                    // 清空密码字段
                    profileCurrentPassword.value = '';
                    profileNewPassword.value = '';
                    profileConfirmPassword.value = '';
                    
                    showToast(data.message || '个人设置更新成功', 'success');
                    
                    // 检查是否需要重新登录
                    if (data.requireRelogin) {
                        setTimeout(() => {
                            showToast('用户名已更改，3秒后将跳转到登录页面', 'success');
                            setTimeout(() => {
                                window.location.href = '/logout';
                            }, 3000);
                        }, 1000);
                    }
                } else {
                    showToast(data.message || '更新失败', 'error');
                }
            })
            .catch(error => {
                console.error('更新个人设置失败:', error);
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalBtnText;
                showToast('网络错误，请稍后重试', 'error');
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

    // 添加空值检查
    if (courseDropdown && courseInput && assignmentDropdown && assignmentInput) {
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
    }

    // 初始化自定义下拉菜单函数
    function initCustomDropdowns() {
    // 获取所有自定义下拉菜单
    const dropdowns = document.querySelectorAll('.custom-dropdown');
    if (!dropdowns || dropdowns.length === 0) {
        console.log('页面上没有找到自定义下拉菜单元素');
        return; // 如果没有找到元素，提前退出函数
    }
      
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