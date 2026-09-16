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
    '-o', tmp, '-w', '\n__DONE__ %{http_code} %{size_download}',
    '-H', `cookie: ${COOKIE}`,
    '-H', `user-agent: ${UA}`,
    '-H', 'accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    '-H', 'accept-language: en-US,en;q=0.9',
    '-H', 'referer: https://ahmedabad.technoproperty.in/dashboard.php',
    '-H', 'sec-ch-ua: "Google Chrome";v="153", "Not_A Brand";v="8", "Chromium";v="153"',
    '-H', 'sec-ch-ua-mobile: ?0',
    '-H', 'sec-ch-ua-platform: "Windows"',
    ...extraHeaders,
    url,
  ];
  try {
    const { stdout } = await execFileP(CURL, args, { timeout: 60000, maxBuffer: 64 * 1024 * 1024, windowsHide: true });
    const body = readFileSync(tmp, 'utf8');
    const m = stdout.match(/__DONE__\s+(\d+)\s+(\d+)/);
    rmSync(tmp, { force: true });
    return { status: m ? parseInt(m[1], 10) : 0, size: parseInt(m?.[2] || '0'), body, label };
  } catch (e) {
    rmSync(tmp, { force: true });
    return { status: 0, size: 0, body: '', label, error: e.message };
  }
}

for (const [label, url] of [
  ['ResidentialRent', 'https://ahmedabad.technoproperty.in/ResidentialRent.php'],
  ['ResidentialSell', 'https://ahmedabad.technoproperty.in/ResidentialSell.php'],
  ['listproperty', 'https://ahmedabad.technoproperty.in/listproperty.php'],
  ['filteredPropList', 'https://ahmedabad.technoproperty.in/filteredPropList.php'],
  ['brokersproperty', 'https://ahmedabad.technoproperty.in/brokersproperty.php?proptype=ResidentialRent'],
]) {
  const r = await curl(label, url);
  writeFileSync(`tp-${label}.html`, r.body);
  console.log(`\n=== ${label}: status=${r.status} size=${r.size}`);
}