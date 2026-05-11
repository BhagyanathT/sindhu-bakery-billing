module.exports = {
  apps: [
    {
      name: 'bizflow-backend',
      script: 'index.js',
      cwd: './',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      // ✅ Load environment variables from .env file
      // On AWS: ensure .env file is present in the backend directory
      env_production: {
        NODE_ENV: 'production',
        PORT: 5000,
        HOST: '0.0.0.0',
      },
      // ✅ dotenvx injects .env automatically via the start script
      // If not using dotenvx, set env vars directly or use: pm2 start ecosystem.config.js --env production
    }
  ]
};

