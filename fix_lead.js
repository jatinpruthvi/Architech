const fs = require('fs');
let text = fs.readFileSync('src/lib/requirements.test.ts', 'utf8');
text = text.replace(
  /\/\* BUG-R4-005:/,
  '/* [Fixed] BUG-R4-005:'
);
fs.writeFileSync('src/lib/requirements.test.ts', text);
