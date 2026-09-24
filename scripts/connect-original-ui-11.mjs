import {readFileSync,writeFileSync} from 'node:fs';
const file='app/v28/legacy/legacy-ui.tsx';let s=readFileSync(file,'utf8');
const begin=s.indexOf('export function AgentPreferenceSheet('),end=s.indexOf('export function AgentMomentActionSheet(',begin);let piece=s.slice(begin,end);
piece=piece.replace('  const [topic, setTopic]',`  const runtime=useRuntime();
  const saved=runtime?.snapshot?.objects.settings[0].data.agent_publish as Record<string,AgentPublishPreferences>|undefined;
  initial=runtime?{...initial,...saved?.[id==='advisor'?'advise':id],format:'纯文字',frequency:'任务验收后'}:initial;
  const [topic, setTopic]`);
piece=piece.replace('    window.localStorage.setItem(',`    if(runtime?.snapshot){void runtime.command('agent.publish_preferences',{...entityRef(runtime.snapshot.objects.settings[0]),system:id==='advisor'?'advise':id,...next}).then(()=>onSave(next)).catch(()=>{});return;}
    window.localStorage.setItem(`).replace('["图文", "纯文字"]','runtime?["纯文字"]:["图文", "纯文字"]').replace('["每日 2 次", "每日 1 次", "每周 3 次"]','runtime?["任务验收后"]:["每日 2 次", "每日 1 次", "每周 3 次"]');
s=s.slice(0,begin)+piece+s.slice(end);writeFileSync(file,s);
const mf='app/v28/core/memory-evidence.tsx';writeFileSync(mf,readFileSync(mf,'utf8').replace("entry.data.accepted===true","entry.data.verdict==='accepted'"));
const panel='app/v28/core/runtime-panels.tsx';let p=readFileSync(panel,'utf8');
p=p.replace('<h3>本人副本 · {label(item)}</h3><Field name="成果正文" value={content} onChange={setContent} area/>','<h3>本人副本 · {label(item)}</h3>{Boolean(item.data.origin_copy)&&<details open><summary>当前正式成果（请合并保留其他人的贡献）</summary><p style={{whiteSpace:\'pre-wrap\'}}>{text(item,\'upstream_content\')||\'尚无正文\'}</p></details>}<Field name="成果正文" value={content} onChange={value=>{setContent(value);setReviewed(false)}} area/>');
p=p.replace('已核对本人贡献与验收标准</label>','{item.data.origin_copy?\'已核对并合并当前正式成果，保留其他人的贡献\':\'已核对本人贡献与验收标准\'}</label>');
p=p.replace('<h2>{text(post||project!,\'title\')}</h2>','<h2>{text(post||project!,\'title\')||\'此项目不存在或当前不可访问\'}</h2>');
writeFileSync(panel,p);
