const fs = require('fs');
let content = fs.readFileSync('src/pages/ModoOficina/index.tsx', 'utf-8');
content = content.replace(/\\`/g, '`').replace(/\\\$/g, '$');
fs.writeFileSync('src/pages/ModoOficina/index.tsx', content);
