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
    $(".exe-app-tooltip", elm).tooltip();
    $('.exe-app-tooltip', elm).on('click mouseleave', function(){
        $(this).tooltip('hide');
    });
  }

  /**
   * Markdown to HTML converter
   */
  markdownToHTML(content) {
    var converter = new showdown.Converter();
    converter.setOption('noHeaderId', true);
    return converter.makeHtml(content);
  }

  /**
   * Get assets timestamp
   */
  getVersionTimeStamp() {
      const v = eXeLearning.version;
      if (eXeLearning.symfony.environment == 'dev' || v == "v0.0.0-alpha") return Date.now();
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