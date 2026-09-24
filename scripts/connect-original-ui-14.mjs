import {readFileSync,writeFileSync} from 'node:fs';
let file='app/v28/legacy/legacy-ui.tsx',s=readFileSync(file,'utf8');
s=s.replace("?.data.not_before)||Date.now()", "?.data.not_before)||runtime.snapshot?.server_time||0");
s=s.replace('          <p style={{whiteSpace:"pre-wrap"}}>{item.example}</p>','          <p style={{whiteSpace:"pre-wrap"}}>{formatAssetBody(item.example)}</p>\n          {runtime&&Array.isArray(entity?.data.source_refs)&&(entity.data.source_refs as {id:string}[]).map(ref=><button className="v277-secondary" key={ref.id} onClick={()=>{const source=Object.values(runtime.snapshot!.objects).flat().find(value=>value.id===ref.id);if(source)go({name:source.type===\'task\'?\'task\':\'knowledge-detail\',id:source.id});else notify(\'此来源已不可访问\')}}>查看来源</button>)}');
s=s.replace('export function KnowledgeDetail(',`function formatAssetBody(content:string) {
  // Older local search artifacts were stored as JSON. Render their evidence as prose.
  if(content.trim().startsWith('['))try{const hits=JSON.parse(content);if(Array.isArray(hits)&&hits.every(hit=>typeof hit.title==='string'&&typeof hit.excerpt==='string'))return hits.map(hit=>hit.title+'\\n'+hit.excerpt+'\\n定位：'+(hit.anchor||'')).join('\\n\\n')}catch{}
  return content;
}
export function KnowledgeDetail(`);
writeFileSync(file,s);
