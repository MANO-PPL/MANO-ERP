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
  ],
};
