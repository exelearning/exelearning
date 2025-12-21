// Games Plugin for eXeLearning
// By Ignacio Gros (http://www.gros.es/) for eXeLearning (http://exelearning.net/)
// Creative Commons Attribution-ShareAlike (http://creativecommons.org/licenses/by-sa/3.0/)

// $exe_i18n.exeGames is defined in common.py

$exeGames = {
    init: function() {
        var games = $("div.exe-game");
        if (games.length == 0) return false;
        var hasHangMan = false;
        games.each(function(i) {
            if ($(this).hasClass("exe-hangman")) {
                $exeGames.hangman(this, i);
                hasHangMan = true;
            }
        });
        if (typeof(eXeLearning) != 'undefined' && hasHangMan) {
            var css = '<style type="text/css">';
            css += '.exe-hangman:before{content:"' + $exe_i18n.exeGames.hangManGame + '"}';
            css += '</style>';
            $("HEAD").append(css);
        }
    },
    // Confirmed action
    run: function(action, id) {
        eval(action);
        $exeGames.message.hide(id);
    },
    message: {
        // Replace alert and confirm
        show: function(id, msg, callback) {
            var html = '<div id="' + id + '-message" class="exe-game-msg"><p>';
            html += msg;
            if (callback) html += ' <a href="#" onclick="$exeGames.run(\'' + callback + '\',\'' + id + '\');return false">' + $exe_i18n.exeGames.yes + '</a> <a href="#" onclick="$exeGames.message.hide(\'' + id + '\');return false">' + $exe_i18n.exeGames.no + '</a>';
            else html += ' <a href="#" onclick="$exeGames.message.hide(\'' + id + '\');return false">' + $exe_i18n.exeGames.accept + '</a>';
            html += '</p></div>';
            var game = $("#" + id);
            game.prepend(html);
            // Center
            var message = $("#" + id + "-message p");
            var gameHeight = game.height();
            var messageHeight = message.height();
            var margin = parseInt(gameHeight / 2 - messageHeight / 2);
            message.css("margin-top", margin + "px");
        },
        hide: function(id) {
            $('#' + id + '-message').remove();
        }
    },
    hangman: function(e, i) {
        // Add an ID to each DIV
        e.id = "exe-hangman-" + i;
        // Letters
        var letters = $exe_i18n.exeGames.az;
        var customLetters = $(".exe-hangman-letters", e);
        if (customLetters.length == 1) letters = customLetters.html();
        // Questions
        var questions = [];
        $("DT", e).each(function() {
            questions.push(this.innerHTML);
        });
        // Answers
        var answers = [];
        $("DD", e).each(function() {
            answers.push(this.innerHTML);
        });
        // Automatically add capital letters
        var addCapitalLetters = false;
        if (e.className.indexOf("add-capital-letters") != -1) addCapitalLetters = true;
        // Is case sensitive
        var isCaseSensitive = false;
        if (e.className.indexOf("case-sensitive") != -1) isCaseSensitive = true;
        // Create a new game
        hangMan.create(i, letters, questions, answers, addCapitalLetters, isCaseSensitive);
    }
}
// Hangman game
var hangMan = {
    man: new Array("___\n", "   |\n", "   O\n", "  /", "|", "\\\n", "  /", " \\\n", "___"),
    create: function(id, letters, tips, words, addCapitalLetters, isCaseSensitive) {
        if (!letters || letters == "") letters = "abcdefghijklmnopqrstuvwxyz";
        var c = '<div class="exe-game-js-content">';
        c += '<div class="wording" id="question-' + id + '">';
        c += "<ol>";
        for (var w = 0; w < tips.length; w++) {
            c += "<li>" + tips[w] + "</li>";
        }
        c += "</ol>";
        c += "</div>";
        c += '<form name="hangMan' + id + '" id="hangMan' + id + '" action="#" onsubmit="return false">\
			<p class="activity-actions"><input onclick="hangMan.start(\'' + id + '\')" type="button" value="' + $exe_i18n.exeGames.play + '" name="start-' + id + '" id="start-' + id + '" /> <input onclick="hangMan.clean(\'' + id + '\')" type="button" value="' + $exe_i18n.exeGames.playAgain + '" name="clean-' + id + '" id="clean-' + id + '" style="display:none" /></p>\
			<div id="hangManWrapper' + id + '" style="display:none">\
				<div class="hangman-blocks">\
					<div class="block">\
						<label for="displayLetters-' + id + '">' + $exe_i18n.exeGames.selectedLetters + ':</label>\
						<textarea name="displayLetters-' + id + '" id="displayLetters-' + id + '" cols="30" rows="10" readonly="readonly"></textarea>\
					</div>\
					<div class="block man">\
						<label for="displayMan-' + id + '">' + $exe_i18n.exeGames.stat + ':</label>\
						<textarea name="displayMan-' + id + '" id="displayMan-' + id + '" cols="30" rows="10" readonly="readonly"></textarea>\
					</div>\
				</div>\
				<p>\
					<label for="displayWord-' + id + '">' + $exe_i18n.exeGames.word + ' <span id="currentWord-' + id + '"></span>:</label>\
					<input type="text" name="displayWord-' + id + '" id="displayWord-' + id + '" readonly="readonly" /> <span id="displayWord-' + id + '-feedback"></span>\
					<input type="hidden" name="won-' + id + '" id="won-' + id + '" value="0" />\
					<input type="hidden" name="lost-' + id + '" id="lost-' + id + '" value="0" />\
				</p>\
				<div id="abc-' + id + '" class="abc">';
        c += "<ul>";
        var l = letters;
        for (var i = 0; i < l.length; i++) {
            c += '<li><a href="#" onclick="hangMan.play(this,' + id + ');return false">' + l.charAt(i) + '</a></li>';
        }
        if (addCapitalLetters == true) {
            var css = ' class="first-capital-letter"';
            for (var z = 0; z < l.length; z++) {
                var current = l.charAt(z);
                var s = current.toUpperCase();
                if (s != current) {
                    c += '<li' + css + '><a href="#" onclick="hangMan.play(this,' + id + ');return false">' + s + '</a></li>';
                    css = "";
                }
            }
        }
        c += "</ul>";
        c += '</div>\
			</div>\
		</form>\
		<table summary="' + $exe_i18n.exeGames.results + '" class="iDevice-results hangMan-results" id="hangManResults' + id + '">\
			<thead>\
				<tr>\
					<th>' + $exe_i18n.exeGames.total + ' </th>\
					<th>' + $exe_i18n.exeGames.right + ' </th>\
					<th>' + $exe_i18n.exeGames.wrong + ' </th>\
				</tr>\
			</thead>\
			<tbody>\
				<tr>\
					<td id="total-' + id + '-counter">0 </td>\
					<td id="won-' + id + '-counter">0 </td>\
					<td id="lost-' + id + '-counter">0 </td>\
				</tr>\
				<tr>\
					<th>' + $exe_i18n.exeGames.words + ' </th>\
					<td id="won-' + id + '-words">-</td>\
					<td id="lost-' + id + '-words">-</td>\
				</tr>\
			</tbody>\
		</table>';
        c += "</div>";
        // Check if it's IE<9 to add a className
        var extraCSS = "";
        var t = $exe.isIE();
        if (t && t < 9) extraCSS = "ie-lt-9";
        $("#exe-hangman-" + id).addClass(extraCSS).html(c);
        hangMan.init(id, words, isCaseSensitive);
    },
    // Base64 decoder
    // https://jsfiddle.net/gabrieleromanato/qaght/
    _keyStr: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",
    decode64: function(input) {
        var output = "";
        var chr1, chr2, chr3;
        var enc1, enc2, enc3, enc4;
        var i = 0;
        input = input.replace(/[^A-Za-z0-9\+\/\=]/g, "");
        while (i < input.length) {
            enc1 = this._keyStr.indexOf(input.charAt(i++));
            enc2 = this._keyStr.indexOf(input.charAt(i++));
            enc3 = this._keyStr.indexOf(input.charAt(i++));
            enc4 = this._keyStr.indexOf(input.charAt(i++));
            chr1 = (enc1 << 2) | (enc2 >> 4);
            chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
            chr3 = ((enc3 & 3) << 6) | enc4;
            output = output + String.fromCharCode(chr1);
            if (enc3 != 64) {
                output = output + String.fromCharCode(chr2);
            }
            if (enc4 != 64) {
                output = output + String.fromCharCode(chr3);
            }
        }
        output = this._utf8_decode(output);
        return output;
    },
    _utf8_decode: function(utftext) {
        var string = "";
        var i = 0;
        var c = c1 = c2 = 0;
        while (i < utftext.length) {
            c = utftext.charCodeAt(i);
            if (c < 128) {
                string += String.fromCharCode(c);
                i++;
            } else if ((c > 191) && (c < 224)) {
                c2 = utftext.charCodeAt(i + 1);
                string += String.fromCharCode(((c & 31) << 6) | (c2 & 63));
                i += 2;
            } else {
                c2 = utftext.charCodeAt(i + 1);
                c3 = utftext.charCodeAt(i + 2);
                string += String.fromCharCode(((c & 15) << 12) | ((c2 & 63) << 6) | (c3 & 63));
                i += 3;
            }
        }
        return string;
    },
    // /Base64 decoder
    init: function(id, words, isCaseSensitive) {
        if (words.length == 0) return false;

        window["hangMan" + id] = new Object();
        window["hangMan" + id].isCaseSensitive = isCaseSensitive;
        window["hangMan" + id].words = new Array();
        window["hangMan" + id].parts = 0;

        for (z = 0; z < words.length; z++) {
            var w = words[z];
            w = this.decode64(w);
            var nW = "";
            for (x = 0; x < w.length; x++) {
                nW += w.charAt(x);
                if (x < (w.length - 1)) nW += " "
            }
            window["hangMan" + id].words.push(nW);
        }
        $("#total-" + id + "-counter").html(window["hangMan" + id].words.length);
    },
    getWord: function(id) {
        var isWordFinished = window["hangMan" + id].isWordFinished;
        if (typeof(isWordFinished) != 'undefined' && isWordFinished == false) {
            document.getElementById("lost-" + id).value++;
            this.updateResults(id);
        }
        var words = window["hangMan" + id].words;
        if (typeof(window["hangMan" + id].playedWords) == 'undefined' || window["hangMan" + id].playedWords == 0) {
            window["hangMan" + id].playedWords = 0;
            $("#start-" + id).val($exe_i18n.exeGames.otherWord);
            $("#clean-" + id).css("display", "inline");
        }
        var order = window["hangMan" + id].playedWords;
        if (order > (words.length - 1)) {
            $exeGames.message.show("exe-hangman-" + id, $exe_i18n.exeGames.gameOver);
            return false;
        }

        window["hangMan" + id].word = words[order].split(" ");
        hangMan.message(id, "", "");
        window["hangMan" + id].isWordFinished = false;

        if (order > (words.length - 2)) $("#start-" + id).hide();
        window["hangMan" + id].playedWords = order + 1;
        hangMan.showQuestion(id, order);
    },
    showQuestion: function(id, order) {
        var lis = $("#question-" + id + " li");
        lis.removeClass("current");
        $("#currentWord-" + id).html(order + 1);
        lis.eq(order).addClass("current");
    },
    start: function(id) {
        $("#hangManResults" + id).show();
        $("#hangManWrapper" + id).show();
        window["hangMan" + id].isPlaying = true
        window["hangMan" + id].parts = 0
        this.getWord(id)
        this.paintMan(0, id)
        $("#displayWord-" + id).val("");
        for (var x = 0; x < window["hangMan" + id].word.length; x++) document.getElementById("displayWord-" + id).value += "_ ";
        $("#displayLetters-" + id).val("");
    },
    paintMan: function(partes, id) {
        var dibujo = ""
        if (partes < 10)
            for (var x = 0; x < partes; x++) {
                dibujo += this.man[x]
            }
        $("#displayMan-" + id).val(dibujo);
    },
    writeLetter: function(letra, id) {
        var flag = false
        var cadena = new String($("#displayWord-" + id).val())
        var letrasCadena = cadena.split(" ")
        cadena = ""
        for (var x = 0; x < window["hangMan" + id].word.length; x++) {
            var condition = window["hangMan" + id].word[x] == letra;
            if (window["hangMan" + id].isCaseSensitive == false) condition = window["hangMan" + id].word[x].toLowerCase() == letra.toLowerCase();
            if (condition) {
                cadena += letra + " "
                flag = true
            } else {
                cadena += letrasCadena[x] + " "
            }
        }
        $("#displayWord-" + id).val(cadena);
        return flag
    },
    message: function(id, type, message) {
        var m = document.getElementById("displayWord-" + id + "-feedback");
        m.innerHTML = message;
        m.className = type;
    },
    addLetter: function(l, id) {
        document.getElementById("displayLetters-" + id).value += l + " ";
    },
    doClean: function(id) {
        var s = document.getElementById("start-" + id);
        s.value = $exe_i18n.exeGames.play;
        s.style.display = "inline";
        $("#hangManResults" + id).hide();
        $("#hangManWrapper" + id).hide();
        $("#question-" + id + " li").removeClass("current");
        document.getElementById("clean-" + id).style.display = "none";
        window["hangMan" + id].playedWords = 0;
        window["hangMan" + id].isPlaying = false;
        window["hangMan" + id].isWordFinished = null;
        document.getElementById("displayLetters-" + id).value = "";
        document.getElementById("displayMan-" + id).value = "";
        document.getElementById("total-" + id + "-counter").innerHTML = window["hangMan" + id].words.length;
        document.getElementById("won-" + id).value = 0;
        document.getElementById("lost-" + id).value = 0;
        document.getElementById("won-" + id + "-counter").innerHTML = "0 ";
        document.getElementById("lost-" + id + "-counter").innerHTML = "0 ";
        document.getElementById("won-" + id + "-words").innerHTML = "-";
        document.getElementById("lost-" + id + "-words").innerHTML = "-";
        hangMan.message(id, "", "");
    },
    clean: function(id) {
        // Confirm before cleaning
        $exeGames.message.show("exe-hangman-" + id, $exe_i18n.exeGames.confirmReload, "hangMan.doClean(" + id + ")");
    },
    play: function(e, id) {
        var letra = e.innerHTML;
        if (window["hangMan" + id].isPlaying) {
            this.addLetter(letra, id)
            var acierto = this.writeLetter(letra, id)
            if (!acierto) this.paintMan(++window["hangMan" + id].parts, id)
            if (window["hangMan" + id].parts == 9) this.finish(false, id)
            else if (this.checkWord(id))
                this.finish(true, id)
        } else {
            if (window["hangMan" + id].playedWords == 0 || typeof(window["hangMan" + id].playedWords) == 'undefined') $exeGames.message.show("exe-hangman-" + id, $exe_i18n.exeGames.clickOnPlay)
            else if (window["hangMan" + id].playedWords == window["hangMan" + id].words.length) $exeGames.message.show("exe-hangman-" + id, $exe_i18n.exeGames.gameOver);
            else $exeGames.message.show("exe-hangman-" + id, $exe_i18n.exeGames.clickOnOtherWord);
        }
    },
    checkWord: function(id) {
        var fin = true
        var cadena = new String(document.getElementById("displayWord-" + id).value)
        var letrasCadena = cadena.split(" ")
        for (var x = 0; x < letrasCadena.length; x++) {
            if (letrasCadena[x] == "_") fin = false
        }
        return fin
    },
    updateResults: function(id, text) {
        document.getElementById("won-" + id + "-counter").innerHTML = document.getElementById("won-" + id).value;
        document.getElementById("lost-" + id + "-counter").innerHTML = document.getElementById("lost-" + id).value;
    },
    finish: function(res, id) {
        var solucion = ""
        window["hangMan" + id].isPlaying = false;
        for (var x = 0; x < window["hangMan" + id].word.length; x++) solucion += window["hangMan" + id].word[x]
        if (res) {
            document.getElementById("won-" + id).value++;
            this.updateResults(id);
            var l = document.getElementById("won-" + id + "-words");
            if (l.innerHTML == '-') l.innerHTML = solucion
            else l.innerHTML += "<br />" + solucion;
            hangMan.message(id, "success", $exe_i18n.exeGames.right);
            window["hangMan" + id].isWordFinished = true;
        } else {
            document.getElementById("lost-" + id).value++;
            this.updateResults(id);
            var l = document.getElementById("lost-" + id + "-words");
            if (l.innerHTML == '-') l.innerHTML = solucion
            else l.innerHTML += "<br />" + solucion;
            hangMan.message(id, "error", "<strong>" + $exe_i18n.exeGames.wrong + ".</strong> " + $exe_i18n.exeGames.rightAnswer + ": " + solucion);
            window["hangMan" + id].isWordFinished = true;
        }
    }
}

$(function() {
    if (window.eXeLearning === undefined) $exeGames.init();
});

// Export for Node.js/CommonJS (tests)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { $exeGames, hangMan };
}