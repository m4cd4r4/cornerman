// Release script.
// Run: node scripts/release.mjs [--from N]   (N = first step to run, default 1)
import { execFileSync } from 'node:child_process';

// STEP 1: check the working tree is clean
async function step1() {
    const dirty = execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim();
    if (dirty) {
        throw new Error('working tree is not clean');
    }
    console.log('step 1: tree clean');
}

// STEP 2: bump the version in package.json
async function step2() {
    // TODO: bump the patch version and write package.json back
    throw new Error('step 2 not implemented');
}

// STEP 3: write the changelog entry
async function step3() {
    // TODO: add a CHANGELOG.md section for the new version from the commits since the last tag
    throw new Error('step 3 not implemented');
}

// STEP 4: tag the release
async function step4() {
    // TODO: create an annotated git tag v<version>
    throw new Error('step 4 not implemented');
}

// STEP 5: publish dry run
async function step5() {
    // TODO: run npm publish --dry-run and fail on any warning
    throw new Error('step 5 not implemented');
}

const steps = [step1, step2, step3, step4, step5];
const fromIdx = process.argv.indexOf('--from');
const from = fromIdx > -1 ? Number(process.argv[fromIdx + 1]) : 1;

for (let i = from - 1; i < steps.length; i++) {
    await steps[i]();
}
