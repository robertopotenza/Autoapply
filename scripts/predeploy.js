#!/usr/bin/env node

const { spawn } = require('child_process');

const COMMANDS = [
    ['node', ['diagnostics/verify-database.js']],
    ['node', ['diagnostics/check-env.js']]
];

function runCommand([command, args]) {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, {
            stdio: 'inherit',
            shell: process.platform === 'win32'
        });

        child.on('close', (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`));
            }
        });

        child.on('error', (error) => {
            reject(error);
        });
    });
}

(async () => {
    console.log('🚦 Running predeploy checks...');

    try {
        for (const cmd of COMMANDS) {
            const cmdString = `${cmd[0]} ${cmd[1].join(' ')}`;
            console.log(`▶️  ${cmdString}`);
            await runCommand(cmd);
        }

        console.log('✅ Predeploy checks passed');
        process.exit(0);
    } catch (error) {
        console.error('❌ Predeploy checks failed');
        console.error(error.message);
        process.exit(1);
    }
})();
