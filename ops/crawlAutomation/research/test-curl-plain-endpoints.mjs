import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';

const execFileP = promisify(execFile);
const CURL = 'E:\\Jatin-Project\\Broker\\BrainStrom\\automation\\vendor\\curl-impersonate\\curl-impersonate.exe';
const COOKIE = 'PHPSESSID=b93ndd1hh0206ve18a9ljlivgt; screenWidth=1098; _ga=GA1.1.986846689.1789451856; cf_clearance=EadqJbhvxxlLxr81LDmbcWK6gJMrdDwR5Rlnvj6x3v8-1789461733-1.2.1.1-0gSlTxx2Tyuqf5wvRuuNd.QFMQBcKVwy17amGom2Dgbtu9vVyVyAWwA2hvLQLpM0NwkUSMQ2jCUFKH5gJEcRy59SEi3aUG8ZDpPP0cXyDj.yGanI9GL6IauC6ZrvY5YfeAy8Dkg1Kl3xRMTM0AMAbGlXayAZWX.FR7C6VWDJHKd0ABIu6IDFVe1FSP6Tyzr4Uyp7pTnFWunvFm04PpeKBVo_AeprparouzVP9B8kfHg5B11hOZGqwdUILUaUl9Dvdg_0KOJg0zH2OV4SAEhZQhWn5zhv1gAtotcicJCMRXukeL.y.XA3O0.n1ZHV2c7OW4Ga49UxyA69oHvHCFyU.egFiYc0QS13Trf0gvRmUu4; _ga_1DEN42JG14=GS2.1.s1789460051$o3$g1$t1789461854$j60$l0$h0';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36';
const BASE = 'https://ahmedabad.technoproperty.in';

async function post(label, url, body, extraHeaders = []) {
  const tmp = join(tmpdir(), `tp-${Date.now()}-${randomBytes(4).toString('hex')}.txt`);
  const args = [
    '-sS', '--noproxy', '*', '-L', '-o', tmp, '-w', '__DONE__ %{http_code} %{size_download}',
    '-X', 'POST',
    '-H', `cookie: ${COOKIE}`,
    '-H', `user-agent: ${UA}`,
    '-H', 'accept: */*',
    '-H', 'content-type: application/x-www-form-urlencoded; charset=UTF-8',
    '-H', 'x-requested-with: XMLHttpRequest',
    '-H', `referer: ${BASE}/premiumPropList.php`,
    ...extraHeaders,
    '-d', body,
    url,
  ];
  try {
    const { stdout } = await execFileP(CURL, args, { timeout: 30000, maxBuffer: 16 * 1024 * 1024, windowsHide: true });
    const b = readFileSync(tmp, 'utf8');
    const m = stdout.match(/__DONE__\s+(\d+)\s+(\d+)/);
    rmSync(tmp, { force: true });
    return { label, status: m ? parseInt(m[1]) : 0, size: parseInt(m?.[2] || 0), body: b.slice(0, 300) };
  } catch (e) {
    rmSync(tmp, { force: true });
    return { label, status: 0, size: 0, body: '', error: e.message };
  }
}

// 1) contact reveal endpoint directly
const r1 = await post('ajaxgetinfo', BASE + '/ajaxgetinfo.php', 'proprow=getcntinfo_MzAyODI4IyMwOTE1MjY&ajax=true');
console.log(JSON.stringify(r1));

// 2) images endpoint directly
const r2 = await post('ajaxgetimages', BASE + '/ajaxgetimages.php', 'propertyId=d266b985-5c65-d51b-ebc9-6a9fa63fac1f&ajax=true');
console.log(JSON.stringify({ ...r2, body: r2.body.slice(0, 400) }));

// 3) premium listings endpoint directly (challenge?)
const r3 = await post('ajaxpremium', BASE + '/ajaxpremiumpropdatatable.php', 'draw=1&start=0&length=25&searchvalue=all&initiallisting=1&order%5B0%5D%5Bcolumn%5D=3&order%5B0%5D%5Bdir%5D=desc');
console.log(JSON.stringify({ ...r3, body: r3.body.slice(0, 400) }));

// 4) important listings endpoint directly
const r4 = await post('ajaximportant', BASE + '/ajaximppropdatatable.php', 'draw=1&start=0&length=25&initiallisting=1&order%5B0%5D%5Bcolumn%5D=3&order%5B0%5D%5Bdir%5D=desc');
console.log(JSON.stringify({ ...r4, body: r4.body.slice(0, 400) }));