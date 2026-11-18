export function countedProvider(generate,{count=600,limit=1048576}={}){
 return async (url,options)=>{
  if(url.endsWith(':generateContent'))return generate(url,options);
  if(url.endsWith(':countTokens'))return Response.json({totalTokens:count});
  return Response.json({name:'models/'+url.split('/').at(-1),inputTokenLimit:limit,
   supportedGenerationMethods:['generateContent','countTokens']});
 };
}

export function geminiOutput(value){
 return Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(value)}]}}]});
}
