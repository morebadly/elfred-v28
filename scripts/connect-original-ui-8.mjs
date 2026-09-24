import fs from 'node:fs';
let p='app/v28/core/runtime-context.tsx',s=fs.readFileSync(p,'utf8');
s=s.replace('  const completed=onboarding?',`  const preferences=settings.data.agents as Record<string,{name:string;focus:string;enabled:boolean}>|undefined;
  const agentSetup=Object.fromEntries(Object.entries(empty.agentSetup).map(([id,config])=>{const saved=preferences?.[id==='advisor'?'advise':id];return [id,saved?{name:saved.name||config.name,focus:saved.focus,enabled:saved.enabled}:config]})) as V277State['agentSetup'];
  const completed=onboarding?`);
s=s.replace("return {...empty,phase:completed?","return {...empty,agentSetup,phase:completed?");fs.writeFileSync(p,s);
p='app/v28/legacy/legacy-ui.tsx';let source=fs.readFileSync(p,'utf8');
const section=(name,fn)=>{const start=source.indexOf('export function '+name+'(');let end=source.indexOf('\nexport ',start+1);if(start<0)throw Error(name);if(end<0)end=source.length;source=source.slice(0,start)+fn(source.slice(start,end))+source.slice(end)};
section('ProfileInitPage',s=>{
 s=s.replace('  const [name, setName]', '  const runtime=useRuntime();\n  const [name, setName]');
 s=s.replace('            if (file) setAvatar(URL.createObjectURL(file));',`            if(file&&runtime){if(file.size>250000){runtime.report('头像需小于 250 KB');return;}const reader=new FileReader();reader.onload=()=>setAvatar(String(reader.result));reader.readAsDataURL(file);}else if (file) setAvatar(URL.createObjectURL(file));`);
 s=s.replace('          onClick={() =>\n            setState((current) => ({',`          onClick={() => {if(runtime?.snapshot){void runtime.command('profile.save',{...entityRef(runtime.snapshot.objects.profile[0]),...state.profile,name:name.trim(),role:role.trim(),...(avatar?{avatar}:{})}).then(()=>runtime.command('onboarding.save',{...entityRef(runtime.snapshot!.objects.onboarding[0]),intent:focus.trim()})).then(()=>setState(current=>({...current,phase:'agents-init'}))).catch(()=>{});return;}
            setState((current) => ({`);
 s=s.replace('              phase: "agents-init",\n            }))\n          }','              phase: "agents-init",\n            }));}\n          }');return s;
});
section('TasksPage',s=>{
 s=s.replace('<b>3</b>','<b>{runtime?runtime.snapshot?.objects.project.length||0:3}</b>').replace('<b>8</b>','<b>{runtime?state.tasks.length:8}</b>').replace('<b>56%</b>','<b>{runtime?"待逐项验收":"56%"}</b>');
 s=s.replace('{projects.map((item) => (',`{(runtime?runtime.snapshot?.objects.project.map(item=>({title:entityText(item,'title'),copy:entityText(item,'goal'),taskId:item.id,progress:item.data.release_id?100:0,comments:runtime.snapshot.objects.feedback.filter(feedback=>feedback.space===item.id).length,links:runtime.snapshot.objects.release.filter(release=>release.data.project_id===item.id).length}))||[]:projects).map((item) => (`);
 s=s.replace('onClick={() => openTask(item.taskId)}','onClick={() => runtime?go({name:"community-post",id:item.taskId}):openTask(item.taskId)}');
 s=s.replace('                  受阻','                  {runtime?"项目":"受阻"}').replace('<strong>+4</strong>','{!runtime&&<strong>+4</strong>}');
 return s;
});
fs.writeFileSync(p,source);
