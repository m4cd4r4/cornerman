// Release script.
// Run: node scripts/release.mjs [--from N]   (N = first step to run, default 1)
// Every step is specified in full in its comment; a step needs nothing beyond what is written here.
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
// Read package.json, add 1 to the patch number of `version` (0.3.0 becomes 0.3.1), write it back
// with 4-space JSON and a trailing newline. Log 'step 2: version <new>'.
async function step2() {
    // TODO: bump the patch version and write package.json back
    throw new Error('step 2 not implemented');
}

// STEP 3: write the changelog entry
// Read `version` from package.json. Put a section at the top of CHANGELOG.md (create the file if
// missing): a line '## <version>', then one '- <subject>' line per commit subject from
// `git log --format=%s`, limited to commits since the newest tag when a tag exists, then a blank
// line. Log 'step 3: changelog written'.
async function step3() {
    // TODO: add a CHANGELOG.md section for the new version from the commits since the last tag
    throw new Error('step 3 not implemented');
}

// STEP 4: tag the release
// Read `version` from package.json and run `git tag -a v<version> -m "Release <version>"`.
// If that tag already exists, throw an Error naming it. Log 'step 4: tagged v<version>'.
async function step4() {
    // TODO: create an annotated git tag v<version>
    throw new Error('step 4 not implemented');
}

// STEP 5: publish dry run
// Run `npm publish --dry-run`, capturing stdout and stderr. If either holds a line starting with
// 'npm warn' (any letter case), throw an Error with that line. Log 'step 5: dry run clean'.
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
