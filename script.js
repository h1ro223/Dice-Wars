/* ============================================
   サイコロ・ウォーズ v1.4 - script.js
   ============================================ */

// ========== サーバーURL設定 (ここを変更すればデフォルトURLが変わります) ==========
const DEFAULT_SERVER_URL = 'wss://dice-wars-0rcs.onrender.com';
// ============ Audio System (Web Audio API SE + BGM) ============
const AudioSys = {
    ctx: null, bgmOn: true, seOn: true,
    bgmTitle: null, bgmBattle: null, currentBgm: null,

    init() {
        if (this.ctx) return;
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.bgmTitle = document.getElementById('bgm-title');
        this.bgmBattle = document.getElementById('bgm-battle');
        if (this.bgmTitle) this.bgmTitle.volume = 0.4;
        if (this.bgmBattle) this.bgmBattle.volume = 0.4;
    },

    resume() {
        if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    },

    // BGM control
    playBgm(which) {
        if (!this.bgmOn) return;
        this.stopBgm();
        const el = which === 'title' ? this.bgmTitle : this.bgmBattle;
        if (!el) return;
        el.currentTime = 0;
        el.volume = 0;
        el.play().catch(() => {});
        this.currentBgm = el;
        // Fade in
        let vol = 0;
        const fade = setInterval(() => {
            vol = Math.min(vol + 0.02, 0.4);
            if (this.currentBgm) this.currentBgm.volume = vol;
            if (vol >= 0.4) clearInterval(fade);
        }, 50);
    },

    stopBgm() {
        [this.bgmTitle, this.bgmBattle].forEach(el => {
            if (el) { el.pause(); el.currentTime = 0; }
        });
        this.currentBgm = null;
    },

    toggleBgm(on) {
        this.bgmOn = on;
        if (!on) this.stopBgm();
    },

    toggleSe(on) {
        this.seOn = on;
    },

    // SE 生成 (Web Audio API)
    playSe(type) {
        if (!this.seOn || !this.ctx) return;
        this.resume();
        switch (type) {
            case 'hover': this._tone(800, 0.04, 'sine', 0.08); break;
            case 'click': this._tone(600, 0.06, 'square', 0.06); this._tone(900, 0.04, 'sine', 0.04, 0.03); break;
            case 'select': this._tone(523, 0.08, 'triangle', 0.1); this._tone(659, 0.06, 'triangle', 0.08, 0.06); break;
            case 'deselect': this._tone(400, 0.06, 'triangle', 0.08); break;
            case 'roll': this._noise(0.15, 0.12); this._tone(300, 0.03, 'square', 0.1); break;
            case 'reroll': this._noise(0.12, 0.1); this._tone(440, 0.05, 'triangle', 0.08); this._tone(550, 0.04, 'triangle', 0.06, 0.05); break;
            case 'confirm': this._tone(523, 0.08, 'sine', 0.1); this._tone(659, 0.08, 'sine', 0.08, 0.08); this._tone(784, 0.1, 'sine', 0.12, 0.16); break;
            case 'damage': this._noise(0.3, 0.2); this._tone(150, 0.2, 'sawtooth', 0.15); this._tone(100, 0.15, 'square', 0.1, 0.1); break;
            case 'shield': this._tone(700, 0.1, 'sine', 0.12); this._tone(900, 0.08, 'sine', 0.1, 0.05); break;
            case 'ability': this._tone(440, 0.1, 'sine', 0.12); this._tone(554, 0.1, 'sine', 0.1, 0.1); this._tone(659, 0.12, 'sine', 0.15, 0.2); this._tone(880, 0.15, 'sine', 0.2, 0.3); break;
            case 'clash': this._noise(0.25, 0.18); this._tone(200, 0.15, 'sawtooth', 0.12); this._tone(120, 0.2, 'square', 0.15, 0.08); break;
            case 'win': this._fanfare([523, 659, 784, 1047], 0.12, 0.12); break;
            case 'lose': this._tone(400, 0.2, 'sine', 0.3); this._tone(350, 0.2, 'sine', 0.25, 0.2); this._tone(300, 0.3, 'sine', 0.4, 0.4); break;
            case 'coin': this._tone(1200, 0.05, 'sine', 0.08); this._tone(1500, 0.05, 'sine', 0.06, 0.1); this._tone(1800, 0.05, 'sine', 0.04, 0.2); break;
            case 'turn': this._tone(600, 0.08, 'triangle', 0.1); this._tone(800, 0.1, 'triangle', 0.12, 0.1); break;
            case 'atk-show': this._tone(350, 0.1, 'sawtooth', 0.12); this._tone(500, 0.08, 'square', 0.1, 0.08); break;
            case 'def-show': this._tone(500, 0.1, 'sine', 0.12); this._tone(700, 0.08, 'sine', 0.1, 0.08); break;
        }
    },

    _tone(freq, vol, type, dur, delay = 0) {
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = type; o.frequency.value = freq;
        g.gain.setValueAtTime(0, this.ctx.currentTime + delay);
        g.gain.linearRampToValueAtTime(vol, this.ctx.currentTime + delay + 0.01);
        g.gain.linearRampToValueAtTime(0, this.ctx.currentTime + delay + dur);
        o.connect(g); g.connect(this.ctx.destination);
        o.start(this.ctx.currentTime + delay);
        o.stop(this.ctx.currentTime + delay + dur + 0.01);
    },

    _noise(dur, vol) {
        const bufSize = this.ctx.sampleRate * dur;
        const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * vol;
        const n = this.ctx.createBufferSource();
        const g = this.ctx.createGain();
        n.buffer = buf;
        g.gain.setValueAtTime(vol, this.ctx.currentTime);
        g.gain.linearRampToValueAtTime(0, this.ctx.currentTime + dur);
        n.connect(g); g.connect(this.ctx.destination);
        n.start(); n.stop(this.ctx.currentTime + dur + 0.01);
    },

    _fanfare(notes, vol, spacing) {
        notes.forEach((f, i) => this._tone(f, vol, 'sine', 0.2, i * spacing));
    }
};

// Init audio on first user interaction
document.addEventListener('click', () => AudioSys.init(), { once: true });
document.addEventListener('touchstart', () => AudioSys.init(), { once: true });

// Settings toggles
document.addEventListener('DOMContentLoaded', () => {
    const bgmToggle = document.getElementById('toggle-bgm');
    const seToggle = document.getElementById('toggle-se');
    if (bgmToggle) {
        bgmToggle.addEventListener('change', () => {
            AudioSys.toggleBgm(bgmToggle.checked);
            if (bgmToggle.checked) {
                const scr = GS.currentScreen;
                AudioSys.playBgm(scr === 'battle' ? 'battle' : 'title');
            }
        });
    }
    if (seToggle) {
        seToggle.addEventListener('change', () => AudioSys.toggleSe(seToggle.checked));
    }
});

// Hover SE for interactive elements
document.addEventListener('mouseover', (e) => {
    const t = e.target.closest('button, .char-card, .dice:not(.rolling):not(.locked)');
    if (t) AudioSys.playSe('hover');
});

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
        id:2, name:'ホースラ', emoji:'🦊', hp:25, atk:3, def:3,
        dice:[{type:8,label:'8D'},{type:4,label:'4D'},{type:4,label:'4D'},{type:4,label:'4D'}],
        abilityDesc:'防御時、リロールチャンスを1回獲得する。また、防御時に選んだサイコロに同じ出目がある場合、ただちに相手に4の即時ダメージを与える。',
        abilityType:'defense', defenseReroll:1,
        ability(sel){ let id=0,d=[]; const c={}; sel.forEach(s=>{c[s.value]=(c[s.value]||0)+1}); for(const[,n]of Object.entries(c)){if(n>=2){id+=4;d.push(`防御時ペア発動！ 相手に即時4ダメージ！`)}} return{bonus:0,desc:d,instantDamage:id}; }
    },
    {
        id:3, name:'ジャスパー', emoji:'🦁', hp:25, atk:3, def:2,
        dice:[{type:6,label:'6D'},{type:6,label:'6D'},{type:4,label:'4D'},{type:4,label:'4D'},{type:4,label:'4D'}],
        abilityDesc:'攻撃時、選択したサイコロに同じ出目が2つある場合、ダメージ+5。同じ出目が1つ増えるたびに、ダメージがさらに+3。',
        abilityType:'attack',
        ability(sel){ let b=0,d=[]; const c={}; sel.forEach(s=>{c[s.value]=(c[s.value]||0)+1}); for(const[v,n]of Object.entries(c)){if(n>=2){const x=5+3*(n-2);b+=x;d.push(`出目${v}が${n}つ！ ダメージ+${x}`)}} return{bonus:b,desc:d}; }
    },
    {
        id:4, name:'クライシス', emoji:'🐉', hp:25, atk:3, def:2,
        dice:[{type:6,label:'6D'},{type:6,label:'6D'},{type:6,label:'6D'},{type:4,label:'4D'},{type:4,label:'4D'}],
        abilityDesc:'攻撃時、自身のHPが15以下の場合、"イカサマ"が付与される。相手の選択サイコロの最大出目を2にする。',
        abilityType:'attack_special',
        ability(sel,hp){ let d=[]; const a=hp<=15; if(a)d.push(`イカサマ発動！ 相手の最大防御出目を2に！`); return{bonus:0,desc:d,cheat:a}; }
    },
    {
        id:5, name:'ドラン', emoji:'🐲', hp:26, atk:4, def:3,
        dice:[{type:6,label:'6D'},{type:4,label:'4D'},{type:4,label:'4D'},{type:4,label:'4D'},{type:4,label:'4D'}],
        abilityDesc:'防御時、ダメージを受けた場合相手に2の即時ダメージ。防御サイコロが全て奇数なら代わりに4の即時ダメージ。',
        abilityType:'defense_doran',
        ability(sel,dmg){ let id=0,d=[]; if(dmg>0){const allOdd=sel.every(s=>s.value%2===1);if(allOdd){id=4;d.push(`全て奇数！ 相手に即時4ダメージ！`)}else{id=2;d.push(`ダメージ反射！ 相手に即時2ダメージ！`)}} return{bonus:0,desc:d,instantDamage:id}; }
    },
    {
        id:6, name:'ライアン', emoji:'🦅', hp:24, atk:4, def:3,
        dice:[{type:6,label:'6D'},{type:6,label:'6D'},{type:4,label:'4D'},{type:4,label:'4D'},{type:4,label:'4D'}],
        abilityDesc:'防御時、リロール1回獲得。ダメージ0ならHP5回復。ターン終了時HP5以下ならDEF+1(HP6以上で解除)。',
        abilityType:'defense_ryan', defenseReroll:1,
        ability(sel,dmg){ let d=[],heal=0; if(dmg===0){heal=5;d.push(`ダメージ無効！ HP5回復！`)} return{bonus:0,desc:d,heal:heal}; }
    },
    {
        id:7, name:'オーガスト', emoji:'🐻', hp:25, atk:3, def:2,
        dice:[{type:6,label:'6D'},{type:6,label:'6D'},{type:4,label:'4D'},{type:4,label:'4D'},{type:4,label:'4D'}],
        abilityDesc:'攻撃後パワー1層獲得。全て偶数なら代わりに3層。次の攻撃時にパワー層数ぶんダメージ加算。',
        abilityType:'attack_august',
        ability(sel){ const allEven=sel.every(s=>s.value%2===0); return{stacks:allEven?3:1,desc:allEven?[`全て偶数！ パワー3層獲得！`]:[`パワー1層獲得！`]}; }
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
    // v1.4: 新ステート
    powerStacks:{p1:0,p2:0},
    ryanDefBuff:{p1:false,p2:false},
    _lastDmg:0,
    // オンライン
    onlineRole:null, // 'host' | 'guest'
    onlineReady:{p1:false,p2:false},
};

const $=id=>document.getElementById(id);

const screens={title:$('title-screen'),deck:$('deck-screen'),battle:$('battle-screen')};
function showScreen(n){
    Object.values(screens).forEach(s=>s.classList.remove('active'));
    if(screens[n])screens[n].classList.add('active');
    GS.currentScreen=n;
    // BGM switching
    AudioSys.init();
    if(n==='battle') AudioSys.playBgm('battle');
    else AudioSys.playBgm('title');
}

// ============ Title ============
$('btn-start-cpu').addEventListener('click',()=>{AudioSys.playSe('click');GS.mode='cpu';showDeckScreen();});
$('btn-start-multi').addEventListener('click',()=>{AudioSys.playSe('click');$('multi-mode-modal').classList.remove('hidden');});
$('btn-local-multi').addEventListener('click',()=>{AudioSys.playSe('confirm');$('multi-mode-modal').classList.add('hidden');GS.mode='multi';showDeckScreen();});

// Modals
$('btn-how-to-play').addEventListener('click',()=>{AudioSys.playSe('click');$('howto-modal').classList.remove('hidden')});
$('btn-howto-battle').addEventListener('click',()=>{AudioSys.playSe('click');$('howto-modal').classList.remove('hidden')});
$('btn-update-log').addEventListener('click',()=>{AudioSys.playSe('click');$('update-log-modal').classList.remove('hidden')});
$('btn-about').addEventListener('click',()=>{AudioSys.playSe('click');$('about-modal').classList.remove('hidden')});
$('btn-settings').addEventListener('click',()=>{AudioSys.playSe('click');$('settings-modal').classList.remove('hidden');$('btn-quit-game').style.display='';});
$('btn-quit-game').addEventListener('click',()=>{AudioSys.playSe('click');$('settings-modal').classList.add('hidden');$('quit-confirm-modal').classList.remove('hidden');});
$('btn-quit-cancel').addEventListener('click',()=>{AudioSys.playSe('click');$('quit-confirm-modal').classList.add('hidden')});
$('btn-quit-confirm').addEventListener('click',()=>{AudioSys.playSe('confirm');$('quit-confirm-modal').classList.add('hidden');GS.p1Char=null;GS.p2Char=null;showScreen('title');});
$('btn-page-refresh').addEventListener('click',()=>{location.reload();});

document.querySelectorAll('.modal-close-btn').forEach(b=>{b.addEventListener('click',()=>{AudioSys.playSe('click');const id=b.dataset.close;if(id)$(id).classList.add('hidden');});});
document.querySelectorAll('.modal-overlay').forEach(o=>{o.addEventListener('click',e=>{if(e.target===o){AudioSys.playSe('click');o.classList.add('hidden');}});});

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
    AudioSys.playSe('select');
}
function checkReady(){$('btn-battle-start').disabled=GS.mode==='cpu'?!(GS.p1Char&&GS.cpuOpponentChoice!==null):!(GS.p1Char&&GS.p2Char);}
function showDetail(ch){if(!ch)return;$('detail-name').textContent=ch.name;$('detail-hp').textContent=ch.hp;$('detail-atk').textContent=ch.atk;$('detail-def').textContent=ch.def;$('detail-dice-list').innerHTML=ch.dice.map(d=>`<div class="mini-dice d${d.type}" style="width:24px;height:24px;font-size:10px;">${d.label}</div>`).join('');$('detail-ability-text').textContent=ch.abilityDesc;$('char-detail-panel').classList.remove('hidden');}
function hideDetail(){$('char-detail-panel').classList.add('hidden');}

$('btn-close-detail').addEventListener('click',()=>{AudioSys.playSe('click');hideDetail();});
$('btn-detail-ok').addEventListener('click',()=>{AudioSys.playSe('click');hideDetail();});
$('btn-back-title').addEventListener('click',()=>{AudioSys.playSe('click');GS.p1Char=null;GS.p2Char=null;hideDetail();showScreen('title');});
$('btn-battle-start').addEventListener('click',()=>{if(GS.mode==='cpu'&&!GS.p1Char)return;if(GS.mode==='multi'&&(!GS.p1Char||!GS.p2Char))return;AudioSys.playSe('confirm');hideDetail();startBattle();});

// ============ Battle ============
function startBattle(){
    if(GS.mode==='cpu'&&GS.cpuOpponentChoice==='random'){const a=CHARACTERS.filter(c=>c.id!==GS.p1Char.id);GS.p2Char=a[Math.floor(Math.random()*a.length)];}
    GS.p1Hp=GS.p1Char.hp;GS.p1MaxHp=GS.p1Char.hp;GS.p2Hp=GS.p2Char.hp;GS.p2MaxHp=GS.p2Char.hp;GS.turn=1;GS.animating=false;
    GS.powerStacks={p1:0,p2:0};GS.ryanDefBuff={p1:false,p2:false};GS._lastDmg=0;
    showScreen('battle');
    $('action-panel-right').classList.remove('hidden');
    updateBattleUI();showCoinFlip();
}

function atkChar(){return GS.p1IsAttacker?GS.p1Char:GS.p2Char;}
function defChar(){return GS.p1IsAttacker?GS.p2Char:GS.p1Char;}

function updateBattleUI(){
    const p1Def=GS.p1Char.def+(GS.p1Char.id===6&&GS.ryanDefBuff.p1?1:0);
    const p2Def=GS.p2Char.def+(GS.p2Char.id===6&&GS.ryanDefBuff.p2?1:0);
    $('player-portrait').textContent=GS.p1Char.emoji;
    $('player-name').textContent=(GS.mode==='multi'||GS.mode==='online')?`1P: ${GS.p1Char.name}`:GS.p1Char.name;
    $('player-hp-text').textContent=`${GS.p1Hp}/${GS.p1MaxHp}`;
    $('player-hp-bar').style.width=`${(GS.p1Hp/GS.p1MaxHp)*100}%`;
    $('player-atk').textContent=`\u2694\uFE0F${GS.p1Char.atk}`;
    $('player-def').textContent=`\ud83d\udee1\uFE0F${p1Def}${GS.ryanDefBuff.p1?' \u2B06':''}` ;
    $('player-ability-text-battle').textContent=GS.p1Char.abilityDesc;
    // パワー表示
    const p1Power=GS.p1Char.id===7&&GS.powerStacks.p1>0?` | \u26A1パワ\u30fc${GS.powerStacks.p1}`:'';
    if(p1Power) $('player-ability-text-battle').textContent+=p1Power;
    $('opponent-portrait').textContent=GS.p2Char.emoji;
    $('opponent-name').textContent=GS.mode==='cpu'?`CPU: ${GS.p2Char.name}`:`2P: ${GS.p2Char.name}`;
    $('opponent-hp-text').textContent=`${GS.p2Hp}/${GS.p2MaxHp}`;
    $('opponent-hp-bar').style.width=`${(GS.p2Hp/GS.p2MaxHp)*100}%`;
    $('opponent-atk').textContent=`\u2694\uFE0F${GS.p2Char.atk}`;
    $('opponent-def').textContent=`\ud83d\udee1\uFE0F${p2Def}${GS.ryanDefBuff.p2?' \u2B06':''}` ;
    $('opponent-ability-text-battle').textContent=GS.p2Char.abilityDesc;
    const p2Power=GS.p2Char.id===7&&GS.powerStacks.p2>0?` | \u26A1パワ\u30fc${GS.powerStacks.p2}`:'';
    if(p2Power) $('opponent-ability-text-battle').textContent+=p2Power;
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
    AudioSys.playSe('coin');
    // オンラインモードではp1IsAttackerはstart_battleで既に設定済み
    if(GS.mode!=='online'){
        GS.p1IsAttacker=Math.random()<.5;
    }
    setTimeout(()=>{
        if(GS.mode==='cpu'){
            $('coin-result').textContent=GS.p1IsAttacker?'あなたは先攻（攻撃側）！':'あなたは後攻（防御側）！';
        } else {
            $('coin-result').textContent=GS.p1IsAttacker?'1Pが先攻（攻撃側）！':'2Pが先攻（攻撃側）！';
        }
        $('coin-result').style.color=GS.p1IsAttacker?'#FF3366':'#3366FF';
        $('btn-coin-ok').classList.remove('hidden');
        // オンライン: ホスト=「開始」(ゲスト準備待ち)、ゲスト=「準備OK」
        if(GS.mode==='online'){
            if(GS.onlineRole==='host'){
                $('btn-coin-ok').textContent='開始';
                $('btn-coin-ok').disabled=true;
            } else {
                $('btn-coin-ok').textContent='準備OK';
                $('btn-coin-ok').disabled=false;
            }
        } else {
            $('btn-coin-ok').textContent='OK';
            $('btn-coin-ok').disabled=false;
        }
        AudioSys.playSe('confirm');
    },1800);
}
$('btn-coin-ok').addEventListener('click',()=>{
    AudioSys.playSe('click');
    if(GS.mode==='online'){
        if(GS.onlineRole==='guest'){
            // ゲスト: 準備OK送信→ホストの開始を待機
            sendAction({type:'guest_coin_ready'});
            $('btn-coin-ok').disabled=true;
            $('btn-coin-ok').textContent='相手の開始を待っています...';
            return;
        }
        // ホスト: 開始→ゲストに通知
        sendAction({type:'coin_ok'});
    }
    $('coin-overlay').classList.add('hidden');
    startTurn();
});

// ============ Turn ============
function startTurn(){
    GS.phase='attack';GS.attackerSelectedDice=[];GS.defenderSelectedDice=[];
    clearDamageDisplay();
    showTurnStart(()=>startAttackPhase());
}

function showTurnStart(cb){
    const o=$('turn-start-overlay');o.classList.remove('hidden');
    AudioSys.playSe('turn');
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
    const dc=defChar();
    // ライアンDEFバフ反映
    const defKey=GS.p1IsAttacker?'p2':'p1';
    const baseDef=dc.def+(dc.id===6&&GS.ryanDefBuff[defKey]?1:0);
    GS.maxSelections=baseDef;
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
    renderP1Dice(true);updateSelectionUI();updateActionButtons();
    AudioSys.playSe('roll');
    $('action-panel-right').classList.remove('hidden');
}

function renderP1Dice(anim=false){
    const t=$('dice-tray');t.innerHTML='';
    GS.rolledDice.forEach((d,i)=>{
        const e=document.createElement('div');e.className=`dice d${d.type}`;
        if(d.selected)e.classList.add('selected');if(anim)e.classList.add('rolling');
        e.textContent=d.value;e.style.animationDelay=`${i*.1}s`;
        e.addEventListener('click',()=>{
            if(GS.activePlayer!==1)return;
            onDiceClick(i);
        });
        t.appendChild(e);
    });
}

// ============ P2 Dice (top) ============
function setupP2Dice(ch,isAtk,extraRerolls=0){
    GS.rerollsLeftP2=isAtk?2:extraRerolls;GS.hasRolled=true;GS.activePlayer=2;
    GS.rolledDiceP2=ch.dice.map((d,i)=>({type:d.type,value:Math.floor(Math.random()*d.type)+1,index:i,selected:false}));
    renderP2Dice(true);updateSelectionUI();updateActionButtons();
    AudioSys.playSe('roll');
    $('action-panel-right').classList.remove('hidden');
}

function renderP2Dice(anim=false){
    const t=$('opponent-dice-tray');t.innerHTML='';
    GS.rolledDiceP2.forEach((d,i)=>{
        const e=document.createElement('div');e.className=`dice d${d.type}`;
        if(d.selected)e.classList.add('selected');if(anim)e.classList.add('rolling');
        e.textContent=d.value;e.style.animationDelay=`${i*.1}s`;
        e.addEventListener('click',()=>{
            if(GS.activePlayer!==2)return;
            onDiceClick(i);
        });
        t.appendChild(e);
    });
}

// ============ 統一ダイス操作 ============
function activeDice(){ return GS.activePlayer===1?GS.rolledDice:GS.rolledDiceP2; }
function activeRerolls(){ return GS.activePlayer===1?GS.rerollsLeft:GS.rerollsLeftP2; }
function renderActiveDice(anim){ GS.activePlayer===1?renderP1Dice(anim):renderP2Dice(anim); }

function isMyTurn(){
    if(GS.mode!=='online')return true;
    const p1Active=(GS.p1IsAttacker&&GS.phase==='attack')||(!GS.p1IsAttacker&&GS.phase==='defense');
    return GS.onlineRole==='host'?p1Active:!p1Active;
}

function onDiceClick(i){
    if(!GS.hasRolled||GS.animating)return;
    if(GS.mode==='online'&&!isMyTurn())return;
    const dice=activeDice();
    const d=dice[i];
    if(d.selected){d.selected=false;AudioSys.playSe('deselect');}
    else{const n=dice.filter(x=>x.selected).length;if(n>=dice.length)return;d.selected=true;AudioSys.playSe('select');}
    renderActiveDice();updateSelectionUI();updateActionButtons();
    if(GS.mode==='online')sendAction({type:'dice_toggle',player:GS.activePlayer,index:i});
}

function updateSelectionUI(){
    const dice=activeDice();
    const sc=dice.filter(d=>d.selected).length;
    const st=dice.filter(d=>d.selected).reduce((s,d)=>s+d.value,0);
    $('selection-count').textContent=`${sc}/${GS.maxSelections}`;
    const tv=$('selection-total-value');tv.textContent=st;
    if(sc>0){tv.classList.add('has-value');tv.classList.toggle('atk-active',GS.phase==='attack');tv.classList.toggle('def-active',GS.phase==='defense');}
    else tv.className='selection-total-value';
    $('reroll-count').textContent=`${activeRerolls()}/2`;
}

function updateActionButtons(){
    const dice=activeDice();
    const sc=dice.filter(d=>d.selected).length;
    const isOnlineNotMyTurn=GS.mode==='online'&&!isMyTurn();
    $('btn-confirm').disabled=sc!==GS.maxSelections||isOnlineNotMyTurn;
    $('btn-confirm').querySelector('.circle-label').textContent=`${sc}/${GS.maxSelections} OK`;
    $('btn-reroll').disabled=!(activeRerolls()>0&&sc>0)||isOnlineNotMyTurn;
}

$('btn-reroll').addEventListener('click',()=>{
    if(GS.animating)return;
    if(GS.mode==='online'&&!isMyTurn())return;
    const rerolls=activeRerolls();
    if(rerolls<=0)return;
    const dice=activeDice();
    const sel=dice.filter(d=>d.selected);if(!sel.length)return;
    AudioSys.playSe('reroll');
    sel.forEach(d=>{d.value=Math.floor(Math.random()*d.type)+1;d.selected=false;});
    if(GS.activePlayer===1)GS.rerollsLeft--;else GS.rerollsLeftP2--;
    renderActiveDice(true);updateSelectionUI();updateActionButtons();
    if(GS.mode==='online')sendAction({type:'reroll',player:GS.activePlayer,dice:dice.map(d=>({type:d.type,value:d.value}))});
});

$('btn-confirm').addEventListener('click',()=>{
    if(GS.animating)return;
    if(GS.mode==='online'&&!isMyTurn())return;
    const dice=activeDice();
    const sel=dice.filter(d=>d.selected);if(sel.length!==GS.maxSelections)return;
    AudioSys.playSe('confirm');
    // 連打防止: 即座にボタン無効化
    $('btn-confirm').disabled=true;
    $('btn-reroll').disabled=true;
    const selectedData=sel.map(d=>({type:d.type,value:d.value}));
    if(GS.mode==='online')sendAction({type:'confirm',phase:GS.phase,selectedDice:selectedData});
    if(GS.phase==='attack'){GS.attackerSelectedDice=selectedData;startDefensePhase();}
    else{GS.defenderSelectedDice=selectedData;startDamageCalc();}
});

// ============ CPU Phase (購いAI + リロール付き) ============
function cpuPhase(ch,type){
    GS.currentActorIsHuman=false;GS.animating=true;
    const isAtk=type==='attack';
    const maxSel=isAtk?ch.atk:ch.def;
    const rerollCount=isAtk?2:(ch.defenseReroll||0);
    const dice=ch.dice.map((d,i)=>({type:d.type,value:Math.floor(Math.random()*d.type)+1,index:i,selected:false}));
    renderCpuAllDice(dice,true);
    AudioSys.playSe('roll');
    const tv=$('selection-total-value');tv.textContent='0';tv.className='selection-total-value';

    function cpuDoRerolls(rerollsLeft,cb){
        if(rerollsLeft<=0){cb();return;}
        // 戦略: 出目が最大値の半分以下のサイコロをリロール
        const toReroll=dice.filter(d=>d.value<=d.type/2);
        if(toReroll.length===0){cb();return;}
        // リロール対象を一時的に選択表示
        toReroll.forEach(d=>d.selected=true);
        renderCpuAllDice(dice,false);
        setTimeout(()=>{
            AudioSys.playSe('reroll');
            toReroll.forEach(d=>{d.value=Math.floor(Math.random()*d.type)+1;d.selected=false;});
            renderCpuAllDice(dice,true);
            setTimeout(()=>cpuDoRerolls(rerollsLeft-1,cb),800);
        },600);
    }

    setTimeout(()=>{
        renderCpuAllDice(dice,false);
        cpuDoRerolls(rerollCount,()=>{
            // リロール完了、サイコロ選択フェーズ
            const sorted=[...dice].sort((a,b)=>b.value-a.value);
            const toSelect=sorted.slice(0,maxSel);
            let selIdx=0,runningTotal=0;
            function selectNext(){
                if(selIdx>=toSelect.length){
                    const selected=toSelect.map(d=>({type:d.type,value:d.value}));
                    if(isAtk)GS.attackerSelectedDice=selected;else GS.defenderSelectedDice=selected;
                    GS.currentActorIsHuman=true;GS.animating=false;
                    setTimeout(()=>{if(isAtk)startDefensePhase();else startDamageCalc();},600);
                    return;
                }
                const d=toSelect[selIdx];d.selected=true;
                runningTotal+=d.value;
                renderCpuAllDice(dice,false);
                AudioSys.playSe('select');
                tv.textContent=runningTotal;
                tv.classList.add('has-value');
                tv.classList.toggle('atk-active',isAtk);tv.classList.toggle('def-active',!isAtk);
                selIdx++;
                setTimeout(selectNext,700);
            }
            setTimeout(selectNext,400);
        });
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

function startDamageCalc(){
    GS.animating=true;
    const ac=atkChar(),dc=defChar();
    let atkTotal=GS.attackerSelectedDice.reduce((s,d)=>s+d.value,0);
    let defTotal=GS.defenderSelectedDice.reduce((s,d)=>s+d.value,0);
    let atkBonus=0,abilDescs=[],instantDmg=0;

    // オーガスト: パワー消費
    if(ac.id===7){
        const key=GS.p1IsAttacker?'p1':'p2';
        if(GS.powerStacks[key]>0){
            atkBonus+=GS.powerStacks[key];
            abilDescs.push(`パワー${GS.powerStacks[key]}層発動！ ダメージ+${GS.powerStacks[key]}`);
            GS.powerStacks[key]=0;
        }
    }

    // Attacker ability
    if(ac.abilityType==='attack'){const r=ac.ability(GS.attackerSelectedDice);atkBonus+=r.bonus;abilDescs.push(...r.desc);}
    else if(ac.abilityType==='attack_special'){
        const hp=GS.p1IsAttacker?GS.p1Hp:GS.p2Hp;
        const r=ac.ability(GS.attackerSelectedDice,hp);abilDescs.push(...r.desc);
        if(r.cheat&&GS.defenderSelectedDice.length>0){
            let mi=0,mv=0;GS.defenderSelectedDice.forEach((d,i)=>{if(d.value>mv){mv=d.value;mi=i;}});
            const ov=GS.defenderSelectedDice[mi].value;GS.defenderSelectedDice[mi].value=2;
            defTotal=GS.defenderSelectedDice.reduce((s,d)=>s+d.value,0);
            abilDescs.push(`防御出目 ${ov} → 2 に変更！`);
        }
    }
    // ホースラ Defender ability (ダメージに依存しない)
    if(dc.abilityType==='defense'){const r=dc.ability(GS.defenderSelectedDice);if(r.instantDamage){instantDmg=r.instantDamage;abilDescs.push(...r.desc);}}

    const totalAtk=atkTotal+atkBonus;
    const dmg=Math.max(0,totalAtk-defTotal);
    GS._lastDmg=dmg;

    // ドラン: ダメージを受けた場合の即時ダメージ
    if(dc.abilityType==='defense_doran'){
        const r=dc.ability(GS.defenderSelectedDice,dmg);
        if(r.instantDamage>0){instantDmg+=r.instantDamage;abilDescs.push(...r.desc);}
    }

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
        AudioSys.playSe('atk-show');
    },400);

    // Step 2: Ability activation
    let step2Delay=1200;
    if(abilDescs.length>0){
        setTimeout(()=>{showAbility(abilDescs.join('\n'));AudioSys.playSe('ability');},step2Delay);
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
        AudioSys.playSe('def-show');
    },step2Delay);

    // Step 4: Clash!
    setTimeout(()=>{
        clashEl.textContent='⚡';
        clashEl.classList.add('clash-active');
        AudioSys.playSe('clash');
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
            AudioSys.playSe('damage');
        } else {
            rv.textContent='🛡️ ダメージ無効！';rv.style.color='#6B9BFF';
            AudioSys.playSe('shield');
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
    const ac=atkChar(),dc=defChar();
    if(GS.p1IsAttacker){
        GS.p2Hp=Math.max(0,GS.p2Hp-dmg);
        if(instantDmg>0)GS.p1Hp=Math.max(0,GS.p1Hp-instantDmg);
    } else {
        GS.p1Hp=Math.max(0,GS.p1Hp-dmg);
        if(instantDmg>0)GS.p2Hp=Math.max(0,GS.p2Hp-instantDmg);
    }
    // ライアン: ダメージ0ならHP5回復
    if(dc.abilityType==='defense_ryan'&&dmg===0){
        const defKey=GS.p1IsAttacker?'p2':'p1';
        if(defKey==='p1'){GS.p1Hp=Math.min(GS.p1MaxHp,GS.p1Hp+5);}
        else{GS.p2Hp=Math.min(GS.p2MaxHp,GS.p2Hp+5);}
    }
    // オーガスト: 攻撃後パワー獲得
    if(ac.abilityType==='attack_august'){
        const atkKey=GS.p1IsAttacker?'p1':'p2';
        const r=ac.ability(GS.attackerSelectedDice);
        GS.powerStacks[atkKey]=r.stacks;
    }
    // ライアンDEFバフ: ターン終了時チェック
    ['p1','p2'].forEach(key=>{
        const ch=key==='p1'?GS.p1Char:GS.p2Char;
        if(ch.id===6){
            const hp=key==='p1'?GS.p1Hp:GS.p2Hp;
            GS.ryanDefBuff[key]=(hp>0&&hp<=5);
        }
    });
    updateBattleUI();
    if(dmg>0){const ta=GS.p1IsAttacker?$('opponent-area'):$('player-area');ta.classList.add('shake');setTimeout(()=>ta.classList.remove('shake'),500);}
    GS.animating=false;
    // 引き分けチェック
    if(GS.p1Hp<=0&&GS.p2Hp<=0){setTimeout(()=>showResult('draw'),800);return;}
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
function showResult(type){
    $('result-overlay').classList.remove('hidden');
    const t=$('result-title'),d=$('result-detail');
    if(type==='draw'){
        t.textContent='DRAW';t.className='result-title lose';
        d.textContent=`引き分け！ ${GS.turn}ターンで決着。`;
        AudioSys.playSe('lose');createParticles(false);return;
    }
    const p1W=GS.p2Hp<=0;
    if(GS.mode==='cpu'){
        t.textContent=p1W?'YOU WIN!':'YOU LOSE...';t.className='result-title '+(p1W?'win':'lose');
        d.textContent=p1W?`${GS.p1Char.name} の勝利！ ${GS.turn}ターンで決着！`:`CPU ${GS.p2Char.name} に敗北... ${GS.turn}ターン。`;
    } else {
        t.textContent=p1W?'1P WIN!':'2P WIN!';t.className='result-title win';
        d.textContent=p1W?`1P ${GS.p1Char.name} の勝利！`:`2P ${GS.p2Char.name} の勝利！`;
    }
    createParticles(p1W||GS.mode==='multi'||GS.mode==='online');
    if(GS.mode==='cpu') AudioSys.playSe(p1W?'win':'lose');
    else AudioSys.playSe('win');
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

$('btn-rematch').addEventListener('click',()=>{AudioSys.playSe('confirm');$('result-overlay').classList.add('hidden');startBattle();});
$('btn-to-title').addEventListener('click',()=>{AudioSys.playSe('click');$('result-overlay').classList.add('hidden');GS.p1Char=null;GS.p2Char=null;showScreen('title');});

// Init
GS.currentActorIsHuman=true;showScreen('title');

// ============ Online Multiplayer ============
let ws=null;
let onlinePlayerName='';

function connectToServer(url){
    return new Promise((resolve,reject)=>{
        const wsUrl=url.replace(/^http/,'ws');
        ws=new WebSocket(wsUrl);
        ws.onopen=()=>{resolve();};
        ws.onerror=(e)=>{reject(e);};
        ws.onclose=()=>{
            const st=$('online-status');
            if(st)st.textContent='切断されました';
        };
        ws.onmessage=(e)=>{
            try{handleOnlineMessage(JSON.parse(e.data));}catch(err){console.error(err);}
        };
    });
}

function sendOnline(msg){
    if(ws&&ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify(msg));
}

function sendAction(action){
    sendOnline({type:'game_action',action});
}

function handleOnlineMessage(msg){
    switch(msg.type){
        case 'name_set':
            onlinePlayerName=msg.name;
            $('online-step-connect').classList.add('hidden');
            $('online-step-lobby').classList.remove('hidden');
            $('online-my-name').textContent=`あなた: ${msg.name}`;
            $('online-status').textContent='✅ ロビーに参加しました！対戦相手を選んでください';
            break;
        case 'player_list':
            renderPlayerList(msg.players);
            break;
        case 'selected_by':
            $('online-status').textContent=`${msg.name} があなたを選択しました！`;
            break;
        case 'match_created':
            GS.onlineRole=msg.role;
            GS.mode='online';
            $('online-modal').classList.add('hidden');
            $('match-confirm-modal').classList.add('hidden');
            $('online-status').textContent='';
            showOnlineDeckScreen(msg.opponent);
            break;
        case 'opponent_disconnected':
            // 切断された側もWSを閉じてタイトルに戻る
            $('match-confirm-modal').classList.add('hidden');
            $('online-modal').classList.add('hidden');
            if(ws){
                ws.close();
                ws=null;
            }
            onlinePlayerName='';
            GS.mode=null;GS.onlineRole=null;GS.p1Char=null;GS.p2Char=null;
            showScreen('title');
            setTimeout(()=>alert('相手が切断しました。タイトルに戻ります。'),100);
            break;
        case 'match_request':
            GS.onlineRole=msg.role;
            $('match-confirm-opponent').textContent=msg.opponent;
            $('match-confirm-role').textContent=msg.role==='host'?'⭐ あなたはホストです':'あなたはゲストです';
            $('match-confirm-status').textContent='';
            $('btn-match-accept').disabled=false;
            $('btn-match-decline').disabled=false;
            $('match-confirm-modal').classList.remove('hidden');
            AudioSys.playSe('confirm');
            break;
        case 'match_declined':
            $('match-confirm-modal').classList.add('hidden');
            $('online-status').textContent=`${msg.by} が対戦を辞退しました`;
            AudioSys.playSe('deselect');
            break;
        case 'error':
            $('online-status').textContent='❌ '+msg.message;
            break;
        case 'game_action':
            handleGameAction(msg.action);
            break;
    }
}

function renderPlayerList(players){
    const list=$('online-player-list');
    if(!list)return;
    list.innerHTML='';
    const others=players.filter(p=>p.name!==onlinePlayerName);
    if(others.length===0){
        list.innerHTML='<p style="text-align:center;color:var(--text-secondary);padding:20px;font-size:13px;">他のプレイヤーを待っています...</p>';
        return;
    }
    others.forEach(p=>{
        const div=document.createElement('div');
        const iSelected=players.find(x=>x.name===onlinePlayerName)?.selected===p.name;
        const theySelectedMe=p.selected===onlinePlayerName;
        div.style.cssText=`display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:var(--glass-bg);border-radius:8px;border:1px solid ${iSelected?'var(--gold)':theySelectedMe?'#4ecdc4':'var(--glass-border)'};cursor:pointer;transition:all .2s;`;
        let statusText='';
        if(iSelected&&theySelectedMe)statusText='<span style="color:#4ecdc4;font-size:11px;">マッチング中...</span>';
        else if(iSelected)statusText='<span style="color:var(--gold);font-size:11px;">選択中 ⏳</span>';
        else if(theySelectedMe)statusText='<span style="color:#4ecdc4;font-size:11px;">あなたを選択中！</span>';
        div.innerHTML=`<span style="font-family:'Orbitron',sans-serif;font-weight:700;letter-spacing:2px;font-size:14px;">${p.name}</span>${statusText}`;
        div.addEventListener('click',()=>{
            AudioSys.playSe('click');
            if(iSelected){
                sendOnline({type:'deselect_opponent'});
                $('online-status').textContent='選択を解除しました';
            } else {
                sendOnline({type:'select_opponent',name:p.name});
                $('online-status').textContent=`${p.name} を選択しました。相手があなたを選べばマッチ！`;
            }
        });
        div.addEventListener('mouseenter',()=>div.style.background='rgba(255,255,255,0.08)');
        div.addEventListener('mouseleave',()=>div.style.background='var(--glass-bg)');
        list.appendChild(div);
    });
}

function showOnlineDeckScreen(opponentName){
    showScreen('deck');GS.p1Char=null;GS.p2Char=null;
    GS.onlineReady={p1:false,p2:false};
    if(GS.onlineRole==='host'){
        $('deck-title').textContent='デッキ選択 - オンライン (ホスト)';
    } else {
        $('deck-title').textContent='デッキ選択 - オンライン (ゲスト)';
    }
    $('deck-player-label').textContent='自分のキャラカード';
    $('deck-subtitle').textContent=`対戦相手: ${opponentName || '???'}`;
    $('opponent-deck-section').classList.add('hidden');
    $('p2-deck-section').classList.add('hidden');
    renderCards('char-cards-grid','p1');
    $('btn-battle-start').disabled=true;
    hideDetail();
}

// Override selectCard for online
const _origSelectCard=selectCard;
function onlineSelectCard(cid,role,gid){
    if(GS.mode!=='online'){_origSelectCard(cid,role,gid);return;}
    _origSelectCard(cid,role,gid);
    if(role==='p1'&&GS.p1Char){
        sendAction({type:'char_select',charId:GS.p1Char.id});
        const myReady=GS.onlineRole==='host'?'p1':'p2';
        GS.onlineReady[myReady]=true;
        checkOnlineReady();
    } else if(role==='p1'&&!GS.p1Char){
        const myReady=GS.onlineRole==='host'?'p1':'p2';
        GS.onlineReady[myReady]=false;
        sendAction({type:'char_deselect'});
        $('btn-battle-start').disabled=true;
    }
}
selectCard=onlineSelectCard;

function checkOnlineReady(){
    if(GS.onlineRole==='host'){
        $('btn-battle-start').disabled=!(GS.onlineReady.p1&&GS.onlineReady.p2);
    } else {
        $('btn-battle-start').disabled=true;
    }
}

$('btn-battle-start').addEventListener('click',()=>{
    if(GS.mode!=='online')return;
    if(GS.onlineRole!=='host')return;
    if(!GS.p1Char||!GS.p2Char)return;
    AudioSys.playSe('confirm');hideDetail();
    const coinResult=Math.random()<.5;
    GS.p1IsAttacker=coinResult;
    sendAction({type:'start_battle',p1IsAttacker:coinResult,p1CharId:GS.p1Char.id,p2CharId:GS.p2Char.id});
    startBattle();
});

function handleGameAction(action){
    switch(action.type){
        case 'char_select':{
            const ch=CHARACTERS.find(c=>c.id===action.charId);
            if(!ch)return;
            if(GS.onlineRole==='host'){
                GS.p2Char=ch;GS.onlineReady.p2=true;
            } else {
                GS.p2Char=ch;GS.onlineReady.p1=true;
            }
            $('deck-subtitle').textContent=`相手が ${ch.name} を選択しました！`;
            checkOnlineReady();
            break;
        }
        case 'char_deselect':{
            if(GS.onlineRole==='host'){GS.p2Char=null;GS.onlineReady.p2=false;}
            else{GS.p2Char=null;GS.onlineReady.p1=false;}
            $('deck-subtitle').textContent='相手がキャラを再選択中...';
            $('btn-battle-start').disabled=true;
            break;
        }
        case 'start_battle':{
            // ゲスト: ホストの画面と同じキャラ配置にする（反転なし）
            GS.p1Char=CHARACTERS.find(c=>c.id===action.p1CharId);
            GS.p2Char=CHARACTERS.find(c=>c.id===action.p2CharId);
            GS.p1IsAttacker=action.p1IsAttacker;
            startBattle();
            break;
        }
        case 'dice_values':{
            const player=action.player;
            if(player===1){
                GS.rolledDice=action.dice.map((d,i)=>({type:d.type,value:d.value,index:i,selected:false}));
                GS.activePlayer=1;
                renderP1Dice(true);
            } else {
                GS.rolledDiceP2=action.dice.map((d,i)=>({type:d.type,value:d.value,index:i,selected:false}));
                GS.activePlayer=2;
                renderP2Dice(true);
            }
            updateSelectionUI();updateActionButtons();
            AudioSys.playSe('roll');
            break;
        }
        case 'dice_toggle':{
            const player=action.player;
            if(player===1){
                const d=GS.rolledDice[action.index];if(d)d.selected=!d.selected;
                GS.activePlayer=1;renderP1Dice();
            } else {
                const d=GS.rolledDiceP2[action.index];if(d)d.selected=!d.selected;
                GS.activePlayer=2;renderP2Dice();
            }
            updateSelectionUI();updateActionButtons();
            AudioSys.playSe('select');
            break;
        }
        case 'reroll':{
            const player=action.player;
            if(player===1){
                action.dice.forEach((d,i)=>{if(GS.rolledDice[i]){GS.rolledDice[i].value=d.value;GS.rolledDice[i].selected=false;}});
                GS.rerollsLeft--;GS.activePlayer=1;renderP1Dice(true);
            } else {
                action.dice.forEach((d,i)=>{if(GS.rolledDiceP2[i]){GS.rolledDiceP2[i].value=d.value;GS.rolledDiceP2[i].selected=false;}});
                GS.rerollsLeftP2--;GS.activePlayer=2;renderP2Dice(true);
            }
            updateSelectionUI();updateActionButtons();
            AudioSys.playSe('reroll');
            break;
        }
        case 'confirm':{
            AudioSys.playSe('confirm');
            if(action.phase==='attack'){
                GS.attackerSelectedDice=action.selectedDice;
                startDefensePhase();
            } else {
                GS.defenderSelectedDice=action.selectedDice;
                startDamageCalc();
            }
            break;
        }
        case 'guest_coin_ready':{
            // ホスト: ゲストが準備完了→開始ボタン有効化
            if(GS.onlineRole==='host'){
                $('btn-coin-ok').disabled=false;
            }
            break;
        }
        case 'coin_ok':{
            // ゲスト: ホストが開始→コインオーバーレイ閉じてターン開始
            $('coin-overlay').classList.add('hidden');
            startTurn();
            break;
        }
    }
}

// ============ setupP1Dice / setupP2Dice online hooks ============
const _origSetupP1Dice=setupP1Dice;
setupP1Dice=function(ch,isAtk,extraRerolls=0){
    if(GS.mode==='online'&&!isMyTurn()){
        GS.hasRolled=true;GS.activePlayer=1;GS.maxSelections=isAtk?ch.atk:ch.def;
        GS.rerollsLeft=isAtk?2:extraRerolls;
        $('action-panel-right').classList.remove('hidden');
        updateActionButtons();
        return;
    }
    _origSetupP1Dice(ch,isAtk,extraRerolls);
    if(GS.mode==='online'){
        sendAction({type:'dice_values',player:1,dice:GS.rolledDice.map(d=>({type:d.type,value:d.value}))});
    }
};

const _origSetupP2Dice=setupP2Dice;
setupP2Dice=function(ch,isAtk,extraRerolls=0){
    if(GS.mode==='online'&&!isMyTurn()){
        GS.hasRolled=true;GS.activePlayer=2;GS.maxSelections=isAtk?ch.atk:ch.def;
        GS.rerollsLeftP2=isAtk?2:extraRerolls;
        $('action-panel-right').classList.remove('hidden');
        updateActionButtons();
        return;
    }
    _origSetupP2Dice(ch,isAtk,extraRerolls);
    if(GS.mode==='online'){
        sendAction({type:'dice_values',player:2,dice:GS.rolledDiceP2.map(d=>({type:d.type,value:d.value}))});
    }
};

// ============ UI Event Handlers ============
document.addEventListener('DOMContentLoaded',()=>{
    // タイトル画面の⚙設定ボタン
    const btnTitleSettings=$('btn-title-settings');
    if(btnTitleSettings){
        btnTitleSettings.addEventListener('click',()=>{
            AudioSys.playSe('click');
            $('settings-modal').classList.remove('hidden');
            $('btn-quit-game').style.display='none';
        });
    }

    // ページ更新ボタン
    const btnRefresh=$('btn-page-refresh');
    if(btnRefresh){
        btnRefresh.addEventListener('click',()=>{
            location.reload();
        });
    }

    // オンラインプレイボタン
    const btnOnline=$('btn-online-play');
    if(btnOnline){
        btnOnline.addEventListener('click',()=>{
            AudioSys.playSe('click');
            $('multi-mode-modal').classList.add('hidden');
            $('online-modal').classList.remove('hidden');
            $('online-step-connect').classList.remove('hidden');
            $('online-step-lobby').classList.add('hidden');
            $('btn-online-connect').disabled=false;
            $('btn-online-connect').textContent='接続';
            $('btn-online-set-name').disabled=true;
            $('online-player-name').value='';
            $('online-status').textContent='';
            if(ws&&ws.readyState===WebSocket.OPEN){
                $('btn-online-connect').textContent='接続済み';
                $('btn-online-connect').disabled=true;
                $('btn-online-set-name').disabled=false;
                if(onlinePlayerName){
                    $('online-step-connect').classList.add('hidden');
                    $('online-step-lobby').classList.remove('hidden');
                    $('online-my-name').textContent=`あなた: ${onlinePlayerName}`;
                    $('online-status').textContent='対戦相手を選んでください';
                }
            }
        });
    }

    // 接続ボタン
    const btnConnect=$('btn-online-connect');
    if(btnConnect){
        btnConnect.addEventListener('click',async()=>{
            const url=$('online-server-url').value.trim();
            if(!url){$('online-status').textContent='URLを入力してください';return;}
            $('online-status').textContent='接続中...';
            $('btn-online-connect').disabled=true;
            try{
                await connectToServer(url);
                $('online-status').textContent='✅ 接続成功！プレイヤー名を入力してください';
                $('btn-online-connect').textContent='接続済み';
                $('btn-online-set-name').disabled=false;
            }catch(e){
                $('online-status').textContent='❌ 接続失敗。URLを確認してください';
                $('btn-online-connect').disabled=false;
            }
        });
    }

    // 名前登録ボタン
    const btnSetName=$('btn-online-set-name');
    if(btnSetName){
        btnSetName.addEventListener('click',()=>{
            const name=$('online-player-name').value.trim().toUpperCase();
            if(!name||!/^[A-Z0-9]+$/.test(name)||name.length>6){
                $('online-status').textContent='英数字6文字以内で入力してください';
                return;
            }
            AudioSys.playSe('click');
            sendOnline({type:'set_name',name});
        });
    }

    // 対戦確認モーダルのボタン
    const btnMatchAccept=$('btn-match-accept');
    if(btnMatchAccept){
        btnMatchAccept.addEventListener('click',()=>{
            AudioSys.playSe('confirm');
            sendOnline({type:'match_accept'});
            $('btn-match-accept').disabled=true;
            $('btn-match-decline').disabled=true;
            $('match-confirm-status').textContent='相手の返答を待っています...';
        });
    }
    const btnMatchDecline=$('btn-match-decline');
    if(btnMatchDecline){
        btnMatchDecline.addEventListener('click',()=>{
            AudioSys.playSe('click');
            sendOnline({type:'match_decline'});
            $('match-confirm-modal').classList.add('hidden');
            $('online-status').textContent='対戦を辞退しました';
        });
    }
});
