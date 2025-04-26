/**
 * assignment-chart.js - Assignment submission chart module
 * 
 * This script adds interactive submission charts to the assignment list.
 * It creates a popover chart for each assignment showing submission trends
 * using real data from the backend API.
 * 
 * Dependencies:
 * - ApexCharts.js (for charts)
 */

document.addEventListener('DOMContentLoaded', function() {
    // First, ensure we have ApexCharts available
    loadDependencies();
    
    // Add event listener for tab navigation
    const tabButton = document.getElementById('tabAssignmentsList');
    if (tabButton) {
        tabButton.addEventListener('click', function() {
            // When the assignments tab is clicked, wait for content to load then init charts
            setTimeout(initSubmissionCharts, 800);
        });
    }
    
    // Also try to initialize on page load in case we're starting on the assignments tab
    setTimeout(initSubmissionCharts, 1000);
    
    // Add event listener for the refresh button
    const refreshBtn = document.getElementById('refreshAssignmentsBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', function() {
            // Wait longer after refresh since it needs to fetch data
            setTimeout(initSubmissionCharts, 1200);
        });
    }
    
    // Add click event on document to close any open popovers when clicking outside
    document.addEventListener('click', function(e) {
        const popovers = document.querySelectorAll('.popover-chart:not(.hidden)');
        const chartButtons = document.querySelectorAll('.chart-button');
        
        // Check if the click is outside any popover and chart button
        let outsideClick = true;
        
        // Check if clicked on a chart button
        chartButtons.forEach(button => {
            if (button.contains(e.target)) {
                outsideClick = false;
            }
        });
        
        // Check if clicked inside a popover
        popovers.forEach(popover => {
            if (popover.contains(e.target)) {
                outsideClick = false;
            }
        });
        
        // If click is outside, close all popovers
        if (outsideClick) {
            closeAllPopovers();
        }
    });
});

/**
 * Close all open popovers
 */
function closeAllPopovers() {
    const popovers = document.querySelectorAll('.popover-chart:not(.hidden)');
    popovers.forEach(popover => {
        popover.style.opacity = '0';
        popover.style.visibility = 'hidden';
        setTimeout(() => {
            popover.classList.add('hidden');
        }, 300);
    });
}

/**
 * Load required dependencies if not already available
 */
function loadDependencies() {
    // Load ApexCharts if not already loaded
    if (typeof ApexCharts === 'undefined') {
        console.log('Loading ApexCharts...');
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/apexcharts@3.44.0/dist/apexcharts.min.js';
        script.onload = function() {
            console.log('ApexCharts loaded successfully');
            initSubmissionCharts();
        };
        script.onerror = function() {
            console.error('Failed to load ApexCharts');
        };
        document.head.appendChild(script);
    }
}

/**
 * Initialize submission charts for all assignments in the list
 */
function initSubmissionCharts() {
    console.log('Initializing submission charts...');
    const assignmentList = document.getElementById('assignmentsListBody');
    
    if (!assignmentList) {
        console.log('Assignment list not found in DOM');
        return;
    }
    
    // Wait for skeleton loaders to be replaced with actual content
    if (assignmentList.querySelector('.skeleton-row')) {
        console.log('Skeleton loaders still present, waiting...');
        setTimeout(initSubmissionCharts, 500);
        return;
    }
    
    const assignments = assignmentList.querySelectorAll('tr:not(.skeleton-row)');
    if (assignments.length === 0) {
        console.log('No assignment rows found');
        return;
    }
    
    console.log(`Found ${assignments.length} assignment rows`);
    addChartsToAssignments(assignments);
}

/**
 * Add chart buttons and popovers to assignment rows
 * @param {NodeList} assignments - Assignment rows in the table
 */
function addChartsToAssignments(assignments) {
    assignments.forEach((row, index) => {
        // Skip if this row already has a chart button
        if (row.querySelector('.chart-button')) {
            return;
        }
        
        // Skip if the row contains "没有匹配的作业" (no matching assignments)
        if (row.textContent.includes('没有匹配的作业')) {
            return;
        }
        
        // Extract assignment data from the row
        const course = row.cells[0]?.textContent?.trim() || '';
        const assignment = row.cells[1]?.textContent?.trim() || '';
        
        // Extract submission stats from the row
        const submissionCell = row.cells[4];
        if (!submissionCell) {
            console.log('Submission cell not found in row', index);
            return;
        }
        
        const submissionCount = submissionCell.textContent?.trim() || '';
        // Extract number of submissions (e.g., "5/20 (25%)" -> 5)
        const submissionMatch = submissionCount.match(/(\d+)\/(\d+)/);
        const submissionNumber = submissionMatch ? parseInt(submissionMatch[1]) : 0;
        const totalStudents = submissionMatch ? parseInt(submissionMatch[2]) : 0;
        
        // Get class name from user data or data attribute
        const className = document.getElementById('user_class_name')?.textContent?.trim() || 
                          document.getElementById('class_name')?.value || '';
        
        // Create unique IDs for this assignment's popover and chart
        const assignmentId = `assignment-${index}-${Date.now()}`;
        const popoverId = `popover-${assignmentId}`;
        const chartId = `chart-${assignmentId}`;
        
        // Create chart button
        const chartButton = createChartButton(popoverId);
        
        // Create popover content with chart
        const popoverContent = createPopoverContent(chartId, popoverId, course, assignment, submissionNumber, totalStudents);
        
        // Add button to the actions cell (last column)
        const actionsCell = row.cells[row.cells.length - 1];
        if (actionsCell) {
            // Insert chart button before the existing action button
            const existingButton = actionsCell.querySelector('button');
            if (existingButton) {
                actionsCell.insertBefore(chartButton, existingButton);
            } else {
                actionsCell.appendChild(chartButton);
            }
            
            // Add the popover to the document body
            document.body.appendChild(popoverContent);
            
            // Create custom toggle behavior for better positioning
            chartButton.addEventListener('mouseenter', function(e) {
                // Position the popover above the button
                positionPopover(popoverContent, chartButton);
                
                // Show the popover
                popoverContent.classList.remove('hidden');
                setTimeout(() => {
                    popoverContent.style.opacity = '1';
                    popoverContent.style.visibility = 'visible';
                }, 50);
                
                // Fetch and load real data
                fetchAndRenderChart(chartId, course, assignment, className);
            });
            
            // Hide popover on mouse leave
            chartButton.addEventListener('mouseleave', function(e) {
                // Check if mouse is moving to popover
                const rect = popoverContent.getBoundingClientRect();
                if (e.clientX >= rect.left && e.clientX <= rect.right && 
                    e.clientY >= rect.top && e.clientY <= rect.bottom) {
                    return; // Moving to popover, don't hide
                }
                
                // Add a small delay to allow moving to popover
                setTimeout(() => {
                    // Fixed: Using event parameter from the mouseenter event won't work here
                    // We need to check current mouse position
                    if (!isMouseOverElement(popoverContent)) {
                        hidePopover(popoverContent);
                    }
                }, 100);
            });
            
            // Handle mouse leave from popover
            popoverContent.addEventListener('mouseleave', function() {
                // Fixed: Using event parameter from the mouseenter event won't work here
                if (!isMouseOverElement(chartButton)) {
                    hidePopover(popoverContent);
                }
            });
        }
    });
}

/**
 * Check if mouse is currently over an element
 * @param {HTMLElement} element - Element to check
 * @returns {boolean} - True if mouse is over element
 */
function isMouseOverElement(element) {
    if (!element) return false;
    
    // Get current mouse position - using global event won't work
    // Instead, we compare the element's position with the current mouse position
    const rect = element.getBoundingClientRect();
    
    // Get current mouse position from the mousemove event
    // We'll need to track mouse position globally
    const mouseX = window.mouseX || 0;
    const mouseY = window.mouseY || 0;
    
    return (mouseX >= rect.left && mouseX <= rect.right && mouseY >= rect.top && mouseY <= rect.bottom);
}

// Track mouse position globally
document.addEventListener('mousemove', function(e) {
    window.mouseX = e.clientX;
    window.mouseY = e.clientY;
});

/**
 * Position popover above the button
 * @param {HTMLElement} popover - Popover element
 * @param {HTMLElement} button - Button element
 */
function positionPopover(popover, button) {
    const buttonRect = button.getBoundingClientRect();
    const popoverRect = popover.getBoundingClientRect();
    
    // Position popover above the button with some padding
    const top = buttonRect.top - popoverRect.height - 10;
    const left = buttonRect.left + (buttonRect.width / 2) - (popoverRect.width / 2);
    
    // Adjust position to ensure popover stays within viewport
    const adjustedTop = Math.max(10, top); // Keep 10px from top of viewport
    const adjustedLeft = Math.max(10, Math.min(left, window.innerWidth - popoverRect.width - 10));
    
    popover.style.position = 'fixed';
    popover.style.top = `${adjustedTop}px`;
    popover.style.left = `${adjustedLeft}px`;
    
    // Position arrow
    const arrow = popover.querySelector('.popover-arrow');
    if (arrow) {
        const arrowLeft = buttonRect.left + (buttonRect.width / 2) - adjustedLeft;
        arrow.style.left = `${arrowLeft}px`;
    }
}

/**
 * Hide popover with transition
 * @param {HTMLElement} popover - Popover element
 */
function hidePopover(popover) {
    popover.style.opacity = '0';
    popover.style.visibility = 'hidden';
    setTimeout(() => {
        popover.classList.add('hidden');
    }, 300);
}

/**
 * Create a chart button element
 * @param {string} popoverId - ID of the popover to trigger
 * @returns {HTMLElement} - Button element
 */
function createChartButton(popoverId) {
    const button = document.createElement('button');
    button.className = 'chart-button text-gray-500 hover:text-blue-600 mr-3';
    button.setAttribute('type', 'button');
    button.setAttribute('title', '提交趋势');
    button.setAttribute('aria-describedby', popoverId);
    button.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>';
    return button;
}

/**
 * Create popover content with chart
 * @param {string} chartId - ID for the chart element
 * @param {string} popoverId - ID for the popover element
 * @param {string} course - Course name
 * @param {string} assignment - Assignment name
 * @param {number} submissionCount - Current submission count
 * @param {number} totalStudents - Total student count
 * @returns {HTMLElement} - Popover content element
 */
function createPopoverContent(chartId, popoverId, course, assignment, submissionCount, totalStudents) {
    const popover = document.createElement('div');
    popover.id = popoverId;
    popover.setAttribute('role', 'tooltip');
    popover.className = 'absolute z-50 hidden transition-opacity duration-300 bg-white border border-gray-200 rounded-lg shadow-lg dark:text-gray-400 dark:bg-gray-800 dark:border-gray-600 popover-chart';
    popover.style.width = '320px';
    popover.style.opacity = '0';
    popover.style.visibility = 'hidden';
    
    popover.innerHTML = `
        <div class="p-3">
            <div class="flex justify-between mb-2">
                <div class="mb-2">
                    <h5 class="text-xl font-bold leading-none text-gray-900 dark:text-white">
                        ${course} ${submissionCount}/${totalStudents}
                    </h5>
                    <p class="text-sm font-normal text-gray-500">提交数量</p>
                </div>
                <div class="chart-trend-indicator">
                    <div class="flex items-center text-gray-400">
                        <span class="font-semibold text-sm">加载中...</span>
                    </div>
                </div>
            </div>
            
            <div id="${chartId}" class="h-40 w-full chart-container">
                <div class="flex justify-center items-center h-full">
                    <div class="animate-spin h-5 w-5 border-2 border-blue-500 rounded-full border-t-transparent"></div>
                    <span class="ml-2 text-sm text-gray-500">加载数据中...</span>
                </div>
            </div>
            
            <div class="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                <a href="admin" class="text-xs font-medium text-blue-600 hover:underline dark:text-blue-500">查看详细提交数据</a>
            </div>
        </div>
        <div data-popper-arrow class="popover-arrow absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-4 h-4 bg-white border-r border-b border-gray-200 dark:bg-gray-800 dark:border-gray-600 rotate-45"></div>
    `;
    
    return popover;
}

/**
 * Fetch submission data from API and render chart
 * @param {string} chartId - ID of the chart container
 * @param {string} course - Course name
 * @param {string} assignment - Assignment name 
 * @param {string} className - Class name
 */
function fetchAndRenderChart(chartId, course, assignment, className) {
    const chartElement = document.getElementById(chartId);
    if (!chartElement) {
        console.log(`Chart element with ID ${chartId} not found`);
        return;
    }
    
    // Check if chart is already initialized
    if (chartElement.querySelector('.apexcharts-canvas')) {
        console.log(`Chart ${chartId} already initialized`);
        return;
    }
    
    // Prepare API URL with parameters
    let apiUrl = `/api/assignment_submission_stats?course=${encodeURIComponent(course)}&assignment=${encodeURIComponent(assignment)}`;
    if (className) {
        apiUrl += `&class_name=${encodeURIComponent(className)}`;
    }
    
    // Fetch data from API
    fetch(apiUrl)
        .then(response => {
            if (!response.ok) {
                throw new Error(`API returned status ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (data.status !== 'success') {
                throw new Error(data.message || 'API返回错误');
            }
            
            // Render chart with real data
            renderChartWithData(chartId, data.data);
        })
        .catch(error => {
            console.error(`Error fetching chart data for ${course} - ${assignment}:`, error);
            chartElement.innerHTML = `
                <div class="flex flex-col items-center justify-center h-full p-2">
                    <svg class="w-6 h-6 text-red-500 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                    <p class="text-xs text-center text-gray-500">加载数据失败</p>
                </div>
            `;
        });
}

/**
 * Render chart with real data and update summary & trend
 * @param {string} chartId - ID of the chart container
 * @param {Object} statsData - Statistics data from API, expected to include:
 *   - dailySubmissions: Array<{ date: string, day: string, count: number }>
 *   - totalStudents: number
 */
function renderChartWithData(chartId, statsData) {
    const chartElement = document.getElementById(chartId);
    if (!chartElement) return;
    const popover = chartElement.closest('[role="tooltip"]');
    if (!popover) return;
  
    // —— 1. 计算今日/昨日提交数 —— 
    const data = [...statsData.dailySubmissions]
    .sort((a, b) => new Date(a.date) - new Date(b.date));
    const counts = data.map(d => d.count);
    const totalSubmissions = statsData.totalSubmissions || 0;
    const todayCount     = counts[counts.length - 1] || 0;
    const yesterdayCount = counts[counts.length - 2] || 0;
  
    // —— 2. 获取总人数 —— 
    const totalStudents = (statsData.totalStudents != null)
      ? statsData.totalStudents
      : 0;
  
      // 取出课程名
    const courseName = chartElement.dataset.course || '';

    // 更新左上角：课程 + “1/3”
    const summaryEl = popover.querySelector('h5');
    if (summaryEl) {
        summaryEl.textContent = `${totalSubmissions}/${totalStudents}`;
    }
  
    // —— 4. 计算并更新趋势百分比 —— 
    let pct;
    if (yesterdayCount === 0) {
      pct = (todayCount === 0 ? 0 : 100);
    } else {
      pct = Math.round(((todayCount - yesterdayCount) / yesterdayCount) * 100);
    }
  
    const trendEl = popover.querySelector('.chart-trend-indicator');
    if (trendEl) {
      const isUp   = pct > 0;
      const isDown = pct < 0;
      const colorClass = isUp
        ? 'text-green-500'
        : isDown
          ? 'text-red-500'
          : 'text-gray-400';
  
      const arrowUpSvg = `
        <svg class="w-3 h-3 ms-1" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"
             fill="none" viewBox="0 0 10 14">
          <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M5 13V1m0 0L1 5m4-4 4 4"/>
        </svg>`;
      const arrowDownSvg = `
        <svg class="w-3 h-3 ms-1 rotate-180" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"
             fill="none" viewBox="0 0 10 14">
          <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M5 13V1m0 0L1 5m4-4 4 4"/>
        </svg>`;
  
      trendEl.innerHTML = `
        <div class="flex items-center ${colorClass}">
          <span class="font-semibold text-sm">${Math.abs(pct)}%</span>
          ${isUp ? arrowUpSvg : isDown ? arrowDownSvg : ''}
        </div>`;
    }
  
    // —— 5. 如果已渲染则跳过 —— 
    if (chartElement.querySelector('.apexcharts-canvas')) {
      console.log(`Chart ${chartId} already initialized`);
      return;
    }
  
    // —— 6. 准备图表数据并渲染 —— 
    const chartData = prepareChartData(statsData.dailySubmissions);
    chartElement.innerHTML = '';
  
    const options = {
      series: [{
        name: '提交数量',
        data: chartData.counts
      }],
      chart: {
        height: 180,
        type: 'area',
        fontFamily: 'Inter, sans-serif',
        toolbar: { show: false },
        animations: {
          enabled: true,
          easing: 'easeinout',
          speed: 800,
          animateGradually: { enabled: true, delay: 150 },
          dynamicAnimation: { enabled: true, speed: 350 }
        }
      },
      fill: {
        type: "gradient",
        gradient: {
          opacityFrom: 0.55,
          opacityTo: 0,
          shade: "#1C64F2",
          gradientToColors: ["#1C64F2"],
        },
      },
      dataLabels: { enabled: false },
      stroke: { curve: 'smooth', width: 3 },
      markers: { size: 4, strokeWidth: 0, hover: { size: 6 } },
      xaxis: {
        categories: chartData.labels,
        labels: { formatter: v => v, style: { fontSize: '10px' } },
        axisBorder: { show: false },
        axisTicks: { show: false }
      },
      yaxis: {
        show: false,
        min: 0,
        max: Math.max(...chartData.counts) + 2
      },
      tooltip: {
        x: {
          formatter: function(_val, opts) {
            return chartData.labels[opts.dataPointIndex];
          }
        },
        y: {
          formatter: function(val) {
            return val + ' 人';
          }
        }
      },
      grid: {
        show: false,
        padding: { left: 0, right: 0, top: -10, bottom: -8 }
      }
    };
  
    try {
      const chart = new ApexCharts(chartElement, options);
      chart.render();
      console.log(`Chart ${chartId} rendered successfully`);
    } catch (error) {
      console.error(`Error rendering chart ${chartId}:`, error);
      chartElement.innerHTML = '<div class="p-2 text-center text-xs text-red-500">图表加载失败</div>';
    }
  }
  

/**
 * Prepare chart data from API response
 * @param {Array} dailySubmissions - Daily submission data from API
 * @returns {Object} - Prepared chart data for ApexCharts
 */
function prepareChartData(dailySubmissions) {
    // Create a copy to avoid modifying the original array
    const data = [...dailySubmissions];
    
    // Ensure data is ordered from oldest to newest (for correct display)
    data.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    // Extract counts
    const counts = data.map(item => item.count);
    
    // Create meaningful labels that respect Chinese locale
    const labels = data.map(item => {
        const day = item.day;
        
        // Special handling for today and yesterday
        if (day === 'today') return '今天';
        if (day === 'yesterday') return '昨天';
        
        // For other days, format the date
        const date = new Date(item.date);
        
        // Format as "MM-DD"
        return `${date.getMonth() + 1}-${date.getDate()}`;
    });
    
    return {
        counts: counts,
        dates: data.map(item => item.date),
        labels: labels
    };
}