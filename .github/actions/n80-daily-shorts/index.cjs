const {spawnSync} = require('node:child_process');
const result = spawnSync('python3', ['scripts/n80_auto.py', 'ai.daily_shorts'], {stdio: 'inherit', env: process.env});
process.exit(result.status ?? 1);
