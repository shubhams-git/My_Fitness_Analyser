import test from 'node:test';
import assert from 'node:assert/strict';
import { curvePath,chartMarkup } from '../prototypes/journal-chart.js';

test('journal curves preserve observations, extrema and missing-data boundaries',()=>{
 const p=[80,82,79,79,81].map((kg,i)=>({kg,mean7:i<2?null:80,date:`2026-10-0${i+1}`})),x=p=>Date.parse(p.date)/86400000,y=v=>v;
 const path=curvePath(p,'kg',x,y),segments=[...path.matchAll(/C([\d.-]+),([\d.-]+) ([\d.-]+),([\d.-]+) ([\d.-]+),([\d.-]+)/g)];
 assert.equal(segments.length,4);
 segments.forEach((s,i)=>{const a=p[i].kg,b=p[i+1].kg;assert.equal(Number(s[6]),b);for(const k of [2,4])assert.ok(Number(s[k])>=Math.min(a,b)&&Number(s[k])<=Math.max(a,b));});
 const gap=[...p,{kg:77,mean7:null,date:'2026-10-20'}];
 assert.equal((curvePath(gap,'kg',x,y).match(/M/g)||[]).length,2);
 assert.equal((curvePath(gap,'mean7',x,y).match(/C/g)||[]).length,2);
 assert.equal(curvePath([],'kg',x,y),'');assert.match(curvePath([p[0]],'kg',x,y),/^M[^C]+$/);
});

test('journal inspection needs no range control and labels an interpolated/held calendar extent',()=>{
 const data={anchor:'2026-11-08',points:[{date:'2026-10-01',kg:80,mean7:null,readings:1},{date:'2026-10-03',kg:81,mean7:null,readings:1}]};
 const {markup,geometry}=chartMarkup({data,selection:1,kg:String,day:String,width:500});
 assert.doesNotMatch(markup,/type="range"|reading-cursor/);assert.match(markup,/Previous day/);assert.match(markup,/Next day/);assert.match(markup,/tabindex="0"/);assert.match(markup,/8 Nov/);assert.match(markup,/jr-held-line/);
 assert.equal(geometry.x(data.points[0]),58);assert.equal(geometry.x(data.points[1])<478,true);
});
