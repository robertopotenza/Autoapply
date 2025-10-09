#!/usr/bin/env node
/**
 * @file Step 2 Data Flow Diagnostic Tool
 * @description Traces and validates Step 2 (Profile) data flow from frontend to database.
 * 
 * This tool helps detect where data is being lost in the pipeline:
 * 1. Frontend form inputs → formState.data
 * 2. formState.data → parseFormData() output
 * 3. Frontend payload → Backend API (/api/wizard/step2)
 * 4. Backend API → Profile.upsert()
 * 5. Profile.upsert() → PostgreSQL profile table
 * 
 * Usage:
 *   node scripts/diagnose-step2-flow.js [--verbose]
 */

const fs = require('fs');
const path = require('path');

console.log('╔══════════════════════════════════════════════════════════════╗');
console.log('║  Step 2 Profile Data Flow Diagnostic                        ║');
console.log('║  Traces: UI → formState → parseFormData → API → DB          ║');
console.log('╚══════════════════════════════════════════════════════════════╝\n');

// Step 1: Analyze frontend code
console.log('📋 Step 1: Analyzing Frontend Data Capture...\n');

const appJsPath = path.join(__dirname, '../public/app.js');
const appJs = fs.readFileSync(appJsPath, 'utf8');

// Check saveAllStepsData function
const hasSaveAllStepsData = appJs.includes('function saveAllStepsData()');
const saveAllStepsDataCalled = appJs.match(/saveAllStepsData\(\)/g);

console.log(`✓ saveAllStepsData() defined: ${hasSaveAllStepsData ? '✅ Yes' : '❌ No'}`);
console.log(`✓ saveAllStepsData() calls found: ${saveAllStepsDataCalled ? saveAllStepsDataCalled.length : 0}\n`);

// Check parseFormData function
const hasParseFormData = appJs.includes('function parseFormData()');
const parseFormDataCalls = appJs.match(/parseFormData\(\)/g);

console.log(`✓ parseFormData() defined: ${hasParseFormData ? '✅ Yes' : '❌ No'}`);
console.log(`✓ parseFormData() calls found: ${parseFormDataCalls ? parseFormDataCalls.length : 0}\n`);

// Check Step 2 field mappings in parseFormData
const step2FieldMappings = [
    { frontend: 'full-name', backend: 'fullName' },
    { frontend: 'email', backend: 'email' },
    { frontend: 'resumePath', backend: 'resumePath' },
    { frontend: 'country-code', backend: 'phone (part of)' },
    { frontend: 'phone', backend: 'phone (part of)' },
    { frontend: 'location-country', backend: 'country' },
    { frontend: 'location-city', backend: 'city' },
    { frontend: 'location-state', backend: 'stateRegion' },
    { frontend: 'location-postal', backend: 'postalCode' }
];

console.log('📝 Step 2 Field Mappings:\n');
step2FieldMappings.forEach(mapping => {
    const hasFrontendField = appJs.includes(`data['${mapping.frontend}']`);
    console.log(`  ${hasFrontendField ? '✅' : '❌'} ${mapping.frontend} → ${mapping.backend}`);
});
console.log('');

// Step 2: Check submitForm data flow order
console.log('📋 Step 2: Checking submitForm() Data Flow Order...\n');

const submitFormMatch = appJs.match(/async function submitForm\(\)[\s\S]*?(?=\nasync function|\nfunction [a-z]|$)/);
if (submitFormMatch) {
    const submitFormCode = submitFormMatch[0];
    
    // Find the positions of key operations
    const saveAllStepsPos = submitFormCode.indexOf('saveAllStepsData()');
    const uploadFilesPos = submitFormCode.indexOf('await uploadFiles(token)');
    const parseFormDataPos = submitFormCode.indexOf('const data = parseFormData()');
    const step2FetchPos = submitFormCode.indexOf("fetch('/api/wizard/step2'");

    console.log('Execution Order:');
    const operations = [
        { name: 'saveAllStepsData()', pos: saveAllStepsPos },
        { name: 'uploadFiles()', pos: uploadFilesPos },
        { name: 'parseFormData()', pos: parseFormDataPos },
        { name: 'Step 2 API call', pos: step2FetchPos }
    ].filter(op => op.pos !== -1).sort((a, b) => a.pos - b.pos);

    operations.forEach((op, index) => {
        console.log(`  ${index + 1}. ${op.name}`);
    });

    // Verify correct order
    const correctOrder = 
        saveAllStepsPos < uploadFilesPos &&
        uploadFilesPos < parseFormDataPos &&
        parseFormDataPos < step2FetchPos;

    console.log(`\n${correctOrder ? '✅' : '⚠️'} Data flow order is ${correctOrder ? 'CORRECT' : 'INCORRECT'}`);
    if (!correctOrder) {
        console.log('   Expected: saveAllStepsData() → uploadFiles() → parseFormData() → API call');
    }
} else {
    console.log('❌ Could not find submitForm() function');
}
console.log('');

// Step 3: Check backend endpoint configuration
console.log('📋 Step 3: Analyzing Backend API Endpoint...\n');

const wizardRoutesPath = path.join(__dirname, '../src/routes/wizard.js');
const wizardRoutes = fs.readFileSync(wizardRoutesPath, 'utf8');

const hasStep2Route = wizardRoutes.includes("router.post('/step2'");
const hasProfileUpsert = wizardRoutes.includes('Profile.upsert(userId, data)');
const hasDataLogging = wizardRoutes.includes('Step 2 data received for user');
const hasEmptyFieldDetection = wizardRoutes.includes('INCOMPLETE STEP 2 SUBMISSION');

console.log(`✓ POST /api/wizard/step2 endpoint: ${hasStep2Route ? '✅ Yes' : '❌ No'}`);
console.log(`✓ Profile.upsert() call: ${hasProfileUpsert ? '✅ Yes' : '❌ No'}`);
console.log(`✓ Data logging enabled: ${hasDataLogging ? '✅ Yes' : '❌ No'}`);
console.log(`✓ Empty field detection: ${hasEmptyFieldDetection ? '✅ Yes' : '❌ No'}\n`);

// Check if all Step 2 fields are logged
const step2BackendFields = [
    'fullName', 'email', 'resumePath', 'coverLetterOption', 
    'coverLetterPath', 'phone', 'country', 'city', 
    'stateRegion', 'postalCode'
];

console.log('Backend Field Logging:\n');
step2BackendFields.forEach(field => {
    const isLogged = wizardRoutes.includes(`${field}: data.${field}`);
    console.log(`  ${isLogged ? '✅' : '❌'} ${field}`);
});
console.log('');

// Step 4: Check Profile model
console.log('📋 Step 4: Analyzing Profile Model...\n');

const profileModelPath = path.join(__dirname, '../src/database/models/Profile.js');
const profileModel = fs.readFileSync(profileModelPath, 'utf8');

const hasUpsertMethod = profileModel.includes('static async upsert(userId, data)');
const hasOnConflictUpdate = profileModel.includes('ON CONFLICT (user_id) DO UPDATE');
const hasAllFields = step2BackendFields.every(field => {
    const snakeCase = field.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
    return profileModel.includes(snakeCase);
});

console.log(`✓ upsert() method: ${hasUpsertMethod ? '✅ Yes' : '❌ No'}`);
console.log(`✓ ON CONFLICT UPDATE: ${hasOnConflictUpdate ? '✅ Yes' : '❌ No'}`);
console.log(`✓ All fields mapped: ${hasAllFields ? '✅ Yes' : '❌ No'}\n`);

// Step 5: Check tests
console.log('📋 Step 5: Checking Test Coverage...\n');

const testsDir = path.join(__dirname, '../tests');
const testFiles = fs.readdirSync(testsDir).filter(f => f.includes('wizard-step2'));

console.log(`Found ${testFiles.length} Step 2 test file(s):\n`);
testFiles.forEach(file => {
    const testContent = fs.readFileSync(path.join(testsDir, file), 'utf8');
    const testCount = (testContent.match(/test\(/g) || []).length;
    console.log(`  ✓ ${file} (${testCount} test${testCount !== 1 ? 's' : ''})`);
});
console.log('');

// Step 6: Recommendations
console.log('╔══════════════════════════════════════════════════════════════╗');
console.log('║  Diagnostic Summary & Recommendations                        ║');
console.log('╚══════════════════════════════════════════════════════════════╝\n');

const issues = [];
const recommendations = [];

if (!hasSaveAllStepsData) {
    issues.push('❌ saveAllStepsData() function not found');
    recommendations.push('   → Implement saveAllStepsData() to capture form inputs');
}

if (!hasParseFormData) {
    issues.push('❌ parseFormData() function not found');
    recommendations.push('   → Implement parseFormData() to structure form data');
}

if (!hasStep2Route) {
    issues.push('❌ Backend endpoint POST /api/wizard/step2 not found');
    recommendations.push('   → Create Step 2 endpoint in src/routes/wizard.js');
}

if (!hasEmptyFieldDetection) {
    issues.push('⚠️  Empty field detection not enabled');
    recommendations.push('   → Add auto-detection for incomplete submissions');
}

if (issues.length === 0) {
    console.log('✅ All checks passed! Data flow appears to be properly configured.\n');
    console.log('If you\'re still experiencing issues:');
    console.log('  1. Check browser console for frontend errors');
    console.log('  2. Review server logs for backend warnings/errors');
    console.log('  3. Verify database connection and schema');
    console.log('  4. Run: npm test -- wizard-step2');
} else {
    console.log('Issues found:\n');
    issues.forEach(issue => console.log(`  ${issue}`));
    console.log('\nRecommendations:\n');
    recommendations.forEach(rec => console.log(`  ${rec}`));
}

console.log('\n╔══════════════════════════════════════════════════════════════╗');
console.log('║  Testing Instructions                                        ║');
console.log('╚══════════════════════════════════════════════════════════════╝\n');
console.log('To test Step 2 data flow manually:');
console.log('  1. Open browser DevTools (F12)');
console.log('  2. Navigate to /wizard.html');
console.log('  3. Fill in Step 2 form fields');
console.log('  4. Before clicking Next/Submit, run in console:');
console.log('     > console.log(formState.data)');
console.log('  5. Verify form data is captured');
console.log('  6. Click Next/Submit and check Network tab');
console.log('  7. Inspect the POST /api/wizard/step2 request body');
console.log('  8. Check server logs for warnings/errors\n');

console.log('To run automated tests:');
console.log('  npm test -- wizard-step2\n');
