const fs = require('fs');
const content = fs.readFileSync('ops/config/performance/budgets.json', 'utf-8');

const SEARCH = `<<<<<<< Updated upstream
      "maxFirstLoadJsBytes": 850000,
=======
      "maxFirstLoadJsBytes": 830000,
>>>>>>> Stashed changes`;

const REPLACE = `      "maxFirstLoadJsBytes": 850000,`;

if (content.includes(SEARCH)) {
  fs.writeFileSync('ops/config/performance/budgets.json', content.replace(SEARCH, REPLACE));
  console.log("Fixed conflict in budgets.json");
} else {
  console.log("Conflict markers not found exactly as specified");
}
