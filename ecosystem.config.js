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
      node_args: "--disable-warning=ExperimentalWarning", // node:sqlite prints a one-time notice
      env: {
        NODE_ENV: "production",
        TZ: "Asia/Kolkata",       // weeks (Mon–Sun) and "overdue" follow this timezone
        DB_PATH: __dirname + "/data/tracker.db",
        // COOKIE_SECURE: "true",   // set when served over HTTPS
      },
    },
  ],
};
