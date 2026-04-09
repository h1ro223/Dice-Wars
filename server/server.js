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
const players = new Map(); // name -> { ws, name, state, selectedOpponent, matchedWith, pendingMatchId }
const pendingMatches = new Map(); // matchId -> { host, guest, hostAccepted, guestAccepted }

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

function requestMatch(hostName, guestName) {
    const host = players.get(hostName);
    const guest = players.get(guestName);
    if (!host || !guest) return;

    const matchId = `${hostName}_${guestName}_${Date.now()}`;
    host.state = 'pending_match';
    host.pendingMatchId = matchId;
    host.selectedOpponent = null;
    guest.state = 'pending_match';
    guest.pendingMatchId = matchId;
    guest.selectedOpponent = null;

    pendingMatches.set(matchId, {
        host: hostName,
        guest: guestName,
        hostAccepted: false,
        guestAccepted: false
    });

    host.ws.send(JSON.stringify({
        type: 'match_request',
        opponent: guestName,
        role: 'host'
    }));
    guest.ws.send(JSON.stringify({
        type: 'match_request',
        opponent: hostName,
        role: 'guest'
    }));

    console.log(`[マッチリクエスト] ${hostName}(ホスト) vs ${guestName}(ゲスト)`);
    broadcastPlayerList();
}

function removePlayer(name) {
    const player = players.get(name);
    if (!player) return;

    // ペンディングマッチ中なら相手に通知してキャンセル
    if (player.pendingMatchId) {
        const match = pendingMatches.get(player.pendingMatchId);
        if (match) {
            const otherName = match.host === name ? match.guest : match.host;
            const other = players.get(otherName);
            if (other && other.ws.readyState === WebSocket.OPEN) {
                other.ws.send(JSON.stringify({ type: 'opponent_disconnected' }));
                other.state = 'lobby';
                other.pendingMatchId = null;
                other.selectedOpponent = null;
            }
            pendingMatches.delete(player.pendingMatchId);
        }
    }

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
                        // targetName が先に選択した側 = ホスト
                        requestMatch(targetName, playerName);
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

                case 'match_accept': {
                    if (!playerName || !players.has(playerName)) return;
                    const me5 = players.get(playerName);
                    if (!me5 || !me5.pendingMatchId) return;
                    const match = pendingMatches.get(me5.pendingMatchId);
                    if (!match) return;

                    if (match.host === playerName) match.hostAccepted = true;
                    else if (match.guest === playerName) match.guestAccepted = true;

                    if (match.hostAccepted && match.guestAccepted) {
                        // 両者承認 → マッチ成立
                        const hostP = players.get(match.host);
                        const guestP = players.get(match.guest);
                        if (hostP) hostP.pendingMatchId = null;
                        if (guestP) guestP.pendingMatchId = null;
                        createMatch(match.host, match.guest);
                        pendingMatches.delete(me5.pendingMatchId);
                    }
                    break;
                }

                case 'match_decline': {
                    if (!playerName || !players.has(playerName)) return;
                    const me6 = players.get(playerName);
                    if (!me6 || !me6.pendingMatchId) return;
                    const matchData = pendingMatches.get(me6.pendingMatchId);
                    if (!matchData) return;

                    const otherName = matchData.host === playerName ? matchData.guest : matchData.host;
                    const otherPlayer = players.get(otherName);
                    if (otherPlayer && otherPlayer.ws.readyState === WebSocket.OPEN) {
                        otherPlayer.ws.send(JSON.stringify({ type: 'match_declined', by: playerName }));
                    }

                    // 両者をロビーに戻す
                    [matchData.host, matchData.guest].forEach(n => {
                        const p = players.get(n);
                        if (p) {
                            p.state = 'lobby';
                            p.pendingMatchId = null;
                            p.selectedOpponent = null;
                        }
                    });

                    pendingMatches.delete(me6.pendingMatchId);
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
