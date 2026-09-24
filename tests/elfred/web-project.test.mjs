import test from 'node:test';
import assert from 'node:assert/strict';
import {renderWebArtifact,validateWebArtifact,PREVIEW_CSP} from '../../server/elfred/preview.mjs';
test('C26 项目内多个脚本与样式打包进隔离预览，嵌套样式保留顺序',()=>{
 const files={'index.html':'<main id="count">0</main><link rel="stylesheet" href="css/main.css"><script src="js/app.js"></script>','css/main.css':'@import "base.css";main{color:red}','css/base.css':'body{margin:0}','js/app.js':'document.getElementById("count").textContent="1";'};
 const html=renderWebArtifact(files['index.html'],files);assert.match(html,/<style>body\{margin:0\}main\{color:red\}<\/style>/);assert.match(html,/textContent="1"/);assert.doesNotMatch(html,/src="js/);assert.equal(validateWebArtifact(files['index.html'],files).status,'passed');assert.match(PREVIEW_CSP,/connect-src 'none'/);
});
test('C26 缺文件、路径逃逸、外部依赖、脚本语法和样式循环均拒绝，不执行用户代码',()=>{
 for(const src of ['../secret.js','/absolute.js','https://example.com/x.js','missing.js'])assert.throws(()=>renderWebArtifact(`<main>test</main><script src="${src}"></script>`,{}));
 assert.throws(()=>validateWebArtifact('<main>test</main><script src="x.js"></script>',{'x.js':'let =;'}),{code:'BUILD_FAILED'});
 assert.throws(()=>renderWebArtifact('<main>x</main><link rel="stylesheet" href="a.css">',{'a.css':'@import "b.css";','b.css':'@import "a.css";'}),{code:'DEPENDENCY_CYCLE'});
 assert.throws(()=>validateWebArtifact(null),{code:'INVALID_ARTIFACT'});
});
test('C26 重复嵌套导入在展开过程中受到累计大小限制',()=>{
 const files={'20.css':'body{color:red}'};for(let i=19;i>=0;i--)files[i+'.css']=`@import "${i+1}.css";`.repeat(3);
 assert.throws(()=>renderWebArtifact('<main>x</main><link rel="stylesheet" href="0.css">',files),{code:'INVALID_ARTIFACT'});
});
test('C26 顶层重复文件引用也在每次替换时限制体积',()=>{
 for(const tag of ['<link rel="stylesheet" href="a.css">','<script src="a.js"></script>'])assert.throws(()=>renderWebArtifact('<main>x</main>'+tag.repeat(100),{'a.css':'/*'+'a'.repeat(120000)+'*/','a.js':'/*'+'a'.repeat(120000)+'*/'}),{code:'INVALID_ARTIFACT'});
});
