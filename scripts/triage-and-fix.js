/**
 * triage-and-fix.js
 *
 * Runs when the "test" job fails on develop. Does the following, in order:
 *   1. Reads the failing test log (downloaded as an artifact by the workflow)
 *   2. Diffs the last commit to find what changed
 *   3. Finds the commit author (git log) and the CODEOWNERS owner for the file
 *   4. Looks up the GitHub PR associated with the failing commit (if any)
 *   5. Asks the ICA (IBM Consulting Advantage) assistant for a corrected version of the file
 *   6. Applies the fix on a new branch, re-runs tests to confirm it works
 *   7. Opens a PR with the fix
 *   8. Posts a summary to Slack, tagging both the author and the code owner
 *
 * Required environment variables:
 *   ICA_API_KEY         - IBM Consulting Advantage API key
 *   ICA_API_BASE_URL    - Base URL for the ICA API (e.g. https://api.your-ica-instance.com)
 *   ICA_MODEL           - (optional) ICA assistant/model id to use for this workflow
 *   GH_TOKEN            - GitHub token/PAT with repo write access
 *   SLACK_WEBHOOK_URL   - Slack incoming webhook URL
 *   GITHUB_REPOSITORY   - "owner/repo" (auto-set by GitHub Actions)
 *   GITHUB_RUN_ID       - auto-set by GitHub Actions, used to keep branch names unique
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { Octokit } = require('@octokit/rest');
const { findOwners } = require('./codeowners');

const REPO_ROOT = process.cwd();
const [OWNER, REPO] = (process.env.GITHUB_REPOSITORY || '').split('/');
const RUN_ID = process.env.GITHUB_RUN_ID || Date.now().toString();

// ICA API configuration
const ICA_API_BASE_URL = process.env.ICA_API_BASE_URL || 'https://api.nextgen-beta.ica.ibm.com/ica/v1';
const ICA_API_KEY = process.env.ICA_API_KEY;
const ICA_MODEL = process.env.ICA_MODEL || 'claude-sonnet-4-5'; // raw model id from GET /chat-models (bump to claude-opus-4-7 for tougher fixes)

function run(cmd) {
  return execSync(cmd, { cwd: REPO_ROOT, encoding: 'utf8' }).trim();
}

function runSafe(cmd) {
  try {
    return { ok: true, output: run(cmd) };
  } catch (err) {
    return { ok: false, output: err.stdout ? err.stdout.toString() : err.message };
  }
}

/**
 * Calls the ICA raw chat-model completion endpoint and returns the
 * model's reply text (OpenAI-compatible `choices[0].message.content`).
 * Using the raw model (vs. a preset assistant) avoids any competing
 * persona/system-prompt instructions overriding our own "return only
 * the file contents" instruction.
 */
async function callIca(promptText) {
  const res = await fetch(`${ICA_API_BASE_URL}/chat-models/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ICA_API_KEY}`,
    },
    body: JSON.stringify({
      model: ICA_MODEL,
      messages: [{ role: 'user', content: promptText }],
      stream: false,
    }),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new Error(`ICA API request failed (${res.status}): ${errBody}`);
  }

  const data = await res.json();
  const choice = data.choices && data.choices[0];
  if (!choice || !choice.message || typeof choice.message.content !== 'string') {
    throw new Error('ICA API response did not contain expected choices[0].message.content');
  }
  return choice.message.content;
}

async function main() {
  console.log('--- AutoFix triage starting ---');

  if (!ICA_API_KEY) {
    throw new Error('ICA_API_KEY environment variable is not set.');
  }

  // 1. Read the failing test log
  const logPath = path.join(REPO_ROOT, 'test-output.log');
  const testLog = fs.existsSync(logPath)
    ? fs.readFileSync(logPath, 'utf8')
    : '(no test-output.log found — proceeding without it)';
  console.log('Loaded test log:', testLog.length, 'chars');

  // 2. Diff the last commit to find what changed
  const changedFiles = run('git diff --name-only HEAD~1 HEAD')
    .split('\n')
    .filter(Boolean);

  if (changedFiles.length === 0) {
    console.log('No changed files found between HEAD~1 and HEAD. Exiting.');
    return;
  }
  console.log('Changed files:', changedFiles);

  const diff = run('git diff HEAD~1 HEAD');
  const commitSha = run('git rev-parse HEAD');
  const commitAuthor = run("git log -1 --format='%an'");
  const commitAuthorEmail = run("git log -1 --format='%ae'");

  console.log(`Commit ${commitSha} by ${commitAuthor} <${commitAuthorEmail}>`);

  // For the demo scope we focus on the first changed source file
  // (skip test files and config, since those aren't what we want the assistant to "fix")
  const targetFile = changedFiles.find(
    (f) => f.startsWith('src/') && !f.includes('.test.')
  ) || changedFiles[0];

  const originalContent = fs.readFileSync(path.join(REPO_ROOT, targetFile), 'utf8');

  // 3. Find CODEOWNERS owner(s) for this file
  const owners = findOwners(REPO_ROOT, targetFile);
  console.log('CODEOWNERS owners for', targetFile, ':', owners);

  // 4. Try to resolve the GitHub username of the commit author + find the PR
  const octokit = new Octokit({ auth: process.env.GH_TOKEN });

  let authorGithubUsername = null;
  try {
    const { data: commitData } = await octokit.rest.repos.getCommit({
      owner: OWNER,
      repo: REPO,
      ref: commitSha,
    });
    authorGithubUsername = commitData.author ? commitData.author.login : null;
  } catch (err) {
    console.log('Could not resolve commit author via API:', err.message);
  }

  let associatedPr = null;
  try {
    const { data: prs } = await octokit.rest.repos.listPullRequestsAssociatedWithCommit({
      owner: OWNER,
      repo: REPO,
      commit_sha: commitSha,
    });
    associatedPr = prs.length > 0 ? prs[0] : null;
  } catch (err) {
    console.log('Could not look up associated PR:', err.message);
  }

  // Try to pull a ticket ID out of the branch name or PR title (e.g. JIRA-1234)
  let ticketId = null;
  const ticketSource = associatedPr ? `${associatedPr.head.ref} ${associatedPr.title}` : '';
  const ticketMatch = ticketSource.match(/[A-Z]+-\d+/);
  if (ticketMatch) ticketId = ticketMatch[0];

  // 5. Ask the ICA assistant for a fix
  const prompt = `You are helping fix a broken build. A CI test suite failed after this commit.

FILE: ${targetFile}

CURRENT (BROKEN) FILE CONTENTS:
---
${originalContent}
---

DIFF THAT INTRODUCED THE BREAK (git diff HEAD~1 HEAD):
---
${diff}
---

TEST FAILURE OUTPUT:
---
${testLog.slice(0, 4000)}
---

Return ONLY the complete corrected contents of ${targetFile}, with the bug fixed.
Do not include any explanation, markdown code fences, or commentary — just the raw file contents.`;

  const icaReply = await callIca(prompt);

  let fixedContent = icaReply;

  // Strip markdown fences if the assistant added them despite instructions
  fixedContent = fixedContent
    .replace(/^```[a-zA-Z]*\n/, '')
    .replace(/```\s*$/, '')
    .trim() + '\n';

  console.log('--- ICA proposed fix (first 300 chars) ---');
  console.log(fixedContent.slice(0, 300));

  // 6. Apply the fix on a new branch
  const branchSlug = ticketId
    ? `autofix/${ticketId}-build-fix-${RUN_ID}`
    : `autofix/build-fix-${RUN_ID}`;

  run(`git config user.name "autofix-bot"`);
  run(`git config user.email "autofix-bot@users.noreply.github.com"`);
  run(`git checkout -b ${branchSlug}`);

  fs.writeFileSync(path.join(REPO_ROOT, targetFile), fixedContent);
  run(`git add ${targetFile}`);
  run(`git commit -m "autofix: proposed fix for failing build on ${targetFile}"`);

  // Push using the token for auth
  // const remoteUrl = `https://x-access-token:${process.env.GH_TOKEN}@github.com/${OWNER}/${REPO}.git`;
 // run(`git push ${remoteUrl} ${branchSlug}`);
 run(`git push -u origin ${branchSlug}`);

  // 7. Re-run tests to check confidence
  const testResult = runSafe('npm test');
  const confidence = testResult.ok ? 'high' : 'low';
  console.log('Post-fix test result:', confidence);

  // 8. Open the PR
  const prBody = [
    `## AutoFix: proposed fix for a broken build`,
    ``,
    `**Broke in commit:** ${commitSha}`,
    `**Original author:** ${authorGithubUsername ? '@' + authorGithubUsername : commitAuthor}`,
    associatedPr ? `**Related PR:** #${associatedPr.number} — ${associatedPr.title}` : '',
    ticketId ? `**Linked ticket:** ${ticketId}` : '',
    owners.length ? `**Code owner(s):** ${owners.join(', ')}` : '',
    ``,
    `**Confidence:** ${confidence === 'high' ? 'High — tests pass after applying this patch.' : 'Needs review — heuristic fix, tests still failing.'}`,
    ``,
    `### What broke`,
    '```diff',
    diff.slice(0, 3000),
    '```',
    ``,
    `### Test failure`,
    '```',
    testLog.slice(0, 2000),
    '```',
  ].filter(Boolean).join('\n');

  const { data: pr } = await octokit.rest.pulls.create({
    owner: OWNER,
    repo: REPO,
    title: `AutoFix: fix failing build on ${targetFile}${ticketId ? ` (${ticketId})` : ''}`,
    head: branchSlug,
    base: 'develop',
    body: prBody,
  });

  console.log('Opened PR:', pr.html_url);

  // 9. Notify Slack
  const slackMapPath = path.join(__dirname, 'slack-map.json');
  const slackMap = fs.existsSync(slackMapPath)
    ? JSON.parse(fs.readFileSync(slackMapPath, 'utf8'))
    : {};

  const mentionFor = (githubUsername) => {
    if (!githubUsername) return 'unknown';
    const slackId = slackMap[githubUsername];
    return slackId ? `<@${slackId}>` : `@${githubUsername}`;
  };

  const ownerMentions = owners.map((o) => mentionFor(o.replace('@', ''))).join(', ') || 'no CODEOWNERS match';
  const authorMention = mentionFor(authorGithubUsername);

  const confidenceEmoji = confidence === 'high' ? '✅' : '⚠️';
  const slackText = [
    `🤖 *AutoFix CI* — build broke on \`develop\`, fix PR opened.`,
    `*Broken by:* ${authorMention}`,
    `*Review requested:* ${ownerMentions}`,
    ticketId ? `*Ticket:* ${ticketId}` : null,
    `*Confidence:* ${confidenceEmoji} ${confidence === 'high' ? 'High — tests pass' : 'Needs review — heuristic fix'}`,
    `*PR:* ${pr.html_url}`,
  ].filter(Boolean).join('\n');

  if (process.env.SLACK_WEBHOOK_URL) {
    const res = await fetch(process.env.SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: slackText }),
    });
    console.log('Slack notify status:', res.status);
  } else {
    console.log('SLACK_WEBHOOK_URL not set, skipping Slack notification. Message would have been:');
    console.log(slackText);
  }

  console.log('--- AutoFix triage complete ---');
}

main().catch((err) => {
  console.error('AutoFix triage failed:', err);
  process.exit(1);
});
