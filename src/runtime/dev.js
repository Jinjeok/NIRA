import { spawnSync } from 'node:child_process';

process.env.NODE_ENV ||= 'development';
process.env.ADMIN_AUTH_BYPASS ||= 'true';

const skipDeploy = process.argv.includes('--skip-deploy');

if (!skipDeploy) {
    const deploy = spawnSync(process.execPath, ['deploy-commands.js'], {
        stdio: 'inherit',
        env: process.env,
    });

    if (deploy.error) {
        throw deploy.error;
    }
    if (deploy.status && deploy.status !== 0) {
        process.exit(deploy.status);
    }
}

await import('./startAll.js');
