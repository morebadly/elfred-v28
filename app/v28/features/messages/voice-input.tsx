"use client";
import {useState} from 'react';
import {Mic,AudioLines} from 'lucide-react';
import {useRuntime,entityRef} from '../../core/runtime-context';
import {Action} from '../../core/runtime-panels';
import {RootPortal} from '../../legacy/legacy-ui';
import {AttachmentPicker,type FileRef} from '../live/attachments';
import {text,type Entity} from '../live/types';
export function VoiceInput({onText,disabled=false,waveform=false}:{onText:(value:string)=>void;disabled?:boolean;waveform?:boolean}){
 const runtime=useRuntime(),[open,setOpen]=useState(false),[files,setFiles]=useState<FileRef[]>([]),[taskId,setTaskId]=useState(''),[consent,setConsent]=useState(false),[busy,setBusy]=useState(false);
 const task=runtime?.snapshot?.objects.task.find(t=>t.id===taskId),run=runtime?.snapshot?.objects.run.find(r=>r.id===task?.data.run_id),receipts=(run?.data.receipts||[]) as {output?:unknown}[],output=receipts.find(r=>typeof r.output==='string')?.output;
 return <><button type="button" aria-label="语音输入" disabled={disabled} onClick={()=>setOpen(true)}>{waveform?<AudioLines size={24}/>:<Mic size={21}/>}</button>{open&&<RootPortal><button className="v278-sheet-backdrop" aria-label="关闭语音输入" onClick={()=>setOpen(false)}/><section className="v278-half-sheet" role="dialog" aria-modal="true" aria-label="语音输入" style={{overflowY:'auto',maxHeight:'80%',padding:20}}><button className="v277-secondary" onClick={()=>setOpen(false)}>关闭</button><h3>语音输入</h3>{runtime?<><AttachmentPicker value={files} onChange={setFiles} onBusy={setBusy}/><label><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/>同意将所选音频发给已配置的语音服务转写</label><Action disabled={busy||!consent||files.filter(f=>f.mime.startsWith('audio/')).length!==1} run={async()=>{const file=files.find(f=>f.mime.startsWith('audio/'))!;const result=await runtime.command('attachment.analyze',{id:file.id});setTaskId(result.id);const draft=await runtime.request<Entity>('/objects/'+result.id);await runtime.command('task.confirm',{...entityRef(draft),confirm:true,model_consent:true});const ready=await runtime.request<Entity>('/objects/'+result.id);await runtime.command('run.start',entityRef(ready))}}>确认转为文字</Action>{task&&<p>转写状态：{text(task,'status')}{task.data.status==='blocked'?'；配置 API Key 后可从任务列表恢复。':''}</p>}{typeof output==='string'&&<><p style={{whiteSpace:'pre-wrap'}}>{output}</p><button className="v277-secondary" onClick={()=>{onText(output);setOpen(false)}}>将文字填入输入框</button></>}</>:<p>请在本地运行版登录后使用录音转写。</p>}</section></RootPortal>}</>;
}
