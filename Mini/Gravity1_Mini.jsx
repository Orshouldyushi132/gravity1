#target aftereffects
#targetengine "Gravity1Mini"
(function(){
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
var home=File($.fileName).parent;
var python='/Users/famifaro/Documents/Codex/2026-09-12/cha/work/venv/bin/python';
var w=new Window('palette','Gravity1 Mini');w.orientation='column';w.alignChildren='fill';
w.add('statictext',undefined,'表示中のシェイプを落下／テキストは固定／非表示は除外');
var top=w.add('group');var comps=top.add('dropdownlist',undefined,[]);comps.preferredSize.width=320;
var refresh=top.add('button',undefined,'更新');
var list=w.add('listbox',undefined,[],{multiselect:true});list.preferredSize=[460,230];
var toggle=w.add('button',undefined,'選択したシェイプの「落下／固定」を切替');
w.add('statictext',undefined,'5秒・下向き重力・高精度。計算中はAEの操作をお待ちください。');
var run=w.add('button',undefined,'演算して新規コンポに出力');
var status=w.add('statictext',undefined,'コンポを選択してください');status.characters=65;
var sources=[],roles={},source=null;
function load(){list.removeAll();roles={};source=comps.selection?sources[comps.selection.index]:null;if(!source)return;
 for(var i=1;i<=source.numLayers;i++){var l=source.layer(i);if(!l.enabled)continue;if(l.matchName!=='ADBE Vector Layer'&&l.matchName!=='ADBE Text Layer')continue;
 roles[i]=l.matchName==='ADBE Text Layer'?'static':'dynamic';var row=list.add('item',(roles[i]==='static'?'[固定] ':'[落下] ')+i+' '+l.name);row.layerIndex=i;
 }status.text=list.items.length+'レイヤーを読み込み';}
function refreshComps(){sources=[];comps.removeAll();var selected=0;for(var i=1;i<=app.project.numItems;i++){var c=app.project.item(i);if(c instanceof CompItem){if(c===app.project.activeItem)selected=sources.length;sources.push(c);comps.add('item',c.name);}}if(sources.length)comps.selection=selected;load();}
refresh.onClick=refreshComps;comps.onChange=load;
toggle.onClick=function(){var selected=list.selection;if(!selected)return;for(var k=0;k<selected.length;k++){var row=selected[k],idx=row.layerIndex;if(source.layer(idx).matchName!=='ADBE Vector Layer')continue;roles[idx]=roles[idx]==='static'?'dynamic':'static';row.text=(roles[idx]==='static'?'[固定] ':'[落下] ')+idx+' '+source.layer(idx).name;}};
function write(file,text){file.encoding='UTF-8';if(!file.open('w'))throw new Error('ファイルを書き込めません: '+file.fsName);file.write(text);file.close();}
function quote(s){return "'"+s.replace(/'/g,"'\\''")+"'";}
function check(p){if(p.propertyType===PropertyType.PROPERTY){if(p.numKeys || (p.canSetExpression&&p.expressionEnabled))throw new Error('Mini版は対象の形状・変換アニメーションに未対応です');}else for(var j=1;j<=p.numProperties;j++)check(p.property(j));}
run.onClick=function(){
 var temp=null,result=null;run.enabled=false;refresh.enabled=false;toggle.enabled=false;comps.enabled=false;
 app.beginUndoGroup('Gravity1 Mini');
 try{
 if(!source)throw new Error('コンポを選択してください');if(!File(python).exists)throw new Error('演算用Pythonが見つかりません');
 var dynamic=0;
 for(var k in roles)if(roles.hasOwnProperty(k)){var l=source.layer(Number(k));if(l.parent||l.threeDLayer)throw new Error('親子関係・3Dレイヤーは未対応');check(l.property('ADBE Transform Group'));if(l.matchName==='ADBE Vector Layer')check(l.property('ADBE Root Vectors Group'));if(roles[k]==='dynamic')dynamic++;}
 if(!dynamic)throw new Error('落下するシェイプがありません');
 var job=new Folder(home.fsName+'/jobs/'+new Date().getTime());new Folder(home.fsName+'/jobs').create();if(!job.create())throw new Error('作業フォルダーを作成できません');
 status.text='輪郭を取得中…';w.update();
 temp=source.duplicate();temp.name='Gravity1_work';temp.openInViewer();
 for(var i=1;i<=temp.numLayers;i++){temp.layer(i).comment='G1:'+i;temp.layer(i).selected=false;}
 var texts=[];for(var i=1;i<=temp.numLayers;i++)if(roles[i]&&temp.layer(i).matchName==='ADBE Text Layer')texts.push(temp.layer(i));
 var command=app.findMenuCommandId('テキストからシェイプを作成');if(texts.length&&!command)throw new Error('テキスト変換コマンドが見つかりません');
 for(var t=0;t<texts.length;t++){for(var j=1;j<=temp.numLayers;j++)temp.layer(j).selected=false;var before=temp.numLayers;var idx=parseInt(texts[t].comment.substring(3),10);texts[t].selected=true;app.executeCommand(command);if(temp.numLayers!==before+1)throw new Error('テキストの変換に失敗');var shape=temp.layer(texts[t].index-1);shape.comment='G1:'+idx;}
 var data={sourceName:source.name,sourceId:source.id,composition:{width:source.width,height:source.height,frameRate:source.frameRate,duration:source.duration},layers:[]};
 for(var i=1;i<=temp.numLayers;i++){var l=temp.layer(i);var idx=parseInt(l.comment.substring(3),10);if(!roles[idx]||!l.enabled||l.matchName!=='ADBE Vector Layer')continue;data.layers.push({name:l.name,sourceIndex:idx,sourceLayerId:source.layer(idx).id,role:roles[idx],parent:null,threeD:false,transform:tree(l.property('ADBE Transform Group'),0),contents:tree(l.property('ADBE Root Vectors Group'),0)});}
 write(new File(job.fsName+'/geometry.json'),json(data));temp.remove();temp=null;source.openInViewer();
 status.text='物理演算中…（W8 88文字で約1分が目安）';w.update();
 var commandLine=quote(python)+' '+quote(home.fsName+'/engine.py')+' '+quote(job.fsName)+' > '+quote(job.fsName+'/log.txt')+' 2>&1';
 system.callSystem('/bin/sh -c '+quote(commandLine));
 var f=new File(job.fsName+'/simulation.json');if(!f.exists){var log=new File(job.fsName+'/log.txt');log.open('r');var msg=log.read();log.close();throw new Error('演算に失敗しました\n'+msg.slice(-1200));}
 f.open('r');var motion=JSON.parse(f.read());f.close();
 status.text='キーフレームを書き込み中…';w.update();
 result=source.duplicate();result.name=source.name+'_Gravity1';result.duration=5;result.workAreaStart=0;result.workAreaDuration=5;
 for(var i=1;i<=result.numLayers;i++)result.layer(i).outPoint=5;
 var keys=0,error=0;
 for(var b=0;b<motion.objects.length;b++){var o=motion.objects[b];if(o.role!=='dynamic')continue;if(source.layer(o.sourceIndex).id!==o.sourceLayerId)throw new Error('レイヤー構成が変更されました');
 var tr=result.layer(o.sourceIndex).property('ADBE Transform Group'),p=tr.property('ADBE Position'),r=tr.property('ADBE Rotate Z');if(p.dimensionsSeparated)throw new Error('次元分割した位置は未対応');
 var times=[],positions=[],angles=[],dim=p.value.length,zero=dim===3?[0,0,0]:[0,0];
 for(var a=0;a<o.frames.length;a++){times.push(a/motion.fps);positions.push(dim===3?[o.frames[a][0],o.frames[a][1],0]:[o.frames[a][0],o.frames[a][1]]);angles.push(o.frames[a][2]);}
 p.setValuesAtTimes(times,positions);r.setValuesAtTimes(times,angles);
 for(var a=1;a<=times.length;a++){p.setInterpolationTypeAtKey(a,KeyframeInterpolationType.LINEAR,KeyframeInterpolationType.LINEAR);p.setSpatialAutoBezierAtKey(a,false);p.setSpatialContinuousAtKey(a,false);p.setSpatialTangentsAtKey(a,zero,zero);r.setInterpolationTypeAtKey(a,KeyframeInterpolationType.LINEAR,KeyframeInterpolationType.LINEAR);var v=p.keyValue(a);error=Math.max(error,Math.abs(v[0]-positions[a-1][0]),Math.abs(v[1]-positions[a-1][1]),Math.abs(r.keyValue(a)-angles[a-1]));}
 keys+=p.numKeys+r.numKeys;}
 if(error>.001)throw new Error('書き込み誤差が許容値を超えました');
 result.openInViewer();result.time=0;status.text='完了：'+result.name+' / '+keys+'キー';write(new File(job.fsName+'/complete.txt'),status.text+'\nmaxError='+error);
 }catch(e){if(result){result.remove();result=null;}status.text='エラー：'+e.toString();alert(e.toString());}
 finally{if(temp)temp.remove();app.endUndoGroup();run.enabled=true;refresh.enabled=true;toggle.enabled=true;comps.enabled=true;}
};
refreshComps();w.center();w.show();$.global.gravity1Mini=w;
})();
