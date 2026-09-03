/*! ===========================================================================
    eXe xAPI compatibility shim

    xAPI emission has been retired from eXeLearning exports. The file remains
    temporarily at the historical path so exports produced by code that still
    references libs/xapi/exe_xapi.js do not fail with a missing resource while
    the surrounding exporter plumbing is removed independently.

    A future xAPI implementation should be introduced only with a concrete
    consumer and an explicit statement/session contract.
=========================================================================== */

(function (root) {
    'use strict';

    var xapi = {
        init: function () {},
        emit: function () {},
    };

    if (root) {
        root.exeXapiEmitter = xapi;
    }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = xapi;
    }
})(typeof window !== 'undefined' ? window : this);
