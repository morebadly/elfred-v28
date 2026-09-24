import {readFileSync,writeFileSync} from 'node:fs';
let f='app/v28/core/runtime-panels.tsx',s=readFileSync(f,'utf8');
s=s.replace("<b>{text(item,'intro')}</b>","<b>{text(item,'other_name')} · @{text(item,'other_handle')}</b><p>{text(item,'intro')}</p>");
s=s.replace("{relation?<>","{kind==='notifications'&&<InboxPanel go={go}/>}\n    {relation?<>");
writeFileSync(f,s);
f='app/v28/legacy/legacy-ui.tsx';s=readFileSync(f,'utf8');
s=s.replace('PrivateAssist,AssetEditor,MethodsPanel}', 'PrivateAssist,AssetEditor,MethodsPanel,ConversationMembers}');
s=s.replace('<PrivateAssist conversation={conversation}', '<ConversationMembers conversation={conversation} onLeave={onBack}/><PrivateAssist conversation={conversation}');
writeFileSync(f,s);
