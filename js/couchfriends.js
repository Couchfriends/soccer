/**
 * The MIT License (MIT)
 *
 * Copyright (c) 2015 Couchfriends
 */
COUCHFRIENDS.settings.apiKey = 'soccer-1234';

/**
 * Host a new game
 */
function hostGame() {
}

function init() {
    //COUCHFRIENDS.connect();
}

function identifyPlayer(playerId, color) {
    if (color == null || color == '') {
        return;
    }
    var jsonData = {
        id: playerId,
        topic: 'player',
        action: 'identify',
        type: 'player.identify',
        data: {
            id: playerId,
            color: color
        }
    };
    COUCHFRIENDS.send(jsonData);
}

COUCHFRIENDS.on('connect', function() {
    SOCCER.newGame();
});

COUCHFRIENDS.on('disconnect', function() {
});

/**
 * Callback after the server started the game and let players allow to join.
 *
 * @param {object} data List with game data
 * @param {string} data.code The game code players need to fill to join this game
 */
COUCHFRIENDS.on('game.start', function(data) {
    // SOCCER.newGame();
});

COUCHFRIENDS.on('player.left', function(data) {
    SOCCER.removePlayer(data.id);
});
COUCHFRIENDS.on('player.join', function(data) {
    SOCCER.addPlayer(data.id);
});
COUCHFRIENDS.on('player.orientation', function(data) {
    SOCCER.movePlayer(data.player.id, data);
});
COUCHFRIENDS.on('player.clickUp', function(data) {
    SOCCER.shoot(data.player.id);
});
COUCHFRIENDS.on('player.buttonClick', function(data) {
    SOCCER.shoot(data.player.id);
});
COUCHFRIENDS.on('player.buttonUp', function(data) {
    SOCCER.shoot(data.player.id);
});

window.onload = init;