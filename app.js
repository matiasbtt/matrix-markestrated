'use strict';
const API='https://matrix-markestrated-api-20261023.matias-bellott.chatgpt.site/api';
const $=id=>document.getElementById(id);
const quizzes=[{id:1,range:'Páginas 1–20',topic:'El simulador y su mercado'},{id:2,range:'Páginas 21–41',topic:'Posicionamiento y decisiones'},{id:3,range:'Páginas 42–64',topic:'Estudios, anexos y aplicación'}];
let meta=null,chosen=1,completed=[],state=null,busy=false,tick=null,offset=0,pending=null;
const safeRead=k=>{try{return JSON.parse(localStorage.getItem(k));}catch{return null;}};
const safeWrite=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));}catch{/* GitHub remains the source of truth. */}};
const attemptKey=(p,q)=>`matrix-v2-${p}-${q}`;
async function request(action,{method='GET',body,token}={}){
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),25000);
 try{const response=await fetch(`${API}/${action}`,{method,headers:{...(body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:`Bearer ${token}`}:{})},body:body?JSON.stringify(body):undefined,signal:controller.signal});const data=await response.json();if(!response.ok)throw Error(data.error||'No se pudo conectar.');if(data.serverNow)offset=data.serverNow-Date.now();return data;}
 catch(e){if(e.name==='AbortError')throw Error('La conexión tardó demasiado. Reintenta para confirmar el guardado.');throw e;}finally{clearTimeout(timeout);}
}
function screen(id){['home','exam','result'].forEach(x=>$(x).hidden=x!==id);window.scrollTo(0,0);}
function cards(){
 $('quizzes').replaceChildren();
 for(const q of quizzes){const b=document.createElement('button');b.type='button';b.className='quiz-card';b.setAttribute('aria-pressed',String(chosen===q.id));const n=document.createElement('span');n.className='num';n.textContent=`Quiz ${q.id} · 10 preguntas`;const s=document.createElement('strong');s.textContent=q.range;const t=document.createElement('span');t.className='topic';t.textContent=q.topic;const status=document.createElement('span');status.className='status';status.textContent=completed.includes(q.id)?'✓ Completado':'Pendiente';b.append(n,s,t,status);b.onclick=()=>{chosen=q.id;cards();};$('quizzes').append(b);}
 const saved=safeRead(attemptKey($('person').value,chosen));$('start').textContent=`${saved&&!saved.complete?'Continuar':'Comenzar'} quiz ${chosen}`;$('start').disabled=!$('person').value||!meta?.configured||!meta?.open||busy;
}
async function progress(){completed=[];cards();const p=$('person').value;if(!p)return;safeWrite('matrix-person',p);$('progress').textContent='Consultando tus quizzes guardados…';try{const data=await request(`progress?participant=${encodeURIComponent(p)}`);if($('person').value!==p)return;completed=data.completed;$('progress').textContent=`Has completado ${completed.length} de 3 quizzes. En esta pantalla no corre el tiempo.`;}catch{$('progress').textContent='El guardado se comprueba al iniciar. En esta pantalla no corre el tiempo.';}cards();}
function stash(){if(state)safeWrite(attemptKey(state.participantId,state.quizId),{...state,pending});}
function showState(data){state=data;pending=null;busy=false;stash();$('failure').hidden=true;clearInterval(tick);if(state.complete){screen('result');$('result-name').textContent=`${state.name} · Quiz ${state.quizId}`;$('score').textContent=`${state.score} / ${state.total}`;return;}
 screen('exam');$('identity').textContent=`${state.name} · Quiz ${state.quizId}`;$('position').textContent=`Pregunta ${state.index+1} de ${state.total} · ${state.range}`;$('question').textContent=state.question.text;
 $('choices').replaceChildren();const legend=document.createElement('legend');legend.className='sr-only';legend.textContent='Elige una respuesta';$('choices').append(legend);
 state.question.options.forEach((text,i)=>{const l=document.createElement('label');l.className='choice';const r=document.createElement('input');r.type='radio';r.name='option';r.value=i;r.onchange=()=>{$('submit').disabled=busy;};const letter=document.createElement('span');letter.className='letter';letter.textContent=String.fromCharCode(65+i);const span=document.createElement('span');span.textContent=text;l.append(r,letter,span);$('choices').append(l);});
 $('choices').disabled=false;$('submit').disabled=true;$('sync').textContent='Selecciona una opción y pulsa Guardar y continuar.';tick=setInterval(countdown,100);countdown();
}
function countdown(){if(!state||state.complete)return;const left=Math.max(0,state.deadline-(Date.now()+offset));$('timer').textContent=`${Math.ceil(left/1000)} s`;$('timer').classList.toggle('urgent',left<=5000);$('fill').style.width=`${left/20000*100}%`;if(left===0&&!busy&&!pending)save(null);}
async function save(selected){if(busy)return;busy=true;clearInterval(tick);$('choices').disabled=true;$('submit').disabled=true;$('failure').hidden=true;$('sync').textContent='Guardando tu respuesta en GitHub…';if(!pending)pending={questionIndex:state.index,selected};stash();
 try{const data=await request('answer',{method:'POST',token:state.token,body:pending});showState(data);}catch(e){busy=false;$('sync').textContent='El guardado todavía no está confirmado.';$('error').textContent=e.message;$('failure').hidden=false;}
}
$('answer').onsubmit=e=>{e.preventDefault();const r=document.querySelector('input[name="option"]:checked');if(r&&!busy)save(Number(r.value));};$('retry').onclick=()=>save(pending?.selected??null);
$('person').onchange=progress;
$('start').onclick=async()=>{if(busy)return;busy=true;cards();$('availability').textContent='Preparando tu intento…';const p=$('person').value;let saved=safeRead(attemptKey(p,chosen));try{
 if(saved?.token&&!saved.complete){state=saved;pending=saved.pending||null;if(pending){screen('exam');$('identity').textContent=`${saved.name} · Quiz ${saved.quizId}`;busy=false;await save(pending.selected);return;}showState(await request('state',{token:saved.token}));}
 else{const id=saved&&!saved.token?saved.attemptId:crypto.randomUUID();safeWrite(attemptKey(p,chosen),{attemptId:id,complete:false});showState(await request('start',{method:'POST',body:{participantId:p,quizId:chosen,attemptId:id}}));}
 }catch(e){busy=false;$('availability').textContent=e.message;cards();}};
$('home-button').onclick=()=>{clearInterval(tick);state=null;pending=null;screen('home');progress();};
for(const p of window.MATRIX_ROSTER){const option=document.createElement('option');option.value=p.id;option.textContent=p.name;$('person').append(option);}
const previous=safeRead('matrix-person');if(window.MATRIX_ROSTER.some(p=>p.id===previous))$('person').value=previous;cards();
request('meta').then(data=>{meta=data;$('availability').textContent=!data.configured?'La web está en preparación. Matías está activando la recepción de respuestas.':!data.open?'El plazo para responder terminó.':'Todo listo. Cada respuesta se guardará en GitHub al continuar.';cards();if($('person').value&&meta.configured)progress();}).catch(()=>{$('availability').textContent='No se pudo conectar con el guardado. Recarga esta página en un momento.';});
