/* Gravity1 sample geometry preparation. Duplicates the active composition. */
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
    app.beginUndoGroup('Gravity1 geometry preparation');
    try {
        var source=app.project.activeItem;
        if (!(source instanceof CompItem)) throw new Error('Open the source composition.');
        var c=source.duplicate();
        c.name='Gravity1_Geometry';
        c.openInViewer();
        for(var j=1;j<=c.numLayers;j++) c.layer(j).selected=false;
        var floor=c.layer('あかさたな');
        floor.selected=true;
        var command=app.findMenuCommandId('テキストからシェイプを作成');
        if(!command) throw new Error('Create Shapes from Text command not found');
        app.executeCommand(command);
        var out={schema:'gravity1-geometry-1',sourceName:source.name,composition:{name:c.name,width:c.width,height:c.height,pixelAspect:c.pixelAspect,frameRate:c.frameRate,duration:c.duration,time:0},layers:[]};
        for(var i=1;i<=c.numLayers;i++) {
            var l=c.layer(i);
            if(l.matchName!=='ADBE Vector Layer' || !l.enabled) continue;
            var role='dynamic';
            if(l.name.indexOf('あかさたな')>=0) role='static';
            out.layers.push({name:l.name,role:role,parent:l.parent?l.parent.name:null,threeD:l.threeDLayer,transform:tree(l.property('ADBE Transform Group'),0),contents:tree(l.property('ADBE Root Vectors Group'),0)});
        }
        if(out.layers.length!==6) throw new Error('Expected 6 shape bodies; got '+out.layers.length);
        var f=new File(File($.fileName).parent.fsName+'/geometry.json'); f.encoding='UTF-8';
        if(!f.open('w')) throw new Error('Cannot write geometry');
        f.write(json(out));f.close();
        alert('Gravity1 geometry: '+out.layers.length+' bodies exported');
    } catch(e) {alert('Gravity1: '+e.toString());}
    finally {app.endUndoGroup();}
})();
