export function appendGoalEvidence(progress,prefix,anchor,add){
 if(!progress?.goal)return null;const g=progress.goal;
 const meta={kind:g.kind,status:progress.status,revision:g.revision,startsInDays:Math.round((Date.parse(g.effectiveFrom)-Date.parse(anchor))/86400000),hasDeadline:Boolean(g.deadline)};
 add(prefix+'.revision','Goal settings revision',g.revision,'count');
 if(g.target!==null){const unit=g.kind==='weight'?'kg':g.kind==='run-time'?'s':'m';add(prefix+'.target','Your explicit target',g.target,unit);add(prefix+'.current','Measured progress toward your target',g.kind==='weight'?progress.current:progress.done,unit);add(prefix+'.remaining','Remaining to your target',progress.remaining,unit);if(g.kind!=='run-time')add(prefix+'.percent','Progress to your target',progress.percent,'%');}
 add(prefix+'.startsInDays','Days until goal starts',meta.startsInDays,'days');add(prefix+'.daysLeft','Days to target date or week end',progress.daysLeft,'days');
 if(g.distanceM)add(prefix+'.distance','Goal benchmark distance',g.distanceM,'m');
 if(g.kind==='weight'){add(prefix+'.baseline','Starting recorded trend',progress.baseline,'kg');if(progress.measuredDate)add(prefix+'.readingAge','Days since latest trend observation',Math.round((Date.parse(anchor)-Date.parse(progress.measuredDate))/86400000),'days');meta.direction=progress.direction||null;}
 return meta;
}
