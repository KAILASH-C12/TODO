document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const taskInput = document.getElementById('taskInput');
    const addTaskBtn = document.getElementById('addTaskBtn');
    const taskList = document.getElementById('taskList');
    const clearCompletedBtn = document.getElementById('clearCompleted');
    const taskCount = document.getElementById('taskCount');
    const filterButtons = document.querySelectorAll('.filter-btn');
    
    // State
    let tasks = JSON.parse(localStorage.getItem('tasks')) || [];
    let currentFilter = 'all';
    
    // Initialize the app
    init();
    
    function init() {
        renderTasks();
        setupEventListeners();
    }
    
    function setupEventListeners() {
        // Add task
        addTaskBtn.addEventListener('click', addTask);
        taskInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') addTask();
        });
        
        // Clear completed tasks
        clearCompletedBtn.addEventListener('click', clearCompletedTasks);
        
        // Filter buttons
        filterButtons.forEach(button => {
            button.addEventListener('click', () => {
                filterButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                currentFilter = button.dataset.priority;
                renderTasks();
            });
        });
    }
    
    function addTask() {
        const text = taskInput.value.trim();
        if (!text) return;
        
        // Parse task text for natural language processing (simplified)
        const { taskText, dueDate, priority } = parseTaskText(text);
        
        const newTask = {
            id: Date.now(),
            text: taskText,
            completed: false,
            dueDate,
            priority: priority || 'medium',
            createdAt: new Date().toISOString()
        };
        
        tasks.unshift(newTask);
        saveTasks();
        renderTasks();
        taskInput.value = '';
        
        // Play add sound and animate
        playSound('add');
        const taskElement = taskList.firstElementChild;
        if (taskElement) {
            taskElement.classList.add('adding');
        }
    }
    
    function parseTaskText(text) {
        // Simplified natural language processing
        const result = {
            taskText: text,
            dueDate: null,
            priority: 'medium'
        };
        
        // Check for priority keywords
        const priorityKeywords = {
            high: ['urgent', 'important', 'asap', 'high'],
            low: ['low', 'whenever', 'no rush']
        };
        
        // Check for due date patterns
        const datePatterns = [
            { regex: /(today|tonight)/i, days: 0 },
            { regex: /tomorrow/i, days: 1 },
            { regex: /next week/i, days: 7 },
            { regex: /in (\d+) days?/i, modifier: (match) => parseInt(match[1]) },
            { regex: /at (\d+)(:\d+)?\s?(am|pm)?/i, time: true }
        ];
        
        // Process priority
        for (const [priority, keywords] of Object.entries(priorityKeywords)) {
            if (keywords.some(keyword => text.toLowerCase().includes(keyword))) {
                result.priority = priority;
                result.taskText = result.taskText.replace(
                    new RegExp(keywords.join('|'), 'gi'), ''
                ).trim();
                break;
            }
        }
        
        // Process due dates
        let dateFound = false;
        for (const pattern of datePatterns) {
            const match = text.match(pattern.regex);
            if (match) {
                dateFound = true;
                const now = new Date();
                
                if (pattern.days !== undefined) {
                    now.setDate(now.getDate() + pattern.days);
                } else if (pattern.modifier) {
                    now.setDate(now.getDate() + pattern.modifier(match));
                }
                
                if (pattern.time && match[1]) {
                    let hours = parseInt(match[1]);
                    const minutes = match[2] ? parseInt(match[2].substring(1)) : 0;
                    const period = match[3] ? match[3].toLowerCase() : '';
                    
                    if (period === 'pm' && hours < 12) hours += 12;
                    if (period === 'am' && hours === 12) hours = 0;
                    
                    now.setHours(hours, minutes, 0, 0);
                } else {
                    now.setHours(23, 59, 59, 0); // End of day if no time specified
                }
                
                result.dueDate = now.toISOString();
                result.taskText = result.taskText.replace(pattern.regex, '').trim();
                break;
            }
        }
        
        // If no date found but text contains "due", set to tomorrow
        if (!dateFound && /due/i.test(text)) {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(23, 59, 59, 0);
            result.dueDate = tomorrow.toISOString();
            result.taskText = result.taskText.replace(/due/gi, '').trim();
        }
        
        return result;
    }
    
    function renderTasks() {
        taskList.innerHTML = '';
        
        // Filter tasks based on current filter
        let filteredTasks = tasks;
        if (currentFilter !== 'all') {
            filteredTasks = tasks.filter(task => task.priority === currentFilter);
        }
        
        if (filteredTasks.length === 0) {
            const emptyState = document.createElement('div');
            emptyState.className = 'empty-state';
            emptyState.textContent = currentFilter === 'all' 
                ? 'No tasks yet. Add one above!' 
                : `No ${currentFilter} priority tasks.`;
            taskList.appendChild(emptyState);
            updateTaskCount();
            return;
        }
        
        // Sort tasks: incomplete first, then by priority (high to low), then by due date
        filteredTasks.sort((a, b) => {
            if (a.completed !== b.completed) return a.completed ? 1 : -1;
            if (a.priority !== b.priority) {
                const priorityOrder = { high: 3, medium: 2, low: 1 };
                return priorityOrder[b.priority] - priorityOrder[a.priority];
            }
            if (a.dueDate && b.dueDate) return new Date(a.dueDate) - new Date(b.dueDate);
            if (a.dueDate) return -1;
            if (b.dueDate) return 1;
            return new Date(b.createdAt) - new Date(a.createdAt);
        });
        
        filteredTasks.forEach(task => {
            const taskElement = createTaskElement(task);
            taskList.appendChild(taskElement);
        });
        
        updateTaskCount();
        setupTaskInteractions();
    }
    
    function createTaskElement(task) {
        const taskElement = document.createElement('div');
        taskElement.className = `task-item ${task.priority}-priority ${task.completed ? 'completed' : ''}`;
        taskElement.dataset.id = task.id;
        taskElement.draggable = true;
        
        // Format due date if exists
        let dueDateText = '';
        if (task.dueDate) {
            const dueDate = new Date(task.dueDate);
            const now = new Date();
            const diffDays = Math.floor((dueDate - now) / (1000 * 60 * 60 * 24));
            
            if (diffDays < 0) {
                dueDateText = 'Overdue';
            } else if (diffDays === 0) {
                dueDateText = 'Today';
            } else if (diffDays === 1) {
                dueDateText = 'Tomorrow';
            } else if (diffDays < 7) {
                dueDateText = `${diffDays} days`;
            } else {
                dueDateText = dueDate.toLocaleDateString('en-US', { 
                    month: 'short', 
                    day: 'numeric' 
                });
            }
            
            // Add time if not end of day
            if (dueDate.getHours() !== 23 || dueDate.getMinutes() !== 59) {
                dueDateText += ` at ${dueDate.toLocaleTimeString('en-US', { 
                    hour: 'numeric', 
                    minute: '2-digit',
                    hour12: true 
                })}`;
            }
        }
        
        taskElement.innerHTML = `
            <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''}>
            <span class="task-text">${task.text}</span>
            ${dueDateText ? `<span class="task-due">${dueDateText}</span>` : ''}
            <button class="task-delete">×</button>
        `;
        
        return taskElement;
    }
    
    function setupTaskInteractions() {
        // Checkbox toggle
        document.querySelectorAll('.task-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', function() {
                const taskId = parseInt(this.closest('.task-item').dataset.id);
                const task = tasks.find(t => t.id === taskId);
                
                if (task) {
                    task.completed = this.checked;
                    saveTasks();
                    
                    const taskElement = this.closest('.task-item');
                    taskElement.classList.toggle('completed');
                    
                    if (task.completed) {
                        // Celebrate completion!
                        playSound('complete');
                        triggerConfetti();
                    }
                    
                    // Re-render if filtered by completion status
                    if (currentFilter !== 'all') {
                        setTimeout(() => {
                            taskElement.classList.add('removing');
                            setTimeout(() => renderTasks(), 300);
                        }, 1000);
                    }
                }
            });
        });
        
        // Delete task
        document.querySelectorAll('.task-delete').forEach(button => {
            button.addEventListener('click', function() {
                const taskId = parseInt(this.closest('.task-item').dataset.id);
                deleteTask(taskId);
            });
        });
        
        // Drag and drop
        setupDragAndDrop();
    }
    
    function deleteTask(taskId) {
        const taskElement = document.querySelector(`.task-item[data-id="${taskId}"]`);
        if (taskElement) {
            taskElement.classList.add('removing');
            
            setTimeout(() => {
                tasks = tasks.filter(task => task.id !== taskId);
                saveTasks();
                renderTasks();
            }, 300);
        }
    }
    
    function clearCompletedTasks() {
        const completedTasks = document.querySelectorAll('.task-item.completed');
        
        if (completedTasks.length === 0) return;
        
        completedTasks.forEach(task => {
            task.classList.add('removing');
        });
        
        setTimeout(() => {
            tasks = tasks.filter(task => !task.completed);
            saveTasks();
            renderTasks();
        }, 300);
    }
    
    function setupDragAndDrop() {
        const dragStart = function(e) {
            this.classList.add('dragging');
            e.dataTransfer.setData('text/plain', this.dataset.id);
            e.dataTransfer.effectAllowed = 'move';
        };
        
        const dragEnd = function() {
            this.classList.remove('dragging');
        };
        
        const dragOver = function(e) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            
            const draggingElement = document.querySelector('.task-item.dragging');
            if (!draggingElement) return;
            
            const afterElement = getDragAfterElement(this, e.clientY);
            if (afterElement) {
                this.insertBefore(draggingElement, afterElement);
            } else {
                this.appendChild(draggingElement);
            }
        };
        
        const drop = function(e) {
            e.preventDefault();
            const taskId = parseInt(e.dataTransfer.getData('text/plain'));
            const task = tasks.find(t => t.id === taskId);
            if (!task) return;
            
            // Get new position
            const taskElements = Array.from(this.children);
            const index = taskElements.findIndex(el => el.dataset.id === taskId.toString());
            
            // Update tasks array
            tasks = tasks.filter(t => t.id !== taskId);
            tasks.splice(index, 0, task);
            
            saveTasks();
        };
        
        document.querySelectorAll('.task-item').forEach(item => {
            item.addEventListener('dragstart', dragStart);
            item.addEventListener('dragend', dragEnd);
        });
        
        taskList.addEventListener('dragover', dragOver);
        taskList.addEventListener('drop', drop);
    }
    
    function getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.task-item:not(.dragging)')];
        
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }
    
    function updateTaskCount() {
        const totalTasks = tasks.length;
        const completedTasks = tasks.filter(task => task.completed).length;
        
        if (totalTasks === 0) {
            taskCount.textContent = 'No tasks';
        } else if (completedTasks === totalTasks) {
            taskCount.textContent = 'All tasks completed!';
        } else {
            taskCount.textContent = `${completedTasks}/${totalTasks} completed`;
        }
    }
    
    function saveTasks() {
        localStorage.setItem('tasks', JSON.stringify(tasks));
    }
    
    function playSound(type) {
        // In a real app, you would play an audio file here
        console.log(`Playing ${type} sound`);
    }
    
    function triggerConfetti() {
        // Simple confetti effect
        const colors = ['#6c5ce7', '#a29bfe', '#ff7675', '#fdcb6e', '#55efc4'];
        
        for (let i = 0; i < 50; i++) {
            const confetti = document.createElement('div');
            confetti.style.position = 'fixed';
            confetti.style.width = '8px';
            confetti.style.height = '8px';
            confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
            confetti.style.borderRadius = '50%';
            confetti.style.left = `${Math.random() * 100}vw`;
            confetti.style.top = '-10px';
            confetti.style.zIndex = '1000';
            confetti.style.pointerEvents = 'none';
            confetti.style.transform = 'translateZ(50px)';
            
            document.body.appendChild(confetti);
            
            const animationDuration = Math.random() * 3 + 2;
            
            confetti.animate([
                { 
                    transform: `translate(0, 0) rotate(0deg)`,
                    opacity: 1 
                },
                { 
                    transform: `translate(${Math.random() * 200 - 100}px, ${window.innerHeight}px) rotate(${Math.random() * 360}deg)`,
                    opacity: 0 
                }
            ], {
                duration: animationDuration * 1000,
                easing: 'cubic-bezier(0.1, 0.8, 0.3, 1)'
            });
            
            setTimeout(() => confetti.remove(), animationDuration * 1000);
        }
    }
});