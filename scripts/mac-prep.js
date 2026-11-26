'use strict';
// 맥 빌드 직전에 실행 (GitHub Actions 의 mac.yml / mac-smoke.yml)
// 맥에서는 앱 번들·실행 파일 이름이 한글("학회 캘린더")이면 Electron 이 켜지자마자 죽는다.
// 그래서 내부 이름은 영어(ConfCalendar)로 빌드하고, Finder·Dock 에 보이는 이름만 한글로 한다.
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'package.json');
const p = JSON.parse(fs.readFileSync(file, 'utf8'));
p.productName = 'ConfCalendar';
p.build.productName = 'ConfCalendar';
p.build.mac = {
  ...p.build.mac,
  extendInfo: { ...(p.build.mac && p.build.mac.extendInfo), CFBundleDisplayName: '학회 캘린더' },
};
fs.writeFileSync(file, `${JSON.stringify(p, null, 2)}\n`);
console.log('mac build: productName=ConfCalendar, display name=학회 캘린더');
