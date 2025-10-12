#!/usr/bin/env node

/**
 * Manual Test Script for Remote Countries Round-Trip
 * 
 * This script performs a complete round-trip test for the remote countries field:
 * 1. Logs into a user account
 * 2. Selects specific remote countries in the wizard
 * 3. Saves the data via API
 * 4. Retrieves the data via API
 * 5. Verifies the remote countries are correctly saved and retrieved
 */

const fetch = require('node-fetch');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const TEST_EMAIL = 'test@example.com';
const TEST_PASSWORD = 'testpassword';

async function testRemoteCountriesRoundTrip() {
    console.log('🧪 Starting Remote Countries Round-Trip Test');
    console.log(`📡 Base URL: ${BASE_URL}`);

    try {
        // Step 1: Login to get auth token
        console.log('\n🔐 Step 1: Logging in...');
        const loginResponse = await fetch(`${BASE_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: TEST_EMAIL,
                password: TEST_PASSWORD
            })
        });

        if (!loginResponse.ok) {
            throw new Error(`Login failed: ${loginResponse.status} ${loginResponse.statusText}`);
        }

        const loginResult = await loginResponse.json();
        if (!loginResult.token) {
            throw new Error('No token received from login');
        }

        const token = loginResult.token;
        console.log('✅ Login successful');

        // Step 2: Save remote countries via Step 1 API
        console.log('\n💾 Step 2: Saving remote countries...');
        const testCountries = ['United States', 'United Kingdom', 'Canada'];
        
        const step1Payload = {
            remoteJobs: testCountries,
            onsiteLocation: 'San Francisco',
            jobTypes: ['Full-time'],
            jobTitles: ['Software Engineer'],
            seniorityLevels: ['Mid-level'],
            timeZones: ['UTC-08:00 (PST)']
        };

        console.log('📤 Sending Step 1 payload:', step1Payload);

        const saveResponse = await fetch(`${BASE_URL}/api/wizard/step1`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(step1Payload)
        });

        if (!saveResponse.ok) {
            const errorText = await saveResponse.text();
            throw new Error(`Save failed: ${saveResponse.status} ${saveResponse.statusText}\n${errorText}`);
        }

        const saveResult = await saveResponse.json();
        console.log('✅ Save successful:', saveResult);

        // Step 3: Retrieve data via wizard data API
        console.log('\n📥 Step 3: Retrieving wizard data...');
        
        const retrieveResponse = await fetch(`${BASE_URL}/api/wizard/data`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!retrieveResponse.ok) {
            const errorText = await retrieveResponse.text();
            throw new Error(`Retrieve failed: ${retrieveResponse.status} ${retrieveResponse.statusText}\n${errorText}`);
        }

        const retrieveResult = await retrieveResponse.json();
        console.log('✅ Retrieve successful');

        // Step 4: Verify remote countries are correctly saved and retrieved
        console.log('\n🔍 Step 4: Verifying remote countries...');
        
        if (!retrieveResult.data) {
            throw new Error('No data in retrieve result');
        }

        const savedRemoteJobs = retrieveResult.data.remote_jobs;
        console.log('📊 Retrieved remote_jobs:', savedRemoteJobs);
        console.log('📊 Expected countries:', testCountries);

        // Parse the saved data (could be JSON string or array)
        let savedCountries;
        if (typeof savedRemoteJobs === 'string') {
            try {
                savedCountries = JSON.parse(savedRemoteJobs);
            } catch (e) {
                savedCountries = savedRemoteJobs.split(',').map(s => s.trim()).filter(s => s);
            }
        } else if (Array.isArray(savedRemoteJobs)) {
            savedCountries = savedRemoteJobs;
        } else {
            throw new Error(`Unexpected remote_jobs type: ${typeof savedRemoteJobs}`);
        }

        console.log('🔍 Parsed saved countries:', savedCountries);

        // Verify all test countries are present
        let allPresent = true;
        let missingCountries = [];

        for (const country of testCountries) {
            if (!savedCountries.includes(country)) {
                allPresent = false;
                missingCountries.push(country);
            }
        }

        if (allPresent) {
            console.log('✅ SUCCESS: All remote countries saved and retrieved correctly!');
            console.log('🎉 Round-trip test PASSED');
        } else {
            console.log('❌ FAILURE: Some remote countries missing');
            console.log('🔍 Missing countries:', missingCountries);
            console.log('🔍 Expected:', testCountries);
            console.log('🔍 Retrieved:', savedCountries);
            process.exit(1);
        }

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        process.exit(1);
    }
}

// Run the test
testRemoteCountriesRoundTrip();