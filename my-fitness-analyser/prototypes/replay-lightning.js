const MAX_WAKE_PIXELS=106;

function visibleWake(points){
  const wake=[{...points.at(-1),distance:0}];
  for(let i=points.length-2;i>=0;i--){
    const a=wake.at(-1),b=points[i],length=Math.hypot(b.x-a.x,b.y-a.y);
    if(length<.2)continue;
    const distance=a.distance+length;
    const u=Math.min(1,(MAX_WAKE_PIXELS-a.distance)/length);
    wake.push({x:a.x+(b.x-a.x)*u,y:a.y+(b.y-a.y)*u,distance:Math.min(distance,MAX_WAKE_PIXELS)});
    if(u<1)break;
  }
  return wake;
}

function drawWake(ctx,wake,seconds,energy){
  if(wake.length<2)return;
  const head=wake[0],tail=wake.at(-1);
  const glow=ctx.createLinearGradient(tail.x,tail.y,head.x,head.y);
  glow.addColorStop(0,'#ff360400');
  glow.addColorStop(.56,'#ff463b');
  glow.addColorStop(1,'#ffb249');
  const core=ctx.createLinearGradient(tail.x,tail.y,head.x,head.y);
  core.addColorStop(0,'#ff623600');
  core.addColorStop(.6,'#ffcb63');
  core.addColorStop(1,'#fff6cc');
  ctx.lineCap='round';
  ctx.lineJoin='round';
  ctx.beginPath();
  ctx.moveTo(head.x,head.y);
  for(const p of wake.slice(1))ctx.lineTo(p.x,p.y);
  for(const [color,width,alpha] of [[glow,14,.3],[glow,7,.8],[core,2.6,1]]){
    ctx.strokeStyle=color;
    ctx.lineWidth=width;
    ctx.globalAlpha=alpha*energy;
    ctx.stroke();
  }

  // Branches travel back from the runner and fade out without a hard flash.
  for(let i=0;i<3;i++){
    const cycle=(seconds*2+i/3)%1, distance=7+cycle*65;
    const next=wake.findIndex(p=>p.distance>=distance);
    if(next<1)continue;
    const a=wake[next-1],b=wake[next];
    const length=b.distance-a.distance,u=(distance-a.distance)/length;
    const dx=(b.x-a.x)/length,dy=(b.y-a.y)/length;
    const x=a.x+(b.x-a.x)*u,y=a.y+(b.y-a.y)*u;
    const side=i%2?1:-1, spread=side*(6+cycle*10);
    ctx.beginPath();
    ctx.moveTo(x,y);
    ctx.lineTo(x+dx*4-dy*spread*.65,y+dy*4+dx*spread*.65);
    ctx.lineTo(x+dx*8-dy*spread*.45,y+dy*8+dx*spread*.45);
    ctx.lineTo(x+dx*14-dy*spread,y+dy*14+dx*spread);
    ctx.globalAlpha=Math.sin(Math.PI*cycle)*energy*.85;
    ctx.lineWidth=1.45;
    ctx.strokeStyle=i===1?'#ff7955':'#ffe3a0';
    ctx.stroke();
  }
}

function routeOverview(route){
  const [[west,south],[east,north]]=route.bounds;
  const aspect=Math.cos((north+south)*Math.PI/360);
  const width=108,height=84;
  const scale=Math.min((width-20)/Math.max((east-west)*aspect,1e-8),(height-20)/Math.max(north-south,1e-8));
  const project=([lon,lat])=>[width/2+(lon-(west+east)/2)*aspect*scale,height/2-(lat-(south+north)/2)*scale];
  const line=new Path2D();
  for(const segment of route.segments){
    segment.forEach((point,index)=>{
      const [x,y]=project(point.coordinate);
      if(index===0)line.moveTo(x,y);
      else line.lineTo(x,y);
    });
  }
  return (ctx,stageWidth,stageHeight,bottom,opacity,coordinate)=>{
    if(stageHeight<height+bottom+38)return;
    ctx.save();
    ctx.translate(stageWidth-width-14,stageHeight-height-bottom);
    ctx.globalAlpha=opacity;
    ctx.beginPath();
    ctx.roundRect(.5,.5,width-1,height-1,9);
    ctx.fillStyle='#0b1520e8';
    ctx.fill();
    ctx.strokeStyle='#ffffff4d';
    ctx.lineWidth=1;
    ctx.stroke();
    ctx.strokeStyle='#ffad7e';
    ctx.lineWidth=2;
    ctx.lineJoin='round';
    ctx.lineCap='round';
    ctx.stroke(line);
    if(coordinate){
      const [x,y]=project(coordinate);
      ctx.beginPath();
      ctx.arc(x,y,3,0,2*Math.PI);
      ctx.fillStyle='#fff8da';
      ctx.fill();
    }
    ctx.restore();
  };
}

export function replayLightning(canvas,route){
  const ctx=canvas.getContext('2d');
  const drawOverview=routeOverview(route);
  return function paint(map,{points=[],coordinate,seconds=0,energy=0,overview=0}={},insetBottom=14){
    if(!ctx)return;
    const width=canvas.clientWidth,height=canvas.clientHeight;
    const scale=Math.min(window.devicePixelRatio||1,1.5);
    const pixelsWide=Math.round(width*scale),pixelsHigh=Math.round(height*scale);
    if(canvas.width!==pixelsWide||canvas.height!==pixelsHigh){
      canvas.width=pixelsWide;
      canvas.height=pixelsHigh;
    }
    ctx.setTransform(scale,0,0,scale,0,0);
    ctx.clearRect(0,0,width,height);
    if(overview>0)drawOverview(ctx,width,height,insetBottom,overview,coordinate);
    if(!coordinate)return;

    const head=map.project(coordinate);
    if(!Number.isFinite(head.x)||!Number.isFinite(head.y))return;
    const warmth=energy*(.5+.5*Math.sin(seconds*2.2));
    const rim=`hsl(${19+24*warmth} 100% 64%)`;
    if(energy>0){
      const projected=points.map(p=>map.project(p));
      if(projected.length>1&&projected.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y))){
        drawWake(ctx,visibleWake(projected),seconds,energy);
      }
      const halo=ctx.createRadialGradient(head.x,head.y,2,head.x,head.y,16);
      halo.addColorStop(0,'#fff0ac');
      halo.addColorStop(.45,`hsl(${8+24*warmth} 100% 60% / .64)`);
      halo.addColorStop(1,'#ff442000');
      ctx.fillStyle=halo;
      ctx.globalAlpha=energy;
      ctx.fillRect(head.x-16,head.y-16,32,32);
    }
    ctx.globalAlpha=1;
    for(const [radius,color] of [[6,'#2d1c1b'],[4.5,rim],[2.8,'#fff8da']]){
      ctx.beginPath();
      ctx.arc(head.x,head.y,radius,0,2*Math.PI);
      ctx.fillStyle=color;
      ctx.fill();
    }
  };
}
