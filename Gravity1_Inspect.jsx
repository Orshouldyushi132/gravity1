/* Gravity1 read-only shape inspection. Does not modify the project. */
(function () {
    function json(v) {
        if (v === null || v === undefined) return 'null';
        if (typeof v === 'string') return '"' + v.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r/g, '\\r').replace(/\n/g, '\\n').replace(/\t/g, '\\t') + '"';
        if (typeof v === 'number') return isFinite(v) ? String(v) : 'null';
        if (typeof v === 'boolean') return String(v);
        var a = [], k;
        if (v instanceof Array) { for (k = 0; k < v.length; k++) a.push(json(v[k])); return '[' + a.join(',') + ']'; }
        for (k in v) if (v.hasOwnProperty(k)) a.push(json(k) + ':' + json(v[k]));
        return '{' + a.join(',') + '}';
    }
    function tree(p, t) {
        var o = {name:p.name, matchName:p.matchName}, i, v;
        try { o.enabled=p.enabled; } catch(ignore) {}
        if (p.propertyType === PropertyType.PROPERTY) {
            o.keys = p.numKeys;
            if (p.canSetExpression) o.expression = p.expressionEnabled;
            try {
                v = p.valueAtTime(t, false);
                if (p.propertyValueType === PropertyValueType.SHAPE) o.shape = {closed:v.closed, vertices:v.vertices, inTangents:v.inTangents, outTangents:v.outTangents};
                else if (typeof v === 'number' || typeof v === 'string' || v instanceof Array) o.value = v;
            } catch(e) { o.error = String(e); }
        } else {
            o.children = [];
            for(i=1;i<=p.numProperties;i++) o.children.push(tree(p.property(i),t));
        }
        return o;
    }
    try {
        var c=app.project.activeItem;
        if (!(c instanceof CompItem)) throw new Error('コンポジションを開いてから実行してください。');
        var out={schema:'gravity1-inspection-1', aeVersion:app.version, composition:{name:c.name,width:c.width,height:c.height,pixelAspect:c.pixelAspect,frameRate:c.frameRate,duration:c.duration,time:c.time},layers:[]};
        for(var i=1;i<=c.numLayers;i++) {
            var l=c.layer(i);
            var role='unassigned';
            if(l.matchName==='ADBE Vector Layer') role='dynamic';
            if(!l.enabled || l.name==='あいうえお') role='excluded';
            if(l.name==='あかさたな' && l.enabled) role='static';
            var o={index:i,name:l.name,enabled:l.enabled,role:role,type:l.matchName,threeD:l.threeDLayer,parent:l.parent?l.parent.index:null,inPoint:l.inPoint,outPoint:l.outPoint};
            if(role!=='excluded') {
                o.transform=tree(l.property('ADBE Transform Group'),c.time);
                if(l.matchName==='ADBE Vector Layer') o.contents=tree(l.property('ADBE Root Vectors Group'),c.time);
                if(l.matchName==='ADBE Text Layer') o.text=l.property('ADBE Text Properties').property('ADBE Text Document').valueAtTime(c.time,false).text;
            }
            out.layers.push(o);
        }
        var f=new File(File($.fileName).parent.fsName+'/Gravity1-inspection.json');
        f.encoding='UTF-8';
        if(!f.open('w')) throw new Error('JSONを書き込めません。AEのスクリプトによるファイル書き込み設定を確認してください。');
        f.write(json(out)); f.close();
        alert('Gravity1: 読み取り完了\n'+f.fsName);
    } catch(e) {alert('Gravity1: '+e.toString());}
})();
