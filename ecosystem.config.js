// pm2 start ecosystem.config.js
module.exports = {
  apps: [
    {
      name: "task-tracker",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3000",
      cwd: __dirname,
      instances: 1,          // keep at 1: SQLite has a single writer
      exec_mode: "fork",
      autorestart: true,
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production",
        DB_PATH: __dirname + "/data/tracker.db",
        // COOKIE_SECURE: "true",   // set when served over HTTPS
      },
    },
  ],
};
