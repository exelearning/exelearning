// Effects Plugin for eXeLearning
// By Ignacio Gros (http://www.gros.es/) for eXeLearning (http://exelearning.net/)
// Creative Commons Attribution-ShareAlike (http://creativecommons.org/licenses/by-sa/3.0/)
if (typeof ($exeFX_i18n) == 'undefined') $exeFX_i18n = { previous: "Previous", next: "Next", show: "Show", hide: "Hide", showFeedback: "Show Feedback", hideFeedback: "Hide Feedback", correct: "Correct", incorrect: "Incorrect", menu: "Menu", download: "Download", yourScoreIs: "Your score is ", dataError: "Error recovering data", epubJSerror: "This might not work in this ePub reader.", solution: "Solution", epubDisabled: "This activity does not work in ePub.", print: "Print" }

$exeFX = {
  baseClass: "exe",
  h2: "h2",
  isOldBrowser: false,
  init: function () {
    var ie = $exeFX.checkIE();
    if ((!isNaN(parseFloat(ie)) && isFinite(ie)) && ie < 9) {
      $exeFX.isOldBrowser = true;
      $exeFX.h2 = "H2";
    }
    var k = $exeFX.baseClass;
    var f = $("." + k + "-fx");
    var hasTimeLines = false;
    $("." + k + "-fx").each(function (i) {
      var c = this.className;
      if (c.indexOf(" " + k + "-accordion") != -1) $exeFX.accordion.init(this, i);
      else if (c.indexOf(" " + k + "-tabs") != -1) $exeFX.tabs.init(this, i);
      else if (c.indexOf(" " + k + "-paginated") != -1) $exeFX.paginated.init(this, i);
      else if (c.indexOf(" " + k + "-carousel") != -1) $exeFX.carousel.init(this, i);
      else if (c.indexOf(" " + k + "-timeline") != -1 && document.body.className.indexOf("exe-epub3") != 0) {
        $exeFX.timeline.init(this, i);
        hasTimeLines = true;
      }
    });
    if (hasTimeLines) {
      setTimeout(function () { $.timeliner({}); }, 500);
    }
  },

  hex2rgb: function (h, a) {
    // h should be #rrggbb
    var hex = parseInt(h.substring(1), 16);
    var r = (hex & 0xff0000) >> 16;
    var g = (hex & 0x00ff00) >> 8;
    var b = hex & 0x0000ff;
    // return [r, g, b];
    var c = "rgb";
    if (a) c += "a";
    c += "(" + r + "," + g + "," + b + "";
    if (a) c += "," + a;
    c += ")";
    return c;
  },
  h5pResize: function (block) {
    var iframes = $("iframe", block);
    iframes.each(function () {
      if (this.src && (this.src.indexOf("https://h5p.org/") == 0 || this.src.indexOf("/wp-admin/admin-ajax.php?action=h5p_embed") != -1)) {
        if (!this.style || !this.style.height || this.style.height == "") {
          this.src = this.src;
        }
      }
    });
  },
  removeXMLNS: function (t) {
    if (document.body.className.indexOf("exe-epub3") == 0) {
      var xmlnsString = 'h2 xmlns="http://www.w3.org/1999/xhtml"';
      var xmlnsStringExp = new RegExp(xmlnsString, 'g');
      t = t.replace(xmlnsStringExp, 'h2');
    }
    return t;
  },
  rftTitles: function (t) {
    // Remove all attributes (except the title)
    var div = $("<div></div>");
    div.html(t);
    $("h2", div).each(function () {
      var attributes = $.map(this.attributes, function (item) {
        return item.name;
      });
      var title = $(this);
      $.each(attributes, function (i, item) {
        if (item.toLowerCase() != "title") title.removeAttr(item);
      });
    });
    t = div.html();
    // Remove xmlns="http://www.w3.org/1999/xhtml"
    t = $exeFX.removeXMLNS(t);
    // Replace <h2 title=""></h2> by <h2><span title=""></span></h2>. That's how TinyMCE inserts the title when using the Insert/Edit Attributes option
    var s = t.split('<' + $exeFX.h2 + ' title="');
    var n = "";
    if (s.length < 2) return t;
    for (var i = 0; i < s.length; i++) {
      n += s[i];
      if (i < (s.length - 1)) n += '<' + $exeFX.h2 + '><span title="';
      n = n.replace("</" + $exeFX.h2 + ">", "</span></" + $exeFX.h2 + ">");
    }
    return n;
  },
  noFX: function (e) {
    // Wrong HTML (no H2, etc.): No effects or special presentation
    e.attr("class", "").css("padding", "1em");
  },
  accordion: {
    closeBlock: function (aID) {
      var k = $exeFX.baseClass;
      $('.fx-accordion-title', "#" + aID).removeClass('active');
      $('.fx-accordion-content', "#" + aID).slideUp(300).removeClass('open');
    },
    enable: function (x) {
      var k = $exeFX.baseClass;
      var t = $('.fx-accordion-title', x);
      // Get the box shadow color
      var color = '';
      var title = t.eq(0);
      if (title.length == 1) {
        color = title.css("background-color");
        if (typeof (color) == "string") {
          color = color.replace("rgb(", "rgba(").replace(")", ",0.5)");
          if (color.indexOf("rgba(") == 0) x.css("box-shadow", "0px 1px 3px " + color);
          // Get border color (titles)
          color = x.css("background-color");
          if (typeof (color) == "string") {
            color = color.replace("rgb(", "rgba(").replace(")", ",0.2)");
            if (color.indexOf("rgba(") == 0) {
              t.each(function () {
                this.style.borderColor = color;
              });
            }
          }
        }
      }
      // onclick
      t.off('click').click(function (e) {
        var aID = this.id.split("-")[0];
        aID = aID.replace("_", "-").replace("_", "-");
        var currentAttrValue = $(this).attr('href');

        // IE7 retrieves link#hash instead of #hash
        currentAttrValue = currentAttrValue.split("#");
        currentAttrValue = "#" + currentAttrValue[1];
        // / IE7

        var target = $(e.target);
        var targetName;

        if ($exeFX.isOldBrowser) targetName = target[0].nodeName;
        else targetName = target[0].localName;

        if (targetName == $exeFX.h2) target = target.parent();

        if (target.is('.active')) {
          $exeFX.accordion.closeBlock(aID);
        } else {
          $exeFX.accordion.closeBlock(aID);
          $(this).addClass('active');
          $('.' + k + '-accordion ' + currentAttrValue).slideDown(300, function () {
            $exeFX.h5pResize($(this));
          }).addClass('open');
        }
        e.preventDefault();
      });
    },
    rft: function (e, i) {
      var html = "";
      var h = e.html();
      h = $exeFX.rftTitles(h);
      var p = h.split('<' + $exeFX.h2 + '>');
      if (p.length == h.split('</' + $exeFX.h2 + '>').length) {
        for (var x = 1; x < p.length; x++) {
          html += '<' + $exeFX.h2 + '>' + p[x];
        }
      }

      var k = $exeFX.baseClass;
      if ($exeFX.isOldBrowser) {
        html = html.replace(/<H2/g, '</div>\n<H2');
        html = html.replace('</div>\n<H2', '<H2')
        html = html.replace(/<\/H2>/g, '</H2>\n<div class="fx-accordion-content">');
      } else {
        html = html.replace(/<h2/g, '</div>\n<h2');
        html = html.replace('</div>\n<h2', '<h2')
        html = html.replace(/<\/h2>/g, '</h2>\n<div class="fx-accordion-content">');
      }

      // Something went wrong (see #318)
      if (html == "") {
        $exeFX.noFX(e);
        return;
      }

      html = html + '</div>';
      e.html('<div id="' + k + '-accordion-' + i + '">\n<div class="fx-accordion-section">\n' + html + '\n</div>\n</div>\n');
      var h2 = $("h2", e);
      $(".fx-accordion-content", e).each(function (y) {
        var id = k + "-accordion-" + i + "-" + y;
        this.id = id;
        h2.eq(y).wrap('<a class="fx-accordion-title fx-accordion-title-' + y + ' fx-C1" href="#' + id + '" id="' + id.replace("-", "_").replace("-", "_") + '-trigger"></a>');
      });
      $exeFX.accordion.enable(e);
    },
    init: function (x, i) {
      var e = $(x);
      if (e.find('.fx-accordion-section').length > 0) {
        $exeFX.accordion.enable(e);
        return;
      }
      var a = $("h2", e);
      if (a.length > 0) $exeFX.accordion.rft(e, i);
      else $exeFX.noFX(e);
    }
  },
  timeline: {
    getColor: function (e) {
      var c = e.css("color");
      if (c.indexOf("rgb") != 0) return c;
      return $exe.rgb2hex(c);
    },
    rft: function (e, i) {
      var k = $exeFX.baseClass;
      var gID = k + "-timeline-" + i;
      e.attr("id", gID);
      var mainColor = $exeFX.timeline.getColor(e);
      var titlesColor = $exe.useBlackOrWhite(mainColor.replace("#", ""));
      var html = "";
      var o = e.html();
      var h2 = "<h2>";
      var _h2 = "</h2>";
      var h3 = "<h3>";
      var _h3 = "<h3>";
      var oldB = false;
      if (o.indexOf("<H2") != -1) {
        h2 = "<H2>";
        _h2 = "</H2>";
        h3 = "<H3>";
        _h3 = "</H3>";
        oldB = true;
      } else {
        // To rgba
        if (mainColor.length == 7) mainColor = $exeFX.hex2rgb(mainColor, "0.8");
      }
      // Remove first line if empty
      if (o.indexOf(h2) != 0) {
        var x = o.split(h2);
        if (x.length == 1) return false;
        o = o.replace(x[0], "")
      }
      var n = o.split(h2);
      for (i = 0; i < n.length; i++) {
        if (n[i].length > 0) {
          var partTitle = "";
          var partContent = "";
          var part = n[i];
          var part2 = part.split(_h2);
          if (part2.length == 2) {
            partTitle = part2[0];
            partContent = part2[1];
            // Count the number of H3 in each content
            var p2 = partContent.split(_h3)
            if (p2.length == 1 || p2.length == 0) {
              partTitle = "";
              partContent = "";
            } else {
              if (oldB) {
                partContent = partContent.replace(/\<\/H3>/g, '</a></h3>\n<div class="fx-timeline-event" style="display:none">');
                partContent = partContent.replace(/\<H3>/g, '</div>\n<h3 class="fx-timeline-event-trigger"><a href="#" style="color:' + mainColor + '" title="' + $exeFX_i18n.show + '/' + $exeFX_i18n.hide + '">');
              } else {
                partContent = partContent.replace(/\<\/h3>/g, '</a></h3>\n<div class="fx-timeline-event" style="display:none">');
                partContent = partContent.replace(/\<h3>/g, '</div>\n<h3 class="fx-timeline-event-trigger"><a href="#" style="color:' + mainColor + '" title="' + $exeFX_i18n.show + '/' + $exeFX_i18n.hide + '">');
              }
              partContent = partContent.replace('</div>', '');
              partContent += '</div>';
              partContent = '<div class="fx-timeline-major">\n<h2 class="fx-timeline-marker" title="' + $exeFX_i18n.show + '/' + $exeFX_i18n.hide + '"><span><a href="#" style="background:' + mainColor + '">' + partTitle + '</a></span></h2>\n<div class="fx-timeline-minor">\n' + partContent + '\n</div>\n</div>'
              html += partContent;
            }
          }
        }
      }
      if (html != "") {
        e.addClass("fx-timeline-container").css("border-color", mainColor);
        var ie = $exeFX.checkIE();
        if ((!isNaN(parseFloat(ie)) && isFinite(ie)) && ie < 8) {
          e.addClass("fx-static-timeline-container");
          html = html.replace(/<h2/g, '<span class="fx-ie-dash">—</span><h2');
          e.html(html);
        } else {
          e.html('<div class="fx-timeline-toggler"><p><a href="#" class="fx-timeline-expand" style="background-color:' + mainColor + ';color:' + titlesColor + '">' + $exeFX_i18n.show + '</a></p></div>' + html)
        }
        $(".fx-timeline-event", e).each(function (z) {
          this.id = "event-" + e.attr("id") + "-" + z + "EX";
        });
        $(".fx-timeline-event-trigger", e).each(function (z) {
          this.id = "event-" + e.attr("id") + "-" + z;
        });
      }
      // Add a STYLE tag HEAD
      if (oldB == false) {
        var css = "<style type='text/css'>#" + gID + " .fx-timeline-major h2:before,#" + gID + " .fx-timeline-major h3:before{color:" + mainColor + "}</style>";
        $("HEAD").append(css);
      }
    },
    init: function (x, i) {
      var e = $(x);
      if (e.find('.fx-timeline-major').length > 0) {
        e.off("click", ".fx-timeline-minor h3");
        e.off("click", ".fx-timeline-marker");
        $(".fx-timeline-expand", e).off("click");
        return;
      }
      var h2 = $("H2", e);
      var h3 = $("H3", e);
      if (h2.length > 0 && h3.length > 0) $exeFX.timeline.rft(e, i);
      else $exeFX.noFX(e);
    }
  },
  tabs: {
    show: function (gID, id) {
      var g = $("#" + gID);
      $(".fx-tabs li", g).removeClass("fx-current").removeClass("fx-C2");
      $("#" + id + "-link").addClass("fx-current fx-C2");
      $(".fx-tab-content", g).removeClass("fx-current");
      var block = $("#" + id);
      block.addClass("fx-current");
      $exeFX.h5pResize(block);
    },
    rft: function (e, i) {
      var html = "";
      var k = $exeFX.baseClass;
      var gID = k + "-tabs-" + i;
      var h = e.html();
      h = $exeFX.rftTitles(h);
      var p = h.split('<' + $exeFX.h2 + '>');
      if (p.length == h.split('</' + $exeFX.h2 + '>').length) {
        for (var x = 1; x < p.length; x++) {
          html += '<' + $exeFX.h2 + '>' + p[x];
        }
      }
      if ($exeFX.isOldBrowser) {
        html = html.replace(/<H2/g, '</div>\n<H2');
        html = html.replace('</div>\n<H2', '<H2');
        html = html.replace(/<H2/g, '<div class="fx-tab-content fx-C2">\n<H2 class="sr-av"');
      } else {
        html = html.replace(/<h2/g, '</div>\n<h2');
        html = html.replace('</div>\n<h2', '<h2');
        html = html.replace(/<h2/g, '<div class="fx-tab-content fx-C2">\n<h2 class="sr-av"');
      }

      // Something went wrong (see #318)
      if (html == "") {
        $exeFX.noFX(e);
        return;
      }

      html = html + '</div>';
      e.attr("id", gID).html(html);

      var ul = '<ul class="fx-tabs">\n';
      $(".fx-tab-content", e).each(function (y) {
        var h2 = $("H2", this).eq(0);

        // Default tab title
        var t = y + 1;
        if (h2.length == 0) {
          // Can't getElementsByTagName("H2") in some ePub readers (xmlns="http://www.w3.org/1999/xhtml"...)
          var tit = this.innerHTML.split(">");
          if (tit.length > 1) tit = tit[1];
          tit = tit.split("<");
          if (tit.length > 1) tit = tit[0];
          if (tit.length > 0) t = tit;
        } else {
          // Normal behavior
          t = h2.text();
        }

        var hT = $("SPAN", h2);
        if (hT.length == 1) {
          hT = hT.eq(0).attr("title");
          if (hT) {
            t = hT;
            h2.removeClass("sr-av")
          }
        }
        var id = k + "-tab-" + i + "-" + y;
        var c = "";
        if (y == 0) {
          c += ' class="fx-current fx-C2"';
          this.className += " fx-current fx-default-panel";
        }
        ul += '<li' + c + ' id="' + id + '-link"><a href="#' + id + '" class="exeFXTabLink' + gID + '_' + id + '">' + t + '</a></li>\n';
        this.id = id;
      });
      ul += '</ul>';
      e.prepend(ul);
      // onclick
      $(".fx-tabs a", e).off('click').click(
        function () {
          var c = this.className;
          c = c.split(" ");
          for (var i = 0; i < c.length; i++) {
            if (c[i].indexOf("exeFXTabLink") == 0) c = c[i];
          }
          c = c.replace("exeFXTabLink", "");
          c = c.split("_");
          if (c.length == 2) {
            $exeFX.tabs.show(c[0], c[1]);
          }
          return false;
        }
      );
    },
    init: function (x, i) {
      var e = $(x);
      if (e.find('.fx-tabs').length > 0) {
        $(".fx-tabs a", e).off('click').click(
          function () {
            var c = this.className;
            c = c.split(" ");
            for (var i = 0; i < c.length; i++) {
              if (c[i].indexOf("exeFXTabLink") == 0) c = c[i];
            }
            c = c.replace("exeFXTabLink", "");
            c = c.split("_");
            if (c.length == 2) {
              $exeFX.tabs.show(c[0], c[1]);
            }
            return false;
          }
        );
        return;
      }
      var a = $("h2", e);
      if (a.length > 0) $exeFX.tabs.rft(e, i);
      else $exeFX.noFX(e);
    }
  },
  paginated: {
    show: function (gID, id, n) {
      n = parseInt(n);
      var g = $("#" + gID);
      var lis = $(".fx-pagination li", g);

      // Pagination
      var l = (lis.length - 2);
      if (l == 1) return false;
      var prevLi = $("#" + gID + "-prev");
      var prevA = document.getElementById(gID + "-prev-lnk");
      var nextLi = $("#" + gID + "-next");
      var nextA = document.getElementById(gID + "-next-lnk");
      if (!prevA || !nextA) return false;
      if (n == 0) {
        // Prev
        prevLi.addClass("fx-disabled");
        prevA.className = "fx-disabled-link";
        // Next
        nextLi.removeClass("fx-disabled");
        nextA.className = "exeFXPageLink" + gID + "_" + gID + "-1_1";
      } else {
        // Prev
        prevLi.removeClass("fx-disabled");
        prevA.className = "exeFXPageLink" + gID + "_" + gID + "-" + (n - 1) + "_" + (n - 1);
        // Next
        if ((n + 2) > l) {
          nextLi.addClass("fx-disabled");
          nextA.className = "fx-disabled-link";
        } else {
          nextLi.removeClass("fx-disabled");
          nextA.className = "exeFXPageLink" + gID + "_" + gID + "-" + (n + 1) + "_" + (n + 1);
        }
      }

      lis.removeClass("fx-current").removeClass("fx-C1");
      $("#" + id + "-link").addClass("fx-current fx-C1");
      $(".fx-page-content", g).removeClass("fx-current");
      var block = $("#" + id);
      block.addClass("fx-current");
      $exeFX.h5pResize(block);
    },
    init: function (x, i) {
      var e = $(x);
      if (e.find('.fx-pagination').length > 0) {
        $(".fx-pagination a", e).off('click').click(
          function () {
            var a = $(this);
            if (a.hasClass("fx-disabled-link")) {
              return false;
            }
            var c = a.attr("class");
            c = c.split(" ");
            for (var i = 0; i < c.length; i++) {
              if (c[i].indexOf("exeFXPageLink") == 0) c = c[i];
            }
            c = c.replace("exeFXPageLink", "");
            c = c.split("_");
            if (c.length == 3) {
              $exeFX.paginated.show(c[0], c[1], c[2]);
            }
            return false;
          }
        );
        return;
      }
      var a = $("h2", e);
      if (a.length > 0) $exeFX.paginated.rft(e, i);
      else $exeFX.noFX(e);
    },
    rft: function (e, i) {
      var html = "";
      var k = $exeFX.baseClass;
      var gID = k + "-paginated-" + i;
      var h = e.html();
      h = $exeFX.rftTitles(h);
      var p = h.split('<' + $exeFX.h2 + '>');
      if (p.length == h.split('</' + $exeFX.h2 + '>').length) {
        for (var x = 1; x < p.length; x++) {
          html += '<' + $exeFX.h2 + '>' + p[x];
        }
      }
      if ($exeFX.isOldBrowser) {
        html = html.replace(/<H2/g, '</div>\n<H2');
        html = html.replace('</div>\n<H2', '<H2');
        html = html.replace(/<H2/g, '<div class="fx-page-content fx-C2">\n<H2');
      } else {
        html = html.replace(/<h2/g, '</div>\n<h2');
        html = html.replace('</div>\n<h2', '<h2');
        html = html.replace(/<h2/g, '<div class="fx-page-content fx-C2">\n<h2');
      }

      // Something went wrong (see #318)
      if (html == "") {
        $exeFX.noFX(e);
        return;
      }

      html = html + '</div>';
      e.attr("id", gID).html(html);

      var counter = 0;
      var hasNext = false;
      var ul = '<ul class="fx-pagination">\n';
      ul += '<li id="' + k + '-paginated-' + i + '-prev" class="fx-prev-next fx-prev fx-disabled"><a href="#" id="' + k + '-paginated-' + i + '-prev-lnk" title="' + $exeFX_i18n.previous + '" class="fx-disabled-link"><span>&#9668;</span><span class="sr-av"> ' + $exeFX_i18n.previous + '</span></a></li>';
      $(".fx-page-content", e).each(function (y) {
        var t = $("H2", this).eq(0).text();
        t = t.replace(/\"/g, '&quot;');
        var id = k + "-paginated-" + i + "-" + y;
        var c = "";
        if (y == 0) {
          c += ' class="fx-current fx-C1"';
          this.className += " fx-current";
        }
        ul += '<li' + c + ' id="' + id + '-link"><a href="#' + id + '" class="exeFXPageLink' + gID + '_' + id + '_' + y + '" title="' + t + '">' + (y + 1) + '</a></li>\n';
        this.id = id;
        counter++;
      });
      if (counter > 1) hasNext = true;
      ul += '<li id="' + k + '-paginated-' + i + '-next" class="fx-prev-next fx-next';
      var css = 'exeFXPageLink' + gID + '_' + gID + '-1_1';
      if (!hasNext) {
        ul += ' fx-disabled';
        css = 'fx-disabled-link';
      }
      ul += '"><a href="#" id="' + k + '-paginated-' + i + '-next-lnk" title="' + $exeFX_i18n.next + '" class="' + css + '"><span>&#9658;</span><span class="sr-av"> ' + $exeFX_i18n.next + '</span></a></li>';
      ul += '</ul>';
      e.prepend(ul);
      // onclick
      $(".fx-pagination a", e).off('click').click(
        function () {
          var a = $(this);
          if (a.hasClass("fx-disabled-link")) {
            return false;
          }
          var c = a.attr("class");
          c = c.split(" ");
          for (var i = 0; i < c.length; i++) {
            if (c[i].indexOf("exeFXPageLink") == 0) c = c[i];
          }
          c = c.replace("exeFXPageLink", "");
          c = c.split("_");
          if (c.length == 3) {
            $exeFX.paginated.show(c[0], c[1], c[2]);
          }
          return false;
        }
      );
    }
  },
  carousel: {
    isWorking: false,
    show: function (gID, id, n) {
      if ($exeFX.carousel.isWorking) return false;
      $exeFX.carousel.isWorking = true;
      n = parseInt(n);
      var g = $("#" + gID);
      var lis = $(".fx-carousel-pagination li", g);

      // Pagination
      var l = (lis.length - 2);
      if (l == 1) return false;
      var prevLi = $("#" + gID + "-prev");
      var prevA = document.getElementById(gID + "-prev-lnk");
      var nextLi = $("#" + gID + "-next");
      var nextA = document.getElementById(gID + "-next-lnk");
      if (!prevA || !nextA) return false;
      if (n == 0) {
        // Prev
        prevLi.addClass("fx-disabled");
        prevA.className = "fx-disabled-link";
        // Next
        nextLi.removeClass("fx-disabled");
        nextA.onclick = function () {
          $exeFX.carousel.show(gID, gID + "-1", 1);
          return false;
        }
      } else {
        // Prev
        prevLi.removeClass("fx-disabled");
        prevA.className = "exeFXSlideLink" + gID + "_" + gID + "-" + (n - 1) + "_" + (n - 1);
        // Next
        if ((n + 2) > l) {
          nextLi.addClass("fx-disabled");
          nextA.className = "fx-disabled-link";
        } else {
          nextLi.removeClass("fx-disabled");
          nextA.className = "exeFXSlideLink" + gID + "_" + gID + "-" + (n + 1) + "_" + (n + 1);
        }
      }

      lis.removeClass("fx-current").removeClass("fx-C1");
      $("#" + id + "-link").addClass("fx-current fx-C1");
      $(".fx-carousel-content", g).hide();
      $("#" + id).fadeIn("slow", function () {
        $exeFX.carousel.isWorking = false;
        $exeFX.h5pResize($(this));
      });
    },
    init: function (x, i) {
      var e = $(x);
      if (e.find('.fx-carousel-pagination').length > 0) {
        $(".fx-carousel-pagination a", e).off('click').click(
          function () {
            var a = $(this);
            if (a.hasClass("fx-disabled-link")) {
              return false;
            }
            var c = a.attr("class");
            c = c.split(" ");
            for (var i = 0; i < c.length; i++) {
              if (c[i].indexOf("exeFXSlideLink") == 0) c = c[i];
            }
            c = c.replace("exeFXSlideLink", "");
            c = c.split("_");
            if (c.length == 3) {
              $exeFX.carousel.show(c[0], c[1], c[2]);
            }
            return false;
          }
        );
        return;
      }
      var a = $("h2", e);
      if (a.length > 0) $exeFX.carousel.rft(e, i);
      else $exeFX.noFX(e);
    },
    rft: function (e, i) {
      var html = "";
      var k = $exeFX.baseClass;
      var gID = k + "-carousel-" + i;
      var h = e.html();
      h = $exeFX.rftTitles(h);
      var p = h.split('<' + $exeFX.h2 + '>');
      if (p.length == h.split('</' + $exeFX.h2 + '>').length) {
        for (var x = 1; x < p.length; x++) {
          html += '<' + $exeFX.h2 + '>' + p[x];
        }
      }
      if ($exeFX.isOldBrowser) {
        html = html.replace(/<H2/g, '</div>\n<H2');
        html = html.replace('</div>\n<H2', '<H2');
        html = html.replace(/<H2/g, '<div class="fx-carousel-content fx-C2">\n<H2');
      } else {
        html = html.replace(/<h2/g, '</div>\n<h2');
        html = html.replace('</div>\n<h2', '<h2');
        html = html.replace(/<h2/g, '<div class="fx-carousel-content fx-C2">\n<h2');
      }

      // Something went wrong (see #318)
      if (html == "") {
        $exeFX.noFX(e);
        return;
      }

      html = html + '</div>';
      e.attr("id", gID).html(html);

      var counter = 0;
      var hasNext = false;
      var ul = '<ul class="fx-pagination fx-carousel-pagination">\n';
      ul += '<li id="' + k + '-carousel-' + i + '-prev" class="fx-carousel-prev-next fx-carousel-prev fx-disabled fx-C2"><a href="#" id="exe-carousel-' + i + '-prev-lnk" title="' + $exeFX_i18n.previous + '" class="fx-disabled-link"><span>&#9668;</span><span class="sr-av"> ' + $exeFX_i18n.previous + '</span></a></li>';
      $(".fx-carousel-content", e).each(function (y) {
        var t = $("H2", this).eq(0).text();
        t = t.replace(/\"/g, '&quot;');
        var id = k + "-carousel-" + i + "-" + y;
        var c = "";
        if (y == 0) {
          c += ' class="fx-current fx-C1"';
          this.className += " fx-current";
        }
        ul += '<li' + c + ' id="' + id + '-link"><a href="#' + id + '" class="exeFXSlideLink' + gID + '_' + id + '_' + y + '" title="' + t + '">' + (y + 1) + '</a></li>\n';
        this.id = id;
        counter++;
      });
      if (counter > 1) hasNext = true;
      ul += '<li id="' + k + '-carousel-' + i + '-next" class="fx-carousel-prev-next fx-carousel-next fx-C2';
      if (!hasNext) ul += ' fx-disabled';
      ul += '"><a href="#" id="' + k + '-carousel-' + i + '-next-lnk" title="' + $exeFX_i18n.next + '"';
      if (hasNext) ul += ' class="exeFXSlideLink' + gID + '_' + gID + '-1_1"'
      ul += '><span>&#9658;</span><span class="sr-av"> ' + $exeFX_i18n.next + '</span></a></li>';
      ul += '</ul>';
      e.append(ul);
      // onclick
      $(".fx-carousel-pagination a", e).off('click').click(
        function () {
          var a = $(this);
          if (a.hasClass("fx-disabled-link")) {
            return false;
          }
          var c = a.attr("class");
          c = c.split(" ");
          for (var i = 0; i < c.length; i++) {
            if (c[i].indexOf("exeFXSlideLink") == 0) c = c[i];
          }
          c = c.replace("exeFXSlideLink", "");
          c = c.split("_");
          if (c.length == 3) {
            $exeFX.carousel.show(c[0], c[1], c[2]);
          }
          return false;
        }
      );
    }
  },
  checkIE: function () {
    var n = navigator.userAgent.toLowerCase();
    return (n.indexOf('msie') != -1) ? parseInt(n.split('msie')[1]) : false;
  }
}

$(function () {
  if (window.eXeLearning === undefined) $exeFX.init();
});

/*
* Timeliner.js
* @version      1.5.1
* @copyright    Tarek Anandan (http://www.technotarek.com)
*/
; (function (e) { var t; e.timeliner = function (n) { t = jQuery.extend({ timelineContainer: ".fx-timeline-container", startState: "closed", startOpen: [], baseSpeed: 100, speed: 4, fontOpen: "1.1em", fontClosed: "1em", expandAllText: $exeFX_i18n.show, collapseAllText: $exeFX_i18n.hide }, n); e(document).ready(function () { function n(n, r) { e(n).removeClass("closed").addClass("open").animate({ fontSize: t.fontOpen }, t.baseSpeed); e(r).show(t.speed * t.baseSpeed) } function r(n, r) { e(n).animate({ fontSize: t.fontClosed }, 0).removeClass("open").addClass("closed"); e(r).hide(t.speed * t.baseSpeed) } if (t.startState === "closed") { e(".fx-timeline-event").hide(); e.each(e(t.startOpen), function (t, r) { n(e(r).parent(".fx-timeline-minor").find("h3 a"), e(r)) }) } else { n(e(".fx-timeline-minor h3 a"), e(".fx-timeline-event")) } e(t.timelineContainer).on("click", ".fx-timeline-minor h3", function () { var t = e(this).attr("id"); if (e(this).find("a").is(".open")) { r(e("a", this), e("#" + t + "EX")); return false } else { n(e("a", this), e("#" + t + "EX")) } return false }); e(t.timelineContainer).on("click", ".fx-timeline-marker", function () { var t = e(this).parents(".fx-timeline-major").find(".fx-timeline-minor").length; var i = e(this).parents(".fx-timeline-major").find(".open").length; if (t > i) { n(e(this).parents(".fx-timeline-major").find("h3 a", ".fx-timeline-minor"), e(this).parents(".fx-timeline-major").find(".fx-timeline-event")) } else { r(e(this).parents(".fx-timeline-major").find(".fx-timeline-minor a"), e(this).parents(".fx-timeline-major").find(".fx-timeline-event")) } return false }); e(".fx-timeline-expand").click(function () { if (e(this).hasClass("expanded")) { r(e(this).parents(t.timelineContainer).find("h3 a", ".fx-timeline-minor"), e(this).parents(t.timelineContainer).find(".fx-timeline-event")); e(this).removeClass("expanded").html(t.expandAllText) } else { n(e(this).parents(t.timelineContainer).find("h3 a", ".fx-timeline-minor"), e(this).parents(t.timelineContainer).find(".fx-timeline-event")); e(this).addClass("expanded").html(t.collapseAllText) } return false }) }) } })(jQuery);
