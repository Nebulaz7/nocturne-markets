module.exports = {
  apps: [
    {
      name: "nocturne-coordinator",
      script: "./run.sh",
      interpreter: "bash",
      cwd: "/home/azureuser/nocturne-markets",
      max_memory_restart: "500M",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
