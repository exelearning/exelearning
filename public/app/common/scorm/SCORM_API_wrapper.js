
/* =====================================================================================
SCORM wrapper v1.1.7 by Philip Hutchison, May 2008 (http://pipwerks.com).
Copyright (c) 2008 Philip Hutchison
MIT-style license. Full license text can be found at
http://www.opensource.org/licenses/mit-license.php
This wrapper is designed to work with both SCORM 1.2 and SCORM 2004.
Based on APIWrapper.js, created by the ADL and Concurrent Technologies
Corporation, distributed by the ADL (http://www.adlnet.gov/scorm).
SCORM.API.find() and SCORM.API.get() functions based on ADL code,
modified by Mike Rustici (http://www.scorm.com/resources/apifinder/SCORMAPIFinder.htm),
further modified by Philip Hutchison
======================================================================================== */


var pipwerks = {}; //pipwerks 'namespace' helps ensure no conflicts with possible other "SCORM" variables
pipwerks.UTILS = {}; //For holding UTILS functions
pipwerks.debug = { isActive: true };  //Enable (true) or disable (false) for debug mode

pipwerks.SCORM = { //Define the SCORM object
  version: null, //Store SCORM version.
  handleCompletionStatus: true, //Whether or not the wrapper should automatically handle the initial completion status
  handleExitMode: true, //Whether or not the wrapper should automatically handle the exit mode
  API: {
    handle: null,
    isFound: false
  }, //Create API child object
  connection: { isActive: false }, //Create connection child object
  data: {
    completionStatus: null,
    exitStatus: null
  }, //Create data child object
  debug: {} //Create debug child object
};
pipwerks.nav = {}; //For holding navigation functions (created for the new eXeLearning)

/* --------------------------------------------------------------------------------
   pipwerks.SCORM.isAvailable
   A simple function to allow Flash ExternalInterface to confirm
   presence of JS wrapper before attempting any LMS communication.
   Parameters: none
   Returns:    Boolean (true)
----------------------------------------------------------------------------------- */

pipwerks.SCORM.isAvailable = function () {
  return true;
};

// ------------------------------------------------------------------------- //
// --- SCORM.API functions ------------------------------------------------- //
// ------------------------------------------------------------------------- //


/* -------------------------------------------------------------------------
   pipwerks.SCORM.API.find(window)
   Looks for an object named API in parent and opener windows

   Parameters: window (the browser window object).
   Returns:    Object if API is found, null if no API found
---------------------------------------------------------------------------- */

pipwerks.SCORM.API.find = function (win) {

  var API = null,
    findAttempts = 0,
    findAttemptLimit = 500,
    traceMsgPrefix = "SCORM.API.find",
    trace = pipwerks.UTILS.trace,
    scorm = pipwerks.SCORM;

  while ((!win.API && !win.API_1484_11) &&
    (win.parent) &&
    (win.parent != win) &&
    (findAttempts <= findAttemptLimit)) {

    findAttempts++;
    win = win.parent;
  }

  if (scorm.version) { //If SCORM version is specified by user, look for specific API
    switch (scorm.version) {
      case "2004":
        if (win.API_1484_11) {
          API = win.API_1484_11;
        } else {
          trace(traceMsgPrefix + ": SCORM version 2004 was specified by user, but API_1484_11 cannot be found.");
        }

        break;

      case "1.2":
        if (win.API) {
          API = win.API;
        } else {
          trace(traceMsgPrefix + ": SCORM version 1.2 was specified by user, but API cannot be found.");
        }

        break;
    }
  } else { //If SCORM version not specified by user, look for APIs
    if (win.API_1484_11) { //SCORM 2004-specific API.
      scorm.version = "2004"; //Set version
      API = win.API_1484_11;
    } else if (win.API) { //SCORM 1.2-specific API
      scorm.version = "1.2"; //Set version
      API = win.API;
    }
  }
  if (API) {
    trace(traceMsgPrefix + ": API found. Version: " + scorm.version);
    trace("API: " + API);

  } else {
    trace(traceMsgPrefix + ": Error finding API. \nFind attempts: " + findAttempts + ". \nFind attempt limit: " + findAttemptLimit);
  }

  return API;
};


/* -------------------------------------------------------------------------
   pipwerks.SCORM.API.get()
   Looks for an object named API, first in the current window's frame
   hierarchy and then, if necessary, in the current window's opener window
   hierarchy (if there is an opener window).
   Parameters:  None.
   Returns:     Object if API found, null if no API found
---------------------------------------------------------------------------- */

pipwerks.SCORM.API.get = function () {
  var API = null,
    win = window,
    find = pipwerks.SCORM.API.find,
    trace = pipwerks.UTILS.trace;

  if (win.parent && win.parent != win) {
    API = find(win.parent);
  }

  if (!API && win.top.opener) {
    API = find(win.top.opener);
  }

  if (API) {
    pipwerks.SCORM.API.isFound = true;
  } else {
    trace("API.get failed: Can't find the API!");
  }
  return API;
};


/* -------------------------------------------------------------------------
   pipwerks.SCORM.API.getHandle()
   Returns the handle to API object if it was previously set
   Parameters:  None.
   Returns:     Object (the pipwerks.SCORM.API.handle variable).
---------------------------------------------------------------------------- */

pipwerks.SCORM.API.getHandle = function () {
  var API = pipwerks.SCORM.API;

  if (!API.handle && !API.isFound) {
    API.handle = API.get();
  }
  return API.handle;
};



// ------------------------------------------------------------------------- //
// --- pipwerks.SCORM.connection functions --------------------------------- //
// ------------------------------------------------------------------------- //


/* -------------------------------------------------------------------------
   pipwerks.SCORM.connection.initialize()
   Tells the LMS to initiate the communication session.
   Parameters:  None
   Returns:     Boolean
---------------------------------------------------------------------------- */

pipwerks.SCORM.connection.initialize = function () {
  var success = false,
    scorm = pipwerks.SCORM,
    completionStatus = pipwerks.SCORM.data.completionStatus,
    trace = pipwerks.UTILS.trace,
    makeBoolean = pipwerks.UTILS.StringToBoolean,
    debug = pipwerks.SCORM.debug,
    traceMsgPrefix = "SCORM.connection.initialize ";

  trace("connection.initialize called.");

  if (!scorm.connection.isActive) {

    var API = scorm.API.getHandle(),
      errorCode = 0;

    if (API) {

      switch (scorm.version) {
        case "1.2": success = makeBoolean(API.LMSInitialize("")); break;
        case "2004": success = makeBoolean(API.Initialize("")); break;
      }

      if (success) {

        //Double-check that connection is active and working before returning 'true' boolean
        errorCode = debug.getCode();

        if (errorCode !== null && errorCode === 0) {

          scorm.connection.isActive = true;

          if (scorm.handleCompletionStatus) {

            //Automatically set new launches to incomplete
            completionStatus = pipwerks.SCORM.status("get");

            if (completionStatus) {

              switch (completionStatus) {

                // Both SCORM 1.2 and 2004
                case "not attempted": pipwerks.SCORM.status("set", "incomplete"); break;

                // SCORM 2004 only
                case "unknown": pipwerks.SCORM.status("set", "incomplete"); break;

                //Additional options, presented here in case you'd like to use them
                //case "completed"  : break;
                //case "incomplete" : break;
                //case "passed"     : break; //SCORM 1.2 only
                //case "failed"     : break; //SCORM 1.2 only
                //case "browsed"    : break; //SCORM 1.2 only
              }

            }

          }

        } else {

          success = false;
          trace(traceMsgPrefix + "failed. \nError code: " + errorCode + " \nError info: " + debug.getInfo(errorCode));

        }

      } else {

        errorCode = debug.getCode();

        if (errorCode !== null && errorCode !== 0) {

          trace(traceMsgPrefix + "failed. \nError code: " + errorCode + " \nError info: " + debug.getInfo(errorCode));

        } else {

          trace(traceMsgPrefix + "failed: No response from server.");

        }
      }

    } else {

      trace(traceMsgPrefix + "failed: API is null.");

    }

  } else {
    // return true if connection is already active.
    success = true;
    trace(traceMsgPrefix + "aborted: Connection already active.");

  }

  return success;

};


/* -------------------------------------------------------------------------
   pipwerks.SCORM.connection.terminate()
   Tells the LMS to terminate the communication session
   Parameters:  None
   Returns:     Boolean
---------------------------------------------------------------------------- */

pipwerks.SCORM.connection.terminate = function () {

  var success = false,
    scorm = pipwerks.SCORM,
    exitStatus = pipwerks.SCORM.data.exitStatus,
    completionStatus = pipwerks.SCORM.data.completionStatus,
    trace = pipwerks.UTILS.trace,
    makeBoolean = pipwerks.UTILS.StringToBoolean,
    debug = pipwerks.SCORM.debug,
    traceMsgPrefix = "SCORM.connection.terminate ";


  if (scorm.connection.isActive) {

    var API = scorm.API.getHandle(),
      errorCode = 0;

    if (API) {

      if (scorm.handleExitMode && !exitStatus) {

        if (completionStatus !== "completed" && completionStatus !== "passed") {

          switch (scorm.version) {
            case "1.2": success = scorm.set("cmi.core.exit", "suspend"); break;
            case "2004": success = scorm.set("cmi.exit", "suspend"); break;
          }

        } else {

          switch (scorm.version) {
            case "1.2": success = scorm.set("cmi.core.exit", "logout"); break;
            case "2004": success = scorm.set("cmi.exit", "normal"); break;
          }

        }

      }

      switch (scorm.version) {
        case "1.2": success = makeBoolean(API.LMSFinish("")); break;
        case "2004": success = makeBoolean(API.Terminate("")); break;
      }

      if (success) {

        scorm.connection.isActive = false;

      } else {

        errorCode = debug.getCode();
        trace(traceMsgPrefix + "failed. \nError code: " + errorCode + " \nError info: " + debug.getInfo(errorCode));

      }

    } else {

      trace(traceMsgPrefix + "failed: API is null.");

    }

  } else {

    trace(traceMsgPrefix + "aborted: Connection already terminated.");

  }

  return success;

};



// ------------------------------------------------------------------------- //
// --- pipwerks.SCORM.data functions --------------------------------------- //
// ------------------------------------------------------------------------- //


/* -------------------------------------------------------------------------
   pipwerks.SCORM.data.get(parameter)
   Requests information from the LMS.
   Parameter: parameter (string, name of the SCORM data model element)
   Returns:   string (the value of the specified data model element)
---------------------------------------------------------------------------- */

pipwerks.SCORM.data.get = function (parameter) {

  var value = null,
    scorm = pipwerks.SCORM,
    trace = pipwerks.UTILS.trace,
    debug = pipwerks.SCORM.debug,
    traceMsgPrefix = "SCORM.data.get(" + parameter + ") ";

  if (scorm.connection.isActive) {

    var API = scorm.API.getHandle(),
      errorCode = 0;

    if (API) {

      switch (scorm.version) {
        case "1.2": value = API.LMSGetValue(parameter); break;
        case "2004": value = API.GetValue(parameter); break;
      }

      errorCode = debug.getCode();

      //GetValue returns an empty string on errors
      //Double-check errorCode to make sure empty string
      //is really an error and not field value
      if (value !== "" && errorCode === 0) {

        switch (parameter) {

          case "cmi.core.lesson_status":
          case "cmi.completion_status": scorm.data.completionStatus = value; break;

          case "cmi.core.exit":
          case "cmi.exit": scorm.data.exitStatus = value; break;

        }

      } else {

        trace(traceMsgPrefix + "failed. \nError code: " + errorCode + "\nError info: " + debug.getInfo(errorCode));

      }

    } else {

      trace(traceMsgPrefix + "failed: API is null.");

    }

  } else {

    trace(traceMsgPrefix + "failed: API connection is inactive.");

  }

  trace(traceMsgPrefix + " value: " + value);

  return String(value);

};


/* -------------------------------------------------------------------------
   pipwerks.SCORM.data.set()
   Tells the LMS to assign the value to the named data model element.
   Also stores the SCO's completion status in a variable named
   pipwerks.SCORM.data.completionStatus. This variable is checked whenever
   pipwerks.SCORM.connection.terminate() is invoked.
   Parameters: parameter (string). The data model element
               value (string). The value for the data model element
   Returns:    Boolean
---------------------------------------------------------------------------- */

pipwerks.SCORM.data.set = function (parameter, value) {

  var success = false,
    scorm = pipwerks.SCORM,
    trace = pipwerks.UTILS.trace,
    makeBoolean = pipwerks.UTILS.StringToBoolean,
    debug = pipwerks.SCORM.debug,
    traceMsgPrefix = "SCORM.data.set(" + parameter + ") ";


  if (scorm.connection.isActive) {

    var API = scorm.API.getHandle(),
      errorCode = 0;

    if (API) {

      switch (scorm.version) {
        case "1.2": success = makeBoolean(API.LMSSetValue(parameter, value)); break;
        case "2004": success = makeBoolean(API.SetValue(parameter, value)); break;
      }

      if (success) {

        if (parameter === "cmi.core.lesson_status" || parameter === "cmi.completion_status") {

          scorm.data.completionStatus = value;

        }

      } else {

        trace(traceMsgPrefix + "failed. \nError code: " + errorCode + ". \nError info: " + debug.getInfo(errorCode));

      }

    } else {

      trace(traceMsgPrefix + "failed: API is null.");

    }

  } else {

    trace(traceMsgPrefix + "failed: API connection is inactive.");

  }

  return success;

};


/* -------------------------------------------------------------------------
   pipwerks.SCORM.data.save()
   Instructs the LMS to persist all data to this point in the session
   Parameters: None
   Returns:    Boolean
---------------------------------------------------------------------------- */

pipwerks.SCORM.data.save = function () {

  var success = false,
    scorm = pipwerks.SCORM,
    trace = pipwerks.UTILS.trace,
    makeBoolean = pipwerks.UTILS.StringToBoolean,
    traceMsgPrefix = "SCORM.data.save failed";


  if (scorm.connection.isActive) {

    var API = scorm.API.getHandle();

    if (API) {

      switch (scorm.version) {
        case "1.2": success = makeBoolean(API.LMSCommit("")); break;
        case "2004": success = makeBoolean(API.Commit("")); break;
      }

    } else {

      trace(traceMsgPrefix + ": API is null.");

    }

  } else {

    trace(traceMsgPrefix + ": API connection is inactive.");

  }

  return success;

};

pipwerks.SCORM.status = function (action, status) {
  var success = false,
    scorm = pipwerks.SCORM,
    trace = pipwerks.UTILS.trace,
    traceMsgPrefix = "SCORM.getStatus failed",
    cmi = "";

  if (action !== null) {

    switch (scorm.version) {
      case "1.2": cmi = "cmi.core.lesson_status"; break;
      case "2004": cmi = "cmi.completion_status"; break;
    }

    switch (action) {

      case "get": success = pipwerks.SCORM.data.get(cmi); break;

      case "set": if (status !== null) {

        success = pipwerks.SCORM.data.set(cmi, status);

      } else {
        success = false;
        trace(traceMsgPrefix + ": status was not specified.");
      }

        break;

      default: success = false;
        trace(traceMsgPrefix + ": no valid action was specified.");

    }

  } else {

    trace(traceMsgPrefix + ": action was not specified.");

  }

  return success;

};


// ------------------------------------------------------------------------- //
// --- pipwerks.SCORM.debug functions -------------------------------------- //
// ------------------------------------------------------------------------- //


/* -------------------------------------------------------------------------
   pipwerks.SCORM.debug.getCode
   Requests the error code for the current error state from the LMS
   Parameters: None
   Returns:    Integer (the last error code).
---------------------------------------------------------------------------- */

pipwerks.SCORM.debug.getCode = function () {

  var API = pipwerks.SCORM.API.getHandle(),
    scorm = pipwerks.SCORM,
    trace = pipwerks.UTILS.trace,
    code = 0;

  if (API) {

    switch (scorm.version) {
      case "1.2": code = parseInt(API.LMSGetLastError(), 10); break;
      case "2004": code = parseInt(API.GetLastError(), 10); break;
    }

  } else {

    trace("SCORM.debug.getCode failed: API is null.");

  }

  return code;

};


/* -------------------------------------------------------------------------
   pipwerks.SCORM.debug.getInfo()
   "Used by a SCO to request the textual description for the error code
   specified by the value of [errorCode]."
   Parameters: errorCode (integer).
   Returns:    String.
----------------------------------------------------------------------------- */

pipwerks.SCORM.debug.getInfo = function (errorCode) {

  var API = pipwerks.SCORM.API.getHandle(),
    scorm = pipwerks.SCORM,
    trace = pipwerks.UTILS.trace,
    result = "";


  if (API) {

    switch (scorm.version) {
      case "1.2": result = API.LMSGetErrorString(errorCode.toString()); break;
      case "2004": result = API.GetErrorString(errorCode.toString()); break;
    }

  } else {
    trace("SCORM.debug.getInfo failed: API is null.");
  }

  return String(result);
};


/* -------------------------------------------------------------------------
   pipwerks.SCORM.debug.getDiagnosticInfo
   "Exists for LMS specific use. It allows the LMS to define additional
   diagnostic information through the API Instance."
   Parameters: errorCode (integer).
   Returns:    String (Additional diagnostic information about the given error code).
---------------------------------------------------------------------------- */

pipwerks.SCORM.debug.getDiagnosticInfo = function (errorCode) {

  var API = pipwerks.SCORM.API.getHandle(),
    scorm = pipwerks.SCORM,
    trace = pipwerks.UTILS.trace,
    result = "";

  if (API) {
    switch (scorm.version) {
      case "1.2": result = API.LMSGetDiagnostic(errorCode); break;
      case "2004": result = API.GetDiagnostic(errorCode); break;
    }
  } else {
    trace("SCORM.debug.getDiagnosticInfo failed: API is null.");
  }
  return String(result);
};


// ------------------------------------------------------------------------- //
// --- Shortcuts! ---------------------------------------------------------- //
// ------------------------------------------------------------------------- //

// Because nobody likes typing verbose code.
pipwerks.SCORM.init = pipwerks.SCORM.connection.initialize;
pipwerks.SCORM.get = pipwerks.SCORM.data.get;
pipwerks.SCORM.set = pipwerks.SCORM.data.set;
pipwerks.SCORM.save = pipwerks.SCORM.data.save;
pipwerks.SCORM.quit = pipwerks.SCORM.connection.terminate;



// ------------------------------------------------------------------------- //
// --- pipwerks.UTILS functions -------------------------------------------- //
// ------------------------------------------------------------------------- //

/* -------------------------------------------------------------------------
   pipwerks.UTILS.StringToBoolean()
   Converts 'boolean strings' into actual valid booleans.

   (Most values returned from the API are the strings "true" and "false".)
   Parameters: String
   Returns:    Boolean
---------------------------------------------------------------------------- */

pipwerks.UTILS.StringToBoolean = function (string) {
  if (typeof (string) == 'undefined') return false;
  string = string.toString();
  switch (string.toLowerCase()) {
    case "true": case "yes": case "1": return true;
    case "false": case "no": case "0": case null: return false;
    default: return Boolean(string);
  }
};



/* -------------------------------------------------------------------------
   pipwerks.UTILS.trace()
   Displays error messages when in debug mode.
   Parameters: msg (string)
   Return:     None
---------------------------------------------------------------------------- */

pipwerks.UTILS.trace = function (msg) {

  if (pipwerks.debug.isActive) {

    //Firefox users can use the 'Firebug' extension's console.
    if (window.console && window.console.firebug) {
      console.log(msg);
    } else {
      //alert(msg);
    }

  }
};


// ------------------------------------------------------------------------- //
// --- pipwerks.UTILS.convertTotalMiliSeconds ------------------------------ //
// --- developed for The new eXeLearning ----------------------------------- //
// --- Converts time in miliseconds to tha appropiate string format -------- //
// --- depending on SCORM12 or SCORM 2004 runtime environment       -------- //
// --- Author: José Miguel Andonegi: jm.andonegi@gmail.com     ------------- //
// ------------------------------------------------------------------------- //
pipwerks.UTILS.convertTotalMiliSeconds = function (intTotalMilliseconds) {
  var API = pipwerks.SCORM.API.getHandle(),
    scorm = pipwerks.SCORM,
    trace = pipwerks.UTILS.trace,
    result = "";

  if (API) {

    switch (scorm.version) {
      case "1.2": result = pipwerks.UTILS.convertTotalMiliSecondsSCORM12(intTotalMilliseconds, true); break;
      case "2004": result = pipwerks.UTILS.convertTotalMiliSecondsSCORM2004(intTotalMilliseconds); break;
    }
  }
  else {
    trace("pipwerks.SCORM.GetCompletionStatus failed: API is null.");
  }

  return String(result);
};

/*
Source code created by Rustici Software, LLC is licensed under a
Creative Commons Attribution 3.0 United States License
(http://creativecommons.org/licenses/by/3.0/us/)
*/
pipwerks.UTILS.convertTotalMiliSecondsSCORM12 = function (intTotalMilliseconds, blnIncludeFraction) {
  var intHours;
  var intintMinutes;
  var intSeconds;
  var intMilliseconds;
  var intHundredths;
  var strCMITimeSpan;

  if (blnIncludeFraction == null || blnIncludeFraction == undefined) {
    blnIncludeFraction = true;
  }

  //extract time parts
  intMilliseconds = intTotalMilliseconds % 1000;
  intSeconds = ((intTotalMilliseconds - intMilliseconds) / 1000) % 60;
  intMinutes = ((intTotalMilliseconds - intMilliseconds - (intSeconds * 1000)) / 60000) % 60;
  intHours = (intTotalMilliseconds - intMilliseconds - (intSeconds * 1000) - (intMinutes * 60000)) / 3600000;

  /*
  deal with exceptional case when content used a huge amount of time and interpreted CMITimstamp
  to allow a number of intMinutes and seconds greater than 60 i.e. 9999:99:99.99 instead of 9999:60:60:99
  note - this case is permissable under SCORM, but will be exceptionally rare
  */

  if (intHours == 10000) {
    intHours = 9999;
    intMinutes = (intTotalMilliseconds - (intHours * 3600000)) / 60000;
    if (intMinutes == 100) {
      intMinutes = 99;
    }
    intMinutes = Math.floor(intMinutes);
    intSeconds = (intTotalMilliseconds - (intHours * 3600000) - (intMinutes * 60000)) / 1000;
    if (intSeconds == 100) {
      intSeconds = 99;
    }
    intSeconds = Math.floor(intSeconds);
    intMilliseconds = (intTotalMilliseconds - (intHours * 3600000) - (intMinutes * 60000) - (intSeconds * 1000));
  }

  //drop the extra precision from the milliseconds
  intHundredths = Math.floor(intMilliseconds / 10);

  //put in padding 0's and concatinate to get the proper format
  strCMITimeSpan = pipwerks.UTILS.ZeroPad(intHours, 4) + ":" + pipwerks.UTILS.ZeroPad(intMinutes, 2) + ":" + pipwerks.UTILS.ZeroPad(intSeconds, 2);

  if (blnIncludeFraction) {
    strCMITimeSpan += "." + intHundredths;
  }

  //check for case where total milliseconds is greater than max supported by strCMITimeSpan
  if (intHours > 9999) {
    strCMITimeSpan = "9999:99:99";
    if (blnIncludeFraction) {
      strCMITimeSpan += ".99";
    }
  }
  return strCMITimeSpan;
};

/*
Source code created by Rustici Software, LLC is licensed under a
Creative Commons Attribution 3.0 United States License
(http://creativecommons.org/licenses/by/3.0/us/)
*/
pipwerks.UTILS.ZeroPad = function (intNum, intNumDigits) {
  var strTemp;
  var intLen;
  var i;

  strTemp = new String(intNum);
  intLen = strTemp.length;

  if (intLen > intNumDigits) {
    strTemp = strTemp.substr(0, intNumDigits);
  }
  else {
    for (i = intLen; i < intNumDigits; i++) {
      strTemp = "0" + strTemp;
    }
  }

  return strTemp;
};

/*
Source code created by Rustici Software, LLC is licensed under a
Creative Commons Attribution 3.0 United States License
(http://creativecommons.org/licenses/by/3.0/us/)
*/
pipwerks.UTILS.convertTotalMiliSecondsSCORM2004 = function (intTotalMilliseconds) {
  var ScormTime = "";
  var HundredthsOfASecond;	//decrementing counter - work at the hundreths of a second level because that is all the precision that is required
  var Seconds;	// 100 hundreths of a seconds
  var Minutes;	// 60 seconds
  var Hours;		// 60 minutes
  var Days;		// 24 hours
  var Months;		// assumed to be an "average" month (figures a leap year every 4 years) = ((365*4) + 1) / 48 days - 30.4375 days per month
  var Years;		// assumed to be 12 "average" months
  var HUNDREDTHS_PER_SECOND = 100;
  var HUNDREDTHS_PER_MINUTE = HUNDREDTHS_PER_SECOND * 60;
  var HUNDREDTHS_PER_HOUR = HUNDREDTHS_PER_MINUTE * 60;
  var HUNDREDTHS_PER_DAY = HUNDREDTHS_PER_HOUR * 24;
  var HUNDREDTHS_PER_MONTH = HUNDREDTHS_PER_DAY * (((365 * 4) + 1) / 48);
  var HUNDREDTHS_PER_YEAR = HUNDREDTHS_PER_MONTH * 12;

  HundredthsOfASecond = Math.floor(intTotalMilliseconds / 10);

  Years = Math.floor(HundredthsOfASecond / HUNDREDTHS_PER_YEAR);
  HundredthsOfASecond -= (Years * HUNDREDTHS_PER_YEAR);

  Months = Math.floor(HundredthsOfASecond / HUNDREDTHS_PER_MONTH);
  HundredthsOfASecond -= (Months * HUNDREDTHS_PER_MONTH);

  Days = Math.floor(HundredthsOfASecond / HUNDREDTHS_PER_DAY);
  HundredthsOfASecond -= (Days * HUNDREDTHS_PER_DAY);

  Hours = Math.floor(HundredthsOfASecond / HUNDREDTHS_PER_HOUR);
  HundredthsOfASecond -= (Hours * HUNDREDTHS_PER_HOUR);

  Minutes = Math.floor(HundredthsOfASecond / HUNDREDTHS_PER_MINUTE);
  HundredthsOfASecond -= (Minutes * HUNDREDTHS_PER_MINUTE);

  Seconds = Math.floor(HundredthsOfASecond / HUNDREDTHS_PER_SECOND);
  HundredthsOfASecond -= (Seconds * HUNDREDTHS_PER_SECOND);

  if (Years > 0) {
    ScormTime += Years + "Y";
  }
  if (Months > 0) {
    ScormTime += Months + "M";
  }
  if (Days > 0) {
    ScormTime += Days + "D";
  }

  //check to see if we have any time before adding the "T"
  if ((HundredthsOfASecond + Seconds + Minutes + Hours) > 0) {

    ScormTime += "T";
    if (Hours > 0) {
      ScormTime += Hours + "H";
    }
    if (Minutes > 0) {
      ScormTime += Minutes + "M";
    }
    if ((HundredthsOfASecond + Seconds) > 0) {
      ScormTime += Seconds;

      if (HundredthsOfASecond > 0) {
        ScormTime += "." + HundredthsOfASecond;
      }
      ScormTime += "S";
    }
  }
  if (ScormTime == "") {
    ScormTime = "0S";
  }
  ScormTime = "P" + ScormTime;
  return ScormTime;
};

// ------------------------------------------------------------------------- //
// --- SCORM.data wrapping functions --------------------------------------- //
// --- developed for The new eXeLearning ----------------------------------- //
// --- Author: José Miguel Andonegi: jm.andonegi@gmail.com     ------------- //
// ------------------------------------------------------------------------- //

// ------------------------------------------------------------------------- //
// The functions are ordered alphabetichaly by element's name in 2004 API--- //
// ------------------------------------------------------------------------- //

/* --------------------------------------------------------------------------------
// cmi._version: Represents the version of the data model. (read-only)
/* --------------------------------------------------------------------------------
   pipwerks.SCORM.GetDataModelVersion
   Parameters: none
   Returns:    String
----------------------------------------------------------------------------------- */
pipwerks.SCORM.GetDataModelVersion = function () {
  var API = pipwerks.SCORM.API.getHandle(),
    scorm = pipwerks.SCORM,
    trace = pipwerks.UTILS.trace,
    result = "";

  if (API) {
    result = scorm.get("cmi._version");
  }
  else {
    trace("pipwerks.SCORM.GetDataModelVersion failed: API is null.");
  }

  return String(result);
};

// cmi.comments_from_learner: Contains text from the learner. (pending wrapper function developement)
// cmi.comments_from_lms: Contains comments and annotations intended to be made available to the learner. (pending wrapper function developement)

/* --------------------------------------------------------------------------------
// cmi.completion_status: Indicates whether the learner has completed the SCO
/* --------------------------------------------------------------------------------
   pipwerks.SCORM.GetStatus
   Parameters: none
   Returns:    String
----------------------------------------------------------------------------------- */
pipwerks.SCORM.GetCompletionStatus = function () {
  var API = pipwerks.SCORM.API.getHandle(),
    scorm = pipwerks.SCORM,
    trace = pipwerks.UTILS.trace,
    result = "";

  if (API) {

    switch (scorm.version) {
      case "1.2": result = scorm.get("cmi.core.lesson_status"); break;
      case "2004": result = scorm.get("cmi.completion_status"); break;
    }
  }
  else {
    trace("pipwerks.SCORM.GetCompletionStatus failed: API is null.");
  }

  return String(result);
};

/* --------------------------------------------------------------------------------
// cmi.completion_status: Indicates whether the learner has completed the SCO
/* --------------------------------------------------------------------------------
   pipwerks.SCORM.SetCompletionStatus
   Parameters: status (string)
   Returns:    none
----------------------------------------------------------------------------------- */

pipwerks.SCORM.SetCompletionStatus = function (status) {
  var API = pipwerks.SCORM.API.getHandle(),
    scorm = pipwerks.SCORM,
    trace = pipwerks.UTILS.trace,
    result = "";

  if (API) {
    // Check the value
    switch (status) {
      case "completed": break;
      case "incomplete": break;
      case "not attempted": break;
      case "unknown": if (scorm.version == "1.2") { status = "not attempted"; } break; // "unknown" is only valid for 2004
      case "browsed": if (scorm.version == "2004") { status = "incomplete"; } break; // "browsed" is only valid for 1.2
      default: trace("pipwerks.SCORM.SetCompletionStatus failed: status value is not valid."); return;
    }
    switch (scorm.version) {
      case "1.2": result = scorm.set("cmi.core.lesson_status", status); break;
      case "2004": result = scorm.set("cmi.completion_status", status); break;
    }
  }
  else {
    trace("pipwerks.SCORM.SetCompletionStatus failed: API is null.");
  }
};


/* --------------------------------------------------------------------------------
// cmi.completion_status: Indicates whether the learner has completed the Activity SCORM
/* --------------------------------------------------------------------------------
   pipwerks.SCORM.SetCompletionScormActivity
   Parameters: status (string)
   Returns:    none
----------------------------------------------------------------------------------- */

pipwerks.SCORM.SetCompletionScormActivity = function (status) {
  var API = pipwerks.SCORM.API.getHandle(),
    scorm = pipwerks.SCORM,
    trace = pipwerks.UTILS.trace,
    result = "";

  if (API) {
    switch (scorm.version) {
      case "1.2":
        result = scorm.set("cmi.core.lesson_status", status);
        break;
      case "2004":
        // If we finish the activity it will be complete, even if it is incorrectly.
        // To indicate if it is correct in scorm 2004 we have sucess_status.
        result = scorm.set("cmi.completion_status", "completed");
        break;
    }
  }
  else {
    trace("pipwerks.SCORM.SetCompletionStatus failed: API is null.");
  }
};


// cmi.completion_threshold: Identifies a value against which the measure of the progress the learner has made toward completing the SCO can be compared to determine whether the SCO should be considered completed. (pending wrapper function developement)
// cmi.credit: Indicates whether the learner will be credited for performance in this SCO. (pending wrapper function developement)
// cmi.entry: Contains information that asserts whether the learner has previously accessed the SCO. (pending wrapper function developement)


/* --------------------------------------------------------------------------------
// cmi.exit: Indicates how or why the learner left the SCO.
/* --------------------------------------------------------------------------------
   pipwerks.SCORM.GetExit
   Parameters: none
   Returns:    String
----------------------------------------------------------------------------------- */
pipwerks.SCORM.GetExit = function () {
  var API = pipwerks.SCORM.API.getHandle(),
    scorm = pipwerks.SCORM,
    trace = pipwerks.UTILS.trace,
    result = "";

  if (API) {
    switch (scorm.version) {
      case "1.2": result = scorm.get("cmi.core.exit"); break;
      case "2004": result = scorm.get("cmi.exit"); break;
    }
  }
  else {
    trace("pipwerks.SCORM.GetExit failed: API is null.");
  }

  return String(result);
};

/* --------------------------------------------------------------------------------
// cmi.exit: Indicates how or why the learner left the SCO.
/* --------------------------------------------------------------------------------
   pipwerks.SCORM.SetExit
   Parameters: status (string)
   Returns:    none
----------------------------------------------------------------------------------- */
pipwerks.SCORM.SetExit = function (exit) {
  var API = pipwerks.SCORM.API.getHandle(),
    scorm = pipwerks.SCORM,
    trace = pipwerks.UTILS.trace,
    result = "";

  if (API) {
    // Check the value
    switch (exit) {
      case "time-out": break;
      case "suspend": break;
      case "logout": break;
      case "": break;
      case "normal": if (scorm.version == "1.2") { exit = ""; } break; // "normal" is only valid for 2004
      default: trace("pipwerks.SCORM.SetExit failed: exit value is not valid."); return;
    }
    switch (scorm.version) {
      case "1.2": result = scorm.set("cmi.core.exit", exit); break;
      case "2004": result = scorm.set("cmi.exit", exit); break;
    }
  }
  else {
    trace("pipwerks.SCORM.SetExit failed: API is null.");
  }
};


/* --------------------------------------------------------------------------------
// cmi.interactions: Defines information pertaining to an interaction for the purpose of measurement or assessment.
/* --------------------------------------------------------------------------------
   pipwerks.SCORM.GetInteractionValue
   Parameters:	key (string): must be provided following 1.2 notation. Translation to 2004 notation will be performed if required
   Returns:    String
----------------------------------------------------------------------------------- */
pipwerks.SCORM.GetInteractionValue = function (key) {
  var API = pipwerks.SCORM.API.getHandle(),
    scorm = pipwerks.SCORM,
    trace = pipwerks.UTILS.trace,
    result = "";

  if (API) {
    switch (scorm.version) {
      case "1.2": result = scorm.get(key); break;
      case "2004":
        // Just replace
        key = key.replace("student", "learner");
        result = scorm.get(key);
        break;
    }
  }
  else {
    trace("pipwerks.SCORM.GetInteractionValue failed: API is null.");
  }
  return String(result);
};

/* --------------------------------------------------------------------------------
// cmi.interactions: Defines information pertaining to an interaction for the purpose of measurement or assessment.
/* --------------------------------------------------------------------------------
   pipwerks.SCORM.SetInteractionValue
   Parameters:	key (string): must be provided following 1.2 notation. Translation to 2004 notation will be performed if required
        value (string): must be provided following 1.2 notation. Translation to 2004 notation will be performed if required
   Returns:    none
----------------------------------------------------------------------------------- */
pipwerks.SCORM.SetInteractionValue = function (key, value) {
  var API = pipwerks.SCORM.API.getHandle(),
    scorm = pipwerks.SCORM,
    trace = pipwerks.UTILS.trace,
    result = "";

  if (API) {
    switch (scorm.version) {
      case "1.2": result = scorm.set(key, value); break;
      case "2004":
        // Just replace
        key = key.replace("student", "learner");
        if (value == "wrong") value = "incorrect";
        result = scorm.set(key, value);
        break;
    }
  }
  else {
    trace("pipwerks.SCORM.SetInteractionValue failed: API is null.");
  }
};


// cmi.launch_data: Provides data specific to a SCO that the SCO can use for initialization.

/* --------------------------------------------------------------------------------
// cmi.learner_id: Identifies the learner on behalf of whom the SCO instance was launched. (read-only)
/* --------------------------------------------------------------------------------
   pipwerks.SCORM.GetLearnerId
   Parameters: none
   Returns:    Long interger
----------------------------------------------------------------------------------- */
pipwerks.SCORM.GetLearnerId = function () {
  var API = pipwerks.SCORM.API.getHandle(),
    scorm = pipwerks.SCORM,
    trace = pipwerks.UTILS.trace,
    result = "";

  if (API) {
    switch (scorm.version) {
      case "1.2": result = scorm.get("cmi.core.student_id"); break;
      case "2004": result = scorm.get("cmi.learner_id"); break;
    }
  }
  else {
    trace("pipwerks.SCORM.GetLearnerId failed: API is null.");
  }

  return result; // Value should be a long integer
};

/* --------------------------------------------------------------------------------
// cmi.learner_name: Represents the name of the learner. (read-only)
/* --------------------------------------------------------------------------------
   pipwerks.SCORM.GetLearnerName
   Parameters: none
   Returns:    String
----------------------------------------------------------------------------------- */
pipwerks.SCORM.GetLearnerName = function () {
  var API = pipwerks.SCORM.API.getHandle(),
    scorm = pipwerks.SCORM,
    trace = pipwerks.UTILS.trace,
    result = "";

  if (API) {
    switch (scorm.version) {
      case "1.2": result = scorm.get("cmi.core.student_name"); break;
      case "2004": result = scorm.get("cmi.learner_name"); break;
    }
  }
  else {
    trace("pipwerks.SCORM.GetLearnerName failed: API is null.");
  }

  return String(result);
};

// cmi.learner_preference: Specifies learner preferences associated with the learner’s use of the SCO.
// cmi.location: Represents a location in the SCO.
// cmi.max_time_allowed: Indicates the amount of accumulated time the learner is allowed to use a SCO in the learner attempt.

/* --------------------------------------------------------------------------------
// cmi.mode: Identifies the modes in which the SCO may be presented to the learner.
/* --------------------------------------------------------------------------------
   pipwerks.SCORM.GetMode
   Parameters: none
   Returns:    String
----------------------------------------------------------------------------------- */
pipwerks.SCORM.GetMode = function () {
  var API = pipwerks.SCORM.API.getHandle(),
    scorm = pipwerks.SCORM,
    trace = pipwerks.UTILS.trace,
    result = "";

  if (API) {

    switch (scorm.version) {
      case "1.2": result = scorm.get("cmi.core.lesson_mode"); break;
      case "2004": result = scorm.get("cmi.mode"); break;
    }
  }
  else {
    trace("pipwerks.SCORM.GetMode failed: API is null.");
  }

  return String(result);
};

/* --------------------------------------------------------------------------------
// cmi.mode: Identifies the modes in which the SCO may be presented to the learner.
/* --------------------------------------------------------------------------------
   pipwerks.SCORM.SetMode
   Parameters: mode (string)
   Returns:    none
----------------------------------------------------------------------------------- */
pipwerks.SCORM.SetMode = function (mode) {
  var API = pipwerks.SCORM.API.getHandle(),
    scorm = pipwerks.SCORM,
    trace = pipwerks.UTILS.trace,
    result = "";

  if (API) {
    // Check the value
    switch (mode) {
      case "browse": break;
      case "normal": break;
      case "review": break;
      default: trace("pipwerks.SCORM.SetMode failed: mode value is not valid."); return;
    }
    switch (scorm.version) {
      case "1.2": result = scorm.set("cmi.core.lesson_mode", mode); break;
      case "2004": result = scorm.set("cmi.mode", mode); break;
    }
  }
  else {
    trace("pipwerks.SCORM.SetMode failed: API is null.");
  }
};

// cmi.objectives: Specifies learning or performance objectives associated with a SCO. (pending wrapper function developement)
// cmi.progress_measure: Identifies a measure of the progress the learner has made toward completing the SCO. (pending wrapper function developement)
// cmi.scaled_passing_score: Identifies the scaled passing score for a SCO.

/* --------------------------------------------------------------------------------
// cmi.score.max: The max data model element is the maximum value in the range for the raw score
/* --------------------------------------------------------------------------------
   pipwerks.SCORM.GetScoreMax
   Parameters: none
   Returns:    Real
----------------------------------------------------------------------------------- */
pipwerks.SCORM.GetScoreMax = function () {
  var API = pipwerks.SCORM.API.getHandle(),
    scorm = pipwerks.SCORM,
    trace = pipwerks.UTILS.trace,
    result = "";

  if (API) {

    switch (scorm.version) {
      case "1.2": result = scorm.get("cmi.core.score.max"); break;
      case "2004": result = scorm.get("cmi.score.max"); break;
    }
  }
  else {
    trace("pipwerks.SCORM.GetScoreMax failed: API is null.");
  }

  return result;
};

/* --------------------------------------------------------------------------------
// cmi.score.max: The max data model element is the maximum value in the range for the raw score
/* --------------------------------------------------------------------------------
   pipwerks.SCORM.SetScoreMax
   Parameters: max_score (real)
   Returns:    none
----------------------------------------------------------------------------------- */
pipwerks.SCORM.SetScoreMax = function (max_score) {
  var API = pipwerks.SCORM.API.getHandle(),
    scorm = pipwerks.SCORM,
    trace = pipwerks.UTILS.trace,
    result = "";

  if (API) {
    switch (scorm.version) {
      case "1.2": result = scorm.set("cmi.core.score.max", max_score); break;
      case "2004": result = scorm.set("cmi.score.max", max_score); break;
    }
  }
  else {
    trace("pipwerks.SCORM.SetScoreMax failed: API is null.");
  }
};

/* --------------------------------------------------------------------------------
// cmi.score.min: The min data model element is the minimum value in the range for the raw score
/* --------------------------------------------------------------------------------
   pipwerks.SCORM.GetScoreMin
   Parameters: none
   Returns:    Real
----------------------------------------------------------------------------------- */
pipwerks.SCORM.GetScoreMin = function () {
  var API = pipwerks.SCORM.API.getHandle(),
    scorm = pipwerks.SCORM,
    trace = pipwerks.UTILS.trace,
    result = "";

  if (API) {

    switch (scorm.version) {
      case "1.2": result = scorm.get("cmi.core.score.min"); break;
      case "2004": result = scorm.get("cmi.score.min"); break;
    }
  }
  else {
    trace("pipwerks.SCORM.GetScoreMin failed: API is null.");
  }

  return result;
};

/* --------------------------------------------------------------------------------
// cmi.score.min: The min data model element is the minimum value in the range for the raw score
/* --------------------------------------------------------------------------------
   pipwerks.SCORM.SetScoreMin
   Parameters: min_score (real)
   Returns:    none
----------------------------------------------------------------------------------- */
pipwerks.SCORM.SetScoreMin = function (min_score) {
  var API = pipwerks.SCORM.API.getHandle(),
    scorm = pipwerks.SCORM,
    trace = pipwerks.UTILS.trace,
    result = "";

  if (API) {
    switch (scorm.version) {
      case "1.2": result = scorm.set("cmi.core.score.min", min_score); break;
      case "2004": result = scorm.set("cmi.score.min", min_score); break;
    }
  }
  else {
    trace("pipwerks.SCORM.SetScoreMin failed: API is null.");
  }
};

/* --------------------------------------------------------------------------------
// cmi.score.raw: Identifies the learner’s score for the SCO.
/* --------------------------------------------------------------------------------
   pipwerks.SCORM.GetScoreRaw
   Parameters: none
   Returns:    Real
----------------------------------------------------------------------------------- */
pipwerks.SCORM.GetScoreRaw = function () {
  var API = pipwerks.SCORM.API.getHandle(),
    scorm = pipwerks.SCORM,
    trace = pipwerks.UTILS.trace,
    result = "";

  if (API) {

    switch (scorm.version) {
      case "1.2": result = scorm.get("cmi.core.score.raw"); break;
      case "2004": result = scorm.get("cmi.score.raw"); break;
    }
  }
  else {
    trace("pipwerks.SCORM.GetScoreRaw failed: API is null.");
  }

  return result;
};

/* --------------------------------------------------------------------------------
// cmi.score.raw: Identifies the learner’s score for the SCO.
/* --------------------------------------------------------------------------------
   pipwerks.SCORM.SetScoreRaw
   Parameters: score (real)
   Returns:    none
----------------------------------------------------------------------------------- */
pipwerks.SCORM.SetScoreRaw = function (score) {
  var API = pipwerks.SCORM.API.getHandle(),
    scorm = pipwerks.SCORM,
    trace = pipwerks.UTILS.trace,
    result = "";

  if (API) {
    switch (scorm.version) {
      case "1.2": result = scorm.set("cmi.core.score.raw", score); break;
      case "2004": result = scorm.set("cmi.score.raw", score); break;
    }
  }
  else {
    trace("pipwerks.SCORM.SetScoreRaw failed: API is null.");
  }
};

// cmi.score.scaled: Identifies the learner’s score for the SCO. Only for 2004 (pending wrapper function developement)

/* --------------------------------------------------------------------------------
// cmi.score.scaled: Identifies the learner’s scaled score for the SCO.
/* --------------------------------------------------------------------------------
   pipwerks.SCORM.SetScoreScaled
   Parameters: none
   Returns:    none
----------------------------------------------------------------------------------- */
pipwerks.SCORM.SetScoreScaled = function () {
  var API = pipwerks.SCORM.API.getHandle(),
    scorm = pipwerks.SCORM,
    trace = pipwerks.UTILS.trace,
    result = "";

  if (pipwerks.SCORM.GetScoreRaw() === null || pipwerks.SCORM.GetScoreMax() === null || pipwerks.SCORM.GetScoreMax() === 0) {
    return;
  }
  
  let scaledScore = pipwerks.SCORM.GetScoreRaw() / pipwerks.SCORM.GetScoreMax();

  if (API) {
    switch (scorm.version) {
      // case "1.2": result = scorm.set("cmi.core.score.raw", score); break;
      case "2004": result = scorm.set("cmi.score.scaled", scaledScore); break;
    }
  }
  else {
    trace("pipwerks.SCORM.SetScoreScaled failed: API is null.");
  }
};

/* --------------------------------------------------------------------------------
// cmi.session_time: Identifies the amount of time that the learner has spent in the current learner session for the SCO.
/* --------------------------------------------------------------------------------
   pipwerks.SCORM.GetSessionTime
   Parameters: none
   Returns:    String
----------------------------------------------------------------------------------- */
pipwerks.SCORM.GetSessionTime = function () {
  var API = pipwerks.SCORM.API.getHandle(),
    scorm = pipwerks.SCORM,
    trace = pipwerks.UTILS.trace,
    result = "";
  // Pending: check string format
  if (API) {

    switch (scorm.version) {
      case "1.2": result = scorm.get("cmi.core.session_time"); break;
      case "2004": result = scorm.get("cmi.session_time"); break;
    }
  }
  else {
    trace("pipwerks.SCORM.GetSessionTime failed: API is null.");
  }

  return String(result);
};

/* --------------------------------------------------------------------------------
// cmi.session_time: Identifies the amount of time that the learner has spent in the current learner session for the SCO.
/* --------------------------------------------------------------------------------
   pipwerks.SCORM.SetSessionTime
   Parameters: time (string)
   Returns:    none
----------------------------------------------------------------------------------- */
pipwerks.SCORM.SetSessionTime = function (time) {
  var API = pipwerks.SCORM.API.getHandle(),
    scorm = pipwerks.SCORM,
    trace = pipwerks.UTILS.trace,
    result = "";

  // Pending: check string format
  if (API) {
    switch (scorm.version) {
      case "1.2": result = scorm.set("cmi.core.session_time", time); break;
      case "2004": result = scorm.set("cmi.session_time", time); break;
    }
  }
  else {
    trace("pipwerks.SCORM.SetSessionTime failed: API is null.");
  }
};

/* --------------------------------------------------------------------------------
// cmi.success_status: Identifies the modes in which the SCO may be presented to the learner.
/* --------------------------------------------------------------------------------
   pipwerks.SCORM.GetSuccessStatus
   Parameters: none
   Returns:    String
----------------------------------------------------------------------------------- */
pipwerks.SCORM.GetSuccessStatus = function () {
  var API = pipwerks.SCORM.API.getHandle(),
    scorm = pipwerks.SCORM,
    trace = pipwerks.UTILS.trace,
    result = "";

  if (API) {
    switch (scorm.version) {
      case "1.2": result = scorm.get("cmi.core.lesson_status"); break; // cmi.success_status and cmi.completion_status only exist in 2004
      case "2004": result = scorm.get("cmi.success_status"); break;
    }
  }
  else {
    trace("pipwerks.SCORM.GetSuccessStatus failed: API is null.");
  }

  return String(result);
};

/* --------------------------------------------------------------------------------
// cmi.success_status: Identifies the modes in which the SCO may be presented to the learner.
/* --------------------------------------------------------------------------------
   pipwerks.SCORM.SetSuccessStatus
   Parameters: status (string)
   Returns:    none
----------------------------------------------------------------------------------- */
pipwerks.SCORM.SetSuccessStatus = function (status) {
  var API = pipwerks.SCORM.API.getHandle(),
    scorm = pipwerks.SCORM,
    trace = pipwerks.UTILS.trace,
    result = "";

  if (API) {
    // Check the value
    switch (status) {
      case "passed":
        break;
      case "failed":
        break;
      case "unknown":
        break;
      default:
        trace("pipwerks.SCORM.SetSuccessStatus failed: " + status + " value is not valid.");
        return;
    }
    switch (scorm.version) {
      case "2004":
        result = scorm.set("cmi.success_status", status);
        break;
    }
  }
  else {
    trace("pipwerks.SCORM.SetSuccessStatus failed: API is null.");
  }
};

// cmi.suspend_data: Provides information that may be created by a SCO as a result of a learner accessing or interacting with the SCO.
// cmi.time_limit_action: Indicates what the SCO should do when the maximum time allowed is exceeded.
// cmi.cmi.total_time: Identifies the sum of all of the learner’s learner session times accumulated in the current learner attempt prior to the current learner session.


// ------------------------------------------------------------------------- //
// --- pipwerks.nav functions -------------------------------------------- //
// ------------------------------------------------------------------------- //

/* -------------------------------------------------------------------------
   pipwerks.nav.goBack()
   Moves to previous node.
   Parameters: None
   Return:     None
---------------------------------------------------------------------------- */

pipwerks.nav.goBack = function () {
  var API = pipwerks.SCORM.API.getHandle(),
    scorm = pipwerks.SCORM,
    trace = pipwerks.UTILS.trace,
    coreSCOLocation;

  if (API) {
    switch (scorm.version) {
      case "1.2":
        // Non-standar code un eXeLearning. Only works in Moodle 1.9
        scorm.set('nav.event', 'previous');
        coreSCOLocation = scorm.get("cmi.core.lesson_location");
        window.location = coreSCOLocation;
        unloadPage();
        break;
      case "2004":
        // Manifest must enable flow tipe navigation on every node
        scorm.set('adl.nav.request', 'previous');
        unloadPage();
        break;
    }
  }
  else {
    trace("pipwerks.nav.goBack failed: API is null.");
  }
};


/* -------------------------------------------------------------------------
   pipwerks.nav.goForward()
   Moves to next node.
   Parameters: None
   Return:     None
---------------------------------------------------------------------------- */

pipwerks.nav.goForward = function () {
  var API = pipwerks.SCORM.API.getHandle(),
    scorm = pipwerks.SCORM,
    trace = pipwerks.UTILS.trace,
    coreSCOLocation;

  if (API) {
    switch (scorm.version) {
      case "1.2":
        // Non-standar code un eXeLearning. Only works in Moodle 1.9
        scorm.set('nav.event', 'continue');
        coreSCOLocation = scorm.get("cmi.core.lesson_location");
        window.location = coreSCOLocation;
        unloadPage();
        break;
      case "2004":
        // Manifest must enable flow tipe navigation on every node
        scorm.set('adl.nav.request', 'continue');
        unloadPage();
        break;
    }
  }
  else {
    trace("pipwerks.nav.goForward failed: API is null.");
  }
};

// Export for Node.js/CommonJS (tests)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = pipwerks;
}