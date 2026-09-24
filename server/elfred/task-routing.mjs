// A transparent initial routing suggestion. Ambiguous requests remain with the chosen
// entry point; this does not infer permission, read memory, or start other systems.
const labels={explore:'探索',advise:'参谋',create:'创作',connect:'连接',execute:'执行'};
const rules={
 explore:/调研|检索|查找|找(?:到)?(?:资料|信息|来源)|核实|核验事实|搜集|搜索|持续关注|跟踪变化|提供资料/,
 advise:/比较|评估|分析|判断|建议选择|选哪|做决策|辅助决策|权衡|风险审查/,
 create:/写(?:一|份|篇|个|成|出|文)|撰写|制作|创作|生成(?:图片|视频|文稿|代码)|形成.{0,8}(?:方案|文档|设计|报告)|整理成|开发|设计(?:网页|原型|海报)/,
 connect:/寻找(?:人|团队|合作者|设计师)|找(?:人|合作者|设计师)|匹配(?:人|资源)|组织协作|安排分工|维护关系/,
 execute:/发送(?:邮件|邀请|消息)|提交(?:申请|报名)|部署|发布网站|执行(?:计划|操作)|完成报名|下单|付款/,
};
export function routeSuggestion(goal){
 const clauses=String(goal).split(/然后|最后|最终|之后|后再|后(?=建议|形成|制作|写|选择)|并(?:且)?(?=提供|写|制作|形成|发送|提交)|[，,；;]/).map(s=>s.trim()).filter(Boolean);
 const steps=clauses.map(clause=>({clause,systems:Object.entries(rules).filter(([,rule])=>rule.test(clause)).map(([system])=>system)}));
 const final=steps.at(-1);if(!final||final.systems.length!==1)return null;
 const system=final.systems[0],collaborators=[...new Set(steps.slice(0,-1).flatMap(step=>step.systems))].filter(id=>id!==system);
 return {system,reason:`最终表达的成果是“${final.clause.slice(0,120)}”，建议由${labels[system]}负责。`,collaborators,method:'explicit-goal-rules',requires_confirmation:true};
}
