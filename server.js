var util = require("util"),
	io = require("socket.io");

var socket,
	players = [],
	level = 1,
	runningTasks = [],
	taskLastId = 1,
	remainingTasks = 0,
	inLobby = true,
	gameLoop,
	levels = [],
	tasksSpaceI = 0,
	tasksSpaceRelative = 0,
	maxLevel = 1,
	reloadCountdown = 2,
	recoverReloadCountDown = 10;

levels[1] = {
	tasksSpacePlus: 20,
	tasksSpaceMin: 10,
	tasks: 2
};
levels[2] = {
	tasksSpacePlus: 5,
	tasksSpaceMin: 1,
	tasks: 30
};
for (var key in levels) {
	if (key > maxLevel) {
		maxLevel = key;
	}
}
function init() {
	controllers = [];
	socket = io.listen(2324);
	socket.configure(function() {
		socket.set("transports", ["websocket"]);
		socket.set("log level", 2);
	});
	setEventHandlers();
	setNewGame();
};
var setEventHandlers = function() {
	socket.sockets.on("connection", onSocketConnection);
};
function onSocketConnection(client) {
	client.on("disconnect", onPlayerDisconnect);
	client.on("new player", onNewPlayer);
	client.on("ready", onPlayerReady);
	client.on("solution", onSolution);
};
function safeNick(nick) {
	return nick.replace(/[`~#^&;'"<>\\\/]/gi, '');
}
function onNewPlayer(data){
	util.log('New player (ID: '+this.id+')');
	players[this.id] = {
		nick: safeNick(data.nick),
		ready: false,
		reloadCountdown: 0,
		right: 0,
		wrong: 0
	};
	if (inLobby === true) {
		socket.sockets.socket(this.id).emit('new level', level);
		socket.sockets.emit('not ready', countReadyPlayers());
	} else {
		socket.sockets.socket(this.id).emit('level start', level);
		for (var id in runningTasks) {
			socket.sockets.socket(this.id).emit('new task', sendTaskForm(id));
		}
	}
}
function onPlayerDisconnect(){
	util.log('Player disconnected (ID: '+this.id+')');
	delete players[this.id];
	checkReady();
}
function checkReady(){
	if (inLobby === true) {
		var count = countReadyPlayers();
		if (count.n === 0 && count.t !== 0) {
			util.log('Starting level '+level);
			startLevel();
		} else {
			socket.sockets.emit('not ready', count);
		}
	}
}
function onPlayerReady(data){
	if (inLobby === true) {
		if (data) {
			players[this.id].ready = true;
		} else {
			players[this.id].ready = false;
		}
		checkReady();
	}
}
function countReadyPlayers(){
	var notReady = 0,
		total = 0;
	for (var player in players) {
		if (players[player].ready === false) {
			notReady++;
		}
		total++;
	}
	return {y: (total-notReady), n: notReady, t: total};
}
function countArray(array){
	var i = 0;
	for (var e in array) {
		i++;
	}
	return i;
}
function getStats(){
	var stats = [];
	for (var id in players) {
		stats.push({
			n: players[id].nick,
			r: players[id].right,
			w: players[id].wrong
		});
	}
	return stats;
}
function gameEnd(){
	util.log('Game over');
	socket.sockets.emit('game end',0);
	socket.sockets.emit('stats',getStats());
	setNewGame();
}
function setNewGame(){
	level = 1;
	taskLastId = 1;
	for (var player in players) {
		players[player].ready = false;
		players[player].right = 0;
		players[player].wrong = 0;
	}
	setNextLevel();
}
function setNextLevel(){
	inLobby = true;
	for (var id in players) {
		players[id].ready = false;
	}
	socket.sockets.emit('new level',level);
	socket.sockets.emit('not ready', countReadyPlayers());

	remainingTasks = levels[level].tasks;
	runningTasks = [];
	tasks = [];
	inLobby = true;
	time = 0;
	tasksSpaceI = 0;

	tasksSpaceRelative = levels[level].tasksSpaceMin+levels[level].tasksSpacePlus;

	if (level !== 1) {
		socket.sockets.emit('stats',getStats());
	}
}
function sendTaskForm(id){
	return {
				id: id,
				d: runningTasks[id].display,
				tl: runningTasks[id].timeLifespan,
				te:runningTasks[id].timeEnd
			};
}
function startLevel(){
	inLobby = false;
	socket.sockets.emit('level start', level);
	gameLoop = setInterval(function(){
		if (remainingTasks <= 0) {
			util.log('Ending level '+level);
			if (level < maxLevel) {
				level++;
			}
			clearInterval(gameLoop);
			setNextLevel();
		} else {
			if (tasksSpaceI === 0 || countArray(runningTasks) === 0) {
				tasksSpaceI = tasksSpaceRelative;
				if (countArray(runningTasks) < remainingTasks) {
					var randNumb = Math.floor((Math.random()*10)+1);
					var lifes = Math.floor((Math.random()*100)+100);
					runningTasks[taskLastId] = {
						display: 'Task: '+randNumb,
						solution: randNumb,
						timeLifespan: lifes,
						timeEnd: time + lifes

					};
					socket.sockets.emit('new task', sendTaskForm(taskLastId));
					taskLastId++;
					tasksSpaceRelative = Math.floor(levels[level].tasksSpaceMin+levels[level].tasksSpacePlus*(remainingTasks-countArray(runningTasks))/levels[level].tasks);
				}
			} else {
				tasksSpaceI--;
			}
		}
		for (var id in players) {
			if (players[id].reloadCountdown !== 0) {
				players[id].reloadCountdown--;
				if (players[id].reloadCountdown === 0) {
					socket.sockets.socket(id).emit('loading', false);
				}
			}
		}
		if (runningTasks.length !== 0) {
			var doIt = true;
			for (var id in runningTasks) {
				if (doIt === true && runningTasks[id].timeEnd <= time) {
					clearInterval(gameLoop);
					setTimeout(function(){
						gameEnd();
					},50);
					doIt = false;
				}
			}
		}
		time++;
		socket.sockets.emit('time', time);
	},125);
}
function onSolution(data){
	var isWrong = true;
	for (var id in runningTasks) {
		if (players[this.id].reloadCountdown === 0 && runningTasks[id].solution == data) {
			remainingTasks--;
			delete runningTasks[id];
			socket.sockets.emit('solved', {i: id,n: players[this.id].nick});
			isWrong = false;
		}
	}
	if (isWrong) {
		players[this.id].reloadCountdown = recoverReloadCountDown;
		players[this.id].wrong++;
	} else {
		players[this.id].reloadCountdown = reloadCountdown;
		players[this.id].right++;
	}
	socket.sockets.socket(this.id).emit('was wrong', isWrong);
}





init();