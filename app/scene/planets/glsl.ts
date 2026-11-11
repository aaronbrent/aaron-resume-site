/*! webgl-noise (https://github.com/ashima/webgl-noise), MIT licence.
 * Copyright (C) 2011 by Ashima Arts (Simplex noise)
 * Copyright (C) 2011-2016 by Stefan Gustavson (Classic noise and others)
 * Full notice: THIRD_PARTY_NOTICES.md and /third-party-notices.txt. */
/**
 * GLSL for the planet bodies. Everything is procedural (no textures):
 * 3D simplex noise + fbm, then one surface function per body kind selected
 * by `#define PLANET_KIND` (see KIND in ./config).
 */

/** 3D simplex noise (webgl-noise, Ashima Arts / Ian McEwan; notice above) + fbm. */
export const NOISE = /* glsl */ `
vec3 pn_mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 pn_mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 pn_perm(vec4 x){return pn_mod289(((x*34.0)+10.0)*x);}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0);
  vec3 i=floor(v+dot(v,C.yyy));
  vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);
  vec3 l=1.0-g;
  vec3 i1=min(g.xyz,l.zxy);
  vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;
  vec3 x2=x0-i2+C.yyy;
  vec3 x3=x0-0.5;
  i=pn_mod289(i);
  vec4 p=pn_perm(pn_perm(pn_perm(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  vec4 j=p-49.0*floor(p*(1.0/49.0));
  vec4 x_=floor(j*(1.0/7.0));
  vec4 y_=floor(j-7.0*x_);
  vec4 x=(x_*2.0+0.5)/7.0-1.0;
  vec4 y=(y_*2.0+0.5)/7.0-1.0;
  vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);
  vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0;
  vec4 s1=floor(b1)*2.0+1.0;
  vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;
  vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 g0=vec3(a0.xy,h.x);
  vec3 g1=vec3(a0.zw,h.y);
  vec3 g2=vec3(a1.xy,h.z);
  vec3 g3=vec3(a1.zw,h.w);
  vec4 nr=inversesqrt(vec4(dot(g0,g0),dot(g1,g1),dot(g2,g2),dot(g3,g3)));
  g0*=nr.x;g1*=nr.y;g2*=nr.z;g3*=nr.w;
  vec4 m=max(0.5-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);
  m=m*m;
  return 105.0*dot(m*m,vec4(dot(g0,x0),dot(g1,x1),dot(g2,x2),dot(g3,x3)));
}
float fbm(vec3 p){
  float s=0.0,a=0.5;
  for(int i=0;i<4;i++){s+=a*snoise(p);p=p*2.03+vec3(1.7,9.2,3.1);a*=0.5;}
  return s;
}
`;

/**
 * Surface per kind. `p` is the unit-sphere point in object space (so the
 * pattern spins with the mesh). Writes albedo, roughness, emissive (HDR:
 * only lava exceeds 1, reading as hot after tone mapping) and alpha (clouds).
 */
export const SURFACE = /* glsl */ `
uniform float uTime;
uniform vec3 uBase;
uniform vec3 uAccent;
uniform vec3 uAtmos;
uniform float uSeed;
uniform float uWrap;
uniform float uRim;
varying vec3 vObjPos;

struct PlanetSurface { vec3 albedo; float roughness; vec3 emissive; float alpha; };

PlanetSurface planetSurface(vec3 p){
  PlanetSurface s;
  s.emissive=vec3(0.0);
  s.alpha=1.0;
  s.roughness=0.85;
#if PLANET_KIND == 0
  // molten: dark basalt crust split by a few glowing lava rifts that pulse
  vec3 q=p+vec3(uSeed);
  float warp=fbm(q*1.2);
  float n=fbm(q*2.2+warp*0.6);
  float v1=1.0-abs(snoise(q*1.7+warp*0.7));
  float v2=1.0-abs(snoise(q*4.2+warp*1.3+3.0));
  float mask=smoothstep(-0.05,0.35,fbm(q*1.3+5.0));
  float cracks=smoothstep(0.955,0.993,v1)+0.7*mask*smoothstep(0.968,0.995,v2);
  float halo=smoothstep(0.8,0.99,v1)*0.75+mask*smoothstep(0.86,0.99,v2)*0.35;
  vec3 crust=mix(uBase*vec3(0.26,0.16,0.17),uBase*0.95,smoothstep(-0.5,0.6,n));
  s.albedo=mix(crust,uAccent*0.5,halo*0.25);
  float pulse=0.78+0.22*sin(uTime*1.4+n*5.0);
  s.emissive=uAccent*(cracks*4.5*pulse+halo*0.07);
  s.roughness=0.9;
#elif PLANET_KIND == 1
  // ocean: deep teal with turquoise shallows and a few small islands
  float n=fbm(p*2.3+vec3(uSeed));
  float shallow=smoothstep(0.12,0.46,n);
  vec3 sea=mix(uBase*0.68,uBase*1.12,smoothstep(-0.5,0.3,n));
  sea=mix(sea,uAccent*0.8,shallow*0.7);
  float land=smoothstep(0.5,0.53,n);
  vec3 isle=mix(vec3(0.6,0.62,0.44),vec3(0.26,0.5,0.34),smoothstep(0.51,0.57,n));
  s.albedo=mix(sea,isle,land);
  s.roughness=mix(0.42,0.85,land);
#elif PLANET_KIND == 2
  // desert: ochre dune bands warped by noise, darker mesas, fine ripples
  float warp=fbm(p*1.7+vec3(uSeed));
  float lat=p.y+warp*0.16;
  float b1=sin(lat*13.0)*0.5+0.5;
  float b2=sin(lat*29.0+warp*4.0)*0.5+0.5;
  float ripple=sin(dot(p,vec3(0.6,0.25,0.75))*70.0+warp*14.0)*smoothstep(0.1,0.6,b1);
  vec3 sand=mix(uBase*vec3(0.78,0.62,0.5),uBase,smoothstep(0.2,0.8,b1));
  sand=mix(sand,uAtmos,b2*0.32+ripple*0.07);
  float mesa=smoothstep(0.25,0.55,fbm(p*3.1+vec3(4.0)));
  s.albedo=mix(sand,uBase*vec3(0.55,0.36,0.3),mesa*0.6);
  s.roughness=0.95;
#elif PLANET_KIND == 3
  // ice: pale glacier with blue crevasses and bright polar caps
  float n=fbm(p*2.2+vec3(uSeed));
  float crev=smoothstep(0.88,0.985,1.0-abs(snoise(p*4.2+n*1.5)));
  vec3 ice=mix(uBase*vec3(0.78,0.88,1.0),uBase*1.08,smoothstep(-0.4,0.5,n));
  ice=mix(ice,vec3(0.22,0.45,0.75),crev*0.55);
  float cap=smoothstep(0.62,0.82,abs(p.y)+n*0.12);
  s.albedo=mix(ice,uAccent*0.95,cap);
  s.roughness=mix(0.45,0.7,cap);
#elif PLANET_KIND == 4
  // gas giant: cream / muted-blue latitude bands with turbulence, a faint
  // regular grid (the "chart" read) and an oval storm
  float turb=fbm(vec3(p.x*1.6,p.y*5.0,p.z*1.6)+vec3(uSeed));
  float y=p.y+turb*0.055;
  float band=smoothstep(0.3,0.7,sin(y*10.0)*0.5+0.5);
  float fine=sin(y*27.0+turb*2.0)*0.5+0.5;
  vec3 col=mix(uBase,mix(uBase,uAccent,0.62),band);
  col=mix(col,uAccent*0.9,smoothstep(0.75,1.0,fine)*0.22);
  col*=0.94+0.1*fine;
  float lon=atan(p.z,p.x)*0.15915494;
  float gy=abs(fract(y*14.0)-0.5);
  float gx=abs(fract(lon*28.0+turb*0.06)-0.5);
  float grid=(1.0-smoothstep(0.0,0.045,gy))*0.7+(1.0-smoothstep(0.0,0.03,gx))*0.35;
  col=mix(col,uBase*1.12,grid*0.24);
  vec2 sp=vec2(atan(p.z,p.x)+3.15,p.y+0.14);
  sp.x=mod(sp.x+3.14159265,6.2831853)-3.14159265;
  vec2 e=sp/vec2(0.36,0.13);
  float d=length(e);
  float ang=atan(e.y,e.x)+d*2.6;
  float swirl=snoise(vec3(cos(ang)*d*2.0,sin(ang)*d*2.0,uSeed));
  float storm=1.0-smoothstep(0.55,1.05,d+swirl*0.12);
  float core=1.0-smoothstep(0.0,0.6,d+swirl*0.15);
  vec3 stormCol=mix(mix(uBase,uAccent,0.75),uAccent*0.7,core);
  col=mix(col,stormCol,storm*0.75);
  col=mix(col,uBase*1.08,smoothstep(0.75,0.95,d+swirl*0.1)*(1.0-smoothstep(0.95,1.2,d))*0.45);
  s.albedo=col;
  s.roughness=0.9;
#elif PLANET_KIND == 5
  // cloud shell: soft wispy latitude bands stretched along longitude
  vec3 q=p+vec3(uSeed);
  float warp=fbm(q*1.4);
  float lat=p.y+warp*0.14;
  float bands=smoothstep(0.2,0.9,sin(lat*7.0+1.0)*0.5+0.5);
  float wisps=fbm(vec3(q.x*2.4,lat*5.5,q.z*2.4)+warp*0.7);
  float a=smoothstep(-0.12,0.5,wisps*0.9+bands*0.55-0.38);
  s.albedo=mix(uAtmos,vec3(1.0),0.65);
  s.alpha=a*0.58*(1.0-smoothstep(0.78,0.96,abs(p.y)));
  s.roughness=1.0;
#else
  // moon: soft grey, tinted toward the planet's atmosphere, with craters
  vec3 q=p*2.6+vec3(uSeed);
  float n=fbm(q);
  float c=snoise(q*1.8);
  float crater=smoothstep(0.35,0.6,c)*(1.0-smoothstep(0.6,0.72,c));
  vec3 rock=mix(vec3(0.5,0.49,0.52),uAtmos*0.75,0.3);
  s.albedo=rock*(0.82+0.22*n)*(1.0-crater*0.35)+crater*0.06;
  s.roughness=0.95;
#endif
  return s;
}

// Soft (wrapped) diffuse with a warm terminator band: no hard black night side.
vec3 planetWrap(float ndl){
  float w=clamp((ndl+uWrap)/(1.0+uWrap),0.0,1.0);
  w=w*w*(3.0-2.0*w);
  float band=smoothstep(0.0,0.3,w)*(1.0-smoothstep(0.3,0.7,w));
  return vec3(w)*mix(vec3(1.0),vec3(1.22,0.88,0.74),band*0.3);
}
`;

/** Added to outgoingLight: palette-tinted fresnel rim + cool bounce on the night side. */
export const RIM = /* glsl */ `
{
  vec3 sunV=normalize(viewMatrix[3].xyz+vViewPosition);
  float ndl=dot(normal,sunV);
  float day=smoothstep(-0.6,0.5,ndl);
  float fres=pow(1.0-saturate(dot(normal,normalize(vViewPosition))),3.0);
  vec3 rim=uAtmos*fres*mix(0.18,1.0,day)*uRim;
  vec3 bounce=mix(uAtmos,vec3(0.26,0.38,0.95),0.6)*(diffuseColor.rgb*0.2+0.045)*(1.0-day)*0.6;
  outgoingLight+=(rim+bounce)*diffuseColor.a;
}
`;

/** Ring: concentric bands from the remapped u, planet shadow, scene lights. */
export const RING_VERT = /* glsl */ `
varying vec2 vUv;
varying vec3 vWorldPos;
varying vec3 vViewPos;
varying vec3 vViewNormal;
void main(){
  vUv=uv;
  vec4 wp=modelMatrix*vec4(position,1.0);
  vWorldPos=wp.xyz;
  vec4 mv=viewMatrix*wp;
  vViewPos=mv.xyz;
  vViewNormal=normalize(normalMatrix*normal);
  gl_Position=projectionMatrix*mv;
}
`;

export const RING_FRAG = /* glsl */ `
#include <common>
#include <lights_pars_begin>
uniform vec3 uBase;
uniform vec3 uAccent;
uniform vec3 uAtmos;
uniform vec3 uPlanetPos;
uniform float uPlanetRadius;
uniform float uSeed;
uniform float uStyle;
varying vec2 vUv;
varying vec3 vWorldPos;
varying vec3 vViewPos;
varying vec3 vViewNormal;
${NOISE}
void main(){
  float r=vUv.x;
  float n1=snoise(vec3(r*mix(9.0,24.0,uStyle),uSeed,0.0));
  float n2=snoise(vec3(r*mix(21.0,63.0,uStyle),uSeed+4.0,0.0));
  float dens=0.66+0.2*n1+mix(0.05,0.08,uStyle)*n2;
  // gaps (Cassini-like) + soft edges
  float gap=smoothstep(0.012,0.03,abs(r-0.63))*mix(1.0,smoothstep(0.004,0.014,abs(r-0.86)),uStyle);
  float edge=smoothstep(0.0,0.06,r)*(1.0-smoothstep(0.9,1.0,r));
  float alpha=clamp(dens*gap*edge,0.0,1.0);
  alpha*=mix(0.62,0.92,uStyle);
  vec3 col=mix(uBase,uAccent,smoothstep(-0.3,0.6,n1));
  col=mix(col,uAtmos,smoothstep(0.4,1.0,n2)*0.35);
  col=mix(col*0.8,col,smoothstep(0.0,0.4,r));
  // sun = scene point light at the origin: shadow where the planet blocks it
  vec3 toSun=normalize(-vWorldPos);
  vec3 cp=uPlanetPos-vWorldPos;
  float t=dot(cp,toSun);
  float dist=length(cp-toSun*t);
  float shadow=t>0.0?smoothstep(uPlanetRadius*0.93,uPlanetRadius*1.03,dist):1.0;
  vec3 n=normalize(vViewNormal);
  vec3 irr=ambientLightColor;
  #if NUM_POINT_LIGHTS > 0
  for(int i=0;i<NUM_POINT_LIGHTS;i++){
    IncidentLight il;
    getPointLightInfo(pointLights[i],vViewPos,il);
    irr+=il.color*(0.55+0.45*abs(dot(n,il.direction)))*shadow;
  }
  #endif
  #if NUM_DIR_LIGHTS > 0
  for(int i=0;i<NUM_DIR_LIGHTS;i++){
    IncidentLight il;
    getDirectionalLightInfo(directionalLights[i],il);
    irr+=il.color*(0.55+0.45*abs(dot(n,il.direction)));
  }
  #endif
  vec3 outC=col*irr*RECIPROCAL_PI+uAtmos*mix(0.06,0.02,uStyle);
  gl_FragColor=vec4(outC,alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

/** Thin additive atmosphere: exact limb profile from the shell geometry. */
export const ATMOS_VERT = /* glsl */ `
varying vec3 vN;
varying vec3 vV;
varying vec3 vSun;
void main(){
  vec4 mv=modelViewMatrix*vec4(position,1.0);
  vN=normalize(normalMatrix*normal);
  vV=normalize(-mv.xyz);
  vSun=normalize(viewMatrix[3].xyz-mv.xyz);
  gl_Position=projectionMatrix*mv;
}
`;

export const ATMOS_FRAG = /* glsl */ `
uniform vec3 uAtmos;
uniform float uScale;
uniform float uStrength;
varying vec3 vN;
varying vec3 vV;
varying vec3 vSun;
void main(){
  vec3 n=normalize(vN);
  float d=clamp(dot(n,normalize(vV)),0.0,1.0);
  // impact parameter in planet radii: <1 over the disc, 1..uScale in the halo
  float b=uScale*sqrt(1.0-d*d);
  float g=b<1.0?pow(b,8.0):pow(1.0-(b-1.0)/(uScale-1.0),1.6);
  float lit=smoothstep(-0.35,0.55,dot(n,normalize(vSun)));
  gl_FragColor=vec4(uAtmos*g*uStrength*(0.12+0.88*lit),1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;
