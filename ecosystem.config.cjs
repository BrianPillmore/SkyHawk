module.exports = {
  apps: [{
    name: 'skyhawk-api',
    script: 'dist-server/index.js',
    cwd: '/var/www/skyhawk',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '256M',
    env: {
      NODE_ENV: 'production',
      PORT: 3001,
    },
  }],
};
