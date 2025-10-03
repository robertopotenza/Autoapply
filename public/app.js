// State Management
const formState = {
    currentStep: 1,
    totalSteps: 4,
    data: {}
};

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
    
    // Check if we're in edit mode (coming from dashboard)
    const editStep = localStorage.getItem('wizardStep');
    if (editStep) {
        // Load existing user data first, then navigate to the specific step
        loadExistingUserData().then(() => {
            const stepNumber = getStepNumber(editStep);
            if (stepNumber) {
                formState.currentStep = stepNumber;
                updateUI();
            }
        });
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

    // Collapsible section
    const screeningToggle = document.getElementById('screening-toggle');
    const screeningContent = document.getElementById('screening-content');
    if (screeningToggle && screeningContent) {
        screeningToggle.addEventListener('click', () => {
            screeningToggle.classList.toggle('active');
            screeningContent.classList.toggle('hidden');
        });
    }
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
    }

    function updateCounter() {
        const label = input.closest('.form-group')?.querySelector('.counter');
        if (label && maxItems) {
            label.textContent = `${selectedItems.size}/${maxItems}`;
        }
    }
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
    const form = document.getElementById('config-form');

    prevBtn?.addEventListener('click', previousStep);
    nextBtn?.addEventListener('click', nextStep);

    form?.addEventListener('submit', (e) => {
        e.preventDefault();
        submitForm();
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

function validateCurrentStep() {
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

    inputs.forEach(input => {
        if (input.type === 'file') return;

        if (input.type === 'checkbox') {
            formState.data[input.id] = input.checked;
        } else {
            formState.data[input.id] = input.value;
        }
    });

    // Save to localStorage
    localStorage.setItem('autoApplyFormState', JSON.stringify(formState));
}

function loadSavedState() {
    const saved = localStorage.getItem('autoApplyFormState');
    if (saved) {
        const savedState = JSON.parse(saved);

        // Restore form data
        Object.keys(savedState.data).forEach(key => {
            const input = document.getElementById(key);
            if (input) {
                if (input.type === 'checkbox') {
                    input.checked = savedState.data[key];
                } else {
                    input.value = savedState.data[key];
                }
            }
        });
    }
}

async function submitForm() {
    saveStepData();

    // Check if user is authenticated
    const token = localStorage.getItem('authToken');
    if (!token) {
        alert('Please login first');
        window.location.href = '/login.html';
        return;
    }

    try {
        // Parse form data into structured objects
        const data = parseFormData();

        // Save each step to the API
        const headers = {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };

        // Upload files first if any
        await uploadFiles(token);

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
        await fetch('/api/wizard/step2', {
            method: 'POST',
            headers,
            body: JSON.stringify({
                fullName: data.fullName || '',
                resumePath: data.resumePath || '',
                coverLetterOption: data.coverLetterOption || '',
                coverLetterPath: data.coverLetterPath || '',
                phone: data.phone || '',
                country: data.country || '',
                city: data.city || '',
                stateRegion: data.stateRegion || '',
                postalCode: data.postalCode || ''
            })
        });

        // Save step 3 (Eligibility)
        await fetch('/api/wizard/step3', {
            method: 'POST',
            headers,
            body: JSON.stringify({
                currentJobTitle: data.currentJobTitle || '',
                availability: data.availability || '',
                eligibleCountries: data.eligibleCountries || [],
                visaSponsorship: data.visaSponsorship === 'yes',
                nationality: data.nationality || [],
                currentSalary: data.currentSalary || null,
                expectedSalary: data.expectedSalary || null
            })
        });

        // Save screening answers if any
        if (hasScreeningData(data)) {
            await fetch('/api/wizard/screening', {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    experienceSummary: data.experienceSummary || '',
                    hybridPreference: data.hybridPreference || '',
                    travel: data.travel || '',
                    relocation: data.relocation || '',
                    languages: data.languages || [],
                    dateOfBirth: data.dateOfBirth || null,
                    gpa: data.gpa || null,
                    isAdult: data.isAdult === 'yes',
                    genderIdentity: data.gender || '',
                    disabilityStatus: data.disability || '',
                    militaryService: data.military || '',
                    ethnicity: data.ethnicity || '',
                    drivingLicense: data.licenses || ''
                })
            });
        }

        alert('Configuration saved successfully!');
        localStorage.removeItem('autoApplyFormState');
        window.location.href = '/dashboard.html';

    } catch (error) {
        console.error('Submit error:', error);
        alert('Error saving configuration. Please try again.');
    }
}

function parseFormData() {
    const data = formState.data;

    return {
        // Step 1
        remoteJobs: parseCommaSeparated(data['remote-countries-input']),
        onsiteLocation: data['onsite-region'] || '',
        jobTypes: parseCommaSeparated(data['job-types']),
        jobTitles: parseCommaSeparated(data['job-titles']),
        seniorityLevels: parseCommaSeparated(data['seniority-levels']),
        timeZones: parseCommaSeparated(data['timezones-input']),

        // Step 2
        fullName: data['full-name'] || '',
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

        // Screening
        experienceSummary: data['experience-summary'] || '',
        hybridPreference: data['hybrid-preference'] || '',
        travel: data['travel-comfortable'] || '',
        relocation: data['relocation-open'] || '',
        languages: parseCommaSeparated(data['languages-input']),
        dateOfBirth: data['date-of-birth'] || null,
        gpa: data['gpa'] || null,
        isAdult: data['age-18'] || '',
        gender: data['gender'] || '',
        disability: data['disability'] || '',
        military: data['military'] || '',
        ethnicity: data['ethnicity'] || '',
        licenses: data['licenses'] || ''
    };
}

function parseCommaSeparated(value) {
    if (!value) return [];
    return value.split(',').map(v => v.trim()).filter(v => v);
}

function hasScreeningData(data) {
    return data.experienceSummary || data.hybridPreference || data.travel ||
           data.relocation || data.languages?.length > 0;
}

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
        'step4': 4
    };
    return stepMap[stepName] || 1;
}

// Load existing user data for edit mode
async function loadExistingUserData() {
    const token = localStorage.getItem('authToken');
    if (!token) return;

    try {
        // Get all user data from the API
        const response = await fetch('/api/wizard/data', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            const result = await response.json();
            if (result.success && result.data) {
                const userData = result.data;
                
                // Populate form fields with existing data
                populateFormFields(userData);
                
                // Update form state
                formState.data = {
                    ...formState.data,
                    ...convertUserDataToFormState(userData)
                };
            }
        }
    } catch (error) {
        console.error('Error loading existing user data:', error);
    }
}

// Populate form fields with user data
function populateFormFields(userData) {
    // Step 1 - Job Preferences
    if (userData.jobPreferences) {
        const prefs = userData.jobPreferences;
        
        // Job types
        if (prefs.job_types) {
            const jobTypes = prefs.job_types.split(',');
            jobTypes.forEach(type => {
                const pill = document.querySelector(`[data-value="${type.trim()}"]`);
                if (pill) pill.classList.add('active');
            });
        }
        
        // Job titles
        if (prefs.job_titles) {
            const titles = prefs.job_titles.split(',');
            const titleInput = document.getElementById('job-titles');
            if (titleInput) titleInput.value = prefs.job_titles;
        }
        
        // Seniority levels
        if (prefs.seniority_levels) {
            const levels = prefs.seniority_levels.split(',');
            levels.forEach(level => {
                const pill = document.querySelector(`[data-value="${level.trim()}"]`);
                if (pill) pill.classList.add('active');
            });
        }
    }
    
    // Step 3 - Profile
    if (userData.profile) {
        const profile = userData.profile;
        
        if (profile.full_name) {
            const nameInput = document.getElementById('full-name');
            if (nameInput) nameInput.value = profile.full_name;
        }
        
        if (profile.phone) {
            const phoneInput = document.getElementById('phone');
            if (phoneInput) phoneInput.value = profile.phone;
        }
        
        if (profile.city) {
            const cityInput = document.getElementById('location-city');
            if (cityInput) cityInput.value = profile.city;
        }
        
        if (profile.state_region) {
            const stateInput = document.getElementById('location-state');
            if (stateInput) stateInput.value = profile.state_region;
        }
        
        if (profile.postal_code) {
            const postalInput = document.getElementById('location-postal');
            if (postalInput) postalInput.value = profile.postal_code;
        }
        
        if (profile.country) {
            const countrySelect = document.getElementById('location-country');
            if (countrySelect) countrySelect.value = profile.country;
        }
    }
    
    // Step 4 - Eligibility
    if (userData.eligibility) {
        const eligibility = userData.eligibility;
        
        if (eligibility.current_job_title) {
            const jobTitleInput = document.getElementById('current-job-title');
            if (jobTitleInput) jobTitleInput.value = eligibility.current_job_title;
        }
        
        if (eligibility.expected_salary) {
            const salaryInput = document.getElementById('expected-salary');
            if (salaryInput) salaryInput.value = eligibility.expected_salary;
        }
    }
}

// Convert user data to form state format
function convertUserDataToFormState(userData) {
    const formData = {};
    
    if (userData.jobPreferences) {
        formData['job-types'] = userData.jobPreferences.job_types || '';
        formData['job-titles'] = userData.jobPreferences.job_titles || '';
        formData['seniority-levels'] = userData.jobPreferences.seniority_levels || '';
    }
    
    if (userData.profile) {
        formData['full-name'] = userData.profile.full_name || '';
        formData['phone'] = userData.profile.phone || '';
        formData['location-city'] = userData.profile.city || '';
        formData['location-state'] = userData.profile.state_region || '';
        formData['location-postal'] = userData.profile.postal_code || '';
        formData['location-country'] = userData.profile.country || '';
    }
    
    if (userData.eligibility) {
        formData['current-job-title'] = userData.eligibility.current_job_title || '';
        formData['expected-salary'] = userData.eligibility.expected_salary || '';
    }
    
    return formData;
}
