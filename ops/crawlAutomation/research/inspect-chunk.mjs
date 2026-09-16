import { readFileSync } from 'node:fs';

const js = readFileSync('ab-page-chunk.js', 'utf8');

// find how propertydetail links are built
const hits = new Set();
let re = /propertydetail[^'"`]*/g;
let m;
while ((m = re.exec(js)) !== null) hits.add(m[0].slice(0, 120));
console.log('propertydetail refs:', [...hits].slice(0, 20));

re = /pid[=:]|\.pid\b|"pid"/g;
const pidRefs = [];
while ((m = re.exec(js)) !== null) pidRefs.push(js.slice(Math.max(0, m.index - 80), m.index + 100).replace(/\s+/g, ' '));
console.log('\npid refs:', pidRefs.slice(0, 20));

// look for encode/decode functions
re = /function \w*[Ee]nc\w*|function \w*[Dd]ec\w*|btoa|atob|base64|encodeURI|encodeProperty/g;
const enc = [];
while ((m = re.exec(js)) !== null) enc.push(js.slice(Math.max(0, m.index - 60), m.index + 120).replace(/\s+/g, ' '));
console.log('\nenc/dec functions:', [...new Set(enc)].slice(0, 15));
