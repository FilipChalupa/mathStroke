var util = require("util"),
	io = require("socket.io");

var http = require("http"),
	url = require("url"),
	path = require("path"),
	fs = require("fs"),
	mime = require("mime"),
	port = process.argv[2] || 8080;

var socket,
	players = [],
	level = 1,
	world = 1,
	runningTasks = [],
	sprintTasks = [],
	taskLastId = 0,
	playerLastId = 0,
	remainingTasks = 0,
	inLobby = true,
	gameType = 'sprint',
	votesGameType = {
		'story': 0,
		'sprint': 0
	},
	basicLevel = 0,
	sprintTitle = 'Sprint!',
	sprintData = {},
	gameLoop,
	tasksSpaceI = 0,
	reloadCountdown = 2,
	recoverReloadCountdown = 10,
	stories = [],
	story,
	gameRunning = false,
	taskIndex = 1,
	newTask,
	findFreeSolutionTries = 0,
	timeSaved = 0,
	gameLoopLength = 125,
	tasksSolved = 0,
	tasksUsed = {
		0: 0,
		1: 0,
		2: 0,
		3: 0,
		4: 0
	};

var server = http.createServer(function(request, response) {
	var uri = '/public'+url.parse(request.url).pathname,
		filename = path.join(process.cwd(), uri);
	fs.exists(filename, function(exists) {
		if(!exists) {
			util.log('Request '+uri+' (404)');
			response.writeHead(404, {"Content-Type": "text/plain"});
			response.write("404 Not Found\n");
			response.end();
			return;
		}
		if (fs.statSync(filename).isDirectory()) filename += '/index.html';
		fs.readFile(filename, "binary", function(err, file) {
		if(err) {
			util.log('Request '+uri+' (500)');     
			response.writeHead(500, {"Content-Type": "text/plain"});
			response.write(err + "\n");
			response.end();
			return;
		}
			util.log('Request '+uri+' (200)');
			response.writeHead(200, {"Content-Type": mime.lookup(filename)});
			if (uri == '/public/media/js/basic.js') {
				file = file.replace('{{server_port}}',port);
			}
			response.write(file, "binary");
			response.end();
		});
	});
});

var tasksFilePath = __dirname+'/tasks.json',
	tasksHolder = [],
	tasksCount = 1,
	difficultyStrength = 10; // how easy can be difficulty changed (0 - easy, 50 - hard)
for (var i=1; i<=5;i++){
	tasksHolder.push({
		type: 'x+y',
		version: i,
		difficulty: i
	});
	tasksHolder.push({
		type: 'x-y',
		version: i,
		difficulty: i
	});
	tasksHolder.push({
		type: 'x*y',
		version: i,
		difficulty: i
	});
	tasksHolder.push({
		type: 'x/y',
		version: i,
		difficulty: i
	});
}
tasksCount = tasksHolder.length;
function sortTasksHolder(){
	tasksHolder.sort(function(a, b) { 
		return a.difficulty - b.difficulty;
	});
}
sortTasksHolder();
saveDifficulty();
fs.readFile(tasksFilePath, 'utf8', function (err, data) {
	if (err) {
		util.log('Error: ' + err);
		return;
	}
	try {
		data = JSON.parse(data);
		setDifficulty(data);
	} catch (e) {
		data = {};
		util.log(e);
	}
});
function setDifficulty(data){
	for (var i in tasksHolder) {
		var type = tasksHolder[i].type;
		if (typeof data[type] !== 'undefined'
			&& data[type].hasOwnProperty(tasksHolder[i].version)) {
			tasksHolder[i].difficulty = parseInt(data[type][tasksHolder[i].version]);
		}
	}
	sortTasksHolder();
}
function saveDifficulty(){
	var answer = {};
	for (var i in tasksHolder) {
		if (typeof answer[tasksHolder[i].type] !== 'object') {
			answer[tasksHolder[i].type] = {};
		}
		answer[tasksHolder[i].type][tasksHolder[i].version] = ''+Math.floor(tasksHolder[i].difficulty);
	}
	fs.writeFile(tasksFilePath,JSON.stringify(answer));
}
function getTask(type,difficulty){
	var task, solution, x, y, nanoS, tempA, tempB, tempC;
	switch (type) {
		case 'x+y':
			switch (difficulty) {
				case 1:
					tempA = getRandomInInterval(1,9);
					x = getRandomInInterval(0,tempA);
					y = tempA-x;
					break;
				case 2:
					tempA = getRandomInInterval(1,9);
					x = getRandomInInterval(0,tempA);
					y = tempA-x;
					tempA = getRandomInInterval(2,9);
					tempB = getRandomInInterval(1,tempA-1);
					x += 10*tempB;
					y += 10*(tempA-tempB);
					break;
				case 3:
					tempA = getRandomInInterval(1,9);
					x = getRandomInInterval(10-tempA,9);
					y = tempA;
					tempA = getRandomInInterval(2,8);
					tempB = getRandomInInterval(1,tempA-1);
					x += 10*tempB;
					y += 10*(tempA-tempB);
					break;
				case 4:
					tempA = getRandomInInterval(1,9);
					x = getRandomInInterval(0,tempA);
					y = tempA-x;
					tempA = getRandomInInterval(2,9);
					x += 10*tempA;
					y += 10*getRandomInInterval(11-tempA,9);
					break;
				case 5:
					tempA = getRandomInInterval(1,9);
					x = getRandomInInterval(10-tempA,9);
					y = tempA;
					tempA = getRandomInInterval(2,9);
					x += 10*tempA;
					y += 10*getRandomInInterval(11-tempA,9);
					break;
			}
			task = x+' + '+y;
			nanoS = process.hrtime();
			solution = x+y;
			nanoS = process.hrtime(nanoS)[1];
			break;
		case 'x-y':
			switch (difficulty) {
				case 1:
					x = getRandomInInterval(1,9);
					y = getRandomInInterval(1,x);
					break;
				case 2:
					y = getRandomInInterval(2,9);
					x = getRandomInInterval(1,y-1);
					x += 10*getRandomInInterval(1,9);
					break;
				case 3:
					x = getRandomInInterval(2,9);
					y = getRandomInInterval(1,x-1);
					tempA = getRandomInInterval(1,9);
					tempB = getRandomInInterval(1,tempA);
					x += 10*tempA;
					y += 10*tempB;
					break;
				case 4:
					y = getRandomInInterval(2,9);
					x = getRandomInInterval(1,y-1);
					tempA = getRandomInInterval(2,5);
					x += 10*tempA;
					y += 10*(tempA-1);
					break;
				case 5:
					y = getRandomInInterval(2,9);
					x = getRandomInInterval(1,y-1);
					tempA = getRandomInInterval(5,9);
					x += 10*tempA;
					y += 10*(getRandomInInterval(1,tempA-2));
					break;
			}
			task = x+' - '+y;
			nanoS = process.hrtime();
			solution = x-y;
			nanoS = process.hrtime(nanoS)[1];
			break;
		case 'x*y':
			switch (difficulty) {
				case 1:
					x = getRandomInInterval(2,5);
					y = getRandomInInterval(2,5);
					break;
				case 2:
					x = getRandomInInterval(6,10);
					y = getRandomInInterval(2,5);
					break;
				case 3:
					x = getRandomInInterval(6,9);
					y = getRandomInInterval(6,9);
					break;
				case 4:
					x = getRandomInInterval(2,5);
					y = getRandomInInterval(11,15);
					break;
				case 5:
					x = getRandomInInterval(6,9);
					y = getRandomInInterval(11,15);
					break;
			}
			if (Math.random() < 0.5){
				tempA = x;
				x = y;
				y = tempA;
			}
			task = x+' &#215; '+y;
			nanoS = process.hrtime();
			solution = x*y;
			nanoS = process.hrtime(nanoS)[1];
			break;
		case 'x/y':
			switch (difficulty) {
				case 1:
					tempA = getRandomInInterval(2,5);
					y = getRandomInInterval(2,5);
					x = tempA*y;
					break;
				case 2:
					tempA = getRandomInInterval(6,9);
					y = getRandomInInterval(6,9);
					x = tempA*y;
					break;
				case 3:
					tempA = getRandomInInterval(11,15);
					y = getRandomInInterval(3,5);
					x = tempA*y;
					break;
				case 4:
					tempA = getRandomInInterval(11,15);
					y = getRandomInInterval(6,9);
					x = tempA*y;
					break;
				case 5:
					tempA = getRandomInInterval(16,19);
					y = getRandomInInterval(3,5);
					x = tempA*y;
					break;
			}
			task = x+' / '+y;
			nanoS = process.hrtime();
			solution = x/y;
			nanoS = process.hrtime(nanoS)[1];
			break;
	}
	if (gameType !== 'sprint') {
		var doIt = true;
		for (var id in runningTasks) {
			if (doIt === true && runningTasks[id].solution === solution) {
				findFreeSolutionTries++;
				if (findFreeSolutionTries < 10) {
					return getTask(type,difficulty);
				} else {
					doIt = false;
					util.log('Task with unique solution not found.');
				}
			}
		}
		findFreeSolutionTries = 0;
	}
	return {
		display: task,
		solution: solution,
		nanoseconds: nanoS
	};
}
function init() {
	players = [];
	socket = io.listen(server);
	socket.configure(function() {
		socket.set("transports", ["websocket"]);
		socket.set("log level", 2);
	});
	setEventHandlers();
	setNewGame();
};
server.listen(parseInt(port, 10));
util.log("Server running at port " + port);

function onVoteGameType(data) {
	if (level === 1) {
		players[this.id].gametype = data;
		updateVotesGameType();
	}
}
function updateVotesGameType(){
	for (var key in votesGameType) {
		votesGameType[key] = 0;
	}
	var countPlayers = 0;
	for (var id in players) {
		if (typeof votesGameType[players[id].gametype] !== 'undefined') {
			votesGameType[players[id].gametype]++;
		}
		countPlayers++;
	}
	for (var key in votesGameType) {
		if (votesGameType[key] > countPlayers/2) {
			if (gameType !== key) {
				gameType = key;
				util.log('Game mode changed to '+gameType);
				socket.sockets.emit('hide statistics','');
				setNewGame();
			}
		}
	}
	socket.sockets.emit('votes gametype',votesGameType);
}
function getRandomInInterval(first,last){
	return first+Math.floor(Math.random()*((last-first)+1));
}
stories.push({
	title: 'mathStroke',
	levels: {
		1: {
			title: 'Welcome',
			text: '---'
		},
		/*2: {
			title: 'Faster!',
			text: 'We are running out of time.'
		},
		3: {
			title: 'Turbo',
			text: 'There is no time to rest'
		},*/
		/*3: {
			title: 'Harder',
			text: '<img src="http://library.thinkquest.org/J002596/Calcdude.gif" width="415" height="388"><p>I did the same thing as well, though you do have to be careful sometimes when messing with Array.prototype, especially when using third-party modules.</p><p>I did the same thing as well, though you do have to be careful sometimes when messing with Array.prototype, especially when using third-party modules.</p>'
		},*/
		end: {
			title: 'End',
			text: 'This is the end of the story.'
		},
		failure: 'Game over.'
	}
});
var setEventHandlers = function() {
	socket.sockets.on("connection", onSocketConnection);
};
function onSocketConnection(client) {
	client.on("disconnect", onPlayerDisconnect);
	client.on("new player", onNewPlayer);
	client.on("player update", onPlayerUpdate);
	client.on("ready", onPlayerReady);
	client.on("vote gametype", onVoteGameType);
	client.on("solution", onSolution);
};
var safeNick = function(string, reverse){
	if (string.length > 13) {
		string = string.substr(0,13);
	}
	var specialChars = {
			"&": "&amp;",
			"<": "&lt;",
			">": "&gt;",
			'"': "&quot;"
		}, x;
	if (typeof(reverse) != "undefined")
	{
		reverse = [];
		for (x in specialChars)
			reverse.push(x);
		reverse.reverse();
		for (x = 0; x < reverse.length; x++)
			string = string.replace(
				new RegExp(specialChars[reverse[x]], "g"),
				reverse[x]
			);
		return string;
	}
	for (x in specialChars)
		string = string.replace(new RegExp(x, "g"), specialChars[x]);
	return string;
};
function onNewPlayer(data){
	playerLastId++;
	players[this.id] = {
		id: playerLastId,
		nick: safeNick(data.nick),
		ready: false,
		reloadCountdown: 0,
		right: 0,
		wrong: 0,
		gametype: '',
		sprintTime: '-',
		currentTask: 'done'
	};
	util.log('New player (id: '+playerLastId+')');
	socket.sockets.socket(this.id).emit('player id', playerLastId);
	socket.sockets.emit('player new',{i: playerLastId, n: players[this.id].nick});
	if (inLobby === true) {
		socket.sockets.socket(this.id).emit('votes gametype',votesGameType);
		socket.sockets.socket(this.id).emit('new level', getNewLevelData());
		socket.sockets.socket(this.id).emit('stats',getStats());
		socket.sockets.emit('not ready', countReadyPlayers());
	} else {
		socket.sockets.socket(this.id).emit('level start', level);
		for (var id in runningTasks) {
			socket.sockets.socket(this.id).emit('new task', sendTaskForm(runningTasks[id]));
		}
	}
}
function onPlayerUpdate(data){
	players[this.id].nick = safeNick(data.nick);
	socket.sockets.emit('nick update',{i: players[this.id].id, n: players[this.id].nick});
	util.log('Player changed name to '+players[this.id].nick+' (id: '+players[this.id].id+')');
}
function onPlayerDisconnect(){
	util.log(players[this.id].nick+' disconnected (id: '+players[this.id].id+')');
	socket.sockets.emit('player gone',players[this.id].id);
	delete players[this.id];
	updateVotesGameType();
	checkReady();
}
function checkReady(){
	if (inLobby === true) {
		var count = countReadyPlayers();
		if (count.n === 0 && count.t !== 0) {
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
		total = 0,
		nIds = [];
	for (var player in players) {
		if (players[player].ready === false) {
			notReady++;
			nIds.push(players[player].id);
		}
		total++;
	}
	return {y: (total-notReady), n: notReady, t: total, nId: nIds};
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
			i: players[id].id,
			n: players[id].nick,
			r: players[id].right,
			w: players[id].wrong,
			t: players[id].sprintTime
		});
	}
	stats = stats.sort(function(a,b){
		if (gameType === 'story') {
			return b.r - a.r;
		} else if (gameType === 'sprint') {
			return a.t - b.t;
		}
	});
	return stats;
}
function getSprintStats(){
	var stats = [];
	for (var id in players) {
		stats.push({
			i: players[id].id,
			n: players[id].nick,
			r: players[id].taskIndex
		});
	}
	stats = stats.sort(function(a,b){
		return b.r - a.r;
	});
	return stats;
}
function gameEnd(){
	util.log('Game over');
	socket.sockets.emit('game end',{l: level, t:story.levels.failure, s: tasksSolved,n: timeSaved});
	socket.sockets.emit('stats',getStats());
	if (gameType === 'sprint') {
		setDifficulty(sprintData);
		saveDifficulty();
		sortTasksHolder();
	}
	setNewGame();
}
function setNewGame(){
	level = 1;
	world = 1;
	timeSaved = 0;
	taskLastId = 0;
	tasksSolved = 0;
	sprintData = {};
	story = stories[Math.floor(Math.random() * stories.length)];
	for (var player in players) {
		players[player].ready = false;
		players[player].right = 0;
		players[player].wrong = 0;
		players[player].gametype = '';
		players[player].score = 0;
		players[player].currentTask = {};
	}
	for (var key in votesGameType) {
		votesGameType[key] = 0;
	}
	setNextLevel();
}
function getNewLevelData(){
	if (gameType === 'story') {
		var levelTitle = '',
			levelText = '';
		if (story.levels[level]) {
			levelTitle = story.levels[level].title;
			levelText = story.levels[level].text;
		} else {
			levelTitle = story.levels.end.title;
			levelText = story.levels.end.text;
		}
		return {gt: gameType, l: level,st: story.title,lt: levelTitle,lx: levelText};
	} else if (gameType === 'sprint') {
		return {gt: gameType, l: level,st: sprintTitle};
	}
}
function setNextLevel(){
	inLobby = true;
	for (var id in players) {
		players[id].ready = false;
	}
	if (level !== 1) {
		socket.sockets.emit('stats',getStats());
	} else {
		socket.sockets.emit('votes gametype',votesGameType);
	}
	socket.sockets.emit('new level',getNewLevelData());
	socket.sockets.emit('not ready', countReadyPlayers());

	remainingTasks = 20;
	runningTasks = [];
	tasks = [];
	inLobby = true;
	time = 0;
	tasksSpaceI = 0;
	taskIndex = 1;
	basicLevel = (level-1)%(tasksCount-4);
	world = 1+Math.floor((level-1)/(tasksCount-4));
	for (var i in tasksUsed) {
		tasksUsed[i] = 0;
	}
	if (gameType === 'sprint') {
		sprintTasks = [];
		for (var i in tasksHolder) {
			newTask = getTask(tasksHolder[i].type,tasksHolder[i].version);
			sprintTasks.push({
				id: i,
				display: newTask.display,
				solution: newTask.solution,
				type: tasksHolder[i].type,
				version: tasksHolder[i].version,
				timeSaved: newTask.nanoseconds
			});
		}
	}
}
function sendTaskForm(task){
	return {
		id: task.id,
		d: task.display,
		tl: task.timeLifespan,
		te:task.timeEnd
	};
}
function startLevel(){
	inLobby = false;
	socket.sockets.emit('level start', level);
	var countDown = 3;
	gameRunning = true;
	socket.sockets.emit('countdown', countDown);
	util.log('Starting level '+level+' (world: '+world+')');
	var iCountDown = setInterval(function(){
		if (countDown === 0) {
			clearInterval(iCountDown);
			if (gameType === 'sprint') {
				for (var id in players) {
					players[id].currentTask = sprintTasks[0];
					players[id].currentTask.startTime = 0;
				}
				socket.sockets.emit('new task', sendTaskForm(sprintTasks[0]));
			}
			startGameStoryLoop();
		} else {
			countDown--;
			socket.sockets.emit('countdown', countDown);
			util.log('Countdown: '+countDown);
		}
	},1000);
}
function startGameStoryLoop(){
	gameLoop = setInterval(function(){
		if (remainingTasks <= 0) {
			util.log('Ending level '+level);
			level++;
			clearInterval(gameLoop);
			gameRunning = false;
			setTimeout(function(){
				setNextLevel();
			},2000);
		} else {
			for (var id in players) {
				if (players[id].reloadCountdown !== 0) {
					players[id].reloadCountdown--;
					if (players[id].reloadCountdown === 0) {
						socket.sockets.socket(id).emit('loading', false);
					}
				}
			}
			if (gameType === 'sprint') {

			} else if (gameType === 'story') {
				if (tasksSpaceI === 0 || countArray(runningTasks) === 0 || (gameType === 'story' && countArray(runningTasks) < countArray(players))) {
					if (countArray(runningTasks) < remainingTasks) {
						var harderPlus = 0,
							indexInLevel = taskIndex%tasksCount;
						if (indexInLevel === 0) {indexInLevel = 20;}
						switch (taskIndex) {
							case 2:
							case 3:
							case 8:
							case 14:
								harderPlus = 1;
								break;
							case 5:
							case 10:
							case 13:
							case 17:
								harderPlus = 2;
								break;
							case 6:
							case 9:
							case 15:
							case 19:
								harderPlus = 3;
								break;
							case 11:
							case 16:
							case 18:
							case 20:
								harderPlus = 4;
								break;
						}
						var typeT = tasksHolder[basicLevel+harderPlus].type,
							versionT = tasksHolder[basicLevel+harderPlus].version;
						newTask = getTask(typeT,versionT);
						newTask.time = Math.ceil((60/level+80/indexInLevel+70)/world);
						tasksSpaceI = Math.ceil(newTask.time/(tasksUsed[harderPlus]+2));
						runningTasks[taskLastId] = {
							id: taskLastId,
							display: newTask.display,
							solution: newTask.solution,
							timeLifespan: newTask.time,
							timeEnd: time + newTask.time,
							timeSaved: newTask.nanoseconds
						};
						/*if (gameType === 'sprint') {
							runningTasks[taskLastId].type = typeT;
							runningTasks[taskLastId].version = versionT;
							runningTasks[taskLastId].index = indexInLevel;
							tasksSpaceI = runningTasks[taskLastId].timeLifespan;
						}*/
						util.log('New task (id: '+taskLastId+')');
						socket.sockets.emit('new task', sendTaskForm(runningTasks[taskLastId]));
						taskIndex++;
						taskLastId++;
						tasksUsed[harderPlus]++;
					}
				} else {
					tasksSpaceI--;
				}
				if (runningTasks.length !== 0) {
					var doIt = true;
					for (var id in runningTasks) {
						if (doIt === true && runningTasks[id].timeEnd <= time) {
							clearInterval(gameLoop);
							socket.sockets.emit('was wrong', true);
							socket.sockets.emit('late task', id);
							gameRunning = false;
							setTimeout(function(){
								gameEnd();
							},3000);
							doIt = false;
						}
					}
				}
			}
			time++;
			socket.sockets.emit('time', time);
		}
	},gameLoopLength);
};
function onSolution(data){
	if (gameRunning === true && players[this.id].reloadCountdown === 0) {
		var isWrong = true;
		if (gameType === 'story') {
			for (var id in runningTasks) {
				if (runningTasks[id].solution == data) {
					remainingTasks--;
					tasksSolved++;
					timeSaved += runningTasks[id].timeSaved;
					util.log(players[this.id].nick+' (id: '+players[this.id].id+') solved task (id: '+id+')');
					socket.sockets.emit('solved', {i: id,n: players[this.id].nick,s:runningTasks[id].solution});
					delete runningTasks[id];
					isWrong = false;
				}
			}
		} else if (gameType === 'sprint') {
			if (players[this.id].currentTask !== 'done') {
				if (players[this.id].currentTask.solution == data) {
					isWrong = false;
					tasksSolved++;
					timeSaved += players[this.id].currentTask.timeSaved;
					socket.sockets.socket(this.id).emit('solved', {i: players[this.id].currentTask.id});
					var type = players[this.id].currentTask.type,
						version = players[this.id].currentTask.version,
						timeUsed = time-players[this.id].currentTask.startTime;
					if (typeof sprintData[type] === 'undefined') {
						sprintData[type] = {};
					}
					if (typeof sprintData[type][version] === 'undefined') {
						sprintData[type][version] = tasksHolder[players[this.id].currentTask.id].difficulty;
					}
					/*console.log('<<<<<<<');
					console.log('timeused: '+timeUsed);
					console.log('strength: '+difficultyStrength);
					console.log(sprintData[type][version]);*/
					sprintData[type][version] = (sprintData[type][version]*difficultyStrength+timeUsed)/(difficultyStrength+1);
					sprintData[type][version].s++;
					/*console.log(sprintData[type][version]);
					console.log('>>>>>>>');*/
					if ((sprintTasks.length-1) > players[this.id].currentTask.id) {
						players[this.id].currentTask = sprintTasks[parseInt(players[this.id].currentTask.id)+1];
						players[this.id].currentTask.startTime = time;
						socket.sockets.socket(this.id).emit('new task', sendTaskForm(players[this.id].currentTask));
					} else {
						var allDone = true;
						players[this.id].currentTask = 'done';
						players[this.id].sprintTime = Math.ceil(time*gameLoopLength/1000);
						for (var id in players) {
							if (players[id].currentTask !== 'done') {
								allDone = false;
							}
						}
						if (allDone === true) {
							gameRunning = false;
							setTimeout(function(){
								gameEnd();
							},1000);
						}
					}
				}
			} else {
				isWrong = 'skip';
			}
		}
		if (isWrong !== 'skip') {
			if (isWrong === true) {
				players[this.id].reloadCountdown = recoverReloadCountdown;
				players[this.id].wrong++;
			} else {
				players[this.id].reloadCountdown = reloadCountdown;
				players[this.id].right++;
			}
			socket.sockets.socket(this.id).emit('was wrong', isWrong);
		}
	}
}

init();