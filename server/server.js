const WebSocket = require('ws');
const http = require('http');

const server = http.createServer((req, res) => {
    res.writeHead(200, {
        'Content-Type': 'text/plain',
        'Access-Control-Allow-Origin': '*'
    });
    res.end('Dice Wars Server is running');
});

const wss = new WebSocket.Server({ server });

// ============ プレイヤー管理 ============
const players = new Map(); // name -> { ws, name, state, selectedOpponent, matchedWith }

function broadcastPlayerList() {
    const list = [];
    players.forEach((p, name) => {
        if (p.state === 'lobby') {
            list.push({ name, selected: p.selectedOpponent || null });
        }
    });
    const msg = JSON.stringify({ type: 'player_list', players: list });
    players.forEach(p => {
        if (p.ws.readyState === WebSocket.OPEN && p.state === 'lobby') {
            p.ws.send(msg);
        }
    });
}

function checkMutualSelection(playerA, playerB) {
    const a = players.get(playerA);
    const b = players.get(playerB);
    if (!a || !b) return false;
    return a.selectedOpponent === playerB && b.selectedOpponent === playerA;
}

function createMatch(hostName, guestName) {
    const host = players.get(hostName);
    const guest = players.get(guestName);
    if (!host || !guest) return;

    host.state = 'in_game';
    host.matchedWith = guestName;
    host.selectedOpponent = null;
    guest.state = 'in_game';
    guest.matchedWith = hostName;
    guest.selectedOpponent = null;

    host.ws.send(JSON.stringify({ type: 'match_created', opponent: guestName, role: 'host' }));
    guest.ws.send(JSON.stringify({ type: 'match_created', opponent: hostName, role: 'guest' }));

    console.log(`[マッチ成立] ${hostName} vs ${guestName}`);
    broadcastPlayerList();
}

function removePlayer(name) {
    const player = players.get(name);
    if (!player) return;

    // マッチ中なら相手に通知
    if (player.matchedWith) {
        const opponent = players.get(player.matchedWith);
        if (opponent && opponent.ws.readyState === WebSocket.OPEN) {
            opponent.ws.send(JSON.stringify({ type: 'opponent_disconnected' }));
            opponent.state = 'lobby';
            opponent.matchedWith = null;
            opponent.selectedOpponent = null;
        }
    }

    // 自分を選択していた他のプレイヤーの選択を解除
    players.forEach((p, n) => {
        if (p.selectedOpponent === name) {
            p.selectedOpponent = null;
        }
    });

    players.delete(name);
    console.log(`[退出] ${name}`);
    broadcastPlayerList();
}

wss.on('connection', (ws) => {
    console.log('[接続] 新しいクライアント');
    let playerName = null;

    ws.on('message', (data) => {
        try {
            const msg = JSON.parse(data);

            switch (msg.type) {
                case 'set_name': {
                    const name = (msg.name || '').trim().toUpperCase().slice(0, 6);
                    if (!name || !/^[A-Z0-9]+$/.test(name)) {
                        ws.send(JSON.stringify({ type: 'error', message: '名前は英数字6文字以内です' }));
                        return;
                    }
                    if (players.has(name)) {
                        ws.send(JSON.stringify({ type: 'error', message: 'この名前は既に使われています' }));
                        return;
                    }
                    // 古い名前があれば削除
                    if (playerName) removePlayer(playerName);
                    playerName = name;
                    players.set(name, { ws, name, state: 'lobby', selectedOpponent: null, matchedWith: null });
                    ws.send(JSON.stringify({ type: 'name_set', name }));
                    console.log(`[登録] ${name}`);
                    broadcastPlayerList();
                    break;
                }

                case 'select_opponent': {
                    if (!playerName || !players.has(playerName)) return;
                    const me = players.get(playerName);
                    if (me.state !== 'lobby') return;
                    const targetName = msg.name;
                    if (!targetName || targetName === playerName || !players.has(targetName)) return;
                    const target = players.get(targetName);
                    if (target.state !== 'lobby') return;

                    me.selectedOpponent = targetName;
                    console.log(`[選択] ${playerName} -> ${targetName}`);

                    // 相手に通知
                    if (target.ws.readyState === WebSocket.OPEN) {
                        target.ws.send(JSON.stringify({ type: 'selected_by', name: playerName }));
                    }

                    // 相互選択チェック
                    if (checkMutualSelection(playerName, targetName)) {
                        createMatch(playerName, targetName);
                    } else {
                        broadcastPlayerList();
                    }
                    break;
                }

                case 'deselect_opponent': {
                    if (!playerName || !players.has(playerName)) return;
                    const me = players.get(playerName);
                    me.selectedOpponent = null;
                    broadcastPlayerList();
                    break;
                }

                case 'game_action': {
                    if (!playerName || !players.has(playerName)) return;
                    const me = players.get(playerName);
                    if (!me.matchedWith) return;
                    const opponent = players.get(me.matchedWith);
                    if (opponent && opponent.ws.readyState === WebSocket.OPEN) {
                        opponent.ws.send(JSON.stringify(msg));
                    }
                    break;
                }

                case 'return_to_lobby': {
                    if (!playerName || !players.has(playerName)) return;
                    const me = players.get(playerName);
                    if (me.matchedWith) {
                        const opponent = players.get(me.matchedWith);
                        if (opponent && opponent.ws.readyState === WebSocket.OPEN) {
                            opponent.ws.send(JSON.stringify({ type: 'opponent_disconnected' }));
                            opponent.state = 'lobby';
                            opponent.matchedWith = null;
                            opponent.selectedOpponent = null;
                        }
                    }
                    me.state = 'lobby';
                    me.matchedWith = null;
                    me.selectedOpponent = null;
                    broadcastPlayerList();
                    break;
                }
            }
        } catch (e) {
            console.error('[エラー]', e.message);
        }
    });

    ws.on('close', () => {
        if (playerName) removePlayer(playerName);
        console.log('[切断] クライアント');
    });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log(`=== サイコロ・ウォーズ サーバー ===`);
    console.log(`ポート ${PORT} で起動中...`);
    console.log(`ロビーマッチングモード`);
});
