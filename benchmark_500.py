"""Synthetic 500-glyph pile benchmark, using the five extracted glyph shapes.
No AE mutation. Mutual gravity is disabled in this baseline.
"""
import json,time,math,platform
from pathlib import Path
import pymunk
P=Path(__file__).parent
cache=[x for x in json.loads((P/'colliders.json').read_text()) if x['role']=='dynamic']
space=pymunk.Space();space.gravity=(0,980);space.iterations=50;space.collision_slop=.03;space.sleep_time_threshold=.5
floor=pymunk.Segment(space.static_body,(100,1000),(1820,1000),2);floor.friction=.6;floor.elasticity=.2;space.add(floor)
objects=[]
for i in range(500):
    spec=cache[i%5];b=pymunk.Body();b.position=(360+(i%25)*48,250-(i//25)*48);space.add(b);shapes=[]
    for vs in spec['pieces']:
        s=pymunk.Poly(b,vs);s.density=.01;s.friction=.6;s.elasticity=.2;space.add(s);shapes.append(s)
    objects.append({'body':b,'shapes':shapes,'entered':False,'removed':False})
max_penetration=0.; contacts=0

def collision(arb,space,data):
    global max_penetration,contacts
    contacts+=1
    for p in arb.contact_point_set.points:max_penetration=max(max_penetration,-p.distance)
space.on_collision(None,None,post_solve=collision)
start=time.perf_counter(); checkpoints=[]
for frame in range(300):
    for step in range(16):
        space.step(1/960)
    for o in objects:
        b=o['body'];assert all(math.isfinite(v) for v in [*b.position,b.angle,*b.velocity,b.angular_velocity])
        if o['removed']:continue
        bbs=[s.bb for s in o['shapes']]
        inside=max(s.right for s in bbs)>=-480 and min(s.left for s in bbs)<=2400 and max(s.top for s in bbs)>=-270 and min(s.bottom for s in bbs)<=1350
        if inside:o['entered']=True
        elif o['entered']:
            space.remove(*o['shapes'],b);o['removed']=True
    if (frame+1)%60==0:
        row={'simulationSeconds':(frame+1)/60,'wallSeconds':time.perf_counter()-start,'sleeping':sum(o['body'].is_sleeping for o in objects),'removed':sum(o['removed'] for o in objects)}
        checkpoints.append(row);print(json.dumps(row),flush=True)
result={'scene':'500 copies of 5 extracted hiragana glyphs; 25x20 grid; synthetic horizontal floor','platform':platform.platform(),'pymunk':pymunk.version,'count':500,'convexShapes':sum(len(o['shapes']) for o in objects),'fps':60,'substeps':16,'iterations':50,'mutualGravity':False,'curveTolerancePx':.08,'checkpoints':checkpoints,'contactCallbacks':contacts,'maximumContactPenetrationPx':max_penetration,'allFinite':True}
(P/'benchmark-500.json').write_text(json.dumps(result,ensure_ascii=False,indent=2));print(json.dumps(result),flush=True)
