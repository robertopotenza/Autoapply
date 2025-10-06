const { Pool } = require('pg');
require('dotenv-flow').config();

/**
 * Verification script to check if all wizard form fields are properly stored in the database
 * This script validates the complete data pipeline from form to database
 */

async function verifyDataStructure() {
    console.log('🔍 Starting database structure verification...\n');

    const pool = new Pool({
        connectionString: process.env.DATABASE_URL || undefined,
        host: process.env.PGHOST,
        user: process.env.PGUSER || 'postgres',
        password: process.env.PGPASSWORD,
        database: process.env.PGDATABASE || 'railway',
        port: process.env.PGPORT || 5432,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });

    try {
        await pool.query('SELECT NOW()');
        console.log('✅ Database connection successful\n');

        // Check all required tables
        const tables = ['job_preferences', 'profile', 'eligibility', 'screening_answers', 'jobs', 'applications'];
        console.log('📋 Checking required tables:');
        
        for (const table of tables) {
            const result = await pool.query(
                `SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_name = $1
                )`,
                [table]
            );
            console.log(`   ${result.rows[0].exists ? '✅' : '❌'} ${table}`);
        }

        console.log('\n📊 Checking job_preferences columns:');
        const jpColumns = ['remote_jobs', 'onsite_location', 'job_types', 'job_titles', 'seniority_levels', 'time_zones'];
        await checkColumns(pool, 'job_preferences', jpColumns);

        console.log('\n📊 Checking profile columns:');
        const profileColumns = ['full_name', 'email', 'resume_path', 'cover_letter_option', 'cover_letter_path', 
                               'phone', 'country', 'city', 'state_region', 'postal_code'];
        await checkColumns(pool, 'profile', profileColumns);

        console.log('\n📊 Checking eligibility columns:');
        const eligibilityColumns = ['current_job_title', 'availability', 'eligible_countries', 
                                   'visa_sponsorship', 'nationality', 'current_salary', 'expected_salary'];
        await checkColumns(pool, 'eligibility', eligibilityColumns);

        console.log('\n📊 Checking screening_answers columns:');
        const screeningColumns = ['experience_summary', 'hybrid_preference', 'travel', 'relocation', 
                                 'languages', 'date_of_birth', 'gpa', 'is_adult', 'gender_identity',
                                 'disability_status', 'military_service', 'ethnicity', 'driving_license'];
        await checkColumns(pool, 'screening_answers', screeningColumns);

        console.log('\n📊 Checking jobs table columns:');
        const jobsColumns = ['job_id', 'user_id', 'job_title', 'company_name', 'job_url', 'ats_type', 'source', 'external_id'];
        await checkColumns(pool, 'jobs', jobsColumns);

        console.log('\n📊 Checking applications table columns:');
        const applicationsColumns = ['application_id', 'user_id', 'job_id', 'status', 'application_mode', 'applied_at'];
        await checkColumns(pool, 'applications', applicationsColumns);

        console.log('\n✅ All required database structures verified successfully!\n');

        // Check if there's any test data
        const userCount = await pool.query('SELECT COUNT(*) FROM users');
        console.log(`📈 Database contains ${userCount.rows[0].count} user(s)\n`);

    } catch (error) {
        console.error('❌ Verification failed:', error.message);
        throw error;
    } finally {
        await pool.end();
    }
}

async function checkColumns(pool, tableName, columns) {
    for (const column of columns) {
        const result = await pool.query(
            `SELECT EXISTS (
                SELECT FROM information_schema.columns 
                WHERE table_name = $1 AND column_name = $2
            )`,
            [tableName, column]
        );
        console.log(`   ${result.rows[0].exists ? '✅' : '❌'} ${column}`);
    }
}

// Additional function to verify a specific user's data
async function verifyUserData(userEmail) {
    console.log(`🔍 Checking data for user: ${userEmail}\n`);

    const pool = new Pool({
        connectionString: process.env.DATABASE_URL || undefined,
        host: process.env.PGHOST,
        user: process.env.PGUSER || 'postgres',
        password: process.env.PGPASSWORD,
        database: process.env.PGDATABASE || 'railway',
        port: process.env.PGPORT || 5432,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });

    try {
        const result = await pool.query(
            `SELECT * FROM user_complete_profile WHERE email = $1`,
            [userEmail]
        );

        if (result.rows.length === 0) {
            console.log('❌ No user found with that email\n');
            return;
        }

        const user = result.rows[0];
        console.log('✅ User found! Data summary:\n');
        
        console.log('📝 Profile Information:');
        console.log(`   Full Name: ${user.full_name || '(not set)'}`);
        console.log(`   Email: ${user.email || '(not set)'}`);
        console.log(`   Phone: ${user.phone || '(not set)'}`);
        console.log(`   Location: ${user.city || '?'}, ${user.state_region || '?'}, ${user.country || '?'}`);
        
        console.log('\n💼 Job Preferences:');
        console.log(`   Remote Jobs: ${JSON.stringify(user.remote_jobs) || '[]'}`);
        console.log(`   Job Types: ${JSON.stringify(user.job_types) || '[]'}`);
        console.log(`   Job Titles: ${JSON.stringify(user.job_titles) || '[]'}`);
        console.log(`   Seniority Levels: ${JSON.stringify(user.seniority_levels) || '[]'}`);
        
        console.log('\n🌍 Eligibility:');
        console.log(`   Current Job Title: ${user.current_job_title || '(not set)'}`);
        console.log(`   Availability: ${user.availability || '(not set)'}`);
        console.log(`   Visa Sponsorship: ${user.visa_sponsorship ? 'Yes' : 'No'}`);
        console.log(`   Eligible Countries: ${JSON.stringify(user.eligible_countries) || '[]'}`);
        
        console.log('\n📋 Screening Info:');
        console.log(`   Languages: ${JSON.stringify(user.languages) || '[]'}`);
        console.log(`   Driving License: ${user.driving_license || '(not set)'}`);
        console.log(`   Gender: ${user.gender_identity || '(not set)'}`);
        
        console.log('\n✅ Data verification complete!\n');

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await pool.end();
    }
}

// Main execution
if (require.main === module) {
    const args = process.argv.slice(2);
    
    if (args.length > 0 && args[0] === '--user') {
        const email = args[1];
        if (!email) {
            console.error('Usage: node verify-database.js --user <email>');
            process.exit(1);
        }
        verifyUserData(email).catch(console.error);
    } else {
        verifyDataStructure().catch(console.error);
    }
}

module.exports = { verifyDataStructure, verifyUserData };
