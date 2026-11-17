import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
const tests=fs.readdirSync('.').filter(name=>name.endsWith('test.mjs')).sort();
for(const test of tests){const r=spawnSync(process.execPath,[test],{stdio:'inherit'});if(r.status!==0)process.exit(r.status||1)}
const r=spawnSync(process.execPath,['build.mjs'],{stdio:'inherit'});if(r.status!==0)process.exit(r.status||1);
const syntax=spawnSync(process.execPath,['--check','dist/server/index.js'],{stdio:'inherit'});if(syntax.status!==0)process.exit(syntax.status||1);
console.log('All checks and Worker build passed.');
