export const GrovePlaces=[
 {id:'pond',title:'The pond',action:'Skip a pebble',x:745,y:270,radius:70,glyph:'pond',teaser:'A smooth stone and a stretch of still water.',note:'Three small skips. The rings meet, then the pond is still again.',caption:'Three skips, then quiet.'},
 {id:'bench',title:'The old bench',action:'Pause by the bench',x:210,y:445,radius:78,glyph:'bench',teaser:'The familiar bench at the end of the path.',note:'A worn wooden bench, a patch of afternoon light. A good place to leave a few thoughts.',caption:'The bench creaks. It remembers you.'},
 {id:'tree',title:'Under the leaves',action:'Listen to the leaves',x:395,y:120,radius:76,glyph:'leaf',teaser:'Somewhere between the trees and the breeze.',note:'A bird calls once. For a moment, every leaf seems to listen.',caption:'A breeze, and nothing that needs doing.'},
 {id:'flowers',title:'The daisy patch',action:'Watch the daisies',x:675,y:492,radius:74,glyph:'flower',teaser:'A few flowers growing where they please.',note:'The daisies lean toward the light. One small butterfly has nowhere else to be.',caption:'A few daisies leaning toward the light.'}
];
export const GroveMoments={
 read(raw){try{const value=JSON.parse(raw);if(!value||Array.isArray(value)||typeof value!=='object')return {};return Object.fromEntries(GrovePlaces.filter(p=>Number.isFinite(value[p.id])&&value[p.id]>0&&value[p.id]<=8640000000000000).map(p=>[p.id,value[p.id]]))}catch{return {}}},
 remember(notes,id,at){const clean=this.read(JSON.stringify(notes));if(GrovePlaces.some(p=>p.id===id)&&Number.isFinite(at)&&at>0&&at<=8640000000000000&&!clean[id])clean[id]=at;return clean},
 // A large first arc followed by two shorter skips, all in world coordinates.
 pebble(from,elapsed){const points=[from,{x:770,y:183},{x:812,y:175},{x:840,y:170}],durations=[650,300,230],heights=[52,22,12];let t=Math.max(0,elapsed),segment=0;while(segment<2&&t>=durations[segment])t-=durations[segment++];const progress=Math.min(1,t/durations[segment]),a=points[segment],b=points[segment+1];return {x:a.x+(b.x-a.x)*progress,y:a.y+(b.y-a.y)*progress-4*heights[segment]*progress*(1-progress),segment,progress,done:elapsed>=1180}},
 impact(index){return [{x:770,y:183},{x:812,y:175},{x:840,y:170}][index]}
};
