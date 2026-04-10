module.exports = {
  apps: [{
    name: 'kingcrm',
    script: 'npm',
    args: 'start',
    cwd: '/home/deployer/kingcrmhub',
    env: {
      NODE_ENV: 'production',
      PORT: 3003
    }
  }]
}
