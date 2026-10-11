import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Scanner } from '@tailwindcss/oxide';

const root = fileURLToPath(new URL('../../', import.meta.url));
const scanner = new Scanner({ sources: [{ base: root, pattern: '**/*', negated: false }] });
scanner.scan();
const files = scanner.files.map((file) => path.relative(root, file));
const androidFiles = files.filter((file) => file.startsWith(`android${path.sep}`));
assert.deepEqual(androidFiles, [], 'Native sources must not contribute classes to the web CSS');
assert.ok(files.includes(path.join('src', 'App.tsx')), 'The web source must still be scanned');

// Check hypothetical new native sources as well as this script; .ignore must not hide them from Git.
const git = spawnSync('git', [
  'check-ignore', '--no-index', '--',
  'android/.ignore',
  'android/scripts/verify-web-scanner.mjs',
  'android/app-project/app/src/main/java/cc/savely/android/FutureFeature.java',
], { cwd: root, encoding: 'utf8' });
if (git.error) throw git.error;
assert.equal(git.status, 1, `Git must allow native source tracking: ${git.stdout}${git.stderr}`);
assert.equal(git.stdout.trim(), '', 'No Android source probe may be ignored by Git');
console.log(JSON.stringify({
  status: 'passed',
  scannedFiles: files.length,
  androidFiles: androidFiles.length,
  webSourceIncluded: true,
  gitSourceTracking: true,
}));
