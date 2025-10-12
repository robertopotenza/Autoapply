'use strict';

// Autoapply wizard frontend state (exposed for debugging)
const formState = {
    currentStep: 1,
    totalSteps: 4,
    data: {}
};

window.formState = formState;

// Debug Mode Configuration
const DEBUG_MODE = localStorage.getItem('DEBUG_MODE') === 'true' || window.AUTOAPPLY_DEBUG === true;

// Debug logging helper
function debugLog(...args) {
    if (DEBUG_MODE) {
        console.log(...args);
    }
}

function debugError(...args) {
    if (DEBUG_MODE) {
        console.error(...args);
    }
}

// Store multi-select instances for programmatic access
const multiSelectInstances = {};

// Data for dropdowns
const countries = [
    'United States', 'United Kingdom', 'Canada', 'Australia', 'Germany', 'France',
    'India', 'China', 'Japan', 'Brazil', 'Mexico', 'Spain', 'Italy', 'Netherlands',
    'Sweden', 'Norway', 'Denmark', 'Finland', 'Switzerland', 'Austria', 'Belgium',
    'Ireland', 'New Zealand', 'Singapore', 'South Korea', 'Poland', 'Portugal'
];

const timezones = [
    'UTC-12:00', 'UTC-11:00', 'UTC-10:00', 'UTC-09:00', 'UTC-08:00 (PST)',
    'UTC-07:00 (MST)', 'UTC-06:00 (CST)', 'UTC-05:00 (EST)', 'UTC-04:00',
    'UTC-03:00', 'UTC-02:00', 'UTC-01:00', 'UTC+00:00 (GMT)', 'UTC+01:00 (CET)',
    'UTC+02:00', 'UTC+03:00', 'UTC+04:00', 'UTC+05:00', 'UTC+05:30 (IST)',
    'UTC+06:00', 'UTC+07:00', 'UTC+08:00 (CST)', 'UTC+09:00 (JST)', 'UTC+10:00',
    'UTC+11:00', 'UTC+12:00'
];

const languages = [
    'English', 'Spanish', 'Mandarin', 'French', 'German', 'Arabic', 'Portuguese',
    'Russian', 'Japanese', 'Korean', 'Italian', 'Dutch', 'Swedish', 'Polish',
    'Turkish', 'Hindi', 'Bengali', 'Vietnamese', 'Thai', 'Greek'
];

// CRITICAL FUNCTIONS - Moved to top to prevent Railway truncation
async function loadExistingUserData() {
    try {
        debugLog('🔄 Loading existing user data for edit mode...');
        
        const token = localStorage.getItem('authToken');
        if (!token) {
            debugLog('❌ No auth token found in localStorage under key "authToken"');
            debugLog('💡 Make sure you logged in and the token was set correctly');
            return;
        }

        debugLog('✅ Auth token found, making request to /api/wizard/data');
        const response = await fetch('/api/wizard/data', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        debugLog(`📡 Response status: ${response.status} ${response.statusText}`);

        if (response.ok) {
            const result = await response.json();
            debugLog('✅ API Response:', result);
            
            if (result.success && result.data) {
                debugLog('📊 Populating form with user data...');
                populateFormFields(result.data);
                debugLog('✅ Form fields populated successfully');

                // Note: Screening section is now always visible, no need to expand
                debugLog('✅ Screening section is always visible');
            } else if (result.success && !result.data) {
                debugLog('⚠️ GET /api/wizard/data returned status 200 but data is null');
                debugLog('💡 This means the user_complete_profile view has no row for this user');
                debugLog('💡 Check server logs for [User] messages');
                debugLog('💡 Run: node scripts/verify-database.js --user <your-email>');
                debugLog('Response details:', result);
            } else {
                debugLog('❌ No user data found in response');
                debugLog('Response details:', result);
            }
        } else {
            debugLog('❌ API request failed:', response.status, response.statusText);
            if (response.status === 401) {
                debugLog('💡 Unauthorized - token may be invalid or expired');
                debugLog('💡 Try logging out and logging in again');
            }
            const errorText = await response.text();
            debugLog('Error response:', errorText);
        }
    } catch (error) {
        debugError('❌ Error loading user data:', error);
        debugError('Error details:', error.message, error.stack);
    }
}

// Normalize user data to flat snake_case format
// Handles flat snake_case, nested structures, or camelCase
function normalizeUserData(userData) {
    if (!userData) return {};
    
    // Helper function to convert camelCase to snake_case
    function toSnakeCase(str) {
        return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
    }
    
    // Check if this is a nested structure (has preference/personal/eligibility/screening objects)
    const isNestedStructure = userData.preferences || userData.personal || userData.eligibility || userData.screening;
    
    // If data is already flat with ALL snake_case keys, return as is (check that NO keys are in camelCase)
    if (!isNestedStructure) {
        const keys = Object.keys(userData).filter(k => k !== 'user_id' && k !== 'email' && k !== 'created_at');
        const hasCamelCaseKeys = keys.some(key => /[A-Z]/.test(key));
        
        if (!hasCamelCaseKeys) {
            console.log('✅ Data is already in flat snake_case format');
            return userData;
        }
    }
    
    const normalized = {};
    
    // Handle nested structure (legacy format)
    if (userData.preferences || userData.personal || userData.eligibility || userData.screening) {
        console.log('🔄 Converting from nested structure to flat format');
        
        // Copy top-level fields
        if (userData.user_id) normalized.user_id = userData.user_id;
        if (userData.email) normalized.email = userData.email;
        if (userData.created_at) normalized.created_at = userData.created_at;
        
        // Job preferences
        if (userData.preferences) {
            normalized.remote_jobs = userData.preferences.remote_jobs || userData.preferences.remoteJobs;
            normalized.onsite_location = userData.preferences.onsite_location || userData.preferences.onsiteLocation;
            normalized.job_types = userData.preferences.job_types || userData.preferences.jobTypes;
            normalized.job_titles = userData.preferences.job_titles || userData.preferences.jobTitles;
            normalized.seniority_levels = userData.preferences.seniority_levels || userData.preferences.seniorityLevels;
            normalized.time_zones = userData.preferences.time_zones || userData.preferences.timeZones;
        }
        
        // Personal info
        if (userData.personal) {
            normalized.full_name = userData.personal.full_name || userData.personal.fullName;
            normalized.phone = userData.personal.phone;
            normalized.country = userData.personal.country;
            normalized.city = userData.personal.city;
            normalized.state_region = userData.personal.state_region || userData.personal.stateRegion;
            normalized.postal_code = userData.personal.postal_code || userData.personal.postalCode;
            normalized.resume_path = userData.personal.resume_path || userData.personal.resumePath;
            normalized.cover_letter_option = userData.personal.cover_letter_option || userData.personal.coverLetterOption;
        }
        
        // Eligibility
        if (userData.eligibility) {
            normalized.current_job_title = userData.eligibility.current_job_title || userData.eligibility.currentJobTitle;
            normalized.availability = userData.eligibility.availability;
            normalized.eligible_countries = userData.eligibility.eligible_countries || userData.eligibility.eligibleCountries;
            normalized.visa_sponsorship = userData.eligibility.visa_sponsorship !== undefined ? 
                userData.eligibility.visa_sponsorship : userData.eligibility.visaSponsorship;
            normalized.nationality = userData.eligibility.nationality;
            normalized.current_salary = userData.eligibility.current_salary || userData.eligibility.currentSalary;
            normalized.expected_salary = userData.eligibility.expected_salary || userData.eligibility.expectedSalary;
        }
        
        // Screening
        if (userData.screening) {
            normalized.experience_summary = userData.screening.experience_summary || userData.screening.experienceSummary;
            normalized.hybrid_preference = userData.screening.hybrid_preference || userData.screening.hybridPreference;
            normalized.travel = userData.screening.travel;
            normalized.relocation = userData.screening.relocation;
            normalized.languages = userData.screening.languages;
            normalized.date_of_birth = userData.screening.date_of_birth || userData.screening.dateOfBirth;
            normalized.gpa = userData.screening.gpa;
            normalized.is_adult = userData.screening.is_adult !== undefined ? 
                userData.screening.is_adult : userData.screening.isAdult;
            normalized.gender_identity = userData.screening.gender_identity || userData.screening.genderIdentity;
            normalized.disability_status = userData.screening.disability_status || userData.screening.disabilityStatus;
            normalized.military_service = userData.screening.military_service || userData.screening.militaryService;
            normalized.ethnicity = userData.screening.ethnicity;
            normalized.driving_license = userData.screening.driving_license || userData.screening.drivingLicense;
        }
        
        return normalized;
    }
    
    // Handle mixed camelCase/snake_case flat structure
    console.log('🔄 Normalizing mixed format to flat snake_case');
    
    // Map of camelCase to snake_case field names
    const fieldMap = {
        'remoteJobs': 'remote_jobs',
        'onsiteLocation': 'onsite_location',
        'jobTypes': 'job_types',
        'jobTitles': 'job_titles',
        'seniorityLevels': 'seniority_levels',
        'timeZones': 'time_zones',
        'fullName': 'full_name',
        'resumePath': 'resume_path',
        'coverLetterOption': 'cover_letter_option',
        'stateRegion': 'state_region',
        'postalCode': 'postal_code',
        'currentJobTitle': 'current_job_title',
        'eligibleCountries': 'eligible_countries',
        'visaSponsorship': 'visa_sponsorship',
        'currentSalary': 'current_salary',
        'expectedSalary': 'expected_salary',
        'experienceSummary': 'experience_summary',
        'hybridPreference': 'hybrid_preference',
        'dateOfBirth': 'date_of_birth',
        'isAdult': 'is_adult',
        'genderIdentity': 'gender_identity',
        'disabilityStatus': 'disability_status',
        'militaryService': 'military_service',
        'drivingLicense': 'driving_license'
    };
    
    // Copy all fields, converting camelCase to snake_case if needed
    for (const [key, value] of Object.entries(userData)) {
        if (value !== undefined && value !== null) {
            // If there's a mapping, use it
            if (fieldMap[key]) {
                normalized[fieldMap[key]] = value;
            } else {
                // For unmapped keys, convert camelCase to snake_case if needed
                const targetKey = /[A-Z]/.test(key) ? toSnakeCase(key) : key;
                normalized[targetKey] = value;
            }
        }
    }
    
    return normalized;
}

function populateFormFields(userData) {
    try {
        console.log('🔄 Populating form fields');
        
        // Normalize the data to flat snake_case format before processing
        const normalizedData = normalizeUserData(userData);
        console.log('🔄 Data normalized successfully');
        
        // The convertUserDataToFormState function now handles the complex form elements
        // (pills, multi-selects, etc.) directly, so we just need to call it
        const formData = convertUserDataToFormState(normalizedData);
        console.log('📝 Converted form data:', formData);
        
        // Populate simple input fields
        Object.keys(formData).forEach(fieldId => {
            const element = document.getElementById(fieldId);
            if (element && formData[fieldId]) {
                element.value = formData[fieldId];
                console.log(`✅ Set ${fieldId} = ${formData[fieldId]}`);
            }
        });
        
        // Capture all populated field values into formState.data for ALL steps
        // This ensures the data is available when the form is submitted
        console.log('💾 Capturing populated values into formState...');
        for (let step = 1; step <= formState.totalSteps; step++) {
            const stepEl = document.querySelector(`.form-step[data-step="${step}"]`);
            if (stepEl) {
                const inputs = stepEl.querySelectorAll('input, select, textarea');
                inputs.forEach(input => {
                    if (input.type === 'file') return;
                    
                    if (input.type === 'checkbox') {
                        formState.data[input.id] = input.checked;
                    } else {
                        formState.data[input.id] = input.value;
                    }
                });
            }
        }
        // Also capture screening section fields (outside of numbered steps)
        const screeningSection = document.getElementById('screening-content');
        if (screeningSection) {
            const screeningInputs = screeningSection.querySelectorAll('input, select, textarea');
            screeningInputs.forEach(input => {
                if (input.type === 'file') return;
                if (input.type === 'checkbox') {
                    formState.data[input.id] = input.checked;
                } else {
                    formState.data[input.id] = input.value;
                }
            });
        }
        console.log('✅ FormState updated:', formState.data);
        
        console.log('✅ Form population completed');
    } catch (error) {
        console.error('❌ Error populating form fields:', error);
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    // Check authentication
    const token = localStorage.getItem('authToken');
    if (!token) {
        alert('Please login to access the configuration wizard');
        window.location.href = '/login.html';
        return;
    }

    initializeForm();
    setupEventListeners();
    initializeRequiredFieldHandling();
    setupGenderSelect();
    
    // Check if we're in edit mode (coming from dashboard)
    const editStep = localStorage.getItem('wizardStep');
    if (editStep) {
        // Navigate to the specific step first, then load existing user data
        const stepNumber = getStepNumber(editStep);
        if (stepNumber) {
            formState.currentStep = stepNumber;
            updateUI();
        }
        
        // Load existing user data after UI is updated
        loadExistingUserData();
        
        // Clear the edit step flag
        localStorage.removeItem('wizardStep');
    } else {
        // Normal flow - load saved state for new users
        loadSavedState();
    }
});

function initializeForm() {
    // Initialize multi-selects
    initMultiSelect('remote-countries', countries);
    initMultiSelect('timezones', timezones);
    initMultiSelect('eligible-countries', countries);
    initMultiSelect('nationalities', countries, 3);
    initMultiSelect('languages', languages, 6);

    // Initialize tags input
    initTagsInput('job-titles', 5);

    // Initialize pill groups
    document.querySelectorAll('.pill-group').forEach(group => {
        const pills = group.querySelectorAll('.pill');
        const hiddenInput = group.nextElementSibling;

        if (hiddenInput && hiddenInput.type === 'hidden') {
            const isMultiple = !hiddenInput.hasAttribute('required') ||
                              hiddenInput.id === 'job-types' ||
                              hiddenInput.id === 'seniority-levels';

            pills.forEach(pill => {
                pill.addEventListener('click', () => {
                    if (isMultiple) {
                        pill.classList.toggle('active');
                    } else {
                        pills.forEach(p => p.classList.remove('active'));
                        pill.classList.add('active');
                    }
                    updatePillGroupValue(group, hiddenInput, isMultiple);
                    // Ensure formState.data is updated for hidden input fields
                    if (window.formState && hiddenInput.id) {
                        window.formState.data[hiddenInput.id] = hiddenInput.value;
                        // Special case: gender should also update genderIdentity
                        if (hiddenInput.id === 'gender') {
                            window.formState.data['genderIdentity'] = hiddenInput.value;
                        }
                    }
                });
            });
        }
    });

    // File uploads
    setupFileUpload('resume-upload', 'resume-status');
    setupFileUpload('cover-letter-file', 'cover-letter-status');

    // Cover letter option
    const coverLetterPills = document.querySelectorAll('#cover-letter-option').length > 0
        ? document.querySelectorAll('[data-value="auto"], [data-value="upload"]')
        : [];

    coverLetterPills.forEach(pill => {
        pill.addEventListener('click', () => {
            const uploadSection = document.getElementById('cover-letter-upload-section');
            if (pill.dataset.value === 'upload') {
                uploadSection?.classList.remove('hidden');
            } else {
                uploadSection?.classList.add('hidden');
            }
        });
    });

    // Character counters
    const expSummary = document.getElementById('experience-summary');
    if (expSummary) {
        expSummary.addEventListener('input', (e) => {
            const counter = document.getElementById('exp-counter');
            if (counter) {
                counter.textContent = `${e.target.value.length}/500`;
            }
        });
    }

    // License checkbox
    const noLicense = document.getElementById('no-license');
    const licensesInput = document.getElementById('licenses');
    if (noLicense && licensesInput) {
        noLicense.addEventListener('change', (e) => {
            licensesInput.disabled = e.target.checked;
            if (e.target.checked) {
                licensesInput.value = '';
            }
        });
    }

    // Note: Screening section is now always visible (no longer collapsible)
}

function initMultiSelect(baseId, options, maxItems = null) {
    const input = document.getElementById(`${baseId}-input`);
    const tagsContainer = document.getElementById(`${baseId}-tags`);
    const dropdown = document.getElementById(`${baseId}-dropdown`);
    const hiddenInput = document.getElementById(baseId);

    if (!input || !tagsContainer || !dropdown) return;

    const selectedItems = new Set();

    // Populate dropdown
    renderDropdown(options, '');

    input.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const filtered = options.filter(opt =>
            opt.toLowerCase().includes(searchTerm) && !selectedItems.has(opt)
        );
        renderDropdown(filtered, searchTerm);
    });

    input.addEventListener('focus', () => {
        dropdown.classList.remove('hidden');
    });

    document.addEventListener('click', (e) => {
        if (!input.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.classList.add('hidden');
        }
    });

    function renderDropdown(items, searchTerm) {
        dropdown.innerHTML = '';

        if (items.length === 0) {
            dropdown.innerHTML = '<div class="dropdown-item" style="color: #9ca3af;">No results found</div>';
            dropdown.classList.remove('hidden');
            return;
        }

        items.slice(0, 10).forEach(item => {
            const div = document.createElement('div');
            div.className = 'dropdown-item';
            div.textContent = item;
            div.addEventListener('click', () => addItem(item));
            dropdown.appendChild(div);
        });

        if (searchTerm) {
            dropdown.classList.remove('hidden');
        }
    }

    function addItem(item) {
        if (maxItems && selectedItems.size >= maxItems) {
            alert(`Maximum ${maxItems} items allowed`);
            return;
        }

        selectedItems.add(item);
        renderTags();
        input.value = '';
        renderDropdown(options.filter(opt => !selectedItems.has(opt)), '');
        updateHiddenInput();
        updateCounter();
    }

    function removeItem(item) {
        selectedItems.delete(item);
        renderTags();
        renderDropdown(options.filter(opt => !selectedItems.has(opt)), '');
        updateHiddenInput();
        updateCounter();
    }

    function renderTags() {
        tagsContainer.innerHTML = '';
        selectedItems.forEach(item => {
            const tag = document.createElement('div');
            tag.className = 'tag';
            tag.innerHTML = `
                <span>${item}</span>
                <span class="tag-remove" data-item="${item}">×</span>
            `;
            tag.querySelector('.tag-remove').addEventListener('click', () => removeItem(item));
            tagsContainer.appendChild(tag);
        });
    }

    function updateHiddenInput() {
        if (hiddenInput) {
            hiddenInput.value = Array.from(selectedItems).join(',');
        }
        // Also update the input field value for form data capture
        input.value = Array.from(selectedItems).join(',');
    }

    function updateCounter() {
        const label = input.closest('.form-group')?.querySelector('.counter');
        if (label && maxItems) {
            label.textContent = `${selectedItems.size}/${maxItems}`;
        }
    }
    
    // Store instance API for programmatic access
    multiSelectInstances[baseId] = {
        addItem,
        removeItem,
        clear: () => {
            selectedItems.clear();
            renderTags();
            updateHiddenInput();
            updateCounter();
        },
        setItems: (items) => {
            selectedItems.clear();
            items.forEach(item => {
                // Trim whitespace from item
                const trimmedItem = typeof item === 'string' ? item.trim() : item;
                
                // Try exact match first
                if (options.includes(trimmedItem)) {
                    selectedItems.add(trimmedItem);
                } else {
                    // Try case-insensitive match
                    const matchedOption = options.find(opt => 
                        opt.toLowerCase() === trimmedItem.toLowerCase()
                    );
                    if (matchedOption) {
                        selectedItems.add(matchedOption);
                        console.log(`📝 Matched "${trimmedItem}" to "${matchedOption}"`);
                    } else {
                        console.warn(`⚠️ Could not match item "${trimmedItem}" in ${baseId} options`);
                    }
                }
            });
            renderTags();
            updateHiddenInput();
            updateCounter();
        }
    };
}

function initTagsInput(fieldId, maxTags) {
    const input = document.getElementById(`${fieldId}-input`);
    const tagsDisplay = document.getElementById(`${fieldId}-tags`);
    const hiddenInput = document.getElementById(fieldId);

    if (!input || !tagsDisplay || !hiddenInput) return;

    const tags = [];

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const value = input.value.trim();

            if (value && tags.length < maxTags) {
                tags.push(value);
                renderTags();
                input.value = '';
                updateHiddenInput();
                updateCounter();
            } else if (tags.length >= maxTags) {
                alert(`Maximum ${maxTags} tags allowed`);
            }
        }
    });

    function renderTags() {
        tagsDisplay.innerHTML = '';
        tags.forEach((tag, index) => {
            const tagEl = document.createElement('div');
            tagEl.className = 'tag';
            tagEl.innerHTML = `
                <span>${tag}</span>
                <span class="tag-remove" data-index="${index}">×</span>
            `;
            tagEl.querySelector('.tag-remove').addEventListener('click', () => {
                tags.splice(index, 1);
                renderTags();
                updateHiddenInput();
                updateCounter();
            });
            tagsDisplay.appendChild(tagEl);
        });
    }

    function updateHiddenInput() {
        hiddenInput.value = tags.join(',');
    }

    function updateCounter() {
        const label = input.closest('.form-group')?.querySelector('.counter');
        if (label) {
            label.textContent = `${tags.length}/${maxTags}`;
        }
    }
}

function updatePillGroupValue(group, hiddenInput, isMultiple) {
    const activePills = group.querySelectorAll('.pill.active');

    if (isMultiple) {
        const values = Array.from(activePills).map(p => p.dataset.value);
        hiddenInput.value = values.join(',');
    } else {
        hiddenInput.value = activePills[0]?.dataset.value || '';
    }
}

function setupFileUpload(inputId, statusId) {
    const input = document.getElementById(inputId);
    const status = document.getElementById(statusId);

    if (!input || !status) return;

    input.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const maxSize = 5 * 1024 * 1024; // 5MB

            if (file.size > maxSize) {
                status.innerHTML = '<span class="status-text" style="color: var(--error-red);">File too large (max 5MB)</span>';
                input.value = '';
                return;
            }

            status.classList.add('success');
            status.innerHTML = `<span class="status-text">✓ ${file.name}</span>`;
        }
    });
}

function setupEventListeners() {
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    const submitBtn = document.getElementById('submit-btn');
    const saveExitBtn = document.getElementById('save-exit-btn');
    const form = document.getElementById('config-form');

    prevBtn?.addEventListener('click', previousStep);
    nextBtn?.addEventListener('click', nextStep);
    saveExitBtn?.addEventListener('click', saveAndExit);

    form?.addEventListener('submit', (e) => {
        e.preventDefault();
        submitForm();
    });
}

function setupGenderSelect() {
    const genderSelect = document.getElementById('gender');
    if (!genderSelect) {
        return;
    }

    const initialValue = genderSelect.value || '';
    window.formState.data.gender = initialValue;
    window.formState.data.genderIdentity = initialValue;

    genderSelect.addEventListener('change', (event) => {
        const value = event.target.value;
        window.formState.data.gender = value;
        window.formState.data.genderIdentity = value;
        debugLog('🧑‍🦰 [GENDER CHANGE] gender:', value, 'genderIdentity:', window.formState.data.genderIdentity);
    });
}

function initializeRequiredFieldHandling() {
    document.querySelectorAll('.form-step [required]').forEach((field) => {
        field.dataset.required = 'true';
    });

    syncStepRequiredAttributes();
}

function syncStepRequiredAttributes() {
    const activeStep = document.querySelector('.form-step.active');
    const activeStepId = activeStep?.dataset.step;

    document.querySelectorAll('[data-required="true"]').forEach((field) => {
        field.removeAttribute('required');

        const fieldStep = field.closest('.form-step')?.dataset.step;
        if (fieldStep && fieldStep === activeStepId) {
            field.setAttribute('required', '');
        }
    });
}

function previousStep() {
    if (formState.currentStep > 1) {
        saveStepData();
        formState.currentStep--;
        updateUI();
    }
}

function nextStep() {
    if (validateCurrentStep()) {
        saveStepData();

        if (formState.currentStep < formState.totalSteps) {
            formState.currentStep++;
            updateUI();
        }
    }
}

async function saveAndExit() {
    // Save all form data in one unified API call
    saveStepData();
    saveAllStepsData();

    const token = localStorage.getItem('authToken');
    if (!token) {
        alert('Please login first');
        window.location.href = '/login.html';
        return;
    }

    try {
        const headers = {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };

        await uploadFiles(token);
        const profileData = parseFormData();

        // Send all data in one request
    console.log('📤 [SAVE_AND_EXIT] Sending unified profile data to /api/user/profile:', profileData);
    console.log('🧑‍🦰 [SAVE_AND_EXIT] genderIdentity value:', profileData.genderIdentity);
    console.log('[SAVE_AND_EXIT] formState.data.gender:', window.formState.data['gender'], 'formState.data.genderIdentity:', window.formState.data['genderIdentity']);
        const response = await fetch('/api/user/profile', {
            method: 'POST',
            headers,
            body: JSON.stringify(profileData)
        });

        if (response.ok) {
            const result = await response.json();
            console.log('✅ [SAVE_AND_EXIT] Success response:', result);
            showSuccessDialog('Progress saved successfully! You can continue where you left off next time.', () => {
                window.location.href = '/dashboard.html';
            });
        } else {
            const errorText = await response.text();
            console.error('❌ [SAVE_AND_EXIT] Error response:', errorText);
            showErrorDialog('Error saving progress. Please try again.');
        }
    } catch (error) {
        console.error('Save and exit error:', error);
        showErrorDialog('Error saving progress. Please try again.');
    }
}

function validateCurrentStep() {
    syncStepRequiredAttributes();

    const currentStepEl = document.querySelector(`.form-step[data-step="${formState.currentStep}"]`);
    const requiredFields = currentStepEl.querySelectorAll('[required]');

    let isValid = true;

    requiredFields.forEach(field => {
        if (!field.value || field.value.trim() === '') {
            isValid = false;
            field.classList.add('invalid');

            // Show validation message
            const group = field.closest('.form-group');
            let validationMsg = group?.querySelector('.validation-msg');

            if (!validationMsg) {
                validationMsg = document.createElement('div');
                validationMsg.className = 'validation-msg error';
                group?.appendChild(validationMsg);
            }

            validationMsg.textContent = 'This field is required';
            validationMsg.classList.remove('hidden');
        } else {
            field.classList.remove('invalid');
            field.classList.add('valid');

            const group = field.closest('.form-group');
            const validationMsg = group?.querySelector('.validation-msg');
            if (validationMsg) {
                validationMsg.classList.add('hidden');
            }
        }
    });

    if (!isValid) {
        alert('Please fill in all required fields');
    }

    return isValid;
}

function updateUI() {
    // Update steps
    document.querySelectorAll('.form-step').forEach(step => {
        step.classList.remove('active');
    });

    const currentStepEl = document.querySelector(`.form-step[data-step="${formState.currentStep}"]`);
    currentStepEl?.classList.add('active');

    syncStepRequiredAttributes();

    // Update progress
    document.querySelectorAll('.progress-step').forEach(step => {
        const stepNum = parseInt(step.dataset.step);
        step.classList.remove('active', 'completed');

        if (stepNum === formState.currentStep) {
            step.classList.add('active');
        } else if (stepNum < formState.currentStep) {
            step.classList.add('completed');
        }
    });

    document.getElementById('current-step').textContent = formState.currentStep;

    // Update buttons
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    const submitBtn = document.getElementById('submit-btn');

    prevBtn.disabled = formState.currentStep === 1;

    if (formState.currentStep === formState.totalSteps) {
        nextBtn?.classList.add('hidden');
        submitBtn?.classList.remove('hidden');
    } else {
        nextBtn?.classList.remove('hidden');
        submitBtn?.classList.add('hidden');
    }

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function saveStepData() {
    const currentStepEl = document.querySelector(`.form-step[data-step="${formState.currentStep}"]`);
    const inputs = currentStepEl.querySelectorAll('input, select, textarea');

    console.log(`💾 [saveStepData] Saving data for step ${formState.currentStep}`);

    inputs.forEach(input => {
        if (input.type === 'file') return;

        if (input.type === 'checkbox') {
            formState.data[input.id] = input.checked;
        } else {
            formState.data[input.id] = input.value;
        }

        // Log screening-related fields
        const screeningFields = ['experience-summary', 'hybrid-preference', 'travel-comfortable',
                                'relocation-open', 'languages-input', 'date-of-birth', 'gpa',
                                'age-18', 'gender', 'disability', 'military', 'ethnicity', 'licenses'];
        if (input.id && screeningFields.includes(input.id)) {
            console.log(`  📝 [saveStepData] Screening field [${input.id}] = "${input.value || input.checked}"`);
        }
    });

    // Also save screening section inputs (outside of numbered steps)
    const screeningSection = document.getElementById('screening-content');
    if (screeningSection) {
        const screeningInputs = screeningSection.querySelectorAll('input, select, textarea');
        screeningInputs.forEach(input => {
            if (input.type === 'file') return;
            if (input.type === 'checkbox') {
                formState.data[input.id] = input.checked;
            } else {
                formState.data[input.id] = input.value;
            }
        });
    }

    // Save to localStorage
    localStorage.setItem('autoApplyFormState', JSON.stringify(formState));
}

function saveAllStepsData() {
    // Save data from ALL steps, not just current one
    const allSteps = document.querySelectorAll('.form-step');
    
    console.log('🔍 saveAllStepsData() - Collecting data from all steps...');

    allSteps.forEach((stepEl, stepIndex) => {
        const stepNum = stepEl.getAttribute('data-step');
        const inputs = stepEl.querySelectorAll('input, select, textarea');
        console.log(`  Step ${stepNum}: Found ${inputs.length} inputs`);
        
        inputs.forEach(input => {
            if (input.type === 'file') return;

            if (input.type === 'checkbox') {
                formState.data[input.id] = input.checked;
                if (input.id) {
                    console.log(`    ✓ [${input.id}] = ${input.checked} (checkbox)`);
                }
            } else {
                // ALWAYS save the value, even if empty, to ensure formState.data reflects current state
                formState.data[input.id] = input.value;
                const logFieldIds = ['full-name', 'phone', 'country', 'availability', 'current-job',
                                    'experience-summary', 'hybrid-preference', 'travel-comfortable',
                                    'relocation-open', 'languages-input', 'date-of-birth', 'gpa',
                                    'age-18', 'gender', 'disability', 'military', 'ethnicity', 'licenses'];
                if (input.id && logFieldIds.includes(input.id)) {
                    console.log(`    ✓ [${input.id}] = "${input.value}"`);
                }
            }
        });
    });

    // Also capture screening section inputs that are outside the step flow
    const screeningSection = document.getElementById('screening-content');
    if (screeningSection) {
        const screeningInputs = screeningSection.querySelectorAll('input, select, textarea');
        console.log(`  Screening section: Found ${screeningInputs.length} inputs`);
        screeningInputs.forEach(input => {
            if (input.type === 'file') return;
            if (input.type === 'checkbox') {
                formState.data[input.id] = input.checked;
                if (input.id) console.log(`    ✓ [${input.id}] = ${input.checked} (checkbox)`);
            } else {
                formState.data[input.id] = input.value;
                if (input.id) console.log(`    ✓ [${input.id}] = "${input.value}"`);
            }
        });
    }

    console.log('📦 Final formState.data keys:', Object.keys(formState.data));

    // Save to localStorage
    localStorage.setItem('autoApplyFormState', JSON.stringify(formState));
}

function loadSavedState() {
    const saved = localStorage.getItem('autoApplyFormState');
    if (saved) {
        const savedState = JSON.parse(saved);
        Object.keys(savedState.data).forEach(key => {
            const input = document.getElementById(key);
            if (input) {
                if (input.type === 'checkbox') {
                    input.checked = savedState.data[key];
                } else {
                    input.value = savedState.data[key];
                    if (key === 'gender') {
                        window.formState.data['genderIdentity'] = savedState.data[key];
                        console.log('[GENDER RESTORE] gender:', savedState.data[key], 'genderIdentity:', window.formState.data['genderIdentity']);
                    }
                }
            }
        });
    }
}

async function submitForm() {
    // Validate current step before submitting
    if (!validateCurrentStep()) {
        return;
    }
    
    // CRITICAL: Save ALL steps' data, not just current step
    saveAllStepsData();

    console.log('✅ Captured all form data for submit:', {
        fullName: formState.data['full-name'],
        phone: formState.data['phone'],
        countryCode: formState.data['country-code'],
        locationCountry: formState.data['location-country'],
        currentJobTitle: formState.data['current-job-title'],
        availability: formState.data['availability'],
        eligibleCountries: formState.data['eligible-countries'],
        visaSponsorship: formState.data['visa-sponsorship'],
        experienceSummary: formState.data['experience-summary'],
        hybridPreference: formState.data['hybrid-preference']
    });
    
    // Parse and log the parsed data
    const parsedData = parseFormData();
    console.log('📊 Parsed form data:', {
        step2: {
            fullName: parsedData.fullName,
            email: parsedData.email,
            phone: parsedData.phone,
            country: parsedData.country,
            city: parsedData.city,
            stateRegion: parsedData.stateRegion,
            postalCode: parsedData.postalCode
        },
        step3: {
            currentJobTitle: parsedData.currentJobTitle,
            availability: parsedData.availability,
            eligibleCountries: parsedData.eligibleCountries,
            visaSponsorship: parsedData.visaSponsorship,
            nationality: parsedData.nationality
        }
    });

    // Check if user is authenticated
    const token = localStorage.getItem('authToken');
    if (!token) {
        alert('Please login first');
        window.location.href = '/login.html';
        return;
    }

    try {
        // Save each step to the API
        const headers = {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };

        // Upload files first if any
        await uploadFiles(token);

        // Parse form data into structured objects AFTER uploading files
        // so that resumePath and coverLetterPath are included
        const data = parseFormData();

        // 🔍 AUTO-VALIDATION: Check Step 2 critical fields before submission
        const criticalStep2Fields = {
            fullName: data.fullName,
            email: data.email,
            country: data.country
        };
        const emptyStep2Fields = Object.entries(criticalStep2Fields)
            .filter(([key, value]) => !value || value.trim() === '')
            .map(([key]) => key);
        
        if (emptyStep2Fields.length > 0) {
            console.warn('⚠️ WARNING: Step 2 critical fields are empty:', emptyStep2Fields);
            console.log('📋 Current Step 2 data:', {
                fullName: data.fullName,
                email: data.email,
                country: data.country,
                phone: data.phone,
                city: data.city
            });
            console.log('💡 TIP: Check that form inputs have IDs matching the expected field names');
        } else {
            console.log('✅ Step 2 validation passed - all critical fields populated');
        }

        // Save step 1 (Job Preferences)
        await fetch('/api/wizard/step1', {
            method: 'POST',
            headers,
            body: JSON.stringify({
                remoteJobs: data.remoteJobs || [],
                onsiteLocation: data.onsiteLocation || '',
                jobTypes: data.jobTypes || [],
                jobTitles: data.jobTitles || [],
                seniorityLevels: data.seniorityLevels || [],
                timeZones: data.timeZones || []
            })
        });

        // Save step 2 (Profile)
        const step2Payload = {
            fullName: data.fullName || '',
            email: data.email || '',
            resumePath: data.resumePath || '',
            coverLetterOption: data.coverLetterOption || '',
            coverLetterPath: data.coverLetterPath || '',
            phone: data.phone || '',
            country: data.country || '',
            city: data.city || '',
            stateRegion: data.stateRegion || '',
            postalCode: data.postalCode || ''
        };
        
        // 🔍 VALIDATION: Count empty fields in payload
        const emptyFieldCount = Object.entries(step2Payload).filter(([k, v]) => !v || v === '').length;
        if (emptyFieldCount === Object.keys(step2Payload).length) {
            console.error('❌ CRITICAL: All Step 2 fields are empty! Payload:', step2Payload);
            console.log('💡 DEBUG: Check formState.data before parseFormData():', formState.data);
        } else if (emptyFieldCount > 0) {
            console.warn(`⚠️ Step 2 has ${emptyFieldCount}/${Object.keys(step2Payload).length} empty fields`);
        }
        
        console.log('📤 Sending Step 2 (Profile) to /api/wizard/step2:', step2Payload);
        await fetch('/api/wizard/step2', {
            method: 'POST',
            headers,
            body: JSON.stringify(step2Payload)
        });

        // Save step 3 (Eligibility)
        const step3Payload = {
            currentJobTitle: data.currentJobTitle || '',
            availability: data.availability || '',
            eligibleCountries: data.eligibleCountries || [],
            visaSponsorship: data.visaSponsorship === 'yes',
            nationality: data.nationality || [],
            currentSalary: data.currentSalary || null,
            expectedSalary: data.expectedSalary || null
        };
        console.log('📤 Sending Step 3 (Eligibility) to /api/wizard/step3:', step3Payload);
        await fetch('/api/wizard/step3', {
            method: 'POST',
            headers,
            body: JSON.stringify(step3Payload)
        });

        // Save screening answers - ALWAYS submit like other fields (no conditional logic)
        console.log('📝 [SCREENING] Saving screening data (using simple pattern like job preferences)');
        
        const screeningPayload = {
            experienceSummary: data.experienceSummary || '',
            hybridPreference: data.hybridPreference || '',
            travel: data.travel || '',
            relocation: data.relocation || '',
            languages: data.languages || [],
            dateOfBirth: data.dateOfBirth || null,
            gpa: data.gpa || null,
            isAdult: data.isAdult === 'yes',
            genderIdentity: data.genderIdentity || '',
            disabilityStatus: data.disabilityStatus || '',
            militaryService: data.militaryService || '',
            ethnicity: data.ethnicity || '',
            drivingLicense: data.drivingLicense || ''
        };

        console.log('📤 [SCREENING] Sending to /api/wizard/screening:', screeningPayload);

        const screeningResponse = await fetch('/api/wizard/screening', {
            method: 'POST',
            headers,
            body: JSON.stringify(screeningPayload)
        });

        if (!screeningResponse.ok) {
            const errorText = await screeningResponse.text();
            console.error('❌ [SCREENING] Error:', errorText);
            throw new Error(`Screening submission failed: ${errorText}`);
        }

        const screeningResult = await screeningResponse.json();
        console.log('✅ [SCREENING] Success:', screeningResult);

        showSuccessDialog('✅ Profile saved successfully! All your job preferences and profile information have been saved.', () => {
            localStorage.removeItem('autoApplyFormState');
            window.location.href = '/dashboard.html';
        });

    } catch (error) {
        console.error('Submit error:', error);
        showErrorDialog('Error saving configuration. Please try again.');
    }
}

function parseFormData() {
    const data = formState.data;
    
    console.log('🔍 parseFormData() - Raw formState.data relevant fields:', {
        'full-name': data['full-name'],
        'email': data['email'],
        'phone': data['phone'],
        'country-code': data['country-code'],
        'location-country': data['location-country'],
        'location-city': data['location-city'],
        'current-job-title': data['current-job-title'],
        'availability': data['availability'],
        'eligible-countries': data['eligible-countries'],
        'visa-sponsorship': data['visa-sponsorship']
    });

    const parsed = {
        // Step 1
        remoteJobs: parseCommaSeparated(data['remote-countries-input']),
        onsiteLocation: data['onsite-region'] || '',
        jobTypes: parseCommaSeparated(data['job-types']),
        jobTitles: parseCommaSeparated(data['job-titles']),
        seniorityLevels: parseCommaSeparated(data['seniority-levels']),
        timeZones: parseCommaSeparated(data['timezones-input']),

        // Step 2
        fullName: data['full-name'] || '',
        email: data['email'] || '',
        resumePath: data.resumePath || '',
        coverLetterOption: data['cover-letter-option'] || '',
        coverLetterPath: data.coverLetterPath || '',
        phone: `${data['country-code'] || ''}${data['phone'] || ''}`,
        country: data['location-country'] || '',
        city: data['location-city'] || '',
        stateRegion: data['location-state'] || '',
        postalCode: data['location-postal'] || '',

        // Step 3
        currentJobTitle: data['current-job-title'] || '',
        availability: data['availability'] || '',
        eligibleCountries: parseCommaSeparated(data['eligible-countries']),
        visaSponsorship: data['visa-sponsorship'] || '',
        nationality: parseCommaSeparated(data['nationalities']),
        currentSalary: data['current-salary'] || null,
        expectedSalary: data['expected-salary'] || null,

        // Screening - FIXED FIELD NAMES FOR BACKEND COMPATIBILITY
        experienceSummary: data['experience-summary'] || '',
        hybridPreference: data['hybrid-preference'] || '',
        travel: data['travel-comfortable'] || '',
        relocation: data['relocation-open'] || '',
        languages: parseCommaSeparated(data['languages-input']),
        dateOfBirth: data['date-of-birth'] || null,
        gpa: data['gpa'] || null,
        isAdult: data['age-18'] || '',
        genderIdentity: data['gender'] || '',           // FIXED: was 'gender'
        disabilityStatus: data['disability'] || '',     // FIXED: was 'disability'
        militaryService: data['military'] || '',        // FIXED: was 'military'
        ethnicity: data['ethnicity'] || '',
        drivingLicense: data['no-license'] === true ? 'No driver\'s license' : (data['licenses'] || ''), // FIXED: was 'licenses'
        noLicense: data['no-license'] || false
    };

    console.log('📊 [parseFormData] Screening data extracted (FIXED FIELD NAMES):', {
        experienceSummary: parsed.experienceSummary || '(empty)',
        hybridPreference: parsed.hybridPreference || '(empty)',
        travel: parsed.travel || '(empty)',
        relocation: parsed.relocation || '(empty)',
        languages: parsed.languages,
        dateOfBirth: parsed.dateOfBirth || '(empty)',
        gpa: parsed.gpa || '(empty)',
        isAdult: parsed.isAdult || '(empty)',
        genderIdentity: parsed.genderIdentity || '(empty)',     // FIXED: was gender
        disabilityStatus: parsed.disabilityStatus || '(empty)', // FIXED: was disability
        militaryService: parsed.militaryService || '(empty)',   // FIXED: was military
        ethnicity: parsed.ethnicity || '(empty)',
        drivingLicense: parsed.drivingLicense || '(empty)'      // FIXED: was licenses
    });

    console.log('📊 parseFormData() - Parsed data (Step 2 & 3):', {
        step2: {
            fullName: parsed.fullName,
            email: parsed.email,
            phone: parsed.phone,
            country: parsed.country,
            city: parsed.city
        },
        step3: {
            currentJobTitle: parsed.currentJobTitle,
            availability: parsed.availability,
            eligibleCountries: parsed.eligibleCountries,
            visaSponsorship: parsed.visaSponsorship
        }
    });
    
    return parsed;
}

function parseCommaSeparated(value) {
    if (!value) return [];
    return value.split(',').map(v => v.trim()).filter(v => v);
}

// hasScreeningData function removed - now using simple always-submit pattern like other fields

async function uploadFiles(token) {
    const resumeFile = document.getElementById('resume-upload')?.files[0];
    const coverLetterFile = document.getElementById('cover-letter-file')?.files[0];

    if (resumeFile || coverLetterFile) {
        const formData = new FormData();
        if (resumeFile) formData.append('resume', resumeFile);
        if (coverLetterFile) formData.append('coverLetter', coverLetterFile);

        const response = await fetch('/api/autoapply/upload', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });

        const result = await response.json();
        if (result.success && result.data) {
            formState.data.resumePath = result.data.resumePath;
            formState.data.coverLetterPath = result.data.coverLetterPath;
        }
    }
}


// Helper function to convert step names to numbers
function getStepNumber(stepName) {
    const stepMap = {
        'step1': 1,
        'step2': 2, 
        'step3': 3,
        'step4': 4,
        '1': 1,  // Support direct number strings from dashboard
        '2': 2,
        '3': 3,
        '4': 4
    };
    return stepMap[stepName] || 1;
}

// Duplicate function removed - using the enhanced version at the top of the file

// Populate form fields with user data
// Duplicate function removed - using the enhanced version at the top of the file

// Helper function to add job titles to the tags input
function addJobTitle(title) {
    const tagsDisplay = document.getElementById('job-titles-tags');
    const hiddenInput = document.getElementById('job-titles');
    
    if (!tagsDisplay || !hiddenInput) {
        console.warn('Job titles elements not found');
        return;
    }
    
    // Get existing tags
    const currentTags = hiddenInput.value ? hiddenInput.value.split(',') : [];
    
    // Don't add duplicates
    if (currentTags.includes(title)) {
        console.log(`Tag "${title}" already exists`);
        return;
    }
    
    // Create tag element
    const tagEl = document.createElement('div');
    tagEl.className = 'tag';
    tagEl.innerHTML = `
        <span>${title}</span>
        <span class="tag-remove" onclick="this.parentElement.remove(); updateJobTitlesHiddenInput();">×</span>
    `;
    
    // Add to display
    tagsDisplay.appendChild(tagEl);
    
    // Update hidden input
    updateJobTitlesHiddenInput();
    
    // Update counter
    const counter = document.querySelector('#job-titles-input').closest('.form-group')?.querySelector('.counter');
    if (counter) {
        const tagCount = tagsDisplay.querySelectorAll('.tag').length;
        counter.textContent = `${tagCount}/5`;
    }
}

// Helper function to update the hidden input from displayed tags
function updateJobTitlesHiddenInput() {
    const tagsDisplay = document.getElementById('job-titles-tags');
    const hiddenInput = document.getElementById('job-titles');
    
    if (!tagsDisplay || !hiddenInput) return;
    
    const tags = Array.from(tagsDisplay.querySelectorAll('.tag span:first-child')).map(span => span.textContent);
    hiddenInput.value = tags.join(',');
    
    console.log('Updated job titles:', hiddenInput.value);
}

// Convert user data to form state format
function convertUserDataToFormState(userData) {
    console.log('🔄 Converting user data to form state');
    const formData = {};
    
    // userData is now guaranteed to be in flat snake_case format thanks to normalization
    
    // Helper: activate a pill within the pill-group associated with a specific hidden input
    function activatePillForHiddenInput(hiddenInputId, value) {
        const hiddenInput = document.getElementById(hiddenInputId);
        if (!hiddenInput) {
            console.warn(`[PILL ACTIVATE] Hidden input not found: #${hiddenInputId}`);
            return false;
        }
        // Find the pill-group adjacent to or within the same form-group as the hidden input
        let group = null;
        if (hiddenInput.previousElementSibling && hiddenInput.previousElementSibling.classList && hiddenInput.previousElementSibling.classList.contains('pill-group')) {
            group = hiddenInput.previousElementSibling;
        } else {
            const fg = hiddenInput.closest('.form-group');
            group = fg ? fg.querySelector('.pill-group') : null;
        }
        if (!group) {
            console.warn(`[PILL ACTIVATE] Pill group not found for hidden input: #${hiddenInputId}`);
            return false;
        }
        // Clear existing selection only within this group
        group.querySelectorAll('.pill.active').forEach(p => p.classList.remove('active'));
        const pill = group.querySelector(`.pill[data-value="${value}"]`);
        if (!pill) {
            console.warn(`[PILL ACTIVATE] Pill with value "${value}" not found for #${hiddenInputId}`);
            // Still set the hidden input so data submits correctly
            hiddenInput.value = value;
            if (window.formState) window.formState.data[hiddenInputId] = value;
            return false;
        }
        pill.classList.add('active');
        hiddenInput.value = value;
        if (window.formState) window.formState.data[hiddenInputId] = value;
        return true;
    }
    
    // Clear all existing pill selections first to ensure clean state
    console.log('🧹 Clearing existing pill selections...');
    document.querySelectorAll('.pill.active').forEach(pill => {
        pill.classList.remove('active');
    });
    
    // Step 1: Job Preferences - Job types (activate pill buttons)
    const jobTypes = userData.job_types;
    if (jobTypes) {
        console.log('📋 Processing job types:', jobTypes);
        const jobTypesArray = Array.isArray(jobTypes) ? jobTypes : (jobTypes || '').split(',').filter(Boolean);
        jobTypesArray.forEach(jobType => {
            const pill = document.querySelector(`.pill[data-value="${jobType.trim().toLowerCase()}"]`);
            if (pill) {
                pill.classList.add('active');
                console.log(`✅ Activated job type: ${jobType}`);
            }
        });
        // Update hidden input for job types
        const jobTypesInput = document.getElementById('job-types');
        if (jobTypesInput) {
            jobTypesInput.value = jobTypesArray.map(t => t.trim().toLowerCase()).join(',');
        }
    }
    
    // Job titles - populate tags input
    const jobTitles = userData.job_titles;
    if (jobTitles) {
        console.log('📋 Processing job titles:', jobTitles);
        const jobTitlesArray = Array.isArray(jobTitles) ? jobTitles : (jobTitles || '').split(',').filter(Boolean);
        const jobTitlesInput = document.getElementById('job-titles');
        const tagsContainer = document.getElementById('job-titles-tags');
        if (jobTitlesInput && tagsContainer) {
            // Clear existing tags
            tagsContainer.innerHTML = '';
            jobTitlesArray.forEach(title => {
                addJobTitle(title.trim());
                console.log(`✅ Added job title: ${title}`);
            });
        }
    }
    
    // Remote countries - populate multi-select by directly updating the tags
    const remoteJobs = userData.remote_jobs;
    if (remoteJobs) {
        console.log('🌍 Processing remote jobs:', remoteJobs);
        const remoteArray = Array.isArray(remoteJobs) ? remoteJobs : (remoteJobs || '').split(',').filter(Boolean);
        populateMultiSelect('remote-countries', remoteArray);
    }
    
    // Onsite location
    const onsiteLocation = userData.onsite_location;
    if (onsiteLocation) {
        formData['onsite-region'] = onsiteLocation;
        console.log(`✅ Set onsite location: ${onsiteLocation}`);
    }
    
    // Step 2: Seniority & Time Zones - Seniority levels (activate pill buttons)
    const seniorityLevels = userData.seniority_levels;
    if (seniorityLevels) {
        console.log('📊 Processing seniority levels:', seniorityLevels);
        const seniorityArray = Array.isArray(seniorityLevels) ? seniorityLevels : (seniorityLevels || '').split(',').filter(Boolean);
        seniorityArray.forEach(level => {
            const pill = document.querySelector(`.pill[data-value="${level.trim().toLowerCase()}"]`);
            if (pill) {
                pill.classList.add('active');
                console.log(`✅ Activated seniority: ${level}`);
            }
        });
        // Update hidden input for seniority levels
        const seniorityInput = document.getElementById('seniority-levels');
        if (seniorityInput) {
            seniorityInput.value = seniorityArray.map(s => s.trim().toLowerCase()).join(',');
        }
    }
    
    // Time zones
    const timeZones = userData.time_zones;
    if (timeZones) {
        console.log('🕐 Processing time zones:', timeZones);
        const timeZonesArray = Array.isArray(timeZones) ? timeZones : (timeZones || '').split(',').filter(Boolean);
        populateMultiSelect('timezones', timeZonesArray);
    }
    
    // Step 3: Personal information
    console.log('👤 Processing personal info');
    
    // Full name
    if (userData.full_name) {
        formData['full-name'] = userData.full_name;
        console.log(`✅ Set full name: ${formData['full-name']}`);
    }
    
    // Email field (comes from users table)
    if (userData.email) {
        formData['email'] = userData.email;
        console.log('✅ Set email');
    }
    
    // Phone field - need to split into country code and number
    const phone = userData.phone || '';
    if (phone) {
        // Extract country code (assumes format like "+1234567890")
        const phoneMatch = phone.match(/^(\+\d{1,3})(.+)$/);
        if (phoneMatch) {
            formData['country-code'] = phoneMatch[1];
            formData['phone'] = phoneMatch[2];
            console.log('✅ Set phone');
        } else {
            // If no country code, just set the phone number
            formData['phone'] = phone;
            console.log('✅ Set phone');
        }
    }
    
    // Location fields - use correct IDs matching HTML
    if (userData.city || userData.country || userData.state_region || userData.postal_code) {
        formData['location-city'] = userData.city || '';
        formData['location-state'] = userData.state_region || '';
        formData['location-postal'] = userData.postal_code || '';
        formData['location-country'] = userData.country || '';
        console.log(`✅ Set location: ${formData['location-country']}, ${formData['location-city']}, ${formData['location-state']}, ${formData['location-postal']}`);
    }
    
    // Resume path
    if (userData.resume_path) {
        formData['resume-path'] = userData.resume_path;
        console.log(`✅ Set resume path: ${userData.resume_path}`);
    }
    
    // Cover letter option - activate pill buttons
    if (userData.cover_letter_option) {
        const coverLetterValue = userData.cover_letter_option.toLowerCase();
        const success = activatePillForHiddenInput('cover-letter-option', coverLetterValue);
        // Show/hide upload section based on option
        const uploadSection = document.getElementById('cover-letter-upload-section');
        if (uploadSection) {
            if (coverLetterValue === 'upload') {
                uploadSection.classList.remove('hidden');
            } else {
                uploadSection.classList.add('hidden');
            }
        }
        if (success) console.log(`✅ Set cover letter option: ${userData.cover_letter_option}`);
    }
    
    // Step 4: Eligibility information
    console.log('🎯 Processing eligibility');
    
    // Current job title
    if (userData.current_job_title) {
        formData['current-job-title'] = userData.current_job_title;
        console.log(`✅ Set current job title`);
    }
    
    // Salary fields
    if (userData.expected_salary) {
        formData['expected-salary'] = userData.expected_salary;
        console.log(`✅ Set expected salary`);
    }
    if (userData.current_salary) {
        formData['current-salary'] = userData.current_salary;
        console.log(`✅ Set current salary`);
    }
    
    // Availability - activate pill buttons
    const availability = userData.availability;
    if (availability) {
        const availabilityValue = availability.toLowerCase();
        if (activatePillForHiddenInput('availability', availabilityValue)) {
            console.log(`✅ Set availability: ${availability}`);
        }
    }
    
    // Visa sponsorship - activate pill buttons
    const visaSponsorship = userData.visa_sponsorship;
    if (visaSponsorship !== null && visaSponsorship !== undefined) {
        const visaValue = visaSponsorship ? 'yes' : 'no';
        if (activatePillForHiddenInput('visa-sponsorship', visaValue)) {
            console.log(`✅ Set visa sponsorship: ${visaValue}`);
        }
    }
    
    // Eligible countries - populate multi-select
    const eligibleCountries = userData.eligible_countries;
    if (eligibleCountries) {
        const countriesArray = Array.isArray(eligibleCountries) ? eligibleCountries : 
                              (typeof eligibleCountries === 'string' ? JSON.parse(eligibleCountries) : []);
        populateMultiSelect('eligible-countries', countriesArray);
        console.log(`✅ Set eligible countries: ${countriesArray.join(', ')}`);
    }
    
    // Nationality - populate multi-select
    const nationality = userData.nationality;
    if (nationality) {
        const nationalityArray = Array.isArray(nationality) ? nationality : 
                                (typeof nationality === 'string' ? JSON.parse(nationality) : []);
        populateMultiSelect('nationalities', nationalityArray);
        console.log('✅ Set nationalities');
    }
    
    // Screening answers
    console.log('📝 Processing screening answers');
    console.log('🔍 [SCREENING DATA LOAD] Raw screening data from database:', {
        experience_summary: userData.experience_summary || '(empty)',
        hybrid_preference: userData.hybrid_preference || '(empty)',
        travel: userData.travel || '(empty)',
        relocation: userData.relocation || '(empty)',
        languages: userData.languages || '(empty)',
        date_of_birth: userData.date_of_birth || '(empty)',
        gpa: userData.gpa || '(empty)',
        is_adult: userData.is_adult,
        gender_identity: userData.gender_identity || '(empty)',
        disability_status: userData.disability_status || '(empty)',
        military_service: userData.military_service || '(empty)',
        ethnicity: userData.ethnicity || '(empty)',
        driving_license: userData.driving_license || '(empty)'
    });

    // Check if there's any screening data to show
    const hasScreeningData = userData.experience_summary || userData.hybrid_preference ||
                            userData.travel || userData.relocation || userData.languages ||
                            userData.date_of_birth || userData.gpa || userData.is_adult !== null;

    console.log(`🔍 [SCREENING DATA LOAD] Has screening data: ${hasScreeningData ? 'YES' : 'NO'}`);

    // Note: Screening section is now always visible
    if (hasScreeningData) {
        console.log('✅ Loading screening data (section always visible)');
    }
    
    if (userData.experience_summary) {
        formData['experience-summary'] = userData.experience_summary;
        console.log(`✅ Set experience summary`);
    }
    
    // Hybrid preference - activate pill buttons
    if (userData.hybrid_preference) {
        const hybridValue = userData.hybrid_preference.toLowerCase();
        if (activatePillForHiddenInput('hybrid-preference', hybridValue)) {
            if (window.formState) window.formState.data['hybrid-preference'] = hybridValue;
            console.log(`✅ Set hybrid preference: ${userData.hybrid_preference}`);
        }
    }
    
    // Travel - activate pill buttons
    if (userData.travel) {
        const travelValue = userData.travel.toLowerCase();
        if (activatePillForHiddenInput('travel-comfortable', travelValue)) {
            console.log(`✅ Set travel: ${userData.travel}`);
        }
    }
    
    // Relocation - activate pill buttons
    if (userData.relocation) {
        const relocationValue = userData.relocation.toLowerCase();
        if (activatePillForHiddenInput('relocation-open', relocationValue)) {
            console.log(`✅ Set relocation: ${userData.relocation}`);
        }
    }
    
    // Languages - populate multi-select
    if (userData.languages) {
        const languagesArray = Array.isArray(userData.languages) ? userData.languages : 
                              (typeof userData.languages === 'string' ? JSON.parse(userData.languages) : []);
        populateMultiSelect('languages', languagesArray);
        console.log(`✅ Set languages: ${languagesArray.join(', ')}`);
    }
    
    // Date of birth
    if (userData.date_of_birth) {
        let dobValue = '';
        if (typeof userData.date_of_birth === 'string') {
            if (/^\d{4}-\d{2}-\d{2}$/.test(userData.date_of_birth)) {
                dobValue = userData.date_of_birth;
            } else {
                const d = new Date(userData.date_of_birth);
                if (!isNaN(d.getTime())) {
                    dobValue = d.toISOString().slice(0, 10);
                } else {
                    dobValue = userData.date_of_birth; // fallback
                }
            }
        } else if (userData.date_of_birth instanceof Date) {
            dobValue = userData.date_of_birth.toISOString().slice(0, 10);
        }
        if (dobValue) {
            formData['date-of-birth'] = dobValue;
            console.log('✅ Set date of birth');
        }
    }
    
    // GPA
    if (userData.gpa) {
        formData['gpa'] = userData.gpa;
        console.log(`✅ Set GPA: ${userData.gpa}`);
    }
    
    // Is adult (18+) - activate pill buttons
    if (userData.is_adult !== null && userData.is_adult !== undefined) {
        const isAdultValue = userData.is_adult ? 'yes' : 'no';
        if (activatePillForHiddenInput('age-18', isAdultValue)) {
            console.log(`✅ Set is adult: ${isAdultValue}`);
        }
    }
    
    // Gender identity
    if (userData.gender_identity) {
        formData['gender'] = userData.gender_identity;
        console.log('✅ Set gender');
    }
    
    // Disability status
    if (userData.disability_status) {
        formData['disability'] = userData.disability_status;
        console.log('✅ Set disability');
    }
    
    // Military service
    if (userData.military_service) {
        formData['military'] = userData.military_service;
        console.log('✅ Set military');
    }
    
    // Ethnicity
    if (userData.ethnicity) {
        formData['ethnicity'] = userData.ethnicity;
        console.log('✅ Set ethnicity');
    }
    
    // Driving license
    if (userData.driving_license) {
        formData['licenses'] = userData.driving_license;
        console.log(`✅ Set licenses: ${userData.driving_license}`);
    } else if (userData.driving_license === null || userData.driving_license === '') {
        // If driving license is null/empty, might indicate no license
        const noLicenseCheckbox = document.getElementById('no-license');
        if (noLicenseCheckbox) {
            noLicenseCheckbox.checked = true;
            // Disable the licenses input
            const licensesInput = document.getElementById('licenses');
            if (licensesInput) {
                licensesInput.disabled = true;
            }
            console.log(`✅ Set no-license checkbox`);
        }
    }
    
    console.log('✅ Form data conversion completed:', formData);
    return formData;
}

// Helper function to populate multi-select fields with existing values
function populateMultiSelect(baseId, values) {
    const instance = multiSelectInstances[baseId];
    
    if (!instance) {
        console.warn(`Multi-select instance for ${baseId} not found`);
        return;
    }
    
    // Use the instance API to set items
    instance.setItems(values);
    console.log(`✅ Populated ${baseId} with ${values.length} items`);
}

// Helper function to update multi-select hidden inputs
function updateMultiSelectHiddenInput(baseId) {
    const tagsContainer = document.getElementById(`${baseId}-tags`);
    const hiddenInput = document.getElementById(baseId);
    
    if (!tagsContainer || !hiddenInput) return;
    
    const tags = Array.from(tagsContainer.querySelectorAll('.tag span:first-child')).map(span => span.textContent);
    hiddenInput.value = tags.join(',');
    
    console.log(`Updated ${baseId}:`, hiddenInput.value);
}

// Helper function to update multi-select input fields (for fields without hidden inputs)
function updateMultiSelectInput(baseId) {
    const tagsContainer = document.getElementById(`${baseId}-tags`);
    const input = document.getElementById(`${baseId}-input`);
    
    if (!tagsContainer || !input) return;
    
    const tags = Array.from(tagsContainer.querySelectorAll('.tag span:first-child')).map(span => span.textContent);
    input.value = tags.join(',');
    
    console.log(`Updated ${baseId}-input:`, input.value);
}
// Force deployment Fri Oct  3 17:59:37 EDT 2025


// Custom Dialog Functions to Replace Basic Alerts
function showSuccessDialog(message, callback) {
    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10000;
    `;

    // Create modal dialog
    const modal = document.createElement('div');
    modal.className = 'success-modal';
    modal.style.cssText = `
        background: white;
        border-radius: 12px;
        padding: 32px;
        max-width: 400px;
        width: 90%;
        text-align: center;
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
    `;

    modal.innerHTML = `
        <div style="margin-bottom: 24px;">
            <div style="width: 64px; height: 64px; background: #10b981; border-radius: 50%; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center;">
                <svg width="32" height="32" fill="white" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                </svg>
            </div>
            <h3 style="margin: 0 0 8px 0; font-size: 18px; font-weight: 600; color: #111827;">Success!</h3>
            <p style="margin: 0; color: #6b7280; font-size: 14px;">${message}</p>
        </div>
        <button id="success-ok-btn" style="
            background: #3b82f6;
            color: white;
            border: none;
            border-radius: 8px;
            padding: 12px 24px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            width: 100%;
            transition: background-color 0.2s;
        ">OK</button>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Handle OK button click
    const okBtn = modal.querySelector('#success-ok-btn');
    okBtn.addEventListener('click', () => {
        document.body.removeChild(overlay);
        if (callback) callback();
    });

    // Handle overlay click (close modal)
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            document.body.removeChild(overlay);
            if (callback) callback();
        }
    });

    // Handle escape key
    const handleEscape = (e) => {
        if (e.key === 'Escape') {
            document.body.removeChild(overlay);
            document.removeEventListener('keydown', handleEscape);
            if (callback) callback();
        }
    };
    document.addEventListener('keydown', handleEscape);

    // Focus the OK button
    setTimeout(() => okBtn.focus(), 100);
}

function showErrorDialog(message) {
    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10000;
    `;

    // Create modal dialog
    const modal = document.createElement('div');
    modal.className = 'error-modal';
    modal.style.cssText = `
        background: white;
        border-radius: 12px;
        padding: 32px;
        max-width: 400px;
        width: 90%;
        text-align: center;
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
    `;

    modal.innerHTML = `
        <div style="margin-bottom: 24px;">
            <div style="width: 64px; height: 64px; background: #ef4444; border-radius: 50%; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center;">
                <svg width="32" height="32" fill="white" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
                </svg>
            </div>
            <h3 style="margin: 0 0 8px 0; font-size: 18px; font-weight: 600; color: #111827;">Error</h3>
            <p style="margin: 0; color: #6b7280; font-size: 14px;">${message}</p>
        </div>
        <button id="error-ok-btn" style="
            background: #ef4444;
            color: white;
            border: none;
            border-radius: 8px;
            padding: 12px 24px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            width: 100%;
            transition: background-color 0.2s;
        ">OK</button>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Handle OK button click
    const okBtn = modal.querySelector('#error-ok-btn');
    okBtn.addEventListener('click', () => {
        document.body.removeChild(overlay);
    });

    // Handle overlay click (close modal)
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            document.body.removeChild(overlay);
        }
    });

    // Handle escape key
    const handleEscape = (e) => {
        if (e.key === 'Escape') {
            document.body.removeChild(overlay);
            document.removeEventListener('keydown', handleEscape);
        }
    };
    document.addEventListener('keydown', handleEscape);

    // Focus the OK button
    setTimeout(() => okBtn.focus(), 100);
}
