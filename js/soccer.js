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
            main: '#0000ff', // green
            secondary: ['#0000ff', '#667fff', '#001684', '#00e4ff', '#008c9d'],
            textures: ['img/teama/1.png', 'img/teama/2.png', 'img/teama/3.png', 'img/teama/4.png', 'img/teama/5.png']
        },
        colorTeamB: {
            main: '#ff0000', // red
            secondary: ['#FF530D', '#E82C0C', '#FF0000', '#E80C7A', '#FF0DFF'],
            textures: ['img/teamb/1.png', 'img/teamb/2.png', 'img/teamb/3.png', 'img/teamb/4.png', 'img/teamb/5.png']
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
     * Additional objects that can be rendered in the canvas context.
     * Each object should have at least an update() function
     */
    objects: [],
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
        maxVelocity: 16,
        collisionSpace: 42,
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
                background: 'transparent',
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
            // Remove buttons
            SOCCER.players[playerId].reset();
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
                    if (SOCCER.balls[i].sleepThreshold <= 0) {
                        SOCCER.balls[i].passive = false;
                        SOCCER.balls[i].sleepThreshold = 120;
                        SOCCER.balls[i].render.sprite.texture = './img/ball.png';
                        Matter.Body.setVelocity(SOCCER.balls[i], {
                            y: 0,
                            x: 0
                        });
                        Matter.Body.setPosition(SOCCER.balls[i], {
                            y: (SOCCER.gameHeight * .5),
                            x: (SOCCER.gameWidth * .5)
                        });
                        // Reset players behind goal to start over
                        SOCCER.resetPlayers();
                    }
                    continue;
                }
                var inGoal = SOCCER.isBallInGoal(SOCCER.balls[i].position);
                if (inGoal != false) {
                    Matter.Body.set(SOCCER.balls[i], 'passive', true);
                    SOCCER.balls[i].render.fillStyle = '#cccccc';
                    SOCCER.balls[i].render.sprite.texture = null;
                    SOCCER.addScore(inGoal, SOCCER.balls[i].lastHitByPlayer);
                    break;
                }
                if (SOCCER.balls[i].position.x < 0 || SOCCER.balls[i].position.x > SOCCER.gameWidth || SOCCER.balls[i].position.y < 0 || SOCCER.balls[i].position.y > SOCCER.gameHeight) {
                    Matter.Body.setVelocity(SOCCER.balls[i], {
                        y: 0,
                        x: 0
                    });
                    Matter.Body.setPosition(SOCCER.balls[i], {
                        y: (SOCCER.gameHeight * .5),
                        x: (SOCCER.gameWidth * .5)
                    });
                }
            }

            for (var playerId in SOCCER.players) {
                if (SOCCER.players[playerId] != null) {

                    var bodyPlayer = SOCCER.players[playerId].body;

                    if (bodyPlayer.scoreThreshold > 0) {
                        bodyPlayer.scoreThreshold--;
                        bodyPlayer.render.visible = bodyPlayer.scoreThreshold % 2 != 1;
                    }

                    // Outside the world?
                    if (bodyPlayer.position.x < 0 || bodyPlayer.position.x > SOCCER.gameWidth || bodyPlayer.position.y < 0 || bodyPlayer.position.y > SOCCER.gameHeight) {
                        Matter.Body.setVelocity(bodyPlayer, {
                            y: 0,
                            x: 0
                        });
                        Matter.Body.setPosition(bodyPlayer, {
                            y: (SOCCER.gameHeight * .5),
                            x: (SOCCER.gameWidth * .5)
                        });
                    }

                    // Check hit for balls
                    var bounds = {
                        min: {
                            x: bodyPlayer.position.x - SOCCER._vars.collisionSpace,
                            y: bodyPlayer.position.y - SOCCER._vars.collisionSpace
                        },
                        max: {
                            x: bodyPlayer.position.x + SOCCER._vars.collisionSpace,
                            y: bodyPlayer.position.y + SOCCER._vars.collisionSpace
                        }
                    };
                    var result = Matter.Query.region(SOCCER.balls, bounds);
                    if (result.length > 0) {
                        for (var i = 0; i < result.length; i++) {
                            SOCCER.players[playerId].collision(result[i]);
                            result[i].lastHitByPlayer = SOCCER.players[playerId];
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

            for (var i = 0; i < SOCCER.objects.length; i++) {
                SOCCER.objects[i].update();
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

/**
 * Set players back to behind the goals after score
 */
SOCCER.resetPlayers = function() {

    for (var playerId in SOCCER.players) {
        if (SOCCER.players[playerId] != null) {

            var player = SOCCER.players[playerId];
            var bodyPlayer = player.body;

            var _size = 32;
            var _top = (SOCCER.gameHeight * .5);
            var _left = SOCCER.settings.goal.offset - (_size * 2);
            if (player.team == 'B') {
                _left = SOCCER.gameWidth - SOCCER.settings.goal.offset + (_size * 2);
            }
            Matter.Body.setVelocity(bodyPlayer, {
                y: 0,
                x: 0
            });
            Matter.Body.setPosition(bodyPlayer, {
                y: _top,
                x: _left
            });
        }
    }

};

SOCCER.addScore = function (team, playerLastHit) {

    var jsonData = {
        topic: 'game',
        action: 'achievementUnlock',
        data: {
            playerId: playerLastHit.id,
            key: 'goal'
        }
    };
    playerLastHit.body.scoreThreshold = 120;
    COUCHFRIENDS.send(jsonData);

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
        restitution: 1,
        mass: 1,
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
    ball.lastHitByPlayer = {};
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
 * Creates an shoot indicator for a player that is close to another player or ball
 */
SOCCER.addShootIndicator = function (playerBody) {

    var object = {
        playerBody: playerBody,
        update: function () {
        }
    };
    object.update = function () {
        SOCCER._engine.render.context.beginPath();
        SOCCER._engine.render.context.arc(playerBody.position.x, playerBody.position.y, 38, 0, 2 * Math.PI);
        SOCCER._engine.render.context.strokeStyle = 'rgba(255,0,0, .7)';
        SOCCER._engine.render.context.lineWidth = 5;
        SOCCER._engine.render.context.stroke();
        SOCCER._engine.render.context.lineWidth = 1;
    };

    this.objects.push(object);
    return object;

};
SOCCER.removeShootIndicator = function (shootingObject) {

    var indexOf = this.objects.indexOf(shootingObject);
    if (indexOf < 0) {
        return;
    }
    this.objects.splice(indexOf, 1);
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
        touchedPlayers: [],
        indicatorObject: {}
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

    var _size = 32;
    var _top = (SOCCER.gameHeight * .5);
    var _left = SOCCER.settings.goal.offset - (_size * 2);
    if (teamA > teamB) {
        player.team = "B";
        player.color = SOCCER.settings.colorTeamB.secondary[Math.floor(Math.random() * SOCCER.settings.colorTeamB.secondary.length)];
        var textureIndex = teamB;
        while (textureIndex >= SOCCER.settings.colorTeamB.textures.length) {
            textureIndex -= SOCCER.settings.colorTeamB.textures.length;
        }
        var texture = SOCCER.settings.colorTeamB.textures[textureIndex];
        player.texture = texture;
        _left = SOCCER.gameWidth - SOCCER.settings.goal.offset + (_size * 2);

    }
    else {
        player.team = "A";
        player.color = SOCCER.settings.colorTeamA.secondary[Math.floor(Math.random() * SOCCER.settings.colorTeamA.secondary.length)];
        var textureIndex = teamA;
        while (textureIndex >= SOCCER.settings.colorTeamA.textures.length) {
            textureIndex -= SOCCER.settings.colorTeamA.textures.length;
        }
        var texture = SOCCER.settings.colorTeamA.textures[textureIndex];
        player.texture = texture;
    }
    var _options = {
        isStatic: false,
        density: .1,
        restitution: .4,
        mass: 2,
        render: {
            fillStyle: player.color,
            strokeStyle: '#000000',
            lineWidth: 1,
            sprite: {
                texture: player.texture
            }
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

        if (body.velocity.x < -(SOCCER._vars.maxVelocity) || body.velocity.x > SOCCER._vars.maxVelocity) {
            return true;
        }

        if (body.velocity.y < -(SOCCER._vars.maxVelocity) || body.velocity.y > SOCCER._vars.maxVelocity) {
            return true;
        }
        Matter.Body.translate(
            body,
            {
                x: (SOCCER.players[playerId].speedX * 12),
                y: (SOCCER.players[playerId].speedY * 12)
            }
        );

        Matter.Body.applyForce(
            body,
            {
                x: 0,
                y: 0
            },
            {
                x: (SOCCER.players[playerId].speedX * .0005),
                y: (SOCCER.players[playerId].speedY * .0005)
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
        this.addShootButton();
        SOCCER.players['player_' + this.id].touchedBalls.push(ballBody);
    };

    player.addShootButton = function () {
        if (SOCCER.players['player_' + this.id].touchedBalls.length == 0 && SOCCER.players['player_' + this.id].touchedPlayers.length == 0) {
            var object = SOCCER.addShootIndicator(SOCCER.players['player_' + this.id].body);
            this.indicatorObject = object;
            var jsonData = {
                topic: 'interface',
                action: 'buttonAdd',
                data: {
                    id: 'shootBall',
                    playerId: this.id,
                    type: 'circle',
                    label: 'Shoot!',
                    color: '#ff0000',
                    size: 64,
                    position: {
                        right: 64,
                        bottom: 64
                    }
                }
            };
            COUCHFRIENDS.send(jsonData);
        }
    };

    player.removeShootButton = function () {
        if (SOCCER.players['player_' + this.id].touchedPlayers.length == 0 && SOCCER.players['player_' + this.id].touchedBalls.length == 0) {
            SOCCER.removeShootIndicator(this.indicatorObject);
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

    player.removeCollision = function (ballBody) {
        var indexOf = SOCCER.players['player_' + this.id].touchedBalls.indexOf(ballBody);
        if (indexOf < 0) {
            return;
        }
        SOCCER.players['player_' + this.id].touchedBalls.splice(
            indexOf,
            1
        );
        this.removeShootButton();
    };

    player.collisionPlayer = function (otherPlayerBody) {
        if (SOCCER.players['player_' + this.id].touchedPlayers.indexOf(otherPlayerBody) >= 0) {
            return;
        }
        this.addShootButton();
        SOCCER.players['player_' + this.id].touchedPlayers.push(otherPlayerBody);
    };

    player.removeCollisionPlayer = function (otherPlayerBody) {
        var indexOf = SOCCER.players['player_' + this.id].touchedPlayers.indexOf(otherPlayerBody);
        if (indexOf < 0) {
            return;
        }
        SOCCER.players['player_' + this.id].touchedPlayers.splice(
            indexOf,
            1
        );
        this.removeShootButton();
    };

    player.reset = function () {
        var jsonData = {
            topic: 'interface',
            action: 'buttonRemove',
            data: {
                id: 'shootBall',
                playerId: this.id
            }
        };
        COUCHFRIENDS.send(jsonData);
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
    if (SOCCER.players['player_' + playerId].touchedBalls.length == 0 && SOCCER.players['player_' + playerId].touchedPlayers.length == 0) {
        return;
    }
    var jsonData = {
        topic: 'interface',
        action: 'vibrate',
        data: {
            playerId: playerId,
            duration: 100
        }
    };
    COUCHFRIENDS.send(jsonData);
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
                x: (relativeX * .0012),
                y: (relativeY * .0012)
            }
        );
    }
    SOCCER.kick(playerId);
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
                x: (relativeX * .005),
                y: (relativeY * .005)
            }
        );
        //
        var playerId = SOCCER.players['player_' + playerId].touchedPlayers[i].soccerPlayerId;
        var jsonData = {
            topic: 'interface',
            action: 'vibrate',
            data: {
                playerId: playerId,
                duration: 500
            }
        };
        COUCHFRIENDS.send(jsonData);
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
    SOCCER.removeShootIndicator(SOCCER.players['player_' + playerId].indicatorObject);
    delete(SOCCER.players['player_' + playerId]);
};

/**
 * Moves a player towards an direction
 *
 * @param playerId
 * @param movement object with x, y
 */
SOCCER.movePlayer = function (playerId, movement) {
    //movement.x *= 20;//.018;
    //movement.y *= 20;//.018;
    SOCCER.players['player_' + playerId].speedX = movement.x;
    SOCCER.players['player_' + playerId].speedY = movement.y;
};