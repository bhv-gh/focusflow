// js/routines.js

// --- Routine Modal Logic ---

/**
 * Opens the routine modal, either for adding a new routine or editing an existing one.
 * @param {string|null} routineId - The ID of the routine to edit, or null to add a new one.
 */
function openRoutineModal(routineId = null) {
    if (!routineModal) return;

    editingRoutineId = routineId;
    routineForm.reset(); // Clear form fields
    habitsContainer.innerHTML = ''; // Clear existing habit fields
    weekdaySelector.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false); // Uncheck all weekdays

    if (routineId) {
        // --- EDIT MODE ---
        const routine = routines.find(r => r.id === routineId);
        if (!routine) {
            showNotification("Routine not found for editing.", "error");
            return;
        }
        routineModalTitle.textContent = "Edit Routine";
        routineIdInput.value = routine.id;
        routineNameInput.value = routine.name;
        routine.habits.forEach(habit => addHabitInput(habit.id, habit.text));
        routineFrequencySelect.value = routine.frequencyType;

        // Set frequency-specific options
        if (routine.frequencyType === 'weekly' && Array.isArray(routine.frequencyValue)) {
            routine.frequencyValue.forEach(dayIndex => {
                const checkbox = weekdaySelector.querySelector(`input[value="${dayIndex}"]`);
                if (checkbox) checkbox.checked = true;
            });
        }
        // Add logic for 'monthly' or 'custom' here if implemented
    } else {
        // --- ADD MODE ---
        routineModalTitle.textContent = "Add New Routine";
        routineIdInput.value = '';
        addHabitInput(); // Add one empty habit field to start
        routineFrequencySelect.value = 'daily';
    }

    updateFrequencyOptionsVisibility(); // Show/hide options based on dropdown
    routineModal.style.display = 'flex';
    routineNameInput.focus();
}

/** Closes the routine modal and resets the editing state. */
function closeRoutineModal() {
    if (routineModal) routineModal.style.display = 'none';
    editingRoutineId = null;
}

/**
 * Adds a new habit input field to the routine modal.
 * @param {string|null} id - The ID of the habit (for editing).
 * @param {string} text - The text of the habit (for editing).
 */
function addHabitInput(id = null, text = '') {
    const habitId = id || generateUniqueId('habit');
    const div = document.createElement('div');
    div.className = 'flex items-center space-x-2 habit-input-group';
    div.dataset.habitId = habitId;

    div.innerHTML = `
        <input type="text" value="${text}" placeholder="e.g., Meditate for 10 minutes"
               class="habit-text-input flex-grow border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded-md shadow-sm p-2 focus:ring-indigo-500 focus:border-indigo-500">
        <button type="button" class="remove-habit-btn bg-red-500 hover:bg-red-600 text-white font-semibold p-2 rounded-lg shadow flex-shrink-0">
            ${SVG_STRINGS.trash2}
        </button>
    `;

    // Add event listener to the remove button
    div.querySelector('.remove-habit-btn').addEventListener('click', () => {
        // Prevent removing the last habit input
        if (habitsContainer.querySelectorAll('.habit-input-group').length > 1) {
            div.remove();
        } else {
            showNotification("A routine must have at least one habit.", "warning");
        }
    });

    habitsContainer.appendChild(div);
}

/** Shows or hides frequency-specific options based on the dropdown selection. */
function updateFrequencyOptionsVisibility() {
    const selectedFrequency = routineFrequencySelect.value;
    weeklyOptions.style.display = selectedFrequency === 'weekly' ? 'block' : 'none';
    // Add logic for 'monthly', 'custom' here
}

/** Handles the submission of the routine form to save or update a routine. */
function handleSaveRoutine() {
    const routineId = routineIdInput.value;
    const name = routineNameInput.value.trim();
    if (!name) {
        showNotification("Routine name cannot be empty.", "warning");
        return;
    }

    // Gather habits
    const habits = [];
    const habitInputs = habitsContainer.querySelectorAll('.habit-input-group');
    habitInputs.forEach(group => {
        const textInput = group.querySelector('.habit-text-input');
        const text = textInput.value.trim();
        if (text) { // Only add non-empty habits
            habits.push({
                id: group.dataset.habitId,
                text: text
            });
        }
    });
    if (habits.length === 0) {
        showNotification("Please add at least one habit.", "warning");
        return;
    }

    // Gather frequency
    const frequencyType = routineFrequencySelect.value;
    let frequencyValue = null;
    if (frequencyType === 'daily') {
        frequencyValue = [0, 1, 2, 3, 4, 5, 6]; // All days
    } else if (frequencyType === 'weekly') {
        frequencyValue = Array.from(weekdaySelector.querySelectorAll('input:checked')).map(cb => parseInt(cb.value));
        if (frequencyValue.length === 0) {
            showNotification("Please select at least one day for a weekly routine.", "warning");
            return;
        }
    }
    // Add logic for 'monthly', 'custom' here

    const routineData = { id: routineId || generateUniqueId('routine'), name, habits, frequencyType, frequencyValue };

    if (routineId) {
        // Update existing routine
        const index = routines.findIndex(r => r.id === routineId);
        if (index > -1) routines[index] = routineData;
    } else {
        // Add new routine
        routines.push(routineData);
    }

    saveRoutines();
    renderAllRoutines();
    renderTodaysRoutines();
    renderRoutineProgressVisualization();
    closeRoutineModal();
    showNotification(`Routine "${name}" saved!`, 'success');
}

// --- Core Routine Logic ---

/**
 * Gets the list of all habits scheduled for a given date.
 * @param {Date} date - The date to check against.
 * @returns {Array} - An array of habit objects, each with its parent routine info.
 */
function getTodaysRoutines(date = new Date()) {
    const dayOfWeek = date.getDay(); // Sunday: 0, Monday: 1, ...
    const todaysHabits = [];

    routines.forEach(routine => {
        if (routine.frequencyType === 'daily' ||
           (routine.frequencyType === 'weekly' && routine.frequencyValue.includes(dayOfWeek))) {
            routine.habits.forEach(habit => {
                todaysHabits.push({
                    ...habit,
                    routineId: routine.id,
                    routineName: routine.name
                });
            });
        }
    });
    return todaysHabits;
}

/**
 * Toggles the completion status of a habit for today.
 * @param {string} habitId - The ID of the habit to toggle.
 */
function toggleHabitCompletion(habitId) {
    const todayStr = getDateString(new Date());

    if (!routineHistory[todayStr]) {
        routineHistory[todayStr] = {};
    }

    if (routineHistory[todayStr][habitId]) {
        // It was completed, so un-complete it
        delete routineHistory[todayStr][habitId];
    } else {
        // It was not completed, so mark as complete with a timestamp
        routineHistory[todayStr][habitId] = Date.now();
    }

    saveRoutineHistory();
    // Re-render the UI to reflect the change
    renderTodaysRoutines();
    renderRoutineProgressVisualization(); // Progress has changed
}

// --- UI Rendering ---

/** Renders the list of today's habits. */
function renderTodaysRoutines() {
    if (!todaysRoutinesContainer) return;

    const todaysHabits = getTodaysRoutines();
    todaysRoutinesContainer.innerHTML = '';

    if (todaysHabits.length === 0) {
        todaysRoutinesEmptyMsg.style.display = 'block';
    } else {
        todaysRoutinesEmptyMsg.style.display = 'none';
        todaysHabits.forEach(habit => {
            const habitElement = createHabitElement(habit);
            todaysRoutinesContainer.appendChild(habitElement);
        });
    }
}

/**
 * Creates the HTML element for a single habit.
 * @param {object} habit - The habit object.
 * @returns {HTMLElement}
 */
function createHabitElement(habit) {
    const todayStr = getDateString(new Date());
    const isCompleted = routineHistory[todayStr] && routineHistory[todayStr][habit.id];

    const element = document.createElement('div');
    element.className = `habit-item flex items-center p-3 rounded-lg transition-all duration-200 cursor-pointer ${isCompleted ? 'completed bg-green-100 dark:bg-green-900/50' : 'bg-gray-50 dark:bg-gray-800'}`;
    element.dataset.habitId = habit.id;

    element.innerHTML = `
        <div class="habit-checkbox h-6 w-6 rounded-full border-2 ${isCompleted ? 'bg-indigo-500 border-indigo-500' : 'border-gray-300 dark:border-gray-600'} flex items-center justify-center flex-shrink-0">
            ${isCompleted ? SVG_STRINGS.check.replace('class="icon"', 'class="icon icon-sm text-white"') : ''}
        </div>
        <div class="ml-4 flex-grow">
            <p class="font-medium text-gray-800 dark:text-gray-200 ${isCompleted ? 'line-through text-gray-500 dark:text-gray-400' : ''}">${habit.text}</p>
            <p class="text-xs text-gray-500 dark:text-gray-400">${habit.routineName}</p>
        </div>
    `;

    element.addEventListener('click', () => toggleHabitCompletion(habit.id));
    return element;
}

/** Renders the list of all created routines. */
function renderAllRoutines() {
    if (!allRoutinesList) return;
    allRoutinesList.innerHTML = '';

    if (routines.length === 0) {
        allRoutinesEmptyMsg.style.display = 'block';
    } else {
        allRoutinesEmptyMsg.style.display = 'none';
        routines.forEach(routine => {
            const routineElement = createRoutineListElement(routine);
            allRoutinesList.appendChild(routineElement);
        });
    }
}

/**
 * Creates the HTML element for a single routine in the management list.
 * @param {object} routine - The routine object.
 * @returns {HTMLElement}
 */
function createRoutineListElement(routine) {
    const element = document.createElement('div');
    element.className = 'routine-list-item flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg shadow-sm';
    element.dataset.routineId = routine.id;

    const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    const frequencyHtml = routine.frequencyType === 'daily'
        ? '<span class="text-xs font-semibold text-indigo-600 dark:text-indigo-400">DAILY</span>'
        : days.map((day, i) => `<span class="${routine.frequencyValue.includes(i) ? 'active text-indigo-500 font-bold' : 'text-gray-400'}">${day}</span>`).join('');

    element.innerHTML = `
        <div>
            <p class="font-semibold text-gray-800 dark:text-gray-200">${routine.name}</p>
            <div class="flex space-x-2 mt-1 routine-frequency-display">${frequencyHtml}</div>
        </div>
        <div class="flex items-center space-x-2">
            <button class="edit-routine-btn p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700" title="Edit Routine">
                ${SVG_STRINGS.pencil.replace('icon-sm', 'icon-xs')}
            </button>
            <button class="delete-routine-btn p-2 rounded-full hover:bg-red-100 dark:hover:bg-red-900/50" title="Delete Routine">
                 ${SVG_STRINGS.trash2.replace('icon-sm', 'icon-xs')}
            </button>
        </div>
    `;

    // Add event listeners
    element.querySelector('.edit-routine-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        openRoutineModal(routine.id);
    });
     element.querySelector('.delete-routine-btn').addEventListener('click', (e) => {
         e.stopPropagation();
         // Add delete confirmation logic here
         showConfirmationModal(`Delete the "${routine.name}" routine and all its history?`, () => {
             routines = routines.filter(r => r.id !== routine.id);
             // Optionally, clean up history (or keep it)
             saveRoutines();
             renderAllRoutines();
             renderTodaysRoutines();
             renderRoutineProgressVisualization();
             showNotification("Routine deleted.", "warning");
         });
     });

    return element;
}


// --- Progress Visualization ---

/** Renders the entire progress visualization section. */
function renderRoutineProgressVisualization() {
    const stats = calculateProgressStats();
    routineStreak.textContent = stats.currentStreak;
    routineCompletionRate.textContent = `${stats.completionRate}%`;
    drawGalaxy(stats);
}

/** Calculates streak and completion rate from history. */
function calculateProgressStats() {
    const today = new Date();
    let currentStreak = 0;
    let daysChecked = 0;
    let completedDays = 0;
    const totalDaysWithRoutines = Object.keys(routineHistory).length;

    for (let i = 0; i < 365; i++) { // Check up to a year back
        const date = new Date(today);
        date.setDate(today.getDate() - i);
        const dateStr = getDateString(date);

        const todaysHabits = getTodaysRoutines(date);
        if (todaysHabits.length === 0) continue; // Skip days with no scheduled habits

        daysChecked++;
        const historyForDay = routineHistory[dateStr] || {};
        const completedCount = todaysHabits.filter(h => historyForDay[h.id]).length;

        if (completedCount === todaysHabits.length) {
            // Perfect day!
            if (i === daysChecked - 1) { // Check if it's a consecutive day
                currentStreak++;
            }
            completedDays++;
        } else {
            // Streak broken
            if (i === daysChecked - 1) {
                // The streak ended before today
            }
        }
    }
    
    // Check if today is a perfect day
    const todayStr = getDateString(today);
    const todaysHabits = getTodaysRoutines(today);
    const historyForToday = routineHistory[todayStr] || {};
    const completedTodayCount = todaysHabits.filter(h => historyForToday[h.id]).length;

    if(todaysHabits.length > 0 && completedTodayCount < todaysHabits.length){
        // not a perfect day, so if there was a streak it is broken
    } else if (todaysHabits.length > 0 && completedTodayCount === todaysHabits.length) {
        // perfect day, if there was no streak, streak is 1, if there was a streak, it continues
    } else {
        // no habits today
    }


    const completionRate = totalDaysWithRoutines > 0 ? Math.round((completedDays / totalDaysWithRoutines) * 100) : 0;

    return {
        currentStreak,
        completionRate,
        history: routineHistory // Pass full history for detailed visualization
    };
}


/** Draws the "Consistency Galaxy" on the canvas. */
function drawGalaxy(stats) {
    if (!galaxyCanvas) return;
    const ctx = galaxyCanvas.getContext('2d');
    const { width, height } = galaxyCanvas.getBoundingClientRect();
    galaxyCanvas.width = width;
    galaxyCanvas.height = height;

    // Placeholder: Simple visualization
    ctx.clearRect(0, 0, width, height);
    const isDark = document.documentElement.classList.contains('dark');
    ctx.fillStyle = isDark ? 'white' : 'black';

    ctx.font = '16px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Progress Visualization Coming Soon!', width / 2, height / 2);
    ctx.font = '12px Inter, sans-serif';
    ctx.fillText(`Streak: ${stats.currentStreak} | Completion: ${stats.completionRate}%`, width / 2, height / 2 + 20);

    // TODO: Implement the animated starfield galaxy visualization
}
