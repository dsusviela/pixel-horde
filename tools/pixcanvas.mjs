// A tiny software Canvas2D: enough of the API for the game's sprite and boss
// draw code (fillRect, arc/ellipse fill+stroke, drawImage with transforms,
// globalAlpha, globalCompositeOperation 'source-over' | 'lighter' | 'screen' | 'destination-out',
// nearest or bilinear drawImage per imageSmoothingEnabled — default false,
// matching the game's explicit settings) to rasterise into an RGBA buffer,
// plus a PNG writer (canvas.png()) and reader (readPng(buffer) -> PixCanvas).
import zlib from 'node:zlib';

function parseColor(c){
  if(!c)return [0,0,0,1];
  if(c[0]==='#'){
    if(c.length===4)return [parseInt(c[1]+c[1],16),parseInt(c[2]+c[2],16),parseInt(c[3]+c[3],16),1];
    return [parseInt(c.slice(1,3),16),parseInt(c.slice(3,5),16),parseInt(c.slice(5,7),16),c.length>=9?parseInt(c.slice(7,9),16)/255:1];
  }
  const m=c.match(/rgba?\(([^)]+)\)/);
  if(m){const p=m[1].split(',').map(s=>parseFloat(s));return [p[0],p[1],p[2],p.length>3?p[3]:1];}
  return [255,0,255,1];
}

export class PixCanvas{
  constructor(w=1,h=1){this._w=w;this._h=h;this.data=new Float32Array(w*h*4);this.style={};this._ctx=null;}
  get width(){return this._w;}set width(v){this._w=v;this.data=new Float32Array(this._w*this._h*4);}
  get height(){return this._h;}set height(v){this._h=v;this.data=new Float32Array(this._w*this._h*4);}
  getContext(){return this._ctx||(this._ctx=new PixCtx(this));}
  addEventListener(){}
  getBoundingClientRect(){return {left:0,top:0,width:this.width,height:this.height};}
  blend(x,y,r,g,b,a,op){
    if(x<0||y<0||x>=this.width||y>=this.height||a<=0)return;
    const i=(y*this.width+x)*4,d=this.data;
    if(op==='lighter'){d[i]=Math.min(255,d[i]+r*a);d[i+1]=Math.min(255,d[i+1]+g*a);d[i+2]=Math.min(255,d[i+2]+b*a);d[i+3]=Math.min(1,d[i+3]+a);return;}
    if(op==='destination-out'){d[i+3]=d[i+3]*(1-a);return;}
    if(op==='screen'){d[i]=255-(255-d[i])*(255-r*a)/255;d[i+1]=255-(255-d[i+1])*(255-g*a)/255;d[i+2]=255-(255-d[i+2])*(255-b*a)/255;d[i+3]=Math.min(1,d[i+3]+a);return;}
    const oa=d[i+3],na=a+oa*(1-a);
    if(na<=0)return;
    d[i]=(r*a+d[i]*oa*(1-a))/na;d[i+1]=(g*a+d[i+1]*oa*(1-a))/na;d[i+2]=(b*a+d[i+2]*oa*(1-a))/na;d[i+3]=na;
  }
  get(x,y){
    if(x<0||y<0||x>=this.width||y>=this.height)return null;
    const i=(y*this.width+x)*4;return [this.data[i],this.data[i+1],this.data[i+2],this.data[i+3]];
  }
  png(){
    const w=this.width,h=this.height,raw=Buffer.alloc((w*4+1)*h);
    for(let y=0;y<h;y++){
      raw[y*(w*4+1)]=0;
      for(let x=0;x<w;x++){
        const i=(y*w+x)*4,o=y*(w*4+1)+1+x*4;
        raw[o]=this.data[i]|0;raw[o+1]=this.data[i+1]|0;raw[o+2]=this.data[i+2]|0;raw[o+3]=Math.round(this.data[i+3]*255);
      }
    }
    const chunks=[];
    const chunk=(type,data)=>{
      const len=Buffer.alloc(4);len.writeUInt32BE(data.length);
      const td=Buffer.concat([Buffer.from(type),data]);
      const crc=Buffer.alloc(4);crc.writeUInt32BE(crc32(td)>>>0);
      chunks.push(len,td,crc);
    };
    const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(w,0);ihdr.writeUInt32BE(h,4);ihdr[8]=8;ihdr[9]=6;ihdr[10]=0;ihdr[11]=0;ihdr[12]=0;
    chunk('IHDR',ihdr);chunk('IDAT',zlib.deflateSync(raw));chunk('IEND',Buffer.alloc(0));
    return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),...chunks]);
  }
}
let CRC_T=null;
function crc32(buf){
  if(!CRC_T){CRC_T=new Int32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;CRC_T[n]=c;}}
  let c=-1;for(let i=0;i<buf.length;i++)c=CRC_T[(c^buf[i])&255]^(c>>>8);return c^-1;
}

// Decodes an 8-bit PNG (colour types 0/2/4/6, no interlace) into a PixCanvas.
export function readPng(buf){
  if(buf.readUInt32BE(0)!==0x89504e47)throw new Error('not a PNG');
  let p=8,w=0,h=0,ct=6,idat=[];
  while(p<buf.length){
    const len=buf.readUInt32BE(p),type=buf.toString('latin1',p+4,p+8),data=buf.subarray(p+8,p+8+len);
    if(type==='IHDR'){w=data.readUInt32BE(0);h=data.readUInt32BE(4);if(data[8]!==8)throw new Error('only 8-bit PNGs');ct=data[9];if(data[12])throw new Error('interlaced PNG unsupported');}
    else if(type==='IDAT')idat.push(data);
    else if(type==='IEND')break;
    p+=12+len;
  }
  const bpp={0:1,2:3,4:2,6:4}[ct],raw=zlib.inflateSync(Buffer.concat(idat)),stride=w*bpp,out=new PixCanvas(w,h),d=out.data;
  const prev=Buffer.alloc(stride),cur=Buffer.alloc(stride);
  for(let y=0;y<h;y++){
    const f=raw[y*(stride+1)],row=raw.subarray(y*(stride+1)+1,(y+1)*(stride+1));
    for(let i=0;i<stride;i++){
      const a=i>=bpp?cur[i-bpp]:0,b=prev[i],c=i>=bpp?prev[i-bpp]:0;let v=row[i];
      if(f===1)v+=a;else if(f===2)v+=b;else if(f===3)v+=(a+b)>>1;else if(f===4){const pp=a+b-c,pa=Math.abs(pp-a),pb=Math.abs(pp-b),pc=Math.abs(pp-c);v+=(pa<=pb&&pa<=pc)?a:(pb<=pc?b:c);}
      cur[i]=v&255;
    }
    for(let x=0;x<w;x++){
      const o=(y*w+x)*4,s=x*bpp;
      if(ct===6){d[o]=cur[s];d[o+1]=cur[s+1];d[o+2]=cur[s+2];d[o+3]=cur[s+3]/255;}
      else if(ct===2){d[o]=cur[s];d[o+1]=cur[s+1];d[o+2]=cur[s+2];d[o+3]=1;}
      else if(ct===4){d[o]=d[o+1]=d[o+2]=cur[s];d[o+3]=cur[s+1]/255;}
      else{d[o]=d[o+1]=d[o+2]=cur[s];d[o+3]=1;}
    }
    cur.copy(prev);
  }
  return out;
}

class PixCtx{
  constructor(cv){
    this.canvas=cv;this.m=[1,0,0,1,0,0];this.stack=[];
    this.fillStyle='#000';this.strokeStyle='#000';this.globalAlpha=1;this.lineWidth=1;this.imageSmoothingEnabled=false;
    this.font='';this.textAlign='left';this.textBaseline='alphabetic';this.globalCompositeOperation='source-over';this.shadowBlur=0;
    this.path=[];this.clipRect=null;
  }
  save(){this.stack.push({m:this.m.slice(),ga:this.globalAlpha,clip:this.clipRect});}
  restore(){const s=this.stack.pop();if(s){this.m=s.m;this.globalAlpha=s.ga;this.clipRect=s.clip;}}
  _mul(a,b){const [a0,a1,a2,a3,a4,a5]=a,[b0,b1,b2,b3,b4,b5]=b;return [a0*b0+a2*b1,a1*b0+a3*b1,a0*b2+a2*b3,a1*b2+a3*b3,a0*b4+a2*b5+a4,a1*b4+a3*b5+a5];}
  translate(x,y){this.m=this._mul(this.m,[1,0,0,1,x,y]);}
  rotate(a){const c=Math.cos(a),s=Math.sin(a);this.m=this._mul(this.m,[c,s,-s,c,0,0]);}
  scale(x,y){this.m=this._mul(this.m,[x,0,0,y,0,0]);}
  setTransform(a,b,c,d,e,f){this.m=[a,b,c,d,e,f];}
  resetTransform(){this.m=[1,0,0,1,0,0];}
  tf(x,y){const m=this.m;return [m[0]*x+m[2]*y+m[4],m[1]*x+m[3]*y+m[5]];}
  inv(){const [a,b,c,d,e,f]=this.m,det=a*d-b*c;return [d/det,-b/det,-c/det,a/det,(c*f-d*e)/det,(b*e-a*f)/det];}
  _fillPoly(pts,col,alphaMul){
    const [r,g,b,a]=parseColor(col),al=a*this.globalAlpha*(alphaMul||1);
    let minY=Infinity,maxY=-Infinity;for(const p of pts){minY=Math.min(minY,p[1]);maxY=Math.max(maxY,p[1]);}
    const y0=Math.max(0,Math.floor(minY)),y1=Math.min(this.canvas.height-1,Math.ceil(maxY));
    for(let y=y0;y<=y1;y++){
      const cy=y+0.5,xs=[];
      for(let i=0;i<pts.length;i++){
        const p=pts[i],q=pts[(i+1)%pts.length];
        if((p[1]<=cy&&q[1]>cy)||(q[1]<=cy&&p[1]>cy))xs.push(p[0]+(cy-p[1])*(q[0]-p[0])/(q[1]-p[1]));
      }
      xs.sort((u,v)=>u-v);
      for(let i=0;i+1<xs.length;i+=2){
        const xa=Math.max(0,Math.round(xs[i])),xb=Math.min(this.canvas.width-1,Math.round(xs[i+1])-1);
        for(let x=xa;x<=xb;x++)if(!this.clipRect||this._inClip(x,y))this.canvas.blend(x,y,r,g,b,al,this.globalCompositeOperation);
      }
    }
  }
  _inClip(x,y){const c=this.clipRect;return x>=c[0]&&y>=c[1]&&x<c[0]+c[2]&&y<c[1]+c[3];}
  fillRect(x,y,w,h){this._fillPoly([this.tf(x,y),this.tf(x+w,y),this.tf(x+w,y+h),this.tf(x,y+h)],this.fillStyle);}
  clearRect(x,y,w,h){const [x0,y0]=this.tf(x,y);for(let yy=Math.max(0,y0|0);yy<Math.min(this.canvas.height,y0+h);yy++)for(let xx=Math.max(0,x0|0);xx<Math.min(this.canvas.width,x0+w);xx++){const i=(yy*this.canvas.width+xx)*4;this.canvas.data[i]=this.canvas.data[i+1]=this.canvas.data[i+2]=this.canvas.data[i+3]=0;}}
  strokeRect(x,y,w,h){this.beginPath();this.rect(x,y,w,h);this.stroke();}
  beginPath(){this.path=[];}
  closePath(){}
  moveTo(x,y){this.path.push({kind:'line',pts:[[x,y]]});}
  lineTo(x,y){const last=this.path[this.path.length-1];if(last&&last.kind==='line')last.pts.push([x,y]);else this.path.push({kind:'line',pts:[[x,y]]});}
  arc(x,y,r,a0,a1){this.path.push({kind:'ell',x,y,rx:r,ry:r,a0,a1});}
  ellipse(x,y,rx,ry,rot,a0,a1){this.path.push({kind:'ell',x,y,rx,ry,a0:a0||0,a1:a1===undefined?Math.PI*2:a1});}
  rect(x,y,w,h){this.path.push({kind:'line',pts:[[x,y],[x+w,y],[x+w,y+h],[x,y+h]],closed:true});}
  quadraticCurveTo(cx,cy,x,y){this.lineTo(x,y);}
  bezierCurveTo(a,b,c,d,x,y){this.lineTo(x,y);}
  arcTo(x1,y1,x2,y2){this.lineTo(x2,y2);}
  clip(){for(const p of this.path)if(p.kind==='line'&&p.closed){const a=this.tf(p.pts[0][0],p.pts[0][1]),b=this.tf(p.pts[2][0],p.pts[2][1]);this.clipRect=[Math.min(a[0],b[0]),Math.min(a[1],b[1]),Math.abs(b[0]-a[0]),Math.abs(b[1]-a[1])];}}
  _ellPts(p){
    const n=Math.max(12,Math.round(Math.max(p.rx,p.ry)*2)),pts=[];
    const full=Math.abs((p.a1-p.a0))>=Math.PI*2-1e-6;
    for(let i=0;i<=n;i++){const a=p.a0+(p.a1-p.a0)*i/n;pts.push(this.tf(p.x+Math.cos(a)*p.rx,p.y+Math.sin(a)*p.ry));}
    if(!full)pts.push(this.tf(p.x,p.y));
    return pts;
  }
  fill(){for(const p of this.path){if(p.kind==='ell')this._fillPoly(this._ellPts(p),this.fillStyle);else if(p.pts.length>=3)this._fillPoly(p.pts.map(q=>this.tf(q[0],q[1])),this.fillStyle);}}
  stroke(){
    const lw=Math.max(1,this.lineWidth);
    for(const p of this.path){
      const pts=p.kind==='ell'?this._ellPts(p):p.pts.map(q=>this.tf(q[0],q[1]));
      const closed=p.kind==='ell'&&Math.abs(p.a1-p.a0)>=Math.PI*2-1e-6;
      for(let i=0;i+1<pts.length+(closed?1:0);i++){
        const a=pts[i],b=pts[(i+1)%pts.length];
        const dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy)||1,nx=-dy/len*lw/2,ny=dx/len*lw/2;
        this._fillPoly([[a[0]+nx,a[1]+ny],[b[0]+nx,b[1]+ny],[b[0]-nx,b[1]-ny],[a[0]-nx,a[1]-ny]],this.strokeStyle);
      }
    }
  }
  drawImage(img,...args){
    let sx=0,sy=0,sw=img.width,sh=img.height,dx,dy,dw,dh;
    if(args.length===2){[dx,dy]=args;dw=sw;dh=sh;}
    else if(args.length===4){[dx,dy,dw,dh]=args;}
    else{[sx,sy,sw,sh,dx,dy,dw,dh]=args;}
    const corners=[this.tf(dx,dy),this.tf(dx+dw,dy),this.tf(dx+dw,dy+dh),this.tf(dx,dy+dh)];
    let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
    for(const c of corners){x0=Math.min(x0,c[0]);y0=Math.min(y0,c[1]);x1=Math.max(x1,c[0]);y1=Math.max(y1,c[1]);}
    const inv=this.inv();
    for(let y=Math.max(0,Math.floor(y0));y<Math.min(this.canvas.height,Math.ceil(y1));y++)
      for(let x=Math.max(0,Math.floor(x0));x<Math.min(this.canvas.width,Math.ceil(x1));x++){
        const px=x+0.5,py=y+0.5;
        const ux=inv[0]*px+inv[2]*py+inv[4],uy=inv[1]*px+inv[3]*py+inv[5];
        const fx=(ux-dx)/dw,fy=(uy-dy)/dh;
        if(fx<0||fy<0||fx>=1||fy>=1)continue;
        if(this.clipRect&&!this._inClip(x,y))continue;
        let c;
        if(this.imageSmoothingEnabled&&img.get){
          const u=sx+fx*sw-0.5,v=sy+fy*sh-0.5,ix=Math.floor(u),iy=Math.floor(v),tu=u-ix,tv=v-iy;
          const P=(a,b)=>img.get(a,b)||[0,0,0,0];
          const p00=P(ix,iy),p10=P(ix+1,iy),p01=P(ix,iy+1),p11=P(ix+1,iy+1);
          const w00=(1-tu)*(1-tv),w10=tu*(1-tv),w01=(1-tu)*tv,w11=tu*tv;
          const a=p00[3]*w00+p10[3]*w10+p01[3]*w01+p11[3]*w11;if(a<=0)continue;
          c=[(p00[0]*p00[3]*w00+p10[0]*p10[3]*w10+p01[0]*p01[3]*w01+p11[0]*p11[3]*w11)/a,(p00[1]*p00[3]*w00+p10[1]*p10[3]*w10+p01[1]*p01[3]*w01+p11[1]*p11[3]*w11)/a,(p00[2]*p00[3]*w00+p10[2]*p10[3]*w10+p01[2]*p01[3]*w01+p11[2]*p11[3]*w11)/a,a];
        }else{
          const ix=Math.floor(sx+fx*sw),iy=Math.floor(sy+fy*sh);
          c=img.get?img.get(ix,iy):null;if(!c||c[3]<=0)continue;
        }
        this.canvas.blend(x,y,c[0],c[1],c[2],c[3]*this.globalAlpha,this.globalCompositeOperation);
      }
  }
  fillText(){}strokeText(){}measureText(){return {width:0};}setLineDash(){}
  createLinearGradient(){return {addColorStop(){}};}createRadialGradient(){return {addColorStop(){}};}
  putImageData(){}getImageData(){return {data:new Uint8ClampedArray(4)};}
}
