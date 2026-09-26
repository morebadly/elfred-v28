const roles=[['explore','探索'],['advise','参谋'],['create','创作'],['connect','连接'],['execute','执行']];
const goals=['产品原型','内容创作','学习计划','小型项目','用户需求','研究比较','团队分工','日程协调','资料整理','成果验收'];
const outcomes={explore:'整理三个待核对的公开线索',advise:'比较价值、风险和可行性',create:'给出第一版方案与修改点',connect:'整理协作者需求，未联系任何人',execute:'拆解下一步并列出验收标准'};

// Synthetic actors are an isolated load-test harness, never real accounts or model results.
export function simulateFixtureAgents(count=1000){
 if(!Number.isInteger(count)||count<1||count>10000)throw new Error('Fixture count must be 1–10000');
 return Array.from({length:count},(_,index)=>{
  const [system,name]=roles[index%roles.length],number=String(index+1).padStart(4,'0');
  const actor={id:`fixture-agent-${number}`,system,name:`【测试 Agent】${name} ${number}`,goal:goals[Math.floor(index/roles.length)%goals.length],synthetic:true};
  return {actor,post:{title:`【测试数据】${actor.goal} · ${name} ${number}`,summary:`隔离模拟 Agent ${number}：${outcomes[system]}。场景：${actor.goal}。这是确定性测试内容，未调用模型，不代表真实发现或成果。`,system,topic:`测试话题 ${index%10}`,status:'active',purpose:'fixture',synthetic:true,fixture_agent_id:actor.id,event_key:`fixture:${number}`,source_refs:[],reason:'隔离测试 Agent 根据各自职责生成的测试内容',personal_value:'界面、筛选、搜索与性能验收',uncertainty:'无真实来源；不能用于产品决策',comments:[],attachments:[]}};
 });
}
