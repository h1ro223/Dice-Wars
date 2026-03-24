/* ============================================
   サイコロ・ウォーズ v1.2 - script.js
   ============================================ */

const CHARACTERS = [
    { id:1, name:'ガルム', emoji:'🐺', hp:22, atk:3, def:2,
      dice:[{type:6,label:'6D'},{type:6,label:'6D'},{type:4,label:'4D'},{type:4,label:'4D'}],
      abilityDesc:'攻撃時、選択したサイコロに同じ出目がある場合、ダメージ+3。その同じ出目が4の場合、ダメージ+7。',
      abilityType:'attack',
      ability(sel){ let b=0,d=[]; const c={}; sel.forEach(s=>{c[s.value]=(c[s.value]||0)+1}); for(const[v,n]of Object.entries(c)){if(n>=2){if(+v===4){b+=7;d.push(`出目4のペア！ ダメージ+7`)}else{b+=3;d.push(`出目${v}のペア！ ダメージ+3`)}}} return{bonus:b,desc:d} }
    },
    { id:2, name:'ホースラ', emoji:'🦊', hp:15, atk:3, def:3,
      dice:[{type:6,label:'6D'},{type:4,label:'4D'},{type:4,label:'4D'},{type:4,label:'4D'}],
      abilityDesc:'防御時、リロールチャンスを1回獲得。防御時ペアで相手に即時4ダメージ。',
      abilityType:'defense', defenseReroll:1,
      ability(sel){ let id=0,d=[]; const c={}; sel.forEach(s=>{c[s.value]=(c[s.value]||0)+1}); for(const[,n]of Object.entries(c)){if(n>=2){id+=4;d.push(`防御時ペア発動！ 相手に即時4ダメージ！`)}} return{bonus:0,desc:d,instantDamage:id} }
    },
    { id:3, name:'ジャスパー', emoji:'🦁', hp:25, atk:4, def:2,
      dice:[{type:4,label:'4D'},{type:4,label:'4D'},{type:4,label:'4D'},{type:4,label:'4D'},{type:4,label:'4D'}],
      abilityDesc:'攻撃時、同じ出目3つでダメージ+7。1つ増えるごとにさらに+7。',
      abilityType:'attack',
      ability(sel){ let b=0,d=[]; const c={}; sel.forEach(s=>{c[s.value]=(c[s.value]||0)+1}); for(const[v,n]of Object.entries(c)){if(n>=3){const x=7*(n-2);b+=x;d.push(`出目${v}が${n}つ！ ダメージ+${x}`)}} return{bonus:b,desc:d} }
    },
    { id:4, name:'クライシス', emoji:'🐉', hp:25, atk:3, def:2,
      dice:[{type:8,label:'8D'},{type:6,label:'6D'},{type:6,label:'6D'},{type:4,label:'4D'},{type:4,label:'4D'}],
      abilityDesc:'攻撃時、HP非最大なら"イカサマ"発動。相手防御の最大出目を2に。',
      abilityType:'attack_special',
      ability(sel,hp,max){ let d=[]; const a=hp<max; if(a)d.push(`イカサマ発動！ 相手の最大防御出目を2に！`); return{bonus:0,desc:d,cheat:a} }
    }
];

const GS = {
    mode:'cpu', currentScreen:'title',
    p1Char:null, p2Char:null, cpuOpponentChoice:null,
    turn:1, phase:'attack', p1IsAttacker:true,
    p1Hp:0, p1MaxHp:0, p2Hp:0, p2MaxHp:0,
    rolledDice:[], rolledDiceTop:[], // top = 2P/CPU dice
    rerollsLeft:2, rerollsLeftP2:2,
    hasRolled:false, maxSelections:0,
    attackerSelectedDice:[], defenderSelectedDice:[],
    currentActorIsHuman:true,
    activePanel:'right', // 'right'=1P, 'left'=2P
};

const $=id=>document.getElementById(id);
const screens={title:$('title-screen'),deck:$('deck-screen'),battle:$('battle-screen')};
function showScreen(n){Object.values(screens).forEach(s=>s.classList.remove('active'));if(screens[n])screens[n].classList.add('active');GS.currentScreen=n}

// ============ タイトル ============
$('btn-start-cpu').onclick=()=>{GS.mode='cpu';showDeckScreen()};
$('btn-start-multi').onclick=()=>{GS.mode='multi';showDeckScreen()};
$('btn-how-to-play-title').onclick=()=>$('howto-modal').classList.remove('hidden');
$('btn-howto-battle').onclick=()=>$('howto-modal').classList.remove('hidden');
$('btn-update-log').onclick=()=>$('update-log-modal').classList.remove('hidden');
$('btn-about').onclick=()=>$('about-modal').classList.remove('hidden');
document.querySelectorAll('.modal-close-btn').forEach(b=>{b.onclick=()=>{const id=b.dataset.close;if(id)$(id).classList.add('hidden')}});
document.querySelectorAll('.modal-overlay').forEach(o=>{o.onclick=e=>{if(e.target===o)o.classList.add('hidden')}});

// ============ デッキ選択 ============
function showDeckScreen(){
    showScreen('deck'); GS.p1Char=null; GS.p2Char=null; GS.cpuOpponentChoice=null;
    if(GS.mode==='cpu'){
        $('deck-title').textContent='デッキ選択 - VS CPU';
        $('deck-subtitle').textContent='自分と相手のキャラカードを選ぼう！';
        $('deck-player-label').textContent='自分のキャラカード';
        $('opponent-deck-section').classList.remove('hidden');
        $('p2-deck-section').classList.add('hidden');
        renderCards('char-cards-grid','p1'); renderOpponentCards();
    } else {
        $('deck-title').textContent='デッキ選択 - マルチプレイ';
        $('deck-subtitle').textContent='1Pと2Pのキャラカードを選ぼう！';
        $('deck-player-label').textContent='1Pのキャラカード';
        $('opponent-deck-section').classList.add('hidden');
        $('p2-deck-section').classList.remove('hidden');
        renderCards('char-cards-grid','p1'); renderCards('p2-cards-grid','p2');
    }
    $('btn-battle-start').disabled=true; hideDetail();
}

function renderCards(gid,role){
    const g=$(gid); g.innerHTML='';
    CHARACTERS.forEach(ch=>{
        const c=document.createElement('div'); c.className='char-card'; c.dataset.charId=ch.id; c.dataset.role=role;
        c.innerHTML=`<div class="char-emoji">${ch.emoji}</div><div class="char-card-name">${ch.name}</div><div class="char-card-stats"><span>❤️${ch.hp}</span><span>⚔️${ch.atk}</span><span>🛡️${ch.def}</span></div><div class="char-card-dice-preview">${ch.dice.map(d=>`<div class="mini-dice d${d.type}">${d.type}D</div>`).join('')}</div>`;
        c.onclick=()=>selectCard(ch.id,role,gid); g.appendChild(c);
    });
}
function renderOpponentCards(){
    const g=$('opponent-cards-grid'); g.innerHTML='';
    const rc=document.createElement('div'); rc.className='char-card random-card'; rc.dataset.charId='random'; rc.dataset.role='cpu-opponent';
    rc.innerHTML=`<div class="char-emoji">❓</div><div class="char-card-name">ランダム</div><div class="char-card-stats"><span>おまかせ</span></div>`;
    rc.onclick=()=>selectCard('random','cpu-opponent','opponent-cards-grid'); g.appendChild(rc);
    CHARACTERS.forEach(ch=>{
        const c=document.createElement('div'); c.className='char-card'; c.dataset.charId=ch.id; c.dataset.role='cpu-opponent';
        c.innerHTML=`<div class="char-emoji">${ch.emoji}</div><div class="char-card-name">${ch.name}</div><div class="char-card-stats"><span>❤️${ch.hp}</span><span>⚔️${ch.atk}</span><span>🛡️${ch.def}</span></div><div class="char-card-dice-preview">${ch.dice.map(d=>`<div class="mini-dice d${d.type}">${d.type}D</div>`).join('')}</div>`;
        c.onclick=()=>selectCard(ch.id,'cpu-opponent','opponent-cards-grid'); g.appendChild(c);
    });
}

function selectCard(cid,role,gid){
    const g=$(gid);
    if(role==='p1'){
        if(GS.p1Char&&GS.p1Char.id===cid){GS.p1Char=null;g.querySelectorAll('.char-card').forEach(c=>c.classList.remove('selected'));hideDetail();checkReady();return}
        GS.p1Char=CHARACTERS.find(c=>c.id===cid);
        g.querySelectorAll('.char-card').forEach(c=>c.classList.toggle('selected',+c.dataset.charId===cid)); showDetail(GS.p1Char);
    } else if(role==='p2'){
        if(GS.p2Char&&GS.p2Char.id===cid){GS.p2Char=null;g.querySelectorAll('.char-card').forEach(c=>c.classList.remove('selected'));hideDetail();checkReady();return}
        GS.p2Char=CHARACTERS.find(c=>c.id===cid);
        g.querySelectorAll('.char-card').forEach(c=>c.classList.toggle('selected',+c.dataset.charId===cid)); showDetail(GS.p2Char);
    } else {
        if(GS.cpuOpponentChoice===cid){GS.cpuOpponentChoice=null;GS.p2Char=null;g.querySelectorAll('.char-card').forEach(c=>c.classList.remove('selected'));hideDetail();checkReady();return}
        GS.cpuOpponentChoice=cid;
        if(cid==='random')GS.p2Char=null; else{GS.p2Char=CHARACTERS.find(c=>c.id===cid);showDetail(GS.p2Char)}
        g.querySelectorAll('.char-card').forEach(c=>c.classList.toggle('selected',c.dataset.charId===String(cid)));
    }
    checkReady();
}
function checkReady(){$('btn-battle-start').disabled=GS.mode==='cpu'?!(GS.p1Char&&GS.cpuOpponentChoice!==null):!(GS.p1Char&&GS.p2Char)}
function showDetail(ch){if(!ch)return;$('detail-name').textContent=ch.name;$('detail-hp').textContent=ch.hp;$('detail-atk').textContent=ch.atk;$('detail-def').textContent=ch.def;$('detail-dice-list').innerHTML=ch.dice.map(d=>`<div class="mini-dice d${d.type}" style="width:26px;height:26px;font-size:10px">${d.label}</div>`).join('');$('detail-ability-text').textContent=ch.abilityDesc;$('char-detail-panel').classList.remove('hidden')}
function hideDetail(){$('char-detail-panel').classList.add('hidden')}
$('btn-close-detail').onclick=hideDetail;
$('btn-back-title').onclick=()=>{GS.p1Char=null;GS.p2Char=null;hideDetail();showScreen('title')};
$('btn-battle-start').onclick=()=>{if(GS.mode==='cpu'&&!GS.p1Char)return;if(GS.mode==='multi'&&(!GS.p1Char||!GS.p2Char))return;hideDetail();startBattle()};

// ============ バトル開始 ============
function startBattle(){
    if(GS.mode==='cpu'&&GS.cpuOpponentChoice==='random'){
        const a=CHARACTERS.filter(c=>c.id!==GS.p1Char.id);
        GS.p2Char=a[Math.floor(Math.random()*a.length)];
    }
    GS.p1Hp=GS.p1Char.hp; GS.p1MaxHp=GS.p1Char.hp;
    GS.p2Hp=GS.p2Char.hp; GS.p2MaxHp=GS.p2Char.hp;
    GS.turn=1;
    // Multi: show left panel
    if(GS.mode==='multi') $('action-panel-left').classList.remove('hidden');
    else $('action-panel-left').classList.add('hidden');
    showScreen('battle'); updateBattleUI(); showCoinFlip();
}

function getAtkChar(){return GS.p1IsAttacker?GS.p1Char:GS.p2Char}
function getDefChar(){return GS.p1IsAttacker?GS.p2Char:GS.p1Char}

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
    hpColor('player-hp-bar',GS.p1Hp,GS.p1MaxHp);
    hpColor('opponent-hp-bar',GS.p2Hp,GS.p2MaxHp);
}
function hpColor(id,hp,max){const r=hp/max;$(id).style.background=r>.5?'linear-gradient(90deg,#22C55E,#4ADE80)':r>.25?'linear-gradient(90deg,#F59E0B,#FBBF24)':'linear-gradient(90deg,#EF4444,#F87171)'}

// Phase glow
function setPhaseGlow(){
    const pi=$('player-info'), oi=$('opponent-info');
    pi.classList.remove('phase-atk','phase-def');
    oi.classList.remove('phase-atk','phase-def');
    if(GS.phase==='attack'){
        if(GS.p1IsAttacker){pi.classList.add('phase-atk');oi.classList.add('phase-def')}
        else{pi.classList.add('phase-def');oi.classList.add('phase-atk')}
    } else {
        if(GS.p1IsAttacker){pi.classList.add('phase-def');oi.classList.add('phase-atk')}
        else{pi.classList.add('phase-atk');oi.classList.add('phase-def')}
    }
}

// ============ コイン ============
function showCoinFlip(){
    $('coin-overlay').classList.remove('hidden');$('coin-result').textContent='';$('btn-coin-ok').classList.add('hidden');
    GS.p1IsAttacker=Math.random()<.5;
    setTimeout(()=>{
        $('coin-result').textContent=GS.mode==='cpu'?(GS.p1IsAttacker?'あなたは先攻（攻撃側）！':'あなたは後攻（防御側）！'):(GS.p1IsAttacker?'1Pが先攻（攻撃側）！':'2Pが先攻（攻撃側）！');
        $('coin-result').style.color=GS.p1IsAttacker?'#FF3366':'#3366FF';
        $('btn-coin-ok').classList.remove('hidden');
    },1800);
}
$('btn-coin-ok').onclick=()=>{$('coin-overlay').classList.add('hidden');startTurn()};

// ============ ターン管理 ============
function startTurn(){
    GS.phase='attack'; GS.attackerSelectedDice=[]; GS.defenderSelectedDice=[];
    clearDmgDisplay();
    showTurnStart(()=>startAttackPhase());
}
function showTurnStart(cb){
    const o=$('turn-start-overlay'); o.classList.remove('hidden');
    $('turn-start-number').textContent=`ターン ${GS.turn}`;
    const r=$('turn-start-role');
    if(GS.mode==='cpu'){r.textContent=GS.p1IsAttacker?'あなたの攻撃！':'あなたの防御！';r.className='turn-start-role '+(GS.p1IsAttacker?'atk-role':'def-role')}
    else{const l=GS.p1IsAttacker?'1P':'2P';r.textContent=`${l}の攻撃！`;r.className='turn-start-role atk-role'}
    setTimeout(()=>{o.classList.add('hidden');if(cb)cb()},1500);
}

// ============ 攻撃フェーズ ============
function startAttackPhase(){
    GS.phase='attack'; updatePhaseUI(); setPhaseGlow();
    const ac=getAtkChar(); GS.maxSelections=ac.atk;
    if(GS.mode==='cpu'){
        GS.p1IsAttacker? setupHumanDice(ac,true,'bottom','right') : cpuAttackPhase();
    } else {
        // Multi: attacker setup
        if(GS.p1IsAttacker) setupHumanDice(ac,true,'bottom','right');
        else setupHumanDice(ac,true,'top','left');
    }
}
function startDefensePhase(){
    GS.phase='defense'; updatePhaseUI(); setPhaseGlow();
    const dc=getDefChar(); GS.maxSelections=dc.def;
    const er=dc.defenseReroll||0;
    if(GS.mode==='cpu'){
        !GS.p1IsAttacker? setupHumanDice(dc,false,'bottom','right',er) : cpuDefensePhase();
    } else {
        if(!GS.p1IsAttacker) setupHumanDice(dc,false,'bottom','right',er);
        else setupHumanDice(dc,false,'top','left',er);
    }
}
function updatePhaseUI(){
    $('turn-number').textContent=`ターン${GS.turn}`;
    const p=$('phase-label');
    if(GS.phase==='attack'){p.textContent='攻撃フェーズ';p.className='phase-label atk-phase'}
    else{p.textContent='防御フェーズ';p.className='phase-label def-phase'}
    resetTotal();
}

// ============ サイコロ操作 ============
function setupHumanDice(char,isAtk,tray,panel,extraRerolls=0){
    const rerolls=isAtk?2:extraRerolls;
    const dice=char.dice.map((d,i)=>({type:d.type,value:Math.floor(Math.random()*d.type)+1,index:i,selected:false}));
    if(tray==='bottom'){
        GS.rolledDice=dice; GS.rerollsLeft=rerolls; GS.activePanel='right';
        renderDiceIn('dice-tray',dice,true,'bottom');
        updateButtons('right',dice,rerolls);
        hidePanel('left');
    } else {
        GS.rolledDiceTop=dice; GS.rerollsLeftP2=rerolls; GS.activePanel='left';
        renderDiceIn('dice-tray-top',dice,true,'top');
        updateButtons('left',dice,rerolls);
        hidePanel('right');
    }
    GS.hasRolled=true; GS.currentActorIsHuman=true;
}

function renderDiceIn(trayId,diceArr,animate,side){
    const t=$(trayId); t.innerHTML='';
    diceArr.forEach((d,i)=>{
        const el=document.createElement('div');
        el.className=`dice d${d.type}`;
        if(d.selected)el.classList.add('selected');
        if(animate)el.classList.add('rolling');
        el.textContent=d.value;
        el.style.animationDelay=`${i*0.1}s`;
        el.onclick=()=>onDiceClickSide(i,side);
        t.appendChild(el);
    });
}

function onDiceClickSide(idx,side){
    if(!GS.hasRolled||!GS.currentActorIsHuman)return;
    const arr=side==='bottom'?GS.rolledDice:GS.rolledDiceTop;
    const d=arr[idx];
    if(d.selected){d.selected=false}
    else{const cnt=arr.filter(x=>x.selected).length;if(cnt>=arr.length)return;d.selected=true}
    renderDiceIn(side==='bottom'?'dice-tray':'dice-tray-top',arr,false,side);
    updateSelectionUI(side);
    updateButtons(side==='bottom'?'right':'left',arr,side==='bottom'?GS.rerollsLeft:GS.rerollsLeftP2);
}

function updateSelectionUI(side){
    const arr=side==='bottom'?GS.rolledDice:GS.rolledDiceTop;
    const cnt=arr.filter(d=>d.selected).length;
    const total=arr.filter(d=>d.selected).reduce((s,d)=>s+d.value,0);
    const cId=side==='bottom'?'selection-count':'selection-count-p2';
    $(cId).textContent=`${cnt}/${GS.maxSelections}`;
    const tv=$('selection-total-value');
    tv.textContent=total;
    if(cnt>0){tv.classList.add('has-value');tv.classList.toggle('atk-active',GS.phase==='attack');tv.classList.toggle('def-active',GS.phase==='defense')}
    else tv.className='selection-total-value';
}

function updateButtons(panel,arr,rerolls){
    const cnt=arr.filter(d=>d.selected).length;
    const rId=panel==='right'?'btn-reroll':'btn-reroll-p2';
    const oId=panel==='right'?'btn-confirm':'btn-confirm-p2';
    const rcId=panel==='right'?'reroll-count':'reroll-count-p2';
    $(rId).disabled=!(rerolls>0&&cnt>0);
    $(oId).disabled=cnt!==GS.maxSelections;
    $(oId).querySelector('.circle-label').textContent=`${cnt}/${GS.maxSelections} OK`;
    $(rcId).textContent=`${rerolls}/2`;
    showPanel(panel);
}
function showPanel(p){$(`action-panel-${p==='right'?'right':'left'}`).classList.remove('hidden')}
function hidePanel(p){$(`action-panel-${p==='right'?'right':'left'}`).classList.add('hidden')}
function resetTotal(){const t=$('selection-total-value');t.textContent='0';t.className='selection-total-value'}

// Reroll handlers
function handleReroll(side){
    const arr=side==='bottom'?GS.rolledDice:GS.rolledDiceTop;
    let rerolls=side==='bottom'?GS.rerollsLeft:GS.rerollsLeftP2;
    if(rerolls<=0)return;
    const sel=arr.filter(d=>d.selected);
    if(!sel.length)return;
    sel.forEach(d=>{d.value=Math.floor(Math.random()*d.type)+1;d.selected=false});
    rerolls--;
    if(side==='bottom')GS.rerollsLeft=rerolls; else GS.rerollsLeftP2=rerolls;
    renderDiceIn(side==='bottom'?'dice-tray':'dice-tray-top',arr,true,side);
    updateSelectionUI(side);
    updateButtons(side==='bottom'?'right':'left',arr,rerolls);
}
function handleConfirm(side){
    const arr=side==='bottom'?GS.rolledDice:GS.rolledDiceTop;
    const sel=arr.filter(d=>d.selected);
    if(sel.length!==GS.maxSelections)return;
    const mapped=sel.map(d=>({type:d.type,value:d.value}));
    if(GS.phase==='attack'){GS.attackerSelectedDice=mapped;startDefensePhase()}
    else{GS.defenderSelectedDice=mapped;startDamageCalc()}
}

$('btn-reroll').onclick=()=>handleReroll('bottom');
$('btn-confirm').onclick=()=>handleConfirm('bottom');
$('btn-reroll-p2').onclick=()=>handleReroll('top');
$('btn-confirm-p2').onclick=()=>handleConfirm('top');

// ============ CPU AI (表示付き) ============
function cpuAttackPhase(){
    GS.currentActorIsHuman=false;
    hidePanel('right'); hidePanel('left');
    const ch=GS.p2Char;
    // Roll all dice with display
    const dice=ch.dice.map((d,i)=>({type:d.type,value:Math.floor(Math.random()*d.type)+1,index:i,selected:false}));
    // Reroll low dice
    for(let r=0;r<2;r++){let did=false;dice.forEach(d=>{if(d.value<(d.type+1)/2*.7){d.value=Math.floor(Math.random()*d.type)+1;did=true}});if(!did)break}
    // Show all dice on top tray
    renderDiceIn('dice-tray-top',dice,true,'top');
    $('dice-tray').innerHTML='';
    // Animate selection
    const sorted=[...dice].sort((a,b)=>b.value-a.value);
    const toSelect=sorted.slice(0,ch.atk);
    let total=0;
    animateCpuSelection(dice,toSelect,0,total,'top',()=>{
        GS.attackerSelectedDice=toSelect.map(d=>({type:d.type,value:d.value}));
        GS.currentActorIsHuman=true;
        setTimeout(()=>startDefensePhase(),800);
    });
}

function cpuDefensePhase(){
    GS.currentActorIsHuman=false;
    hidePanel('right'); hidePanel('left');
    const ch=GS.p2Char;
    const dice=ch.dice.map((d,i)=>({type:d.type,value:Math.floor(Math.random()*d.type)+1,index:i,selected:false}));
    if(ch.defenseReroll)dice.forEach(d=>{if(d.value<(d.type+1)/2*.6)d.value=Math.floor(Math.random()*d.type)+1});
    renderDiceIn('dice-tray-top',dice,true,'top');
    $('dice-tray').innerHTML='';
    const sorted=[...dice].sort((a,b)=>b.value-a.value);
    const toSelect=sorted.slice(0,ch.def);
    let total=0;
    animateCpuSelection(dice,toSelect,0,total,'top',()=>{
        GS.defenderSelectedDice=toSelect.map(d=>({type:d.type,value:d.value}));
        GS.currentActorIsHuman=true;
        setTimeout(()=>startDamageCalc(),800);
    });
}

function animateCpuSelection(allDice,toSelect,idx,total,tray,cb){
    if(idx>=toSelect.length){if(cb)cb();return}
    const target=toSelect[idx];
    const diceIdx=allDice.findIndex(d=>d.index===target.index);
    if(diceIdx>=0){
        allDice[diceIdx].selected=true;
        total+=allDice[diceIdx].value;
        // Update display
        const trayId=tray==='top'?'dice-tray-top':'dice-tray';
        const trayEl=$(trayId);
        const diceEls=trayEl.querySelectorAll('.dice');
        if(diceEls[diceIdx]){diceEls[diceIdx].classList.add('cpu-selecting');diceEls[diceIdx].classList.add('selected')}
        // Update center total
        const tv=$('selection-total-value');
        tv.textContent=total;
        tv.classList.add('has-value');
        tv.classList.toggle('atk-active',GS.phase==='attack');
        tv.classList.toggle('def-active',GS.phase==='defense');
    }
    setTimeout(()=>animateCpuSelection(allDice,toSelect,idx+1,total,tray,cb),600);
}

// ============ ダメージ計算（インライン演出） ============
function clearDmgDisplay(){
    $('damage-battle-area').classList.add('hidden');
    $('dmg-result').classList.add('hidden');
    $('ability-notification').classList.add('hidden');
    $('selection-total-display').style.display='';
    $('dmg-def-side').classList.add('hidden');
    $('dmg-clash').classList.add('hidden');
    $('dmg-atk-bonus').classList.add('hidden');
}

function startDamageCalc(){
    hidePanel('right'); hidePanel('left');
    $('dice-tray').innerHTML=''; $('dice-tray-top').innerHTML='';
    $('selection-total-display').style.display='none';
    resetTotal();

    const ac=getAtkChar(), dc=getDefChar();
    let atkTotal=GS.attackerSelectedDice.reduce((s,d)=>s+d.value,0);
    let defTotal=GS.defenderSelectedDice.reduce((s,d)=>s+d.value,0);
    let atkBonus=0, abilityDescs=[], instantDmg=0;

    // Abilities
    if(ac.abilityType==='attack'){const r=ac.ability(GS.attackerSelectedDice);atkBonus+=r.bonus;abilityDescs.push(...r.desc)}
    else if(ac.abilityType==='attack_special'){
        const hp=GS.p1IsAttacker?GS.p1Hp:GS.p2Hp, max=GS.p1IsAttacker?GS.p1MaxHp:GS.p2MaxHp;
        const r=ac.ability(GS.attackerSelectedDice,hp,max);abilityDescs.push(...r.desc);
        if(r.cheat&&GS.defenderSelectedDice.length>0){
            let mi=0,mv=0;GS.defenderSelectedDice.forEach((d,i)=>{if(d.value>mv){mv=d.value;mi=i}});
            const ov=GS.defenderSelectedDice[mi].value;GS.defenderSelectedDice[mi].value=2;
            defTotal=GS.defenderSelectedDice.reduce((s,d)=>s+d.value,0);
            abilityDescs.push(`防御出目 ${ov} → 2 に変更！`);
        }
    }
    if(dc.abilityType==='defense'){const r=dc.ability(GS.defenderSelectedDice);if(r.instantDamage){instantDmg=r.instantDamage;abilityDescs.push(...r.desc)}}

    const totalAtk=atkTotal+atkBonus;
    const damage=Math.max(0,totalAtk-defTotal);

    // Start animation sequence
    const area=$('damage-battle-area');
    area.classList.remove('hidden');

    // Step 1: Show ATK value
    $('dmg-atk-value').textContent=atkTotal;
    $('dmg-atk-label').textContent='ATK';
    $('dmg-def-side').classList.add('hidden');
    $('dmg-clash').classList.add('hidden');
    $('dmg-atk-bonus').classList.add('hidden');

    let delay=800;

    // Step 2: Ability if any
    if(abilityDescs.length>0){
        setTimeout(()=>{
            showAbility(abilityDescs.join('\n'));
            if(atkBonus>0){
                setTimeout(()=>{
                    $('dmg-atk-bonus').textContent=`+${atkBonus}`;
                    $('dmg-atk-bonus').classList.remove('hidden');
                    setTimeout(()=>{
                        $('dmg-atk-value').textContent=totalAtk;
                        hideAbility();
                    },700);
                },800);
            } else {
                setTimeout(()=>hideAbility(),1200);
            }
        },delay);
        delay+=atkBonus>0?2200:1600;
    }

    // Step 3: Show DEF
    setTimeout(()=>{
        $('dmg-def-side').classList.remove('hidden');
        $('dmg-def-value').textContent=defTotal;
        $('dmg-def-label').textContent='DEF';
    },delay);
    delay+=700;

    // Step 4: Clash!
    setTimeout(()=>{
        $('dmg-clash').classList.remove('hidden');
        // Screen shake
        $('battle-screen').classList.add('screen-shake');
        setTimeout(()=>$('battle-screen').classList.remove('screen-shake'),400);
    },delay);
    delay+=800;

    // Step 5: Result
    setTimeout(()=>{
        area.classList.add('hidden');
        const dr=$('dmg-result'); dr.classList.remove('hidden');
        const defName=GS.p1IsAttacker?(GS.mode==='cpu'?`CPU ${GS.p2Char.name}`:`2P ${GS.p2Char.name}`):(GS.mode==='cpu'?GS.p1Char.name:`1P ${GS.p1Char.name}`);
        $('dmg-result-value').textContent=damage>0?`💥 ${damage} ダメージ！`:'🛡️ ノーダメージ！';
        $('dmg-result-value').style.color=damage>0?'#FF6B6B':'#6B6890';
        let txt=`${defName} に ${damage} ダメージ`;
        if(instantDmg>0){
            const atkName=GS.p1IsAttacker?(GS.mode==='cpu'?GS.p1Char.name:`1P ${GS.p1Char.name}`):(GS.mode==='cpu'?`CPU ${GS.p2Char.name}`:`2P ${GS.p2Char.name}`);
            txt+=` / ${atkName} に即時 ${instantDmg} ダメージ`;
        }
        $('dmg-result-target').textContent=txt;
    },delay);
    delay+=1500;

    // Step 6: Apply
    setTimeout(()=>applyDamage(damage,instantDmg),delay);
}

function applyDamage(dmg,inst){
    if(GS.p1IsAttacker){GS.p2Hp=Math.max(0,GS.p2Hp-dmg);if(inst>0)GS.p1Hp=Math.max(0,GS.p1Hp-inst)}
    else{GS.p1Hp=Math.max(0,GS.p1Hp-dmg);if(inst>0)GS.p2Hp=Math.max(0,GS.p2Hp-inst)}
    updateBattleUI();
    if(dmg>0){const ta=GS.p1IsAttacker?$('opponent-area'):$('player-area');ta.classList.add('shake');setTimeout(()=>ta.classList.remove('shake'),500)}
    if(GS.p1Hp<=0||GS.p2Hp<=0){setTimeout(()=>showResult(),800);return}
    setTimeout(()=>{clearDmgDisplay();GS.p1IsAttacker=!GS.p1IsAttacker;GS.turn++;startTurn()},1200);
}

function showAbility(t){$('ability-text').textContent=t;$('ability-notification').classList.remove('hidden');$('ability-notification').style.display='block'}
function hideAbility(){$('ability-notification').classList.add('hidden');$('ability-notification').style.display=''}

// ============ リザルト ============
function showResult(){
    $('result-overlay').classList.remove('hidden');
    const p1Won=GS.p2Hp<=0;
    const ti=$('result-title'),de=$('result-detail');
    if(GS.mode==='cpu'){
        ti.textContent=p1Won?'YOU WIN!':'YOU LOSE...'; ti.className='result-title '+(p1Won?'win':'lose');
        de.textContent=p1Won?`${GS.p1Char.name} の勝利！ ${GS.turn}ターンで決着！`:`CPU ${GS.p2Char.name} に敗北... ${GS.turn}ターンの戦い。`;
    } else {
        ti.textContent=p1Won?'1P WIN!':'2P WIN!'; ti.className='result-title win';
        de.textContent=p1Won?`1P ${GS.p1Char.name} の勝利！ ${GS.turn}ターンで決着！`:`2P ${GS.p2Char.name} の勝利！ ${GS.turn}ターンで決着！`;
    }
    createParticles(p1Won||GS.mode==='multi');
}
function createParticles(win){
    const c=$('result-particles');c.innerHTML='';
    const cols=win?['#FFD700','#FFA500','#FF6B6B','#FF3366','#FFF']:['#6B6890','#4A4870'];
    for(let i=0;i<35;i++){
        const p=document.createElement('div');
        const dx=(Math.random()-.5)*200,dy=(Math.random()-.5)*200;
        p.style.cssText=`position:absolute;width:${Math.random()*7+3}px;height:${Math.random()*7+3}px;background:${cols[Math.floor(Math.random()*cols.length)]};border-radius:${Math.random()>.5?'50%':'2px'};left:${Math.random()*100}%;top:${Math.random()*100}%;opacity:0;animation:pf${i} ${Math.random()*2+1}s ease-out ${Math.random()*.5}s forwards`;
        c.appendChild(p);
        const s=document.createElement('style');
        s.textContent=`@keyframes pf${i}{0%{transform:translate(0,0) scale(0);opacity:0}20%{opacity:1}100%{transform:translate(${dx}px,${dy}px) scale(1.5);opacity:0}}`;
        document.head.appendChild(s);
    }
}
$('btn-rematch').onclick=()=>{$('result-overlay').classList.add('hidden');clearDmgDisplay();startBattle()};
$('btn-to-title').onclick=()=>{$('result-overlay').classList.add('hidden');clearDmgDisplay();GS.p1Char=null;GS.p2Char=null;showScreen('title')};

// ============ 初期化 ============
GS.currentActorIsHuman=true;
showScreen('title');
