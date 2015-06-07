/**
 * The MIT License (MIT)
 *
 * Copyright (c) 2015 Couchfriends
 */
COUCHFRIENDS.settings.apiKey = 'soccer-abc';
COUCHFRIENDS.settings.host = '93.157.6.81'; // 'ws.couchfriends.com';
COUCHFRIENDS.settings.port = '1234';

/**
 * Host a new game
 */
function hostGame() {
    var jsonData = {
        topic: 'game',
        action: 'host',
        data: { }
    };
    COUCHFRIENDS.send(jsonData);
}

function init() {
    document.body.innerHTML += '<div id="game-status" style="position: absolute;z-index: 6;bottom: 10px;left: 10px;background-color: rgba(255,255,255,.7);color: #000;padding: 10px;border: 2px solid #0f7500;">Game loading...</div>';
    COUCHFRIENDS.connect();
}

COUCHFRIENDS.on('connect', function() {
    hostGame();
});

COUCHFRIENDS.on('disconnect', function() {
    document.getElementById('game-status').innerHTML = 'Game disconnected. <a href="#top" onclick="COUCHFRIENDS.connect();">Reconnect</a>.';
});

/**
 * Callback after the server started the game and let players allow to join.
 *
 * @param {object} data List with game data
 * @param {string} data.code The game code players need to fill to join this game
 */
COUCHFRIENDS.on('gameStart', function(data) {
    document.getElementById('game-status').innerHTML = 'Game started with code: <strong>' + data.code + '</strong>. Join with your phone at <strong>www.couchfriends.com</strong>!';
    SOCCER.newGame();
});

COUCHFRIENDS.on('playerLeft', function(data) {
    SOCCER.removePlayer(data.id);
});
COUCHFRIENDS.on('playerJoined', function(data) {
    SOCCER.addPlayer(data.id);
});
COUCHFRIENDS.on('playerOrientation', function(data) {
    SOCCER.movePlayer(data.id, data);
});
window.onload = init;