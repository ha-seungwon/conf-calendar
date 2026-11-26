'use strict';
// 새 버전 배포:
//   1) npm version patch   (또는 minor / major) → package.json 버전 올림 + 커밋 + 태그
//   2) npm run release     → 설치 파일 빌드 → GitHub Release 업로드
// 이미 설치된 앱들은 실행할 때(그리고 6시간마다) 새 버전을 찾아 자동으로 받아요.
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const tag = `v${pkg.version}`;
const DEFAULT_GH = 'C:\\Program Files\\GitHub CLI\\gh.exe';
const gh = process.env.GH_PATH || (fs.existsSync(DEFAULT_GH) ? DEFAULT_GH : 'gh');

const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { cwd: root, stdio: 'inherit', shell: false, ...opts });
const out = (cmd, args) => execFileSync(cmd, args, { cwd: root, encoding: 'utf8', shell: false }).trim();
const fail = (msg) => { console.error(`\n✖ ${msg}\n`); process.exit(1); };

// 1. 확인
if (out('git', ['status', '--porcelain'])) fail('커밋하지 않은 변경이 있어요. 먼저 커밋하세요.');
try {
  out(gh, ['release', 'view', tag]);
  fail(`${tag} 릴리스가 이미 있어요. 먼저 "npm version patch" 로 버전을 올리세요.`);
} catch (e) {
  if (e.status === undefined) throw e; // gh 자체를 못 찾음
}

// 2. 코드 올리기
console.log(`\n▶ ${tag} 배포 시작`);
run('git', ['push', '--follow-tags']);

// 3. 빌드
run(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['electron-builder', '--win', 'nsis', '--publish', 'never'],
  { shell: process.platform === 'win32' });
const dist = path.join(root, 'release');
const files = ['ConfCalendar-Setup.exe', 'ConfCalendar-Setup.exe.blockmap', 'latest.yml'].map((f) => path.join(dist, f));
for (const f of files) if (!fs.existsSync(f)) fail(`빌드 결과가 없어요: ${f}`);
const latest = fs.readFileSync(path.join(dist, 'latest.yml'), 'utf8');
if (!latest.includes(`version: ${pkg.version}`)) fail('latest.yml 버전이 package.json 과 달라요.');

// 4. GitHub Release 업로드 → 자동 업데이트 대상이 됨
run(gh, ['release', 'create', tag, ...files, '--title', `학회 캘린더 ${tag}`, '--generate-notes', '--latest']);
console.log(`\n✔ ${tag} 배포 완료. 설치된 앱들은 다음 실행 때 자동으로 업데이트돼요.\n`);
