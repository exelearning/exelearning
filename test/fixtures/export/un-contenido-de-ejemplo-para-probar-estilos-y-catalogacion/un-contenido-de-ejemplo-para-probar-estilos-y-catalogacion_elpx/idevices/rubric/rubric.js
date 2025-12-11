/**
 * Rubrics iDevice
 *
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: Ignacio Gros (http://gros.es/) for http://exelearning.net/
 *
 * License: http://creativecommons.org/licenses/by-sa/4.0/
 */

var $rubric = {

  // Default strings
  ci18n: {
    "activity": "Activity",
    "name": "Name",
    "date": "Date",
    "score": "Score",
    "notes": "Notes",
    "reset": "Reset",
    "print": "Print",
    "apply": "Apply",
    "newWindow": "New Window"
  },
  idevicePath: "",

  init: function () {
    $(".idevice_node.rubric").each(function (i, ideviceElement) {

      var table = $("table", this);
      if (table.length != 1) return;
      var ul = $("ul.exe-rubrics-strings", this);
      if (ul.length == 1) {
        // Update $rubric.ci18n to use the custom strings
        $("li", ul).each(function () {
          if ($rubric.ci18n[this.className]) {
            $rubric.ci18n[this.className] = $(this).text();
          }
        });
      }

      var id = ideviceElement.getAttribute("id");

      var i18n = $rubric.ci18n;
      var applyLink = '<a href="#" class="exe-rubrics-print" id="print-' + id + '"title="' + i18n.apply + ' (' + i18n.newWindow.toLowerCase() + ')"><span>' + i18n.apply + '</span></a>';
      $("caption", table).append(applyLink);
      $("#print-" + id).click(function () {
        $rubric.printRubric($("caption", table).text(), table.html())
        return false;
      });
      // To review (Electron)
      if (window.location.host=='localhost:41309') {
        $("#print-" + id).css("cursor", "not-allowed");
      }

    });

    // Print version
    if (!$("body").hasClass("exe-rubrics")) return;

    // Add checkboxes
    $("tbody tr").each(function (i) {
      $("td", this).each(function (z) {
        var val = "";
        var span = $("span", this);
        if (span.length == 1) {
          try {
            val = span.text().match(/\(([^)]+)\)/)[1];
          } catch (e) {
            val = "";
          }
          if (val != "") {
            val = val.replace(/[^0-9.,]/g, "");
            val = val.replace(/,/g, ".");
            var isNumeric = true;
            if (isNaN(val)) isNumeric = false;
            if (!isNumeric) val = "";
          }
        }
        this.innerHTML += ' <input type="checkbox" name="criteria-' + i + '" id="criteria-' + i + '-' + z + '" value="' + val + '" />';
      });
      // Make those checkboxes work as radio inputs
      $("input", this).change(function () {
        if (this.checked) {
          var name = this.name;
          $("input[name='" + this.name + "']").prop("checked", false);
          $(this).prop("checked", true);
        }
        $rubric.checkScore();
      });
    });

    $rubric.getMaxScore();

    // Clear form button
    $("#clear").click(function () {
      $("input[type='checkbox']").prop("checked", false);
      $("#score,#notes").val("");
      $("#name").val("").focus();
    });

    // Print button
    $("#print").click(function () {
      try {
        window.print();
      } catch (e) {
        //
      }
    });

  },

  // Add the scores of the first level and show the result in #ri_MaxScore
  getMaxScore: function () {
    var trs = $("table tbody tr");
    var nums = [];
    trs.each(function () {
      var val = $("td input", this).eq(0).val();
      val = val.replace(/[^0-9.,]/g, "");
      val = val.replace(/,/g, ".");
      var isNumeric = true;
      if (val == "" || isNaN(val)) isNumeric = false;
      if (isNumeric) nums.push(val);
    });
    var res = 0;
    for (var i = 0; i < nums.length; i++) {
      res += parseFloat(nums[i]);
    }
    res = Math.round(res * 10) / 10;
    this.maxScore = res;
  },

  // Check the score (just add the numeric values of the checked inputs)
  checkScore: function () {
    var res = 0;
    $("tbody input:checked").each(function () {
      res += parseFloat(this.value);
    });
    if (isNaN(res)) res = "";
    else {
      // Show score out of 10
      if (!isNaN(this.maxScore) && this.maxScore != 10) {
        var dec = (res * 10) / this.maxScore;
        dec = Math.round(dec * 10) / 10;
        res = dec + " (" + res + "/" + this.maxScore + ")";
      }
    }
    $("#score").val(res);
  },

  printRubric: function (tit, html) {
    if (document.getElementById("workarea")) {
      eXe.app.alert(_("Please export the content to apply the rubric."));
      return false;
    }
    if (window.location.host=='localhost:41309') {
      return false; // To review (Electron)
    }
    var isIndex = $("html").attr("id") == "exe-index";
    var basePath = "idevices/rubric/";
    if (!isIndex) basePath = "../" + basePath;
    var rubricStyle = basePath + "rubric.css";
    var rubricScript = basePath + "rubric.js";
    var jqueryScript = "libs/jquery/jquery.min.js";
    if (!isIndex) jqueryScript = "../" + jqueryScript;
    // Strings
    var i18n = this.ci18n;
    var a = window.open(tit);
    a.document.open("text/html");
    a.document.write('<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">');
    a.document.write('<html xmlns="http://www.w3.org/1999/xhtml" class="exe-rubrics">');
    a.document.write('<head>');
    a.document.write('<title>' + tit + '</title>');
    a.document.write('<link rel="shortcut icon" href="favicon.ico" type="image/x-icon" />');
    a.document.write('<link href="' + rubricStyle + '" rel="stylesheet" type="text/css" />');
    a.document.write('<script type="text/javascript" src="' + jqueryScript + '"></script>');
    a.document.write('<script type="text/javascript" src="' + rubricScript + '"></script>');
    a.document.write('</head>');
    a.document.write('<body class="exe-rubrics">');
    a.document.write('<div class="exe-rubrics-wrapper">');
    a.document.write('<div class="exe-rubrics-content">');
    a.document.write('<div id="exe-rubrics-header">');
    a.document.write('<p>');
    a.document.write('<label for="activity">' + i18n.activity + ':</label> <input type="text" id="activity" />');
    a.document.write('<label for="date">' + i18n.date + ':</label> <input type="text" id="date" />');
    a.document.write('</p>');
    a.document.write('<p>');
    a.document.write('<label for="name">' + i18n.name + ':</label> <input type="text" id="name" />');
    a.document.write('<label for="score">' + i18n.score + ':</label> <input type="text" id="score" />');
    a.document.write('</p>');
    a.document.write('</div>');
    a.document.write('<table class="exe-table">' + html + '</table>');
    a.document.write('<div id="exe-rubrics-footer">');
    a.document.write('<p>');
    a.document.write('<label for="notes">' + i18n.notes + ':</label> <textarea id="notes" cols="32" rows="6"></textarea>');
    a.document.write('</p>');
    a.document.write('</div>');
    a.document.write('</div>');
    a.document.write('<div id="commands"><input type="button" value="' + i18n.reset + '" id="clear" /> <input type="button" value="' + i18n.print + '" id="print" /></div>');
    a.document.write('</div>');
    a.document.write('</body>');
    a.document.write('</html>');
    a.document.close();

  }

}

$(function () {
  $rubric.init();
});