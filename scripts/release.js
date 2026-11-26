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

// 4. 초안(draft)으로 올린다 — 아직 아무도 못 보고, "최신 버전" 링크도 이전 버전을 그대로 가리킨다
run(gh, ['release', 'create', tag, ...files, '--title', `학회 캘린더 ${tag}`, '--generate-notes', '--draft']);

// 5. 맥 빌드 실행 → 맥 파일까지 붙으면 워크플로가 릴리스를 공개한다
const started = new Date(Date.now() - 5000).toISOString();
run(gh, ['workflow', 'run', 'mac.yml', '-f', `tag=${tag}`]);
console.log('\n▶ 맥 빌드 시작 (약 3분). 끝나면 Windows·Mac 파일이 함께 공개돼요.');
let runId = '';
for (let i = 0; i < 20 && !runId; i++) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 3000); // 3초 대기
  runId = out(gh, ['run', 'list', '--workflow', 'mac.yml', '--event', 'workflow_dispatch', '--limit', '1',
    '--json', 'databaseId,createdAt', '--jq', `.[] | select(.createdAt >= "${started}") | .databaseId`]);
}
if (!runId) fail('맥 빌드 실행을 찾지 못했어요. GitHub → Actions 에서 확인해 주세요. (릴리스는 아직 초안이에요)');
try {
  run(gh, ['run', 'watch', runId, '--exit-status', '--interval', '20']);
} catch {
  fail(`맥 빌드가 실패해서 ${tag} 는 아직 초안이에요. 사용자에게는 이전 버전이 그대로 보여요.\n  로그: gh run view ${runId} --log-failed`);
}
const draft = out(gh, ['release', 'view', tag, '--json', 'isDraft', '--jq', '.isDraft']);
if (draft !== 'false') fail(`${tag} 가 아직 초안이에요. GitHub 릴리스 화면에서 확인해 주세요.`);
console.log(`\n✔ ${tag} 배포 완료 (Windows + Mac). 설치된 앱들은 다음 실행 때 자동으로 업데이트돼요.\n`);
