export function calendarICS({id,title,content='',start,end,created=new Date().toISOString()}){
 const from=new Date(start),to=new Date(end);
 if(!Number.isFinite(from.getTime())||!Number.isFinite(to.getTime())||to<=from)throw new Error('日程时间不正确');
 const escape=v=>String(v).replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');
 const stamp=d=>new Date(d).toISOString().replace(/[-:]/g,'').replace(/\.\d+Z$/,'Z');
 const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Elfred//Calendar Draft//ZH','BEGIN:VEVENT',`UID:${String(id).replace(/[^a-zA-Z0-9-]/g,'')}@elfred.local`,`DTSTAMP:${stamp(created)}`,`DTSTART:${stamp(from)}`,`DTEND:${stamp(to)}`,`SUMMARY:${escape(title)}`,`DESCRIPTION:${escape(content)}`,'END:VEVENT','END:VCALENDAR'];
 // Fold by UTF-8 octets; do not split multibyte characters or allow line injection.
 return lines.map(line=>{let output='',part='',size=0;for(const c of line){const bytes=new TextEncoder().encode(c).length;if(size+bytes>74){output+=part+'\r\n';part=' ';size=1;}part+=c;size+=bytes;}return output+part;}).join('\r\n')+'\r\n';
}
