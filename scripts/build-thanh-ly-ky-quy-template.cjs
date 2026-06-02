const { spawnSync } = require('child_process');
const path = require('path');

const scriptPath = path.join(__dirname, 'build-thanh-ly-ky-quy-template.ps1');
const result = spawnSync(
  'powershell.exe',
  ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath],
  {
    cwd: path.resolve(__dirname, '..'),
    stdio: 'inherit'
  }
);

if (result.status !== 0) {
  process.exit(result.status || 1);
}
