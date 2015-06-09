/**
 * The MIT License (MIT)
 *
 * Copyright (c) 2015 Couchfriends
 */
var SOCCER = {
    gameWidth: 100,
    gameHeight: 100,
    settings: {
        neutralColors: ['#540DFF', '#100CE8', '#003EFF', '#0C7BE8', '#0DC7FF', '#FFF10D', '#E8C50C', '#FFBD00', '#E8990C', '#FF8A0D'],
        colorTeamA: {
            main: '#00ff00', // green
            secondary: ['#0DFF96', '#0CE84A', '#00FF00', '#59E80C', '#B6FF0D']
        },
        colorTeamB: {
            main: '#ff0000', // red
            secondary: ['#FF530D', '#E82C0C', '#FF0000', '#E80C7A', '#FF0DFF']
        },
        goal: {
            offset: 128,
            size: 256
        }
    },
    /**
     * Array with all connected players as objects. Each player has the following data:
     * id: the unique identifier of the player
     * team: the name of the team (A|B)
     */
    players: [],
    playerBodies: [], // List of all player bodies
    /**
     * Array with all the soccer balls in the game
     */
    balls: [],
    score: {
        A: 0,
        B: 0
    },
    /**
     * Matter engine
     */
    _engine: {},
    _render: {},
    /**
     * Vars used for easy and light calculations
     */
    _vars: {
        minGoalY: 0,
        maxGoalY: 0,
        maxForce: 4,
        events: []
    }
};

/**
 * Resets and creates a new game.
 */
SOCCER.newGame = function () {
    SOCCER.reset();

    document.body.innerHTML += '<div id="game-score" style="position: absolute;right:10px;top:10px;z-index:6;background-color:rgba(255,255,255,.9);padding:10px;">Score: 0-0</div>';

    SOCCER.gameWidth = document.body.clientWidth;
    SOCCER.gameHeight = document.body.clientHeight;

    var container = document.getElementById('content');
    var options = {
        render: {
            options: {
                width: SOCCER.gameWidth,
                height: SOCCER.gameHeight,
                background: '#eee',
                hasBounds: true
            }
        }
    };
    SOCCER._engine = Matter.Engine.create(container, options);
    SOCCER._engine.world.width = SOCCER.gameWidth;
    SOCCER._engine.world.height = SOCCER.gameHeight;
    SOCCER._engine.world.gravity.x = 0;
    SOCCER._engine.world.gravity.y = 0;
    SOCCER._engine.render.options.wireframes = false;

    SOCCER.addField();
    SOCCER.addGoals();

    SOCCER.addBall();

    SOCCER.addEvents();

    for (var playerId in SOCCER.players) {
        if (SOCCER.players[playerId] != null) {
            SOCCER.addPlayer(playerId.replace(/[^0-9]+/, ''));
        }
    }

    Matter.Engine.run(SOCCER._engine);

};

/**
 * Add global events
 */
SOCCER.addEvents = function () {

    // Simple tick
    SOCCER._vars.events.push(
        Matter.Events.on(SOCCER._engine, 'afterTick', function (timestamp) {

            for (var i = 0; i < SOCCER.balls.length; i++) {
                if (SOCCER.balls[i].passive == true) {
                    SOCCER.balls[i].sleepThreshold--;
                    if (SOCCER.balls[i].sleepThreshold % 10 == 1) {
                        SOCCER.balls[i].render.fillStyle = '#cccccc';
                    }
                    else {
                        SOCCER.balls[i].render.fillStyle = '#ffffff';
                    }
                    if (SOCCER.balls[i].speed < 1 && SOCCER.balls[i].sleepThreshold <= 0) {
                        Matter.World.remove(SOCCER._engine.world, SOCCER.balls[i]);
                        SOCCER.balls.splice(i, 1);
                        SOCCER.addBall();
                    }
                    continue;
                }
                var inGoal = SOCCER.isBallInGoal(SOCCER.balls[i].position);
                if (inGoal != false) {
                    Matter.Body.set(SOCCER.balls[i], 'passive', true);
                    SOCCER.balls[i].render.fillStyle = '#cccccc';
                    SOCCER.balls[i].render.sprite.texture = null;
                    SOCCER.addScore(inGoal);
                    break;
                }
            }

            for (var playerId in SOCCER.players) {
                if (SOCCER.players[playerId] != null) {

                    // Check hit for balls
                    var bodyPlayer = SOCCER.players[playerId].body;
                    var bounds = {
                        min: { x: bodyPlayer.position.x-36, y: bodyPlayer.position.y-36 },
                        max: { x: bodyPlayer.position.x+36, y: bodyPlayer.position.y+36 }
                    };
                    var result = Matter.Query.region(SOCCER.balls, bounds);
                    if (result.length > 0) {
                        for (var i = 0; i < result.length; i++) {
                            SOCCER.players[playerId].collision(result[i]);
                        }
                    }
                    var result = Matter.Query.region(SOCCER.balls, bounds, true);
                    if (result.length > 0) {
                        for (var i = 0; i < result.length; i++) {
                            SOCCER.players[playerId].removeCollision(result[i]);
                        }
                    }
                    // Check hit for other players
                    var result = Matter.Query.region(SOCCER.playerBodies, bounds);
                    if (result.length > 0) {
                        for (var i = 0; i < result.length; i++) {
                            if (playerId != 'player_' + result[i].soccerPlayerId) {
                                SOCCER.players[playerId].collisionPlayer(result[i]);
                            }
                        }
                    }
                    var result = Matter.Query.region(SOCCER.playerBodies, bounds, true);
                    if (result.length > 0) {
                        for (var i = 0; i < result.length; i++) {
                            SOCCER.players[playerId].removeCollisionPlayer(result[i]);
                        }
                    }

                    SOCCER.players[playerId].update(playerId);
                }
            }

        })
    );

};

/**
 * Resets the game and give all the settings default values
 */
SOCCER.reset = function () {
    //SOCCER.players = [];
    SOCCER.balls = [];
    SOCCER.score['A'] = 0;
    SOCCER.score['B'] = 0;

    if (SOCCER._engine.enabled != null) {
        Matter.Engine.clear(SOCCER._engine);
        if (SOCCER._engine.world.events) {
            for (var i = 0; i < SOCCER._vars.events.length; i++) {
                Events.off(SOCCER._engine.world, SOCCER._vars.events[i]);
            }
        }
    }
    document.getElementById('content').innerHTML = '';

    if (document.getElementById('game-score') != null) {
        document.getElementById('game-score').parentElement.removeChild(document.getElementById('game-score'));
    }
    if (document.getElementById('game-overlay') != null) {
        document.getElementById('game-overlay').parentElement.removeChild(document.getElementById('game-overlay'));
    }
    SOCCER._vars.events = [];
};

SOCCER.addScore = function (team) {
    SOCCER.score[team]++;
    document.getElementById('game-score').innerHTML = 'Score: ' + SOCCER.score['A'] + '-' + SOCCER.score['B'];
    if (SOCCER.score[team] > 9) {
        var _color = SOCCER.settings.colorTeamA.main;
        if (team == 'B') {
            _color = SOCCER.settings.colorTeamB.main;
        }
        document.getElementById('content').innerHTML += '<div id="game-overlay" style="position: fixed;z-index: 20;font-size: 72px;text-align:center;width:100%;height:100%;line-height:' + (SOCCER.gameHeight / 4) + 'px;color:#fff;background-color: ' + _color + ';">TEAM ' + team + ' WON. Game resets in 10 seconds...<br />(You might swap teams!)</div>';
        setTimeout(SOCCER.newGame, 10000);
    }
};

/**
 * Simple AABB collision check for goals
 * @param ballPosition
 * @returns {boolean|string} false if there is no goal or 'A' or 'B' of the team that scores
 */
SOCCER.isBallInGoal = function (ballPosition) {
    if (ballPosition.y < SOCCER._vars.minGoalY || ballPosition.y > SOCCER._vars.maxGoalY) {
        return false;
    }
    if (ballPosition.x < SOCCER.settings.goal.offset || ballPosition.x > (SOCCER.gameWidth - SOCCER.settings.goal.offset)) {
        return false;
    }
    // Check right goal
    if (ballPosition.x > (SOCCER.gameWidth - SOCCER.settings.goal.offset - (SOCCER.settings.goal.size / 2))) {
        return 'A';
    }
    if (ballPosition.x < (SOCCER.settings.goal.offset + (SOCCER.settings.goal.size / 2))) {
        return 'B';
    }
    return false;
};

SOCCER.addBall = function () {

    var _centerTop = (SOCCER.gameHeight * .5);
    var _centerLeft = (SOCCER.gameWidth * .5);
    var _size = 32;
    var _color = SOCCER.settings.neutralColors[Math.floor(Math.random() * SOCCER.settings.neutralColors.length)];
    var _options = {
        isStatic: false,
        restitution: .7,
        render: {
            sprite: {
                texture: './img/ball.png',
                xScale: 1,
                yScale: 1
            },
            fillStyle: _color,
            strokeStyle: '#000000',
            lineWidth: 1
        }
    };
    var ball = Matter.Bodies.circle(
        _centerLeft,
        _centerTop,
        _size,
        _options
    );
    ball.passive = false;
    ball.sleepThreshold = 120;
    ball.soccerType = 'ball';
    SOCCER.balls.push(ball);

    Matter.World.add(SOCCER._engine.world, ball);

};

/**
 * Add collision objects around the field
 */
SOCCER.addField = function () {
    var _wide = 16;
    var _halfWide = _wide * .5;
    var _centerTop = (SOCCER.gameHeight * .5);
    var _centerLeft = (SOCCER.gameWidth * .5);
    var _options = {
        isStatic: true,
        render: {
            fillStyle: '#000000',
            strokeStyle: '#000000',
            lineWidth: 0
        }
    };
    var left = Matter.Bodies.rectangle(
        _halfWide,
        _centerTop,
        _wide,
        SOCCER.gameHeight,
        _options
    );
    Matter.World.add(SOCCER._engine.world, left);
    var right = Matter.Bodies.rectangle(
        (SOCCER.gameWidth - _halfWide),
        _centerTop,
        _wide,
        SOCCER.gameHeight,
        _options
    );
    Matter.World.add(SOCCER._engine.world, right);
    var top = Matter.Bodies.rectangle(
        _centerLeft,
        _halfWide,
        SOCCER.gameWidth,
        _wide,
        _options
    );
    Matter.World.add(SOCCER._engine.world, top);
    var bottom = Matter.Bodies.rectangle(
        _centerLeft,
        (SOCCER.gameHeight - _halfWide),
        SOCCER.gameWidth,
        _wide,
        _options
    );
    Matter.World.add(SOCCER._engine.world, bottom);


    SOCCER._vars.minGoalY = ((SOCCER.gameHeight * .5) - (SOCCER.settings.goal.size / 2));
    SOCCER._vars.maxGoalY = ((SOCCER.gameHeight * .5) + (SOCCER.settings.goal.size / 2));
};

/**
 * Add two basic goals
 */
SOCCER.addGoals = function () {

    var _wide = 16;
    var _size = SOCCER.settings.goal.size;
    var _halfSize = _size / 2;
    var _offsetSides = SOCCER.settings.goal.offset;
    var _centerTop = (SOCCER.gameHeight * .5);

    // Goal A
    var _options = {
        isStatic: true,
        render: {
            fillStyle: SOCCER.settings.colorTeamA.main,
            strokeStyle: SOCCER.settings.colorTeamA.main,
            lineWidth: 0
        }
    };
    var goalLeftBase = Matter.Bodies.rectangle(
        _offsetSides,
        _centerTop,
        _wide,
        _size,
        _options
    );

    Matter.World.add(SOCCER._engine.world, goalLeftBase);
    var goalLeftTop = Matter.Bodies.rectangle(
        _offsetSides + (_halfSize / 2) - (_wide / 2),
        (_centerTop - (_size / 2) + (_wide / 2)),
        _halfSize,
        _wide,
        _options
    );
    Matter.World.add(SOCCER._engine.world, goalLeftTop);
    var goalLeftBottom = Matter.Bodies.rectangle(
        _offsetSides + (_halfSize / 2) - (_wide / 2),
        (_centerTop + (_size / 2) - (_wide / 2)),
        _halfSize,
        _wide,
        _options
    );
    Matter.World.add(SOCCER._engine.world, goalLeftBottom);

    // Goal B
    var _options = {
        isStatic: true,
        render: {
            fillStyle: SOCCER.settings.colorTeamB.main,
            strokeStyle: SOCCER.settings.colorTeamB.main,
            lineWidth: 0
        }
    };
    var goalRightBase = Matter.Bodies.rectangle(
        SOCCER.gameWidth - _offsetSides,
        _centerTop,
        _wide,
        _size,
        _options
    );

    Matter.World.add(SOCCER._engine.world, goalRightBase);
    var goalRightTop = Matter.Bodies.rectangle(
        SOCCER.gameWidth - (_offsetSides + (_halfSize / 2) - (_wide / 2)),
        (_centerTop - (_size / 2) + (_wide / 2)),
        _halfSize,
        _wide,
        _options
    );
    Matter.World.add(SOCCER._engine.world, goalRightTop);
    var goalRightBottom = Matter.Bodies.rectangle(
        SOCCER.gameWidth - (_offsetSides + (_halfSize / 2) - (_wide / 2)),
        (_centerTop + (_size / 2) - (_wide / 2)),
        _halfSize,
        _wide,
        _options
    );
    Matter.World.add(SOCCER._engine.world, goalRightBottom);
};

/**
 * Adds a new player to the game
 */
SOCCER.addPlayer = function (id) {
    var player = {
        id: id,
        speedX: 0,
        speedY: 0,
        body: {},
        touchedBalls: [],
        touchedPlayers: []
    };
    var teamA = 0;
    var teamB = 0;
    for (var playerId in SOCCER.players) {
        if (SOCCER.players[playerId].team != null && SOCCER.players[playerId].team == "A") {
            teamA++;
        }
        else if (SOCCER.players[playerId].team != null && SOCCER.players[playerId].team == "B") {
            teamB++;
        }
    }

    var _size = 22;
    var _top = (SOCCER.gameHeight * .5);
    var _left = SOCCER.settings.goal.offset - (_size * 2);
    if (teamA > teamB) {
        player.team = "B";
        player.color = SOCCER.settings.colorTeamB.secondary[Math.floor(Math.random() * SOCCER.settings.colorTeamB.secondary.length)];
        _left = SOCCER.gameWidth - SOCCER.settings.goal.offset + (_size * 2);

    }
    else {
        player.team = "A";
        player.color = SOCCER.settings.colorTeamA.secondary[Math.floor(Math.random() * SOCCER.settings.colorTeamA.secondary.length)];
    }
    var _options = {
        isStatic: false,
        density: 0.003,
        render: {
            fillStyle: player.color,
            strokeStyle: '#000000',
            lineWidth: 1
        }
    };
    player.body = Matter.Bodies.circle(
        _left,
        _top,
        _size,
        _options
    );

    /**
     * Applying force if it hasn't reach it max yet
     * @param playerId
     * @returns {boolean}
     */
    player.update = function (playerId) {
        var body = SOCCER.players[playerId].body;

        if (body.force.x < -(SOCCER._vars.maxForce) || body.force.x > SOCCER._vars.maxForce) {
            return true;
        }

        if (body.force.y < -(SOCCER._vars.maxForce) || body.force.y > SOCCER._vars.maxForce) {
            return true;
        }

        Matter.Body.applyForce(
            body,
            {
                x: 0,
                y: 0
            },
            {
                x: SOCCER.players[playerId].speedX,
                y: SOCCER.players[playerId].speedY
            }
        );
    };

    /**
     * Player collided with a ball
     * @param ballBody
     */
    player.collision = function (ballBody) {
        if (SOCCER.players['player_' + this.id].touchedBalls.indexOf(ballBody) >= 0) {
            return;
        }
        if (SOCCER.players['player_' + this.id].touchedBalls.length == 0) {
            var jsonData = {
                topic: 'interface',
                action: 'buttonAdd',
                data: {
                    id: 'shootBall',
                    playerId: this.id,
                    type: 'circle',
                    label: 'Shoot!',
                    color: '#ff0000',
                    size: {
                        radius: 64
                    },
                    position: {
                        left: '20%',
                        bottom: '20%'
                    }
                }
            };
            COUCHFRIENDS.send(jsonData);
        }
        SOCCER.players['player_' + this.id].touchedBalls.push(ballBody);
    };

    player.removeCollision = function (ballBody) {
        SOCCER.players['player_' + this.id].touchedBalls.splice(
            SOCCER.players['player_' + this.id].touchedBalls.indexOf(ballBody),
            1
        );
        if (SOCCER.players['player_' + this.id].touchedBalls.length == 0) {
            var jsonData = {
                topic: 'interface',
                action: 'buttonRemove',
                data: {
                    id: 'shootBall',
                    playerId: this.id
                }
            };
            COUCHFRIENDS.send(jsonData);
        }
    };

    player.collisionPlayer = function(otherPlayerBody) {
        if (SOCCER.players['player_' + this.id].touchedPlayers.indexOf(otherPlayerBody) >= 0) {
            return;
        }
        if (SOCCER.players['player_' + this.id].touchedPlayers.length == 0) {
            var jsonData = {
                topic: 'interface',
                action: 'buttonAdd',
                data: {
                    id: 'kickPlayer',
                    playerId: this.id,
                    type: 'circle',
                    label: 'Kick!',
                    color: '#0000ff',
                    size: {
                        radius: 64
                    },
                    position: {
                        left: '20%',
                        top: '20%'
                    }
                }
            };
            COUCHFRIENDS.send(jsonData);
        }
        SOCCER.players['player_' + this.id].touchedPlayers.push(otherPlayerBody);
    };

    player.removeCollisionPlayer = function(otherPlayerBody) {
        SOCCER.players['player_' + this.id].touchedPlayers.splice(
            SOCCER.players['player_' + this.id].touchedPlayers.indexOf(otherPlayerBody),
            1
        );
        if (SOCCER.players['player_' + this.id].touchedPlayers.length == 0) {
            var jsonData = {
                topic: 'interface',
                action: 'buttonRemove',
                data: {
                    id: 'kickPlayer',
                    playerId: this.id
                }
            };
            COUCHFRIENDS.send(jsonData);
        }
    };

    player.body.passive = false;
    player.body.soccerType = 'player';
    player.body.soccerPlayerId = id;

    Matter.World.add(SOCCER._engine.world, player.body);
    SOCCER.players['player_' + id] = player;
    SOCCER.playerBodies.push(player.body);
    identifyPlayer(id, player.color);
    return player;
};

SOCCER.shoot = function (playerId) {
    if (SOCCER.players['player_' + playerId].touchedBalls.length == 0) {
        return;
    }
    for (var i = 0; i < SOCCER.players['player_' + playerId].touchedBalls.length; i++) {
        var relativeX = SOCCER.players['player_' + playerId].touchedBalls[i].position.x - SOCCER.players['player_' + playerId].body.position.x;
        var relativeY = SOCCER.players['player_' + playerId].touchedBalls[i].position.y - SOCCER.players['player_' + playerId].body.position.y;
        Matter.Body.applyForce(
            SOCCER.players['player_' + playerId].touchedBalls[i],
            {
                x: SOCCER.players['player_' + playerId].body.position.x,
                y: SOCCER.players['player_' + playerId].body.position.y
            },
            {
                x: (relativeX *.0015),
                y: (relativeY *.0015)
            }
        );
    }
};

SOCCER.kick = function (playerId) {
    if (SOCCER.players['player_' + playerId].touchedPlayers.length == 0) {
        return;
    }
    for (var i = 0; i < SOCCER.players['player_' + playerId].touchedPlayers.length; i++) {
        var relativeX = SOCCER.players['player_' + playerId].touchedPlayers[i].position.x - SOCCER.players['player_' + playerId].body.position.x;
        var relativeY = SOCCER.players['player_' + playerId].touchedPlayers[i].position.y - SOCCER.players['player_' + playerId].body.position.y;
        Matter.Body.applyForce(
            SOCCER.players['player_' + playerId].touchedPlayers[i],
            {
                x: SOCCER.players['player_' + playerId].body.position.x,
                y: SOCCER.players['player_' + playerId].body.position.y
            },
            {
                x: (relativeX *.0025),
                y: (relativeY *.0025)
            }
        );
    }
};

/**
 * Removes a player from the game with the given id
 * @param playerId
 */
SOCCER.removePlayer = function (playerId) {
    Matter.World.remove(SOCCER._engine.world, SOCCER.players['player_' + playerId].body);
    SOCCER.playerBodies.splice(
        SOCCER.playerBodies.indexOf(SOCCER.players['player_' + playerId].body),
        1
    );
    delete(SOCCER.players['player_' + playerId]);
};

/**
 * Moves a player towards an direction
 *
 * @param playerId
 * @param movement object with x, y
 */
SOCCER.movePlayer = function (playerId, movement) {
    movement.x *= .009;
    movement.y *= .009;
    SOCCER.players['player_' + playerId].speedX = movement.x;
    SOCCER.players['player_' + playerId].speedY = movement.y;
};