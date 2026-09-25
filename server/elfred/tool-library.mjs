import {fail,now} from './store.mjs';
import {string,enumeration,DEFAULT_STOP} from './policy.mjs';
import {validateWebArtifact} from './preview.mjs';
import {taskCommand} from './runtime.mjs';
import {parameterSchema,parameterValues,toolWorkflow} from './tool-parameters.mjs';
import {contextCommand} from './context-request.mjs';
export function toolLibraryCommand(store,user,action,input){
  if(action==='tool.governance'){
    const tool=store.expect(store.owned(user,input.id,'skill'),input.version);
    if(input.confirm!==true)fail('CONFIRMATION_REQUIRED','请核对工具使用证据与闲置规则');
    const ranks=['unrated','frequent','proficient'],mastery=enumeration(input.mastery||tool.data.mastery||'unrated',ranks,'熟练状态');
    if(ranks.indexOf(mastery)<ranks.indexOf(tool.data.mastery||'unrated'))fail('MASTERY_PRESERVED','常用与熟练证据不会因闲置或一次失败扣除');
    const accepted=store.list('task').filter(t=>t.owner===user&&t.data.skill_id===tool.id&&!t.data.test_run&&t.data.status==='completed');
    if(mastery==='frequent'&&Number(tool.data.uses||0)<2||mastery==='proficient'&&tool.data.mastery!=='proficient'&&!accepted.length)fail('EVIDENCE_REQUIRED','常用需重复实际使用，熟练需至少一项本人验收的成果');
    const idle=input.idle_days??null;if(idle!==null&&(!Number.isInteger(idle)||idle<1||idle>3650))fail('INVALID_INPUT','闲置提醒需为 1—3650 天，留空表示关闭');
    return {id:store.update(tool,{...tool.data,mastery,idle_days:idle,mastery_evidence:{uses:tool.data.uses||0,accepted_task_ids:accepted.map(t=>t.id),confirmed_at:now()}},user).id};
  }
  if(action==='tool.save'){
    const previous=input.id?store.expect(store.owned(user,input.id,'skill'),input.version):null;
    const data={title:string(input.title,'名称',100),instructions:string(input.instructions,'使用说明',12000),kind:enumeration(input.kind||'Skill',['Skill','Mini App','Agent'],'工具类型'),system:enumeration(input.system||'execute',['explore','advise','create','connect','execute'],'负责系统'),html:typeof input.html==='string'?input.html.slice(0,200000):'',status:'draft'};
    if(data.kind==='Mini App'&&!data.html.trim())fail('INVALID_INPUT','Mini App 需要 HTML/CSS/JavaScript 页面');
    if(data.kind==='Mini App')data.build=validateWebArtifact(data.html);
    data.parameters=parameterSchema(input.parameters??previous?.data.parameters??[]);
    data.workflow=toolWorkflow(input.workflow??previous?.data.workflow??[],data.system);
    if(data.kind==='Mini App'&&data.workflow.length)fail('INVALID_WORKFLOW','网页工具在自身页面中运行，不启动前置模型步骤');
    if(data.kind==='Mini App'&&data.parameters.length)fail('INVALID_PARAMETERS','Mini App 的输入请在页面内定义');
    const tool=previous?store.update(previous,{...previous.data,...data},user):store.add('skill',user,{...data,uses:0});
    const version=store.add('skill_version',user,{tool_id:tool.id,...data,revision:(previous?.data.revision||0)+1});
    const saved=store.update(tool,{...tool.data,version_id:version.id,revision:version.data.revision},user);
    return {id:saved.id,version:saved.version};
  }
  if(action==='tool.activate'||action==='tool.archive'){
    const tool=store.expect(store.owned(user,input.id,'skill'),input.version);
    if(action==='tool.activate'&&!tool.data.version_id)fail('VERSION_REQUIRED','请先编辑并保存一个工具版本');
    return {id:store.update(tool,{...tool.data,status:action==='tool.activate'?'active':'archived'},user).id};
  }
  if(action==='tool.use'||action==='tool.test'){
    const tool=store.owned(user,input.id,'skill');
    if(action==='tool.use'&&tool.data.status!=='active')fail('TOOL_DISABLED','请先启用工具');
    const version=store.owned(user,tool.data.version_id,'skill_version');
    if(input.version_id!==version.id)fail('VERSION_CONFLICT','工具版本已变化，请核对新输入后再使用');
    const parameters=parameterValues(version.data.parameters||[],input.parameters||{});
    let task;
    if(version.data.kind!=='Mini App'){
      const goal=string(input.goal||('按已选工具完成本次工作：'+version.data.title),'本次目标',8000);
      task=taskCommand(store,user,'task.create',{goal,mode:'compose',system:version.data.system,stop:{...DEFAULT_STOP,maxUnits:Math.max(DEFAULT_STOP.maxUnits,((version.data.workflow?.length||0)+2)*1000)},source_refs:[{id:version.id,version:version.version}]});
      const created=store.get(task.id);store.update(created,{...created.data,skill_id:tool.id,skill_version_id:version.id,parameter_values:parameters,test_run:action==='tool.test'},user);
      if(version.data.workflow?.length){contextCommand(store,user,'task.collaboration',{id:task.id,version:store.get(task.id).version,confirm:true,steps:version.data.workflow.map(step=>({...step,source_refs:[{id:version.id,version:version.version}]}))});const configured=store.get(task.id);store.update(configured,{...configured.data,collaboration_steps:configured.data.collaboration_steps.map(step=>({...step,parameter_values:parameters}))},user);}
    }
    store.add('tool_use',user,{tool_id:tool.id,version_id:version.id,task_id:task?.id||null,kind:action==='tool.test'?'test':'use'});
    if(version.data.kind==='Mini App'&&action==='tool.use')store.update(tool,{...tool.data,uses:(tool.data.uses||0)+1,last_used_at:now()},user);
    return {id:tool.id,task_id:task?.id,version_id:version.id};
  }
  return null;
}
