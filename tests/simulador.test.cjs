// Run with node tests/simulador.test.cjs. No external packages required.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const html = fs.readFileSync(require('node:path').join(__dirname, '../simulador_de_termodin_mica_expansi_n_isob_rica.html'), 'utf8');
const code = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m => m[1]).join('\n');
new vm.Script(code); // Full script syntax, including the 3D implementation.
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
assert.equal(new Set(ids).size, ids.length, 'Unique DOM IDs');
for (const [,id] of code.matchAll(/\$\('([^']+)'\)/g)) assert.ok(ids.includes(id), `Element ${id} exists`);
const elements = Object.fromEntries(ids.map(id => [id, { value:'', hidden:false, textContent:'', style:{}, setAttribute(){}, getBoundingClientRect(){return {width:0,height:230};} }]));
Object.assign(elements.mode,{value:'exercise'});
const defaults={pressure:200000,v1:.010,v2:.014,heat:1500,gas:3,moles:1,temp:300,duration:10};
for(const [id,value] of Object.entries(defaults))elements[id].value=String(value);
const sandbox={document:{getElementById:id=>elements[id]}, window:{addEventListener(){}}, console, devicePixelRatio:1};
vm.createContext(sandbox);vm.runInContext(code,sandbox);
const run=code=>vm.runInContext(code,sandbox);
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7, `${a} ≈ ${b}`);
run('refresh(false)');near(run('model.w'),800);near(run('model.u'),700);
run('progress=.5; update()');assert.equal(elements.percent.textContent,'50 %');assert.ok(elements.wNow.textContent.includes('400'));assert.ok(elements.uNow.textContent.includes('350'));
run("preset('compress')");assert.ok(run('model.w<0'));near(run('model.w'),-2000);near(run('model.u'),-1000);
run("preset('heat')");assert.ok(run('model.v2>model.v1'));near(run('model.q'),run('model.w+model.u'));near(run('model.u'),run('model.n*model.cv*(model.t2-model.t1)'));
const oldVolume=run('model.v2');elements.pressure.value='400000';run('refresh(false)');near(run('model.v2'),oldVolume/2);
run("preset('cool')");assert.ok(run('model.v2<model.v1'));assert.ok(run('model.t2<model.t1'));
for(const n of [.1,1,5])for(const f of [3,5])for(const t of [150,300,700])for(const q of [-5000,0,5000]){
 elements.moles.value=String(n);elements.gas.value=String(f);elements.temp.value=String(t);elements.heat.value=String(q);run('refresh(false)');
 assert.ok(run('model.t2>=10-1e-9'));assert.ok(run('model.v1>0&&model.v2>0'));near(run('model.q'),run('model.w+model.u'));near(run('model.u'),run('model.n*model.cv*(model.t2-model.t1)'));
}
run("preset('original')");elements.v2.value=elements.v1.value;run('refresh(false)');near(run('model.w'),0);near(run('model.u'),1500);
elements.moles.value='not-a-number';run('refresh(false)');assert.ok(run('Number.isFinite(model.n)'));
console.log('OK: JavaScript syntax, DOM references, original exercise, partial energies, compression, zero work, ideal-gas conservation, pressure response and 54 cooling/heating combinations.');
// Check the actual animation function: preview, intensity and shutoff.
run(`
 const vector=()=>({set(...v){this.values=v;}});
 gasDots={geometry:{attributes:{position:{array:[],needsUpdate:false}}}};
 flameGroup={visible:false};coolGroup={visible:false,rotation:{}};heatLight={intensity:0};
 flameOuter={scale:vector(),position:{},rotation:{}};flameCore={scale:vector(),position:vector()};
 model=calculate({mode:'exercise',p:200000,v1:.010,v2:.014,q:1500,n:1,f:3,t1:300,duration:10});
 progress=0;playing=false;animateGas(0,1);
`);
assert.equal(run('flameGroup.visible'),true,'Positive heat shows flame preview while paused');
const lowHeight=run('flameOuter.scale.values[1]');
run('model.q=5000;model.power=500;animateGas(0,1)');
assert.ok(run('flameOuter.scale.values[1]')>lowHeight,'More heat makes the flame taller');
run('model.q=-1000;model.power=-100;animateGas(0,1)');
assert.equal(run('flameGroup.visible'),false);assert.equal(run('coolGroup.visible'),true);
run('model.q=0;model.power=0;animateGas(0,1)');assert.equal(run('flameGroup.visible||coolGroup.visible'),false);
run('model.q=1500;model.power=150;progress=1;animateGas(0,1)');assert.equal(run('flameGroup.visible'),false);
console.log('OK: flame preview in pause, increasing flame height, cooling, zero heat and completed-process shutoff.');
