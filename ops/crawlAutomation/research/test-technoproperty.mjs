import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';

const execFileP = promisify(execFile);
const CURL = 'E:\\Jatin-Project\\Broker\\BrainStrom\\automation\\vendor\\curl-impersonate\\curl-impersonate.exe';

const COOKIE = 'PHPSESSID=b93ndd1hh0206ve18a9ljlivgt; screenWidth=1098; _ga=GA1.1.986846689.1789451856; cf_clearance=EadqJbhvxxlLxr81LDmbcWK6gJMrdDwR5Rlnvj6x3v8-1789461733-1.2.1.1-0gSlTxx2Tyuqf5wvRuuNd.QFMQBcKVwy17amGom2Dgbtu9vVyVyAWwA2hvLQLpM0NwkUSMQ2jCUFKH5gJEcRy59SEi3aUG8ZDpPP0cXyDj.yGanI9GL6IauC6ZrvY5YfeAy8Dkg1Kl3xRMTM0AMAbGlXayAZWX.FR7C6VWDJHKd0ABIu6IDFVe1FSP6Tyzr4Uyp7pTnFWunvFm04PpeKBVo_AeprparouzVP9B8kfHg5B11hOZGqwdUILUaUl9Dvdg_0KOJg0zH2OV4SAEhZQhWn5zhv1gAtotcicJCMRXukeL.y.XA3O0.n1ZHV2c7OW4Ga49UxyA69oHvHCFyU.egFiYc0QS13Trf0gvRmUu4; _ga_1DEN42JG14=GS2.1.s1789460051$o3$g1$t1789461854$j60$l0$h0';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36';

async function curl(label, url, extraHeaders = []) {
  const tmp = join(tmpdir(), `tp-${Date.now()}-${randomBytes(4).toString('hex')}.html`);
  const args = [
    '-sS', '--noproxy', '*', '-L',
    '-o', tmp, '-w', '\n__DONE__ %{http_code} %{url_effective} %{size_download}',
    '-H', `cookie: ${COOKIE}`,
    '-H', `user-agent: ${UA}`,
    '-H', 'accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    '-H', 'accept-language: en-US,en;q=0.9',
    '-H', 'sec-ch-ua: "Google Chrome";v="153", "Not_A Brand";v="8", "Chromium";v="153"',
    '-H', 'sec-ch-ua-mobile: ?0',
    '-H', 'sec-ch-ua-platform: "Windows"',
    '-H', 'sec-fetch-dest: document',
    '-H', 'sec-fetch-mode: navigate',
    '-H', 'sec-fetch-site: none',
    '-H', 'sec-fetch-user: ?1',
    ...extraHeaders,
    url,
  ];
  try {
    const { stdout } = await execFileP(CURL, args, { timeout: 60000, maxBuffer: 64 * 1024 * 1024, windowsHide: true });
    const body = readFileSync(tmp, 'utf8');
    const m = stdout.match(/__DONE__\s+(\d+)\s+(\S+)\s+(\d+)/);
    rmSync(tmp, { force: true });
    return { status: m ? parseInt(m[1], 10) : 0, url: m?.[2] ?? url, size: parseInt(m?.[3] || '0'), body, label };
  } catch (e) {
    rmSync(tmp, { force: true });
    return { status: 0, url, size: 0, body: '', label, error: e.message };
  }
}

// Test 1: main page
const r1 = await curl('homepage', 'https://ahmedabad.technoproperty.in/');
console.log(`\n=== ${r1.label}: status=${r1.status} size=${r1.size} url=${r1.url}`);
console.log(r1.body.slice(0, 600));

// Test 2: dashboard
const r2 = await curl('dashboard', 'https://ahmedabad.technoproperty.in/dashboard.php');
console.log(`\n=== ${r2.label}: status=${r2.status} size=${r2.size}`);
console.log(r2.body.slice(0, 600));

// Test 3: brokerpropertycount (the API endpoint from the curl)
const r3 = await curl('brokerpropertycount', 'https://ahmedabad.technoproperty.in/brokerpropertycount.php', [
  '-H', 'accept: */*',
  '-H', 'referer: https://ahmedabad.technoproperty.in/dashboard.php',
  '-H', 'x-requested-with: XMLHttpRequest',
  '-H', 'sec-fetch-dest: empty',
  '-H', 'sec-fetch-mode: cors',
  '-H', 'sec-fetch-site: same-origin',
]);
console.log(`\n=== ${r3.label}: status=${r3.status} size=${r3.size}`);
console.log(r3.body.slice(0, 600));

// Test 4: search / listing page
const r4 = await curl('search', 'https://ahmedabad.technoproperty.in/property-search.php');
console.log(`\n=== ${r4.label}: status=${r4.status} size=${r4.size}`);
console.log(r4.body.slice(0, 600));

// Test 5: rent listing
const r5 = await curl('rent', 'https://ahmedabad.technoproperty.in/rent.php');
console.log(`\n=== ${r5.label}: status=${r5.status} size=${r5.size}`);
console.log(r5.body.slice(0, 600));

// Test 6: buy listing
const r6 = await curl('buy', 'https://ahmedabad.technoproperty.in/buy.php');
console.log(`\n=== ${r6.label}: status=${r6.status} size=${r6.size}`);
console.log(r6.body.slice(0, 600));
