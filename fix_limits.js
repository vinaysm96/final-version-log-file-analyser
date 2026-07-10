import fs from 'fs';
let c = fs.readFileSync('src/lib/db/seoQueries.ts', 'utf8');
c = c.replace(/LIMIT 100\b/g, 'LIMIT 10000');
c = c.replace(/LIMIT 20\b/g, 'LIMIT 10000');
c = c.replace(/LIMIT 50\b/g, 'LIMIT 10000');
fs.writeFileSync('src/lib/db/seoQueries.ts', c);
console.log('Fixed limits');
