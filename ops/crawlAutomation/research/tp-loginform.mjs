import { Camoufox } from 'camoufox-js';

const PROFILE_DIR = 'C:\\Users\\Mishay\\.camofox\\profiles\\b30a0e34683cf2594ffa4b9f9b2379d3';
const BASE_URL = 'https://ahmedabad.technoproperty.in';
const USER = '8487921467';
const PASS = 'dp@7921';

async function main() {
  const context = await Camoufox({ headless: false, user_data_dir: PROFILE_DIR });
  const page = await context.newPage();
  await page.goto(`${BASE_URL}/login.php`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(3000);

  const formInfo = await page.evaluate(() => {
    const forms = [...document.querySelectorAll('form')];
    return forms.map(f => ({
      action: f.action,
      method: f.method,
      inputs: [...f.querySelectorAll('input, select, textarea, button')].map(i => ({
        tag: i.tagName, type: i.type || '', name: i.name || '', id: i.id || '',
        placeholder: i.placeholder || '', value: i.value || '',
      })),
    }));
  });
  console.log('LOGIN FORM INFO:', JSON.stringify(formInfo, null, 2));

  await context.close();
}

main().catch(err => { console.error('FATAL:', err.message); process.exit(1); });