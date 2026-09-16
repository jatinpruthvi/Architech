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
const BASE = 'https://ahmedabad.technoproperty.in';

async function post(label, url, body) {
  const tmp = join(tmpdir(), `tp-${Date.now()}-${randomBytes(4).toString('hex')}.json`);
  const args = [
    '-sS', '--noproxy', '*', '-L',
    '-o', tmp, '-w', '\n__DONE__ %{http_code} %{size_download}',
    '-X', 'POST',
    '-H', `cookie: ${COOKIE}`,
    '-H', `user-agent: ${UA}`,
    '-H', 'accept: */*',
    '-H', 'accept-language: en-US,en;q=0.9',
    '-H', 'content-type: application/x-www-form-urlencoded; charset=UTF-8',
    '-H', 'x-requested-with: XMLHttpRequest',
    '-H', 'referer: ' + BASE + '/ResidentialRent.php',
    '-H', 'sec-ch-ua: "Google Chrome";v="153", "Not_A Brand";v="8", "Chromium";v="153"',
    '-H', 'sec-ch-ua-mobile: ?0',
    '-H', 'sec-ch-ua-platform: "Windows"',
    '-H', 'sec-fetch-dest: empty',
    '-H', 'sec-fetch-mode: cors',
    '-H', 'sec-fetch-site: same-origin',
    '-d', body,
    url,
  ];
  try {
    const { stdout } = await execFileP(CURL, args, { timeout: 60000, maxBuffer: 64 * 1024 * 1024, windowsHide: true });
    const body2 = readFileSync(tmp, 'utf8');
    const m = stdout.match(/__DONE__\s+(\d+)\s+(\d+)/);
    rmSync(tmp, { force: true });
    return { status: m ? parseInt(m[1], 10) : 0, size: parseInt(m?.[2] || '0'), body: body2, label };
  } catch (e) {
    rmSync(tmp, { force: true });
    return { status: 0, size: 0, body: '', label, error: e.message };
  }
}

// Test with the exact request captured from the page
const body = 'draw=1&start=0&length=25&searchvalue=all&propertytype=c7f77b53-1a4c-4fe7-1c9e-5147f5e13535&countcategory=Residential+Rent&initiallisting=1&order%5B0%5D%5Bcolumn%5D=3&order%5B0%5D%5Bdir%5D=desc';
const r = await post('ajaxpropertydatatable-p1', BASE + '/ajaxpropertydatatable.php', body);
console.log(`\n=== ${r.label}: status=${r.status} size=${r.size}`);
console.log(r.body.slice(0, 2000));
writeFileSync('tp-ajax-p1.json', r.body);

// Page 2 (start=25)
const body2 = body.replace('start=0', 'start=25');
const r2 = await post('ajaxpropertydatatable-p2', BASE + '/ajaxpropertydatatable.php', body2);
console.log(`\n=== ${r2.label}: status=${r2.status} size=${r2.size}`);
console.log(r2.body.slice(0, 500));
writeFileSync('tp-ajax-p2.json', r2.body);