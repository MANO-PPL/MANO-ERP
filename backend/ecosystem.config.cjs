module.exports = {
  apps: [
    {
      name: 'mano-erp-backend',
      script: 'server.js',
      cwd: './',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '800M',
      env: {
        NODE_ENV: 'production',
        PORT: 5001,
      },
    },
    {
      name: 'mano-erp-okf-auto-runner',
      script: 'scripts/okf-auto-runner.js',
      cwd: __dirname,
      args: '--daemon',
      instances: 1,
      autorestart: true,
      restart_delay: 60000,
      max_restarts: 3,
      watch: false,
      max_memory_restart: '256M',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
