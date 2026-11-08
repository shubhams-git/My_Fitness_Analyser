export function calendarDay(timezone='Australia/Sydney',instant=new Date()){
 try{const parts=new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(instant);return ['year','month','day'].map(k=>parts.find(p=>p.type===k).value).join('-');}
 catch{return calendarDay('Australia/Sydney',instant);}
}
