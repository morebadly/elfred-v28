import {readFileSync,writeFileSync} from 'node:fs';
const file='app/v28/core/runtime-panels.tsx';let s=readFileSync(file,'utf8');
s=s.replace("if(!draft)await runtime.command('draft.save',{conversation_id:conversation.id,text:''});const result=await runtime.command('assist.fill',{id:item.id,draft_version:draft?.version||2,mode});","const draftVersion=draft?.version??(await runtime.command('draft.save',{conversation_id:conversation.id,text:'',version:0})).version;const result=await runtime.command('assist.fill',{id:item.id,draft_version:draftVersion,mode});");
const start=s.indexOf('function CopyEditor('),end=s.indexOf('function ContributionReview(',start);if(start<0||end<0)throw Error('CopyEditor missing');
s=s.slice(0,start)+`function CopyEditor({item}:{item:Entity}) {
  const runtime=useRuntime()!;
  const [content,setContent]=useState(text(item,'content')),[reviewed,setReviewed]=useState(false);
  const [base,setBase]=useState({version:item.version,content:text(item,'content')});
  const stale=item.data.status==='draft'&&item.version!==base.version;
  return <section className="v277-edit-card"><h3>本人副本 · {label(item)}</h3>
    {Boolean(item.data.origin_copy)&&<details open><summary>当前正式成果（请合并保留其他人的贡献）</summary><p style={{whiteSpace:'pre-wrap'}}>{text(item,'upstream_content')||'尚无正文'}</p></details>}
    <Field name="成果正文" value={content} onChange={value=>{setContent(value);setReviewed(false)}} area/>
    {stale&&<div><p>此副本已在其他页面修改。请先复制保留你的文字，再载入最新版本核对合并。</p><button className="v277-secondary" onClick={()=>{setBase({version:item.version,content:text(item,'content')});setContent(text(item,'content'));setReviewed(false)}}>载入最新副本</button></div>}
    {item.data.status==='draft'&&<><Action disabled={stale||content===base.content||!content.trim()} run={async()=>{const result=await runtime.command('copy.save',{id:item.id,version:base.version,content});setBase({version:result.version!,content})}}>保存副本</Action><label><input type="checkbox" checked={reviewed} onChange={e=>setReviewed(e.target.checked)}/>{item.data.origin_copy?'已核对并合并当前正式成果，保留其他人的贡献':'已核对本人贡献与验收标准'}</label><Action disabled={stale||!reviewed||content!==base.content} run={()=>runtime.command('copy.submit',{id:item.id,version:base.version,reviewed:true})}>提交已保存的贡献</Action></>}
    {item.data.status==='submitted'&&<Action run={()=>runtime.command('copy.revise',entityRef(item))}>基于最新正式成果创建修订副本</Action>}
  </section>;
}
`+s.slice(end);writeFileSync(file,s);
const legacy='app/v28/features/live/messages-view.tsx';s=readFileSync(legacy,'utf8').replace('version:draft?.version','version:draft?.version??0').replace("conversation_id:room.id,text:''}","conversation_id:room.id,text:'',version:draft?.version??0}");writeFileSync(legacy,s);
