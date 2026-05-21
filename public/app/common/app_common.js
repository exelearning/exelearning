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
   */
  markdownToHTML(content) {
    var src = String(content == null ? '' : content);
    var store = [];
    [
      /\\\[[\s\S]*?\\\]/g,
      /\$\$[\s\S]*?\$\$/g,
      /\\begin\{[^}]+\}[\s\S]*?\\end\{[^}]+\}/g,
      /\\\([\s\S]*?\\\)/g,
    ].forEach(function (re) {
      src = src.replace(re, function (match) {
        store.push(match);
        return 'EXELATEXBEGIN' + (store.length - 1) + 'EXELATEXEND';
      });
    });

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
