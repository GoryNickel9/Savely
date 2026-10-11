import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' });
const base = process.argv[2] || 'HEAD';
const names = new Set([
  ...git('diff', '--name-only', '-z', base).split('\0'),
  ...git('ls-files', '--others', '--exclude-standard', '-z').split('\0'),
].filter(Boolean));
const allowed = (name) => name.startsWith('android/')
  || name === 'public/.well-known/assetlinks.json'
  || name === '.github/workflows/android.yml';
const unexpected = [...names].filter((name) => !allowed(name));
if (unexpected.length) {
  console.error(`Modifiche fuori perimetro Android:\n${unexpected.join('\n')}`);
  process.exit(1);
}
const links = JSON.parse(readFileSync(path.join(root, 'public/.well-known/assetlinks.json'), 'utf8'));
if (!Array.isArray(links) || links.length !== 1) throw new Error('Asset Links: attesa una sola associazione.');
const [link] = links;
if (link.relation?.length !== 1 || link.relation[0] !== 'delegate_permission/common.handle_all_urls'
  || link.target?.namespace !== 'android_app' || link.target.package_name !== 'cc.savely.android'
  || link.target.sha256_cert_fingerprints?.length !== 1
  || !/^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(link.target.sha256_cert_fingerprints[0])) {
  throw new Error('Asset Links: package, relazione o impronta SHA256 non validi.');
}
for (const name of ['package.json', 'package-lock.json', 'vercel.json', 'vite.config.ts', 'tsconfig.app.json', 'tsconfig.node.json']) {
  const original = execFileSync('git', ['show', `${base}:${name}`], { cwd: root });
  const current = readFileSync(path.join(root, name));
  // Git stores LF; Windows may check out CRLF without changing file content.
  const normalize = (bytes) => bytes.toString('utf8').replace(/\r\n/g, '\n');
  if (normalize(original) !== normalize(current)) throw new Error(`File web modificato: ${name}`);
}
console.log(JSON.stringify({ base, changedFiles: [...names].sort(), webCodeUnchanged: true, assetLinksValid: true }, null, 2));
