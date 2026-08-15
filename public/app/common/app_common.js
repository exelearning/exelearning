import DateConversion from "./app_date_conversion.js";

export default class Common {

  constructor(app) {
    this.app = app;
    this.dateConversion = new DateConversion();
  }

  /**
   * Generates an identifier from the current date
   *
   * @returns {string}
   */
  generateId() {
    let date = new Date();
    let year = this.dateConversion.getDateYear(date);
    let month = this.dateConversion.getDateMonth(date);
    let day = this.dateConversion.getDateDay(date);
    let hour = this.dateConversion.getDateHour(date);
    let minutes = this.dateConversion.getDateMinutes(date);
    let seconds = this.dateConversion.getDateSeconds(date);
    let miliseconds = this.dateConversion.getDateMilliseconds(date);
    let random = this.generateRandomString(3);
    let id = `${year}${month}${day}${hour}${minutes}${seconds}${miliseconds}${random}`;
    return id;
  }
  
  /**
   * Commot tooltips (navbar buttons, etc.)
   *
   * @returns {string}
   */
  initTooltips(elm) {
    try {
      const scope = elm instanceof Element ? elm : document;
      const elems = scope.querySelectorAll('.exe-app-tooltip');
      elems.forEach((el) => {
        // Idempotent initialization: only create if not already bound
        const existing = window.bootstrap?.Tooltip?.getInstance
          ? window.bootstrap.Tooltip.getInstance(el)
          : null;
        if (!existing && window.bootstrap?.Tooltip?.getOrCreateInstance) {
          window.bootstrap.Tooltip.getOrCreateInstance(el);
          // Hide on click/mouseleave like previous jQuery behavior
          el.addEventListener('click', () => {
            try { window.bootstrap.Tooltip.getInstance(el)?.hide(); } catch (_) {}
          }, { passive: true });
          el.addEventListener('mouseleave', () => {
            try { window.bootstrap.Tooltip.getInstance(el)?.hide(); } catch (_) {}
          }, { passive: true });
        }
      });
    } catch (_) {
      // Fallback to jQuery plugin if Bootstrap global is not available
      $(".exe-app-tooltip", elm).tooltip();
      $('.exe-app-tooltip', elm).on('click mouseleave', function(){
        $(this).tooltip('hide');
      });
    }
  }

  /**
   * Markdown to HTML converter.
   *
   * LaTeX delimiters (\(...\), \[...\], $$...$$, \begin{...}\end{...}) are
   * stashed before Showdown runs so that markdown processing does not eat
   * underscores, asterisks or backslashes inside formulas. They are restored
   * verbatim afterwards so MathJax can pick them up at render time.
   * Single-dollar inline math ($...$) is normalized to \(...\) because the
   * MathJax configuration shipped with eXeLearning does not enable the $
   * inline delimiter (#1990).
   */
  markdownToHTML(content) {
    var src = String(content == null ? '' : content);
    var store = [];
    var stash = function (match) {
      store.push(match);
      return 'EXELATEXBEGIN' + (store.length - 1) + 'EXELATEXEND';
    };
    [
      /\\\[[\s\S]*?\\\]/g,
      /\$\$[\s\S]*?\$\$/g,
      /\\begin\{[^}]+\}[\s\S]*?\\end\{[^}]+\}/g,
      /\\\([\s\S]*?\\\)/g,
    ].forEach(function (re) {
      src = src.replace(re, stash);
    });
    src = this.normalizeDollarMath(src, stash);

    var converter = new showdown.Converter({
      noHeaderId: true,
      tables: true,
      tasklists: true,
      strikethrough: true,
      disableForced4SpacesIndentedSublists: true,
    });
    var html = converter.makeHtml(src);

    return html.replace(/EXELATEXBEGIN(\d+)EXELATEXEND/g, function (_, i) {
      return store[Number(i)] !== undefined ? store[Number(i)] : _;
    });
  }

  /**
   * Convert single-dollar inline math ($...$) into \(...\) and stash it.
   *
   * Chatbot-generated Markdown commonly delimits inline formulas with single
   * dollars, but the MathJax configuration used by eXeLearning only enables
   * \(...\) for inline math, and Showdown would mangle underscores inside the
   * formula before MathJax could see it (#1990). Pandoc-style rules keep
   * plain dollar amounts out of math mode: the opening $ must be followed by
   * a non-space character, the closing $ must be preceded by a non-space
   * character and must not be followed by a digit, neither may be escaped,
   * and the pair must sit on a single line. Fenced code blocks and inline
   * code spans are left untouched.
   *
   * @param {string} src markdown source (LaTeX already stashed)
   * @param {function(string): string} stashFn stores a formula, returns its placeholder
   * @returns {string}
   */
  normalizeDollarMath(src, stashFn) {
    var fenceRe = /^\s{0,3}(?:`{3,}|~{3,})/;
    var codeSpanRe = /(`+)[\s\S]*?\1/g;
    // A formula is either a single character or first/last characters with a
    // lazy body; the last character may not be a backslash, so an escaped \$
    // before the closing delimiter rejects the pair instead of producing a
    // formula that ends in a stray backslash (a MathJax TeX error).
    var dollarRe = /(^|[^\\$])\$([^\s$\\]|[^\s$][^$\n]*?[^\s$\\])\$(?!\d|\$)/g;
    var convert = function (text) {
      return text.replace(dollarRe, function (match, prefix, formula) {
        return prefix + stashFn('\\(' + formula + '\\)');
      });
    };
    var inFence = false;
    return String(src)
      .split('\n')
      .map(function (line) {
        if (fenceRe.test(line)) {
          inFence = !inFence;
          return line;
        }
        if (inFence || line.indexOf('$') === -1) {
          return line;
        }
        var out = '';
        var last = 0;
        var m;
        codeSpanRe.lastIndex = 0;
        while ((m = codeSpanRe.exec(line)) !== null) {
          out += convert(line.slice(last, m.index)) + m[0];
          last = m.index + m[0].length;
        }
        return out + convert(line.slice(last));
      })
      .join('\n');
  }

  /**
   * Get assets timestamp
   */
  getVersionTimeStamp() {
      const v = eXeLearning.version;
      if (eXeLearning.config.environment == 'dev' || v == "v0.0.0-alpha") return Date.now();
      return v;
  }

  /**
   * Generates a random string
   *
   */
  generateRandomString(length) {
    var result = '';
    var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    var charactersLength = characters.length;
    for (var i = 0; i < length; i++) {
      result += characters.charAt(Math.floor(Math.random() *
        charactersLength));
    }
    return result;
  }

  /**
   * Returns a promise that resolves after "ms" milliseconds
   *
   * @param {*} ms
   */
  timer(ms) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

}
