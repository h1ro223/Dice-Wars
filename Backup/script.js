/* ============================================
   サイコロ・ウォーズ v1.6 - script.js
   ============================================ */

// ========== サーバーURL設定 (ここを変更すればデフォルトURLが変わります) ==========
const DEFAULT_SERVER_URL = 'wss://dice-wars-0rcs.onrender.com';

// ============ Audio System - Web Audio API (BGM / SE) ============
// iOS Safari対応: AudioBufferSourceNode使用で低遅延 & Dynamic Island非表示
class SoundManager {
    constructor(){
        this.bgmOn = true;
        this.seOn = true;
        this.ctx = null;           // AudioContext (lazy init)
        this._buffers = {};        // { name: AudioBuffer }
        this._bgmSource = null;    // 現在再生中のBGM AudioBufferSourceNode
        this._bgmGain = null;      // BGM用GainNode
        this._currentBgmName = null;
        this._unlocked = false;
        this._preloaded = false;
        this._preloadPromise = null;
    }

    // AudioContextを生成（ユーザー操作内で呼ぶ）
    _ensureContext(){
        if(!this.ctx){
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
        return this.ctx;
    }

    // iOS制限解除: ユーザー操作時に呼ぶ
    async unlock(){
        if(this._unlocked) return;
        this._ensureContext();
        if(this.ctx.state === 'suspended'){
            await this.ctx.resume().catch(()=>{});
        }
        // iOS Safari: 無音バッファを再生してAudioContextをアンロック
        try{
            const buf = this.ctx.createBuffer(1, 1, this.ctx.sampleRate);
            const src = this.ctx.createBufferSource();
            src.buffer = buf;
            src.connect(this.ctx.destination);
            src.start(0);
        }catch(e){}
        // mediaSession非表示対策
        if('mediaSession' in navigator){
            navigator.mediaSession.playbackState = 'none';
            try{
                navigator.mediaSession.metadata = null;
                navigator.mediaSession.setActionHandler('play', null);
                navigator.mediaSession.setActionHandler('pause', null);
            }catch(e){}
        }
        this._unlocked = true;
    }

    // 全音声ファイルをプリロード
    async preload(){
        if(this._preloadPromise) return this._preloadPromise;
        this._preloadPromise = this._doPreload();
        return this._preloadPromise;
    }
    async _doPreload(){
        if(this._preloaded) return;
        this._ensureContext();
        const files = {
            // BGM
            'bgm_title':  './BGM/Title.mp3',
            'bgm_battle': './BGM/Battle.mp3',
            // SE (21種)
            'cursor':      './SE/Cursor.mp3',
            'btnSelect':   './SE/ButtonSelect.mp3',
            'cancel':      './SE/Cancel.mp3',
            'diceRoll':    './SE/DiceRoll.mp3',
            'diceSelect':  './SE/DiceSelect.mp3',
            'diceCount':   './SE/DiceCount.mp3',
            'battleStart': './SE/BattleStart.mp3',
            'coinToss':    './SE/CoinToss.mp3',
            'coinFinish':  './SE/CoinTossFinish.mp3',
            'attack1':     './SE/Attack1.mp3',
            'attack2':     './SE/Attack2.mp3',
            'damage':      './SE/Damage.mp3',
            'noDamage':    './SE/NoDamage.mp3',
            'spDamage':    './SE/SPDamage.mp3',
            'win':         './SE/Win.mp3',
            'lose':        './SE/Lose.mp3',
            'cure':        './SE/Cure.mp3',
            'cheat':       './SE/Cheat.mp3',
            'powerUp':     './SE/PowerUP.mp3',
            'turn':        './SE/Turn.mp3',
            'hpRed':       './SE/HPRed.mp3',
        };
        const loadOne = async (name, url) => {
            try{
                const res = await fetch(url);
                const arrayBuf = await res.arrayBuffer();
                this._buffers[name] = await this.ctx.decodeAudioData(arrayBuf);
            }catch(e){
                console.warn(`[SoundManager] Failed to load: ${url}`, e);
            }
        };
        await Promise.all(Object.entries(files).map(([n,u]) => loadOne(n,u)));
        this._preloaded = true;
    }

    // SE再生 (AudioBufferSourceNode → 低遅延, メディアコントロール非表示)
    _playSE(name, volume=0.5){
        if(!this.ctx || !this._buffers[name]) return;
        if(this.ctx.state === 'suspended') this.ctx.resume().catch(()=>{});
        const source = this.ctx.createBufferSource();
        source.buffer = this._buffers[name];
        const gain = this.ctx.createGain();
        gain.gain.value = volume;
        source.connect(gain).connect(this.ctx.destination);
        source.start(0);
        // mediaSession非表示維持
        if('mediaSession' in navigator){
            navigator.mediaSession.playbackState = 'none';
        }
    }

    // 公開SE再生API (既存のAudioSys.playSe()と同じ引数体系)
    playSe(type){
        if(!this.seOn) return;
        switch(type){
            case 'hover': case 'cursor':        this._playSE('cursor');      break;
            case 'click': case 'confirm':       this._playSE('btnSelect');   break;
            case 'select':                      this._playSE('btnSelect');   break;
            case 'deselect': case 'cancel':     this._playSE('cancel');      break;
            case 'roll':    case 'reroll':      this._playSE('diceRoll');    break;
            case 'dice-select':                 this._playSE('diceSelect');  break;
            case 'damage':                      this._playSE('damage');      break;
            case 'shield':  case 'no-damage':   this._playSE('noDamage');    break;
            case 'sp-damage':                   this._playSE('spDamage');    break;
            case 'clash':       this._playSE(Math.random()<0.5?'attack1':'attack2'); break;
            case 'battle-start':                this._playSE('battleStart'); break;
            case 'coin':                        this._playSE('coinToss');    break;
            case 'coin-finish':                 this._playSE('coinFinish');  break;
            case 'win':                         this._playSE('win');         break;
            case 'lose':                        this._playSE('lose');        break;
            case 'cure':                        this._playSE('cure');        break;
            case 'cheat':                       this._playSE('cheat');       break;
            case 'power-up':                    this._playSE('powerUp');     break;
            case 'turn':                        this._playSE('turn');        break;
            case 'hp-red':                      this._playSE('hpRed');       break;
            case 'atk-show': case 'def-show':   this._playSE('diceCount');   break;
        }
    }

    // BGM再生 (ループ対応, フェードイン)
    playBgm(which){
        if(!this.bgmOn) return;
        const bufName = which === 'battle' ? 'bgm_battle' : 'bgm_title';
        if(!this.ctx || !this._buffers[bufName]) return;
        // 同じBGMが既に再生中ならスキップ
        if(this._currentBgmName === bufName && this._bgmSource) return;
        this.stopBgm();
        if(this.ctx.state === 'suspended') this.ctx.resume().catch(()=>{});
        const source = this.ctx.createBufferSource();
        source.buffer = this._buffers[bufName];
        source.loop = true;
        const gainNode = this.ctx.createGain();
        gainNode.gain.setValueAtTime(0, this.ctx.currentTime);
        // フェードイン: 0 → 0.3 を0.75秒かけて
        gainNode.gain.linearRampToValueAtTime(0.3, this.ctx.currentTime + 0.75);
        source.connect(gainNode).connect(this.ctx.destination);
        source.start(0);
        this._bgmSource = source;
        this._bgmGain = gainNode;
        this._currentBgmName = bufName;
        // mediaSession非表示維持
        if('mediaSession' in navigator){
            navigator.mediaSession.playbackState = 'none';
        }
    }

    stopBgm(){
        if(this._bgmSource){
            try{ this._bgmSource.stop(0); }catch(e){}
            this._bgmSource.disconnect();
            this._bgmSource = null;
        }
        if(this._bgmGain){
            this._bgmGain.disconnect();
            this._bgmGain = null;
        }
        this._currentBgmName = null;
    }

    toggleBgm(on){
        this.bgmOn = on;
        if(!on) this.stopBgm();
        else{
            const scr = typeof GS !== 'undefined' ? GS.currentScreen : 'title';
            this.playBgm(scr === 'battle' ? 'battle' : 'title');
        }
    }

    toggleSe(on){ this.seOn = on; }

    // 後方互換: AudioSys.init() 呼び出し箇所のため
    init(){ /* SoundManagerではpreload()で代替。ここは何もしない */ }
}

// グローバルインスタンス生成 & 後方互換エイリアス
const AudioSys = new SoundManager();

// v1.5.1: BGM再生待ちフラグ（preload完了前にクリックされた場合に備える）
let _audioBgmPending = true;

// 初回インタラクションでオーディオ unlock + プリロード + BGM開始 (Safari iOS対応)
// v1.5.1: once:true を外し、preload完了後にBGMが再生されるまで毎回試行する
function _unlockAudio(){
    // unlock は非同期だが、ユーザージェスチャー内で即座にresume()する
    AudioSys.unlock().then(() => {
        return AudioSys.preload();
    }).then(() => {
        if(_audioBgmPending && AudioSys.bgmOn){
            const scr = typeof GS !== 'undefined' ? GS.currentScreen : 'title';
            AudioSys.playBgm(scr === 'battle' ? 'battle' : 'title');
            // BGM再生成功したらリスナーを解除
            if(AudioSys._bgmSource){
                _audioBgmPending = false;
                document.removeEventListener('click', _unlockAudio);
                document.removeEventListener('touchstart', _unlockAudio);
            }
        }
    }).catch(() => {});
}
document.addEventListener('click', _unlockAudio);
document.addEventListener('touchstart', _unlockAudio);

// Settings toggles
document.addEventListener('DOMContentLoaded', () => {
    const bgmToggle = document.getElementById('toggle-bgm');
    const seToggle  = document.getElementById('toggle-se');
    if(bgmToggle){
        bgmToggle.addEventListener('change', () => {
            AudioSys.toggleBgm(bgmToggle.checked);
        });
    }
    if(seToggle){
        seToggle.addEventListener('change', () => AudioSys.toggleSe(seToggle.checked));
    }
});

// Hover SE for interactive elements
// v1.5.1: 同一要素内の子要素移動で重複再生されるのを防止
let _lastHoveredEl = null;
document.addEventListener('mouseover', (e) => {
    const t = e.target.closest('button, .char-card, .dice:not(.rolling):not(.locked)');
    if (t && t !== _lastHoveredEl) {
        _lastHoveredEl = t;
        AudioSys.playSe('hover');
    }
});
document.addEventListener('mouseout', (e) => {
    const t = e.target.closest('button, .char-card, .dice:not(.rolling):not(.locked)');
    if (t && t === _lastHoveredEl) {
        // 子要素への移動ではなく、要素外に出た場合のみリセット
        const related = e.relatedTarget;
        if (!related || !t.contains(related)) {
            _lastHoveredEl = null;
        }
    }
});

// ============ キャラカードデータ ============
const CHARACTERS = [
    {
        id:1, name:'ガルム', emoji:'🐺', hp:24, atk:3, def:3,
        dice:[{type:6,label:'6D'},{type:6,label:'6D'},{type:4,label:'4D'},{type:4,label:'4D'}],
        abilityDesc:'【攻撃時】選んだサイコロの中に同じ出目のペア(2つ以上)がある場合、ダメージ+2のボーナス。さらに、そのペアの出目が「4」の場合はダメージ+5に強化される。（※複数ペアがあれば全て発動）',
        abilityType:'attack',
        ability(sel){ let b=0,d=[]; const c={}; sel.forEach(s=>{c[s.value]=(c[s.value]||0)+1}); for(const[v,n]of Object.entries(c)){if(n>=2){if(+v===4){b+=5;d.push(`出目4のペア！ ダメージ+5`)}else{b+=2;d.push(`出目${v}のペア！ ダメージ+2`)}}} return{bonus:b,desc:d}; }
    },
    {
        id:2, name:'ホースラ', emoji:'🦊', hp:25, atk:3, def:3,
        dice:[{type:6,label:'6D'},{type:4,label:'4D'},{type:4,label:'4D'},{type:4,label:'4D'}],
        abilityDesc:'【防御時】通常の防御リロール(0回)に加え、追加でリロールチャンスを1回獲得(計1回可能)。さらに、選んだサイコロの中にペア(同じ出目2つ以上)がある場合、通常のダメージ計算とは別に、相手に即時4ダメージを与える。',
        abilityType:'defense', defenseReroll:1,
        ability(sel){ let id=0,d=[]; const c={}; sel.forEach(s=>{c[s.value]=(c[s.value]||0)+1}); for(const[,n]of Object.entries(c)){if(n>=2){id+=4;d.push(`防御時ペア発動！ 相手に即時4ダメージ！`)}} return{bonus:0,desc:d,instantDamage:id}; }
    },
    {
        id:3, name:'ジャスパー', emoji:'🦁', hp:24, atk:4, def:2,
        dice:[{type:6,label:'6D'},{type:6,label:'6D'},{type:4,label:'4D'},{type:4,label:'4D'},{type:4,label:'4D'}],
        abilityDesc:'【攻撃時】選んだサイコロに同じ出目が2つ(ペア)ある場合、ダメージ+3。3つなら+7、4つなら上限の+11。同じ数字を揃えるほど強力！（※1回の攻撃でボーナスは1セットのみ適用）',
        abilityType:'attack',
        ability(sel){ let b=0,d=[]; const c={}; sel.forEach(s=>{c[s.value]=(c[s.value]||0)+1}); let applied=false; for(const[v,n]of Object.entries(c)){if(n>=2&&!applied){const x=3+4*(n-2);const capped=Math.min(x,11);b+=capped;d.push(`出目${v}が${n}つ！ ダメージ+${capped}`);applied=true;}} return{bonus:b,desc:d}; }
    },
    {
        id:4, name:'クライシス', emoji:'🐉', hp:25, atk:3, def:2,
        dice:[{type:8,label:'8D'},{type:6,label:'6D'},{type:6,label:'6D'},{type:4,label:'4D'},{type:4,label:'4D'}],
        abilityDesc:'【攻撃時・防御時】自分のHPが15以下になると「イカサマ」が発動。相手が選んだサイコロの中で最も高い出目1つを強制的に「3」に変える。攻撃・防御の両フェーズで適用される。',
        abilityType:'cheat_both',
        ability(sel,hp){ let d=[]; const a=hp<=15; if(a)d.push(`イカサマ発動！ 相手の最大出目を3に！`); return{bonus:0,desc:d,cheat:a}; }
    },
    {
        id:5, name:'ドラン', emoji:'🐲', hp:26, atk:4, def:3,
        dice:[{type:6,label:'6D'},{type:4,label:'4D'},{type:4,label:'4D'},{type:4,label:'4D'},{type:4,label:'4D'}],
        abilityDesc:'【防御時】ダメージを1以上受けた場合、反射で相手に即時1ダメージ。ただし、選んだ防御サイコロの出目が「全て奇数」なら、反射ダメージが即時4ダメージに強化される。（ダメージ0の場合は不発）',
        abilityType:'defense_doran',
        ability(sel,dmg){ let id=0,d=[]; if(dmg>0){const allOdd=sel.every(s=>s.value%2===1);if(allOdd){id=4;d.push(`全て奇数！ 相手に即時4ダメージ！`)}else{id=1;d.push(`ダメージ反射！ 相手に即時1ダメージ！`)}} return{bonus:0,desc:d,instantDamage:id}; }
    },
    {
        id:6, name:'ライアン', emoji:'🦅', hp:25, atk:3, def:3,
        dice:[{type:6,label:'6D'},{type:6,label:'6D'},{type:4,label:'4D'},{type:4,label:'4D'},{type:4,label:'4D'}],
        abilityDesc:'【防御時】リロールチャンスを1回獲得。防御で受けるダメージが0の場合、HPを3回復する(1試合中に最大2回まで)。さらに、ターン終了時にHPが5以下の場合、DEFが+1される(HPが6以上に戻ると解除)。',
        abilityType:'defense_ryan', defenseReroll:1,
        ability(sel,dmg){ let d=[],heal=0; if(dmg===0){heal=3;d.push(`ダメージ無効！ HP3回復！`)} return{bonus:0,desc:d,heal:heal}; }
    },
    {
        id:7, name:'オーガスト', emoji:'🐻', hp:25, atk:3, def:2,
        dice:[{type:6,label:'6D'},{type:6,label:'6D'},{type:4,label:'4D'},{type:4,label:'4D'},{type:4,label:'4D'}],
        abilityDesc:'【攻撃時】攻撃ダメージ計算後、パワーを2層獲得する。選んだサイコロの出目が「全て偶数」なら4層獲得。次回の攻撃時、蓄積パワーの層数ぶんだけダメージに加算して全消費する。（パワーは最大4層まで蓄積可能）',
        abilityType:'attack_august',
        ability(sel){ const allEven=sel.every(s=>s.value%2===0); return{stacks:allEven?4:2,desc:allEven?[`全て偶数！ パワー4層獲得！`]:[`パワー2層獲得！`]}; }
    },
    {
        id:8, name:'ミラクル', emoji:'🦄', hp:24, atk:4, def:4,
        dice:[{type:4,label:'4D'},{type:4,label:'4D'},{type:4,label:'4D'},{type:4,label:'4D'},{type:4,label:'4D'}],
        abilityDesc:'【攻撃時・防御時】選んだサイコロの出目が全て「4」の場合、相手のHPを強制的に4にする(相手HPが4以下なら不発)。通常のダメージ計算は無効化される。ただし攻撃時のみ、出目が全て「4」でなければ自分に即時4ダメージのペナルティ(自分のHPが4以下なら不発)。',
        abilityType:'miracle',
        ability(sel){ const allFour=sel.every(s=>s.value===4); return{allFour,desc:allFour?[`全て4！ ミラクル発動！`]:[]}; }
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
    // v1.5: HP赤フラグ
    _p1HpWasRed:false, _p2HpWasRed:false,
    // v1.5.1: ターン管理 (1ターン=両者攻防)
    _turnFirstAttacker:true,
    _turnHalf:0,
    // v1.6: 新ステート
    ryanHealCount:{p1:0,p2:0},
    augustConsumedThisTurn:{p1:false,p2:false},
    deckStep:1, p1Random:false, p2Random:false,
    miracleDmgOverride:false,
    // オンライン
    onlineRole:null,
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
$('btn-news').addEventListener('click',()=>{AudioSys.playSe('click');$('news-modal').classList.remove('hidden')});
$('btn-settings').addEventListener('click',()=>{AudioSys.playSe('click');$('settings-modal').classList.remove('hidden');$('btn-quit-game').style.display='';});
$('btn-quit-game').addEventListener('click',()=>{AudioSys.playSe('click');$('settings-modal').classList.add('hidden');$('quit-confirm-modal').classList.remove('hidden');});
$('btn-quit-cancel').addEventListener('click',()=>{AudioSys.playSe('click');$('quit-confirm-modal').classList.add('hidden')});
$('btn-quit-confirm').addEventListener('click',()=>{AudioSys.playSe('confirm');$('quit-confirm-modal').classList.add('hidden');resetBattleState();GS.p1Char=null;GS.p2Char=null;showScreen('title');});
$('btn-page-refresh').addEventListener('click',()=>{location.reload();});

document.querySelectorAll('.modal-close-btn').forEach(b=>{b.addEventListener('click',()=>{AudioSys.playSe('click');const id=b.dataset.close;if(id)$(id).classList.add('hidden');});});
document.querySelectorAll('.modal-overlay').forEach(o=>{o.addEventListener('click',e=>{if(e.target===o){AudioSys.playSe('click');o.classList.add('hidden');}});});

// ============ Deck Screen ============
function showDeckScreen(){
    showScreen('deck');GS.p1Char=null;GS.p2Char=null;GS.cpuOpponentChoice=null;
    GS.p1Random=false;GS.p2Random=false;GS.deckStep=1;
    showDeckStep1();
}

function showDeckStep1(){
    GS.deckStep=1;
    if(GS.mode==='cpu'){
        $('deck-title').textContent='デッキ選択 - VS CPU';
        $('deck-subtitle').textContent='自分のキャラカードを選ぶ';
        $('deck-player-label').textContent='自分のキャラカード';
    } else {
        $('deck-title').textContent='デッキ選択 - マルチプレイ';
        $('deck-subtitle').textContent='1Pのキャラカードを選ぶ';
        $('deck-player-label').textContent='1Pのキャラカード';
    }
    $('p1-deck-section').classList.remove('hidden');
    $('opponent-deck-section').classList.add('hidden');
    $('p2-deck-section').classList.add('hidden');
    renderCards('char-cards-grid','p1',true);
    // Re-apply p1 selection if already chosen (back from step 2)
    if(GS.p1Char){
        const g=$('char-cards-grid');
        g.querySelectorAll('.char-card').forEach(c=>c.classList.toggle('selected',+c.dataset.charId===GS.p1Char.id));
    } else if(GS.p1Random){
        const g=$('char-cards-grid');
        g.querySelectorAll('.char-card').forEach(c=>c.classList.toggle('selected',c.dataset.charId==='random'));
    }
    $('btn-battle-start').classList.add('hidden');
    $('btn-deck-next').classList.remove('hidden');
    $('btn-deck-next').disabled=!(GS.p1Char||GS.p1Random);
    $('btn-back-title').textContent='戻る';
    hideDetail();
}

function showDeckStep2(){
    GS.deckStep=2;
    $('p1-deck-section').classList.add('hidden');
    $('btn-deck-next').classList.add('hidden');
    $('btn-battle-start').classList.remove('hidden');
    $('btn-battle-start').disabled=true;
    $('btn-back-title').textContent='← 戻る';
    if(GS.mode==='cpu'){
        $('deck-subtitle').textContent='相手のキャラカードを選ぶ';
        $('opponent-deck-section').classList.remove('hidden');
        $('p2-deck-section').classList.add('hidden');
        renderOpponentCards();
    } else {
        $('deck-subtitle').textContent='2Pのキャラカードを選ぶ';
        $('opponent-deck-section').classList.add('hidden');
        $('p2-deck-section').classList.remove('hidden');
        renderCards('p2-cards-grid','p2',true);
    }
    hideDetail();
}

function renderCards(gridId,role,includeRandom=false){
    const g=$(gridId);g.innerHTML='';
    if(includeRandom){
        const rc=document.createElement('div');rc.className='char-card random-card';rc.dataset.charId='random';rc.dataset.role=role;
        rc.innerHTML=`<div class="char-emoji">❓</div><div class="char-card-name">おまかせ</div><div class="char-card-stats"><span>ランダム</span></div>`;
        rc.addEventListener('click',()=>selectCard('random',role,gridId));g.appendChild(rc);
    }
    CHARACTERS.forEach(ch=>{
        const c=document.createElement('div');c.className='char-card';c.dataset.charId=ch.id;c.dataset.role=role;
        c.innerHTML=`<div class="char-emoji">${ch.emoji}</div><div class="char-card-name">${ch.name}</div><div class="char-card-stats"><span>❤️${ch.hp}</span><span>⚔️${ch.atk}</span><span>🛡️${ch.def}</span></div><div class="char-card-dice-preview">${ch.dice.map(d=>`<div class="mini-dice d${d.type}">${d.type}D</div>`).join('')}</div>`;
        c.addEventListener('click',()=>selectCard(ch.id,role,gridId));g.appendChild(c);
    });
}

function renderOpponentCards(){
    const g=$('opponent-cards-grid');g.innerHTML='';
    const rc=document.createElement('div');rc.className='char-card random-card';rc.dataset.charId='random';rc.dataset.role='cpu-opponent';
    rc.innerHTML=`<div class="char-emoji">❓</div><div class="char-card-name">おまかせ</div><div class="char-card-stats"><span>ランダム</span></div>`;
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
        if(cid==='random'){
            if(GS.p1Random){GS.p1Random=false;GS.p1Char=null;g.querySelectorAll('.char-card').forEach(c=>c.classList.remove('selected'));hideDetail();checkReady();return;}
            GS.p1Random=true;GS.p1Char=null;g.querySelectorAll('.char-card').forEach(c=>c.classList.toggle('selected',c.dataset.charId==='random'));hideDetail();
        } else {
            GS.p1Random=false;
            if(GS.p1Char&&GS.p1Char.id===cid){GS.p1Char=null;g.querySelectorAll('.char-card').forEach(c=>c.classList.remove('selected'));hideDetail();checkReady();return;}
            GS.p1Char=CHARACTERS.find(c=>c.id===cid);g.querySelectorAll('.char-card').forEach(c=>c.classList.toggle('selected',+c.dataset.charId===cid));showDetail(GS.p1Char);
        }
    } else if(role==='p2'){
        if(cid==='random'){
            if(GS.p2Random){GS.p2Random=false;GS.p2Char=null;g.querySelectorAll('.char-card').forEach(c=>c.classList.remove('selected'));hideDetail();checkReady();return;}
            GS.p2Random=true;GS.p2Char=null;g.querySelectorAll('.char-card').forEach(c=>c.classList.toggle('selected',c.dataset.charId==='random'));hideDetail();
        } else {
            GS.p2Random=false;
            if(GS.p2Char&&GS.p2Char.id===cid){GS.p2Char=null;g.querySelectorAll('.char-card').forEach(c=>c.classList.remove('selected'));hideDetail();checkReady();return;}
            GS.p2Char=CHARACTERS.find(c=>c.id===cid);g.querySelectorAll('.char-card').forEach(c=>c.classList.toggle('selected',+c.dataset.charId===cid));showDetail(GS.p2Char);
        }
    } else if(role==='cpu-opponent'){
        if(GS.cpuOpponentChoice===cid){GS.cpuOpponentChoice=null;GS.p2Char=null;g.querySelectorAll('.char-card').forEach(c=>c.classList.remove('selected'));hideDetail();checkReady();return;}
        GS.cpuOpponentChoice=cid;
        if(cid==='random')GS.p2Char=null; else {GS.p2Char=CHARACTERS.find(c=>c.id===cid);showDetail(GS.p2Char);}
        g.querySelectorAll('.char-card').forEach(c=>c.classList.toggle('selected',c.dataset.charId===String(cid)));
    }
    checkReady();
    AudioSys.playSe('select');
}
function checkReady(){
    if(GS.deckStep===0) return; // online mode
    if(GS.deckStep===1){
        $('btn-deck-next').disabled=!(GS.p1Char||GS.p1Random);
    } else {
        if(GS.mode==='cpu') $('btn-battle-start').disabled=!(GS.cpuOpponentChoice!==null);
        else $('btn-battle-start').disabled=!(GS.p2Char||GS.p2Random);
    }
}
function showDetail(ch){if(!ch)return;$('detail-name').textContent=ch.name;$('detail-hp').textContent=ch.hp;$('detail-atk').textContent=ch.atk;$('detail-def').textContent=ch.def;$('detail-dice-list').innerHTML=ch.dice.map(d=>`<div class="mini-dice d${d.type}" style="width:24px;height:24px;font-size:10px;">${d.label}</div>`).join('');$('detail-ability-text').textContent=ch.abilityDesc;$('char-detail-panel').classList.remove('hidden');}
function hideDetail(){$('char-detail-panel').classList.add('hidden');}

$('btn-close-detail').addEventListener('click',()=>{AudioSys.playSe('click');hideDetail();});
$('btn-detail-ok').addEventListener('click',()=>{AudioSys.playSe('click');hideDetail();});
$('btn-back-title').addEventListener('click',()=>{
    AudioSys.playSe('click');
    if(GS.deckStep===2){
        GS.cpuOpponentChoice=null;GS.p2Char=null;GS.p2Random=false;
        showDeckStep1();
        return;
    }
    GS.p1Char=null;GS.p2Char=null;GS.p1Random=false;GS.p2Random=false;
    hideDetail();showScreen('title');
});
$('btn-deck-next').addEventListener('click',()=>{
    if(!(GS.p1Char||GS.p1Random))return;
    AudioSys.playSe('confirm');hideDetail();showDeckStep2();
});
$('btn-battle-start').addEventListener('click',()=>{
    if(GS.mode==='online')return;
    if(GS.mode==='cpu'&&GS.cpuOpponentChoice===null)return;
    if(GS.mode==='multi'&&!GS.p2Char&&!GS.p2Random)return;
    AudioSys.playSe('battle-start');hideDetail();startBattle();
});

// ============ Battle ============
function startBattle(){
    // Resolve random selections
    if(GS.p1Random){
        GS.p1Char=CHARACTERS[Math.floor(Math.random()*CHARACTERS.length)];
    }
    if(GS.mode==='cpu'&&GS.cpuOpponentChoice==='random'){
        const a=CHARACTERS.filter(c=>c.id!==(GS.p1Char?GS.p1Char.id:-1));
        GS.p2Char=a[Math.floor(Math.random()*a.length)];
    } else if(GS.p2Random){
        const a=CHARACTERS.filter(c=>c.id!==(GS.p1Char?GS.p1Char.id:-1));
        GS.p2Char=a[Math.floor(Math.random()*a.length)];
    }
    GS.p1Hp=GS.p1Char.hp;GS.p1MaxHp=GS.p1Char.hp;GS.p2Hp=GS.p2Char.hp;GS.p2MaxHp=GS.p2Char.hp;GS.turn=1;GS.animating=false;
    GS.powerStacks={p1:0,p2:0};GS.ryanDefBuff={p1:false,p2:false};GS._lastDmg=0;
    GS._p1HpWasRed=false;GS._p2HpWasRed=false;
    GS._turnHalf=0;
    // v1.6: 新ステート初期化
    GS.ryanHealCount={p1:0,p2:0};
    GS.augustConsumedThisTurn={p1:false,p2:false};
    GS.miracleDmgOverride=false;
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
        AudioSys.playSe('coin-finish');
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
    // v1.5.1: ターン表示 + 前半/後半の区別
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
    // v1.6: Reset August consumed flag + miracle override
    const atkKeyAug=GS.p1IsAttacker?'p1':'p2';
    GS.augustConsumedThisTurn[atkKeyAug]=false;
    GS.miracleDmgOverride=false;
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
    if(d.selected){d.selected=false;AudioSys.playSe('cancel');}
    else{const n=dice.filter(x=>x.selected).length;if(n>=dice.length)return;d.selected=true;AudioSys.playSe('dice-select');}
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
    const rcEl=$('reroll-count');
    rcEl.textContent=`${activeRerolls()}/2`;
    rcEl.style.color=activeRerolls()===0?'var(--danger)':'var(--success)';
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
    if(GS.phase==='attack'){
        GS.attackerSelectedDice=selectedData;
        // ミラクル攻撃時: 全4でなければ即時自傷 (HP>4のみ)
        const ac=atkChar();
        if(ac.abilityType==='miracle'){
            const allFour=selectedData.every(d=>d.value===4);
            if(!allFour){
                const myHp=GS.p1IsAttacker?GS.p1Hp:GS.p2Hp;
                if(myHp>4){
                    if(GS.p1IsAttacker) GS.p1Hp=Math.max(0,GS.p1Hp-4);
                    else GS.p2Hp=Math.max(0,GS.p2Hp-4);
                    AudioSys.playSe('sp-damage');
                    updateBattleUI();
                    showAbility('全て4でない！ 自分に即時4ダメージ！');
                    setTimeout(()=>{hideAbility();startDefensePhase();},1500);
                    return;
                }
            }
        }
        startDefensePhase();
    }
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
                    if(isAtk){
                        GS.attackerSelectedDice=selected;
                        // ミラクルCPU攻撃時: 全4でなければ即時自傷 (HP>4のみ)
                        const cpuChar=GS.p1IsAttacker?GS.p1Char:GS.p2Char;
                        if(cpuChar.abilityType==='miracle'){
                            const allFour=selected.every(d=>d.value===4);
                            if(!allFour){
                                const myHp=GS.p1IsAttacker?GS.p1Hp:GS.p2Hp;
                                if(myHp>4){
                                    if(GS.p1IsAttacker) GS.p1Hp=Math.max(0,GS.p1Hp-4);
                                    else GS.p2Hp=Math.max(0,GS.p2Hp-4);
                                    AudioSys.playSe('sp-damage');
                                    updateBattleUI();
                                    showAbility('全て4でない！ 自分に即時4ダメージ！');
                                    setTimeout(()=>{hideAbility();GS.currentActorIsHuman=true;GS.animating=false;startDefensePhase();},1500);
                                    return;
                                }
                            }
                        }
                        GS.currentActorIsHuman=true;GS.animating=false;
                        setTimeout(()=>startDefensePhase(),600);
                    } else {
                        GS.defenderSelectedDice=selected;
                        GS.currentActorIsHuman=true;GS.animating=false;
                        setTimeout(()=>startDamageCalc(),600);
                    }
                    return;
                }
                const d=toSelect[selIdx];d.selected=true;
                runningTotal+=d.value;
                renderCpuAllDice(dice,false);
                AudioSys.playSe('dice-select');
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
    let miracleOverride=false;

    // ======= ミラクル能力 (攻撃側) - HP4化のみ (自傷はconfirm時に処理済み) =======
    if(ac.abilityType==='miracle'){
        const allFour=GS.attackerSelectedDice.every(d=>d.value===4);
        if(allFour){
            const defHpNow=GS.p1IsAttacker?GS.p2Hp:GS.p1Hp;
            if(defHpNow>4){
                if(GS.p1IsAttacker) GS.p2Hp=4; else GS.p1Hp=4;
                miracleOverride=true;
                abilDescs.push('ミラクル発動！ 相手のHPを4に！');
                AudioSys.playSe('sp-damage');
                updateBattleUI();
            }
        }
    }

    // ======= ミラクル能力 (防御側) - HP4化のみ (防御時は自傷なし) =======
    if(dc.abilityType==='miracle'){
        const allFour=GS.defenderSelectedDice.every(d=>d.value===4);
        if(allFour){
            const atkHpNow=GS.p1IsAttacker?GS.p1Hp:GS.p2Hp;
            if(atkHpNow>4){
                if(GS.p1IsAttacker) GS.p1Hp=4; else GS.p2Hp=4;
                miracleOverride=true;
                abilDescs.push('ミラクル発動！ 攻撃側のHPを4に！');
                AudioSys.playSe('sp-damage');
                updateBattleUI();
            }
        }
    }

    // ======= クライシス イカサマ (攻撃側) =======
    if(ac.abilityType==='cheat_both'){
        const hp=GS.p1IsAttacker?GS.p1Hp:GS.p2Hp;
        if(hp<=15&&GS.defenderSelectedDice.length>0){
            let mi=0,mv=0;
            GS.defenderSelectedDice.forEach((d,i)=>{if(d.value>mv){mv=d.value;mi=i;}});
            if(mv>3){
                AudioSys.playSe('cheat');
                const ov=GS.defenderSelectedDice[mi].value;
                GS.defenderSelectedDice[mi].value=3;
                defTotal=GS.defenderSelectedDice.reduce((s,d)=>s+d.value,0);
                abilDescs.push(`イカサマ発動！ 防御出目 ${ov} → 3 に変更！`);
            }
        }
    }

    // ======= クライシス イカサマ (防御側) =======
    if(dc.abilityType==='cheat_both'){
        const hp=GS.p1IsAttacker?GS.p2Hp:GS.p1Hp;
        if(hp<=15&&GS.attackerSelectedDice.length>0){
            let mi=0,mv=0;
            GS.attackerSelectedDice.forEach((d,i)=>{if(d.value>mv){mv=d.value;mi=i;}});
            if(mv>3){
                AudioSys.playSe('cheat');
                const ov=GS.attackerSelectedDice[mi].value;
                GS.attackerSelectedDice[mi].value=3;
                atkTotal=GS.attackerSelectedDice.reduce((s,d)=>s+d.value,0);
                abilDescs.push(`イカサマ発動！ 攻撃出目 ${ov} → 3 に変更！`);
            }
        }
    }

    // ======= オーガスト: パワー消費 =======
    if(ac.abilityType==='attack_august'){
        const key=GS.p1IsAttacker?'p1':'p2';
        if(GS.powerStacks[key]>0){
            atkBonus+=GS.powerStacks[key];
            abilDescs.push(`パワー${GS.powerStacks[key]}層発動！ ダメージ+${GS.powerStacks[key]}`);
            GS.augustConsumedThisTurn[key]=true;
            GS.powerStacks[key]=0;
        }
    }

    // ======= 攻撃側能力 (ガルム、ジャスパー) =======
    if(ac.abilityType==='attack'){
        const r=ac.ability(GS.attackerSelectedDice);
        atkBonus+=r.bonus;abilDescs.push(...r.desc);
    }

    const totalAtk=atkTotal+atkBonus;
    const dmg=miracleOverride?0:Math.max(0,totalAtk-defTotal);
    GS._lastDmg=dmg;
    GS.miracleDmgOverride=miracleOverride;

    // ======= ホースラ 即時ダメージ =======
    if(dc.abilityType==='defense'){
        const r=dc.ability(GS.defenderSelectedDice);
        if(r.instantDamage>0){instantDmg+=r.instantDamage;abilDescs.push(...r.desc);}
    }

    // ======= ドラン 即時ダメージ =======
    if(dc.abilityType==='defense_doran'){
        const r=dc.ability(GS.defenderSelectedDice,dmg);
        if(r.instantDamage>0){instantDmg+=r.instantDamage;abilDescs.push(...r.desc);}
    }

    // ======= 即時ダメージ適用 (アニメーション前に即時適用) =======
    if(instantDmg>0){
        if(GS.p1IsAttacker) GS.p1Hp=Math.max(0,GS.p1Hp-instantDmg);
        else GS.p2Hp=Math.max(0,GS.p2Hp-instantDmg);
        AudioSys.playSe('sp-damage');
        updateBattleUI();
    }

    showInlineDamage(totalAtk,atkBonus,defTotal,dmg,abilDescs,instantDmg);
}

function showInlineDamage(totalAtk,atkBonus,defTotal,dmg,abilDescs,instantDmg){
    $('selection-total-display').classList.add('hidden');
    const di=$('damage-inline');
    const dr=$('dmg-result-display');
    di.classList.remove('hidden');dr.classList.add('hidden');

    const atkValEl=$('dmg-atk-val');
    const defValEl=$('dmg-def-val');
    const clashEl=$('dmg-clash');
    const atkSide=$('dmg-atk-side');
    const defSide=$('dmg-def-side');

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
        setTimeout(()=>{showAbility(abilDescs.join('\n'));AudioSys.playSe('select');},step2Delay);
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
        const bs=$('battle-screen');bs.classList.add('screen-shake');
        setTimeout(()=>bs.classList.remove('screen-shake'),400);
        createSparks();
    },step2Delay+800);

    // Step 5: Result (SE moved to applyDamage for HP bar animation timing)
    setTimeout(()=>{
        di.classList.add('hidden');
        dr.classList.remove('hidden');
        const rv=$('dmg-result-value');
        if(GS.miracleDmgOverride){
            rv.textContent='✨ ミラクル！ ダメージ無効！';rv.style.color='#FFD700';
        } else if(dmg>0){
            rv.textContent=`💥 ${dmg} ダメージ！`;rv.style.color='#FF6B6B';
        } else {
            rv.textContent='🛡️ ダメージ無効！';rv.style.color='#6B9BFF';
        }
        if(instantDmg>0){
            rv.textContent+=`\n⚡ 即時${instantDmg}ダメージ！`;
        }
    },step2Delay+1600);

    // Step 6: Apply damage (SE plays during HP bar animation)
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
    // Main damage (instant damage already applied in startDamageCalc)
    if(GS.p1IsAttacker){
        GS.p2Hp=Math.max(0,GS.p2Hp-dmg);
    } else {
        GS.p1Hp=Math.max(0,GS.p1Hp-dmg);
    }
    // SE plays during HP bar animation
    if(dmg>0) AudioSys.playSe('damage');
    else AudioSys.playSe('shield');
    // ライアン: ダメージ 0 なら HP3 回復 (1ゲーム2回まで)
    if(dc.abilityType==='defense_ryan'&&dmg===0){
        const defKey=GS.p1IsAttacker?'p2':'p1';
        if(GS.ryanHealCount[defKey]<2){
            if(defKey==='p1'){GS.p1Hp=Math.min(GS.p1MaxHp,GS.p1Hp+3);}
            else{GS.p2Hp=Math.min(GS.p2MaxHp,GS.p2Hp+3);}
            GS.ryanHealCount[defKey]++;
            AudioSys.playSe('cure');
        }
    }
    // オーガスト: 攻撃後パワー獲得 (最大4層、消費ターンは基本獲得不可、全偶数は可)
    if(ac.abilityType==='attack_august'){
        const atkKey=GS.p1IsAttacker?'p1':'p2';
        const r=ac.ability(GS.attackerSelectedDice);
        if(GS.augustConsumedThisTurn[atkKey]&&r.stacks===2){
            // 消費ターンかつ偶数でない: パワー獲得なし
        } else {
            GS.powerStacks[atkKey]=Math.min(4,GS.powerStacks[atkKey]+r.stacks);
            AudioSys.playSe('power-up');
        }
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
    // HP赤トラッキング
    const p1R=GS.p1MaxHp>0?GS.p1Hp/GS.p1MaxHp:1;
    const p2R=GS.p2MaxHp>0?GS.p2Hp/GS.p2MaxHp:1;
    const p1NowRed=p1R<=0.25&&GS.p1Hp>0;
    const p2NowRed=p2R<=0.25&&GS.p2Hp>0;
    if(p1NowRed&&!GS._p1HpWasRed) AudioSys.playSe('hp-red');
    if(p2NowRed&&!GS._p2HpWasRed) AudioSys.playSe('hp-red');
    GS._p1HpWasRed=p1NowRed;
    GS._p2HpWasRed=p2NowRed;
    if(dmg>0){const ta=GS.p1IsAttacker?$('opponent-area'):$('player-area');ta.classList.add('shake');setTimeout(()=>ta.classList.remove('shake'),500);}
    GS.animating=false;
    // 引き分けチェック
    if(GS.p1Hp<=0&&GS.p2Hp<=0){setTimeout(()=>showResult('draw'),800);return;}
    if(GS.p1Hp<=0||GS.p2Hp<=0){setTimeout(()=>showResult(),800);return;}
    setTimeout(()=>{
        clearDamageDisplay();
        $('opponent-dice-tray').innerHTML='';$('dice-tray').innerHTML='';
        GS.p1IsAttacker=!GS.p1IsAttacker;
        if(GS._turnHalf===0){
            GS._turnHalf=1;
        } else {
            GS._turnHalf=0;
            GS.turn++;
        }
        startTurn();
    },1200);
}

// ============ Ability ============
function showAbility(t){$('ability-text').textContent=t;$('ability-notification').classList.remove('hidden');$('ability-notification').style.display='block';}
function hideAbility(){$('ability-notification').classList.add('hidden');$('ability-notification').style.display='';}

// ============ Result ============
function showResult(type){
    $('result-overlay').classList.remove('hidden');
    AudioSys.stopBgm(); // バトルBGM停止
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
    else if(GS.mode==='online'){
        const localWin=GS.onlineRole==='host'?p1W:!p1W;
        AudioSys.playSe(localWin?'win':'lose');
    } else AudioSys.playSe('win');
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
$('btn-to-title').addEventListener('click',()=>{AudioSys.playSe('click');$('result-overlay').classList.add('hidden');resetBattleState();GS.p1Char=null;GS.p2Char=null;showScreen('title');});

// v1.6: バトル状態リセット関数
function resetBattleState(){
    $('dice-tray').innerHTML='';$('opponent-dice-tray').innerHTML='';
    GS.rolledDice=[];GS.rolledDiceP2=[];
    GS.attackerSelectedDice=[];GS.defenderSelectedDice=[];
    GS.hasRolled=false;GS.animating=false;
    clearDamageDisplay();hideAbility();
    $('action-panel-right').classList.add('hidden');
    $('coin-overlay').classList.add('hidden');
    $('turn-start-overlay').classList.add('hidden');
    $('result-overlay').classList.add('hidden');
    $('char-info-popup').classList.add('hidden');
}

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
    GS.deckStep=0; // Online mode: skip deck step logic
    GS.onlineReady={p1:false,p2:false};
    $('p1-deck-section').classList.remove('hidden');
    $('opponent-deck-section').classList.add('hidden');
    $('p2-deck-section').classList.add('hidden');
    $('btn-deck-next').classList.add('hidden');
    $('btn-battle-start').classList.remove('hidden');
    $('btn-battle-start').disabled=true;
    $('btn-back-title').textContent='戻る';
    if(GS.onlineRole==='host'){
        $('deck-title').textContent='デッキ選択 - オンライン (ホスト)';
    } else {
        $('deck-title').textContent='デッキ選択 - オンライン (ゲスト)';
    }
    $('deck-player-label').textContent='自分のキャラカード';
    $('deck-subtitle').textContent=`対戦相手: ${opponentName || '???'}`;
    renderCards('char-cards-grid','p1',false);
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
    AudioSys.playSe('battle-start');hideDetail();
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
            AudioSys.playSe('dice-select');
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
            AudioSys.playSe('cancel'); // 辞退はキャンセルSE
            sendOnline({type:'match_decline'});
            $('match-confirm-modal').classList.add('hidden');
            $('online-status').textContent='対戦を辞退しました';
        });
    }
});

// ============ Opening Animation (v1.5) ============
(function(){
    const overlay=document.getElementById('opening-overlay');
    if(!overlay) return;
    setTimeout(()=>{
        overlay.classList.add('op-fade-out');
        setTimeout(()=>overlay.classList.add('op-done'), 700);
    }, 2300);
})();

// ============ ℹ️ Character Info Popup (v1.5) ============
function showCharInfoPopup(ch){
    if(!ch) return;
    const p1Def=GS.p1Char?GS.p1Char.def+(GS.p1Char.id===6&&GS.ryanDefBuff.p1?1:0):ch.def;
    const p2Def=GS.p2Char?GS.p2Char.def+(GS.p2Char.id===6&&GS.ryanDefBuff.p2?1:0):ch.def;
    const def=ch===GS.p1Char?p1Def:p2Def;
    const hp=ch===GS.p1Char?GS.p1Hp:GS.p2Hp;
    const key=ch===GS.p1Char?'p1':'p2';
    let extraInfo='';
    if(ch.id===7&&GS.powerStacks[key]>0) extraInfo+=`\n⚡ パワー ${GS.powerStacks[key]}層 蓄積中`;
    if(ch.id===6) extraInfo+=`\n💚 回復残り ${2-GS.ryanHealCount[key]}/2 回`;
    $('char-info-portrait').textContent=ch.emoji;
    $('char-info-name').textContent=ch.name;
    $('char-info-stats').textContent=`HP ${hp}/${ch.hp}  ⚔️${ch.atk}  🛡️${def}`;
    $('char-info-desc').textContent=ch.abilityDesc+extraInfo;
    AudioSys.playSe('cursor');
    $('char-info-popup').classList.remove('hidden');
}
$('btn-info-player').addEventListener('click',()=>showCharInfoPopup(GS.p1Char));
$('btn-info-opponent').addEventListener('click',()=>showCharInfoPopup(GS.p2Char));
$('btn-char-info-close').addEventListener('click',()=>{
    AudioSys.playSe('cancel');
    $('char-info-popup').classList.add('hidden');
});
