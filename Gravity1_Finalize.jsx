(function(){
app.beginUndoGroup('Gravity1 finalize sample');
try {
var result=null;
for(var i=app.project.numItems;i>=1;i--){
 var c=app.project.item(i);
 if(c instanceof CompItem && c.name==='Gravity1_Result_5s')c.remove();
 else if(c instanceof CompItem && c.name==='Gravity1_Result_5s_Verified')result=c;
}
if(!result)throw new Error('Verified comp missing');
result.openInViewer();result.time=1;
app.project.save(new File(File($.fileName).parent.fsName+'/Gravity1_Sample_Result.aep'));
alert('Gravity1: verified sample saved');
}catch(e){alert(e.toString());}finally{app.endUndoGroup();}
})();
