module.exports = {
  apps: [
    {
      name: 'Server.ts',
      interpreter: 'bash',
      script: 'yarn.sh',
      args: 'server',
      watch: false,
      autorestart: true,
    },
  ],
};
