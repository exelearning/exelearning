<?php

namespace App\Service\net\exelearning\Service\FilemanagerService\View\Adapters;

use App\Service\net\exelearning\Service\FilemanagerService\View\ViewInterface;
use Symfony\Component\HttpFoundation\Request;

/**
 * Sets view of filemanager.
 */
class Vuejs implements ViewInterface
{
    public function getIndexPage(Request $request)
    {
        $symfonyBaseURL = $request->getSchemeAndHttpHost();
        $symfonyBasePath = $request->getBaseURL();
        if ($symfonyBasePath) {
            $symfonyFullUrl = $symfonyBaseURL.'/'.$symfonyBasePath;
        } else {
            $symfonyFullUrl = $symfonyBaseURL;
        }
        $title = 'Filemanager';
        $public_path = $symfonyFullUrl.'/libs/filegator/';
        $public_dir = '';
        $html = '<!DOCTYPE html>
                    <html lang=en>
                      <head>
                        <meta charset=utf-8>
                        <meta http-equiv=X-UA-Compatible content="IE=edge">
                        <meta name=viewport content="width=device-width,initial-scale=1">
                        <meta name="robots" content="noindex,nofollow">
                        <title>'.$title.'</title>
                      </head>
                      <body>
                        <div id=app></div>
                      </body>
                      <script>
                        function loadFile(url) {
                          var s;
                          var base = "'.$public_path.'";
                          if (top && typeof(top.eXeLearning) == "object") {
                            if (top.window.location.href.indexOf("https://")==0 && base.indexOf("http://")==0) {
                              base = base.replace("http://", "https://");
                            }
                            base = base.replace("/libs/", "/assets/" + top.eXeLearning.version + "/libs/");
                            if (url.split(".").pop() == "css") {
                              s = document.createElement("link");
                              s.rel = "stylesheet";
                              s.href = base + url;
                            } else {
                              s = document.createElement("script");
                              s.src = base + url;
                            }
                            document.getElementsByTagName("head")[0].appendChild(s);
                          }
                        }
                        loadFile("css/app.css");
                        loadFile("css/chunk-vendors.css");
                        loadFile("js/app.js");
                        loadFile("js/chunk-vendors.js");
                      </script>
                    </html>
        ';

        return $html;
    }
}
