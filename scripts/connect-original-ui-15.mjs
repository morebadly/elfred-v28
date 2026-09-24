import {readFileSync,writeFileSync} from 'node:fs';
let file='app/v28/features/knowledge/knowledge-page.tsx',s=readFileSync(file,'utf8');
s=s.replace('import {text} from "../live/types"','import {text,assetText,statuses} from "../live/types"');
s=s.replaceAll("text(item,'content').slice(0,80)||text(item,'instructions')",'assetText(item).slice(0,80)').replaceAll("text(item,'content')||text(item,'instructions')",'assetText(item)').replaceAll("status:text(item,'status')","status:statuses[text(item,'status')]||text(item,'status')");writeFileSync(file,s);
file='app/v28/legacy/legacy-ui.tsx';s=readFileSync(file,'utf8').replace('`已确认 ${confirmed} 条`','`确认 ${confirmed}`').replace("runtime?'查看依据':'Lv.4'","runtime?'依据':'Lv.4'");writeFileSync(file,s);
