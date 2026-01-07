var LexicalBundle = (() => {
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __commonJS = (cb, mod16) => function __require() {
    return mod16 || (0, cb[__getOwnPropNames(cb)[0]])((mod16 = { exports: {} }).exports, mod16), mod16.exports;
  };
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to2, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to2, key) && key !== except)
          __defProp(to2, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to2;
  };
  var __toESM = (mod16, isNodeMode, target) => (target = mod16 != null ? __create(__getProtoOf(mod16)) : {}, __copyProps(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    isNodeMode || !mod16 || !mod16.__esModule ? __defProp(target, "default", { value: mod16, enumerable: true }) : target,
    mod16
  ));
  var __toCommonJS = (mod16) => __copyProps(__defProp({}, "__esModule", { value: true }), mod16);

  // node_modules/prismjs/prism.js
  var require_prism = __commonJS({
    "node_modules/prismjs/prism.js"(exports, module) {
      var _self = typeof window !== "undefined" ? window : typeof WorkerGlobalScope !== "undefined" && self instanceof WorkerGlobalScope ? self : {};
      var Prism2 = (function(_self2) {
        var lang = /(?:^|\s)lang(?:uage)?-([\w-]+)(?=\s|$)/i;
        var uniqueId = 0;
        var plainTextGrammar = {};
        var _5 = {
          /**
           * By default, Prism will attempt to highlight all code elements (by calling {@link Prism.highlightAll}) on the
           * current page after the page finished loading. This might be a problem if e.g. you wanted to asynchronously load
           * additional languages or plugins yourself.
           *
           * By setting this value to `true`, Prism will not automatically highlight all code elements on the page.
           *
           * You obviously have to change this value before the automatic highlighting started. To do this, you can add an
           * empty Prism object into the global scope before loading the Prism script like this:
           *
           * ```js
           * window.Prism = window.Prism || {};
           * Prism.manual = true;
           * // add a new <script> to load Prism's script
           * ```
           *
           * @default false
           * @type {boolean}
           * @memberof Prism
           * @public
           */
          manual: _self2.Prism && _self2.Prism.manual,
          /**
           * By default, if Prism is in a web worker, it assumes that it is in a worker it created itself, so it uses
           * `addEventListener` to communicate with its parent instance. However, if you're using Prism manually in your
           * own worker, you don't want it to do this.
           *
           * By setting this value to `true`, Prism will not add its own listeners to the worker.
           *
           * You obviously have to change this value before Prism executes. To do this, you can add an
           * empty Prism object into the global scope before loading the Prism script like this:
           *
           * ```js
           * window.Prism = window.Prism || {};
           * Prism.disableWorkerMessageHandler = true;
           * // Load Prism's script
           * ```
           *
           * @default false
           * @type {boolean}
           * @memberof Prism
           * @public
           */
          disableWorkerMessageHandler: _self2.Prism && _self2.Prism.disableWorkerMessageHandler,
          /**
           * A namespace for utility methods.
           *
           * All function in this namespace that are not explicitly marked as _public_ are for __internal use only__ and may
           * change or disappear at any time.
           *
           * @namespace
           * @memberof Prism
           */
          util: {
            encode: function encode(tokens) {
              if (tokens instanceof Token) {
                return new Token(tokens.type, encode(tokens.content), tokens.alias);
              } else if (Array.isArray(tokens)) {
                return tokens.map(encode);
              } else {
                return tokens.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/\u00a0/g, " ");
              }
            },
            /**
             * Returns the name of the type of the given value.
             *
             * @param {any} o
             * @returns {string}
             * @example
             * type(null)      === 'Null'
             * type(undefined) === 'Undefined'
             * type(123)       === 'Number'
             * type('foo')     === 'String'
             * type(true)      === 'Boolean'
             * type([1, 2])    === 'Array'
             * type({})        === 'Object'
             * type(String)    === 'Function'
             * type(/abc+/)    === 'RegExp'
             */
            type: function(o2) {
              return Object.prototype.toString.call(o2).slice(8, -1);
            },
            /**
             * Returns a unique number for the given object. Later calls will still return the same number.
             *
             * @param {Object} obj
             * @returns {number}
             */
            objId: function(obj) {
              if (!obj["__id"]) {
                Object.defineProperty(obj, "__id", { value: ++uniqueId });
              }
              return obj["__id"];
            },
            /**
             * Creates a deep clone of the given object.
             *
             * The main intended use of this function is to clone language definitions.
             *
             * @param {T} o
             * @param {Record<number, any>} [visited]
             * @returns {T}
             * @template T
             */
            clone: function deepClone(o2, visited) {
              visited = visited || {};
              var clone;
              var id;
              switch (_5.util.type(o2)) {
                case "Object":
                  id = _5.util.objId(o2);
                  if (visited[id]) {
                    return visited[id];
                  }
                  clone = /** @type {Record<string, any>} */
                  {};
                  visited[id] = clone;
                  for (var key in o2) {
                    if (o2.hasOwnProperty(key)) {
                      clone[key] = deepClone(o2[key], visited);
                    }
                  }
                  return (
                    /** @type {any} */
                    clone
                  );
                case "Array":
                  id = _5.util.objId(o2);
                  if (visited[id]) {
                    return visited[id];
                  }
                  clone = [];
                  visited[id] = clone;
                  /** @type {Array} */
                  /** @type {any} */
                  o2.forEach(function(v4, i3) {
                    clone[i3] = deepClone(v4, visited);
                  });
                  return (
                    /** @type {any} */
                    clone
                  );
                default:
                  return o2;
              }
            },
            /**
             * Returns the Prism language of the given element set by a `language-xxxx` or `lang-xxxx` class.
             *
             * If no language is set for the element or the element is `null` or `undefined`, `none` will be returned.
             *
             * @param {Element} element
             * @returns {string}
             */
            getLanguage: function(element) {
              while (element) {
                var m3 = lang.exec(element.className);
                if (m3) {
                  return m3[1].toLowerCase();
                }
                element = element.parentElement;
              }
              return "none";
            },
            /**
             * Sets the Prism `language-xxxx` class of the given element.
             *
             * @param {Element} element
             * @param {string} language
             * @returns {void}
             */
            setLanguage: function(element, language) {
              element.className = element.className.replace(RegExp(lang, "gi"), "");
              element.classList.add("language-" + language);
            },
            /**
             * Returns the script element that is currently executing.
             *
             * This does __not__ work for line script element.
             *
             * @returns {HTMLScriptElement | null}
             */
            currentScript: function() {
              if (typeof document === "undefined") {
                return null;
              }
              if (document.currentScript && document.currentScript.tagName === "SCRIPT" && 1 < 2) {
                return (
                  /** @type {any} */
                  document.currentScript
                );
              }
              try {
                throw new Error();
              } catch (err) {
                var src = (/at [^(\r\n]*\((.*):[^:]+:[^:]+\)$/i.exec(err.stack) || [])[1];
                if (src) {
                  var scripts = document.getElementsByTagName("script");
                  for (var i3 in scripts) {
                    if (scripts[i3].src == src) {
                      return scripts[i3];
                    }
                  }
                }
                return null;
              }
            },
            /**
             * Returns whether a given class is active for `element`.
             *
             * The class can be activated if `element` or one of its ancestors has the given class and it can be deactivated
             * if `element` or one of its ancestors has the negated version of the given class. The _negated version_ of the
             * given class is just the given class with a `no-` prefix.
             *
             * Whether the class is active is determined by the closest ancestor of `element` (where `element` itself is
             * closest ancestor) that has the given class or the negated version of it. If neither `element` nor any of its
             * ancestors have the given class or the negated version of it, then the default activation will be returned.
             *
             * In the paradoxical situation where the closest ancestor contains __both__ the given class and the negated
             * version of it, the class is considered active.
             *
             * @param {Element} element
             * @param {string} className
             * @param {boolean} [defaultActivation=false]
             * @returns {boolean}
             */
            isActive: function(element, className, defaultActivation) {
              var no2 = "no-" + className;
              while (element) {
                var classList = element.classList;
                if (classList.contains(className)) {
                  return true;
                }
                if (classList.contains(no2)) {
                  return false;
                }
                element = element.parentElement;
              }
              return !!defaultActivation;
            }
          },
          /**
           * This namespace contains all currently loaded languages and the some helper functions to create and modify languages.
           *
           * @namespace
           * @memberof Prism
           * @public
           */
          languages: {
            /**
             * The grammar for plain, unformatted text.
             */
            plain: plainTextGrammar,
            plaintext: plainTextGrammar,
            text: plainTextGrammar,
            txt: plainTextGrammar,
            /**
             * Creates a deep copy of the language with the given id and appends the given tokens.
             *
             * If a token in `redef` also appears in the copied language, then the existing token in the copied language
             * will be overwritten at its original position.
             *
             * ## Best practices
             *
             * Since the position of overwriting tokens (token in `redef` that overwrite tokens in the copied language)
             * doesn't matter, they can technically be in any order. However, this can be confusing to others that trying to
             * understand the language definition because, normally, the order of tokens matters in Prism grammars.
             *
             * Therefore, it is encouraged to order overwriting tokens according to the positions of the overwritten tokens.
             * Furthermore, all non-overwriting tokens should be placed after the overwriting ones.
             *
             * @param {string} id The id of the language to extend. This has to be a key in `Prism.languages`.
             * @param {Grammar} redef The new tokens to append.
             * @returns {Grammar} The new language created.
             * @public
             * @example
             * Prism.languages['css-with-colors'] = Prism.languages.extend('css', {
             *     // Prism.languages.css already has a 'comment' token, so this token will overwrite CSS' 'comment' token
             *     // at its original position
             *     'comment': { ... },
             *     // CSS doesn't have a 'color' token, so this token will be appended
             *     'color': /\b(?:red|green|blue)\b/
             * });
             */
            extend: function(id, redef) {
              var lang2 = _5.util.clone(_5.languages[id]);
              for (var key in redef) {
                lang2[key] = redef[key];
              }
              return lang2;
            },
            /**
             * Inserts tokens _before_ another token in a language definition or any other grammar.
             *
             * ## Usage
             *
             * This helper method makes it easy to modify existing languages. For example, the CSS language definition
             * not only defines CSS highlighting for CSS documents, but also needs to define highlighting for CSS embedded
             * in HTML through `<style>` elements. To do this, it needs to modify `Prism.languages.markup` and add the
             * appropriate tokens. However, `Prism.languages.markup` is a regular JavaScript object literal, so if you do
             * this:
             *
             * ```js
             * Prism.languages.markup.style = {
             *     // token
             * };
             * ```
             *
             * then the `style` token will be added (and processed) at the end. `insertBefore` allows you to insert tokens
             * before existing tokens. For the CSS example above, you would use it like this:
             *
             * ```js
             * Prism.languages.insertBefore('markup', 'cdata', {
             *     'style': {
             *         // token
             *     }
             * });
             * ```
             *
             * ## Special cases
             *
             * If the grammars of `inside` and `insert` have tokens with the same name, the tokens in `inside`'s grammar
             * will be ignored.
             *
             * This behavior can be used to insert tokens after `before`:
             *
             * ```js
             * Prism.languages.insertBefore('markup', 'comment', {
             *     'comment': Prism.languages.markup.comment,
             *     // tokens after 'comment'
             * });
             * ```
             *
             * ## Limitations
             *
             * The main problem `insertBefore` has to solve is iteration order. Since ES2015, the iteration order for object
             * properties is guaranteed to be the insertion order (except for integer keys) but some browsers behave
             * differently when keys are deleted and re-inserted. So `insertBefore` can't be implemented by temporarily
             * deleting properties which is necessary to insert at arbitrary positions.
             *
             * To solve this problem, `insertBefore` doesn't actually insert the given tokens into the target object.
             * Instead, it will create a new object and replace all references to the target object with the new one. This
             * can be done without temporarily deleting properties, so the iteration order is well-defined.
             *
             * However, only references that can be reached from `Prism.languages` or `insert` will be replaced. I.e. if
             * you hold the target object in a variable, then the value of the variable will not change.
             *
             * ```js
             * var oldMarkup = Prism.languages.markup;
             * var newMarkup = Prism.languages.insertBefore('markup', 'comment', { ... });
             *
             * assert(oldMarkup !== Prism.languages.markup);
             * assert(newMarkup === Prism.languages.markup);
             * ```
             *
             * @param {string} inside The property of `root` (e.g. a language id in `Prism.languages`) that contains the
             * object to be modified.
             * @param {string} before The key to insert before.
             * @param {Grammar} insert An object containing the key-value pairs to be inserted.
             * @param {Object<string, any>} [root] The object containing `inside`, i.e. the object that contains the
             * object to be modified.
             *
             * Defaults to `Prism.languages`.
             * @returns {Grammar} The new grammar object.
             * @public
             */
            insertBefore: function(inside, before, insert, root) {
              root = root || /** @type {any} */
              _5.languages;
              var grammar = root[inside];
              var ret = {};
              for (var token in grammar) {
                if (grammar.hasOwnProperty(token)) {
                  if (token == before) {
                    for (var newToken in insert) {
                      if (insert.hasOwnProperty(newToken)) {
                        ret[newToken] = insert[newToken];
                      }
                    }
                  }
                  if (!insert.hasOwnProperty(token)) {
                    ret[token] = grammar[token];
                  }
                }
              }
              var old = root[inside];
              root[inside] = ret;
              _5.languages.DFS(_5.languages, function(key, value) {
                if (value === old && key != inside) {
                  this[key] = ret;
                }
              });
              return ret;
            },
            // Traverse a language definition with Depth First Search
            DFS: function DFS(o2, callback, type, visited) {
              visited = visited || {};
              var objId = _5.util.objId;
              for (var i3 in o2) {
                if (o2.hasOwnProperty(i3)) {
                  callback.call(o2, i3, o2[i3], type || i3);
                  var property = o2[i3];
                  var propertyType = _5.util.type(property);
                  if (propertyType === "Object" && !visited[objId(property)]) {
                    visited[objId(property)] = true;
                    DFS(property, callback, null, visited);
                  } else if (propertyType === "Array" && !visited[objId(property)]) {
                    visited[objId(property)] = true;
                    DFS(property, callback, i3, visited);
                  }
                }
              }
            }
          },
          plugins: {},
          /**
           * This is the most high-level function in Prism’s API.
           * It fetches all the elements that have a `.language-xxxx` class and then calls {@link Prism.highlightElement} on
           * each one of them.
           *
           * This is equivalent to `Prism.highlightAllUnder(document, async, callback)`.
           *
           * @param {boolean} [async=false] Same as in {@link Prism.highlightAllUnder}.
           * @param {HighlightCallback} [callback] Same as in {@link Prism.highlightAllUnder}.
           * @memberof Prism
           * @public
           */
          highlightAll: function(async, callback) {
            _5.highlightAllUnder(document, async, callback);
          },
          /**
           * Fetches all the descendants of `container` that have a `.language-xxxx` class and then calls
           * {@link Prism.highlightElement} on each one of them.
           *
           * The following hooks will be run:
           * 1. `before-highlightall`
           * 2. `before-all-elements-highlight`
           * 3. All hooks of {@link Prism.highlightElement} for each element.
           *
           * @param {ParentNode} container The root element, whose descendants that have a `.language-xxxx` class will be highlighted.
           * @param {boolean} [async=false] Whether each element is to be highlighted asynchronously using Web Workers.
           * @param {HighlightCallback} [callback] An optional callback to be invoked on each element after its highlighting is done.
           * @memberof Prism
           * @public
           */
          highlightAllUnder: function(container, async, callback) {
            var env = {
              callback,
              container,
              selector: 'code[class*="language-"], [class*="language-"] code, code[class*="lang-"], [class*="lang-"] code'
            };
            _5.hooks.run("before-highlightall", env);
            env.elements = Array.prototype.slice.apply(env.container.querySelectorAll(env.selector));
            _5.hooks.run("before-all-elements-highlight", env);
            for (var i3 = 0, element; element = env.elements[i3++]; ) {
              _5.highlightElement(element, async === true, env.callback);
            }
          },
          /**
           * Highlights the code inside a single element.
           *
           * The following hooks will be run:
           * 1. `before-sanity-check`
           * 2. `before-highlight`
           * 3. All hooks of {@link Prism.highlight}. These hooks will be run by an asynchronous worker if `async` is `true`.
           * 4. `before-insert`
           * 5. `after-highlight`
           * 6. `complete`
           *
           * Some the above hooks will be skipped if the element doesn't contain any text or there is no grammar loaded for
           * the element's language.
           *
           * @param {Element} element The element containing the code.
           * It must have a class of `language-xxxx` to be processed, where `xxxx` is a valid language identifier.
           * @param {boolean} [async=false] Whether the element is to be highlighted asynchronously using Web Workers
           * to improve performance and avoid blocking the UI when highlighting very large chunks of code. This option is
           * [disabled by default](https://prismjs.com/faq.html#why-is-asynchronous-highlighting-disabled-by-default).
           *
           * Note: All language definitions required to highlight the code must be included in the main `prism.js` file for
           * asynchronous highlighting to work. You can build your own bundle on the
           * [Download page](https://prismjs.com/download.html).
           * @param {HighlightCallback} [callback] An optional callback to be invoked after the highlighting is done.
           * Mostly useful when `async` is `true`, since in that case, the highlighting is done asynchronously.
           * @memberof Prism
           * @public
           */
          highlightElement: function(element, async, callback) {
            var language = _5.util.getLanguage(element);
            var grammar = _5.languages[language];
            _5.util.setLanguage(element, language);
            var parent = element.parentElement;
            if (parent && parent.nodeName.toLowerCase() === "pre") {
              _5.util.setLanguage(parent, language);
            }
            var code = element.textContent;
            var env = {
              element,
              language,
              grammar,
              code
            };
            function insertHighlightedCode(highlightedCode) {
              env.highlightedCode = highlightedCode;
              _5.hooks.run("before-insert", env);
              env.element.innerHTML = env.highlightedCode;
              _5.hooks.run("after-highlight", env);
              _5.hooks.run("complete", env);
              callback && callback.call(env.element);
            }
            _5.hooks.run("before-sanity-check", env);
            parent = env.element.parentElement;
            if (parent && parent.nodeName.toLowerCase() === "pre" && !parent.hasAttribute("tabindex")) {
              parent.setAttribute("tabindex", "0");
            }
            if (!env.code) {
              _5.hooks.run("complete", env);
              callback && callback.call(env.element);
              return;
            }
            _5.hooks.run("before-highlight", env);
            if (!env.grammar) {
              insertHighlightedCode(_5.util.encode(env.code));
              return;
            }
            if (async && _self2.Worker) {
              var worker = new Worker(_5.filename);
              worker.onmessage = function(evt) {
                insertHighlightedCode(evt.data);
              };
              worker.postMessage(JSON.stringify({
                language: env.language,
                code: env.code,
                immediateClose: true
              }));
            } else {
              insertHighlightedCode(_5.highlight(env.code, env.grammar, env.language));
            }
          },
          /**
           * Low-level function, only use if you know what you’re doing. It accepts a string of text as input
           * and the language definitions to use, and returns a string with the HTML produced.
           *
           * The following hooks will be run:
           * 1. `before-tokenize`
           * 2. `after-tokenize`
           * 3. `wrap`: On each {@link Token}.
           *
           * @param {string} text A string with the code to be highlighted.
           * @param {Grammar} grammar An object containing the tokens to use.
           *
           * Usually a language definition like `Prism.languages.markup`.
           * @param {string} language The name of the language definition passed to `grammar`.
           * @returns {string} The highlighted HTML.
           * @memberof Prism
           * @public
           * @example
           * Prism.highlight('var foo = true;', Prism.languages.javascript, 'javascript');
           */
          highlight: function(text, grammar, language) {
            var env = {
              code: text,
              grammar,
              language
            };
            _5.hooks.run("before-tokenize", env);
            if (!env.grammar) {
              throw new Error('The language "' + env.language + '" has no grammar.');
            }
            env.tokens = _5.tokenize(env.code, env.grammar);
            _5.hooks.run("after-tokenize", env);
            return Token.stringify(_5.util.encode(env.tokens), env.language);
          },
          /**
           * This is the heart of Prism, and the most low-level function you can use. It accepts a string of text as input
           * and the language definitions to use, and returns an array with the tokenized code.
           *
           * When the language definition includes nested tokens, the function is called recursively on each of these tokens.
           *
           * This method could be useful in other contexts as well, as a very crude parser.
           *
           * @param {string} text A string with the code to be highlighted.
           * @param {Grammar} grammar An object containing the tokens to use.
           *
           * Usually a language definition like `Prism.languages.markup`.
           * @returns {TokenStream} An array of strings and tokens, a token stream.
           * @memberof Prism
           * @public
           * @example
           * let code = `var foo = 0;`;
           * let tokens = Prism.tokenize(code, Prism.languages.javascript);
           * tokens.forEach(token => {
           *     if (token instanceof Prism.Token && token.type === 'number') {
           *         console.log(`Found numeric literal: ${token.content}`);
           *     }
           * });
           */
          tokenize: function(text, grammar) {
            var rest = grammar.rest;
            if (rest) {
              for (var token in rest) {
                grammar[token] = rest[token];
              }
              delete grammar.rest;
            }
            var tokenList = new LinkedList();
            addAfter(tokenList, tokenList.head, text);
            matchGrammar(text, tokenList, grammar, tokenList.head, 0);
            return toArray(tokenList);
          },
          /**
           * @namespace
           * @memberof Prism
           * @public
           */
          hooks: {
            all: {},
            /**
             * Adds the given callback to the list of callbacks for the given hook.
             *
             * The callback will be invoked when the hook it is registered for is run.
             * Hooks are usually directly run by a highlight function but you can also run hooks yourself.
             *
             * One callback function can be registered to multiple hooks and the same hook multiple times.
             *
             * @param {string} name The name of the hook.
             * @param {HookCallback} callback The callback function which is given environment variables.
             * @public
             */
            add: function(name, callback) {
              var hooks = _5.hooks.all;
              hooks[name] = hooks[name] || [];
              hooks[name].push(callback);
            },
            /**
             * Runs a hook invoking all registered callbacks with the given environment variables.
             *
             * Callbacks will be invoked synchronously and in the order in which they were registered.
             *
             * @param {string} name The name of the hook.
             * @param {Object<string, any>} env The environment variables of the hook passed to all callbacks registered.
             * @public
             */
            run: function(name, env) {
              var callbacks = _5.hooks.all[name];
              if (!callbacks || !callbacks.length) {
                return;
              }
              for (var i3 = 0, callback; callback = callbacks[i3++]; ) {
                callback(env);
              }
            }
          },
          Token
        };
        _self2.Prism = _5;
        function Token(type, content, alias, matchedStr) {
          this.type = type;
          this.content = content;
          this.alias = alias;
          this.length = (matchedStr || "").length | 0;
        }
        Token.stringify = function stringify(o2, language) {
          if (typeof o2 == "string") {
            return o2;
          }
          if (Array.isArray(o2)) {
            var s4 = "";
            o2.forEach(function(e2) {
              s4 += stringify(e2, language);
            });
            return s4;
          }
          var env = {
            type: o2.type,
            content: stringify(o2.content, language),
            tag: "span",
            classes: ["token", o2.type],
            attributes: {},
            language
          };
          var aliases = o2.alias;
          if (aliases) {
            if (Array.isArray(aliases)) {
              Array.prototype.push.apply(env.classes, aliases);
            } else {
              env.classes.push(aliases);
            }
          }
          _5.hooks.run("wrap", env);
          var attributes = "";
          for (var name in env.attributes) {
            attributes += " " + name + '="' + (env.attributes[name] || "").replace(/"/g, "&quot;") + '"';
          }
          return "<" + env.tag + ' class="' + env.classes.join(" ") + '"' + attributes + ">" + env.content + "</" + env.tag + ">";
        };
        function matchPattern(pattern, pos, text, lookbehind) {
          pattern.lastIndex = pos;
          var match = pattern.exec(text);
          if (match && lookbehind && match[1]) {
            var lookbehindLength = match[1].length;
            match.index += lookbehindLength;
            match[0] = match[0].slice(lookbehindLength);
          }
          return match;
        }
        function matchGrammar(text, tokenList, grammar, startNode, startPos, rematch) {
          for (var token in grammar) {
            if (!grammar.hasOwnProperty(token) || !grammar[token]) {
              continue;
            }
            var patterns = grammar[token];
            patterns = Array.isArray(patterns) ? patterns : [patterns];
            for (var j6 = 0; j6 < patterns.length; ++j6) {
              if (rematch && rematch.cause == token + "," + j6) {
                return;
              }
              var patternObj = patterns[j6];
              var inside = patternObj.inside;
              var lookbehind = !!patternObj.lookbehind;
              var greedy = !!patternObj.greedy;
              var alias = patternObj.alias;
              if (greedy && !patternObj.pattern.global) {
                var flags = patternObj.pattern.toString().match(/[imsuy]*$/)[0];
                patternObj.pattern = RegExp(patternObj.pattern.source, flags + "g");
              }
              var pattern = patternObj.pattern || patternObj;
              for (var currentNode = startNode.next, pos = startPos; currentNode !== tokenList.tail; pos += currentNode.value.length, currentNode = currentNode.next) {
                if (rematch && pos >= rematch.reach) {
                  break;
                }
                var str = currentNode.value;
                if (tokenList.length > text.length) {
                  return;
                }
                if (str instanceof Token) {
                  continue;
                }
                var removeCount = 1;
                var match;
                if (greedy) {
                  match = matchPattern(pattern, pos, text, lookbehind);
                  if (!match || match.index >= text.length) {
                    break;
                  }
                  var from = match.index;
                  var to2 = match.index + match[0].length;
                  var p3 = pos;
                  p3 += currentNode.value.length;
                  while (from >= p3) {
                    currentNode = currentNode.next;
                    p3 += currentNode.value.length;
                  }
                  p3 -= currentNode.value.length;
                  pos = p3;
                  if (currentNode.value instanceof Token) {
                    continue;
                  }
                  for (var k4 = currentNode; k4 !== tokenList.tail && (p3 < to2 || typeof k4.value === "string"); k4 = k4.next) {
                    removeCount++;
                    p3 += k4.value.length;
                  }
                  removeCount--;
                  str = text.slice(pos, p3);
                  match.index -= pos;
                } else {
                  match = matchPattern(pattern, 0, str, lookbehind);
                  if (!match) {
                    continue;
                  }
                }
                var from = match.index;
                var matchStr = match[0];
                var before = str.slice(0, from);
                var after = str.slice(from + matchStr.length);
                var reach = pos + str.length;
                if (rematch && reach > rematch.reach) {
                  rematch.reach = reach;
                }
                var removeFrom = currentNode.prev;
                if (before) {
                  removeFrom = addAfter(tokenList, removeFrom, before);
                  pos += before.length;
                }
                removeRange(tokenList, removeFrom, removeCount);
                var wrapped = new Token(token, inside ? _5.tokenize(matchStr, inside) : matchStr, alias, matchStr);
                currentNode = addAfter(tokenList, removeFrom, wrapped);
                if (after) {
                  addAfter(tokenList, currentNode, after);
                }
                if (removeCount > 1) {
                  var nestedRematch = {
                    cause: token + "," + j6,
                    reach
                  };
                  matchGrammar(text, tokenList, grammar, currentNode.prev, pos, nestedRematch);
                  if (rematch && nestedRematch.reach > rematch.reach) {
                    rematch.reach = nestedRematch.reach;
                  }
                }
              }
            }
          }
        }
        function LinkedList() {
          var head = { value: null, prev: null, next: null };
          var tail = { value: null, prev: head, next: null };
          head.next = tail;
          this.head = head;
          this.tail = tail;
          this.length = 0;
        }
        function addAfter(list, node, value) {
          var next = node.next;
          var newNode = { value, prev: node, next };
          node.next = newNode;
          next.prev = newNode;
          list.length++;
          return newNode;
        }
        function removeRange(list, node, count) {
          var next = node.next;
          for (var i3 = 0; i3 < count && next !== list.tail; i3++) {
            next = next.next;
          }
          node.next = next;
          next.prev = node;
          list.length -= i3;
        }
        function toArray(list) {
          var array = [];
          var node = list.head.next;
          while (node !== list.tail) {
            array.push(node.value);
            node = node.next;
          }
          return array;
        }
        if (!_self2.document) {
          if (!_self2.addEventListener) {
            return _5;
          }
          if (!_5.disableWorkerMessageHandler) {
            _self2.addEventListener("message", function(evt) {
              var message = JSON.parse(evt.data);
              var lang2 = message.language;
              var code = message.code;
              var immediateClose = message.immediateClose;
              _self2.postMessage(_5.highlight(code, _5.languages[lang2], lang2));
              if (immediateClose) {
                _self2.close();
              }
            }, false);
          }
          return _5;
        }
        var script = _5.util.currentScript();
        if (script) {
          _5.filename = script.src;
          if (script.hasAttribute("data-manual")) {
            _5.manual = true;
          }
        }
        function highlightAutomaticallyCallback() {
          if (!_5.manual) {
            _5.highlightAll();
          }
        }
        if (!_5.manual) {
          var readyState = document.readyState;
          if (readyState === "loading" || readyState === "interactive" && script && script.defer) {
            document.addEventListener("DOMContentLoaded", highlightAutomaticallyCallback);
          } else {
            if (window.requestAnimationFrame) {
              window.requestAnimationFrame(highlightAutomaticallyCallback);
            } else {
              window.setTimeout(highlightAutomaticallyCallback, 16);
            }
          }
        }
        return _5;
      })(_self);
      if (typeof module !== "undefined" && module.exports) {
        module.exports = Prism2;
      }
      if (typeof global !== "undefined") {
        global.Prism = Prism2;
      }
      Prism2.languages.markup = {
        "comment": {
          pattern: /<!--(?:(?!<!--)[\s\S])*?-->/,
          greedy: true
        },
        "prolog": {
          pattern: /<\?[\s\S]+?\?>/,
          greedy: true
        },
        "doctype": {
          // https://www.w3.org/TR/xml/#NT-doctypedecl
          pattern: /<!DOCTYPE(?:[^>"'[\]]|"[^"]*"|'[^']*')+(?:\[(?:[^<"'\]]|"[^"]*"|'[^']*'|<(?!!--)|<!--(?:[^-]|-(?!->))*-->)*\]\s*)?>/i,
          greedy: true,
          inside: {
            "internal-subset": {
              pattern: /(^[^\[]*\[)[\s\S]+(?=\]>$)/,
              lookbehind: true,
              greedy: true,
              inside: null
              // see below
            },
            "string": {
              pattern: /"[^"]*"|'[^']*'/,
              greedy: true
            },
            "punctuation": /^<!|>$|[[\]]/,
            "doctype-tag": /^DOCTYPE/i,
            "name": /[^\s<>'"]+/
          }
        },
        "cdata": {
          pattern: /<!\[CDATA\[[\s\S]*?\]\]>/i,
          greedy: true
        },
        "tag": {
          pattern: /<\/?(?!\d)[^\s>\/=$<%]+(?:\s(?:\s*[^\s>\/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s'">=]+(?=[\s>]))|(?=[\s/>])))+)?\s*\/?>/,
          greedy: true,
          inside: {
            "tag": {
              pattern: /^<\/?[^\s>\/]+/,
              inside: {
                "punctuation": /^<\/?/,
                "namespace": /^[^\s>\/:]+:/
              }
            },
            "special-attr": [],
            "attr-value": {
              pattern: /=\s*(?:"[^"]*"|'[^']*'|[^\s'">=]+)/,
              inside: {
                "punctuation": [
                  {
                    pattern: /^=/,
                    alias: "attr-equals"
                  },
                  {
                    pattern: /^(\s*)["']|["']$/,
                    lookbehind: true
                  }
                ]
              }
            },
            "punctuation": /\/?>/,
            "attr-name": {
              pattern: /[^\s>\/]+/,
              inside: {
                "namespace": /^[^\s>\/:]+:/
              }
            }
          }
        },
        "entity": [
          {
            pattern: /&[\da-z]{1,8};/i,
            alias: "named-entity"
          },
          /&#x?[\da-f]{1,8};/i
        ]
      };
      Prism2.languages.markup["tag"].inside["attr-value"].inside["entity"] = Prism2.languages.markup["entity"];
      Prism2.languages.markup["doctype"].inside["internal-subset"].inside = Prism2.languages.markup;
      Prism2.hooks.add("wrap", function(env) {
        if (env.type === "entity") {
          env.attributes["title"] = env.content.replace(/&amp;/, "&");
        }
      });
      Object.defineProperty(Prism2.languages.markup.tag, "addInlined", {
        /**
         * Adds an inlined language to markup.
         *
         * An example of an inlined language is CSS with `<style>` tags.
         *
         * @param {string} tagName The name of the tag that contains the inlined language. This name will be treated as
         * case insensitive.
         * @param {string} lang The language key.
         * @example
         * addInlined('style', 'css');
         */
        value: function addInlined2(tagName, lang) {
          var includedCdataInside = {};
          includedCdataInside["language-" + lang] = {
            pattern: /(^<!\[CDATA\[)[\s\S]+?(?=\]\]>$)/i,
            lookbehind: true,
            inside: Prism2.languages[lang]
          };
          includedCdataInside["cdata"] = /^<!\[CDATA\[|\]\]>$/i;
          var inside = {
            "included-cdata": {
              pattern: /<!\[CDATA\[[\s\S]*?\]\]>/i,
              inside: includedCdataInside
            }
          };
          inside["language-" + lang] = {
            pattern: /[\s\S]+/,
            inside: Prism2.languages[lang]
          };
          var def = {};
          def[tagName] = {
            pattern: RegExp(/(<__[^>]*>)(?:<!\[CDATA\[(?:[^\]]|\](?!\]>))*\]\]>|(?!<!\[CDATA\[)[\s\S])*?(?=<\/__>)/.source.replace(/__/g, function() {
              return tagName;
            }), "i"),
            lookbehind: true,
            greedy: true,
            inside
          };
          Prism2.languages.insertBefore("markup", "cdata", def);
        }
      });
      Object.defineProperty(Prism2.languages.markup.tag, "addAttribute", {
        /**
         * Adds an pattern to highlight languages embedded in HTML attributes.
         *
         * An example of an inlined language is CSS with `style` attributes.
         *
         * @param {string} attrName The name of the tag that contains the inlined language. This name will be treated as
         * case insensitive.
         * @param {string} lang The language key.
         * @example
         * addAttribute('style', 'css');
         */
        value: function(attrName, lang) {
          Prism2.languages.markup.tag.inside["special-attr"].push({
            pattern: RegExp(
              /(^|["'\s])/.source + "(?:" + attrName + ")" + /\s*=\s*(?:"[^"]*"|'[^']*'|[^\s'">=]+(?=[\s>]))/.source,
              "i"
            ),
            lookbehind: true,
            inside: {
              "attr-name": /^[^\s=]+/,
              "attr-value": {
                pattern: /=[\s\S]+/,
                inside: {
                  "value": {
                    pattern: /(^=\s*(["']|(?!["'])))\S[\s\S]*(?=\2$)/,
                    lookbehind: true,
                    alias: [lang, "language-" + lang],
                    inside: Prism2.languages[lang]
                  },
                  "punctuation": [
                    {
                      pattern: /^=/,
                      alias: "attr-equals"
                    },
                    /"|'/
                  ]
                }
              }
            }
          });
        }
      });
      Prism2.languages.html = Prism2.languages.markup;
      Prism2.languages.mathml = Prism2.languages.markup;
      Prism2.languages.svg = Prism2.languages.markup;
      Prism2.languages.xml = Prism2.languages.extend("markup", {});
      Prism2.languages.ssml = Prism2.languages.xml;
      Prism2.languages.atom = Prism2.languages.xml;
      Prism2.languages.rss = Prism2.languages.xml;
      (function(Prism3) {
        var string = /(?:"(?:\\(?:\r\n|[\s\S])|[^"\\\r\n])*"|'(?:\\(?:\r\n|[\s\S])|[^'\\\r\n])*')/;
        Prism3.languages.css = {
          "comment": /\/\*[\s\S]*?\*\//,
          "atrule": {
            pattern: RegExp("@[\\w-](?:" + /[^;{\s"']|\s+(?!\s)/.source + "|" + string.source + ")*?" + /(?:;|(?=\s*\{))/.source),
            inside: {
              "rule": /^@[\w-]+/,
              "selector-function-argument": {
                pattern: /(\bselector\s*\(\s*(?![\s)]))(?:[^()\s]|\s+(?![\s)])|\((?:[^()]|\([^()]*\))*\))+(?=\s*\))/,
                lookbehind: true,
                alias: "selector"
              },
              "keyword": {
                pattern: /(^|[^\w-])(?:and|not|only|or)(?![\w-])/,
                lookbehind: true
              }
              // See rest below
            }
          },
          "url": {
            // https://drafts.csswg.org/css-values-3/#urls
            pattern: RegExp("\\burl\\((?:" + string.source + "|" + /(?:[^\\\r\n()"']|\\[\s\S])*/.source + ")\\)", "i"),
            greedy: true,
            inside: {
              "function": /^url/i,
              "punctuation": /^\(|\)$/,
              "string": {
                pattern: RegExp("^" + string.source + "$"),
                alias: "url"
              }
            }
          },
          "selector": {
            pattern: RegExp(`(^|[{}\\s])[^{}\\s](?:[^{};"'\\s]|\\s+(?![\\s{])|` + string.source + ")*(?=\\s*\\{)"),
            lookbehind: true
          },
          "string": {
            pattern: string,
            greedy: true
          },
          "property": {
            pattern: /(^|[^-\w\xA0-\uFFFF])(?!\s)[-_a-z\xA0-\uFFFF](?:(?!\s)[-\w\xA0-\uFFFF])*(?=\s*:)/i,
            lookbehind: true
          },
          "important": /!important\b/i,
          "function": {
            pattern: /(^|[^-a-z0-9])[-a-z0-9]+(?=\()/i,
            lookbehind: true
          },
          "punctuation": /[(){};:,]/
        };
        Prism3.languages.css["atrule"].inside.rest = Prism3.languages.css;
        var markup = Prism3.languages.markup;
        if (markup) {
          markup.tag.addInlined("style", "css");
          markup.tag.addAttribute("style", "css");
        }
      })(Prism2);
      Prism2.languages.clike = {
        "comment": [
          {
            pattern: /(^|[^\\])\/\*[\s\S]*?(?:\*\/|$)/,
            lookbehind: true,
            greedy: true
          },
          {
            pattern: /(^|[^\\:])\/\/.*/,
            lookbehind: true,
            greedy: true
          }
        ],
        "string": {
          pattern: /(["'])(?:\\(?:\r\n|[\s\S])|(?!\1)[^\\\r\n])*\1/,
          greedy: true
        },
        "class-name": {
          pattern: /(\b(?:class|extends|implements|instanceof|interface|new|trait)\s+|\bcatch\s+\()[\w.\\]+/i,
          lookbehind: true,
          inside: {
            "punctuation": /[.\\]/
          }
        },
        "keyword": /\b(?:break|catch|continue|do|else|finally|for|function|if|in|instanceof|new|null|return|throw|try|while)\b/,
        "boolean": /\b(?:false|true)\b/,
        "function": /\b\w+(?=\()/,
        "number": /\b0x[\da-f]+\b|(?:\b\d+(?:\.\d*)?|\B\.\d+)(?:e[+-]?\d+)?/i,
        "operator": /[<>]=?|[!=]=?=?|--?|\+\+?|&&?|\|\|?|[?*/~^%]/,
        "punctuation": /[{}[\];(),.:]/
      };
      Prism2.languages.javascript = Prism2.languages.extend("clike", {
        "class-name": [
          Prism2.languages.clike["class-name"],
          {
            pattern: /(^|[^$\w\xA0-\uFFFF])(?!\s)[_$A-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*(?=\.(?:constructor|prototype))/,
            lookbehind: true
          }
        ],
        "keyword": [
          {
            pattern: /((?:^|\})\s*)catch\b/,
            lookbehind: true
          },
          {
            pattern: /(^|[^.]|\.\.\.\s*)\b(?:as|assert(?=\s*\{)|async(?=\s*(?:function\b|\(|[$\w\xA0-\uFFFF]|$))|await|break|case|class|const|continue|debugger|default|delete|do|else|enum|export|extends|finally(?=\s*(?:\{|$))|for|from(?=\s*(?:['"]|$))|function|(?:get|set)(?=\s*(?:[#\[$\w\xA0-\uFFFF]|$))|if|implements|import|in|instanceof|interface|let|new|null|of|package|private|protected|public|return|static|super|switch|this|throw|try|typeof|undefined|var|void|while|with|yield)\b/,
            lookbehind: true
          }
        ],
        // Allow for all non-ASCII characters (See http://stackoverflow.com/a/2008444)
        "function": /#?(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*(?=\s*(?:\.\s*(?:apply|bind|call)\s*)?\()/,
        "number": {
          pattern: RegExp(
            /(^|[^\w$])/.source + "(?:" + // constant
            (/NaN|Infinity/.source + "|" + // binary integer
            /0[bB][01]+(?:_[01]+)*n?/.source + "|" + // octal integer
            /0[oO][0-7]+(?:_[0-7]+)*n?/.source + "|" + // hexadecimal integer
            /0[xX][\dA-Fa-f]+(?:_[\dA-Fa-f]+)*n?/.source + "|" + // decimal bigint
            /\d+(?:_\d+)*n/.source + "|" + // decimal number (integer or float) but no bigint
            /(?:\d+(?:_\d+)*(?:\.(?:\d+(?:_\d+)*)?)?|\.\d+(?:_\d+)*)(?:[Ee][+-]?\d+(?:_\d+)*)?/.source) + ")" + /(?![\w$])/.source
          ),
          lookbehind: true
        },
        "operator": /--|\+\+|\*\*=?|=>|&&=?|\|\|=?|[!=]==|<<=?|>>>?=?|[-+*/%&|^!=<>]=?|\.{3}|\?\?=?|\?\.?|[~:]/
      });
      Prism2.languages.javascript["class-name"][0].pattern = /(\b(?:class|extends|implements|instanceof|interface|new)\s+)[\w.\\]+/;
      Prism2.languages.insertBefore("javascript", "keyword", {
        "regex": {
          pattern: RegExp(
            // lookbehind
            // eslint-disable-next-line regexp/no-dupe-characters-character-class
            /((?:^|[^$\w\xA0-\uFFFF."'\])\s]|\b(?:return|yield))\s*)/.source + // Regex pattern:
            // There are 2 regex patterns here. The RegExp set notation proposal added support for nested character
            // classes if the `v` flag is present. Unfortunately, nested CCs are both context-free and incompatible
            // with the only syntax, so we have to define 2 different regex patterns.
            /\//.source + "(?:" + /(?:\[(?:[^\]\\\r\n]|\\.)*\]|\\.|[^/\\\[\r\n])+\/[dgimyus]{0,7}/.source + "|" + // `v` flag syntax. This supports 3 levels of nested character classes.
            /(?:\[(?:[^[\]\\\r\n]|\\.|\[(?:[^[\]\\\r\n]|\\.|\[(?:[^[\]\\\r\n]|\\.)*\])*\])*\]|\\.|[^/\\\[\r\n])+\/[dgimyus]{0,7}v[dgimyus]{0,7}/.source + ")" + // lookahead
            /(?=(?:\s|\/\*(?:[^*]|\*(?!\/))*\*\/)*(?:$|[\r\n,.;:})\]]|\/\/))/.source
          ),
          lookbehind: true,
          greedy: true,
          inside: {
            "regex-source": {
              pattern: /^(\/)[\s\S]+(?=\/[a-z]*$)/,
              lookbehind: true,
              alias: "language-regex",
              inside: Prism2.languages.regex
            },
            "regex-delimiter": /^\/|\/$/,
            "regex-flags": /^[a-z]+$/
          }
        },
        // This must be declared before keyword because we use "function" inside the look-forward
        "function-variable": {
          pattern: /#?(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*(?=\s*[=:]\s*(?:async\s*)?(?:\bfunction\b|(?:\((?:[^()]|\([^()]*\))*\)|(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*)\s*=>))/,
          alias: "function"
        },
        "parameter": [
          {
            pattern: /(function(?:\s+(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*)?\s*\(\s*)(?!\s)(?:[^()\s]|\s+(?![\s)])|\([^()]*\))+(?=\s*\))/,
            lookbehind: true,
            inside: Prism2.languages.javascript
          },
          {
            pattern: /(^|[^$\w\xA0-\uFFFF])(?!\s)[_$a-z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*(?=\s*=>)/i,
            lookbehind: true,
            inside: Prism2.languages.javascript
          },
          {
            pattern: /(\(\s*)(?!\s)(?:[^()\s]|\s+(?![\s)])|\([^()]*\))+(?=\s*\)\s*=>)/,
            lookbehind: true,
            inside: Prism2.languages.javascript
          },
          {
            pattern: /((?:\b|\s|^)(?!(?:as|async|await|break|case|catch|class|const|continue|debugger|default|delete|do|else|enum|export|extends|finally|for|from|function|get|if|implements|import|in|instanceof|interface|let|new|null|of|package|private|protected|public|return|set|static|super|switch|this|throw|try|typeof|undefined|var|void|while|with|yield)(?![$\w\xA0-\uFFFF]))(?:(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*\s*)\(\s*|\]\s*\(\s*)(?!\s)(?:[^()\s]|\s+(?![\s)])|\([^()]*\))+(?=\s*\)\s*\{)/,
            lookbehind: true,
            inside: Prism2.languages.javascript
          }
        ],
        "constant": /\b[A-Z](?:[A-Z_]|\dx?)*\b/
      });
      Prism2.languages.insertBefore("javascript", "string", {
        "hashbang": {
          pattern: /^#!.*/,
          greedy: true,
          alias: "comment"
        },
        "template-string": {
          pattern: /`(?:\\[\s\S]|\$\{(?:[^{}]|\{(?:[^{}]|\{[^}]*\})*\})+\}|(?!\$\{)[^\\`])*`/,
          greedy: true,
          inside: {
            "template-punctuation": {
              pattern: /^`|`$/,
              alias: "string"
            },
            "interpolation": {
              pattern: /((?:^|[^\\])(?:\\{2})*)\$\{(?:[^{}]|\{(?:[^{}]|\{[^}]*\})*\})+\}/,
              lookbehind: true,
              inside: {
                "interpolation-punctuation": {
                  pattern: /^\$\{|\}$/,
                  alias: "punctuation"
                },
                rest: Prism2.languages.javascript
              }
            },
            "string": /[\s\S]+/
          }
        },
        "string-property": {
          pattern: /((?:^|[,{])[ \t]*)(["'])(?:\\(?:\r\n|[\s\S])|(?!\2)[^\\\r\n])*\2(?=\s*:)/m,
          lookbehind: true,
          greedy: true,
          alias: "property"
        }
      });
      Prism2.languages.insertBefore("javascript", "operator", {
        "literal-property": {
          pattern: /((?:^|[,{])[ \t]*)(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*(?=\s*:)/m,
          lookbehind: true,
          alias: "property"
        }
      });
      if (Prism2.languages.markup) {
        Prism2.languages.markup.tag.addInlined("script", "javascript");
        Prism2.languages.markup.tag.addAttribute(
          /on(?:abort|blur|change|click|composition(?:end|start|update)|dblclick|error|focus(?:in|out)?|key(?:down|up)|load|mouse(?:down|enter|leave|move|out|over|up)|reset|resize|scroll|select|slotchange|submit|unload|wheel)/.source,
          "javascript"
        );
      }
      Prism2.languages.js = Prism2.languages.javascript;
      (function() {
        if (typeof Prism2 === "undefined" || typeof document === "undefined") {
          return;
        }
        if (!Element.prototype.matches) {
          Element.prototype.matches = Element.prototype.msMatchesSelector || Element.prototype.webkitMatchesSelector;
        }
        var LOADING_MESSAGE = "Loading\u2026";
        var FAILURE_MESSAGE = function(status, message) {
          return "\u2716 Error " + status + " while fetching file: " + message;
        };
        var FAILURE_EMPTY_MESSAGE = "\u2716 Error: File does not exist or is empty";
        var EXTENSIONS = {
          "js": "javascript",
          "py": "python",
          "rb": "ruby",
          "ps1": "powershell",
          "psm1": "powershell",
          "sh": "bash",
          "bat": "batch",
          "h": "c",
          "tex": "latex"
        };
        var STATUS_ATTR = "data-src-status";
        var STATUS_LOADING = "loading";
        var STATUS_LOADED = "loaded";
        var STATUS_FAILED = "failed";
        var SELECTOR = "pre[data-src]:not([" + STATUS_ATTR + '="' + STATUS_LOADED + '"]):not([' + STATUS_ATTR + '="' + STATUS_LOADING + '"])';
        function loadFile(src, success, error) {
          var xhr = new XMLHttpRequest();
          xhr.open("GET", src, true);
          xhr.onreadystatechange = function() {
            if (xhr.readyState == 4) {
              if (xhr.status < 400 && xhr.responseText) {
                success(xhr.responseText);
              } else {
                if (xhr.status >= 400) {
                  error(FAILURE_MESSAGE(xhr.status, xhr.statusText));
                } else {
                  error(FAILURE_EMPTY_MESSAGE);
                }
              }
            }
          };
          xhr.send(null);
        }
        function parseRange(range) {
          var m3 = /^\s*(\d+)\s*(?:(,)\s*(?:(\d+)\s*)?)?$/.exec(range || "");
          if (m3) {
            var start = Number(m3[1]);
            var comma = m3[2];
            var end = m3[3];
            if (!comma) {
              return [start, start];
            }
            if (!end) {
              return [start, void 0];
            }
            return [start, Number(end)];
          }
          return void 0;
        }
        Prism2.hooks.add("before-highlightall", function(env) {
          env.selector += ", " + SELECTOR;
        });
        Prism2.hooks.add("before-sanity-check", function(env) {
          var pre = (
            /** @type {HTMLPreElement} */
            env.element
          );
          if (pre.matches(SELECTOR)) {
            env.code = "";
            pre.setAttribute(STATUS_ATTR, STATUS_LOADING);
            var code = pre.appendChild(document.createElement("CODE"));
            code.textContent = LOADING_MESSAGE;
            var src = pre.getAttribute("data-src");
            var language = env.language;
            if (language === "none") {
              var extension = (/\.(\w+)$/.exec(src) || [, "none"])[1];
              language = EXTENSIONS[extension] || extension;
            }
            Prism2.util.setLanguage(code, language);
            Prism2.util.setLanguage(pre, language);
            var autoloader = Prism2.plugins.autoloader;
            if (autoloader) {
              autoloader.loadLanguages(language);
            }
            loadFile(
              src,
              function(text) {
                pre.setAttribute(STATUS_ATTR, STATUS_LOADED);
                var range = parseRange(pre.getAttribute("data-range"));
                if (range) {
                  var lines = text.split(/\r\n?|\n/g);
                  var start = range[0];
                  var end = range[1] == null ? lines.length : range[1];
                  if (start < 0) {
                    start += lines.length;
                  }
                  start = Math.max(0, Math.min(start - 1, lines.length));
                  if (end < 0) {
                    end += lines.length;
                  }
                  end = Math.max(0, Math.min(end, lines.length));
                  text = lines.slice(start, end).join("\n");
                  if (!pre.hasAttribute("data-start")) {
                    pre.setAttribute("data-start", String(start + 1));
                  }
                }
                code.textContent = text;
                Prism2.highlightElement(code);
              },
              function(error) {
                pre.setAttribute(STATUS_ATTR, STATUS_FAILED);
                code.textContent = error;
              }
            );
          }
        });
        Prism2.plugins.fileHighlight = {
          /**
           * Executes the File Highlight plugin for all matching `pre` elements under the given container.
           *
           * Note: Elements which are already loaded or currently loading will not be touched by this method.
           *
           * @param {ParentNode} [container=document]
           */
          highlight: function highlight(container) {
            var elements = (container || document).querySelectorAll(SELECTOR);
            for (var i3 = 0, element; element = elements[i3++]; ) {
              Prism2.highlightElement(element);
            }
          }
        };
        var logged = false;
        Prism2.fileHighlight = function() {
          if (!logged) {
            console.warn("Prism.fileHighlight is deprecated. Use `Prism.plugins.fileHighlight.highlight` instead.");
            logged = true;
          }
          Prism2.plugins.fileHighlight.highlight.apply(this, arguments);
        };
      })();
    }
  });

  // src/shared/lexical/browser/index.ts
  var index_exports = {};
  __export(index_exports, {
    $addUpdateTag: () => $addUpdateTag,
    $applyNodeReplacement: () => $applyNodeReplacement,
    $computeTableMap: () => $computeTableMap,
    $computeTableMapSkipCellCheck: () => $computeTableMapSkipCellCheck,
    $copyNode: () => $copyNode,
    $createAutoLinkNode: () => $createAutoLinkNode,
    $createCodeHighlightNode: () => $createCodeHighlightNode2,
    $createCodeNode: () => $createCodeNode2,
    $createHeadingNode: () => $createHeadingNode,
    $createLinkNode: () => $createLinkNode,
    $createListItemNode: () => $createListItemNode,
    $createListNode: () => $createListNode,
    $createParagraphNode: () => $createParagraphNode,
    $createQuoteNode: () => $createQuoteNode,
    $createTableCellNode: () => $createTableCellNode,
    $createTableNode: () => $createTableNode,
    $createTableRowNode: () => $createTableRowNode,
    $createTextNode: () => $createTextNode,
    $deleteTableColumn: () => $deleteTableColumn,
    $deleteTableColumn__EXPERIMENTAL: () => $deleteTableColumn__EXPERIMENTAL,
    $deleteTableRow__EXPERIMENTAL: () => $deleteTableRow__EXPERIMENTAL,
    $findMatchingParent: () => $findMatchingParent2,
    $generateHtmlFromNodes: () => $generateHtmlFromNodes,
    $generateNodesFromDOM: () => $generateNodesFromDOM,
    $getAdjacentNode: () => $getAdjacentNode,
    $getHtmlContent: () => $getHtmlContent,
    $getLexicalContent: () => $getLexicalContent,
    $getListDepth: () => $getListDepth,
    $getNearestBlockElementAncestorOrThrow: () => $getNearestBlockElementAncestorOrThrow,
    $getNearestNodeFromDOMNode: () => $getNearestNodeFromDOMNode,
    $getNearestNodeOfType: () => $getNearestNodeOfType,
    $getNearestRootOrShadowRoot: () => $getNearestRootOrShadowRoot,
    $getNodeByKey: () => $getNodeByKey,
    $getRoot: () => $getRoot,
    $getSelection: () => $getSelection,
    $getSelectionStyleValueForProperty: () => $getSelectionStyleValueForProperty,
    $getTableCellNodeFromLexicalNode: () => $getTableCellNodeFromLexicalNode,
    $getTableColumnIndexFromTableCellNode: () => $getTableColumnIndexFromTableCellNode,
    $getTableNodeFromLexicalNodeOrThrow: () => $getTableNodeFromLexicalNodeOrThrow,
    $getTableRowIndexFromTableCellNode: () => $getTableRowIndexFromTableCellNode,
    $handleListInsertParagraph: () => $handleListInsertParagraph,
    $hasAncestor: () => $hasAncestor,
    $hasUpdateTag: () => $hasUpdateTag,
    $insertDataTransferForPlainText: () => $insertDataTransferForPlainText,
    $insertDataTransferForRichText: () => $insertDataTransferForRichText,
    $insertGeneratedNodes: () => $insertGeneratedNodes,
    $insertNodeToNearestRoot: () => $insertNodeToNearestRoot,
    $insertNodes: () => $insertNodes,
    $insertTableColumn: () => $insertTableColumn,
    $insertTableColumn__EXPERIMENTAL: () => $insertTableColumn__EXPERIMENTAL,
    $insertTableRow: () => $insertTableRow,
    $insertTableRow__EXPERIMENTAL: () => $insertTableRow__EXPERIMENTAL,
    $isAutoLinkNode: () => $isAutoLinkNode,
    $isCodeHighlightNode: () => $isCodeHighlightNode2,
    $isCodeNode: () => $isCodeNode2,
    $isDecoratorNode: () => $isDecoratorNode,
    $isElementNode: () => $isElementNode,
    $isHeadingNode: () => $isHeadingNode,
    $isLineBreakNode: () => $isLineBreakNode,
    $isLinkNode: () => $isLinkNode,
    $isListItemNode: () => $isListItemNode,
    $isListNode: () => $isListNode,
    $isNodeSelection: () => $isNodeSelection,
    $isParagraphNode: () => $isParagraphNode,
    $isParentElementRTL: () => $isParentElementRTL,
    $isQuoteNode: () => $isQuoteNode,
    $isRangeSelection: () => $isRangeSelection,
    $isRootNode: () => $isRootNode,
    $isRootOrShadowRoot: () => $isRootOrShadowRoot,
    $isTabNode: () => $isTabNode,
    $isTableCellNode: () => $isTableCellNode,
    $isTableNode: () => $isTableNode,
    $isTableRowNode: () => $isTableRowNode,
    $isTextNode: () => $isTextNode,
    $moveCharacter: () => $moveCharacter,
    $nodesOfType: () => $nodesOfType,
    $parseSerializedNode: () => $parseSerializedNode,
    $patchStyleText: () => $patchStyleText,
    $restoreEditorState: () => $restoreEditorState,
    $selectAll: () => $selectAll,
    $selectionSelectAll: () => $selectAll2,
    $setBlocksType: () => $setBlocksType,
    $setSelection: () => $setSelection,
    $shouldOverrideDefaultCharacterSelection: () => $shouldOverrideDefaultCharacterSelection,
    $sliceSelectedTextNodeContent: () => $sliceSelectedTextNodeContent,
    $splitNode: () => $splitNode,
    $trimTextContentFromAnchor: () => $trimTextContentFromAnchor,
    $unmergeCell: () => $unmergeCell,
    $utilsSplitNode: () => $splitNode2,
    $wrapNodeInElement: () => $wrapNodeInElement,
    AutoLinkNode: () => AutoLinkNode,
    BLUR_COMMAND: () => BLUR_COMMAND,
    CAN_REDO_COMMAND: () => CAN_REDO_COMMAND,
    CAN_UNDO_COMMAND: () => CAN_UNDO_COMMAND,
    CLEAR_EDITOR_COMMAND: () => CLEAR_EDITOR_COMMAND,
    CLEAR_HISTORY_COMMAND: () => CLEAR_HISTORY_COMMAND,
    CLICK_COMMAND: () => CLICK_COMMAND,
    COMMAND_PRIORITY_CRITICAL: () => COMMAND_PRIORITY_CRITICAL,
    COMMAND_PRIORITY_EDITOR: () => COMMAND_PRIORITY_EDITOR,
    COMMAND_PRIORITY_HIGH: () => COMMAND_PRIORITY_HIGH,
    COMMAND_PRIORITY_LOW: () => COMMAND_PRIORITY_LOW,
    COMMAND_PRIORITY_NORMAL: () => COMMAND_PRIORITY_NORMAL,
    CONNECTED_COMMAND: () => CONNECTED_COMMAND,
    CONTROLLED_TEXT_INSERTION_COMMAND: () => CONTROLLED_TEXT_INSERTION_COMMAND,
    COPY_COMMAND: () => COPY_COMMAND,
    CUT_COMMAND: () => CUT_COMMAND,
    CodeHighlightNode: () => CodeHighlightNode2,
    CodeNode: () => CodeNode2,
    DRAGOVER_COMMAND: () => DRAGOVER_COMMAND,
    DRAGSTART_COMMAND: () => DRAGSTART_COMMAND,
    DROP_COMMAND: () => DROP_COMMAND,
    DecoratorNode: () => DecoratorNode,
    ElementNode: () => ElementNode,
    FOCUS_COMMAND: () => FOCUS_COMMAND,
    FORMAT_ELEMENT_COMMAND: () => FORMAT_ELEMENT_COMMAND,
    FORMAT_TEXT_COMMAND: () => FORMAT_TEXT_COMMAND,
    HeadingNode: () => HeadingNode,
    INSERT_LINE_BREAK_COMMAND: () => INSERT_LINE_BREAK_COMMAND,
    INSERT_PARAGRAPH_COMMAND: () => INSERT_PARAGRAPH_COMMAND,
    INSERT_TABLE_COMMAND: () => INSERT_TABLE_COMMAND,
    KEY_ARROW_DOWN_COMMAND: () => KEY_ARROW_DOWN_COMMAND,
    KEY_ARROW_LEFT_COMMAND: () => KEY_ARROW_LEFT_COMMAND,
    KEY_ARROW_RIGHT_COMMAND: () => KEY_ARROW_RIGHT_COMMAND,
    KEY_ARROW_UP_COMMAND: () => KEY_ARROW_UP_COMMAND,
    KEY_BACKSPACE_COMMAND: () => KEY_BACKSPACE_COMMAND,
    KEY_DELETE_COMMAND: () => KEY_DELETE_COMMAND,
    KEY_ENTER_COMMAND: () => KEY_ENTER_COMMAND,
    KEY_ESCAPE_COMMAND: () => KEY_ESCAPE_COMMAND,
    KEY_TAB_COMMAND: () => KEY_TAB_COMMAND,
    LineBreakNode: () => LineBreakNode,
    LinkNode: () => LinkNode,
    ListItemNode: () => ListItemNode,
    ListNode: () => ListNode,
    PASTE_COMMAND: () => PASTE_COMMAND,
    ParagraphNode: () => ParagraphNode,
    QuoteNode: () => QuoteNode,
    REDO_COMMAND: () => REDO_COMMAND,
    RootNode: () => RootNode,
    SELECTION_CHANGE_COMMAND: () => SELECTION_CHANGE_COMMAND,
    TOGGLE_CONNECT_COMMAND: () => TOGGLE_CONNECT_COMMAND,
    TOGGLE_LINK_COMMAND: () => TOGGLE_LINK_COMMAND,
    TabNode: () => TabNode,
    TableCellNode: () => TableCellNode,
    TableNode: () => TableNode,
    TableObserver: () => TableObserver,
    TableRowNode: () => TableRowNode,
    TextNode: () => TextNode,
    UNDO_COMMAND: () => UNDO_COMMAND,
    copyToClipboard: () => copyToClipboard,
    createBinding: () => createBinding,
    createBindingV2__EXPERIMENTAL: () => createBindingV2__EXPERIMENTAL,
    createEditor: () => createEditor,
    createEmptyHistoryState: () => createEmptyHistoryState,
    createUndoManager: () => createUndoManager,
    getCodeLanguages: () => getCodeLanguages,
    getDefaultCodeLanguage: () => getDefaultCodeLanguage,
    getNearestEditorFromDOMNode: () => getNearestEditorFromDOMNode,
    initLocalState: () => initLocalState,
    insertList: () => insertList,
    isHTMLAnchorElement: () => isHTMLAnchorElement2,
    isHTMLElement: () => isHTMLElement,
    isHTMLElementUtils: () => isHTMLElement2,
    mergeRegister: () => mergeRegister,
    registerCodeHighlighting: () => registerCodeHighlighting,
    registerHistory: () => registerHistory,
    registerList: () => registerList,
    registerNestedElementResolver: () => registerNestedElementResolver,
    registerRichText: () => registerRichText,
    registerTablePlugin: () => registerTablePlugin,
    removeList: () => removeList,
    setLocalStateFocus: () => setLocalStateFocus,
    syncCursorPositions: () => syncCursorPositions,
    syncLexicalUpdateToYjs: () => syncLexicalUpdateToYjs,
    syncLexicalUpdateToYjsV2__EXPERIMENTAL: () => syncLexicalUpdateToYjsV2__EXPERIMENTAL,
    syncYjsChangesToLexical: () => syncYjsChangesToLexical,
    syncYjsChangesToLexicalV2__EXPERIMENTAL: () => syncYjsChangesToLexicalV2__EXPERIMENTAL,
    syncYjsStateToLexicalV2__EXPERIMENTAL: () => syncYjsStateToLexicalV2__EXPERIMENTAL,
    toggleLink: () => toggleLink
  });

  // node_modules/lexical/Lexical.prod.mjs
  var Lexical_prod_exports = {};
  __export(Lexical_prod_exports, {
    $addUpdateTag: () => fs,
    $applyNodeReplacement: () => Cs,
    $caretFromPoint: () => El,
    $caretRangeFromSelection: () => Pl,
    $cloneWithProperties: () => Rs,
    $cloneWithPropertiesEphemeral: () => Bs,
    $comparePointCaretNext: () => kl,
    $copyNode: () => xs,
    $create: () => Vs,
    $createLineBreakNode: () => Xn,
    $createNodeSelection: () => Wr,
    $createParagraphNode: () => $i,
    $createPoint: () => vr,
    $createRangeSelection: () => Br,
    $createRangeSelectionFromDom: () => Jr,
    $createTabNode: () => xr,
    $createTextNode: () => _r,
    $extendCaretToRange: () => xl,
    $findMatchingParent: () => Ys,
    $getAdjacentChildCaret: () => _l,
    $getAdjacentNode: () => rs,
    $getAdjacentSiblingOrParentSiblingCaret: () => Jl,
    $getCaretInDirection: () => Rl,
    $getCaretRange: () => Sl,
    $getCaretRangeInDirection: () => Bl,
    $getCharacterOffsets: () => Mr,
    $getChildCaret: () => hl,
    $getChildCaretAtIndex: () => Wl,
    $getChildCaretOrSelf: () => gl,
    $getCollapsedCaretRange: () => Cl,
    $getCommonAncestor: () => wl,
    $getCommonAncestorResultBranchOrder: () => Tl,
    $getEditor: () => Ls,
    $getNearestNodeFromDOMNode: () => Ao,
    $getNearestRootOrShadowRoot: () => ys,
    $getNodeByKey: () => Eo,
    $getNodeByKeyOrThrow: () => vs,
    $getNodeFromDOMNode: () => Oo,
    $getPreviousSelection: () => Ur,
    $getRoot: () => Fo,
    $getSelection: () => $r,
    $getSiblingCaret: () => al,
    $getState: () => st,
    $getStateChange: () => lt,
    $getTextContent: () => Zr,
    $getTextNodeOffset: () => fl,
    $getTextPointCaret: () => ul,
    $getTextPointCaretSlice: () => dl,
    $getWritableNodeState: () => ft,
    $hasAncestor: () => hs,
    $hasUpdateTag: () => us,
    $insertNodes: () => Qr,
    $isBlockElementNode: () => zr,
    $isChildCaret: () => ol,
    $isDecoratorNode: () => Di,
    $isEditorState: () => Ri,
    $isElementNode: () => Mi,
    $isExtendableTextPointCaret: () => zl,
    $isInlineElementOrDecoratorNode: () => ps,
    $isLeafNode: () => vo,
    $isLineBreakNode: () => Qn,
    $isNodeCaret: () => rl,
    $isNodeSelection: () => Er,
    $isParagraphNode: () => Ui,
    $isRangeSelection: () => br,
    $isRootNode: () => Li,
    $isRootOrShadowRoot: () => ms,
    $isSiblingCaret: () => il,
    $isTabNode: () => Cr,
    $isTextNode: () => pr,
    $isTextPointCaret: () => nl,
    $isTextPointCaretSlice: () => ml,
    $isTokenOrSegmented: () => yo,
    $isTokenOrTab: () => po,
    $nodesOfType: () => es,
    $normalizeCaret: () => Kl,
    $normalizeSelection__EXPERIMENTAL: () => St,
    $onUpdate: () => ds,
    $parseSerializedNode: () => xi,
    $removeTextFromCaretRange: () => Il,
    $rewindSiblingCaret: () => Dl,
    $selectAll: () => Qo,
    $setCompositionKey: () => bo,
    $setPointFromCaret: () => Ol,
    $setSelection: () => Io,
    $setSelectionFromCaretRange: () => Ml,
    $setState: () => ct,
    $splitAtPointCaretNext: () => Ul,
    $splitNode: () => ws,
    $updateRangeSelectionFromCaretRange: () => Al,
    ArtificialNode__DO_NOT_USE: () => Wi,
    BEFORE_INPUT_COMMAND: () => le,
    BLUR_COMMAND: () => Xe,
    CAN_REDO_COMMAND: () => qe,
    CAN_UNDO_COMMAND: () => He,
    CLEAR_EDITOR_COMMAND: () => Ve,
    CLEAR_HISTORY_COMMAND: () => Ye,
    CLICK_COMMAND: () => se,
    COLLABORATION_TAG: () => $n,
    COMMAND_PRIORITY_CRITICAL: () => Gi,
    COMMAND_PRIORITY_EDITOR: () => Vi,
    COMMAND_PRIORITY_HIGH: () => Hi,
    COMMAND_PRIORITY_LOW: () => Yi,
    COMMAND_PRIORITY_NORMAL: () => qi,
    COMPOSITION_END_COMMAND: () => ue,
    COMPOSITION_START_COMMAND: () => ae,
    CONTROLLED_TEXT_INSERTION_COMMAND: () => ge,
    COPY_COMMAND: () => je,
    CUT_COMMAND: () => $e,
    DELETE_CHARACTER_COMMAND: () => fe,
    DELETE_LINE_COMMAND: () => me,
    DELETE_WORD_COMMAND: () => ye,
    DRAGEND_COMMAND: () => Je,
    DRAGOVER_COMMAND: () => We,
    DRAGSTART_COMMAND: () => Be,
    DROP_COMMAND: () => ze,
    DecoratorNode: () => Pi,
    ElementNode: () => Oi,
    FOCUS_COMMAND: () => Ge,
    FORMAT_ELEMENT_COMMAND: () => Re,
    FORMAT_TEXT_COMMAND: () => xe,
    HISTORIC_TAG: () => Bn,
    HISTORY_MERGE_TAG: () => Jn,
    HISTORY_PUSH_TAG: () => Wn,
    INDENT_CONTENT_COMMAND: () => Ie,
    INPUT_COMMAND: () => ce,
    INSERT_LINE_BREAK_COMMAND: () => de,
    INSERT_PARAGRAPH_COMMAND: () => he,
    INSERT_TAB_COMMAND: () => Le,
    INTERNAL_$isBlock: () => Fs,
    IS_ALL_FORMATTING: () => N,
    IS_BOLD: () => y,
    IS_CODE: () => S,
    IS_HIGHLIGHT: () => T,
    IS_ITALIC: () => m,
    IS_STRIKETHROUGH: () => x,
    IS_SUBSCRIPT: () => v,
    IS_SUPERSCRIPT: () => k,
    IS_UNDERLINE: () => C,
    KEY_ARROW_DOWN_COMMAND: () => Ee,
    KEY_ARROW_LEFT_COMMAND: () => Ne,
    KEY_ARROW_RIGHT_COMMAND: () => ke,
    KEY_ARROW_UP_COMMAND: () => we,
    KEY_BACKSPACE_COMMAND: () => Ae,
    KEY_DELETE_COMMAND: () => De,
    KEY_DOWN_COMMAND: () => ve,
    KEY_ENTER_COMMAND: () => Oe,
    KEY_ESCAPE_COMMAND: () => Pe,
    KEY_MODIFIER_COMMAND: () => Qe,
    KEY_SPACE_COMMAND: () => Me,
    KEY_TAB_COMMAND: () => Fe,
    LineBreakNode: () => Hn,
    MOVE_TO_END: () => Te,
    MOVE_TO_START: () => be,
    NODE_STATE_KEY: () => U,
    OUTDENT_CONTENT_COMMAND: () => Ke,
    PASTE_COMMAND: () => _e,
    PASTE_TAG: () => jn,
    ParagraphNode: () => Ji,
    REDO_COMMAND: () => Se,
    REMOVE_TEXT_COMMAND: () => pe,
    RootNode: () => Fi,
    SELECTION_CHANGE_COMMAND: () => ie,
    SELECTION_INSERT_CLIPBOARD_NODES_COMMAND: () => oe,
    SELECT_ALL_COMMAND: () => Ue,
    SKIP_COLLAB_TAG: () => Un,
    SKIP_DOM_SELECTION_TAG: () => Yn,
    SKIP_SCROLL_INTO_VIEW_TAG: () => Vn,
    SKIP_SELECTION_FOCUS_TAG: () => qn,
    TEXT_TYPE_TO_FORMAT: () => R,
    TabNode: () => mr,
    TextNode: () => sr,
    UNDO_COMMAND: () => Ce,
    buildImportMap: () => In,
    configExtension: () => Yl,
    createCommand: () => re,
    createEditor: () => Zi,
    createSharedNodeState: () => at,
    createState: () => ot,
    declarePeerDependency: () => ql,
    defineExtension: () => Vl,
    flipDirection: () => Qs,
    getDOMOwnerDocument: () => as,
    getDOMSelection: () => Ns,
    getDOMSelectionFromTarget: () => bs,
    getDOMTextNode: () => Co,
    getEditorPropertyFromDOMNode: () => go,
    getNearestEditorFromDOMNode: () => ho,
    getRegisteredNode: () => so,
    getRegisteredNodeOrThrow: () => oo,
    getStaticNodeConfig: () => Us,
    getTextDirection: () => _o,
    getTransformSetFromKlass: () => Qi,
    isBlockDomNode: () => Ds,
    isCurrentlyReadOnlyMode: () => ai,
    isDOMDocumentNode: () => xo,
    isDOMNode: () => Ms,
    isDOMTextNode: () => mo,
    isDOMUnmanaged: () => js,
    isDocumentFragment: () => As,
    isExactShortcutMatch: () => Yo,
    isHTMLAnchorElement: () => Es,
    isHTMLElement: () => Os,
    isInlineDomNode: () => Ps,
    isLexicalEditor: () => fo,
    isModifierMatch: () => Vo,
    isSelectionCapturedInDecoratorInput: () => ao,
    isSelectionWithinEditor: () => uo,
    makeStepwiseIterator: () => vl,
    removeFromParent: () => To,
    resetRandomKey: () => io,
    safeCast: () => Hl,
    setDOMUnmanaged: () => Js,
    setNodeIndentFromDOM: () => Ws,
    shallowMergeConfig: () => Gl
  });
  function t(t2, ...e2) {
    const n2 = new URL("https://lexical.dev/docs/error"), r3 = new URLSearchParams();
    r3.append("code", t2);
    for (const t3 of e2) r3.append("v", t3);
    throw n2.search = r3.toString(), Error(`Minified Lexical error #${t2}; visit ${n2.toString()} for the full message or use the non-minified dev environment for full errors and additional helpful warnings.`);
  }
  function e(t2, ...e2) {
    const n2 = new URL("https://lexical.dev/docs/error"), r3 = new URLSearchParams();
    r3.append("code", t2);
    for (const t3 of e2) r3.append("v", t3);
    n2.search = r3.toString(), console.warn(`Minified Lexical warning #${t2}; visit ${n2.toString()} for the full message or use the non-minified dev environment for full errors and additional helpful warnings.`);
  }
  var n = "undefined" != typeof window && void 0 !== window.document && void 0 !== window.document.createElement;
  var r = n && "documentMode" in document ? document.documentMode : null;
  var i = n && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
  var o = n && /^(?!.*Seamonkey)(?=.*Firefox).*/i.test(navigator.userAgent);
  var s = !(!n || !("InputEvent" in window) || r) && "getTargetRanges" in new window.InputEvent("input");
  var l = n && /Version\/[\d.]+.*Safari/.test(navigator.userAgent);
  var c = n && /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  var a = n && /Android/.test(navigator.userAgent);
  var u = n && /^(?=.*Chrome).*/i.test(navigator.userAgent);
  var f = n && a && u;
  var d = n && /AppleWebKit\/[\d.]+/.test(navigator.userAgent) && i && !u;
  function h(...t2) {
    const e2 = [];
    for (const n2 of t2) if (n2 && "string" == typeof n2) for (const [t3] of n2.matchAll(/\S+/g)) e2.push(t3);
    return e2;
  }
  var g = 0;
  var _ = 1;
  var p = 2;
  var y = 1;
  var m = 2;
  var x = 4;
  var C = 8;
  var S = 16;
  var v = 32;
  var k = 64;
  var T = 128;
  var N = 2047;
  var b = 1;
  var w = 2;
  var E = 3;
  var O = 4;
  var M = 5;
  var A = 6;
  var P = l || c || d ? "\xA0" : "\u200B";
  var D = "\n\n";
  var F = o ? "\xA0" : P;
  var L = "\u0591-\u07FF\uFB1D-\uFDFD\uFE70-\uFEFC";
  var I = "A-Za-z\xC0-\xD6\xD8-\xF6\xF8-\u02B8\u0300-\u0590\u0800-\u1FFF\u200E\u2C00-\uFB1C\uFE00-\uFE6F\uFEFD-\uFFFF";
  var K = new RegExp("^[^" + I + "]*[" + L + "]");
  var z = new RegExp("^[^" + L + "]*[" + I + "]");
  var R = { bold: 1, capitalize: 1024, code: 16, highlight: T, italic: 2, lowercase: 256, strikethrough: 4, subscript: 32, superscript: 64, underline: 8, uppercase: 512 };
  var B = { directionless: 1, unmergeable: 2 };
  var W = { center: 2, end: 6, justify: 4, left: 1, right: 3, start: 5 };
  var J = { [w]: "center", [A]: "end", [O]: "justify", [b]: "left", [E]: "right", [M]: "start" };
  var j = { normal: 0, segmented: 2, token: 1 };
  var $ = { [g]: "normal", [p]: "segmented", [_]: "token" };
  var U = "$";
  var V = "$config";
  function Y(t2, e2, n2, r3, i3, o2) {
    let s4 = t2.getFirstChild();
    for (; null !== s4; ) {
      const t3 = s4.__key;
      s4.__parent === e2 && (Mi(s4) && Y(s4, t3, n2, r3, i3, o2), n2.has(t3) || o2.delete(t3), i3.push(t3)), s4 = s4.getNextSibling();
    }
  }
  var q = false;
  var H = 0;
  function G(t2) {
    H = t2.timeStamp;
  }
  function X(t2, e2, n2) {
    const r3 = "BR" === t2.nodeName, i3 = e2.__lexicalLineBreak;
    return i3 && (t2 === i3 || r3 && t2.previousSibling === i3) || r3 && void 0 !== Mo(t2, n2);
  }
  function Q(t2, e2, n2) {
    const r3 = Ns(_s(n2));
    let i3 = null, o2 = null;
    null !== r3 && r3.anchorNode === t2 && (i3 = r3.anchorOffset, o2 = r3.focusOffset);
    const s4 = t2.nodeValue;
    null !== s4 && jo(e2, s4, i3, o2, false);
  }
  function Z(t2, e2, n2) {
    if (br(t2)) {
      const e3 = t2.anchor.getNode();
      if (e3.is(n2) && t2.format !== e3.getFormat()) return false;
    }
    return mo(e2) && n2.isAttached();
  }
  function tt(t2, e2, n2, r3) {
    for (let i3 = t2; i3 && !js(i3); i3 = cs(i3)) {
      const t3 = Mo(i3, e2);
      if (void 0 !== t3) {
        const e3 = Eo(t3, n2);
        if (e3) return Di(e3) || !Os(i3) ? void 0 : [i3, e3];
      } else if (i3 === r3) return [r3, Lo(n2)];
    }
  }
  function et(t2, e2, n2) {
    q = true;
    const r3 = performance.now() - H > 100;
    try {
      bi(t2, () => {
        const i3 = $r() || (function(t3) {
          return t3.getEditorState().read(() => {
            const t4 = $r();
            return null !== t4 ? t4.clone() : null;
          });
        })(t2), s4 = /* @__PURE__ */ new Map(), l3 = t2.getRootElement(), c3 = t2._editorState, a3 = t2._blockCursorElement;
        let u3 = false, f3 = "";
        for (let n3 = 0; n3 < e2.length; n3++) {
          const d5 = e2[n3], h2 = d5.type, g3 = d5.target, _5 = tt(g3, t2, c3, l3);
          if (!_5) continue;
          const [p3, y4] = _5;
          if ("characterData" === h2) r3 && pr(y4) && mo(g3) && Z(i3, g3, y4) && Q(g3, y4, t2);
          else if ("childList" === h2) {
            u3 = true;
            const e3 = d5.addedNodes;
            for (let n5 = 0; n5 < e3.length; n5++) {
              const r5 = e3[n5], i4 = Oo(r5), s5 = r5.parentNode;
              if (null != s5 && r5 !== a3 && null === i4 && !X(r5, s5, t2)) {
                if (o) {
                  const t3 = (Os(r5) ? r5.innerText : null) || r5.nodeValue;
                  t3 && (f3 += t3);
                }
                s5.removeChild(r5);
              }
            }
            const n4 = d5.removedNodes, r4 = n4.length;
            if (r4 > 0) {
              let e4 = 0;
              for (let i4 = 0; i4 < r4; i4++) {
                const r5 = n4[i4];
                (X(r5, g3, t2) || a3 === r5) && (g3.appendChild(r5), e4++);
              }
              r4 !== e4 && s4.set(p3, y4);
            }
          }
        }
        if (s4.size > 0) for (const [e3, n3] of s4) n3.reconcileObservedMutation(e3, t2);
        const d4 = n2.takeRecords();
        if (d4.length > 0) {
          for (let e3 = 0; e3 < d4.length; e3++) {
            const n3 = d4[e3], r4 = n3.addedNodes, i4 = n3.target;
            for (let e4 = 0; e4 < r4.length; e4++) {
              const n4 = r4[e4], o2 = n4.parentNode;
              null == o2 || "BR" !== n4.nodeName || X(n4, i4, t2) || o2.removeChild(n4);
            }
          }
          n2.takeRecords();
        }
        null !== i3 && (u3 && Io(i3), o && is(t2) && i3.insertRawText(f3));
      });
    } finally {
      q = false;
    }
  }
  function nt(t2) {
    const e2 = t2._observer;
    if (null !== e2) {
      et(t2, e2.takeRecords(), e2);
    }
  }
  function rt(t2) {
    !(function(t3) {
      0 === H && _s(t3).addEventListener("textInput", G, true);
    })(t2), t2._observer = new MutationObserver((e2, n2) => {
      et(t2, e2, n2);
    });
  }
  var it = class {
    key;
    parse;
    unparse;
    isEqual;
    defaultValue;
    constructor(t2, e2) {
      this.key = t2, this.parse = e2.parse.bind(e2), this.unparse = (e2.unparse || gt).bind(e2), this.isEqual = (e2.isEqual || Object.is).bind(e2), this.defaultValue = this.parse(void 0);
    }
  };
  function ot(t2, e2) {
    return new it(t2, e2);
  }
  function st(t2, e2, n2 = "latest") {
    const r3 = ("latest" === n2 ? t2.getLatest() : t2).__state;
    return r3 ? r3.getValue(e2) : e2.defaultValue;
  }
  function lt(t2, e2, n2) {
    const r3 = st(t2, n2, "direct"), i3 = st(e2, n2, "direct");
    return n2.isEqual(r3, i3) ? null : [r3, i3];
  }
  function ct(t2, e2, n2) {
    let r3;
    if (ui(), "function" == typeof n2) {
      const i4 = t2.getLatest(), o2 = st(i4, e2);
      if (r3 = n2(o2), e2.isEqual(o2, r3)) return i4;
    } else r3 = n2;
    const i3 = t2.getWritable();
    return ft(i3).updateFromKnown(e2, r3), i3;
  }
  function at(t2) {
    const e2 = /* @__PURE__ */ new Map(), n2 = /* @__PURE__ */ new Set();
    for (let r3 = "function" == typeof t2 ? t2 : t2.replace; r3.prototype && void 0 !== r3.prototype.getType; r3 = Object.getPrototypeOf(r3)) {
      const { ownNodeConfig: t3 } = Us(r3);
      if (t3 && t3.stateConfigs) for (const r4 of t3.stateConfigs) {
        let t4;
        "stateConfig" in r4 ? (t4 = r4.stateConfig, r4.flat && n2.add(t4.key)) : t4 = r4, e2.set(t4.key, t4);
      }
    }
    return { flatKeys: n2, sharedConfigMap: e2 };
  }
  var ut = class _ut {
    node;
    knownState;
    unknownState;
    sharedNodeState;
    size;
    constructor(t2, e2, n2 = void 0, r3 = /* @__PURE__ */ new Map(), i3 = void 0) {
      this.node = t2, this.sharedNodeState = e2, this.unknownState = n2, this.knownState = r3;
      const { sharedConfigMap: o2 } = this.sharedNodeState, s4 = void 0 !== i3 ? i3 : (function(t3, e3, n3) {
        let r4 = n3.size;
        if (e3) for (const i4 in e3) {
          const e4 = t3.get(i4);
          e4 && n3.has(e4) || r4++;
        }
        return r4;
      })(o2, n2, r3);
      this.size = s4;
    }
    getValue(t2) {
      const e2 = this.knownState.get(t2);
      if (void 0 !== e2) return e2;
      this.sharedNodeState.sharedConfigMap.set(t2.key, t2);
      let n2 = t2.defaultValue;
      if (this.unknownState && t2.key in this.unknownState) {
        const e3 = this.unknownState[t2.key];
        void 0 !== e3 && (n2 = t2.parse(e3)), this.updateFromKnown(t2, n2);
      }
      return n2;
    }
    getInternalState() {
      return [this.unknownState, this.knownState];
    }
    toJSON() {
      const t2 = { ...this.unknownState }, e2 = {};
      for (const [e3, n2] of this.knownState) e3.isEqual(n2, e3.defaultValue) ? delete t2[e3.key] : t2[e3.key] = e3.unparse(n2);
      for (const n2 of this.sharedNodeState.flatKeys) n2 in t2 && (e2[n2] = t2[n2], delete t2[n2]);
      return ht(t2) && (e2.$ = t2), e2;
    }
    getWritable(t2) {
      if (this.node === t2) return this;
      const { sharedNodeState: e2, unknownState: n2 } = this, r3 = new Map(this.knownState);
      return new _ut(t2, e2, (function(t3, e3, n3) {
        let r4;
        if (n3) for (const [i3, o2] of Object.entries(n3)) {
          const n4 = t3.get(i3);
          n4 ? e3.has(n4) || e3.set(n4, n4.parse(o2)) : (r4 = r4 || {}, r4[i3] = o2);
        }
        return r4;
      })(e2.sharedConfigMap, r3, n2), r3, this.size);
    }
    updateFromKnown(t2, e2) {
      const n2 = t2.key;
      this.sharedNodeState.sharedConfigMap.set(n2, t2);
      const { knownState: r3, unknownState: i3 } = this;
      r3.has(t2) || i3 && n2 in i3 || (i3 && (delete i3[n2], this.unknownState = ht(i3)), this.size++), r3.set(t2, e2);
    }
    updateFromUnknown(t2, e2) {
      const n2 = this.sharedNodeState.sharedConfigMap.get(t2);
      n2 ? this.updateFromKnown(n2, n2.parse(e2)) : (this.unknownState = this.unknownState || {}, t2 in this.unknownState || this.size++, this.unknownState[t2] = e2);
    }
    updateFromJSON(t2) {
      const { knownState: e2 } = this;
      for (const t3 of e2.keys()) e2.set(t3, t3.defaultValue);
      if (this.size = e2.size, this.unknownState = void 0, t2) for (const [e3, n2] of Object.entries(t2)) this.updateFromUnknown(e3, n2);
    }
  };
  function ft(t2) {
    const e2 = t2.getWritable(), n2 = e2.__state ? e2.__state.getWritable(e2) : new ut(e2, dt(e2));
    return e2.__state = n2, n2;
  }
  function dt(t2) {
    return t2.__state ? t2.__state.sharedNodeState : oo(Ls(), t2.getType()).sharedNodeState;
  }
  function ht(t2) {
    if (t2) for (const e2 in t2) return t2;
  }
  function gt(t2) {
    return t2;
  }
  function _t(t2, e2, n2) {
    for (const [r3, i3] of e2.knownState) {
      if (t2.has(r3.key)) continue;
      t2.add(r3.key);
      const e3 = n2 ? n2.getValue(r3) : r3.defaultValue;
      if (e3 !== i3 && !r3.isEqual(e3, i3)) return true;
    }
    return false;
  }
  function pt(t2, e2, n2) {
    const { unknownState: r3 } = e2, i3 = n2 ? n2.unknownState : void 0;
    if (r3) for (const [e3, n3] of Object.entries(r3)) {
      if (t2.has(e3)) continue;
      t2.add(e3);
      if (n3 !== (i3 ? i3[e3] : void 0)) return true;
    }
    return false;
  }
  function yt(t2, e2) {
    const n2 = t2.__state;
    return n2 && n2.node === t2 ? n2.getWritable(e2) : n2;
  }
  function mt(t2, e2) {
    const n2 = t2.__mode, r3 = t2.__format, i3 = t2.__style, o2 = e2.__mode, s4 = e2.__format, l3 = e2.__style, c3 = t2.__state, a3 = e2.__state;
    return (null === n2 || n2 === o2) && (null === r3 || r3 === s4) && (null === i3 || i3 === l3) && (null === t2.__state || c3 === a3 || (function(t3, e3) {
      if (t3 === e3) return true;
      if (t3 && e3 && t3.size !== e3.size) return false;
      const n3 = /* @__PURE__ */ new Set();
      return !(t3 && _t(n3, t3, e3) || e3 && _t(n3, e3, t3) || t3 && pt(n3, t3, e3) || e3 && pt(n3, e3, t3));
    })(c3, a3));
  }
  function xt(t2, e2) {
    const n2 = t2.mergeWithSibling(e2), r3 = hi()._normalizedNodes;
    return r3.add(t2.__key), r3.add(e2.__key), n2;
  }
  function Ct(t2) {
    let e2, n2, r3 = t2;
    if ("" !== r3.__text || !r3.isSimpleText() || r3.isUnmergeable()) {
      for (; null !== (e2 = r3.getPreviousSibling()) && pr(e2) && e2.isSimpleText() && !e2.isUnmergeable(); ) {
        if ("" !== e2.__text) {
          if (mt(e2, r3)) {
            r3 = xt(e2, r3);
            break;
          }
          break;
        }
        e2.remove();
      }
      for (; null !== (n2 = r3.getNextSibling()) && pr(n2) && n2.isSimpleText() && !n2.isUnmergeable(); ) {
        if ("" !== n2.__text) {
          if (mt(r3, n2)) {
            r3 = xt(r3, n2);
            break;
          }
          break;
        }
        n2.remove();
      }
    } else r3.remove();
  }
  function St(t2) {
    return vt(t2.anchor), vt(t2.focus), t2;
  }
  function vt(t2) {
    for (; "element" === t2.type; ) {
      const e2 = t2.getNode(), n2 = t2.offset;
      let r3, i3;
      if (n2 === e2.getChildrenSize() ? (r3 = e2.getChildAtIndex(n2 - 1), i3 = true) : (r3 = e2.getChildAtIndex(n2), i3 = false), pr(r3)) {
        t2.set(r3.__key, i3 ? r3.getTextContentSize() : 0, "text", true);
        break;
      }
      if (!Mi(r3)) break;
      t2.set(r3.__key, i3 ? r3.getChildrenSize() : 0, "element", true);
    }
  }
  var kt;
  var Tt;
  var Nt;
  var bt;
  var wt;
  var Et;
  var Ot;
  var Mt;
  var At;
  var Pt;
  var Dt = "";
  var Ft = null;
  var Lt = null;
  var It = "";
  var Kt = false;
  var zt = false;
  function Rt(t2, e2) {
    const n2 = Ot.get(t2);
    if (null !== e2) {
      const n3 = ne(t2);
      n3.parentNode === e2 && e2.removeChild(n3);
    }
    if (Mt.has(t2) || Tt._keyToDOMMap.delete(t2), Mi(n2)) {
      const t3 = Xt(n2, Ot);
      Bt(t3, 0, t3.length - 1, null);
    }
    void 0 !== n2 && ts(Pt, Nt, bt, n2, "destroyed");
  }
  function Bt(t2, e2, n2, r3) {
    let i3 = e2;
    for (; i3 <= n2; ++i3) {
      const e3 = t2[i3];
      void 0 !== e3 && Rt(e3, r3);
    }
  }
  function Wt(t2, e2) {
    t2.setProperty("text-align", e2);
  }
  var Jt = "40px";
  function jt(t2, e2) {
    const n2 = kt.theme.indent;
    if ("string" == typeof n2) {
      const r4 = t2.classList.contains(n2);
      e2 > 0 && !r4 ? t2.classList.add(n2) : e2 < 1 && r4 && t2.classList.remove(n2);
    }
    const r3 = getComputedStyle(t2).getPropertyValue("--lexical-indent-base-value") || Jt;
    t2.style.setProperty("padding-inline-start", 0 === e2 ? "" : `calc(${e2} * ${r3})`);
  }
  function $t(t2, e2) {
    const n2 = t2.style;
    0 === e2 ? Wt(n2, "") : 1 === e2 ? Wt(n2, "left") : 2 === e2 ? Wt(n2, "center") : 3 === e2 ? Wt(n2, "right") : 4 === e2 ? Wt(n2, "justify") : 5 === e2 ? Wt(n2, "start") : 6 === e2 && Wt(n2, "end");
  }
  function Ut(t2, e2) {
    const n2 = (function(t3) {
      const e3 = t3.__dir;
      if (null !== e3) return e3;
      if (Li(t3)) return null;
      const n3 = t3.getParentOrThrow();
      return Li(n3) && null === n3.__dir ? "auto" : null;
    })(e2);
    null !== n2 ? t2.dir = n2 : t2.removeAttribute("dir");
  }
  function Vt(e2, n2) {
    const r3 = Mt.get(e2);
    void 0 === r3 && t(60);
    const i3 = r3.createDOM(kt, Tt);
    if ((function(t2, e3, n3) {
      const r4 = n3._keyToDOMMap;
      (function(t3, e4, n4) {
        const r5 = `__lexicalKey_${e4._key}`;
        t3[r5] = n4;
      })(e3, n3, t2), r4.set(t2, e3);
    })(e2, i3, Tt), pr(r3) ? i3.setAttribute("data-lexical-text", "true") : Di(r3) && i3.setAttribute("data-lexical-decorator", "true"), Mi(r3)) {
      const t2 = r3.__indent, e3 = r3.__size;
      if (Ut(i3, r3), 0 !== t2 && jt(i3, t2), 0 !== e3) {
        const t3 = e3 - 1;
        Yt(Xt(r3, Mt), r3, 0, t3, r3.getDOMSlot(i3));
      }
      const n3 = r3.__format;
      0 !== n3 && $t(i3, n3), r3.isInline() || Ht(null, r3, i3), ss(r3) && (Dt += D, It += D);
    } else {
      const t2 = r3.getTextContent();
      if (Di(r3)) {
        const t3 = r3.decorate(Tt, kt);
        null !== t3 && Zt(e2, t3), i3.contentEditable = "false";
      }
      Dt += t2, It += t2;
    }
    return null !== n2 && n2.insertChild(i3), ts(Pt, Nt, bt, r3, "created"), i3;
  }
  function Yt(t2, e2, n2, r3, i3) {
    const o2 = Dt;
    Dt = "";
    let s4 = n2;
    for (; s4 <= r3; ++s4) {
      Vt(t2[s4], i3);
      const e3 = Mt.get(t2[s4]);
      null !== e3 && pr(e3) && null === Ft && (Ft = e3.getFormat(), Lt = e3.getStyle());
    }
    ss(e2) && (Dt += D);
    i3.element.__lexicalTextContent = Dt, Dt = o2 + Dt;
  }
  function qt(t2, e2) {
    if (t2) {
      const n2 = t2.__last;
      if (n2) {
        const t3 = e2.get(n2);
        if (t3) return Qn(t3) ? "line-break" : Di(t3) && t3.isInline() ? "decorator" : null;
      }
      return "empty";
    }
    return null;
  }
  function Ht(t2, e2, n2) {
    const r3 = qt(t2, Ot), i3 = qt(e2, Mt);
    r3 !== i3 && e2.getDOMSlot(n2).setManagedLineBreak(i3);
  }
  function Gt(e2, n2, r3) {
    var i3;
    Ft = null, Lt = null, (function(e3, n3, r4) {
      const i4 = Dt, o2 = e3.__size, s4 = n3.__size;
      Dt = "";
      const l3 = r4.element;
      if (1 === o2 && 1 === s4) {
        const t2 = e3.__first, r5 = n3.__first;
        if (t2 === r5) Qt(t2, l3);
        else {
          const e4 = ne(t2), n4 = Vt(r5, null);
          try {
            l3.replaceChild(n4, e4);
          } catch (i6) {
            if ("object" == typeof i6 && null != i6) {
              const o3 = `${i6.toString()} Parent: ${l3.tagName}, new child: {tag: ${n4.tagName} key: ${r5}}, old child: {tag: ${e4.tagName}, key: ${t2}}.`;
              throw new Error(o3);
            }
            throw i6;
          }
          Rt(t2, null);
        }
        const i5 = Mt.get(r5);
        pr(i5) && null === Ft && (Ft = i5.getFormat(), Lt = i5.getStyle());
      } else {
        const i5 = Xt(e3, Ot), c3 = Xt(n3, Mt);
        if (i5.length !== o2 && t(227), c3.length !== s4 && t(228), 0 === o2) 0 !== s4 && Yt(c3, n3, 0, s4 - 1, r4);
        else if (0 === s4) {
          if (0 !== o2) {
            const t2 = null == r4.after && null == r4.before && null == r4.element.__lexicalLineBreak;
            Bt(i5, 0, o2 - 1, t2 ? null : l3), t2 && (l3.textContent = "");
          }
        } else !(function(t2, e4, n4, r5, i6, o3) {
          const s5 = r5 - 1, l4 = i6 - 1;
          let c4, a3, u3 = o3.getFirstChild(), f3 = 0, d4 = 0;
          for (; f3 <= s5 && d4 <= l4; ) {
            const t3 = e4[f3], r6 = n4[d4];
            if (t3 === r6) u3 = te(Qt(r6, o3.element)), f3++, d4++;
            else {
              void 0 === c4 && (c4 = new Set(e4)), void 0 === a3 && (a3 = new Set(n4));
              const i8 = a3.has(t3), s6 = c4.has(r6);
              if (i8) if (s6) {
                const t4 = ls(Tt, r6);
                t4 === u3 ? u3 = te(Qt(r6, o3.element)) : (o3.withBefore(u3).insertChild(t4), Qt(r6, o3.element)), f3++, d4++;
              } else Vt(r6, o3.withBefore(u3)), d4++;
              else u3 = te(ne(t3)), Rt(t3, o3.element), f3++;
            }
            const i7 = Mt.get(r6);
            null !== i7 && pr(i7) && null === Ft && (Ft = i7.getFormat(), Lt = i7.getStyle());
          }
          const h2 = f3 > s5, g3 = d4 > l4;
          if (h2 && !g3) {
            const e5 = n4[l4 + 1], r6 = void 0 === e5 ? null : Tt.getElementByKey(e5);
            Yt(n4, t2, d4, l4, o3.withBefore(r6));
          } else g3 && !h2 && Bt(e4, f3, s5, o3.element);
        })(n3, i5, c3, o2, s4, r4);
      }
      ss(n3) && (Dt += D);
      l3.__lexicalTextContent = Dt, Dt = i4 + Dt;
    })(e2, n2, n2.getDOMSlot(r3)), i3 = n2, null == Ft || Ft === i3.__textFormat || zt || i3.setTextFormat(Ft), (function(t2) {
      null == Lt || Lt === t2.__textStyle || zt || t2.setTextStyle(Lt);
    })(n2);
  }
  function Xt(e2, n2) {
    const r3 = [];
    let i3 = e2.__first;
    for (; null !== i3; ) {
      const e3 = n2.get(i3);
      void 0 === e3 && t(101), r3.push(i3), i3 = e3.__next;
    }
    return r3;
  }
  function Qt(e2, n2) {
    const r3 = Ot.get(e2);
    let i3 = Mt.get(e2);
    void 0 !== r3 && void 0 !== i3 || t(61);
    const o2 = Kt || Et.has(e2) || wt.has(e2), s4 = ls(Tt, e2);
    if (r3 === i3 && !o2) {
      if (Mi(r3)) {
        const t2 = s4.__lexicalTextContent;
        void 0 !== t2 && (Dt += t2, It += t2);
      } else {
        const t2 = r3.getTextContent();
        It += t2, Dt += t2;
      }
      return s4;
    }
    if (r3 !== i3 && o2 && ts(Pt, Nt, bt, i3, "updated"), i3.updateDOM(r3, s4, kt)) {
      const r4 = Vt(e2, null);
      return null === n2 && t(62), n2.replaceChild(r4, s4), Rt(e2, null), r4;
    }
    if (Mi(r3) && Mi(i3)) {
      const t2 = i3.__indent;
      (Kt || t2 !== r3.__indent) && jt(s4, t2);
      const e3 = i3.__format;
      if ((Kt || e3 !== r3.__format) && $t(s4, e3), o2 && (Gt(r3, i3, s4), Li(i3) || i3.isInline() || Ht(r3, i3, s4)), ss(i3) && (Dt += D, It += D), (Kt || i3.__dir !== r3.__dir) && (Ut(s4, i3), Li(i3) && !Kt)) {
        for (const t3 of i3.getChildren()) if (Mi(t3)) {
          Ut(ls(Tt, t3.getKey()), t3);
        }
      }
    } else {
      const t2 = i3.getTextContent();
      if (Di(i3)) {
        const t3 = i3.decorate(Tt, kt);
        null !== t3 && Zt(e2, t3);
      }
      Dt += t2, It += t2;
    }
    if (!zt && Li(i3) && i3.__cachedText !== It) {
      const t2 = i3.getWritable();
      t2.__cachedText = It, i3 = t2;
    }
    return s4;
  }
  function Zt(t2, e2) {
    let n2 = Tt._pendingDecorators;
    const r3 = Tt._decorators;
    if (null === n2) {
      if (r3[t2] === e2) return;
      n2 = Po(Tt);
    }
    n2[t2] = e2;
  }
  function te(t2) {
    let e2 = t2.nextSibling;
    return null !== e2 && e2 === Tt._blockCursorElement && (e2 = e2.nextSibling), e2;
  }
  function ee(t2, e2, n2, r3, i3, o2) {
    Dt = "", It = "", Kt = 2 === r3, Tt = n2, kt = n2._config, Nt = n2._nodes, bt = Tt._listeners.mutation, wt = i3, Et = o2, Ot = t2._nodeMap, Mt = e2._nodeMap, zt = e2._readOnly, At = new Map(n2._keyToDOMMap);
    const s4 = /* @__PURE__ */ new Map();
    return Pt = s4, Qt("root", null), Tt = void 0, Nt = void 0, wt = void 0, Et = void 0, Ot = void 0, Mt = void 0, kt = void 0, At = void 0, Pt = void 0, s4;
  }
  function ne(e2) {
    const n2 = At.get(e2);
    return void 0 === n2 && t(75, e2), n2;
  }
  function re(t2) {
    return { type: t2 };
  }
  var ie = re("SELECTION_CHANGE_COMMAND");
  var oe = re("SELECTION_INSERT_CLIPBOARD_NODES_COMMAND");
  var se = re("CLICK_COMMAND");
  var le = re("BEFORE_INPUT_COMMAND");
  var ce = re("INPUT_COMMAND");
  var ae = re("COMPOSITION_START_COMMAND");
  var ue = re("COMPOSITION_END_COMMAND");
  var fe = re("DELETE_CHARACTER_COMMAND");
  var de = re("INSERT_LINE_BREAK_COMMAND");
  var he = re("INSERT_PARAGRAPH_COMMAND");
  var ge = re("CONTROLLED_TEXT_INSERTION_COMMAND");
  var _e = re("PASTE_COMMAND");
  var pe = re("REMOVE_TEXT_COMMAND");
  var ye = re("DELETE_WORD_COMMAND");
  var me = re("DELETE_LINE_COMMAND");
  var xe = re("FORMAT_TEXT_COMMAND");
  var Ce = re("UNDO_COMMAND");
  var Se = re("REDO_COMMAND");
  var ve = re("KEYDOWN_COMMAND");
  var ke = re("KEY_ARROW_RIGHT_COMMAND");
  var Te = re("MOVE_TO_END");
  var Ne = re("KEY_ARROW_LEFT_COMMAND");
  var be = re("MOVE_TO_START");
  var we = re("KEY_ARROW_UP_COMMAND");
  var Ee = re("KEY_ARROW_DOWN_COMMAND");
  var Oe = re("KEY_ENTER_COMMAND");
  var Me = re("KEY_SPACE_COMMAND");
  var Ae = re("KEY_BACKSPACE_COMMAND");
  var Pe = re("KEY_ESCAPE_COMMAND");
  var De = re("KEY_DELETE_COMMAND");
  var Fe = re("KEY_TAB_COMMAND");
  var Le = re("INSERT_TAB_COMMAND");
  var Ie = re("INDENT_CONTENT_COMMAND");
  var Ke = re("OUTDENT_CONTENT_COMMAND");
  var ze = re("DROP_COMMAND");
  var Re = re("FORMAT_ELEMENT_COMMAND");
  var Be = re("DRAGSTART_COMMAND");
  var We = re("DRAGOVER_COMMAND");
  var Je = re("DRAGEND_COMMAND");
  var je = re("COPY_COMMAND");
  var $e = re("CUT_COMMAND");
  var Ue = re("SELECT_ALL_COMMAND");
  var Ve = re("CLEAR_EDITOR_COMMAND");
  var Ye = re("CLEAR_HISTORY_COMMAND");
  var qe = re("CAN_REDO_COMMAND");
  var He = re("CAN_UNDO_COMMAND");
  var Ge = re("FOCUS_COMMAND");
  var Xe = re("BLUR_COMMAND");
  var Qe = re("KEY_MODIFIER_COMMAND");
  var Ze = Object.freeze({});
  var tn = [["keydown", function(t2, e2) {
    if (en = t2.timeStamp, nn = t2.key, e2.isComposing()) return;
    os(e2, ve, t2);
  }], ["pointerdown", function(t2, e2) {
    const n2 = t2.target, r3 = t2.pointerType;
    Ms(n2) && "touch" !== r3 && "pen" !== r3 && 0 === t2.button && bi(e2, () => {
      co(n2) || (an = true);
    });
  }], ["compositionstart", function(t2, e2) {
    os(e2, ae, t2);
  }], ["compositionend", function(t2, e2) {
    o ? fn = true : c || !l && !d ? os(e2, ue, t2) : (dn = true, hn = t2.data);
  }], ["input", function(t2, e2) {
    t2.stopPropagation(), bi(e2, () => {
      e2.dispatchCommand(ce, t2);
    }, { event: t2 }), on = null;
  }], ["click", function(t2, e2) {
    bi(e2, () => {
      const n2 = $r(), r3 = Ns(_s(e2)), i3 = Ur();
      if (r3) {
        if (br(n2)) {
          const e3 = n2.anchor, o2 = e3.getNode();
          if ("element" === e3.type && 0 === e3.offset && n2.isCollapsed() && !Li(o2) && 1 === Fo().getChildrenSize() && o2.getTopLevelElementOrThrow().isEmpty() && null !== i3 && n2.is(i3)) r3.removeAllRanges(), n2.dirty = true;
          else if (3 === t2.detail && !n2.isCollapsed()) {
            if (o2 !== n2.focus.getNode()) {
              const t3 = Ys(o2, (t4) => Mi(t4) && !t4.isInline());
              Mi(t3) && t3.select(0);
            }
          }
        } else if ("touch" === t2.pointerType || "pen" === t2.pointerType) {
          const n3 = r3.anchorNode;
          if (Os(n3) || mo(n3)) {
            Io(jr(i3, r3, e2, t2));
          }
        }
      }
      os(e2, se, t2);
    });
  }], ["cut", Ze], ["copy", Ze], ["dragstart", Ze], ["dragover", Ze], ["dragend", Ze], ["paste", Ze], ["focus", Ze], ["blur", Ze], ["drop", Ze]];
  s && tn.push(["beforeinput", (t2, e2) => (function(t3, e3) {
    const n2 = t3.inputType;
    if ("deleteCompositionText" === n2 || o && is(e3)) return;
    if ("insertCompositionText" === n2) return;
    os(e3, le, t3);
  })(t2, e2)]);
  var en = 0;
  var nn = null;
  var rn = 0;
  var on = null;
  var sn = /* @__PURE__ */ new WeakMap();
  var ln = /* @__PURE__ */ new WeakMap();
  var cn = false;
  var an = false;
  var un = false;
  var fn = false;
  var dn = false;
  var hn = "";
  var gn = null;
  var _n = [0, "", 0, "root", 0];
  function pn(t2, e2, n2, r3, i3) {
    const o2 = t2.anchor, l3 = t2.focus, c3 = o2.getNode(), a3 = hi(), u3 = Ns(_s(a3)), f3 = null !== u3 ? u3.anchorNode : null, d4 = o2.key, h2 = a3.getElementByKey(d4), g3 = n2.length;
    return d4 !== l3.key || !pr(c3) || (!i3 && (!s || rn < r3 + 50) || c3.isDirty() && g3 < 2 || zo(n2)) && o2.offset !== l3.offset && !c3.isComposing() || yo(c3) || c3.isDirty() && g3 > 1 || (i3 || !s) && null !== h2 && !c3.isComposing() && f3 !== Co(h2) || null !== u3 && null !== e2 && (!e2.collapsed || e2.startContainer !== u3.anchorNode || e2.startOffset !== u3.anchorOffset) || c3.getFormat() !== t2.format || c3.getStyle() !== t2.style || (function(t3, e3) {
      if (e3.isSegmented()) return true;
      if (!t3.isCollapsed()) return false;
      const n3 = t3.anchor.offset, r4 = e3.getParentOrThrow(), i4 = po(e3);
      return 0 === n3 ? !e3.canInsertTextBefore() || !r4.canInsertTextBefore() && !e3.isComposing() || i4 || (function(t4) {
        const e4 = t4.getPreviousSibling();
        return (pr(e4) || Mi(e4) && e4.isInline()) && !e4.canInsertTextAfter();
      })(e3) : n3 === e3.getTextContentSize() && (!e3.canInsertTextAfter() || !r4.canInsertTextAfter() && !e3.isComposing() || i4);
    })(t2, c3);
  }
  function yn(t2, e2) {
    return mo(t2) && null !== t2.nodeValue && 0 !== e2 && e2 !== t2.nodeValue.length;
  }
  function mn(e2, n2, r3) {
    const { anchorNode: i3, anchorOffset: o2, focusNode: s4, focusOffset: l3 } = e2;
    cn && (cn = false, yn(i3, o2) && yn(s4, l3) && !gn) || bi(n2, () => {
      if (!r3) return void Io(null);
      if (!uo(n2, i3, s4)) return;
      let c3 = $r();
      if (gn && br(c3) && c3.isCollapsed()) {
        const t2 = c3.anchor, e3 = gn.anchor;
        (t2.key === e3.key && t2.offset === e3.offset + 1 || 1 === t2.offset && e3.getNode().is(t2.getNode().getPreviousSibling())) && (c3 = gn.clone(), Io(c3));
      }
      if (gn = null, br(c3)) {
        const r4 = c3.anchor, i4 = r4.getNode();
        if (c3.isCollapsed()) {
          "Range" === e2.type && e2.anchorNode === e2.focusNode && (c3.dirty = true);
          const o3 = _s(n2).event, s5 = o3 ? o3.timeStamp : performance.now(), [l4, a3, u3, f3, d4] = _n, h2 = Fo(), g3 = false === n2.isComposing() && "" === h2.getTextContent();
          if (s5 < d4 + 200 && r4.offset === u3 && r4.key === f3) xn(c3, l4, a3);
          else if ("text" === r4.type) pr(i4) || t(141), Cn(c3, i4);
          else if ("element" === r4.type && !g3) {
            Mi(i4) || t(259);
            const e3 = r4.getNode();
            e3.isEmpty() ? (function(t2, e4) {
              const n3 = e4.getTextFormat(), r5 = e4.getTextStyle();
              xn(t2, n3, r5);
            })(c3, e3) : xn(c3, 0, "");
          }
        } else {
          const t2 = r4.key, e3 = c3.focus.key, n3 = c3.getNodes(), i5 = n3.length, s5 = c3.isBackward(), a3 = s5 ? l3 : o2, u3 = s5 ? o2 : l3, f3 = s5 ? e3 : t2, d4 = s5 ? t2 : e3;
          let h2 = 2047, g3 = false;
          for (let t3 = 0; t3 < i5; t3++) {
            const e4 = n3[t3], r5 = e4.getTextContentSize();
            if (pr(e4) && 0 !== r5 && !(0 === t3 && e4.__key === f3 && a3 === r5 || t3 === i5 - 1 && e4.__key === d4 && 0 === u3) && (g3 = true, h2 &= e4.getFormat(), 0 === h2)) break;
          }
          c3.format = g3 ? h2 : 0;
        }
      }
      os(n2, ie, void 0);
    });
  }
  function xn(t2, e2, n2) {
    t2.format === e2 && t2.style === n2 || (t2.format = e2, t2.style = n2, t2.dirty = true);
  }
  function Cn(t2, e2) {
    xn(t2, e2.getFormat(), e2.getStyle());
  }
  function Sn(t2) {
    if (!t2.getTargetRanges) return null;
    const e2 = t2.getTargetRanges();
    return 0 === e2.length ? null : e2[0];
  }
  function vn(e2) {
    const n2 = e2.inputType, r3 = Sn(e2), i3 = hi(), o2 = $r();
    if ("deleteContentBackward" === n2) {
      if (null === o2) {
        const t2 = Ur();
        if (!br(t2)) return true;
        Io(t2.clone());
      }
      if (br(o2)) {
        const n3 = o2.anchor.key === o2.focus.key;
        if (s4 = e2.timeStamp, "MediaLast" === nn && s4 < en + 30 && i3.isComposing() && n3) {
          if (bo(null), en = 0, setTimeout(() => {
            bi(i3, () => {
              bo(null);
            });
          }, 30), br(o2)) {
            const e3 = o2.anchor.getNode();
            e3.markDirty(), pr(e3) || t(142), Cn(o2, e3);
          }
        } else {
          bo(null), e2.preventDefault();
          const t2 = o2.anchor.getNode(), r4 = t2.getTextContent(), s5 = t2.canInsertTextAfter(), l4 = 0 === o2.anchor.offset && o2.focus.offset === r4.length;
          let c3 = f && n3 && !l4 && s5;
          if (c3 && o2.isCollapsed() && (c3 = !Di(rs(o2.anchor, true))), !c3) {
            os(i3, fe, true);
            const t3 = $r();
            f && br(t3) && t3.isCollapsed() && (gn = t3, setTimeout(() => gn = null));
          }
        }
        return true;
      }
    }
    var s4;
    if (!br(o2)) return true;
    const l3 = e2.data;
    null !== on && Jo(false, i3, on), o2.dirty && null === on || !o2.isCollapsed() || Li(o2.anchor.getNode()) || null === r3 || o2.applyDOMRange(r3), on = null;
    const a3 = o2.anchor, u3 = o2.focus, d4 = a3.getNode(), h2 = u3.getNode();
    if ("insertText" === n2 || "insertTranspose" === n2) {
      if ("\n" === l3) e2.preventDefault(), os(i3, de, false);
      else if (l3 === D) e2.preventDefault(), os(i3, he, void 0);
      else if (null == l3 && e2.dataTransfer) {
        const t2 = e2.dataTransfer.getData("text/plain");
        e2.preventDefault(), o2.insertRawText(t2);
      } else null != l3 && pn(o2, r3, l3, e2.timeStamp, true) ? (e2.preventDefault(), os(i3, ge, l3)) : on = l3;
      return rn = e2.timeStamp, true;
    }
    switch (e2.preventDefault(), n2) {
      case "insertFromYank":
      case "insertFromDrop":
      case "insertReplacementText":
        os(i3, ge, e2);
        break;
      case "insertFromComposition":
        bo(null), os(i3, ge, e2);
        break;
      case "insertLineBreak":
        bo(null), os(i3, de, false);
        break;
      case "insertParagraph":
        bo(null), un && !c ? (un = false, os(i3, de, false)) : os(i3, he, void 0);
        break;
      case "insertFromPaste":
      case "insertFromPasteAsQuotation":
        os(i3, _e, e2);
        break;
      case "deleteByComposition":
        (function(t2, e3) {
          return t2 !== e3 || Mi(t2) || Mi(e3) || !po(t2) || !po(e3);
        })(d4, h2) && os(i3, pe, e2);
        break;
      case "deleteByDrag":
      case "deleteByCut":
        os(i3, pe, e2);
        break;
      case "deleteContent":
        os(i3, fe, false);
        break;
      case "deleteWordBackward":
        os(i3, ye, true);
        break;
      case "deleteWordForward":
        os(i3, ye, false);
        break;
      case "deleteHardLineBackward":
      case "deleteSoftLineBackward":
        os(i3, me, true);
        break;
      case "deleteContentForward":
      case "deleteHardLineForward":
      case "deleteSoftLineForward":
        os(i3, me, false);
        break;
      case "formatStrikeThrough":
        os(i3, xe, "strikethrough");
        break;
      case "formatBold":
        os(i3, xe, "bold");
        break;
      case "formatItalic":
        os(i3, xe, "italic");
        break;
      case "formatUnderline":
        os(i3, xe, "underline");
        break;
      case "historyUndo":
        os(i3, Ce, void 0);
        break;
      case "historyRedo":
        os(i3, Se, void 0);
    }
    return true;
  }
  function kn(t2) {
    if (Os(t2.target) && co(t2.target)) return true;
    const e2 = hi(), n2 = $r(), r3 = t2.data, i3 = Sn(t2);
    if (null != r3 && br(n2) && pn(n2, i3, r3, t2.timeStamp, false)) {
      fn && (bn(e2, r3), fn = false);
      const i4 = n2.anchor.getNode(), a3 = Ns(_s(e2));
      if (null === a3) return true;
      const u3 = n2.isBackward(), f3 = u3 ? n2.anchor.offset : n2.focus.offset, h2 = u3 ? n2.focus.offset : n2.anchor.offset;
      s && !n2.isCollapsed() && pr(i4) && null !== a3.anchorNode && i4.getTextContent().slice(0, f3) + r3 + i4.getTextContent().slice(f3 + h2) === Wo(a3.anchorNode) || os(e2, ge, r3);
      const g3 = r3.length;
      o && g3 > 1 && "insertCompositionText" === t2.inputType && !e2.isComposing() && (n2.anchor.offset -= g3), l || c || d || !e2.isComposing() || (en = 0, bo(null));
    } else {
      Jo(false, e2, null !== r3 ? r3 : void 0), fn && (bn(e2, r3 || void 0), fn = false);
    }
    return (function() {
      ui();
      const t3 = hi();
      nt(t3);
    })(), true;
  }
  function Tn(t2) {
    const e2 = hi(), n2 = $r();
    if (br(n2) && !e2.isComposing()) {
      const r3 = n2.anchor, i3 = n2.anchor.getNode();
      bo(r3.key), (t2.timeStamp < en + 30 || "element" === r3.type || !n2.isCollapsed() || i3.getFormat() !== n2.format || pr(i3) && i3.getStyle() !== n2.style) && os(e2, ge, F);
    }
    return true;
  }
  function Nn(t2) {
    return bn(hi(), t2.data), true;
  }
  function bn(t2, e2) {
    const n2 = t2._compositionKey;
    if (bo(null), null !== n2 && null != e2) {
      if ("" === e2) {
        const e3 = Eo(n2), r3 = Co(t2.getElementByKey(n2));
        return void (null !== r3 && null !== r3.nodeValue && pr(e3) && jo(e3, r3.nodeValue, null, null, true));
      }
      if ("\n" === e2[e2.length - 1]) {
        const e3 = $r();
        if (br(e3)) {
          const n3 = e3.focus;
          return e3.anchor.set(n3.key, n3.offset, n3.type), void os(t2, Oe, null);
        }
      }
    }
    Jo(true, t2, e2);
  }
  function wn(t2) {
    const e2 = hi();
    if (null == t2.key) return true;
    if (dn && Go(t2)) return bi(e2, () => {
      bn(e2, hn);
    }), dn = false, hn = "", true;
    if ((function(t3) {
      return Yo(t3, "ArrowRight", { shiftKey: "any" });
    })(t2)) os(e2, ke, t2);
    else if ((function(t3) {
      return Yo(t3, "ArrowRight", qo);
    })(t2)) os(e2, Te, t2);
    else if ((function(t3) {
      return Yo(t3, "ArrowLeft", { shiftKey: "any" });
    })(t2)) os(e2, Ne, t2);
    else if ((function(t3) {
      return Yo(t3, "ArrowLeft", qo);
    })(t2)) os(e2, be, t2);
    else if ((function(t3) {
      return Yo(t3, "ArrowUp", { altKey: "any", shiftKey: "any" });
    })(t2)) os(e2, we, t2);
    else if ((function(t3) {
      return Yo(t3, "ArrowDown", { altKey: "any", shiftKey: "any" });
    })(t2)) os(e2, Ee, t2);
    else if ((function(t3) {
      return Yo(t3, "Enter", { altKey: "any", ctrlKey: "any", metaKey: "any", shiftKey: true });
    })(t2)) un = true, os(e2, Oe, t2);
    else if ((function(t3) {
      return " " === t3.key;
    })(t2)) os(e2, Me, t2);
    else if ((function(t3) {
      return i && Yo(t3, "o", { ctrlKey: true });
    })(t2)) t2.preventDefault(), un = true, os(e2, de, true);
    else if ((function(t3) {
      return Yo(t3, "Enter", { altKey: "any", ctrlKey: "any", metaKey: "any" });
    })(t2)) un = false, os(e2, Oe, t2);
    else if ((function(t3) {
      return Yo(t3, "Backspace", { shiftKey: "any" }) || i && Yo(t3, "h", { ctrlKey: true });
    })(t2)) Go(t2) ? os(e2, Ae, t2) : (t2.preventDefault(), os(e2, fe, true));
    else if ((function(t3) {
      return "Escape" === t3.key;
    })(t2)) os(e2, Pe, t2);
    else if ((function(t3) {
      return Yo(t3, "Delete", {}) || i && Yo(t3, "d", { ctrlKey: true });
    })(t2)) !(function(t3) {
      return "Delete" === t3.key;
    })(t2) ? (t2.preventDefault(), os(e2, fe, false)) : os(e2, De, t2);
    else if ((function(t3) {
      return Yo(t3, "Backspace", Ho);
    })(t2)) t2.preventDefault(), os(e2, ye, true);
    else if ((function(t3) {
      return Yo(t3, "Delete", Ho);
    })(t2)) t2.preventDefault(), os(e2, ye, false);
    else if ((function(t3) {
      return i && Yo(t3, "Backspace", { metaKey: true });
    })(t2)) t2.preventDefault(), os(e2, me, true);
    else if ((function(t3) {
      return i && (Yo(t3, "Delete", { metaKey: true }) || Yo(t3, "k", { ctrlKey: true }));
    })(t2)) t2.preventDefault(), os(e2, me, false);
    else if ((function(t3) {
      return Yo(t3, "b", qo);
    })(t2)) t2.preventDefault(), os(e2, xe, "bold");
    else if ((function(t3) {
      return Yo(t3, "u", qo);
    })(t2)) t2.preventDefault(), os(e2, xe, "underline");
    else if ((function(t3) {
      return Yo(t3, "i", qo);
    })(t2)) t2.preventDefault(), os(e2, xe, "italic");
    else if ((function(t3) {
      return Yo(t3, "Tab", { shiftKey: "any" });
    })(t2)) os(e2, Fe, t2);
    else if ((function(t3) {
      return Yo(t3, "z", qo);
    })(t2)) t2.preventDefault(), os(e2, Ce, void 0);
    else if ((function(t3) {
      if (i) return Yo(t3, "z", { metaKey: true, shiftKey: true });
      return Yo(t3, "y", { ctrlKey: true }) || Yo(t3, "z", { ctrlKey: true, shiftKey: true });
    })(t2)) t2.preventDefault(), os(e2, Se, void 0);
    else {
      const n2 = e2._editorState._selection;
      null === n2 || br(n2) ? Xo(t2) && (t2.preventDefault(), os(e2, Ue, t2)) : !(function(t3) {
        return Yo(t3, "c", qo);
      })(t2) ? !(function(t3) {
        return Yo(t3, "x", qo);
      })(t2) ? Xo(t2) && (t2.preventDefault(), os(e2, Ue, t2)) : (t2.preventDefault(), os(e2, $e, t2)) : (t2.preventDefault(), os(e2, je, t2));
    }
    return (function(t3) {
      return t3.ctrlKey || t3.shiftKey || t3.altKey || t3.metaKey;
    })(t2) && e2.dispatchCommand(Qe, t2), true;
  }
  function En(t2) {
    let e2 = t2.__lexicalEventHandles;
    return void 0 === e2 && (e2 = [], t2.__lexicalEventHandles = e2), e2;
  }
  var On = /* @__PURE__ */ new Map();
  function Mn(t2) {
    const e2 = bs(t2.target);
    if (null === e2) return;
    const n2 = ho(e2.anchorNode);
    if (null === n2) return;
    an && (an = false, bi(n2, () => {
      const r4 = Ur(), i4 = e2.anchorNode;
      if (Os(i4) || mo(i4)) {
        Io(jr(r4, e2, n2, t2));
      }
    }));
    const r3 = Ro(n2), i3 = r3[r3.length - 1], o2 = i3._key, s4 = On.get(o2), l3 = s4 || i3;
    l3 !== n2 && mn(e2, l3, false), mn(e2, n2, true), n2 !== i3 ? On.set(o2, n2) : s4 && On.delete(o2);
  }
  function An(t2) {
    t2._lexicalHandled = true;
  }
  function Pn(t2) {
    return true === t2._lexicalHandled;
  }
  var Dn = () => {
  };
  function Fn(e2) {
    const n2 = sn.get(e2);
    if (void 0 === n2) return void Dn();
    const r3 = ln.get(n2);
    if (void 0 === r3) return void Dn();
    const i3 = r3 - 1;
    i3 >= 0 || t(164), sn.delete(e2), ln.set(n2, i3), 0 === i3 && n2.removeEventListener("selectionchange", Mn);
    const o2 = go(e2);
    fo(o2) ? (!(function(t2) {
      if (null !== t2._parentEditor) {
        const e3 = Ro(t2), n3 = e3[e3.length - 1]._key;
        On.get(n3) === t2 && On.delete(n3);
      } else On.delete(t2._key);
    })(o2), e2.__lexicalEditor = null) : o2 && t(198);
    const s4 = En(e2);
    for (let t2 = 0; t2 < s4.length; t2++) s4[t2]();
    e2.__lexicalEventHandles = [];
  }
  function Ln(t2, e2, n2) {
    ui();
    const r3 = t2.__key, i3 = t2.getParent();
    if (null === i3) return;
    const o2 = (function(t3) {
      const e3 = $r();
      if (!br(e3) || !Mi(t3)) return e3;
      const { anchor: n3, focus: r4 } = e3, i4 = n3.getNode(), o3 = r4.getNode();
      hs(i4, t3) && n3.set(t3.__key, 0, "element");
      hs(o3, t3) && r4.set(t3.__key, 0, "element");
      return e3;
    })(t2);
    let s4 = false;
    if (br(o2) && e2) {
      const e3 = o2.anchor, n3 = o2.focus;
      e3.key === r3 && (qr(e3, t2, i3, t2.getPreviousSibling(), t2.getNextSibling()), s4 = true), n3.key === r3 && (qr(n3, t2, i3, t2.getPreviousSibling(), t2.getNextSibling()), s4 = true);
    } else Er(o2) && e2 && t2.isSelected() && t2.selectPrevious();
    if (br(o2) && e2 && !s4) {
      const e3 = t2.getIndexWithinParent();
      To(t2), Vr(o2, i3, e3, -1);
    } else To(t2);
    n2 || ms(i3) || i3.canBeEmpty() || !i3.isEmpty() || Ln(i3, e2), e2 && o2 && Li(i3) && i3.isEmpty() && i3.selectEnd();
  }
  function In(t2) {
    return t2;
  }
  var Kn = /* @__PURE__ */ Symbol.for("ephemeral");
  function zn(t2) {
    return t2[Kn] || false;
  }
  var Rn = class {
    __type;
    __key;
    __parent;
    __prev;
    __next;
    __state;
    static getType() {
      const { ownNodeType: e2 } = Us(this);
      return void 0 === e2 && t(64, this.name), e2;
    }
    static clone(e2) {
      t(65, this.name);
    }
    $config() {
      return {};
    }
    config(t2, e2) {
      const n2 = e2.extends || Object.getPrototypeOf(this.constructor);
      return Object.assign(e2, { extends: n2, type: t2 }), { [t2]: e2 };
    }
    afterCloneFrom(t2) {
      this.__key === t2.__key ? (this.__parent = t2.__parent, this.__next = t2.__next, this.__prev = t2.__prev, this.__state = t2.__state) : t2.__state && (this.__state = t2.__state.getWritable(this));
    }
    static importDOM;
    constructor(t2) {
      this.__type = this.constructor.getType(), this.__parent = null, this.__prev = null, this.__next = null, Object.defineProperty(this, "__state", { configurable: true, enumerable: false, value: void 0, writable: true }), ko(this, t2);
    }
    getType() {
      return this.__type;
    }
    isInline() {
      t(137, this.constructor.name);
    }
    isAttached() {
      let t2 = this.__key;
      for (; null !== t2; ) {
        if ("root" === t2) return true;
        const e2 = Eo(t2);
        if (null === e2) break;
        t2 = e2.__parent;
      }
      return false;
    }
    isSelected(t2) {
      const e2 = t2 || $r();
      if (null == e2) return false;
      const n2 = e2.getNodes().some((t3) => t3.__key === this.__key);
      if (pr(this)) return n2;
      if (br(e2) && "element" === e2.anchor.type && "element" === e2.focus.type) {
        if (e2.isCollapsed()) return false;
        const t3 = this.getParent();
        if (Di(this) && this.isInline() && t3) {
          const n3 = e2.isBackward() ? e2.focus : e2.anchor;
          if (t3.is(n3.getNode()) && n3.offset === t3.getChildrenSize() && this.is(t3.getLastChild())) return false;
        }
      }
      return n2;
    }
    getKey() {
      return this.__key;
    }
    getIndexWithinParent() {
      const t2 = this.getParent();
      if (null === t2) return -1;
      let e2 = t2.getFirstChild(), n2 = 0;
      for (; null !== e2; ) {
        if (this.is(e2)) return n2;
        n2++, e2 = e2.getNextSibling();
      }
      return -1;
    }
    getParent() {
      const t2 = this.getLatest().__parent;
      return null === t2 ? null : Eo(t2);
    }
    getParentOrThrow() {
      const e2 = this.getParent();
      return null === e2 && t(66, this.__key), e2;
    }
    getTopLevelElement() {
      let e2 = this;
      for (; null !== e2; ) {
        const n2 = e2.getParent();
        if (ms(n2)) return Mi(e2) || e2 === this && Di(e2) || t(194), e2;
        e2 = n2;
      }
      return null;
    }
    getTopLevelElementOrThrow() {
      const e2 = this.getTopLevelElement();
      return null === e2 && t(67, this.__key), e2;
    }
    getParents() {
      const t2 = [];
      let e2 = this.getParent();
      for (; null !== e2; ) t2.push(e2), e2 = e2.getParent();
      return t2;
    }
    getParentKeys() {
      const t2 = [];
      let e2 = this.getParent();
      for (; null !== e2; ) t2.push(e2.__key), e2 = e2.getParent();
      return t2;
    }
    getPreviousSibling() {
      const t2 = this.getLatest().__prev;
      return null === t2 ? null : Eo(t2);
    }
    getPreviousSiblings() {
      const t2 = [], e2 = this.getParent();
      if (null === e2) return t2;
      let n2 = e2.getFirstChild();
      for (; null !== n2 && !n2.is(this); ) t2.push(n2), n2 = n2.getNextSibling();
      return t2;
    }
    getNextSibling() {
      const t2 = this.getLatest().__next;
      return null === t2 ? null : Eo(t2);
    }
    getNextSiblings() {
      const t2 = [];
      let e2 = this.getNextSibling();
      for (; null !== e2; ) t2.push(e2), e2 = e2.getNextSibling();
      return t2;
    }
    getCommonAncestor(t2) {
      const e2 = Mi(this) ? this : this.getParent(), n2 = Mi(t2) ? t2 : t2.getParent(), r3 = e2 && n2 ? wl(e2, n2) : null;
      return r3 ? r3.commonAncestor : null;
    }
    is(t2) {
      return null != t2 && this.__key === t2.__key;
    }
    isBefore(e2) {
      const n2 = wl(this, e2);
      return null !== n2 && ("descendant" === n2.type || ("branch" === n2.type ? -1 === Tl(n2) : ("same" !== n2.type && "ancestor" !== n2.type && t(279), false)));
    }
    isParentOf(t2) {
      const e2 = wl(this, t2);
      return null !== e2 && "ancestor" === e2.type;
    }
    getNodesBetween(e2) {
      const n2 = this.isBefore(e2), r3 = [], i3 = /* @__PURE__ */ new Set();
      let o2 = this;
      for (; null !== o2; ) {
        const s4 = o2.__key;
        if (i3.has(s4) || (i3.add(s4), r3.push(o2)), o2 === e2) break;
        const l3 = Mi(o2) ? n2 ? o2.getFirstChild() : o2.getLastChild() : null;
        if (null !== l3) {
          o2 = l3;
          continue;
        }
        const c3 = n2 ? o2.getNextSibling() : o2.getPreviousSibling();
        if (null !== c3) {
          o2 = c3;
          continue;
        }
        const a3 = o2.getParentOrThrow();
        if (i3.has(a3.__key) || r3.push(a3), a3 === e2) break;
        let u3 = null, f3 = a3;
        do {
          if (null === f3 && t(68), u3 = n2 ? f3.getNextSibling() : f3.getPreviousSibling(), f3 = f3.getParent(), null === f3) break;
          null !== u3 || i3.has(f3.__key) || r3.push(f3);
        } while (null === u3);
        o2 = u3;
      }
      return n2 || r3.reverse(), r3;
    }
    isDirty() {
      const t2 = hi()._dirtyLeaves;
      return null !== t2 && t2.has(this.__key);
    }
    getLatest() {
      if (zn(this)) return this;
      const e2 = Eo(this.__key);
      return null === e2 && t(113), e2;
    }
    getWritable() {
      if (zn(this)) return this;
      ui();
      const t2 = di(), e2 = hi(), n2 = t2._nodeMap, r3 = this.__key, i3 = this.getLatest(), o2 = e2._cloneNotNeeded, s4 = $r();
      if (null !== s4 && s4.setCachedNodes(null), o2.has(r3)) return No(i3), i3;
      const l3 = Rs(i3);
      return o2.add(r3), No(l3), n2.set(r3, l3), l3;
    }
    getTextContent() {
      return "";
    }
    getTextContentSize() {
      return this.getTextContent().length;
    }
    createDOM(e2, n2) {
      t(70);
    }
    updateDOM(e2, n2, r3) {
      t(71);
    }
    exportDOM(t2) {
      return { element: this.createDOM(t2._config, t2) };
    }
    exportJSON() {
      const t2 = this.__state ? this.__state.toJSON() : void 0;
      return { type: this.__type, version: 1, ...t2 };
    }
    static importJSON(e2) {
      t(18, this.name);
    }
    updateFromJSON(t2) {
      return (function(t3, e2) {
        const n2 = t3.getWritable(), r3 = e2.$;
        let i3 = r3;
        for (const t4 of dt(n2).flatKeys) t4 in e2 && (void 0 !== i3 && i3 !== r3 || (i3 = { ...r3 }), i3[t4] = e2[t4]);
        return (n2.__state || i3) && ft(t3).updateFromJSON(i3), n2;
      })(this, t2);
    }
    static transform() {
      return null;
    }
    remove(t2) {
      Ln(this, true, t2);
    }
    replace(e2, n2) {
      ui();
      let r3 = $r();
      null !== r3 && (r3 = r3.clone()), Ss(this, e2);
      const i3 = this.getLatest(), o2 = this.__key, s4 = e2.__key, l3 = e2.getWritable(), c3 = this.getParentOrThrow().getWritable(), a3 = c3.__size;
      To(l3);
      const u3 = i3.getPreviousSibling(), f3 = i3.getNextSibling(), d4 = i3.__prev, h2 = i3.__next, g3 = i3.__parent;
      if (Ln(i3, false, true), null === u3) c3.__first = s4;
      else {
        u3.getWritable().__next = s4;
      }
      if (l3.__prev = d4, null === f3) c3.__last = s4;
      else {
        f3.getWritable().__prev = s4;
      }
      if (l3.__next = h2, l3.__parent = g3, c3.__size = a3, n2 && (Mi(this) && Mi(l3) || t(139), this.getChildren().forEach((t2) => {
        l3.append(t2);
      })), br(r3)) {
        Io(r3);
        const t2 = r3.anchor, e3 = r3.focus;
        t2.key === o2 && Tr(t2, l3), e3.key === o2 && Tr(e3, l3);
      }
      return wo() === o2 && bo(s4), l3;
    }
    insertAfter(t2, e2 = true) {
      ui(), Ss(this, t2);
      const n2 = this.getWritable(), r3 = t2.getWritable(), i3 = r3.getParent(), o2 = $r();
      let s4 = false, l3 = false;
      if (null !== i3) {
        const e3 = t2.getIndexWithinParent();
        if (To(r3), br(o2)) {
          const t3 = i3.__key, n3 = o2.anchor, r4 = o2.focus;
          s4 = "element" === n3.type && n3.key === t3 && n3.offset === e3 + 1, l3 = "element" === r4.type && r4.key === t3 && r4.offset === e3 + 1;
        }
      }
      const c3 = this.getNextSibling(), a3 = this.getParentOrThrow().getWritable(), u3 = r3.__key, f3 = n2.__next;
      if (null === c3) a3.__last = u3;
      else {
        c3.getWritable().__prev = u3;
      }
      if (a3.__size++, n2.__next = u3, r3.__next = f3, r3.__prev = n2.__key, r3.__parent = n2.__parent, e2 && br(o2)) {
        const t3 = this.getIndexWithinParent();
        Vr(o2, a3, t3 + 1);
        const e3 = a3.__key;
        s4 && o2.anchor.set(e3, t3 + 2, "element"), l3 && o2.focus.set(e3, t3 + 2, "element");
      }
      return t2;
    }
    insertBefore(t2, e2 = true) {
      ui(), Ss(this, t2);
      const n2 = this.getWritable(), r3 = t2.getWritable(), i3 = r3.__key;
      To(r3);
      const o2 = this.getPreviousSibling(), s4 = this.getParentOrThrow().getWritable(), l3 = n2.__prev, c3 = this.getIndexWithinParent();
      if (null === o2) s4.__first = i3;
      else {
        o2.getWritable().__next = i3;
      }
      s4.__size++, n2.__prev = i3, r3.__prev = l3, r3.__next = n2.__key, r3.__parent = n2.__parent;
      const a3 = $r();
      if (e2 && br(a3)) {
        Vr(a3, this.getParentOrThrow(), c3);
      }
      return t2;
    }
    isParentRequired() {
      return false;
    }
    createParentElementNode() {
      return $i();
    }
    selectStart() {
      return this.selectPrevious();
    }
    selectEnd() {
      return this.selectNext(0, 0);
    }
    selectPrevious(t2, e2) {
      ui();
      const n2 = this.getPreviousSibling(), r3 = this.getParentOrThrow();
      if (null === n2) return r3.select(0, 0);
      if (Mi(n2)) return n2.select();
      if (!pr(n2)) {
        const t3 = n2.getIndexWithinParent() + 1;
        return r3.select(t3, t3);
      }
      return n2.select(t2, e2);
    }
    selectNext(t2, e2) {
      ui();
      const n2 = this.getNextSibling(), r3 = this.getParentOrThrow();
      if (null === n2) return r3.select();
      if (Mi(n2)) return n2.select(0, 0);
      if (!pr(n2)) {
        const t3 = n2.getIndexWithinParent();
        return r3.select(t3, t3);
      }
      return n2.select(t2, e2);
    }
    markDirty() {
      this.getWritable();
    }
    reconcileObservedMutation(t2, e2) {
      this.markDirty();
    }
  };
  var Bn = "historic";
  var Wn = "history-push";
  var Jn = "history-merge";
  var jn = "paste";
  var $n = "collaboration";
  var Un = "skip-collab";
  var Vn = "skip-scroll-into-view";
  var Yn = "skip-dom-selection";
  var qn = "skip-selection-focus";
  var Hn = class _Hn extends Rn {
    static getType() {
      return "linebreak";
    }
    static clone(t2) {
      return new _Hn(t2.__key);
    }
    constructor(t2) {
      super(t2);
    }
    getTextContent() {
      return "\n";
    }
    createDOM() {
      return document.createElement("br");
    }
    updateDOM() {
      return false;
    }
    isInline() {
      return true;
    }
    static importDOM() {
      return { br: (t2) => (function(t3) {
        const e2 = t3.parentElement;
        if (null !== e2 && Ds(e2)) {
          const n2 = e2.firstChild;
          if (n2 === t3 || n2.nextSibling === t3 && Zn(n2)) {
            const n3 = e2.lastChild;
            if (n3 === t3 || n3.previousSibling === t3 && Zn(n3)) return true;
          }
        }
        return false;
      })(t2) || (function(t3) {
        const e2 = t3.parentElement;
        if (null !== e2 && Ds(e2)) {
          const n2 = e2.firstChild;
          if (n2 === t3 || n2.nextSibling === t3 && Zn(n2)) return false;
          const r3 = e2.lastChild;
          if (r3 === t3 || r3.previousSibling === t3 && Zn(r3)) return true;
        }
        return false;
      })(t2) ? null : { conversion: Gn, priority: 0 } };
    }
    static importJSON(t2) {
      return Xn().updateFromJSON(t2);
    }
  };
  function Gn(t2) {
    return { node: Xn() };
  }
  function Xn() {
    return Cs(new Hn());
  }
  function Qn(t2) {
    return t2 instanceof Hn;
  }
  function Zn(t2) {
    return mo(t2) && /^( |\t|\r?\n)+$/.test(t2.textContent || "");
  }
  function tr(t2, e2) {
    return 16 & e2 ? "code" : e2 & T ? "mark" : 32 & e2 ? "sub" : 64 & e2 ? "sup" : null;
  }
  function er(t2, e2) {
    return 1 & e2 ? "strong" : 2 & e2 ? "em" : "span";
  }
  function nr(t2, e2, n2, r3, i3) {
    const o2 = r3.classList;
    let s4 = Zo(i3, "base");
    void 0 !== s4 && o2.add(...s4), s4 = Zo(i3, "underlineStrikethrough");
    let l3 = false;
    const c3 = 8 & e2 && 4 & e2;
    void 0 !== s4 && (8 & n2 && 4 & n2 ? (l3 = true, c3 || o2.add(...s4)) : c3 && o2.remove(...s4));
    for (const t3 in R) {
      const r4 = R[t3];
      if (s4 = Zo(i3, t3), void 0 !== s4) if (n2 & r4) {
        if (l3 && ("underline" === t3 || "strikethrough" === t3)) {
          e2 & r4 && o2.remove(...s4);
          continue;
        }
        (0 === (e2 & r4) || c3 && "underline" === t3 || "strikethrough" === t3) && o2.add(...s4);
      } else e2 & r4 && o2.remove(...s4);
    }
  }
  function rr(t2, e2, n2) {
    const r3 = e2.firstChild, i3 = n2.isComposing(), s4 = t2 + (i3 ? P : "");
    if (null == r3) e2.textContent = s4;
    else {
      const t3 = r3.nodeValue;
      if (t3 !== s4) if (i3 || o) {
        const [e3, n3, i4] = (function(t4, e4) {
          const n4 = t4.length, r4 = e4.length;
          let i5 = 0, o2 = 0;
          for (; i5 < n4 && i5 < r4 && t4[i5] === e4[i5]; ) i5++;
          for (; o2 + i5 < n4 && o2 + i5 < r4 && t4[n4 - o2 - 1] === e4[r4 - o2 - 1]; ) o2++;
          return [i5, n4 - i5 - o2, e4.slice(i5, r4 - o2)];
        })(t3, s4);
        0 !== n3 && r3.deleteData(e3, n3), r3.insertData(e3, i4);
      } else r3.nodeValue = s4;
    }
  }
  function ir(t2, e2, n2, r3, i3, o2) {
    rr(i3, t2, e2);
    const s4 = o2.theme.text;
    void 0 !== s4 && nr(0, 0, r3, t2, s4);
  }
  function or(t2, e2) {
    const n2 = document.createElement(e2);
    return n2.appendChild(t2), n2;
  }
  var sr = class _sr extends Rn {
    __text;
    __format;
    __style;
    __mode;
    __detail;
    static getType() {
      return "text";
    }
    static clone(t2) {
      return new _sr(t2.__text, t2.__key);
    }
    afterCloneFrom(t2) {
      super.afterCloneFrom(t2), this.__text = t2.__text, this.__format = t2.__format, this.__style = t2.__style, this.__mode = t2.__mode, this.__detail = t2.__detail;
    }
    constructor(t2 = "", e2) {
      super(e2), this.__text = t2, this.__format = 0, this.__style = "", this.__mode = 0, this.__detail = 0;
    }
    getFormat() {
      return this.getLatest().__format;
    }
    getDetail() {
      return this.getLatest().__detail;
    }
    getMode() {
      const t2 = this.getLatest();
      return $[t2.__mode];
    }
    getStyle() {
      return this.getLatest().__style;
    }
    isToken() {
      return 1 === this.getLatest().__mode;
    }
    isComposing() {
      return this.__key === wo();
    }
    isSegmented() {
      return 2 === this.getLatest().__mode;
    }
    isDirectionless() {
      return !!(1 & this.getLatest().__detail);
    }
    isUnmergeable() {
      return !!(2 & this.getLatest().__detail);
    }
    hasFormat(t2) {
      const e2 = R[t2];
      return 0 !== (this.getFormat() & e2);
    }
    isSimpleText() {
      return "text" === this.__type && 0 === this.__mode;
    }
    getTextContent() {
      return this.getLatest().__text;
    }
    getFormatFlags(t2, e2) {
      return So(this.getLatest().__format, t2, e2);
    }
    canHaveFormat() {
      return true;
    }
    isInline() {
      return true;
    }
    createDOM(t2, e2) {
      const n2 = this.__format, r3 = tr(0, n2), i3 = er(0, n2), o2 = null === r3 ? i3 : r3, s4 = document.createElement(o2);
      let l3 = s4;
      this.hasFormat("code") && s4.setAttribute("spellcheck", "false"), null !== r3 && (l3 = document.createElement(i3), s4.appendChild(l3));
      ir(l3, this, 0, n2, this.__text, t2);
      const c3 = this.__style;
      return "" !== c3 && (s4.style.cssText = c3), s4;
    }
    updateDOM(e2, n2, r3) {
      const i3 = this.__text, o2 = e2.__format, s4 = this.__format, l3 = tr(0, o2), c3 = tr(0, s4), a3 = er(0, o2), u3 = er(0, s4);
      if ((null === l3 ? a3 : l3) !== (null === c3 ? u3 : c3)) return true;
      if (l3 === c3 && a3 !== u3) {
        const e3 = n2.firstChild;
        null == e3 && t(48);
        const o3 = document.createElement(u3);
        return ir(o3, this, 0, s4, i3, r3), n2.replaceChild(o3, e3), false;
      }
      let f3 = n2;
      null !== c3 && null !== l3 && (f3 = n2.firstChild, null == f3 && t(49)), rr(i3, f3, this);
      const d4 = r3.theme.text;
      void 0 !== d4 && o2 !== s4 && nr(0, o2, s4, f3, d4);
      const h2 = e2.__style, g3 = this.__style;
      return h2 !== g3 && (n2.style.cssText = g3), false;
    }
    static importDOM() {
      return { "#text": () => ({ conversion: fr, priority: 0 }), b: () => ({ conversion: cr, priority: 0 }), code: () => ({ conversion: gr, priority: 0 }), em: () => ({ conversion: gr, priority: 0 }), i: () => ({ conversion: gr, priority: 0 }), mark: () => ({ conversion: gr, priority: 0 }), s: () => ({ conversion: gr, priority: 0 }), span: () => ({ conversion: lr, priority: 0 }), strong: () => ({ conversion: gr, priority: 0 }), sub: () => ({ conversion: gr, priority: 0 }), sup: () => ({ conversion: gr, priority: 0 }), u: () => ({ conversion: gr, priority: 0 }) };
    }
    static importJSON(t2) {
      return _r().updateFromJSON(t2);
    }
    updateFromJSON(t2) {
      return super.updateFromJSON(t2).setTextContent(t2.text).setFormat(t2.format).setDetail(t2.detail).setMode(t2.mode).setStyle(t2.style);
    }
    exportDOM(e2) {
      let { element: n2 } = super.exportDOM(e2);
      return Os(n2) || t(132), n2.style.whiteSpace = "pre-wrap", this.hasFormat("lowercase") ? n2.style.textTransform = "lowercase" : this.hasFormat("uppercase") ? n2.style.textTransform = "uppercase" : this.hasFormat("capitalize") && (n2.style.textTransform = "capitalize"), this.hasFormat("bold") && (n2 = or(n2, "b")), this.hasFormat("italic") && (n2 = or(n2, "i")), this.hasFormat("strikethrough") && (n2 = or(n2, "s")), this.hasFormat("underline") && (n2 = or(n2, "u")), { element: n2 };
    }
    exportJSON() {
      return { detail: this.getDetail(), format: this.getFormat(), mode: this.getMode(), style: this.getStyle(), text: this.getTextContent(), ...super.exportJSON() };
    }
    selectionTransform(t2, e2) {
    }
    setFormat(t2) {
      const e2 = this.getWritable();
      return e2.__format = "string" == typeof t2 ? R[t2] : t2, e2;
    }
    setDetail(t2) {
      const e2 = this.getWritable();
      return e2.__detail = "string" == typeof t2 ? B[t2] : t2, e2;
    }
    setStyle(t2) {
      const e2 = this.getWritable();
      return e2.__style = t2, e2;
    }
    toggleFormat(t2) {
      const e2 = So(this.getFormat(), t2, null);
      return this.setFormat(e2);
    }
    toggleDirectionless() {
      const t2 = this.getWritable();
      return t2.__detail ^= 1, t2;
    }
    toggleUnmergeable() {
      const t2 = this.getWritable();
      return t2.__detail ^= 2, t2;
    }
    setMode(t2) {
      const e2 = j[t2];
      if (this.__mode === e2) return this;
      const n2 = this.getWritable();
      return n2.__mode = e2, n2;
    }
    setTextContent(t2) {
      if (this.__text === t2) return this;
      const e2 = this.getWritable();
      return e2.__text = t2, e2;
    }
    select(t2, e2) {
      ui();
      let n2 = t2, r3 = e2;
      const i3 = $r(), o2 = this.getTextContent(), s4 = this.__key;
      if ("string" == typeof o2) {
        const t3 = o2.length;
        void 0 === n2 && (n2 = t3), void 0 === r3 && (r3 = t3);
      } else n2 = 0, r3 = 0;
      if (!br(i3)) return Rr(s4, n2, s4, r3, "text", "text");
      {
        const t3 = wo();
        t3 !== i3.anchor.key && t3 !== i3.focus.key || bo(s4), i3.setTextNodeRange(this, n2, this, r3);
      }
      return i3;
    }
    selectStart() {
      return this.select(0, 0);
    }
    selectEnd() {
      const t2 = this.getTextContentSize();
      return this.select(t2, t2);
    }
    spliceText(t2, e2, n2, r3) {
      const i3 = this.getWritable(), o2 = i3.__text, s4 = n2.length;
      let l3 = t2;
      l3 < 0 && (l3 = s4 + l3, l3 < 0 && (l3 = 0));
      const c3 = $r();
      if (r3 && br(c3)) {
        const e3 = t2 + s4;
        c3.setTextNodeRange(i3, e3, i3, e3);
      }
      const a3 = o2.slice(0, l3) + n2 + o2.slice(l3 + e2);
      return i3.__text = a3, i3;
    }
    canInsertTextBefore() {
      return true;
    }
    canInsertTextAfter() {
      return true;
    }
    splitText(...t2) {
      ui();
      const e2 = this.getLatest(), n2 = e2.getTextContent();
      if ("" === n2) return [];
      const r3 = e2.__key, i3 = wo(), o2 = n2.length;
      t2.sort((t3, e3) => t3 - e3), t2.push(o2);
      const s4 = [], l3 = t2.length;
      for (let e3 = 0, r4 = 0; e3 < o2 && r4 <= l3; r4++) {
        const i4 = t2[r4];
        i4 > e3 && (s4.push(n2.slice(e3, i4)), e3 = i4);
      }
      const c3 = s4.length;
      if (1 === c3) return [e2];
      const a3 = s4[0], u3 = e2.getParent();
      let f3;
      const d4 = e2.getFormat(), h2 = e2.getStyle(), g3 = e2.__detail;
      let _5 = false, p3 = null, y4 = null;
      const m3 = $r();
      if (br(m3)) {
        const [t3, e3] = m3.isBackward() ? [m3.focus, m3.anchor] : [m3.anchor, m3.focus];
        "text" === t3.type && t3.key === r3 && (p3 = t3), "text" === e3.type && e3.key === r3 && (y4 = e3);
      }
      e2.isSegmented() ? (f3 = _r(a3), f3.__format = d4, f3.__style = h2, f3.__detail = g3, f3.__state = yt(e2, f3), _5 = true) : f3 = e2.setTextContent(a3);
      const x4 = [f3];
      for (let t3 = 1; t3 < c3; t3++) {
        const n3 = _r(s4[t3]);
        n3.__format = d4, n3.__style = h2, n3.__detail = g3, n3.__state = yt(e2, n3);
        const o3 = n3.__key;
        i3 === r3 && bo(o3), x4.push(n3);
      }
      const C4 = p3 ? p3.offset : null, S3 = y4 ? y4.offset : null;
      let v4 = 0;
      for (const t3 of x4) {
        if (!p3 && !y4) break;
        const e3 = v4 + t3.getTextContentSize();
        if (null !== p3 && null !== C4 && C4 <= e3 && C4 >= v4 && (p3.set(t3.getKey(), C4 - v4, "text"), C4 < e3 && (p3 = null)), null !== y4 && null !== S3 && S3 <= e3 && S3 >= v4) {
          y4.set(t3.getKey(), S3 - v4, "text");
          break;
        }
        v4 = e3;
      }
      if (null !== u3) {
        !(function(t4) {
          const e4 = t4.getPreviousSibling(), n3 = t4.getNextSibling();
          null !== e4 && No(e4);
          null !== n3 && No(n3);
        })(this);
        const t3 = u3.getWritable(), e3 = this.getIndexWithinParent();
        _5 ? (t3.splice(e3, 0, x4), this.remove()) : t3.splice(e3, 1, x4), br(m3) && Vr(m3, u3, e3, c3 - 1);
      }
      return x4;
    }
    mergeWithSibling(e2) {
      const n2 = e2 === this.getPreviousSibling();
      n2 || e2 === this.getNextSibling() || t(50);
      const r3 = this.__key, i3 = e2.__key, o2 = this.__text, s4 = o2.length;
      wo() === i3 && bo(r3);
      const l3 = $r();
      if (br(l3)) {
        const t2 = l3.anchor, o3 = l3.focus;
        null !== t2 && t2.key === i3 && Hr(t2, n2, r3, e2, s4), null !== o3 && o3.key === i3 && Hr(o3, n2, r3, e2, s4);
      }
      const c3 = e2.__text, a3 = n2 ? c3 + o2 : o2 + c3;
      this.setTextContent(a3);
      const u3 = this.getWritable();
      return e2.remove(), u3;
    }
    isTextEntity() {
      return false;
    }
  };
  function lr(t2) {
    return { forChild: yr(t2.style), node: null };
  }
  function cr(t2) {
    const e2 = t2, n2 = "normal" === e2.style.fontWeight;
    return { forChild: yr(e2.style, n2 ? void 0 : "bold"), node: null };
  }
  var ar = /* @__PURE__ */ new WeakMap();
  function ur(t2) {
    if (!Os(t2)) return false;
    if ("PRE" === t2.nodeName) return true;
    const e2 = t2.style.whiteSpace;
    return "string" == typeof e2 && e2.startsWith("pre");
  }
  function fr(e2) {
    const n2 = e2;
    null === e2.parentElement && t(129);
    let r3 = n2.textContent || "";
    if (null !== (function(t2) {
      let e3, n3 = t2.parentNode;
      const r4 = [t2];
      for (; null !== n3 && void 0 === (e3 = ar.get(n3)) && !ur(n3); ) r4.push(n3), n3 = n3.parentNode;
      const i3 = void 0 === e3 ? n3 : e3;
      for (let t3 = 0; t3 < r4.length; t3++) ar.set(r4[t3], i3);
      return i3;
    })(n2)) {
      const t2 = r3.split(/(\r?\n|\t)/), e3 = [], n3 = t2.length;
      for (let r4 = 0; r4 < n3; r4++) {
        const n4 = t2[r4];
        "\n" === n4 || "\r\n" === n4 ? e3.push(Xn()) : "	" === n4 ? e3.push(xr()) : "" !== n4 && e3.push(_r(n4));
      }
      return { node: e3 };
    }
    if (r3 = r3.replace(/\r/g, "").replace(/[ \t\n]+/g, " "), "" === r3) return { node: null };
    if (" " === r3[0]) {
      let t2 = n2, e3 = true;
      for (; null !== t2 && null !== (t2 = dr(t2, false)); ) {
        const n3 = t2.textContent || "";
        if (n3.length > 0) {
          /[ \t\n]$/.test(n3) && (r3 = r3.slice(1)), e3 = false;
          break;
        }
      }
      e3 && (r3 = r3.slice(1));
    }
    if (" " === r3[r3.length - 1]) {
      let t2 = n2, e3 = true;
      for (; null !== t2 && null !== (t2 = dr(t2, true)); ) {
        if ((t2.textContent || "").replace(/^( |\t|\r?\n)+/, "").length > 0) {
          e3 = false;
          break;
        }
      }
      e3 && (r3 = r3.slice(0, r3.length - 1));
    }
    return "" === r3 ? { node: null } : { node: _r(r3) };
  }
  function dr(t2, e2) {
    let n2 = t2;
    for (; ; ) {
      let t3;
      for (; null === (t3 = e2 ? n2.nextSibling : n2.previousSibling); ) {
        const t4 = n2.parentElement;
        if (null === t4) return null;
        n2 = t4;
      }
      if (n2 = t3, Os(n2)) {
        const t4 = n2.style.display;
        if ("" === t4 && !Ps(n2) || "" !== t4 && !t4.startsWith("inline")) return null;
      }
      let r3 = n2;
      for (; null !== (r3 = e2 ? n2.firstChild : n2.lastChild); ) n2 = r3;
      if (mo(n2)) return n2;
      if ("BR" === n2.nodeName) return null;
    }
  }
  var hr = { code: "code", em: "italic", i: "italic", mark: "highlight", s: "strikethrough", strong: "bold", sub: "subscript", sup: "superscript", u: "underline" };
  function gr(t2) {
    const e2 = hr[t2.nodeName.toLowerCase()];
    return void 0 === e2 ? { node: null } : { forChild: yr(t2.style, e2), node: null };
  }
  function _r(t2 = "") {
    return Cs(new sr(t2));
  }
  function pr(t2) {
    return t2 instanceof sr;
  }
  function yr(t2, e2) {
    const n2 = t2.fontWeight, r3 = t2.textDecoration.split(" "), i3 = "700" === n2 || "bold" === n2, o2 = r3.includes("line-through"), s4 = "italic" === t2.fontStyle, l3 = r3.includes("underline"), c3 = t2.verticalAlign;
    return (t3) => pr(t3) ? (i3 && !t3.hasFormat("bold") && t3.toggleFormat("bold"), o2 && !t3.hasFormat("strikethrough") && t3.toggleFormat("strikethrough"), s4 && !t3.hasFormat("italic") && t3.toggleFormat("italic"), l3 && !t3.hasFormat("underline") && t3.toggleFormat("underline"), "sub" !== c3 || t3.hasFormat("subscript") || t3.toggleFormat("subscript"), "super" !== c3 || t3.hasFormat("superscript") || t3.toggleFormat("superscript"), e2 && !t3.hasFormat(e2) && t3.toggleFormat(e2), t3) : t3;
  }
  var mr = class _mr extends sr {
    static getType() {
      return "tab";
    }
    static clone(t2) {
      return new _mr(t2.__key);
    }
    constructor(t2) {
      super("	", t2), this.__detail = 2;
    }
    static importDOM() {
      return null;
    }
    createDOM(t2) {
      const e2 = super.createDOM(t2), n2 = Zo(t2.theme, "tab");
      if (void 0 !== n2) {
        e2.classList.add(...n2);
      }
      return e2;
    }
    static importJSON(t2) {
      return xr().updateFromJSON(t2);
    }
    setTextContent(t2) {
      return "	" !== t2 && "" !== t2 && e(126), super.setTextContent("	");
    }
    spliceText(e2, n2, r3, i3) {
      return "" === r3 && 0 === n2 || "	" === r3 && 1 === n2 || t(286), this;
    }
    setDetail(e2) {
      return 2 !== e2 && t(127), this;
    }
    setMode(e2) {
      return "normal" !== e2 && t(128), this;
    }
    canInsertTextBefore() {
      return false;
    }
    canInsertTextAfter() {
      return false;
    }
  };
  function xr() {
    return Cs(new mr());
  }
  function Cr(t2) {
    return t2 instanceof mr;
  }
  var Sr = class {
    key;
    offset;
    type;
    _selection;
    constructor(t2, e2, n2) {
      this._selection = null, this.key = t2, this.offset = e2, this.type = n2;
    }
    is(t2) {
      return this.key === t2.key && this.offset === t2.offset && this.type === t2.type;
    }
    isBefore(t2) {
      if (this.key === t2.key) return this.offset < t2.offset;
      return kl(Kl(El(this, "next")), Kl(El(t2, "next"))) < 0;
    }
    getNode() {
      const e2 = Eo(this.key);
      return null === e2 && t(20), e2;
    }
    set(t2, e2, n2, r3) {
      const i3 = this._selection, o2 = this.key;
      r3 && this.key === t2 && this.offset === e2 && this.type === n2 || (this.key = t2, this.offset = e2, this.type = n2, ai() || (wo() === o2 && bo(t2), null !== i3 && (i3.setCachedNodes(null), i3.dirty = true)));
    }
  };
  function vr(t2, e2, n2) {
    return new Sr(t2, e2, n2);
  }
  function kr(t2, e2) {
    let n2 = e2.__key, r3 = t2.offset, i3 = "element";
    if (pr(e2)) {
      i3 = "text";
      const t3 = e2.getTextContentSize();
      r3 > t3 && (r3 = t3);
    } else if (!Mi(e2)) {
      const t3 = e2.getNextSibling();
      if (pr(t3)) n2 = t3.__key, r3 = 0, i3 = "text";
      else {
        const t4 = e2.getParent();
        t4 && (n2 = t4.__key, r3 = e2.getIndexWithinParent() + 1);
      }
    }
    t2.set(n2, r3, i3);
  }
  function Tr(t2, e2) {
    if (Mi(e2)) {
      const n2 = e2.getLastDescendant();
      Mi(n2) || pr(n2) ? kr(t2, n2) : kr(t2, e2);
    } else kr(t2, e2);
  }
  var Nr = class _Nr {
    _nodes;
    _cachedNodes;
    dirty;
    constructor(t2) {
      this._cachedNodes = null, this._nodes = t2, this.dirty = false;
    }
    getCachedNodes() {
      return this._cachedNodes;
    }
    setCachedNodes(t2) {
      this._cachedNodes = t2;
    }
    is(t2) {
      if (!Er(t2)) return false;
      const e2 = this._nodes, n2 = t2._nodes;
      return e2.size === n2.size && Array.from(e2).every((t3) => n2.has(t3));
    }
    isCollapsed() {
      return false;
    }
    isBackward() {
      return false;
    }
    getStartEndPoints() {
      return null;
    }
    add(t2) {
      this.dirty = true, this._nodes.add(t2), this._cachedNodes = null;
    }
    delete(t2) {
      this.dirty = true, this._nodes.delete(t2), this._cachedNodes = null;
    }
    clear() {
      this.dirty = true, this._nodes.clear(), this._cachedNodes = null;
    }
    has(t2) {
      return this._nodes.has(t2);
    }
    clone() {
      return new _Nr(new Set(this._nodes));
    }
    extract() {
      return this.getNodes();
    }
    insertRawText(t2) {
    }
    insertText() {
    }
    insertNodes(t2) {
      const e2 = this.getNodes(), n2 = e2.length, r3 = e2[n2 - 1];
      let i3;
      if (pr(r3)) i3 = r3.select();
      else {
        const t3 = r3.getIndexWithinParent() + 1;
        i3 = r3.getParentOrThrow().select(t3, t3);
      }
      i3.insertNodes(t2);
      for (let t3 = 0; t3 < n2; t3++) e2[t3].remove();
    }
    getNodes() {
      const t2 = this._cachedNodes;
      if (null !== t2) return t2;
      const e2 = this._nodes, n2 = [];
      for (const t3 of e2) {
        const e3 = Eo(t3);
        null !== e3 && n2.push(e3);
      }
      return ai() || (this._cachedNodes = n2), n2;
    }
    getTextContent() {
      const t2 = this.getNodes();
      let e2 = "";
      for (let n2 = 0; n2 < t2.length; n2++) e2 += t2[n2].getTextContent();
      return e2;
    }
    deleteNodes() {
      const t2 = this.getNodes();
      if (($r() || Ur()) === this && t2[0]) {
        const e2 = al(t2[0], "next");
        Ml(Sl(e2, e2));
      }
      for (const e2 of t2) e2.remove();
    }
  };
  function br(t2) {
    return t2 instanceof wr;
  }
  var wr = class _wr {
    format;
    style;
    anchor;
    focus;
    _cachedNodes;
    dirty;
    constructor(t2, e2, n2, r3) {
      this.anchor = t2, this.focus = e2, t2._selection = this, e2._selection = this, this._cachedNodes = null, this.format = n2, this.style = r3, this.dirty = false;
    }
    getCachedNodes() {
      return this._cachedNodes;
    }
    setCachedNodes(t2) {
      this._cachedNodes = t2;
    }
    is(t2) {
      return !!br(t2) && (this.anchor.is(t2.anchor) && this.focus.is(t2.focus) && this.format === t2.format && this.style === t2.style);
    }
    isCollapsed() {
      return this.anchor.is(this.focus);
    }
    getNodes() {
      const t2 = this._cachedNodes;
      if (null !== t2) return t2;
      const e2 = (function(t3) {
        const e3 = [], [n2, r3] = t3.getTextSlices();
        n2 && e3.push(n2.caret.origin);
        const i3 = /* @__PURE__ */ new Set(), o2 = /* @__PURE__ */ new Set();
        for (const n3 of t3) if (ol(n3)) {
          const { origin: t4 } = n3;
          0 === e3.length ? i3.add(t4) : (o2.add(t4), e3.push(t4));
        } else {
          const { origin: t4 } = n3;
          Mi(t4) && o2.has(t4) || e3.push(t4);
        }
        r3 && e3.push(r3.caret.origin);
        if (il(t3.focus) && Mi(t3.focus.origin) && null === t3.focus.getNodeAtCaret()) for (let n3 = hl(t3.focus.origin, "previous"); ol(n3) && i3.has(n3.origin) && !n3.origin.isEmpty() && n3.origin.is(e3[e3.length - 1]); n3 = _l(n3)) i3.delete(n3.origin), e3.pop();
        for (; e3.length > 1; ) {
          const t4 = e3[e3.length - 1];
          if (!Mi(t4) || o2.has(t4) || t4.isEmpty() || i3.has(t4)) break;
          e3.pop();
        }
        if (0 === e3.length && t3.isCollapsed()) {
          const n3 = Kl(t3.anchor), r4 = Kl(t3.anchor.getFlipped()), i4 = (t4) => nl(t4) ? t4.origin : t4.getNodeAtCaret(), o3 = i4(n3) || i4(r4) || (t3.anchor.getNodeAtCaret() ? n3.origin : r4.origin);
          e3.push(o3);
        }
        return e3;
      })(Bl(Pl(this), "next"));
      return ai() || (this._cachedNodes = e2), e2;
    }
    setTextNodeRange(t2, e2, n2, r3) {
      this.anchor.set(t2.__key, e2, "text"), this.focus.set(n2.__key, r3, "text");
    }
    getTextContent() {
      const t2 = this.getNodes();
      if (0 === t2.length) return "";
      const e2 = t2[0], n2 = t2[t2.length - 1], r3 = this.anchor, i3 = this.focus, o2 = r3.isBefore(i3), [s4, l3] = Mr(this);
      let c3 = "", a3 = true;
      for (let u3 = 0; u3 < t2.length; u3++) {
        const f3 = t2[u3];
        if (Mi(f3) && !f3.isInline()) a3 || (c3 += "\n"), a3 = !f3.isEmpty();
        else if (a3 = false, pr(f3)) {
          let t3 = f3.getTextContent();
          f3 === e2 ? f3 === n2 ? "element" === r3.type && "element" === i3.type && i3.offset !== r3.offset || (t3 = s4 < l3 ? t3.slice(s4, l3) : t3.slice(l3, s4)) : t3 = o2 ? t3.slice(s4) : t3.slice(l3) : f3 === n2 && (t3 = o2 ? t3.slice(0, l3) : t3.slice(0, s4)), c3 += t3;
        } else !Di(f3) && !Qn(f3) || f3 === n2 && this.isCollapsed() || (c3 += f3.getTextContent());
      }
      return c3;
    }
    applyDOMRange(t2) {
      const e2 = hi(), n2 = e2.getEditorState()._selection, r3 = Kr(t2.startContainer, t2.startOffset, t2.endContainer, t2.endOffset, e2, n2);
      if (null === r3) return;
      const [i3, o2] = r3;
      this.anchor.set(i3.key, i3.offset, i3.type, true), this.focus.set(o2.key, o2.offset, o2.type, true), St(this);
    }
    clone() {
      const t2 = this.anchor, e2 = this.focus;
      return new _wr(vr(t2.key, t2.offset, t2.type), vr(e2.key, e2.offset, e2.type), this.format, this.style);
    }
    toggleFormat(t2) {
      this.format = So(this.format, t2, null), this.dirty = true;
    }
    setFormat(t2) {
      this.format = t2, this.dirty = true;
    }
    setStyle(t2) {
      this.style = t2, this.dirty = true;
    }
    hasFormat(t2) {
      const e2 = R[t2];
      return 0 !== (this.format & e2);
    }
    insertRawText(t2) {
      const e2 = t2.split(/(\r?\n|\t)/), n2 = [], r3 = e2.length;
      for (let t3 = 0; t3 < r3; t3++) {
        const r4 = e2[t3];
        "\n" === r4 || "\r\n" === r4 ? n2.push(Xn()) : "	" === r4 ? n2.push(xr()) : n2.push(_r(r4));
      }
      this.insertNodes(n2);
    }
    insertText(e2) {
      const n2 = this.anchor, r3 = this.focus, i3 = this.format, o2 = this.style;
      let s4 = n2, l3 = r3;
      !this.isCollapsed() && r3.isBefore(n2) && (s4 = r3, l3 = n2), "element" === s4.type && (function(t2, e3, n3, r4) {
        const i4 = t2.getNode(), o3 = i4.getChildAtIndex(t2.offset), s5 = _r();
        if (s5.setFormat(n3), s5.setStyle(r4), Ui(o3)) o3.splice(0, 0, [s5]);
        else {
          const t3 = Li(i4) ? $i().append(s5) : s5;
          null === o3 ? i4.append(t3) : o3.insertBefore(t3);
        }
        t2.is(e3) && e3.set(s5.__key, 0, "text"), t2.set(s5.__key, 0, "text");
      })(s4, l3, i3, o2), "element" === l3.type && Ol(l3, Kl(El(l3, "next")));
      const c3 = s4.offset;
      let a3 = l3.offset;
      const u3 = this.getNodes(), f3 = u3.length;
      let d4 = u3[0];
      pr(d4) || t(26);
      const h2 = d4.getTextContent().length, g3 = d4.getParentOrThrow();
      let _5 = u3[f3 - 1];
      if (1 === f3 && "element" === l3.type && (a3 = h2, l3.set(s4.key, a3, "text")), this.isCollapsed() && c3 === h2 && (yo(d4) || !d4.canInsertTextAfter() || !g3.canInsertTextAfter() && null === d4.getNextSibling())) {
        let t2 = d4.getNextSibling();
        if (pr(t2) && t2.canInsertTextBefore() && !yo(t2) || (t2 = _r(), t2.setFormat(i3), t2.setStyle(o2), g3.canInsertTextAfter() ? d4.insertAfter(t2) : g3.insertAfter(t2)), t2.select(0, 0), d4 = t2, "" !== e2) return void this.insertText(e2);
      } else if (this.isCollapsed() && 0 === c3 && (yo(d4) || !d4.canInsertTextBefore() || !g3.canInsertTextBefore() && null === d4.getPreviousSibling())) {
        let t2 = d4.getPreviousSibling();
        if (pr(t2) && !yo(t2) || (t2 = _r(), t2.setFormat(i3), g3.canInsertTextBefore() ? d4.insertBefore(t2) : g3.insertBefore(t2)), t2.select(), d4 = t2, "" !== e2) return void this.insertText(e2);
      } else if (d4.isSegmented() && c3 !== h2) {
        const t2 = _r(d4.getTextContent());
        t2.setFormat(i3), d4.replace(t2), d4 = t2;
      } else if (!this.isCollapsed() && "" !== e2) {
        const t2 = _5.getParent();
        if (!g3.canInsertTextBefore() || !g3.canInsertTextAfter() || Mi(t2) && (!t2.canInsertTextBefore() || !t2.canInsertTextAfter())) return this.insertText(""), Ir(this.anchor, this.focus, null), void this.insertText(e2);
      }
      if (1 === f3) {
        if (po(d4)) {
          const t3 = _r(e2);
          return t3.select(), void d4.replace(t3);
        }
        const t2 = d4.getFormat(), n3 = d4.getStyle();
        if (c3 !== a3 || t2 === i3 && n3 === o2) {
          if (Cr(d4)) {
            const t3 = _r(e2);
            return t3.setFormat(i3), t3.setStyle(o2), t3.select(), void d4.replace(t3);
          }
        } else {
          if ("" !== d4.getTextContent()) {
            const t3 = _r(e2);
            if (t3.setFormat(i3), t3.setStyle(o2), t3.select(), 0 === c3) d4.insertBefore(t3, false);
            else {
              const [e3] = d4.splitText(c3);
              e3.insertAfter(t3, false);
            }
            return void (t3.isComposing() && "text" === this.anchor.type && (this.anchor.offset -= e2.length));
          }
          d4.setFormat(i3), d4.setStyle(o2);
        }
        const r4 = a3 - c3;
        d4 = d4.spliceText(c3, r4, e2, true), "" === d4.getTextContent() ? d4.remove() : "text" === this.anchor.type && (d4.isComposing() ? this.anchor.offset -= e2.length : (this.format = t2, this.style = n3));
      } else {
        const t2 = /* @__PURE__ */ new Set([...d4.getParentKeys(), ..._5.getParentKeys()]), n3 = Mi(d4) ? d4 : d4.getParentOrThrow();
        let r4 = Mi(_5) ? _5 : _5.getParentOrThrow(), i4 = _5;
        if (!n3.is(r4) && r4.isInline()) do {
          i4 = r4, r4 = r4.getParentOrThrow();
        } while (r4.isInline());
        if ("text" === l3.type && (0 !== a3 || "" === _5.getTextContent()) || "element" === l3.type && _5.getIndexWithinParent() < a3) if (pr(_5) && !po(_5) && a3 !== _5.getTextContentSize()) {
          if (_5.isSegmented()) {
            const t3 = _r(_5.getTextContent());
            _5.replace(t3), _5 = t3;
          }
          Li(l3.getNode()) || "text" !== l3.type || (_5 = _5.spliceText(0, a3, "")), t2.add(_5.__key);
        } else {
          const t3 = _5.getParentOrThrow();
          t3.canBeEmpty() || 1 !== t3.getChildrenSize() ? _5.remove() : t3.remove();
        }
        else t2.add(_5.__key);
        const o3 = r4.getChildren(), s5 = new Set(u3), g4 = n3.is(r4), p3 = n3.isInline() && null === d4.getNextSibling() ? n3 : d4;
        for (let t3 = o3.length - 1; t3 >= 0; t3--) {
          const e3 = o3[t3];
          if (e3.is(d4) || Mi(e3) && e3.isParentOf(d4)) break;
          e3.isAttached() && (!s5.has(e3) || e3.is(i4) ? g4 || p3.insertAfter(e3, false) : e3.remove());
        }
        if (!g4) {
          let e3 = r4, n4 = null;
          for (; null !== e3; ) {
            const r5 = e3.getChildren(), i5 = r5.length;
            (0 === i5 || r5[i5 - 1].is(n4)) && (t2.delete(e3.__key), n4 = e3), e3 = e3.getParent();
          }
        }
        if (po(d4)) if (c3 === h2) d4.select();
        else {
          const t3 = _r(e2);
          t3.select(), d4.replace(t3);
        }
        else d4 = d4.spliceText(c3, h2 - c3, e2, true), "" === d4.getTextContent() ? d4.remove() : d4.isComposing() && "text" === this.anchor.type && (this.anchor.offset -= e2.length);
        for (let e3 = 1; e3 < f3; e3++) {
          const n4 = u3[e3], r5 = n4.__key;
          t2.has(r5) || n4.remove();
        }
      }
    }
    removeText() {
      const t2 = $r() === this;
      Al(this, Il(Pl(this))), t2 && $r() !== this && Io(this);
    }
    formatText(t2, e2 = null) {
      if (this.isCollapsed()) return this.toggleFormat(t2), void bo(null);
      const n2 = this.getNodes(), r3 = [];
      for (const t3 of n2) pr(t3) && r3.push(t3);
      const i3 = (e3) => {
        n2.forEach((n3) => {
          if (Mi(n3)) {
            const r4 = n3.getFormatFlags(t2, e3);
            n3.setTextFormat(r4);
          }
        });
      }, o2 = r3.length;
      if (0 === o2) return this.toggleFormat(t2), bo(null), void i3(e2);
      const s4 = this.anchor, l3 = this.focus, c3 = this.isBackward(), a3 = c3 ? l3 : s4, u3 = c3 ? s4 : l3;
      let f3 = 0, d4 = r3[0], h2 = "element" === a3.type ? 0 : a3.offset;
      if ("text" === a3.type && h2 === d4.getTextContentSize() && (f3 = 1, d4 = r3[1], h2 = 0), null == d4) return;
      const g3 = d4.getFormatFlags(t2, e2);
      i3(g3);
      const _5 = o2 - 1;
      let p3 = r3[_5];
      const y4 = "text" === u3.type ? u3.offset : p3.getTextContentSize();
      if (d4.is(p3)) {
        if (h2 === y4) return;
        if (yo(d4) || 0 === h2 && y4 === d4.getTextContentSize()) d4.setFormat(g3);
        else {
          const t3 = d4.splitText(h2, y4), e3 = 0 === h2 ? t3[0] : t3[1];
          e3.setFormat(g3), "text" === a3.type && a3.set(e3.__key, 0, "text"), "text" === u3.type && u3.set(e3.__key, y4 - h2, "text");
        }
        return void (this.format = g3);
      }
      0 === h2 || yo(d4) || ([, d4] = d4.splitText(h2), h2 = 0), d4.setFormat(g3);
      const m3 = p3.getFormatFlags(t2, g3);
      y4 > 0 && (y4 === p3.getTextContentSize() || yo(p3) || ([p3] = p3.splitText(y4)), p3.setFormat(m3));
      for (let e3 = f3 + 1; e3 < _5; e3++) {
        const n3 = r3[e3], i4 = n3.getFormatFlags(t2, m3);
        n3.setFormat(i4);
      }
      "text" === a3.type && a3.set(d4.__key, h2, "text"), "text" === u3.type && u3.set(p3.__key, y4, "text"), this.format = g3 | m3;
    }
    insertNodes(e2) {
      if (0 === e2.length) return;
      if (this.isCollapsed() || this.removeText(), "root" === this.anchor.key) {
        this.insertParagraph();
        const n3 = $r();
        return br(n3) || t(134), n3.insertNodes(e2);
      }
      const n2 = (this.isBackward() ? this.focus : this.anchor).getNode(), r3 = Ys(n2, Fs), i3 = e2[e2.length - 1];
      if (Mi(r3) && "__language" in r3) {
        if ("__language" in e2[0]) this.insertText(e2[0].getTextContent());
        else {
          const t2 = ti(this);
          r3.splice(t2, 0, e2), i3.selectEnd();
        }
        return;
      }
      if (!e2.some((t2) => (Mi(t2) || Di(t2)) && !t2.isInline())) {
        Mi(r3) || t(211, n2.constructor.name, n2.getType());
        const o3 = ti(this);
        return r3.splice(o3, 0, e2), void i3.selectEnd();
      }
      const o2 = (function(t2) {
        const e3 = $i();
        let n3 = null;
        for (let r4 = 0; r4 < t2.length; r4++) {
          const i4 = t2[r4], o3 = Qn(i4);
          if (o3 || Di(i4) && i4.isInline() || Mi(i4) && i4.isInline() || pr(i4) || i4.isParentRequired()) {
            if (null === n3 && (n3 = i4.createParentElementNode(), e3.append(n3), o3)) continue;
            null !== n3 && n3.append(i4);
          } else e3.append(i4), n3 = null;
        }
        return e3;
      })(e2), s4 = o2.getLastDescendant(), l3 = o2.getChildren(), c3 = !Mi(r3) || !r3.isEmpty() ? this.insertParagraph() : null, a3 = l3[l3.length - 1];
      let u3 = l3[0];
      var f3;
      Mi(f3 = u3) && Fs(f3) && !f3.isEmpty() && Mi(r3) && (!r3.isEmpty() || r3.canMergeWhenEmpty()) && (Mi(r3) || t(211, n2.constructor.name, n2.getType()), r3.append(...u3.getChildren()), u3 = l3[1]), u3 && (null === r3 && t(212, n2.constructor.name, n2.getType()), (function(e3, n3) {
        const r4 = n3.getParentOrThrow().getLastChild();
        let i4 = n3;
        const o3 = [n3];
        for (; i4 !== r4; ) i4.getNextSibling() || t(140), i4 = i4.getNextSibling(), o3.push(i4);
        let s5 = e3;
        for (const t2 of o3) s5 = s5.insertAfter(t2);
      })(r3, u3));
      const d4 = Ys(s4, Fs);
      c3 && Mi(d4) && (c3.canMergeWhenEmpty() || Fs(a3)) && (d4.append(...c3.getChildren()), c3.remove()), Mi(r3) && r3.isEmpty() && r3.remove(), s4.selectEnd();
      const h2 = Mi(r3) ? r3.getLastChild() : null;
      Qn(h2) && d4 !== r3 && h2.remove();
    }
    insertParagraph() {
      if ("root" === this.anchor.key) {
        const t2 = $i();
        return Fo().splice(this.anchor.offset, 0, [t2]), t2.select(), t2;
      }
      const e2 = ti(this), n2 = Ys(this.anchor.getNode(), Fs);
      Mi(n2) || t(213);
      const r3 = n2.getChildAtIndex(e2), i3 = r3 ? [r3, ...r3.getNextSiblings()] : [], o2 = n2.insertNewAfter(this, false);
      return o2 ? (o2.append(...i3), o2.selectStart(), o2) : null;
    }
    insertLineBreak(t2) {
      const e2 = Xn();
      if (this.insertNodes([e2]), t2) {
        const t3 = e2.getParentOrThrow(), n2 = e2.getIndexWithinParent();
        t3.select(n2, n2);
      }
    }
    extract() {
      const t2 = [...this.getNodes()], e2 = t2.length;
      let n2 = t2[0], r3 = t2[e2 - 1];
      const [i3, o2] = Mr(this), s4 = this.isBackward(), [l3, c3] = s4 ? [this.focus, this.anchor] : [this.anchor, this.focus], [a3, u3] = s4 ? [o2, i3] : [i3, o2];
      if (0 === e2) return [];
      if (1 === e2) {
        if (pr(n2) && !this.isCollapsed()) {
          const t3 = n2.splitText(a3, u3), e3 = 0 === a3 ? t3[0] : t3[1];
          return e3 ? (l3.set(e3.getKey(), 0, "text"), c3.set(e3.getKey(), e3.getTextContentSize(), "text"), [e3]) : [];
        }
        return [n2];
      }
      if (pr(n2) && (a3 === n2.getTextContentSize() ? t2.shift() : 0 !== a3 && ([, n2] = n2.splitText(a3), t2[0] = n2, l3.set(n2.getKey(), 0, "text"))), pr(r3)) {
        const e3 = r3.getTextContent().length;
        0 === u3 ? t2.pop() : u3 !== e3 && ([r3] = r3.splitText(u3), t2[t2.length - 1] = r3, c3.set(r3.getKey(), r3.getTextContentSize(), "text"));
      }
      return t2;
    }
    modify(t2, e2, n2) {
      if (ni(this, t2, e2, n2)) return;
      const r3 = "move" === t2, i3 = hi(), o2 = Ns(_s(i3));
      if (!o2) return;
      const s4 = i3._blockCursorElement, l3 = i3._rootElement, c3 = this.focus.getNode();
      if (null === l3 || null === s4 || !Mi(c3) || c3.isInline() || c3.canBeEmpty() || Ts(s4, i3, l3), this.dirty) {
        let t3 = ls(i3, this.anchor.key), e3 = ls(i3, this.focus.key);
        "text" === this.anchor.type && (t3 = Co(t3)), "text" === this.focus.type && (e3 = Co(e3)), t3 && e3 && Gr(o2, t3, this.anchor.offset, e3, this.focus.offset);
      }
      if ((function(t3, e3, n3, r4) {
        t3.modify(e3, n3, r4);
      })(o2, t2, e2 ? "backward" : "forward", n2), o2.rangeCount > 0) {
        const t3 = o2.getRangeAt(0), n3 = this.anchor.getNode(), i4 = Li(n3) ? n3 : ys(n3);
        if (this.applyDOMRange(t3), this.dirty = true, !r3) {
          const n4 = this.getNodes(), r4 = [];
          let s5 = false;
          for (let t4 = 0; t4 < n4.length; t4++) {
            const e3 = n4[t4];
            hs(e3, i4) ? r4.push(e3) : s5 = true;
          }
          if (s5 && r4.length > 0) if (e2) {
            const t4 = r4[0];
            Mi(t4) ? t4.selectStart() : t4.getParentOrThrow().selectStart();
          } else {
            const t4 = r4[r4.length - 1];
            Mi(t4) ? t4.selectEnd() : t4.getParentOrThrow().selectEnd();
          }
          o2.anchorNode === t3.startContainer && o2.anchorOffset === t3.startOffset || (function(t4) {
            const e3 = t4.focus, n5 = t4.anchor, r5 = n5.key, i5 = n5.offset, o3 = n5.type;
            n5.set(e3.key, e3.offset, e3.type, true), e3.set(r5, i5, o3, true);
          })(this);
        }
      }
      "lineboundary" === n2 && ni(this, t2, e2, n2, "decorators");
    }
    forwardDeletion(t2, e2, n2) {
      if (!n2 && ("element" === t2.type && Mi(e2) && t2.offset === e2.getChildrenSize() || "text" === t2.type && t2.offset === e2.getTextContentSize())) {
        const t3 = e2.getParent(), n3 = e2.getNextSibling() || (null === t3 ? null : t3.getNextSibling());
        if (Mi(n3) && n3.isShadowRoot()) return true;
      }
      return false;
    }
    deleteCharacter(t2) {
      const e2 = this.isCollapsed();
      if (this.isCollapsed()) {
        const e3 = this.anchor;
        let n2 = e3.getNode();
        if (this.forwardDeletion(e3, n2, t2)) return;
        const r3 = xl(El(e3, t2 ? "previous" : "next"));
        if (r3.getTextSlices().every((t3) => null === t3 || 0 === t3.distance)) {
          let t3 = { type: "initial" };
          for (const e4 of r3.iterNodeCarets("shadowRoot")) if (ol(e4)) if (e4.origin.isInline()) ;
          else {
            if (e4.origin.isShadowRoot()) {
              if ("merge-block" === t3.type) break;
              if (Mi(r3.anchor.origin) && r3.anchor.origin.isEmpty()) {
                const t4 = Kl(e4);
                Al(this, Sl(t4, t4)), r3.anchor.origin.remove();
              }
              return;
            }
            "merge-next-block" !== t3.type && "merge-block" !== t3.type || (t3 = { block: t3.block, caret: e4, type: "merge-block" });
          }
          else {
            if ("merge-block" === t3.type) break;
            if (il(e4)) {
              if (Mi(e4.origin)) {
                if (e4.origin.isInline()) {
                  if (!e4.origin.isParentOf(r3.anchor.origin)) break;
                } else t3 = { block: e4.origin, type: "merge-next-block" };
                continue;
              }
              if (Di(e4.origin)) {
                if (e4.origin.isIsolated()) ;
                else if ("merge-next-block" === t3.type && (e4.origin.isKeyboardSelectable() || !e4.origin.isInline()) && Mi(r3.anchor.origin) && r3.anchor.origin.isEmpty()) {
                  r3.anchor.origin.remove();
                  const t4 = Wr();
                  t4.add(e4.origin.getKey()), Io(t4);
                } else e4.origin.remove();
                return;
              }
              break;
            }
          }
          if ("merge-block" === t3.type) {
            const { caret: e4, block: n3 } = t3;
            return Al(this, Sl(!e4.origin.isEmpty() && n3.isEmpty() ? Dl(al(n3, e4.direction)) : r3.anchor, e4)), this.removeText();
          }
        }
        const i3 = this.focus;
        if (this.modify("extend", t2, "character"), this.isCollapsed()) {
          if (t2 && 0 === e3.offset && Ar(this, e3.getNode())) return;
        } else {
          const r4 = "text" === i3.type ? i3.getNode() : null;
          if (n2 = "text" === e3.type ? e3.getNode() : null, null !== r4 && r4.isSegmented()) {
            const e4 = i3.offset, o2 = r4.getTextContentSize();
            if (r4.is(n2) || t2 && e4 !== o2 || !t2 && 0 !== e4) return void Dr(r4, t2, e4);
          } else if (null !== n2 && n2.isSegmented()) {
            const i4 = e3.offset, o2 = n2.getTextContentSize();
            if (n2.is(r4) || t2 && 0 !== i4 || !t2 && i4 !== o2) return void Dr(n2, t2, i4);
          }
          !(function(t3, e4) {
            const n3 = t3.anchor, r5 = t3.focus, i4 = n3.getNode(), o2 = r5.getNode();
            if (i4 === o2 && "text" === n3.type && "text" === r5.type) {
              const t4 = n3.offset, o3 = r5.offset, s4 = t4 < o3, l3 = s4 ? t4 : o3, c3 = s4 ? o3 : t4, a3 = c3 - 1;
              if (l3 !== a3) {
                (function(t5) {
                  return !(zo(t5) || Pr(t5));
                })(i4.getTextContent().slice(l3, c3)) && (e4 ? r5.set(r5.key, a3, r5.type) : n3.set(n3.key, a3, n3.type));
              }
            }
          })(this, t2);
        }
      }
      if (this.removeText(), t2 && !e2 && this.isCollapsed() && "element" === this.anchor.type && 0 === this.anchor.offset) {
        const t3 = this.anchor.getNode();
        t3.isEmpty() && Li(t3.getParent()) && null === t3.getPreviousSibling() && Ar(this, t3);
      }
    }
    deleteLine(t2) {
      this.isCollapsed() && this.modify("extend", t2, "lineboundary"), this.isCollapsed() ? this.deleteCharacter(t2) : this.removeText();
    }
    deleteWord(t2) {
      if (this.isCollapsed()) {
        const e2 = this.anchor, n2 = e2.getNode();
        if (this.forwardDeletion(e2, n2, t2)) return;
        this.modify("extend", t2, "word");
      }
      this.removeText();
    }
    isBackward() {
      return this.focus.isBefore(this.anchor);
    }
    getStartEndPoints() {
      return [this.anchor, this.focus];
    }
  };
  function Er(t2) {
    return t2 instanceof Nr;
  }
  function Or(t2) {
    const e2 = t2.offset;
    if ("text" === t2.type) return e2;
    const n2 = t2.getNode();
    return e2 === n2.getChildrenSize() ? n2.getTextContent().length : 0;
  }
  function Mr(t2) {
    const e2 = t2.getStartEndPoints();
    if (null === e2) return [0, 0];
    const [n2, r3] = e2;
    return "element" === n2.type && "element" === r3.type && n2.key === r3.key && n2.offset === r3.offset ? [0, 0] : [Or(n2), Or(r3)];
  }
  function Ar(t2, e2) {
    for (let n2 = e2; n2; n2 = n2.getParent()) {
      if (Mi(n2)) {
        if (n2.collapseAtStart(t2)) return true;
        if (ms(n2)) break;
      }
      if (n2.getPreviousSibling()) break;
    }
    return false;
  }
  var Pr = (() => {
    try {
      const t2 = new RegExp("\\p{Emoji}", "u"), e2 = t2.test.bind(t2);
      if (e2("\u2764\uFE0F") && e2("#\uFE0F\u20E3") && e2("\u{1F44D}")) return e2;
    } catch (t2) {
    }
    return () => false;
  })();
  function Dr(t2, e2, n2) {
    const r3 = t2, i3 = r3.getTextContent().split(/(?=\s)/g), o2 = i3.length;
    let s4 = 0, l3 = 0;
    for (let t3 = 0; t3 < o2; t3++) {
      const r4 = t3 === o2 - 1;
      if (l3 = s4, s4 += i3[t3].length, e2 && s4 === n2 || s4 > n2 || r4) {
        i3.splice(t3, 1), r4 && (l3 = void 0);
        break;
      }
    }
    const c3 = i3.join("").trim();
    "" === c3 ? r3.remove() : (r3.setTextContent(c3), r3.select(l3, l3));
  }
  function Fr(e2, n2, r3, i3) {
    let o2, s4 = n2;
    if (Os(e2)) {
      let l3 = false;
      const c3 = e2.childNodes, a3 = c3.length, u3 = i3._blockCursorElement;
      s4 === a3 && (l3 = true, s4 = a3 - 1);
      let f3 = c3[s4], d4 = false;
      if (f3 === u3) f3 = c3[s4 + 1], d4 = true;
      else if (null !== u3) {
        const t2 = u3.parentNode;
        if (e2 === t2) {
          n2 > Array.prototype.indexOf.call(t2.children, u3) && s4--;
        }
      }
      if (o2 = Ko(f3), pr(o2)) s4 = fl(o2, l3 ? "next" : "previous");
      else {
        let c4 = Ko(e2);
        if (null === c4) return null;
        if (Mi(c4)) {
          const a4 = i3.getElementByKey(c4.getKey());
          null === a4 && t(214);
          const u4 = c4.getDOMSlot(a4);
          [c4, s4] = u4.resolveChildIndex(c4, a4, e2, n2), Mi(c4) || t(215), l3 && s4 >= c4.getChildrenSize() && (s4 = Math.max(0, c4.getChildrenSize() - 1));
          let f4 = c4.getChildAtIndex(s4);
          if (Mi(f4) && (function(t2, e3, n3) {
            const r4 = t2.getParent();
            return null === n3 || null === r4 || !r4.canBeEmpty() || r4 !== n3.getNode();
          })(f4, 0, r3)) {
            const t2 = l3 ? f4.getLastDescendant() : f4.getFirstDescendant();
            null === t2 ? c4 = f4 : (f4 = t2, c4 = Mi(f4) ? f4 : f4.getParentOrThrow()), s4 = 0;
          }
          pr(f4) ? (o2 = f4, c4 = null, s4 = fl(f4, l3 ? "next" : "previous")) : f4 !== c4 && l3 && !d4 && (Mi(c4) || t(216), s4 = Math.min(c4.getChildrenSize(), s4 + 1));
        } else {
          const t2 = c4.getIndexWithinParent();
          s4 = 0 === n2 && Di(c4) && Ko(e2) === c4 ? t2 : t2 + 1, c4 = c4.getParentOrThrow();
        }
        if (Mi(c4)) return vr(c4.__key, s4, "element");
      }
    } else o2 = Ko(e2);
    return pr(o2) ? vr(o2.__key, fl(o2, s4, "clamp"), "text") : null;
  }
  function Lr(t2, e2, n2) {
    const r3 = t2.offset, i3 = t2.getNode();
    if (0 === r3) {
      const r4 = i3.getPreviousSibling(), o2 = i3.getParent();
      if (e2) {
        if ((n2 || !e2) && null === r4 && Mi(o2) && o2.isInline()) {
          const e3 = o2.getPreviousSibling();
          pr(e3) && t2.set(e3.__key, e3.getTextContent().length, "text");
        }
      } else Mi(r4) && !n2 && r4.isInline() ? t2.set(r4.__key, r4.getChildrenSize(), "element") : pr(r4) && t2.set(r4.__key, r4.getTextContent().length, "text");
    } else if (r3 === i3.getTextContent().length) {
      const r4 = i3.getNextSibling(), o2 = i3.getParent();
      if (e2 && Mi(r4) && r4.isInline()) t2.set(r4.__key, 0, "element");
      else if ((n2 || e2) && null === r4 && Mi(o2) && o2.isInline() && !o2.canInsertTextAfter()) {
        const e3 = o2.getNextSibling();
        pr(e3) && t2.set(e3.__key, 0, "text");
      }
    }
  }
  function Ir(t2, e2, n2) {
    if ("text" === t2.type && "text" === e2.type) {
      const r3 = t2.isBefore(e2), i3 = t2.is(e2);
      Lr(t2, r3, i3), Lr(e2, !r3, i3), i3 && e2.set(t2.key, t2.offset, t2.type);
      const o2 = hi();
      if (o2.isComposing() && o2._compositionKey !== t2.key && br(n2)) {
        const r4 = n2.anchor, i4 = n2.focus;
        t2.set(r4.key, r4.offset, r4.type, true), e2.set(i4.key, i4.offset, i4.type, true);
      }
    }
  }
  function Kr(t2, e2, n2, r3, i3, o2) {
    if (null === t2 || null === n2 || !uo(i3, t2, n2)) return null;
    const s4 = Fr(t2, e2, br(o2) ? o2.anchor : null, i3);
    if (null === s4) return null;
    const l3 = Fr(n2, r3, br(o2) ? o2.focus : null, i3);
    if (null === l3) return null;
    if ("element" === s4.type && "element" === l3.type) {
      const e3 = Ko(t2), r4 = Ko(n2);
      if (Di(e3) && Di(r4)) return null;
    }
    return Ir(s4, l3, o2), [s4, l3];
  }
  function zr(t2) {
    return Mi(t2) && !t2.isInline();
  }
  function Rr(t2, e2, n2, r3, i3, o2) {
    const s4 = di(), l3 = new wr(vr(t2, e2, i3), vr(n2, r3, o2), 0, "");
    return l3.dirty = true, s4._selection = l3, l3;
  }
  function Br() {
    const t2 = vr("root", 0, "element"), e2 = vr("root", 0, "element");
    return new wr(t2, e2, 0, "");
  }
  function Wr() {
    return new Nr(/* @__PURE__ */ new Set());
  }
  function Jr(t2, e2) {
    return jr(null, t2, e2, null);
  }
  function jr(t2, e2, n2, r3) {
    const i3 = n2._window;
    if (null === i3) return null;
    const o2 = r3 || i3.event, s4 = o2 ? o2.type : void 0, l3 = "selectionchange" === s4, c3 = !q && (l3 || "beforeinput" === s4 || "compositionstart" === s4 || "compositionend" === s4 || "click" === s4 && o2 && 3 === o2.detail || "drop" === s4 || void 0 === s4);
    let a3, u3, f3, d4;
    if (br(t2) && !c3) return t2.clone();
    if (null === e2) return null;
    if (a3 = e2.anchorNode, u3 = e2.focusNode, f3 = e2.anchorOffset, d4 = e2.focusOffset, (l3 || void 0 === s4) && br(t2) && !uo(n2, a3, u3)) return t2.clone();
    const h2 = Kr(a3, f3, u3, d4, n2, t2);
    if (null === h2) return null;
    const [g3, _5] = h2;
    return new wr(g3, _5, br(t2) ? t2.format : 0, br(t2) ? t2.style : "");
  }
  function $r() {
    return di()._selection;
  }
  function Ur() {
    return hi()._editorState._selection;
  }
  function Vr(t2, e2, n2, r3 = 1) {
    const i3 = t2.anchor, o2 = t2.focus, s4 = i3.getNode(), l3 = o2.getNode();
    if (!e2.is(s4) && !e2.is(l3)) return;
    const c3 = e2.__key;
    if (t2.isCollapsed()) {
      const e3 = i3.offset;
      if (n2 <= e3 && r3 > 0 || n2 < e3 && r3 < 0) {
        const n3 = Math.max(0, e3 + r3);
        i3.set(c3, n3, "element"), o2.set(c3, n3, "element"), Yr(t2);
      }
    } else {
      const s5 = t2.isBackward(), l4 = s5 ? o2 : i3, a3 = l4.getNode(), u3 = s5 ? i3 : o2, f3 = u3.getNode();
      if (e2.is(a3)) {
        const t3 = l4.offset;
        (n2 <= t3 && r3 > 0 || n2 < t3 && r3 < 0) && l4.set(c3, Math.max(0, t3 + r3), "element");
      }
      if (e2.is(f3)) {
        const t3 = u3.offset;
        (n2 <= t3 && r3 > 0 || n2 < t3 && r3 < 0) && u3.set(c3, Math.max(0, t3 + r3), "element");
      }
    }
    Yr(t2);
  }
  function Yr(t2) {
    const e2 = t2.anchor, n2 = e2.offset, r3 = t2.focus, i3 = r3.offset, o2 = e2.getNode(), s4 = r3.getNode();
    if (t2.isCollapsed()) {
      if (!Mi(o2)) return;
      const t3 = o2.getChildrenSize(), i4 = n2 >= t3, s5 = i4 ? o2.getChildAtIndex(t3 - 1) : o2.getChildAtIndex(n2);
      if (pr(s5)) {
        let t4 = 0;
        i4 && (t4 = s5.getTextContentSize()), e2.set(s5.__key, t4, "text"), r3.set(s5.__key, t4, "text");
      }
      return;
    }
    if (Mi(o2)) {
      const t3 = o2.getChildrenSize(), r4 = n2 >= t3, i4 = r4 ? o2.getChildAtIndex(t3 - 1) : o2.getChildAtIndex(n2);
      if (pr(i4)) {
        let t4 = 0;
        r4 && (t4 = i4.getTextContentSize()), e2.set(i4.__key, t4, "text");
      }
    }
    if (Mi(s4)) {
      const t3 = s4.getChildrenSize(), e3 = i3 >= t3, n3 = e3 ? s4.getChildAtIndex(t3 - 1) : s4.getChildAtIndex(i3);
      if (pr(n3)) {
        let t4 = 0;
        e3 && (t4 = n3.getTextContentSize()), r3.set(n3.__key, t4, "text");
      }
    }
  }
  function qr(t2, e2, n2, r3, i3) {
    let o2 = null, s4 = 0, l3 = null;
    null !== r3 ? (o2 = r3.__key, pr(r3) ? (s4 = r3.getTextContentSize(), l3 = "text") : Mi(r3) && (s4 = r3.getChildrenSize(), l3 = "element")) : null !== i3 && (o2 = i3.__key, pr(i3) ? l3 = "text" : Mi(i3) && (l3 = "element")), null !== o2 && null !== l3 ? t2.set(o2, s4, l3) : (s4 = e2.getIndexWithinParent(), -1 === s4 && (s4 = n2.getChildrenSize()), t2.set(n2.__key, s4, "element"));
  }
  function Hr(t2, e2, n2, r3, i3) {
    "text" === t2.type ? t2.set(n2, t2.offset + (e2 ? 0 : i3), "text") : t2.offset > r3.getIndexWithinParent() && t2.set(t2.key, t2.offset - 1, "element");
  }
  function Gr(t2, e2, n2, r3, i3) {
    try {
      t2.setBaseAndExtent(e2, n2, r3, i3);
    } catch (t3) {
    }
  }
  function Xr(t2, e2, n2, r3, i3, o2, s4) {
    const l3 = r3.anchorNode, c3 = r3.focusNode, a3 = r3.anchorOffset, u3 = r3.focusOffset, f3 = document.activeElement;
    if (i3.has($n) && f3 !== o2 || null !== f3 && ao(f3)) return;
    if (!br(e2)) return void (null !== t2 && uo(n2, l3, c3) && r3.removeAllRanges());
    const d4 = e2.anchor, h2 = e2.focus, g3 = d4.key, _5 = h2.key, p3 = ls(n2, g3), y4 = ls(n2, _5), m3 = d4.offset, x4 = h2.offset, C4 = e2.format, S3 = e2.style, v4 = e2.isCollapsed();
    let k4 = p3, T4 = y4, N4 = false;
    if ("text" === d4.type) {
      k4 = Co(p3);
      const t3 = d4.getNode();
      N4 = t3.getFormat() !== C4 || t3.getStyle() !== S3;
    } else br(t2) && "text" === t2.anchor.type && (N4 = true);
    var b5, w5, E6, O5, M6;
    if (("text" === h2.type && (T4 = Co(y4)), null !== k4 && null !== T4) && (v4 && (null === t2 || N4 || br(t2) && (t2.format !== C4 || t2.style !== S3)) && (b5 = C4, w5 = S3, E6 = m3, O5 = g3, M6 = performance.now(), _n = [b5, w5, E6, O5, M6]), a3 !== m3 || u3 !== x4 || l3 !== k4 || c3 !== T4 || "Range" === r3.type && v4 || (null !== f3 && o2.contains(f3) || i3.has(qn) || o2.focus({ preventScroll: true }), "element" === d4.type))) {
      if (Gr(r3, k4, m3, T4, x4), !i3.has(Vn) && e2.isCollapsed() && null !== o2 && o2 === document.activeElement) {
        const t3 = br(e2) && "element" === e2.anchor.type ? k4.childNodes[m3] || null : r3.rangeCount > 0 ? r3.getRangeAt(0) : null;
        if (null !== t3) {
          let e3;
          if (t3 instanceof Text) {
            const n3 = document.createRange();
            n3.selectNode(t3), e3 = n3.getBoundingClientRect();
          } else e3 = t3.getBoundingClientRect();
          !(function(t4, e4, n3) {
            const r4 = as(n3), i4 = gs(r4);
            if (null === r4 || null === i4) return;
            let { top: o3, bottom: s5 } = e4, l4 = 0, c4 = 0, a4 = n3;
            for (; null !== a4; ) {
              const e5 = a4 === r4.body;
              if (e5) l4 = 0, c4 = _s(t4).innerHeight;
              else {
                const t5 = a4.getBoundingClientRect();
                l4 = t5.top, c4 = t5.bottom;
              }
              let n4 = 0;
              if (o3 < l4 ? n4 = -(l4 - o3) : s5 > c4 && (n4 = s5 - c4), 0 !== n4) if (e5) i4.scrollBy(0, n4);
              else {
                const t5 = a4.scrollTop;
                a4.scrollTop += n4;
                const e6 = a4.scrollTop - t5;
                o3 -= e6, s5 -= e6;
              }
              if (e5) break;
              a4 = cs(a4);
            }
          })(n2, e3, o2);
        }
      }
      cn = true;
    }
  }
  function Qr(t2) {
    let e2 = $r() || Ur();
    null === e2 && (e2 = Fo().selectEnd()), e2.insertNodes(t2);
  }
  function Zr() {
    const t2 = $r();
    return null === t2 ? "" : t2.getTextContent();
  }
  function ti(e2) {
    let n2 = e2;
    e2.isCollapsed() || n2.removeText();
    const r3 = $r();
    br(r3) && (n2 = r3), br(n2) || t(161);
    const i3 = n2.anchor;
    let o2 = i3.getNode(), s4 = i3.offset;
    for (; !Fs(o2); ) {
      const t2 = o2;
      if ([o2, s4] = ei(o2, s4), t2.is(o2)) break;
    }
    return s4;
  }
  function ei(t2, e2) {
    const n2 = t2.getParent();
    if (!n2) {
      const t3 = $i();
      return Fo().append(t3), t3.select(), [Fo(), 0];
    }
    if (pr(t2)) {
      const r4 = t2.splitText(e2);
      if (0 === r4.length) return [n2, t2.getIndexWithinParent()];
      const i3 = 0 === e2 ? 0 : 1;
      return [n2, r4[0].getIndexWithinParent() + i3];
    }
    if (!Mi(t2) || 0 === e2) return [n2, t2.getIndexWithinParent()];
    const r3 = t2.getChildAtIndex(e2);
    if (r3) {
      const n3 = new wr(vr(t2.__key, e2, "element"), vr(t2.__key, e2, "element"), 0, ""), i3 = t2.insertNewAfter(n3);
      i3 && i3.append(r3, ...r3.getNextSiblings());
    }
    return [n2, t2.getIndexWithinParent() + 1];
  }
  function ni(t2, e2, n2, r3, i3 = "decorators-and-blocks") {
    if ("move" === e2 && "character" === r3 && !t2.isCollapsed()) {
      const [e3, r4] = n2 === t2.isBackward() ? [t2.focus, t2.anchor] : [t2.anchor, t2.focus];
      return r4.set(e3.key, e3.offset, e3.type), true;
    }
    const o2 = El(t2.focus, n2 ? "previous" : "next"), s4 = "lineboundary" === r3, l3 = "move" === e2;
    let c3 = o2, a3 = "decorators-and-blocks" === i3;
    if (!zl(c3)) {
      for (const t3 of c3) {
        a3 = false;
        const { origin: e3 } = t3;
        if (!Di(e3) || e3.isIsolated() || (c3 = t3, !s4 || !e3.isInline())) break;
      }
      if (a3) for (const t3 of xl(o2).iterNodeCarets("extend" === e2 ? "shadowRoot" : "root")) {
        if (ol(t3)) t3.origin.isInline() || (c3 = t3);
        else {
          if (Mi(t3.origin)) continue;
          Di(t3.origin) && !t3.origin.isInline() && (c3 = t3);
        }
        break;
      }
    }
    if (c3 === o2) return false;
    if (l3 && !s4 && Di(c3.origin) && c3.origin.isKeyboardSelectable()) {
      const t3 = Wr();
      return t3.add(c3.origin.getKey()), Io(t3), true;
    }
    return c3 = Kl(c3), l3 && Ol(t2.anchor, c3), Ol(t2.focus, c3), a3 || !s4;
  }
  var ri = null;
  var ii = null;
  var oi = false;
  var si = false;
  var li = 0;
  var ci = { characterData: true, childList: true, subtree: true };
  function ai() {
    return oi || null !== ri && ri._readOnly;
  }
  function ui() {
    oi && t(13);
  }
  function fi() {
    li > 99 && t(14);
  }
  function di() {
    return null === ri && t(195, gi()), ri;
  }
  function hi() {
    return null === ii && t(196, gi()), ii;
  }
  function gi() {
    let t2 = 0;
    const e2 = /* @__PURE__ */ new Set(), n2 = to.version;
    if ("undefined" != typeof window) for (const r4 of document.querySelectorAll("[contenteditable]")) {
      const i3 = go(r4);
      if (fo(i3)) t2++;
      else if (i3) {
        let t3 = String(i3.constructor.version || "<0.17.1");
        t3 === n2 && (t3 += " (separately built, likely a bundler configuration issue)"), e2.add(t3);
      }
    }
    let r3 = ` Detected on the page: ${t2} compatible editor(s) with version ${n2}`;
    return e2.size && (r3 += ` and incompatible editors with versions ${Array.from(e2).join(", ")}`), r3;
  }
  function _i() {
    return ii;
  }
  function pi(t2, e2, n2) {
    const r3 = e2.__type, i3 = oo(t2, r3);
    let o2 = n2.get(r3);
    void 0 === o2 && (o2 = Array.from(i3.transforms), n2.set(r3, o2));
    const s4 = o2.length;
    for (let t3 = 0; t3 < s4 && (o2[t3](e2), e2.isAttached()); t3++) ;
  }
  function yi(t2, e2) {
    return void 0 !== t2 && t2.__key !== e2 && t2.isAttached();
  }
  function mi(t2, e2) {
    if (!e2) return;
    const n2 = t2._updateTags;
    let r3 = e2;
    Array.isArray(e2) || (r3 = [e2]);
    for (const t3 of r3) n2.add(t3);
  }
  function xi(t2) {
    return Ci(t2, hi()._nodes);
  }
  function Ci(e2, n2) {
    const r3 = e2.type, i3 = n2.get(r3);
    void 0 === i3 && t(17, r3);
    const o2 = i3.klass;
    e2.type !== o2.getType() && t(18, o2.name);
    const s4 = o2.importJSON(e2), l3 = e2.children;
    if (Mi(s4) && Array.isArray(l3)) for (let t2 = 0; t2 < l3.length; t2++) {
      const e3 = Ci(l3[t2], n2);
      s4.append(e3);
    }
    return s4;
  }
  function Si(t2, e2, n2) {
    const r3 = ri, i3 = oi, o2 = ii;
    ri = e2, oi = true, ii = t2;
    try {
      return n2();
    } finally {
      ri = r3, oi = i3, ii = o2;
    }
  }
  function vi(t2, e2) {
    const n2 = t2._pendingEditorState, r3 = t2._rootElement, i3 = t2._headless || null === r3;
    if (null === n2) return;
    const o2 = t2._editorState, s4 = o2._selection, l3 = n2._selection, c3 = 0 !== t2._dirtyType, a3 = ri, u3 = oi, f3 = ii, d4 = t2._updating, g3 = t2._observer;
    let _5 = null;
    if (t2._pendingEditorState = null, t2._editorState = n2, !i3 && c3 && null !== g3) {
      ii = t2, ri = n2, oi = false, t2._updating = true;
      try {
        const e3 = t2._dirtyType, r4 = t2._dirtyElements, i4 = t2._dirtyLeaves;
        g3.disconnect(), _5 = ee(o2, n2, t2, e3, r4, i4);
      } catch (e3) {
        if (e3 instanceof Error && t2._onError(e3), si) throw e3;
        return Xi(t2, null, r3, n2), rt(t2), t2._dirtyType = 2, si = true, vi(t2, o2), void (si = false);
      } finally {
        g3.observe(r3, ci), t2._updating = d4, ri = a3, oi = u3, ii = f3;
      }
    }
    n2._readOnly || (n2._readOnly = true);
    const p3 = t2._dirtyLeaves, y4 = t2._dirtyElements, m3 = t2._normalizedNodes, x4 = t2._updateTags, C4 = t2._deferred;
    c3 && (t2._dirtyType = 0, t2._cloneNotNeeded.clear(), t2._dirtyLeaves = /* @__PURE__ */ new Set(), t2._dirtyElements = /* @__PURE__ */ new Map(), t2._normalizedNodes = /* @__PURE__ */ new Set(), t2._updateTags = /* @__PURE__ */ new Set()), (function(t3, e3) {
      const n3 = t3._decorators;
      let r4 = t3._pendingDecorators || n3;
      const i4 = e3._nodeMap;
      let o3;
      for (o3 in r4) i4.has(o3) || (r4 === n3 && (r4 = Po(t3)), delete r4[o3]);
    })(t2, n2);
    const S3 = i3 ? null : Ns(_s(t2));
    if (t2._editable && null !== S3 && (c3 || null === l3 || l3.dirty || !l3.is(s4)) && null !== r3 && !x4.has(Yn)) {
      ii = t2, ri = n2;
      try {
        if (null !== g3 && g3.disconnect(), c3 || null === l3 || l3.dirty) {
          const e3 = t2._blockCursorElement;
          null !== e3 && Ts(e3, t2, r3), Xr(s4, l3, t2, S3, x4, r3);
        }
        !(function(t3, e3, n3) {
          let r4 = t3._blockCursorElement;
          if (br(n3) && n3.isCollapsed() && "element" === n3.anchor.type && e3.contains(document.activeElement)) {
            const i4 = n3.anchor, o3 = i4.getNode(), s5 = i4.offset;
            let l4 = false, c4 = null;
            if (s5 === o3.getChildrenSize()) {
              ks(o3.getChildAtIndex(s5 - 1)) && (l4 = true);
            } else {
              const e4 = o3.getChildAtIndex(s5);
              if (null !== e4 && ks(e4)) {
                const n4 = e4.getPreviousSibling();
                (null === n4 || ks(n4)) && (l4 = true, c4 = t3.getElementByKey(e4.__key));
              }
            }
            if (l4) {
              const n4 = t3.getElementByKey(o3.__key);
              return null === r4 && (t3._blockCursorElement = r4 = (function(t4) {
                const e4 = t4.theme, n5 = document.createElement("div");
                n5.contentEditable = "false", n5.setAttribute("data-lexical-cursor", "true");
                let r5 = e4.blockCursor;
                if (void 0 !== r5) {
                  if ("string" == typeof r5) {
                    const t5 = h(r5);
                    r5 = e4.blockCursor = t5;
                  }
                  void 0 !== r5 && n5.classList.add(...r5);
                }
                return n5;
              })(t3._config)), e3.style.caretColor = "transparent", void (null === c4 ? n4.appendChild(r4) : n4.insertBefore(r4, c4));
            }
          }
          null !== r4 && Ts(r4, t3, e3);
        })(t2, r3, l3);
      } finally {
        null !== g3 && g3.observe(r3, ci), ii = f3, ri = a3;
      }
    }
    null !== _5 && (function(t3, e3, n3, r4, i4) {
      const o3 = Array.from(t3._listeners.mutation), s5 = o3.length;
      for (let t4 = 0; t4 < s5; t4++) {
        const [s6, l4] = o3[t4];
        for (const t5 of l4) {
          const o4 = e3.get(t5);
          void 0 !== o4 && s6(o4, { dirtyLeaves: r4, prevEditorState: i4, updateTags: n3 });
        }
      }
    })(t2, _5, x4, p3, o2), br(l3) || null === l3 || null !== s4 && s4.is(l3) || t2.dispatchCommand(ie, void 0);
    const v4 = t2._pendingDecorators;
    null !== v4 && (t2._decorators = v4, t2._pendingDecorators = null, ki("decorator", t2, true, v4)), (function(t3, e3, n3) {
      const r4 = Do(e3), i4 = Do(n3);
      r4 !== i4 && ki("textcontent", t3, true, i4);
    })(t2, e2 || o2, n2), ki("update", t2, true, { dirtyElements: y4, dirtyLeaves: p3, editorState: n2, mutatedNodes: _5, normalizedNodes: m3, prevEditorState: e2 || o2, tags: x4 }), (function(t3, e3) {
      if (t3._deferred = [], 0 !== e3.length) {
        const n3 = t3._updating;
        t3._updating = true;
        try {
          for (let t4 = 0; t4 < e3.length; t4++) e3[t4]();
        } finally {
          t3._updating = n3;
        }
      }
    })(t2, C4), (function(t3) {
      const e3 = t3._updates;
      if (0 !== e3.length) {
        const n3 = e3.shift();
        if (n3) {
          const [e4, r4] = n3;
          Ni(t3, e4, r4);
        }
      }
    })(t2);
  }
  function ki(t2, e2, n2, ...r3) {
    const i3 = e2._updating;
    e2._updating = n2;
    try {
      const n3 = Array.from(e2._listeners[t2]);
      for (let t3 = 0; t3 < n3.length; t3++) n3[t3].apply(null, r3);
    } finally {
      e2._updating = i3;
    }
  }
  function Ti(e2, n2) {
    const r3 = e2._updates;
    let i3 = n2 || false;
    for (; 0 !== r3.length; ) {
      const n3 = r3.shift();
      if (n3) {
        const [r4, o2] = n3, s4 = e2._pendingEditorState;
        let l3;
        void 0 !== o2 && (l3 = o2.onUpdate, o2.skipTransforms && (i3 = true), o2.discrete && (null === s4 && t(191), s4._flushSync = true), l3 && e2._deferred.push(l3), mi(e2, o2.tag)), null == s4 ? Ni(e2, r4, o2) : r4();
      }
    }
    return i3;
  }
  function Ni(e2, n2, r3) {
    const i3 = e2._updateTags;
    let o2, s4 = false, l3 = false;
    void 0 !== r3 && (o2 = r3.onUpdate, mi(e2, r3.tag), s4 = r3.skipTransforms || false, l3 = r3.discrete || false), o2 && e2._deferred.push(o2);
    const c3 = e2._editorState;
    let a3 = e2._pendingEditorState, u3 = false;
    (null === a3 || a3._readOnly) && (a3 = e2._pendingEditorState = Ii(a3 || c3), u3 = true), a3._flushSync = l3;
    const f3 = ri, d4 = oi, h2 = ii, g3 = e2._updating;
    ri = a3, oi = false, e2._updating = true, ii = e2;
    const _5 = e2._headless || null === e2.getRootElement();
    no(null);
    try {
      u3 && (_5 ? null !== c3._selection && (a3._selection = c3._selection.clone()) : a3._selection = (function(t2, e3) {
        const n3 = t2.getEditorState()._selection, r4 = Ns(_s(t2));
        return br(n3) || null == n3 ? jr(n3, r4, t2, e3) : n3.clone();
      })(e2, r3 && r3.event || null));
      const i4 = e2._compositionKey;
      n2(), s4 = Ti(e2, s4), (function(t2, e3) {
        const n3 = e3.getEditorState()._selection, r4 = t2._selection;
        if (br(r4)) {
          const t3 = r4.anchor, e4 = r4.focus;
          let i5;
          if ("text" === t3.type && (i5 = t3.getNode(), i5.selectionTransform(n3, r4)), "text" === e4.type) {
            const t4 = e4.getNode();
            i5 !== t4 && t4.selectionTransform(n3, r4);
          }
        }
      })(a3, e2), 0 !== e2._dirtyType && (s4 ? (function(t2, e3) {
        const n3 = e3._dirtyLeaves, r4 = t2._nodeMap;
        for (const t3 of n3) {
          const e4 = r4.get(t3);
          pr(e4) && e4.isAttached() && e4.isSimpleText() && !e4.isUnmergeable() && Ct(e4);
        }
      })(a3, e2) : (function(t2, e3) {
        const n3 = e3._dirtyLeaves, r4 = e3._dirtyElements, i5 = t2._nodeMap, o4 = wo(), s5 = /* @__PURE__ */ new Map();
        let l4 = n3, c4 = l4.size, a4 = r4, u4 = a4.size;
        for (; c4 > 0 || u4 > 0; ) {
          if (c4 > 0) {
            e3._dirtyLeaves = /* @__PURE__ */ new Set();
            for (const t3 of l4) {
              const r5 = i5.get(t3);
              pr(r5) && r5.isAttached() && r5.isSimpleText() && !r5.isUnmergeable() && Ct(r5), void 0 !== r5 && yi(r5, o4) && pi(e3, r5, s5), n3.add(t3);
            }
            if (l4 = e3._dirtyLeaves, c4 = l4.size, c4 > 0) {
              li++;
              continue;
            }
          }
          e3._dirtyLeaves = /* @__PURE__ */ new Set(), e3._dirtyElements = /* @__PURE__ */ new Map(), a4.delete("root") && a4.set("root", true);
          for (const t3 of a4) {
            const n4 = t3[0], l5 = t3[1];
            if (r4.set(n4, l5), !l5) continue;
            const c5 = i5.get(n4);
            void 0 !== c5 && yi(c5, o4) && pi(e3, c5, s5);
          }
          l4 = e3._dirtyLeaves, c4 = l4.size, a4 = e3._dirtyElements, u4 = a4.size, li++;
        }
        e3._dirtyLeaves = n3, e3._dirtyElements = r4;
      })(a3, e2), Ti(e2), (function(t2, e3, n3, r4) {
        const i5 = t2._nodeMap, o4 = e3._nodeMap, s5 = [];
        for (const [t3] of r4) {
          const e4 = o4.get(t3);
          void 0 !== e4 && (e4.isAttached() || (Mi(e4) && Y(e4, t3, i5, o4, s5, r4), i5.has(t3) || r4.delete(t3), s5.push(t3)));
        }
        for (const t3 of s5) o4.delete(t3);
        for (const t3 of n3) {
          const e4 = o4.get(t3);
          void 0 === e4 || e4.isAttached() || (i5.has(t3) || n3.delete(t3), o4.delete(t3));
        }
      })(c3, a3, e2._dirtyLeaves, e2._dirtyElements));
      i4 !== e2._compositionKey && (a3._flushSync = true);
      const o3 = a3._selection;
      if (br(o3)) {
        const e3 = a3._nodeMap, n3 = o3.anchor.key, r4 = o3.focus.key;
        void 0 !== e3.get(n3) && void 0 !== e3.get(r4) || t(19);
      } else Er(o3) && 0 === o3._nodes.size && (a3._selection = null);
    } catch (t2) {
      return t2 instanceof Error && e2._onError(t2), e2._pendingEditorState = c3, e2._dirtyType = 2, e2._cloneNotNeeded.clear(), e2._dirtyLeaves = /* @__PURE__ */ new Set(), e2._dirtyElements.clear(), void vi(e2);
    } finally {
      ri = f3, oi = d4, ii = h2, e2._updating = g3, li = 0;
    }
    const p3 = 0 !== e2._dirtyType || e2._deferred.length > 0 || (function(t2, e3) {
      const n3 = e3.getEditorState()._selection, r4 = t2._selection;
      if (null !== r4) {
        if (r4.dirty || !r4.is(n3)) return true;
      } else if (null !== n3) return true;
      return false;
    })(a3, e2);
    p3 ? a3._flushSync ? (a3._flushSync = false, vi(e2)) : u3 && lo(() => {
      vi(e2);
    }) : (a3._flushSync = false, u3 && (i3.clear(), e2._deferred = [], e2._pendingEditorState = null));
  }
  function bi(t2, e2, n2) {
    ii === t2 && void 0 === n2 ? e2() : Ni(t2, e2, n2);
  }
  var wi = class _wi {
    element;
    before;
    after;
    constructor(t2, e2, n2) {
      this.element = t2, this.before = e2 || null, this.after = n2 || null;
    }
    withBefore(t2) {
      return new _wi(this.element, t2, this.after);
    }
    withAfter(t2) {
      return new _wi(this.element, this.before, t2);
    }
    withElement(t2) {
      return this.element === t2 ? this : new _wi(t2, this.before, this.after);
    }
    insertChild(e2) {
      const n2 = this.before || this.getManagedLineBreak();
      return null !== n2 && n2.parentElement !== this.element && t(222), this.element.insertBefore(e2, n2), this;
    }
    removeChild(e2) {
      return e2.parentElement !== this.element && t(223), this.element.removeChild(e2), this;
    }
    replaceChild(e2, n2) {
      return n2.parentElement !== this.element && t(224), this.element.replaceChild(e2, n2), this;
    }
    getFirstChild() {
      const t2 = this.after ? this.after.nextSibling : this.element.firstChild;
      return t2 === this.before || t2 === this.getManagedLineBreak() ? null : t2;
    }
    getManagedLineBreak() {
      return this.element.__lexicalLineBreak || null;
    }
    setManagedLineBreak(t2) {
      if (null === t2) this.removeManagedLineBreak();
      else {
        const e2 = "decorator" === t2 && (d || c || l);
        this.insertManagedLineBreak(e2);
      }
    }
    removeManagedLineBreak() {
      const t2 = this.getManagedLineBreak();
      if (t2) {
        const e2 = this.element, n2 = "IMG" === t2.nodeName ? t2.nextSibling : null;
        n2 && e2.removeChild(n2), e2.removeChild(t2), e2.__lexicalLineBreak = void 0;
      }
    }
    insertManagedLineBreak(t2) {
      const e2 = this.getManagedLineBreak();
      if (e2) {
        if (t2 === ("IMG" === e2.nodeName)) return;
        this.removeManagedLineBreak();
      }
      const n2 = this.element, r3 = this.before, i3 = document.createElement("br");
      if (n2.insertBefore(i3, r3), t2) {
        const t3 = document.createElement("img");
        t3.setAttribute("data-lexical-linebreak", "true"), t3.style.cssText = "display: inline !important; border: 0px !important; margin: 0px !important;", t3.alt = "", n2.insertBefore(t3, i3), n2.__lexicalLineBreak = t3;
      } else n2.__lexicalLineBreak = i3;
    }
    getFirstChildOffset() {
      let t2 = 0;
      for (let e2 = this.after; null !== e2; e2 = e2.previousSibling) t2++;
      return t2;
    }
    resolveChildIndex(t2, e2, n2, r3) {
      if (n2 === this.element) {
        const e3 = this.getFirstChildOffset();
        return [t2, Math.min(e3 + t2.getChildrenSize(), Math.max(e3, r3))];
      }
      const i3 = Ei(e2, n2);
      i3.push(r3);
      const o2 = Ei(e2, this.element);
      let s4 = t2.getIndexWithinParent();
      for (let t3 = 0; t3 < o2.length; t3++) {
        const e3 = i3[t3], n3 = o2[t3];
        if (void 0 === e3 || e3 < n3) break;
        if (e3 > n3) {
          s4 += 1;
          break;
        }
      }
      return [t2.getParentOrThrow(), s4];
    }
  };
  function Ei(e2, n2) {
    const r3 = [];
    let i3 = n2;
    for (; i3 !== e2 && null !== i3; i3 = i3.parentNode) {
      let t2 = 0;
      for (let e3 = i3.previousSibling; null !== e3; e3 = e3.previousSibling) t2++;
      r3.push(t2);
    }
    return i3 !== e2 && t(225), r3.reverse();
  }
  var Oi = class extends Rn {
    __first;
    __last;
    __size;
    __format;
    __style;
    __indent;
    __dir;
    __textFormat;
    __textStyle;
    constructor(t2) {
      super(t2), this.__first = null, this.__last = null, this.__size = 0, this.__format = 0, this.__style = "", this.__indent = 0, this.__dir = null, this.__textFormat = 0, this.__textStyle = "";
    }
    afterCloneFrom(t2) {
      super.afterCloneFrom(t2), this.__key === t2.__key && (this.__first = t2.__first, this.__last = t2.__last, this.__size = t2.__size), this.__indent = t2.__indent, this.__format = t2.__format, this.__style = t2.__style, this.__dir = t2.__dir, this.__textFormat = t2.__textFormat, this.__textStyle = t2.__textStyle;
    }
    getFormat() {
      return this.getLatest().__format;
    }
    getFormatType() {
      const t2 = this.getFormat();
      return J[t2] || "";
    }
    getStyle() {
      return this.getLatest().__style;
    }
    getIndent() {
      return this.getLatest().__indent;
    }
    getChildren() {
      const t2 = [];
      let e2 = this.getFirstChild();
      for (; null !== e2; ) t2.push(e2), e2 = e2.getNextSibling();
      return t2;
    }
    getChildrenKeys() {
      const t2 = [];
      let e2 = this.getFirstChild();
      for (; null !== e2; ) t2.push(e2.__key), e2 = e2.getNextSibling();
      return t2;
    }
    getChildrenSize() {
      return this.getLatest().__size;
    }
    isEmpty() {
      return 0 === this.getChildrenSize();
    }
    isDirty() {
      const t2 = hi()._dirtyElements;
      return null !== t2 && t2.has(this.__key);
    }
    isLastChild() {
      const t2 = this.getLatest(), e2 = this.getParentOrThrow().getLastChild();
      return null !== e2 && e2.is(t2);
    }
    getAllTextNodes() {
      const t2 = [];
      let e2 = this.getFirstChild();
      for (; null !== e2; ) {
        if (pr(e2) && t2.push(e2), Mi(e2)) {
          const n2 = e2.getAllTextNodes();
          t2.push(...n2);
        }
        e2 = e2.getNextSibling();
      }
      return t2;
    }
    getFirstDescendant() {
      let t2 = this.getFirstChild();
      for (; Mi(t2); ) {
        const e2 = t2.getFirstChild();
        if (null === e2) break;
        t2 = e2;
      }
      return t2;
    }
    getLastDescendant() {
      let t2 = this.getLastChild();
      for (; Mi(t2); ) {
        const e2 = t2.getLastChild();
        if (null === e2) break;
        t2 = e2;
      }
      return t2;
    }
    getDescendantByIndex(t2) {
      const e2 = this.getChildren(), n2 = e2.length;
      if (t2 >= n2) {
        const t3 = e2[n2 - 1];
        return Mi(t3) && t3.getLastDescendant() || t3 || null;
      }
      const r3 = e2[t2];
      return Mi(r3) && r3.getFirstDescendant() || r3 || null;
    }
    getFirstChild() {
      const t2 = this.getLatest().__first;
      return null === t2 ? null : Eo(t2);
    }
    getFirstChildOrThrow() {
      const e2 = this.getFirstChild();
      return null === e2 && t(45, this.__key), e2;
    }
    getLastChild() {
      const t2 = this.getLatest().__last;
      return null === t2 ? null : Eo(t2);
    }
    getLastChildOrThrow() {
      const e2 = this.getLastChild();
      return null === e2 && t(96, this.__key), e2;
    }
    getChildAtIndex(t2) {
      const e2 = this.getChildrenSize();
      let n2, r3;
      if (t2 < e2 / 2) {
        for (n2 = this.getFirstChild(), r3 = 0; null !== n2 && r3 <= t2; ) {
          if (r3 === t2) return n2;
          n2 = n2.getNextSibling(), r3++;
        }
        return null;
      }
      for (n2 = this.getLastChild(), r3 = e2 - 1; null !== n2 && r3 >= t2; ) {
        if (r3 === t2) return n2;
        n2 = n2.getPreviousSibling(), r3--;
      }
      return null;
    }
    getTextContent() {
      let t2 = "";
      const e2 = this.getChildren(), n2 = e2.length;
      for (let r3 = 0; r3 < n2; r3++) {
        const i3 = e2[r3];
        t2 += i3.getTextContent(), Mi(i3) && r3 !== n2 - 1 && !i3.isInline() && (t2 += D);
      }
      return t2;
    }
    getTextContentSize() {
      let t2 = 0;
      const e2 = this.getChildren(), n2 = e2.length;
      for (let r3 = 0; r3 < n2; r3++) {
        const i3 = e2[r3];
        t2 += i3.getTextContentSize(), Mi(i3) && r3 !== n2 - 1 && !i3.isInline() && (t2 += 2);
      }
      return t2;
    }
    getDirection() {
      return this.getLatest().__dir;
    }
    getTextFormat() {
      return this.getLatest().__textFormat;
    }
    hasFormat(t2) {
      if ("" !== t2) {
        const e2 = W[t2];
        return 0 !== (this.getFormat() & e2);
      }
      return false;
    }
    hasTextFormat(t2) {
      const e2 = R[t2];
      return 0 !== (this.getTextFormat() & e2);
    }
    getFormatFlags(t2, e2) {
      return So(this.getLatest().__textFormat, t2, e2);
    }
    getTextStyle() {
      return this.getLatest().__textStyle;
    }
    select(t2, e2) {
      ui();
      const n2 = $r();
      let r3 = t2, i3 = e2;
      const o2 = this.getChildrenSize();
      if (!this.canBeEmpty()) {
        if (0 === t2 && 0 === e2) {
          const t3 = this.getFirstChild();
          if (pr(t3) || Mi(t3)) return t3.select(0, 0);
        } else if (!(void 0 !== t2 && t2 !== o2 || void 0 !== e2 && e2 !== o2)) {
          const t3 = this.getLastChild();
          if (pr(t3) || Mi(t3)) return t3.select();
        }
      }
      void 0 === r3 && (r3 = o2), void 0 === i3 && (i3 = o2);
      const s4 = this.__key;
      return br(n2) ? (n2.anchor.set(s4, r3, "element"), n2.focus.set(s4, i3, "element"), n2.dirty = true, n2) : Rr(s4, r3, s4, i3, "element", "element");
    }
    selectStart() {
      const t2 = this.getFirstDescendant();
      return t2 ? t2.selectStart() : this.select();
    }
    selectEnd() {
      const t2 = this.getLastDescendant();
      return t2 ? t2.selectEnd() : this.select();
    }
    clear() {
      const t2 = this.getWritable();
      return this.getChildren().forEach((t3) => t3.remove()), t2;
    }
    append(...t2) {
      return this.splice(this.getChildrenSize(), 0, t2);
    }
    setDirection(t2) {
      const e2 = this.getWritable();
      return e2.__dir = t2, e2;
    }
    setFormat(t2) {
      return this.getWritable().__format = "" !== t2 ? W[t2] : 0, this;
    }
    setStyle(t2) {
      return this.getWritable().__style = t2 || "", this;
    }
    setTextFormat(t2) {
      const e2 = this.getWritable();
      return e2.__textFormat = t2, e2;
    }
    setTextStyle(t2) {
      const e2 = this.getWritable();
      return e2.__textStyle = t2, e2;
    }
    setIndent(t2) {
      return this.getWritable().__indent = t2, this;
    }
    splice(e2, n2, r3) {
      zn(this) && t(324, this.__key, this.__type);
      const i3 = this.getChildrenSize(), o2 = this.getWritable();
      e2 + n2 <= i3 || t(226, String(e2), String(n2), String(i3));
      const s4 = o2.__key, l3 = [], c3 = [], a3 = this.getChildAtIndex(e2 + n2);
      let u3 = null, f3 = i3 - n2 + r3.length;
      if (0 !== e2) if (e2 === i3) u3 = this.getLastChild();
      else {
        const t2 = this.getChildAtIndex(e2);
        null !== t2 && (u3 = t2.getPreviousSibling());
      }
      if (n2 > 0) {
        let e3 = null === u3 ? this.getFirstChild() : u3.getNextSibling();
        for (let r4 = 0; r4 < n2; r4++) {
          null === e3 && t(100);
          const n3 = e3.getNextSibling(), r5 = e3.__key;
          To(e3.getWritable()), c3.push(r5), e3 = n3;
        }
      }
      let d4 = u3;
      for (const e3 of r3) {
        null !== d4 && e3.is(d4) && (u3 = d4 = d4.getPreviousSibling());
        const n3 = e3.getWritable();
        n3.__parent === s4 && f3--, To(n3);
        const r4 = e3.__key;
        if (null === d4) o2.__first = r4, n3.__prev = null;
        else {
          const t2 = d4.getWritable();
          t2.__next = r4, n3.__prev = t2.__key;
        }
        e3.__key === s4 && t(76), n3.__parent = s4, l3.push(r4), d4 = e3;
      }
      if (e2 + n2 === i3) {
        if (null !== d4) {
          d4.getWritable().__next = null, o2.__last = d4.__key;
        }
      } else if (null !== a3) {
        const t2 = a3.getWritable();
        if (null !== d4) {
          const e3 = d4.getWritable();
          t2.__prev = d4.__key, e3.__next = a3.__key;
        } else t2.__prev = null;
      }
      if (o2.__size = f3, c3.length) {
        const t2 = $r();
        if (br(t2)) {
          const e3 = new Set(c3), n3 = new Set(l3), { anchor: r4, focus: i4 } = t2;
          Ai(r4, e3, n3) && qr(r4, r4.getNode(), this, u3, a3), Ai(i4, e3, n3) && qr(i4, i4.getNode(), this, u3, a3), 0 !== f3 || this.canBeEmpty() || ms(this) || this.remove();
        }
      }
      return o2;
    }
    getDOMSlot(t2) {
      return new wi(t2);
    }
    exportDOM(t2) {
      const { element: e2 } = super.exportDOM(t2);
      if (Os(e2)) {
        const t3 = this.getIndent();
        t3 > 0 && (e2.style.paddingInlineStart = 40 * t3 + "px");
        const n2 = this.getDirection();
        n2 && (e2.dir = n2);
      }
      return { element: e2 };
    }
    exportJSON() {
      const t2 = { children: [], direction: this.getDirection(), format: this.getFormatType(), indent: this.getIndent(), ...super.exportJSON() }, e2 = this.getTextFormat(), n2 = this.getTextStyle();
      return 0 === e2 && "" === n2 || ms(this) || this.getChildren().some(pr) || (0 !== e2 && (t2.textFormat = e2), "" !== n2 && (t2.textStyle = n2)), t2;
    }
    updateFromJSON(t2) {
      return super.updateFromJSON(t2).setFormat(t2.format).setIndent(t2.indent).setDirection(t2.direction).setTextFormat(t2.textFormat || 0).setTextStyle(t2.textStyle || "");
    }
    insertNewAfter(t2, e2) {
      return null;
    }
    canIndent() {
      return true;
    }
    collapseAtStart(t2) {
      return false;
    }
    excludeFromCopy(t2) {
      return false;
    }
    canReplaceWith(t2) {
      return true;
    }
    canInsertAfter(t2) {
      return true;
    }
    canBeEmpty() {
      return true;
    }
    canInsertTextBefore() {
      return true;
    }
    canInsertTextAfter() {
      return true;
    }
    isInline() {
      return false;
    }
    isShadowRoot() {
      return false;
    }
    canMergeWith(t2) {
      return false;
    }
    extractWithChild(t2, e2, n2) {
      return false;
    }
    canMergeWhenEmpty() {
      return false;
    }
    reconcileObservedMutation(t2, e2) {
      const n2 = this.getDOMSlot(t2);
      let r3 = n2.getFirstChild();
      for (let t3 = this.getFirstChild(); t3; t3 = t3.getNextSibling()) {
        const i3 = e2.getElementByKey(t3.getKey());
        null !== i3 && (null == r3 ? (n2.insertChild(i3), r3 = i3) : r3 !== i3 && n2.replaceChild(i3, r3), r3 = r3.nextSibling);
      }
    }
  };
  function Mi(t2) {
    return t2 instanceof Oi;
  }
  function Ai(t2, e2, n2) {
    let r3 = t2.getNode();
    for (; r3; ) {
      const t3 = r3.__key;
      if (e2.has(t3) && !n2.has(t3)) return true;
      r3 = r3.getParent();
    }
    return false;
  }
  var Pi = class extends Rn {
    decorate(t2, e2) {
      return null;
    }
    isIsolated() {
      return false;
    }
    isInline() {
      return true;
    }
    isKeyboardSelectable() {
      return true;
    }
  };
  function Di(t2) {
    return t2 instanceof Pi;
  }
  var Fi = class _Fi extends Oi {
    __cachedText;
    static getType() {
      return "root";
    }
    static clone() {
      return new _Fi();
    }
    constructor() {
      super("root"), this.__cachedText = null;
    }
    getTopLevelElementOrThrow() {
      t(51);
    }
    getTextContent() {
      const t2 = this.__cachedText;
      return !ai() && 0 !== hi()._dirtyType || null === t2 ? super.getTextContent() : t2;
    }
    remove() {
      t(52);
    }
    replace(e2) {
      t(53);
    }
    insertBefore(e2) {
      t(54);
    }
    insertAfter(e2) {
      t(55);
    }
    updateDOM(t2, e2) {
      return false;
    }
    splice(e2, n2, r3) {
      for (const e3 of r3) Mi(e3) || Di(e3) || t(282);
      return super.splice(e2, n2, r3);
    }
    static importJSON(t2) {
      return Fo().updateFromJSON(t2);
    }
    collapseAtStart() {
      return true;
    }
  };
  function Li(t2) {
    return t2 instanceof Fi;
  }
  function Ii(t2) {
    return new Bi(new Map(t2._nodeMap));
  }
  function Ki() {
    return new Bi(/* @__PURE__ */ new Map([["root", new Fi()]]));
  }
  function zi(e2) {
    const n2 = e2.exportJSON(), r3 = e2.constructor;
    if (n2.type !== r3.getType() && t(130, r3.name), Mi(e2)) {
      const i3 = n2.children;
      Array.isArray(i3) || t(59, r3.name);
      const o2 = e2.getChildren();
      for (let t2 = 0; t2 < o2.length; t2++) {
        const e3 = zi(o2[t2]);
        i3.push(e3);
      }
    }
    return n2;
  }
  function Ri(t2) {
    return t2 instanceof Bi;
  }
  var Bi = class _Bi {
    _nodeMap;
    _selection;
    _flushSync;
    _readOnly;
    constructor(t2, e2) {
      this._nodeMap = t2, this._selection = e2 || null, this._flushSync = false, this._readOnly = false;
    }
    isEmpty() {
      return 1 === this._nodeMap.size && null === this._selection;
    }
    read(t2, e2) {
      return Si(e2 && e2.editor || null, this, t2);
    }
    clone(t2) {
      const e2 = new _Bi(this._nodeMap, void 0 === t2 ? this._selection : t2);
      return e2._readOnly = true, e2;
    }
    toJSON() {
      return Si(null, this, () => ({ root: zi(Fo()) }));
    }
  };
  var Wi = class extends Oi {
    static getType() {
      return "artificial";
    }
    createDOM(t2) {
      return document.createElement("div");
    }
  };
  var Ji = class _Ji extends Oi {
    static getType() {
      return "paragraph";
    }
    static clone(t2) {
      return new _Ji(t2.__key);
    }
    createDOM(t2) {
      const e2 = document.createElement("p"), n2 = Zo(t2.theme, "paragraph");
      if (void 0 !== n2) {
        e2.classList.add(...n2);
      }
      return e2;
    }
    updateDOM(t2, e2, n2) {
      return false;
    }
    static importDOM() {
      return { p: (t2) => ({ conversion: ji, priority: 0 }) };
    }
    exportDOM(t2) {
      const { element: e2 } = super.exportDOM(t2);
      if (Os(e2)) {
        this.isEmpty() && e2.append(document.createElement("br"));
        const t3 = this.getFormatType();
        t3 && (e2.style.textAlign = t3);
      }
      return { element: e2 };
    }
    static importJSON(t2) {
      return $i().updateFromJSON(t2);
    }
    exportJSON() {
      const t2 = super.exportJSON();
      if (void 0 === t2.textFormat || void 0 === t2.textStyle) {
        const e2 = this.getChildren().find(pr);
        e2 ? (t2.textFormat = e2.getFormat(), t2.textStyle = e2.getStyle()) : (t2.textFormat = this.getTextFormat(), t2.textStyle = this.getTextStyle());
      }
      return t2;
    }
    insertNewAfter(t2, e2) {
      const n2 = $i();
      n2.setTextFormat(t2.format), n2.setTextStyle(t2.style);
      const r3 = this.getDirection();
      return n2.setDirection(r3), n2.setFormat(this.getFormatType()), n2.setStyle(this.getStyle()), this.insertAfter(n2, e2), n2;
    }
    collapseAtStart() {
      const t2 = this.getChildren();
      if (0 === t2.length || pr(t2[0]) && "" === t2[0].getTextContent().trim()) {
        if (null !== this.getNextSibling()) return this.selectNext(), this.remove(), true;
        if (null !== this.getPreviousSibling()) return this.selectPrevious(), this.remove(), true;
      }
      return false;
    }
  };
  function ji(t2) {
    const e2 = $i();
    return t2.style && (e2.setFormat(t2.style.textAlign), Ws(t2, e2)), { node: e2 };
  }
  function $i() {
    return Cs(new Ji());
  }
  function Ui(t2) {
    return t2 instanceof Ji;
  }
  var Vi = 0;
  var Yi = 1;
  var qi = 2;
  var Hi = 3;
  var Gi = 4;
  function Xi(t2, e2, n2, r3) {
    const i3 = t2._keyToDOMMap;
    i3.clear(), t2._editorState = Ki(), t2._pendingEditorState = r3, t2._compositionKey = null, t2._dirtyType = 0, t2._cloneNotNeeded.clear(), t2._dirtyLeaves = /* @__PURE__ */ new Set(), t2._dirtyElements.clear(), t2._normalizedNodes = /* @__PURE__ */ new Set(), t2._updateTags = /* @__PURE__ */ new Set(), t2._updates = [], t2._blockCursorElement = null;
    const o2 = t2._observer;
    null !== o2 && (o2.disconnect(), t2._observer = null), null !== e2 && (e2.textContent = ""), null !== n2 && (n2.textContent = "", i3.set("root", n2));
  }
  function Qi(t2) {
    const e2 = /* @__PURE__ */ new Set(), n2 = /* @__PURE__ */ new Set();
    let r3 = t2;
    for (; r3; ) {
      const { ownNodeConfig: t3 } = Us(r3), i3 = r3.transform;
      if (!n2.has(i3)) {
        n2.add(i3);
        const t4 = r3.transform();
        t4 && e2.add(t4);
      }
      if (t3) {
        const n3 = t3.$transform;
        n3 && e2.add(n3), r3 = t3.extends;
      } else {
        const t4 = Object.getPrototypeOf(r3);
        r3 = t4.prototype instanceof Rn && t4 !== Rn ? t4 : void 0;
      }
    }
    return e2;
  }
  function Zi(t2) {
    const e2 = t2 || {}, n2 = _i(), r3 = e2.theme || {}, i3 = void 0 === t2 ? n2 : e2.parentEditor || null, o2 = e2.disableEvents || false, s4 = Ki(), l3 = e2.namespace || (null !== i3 ? i3._config.namespace : Bo()), c3 = e2.editorState, a3 = [Fi, sr, Hn, mr, Ji, Wi, ...e2.nodes || []], { onError: u3, html: f3 } = e2, d4 = void 0 === e2.editable || e2.editable;
    let h2;
    if (void 0 === t2 && null !== n2) h2 = n2._nodes;
    else {
      h2 = /* @__PURE__ */ new Map();
      for (let t3 = 0; t3 < a3.length; t3++) {
        let e3 = a3[t3], n3 = null, r4 = null;
        if ("function" != typeof e3) {
          const t4 = e3;
          e3 = t4.replace, n3 = t4.with, r4 = t4.withKlass || null;
        }
        Us(e3);
        const i4 = e3.getType(), o3 = Qi(e3);
        h2.set(i4, { exportDOM: f3 && f3.export ? f3.export.get(e3) : void 0, klass: e3, replace: n3, replaceWithKlass: r4, sharedNodeState: at(a3[t3]), transforms: o3 });
      }
    }
    const g3 = new to(s4, i3, h2, { disableEvents: o2, namespace: l3, theme: r3 }, u3 || console.error, (function(t3, e3) {
      const n3 = /* @__PURE__ */ new Map(), r4 = /* @__PURE__ */ new Set(), i4 = (t4) => {
        Object.keys(t4).forEach((e4) => {
          let r5 = n3.get(e4);
          void 0 === r5 && (r5 = [], n3.set(e4, r5)), r5.push(t4[e4]);
        });
      };
      return t3.forEach((t4) => {
        const e4 = t4.klass.importDOM;
        if (null == e4 || r4.has(e4)) return;
        r4.add(e4);
        const n4 = e4.call(t4.klass);
        null !== n4 && i4(n4);
      }), e3 && i4(e3), n3;
    })(h2, f3 ? f3.import : void 0), d4, t2);
    return void 0 !== c3 && (g3._pendingEditorState = c3, g3._dirtyType = 2), (function(t3) {
      t3.registerCommand(le, vn, Vi), t3.registerCommand(ce, kn, Vi), t3.registerCommand(ae, Tn, Vi), t3.registerCommand(ue, Nn, Vi), t3.registerCommand(ve, wn, Vi);
    })(g3), g3;
  }
  var to = class {
    static version;
    _headless;
    _parentEditor;
    _rootElement;
    _editorState;
    _pendingEditorState;
    _compositionKey;
    _deferred;
    _keyToDOMMap;
    _updates;
    _updating;
    _listeners;
    _commands;
    _nodes;
    _decorators;
    _pendingDecorators;
    _config;
    _dirtyType;
    _cloneNotNeeded;
    _dirtyLeaves;
    _dirtyElements;
    _normalizedNodes;
    _updateTags;
    _observer;
    _key;
    _onError;
    _htmlConversions;
    _window;
    _editable;
    _blockCursorElement;
    _createEditorArgs;
    constructor(t2, e2, n2, r3, i3, o2, s4, l3) {
      this._createEditorArgs = l3, this._parentEditor = e2, this._rootElement = null, this._editorState = t2, this._pendingEditorState = null, this._compositionKey = null, this._deferred = [], this._keyToDOMMap = /* @__PURE__ */ new Map(), this._updates = [], this._updating = false, this._listeners = { decorator: /* @__PURE__ */ new Set(), editable: /* @__PURE__ */ new Set(), mutation: /* @__PURE__ */ new Map(), root: /* @__PURE__ */ new Set(), textcontent: /* @__PURE__ */ new Set(), update: /* @__PURE__ */ new Set() }, this._commands = /* @__PURE__ */ new Map(), this._config = r3, this._nodes = n2, this._decorators = {}, this._pendingDecorators = null, this._dirtyType = 0, this._cloneNotNeeded = /* @__PURE__ */ new Set(), this._dirtyLeaves = /* @__PURE__ */ new Set(), this._dirtyElements = /* @__PURE__ */ new Map(), this._normalizedNodes = /* @__PURE__ */ new Set(), this._updateTags = /* @__PURE__ */ new Set(), this._observer = null, this._key = Bo(), this._onError = i3, this._htmlConversions = o2, this._editable = s4, this._headless = null !== e2 && e2._headless, this._window = null, this._blockCursorElement = null;
    }
    isComposing() {
      return null != this._compositionKey;
    }
    registerUpdateListener(t2) {
      const e2 = this._listeners.update;
      return e2.add(t2), () => {
        e2.delete(t2);
      };
    }
    registerEditableListener(t2) {
      const e2 = this._listeners.editable;
      return e2.add(t2), () => {
        e2.delete(t2);
      };
    }
    registerDecoratorListener(t2) {
      const e2 = this._listeners.decorator;
      return e2.add(t2), () => {
        e2.delete(t2);
      };
    }
    registerTextContentListener(t2) {
      const e2 = this._listeners.textcontent;
      return e2.add(t2), () => {
        e2.delete(t2);
      };
    }
    registerRootListener(t2) {
      const e2 = this._listeners.root;
      return t2(this._rootElement, null), e2.add(t2), () => {
        t2(null, this._rootElement), e2.delete(t2);
      };
    }
    registerCommand(e2, n2, r3) {
      void 0 === r3 && t(35);
      const i3 = this._commands;
      i3.has(e2) || i3.set(e2, [/* @__PURE__ */ new Set(), /* @__PURE__ */ new Set(), /* @__PURE__ */ new Set(), /* @__PURE__ */ new Set(), /* @__PURE__ */ new Set()]);
      const o2 = i3.get(e2);
      void 0 === o2 && t(36, String(e2));
      const s4 = o2[r3];
      return s4.add(n2), () => {
        s4.delete(n2), o2.every((t2) => 0 === t2.size) && i3.delete(e2);
      };
    }
    registerMutationListener(t2, e2, n2) {
      const r3 = this.resolveRegisteredNodeAfterReplacements(this.getRegisteredNode(t2)).klass, i3 = this._listeners.mutation;
      let o2 = i3.get(e2);
      void 0 === o2 && (o2 = /* @__PURE__ */ new Set(), i3.set(e2, o2)), o2.add(r3);
      const s4 = n2 && n2.skipInitialization;
      return void 0 !== s4 && s4 || this.initializeMutationListener(e2, r3), () => {
        o2.delete(r3), 0 === o2.size && i3.delete(e2);
      };
    }
    getRegisteredNode(e2) {
      const n2 = this._nodes.get(e2.getType());
      return void 0 === n2 && t(37, e2.name), n2;
    }
    resolveRegisteredNodeAfterReplacements(t2) {
      for (; t2.replaceWithKlass; ) t2 = this.getRegisteredNode(t2.replaceWithKlass);
      return t2;
    }
    initializeMutationListener(t2, e2) {
      const n2 = this._editorState, r3 = zs(n2).get(e2.getType());
      if (!r3) return;
      const i3 = /* @__PURE__ */ new Map();
      for (const t3 of r3.keys()) i3.set(t3, "created");
      i3.size > 0 && t2(i3, { dirtyLeaves: /* @__PURE__ */ new Set(), prevEditorState: n2, updateTags: /* @__PURE__ */ new Set(["registerMutationListener"]) });
    }
    registerNodeTransformToKlass(t2, e2) {
      const n2 = this.getRegisteredNode(t2);
      return n2.transforms.add(e2), n2;
    }
    registerNodeTransform(t2, e2) {
      const n2 = this.registerNodeTransformToKlass(t2, e2), r3 = [n2], i3 = n2.replaceWithKlass;
      if (null != i3) {
        const t3 = this.registerNodeTransformToKlass(i3, e2);
        r3.push(t3);
      }
      return (function(t3, e3) {
        const n3 = zs(t3.getEditorState()), r4 = [];
        for (const t4 of e3) {
          const e4 = n3.get(t4);
          e4 && r4.push(e4);
        }
        if (0 === r4.length) return;
        t3.update(() => {
          for (const t4 of r4) for (const e4 of t4.keys()) {
            const t5 = Eo(e4);
            t5 && t5.markDirty();
          }
        }, null === t3._pendingEditorState ? { tag: Jn } : void 0);
      })(this, r3.map((t3) => t3.klass.getType())), () => {
        r3.forEach((t3) => t3.transforms.delete(e2));
      };
    }
    hasNode(t2) {
      return this._nodes.has(t2.getType());
    }
    hasNodes(t2) {
      return t2.every(this.hasNode.bind(this));
    }
    dispatchCommand(t2, e2) {
      return os(this, t2, e2);
    }
    getDecorators() {
      return this._decorators;
    }
    getRootElement() {
      return this._rootElement;
    }
    getKey() {
      return this._key;
    }
    setRootElement(t2) {
      const e2 = this._rootElement;
      if (t2 !== e2) {
        const n2 = Zo(this._config.theme, "root"), r3 = this._pendingEditorState || this._editorState;
        if (this._rootElement = t2, Xi(this, e2, t2, r3), null !== e2 && (this._config.disableEvents || Fn(e2), null != n2 && e2.classList.remove(...n2)), null !== t2) {
          const e3 = gs(t2), r4 = t2.style;
          r4.userSelect = "text", r4.whiteSpace = "pre-wrap", r4.wordBreak = "break-word", t2.setAttribute("data-lexical-editor", "true"), this._window = e3, this._dirtyType = 2, rt(this), this._updateTags.add(Jn), vi(this), this._config.disableEvents || (function(t3, e4) {
            const n3 = t3.ownerDocument;
            sn.set(t3, n3);
            const r5 = ln.get(n3) ?? 0;
            r5 < 1 && n3.addEventListener("selectionchange", Mn), ln.set(n3, r5 + 1), t3.__lexicalEditor = e4;
            const i3 = En(t3);
            for (let n4 = 0; n4 < tn.length; n4++) {
              const [r6, o2] = tn[n4], s4 = "function" == typeof o2 ? (t4) => {
                Pn(t4) || (An(t4), (e4.isEditable() || "click" === r6) && o2(t4, e4));
              } : (t4) => {
                if (Pn(t4)) return;
                An(t4);
                const n5 = e4.isEditable();
                switch (r6) {
                  case "cut":
                    return n5 && os(e4, $e, t4);
                  case "copy":
                    return os(e4, je, t4);
                  case "paste":
                    return n5 && os(e4, _e, t4);
                  case "dragstart":
                    return n5 && os(e4, Be, t4);
                  case "dragover":
                    return n5 && os(e4, We, t4);
                  case "dragend":
                    return n5 && os(e4, Je, t4);
                  case "focus":
                    return n5 && os(e4, Ge, t4);
                  case "blur":
                    return n5 && os(e4, Xe, t4);
                  case "drop":
                    return n5 && os(e4, ze, t4);
                }
              };
              t3.addEventListener(r6, s4), i3.push(() => {
                t3.removeEventListener(r6, s4);
              });
            }
          })(t2, this), null != n2 && t2.classList.add(...n2);
        } else this._window = null, this._updateTags.add(Jn), vi(this);
        ki("root", this, false, t2, e2);
      }
    }
    getElementByKey(t2) {
      return this._keyToDOMMap.get(t2) || null;
    }
    getEditorState() {
      return this._editorState;
    }
    setEditorState(e2, n2) {
      e2.isEmpty() && t(38);
      let r3 = e2;
      r3._readOnly && (r3 = Ii(e2), r3._selection = e2._selection ? e2._selection.clone() : null), nt(this);
      const i3 = this._pendingEditorState, o2 = this._updateTags, s4 = void 0 !== n2 ? n2.tag : null;
      null === i3 || i3.isEmpty() || (null != s4 && o2.add(s4), vi(this)), this._pendingEditorState = r3, this._dirtyType = 2, this._dirtyElements.set("root", false), this._compositionKey = null, null != s4 && o2.add(s4), this._updating || vi(this);
    }
    parseEditorState(t2, e2) {
      return (function(t3, e3, n2) {
        const r3 = Ki(), i3 = ri, o2 = oi, s4 = ii, l3 = e3._dirtyElements, c3 = e3._dirtyLeaves, a3 = e3._cloneNotNeeded, u3 = e3._dirtyType;
        e3._dirtyElements = /* @__PURE__ */ new Map(), e3._dirtyLeaves = /* @__PURE__ */ new Set(), e3._cloneNotNeeded = /* @__PURE__ */ new Set(), e3._dirtyType = 0, ri = r3, oi = false, ii = e3, no(null);
        try {
          const i4 = e3._nodes;
          Ci(t3.root, i4), n2 && n2(), r3._readOnly = true;
        } catch (t4) {
          t4 instanceof Error && e3._onError(t4);
        } finally {
          e3._dirtyElements = l3, e3._dirtyLeaves = c3, e3._cloneNotNeeded = a3, e3._dirtyType = u3, ri = i3, oi = o2, ii = s4;
        }
        return r3;
      })("string" == typeof t2 ? JSON.parse(t2) : t2, this, e2);
    }
    read(t2) {
      return vi(this), this.getEditorState().read(t2, { editor: this });
    }
    update(t2, e2) {
      !(function(t3, e3, n2) {
        t3._updating ? t3._updates.push([e3, n2]) : Ni(t3, e3, n2);
      })(this, t2, e2);
    }
    focus(t2, e2 = {}) {
      const n2 = this._rootElement;
      null !== n2 && (n2.setAttribute("autocapitalize", "off"), bi(this, () => {
        const r3 = $r(), i3 = Fo();
        null !== r3 ? r3.dirty || Io(r3.clone()) : 0 !== i3.getChildrenSize() && ("rootStart" === e2.defaultSelection ? i3.selectStart() : i3.selectEnd()), fs("focus"), ds(() => {
          n2.removeAttribute("autocapitalize"), t2 && t2();
        });
      }), null === this._pendingEditorState && n2.removeAttribute("autocapitalize"));
    }
    blur() {
      const t2 = this._rootElement;
      null !== t2 && t2.blur();
      const e2 = Ns(this._window);
      null !== e2 && e2.removeAllRanges();
    }
    isEditable() {
      return this._editable;
    }
    setEditable(t2) {
      this._editable !== t2 && (this._editable = t2, ki("editable", this, true, t2));
    }
    toJSON() {
      return { editorState: this._editorState.toJSON() };
    }
  };
  to.version = "0.39.0+prod.esm";
  var eo = null;
  function no(t2) {
    eo = t2;
  }
  var ro = 1;
  function io() {
    ro = 1;
  }
  function oo(e2, n2) {
    const r3 = so(e2, n2);
    return void 0 === r3 && t(30, n2), r3;
  }
  function so(t2, e2) {
    return t2._nodes.get(e2);
  }
  var lo = "function" == typeof queueMicrotask ? queueMicrotask : (t2) => {
    Promise.resolve().then(t2);
  };
  function co(t2) {
    return Di(Ao(t2));
  }
  function ao(t2) {
    const e2 = document.activeElement;
    if (!Os(e2)) return false;
    const n2 = e2.nodeName;
    return Di(Ao(t2)) && ("INPUT" === n2 || "TEXTAREA" === n2 || "true" === e2.contentEditable && null == go(e2));
  }
  function uo(t2, e2, n2) {
    const r3 = t2.getRootElement();
    try {
      return null !== r3 && r3.contains(e2) && r3.contains(n2) && null !== e2 && !ao(e2) && ho(e2) === t2;
    } catch (t3) {
      return false;
    }
  }
  function fo(t2) {
    return t2 instanceof to;
  }
  function ho(t2) {
    let e2 = t2;
    for (; null != e2; ) {
      const t3 = go(e2);
      if (fo(t3)) return t3;
      e2 = cs(e2);
    }
    return null;
  }
  function go(t2) {
    return t2 ? t2.__lexicalEditor : null;
  }
  function _o(t2) {
    return K.test(t2) ? "rtl" : z.test(t2) ? "ltr" : null;
  }
  function po(t2) {
    return Cr(t2) || t2.isToken();
  }
  function yo(t2) {
    return po(t2) || t2.isSegmented();
  }
  function mo(t2) {
    return Ms(t2) && 3 === t2.nodeType;
  }
  function xo(t2) {
    return Ms(t2) && 9 === t2.nodeType;
  }
  function Co(t2) {
    let e2 = t2;
    for (; null != e2; ) {
      if (mo(e2)) return e2;
      e2 = e2.firstChild;
    }
    return null;
  }
  function So(t2, e2, n2) {
    const r3 = R[e2];
    if (null !== n2 && (t2 & r3) === (n2 & r3)) return t2;
    let i3 = t2 ^ r3;
    return "subscript" === e2 ? i3 &= ~R.superscript : "superscript" === e2 ? i3 &= ~R.subscript : "lowercase" === e2 ? (i3 &= ~R.uppercase, i3 &= ~R.capitalize) : "uppercase" === e2 ? (i3 &= ~R.lowercase, i3 &= ~R.capitalize) : "capitalize" === e2 && (i3 &= ~R.lowercase, i3 &= ~R.uppercase), i3;
  }
  function vo(t2) {
    return pr(t2) || Qn(t2) || Di(t2);
  }
  function ko(t2, e2) {
    const n2 = (function() {
      const t3 = eo;
      return eo = null, t3;
    })();
    if (null != (e2 = e2 || n2 && n2.__key)) return void (t2.__key = e2);
    ui(), fi();
    const r3 = hi(), i3 = di(), o2 = "" + ro++;
    i3._nodeMap.set(o2, t2), Mi(t2) ? r3._dirtyElements.set(o2, true) : r3._dirtyLeaves.add(o2), r3._cloneNotNeeded.add(o2), r3._dirtyType = 1, t2.__key = o2;
  }
  function To(t2) {
    const e2 = t2.getParent();
    if (null !== e2) {
      const n2 = t2.getWritable(), r3 = e2.getWritable(), i3 = t2.getPreviousSibling(), o2 = t2.getNextSibling(), s4 = null !== o2 ? o2.__key : null, l3 = null !== i3 ? i3.__key : null, c3 = null !== i3 ? i3.getWritable() : null, a3 = null !== o2 ? o2.getWritable() : null;
      null === i3 && (r3.__first = s4), null === o2 && (r3.__last = l3), null !== c3 && (c3.__next = s4), null !== a3 && (a3.__prev = l3), n2.__prev = null, n2.__next = null, n2.__parent = null, r3.__size--;
    }
  }
  function No(e2) {
    fi(), zn(e2) && t(323, e2.__key, e2.__type);
    const n2 = e2.getLatest(), r3 = n2.__parent, i3 = di(), o2 = hi(), s4 = i3._nodeMap, l3 = o2._dirtyElements;
    null !== r3 && (function(t2, e3, n3) {
      let r4 = t2;
      for (; null !== r4; ) {
        if (n3.has(r4)) return;
        const t3 = e3.get(r4);
        if (void 0 === t3) break;
        n3.set(r4, false), r4 = t3.__parent;
      }
    })(r3, s4, l3);
    const c3 = n2.__key;
    o2._dirtyType = 1, Mi(e2) ? l3.set(c3, true) : o2._dirtyLeaves.add(c3);
  }
  function bo(t2) {
    ui();
    const e2 = hi(), n2 = e2._compositionKey;
    if (t2 !== n2) {
      if (e2._compositionKey = t2, null !== n2) {
        const t3 = Eo(n2);
        null !== t3 && t3.getWritable();
      }
      if (null !== t2) {
        const e3 = Eo(t2);
        null !== e3 && e3.getWritable();
      }
    }
  }
  function wo() {
    if (ai()) return null;
    return hi()._compositionKey;
  }
  function Eo(t2, e2) {
    const n2 = (e2 || di())._nodeMap.get(t2);
    return void 0 === n2 ? null : n2;
  }
  function Oo(t2, e2) {
    const n2 = Mo(t2, hi());
    return void 0 !== n2 ? Eo(n2, e2) : null;
  }
  function Mo(t2, e2) {
    return t2[`__lexicalKey_${e2._key}`];
  }
  function Ao(t2, e2) {
    let n2 = t2;
    for (; null != n2; ) {
      const t3 = Oo(n2, e2);
      if (null !== t3) return t3;
      n2 = cs(n2);
    }
    return null;
  }
  function Po(t2) {
    const e2 = t2._decorators, n2 = Object.assign({}, e2);
    return t2._pendingDecorators = n2, n2;
  }
  function Do(t2) {
    return t2.read(() => Fo().getTextContent());
  }
  function Fo() {
    return Lo(di());
  }
  function Lo(t2) {
    return t2._nodeMap.get("root");
  }
  function Io(t2) {
    ui();
    const e2 = di();
    null !== t2 && (t2.dirty = true, t2.setCachedNodes(null)), e2._selection = t2;
  }
  function Ko(t2) {
    const e2 = hi(), n2 = (function(t3, e3) {
      let n3 = t3;
      for (; null != n3; ) {
        const t4 = Mo(n3, e3);
        if (void 0 !== t4) return t4;
        n3 = cs(n3);
      }
      return null;
    })(t2, e2);
    if (null === n2) {
      return t2 === e2.getRootElement() ? Eo("root") : null;
    }
    return Eo(n2);
  }
  function zo(t2) {
    return /[\uD800-\uDBFF][\uDC00-\uDFFF]/g.test(t2);
  }
  function Ro(t2) {
    const e2 = [];
    let n2 = t2;
    for (; null !== n2; ) e2.push(n2), n2 = n2._parentEditor;
    return e2;
  }
  function Bo() {
    return Math.random().toString(36).replace(/[^a-z]+/g, "").substring(0, 5);
  }
  function Wo(t2) {
    return mo(t2) ? t2.nodeValue : null;
  }
  function Jo(t2, e2, n2) {
    const r3 = Ns(_s(e2));
    if (null === r3) return;
    const i3 = r3.anchorNode;
    let { anchorOffset: o2, focusOffset: s4 } = r3;
    if (null !== i3) {
      let e3 = Wo(i3);
      const r4 = Ao(i3);
      if (null !== e3 && pr(r4)) {
        if (e3 === P && n2) {
          const t3 = n2.length;
          e3 = n2, o2 = t3, s4 = t3;
        }
        null !== e3 && jo(r4, e3, o2, s4, t2);
      }
    }
  }
  function jo(t2, e2, n2, r3, i3) {
    let o2 = t2;
    if (o2.isAttached() && (i3 || !o2.isDirty())) {
      const s4 = o2.isComposing();
      let a3 = e2;
      (s4 || i3) && e2[e2.length - 1] === P && (a3 = e2.slice(0, -1));
      const u3 = o2.getTextContent();
      if (i3 || a3 !== u3) {
        if ("" === a3) {
          if (bo(null), l || c || d) o2.remove();
          else {
            const t3 = hi();
            setTimeout(() => {
              t3.update(() => {
                o2.isAttached() && o2.remove();
              });
            }, 20);
          }
          return;
        }
        const e3 = o2.getParent(), i4 = Ur(), u4 = o2.getTextContentSize(), f3 = wo(), h2 = o2.getKey();
        if (o2.isToken() || null !== f3 && h2 === f3 && !s4 || br(i4) && (null !== e3 && !e3.canInsertTextBefore() && 0 === i4.anchor.offset || i4.anchor.key === t2.__key && 0 === i4.anchor.offset && !o2.canInsertTextBefore() && !s4 || i4.focus.key === t2.__key && i4.focus.offset === u4 && !o2.canInsertTextAfter() && !s4)) return void o2.markDirty();
        const g3 = $r();
        if (!br(g3) || null === n2 || null === r3) return void $o(o2, a3, g3);
        if (g3.setTextNodeRange(o2, n2, o2, r3), o2.isSegmented()) {
          const t3 = _r(o2.getTextContent());
          o2.replace(t3), o2 = t3;
        }
        $o(o2, a3, g3);
      }
    }
  }
  function $o(t2, e2, n2) {
    if (t2.setTextContent(e2), br(n2)) {
      const e3 = t2.getKey();
      for (const r3 of ["anchor", "focus"]) {
        const i3 = n2[r3];
        "text" === i3.type && i3.key === e3 && (i3.offset = fl(t2, i3.offset, "clamp"));
      }
    }
  }
  function Uo(t2, e2, n2) {
    const r3 = e2[n2] || false;
    return "any" === r3 || r3 === t2[n2];
  }
  function Vo(t2, e2) {
    return Uo(t2, e2, "altKey") && Uo(t2, e2, "ctrlKey") && Uo(t2, e2, "shiftKey") && Uo(t2, e2, "metaKey");
  }
  function Yo(t2, e2, n2) {
    return Vo(t2, n2) && t2.key.toLowerCase() === e2.toLowerCase();
  }
  var qo = { ctrlKey: !i, metaKey: i };
  var Ho = { altKey: i, ctrlKey: !i };
  function Go(t2) {
    return "Backspace" === t2.key;
  }
  function Xo(t2) {
    return Yo(t2, "a", qo);
  }
  function Qo(t2) {
    const e2 = Fo();
    if (br(t2)) {
      const e3 = t2.anchor, n2 = t2.focus, r3 = e3.getNode().getTopLevelElementOrThrow().getParentOrThrow();
      return e3.set(r3.getKey(), 0, "element"), n2.set(r3.getKey(), r3.getChildrenSize(), "element"), St(t2), t2;
    }
    {
      const t3 = e2.select(0, e2.getChildrenSize());
      return Io(St(t3)), t3;
    }
  }
  function Zo(t2, e2) {
    void 0 === t2.__lexicalClassNameCache && (t2.__lexicalClassNameCache = {});
    const n2 = t2.__lexicalClassNameCache, r3 = n2[e2];
    if (void 0 !== r3) return r3;
    const i3 = t2[e2];
    if ("string" == typeof i3) {
      const t3 = h(i3);
      return n2[e2] = t3, t3;
    }
    return i3;
  }
  function ts(e2, n2, r3, i3, o2) {
    if (0 === r3.size) return;
    const s4 = i3.__type, l3 = i3.__key, c3 = n2.get(s4);
    void 0 === c3 && t(33, s4);
    const a3 = c3.klass;
    let u3 = e2.get(a3);
    void 0 === u3 && (u3 = /* @__PURE__ */ new Map(), e2.set(a3, u3));
    const f3 = u3.get(l3), d4 = "destroyed" === f3 && "created" === o2;
    (void 0 === f3 || d4) && u3.set(l3, d4 ? "updated" : o2);
  }
  function es(t2) {
    const e2 = t2.getType(), n2 = di();
    if (n2._readOnly) {
      const t3 = zs(n2).get(e2);
      return t3 ? Array.from(t3.values()) : [];
    }
    const r3 = n2._nodeMap, i3 = [];
    for (const [, n3] of r3) n3 instanceof t2 && n3.__type === e2 && n3.isAttached() && i3.push(n3);
    return i3;
  }
  function ns(t2, e2, n2) {
    const r3 = t2.getParent();
    let i3 = n2, o2 = t2;
    return null !== r3 && (e2 && 0 === n2 ? (i3 = o2.getIndexWithinParent(), o2 = r3) : e2 || n2 !== o2.getChildrenSize() || (i3 = o2.getIndexWithinParent() + 1, o2 = r3)), o2.getChildAtIndex(e2 ? i3 - 1 : i3);
  }
  function rs(t2, e2) {
    const n2 = t2.offset;
    if ("element" === t2.type) {
      return ns(t2.getNode(), e2, n2);
    }
    {
      const r3 = t2.getNode();
      if (e2 && 0 === n2 || !e2 && n2 === r3.getTextContentSize()) {
        const t3 = e2 ? r3.getPreviousSibling() : r3.getNextSibling();
        return null === t3 ? ns(r3.getParentOrThrow(), e2, r3.getIndexWithinParent() + (e2 ? 0 : 1)) : t3;
      }
    }
    return null;
  }
  function is(t2) {
    const e2 = _s(t2).event, n2 = e2 && e2.inputType;
    return "insertFromPaste" === n2 || "insertFromPasteAsQuotation" === n2;
  }
  function os(t2, e2, n2) {
    return (function(t3, e3, n3) {
      const r3 = Ro(t3);
      for (let i3 = 4; i3 >= 0; i3--) for (let o2 = 0; o2 < r3.length; o2++) {
        const s4 = r3[o2], l3 = s4._commands.get(e3);
        if (void 0 !== l3) {
          const e4 = l3[i3];
          if (void 0 !== e4) {
            const r4 = Array.from(e4), i4 = r4.length;
            let o3 = false;
            if (bi(s4, () => {
              for (let e5 = 0; e5 < i4; e5++) if (r4[e5](n3, t3)) return void (o3 = true);
            }), o3) return o3;
          }
        }
      }
      return false;
    })(t2, e2, n2);
  }
  function ss(t2) {
    return !Li(t2) && !t2.isLastChild() && !t2.isInline();
  }
  function ls(e2, n2) {
    const r3 = e2._keyToDOMMap.get(n2);
    return void 0 === r3 && t(75, n2), r3;
  }
  function cs(t2) {
    const e2 = t2.assignedSlot || t2.parentElement;
    return As(e2) ? e2.host : e2;
  }
  function as(t2) {
    return xo(t2) ? t2 : Os(t2) ? t2.ownerDocument : null;
  }
  function us(t2) {
    return hi()._updateTags.has(t2);
  }
  function fs(t2) {
    ui();
    hi()._updateTags.add(t2);
  }
  function ds(t2) {
    ui();
    hi()._deferred.push(t2);
  }
  function hs(t2, e2) {
    let n2 = t2.getParent();
    for (; null !== n2; ) {
      if (n2.is(e2)) return true;
      n2 = n2.getParent();
    }
    return false;
  }
  function gs(t2) {
    const e2 = as(t2);
    return e2 ? e2.defaultView : null;
  }
  function _s(e2) {
    const n2 = e2._window;
    return null === n2 && t(78), n2;
  }
  function ps(t2) {
    return Mi(t2) && t2.isInline() || Di(t2) && t2.isInline();
  }
  function ys(t2) {
    let e2 = t2.getParentOrThrow();
    for (; null !== e2; ) {
      if (ms(e2)) return e2;
      e2 = e2.getParentOrThrow();
    }
    return e2;
  }
  function ms(t2) {
    return Li(t2) || Mi(t2) && t2.isShadowRoot();
  }
  function xs(t2) {
    const e2 = t2.constructor.clone(t2);
    return ko(e2, null), e2.afterCloneFrom(t2), e2;
  }
  function Cs(e2) {
    const n2 = hi(), r3 = e2.getType(), i3 = so(n2, r3);
    void 0 === i3 && t(200, e2.constructor.name, r3);
    const { replace: o2, replaceWithKlass: s4 } = i3;
    if (null !== o2) {
      const n3 = o2(e2), i4 = n3.constructor;
      return null !== s4 ? n3 instanceof s4 || t(201, s4.name, s4.getType(), i4.name, i4.getType(), e2.constructor.name, r3) : n3 instanceof e2.constructor && i4 !== e2.constructor || t(202, i4.name, i4.getType(), e2.constructor.name, r3), n3.__key === e2.__key && t(203, e2.constructor.name, r3, i4.name, i4.getType()), n3;
    }
    return e2;
  }
  function Ss(e2, n2) {
    !Li(e2.getParent()) || Mi(n2) || Di(n2) || t(99);
  }
  function vs(e2) {
    const n2 = Eo(e2);
    return null === n2 && t(63, e2), n2;
  }
  function ks(t2) {
    return (Di(t2) || Mi(t2) && !t2.canBeEmpty()) && !t2.isInline();
  }
  function Ts(t2, e2, n2) {
    n2.style.removeProperty("caret-color"), e2._blockCursorElement = null;
    const r3 = t2.parentElement;
    null !== r3 && r3.removeChild(t2);
  }
  function Ns(t2) {
    return n ? (t2 || window).getSelection() : null;
  }
  function bs(t2) {
    const e2 = gs(t2);
    return e2 ? e2.getSelection() : null;
  }
  function ws(e2, n2) {
    let r3 = e2.getChildAtIndex(n2);
    null == r3 && (r3 = e2), ms(e2) && t(102);
    const i3 = (e3) => {
      const n3 = e3.getParentOrThrow(), o3 = ms(n3), s5 = e3 !== r3 || o3 ? xs(e3) : e3;
      if (o3) return Mi(e3) && Mi(s5) || t(133), e3.insertAfter(s5), [e3, s5, s5];
      {
        const [t2, r4, o4] = i3(n3), l3 = e3.getNextSiblings();
        return o4.append(s5, ...l3), [t2, r4, s5];
      }
    }, [o2, s4] = i3(r3);
    return [o2, s4];
  }
  function Es(t2) {
    return Os(t2) && "A" === t2.tagName;
  }
  function Os(t2) {
    return Ms(t2) && 1 === t2.nodeType;
  }
  function Ms(t2) {
    return "object" == typeof t2 && null !== t2 && "nodeType" in t2 && "number" == typeof t2.nodeType;
  }
  function As(t2) {
    return Ms(t2) && 11 === t2.nodeType;
  }
  function Ps(t2) {
    const e2 = new RegExp(/^(a|abbr|acronym|b|cite|code|del|em|i|ins|kbd|label|mark|output|q|ruby|s|samp|span|strong|sub|sup|time|u|tt|var|#text)$/, "i");
    return null !== t2.nodeName.match(e2);
  }
  function Ds(t2) {
    const e2 = new RegExp(/^(address|article|aside|blockquote|canvas|dd|div|dl|dt|fieldset|figcaption|figure|footer|form|h1|h2|h3|h4|h5|h6|header|hr|li|main|nav|noscript|ol|p|pre|section|table|td|tfoot|ul|video)$/, "i");
    return null !== t2.nodeName.match(e2);
  }
  function Fs(t2) {
    if (Di(t2) && !t2.isInline()) return true;
    if (!Mi(t2) || ms(t2)) return false;
    const e2 = t2.getFirstChild(), n2 = null === e2 || Qn(e2) || pr(e2) || e2.isInline();
    return !t2.isInline() && false !== t2.canBeEmpty() && n2;
  }
  function Ls() {
    return hi();
  }
  var Is = /* @__PURE__ */ new WeakMap();
  var Ks = /* @__PURE__ */ new Map();
  function zs(e2) {
    if (!e2._readOnly && e2.isEmpty()) return Ks;
    e2._readOnly || t(192);
    let n2 = Is.get(e2);
    return n2 || (n2 = (function(t2) {
      const e3 = /* @__PURE__ */ new Map();
      for (const [n3, r3] of t2._nodeMap) {
        const t3 = r3.__type;
        let i3 = e3.get(t3);
        i3 || (i3 = /* @__PURE__ */ new Map(), e3.set(t3, i3)), i3.set(n3, r3);
      }
      return e3;
    })(e2), Is.set(e2, n2)), n2;
  }
  function Rs(t2) {
    const e2 = t2.constructor.clone(t2);
    return e2.afterCloneFrom(t2), e2;
  }
  function Bs(t2) {
    return (e2 = Rs(t2))[Kn] = true, e2;
    var e2;
  }
  function Ws(t2, e2) {
    const n2 = parseInt(t2.style.paddingInlineStart, 10) || 0, r3 = Math.round(n2 / 40);
    e2.setIndent(r3);
  }
  function Js(t2) {
    t2.__lexicalUnmanaged = true;
  }
  function js(t2) {
    return true === t2.__lexicalUnmanaged;
  }
  function $s(t2, e2) {
    return (function(t3, e3) {
      return Object.prototype.hasOwnProperty.call(t3, e3);
    })(t2, e2) && t2[e2] !== Rn[e2];
  }
  function Us(e2) {
    const n2 = V in e2.prototype ? e2.prototype[V]() : void 0, r3 = (function(e3) {
      if (!(e3 === Rn || e3.prototype instanceof Rn)) {
        let n3 = "<unknown>", r4 = "<unknown>";
        try {
          n3 = e3.getType();
        } catch (t2) {
        }
        try {
          to.version && (r4 = JSON.parse(to.version));
        } catch (t2) {
        }
        t(290, e3.name, n3, r4);
      }
      return e3 === Pi || e3 === Oi || e3 === Rn;
    })(e2), i3 = !r3 && $s(e2, "getType") ? e2.getType() : void 0;
    let o2, s4 = i3;
    if (n2) if (i3) o2 = n2[i3];
    else for (const [t2, e3] of Object.entries(n2)) s4 = t2, o2 = e3;
    if (!r3 && s4 && ($s(e2, "getType") || (e2.getType = () => s4), $s(e2, "clone") || (e2.clone = (t2) => (no(t2), new e2())), $s(e2, "importJSON") || (e2.importJSON = o2 && o2.$importJSON || ((t2) => new e2().updateFromJSON(t2))), !$s(e2, "importDOM") && o2)) {
      const { importDOM: t2 } = o2;
      t2 && (e2.importDOM = () => t2);
    }
    return { ownNodeConfig: o2, ownNodeType: s4 };
  }
  function Vs(t2) {
    const e2 = Ls();
    ui();
    return new (e2.resolveRegisteredNodeAfterReplacements(e2.getRegisteredNode(t2))).klass();
  }
  var Ys = (t2, e2) => {
    let n2 = t2;
    for (; null != n2 && !Li(n2); ) {
      if (e2(n2)) return n2;
      n2 = n2.getParent();
    }
    return null;
  };
  var qs = { next: "previous", previous: "next" };
  var Hs = class {
    origin;
    constructor(t2) {
      this.origin = t2;
    }
    [Symbol.iterator]() {
      return vl({ hasNext: il, initial: this.getAdjacentCaret(), map: (t2) => t2, step: (t2) => t2.getAdjacentCaret() });
    }
    getAdjacentCaret() {
      return al(this.getNodeAtCaret(), this.direction);
    }
    getSiblingCaret() {
      return al(this.origin, this.direction);
    }
    remove() {
      const t2 = this.getNodeAtCaret();
      return t2 && t2.remove(), this;
    }
    replaceOrInsert(t2, e2) {
      const n2 = this.getNodeAtCaret();
      return t2.is(this.origin) || t2.is(n2) || (null === n2 ? this.insert(t2) : n2.replace(t2, e2)), this;
    }
    splice(e2, n2, r3 = "next") {
      const i3 = r3 === this.direction ? n2 : Array.from(n2).reverse();
      let o2 = this;
      const s4 = this.getParentAtCaret(), l3 = /* @__PURE__ */ new Map();
      for (let t2 = o2.getAdjacentCaret(); null !== t2 && l3.size < e2; t2 = t2.getAdjacentCaret()) {
        const e3 = t2.origin.getWritable();
        l3.set(e3.getKey(), e3);
      }
      for (const e3 of i3) {
        if (l3.size > 0) {
          const n3 = o2.getNodeAtCaret();
          if (n3) if (l3.delete(n3.getKey()), l3.delete(e3.getKey()), n3.is(e3) || o2.origin.is(e3)) ;
          else {
            const t2 = e3.getParent();
            t2 && t2.is(s4) && e3.remove(), n3.replace(e3);
          }
          else null === n3 && t(263, Array.from(l3).join(" "));
        } else o2.insert(e3);
        o2 = al(e3, this.direction);
      }
      for (const t2 of l3.values()) t2.remove();
      return this;
    }
  };
  var Gs = class _Gs extends Hs {
    type = "child";
    getLatest() {
      const t2 = this.origin.getLatest();
      return t2 === this.origin ? this : hl(t2, this.direction);
    }
    getParentCaret(t2 = "root") {
      return al(Zs(this.getParentAtCaret(), t2), this.direction);
    }
    getFlipped() {
      const t2 = Qs(this.direction);
      return al(this.getNodeAtCaret(), t2) || hl(this.origin, t2);
    }
    getParentAtCaret() {
      return this.origin;
    }
    getChildCaret() {
      return this;
    }
    isSameNodeCaret(t2) {
      return t2 instanceof _Gs && this.direction === t2.direction && this.origin.is(t2.origin);
    }
    isSamePointCaret(t2) {
      return this.isSameNodeCaret(t2);
    }
  };
  var Xs = { root: Li, shadowRoot: ms };
  function Qs(t2) {
    return qs[t2];
  }
  function Zs(t2, e2 = "root") {
    return Xs[e2](t2) ? null : t2;
  }
  var tl = class _tl extends Hs {
    type = "sibling";
    getLatest() {
      const t2 = this.origin.getLatest();
      return t2 === this.origin ? this : al(t2, this.direction);
    }
    getSiblingCaret() {
      return this;
    }
    getParentAtCaret() {
      return this.origin.getParent();
    }
    getChildCaret() {
      return Mi(this.origin) ? hl(this.origin, this.direction) : null;
    }
    getParentCaret(t2 = "root") {
      return al(Zs(this.getParentAtCaret(), t2), this.direction);
    }
    getFlipped() {
      const t2 = Qs(this.direction);
      return al(this.getNodeAtCaret(), t2) || hl(this.origin.getParentOrThrow(), t2);
    }
    isSamePointCaret(t2) {
      return t2 instanceof _tl && this.direction === t2.direction && this.origin.is(t2.origin);
    }
    isSameNodeCaret(t2) {
      return (t2 instanceof _tl || t2 instanceof el) && this.direction === t2.direction && this.origin.is(t2.origin);
    }
  };
  var el = class _el extends Hs {
    type = "text";
    offset;
    constructor(t2, e2) {
      super(t2), this.offset = e2;
    }
    getLatest() {
      const t2 = this.origin.getLatest();
      return t2 === this.origin ? this : ul(t2, this.direction, this.offset);
    }
    getParentAtCaret() {
      return this.origin.getParent();
    }
    getChildCaret() {
      return null;
    }
    getParentCaret(t2 = "root") {
      return al(Zs(this.getParentAtCaret(), t2), this.direction);
    }
    getFlipped() {
      return ul(this.origin, Qs(this.direction), this.offset);
    }
    isSamePointCaret(t2) {
      return t2 instanceof _el && this.direction === t2.direction && this.origin.is(t2.origin) && this.offset === t2.offset;
    }
    isSameNodeCaret(t2) {
      return (t2 instanceof tl || t2 instanceof _el) && this.direction === t2.direction && this.origin.is(t2.origin);
    }
    getSiblingCaret() {
      return al(this.origin, this.direction);
    }
  };
  function nl(t2) {
    return t2 instanceof el;
  }
  function rl(t2) {
    return t2 instanceof Hs;
  }
  function il(t2) {
    return t2 instanceof tl;
  }
  function ol(t2) {
    return t2 instanceof Gs;
  }
  var sl = { next: class extends el {
    direction = "next";
    getNodeAtCaret() {
      return this.origin.getNextSibling();
    }
    insert(t2) {
      return this.origin.insertAfter(t2), this;
    }
  }, previous: class extends el {
    direction = "previous";
    getNodeAtCaret() {
      return this.origin.getPreviousSibling();
    }
    insert(t2) {
      return this.origin.insertBefore(t2), this;
    }
  } };
  var ll = { next: class extends tl {
    direction = "next";
    getNodeAtCaret() {
      return this.origin.getNextSibling();
    }
    insert(t2) {
      return this.origin.insertAfter(t2), this;
    }
  }, previous: class extends tl {
    direction = "previous";
    getNodeAtCaret() {
      return this.origin.getPreviousSibling();
    }
    insert(t2) {
      return this.origin.insertBefore(t2), this;
    }
  } };
  var cl = { next: class extends Gs {
    direction = "next";
    getNodeAtCaret() {
      return this.origin.getFirstChild();
    }
    insert(t2) {
      return this.origin.splice(0, 0, [t2]), this;
    }
  }, previous: class extends Gs {
    direction = "previous";
    getNodeAtCaret() {
      return this.origin.getLastChild();
    }
    insert(t2) {
      return this.origin.splice(this.origin.getChildrenSize(), 0, [t2]), this;
    }
  } };
  function al(t2, e2) {
    return t2 ? new ll[e2](t2) : null;
  }
  function ul(t2, e2, n2) {
    return t2 ? new sl[e2](t2, fl(t2, n2)) : null;
  }
  function fl(t2, n2, r3 = "error") {
    const i3 = t2.getTextContentSize();
    let o2 = "next" === n2 ? i3 : "previous" === n2 ? 0 : n2;
    return (o2 < 0 || o2 > i3) && ("clamp" !== r3 && e(284, String(n2), String(i3), t2.getKey()), o2 = o2 < 0 ? 0 : i3), o2;
  }
  function dl(t2, e2) {
    return new yl(t2, e2);
  }
  function hl(t2, e2) {
    return Mi(t2) ? new cl[e2](t2) : null;
  }
  function gl(t2) {
    return t2 && t2.getChildCaret() || t2;
  }
  function _l(t2) {
    return t2 && gl(t2.getAdjacentCaret());
  }
  var pl = class _pl {
    type = "node-caret-range";
    direction;
    anchor;
    focus;
    constructor(t2, e2, n2) {
      this.anchor = t2, this.focus = e2, this.direction = n2;
    }
    getLatest() {
      const t2 = this.anchor.getLatest(), e2 = this.focus.getLatest();
      return t2 === this.anchor && e2 === this.focus ? this : new _pl(t2, e2, this.direction);
    }
    isCollapsed() {
      return this.anchor.isSamePointCaret(this.focus);
    }
    getTextSlices() {
      const t2 = (t3) => {
        const e3 = this[t3].getLatest();
        return nl(e3) ? (function(t4, e4) {
          const { direction: n3, origin: r3 } = t4, i3 = fl(r3, "focus" === e4 ? Qs(n3) : n3);
          return dl(t4, i3 - t4.offset);
        })(e3, t3) : null;
      }, e2 = t2("anchor"), n2 = t2("focus");
      if (e2 && n2) {
        const { caret: t3 } = e2, { caret: r3 } = n2;
        if (t3.isSameNodeCaret(r3)) return [dl(t3, r3.offset - t3.offset), null];
      }
      return [e2, n2];
    }
    iterNodeCarets(t2 = "root") {
      const e2 = nl(this.anchor) ? this.anchor.getSiblingCaret() : this.anchor.getLatest(), n2 = this.focus.getLatest(), r3 = nl(n2), i3 = (e3) => e3.isSameNodeCaret(n2) ? null : _l(e3) || e3.getParentCaret(t2);
      return vl({ hasNext: (t3) => null !== t3 && !(r3 && n2.isSameNodeCaret(t3)), initial: e2.isSameNodeCaret(n2) ? null : i3(e2), map: (t3) => t3, step: i3 });
    }
    [Symbol.iterator]() {
      return this.iterNodeCarets("root");
    }
  };
  var yl = class {
    type = "slice";
    caret;
    distance;
    constructor(t2, e2) {
      this.caret = t2, this.distance = e2;
    }
    getSliceIndices() {
      const { distance: t2, caret: { offset: e2 } } = this, n2 = e2 + t2;
      return n2 < e2 ? [n2, e2] : [e2, n2];
    }
    getTextContent() {
      const [t2, e2] = this.getSliceIndices();
      return this.caret.origin.getTextContent().slice(t2, e2);
    }
    getTextContentSize() {
      return Math.abs(this.distance);
    }
    removeTextSlice() {
      const { caret: { origin: t2, direction: e2 } } = this, [n2, r3] = this.getSliceIndices(), i3 = t2.getTextContent();
      return ul(t2.setTextContent(i3.slice(0, n2) + i3.slice(r3)), e2, n2);
    }
  };
  function ml(t2) {
    return t2 instanceof yl;
  }
  function xl(t2) {
    return Sl(t2, al(Fo(), t2.direction));
  }
  function Cl(t2) {
    return Sl(t2, t2);
  }
  function Sl(e2, n2) {
    return e2.direction !== n2.direction && t(265), new pl(e2, n2, e2.direction);
  }
  function vl(t2) {
    const { initial: e2, hasNext: n2, step: r3, map: i3 } = t2;
    let o2 = e2;
    return { [Symbol.iterator]() {
      return this;
    }, next() {
      if (!n2(o2)) return { done: true, value: void 0 };
      const t3 = { done: false, value: i3(o2) };
      return o2 = r3(o2), t3;
    } };
  }
  function kl(e2, n2) {
    const r3 = wl(e2.origin, n2.origin);
    switch (null === r3 && t(275, e2.origin.getKey(), n2.origin.getKey()), r3.type) {
      case "same": {
        const t2 = "text" === e2.type, r4 = "text" === n2.type;
        return t2 && r4 ? (function(t3, e3) {
          return Math.sign(t3 - e3);
        })(e2.offset, n2.offset) : e2.type === n2.type ? 0 : t2 ? -1 : r4 ? 1 : "child" === e2.type ? -1 : 1;
      }
      case "ancestor":
        return "child" === e2.type ? -1 : 1;
      case "descendant":
        return "child" === n2.type ? 1 : -1;
      case "branch":
        return Tl(r3);
    }
  }
  function Tl(t2) {
    const { a: e2, b: n2 } = t2, r3 = e2.__key, i3 = n2.__key;
    let o2 = e2, s4 = n2;
    for (; o2 && s4; o2 = o2.getNextSibling(), s4 = s4.getNextSibling()) {
      if (o2.__key === i3) return -1;
      if (s4.__key === r3) return 1;
    }
    return null === o2 ? 1 : -1;
  }
  function Nl(t2, e2) {
    return e2.is(t2);
  }
  function bl(t2) {
    return Mi(t2) ? [t2.getLatest(), null] : [t2.getParent(), t2.getLatest()];
  }
  function wl(e2, n2) {
    if (e2.is(n2)) return { commonAncestor: e2, type: "same" };
    const r3 = /* @__PURE__ */ new Map();
    for (let [t2, n3] = bl(e2); t2; n3 = t2, t2 = t2.getParent()) r3.set(t2, n3);
    for (let [i3, o2] = bl(n2); i3; o2 = i3, i3 = i3.getParent()) {
      const s4 = r3.get(i3);
      if (void 0 !== s4) return null === s4 ? (Nl(e2, i3) || t(276), { commonAncestor: i3, type: "ancestor" }) : null === o2 ? (Nl(n2, i3) || t(277), { commonAncestor: i3, type: "descendant" }) : ((Mi(s4) || Nl(e2, s4)) && (Mi(o2) || Nl(n2, o2)) && i3.is(s4.getParent()) && i3.is(o2.getParent()) || t(278), { a: s4, b: o2, commonAncestor: i3, type: "branch" });
    }
    return null;
  }
  function El(e2, n2) {
    const { type: r3, key: i3, offset: o2 } = e2, s4 = vs(e2.key);
    return "text" === r3 ? (pr(s4) || t(266, s4.getType(), i3), ul(s4, n2, o2)) : (Mi(s4) || t(267, s4.getType(), i3), Wl(s4, e2.offset, n2));
  }
  function Ol(e2, n2) {
    const { origin: r3, direction: i3 } = n2, o2 = "next" === i3;
    nl(n2) ? e2.set(r3.getKey(), n2.offset, "text") : il(n2) ? pr(r3) ? e2.set(r3.getKey(), fl(r3, i3), "text") : e2.set(r3.getParentOrThrow().getKey(), r3.getIndexWithinParent() + (o2 ? 1 : 0), "element") : (ol(n2) && Mi(r3) || t(268), e2.set(r3.getKey(), o2 ? 0 : r3.getChildrenSize(), "element"));
  }
  function Ml(t2) {
    const e2 = $r(), n2 = br(e2) ? e2 : Br();
    return Al(n2, t2), Io(n2), n2;
  }
  function Al(t2, e2) {
    Ol(t2.anchor, e2.anchor), Ol(t2.focus, e2.focus);
  }
  function Pl(t2) {
    const { anchor: e2, focus: n2 } = t2, r3 = El(e2, "next"), i3 = El(n2, "next"), o2 = kl(r3, i3) <= 0 ? "next" : "previous";
    return Sl(Rl(r3, o2), Rl(i3, o2));
  }
  function Dl(t2) {
    const { direction: e2, origin: n2 } = t2, r3 = al(n2, Qs(e2)).getNodeAtCaret();
    return r3 ? al(r3, e2) : hl(n2.getParentOrThrow(), e2);
  }
  function Fl(t2, e2 = "root") {
    const n2 = [t2];
    for (let r3 = ol(t2) ? t2.getParentCaret(e2) : t2.getSiblingCaret(); null !== r3; r3 = r3.getParentCaret(e2)) n2.push(Dl(r3));
    return n2;
  }
  function Ll(t2) {
    return !!t2 && t2.origin.isAttached();
  }
  function Il(e2, n2 = "removeEmptySlices") {
    if (e2.isCollapsed()) return e2;
    const r3 = "root", i3 = "next";
    let o2 = n2;
    const s4 = Bl(e2, i3), l3 = Fl(s4.anchor, r3), c3 = Fl(s4.focus.getFlipped(), r3), a3 = /* @__PURE__ */ new Set(), u3 = [];
    for (const t2 of s4.iterNodeCarets(r3)) if (ol(t2)) a3.add(t2.origin.getKey());
    else if (il(t2)) {
      const { origin: e3 } = t2;
      Mi(e3) && !a3.has(e3.getKey()) || u3.push(e3);
    }
    for (const t2 of u3) t2.remove();
    for (const t2 of s4.getTextSlices()) {
      if (!t2) continue;
      const { origin: e3 } = t2.caret, n3 = e3.getTextContentSize(), r4 = Dl(al(e3, i3)), s5 = e3.getMode();
      if (Math.abs(t2.distance) === n3 && "removeEmptySlices" === o2 || "token" === s5 && 0 !== t2.distance) r4.remove();
      else if (0 !== t2.distance) {
        o2 = "removeEmptySlices";
        let e4 = t2.removeTextSlice();
        const n4 = t2.caret.origin;
        if ("segmented" === s5) {
          const t3 = e4.origin, n5 = _r(t3.getTextContent()).setStyle(t3.getStyle()).setFormat(t3.getFormat());
          r4.replaceOrInsert(n5), e4 = ul(n5, i3, e4.offset);
        }
        n4.is(l3[0].origin) && (l3[0] = e4), n4.is(c3[0].origin) && (c3[0] = e4.getFlipped());
      }
    }
    let f3, d4;
    for (const t2 of l3) if (Ll(t2)) {
      f3 = Kl(t2);
      break;
    }
    for (const t2 of c3) if (Ll(t2)) {
      d4 = Kl(t2);
      break;
    }
    const h2 = (function(t2, e3, n3) {
      if (!t2 || !e3) return null;
      const r4 = t2.getParentAtCaret(), i4 = e3.getParentAtCaret();
      if (!r4 || !i4) return null;
      const o3 = r4.getParents().reverse();
      o3.push(r4);
      const s5 = i4.getParents().reverse();
      s5.push(i4);
      const l4 = Math.min(o3.length, s5.length);
      let c4;
      for (c4 = 0; c4 < l4 && o3[c4] === s5[c4]; c4++) ;
      const a4 = (t3, e4) => {
        let n4;
        for (let r5 = c4; r5 < t3.length; r5++) {
          const i5 = t3[r5];
          if (ms(i5)) return;
          !n4 && e4(i5) && (n4 = i5);
        }
        return n4;
      }, u4 = a4(o3, Fs), f4 = u4 && a4(s5, (t3) => n3.has(t3.getKey()) && Fs(t3));
      return u4 && f4 ? [u4, f4] : null;
    })(f3, d4, a3);
    if (h2) {
      const [t2, e3] = h2;
      hl(t2, "previous").splice(0, e3.getChildren()), e3.remove();
    }
    const g3 = [f3, d4, ...l3, ...c3].find(Ll);
    if (g3) {
      return Cl(Rl(Kl(g3), e2.direction));
    }
    t(269, JSON.stringify(l3.map((t2) => t2.origin.__key)));
  }
  function Kl(t2) {
    const e2 = (function(t3) {
      let e3 = t3;
      for (; ol(e3); ) {
        const t4 = _l(e3);
        if (!ol(t4)) break;
        e3 = t4;
      }
      return e3;
    })(t2.getLatest()), { direction: n2 } = e2;
    if (pr(e2.origin)) return nl(e2) ? e2 : ul(e2.origin, n2, n2);
    const r3 = e2.getAdjacentCaret();
    return il(r3) && pr(r3.origin) ? ul(r3.origin, n2, Qs(n2)) : e2;
  }
  function zl(t2) {
    return nl(t2) && t2.offset !== fl(t2.origin, t2.direction);
  }
  function Rl(t2, e2) {
    return t2.direction === e2 ? t2 : t2.getFlipped();
  }
  function Bl(t2, e2) {
    return t2.direction === e2 ? t2 : Sl(Rl(t2.focus, e2), Rl(t2.anchor, e2));
  }
  function Wl(t2, e2, n2) {
    let r3 = hl(t2, "next");
    for (let t3 = 0; t3 < e2; t3++) {
      const t4 = r3.getAdjacentCaret();
      if (null === t4) break;
      r3 = t4;
    }
    return Rl(r3, n2);
  }
  function Jl(t2, e2 = "root") {
    let n2 = 0, r3 = t2, i3 = _l(r3);
    for (; null === i3; ) {
      if (n2--, i3 = r3.getParentCaret(e2), !i3) return null;
      r3 = i3, i3 = _l(r3);
    }
    return i3 && [i3, n2];
  }
  function jl(e2) {
    const { origin: n2, offset: r3, direction: i3 } = e2;
    if (r3 === fl(n2, i3)) return e2.getSiblingCaret();
    if (r3 === fl(n2, Qs(i3))) return Dl(e2.getSiblingCaret());
    const [o2] = n2.splitText(r3);
    return pr(o2) || t(281), Rl(al(o2, "next"), i3);
  }
  function $l(t2, e2) {
    return true;
  }
  function Ul(t2, { $copyElementNode: e2 = xs, $splitTextPointCaretNext: n2 = jl, rootMode: r3 = "shadowRoot", $shouldSplit: i3 = $l } = {}) {
    if (nl(t2)) return n2(t2);
    const o2 = t2.getParentCaret(r3);
    if (o2) {
      const { origin: n3 } = o2;
      if (ol(t2) && (!n3.canBeEmpty() || !i3(n3, "first"))) return Dl(o2);
      const r4 = (function(t3) {
        const e3 = [];
        for (let n4 = t3.getAdjacentCaret(); n4; n4 = n4.getAdjacentCaret()) e3.push(n4.origin);
        return e3;
      })(t2);
      (r4.length > 0 || n3.canBeEmpty() && i3(n3, "last")) && o2.insert(e2(n3).splice(0, 0, r4));
    }
    return o2;
  }
  function Vl(t2) {
    return t2;
  }
  function Yl(...t2) {
    return t2;
  }
  function ql(t2, e2) {
    return [t2, e2];
  }
  function Hl(t2) {
    return t2;
  }
  function Gl(t2, e2) {
    if (!e2 || t2 === e2) return t2;
    for (const n2 in e2) if (t2[n2] !== e2[n2]) return { ...t2, ...e2 };
    return t2;
  }

  // node_modules/lexical/Lexical.mjs
  var mod = false ? Lexical_dev_exports : Lexical_prod_exports;
  var $addUpdateTag = mod.$addUpdateTag;
  var $applyNodeReplacement = mod.$applyNodeReplacement;
  var $caretFromPoint = mod.$caretFromPoint;
  var $caretRangeFromSelection = mod.$caretRangeFromSelection;
  var $cloneWithProperties = mod.$cloneWithProperties;
  var $cloneWithPropertiesEphemeral = mod.$cloneWithPropertiesEphemeral;
  var $comparePointCaretNext = mod.$comparePointCaretNext;
  var $copyNode = mod.$copyNode;
  var $create = mod.$create;
  var $createLineBreakNode = mod.$createLineBreakNode;
  var $createNodeSelection = mod.$createNodeSelection;
  var $createParagraphNode = mod.$createParagraphNode;
  var $createPoint = mod.$createPoint;
  var $createRangeSelection = mod.$createRangeSelection;
  var $createRangeSelectionFromDom = mod.$createRangeSelectionFromDom;
  var $createTabNode = mod.$createTabNode;
  var $createTextNode = mod.$createTextNode;
  var $extendCaretToRange = mod.$extendCaretToRange;
  var $findMatchingParent = mod.$findMatchingParent;
  var $getAdjacentChildCaret = mod.$getAdjacentChildCaret;
  var $getAdjacentNode = mod.$getAdjacentNode;
  var $getAdjacentSiblingOrParentSiblingCaret = mod.$getAdjacentSiblingOrParentSiblingCaret;
  var $getCaretInDirection = mod.$getCaretInDirection;
  var $getCaretRange = mod.$getCaretRange;
  var $getCaretRangeInDirection = mod.$getCaretRangeInDirection;
  var $getCharacterOffsets = mod.$getCharacterOffsets;
  var $getChildCaret = mod.$getChildCaret;
  var $getChildCaretAtIndex = mod.$getChildCaretAtIndex;
  var $getChildCaretOrSelf = mod.$getChildCaretOrSelf;
  var $getCollapsedCaretRange = mod.$getCollapsedCaretRange;
  var $getCommonAncestor = mod.$getCommonAncestor;
  var $getCommonAncestorResultBranchOrder = mod.$getCommonAncestorResultBranchOrder;
  var $getEditor = mod.$getEditor;
  var $getNearestNodeFromDOMNode = mod.$getNearestNodeFromDOMNode;
  var $getNearestRootOrShadowRoot = mod.$getNearestRootOrShadowRoot;
  var $getNodeByKey = mod.$getNodeByKey;
  var $getNodeByKeyOrThrow = mod.$getNodeByKeyOrThrow;
  var $getNodeFromDOMNode = mod.$getNodeFromDOMNode;
  var $getPreviousSelection = mod.$getPreviousSelection;
  var $getRoot = mod.$getRoot;
  var $getSelection = mod.$getSelection;
  var $getSiblingCaret = mod.$getSiblingCaret;
  var $getState = mod.$getState;
  var $getStateChange = mod.$getStateChange;
  var $getTextContent = mod.$getTextContent;
  var $getTextNodeOffset = mod.$getTextNodeOffset;
  var $getTextPointCaret = mod.$getTextPointCaret;
  var $getTextPointCaretSlice = mod.$getTextPointCaretSlice;
  var $getWritableNodeState = mod.$getWritableNodeState;
  var $hasAncestor = mod.$hasAncestor;
  var $hasUpdateTag = mod.$hasUpdateTag;
  var $insertNodes = mod.$insertNodes;
  var $isBlockElementNode = mod.$isBlockElementNode;
  var $isChildCaret = mod.$isChildCaret;
  var $isDecoratorNode = mod.$isDecoratorNode;
  var $isEditorState = mod.$isEditorState;
  var $isElementNode = mod.$isElementNode;
  var $isExtendableTextPointCaret = mod.$isExtendableTextPointCaret;
  var $isInlineElementOrDecoratorNode = mod.$isInlineElementOrDecoratorNode;
  var $isLeafNode = mod.$isLeafNode;
  var $isLineBreakNode = mod.$isLineBreakNode;
  var $isNodeCaret = mod.$isNodeCaret;
  var $isNodeSelection = mod.$isNodeSelection;
  var $isParagraphNode = mod.$isParagraphNode;
  var $isRangeSelection = mod.$isRangeSelection;
  var $isRootNode = mod.$isRootNode;
  var $isRootOrShadowRoot = mod.$isRootOrShadowRoot;
  var $isSiblingCaret = mod.$isSiblingCaret;
  var $isTabNode = mod.$isTabNode;
  var $isTextNode = mod.$isTextNode;
  var $isTextPointCaret = mod.$isTextPointCaret;
  var $isTextPointCaretSlice = mod.$isTextPointCaretSlice;
  var $isTokenOrSegmented = mod.$isTokenOrSegmented;
  var $isTokenOrTab = mod.$isTokenOrTab;
  var $nodesOfType = mod.$nodesOfType;
  var $normalizeCaret = mod.$normalizeCaret;
  var $normalizeSelection__EXPERIMENTAL = mod.$normalizeSelection__EXPERIMENTAL;
  var $onUpdate = mod.$onUpdate;
  var $parseSerializedNode = mod.$parseSerializedNode;
  var $removeTextFromCaretRange = mod.$removeTextFromCaretRange;
  var $rewindSiblingCaret = mod.$rewindSiblingCaret;
  var $selectAll = mod.$selectAll;
  var $setCompositionKey = mod.$setCompositionKey;
  var $setPointFromCaret = mod.$setPointFromCaret;
  var $setSelection = mod.$setSelection;
  var $setSelectionFromCaretRange = mod.$setSelectionFromCaretRange;
  var $setState = mod.$setState;
  var $splitAtPointCaretNext = mod.$splitAtPointCaretNext;
  var $splitNode = mod.$splitNode;
  var $updateRangeSelectionFromCaretRange = mod.$updateRangeSelectionFromCaretRange;
  var ArtificialNode__DO_NOT_USE = mod.ArtificialNode__DO_NOT_USE;
  var BEFORE_INPUT_COMMAND = mod.BEFORE_INPUT_COMMAND;
  var BLUR_COMMAND = mod.BLUR_COMMAND;
  var CAN_REDO_COMMAND = mod.CAN_REDO_COMMAND;
  var CAN_UNDO_COMMAND = mod.CAN_UNDO_COMMAND;
  var CLEAR_EDITOR_COMMAND = mod.CLEAR_EDITOR_COMMAND;
  var CLEAR_HISTORY_COMMAND = mod.CLEAR_HISTORY_COMMAND;
  var CLICK_COMMAND = mod.CLICK_COMMAND;
  var COLLABORATION_TAG = mod.COLLABORATION_TAG;
  var COMMAND_PRIORITY_CRITICAL = mod.COMMAND_PRIORITY_CRITICAL;
  var COMMAND_PRIORITY_EDITOR = mod.COMMAND_PRIORITY_EDITOR;
  var COMMAND_PRIORITY_HIGH = mod.COMMAND_PRIORITY_HIGH;
  var COMMAND_PRIORITY_LOW = mod.COMMAND_PRIORITY_LOW;
  var COMMAND_PRIORITY_NORMAL = mod.COMMAND_PRIORITY_NORMAL;
  var COMPOSITION_END_COMMAND = mod.COMPOSITION_END_COMMAND;
  var COMPOSITION_START_COMMAND = mod.COMPOSITION_START_COMMAND;
  var CONTROLLED_TEXT_INSERTION_COMMAND = mod.CONTROLLED_TEXT_INSERTION_COMMAND;
  var COPY_COMMAND = mod.COPY_COMMAND;
  var CUT_COMMAND = mod.CUT_COMMAND;
  var DELETE_CHARACTER_COMMAND = mod.DELETE_CHARACTER_COMMAND;
  var DELETE_LINE_COMMAND = mod.DELETE_LINE_COMMAND;
  var DELETE_WORD_COMMAND = mod.DELETE_WORD_COMMAND;
  var DRAGEND_COMMAND = mod.DRAGEND_COMMAND;
  var DRAGOVER_COMMAND = mod.DRAGOVER_COMMAND;
  var DRAGSTART_COMMAND = mod.DRAGSTART_COMMAND;
  var DROP_COMMAND = mod.DROP_COMMAND;
  var DecoratorNode = mod.DecoratorNode;
  var ElementNode = mod.ElementNode;
  var FOCUS_COMMAND = mod.FOCUS_COMMAND;
  var FORMAT_ELEMENT_COMMAND = mod.FORMAT_ELEMENT_COMMAND;
  var FORMAT_TEXT_COMMAND = mod.FORMAT_TEXT_COMMAND;
  var HISTORIC_TAG = mod.HISTORIC_TAG;
  var HISTORY_MERGE_TAG = mod.HISTORY_MERGE_TAG;
  var HISTORY_PUSH_TAG = mod.HISTORY_PUSH_TAG;
  var INDENT_CONTENT_COMMAND = mod.INDENT_CONTENT_COMMAND;
  var INPUT_COMMAND = mod.INPUT_COMMAND;
  var INSERT_LINE_BREAK_COMMAND = mod.INSERT_LINE_BREAK_COMMAND;
  var INSERT_PARAGRAPH_COMMAND = mod.INSERT_PARAGRAPH_COMMAND;
  var INSERT_TAB_COMMAND = mod.INSERT_TAB_COMMAND;
  var INTERNAL_$isBlock = mod.INTERNAL_$isBlock;
  var IS_ALL_FORMATTING = mod.IS_ALL_FORMATTING;
  var IS_BOLD = mod.IS_BOLD;
  var IS_CODE = mod.IS_CODE;
  var IS_HIGHLIGHT = mod.IS_HIGHLIGHT;
  var IS_ITALIC = mod.IS_ITALIC;
  var IS_STRIKETHROUGH = mod.IS_STRIKETHROUGH;
  var IS_SUBSCRIPT = mod.IS_SUBSCRIPT;
  var IS_SUPERSCRIPT = mod.IS_SUPERSCRIPT;
  var IS_UNDERLINE = mod.IS_UNDERLINE;
  var KEY_ARROW_DOWN_COMMAND = mod.KEY_ARROW_DOWN_COMMAND;
  var KEY_ARROW_LEFT_COMMAND = mod.KEY_ARROW_LEFT_COMMAND;
  var KEY_ARROW_RIGHT_COMMAND = mod.KEY_ARROW_RIGHT_COMMAND;
  var KEY_ARROW_UP_COMMAND = mod.KEY_ARROW_UP_COMMAND;
  var KEY_BACKSPACE_COMMAND = mod.KEY_BACKSPACE_COMMAND;
  var KEY_DELETE_COMMAND = mod.KEY_DELETE_COMMAND;
  var KEY_DOWN_COMMAND = mod.KEY_DOWN_COMMAND;
  var KEY_ENTER_COMMAND = mod.KEY_ENTER_COMMAND;
  var KEY_ESCAPE_COMMAND = mod.KEY_ESCAPE_COMMAND;
  var KEY_MODIFIER_COMMAND = mod.KEY_MODIFIER_COMMAND;
  var KEY_SPACE_COMMAND = mod.KEY_SPACE_COMMAND;
  var KEY_TAB_COMMAND = mod.KEY_TAB_COMMAND;
  var LineBreakNode = mod.LineBreakNode;
  var MOVE_TO_END = mod.MOVE_TO_END;
  var MOVE_TO_START = mod.MOVE_TO_START;
  var NODE_STATE_KEY = mod.NODE_STATE_KEY;
  var OUTDENT_CONTENT_COMMAND = mod.OUTDENT_CONTENT_COMMAND;
  var PASTE_COMMAND = mod.PASTE_COMMAND;
  var PASTE_TAG = mod.PASTE_TAG;
  var ParagraphNode = mod.ParagraphNode;
  var REDO_COMMAND = mod.REDO_COMMAND;
  var REMOVE_TEXT_COMMAND = mod.REMOVE_TEXT_COMMAND;
  var RootNode = mod.RootNode;
  var SELECTION_CHANGE_COMMAND = mod.SELECTION_CHANGE_COMMAND;
  var SELECTION_INSERT_CLIPBOARD_NODES_COMMAND = mod.SELECTION_INSERT_CLIPBOARD_NODES_COMMAND;
  var SELECT_ALL_COMMAND = mod.SELECT_ALL_COMMAND;
  var SKIP_COLLAB_TAG = mod.SKIP_COLLAB_TAG;
  var SKIP_DOM_SELECTION_TAG = mod.SKIP_DOM_SELECTION_TAG;
  var SKIP_SCROLL_INTO_VIEW_TAG = mod.SKIP_SCROLL_INTO_VIEW_TAG;
  var SKIP_SELECTION_FOCUS_TAG = mod.SKIP_SELECTION_FOCUS_TAG;
  var TEXT_TYPE_TO_FORMAT = mod.TEXT_TYPE_TO_FORMAT;
  var TabNode = mod.TabNode;
  var TextNode = mod.TextNode;
  var UNDO_COMMAND = mod.UNDO_COMMAND;
  var buildImportMap = mod.buildImportMap;
  var configExtension = mod.configExtension;
  var createCommand = mod.createCommand;
  var createEditor = mod.createEditor;
  var createSharedNodeState = mod.createSharedNodeState;
  var createState = mod.createState;
  var declarePeerDependency = mod.declarePeerDependency;
  var defineExtension = mod.defineExtension;
  var flipDirection = mod.flipDirection;
  var getDOMOwnerDocument = mod.getDOMOwnerDocument;
  var getDOMSelection = mod.getDOMSelection;
  var getDOMSelectionFromTarget = mod.getDOMSelectionFromTarget;
  var getDOMTextNode = mod.getDOMTextNode;
  var getEditorPropertyFromDOMNode = mod.getEditorPropertyFromDOMNode;
  var getNearestEditorFromDOMNode = mod.getNearestEditorFromDOMNode;
  var getRegisteredNode = mod.getRegisteredNode;
  var getRegisteredNodeOrThrow = mod.getRegisteredNodeOrThrow;
  var getStaticNodeConfig = mod.getStaticNodeConfig;
  var getTextDirection = mod.getTextDirection;
  var getTransformSetFromKlass = mod.getTransformSetFromKlass;
  var isBlockDomNode = mod.isBlockDomNode;
  var isCurrentlyReadOnlyMode = mod.isCurrentlyReadOnlyMode;
  var isDOMDocumentNode = mod.isDOMDocumentNode;
  var isDOMNode = mod.isDOMNode;
  var isDOMTextNode = mod.isDOMTextNode;
  var isDOMUnmanaged = mod.isDOMUnmanaged;
  var isDocumentFragment = mod.isDocumentFragment;
  var isExactShortcutMatch = mod.isExactShortcutMatch;
  var isHTMLAnchorElement = mod.isHTMLAnchorElement;
  var isHTMLElement = mod.isHTMLElement;
  var isInlineDomNode = mod.isInlineDomNode;
  var isLexicalEditor = mod.isLexicalEditor;
  var isModifierMatch = mod.isModifierMatch;
  var isSelectionCapturedInDecoratorInput = mod.isSelectionCapturedInDecoratorInput;
  var isSelectionWithinEditor = mod.isSelectionWithinEditor;
  var makeStepwiseIterator = mod.makeStepwiseIterator;
  var removeFromParent = mod.removeFromParent;
  var resetRandomKey = mod.resetRandomKey;
  var safeCast = mod.safeCast;
  var setDOMUnmanaged = mod.setDOMUnmanaged;
  var setNodeIndentFromDOM = mod.setNodeIndentFromDOM;
  var shallowMergeConfig = mod.shallowMergeConfig;

  // node_modules/@lexical/selection/LexicalSelection.prod.mjs
  var LexicalSelection_prod_exports = {};
  __export(LexicalSelection_prod_exports, {
    $addNodeStyle: () => $2,
    $cloneWithProperties: () => $cloneWithProperties,
    $copyBlockFormatIndent: () => V2,
    $ensureForwardRangeSelection: () => H2,
    $forEachSelectedTextNode: () => j2,
    $getComputedStyleForElement: () => z2,
    $getComputedStyleForParent: () => O2,
    $getSelectionStyleValueForProperty: () => le2,
    $isAtNodeEnd: () => _2,
    $isParentElementRTL: () => te2,
    $isParentRTL: () => A2,
    $moveCaretSelection: () => ee2,
    $moveCharacter: () => ne2,
    $patchStyleText: () => U2,
    $selectAll: () => $selectAll,
    $setBlocksType: () => W2,
    $shouldOverrideDefaultCharacterSelection: () => Z2,
    $sliceSelectedTextNodeContent: () => M2,
    $trimTextContentFromAnchor: () => L2,
    $wrapNodes: () => G2,
    createDOMRange: () => I2,
    createRectsFromDOMRange: () => B2,
    getCSSFromStyleObject: () => R2,
    getStyleObjectFromCSS: () => b2,
    trimTextContentFromAnchor: () => re2
  });
  function K2(e2, ...t2) {
    const n2 = new URL("https://lexical.dev/docs/error"), o2 = new URLSearchParams();
    o2.append("code", e2);
    for (const e3 of t2) o2.append("v", e3);
    throw n2.search = o2.toString(), Error(`Minified Lexical error #${e2}; visit ${n2.toString()} for the full message or use the non-minified dev environment for full errors and additional helpful warnings.`);
  }
  var E2 = /* @__PURE__ */ new Map();
  function P2(e2) {
    let t2 = e2;
    for (; null != t2; ) {
      if (t2.nodeType === Node.TEXT_NODE) return t2;
      t2 = t2.firstChild;
    }
    return null;
  }
  function k2(e2) {
    const t2 = e2.parentNode;
    if (null == t2) throw new Error("Should never happen");
    return [t2, Array.from(t2.childNodes).indexOf(e2)];
  }
  function I2(t2, n2, o2, l3, r3) {
    const s4 = n2.getKey(), i3 = l3.getKey(), c3 = document.createRange();
    let f3 = t2.getElementByKey(s4), u3 = t2.getElementByKey(i3), g3 = o2, a3 = r3;
    if ($isTextNode(n2) && (f3 = P2(f3)), $isTextNode(l3) && (u3 = P2(u3)), void 0 === n2 || void 0 === l3 || null === f3 || null === u3) return null;
    "BR" === f3.nodeName && ([f3, g3] = k2(f3)), "BR" === u3.nodeName && ([u3, a3] = k2(u3));
    const d4 = f3.firstChild;
    f3 === u3 && null != d4 && "BR" === d4.nodeName && 0 === g3 && 0 === a3 && (a3 = 1);
    try {
      c3.setStart(f3, g3), c3.setEnd(u3, a3);
    } catch (e2) {
      return null;
    }
    return !c3.collapsed || g3 === a3 && s4 === i3 || (c3.setStart(u3, a3), c3.setEnd(f3, g3)), c3;
  }
  function B2(e2, t2) {
    const n2 = e2.getRootElement();
    if (null === n2) return [];
    const o2 = n2.getBoundingClientRect(), l3 = getComputedStyle(n2), r3 = parseFloat(l3.paddingLeft) + parseFloat(l3.paddingRight), s4 = Array.from(t2.getClientRects());
    let i3, c3 = s4.length;
    s4.sort((e3, t3) => {
      const n3 = e3.top - t3.top;
      return Math.abs(n3) <= 3 ? e3.left - t3.left : n3;
    });
    for (let e3 = 0; e3 < c3; e3++) {
      const t3 = s4[e3], n3 = i3 && i3.top <= t3.top && i3.top + i3.height > t3.top && i3.left + i3.width > t3.left, l4 = t3.width + r3 === o2.width;
      n3 || l4 ? (s4.splice(e3--, 1), c3--) : i3 = t3;
    }
    return s4;
  }
  function F2(e2) {
    const t2 = {};
    if (!e2) return t2;
    const n2 = e2.split(";");
    for (const e3 of n2) if ("" !== e3) {
      const [n3, o2] = e3.split(/:([^]+)/);
      n3 && o2 && (t2[n3.trim()] = o2.trim());
    }
    return t2;
  }
  function b2(e2) {
    let t2 = E2.get(e2);
    return void 0 === t2 && (t2 = F2(e2), E2.set(e2, t2)), t2;
  }
  function R2(e2) {
    let t2 = "";
    for (const n2 in e2) n2 && (t2 += `${n2}: ${e2[n2]};`);
    return t2;
  }
  function z2(e2) {
    const n2 = $getEditor().getElementByKey(e2.getKey());
    if (null === n2) return null;
    const o2 = n2.ownerDocument.defaultView;
    return null === o2 ? null : o2.getComputedStyle(n2);
  }
  function O2(e2) {
    return z2($isRootNode(e2) ? e2 : e2.getParentOrThrow());
  }
  function A2(e2) {
    const t2 = O2(e2);
    return null !== t2 && "rtl" === t2.direction;
  }
  function M2(e2, t2, n2 = "self") {
    const o2 = e2.getStartEndPoints();
    if (t2.isSelected(e2) && !$isTokenOrSegmented(t2) && null !== o2) {
      const [l3, r3] = o2, s4 = e2.isBackward(), i3 = l3.getNode(), c3 = r3.getNode(), f3 = t2.is(i3), u3 = t2.is(c3);
      if (f3 || u3) {
        const [o3, l4] = $getCharacterOffsets(e2), r4 = i3.is(c3), f4 = t2.is(s4 ? c3 : i3), u4 = t2.is(s4 ? i3 : c3);
        let d4, p3 = 0;
        if (r4) p3 = o3 > l4 ? l4 : o3, d4 = o3 > l4 ? o3 : l4;
        else if (f4) {
          p3 = s4 ? l4 : o3, d4 = void 0;
        } else if (u4) {
          p3 = 0, d4 = s4 ? o3 : l4;
        }
        const h2 = t2.__text.slice(p3, d4);
        h2 !== t2.__text && ("clone" === n2 && (t2 = $cloneWithPropertiesEphemeral(t2)), t2.__text = h2);
      }
    }
    return t2;
  }
  function _2(e2) {
    if ("text" === e2.type) return e2.offset === e2.getNode().getTextContentSize();
    const t2 = e2.getNode();
    return $isElementNode(t2) || K2(177), e2.offset === t2.getChildrenSize();
  }
  function L2(t2, c3, f3) {
    let u3 = c3.getNode(), g3 = f3;
    if ($isElementNode(u3)) {
      const e2 = u3.getDescendantByIndex(c3.offset);
      null !== e2 && (u3 = e2);
    }
    for (; g3 > 0 && null !== u3; ) {
      if ($isElementNode(u3)) {
        const e2 = u3.getLastDescendant();
        null !== e2 && (u3 = e2);
      }
      let f4 = u3.getPreviousSibling(), a3 = 0;
      if (null === f4) {
        let e2 = u3.getParentOrThrow(), t3 = e2.getPreviousSibling();
        for (; null === t3; ) {
          if (e2 = e2.getParent(), null === e2) {
            f4 = null;
            break;
          }
          t3 = e2.getPreviousSibling();
        }
        null !== e2 && (a3 = e2.isInline() ? 0 : 2, f4 = t3);
      }
      let d4 = u3.getTextContent();
      "" === d4 && $isElementNode(u3) && !u3.isInline() && (d4 = "\n\n");
      const p3 = d4.length;
      if (!$isTextNode(u3) || g3 >= p3) {
        const e2 = u3.getParent();
        u3.remove(), null == e2 || 0 !== e2.getChildrenSize() || $isRootNode(e2) || e2.remove(), g3 -= p3 + a3, u3 = f4;
      } else {
        const n2 = u3.getKey(), o2 = t2.getEditorState().read(() => {
          const t3 = $getNodeByKey(n2);
          return $isTextNode(t3) && t3.isSimpleText() ? t3.getTextContent() : null;
        }), f5 = p3 - g3, a4 = d4.slice(0, f5);
        if (null !== o2 && o2 !== d4) {
          const e2 = $getPreviousSelection();
          let t3 = u3;
          if (u3.isSimpleText()) u3.setTextContent(o2);
          else {
            const e3 = $createTextNode(o2);
            u3.replace(e3), t3 = e3;
          }
          if ($isRangeSelection(e2) && e2.isCollapsed()) {
            const n3 = e2.anchor.offset;
            t3.select(n3, n3);
          }
        } else if (u3.isSimpleText()) {
          const e2 = c3.key === n2;
          let t3 = c3.offset;
          t3 < g3 && (t3 = p3);
          const o3 = e2 ? t3 - g3 : 0, l3 = e2 ? t3 : f5;
          if (e2 && 0 === o3) {
            const [e3] = u3.splitText(o3, l3);
            e3.remove();
          } else {
            const [, e3] = u3.splitText(o3, l3);
            e3.remove();
          }
        } else {
          const e2 = $createTextNode(a4);
          u3.replace(e2);
        }
        g3 = 0;
      }
    }
  }
  function $2(e2) {
    const t2 = e2.getStyle(), n2 = F2(t2);
    E2.set(t2, n2);
  }
  function D2(t2, n2) {
    ($isRangeSelection(t2) ? t2.isCollapsed() : $isTextNode(t2) || $isElementNode(t2)) || K2(280);
    const l3 = b2($isRangeSelection(t2) ? t2.style : $isTextNode(t2) ? t2.getStyle() : t2.getTextStyle()), r3 = Object.entries(n2).reduce((e2, [n3, o2]) => ("function" == typeof o2 ? e2[n3] = o2(l3[n3], t2) : null === o2 ? delete e2[n3] : e2[n3] = o2, e2), { ...l3 }), s4 = R2(r3);
    $isRangeSelection(t2) || $isTextNode(t2) ? t2.setStyle(s4) : t2.setTextStyle(s4), E2.set(s4, r3);
  }
  function U2(e2, t2) {
    if ($isRangeSelection(e2) && e2.isCollapsed()) {
      D2(e2, t2);
      const n3 = e2.anchor.getNode();
      $isElementNode(n3) && n3.isEmpty() && D2(n3, t2);
    }
    j2((e3) => {
      D2(e3, t2);
    });
    const n2 = e2.getNodes();
    if (n2.length > 0) {
      const e3 = /* @__PURE__ */ new Set();
      for (const l3 of n2) {
        if (!$isElementNode(l3) || !l3.canBeEmpty() || 0 !== l3.getChildrenSize()) continue;
        const n3 = l3.getKey();
        e3.has(n3) || (e3.add(n3), D2(l3, t2));
      }
    }
  }
  function j2(t2) {
    const n2 = $getSelection();
    if (!n2) return;
    const o2 = /* @__PURE__ */ new Map(), l3 = (e2) => o2.get(e2.getKey()) || [0, e2.getTextContentSize()];
    if ($isRangeSelection(n2)) for (const e2 of $caretRangeFromSelection(n2).getTextSlices()) e2 && o2.set(e2.caret.origin.getKey(), e2.getSliceIndices());
    const r3 = n2.getNodes();
    for (const n3 of r3) {
      if (!$isTextNode(n3) || !n3.canHaveFormat()) continue;
      const [o3, r4] = l3(n3);
      if (r4 !== o3) if ($isTokenOrSegmented(n3) || 0 === o3 && r4 === n3.getTextContentSize()) t2(n3);
      else {
        t2(n3.splitText(o3, r4)[0 === o3 ? 0 : 1]);
      }
    }
    $isRangeSelection(n2) && "text" === n2.anchor.type && "text" === n2.focus.type && n2.anchor.key === n2.focus.key && H2(n2);
  }
  function H2(e2) {
    if (e2.isBackward()) {
      const { anchor: t2, focus: n2 } = e2, { key: o2, offset: l3, type: r3 } = t2;
      t2.set(n2.key, n2.offset, n2.type), n2.set(o2, l3, r3);
    }
  }
  function V2(e2, t2) {
    const n2 = e2.getFormatType(), o2 = e2.getIndent();
    n2 !== t2.getFormatType() && t2.setFormat(n2), o2 !== t2.getIndent() && t2.setIndent(o2);
  }
  function W2(e2, t2, n2 = V2) {
    if (null === e2) return;
    const l3 = e2.getStartEndPoints(), r3 = /* @__PURE__ */ new Map();
    let s4 = null;
    if (l3) {
      const [e3, t3] = l3;
      s4 = $createRangeSelection(), s4.anchor.set(e3.key, e3.offset, e3.type), s4.focus.set(t3.key, t3.offset, t3.type);
      const n3 = $findMatchingParent(e3.getNode(), INTERNAL_$isBlock), i3 = $findMatchingParent(t3.getNode(), INTERNAL_$isBlock);
      $isElementNode(n3) && r3.set(n3.getKey(), n3), $isElementNode(i3) && r3.set(i3.getKey(), i3);
    }
    for (const t3 of e2.getNodes()) if ($isElementNode(t3) && INTERNAL_$isBlock(t3)) r3.set(t3.getKey(), t3);
    else if (null === l3) {
      const e3 = $findMatchingParent(t3, INTERNAL_$isBlock);
      $isElementNode(e3) && r3.set(e3.getKey(), e3);
    }
    for (const [e3, o2] of r3) {
      const l4 = t2();
      n2(o2, l4), o2.replace(l4, true), s4 && (e3 === s4.anchor.key && s4.anchor.set(l4.getKey(), s4.anchor.offset, s4.anchor.type), e3 === s4.focus.key && s4.focus.set(l4.getKey(), s4.focus.offset, s4.focus.type));
    }
    s4 && e2.is($getSelection()) && $setSelection(s4);
  }
  function X2(e2) {
    return e2.getNode().isAttached();
  }
  function q2(e2) {
    let t2 = e2;
    for (; null !== t2 && !$isRootOrShadowRoot(t2); ) {
      const e3 = t2.getLatest(), n2 = t2.getParent();
      0 === e3.getChildrenSize() && t2.remove(true), t2 = n2;
    }
  }
  function G2(e2, t2, n2 = null) {
    const o2 = e2.getStartEndPoints(), l3 = o2 ? o2[0] : null, r3 = e2.getNodes(), s4 = r3.length;
    if (null !== l3 && (0 === s4 || 1 === s4 && "element" === l3.type && 0 === l3.getNode().getChildrenSize())) {
      const e3 = "text" === l3.type ? l3.getNode().getParentOrThrow() : l3.getNode(), o3 = e3.getChildren();
      let r4 = t2();
      return r4.setFormat(e3.getFormatType()), r4.setIndent(e3.getIndent()), o3.forEach((e4) => r4.append(e4)), n2 && (r4 = n2.append(r4)), void e3.replace(r4);
    }
    let i3 = null, c3 = [];
    for (let o3 = 0; o3 < s4; o3++) {
      const l4 = r3[o3];
      $isRootOrShadowRoot(l4) ? (J2(e2, c3, c3.length, t2, n2), c3 = [], i3 = l4) : null === i3 || null !== i3 && $hasAncestor(l4, i3) ? c3.push(l4) : (J2(e2, c3, c3.length, t2, n2), c3 = [l4]);
    }
    J2(e2, c3, c3.length, t2, n2);
  }
  function J2(e2, t2, n2, l3, s4 = null) {
    if (0 === t2.length) return;
    const c3 = t2[0], f3 = /* @__PURE__ */ new Map(), u3 = [];
    let g3 = $isElementNode(c3) ? c3 : c3.getParentOrThrow();
    g3.isInline() && (g3 = g3.getParentOrThrow());
    let a3 = false;
    for (; null !== g3; ) {
      const e3 = g3.getPreviousSibling();
      if (null !== e3) {
        g3 = e3, a3 = true;
        break;
      }
      if (g3 = g3.getParentOrThrow(), $isRootOrShadowRoot(g3)) break;
    }
    const d4 = /* @__PURE__ */ new Set();
    for (let e3 = 0; e3 < n2; e3++) {
      const n3 = t2[e3];
      $isElementNode(n3) && 0 === n3.getChildrenSize() && d4.add(n3.getKey());
    }
    const p3 = /* @__PURE__ */ new Set();
    for (let e3 = 0; e3 < n2; e3++) {
      const n3 = t2[e3];
      let r3 = n3.getParent();
      if (null !== r3 && r3.isInline() && (r3 = r3.getParent()), null !== r3 && $isLeafNode(n3) && !p3.has(n3.getKey())) {
        const e4 = r3.getKey();
        if (void 0 === f3.get(e4)) {
          const t3 = l3();
          t3.setFormat(r3.getFormatType()), t3.setIndent(r3.getIndent()), u3.push(t3), f3.set(e4, t3), r3.getChildren().forEach((e5) => {
            t3.append(e5), p3.add(e5.getKey()), $isElementNode(e5) && e5.getChildrenKeys().forEach((e6) => p3.add(e6));
          }), q2(r3);
        }
      } else if (d4.has(n3.getKey())) {
        $isElementNode(n3) || K2(179);
        const e4 = l3();
        e4.setFormat(n3.getFormatType()), e4.setIndent(n3.getIndent()), u3.push(e4), n3.remove(true);
      }
    }
    if (null !== s4) for (let e3 = 0; e3 < u3.length; e3++) {
      const t3 = u3[e3];
      s4.append(t3);
    }
    let h2 = null;
    if ($isRootOrShadowRoot(g3)) if (a3) if (null !== s4) g3.insertAfter(s4);
    else for (let e3 = u3.length - 1; e3 >= 0; e3--) {
      const t3 = u3[e3];
      g3.insertAfter(t3);
    }
    else {
      const e3 = g3.getFirstChild();
      if ($isElementNode(e3) && (g3 = e3), null === e3) if (s4) g3.append(s4);
      else for (let e4 = 0; e4 < u3.length; e4++) {
        const t3 = u3[e4];
        g3.append(t3), h2 = t3;
      }
      else if (null !== s4) e3.insertBefore(s4);
      else for (let t3 = 0; t3 < u3.length; t3++) {
        const n3 = u3[t3];
        e3.insertBefore(n3), h2 = n3;
      }
    }
    else if (s4) g3.insertAfter(s4);
    else for (let e3 = u3.length - 1; e3 >= 0; e3--) {
      const t3 = u3[e3];
      g3.insertAfter(t3), h2 = t3;
    }
    const m3 = $getPreviousSelection();
    $isRangeSelection(m3) && X2(m3.anchor) && X2(m3.focus) ? $setSelection(m3.clone()) : null !== h2 ? h2.selectEnd() : e2.dirty = true;
  }
  function Q2(e2) {
    const t2 = Y2(e2);
    return null !== t2 && "vertical-rl" === t2.writingMode;
  }
  function Y2(e2) {
    const t2 = e2.anchor.getNode();
    return $isElementNode(t2) ? z2(t2) : O2(t2);
  }
  function Z2(e2, t2) {
    let n2 = Q2(e2) ? !t2 : t2;
    te2(e2) && (n2 = !n2);
    const l3 = $caretFromPoint(e2.focus, n2 ? "previous" : "next");
    if ($isExtendableTextPointCaret(l3)) return false;
    for (const e3 of $extendCaretToRange(l3)) {
      if ($isChildCaret(e3)) return !e3.origin.isInline();
      if (!$isElementNode(e3.origin)) {
        if ($isDecoratorNode(e3.origin)) return true;
        break;
      }
    }
    return false;
  }
  function ee2(e2, t2, n2, o2) {
    e2.modify(t2 ? "extend" : "move", n2, o2);
  }
  function te2(e2) {
    const t2 = Y2(e2);
    return null !== t2 && "rtl" === t2.direction;
  }
  function ne2(e2, t2, n2) {
    const o2 = te2(e2);
    let l3;
    l3 = Q2(e2) || o2 ? !n2 : n2, ee2(e2, t2, l3, "character");
  }
  function oe2(e2, t2, n2) {
    const o2 = b2(e2.getStyle());
    return null !== o2 && o2[t2] || n2;
  }
  function le2(t2, n2, o2 = "") {
    let l3 = null;
    const r3 = t2.getNodes(), s4 = t2.anchor, c3 = t2.focus, f3 = t2.isBackward(), u3 = f3 ? c3.offset : s4.offset, g3 = f3 ? c3.getNode() : s4.getNode();
    if ($isRangeSelection(t2) && t2.isCollapsed() && "" !== t2.style) {
      const e2 = b2(t2.style);
      if (null !== e2 && n2 in e2) return e2[n2];
    }
    for (let t3 = 0; t3 < r3.length; t3++) {
      const s5 = r3[t3];
      if ((0 === t3 || 0 !== u3 || !s5.is(g3)) && $isTextNode(s5)) {
        const e2 = oe2(s5, n2, o2);
        if (null === l3) l3 = e2;
        else if (l3 !== e2) {
          l3 = "";
          break;
        }
      }
    }
    return null === l3 ? o2 : l3;
  }
  var re2 = L2;

  // node_modules/@lexical/selection/LexicalSelection.mjs
  var mod2 = false ? LexicalSelection_dev_exports : LexicalSelection_prod_exports;
  var $addNodeStyle = mod2.$addNodeStyle;
  var $cloneWithProperties2 = mod2.$cloneWithProperties;
  var $copyBlockFormatIndent = mod2.$copyBlockFormatIndent;
  var $ensureForwardRangeSelection = mod2.$ensureForwardRangeSelection;
  var $forEachSelectedTextNode = mod2.$forEachSelectedTextNode;
  var $getComputedStyleForElement = mod2.$getComputedStyleForElement;
  var $getComputedStyleForParent = mod2.$getComputedStyleForParent;
  var $getSelectionStyleValueForProperty = mod2.$getSelectionStyleValueForProperty;
  var $isAtNodeEnd = mod2.$isAtNodeEnd;
  var $isParentElementRTL = mod2.$isParentElementRTL;
  var $isParentRTL = mod2.$isParentRTL;
  var $moveCaretSelection = mod2.$moveCaretSelection;
  var $moveCharacter = mod2.$moveCharacter;
  var $patchStyleText = mod2.$patchStyleText;
  var $selectAll2 = mod2.$selectAll;
  var $setBlocksType = mod2.$setBlocksType;
  var $shouldOverrideDefaultCharacterSelection = mod2.$shouldOverrideDefaultCharacterSelection;
  var $sliceSelectedTextNodeContent = mod2.$sliceSelectedTextNodeContent;
  var $trimTextContentFromAnchor = mod2.$trimTextContentFromAnchor;
  var $wrapNodes = mod2.$wrapNodes;
  var createDOMRange = mod2.createDOMRange;
  var createRectsFromDOMRange = mod2.createRectsFromDOMRange;
  var getCSSFromStyleObject = mod2.getCSSFromStyleObject;
  var getStyleObjectFromCSS = mod2.getStyleObjectFromCSS;
  var trimTextContentFromAnchor = mod2.trimTextContentFromAnchor;

  // node_modules/@lexical/utils/LexicalUtils.prod.mjs
  var LexicalUtils_prod_exports = {};
  __export(LexicalUtils_prod_exports, {
    $descendantsMatching: () => $t2,
    $dfs: () => at2,
    $dfsIterator: () => gt2,
    $filter: () => Nt2,
    $findMatchingParent: () => $findMatchingParent,
    $firstToLastIterator: () => Kt2,
    $getAdjacentCaret: () => ft2,
    $getAdjacentSiblingOrParentSiblingCaret: () => $getAdjacentSiblingOrParentSiblingCaret,
    $getDepth: () => vt2,
    $getNearestBlockElementAncestorOrThrow: () => Et2,
    $getNearestNodeOfType: () => xt2,
    $getNextRightPreorderNode: () => yt2,
    $getNextSiblingOrParentSibling: () => ht2,
    $insertFirst: () => Mt2,
    $insertNodeToNearestRoot: () => Ct2,
    $insertNodeToNearestRootAtCaret: () => bt2,
    $isEditorIsNestedEditor: () => Bt2,
    $lastToFirstIterator: () => Ot2,
    $restoreEditorState: () => At2,
    $reverseDfs: () => dt2,
    $reverseDfsIterator: () => wt2,
    $splitNode: () => $splitNode,
    $unwrapAndFilterDescendants: () => _t2,
    $unwrapNode: () => jt2,
    $wrapNodeInElement: () => Lt2,
    CAN_USE_BEFORE_INPUT: () => Q3,
    CAN_USE_DOM: () => X3,
    IS_ANDROID: () => Y3,
    IS_ANDROID_CHROME: () => Z3,
    IS_APPLE: () => tt2,
    IS_APPLE_WEBKIT: () => et2,
    IS_CHROME: () => nt2,
    IS_FIREFOX: () => ot2,
    IS_IOS: () => rt2,
    IS_SAFARI: () => it2,
    addClassNamesToElement: () => lt2,
    calculateZoomLevel: () => Tt2,
    isBlockDomNode: () => isBlockDomNode,
    isHTMLAnchorElement: () => isHTMLAnchorElement,
    isHTMLElement: () => isHTMLElement,
    isInlineDomNode: () => isInlineDomNode,
    isMimeType: () => st2,
    makeStateWrapper: () => Dt2,
    markSelection: () => q3,
    mediaFileReader: () => ct2,
    mergeRegister: () => U3,
    objectKlassEquals: () => Pt2,
    positionNodeOnRange: () => W3,
    registerNestedElementResolver: () => St2,
    removeClassNamesFromElement: () => ut2,
    selectionAlwaysOnDisplay: () => J3
  });
  function R3(t2, ...e2) {
    const n2 = new URL("https://lexical.dev/docs/error"), o2 = new URLSearchParams();
    o2.append("code", t2);
    for (const t3 of e2) o2.append("v", t3);
    throw n2.search = o2.toString(), Error(`Minified Lexical error #${t2}; visit ${n2.toString()} for the full message or use the non-minified dev environment for full errors and additional helpful warnings.`);
  }
  var T2 = "undefined" != typeof window && void 0 !== window.document && void 0 !== window.document.createElement;
  var B3 = T2 && "documentMode" in document ? document.documentMode : null;
  var _3 = T2 && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
  var k3 = T2 && /^(?!.*Seamonkey)(?=.*Firefox).*/i.test(navigator.userAgent);
  var $3 = !(!T2 || !("InputEvent" in window) || B3) && "getTargetRanges" in new window.InputEvent("input");
  var K3 = T2 && /Version\/[\d.]+.*Safari/.test(navigator.userAgent);
  var O3 = T2 && /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  var H3 = T2 && /Android/.test(navigator.userAgent);
  var j3 = T2 && /^(?=.*Chrome).*/i.test(navigator.userAgent);
  var D3 = T2 && H3 && j3;
  var I3 = T2 && /AppleWebKit\/[\d.]+/.test(navigator.userAgent) && _3 && !j3;
  function F3(...t2) {
    const e2 = [];
    for (const n2 of t2) if (n2 && "string" == typeof n2) for (const [t3] of n2.matchAll(/\S+/g)) e2.push(t3);
    return e2;
  }
  function U3(...t2) {
    return () => {
      for (let e2 = t2.length - 1; e2 >= 0; e2--) t2[e2]();
      t2.length = 0;
    };
  }
  function z3(t2) {
    return `${t2}px`;
  }
  var V3 = { attributes: true, characterData: true, childList: true, subtree: true };
  function W3(e2, n2, o2) {
    let r3 = null, i3 = null, l3 = null, u3 = [];
    const s4 = document.createElement("div");
    function c3() {
      null === r3 && R3(182), null === i3 && R3(183);
      const { left: t2, top: l4 } = i3.getBoundingClientRect(), c4 = createRectsFromDOMRange(e2, n2);
      var a4, f4;
      s4.isConnected || (f4 = s4, (a4 = i3).insertBefore(f4, a4.firstChild));
      let d4 = false;
      for (let e3 = 0; e3 < c4.length; e3++) {
        const n3 = c4[e3], o3 = u3[e3] || document.createElement("div"), r4 = o3.style;
        "absolute" !== r4.position && (r4.position = "absolute", d4 = true);
        const i4 = z3(n3.left - t2);
        r4.left !== i4 && (r4.left = i4, d4 = true);
        const a5 = z3(n3.top - l4);
        r4.top !== a5 && (o3.style.top = a5, d4 = true);
        const f5 = z3(n3.width);
        r4.width !== f5 && (o3.style.width = f5, d4 = true);
        const g3 = z3(n3.height);
        r4.height !== g3 && (o3.style.height = g3, d4 = true), o3.parentNode !== s4 && (s4.append(o3), d4 = true), u3[e3] = o3;
      }
      for (; u3.length > c4.length; ) u3.pop();
      d4 && o2(u3);
    }
    function a3() {
      i3 = null, r3 = null, null !== l3 && l3.disconnect(), l3 = null, s4.remove();
      for (const t2 of u3) t2.remove();
      u3 = [];
    }
    s4.style.position = "relative";
    const f3 = e2.registerRootListener(function n3() {
      const o3 = e2.getRootElement();
      if (null === o3) return a3();
      const u4 = o3.parentElement;
      if (!isHTMLElement(u4)) return a3();
      a3(), r3 = o3, i3 = u4, l3 = new MutationObserver((t2) => {
        const o4 = e2.getRootElement(), l4 = o4 && o4.parentElement;
        if (o4 !== r3 || l4 !== i3) return n3();
        for (const e3 of t2) if (!s4.contains(e3.target)) return c3();
      }), l3.observe(u4, V3), c3();
    });
    return () => {
      f3(), a3();
    };
  }
  function G3(t2, e2, n2) {
    if ("text" !== t2.type && $isElementNode(e2)) {
      const o2 = e2.getDOMSlot(n2);
      return [o2.element, o2.getFirstChildOffset() + t2.offset];
    }
    return [getDOMTextNode(n2) || n2, t2.offset];
  }
  function q3(t2, o2) {
    let r3 = null, i3 = null, l3 = null, u3 = null, s4 = null, c3 = null, a3 = () => {
    };
    function f3(f4) {
      f4.read(() => {
        const f5 = $getSelection();
        if (!$isRangeSelection(f5)) return r3 = null, l3 = null, u3 = null, c3 = null, a3(), void (a3 = () => {
        });
        const [d4, g3] = (function(t3) {
          const e2 = t3.getStartEndPoints();
          return t3.isBackward() ? [e2[1], e2[0]] : e2;
        })(f5), p3 = d4.getNode(), m3 = p3.getKey(), h2 = d4.offset, v4 = g3.getNode(), y4 = v4.getKey(), w5 = g3.offset, x4 = t2.getElementByKey(m3), E6 = t2.getElementByKey(y4), S3 = null === r3 || x4 !== i3 || h2 !== l3 || m3 !== r3.getKey(), A5 = null === u3 || E6 !== s4 || w5 !== c3 || y4 !== u3.getKey();
        if ((S3 || A5) && null !== x4 && null !== E6) {
          const e2 = (function(t3, e3, n2, o3, r4, i4, l4) {
            const u4 = (t3._window ? t3._window.document : document).createRange();
            return u4.setStart(...G3(e3, n2, o3)), u4.setEnd(...G3(r4, i4, l4)), u4;
          })(t2, d4, p3, x4, g3, v4, E6);
          a3(), a3 = W3(t2, e2, (t3) => {
            if (void 0 === o2) for (const e3 of t3) {
              const t4 = e3.style;
              "Highlight" !== t4.background && (t4.background = "Highlight"), "HighlightText" !== t4.color && (t4.color = "HighlightText"), t4.marginTop !== z3(-1.5) && (t4.marginTop = z3(-1.5)), t4.paddingTop !== z3(4) && (t4.paddingTop = z3(4)), t4.paddingBottom !== z3(0) && (t4.paddingBottom = z3(0));
            }
            else o2(t3);
          });
        }
        r3 = p3, i3 = x4, l3 = h2, u3 = v4, s4 = E6, c3 = w5;
      });
    }
    return f3(t2.getEditorState()), U3(t2.registerUpdateListener(({ editorState: t3 }) => f3(t3)), () => {
      a3();
    });
  }
  function J3(t2) {
    let e2 = null;
    const n2 = () => {
      const n3 = getSelection(), o2 = n3 && n3.anchorNode, r3 = t2.getRootElement();
      null !== o2 && null !== r3 && r3.contains(o2) ? null !== e2 && (e2(), e2 = null) : null === e2 && (e2 = q3(t2));
    };
    return document.addEventListener("selectionchange", n2), () => {
      null !== e2 && e2(), document.removeEventListener("selectionchange", n2);
    };
  }
  var Q3 = $3;
  var X3 = T2;
  var Y3 = H3;
  var Z3 = D3;
  var tt2 = _3;
  var et2 = I3;
  var nt2 = j3;
  var ot2 = k3;
  var rt2 = O3;
  var it2 = K3;
  function lt2(t2, ...e2) {
    const n2 = F3(...e2);
    n2.length > 0 && t2.classList.add(...n2);
  }
  function ut2(t2, ...e2) {
    const n2 = F3(...e2);
    n2.length > 0 && t2.classList.remove(...n2);
  }
  function st2(t2, e2) {
    for (const n2 of e2) if (t2.type.startsWith(n2)) return true;
    return false;
  }
  function ct2(t2, e2) {
    const n2 = t2[Symbol.iterator]();
    return new Promise((t3, o2) => {
      const r3 = [], i3 = () => {
        const { done: l3, value: u3 } = n2.next();
        if (l3) return t3(r3);
        const s4 = new FileReader();
        s4.addEventListener("error", o2), s4.addEventListener("load", () => {
          const t4 = s4.result;
          "string" == typeof t4 && r3.push({ file: u3, result: t4 }), i3();
        }), st2(u3, e2) ? s4.readAsDataURL(u3) : i3();
      };
      i3();
    });
  }
  function at2(t2, e2) {
    return Array.from(gt2(t2, e2));
  }
  function ft2(t2) {
    return t2 ? t2.getAdjacentCaret() : null;
  }
  function dt2(t2, e2) {
    return Array.from(wt2(t2, e2));
  }
  function gt2(t2, e2) {
    return mt2("next", t2, e2);
  }
  function pt2(t2, e2) {
    const n2 = $getAdjacentSiblingOrParentSiblingCaret($getSiblingCaret(t2, e2));
    return n2 && n2[0];
  }
  function mt2(t2, e2, n2) {
    const r3 = $getRoot(), s4 = e2 || r3, c3 = $isElementNode(s4) ? $getChildCaret(s4, t2) : $getSiblingCaret(s4, t2), a3 = vt2(s4), f3 = n2 ? $getAdjacentChildCaret($getChildCaretOrSelf($getSiblingCaret(n2, t2))) || pt2(n2, t2) : pt2(s4, t2);
    let d4 = a3;
    return makeStepwiseIterator({ hasNext: (t3) => null !== t3, initial: c3, map: (t3) => ({ depth: d4, node: t3.origin }), step: (t3) => {
      if (t3.isSameNodeCaret(f3)) return null;
      $isChildCaret(t3) && d4++;
      const e3 = $getAdjacentSiblingOrParentSiblingCaret(t3);
      return !e3 || e3[0].isSameNodeCaret(f3) ? null : (d4 += e3[1], e3[0]);
    } });
  }
  function ht2(t2) {
    const e2 = $getAdjacentSiblingOrParentSiblingCaret($getSiblingCaret(t2, "next"));
    return e2 && [e2[0].origin, e2[1]];
  }
  function vt2(t2) {
    let e2 = -1;
    for (let n2 = t2; null !== n2; n2 = n2.getParent()) e2++;
    return e2;
  }
  function yt2(t2) {
    const e2 = $getChildCaretOrSelf($getSiblingCaret(t2, "previous")), n2 = $getAdjacentSiblingOrParentSiblingCaret(e2, "root");
    return n2 && n2[0].origin;
  }
  function wt2(t2, e2) {
    return mt2("previous", t2, e2);
  }
  function xt2(t2, e2) {
    let n2 = t2;
    for (; null != n2; ) {
      if (n2 instanceof e2) return n2;
      n2 = n2.getParent();
    }
    return null;
  }
  function Et2(t2) {
    const e2 = $findMatchingParent(t2, (t3) => $isElementNode(t3) && !t3.isInline());
    return $isElementNode(e2) || R3(4, t2.__key), e2;
  }
  function St2(t2, e2, n2, o2) {
    const r3 = (t3) => t3 instanceof e2;
    return t2.registerNodeTransform(e2, (t3) => {
      const e3 = ((t4) => {
        const e4 = t4.getChildren();
        for (let t5 = 0; t5 < e4.length; t5++) {
          const n4 = e4[t5];
          if (r3(n4)) return null;
        }
        let n3 = t4, o3 = t4;
        for (; null !== n3; ) if (o3 = n3, n3 = n3.getParent(), r3(n3)) return { child: o3, parent: n3 };
        return null;
      })(t3);
      if (null !== e3) {
        const { child: r4, parent: i3 } = e3;
        if (r4.is(t3)) {
          o2(i3, t3);
          const e4 = r4.getNextSiblings(), l3 = e4.length;
          if (i3.insertAfter(r4), 0 !== l3) {
            const t4 = n2(i3);
            r4.insertAfter(t4);
            for (let n3 = 0; n3 < l3; n3++) t4.append(e4[n3]);
          }
          i3.canBeEmpty() || 0 !== i3.getChildrenSize() || i3.remove();
        }
      }
    });
  }
  function At2(t2, e2) {
    const n2 = /* @__PURE__ */ new Map(), o2 = t2._pendingEditorState;
    for (const [t3, o3] of e2._nodeMap) n2.set(t3, $cloneWithProperties(o3));
    o2 && (o2._nodeMap = n2), t2._dirtyType = 2;
    const r3 = e2._selection;
    $setSelection(null === r3 ? null : r3.clone());
  }
  function Ct2(t2) {
    const o2 = $getSelection() || $getPreviousSelection();
    let r3;
    if ($isRangeSelection(o2)) r3 = $caretFromPoint(o2.focus, "next");
    else {
      if (null != o2) {
        const t3 = o2.getNodes(), e2 = t3[t3.length - 1];
        e2 && (r3 = $getSiblingCaret(e2, "next"));
      }
      r3 = r3 || $getChildCaret($getRoot(), "previous").getFlipped().insert($createParagraphNode());
    }
    const i3 = bt2(t2, r3), u3 = $getAdjacentChildCaret(i3), s4 = $isChildCaret(u3) ? $normalizeCaret(u3) : i3;
    return $setSelectionFromCaretRange($getCollapsedCaretRange(s4)), t2.getLatest();
  }
  function bt2(t2, e2, n2) {
    let o2 = $getCaretInDirection(e2, "next");
    for (let t3 = o2; t3; t3 = $splitAtPointCaretNext(t3, n2)) o2 = t3;
    return $isTextPointCaret(o2) && R3(283), o2.insert(t2.isInline() ? $createParagraphNode().append(t2) : t2), $getCaretInDirection($getSiblingCaret(t2.getLatest(), "next"), e2.direction);
  }
  function Lt2(t2, e2) {
    const n2 = e2();
    return t2.replace(n2), n2.append(t2), n2;
  }
  function Pt2(t2, e2) {
    return null !== t2 && Object.getPrototypeOf(t2).constructor.name === e2.name;
  }
  function Nt2(t2, e2) {
    const n2 = [];
    for (let o2 = 0; o2 < t2.length; o2++) {
      const r3 = e2(t2[o2]);
      null !== r3 && n2.push(r3);
    }
    return n2;
  }
  function Mt2(t2, e2) {
    $getChildCaret(t2, "next").insert(e2);
  }
  var Rt2 = !(ot2 || !X3) && void 0;
  function Tt2(t2) {
    let e2 = 1;
    if ((function() {
      if (void 0 === Rt2) {
        const t3 = document.createElement("div");
        t3.style.cssText = "position: absolute; opacity: 0; width: 100px; left: -1000px;", document.body.appendChild(t3);
        const e3 = t3.getBoundingClientRect();
        t3.style.setProperty("zoom", "2"), Rt2 = t3.getBoundingClientRect().width === e3.width, document.body.removeChild(t3);
      }
      return Rt2;
    })()) for (; t2; ) e2 *= Number(window.getComputedStyle(t2).getPropertyValue("zoom")), t2 = t2.parentElement;
    return e2;
  }
  function Bt2(t2) {
    return null !== t2._parentEditor;
  }
  function _t2(t2, e2) {
    return kt2(t2, e2, null);
  }
  function kt2(t2, e2, n2) {
    let r3 = false;
    for (const i3 of Ot2(t2)) e2(i3) ? null !== n2 && n2(i3) : (r3 = true, $isElementNode(i3) && kt2(i3, e2, n2 || ((t3) => i3.insertAfter(t3))), i3.remove());
    return r3;
  }
  function $t2(t2, e2) {
    const n2 = [], r3 = Array.from(t2).reverse();
    for (let t3 = r3.pop(); void 0 !== t3; t3 = r3.pop()) if (e2(t3)) n2.push(t3);
    else if ($isElementNode(t3)) for (const e3 of Ot2(t3)) r3.push(e3);
    return n2;
  }
  function Kt2(t2) {
    return Ht2($getChildCaret(t2, "next"));
  }
  function Ot2(t2) {
    return Ht2($getChildCaret(t2, "previous"));
  }
  function Ht2(t2) {
    return makeStepwiseIterator({ hasNext: $isSiblingCaret, initial: t2.getAdjacentCaret(), map: (t3) => t3.origin.getLatest(), step: (t3) => t3.getAdjacentCaret() });
  }
  function jt2(t2) {
    $rewindSiblingCaret($getSiblingCaret(t2, "next")).splice(1, t2.getChildren());
  }
  function Dt2(t2) {
    const e2 = (e3) => $getState(e3, t2), n2 = (e3, n3) => $setState(e3, t2, n3);
    return { $get: e2, $set: n2, accessors: [e2, n2], makeGetterMethod: () => function() {
      return e2(this);
    }, makeSetterMethod: () => function(t3) {
      return n2(this, t3);
    }, stateConfig: t2 };
  }

  // node_modules/@lexical/utils/LexicalUtils.mjs
  var mod3 = false ? LexicalUtils_dev_exports : LexicalUtils_prod_exports;
  var $descendantsMatching = mod3.$descendantsMatching;
  var $dfs = mod3.$dfs;
  var $dfsIterator = mod3.$dfsIterator;
  var $filter = mod3.$filter;
  var $findMatchingParent2 = mod3.$findMatchingParent;
  var $firstToLastIterator = mod3.$firstToLastIterator;
  var $getAdjacentCaret = mod3.$getAdjacentCaret;
  var $getAdjacentSiblingOrParentSiblingCaret2 = mod3.$getAdjacentSiblingOrParentSiblingCaret;
  var $getDepth = mod3.$getDepth;
  var $getNearestBlockElementAncestorOrThrow = mod3.$getNearestBlockElementAncestorOrThrow;
  var $getNearestNodeOfType = mod3.$getNearestNodeOfType;
  var $getNextRightPreorderNode = mod3.$getNextRightPreorderNode;
  var $getNextSiblingOrParentSibling = mod3.$getNextSiblingOrParentSibling;
  var $insertFirst = mod3.$insertFirst;
  var $insertNodeToNearestRoot = mod3.$insertNodeToNearestRoot;
  var $insertNodeToNearestRootAtCaret = mod3.$insertNodeToNearestRootAtCaret;
  var $isEditorIsNestedEditor = mod3.$isEditorIsNestedEditor;
  var $lastToFirstIterator = mod3.$lastToFirstIterator;
  var $restoreEditorState = mod3.$restoreEditorState;
  var $reverseDfs = mod3.$reverseDfs;
  var $reverseDfsIterator = mod3.$reverseDfsIterator;
  var $splitNode2 = mod3.$splitNode;
  var $unwrapAndFilterDescendants = mod3.$unwrapAndFilterDescendants;
  var $unwrapNode = mod3.$unwrapNode;
  var $wrapNodeInElement = mod3.$wrapNodeInElement;
  var CAN_USE_BEFORE_INPUT = mod3.CAN_USE_BEFORE_INPUT;
  var CAN_USE_DOM = mod3.CAN_USE_DOM;
  var IS_ANDROID = mod3.IS_ANDROID;
  var IS_ANDROID_CHROME = mod3.IS_ANDROID_CHROME;
  var IS_APPLE = mod3.IS_APPLE;
  var IS_APPLE_WEBKIT = mod3.IS_APPLE_WEBKIT;
  var IS_CHROME = mod3.IS_CHROME;
  var IS_FIREFOX = mod3.IS_FIREFOX;
  var IS_IOS = mod3.IS_IOS;
  var IS_SAFARI = mod3.IS_SAFARI;
  var addClassNamesToElement = mod3.addClassNamesToElement;
  var calculateZoomLevel = mod3.calculateZoomLevel;
  var isBlockDomNode2 = mod3.isBlockDomNode;
  var isHTMLAnchorElement2 = mod3.isHTMLAnchorElement;
  var isHTMLElement2 = mod3.isHTMLElement;
  var isInlineDomNode2 = mod3.isInlineDomNode;
  var isMimeType = mod3.isMimeType;
  var makeStateWrapper = mod3.makeStateWrapper;
  var markSelection = mod3.markSelection;
  var mediaFileReader = mod3.mediaFileReader;
  var mergeRegister = mod3.mergeRegister;
  var objectKlassEquals = mod3.objectKlassEquals;
  var positionNodeOnRange = mod3.positionNodeOnRange;
  var registerNestedElementResolver = mod3.registerNestedElementResolver;
  var removeClassNamesFromElement = mod3.removeClassNamesFromElement;
  var selectionAlwaysOnDisplay = mod3.selectionAlwaysOnDisplay;

  // node_modules/@lexical/html/LexicalHtml.prod.mjs
  var LexicalHtml_prod_exports = {};
  __export(LexicalHtml_prod_exports, {
    $generateHtmlFromNodes: () => g2,
    $generateNodesFromDOM: () => m2
  });
  function m2(e2, n2) {
    const t2 = isDOMDocumentNode(n2) ? n2.body.childNodes : n2.childNodes;
    let l3 = [];
    const r3 = [];
    for (const n3 of t2) if (!w2.has(n3.nodeName)) {
      const t3 = y2(n3, e2, r3, false);
      null !== t3 && (l3 = l3.concat(t3));
    }
    return (function(e3) {
      for (const n3 of e3) n3.getNextSibling() instanceof ArtificialNode__DO_NOT_USE && n3.insertAfter($createLineBreakNode());
      for (const n3 of e3) {
        const e4 = n3.getChildren();
        for (const t3 of e4) n3.insertBefore(t3);
        n3.remove();
      }
    })(r3), l3;
  }
  function g2(e2, n2) {
    if ("undefined" == typeof document || "undefined" == typeof window && void 0 === global.window) throw new Error("To use $generateHtmlFromNodes in headless mode please initialize a headless browser implementation such as JSDom before calling this function.");
    const t2 = document.createElement("div"), o2 = $getRoot().getChildren();
    for (let l3 = 0; l3 < o2.length; l3++) {
      x2(e2, o2[l3], t2, n2);
    }
    return t2.innerHTML;
  }
  function x2(t2, o2, l3, u3 = null) {
    let f3 = null === u3 || o2.isSelected(u3);
    const a3 = $isElementNode(o2) && o2.excludeFromCopy("html");
    let d4 = o2;
    null !== u3 && $isTextNode(o2) && (d4 = $sliceSelectedTextNodeContent(u3, o2, "clone"));
    const p3 = $isElementNode(d4) ? d4.getChildren() : [], h2 = getRegisteredNode(t2, d4.getType());
    let m3;
    m3 = h2 && void 0 !== h2.exportDOM ? h2.exportDOM(t2, d4) : d4.exportDOM(t2);
    const { element: g3, after: w5 } = m3;
    if (!g3) return false;
    const y4 = document.createDocumentFragment();
    for (let e2 = 0; e2 < p3.length; e2++) {
      const n2 = p3[e2], l4 = x2(t2, n2, y4, u3);
      !f3 && $isElementNode(o2) && l4 && o2.extractWithChild(n2, u3, "html") && (f3 = true);
    }
    if (f3 && !a3) {
      if ((isHTMLElement2(g3) || isDocumentFragment(g3)) && g3.append(y4), l3.append(g3), w5) {
        const e2 = w5.call(d4, g3);
        e2 && (isDocumentFragment(g3) ? g3.replaceChildren(e2) : g3.replaceWith(e2));
      }
    } else l3.append(y4);
    return f3;
  }
  var w2 = /* @__PURE__ */ new Set(["STYLE", "SCRIPT"]);
  function y2(e2, n2, o2, l3, i3 = /* @__PURE__ */ new Map(), s4) {
    let c3 = [];
    if (w2.has(e2.nodeName)) return c3;
    let m3 = null;
    const g3 = (function(e3, n3) {
      const { nodeName: t2 } = e3, o3 = n3._htmlConversions.get(t2.toLowerCase());
      let l4 = null;
      if (void 0 !== o3) for (const n4 of o3) {
        const t3 = n4(e3);
        null !== t3 && (null === l4 || (l4.priority || 0) <= (t3.priority || 0)) && (l4 = t3);
      }
      return null !== l4 ? l4.conversion : null;
    })(e2, n2), x4 = g3 ? g3(e2) : null;
    let b5 = null;
    if (null !== x4) {
      b5 = x4.after;
      const n3 = x4.node;
      if (m3 = Array.isArray(n3) ? n3[n3.length - 1] : n3, null !== m3) {
        for (const [, e3] of i3) if (m3 = e3(m3, s4), !m3) break;
        m3 && c3.push(...Array.isArray(n3) ? n3 : [m3]);
      }
      null != x4.forChild && i3.set(e2.nodeName, x4.forChild);
    }
    const S3 = e2.childNodes;
    let v4 = [];
    const N4 = (null == m3 || !$isRootOrShadowRoot(m3)) && (null != m3 && $isBlockElementNode(m3) || l3);
    for (let e3 = 0; e3 < S3.length; e3++) v4.push(...y2(S3[e3], n2, o2, N4, new Map(i3), m3));
    return null != b5 && (v4 = b5(v4)), isBlockDomNode2(e2) && (v4 = C2(e2, v4, N4 ? () => {
      const e3 = new ArtificialNode__DO_NOT_USE();
      return o2.push(e3), e3;
    } : $createParagraphNode)), null == m3 ? v4.length > 0 ? c3 = c3.concat(v4) : isBlockDomNode2(e2) && (function(e3) {
      if (null == e3.nextSibling || null == e3.previousSibling) return false;
      return isInlineDomNode(e3.nextSibling) && isInlineDomNode(e3.previousSibling);
    })(e2) && (c3 = c3.concat($createLineBreakNode())) : $isElementNode(m3) && m3.append(...v4), c3;
  }
  function C2(e2, n2, t2) {
    const o2 = e2.style.textAlign, l3 = [];
    let r3 = [];
    for (let e3 = 0; e3 < n2.length; e3++) {
      const i3 = n2[e3];
      if ($isBlockElementNode(i3)) o2 && !i3.getFormat() && i3.setFormat(o2), l3.push(i3);
      else if (r3.push(i3), e3 === n2.length - 1 || e3 < n2.length - 1 && $isBlockElementNode(n2[e3 + 1])) {
        const e4 = t2();
        e4.setFormat(o2), e4.append(...r3), l3.push(e4), r3 = [];
      }
    }
    return l3;
  }

  // node_modules/@lexical/html/LexicalHtml.mjs
  var mod4 = false ? LexicalHtml_dev_exports : LexicalHtml_prod_exports;
  var $generateHtmlFromNodes = mod4.$generateHtmlFromNodes;
  var $generateNodesFromDOM = mod4.$generateNodesFromDOM;

  // node_modules/@lexical/clipboard/LexicalClipboard.prod.mjs
  var LexicalClipboard_prod_exports = {};
  __export(LexicalClipboard_prod_exports, {
    $generateJSONFromSelectedNodes: () => E3,
    $generateNodesFromSerializedNodes: () => L3,
    $getClipboardDataFromSelection: () => _4,
    $getHtmlContent: () => D4,
    $getLexicalContent: () => S2,
    $insertDataTransferForPlainText: () => N2,
    $insertDataTransferForRichText: () => R4,
    $insertGeneratedNodes: () => A3,
    copyToClipboard: () => F4,
    setLexicalClipboardDataTransfer: () => J4
  });
  function v2(t2, ...e2) {
    const n2 = new URL("https://lexical.dev/docs/error"), o2 = new URLSearchParams();
    o2.append("code", t2);
    for (const t3 of e2) o2.append("v", t3);
    throw n2.search = o2.toString(), Error(`Minified Lexical error #${t2}; visit ${n2.toString()} for the full message or use the non-minified dev environment for full errors and additional helpful warnings.`);
  }
  function D4(e2, n2 = $getSelection()) {
    return null == n2 && v2(166), $isRangeSelection(n2) && n2.isCollapsed() || 0 === n2.getNodes().length ? "" : $generateHtmlFromNodes(e2, n2);
  }
  function S2(t2, e2 = $getSelection()) {
    return null == e2 && v2(166), $isRangeSelection(e2) && e2.isCollapsed() || 0 === e2.getNodes().length ? null : JSON.stringify(E3(t2, e2));
  }
  function N2(t2, e2) {
    const n2 = t2.getData("text/plain") || t2.getData("text/uri-list");
    null != n2 && e2.insertRawText(n2);
  }
  function R4(t2, n2, o2) {
    const r3 = t2.getData("application/x-lexical-editor");
    if (r3) try {
      const t3 = JSON.parse(r3);
      if (t3.namespace === o2._config.namespace && Array.isArray(t3.nodes)) {
        return A3(o2, L3(t3.nodes), n2);
      }
    } catch (t3) {
      console.error(t3);
    }
    const c3 = t2.getData("text/html"), a3 = t2.getData("text/plain");
    if (c3 && a3 !== c3) try {
      const t3 = new DOMParser().parseFromString((function(t4) {
        if (window.trustedTypes && window.trustedTypes.createPolicy) {
          return window.trustedTypes.createPolicy("lexical", { createHTML: (t5) => t5 }).createHTML(t4);
        }
        return t4;
      })(c3), "text/html");
      return A3(o2, $generateNodesFromDOM(o2, t3), n2);
    } catch (t3) {
      console.error(t3);
    }
    const u3 = a3 || t2.getData("text/uri-list");
    if (null != u3) if ($isRangeSelection(n2)) {
      const t3 = u3.split(/(\r?\n|\t)/);
      "" === t3[t3.length - 1] && t3.pop();
      for (let e2 = 0; e2 < t3.length; e2++) {
        const n3 = $getSelection();
        if ($isRangeSelection(n3)) {
          const o3 = t3[e2];
          "\n" === o3 || "\r\n" === o3 ? n3.insertParagraph() : "	" === o3 ? n3.insertNodes([$createTabNode()]) : n3.insertText(o3);
        }
      }
    } else n2.insertRawText(u3);
  }
  function A3(t2, e2, n2) {
    t2.dispatchCommand(SELECTION_INSERT_CLIPBOARD_NODES_COMMAND, { nodes: e2, selection: n2 }) || (n2.insertNodes(e2), (function(t3) {
      if ($isRangeSelection(t3) && t3.isCollapsed()) {
        const e3 = t3.anchor;
        let n3 = null;
        const o2 = $caretFromPoint(e3, "previous");
        if (o2) if ($isTextPointCaret(o2)) n3 = o2.origin;
        else {
          const t4 = $getCaretRange(o2, $getChildCaret($getRoot(), "next").getFlipped());
          for (const e4 of t4) {
            if ($isTextNode(e4.origin)) {
              n3 = e4.origin;
              break;
            }
            if ($isElementNode(e4.origin) && !e4.origin.isInline()) break;
          }
        }
        if (n3 && $isTextNode(n3)) {
          const e4 = n3.getFormat(), o3 = n3.getStyle();
          t3.format === e4 && t3.style === o3 || (t3.format = e4, t3.style = o3, t3.dirty = true);
        }
      }
    })(n2));
  }
  function P3(t2, e2, n2, r3 = []) {
    let i3 = null === e2 || n2.isSelected(e2);
    const l3 = $isElementNode(n2) && n2.excludeFromCopy("html");
    let s4 = n2;
    null !== e2 && $isTextNode(s4) && (s4 = $sliceSelectedTextNodeContent(e2, s4, "clone"));
    const c3 = $isElementNode(s4) ? s4.getChildren() : [], a3 = (function(t3) {
      const e3 = t3.exportJSON(), n3 = t3.constructor;
      if (e3.type !== n3.getType() && v2(58, n3.name), $isElementNode(t3)) {
        const t4 = e3.children;
        Array.isArray(t4) || v2(59, n3.name);
      }
      return e3;
    })(s4);
    $isTextNode(s4) && 0 === s4.getTextContentSize() && (i3 = false);
    for (let o2 = 0; o2 < c3.length; o2++) {
      const r4 = c3[o2], l4 = P3(t2, e2, r4, a3.children);
      !i3 && $isElementNode(n2) && l4 && n2.extractWithChild(r4, e2, "clone") && (i3 = true);
    }
    if (i3 && !l3) r3.push(a3);
    else if (Array.isArray(a3.children)) for (let t3 = 0; t3 < a3.children.length; t3++) {
      const e3 = a3.children[t3];
      r3.push(e3);
    }
    return i3;
  }
  function E3(t2, e2) {
    const n2 = [], o2 = $getRoot().getChildren();
    for (let r3 = 0; r3 < o2.length; r3++) {
      P3(t2, e2, o2[r3], n2);
    }
    return { namespace: t2._config.namespace, nodes: n2 };
  }
  function L3(t2) {
    const e2 = [];
    for (let o2 = 0; o2 < t2.length; o2++) {
      const r3 = t2[o2], i3 = $parseSerializedNode(r3);
      $isTextNode(i3) && $addNodeStyle(i3), e2.push(i3);
    }
    return e2;
  }
  var b3 = null;
  async function F4(t2, e2, n2) {
    if (null !== b3) return false;
    if (null !== e2) return new Promise((o3, r3) => {
      t2.update(() => {
        o3(M3(t2, e2, n2));
      });
    });
    const o2 = t2.getRootElement(), i3 = t2._window || window, l3 = i3.document, s4 = getDOMSelection(i3);
    if (null === o2 || null === s4) return false;
    const c3 = l3.createElement("span");
    c3.style.cssText = "position: fixed; top: -1000px;", c3.append(l3.createTextNode("#")), o2.append(c3);
    const a3 = new Range();
    return a3.setStart(c3, 0), a3.setEnd(c3, 1), s4.removeAllRanges(), s4.addRange(a3), new Promise((e3, o3) => {
      const s5 = t2.registerCommand(COPY_COMMAND, (o4) => (objectKlassEquals(o4, ClipboardEvent) && (s5(), null !== b3 && (i3.clearTimeout(b3), b3 = null), e3(M3(t2, o4, n2))), true), COMMAND_PRIORITY_CRITICAL);
      b3 = i3.setTimeout(() => {
        s5(), b3 = null, e3(false);
      }, 50), l3.execCommand("copy"), c3.remove();
    });
  }
  function M3(t2, e2, n2) {
    if (void 0 === n2) {
      const e3 = getDOMSelection(t2._window), o3 = $getSelection();
      if (!o3 || o3.isCollapsed()) return false;
      if (!e3) return false;
      const r3 = e3.anchorNode, l3 = e3.focusNode;
      if (null !== r3 && null !== l3 && !isSelectionWithinEditor(t2, r3, l3)) return false;
      n2 = _4(o3);
    }
    e2.preventDefault();
    const o2 = e2.clipboardData;
    return null !== o2 && (J4(o2, n2), true);
  }
  var O4 = [["text/html", D4], ["application/x-lexical-editor", S2]];
  function _4(t2 = $getSelection()) {
    const e2 = { "text/plain": t2 ? t2.getTextContent() : "" };
    if (t2) {
      const n2 = $getEditor();
      for (const [o2, r3] of O4) {
        const i3 = r3(n2, t2);
        null !== i3 && (e2[o2] = i3);
      }
    }
    return e2;
  }
  function J4(t2, e2) {
    for (const [n2] of O4) void 0 === e2[n2] && t2.setData(n2, "");
    for (const n2 in e2) {
      const o2 = e2[n2];
      void 0 !== o2 && t2.setData(n2, o2);
    }
  }

  // node_modules/@lexical/clipboard/LexicalClipboard.mjs
  var mod5 = false ? LexicalClipboard_dev_exports : LexicalClipboard_prod_exports;
  var $generateJSONFromSelectedNodes = mod5.$generateJSONFromSelectedNodes;
  var $generateNodesFromSerializedNodes = mod5.$generateNodesFromSerializedNodes;
  var $getClipboardDataFromSelection = mod5.$getClipboardDataFromSelection;
  var $getHtmlContent = mod5.$getHtmlContent;
  var $getLexicalContent = mod5.$getLexicalContent;
  var $insertDataTransferForPlainText = mod5.$insertDataTransferForPlainText;
  var $insertDataTransferForRichText = mod5.$insertDataTransferForRichText;
  var $insertGeneratedNodes = mod5.$insertGeneratedNodes;
  var copyToClipboard = mod5.copyToClipboard;
  var setLexicalClipboardDataTransfer = mod5.setLexicalClipboardDataTransfer;

  // node_modules/@lexical/extension/LexicalExtension.prod.mjs
  var LexicalExtension_prod_exports = {};
  __export(LexicalExtension_prod_exports, {
    $createHorizontalRuleNode: () => Qt2,
    $isHorizontalRuleNode: () => Xt2,
    AutoFocusExtension: () => ut3,
    ClearEditorExtension: () => lt3,
    EditorStateExtension: () => vt3,
    HorizontalRuleExtension: () => Yt2,
    HorizontalRuleNode: () => Ht3,
    INSERT_HORIZONTAL_RULE_COMMAND: () => Jt2,
    InitialStateExtension: () => Kt3,
    LexicalBuilder: () => Bt3,
    NodeSelectionExtension: () => Zt2,
    TabIndentationExtension: () => ee3,
    batch: () => F5,
    buildEditorFromExtensions: () => $t3,
    computed: () => it3,
    configExtension: () => configExtension,
    declarePeerDependency: () => declarePeerDependency,
    defineExtension: () => defineExtension,
    effect: () => dt3,
    getExtensionDependencyFromEditor: () => Ft2,
    getKnownTypesAndNodes: () => gt3,
    getPeerDependencyFromEditor: () => Gt2,
    getPeerDependencyFromEditorOrThrow: () => Vt2,
    namedSignals: () => at3,
    registerClearEditor: () => ht3,
    registerTabIndentation: () => te3,
    safeCast: () => safeCast,
    shallowMergeConfig: () => shallowMergeConfig,
    signal: () => X4,
    untracked: () => W4,
    watchedSignal: () => mt3
  });
  var T3 = /* @__PURE__ */ Symbol.for("preact-signals");
  function B4() {
    if (Z4 > 1) return void Z4--;
    let t2, e2 = false;
    for (; void 0 !== V4; ) {
      let n2 = V4;
      for (V4 = void 0, J5++; void 0 !== n2; ) {
        const i3 = n2.o;
        if (n2.o = void 0, n2.f &= -3, !(8 & n2.f) && Y4(n2)) try {
          n2.c();
        } catch (n3) {
          e2 || (t2 = n3, e2 = true);
        }
        n2 = i3;
      }
    }
    if (J5 = 0, Z4--, e2) throw t2;
  }
  function F5(t2) {
    if (Z4 > 0) return t2();
    Z4++;
    try {
      return t2();
    } finally {
      B4();
    }
  }
  var G4;
  var V4;
  function W4(t2) {
    const e2 = G4;
    G4 = void 0;
    try {
      return t2();
    } finally {
      G4 = e2;
    }
  }
  var Z4 = 0;
  var J5 = 0;
  var H4 = 0;
  function q4(t2) {
    if (void 0 === G4) return;
    let e2 = t2.n;
    return void 0 === e2 || e2.t !== G4 ? (e2 = { i: 0, S: t2, p: G4.s, n: void 0, t: G4, e: void 0, x: void 0, r: e2 }, void 0 !== G4.s && (G4.s.n = e2), G4.s = e2, t2.n = e2, 32 & G4.f && t2.S(e2), e2) : -1 === e2.i ? (e2.i = 0, void 0 !== e2.n && (e2.n.p = e2.p, void 0 !== e2.p && (e2.p.n = e2.n), e2.p = G4.s, e2.n = void 0, G4.s.n = e2, G4.s = e2), e2) : void 0;
  }
  function Q4(t2, e2) {
    this.v = t2, this.i = 0, this.n = void 0, this.t = void 0, this.W = null == e2 ? void 0 : e2.watched, this.Z = null == e2 ? void 0 : e2.unwatched, this.name = null == e2 ? void 0 : e2.name;
  }
  function X4(t2, e2) {
    return new Q4(t2, e2);
  }
  function Y4(t2) {
    for (let e2 = t2.s; void 0 !== e2; e2 = e2.n) if (e2.S.i !== e2.i || !e2.S.h() || e2.S.i !== e2.i) return true;
    return false;
  }
  function tt3(t2) {
    for (let e2 = t2.s; void 0 !== e2; e2 = e2.n) {
      const n2 = e2.S.n;
      if (void 0 !== n2 && (e2.r = n2), e2.S.n = e2, e2.i = -1, void 0 === e2.n) {
        t2.s = e2;
        break;
      }
    }
  }
  function et3(t2) {
    let e2, n2 = t2.s;
    for (; void 0 !== n2; ) {
      const t3 = n2.p;
      -1 === n2.i ? (n2.S.U(n2), void 0 !== t3 && (t3.n = n2.n), void 0 !== n2.n && (n2.n.p = t3)) : e2 = n2, n2.S.n = n2.r, void 0 !== n2.r && (n2.r = void 0), n2 = t3;
    }
    t2.s = e2;
  }
  function nt3(t2, e2) {
    Q4.call(this, void 0), this.x = t2, this.s = void 0, this.g = H4 - 1, this.f = 4, this.W = null == e2 ? void 0 : e2.watched, this.Z = null == e2 ? void 0 : e2.unwatched, this.name = null == e2 ? void 0 : e2.name;
  }
  function it3(t2, e2) {
    return new nt3(t2, e2);
  }
  function ot3(t2) {
    const e2 = t2.u;
    if (t2.u = void 0, "function" == typeof e2) {
      Z4++;
      const n2 = G4;
      G4 = void 0;
      try {
        e2();
      } catch (e3) {
        throw t2.f &= -2, t2.f |= 8, st3(t2), e3;
      } finally {
        G4 = n2, B4();
      }
    }
  }
  function st3(t2) {
    for (let e2 = t2.s; void 0 !== e2; e2 = e2.n) e2.S.U(e2);
    t2.x = void 0, t2.s = void 0, ot3(t2);
  }
  function rt3(t2) {
    if (G4 !== this) throw new Error("Out-of-order effect");
    et3(this), G4 = t2, this.f &= -2, 8 & this.f && st3(this), B4();
  }
  function ct3(t2, e2) {
    this.x = t2, this.u = void 0, this.s = void 0, this.o = void 0, this.f = 32, this.name = null == e2 ? void 0 : e2.name;
  }
  function dt3(t2, e2) {
    const n2 = new ct3(t2, e2);
    try {
      n2.c();
    } catch (t3) {
      throw n2.d(), t3;
    }
    const i3 = n2.d.bind(n2);
    return i3[Symbol.dispose] = i3, i3;
  }
  function at3(t2, e2 = {}) {
    const n2 = {};
    for (const i3 in t2) {
      const o2 = e2[i3], s4 = X4(void 0 === o2 ? t2[i3] : o2);
      n2[i3] = s4;
    }
    return n2;
  }
  Q4.prototype.brand = T3, Q4.prototype.h = function() {
    return true;
  }, Q4.prototype.S = function(t2) {
    const e2 = this.t;
    e2 !== t2 && void 0 === t2.e && (t2.x = e2, this.t = t2, void 0 !== e2 ? e2.e = t2 : W4(() => {
      var t3;
      null == (t3 = this.W) || t3.call(this);
    }));
  }, Q4.prototype.U = function(t2) {
    if (void 0 !== this.t) {
      const e2 = t2.e, n2 = t2.x;
      void 0 !== e2 && (e2.x = n2, t2.e = void 0), void 0 !== n2 && (n2.e = e2, t2.x = void 0), t2 === this.t && (this.t = n2, void 0 === n2 && W4(() => {
        var t3;
        null == (t3 = this.Z) || t3.call(this);
      }));
    }
  }, Q4.prototype.subscribe = function(t2) {
    return dt3(() => {
      const e2 = this.value, n2 = G4;
      G4 = void 0;
      try {
        t2(e2);
      } finally {
        G4 = n2;
      }
    }, { name: "sub" });
  }, Q4.prototype.valueOf = function() {
    return this.value;
  }, Q4.prototype.toString = function() {
    return this.value + "";
  }, Q4.prototype.toJSON = function() {
    return this.value;
  }, Q4.prototype.peek = function() {
    const t2 = G4;
    G4 = void 0;
    try {
      return this.value;
    } finally {
      G4 = t2;
    }
  }, Object.defineProperty(Q4.prototype, "value", { get() {
    const t2 = q4(this);
    return void 0 !== t2 && (t2.i = this.i), this.v;
  }, set(t2) {
    if (t2 !== this.v) {
      if (J5 > 100) throw new Error("Cycle detected");
      this.v = t2, this.i++, H4++, Z4++;
      try {
        for (let t3 = this.t; void 0 !== t3; t3 = t3.x) t3.t.N();
      } finally {
        B4();
      }
    }
  } }), nt3.prototype = new Q4(), nt3.prototype.h = function() {
    if (this.f &= -3, 1 & this.f) return false;
    if (32 == (36 & this.f)) return true;
    if (this.f &= -5, this.g === H4) return true;
    if (this.g = H4, this.f |= 1, this.i > 0 && !Y4(this)) return this.f &= -2, true;
    const t2 = G4;
    try {
      tt3(this), G4 = this;
      const t3 = this.x();
      (16 & this.f || this.v !== t3 || 0 === this.i) && (this.v = t3, this.f &= -17, this.i++);
    } catch (t3) {
      this.v = t3, this.f |= 16, this.i++;
    }
    return G4 = t2, et3(this), this.f &= -2, true;
  }, nt3.prototype.S = function(t2) {
    if (void 0 === this.t) {
      this.f |= 36;
      for (let t3 = this.s; void 0 !== t3; t3 = t3.n) t3.S.S(t3);
    }
    Q4.prototype.S.call(this, t2);
  }, nt3.prototype.U = function(t2) {
    if (void 0 !== this.t && (Q4.prototype.U.call(this, t2), void 0 === this.t)) {
      this.f &= -33;
      for (let t3 = this.s; void 0 !== t3; t3 = t3.n) t3.S.U(t3);
    }
  }, nt3.prototype.N = function() {
    if (!(2 & this.f)) {
      this.f |= 6;
      for (let t2 = this.t; void 0 !== t2; t2 = t2.x) t2.t.N();
    }
  }, Object.defineProperty(nt3.prototype, "value", { get() {
    if (1 & this.f) throw new Error("Cycle detected");
    const t2 = q4(this);
    if (this.h(), void 0 !== t2 && (t2.i = this.i), 16 & this.f) throw this.v;
    return this.v;
  } }), ct3.prototype.c = function() {
    const t2 = this.S();
    try {
      if (8 & this.f) return;
      if (void 0 === this.x) return;
      const t3 = this.x();
      "function" == typeof t3 && (this.u = t3);
    } finally {
      t2();
    }
  }, ct3.prototype.S = function() {
    if (1 & this.f) throw new Error("Cycle detected");
    this.f |= 1, this.f &= -9, ot3(this), tt3(this), Z4++;
    const t2 = G4;
    return G4 = this, rt3.bind(this, t2);
  }, ct3.prototype.N = function() {
    2 & this.f || (this.f |= 2, this.o = V4, V4 = this);
  }, ct3.prototype.d = function() {
    this.f |= 8, 1 & this.f || st3(this);
  }, ct3.prototype.dispose = function() {
    this.d();
  };
  var ut3 = defineExtension({ build: (t2, e2, n2) => at3(e2), config: safeCast({ defaultSelection: "rootEnd", disabled: false }), name: "@lexical/extension/AutoFocus", register(t2, e2, n2) {
    const i3 = n2.getOutput();
    return dt3(() => i3.disabled.value ? void 0 : t2.registerRootListener((e3) => {
      t2.focus(() => {
        const t3 = document.activeElement;
        null === e3 || null !== t3 && e3.contains(t3) || e3.focus({ preventScroll: true });
      }, { defaultSelection: i3.defaultSelection.peek() });
    }));
  } });
  function ft3() {
    const t2 = $getRoot(), e2 = $getSelection(), n2 = $createParagraphNode();
    t2.clear(), t2.append(n2), null !== e2 && n2.select(), $isRangeSelection(e2) && (e2.format = 0);
  }
  function ht3(t2, e2 = ft3) {
    return t2.registerCommand(CLEAR_EDITOR_COMMAND, (n2) => (t2.update(e2), true), COMMAND_PRIORITY_EDITOR);
  }
  var lt3 = defineExtension({ build: (t2, e2, n2) => at3(e2), config: safeCast({ $onClear: ft3 }), name: "@lexical/extension/ClearEditor", register(t2, e2, n2) {
    const { $onClear: i3 } = n2.getOutput();
    return dt3(() => ht3(t2, i3.value));
  } });
  function gt3(t2) {
    const e2 = /* @__PURE__ */ new Set(), n2 = /* @__PURE__ */ new Set();
    for (const i3 of pt3(t2)) {
      const t3 = "function" == typeof i3 ? i3 : i3.replace;
      e2.add(t3.getType()), n2.add(t3);
    }
    return { nodes: n2, types: e2 };
  }
  function pt3(t2) {
    return ("function" == typeof t2.nodes ? t2.nodes() : t2.nodes) || [];
  }
  function mt3(t2, e2) {
    let n2;
    return X4(t2(), { unwatched() {
      n2 && (n2(), n2 = void 0);
    }, watched() {
      this.value = t2(), n2 = e2(this);
    } });
  }
  var vt3 = defineExtension({ build: (t2) => mt3(() => t2.getEditorState(), (e2) => t2.registerUpdateListener((t3) => {
    e2.value = t3.editorState;
  })), name: "@lexical/extension/EditorState" });
  function xt3(t2, ...e2) {
    const n2 = new URL("https://lexical.dev/docs/error"), i3 = new URLSearchParams();
    i3.append("code", t2);
    for (const t3 of e2) i3.append("v", t3);
    throw n2.search = i3.toString(), Error(`Minified Lexical error #${t2}; visit ${n2.toString()} for the full message or use the non-minified dev environment for full errors and additional helpful warnings.`);
  }
  function yt3(t2, e2) {
    if (t2 && e2 && !Array.isArray(e2) && "object" == typeof t2 && "object" == typeof e2) {
      const n2 = t2, i3 = e2;
      for (const t3 in i3) n2[t3] = yt3(n2[t3], i3[t3]);
      return t2;
    }
    return e2;
  }
  var St3 = 0;
  var Et3 = 1;
  var bt3 = 2;
  var wt3 = 3;
  var Nt3 = 4;
  var Ot3 = 5;
  var Rt3 = 6;
  var Mt3 = 7;
  function Ct3(t2) {
    return t2.id === St3;
  }
  function Dt3(t2) {
    return t2.id === bt3;
  }
  function _t3(t2) {
    return (function(t3) {
      return t3.id === Et3;
    })(t2) || xt3(305, String(t2.id), String(Et3)), Object.assign(t2, { id: bt3 });
  }
  var It2 = /* @__PURE__ */ new Set();
  var jt3 = class {
    builder;
    configs;
    _dependency;
    _peerNameSet;
    extension;
    state;
    _signal;
    constructor(t2, e2) {
      this.builder = t2, this.extension = e2, this.configs = /* @__PURE__ */ new Set(), this.state = { id: St3 };
    }
    mergeConfigs() {
      let t2 = this.extension.config || {};
      const e2 = this.extension.mergeConfig ? this.extension.mergeConfig.bind(this.extension) : shallowMergeConfig;
      for (const n2 of this.configs) t2 = e2(t2, n2);
      return t2;
    }
    init(t2) {
      const e2 = this.state;
      Dt3(e2) || xt3(306, String(e2.id));
      const n2 = { getDependency: this.getInitDependency.bind(this), getDirectDependentNames: this.getDirectDependentNames.bind(this), getPeer: this.getInitPeer.bind(this), getPeerNameSet: this.getPeerNameSet.bind(this) }, i3 = { ...n2, getDependency: this.getDependency.bind(this), getInitResult: this.getInitResult.bind(this), getPeer: this.getPeer.bind(this) }, o2 = (function(t3, e3, n3) {
        return Object.assign(t3, { config: e3, id: wt3, registerState: n3 });
      })(e2, this.mergeConfigs(), n2);
      let s4;
      this.state = o2, this.extension.init && (s4 = this.extension.init(t2, o2.config, n2)), this.state = (function(t3, e3, n3) {
        return Object.assign(t3, { id: Nt3, initResult: e3, registerState: n3 });
      })(o2, s4, i3);
    }
    build(t2) {
      const e2 = this.state;
      let n2;
      e2.id !== Nt3 && xt3(307, String(e2.id), String(Ot3)), this.extension.build && (n2 = this.extension.build(t2, e2.config, e2.registerState));
      const i3 = { ...e2.registerState, getOutput: () => n2, getSignal: this.getSignal.bind(this) };
      this.state = (function(t3, e3, n3) {
        return Object.assign(t3, { id: Ot3, output: e3, registerState: n3 });
      })(e2, n2, i3);
    }
    register(t2, e2) {
      this._signal = e2;
      const n2 = this.state;
      n2.id !== Ot3 && xt3(308, String(n2.id), String(Ot3));
      const i3 = this.extension.register && this.extension.register(t2, n2.config, n2.registerState);
      return this.state = (function(t3) {
        return Object.assign(t3, { id: Rt3 });
      })(n2), () => {
        const t3 = this.state;
        t3.id !== Mt3 && xt3(309, String(n2.id), String(Mt3)), this.state = (function(t4) {
          return Object.assign(t4, { id: Ot3 });
        })(t3), i3 && i3();
      };
    }
    afterRegistration(t2) {
      const e2 = this.state;
      let n2;
      return e2.id !== Rt3 && xt3(310, String(e2.id), String(Rt3)), this.extension.afterRegistration && (n2 = this.extension.afterRegistration(t2, e2.config, e2.registerState)), this.state = (function(t3) {
        return Object.assign(t3, { id: Mt3 });
      })(e2), n2;
    }
    getSignal() {
      return void 0 === this._signal && xt3(311), this._signal;
    }
    getInitResult() {
      void 0 === this.extension.init && xt3(312, this.extension.name);
      const t2 = this.state;
      return (function(t3) {
        return t3.id >= Nt3;
      })(t2) || xt3(313, String(t2.id), String(Nt3)), t2.initResult;
    }
    getInitPeer(t2) {
      const e2 = this.builder.extensionNameMap.get(t2);
      return e2 ? e2.getExtensionInitDependency() : void 0;
    }
    getExtensionInitDependency() {
      const t2 = this.state;
      return (function(t3) {
        return t3.id >= wt3;
      })(t2) || xt3(314, String(t2.id), String(wt3)), { config: t2.config };
    }
    getPeer(t2) {
      const e2 = this.builder.extensionNameMap.get(t2);
      return e2 ? e2.getExtensionDependency() : void 0;
    }
    getInitDependency(t2) {
      const e2 = this.builder.getExtensionRep(t2);
      return void 0 === e2 && xt3(315, this.extension.name, t2.name), e2.getExtensionInitDependency();
    }
    getDependency(t2) {
      const e2 = this.builder.getExtensionRep(t2);
      return void 0 === e2 && xt3(315, this.extension.name, t2.name), e2.getExtensionDependency();
    }
    getState() {
      const t2 = this.state;
      return (function(t3) {
        return t3.id >= Mt3;
      })(t2) || xt3(316, String(t2.id), String(Mt3)), t2;
    }
    getDirectDependentNames() {
      return this.builder.incomingEdges.get(this.extension.name) || It2;
    }
    getPeerNameSet() {
      let t2 = this._peerNameSet;
      return t2 || (t2 = new Set((this.extension.peerDependencies || []).map(([t3]) => t3)), this._peerNameSet = t2), t2;
    }
    getExtensionDependency() {
      if (!this._dependency) {
        const t2 = this.state;
        (function(t3) {
          return t3.id >= Ot3;
        })(t2) || xt3(317, this.extension.name), this._dependency = { config: t2.config, init: t2.initResult, output: t2.output };
      }
      return this._dependency;
    }
  };
  var At3 = { tag: HISTORY_MERGE_TAG };
  function Pt3() {
    const t2 = $getRoot();
    t2.isEmpty() && t2.append($createParagraphNode());
  }
  var Kt3 = defineExtension({ config: safeCast({ setOptions: At3, updateOptions: At3 }), init: ({ $initialEditorState: t2 = Pt3 }) => ({ $initialEditorState: t2, initialized: false }), afterRegistration(t2, { updateOptions: e2, setOptions: n2 }, i3) {
    const o2 = i3.getInitResult();
    if (!o2.initialized) {
      o2.initialized = true;
      const { $initialEditorState: i4 } = o2;
      if ($isEditorState(i4)) t2.setEditorState(i4, n2);
      else if ("function" == typeof i4) t2.update(() => {
        i4(t2);
      }, e2);
      else if (i4 && ("string" == typeof i4 || "object" == typeof i4)) {
        const e3 = t2.parseEditorState(i4);
        t2.setEditorState(e3, n2);
      }
    }
    return () => {
    };
  }, name: "@lexical/extension/InitialState", nodes: [RootNode, TextNode, LineBreakNode, TabNode, ParagraphNode] });
  var kt3 = /* @__PURE__ */ Symbol.for("@lexical/extension/LexicalBuilder");
  function $t3(...t2) {
    return Bt3.fromExtensions(t2).buildEditor();
  }
  function zt2() {
  }
  function Ut2(t2) {
    throw t2;
  }
  function Lt3(t2) {
    return Array.isArray(t2) ? t2 : [t2];
  }
  var Tt3 = "0.39.0+prod.esm";
  var Bt3 = class _Bt {
    roots;
    extensionNameMap;
    outgoingConfigEdges;
    incomingEdges;
    conflicts;
    _sortedExtensionReps;
    PACKAGE_VERSION;
    constructor(t2) {
      this.outgoingConfigEdges = /* @__PURE__ */ new Map(), this.incomingEdges = /* @__PURE__ */ new Map(), this.extensionNameMap = /* @__PURE__ */ new Map(), this.conflicts = /* @__PURE__ */ new Map(), this.PACKAGE_VERSION = Tt3, this.roots = t2;
      for (const e2 of t2) this.addExtension(e2);
    }
    static fromExtensions(t2) {
      const e2 = [Lt3(Kt3)];
      for (const n2 of t2) e2.push(Lt3(n2));
      return new _Bt(e2);
    }
    static maybeFromEditor(t2) {
      const e2 = t2[kt3];
      return e2 && (e2.PACKAGE_VERSION !== Tt3 && xt3(292, e2.PACKAGE_VERSION, Tt3), e2 instanceof _Bt || xt3(293)), e2;
    }
    static fromEditor(t2) {
      const e2 = _Bt.maybeFromEditor(t2);
      return void 0 === e2 && xt3(294), e2;
    }
    constructEditor() {
      const { $initialEditorState: t2, onError: e2, ...n2 } = this.buildCreateEditorArgs(), i3 = Object.assign(createEditor({ ...n2, ...e2 ? { onError: (t3) => {
        e2(t3, i3);
      } } : {} }), { [kt3]: this });
      for (const t3 of this.sortedExtensionReps()) t3.build(i3);
      return i3;
    }
    buildEditor() {
      let t2 = zt2;
      function e2() {
        try {
          t2();
        } finally {
          t2 = zt2;
        }
      }
      const n2 = Object.assign(this.constructEditor(), { dispose: e2, [Symbol.dispose]: e2 });
      return t2 = mergeRegister(this.registerEditor(n2), () => n2.setRootElement(null)), n2;
    }
    hasExtensionByName(t2) {
      return this.extensionNameMap.has(t2);
    }
    getExtensionRep(t2) {
      const e2 = this.extensionNameMap.get(t2.name);
      if (e2) return e2.extension !== t2 && xt3(295, t2.name), e2;
    }
    addEdge(t2, e2, n2) {
      const i3 = this.outgoingConfigEdges.get(t2);
      i3 ? i3.set(e2, n2) : this.outgoingConfigEdges.set(t2, /* @__PURE__ */ new Map([[e2, n2]]));
      const o2 = this.incomingEdges.get(e2);
      o2 ? o2.add(t2) : this.incomingEdges.set(e2, /* @__PURE__ */ new Set([t2]));
    }
    addExtension(t2) {
      void 0 !== this._sortedExtensionReps && xt3(296);
      const e2 = Lt3(t2), [n2] = e2;
      "string" != typeof n2.name && xt3(297, typeof n2.name);
      let i3 = this.extensionNameMap.get(n2.name);
      if (void 0 !== i3 && i3.extension !== n2 && xt3(298, n2.name), !i3) {
        i3 = new jt3(this, n2), this.extensionNameMap.set(n2.name, i3);
        const t3 = this.conflicts.get(n2.name);
        "string" == typeof t3 && xt3(299, n2.name, t3);
        for (const t4 of n2.conflictsWith || []) this.extensionNameMap.has(t4) && xt3(299, n2.name, t4), this.conflicts.set(t4, n2.name);
        for (const t4 of n2.dependencies || []) {
          const e3 = Lt3(t4);
          this.addEdge(n2.name, e3[0].name, e3.slice(1)), this.addExtension(e3);
        }
        for (const [t4, e3] of n2.peerDependencies || []) this.addEdge(n2.name, t4, e3 ? [e3] : []);
      }
    }
    sortedExtensionReps() {
      if (this._sortedExtensionReps) return this._sortedExtensionReps;
      const t2 = [], e2 = (n2, i3) => {
        let o2 = n2.state;
        if (Dt3(o2)) return;
        const s4 = n2.extension.name;
        var r3;
        Ct3(o2) || xt3(300, s4, i3 || "[unknown]"), Ct3(r3 = o2) || xt3(304, String(r3.id), String(St3)), o2 = Object.assign(r3, { id: Et3 }), n2.state = o2;
        const c3 = this.outgoingConfigEdges.get(s4);
        if (c3) for (const t3 of c3.keys()) {
          const n3 = this.extensionNameMap.get(t3);
          n3 && e2(n3, s4);
        }
        o2 = _t3(o2), n2.state = o2, t2.push(n2);
      };
      for (const t3 of this.extensionNameMap.values()) Ct3(t3.state) && e2(t3);
      for (const e3 of t2) for (const [t3, n2] of this.outgoingConfigEdges.get(e3.extension.name) || []) if (n2.length > 0) {
        const e4 = this.extensionNameMap.get(t3);
        if (e4) for (const t4 of n2) e4.configs.add(t4);
      }
      for (const [t3, ...e3] of this.roots) if (e3.length > 0) {
        const n2 = this.extensionNameMap.get(t3.name);
        void 0 === n2 && xt3(301, t3.name);
        for (const t4 of e3) n2.configs.add(t4);
      }
      return this._sortedExtensionReps = t2, this._sortedExtensionReps;
    }
    registerEditor(t2) {
      const e2 = this.sortedExtensionReps(), n2 = new AbortController(), i3 = [() => n2.abort()], o2 = n2.signal;
      for (const n3 of e2) {
        const e3 = n3.register(t2, o2);
        e3 && i3.push(e3);
      }
      for (const n3 of e2) {
        const e3 = n3.afterRegistration(t2);
        e3 && i3.push(e3);
      }
      return mergeRegister(...i3);
    }
    buildCreateEditorArgs() {
      const t2 = {}, e2 = /* @__PURE__ */ new Set(), n2 = /* @__PURE__ */ new Map(), i3 = /* @__PURE__ */ new Map(), o2 = {}, s4 = {}, r3 = this.sortedExtensionReps();
      for (const c4 of r3) {
        const { extension: r4 } = c4;
        if (void 0 !== r4.onError && (t2.onError = r4.onError), void 0 !== r4.disableEvents && (t2.disableEvents = r4.disableEvents), void 0 !== r4.parentEditor && (t2.parentEditor = r4.parentEditor), void 0 !== r4.editable && (t2.editable = r4.editable), void 0 !== r4.namespace && (t2.namespace = r4.namespace), void 0 !== r4.$initialEditorState && (t2.$initialEditorState = r4.$initialEditorState), r4.nodes) for (const t3 of pt3(r4)) {
          if ("function" != typeof t3) {
            const e3 = n2.get(t3.replace);
            e3 && xt3(302, r4.name, t3.replace.name, e3.extension.name), n2.set(t3.replace, c4);
          }
          e2.add(t3);
        }
        if (r4.html) {
          if (r4.html.export) for (const [t3, e3] of r4.html.export.entries()) i3.set(t3, e3);
          r4.html.import && Object.assign(o2, r4.html.import);
        }
        r4.theme && yt3(s4, r4.theme);
      }
      Object.keys(s4).length > 0 && (t2.theme = s4), e2.size && (t2.nodes = [...e2]);
      const c3 = Object.keys(o2).length > 0, d4 = i3.size > 0;
      (c3 || d4) && (t2.html = {}, c3 && (t2.html.import = o2), d4 && (t2.html.export = i3));
      for (const e3 of r3) e3.init(t2);
      return t2.onError || (t2.onError = Ut2), t2;
    }
  };
  function Ft2(t2, e2) {
    const n2 = Bt3.fromEditor(t2).getExtensionRep(e2);
    return void 0 === n2 && xt3(303, e2.name), n2.getExtensionDependency();
  }
  function Gt2(t2, e2) {
    const n2 = Bt3.fromEditor(t2).extensionNameMap.get(e2);
    return n2 ? n2.getExtensionDependency() : void 0;
  }
  function Vt2(t2, e2) {
    const n2 = Gt2(t2, e2);
    return void 0 === n2 && xt3(291, e2), n2;
  }
  var Wt2 = /* @__PURE__ */ new Set();
  var Zt2 = defineExtension({ build(t2, e2, n2) {
    const i3 = n2.getDependency(vt3).output, o2 = X4({ watchedNodeKeys: /* @__PURE__ */ new Map() }), r3 = mt3(() => {
    }, () => dt3(() => {
      const t3 = r3.peek(), { watchedNodeKeys: e3 } = o2.value;
      let n3, c3 = false;
      i3.value.read(() => {
        if ($getSelection()) for (const [i4, o3] of e3.entries()) {
          if (0 === o3.size) {
            e3.delete(i4);
            continue;
          }
          const s4 = $getNodeByKey(i4), r4 = s4 && s4.isSelected() || false;
          c3 = c3 || r4 !== (!!t3 && t3.has(i4)), r4 && (n3 = n3 || /* @__PURE__ */ new Set(), n3.add(i4));
        }
      }), !c3 && n3 && t3 && n3.size === t3.size || (r3.value = n3);
    }));
    return { watchNodeKey: function(t3) {
      const e3 = it3(() => (r3.value || Wt2).has(t3)), { watchedNodeKeys: n3 } = o2.peek();
      let i4 = n3.get(t3);
      const s4 = void 0 !== i4;
      return i4 = i4 || /* @__PURE__ */ new Set(), i4.add(e3), s4 || (n3.set(t3, i4), o2.value = { watchedNodeKeys: n3 }), e3;
    } };
  }, dependencies: [vt3], name: "@lexical/extension/NodeSelection" });
  var Jt2 = createCommand("INSERT_HORIZONTAL_RULE_COMMAND");
  var Ht3 = class _Ht extends DecoratorNode {
    static getType() {
      return "horizontalrule";
    }
    static clone(t2) {
      return new _Ht(t2.__key);
    }
    static importJSON(t2) {
      return Qt2().updateFromJSON(t2);
    }
    static importDOM() {
      return { hr: () => ({ conversion: qt2, priority: 0 }) };
    }
    exportDOM() {
      return { element: document.createElement("hr") };
    }
    createDOM(t2) {
      const e2 = document.createElement("hr");
      return addClassNamesToElement(e2, t2.theme.hr), e2;
    }
    getTextContent() {
      return "\n";
    }
    isInline() {
      return false;
    }
    updateDOM() {
      return false;
    }
  };
  function qt2() {
    return { node: Qt2() };
  }
  function Qt2() {
    return $create(Ht3);
  }
  function Xt2(t2) {
    return t2 instanceof Ht3;
  }
  var Yt2 = defineExtension({ dependencies: [vt3, Zt2], name: "@lexical/extension/HorizontalRule", nodes: () => [Ht3], register(t2, e2, n2) {
    const { watchNodeKey: i3 } = n2.getDependency(Zt2).output, o2 = X4({ nodeSelections: /* @__PURE__ */ new Map() }), r3 = t2._config.theme.hrSelected ?? "selected";
    return mergeRegister(t2.registerCommand(CLICK_COMMAND, (t3) => {
      if (isDOMNode(t3.target)) {
        const e3 = $getNodeFromDOMNode(t3.target);
        if (Xt2(e3)) return (function(t4, e4 = false) {
          const n3 = $getSelection(), i4 = t4.isSelected(), o3 = t4.getKey();
          let r4;
          e4 && $isNodeSelection(n3) ? r4 = n3 : (r4 = $createNodeSelection(), $setSelection(r4)), i4 ? r4.delete(o3) : r4.add(o3);
        })(e3, t3.shiftKey), true;
      }
      return false;
    }, COMMAND_PRIORITY_LOW), t2.registerMutationListener(Ht3, (e3, n3) => {
      F5(() => {
        let n4 = false;
        const { nodeSelections: s4 } = o2.peek();
        for (const [o3, r4] of e3.entries()) if ("destroyed" === r4) s4.delete(o3), n4 = true;
        else {
          const e4 = s4.get(o3), r5 = t2.getElementByKey(o3);
          e4 ? e4.domNode.value = r5 : (n4 = true, s4.set(o3, { domNode: X4(r5), selectedSignal: i3(o3) }));
        }
        n4 && (o2.value = { nodeSelections: s4 });
      });
    }), dt3(() => {
      const t3 = [];
      for (const { domNode: e3, selectedSignal: n3 } of o2.value.nodeSelections.values()) t3.push(dt3(() => {
        const t4 = e3.value;
        if (t4) {
          n3.value ? addClassNamesToElement(t4, r3) : removeClassNamesFromElement(t4, r3);
        }
      }));
      return mergeRegister(...t3);
    }));
  } });
  function te3(t2, e2) {
    return mergeRegister(t2.registerCommand(KEY_TAB_COMMAND, (e3) => {
      const n2 = $getSelection();
      if (!$isRangeSelection(n2)) return false;
      e3.preventDefault();
      const i3 = (function(t3) {
        const e4 = t3.getNodes();
        if ($filter(e4, (t4) => $isBlockElementNode(t4) && t4.canIndent() ? t4 : null).length > 0) return true;
        const n3 = t3.anchor, i4 = t3.focus, o2 = i4.isBefore(n3) ? i4 : n3, s4 = o2.getNode(), r3 = $getNearestBlockElementAncestorOrThrow(s4);
        if (r3.canIndent()) {
          const t4 = r3.getKey();
          let e5 = $createRangeSelection();
          if (e5.anchor.set(t4, 0, "element"), e5.focus.set(t4, 0, "element"), e5 = $normalizeSelection__EXPERIMENTAL(e5), e5.anchor.is(o2)) return true;
        }
        return false;
      })(n2) ? e3.shiftKey ? OUTDENT_CONTENT_COMMAND : INDENT_CONTENT_COMMAND : INSERT_TAB_COMMAND;
      return t2.dispatchCommand(i3, void 0);
    }, COMMAND_PRIORITY_EDITOR), t2.registerCommand(INDENT_CONTENT_COMMAND, () => {
      const t3 = "number" == typeof e2 ? e2 : e2 ? e2.peek() : null;
      if (null == t3) return false;
      const n2 = $getSelection();
      if (!$isRangeSelection(n2)) return false;
      const i3 = n2.getNodes().map((t4) => $getNearestBlockElementAncestorOrThrow(t4).getIndent());
      return Math.max(...i3) + 1 >= t3;
    }, COMMAND_PRIORITY_CRITICAL));
  }
  var ee3 = defineExtension({ build: (t2, e2, n2) => at3(e2), config: safeCast({ disabled: false, maxIndent: null }), name: "@lexical/extension/TabIndentation", register(t2, e2, n2) {
    const { disabled: i3, maxIndent: o2 } = n2.getOutput();
    return dt3(() => {
      if (!i3.value) return te3(t2, o2);
    });
  } });

  // node_modules/@lexical/extension/LexicalExtension.mjs
  var mod6 = false ? LexicalExtension_dev_exports : LexicalExtension_prod_exports;
  var $createHorizontalRuleNode = mod6.$createHorizontalRuleNode;
  var $isHorizontalRuleNode = mod6.$isHorizontalRuleNode;
  var AutoFocusExtension = mod6.AutoFocusExtension;
  var ClearEditorExtension = mod6.ClearEditorExtension;
  var EditorStateExtension = mod6.EditorStateExtension;
  var HorizontalRuleExtension = mod6.HorizontalRuleExtension;
  var HorizontalRuleNode = mod6.HorizontalRuleNode;
  var INSERT_HORIZONTAL_RULE_COMMAND = mod6.INSERT_HORIZONTAL_RULE_COMMAND;
  var InitialStateExtension = mod6.InitialStateExtension;
  var LexicalBuilder = mod6.LexicalBuilder;
  var NodeSelectionExtension = mod6.NodeSelectionExtension;
  var TabIndentationExtension = mod6.TabIndentationExtension;
  var batch = mod6.batch;
  var buildEditorFromExtensions = mod6.buildEditorFromExtensions;
  var computed = mod6.computed;
  var configExtension2 = mod6.configExtension;
  var declarePeerDependency2 = mod6.declarePeerDependency;
  var defineExtension2 = mod6.defineExtension;
  var effect = mod6.effect;
  var getExtensionDependencyFromEditor = mod6.getExtensionDependencyFromEditor;
  var getKnownTypesAndNodes = mod6.getKnownTypesAndNodes;
  var getPeerDependencyFromEditor = mod6.getPeerDependencyFromEditor;
  var getPeerDependencyFromEditorOrThrow = mod6.getPeerDependencyFromEditorOrThrow;
  var namedSignals = mod6.namedSignals;
  var registerClearEditor = mod6.registerClearEditor;
  var registerTabIndentation = mod6.registerTabIndentation;
  var safeCast2 = mod6.safeCast;
  var shallowMergeConfig2 = mod6.shallowMergeConfig;
  var signal = mod6.signal;
  var untracked = mod6.untracked;
  var watchedSignal = mod6.watchedSignal;

  // node_modules/@lexical/dragon/LexicalDragon.prod.mjs
  var LexicalDragon_prod_exports = {};
  __export(LexicalDragon_prod_exports, {
    DragonExtension: () => d2,
    registerDragonSupport: () => s2
  });
  function s2(e2) {
    const t2 = window.location.origin, n2 = (n3) => {
      if (n3.origin !== t2) return;
      const o2 = e2.getRootElement();
      if (document.activeElement !== o2) return;
      const s4 = n3.data;
      if ("string" == typeof s4) {
        let t3;
        try {
          t3 = JSON.parse(s4);
        } catch (e3) {
          return;
        }
        if (t3 && "nuanria_messaging" === t3.protocol && "request" === t3.type) {
          const o3 = t3.payload;
          if (o3 && "makeChanges" === o3.functionId) {
            const t4 = o3.args;
            if (t4) {
              const [o4, s5, d4, c3, g3] = t4;
              e2.update(() => {
                const e3 = $getSelection();
                if ($isRangeSelection(e3)) {
                  const t5 = e3.anchor;
                  let i3 = t5.getNode(), a3 = 0, l3 = 0;
                  if ($isTextNode(i3) && o4 >= 0 && s5 >= 0 && (a3 = o4, l3 = o4 + s5, e3.setTextNodeRange(i3, a3, i3, l3)), a3 === l3 && "" === d4 || (e3.insertRawText(d4), i3 = t5.getNode()), $isTextNode(i3)) {
                    a3 = c3, l3 = c3 + g3;
                    const t6 = i3.getTextContentSize();
                    a3 = a3 > t6 ? t6 : a3, l3 = l3 > t6 ? t6 : l3, e3.setTextNodeRange(i3, a3, i3, l3);
                  }
                  n3.stopImmediatePropagation();
                }
              });
            }
          }
        }
      }
    };
    return window.addEventListener("message", n2, true), () => {
      window.removeEventListener("message", n2, true);
    };
  }
  var d2 = defineExtension({ build: (e2, n2, o2) => namedSignals(n2), config: safeCast({ disabled: "undefined" == typeof window }), name: "@lexical/dragon", register: (t2, n2, o2) => effect(() => o2.getOutput().disabled.value ? void 0 : s2(t2)) });

  // node_modules/@lexical/dragon/LexicalDragon.mjs
  var mod7 = false ? LexicalDragon_dev_exports : LexicalDragon_prod_exports;
  var DragonExtension = mod7.DragonExtension;
  var registerDragonSupport = mod7.registerDragonSupport;

  // node_modules/@lexical/rich-text/LexicalRichText.prod.mjs
  var LexicalRichText_prod_exports = {};
  __export(LexicalRichText_prod_exports, {
    $createHeadingNode: () => St4,
    $createQuoteNode: () => _t4,
    $isHeadingNode: () => It3,
    $isQuoteNode: () => Ot4,
    DRAG_DROP_PASTE: () => wt4,
    HeadingNode: () => Pt4,
    QuoteNode: () => Et4,
    RichTextExtension: () => Wt3,
    eventFiles: () => Mt4,
    registerRichText: () => Jt3
  });
  function gt4(t2, e2) {
    if (void 0 !== document.caretRangeFromPoint) {
      const n2 = document.caretRangeFromPoint(t2, e2);
      return null === n2 ? null : { node: n2.startContainer, offset: n2.startOffset };
    }
    if ("undefined" !== document.caretPositionFromPoint) {
      const n2 = document.caretPositionFromPoint(t2, e2);
      return null === n2 ? null : { node: n2.offsetNode, offset: n2.offset };
    }
    return null;
  }
  var pt4 = "undefined" != typeof window && void 0 !== window.document && void 0 !== window.document.createElement;
  var ht4 = pt4 && "documentMode" in document ? document.documentMode : null;
  var vt4 = pt4 && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
  var Ct4 = !(!pt4 || !("InputEvent" in window) || ht4) && "getTargetRanges" in new window.InputEvent("input");
  var yt4 = pt4 && /Version\/[\d.]+.*Safari/.test(navigator.userAgent);
  var xt4 = pt4 && /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  var Dt4 = pt4 && /^(?=.*Chrome).*/i.test(navigator.userAgent);
  var Nt4 = pt4 && /AppleWebKit\/[\d.]+/.test(navigator.userAgent) && vt4 && !Dt4;
  var wt4 = createCommand("DRAG_DROP_PASTE_FILE");
  var Et4 = class _Et extends ElementNode {
    static getType() {
      return "quote";
    }
    static clone(t2) {
      return new _Et(t2.__key);
    }
    createDOM(t2) {
      const e2 = document.createElement("blockquote");
      return addClassNamesToElement(e2, t2.theme.quote), e2;
    }
    updateDOM(t2, e2) {
      return false;
    }
    static importDOM() {
      return { blockquote: (t2) => ({ conversion: Ft3, priority: 0 }) };
    }
    exportDOM(t2) {
      const { element: e2 } = super.exportDOM(t2);
      if (isHTMLElement2(e2)) {
        this.isEmpty() && e2.append(document.createElement("br"));
        const t3 = this.getFormatType();
        t3 && (e2.style.textAlign = t3);
        const n2 = this.getDirection();
        n2 && (e2.dir = n2);
      }
      return { element: e2 };
    }
    static importJSON(t2) {
      return _t4().updateFromJSON(t2);
    }
    insertNewAfter(t2, e2) {
      const n2 = $createParagraphNode(), r3 = this.getDirection();
      return n2.setDirection(r3), this.insertAfter(n2, e2), n2;
    }
    collapseAtStart() {
      const t2 = $createParagraphNode();
      return this.getChildren().forEach((e2) => t2.append(e2)), this.replace(t2), true;
    }
    canMergeWhenEmpty() {
      return true;
    }
  };
  function _t4() {
    return $applyNodeReplacement(new Et4());
  }
  function Ot4(t2) {
    return t2 instanceof Et4;
  }
  var Pt4 = class _Pt extends ElementNode {
    __tag;
    static getType() {
      return "heading";
    }
    static clone(t2) {
      return new _Pt(t2.__tag, t2.__key);
    }
    constructor(t2, e2) {
      super(e2), this.__tag = t2;
    }
    getTag() {
      return this.__tag;
    }
    setTag(t2) {
      const e2 = this.getWritable();
      return this.__tag = t2, e2;
    }
    createDOM(t2) {
      const e2 = this.__tag, n2 = document.createElement(e2), r3 = t2.theme.heading;
      if (void 0 !== r3) {
        const t3 = r3[e2];
        addClassNamesToElement(n2, t3);
      }
      return n2;
    }
    updateDOM(t2, e2, n2) {
      return t2.__tag !== this.__tag;
    }
    static importDOM() {
      return { h1: (t2) => ({ conversion: At4, priority: 0 }), h2: (t2) => ({ conversion: At4, priority: 0 }), h3: (t2) => ({ conversion: At4, priority: 0 }), h4: (t2) => ({ conversion: At4, priority: 0 }), h5: (t2) => ({ conversion: At4, priority: 0 }), h6: (t2) => ({ conversion: At4, priority: 0 }), p: (t2) => {
        const e2 = t2.firstChild;
        return null !== e2 && Tt4(e2) ? { conversion: () => ({ node: null }), priority: 3 } : null;
      }, span: (t2) => Tt4(t2) ? { conversion: (t3) => ({ node: St4("h1") }), priority: 3 } : null };
    }
    exportDOM(t2) {
      const { element: e2 } = super.exportDOM(t2);
      if (isHTMLElement2(e2)) {
        this.isEmpty() && e2.append(document.createElement("br"));
        const t3 = this.getFormatType();
        t3 && (e2.style.textAlign = t3);
        const n2 = this.getDirection();
        n2 && (e2.dir = n2);
      }
      return { element: e2 };
    }
    static importJSON(t2) {
      return St4(t2.tag).updateFromJSON(t2);
    }
    updateFromJSON(t2) {
      return super.updateFromJSON(t2).setTag(t2.tag);
    }
    exportJSON() {
      return { ...super.exportJSON(), tag: this.getTag() };
    }
    insertNewAfter(t2, e2 = true) {
      const n2 = t2 ? t2.anchor.offset : 0, r3 = this.getLastDescendant(), o2 = !r3 || t2 && t2.anchor.key === r3.getKey() && n2 === r3.getTextContentSize() || !t2 ? $createParagraphNode() : St4(this.getTag()), i3 = this.getDirection();
      if (o2.setDirection(i3), this.insertAfter(o2, e2), 0 === n2 && !this.isEmpty() && t2) {
        const t3 = $createParagraphNode();
        t3.select(), this.replace(t3, true);
      }
      return o2;
    }
    collapseAtStart() {
      const t2 = this.isEmpty() ? $createParagraphNode() : St4(this.getTag());
      return this.getChildren().forEach((e2) => t2.append(e2)), this.replace(t2), true;
    }
    extractWithChild() {
      return true;
    }
  };
  function Tt4(t2) {
    return "span" === t2.nodeName.toLowerCase() && "26pt" === t2.style.fontSize;
  }
  function At4(t2) {
    const e2 = t2.nodeName.toLowerCase();
    let n2 = null;
    return "h1" !== e2 && "h2" !== e2 && "h3" !== e2 && "h4" !== e2 && "h5" !== e2 && "h6" !== e2 || (n2 = St4(e2), null !== t2.style && (setNodeIndentFromDOM(t2, n2), n2.setFormat(t2.style.textAlign))), { node: n2 };
  }
  function Ft3(t2) {
    const e2 = _t4();
    return null !== t2.style && (e2.setFormat(t2.style.textAlign), setNodeIndentFromDOM(t2, e2)), { node: e2 };
  }
  function St4(t2 = "h1") {
    return $applyNodeReplacement(new Pt4(t2));
  }
  function It3(t2) {
    return t2 instanceof Pt4;
  }
  function Mt4(t2) {
    let e2 = null;
    if (objectKlassEquals(t2, DragEvent) ? e2 = t2.dataTransfer : objectKlassEquals(t2, ClipboardEvent) && (e2 = t2.clipboardData), null === e2) return [false, [], false];
    const n2 = e2.types, r3 = n2.includes("Files"), o2 = n2.includes("text/html") || n2.includes("text/plain");
    return [r3, Array.from(e2.files), o2];
  }
  function bt4(t2) {
    const e2 = $getSelection();
    if (!$isRangeSelection(e2)) return false;
    const n2 = /* @__PURE__ */ new Set(), r3 = e2.getNodes();
    for (let e3 = 0; e3 < r3.length; e3++) {
      const o2 = r3[e3], i3 = o2.getKey();
      if (n2.has(i3)) continue;
      const s4 = $findMatchingParent2(o2, (t3) => $isElementNode(t3) && !t3.isInline());
      if (null === s4) continue;
      const c3 = s4.getKey();
      s4.canIndent() && !n2.has(c3) && (n2.add(c3), t2(s4));
    }
    return n2.size > 0;
  }
  function Kt4(t2) {
    const e2 = $getNearestNodeFromDOMNode(t2);
    return $isDecoratorNode(e2);
  }
  function kt4(t2) {
    for (const e2 of ["lowercase", "uppercase", "capitalize"]) t2.hasFormat(e2) && t2.toggleFormat(e2);
  }
  function Jt3(n2) {
    return mergeRegister(n2.registerCommand(CLICK_COMMAND, (t2) => {
      const e2 = $getSelection();
      return !!$isNodeSelection(e2) && (e2.clear(), true);
    }, COMMAND_PRIORITY_EDITOR), n2.registerCommand(DELETE_CHARACTER_COMMAND, (t2) => {
      const e2 = $getSelection();
      return $isRangeSelection(e2) ? (e2.deleteCharacter(t2), true) : !!$isNodeSelection(e2) && (e2.deleteNodes(), true);
    }, COMMAND_PRIORITY_EDITOR), n2.registerCommand(DELETE_WORD_COMMAND, (t2) => {
      const e2 = $getSelection();
      return !!$isRangeSelection(e2) && (e2.deleteWord(t2), true);
    }, COMMAND_PRIORITY_EDITOR), n2.registerCommand(DELETE_LINE_COMMAND, (t2) => {
      const e2 = $getSelection();
      return !!$isRangeSelection(e2) && (e2.deleteLine(t2), true);
    }, COMMAND_PRIORITY_EDITOR), n2.registerCommand(CONTROLLED_TEXT_INSERTION_COMMAND, (e2) => {
      const r3 = $getSelection();
      if ("string" == typeof e2) null !== r3 && r3.insertText(e2);
      else {
        if (null === r3) return false;
        const o2 = e2.dataTransfer;
        if (null != o2) $insertDataTransferForRichText(o2, r3, n2);
        else if ($isRangeSelection(r3)) {
          const t2 = e2.data;
          return t2 && r3.insertText(t2), true;
        }
      }
      return true;
    }, COMMAND_PRIORITY_EDITOR), n2.registerCommand(REMOVE_TEXT_COMMAND, () => {
      const t2 = $getSelection();
      return !!$isRangeSelection(t2) && (t2.removeText(), true);
    }, COMMAND_PRIORITY_EDITOR), n2.registerCommand(FORMAT_TEXT_COMMAND, (t2) => {
      const e2 = $getSelection();
      return !!$isRangeSelection(e2) && (e2.formatText(t2), true);
    }, COMMAND_PRIORITY_EDITOR), n2.registerCommand(FORMAT_ELEMENT_COMMAND, (t2) => {
      const e2 = $getSelection();
      if (!$isRangeSelection(e2) && !$isNodeSelection(e2)) return false;
      const n3 = e2.getNodes();
      for (const e3 of n3) {
        const n4 = $findMatchingParent2(e3, (t3) => $isElementNode(t3) && !t3.isInline());
        null !== n4 && n4.setFormat(t2);
      }
      return true;
    }, COMMAND_PRIORITY_EDITOR), n2.registerCommand(INSERT_LINE_BREAK_COMMAND, (t2) => {
      const e2 = $getSelection();
      return !!$isRangeSelection(e2) && (e2.insertLineBreak(t2), true);
    }, COMMAND_PRIORITY_EDITOR), n2.registerCommand(INSERT_PARAGRAPH_COMMAND, () => {
      const t2 = $getSelection();
      return !!$isRangeSelection(t2) && (t2.insertParagraph(), true);
    }, COMMAND_PRIORITY_EDITOR), n2.registerCommand(INSERT_TAB_COMMAND, () => ($insertNodes([$createTabNode()]), true), COMMAND_PRIORITY_EDITOR), n2.registerCommand(INDENT_CONTENT_COMMAND, () => bt4((t2) => {
      const e2 = t2.getIndent();
      t2.setIndent(e2 + 1);
    }), COMMAND_PRIORITY_EDITOR), n2.registerCommand(OUTDENT_CONTENT_COMMAND, () => bt4((t2) => {
      const e2 = t2.getIndent();
      e2 > 0 && t2.setIndent(Math.max(0, e2 - 1));
    }), COMMAND_PRIORITY_EDITOR), n2.registerCommand(KEY_ARROW_UP_COMMAND, (t2) => {
      const e2 = $getSelection();
      if ($isNodeSelection(e2)) {
        const n3 = e2.getNodes();
        if (n3.length > 0) return t2.preventDefault(), n3[0].selectPrevious(), true;
      } else if ($isRangeSelection(e2)) {
        const n3 = $getAdjacentNode(e2.focus, true);
        if (!t2.shiftKey && $isDecoratorNode(n3) && !n3.isIsolated() && !n3.isInline()) return n3.selectPrevious(), t2.preventDefault(), true;
      }
      return false;
    }, COMMAND_PRIORITY_EDITOR), n2.registerCommand(KEY_ARROW_DOWN_COMMAND, (t2) => {
      const e2 = $getSelection();
      if ($isNodeSelection(e2)) {
        const n3 = e2.getNodes();
        if (n3.length > 0) return t2.preventDefault(), n3[0].selectNext(0, 0), true;
      } else if ($isRangeSelection(e2)) {
        if ((function(t3) {
          const e3 = t3.focus;
          return "root" === e3.key && e3.offset === $getRoot().getChildrenSize();
        })(e2)) return t2.preventDefault(), true;
        const n3 = $getAdjacentNode(e2.focus, false);
        if (!t2.shiftKey && $isDecoratorNode(n3) && !n3.isIsolated() && !n3.isInline()) return n3.selectNext(), t2.preventDefault(), true;
      }
      return false;
    }, COMMAND_PRIORITY_EDITOR), n2.registerCommand(KEY_ARROW_LEFT_COMMAND, (t2) => {
      const e2 = $getSelection();
      if ($isNodeSelection(e2)) {
        const n3 = e2.getNodes();
        if (n3.length > 0) return t2.preventDefault(), $isParentRTL(n3[0]) ? n3[0].selectNext(0, 0) : n3[0].selectPrevious(), true;
      }
      if (!$isRangeSelection(e2)) return false;
      if ($shouldOverrideDefaultCharacterSelection(e2, true)) {
        const n3 = t2.shiftKey;
        return t2.preventDefault(), $moveCharacter(e2, n3, true), true;
      }
      return false;
    }, COMMAND_PRIORITY_EDITOR), n2.registerCommand(KEY_ARROW_RIGHT_COMMAND, (t2) => {
      const e2 = $getSelection();
      if ($isNodeSelection(e2)) {
        const n4 = e2.getNodes();
        if (n4.length > 0) return t2.preventDefault(), $isParentRTL(n4[0]) ? n4[0].selectPrevious() : n4[0].selectNext(0, 0), true;
      }
      if (!$isRangeSelection(e2)) return false;
      const n3 = t2.shiftKey;
      return !!$shouldOverrideDefaultCharacterSelection(e2, false) && (t2.preventDefault(), $moveCharacter(e2, n3, false), true);
    }, COMMAND_PRIORITY_EDITOR), n2.registerCommand(KEY_BACKSPACE_COMMAND, (t2) => {
      if (Kt4(t2.target)) return false;
      const e2 = $getSelection();
      if ($isRangeSelection(e2)) {
        if ((function(t3) {
          if (!t3.isCollapsed()) return false;
          const { anchor: e3 } = t3;
          if (0 !== e3.offset) return false;
          const n3 = e3.getNode();
          if ($isRootNode(n3)) return false;
          const r3 = $getNearestBlockElementAncestorOrThrow(n3);
          return r3.getIndent() > 0 && (r3.is(n3) || n3.is(r3.getFirstDescendant()));
        })(e2)) return t2.preventDefault(), n2.dispatchCommand(OUTDENT_CONTENT_COMMAND, void 0);
        if (xt4 && "ko-KR" === navigator.language) return false;
      } else if (!$isNodeSelection(e2)) return false;
      return t2.preventDefault(), n2.dispatchCommand(DELETE_CHARACTER_COMMAND, true);
    }, COMMAND_PRIORITY_EDITOR), n2.registerCommand(KEY_DELETE_COMMAND, (t2) => {
      if (Kt4(t2.target)) return false;
      const e2 = $getSelection();
      return !(!$isRangeSelection(e2) && !$isNodeSelection(e2)) && (t2.preventDefault(), n2.dispatchCommand(DELETE_CHARACTER_COMMAND, false));
    }, COMMAND_PRIORITY_EDITOR), n2.registerCommand(KEY_ENTER_COMMAND, (t2) => {
      const e2 = $getSelection();
      if (!$isRangeSelection(e2)) return false;
      if (kt4(e2), null !== t2) {
        if ((xt4 || yt4 || Nt4) && Ct4) return false;
        if (t2.preventDefault(), t2.shiftKey) return n2.dispatchCommand(INSERT_LINE_BREAK_COMMAND, false);
      }
      return n2.dispatchCommand(INSERT_PARAGRAPH_COMMAND, void 0);
    }, COMMAND_PRIORITY_EDITOR), n2.registerCommand(KEY_ESCAPE_COMMAND, () => {
      const t2 = $getSelection();
      return !!$isRangeSelection(t2) && (n2.blur(), true);
    }, COMMAND_PRIORITY_EDITOR), n2.registerCommand(DROP_COMMAND, (t2) => {
      const [, e2] = Mt4(t2);
      if (e2.length > 0) {
        const r4 = gt4(t2.clientX, t2.clientY);
        if (null !== r4) {
          const { offset: t3, node: o2 } = r4, i3 = $getNearestNodeFromDOMNode(o2);
          if (null !== i3) {
            const e3 = $createRangeSelection();
            if ($isTextNode(i3)) e3.anchor.set(i3.getKey(), t3, "text"), e3.focus.set(i3.getKey(), t3, "text");
            else {
              const t4 = i3.getParentOrThrow().getKey(), n4 = i3.getIndexWithinParent() + 1;
              e3.anchor.set(t4, n4, "element"), e3.focus.set(t4, n4, "element");
            }
            const n3 = $normalizeSelection__EXPERIMENTAL(e3);
            $setSelection(n3);
          }
          n2.dispatchCommand(wt4, e2);
        }
        return t2.preventDefault(), true;
      }
      const r3 = $getSelection();
      return !!$isRangeSelection(r3);
    }, COMMAND_PRIORITY_EDITOR), n2.registerCommand(DRAGSTART_COMMAND, (t2) => {
      const [e2] = Mt4(t2), n3 = $getSelection();
      return !(e2 && !$isRangeSelection(n3));
    }, COMMAND_PRIORITY_EDITOR), n2.registerCommand(DRAGOVER_COMMAND, (t2) => {
      const [e2] = Mt4(t2), n3 = $getSelection();
      if (e2 && !$isRangeSelection(n3)) return false;
      const r3 = gt4(t2.clientX, t2.clientY);
      if (null !== r3) {
        const e3 = $getNearestNodeFromDOMNode(r3.node);
        $isDecoratorNode(e3) && t2.preventDefault();
      }
      return true;
    }, COMMAND_PRIORITY_EDITOR), n2.registerCommand(SELECT_ALL_COMMAND, () => ($selectAll(), true), COMMAND_PRIORITY_EDITOR), n2.registerCommand(COPY_COMMAND, (t2) => (copyToClipboard(n2, objectKlassEquals(t2, ClipboardEvent) ? t2 : null), true), COMMAND_PRIORITY_EDITOR), n2.registerCommand(CUT_COMMAND, (t2) => ((async function(t3, n3) {
      await copyToClipboard(n3, objectKlassEquals(t3, ClipboardEvent) ? t3 : null), n3.update(() => {
        const t4 = $getSelection();
        $isRangeSelection(t4) ? t4.removeText() : $isNodeSelection(t4) && t4.getNodes().forEach((t5) => t5.remove());
      });
    })(t2, n2), true), COMMAND_PRIORITY_EDITOR), n2.registerCommand(PASTE_COMMAND, (e2) => {
      const [, r3, o2] = Mt4(e2);
      if (r3.length > 0 && !o2) return n2.dispatchCommand(wt4, r3), true;
      if (isDOMNode(e2.target) && isSelectionCapturedInDecoratorInput(e2.target)) return false;
      return null !== $getSelection() && ((function(e3, n3) {
        e3.preventDefault(), n3.update(() => {
          const r4 = $getSelection(), o3 = objectKlassEquals(e3, InputEvent) || objectKlassEquals(e3, KeyboardEvent) ? null : e3.clipboardData;
          null != o3 && null !== r4 && $insertDataTransferForRichText(o3, r4, n3);
        }, { tag: PASTE_TAG });
      })(e2, n2), true);
    }, COMMAND_PRIORITY_EDITOR), n2.registerCommand(KEY_SPACE_COMMAND, (t2) => {
      const e2 = $getSelection();
      return $isRangeSelection(e2) && kt4(e2), false;
    }, COMMAND_PRIORITY_EDITOR), n2.registerCommand(KEY_TAB_COMMAND, (t2) => {
      const e2 = $getSelection();
      return $isRangeSelection(e2) && kt4(e2), false;
    }, COMMAND_PRIORITY_EDITOR));
  }
  var Wt3 = defineExtension({ conflictsWith: ["@lexical/plain-text"], dependencies: [DragonExtension], name: "@lexical/rich-text", nodes: () => [Pt4, Et4], register: Jt3 });

  // node_modules/@lexical/rich-text/LexicalRichText.mjs
  var mod8 = false ? LexicalRichText_dev_exports : LexicalRichText_prod_exports;
  var $createHeadingNode = mod8.$createHeadingNode;
  var $createQuoteNode = mod8.$createQuoteNode;
  var $isHeadingNode = mod8.$isHeadingNode;
  var $isQuoteNode = mod8.$isQuoteNode;
  var DRAG_DROP_PASTE = mod8.DRAG_DROP_PASTE;
  var HeadingNode = mod8.HeadingNode;
  var QuoteNode = mod8.QuoteNode;
  var RichTextExtension = mod8.RichTextExtension;
  var eventFiles = mod8.eventFiles;
  var registerRichText = mod8.registerRichText;

  // node_modules/@lexical/history/LexicalHistory.prod.mjs
  var LexicalHistory_prod_exports = {};
  __export(LexicalHistory_prod_exports, {
    HistoryExtension: () => E4,
    SharedHistoryExtension: () => H5,
    createEmptyHistoryState: () => w3,
    registerHistory: () => b4
  });
  function x3(t2, e2, n2, r3, o2) {
    if (null === t2 || 0 === n2.size && 0 === r3.size && !o2) return 0;
    const i3 = e2._selection, a3 = t2._selection;
    if (o2) return 1;
    if (!($isRangeSelection(i3) && $isRangeSelection(a3) && a3.isCollapsed() && i3.isCollapsed())) return 0;
    const s4 = (function(t3, e3, n3) {
      const r4 = t3._nodeMap, o3 = [];
      for (const t4 of e3) {
        const e4 = r4.get(t4);
        void 0 !== e4 && o3.push(e4);
      }
      for (const [t4, e4] of n3) {
        if (!e4) continue;
        const n4 = r4.get(t4);
        void 0 === n4 || $isRootNode(n4) || o3.push(n4);
      }
      return o3;
    })(e2, n2, r3);
    if (0 === s4.length) return 0;
    if (s4.length > 1) {
      const n3 = e2._nodeMap, r4 = n3.get(i3.anchor.key), o3 = n3.get(a3.anchor.key);
      return r4 && o3 && !t2._nodeMap.has(r4.__key) && $isTextNode(r4) && 1 === r4.__text.length && 1 === i3.anchor.offset ? 2 : 0;
    }
    const c3 = s4[0], d4 = t2._nodeMap.get(c3.__key);
    if (!$isTextNode(d4) || !$isTextNode(c3) || d4.__mode !== c3.__mode) return 0;
    const u3 = d4.__text, l3 = c3.__text;
    if (u3 === l3) return 0;
    const f3 = i3.anchor, p3 = a3.anchor;
    if (f3.key !== p3.key || "text" !== f3.type) return 0;
    const h2 = f3.offset, m3 = p3.offset, y4 = l3.length - u3.length;
    return 1 === y4 && m3 === h2 - 1 ? 2 : -1 === y4 && m3 === h2 + 1 ? 3 : -1 === y4 && m3 === h2 ? 4 : 0;
  }
  function C3(t2, e2) {
    let n2 = Date.now(), r3 = 0;
    return (o2, i3, a3, s4, c3, d4) => {
      const u3 = Date.now();
      if (d4.has(HISTORIC_TAG)) return r3 = 0, n2 = u3, 2;
      const l3 = x3(o2, i3, s4, c3, t2.isComposing()), f3 = (() => {
        const f4 = null === a3 || a3.editor === t2, p3 = d4.has(HISTORY_PUSH_TAG);
        if (!p3 && f4 && d4.has(HISTORY_MERGE_TAG)) return 0;
        if (null === o2) return 1;
        const h2 = i3._selection;
        if (!(s4.size > 0 || c3.size > 0)) return null !== h2 ? 0 : 2;
        const m3 = "number" == typeof e2 ? e2 : e2.peek();
        if (false === p3 && 0 !== l3 && l3 === r3 && u3 < n2 + m3 && f4) return 0;
        if (1 === s4.size) {
          if ((function(t3, e3, n3) {
            const r4 = e3._nodeMap.get(t3), o3 = n3._nodeMap.get(t3), i4 = e3._selection, a4 = n3._selection;
            return !($isRangeSelection(i4) && $isRangeSelection(a4) && "element" === i4.anchor.type && "element" === i4.focus.type && "text" === a4.anchor.type && "text" === a4.focus.type || !$isTextNode(r4) || !$isTextNode(o3) || r4.__parent !== o3.__parent) && JSON.stringify(e3.read(() => r4.exportJSON())) === JSON.stringify(n3.read(() => o3.exportJSON()));
          })(Array.from(s4)[0], o2, i3)) return 0;
        }
        return 1;
      })();
      return n2 = u3, r3 = l3, f3;
    };
  }
  function v3(t2) {
    t2.undoStack = [], t2.redoStack = [], t2.current = null;
  }
  function b4(t2, e2, n2) {
    const r3 = C3(t2, n2), i3 = mergeRegister(t2.registerCommand(UNDO_COMMAND, () => ((function(t3, e3) {
      const n3 = e3.redoStack, r4 = e3.undoStack;
      if (0 !== r4.length) {
        const o2 = e3.current, i4 = r4.pop();
        null !== o2 && (n3.push(o2), t3.dispatchCommand(CAN_REDO_COMMAND, true)), 0 === r4.length && t3.dispatchCommand(CAN_UNDO_COMMAND, false), e3.current = i4 || null, i4 && i4.editor.setEditorState(i4.editorState, { tag: HISTORIC_TAG });
      }
    })(t2, e2), true), COMMAND_PRIORITY_EDITOR), t2.registerCommand(REDO_COMMAND, () => ((function(t3, e3) {
      const n3 = e3.redoStack, r4 = e3.undoStack;
      if (0 !== n3.length) {
        const o2 = e3.current;
        null !== o2 && (r4.push(o2), t3.dispatchCommand(CAN_UNDO_COMMAND, true));
        const i4 = n3.pop();
        0 === n3.length && t3.dispatchCommand(CAN_REDO_COMMAND, false), e3.current = i4 || null, i4 && i4.editor.setEditorState(i4.editorState, { tag: HISTORIC_TAG });
      }
    })(t2, e2), true), COMMAND_PRIORITY_EDITOR), t2.registerCommand(CLEAR_EDITOR_COMMAND, () => (v3(e2), false), COMMAND_PRIORITY_EDITOR), t2.registerCommand(CLEAR_HISTORY_COMMAND, () => (v3(e2), t2.dispatchCommand(CAN_REDO_COMMAND, false), t2.dispatchCommand(CAN_UNDO_COMMAND, false), true), COMMAND_PRIORITY_EDITOR), t2.registerUpdateListener(({ editorState: n3, prevEditorState: o2, dirtyLeaves: i4, dirtyElements: a3, tags: s4 }) => {
      const c3 = e2.current, d4 = e2.redoStack, u3 = e2.undoStack, l3 = null === c3 ? null : c3.editorState;
      if (null !== c3 && n3 === l3) return;
      const f3 = r3(o2, n3, c3, i4, a3, s4);
      if (1 === f3) 0 !== d4.length && (e2.redoStack = [], t2.dispatchCommand(CAN_REDO_COMMAND, false)), null !== c3 && (u3.push({ ...c3 }), t2.dispatchCommand(CAN_UNDO_COMMAND, true));
      else if (2 === f3) return;
      e2.current = { editor: t2, editorState: n3 };
    }));
    return i3;
  }
  function w3() {
    return { current: null, redoStack: [], undoStack: [] };
  }
  var E4 = defineExtension({ build: (e2, { delay: n2, createInitialHistoryState: r3, disabled: o2 }) => namedSignals({ delay: n2, disabled: o2, historyState: r3(e2) }), config: safeCast({ createInitialHistoryState: w3, delay: 300, disabled: "undefined" == typeof window }), name: "@lexical/history/History", register: (t2, n2, r3) => {
    const o2 = r3.getOutput();
    return effect(() => o2.disabled.value ? void 0 : b4(t2, o2.historyState.value, o2.delay));
  } });
  var H5 = defineExtension({ dependencies: [configExtension(E4, { createInitialHistoryState: () => {
    throw new Error("SharedHistory did not inherit parent history");
  }, disabled: true })], name: "@lexical/history/SharedHistory", register(t2, o2, i3) {
    const { output: a3 } = i3.getDependency(E4), s4 = (function(t3) {
      return t3 ? getPeerDependencyFromEditor(t3, E4.name) : null;
    })(t2._parentEditor);
    if (!s4) return () => {
    };
    const c3 = s4.output;
    return effect(() => batch(() => {
      a3.delay.value = c3.delay.value, a3.historyState.value = c3.historyState.value, a3.disabled.value = c3.disabled.value;
    }));
  } });

  // node_modules/@lexical/history/LexicalHistory.mjs
  var mod9 = false ? LexicalHistory_dev_exports : LexicalHistory_prod_exports;
  var HistoryExtension = mod9.HistoryExtension;
  var SharedHistoryExtension = mod9.SharedHistoryExtension;
  var createEmptyHistoryState = mod9.createEmptyHistoryState;
  var registerHistory = mod9.registerHistory;

  // node_modules/@lexical/list/LexicalList.prod.mjs
  var LexicalList_prod_exports = {};
  __export(LexicalList_prod_exports, {
    $createListItemNode: () => st4,
    $createListNode: () => ht5,
    $getListDepth: () => W5,
    $handleListInsertParagraph: () => tt4,
    $insertList: () => j4,
    $isListItemNode: () => ot4,
    $isListNode: () => dt4,
    $removeList: () => G5,
    CheckListExtension: () => At5,
    INSERT_CHECK_LIST_COMMAND: () => ft4,
    INSERT_ORDERED_LIST_COMMAND: () => xt5,
    INSERT_UNORDERED_LIST_COMMAND: () => St5,
    ListExtension: () => Pt5,
    ListItemNode: () => nt4,
    ListNode: () => lt4,
    REMOVE_LIST_COMMAND: () => kt5,
    UPDATE_LIST_START_COMMAND: () => vt5,
    insertList: () => Nt5,
    registerCheckList: () => pt5,
    registerList: () => bt5,
    registerListStrictIndentTransform: () => Lt4,
    removeList: () => Ft4
  });
  function K4(t2, ...e2) {
    const n2 = new URL("https://lexical.dev/docs/error"), r3 = new URLSearchParams();
    r3.append("code", t2);
    for (const t3 of e2) r3.append("v", t3);
    throw n2.search = r3.toString(), Error(`Minified Lexical error #${t2}; visit ${n2.toString()} for the full message or use the non-minified dev environment for full errors and additional helpful warnings.`);
  }
  function W5(t2) {
    let e2 = 1, n2 = t2.getParent();
    for (; null != n2; ) {
      if (ot4(n2)) {
        const t3 = n2.getParent();
        if (dt4(t3)) {
          e2++, n2 = t3.getParent();
          continue;
        }
        K4(40);
      }
      return e2;
    }
    return e2;
  }
  function J6(t2) {
    let e2 = t2.getParent();
    dt4(e2) || K4(40);
    let n2 = e2;
    for (; null !== n2; ) n2 = n2.getParent(), dt4(n2) && (e2 = n2);
    return e2;
  }
  function U4(t2) {
    let e2 = [];
    const n2 = t2.getChildren().filter(ot4);
    for (let t3 = 0; t3 < n2.length; t3++) {
      const r3 = n2[t3], i3 = r3.getFirstChild();
      dt4(i3) ? e2 = e2.concat(U4(i3)) : e2.push(r3);
    }
    return e2;
  }
  function $4(t2) {
    return ot4(t2) && dt4(t2.getFirstChild());
  }
  function V5(t2) {
    return st4().append(t2);
  }
  function z4(t2, e2) {
    return ot4(t2) && (0 === e2.length || 1 === e2.length && t2.is(e2[0]) && 0 === t2.getChildrenSize());
  }
  function j4(t2) {
    const e2 = $getSelection();
    if (null !== e2) {
      let n2 = e2.getNodes();
      if ($isRangeSelection(e2)) {
        const r4 = e2.getStartEndPoints();
        null === r4 && K4(143);
        const [i3] = r4, s4 = i3.getNode(), o2 = s4.getParent();
        if ($isRootOrShadowRoot(s4)) {
          const t3 = s4.getFirstChild();
          if (t3) n2 = t3.selectStart().getNodes();
          else {
            const t4 = $createParagraphNode();
            s4.append(t4), n2 = t4.select().getNodes();
          }
        } else if (z4(s4, n2)) {
          const e3 = ht5(t2);
          if ($isRootOrShadowRoot(o2)) {
            s4.replace(e3);
            const t3 = st4();
            $isElementNode(s4) && (t3.setFormat(s4.getFormatType()), t3.setIndent(s4.getIndent())), e3.append(t3);
          } else if (ot4(s4)) {
            const t3 = s4.getParentOrThrow();
            q5(e3, t3.getChildren()), t3.replace(e3);
          }
          return;
        }
      }
      const r3 = /* @__PURE__ */ new Set();
      for (let e3 = 0; e3 < n2.length; e3++) {
        const i3 = n2[e3];
        if ($isElementNode(i3) && i3.isEmpty() && !ot4(i3) && !r3.has(i3.getKey())) {
          H6(i3, t2);
          continue;
        }
        let s4 = $isLeafNode(i3) ? i3.getParent() : ot4(i3) && i3.isEmpty() ? i3 : null;
        for (; null != s4; ) {
          const e4 = s4.getKey();
          if (dt4(s4)) {
            if (!r3.has(e4)) {
              const n3 = ht5(t2);
              q5(n3, s4.getChildren()), s4.replace(n3), r3.add(e4);
            }
            break;
          }
          {
            const n3 = s4.getParent();
            if ($isRootOrShadowRoot(n3) && !r3.has(e4)) {
              r3.add(e4), H6(s4, t2);
              break;
            }
            s4 = n3;
          }
        }
      }
    }
  }
  function q5(t2, e2) {
    t2.splice(t2.getChildrenSize(), 0, e2);
  }
  function H6(t2, e2) {
    if (dt4(t2)) return t2;
    const n2 = t2.getPreviousSibling(), r3 = t2.getNextSibling(), i3 = st4();
    let s4;
    if (q5(i3, t2.getChildren()), dt4(n2) && e2 === n2.getListType()) n2.append(i3), dt4(r3) && e2 === r3.getListType() && (q5(n2, r3.getChildren()), r3.remove()), s4 = n2;
    else if (dt4(r3) && e2 === r3.getListType()) r3.getFirstChildOrThrow().insertBefore(i3), s4 = r3;
    else {
      const n3 = ht5(e2);
      n3.append(i3), t2.replace(n3), s4 = n3;
    }
    return i3.setFormat(t2.getFormatType()), i3.setIndent(t2.getIndent()), t2.remove(), s4;
  }
  function X5(t2, e2) {
    const n2 = t2.getLastChild(), r3 = e2.getFirstChild();
    n2 && r3 && $4(n2) && $4(r3) && (X5(n2.getFirstChild(), r3.getFirstChild()), r3.remove());
    const i3 = e2.getChildren();
    i3.length > 0 && t2.append(...i3), e2.remove();
  }
  function G5() {
    const t2 = $getSelection();
    if ($isRangeSelection(t2)) {
      const e2 = /* @__PURE__ */ new Set(), r3 = t2.getNodes(), i3 = t2.anchor.getNode();
      if (z4(i3, r3)) e2.add(J6(i3));
      else for (let t3 = 0; t3 < r3.length; t3++) {
        const i4 = r3[t3];
        if ($isLeafNode(i4)) {
          const t4 = $getNearestNodeOfType(i4, nt4);
          null != t4 && e2.add(J6(t4));
        }
      }
      for (const n2 of e2) {
        let e3 = n2;
        const r4 = U4(n2);
        for (const n3 of r4) {
          const r5 = $createParagraphNode().setTextStyle(t2.style).setTextFormat(t2.format);
          q5(r5, n3.getChildren()), e3.insertAfter(r5), e3 = r5, n3.__key === t2.anchor.key && $setPointFromCaret(t2.anchor, $normalizeCaret($getChildCaret(r5, "next"))), n3.__key === t2.focus.key && $setPointFromCaret(t2.focus, $normalizeCaret($getChildCaret(r5, "next"))), n3.remove();
        }
        n2.remove();
      }
    }
  }
  function Q5(t2) {
    const e2 = "check" !== t2.getListType();
    let n2 = t2.getStart();
    for (const r3 of t2.getChildren()) ot4(r3) && (r3.getValue() !== n2 && r3.setValue(n2), e2 && null != r3.getLatest().__checked && r3.setChecked(void 0), dt4(r3.getFirstChild()) || n2++);
  }
  function Y5(t2) {
    const e2 = /* @__PURE__ */ new Set();
    if ($4(t2) || e2.has(t2.getKey())) return;
    const n2 = t2.getParent(), r3 = t2.getNextSibling(), i3 = t2.getPreviousSibling();
    if ($4(r3) && $4(i3)) {
      const n3 = i3.getFirstChild();
      if (dt4(n3)) {
        n3.append(t2);
        const i4 = r3.getFirstChild();
        if (dt4(i4)) {
          q5(n3, i4.getChildren()), r3.remove(), e2.add(r3.getKey());
        }
      }
    } else if ($4(r3)) {
      const e3 = r3.getFirstChild();
      if (dt4(e3)) {
        const n3 = e3.getFirstChild();
        null !== n3 && n3.insertBefore(t2);
      }
    } else if ($4(i3)) {
      const e3 = i3.getFirstChild();
      dt4(e3) && e3.append(t2);
    } else if (dt4(n2)) {
      const e3 = st4().setTextFormat(t2.getTextFormat()).setTextStyle(t2.getTextStyle()), s4 = ht5(n2.getListType()).setTextFormat(n2.getTextFormat()).setTextStyle(n2.getTextStyle());
      e3.append(s4), s4.append(t2), i3 ? i3.insertAfter(e3) : r3 ? r3.insertBefore(e3) : n2.append(e3);
    }
  }
  function Z5(t2) {
    if ($4(t2)) return;
    const e2 = t2.getParent(), n2 = e2 ? e2.getParent() : void 0;
    if (dt4(n2 ? n2.getParent() : void 0) && ot4(n2) && dt4(e2)) {
      const r3 = e2 ? e2.getFirstChild() : void 0, i3 = e2 ? e2.getLastChild() : void 0;
      if (t2.is(r3)) n2.insertBefore(t2), e2.isEmpty() && n2.remove();
      else if (t2.is(i3)) n2.insertAfter(t2), e2.isEmpty() && n2.remove();
      else {
        const r4 = e2.getListType(), i4 = st4(), s4 = ht5(r4);
        i4.append(s4), t2.getPreviousSiblings().forEach((t3) => s4.append(t3));
        const o2 = st4(), l3 = ht5(r4);
        o2.append(l3), q5(l3, t2.getNextSiblings()), n2.insertBefore(i4), n2.insertAfter(o2), n2.replace(t2);
      }
    }
  }
  function tt4() {
    const t2 = $getSelection();
    if (!$isRangeSelection(t2) || !t2.isCollapsed()) return false;
    const e2 = t2.anchor.getNode();
    if (!ot4(e2) || 0 !== e2.getChildrenSize()) return false;
    const n2 = J6(e2), r3 = e2.getParent();
    dt4(r3) || K4(40);
    const i3 = r3.getParent();
    let s4;
    if ($isRootOrShadowRoot(i3)) s4 = $createParagraphNode(), n2.insertAfter(s4);
    else {
      if (!ot4(i3)) return false;
      s4 = st4(), i3.insertAfter(s4);
    }
    s4.setTextStyle(t2.style).setTextFormat(t2.format).select();
    const o2 = e2.getNextSiblings();
    if (o2.length > 0) {
      const t3 = ht5(r3.getListType());
      if (ot4(s4)) {
        const e3 = st4();
        e3.append(t3), s4.insertAfter(e3);
      } else s4.insertAfter(t3);
      t3.append(...o2);
    }
    return (function(t3) {
      let e3 = t3;
      for (; null == e3.getNextSibling() && null == e3.getPreviousSibling(); ) {
        const t4 = e3.getParent();
        if (null == t4 || !ot4(t4) && !dt4(t4)) break;
        e3 = t4;
      }
      e3.remove();
    })(e2), true;
  }
  function et4(...t2) {
    const e2 = [];
    for (const n2 of t2) if (n2 && "string" == typeof n2) for (const [t3] of n2.matchAll(/\S+/g)) e2.push(t3);
    return e2;
  }
  var nt4 = class extends ElementNode {
    __value;
    __checked;
    $config() {
      return this.config("listitem", { $transform: (t2) => {
        if (null == t2.__checked) return;
        const e2 = t2.getParent();
        dt4(e2) && "check" !== e2.getListType() && null != t2.getChecked() && t2.setChecked(void 0);
      }, extends: ElementNode, importDOM: buildImportMap({ li: () => ({ conversion: rt4, priority: 0 }) }) });
    }
    constructor(t2 = 1, e2 = void 0, n2) {
      super(n2), this.__value = void 0 === t2 ? 1 : t2, this.__checked = e2;
    }
    afterCloneFrom(t2) {
      super.afterCloneFrom(t2), this.__value = t2.__value, this.__checked = t2.__checked;
    }
    createDOM(t2) {
      const e2 = document.createElement("li");
      return this.updateListItemDOM(null, e2, t2), e2;
    }
    updateListItemDOM(t2, e2, n2) {
      !(function(t3, e3, n3) {
        const r3 = e3.getParent();
        !dt4(r3) || "check" !== r3.getListType() || dt4(e3.getFirstChild()) ? (t3.removeAttribute("role"), t3.removeAttribute("tabIndex"), t3.removeAttribute("aria-checked")) : (t3.setAttribute("role", "checkbox"), t3.setAttribute("tabIndex", "-1"), n3 && e3.__checked === n3.__checked || t3.setAttribute("aria-checked", e3.getChecked() ? "true" : "false"));
      })(e2, this, t2), e2.value = this.__value, (function(t3, e3, n3) {
        const s5 = [], o3 = [], l3 = e3.list, c3 = l3 ? l3.listitem : void 0;
        let a3;
        l3 && l3.nested && (a3 = l3.nested.listitem);
        void 0 !== c3 && s5.push(...et4(c3));
        if (l3) {
          const t4 = n3.getParent(), e4 = dt4(t4) && "check" === t4.getListType(), r3 = n3.getChecked();
          e4 && !r3 || o3.push(l3.listitemUnchecked), e4 && r3 || o3.push(l3.listitemChecked), e4 && s5.push(r3 ? l3.listitemChecked : l3.listitemUnchecked);
        }
        if (void 0 !== a3) {
          const t4 = et4(a3);
          n3.getChildren().some((t5) => dt4(t5)) ? s5.push(...t4) : o3.push(...t4);
        }
        o3.length > 0 && removeClassNamesFromElement(t3, ...o3);
        s5.length > 0 && addClassNamesToElement(t3, ...s5);
      })(e2, n2.theme, this);
      const s4 = t2 ? t2.__style : "", o2 = this.__style;
      s4 !== o2 && ("" === o2 ? e2.removeAttribute("style") : e2.style.cssText = o2), (function(t3, e3, n3) {
        const r3 = getStyleObjectFromCSS(e3.__textStyle);
        for (const e4 in r3) t3.style.setProperty(`--listitem-marker-${e4}`, r3[e4]);
        if (n3) for (const e4 in getStyleObjectFromCSS(n3.__textStyle)) e4 in r3 || t3.style.removeProperty(`--listitem-marker-${e4}`);
      })(e2, this, t2);
    }
    updateDOM(t2, e2, n2) {
      const r3 = e2;
      return this.updateListItemDOM(t2, r3, n2), false;
    }
    updateFromJSON(t2) {
      return super.updateFromJSON(t2).setValue(t2.value).setChecked(t2.checked);
    }
    exportDOM(t2) {
      const e2 = this.createDOM(t2._config), n2 = this.getFormatType();
      n2 && (e2.style.textAlign = n2);
      const r3 = this.getDirection();
      return r3 && (e2.dir = r3), { element: e2 };
    }
    exportJSON() {
      return { ...super.exportJSON(), checked: this.getChecked(), value: this.getValue() };
    }
    append(...t2) {
      for (let e2 = 0; e2 < t2.length; e2++) {
        const n2 = t2[e2];
        if ($isElementNode(n2) && this.canMergeWith(n2)) {
          const t3 = n2.getChildren();
          this.append(...t3), n2.remove();
        } else super.append(n2);
      }
      return this;
    }
    replace(t2, e2) {
      if (ot4(t2)) return super.replace(t2);
      this.setIndent(0);
      const n2 = this.getParentOrThrow();
      if (!dt4(n2)) return t2;
      if (n2.__first === this.getKey()) n2.insertBefore(t2);
      else if (n2.__last === this.getKey()) n2.insertAfter(t2);
      else {
        const e3 = ht5(n2.getListType());
        let r3 = this.getNextSibling();
        for (; r3; ) {
          const t3 = r3;
          r3 = r3.getNextSibling(), e3.append(t3);
        }
        n2.insertAfter(t2), t2.insertAfter(e3);
      }
      return e2 && ($isElementNode(t2) || K4(139), this.getChildren().forEach((e3) => {
        t2.append(e3);
      })), this.remove(), 0 === n2.getChildrenSize() && n2.remove(), t2;
    }
    insertAfter(t2, e2 = true) {
      const n2 = this.getParentOrThrow();
      if (dt4(n2) || K4(39), ot4(t2)) return super.insertAfter(t2, e2);
      const r3 = this.getNextSiblings();
      if (n2.insertAfter(t2, e2), 0 !== r3.length) {
        const i3 = ht5(n2.getListType());
        r3.forEach((t3) => i3.append(t3)), t2.insertAfter(i3, e2);
      }
      return t2;
    }
    remove(t2) {
      const e2 = this.getPreviousSibling(), n2 = this.getNextSibling();
      super.remove(t2), e2 && n2 && $4(e2) && $4(n2) && (X5(e2.getFirstChild(), n2.getFirstChild()), n2.remove());
    }
    insertNewAfter(t2, e2 = true) {
      const n2 = st4().updateFromJSON(this.exportJSON()).setChecked(!this.getChecked() && void 0);
      return this.insertAfter(n2, e2), n2;
    }
    collapseAtStart(t2) {
      const e2 = $createParagraphNode();
      this.getChildren().forEach((t3) => e2.append(t3));
      const n2 = this.getParentOrThrow(), r3 = n2.getParentOrThrow(), i3 = ot4(r3);
      if (1 === n2.getChildrenSize()) if (i3) n2.remove(), r3.select();
      else {
        n2.insertBefore(e2), n2.remove();
        const r4 = t2.anchor, i4 = t2.focus, s4 = e2.getKey();
        "element" === r4.type && r4.getNode().is(this) && r4.set(s4, r4.offset, "element"), "element" === i4.type && i4.getNode().is(this) && i4.set(s4, i4.offset, "element");
      }
      else n2.insertBefore(e2), this.remove();
      return true;
    }
    getValue() {
      return this.getLatest().__value;
    }
    setValue(t2) {
      const e2 = this.getWritable();
      return e2.__value = t2, e2;
    }
    getChecked() {
      const t2 = this.getLatest();
      let e2;
      const n2 = this.getParent();
      return dt4(n2) && (e2 = n2.getListType()), "check" === e2 ? Boolean(t2.__checked) : void 0;
    }
    setChecked(t2) {
      const e2 = this.getWritable();
      return e2.__checked = t2, e2;
    }
    toggleChecked() {
      const t2 = this.getWritable();
      return t2.setChecked(!t2.__checked);
    }
    getIndent() {
      const t2 = this.getParent();
      if (null === t2 || !this.isAttached()) return this.getLatest().__indent;
      let e2 = t2.getParentOrThrow(), n2 = 0;
      for (; ot4(e2); ) e2 = e2.getParentOrThrow().getParentOrThrow(), n2++;
      return n2;
    }
    setIndent(t2) {
      "number" != typeof t2 && K4(117), (t2 = Math.floor(t2)) >= 0 || K4(199);
      let e2 = this.getIndent();
      for (; e2 !== t2; ) e2 < t2 ? (Y5(this), e2++) : (Z5(this), e2--);
      return this;
    }
    canInsertAfter(t2) {
      return ot4(t2);
    }
    canReplaceWith(t2) {
      return ot4(t2);
    }
    canMergeWith(t2) {
      return ot4(t2) || $isParagraphNode(t2);
    }
    extractWithChild(t2, e2) {
      if (!$isRangeSelection(e2)) return false;
      const n2 = e2.anchor.getNode(), r3 = e2.focus.getNode();
      return this.isParentOf(n2) && this.isParentOf(r3) && this.getTextContent().length === e2.getTextContent().length;
    }
    isParentRequired() {
      return true;
    }
    createParentElementNode() {
      return ht5("bullet");
    }
    canMergeWhenEmpty() {
      return true;
    }
  };
  function rt4(t2) {
    if (t2.classList.contains("task-list-item")) {
      for (const e3 of t2.children) if ("INPUT" === e3.tagName) return it4(e3);
    }
    if (t2.classList.contains("joplin-checkbox")) {
      for (const e3 of t2.children) if (e3.classList.contains("checkbox-wrapper") && e3.children.length > 0 && "INPUT" === e3.children[0].tagName) return it4(e3.children[0]);
    }
    const e2 = t2.getAttribute("aria-checked");
    return { node: st4("true" === e2 || "false" !== e2 && void 0) };
  }
  function it4(t2) {
    if (!("checkbox" === t2.getAttribute("type"))) return { node: null };
    return { node: st4(t2.hasAttribute("checked")) };
  }
  function st4(t2) {
    return $applyNodeReplacement(new nt4(void 0, t2));
  }
  function ot4(t2) {
    return t2 instanceof nt4;
  }
  var lt4 = class extends ElementNode {
    __tag;
    __start;
    __listType;
    $config() {
      return this.config("list", { $transform: (t2) => {
        !(function(t3) {
          const e2 = t3.getNextSibling();
          dt4(e2) && t3.getListType() === e2.getListType() && X5(t3, e2);
        })(t2), Q5(t2);
      }, extends: ElementNode, importDOM: buildImportMap({ ol: () => ({ conversion: gt5, priority: 0 }), ul: () => ({ conversion: gt5, priority: 0 }) }) });
    }
    constructor(t2 = "number", e2 = 1, n2) {
      super(n2);
      const r3 = ut4[t2] || t2;
      this.__listType = r3, this.__tag = "number" === r3 ? "ol" : "ul", this.__start = e2;
    }
    afterCloneFrom(t2) {
      super.afterCloneFrom(t2), this.__listType = t2.__listType, this.__tag = t2.__tag, this.__start = t2.__start;
    }
    getTag() {
      return this.getLatest().__tag;
    }
    setListType(t2) {
      const e2 = this.getWritable();
      return e2.__listType = t2, e2.__tag = "number" === t2 ? "ol" : "ul", e2;
    }
    getListType() {
      return this.getLatest().__listType;
    }
    getStart() {
      return this.getLatest().__start;
    }
    setStart(t2) {
      const e2 = this.getWritable();
      return e2.__start = t2, e2;
    }
    createDOM(t2, e2) {
      const n2 = this.__tag, r3 = document.createElement(n2);
      return 1 !== this.__start && r3.setAttribute("start", String(this.__start)), r3.__lexicalListType = this.__listType, ct4(r3, t2.theme, this), r3;
    }
    updateDOM(t2, e2, n2) {
      return t2.__tag !== this.__tag || t2.__listType !== this.__listType || (ct4(e2, n2.theme, this), false);
    }
    updateFromJSON(t2) {
      return super.updateFromJSON(t2).setListType(t2.listType).setStart(t2.start);
    }
    exportDOM(t2) {
      const e2 = this.createDOM(t2._config, t2);
      return isHTMLElement2(e2) && (1 !== this.__start && e2.setAttribute("start", String(this.__start)), "check" === this.__listType && e2.setAttribute("__lexicalListType", "check")), { element: e2 };
    }
    exportJSON() {
      return { ...super.exportJSON(), listType: this.getListType(), start: this.getStart(), tag: this.getTag() };
    }
    canBeEmpty() {
      return false;
    }
    canIndent() {
      return false;
    }
    splice(t2, e2, n2) {
      let r3 = n2;
      for (let t3 = 0; t3 < n2.length; t3++) {
        const e3 = n2[t3];
        ot4(e3) || (r3 === n2 && (r3 = [...n2]), r3[t3] = st4().append(!$isElementNode(e3) || dt4(e3) || e3.isInline() ? e3 : $createTextNode(e3.getTextContent())));
      }
      return super.splice(t2, e2, r3);
    }
    extractWithChild(t2) {
      return ot4(t2);
    }
  };
  function ct4(t2, e2, n2) {
    const s4 = [], o2 = [], l3 = e2.list;
    if (void 0 !== l3) {
      const t3 = l3[`${n2.__tag}Depth`] || [], e3 = W5(n2) - 1, r3 = e3 % t3.length, i3 = t3[r3], c3 = l3[n2.__tag];
      let a3;
      const g3 = l3.nested, u3 = l3.checklist;
      if (void 0 !== g3 && g3.list && (a3 = g3.list), void 0 !== c3 && s4.push(c3), void 0 !== u3 && "check" === n2.__listType && s4.push(u3), void 0 !== i3) {
        s4.push(...et4(i3));
        for (let e4 = 0; e4 < t3.length; e4++) e4 !== r3 && o2.push(n2.__tag + e4);
      }
      if (void 0 !== a3) {
        const t4 = et4(a3);
        e3 > 1 ? s4.push(...t4) : o2.push(...t4);
      }
    }
    o2.length > 0 && removeClassNamesFromElement(t2, ...o2), s4.length > 0 && addClassNamesToElement(t2, ...s4);
  }
  function at4(t2) {
    const e2 = [];
    for (let n2 = 0; n2 < t2.length; n2++) {
      const r3 = t2[n2];
      if (ot4(r3)) {
        e2.push(r3);
        const t3 = r3.getChildren();
        t3.length > 1 && t3.forEach((t4) => {
          dt4(t4) && e2.push(V5(t4));
        });
      } else e2.push(V5(r3));
    }
    return e2;
  }
  function gt5(t2) {
    const e2 = t2.nodeName.toLowerCase();
    let n2 = null;
    if ("ol" === e2) {
      n2 = ht5("number", t2.start);
    } else "ul" === e2 && (n2 = (function(t3) {
      if ("check" === t3.getAttribute("__lexicallisttype") || t3.classList.contains("contains-task-list") || "1" === t3.getAttribute("data-is-checklist")) return true;
      for (const e3 of t3.childNodes) if (isHTMLElement2(e3) && e3.hasAttribute("aria-checked")) return true;
      return false;
    })(t2) ? ht5("check") : ht5("bullet"));
    return { after: at4, node: n2 };
  }
  var ut4 = { ol: "number", ul: "bullet" };
  function ht5(t2 = "number", e2 = 1) {
    return $applyNodeReplacement(new lt4(t2, e2));
  }
  function dt4(t2) {
    return t2 instanceof lt4;
  }
  var ft4 = createCommand("INSERT_CHECK_LIST_COMMAND");
  function pt5(t2) {
    return mergeRegister(t2.registerCommand(ft4, () => (j4("check"), true), COMMAND_PRIORITY_LOW), t2.registerCommand(KEY_ARROW_DOWN_COMMAND, (e2) => Tt5(e2, t2, false), COMMAND_PRIORITY_LOW), t2.registerCommand(KEY_ARROW_UP_COMMAND, (e2) => Tt5(e2, t2, true), COMMAND_PRIORITY_LOW), t2.registerCommand(KEY_ESCAPE_COMMAND, () => {
      if (null != Ct5()) {
        const e2 = t2.getRootElement();
        return null != e2 && e2.focus(), true;
      }
      return false;
    }, COMMAND_PRIORITY_LOW), t2.registerCommand(KEY_SPACE_COMMAND, (e2) => {
      const n2 = Ct5();
      return !(null == n2 || !t2.isEditable()) && (t2.update(() => {
        const t3 = $getNearestNodeFromDOMNode(n2);
        ot4(t3) && (e2.preventDefault(), t3.toggleChecked());
      }), true);
    }, COMMAND_PRIORITY_LOW), t2.registerCommand(KEY_ARROW_LEFT_COMMAND, (e2) => t2.getEditorState().read(() => {
      const n2 = $getSelection();
      if ($isRangeSelection(n2) && n2.isCollapsed()) {
        const { anchor: r3 } = n2, i3 = "element" === r3.type;
        if (i3 || 0 === r3.offset) {
          const n3 = r3.getNode(), s4 = $findMatchingParent2(n3, (t3) => $isElementNode(t3) && !t3.isInline());
          if (ot4(s4)) {
            const r4 = s4.getParent();
            if (dt4(r4) && "check" === r4.getListType() && (i3 || s4.getFirstDescendant() === n3)) {
              const n4 = t2.getElementByKey(s4.__key);
              if (null != n4 && document.activeElement !== n4) return n4.focus(), e2.preventDefault(), true;
            }
          }
        }
      }
      return false;
    }), COMMAND_PRIORITY_LOW), t2.registerRootListener((t3, e2) => {
      null !== t3 && (t3.addEventListener("click", _t5), t3.addEventListener("pointerdown", yt5)), null !== e2 && (e2.removeEventListener("click", _t5), e2.removeEventListener("pointerdown", yt5));
    }));
  }
  function mt4(t2, e2) {
    const n2 = t2.target;
    if (!isHTMLElement2(n2)) return;
    const r3 = n2.firstChild;
    if (isHTMLElement2(r3) && ("UL" === r3.tagName || "OL" === r3.tagName)) return;
    const i3 = n2.parentNode;
    if (!i3 || "check" !== i3.__lexicalListType) return;
    const o2 = n2.getBoundingClientRect(), l3 = calculateZoomLevel(n2), a3 = t2.clientX / l3, g3 = window.getComputedStyle ? window.getComputedStyle(n2, "::before") : { width: "0px" }, u3 = parseFloat(g3.width), h2 = "touch" === t2.pointerType ? 32 : 0;
    ("rtl" === n2.dir ? a3 < o2.right + h2 && a3 > o2.right - u3 - h2 : a3 > o2.left - h2 && a3 < o2.left + u3 + h2) && e2();
  }
  function _t5(t2) {
    mt4(t2, () => {
      if (isHTMLElement2(t2.target)) {
        const e2 = t2.target, n2 = getNearestEditorFromDOMNode(e2);
        null != n2 && n2.isEditable() && n2.update(() => {
          const t3 = $getNearestNodeFromDOMNode(e2);
          ot4(t3) && (e2.focus(), t3.toggleChecked());
        });
      }
    });
  }
  function yt5(t2) {
    mt4(t2, () => {
      t2.preventDefault();
    });
  }
  function Ct5() {
    const t2 = document.activeElement;
    return isHTMLElement2(t2) && "LI" === t2.tagName && null != t2.parentNode && "check" === t2.parentNode.__lexicalListType ? t2 : null;
  }
  function Tt5(t2, e2, n2) {
    const r3 = Ct5();
    return null != r3 && e2.update(() => {
      const i3 = $getNearestNodeFromDOMNode(r3);
      if (!ot4(i3)) return;
      const s4 = (function(t3, e3) {
        let n3 = e3 ? t3.getPreviousSibling() : t3.getNextSibling(), r4 = t3;
        for (; null == n3 && ot4(r4); ) r4 = r4.getParentOrThrow().getParent(), null != r4 && (n3 = e3 ? r4.getPreviousSibling() : r4.getNextSibling());
        for (; ot4(n3); ) {
          const t4 = e3 ? n3.getLastChild() : n3.getFirstChild();
          if (!dt4(t4)) return n3;
          n3 = e3 ? t4.getLastChild() : t4.getFirstChild();
        }
        return null;
      })(i3, n2);
      if (null != s4) {
        s4.selectStart();
        const n3 = e2.getElementByKey(s4.__key);
        null != n3 && (t2.preventDefault(), setTimeout(() => {
          n3.focus();
        }, 0));
      }
    }), false;
  }
  var vt5 = createCommand("UPDATE_LIST_START_COMMAND");
  var St5 = createCommand("INSERT_UNORDERED_LIST_COMMAND");
  var xt5 = createCommand("INSERT_ORDERED_LIST_COMMAND");
  var kt5 = createCommand("REMOVE_LIST_COMMAND");
  function bt5(t2) {
    return mergeRegister(t2.registerCommand(xt5, () => (j4("number"), true), COMMAND_PRIORITY_LOW), t2.registerCommand(vt5, (t3) => {
      const { listNodeKey: e2, newStart: n2 } = t3, r3 = $getNodeByKey(e2);
      return !!dt4(r3) && ("number" === r3.getListType() && (r3.setStart(n2), Q5(r3)), true);
    }, COMMAND_PRIORITY_LOW), t2.registerCommand(St5, () => (j4("bullet"), true), COMMAND_PRIORITY_LOW), t2.registerCommand(kt5, () => (G5(), true), COMMAND_PRIORITY_LOW), t2.registerCommand(INSERT_PARAGRAPH_COMMAND, () => tt4(), COMMAND_PRIORITY_LOW), t2.registerNodeTransform(nt4, (t3) => {
      const e2 = t3.getFirstChild();
      if (e2) {
        if ($isTextNode(e2)) {
          const n2 = e2.getStyle(), r3 = e2.getFormat();
          t3.getTextStyle() !== n2 && t3.setTextStyle(n2), t3.getTextFormat() !== r3 && t3.setTextFormat(r3);
        }
      } else {
        const e3 = $getSelection();
        $isRangeSelection(e3) && (e3.style !== t3.getTextStyle() || e3.format !== t3.getTextFormat()) && e3.isCollapsed() && t3.is(e3.anchor.getNode()) && t3.setTextStyle(e3.style).setTextFormat(e3.format);
      }
    }), t2.registerNodeTransform(TextNode, (t3) => {
      const e2 = t3.getParent();
      if (ot4(e2) && t3.is(e2.getFirstChild())) {
        const n2 = t3.getStyle(), r3 = t3.getFormat();
        n2 === e2.getTextStyle() && r3 === e2.getTextFormat() || e2.setTextStyle(n2).setTextFormat(r3);
      }
    }));
  }
  function Lt4(t2) {
    const e2 = (t3) => {
      const e3 = t3.getParent();
      if (dt4(t3.getFirstChild()) || !dt4(e3)) return;
      const n2 = $findMatchingParent2(t3, (t4) => ot4(t4) && dt4(t4.getParent()) && ot4(t4.getPreviousSibling()));
      if (null === n2 && t3.getIndent() > 0) t3.setIndent(0);
      else if (ot4(n2)) {
        const r3 = n2.getPreviousSibling();
        if (ot4(r3)) {
          const n3 = (function(t4) {
            let e4 = t4, n4 = e4.getFirstChild();
            for (; dt4(n4); ) {
              const t5 = n4.getLastChild();
              if (!ot4(t5)) break;
              e4 = t5, n4 = e4.getFirstChild();
            }
            return e4;
          })(r3), i3 = n3.getParent();
          if (dt4(i3)) {
            const n4 = W5(i3);
            n4 + 1 < W5(e3) && t3.setIndent(n4);
          }
        }
      }
    };
    return t2.registerNodeTransform(lt4, (t3) => {
      const n2 = [t3];
      for (; n2.length > 0; ) {
        const t4 = n2.shift();
        if (dt4(t4)) {
          for (const r3 of t4.getChildren()) if (ot4(r3)) {
            e2(r3);
            const t5 = r3.getFirstChild();
            dt4(t5) && n2.push(t5);
          }
        }
      }
    });
  }
  function Nt5(t2, e2) {
    t2.update(() => j4(e2));
  }
  function Ft4(t2) {
    t2.update(() => G5());
  }
  var Pt5 = defineExtension({ build: (t2, n2, r3) => namedSignals(n2), config: safeCast({ hasStrictIndent: false }), name: "@lexical/list/List", nodes: () => [lt4, nt4], register(e2, n2, r3) {
    const i3 = r3.getOutput();
    return mergeRegister(bt5(e2), effect(() => i3.hasStrictIndent.value ? Lt4(e2) : void 0));
  } });
  var At5 = defineExtension({ dependencies: [Pt5], name: "@lexical/list/CheckList", register: pt5 });

  // node_modules/@lexical/list/LexicalList.mjs
  var mod10 = false ? LexicalList_dev_exports : LexicalList_prod_exports;
  var $createListItemNode = mod10.$createListItemNode;
  var $createListNode = mod10.$createListNode;
  var $getListDepth = mod10.$getListDepth;
  var $handleListInsertParagraph = mod10.$handleListInsertParagraph;
  var $insertList = mod10.$insertList;
  var $isListItemNode = mod10.$isListItemNode;
  var $isListNode = mod10.$isListNode;
  var $removeList = mod10.$removeList;
  var CheckListExtension = mod10.CheckListExtension;
  var INSERT_CHECK_LIST_COMMAND = mod10.INSERT_CHECK_LIST_COMMAND;
  var INSERT_ORDERED_LIST_COMMAND = mod10.INSERT_ORDERED_LIST_COMMAND;
  var INSERT_UNORDERED_LIST_COMMAND = mod10.INSERT_UNORDERED_LIST_COMMAND;
  var ListExtension = mod10.ListExtension;
  var ListItemNode = mod10.ListItemNode;
  var ListNode = mod10.ListNode;
  var REMOVE_LIST_COMMAND = mod10.REMOVE_LIST_COMMAND;
  var UPDATE_LIST_START_COMMAND = mod10.UPDATE_LIST_START_COMMAND;
  var insertList = mod10.insertList;
  var registerCheckList = mod10.registerCheckList;
  var registerList = mod10.registerList;
  var registerListStrictIndentTransform = mod10.registerListStrictIndentTransform;
  var removeList = mod10.removeList;

  // node_modules/@lexical/table/LexicalTable.prod.mjs
  var LexicalTable_prod_exports = {};
  __export(LexicalTable_prod_exports, {
    $computeTableMap: () => gt6,
    $computeTableMapSkipCellCheck: () => mt5,
    $createTableCellNode: () => Oe2,
    $createTableNode: () => mn2,
    $createTableNodeWithDimensions: () => Be2,
    $createTableRowNode: () => $e2,
    $createTableSelection: () => yt6,
    $createTableSelectionFrom: () => Nt6,
    $deleteTableColumn: () => ot5,
    $deleteTableColumnAtSelection: () => st5,
    $deleteTableColumn__EXPERIMENTAL: () => it5,
    $deleteTableRowAtSelection: () => rt5,
    $deleteTableRow__EXPERIMENTAL: () => lt5,
    $findCellNode: () => Qt3,
    $findTableNode: () => Zt3,
    $getElementForTableNode: () => fn2,
    $getNodeTriplet: () => pt6,
    $getTableAndElementByKey: () => xt6,
    $getTableCellNodeFromLexicalNode: () => Pe2,
    $getTableCellNodeRect: () => _t6,
    $getTableColumnIndexFromTableCellNode: () => Je2,
    $getTableNodeFromLexicalNodeOrThrow: () => Ie2,
    $getTableRowIndexFromTableCellNode: () => Ue2,
    $getTableRowNodeFromTableCellNodeOrThrow: () => De2,
    $insertTableColumn: () => Ze2,
    $insertTableColumnAtSelection: () => et5,
    $insertTableColumn__EXPERIMENTAL: () => tt5,
    $insertTableRow: () => qe2,
    $insertTableRowAtSelection: () => Ve2,
    $insertTableRow__EXPERIMENTAL: () => Ge2,
    $isScrollableTablesActive: () => un2,
    $isTableCellNode: () => Ae2,
    $isTableNode: () => pn2,
    $isTableRowNode: () => We2,
    $isTableSelection: () => bt6,
    $mergeCells: () => ut5,
    $removeTableRowAtIndex: () => Xe2,
    $unmergeCell: () => dt5,
    INSERT_TABLE_COMMAND: () => Ke2,
    TableCellHeaderStates: () => xe2,
    TableCellNode: () => Te2,
    TableExtension: () => vn2,
    TableNode: () => dn2,
    TableObserver: () => Tt6,
    TableRowNode: () => Ee2,
    applyTableHandlers: () => $t4,
    getDOMCellFromTarget: () => zt3,
    getTableElement: () => Ot5,
    getTableObserverFromTableElement: () => Wt4,
    registerTableCellUnmergeTransform: () => bn2,
    registerTablePlugin: () => Nn2,
    registerTableSelectionObserver: () => yn2,
    setScrollableTablesActive: () => hn2
  });
  var ve2 = /^(\d+(?:\.\d+)?)px$/;
  var xe2 = { BOTH: 3, COLUMN: 2, NO_STATUS: 0, ROW: 1 };
  var Te2 = class _Te extends ElementNode {
    __colSpan;
    __rowSpan;
    __headerState;
    __width;
    __backgroundColor;
    __verticalAlign;
    static getType() {
      return "tablecell";
    }
    static clone(e2) {
      return new _Te(e2.__headerState, e2.__colSpan, e2.__width, e2.__key);
    }
    afterCloneFrom(e2) {
      super.afterCloneFrom(e2), this.__rowSpan = e2.__rowSpan, this.__backgroundColor = e2.__backgroundColor, this.__verticalAlign = e2.__verticalAlign;
    }
    static importDOM() {
      return { td: (e2) => ({ conversion: Fe2, priority: 0 }), th: (e2) => ({ conversion: Fe2, priority: 0 }) };
    }
    static importJSON(e2) {
      return Oe2().updateFromJSON(e2);
    }
    updateFromJSON(e2) {
      return super.updateFromJSON(e2).setHeaderStyles(e2.headerState).setColSpan(e2.colSpan || 1).setRowSpan(e2.rowSpan || 1).setWidth(e2.width || void 0).setBackgroundColor(e2.backgroundColor || null).setVerticalAlign(e2.verticalAlign || void 0);
    }
    constructor(e2 = xe2.NO_STATUS, t2 = 1, n2, o2) {
      super(o2), this.__colSpan = t2, this.__rowSpan = 1, this.__headerState = e2, this.__width = n2, this.__backgroundColor = null, this.__verticalAlign = void 0;
    }
    createDOM(t2) {
      const n2 = document.createElement(this.getTag());
      return this.__width && (n2.style.width = `${this.__width}px`), this.__colSpan > 1 && (n2.colSpan = this.__colSpan), this.__rowSpan > 1 && (n2.rowSpan = this.__rowSpan), null !== this.__backgroundColor && (n2.style.backgroundColor = this.__backgroundColor), Re2(this.__verticalAlign) && (n2.style.verticalAlign = this.__verticalAlign), addClassNamesToElement(n2, t2.theme.tableCell, this.hasHeader() && t2.theme.tableCellHeader), n2;
    }
    exportDOM(e2) {
      const t2 = super.exportDOM(e2);
      if (isHTMLElement(t2.element)) {
        const e3 = t2.element;
        e3.setAttribute("data-temporary-table-cell-lexical-key", this.getKey()), e3.style.border = "1px solid black", this.__colSpan > 1 && (e3.colSpan = this.__colSpan), this.__rowSpan > 1 && (e3.rowSpan = this.__rowSpan), e3.style.width = `${this.getWidth() || 75}px`, e3.style.verticalAlign = this.getVerticalAlign() || "top", e3.style.textAlign = "start", null === this.__backgroundColor && this.hasHeader() && (e3.style.backgroundColor = "#f2f3f5");
      }
      return t2;
    }
    exportJSON() {
      return { ...super.exportJSON(), ...Re2(this.__verticalAlign) && { verticalAlign: this.__verticalAlign }, backgroundColor: this.getBackgroundColor(), colSpan: this.__colSpan, headerState: this.__headerState, rowSpan: this.__rowSpan, width: this.getWidth() };
    }
    getColSpan() {
      return this.getLatest().__colSpan;
    }
    setColSpan(e2) {
      const t2 = this.getWritable();
      return t2.__colSpan = e2, t2;
    }
    getRowSpan() {
      return this.getLatest().__rowSpan;
    }
    setRowSpan(e2) {
      const t2 = this.getWritable();
      return t2.__rowSpan = e2, t2;
    }
    getTag() {
      return this.hasHeader() ? "th" : "td";
    }
    setHeaderStyles(e2, t2 = xe2.BOTH) {
      const n2 = this.getWritable();
      return n2.__headerState = e2 & t2 | n2.__headerState & ~t2, n2;
    }
    getHeaderStyles() {
      return this.getLatest().__headerState;
    }
    setWidth(e2) {
      const t2 = this.getWritable();
      return t2.__width = e2, t2;
    }
    getWidth() {
      return this.getLatest().__width;
    }
    getBackgroundColor() {
      return this.getLatest().__backgroundColor;
    }
    setBackgroundColor(e2) {
      const t2 = this.getWritable();
      return t2.__backgroundColor = e2, t2;
    }
    getVerticalAlign() {
      return this.getLatest().__verticalAlign;
    }
    setVerticalAlign(e2) {
      const t2 = this.getWritable();
      return t2.__verticalAlign = e2 || void 0, t2;
    }
    toggleHeaderStyle(e2) {
      const t2 = this.getWritable();
      return (t2.__headerState & e2) === e2 ? t2.__headerState -= e2 : t2.__headerState += e2, t2;
    }
    hasHeaderState(e2) {
      return (this.getHeaderStyles() & e2) === e2;
    }
    hasHeader() {
      return this.getLatest().__headerState !== xe2.NO_STATUS;
    }
    updateDOM(e2) {
      return e2.__headerState !== this.__headerState || e2.__width !== this.__width || e2.__colSpan !== this.__colSpan || e2.__rowSpan !== this.__rowSpan || e2.__backgroundColor !== this.__backgroundColor || e2.__verticalAlign !== this.__verticalAlign;
    }
    isShadowRoot() {
      return true;
    }
    collapseAtStart() {
      return true;
    }
    canBeEmpty() {
      return false;
    }
    canIndent() {
      return false;
    }
  };
  function Re2(e2) {
    return "middle" === e2 || "bottom" === e2;
  }
  function Fe2(e2) {
    const t2 = e2, n2 = e2.nodeName.toLowerCase();
    let o2;
    ve2.test(t2.style.width) && (o2 = parseFloat(t2.style.width));
    const r3 = Oe2("th" === n2 ? xe2.ROW : xe2.NO_STATUS, t2.colSpan, o2);
    r3.__rowSpan = t2.rowSpan;
    const l3 = t2.style.backgroundColor;
    "" !== l3 && (r3.__backgroundColor = l3);
    const s4 = t2.style.verticalAlign;
    Re2(s4) && (r3.__verticalAlign = s4);
    const i3 = t2.style, c3 = (i3 && i3.textDecoration || "").split(" "), a3 = "700" === i3.fontWeight || "bold" === i3.fontWeight, u3 = c3.includes("line-through"), h2 = "italic" === i3.fontStyle, p3 = c3.includes("underline");
    return { after: (e3) => {
      const t3 = [];
      let n3 = null;
      const o3 = () => {
        if (n3) {
          const e4 = n3.getFirstChild();
          $isLineBreakNode(e4) && 1 === n3.getChildrenSize() && e4.remove();
        }
      };
      for (const r4 of e3) $isInlineElementOrDecoratorNode(r4) || $isTextNode(r4) || $isLineBreakNode(r4) ? ($isTextNode(r4) && (a3 && r4.toggleFormat("bold"), u3 && r4.toggleFormat("strikethrough"), h2 && r4.toggleFormat("italic"), p3 && r4.toggleFormat("underline")), n3 ? n3.append(r4) : (n3 = $createParagraphNode().append(r4), t3.push(n3))) : (t3.push(r4), o3(), n3 = null);
      return o3(), 0 === t3.length && t3.push($createParagraphNode()), t3;
    }, node: r3 };
  }
  function Oe2(e2 = xe2.NO_STATUS, t2 = 1, n2) {
    return $applyNodeReplacement(new Te2(e2, t2, n2));
  }
  function Ae2(e2) {
    return e2 instanceof Te2;
  }
  var Ke2 = createCommand("INSERT_TABLE_COMMAND");
  function ke2(e2, ...t2) {
    const n2 = new URL("https://lexical.dev/docs/error"), o2 = new URLSearchParams();
    o2.append("code", e2);
    for (const e3 of t2) o2.append("v", e3);
    throw n2.search = o2.toString(), Error(`Minified Lexical error #${e2}; visit ${n2.toString()} for the full message or use the non-minified dev environment for full errors and additional helpful warnings.`);
  }
  var Ee2 = class _Ee extends ElementNode {
    __height;
    static getType() {
      return "tablerow";
    }
    static clone(e2) {
      return new _Ee(e2.__height, e2.__key);
    }
    static importDOM() {
      return { tr: (e2) => ({ conversion: Me2, priority: 0 }) };
    }
    static importJSON(e2) {
      return $e2().updateFromJSON(e2);
    }
    updateFromJSON(e2) {
      return super.updateFromJSON(e2).setHeight(e2.height);
    }
    constructor(e2, t2) {
      super(t2), this.__height = e2;
    }
    exportJSON() {
      const e2 = this.getHeight();
      return { ...super.exportJSON(), ...void 0 === e2 ? void 0 : { height: e2 } };
    }
    createDOM(t2) {
      const n2 = document.createElement("tr");
      return this.__height && (n2.style.height = `${this.__height}px`), addClassNamesToElement(n2, t2.theme.tableRow), n2;
    }
    extractWithChild(e2, t2, n2) {
      return "html" === n2;
    }
    isShadowRoot() {
      return true;
    }
    setHeight(e2) {
      const t2 = this.getWritable();
      return t2.__height = e2, t2;
    }
    getHeight() {
      return this.getLatest().__height;
    }
    updateDOM(e2) {
      return e2.__height !== this.__height;
    }
    canBeEmpty() {
      return false;
    }
    canIndent() {
      return false;
    }
  };
  function Me2(e2) {
    const n2 = e2;
    let o2;
    return ve2.test(n2.style.height) && (o2 = parseFloat(n2.style.height)), { after: (e3) => $descendantsMatching(e3, Ae2), node: $e2(o2) };
  }
  function $e2(e2) {
    return $applyNodeReplacement(new Ee2(e2));
  }
  function We2(e2) {
    return e2 instanceof Ee2;
  }
  var ze2 = "undefined" != typeof window && void 0 !== window.document && void 0 !== window.document.createElement;
  var He2 = ze2 && "documentMode" in document ? document.documentMode : null;
  var Le2 = ze2 && /^(?!.*Seamonkey)(?=.*Firefox).*/i.test(navigator.userAgent);
  function Be2(e2, t2, n2 = true) {
    const o2 = mn2();
    for (let r3 = 0; r3 < e2; r3++) {
      const e3 = $e2();
      for (let o3 = 0; o3 < t2; o3++) {
        let t3 = xe2.NO_STATUS;
        "object" == typeof n2 ? (0 === r3 && n2.rows && (t3 |= xe2.ROW), 0 === o3 && n2.columns && (t3 |= xe2.COLUMN)) : n2 && (0 === r3 && (t3 |= xe2.ROW), 0 === o3 && (t3 |= xe2.COLUMN));
        const l3 = Oe2(t3), s4 = $createParagraphNode();
        s4.append($createTextNode()), l3.append(s4), e3.append(l3);
      }
      o2.append(e3);
    }
    return o2;
  }
  function Pe2(e2) {
    const t2 = $findMatchingParent2(e2, (e3) => Ae2(e3));
    return Ae2(t2) ? t2 : null;
  }
  function De2(e2) {
    const t2 = $findMatchingParent2(e2, (e3) => We2(e3));
    if (We2(t2)) return t2;
    throw new Error("Expected table cell to be inside of table row.");
  }
  function Ie2(e2) {
    const t2 = $findMatchingParent2(e2, (e3) => pn2(e3));
    if (pn2(t2)) return t2;
    throw new Error("Expected table cell to be inside of table.");
  }
  function Ue2(e2) {
    const t2 = De2(e2);
    return Ie2(t2).getChildren().findIndex((e3) => e3.is(t2));
  }
  function Je2(e2) {
    return De2(e2).getChildren().findIndex((t2) => t2.is(e2));
  }
  function Ye2(e2, t2) {
    const n2 = Ie2(e2), { x: o2, y: r3 } = n2.getCordsFromCellNode(e2, t2);
    return { above: n2.getCellNodeFromCords(o2, r3 - 1, t2), below: n2.getCellNodeFromCords(o2, r3 + 1, t2), left: n2.getCellNodeFromCords(o2 - 1, r3, t2), right: n2.getCellNodeFromCords(o2 + 1, r3, t2) };
  }
  function Xe2(e2, t2) {
    const n2 = e2.getChildren();
    if (t2 >= n2.length || t2 < 0) throw new Error("Expected table cell to be inside of table row.");
    return n2[t2].remove(), e2;
  }
  function qe2(e2, t2, n2 = true, o2, r3) {
    const l3 = e2.getChildren();
    if (t2 >= l3.length || t2 < 0) throw new Error("Table row target index out of range");
    const s4 = l3[t2];
    if (!We2(s4)) throw new Error("Row before insertion index does not exist.");
    for (let e3 = 0; e3 < o2; e3++) {
      const e4 = s4.getChildren(), t3 = e4.length, o3 = $e2();
      for (let n3 = 0; n3 < t3; n3++) {
        const t4 = e4[n3];
        Ae2(t4) || ke2(12);
        const { above: l4, below: s5 } = Ye2(t4, r3);
        let i3 = xe2.NO_STATUS;
        const c3 = l4 && l4.getWidth() || s5 && s5.getWidth() || void 0;
        (l4 && l4.hasHeaderState(xe2.COLUMN) || s5 && s5.hasHeaderState(xe2.COLUMN)) && (i3 |= xe2.COLUMN);
        const a3 = Oe2(i3, 1, c3);
        a3.append($createParagraphNode()), o3.append(a3);
      }
      n2 ? s4.insertAfter(o3) : s4.insertBefore(o3);
    }
    return e2;
  }
  ze2 && "InputEvent" in window && !He2 && new window.InputEvent("input");
  var je2 = (e2, t2) => e2 === xe2.BOTH || e2 === t2 ? t2 : xe2.NO_STATUS;
  function Ve2(e2 = true) {
    const t2 = $getSelection();
    $isRangeSelection(t2) || bt6(t2) || ke2(188);
    const n2 = t2.anchor.getNode(), o2 = t2.focus.getNode(), [r3] = pt6(n2), [l3, , s4] = pt6(o2), [, i3, c3] = gt6(s4, l3, r3), { startRow: a3 } = c3, { startRow: u3 } = i3;
    return e2 ? Qe2(a3 + r3.__rowSpan > u3 + l3.__rowSpan ? r3 : l3, true) : Qe2(u3 < a3 ? l3 : r3, false);
  }
  var Ge2 = Ve2;
  function Qe2(e2, t2 = true) {
    const [, , n2] = pt6(e2), [o2, r3] = gt6(n2, e2, e2), l3 = o2[0].length, { startRow: s4 } = r3;
    let i3 = null;
    if (t2) {
      const t3 = s4 + e2.__rowSpan - 1, r4 = o2[t3], c3 = $e2();
      for (let e3 = 0; e3 < l3; e3++) {
        const { cell: n3, startRow: o3 } = r4[e3];
        if (o3 + n3.__rowSpan - 1 <= t3) {
          const t4 = r4[e3].cell.__headerState, n4 = je2(t4, xe2.COLUMN);
          c3.append(Oe2(n4).append($createParagraphNode()));
        } else n3.setRowSpan(n3.__rowSpan + 1);
      }
      const a3 = n2.getChildAtIndex(t3);
      We2(a3) || ke2(256), a3.insertAfter(c3), i3 = c3;
    } else {
      const e3 = s4, t3 = o2[e3], r4 = $e2();
      for (let n3 = 0; n3 < l3; n3++) {
        const { cell: o3, startRow: l4 } = t3[n3];
        if (l4 === e3) {
          const e4 = t3[n3].cell.__headerState, o4 = je2(e4, xe2.COLUMN);
          r4.append(Oe2(o4).append($createParagraphNode()));
        } else o3.setRowSpan(o3.__rowSpan + 1);
      }
      const c3 = n2.getChildAtIndex(e3);
      We2(c3) || ke2(257), c3.insertBefore(r4), i3 = r4;
    }
    return i3;
  }
  function Ze2(e2, t2, n2 = true, o2, r3) {
    const l3 = e2.getChildren(), s4 = [];
    for (let e3 = 0; e3 < l3.length; e3++) {
      const n3 = l3[e3];
      if (We2(n3)) for (let e4 = 0; e4 < o2; e4++) {
        const e5 = n3.getChildren();
        if (t2 >= e5.length || t2 < 0) throw new Error("Table column target index out of range");
        const o3 = e5[t2];
        Ae2(o3) || ke2(12);
        const { left: l4, right: i3 } = Ye2(o3, r3);
        let c3 = xe2.NO_STATUS;
        (l4 && l4.hasHeaderState(xe2.ROW) || i3 && i3.hasHeaderState(xe2.ROW)) && (c3 |= xe2.ROW);
        const a3 = Oe2(c3);
        a3.append($createParagraphNode()), s4.push({ newTableCell: a3, targetCell: o3 });
      }
    }
    return s4.forEach(({ newTableCell: e3, targetCell: t3 }) => {
      n2 ? t3.insertAfter(e3) : t3.insertBefore(e3);
    }), e2;
  }
  function et5(e2 = true) {
    const t2 = $getSelection();
    $isRangeSelection(t2) || bt6(t2) || ke2(188);
    const n2 = t2.anchor.getNode(), o2 = t2.focus.getNode(), [r3] = pt6(n2), [l3, , s4] = pt6(o2), [, i3, c3] = gt6(s4, l3, r3), { startColumn: a3 } = c3, { startColumn: u3 } = i3;
    return e2 ? nt5(a3 + r3.__colSpan > u3 + l3.__colSpan ? r3 : l3, true) : nt5(u3 < a3 ? l3 : r3, false);
  }
  var tt5 = et5;
  function nt5(e2, t2 = true, n2 = true) {
    const [, , o2] = pt6(e2), [r3, l3] = gt6(o2, e2, e2), s4 = r3.length, { startColumn: i3 } = l3, c3 = t2 ? i3 + e2.__colSpan - 1 : i3 - 1, a3 = o2.getFirstChild();
    We2(a3) || ke2(120);
    let u3 = null;
    function h2(e3 = xe2.NO_STATUS) {
      const t3 = Oe2(e3).append($createParagraphNode());
      return null === u3 && (u3 = t3), t3;
    }
    let d4 = a3;
    e: for (let e3 = 0; e3 < s4; e3++) {
      if (0 !== e3) {
        const e4 = d4.getNextSibling();
        We2(e4) || ke2(121), d4 = e4;
      }
      const t3 = r3[e3], n3 = t3[c3 < 0 ? 0 : c3].cell.__headerState, o3 = je2(n3, xe2.ROW);
      if (c3 < 0) {
        at5(d4, h2(o3));
        continue;
      }
      const { cell: l4, startColumn: s5, startRow: i4 } = t3[c3];
      if (s5 + l4.__colSpan - 1 <= c3) {
        let n4 = l4, r4 = i4, s6 = c3;
        for (; r4 !== e3 && n4.__rowSpan > 1; ) {
          if (s6 -= l4.__colSpan, !(s6 >= 0)) {
            d4.append(h2(o3));
            continue e;
          }
          {
            const { cell: e4, startRow: o4 } = t3[s6];
            n4 = e4, r4 = o4;
          }
        }
        n4.insertAfter(h2(o3));
      } else l4.setColSpan(l4.__colSpan + 1);
    }
    null !== u3 && n2 && ct5(u3);
    const f3 = o2.getColWidths();
    if (f3) {
      const e3 = [...f3], t3 = c3 < 0 ? 0 : c3, n3 = e3[t3];
      e3.splice(t3, 0, n3), o2.setColWidths(e3);
    }
    return u3;
  }
  function ot5(e2, t2) {
    const n2 = e2.getChildren();
    for (let e3 = 0; e3 < n2.length; e3++) {
      const o2 = n2[e3];
      if (We2(o2)) {
        const e4 = o2.getChildren();
        if (t2 >= e4.length || t2 < 0) throw new Error("Table column target index out of range");
        e4[t2].remove();
      }
    }
    return e2;
  }
  function rt5() {
    const e2 = $getSelection();
    $isRangeSelection(e2) || bt6(e2) || ke2(188);
    const [t2, n2] = e2.isBackward() ? [e2.focus.getNode(), e2.anchor.getNode()] : [e2.anchor.getNode(), e2.focus.getNode()], [o2, , r3] = pt6(t2), [l3] = pt6(n2), [s4, i3, c3] = gt6(r3, o2, l3), { startRow: a3 } = i3, { startRow: u3 } = c3, h2 = u3 + l3.__rowSpan - 1;
    if (s4.length === h2 - a3 + 1) return void r3.remove();
    const d4 = s4[0].length, f3 = s4[h2 + 1], g3 = r3.getChildAtIndex(h2 + 1);
    for (let e3 = h2; e3 >= a3; e3--) {
      for (let t4 = d4 - 1; t4 >= 0; t4--) {
        const { cell: n3, startRow: o3, startColumn: r4 } = s4[e3][t4];
        if (r4 === t4) {
          if (o3 < a3 || o3 + n3.__rowSpan - 1 > h2) {
            const e4 = Math.max(o3, a3), t5 = Math.min(n3.__rowSpan + o3 - 1, h2), r5 = e4 <= t5 ? t5 - e4 + 1 : 0;
            n3.setRowSpan(n3.__rowSpan - r5);
          }
          if (o3 >= a3 && o3 + n3.__rowSpan - 1 > h2 && e3 === h2) {
            null === g3 && ke2(122);
            let o4 = null;
            for (let n4 = 0; n4 < t4; n4++) {
              const t5 = f3[n4], r5 = t5.cell;
              t5.startRow === e3 + 1 && (o4 = r5), r5.__colSpan > 1 && (n4 += r5.__colSpan - 1);
            }
            null === o4 ? at5(g3, n3) : o4.insertAfter(n3);
          }
        }
      }
      const t3 = r3.getChildAtIndex(e3);
      We2(t3) || ke2(206, String(e3)), t3.remove();
    }
    if (void 0 !== f3) {
      const { cell: e3 } = f3[0];
      ct5(e3);
    } else {
      const e3 = s4[a3 - 1], { cell: t3 } = e3[0];
      ct5(t3);
    }
  }
  var lt5 = rt5;
  function st5() {
    const e2 = $getSelection();
    $isRangeSelection(e2) || bt6(e2) || ke2(188);
    const t2 = e2.anchor.getNode(), n2 = e2.focus.getNode(), [o2, , r3] = pt6(t2), [l3] = pt6(n2), [s4, i3, c3] = gt6(r3, o2, l3), { startColumn: a3 } = i3, { startRow: u3, startColumn: h2 } = c3, d4 = Math.min(a3, h2), f3 = Math.max(a3 + o2.__colSpan - 1, h2 + l3.__colSpan - 1), g3 = f3 - d4 + 1;
    if (s4[0].length === f3 - d4 + 1) return r3.selectPrevious(), void r3.remove();
    const m3 = s4.length;
    for (let e3 = 0; e3 < m3; e3++) for (let t3 = d4; t3 <= f3; t3++) {
      const { cell: n3, startColumn: o3 } = s4[e3][t3];
      if (o3 < d4) {
        if (t3 === d4) {
          const e4 = d4 - o3;
          n3.setColSpan(n3.__colSpan - Math.min(g3, n3.__colSpan - e4));
        }
      } else if (o3 + n3.__colSpan - 1 > f3) {
        if (t3 === f3) {
          const e4 = f3 - o3 + 1;
          n3.setColSpan(n3.__colSpan - e4);
        }
      } else n3.remove();
    }
    const p3 = s4[u3], C4 = a3 > h2 ? p3[a3 + o2.__colSpan] : p3[h2 + l3.__colSpan];
    if (void 0 !== C4) {
      const { cell: e3 } = C4;
      ct5(e3);
    } else {
      const e3 = h2 < a3 ? p3[h2 - 1] : p3[a3 - 1], { cell: t3 } = e3;
      ct5(t3);
    }
    const _5 = r3.getColWidths();
    if (_5) {
      const e3 = [..._5];
      e3.splice(d4, g3), r3.setColWidths(e3);
    }
  }
  var it5 = st5;
  function ct5(e2) {
    const t2 = e2.getFirstDescendant();
    null == t2 ? e2.selectStart() : t2.getParentOrThrow().selectStart();
  }
  function at5(e2, t2) {
    const n2 = e2.getFirstChild();
    null !== n2 ? n2.insertBefore(t2) : e2.append(t2);
  }
  function ut5(e2) {
    if (0 === e2.length) return null;
    const t2 = Ie2(e2[0]), [n2] = mt5(t2, null, null);
    let o2 = 1 / 0, r3 = -1 / 0, l3 = 1 / 0, s4 = -1 / 0;
    const i3 = /* @__PURE__ */ new Set();
    for (const t3 of n2) for (const n3 of t3) {
      if (!n3 || !n3.cell) continue;
      const t4 = n3.cell.getKey();
      if (!i3.has(t4) && e2.some((e3) => e3.is(n3.cell))) {
        i3.add(t4);
        const e3 = n3.startRow, c4 = n3.startColumn, a4 = n3.cell.__rowSpan || 1, u4 = n3.cell.__colSpan || 1;
        o2 = Math.min(o2, e3), r3 = Math.max(r3, e3 + a4 - 1), l3 = Math.min(l3, c4), s4 = Math.max(s4, c4 + u4 - 1);
      }
    }
    if (o2 === 1 / 0 || l3 === 1 / 0) return null;
    const c3 = r3 - o2 + 1, a3 = s4 - l3 + 1, u3 = n2[o2][l3];
    if (!u3.cell) return null;
    const h2 = u3.cell;
    h2.setColSpan(a3), h2.setRowSpan(c3);
    const d4 = /* @__PURE__ */ new Set([h2.getKey()]);
    for (let e3 = o2; e3 <= r3; e3++) for (let t3 = l3; t3 <= s4; t3++) {
      const o3 = n2[e3][t3];
      if (!o3.cell) continue;
      const r4 = o3.cell, l4 = r4.getKey();
      if (!d4.has(l4)) {
        d4.add(l4);
        ht6(r4) || h2.append(...r4.getChildren()), r4.remove();
      }
    }
    return 0 === h2.getChildrenSize() && h2.append($createParagraphNode()), h2;
  }
  function ht6(e2) {
    if (1 !== e2.getChildrenSize()) return false;
    const t2 = e2.getFirstChildOrThrow();
    return !(!$isParagraphNode(t2) || !t2.isEmpty());
  }
  function dt5() {
    const e2 = $getSelection();
    $isRangeSelection(e2) || bt6(e2) || ke2(188);
    const t2 = e2.anchor.getNode(), o2 = $findMatchingParent2(t2, Ae2);
    return Ae2(o2) || ke2(148), ft5(o2);
  }
  function ft5(e2) {
    const [t2, n2, o2] = pt6(e2), r3 = t2.__colSpan, l3 = t2.__rowSpan;
    if (1 === r3 && 1 === l3) return;
    const [s4, i3] = gt6(o2, t2, t2), { startColumn: c3, startRow: a3 } = i3, u3 = t2.__headerState & xe2.COLUMN, h2 = Array.from({ length: r3 }, (e3, t3) => {
      let n3 = u3;
      for (let e4 = 0; 0 !== n3 && e4 < s4.length; e4++) n3 &= s4[e4][t3 + c3].cell.__headerState;
      return n3;
    }), d4 = t2.__headerState & xe2.ROW, f3 = Array.from({ length: l3 }, (e3, t3) => {
      let n3 = d4;
      for (let e4 = 0; 0 !== n3 && e4 < s4[0].length; e4++) n3 &= s4[t3 + a3][e4].cell.__headerState;
      return n3;
    });
    if (r3 > 1) {
      for (let e3 = 1; e3 < r3; e3++) t2.insertAfter(Oe2(h2[e3] | f3[0]).append($createParagraphNode()));
      t2.setColSpan(1);
    }
    if (l3 > 1) {
      let e3;
      for (let t3 = 1; t3 < l3; t3++) {
        const o3 = a3 + t3, l4 = s4[o3];
        e3 = (e3 || n2).getNextSibling(), We2(e3) || ke2(125);
        let i4 = null;
        for (let e4 = 0; e4 < c3; e4++) {
          const t4 = l4[e4], n3 = t4.cell;
          t4.startRow === o3 && (i4 = n3), n3.__colSpan > 1 && (e4 += n3.__colSpan - 1);
        }
        if (null === i4) for (let n3 = r3 - 1; n3 >= 0; n3--) at5(e3, Oe2(h2[n3] | f3[t3]).append($createParagraphNode()));
        else for (let e4 = r3 - 1; e4 >= 0; e4--) i4.insertAfter(Oe2(h2[e4] | f3[t3]).append($createParagraphNode()));
      }
      t2.setRowSpan(1);
    }
  }
  function gt6(e2, t2, n2) {
    const [o2, r3, l3] = mt5(e2, t2, n2);
    return null === r3 && ke2(207), null === l3 && ke2(208), [o2, r3, l3];
  }
  function mt5(e2, t2, n2) {
    const o2 = [];
    let r3 = null, l3 = null;
    function s4(e3) {
      let t3 = o2[e3];
      return void 0 === t3 && (o2[e3] = t3 = []), t3;
    }
    const i3 = e2.getChildren();
    for (let e3 = 0; e3 < i3.length; e3++) {
      const o3 = i3[e3];
      We2(o3) || ke2(209);
      const c3 = s4(e3);
      for (let a3 = o3.getFirstChild(), u3 = 0; null != a3; a3 = a3.getNextSibling()) {
        for (Ae2(a3) || ke2(147); void 0 !== c3[u3]; ) u3++;
        const o4 = { cell: a3, startColumn: u3, startRow: e3 }, { __rowSpan: h2, __colSpan: d4 } = a3;
        for (let t3 = 0; t3 < h2 && !(e3 + t3 >= i3.length); t3++) {
          const n3 = s4(e3 + t3);
          for (let e4 = 0; e4 < d4; e4++) n3[u3 + e4] = o4;
        }
        null !== t2 && null === r3 && t2.is(a3) && (r3 = o4), null !== n2 && null === l3 && n2.is(a3) && (l3 = o4);
      }
    }
    return [o2, r3, l3];
  }
  function pt6(e2) {
    let t2;
    if (e2 instanceof Te2) t2 = e2;
    else if ("__type" in e2) {
      const o3 = $findMatchingParent2(e2, Ae2);
      Ae2(o3) || ke2(148), t2 = o3;
    } else {
      const o3 = $findMatchingParent2(e2.getNode(), Ae2);
      Ae2(o3) || ke2(148), t2 = o3;
    }
    const o2 = t2.getParent();
    We2(o2) || ke2(149);
    const r3 = o2.getParent();
    return pn2(r3) || ke2(210), [t2, o2, r3];
  }
  function Ct6(e2, t2, n2) {
    let o2, r3 = Math.min(t2.startColumn, n2.startColumn), l3 = Math.min(t2.startRow, n2.startRow), s4 = Math.max(t2.startColumn + t2.cell.__colSpan - 1, n2.startColumn + n2.cell.__colSpan - 1), i3 = Math.max(t2.startRow + t2.cell.__rowSpan - 1, n2.startRow + n2.cell.__rowSpan - 1);
    do {
      o2 = false;
      for (let t3 = 0; t3 < e2.length; t3++) for (let n3 = 0; n3 < e2[0].length; n3++) {
        const c3 = e2[t3][n3];
        if (!c3) continue;
        const a3 = c3.startColumn + c3.cell.__colSpan - 1, u3 = c3.startRow + c3.cell.__rowSpan - 1, h2 = c3.startColumn <= s4 && a3 >= r3, d4 = c3.startRow <= i3 && u3 >= l3;
        if (h2 && d4) {
          const e3 = Math.min(r3, c3.startColumn), t4 = Math.max(s4, a3), n4 = Math.min(l3, c3.startRow), h3 = Math.max(i3, u3);
          e3 === r3 && t4 === s4 && n4 === l3 && h3 === i3 || (r3 = e3, s4 = t4, l3 = n4, i3 = h3, o2 = true);
        }
      }
    } while (o2);
    return { maxColumn: s4, maxRow: i3, minColumn: r3, minRow: l3 };
  }
  function _t6(e2) {
    const [t2, , n2] = pt6(e2), o2 = n2.getChildren(), r3 = o2.length, l3 = o2[0].getChildren().length, s4 = new Array(r3);
    for (let e3 = 0; e3 < r3; e3++) s4[e3] = new Array(l3);
    for (let e3 = 0; e3 < r3; e3++) {
      const n3 = o2[e3].getChildren();
      let r4 = 0;
      for (let o3 = 0; o3 < n3.length; o3++) {
        for (; s4[e3][r4]; ) r4++;
        const l4 = n3[o3], i3 = l4.__rowSpan || 1, c3 = l4.__colSpan || 1;
        for (let t3 = 0; t3 < i3; t3++) for (let n4 = 0; n4 < c3; n4++) s4[e3 + t3][r4 + n4] = l4;
        if (t2 === l4) return { colSpan: c3, columnIndex: r4, rowIndex: e3, rowSpan: i3 };
        r4 += c3;
      }
    }
    return null;
  }
  function St6(e2) {
    const [[t2, o2, r3, l3], [s4, i3, c3, a3]] = ["anchor", "focus"].map((t3) => {
      const o3 = e2[t3].getNode(), r4 = $findMatchingParent2(o3, Ae2);
      Ae2(r4) || ke2(238, t3, o3.getKey(), o3.getType());
      const l4 = r4.getParent();
      We2(l4) || ke2(239, t3);
      const s5 = l4.getParent();
      return pn2(s5) || ke2(240, t3), [o3, r4, l4, s5];
    });
    return l3.is(a3) || ke2(241), { anchorCell: o2, anchorNode: t2, anchorRow: r3, anchorTable: l3, focusCell: i3, focusNode: s4, focusRow: c3, focusTable: a3 };
  }
  var wt5 = class _wt {
    tableKey;
    anchor;
    focus;
    _cachedNodes;
    dirty;
    constructor(e2, t2, n2) {
      this.anchor = t2, this.focus = n2, t2._selection = this, n2._selection = this, this._cachedNodes = null, this.dirty = false, this.tableKey = e2;
    }
    getStartEndPoints() {
      return [this.anchor, this.focus];
    }
    isValid() {
      if ("root" === this.tableKey || "root" === this.anchor.key || "element" !== this.anchor.type || "root" === this.focus.key || "element" !== this.focus.type) return false;
      const e2 = $getNodeByKey(this.tableKey), t2 = $getNodeByKey(this.anchor.key), n2 = $getNodeByKey(this.focus.key);
      return null !== e2 && null !== t2 && null !== n2;
    }
    isBackward() {
      return this.focus.isBefore(this.anchor);
    }
    getCachedNodes() {
      return this._cachedNodes;
    }
    setCachedNodes(e2) {
      this._cachedNodes = e2;
    }
    is(e2) {
      return bt6(e2) && this.tableKey === e2.tableKey && this.anchor.is(e2.anchor) && this.focus.is(e2.focus);
    }
    set(e2, t2, n2) {
      this.dirty = this.dirty || e2 !== this.tableKey || t2 !== this.anchor.key || n2 !== this.focus.key, this.tableKey = e2, this.anchor.key = t2, this.focus.key = n2, this._cachedNodes = null;
    }
    clone() {
      return new _wt(this.tableKey, $createPoint(this.anchor.key, this.anchor.offset, this.anchor.type), $createPoint(this.focus.key, this.focus.offset, this.focus.type));
    }
    isCollapsed() {
      return false;
    }
    extract() {
      return this.getNodes();
    }
    insertRawText(e2) {
    }
    insertText() {
    }
    hasFormat(e2) {
      let t2 = 0;
      this.getNodes().filter(Ae2).forEach((e3) => {
        const n3 = e3.getFirstChild();
        $isParagraphNode(n3) && (t2 |= n3.getTextFormat());
      });
      const n2 = TEXT_TYPE_TO_FORMAT[e2];
      return 0 !== (t2 & n2);
    }
    insertNodes(e2) {
      const t2 = this.focus.getNode();
      $isElementNode(t2) || ke2(151);
      $normalizeSelection__EXPERIMENTAL(t2.select(0, t2.getChildrenSize())).insertNodes(e2);
    }
    getShape() {
      const { anchorCell: e2, focusCell: t2 } = St6(this), n2 = _t6(e2);
      null === n2 && ke2(153);
      const o2 = _t6(t2);
      null === o2 && ke2(155);
      const r3 = Math.min(n2.columnIndex, o2.columnIndex), l3 = Math.max(n2.columnIndex + n2.colSpan - 1, o2.columnIndex + o2.colSpan - 1), s4 = Math.min(n2.rowIndex, o2.rowIndex), i3 = Math.max(n2.rowIndex + n2.rowSpan - 1, o2.rowIndex + o2.rowSpan - 1);
      return { fromX: Math.min(r3, l3), fromY: Math.min(s4, i3), toX: Math.max(r3, l3), toY: Math.max(s4, i3) };
    }
    getNodes() {
      if (!this.isValid()) return [];
      const e2 = this._cachedNodes;
      if (null !== e2) return e2;
      const { anchorTable: t2, anchorCell: n2, focusCell: o2 } = St6(this), r3 = o2.getParents()[1];
      if (r3 !== t2) {
        if (t2.isParentOf(o2)) {
          const e3 = r3.getParent();
          null == e3 && ke2(159), this.set(this.tableKey, o2.getKey(), e3.getKey());
        } else {
          const e3 = t2.getParent();
          null == e3 && ke2(158), this.set(this.tableKey, e3.getKey(), o2.getKey());
        }
        return this.getNodes();
      }
      const [l3, s4, i3] = gt6(t2, n2, o2), { minColumn: c3, maxColumn: a3, minRow: u3, maxRow: h2 } = Ct6(l3, s4, i3), d4 = /* @__PURE__ */ new Map([[t2.getKey(), t2]]);
      let f3 = null;
      for (let e3 = u3; e3 <= h2; e3++) for (let t3 = c3; t3 <= a3; t3++) {
        const { cell: n3 } = l3[e3][t3], o3 = n3.getParent();
        We2(o3) || ke2(160), o3 !== f3 && (d4.set(o3.getKey(), o3), f3 = o3), d4.has(n3.getKey()) || vt6(n3, (e4) => {
          d4.set(e4.getKey(), e4);
        });
      }
      const g3 = Array.from(d4.values());
      return isCurrentlyReadOnlyMode() || (this._cachedNodes = g3), g3;
    }
    getTextContent() {
      const e2 = this.getNodes().filter((e3) => Ae2(e3));
      let t2 = "";
      for (let n2 = 0; n2 < e2.length; n2++) {
        const o2 = e2[n2], r3 = o2.__parent, l3 = (e2[n2 + 1] || {}).__parent;
        t2 += o2.getTextContent() + (l3 !== r3 ? "\n" : "	");
      }
      return t2;
    }
  };
  function bt6(e2) {
    return e2 instanceof wt5;
  }
  function yt6() {
    const e2 = $createPoint("root", 0, "element"), t2 = $createPoint("root", 0, "element");
    return new wt5("root", e2, t2);
  }
  function Nt6(e2, t2, n2) {
    e2.getKey(), t2.getKey(), n2.getKey();
    const o2 = $getSelection(), r3 = bt6(o2) ? o2.clone() : yt6();
    return r3.set(e2.getKey(), t2.getKey(), n2.getKey()), r3;
  }
  function vt6(e2, t2) {
    const n2 = [[e2]];
    for (let e3 = n2.at(-1); void 0 !== e3 && n2.length > 0; e3 = n2.at(-1)) {
      const o2 = e3.pop();
      void 0 === o2 ? n2.pop() : false !== t2(o2) && $isElementNode(o2) && n2.push(o2.getChildren());
    }
  }
  function xt6(e2, t2 = $getEditor()) {
    const n2 = $getNodeByKey(e2);
    pn2(n2) || ke2(231, e2);
    const o2 = Ot5(n2, t2.getElementByKey(e2));
    return null === o2 && ke2(232, e2), { tableElement: o2, tableNode: n2 };
  }
  var Tt6 = class {
    focusX;
    focusY;
    listenersToRemove;
    table;
    isHighlightingCells;
    anchorX;
    anchorY;
    tableNodeKey;
    anchorCell;
    focusCell;
    anchorCellNodeKey;
    focusCellNodeKey;
    editor;
    tableSelection;
    hasHijackedSelectionStyles;
    isSelecting;
    pointerType;
    shouldCheckSelection;
    abortController;
    listenerOptions;
    nextFocus;
    constructor(e2, t2) {
      this.isHighlightingCells = false, this.anchorX = -1, this.anchorY = -1, this.focusX = -1, this.focusY = -1, this.listenersToRemove = /* @__PURE__ */ new Set(), this.tableNodeKey = t2, this.editor = e2, this.table = { columns: 0, domRows: [], rows: 0 }, this.tableSelection = null, this.anchorCellNodeKey = null, this.focusCellNodeKey = null, this.anchorCell = null, this.focusCell = null, this.hasHijackedSelectionStyles = false, this.isSelecting = false, this.pointerType = null, this.shouldCheckSelection = false, this.abortController = new AbortController(), this.listenerOptions = { signal: this.abortController.signal }, this.nextFocus = null, this.trackTable();
    }
    getTable() {
      return this.table;
    }
    removeListeners() {
      this.abortController.abort("removeListeners"), Array.from(this.listenersToRemove).forEach((e2) => e2()), this.listenersToRemove.clear();
    }
    $lookup() {
      return xt6(this.tableNodeKey, this.editor);
    }
    trackTable() {
      const e2 = new MutationObserver((e3) => {
        this.editor.getEditorState().read(() => {
          let t2 = false;
          for (let n3 = 0; n3 < e3.length; n3++) {
            const o3 = e3[n3].target.nodeName;
            if ("TABLE" === o3 || "TBODY" === o3 || "THEAD" === o3 || "TR" === o3) {
              t2 = true;
              break;
            }
          }
          if (!t2) return;
          const { tableNode: n2, tableElement: o2 } = this.$lookup();
          this.table = Lt5(n2, o2);
        }, { editor: this.editor });
      });
      this.editor.getEditorState().read(() => {
        const { tableNode: t2, tableElement: n2 } = this.$lookup();
        this.table = Lt5(t2, n2), e2.observe(n2, { attributes: true, childList: true, subtree: true });
      }, { editor: this.editor });
    }
    $clearHighlight() {
      const e2 = this.editor;
      this.isHighlightingCells = false, this.anchorX = -1, this.anchorY = -1, this.focusX = -1, this.focusY = -1, this.tableSelection = null, this.anchorCellNodeKey = null, this.focusCellNodeKey = null, this.anchorCell = null, this.focusCell = null, this.hasHijackedSelectionStyles = false, this.$enableHighlightStyle();
      const { tableNode: t2, tableElement: n2 } = this.$lookup();
      Bt4(e2, Lt5(t2, n2), null), null !== $getSelection() && ($setSelection(null), e2.dispatchCommand(SELECTION_CHANGE_COMMAND, void 0));
    }
    $enableHighlightStyle() {
      const e2 = this.editor, { tableElement: t2 } = this.$lookup();
      removeClassNamesFromElement(t2, e2._config.theme.tableSelection), t2.classList.remove("disable-selection"), this.hasHijackedSelectionStyles = false;
    }
    $disableHighlightStyle() {
      const { tableElement: t2 } = this.$lookup();
      addClassNamesToElement(t2, this.editor._config.theme.tableSelection), this.hasHijackedSelectionStyles = true;
    }
    $updateTableTableSelection(e2) {
      if (null !== e2) {
        e2.tableKey !== this.tableNodeKey && ke2(233, e2.tableKey, this.tableNodeKey);
        const t2 = this.editor;
        this.tableSelection = e2, this.isHighlightingCells = true, this.$disableHighlightStyle(), this.updateDOMSelection(), Bt4(t2, this.table, this.tableSelection);
      } else this.$clearHighlight();
    }
    setShouldCheckSelection() {
      this.shouldCheckSelection = true;
    }
    getAndClearShouldCheckSelection() {
      return !!this.shouldCheckSelection && (this.shouldCheckSelection = false, true);
    }
    setNextFocus(e2) {
      this.nextFocus = e2;
    }
    getAndClearNextFocus() {
      const { nextFocus: e2 } = this;
      return null !== e2 && (this.nextFocus = null), e2;
    }
    updateDOMSelection() {
      if (null !== this.anchorCell && null !== this.focusCell) {
        const e2 = getDOMSelection(this.editor._window);
        e2 && e2.rangeCount > 0 && e2.removeAllRanges();
      }
    }
    $setFocusCellForSelection(e2, t2 = false) {
      const n2 = this.editor, { tableNode: o2 } = this.$lookup(), r3 = e2.x, l3 = e2.y;
      if (this.focusCell = e2, this.isHighlightingCells || this.anchorX === r3 && this.anchorY === l3 && !t2) {
        if (r3 === this.focusX && l3 === this.focusY) return false;
      } else this.isHighlightingCells = true, this.$disableHighlightStyle();
      if (this.focusX = r3, this.focusY = l3, this.isHighlightingCells) {
        const t3 = sn2(o2, e2.elem);
        if (null != this.tableSelection && null != this.anchorCellNodeKey && null !== t3) return this.focusCellNodeKey = t3.getKey(), this.tableSelection = Nt6(o2, this.$getAnchorTableCellOrThrow(), t3), $setSelection(this.tableSelection), n2.dispatchCommand(SELECTION_CHANGE_COMMAND, void 0), Bt4(n2, this.table, this.tableSelection), true;
      }
      return false;
    }
    $getAnchorTableCell() {
      return this.anchorCellNodeKey ? $getNodeByKey(this.anchorCellNodeKey) : null;
    }
    $getAnchorTableCellOrThrow() {
      const e2 = this.$getAnchorTableCell();
      return null === e2 && ke2(234), e2;
    }
    $getFocusTableCell() {
      return this.focusCellNodeKey ? $getNodeByKey(this.focusCellNodeKey) : null;
    }
    $getFocusTableCellOrThrow() {
      const e2 = this.$getFocusTableCell();
      return null === e2 && ke2(235), e2;
    }
    $setAnchorCellForSelection(e2) {
      this.isHighlightingCells = false, this.anchorCell = e2, this.anchorX = e2.x, this.anchorY = e2.y;
      const { tableNode: t2 } = this.$lookup(), n2 = sn2(t2, e2.elem);
      if (null !== n2) {
        const e3 = n2.getKey();
        this.tableSelection = null != this.tableSelection ? this.tableSelection.clone() : yt6(), this.anchorCellNodeKey = e3;
      }
    }
    $formatCells(e2) {
      const t2 = $getSelection();
      bt6(t2) || ke2(236);
      const n2 = $createRangeSelection(), o2 = n2.anchor, r3 = n2.focus, l3 = t2.getNodes().filter(Ae2);
      l3.length > 0 || ke2(237);
      const s4 = l3[0].getFirstChild(), i3 = $isParagraphNode(s4) ? s4.getFormatFlags(e2, null) : null;
      l3.forEach((t3) => {
        o2.set(t3.getKey(), 0, "element"), r3.set(t3.getKey(), t3.getChildrenSize(), "element"), n2.formatText(e2, i3);
      }), $setSelection(t2), this.editor.dispatchCommand(SELECTION_CHANGE_COMMAND, void 0);
    }
    $clearText() {
      const { editor: e2 } = this, t2 = $getNodeByKey(this.tableNodeKey);
      if (!pn2(t2)) throw new Error("Expected TableNode.");
      const n2 = $getSelection();
      bt6(n2) || ke2(253);
      const o2 = n2.getNodes().filter(Ae2), r3 = t2.getFirstChild(), l3 = t2.getLastChild();
      if (o2.length > 0 && null !== r3 && null !== l3 && We2(r3) && We2(l3) && o2[0] === r3.getFirstChild() && o2[o2.length - 1] === l3.getLastChild()) {
        t2.selectPrevious();
        const n3 = t2.getParent();
        return t2.remove(), void ($isRootNode(n3) && n3.isEmpty() && e2.dispatchCommand(INSERT_PARAGRAPH_COMMAND, void 0));
      }
      o2.forEach((e3) => {
        if ($isElementNode(e3)) {
          const t3 = $createParagraphNode(), n3 = $createTextNode();
          t3.append(n3), e3.append(t3), e3.getChildren().forEach((e4) => {
            e4 !== t3 && e4.remove();
          });
        }
      }), Bt4(e2, this.table, null), $setSelection(null), e2.dispatchCommand(SELECTION_CHANGE_COMMAND, void 0);
    }
  };
  var Rt4 = "__lexicalTableSelection";
  function Ft5(e2) {
    return isHTMLElement(e2) && "TABLE" === e2.nodeName;
  }
  function Ot5(e2, t2) {
    if (!t2) return t2;
    const n2 = Ft5(t2) ? t2 : e2.getDOMSlot(t2).element;
    return "TABLE" !== n2.nodeName && ke2(245, t2.nodeName), n2;
  }
  function At6(e2) {
    return e2._window;
  }
  function Kt5(e2, t2) {
    for (let n2 = t2, o2 = null; null !== n2; n2 = n2.getParent()) {
      if (e2.is(n2)) return o2;
      Ae2(n2) && (o2 = n2);
    }
    return null;
  }
  var kt6 = [[KEY_ARROW_DOWN_COMMAND, "down"], [KEY_ARROW_UP_COMMAND, "up"], [KEY_ARROW_LEFT_COMMAND, "backward"], [KEY_ARROW_RIGHT_COMMAND, "forward"]];
  var Et5 = [DELETE_WORD_COMMAND, DELETE_LINE_COMMAND, DELETE_CHARACTER_COMMAND];
  var Mt5 = [KEY_BACKSPACE_COMMAND, KEY_DELETE_COMMAND];
  function $t4(e2, t2, o2, l3) {
    const s4 = o2.getRootElement(), i3 = At6(o2);
    null !== s4 && null !== i3 || ke2(246);
    const c3 = new Tt6(o2, e2.getKey()), a3 = Ot5(e2, t2);
    !(function(e3, t3) {
      null !== Wt4(e3) && ke2(205);
      e3[Rt4] = t3;
    })(a3, c3), c3.listenersToRemove.add(() => (function(e3, t3) {
      Wt4(e3) === t3 && delete e3[Rt4];
    })(a3, c3));
    const u3 = (t3) => {
      if (c3.pointerType = t3.pointerType, 0 !== t3.button || !isDOMNode(t3.target) || !i3) return;
      const n2 = zt3(t3.target);
      null !== n2 && o2.update(() => {
        const o3 = $getPreviousSelection();
        if (Le2 && t3.shiftKey && qt3(o3, e2) && ($isRangeSelection(o3) || bt6(o3))) {
          const r3 = o3.anchor.getNode(), l4 = Kt5(e2, o3.anchor.getNode());
          if (l4) c3.$setAnchorCellForSelection(ln2(c3, l4)), c3.$setFocusCellForSelection(n2), nn2(t3);
          else {
            (e2.isBefore(r3) ? e2.selectStart() : e2.selectEnd()).anchor.set(o3.anchor.key, o3.anchor.offset, o3.anchor.type);
          }
        } else "touch" !== t3.pointerType && c3.$setAnchorCellForSelection(n2);
      }), (() => {
        if (c3.isSelecting) return;
        const e3 = () => {
          c3.isSelecting = false, i3.removeEventListener("pointerup", e3), i3.removeEventListener("pointermove", t4);
        }, t4 = (n3) => {
          if (1 & ~n3.buttons && c3.isSelecting) return c3.isSelecting = false, i3.removeEventListener("pointerup", e3), void i3.removeEventListener("pointermove", t4);
          if (!isDOMNode(n3.target)) return;
          let r3 = null;
          const l4 = !(Le2 || a3.contains(n3.target));
          if (l4) r3 = Ht4(a3, n3.target);
          else for (const e4 of document.elementsFromPoint(n3.clientX, n3.clientY)) if (r3 = Ht4(a3, e4), r3) break;
          !r3 || null !== c3.focusCell && r3.elem === c3.focusCell.elem || (c3.setNextFocus({ focusCell: r3, override: l4 }), o2.dispatchCommand(SELECTION_CHANGE_COMMAND, void 0));
        };
        c3.isSelecting = true, i3.addEventListener("pointerup", e3, c3.listenerOptions), i3.addEventListener("pointermove", t4, c3.listenerOptions);
      })();
    };
    a3.addEventListener("pointerdown", u3, c3.listenerOptions), c3.listenersToRemove.add(() => {
      a3.removeEventListener("pointerdown", u3);
    });
    const h2 = (e3) => {
      if (e3.detail >= 3 && isDOMNode(e3.target)) {
        null !== zt3(e3.target) && e3.preventDefault();
      }
    };
    a3.addEventListener("mousedown", h2, c3.listenerOptions), c3.listenersToRemove.add(() => {
      a3.removeEventListener("mousedown", h2);
    });
    const d4 = (e3) => {
      const t3 = e3.target;
      0 === e3.button && isDOMNode(t3) && o2.update(() => {
        const e4 = $getSelection();
        bt6(e4) && e4.tableKey === c3.tableNodeKey && s4.contains(t3) && c3.$clearHighlight();
      });
    };
    i3.addEventListener("pointerdown", d4, c3.listenerOptions), c3.listenersToRemove.add(() => {
      i3.removeEventListener("pointerdown", d4);
    });
    for (const [t3, n2] of kt6) c3.listenersToRemove.add(o2.registerCommand(t3, (t4) => tn2(o2, t4, n2, e2, c3), COMMAND_PRIORITY_HIGH));
    c3.listenersToRemove.add(o2.registerCommand(KEY_ESCAPE_COMMAND, (t3) => {
      const n2 = $getSelection();
      if (bt6(n2)) {
        const o3 = Kt5(e2, n2.focus.getNode());
        if (null !== o3) return nn2(t3), o3.selectEnd(), true;
      }
      return false;
    }, COMMAND_PRIORITY_HIGH));
    const g3 = (t3) => () => {
      const o3 = $getSelection();
      if (!qt3(o3, e2)) return false;
      if (bt6(o3)) return c3.$clearText(), true;
      if ($isRangeSelection(o3)) {
        if (!Ae2(Kt5(e2, o3.anchor.getNode()))) return false;
        const r3 = o3.anchor.getNode(), l4 = o3.focus.getNode(), s5 = e2.isParentOf(r3), i4 = e2.isParentOf(l4);
        if (s5 && !i4 || i4 && !s5) return c3.$clearText(), true;
        const a4 = $findMatchingParent2(o3.anchor.getNode(), (e3) => $isElementNode(e3)), u4 = a4 && $findMatchingParent2(a4, (e3) => $isElementNode(e3) && Ae2(e3.getParent()));
        if (!$isElementNode(u4) || !$isElementNode(a4)) return false;
        if (t3 === DELETE_LINE_COMMAND && null === u4.getPreviousSibling()) return true;
      }
      return false;
    };
    for (const e3 of Et5) c3.listenersToRemove.add(o2.registerCommand(e3, g3(e3), COMMAND_PRIORITY_HIGH));
    const p3 = (t3) => {
      const n2 = $getSelection();
      if (!bt6(n2) && !$isRangeSelection(n2)) return false;
      const o3 = e2.isParentOf(n2.anchor.getNode());
      if (o3 !== e2.isParentOf(n2.focus.getNode())) {
        const t4 = o3 ? "anchor" : "focus", r3 = o3 ? "focus" : "anchor", { key: l4, offset: s5, type: i4 } = n2[r3];
        return e2[n2[t4].isBefore(n2[r3]) ? "selectPrevious" : "selectNext"]()[r3].set(l4, s5, i4), false;
      }
      return !!qt3(n2, e2) && (!!bt6(n2) && (t3 && (t3.preventDefault(), t3.stopPropagation()), c3.$clearText(), true));
    };
    for (const e3 of Mt5) c3.listenersToRemove.add(o2.registerCommand(e3, p3, COMMAND_PRIORITY_HIGH));
    return c3.listenersToRemove.add(o2.registerCommand(CUT_COMMAND, (e3) => {
      const t3 = $getSelection();
      if (t3) {
        if (!bt6(t3) && !$isRangeSelection(t3)) return false;
        copyToClipboard(o2, objectKlassEquals(e3, ClipboardEvent) ? e3 : null, $getClipboardDataFromSelection(t3));
        const n2 = p3(e3);
        return $isRangeSelection(t3) ? (t3.removeText(), true) : n2;
      }
      return false;
    }, COMMAND_PRIORITY_HIGH)), c3.listenersToRemove.add(o2.registerCommand(FORMAT_TEXT_COMMAND, (t3) => {
      const o3 = $getSelection();
      if (!qt3(o3, e2)) return false;
      if (bt6(o3)) return c3.$formatCells(t3), true;
      if ($isRangeSelection(o3)) {
        const e3 = $findMatchingParent2(o3.anchor.getNode(), (e4) => Ae2(e4));
        if (!Ae2(e3)) return false;
      }
      return false;
    }, COMMAND_PRIORITY_HIGH)), c3.listenersToRemove.add(o2.registerCommand(FORMAT_ELEMENT_COMMAND, (t3) => {
      const n2 = $getSelection();
      if (!bt6(n2) || !qt3(n2, e2)) return false;
      const o3 = n2.anchor.getNode(), r3 = n2.focus.getNode();
      if (!Ae2(o3) || !Ae2(r3)) return false;
      if ((function(e3, t4) {
        if (bt6(e3)) {
          const n3 = e3.anchor.getNode(), o4 = e3.focus.getNode();
          if (t4 && n3 && o4) {
            const [e4] = gt6(t4, n3, o4);
            return n3.getKey() === e4[0][0].cell.getKey() && o4.getKey() === e4[e4.length - 1].at(-1).cell.getKey();
          }
        }
        return false;
      })(n2, e2)) return e2.setFormat(t3), true;
      const [l4, s5, i4] = gt6(e2, o3, r3), c4 = Math.max(s5.startRow + s5.cell.__rowSpan - 1, i4.startRow + i4.cell.__rowSpan - 1), a4 = Math.max(s5.startColumn + s5.cell.__colSpan - 1, i4.startColumn + i4.cell.__colSpan - 1), u4 = Math.min(s5.startRow, i4.startRow), h3 = Math.min(s5.startColumn, i4.startColumn), d5 = /* @__PURE__ */ new Set();
      for (let e3 = u4; e3 <= c4; e3++) for (let n3 = h3; n3 <= a4; n3++) {
        const o4 = l4[e3][n3].cell;
        if (d5.has(o4)) continue;
        d5.add(o4), o4.setFormat(t3);
        const r4 = o4.getChildren();
        for (let e4 = 0; e4 < r4.length; e4++) {
          const n4 = r4[e4];
          $isElementNode(n4) && !n4.isInline() && n4.setFormat(t3);
        }
      }
      return true;
    }, COMMAND_PRIORITY_HIGH)), c3.listenersToRemove.add(o2.registerCommand(CONTROLLED_TEXT_INSERTION_COMMAND, (t3) => {
      const r3 = $getSelection();
      if (!qt3(r3, e2)) return false;
      if (bt6(r3)) return c3.$clearHighlight(), false;
      if ($isRangeSelection(r3)) {
        const l4 = $findMatchingParent2(r3.anchor.getNode(), (e3) => Ae2(e3));
        if (!Ae2(l4)) return false;
        if ("string" == typeof t3) {
          const n2 = rn2(o2, r3, e2);
          if (n2) return on2(n2, e2, [$createTextNode(t3)]), true;
        }
      }
      return false;
    }, COMMAND_PRIORITY_HIGH)), l3 && c3.listenersToRemove.add(o2.registerCommand(KEY_TAB_COMMAND, (t3) => {
      const o3 = $getSelection();
      if (!$isRangeSelection(o3) || !o3.isCollapsed() || !qt3(o3, e2)) return false;
      const r3 = Qt3(o3.anchor.getNode());
      return !(null === r3 || !e2.is(Zt3(r3))) && (nn2(t3), (function(e3, t4) {
        const o4 = "next" === t4 ? "getNextSibling" : "getPreviousSibling", r4 = "next" === t4 ? "getFirstChild" : "getLastChild", l4 = e3[o4]();
        if ($isElementNode(l4)) return l4.selectEnd();
        const s5 = $findMatchingParent2(e3, We2);
        null === s5 && ke2(247);
        for (let e4 = s5[o4](); We2(e4); e4 = e4[o4]()) {
          const t5 = e4[r4]();
          if ($isElementNode(t5)) return t5.selectEnd();
        }
        const i4 = $findMatchingParent2(s5, pn2);
        null === i4 && ke2(248);
        "next" === t4 ? i4.selectNext() : i4.selectPrevious();
      })(r3, t3.shiftKey ? "previous" : "next"), true);
    }, COMMAND_PRIORITY_HIGH)), c3.listenersToRemove.add(o2.registerCommand(FOCUS_COMMAND, (t3) => e2.isSelected(), COMMAND_PRIORITY_HIGH)), c3.listenersToRemove.add(o2.registerCommand(SELECTION_INSERT_CLIPBOARD_NODES_COMMAND, (e3, t3) => {
      if (o2 !== t3) return false;
      const { nodes: r3, selection: l4 } = e3, s5 = l4.getStartEndPoints(), i4 = bt6(l4), c4 = $isRangeSelection(l4) && null !== $findMatchingParent2(l4.anchor.getNode(), (e4) => Ae2(e4)) && null !== $findMatchingParent2(l4.focus.getNode(), (e4) => Ae2(e4)) || i4;
      if (1 !== r3.length || !pn2(r3[0]) || !c4 || null === s5) return false;
      const [a4, u4] = s5, [h3, d5, g4] = pt6(a4), p4 = $findMatchingParent2(u4.getNode(), (e4) => Ae2(e4));
      if (!(Ae2(h3) && Ae2(p4) && We2(d5) && pn2(g4))) return false;
      const C4 = r3[0], [_5, S3, b5] = gt6(g4, h3, p4), [y4] = mt5(C4, null, null), N4 = _5.length, v4 = N4 > 0 ? _5[0].length : 0;
      let x4 = S3.startRow, T4 = S3.startColumn, R7 = y4.length, F7 = R7 > 0 ? y4[0].length : 0;
      if (i4) {
        const e4 = Ct6(_5, S3, b5), t4 = e4.maxRow - e4.minRow + 1, n2 = e4.maxColumn - e4.minColumn + 1;
        x4 = e4.minRow, T4 = e4.minColumn, R7 = Math.min(R7, t4), F7 = Math.min(F7, n2);
      }
      let O5 = false;
      const A5 = Math.min(N4, x4 + R7) - 1, K7 = Math.min(v4, T4 + F7) - 1, k4 = /* @__PURE__ */ new Set();
      for (let e4 = x4; e4 <= A5; e4++) for (let t4 = T4; t4 <= K7; t4++) {
        const n2 = _5[e4][t4];
        k4.has(n2.cell.getKey()) || (1 === n2.cell.__rowSpan && 1 === n2.cell.__colSpan || (ft5(n2.cell), k4.add(n2.cell.getKey()), O5 = true));
      }
      let [E6] = mt5(g4.getWritable(), null, null);
      const M6 = R7 - N4 + x4;
      for (let e4 = 0; e4 < M6; e4++) {
        Qe2(E6[N4 - 1][0].cell);
      }
      const $7 = F7 - v4 + T4;
      for (let e4 = 0; e4 < $7; e4++) {
        nt5(E6[0][v4 - 1].cell, true, false);
      }
      [E6] = mt5(g4.getWritable(), null, null);
      for (let e4 = x4; e4 < x4 + R7; e4++) for (let t4 = T4; t4 < T4 + F7; t4++) {
        const n2 = e4 - x4, o3 = t4 - T4, r4 = y4[n2][o3];
        if (r4.startRow !== n2 || r4.startColumn !== o3) continue;
        const l5 = r4.cell;
        if (1 !== l5.__rowSpan || 1 !== l5.__colSpan) {
          const n3 = [], o4 = Math.min(e4 + l5.__rowSpan, x4 + R7) - 1, r5 = Math.min(t4 + l5.__colSpan, T4 + F7) - 1;
          for (let l6 = e4; l6 <= o4; l6++) for (let e5 = t4; e5 <= r5; e5++) {
            const t5 = E6[l6][e5];
            n3.push(t5.cell);
          }
          ut5(n3), O5 = true;
        }
        const { cell: s6 } = E6[e4][t4], i5 = s6.getChildren();
        l5.getChildren().forEach((e5) => {
          if ($isTextNode(e5)) {
            $createParagraphNode().append(e5), s6.append(e5);
          } else s6.append(e5);
        }), i5.forEach((e5) => e5.remove());
      }
      if (i4 && O5) {
        const [e4] = mt5(g4.getWritable(), null, null);
        e4[S3.startRow][S3.startColumn].cell.selectEnd();
      }
      return true;
    }, COMMAND_PRIORITY_HIGH)), c3.listenersToRemove.add(o2.registerCommand(SELECTION_CHANGE_COMMAND, () => {
      const t3 = $getSelection(), r3 = $getPreviousSelection(), l4 = c3.getAndClearNextFocus();
      if (null !== l4) {
        const { focusCell: n2 } = l4;
        if (bt6(t3) && t3.tableKey === c3.tableNodeKey) return (n2.x !== c3.focusX || n2.y !== c3.focusY) && (c3.$setFocusCellForSelection(n2), true);
        if (n2 !== c3.anchorCell && qt3(t3, e2)) return c3.$setFocusCellForSelection(n2), true;
      }
      if (c3.getAndClearShouldCheckSelection() && $isRangeSelection(r3) && $isRangeSelection(t3) && t3.isCollapsed()) {
        const o3 = t3.anchor.getNode(), r4 = e2.getFirstChild(), l5 = Qt3(o3);
        if (null !== l5 && We2(r4)) {
          const t4 = r4.getFirstChild();
          if (Ae2(t4) && e2.is($findMatchingParent2(l5, (n2) => n2.is(e2) || n2.is(t4)))) return t4.selectStart(), true;
        }
      }
      if ($isRangeSelection(t3)) {
        const { anchor: n2, focus: l5 } = t3, s5 = n2.getNode(), i4 = l5.getNode(), a4 = Qt3(s5), u4 = Qt3(i4), h3 = !(!a4 || !e2.is(Zt3(a4))), d5 = !(!u4 || !e2.is(Zt3(u4))), f3 = h3 !== d5, g4 = h3 && d5, m3 = t3.isBackward();
        if (f3) {
          const n3 = t3.clone();
          if (d5) {
            const [t4] = gt6(e2, u4, u4), o3 = t4[0][0].cell, r4 = t4[t4.length - 1].at(-1).cell;
            n3.focus.set(m3 ? o3.getKey() : r4.getKey(), m3 ? 0 : r4.getChildrenSize(), "element");
          } else if (h3) {
            const [t4] = gt6(e2, a4, a4), o3 = t4[0][0].cell, r4 = t4[t4.length - 1].at(-1).cell;
            n3.anchor.set(m3 ? r4.getKey() : o3.getKey(), m3 ? r4.getChildrenSize() : 0, "element");
          }
          $setSelection(n3), Dt5(o2, c3);
        } else if (g4 && (a4.is(u4) || (c3.$setAnchorCellForSelection(ln2(c3, a4)), c3.$setFocusCellForSelection(ln2(c3, u4), true)), "touch" === c3.pointerType && c3.isSelecting && t3.isCollapsed() && $isRangeSelection(r3) && r3.isCollapsed())) {
          const e3 = Qt3(r3.anchor.getNode());
          e3 && !e3.is(u4) && (c3.$setAnchorCellForSelection(ln2(c3, e3)), c3.$setFocusCellForSelection(ln2(c3, u4), true), c3.pointerType = null);
        }
      } else if (t3 && bt6(t3) && t3.is(r3) && t3.tableKey === e2.getKey()) {
        const n2 = getDOMSelection(i3);
        if (n2 && n2.anchorNode && n2.focusNode) {
          const r4 = $getNearestNodeFromDOMNode(n2.focusNode), l5 = r4 && !e2.isParentOf(r4), s5 = $getNearestNodeFromDOMNode(n2.anchorNode), i4 = s5 && e2.isParentOf(s5);
          if (l5 && i4 && n2.rangeCount > 0) {
            const r5 = $createRangeSelectionFromDom(n2, o2);
            r5 && (r5.anchor.set(e2.getKey(), t3.isBackward() ? e2.getChildrenSize() : 0, "element"), n2.removeAllRanges(), $setSelection(r5));
          }
        }
      }
      return t3 && !t3.is(r3) && (bt6(t3) || bt6(r3)) && c3.tableSelection && !c3.tableSelection.is(r3) ? (bt6(t3) && t3.tableKey === c3.tableNodeKey ? c3.$updateTableTableSelection(t3) : !bt6(t3) && bt6(r3) && r3.tableKey === c3.tableNodeKey && c3.$updateTableTableSelection(null), false) : (c3.hasHijackedSelectionStyles && !e2.isSelected() ? (function(e3, t4) {
        t4.$enableHighlightStyle(), Pt6(t4.table, (t5) => {
          const n2 = t5.elem;
          t5.highlighted = false, Gt3(e3, t5), n2.getAttribute("style") || n2.removeAttribute("style");
        });
      })(o2, c3) : !c3.hasHijackedSelectionStyles && e2.isSelected() && Dt5(o2, c3), false);
    }, COMMAND_PRIORITY_HIGH)), c3.listenersToRemove.add(o2.registerCommand(INSERT_PARAGRAPH_COMMAND, () => {
      const t3 = $getSelection();
      if (!$isRangeSelection(t3) || !t3.isCollapsed() || !qt3(t3, e2)) return false;
      const n2 = rn2(o2, t3, e2);
      return !!n2 && (on2(n2, e2), true);
    }, COMMAND_PRIORITY_HIGH)), c3;
  }
  function Wt4(e2) {
    return e2[Rt4] || null;
  }
  function zt3(e2) {
    let t2 = e2;
    for (; null != t2; ) {
      const e3 = t2.nodeName;
      if ("TD" === e3 || "TH" === e3) {
        const e4 = t2._cell;
        return void 0 === e4 ? null : e4;
      }
      t2 = t2.parentNode;
    }
    return null;
  }
  function Ht4(e2, t2) {
    if (!e2.contains(t2)) return null;
    let n2 = null;
    for (let o2 = t2; null != o2; o2 = o2.parentNode) {
      if (o2 === e2) return n2;
      const t3 = o2.nodeName;
      "TD" !== t3 && "TH" !== t3 || (n2 = o2._cell || null);
    }
    return null;
  }
  function Lt5(e2, t2) {
    const n2 = [], o2 = { columns: 0, domRows: n2, rows: 0 };
    let r3 = Ot5(e2, t2).querySelector("tr"), l3 = 0, s4 = 0;
    for (n2.length = 0; null != r3; ) {
      const e3 = r3.nodeName;
      if ("TD" === e3 || "TH" === e3) {
        const e4 = { elem: r3, hasBackgroundColor: "" !== r3.style.backgroundColor, highlighted: false, x: l3, y: s4 };
        r3._cell = e4;
        let t4 = n2[s4];
        void 0 === t4 && (t4 = n2[s4] = []), t4[l3] = e4;
      } else {
        const e4 = r3.firstChild;
        if (null != e4) {
          r3 = e4;
          continue;
        }
      }
      const t3 = r3.nextSibling;
      if (null != t3) {
        l3++, r3 = t3;
        continue;
      }
      const o3 = r3.parentNode;
      if (null != o3) {
        const e4 = o3.nextSibling;
        if (null == e4) break;
        s4++, l3 = 0, r3 = e4;
      }
    }
    return o2.columns = l3 + 1, o2.rows = s4 + 1, o2;
  }
  function Bt4(e2, t2, n2) {
    const o2 = new Set(n2 ? n2.getNodes() : []);
    Pt6(t2, (t3, n3) => {
      const r3 = t3.elem;
      o2.has(n3) ? (t3.highlighted = true, Vt3(e2, t3)) : (t3.highlighted = false, Gt3(e2, t3), r3.getAttribute("style") || r3.removeAttribute("style"));
    });
  }
  function Pt6(e2, t2) {
    const { domRows: n2 } = e2;
    for (let e3 = 0; e3 < n2.length; e3++) {
      const o2 = n2[e3];
      if (o2) for (let n3 = 0; n3 < o2.length; n3++) {
        const r3 = o2[n3];
        if (!r3) continue;
        const l3 = $getNearestNodeFromDOMNode(r3.elem);
        null !== l3 && t2(r3, l3, { x: n3, y: e3 });
      }
    }
  }
  function Dt5(e2, t2) {
    t2.$disableHighlightStyle(), Pt6(t2.table, (t3) => {
      t3.highlighted = true, Vt3(e2, t3);
    });
  }
  var It4 = (e2, t2, n2, o2, r3) => {
    const l3 = "forward" === r3;
    switch (r3) {
      case "backward":
      case "forward":
        return n2 !== (l3 ? e2.table.columns - 1 : 0) ? jt4(t2.getCellNodeFromCordsOrThrow(n2 + (l3 ? 1 : -1), o2, e2.table), l3) : o2 !== (l3 ? e2.table.rows - 1 : 0) ? jt4(t2.getCellNodeFromCordsOrThrow(l3 ? 0 : e2.table.columns - 1, o2 + (l3 ? 1 : -1), e2.table), l3) : l3 ? t2.selectNext() : t2.selectPrevious(), true;
      case "up":
        return 0 !== o2 ? jt4(t2.getCellNodeFromCordsOrThrow(n2, o2 - 1, e2.table), false) : t2.selectPrevious(), true;
      case "down":
        return o2 !== e2.table.rows - 1 ? jt4(t2.getCellNodeFromCordsOrThrow(n2, o2 + 1, e2.table), true) : t2.selectNext(), true;
      default:
        return false;
    }
  };
  function Ut3(e2, t2) {
    let n2, o2;
    if (t2.startColumn === e2.minColumn) n2 = "minColumn";
    else {
      if (t2.startColumn + t2.cell.__colSpan - 1 !== e2.maxColumn) return null;
      n2 = "maxColumn";
    }
    if (t2.startRow === e2.minRow) o2 = "minRow";
    else {
      if (t2.startRow + t2.cell.__rowSpan - 1 !== e2.maxRow) return null;
      o2 = "maxRow";
    }
    return [n2, o2];
  }
  function Jt4([e2, t2]) {
    return ["minColumn" === e2 ? "maxColumn" : "minColumn", "minRow" === t2 ? "maxRow" : "minRow"];
  }
  function Yt3(e2, t2, [n2, o2]) {
    const r3 = t2[o2], l3 = e2[r3];
    void 0 === l3 && ke2(250, o2, String(r3));
    const s4 = t2[n2], i3 = l3[s4];
    return void 0 === i3 && ke2(250, n2, String(s4)), i3;
  }
  function Xt3(e2, t2, n2, o2, r3) {
    const l3 = Ct6(t2, n2, o2), s4 = (function(e3, t3) {
      const { minColumn: n3, maxColumn: o3, minRow: r4, maxRow: l4 } = t3;
      let s5 = 1, i4 = 1, c4 = 1, a4 = 1;
      const u4 = e3[r4], h3 = e3[l4];
      for (let e4 = n3; e4 <= o3; e4++) s5 = Math.max(s5, u4[e4].cell.__rowSpan), a4 = Math.max(a4, h3[e4].cell.__rowSpan);
      for (let t4 = r4; t4 <= l4; t4++) i4 = Math.max(i4, e3[t4][n3].cell.__colSpan), c4 = Math.max(c4, e3[t4][o3].cell.__colSpan);
      return { bottomSpan: a4, leftSpan: i4, rightSpan: c4, topSpan: s5 };
    })(t2, l3), { topSpan: i3, leftSpan: c3, bottomSpan: a3, rightSpan: u3 } = s4, h2 = (function(e3, t3) {
      const n3 = Ut3(e3, t3);
      return null === n3 && ke2(249, t3.cell.getKey()), n3;
    })(l3, n2), [d4, f3] = Jt4(h2);
    let g3 = l3[d4], m3 = l3[f3];
    "forward" === r3 ? g3 += "maxColumn" === d4 ? 1 : c3 : "backward" === r3 ? g3 -= "minColumn" === d4 ? 1 : u3 : "down" === r3 ? m3 += "maxRow" === f3 ? 1 : i3 : "up" === r3 && (m3 -= "minRow" === f3 ? 1 : a3);
    const p3 = t2[m3];
    if (void 0 === p3) return false;
    const C4 = p3[g3];
    if (void 0 === C4) return false;
    const [_5, S3] = (function(e3, t3, n3) {
      const o3 = Ct6(e3, t3, n3), r4 = Ut3(o3, t3);
      if (r4) return [Yt3(e3, o3, r4), Yt3(e3, o3, Jt4(r4))];
      const l4 = Ut3(o3, n3);
      if (l4) return [Yt3(e3, o3, Jt4(l4)), Yt3(e3, o3, l4)];
      const s5 = ["minColumn", "minRow"];
      return [Yt3(e3, o3, s5), Yt3(e3, o3, Jt4(s5))];
    })(t2, n2, C4), w5 = ln2(e2, _5.cell), b5 = ln2(e2, S3.cell);
    return e2.$setAnchorCellForSelection(w5), e2.$setFocusCellForSelection(b5, true), true;
  }
  function qt3(e2, t2) {
    if ($isRangeSelection(e2) || bt6(e2)) {
      const n2 = t2.isParentOf(e2.anchor.getNode()), o2 = t2.isParentOf(e2.focus.getNode());
      return n2 && o2;
    }
    return false;
  }
  function jt4(e2, t2) {
    t2 ? e2.selectStart() : e2.selectEnd();
  }
  function Vt3(t2, n2) {
    const o2 = n2.elem, r3 = t2._config.theme;
    Ae2($getNearestNodeFromDOMNode(o2)) || ke2(131), addClassNamesToElement(o2, r3.tableCellSelected);
  }
  function Gt3(e2, t2) {
    const n2 = t2.elem;
    Ae2($getNearestNodeFromDOMNode(n2)) || ke2(131);
    const r3 = e2._config.theme;
    removeClassNamesFromElement(n2, r3.tableCellSelected);
  }
  function Qt3(e2) {
    const t2 = $findMatchingParent2(e2, Ae2);
    return Ae2(t2) ? t2 : null;
  }
  function Zt3(e2) {
    const t2 = $findMatchingParent2(e2, pn2);
    return pn2(t2) ? t2 : null;
  }
  function en2(e2, t2, o2, r3, l3, s4, i3) {
    const c3 = $caretFromPoint(o2.focus, l3 ? "previous" : "next");
    if ($isExtendableTextPointCaret(c3)) return false;
    let a3 = c3;
    for (const e3 of $extendCaretToRange(c3).iterNodeCarets("shadowRoot")) {
      if (!$isSiblingCaret(e3) || !$isElementNode(e3.origin)) return false;
      a3 = e3;
    }
    const u3 = a3.getParentAtCaret();
    if (!Ae2(u3)) return false;
    const h2 = u3, d4 = (function(e3) {
      for (const t3 of $extendCaretToRange(e3).iterNodeCarets("root")) {
        const { origin: n2 } = t3;
        if (Ae2(n2)) {
          if ($isChildCaret(t3)) return $getChildCaret(n2, e3.direction);
        } else if (!We2(n2)) break;
      }
      return null;
    })($getSiblingCaret(h2, a3.direction)), f3 = $findMatchingParent2(h2, pn2);
    if (!f3 || !f3.is(s4)) return false;
    const g3 = e2.getElementByKey(h2.getKey()), m3 = zt3(g3);
    if (!g3 || !m3) return false;
    const p3 = fn2(e2, f3);
    if (i3.table = p3, d4) if ("extend" === r3) {
      const t3 = zt3(e2.getElementByKey(d4.origin.getKey()));
      if (!t3) return false;
      i3.$setAnchorCellForSelection(m3), i3.$setFocusCellForSelection(t3, true);
    } else {
      const e3 = $normalizeCaret(d4);
      $setPointFromCaret(o2.anchor, e3), $setPointFromCaret(o2.focus, e3);
    }
    else if ("extend" === r3) i3.$setAnchorCellForSelection(m3), i3.$setFocusCellForSelection(m3, true);
    else {
      const e3 = (function(e4) {
        const t3 = $getAdjacentChildCaret(e4);
        return $isChildCaret(t3) ? $normalizeCaret(t3) : e4;
      })($getSiblingCaret(f3, c3.direction));
      $setPointFromCaret(o2.anchor, e3), $setPointFromCaret(o2.focus, e3);
    }
    return nn2(t2), true;
  }
  function tn2(e2, t2, o2, r3, l3) {
    if (("up" === o2 || "down" === o2) && (function(e3) {
      const t3 = e3.getRootElement();
      if (!t3) return false;
      return t3.hasAttribute("aria-controls") && "typeahead-menu" === t3.getAttribute("aria-controls");
    })(e2)) return false;
    const s4 = $getSelection();
    if (!qt3(s4, r3)) {
      if ($isRangeSelection(s4)) {
        if ("backward" === o2) {
          if (s4.focus.offset > 0) return false;
          const e3 = (function(e4) {
            for (let t3 = e4, n3 = e4; null !== n3; t3 = n3, n3 = n3.getParent()) if ($isElementNode(n3)) {
              if (n3 !== t3 && n3.getFirstChild() !== t3) return null;
              if (!n3.isInline()) return n3;
            }
            return null;
          })(s4.focus.getNode());
          if (!e3) return false;
          const n2 = e3.getPreviousSibling();
          return !!pn2(n2) && (nn2(t2), t2.shiftKey ? s4.focus.set(n2.getParentOrThrow().getKey(), n2.getIndexWithinParent(), "element") : n2.selectEnd(), true);
        }
        if (t2.shiftKey && ("up" === o2 || "down" === o2)) {
          const e3 = s4.focus.getNode();
          if (!s4.isCollapsed() && ("up" === o2 && !s4.isBackward() || "down" === o2 && s4.isBackward())) {
            let l4 = $findMatchingParent2(e3, (e4) => pn2(e4));
            if (Ae2(l4) && (l4 = $findMatchingParent2(l4, pn2)), l4 !== r3) return false;
            if (!l4) return false;
            const i3 = "down" === o2 ? l4.getNextSibling() : l4.getPreviousSibling();
            if (!i3) return false;
            let c3 = 0;
            "up" === o2 && $isElementNode(i3) && (c3 = i3.getChildrenSize());
            let a3 = i3;
            if ("up" === o2 && $isElementNode(i3)) {
              const e4 = i3.getLastChild();
              a3 = e4 || i3, c3 = $isTextNode(a3) ? a3.getTextContentSize() : 0;
            }
            const u3 = s4.clone();
            return u3.focus.set(a3.getKey(), c3, $isTextNode(a3) ? "text" : "element"), $setSelection(u3), nn2(t2), true;
          }
          if ($isRootOrShadowRoot(e3)) {
            const e4 = "up" === o2 ? s4.getNodes()[s4.getNodes().length - 1] : s4.getNodes()[0];
            if (e4) {
              if (null !== Kt5(r3, e4)) {
                const e5 = r3.getFirstDescendant(), t3 = r3.getLastDescendant();
                if (!e5 || !t3) return false;
                const [n2] = pt6(e5), [o3] = pt6(t3), s5 = r3.getCordsFromCellNode(n2, l3.table), i3 = r3.getCordsFromCellNode(o3, l3.table), c3 = r3.getDOMCellFromCordsOrThrow(s5.x, s5.y, l3.table), a3 = r3.getDOMCellFromCordsOrThrow(i3.x, i3.y, l3.table);
                return l3.$setAnchorCellForSelection(c3), l3.$setFocusCellForSelection(a3, true), true;
              }
            }
            return false;
          }
          {
            let r4 = $findMatchingParent2(e3, (e4) => $isElementNode(e4) && !e4.isInline());
            if (Ae2(r4) && (r4 = $findMatchingParent2(r4, pn2)), !r4) return false;
            const i3 = "down" === o2 ? r4.getNextSibling() : r4.getPreviousSibling();
            if (pn2(i3) && l3.tableNodeKey === i3.getKey()) {
              const e4 = i3.getFirstDescendant(), n2 = i3.getLastDescendant();
              if (!e4 || !n2) return false;
              const [r5] = pt6(e4), [l4] = pt6(n2), c3 = s4.clone();
              return c3.focus.set(("up" === o2 ? r5 : l4).getKey(), "up" === o2 ? 0 : l4.getChildrenSize(), "element"), nn2(t2), $setSelection(c3), true;
            }
          }
        }
      }
      return "down" === o2 && un2(e2) && l3.setShouldCheckSelection(), false;
    }
    if ($isRangeSelection(s4)) {
      if ("backward" === o2 || "forward" === o2) {
        return en2(e2, t2, s4, t2.shiftKey ? "extend" : "move", "backward" === o2, r3, l3);
      }
      if (s4.isCollapsed()) {
        const { anchor: i3, focus: c3 } = s4, a3 = $findMatchingParent2(i3.getNode(), Ae2), u3 = $findMatchingParent2(c3.getNode(), Ae2);
        if (!Ae2(a3) || !a3.is(u3)) return false;
        const h2 = Zt3(a3);
        if (h2 !== r3 && null != h2) {
          const n2 = Ot5(h2, e2.getElementByKey(h2.getKey()));
          if (null != n2) return l3.table = Lt5(h2, n2), tn2(e2, t2, o2, h2, l3);
        }
        const d4 = e2.getElementByKey(a3.__key), f3 = e2.getElementByKey(i3.key);
        if (null == f3 || null == d4) return false;
        let g3;
        if ("element" === i3.type) g3 = f3.getBoundingClientRect();
        else {
          const t3 = getDOMSelection(At6(e2));
          if (null === t3 || 0 === t3.rangeCount) return false;
          g3 = t3.getRangeAt(0).getBoundingClientRect();
        }
        const m3 = "up" === o2 ? a3.getFirstChild() : a3.getLastChild();
        if (null == m3) return false;
        const p3 = e2.getElementByKey(m3.__key);
        if (null == p3) return false;
        const C4 = p3.getBoundingClientRect();
        if ("up" === o2 ? C4.top > g3.top - g3.height : g3.bottom + g3.height > C4.bottom) {
          nn2(t2);
          const e3 = r3.getCordsFromCellNode(a3, l3.table);
          if (!t2.shiftKey) return It4(l3, r3, e3.x, e3.y, o2);
          {
            const t3 = r3.getDOMCellFromCordsOrThrow(e3.x, e3.y, l3.table);
            l3.$setAnchorCellForSelection(t3), l3.$setFocusCellForSelection(t3, true);
          }
          return true;
        }
      }
    } else if (bt6(s4)) {
      const { anchor: i3, focus: c3 } = s4, a3 = $findMatchingParent2(i3.getNode(), Ae2), u3 = $findMatchingParent2(c3.getNode(), Ae2), [h2] = s4.getNodes();
      pn2(h2) || ke2(251);
      const d4 = Ot5(h2, e2.getElementByKey(h2.getKey()));
      if (!Ae2(a3) || !Ae2(u3) || !pn2(h2) || null == d4) return false;
      l3.$updateTableTableSelection(s4);
      const f3 = Lt5(h2, d4), g3 = r3.getCordsFromCellNode(a3, f3), m3 = r3.getDOMCellFromCordsOrThrow(g3.x, g3.y, f3);
      if (l3.$setAnchorCellForSelection(m3), nn2(t2), t2.shiftKey) {
        const [e3, t3, n2] = gt6(r3, a3, u3);
        return Xt3(l3, e3, t3, n2, o2);
      }
      return u3.selectEnd(), true;
    }
    return false;
  }
  function nn2(e2) {
    e2.preventDefault(), e2.stopImmediatePropagation(), e2.stopPropagation();
  }
  function on2(e2, t2, n2) {
    const o2 = $createParagraphNode();
    "first" === e2 ? t2.insertBefore(o2) : t2.insertAfter(o2), o2.append(...n2 || []), o2.selectEnd();
  }
  function rn2(e2, t2, o2) {
    const r3 = o2.getParent();
    if (!r3) return;
    const l3 = getDOMSelection(At6(e2));
    if (!l3) return;
    const s4 = l3.anchorNode, i3 = e2.getElementByKey(r3.getKey()), c3 = Ot5(o2, e2.getElementByKey(o2.getKey()));
    if (!s4 || !i3 || !c3 || !i3.contains(s4) || c3.contains(s4)) return;
    const a3 = $findMatchingParent2(t2.anchor.getNode(), (e3) => Ae2(e3));
    if (!a3) return;
    const u3 = $findMatchingParent2(a3, (e3) => pn2(e3));
    if (!pn2(u3) || !u3.is(o2)) return;
    const [h2, d4] = gt6(o2, a3, a3), f3 = h2[0][0], g3 = h2[h2.length - 1][h2[0].length - 1], { startRow: m3, startColumn: p3 } = d4, C4 = m3 === f3.startRow && p3 === f3.startColumn, _5 = m3 === g3.startRow && p3 === g3.startColumn;
    return C4 ? "first" : _5 ? "last" : void 0;
  }
  function ln2(e2, t2) {
    const { tableNode: n2 } = e2.$lookup(), o2 = n2.getCordsFromCellNode(t2, e2.table);
    return n2.getDOMCellFromCordsOrThrow(o2.x, o2.y, e2.table);
  }
  function sn2(e2, t2, n2) {
    return Kt5(e2, $getNearestNodeFromDOMNode(t2, n2));
  }
  function cn2(t2, n2, r3) {
    if (!n2.theme.tableAlignment) return;
    const l3 = [], s4 = [];
    for (const e2 of ["center", "right"]) {
      const t3 = n2.theme.tableAlignment[e2];
      t3 && (e2 === r3 ? s4 : l3).push(t3);
    }
    removeClassNamesFromElement(t2, ...l3), addClassNamesToElement(t2, ...s4);
  }
  var an2 = /* @__PURE__ */ new WeakSet();
  function un2(e2 = $getEditor()) {
    return an2.has(e2);
  }
  function hn2(e2, t2) {
    t2 ? an2.add(e2) : an2.delete(e2);
  }
  var dn2 = class _dn extends ElementNode {
    __rowStriping;
    __frozenColumnCount;
    __frozenRowCount;
    __colWidths;
    static getType() {
      return "table";
    }
    getColWidths() {
      return this.getLatest().__colWidths;
    }
    setColWidths(e2) {
      const t2 = this.getWritable();
      return t2.__colWidths = e2, t2;
    }
    static clone(e2) {
      return new _dn(e2.__key);
    }
    afterCloneFrom(e2) {
      super.afterCloneFrom(e2), this.__colWidths = e2.__colWidths, this.__rowStriping = e2.__rowStriping, this.__frozenColumnCount = e2.__frozenColumnCount, this.__frozenRowCount = e2.__frozenRowCount;
    }
    static importDOM() {
      return { table: (e2) => ({ conversion: gn2, priority: 1 }) };
    }
    static importJSON(e2) {
      return mn2().updateFromJSON(e2);
    }
    updateFromJSON(e2) {
      return super.updateFromJSON(e2).setRowStriping(e2.rowStriping || false).setFrozenColumns(e2.frozenColumnCount || 0).setFrozenRows(e2.frozenRowCount || 0).setColWidths(e2.colWidths);
    }
    constructor(e2) {
      super(e2), this.__rowStriping = false, this.__frozenColumnCount = 0, this.__frozenRowCount = 0, this.__colWidths = void 0;
    }
    exportJSON() {
      return { ...super.exportJSON(), colWidths: this.getColWidths(), frozenColumnCount: this.__frozenColumnCount ? this.__frozenColumnCount : void 0, frozenRowCount: this.__frozenRowCount ? this.__frozenRowCount : void 0, rowStriping: this.__rowStriping ? this.__rowStriping : void 0 };
    }
    extractWithChild(e2, t2, n2) {
      return "html" === n2;
    }
    getDOMSlot(e2) {
      const t2 = Ft5(e2) ? e2 : e2.querySelector("table");
      return Ft5(t2) || ke2(229), super.getDOMSlot(e2).withElement(t2).withAfter(t2.querySelector("colgroup"));
    }
    createDOM(t2, n2) {
      const o2 = document.createElement("table");
      this.__style && (o2.style.cssText = this.__style);
      const r3 = document.createElement("colgroup");
      if (o2.appendChild(r3), setDOMUnmanaged(r3), addClassNamesToElement(o2, t2.theme.table), this.updateTableElement(null, o2, t2), un2(n2)) {
        const n3 = document.createElement("div"), r4 = t2.theme.tableScrollableWrapper;
        return r4 ? addClassNamesToElement(n3, r4) : n3.style.cssText = "overflow-x: auto;", n3.appendChild(o2), this.updateTableWrapper(null, n3, o2, t2), n3;
      }
      return o2;
    }
    updateTableWrapper(t2, n2, r3, l3) {
      this.__frozenColumnCount !== (t2 ? t2.__frozenColumnCount : 0) && (function(t3, n3, r4, l4) {
        l4 > 0 ? (addClassNamesToElement(t3, r4.theme.tableFrozenColumn), n3.setAttribute("data-lexical-frozen-column", "true")) : (removeClassNamesFromElement(t3, r4.theme.tableFrozenColumn), n3.removeAttribute("data-lexical-frozen-column"));
      })(n2, r3, l3, this.__frozenColumnCount), this.__frozenRowCount !== (t2 ? t2.__frozenRowCount : 0) && (function(t3, n3, r4, l4) {
        l4 > 0 ? (addClassNamesToElement(t3, r4.theme.tableFrozenRow), n3.setAttribute("data-lexical-frozen-row", "true")) : (removeClassNamesFromElement(t3, r4.theme.tableFrozenRow), n3.removeAttribute("data-lexical-frozen-row"));
      })(n2, r3, l3, this.__frozenRowCount);
    }
    updateTableElement(t2, n2, r3) {
      this.__style !== (t2 ? t2.__style : "") && (n2.style.cssText = this.__style), this.__rowStriping !== (!!t2 && t2.__rowStriping) && (function(t3, n3, r4) {
        r4 ? (addClassNamesToElement(t3, n3.theme.tableRowStriping), t3.setAttribute("data-lexical-row-striping", "true")) : (removeClassNamesFromElement(t3, n3.theme.tableRowStriping), t3.removeAttribute("data-lexical-row-striping"));
      })(n2, r3, this.__rowStriping), (function(e2, t3, n3, o2) {
        const r4 = e2.querySelector("colgroup");
        if (!r4) return;
        const l3 = [];
        for (let e3 = 0; e3 < n3; e3++) {
          const t4 = document.createElement("col"), n4 = o2 && o2[e3];
          n4 && (t4.style.width = `${n4}px`), l3.push(t4);
        }
        r4.replaceChildren(...l3);
      })(n2, 0, this.getColumnCount(), this.getColWidths()), cn2(n2, r3, this.getFormatType());
    }
    updateDOM(e2, t2, n2) {
      const o2 = this.getDOMSlot(t2).element;
      return t2 === o2 === un2() || (isHTMLElement2(r3 = t2) && "DIV" === r3.nodeName && this.updateTableWrapper(e2, t2, o2, n2), this.updateTableElement(e2, o2, n2), false);
      var r3;
    }
    exportDOM(e2) {
      const t2 = super.exportDOM(e2), { element: n2 } = t2;
      return { after: (n3) => {
        if (t2.after && (n3 = t2.after(n3)), !Ft5(n3) && isHTMLElement2(n3) && (n3 = n3.querySelector("table")), !Ft5(n3)) return null;
        cn2(n3, e2._config, this.getFormatType());
        const [o2] = mt5(this, null, null), r3 = /* @__PURE__ */ new Map();
        for (const e3 of o2) for (const t3 of e3) {
          const e4 = t3.cell.getKey();
          r3.has(e4) || r3.set(e4, { colSpan: t3.cell.getColSpan(), startColumn: t3.startColumn });
        }
        const s4 = /* @__PURE__ */ new Set();
        for (const e3 of n3.querySelectorAll(":scope > tr > [data-temporary-table-cell-lexical-key]")) {
          const t3 = e3.getAttribute("data-temporary-table-cell-lexical-key");
          if (t3) {
            const n4 = r3.get(t3);
            if (e3.removeAttribute("data-temporary-table-cell-lexical-key"), n4) {
              r3.delete(t3);
              for (let e4 = 0; e4 < n4.colSpan; e4++) s4.add(e4 + n4.startColumn);
            }
          }
        }
        const i3 = n3.querySelector(":scope > colgroup");
        if (i3) {
          const e3 = Array.from(n3.querySelectorAll(":scope > colgroup > col")).filter((e4, t3) => s4.has(t3));
          i3.replaceChildren(...e3);
        }
        const c3 = n3.querySelectorAll(":scope > tr");
        if (c3.length > 0) {
          const e3 = document.createElement("tbody");
          for (const t3 of c3) e3.appendChild(t3);
          n3.append(e3);
        }
        return n3;
      }, element: !Ft5(n2) && isHTMLElement2(n2) ? n2.querySelector("table") : n2 };
    }
    canBeEmpty() {
      return false;
    }
    isShadowRoot() {
      return true;
    }
    getCordsFromCellNode(e2, t2) {
      const { rows: n2, domRows: o2 } = t2;
      for (let t3 = 0; t3 < n2; t3++) {
        const n3 = o2[t3];
        if (null != n3) for (let o3 = 0; o3 < n3.length; o3++) {
          const r3 = n3[o3];
          if (null == r3) continue;
          const { elem: l3 } = r3, s4 = sn2(this, l3);
          if (null !== s4 && e2.is(s4)) return { x: o3, y: t3 };
        }
      }
      throw new Error("Cell not found in table.");
    }
    getDOMCellFromCords(e2, t2, n2) {
      const { domRows: o2 } = n2, r3 = o2[t2];
      if (null == r3) return null;
      const l3 = r3[e2 < r3.length ? e2 : r3.length - 1];
      return null == l3 ? null : l3;
    }
    getDOMCellFromCordsOrThrow(e2, t2, n2) {
      const o2 = this.getDOMCellFromCords(e2, t2, n2);
      if (!o2) throw new Error("Cell not found at cords.");
      return o2;
    }
    getCellNodeFromCords(e2, t2, n2) {
      const o2 = this.getDOMCellFromCords(e2, t2, n2);
      if (null == o2) return null;
      const r3 = $getNearestNodeFromDOMNode(o2.elem);
      return Ae2(r3) ? r3 : null;
    }
    getCellNodeFromCordsOrThrow(e2, t2, n2) {
      const o2 = this.getCellNodeFromCords(e2, t2, n2);
      if (!o2) throw new Error("Node at cords not TableCellNode.");
      return o2;
    }
    getRowStriping() {
      return Boolean(this.getLatest().__rowStriping);
    }
    setRowStriping(e2) {
      const t2 = this.getWritable();
      return t2.__rowStriping = e2, t2;
    }
    setFrozenColumns(e2) {
      const t2 = this.getWritable();
      return t2.__frozenColumnCount = e2, t2;
    }
    getFrozenColumns() {
      return this.getLatest().__frozenColumnCount;
    }
    setFrozenRows(e2) {
      const t2 = this.getWritable();
      return t2.__frozenRowCount = e2, t2;
    }
    getFrozenRows() {
      return this.getLatest().__frozenRowCount;
    }
    canSelectBefore() {
      return true;
    }
    canIndent() {
      return false;
    }
    getColumnCount() {
      const e2 = this.getFirstChild();
      if (!e2) return 0;
      let t2 = 0;
      return e2.getChildren().forEach((e3) => {
        Ae2(e3) && (t2 += e3.getColSpan());
      }), t2;
    }
  };
  function fn2(e2, t2) {
    const n2 = e2.getElementByKey(t2.getKey());
    return null === n2 && ke2(230), Lt5(t2, n2);
  }
  function gn2(e2) {
    const n2 = mn2();
    e2.hasAttribute("data-lexical-row-striping") && n2.setRowStriping(true), e2.hasAttribute("data-lexical-frozen-column") && n2.setFrozenColumns(1), e2.hasAttribute("data-lexical-frozen-row") && n2.setFrozenRows(1);
    const o2 = e2.querySelector(":scope > colgroup");
    if (o2) {
      let e3 = [];
      for (const t2 of o2.querySelectorAll(":scope > col")) {
        let n3 = t2.style.width || "";
        if (!ve2.test(n3) && (n3 = t2.getAttribute("width") || "", !/^\d+$/.test(n3))) {
          e3 = void 0;
          break;
        }
        e3.push(parseFloat(n3));
      }
      e3 && n2.setColWidths(e3);
    }
    return { after: (e3) => $descendantsMatching(e3, We2), node: n2 };
  }
  function mn2() {
    return $applyNodeReplacement(new dn2());
  }
  function pn2(e2) {
    return e2 instanceof dn2;
  }
  function Cn2(e2) {
    We2(e2.getParent()) ? e2.isEmpty() && e2.append($createParagraphNode()) : e2.remove();
  }
  function _n2(e2) {
    pn2(e2.getParent()) ? $unwrapAndFilterDescendants(e2, Ae2) : e2.remove();
  }
  function Sn2(e2) {
    $unwrapAndFilterDescendants(e2, We2);
    const [t2] = mt5(e2, null, null), n2 = t2.reduce((e3, t3) => Math.max(e3, t3.length), 0), o2 = e2.getChildren();
    for (let e3 = 0; e3 < t2.length; ++e3) {
      const r4 = o2[e3];
      if (!r4) continue;
      We2(r4) || ke2(254, r4.constructor.name, r4.getType());
      const l4 = t2[e3].reduce((e4, t3) => t3 ? 1 + e4 : e4, 0);
      if (l4 !== n2) for (let e4 = l4; e4 < n2; ++e4) {
        const e5 = Oe2();
        e5.append($createParagraphNode()), r4.append(e5);
      }
    }
    const r3 = e2.getColWidths(), l3 = e2.getColumnCount();
    if (r3 && r3.length !== l3) {
      let t3;
      if (l3 < r3.length) t3 = r3.slice(0, l3);
      else if (r3.length > 0) {
        const e3 = r3[r3.length - 1];
        t3 = [...r3, ...Array(l3 - r3.length).fill(e3)];
      }
      e2.setColWidths(t3);
    }
  }
  function wn2(e2) {
    if (e2.detail < 3 || !isDOMNode(e2.target)) return false;
    const t2 = $getNearestNodeFromDOMNode(e2.target);
    if (null === t2) return false;
    const o2 = $findMatchingParent2(t2, (e3) => $isElementNode(e3) && !e3.isInline());
    if (null === o2) return false;
    return !!Ae2(o2.getParent()) && (o2.select(0), true);
  }
  function bn2(e2) {
    return e2.registerNodeTransform(Te2, (e3) => {
      if (e3.getColSpan() > 1 || e3.getRowSpan() > 1) {
        const [, , t2] = pt6(e3), [n2] = gt6(t2, e3, e3), o2 = n2.length, r3 = n2[0].length;
        let l3 = t2.getFirstChild();
        We2(l3) || ke2(175);
        const i3 = [];
        for (let e4 = 0; e4 < o2; e4++) {
          0 !== e4 && (l3 = l3.getNextSibling(), We2(l3) || ke2(175));
          let t3 = null;
          for (let o3 = 0; o3 < r3; o3++) {
            const r4 = n2[e4][o3], c3 = r4.cell;
            if (r4.startRow === e4 && r4.startColumn === o3) t3 = c3, i3.push(c3);
            else if (c3.getColSpan() > 1 || c3.getRowSpan() > 1) {
              Ae2(c3) || ke2(176);
              const e5 = Oe2(c3.__headerState);
              null !== t3 ? t3.insertAfter(e5) : $insertFirst(l3, e5);
            }
          }
        }
        for (const e4 of i3) e4.setColSpan(1), e4.setRowSpan(1);
      }
    });
  }
  function yn2(e2, t2 = true) {
    const n2 = /* @__PURE__ */ new Map(), o2 = (o3, r4, l3) => {
      const s4 = Ot5(o3, l3), i3 = $t4(o3, s4, e2, t2);
      n2.set(r4, [i3, s4]);
    }, r3 = e2.registerMutationListener(dn2, (t3) => {
      e2.getEditorState().read(() => {
        for (const [e3, r4] of t3) {
          const t4 = n2.get(e3);
          if ("created" === r4 || "updated" === r4) {
            const { tableNode: r5, tableElement: l3 } = xt6(e3);
            void 0 === t4 ? o2(r5, e3, l3) : l3 !== t4[1] && (t4[0].removeListeners(), n2.delete(e3), o2(r5, e3, l3));
          } else "destroyed" === r4 && void 0 !== t4 && (t4[0].removeListeners(), n2.delete(e3));
        }
      }, { editor: e2 });
    }, { skipInitialization: false });
    return () => {
      r3();
      for (const [, [e3]] of n2) e3.removeListeners();
    };
  }
  function Nn2(e2, t2) {
    e2.hasNodes([dn2]) || ke2(255);
    const { hasNestedTables: n2 = signal(false) } = t2 ?? {};
    return mergeRegister(e2.registerCommand(Ke2, (e3) => (function({ rows: e4, columns: t3, includeHeaders: n3 }, o2) {
      const r3 = $getSelection() || $getPreviousSelection();
      if (!r3 || !$isRangeSelection(r3)) return false;
      if (!o2 && Zt3(r3.anchor.getNode())) return false;
      const l3 = Be2(Number(e4), Number(t3), n3);
      $insertNodeToNearestRoot(l3);
      const s4 = l3.getFirstDescendant();
      return $isTextNode(s4) && s4.select(), true;
    })(e3, n2.peek()), COMMAND_PRIORITY_EDITOR), e2.registerCommand(SELECTION_INSERT_CLIPBOARD_NODES_COMMAND, ({ nodes: t3, selection: o2 }, r3) => {
      if (n2.peek() || e2 !== r3 || !$isRangeSelection(o2)) return false;
      return null !== Zt3(o2.anchor.getNode()) && t3.some(pn2);
    }, COMMAND_PRIORITY_EDITOR), e2.registerCommand(CLICK_COMMAND, wn2, COMMAND_PRIORITY_EDITOR), e2.registerNodeTransform(dn2, Sn2), e2.registerNodeTransform(Ee2, _n2), e2.registerNodeTransform(Te2, Cn2));
  }
  var vn2 = defineExtension({ build: (e2, t2, n2) => namedSignals(t2), config: safeCast({ hasCellBackgroundColor: true, hasCellMerge: true, hasHorizontalScroll: true, hasNestedTables: false, hasTabHandler: true }), name: "@lexical/table/Table", nodes: () => [dn2, Ee2, Te2], register(e2, t2, n2) {
    const o2 = n2.getOutput(), { hasNestedTables: r3 } = o2;
    return mergeRegister(effect(() => {
      const t3 = o2.hasHorizontalScroll.value;
      un2(e2) !== t3 && (hn2(e2, t3), e2.registerNodeTransform(dn2, () => {
      })());
    }), Nn2(e2, { hasNestedTables: r3 }), effect(() => yn2(e2, o2.hasTabHandler.value)), effect(() => o2.hasCellMerge.value ? void 0 : bn2(e2)), effect(() => o2.hasCellBackgroundColor.value ? void 0 : e2.registerNodeTransform(Te2, (e3) => {
      null !== e3.getBackgroundColor() && e3.setBackgroundColor(null);
    })));
  } });

  // node_modules/@lexical/table/LexicalTable.mjs
  var mod11 = false ? LexicalTable_dev_exports : LexicalTable_prod_exports;
  var $computeTableMap = mod11.$computeTableMap;
  var $computeTableMapSkipCellCheck = mod11.$computeTableMapSkipCellCheck;
  var $createTableCellNode = mod11.$createTableCellNode;
  var $createTableNode = mod11.$createTableNode;
  var $createTableNodeWithDimensions = mod11.$createTableNodeWithDimensions;
  var $createTableRowNode = mod11.$createTableRowNode;
  var $createTableSelection = mod11.$createTableSelection;
  var $createTableSelectionFrom = mod11.$createTableSelectionFrom;
  var $deleteTableColumn = mod11.$deleteTableColumn;
  var $deleteTableColumnAtSelection = mod11.$deleteTableColumnAtSelection;
  var $deleteTableColumn__EXPERIMENTAL = mod11.$deleteTableColumn__EXPERIMENTAL;
  var $deleteTableRowAtSelection = mod11.$deleteTableRowAtSelection;
  var $deleteTableRow__EXPERIMENTAL = mod11.$deleteTableRow__EXPERIMENTAL;
  var $findCellNode = mod11.$findCellNode;
  var $findTableNode = mod11.$findTableNode;
  var $getElementForTableNode = mod11.$getElementForTableNode;
  var $getNodeTriplet = mod11.$getNodeTriplet;
  var $getTableAndElementByKey = mod11.$getTableAndElementByKey;
  var $getTableCellNodeFromLexicalNode = mod11.$getTableCellNodeFromLexicalNode;
  var $getTableCellNodeRect = mod11.$getTableCellNodeRect;
  var $getTableColumnIndexFromTableCellNode = mod11.$getTableColumnIndexFromTableCellNode;
  var $getTableNodeFromLexicalNodeOrThrow = mod11.$getTableNodeFromLexicalNodeOrThrow;
  var $getTableRowIndexFromTableCellNode = mod11.$getTableRowIndexFromTableCellNode;
  var $getTableRowNodeFromTableCellNodeOrThrow = mod11.$getTableRowNodeFromTableCellNodeOrThrow;
  var $insertTableColumn = mod11.$insertTableColumn;
  var $insertTableColumnAtSelection = mod11.$insertTableColumnAtSelection;
  var $insertTableColumn__EXPERIMENTAL = mod11.$insertTableColumn__EXPERIMENTAL;
  var $insertTableRow = mod11.$insertTableRow;
  var $insertTableRowAtSelection = mod11.$insertTableRowAtSelection;
  var $insertTableRow__EXPERIMENTAL = mod11.$insertTableRow__EXPERIMENTAL;
  var $isScrollableTablesActive = mod11.$isScrollableTablesActive;
  var $isTableCellNode = mod11.$isTableCellNode;
  var $isTableNode = mod11.$isTableNode;
  var $isTableRowNode = mod11.$isTableRowNode;
  var $isTableSelection = mod11.$isTableSelection;
  var $mergeCells = mod11.$mergeCells;
  var $removeTableRowAtIndex = mod11.$removeTableRowAtIndex;
  var $unmergeCell = mod11.$unmergeCell;
  var INSERT_TABLE_COMMAND = mod11.INSERT_TABLE_COMMAND;
  var TableCellHeaderStates = mod11.TableCellHeaderStates;
  var TableCellNode = mod11.TableCellNode;
  var TableExtension = mod11.TableExtension;
  var TableNode = mod11.TableNode;
  var TableObserver = mod11.TableObserver;
  var TableRowNode = mod11.TableRowNode;
  var applyTableHandlers = mod11.applyTableHandlers;
  var getDOMCellFromTarget = mod11.getDOMCellFromTarget;
  var getTableElement = mod11.getTableElement;
  var getTableObserverFromTableElement = mod11.getTableObserverFromTableElement;
  var registerTableCellUnmergeTransform = mod11.registerTableCellUnmergeTransform;
  var registerTablePlugin = mod11.registerTablePlugin;
  var registerTableSelectionObserver = mod11.registerTableSelectionObserver;
  var setScrollableTablesActive = mod11.setScrollableTablesActive;

  // node_modules/@lexical/link/LexicalLink.prod.mjs
  var LexicalLink_prod_exports = {};
  __export(LexicalLink_prod_exports, {
    $createAutoLinkNode: () => I4,
    $createLinkNode: () => D5,
    $isAutoLinkNode: () => E5,
    $isLinkNode: () => w4,
    $toggleLink: () => J7,
    AutoLinkExtension: () => st6,
    AutoLinkNode: () => A4,
    ClickableLinkExtension: () => $5,
    LinkExtension: () => B5,
    LinkNode: () => y3,
    TOGGLE_LINK_COMMAND: () => P4,
    createLinkMatcherWithRegExp: () => H7,
    formatUrl: () => W6,
    registerAutoLink: () => lt6,
    registerClickableLink: () => z5,
    registerLink: () => F6,
    toggleLink: () => ot6
  });
  var R5 = /* @__PURE__ */ new Set(["http:", "https:", "mailto:", "sms:", "tel:"]);
  var y3 = class _y extends ElementNode {
    __url;
    __target;
    __rel;
    __title;
    static getType() {
      return "link";
    }
    static clone(t2) {
      return new _y(t2.__url, { rel: t2.__rel, target: t2.__target, title: t2.__title }, t2.__key);
    }
    constructor(t2 = "", e2 = {}, n2) {
      super(n2);
      const { target: r3 = null, rel: i3 = null, title: l3 = null } = e2;
      this.__url = t2, this.__target = r3, this.__rel = i3, this.__title = l3;
    }
    createDOM(e2) {
      const n2 = document.createElement("a");
      return this.updateLinkDOM(null, n2, e2), addClassNamesToElement(n2, e2.theme.link), n2;
    }
    updateLinkDOM(t2, n2, r3) {
      if (isHTMLAnchorElement2(n2)) {
        t2 && t2.__url === this.__url || (n2.href = this.sanitizeUrl(this.__url));
        for (const e2 of ["target", "rel", "title"]) {
          const r4 = `__${e2}`, i3 = this[r4];
          t2 && t2[r4] === i3 || (i3 ? n2[e2] = i3 : n2.removeAttribute(e2));
        }
      }
    }
    updateDOM(t2, e2, n2) {
      return this.updateLinkDOM(t2, e2, n2), false;
    }
    static importDOM() {
      return { a: (t2) => ({ conversion: N3, priority: 1 }) };
    }
    static importJSON(t2) {
      return D5().updateFromJSON(t2);
    }
    updateFromJSON(t2) {
      return super.updateFromJSON(t2).setURL(t2.url).setRel(t2.rel || null).setTarget(t2.target || null).setTitle(t2.title || null);
    }
    sanitizeUrl(t2) {
      t2 = W6(t2);
      try {
        const e2 = new URL(W6(t2));
        if (!R5.has(e2.protocol)) return "about:blank";
      } catch (e2) {
        return t2;
      }
      return t2;
    }
    exportJSON() {
      return { ...super.exportJSON(), rel: this.getRel(), target: this.getTarget(), title: this.getTitle(), url: this.getURL() };
    }
    getURL() {
      return this.getLatest().__url;
    }
    setURL(t2) {
      const e2 = this.getWritable();
      return e2.__url = t2, e2;
    }
    getTarget() {
      return this.getLatest().__target;
    }
    setTarget(t2) {
      const e2 = this.getWritable();
      return e2.__target = t2, e2;
    }
    getRel() {
      return this.getLatest().__rel;
    }
    setRel(t2) {
      const e2 = this.getWritable();
      return e2.__rel = t2, e2;
    }
    getTitle() {
      return this.getLatest().__title;
    }
    setTitle(t2) {
      const e2 = this.getWritable();
      return e2.__title = t2, e2;
    }
    insertNewAfter(t2, e2 = true) {
      const n2 = D5(this.__url, { rel: this.__rel, target: this.__target, title: this.__title });
      return this.insertAfter(n2, e2), n2;
    }
    canInsertTextBefore() {
      return false;
    }
    canInsertTextAfter() {
      return false;
    }
    canBeEmpty() {
      return false;
    }
    isInline() {
      return true;
    }
    extractWithChild(t2, e2, n2) {
      if (!$isRangeSelection(e2)) return false;
      const r3 = e2.anchor.getNode(), i3 = e2.focus.getNode();
      return this.isParentOf(r3) && this.isParentOf(i3) && e2.getTextContent().length > 0;
    }
    isEmailURI() {
      return this.__url.startsWith("mailto:");
    }
    isWebSiteURI() {
      return this.__url.startsWith("https://") || this.__url.startsWith("http://");
    }
  };
  function N3(t2) {
    let n2 = null;
    if (isHTMLAnchorElement2(t2)) {
      const e2 = t2.textContent;
      (null !== e2 && "" !== e2 || t2.children.length > 0) && (n2 = D5(t2.getAttribute("href") || "", { rel: t2.getAttribute("rel"), target: t2.getAttribute("target"), title: t2.getAttribute("title") }));
    }
    return { node: n2 };
  }
  function D5(t2 = "", e2) {
    return $applyNodeReplacement(new y3(t2, e2));
  }
  function w4(t2) {
    return t2 instanceof y3;
  }
  var A4 = class _A extends y3 {
    __isUnlinked;
    constructor(t2 = "", e2 = {}, n2) {
      super(t2, e2, n2), this.__isUnlinked = void 0 !== e2.isUnlinked && null !== e2.isUnlinked && e2.isUnlinked;
    }
    static getType() {
      return "autolink";
    }
    static clone(t2) {
      return new _A(t2.__url, { isUnlinked: t2.__isUnlinked, rel: t2.__rel, target: t2.__target, title: t2.__title }, t2.__key);
    }
    getIsUnlinked() {
      return this.__isUnlinked;
    }
    setIsUnlinked(t2) {
      const e2 = this.getWritable();
      return e2.__isUnlinked = t2, e2;
    }
    createDOM(t2) {
      return this.__isUnlinked ? document.createElement("span") : super.createDOM(t2);
    }
    updateDOM(t2, e2, n2) {
      return super.updateDOM(t2, e2, n2) || t2.__isUnlinked !== this.__isUnlinked;
    }
    static importJSON(t2) {
      return I4().updateFromJSON(t2);
    }
    updateFromJSON(t2) {
      return super.updateFromJSON(t2).setIsUnlinked(t2.isUnlinked || false);
    }
    static importDOM() {
      return null;
    }
    exportJSON() {
      return { ...super.exportJSON(), isUnlinked: this.__isUnlinked };
    }
    insertNewAfter(t2, e2 = true) {
      const n2 = this.getParentOrThrow().insertNewAfter(t2, e2);
      if ($isElementNode(n2)) {
        const t3 = I4(this.__url, { isUnlinked: this.__isUnlinked, rel: this.__rel, target: this.__target, title: this.__title });
        return n2.append(t3), t3;
      }
      return null;
    }
  };
  function I4(t2 = "", e2) {
    return $applyNodeReplacement(new A4(t2, e2));
  }
  function E5(t2) {
    return t2 instanceof A4;
  }
  var P4 = createCommand("TOGGLE_LINK_COMMAND");
  function M4(t2, e2) {
    if ("element" === t2.type) {
      const n2 = t2.getNode();
      $isElementNode(n2) || (function(t3, ...e3) {
        const n3 = new URL("https://lexical.dev/docs/error"), r3 = new URLSearchParams();
        r3.append("code", t3);
        for (const t4 of e3) r3.append("v", t4);
        throw n3.search = r3.toString(), Error(`Minified Lexical error #${t3}; visit ${n3.toString()} for the full message or use the non-minified dev environment for full errors and additional helpful warnings.`);
      })(252);
      return n2.getChildren()[t2.offset + e2] || null;
    }
    return null;
  }
  function J7(t2, e2 = {}) {
    let r3;
    if (t2 && "object" == typeof t2) {
      const { url: n2, ...i4 } = t2;
      r3 = n2, e2 = { ...i4, ...e2 };
    } else r3 = t2;
    const { target: i3, title: l3 } = e2, s4 = void 0 === e2.rel ? "noreferrer" : e2.rel, u3 = $getSelection();
    if (null === u3 || !$isRangeSelection(u3) && !$isNodeSelection(u3)) return;
    if ($isNodeSelection(u3)) {
      const t3 = u3.getNodes();
      if (0 === t3.length) return;
      return void t3.forEach((t4) => {
        if (null === r3) {
          const e3 = $findMatchingParent2(t4, (t5) => !E5(t5) && w4(t5));
          e3 && (e3.insertBefore(t4), 0 === e3.getChildren().length && e3.remove());
        } else {
          const e3 = $findMatchingParent2(t4, (t5) => !E5(t5) && w4(t5));
          if (e3) e3.setURL(r3), void 0 !== i3 && e3.setTarget(i3), void 0 !== s4 && e3.setRel(s4);
          else {
            const e4 = D5(r3, { rel: s4, target: i3 });
            t4.insertBefore(e4), e4.append(t4);
          }
        }
      });
    }
    const h2 = u3.extract();
    if (null === r3) {
      const t3 = /* @__PURE__ */ new Set();
      return void h2.forEach((e3) => {
        const n2 = e3.getParent();
        if (w4(n2) && !E5(n2)) {
          const e4 = n2.getKey();
          if (t3.has(e4)) return;
          !(function(t4, e5) {
            const n3 = new Set(e5.filter((e6) => t4.isParentOf(e6)).map((t5) => t5.getKey())), r4 = t4.getChildren(), i4 = r4.filter((t5) => n3.has(t5.getKey()));
            if (i4.length === r4.length) return r4.forEach((e6) => t4.insertBefore(e6)), void t4.remove();
            const l4 = r4.findIndex((t5) => n3.has(t5.getKey())), s5 = r4.findLastIndex((t5) => n3.has(t5.getKey())), o2 = 0 === l4, u4 = s5 === r4.length - 1;
            if (o2) i4.forEach((e6) => t4.insertBefore(e6));
            else if (u4) for (let e6 = i4.length - 1; e6 >= 0; e6--) t4.insertAfter(i4[e6]);
            else {
              for (let e7 = i4.length - 1; e7 >= 0; e7--) t4.insertAfter(i4[e7]);
              const e6 = r4.slice(s5 + 1);
              if (e6.length > 0) {
                const n4 = D5(t4.getURL(), { rel: t4.getRel(), target: t4.getTarget(), title: t4.getTitle() });
                i4[i4.length - 1].insertAfter(n4), e6.forEach((t5) => n4.append(t5));
              }
            }
          })(n2, h2), t3.add(e4);
        }
      });
    }
    const p3 = /* @__PURE__ */ new Set(), _5 = (t3) => {
      p3.has(t3.getKey()) || (p3.add(t3.getKey()), t3.setURL(r3), void 0 !== i3 && t3.setTarget(i3), void 0 !== s4 && t3.setRel(s4), void 0 !== l3 && t3.setTitle(l3));
    };
    if (1 === h2.length) {
      const t3 = h2[0], e3 = $findMatchingParent2(t3, w4);
      if (null !== e3) return _5(e3);
    }
    !(function(t3) {
      const e3 = $getSelection();
      if (!$isRangeSelection(e3)) return t3();
      const n2 = $normalizeSelection__EXPERIMENTAL(e3), r4 = n2.isBackward(), i4 = M4(n2.anchor, r4 ? -1 : 0), l4 = M4(n2.focus, r4 ? 0 : -1), s5 = t3();
      if (i4 || l4) {
        const t4 = $getSelection();
        if ($isRangeSelection(t4)) {
          const e4 = t4.clone();
          if (i4) {
            const t5 = i4.getParent();
            t5 && e4.anchor.set(t5.getKey(), i4.getIndexWithinParent() + (r4 ? 1 : 0), "element");
          }
          if (l4) {
            const t5 = l4.getParent();
            t5 && e4.focus.set(t5.getKey(), l4.getIndexWithinParent() + (r4 ? 0 : 1), "element");
          }
          $setSelection($normalizeSelection__EXPERIMENTAL(e4));
        }
      }
    })(() => {
      let t3 = null;
      for (const e3 of h2) {
        if (!e3.isAttached()) continue;
        const o2 = $findMatchingParent2(e3, w4);
        if (o2) {
          _5(o2);
          continue;
        }
        if ($isElementNode(e3)) {
          if (!e3.isInline()) continue;
          if (w4(e3)) {
            if (!(E5(e3) || null !== t3 && t3.getParentOrThrow().isParentOf(e3))) {
              _5(e3), t3 = e3;
              continue;
            }
            for (const t4 of e3.getChildren()) e3.insertBefore(t4);
            e3.remove();
            continue;
          }
        }
        const u4 = e3.getPreviousSibling();
        w4(u4) && u4.is(t3) ? u4.append(e3) : (t3 = D5(r3, { rel: s4, target: i3, title: l3 }), e3.insertAfter(t3), t3.append(e3));
      }
    });
  }
  var K5 = /^\+?[0-9\s()-]{5,}$/;
  function W6(t2) {
    return t2.match(/^[a-z][a-z0-9+.-]*:/i) || t2.match(/^[/#.]/) ? t2 : t2.includes("@") ? `mailto:${t2}` : K5.test(t2) ? `tel:${t2}` : `https://${t2}`;
  }
  function F6(t2, e2) {
    return mergeRegister(effect(() => t2.registerCommand(P4, (t3) => {
      const n2 = e2.validateUrl.peek(), r3 = e2.attributes.peek();
      if (null === t3) return J7(null), true;
      if ("string" == typeof t3) return !(void 0 !== n2 && !n2(t3)) && (J7(t3, r3), true);
      {
        const { url: e3, target: n3, rel: i3, title: l3 } = t3;
        return J7(e3, { ...r3, rel: i3, target: n3, title: l3 }), true;
      }
    }, COMMAND_PRIORITY_LOW)), effect(() => {
      const n2 = e2.validateUrl.value;
      if (!n2) return;
      const r3 = e2.attributes.value;
      return t2.registerCommand(PASTE_COMMAND, (e3) => {
        const l3 = $getSelection();
        if (!$isRangeSelection(l3) || l3.isCollapsed() || !objectKlassEquals(e3, ClipboardEvent)) return false;
        if (null === e3.clipboardData) return false;
        const s4 = e3.clipboardData.getData("text");
        return !!n2(s4) && (!l3.getNodes().some((t3) => $isElementNode(t3)) && (t2.dispatchCommand(P4, { ...r3, url: s4 }), e3.preventDefault(), true));
      }, COMMAND_PRIORITY_LOW);
    }));
  }
  var B5 = defineExtension({ build: (t2, e2, n2) => namedSignals(e2), config: { attributes: void 0, validateUrl: void 0 }, mergeConfig(t2, e2) {
    const n2 = shallowMergeConfig(t2, e2);
    return t2.attributes && (n2.attributes = shallowMergeConfig(t2.attributes, n2.attributes)), n2;
  }, name: "@lexical/link/Link", nodes: () => [y3], register: (t2, e2, n2) => F6(t2, n2.getOutput()) });
  function z5(t2, r3, i3 = {}) {
    const l3 = (i4) => {
      const l4 = i4.target;
      if (!isDOMNode(l4)) return;
      const s5 = getNearestEditorFromDOMNode(l4);
      if (null === s5) return;
      let u3 = null, g3 = null;
      if (s5.update(() => {
        const t3 = $getNearestNodeFromDOMNode(l4);
        if (null !== t3) {
          const i5 = $findMatchingParent2(t3, $isElementNode);
          if (!r3.disabled.peek()) if (w4(i5)) u3 = i5.sanitizeUrl(i5.getURL()), g3 = i5.getTarget();
          else {
            const t4 = (function(t5, e2) {
              let n2 = t5;
              for (; null != n2; ) {
                if (e2(n2)) return n2;
                n2 = n2.parentNode;
              }
              return null;
            })(l4, isHTMLAnchorElement2);
            null !== t4 && (u3 = t4.href, g3 = t4.target);
          }
        }
      }), null === u3 || "" === u3) return;
      const f3 = t2.getEditorState().read($getSelection);
      if ($isRangeSelection(f3) && !f3.isCollapsed()) return void i4.preventDefault();
      const d4 = "auxclick" === i4.type && 1 === i4.button;
      window.open(u3, r3.newTab.peek() || d4 || i4.metaKey || i4.ctrlKey || "_blank" === g3 ? "_blank" : "_self"), i4.preventDefault();
    }, s4 = (t3) => {
      1 === t3.button && l3(t3);
    };
    return t2.registerRootListener((t3, e2) => {
      null !== e2 && (e2.removeEventListener("click", l3), e2.removeEventListener("mouseup", s4)), null !== t3 && (t3.addEventListener("click", l3, i3), t3.addEventListener("mouseup", s4, i3));
    });
  }
  var $5 = defineExtension({ build: (t2, e2, n2) => namedSignals(e2), config: safeCast({ disabled: false, newTab: false }), dependencies: [B5], name: "@lexical/link/ClickableLink", register: (t2, e2, n2) => z5(t2, n2.getOutput()) });
  function H7(t2, e2 = (t3) => t3) {
    return (n2) => {
      const r3 = t2.exec(n2);
      return null === r3 ? null : { index: r3.index, length: r3[0].length, text: r3[0], url: e2(r3[0]) };
    };
  }
  function j5(t2, e2) {
    for (let n2 = 0; n2 < e2.length; n2++) {
      const r3 = e2[n2](t2);
      if (r3) return r3;
    }
    return null;
  }
  var G6 = /[.,;\s]/;
  function Z6(t2) {
    return G6.test(t2);
  }
  function q6(t2) {
    return Z6(t2[t2.length - 1]);
  }
  function Q6(t2) {
    return Z6(t2[0]);
  }
  function V6(t2) {
    let e2 = t2.getPreviousSibling();
    return $isElementNode(e2) && (e2 = e2.getLastDescendant()), null === e2 || $isLineBreakNode(e2) || $isTextNode(e2) && q6(e2.getTextContent());
  }
  function X6(t2) {
    let e2 = t2.getNextSibling();
    return $isElementNode(e2) && (e2 = e2.getFirstDescendant()), null === e2 || $isLineBreakNode(e2) || $isTextNode(e2) && Q6(e2.getTextContent());
  }
  function Y6(t2, e2, n2, r3) {
    if (!(t2 > 0 ? Z6(n2[t2 - 1]) : V6(r3[0]))) return false;
    return e2 < n2.length ? Z6(n2[e2]) : X6(r3[r3.length - 1]);
  }
  function tt6(t2, e2, n2) {
    const r3 = [], i3 = [], l3 = [];
    let s4 = 0, o2 = 0;
    const u3 = [...t2];
    for (; u3.length > 0; ) {
      const t3 = u3[0], a3 = t3.getTextContent().length, c3 = o2;
      o2 + a3 <= e2 ? (r3.push(t3), s4 += a3) : c3 >= n2 ? l3.push(t3) : i3.push(t3), o2 += a3, u3.shift();
    }
    return [s4, r3, i3, l3];
  }
  function et6(t2, e2, n2, r3) {
    const i3 = I4(r3.url, r3.attributes);
    if (1 === t2.length) {
      let l3, s4 = t2[0];
      0 === e2 ? [l3, s4] = s4.splitText(n2) : [, l3, s4] = s4.splitText(e2, n2);
      const o2 = $createTextNode(r3.text);
      return o2.setFormat(l3.getFormat()), o2.setDetail(l3.getDetail()), o2.setStyle(l3.getStyle()), i3.append(o2), l3.replace(i3), s4;
    }
    if (t2.length > 1) {
      const r4 = t2[0];
      let l3, s4 = r4.getTextContent().length;
      0 === e2 ? l3 = r4 : [, l3] = r4.splitText(e2);
      const u3 = [];
      let a3;
      for (let e3 = 1; e3 < t2.length; e3++) {
        const r5 = t2[e3], i4 = r5.getTextContent().length, l4 = s4;
        if (l4 < n2) if (s4 + i4 <= n2) u3.push(r5);
        else {
          const [t3, e4] = r5.splitText(n2 - l4);
          u3.push(t3), a3 = e4;
        }
        s4 += i4;
      }
      const f3 = $getSelection(), d4 = f3 ? f3.getNodes().find($isTextNode) : void 0, h2 = $createTextNode(l3.getTextContent());
      return h2.setFormat(l3.getFormat()), h2.setDetail(l3.getDetail()), h2.setStyle(l3.getStyle()), i3.append(h2, ...u3), d4 && d4 === l3 && ($isRangeSelection(f3) ? h2.select(f3.anchor.offset, f3.focus.offset) : $isNodeSelection(f3) && h2.select(0, h2.getTextContent().length)), l3.replace(i3), a3;
    }
  }
  function nt6(t2, e2, n2) {
    const r3 = t2.getChildren(), i3 = r3.length;
    for (let e3 = 0; e3 < i3; e3++) {
      const i4 = r3[e3];
      if (!$isTextNode(i4) || !i4.isSimpleText()) return rt6(t2), void n2(null, t2.getURL());
    }
    const l3 = t2.getTextContent(), s4 = j5(l3, e2);
    if (null === s4 || s4.text !== l3) return rt6(t2), void n2(null, t2.getURL());
    if (!V6(t2) || !X6(t2)) return rt6(t2), void n2(null, t2.getURL());
    const o2 = t2.getURL();
    if (o2 !== s4.url && (t2.setURL(s4.url), n2(s4.url, o2)), s4.attributes) {
      const e3 = t2.getRel();
      e3 !== s4.attributes.rel && (t2.setRel(s4.attributes.rel || null), n2(s4.attributes.rel || null, e3));
      const r4 = t2.getTarget();
      r4 !== s4.attributes.target && (t2.setTarget(s4.attributes.target || null), n2(s4.attributes.target || null, r4));
    }
  }
  function rt6(t2) {
    const e2 = t2.getChildren();
    for (let n2 = e2.length - 1; n2 >= 0; n2--) t2.insertAfter(e2[n2]);
    return t2.remove(), e2.map((t3) => t3.getLatest());
  }
  var it6 = { changeHandlers: [], matchers: [] };
  function lt6(t2, e2 = it6) {
    const { matchers: n2, changeHandlers: i3 } = e2, l3 = (t3, e3) => {
      for (const n3 of i3) n3(t3, e3);
    };
    return mergeRegister(t2.registerNodeTransform(TextNode, (t3) => {
      const e3 = t3.getParentOrThrow(), r3 = t3.getPreviousSibling();
      if (E5(e3) && !e3.getIsUnlinked()) nt6(e3, n2, l3);
      else if (!w4(e3)) {
        if (t3.isSimpleText() && (Q6(t3.getTextContent()) || !E5(r3))) {
          const e4 = (function(t4) {
            const e5 = [t4];
            let n3 = t4.getNextSibling();
            for (; null !== n3 && $isTextNode(n3) && n3.isSimpleText() && (e5.push(n3), !/[\s]/.test(n3.getTextContent())); ) n3 = n3.getNextSibling();
            return e5;
          })(t3);
          !(function(t4, e5, n3) {
            let r4 = [...t4];
            const i4 = r4.map((t5) => t5.getTextContent()).join("");
            let l4, s4 = i4, o2 = 0;
            for (; (l4 = j5(s4, e5)) && null !== l4; ) {
              const t5 = l4.index, e6 = t5 + l4.length;
              if (Y6(o2 + t5, o2 + e6, i4, r4)) {
                const [i5, , s5, u3] = tt6(r4, o2 + t5, o2 + e6), a3 = et6(s5, o2 + t5 - i5, o2 + e6 - i5, l4);
                r4 = a3 ? [a3, ...u3] : u3, n3(l4.url, null), o2 = 0;
              } else o2 += e6;
              s4 = s4.substring(e6);
            }
          })(e4, n2, l3);
        }
        !(function(t4, e4, n3) {
          const r4 = t4.getPreviousSibling(), i4 = t4.getNextSibling(), l4 = t4.getTextContent();
          var s4;
          !E5(r4) || r4.getIsUnlinked() || Q6(l4) && (s4 = l4, !(r4.isEmailURI() ? /^\.[a-zA-Z]{2,}/.test(s4) : /^\.[a-zA-Z0-9]{1,}/.test(s4))) || (r4.append(t4), nt6(r4, e4, n3), n3(null, r4.getURL())), !E5(i4) || i4.getIsUnlinked() || q6(l4) || (rt6(i4), nt6(i4, e4, n3), n3(null, i4.getURL()));
        })(t3, n2, l3);
      }
    }), t2.registerCommand(P4, (t3) => {
      const e3 = $getSelection();
      if (null !== t3 || !$isRangeSelection(e3)) return false;
      return e3.extract().forEach((t4) => {
        const e4 = t4.getParent();
        E5(e4) && (e4.setIsUnlinked(!e4.getIsUnlinked()), e4.markDirty());
      }), false;
    }, COMMAND_PRIORITY_LOW));
  }
  var st6 = defineExtension({ config: it6, dependencies: [B5], mergeConfig(t2, e2) {
    const n2 = shallowMergeConfig(t2, e2);
    for (const r3 of ["matchers", "changeHandlers"]) {
      const i3 = e2[r3];
      Array.isArray(i3) && (n2[r3] = [...t2[r3], ...i3]);
    }
    return n2;
  }, name: "@lexical/link/AutoLink", register: lt6 });
  var ot6 = J7;

  // node_modules/@lexical/link/LexicalLink.mjs
  var mod12 = false ? LexicalLink_dev_exports : LexicalLink_prod_exports;
  var $createAutoLinkNode = mod12.$createAutoLinkNode;
  var $createLinkNode = mod12.$createLinkNode;
  var $isAutoLinkNode = mod12.$isAutoLinkNode;
  var $isLinkNode = mod12.$isLinkNode;
  var $toggleLink = mod12.$toggleLink;
  var AutoLinkExtension = mod12.AutoLinkExtension;
  var AutoLinkNode = mod12.AutoLinkNode;
  var ClickableLinkExtension = mod12.ClickableLinkExtension;
  var LinkExtension = mod12.LinkExtension;
  var LinkNode = mod12.LinkNode;
  var TOGGLE_LINK_COMMAND = mod12.TOGGLE_LINK_COMMAND;
  var createLinkMatcherWithRegExp = mod12.createLinkMatcherWithRegExp;
  var formatUrl = mod12.formatUrl;
  var registerAutoLink = mod12.registerAutoLink;
  var registerClickableLink = mod12.registerClickableLink;
  var registerLink = mod12.registerLink;
  var toggleLink = mod12.toggleLink;

  // node_modules/@lexical/code/LexicalCode.dev.mjs
  var import_prismjs = __toESM(require_prism(), 1);

  // node_modules/prismjs/components/prism-clike.js
  Prism.languages.clike = {
    "comment": [
      {
        pattern: /(^|[^\\])\/\*[\s\S]*?(?:\*\/|$)/,
        lookbehind: true,
        greedy: true
      },
      {
        pattern: /(^|[^\\:])\/\/.*/,
        lookbehind: true,
        greedy: true
      }
    ],
    "string": {
      pattern: /(["'])(?:\\(?:\r\n|[\s\S])|(?!\1)[^\\\r\n])*\1/,
      greedy: true
    },
    "class-name": {
      pattern: /(\b(?:class|extends|implements|instanceof|interface|new|trait)\s+|\bcatch\s+\()[\w.\\]+/i,
      lookbehind: true,
      inside: {
        "punctuation": /[.\\]/
      }
    },
    "keyword": /\b(?:break|catch|continue|do|else|finally|for|function|if|in|instanceof|new|null|return|throw|try|while)\b/,
    "boolean": /\b(?:false|true)\b/,
    "function": /\b\w+(?=\()/,
    "number": /\b0x[\da-f]+\b|(?:\b\d+(?:\.\d*)?|\B\.\d+)(?:e[+-]?\d+)?/i,
    "operator": /[<>]=?|[!=]=?=?|--?|\+\+?|&&?|\|\|?|[?*/~^%]/,
    "punctuation": /[{}[\];(),.:]/
  };

  // node_modules/prismjs/components/prism-javascript.js
  Prism.languages.javascript = Prism.languages.extend("clike", {
    "class-name": [
      Prism.languages.clike["class-name"],
      {
        pattern: /(^|[^$\w\xA0-\uFFFF])(?!\s)[_$A-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*(?=\.(?:constructor|prototype))/,
        lookbehind: true
      }
    ],
    "keyword": [
      {
        pattern: /((?:^|\})\s*)catch\b/,
        lookbehind: true
      },
      {
        pattern: /(^|[^.]|\.\.\.\s*)\b(?:as|assert(?=\s*\{)|async(?=\s*(?:function\b|\(|[$\w\xA0-\uFFFF]|$))|await|break|case|class|const|continue|debugger|default|delete|do|else|enum|export|extends|finally(?=\s*(?:\{|$))|for|from(?=\s*(?:['"]|$))|function|(?:get|set)(?=\s*(?:[#\[$\w\xA0-\uFFFF]|$))|if|implements|import|in|instanceof|interface|let|new|null|of|package|private|protected|public|return|static|super|switch|this|throw|try|typeof|undefined|var|void|while|with|yield)\b/,
        lookbehind: true
      }
    ],
    // Allow for all non-ASCII characters (See http://stackoverflow.com/a/2008444)
    "function": /#?(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*(?=\s*(?:\.\s*(?:apply|bind|call)\s*)?\()/,
    "number": {
      pattern: RegExp(
        /(^|[^\w$])/.source + "(?:" + // constant
        (/NaN|Infinity/.source + "|" + // binary integer
        /0[bB][01]+(?:_[01]+)*n?/.source + "|" + // octal integer
        /0[oO][0-7]+(?:_[0-7]+)*n?/.source + "|" + // hexadecimal integer
        /0[xX][\dA-Fa-f]+(?:_[\dA-Fa-f]+)*n?/.source + "|" + // decimal bigint
        /\d+(?:_\d+)*n/.source + "|" + // decimal number (integer or float) but no bigint
        /(?:\d+(?:_\d+)*(?:\.(?:\d+(?:_\d+)*)?)?|\.\d+(?:_\d+)*)(?:[Ee][+-]?\d+(?:_\d+)*)?/.source) + ")" + /(?![\w$])/.source
      ),
      lookbehind: true
    },
    "operator": /--|\+\+|\*\*=?|=>|&&=?|\|\|=?|[!=]==|<<=?|>>>?=?|[-+*/%&|^!=<>]=?|\.{3}|\?\?=?|\?\.?|[~:]/
  });
  Prism.languages.javascript["class-name"][0].pattern = /(\b(?:class|extends|implements|instanceof|interface|new)\s+)[\w.\\]+/;
  Prism.languages.insertBefore("javascript", "keyword", {
    "regex": {
      pattern: RegExp(
        // lookbehind
        // eslint-disable-next-line regexp/no-dupe-characters-character-class
        /((?:^|[^$\w\xA0-\uFFFF."'\])\s]|\b(?:return|yield))\s*)/.source + // Regex pattern:
        // There are 2 regex patterns here. The RegExp set notation proposal added support for nested character
        // classes if the `v` flag is present. Unfortunately, nested CCs are both context-free and incompatible
        // with the only syntax, so we have to define 2 different regex patterns.
        /\//.source + "(?:" + /(?:\[(?:[^\]\\\r\n]|\\.)*\]|\\.|[^/\\\[\r\n])+\/[dgimyus]{0,7}/.source + "|" + // `v` flag syntax. This supports 3 levels of nested character classes.
        /(?:\[(?:[^[\]\\\r\n]|\\.|\[(?:[^[\]\\\r\n]|\\.|\[(?:[^[\]\\\r\n]|\\.)*\])*\])*\]|\\.|[^/\\\[\r\n])+\/[dgimyus]{0,7}v[dgimyus]{0,7}/.source + ")" + // lookahead
        /(?=(?:\s|\/\*(?:[^*]|\*(?!\/))*\*\/)*(?:$|[\r\n,.;:})\]]|\/\/))/.source
      ),
      lookbehind: true,
      greedy: true,
      inside: {
        "regex-source": {
          pattern: /^(\/)[\s\S]+(?=\/[a-z]*$)/,
          lookbehind: true,
          alias: "language-regex",
          inside: Prism.languages.regex
        },
        "regex-delimiter": /^\/|\/$/,
        "regex-flags": /^[a-z]+$/
      }
    },
    // This must be declared before keyword because we use "function" inside the look-forward
    "function-variable": {
      pattern: /#?(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*(?=\s*[=:]\s*(?:async\s*)?(?:\bfunction\b|(?:\((?:[^()]|\([^()]*\))*\)|(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*)\s*=>))/,
      alias: "function"
    },
    "parameter": [
      {
        pattern: /(function(?:\s+(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*)?\s*\(\s*)(?!\s)(?:[^()\s]|\s+(?![\s)])|\([^()]*\))+(?=\s*\))/,
        lookbehind: true,
        inside: Prism.languages.javascript
      },
      {
        pattern: /(^|[^$\w\xA0-\uFFFF])(?!\s)[_$a-z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*(?=\s*=>)/i,
        lookbehind: true,
        inside: Prism.languages.javascript
      },
      {
        pattern: /(\(\s*)(?!\s)(?:[^()\s]|\s+(?![\s)])|\([^()]*\))+(?=\s*\)\s*=>)/,
        lookbehind: true,
        inside: Prism.languages.javascript
      },
      {
        pattern: /((?:\b|\s|^)(?!(?:as|async|await|break|case|catch|class|const|continue|debugger|default|delete|do|else|enum|export|extends|finally|for|from|function|get|if|implements|import|in|instanceof|interface|let|new|null|of|package|private|protected|public|return|set|static|super|switch|this|throw|try|typeof|undefined|var|void|while|with|yield)(?![$\w\xA0-\uFFFF]))(?:(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*\s*)\(\s*|\]\s*\(\s*)(?!\s)(?:[^()\s]|\s+(?![\s)])|\([^()]*\))+(?=\s*\)\s*\{)/,
        lookbehind: true,
        inside: Prism.languages.javascript
      }
    ],
    "constant": /\b[A-Z](?:[A-Z_]|\dx?)*\b/
  });
  Prism.languages.insertBefore("javascript", "string", {
    "hashbang": {
      pattern: /^#!.*/,
      greedy: true,
      alias: "comment"
    },
    "template-string": {
      pattern: /`(?:\\[\s\S]|\$\{(?:[^{}]|\{(?:[^{}]|\{[^}]*\})*\})+\}|(?!\$\{)[^\\`])*`/,
      greedy: true,
      inside: {
        "template-punctuation": {
          pattern: /^`|`$/,
          alias: "string"
        },
        "interpolation": {
          pattern: /((?:^|[^\\])(?:\\{2})*)\$\{(?:[^{}]|\{(?:[^{}]|\{[^}]*\})*\})+\}/,
          lookbehind: true,
          inside: {
            "interpolation-punctuation": {
              pattern: /^\$\{|\}$/,
              alias: "punctuation"
            },
            rest: Prism.languages.javascript
          }
        },
        "string": /[\s\S]+/
      }
    },
    "string-property": {
      pattern: /((?:^|[,{])[ \t]*)(["'])(?:\\(?:\r\n|[\s\S])|(?!\2)[^\\\r\n])*\2(?=\s*:)/m,
      lookbehind: true,
      greedy: true,
      alias: "property"
    }
  });
  Prism.languages.insertBefore("javascript", "operator", {
    "literal-property": {
      pattern: /((?:^|[,{])[ \t]*)(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*(?=\s*:)/m,
      lookbehind: true,
      alias: "property"
    }
  });
  if (Prism.languages.markup) {
    Prism.languages.markup.tag.addInlined("script", "javascript");
    Prism.languages.markup.tag.addAttribute(
      /on(?:abort|blur|change|click|composition(?:end|start|update)|dblclick|error|focus(?:in|out)?|key(?:down|up)|load|mouse(?:down|enter|leave|move|out|over|up)|reset|resize|scroll|select|slotchange|submit|unload|wheel)/.source,
      "javascript"
    );
  }
  Prism.languages.js = Prism.languages.javascript;

  // node_modules/prismjs/components/prism-markup.js
  Prism.languages.markup = {
    "comment": {
      pattern: /<!--(?:(?!<!--)[\s\S])*?-->/,
      greedy: true
    },
    "prolog": {
      pattern: /<\?[\s\S]+?\?>/,
      greedy: true
    },
    "doctype": {
      // https://www.w3.org/TR/xml/#NT-doctypedecl
      pattern: /<!DOCTYPE(?:[^>"'[\]]|"[^"]*"|'[^']*')+(?:\[(?:[^<"'\]]|"[^"]*"|'[^']*'|<(?!!--)|<!--(?:[^-]|-(?!->))*-->)*\]\s*)?>/i,
      greedy: true,
      inside: {
        "internal-subset": {
          pattern: /(^[^\[]*\[)[\s\S]+(?=\]>$)/,
          lookbehind: true,
          greedy: true,
          inside: null
          // see below
        },
        "string": {
          pattern: /"[^"]*"|'[^']*'/,
          greedy: true
        },
        "punctuation": /^<!|>$|[[\]]/,
        "doctype-tag": /^DOCTYPE/i,
        "name": /[^\s<>'"]+/
      }
    },
    "cdata": {
      pattern: /<!\[CDATA\[[\s\S]*?\]\]>/i,
      greedy: true
    },
    "tag": {
      pattern: /<\/?(?!\d)[^\s>\/=$<%]+(?:\s(?:\s*[^\s>\/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s'">=]+(?=[\s>]))|(?=[\s/>])))+)?\s*\/?>/,
      greedy: true,
      inside: {
        "tag": {
          pattern: /^<\/?[^\s>\/]+/,
          inside: {
            "punctuation": /^<\/?/,
            "namespace": /^[^\s>\/:]+:/
          }
        },
        "special-attr": [],
        "attr-value": {
          pattern: /=\s*(?:"[^"]*"|'[^']*'|[^\s'">=]+)/,
          inside: {
            "punctuation": [
              {
                pattern: /^=/,
                alias: "attr-equals"
              },
              {
                pattern: /^(\s*)["']|["']$/,
                lookbehind: true
              }
            ]
          }
        },
        "punctuation": /\/?>/,
        "attr-name": {
          pattern: /[^\s>\/]+/,
          inside: {
            "namespace": /^[^\s>\/:]+:/
          }
        }
      }
    },
    "entity": [
      {
        pattern: /&[\da-z]{1,8};/i,
        alias: "named-entity"
      },
      /&#x?[\da-f]{1,8};/i
    ]
  };
  Prism.languages.markup["tag"].inside["attr-value"].inside["entity"] = Prism.languages.markup["entity"];
  Prism.languages.markup["doctype"].inside["internal-subset"].inside = Prism.languages.markup;
  Prism.hooks.add("wrap", function(env) {
    if (env.type === "entity") {
      env.attributes["title"] = env.content.replace(/&amp;/, "&");
    }
  });
  Object.defineProperty(Prism.languages.markup.tag, "addInlined", {
    /**
     * Adds an inlined language to markup.
     *
     * An example of an inlined language is CSS with `<style>` tags.
     *
     * @param {string} tagName The name of the tag that contains the inlined language. This name will be treated as
     * case insensitive.
     * @param {string} lang The language key.
     * @example
     * addInlined('style', 'css');
     */
    value: function addInlined(tagName, lang) {
      var includedCdataInside = {};
      includedCdataInside["language-" + lang] = {
        pattern: /(^<!\[CDATA\[)[\s\S]+?(?=\]\]>$)/i,
        lookbehind: true,
        inside: Prism.languages[lang]
      };
      includedCdataInside["cdata"] = /^<!\[CDATA\[|\]\]>$/i;
      var inside = {
        "included-cdata": {
          pattern: /<!\[CDATA\[[\s\S]*?\]\]>/i,
          inside: includedCdataInside
        }
      };
      inside["language-" + lang] = {
        pattern: /[\s\S]+/,
        inside: Prism.languages[lang]
      };
      var def = {};
      def[tagName] = {
        pattern: RegExp(/(<__[^>]*>)(?:<!\[CDATA\[(?:[^\]]|\](?!\]>))*\]\]>|(?!<!\[CDATA\[)[\s\S])*?(?=<\/__>)/.source.replace(/__/g, function() {
          return tagName;
        }), "i"),
        lookbehind: true,
        greedy: true,
        inside
      };
      Prism.languages.insertBefore("markup", "cdata", def);
    }
  });
  Object.defineProperty(Prism.languages.markup.tag, "addAttribute", {
    /**
     * Adds an pattern to highlight languages embedded in HTML attributes.
     *
     * An example of an inlined language is CSS with `style` attributes.
     *
     * @param {string} attrName The name of the tag that contains the inlined language. This name will be treated as
     * case insensitive.
     * @param {string} lang The language key.
     * @example
     * addAttribute('style', 'css');
     */
    value: function(attrName, lang) {
      Prism.languages.markup.tag.inside["special-attr"].push({
        pattern: RegExp(
          /(^|["'\s])/.source + "(?:" + attrName + ")" + /\s*=\s*(?:"[^"]*"|'[^']*'|[^\s'">=]+(?=[\s>]))/.source,
          "i"
        ),
        lookbehind: true,
        inside: {
          "attr-name": /^[^\s=]+/,
          "attr-value": {
            pattern: /=[\s\S]+/,
            inside: {
              "value": {
                pattern: /(^=\s*(["']|(?!["'])))\S[\s\S]*(?=\2$)/,
                lookbehind: true,
                alias: [lang, "language-" + lang],
                inside: Prism.languages[lang]
              },
              "punctuation": [
                {
                  pattern: /^=/,
                  alias: "attr-equals"
                },
                /"|'/
              ]
            }
          }
        }
      });
    }
  });
  Prism.languages.html = Prism.languages.markup;
  Prism.languages.mathml = Prism.languages.markup;
  Prism.languages.svg = Prism.languages.markup;
  Prism.languages.xml = Prism.languages.extend("markup", {});
  Prism.languages.ssml = Prism.languages.xml;
  Prism.languages.atom = Prism.languages.xml;
  Prism.languages.rss = Prism.languages.xml;

  // node_modules/prismjs/components/prism-markdown.js
  (function(Prism2) {
    var inner = /(?:\\.|[^\\\n\r]|(?:\n|\r\n?)(?![\r\n]))/.source;
    function createInline(pattern) {
      pattern = pattern.replace(/<inner>/g, function() {
        return inner;
      });
      return RegExp(/((?:^|[^\\])(?:\\{2})*)/.source + "(?:" + pattern + ")");
    }
    var tableCell = /(?:\\.|``(?:[^`\r\n]|`(?!`))+``|`[^`\r\n]+`|[^\\|\r\n`])+/.source;
    var tableRow = /\|?__(?:\|__)+\|?(?:(?:\n|\r\n?)|(?![\s\S]))/.source.replace(/__/g, function() {
      return tableCell;
    });
    var tableLine = /\|?[ \t]*:?-{3,}:?[ \t]*(?:\|[ \t]*:?-{3,}:?[ \t]*)+\|?(?:\n|\r\n?)/.source;
    Prism2.languages.markdown = Prism2.languages.extend("markup", {});
    Prism2.languages.insertBefore("markdown", "prolog", {
      "front-matter-block": {
        pattern: /(^(?:\s*[\r\n])?)---(?!.)[\s\S]*?[\r\n]---(?!.)/,
        lookbehind: true,
        greedy: true,
        inside: {
          "punctuation": /^---|---$/,
          "front-matter": {
            pattern: /\S+(?:\s+\S+)*/,
            alias: ["yaml", "language-yaml"],
            inside: Prism2.languages.yaml
          }
        }
      },
      "blockquote": {
        // > ...
        pattern: /^>(?:[\t ]*>)*/m,
        alias: "punctuation"
      },
      "table": {
        pattern: RegExp("^" + tableRow + tableLine + "(?:" + tableRow + ")*", "m"),
        inside: {
          "table-data-rows": {
            pattern: RegExp("^(" + tableRow + tableLine + ")(?:" + tableRow + ")*$"),
            lookbehind: true,
            inside: {
              "table-data": {
                pattern: RegExp(tableCell),
                inside: Prism2.languages.markdown
              },
              "punctuation": /\|/
            }
          },
          "table-line": {
            pattern: RegExp("^(" + tableRow + ")" + tableLine + "$"),
            lookbehind: true,
            inside: {
              "punctuation": /\||:?-{3,}:?/
            }
          },
          "table-header-row": {
            pattern: RegExp("^" + tableRow + "$"),
            inside: {
              "table-header": {
                pattern: RegExp(tableCell),
                alias: "important",
                inside: Prism2.languages.markdown
              },
              "punctuation": /\|/
            }
          }
        }
      },
      "code": [
        {
          // Prefixed by 4 spaces or 1 tab and preceded by an empty line
          pattern: /((?:^|\n)[ \t]*\n|(?:^|\r\n?)[ \t]*\r\n?)(?: {4}|\t).+(?:(?:\n|\r\n?)(?: {4}|\t).+)*/,
          lookbehind: true,
          alias: "keyword"
        },
        {
          // ```optional language
          // code block
          // ```
          pattern: /^```[\s\S]*?^```$/m,
          greedy: true,
          inside: {
            "code-block": {
              pattern: /^(```.*(?:\n|\r\n?))[\s\S]+?(?=(?:\n|\r\n?)^```$)/m,
              lookbehind: true
            },
            "code-language": {
              pattern: /^(```).+/,
              lookbehind: true
            },
            "punctuation": /```/
          }
        }
      ],
      "title": [
        {
          // title 1
          // =======
          // title 2
          // -------
          pattern: /\S.*(?:\n|\r\n?)(?:==+|--+)(?=[ \t]*$)/m,
          alias: "important",
          inside: {
            punctuation: /==+$|--+$/
          }
        },
        {
          // # title 1
          // ###### title 6
          pattern: /(^\s*)#.+/m,
          lookbehind: true,
          alias: "important",
          inside: {
            punctuation: /^#+|#+$/
          }
        }
      ],
      "hr": {
        // ***
        // ---
        // * * *
        // -----------
        pattern: /(^\s*)([*-])(?:[\t ]*\2){2,}(?=\s*$)/m,
        lookbehind: true,
        alias: "punctuation"
      },
      "list": {
        // * item
        // + item
        // - item
        // 1. item
        pattern: /(^\s*)(?:[*+-]|\d+\.)(?=[\t ].)/m,
        lookbehind: true,
        alias: "punctuation"
      },
      "url-reference": {
        // [id]: http://example.com "Optional title"
        // [id]: http://example.com 'Optional title'
        // [id]: http://example.com (Optional title)
        // [id]: <http://example.com> "Optional title"
        pattern: /!?\[[^\]]+\]:[\t ]+(?:\S+|<(?:\\.|[^>\\])+>)(?:[\t ]+(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\((?:\\.|[^)\\])*\)))?/,
        inside: {
          "variable": {
            pattern: /^(!?\[)[^\]]+/,
            lookbehind: true
          },
          "string": /(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\((?:\\.|[^)\\])*\))$/,
          "punctuation": /^[\[\]!:]|[<>]/
        },
        alias: "url"
      },
      "bold": {
        // **strong**
        // __strong__
        // allow one nested instance of italic text using the same delimiter
        pattern: createInline(/\b__(?:(?!_)<inner>|_(?:(?!_)<inner>)+_)+__\b|\*\*(?:(?!\*)<inner>|\*(?:(?!\*)<inner>)+\*)+\*\*/.source),
        lookbehind: true,
        greedy: true,
        inside: {
          "content": {
            pattern: /(^..)[\s\S]+(?=..$)/,
            lookbehind: true,
            inside: {}
            // see below
          },
          "punctuation": /\*\*|__/
        }
      },
      "italic": {
        // *em*
        // _em_
        // allow one nested instance of bold text using the same delimiter
        pattern: createInline(/\b_(?:(?!_)<inner>|__(?:(?!_)<inner>)+__)+_\b|\*(?:(?!\*)<inner>|\*\*(?:(?!\*)<inner>)+\*\*)+\*/.source),
        lookbehind: true,
        greedy: true,
        inside: {
          "content": {
            pattern: /(^.)[\s\S]+(?=.$)/,
            lookbehind: true,
            inside: {}
            // see below
          },
          "punctuation": /[*_]/
        }
      },
      "strike": {
        // ~~strike through~~
        // ~strike~
        // eslint-disable-next-line regexp/strict
        pattern: createInline(/(~~?)(?:(?!~)<inner>)+\2/.source),
        lookbehind: true,
        greedy: true,
        inside: {
          "content": {
            pattern: /(^~~?)[\s\S]+(?=\1$)/,
            lookbehind: true,
            inside: {}
            // see below
          },
          "punctuation": /~~?/
        }
      },
      "code-snippet": {
        // `code`
        // ``code``
        pattern: /(^|[^\\`])(?:``[^`\r\n]+(?:`[^`\r\n]+)*``(?!`)|`[^`\r\n]+`(?!`))/,
        lookbehind: true,
        greedy: true,
        alias: ["code", "keyword"]
      },
      "url": {
        // [example](http://example.com "Optional title")
        // [example][id]
        // [example] [id]
        pattern: createInline(/!?\[(?:(?!\])<inner>)+\](?:\([^\s)]+(?:[\t ]+"(?:\\.|[^"\\])*")?\)|[ \t]?\[(?:(?!\])<inner>)+\])/.source),
        lookbehind: true,
        greedy: true,
        inside: {
          "operator": /^!/,
          "content": {
            pattern: /(^\[)[^\]]+(?=\])/,
            lookbehind: true,
            inside: {}
            // see below
          },
          "variable": {
            pattern: /(^\][ \t]?\[)[^\]]+(?=\]$)/,
            lookbehind: true
          },
          "url": {
            pattern: /(^\]\()[^\s)]+/,
            lookbehind: true
          },
          "string": {
            pattern: /(^[ \t]+)"(?:\\.|[^"\\])*"(?=\)$)/,
            lookbehind: true
          }
        }
      }
    });
    ["url", "bold", "italic", "strike"].forEach(function(token) {
      ["url", "bold", "italic", "strike", "code-snippet"].forEach(function(inside) {
        if (token !== inside) {
          Prism2.languages.markdown[token].inside.content.inside[inside] = Prism2.languages.markdown[inside];
        }
      });
    });
    Prism2.hooks.add("after-tokenize", function(env) {
      if (env.language !== "markdown" && env.language !== "md") {
        return;
      }
      function walkTokens(tokens) {
        if (!tokens || typeof tokens === "string") {
          return;
        }
        for (var i3 = 0, l3 = tokens.length; i3 < l3; i3++) {
          var token = tokens[i3];
          if (token.type !== "code") {
            walkTokens(token.content);
            continue;
          }
          var codeLang = token.content[1];
          var codeBlock = token.content[3];
          if (codeLang && codeBlock && codeLang.type === "code-language" && codeBlock.type === "code-block" && typeof codeLang.content === "string") {
            var lang = codeLang.content.replace(/\b#/g, "sharp").replace(/\b\+\+/g, "pp");
            lang = (/[a-z][\w-]*/i.exec(lang) || [""])[0].toLowerCase();
            var alias = "language-" + lang;
            if (!codeBlock.alias) {
              codeBlock.alias = [alias];
            } else if (typeof codeBlock.alias === "string") {
              codeBlock.alias = [codeBlock.alias, alias];
            } else {
              codeBlock.alias.push(alias);
            }
          }
        }
      }
      walkTokens(env.tokens);
    });
    Prism2.hooks.add("wrap", function(env) {
      if (env.type !== "code-block") {
        return;
      }
      var codeLang = "";
      for (var i3 = 0, l3 = env.classes.length; i3 < l3; i3++) {
        var cls = env.classes[i3];
        var match = /language-(.+)/.exec(cls);
        if (match) {
          codeLang = match[1];
          break;
        }
      }
      var grammar = Prism2.languages[codeLang];
      if (!grammar) {
        if (codeLang && codeLang !== "none" && Prism2.plugins.autoloader) {
          var id = "md-" + (/* @__PURE__ */ new Date()).valueOf() + "-" + Math.floor(Math.random() * 1e16);
          env.attributes["id"] = id;
          Prism2.plugins.autoloader.loadLanguages(codeLang, function() {
            var ele = document.getElementById(id);
            if (ele) {
              ele.innerHTML = Prism2.highlight(ele.textContent, Prism2.languages[codeLang], codeLang);
            }
          });
        }
      } else {
        env.content = Prism2.highlight(textContent(env.content), grammar, codeLang);
      }
    });
    var tagPattern = RegExp(Prism2.languages.markup.tag.pattern.source, "gi");
    var KNOWN_ENTITY_NAMES = {
      "amp": "&",
      "lt": "<",
      "gt": ">",
      "quot": '"'
    };
    var fromCodePoint = String.fromCodePoint || String.fromCharCode;
    function textContent(html) {
      var text = html.replace(tagPattern, "");
      text = text.replace(/&(\w{1,8}|#x?[\da-f]{1,8});/gi, function(m3, code) {
        code = code.toLowerCase();
        if (code[0] === "#") {
          var value;
          if (code[1] === "x") {
            value = parseInt(code.slice(2), 16);
          } else {
            value = Number(code.slice(1));
          }
          return fromCodePoint(value);
        } else {
          var known = KNOWN_ENTITY_NAMES[code];
          if (known) {
            return known;
          }
          return m3;
        }
      });
      return text;
    }
    Prism2.languages.md = Prism2.languages.markdown;
  })(Prism);

  // node_modules/prismjs/components/prism-c.js
  Prism.languages.c = Prism.languages.extend("clike", {
    "comment": {
      pattern: /\/\/(?:[^\r\n\\]|\\(?:\r\n?|\n|(?![\r\n])))*|\/\*[\s\S]*?(?:\*\/|$)/,
      greedy: true
    },
    "string": {
      // https://en.cppreference.com/w/c/language/string_literal
      pattern: /"(?:\\(?:\r\n|[\s\S])|[^"\\\r\n])*"/,
      greedy: true
    },
    "class-name": {
      pattern: /(\b(?:enum|struct)\s+(?:__attribute__\s*\(\([\s\S]*?\)\)\s*)?)\w+|\b[a-z]\w*_t\b/,
      lookbehind: true
    },
    "keyword": /\b(?:_Alignas|_Alignof|_Atomic|_Bool|_Complex|_Generic|_Imaginary|_Noreturn|_Static_assert|_Thread_local|__attribute__|asm|auto|break|case|char|const|continue|default|do|double|else|enum|extern|float|for|goto|if|inline|int|long|register|return|short|signed|sizeof|static|struct|switch|typedef|typeof|union|unsigned|void|volatile|while)\b/,
    "function": /\b[a-z_]\w*(?=\s*\()/i,
    "number": /(?:\b0x(?:[\da-f]+(?:\.[\da-f]*)?|\.[\da-f]+)(?:p[+-]?\d+)?|(?:\b\d+(?:\.\d*)?|\B\.\d+)(?:e[+-]?\d+)?)[ful]{0,4}/i,
    "operator": />>=?|<<=?|->|([-+&|:])\1|[?:~]|[-+*/%&|^!=<>]=?/
  });
  Prism.languages.insertBefore("c", "string", {
    "char": {
      // https://en.cppreference.com/w/c/language/character_constant
      pattern: /'(?:\\(?:\r\n|[\s\S])|[^'\\\r\n]){0,32}'/,
      greedy: true
    }
  });
  Prism.languages.insertBefore("c", "string", {
    "macro": {
      // allow for multiline macro definitions
      // spaces after the # character compile fine with gcc
      pattern: /(^[\t ]*)#\s*[a-z](?:[^\r\n\\/]|\/(?!\*)|\/\*(?:[^*]|\*(?!\/))*\*\/|\\(?:\r\n|[\s\S]))*/im,
      lookbehind: true,
      greedy: true,
      alias: "property",
      inside: {
        "string": [
          {
            // highlight the path of the include statement as a string
            pattern: /^(#\s*include\s*)<[^>]+>/,
            lookbehind: true
          },
          Prism.languages.c["string"]
        ],
        "char": Prism.languages.c["char"],
        "comment": Prism.languages.c["comment"],
        "macro-name": [
          {
            pattern: /(^#\s*define\s+)\w+\b(?!\()/i,
            lookbehind: true
          },
          {
            pattern: /(^#\s*define\s+)\w+\b(?=\()/i,
            lookbehind: true,
            alias: "function"
          }
        ],
        // highlight macro directives as keywords
        "directive": {
          pattern: /^(#\s*)[a-z]+/,
          lookbehind: true,
          alias: "keyword"
        },
        "directive-hash": /^#/,
        "punctuation": /##|\\(?=[\r\n])/,
        "expression": {
          pattern: /\S[\s\S]*/,
          inside: Prism.languages.c
        }
      }
    }
  });
  Prism.languages.insertBefore("c", "function", {
    // highlight predefined macros as constants
    "constant": /\b(?:EOF|NULL|SEEK_CUR|SEEK_END|SEEK_SET|__DATE__|__FILE__|__LINE__|__TIMESTAMP__|__TIME__|__func__|stderr|stdin|stdout)\b/
  });
  delete Prism.languages.c["boolean"];

  // node_modules/prismjs/components/prism-css.js
  (function(Prism2) {
    var string = /(?:"(?:\\(?:\r\n|[\s\S])|[^"\\\r\n])*"|'(?:\\(?:\r\n|[\s\S])|[^'\\\r\n])*')/;
    Prism2.languages.css = {
      "comment": /\/\*[\s\S]*?\*\//,
      "atrule": {
        pattern: RegExp("@[\\w-](?:" + /[^;{\s"']|\s+(?!\s)/.source + "|" + string.source + ")*?" + /(?:;|(?=\s*\{))/.source),
        inside: {
          "rule": /^@[\w-]+/,
          "selector-function-argument": {
            pattern: /(\bselector\s*\(\s*(?![\s)]))(?:[^()\s]|\s+(?![\s)])|\((?:[^()]|\([^()]*\))*\))+(?=\s*\))/,
            lookbehind: true,
            alias: "selector"
          },
          "keyword": {
            pattern: /(^|[^\w-])(?:and|not|only|or)(?![\w-])/,
            lookbehind: true
          }
          // See rest below
        }
      },
      "url": {
        // https://drafts.csswg.org/css-values-3/#urls
        pattern: RegExp("\\burl\\((?:" + string.source + "|" + /(?:[^\\\r\n()"']|\\[\s\S])*/.source + ")\\)", "i"),
        greedy: true,
        inside: {
          "function": /^url/i,
          "punctuation": /^\(|\)$/,
          "string": {
            pattern: RegExp("^" + string.source + "$"),
            alias: "url"
          }
        }
      },
      "selector": {
        pattern: RegExp(`(^|[{}\\s])[^{}\\s](?:[^{};"'\\s]|\\s+(?![\\s{])|` + string.source + ")*(?=\\s*\\{)"),
        lookbehind: true
      },
      "string": {
        pattern: string,
        greedy: true
      },
      "property": {
        pattern: /(^|[^-\w\xA0-\uFFFF])(?!\s)[-_a-z\xA0-\uFFFF](?:(?!\s)[-\w\xA0-\uFFFF])*(?=\s*:)/i,
        lookbehind: true
      },
      "important": /!important\b/i,
      "function": {
        pattern: /(^|[^-a-z0-9])[-a-z0-9]+(?=\()/i,
        lookbehind: true
      },
      "punctuation": /[(){};:,]/
    };
    Prism2.languages.css["atrule"].inside.rest = Prism2.languages.css;
    var markup = Prism2.languages.markup;
    if (markup) {
      markup.tag.addInlined("style", "css");
      markup.tag.addAttribute("style", "css");
    }
  })(Prism);

  // node_modules/prismjs/components/prism-objectivec.js
  Prism.languages.objectivec = Prism.languages.extend("c", {
    "string": {
      pattern: /@?"(?:\\(?:\r\n|[\s\S])|[^"\\\r\n])*"/,
      greedy: true
    },
    "keyword": /\b(?:asm|auto|break|case|char|const|continue|default|do|double|else|enum|extern|float|for|goto|if|in|inline|int|long|register|return|self|short|signed|sizeof|static|struct|super|switch|typedef|typeof|union|unsigned|void|volatile|while)\b|(?:@interface|@end|@implementation|@protocol|@class|@public|@protected|@private|@property|@try|@catch|@finally|@throw|@synthesize|@dynamic|@selector)\b/,
    "operator": /-[->]?|\+\+?|!=?|<<?=?|>>?=?|==?|&&?|\|\|?|[~^%?*\/@]/
  });
  delete Prism.languages.objectivec["class-name"];
  Prism.languages.objc = Prism.languages.objectivec;

  // node_modules/prismjs/components/prism-sql.js
  Prism.languages.sql = {
    "comment": {
      pattern: /(^|[^\\])(?:\/\*[\s\S]*?\*\/|(?:--|\/\/|#).*)/,
      lookbehind: true
    },
    "variable": [
      {
        pattern: /@(["'`])(?:\\[\s\S]|(?!\1)[^\\])+\1/,
        greedy: true
      },
      /@[\w.$]+/
    ],
    "string": {
      pattern: /(^|[^@\\])("|')(?:\\[\s\S]|(?!\2)[^\\]|\2\2)*\2/,
      greedy: true,
      lookbehind: true
    },
    "identifier": {
      pattern: /(^|[^@\\])`(?:\\[\s\S]|[^`\\]|``)*`/,
      greedy: true,
      lookbehind: true,
      inside: {
        "punctuation": /^`|`$/
      }
    },
    "function": /\b(?:AVG|COUNT|FIRST|FORMAT|LAST|LCASE|LEN|MAX|MID|MIN|MOD|NOW|ROUND|SUM|UCASE)(?=\s*\()/i,
    // Should we highlight user defined functions too?
    "keyword": /\b(?:ACTION|ADD|AFTER|ALGORITHM|ALL|ALTER|ANALYZE|ANY|APPLY|AS|ASC|AUTHORIZATION|AUTO_INCREMENT|BACKUP|BDB|BEGIN|BERKELEYDB|BIGINT|BINARY|BIT|BLOB|BOOL|BOOLEAN|BREAK|BROWSE|BTREE|BULK|BY|CALL|CASCADED?|CASE|CHAIN|CHAR(?:ACTER|SET)?|CHECK(?:POINT)?|CLOSE|CLUSTERED|COALESCE|COLLATE|COLUMNS?|COMMENT|COMMIT(?:TED)?|COMPUTE|CONNECT|CONSISTENT|CONSTRAINT|CONTAINS(?:TABLE)?|CONTINUE|CONVERT|CREATE|CROSS|CURRENT(?:_DATE|_TIME|_TIMESTAMP|_USER)?|CURSOR|CYCLE|DATA(?:BASES?)?|DATE(?:TIME)?|DAY|DBCC|DEALLOCATE|DEC|DECIMAL|DECLARE|DEFAULT|DEFINER|DELAYED|DELETE|DELIMITERS?|DENY|DESC|DESCRIBE|DETERMINISTIC|DISABLE|DISCARD|DISK|DISTINCT|DISTINCTROW|DISTRIBUTED|DO|DOUBLE|DROP|DUMMY|DUMP(?:FILE)?|DUPLICATE|ELSE(?:IF)?|ENABLE|ENCLOSED|END|ENGINE|ENUM|ERRLVL|ERRORS|ESCAPED?|EXCEPT|EXEC(?:UTE)?|EXISTS|EXIT|EXPLAIN|EXTENDED|FETCH|FIELDS|FILE|FILLFACTOR|FIRST|FIXED|FLOAT|FOLLOWING|FOR(?: EACH ROW)?|FORCE|FOREIGN|FREETEXT(?:TABLE)?|FROM|FULL|FUNCTION|GEOMETRY(?:COLLECTION)?|GLOBAL|GOTO|GRANT|GROUP|HANDLER|HASH|HAVING|HOLDLOCK|HOUR|IDENTITY(?:COL|_INSERT)?|IF|IGNORE|IMPORT|INDEX|INFILE|INNER|INNODB|INOUT|INSERT|INT|INTEGER|INTERSECT|INTERVAL|INTO|INVOKER|ISOLATION|ITERATE|JOIN|KEYS?|KILL|LANGUAGE|LAST|LEAVE|LEFT|LEVEL|LIMIT|LINENO|LINES|LINESTRING|LOAD|LOCAL|LOCK|LONG(?:BLOB|TEXT)|LOOP|MATCH(?:ED)?|MEDIUM(?:BLOB|INT|TEXT)|MERGE|MIDDLEINT|MINUTE|MODE|MODIFIES|MODIFY|MONTH|MULTI(?:LINESTRING|POINT|POLYGON)|NATIONAL|NATURAL|NCHAR|NEXT|NO|NONCLUSTERED|NULLIF|NUMERIC|OFF?|OFFSETS?|ON|OPEN(?:DATASOURCE|QUERY|ROWSET)?|OPTIMIZE|OPTION(?:ALLY)?|ORDER|OUT(?:ER|FILE)?|OVER|PARTIAL|PARTITION|PERCENT|PIVOT|PLAN|POINT|POLYGON|PRECEDING|PRECISION|PREPARE|PREV|PRIMARY|PRINT|PRIVILEGES|PROC(?:EDURE)?|PUBLIC|PURGE|QUICK|RAISERROR|READS?|REAL|RECONFIGURE|REFERENCES|RELEASE|RENAME|REPEAT(?:ABLE)?|REPLACE|REPLICATION|REQUIRE|RESIGNAL|RESTORE|RESTRICT|RETURN(?:ING|S)?|REVOKE|RIGHT|ROLLBACK|ROUTINE|ROW(?:COUNT|GUIDCOL|S)?|RTREE|RULE|SAVE(?:POINT)?|SCHEMA|SECOND|SELECT|SERIAL(?:IZABLE)?|SESSION(?:_USER)?|SET(?:USER)?|SHARE|SHOW|SHUTDOWN|SIMPLE|SMALLINT|SNAPSHOT|SOME|SONAME|SQL|START(?:ING)?|STATISTICS|STATUS|STRIPED|SYSTEM_USER|TABLES?|TABLESPACE|TEMP(?:ORARY|TABLE)?|TERMINATED|TEXT(?:SIZE)?|THEN|TIME(?:STAMP)?|TINY(?:BLOB|INT|TEXT)|TOP?|TRAN(?:SACTIONS?)?|TRIGGER|TRUNCATE|TSEQUAL|TYPES?|UNBOUNDED|UNCOMMITTED|UNDEFINED|UNION|UNIQUE|UNLOCK|UNPIVOT|UNSIGNED|UPDATE(?:TEXT)?|USAGE|USE|USER|USING|VALUES?|VAR(?:BINARY|CHAR|CHARACTER|YING)|VIEW|WAITFOR|WARNINGS|WHEN|WHERE|WHILE|WITH(?: ROLLUP|IN)?|WORK|WRITE(?:TEXT)?|YEAR)\b/i,
    "boolean": /\b(?:FALSE|NULL|TRUE)\b/i,
    "number": /\b0x[\da-f]+\b|\b\d+(?:\.\d*)?|\B\.\d+\b/i,
    "operator": /[-+*\/=%^~]|&&?|\|\|?|!=?|<(?:=>?|<|>)?|>[>=]?|\b(?:AND|BETWEEN|DIV|ILIKE|IN|IS|LIKE|NOT|OR|REGEXP|RLIKE|SOUNDS LIKE|XOR)\b/i,
    "punctuation": /[;[\]()`,.]/
  };

  // node_modules/prismjs/components/prism-powershell.js
  (function(Prism2) {
    var powershell = Prism2.languages.powershell = {
      "comment": [
        {
          pattern: /(^|[^`])<#[\s\S]*?#>/,
          lookbehind: true
        },
        {
          pattern: /(^|[^`])#.*/,
          lookbehind: true
        }
      ],
      "string": [
        {
          pattern: /"(?:`[\s\S]|[^`"])*"/,
          greedy: true,
          inside: null
          // see below
        },
        {
          pattern: /'(?:[^']|'')*'/,
          greedy: true
        }
      ],
      // Matches name spaces as well as casts, attribute decorators. Force starting with letter to avoid matching array indices
      // Supports two levels of nested brackets (e.g. `[OutputType([System.Collections.Generic.List[int]])]`)
      "namespace": /\[[a-z](?:\[(?:\[[^\]]*\]|[^\[\]])*\]|[^\[\]])*\]/i,
      "boolean": /\$(?:false|true)\b/i,
      "variable": /\$\w+\b/,
      // Cmdlets and aliases. Aliases should come last, otherwise "write" gets preferred over "write-host" for example
      // Get-Command | ?{ $_.ModuleName -match "Microsoft.PowerShell.(Util|Core|Management)" }
      // Get-Alias | ?{ $_.ReferencedCommand.Module.Name -match "Microsoft.PowerShell.(Util|Core|Management)" }
      "function": [
        /\b(?:Add|Approve|Assert|Backup|Block|Checkpoint|Clear|Close|Compare|Complete|Compress|Confirm|Connect|Convert|ConvertFrom|ConvertTo|Copy|Debug|Deny|Disable|Disconnect|Dismount|Edit|Enable|Enter|Exit|Expand|Export|Find|ForEach|Format|Get|Grant|Group|Hide|Import|Initialize|Install|Invoke|Join|Limit|Lock|Measure|Merge|Move|New|Open|Optimize|Out|Ping|Pop|Protect|Publish|Push|Read|Receive|Redo|Register|Remove|Rename|Repair|Request|Reset|Resize|Resolve|Restart|Restore|Resume|Revoke|Save|Search|Select|Send|Set|Show|Skip|Sort|Split|Start|Step|Stop|Submit|Suspend|Switch|Sync|Tee|Test|Trace|Unblock|Undo|Uninstall|Unlock|Unprotect|Unpublish|Unregister|Update|Use|Wait|Watch|Where|Write)-[a-z]+\b/i,
        /\b(?:ac|cat|chdir|clc|cli|clp|clv|compare|copy|cp|cpi|cpp|cvpa|dbp|del|diff|dir|ebp|echo|epal|epcsv|epsn|erase|fc|fl|ft|fw|gal|gbp|gc|gci|gcs|gdr|gi|gl|gm|gp|gps|group|gsv|gu|gv|gwmi|iex|ii|ipal|ipcsv|ipsn|irm|iwmi|iwr|kill|lp|ls|measure|mi|mount|move|mp|mv|nal|ndr|ni|nv|ogv|popd|ps|pushd|pwd|rbp|rd|rdr|ren|ri|rm|rmdir|rni|rnp|rp|rv|rvpa|rwmi|sal|saps|sasv|sbp|sc|select|set|shcm|si|sl|sleep|sls|sort|sp|spps|spsv|start|sv|swmi|tee|trcm|type|write)\b/i
      ],
      // per http://technet.microsoft.com/en-us/library/hh847744.aspx
      "keyword": /\b(?:Begin|Break|Catch|Class|Continue|Data|Define|Do|DynamicParam|Else|ElseIf|End|Exit|Filter|Finally|For|ForEach|From|Function|If|InlineScript|Parallel|Param|Process|Return|Sequence|Switch|Throw|Trap|Try|Until|Using|Var|While|Workflow)\b/i,
      "operator": {
        pattern: /(^|\W)(?:!|-(?:b?(?:and|x?or)|as|(?:Not)?(?:Contains|In|Like|Match)|eq|ge|gt|is(?:Not)?|Join|le|lt|ne|not|Replace|sh[lr])\b|-[-=]?|\+[+=]?|[*\/%]=?)/i,
        lookbehind: true
      },
      "punctuation": /[|{}[\];(),.]/
    };
    powershell.string[0].inside = {
      "function": {
        // Allow for one level of nesting
        pattern: /(^|[^`])\$\((?:\$\([^\r\n()]*\)|(?!\$\()[^\r\n)])*\)/,
        lookbehind: true,
        inside: powershell
      },
      "boolean": powershell.boolean,
      "variable": powershell.variable
    };
  })(Prism);

  // node_modules/prismjs/components/prism-python.js
  Prism.languages.python = {
    "comment": {
      pattern: /(^|[^\\])#.*/,
      lookbehind: true,
      greedy: true
    },
    "string-interpolation": {
      pattern: /(?:f|fr|rf)(?:("""|''')[\s\S]*?\1|("|')(?:\\.|(?!\2)[^\\\r\n])*\2)/i,
      greedy: true,
      inside: {
        "interpolation": {
          // "{" <expression> <optional "!s", "!r", or "!a"> <optional ":" format specifier> "}"
          pattern: /((?:^|[^{])(?:\{\{)*)\{(?!\{)(?:[^{}]|\{(?!\{)(?:[^{}]|\{(?!\{)(?:[^{}])+\})+\})+\}/,
          lookbehind: true,
          inside: {
            "format-spec": {
              pattern: /(:)[^:(){}]+(?=\}$)/,
              lookbehind: true
            },
            "conversion-option": {
              pattern: /![sra](?=[:}]$)/,
              alias: "punctuation"
            },
            rest: null
          }
        },
        "string": /[\s\S]+/
      }
    },
    "triple-quoted-string": {
      pattern: /(?:[rub]|br|rb)?("""|''')[\s\S]*?\1/i,
      greedy: true,
      alias: "string"
    },
    "string": {
      pattern: /(?:[rub]|br|rb)?("|')(?:\\.|(?!\1)[^\\\r\n])*\1/i,
      greedy: true
    },
    "function": {
      pattern: /((?:^|\s)def[ \t]+)[a-zA-Z_]\w*(?=\s*\()/g,
      lookbehind: true
    },
    "class-name": {
      pattern: /(\bclass\s+)\w+/i,
      lookbehind: true
    },
    "decorator": {
      pattern: /(^[\t ]*)@\w+(?:\.\w+)*/m,
      lookbehind: true,
      alias: ["annotation", "punctuation"],
      inside: {
        "punctuation": /\./
      }
    },
    "keyword": /\b(?:_(?=\s*:)|and|as|assert|async|await|break|case|class|continue|def|del|elif|else|except|exec|finally|for|from|global|if|import|in|is|lambda|match|nonlocal|not|or|pass|print|raise|return|try|while|with|yield)\b/,
    "builtin": /\b(?:__import__|abs|all|any|apply|ascii|basestring|bin|bool|buffer|bytearray|bytes|callable|chr|classmethod|cmp|coerce|compile|complex|delattr|dict|dir|divmod|enumerate|eval|execfile|file|filter|float|format|frozenset|getattr|globals|hasattr|hash|help|hex|id|input|int|intern|isinstance|issubclass|iter|len|list|locals|long|map|max|memoryview|min|next|object|oct|open|ord|pow|property|range|raw_input|reduce|reload|repr|reversed|round|set|setattr|slice|sorted|staticmethod|str|sum|super|tuple|type|unichr|unicode|vars|xrange|zip)\b/,
    "boolean": /\b(?:False|None|True)\b/,
    "number": /\b0(?:b(?:_?[01])+|o(?:_?[0-7])+|x(?:_?[a-f0-9])+)\b|(?:\b\d+(?:_\d+)*(?:\.(?:\d+(?:_\d+)*)?)?|\B\.\d+(?:_\d+)*)(?:e[+-]?\d+(?:_\d+)*)?j?(?!\w)/i,
    "operator": /[-+%=]=?|!=|:=|\*\*?=?|\/\/?=?|<[<=>]?|>[=>]?|[&|^~]/,
    "punctuation": /[{}[\];(),.:]/
  };
  Prism.languages.python["string-interpolation"].inside["interpolation"].inside.rest = Prism.languages.python;
  Prism.languages.py = Prism.languages.python;

  // node_modules/prismjs/components/prism-rust.js
  (function(Prism2) {
    var multilineComment = /\/\*(?:[^*/]|\*(?!\/)|\/(?!\*)|<self>)*\*\//.source;
    for (var i3 = 0; i3 < 2; i3++) {
      multilineComment = multilineComment.replace(/<self>/g, function() {
        return multilineComment;
      });
    }
    multilineComment = multilineComment.replace(/<self>/g, function() {
      return /[^\s\S]/.source;
    });
    Prism2.languages.rust = {
      "comment": [
        {
          pattern: RegExp(/(^|[^\\])/.source + multilineComment),
          lookbehind: true,
          greedy: true
        },
        {
          pattern: /(^|[^\\:])\/\/.*/,
          lookbehind: true,
          greedy: true
        }
      ],
      "string": {
        pattern: /b?"(?:\\[\s\S]|[^\\"])*"|b?r(#*)"(?:[^"]|"(?!\1))*"\1/,
        greedy: true
      },
      "char": {
        pattern: /b?'(?:\\(?:x[0-7][\da-fA-F]|u\{(?:[\da-fA-F]_*){1,6}\}|.)|[^\\\r\n\t'])'/,
        greedy: true
      },
      "attribute": {
        pattern: /#!?\[(?:[^\[\]"]|"(?:\\[\s\S]|[^\\"])*")*\]/,
        greedy: true,
        alias: "attr-name",
        inside: {
          "string": null
          // see below
        }
      },
      // Closure params should not be confused with bitwise OR |
      "closure-params": {
        pattern: /([=(,:]\s*|\bmove\s*)\|[^|]*\||\|[^|]*\|(?=\s*(?:\{|->))/,
        lookbehind: true,
        greedy: true,
        inside: {
          "closure-punctuation": {
            pattern: /^\||\|$/,
            alias: "punctuation"
          },
          rest: null
          // see below
        }
      },
      "lifetime-annotation": {
        pattern: /'\w+/,
        alias: "symbol"
      },
      "fragment-specifier": {
        pattern: /(\$\w+:)[a-z]+/,
        lookbehind: true,
        alias: "punctuation"
      },
      "variable": /\$\w+/,
      "function-definition": {
        pattern: /(\bfn\s+)\w+/,
        lookbehind: true,
        alias: "function"
      },
      "type-definition": {
        pattern: /(\b(?:enum|struct|trait|type|union)\s+)\w+/,
        lookbehind: true,
        alias: "class-name"
      },
      "module-declaration": [
        {
          pattern: /(\b(?:crate|mod)\s+)[a-z][a-z_\d]*/,
          lookbehind: true,
          alias: "namespace"
        },
        {
          pattern: /(\b(?:crate|self|super)\s*)::\s*[a-z][a-z_\d]*\b(?:\s*::(?:\s*[a-z][a-z_\d]*\s*::)*)?/,
          lookbehind: true,
          alias: "namespace",
          inside: {
            "punctuation": /::/
          }
        }
      ],
      "keyword": [
        // https://github.com/rust-lang/reference/blob/master/src/keywords.md
        /\b(?:Self|abstract|as|async|await|become|box|break|const|continue|crate|do|dyn|else|enum|extern|final|fn|for|if|impl|in|let|loop|macro|match|mod|move|mut|override|priv|pub|ref|return|self|static|struct|super|trait|try|type|typeof|union|unsafe|unsized|use|virtual|where|while|yield)\b/,
        // primitives and str
        // https://doc.rust-lang.org/stable/rust-by-example/primitives.html
        /\b(?:bool|char|f(?:32|64)|[ui](?:8|16|32|64|128|size)|str)\b/
      ],
      // functions can technically start with an upper-case letter, but this will introduce a lot of false positives
      // and Rust's naming conventions recommend snake_case anyway.
      // https://doc.rust-lang.org/1.0.0/style/style/naming/README.html
      "function": /\b[a-z_]\w*(?=\s*(?:::\s*<|\())/,
      "macro": {
        pattern: /\b\w+!/,
        alias: "property"
      },
      "constant": /\b[A-Z_][A-Z_\d]+\b/,
      "class-name": /\b[A-Z]\w*\b/,
      "namespace": {
        pattern: /(?:\b[a-z][a-z_\d]*\s*::\s*)*\b[a-z][a-z_\d]*\s*::(?!\s*<)/,
        inside: {
          "punctuation": /::/
        }
      },
      // Hex, oct, bin, dec numbers with visual separators and type suffix
      "number": /\b(?:0x[\dA-Fa-f](?:_?[\dA-Fa-f])*|0o[0-7](?:_?[0-7])*|0b[01](?:_?[01])*|(?:(?:\d(?:_?\d)*)?\.)?\d(?:_?\d)*(?:[Ee][+-]?\d+)?)(?:_?(?:f32|f64|[iu](?:8|16|32|64|size)?))?\b/,
      "boolean": /\b(?:false|true)\b/,
      "punctuation": /->|\.\.=|\.{1,3}|::|[{}[\];(),:]/,
      "operator": /[-+*\/%!^]=?|=[=>]?|&[&=]?|\|[|=]?|<<?=?|>>?=?|[@?]/
    };
    Prism2.languages.rust["closure-params"].inside.rest = Prism2.languages.rust;
    Prism2.languages.rust["attribute"].inside["string"] = Prism2.languages.rust["string"];
  })(Prism);

  // node_modules/prismjs/components/prism-swift.js
  Prism.languages.swift = {
    "comment": {
      // Nested comments are supported up to 2 levels
      pattern: /(^|[^\\:])(?:\/\/.*|\/\*(?:[^/*]|\/(?!\*)|\*(?!\/)|\/\*(?:[^*]|\*(?!\/))*\*\/)*\*\/)/,
      lookbehind: true,
      greedy: true
    },
    "string-literal": [
      // https://docs.swift.org/swift-book/LanguageGuide/StringsAndCharacters.html
      {
        pattern: RegExp(
          /(^|[^"#])/.source + "(?:" + /"(?:\\(?:\((?:[^()]|\([^()]*\))*\)|\r\n|[^(])|[^\\\r\n"])*"/.source + "|" + /"""(?:\\(?:\((?:[^()]|\([^()]*\))*\)|[^(])|[^\\"]|"(?!""))*"""/.source + ")" + /(?!["#])/.source
        ),
        lookbehind: true,
        greedy: true,
        inside: {
          "interpolation": {
            pattern: /(\\\()(?:[^()]|\([^()]*\))*(?=\))/,
            lookbehind: true,
            inside: null
            // see below
          },
          "interpolation-punctuation": {
            pattern: /^\)|\\\($/,
            alias: "punctuation"
          },
          "punctuation": /\\(?=[\r\n])/,
          "string": /[\s\S]+/
        }
      },
      {
        pattern: RegExp(
          /(^|[^"#])(#+)/.source + "(?:" + /"(?:\\(?:#+\((?:[^()]|\([^()]*\))*\)|\r\n|[^#])|[^\\\r\n])*?"/.source + "|" + /"""(?:\\(?:#+\((?:[^()]|\([^()]*\))*\)|[^#])|[^\\])*?"""/.source + ")\\2"
        ),
        lookbehind: true,
        greedy: true,
        inside: {
          "interpolation": {
            pattern: /(\\#+\()(?:[^()]|\([^()]*\))*(?=\))/,
            lookbehind: true,
            inside: null
            // see below
          },
          "interpolation-punctuation": {
            pattern: /^\)|\\#+\($/,
            alias: "punctuation"
          },
          "string": /[\s\S]+/
        }
      }
    ],
    "directive": {
      // directives with conditions
      pattern: RegExp(
        /#/.source + "(?:" + (/(?:elseif|if)\b/.source + "(?:[ 	]*" + /(?:![ \t]*)?(?:\b\w+\b(?:[ \t]*\((?:[^()]|\([^()]*\))*\))?|\((?:[^()]|\([^()]*\))*\))(?:[ \t]*(?:&&|\|\|))?/.source + ")+") + "|" + /(?:else|endif)\b/.source + ")"
      ),
      alias: "property",
      inside: {
        "directive-name": /^#\w+/,
        "boolean": /\b(?:false|true)\b/,
        "number": /\b\d+(?:\.\d+)*\b/,
        "operator": /!|&&|\|\||[<>]=?/,
        "punctuation": /[(),]/
      }
    },
    "literal": {
      pattern: /#(?:colorLiteral|column|dsohandle|file(?:ID|Literal|Path)?|function|imageLiteral|line)\b/,
      alias: "constant"
    },
    "other-directive": {
      pattern: /#\w+\b/,
      alias: "property"
    },
    "attribute": {
      pattern: /@\w+/,
      alias: "atrule"
    },
    "function-definition": {
      pattern: /(\bfunc\s+)\w+/,
      lookbehind: true,
      alias: "function"
    },
    "label": {
      // https://docs.swift.org/swift-book/LanguageGuide/ControlFlow.html#ID141
      pattern: /\b(break|continue)\s+\w+|\b[a-zA-Z_]\w*(?=\s*:\s*(?:for|repeat|while)\b)/,
      lookbehind: true,
      alias: "important"
    },
    "keyword": /\b(?:Any|Protocol|Self|Type|actor|as|assignment|associatedtype|associativity|async|await|break|case|catch|class|continue|convenience|default|defer|deinit|didSet|do|dynamic|else|enum|extension|fallthrough|fileprivate|final|for|func|get|guard|higherThan|if|import|in|indirect|infix|init|inout|internal|is|isolated|lazy|left|let|lowerThan|mutating|none|nonisolated|nonmutating|open|operator|optional|override|postfix|precedencegroup|prefix|private|protocol|public|repeat|required|rethrows|return|right|safe|self|set|some|static|struct|subscript|super|switch|throw|throws|try|typealias|unowned|unsafe|var|weak|where|while|willSet)\b/,
    "boolean": /\b(?:false|true)\b/,
    "nil": {
      pattern: /\bnil\b/,
      alias: "constant"
    },
    "short-argument": /\$\d+\b/,
    "omit": {
      pattern: /\b_\b/,
      alias: "keyword"
    },
    "number": /\b(?:[\d_]+(?:\.[\de_]+)?|0x[a-f0-9_]+(?:\.[a-f0-9p_]+)?|0b[01_]+|0o[0-7_]+)\b/i,
    // A class name must start with an upper-case letter and be either 1 letter long or contain a lower-case letter.
    "class-name": /\b[A-Z](?:[A-Z_\d]*[a-z]\w*)?\b/,
    "function": /\b[a-z_]\w*(?=\s*\()/i,
    "constant": /\b(?:[A-Z_]{2,}|k[A-Z][A-Za-z_]+)\b/,
    // Operators are generic in Swift. Developers can even create new operators (e.g. +++).
    // https://docs.swift.org/swift-book/ReferenceManual/zzSummaryOfTheGrammar.html#ID481
    // This regex only supports ASCII operators.
    "operator": /[-+*/%=!<>&|^~?]+|\.[.\-+*/%=!<>&|^~?]+/,
    "punctuation": /[{}[\]();,.:\\]/
  };
  Prism.languages.swift["string-literal"].forEach(function(rule) {
    rule.inside["interpolation"].inside = Prism.languages.swift;
  });

  // node_modules/prismjs/components/prism-typescript.js
  (function(Prism2) {
    Prism2.languages.typescript = Prism2.languages.extend("javascript", {
      "class-name": {
        pattern: /(\b(?:class|extends|implements|instanceof|interface|new|type)\s+)(?!keyof\b)(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*(?:\s*<(?:[^<>]|<(?:[^<>]|<[^<>]*>)*>)*>)?/,
        lookbehind: true,
        greedy: true,
        inside: null
        // see below
      },
      "builtin": /\b(?:Array|Function|Promise|any|boolean|console|never|number|string|symbol|unknown)\b/
    });
    Prism2.languages.typescript.keyword.push(
      /\b(?:abstract|declare|is|keyof|readonly|require)\b/,
      // keywords that have to be followed by an identifier
      /\b(?:asserts|infer|interface|module|namespace|type)\b(?=\s*(?:[{_$a-zA-Z\xA0-\uFFFF]|$))/,
      // This is for `import type *, {}`
      /\btype\b(?=\s*(?:[\{*]|$))/
    );
    delete Prism2.languages.typescript["parameter"];
    delete Prism2.languages.typescript["literal-property"];
    var typeInside = Prism2.languages.extend("typescript", {});
    delete typeInside["class-name"];
    Prism2.languages.typescript["class-name"].inside = typeInside;
    Prism2.languages.insertBefore("typescript", "function", {
      "decorator": {
        pattern: /@[$\w\xA0-\uFFFF]+/,
        inside: {
          "at": {
            pattern: /^@/,
            alias: "operator"
          },
          "function": /^[\s\S]+/
        }
      },
      "generic-function": {
        // e.g. foo<T extends "bar" | "baz">( ...
        pattern: /#?(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*\s*<(?:[^<>]|<(?:[^<>]|<[^<>]*>)*>)*>(?=\s*\()/,
        greedy: true,
        inside: {
          "function": /^#?(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*/,
          "generic": {
            pattern: /<[\s\S]+/,
            // everything after the first <
            alias: "class-name",
            inside: typeInside
          }
        }
      }
    });
    Prism2.languages.ts = Prism2.languages.typescript;
  })(Prism);

  // node_modules/prismjs/components/prism-java.js
  (function(Prism2) {
    var keywords = /\b(?:abstract|assert|boolean|break|byte|case|catch|char|class|const|continue|default|do|double|else|enum|exports|extends|final|finally|float|for|goto|if|implements|import|instanceof|int|interface|long|module|native|new|non-sealed|null|open|opens|package|permits|private|protected|provides|public|record(?!\s*[(){}[\]<>=%~.:,;?+\-*/&|^])|requires|return|sealed|short|static|strictfp|super|switch|synchronized|this|throw|throws|to|transient|transitive|try|uses|var|void|volatile|while|with|yield)\b/;
    var classNamePrefix = /(?:[a-z]\w*\s*\.\s*)*(?:[A-Z]\w*\s*\.\s*)*/.source;
    var className = {
      pattern: RegExp(/(^|[^\w.])/.source + classNamePrefix + /[A-Z](?:[\d_A-Z]*[a-z]\w*)?\b/.source),
      lookbehind: true,
      inside: {
        "namespace": {
          pattern: /^[a-z]\w*(?:\s*\.\s*[a-z]\w*)*(?:\s*\.)?/,
          inside: {
            "punctuation": /\./
          }
        },
        "punctuation": /\./
      }
    };
    Prism2.languages.java = Prism2.languages.extend("clike", {
      "string": {
        pattern: /(^|[^\\])"(?:\\.|[^"\\\r\n])*"/,
        lookbehind: true,
        greedy: true
      },
      "class-name": [
        className,
        {
          // variables, parameters, and constructor references
          // this to support class names (or generic parameters) which do not contain a lower case letter (also works for methods)
          pattern: RegExp(/(^|[^\w.])/.source + classNamePrefix + /[A-Z]\w*(?=\s+\w+\s*[;,=()]|\s*(?:\[[\s,]*\]\s*)?::\s*new\b)/.source),
          lookbehind: true,
          inside: className.inside
        },
        {
          // class names based on keyword
          // this to support class names (or generic parameters) which do not contain a lower case letter (also works for methods)
          pattern: RegExp(/(\b(?:class|enum|extends|implements|instanceof|interface|new|record|throws)\s+)/.source + classNamePrefix + /[A-Z]\w*\b/.source),
          lookbehind: true,
          inside: className.inside
        }
      ],
      "keyword": keywords,
      "function": [
        Prism2.languages.clike.function,
        {
          pattern: /(::\s*)[a-z_]\w*/,
          lookbehind: true
        }
      ],
      "number": /\b0b[01][01_]*L?\b|\b0x(?:\.[\da-f_p+-]+|[\da-f_]+(?:\.[\da-f_p+-]+)?)\b|(?:\b\d[\d_]*(?:\.[\d_]*)?|\B\.\d[\d_]*)(?:e[+-]?\d[\d_]*)?[dfl]?/i,
      "operator": {
        pattern: /(^|[^.])(?:<<=?|>>>?=?|->|--|\+\+|&&|\|\||::|[?:~]|[-+*/%&|^!=<>]=?)/m,
        lookbehind: true
      },
      "constant": /\b[A-Z][A-Z_\d]+\b/
    });
    Prism2.languages.insertBefore("java", "string", {
      "triple-quoted-string": {
        // http://openjdk.java.net/jeps/355#Description
        pattern: /"""[ \t]*[\r\n](?:(?:"|"")?(?:\\.|[^"\\]))*"""/,
        greedy: true,
        alias: "string"
      },
      "char": {
        pattern: /'(?:\\.|[^'\\\r\n]){1,6}'/,
        greedy: true
      }
    });
    Prism2.languages.insertBefore("java", "class-name", {
      "annotation": {
        pattern: /(^|[^.])@\w+(?:\s*\.\s*\w+)*/,
        lookbehind: true,
        alias: "punctuation"
      },
      "generics": {
        pattern: /<(?:[\w\s,.?]|&(?!&)|<(?:[\w\s,.?]|&(?!&)|<(?:[\w\s,.?]|&(?!&)|<(?:[\w\s,.?]|&(?!&))*>)*>)*>)*>/,
        inside: {
          "class-name": className,
          "keyword": keywords,
          "punctuation": /[<>(),.:]/,
          "operator": /[?&|]/
        }
      },
      "import": [
        {
          pattern: RegExp(/(\bimport\s+)/.source + classNamePrefix + /(?:[A-Z]\w*|\*)(?=\s*;)/.source),
          lookbehind: true,
          inside: {
            "namespace": className.inside.namespace,
            "punctuation": /\./,
            "operator": /\*/,
            "class-name": /\w+/
          }
        },
        {
          pattern: RegExp(/(\bimport\s+static\s+)/.source + classNamePrefix + /(?:\w+|\*)(?=\s*;)/.source),
          lookbehind: true,
          alias: "static",
          inside: {
            "namespace": className.inside.namespace,
            "static": /\b\w+$/,
            "punctuation": /\./,
            "operator": /\*/,
            "class-name": /\w+/
          }
        }
      ],
      "namespace": {
        pattern: RegExp(
          /(\b(?:exports|import(?:\s+static)?|module|open|opens|package|provides|requires|to|transitive|uses|with)\s+)(?!<keyword>)[a-z]\w*(?:\.[a-z]\w*)*\.?/.source.replace(/<keyword>/g, function() {
            return keywords.source;
          })
        ),
        lookbehind: true,
        inside: {
          "punctuation": /\./
        }
      }
    });
  })(Prism);

  // node_modules/prismjs/components/prism-cpp.js
  (function(Prism2) {
    var keyword = /\b(?:alignas|alignof|asm|auto|bool|break|case|catch|char|char16_t|char32_t|char8_t|class|co_await|co_return|co_yield|compl|concept|const|const_cast|consteval|constexpr|constinit|continue|decltype|default|delete|do|double|dynamic_cast|else|enum|explicit|export|extern|final|float|for|friend|goto|if|import|inline|int|int16_t|int32_t|int64_t|int8_t|long|module|mutable|namespace|new|noexcept|nullptr|operator|override|private|protected|public|register|reinterpret_cast|requires|return|short|signed|sizeof|static|static_assert|static_cast|struct|switch|template|this|thread_local|throw|try|typedef|typeid|typename|uint16_t|uint32_t|uint64_t|uint8_t|union|unsigned|using|virtual|void|volatile|wchar_t|while)\b/;
    var modName = /\b(?!<keyword>)\w+(?:\s*\.\s*\w+)*\b/.source.replace(/<keyword>/g, function() {
      return keyword.source;
    });
    Prism2.languages.cpp = Prism2.languages.extend("c", {
      "class-name": [
        {
          pattern: RegExp(/(\b(?:class|concept|enum|struct|typename)\s+)(?!<keyword>)\w+/.source.replace(/<keyword>/g, function() {
            return keyword.source;
          })),
          lookbehind: true
        },
        // This is intended to capture the class name of method implementations like:
        //   void foo::bar() const {}
        // However! The `foo` in the above example could also be a namespace, so we only capture the class name if
        // it starts with an uppercase letter. This approximation should give decent results.
        /\b[A-Z]\w*(?=\s*::\s*\w+\s*\()/,
        // This will capture the class name before destructors like:
        //   Foo::~Foo() {}
        /\b[A-Z_]\w*(?=\s*::\s*~\w+\s*\()/i,
        // This also intends to capture the class name of method implementations but here the class has template
        // parameters, so it can't be a namespace (until C++ adds generic namespaces).
        /\b\w+(?=\s*<(?:[^<>]|<(?:[^<>]|<[^<>]*>)*>)*>\s*::\s*\w+\s*\()/
      ],
      "keyword": keyword,
      "number": {
        pattern: /(?:\b0b[01']+|\b0x(?:[\da-f']+(?:\.[\da-f']*)?|\.[\da-f']+)(?:p[+-]?[\d']+)?|(?:\b[\d']+(?:\.[\d']*)?|\B\.[\d']+)(?:e[+-]?[\d']+)?)[ful]{0,4}/i,
        greedy: true
      },
      "operator": />>=?|<<=?|->|--|\+\+|&&|\|\||[?:~]|<=>|[-+*/%&|^!=<>]=?|\b(?:and|and_eq|bitand|bitor|not|not_eq|or|or_eq|xor|xor_eq)\b/,
      "boolean": /\b(?:false|true)\b/
    });
    Prism2.languages.insertBefore("cpp", "string", {
      "module": {
        // https://en.cppreference.com/w/cpp/language/modules
        pattern: RegExp(
          /(\b(?:import|module)\s+)/.source + "(?:" + // header-name
          /"(?:\\(?:\r\n|[\s\S])|[^"\\\r\n])*"|<[^<>\r\n]*>/.source + "|" + // module name or partition or both
          /<mod-name>(?:\s*:\s*<mod-name>)?|:\s*<mod-name>/.source.replace(/<mod-name>/g, function() {
            return modName;
          }) + ")"
        ),
        lookbehind: true,
        greedy: true,
        inside: {
          "string": /^[<"][\s\S]+/,
          "operator": /:/,
          "punctuation": /\./
        }
      },
      "raw-string": {
        pattern: /R"([^()\\ ]{0,16})\([\s\S]*?\)\1"/,
        alias: "string",
        greedy: true
      }
    });
    Prism2.languages.insertBefore("cpp", "keyword", {
      "generic-function": {
        pattern: /\b(?!operator\b)[a-z_]\w*\s*<(?:[^<>]|<[^<>]*>)*>(?=\s*\()/i,
        inside: {
          "function": /^\w+/,
          "generic": {
            pattern: /<[\s\S]+/,
            alias: "class-name",
            inside: Prism2.languages.cpp
          }
        }
      }
    });
    Prism2.languages.insertBefore("cpp", "operator", {
      "double-colon": {
        pattern: /::/,
        alias: "punctuation"
      }
    });
    Prism2.languages.insertBefore("cpp", "class-name", {
      // the base clause is an optional list of parent classes
      // https://en.cppreference.com/w/cpp/language/class
      "base-clause": {
        pattern: /(\b(?:class|struct)\s+\w+\s*:\s*)[^;{}"'\s]+(?:\s+[^;{}"'\s]+)*(?=\s*[;{])/,
        lookbehind: true,
        greedy: true,
        inside: Prism2.languages.extend("cpp", {})
      }
    });
    Prism2.languages.insertBefore("inside", "double-colon", {
      // All untokenized words that are not namespaces should be class names
      "class-name": /\b[a-z_]\w*\b(?!\s*::)/i
    }, Prism2.languages.cpp["base-clause"]);
  })(Prism);

  // node_modules/@lexical/code/LexicalCode.dev.mjs
  function hasChildDOMNodeTag(node, tagName) {
    for (const child of node.childNodes) {
      if (isHTMLElement2(child) && child.tagName === tagName) {
        return true;
      }
      hasChildDOMNodeTag(child, tagName);
    }
    return false;
  }
  var LANGUAGE_DATA_ATTRIBUTE = "data-language";
  var HIGHLIGHT_LANGUAGE_DATA_ATTRIBUTE = "data-highlight-language";
  var THEME_DATA_ATTRIBUTE = "data-theme";
  var CodeNode = class _CodeNode extends ElementNode {
    /** @internal */
    __language;
    /** @internal */
    __theme;
    /** @internal */
    __isSyntaxHighlightSupported;
    static getType() {
      return "code";
    }
    static clone(node) {
      return new _CodeNode(node.__language, node.__key);
    }
    constructor(language, key) {
      super(key);
      this.__language = language || void 0;
      this.__isSyntaxHighlightSupported = false;
      this.__theme = void 0;
    }
    afterCloneFrom(prevNode) {
      super.afterCloneFrom(prevNode);
      this.__language = prevNode.__language;
      this.__theme = prevNode.__theme;
      this.__isSyntaxHighlightSupported = prevNode.__isSyntaxHighlightSupported;
    }
    // View
    createDOM(config) {
      const element = document.createElement("code");
      addClassNamesToElement(element, config.theme.code);
      element.setAttribute("spellcheck", "false");
      const language = this.getLanguage();
      if (language) {
        element.setAttribute(LANGUAGE_DATA_ATTRIBUTE, language);
        if (this.getIsSyntaxHighlightSupported()) {
          element.setAttribute(HIGHLIGHT_LANGUAGE_DATA_ATTRIBUTE, language);
        }
      }
      const theme = this.getTheme();
      if (theme) {
        element.setAttribute(THEME_DATA_ATTRIBUTE, theme);
      }
      const style = this.getStyle();
      if (style) {
        element.setAttribute("style", style);
      }
      return element;
    }
    updateDOM(prevNode, dom, config) {
      const language = this.__language;
      const prevLanguage = prevNode.__language;
      if (language) {
        if (language !== prevLanguage) {
          dom.setAttribute(LANGUAGE_DATA_ATTRIBUTE, language);
        }
      } else if (prevLanguage) {
        dom.removeAttribute(LANGUAGE_DATA_ATTRIBUTE);
      }
      const isSyntaxHighlightSupported = this.__isSyntaxHighlightSupported;
      const prevIsSyntaxHighlightSupported = prevNode.__isSyntaxHighlightSupported;
      if (prevIsSyntaxHighlightSupported && prevLanguage) {
        if (isSyntaxHighlightSupported && language) {
          if (language !== prevLanguage) {
            dom.setAttribute(HIGHLIGHT_LANGUAGE_DATA_ATTRIBUTE, language);
          }
        } else {
          dom.removeAttribute(HIGHLIGHT_LANGUAGE_DATA_ATTRIBUTE);
        }
      } else if (isSyntaxHighlightSupported && language) {
        dom.setAttribute(HIGHLIGHT_LANGUAGE_DATA_ATTRIBUTE, language);
      }
      const theme = this.__theme;
      const prevTheme = prevNode.__theme;
      if (theme) {
        if (theme !== prevTheme) {
          dom.setAttribute(THEME_DATA_ATTRIBUTE, theme);
        }
      } else if (prevTheme) {
        dom.removeAttribute(THEME_DATA_ATTRIBUTE);
      }
      const style = this.__style;
      const prevStyle = prevNode.__style;
      if (style) {
        if (style !== prevStyle) {
          dom.setAttribute("style", style);
        }
      } else if (prevStyle) {
        dom.removeAttribute("style");
      }
      return false;
    }
    exportDOM(editor) {
      const element = document.createElement("pre");
      addClassNamesToElement(element, editor._config.theme.code);
      element.setAttribute("spellcheck", "false");
      const language = this.getLanguage();
      if (language) {
        element.setAttribute(LANGUAGE_DATA_ATTRIBUTE, language);
        if (this.getIsSyntaxHighlightSupported()) {
          element.setAttribute(HIGHLIGHT_LANGUAGE_DATA_ATTRIBUTE, language);
        }
      }
      const theme = this.getTheme();
      if (theme) {
        element.setAttribute(THEME_DATA_ATTRIBUTE, theme);
      }
      const style = this.getStyle();
      if (style) {
        element.setAttribute("style", style);
      }
      return {
        element
      };
    }
    static importDOM() {
      return {
        // Typically <pre> is used for code blocks, and <code> for inline code styles
        // but if it's a multi line <code> we'll create a block. Pass through to
        // inline format handled by TextNode otherwise.
        code: (node) => {
          const isMultiLine = node.textContent != null && (/\r?\n/.test(node.textContent) || hasChildDOMNodeTag(node, "BR"));
          return isMultiLine ? {
            conversion: $convertPreElement,
            priority: 1
          } : null;
        },
        div: () => ({
          conversion: $convertDivElement,
          priority: 1
        }),
        pre: () => ({
          conversion: $convertPreElement,
          priority: 0
        }),
        table: (node) => {
          const table = node;
          if (isGitHubCodeTable(table)) {
            return {
              conversion: $convertTableElement,
              priority: 3
            };
          }
          return null;
        },
        td: (node) => {
          const td = node;
          const table = td.closest("table");
          if (isGitHubCodeCell(td) || table && isGitHubCodeTable(table)) {
            return {
              conversion: convertCodeNoop,
              priority: 3
            };
          }
          return null;
        },
        tr: (node) => {
          const tr2 = node;
          const table = tr2.closest("table");
          if (table && isGitHubCodeTable(table)) {
            return {
              conversion: convertCodeNoop,
              priority: 3
            };
          }
          return null;
        }
      };
    }
    static importJSON(serializedNode) {
      return $createCodeNode().updateFromJSON(serializedNode);
    }
    updateFromJSON(serializedNode) {
      return super.updateFromJSON(serializedNode).setLanguage(serializedNode.language).setTheme(serializedNode.theme);
    }
    exportJSON() {
      return {
        ...super.exportJSON(),
        language: this.getLanguage(),
        theme: this.getTheme()
      };
    }
    // Mutation
    insertNewAfter(selection, restoreSelection = true) {
      const children = this.getChildren();
      const childrenLength = children.length;
      if (childrenLength >= 2 && children[childrenLength - 1].getTextContent() === "\n" && children[childrenLength - 2].getTextContent() === "\n" && selection.isCollapsed() && selection.anchor.key === this.__key && selection.anchor.offset === childrenLength) {
        children[childrenLength - 1].remove();
        children[childrenLength - 2].remove();
        const newElement = $createParagraphNode();
        this.insertAfter(newElement, restoreSelection);
        return newElement;
      }
      const {
        anchor,
        focus
      } = selection;
      const firstPoint = anchor.isBefore(focus) ? anchor : focus;
      const firstSelectionNode = firstPoint.getNode();
      if ($isTextNode(firstSelectionNode)) {
        let node = $getFirstCodeNodeOfLine(firstSelectionNode);
        const insertNodes = [];
        while (true) {
          if ($isTabNode(node)) {
            insertNodes.push($createTabNode());
            node = node.getNextSibling();
          } else if ($isCodeHighlightNode(node)) {
            let spaces = 0;
            const text = node.getTextContent();
            const textSize = node.getTextContentSize();
            while (spaces < textSize && text[spaces] === " ") {
              spaces++;
            }
            if (spaces !== 0) {
              insertNodes.push($createCodeHighlightNode(" ".repeat(spaces)));
            }
            if (spaces !== textSize) {
              break;
            }
            node = node.getNextSibling();
          } else {
            break;
          }
        }
        const split = firstSelectionNode.splitText(anchor.offset)[0];
        const x4 = anchor.offset === 0 ? 0 : 1;
        const index = split.getIndexWithinParent() + x4;
        const codeNode = firstSelectionNode.getParentOrThrow();
        const nodesToInsert = [$createLineBreakNode(), ...insertNodes];
        codeNode.splice(index, 0, nodesToInsert);
        const last = insertNodes[insertNodes.length - 1];
        if (last) {
          last.select();
        } else if (anchor.offset === 0) {
          split.selectPrevious();
        } else {
          split.getNextSibling().selectNext(0, 0);
        }
      }
      if ($isCodeNode(firstSelectionNode)) {
        const {
          offset
        } = selection.anchor;
        firstSelectionNode.splice(offset, 0, [$createLineBreakNode()]);
        firstSelectionNode.select(offset + 1, offset + 1);
      }
      return null;
    }
    canIndent() {
      return false;
    }
    collapseAtStart() {
      const paragraph = $createParagraphNode();
      const children = this.getChildren();
      children.forEach((child) => paragraph.append(child));
      this.replace(paragraph);
      return true;
    }
    setLanguage(language) {
      const writable = this.getWritable();
      writable.__language = language || void 0;
      return writable;
    }
    getLanguage() {
      return this.getLatest().__language;
    }
    setIsSyntaxHighlightSupported(isSupported) {
      const writable = this.getWritable();
      writable.__isSyntaxHighlightSupported = isSupported;
      return writable;
    }
    getIsSyntaxHighlightSupported() {
      return this.getLatest().__isSyntaxHighlightSupported;
    }
    setTheme(theme) {
      const writable = this.getWritable();
      writable.__theme = theme || void 0;
      return writable;
    }
    getTheme() {
      return this.getLatest().__theme;
    }
  };
  function $createCodeNode(language, theme) {
    return $create(CodeNode).setLanguage(language).setTheme(theme);
  }
  function $isCodeNode(node) {
    return node instanceof CodeNode;
  }
  function $convertPreElement(domNode) {
    const language = domNode.getAttribute(LANGUAGE_DATA_ATTRIBUTE);
    return {
      node: $createCodeNode(language)
    };
  }
  function $convertDivElement(domNode) {
    const div = domNode;
    const isCode = isCodeElement(div);
    if (!isCode && !isCodeChildElement(div)) {
      return {
        node: null
      };
    }
    return {
      node: isCode ? $createCodeNode() : null
    };
  }
  function $convertTableElement() {
    return {
      node: $createCodeNode()
    };
  }
  function convertCodeNoop() {
    return {
      node: null
    };
  }
  function isCodeElement(div) {
    return div.style.fontFamily.match("monospace") !== null;
  }
  function isCodeChildElement(node) {
    let parent = node.parentElement;
    while (parent !== null) {
      if (isCodeElement(parent)) {
        return true;
      }
      parent = parent.parentElement;
    }
    return false;
  }
  function isGitHubCodeCell(cell) {
    return cell.classList.contains("js-file-line");
  }
  function isGitHubCodeTable(table) {
    return table.classList.contains("js-file-line-container");
  }
  var CodeHighlightNode = class _CodeHighlightNode extends TextNode {
    /** @internal */
    __highlightType;
    constructor(text = "", highlightType, key) {
      super(text, key);
      this.__highlightType = highlightType;
    }
    static getType() {
      return "code-highlight";
    }
    static clone(node) {
      return new _CodeHighlightNode(node.__text, node.__highlightType || void 0, node.__key);
    }
    getHighlightType() {
      const self2 = this.getLatest();
      return self2.__highlightType;
    }
    setHighlightType(highlightType) {
      const self2 = this.getWritable();
      self2.__highlightType = highlightType || void 0;
      return self2;
    }
    canHaveFormat() {
      return false;
    }
    createDOM(config) {
      const element = super.createDOM(config);
      const className = getHighlightThemeClass(config.theme, this.__highlightType);
      addClassNamesToElement(element, className);
      return element;
    }
    updateDOM(prevNode, dom, config) {
      const update = super.updateDOM(prevNode, dom, config);
      const prevClassName = getHighlightThemeClass(config.theme, prevNode.__highlightType);
      const nextClassName = getHighlightThemeClass(config.theme, this.__highlightType);
      if (prevClassName !== nextClassName) {
        if (prevClassName) {
          removeClassNamesFromElement(dom, prevClassName);
        }
        if (nextClassName) {
          addClassNamesToElement(dom, nextClassName);
        }
      }
      return update;
    }
    static importJSON(serializedNode) {
      return $createCodeHighlightNode().updateFromJSON(serializedNode);
    }
    updateFromJSON(serializedNode) {
      return super.updateFromJSON(serializedNode).setHighlightType(serializedNode.highlightType);
    }
    exportJSON() {
      return {
        ...super.exportJSON(),
        highlightType: this.getHighlightType()
      };
    }
    // Prevent formatting (bold, underline, etc)
    setFormat(format) {
      return this;
    }
    isParentRequired() {
      return true;
    }
    createParentElementNode() {
      return $createCodeNode();
    }
  };
  function getHighlightThemeClass(theme, highlightType) {
    return highlightType && theme && theme.codeHighlight && theme.codeHighlight[highlightType];
  }
  function $createCodeHighlightNode(text = "", highlightType) {
    return $applyNodeReplacement(new CodeHighlightNode(text, highlightType));
  }
  function $isCodeHighlightNode(node) {
    return node instanceof CodeHighlightNode;
  }
  function $getLastMatchingCodeNode(anchor, direction) {
    let matchingNode = anchor;
    for (let caret = $getSiblingCaret(anchor, direction); caret && ($isCodeHighlightNode(caret.origin) || $isTabNode(caret.origin)); caret = $getAdjacentCaret(caret)) {
      matchingNode = caret.origin;
    }
    return matchingNode;
  }
  function $getFirstCodeNodeOfLine(anchor) {
    return $getLastMatchingCodeNode(anchor, "previous");
  }
  var CodeExtension = defineExtension({
    name: "@lexical/code",
    nodes: () => [CodeNode, CodeHighlightNode]
  });
  (function(Prism2) {
    Prism2.languages.diff = {
      "coord": [
        // Match all kinds of coord lines (prefixed by "+++", "---" or "***").
        /^(?:\*{3}|-{3}|\+{3}).*$/m,
        // Match "@@ ... @@" coord lines in unified diff.
        /^@@.*@@$/m,
        // Match coord lines in normal diff (starts with a number).
        /^\d.*$/m
      ]
      // deleted, inserted, unchanged, diff
    };
    var PREFIXES = {
      "deleted-sign": "-",
      "deleted-arrow": "<",
      "inserted-sign": "+",
      "inserted-arrow": ">",
      "unchanged": " ",
      "diff": "!"
    };
    Object.keys(PREFIXES).forEach(function(name) {
      var prefix = PREFIXES[name];
      var alias = [];
      if (!/^\w+$/.test(name)) {
        alias.push(/\w+/.exec(name)[0]);
      }
      if (name === "diff") {
        alias.push("bold");
      }
      Prism2.languages.diff[name] = {
        pattern: RegExp("^(?:[" + prefix + "].*(?:\r\n?|\n|(?![\\s\\S])))+", "m"),
        alias,
        inside: {
          "line": {
            pattern: /(.)(?=[\s\S]).*(?:\r\n?|\n)?/,
            lookbehind: true
          },
          "prefix": {
            pattern: /[\s\S]/,
            alias: /\w+/.exec(name)[0]
          }
        }
      };
    });
    Object.defineProperty(Prism2.languages.diff, "PREFIXES", {
      value: PREFIXES
    });
  })(Prism);
  var Prism$1 = globalThis.Prism || window.Prism;

  // node_modules/@lexical/code/LexicalCode.prod.mjs
  var LexicalCode_prod_exports = {};
  __export(LexicalCode_prod_exports, {
    $createCodeHighlightNode: () => rt7,
    $createCodeNode: () => U5,
    $getCodeLineDirection: () => ut6,
    $getEndOfCodeInLine: () => gt7,
    $getFirstCodeNodeOfLine: () => st7,
    $getLastCodeNodeOfLine: () => lt7,
    $getStartOfCodeInLine: () => ct6,
    $isCodeHighlightNode: () => it7,
    $isCodeNode: () => X7,
    CODE_LANGUAGE_FRIENDLY_NAME_MAP: () => pt7,
    CODE_LANGUAGE_MAP: () => ht7,
    CodeExtension: () => at6,
    CodeHighlightNode: () => et7,
    CodeNode: () => q7,
    DEFAULT_CODE_LANGUAGE: () => M5,
    PrismTokenizer: () => bt7,
    getCodeLanguageOptions: () => xt7,
    getCodeLanguages: () => yt7,
    getCodeThemeOptions: () => _t7,
    getDefaultCodeLanguage: () => J8,
    getEndOfCodeInLine: () => Dt6,
    getFirstCodeNodeOfLine: () => zt4,
    getLanguageFriendlyName: () => mt6,
    getLastCodeNodeOfLine: () => Bt5,
    getStartOfCodeInLine: () => Ft6,
    normalizeCodeLang: () => dt6,
    normalizeCodeLanguage: () => dt6,
    registerCodeHighlighting: () => Et6
  });
  var import_prismjs2 = __toESM(require_prism(), 1);
  function I5(t2, ...e2) {
    const n2 = new URL("https://lexical.dev/docs/error"), r3 = new URLSearchParams();
    r3.append("code", t2);
    for (const t3 of e2) r3.append("v", t3);
    throw n2.search = r3.toString(), Error(`Minified Lexical error #${t2}; visit ${n2.toString()} for the full message or use the non-minified dev environment for full errors and additional helpful warnings.`);
  }
  var M5 = "javascript";
  var J8 = () => M5;
  function R6(e2, n2) {
    for (const r3 of e2.childNodes) {
      if (isHTMLElement2(r3) && r3.tagName === n2) return true;
      R6(r3, n2);
    }
    return false;
  }
  var K6 = "data-language";
  var $6 = "data-highlight-language";
  var W7 = "data-theme";
  var q7 = class _q extends ElementNode {
    __language;
    __theme;
    __isSyntaxHighlightSupported;
    static getType() {
      return "code";
    }
    static clone(t2) {
      return new _q(t2.__language, t2.__key);
    }
    constructor(t2, e2) {
      super(e2), this.__language = t2 || void 0, this.__isSyntaxHighlightSupported = false, this.__theme = void 0;
    }
    afterCloneFrom(t2) {
      super.afterCloneFrom(t2), this.__language = t2.__language, this.__theme = t2.__theme, this.__isSyntaxHighlightSupported = t2.__isSyntaxHighlightSupported;
    }
    createDOM(t2) {
      const n2 = document.createElement("code");
      addClassNamesToElement(n2, t2.theme.code), n2.setAttribute("spellcheck", "false");
      const r3 = this.getLanguage();
      r3 && (n2.setAttribute(K6, r3), this.getIsSyntaxHighlightSupported() && n2.setAttribute($6, r3));
      const i3 = this.getTheme();
      i3 && n2.setAttribute(W7, i3);
      const o2 = this.getStyle();
      return o2 && n2.setAttribute("style", o2), n2;
    }
    updateDOM(t2, e2, n2) {
      const r3 = this.__language, i3 = t2.__language;
      r3 ? r3 !== i3 && e2.setAttribute(K6, r3) : i3 && e2.removeAttribute(K6);
      const o2 = this.__isSyntaxHighlightSupported;
      t2.__isSyntaxHighlightSupported && i3 ? o2 && r3 ? r3 !== i3 && e2.setAttribute($6, r3) : e2.removeAttribute($6) : o2 && r3 && e2.setAttribute($6, r3);
      const s4 = this.__theme, l3 = t2.__theme;
      s4 ? s4 !== l3 && e2.setAttribute(W7, s4) : l3 && e2.removeAttribute(W7);
      const u3 = this.__style, c3 = t2.__style;
      return u3 ? u3 !== c3 && e2.setAttribute("style", u3) : c3 && e2.removeAttribute("style"), false;
    }
    exportDOM(t2) {
      const n2 = document.createElement("pre");
      addClassNamesToElement(n2, t2._config.theme.code), n2.setAttribute("spellcheck", "false");
      const r3 = this.getLanguage();
      r3 && (n2.setAttribute(K6, r3), this.getIsSyntaxHighlightSupported() && n2.setAttribute($6, r3));
      const i3 = this.getTheme();
      i3 && n2.setAttribute(W7, i3);
      const o2 = this.getStyle();
      return o2 && n2.setAttribute("style", o2), { element: n2 };
    }
    static importDOM() {
      return { code: (t2) => null != t2.textContent && (/\r?\n/.test(t2.textContent) || R6(t2, "BR")) ? { conversion: Q7, priority: 1 } : null, div: () => ({ conversion: G7, priority: 1 }), pre: () => ({ conversion: Q7, priority: 0 }), table: (t2) => tt7(t2) ? { conversion: V7, priority: 3 } : null, td: (t2) => {
        const e2 = t2, n2 = e2.closest("table");
        return e2.classList.contains("js-file-line") || n2 && tt7(n2) ? { conversion: Y7, priority: 3 } : null;
      }, tr: (t2) => {
        const e2 = t2.closest("table");
        return e2 && tt7(e2) ? { conversion: Y7, priority: 3 } : null;
      } };
    }
    static importJSON(t2) {
      return U5().updateFromJSON(t2);
    }
    updateFromJSON(t2) {
      return super.updateFromJSON(t2).setLanguage(t2.language).setTheme(t2.theme);
    }
    exportJSON() {
      return { ...super.exportJSON(), language: this.getLanguage(), theme: this.getTheme() };
    }
    insertNewAfter(t2, e2 = true) {
      const n2 = this.getChildren(), r3 = n2.length;
      if (r3 >= 2 && "\n" === n2[r3 - 1].getTextContent() && "\n" === n2[r3 - 2].getTextContent() && t2.isCollapsed() && t2.anchor.key === this.__key && t2.anchor.offset === r3) {
        n2[r3 - 1].remove(), n2[r3 - 2].remove();
        const t3 = $createParagraphNode();
        return this.insertAfter(t3, e2), t3;
      }
      const { anchor: i3, focus: o2 } = t2, a3 = (i3.isBefore(o2) ? i3 : o2).getNode();
      if ($isTextNode(a3)) {
        let t3 = st7(a3);
        const e3 = [];
        for (; ; ) if ($isTabNode(t3)) e3.push($createTabNode()), t3 = t3.getNextSibling();
        else {
          if (!it7(t3)) break;
          {
            let n4 = 0;
            const r5 = t3.getTextContent(), i4 = t3.getTextContentSize();
            for (; n4 < i4 && " " === r5[n4]; ) n4++;
            if (0 !== n4 && e3.push(rt7(" ".repeat(n4))), n4 !== i4) break;
            t3 = t3.getNextSibling();
          }
        }
        const n3 = a3.splitText(i3.offset)[0], r4 = 0 === i3.offset ? 0 : 1, o3 = n3.getIndexWithinParent() + r4, s4 = a3.getParentOrThrow(), l3 = [$createLineBreakNode(), ...e3];
        s4.splice(o3, 0, l3);
        const f3 = e3[e3.length - 1];
        f3 ? f3.select() : 0 === i3.offset ? n3.selectPrevious() : n3.getNextSibling().selectNext(0, 0);
      }
      if (X7(a3)) {
        const { offset: e3 } = t2.anchor;
        a3.splice(e3, 0, [$createLineBreakNode()]), a3.select(e3 + 1, e3 + 1);
      }
      return null;
    }
    canIndent() {
      return false;
    }
    collapseAtStart() {
      const t2 = $createParagraphNode();
      return this.getChildren().forEach((e2) => t2.append(e2)), this.replace(t2), true;
    }
    setLanguage(t2) {
      const e2 = this.getWritable();
      return e2.__language = t2 || void 0, e2;
    }
    getLanguage() {
      return this.getLatest().__language;
    }
    setIsSyntaxHighlightSupported(t2) {
      const e2 = this.getWritable();
      return e2.__isSyntaxHighlightSupported = t2, e2;
    }
    getIsSyntaxHighlightSupported() {
      return this.getLatest().__isSyntaxHighlightSupported;
    }
    setTheme(t2) {
      const e2 = this.getWritable();
      return e2.__theme = t2 || void 0, e2;
    }
    getTheme() {
      return this.getLatest().__theme;
    }
  };
  function U5(t2, e2) {
    return $create(q7).setLanguage(t2).setTheme(e2);
  }
  function X7(t2) {
    return t2 instanceof q7;
  }
  function Q7(t2) {
    return { node: U5(t2.getAttribute(K6)) };
  }
  function G7(t2) {
    const e2 = t2, n2 = Z7(e2);
    return n2 || (function(t3) {
      let e3 = t3.parentElement;
      for (; null !== e3; ) {
        if (Z7(e3)) return true;
        e3 = e3.parentElement;
      }
      return false;
    })(e2) ? { node: n2 ? U5() : null } : { node: null };
  }
  function V7() {
    return { node: U5() };
  }
  function Y7() {
    return { node: null };
  }
  function Z7(t2) {
    return null !== t2.style.fontFamily.match("monospace");
  }
  function tt7(t2) {
    return t2.classList.contains("js-file-line-container");
  }
  var et7 = class _et extends TextNode {
    __highlightType;
    constructor(t2 = "", e2, n2) {
      super(t2, n2), this.__highlightType = e2;
    }
    static getType() {
      return "code-highlight";
    }
    static clone(t2) {
      return new _et(t2.__text, t2.__highlightType || void 0, t2.__key);
    }
    getHighlightType() {
      return this.getLatest().__highlightType;
    }
    setHighlightType(t2) {
      const e2 = this.getWritable();
      return e2.__highlightType = t2 || void 0, e2;
    }
    canHaveFormat() {
      return false;
    }
    createDOM(t2) {
      const n2 = super.createDOM(t2), r3 = nt7(t2.theme, this.__highlightType);
      return addClassNamesToElement(n2, r3), n2;
    }
    updateDOM(t2, r3, i3) {
      const o2 = super.updateDOM(t2, r3, i3), s4 = nt7(i3.theme, t2.__highlightType), l3 = nt7(i3.theme, this.__highlightType);
      return s4 !== l3 && (s4 && removeClassNamesFromElement(r3, s4), l3 && addClassNamesToElement(r3, l3)), o2;
    }
    static importJSON(t2) {
      return rt7().updateFromJSON(t2);
    }
    updateFromJSON(t2) {
      return super.updateFromJSON(t2).setHighlightType(t2.highlightType);
    }
    exportJSON() {
      return { ...super.exportJSON(), highlightType: this.getHighlightType() };
    }
    setFormat(t2) {
      return this;
    }
    isParentRequired() {
      return true;
    }
    createParentElementNode() {
      return U5();
    }
  };
  function nt7(t2, e2) {
    return e2 && t2 && t2.codeHighlight && t2.codeHighlight[e2];
  }
  function rt7(t2 = "", e2) {
    return $applyNodeReplacement(new et7(t2, e2));
  }
  function it7(t2) {
    return t2 instanceof et7;
  }
  function ot7(t2, e2) {
    let n2 = t2;
    for (let i3 = $getSiblingCaret(t2, e2); i3 && (it7(i3.origin) || $isTabNode(i3.origin)); i3 = $getAdjacentCaret(i3)) n2 = i3.origin;
    return n2;
  }
  function st7(t2) {
    return ot7(t2, "previous");
  }
  function lt7(t2) {
    return ot7(t2, "next");
  }
  function ut6(t2) {
    const e2 = st7(t2), n2 = lt7(t2);
    let r3 = e2;
    for (; null !== r3; ) {
      if (it7(r3)) {
        const t3 = getTextDirection(r3.getTextContent());
        if (null !== t3) return t3;
      }
      if (r3 === n2) break;
      r3 = r3.getNextSibling();
    }
    const i3 = e2.getParent();
    if ($isElementNode(i3)) {
      const t3 = i3.getDirection();
      if ("ltr" === t3 || "rtl" === t3) return t3;
    }
    return null;
  }
  function ct6(t2, e2) {
    let n2 = null, r3 = null, i3 = t2, o2 = e2, s4 = t2.getTextContent();
    for (; ; ) {
      if (0 === o2) {
        if (i3 = i3.getPreviousSibling(), null === i3) break;
        if (it7(i3) || $isTabNode(i3) || $isLineBreakNode(i3) || I5(167), $isLineBreakNode(i3)) {
          n2 = { node: i3, offset: 1 };
          break;
        }
        o2 = Math.max(0, i3.getTextContentSize() - 1), s4 = i3.getTextContent();
      } else o2--;
      const t3 = s4[o2];
      it7(i3) && " " !== t3 && (r3 = { node: i3, offset: o2 });
    }
    if (null !== r3) return r3;
    let l3 = null;
    if (e2 < t2.getTextContentSize()) it7(t2) && (l3 = t2.getTextContent()[e2]);
    else {
      const e3 = t2.getNextSibling();
      it7(e3) && (l3 = e3.getTextContent()[0]);
    }
    if (null !== l3 && " " !== l3) return n2;
    {
      const r4 = (function(t3, e3) {
        let n3 = t3, r5 = e3, i4 = t3.getTextContent(), o3 = t3.getTextContentSize();
        for (; ; ) {
          if (!it7(n3) || r5 === o3) {
            if (n3 = n3.getNextSibling(), null === n3 || $isLineBreakNode(n3)) return null;
            it7(n3) && (r5 = 0, i4 = n3.getTextContent(), o3 = n3.getTextContentSize());
          }
          if (it7(n3)) {
            if (" " !== i4[r5]) return { node: n3, offset: r5 };
            r5++;
          }
        }
      })(t2, e2);
      return null !== r4 ? r4 : n2;
    }
  }
  function gt7(t2) {
    const e2 = lt7(t2);
    return $isLineBreakNode(e2) && I5(168), e2;
  }
  var at6 = defineExtension({ name: "@lexical/code", nodes: () => [q7, et7] });
  !(function(t2) {
    t2.languages.diff = { coord: [/^(?:\*{3}|-{3}|\+{3}).*$/m, /^@@.*@@$/m, /^\d.*$/m] };
    var e2 = { "deleted-sign": "-", "deleted-arrow": "<", "inserted-sign": "+", "inserted-arrow": ">", unchanged: " ", diff: "!" };
    Object.keys(e2).forEach(function(n2) {
      var r3 = e2[n2], i3 = [];
      /^\w+$/.test(n2) || i3.push(/\w+/.exec(n2)[0]), "diff" === n2 && i3.push("bold"), t2.languages.diff[n2] = { pattern: RegExp("^(?:[" + r3 + "].*(?:\r\n?|\n|(?![\\s\\S])))+", "m"), alias: i3, inside: { line: { pattern: /(.)(?=[\s\S]).*(?:\r\n?|\n)?/, lookbehind: true }, prefix: { pattern: /[\s\S]/, alias: /\w+/.exec(n2)[0] } } };
    }), Object.defineProperty(t2.languages.diff, "PREFIXES", { value: e2 });
  })(Prism);
  var ft6 = globalThis.Prism || window.Prism;
  var pt7 = { c: "C", clike: "C-like", cpp: "C++", css: "CSS", html: "HTML", java: "Java", js: "JavaScript", markdown: "Markdown", objc: "Objective-C", plain: "Plain Text", powershell: "PowerShell", py: "Python", rust: "Rust", sql: "SQL", swift: "Swift", typescript: "TypeScript", xml: "XML" };
  var ht7 = { cpp: "cpp", java: "java", javascript: "js", md: "markdown", plaintext: "plain", python: "py", text: "plain", ts: "typescript" };
  function dt6(t2) {
    return ht7[t2] || t2;
  }
  function mt6(t2) {
    const e2 = dt6(t2);
    return pt7[e2] || e2;
  }
  var yt7 = () => Object.keys(ft6.languages).filter((t2) => "function" != typeof ft6.languages[t2]).sort();
  function xt7() {
    const t2 = [];
    for (const [e2, n2] of Object.entries(pt7)) t2.push([e2, n2]);
    return t2;
  }
  function _t7() {
    return [];
  }
  function St7(t2) {
    return "string" == typeof t2 ? t2 : Array.isArray(t2) ? t2.map(St7).join("") : St7(t2.content);
  }
  function vt7(t2, e2) {
    const n2 = /^diff-([\w-]+)/i.exec(e2), r3 = t2.getTextContent();
    let i3 = ft6.tokenize(r3, ft6.languages[n2 ? "diff" : e2]);
    return n2 && (i3 = (function(t3, e3) {
      const n3 = e3, r4 = ft6.languages[n3], i4 = { tokens: t3 }, o2 = ft6.languages.diff.PREFIXES;
      for (const t4 of i4.tokens) {
        if ("string" == typeof t4 || !(t4.type in o2) || !Array.isArray(t4.content)) continue;
        const e4 = t4.type;
        let n4 = 0;
        const i5 = () => (n4++, new ft6.Token("prefix", o2[e4], e4.replace(/^(\w+).*/, "$1"))), s4 = t4.content.filter((t5) => "string" == typeof t5 || "prefix" !== t5.type), l3 = t4.content.length - s4.length, u3 = ft6.tokenize(St7(s4), r4);
        u3.unshift(i5());
        const c3 = /\r\n|\n/g, g3 = (t5) => {
          const e5 = [];
          c3.lastIndex = 0;
          let r5, o3 = 0;
          for (; n4 < l3 && (r5 = c3.exec(t5)); ) {
            const n5 = r5.index + r5[0].length;
            e5.push(t5.slice(o3, n5)), o3 = n5, e5.push(i5());
          }
          if (0 !== e5.length) return o3 < t5.length && e5.push(t5.slice(o3)), e5;
        }, a3 = (t5) => {
          for (let e5 = 0; e5 < t5.length && n4 < l3; e5++) {
            const n5 = t5[e5];
            if ("string" == typeof n5) {
              const r5 = g3(n5);
              r5 && (t5.splice(e5, 1, ...r5), e5 += r5.length - 1);
            } else if ("string" == typeof n5.content) {
              const t6 = g3(n5.content);
              t6 && (n5.content = t6);
            } else Array.isArray(n5.content) ? a3(n5.content) : a3([n5.content]);
          }
        };
        a3(u3), n4 < l3 && u3.push(i5()), t4.content = u3;
      }
      return i4.tokens;
    })(i3, n2[1])), Tt7(i3);
  }
  function Tt7(t2, e2) {
    const n2 = [];
    for (const r3 of t2) if ("string" == typeof r3) {
      const t3 = r3.split(/(\n|\t)/), i3 = t3.length;
      for (let r4 = 0; r4 < i3; r4++) {
        const i4 = t3[r4];
        "\n" === i4 || "\r\n" === i4 ? n2.push($createLineBreakNode()) : "	" === i4 ? n2.push($createTabNode()) : i4.length > 0 && n2.push(rt7(i4, e2));
      }
    } else {
      const { content: t3, alias: e3 } = r3;
      "string" == typeof t3 ? n2.push(...Tt7([t3], "prefix" === r3.type && "string" == typeof e3 ? e3 : r3.type)) : Array.isArray(t3) && n2.push(...Tt7(t3, "unchanged" === r3.type ? void 0 : r3.type));
    }
    return n2;
  }
  var bt7 = { $tokenize(t2, e2) {
    return vt7(t2, e2 || this.defaultLanguage);
  }, defaultLanguage: M5, tokenize(t2, e2) {
    return ft6.tokenize(t2, ft6.languages[e2 || ""] || ft6.languages[this.defaultLanguage]);
  } };
  function Ct7(t2, e2, n2) {
    const r3 = t2.getParent();
    X7(r3) ? wt6(r3, e2, n2) : it7(t2) && t2.replace($createTextNode(t2.__text));
  }
  function Nt7(t2, e2) {
    const n2 = e2.getElementByKey(t2.getKey());
    if (null === n2) return;
    const r3 = t2.getChildren(), i3 = r3.length;
    if (i3 === n2.__cachedChildrenLength) return;
    n2.__cachedChildrenLength = i3;
    let o2 = "1", s4 = 1;
    for (let t3 = 0; t3 < i3; t3++) $isLineBreakNode(r3[t3]) && (o2 += "\n" + ++s4);
    n2.setAttribute("data-gutter", o2);
  }
  var jt5 = /* @__PURE__ */ new Set();
  function wt6(t2, e2, n2) {
    const r3 = t2.getKey(), i3 = e2.getKey() + "/" + r3;
    void 0 === t2.getLanguage() && t2.setLanguage(n2.defaultLanguage);
    const o2 = t2.getLanguage() || n2.defaultLanguage;
    if (!(function(t3) {
      const e3 = (function(t4) {
        const e4 = /^diff-([\w-]+)/i.exec(t4);
        return e4 ? e4[1] : null;
      })(t3), n3 = e3 || t3;
      try {
        return !!n3 && ft6.languages.hasOwnProperty(n3);
      } catch (t4) {
        return false;
      }
    })(o2)) return t2.getIsSyntaxHighlightSupported() && t2.setIsSyntaxHighlightSupported(false), void (async function() {
    })();
    t2.getIsSyntaxHighlightSupported() || t2.setIsSyntaxHighlightSupported(true), jt5.has(i3) || (jt5.add(i3), e2.update(() => {
      !(function(t3, e3) {
        const n3 = $getNodeByKey(t3);
        if (!X7(n3) || !n3.isAttached()) return;
        const r4 = $getSelection();
        if (!$isRangeSelection(r4)) return void e3();
        const i4 = r4.anchor, o3 = i4.offset, s4 = "element" === i4.type && $isLineBreakNode(n3.getChildAtIndex(i4.offset - 1));
        let u3 = 0;
        if (!s4) {
          const t4 = i4.getNode();
          u3 = o3 + t4.getPreviousSiblings().reduce((t5, e4) => t5 + e4.getTextContentSize(), 0);
        }
        if (!e3()) return;
        if (s4) return void i4.getNode().select(o3, o3);
        n3.getChildren().some((t4) => {
          const e4 = $isTextNode(t4);
          if (e4 || $isLineBreakNode(t4)) {
            const n4 = t4.getTextContentSize();
            if (e4 && n4 >= u3) return t4.select(u3, u3), true;
            u3 -= n4;
          }
          return false;
        });
      })(r3, () => {
        const e3 = $getNodeByKey(r3);
        if (!X7(e3) || !e3.isAttached()) return false;
        const i4 = e3.getLanguage() || n2.defaultLanguage, o3 = n2.$tokenize(e3, i4), s4 = (function(t3, e4) {
          let n3 = 0;
          for (; n3 < t3.length && kt7(t3[n3], e4[n3]); ) n3++;
          const r4 = t3.length, i5 = e4.length, o4 = Math.min(r4, i5) - n3;
          let s5 = 0;
          for (; s5 < o4; ) if (s5++, !kt7(t3[r4 - s5], e4[i5 - s5])) {
            s5--;
            break;
          }
          const l4 = n3, u4 = r4 - s5, c4 = e4.slice(n3, i5 - s5);
          return { from: l4, nodesForReplacement: c4, to: u4 };
        })(e3.getChildren(), o3), { from: l3, to: u3, nodesForReplacement: c3 } = s4;
        return !(l3 === u3 && !c3.length) && (t2.splice(l3, u3 - l3, c3), true);
      });
    }, { onUpdate: () => {
      jt5.delete(i3);
    }, skipTransforms: true }));
  }
  function kt7(t2, e2) {
    return it7(t2) && it7(e2) && t2.__text === e2.__text && t2.__highlightType === e2.__highlightType || $isTabNode(t2) && $isTabNode(e2) || $isLineBreakNode(t2) && $isLineBreakNode(e2);
  }
  function At7(t2) {
    if (!$isRangeSelection(t2)) return false;
    const e2 = t2.anchor.getNode(), n2 = X7(e2) ? e2 : e2.getParent(), r3 = t2.focus.getNode(), i3 = X7(r3) ? r3 : r3.getParent();
    return X7(n2) && n2.is(i3);
  }
  function Pt7(t2) {
    const e2 = t2.getNodes(), n2 = [];
    if (1 === e2.length && X7(e2[0])) return n2;
    let r3 = [];
    for (let t3 = 0; t3 < e2.length; t3++) {
      const i3 = e2[t3];
      it7(i3) || $isTabNode(i3) || $isLineBreakNode(i3) || I5(169), $isLineBreakNode(i3) ? r3.length > 0 && (n2.push(r3), r3 = []) : r3.push(i3);
    }
    if (r3.length > 0) {
      const e3 = t2.isBackward() ? t2.anchor : t2.focus, i3 = $createPoint(r3[0].getKey(), 0, "text");
      e3.is(i3) || n2.push(r3);
    }
    return n2;
  }
  function Lt6(t2) {
    const e2 = $getSelection();
    if (!$isRangeSelection(e2) || !At7(e2)) return false;
    const n2 = Pt7(e2), r3 = n2.length;
    if (0 === r3 && e2.isCollapsed()) return t2 === INDENT_CONTENT_COMMAND && e2.insertNodes([$createTabNode()]), true;
    if (0 === r3 && t2 === INDENT_CONTENT_COMMAND && "\n" === e2.getTextContent()) {
      const t3 = $createTabNode(), n3 = $createLineBreakNode(), r4 = e2.isBackward() ? "previous" : "next";
      return e2.insertNodes([t3, n3]), $setSelectionFromCaretRange($getCaretRangeInDirection($getCaretRange($getTextPointCaret(t3, "next", 0), $normalizeCaret($getSiblingCaret(n3, "next"))), r4)), true;
    }
    for (let i3 = 0; i3 < r3; i3++) {
      const r4 = n2[i3];
      if (r4.length > 0) {
        let n3 = r4[0];
        if (0 === i3 && (n3 = st7(n3)), t2 === INDENT_CONTENT_COMMAND) {
          const t3 = $createTabNode();
          if (n3.insertBefore(t3), 0 === i3) {
            const r5 = e2.isBackward() ? "focus" : "anchor", i4 = $createPoint(n3.getKey(), 0, "text");
            e2[r5].is(i4) && e2[r5].set(t3.getKey(), 0, "text");
          }
        } else $isTabNode(n3) && n3.remove();
      }
    }
    return true;
  }
  function Ot6(t2, e2) {
    const n2 = $getSelection();
    if (!$isRangeSelection(n2)) return false;
    const { anchor: r3, focus: i3 } = n2, o2 = r3.offset, s4 = i3.offset, l3 = r3.getNode(), c3 = i3.getNode(), g3 = t2 === KEY_ARROW_UP_COMMAND;
    if (!At7(n2) || !it7(l3) && !$isTabNode(l3) || !it7(c3) && !$isTabNode(c3)) return false;
    if (!e2.altKey) {
      if (n2.isCollapsed()) {
        const t3 = l3.getParentOrThrow();
        if (g3 && 0 === o2 && null === l3.getPreviousSibling()) {
          if (null === t3.getPreviousSibling()) return t3.selectPrevious(), e2.preventDefault(), true;
        } else if (!g3 && o2 === l3.getTextContentSize() && null === l3.getNextSibling()) {
          if (null === t3.getNextSibling()) return t3.selectNext(), e2.preventDefault(), true;
        }
      }
      return false;
    }
    let a3, f3;
    if (l3.isBefore(c3) ? (a3 = st7(l3), f3 = lt7(c3)) : (a3 = st7(c3), f3 = lt7(l3)), null == a3 || null == f3) return false;
    const p3 = a3.getNodesBetween(f3);
    for (let t3 = 0; t3 < p3.length; t3++) {
      const e3 = p3[t3];
      if (!it7(e3) && !$isTabNode(e3) && !$isLineBreakNode(e3)) return false;
    }
    e2.preventDefault(), e2.stopPropagation();
    const h2 = g3 ? a3.getPreviousSibling() : f3.getNextSibling();
    if (!$isLineBreakNode(h2)) return true;
    const d4 = g3 ? h2.getPreviousSibling() : h2.getNextSibling();
    if (null == d4) return true;
    const m3 = it7(d4) || $isTabNode(d4) || $isLineBreakNode(d4) ? g3 ? st7(d4) : lt7(d4) : null;
    let x4 = null != m3 ? m3 : d4;
    return h2.remove(), p3.forEach((t3) => t3.remove()), t2 === KEY_ARROW_UP_COMMAND ? (p3.forEach((t3) => x4.insertBefore(t3)), x4.insertBefore(h2)) : (x4.insertAfter(h2), x4 = h2, p3.forEach((t3) => {
      x4.insertAfter(t3), x4 = t3;
    })), n2.setTextNodeRange(l3, o2, c3, s4), true;
  }
  function Ht5(t2, e2) {
    const n2 = $getSelection();
    if (!$isRangeSelection(n2)) return false;
    const { anchor: r3, focus: i3 } = n2, o2 = r3.getNode(), s4 = i3.getNode(), l3 = t2 === MOVE_TO_START;
    if (!At7(n2) || !it7(o2) && !$isTabNode(o2) || !it7(s4) && !$isTabNode(s4)) return false;
    const c3 = s4;
    if ("rtl" === ut6(c3) ? !l3 : l3) {
      const t3 = ct6(c3, i3.offset);
      if (null !== t3) {
        const { node: e3, offset: r4 } = t3;
        $isLineBreakNode(e3) ? e3.selectNext(0, 0) : n2.setTextNodeRange(e3, r4, e3, r4);
      } else c3.getParentOrThrow().selectStart();
    } else {
      gt7(c3).select();
    }
    return e2.preventDefault(), e2.stopPropagation(), true;
  }
  function Et6(t2, e2) {
    if (!t2.hasNodes([q7, et7])) throw new Error("CodeHighlightPlugin: CodeNode or CodeHighlightNode not registered on editor");
    null == e2 && (e2 = bt7);
    const n2 = [];
    return true !== t2._headless && n2.push(t2.registerMutationListener(q7, (e3) => {
      t2.getEditorState().read(() => {
        for (const [n3, r3] of e3) if ("destroyed" !== r3) {
          const e4 = $getNodeByKey(n3);
          null !== e4 && Nt7(e4, t2);
        }
      });
    }, { skipInitialization: false })), n2.push(t2.registerNodeTransform(q7, (n3) => wt6(n3, t2, e2)), t2.registerNodeTransform(TextNode, (n3) => Ct7(n3, t2, e2)), t2.registerNodeTransform(et7, (n3) => Ct7(n3, t2, e2)), t2.registerCommand(KEY_TAB_COMMAND, (e3) => {
      const n3 = (function(t3) {
        const e4 = $getSelection();
        if (!$isRangeSelection(e4) || !At7(e4)) return null;
        const n4 = t3 ? OUTDENT_CONTENT_COMMAND : INDENT_CONTENT_COMMAND, r3 = t3 ? OUTDENT_CONTENT_COMMAND : INSERT_TAB_COMMAND, i3 = e4.anchor, o2 = e4.focus;
        if (i3.is(o2)) return r3;
        const s4 = Pt7(e4);
        if (1 !== s4.length) return n4;
        const l3 = s4[0];
        let u3, c3;
        0 === l3.length && I5(285), e4.isBackward() ? (u3 = o2, c3 = i3) : (u3 = i3, c3 = o2);
        const g3 = st7(l3[0]), a3 = lt7(l3[0]), f3 = $createPoint(g3.getKey(), 0, "text"), p3 = $createPoint(a3.getKey(), a3.getTextContentSize(), "text");
        return u3.isBefore(f3) || p3.isBefore(c3) ? n4 : f3.isBefore(u3) || c3.isBefore(p3) ? r3 : n4;
      })(e3.shiftKey);
      return null !== n3 && (e3.preventDefault(), t2.dispatchCommand(n3, void 0), true);
    }, COMMAND_PRIORITY_LOW), t2.registerCommand(INSERT_TAB_COMMAND, () => !!At7($getSelection()) && ($insertNodes([$createTabNode()]), true), COMMAND_PRIORITY_LOW), t2.registerCommand(INDENT_CONTENT_COMMAND, (t3) => Lt6(INDENT_CONTENT_COMMAND), COMMAND_PRIORITY_LOW), t2.registerCommand(OUTDENT_CONTENT_COMMAND, (t3) => Lt6(OUTDENT_CONTENT_COMMAND), COMMAND_PRIORITY_LOW), t2.registerCommand(KEY_ARROW_UP_COMMAND, (t3) => {
      const e3 = $getSelection();
      if (!$isRangeSelection(e3)) return false;
      const { anchor: n3 } = e3, r3 = n3.getNode();
      return !!At7(e3) && (e3.isCollapsed() && 0 === n3.offset && null === r3.getPreviousSibling() && X7(r3.getParentOrThrow()) ? (t3.preventDefault(), true) : Ot6(KEY_ARROW_UP_COMMAND, t3));
    }, COMMAND_PRIORITY_LOW), t2.registerCommand(KEY_ARROW_DOWN_COMMAND, (t3) => {
      const e3 = $getSelection();
      if (!$isRangeSelection(e3)) return false;
      const { anchor: n3 } = e3, r3 = n3.getNode();
      return !!At7(e3) && (e3.isCollapsed() && n3.offset === r3.getTextContentSize() && null === r3.getNextSibling() && X7(r3.getParentOrThrow()) ? (t3.preventDefault(), true) : Ot6(KEY_ARROW_DOWN_COMMAND, t3));
    }, COMMAND_PRIORITY_LOW), t2.registerCommand(MOVE_TO_START, (t3) => Ht5(MOVE_TO_START, t3), COMMAND_PRIORITY_LOW), t2.registerCommand(MOVE_TO_END, (t3) => Ht5(MOVE_TO_END, t3), COMMAND_PRIORITY_LOW)), mergeRegister(...n2);
  }
  var zt4 = st7;
  var Bt5 = lt7;
  var Dt6 = gt7;
  var Ft6 = ct6;

  // node_modules/@lexical/code/LexicalCode.mjs
  var mod13 = false ? LexicalCode_dev_exports : LexicalCode_prod_exports;
  var $createCodeHighlightNode2 = mod13.$createCodeHighlightNode;
  var $createCodeNode2 = mod13.$createCodeNode;
  var $getCodeLineDirection = mod13.$getCodeLineDirection;
  var $getEndOfCodeInLine = mod13.$getEndOfCodeInLine;
  var $getFirstCodeNodeOfLine2 = mod13.$getFirstCodeNodeOfLine;
  var $getLastCodeNodeOfLine = mod13.$getLastCodeNodeOfLine;
  var $getStartOfCodeInLine = mod13.$getStartOfCodeInLine;
  var $isCodeHighlightNode2 = mod13.$isCodeHighlightNode;
  var $isCodeNode2 = mod13.$isCodeNode;
  var CODE_LANGUAGE_FRIENDLY_NAME_MAP = mod13.CODE_LANGUAGE_FRIENDLY_NAME_MAP;
  var CODE_LANGUAGE_MAP = mod13.CODE_LANGUAGE_MAP;
  var CodeExtension2 = mod13.CodeExtension;
  var CodeHighlightNode2 = mod13.CodeHighlightNode;
  var CodeNode2 = mod13.CodeNode;
  var DEFAULT_CODE_LANGUAGE = mod13.DEFAULT_CODE_LANGUAGE;
  var PrismTokenizer = mod13.PrismTokenizer;
  var getCodeLanguageOptions = mod13.getCodeLanguageOptions;
  var getCodeLanguages = mod13.getCodeLanguages;
  var getCodeThemeOptions = mod13.getCodeThemeOptions;
  var getDefaultCodeLanguage = mod13.getDefaultCodeLanguage;
  var getEndOfCodeInLine = mod13.getEndOfCodeInLine;
  var getFirstCodeNodeOfLine = mod13.getFirstCodeNodeOfLine;
  var getLanguageFriendlyName = mod13.getLanguageFriendlyName;
  var getLastCodeNodeOfLine = mod13.getLastCodeNodeOfLine;
  var getStartOfCodeInLine = mod13.getStartOfCodeInLine;
  var normalizeCodeLang = mod13.normalizeCodeLang;
  var normalizeCodeLanguage = mod13.normalizeCodeLanguage;
  var registerCodeHighlighting = mod13.registerCodeHighlighting;

  // yjs-global:yjs
  var Y8 = window.Y;
  if (!Y8) {
    console.error("[Lexical] Yjs not found. Ensure yjs.min.js is loaded first.");
  }
  var Doc = Y8?.Doc;
  var Map2 = Y8?.Map;
  var Array2 = Y8?.Array;
  var Text2 = Y8?.Text;
  var XmlFragment = Y8?.XmlFragment;
  var XmlElement = Y8?.XmlElement;
  var XmlText = Y8?.XmlText;
  var UndoManager = Y8?.UndoManager;
  var createAbsolutePositionFromRelativePosition = Y8?.createAbsolutePositionFromRelativePosition;
  var createRelativePositionFromTypeIndex = Y8?.createRelativePositionFromTypeIndex;
  var encodeStateAsUpdate = Y8?.encodeStateAsUpdate;
  var applyUpdate = Y8?.applyUpdate;
  var Snapshot = Y8?.Snapshot;
  var snapshot = Y8?.snapshot;
  var isDeleted = Y8?.isDeleted;
  var isParentOf = Y8?.isParentOf;
  var equalSnapshots = Y8?.equalSnapshots;
  var AbstractType = Y8?.AbstractType;
  var RelativePosition = Y8?.RelativePosition;
  var Item = Y8?.Item;
  var ContentType = Y8?.ContentType;
  var Transaction = Y8?.Transaction;
  var AbstractStruct = Y8?.AbstractStruct;
  var GC = Y8?.GC;
  var typeListToArraySnapshot = Y8?.typeListToArraySnapshot;
  var XmlHook = Y8?.XmlHook;
  var ContentString = Y8?.ContentString;
  var ContentFormat = Y8?.ContentFormat;
  var emptySnapshot = Y8?.emptySnapshot;
  var PermanentUserData = Y8?.PermanentUserData;
  var iterateDeletedStructs = Y8?.iterateDeletedStructs;
  var compareRelativePositions = Y8?.compareRelativePositions;
  var YMapEvent = Y8?.YMapEvent;
  var YTextEvent = Y8?.YTextEvent;
  var YXmlEvent = Y8?.YXmlEvent;

  // node_modules/@lexical/offset/LexicalOffset.prod.mjs
  var LexicalOffset_prod_exports = {};
  __export(LexicalOffset_prod_exports, {
    $createChildrenArray: () => a2,
    $createOffsetView: () => p2,
    OffsetView: () => l2,
    createChildrenArray: () => d3
  });
  function s3(t2, ...e2) {
    const n2 = new URL("https://lexical.dev/docs/error"), o2 = new URLSearchParams();
    o2.append("code", t2);
    for (const t3 of e2) o2.append("v", t3);
    throw n2.search = o2.toString(), Error(`Minified Lexical error #${t2}; visit ${n2.toString()} for the full message or use the non-minified dev environment for full errors and additional helpful warnings.`);
  }
  var l2 = class {
    _offsetMap;
    _firstNode;
    _blockOffsetSize;
    constructor(t2, e2, n2 = 1) {
      this._offsetMap = t2, this._firstNode = e2, this._blockOffsetSize = n2;
    }
    createSelectionFromOffsets(o2, s4, l3) {
      const f3 = this._firstNode;
      if (null === f3) return null;
      let c3 = o2, u3 = s4, a3 = i2(f3, c3, this._blockOffsetSize), d4 = i2(f3, u3, this._blockOffsetSize);
      if (void 0 !== l3 && (c3 = r2(c3, a3, l3, this, this._blockOffsetSize), a3 = i2(f3, c3, this._blockOffsetSize), u3 = r2(u3, d4, l3, this, this._blockOffsetSize), d4 = i2(f3, u3, this._blockOffsetSize)), null === a3 || null === d4) return null;
      let p3 = a3.key, g3 = d4.key;
      const h2 = $getNodeByKey(p3), _5 = $getNodeByKey(g3);
      if (null === h2 || null === _5) return null;
      let k4 = 0, v4 = 0, y4 = "element", x4 = "element";
      if ("text" === a3.type) {
        k4 = c3 - a3.start, y4 = "text";
        const t2 = h2.getNextSibling();
        c3 !== u3 && k4 === h2.getTextContentSize() && $isTextNode(t2) && (k4 = 0, p3 = t2.__key);
      } else "inline" === a3.type && (p3 = h2.getParentOrThrow().getKey(), k4 = u3 > a3.start ? a3.end : a3.start);
      "text" === d4.type ? (v4 = u3 - d4.start, x4 = "text") : "inline" === d4.type && (g3 = _5.getParentOrThrow().getKey(), v4 = u3 > d4.start ? d4.end : d4.start);
      const S3 = $createRangeSelection();
      return null === S3 ? null : (S3.anchor.set(p3, k4, y4), S3.focus.set(g3, v4, x4), S3);
    }
    getOffsetsFromSelection(t2) {
      const e2 = t2.anchor, n2 = t2.focus, o2 = this._offsetMap, s4 = e2.offset, l3 = n2.offset;
      let r3 = -1, i3 = -1;
      if ("text" === e2.type) {
        const t3 = o2.get(e2.key);
        void 0 !== t3 && (r3 = t3.start + s4);
      } else {
        const t3 = e2.getNode().getDescendantByIndex(s4);
        if (null !== t3) {
          const e3 = o2.get(t3.getKey());
          if (void 0 !== e3) {
            r3 = t3.getIndexWithinParent() !== s4 ? e3.end : e3.start;
          }
        }
      }
      if ("text" === n2.type) {
        const t3 = o2.get(n2.key);
        void 0 !== t3 && (i3 = t3.start + n2.offset);
      } else {
        const t3 = n2.getNode().getDescendantByIndex(l3);
        if (null !== t3) {
          const e3 = o2.get(t3.getKey());
          if (void 0 !== e3) {
            i3 = t3.getIndexWithinParent() !== l3 ? e3.end : e3.start;
          }
        }
      }
      return [r3, i3];
    }
  };
  function r2(t2, e2, n2, o2, s4) {
    const l3 = n2._offsetMap, r3 = o2._offsetMap, f3 = /* @__PURE__ */ new Set();
    let c3 = t2, u3 = e2;
    for (; null !== u3; ) {
      const t3 = u3.key, e3 = l3.get(t3), n3 = u3.end - u3.start;
      if (f3.add(t3), void 0 === e3) c3 += n3;
      else {
        const t4 = e3.end - e3.start;
        t4 !== n3 && (c3 += n3 - t4);
      }
      const o3 = u3.prev;
      if (null !== o3) {
        u3 = o3;
        continue;
      }
      let s5 = u3.parent;
      for (; null !== s5; ) {
        let t4 = s5.prev;
        if (null !== t4) {
          const e4 = t4.key, n4 = l3.get(e4), o4 = t4.end - t4.start;
          if (f3.add(e4), void 0 === n4) c3 += o4;
          else {
            const t5 = n4.end - n4.start;
            t5 !== o4 && (c3 += o4 - t5);
          }
          t4 = t4.prev;
        }
        s5 = s5.parent;
      }
      break;
    }
    const a3 = n2._firstNode;
    if (null !== a3) {
      u3 = i2(a3, t2, s4);
      let e3 = false;
      for (; null !== u3; ) {
        if (!f3.has(u3.key)) {
          e3 = true;
          break;
        }
        u3 = u3.parent;
      }
      if (!e3) for (; null !== u3; ) {
        const t3 = u3.key;
        if (!f3.has(t3)) {
          const e4 = r3.get(t3), n3 = u3.end - u3.start;
          if (void 0 === e4) c3 -= n3;
          else {
            const t4 = e4.end - e4.start;
            n3 !== t4 && (c3 += t4 - n3);
          }
        }
        u3 = u3.prev;
      }
    }
    return c3;
  }
  function i2(t2, e2, n2) {
    let o2 = t2;
    for (; null !== o2; ) {
      if (e2 < o2.end + ("element" !== o2.type || 0 === n2 ? 1 : 0)) {
        const t4 = o2.child;
        if (null !== t4) {
          o2 = t4;
          continue;
        }
        return o2;
      }
      const t3 = o2.next;
      if (null === t3) break;
      o2 = t3;
    }
    return null;
  }
  function f2(t2, e2, n2, o2, s4, l3) {
    return { child: t2, end: o2, key: s4, next: null, parent: l3, prev: null, start: n2, type: e2 };
  }
  function c2(t2, n2, l3, r3, i3, c3) {
    const d4 = r3.get(n2);
    void 0 === d4 && s3(3);
    const p3 = t2.offset;
    if ($isElementNode(d4)) {
      const e2 = a2(d4, r3), o2 = 0 === e2.length, s4 = o2 ? null : u2(t2, e2, null, r3, i3, c3);
      t2.prevIsBlock && !o2 || (t2.prevIsBlock = true, t2.offset += c3);
      const g4 = f2(s4, "element", p3, p3, n2, l3);
      null !== s4 && (s4.parent = g4);
      const h3 = t2.offset;
      return g4.end = h3, i3.set(n2, g4), g4;
    }
    t2.prevIsBlock = false;
    const g3 = $isTextNode(d4), h2 = g3 ? d4.__text.length : 1, _5 = f2(null, g3 ? "text" : "inline", p3, t2.offset += h2, n2, l3);
    return i3.set(n2, _5), _5;
  }
  function u2(t2, e2, n2, o2, s4, l3) {
    let r3 = null, i3 = null;
    const f3 = e2.length;
    for (let u3 = 0; u3 < f3; u3++) {
      const f4 = c2(t2, e2[u3], n2, o2, s4, l3);
      null === i3 ? r3 = f4 : (f4.prev = i3, i3.next = f4), i3 = f4;
    }
    return r3;
  }
  function a2(e2, n2) {
    const o2 = [];
    let l3 = e2.__first;
    for (; null !== l3; ) {
      const e3 = null === n2 ? $getNodeByKey(l3) : n2.get(l3);
      null == e3 && s3(174), o2.push(l3), l3 = e3.__next;
    }
    return o2;
  }
  var d3 = a2;
  function p2(t2, e2 = 1, n2) {
    const o2 = (n2 || t2._pendingEditorState || t2._editorState)._nodeMap, s4 = o2.get("root"), r3 = /* @__PURE__ */ new Map(), i3 = u2({ offset: 0, prevIsBlock: false }, a2(s4, o2), null, o2, r3, e2);
    return new l2(r3, i3, e2);
  }

  // node_modules/@lexical/offset/LexicalOffset.mjs
  var mod14 = false ? LexicalOffset_dev_exports : LexicalOffset_prod_exports;
  var $createChildrenArray = mod14.$createChildrenArray;
  var $createOffsetView = mod14.$createOffsetView;
  var OffsetView = mod14.OffsetView;
  var createChildrenArray = mod14.createChildrenArray;

  // node_modules/@lexical/yjs/LexicalYjs.prod.mjs
  var LexicalYjs_prod_exports = {};
  __export(LexicalYjs_prod_exports, {
    $getYChangeState: () => Ze3,
    CLEAR_DIFF_VERSIONS_COMMAND__EXPERIMENTAL: () => Et7,
    CONNECTED_COMMAND: () => Ot7,
    DIFF_VERSIONS_COMMAND__EXPERIMENTAL: () => Mt6,
    TOGGLE_CONNECT_COMMAND: () => Kt6,
    createBinding: () => le3,
    createBindingV2__EXPERIMENTAL: () => ce2,
    createUndoManager: () => Pt8,
    getAnchorAndFocusCollabNodesForUserState: () => ft7,
    initLocalState: () => Ft7,
    renderSnapshot__EXPERIMENTAL: () => et8,
    setLocalStateFocus: () => At8,
    syncCursorPositions: () => yt8,
    syncLexicalUpdateToYjs: () => St8,
    syncLexicalUpdateToYjsV2__EXPERIMENTAL: () => Ct8,
    syncYjsChangesToLexical: () => Tt8,
    syncYjsChangesToLexicalV2__EXPERIMENTAL: () => vt8,
    syncYjsStateToLexicalV2__EXPERIMENTAL: () => wt7
  });
  function V8(e2, ...t2) {
    const n2 = new URL("https://lexical.dev/docs/error"), o2 = new URLSearchParams();
    o2.append("code", e2);
    for (const e3 of t2) o2.append("v", e3);
    throw n2.search = o2.toString(), Error(`Minified Lexical error #${e2}; visit ${n2.toString()} for the full message or use the non-minified dev environment for full errors and additional helpful warnings.`);
  }
  function H8(e2, t2, n2) {
    const o2 = e2.length, s4 = t2.length;
    let i3 = 0, r3 = 0;
    for (; i3 < o2 && i3 < s4 && e2[i3] === t2[i3] && i3 < n2; ) i3++;
    for (; r3 + i3 < o2 && r3 + i3 < s4 && e2[o2 - r3 - 1] === t2[s4 - r3 - 1]; ) r3++;
    for (; r3 + i3 < o2 && r3 + i3 < s4 && e2[i3] === t2[i3]; ) i3++;
    return { index: i3, insert: t2.slice(i3, s4 - r3), remove: o2 - i3 - r3 };
  }
  var Q8 = class {
    _xmlElem;
    _key;
    _parent;
    _type;
    constructor(e2, t2, n2) {
      this._key = "", this._xmlElem = e2, this._parent = t2, this._type = n2;
    }
    getPrevNode(t2) {
      if (null === t2) return null;
      const n2 = t2.get(this._key);
      return $isDecoratorNode(n2) ? n2 : null;
    }
    getNode() {
      const n2 = $getNodeByKey(this._key);
      return $isDecoratorNode(n2) ? n2 : null;
    }
    getSharedType() {
      return this._xmlElem;
    }
    getType() {
      return this._type;
    }
    getKey() {
      return this._key;
    }
    getSize() {
      return 1;
    }
    getOffset() {
      return this._parent.getChildOffset(this);
    }
    syncPropertiesFromLexical(e2, t2, n2) {
      const o2 = this.getPrevNode(n2);
      Ne2(e2, this._xmlElem, o2, t2);
    }
    syncPropertiesFromYjs(e2, t2) {
      const n2 = this.getNode();
      null === n2 && V8(83);
      Te3(e2, this._xmlElem, n2, t2);
    }
    destroy(e2) {
      const t2 = e2.collabNodeMap;
      t2.get(this._key) === this && t2.delete(this._key);
    }
  };
  function X8(e2, t2, n2) {
    const o2 = new Q8(e2, t2, n2);
    return e2._collabNode = o2, o2;
  }
  var Z8 = class {
    _map;
    _key;
    _parent;
    _type;
    constructor(e2, t2) {
      this._key = "", this._map = e2, this._parent = t2, this._type = "linebreak";
    }
    getNode() {
      const e2 = $getNodeByKey(this._key);
      return $isLineBreakNode(e2) ? e2 : null;
    }
    getKey() {
      return this._key;
    }
    getSharedType() {
      return this._map;
    }
    getType() {
      return this._type;
    }
    getSize() {
      return 1;
    }
    getOffset() {
      return this._parent.getChildOffset(this);
    }
    destroy(e2) {
      const t2 = e2.collabNodeMap;
      t2.get(this._key) === this && t2.delete(this._key);
    }
  };
  function ee4(e2, t2) {
    const n2 = new Z8(e2, t2);
    return e2._collabNode = n2, n2;
  }
  var te4 = class {
    _map;
    _key;
    _parent;
    _text;
    _type;
    _normalized;
    constructor(e2, t2, n2, o2) {
      this._key = "", this._map = e2, this._parent = n2, this._text = t2, this._type = o2, this._normalized = false;
    }
    getPrevNode(e2) {
      if (null === e2) return null;
      const t2 = e2.get(this._key);
      return $isTextNode(t2) ? t2 : null;
    }
    getNode() {
      const e2 = $getNodeByKey(this._key);
      return $isTextNode(e2) ? e2 : null;
    }
    getSharedType() {
      return this._map;
    }
    getType() {
      return this._type;
    }
    getKey() {
      return this._key;
    }
    getSize() {
      return this._text.length + (this._normalized ? 0 : 1);
    }
    getOffset() {
      return this._parent.getChildOffset(this);
    }
    spliceText(e2, t2, n2) {
      const o2 = this._parent._xmlText, s4 = this.getOffset() + 1 + e2;
      0 !== t2 && o2.delete(s4, t2), "" !== n2 && o2.insert(s4, n2);
    }
    syncPropertiesAndTextFromLexical(e2, t2, n2) {
      const o2 = this.getPrevNode(n2), r3 = t2.__text;
      if (Ne2(e2, this._map, o2, t2), null !== o2) {
        const e3 = o2.__text;
        if (e3 !== r3) {
          !(function(e4, t3, n3, o3) {
            const r4 = $getSelection();
            let l3 = o3.length;
            if ($isRangeSelection(r4) && r4.isCollapsed()) {
              const e5 = r4.anchor;
              e5.key === t3 && (l3 = e5.offset);
            }
            const c3 = H8(n3, o3, l3);
            e4.spliceText(c3.index, c3.remove, c3.insert);
          })(this, t2.__key, e3, r3), this._text = r3;
        }
      }
    }
    syncPropertiesAndTextFromYjs(e2, t2) {
      const n2 = this.getNode();
      null === n2 && V8(84), Te3(e2, this._map, n2, t2);
      const o2 = this._text;
      n2.__text !== o2 && n2.setTextContent(o2);
    }
    destroy(e2) {
      const t2 = e2.collabNodeMap;
      t2.get(this._key) === this && t2.delete(this._key);
    }
  };
  function ne3(e2, t2, n2, o2) {
    const s4 = new te4(e2, t2, n2, o2);
    return e2._collabNode = s4, s4;
  }
  var oe3 = class _oe {
    _key;
    _children;
    _xmlText;
    _type;
    _parent;
    constructor(e2, t2, n2) {
      this._key = "", this._children = [], this._xmlText = e2, this._type = n2, this._parent = t2;
    }
    getPrevNode(e2) {
      if (null === e2) return null;
      const t2 = e2.get(this._key);
      return $isElementNode(t2) ? t2 : null;
    }
    getNode() {
      const e2 = $getNodeByKey(this._key);
      return $isElementNode(e2) ? e2 : null;
    }
    getSharedType() {
      return this._xmlText;
    }
    getType() {
      return this._type;
    }
    getKey() {
      return this._key;
    }
    isEmpty() {
      return 0 === this._children.length;
    }
    getSize() {
      return 1;
    }
    getOffset() {
      const e2 = this._parent;
      return null === e2 && V8(90), e2.getChildOffset(this);
    }
    syncPropertiesFromYjs(e2, t2) {
      const n2 = this.getNode();
      null === n2 && V8(91), Te3(e2, this._xmlText, n2, t2);
    }
    applyChildrenYjsDelta(e2, t2) {
      const n2 = this._children;
      let o2 = 0, s4 = null;
      for (let i3 = 0; i3 < t2.length; i3++) {
        const r3 = t2[i3], l3 = r3.insert, c3 = r3.delete;
        if (null != r3.retain) o2 += r3.retain;
        else if ("number" == typeof c3) {
          let e3 = c3;
          for (; e3 > 0; ) {
            const { node: t3, nodeIndex: s5, offset: i4, length: r4 } = we2(this, o2, false);
            if (t3 instanceof _oe || t3 instanceof Z8 || t3 instanceof Q8) n2.splice(s5, 1), e3 -= 1;
            else {
              if (!(t3 instanceof te4)) break;
              {
                const o3 = Math.min(e3, r4), l4 = 0 !== s5 ? n2[s5 - 1] : null, c4 = t3.getSize();
                if (0 === i4 && r4 === c4) {
                  n2.splice(s5, 1);
                  const e4 = ve3(t3._text, i4, o3 - 1, "");
                  e4.length > 0 && (l4 instanceof te4 ? l4._text += e4 : this._xmlText.delete(i4, e4.length));
                } else t3._text = ve3(t3._text, i4, o3, "");
                e3 -= o3;
              }
            }
          }
        } else {
          if (null == l3) throw new Error("Unexpected delta format");
          if ("string" == typeof l3) {
            const { node: e3, offset: t3 } = we2(this, o2, true);
            e3 instanceof te4 ? e3._text = ve3(e3._text, t3, 0, l3) : this._xmlText.delete(t3, l3.length), o2 += l3.length;
          } else {
            const t3 = l3, { node: i4, nodeIndex: r4, length: c4 } = we2(this, o2, false), a3 = me2(e2, t3, this);
            if (i4 instanceof te4 && c4 > 0 && c4 < i4._text.length) {
              const e3 = i4._text, t4 = e3.length - c4;
              i4._text = ve3(e3, t4, c4, ""), n2.splice(r4 + 1, 0, a3), s4 = ve3(e3, 0, t4, "");
            } else n2.splice(r4, 0, a3);
            null !== s4 && a3 instanceof te4 && (a3._text = s4 + a3._text, s4 = null), o2 += 1;
          }
        }
      }
    }
    syncChildrenFromYjs(e2) {
      const t2 = this.getNode();
      null === t2 && V8(92);
      const n2 = t2.__key, s4 = $createChildrenArray(t2, null), i3 = s4.length, r3 = this._children, a3 = r3.length, f3 = e2.collabNodeMap, d4 = /* @__PURE__ */ new Set();
      let u3, h2, p3 = 0, g3 = null;
      a3 !== i3 && (h2 = t2.getWritable());
      for (let i4 = 0; i4 < a3; i4++) {
        const _5 = s4[p3], y4 = r3[i4], m3 = y4.getNode(), x4 = y4._key;
        if (null !== m3 && _5 === x4) {
          const t3 = $isTextNode(m3);
          if (d4.add(_5), t3) if (y4._key = _5, y4 instanceof _oe) {
            const t4 = y4._xmlText;
            y4.syncPropertiesFromYjs(e2, null), y4.applyChildrenYjsDelta(e2, t4.toDelta()), y4.syncChildrenFromYjs(e2);
          } else y4 instanceof te4 ? y4.syncPropertiesAndTextFromYjs(e2, null) : y4 instanceof Q8 ? y4.syncPropertiesFromYjs(e2, null) : y4 instanceof Z8 || V8(93);
          g3 = m3, p3++;
        } else {
          if (void 0 === u3) {
            u3 = /* @__PURE__ */ new Set();
            for (let e3 = 0; e3 < a3; e3++) {
              const t3 = r3[e3]._key;
              "" !== t3 && u3.add(t3);
            }
          }
          if (null !== m3 && void 0 !== _5 && !u3.has(_5)) {
            const e3 = $getNodeByKeyOrThrow(_5);
            removeFromParent(e3), i4--, p3++;
            continue;
          }
          h2 = t2.getWritable();
          const o2 = xe3(e2, y4, n2), s5 = o2.__key;
          if (f3.set(s5, y4), null === g3) {
            const e3 = h2.getFirstChild();
            if (h2.__first = s5, null !== e3) {
              const t3 = e3.getWritable();
              t3.__prev = s5, o2.__next = t3.__key;
            }
          } else {
            const e3 = g3.getWritable(), t3 = g3.getNextSibling();
            if (e3.__next = s5, o2.__prev = g3.__key, null !== t3) {
              const e4 = t3.getWritable();
              e4.__prev = s5, o2.__next = e4.__key;
            }
          }
          i4 === a3 - 1 && (h2.__last = s5), h2.__size++, g3 = o2;
        }
      }
      for (let t3 = 0; t3 < i3; t3++) {
        const n3 = s4[t3];
        if (!d4.has(n3)) {
          const t4 = $getNodeByKeyOrThrow(n3), o2 = e2.collabNodeMap.get(n3);
          void 0 !== o2 && o2.destroy(e2), removeFromParent(t4);
        }
      }
    }
    syncPropertiesFromLexical(e2, t2, n2) {
      Ne2(e2, this._xmlText, this.getPrevNode(n2), t2);
    }
    _syncChildFromLexical(t2, n2, s4, i3, c3, a3) {
      const f3 = this._children[n2], d4 = $getNodeByKeyOrThrow(s4);
      f3 instanceof _oe && $isElementNode(d4) ? (f3.syncPropertiesFromLexical(t2, d4, i3), f3.syncChildrenFromLexical(t2, d4, i3, c3, a3)) : f3 instanceof te4 && $isTextNode(d4) ? f3.syncPropertiesAndTextFromLexical(t2, d4, i3) : f3 instanceof Q8 && $isDecoratorNode(d4) && f3.syncPropertiesFromLexical(t2, d4, i3);
    }
    syncChildrenFromLexical(e2, t2, n2, o2, s4) {
      const i3 = this.getPrevNode(n2), r3 = null === i3 ? [] : $createChildrenArray(i3, n2), c3 = $createChildrenArray(t2, null), a3 = r3.length - 1, f3 = c3.length - 1, d4 = e2.collabNodeMap;
      let u3, h2, p3 = 0, g3 = 0;
      for (; p3 <= a3 && g3 <= f3; ) {
        const t3 = r3[p3], i4 = c3[g3];
        if (t3 === i4) this._syncChildFromLexical(e2, g3, i4, n2, o2, s4), p3++, g3++;
        else {
          void 0 === u3 && (u3 = new Set(r3)), void 0 === h2 && (h2 = new Set(c3));
          const n3 = h2.has(t3), o3 = u3.has(i4);
          if (n3) {
            const t4 = _e2(e2, $getNodeByKeyOrThrow(i4), this);
            d4.set(i4, t4), o3 ? (this.splice(e2, g3, 1, t4), p3++, g3++) : (this.splice(e2, g3, 0, t4), g3++);
          } else this.splice(e2, g3, 1), p3++;
        }
      }
      const _5 = p3 > a3, y4 = g3 > f3;
      if (_5 && !y4) for (; g3 <= f3; ++g3) {
        const t3 = c3[g3], n3 = _e2(e2, $getNodeByKeyOrThrow(t3), this);
        this.append(n3), d4.set(t3, n3);
      }
      else if (y4 && !_5) for (let t3 = this._children.length - 1; t3 >= g3; t3--) this.splice(e2, t3, 1);
    }
    append(e2) {
      const t2 = this._xmlText, n2 = this._children, o2 = n2[n2.length - 1], s4 = void 0 !== o2 ? o2.getOffset() + o2.getSize() : 0;
      if (e2 instanceof _oe) t2.insertEmbed(s4, e2._xmlText);
      else if (e2 instanceof te4) {
        const n3 = e2._map;
        null === n3.parent && t2.insertEmbed(s4, n3), t2.insert(s4 + 1, e2._text);
      } else e2 instanceof Z8 ? t2.insertEmbed(s4, e2._map) : e2 instanceof Q8 && t2.insertEmbed(s4, e2._xmlElem);
      this._children.push(e2);
    }
    splice(e2, t2, n2, o2) {
      const s4 = this._children, i3 = s4[t2];
      if (void 0 === i3) return void 0 === o2 && V8(94), void this.append(o2);
      const r3 = i3.getOffset();
      -1 === r3 && V8(95);
      const l3 = this._xmlText;
      if (0 !== n2 && l3.delete(r3, i3.getSize()), o2 instanceof _oe) l3.insertEmbed(r3, o2._xmlText);
      else if (o2 instanceof te4) {
        const e3 = o2._map;
        null === e3.parent && l3.insertEmbed(r3, e3), l3.insert(r3 + 1, o2._text);
      } else o2 instanceof Z8 ? l3.insertEmbed(r3, o2._map) : o2 instanceof Q8 && l3.insertEmbed(r3, o2._xmlElem);
      if (0 !== n2) {
        const o3 = s4.slice(t2, t2 + n2);
        for (let t3 = 0; t3 < o3.length; t3++) o3[t3].destroy(e2);
      }
      void 0 !== o2 ? s4.splice(t2, n2, o2) : s4.splice(t2, n2);
    }
    getChildOffset(e2) {
      let t2 = 0;
      const n2 = this._children;
      for (let o2 = 0; o2 < n2.length; o2++) {
        const s4 = n2[o2];
        if (s4 === e2) return t2;
        t2 += s4.getSize();
      }
      return -1;
    }
    destroy(e2) {
      const t2 = e2.collabNodeMap, n2 = this._children;
      for (let t3 = 0; t3 < n2.length; t3++) n2[t3].destroy(e2);
      t2.get(this._key) === this && t2.delete(this._key);
    }
  };
  function se2(e2, t2, n2) {
    const o2 = new oe3(e2, t2, n2);
    return e2._collabNode = o2, o2;
  }
  var ie2 = class {
    _nodeMap = /* @__PURE__ */ new Map();
    _sharedTypeToNodeKeys = /* @__PURE__ */ new Map();
    _nodeKeyToSharedType = /* @__PURE__ */ new Map();
    set(e2, t2) {
      const n2 = t2 instanceof Array;
      this.delete(e2);
      const s4 = n2 ? t2 : [t2];
      for (const e3 of s4) {
        const t3 = e3.getKey();
        if (this._nodeKeyToSharedType.has(t3)) {
          const e4 = this._nodeKeyToSharedType.get(t3), n3 = this._sharedTypeToNodeKeys.get(e4).indexOf(t3);
          -1 !== n3 && this._sharedTypeToNodeKeys.get(e4).splice(n3, 1), this._nodeKeyToSharedType.delete(t3), this._nodeMap.delete(t3);
        }
      }
      if (e2 instanceof XmlText) {
        if (n2 || V8(331), 0 === t2.length) return;
        this._sharedTypeToNodeKeys.set(e2, t2.map((e3) => e3.getKey()));
        for (const n3 of t2) this._nodeMap.set(n3.getKey(), n3), this._nodeKeyToSharedType.set(n3.getKey(), e2);
      } else n2 && V8(332), $isTextNode(t2) && V8(333), this._sharedTypeToNodeKeys.set(e2, [t2.getKey()]), this._nodeMap.set(t2.getKey(), t2), this._nodeKeyToSharedType.set(t2.getKey(), e2);
    }
    get(e2) {
      const t2 = this._sharedTypeToNodeKeys.get(e2);
      if (void 0 !== t2) {
        if (e2 instanceof XmlText) {
          const e3 = Array.from(t2.map((e4) => this._nodeMap.get(e4)));
          return e3.length > 0 ? e3 : void 0;
        }
        return this._nodeMap.get(t2[0]);
      }
    }
    getSharedType(e2) {
      return this._nodeKeyToSharedType.get(e2.getKey());
    }
    delete(e2) {
      const t2 = this._sharedTypeToNodeKeys.get(e2);
      if (void 0 !== t2) {
        for (const e3 of t2) this._nodeMap.delete(e3), this._nodeKeyToSharedType.delete(e3);
        this._sharedTypeToNodeKeys.delete(e2);
      }
    }
    deleteNode(e2) {
      const t2 = this._nodeKeyToSharedType.get(e2);
      t2 && this.delete(t2), this._nodeMap.delete(e2);
    }
    has(e2) {
      return this._sharedTypeToNodeKeys.has(e2);
    }
    clear() {
      this._nodeMap.clear(), this._sharedTypeToNodeKeys.clear(), this._nodeKeyToSharedType.clear();
    }
  };
  function re3(e2, t2, n2, o2, s4) {
    null == n2 && V8(81);
    const i3 = { clientID: n2.clientID, cursors: /* @__PURE__ */ new Map(), cursorsContainer: null, doc: n2, docMap: o2, editor: e2, excludedProperties: s4 || /* @__PURE__ */ new Map(), id: t2, nodeProperties: /* @__PURE__ */ new Map() };
    return (function(e3) {
      const { editor: t3, nodeProperties: n3 } = e3;
      t3.update(() => {
        t3._nodes.forEach((t4) => {
          const o3 = new t4.klass(), s5 = {};
          for (const [t5, n4] of Object.entries(o3)) pe2(t5, o3, e3) || (s5[t5] = n4);
          n3.set(o3.__type, Object.freeze(s5));
        });
      });
    })(i3), i3;
  }
  function le3(e2, t2, n2, o2, s4, i3) {
    null == o2 && V8(81);
    const r3 = se2(o2.get("root", XmlText), null, "root");
    return r3._key = "root", { ...re3(e2, n2, o2, s4, i3), collabNodeMap: /* @__PURE__ */ new Map(), root: r3 };
  }
  function ce2(e2, t2, n2, o2, s4 = {}) {
    null == n2 && V8(81);
    const { excludedProperties: i3, rootName: r3 = "root-v2" } = s4;
    return { ...re3(e2, t2, n2, o2, i3), mapping: new ie2(), root: n2.get(r3, XmlElement) };
  }
  function ae2(e2) {
    return Object.hasOwn(e2, "collabNodeMap");
  }
  var fe2 = /* @__PURE__ */ new Set(["__key", "__parent", "__next", "__prev", "__state"]);
  var de2 = /* @__PURE__ */ new Set(["__first", "__last", "__size"]);
  var ue2 = /* @__PURE__ */ new Set(["__cachedText"]);
  var he2 = /* @__PURE__ */ new Set(["__text"]);
  function pe2(e2, t2, n2) {
    if (fe2.has(e2) || "function" == typeof t2[e2]) return true;
    if ($isTextNode(t2)) {
      if (he2.has(e2)) return true;
    } else if ($isElementNode(t2) && (de2.has(e2) || $isRootNode(t2) && ue2.has(e2))) return true;
    const s4 = t2.constructor, i3 = n2.excludedProperties.get(s4);
    return null != i3 && i3.has(e2);
  }
  function ge2(e2, t2) {
    const n2 = e2.__type, { nodeProperties: o2 } = t2, s4 = o2.get(n2);
    return void 0 === s4 && V8(330, n2), s4;
  }
  function _e2(t2, s4, i3) {
    const l3 = s4.__type;
    let c3;
    if ($isElementNode(s4)) {
      c3 = se2(new XmlText(), i3, l3), c3.syncPropertiesFromLexical(t2, s4, null), c3.syncChildrenFromLexical(t2, s4, null, null, null);
    } else if ($isTextNode(s4)) {
      c3 = ne3(new Map2(), s4.__text, i3, l3), c3.syncPropertiesAndTextFromLexical(t2, s4, null);
    } else if ($isLineBreakNode(s4)) {
      const e2 = new Map2();
      e2.set("__type", "linebreak"), c3 = ee4(e2, i3);
    } else if ($isDecoratorNode(s4)) {
      c3 = X8(new XmlElement(), i3, l3), c3.syncPropertiesFromLexical(t2, s4, null);
    } else V8(86);
    return c3._key = s4.__key, c3;
  }
  function ye2(e2) {
    const t2 = be2(e2, "__type");
    return "string" != typeof t2 && void 0 !== t2 && V8(87), t2;
  }
  function me2(e2, t2, n2) {
    const o2 = t2._collabNode;
    if (void 0 === o2) {
      const o3 = e2.editor._nodes, s4 = ye2(t2);
      "string" != typeof s4 && V8(87);
      void 0 === o3.get(s4) && V8(88, s4);
      const i3 = t2.parent, r3 = void 0 === n2 && null !== i3 ? me2(e2, i3) : n2 || null;
      if (r3 instanceof oe3 || V8(89), t2 instanceof XmlText) return se2(t2, r3, s4);
      if (t2 instanceof Map2) return "linebreak" === s4 ? ee4(t2, r3) : ne3(t2, "", r3, s4);
      if (t2 instanceof XmlElement) return X8(t2, r3, s4);
    }
    return o2;
  }
  function xe3(e2, t2, n2) {
    const o2 = t2.getType(), s4 = e2.editor._nodes.get(o2);
    void 0 === s4 && V8(88, o2);
    const i3 = new s4.klass();
    if (i3.__parent = n2, t2._key = i3.__key, t2 instanceof oe3) {
      const n3 = t2._xmlText;
      t2.syncPropertiesFromYjs(e2, null), t2.applyChildrenYjsDelta(e2, n3.toDelta()), t2.syncChildrenFromYjs(e2);
    } else t2 instanceof te4 ? t2.syncPropertiesAndTextFromYjs(e2, null) : t2 instanceof Q8 && t2.syncPropertiesFromYjs(e2, null);
    return e2.collabNodeMap.set(i3.__key, t2), i3;
  }
  function Te3(e2, t2, n2, o2) {
    const s4 = null === o2 ? t2 instanceof Map2 ? Array.from(t2.keys()) : t2 instanceof XmlText || t2 instanceof XmlElement ? Object.keys(t2.getAttributes()) : Object.keys(t2) : Array.from(o2);
    let i3;
    for (let o3 = 0; o3 < s4.length; o3++) {
      const r3 = s4[o3];
      if (pe2(r3, n2, e2)) {
        "__state" === r3 && ae2(e2) && (i3 || (i3 = n2.getWritable()), Se2(t2, i3));
        continue;
      }
      const l3 = n2[r3];
      let c3 = be2(t2, r3);
      if (l3 !== c3) {
        if (c3 instanceof Doc) {
          const t3 = e2.docMap;
          l3 instanceof Doc && t3.delete(l3.guid);
          const n3 = createEditor(), o4 = c3.guid;
          n3._key = o4, t3.set(o4, c3), c3 = n3;
        }
        void 0 === i3 && (i3 = n2.getWritable()), i3[r3] = c3;
      }
    }
  }
  function be2(e2, t2) {
    return e2 instanceof Map2 ? e2.get(t2) : e2 instanceof XmlText || e2 instanceof XmlElement ? e2.getAttribute(t2) : e2[t2];
  }
  function ke3(e2, t2, n2) {
    e2 instanceof Map2 ? e2.set(t2, n2) : e2.setAttribute(t2, n2);
  }
  function Se2(e2, t2) {
    const n2 = be2(e2, "__state");
    n2 instanceof Map2 && $getWritableNodeState(t2).updateFromJSON(n2.toJSON());
  }
  function Ne2(e2, t2, n2, o2) {
    const s4 = Object.keys(ge2(o2, e2)), i3 = e2.editor.constructor;
    !(function(e3, t3, n3, o3) {
      const s5 = o3.__state, i4 = be2(t3, "__state");
      if (!s5) return;
      const [r3, l3] = s5.getInternalState(), c3 = n3 && n3.__state, a3 = i4 instanceof Map2 ? i4 : new Map2();
      if (c3 === s5) return;
      const [f3, d4] = c3 && a3.doc ? c3.getInternalState() : [void 0, /* @__PURE__ */ new Map()];
      if (r3) for (const [e4, t4] of Object.entries(r3)) f3 && t4 !== f3[e4] && a3.set(e4, t4);
      for (const [e4, t4] of l3) d4.get(e4) !== t4 && a3.set(e4.key, e4.unparse(t4));
      i4 || ke3(t3, "__state", a3);
    })(0, t2, n2, o2);
    for (let r3 = 0; r3 < s4.length; r3++) {
      const l3 = s4[r3], c3 = null === n2 ? void 0 : n2[l3];
      let a3 = o2[l3];
      if (c3 !== a3) {
        if (a3 instanceof i3) {
          const t3 = e2.docMap;
          let n3;
          if (c3 instanceof i3) {
            const e3 = c3._key;
            n3 = t3.get(e3), t3.delete(e3);
          }
          const s5 = n3 || new Doc(), r4 = s5.guid;
          a3._key = r4, t3.set(r4, s5), a3 = s5, e2.editor.update(() => {
            o2.markDirty();
          });
        }
        ke3(t2, l3, a3);
      }
    }
  }
  function ve3(e2, t2, n2, o2) {
    return e2.slice(0, t2) + o2 + e2.slice(t2 + n2);
  }
  function we2(e2, t2, n2) {
    let o2 = 0, s4 = 0;
    const i3 = e2._children, r3 = i3.length;
    for (; s4 < r3; s4++) {
      const e3 = i3[s4], l3 = o2;
      o2 += e3.getSize();
      if ((n2 ? o2 >= t2 : o2 > t2) && e3 instanceof te4) {
        let n3 = t2 - l3 - 1;
        n3 < 0 && (n3 = 0);
        return { length: o2 - t2, node: e3, nodeIndex: s4, offset: n3 };
      }
      if (o2 > t2) return { length: 0, node: e3, nodeIndex: s4, offset: l3 };
      if (s4 === r3 - 1) return { length: 0, node: null, nodeIndex: s4 + 1, offset: l3 + 1 };
    }
    return { length: 0, node: null, nodeIndex: 0, offset: 0 };
  }
  function Ce2(e2) {
    const t2 = e2.anchor, n2 = e2.focus;
    let s4 = false;
    try {
      const e3 = t2.getNode(), i3 = n2.getNode();
      (!e3.isAttached() || !i3.isAttached() || $isTextNode(e3) && t2.offset > e3.getTextContentSize() || $isTextNode(i3) && n2.offset > i3.getTextContentSize()) && (s4 = true);
    } catch (e3) {
      s4 = true;
    }
    return s4;
  }
  function Oe3(e2, t2) {
    e2.doc.transact(t2, e2);
  }
  function Ke3(e2, n2) {
    const o2 = n2._nodeMap.get(e2);
    if (!o2) return void $getRoot().selectStart();
    const s4 = o2.__prev;
    let i3 = null;
    s4 && (i3 = $getNodeByKey(s4)), null === i3 && null !== o2.__parent && (i3 = $getNodeByKey(o2.__parent)), null !== i3 ? null !== i3 && i3.isAttached() ? i3.selectEnd() : Ke3(i3.__key, n2) : $getRoot().selectStart();
  }
  var Me3 = (e2) => "UNDEFINED" === e2.nodeName;
  var Ee3 = (e2, t2, n2, o2, s4, i3, r3) => {
    let l3 = t2.mapping.get(e2);
    if (l3 && n2 && 0 === n2.size && !o2) return l3;
    const c3 = Me3(e2) ? RootNode.getType() : e2.nodeName, a3 = t2.editor._nodes.get(c3);
    if (void 0 === a3) throw new Error(`$createOrUpdateNodeFromYElement: Node ${c3} is not registered`);
    if (l3 || (l3 = new a3.klass(), n2 = null, o2 = true), o2 && l3 instanceof ElementNode) {
      const n3 = [], o3 = (e3) => {
        if (e3 instanceof XmlElement) {
          const o4 = Ee3(e3, t2, /* @__PURE__ */ new Set(), false, s4, i3, r3);
          null !== o4 && n3.push(o4);
        } else if (e3 instanceof XmlText) {
          const o4 = Ae3(e3, t2, s4, i3, r3);
          null !== o4 && o4.forEach((e4) => {
            null !== e4 && n3.push(e4);
          });
        } else V8(329);
      };
      void 0 === s4 || void 0 === i3 ? e2.toArray().forEach(o3) : typeListToArraySnapshot(e2, new Snapshot(i3.ds, s4.sv)).filter((e3) => !e3._item.deleted || Fe3(e3._item, s4) || Fe3(e3._item, i3)).forEach(o3), Pe3(l3, n3);
    }
    const f3 = e2.getAttributes(s4);
    Me3(e2) || void 0 === s4 || (Fe3(e2._item, s4) ? Fe3(e2._item, i3) || (f3[Je3("ychange")] = r3 ? r3("added", e2._item.id) : { type: "added" }) : f3[Je3("ychange")] = r3 ? r3("removed", e2._item.id) : { type: "removed" });
    const u3 = { ...ge2(l3, t2) }, g3 = {};
    for (const e3 in f3) e3.startsWith(qe3) ? g3[Ge3(e3)] = f3[e3] : u3[e3] = f3[e3];
    if (Te3(t2, u3, l3, n2), n2) {
      const e3 = Object.keys(g3).filter((e4) => n2.has(Je3(e4)));
      if (e3.length > 0) {
        const t3 = $getWritableNodeState(l3);
        for (const n3 of e3) t3.updateFromUnknown(n3, g3[n3]);
      }
    } else $getWritableNodeState(l3).updateFromJSON(g3);
    const _5 = l3.getLatest();
    return t2.mapping.set(e2, _5), _5;
  };
  var Pe3 = (e2, t2) => {
    const n2 = e2.getChildren(), o2 = new Set(n2.map((e3) => e3.getKey())), s4 = new Set(t2.map((e3) => e3.getKey())), i3 = n2.length - 1, r3 = t2.length - 1;
    let l3 = 0, c3 = 0;
    for (; l3 <= i3 && c3 <= r3; ) {
      const i4 = n2[l3].getKey(), r4 = t2[c3].getKey();
      if (i4 === r4) {
        l3++, c3++;
        continue;
      }
      const a4 = s4.has(i4), f4 = o2.has(r4);
      if (!a4) {
        if (0 === c3 && 1 === e2.getChildrenSize()) return void e2.splice(c3, 1, t2.slice(c3));
        e2.splice(c3, 1, []), l3++;
        continue;
      }
      const d4 = t2[c3];
      f4 ? (e2.splice(c3, 1, [d4]), l3++, c3++) : (e2.splice(c3, 0, [d4]), c3++);
    }
    const a3 = l3 > i3, f3 = c3 > r3;
    a3 && !f3 ? e2.append(...t2.slice(c3)) : f3 && !a3 && e2.splice(t2.length, e2.getChildrenSize() - t2.length, []);
  };
  var Fe3 = (e2, t2) => void 0 === t2 ? !e2.deleted : t2.sv.has(e2.id.client) && t2.sv.get(e2.id.client) > e2.id.clock && !isDeleted(t2.ds, e2.id);
  var Ae3 = (e2, t2, n2, s4, i3) => {
    const r3 = Re3(e2, n2, s4, i3);
    let l3 = t2.mapping.get(e2) ?? [];
    const c3 = r3.map((e3) => e3.attributes.t ?? TextNode.getType());
    if (!(l3.length === c3.length && l3.every((e3, t3) => e3.getType() === c3[t3]))) {
      const e3 = t2.editor._nodes;
      l3 = c3.map((t3) => {
        const n3 = e3.get(t3);
        if (void 0 === n3) throw new Error(`$createTextNodesFromYText: Node ${t3} is not registered`);
        const s5 = new n3.klass();
        if (!$isTextNode(s5)) throw new Error(`$createTextNodesFromYText: Node ${t3} is not a TextNode`);
        return s5;
      });
    }
    for (let e3 = 0; e3 < r3.length; e3++) {
      const n3 = l3[e3], o2 = r3[e3], { attributes: s5, insert: i4 } = o2;
      n3.__text !== i4 && n3.setTextContent(i4);
      const c4 = { ...ge2(n3, t2), ...s5.p }, a4 = Object.fromEntries(Object.entries(s5).filter(([e4]) => e4.startsWith(qe3)).map(([e4, t3]) => [Ge3(e4), t3]));
      Te3(t2, c4, n3, null), $getWritableNodeState(n3).updateFromJSON(a4);
    }
    const a3 = l3.map((e3) => e3.getLatest());
    return t2.mapping.set(e2, a3), a3;
  };
  var je3 = (e2, t2) => e2 instanceof Array ? ((e3, t3) => {
    const n2 = new XmlText();
    return Ue3(n2, e3, t3), n2;
  })(e2, t2) : ((e3, t3) => {
    const n2 = new XmlElement(e3.getType()), o2 = { ...Be3(e3, t3), ...Ve3(e3) };
    for (const e4 in o2) {
      const t4 = o2[e4];
      null !== t4 && n2.setAttribute(e4, t4);
    }
    return e3 instanceof ElementNode ? (n2.insert(0, De3(e3).map((e4) => je3(e4, t3))), t3.mapping.set(n2, e3), n2) : n2;
  })(e2, t2);
  var ze3 = (e2) => "object" == typeof e2 && null != e2;
  var Le3 = (e2, t2) => {
    const n2 = Object.keys(e2).filter((t3) => null !== e2[t3]);
    if (null == t2) return 0 === n2.length;
    let o2 = n2.length === Object.keys(t2).filter((e3) => null !== t2[e3]).length;
    for (let s4 = 0; s4 < n2.length && o2; s4++) {
      const i3 = n2[s4], r3 = e2[i3], l3 = t2[i3];
      o2 = "ychange" === i3 || r3 === l3 || ze3(r3) && ze3(l3) && Le3(r3, l3);
    }
    return o2;
  };
  var De3 = (e2) => {
    if (!(e2 instanceof ElementNode)) return [];
    const t2 = e2.getChildren(), n2 = [];
    for (let e3 = 0; e3 < t2.length; e3++) {
      const s4 = t2[e3];
      if ($isTextNode(s4)) {
        const s5 = [];
        for (let n3 = t2[e3]; e3 < t2.length && $isTextNode(n3); n3 = t2[++e3]) s5.push(n3);
        e3--, n2.push(s5);
      } else n2.push(s4);
    }
    return n2;
  };
  var Ye3 = (e2, t2, n2) => {
    const o2 = Re3(e2);
    return o2.length === t2.length && o2.every((e3, o3) => {
      const s4 = t2[o3], i3 = e3.attributes.t ?? TextNode.getType(), r3 = e3.attributes.p ?? {}, l3 = Object.fromEntries(Object.entries(e3.attributes).filter(([e4]) => e4.startsWith(qe3)));
      return e3.insert === s4.getTextContent() && i3 === s4.getType() && Le3(r3, Be3(s4, n2)) && Le3(l3, Ve3(s4));
    });
  };
  var Ie3 = (e2, t2, n2) => {
    if (e2 instanceof XmlElement && !(t2 instanceof Array) && Qe3(e2, t2)) {
      const o2 = De3(t2);
      return e2._length === o2.length && Le3(e2.getAttributes(), { ...Be3(t2, n2), ...Ve3(t2) }) && e2.toArray().every((e3, t3) => Ie3(e3, o2[t3], n2));
    }
    return e2 instanceof XmlText && t2 instanceof Array && Ye3(e2, t2, n2);
  };
  var $e3 = (e2, t2) => e2 === t2 || e2 instanceof Array && t2 instanceof Array && e2.length === t2.length && e2.every((e3, n2) => t2[n2] === e3);
  var We3 = (e2, t2, n2) => {
    const o2 = e2.toArray(), s4 = De3(t2), i3 = s4.length, r3 = o2.length, l3 = Math.min(r3, i3);
    let c3 = 0, a3 = 0, f3 = false;
    for (; c3 < l3; c3++) {
      const e3 = o2[c3], t3 = s4[c3];
      if (e3 instanceof XmlHook) break;
      if ($e3(n2.mapping.get(e3), t3)) f3 = true;
      else if (!Ie3(e3, t3, n2)) break;
    }
    for (; c3 + a3 < l3; a3++) {
      const e3 = o2[r3 - a3 - 1], t3 = s4[i3 - a3 - 1];
      if (e3 instanceof XmlHook) break;
      if ($e3(n2.mapping.get(e3), t3)) f3 = true;
      else if (!Ie3(e3, t3, n2)) break;
    }
    return { equalityFactor: c3 + a3, foundMappedChild: f3 };
  };
  var Ue3 = (e2, t2, n2) => {
    n2.mapping.set(e2, t2);
    const { nAttrs: o2, str: r3 } = ((e3) => {
      let t3 = "", n3 = e3._start;
      const o3 = {};
      for (; null !== n3; ) n3.deleted || (n3.countable && n3.content instanceof ContentString ? t3 += n3.content.str : n3.content instanceof ContentFormat && (o3[n3.content.key] = null)), n3 = n3.right;
      return { nAttrs: o3, str: t3 };
    })(e2), l3 = t2.map((e3, t3) => {
      const s4 = e3.getType();
      let i3 = Be3(e3, n2);
      return 0 === Object.keys(i3).length && (i3 = null), { attributes: Object.assign({}, o2, { ...s4 !== TextNode.getType() && { t: s4 }, p: i3, ...Ve3(e3), ...t3 > 0 && { i: t3 } }), insert: e3.getTextContent(), nodeKey: e3.getKey() };
    }), c3 = l3.map((e3) => e3.insert).join(""), a3 = $getSelection();
    let f3;
    if ($isRangeSelection(a3) && a3.isCollapsed()) {
      f3 = 0;
      for (const e3 of l3) {
        if (e3.nodeKey === a3.anchor.key) {
          f3 += a3.anchor.offset;
          break;
        }
        f3 += e3.insert.length;
      }
    } else f3 = c3.length;
    const { insert: d4, remove: u3, index: h2 } = H8(r3, c3, f3);
    e2.delete(h2, u3), e2.insert(h2, d4), e2.applyDelta(l3.map((e3) => ({ attributes: e3.attributes, retain: e3.insert.length })));
  };
  var Re3 = (e2, t2, n2, o2) => e2.toDelta(t2, n2, o2).map((e3) => {
    const t3 = e3.attributes ?? {};
    return "ychange" in t3 && (t3[Je3("ychange")] = t3.ychange, delete t3.ychange), { ...e3, attributes: t3 };
  });
  var Be3 = (e2, t2) => {
    const n2 = ge2(e2, t2), o2 = {};
    return Object.entries(n2).forEach(([t3, n3]) => {
      const s4 = e2[t3];
      s4 !== n3 && (o2[t3] = s4);
    }), o2;
  };
  var qe3 = "s_";
  var Je3 = (e2) => `s_${e2}`;
  var Ge3 = (e2) => {
    if (!e2.startsWith(qe3)) throw new Error(`Invalid state key: ${e2}`);
    return e2.slice(qe3.length);
  };
  var Ve3 = (e2) => {
    const t2 = e2.__state;
    if (!t2) return {};
    const [n2 = {}, o2] = t2.getInternalState(), s4 = {};
    for (const [e3, t3] of Object.entries(n2)) s4[Je3(e3)] = t3;
    for (const [e3, t3] of o2) s4[Je3(e3.key)] = e3.unparse(t3);
    return s4;
  };
  var He3 = (e2, t2, n2, o2, s4) => {
    if (t2 instanceof XmlElement && t2.nodeName !== n2.getType() && (!Me3(t2) || n2.getType() !== RootNode.getType())) throw new Error("node name mismatch!");
    if (o2.mapping.set(t2, n2), t2 instanceof XmlElement) {
      const e3 = t2.getAttributes(), s5 = { ...Be3(n2, o2), ...Ve3(n2) };
      for (const n3 in s5) if (null != s5[n3]) {
        e3[n3] === s5[n3] || ze3(e3[n3]) && ze3(s5[n3]) && Le3(e3[n3], s5[n3]) || "ychange" === n3 || t2.setAttribute(n3, s5[n3]);
      } else t2.removeAttribute(n3);
      for (const n3 in e3) void 0 === s5[n3] && t2.removeAttribute(n3);
    }
    const i3 = De3(n2), r3 = i3.length, l3 = t2.toArray(), c3 = l3.length, a3 = Math.min(r3, c3);
    let f3 = 0, d4 = 0;
    for (; f3 < a3; f3++) {
      const t3 = l3[f3], n3 = i3[f3];
      if (t3 instanceof XmlHook) break;
      if ($e3(o2.mapping.get(t3), n3)) n3 instanceof ElementNode && s4.has(n3.getKey()) && He3(e2, t3, n3, o2, s4);
      else {
        if (!Ie3(t3, n3, o2)) break;
        o2.mapping.set(t3, n3);
      }
    }
    for (; d4 + f3 < a3; d4++) {
      const t3 = l3[c3 - d4 - 1], n3 = i3[r3 - d4 - 1];
      if (t3 instanceof XmlHook) break;
      if ($e3(o2.mapping.get(t3), n3)) n3 instanceof ElementNode && s4.has(n3.getKey()) && He3(e2, t3, n3, o2, s4);
      else {
        if (!Ie3(t3, n3, o2)) break;
        o2.mapping.set(t3, n3);
      }
    }
    for (; c3 - f3 - d4 > 0 && r3 - f3 - d4 > 0; ) {
      const n3 = l3[f3], a4 = i3[f3], u4 = l3[c3 - d4 - 1], h2 = i3[r3 - d4 - 1];
      if (n3 instanceof XmlText && a4 instanceof Array) Ye3(n3, a4, o2) || Ue3(n3, a4, o2), f3 += 1;
      else {
        let i4 = n3 instanceof XmlElement && Qe3(n3, a4), r4 = u4 instanceof XmlElement && Qe3(u4, h2);
        if (i4 && r4) {
          const e3 = We3(n3, a4, o2), t3 = We3(u4, h2, o2);
          e3.foundMappedChild && !t3.foundMappedChild ? r4 = false : !e3.foundMappedChild && t3.foundMappedChild || e3.equalityFactor < t3.equalityFactor ? i4 = false : r4 = false;
        }
        i4 ? (He3(e2, n3, a4, o2, s4), f3 += 1) : r4 ? (He3(e2, u4, h2, o2, s4), d4 += 1) : (o2.mapping.delete(t2.get(f3)), t2.delete(f3, 1), t2.insert(f3, [je3(a4, o2)]), f3 += 1);
      }
    }
    const u3 = c3 - f3 - d4;
    if (1 === c3 && 0 === r3 && l3[0] instanceof XmlText ? (o2.mapping.delete(l3[0]), l3[0].delete(0, l3[0].length)) : u3 > 0 && (t2.slice(f3, f3 + u3).forEach((e3) => o2.mapping.delete(e3)), t2.delete(f3, u3)), f3 + d4 < r3) {
      const e3 = [];
      for (let t3 = f3; t3 < r3 - d4; t3++) e3.push(je3(i3[t3], o2));
      t2.insert(f3, e3);
    }
  };
  var Qe3 = (e2, t2) => !(t2 instanceof Array) && e2.nodeName === t2.getType();
  var Xe3 = createState("ychange", { isEqual: (e2, t2) => e2 === t2, parse: (e2) => e2 ?? null });
  function Ze3(e2) {
    return $getState(e2, Xe3);
  }
  var et8 = (e2, t2 = snapshot(e2.doc), n2 = emptySnapshot) => {
    const { doc: o2 } = e2;
    o2.gc && V8(325), o2.transact((s4) => {
      const i3 = new PermanentUserData(o2);
      i3 && i3.dss.forEach((e3) => {
        iterateDeletedStructs(s4, e3, (e4) => {
        });
      });
      const r3 = (e3, t3) => ({ id: t3, type: e3, user: ("added" === e3 ? i3.getUserByClientId(t3.client) : i3.getUserByDeletedId(t3)) ?? null });
      e2.mapping.clear(), e2.editor.update(() => {
        $getRoot().clear(), Ee3(e2.root, e2, null, true, t2, n2, r3);
      });
    }, e2);
  };
  function tt8(e2, t2) {
    const n2 = t2.collabNodeMap.get(e2.key);
    if (void 0 === n2) return null;
    let s4 = e2.offset, i3 = n2.getSharedType();
    if (n2 instanceof te4) {
      i3 = n2._parent._xmlText;
      const e3 = n2.getOffset();
      if (-1 === e3) return null;
      s4 = e3 + 1 + s4;
    } else if (n2 instanceof oe3 && "element" === e2.type) {
      const t3 = e2.getNode();
      $isElementNode(t3) || V8(184);
      let n3 = 0, i4 = 0, l3 = t3.getFirstChild();
      for (; null !== l3 && i4++ < s4; ) $isTextNode(l3) ? n3 += l3.getTextContentSize() + 1 : n3++, l3 = l3.getNextSibling();
      s4 = n3;
    }
    return createRelativePositionFromTypeIndex(i3, s4);
  }
  function nt8(e2, t2) {
    const { mapping: n2 } = t2, { offset: s4 } = e2, i3 = e2.getNode(), l3 = n2.getSharedType(i3);
    if (void 0 === l3) return null;
    if ("text" === e2.type) {
      $isTextNode(i3) || V8(326);
      let e3 = i3.getPreviousSibling(), t3 = s4;
      for (; $isTextNode(e3); ) t3 += e3.getTextContentSize(), e3 = e3.getPreviousSibling();
      return createRelativePositionFromTypeIndex(l3, t3);
    }
    if ("element" === e2.type) {
      $isElementNode(i3) || V8(184);
      let e3 = 0, t3 = i3.getFirstChild();
      for (; null !== t3 && e3 < s4; ) {
        if ($isTextNode(t3)) {
          let e4 = t3.getNextSibling();
          for (; $isTextNode(e4); ) e4 = e4.getNextSibling();
        }
        e3++, t3 = t3.getNextSibling();
      }
      return createRelativePositionFromTypeIndex(l3, e3);
    }
    return null;
  }
  function ot8(e2, t2) {
    return createAbsolutePositionFromRelativePosition(e2, t2.doc);
  }
  function st8(e2, t2) {
    if (null == e2) {
      if (null != t2) return true;
    } else if (null == t2 || !compareRelativePositions(e2, t2)) return true;
    return false;
  }
  function it8(e2, t2) {
    return { color: t2, name: e2, selection: null };
  }
  function rt8(e2, t2) {
    const n2 = e2.cursorsContainer;
    if (null !== n2) {
      const e3 = t2.selections, o2 = e3.length;
      for (let t3 = 0; t3 < o2; t3++) n2.removeChild(e3[t3]);
    }
  }
  function lt8(e2, t2) {
    const n2 = t2.selection;
    null !== n2 && rt8(e2, n2);
  }
  function ct7(e2, t2, n2, o2, s4) {
    const i3 = e2.color, r3 = document.createElement("span");
    r3.style.cssText = `position:absolute;top:0;bottom:0;right:-1px;width:1px;background-color:${i3};z-index:10;`;
    const l3 = document.createElement("span");
    return l3.textContent = e2.name, l3.style.cssText = `position:absolute;left:-2px;top:-16px;background-color:${i3};color:#fff;line-height:12px;font-size:12px;padding:2px;font-family:Arial;font-weight:bold;white-space:nowrap;`, r3.appendChild(l3), { anchor: { key: t2, offset: n2 }, caret: r3, color: i3, focus: { key: o2, offset: s4 }, name: l3, selections: [] };
  }
  function at7(e2, t2, o2, s4) {
    const i3 = e2.editor, r3 = i3.getRootElement(), l3 = e2.cursorsContainer;
    if (null === l3 || null === r3) return;
    const c3 = l3.offsetParent;
    if (null === c3) return;
    const a3 = c3.getBoundingClientRect(), f3 = t2.selection;
    if (null === o2) return null === f3 ? void 0 : (t2.selection = null, void rt8(e2, f3));
    t2.selection = o2;
    const d4 = o2.caret, u3 = o2.color, h2 = o2.selections, p3 = o2.anchor, g3 = o2.focus, _5 = p3.key, y4 = g3.key, m3 = s4.get(_5), x4 = s4.get(y4);
    if (null == m3 || null == x4) return;
    let T4;
    if (m3 === x4 && $isLineBreakNode(m3)) {
      T4 = [i3.getElementByKey(_5).getBoundingClientRect()];
    } else {
      const e3 = createDOMRange(i3, m3, p3.offset, x4, g3.offset);
      if (null === e3) return;
      T4 = createRectsFromDOMRange(i3, e3);
    }
    const b5 = h2.length, k4 = T4.length;
    for (let e3 = 0; e3 < k4; e3++) {
      const t3 = T4[e3];
      let n2 = h2[e3];
      if (void 0 === n2) {
        n2 = document.createElement("span"), h2[e3] = n2;
        const t4 = document.createElement("span");
        n2.appendChild(t4), l3.appendChild(n2);
      }
      const o3 = `position:absolute;top:${t3.top - a3.top}px;left:${t3.left - a3.left}px;height:${t3.height}px;width:${t3.width}px;pointer-events:none;z-index:5;`;
      n2.style.cssText = o3, n2.firstChild.style.cssText = `${o3}left:0;top:0;background-color:${u3};opacity:0.3;`, e3 === k4 - 1 && d4.parentNode !== n2 && n2.appendChild(d4);
    }
    for (let e3 = b5 - 1; e3 >= k4; e3--) {
      const t3 = h2[e3];
      l3.removeChild(t3), h2.pop();
    }
  }
  function ft7(e2, t2) {
    const { anchorPos: n2, focusPos: o2 } = t2;
    let s4 = null, i3 = 0, r3 = null, l3 = 0;
    if (null !== n2 && null !== o2) {
      const t3 = ot8(n2, e2), c3 = ot8(o2, e2);
      null !== t3 && null !== c3 && ([s4, i3] = pt8(t3.type, t3.index), [r3, l3] = pt8(c3.type, c3.index));
    }
    return { anchorCollabNode: s4, anchorOffset: i3, focusCollabNode: r3, focusOffset: l3 };
  }
  function dt7(e2, t2) {
    const { anchorPos: n2, focusPos: s4 } = t2, i3 = n2 ? ot8(n2, e2) : null, r3 = s4 ? ot8(s4, e2) : null;
    if (null === i3 || null === r3) return { anchorKey: null, anchorOffset: 0, focusKey: null, focusOffset: 0 };
    if (ae2(e2)) {
      const [e3, t3] = pt8(i3.type, i3.index), [n3, o2] = pt8(r3.type, r3.index);
      return { anchorKey: null !== e3 ? e3.getKey() : null, anchorOffset: t3, focusKey: null !== n3 ? n3.getKey() : null, focusOffset: o2 };
    }
    let [l3, c3] = gt8(e2.mapping, i3), [a3, f3] = gt8(e2.mapping, r3);
    if (a3 && l3 && (a3 !== l3 || f3 !== c3)) {
      const e3 = a3.isBefore(l3), t3 = e3 ? a3 : l3, n3 = e3 ? f3 : c3;
      $isTextNode(t3) && $isTextNode(t3.getNextSibling()) && n3 === t3.getTextContentSize() && (e3 ? (a3 = t3.getNextSibling(), f3 = 0) : (l3 = t3.getNextSibling(), c3 = 0));
    }
    return { anchorKey: null !== l3 ? l3.getKey() : null, anchorOffset: c3, focusKey: null !== a3 ? a3.getKey() : null, focusOffset: f3 };
  }
  function ut7(e2, t2) {
    const n2 = t2.awareness.getLocalState();
    if (null === n2) return;
    const { anchorKey: o2, anchorOffset: r3, focusKey: l3, focusOffset: c3 } = dt7(e2, n2);
    if (null !== o2 && null !== l3) {
      const e3 = $getSelection();
      if (!$isRangeSelection(e3)) return;
      ht8(e3.anchor, o2, r3), ht8(e3.focus, l3, c3);
    }
  }
  function ht8(e2, n2, s4) {
    if (e2.key !== n2 || e2.offset !== s4) {
      let i3 = $getNodeByKey(n2);
      if (null !== i3 && !$isElementNode(i3) && !$isTextNode(i3)) {
        const e3 = i3.getParentOrThrow();
        n2 = e3.getKey(), s4 = i3.getIndexWithinParent(), i3 = e3;
      }
      e2.set(n2, s4, $isElementNode(i3) ? "element" : "text");
    }
  }
  function pt8(e2, t2) {
    const n2 = e2._collabNode;
    if (void 0 === n2) return [null, 0];
    if (n2 instanceof oe3) {
      const { node: e3, offset: o2 } = we2(n2, t2, true);
      return null === e3 ? [n2, 0] : [e3, o2];
    }
    return [null, 0];
  }
  function gt8(e2, t2) {
    const n2 = t2.type, s4 = t2.index;
    if (n2 instanceof XmlElement) {
      const t3 = e2.get(n2);
      if (void 0 === t3) return [null, 0];
      if (!$isElementNode(t3)) return [t3, s4];
      let i3 = s4, l3 = 0;
      const c3 = t3.getChildren();
      for (; i3 > 0 && l3 < c3.length; ) {
        const e3 = c3[l3];
        if (i3 -= 1, l3 += 1, $isTextNode(e3)) for (; l3 < c3.length && $isTextNode(c3[l3]); ) l3 += 1;
      }
      return [t3, l3];
    }
    {
      const t3 = e2.get(n2);
      if (void 0 === t3) return [null, 0];
      let o2 = 0, i3 = s4;
      for (; i3 > t3[o2].getTextContentSize() && o2 + 1 < t3.length; ) i3 -= t3[o2].getTextContentSize(), o2++;
      const r3 = t3[o2];
      return [r3, Math.min(i3, r3.getTextContentSize())];
    }
  }
  function _t8(e2, t2) {
    return t2.awareness.getStates();
  }
  function yt8(e2, t2, n2) {
    const { getAwarenessStates: o2 = _t8 } = n2 ?? {}, s4 = Array.from(o2(e2, t2)), i3 = e2.clientID, r3 = e2.cursors, l3 = e2.editor, c3 = l3._editorState._nodeMap, a3 = /* @__PURE__ */ new Set();
    for (let t3 = 0; t3 < s4.length; t3++) {
      const n3 = s4[t3], [o3, f4] = n3;
      if (0 !== o3 && o3 !== i3) {
        a3.add(o3);
        const { name: t4, color: n4, focusing: s5 } = f4;
        let i4 = null, d4 = r3.get(o3);
        if (void 0 === d4 && (d4 = it8(t4, n4), r3.set(o3, d4)), s5) {
          const { anchorKey: t5, anchorOffset: n5, focusKey: o4, focusOffset: s6 } = l3.read(() => dt7(e2, f4));
          if (null !== t5 && null !== o4) if (i4 = d4.selection, null === i4) i4 = ct7(d4, t5, n5, o4, s6);
          else {
            const e3 = i4.anchor, r4 = i4.focus;
            e3.key = t5, e3.offset = n5, r4.key = o4, r4.offset = s6;
          }
        }
        at7(e2, d4, i4, c3);
      }
    }
    const f3 = Array.from(r3.keys());
    for (let t3 = 0; t3 < f3.length; t3++) {
      const n3 = f3[t3];
      if (!a3.has(n3)) {
        const t4 = r3.get(n3);
        void 0 !== t4 && (lt8(e2, t4), r3.delete(n3));
      }
    }
  }
  function mt7(e2, t2, n2, o2) {
    const s4 = t2.awareness, r3 = s4.getLocalState();
    if (null === r3) return;
    const { anchorPos: l3, focusPos: c3, name: a3, color: f3, focusing: d4, awarenessData: u3 } = r3;
    let h2 = null, p3 = null;
    (null !== o2 && (null === l3 || o2.is(n2)) || null !== n2) && ($isRangeSelection(o2) && (ae2(e2) ? (h2 = tt8(o2.anchor, e2), p3 = tt8(o2.focus, e2)) : (h2 = nt8(o2.anchor, e2), p3 = nt8(o2.focus, e2))), (st8(l3, h2) || st8(c3, p3)) && s4.setLocalState({ ...r3, anchorPos: h2, awarenessData: u3, color: f3, focusPos: p3, focusing: d4, name: a3 }));
  }
  function xt8(e2, t2) {
    if (t2 instanceof YMapEvent && (function(e3, t3) {
      const { target: n3 } = t3;
      if (!n3._item || "__state" !== n3._item.parentSub || void 0 !== ye2(n3) || !(n3.parent instanceof XmlText || n3.parent instanceof XmlElement || n3.parent instanceof Map2)) return false;
      const o3 = me2(e3, n3.parent).getNode();
      if (o3) {
        const e4 = $getWritableNodeState(o3.getWritable());
        for (const o4 of t3.keysChanged) e4.updateFromUnknown(o4, n3.get(o4));
      }
      return true;
    })(e2, t2)) return;
    const { target: n2 } = t2, o2 = me2(e2, n2);
    if (o2 instanceof oe3 && t2 instanceof YTextEvent) {
      const { keysChanged: n3, childListChanged: s4, delta: i3 } = t2;
      n3.size > 0 && o2.syncPropertiesFromYjs(e2, n3), s4 && (o2.applyChildrenYjsDelta(e2, i3), o2.syncChildrenFromYjs(e2));
    } else if (o2 instanceof te4 && t2 instanceof YMapEvent) {
      const { keysChanged: n3 } = t2;
      n3.size > 0 && o2.syncPropertiesAndTextFromYjs(e2, n3);
    } else if (o2 instanceof Q8 && t2 instanceof YXmlEvent) {
      const { attributesChanged: n3 } = t2;
      n3.size > 0 && o2.syncPropertiesFromYjs(e2, n3);
    } else V8(82);
  }
  function Tt8(e2, t2, n2, o2, s4 = yt8) {
    const i3 = e2.editor, r3 = i3._editorState;
    n2.forEach((e3) => e3.delta), i3.update(() => {
      for (let t3 = 0; t3 < n2.length; t3++) {
        const o3 = n2[t3];
        xt8(e2, o3);
      }
      bt8(r3, e2, t2), o2 || $addUpdateTag(SKIP_SCROLL_INTO_VIEW_TAG);
    }, { onUpdate: () => {
      s4(e2, t2), i3.update(() => kt8());
    }, skipTransforms: true, tag: o2 ? HISTORIC_TAG : COLLABORATION_TAG });
  }
  function bt8(e2, t2, n2) {
    const o2 = $getSelection();
    if ($isRangeSelection(o2)) if (Ce2(o2)) {
      const r3 = e2._selection;
      if ($isRangeSelection(r3) && (ut7(t2, n2), Ce2(o2))) {
        Ke3(o2.anchor.key, e2);
      }
      mt7(t2, n2, r3, $getSelection());
    } else ut7(t2, n2);
  }
  function kt8() {
    0 === $getRoot().getChildrenSize() && $getRoot().append($createParagraphNode());
  }
  function St8(e2, n2, i3, r3, l3, c3, a3, f3) {
    Oe3(e2, () => {
      r3.read(() => {
        if (f3.has(COLLABORATION_TAG) || f3.has(HISTORIC_TAG)) return void (a3.size > 0 && (function(e3, n3) {
          const s4 = Array.from(n3), i4 = e3.collabNodeMap, r5 = [], l4 = [];
          for (let e4 = 0; e4 < s4.length; e4++) {
            const n4 = s4[e4], c4 = $getNodeByKey(n4), a4 = i4.get(n4);
            if (a4 instanceof te4) if ($isTextNode(c4)) r5.push([a4, c4.__text]);
            else {
              const e5 = a4.getOffset();
              if (-1 === e5) continue;
              const t2 = a4._parent;
              a4._normalized = true, t2._xmlText.delete(e5, 1), l4.push(a4);
            }
          }
          for (let e4 = 0; e4 < l4.length; e4++) {
            const t2 = l4[e4], n4 = t2.getKey();
            i4.delete(n4);
            const o2 = t2._parent._children, s5 = o2.indexOf(t2);
            o2.splice(s5, 1);
          }
          for (let e4 = 0; e4 < r5.length; e4++) {
            const [t2, n4] = r5[e4];
            t2._text = n4;
          }
        })(e2, a3));
        if (l3.has("root")) {
          const t2 = i3._nodeMap, n3 = $getRoot(), o2 = e2.root;
          o2.syncPropertiesFromLexical(e2, n3, t2), o2.syncChildrenFromLexical(e2, n3, t2, l3, c3);
        }
        const r4 = $getSelection(), d4 = i3._selection;
        mt7(e2, n2, d4, r4);
      });
    });
  }
  function Nt8(e2, t2) {
    const { target: n2 } = t2;
    if (n2 instanceof XmlElement && t2 instanceof YXmlEvent) Ee3(n2, e2, t2.attributesChanged, t2.childListChanged);
    else if (n2 instanceof XmlText && t2 instanceof YTextEvent) {
      const t3 = n2.parent;
      t3 instanceof XmlElement ? Ee3(t3, e2, /* @__PURE__ */ new Set(), true) : V8(327);
    } else V8(328);
  }
  function vt8(e2, t2, n2, o2, s4) {
    const i3 = e2.editor, r3 = i3._editorState;
    iterateDeletedStructs(o2, o2.deleteSet, (t3) => {
      if (t3.constructor === Item) {
        const n3 = t3.content.type;
        n3 && e2.mapping.delete(n3);
      }
    }), n2.forEach((e3) => e3.delta), i3.update(() => {
      for (let t3 = 0; t3 < n2.length; t3++) {
        const o3 = n2[t3];
        Nt8(e2, o3);
      }
      bt8(r3, e2, t2), s4 || $addUpdateTag(SKIP_SCROLL_INTO_VIEW_TAG);
    }, { discrete: true, onUpdate: () => {
      yt8(e2, t2), i3.update(() => kt8());
    }, skipTransforms: true, tag: s4 ? HISTORIC_TAG : COLLABORATION_TAG });
  }
  function wt7(e2, t2) {
    e2.mapping.clear();
    const n2 = e2.editor;
    n2.update(() => {
      $getRoot().clear(), Ee3(e2.root, e2, null, true), $addUpdateTag(COLLABORATION_TAG);
    }, { discrete: true, onUpdate: () => {
      yt8(e2, t2), n2.update(() => kt8());
    }, skipTransforms: true, tag: COLLABORATION_TAG });
  }
  function Ct8(e2, t2, n2, o2, i3, r3, l3) {
    (l3.has(COLLABORATION_TAG) || l3.has(HISTORIC_TAG)) && 0 === r3.size || (r3.forEach((t3) => {
      e2.mapping.deleteNode(t3);
    }), Oe3(e2, () => {
      o2.read(() => {
        i3.has("root") && He3(e2.doc, e2.root, $getRoot(), e2, new Set(i3.keys()));
        const o3 = $getSelection(), r4 = n2._selection;
        mt7(e2, t2, r4, o3);
      });
    }));
  }
  var Ot7 = createCommand("CONNECTED_COMMAND");
  var Kt6 = createCommand("TOGGLE_CONNECT_COMMAND");
  var Mt6 = createCommand("DIFF_VERSIONS_COMMAND");
  var Et7 = createCommand("CLEAR_DIFF_VERSIONS_COMMAND");
  function Pt8(e2, t2) {
    return new UndoManager(t2, { trackedOrigins: /* @__PURE__ */ new Set([e2, null]) });
  }
  function Ft7(e2, t2, n2, o2, s4) {
    e2.awareness.setLocalState({ anchorPos: null, awarenessData: s4, color: n2, focusPos: null, focusing: o2, name: t2 });
  }
  function At8(e2, t2, n2, o2, s4) {
    const { awareness: i3 } = e2;
    let r3 = i3.getLocalState();
    null === r3 && (r3 = { anchorPos: null, awarenessData: s4, color: n2, focusPos: null, focusing: o2, name: t2 }), r3.focusing = o2, i3.setLocalState(r3);
  }

  // node_modules/@lexical/yjs/LexicalYjs.mjs
  var mod15 = false ? LexicalYjs_dev_exports : LexicalYjs_prod_exports;
  var $getYChangeState = mod15.$getYChangeState;
  var CLEAR_DIFF_VERSIONS_COMMAND__EXPERIMENTAL = mod15.CLEAR_DIFF_VERSIONS_COMMAND__EXPERIMENTAL;
  var CONNECTED_COMMAND = mod15.CONNECTED_COMMAND;
  var DIFF_VERSIONS_COMMAND__EXPERIMENTAL = mod15.DIFF_VERSIONS_COMMAND__EXPERIMENTAL;
  var TOGGLE_CONNECT_COMMAND = mod15.TOGGLE_CONNECT_COMMAND;
  var createBinding = mod15.createBinding;
  var createBindingV2__EXPERIMENTAL = mod15.createBindingV2__EXPERIMENTAL;
  var createUndoManager = mod15.createUndoManager;
  var getAnchorAndFocusCollabNodesForUserState = mod15.getAnchorAndFocusCollabNodesForUserState;
  var initLocalState = mod15.initLocalState;
  var renderSnapshot__EXPERIMENTAL = mod15.renderSnapshot__EXPERIMENTAL;
  var setLocalStateFocus = mod15.setLocalStateFocus;
  var syncCursorPositions = mod15.syncCursorPositions;
  var syncLexicalUpdateToYjs = mod15.syncLexicalUpdateToYjs;
  var syncLexicalUpdateToYjsV2__EXPERIMENTAL = mod15.syncLexicalUpdateToYjsV2__EXPERIMENTAL;
  var syncYjsChangesToLexical = mod15.syncYjsChangesToLexical;
  var syncYjsChangesToLexicalV2__EXPERIMENTAL = mod15.syncYjsChangesToLexicalV2__EXPERIMENTAL;
  var syncYjsStateToLexicalV2__EXPERIMENTAL = mod15.syncYjsStateToLexicalV2__EXPERIMENTAL;
  return __toCommonJS(index_exports);
})();
/*! Bundled license information:

prismjs/prism.js:
  (**
   * Prism: Lightweight, robust, elegant syntax highlighting
   *
   * @license MIT <https://opensource.org/licenses/MIT>
   * @author Lea Verou <https://lea.verou.me>
   * @namespace
   * @public
   *)
*/
