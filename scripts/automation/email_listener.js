const imaps = require('imap-simple');
const { Octokit } = require('@octokit/rest');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

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
        try {
            const b = fs.readFileSync(intermediatesPath);
            if (b.length) {
                console.log('Loaded intermediates from', intermediatesPath);
                bufs.push(b);
            }
        } catch (e) {
            console.warn('Failed to read', intermediatesPath, e && e.message);
        }
    }

    const leafPath = '/tmp/ca/mailserver.pem';
    if (fs.existsSync(leafPath)) {
        try {
            const b = fs.readFileSync(leafPath);
            if (b.length) {
                console.log('Loaded leaf cert from', leafPath);
                bufs.push(b);
            }
        } catch (e) {
            console.warn('Failed to read', leafPath, e && e.message);
        }
    }

    if (process.env.NODE_EXTRA_CA_CERTS && fs.existsSync(process.env.NODE_EXTRA_CA_CERTS)) {
        try {
            const b = fs.readFileSync(process.env.NODE_EXTRA_CA_CERTS);
            if (b.length) {
                console.log('Loaded NODE_EXTRA_CA_CERTS from', process.env.NODE_EXTRA_CA_CERTS);
                bufs.push(b);
            }
        } catch (e) {
            console.warn('Failed to read NODE_EXTRA_CA_CERTS', e && e.message);
        }
    }

    const systemCA = '/etc/ssl/certs/ca-certificates.crt';
    if (fs.existsSync(systemCA)) {
        try {
            const b = fs.readFileSync(systemCA);
            if (b.length) {
                console.log('Loaded system CA bundle from', systemCA);
                bufs.push(b);
            }
        } catch (e) {
            console.warn('Failed to read', systemCA, e && e.message);
        }
    }

    return bufs;
}

function debugPrintCertSubjects(buf, label) {
    try {
        const tmpDir = '/tmp/ca';
        if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
        const tmpFile = path.join(tmpDir, `debug_${label}.pem`);
        fs.writeFileSync(tmpFile, buf);

        const out = execSync(
            `awk 'BEGIN{c=0}/-----BEGIN CERTIFICATE-----/{c++; fname="${tmpFile}." c ".pem"} {print > fname}' ${tmpFile} && echo OK`,
            { encoding: 'utf8' }
        );

        const files = fs.readdirSync('/tmp/ca').filter(f => f.startsWith(`debug_${label}.pem.`)).sort();
        for (const f of files) {
            try {
                const info = execSync(`openssl x509 -in /tmp/ca/${f} -noout -subject -issuer`, { encoding: 'utf8' }).trim();
                console.log(`Debug cert ${f}: ${info}`);
            } catch (e) {
                console.warn('openssl x509 failed for', f, e && e.message);
            }
        }
    } catch (e) {
        console.warn('debugPrintCertSubjects failed:', e && e.message);
    }
}

async function main() {
    console.log('ENV NODE_EXTRA_CA_CERTS =', process.env.NODE_EXTRA_CA_CERTS || '(none)');

    const caFileCandidates = [
        process.env.NODE_EXTRA_CA_CERTS,
        '/tmp/ca/intermediates.pem',
        '/tmp/ca/mailserver.pem',
        '/etc/ssl/certs/ca-certificates.crt',
        '/etc/pki/tls/certs/ca-bundle.crt'
    ].filter(Boolean);

    let caFileFound = null;
    for (const c of caFileCandidates) {
        if (fs.existsSync(c)) { caFileFound = c; break; }
    }
    console.log('CA file used (first existing candidate):', caFileFound || '(none)');
    if (!caFileFound) {
        console.warn('Aucun bundle CA trouvé parmi:', caFileCandidates.join(', '));
    }

    const caBuffers = loadCertBuffers();
    if (caBuffers.length) {
        console.log('Number of CA buffers to provide to tlsOptions.ca =', caBuffers.length);
        for (let i = 0; i < caBuffers.length; i++) {
            debugPrintCertSubjects(caBuffers[i], `buf${i}`);
        }
    } else {
        console.log('No CA buffers were loaded; tlsOptions.ca will be undefined (use system defaults).');
    }

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

    console.log('Connecting to IMAP host:', EMAIL_HOST, 'port:', EMAIL_PORT, 'tls:', EMAIL_SECURE);
    if (IMAP_ALLOW_SELF_SIGNED) {
        console.warn('IMAP_ALLOW_SELF_SIGNED is true -> rejectUnauthorized=false (debug ONLY).');
    }

    const connection = await imaps.connect(config);
    await connection.openBox('INBOX');

    const searchCriteria = ['UNSEEN'];
    const fetchOptions = { bodies: ['HEADER.FIELDS (FROM TO SUBJECT DATE)'], markSeen: false };

    const messages = await connection.search(searchCriteria, fetchOptions);

    console.log(`Found ${messages.length} unseen messages.`);

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
            console.log(` -> sender ${fromEmail} not in allowed_senders. Marking seen and skipping.`);
            await connection.addFlags(item.attributes.uid, '\\Seen');
            continue;
        }

        const branchName = subject;
        let branchExists = false;
        try {
            await octokit.repos.getBranch({ owner, repo, branch: branchName });
            branchExists = true;
        } catch (err) {
            branchExists = false;
        }

        if (!branchExists) {
            console.log(` -> branch "${branchName}" does not exist. Marking seen and skipping.`);
            await connection.addFlags(item.attributes.uid, '\\Seen');
            continue;
        }

        try {
            console.log(` -> Merging branch "${branchName}" into "${TARGET_BRANCH}"...`);
            const mergeResp = await octokit.repos.merge({
                owner,
                repo,
                base: TARGET_BRANCH,
                head: branchName,
            });
            console.log(' -> Merge API response:', mergeResp.status);

            const m = branchName.match(/^pending\/(actualite|index|galerie)_.+$/);
            if (m) {
                const type = m[1];
                console.log(` -> Detected type "${type}" from branch name. Executing generator...`);

                try {
                    if (type === 'actualite') {
                        console.log('  Running: python3 scripts/generate_actualites.py');
                        execSync('python3 scripts/generate_actualites.py', { stdio: 'inherit' });
                    } else {
                        const scriptPath = `scripts/generate_${type}_json.js`;
                        console.log(`  Running: node ${scriptPath}`);
                        execSync(`node ${scriptPath}`, { stdio: 'inherit' });
                    }
                } catch (runErr) {
                    console.error('    Error while executing generator script:', runErr);
                }
            } else {
                console.log(' -> Branch name not in expected pending/{type}_... format ; not running generator.');
            }
            await connection.addFlags(item.attributes.uid, '\\Seen');
        } catch (mergeErr) {
            console.error(' -> Merge failed:', mergeErr.message || mergeErr);
            await connection.addFlags(item.attributes.uid, '\\Seen');
        }
    }
    await connection.end();
    console.log('Done.');
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
