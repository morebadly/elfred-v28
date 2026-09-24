import fs from 'node:fs';
const replace=(s,a,b)=>{if(!s.includes(a))throw new Error(a.slice(0,80));return s.replace(a,b)};
let p='app/v28/features/knowledge/knowledge-page.tsx',s=fs.readFileSync(p,'utf8');
s=s.replace('import { useRef, useState }','import {useRuntime} from "../../core/runtime-context";\nimport {text} from "../live/types";\nimport { useRef, useState }');
s=replace(s,'  const [filter, setFilter]', '  const runtime=useRuntime();\n  const [filter, setFilter]');
s=replace(s,'  const cards: CapabilityCard[] = [','  const demoCards: CapabilityCard[] = [');
s=replace(s,'  const visibleCards =',`  const cards:CapabilityCard[]=runtime?[...(runtime.snapshot?.objects.knowledge||[]),...(runtime.snapshot?.objects.document||[]),...(runtime.snapshot?.objects.skill||[])].filter(item=>item.data.status!=='archived').map(item=>({item:{id:item.id,title:text(item,'title'),purpose:text(item,'content').slice(0,80)||text(item,'instructions'),source:item.type,status:text(item,'status'),example:text(item,'content')||text(item,'instructions')},type:item.type==='skill'?'Skill':'资料',title:text(item,'title'),copy:text(item,'content').slice(0,80)||text(item,'instructions'),score:0,evidence:Array.isArray(item.data.source_refs)?item.data.source_refs.length:0,icon:FileText})):demoCards;
  const visibleCards =`);
s=replace(s,'["全部", "Skill", "Mini App", "Agent"].map','(runtime?["全部", "资料", "Skill", "Agent"]:["全部", "Skill", "Mini App", "Agent"]).map');
s=replace(s,'                  setSelectedCapability({','                  runtime?go({name:"knowledge-detail",id:item.id}):setSelectedCapability({');
s=replace(s,'                  Lv.1 · 探索','                  {runtime?item.status:"Lv.1 · 探索"}');
s=replace(s,'{score}\n                    <em>模型评分</em>','{runtime?"已保存":score}\n                    <em>{runtime?"可追溯资料":"模型评分"}</em>');
s=replace(s,'<span>{evidence} 条 Evidence</span>','<span>{evidence} 条来源</span>');
s=replace(s,'        <section className="v277-progress-section">',`        {runtime&&visibleCards.length===0&&<div className="v277-empty"><FileText size={24}/><b>这里还没有资料</b><p>点击上方创建按钮导入文档、保存笔记；验收任务后成果也会出现在这里。</p></div>}
        <section className="v277-progress-section">`);
s=replace(s,'          <div className="v277-progress-cards">',`          <div className="v277-progress-cards">{runtime?(runtime.snapshot?.objects.feed||[]).slice(0,2).map(item=><button key={item.id} onClick={()=>go({name:'task',id:text(item,'task_id')})}><span><CheckCircle2 size={19}/></span><b>{text(item,'title')}</b><small>本人验收的成果</small><strong>✓</strong></button>):<>`);
s=replace(s,'          </div>\n        </section>\n        <section className="v277-cave-section">','          </>} </div>\n        </section>\n        <section className="v277-cave-section">');
s=replace(s,'              <div className="v277-radar-body">',`              {runtime?<div className="v277-radar-body"><div><b>{runtime.snapshot?.objects.task.filter(item=>item.data.status==='completed').length||0}</b><p>本人已验收结果</p><span>能力尚需跨任务验证</span><em>资料数量不等于能力评分</em></div></div>:<div className="v277-radar-body">`);
s=replace(s,'              </div>\n            </button>','              </div>}\n            </button>');
s=replace(s,'              <div className="v279-trend-body">',`              {runtime?<div className="v279-trend-body"><div><b>{runtime.snapshot?.objects.memory.filter(item=>item.data.status==='validated').length||0}</b><p>本人确认的理解</p><span>跨时间稳定性尚未验证</span><em>可在记忆库查看依据与修正</em></div></div>:<div className="v279-trend-body">`);
const idx=s.indexOf('className="v279-trend-body"');const e=s.indexOf('              </div>\n            </button>',idx);if(e<0)throw Error('trend');s=s.slice(0,e)+s.slice(e).replace('              </div>\n            </button>','              </div>}\n            </button>');fs.writeFileSync(p,s);
p='app/v28/legacy/legacy-ui.tsx';let source=fs.readFileSync(p,'utf8').replace('type: "Skill" | "Mini App" | "Agent";','type: "Skill" | "Mini App" | "Agent" | "资料";');
const section=(name,fn)=>{const start=source.indexOf('export function '+name+'(');let end=source.indexOf('\nexport ',start+1);if(start<0)throw Error(name);if(end<0)end=source.length;source=source.slice(0,start)+fn(source.slice(start,end))+source.slice(end)};
section('GlobalSearchSheet',s=>{
 s=replace(s,'  const [query, setQuery]',`  const runtime=useRuntime();
  const [hits,setHits]=useState<{id:string;type:string;title:string;excerpt:string;anchor:string}[]>([]);
  const [query, setQuery]`);
 s=replace(s,'  const results = normalized',`  useEffect(()=>{if(!runtime)return;if(!normalized){setHits([]);return;}let active=true;const timer=setTimeout(()=>{void runtime.request<{hits:typeof hits}>('/search',{query:normalized}).then(result=>{if(active)setHits(result.hits)}).catch(()=>{if(active)setHits([])})},250);return()=>{active=false;clearTimeout(timer)}},[normalized]);
  const results = runtime?hits.map(item=>({key:item.id,type:item.type,title:item.title,copy:item.excerpt+' · '+item.anchor,action:()=>go(item.type==='task'?{name:'task',id:item.id}:item.type==='post'?{name:'community-post',id:item.id}:{name:'knowledge-detail',id:item.id})})):normalized`);return s;
});
section('AlignmentModal',s=>{
 s=replace(s,'  const [tab, setTab]', '  const runtime=useRuntime();\n  const [tab, setTab]');
 s=replace(s,'{tab === "level" ? (',`{runtime?<div className="v279-level-panel"><section className="v279-stage-card"><div><small>当前理解</small><h3>有待验证</h3><p>本人确认 {runtime.snapshot?.objects.memory.filter(item=>item.data.status==='validated').length||0} 条理解。尚无跨情境、跨时间验证，不生成百分比与等级。</p></div></section><button className="v277-secondary" onClick={()=>_go({name:'memory'})}>查看理解依据</button><button className="v277-secondary" onClick={()=>_go({name:'tasks'})}>查看真实成果</button></div>:tab === "level" ? (`);return s;
});
section('TaskPlayerPage',s=>{
 s=replace(s,'  const playable =','  const runtime=useRuntime();\n  const playable =');
 s=replace(s,'  const title = current?.title || "生成今日重点简报";',`  const liveTask=runtime?.snapshot?.objects.task.find(item=>item.id===current?.id),liveRun=runtime?.snapshot?.objects.run.find(item=>item.id===liveTask?.data.run_id);
  const steps=(liveRun?.data.plan as {steps:{id:string;tool:string}[]}|undefined)?.steps||[];
  const receipts=(liveRun?.data.receipts||[]) as {id:string;step_id:string;at:string;status:string;output_hash:string}[];
  const progress=steps.length?Math.floor(receipts.length/steps.length*100):0;
  const title = current?.title || (runtime?"当前没有任务":"生成今日重点简报");`);
 s=replace(s,'    const next = current.status',`    if(runtime){if(liveRun&&liveRun.data.status==='running')void runtime.command('run.command',{...entityRef(liveRun),command:'pause'}).catch(()=>{});else go({name:'task',id:current.id});return;}
    const next = current.status`);
 s=replace(s,'    notify("问题已发送给当前任务");',`    if(runtime){void runtime.command('task.create',{goal:question,mode:'compose',system:'execute'}).then(result=>go({name:'task',id:result.id})).catch(()=>{});return;}
    notify("问题已发送给当前任务");`);
 s=replace(s,'onClick={() => notify("任务分享链接已复制")}','onClick={() => notify(runtime?"任务为本人私有，可验收后在社区单独发布成果":"任务分享链接已复制")}');
 s=replace(s,'            setSaved((value) => !value);',`            if(runtime&&current){void runtime.command('inbox.create',{object_id:current.id}).then(()=>notify('已保存到待办收件箱')).catch(()=>{});return;}
            setSaved((value) => !value);`);
 s=replace(s,'<p>{agent} Agent · 已运行 12 分钟</p>','<p>{agent} Agent · {runtime?"累计运行 "+Math.round(Number(liveTask?.data.elapsed_ms||0)/1000)+" 秒":"已运行 12 分钟"}</p>');
 s=replace(s,'<b>64%</b>','<b>{runtime?progress:64}%</b>');s=replace(s,'              <em />','              <em style={runtime?{width:progress+"%"}:undefined}/>');
 s=replace(s,'{tab === "SOP" ? (',`{runtime?<ol>{steps.map(step=><li key={step.id} className={receipts.some(receipt=>receipt.step_id===step.id)?'done':'current'}><i/><span>{step.tool}</span><strong>{tab==='实时日志'?receipts.filter(receipt=>receipt.step_id===step.id).map(receipt=>new Date(receipt.at).toLocaleTimeString()+' · 成功回执 '+receipt.output_hash.slice(0,8)).join('；')||'暂无回执':step.id}</strong></li>)}{liveRun?.data.error&&<li><span>{String((liveRun.data.error as {message:string}).message)}</span></li>}</ol>:tab === "SOP" ? (`);
 s=replace(s,'                setSpeedOpen((value) => !value);','                if(runtime){notify("执行速度由工具决定，任务进度实时读取");return;}\n                setSpeedOpen((value) => !value);');
 s=replace(s,'                setModelOpen((value) => !value);','                if(runtime){go({name:"settings"});return;}\n                setModelOpen((value) => !value);');s=replace(s,'              {model}','              {runtime?runtime.snapshot?.provider.model||"未配置模型":model}');return s;
});
fs.writeFileSync(p,source);
