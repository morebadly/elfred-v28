import test from 'node:test';
import assert from 'node:assert/strict';
import {importantBriefEvent} from '../../app/v28/core/brief-event.mjs';
test('重要事件优先呈现需要本人处理的简报，不拿未排期草稿或昨天事件顶替',()=>{
 const task=(id,status,date='2026-09-23')=>({id,updated:date+'T03:00:00Z',data:{title:id,status,focus_date:date}}),tz='Asia/Shanghai',day='2026-09-23';
 assert.equal(importantBriefEvent([task('阻塞','blocked'),task('成果','completed')],tz,day).index,1);assert.equal(importantBriefEvent([task('成果','completed')],tz,day).index,2);assert.equal(importantBriefEvent([task('草稿','draft'),task('昨天','failed','2026-09-22')],tz,day),null);const notImportant=task('未定重点','failed');notImportant.data.focus_date=null;assert.equal(importantBriefEvent([notImportant],tz,day),null);
});
