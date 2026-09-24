/** Shared calendar rules for the homepage and its server-side brief snapshots. */
/** @param {Date|string|number} value */
export function localDay(value = new Date(), timezone = 'Asia/Shanghai') {
  return new Intl.DateTimeFormat('en-CA', {timeZone: timezone, year:'numeric', month:'2-digit', day:'2-digit'}).format(new Date(value));
}

/** @param {Record<string,string>} preferences */
export function briefIndex(preferences, timezone = 'Asia/Shanghai', value = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {timeZone:timezone, hour:'2-digit', minute:'2-digit', hourCycle:'h23'}).formatToParts(value);
  const current = Number(parts.find(part=>part.type==='hour').value)*60 + Number(parts.find(part=>part.type==='minute').value);
  const times = ['morning','noon','evening'].map((key,index)=>{
    const [hour,minute] = String(preferences[key] || ['08:00','12:30','20:30'][index]).split(':').map(Number);
    return hour*60+minute;
  });
  // Most recently started period, including a routine crossing midnight.
  return times.map((time,index)=>({index,elapsed:(current-time+1440)%1440})).sort((a,b)=>a.elapsed-b.elapsed)[0].index;
}

/** @template T @param {Array<T & {updated:string,data:Record<string,any>}>} tasks */
export function dailyTasks(tasks, timezone = 'Asia/Shanghai', day = localDay(new Date(),timezone)) {
  return tasks.filter(task=>{
    if (['archived','cancelled'].includes(task.data.status)) return false;
    if (task.data.status==='completed') return localDay(task.updated,timezone)===day;
    const scheduled = task.data.planned_date || (task.data.not_before ? localDay(new Date(task.data.not_before),timezone) : null);
    if(task.data.focus_date===day)return true;
    if(['running','queued','paused','awaiting_acceptance','awaiting_review'].includes(task.data.status))return !scheduled||scheduled<=day;
    const admission=task.data.today_admission;
    return Boolean(scheduled&&scheduled<=day&&admission?.important&&admission?.relevant&&admission?.actionable);
  });
}
