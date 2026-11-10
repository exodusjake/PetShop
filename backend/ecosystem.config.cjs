// pm2 process definition for the API server:   pm2 start ecosystem.config.cjs && pm2 save
module.exports = {
  apps: [
    {
      name: 'pawzora-api',
      script: 'dist/index.js',
      cwd: __dirname,                 // so dotenv finds backend/.env and uploads/ resolves correctly
      instances: 1,                   // keep ONE process: the login-attempt limiter lives in memory
      exec_mode: 'fork',
      env: { NODE_ENV: 'production' },
      max_memory_restart: '450M',
      kill_timeout: 10000,            // matches the API's graceful-shutdown window
      time: true,                     // timestamps in pm2 logs
    },
  ],
};
