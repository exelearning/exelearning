# Customization

You can define your own look and feel and/or add custom JavaScript code.

## Look and feel

Just add your CSS code in /public/style/workarea/custom.css

### Custom JavaScript

Add your JavaScript code in /public/app/workarea/custom.js

**Things to know:**

* jQuery is available.
* The eXeLearning object is only available in the work area, but not in the login page or the error pages.
* Once the application is ready, eXeLearning will try to execute `$eXeLearningCustom.init()`
* Just define `$eXeLearningCustom.init` in your custom.js file if you need it.
