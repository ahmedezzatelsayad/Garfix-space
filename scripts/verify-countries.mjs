// التحقق: لا إسرائيل في قائمة الدول، وفلسطين بعملة JOD
import { readFileSync } from 'fs';
const src = readFileSync('src/lib/countries-world.ts', 'utf8');
const israel = /Israel|إسرائيل/i.test(src);
const ils = /ILS/.test(src);
const psLine = src.split('\n').find(l => l.includes('"PS"'));
console.log(JSON.stringify({
  israelInCountries: israel,
  ilsCurrency: ils,
  palestineLine: psLine ? psLine.trim() : 'MISSING'
}, null, 1));
