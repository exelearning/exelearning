/* Add your JavaScript code here */
jQuery(function () {
    // Code here runs when the DOM is loaded (login, workarea, error pages, etc.)
});
if (typeof window.$eXeLearningCustom === 'undefined') {
    window.$eXeLearningCustom = {
        init: function () {
            // Code here runs only in the workarea, after the app has fully loaded.
            // window.eXeLearning is available here.
        },
    };
}
