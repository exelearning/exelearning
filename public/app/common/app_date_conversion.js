export default class DateConversion {

  constructor() {

  }

  /**
   *
   * @param {*} date
   * @return
   */
  getDateYear(date) {
    let year = date.getFullYear();
    return year;
  }

  /**
   *
   * @param {*} date
   * @returns
   */
  getDateMonth(date) {
    let month = date.getMonth() + 1;
    if (month < 10) month = "0" + month;
    return String(month);
  }

  /**
   *
   * @param {*} date
   * @returns
   */
  getDateDay(date) {
    let day = date.getDate();
    if (day < 10) day = "0" + day;
    return String(day);
  }

  /**
   *
   * @param {*} date
   * @returns
   */
  getDateHour(date) {
    let hour = date.getHours();
    if (hour < 10) hour = "0" + hour;
    return String(hour);
  }

  /**
   *
   * @param {*} date
   * @returns
   */
  getDateMinutes(date) {
    let minutes = date.getMinutes();
    if (minutes < 10) minutes = "0" + minutes;
    return String(minutes);
  }

  /**
   *
   * @param {*} date
   * @returns
   */
  getDateSeconds(date) {
    let seconds = date.getSeconds();
    if (seconds < 10) seconds = "0" + seconds;
    return String(seconds);
  }

  /**
   *
   * @param {*} date
   * @returns
   */
  getDateMilliseconds(date) {
    let miliseconds = date.getMilliseconds();
    if (miliseconds < 10) miliseconds = "0" + miliseconds;
    if (miliseconds < 100 || String(miliseconds).length < 3) miliseconds = "0" + miliseconds;
    return String(miliseconds);
  }

}