#!/usr/bin/env node

const REQUIRED_ENV_VARS = ['DATABASE_URL', 'JWT_SECRET'];

function mask(value) {
    if (!value) {
        return 'not-set';
    }

    if (typeof value === 'string' && value.includes('postgres')) {
        return value.replace(/(postgres(?:ql)?:\/\/)([^:@]+)(?=:[^@]+@)/i, '$1****');
    }

    if (value.length <= 4) {
        return '****';
    }

    return `${value.slice(0, 2)}****${value.slice(-2)}`;
}

function checkEnvironment() {
    const missing = [];

    for (const key of REQUIRED_ENV_VARS) {
        if (!process.env[key]) {
            missing.push(key);
        }
    }

    return {
        missing,
        total: REQUIRED_ENV_VARS.length
    };
}

if (require.main === module) {
    const { missing } = checkEnvironment();

    if (missing.length > 0) {
        console.error('❌ check-env: missing required environment variables');
        missing.forEach((key) => {
            console.error(`   - ${key}`);
        });
        process.exit(1);
    }

    console.log('✅ check-env: all required environment variables are set');
    REQUIRED_ENV_VARS.forEach((key) => {
        console.log(`   - ${key}: ${mask(process.env[key])}`);
    });
    process.exit(0);
}

module.exports = { checkEnvironment };
