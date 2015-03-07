$(function () {
    if (location.hostname === 'mathstroke-ofecka.rhcloud.com' && location.port == '80') {
        window.location.replace(location.protocol+'//'+location.hostname+':8000');
    }

    var requestAnimationFrame = (function(){
        return  window.requestAnimationFrame   ||
            window.webkitRequestAnimationFrame ||
            window.mozRequestAnimationFrame    ||
            window.oRequestAnimationFrame      ||
            window.msRequestAnimationFrame     ||
            function(callback, element){
                window.setTimeout(callback, 1000 / 60);
            };
    })();
    var rx = /INPUT|SELECT|TEXTAREA/i;
    $(document).bind("keydown keypress", function(e){
        if( e.which == 8 ){ // 8 == backspace
            if(!rx.test(e.target.tagName) || e.target.disabled || e.target.readOnly ){
                e.preventDefault();
            }
        }
    });
    var level = 0,
        tasks = [],
        loading = false,
        inLobby = false,
        nick = '',
        playerId = 0,
        sprintStatsMax = 0,
        keyboardTimeout,
        playSounds = false;
    var $level = $('#lobby .level'),
        $levelFailure = $('#lobby .levelFailure'),
        $timeSaved = $('#lobby .timeSaved'),
        $tasksSolved = $('#lobby .tasksSolved'),
        $storyTitle = $('#lobby .storyTitle'),
        $storyWrapper = $('#lobby .story'),
        $levelTitle = $('#lobby .levelTitle'),
        $levelText = $('#lobby .levelText .content'),
        $failureText = $('#lobby .textFailure'),
        $failureWrapper = $('#lobby .failure'),
        $lobbyRoom = $('#lobby'),
        $lobbyVoting = $('#lobby .typeVoting'),
        $gameRoom = $('#game'),
        $settingsRoom = $('#settings'),
        $gameTasks = $('#game .tasks'),
        $rooms = $('.room'),
        $body = $('body'),
        $messagesRoom = $('#messages'),
        $messagesRoomMsg = $('#messages .msg'),
        $lobbyReadyButton = $('#lobby .ready'),
        $lobbyReadyCount = $('#lobby .notReady'),
        $lobbyStatsList = $('#lobby .stats .list'),
        $gameInput = $('#game .input'),
        $gameControl = $('#game .control'),
        $gameKeyboardButtons = $('#game .keyboard .button'),
        $lobbySettings = $('#lobby .settings'),
        $settingsKeyboard = $('#settings .keyboardToggle'),
        $settingsSounds = $('#settings .soundsToggle'),
        $settingsNick = $('#settings .nickname'),
        $countdown = $('#game .countdown'),
        $sprintStats = $('#game .sprintStats'),
        $settingsBack = $('#settings .back');
    function playSound(name){
        if (playSounds === true && audios[name]) {
            audios[name].play();
        }
    }
    var audios = {};
    $('#audio audio').each(function(){
        var $this = $(this);
        audios[$this.data('name')] = $this.get(0);
        $(audios[$this.data('name')]).bind('ended',function(){
            audios[$this.data('name')].pause();
            audios[$this.data('name')].currentTime = 0;
            // chrome temporary fix START
                if(/chrom(e|ium)/.test(navigator.userAgent.toLowerCase())){
                    audios[$this.data('name')].load();
                }
            // chrome temporary fix END
        });

    });
    $("form").submit(function(event) {
        event.preventDefault();
    });
    if(typeof(Storage)!=="undefined") {
        if (localStorage.hideKeyboard == 'true') {
            $gameRoom.addClass('hideKeyboard');
        } else {
            $settingsKeyboard.addClass('selected');
        }
        if (localStorage.playSounds == 'true') {
            playSounds = true;
            $settingsSounds.addClass('selected');
        } else {
            playSounds = false;
        }
        if (localStorage.nick) {
            nick = localStorage.nick;
        }
    }
    $settingsNick.val(nick);
    $lobbySettings.click(function(){
        showRoom($settingsRoom);
    });
    $settingsBack.click(function() {
        saveSettings();
    });
    function saveSettings(){
        var newNick = $settingsNick.val();
        if (newNick != nick) {
            nick = newNick;
            socket.emit("player update", {nick: nick});
        }
        if(typeof(Storage)!=="undefined") {
            localStorage.nick = nick;
        }
        showRoom($lobbyRoom);
    }
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
    $settingsSounds.click(function() {
        playSounds = !playSounds;
        if (playSounds === true) {
            $settingsSounds.addClass('selected');
        } else {
            $settingsSounds.removeClass('selected');
        }
        if(typeof(Storage)!=="undefined") {
            localStorage.playSounds = playSounds;
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
        socket = io.connect(location.origin, {transports: ["websocket"]});
        setEventHandlers();
    }
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
        socket.on("countdown", onCountDown);
        socket.on("late task", onLateTask);
        socket.on("player id", onPlayerId);
        socket.on("player gone", onPlayerGone);
        socket.on("player new", onPlayerNew);
        socket.on("nick update", onNickUpdate);
        socket.on("votes gametype", onVoteGametype);
        socket.on("hide failure", onHideFailure);
        socket.on("new sprintstats", onNewSprintStats);
        socket.on("update sprintstats", onUpdateSprintStats);
        socket.on("test", test);
    };
    function onNewSprintStats(data){
        $sprintStats.addClass('show');
        $sprintStats.html('');
        sprintStatsMax = data.c;
        var html = '';
        $.each(data.p,function(key,val){
            html = '<div data-id="'+val.i+'"><div class="nick">'+val.n+'</div><div class="bar"></div></div>';
            if (playerId === val.i) {
                $sprintStats.prepend(html);
            } else {
                $sprintStats.append(html);
            }
        });
        onUpdateSprintStats(data.p);
    }
    function onUpdateSprintStats(data){
        var formedData = {};
        $.each(data,function(key,val){
            formedData[val.i] = val.s;
        });
        $sprintStats.children('div').each(function(){
            var $this = $(this);
            var pId = $this.data('id');
            if (formedData.hasOwnProperty(pId)) {
                $this.children('.bar').css('width',Math.floor(formedData[pId]/sprintStatsMax*100)+'%');
                if (formedData[pId] === sprintStatsMax) {
                    $this.addClass('done');
                }
            } else {
                $this.addClass('gone');
            }
        });
    }
    function test(data){
        alert(data);
    }
    function onHideFailure(data){
        $failureWrapper.removeClass('show');
    }
    function onVoteGametype(data){
        $lobbyVoting.addClass('show');
        $lobbyVoting.children('.button').each(function(){
            var $this = $(this);
            if (data[$this.data('type')] == 0) {
                $this.removeClass('selected');
            }
            $this.children('span').text(data[$this.data('type')]);
        });
    }
    $lobbyVoting.on('click','.button',function(){
        var $this = $(this);
        $lobbyVoting.children('.button').removeClass('selected');
        $this.addClass('selected');
        socket.emit("vote gametype", $this.data('type'));
    });
    function onSocketDisconnect() {
        showMessageRoom('reconnect');
    };
    function onSocketConnected() {
        socket.emit("new player", {nick: nick});
    };
    function onPlayerId(data) {
        playerId = data;
    }
    function onGameEnd(data){
        $failureText.html(data.t);
        $levelFailure.text(data.l);
        $tasksSolved.text(data.s);
        $timeSaved.text(data.n);
        $failureWrapper.addClass('show');
        $sprintStats.removeClass('show');
    }
    function onCountDown(data){
        $countdown.text(data);
        if (data === 0) {
            $countdown.addClass('hide');
            playSound('start');
        } else {
            $countdown.removeClass('hide');
            playSound('countdown');
        }
    }
    function onStats(data) {
        $lobbyStatsList.html('');
        var i = 1;
        $.each(data,function(key,val){
            addToStats(i,val.i,val.n,val.r,val.w,val.t);
            i++;
        });
    }
    function onPlayerNew(data){
        if (playerId != data.i) {
            addToStats('&nbsp;',data.i,data.n,0,0,'-');
        }
    }
    function addToStats(rank,id,nick,right,wrong,sprintTime){
        var addClass;
        if (nick == '') {
            nick = '&nbsp;';
        }
        if (playerId == id) {
            addClass = 'class="local"';
        } else {
            addClass = '';
        }
        $lobbyStatsList.append('<div data-id="'+id+'"'+addClass+'><div class="rank">'+rank+'</div><div class="nick">'+nick+'</div><div class="right">'+right+'</div><div class="wrong">'+wrong+'</div><div class="sprintTime">'+sprintTime+'</div></div>');
    }
    function onPlayerGone(data){
        $lobbyStatsList.children('div').each(function(){
            var $this = $(this);
            if ($this.data('id') == data) {
                $this.addClass('gone');
            }
        });
    }
    function onNickUpdate(data){
        $lobbyStatsList.children('div').each(function(){
            var $this = $(this);
            if ($this.data('id') == data.i) {
                $this.find('.nick').html(data.n);
            }
        });
    }
    function onNewLevel(data){
        playSound('finish');
        if (nick == '') {
            showRoom($settingsRoom);
        } else {
            showRoom($lobbyRoom);
        }
        level = data.l;
        tasks = [];
        loading = false;
        inLobby = true;
        $gameTasks.html('');
        $level.text(level);
        $storyTitle.html(data.st);
        $body.removeClass();
        $body.addClass(data.gt);
        if (data.gt === 'story' && data.lt !== '' && data.lx !== '') {
            $storyWrapper.addClass('show');
            $levelTitle.html(data.lt);
            $levelText.html(data.lx);
        } else {
            $storyWrapper.removeClass('show');
        }
        $lobbyReadyButton.removeClass('selected');
        $gameRoom.removeClass('wrong');
        $gameRoom.removeClass('right');
        $gameInput.text('');
        $lobbyReadyButton.addClass('block');
        setTimeout(function(){
            $lobbyReadyButton.removeClass('block');
        },500);
    }
    function onLevelStart(data){
        level = data;
        inLobby = false;
        $failureWrapper.removeClass('show');
        $lobbyVoting.removeClass('show');
        $lobbyVoting.children('.button').removeClass('selected');
        showRoom($gameRoom);
    }
    function onNotReady(data){
        $lobbyReadyCount.text('('+data.y+'/'+data.t+')');
        if (data.y === data.t) {
            $lobbyReadyButton.addClass('block');
        }
        $lobbyStatsList.children('div').each(function(){
            var $this = $(this);
            if ($.inArray($this.data('id'),data.nId) !== -1) {
                $this.addClass('notReady');
            } else {
                $this.removeClass('notReady');
            }
        });
    }
    function onNewTask(data){
        tasks[data.id] = {
            display: data.d,
            timeLifespan: data.tl,
            timeEnd: data.te
        }
        $gameTasks.append('<div class="task" data-id="'+data.id+'"><div class="title"><span class="expression">'+data.d+'</span><span class="solution"></span></div><div class="t_wrapper"><div class="time"></div></div></div>');
        setTimeout(function(){
            $gameTasks.children('.task').addClass('show');
        },10);
    }
    function onTime(data) {
        $gameTasks.children('.task').each(function(){
            var $this = $(this);
            if (!$this.hasClass('solved')) {
                var w = Math.floor(100*(tasks[$this.data('id')].timeEnd-data)/tasks[$this.data('id')].timeLifespan),
                    o = 1;
                if (w < 1) {
                    w = 0;
                } else {
                    o = 1-w/100;
                    if (w < 10) {
                        $this.addClass('danger');
                    }
                }
                $this.find('.time').css({
                    'opacity': o,
                    width: (100-w)+'%'
                });
            }
        });
    }
    function setSolution($task,solution){
        var $title = $task.children('.title');
        var $expression = $title.children('.expression'),
            $solution = $title.children('.solution');
        $solution.html(solution==='' ? '' : '&nbsp;= '+solution);
        $expression.css('padding-left',$solution.width());
    }
    function onSolved(data){
        $gameTasks.children('.task').each(function(){
            var $this = $(this);
            if ($this.data('id') == data.i) {
                if (data.hasOwnProperty('n')) {
                    setSolution($this,data.s);
                    $this.addClass('solved').removeClass('danger').append('<div class="player">'+data.n+'</div>').delay(1500).animate({
                        height: "toggle",
                        'margin-top': 0
                        }, 500, function() {
                            $this.remove();
                    });
                } else {
                    $this.remove();
                }
            }
        });
    }
    function onLateTask(data){
        $gameTasks.children('.task').each(function(){
            var $this = $(this);
            if ($this.data('id') == data) {
                $this.addClass('late');
            }
        });
    }
    function onWasWrong(data){
        if (data === true) {
            $gameRoom.removeClass('right');
            $gameRoom.addClass('wrong');
            playSound('fail');
        } else {
            $gameRoom.removeClass('wrong');
            $gameRoom.addClass('right');
            playSound('success');
        }
    }
    function onLoading(data){
        loading = data;
        if (loading === false) {
            $gameRoom.removeClass('wrong');
            $gameRoom.removeClass('right');
            $gameInput.text('');
            $gameTasks.children('.task').each(function(){
                var $this = $(this);
                if (!$this.hasClass('solved')) {
                    setSolution($(this),$gameInput.text());
                }
            });
        }
    }
    function gameKey(key){
        if (inLobby) {
            if ($lobbyRoom.hasClass('show')) {
                if (key === 'submit') {
                    lobbyReadyButtonClick();
                }
            } else if ($settingsRoom.hasClass('show')) {
                if (key === 'submit' || key === 'escape') {
                    saveSettings();
                }
            }
        } else {
            if (loading === false) {
                if ($.isNumeric(key)) {
                    if ($gameInput.text().length <= 4) {
                        $gameInput.append(key);
                    }
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
                if (key !== 'submit') {
                    $gameTasks.children('.task').each(function(){
                        var $this = $(this);
                        if (!$this.hasClass('solved')) {
                            setSolution($this,$gameInput.text());
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
        } else if (e.keyCode === 13) {
            gameKey('submit')
        } else if (e.keyCode === 8) {
            gameKey('backspace')
        } else if (e.keyCode === 27) {
            gameKey('escape')
        }
    });
    function sendSolution(solution) {
        socket.emit("solution", $gameInput.text());
        onLoading(true);
    }
    function lobbyReadyButtonClick(){
        if (!$lobbyReadyButton.hasClass('block')) {
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
    if(window.WebSocket){
        showMessageRoom('connecting');
        connect();
    } else {
        showMessageRoom('notSupported');
    }
});