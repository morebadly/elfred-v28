/** @template T @param {Array<T & {task_id:string,status:string}>} facts */
export function selectedBriefFacts(facts, selected, selectionVersion, currentVersion) {
  if(selectionVersion!==currentVersion)return [];
  return facts.filter(fact=>selected.includes(fact.task_id)&&!['completed','archived','cancelled'].includes(fact.status));
}
