"""Bounded Gravity1 sample proof: Shapely geometry + Pymunk rigid bodies.
Run with the work/venv interpreter. Not a general AE importer yet.
"""
import json, math, time
from pathlib import Path
import numpy as np
import pymunk
from shapely import constrained_delaunay_triangles
from shapely.geometry import LineString
from shapely.ops import polygonize, unary_union
P=Path(__file__).parent
D=json.loads((P/'geometry.json').read_text())
FPS=60; SECONDS=5; SUBSTEPS=16; TOL=.08

def children(n): return n.get('children',[])
def values(n): return {c['matchName']:c.get('value') for c in children(n)}
def transform(v,group=False):
    pre='ADBE Vector ' if group else 'ADBE '
    a=v.get(pre+('Anchor' if group else 'Anchor Point'),[0,0]);p=v.get(pre+'Position',[0,0]);s=v.get(pre+'Scale',[100,100]);r=v.get(pre+('Rotation' if group else 'Rotate Z'),0)
    assert not v.get('ADBE Vector Skew',0), 'Skew unsupported in sample'
    t=math.radians(r); c=math.cos(t);sn=math.sin(t)
    m=np.array([[c*s[0]/100,-sn*s[1]/100,0],[sn*s[0]/100,c*s[1]/100,0],[0,0,1.]])
    m[:2,2]=np.array(p[:2])-m[:2,:2]@np.array(a[:2]);return m

def flatten(q,depth=0):
    a,b,c,d=q; delta=d-a; length=np.linalg.norm(delta)
    dist=max(np.linalg.norm(b-a),np.linalg.norm(c-a)) if length<1e-12 else max(abs(delta[0]*(b-a)[1]-delta[1]*(b-a)[0]),abs(delta[0]*(c-a)[1]-delta[1]*(c-a)[0]))/length
    if dist<=TOL:return [a,d]
    assert depth<20
    ab=(a+b)/2;bc=(b+c)/2;cd=(c+d)/2;abc=(ab+bc)/2;bcd=(bc+cd)/2;mid=(abc+bcd)/2
    return flatten([a,ab,abc,mid],depth+1)[:-1]+flatten([mid,bcd,cd,d],depth+1)

def contours(n,m):
    if n.get('enabled') is False:return []
    if n.get('matchName')=='ADBE Vector Group':
        ts=next(c for c in children(n) if c['matchName']=='ADBE Vector Transform Group')
        m=m@transform(values(ts),True)
    if 'shape'in n:
        s=n['shape'];assert s['closed']; vs=np.array(s['vertices']);ins=np.array(s['inTangents']);outs=np.array(s['outTangents']);points=[]
        for i,a in enumerate(vs):
            j=(i+1)%len(vs);ctrl=[a,a+outs[i],vs[j]+ins[j],vs[j]]
            ctrl=[(m@np.r_[v,1])[:2] for v in ctrl]
            points.extend(flatten(ctrl)[:-1])
        return [points+[points[0]]]
    result=[]
    for c in children(n):result+=contours(c,m)
    return result

def winding(point,ring):
    x,y=point;w=0
    for a,b in zip(ring,ring[1:]):
        cross=(b[0]-a[0])*(y-a[1])-(x-a[0])*(b[1]-a[1])
        if a[1]<=y<b[1] and cross>0:w+=1
        elif b[1]<=y<a[1] and cross<0:w-=1
    return w

space=pymunk.Space();space.gravity=(0,980);space.iterations=50;space.collision_slop=.03
objects=[];stats=[]; collider_cache=[]
for l in D['layers']:
    assert not l['threeD'] and not l['parent']
    rings=contours(l['contents'],transform(values(l['transform'])))
    faces=list(polygonize(unary_union([LineString(r) for r in rings])))
    geom=unary_union([f for f in faces if sum(winding(f.representative_point().coords[0],r) for r in rings)!=0])
    assert geom.is_valid and geom.area>0
    pieces=list(constrained_delaunay_triangles(geom).geoms)
    assert unary_union(pieces).symmetric_difference(geom).area<1e-6
    # Merge adjacent triangles when their union remains convex.
    changed=True
    while changed:
        changed=False
        for i in range(len(pieces)):
            for j in range(i+1,len(pieces)):
                if not pieces[i].intersects(pieces[j]):continue
                u=pieces[i].union(pieces[j])
                if u.geom_type=='Polygon' and abs(u.convex_hull.area-u.area)<1e-9:
                    pieces[i]=u;pieces.pop(j);changed=True;break
            if changed:break
    assert unary_union(pieces).symmetric_difference(geom).area<1e-6
    center=np.array(geom.centroid.coords[0]);dynamic=l['role']=='dynamic'
    collider_cache.append({'name':l['name'],'role':l['role'],'pieces':[(np.array(poly.exterior.coords[:-1])-center).tolist() for poly in pieces]})
    body=pymunk.Body() if dynamic else pymunk.Body(body_type=pymunk.Body.STATIC)
    body.position=tuple(center);space.add(body)
    shapes=[]
    for poly in pieces:
        coords=np.array(poly.exterior.coords[:-1])-center
        shape=pymunk.Poly(body,[tuple(v) for v in coords]);shape.friction=.6;shape.elasticity=.2
        if dynamic:shape.density=.01
        space.add(shape);shapes.append(shape)
    origin=np.array(values(l['transform'])['ADBE Position'][:2]);offset=origin-center
    polys=list(geom.geoms) if hasattr(geom,'geoms') else [geom]
    holes=sum(len(p.interiors) for p in polys)
    stats.append({'name':l['name'],'area':geom.area,'holes':holes,'convexPieces':len(pieces)})
    objects.append({'name':l['name'],'role':l['role'],'body':body,'shapes':shapes,'offset':offset,'rings':[[list(v-center) for v in r] for r in rings],'frames':[],'entered':False,'removed':False})
(P/'colliders.json').write_text(json.dumps(collider_cache,ensure_ascii=False))
contacts=[0]
def contact(arb,space,data):contacts[0]+=1
space.on_collision(None,None,post_solve=contact)
start=time.perf_counter()
for frame in range(FPS*SECONDS):
    for o in objects:
        b=o['body'];off=pymunk.Vec2d(*o['offset']).rotated(b.angle);pos=b.position+off
        assert all(math.isfinite(v) for v in [pos.x,pos.y,b.angle])
        o['frames'].append([pos.x,pos.y,math.degrees(b.angle),b.position.x,b.position.y])
    if frame==FPS*SECONDS-1:break
    for _ in range(SUBSTEPS):
        space.step(1/FPS/SUBSTEPS)
        for o in objects:
            if o['role']!='dynamic' or o['removed']:continue
            bs=[s.bb for s in o['shapes']]
            inside=max(b.right for b in bs)>=-480 and min(b.left for b in bs)<=2400 and max(b.top for b in bs)>=-270 and min(b.bottom for b in bs)<=1350
            if inside:o['entered']=True
            elif o['entered']:
                space.remove(*o['shapes'],o['body']);o['removed']=True
elapsed=time.perf_counter()-start
out={'sourceName':D['sourceName'],'fps':FPS,'duration':SECONDS,'settings':{'gravity':[0,980],'friction':.6,'restitution':.2,'substeps':SUBSTEPS,'iterations':50,'curveTolerancePx':TOL,'mutualGravity':False},'stats':stats,'secondsComputing':elapsed,'contactCallbacks':contacts[0],'objects':[{k:v for k,v in o.items() if k not in ('body','shapes','offset')} for o in objects]}
(P/'simulation.json').write_text(json.dumps(out,ensure_ascii=False))
print(json.dumps({'stats':stats,'seconds':elapsed,'contacts':contacts[0]},ensure_ascii=False,indent=2))
