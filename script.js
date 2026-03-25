/* ============================================
   サイコロ・ウォーズ v1.2 - script.js
   ============================================ */

// ============ キャラカードデータ ============
const CHARACTERS = [
    {
        id:1, name:'ガルム', emoji:'🐺', hp:22, atk:3, def:2,
        dice:[{type:6,label:'6D'},{type:6,label:'6D'},{type:4,label:'4D'},{type:4,label:'4D'}],
        abilityDesc:'攻撃時、選択したサイコロに同じ出目がある場合、ダメージ+3。その同じ出目が4の場合、ダメージ+7。',
        abilityType:'attack',
        ability(sel){ let b=0,d=[]; const c={}; sel.forEach(s=>{c[s.value]=(c[s.value]||0)+1}); for(const[v,n]of Object.entries(c)){if(n>=2){if(+v===4){b+=7;d.push(`出目4のペア！ ダメージ+7`)}else{b+=3;d.push(`出目${v}のペア！ ダメージ+3`)}}} return{bonus:b,desc:d}; }
    },
    {
        id:2, name:'ホースラ', emoji:'🦊', hp:15, atk:3, def:3,
        dice:[{type:6,label:'6D'},{type:4,label:'4D'},{type:4,label:'4D'},{type:4,label:'4D'}],
        abilityDesc:'防御時、リロールチャンスを1回獲得する。また、防御時に選んだサイコロに同じ出目がある場合、ただちに相手に4の即時ダメージを与える。',
        abilityType:'defense', defenseReroll:1,
        ability(sel){ let id=0,d=[]; const c={}; sel.forEach(s=>{c[s.value]=(c[s.value]||0)+1}); for(const[,n]of Object.entries(c)){if(n>=2){id+=4;d.push(`防御時ペア発動！ 相手に即時4ダメージ！`)}} return{bonus:0,desc:d,instantDamage:id}; }
    },
    {
        id:3, name:'ジャスパー', emoji:'🦁', hp:25, atk:4, def:2,
        dice:[{type:4,label:'4D'},{type:4,label:'4D'},{type:4,label:'4D'},{type:4,label:'4D'},{type:4,label:'4D'}],
        abilityDesc:'攻撃時、選択したサイコロに同じ出目が3つある場合、ダメージ+7。同じ出目が1つ増えるたびに、ダメージがさらに+7。',
        abilityType:'attack',
        ability(sel){ let b=0,d=[]; const c={}; sel.forEach(s=>{c[s.value]=(c[s.value]||0)+1}); for(const[v,n]of Object.entries(c)){if(n>=3){const x=7*(n-2);b+=x;d.push(`出目${v}が${n}つ！ ダメージ+${x}`)}} return{bonus:b,desc:d}; }
    },
    {
        id:4, name:'クライシス', emoji:'🐉', hp:25, atk:3, def:2,
        dice:[{type:8,label:'8D'},{type:6,label:'6D'},{type:6,label:'6D'},{type:4,label:'4D'},{type:4,label:'4D'}],
        abilityDesc:'攻撃時、自身のHPが最大ではない場合、"イカサマ"が付与される。相手の防御サイコロの最大出目を2にする。',
        abilityType:'attack_special',
        ability(sel,hp,mhp){ let d=[]; const a=hp<mhp; if(a)d.push(`イカサマ発動！ 相手の最大防御出目を2に！`); return{bonus:0,desc:d,cheat:a}; }
    }
];

// ============ Game State ============
const GS = {
    mode:'cpu', currentScreen:'title',
    p1Char:null, p2Char:null, cpuOpponentChoice:null,
    turn:1, phase:'attack', p1IsAttacker:true,
    p1Hp:0, p1MaxHp:0, p2Hp:0, p2MaxHp:0,
    rolledDice:[], rolledDiceP2:[], rerollsLeft:2, rerollsLeftP2:2,
    hasRolled:false, maxSelections:0,
    attackerSelectedDice:[], defenderSelectedDice:[],
    currentActorIsHuman:true, activePlayer:1,
    animating:false,
};

const $=id=>document.getElementById(id);

const screens={title:$('title-screen'),deck:$('deck-screen'),battle:$('battle-screen')};
function showScreen(n){Object.values(screens).forEach(s=>s.classList.remove('active'));if(screens[n])screens[n].classList.add('active');GS.currentScreen=n;}

// ============ Title ============
$('btn-start-cpu').addEventListener('click',()=>{GS.mode='cpu';showDeckScreen();});
$('btn-start-multi').addEventListener('click',()=>{$('multi-mode-modal').classList.remove('hidden');});
$('btn-local-multi').addEventListener('click',()=>{$('multi-mode-modal').classList.add('hidden');GS.mode='multi';showDeckScreen();});

// Modals
$('btn-how-to-play').addEventListener('click',()=>$('howto-modal').classList.remove('hidden'));
$('btn-howto-battle').addEventListener('click',()=>$('howto-modal').classList.remove('hidden'));
$('btn-update-log').addEventListener('click',()=>$('update-log-modal').classList.remove('hidden'));
$('btn-about').addEventListener('click',()=>$('about-modal').classList.remove('hidden'));
$('btn-settings').addEventListener('click',()=>$('settings-modal').classList.remove('hidden'));
$('btn-quit-game').addEventListener('click',()=>{$('settings-modal').classList.add('hidden');$('quit-confirm-modal').classList.remove('hidden');});
$('btn-quit-cancel').addEventListener('click',()=>$('quit-confirm-modal').classList.add('hidden'));
$('btn-quit-confirm').addEventListener('click',()=>{$('quit-confirm-modal').classList.add('hidden');GS.p1Char=null;GS.p2Char=null;showScreen('title');});

document.querySelectorAll('.modal-close-btn').forEach(b=>{b.addEventListener('click',()=>{const id=b.dataset.close;if(id)$(id).classList.add('hidden');});});
document.querySelectorAll('.modal-overlay').forEach(o=>{o.addEventListener('click',e=>{if(e.target===o)o.classList.add('hidden');});});

// ============ Deck Screen ============
function showDeckScreen(){
    showScreen('deck');GS.p1Char=null;GS.p2Char=null;GS.cpuOpponentChoice=null;
    if(GS.mode==='cpu'){
        $('deck-title').textContent='デッキ選択 - VS CPU';
        $('deck-subtitle').textContent='自分と相手のキャラカードを選ぼう！';
        $('deck-player-label').textContent='自分のキャラカード';
        $('opponent-deck-section').classList.remove('hidden');
        $('p2-deck-section').classList.add('hidden');
        renderCards('char-cards-grid','p1');renderOpponentCards();
    } else {
        $('deck-title').textContent='デッキ選択 - マルチプレイ';
        $('deck-subtitle').textContent='1Pと2Pのキャラカードを選ぼう！';
        $('deck-player-label').textContent='1Pのキャラカード';
        $('opponent-deck-section').classList.add('hidden');
        $('p2-deck-section').classList.remove('hidden');
        renderCards('char-cards-grid','p1');renderCards('p2-cards-grid','p2');
    }
    $('btn-battle-start').disabled=true;hideDetail();
}

function renderCards(gridId,role){
    const g=$(gridId);g.innerHTML='';
    CHARACTERS.forEach(ch=>{
        const c=document.createElement('div');c.className='char-card';c.dataset.charId=ch.id;c.dataset.role=role;
        c.innerHTML=`<div class="char-emoji">${ch.emoji}</div><div class="char-card-name">${ch.name}</div><div class="char-card-stats"><span>❤️${ch.hp}</span><span>⚔️${ch.atk}</span><span>🛡️${ch.def}</span></div><div class="char-card-dice-preview">${ch.dice.map(d=>`<div class="mini-dice d${d.type}">${d.type}D</div>`).join('')}</div>`;
        c.addEventListener('click',()=>selectCard(ch.id,role,gridId));g.appendChild(c);
    });
}

function renderOpponentCards(){
    const g=$('opponent-cards-grid');g.innerHTML='';
    const rc=document.createElement('div');rc.className='char-card random-card';rc.dataset.charId='random';rc.dataset.role='cpu-opponent';
    rc.innerHTML=`<div class="char-emoji">❓</div><div class="char-card-name">ランダム</div><div class="char-card-stats"><span>おまかせ</span></div>`;
    rc.addEventListener('click',()=>selectCard('random','cpu-opponent','opponent-cards-grid'));g.appendChild(rc);
    CHARACTERS.forEach(ch=>{
        const c=document.createElement('div');c.className='char-card';c.dataset.charId=ch.id;c.dataset.role='cpu-opponent';
        c.innerHTML=`<div class="char-emoji">${ch.emoji}</div><div class="char-card-name">${ch.name}</div><div class="char-card-stats"><span>❤️${ch.hp}</span><span>⚔️${ch.atk}</span><span>🛡️${ch.def}</span></div><div class="char-card-dice-preview">${ch.dice.map(d=>`<div class="mini-dice d${d.type}">${d.type}D</div>`).join('')}</div>`;
        c.addEventListener('click',()=>selectCard(ch.id,'cpu-opponent','opponent-cards-grid'));g.appendChild(c);
    });
}

function selectCard(cid,role,gid){
    const g=$(gid);
    if(role==='p1'){
        if(GS.p1Char&&GS.p1Char.id===cid){GS.p1Char=null;g.querySelectorAll('.char-card').forEach(c=>c.classList.remove('selected'));hideDetail();checkReady();return;}
        GS.p1Char=CHARACTERS.find(c=>c.id===cid);g.querySelectorAll('.char-card').forEach(c=>c.classList.toggle('selected',+c.dataset.charId===cid));showDetail(GS.p1Char);
    } else if(role==='p2'){
        if(GS.p2Char&&GS.p2Char.id===cid){GS.p2Char=null;g.querySelectorAll('.char-card').forEach(c=>c.classList.remove('selected'));hideDetail();checkReady();return;}
        GS.p2Char=CHARACTERS.find(c=>c.id===cid);g.querySelectorAll('.char-card').forEach(c=>c.classList.toggle('selected',+c.dataset.charId===cid));showDetail(GS.p2Char);
    } else if(role==='cpu-opponent'){
        if(GS.cpuOpponentChoice===cid){GS.cpuOpponentChoice=null;GS.p2Char=null;g.querySelectorAll('.char-card').forEach(c=>c.classList.remove('selected'));hideDetail();checkReady();return;}
        GS.cpuOpponentChoice=cid;
        if(cid==='random')GS.p2Char=null; else {GS.p2Char=CHARACTERS.find(c=>c.id===cid);showDetail(GS.p2Char);}
        g.querySelectorAll('.char-card').forEach(c=>c.classList.toggle('selected',c.dataset.charId===String(cid)));
    }
    checkReady();
}
function checkReady(){$('btn-battle-start').disabled=GS.mode==='cpu'?!(GS.p1Char&&GS.cpuOpponentChoice!==null):!(GS.p1Char&&GS.p2Char);}
function showDetail(ch){if(!ch)return;$('detail-name').textContent=ch.name;$('detail-hp').textContent=ch.hp;$('detail-atk').textContent=ch.atk;$('detail-def').textContent=ch.def;$('detail-dice-list').innerHTML=ch.dice.map(d=>`<div class="mini-dice d${d.type}" style="width:24px;height:24px;font-size:10px;">${d.label}</div>`).join('');$('detail-ability-text').textContent=ch.abilityDesc;$('char-detail-panel').classList.remove('hidden');}
function hideDetail(){$('char-detail-panel').classList.add('hidden');}

$('btn-close-detail').addEventListener('click',hideDetail);
$('btn-detail-ok').addEventListener('click',hideDetail);
$('btn-back-title').addEventListener('click',()=>{GS.p1Char=null;GS.p2Char=null;hideDetail();showScreen('title');});
$('btn-battle-start').addEventListener('click',()=>{if(GS.mode==='cpu'&&!GS.p1Char)return;if(GS.mode==='multi'&&(!GS.p1Char||!GS.p2Char))return;hideDetail();startBattle();});

// ============ Battle ============
function startBattle(){
    if(GS.mode==='cpu'&&GS.cpuOpponentChoice==='random'){const a=CHARACTERS.filter(c=>c.id!==GS.p1Char.id);GS.p2Char=a[Math.floor(Math.random()*a.length)];}
    GS.p1Hp=GS.p1Char.hp;GS.p1MaxHp=GS.p1Char.hp;GS.p2Hp=GS.p2Char.hp;GS.p2MaxHp=GS.p2Char.hp;GS.turn=1;GS.animating=false;
    showScreen('battle');
    // Multi: show left panel, P2 dice area
    if(GS.mode==='multi'){$('action-panel-left').classList.remove('hidden');}else{$('action-panel-left').classList.add('hidden');}
    updateBattleUI();showCoinFlip();
}

function atkChar(){return GS.p1IsAttacker?GS.p1Char:GS.p2Char;}
function defChar(){return GS.p1IsAttacker?GS.p2Char:GS.p1Char;}

function updateBattleUI(){
    $('player-portrait').textContent=GS.p1Char.emoji;
    $('player-name').textContent=GS.mode==='multi'?`1P: ${GS.p1Char.name}`:GS.p1Char.name;
    $('player-hp-text').textContent=`${GS.p1Hp}/${GS.p1MaxHp}`;
    $('player-hp-bar').style.width=`${(GS.p1Hp/GS.p1MaxHp)*100}%`;
    $('player-atk').textContent=`⚔️${GS.p1Char.atk}`;
    $('player-def').textContent=`🛡️${GS.p1Char.def}`;
    $('player-ability-text-battle').textContent=GS.p1Char.abilityDesc;
    $('opponent-portrait').textContent=GS.p2Char.emoji;
    $('opponent-name').textContent=GS.mode==='cpu'?`CPU: ${GS.p2Char.name}`:`2P: ${GS.p2Char.name}`;
    $('opponent-hp-text').textContent=`${GS.p2Hp}/${GS.p2MaxHp}`;
    $('opponent-hp-bar').style.width=`${(GS.p2Hp/GS.p2MaxHp)*100}%`;
    $('opponent-atk').textContent=`⚔️${GS.p2Char.atk}`;
    $('opponent-def').textContent=`🛡️${GS.p2Char.def}`;
    $('opponent-ability-text-battle').textContent=GS.p2Char.abilityDesc;
    hpColor('player-hp-bar',GS.p1Hp,GS.p1MaxHp);hpColor('opponent-hp-bar',GS.p2Hp,GS.p2MaxHp);
}

function hpColor(id,hp,mx){const r=hp/mx;$(id).style.background=r>.5?'linear-gradient(90deg,#22C55E,#4ADE80)':r>.25?'linear-gradient(90deg,#F59E0B,#FBBF24)':'linear-gradient(90deg,#EF4444,#F87171)';}

function setPhaseGlow(){
    const pi=$('player-info-card'),oi=$('opponent-info-card');
    pi.classList.remove('phase-atk','phase-def');oi.classList.remove('phase-atk','phase-def');
    if(GS.phase==='attack'){
        if(GS.p1IsAttacker){pi.classList.add('phase-atk');oi.classList.add('phase-def');}
        else{oi.classList.add('phase-atk');pi.classList.add('phase-def');}
    } else {
        if(GS.p1IsAttacker){oi.classList.add('phase-def');pi.classList.add('phase-atk');}
        else{pi.classList.add('phase-def');oi.classList.add('phase-atk');}
    }
}

// ============ Coin ============
function showCoinFlip(){
    $('coin-overlay').classList.remove('hidden');$('coin-result').textContent='';$('btn-coin-ok').classList.add('hidden');
    GS.p1IsAttacker=Math.random()<.5;
    setTimeout(()=>{
        $('coin-result').textContent=GS.mode==='cpu'?(GS.p1IsAttacker?'あなたは先攻（攻撃側）！':'あなたは後攻（防御側）！'):(GS.p1IsAttacker?'1Pが先攻（攻撃側）！':'2Pが先攻（攻撃側）！');
        $('coin-result').style.color=GS.p1IsAttacker?'#FF3366':'#3366FF';
        $('btn-coin-ok').classList.remove('hidden');
    },1800);
}
$('btn-coin-ok').addEventListener('click',()=>{$('coin-overlay').classList.add('hidden');startTurn();});

// ============ Turn ============
function startTurn(){
    GS.phase='attack';GS.attackerSelectedDice=[];GS.defenderSelectedDice=[];
    clearDamageDisplay();
    showTurnStart(()=>startAttackPhase());
}

function showTurnStart(cb){
    const o=$('turn-start-overlay');o.classList.remove('hidden');
    $('turn-start-number').textContent=`ターン ${GS.turn}`;
    const r=$('turn-start-role');
    if(GS.mode==='cpu'){r.textContent=GS.p1IsAttacker?'あなたの攻撃！':'あなたの防御！';r.className='turn-start-role '+(GS.p1IsAttacker?'atk-role':'def-role');}
    else{r.textContent=(GS.p1IsAttacker?'1P':'2P')+'の攻撃！';r.className='turn-start-role atk-role';}
    setTimeout(()=>{o.classList.add('hidden');if(cb)cb();},1500);
}

// ============ Attack Phase ============
function startAttackPhase(){
    GS.phase='attack';updatePhaseUI();setPhaseGlow();
    const ac=atkChar();GS.maxSelections=ac.atk;
    if(GS.mode==='cpu'){
        if(GS.p1IsAttacker) setupP1Dice(ac,true);
        else cpuPhase(ac,'attack');
    } else {
        // Multi: attacker plays
        if(GS.p1IsAttacker) setupP1Dice(ac,true);
        else setupP2Dice(ac,true);
    }
}

function startDefensePhase(){
    GS.phase='defense';updatePhaseUI();setPhaseGlow();
    const dc=defChar();GS.maxSelections=dc.def;
    if(GS.mode==='cpu'){
        if(!GS.p1IsAttacker){const er=dc.defenseReroll||0;setupP1Dice(dc,false,er);}
        else cpuPhase(dc,'defense');
    } else {
        const er=dc.defenseReroll||0;
        if(GS.p1IsAttacker) setupP2Dice(dc,false,er);
        else setupP1Dice(dc,false,er);
    }
}

function updatePhaseUI(){
    $('turn-number').textContent=`ターン${GS.turn}`;
    const p=$('phase-label');
    p.textContent=GS.phase==='attack'?'攻撃フェーズ':'防御フェーズ';
    p.className='phase-label '+(GS.phase==='attack'?'atk-phase':'def-phase');
    resetCenter();
}

function resetCenter(){
    const t=$('selection-total-value');t.textContent='0';t.className='selection-total-value';
    $('selection-total-display').classList.remove('hidden');
    $('damage-inline').classList.add('hidden');
    $('dmg-result-display').classList.add('hidden');
    hideAbility();
}

function clearDamageDisplay(){
    $('damage-inline').classList.add('hidden');
    $('dmg-result-display').classList.add('hidden');
    $('selection-total-display').classList.remove('hidden');
    hideAbility();
}

// ============ P1 Dice (bottom) ============
function setupP1Dice(ch,isAtk,extraRerolls=0){
    GS.rerollsLeft=isAtk?2:extraRerolls;GS.hasRolled=true;GS.activePlayer=1;
    GS.rolledDice=ch.dice.map((d,i)=>({type:d.type,value:Math.floor(Math.random()*d.type)+1,index:i,selected:false}));
    renderP1Dice(true);updateP1Buttons();updateP1SelectionUI();
    $('action-panel-right').classList.remove('hidden');
    if(GS.mode==='multi')$('action-panel-left').classList.remove('hidden');
}

function renderP1Dice(anim=false){
    const t=$('dice-tray');t.innerHTML='';
    GS.rolledDice.forEach((d,i)=>{
        const e=document.createElement('div');e.className=`dice d${d.type}`;
        if(d.selected)e.classList.add('selected');if(anim)e.classList.add('rolling');
        e.textContent=d.value;e.style.animationDelay=`${i*.1}s`;
        e.addEventListener('click',()=>onP1Click(i));t.appendChild(e);
    });
}

function onP1Click(i){
    if(!GS.hasRolled||GS.animating||GS.activePlayer!==1)return;
    const d=GS.rolledDice[i];
    if(d.selected)d.selected=false;
    else{const n=GS.rolledDice.filter(x=>x.selected).length;if(n>=GS.rolledDice.length)return;d.selected=true;}
    renderP1Dice();updateP1SelectionUI();updateP1Buttons();
}

function updateP1SelectionUI(){
    const sc=GS.rolledDice.filter(d=>d.selected).length;
    const st=GS.rolledDice.filter(d=>d.selected).reduce((s,d)=>s+d.value,0);
    $('selection-count').textContent=`${sc}/${GS.maxSelections}`;
    const tv=$('selection-total-value');tv.textContent=st;
    if(sc>0){tv.classList.add('has-value');tv.classList.toggle('atk-active',GS.phase==='attack');tv.classList.toggle('def-active',GS.phase==='defense');}
    else tv.className='selection-total-value';
    $('reroll-count').textContent=`${GS.rerollsLeft}/2`;
}

function updateP1Buttons(){
    const sc=GS.rolledDice.filter(d=>d.selected).length;
    $('btn-confirm').disabled=sc!==GS.maxSelections;
    $('btn-confirm').querySelector('.circle-label').textContent=`${sc}/${GS.maxSelections} OK`;
    $('btn-reroll').disabled=!(GS.rerollsLeft>0&&sc>0);
}

$('btn-reroll').addEventListener('click',()=>{
    if(GS.rerollsLeft<=0||GS.activePlayer!==1)return;
    const sel=GS.rolledDice.filter(d=>d.selected);if(!sel.length)return;
    sel.forEach(d=>{d.value=Math.floor(Math.random()*d.type)+1;d.selected=false;});
    GS.rerollsLeft--;renderP1Dice(true);updateP1SelectionUI();updateP1Buttons();
});

$('btn-confirm').addEventListener('click',()=>{
    if(GS.activePlayer!==1)return;
    const sel=GS.rolledDice.filter(d=>d.selected);if(sel.length!==GS.maxSelections)return;
    if(GS.phase==='attack'){GS.attackerSelectedDice=sel.map(d=>({type:d.type,value:d.value}));startDefensePhase();}
    else{GS.defenderSelectedDice=sel.map(d=>({type:d.type,value:d.value}));startDamageCalc();}
});

// ============ P2 Dice (top, multi only) ============
function setupP2Dice(ch,isAtk,extraRerolls=0){
    GS.rerollsLeftP2=isAtk?2:extraRerolls;GS.hasRolled=true;GS.activePlayer=2;
    GS.rolledDiceP2=ch.dice.map((d,i)=>({type:d.type,value:Math.floor(Math.random()*d.type)+1,index:i,selected:false}));
    renderP2Dice(true);updateP2Buttons();updateP2SelectionUI();
    $('action-panel-left').classList.remove('hidden');
    $('action-panel-right').classList.remove('hidden');
}

function renderP2Dice(anim=false){
    const t=$('opponent-dice-tray');t.innerHTML='';
    GS.rolledDiceP2.forEach((d,i)=>{
        const e=document.createElement('div');e.className=`dice d${d.type}`;
        if(d.selected)e.classList.add('selected');if(anim)e.classList.add('rolling');
        e.textContent=d.value;e.style.animationDelay=`${i*.1}s`;
        e.addEventListener('click',()=>onP2Click(i));t.appendChild(e);
    });
}

function onP2Click(i){
    if(!GS.hasRolled||GS.animating||GS.activePlayer!==2)return;
    const d=GS.rolledDiceP2[i];
    if(d.selected)d.selected=false;
    else{const n=GS.rolledDiceP2.filter(x=>x.selected).length;if(n>=GS.rolledDiceP2.length)return;d.selected=true;}
    renderP2Dice();updateP2SelectionUI();updateP2Buttons();
}

function updateP2SelectionUI(){
    const sc=GS.rolledDiceP2.filter(d=>d.selected).length;
    const st=GS.rolledDiceP2.filter(d=>d.selected).reduce((s,d)=>s+d.value,0);
    $('selection-count-p2').textContent=`${sc}/${GS.maxSelections}`;
    const tv=$('selection-total-value');tv.textContent=st;
    if(sc>0){tv.classList.add('has-value');tv.classList.toggle('atk-active',GS.phase==='attack');tv.classList.toggle('def-active',GS.phase==='defense');}
    else tv.className='selection-total-value';
    $('reroll-count-p2').textContent=`${GS.rerollsLeftP2}/2`;
}

function updateP2Buttons(){
    const sc=GS.rolledDiceP2.filter(d=>d.selected).length;
    $('btn-confirm-p2').disabled=sc!==GS.maxSelections;
    $('btn-confirm-p2').querySelector('.circle-label').textContent=`${sc}/${GS.maxSelections} OK`;
    $('btn-reroll-p2').disabled=!(GS.rerollsLeftP2>0&&sc>0);
}

$('btn-reroll-p2').addEventListener('click',()=>{
    if(GS.rerollsLeftP2<=0||GS.activePlayer!==2)return;
    const sel=GS.rolledDiceP2.filter(d=>d.selected);if(!sel.length)return;
    sel.forEach(d=>{d.value=Math.floor(Math.random()*d.type)+1;d.selected=false;});
    GS.rerollsLeftP2--;renderP2Dice(true);updateP2SelectionUI();updateP2Buttons();
});

$('btn-confirm-p2').addEventListener('click',()=>{
    if(GS.activePlayer!==2)return;
    const sel=GS.rolledDiceP2.filter(d=>d.selected);if(sel.length!==GS.maxSelections)return;
    if(GS.phase==='attack'){GS.attackerSelectedDice=sel.map(d=>({type:d.type,value:d.value}));startDefensePhase();}
    else{GS.defenderSelectedDice=sel.map(d=>({type:d.type,value:d.value}));startDamageCalc();}
});

// ============ CPU Phase (visible dice + animated selection) ============
function cpuPhase(ch,type){
    GS.currentActorIsHuman=false;GS.animating=true;
    const isAtk=type==='attack';
    const maxSel=isAtk?ch.atk:ch.def;
    // Roll dice visibly in opponent area
    const dice=ch.dice.map((d,i)=>({type:d.type,value:Math.floor(Math.random()*d.type)+1,index:i,selected:false}));
    // Reroll logic
    const rerolls=isAtk?2:(ch.defenseReroll||0);
    for(let r=0;r<rerolls;r++){let rr=false;dice.forEach(d=>{if(d.value<(d.type+1)/2*.7){d.value=Math.floor(Math.random()*d.type)+1;rr=true;}});if(!rr)break;}
    // Render all dice
    renderCpuAllDice(dice,true);
    // Update center to 0
    const tv=$('selection-total-value');tv.textContent='0';tv.className='selection-total-value';

    // After roll anim, select dice one by one slowly
    const sorted=[...dice].sort((a,b)=>b.value-a.value);
    const toSelect=sorted.slice(0,maxSel);
    let selIdx=0;let runningTotal=0;

    setTimeout(()=>{
        renderCpuAllDice(dice,false);
        function selectNext(){
            if(selIdx>=toSelect.length){
                // Done
                const selected=toSelect.map(d=>({type:d.type,value:d.value}));
                if(isAtk)GS.attackerSelectedDice=selected;else GS.defenderSelectedDice=selected;
                GS.currentActorIsHuman=true;GS.animating=false;
                setTimeout(()=>{if(isAtk)startDefensePhase();else startDamageCalc();},600);
                return;
            }
            const d=toSelect[selIdx];d.selected=true;
            runningTotal+=d.value;
            // Animate selection
            renderCpuAllDice(dice,false);
            // Update center
            tv.textContent=runningTotal;
            tv.classList.add('has-value');
            tv.classList.toggle('atk-active',isAtk);
            tv.classList.toggle('def-active',!isAtk);
            selIdx++;
            setTimeout(selectNext,700);
        }
        setTimeout(selectNext,400);
    },800);
}

function renderCpuAllDice(dice,anim){
    const t=$('opponent-dice-tray');t.innerHTML='';
    dice.forEach((d,i)=>{
        const e=document.createElement('div');e.className=`dice d${d.type}`;
        if(d.selected)e.classList.add('cpu-selecting');
        if(anim)e.classList.add('rolling');
        e.textContent=d.value;e.style.animationDelay=`${i*.1}s`;
        t.appendChild(e);
    });
}

// ============ Damage Calc (inline animated) ============
function startDamageCalc(){
    GS.animating=true;
    const ac=atkChar(),dc=defChar();
    let atkTotal=GS.attackerSelectedDice.reduce((s,d)=>s+d.value,0);
    let defTotal=GS.defenderSelectedDice.reduce((s,d)=>s+d.value,0);
    let atkBonus=0,abilDescs=[],instantDmg=0;

    // Attacker ability
    if(ac.abilityType==='attack'){const r=ac.ability(GS.attackerSelectedDice);atkBonus+=r.bonus;abilDescs.push(...r.desc);}
    else if(ac.abilityType==='attack_special'){
        const hp=GS.p1IsAttacker?GS.p1Hp:GS.p2Hp,mhp=GS.p1IsAttacker?GS.p1MaxHp:GS.p2MaxHp;
        const r=ac.ability(GS.attackerSelectedDice,hp,mhp);abilDescs.push(...r.desc);
        if(r.cheat&&GS.defenderSelectedDice.length>0){
            let mi=0,mv=0;GS.defenderSelectedDice.forEach((d,i)=>{if(d.value>mv){mv=d.value;mi=i;}});
            const ov=GS.defenderSelectedDice[mi].value;GS.defenderSelectedDice[mi].value=2;
            defTotal=GS.defenderSelectedDice.reduce((s,d)=>s+d.value,0);
            abilDescs.push(`防御出目 ${ov} → 2 に変更！`);
        }
    }
    // Defender ability
    if(dc.abilityType==='defense'){const r=dc.ability(GS.defenderSelectedDice);if(r.instantDamage){instantDmg=r.instantDamage;abilDescs.push(...r.desc);}}

    const totalAtk=atkTotal+atkBonus;
    const dmg=Math.max(0,totalAtk-defTotal);

    // Inline damage animation sequence
    showInlineDamage(totalAtk,atkBonus,defTotal,dmg,abilDescs,instantDmg);
}

function showInlineDamage(totalAtk,atkBonus,defTotal,dmg,abilDescs,instantDmg){
    // Hide center total, show damage inline
    $('selection-total-display').classList.add('hidden');
    const di=$('damage-inline');
    const dr=$('dmg-result-display');
    di.classList.remove('hidden');dr.classList.add('hidden');

    const atkValEl=$('dmg-atk-val');
    const defValEl=$('dmg-def-val');
    const clashEl=$('dmg-clash');
    const atkSide=$('dmg-atk-side');
    const defSide=$('dmg-def-side');

    // Reset
    atkValEl.textContent='?';defValEl.textContent='?';
    atkSide.classList.remove('dmg-pop');defSide.classList.remove('dmg-pop');
    clashEl.classList.remove('clash-active');clashEl.textContent='VS';

    // Step 1: Show ATK value
    setTimeout(()=>{
        atkValEl.textContent=totalAtk-atkBonus;
        atkSide.classList.add('dmg-pop');
    },400);

    // Step 2: Ability activation
    let step2Delay=1200;
    if(abilDescs.length>0){
        setTimeout(()=>{showAbility(abilDescs.join('\n'));},step2Delay);
        if(atkBonus>0){
            setTimeout(()=>{
                atkValEl.textContent=`${totalAtk-atkBonus}+${atkBonus}`;
                setTimeout(()=>{atkValEl.textContent=totalAtk;},800);
            },step2Delay+600);
        }
        step2Delay+=2000;
    }

    // Step 3: Show DEF value
    setTimeout(()=>{
        hideAbility();
        defValEl.textContent=defTotal;
        defSide.classList.add('dmg-pop');
    },step2Delay);

    // Step 4: Clash!
    setTimeout(()=>{
        clashEl.textContent='⚡';
        clashEl.classList.add('clash-active');
        // Screen shake
        const bs=$('battle-screen');bs.classList.add('screen-shake');
        setTimeout(()=>bs.classList.remove('screen-shake'),400);
        // Sparks
        createSparks();
    },step2Delay+800);

    // Step 5: Result
    setTimeout(()=>{
        di.classList.add('hidden');
        dr.classList.remove('hidden');
        const rv=$('dmg-result-value');
        if(dmg>0){
            rv.textContent=`💥 ${dmg} ダメージ！`;rv.style.color='#FF6B6B';
        } else {
            rv.textContent='🛡️ ダメージ無効！';rv.style.color='#6B9BFF';
        }
        if(instantDmg>0){
            rv.textContent+=`\n⚡ 即時${instantDmg}ダメージ！`;
        }
    },step2Delay+1600);

    // Step 6: Apply damage
    setTimeout(()=>{
        applyDamage(dmg,instantDmg);
    },step2Delay+3000);
}

function createSparks(){
    const center=$('battle-center');
    const rect=center.getBoundingClientRect();
    for(let i=0;i<16;i++){
        const s=document.createElement('div');s.className='spark';
        const cx=rect.width/2,cy=rect.height/2;
        const angle=Math.random()*Math.PI*2;
        const dist=40+Math.random()*60;
        const dx=Math.cos(angle)*dist,dy=Math.sin(angle)*dist;
        const colors=['#FFD700','#FF3366','#3366FF','#FF6B6B','#FFFFFF'];
        s.style.cssText=`left:${cx}px;top:${cy}px;width:${3+Math.random()*4}px;height:${3+Math.random()*4}px;background:${colors[Math.floor(Math.random()*colors.length)]};`;
        s.style.animation=`sparkFly${i} ${.4+Math.random()*.4}s ease-out forwards`;
        center.appendChild(s);
        const style=document.createElement('style');
        style.textContent=`@keyframes sparkFly${i}{0%{transform:translate(0,0) scale(1);opacity:1}100%{transform:translate(${dx}px,${dy}px) scale(0);opacity:0}}`;
        document.head.appendChild(style);
        setTimeout(()=>s.remove(),1000);
    }
}

function applyDamage(dmg,instantDmg){
    if(GS.p1IsAttacker){
        GS.p2Hp=Math.max(0,GS.p2Hp-dmg);
        if(instantDmg>0)GS.p1Hp=Math.max(0,GS.p1Hp-instantDmg);
    } else {
        GS.p1Hp=Math.max(0,GS.p1Hp-dmg);
        if(instantDmg>0)GS.p2Hp=Math.max(0,GS.p2Hp-instantDmg);
    }
    updateBattleUI();
    if(dmg>0){const ta=GS.p1IsAttacker?$('opponent-area'):$('player-area');ta.classList.add('shake');setTimeout(()=>ta.classList.remove('shake'),500);}
    GS.animating=false;
    if(GS.p1Hp<=0||GS.p2Hp<=0){setTimeout(()=>showResult(),800);return;}
    setTimeout(()=>{
        clearDamageDisplay();
        $('opponent-dice-tray').innerHTML='';$('dice-tray').innerHTML='';
        GS.p1IsAttacker=!GS.p1IsAttacker;GS.turn++;startTurn();
    },1200);
}

// ============ Ability ============
function showAbility(t){$('ability-text').textContent=t;$('ability-notification').classList.remove('hidden');$('ability-notification').style.display='block';}
function hideAbility(){$('ability-notification').classList.add('hidden');$('ability-notification').style.display='';}

// ============ Result ============
function showResult(){
    $('result-overlay').classList.remove('hidden');
    const p1W=GS.p2Hp<=0;const t=$('result-title'),d=$('result-detail');
    if(GS.mode==='cpu'){
        t.textContent=p1W?'YOU WIN!':'YOU LOSE...';t.className='result-title '+(p1W?'win':'lose');
        d.textContent=p1W?`${GS.p1Char.name} の勝利！ ${GS.turn}ターンで決着！`:`CPU ${GS.p2Char.name} に敗北... ${GS.turn}ターン。`;
    } else {
        t.textContent=p1W?'1P WIN!':'2P WIN!';t.className='result-title win';
        d.textContent=p1W?`1P ${GS.p1Char.name} の勝利！`:`2P ${GS.p2Char.name} の勝利！`;
    }
    createParticles(p1W||GS.mode==='multi');
}

function createParticles(w){
    const c=$('result-particles');c.innerHTML='';
    const cols=w?['#FFD700','#FFA500','#FF6B6B','#FF3366','#FFFFFF']:['#6B6890','#4A4870'];
    for(let i=0;i<30;i++){
        const p=document.createElement('div');
        const dx=(Math.random()-.5)*200,dy=(Math.random()-.5)*200;
        p.style.cssText=`position:absolute;width:${Math.random()*6+3}px;height:${Math.random()*6+3}px;background:${cols[Math.floor(Math.random()*cols.length)]};border-radius:${Math.random()>.5?'50%':'2px'};left:${Math.random()*100}%;top:${Math.random()*100}%;opacity:0;animation:pf${i} ${Math.random()*2+1}s ease-out ${Math.random()*.5}s forwards;`;
        c.appendChild(p);
        const st=document.createElement('style');
        st.textContent=`@keyframes pf${i}{0%{transform:translate(0,0) scale(0);opacity:0}20%{opacity:1}100%{transform:translate(${dx}px,${dy}px) scale(1.5);opacity:0}}`;
        document.head.appendChild(st);
    }
}

$('btn-rematch').addEventListener('click',()=>{$('result-overlay').classList.add('hidden');startBattle();});
$('btn-to-title').addEventListener('click',()=>{$('result-overlay').classList.add('hidden');GS.p1Char=null;GS.p2Char=null;showScreen('title');});

// Init
GS.currentActorIsHuman=true;showScreen('title');
