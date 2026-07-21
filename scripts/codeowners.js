const fs = require('fs');
const path = require('path');

/**
 * Very small CODEOWNERS parser.
 * Supports:
 *   *              -> catch-all default owner
 *   /src/utils.js  -> exact path match
 *   /src/          -> prefix/folder match
 * Returns the LAST matching line's owners (CODEOWNERS uses "last match wins",
 * same as GitHub's own behavior), or null if no match found.
 */
function loadCodeowners(repoRoot) {
  const candidates = [
    path.join(repoRoot, '.github', 'CODEOWNERS'),
    path.join(repoRoot, 'CODEOWNERS'),
    path.join(repoRoot, 'docs', 'CODEOWNERS'),
  ];

  const foundPath = candidates.find((p) => fs.existsSync(p));
  if (!foundPath) return [];

  const lines = fs.readFileSync(foundPath, 'utf8').split('\n');

  return lines
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => {
      const parts = line.split(/\s+/);
      const pattern = parts[0];
      const owners = parts.slice(1);
      return { pattern, owners };
    });
}

function matchesPattern(filePath, pattern) {
  // Normalize: CODEOWNERS paths are relative to repo root, may or may not start with '/'
  const normalizedPattern = pattern.startsWith('/') ? pattern.slice(1) : pattern;
  const normalizedFile = filePath.startsWith('/') ? filePath.slice(1) : filePath;

  if (normalizedPattern === '*') return true;

  // Folder match: pattern ends with '/'
  if (normalizedPattern.endsWith('/')) {
    return normalizedFile.startsWith(normalizedPattern);
  }

  // Exact file match
  return normalizedFile === normalizedPattern;
}

/**
 * Given a changed file path, find its owner(s) from CODEOWNERS rules.
 * "Last match wins" — mirrors GitHub's real matching behavior.
 */
function findOwners(repoRoot, filePath) {
  const rules = loadCodeowners(repoRoot);
  let matched = null;

  for (const rule of rules) {
    if (matchesPattern(filePath, rule.pattern)) {
      matched = rule;
    }
  }

  return matched ? matched.owners : [];
}

module.exports = { loadCodeowners, findOwners };
