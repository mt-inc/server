module.exports = {
  apps: [
    {
      name: 'Server.ts',
      interpreter: 'bash',
      script: 'yarn',
      args: 'server',
      watch: false,
      autorestart: true,
    },
  ],
};
