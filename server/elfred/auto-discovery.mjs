import {observationCommand} from './observation.mjs';

export function discoveryGoal(summary){
  const selected=summary.filter(item=>item.certainty==='selected'&&['need','direction','criteria','format','cooperation','pace'].includes(item.question_id));
  if(!selected.length)return null;
  return `根据本人初始化选择，持续寻找对当前方向有实际帮助的近期公开资料：${selected.map(item=>`${item.question} ${item.label}`).join('；')}。优先原始来源，说明与本人选择的关联；资料不足则标明未知，不编造机会或成果。`;
}

export function discoveryQuery(summary){
  const option=id=>summary.find(item=>item.question_id===id&&item.certainty==='selected')?.option;
  const direction={interest:'科技 产品',ability:'职业 技能',problem:'产品 用户问题',opportunity:'创业 市场机会'}[option('direction')]||'产品 创新';
  const format={concept:'创意',prototype:'原型',content:'内容创作',product:'产品开发'}[option('format')]||'项目实践';
  return `${direction} ${format}`;
}

function feedUrl(summary){
  const url=new URL('https://news.google.com/rss/search');
  url.searchParams.set('q',discoveryQuery(summary));url.searchParams.set('hl','zh-CN');url.searchParams.set('gl','CN');url.searchParams.set('ceid','CN:zh-Hans');
  return url.href;
}

export function provisionInitialDiscovery(store,user,summary){
  const goal=discoveryGoal(summary);if(!goal)return null;
  const key=`${user}:onboarding-discovery`;
  const existing=store.db.prepare('SELECT object_id FROM unique_keys WHERE namespace=? AND key=?').get('observation',key);
  if(!existing&&store.visible(user,'observation').filter(item=>['draft','active','paused','blocked'].includes(item.data.status)).length>=20)return null;
  const watch=store.unique('observation',key,()=>{
    const created=observationCommand(store,user,'observation.create',{goal,source_url:feedUrl(summary),keywords:discoveryQuery(summary),system:'explore',interval_hours:24,max_checks:7,expires:new Date(Date.now()+14*86400000).toISOString()});
    return store.get(created.id);
  });
  if(watch.data.status==='draft'&&(watch.data.goal!==goal||watch.data.source_url!==feedUrl(summary)))return store.update(watch,{...watch.data,goal,title:goal.slice(0,80),source_url:feedUrl(summary),keywords:[discoveryQuery(summary)],auto_suggested:true},user);
  if(!watch.data.auto_suggested)return store.update(watch,{...watch.data,auto_suggested:true},user);
  return watch;
}
