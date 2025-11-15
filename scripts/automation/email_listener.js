const imaps = require('imap-simple');
const { Octokit } = require('@octokit/rest');
const { execSync } = require('child_process');
const fs = require('fs');

const OWNER_REPO = process.env.GITHUB_REPOSITORY || '';
if (!OWNER_REPO) {
    console.error('GITHUB_REPOSITORY non défini. (format owner/repo)');
    process.exit(1);
}
const [owner, repo] = OWNER_REPO.split('/');

const EMAIL_HOST = process.env.EMAIL_HOST;
const EMAIL_PORT = parseInt(process.env.EMAIL_PORT || '993', 10);
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;
const EMAIL_SECURE = (process.env.EMAIL_SECURE || 'true') === 'true';
const ALLOWED_SENDERS = (process.env.ALLOWED_SENDERS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
const TARGET_BRANCH = process.env.TARGET_BRANCH || 'main';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

const IMAP_ALLOW_SELF_SIGNED = (process.env.IMAP_ALLOW_SELF_SIGNED || 'false') === 'true';

if (!EMAIL_HOST || !EMAIL_USER || !EMAIL_PASS) {
    console.error('Merci de définir EMAIL_HOST / EMAIL_USER / EMAIL_PASS.');
    process.exit(1);
}
if (!GITHUB_TOKEN) {
    console.error('GITHUB_TOKEN non défini.');
    process.exit(1);
}

const octokit = new Octokit({ auth: GITHUB_TOKEN });

function loadCertBuffers() {
    const bufs = [];
    const intermediatesPath = '/tmp/ca/intermediates.pem';
    if (fs.existsSync(intermediatesPath)) {
        try { bufs.push(fs.readFileSync(intermediatesPath)); } catch (e) {}
    }
    const leafPath = '/tmp/ca/mailserver.pem';
    if (fs.existsSync(leafPath)) {
        try { bufs.push(fs.readFileSync(leafPath)); } catch (e) {}
    }
    if (process.env.NODE_EXTRA_CA_CERTS && fs.existsSync(process.env.NODE_EXTRA_CA_CERTS)) {
        try { bufs.push(fs.readFileSync(process.env.NODE_EXTRA_CA_CERTS)); } catch (e) {}
    }
    const systemCA = '/etc/ssl/certs/ca-certificates.crt';
    if (fs.existsSync(systemCA)) {
        try { bufs.push(fs.readFileSync(systemCA)); } catch (e) {}
    }
    return bufs;
}

function decodeRFC2047(subject) {
    if (!subject) return subject;
    return subject.replace(/=\?([^?]+)\?([BQbq])\?([^?]+)\?=/g, (match, charset, enc, text) => {
        try {
            if ((enc || '').toUpperCase() === 'B') {
                const buf = Buffer.from(text.replace(/\s/g, ''), 'base64');
                return buf.toString(charset || 'utf8');
            } else {
                return text.replace(/_/g, ' ').replace(/=([A-Fa-f0-9]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
            }
        } catch (e) {
            return match;
        }
    });
}

function normalizeSubject(raw) {
    if (!raw) return '';
    let s = String(raw);
    s = decodeRFC2047(s);
    s = s.replace(/\r?\n|\r/g, ' ').replace(/\s+/g, ' ').trim();
    s = s.replace(/^(?:\s*(?:re|fwd|fw)\s*[:\-]\s*)+/i, '').trim();
    s = s.replace(/^["']|["']$/g, '').trim();
    return s;
}

async function main() {
    const caBuffers = loadCertBuffers();

    const config = {
        imap: {
            user: EMAIL_USER,
            password: EMAIL_PASS,
            host: EMAIL_HOST,
            port: EMAIL_PORT,
            tls: EMAIL_SECURE,
            authTimeout: 30000,
            tlsOptions: {
                ca: caBuffers.length ? caBuffers : undefined,
                servername: EMAIL_HOST,
                rejectUnauthorized: IMAP_ALLOW_SELF_SIGNED ? false : true
            }
        }
    };

    const connection = await imaps.connect(config);
    await connection.openBox('INBOX');

    const searchCriteria = ['UNSEEN'];
    const fetchOptions = { bodies: ['HEADER.FIELDS (FROM TO SUBJECT DATE)'], markSeen: false };

    const messages = await connection.search(searchCriteria, fetchOptions);

    console.log(`Found ${messages.length} unseen message(s).`);

    const mergedBranches = [];

    for (const item of messages) {
        const all = item.parts.find(p => p.which === 'HEADER.FIELDS (FROM TO SUBJECT DATE)');
        const header = all ? all.body : {};
        const rawFrom = header.from ? header.from[0] : '';
        const rawSubject = header.subject ? header.subject[0] : '';

        const subject = (rawSubject || '').trim();
        const fromAddr = (rawFrom || '').toLowerCase();

        const match = fromAddr.match(/<([^>]+)>/);
        const fromEmail = match ? match[1] : fromAddr.split(/\s+/).pop();

        console.log(`Processing mail from "${fromEmail}" subject "${subject}"`);

        if (!ALLOWED_SENDERS.includes(fromEmail)) {
            console.log(` -> sender ${fromEmail} not allowed; marking seen and skipping.`);
            await connection.addFlags(item.attributes.uid, '\\Seen');
            continue;
        }

        const normalizedBranchName = normalizeSubject(subject);

        let branchExists = false;
        try {
            await octokit.repos.getBranch({ owner, repo, branch: normalizedBranchName });
            branchExists = true;
        } catch (err) {
            branchExists = false;
        }

        if (!branchExists) {
            console.log(` -> branch "${normalizedBranchName}" does not exist; marking seen and skipping.`);
            await connection.addFlags(item.attributes.uid, '\\Seen');
            continue;
        }

        try {
            console.log(` -> Merging branch "${normalizedBranchName}" into "${TARGET_BRANCH}"...`);
            const mergeResp = await octokit.repos.merge({
                owner,
                repo,
                base: TARGET_BRANCH,
                head: normalizedBranchName,
            });
            console.log(` -> Merge API response: ${mergeResp.status}`);
            mergedBranches.push(normalizedBranchName);

            const normalized = normalizeSubject(subject);
            const kwMatch = normalized.match(/(actualite|index|galerie)/i);
            if (kwMatch) {
                const type = kwMatch[1].toLowerCase();
                console.log(` -> Detected type "${type}" from subject; executing generator...`);
                try {
                    if (type === 'actualite') {
                        execSync('python3 scripts/generate_actualites.py', {
                            stdio: 'inherit',
                            env: { ...process.env, BASE_DIR: process.cwd() }
                        });
                    } else {
                        const scriptPath = `scripts/generate_${type}_json.js`;
                        execSync(`node ${scriptPath}`, {
                            stdio: 'inherit',
                            env: { ...process.env, BASE_DIR: process.cwd() }
                        });
                    }

                    try {
                        execSync('git config user.email "github-actions[bot]@users.noreply.github.com"');
                        execSync('git config user.name "github-actions[bot]"');

                        execSync('git add -A actualites || true', { stdio: 'inherit' });

                        const status = execSync('git status --porcelain').toString().trim();
                            if (!status) {
                                console.log(' -> Aucun changement à committer.');
                            } else {
                                execSync('git commit -m "ci: génération actualités (auto) [skip ci]"', { stdio: 'inherit' });

                                const remote = `https://x-access-token:${process.env.GITHUB_TOKEN}@github.com/${process.env.GITHUB_REPOSITORY}.git`;
                                execSync(`git remote set-url origin ${remote}`);

                                console.log(` -> fetching origin/${TARGET_BRANCH}...`);
                                execSync(`git fetch origin ${TARGET_BRANCH}`, { stdio: 'inherit' });

                                try {
                                    console.log(` -> rebasing on origin/${TARGET_BRANCH}...`);
                                    execSync(`git rebase origin/${TARGET_BRANCH}`, { stdio: 'inherit' });
                                } catch (rebaseErr) {
                                    console.error('    Rebase failed — aborting rebase and skipping push.');
                                    try { execSync('git rebase --abort', { stdio: 'inherit' }); } catch(e) {}
                                    throw rebaseErr;
                                }

                                console.log(` -> pushing to ${TARGET_BRANCH}...`);
                                execSync(`git push origin ${TARGET_BRANCH}`, { stdio: 'inherit' });
                                console.log(' -> Push succeeded.');
                            }
                        } catch (gitErr) {
                            console.error('    Erreur lors du commit/push (fetch/rebase/push) :', gitErr);
                        }
                } catch (runErr) {
                    console.error('    Error while executing generator script:', runErr);
                }

            } else {
                console.log(' -> No generator keyword found in subject; skipping generator.');
            }

            await connection.addFlags(item.attributes.uid, '\\Seen');
        } catch (mergeErr) {
            console.error(' -> Merge failed:', mergeErr.message || mergeErr);
            await connection.addFlags(item.attributes.uid, '\\Seen');
        }
    }

    if (mergedBranches.length) {
        console.log(`Merged ${mergedBranches.length} branch(es): ${mergedBranches.join(', ')}`);
    } else {
        console.log('No branches merged during this run.');
    }

    await connection.end();
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
