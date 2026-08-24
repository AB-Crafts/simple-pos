#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const rootDir = path.resolve(__dirname, '..');
const pkgPath = path.join(rootDir, 'package.json');
const frontendPkgPath = path.join(rootDir, 'frontend', 'package.json');
const backendPkgPath = path.join(rootDir, 'backend', 'package.json');
const appTsxPath = path.join(rootDir, 'frontend', 'src', 'App.tsx');
const updateStatusPath = path.join(rootDir, 'frontend', 'src', 'components', 'UpdateStatus.tsx');

function run(cmd) {
  console.log(`> ${cmd}`);
  return execSync(cmd, { cwd: rootDir, stdio: 'inherit' });
}

function runQuiet(cmd) {
  return execSync(cmd, { cwd: rootDir, encoding: 'utf-8' }).trim();
}

function bumpVersion(current, type = 'patch') {
  const parts = current.replace(/^v/, '').split('.').map((p) => parseInt(p, 10) || 0);
  while (parts.length < 3) parts.push(0);

  if (type === 'major') {
    parts[0] += 1;
    parts[1] = 0;
    parts[2] = 0;
  } else if (type === 'minor') {
    parts[1] += 1;
    parts[2] = 0;
  } else if (type === 'patch') {
    parts[2] += 1;
  } else if (/^\d+\.\d+\.\d+$/.test(type)) {
    return type;
  } else {
    throw new Error(`Unknown bump type: "${type}". Use patch, minor, major or exact version (e.g. 0.1.3).`);
  }

  return parts.join('.');
}

function main() {
  const bumpType = process.argv[2] || 'patch';

  // Read current version
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const oldVersion = pkg.version;
  const newVersion = bumpVersion(oldVersion, bumpType);
  const tag = `v${newVersion}`;

  console.log(`\n🚀 Preparing release: ${oldVersion} ➔ ${newVersion} (${tag})\n`);

  // 1. Update root package.json
  pkg.version = newVersion;
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
  console.log(`✓ Updated package.json`);

  // 2. Update frontend/package.json
  if (fs.existsSync(frontendPkgPath)) {
    const fPkg = JSON.parse(fs.readFileSync(frontendPkgPath, 'utf8'));
    fPkg.version = newVersion;
    fs.writeFileSync(frontendPkgPath, JSON.stringify(fPkg, null, 2) + '\n', 'utf8');
    console.log(`✓ Updated frontend/package.json`);
  }

  // 3. Update backend/package.json
  if (fs.existsSync(backendPkgPath)) {
    const bPkg = JSON.parse(fs.readFileSync(backendPkgPath, 'utf8'));
    bPkg.version = newVersion;
    fs.writeFileSync(backendPkgPath, JSON.stringify(bPkg, null, 2) + '\n', 'utf8');
    console.log(`✓ Updated backend/package.json`);
  }

  // 4. Update frontend/src/App.tsx fallback
  if (fs.existsSync(appTsxPath)) {
    let appContent = fs.readFileSync(appTsxPath, 'utf8');
    appContent = appContent.replace(
      /const\s+\[appVersion,\s*setAppVersion\]\s*=\s*useState\([^)]*\);/,
      `const [appVersion, setAppVersion] = useState('${newVersion}');`
    );
    fs.writeFileSync(appTsxPath, appContent, 'utf8');
    console.log(`✓ Updated App.tsx`);
  }

  // 5. Update frontend/src/components/UpdateStatus.tsx fallback
  if (fs.existsSync(updateStatusPath)) {
    let statusContent = fs.readFileSync(updateStatusPath, 'utf8');
    statusContent = statusContent.replace(
      /const\s+\[currentAppVersion,\s*setCurrentAppVersion\]\s*=\s*useState<string>\([^)]*\);/,
      `const [currentAppVersion, setCurrentAppVersion] = useState<string>('${newVersion}');`
    );
    fs.writeFileSync(updateStatusPath, statusContent, 'utf8');
    console.log(`✓ Updated UpdateStatus.tsx`);
  }

  // 6. Git commit & tag
  try {
    const branch = runQuiet('git rev-parse --abbrev-ref HEAD') || 'master';
    run('git add .');
    run(`git commit -m "chore: release ${tag}"`);
    run(`git tag ${tag}`);
    run(`git push origin ${branch} --tags`);

    console.log(`\n🎉 Successfully published release ${tag}! GitHub Actions will now build and publish it.\n`);
  } catch (err) {
    console.error(`\n❌ Git operation failed:`, err.message);
    process.exit(1);
  }
}

main();
