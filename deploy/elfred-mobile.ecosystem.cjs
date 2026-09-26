module.exports = { apps: [{
  name: 'elfred-mobile',
  cwd: '/www/wwwroot/elfred-mobile/current',
  script: 'scripts/start-local.mjs',
  args: '--production',
  interpreter: '/opt/node-v22.13.1/bin/node',
  node_args: '--env-file-if-exists=.env.local',
  env: {
    NODE_ENV: 'production',
    ELFRED_PORT: '3001',
    ELFRED_PUBLIC_ORIGIN: 'http://111.230.26.68',
    ELFRED_DATA_DIR: '/www/wwwroot/elfred-mobile/shared/v28-data',
    PATH: '/opt/node-v22.13.1/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin'
  },
  autorestart: true, max_memory_restart: '1200M', time: true
}] };
