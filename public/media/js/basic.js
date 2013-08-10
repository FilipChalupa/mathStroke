$(function () {
	var requestAnimationFrame = (function(){
		return  window.requestAnimationFrame       || 
			window.webkitRequestAnimationFrame || 
			window.mozRequestAnimationFrame    || 
			window.oRequestAnimationFrame      || 
			window.msRequestAnimationFrame     || 
			function(callback, element){
				window.setTimeout(callback, 1000 / 60);
			};
	})();
	var level = 0,
		tasks = [],
		loading = false,
		inLobby = false,
		blockReady = false,
		nick = '---',
		keyboardTimeout;
	var $level = $('#lobby .level'),
		$lobbyRoom = $('#lobby'),
		$gameRoom = $('#game'),
		$settingsRoom = $('#settings'),
		$gameTasks = $('#game .tasks'),
		$rooms = $('.room'),
		$messagesRoom = $('#messages'),
		$messagesRoomMsg = $('#messages .msg'),
		$lobbyReadyButton = $('#lobby .ready'),
		$lobbyReadyCount = $('#lobby .notReady'),
		$lobbyStatsList = $('#lobby .stats .list'),
		$lobbyStats = $('#lobby .stats'),
		$gameInput = $('#game .input'),
		$gameControl = $('#game .control'),
		$gameKeyboardButtons = $('#game .keyboard .button'),
		$lobbySettings = $('#lobby .settings'),
		$settingsKeyboard = $('#settings .keyboardToggle');
	if(typeof(Storage)!=="undefined") {
		if (localStorage.hideKeyboard == 'true') {
			$gameRoom.addClass('hideKeyboard');
		} else {
			$settingsKeyboard.addClass('selected');
		}
		if (localStorage.nick) {
			nick = localStorage.nick;
		}
	}
	$lobbySettings.click(function(){
		showRoom($settingsRoom);
	});
	$('#settings .back').click(function() {
		showRoom($lobbyRoom);
	});
	$settingsKeyboard.click(function() {
		$gameRoom.toggleClass('hideKeyboard');
		if ($gameRoom.hasClass('hideKeyboard')) {
			$settingsKeyboard.removeClass('selected');
		} else {
			$settingsKeyboard.addClass('selected');
		}
		if(typeof(Storage)!=="undefined") {
			localStorage.hideKeyboard = $gameRoom.hasClass('hideKeyboard');
		}
	});
	function showRoom($room) {
		$rooms.removeClass('show');
		$room.addClass('show');
	}
	function showMessageRoom(message) {
		showRoom($messagesRoom);
		$messagesRoomMsg.removeClass('show');
		$messagesRoom.children('.'+message).addClass('show');
	}
	function connect() {
		socket = io.connect("http://192.168.1.230", {port: 2324, transports: ["websocket"]});
		setEventHandlers();
	};
	var setEventHandlers = function() {
		socket.on("connect", onSocketConnected);
		socket.on("disconnect", onSocketDisconnect);
		socket.on("new level", onNewLevel);
		socket.on("level start", onLevelStart);
		socket.on("not ready", onNotReady);
		socket.on("new task", onNewTask);
		socket.on("loading", onLoading);
		socket.on("solved", onSolved);
		socket.on("time", onTime);
		socket.on("was wrong", onWasWrong);
		socket.on("game end", onGameEnd);
		socket.on("stats", onStats);
		socket.on("test", test);
	};
	function test(data){
		alert(data);
	}
	function onSocketDisconnect() {
		showMessageRoom('reconnect');
	};
	function onSocketConnected() {
		socket.emit("new player", {nick: nick});
	};
	function onGameEnd(data){
		//
	}
	function onStats(data) {
		$lobbyStatsList.html('');
		$lobbyStats.addClass('show');
		var i = 1;
		$.each(data,function(key,val){
			$lobbyStatsList.append('<div><div class="rank">'+i+'</div><div class="nick">'+val.n+'</div><div class="right">'+val.r+'</div><div class="wrong">'+val.w+'</div></div>');
			i++;
		});
	}
	function onNewLevel(data){
		level = data;
		tasks = [];
		loading = false;
		inLobby = true;
		$gameTasks.html('');
		$level.text(level);
		$lobbyReadyButton.removeClass('selected');	
		showRoom($lobbyRoom);
		$gameRoom.removeClass('wrong');
		$gameRoom.removeClass('right');
		$gameInput.text('');
		blockReady = true;
		setTimeout(function(){
			blockReady = false;
		},500);
	}
	function onLevelStart(data){
		level = data;
		inLobby = false;
		showRoom($gameRoom);
	}
	function onNotReady(data){
		$lobbyReadyCount.text('('+data.y+'/'+data.t+')');
	}
	function onNewTask(data){
		tasks[data.id] = {
			display: data.d,
			timeLifespan: data.tl,
			timeEnd: data.te
		}
		$gameTasks.append('<div class="task" data-id="'+data.id+'"><div class="title">'+data.d+'</div><div class="t_wrapper"><div class="time"></div></div></div>');
	}
	function onTime(data) {
		$gameTasks.children('.task').each(function(){
			var $this = $(this);
			if (!$this.hasClass('solved')) {
				var w = Math.floor(100*(tasks[$this.data('id')].timeEnd-data)/tasks[$this.data('id')].timeLifespan),
					o = 1;
				o = w/100;
				if (w < 1) {w = 1;}
				if (o < 0.1) {
					o = 1;
					$this.addClass('danger');
				} else {
					o = 1-o;
				}
				$this.find('.time').css({
					'opacity': o,
					width: (100-w)+'%'
				});
			}
		});
	}
	function onSolved(data){
		$gameTasks.children('.task').each(function(){
			var $this = $(this);
			if ($this.data('id') == data.i) {
				$this.addClass('solved').removeClass('danger').append('<div class="player">'+data.n+'</div>').delay(1500).animate({
					height: "toggle",
					'margin-top': 0
					}, 500, function() {
						$this.remove();
				});
			}
		});
	}
	function onWasWrong(data){
		if (data === true) {
			$gameRoom.addClass('wrong');
		} else {
			$gameRoom.addClass('right');
		}
	}
	function onLoading(data){
		loading = data;
		if (loading === false) {
			$gameRoom.removeClass('wrong');
			$gameRoom.removeClass('right');
			$gameInput.text('');
		}
	}
	function gameKey(key){
		if (inLobby) {
			if (key === 'submit') {
				lobbyReadyButtonClick();
			}
		} else {
			if (loading === false) {
				if ($.isNumeric(key)) {
					$gameInput.append(key);
				} else if (key === 'submit') {
					if ($gameInput.text().length !== 0) {
						sendSolution($gameInput.text());
						onLoading(true);
					}
				} else if (key === 'backspace') {
					$gameInput.text($gameInput.text().slice(0,-1));
				}
				if (key !== 'submit' || $gameInput.text().length !==0) {
					$gameKeyboardButtons.each(function(){
						var $this = $(this);
						if ($this.data('key') == key) {
							$this.addClass('selected');
							if (keyboardTimeout) {
								clearTimeout(keyboardTimeout);
							}
							keyboardTimeout = setTimeout(function(){
								$gameKeyboardButtons.removeClass('selected');
							},250);
						}
					});
				}
			}
		}
	}
	$gameKeyboardButtons.click(function(){
		gameKey($(this).data('key'));
	});
	$(document).keydown(function(e) {
		if (e.keyCode >= 96 && e.keyCode <= 105) {
			gameKey(e.keyCode-96);
		} else if (e.keyCode >= 48 && e.keyCode <= 57) {
			gameKey(e.keyCode-48);
		} else if (e.keyCode === 13 || e.keyCode === 32) {
			gameKey('submit')
		}
		//missing backspace
	});
	function sendSolution(solution) {
		socket.emit("solution", $gameInput.text());
		onLoading(true);
	}
	function lobbyReadyButtonClick(){
		if (blockReady === false) {
			if ($lobbyReadyButton.hasClass('selected')) {
				socket.emit("ready", false);
			} else {
				socket.emit("ready", true);
			}
			$lobbyReadyButton.toggleClass('selected');
		}
	}
	$lobbyReadyButton.click(function(){
		lobbyReadyButtonClick();
	});
	connect();
});