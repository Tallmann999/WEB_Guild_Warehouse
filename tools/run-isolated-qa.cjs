'use strict';
// Keep historical screenshot evidence intact while reusing existing scenarios.
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const root=path.resolve(__dirname,'..'),file=path.resolve(root,process.argv[2]||'');
if(!file.startsWith(path.join(root,'tests')+path.sep)||!file.endsWith('.cjs'))throw Error('Pass a tests/*.cjs scenario');
fs.mkdirSync(path.join(root,'output/playwright/revisions-20261030'),{recursive:true});
const source=fs.readFileSync(file,'utf8').replaceAll("path:'audit_source/","path:'output/playwright/revisions-20261030/").replaceAll('path:"audit_source/','path:"output/playwright/revisions-20261030/');
const test=new Module(file,module);test.filename=file;test.paths=Module._nodeModulePaths(path.dirname(file));test._compile(source,file);
