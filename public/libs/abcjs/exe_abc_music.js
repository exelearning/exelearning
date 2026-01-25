var synthControl;
var is_n_audio_ok;
var abc = [];

class CursorControl {

    constructor(index) {
        this.paperDivs = window.document.querySelectorAll(".abcjs-paper");
        this.index = index;
    }

    onStart = function () {
        var svg = this.paperDivs[this.index].querySelector("svg");
        var cursor = window.document.createElementNS("http://www.w3.org/2000/svg", "line");
        cursor.setAttribute("class", "abcjs-cursor");
        cursor.setAttributeNS(null, 'x1', 0);
        cursor.setAttributeNS(null, 'y1', 0);
        cursor.setAttributeNS(null, 'x2', 0);
        cursor.setAttributeNS(null, 'y2', 0);
        svg.appendChild(cursor);
    };

    onEvent = function (ev) {
        // This was the second part of a tie across a measure line. Just ignore it.
        if (ev.measureStart && ev.left === null) return;

        var svg = this.paperDivs[this.index].querySelector("svg");
        var lastSelection = svg.querySelectorAll(".abcjs-highlight");
        for (var k = 0; k < lastSelection.length; k++) {
            lastSelection[k].classList.remove("abcjs-highlight");
        }
        for (var i = 0; i < ev.elements.length; i++) {
            var note = ev.elements[i];
            for (var j = 0; j < note.length; j++) {
                note[j].classList.add("abcjs-highlight");
            }
        }
        var cursor = svg.querySelector(".abcjs-cursor");
        if (cursor) {
            cursor.setAttribute("x1", ev.left - 2);
            cursor.setAttribute("x2", ev.left - 2);
            cursor.setAttribute("y1", ev.top);
            cursor.setAttribute("y2", ev.top + ev.height);
        }
    };

    onFinished = function () {
        var svg = this.paperDivs[this.index].querySelector("svg");
        var els = svg.querySelectorAll(".abcjs-highlight");
        for (var i = 0; i < els.length; i++) {
            els[i].classList.remove("abcjs-highlight");
        }
        var cursor = svg.querySelector(".abcjs-cursor");
        if (cursor) {
            cursor.setAttribute("x1", 0);
            cursor.setAttribute("x2", 0);
            cursor.setAttribute("y1", 0);
            cursor.setAttribute("y2", 0);
        }
    };
}

/**
 * Load abcjs
 *
 */
window.abcjsLoad = () => {
    abc = [];
    is_n_audio_ok = false;
    var audioDivs = window.document.querySelectorAll(".abcjs-audio");
    var htmlSource = parent.document.querySelector("#htmlSource");
    if (htmlSource !== null) {
        htmlSource = htmlSource.value;
        abc.push(htmlSource);
    } else {
        htmlSource = window.document.querySelectorAll("pre.abc-music");
        htmlSource.forEach(element => {
            abc.push(element.textContent);
        });
    }
    multipleLoads(audioDivs, 0);
}

/**
 *
 * @param {*} abcElem
 * @param {*} tuneNumber
 * @param {*} classes
 * @param {*} analysis
 * @param {*} drag
 * @param {*} mouseEvent
 * @returns
 */
function clickListener(abcElem, tuneNumber, classes, analysis, drag, mouseEvent) {
    var lastClicked = abcElem.midiPitches;
    if (!lastClicked) return;
    window.ABCJS.synth.playEvent(
        lastClicked, abcElem.midiGraceNotePitches, synthControl.visualObj.millisecondsPerMeasure()
    ).then(function (response) {
        //
    }).catch(function (error) {
        //
    });
}

/**
 *
 * @returns
 */
function isNAudioOkNow() {
    return new Promise((resolve, reject) => {
        let id = setInterval(frame, 10);
        function frame() {
            const workDone = 'Audio n is ok now';
            if (is_n_audio_ok) {
                is_n_audio_ok = false;
                clearInterval(id);
                resolve(workDone);
            }
        }
    });
}

/**
 *
 * @param {*} audioArr
 * @param {*} index
 */
function multipleLoads(audioArr, index) {
    if (audioArr.length > 0) {
        if (window.ABCJS.synth.supportsAudio()) {
            synthControl = new window.ABCJS.synth.SynthController();
            synthControl.load(
                audioArr[index],
                new CursorControl(index),
                {
                    displayLoop: true,
                    displayRestart: true,
                    displayPlay: true,
                    displayProgress: true,
                    displayWarp: true
                }
            );
        } else {
            audioArr[index].innerHTML = "<div class='audio-error'>Audio is not supported in this browser.</div>";
        }
        setTune(false, index);
        isNAudioOkNow()
            .then(response => { if (index + 1 < audioArr.length) multipleLoads(audioArr, index + 1) })
            .catch(error => console.error("Error multipleLoads: " + error));
    }
}

/**
 *
 * @param {*} userAction
 * @param {*} index
 */
function setTune(userAction, index) {
    synthControl.disable(true);
    let paperDivs = window.document.querySelectorAll(".abcjs-paper");
    let midiButtons = window.document.querySelectorAll(".abcjs-midi");
    var abcOptions = { add_classes: true, clickListener: this.clickListener, responsive: "resize" };
    var visualObjList = window.ABCJS.renderAbc(paperDivs[index], abc[index], abcOptions);
    if (!visualObjList) return;
    var visualObj = visualObjList[0];
    var midi = window.ABCJS.synth.getMidiFile(abc[index],{
        downloadLabel : "MIDI",
        fileName : "midi"
    });
    midiButtons[index].innerHTML = midi;
    // TODO-PER: This will allow the callback function to have access to timing info
    // - this should be incorporated into the render at some point.
    var midiBuffer = new window.ABCJS.synth.CreateSynth();
    midiBuffer.init({
        //audioContext: new AudioContext(),
        visualObj: visualObj,
        // sequence: [],
        // millisecondsPerMeasure: 1000,
        // debugCallback: function(message) { console.log(message) },
        options: {
            // soundFontUrl: "https://paulrosen.github.io/midi-js-soundfonts/FluidR3_GM/" ,
            // sequenceCallback: function(noteMapTracks, callbackContext) { return noteMapTracks; },
            // callbackContext: this,
            // onEnded: function(callbackContext),
            // pan: [ -0.5, 0.5 ]
        }
    })
        .then(function (response) {
            if (synthControl) {
                synthControl.setTune(visualObj, userAction)
                    .then(function (response) { is_n_audio_ok = true })
                    .catch(function (error) { console.warn("Audio problem:", error) });
            }
        })
        .catch(function (error) {
            console.warn("Audio problem:", error);
        });
}

$exeABCmusic = {

  /**
   * Check for abc notation content
   *
   */
  init() {
    $exeABCmusic.processAbcNotation();
    $exeABCmusic.setButtonsBehaviour();
    $exeABCmusic.appendFilesAbcNotation();

    var loadAbcjsInterval = setInterval(function () {
      try {
        window.abcjsLoad();
        clearInterval(loadAbcjsInterval);
      } catch (error) {
        console.warn("Error loading abcjs");
      }
    }, 200);
  },

  /**
   * Append files to head
   *
   */
  appendFilesAbcNotation() {
    if (window.eXeLearning === undefined) return; // Not load the scripts dynamically in the export

    // Determine libs path based on mode
    let libsPath;
    if (window.__EXE_STATIC_MODE__) {
      // Static mode: use relative paths without version prefix
      const basePath = eXeLearning.config.basePath || '.';
      libsPath = `${basePath}/libs`;
    } else {
      // Server mode: use versioned paths for cache busting
      const basePath = eXeLearning.config.basePath || '';
      const version = eXeLearning.version || 'v1.0.0';
      libsPath = `${basePath}/${version}/libs`;
    }
    let abcmusicPath = `${libsPath}/tinymce_5/js/tinymce/plugins/abcmusic`;

    let head = document.querySelector("head");

    if (!head.querySelector('script.abcjs-basic-js')) {
      let abcjsScript = document.createElement("script");
      abcjsScript.classList.add("abcjs-basic-js");
      abcjsScript.classList.add("exe");
      abcjsScript.type = "text/javascript";
      abcjsScript.src = `${libsPath}/abcjs/abcjs-basic-min.js`;
      head.append(abcjsScript);
    }

    if (!head.querySelector('link.abcjs-basic-css')) {
      let abcjsAudioCss = document.createElement("link");
      abcjsAudioCss.classList.add("abcjs-basic-css");
      abcjsAudioCss.classList.add("exe");
      abcjsAudioCss.href = `${libsPath}/abcjs/abcjs-audio.css`;
      abcjsAudioCss.rel = "stylesheet";
      abcjsAudioCss.type = "text/css";
      head.append(abcjsAudioCss);
    }

  },

  /**
   * Find abc notation in html
   *
   * @param {Element} container
   */
  processAbcNotation() {
    let htmlElements = window.document.querySelectorAll("pre.abc-music");
    let abcLength = htmlElements.length;
    let elementIndexToProcess = [];

    for (let i = 0; i < htmlElements.length; i++) {
      window.document.querySelectorAll("pre.abc-music")[i].id = "abcnotation_" + i;
      elementIndexToProcess.push(i);
    }

    if (abcLength > 0) {
      elementIndexToProcess.forEach(element => {
        let abcnotationElement = window.document.querySelector(`#abcnotation_${element}`);
        if (abcnotationElement.nextElementSibling !== null
          && abcnotationElement.nextElementSibling.classList.contains("paper-container")
        ) {
          //
        } else {
          let abcPaperElement = document.createElement("div");
          abcPaperElement.classList.add("abc-container", "paper-container");
          let abcPaperInner = `<div class="abcjs-paper"></div>`;
          abcPaperElement.innerHTML = abcPaperInner;

          let abcAudioElement = document.createElement("div");
          abcAudioElement.classList.add("abc-container", "audio-container");
          let abcAudioInner = `<div class="abcjs-midi">MIDI</div><div class="abcjs-audio"></div>`;
          abcAudioElement.innerHTML = abcAudioInner;

          let abcAudioButton = document.createElement("div");
          abcAudioButton.classList.add("button-wrapper");
          let abcAudioButtonInner = `<input type="button" class="abc-audio-tooglebutton" value="MIDI" />`;
          abcAudioButton.innerHTML = abcAudioButtonInner;

          let abcButton = document.createElement("div");
          abcButton.classList.add("button-wrapper");
          let abcButtonInner = `<input type="button" class="abc-tooglebutton" value="ABC" />`;
          abcButton.innerHTML = abcButtonInner;

          let buttonsContainer = document.createElement("div");
          buttonsContainer.classList.add("inline", "abc-container");
          buttonsContainer.appendChild(abcButton);
          buttonsContainer.appendChild(abcAudioButton);

          window.document.querySelector(`#abcnotation_${element}`).before(buttonsContainer);
          window.document.querySelector(`#abcnotation_${element}`).before(abcAudioElement);
          window.document.querySelector(`#abcnotation_${element}`).after(abcPaperElement);

          abcAudioElement.style.display = "none";
          window.document.querySelector(`#abcnotation_${element}`).style.display = "none";

          if (!window.document.querySelector(`#abcnotation_${element}`).classList.contains("abc-music-midi")) {
            abcAudioButton.style.display = "none";
          }
        }
      });
    }

  },

  /**
   *
   */
  setButtonsBehaviour() {
    $(`.abc-audio-tooglebutton`).on('click', function (e) {
      e.preventDefault();
      $(this).parent().parent().next().toggle();
    });
    $(`.abc-tooglebutton`).on('click', function (e) {
      e.preventDefault();
      $(this).parent().parent().next().next().toggle();
    });
  }

}

$(function () {
  if (window.eXeLearning === undefined) $exeABCmusic.init();
});
