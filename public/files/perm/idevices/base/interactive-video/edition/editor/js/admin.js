/**
 * Interactive Video iDevice (edition)
 * Updated: 2025-10-18 - Fixed jwplayer dynamic loading
 *
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: Ignacio Gros (http://gros.es/) for http://exelearning.net/
 *
 * License: http://creativecommons.org/licenses/by-sa/4.0/
 */

var InteractiveVideo = {};

if (top.interactiveVideoEditor) {
    InteractiveVideo = top.interactiveVideoEditor.activityToSave;
}
var iAdmin = {
    domainPath: window.parent.eXeLearning.symfony.fullURL,
    globals: {
        mode: 'add', // add or edit
        currentSlide: '', // The order of the slide that's being edited (a number): InteractiveVideo.slides[X],
        warnWhenSave: true, // Tell the user to click on Save before quitting
    },
    changeMode: function (mode) {
        top.interactiveVideoEditor.hasChanged = true;
        if (mode == 'add') {
            $('BODY').removeClass('edition-mode');
            $('.block-submit').attr('value', $i18n.Create_Frame_Submit);
            iAdmin.globals.mode = 'add';
            // Clear all the fields
            iAdmin.resetForm();
        } else {
            $('BODY').addClass('edition-mode');
            $('.block-submit').attr('value', $i18n.Update_Frame_Submit);
            iAdmin.globals.mode = 'edit';
        }
    },
    slideTypes: {
        text: $i18n.Text,
        image: $i18n.Image,
        singleChoice: $i18n.Single_Choice,
        multipleChoice: $i18n.Multiple_Choice,
        dropdown: $i18n.Dropdown_Activity,
        cloze: $i18n.Cloze_Quiz,
        matchElements: $i18n.Pairs_Game,
        sortableList: $i18n.Scrambled_List,
    },
    slideTypesInstructions: {
        text: $i18n.Text_Instructions,
        image: $i18n.Image_Instructions,
        singleChoice: $i18n.Single_Choice_Instructions,
        multipleChoice: $i18n.Multiple_Choice_Instructions,
        dropdown: $i18n.Dropdown_Activity_Instructions,
        cloze: $i18n.Cloze_Quiz_Instructions,
        matchElements: $i18n.Pairs_Game_Instructions,
        sortableList: $i18n.Scrambled_List_Instructions,
    },
    // hh:mm:ss to seconds
    hourToSeconds: function (str) {
        var i = str.split(':');
        if (i.length == 0) {
            return 0;
        } else if (i.length == 1) {
            i = '00:00:' + i[0];
            i = i.split(':');
        } else if (i.length == 2) {
            i = '00:' + i[0] + ':' + i[1];
            i = i.split(':');
        }
        return +i[0] * 60 * 60 + +i[1] * 60 + +i[2];
    },
    video: {
        hasPlayed: false,
        getPosition: function () {
            var type = iAdmin.video.type;
            if (type == 'mediateca') {
                if (typeof jwplayer !== 'undefined') {
                    return parseInt(jwplayer().getPosition());
                }
                return 0;
            } else if (type == 'youtube') {
                try {
                    return parseInt(iAdmin.video.player.getCurrentTime());
                } catch (e) {
                    return 0;
                }
            } else {
                var video = $('#player video');
                var src = video.html();
                src = src.split('"');
                if (src.length != 3) return 0;
                src = src[1];
                var extension = src.split('.').pop().toLowerCase();
                if (extension == 'flv') {
                    return iAdmin.hourToSeconds(
                        $('#player .mejs-currenttime').eq(0).text()
                    );
                } else {
                    return parseInt(video[0].currentTime);
                }
            }
        },
        youtubeIsReady: function () {
            iAdmin.video.player = new YT.Player('player', {
                height: '356',
                width: '448',
                videoId: iAdmin.video.id,
                events: {
                    onReady: function () {
                        try {
                            iAdmin.video.duration =
                                iAdmin.video.player.getDuration();
                        } catch (e) {}
                    },
                },
            });
        },
        enable: function (url, type) {
            iAdmin.video.duration = 0;

            if (type == 'mediateca') {
                // Get the video ID: https://mediateca.educa.madrid.org/video/...
                var id = url.replace(
                    'https://mediateca.educa.madrid.org/video/',
                    ''
                );
                id = id.split('/');
                id = id[0];

                enableVideoPlayer(
                    id,
                    'http://mediateca.educa.madrid.org/imagen.php?id=' +
                        id +
                        '&type=1&m=0',
                    '356',
                    '448'
                );
            } else if (type == 'youtube') {
                function youtube_parser(url) {
                    var match = url.match(regExp);
                    var regExp =
                        /^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
                    var match = url.match(regExp);
                    if (match && match[2].length == 11) {
                        return match[2];
                    } else {
                        return false;
                    }
                }
                iAdmin.video.id = youtube_parser(url);

                $('#player').html(
                    '<video width="448" height="356" controls="controls"><source src="' +
                        url +
                        '" /></video>'
                );

                try {
                    onYouTubeIframeAPIReady = iAdmin.video.youtubeIsReady;
                    // Load the IFrame Player API code asynchronously
                    var tag = document.createElement('script');
                    tag.src = 'https://www.youtube.com/iframe_api';
                    var firstScriptTag =
                        document.getElementsByTagName('script')[0];
                    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
                } catch (e) {
                    iAdmin.appError(
                        $i18n.Code_Error +
                            ' - 003 - ' +
                            $i18n.Youtube_API_Changed
                    );
                    return;
                }
            } else if (type == 'local') {
                function hhmmssToSeconds(hms) {
                    var a = hms.split(':');
                    if (a.length == 1) {
                        a = [0, 0, a[0]];
                    } else if (a.length == 2) {
                        a = [0, a[0], a[1]];
                    } else if (a.length != 3) {
                        return 0;
                    }
                    return +a[0] * 60 * 60 + +a[1] * 60 + +a[2];
                }

                $('#player').html(
                    `<video width="448" height="356" class="mejs__player" data-mejsoptions='{"pluginPath": "${iAdmin.domainPath}/app/common/mediaelement/", "alwaysShowControls": "true"}'><source src="${iAdmin.domainPath}/${url}" /></video>`
                );
                // The player won't work if there's no delay. Why?
                setTimeout(function () {
                    $exeMediaElement.checkForMediaContent();
                    // Get duration
                    setTimeout(function () {
                        var mejsDuration = $('.mejs-duration');
                        if (mejsDuration.length == 1)
                            iAdmin.video.duration = hhmmssToSeconds(
                                mejsDuration.html()
                            );
                    }, 1000);
                }, 500);
            }
        },
    },
    mediaElement: {
        load: function () {},
    },
    orderSlides: function () {
        var sortable = [];
        for (var slide in InteractiveVideo.slides) {
            sortable.push([
                iAdmin.timeOptions.secondsToHHMMSS(
                    InteractiveVideo.slides[slide].startTime
                ),
                InteractiveVideo.slides[slide],
            ]);
        }
        sortable.sort();
        var sorted = [];
        for (var i in sortable) {
            sorted.push(sortable[i][1]);
        }
        InteractiveVideo.slides = sorted;
    },
    getBlockInstructions: function (block) {
        var autoStop = false;
        block = block.replace('#', '').replace('-block', '');
        if (block == 'text' || block == 'image') autoStop = true;
        var html = '<ol>';
        html +=
            '<li>' +
            $i18n.Start_Instructions +
            ' (<strong>' +
            $i18n.Start +
            '</strong>).</li>';
        if (autoStop) {
            html +=
                '<li>' +
                $i18n.End_Instructions +
                ' (<strong>' +
                $i18n.End +
                '</strong>).</li>';
        }
        //
        var timeInstr = $i18n.Get_Time_Instructions;
        timeInstr = timeInstr.replace(
            '%s',
            `<img src="${iAdmin.domainPath}/files/perm/idevices/base/interactive-video/edition/editor/images/timer.png" width="24" height="24" alt="` +
                $i18n.Current_Time +
                '" />'
        );
        html += '<li>' + timeInstr + '</li>';
        html += '</ol>';
        html +=
            '<h4>' +
            iAdmin.slideTypes[block] +
            '<span>(' +
            $i18n.Text.toLowerCase() +
            ')</span>:</h4>';
        html += '<p>' + iAdmin.slideTypesInstructions[block] + '</p>';
        html +=
            "<p id='close-help'><input type='button' id='close-help-input' value='" +
            $i18n.Close_Help +
            "' onclick='iAdmin.toggleHelp()' /></p>";
        return html;
    },
    toggleHelp: function () {
        var html = $('html').eq(0);
        if (html.attr('class') != 'help-visible')
            html.attr('class', 'help-visible');
        else html.attr('class', '');
    },
    timeOptions: {
        init: function (block) {
            $('#time-and-help-block').remove();
            var autoStop =
                '<p class="checkbox"><label for="auto-stop"><input type="checkbox" id="auto-stop" /> ' +
                $i18n.Stop_Video +
                '</label></p>';
            if (block != '#text-block' && block != '#image-block') {
                autoStop =
                    '<p class="checkbox disabled"><label for="auto-stop"><input type="checkbox" id="auto-stop" disabled="disabled" checked="checked" /> ' +
                    $i18n.Stop_Video +
                    '</label></p>';
            }
            var fromToBlock =
                '\
        <div id="time-and-help-block">\
          <p id="from-to-help-link"><a href="#from-to-help" title="' +
                $i18n.Toggle_Help +
                '" onclick="iAdmin.toggleHelp();return false"><em>' +
                $i18n.Help +
                '</em></a></p>\
          <div id="from-to-help">\
            ' +
                iAdmin.getBlockInstructions(block) +
                '\
          </div>\
          <div id="from-to">\
            <p id="from" class="time">\
              <strong>' +
                $i18n.Start +
                ':</strong>\
              <input type="hidden" id="from-in-seconds" value="0" />\
              <label for="from-hh" class="sr-av">' +
                $i18n.Hours +
                ':</label><input type="text" id="from-hh" maxlength="2" value="00" />:<label for="from-mm" class="sr-av">' +
                $i18n.Minutes +
                ':</label><input type="text" id="from-mm" maxlength="2" value="00" />:<label for="from-ss" class="sr-av">' +
                $i18n.Seconds +
                ':</label><input type="text" id="from-ss" maxlength="2" value="00" />\
              <a href="#" id="from-now" title="' +
                $i18n.Current_Time +
                '" class="from"><span>' +
                $i18n.Now +
                '</span></a>\
            </p>\
            ' +
                autoStop +
                '\
            <p id="to" class="time">\
              <strong>' +
                $i18n.End +
                ':</strong>\
              <input type="hidden" id="to-in-seconds" value="0" />\
              <label for="to-hh" class="sr-av">' +
                $i18n.Hours +
                ':</label><input type="text" id="to-hh" maxlength="2" value="00" />:<label for="to-mm" class="sr-av">' +
                $i18n.Minutes +
                ':</label><input type="text" id="to-mm" maxlength="2" value="00" />:<label for="to-ss" class="sr-av">' +
                $i18n.Seconds +
                ':</label><input type="text" id="to-ss" maxlength="2" value="00" />\
              <a href="#" id="to-now" title="' +
                $i18n.Current_Time +
                '" class="to"><span>' +
                $i18n.Now +
                '</span></a>\
            </p>\
          </div>\
        </div>';
            $(block + '-form').prepend(fromToBlock);

            // Help
            $('body').removeClass('help-visible');

            iAdmin.timeOptions.setDefaultValues();
        },
        setDefaultValues: function () {
            var currentSecond = iAdmin.video.getPosition();
            if (!isNaN(currentSecond)) {
                var hhmmss = iAdmin.timeOptions.secondsToHHMMSS(currentSecond);
                hhmmss = hhmmss.split(':');
                // Start and end
                $('#from-in-seconds,#to-in-seconds').val(currentSecond);
                $('#from-hh,#to-hh').val(hhmmss[0]);
                $('#from-mm,#to-mm').val(hhmmss[1]);
                $('#from-ss,#to-ss').val(hhmmss[2]);
            }
            iAdmin.timeOptions.enable();
        },
        enable: function () {
            // Time options
            $('#auto-stop')
                .prop('checked', 'checked')
                .change(function () {
                    if (this.checked) {
                        $('#to').hide();
                    } else {
                        $('#to').show();
                    }
                });
            // Auto from
            $('#from-now,#to-now').click(function () {
                iAdmin.timeOptions.setValues(this);
                return false;
            });
            $('#from-to input[type=text]').keyup(function () {
                this.value = this.value.replace(/[^0-9.]/g, '');
            });
        },
        secondsToHHMMSS: function (totalSec) {
            var hours = parseInt(totalSec / 3600) % 24;
            var minutes = parseInt(totalSec / 60) % 60;
            var seconds = totalSec % 60;
            return (
                (hours < 10 ? '0' + hours : hours) +
                ':' +
                (minutes < 10 ? '0' + minutes : minutes) +
                ':' +
                (seconds < 10 ? '0' + seconds : seconds)
            );
        },
        setValues: function (e, totalSec) {
            var type = e;
            if (typeof e != 'string') type = e.className;
            if (!totalSec) totalSec = iAdmin.video.getPosition();
            var result = iAdmin.timeOptions.secondsToHHMMSS(totalSec);
            result = result.split(':');
            $('#' + type + '-hh').val(result[0]);
            $('#' + type + '-mm').val(result[1]);
            $('#' + type + '-ss').val(result[2]);
        },
        formatValues: function (totalSec) {
            //var totalSec = new Date().getTime() / 1000;
        },
        validateRange: function () {
            // From...
            var fromHH = $('#from-hh');
            var fromMM = $('#from-mm');
            var fromSS = $('#from-ss');
            if (
                fromHH.val() == '' ||
                fromMM.val() == '' ||
                fromSS.val() == ''
            ) {
                iAdmin.msg.txt($i18n.Check_Start + ' (hh:mm:ss).');
                return false;
            }
            var fromHHval = parseInt(fromHH.val()) * 3600;
            var fromMMval = parseInt(fromMM.val()) * 60;
            var fromSSval = parseInt(fromSS.val());
            var totalSecFrom = fromHHval + fromMMval + fromSSval;
            if (totalSecFrom == 0) {
                iAdmin.msg.txt($i18n.Second_Zero_Warning);
                return false;
            }
            if (
                iAdmin.video.duration > 0 &&
                totalSecFrom > iAdmin.video.duration
            ) {
                iAdmin.msg.txt($i18n.Time_Exceed_Warning);
                return false;
            }

            // Update the hidden field
            iAdmin.timeOptions.setValues('from', totalSecFrom);
            $('#from-in-seconds').val(totalSecFrom);

            // To...
            if (!$('#auto-stop').prop('checked')) {
                var toHH = $('#to-hh');
                var toMM = $('#to-mm');
                var toSS = $('#to-ss');
                if (toHH.val() == '' || toMM.val() == '' || toSS.val() == '') {
                    iAdmin.msg.txt($i18n.Check_End + ' (hh:mm:ss)');
                    return false;
                }
                var toHHval = parseInt(toHH.val()) * 3600;
                var toMMval = parseInt(toMM.val()) * 60;
                var toSSval = parseInt(toSS.val());
                var totalSecTo = toHHval + toMMval + toSSval;
                if (
                    iAdmin.video.duration > 0 &&
                    totalSecTo > iAdmin.video.duration
                ) {
                    iAdmin.msg.txt($i18n.Time_Exceed_Warning);
                    return false;
                }
                if (totalSecTo <= totalSecFrom) {
                    iAdmin.msg.txt($i18n.Time_Mismatch);
                    return false;
                }

                // Update the hidden field
                iAdmin.timeOptions.setValues('to', totalSecTo);
                $('#to-in-seconds').val(totalSecTo);
            }

            return true;
        },
    },
    template: function (templateid, data) {
        return document
            .getElementById(templateid)
            .innerHTML.replace(/%(\w*)%/g, function (m, key) {
                return data.hasOwnProperty(key)
                    ? data[key]
                    : key.replace(/_/g, ' ');
            });
    },
    i18n: function () {
        // document.title = $i18n.Style_Designer;
        document.getElementById('site').innerHTML = this.template(
            'site',
            $i18n
        );
    },
    appMsg: function (msg) {
        iAdmin.msg.txt(msg);
        // top.eXe.app.alert(msg);
    },
    appError: function (msg) {
        alert(msg);
        // this.appMsg(msg);
        // top.interactiveVideoEditor.win.closeMe = true;
        // top.interactiveVideoEditor.win.close();
        // top.interactiveVideoEditor.win.closeMe = false;
        top.$exeDevice.editor.close();
    },
    init: function () {
        let initAdminInterval = setInterval(() => {
            if (!$i18n) {
                // console.log("no encuentra i18n");
            }
            if ($i18n) {
                clearInterval(initAdminInterval);
                // Missing type or URL
                if (
                    !top ||
                    !top.interactiveVideoEditor ||
                    !top.interactiveVideoEditor.videoType ||
                    !top.interactiveVideoEditor.videoURL ||
                    !top.interactiveVideoEditor.imageList
                ) {
                    this.appError($i18n.Code_Error + ' - 002');
                    return;
                }

                this.video.type = top.interactiveVideoEditor.videoType;
                this.video.url = top.interactiveVideoEditor.videoURL;

                // Check if the type and the URL match
                if (this.video.type == 'local') {
                    this.video.url = parent.document.getElementById(
                        'interactiveVideoFile'
                    ).value;
                    // Accept both legacy files/tmp paths and new asset:// URLs
                    if (
                        this.video.url.indexOf('files/tmp') != 0 &&
                        this.video.url.indexOf('asset://') != 0
                    ) {
                        this.appError(
                            $i18n.Type +
                                ': ' +
                                $i18n.Local_File +
                                ' - ' +
                                $i18n.Invalid_URL
                        );
                        return;
                    }
                } else if (this.video.type == 'mediateca') {
                    if (
                        this.video.url.indexOf(
                            'https://mediateca.educa.madrid.org/'
                        ) != 0
                    ) {
                        this.appError(
                            $i18n.Type + ': Mediateca - ' + $i18n.Invalid_URL
                        );
                        return;
                    }
                } else if (this.video.type == 'youtube') {
                    if (
                        this.video.url.indexOf('https://www.youtube.com/') != 0
                    ) {
                        this.appError(
                            $i18n.Type + ': Youtube - ' + $i18n.Invalid_URL
                        );
                        return;
                    }
                }

                // Enable the player
                this.video.enable(this.video.url, this.video.type);

                // Translate the app
                this.i18n();

                this.timeOptions.init('#text-block');

                this.getPreviousValues();

                this.tabs.init('image');
                this.tabs.init('singleChoice');
                this.tabs.init('multipleChoice');
                this.tabs.init('dropdown');
                this.tabs.init('matchElements');
                this.tabs.init('sortableList');

                // Main menu
                this.tip = $('#controls-tip');
                this.tipCurrentTitle = '';
                this.controls = $('#controls a');
                this.controls
                    .hover(
                        function () {
                            var t = this.title;
                            iAdmin.tipTitle = t;
                            this.title = '';
                            iAdmin.tip.html(t);
                        },
                        function () {
                            iAdmin.tip.html(iAdmin.tipCurrentTitle);
                            this.title = iAdmin.tipTitle;
                        }
                    )
                    .focus(function () {
                        var t = this.title;
                        if (t != '') iAdmin.tipTitle = t;
                        this.title = '';
                        iAdmin.tip.html(iAdmin.tipTitle);
                    })
                    .blur(function () {
                        iAdmin.tip.html(iAdmin.tipCurrentTitle);
                        this.title = iAdmin.tipTitle;
                    })
                    .click(function () {
                        top.interactiveVideoEditor.hasChanged = true;
                        var e = $(this);

                        iAdmin.controls.removeClass('current');
                        e.addClass('current');
                        $('.admin-block').hide();

                        iAdmin.tipCurrentTitle = iAdmin.tipTitle;
                        var href = e.attr('href');
                        if (href == '#add-block') {
                            // Change the mode
                            iAdmin.changeMode('add');
                            iAdmin.timeOptions.setValues('from');
                            iAdmin.timeOptions.setValues('to');
                        }

                        $(href).fadeIn();
                        return false;
                    });

                // Top menu
                this.topTip = $('#actions-desc');
                $('#actions a')
                    .hover(
                        function () {
                            var t = this.title;
                            iAdmin.topTipTitle = t;
                            this.title = '';
                            iAdmin.topTip.html(t);
                        },
                        function () {
                            iAdmin.topTip.html('');
                            this.title = iAdmin.topTipTitle;
                        }
                    )
                    .focus(function () {
                        var t = this.title;
                        if (t != '') iAdmin.topTipTitle = t;
                        this.title = '';
                        iAdmin.topTip.html(iAdmin.topTipTitle);
                    })
                    .blur(function () {
                        iAdmin.topTip.html('');
                        this.title = iAdmin.topTipTitle;
                    })
                    .click(function () {
                        iAdmin.topTip.html('');
                    });

                // Add type menu
                this.typeTip = $('#block-type-description');
                this.typeControls = $('#block-types a');
                this.typeCurrentTitle = 'Texto';
                this.typeControls
                    .hover(
                        function () {
                            if ($('BODY').hasClass('edition-mode'))
                                return false;
                            var t = this.title;
                            iAdmin.typeTipTitle = t;
                            this.title = '';
                            iAdmin.typeTip.html($(this).text());
                        },
                        function () {
                            if ($('BODY').hasClass('edition-mode'))
                                return false;
                            iAdmin.typeTip.html(iAdmin.typeCurrentTitle);
                            this.title = iAdmin.typeTipTitle;
                        }
                    )
                    .focus(function () {
                        if ($('BODY').hasClass('edition-mode')) return false;
                        var t = this.title;
                        if (t != '') iAdmin.typeTipTitle = t;
                        this.title = '';
                        iAdmin.typeTip.html($(this).text());
                    })
                    .blur(function () {
                        if ($('BODY').hasClass('edition-mode')) return false;
                        iAdmin.typeTip.html(iAdmin.typeCurrentTitle);
                        this.title = iAdmin.typeTipTitle;
                    })
                    .click(function () {
                        top.interactiveVideoEditor.hasChanged = true;
                        if ($('BODY').hasClass('edition-mode')) return false;

                        iAdmin.resetForm();

                        iAdmin.typeTip.html($(this).text());
                        var e = $(this);
                        iAdmin.typeControls.removeClass('current');
                        e.addClass('current');
                        $('.block-type').hide();
                        var id = e.attr('href');
                        var c = $(id);
                        iAdmin.timeOptions.init(id);
                        c.fadeIn();
                        iAdmin.typeCurrentTitle = $('h3', c).html();
                        return false;
                    });

                // Cover options
                $("input[name='frontpage-type']").change(function () {
                    var v = this.value;
                    if (v == 'default') {
                        $('#frontpage-type-2-opts').hide();
                        $('#frontpage-type-1-opts').show();
                    } else {
                        $('#frontpage-type-1-opts').hide();
                        $('#frontpage-type-2-opts').show();
                    }
                });

                try {
                    document.createEvent('TouchEvent');
                    $('BODY').addClass('is-mobile');
                } catch (e) {}

                this.editors.init();
                this.msg.init();

                // Save buttons

                // Front page
                $('#frontpage-submit').click(function () {
                    iAdmin.save('cover');
                });
                $('#frontpage-form').submit(function () {
                    iAdmin.save('cover');
                    return false;
                });

                // Frames
                $('.block-submit').click(function () {
                    iAdmin.save(this.id.replace('-block-submit', ''));
                });
                $('.block-form').submit(function () {
                    iAdmin.save(this.id.replace('-block-form', ''));
                    return false;
                });
            }
        }, 50);

        setTimeout(() => {
            if (initAdminInterval) {
                clearInterval(initAdminInterval);
            }
        }, 3000);
    },
    resetForm: function () {
        // Hide all the success messages and show the hidden forms
        $('.hidden-block').removeClass();
        $('.success-msg').html('');
        // Clear all the fields
        tinyMCE.get('text-block-content').setContent('');
        iAdmin.tabs.restart('image', false);
        iAdmin.tabs.restart('singleChoice', false);
        iAdmin.tabs.restart('multipleChoice', false);
        iAdmin.tabs.restart('dropdown', false);
        tinyMCE.get('cloze-question').setContent('');
        iAdmin.tabs.restart('matchElements', false);
        iAdmin.tabs.restart('sortableList', false);
    },
    getPreviousValues: function () {
        if (InteractiveVideo !== null) {
            var i = InteractiveVideo;
            $('#frontpage-title').val(i.title);
            if (i.description) $('#frontpage-content').val(i.description);
            if (i['coverType']) {
                var type = i['coverType'];
                if (type == 'poster') {
                    if (
                        typeof top.interactiveVideoEditor.activityToSave ==
                        'object'
                    ) {
                        var activity =
                            top.interactiveVideoEditor.activityToSave;
                        if (typeof activity.poster == 'string') {
                            var poster = activity.poster;
                            if (poster != '') {
                                var alt = '';
                                if (
                                    typeof activity.posterDescription ==
                                    'string'
                                ) {
                                    alt = activity.posterDescription;
                                }
                                if (poster.indexOf('resources/') == 0) {
                                    var base = top.window.location.href;
                                    base = base.split('?');
                                    base = base[0];
                                    base = base.split('#');
                                    base = base[0];
                                    if (base.charAt(base.length - 1) != '/')
                                        base += '/';
                                    poster = poster.replace(
                                        'resources/',
                                        base + 'resources/'
                                    );
                                }
                                $('#frontpage-type-2').prop(
                                    'checked',
                                    'checked'
                                );
                                $('#frontpage-type-1-opts').hide();
                                $('#frontpage-type-2-opts').show();
                                $('#frontpage-content-alt').val(
                                    '<img src="' +
                                        poster +
                                        '" alt="' +
                                        alt +
                                        '" />'
                                );
                            }
                        }
                    }
                }
            }
            if (i.slides) {
                iAdmin.updateFramesList(i.slides);
            }
        }
    },
    save: function (type) {
        // Cover
        if (type == 'cover') {
            var projectTitle = $('#frontpage-title').val();
            if (projectTitle == '') {
                iAdmin.msg.txt($i18n.No_Title);
                return false;
            }
            InteractiveVideo['title'] = projectTitle;
            InteractiveVideo['description'] = tinyMCE
                .get('frontpage-content')
                .save();
            InteractiveVideo['coverType'] = 'text';

            // Image type cover
            var coverType = $("input[name='frontpage-type']:checked").val();
            if (coverType == 'image') {
                // Image cover
                var coverImage = tinyMCE.get('frontpage-content-alt').save();
                // Check if it's a valid URL
                if (coverImage == '') {
                    iAdmin.msg.txt($i18n.No_Image);
                    return false;
                }

                var tmp = $('<div></div>');
                tmp.html(coverImage);
                var imgs = $('img', tmp);
                if (imgs.length == 0) {
                    iAdmin.msg.txt($i18n.No_Image);
                    return false;
                }
                imgs = imgs.eq(0);
                var url = imgs.attr('src');

                if (url == '') {
                    iAdmin.msg.txt($i18n.No_Image);
                    return false;
                }

                // Check the alt text
                var alt = imgs.attr('alt');
                if (alt == '') {
                    iAdmin.msg.txt($i18n.No_Alt);
                    return false;
                }

                // Remove absolute path (local file in "resources")
                var base = top.window.location.href;
                base = base.split('?');
                base = base[0];
                base = base.split('#');
                base = base[0];
                if (base.charAt(base.length - 1) != '/') base += '/';
                base += 'resources/';
                url = url.replace(base, 'resources/');

                // Save the data
                InteractiveVideo['poster'] = url;
                InteractiveVideo['posterDescription'] = alt;
                InteractiveVideo['coverType'] = 'poster';
            }

            $('#frontpage-form').hide().delay(1500).fadeIn();
            $('#frontpage-form-msg')
                .html('<p>' + $i18n.Cover_Updated + '</p>')
                .show()
                .delay(1000)
                .fadeOut();
            return false;
        }

        if (!iAdmin.timeOptions.validateRange()) return false;

        // Create the slides if needed
        if (!InteractiveVideo.slides) InteractiveVideo.slides = [];

        // Get the slide that's being edited (its number)
        if (iAdmin.globals.mode == 'edit') {
            var order = iAdmin.globals.currentSlide;
            var slide = InteractiveVideo.slides[order];
        }

        // Get the start and end time
        var startTime = parseInt($('#from-in-seconds').val());
        var toInSeconds = parseInt($('#to-in-seconds').val());

        // Save text
        if (type == 'text') {
            var txt = tinyMCE.get('text-block-content').save();
            if (txt == '') {
                iAdmin.msg.txt($i18n.No_Text);
                return false;
            }

            // Add mode
            if (iAdmin.globals.mode == 'add') {
                var newText = {
                    type: 'text',
                    text: txt,
                    startTime: startTime,
                };
                if (!$('#auto-stop').prop('checked')) {
                    newText.endTime = toInSeconds;
                }
                // Add the new slide
                InteractiveVideo.slides.push(newText);

                // Edit mode
            } else {
                slide.startTime = startTime;
                slide.text = txt;
                if (!$('#auto-stop').prop('checked')) {
                    slide.endTime = toInSeconds;
                }
            }
        } // /save -> Text

        // Save image
        else if (type == 'image') {
            // Check if it's a valid URL
            var txt = tinyMCE.get('image-block-content').save();
            if (txt == '') {
                iAdmin.msg.txt($i18n.No_Image);
                return false;
            }

            var tmp = $('<div></div>');
            tmp.html(txt);
            var imgs = $('img', tmp);
            if (imgs.length == 0) {
                iAdmin.msg.txt($i18n.No_Image_Error);
                return false;
            }
            imgs = imgs.eq(0);
            var url = imgs.attr('src');

            if (url == '') {
                iAdmin.msg.txt($i18n.No_Image_Error);
                return false;
            }

            // Check the alt text
            // var alt = $("#image-alt").val();
            var alt = imgs.attr('alt');
            if (alt == '') {
                iAdmin.msg.txt($i18n.No_Alt);
                return false;
            }

            // Add mode
            if (iAdmin.globals.mode == 'add') {
                var newImage = {
                    type: 'image',
                    url: url,
                    description: alt,
                    startTime: startTime,
                };
                if (!$('#auto-stop').prop('checked')) {
                    newImage.endTime = toInSeconds;
                }
                // Add the new slide
                InteractiveVideo.slides.push(newImage);

                // Edit mode
            } else {
                slide.startTime = startTime;
                slide.url = url;
                slide.description = alt;
                if (!$('#auto-stop').prop('checked')) {
                    slide.endTime = toInSeconds;
                }
            }
        } // /save -> Image

        // Save single choice or multiple choice
        else if (type == 'singleChoice' || type == 'multipleChoice') {
            // Check the question
            var question = tinyMCE.get(type + '-question').save();
            if (question == '') {
                iAdmin.msg.txt($i18n.No_Question);
                return false;
            }

            // Check the answers
            var answers = [];
            var oneIsRight = false;
            for (var i = 0; i < 6; i++) {
                var answer = $('#' + type + '-answer-' + (i + 1)).val();
                if (answer != '') {
                    var isRight = $(
                        '#' + type + '-answer-' + (i + 1) + '-right'
                    ).prop('checked');
                    if (isRight) {
                        oneIsRight = true;
                        isRight = 1;
                    } else {
                        isRight = 0;
                    }
                    answers.push([answer, isRight]);
                }
            }
            if (answers.length < 2) {
                iAdmin.msg.txt($i18n.At_Least_2_Answers);
                return false;
            }
            if (!oneIsRight) {
                iAdmin.msg.txt($i18n.No_Right_Answer);
                return false;
            }

            // Add mode
            if (iAdmin.globals.mode == 'add') {
                var newSlide = {
                    type: type,
                    question: question,
                    answers: answers,
                    startTime: startTime,
                };
                // Add the new slide
                InteractiveVideo.slides.push(newSlide);

                // Edit mode
            } else {
                slide.startTime = startTime;
                slide.question = question;
                slide.answers = answers;
            }
        } // /save -> Single choice or multiple choice

        // Save dropdown activity
        else if (type == 'dropdown') {
            // Check the text
            var txt = tinyMCE.get('dropdown-question').save();
            if (txt == '') {
                iAdmin.msg.txt($i18n.No_Text);
                return false;
            }
            // Check if it has words to guess
            if (txt.indexOf(': line-through') == -1) {
                iAdmin.msg.txt($i18n.No_ST_Words);
                return false;
            }

            // Additional options
            var answers = [];
            for (var i = 0; i < 6; i++) {
                var answer = $('#dropdown-answer-' + (i + 1)).val();
                if (answer != '') {
                    answers.push(answer);
                }
            }

            // Add mode
            if (iAdmin.globals.mode == 'add') {
                var newDropdown = {
                    type: 'dropdown',
                    text: txt,
                    startTime: startTime,
                };
                // Add the additional words (if needed)
                if (answers.length > 0) {
                    newDropdown.additionalWords = answers;
                }
                // Add the new slide
                InteractiveVideo.slides.push(newDropdown);

                // Edit mode
            } else {
                slide.startTime = startTime;
                slide.text = txt;
                if (answers.length > 0) {
                    slide.additionalWords = answers;
                } else {
                    // Remove slide.additionalWords if needed
                    // We can't just use slide.additionalWords = null;
                    delete slide.additionalWords;
                }
            }
        } // /save -> Dropdown activity

        // Save cloze activity
        else if (type == 'cloze') {
            // Check the text
            var txt = tinyMCE.get('cloze-question').save();
            if (txt == '') {
                iAdmin.msg.txt($i18n.No_Text);
                return false;
            }
            // Check if it has words to guess
            if (txt.indexOf(': line-through') == -1) {
                iAdmin.msg.txt($i18n.No_ST_Words);
                return false;
            }

            // Add mode
            if (iAdmin.globals.mode == 'add') {
                var newDropdown = {
                    type: 'cloze',
                    text: txt,
                    startTime: startTime,
                };
                // Add the new slide
                InteractiveVideo.slides.push(newDropdown);

                // Edit mode
            } else {
                slide.startTime = startTime;
                slide.text = txt;
            }
        } // /save -> Cloze activity

        // Save match elements activity
        else if (type == 'matchElements') {
            // Check the text
            var txt = tinyMCE.get('matchElements-question').save();
            if (txt == '') {
                iAdmin.msg.txt($i18n.No_Introduction);
                return false;
            }

            // Check the answers
            var answers = [];
            for (var i = 0; i < 6; i++) {
                var answerA = $('#' + type + '-answer-' + (i + 1) + 'A').val();
                var answerB = $('#' + type + '-answer-' + (i + 1) + 'B').val();
                if (answerA != '' && answerB != '') {
                    answers.push([answerA, answerB]);
                }
            }
            if (answers.length < 2) {
                iAdmin.msg.txt($i18n.At_Least_2_Pairs);
                return false;
            }

            // Add mode
            if (iAdmin.globals.mode == 'add') {
                var newMathActivity = {
                    type: 'matchElements',
                    text: txt,
                    startTime: startTime,
                    pairs: answers,
                };
                // Add the new slide
                InteractiveVideo.slides.push(newMathActivity);

                // Edit mode
            } else {
                slide.startTime = startTime;
                slide.text = txt;
                slide.pairs = answers;
            }
        } // /save -> Match elements activity

        // Save sortable list
        else if (type == 'sortableList') {
            // Check the text
            var txt = tinyMCE.get('sortableList-question').save();
            if (txt == '') {
                iAdmin.msg.txt($i18n.No_Introduction);
                return false;
            }

            // Check the answers
            var answers = [];
            for (var i = 0; i < 6; i++) {
                var answer = $('#' + type + '-answer-' + (i + 1)).val();
                if (answer != '') {
                    answers.push(answer);
                }
            }
            if (answers.length < 2) {
                iAdmin.msg.txt($i18n.At_Least_2_Elements);
                return false;
            }

            // Add mode
            if (iAdmin.globals.mode == 'add') {
                var newSortableList = {
                    type: 'sortableList',
                    text: txt,
                    startTime: startTime,
                    items: answers,
                };
                // Add the new slide
                InteractiveVideo.slides.push(newSortableList);

                // Edit mode
            } else {
                slide.startTime = startTime;
                slide.text = txt;
                slide.items = answers;
            }
        } // /save -> Sortable list

        // Put the slides in the right order
        iAdmin.orderSlides();

        // Update the list ("Editar un fotograma")
        iAdmin.updateFramesList(InteractiveVideo.slides);

        // Show the success message
        iAdmin.slide.success(type);

        // Warn the user (just once)
        if (iAdmin.globals.warnWhenSave) {
            iAdmin.msg.txt(
                '<p><strong>' +
                    $i18n.Important +
                    ':</strong></p><p>' +
                    $i18n.Click_On_Save_Warning +
                    `</p><p><img src="${iAdmin.domainPath}/files/perm/idevices/base/interactive-video/edition/editor/images/help/save_warning.png" width="48" height="48" alt="` +
                    $i18n.Save +
                    '" /></p><p><a href="#" onclick="iAdmin.globals.warnWhenSave=false;iAdmin.msg.hide();return false">' +
                    $i18n.Hide_Warning +
                    '</a></p>'
            );
        }
    }, // /save

    updateFramesList: function (slides, action) {
        var html = '<p>' + $i18n.You_should_create_a_Frame_first + '</p>';
        if (action == 'delete')
            html = '<p>' + $i18n.All_Frames_Deleted + '</p>';
        var l = slides.length;
        if (l > 0) {
            html =
                '\
        <table>\
          <thead>\
            <tr>\
              <th>' +
                $i18n.Type +
                ' </th>\
              <th>' +
                $i18n.Num +
                ' </th>\
              <th>' +
                $i18n.Start +
                ' </th>\
              <th>' +
                $i18n.End +
                ' </th>\
              <th>' +
                $i18n.Actions +
                ' </th>\
            </tr>\
          </thead>\
          <tbody>';
            for (var i = 0; i < l; i++) {
                var klass = 'even';
                if (i % 2 == 0) klass = 'odd';
                var type = iAdmin.slideTypes[slides[i].type];
                var start = slides[i].startTime;
                var startHHMMSS = iAdmin.timeOptions.secondsToHHMMSS(start);
                var end = slides[i].endTime || '-';
                if (end != '-') {
                    end =
                        '<a href="#" onclick="jwplayer().seek(' +
                        end +
                        ');return false">' +
                        iAdmin.timeOptions.secondsToHHMMSS(end) +
                        '</a>';
                }
                html +=
                    '\
              <tr class="' +
                    klass +
                    '" id="slide-' +
                    i +
                    '">\
                <td class="' +
                    slides[i].type +
                    '">' +
                    type +
                    ' </td>\
                <td>' +
                    (i + 1) +
                    ' </td>\
                <td><a href="#" onclick="jwplayer().seek(' +
                    start +
                    ');return false">' +
                    startHHMMSS +
                    '</a> </td>\
                <td>' +
                    end +
                    ' </td>\
                <td>\
                  <ul>\
                    <li class="edit"><a href="#" title="' +
                    $i18n.Edit +
                    '" onclick="iAdmin.slide.edit(' +
                    i +
                    ');return false"><span>' +
                    $i18n.Edit +
                    '</span></a></li>\
                    <li class="delete"><a href="#" title="' +
                    $i18n.Delete +
                    '" onclick="iAdmin.slide.del(' +
                    i +
                    ",'" +
                    startHHMMSS +
                    '\');return false"><span>' +
                    $i18n.Delete +
                    '</span></a></li>\
                  </ul>\
                </td>\
              </tr>\
            ';
            }
            html +=
                '\
          </tbody>\
        </table>';
        }
        $('#edit-block').html(html);
    },
    slide: {
        del: function (order, startHHMMSS) {
            var msg = $i18n.Delete_Slide_X;
            msg = msg.replace('%s', '<strong>' + startHHMMSS + '</strong>');
            iAdmin.msg.ask(msg, function () {
                iAdmin.msg.hide();
                $('#slide-' + order).fadeOut('slow', function () {
                    InteractiveVideo.slides.splice(order, 1);
                    $(this).remove();
                    iAdmin.updateFramesList(InteractiveVideo.slides, 'delete');
                });
            });
        },
        goTo: function (action) {
            if (action == 'list')
                $("#controls a[href='#edit-block']").trigger('click');
            else if (action == 'new')
                $("#controls a[href='#add-block']").trigger('click');
        },
        success: function (type) {
            $('#' + type + '-block-form').addClass('hidden-block');
            var links =
                " <a href='#' onclick='iAdmin.slide.goTo(\"list\");return false'>" +
                $i18n.Slides_List +
                '</a>';
            links +=
                " <a href='#' onclick='iAdmin.slide.goTo(\"new\");return false'>" +
                $i18n.New_Slide +
                '</a>';
            var msg = '<strong>' + $i18n.Frame_Created + '</strong>';
            if (iAdmin.globals.mode == 'edit')
                msg = '<strong>' + $i18n.Changes_Saved + '</strong>';
            $('#' + type + '-block-msg')
                .hide()
                .html('<p>' + msg + links + '</p>')
                .fadeIn();
        },
        edit: function (order) {
            // Change the mode
            iAdmin.changeMode('edit');

            // Reset the form
            iAdmin.resetForm();

            // Get the slide, type, etc.
            var slide = InteractiveVideo.slides[order];
            var type = slide.type;

            // Add the time options to the right form
            iAdmin.timeOptions.init('#' + type + '-block');

            // Save the current slide in globals
            iAdmin.globals.currentSlide = order;

            // Hide the table and show the right form
            // Form
            $('.block-type').hide();
            $('#' + type + '-block').show();
            // Tab
            $('#edit-block').hide();
            $('#block-types a').each(function () {
                var e = $(this);
                if (e.attr('href') == '#' + type + '-block') {
                    e.addClass('current');
                    iAdmin.typeTip.html(e.text());
                } else {
                    e.removeClass('current');
                }
            });
            // Show the block
            $('#add-block').fadeIn();

            // Load the values to edit

            // Start time
            var start = slide.startTime;
            $('#from-in-seconds').val(start);
            // hh:mm:ss
            var startInHHMMSS = iAdmin.timeOptions.secondsToHHMMSS(start);
            startInHHMMSS = startInHHMMSS.split(':');
            $('#from-hh').val(startInHHMMSS[0]);
            $('#from-mm').val(startInHHMMSS[1]);
            $('#from-ss').val(startInHHMMSS[2]);

            // Start time
            var autoStop = $('#auto-stop');
            var to = $('#to');
            var toHH = $('#to-hh');
            var toMM = $('#to-mm');
            var toSS = $('#to-ss');
            var toInSeconds = $('#to-in-seconds');

            // Default values (hidden and 00:00:00)
            autoStop.prop('checked', 'checked');
            to.hide();
            toMM.val('00');
            toMM.val('00');
            toMM.val('00');
            toInSeconds.val(0);

            // It the slide has end time
            if (slide.endTime) {
                autoStop.prop('checked', false);
                to.show();
                toInSeconds.val(slide.endTime);
                var endInHHMMSS = iAdmin.timeOptions.secondsToHHMMSS(
                    slide.endTime
                );
                endInHHMMSS = endInHHMMSS.split(':');
                $('#to-hh').val(endInHHMMSS[0]);
                $('#to-mm').val(endInHHMMSS[1]);
                $('#to-ss').val(endInHHMMSS[2]);
            }

            var end = slide.endTime;
            $('#from-in-seconds').val(start);
            // hh:mm:ss
            var startInHHMMSS = iAdmin.timeOptions.secondsToHHMMSS(start);
            startInHHMMSS = startInHHMMSS.split(':');
            $('#from-hh').val(startInHHMMSS[0]);
            $('#from-mm').val(startInHHMMSS[1]);
            $('#from-ss').val(startInHHMMSS[2]);

            // Edit text
            if (type == 'text') {
                tinyMCE.get('text-block-content').setContent(slide.text);
            }

            // Edit image
            else if (type == 'image') {
                var imgsList = top.interactiveVideoEditor.imageList;
                var src = '';
                if (order == slide.url) {
                    // var img = $("#exe-interactive-video-img-" + order);
                    var img = null;
                    [...imgsList].every((imgL) => {
                        if (imgL.id === 'exe-interactive-video-img-' + order) {
                            img = imgL;
                            return false;
                        }
                        return true;
                    });

                    // if (img.length == 1) {
                    // src = img.attr("src");
                    if (img) {
                        src = img.src;
                    }
                    // for (var i = 0; i < imgs.length; i++) {
                    // 	var img = $(imgs[i]);
                    // 	if (img.attr("id") == "exe-interactive-video-img-" + order) {
                    // 		src = img.attr("src");
                    // 	}
                    // }
                }
                if (
                    src == '' &&
                    typeof slide.url == 'string' &&
                    slide.url != ''
                ) {
                    src = slide.url;
                }
                if (src != '') {
                    var isLocal = true;
                    var topLocation = top.window.location;
                    var urlToCheck =
                        topLocation.protocol + '//' + topLocation.host + '/';
                    if (
                        src.indexOf('http') == 0 &&
                        src.indexOf(urlToCheck) != 0
                    )
                        isLocal = false;
                    // Add the base path if the image is already in "resources" (only local files)
                    // if (isLocal && src.indexOf("/previews/") != 0) src = top.window.location.href + "/" + src;
                    // if (isLocal && src.indexOf("files/tmp/") != 0) src = top.window.location.href + "/" + src;
                    tinyMCE
                        .get('image-block-content')
                        .setContent(
                            '<p><img src="' +
                                src +
                                '" alt="' +
                                slide.description +
                                '" /></p>'
                        );
                }
            }

            // Edit single choice or multiple choice
            else if (type == 'singleChoice' || type == 'multipleChoice') {
                // Question
                tinyMCE.get(type + '-question').setContent(slide.question);
                // Answer
                var answers = slide.answers;
                for (var i = 0; i < answers.length; i++) {
                    $('#' + type + '-answer-' + (i + 1)).val(answers[i][0]);
                    var field = $('#' + type + '-answer-' + (i + 1) + '-right');
                    if (answers[i][1] == 1) field.prop('checked', 'checked');
                    else if (type == 'multipleChoice')
                        field.prop('checked', false);
                }
            }

            // Edit dropdown activity
            else if (type == 'dropdown') {
                // Text
                tinyMCE.get('dropdown-question').setContent(slide.text);
                // Additional options
                var moreWords = slide.additionalWords;
                for (var i = 0; i < moreWords.length; i++) {
                    $('#dropdown-answer-' + (i + 1)).val(moreWords[i]);
                }
            }

            // Edit cloze activity
            else if (type == 'cloze') {
                // Text
                tinyMCE.get('cloze-question').setContent(slide.text);
            }

            // Edit match elements activity
            else if (type == 'matchElements') {
                // Text
                tinyMCE.get('matchElements-question').setContent(slide.text);
                // Pairs
                var pairs = slide.pairs;
                for (var i = 0; i < pairs.length; i++) {
                    var pair = pairs[i];
                    $('#matchElements-answer-' + (i + 1) + 'A').val(pair[0]);
                    $('#matchElements-answer-' + (i + 1) + 'B').val(pair[1]);
                }
            }

            // Edit sortable list
            else if (type == 'sortableList') {
                // Text
                tinyMCE.get('sortableList-question').setContent(slide.text);
                // Items
                var items = slide.items;
                for (var i = 0; i < items.length; i++) {
                    $('#sortableList-answer-' + (i + 1)).val(items[i]);
                }
            }
        },
    },
    msg: {
        init: function () {
            iAdmin.message = $('#messages');
            iAdmin.messageLink = $('#messages-link');
            iAdmin.content = $('#content');
        },
        txt: function (txt, showButton) {
            var tag = 'p';
            if (txt.indexOf('<p>') == 0) tag = 'div';
            txt = '<' + tag + ' class="txt">' + txt + '</' + tag + '>';
            iAdmin.content.hide();
            var exitButton =
                '<p class="buttons"><input type="button" id="msg-accept" value="' +
                $i18n.Accept +
                '" onclick="iAdmin.msg.hide()" /></p>';
            if (showButton == false) exitButton = '';
            iAdmin.message.html(txt + exitButton).show();
            iAdmin.messageLink.focus();
        },
        ask: function (txt, fn) {
            iAdmin.msg.fn = fn;
            iAdmin.content.hide();
            iAdmin.message
                .html(
                    '<p class="txt">' +
                        txt +
                        '</p><p class="buttons"><input type="button" id="msg-deny" value="' +
                        $i18n.Cancel +
                        '" onclick="iAdmin.msg.hide()" /> <input type="button" id="msg-accept" value="OK" onclick="iAdmin.msg.go()" /></p>'
                )
                .show();
            iAdmin.messageLink.focus();
        },
        promt: function (txt, fn) {
            iAdmin.msg.fn = fn;
            iAdmin.content.hide();
            iAdmin.message
                .html(
                    '<p class="txt"><label for="msg-promt">' +
                        txt +
                        '</label></p><p><input type="text" id="msg-promt" /></p><p class="buttons"><input type="button" id="msg-deny" value="' +
                        $i18n.Cancel +
                        '" onclick="iAdmin.msg.hide()" /> <input type="button" id="msg-accept" value="OK" onclick="iAdmin.msg.go()" /></p>'
                )
                .show();
            // $("#msg-promt").focus();
            iAdmin.messageLink.focus();
        },
        hide: function () {
            iAdmin.message.html('').hide();
            iAdmin.content.show();
        },
        go: function () {
            iAdmin.msg.fn();
        },
    },
    showFrontPage: function () {
        var e = $('#frontpage-link');
        this.controls.removeClass('current');
        e.addClass('current');
        $('.admin-block').hide();
        this.tipCurrentTitle = e.attr('title');
        this.tip.html(this.tipCurrentTitle);
        this.msg.hide();
        $('#frontpage-block').fadeIn();
    },
    actions: {
        save: function () {
            var slides = InteractiveVideo.slides;
            // Remove all unnecessary values (results, etc.) added by the preview.
            for (var i = 0; i < slides.length; i++) {
                delete slides[i].current;
                delete slides[i].results;
            }
            top.interactiveVideoEditor.activityToSave = InteractiveVideo;
            iAdmin.appMsg($i18n.Saved + ' ' + $i18n.Click_On_Exit);
            top.interactiveVideoEditor.hasChanged = false;
        },
        exit: function () {
            // To do now top.interactiveVideoEditor.win.close();
            if (confirm($i18n.Confirm_Exit)) {
                top.$exeDevice.editor.close();
            }
        },
    },
    tabs: {
        init: function (block) {
            $('#' + block + '-tabs a').click(function () {
                iAdmin.tabs.show(this, block);
                return false;
            });
        },
        show: function (lnk, block) {
            // Show the selected tab
            $('#' + block + '-tabs a').removeClass('current');
            $(lnk).addClass('current');
            $('.' + block + '-tab-content').hide();
            var href = $(lnk).attr('href');
            $(href).fadeIn();
        },
        restart: function (block, showTheFirstTab) {
            // Show the first tab
            if (showTheFirstTab) {
                $('#' + block + '-tabs a').each(function (i) {
                    if (i == 0) $(this).addClass('current');
                    else $(this).removeClass('current');
                });
                $('.' + block + '-tab-content').each(function (i) {
                    if (i == 0) $(this).show();
                    else $(this).hide();
                });
            }
            // Clear the forms
            var f = $('#' + block + '-block');
            $('input[type=text]', f).val('');

            if (block == 'image') {
                tinyMCE.get('image-block-content').setContent('');
            }

            $('input[type=radio]', f).prop('checked', false);
            $('.answers input[type=checkbox]', f).prop('checked', false);
            if (document.getElementById(block + '-question'))
                tinyMCE.get(block + '-question').setContent('');
        },
    },
    editors: {
        init: function () {
            $('textarea').each(function () {
                iAdmin.editors.enable(this.id);
            });
        },
        enable: function (id) {
            var strikethrough = '';
            // Dropdown and cloze will have the strikethrough button
            if (id == 'dropdown-question' || id == 'cloze-question')
                strikethrough = ' strikethrough';
            var buttons =
                'undo redo | bold italic' +
                strikethrough +
                ' | alignleft aligncenter | bullist numlist | link | code';
            if (id == 'image-block-content' || id == 'frontpage-content-alt') {
                buttons = 'undo redo image';
            }
            tinymce.init({
                selector: '#' + id,
                max_height: 350,
                language: 'all',
                width: 440,
                plugins: 'lists link code paste image autoresize',
                paste_as_text: true,
                browser_spellcheck: true,
                entity_encoding: 'raw',
                toolbar: buttons,
                menubar: false,
                statusbar: false,
                convert_urls: false,

                automatic_uploads: true,
                file_picker_types: 'image',
                /* and here's our custom image picker*/
                file_picker_callback: function (cb, value, meta) {
                    var input = document.createElement('input');
                    input.setAttribute('type', 'file');
                    input.onchange = function () {
                        var file = this.files[0];
                        var fd = new FormData();
                        fd.append('file', file);
                        fd.append('filename', [file.name]);
                        fd.append('odeSessionId', [
                            top.eXeLearning.app.project.odeSession,
                        ]);

                        top.eXe.app.uploadLargeFile(fd).then((response) => {
                            if (
                                response &&
                                response.savedPath &&
                                response.savedFilename
                            ) {
                                let fullPath = `${top.eXeLearning.symfony.fullURL}/${response.savedPath}${response.savedFilename}`;
                                cb(fullPath, {
                                    title: response.savedFilename,
                                    size: response.savedFileSize,
                                });
                            } else {
                                top.eXe.app.alert(_(response.code));
                            }
                        });
                    };
                    input.click();
                },

                content_css: `${iAdmin.domainPath}/files/perm/idevices/base/interactive-video/edition/editor/css/tinymce.css`,
            });
        },
    },
    // Tooltips
    tooltips: {
        className: 'exe-tooltip',
        init: function (path) {
            this.path = path;
            this.viewport = $(window);
            var as = $('A.' + iAdmin.tooltips.className);
            if (as.length > 0) {
                this.links = as;
                this.loadCSS();
                this.loadJS();
            }
        },
        loadCSS: function () {
            // The callback function won't work with CSS files in Safari
            loadScript(this.path + 'jquery.qtip.min.css');
        },
        loadJS: function (file) {
            loadScript(
                this.path + 'jquery.qtip.min.js',
                'iAdmin.tooltips.loadImageLoader()'
            );
        },
        loadImageLoader: function () {
            loadScript(
                this.path + 'imagesloaded.pkg.min.js',
                'iAdmin.tooltips.run()'
            );
        },
        run: function () {
            this.links.each(function () {
                var a = this;
                var c = this.className.replace(
                    iAdmin.tooltips.className + ' ',
                    ''
                );
                $(this).qtip({
                    position: {
                        viewport: iAdmin.tooltips.viewport,
                    },
                    content: {
                        title: '',
                        text: this.title,
                    },
                    style: {
                        classes: 'qtip-light qtip-rounded qtip-shadow',
                    },
                });
            });
        },
    },
};

function enableVideoPlayer(video, image, h, w) {
    if (typeof jwplayer === 'undefined') {
        console.warn('jwplayer not loaded yet, loading now...');
        var script = document.createElement('script');
        script.src =
            'https://mediateca.educa.madrid.org/includes/player/exelearning/jwplayer.js';
        script.onload = function () {
            setupJWPlayer(video, image, h, w);
        };
        document.head.appendChild(script);
    } else {
        setupJWPlayer(video, image, h, w);
    }
}

function setupJWPlayer(video, image, h, w) {
    jwplayer.key = 'XnH21IkIBjAQp06byW5kPeU1Eq1vLpjEllpVdA==';
    jwplayer('player').setup({
        sources: [
            {
                file:
                    'http://mediateca.educa.madrid.org/streaming.php?id=' +
                    video,
                label: '480p',
                type: 'mp4',
                provider: 'http',
                startparam: 'start',
            },
        ],
        image: image,
        abouttext: 'Mediateca',
        aboutlink: 'http://mediateca.educa.madrid.org/video/' + video,
        controls: true,
        height: h,
        width: w,
    });
    jwplayer().onPlay(function () {
        // iAdmin.video.hasPlayed = true;
        setTimeout(function () {
            iAdmin.video.duration = parseInt(jwplayer().getDuration());
        }, 1000);
    });
}

function loadScript(url, callback) {
    var script;
    var isCSS = false;
    if (url.split('.').pop() == 'css') {
        isCSS = true;
        script = document.createElement('link');
        script.type = 'text/css';
        script.rel = 'stylesheet';
        script.href = url;
    } else {
        script = document.createElement('script');
        script.type = 'text/javascript';
        script.src = url;
    }
    if (script.readyState) {
        //IE
        script.onreadystatechange = function () {
            if (
                script.readyState == 'loaded' ||
                script.readyState == 'complete'
            ) {
                script.onreadystatechange = null;
                if (callback) eval(callback);
            }
        };
    } else {
        //Others
        script.onload = function () {
            if (callback) eval(callback);
        };
    }

    document.getElementsByTagName('head')[0].appendChild(script);

    //Capturing the load event on LINK (Safari)
    var isSafari = false;
    var ua = navigator.userAgent.toLowerCase();
    if (ua.indexOf('safari') != -1 && ua.indexOf('chrome') == -1)
        isSafari = true;
    if (isCSS && isSafari && callback) {
        if (typeof loadScriptCounter == 'undefined') loadScriptCounter = 0;
        loadScriptCounter++;
        window['loadScriptControler' + loadScriptCounter] =
            document.createElement('img');
        window['loadScriptControler' + loadScriptCounter].onerror =
            function () {
                eval(callback);
            };
        window['loadScriptControler' + loadScriptCounter].src = url;
    }
}
