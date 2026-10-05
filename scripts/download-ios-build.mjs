import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const info = JSON.parse(readFileSync('apple-build-info.json', 'utf8'));
const deadline = Date.now() + 100 * 60 * 1000;
while (Date.now() < deadline) {
  const build = JSON.parse(execFileSync('eas', ['build:view', info.id, '--json'], {encoding:'utf8', stdio:['ignore','pipe','inherit']}));
  console.log(`Apple build ${info.id}: ${build.status}`);
  if (['ERRORED','CANCELED'].includes(build.status)) throw new Error(`Apple build ${build.status}: ${build.error?.message || 'See EAS build logs'}`);
  if (build.status === 'FINISHED') {
    if (build.platform !== 'IOS' || build.distribution !== 'STORE' || build.appVersion !== '0.9.0' || build.appBuildVersion !== '7') throw new Error('Unexpected Apple release metadata');
    const url = build.artifacts?.buildUrl || build.artifacts?.applicationArchiveUrl;
    if (!url || new URL(url).protocol !== 'https:') throw new Error('Missing secure IPA download');
    const response = await fetch(url);
    if (!response.ok) throw new Error(`IPA download failed: ${response.status}`);
    writeFileSync('Try-Jesus-Journey-v0.9.0-build7.ipa', Buffer.from(await response.arrayBuffer()));
    writeFileSync('apple-build-info.json', JSON.stringify({...info,status:build.status,distribution:build.distribution,completedAt:build.completedAt},null,2));
    process.exit(0);
  }
  await new Promise(resolve => setTimeout(resolve,30000));
}
throw new Error(`Timed out waiting for Apple build ${info.id}; inspect existing build before retrying.`);
