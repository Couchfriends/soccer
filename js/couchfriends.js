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
    COUCHFRIENDS.connect();
}

function identifyPlayer(playerId, color) {
    if (color == null || color == '') {
        return;
    }
    var jsonData = {
        topic: 'player',
        action: 'identify',
        data: {
            id: playerId,
            color: color
        }
    };
    COUCHFRIENDS.send(jsonData);
}

COUCHFRIENDS.on('connect', function() {
    hostGame();
});

COUCHFRIENDS.on('disconnect', function() {
});

/**
 * Callback after the server started the game and let players allow to join.
 *
 * @param {object} data List with game data
 * @param {string} data.code The game code players need to fill to join this game
 */
COUCHFRIENDS.on('gameStart', function(data) {
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
COUCHFRIENDS.on('playerClick', function(data) {
    SOCCER.shoot(data.id);
});

COUCHFRIENDS.on('buttonClick', function(data) {
    if (data.id == "shootBall" || data.id == "shootBall2") {
        SOCCER.shoot(data.playerId);
    }
    if (data.id == "kickPlayer") {
        SOCCER.kick(data.playerId);
    }
});

window.onload = init;