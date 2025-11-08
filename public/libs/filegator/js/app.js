(function(e) {
    function a(a) {
        for (var n, r, s = a[0], l = a[1], d = a[2], c = 0, p = []; c < s.length; c++) r = s[c], Object.prototype.hasOwnProperty.call(i, r) && i[r] && p.push(i[r][0]), i[r] = 0;
        for (n in l) Object.prototype.hasOwnProperty.call(l, n) && (e[n] = l[n]);
        u && u(a);
        while (p.length) p.shift()();
        return t.push.apply(t, d || []), o()
    }

    function o() {
        for (var e, a = 0; a < t.length; a++) {
            for (var o = t[a], n = !0, s = 1; s < o.length; s++) {
                var l = o[s];
                0 !== i[l] && (n = !1)
            }
            n && (t.splice(a--, 1), e = r(r.s = o[0]))
        }
        return e
    }
    var n = {},
        i = {
            app: 0
        },
        t = [];

    function r(a) {
        if (n[a]) return n[a].exports;
        var o = n[a] = {
            i: a,
            l: !1,
            exports: {}
        };
        return e[a].call(o.exports, o, o.exports, r), o.l = !0, o.exports
    }
    r.m = e, r.c = n, r.d = function(e, a, o) {
        r.o(e, a) || Object.defineProperty(e, a, {
            enumerable: !0,
            get: o
        })
    }, r.r = function(e) {
        "undefined" !== typeof Symbol && Symbol.toStringTag && Object.defineProperty(e, Symbol.toStringTag, {
            value: "Module"
        }), Object.defineProperty(e, "__esModule", {
            value: !0
        })
    }, r.t = function(e, a) {
        if (1 & a && (e = r(e)), 8 & a) return e;
        if (4 & a && "object" === typeof e && e && e.__esModule) return e;
        var o = Object.create(null);
        if (r.r(o), Object.defineProperty(o, "default", {
                enumerable: !0,
                value: e
            }), 2 & a && "string" != typeof e)
            for (var n in e) r.d(o, n, function(a) {
                return e[a]
            }.bind(null, n));
        return o
    }, r.n = function(e) {
        var a = e && e.__esModule ? function() {
            return e["default"]
        } : function() {
            return e
        };
        return r.d(a, "a", a), a
    }, r.o = function(e, a) {
        return Object.prototype.hasOwnProperty.call(e, a)
    }, r.p = "/";
    var s = window["webpackJsonp"] = window["webpackJsonp"] || [],
        l = s.push.bind(s);
    s.push = a, s = s.slice();
    for (var d = 0; d < s.length; d++) a(s[d]);
    var u = l;
    t.push([0, "chunk-vendors"]), o()
})({
    0: function(e, a, o) {
        e.exports = o("93b7")
    },
    "14a0": function(e, a, o) {
        "use strict";
        var n = o("23ed"),
            i = o.n(n);
        i.a
    },
    "23ed": function(e, a, o) {},
    2636: function(e, a, o) {
        "use strict";
        var n = o("d045"),
            i = o.n(n);
        i.a
    },
    "2b2b": function(e, a, o) {
        "use strict";
        var n = o("b6df"),
            i = o.n(n);
        i.a
    },
    "37b3": function(e, a, o) {},
    4678: function(e, a, o) {
        var n = {
            "./af": "2bfb",
            "./af.js": "2bfb",
            "./ar": "8e73",
            "./ar-dz": "a356",
            "./ar-dz.js": "a356",
            "./ar-kw": "423e",
            "./ar-kw.js": "423e",
            "./ar-ly": "1cfd",
            "./ar-ly.js": "1cfd",
            "./ar-ma": "0a84",
            "./ar-ma.js": "0a84",
            "./ar-sa": "8230",
            "./ar-sa.js": "8230",
            "./ar-tn": "6d83",
            "./ar-tn.js": "6d83",
            "./ar.js": "8e73",
            "./az": "485c",
            "./az.js": "485c",
            "./be": "1fc1",
            "./be.js": "1fc1",
            "./bg": "84aa",
            "./bg.js": "84aa",
            "./bm": "a7fa",
            "./bm.js": "a7fa",
            "./bn": "9043",
            "./bn.js": "9043",
            "./bo": "d26a",
            "./bo.js": "d26a",
            "./br": "6887",
            "./br.js": "6887",
            "./bs": "2554",
            "./bs.js": "2554",
            "./ca": "d716",
            "./ca.js": "d716",
            "./cs": "3c0d",
            "./cs.js": "3c0d",
            "./cv": "03ec",
            "./cv.js": "03ec",
            "./cy": "9797",
            "./cy.js": "9797",
            "./da": "0f14",
            "./da.js": "0f14",
            "./de": "b469",
            "./de-at": "b3eb",
            "./de-at.js": "b3eb",
            "./de-ch": "bb71",
            "./de-ch.js": "bb71",
            "./de.js": "b469",
            "./dv": "598a",
            "./dv.js": "598a",
            "./el": "8d47",
            "./el.js": "8d47",
            "./en-SG": "cdab",
            "./en-SG.js": "cdab",
            "./en-au": "0e6b",
            "./en-au.js": "0e6b",
            "./en-ca": "3886",
            "./en-ca.js": "3886",
            "./en-gb": "39a6",
            "./en-gb.js": "39a6",
            "./en-ie": "e1d3",
            "./en-ie.js": "e1d3",
            "./en-il": "7333",
            "./en-il.js": "7333",
            "./en-nz": "6f50",
            "./en-nz.js": "6f50",
            "./eo": "65db",
            "./eo.js": "65db",
            "./es": "898b",
            "./es-do": "0a3c",
            "./es-do.js": "0a3c",
            "./es-us": "55c9",
            "./es-us.js": "55c9",
            "./es.js": "898b",
            "./et": "ec18",
            "./et.js": "ec18",
            "./eu": "0ff2",
            "./eu.js": "0ff2",
            "./fa": "8df4",
            "./fa.js": "8df4",
            "./fi": "81e9",
            "./fi.js": "81e9",
            "./fo": "0721",
            "./fo.js": "0721",
            "./fr": "9f26",
            "./fr-ca": "d9f8",
            "./fr-ca.js": "d9f8",
            "./fr-ch": "0e49",
            "./fr-ch.js": "0e49",
            "./fr.js": "9f26",
            "./fy": "7118",
            "./fy.js": "7118",
            "./ga": "5120",
            "./ga.js": "5120",
            "./gd": "f6b4",
            "./gd.js": "f6b4",
            "./gl": "8840",
            "./gl.js": "8840",
            "./gom-latn": "0caa",
            "./gom-latn.js": "0caa",
            "./gu": "e0c5",
            "./gu.js": "e0c5",
            "./he": "c7aa",
            "./he.js": "c7aa",
            "./hi": "dc4d",
            "./hi.js": "dc4d",
            "./hr": "4ba9",
            "./hr.js": "4ba9",
            "./hu": "5b14",
            "./hu.js": "5b14",
            "./hy-am": "d6b6",
            "./hy-am.js": "d6b6",
            "./id": "5038",
            "./id.js": "5038",
            "./is": "0558",
            "./is.js": "0558",
            "./it": "6e98",
            "./it-ch": "6f12",
            "./it-ch.js": "6f12",
            "./it.js": "6e98",
            "./ja": "079e",
            "./ja.js": "079e",
            "./jv": "b540",
            "./jv.js": "b540",
            "./ka": "201b",
            "./ka.js": "201b",
            "./kk": "6d79",
            "./kk.js": "6d79",
            "./km": "e81d",
            "./km.js": "e81d",
            "./kn": "3e92",
            "./kn.js": "3e92",
            "./ko": "22f8",
            "./ko.js": "22f8",
            "./ku": "2421",
            "./ku.js": "2421",
            "./ky": "9609",
            "./ky.js": "9609",
            "./lb": "440c",
            "./lb.js": "440c",
            "./lo": "b29d",
            "./lo.js": "b29d",
            "./lt": "26f9",
            "./lt.js": "26f9",
            "./lv": "b97c",
            "./lv.js": "b97c",
            "./me": "293c",
            "./me.js": "293c",
            "./mi": "688b",
            "./mi.js": "688b",
            "./mk": "6909",
            "./mk.js": "6909",
            "./ml": "02fb",
            "./ml.js": "02fb",
            "./mn": "958b",
            "./mn.js": "958b",
            "./mr": "39bd",
            "./mr.js": "39bd",
            "./ms": "ebe4",
            "./ms-my": "6403",
            "./ms-my.js": "6403",
            "./ms.js": "ebe4",
            "./mt": "1b45",
            "./mt.js": "1b45",
            "./my": "8689",
            "./my.js": "8689",
            "./nb": "6ce3",
            "./nb.js": "6ce3",
            "./ne": "3a39",
            "./ne.js": "3a39",
            "./nl": "facd",
            "./nl-be": "db29",
            "./nl-be.js": "db29",
            "./nl.js": "facd",
            "./nn": "b84c",
            "./nn.js": "b84c",
            "./pa-in": "f3ff",
            "./pa-in.js": "f3ff",
            "./pl": "8d57",
            "./pl.js": "8d57",
            "./pt": "f260",
            "./pt-br": "d2d4",
            "./pt-br.js": "d2d4",
            "./pt.js": "f260",
            "./ro": "972c",
            "./ro.js": "972c",
            "./ru": "957c",
            "./ru.js": "957c",
            "./sd": "6784",
            "./sd.js": "6784",
            "./se": "ffff",
            "./se.js": "ffff",
            "./si": "eda5",
            "./si.js": "eda5",
            "./sk": "7be6",
            "./sk.js": "7be6",
            "./sl": "8155",
            "./sl.js": "8155",
            "./sq": "c8f3",
            "./sq.js": "c8f3",
            "./sr": "cf1e",
            "./sr-cyrl": "13e9",
            "./sr-cyrl.js": "13e9",
            "./sr.js": "cf1e",
            "./ss": "52bd",
            "./ss.js": "52bd",
            "./sv": "5fbd",
            "./sv.js": "5fbd",
            "./sw": "74dc",
            "./sw.js": "74dc",
            "./ta": "3de5",
            "./ta.js": "3de5",
            "./te": "5cbb",
            "./te.js": "5cbb",
            "./tet": "576c",
            "./tet.js": "576c",
            "./tg": "3b1b",
            "./tg.js": "3b1b",
            "./th": "10e8",
            "./th.js": "10e8",
            "./tl-ph": "0f38",
            "./tl-ph.js": "0f38",
            "./tlh": "cf75",
            "./tlh.js": "cf75",
            "./tr": "0e81",
            "./tr.js": "0e81",
            "./tzl": "cf51",
            "./tzl.js": "cf51",
            "./tzm": "c109",
            "./tzm-latn": "b53d",
            "./tzm-latn.js": "b53d",
            "./tzm.js": "c109",
            "./ug-cn": "6117",
            "./ug-cn.js": "6117",
            "./uk": "ada2",
            "./uk.js": "ada2",
            "./ur": "5294",
            "./ur.js": "5294",
            "./uz": "2e8c",
            "./uz-latn": "010e",
            "./uz-latn.js": "010e",
            "./uz.js": "2e8c",
            "./vi": "2921",
            "./vi.js": "2921",
            "./x-pseudo": "fd7e",
            "./x-pseudo.js": "fd7e",
            "./yo": "7f33",
            "./yo.js": "7f33",
            "./zh-cn": "5c3a",
            "./zh-cn.js": "5c3a",
            "./zh-hk": "49ab",
            "./zh-hk.js": "49ab",
            "./zh-tw": "90ea",
            "./zh-tw.js": "90ea"
        };

        function i(e) {
            var a = t(e);
            return o(a)
        }

        function t(e) {
            if (!o.o(n, e)) {
                var a = new Error("Cannot find module '" + e + "'");
                throw a.code = "MODULE_NOT_FOUND", a
            }
            return n[e]
        }
        i.keys = function() {
            return Object.keys(n)
        }, i.resolve = t, e.exports = i, i.id = "4678"
    },
    "4aca": function(e, a, o) {
        "use strict";
        var n = o("37b3"),
            i = o.n(n);
        i.a
    },
    5042: function(e, a, o) {},
    "635f": function(e, a, o) {
        "use strict";
        var n = o("5042"),
            i = o.n(n);
        i.a
    },
    "93b7": function(e, a, o) {
        "use strict";
        o.r(a);
        o("baa5"), o("e260"), o("e6cf"), o("cca6"), o("a79d");
        var n = o("2b0e"),
            i = function() {
                var e = this,
                    a = e.$createElement,
                    o = e._self._c || a;
                return o("div", {
                    attrs: {
                        id: "inner"
                    }
                }, [o("router-view")], 1)
            },
            t = [],
            r = (o("2b2b"), o("2877")),
            s = {},
            l = Object(r["a"])(s, i, t, !1, null, null, null),
            d = l.exports,
            u = o("8c4f"),
            c = function() {
                var e = this,
                    a = e.$createElement,
                    o = e._self._c || a;
                return o("div", {
                    staticClass: "container",
                    attrs: {
                        id: "dropzone"
                    },
                    on: {
                        dragover: [function(a) {
                            e.dropZone = !e.isLoading
                        }, function(a) {
                            e.dropZone = "0" == e.plugin
                        }],
                        dragleave: function(a) {
                            e.dropZone = !1
                        },
                        drop: function(a) {
                            e.dropZone = !1
                        }
                    }
                }, [e.isLoading ? o("div", {
                    attrs: {
                        id: "loading"
                    }
                }) : e._e(), o("Upload", {
                    directives: [{
                        name: "show",
                        rawName: "v-show",
                        value: 0 == e.dropZone,
                        expression: "dropZone == false"
                    }],
                    attrs: {
                        files: e.files,
                        "drop-zone": e.dropZone
                    }
                }), e.dropZone && !e.isLoading && "0" == e.plugin ? o("b-upload", {
                    attrs: {
                        multiple: "",
                        "drag-drop": ""
                    }
                }, [o("b", {
                    staticClass: "drop-info"
                }, [e._v(e._s(e.lang("Drop files to upload")))])]) : e._e(), e.dropZone ? e._e() : o("div", {
                    staticClass: "container"
                }, [o("div", {
                    attrs: {
                        id: "browser"
                    }
                }, [o("div", {
                    staticClass: "is-flex is-justify-between"
                }, [o("div", {
                    staticClass: "breadcrumb",
                    attrs: {
                        "aria-label": "breadcrumbs"
                    }
                }, [o("ul", e._l(e.breadcrumbs, (function(a, n) {
                    return o("li", {
                        key: n
                    }, [o("a", {
                        on: {
                            click: function(o) {
                                return e.goTo(a.path, e.plugin)
                            }
                        }
                    }, [e._v(e._s(a.name))])])
                })), 0)]), o("div", [o("a", {
                    staticClass: "search-btn",
                    attrs: {
                        id: "search"
                    },
                    on: {
                        click: function(a) {
                            return e.search(e.plugin)
                        }
                    }
                }, [o("b-icon", {
                    attrs: {
                        icon: "search",
                        size: "is-small"
                    }
                })], 1), o("a", {
                    staticClass: "is-paddingless",
                    attrs: {
                        id: "sitemap"
                    },
                    on: {
                        click: function(a) {
                            return e.selectDir(e.plugin)
                        }
                    }
                }, [o("b-icon", {
                    attrs: {
                        icon: "sitemap",
                        size: "is-small"
                    }
                })], 1)])]), "0" == e.plugin ? o("section", {
                    staticClass: "is-flex is-justify-between",
                    attrs: {
                        id: "multi-actions"
                    }
                }, [o("div", [e.checked.length || "0" != e.plugin ? e._e() : o("b-field", {
                    staticClass: "file is-inline-block"
                }, [o("b-upload", {
                    attrs: {
                        multiple: "",
                        native: ""
                    },
                    on: {
                        input: function(a) {
                            e.files = a
                        }
                    }
                }, [e.checked.length ? e._e() : o("a", {
                    staticClass: "is-inline-block",
                    on: {
                        click: function(a) {
                            return e.clearFiles()
                        }
                    }
                }, [o("b-icon", {
                    attrs: {
                        icon: "upload",
                        size: "is-small"
                    }
                }), e._v(" " + e._s(e.lang("Add files")) + " ")], 1)])], 1), e.checked.length || "0" != e.plugin ? e._e() : o("a", {
                    staticClass: "add-new is-inline-block"
                }, [o("b-dropdown", {
                    attrs: {
                        disabled: e.checked.length > 0,
                        "aria-role": "list"
                    }
                }, [o("span", {
                    attrs: {
                        slot: "trigger"
                    },
                    slot: "trigger"
                }, [o("b-icon", {
                    attrs: {
                        icon: "plus",
                        size: "is-small"
                    }
                }), e._v(" " + e._s(e.lang("New")) + " ")], 1), o("b-dropdown-item", {
                    attrs: {
                        "aria-role": "listitem"
                    },
                    on: {
                        click: function(a) {
                            return e.create("dir")
                        }
                    }
                }, [o("b-icon", {
                    attrs: {
                        icon: "folder",
                        size: "is-small"
                    }
                }), e._v(" " + e._s(e.lang("Folder")) + " ")], 1), o("b-dropdown-item", {
                    attrs: {
                        "aria-role": "listitem"
                    },
                    on: {
                        click: function(a) {
                            return e.create("file")
                        }
                    }
                }, [o("b-icon", {
                    attrs: {
                        icon: "file",
                        size: "is-small"
                    }
                }), e._v(" " + e._s(e.lang("File")) + " ")], 1)], 1)], 1), e.checked.length ? o("a", {
                    staticClass: "is-inline-block",
                    on: {
                        click: e.copy
                    }
                }, [o("b-icon", {
                    attrs: {
                        icon: "copy",
                        size: "is-small"
                    }
                }), e._v(" " + e._s(e.lang("Copy")) + " ")], 1) : e._e(), e.checked.length ? o("a", {
                    staticClass: "is-inline-block",
                    on: {
                        click: e.move
                    }
                }, [o("b-icon", {
                    attrs: {
                        icon: "external-link-square-alt",
                        size: "is-small"
                    }
                }), e._v(" " + e._s(e.lang("Move")) + " ")], 1) : e._e(), e.checked.length ? o("a", {
                    staticClass: "is-inline-block",
                    on: {
                        click: e.zip
                    }
                }, [o("b-icon", {
                    attrs: {
                        icon: "file-archive",
                        size: "is-small"
                    }
                }), e._v(" " + e._s(e.lang("Zip")) + " ")], 1) : e._e(), e.checked.length ? o("a", {
                    staticClass: "is-inline-block",
                    on: {
                        click: e.remove
                    }
                }, [o("b-icon", {
                    attrs: {
                        icon: "trash-alt",
                        size: "is-small"
                    }
                }), e._v(" " + e._s(e.lang("Delete")) + " ")], 1) : e._e()], 1), "0" == e.plugin ? o("div", {
                    attrs: {
                        id: "pagination"
                    }
                }, [o("Pagination", {
                    attrs: {
                        perpage: e.perPage
                    },
                    on: {
                        selected: function(a) {
                            e.perPage = a
                        }
                    }
                })], 1) : e._e()]) : e._e(), 0 == e.plugin ? o("b-table", {
                    attrs: {
                        data: e.content,
                        "default-sort": e.defaultSort,
                        paginated: e.perPage > 0,
                        "per-page": e.perPage,
                        "current-page": e.currentPage,
                        hoverable: !0,
                        "is-row-checkable": function(e) {
                            return "back" != e.type
                        },
                        "row-class": function(e) {
                            return "file-row type-" + e.type
                        },
                        "checked-rows": e.checked,
                        loading: e.isLoading,
                        checkable: "write"
                    },
                    on: {
                        "update:currentPage": function(a) {
                            e.currentPage = a
                        },
                        "update:current-page": function(a) {
                            e.currentPage = a
                        },
                        "update:checkedRows": function(a) {
                            e.checked = a
                        },
                        "update:checked-rows": function(a) {
                            e.checked = a
                        },
                        contextmenu: e.rightClick
                    },
                    scopedSlots: e._u([{
                        key: "default",
                        fn: function(a) {
                            return [o("b-table-column", {
                                attrs: {
                                    label: e.lang("Name"),
                                    "custom-sort": e.sortByName,
                                    field: "data.name",
                                    sortable: ""
                                }
                            }, [o("a", {
                                staticClass: "is-block name",
                                on: {
                                    click: function(o) {
                                        return e.itemClick(a.row, e.plugin)
                                    }
                                }
                            }, [e._v(" " + e._s(a.row.name) + " ")])]), o("b-table-column", {
                                attrs: {
                                    label: e.lang("Size"),
                                    "custom-sort": e.sortBySize,
                                    field: "data.size",
                                    sortable: "",
                                    numeric: "",
                                    width: "150"
                                }
                            }, [e._v(" " + e._s("back" == a.row.type || "dir" == a.row.type ? e.lang("Folder") : e.formatBytes(a.row.size)) + " ")]), o("b-table-column", {
                                attrs: {
                                    label: e.lang("Time"),
                                    "custom-sort": e.sortByTime,
                                    field: "data.time",
                                    sortable: "",
                                    numeric: "",
                                    width: "200"
                                }
                            }, [e._v(" " + e._s(a.row.time ? e.formatDate(a.row.time) : "") + " ")]), o("b-table-column", {
                                attrs: {
                                    label: e.lang(""),
                                    width: "12",
                                    id: "table_filemanager_column_links"
                                }
                            }, ["file" == a.row.type || "dir" == a.row.type ? o("button", {
                                staticClass: "button is-small",
                                attrs: {
                                    title: "Copy Link"
                                },
                                on: {
                                    click: function(o) {
                                        return e.getFilePath(a.row.path)
                                    }
                                }
                            }, [o("b-icon", {
                                staticClass: "is-block link",
                                attrs: {
                                    icon: "clipboard",
                                    size: "is-small"
                                }
                            })], 1) : e._e()]), o("b-table-column", {
                                attrs: {
                                    id: "single-actions",
                                    width: "51"
                                }
                            }, ["back" != a.row.type ? o("b-dropdown", {
                                attrs: {
                                    disabled: e.checked.length > 0,
                                    "aria-role": "list",
                                    position: "is-bottom-left"
                                }
                            }, [o("button", {
                                ref: "ref-single-action-button-" + a.row.path,
                                staticClass: "button is-small",
                                attrs: {
                                    slot: "trigger"
                                },
                                slot: "trigger"
                            }, [o("b-icon", {
                                attrs: {
                                    icon: "ellipsis-h",
                                    size: "is-small"
                                }
                            })], 1), "file" == a.row.type ? o("b-dropdown-item", {
                                attrs: {
                                    "aria-role": "listitem"
                                },
                                on: {
                                    click: function(o) {
                                        return e.download(a.row)
                                    }
                                }
                            }, [o("b-icon", {
                                attrs: {
                                    icon: "download",
                                    size: "is-small"
                                }
                            }), e._v(" " + e._s(e.lang("Download")) + " ")], 1) : e._e(), "file" == a.row.type && e.hasPreview(a.row.path) ? o("b-dropdown-item", {
                                attrs: {
                                    "aria-role": "listitem"
                                },
                                on: {
                                    click: function(o) {
                                        return e.preview(a.row)
                                    }
                                }
                            }, [o("b-icon", {
                                attrs: {
                                    icon: "file-alt",
                                    size: "is-small"
                                }
                            }), e._v(" " + e._s(e.lang("View")) + " ")], 1) : e._e(), o("b-dropdown-item", {
                                attrs: {
                                    "aria-role": "listitem"
                                },
                                on: {
                                    click: function(o) {
                                        return e.copy(o, a.row)
                                    }
                                }
                            }, [o("b-icon", {
                                attrs: {
                                    icon: "copy",
                                    size: "is-small"
                                }
                            }), e._v(" " + e._s(e.lang("Copy")) + " ")], 1), o("b-dropdown-item", {
                                attrs: {
                                    "aria-role": "listitem"
                                },
                                on: {
                                    click: function(o) {
                                        return e.move(o, a.row)
                                    }
                                }
                            }, [o("b-icon", {
                                attrs: {
                                    icon: "external-link-square-alt",
                                    size: "is-small"
                                }
                            }), e._v(" " + e._s(e.lang("Move")) + " ")], 1), o("b-dropdown-item", {
                                attrs: {
                                    "aria-role": "listitem"
                                },
                                on: {
                                    click: function(o) {
                                        return e.rename(o, a.row)
                                    }
                                }
                            }, [o("b-icon", {
                                attrs: {
                                    icon: "file-signature",
                                    size: "is-small"
                                }
                            }), e._v(" " + e._s(e.lang("Rename")) + " ")], 1), e.isArchive(a.row) ? o("b-dropdown-item", {
                                attrs: {
                                    "aria-role": "listitem"
                                },
                                on: {
                                    click: function(o) {
                                        return e.unzip(o, a.row)
                                    }
                                }
                            }, [o("b-icon", {
                                attrs: {
                                    icon: "file-archive",
                                    size: "is-small"
                                }
                            }), e._v(" " + e._s(e.lang("Unzip")) + " ")], 1) : e._e(), e.isArchive(a.row) ? e._e() : o("b-dropdown-item", {
                                attrs: {
                                    "aria-role": "listitem"
                                },
                                on: {
                                    click: function(o) {
                                        return e.zip(o, a.row)
                                    }
                                }
                            }, [o("b-icon", {
                                attrs: {
                                    icon: "file-archive",
                                    size: "is-small"
                                }
                            }), e._v(" " + e._s(e.lang("Zip")) + " ")], 1), o("b-dropdown-item", {
                                attrs: {
                                    "aria-role": "listitem"
                                },
                                on: {
                                    click: function(o) {
                                        return e.remove(o, a.row)
                                    }
                                }
                            }, [o("b-icon", {
                                attrs: {
                                    icon: "trash-alt",
                                    size: "is-small"
                                }
                            }), e._v(" " + e._s(e.lang("Delete")) + " ")], 1), "file" == a.row.type || "dir" == a.row.type ? o("b-dropdown-item", {
                                attrs: {
                                    "aria-role": "listitem"
                                },
                                on: {
                                    click: function(o) {
                                        return e.getFilePath(a.row.path)
                                    }
                                }
                            }, [o("b-icon", {
                                attrs: {
                                    icon: "clipboard",
                                    size: "is-small"
                                }
                            }), e._v(" " + e._s(e.lang("Copy link")) + " ")], 1) : e._e()], 1) : e._e()], 1)]
                        }
                    }], null, !1, 2901600900)
                }) : "1" == e.plugin ? o("b-table", {
                    attrs: {
                        data: e.content,
                        "default-sort": e.defaultSort,
                        paginated: !0,
                        "per-page": 9,
                        "current-page": e.currentPage,
                        hoverable: !0,
                        "select-mode": e.single,
                        "is-row-selectable": function(e) {
                            return "back" != e.type
                        },
                        "is-row-selectable": function(e) {
                            return "dir" != e.type
                        },
                        "row-class": function(e) {
                            return "file-row type-" + e.type
                        },
                        "selected-rows": e.checked,
                        loading: e.isLoading,
                        selectable: "write"
                    },
                    on: {
                        "update:currentPage": function(a) {
                            e.currentPage = a
                        },
                        "update:current-page": function(a) {
                            e.currentPage = a
                        },
                        "update:selectedRows": function(a) {
                            e.checked = a
                        },
                        "update:selected-rows": function(a) {
                            e.checked = a
                        }
                    },
                    scopedSlots: e._u([{
                        key: "default",
                        fn: function(a) {
                            return [o("b-table-column", {
                                attrs: {
                                    label: e.lang("Name"),
                                    "custom-sort": e.sortByName,
                                    field: "data.name",
                                    sortable: ""
                                }
                            }, [o("a", {
                                staticClass: "is-block name",
                                on: {
                                    click: function(o) {
                                        return e.itemClick(a.row, e.plugin)
                                    }
                                }
                            }, [e._v(" " + e._s(a.row.name) + " ")])]), o("b-table-column", {
                                attrs: {
                                    label: e.lang("Size"),
                                    "custom-sort": e.sortBySize,
                                    field: "data.size",
                                    sortable: "",
                                    numeric: "",
                                    width: "150"
                                }
                            }, [e._v(" " + e._s("back" == a.row.type || "dir" == a.row.type ? e.lang("Folder") : e.formatBytes(a.row.size)) + " ")]), o("b-table-column", {
                                attrs: {
                                    label: e.lang("Time"),
                                    "custom-sort": e.sortByTime,
                                    field: "data.time",
                                    sortable: "",
                                    numeric: "",
                                    width: "200"
                                }
                            }, [e._v(" " + e._s(a.row.time ? e.formatDate(a.row.time) : "") + " ")]), o("b-table-column", {
                                attrs: {
                                    label: e.lang(""),
                                    width: "20",
                                    id: "table_filemanager_column_links"
                                }
                            }, ["file" == a.row.type ? o("button", {
                                staticClass: "button is-small",
                                attrs: {
                                    title: "Open"
                                },
                                on: {
                                    click: function(o) {
                                        return e.getOpenPathPlugin(a.row.path)
                                    }
                                }
                            }, [e._v(" " + e._s(e.lang("Open")) + " ")]) : e._e()])]
                        }
                    }], null, !1, 2436831503)
                }) : e._e(), "0" == e.plugin ? o("section", {
                    staticClass: "is-flex is-justify-between",
                    attrs: {
                        id: "bottom-info"
                    }
                }, [o("div", [o("span", [e._v(e._s(e.lang("Selected", e.checked.length, e.totalCount)))])]), e.showAllEntries || e.hasFilteredEntries ? o("div", [o("input", {
                    attrs: {
                        type: "checkbox",
                        id: "checkbox"
                    },
                    on: {
                        click: e.toggleHidden
                    }
                }), o("label", {
                    attrs: {
                        for: "checkbox"
                    }
                }, [e._v(" " + e._s(e.lang("Show hidden")))])]) : e._e()]) : e._e()], 1)])], 1)
            },
            p = [],
            m = (o("4de4"), o("4160"), o("13d5"), o("b0c0"), o("a9e3"), o("4d63"), o("ac1f"), o("25f0"), o("8a79"), o("5319"), o("1276"), o("2ca0"), o("159b"), o("4795"), function() {
                var e = this,
                    a = e.$createElement,
                    o = e._self._c || a;
                return o("div", {
                    staticClass: "modal-card"
                }, [o("header", {
                    staticClass: "modal-card-head"
                }, [o("p", {
                    staticClass: "modal-card-title"
                }, [e._v(" " + e._s(e.lang("Select Folder")) + " ")])]), o("section", {
                    staticClass: "modal-card-body"
                }, [o("div", {
                    staticClass: "tree"
                }, [o("ul", {
                    staticClass: "tree-list"
                }, [o("TreeNode", {
                    attrs: {
                        node: e.$store.state.tree
                    },
                    on: {
                        selected: function(a) {
                            e.$emit("selected", a) && e.$parent.close()
                        }
                    }
                })], 1)])]), o("footer", {
                    staticClass: "modal-card-foot"
                }, [o("button", {
                    staticClass: "button",
                    attrs: {
                        type: "button"
                    },
                    on: {
                        click: function(a) {
                            return e.$parent.close()
                        }
                    }
                }, [e._v(" " + e._s(e.lang("Close")) + " ")])])])
            }),
            f = [],
            g = function() {
                var e = this,
                    a = e.$createElement,
                    o = e._self._c || a;
                return o("li", {
                    staticClass: "node-tree"
                }, [o("b-button", {
                    attrs: {
                        type: e.button_type,
                        size: "is-small"
                    },
                    on: {
                        click: function(a) {
                            return e.toggleButton(e.node)
                        }
                    }
                }, [o("span", {
                    staticClass: "icon"
                }, [o("i", {
                    class: e.icon
                })])]), e._v(" "), o("a", {
                    on: {
                        click: function(a) {
                            return e.$emit("selected", e.node)
                        }
                    }
                }, [e._v(e._s(e.node.name))]), e.node.children && e.node.children.length ? o("ul", e._l(e.node.children, (function(a, n) {
                    return o("TreeNode", {
                        key: n,
                        attrs: {
                            node: a
                        },
                        on: {
                            selected: function(a) {
                                return e.$emit("selected", a)
                            }
                        }
                    })
                })), 1) : e._e()], 1)
            },
            h = [],
            w = (o("d3b7"), o("bc3a")),
            v = o.n(w),
            y = o("27ae"),
            b = {
                getUrl: function() {
                    var e = window.parent.location.pathname.lastIndexOf("/"),
                        a = window.parent.location.pathname.substring(0, e);
                    return "/workarea" != a ? "".concat(window.parent.location.origin) + a : "".concat(window.parent.location.origin)
                },
                getConfig: function() {
                    var e = this;
                    return new Promise((function(a, o) {
                        v.a.get(e.getUrl() + "/filemanager/getconfig").then((function(e) {
                            return a(e)
                        }))["catch"]((function(e) {
                            return o(e)
                        }))
                    }))
                },
                changeDir: function(e) {
                    var a = this;
                    return new Promise((function(o, n) {
                        v.a.post(a.getUrl() + "/filemanager/changedir", {
                            to: e.to
                        }).then((function(e) {
                            return o(e.data.data)
                        }))["catch"]((function(e) {
                            return n(e)
                        }))
                    }))
                },
                getDir: function(e) {
                    var a = this;
                    return new Promise((function(o, n) {
                        v.a.post(a.getUrl() + "/filemanager/getdir", {
                            dir: e.dir
                        }).then((function(e) {
                            return o(e.data.data)
                        }))["catch"]((function(e) {
                            return n(e)
                        }))
                    }))
                },
                copyItems: function(e) {
                    var a = this;
                    return new Promise((function(o, n) {
                        v.a.post(a.getUrl() + "/filemanager/copyitems", {
                            destination: e.destination,
                            items: e.items
                        }).then((function(e) {
                            return o(e.data.data)
                        }))["catch"]((function(e) {
                            return n(e)
                        }))
                    }))
                },
                moveItems: function(e) {
                    var a = this;
                    return new Promise((function(o, n) {
                        v.a.post(a.getUrl() + "/filemanager/moveitems", {
                            destination: e.destination,
                            items: e.items
                        }).then((function(e) {
                            return o(e.data.data)
                        }))["catch"]((function(e) {
                            return n(e)
                        }))
                    }))
                },
                renameItem: function(e) {
                    var a = this;
                    return new Promise((function(o, n) {
                        v.a.post(a.getUrl() + "/filemanager/renameitem", {
                            from: e.from,
                            to: e.to,
                            destination: e.destination
                        }).then((function(e) {
                            return o(e.data.data)
                        }))["catch"]((function(e) {
                            return n(e)
                        }))
                    }))
                },
                batchDownload: function(e) {
                    return new Promise((function(a, o) {
                        v.a.post("batchdownload", {
                            items: e.items
                        }).then((function(e) {
                            return a(e.data.data)
                        }))["catch"]((function(e) {
                            return o(e)
                        }))
                    }))
                },
                zipItems: function(e) {
                    var a = this;
                    return new Promise((function(o, n) {
                        v.a.post(a.getUrl() + "/filemanager/zipitems", {
                            name: e.name,
                            items: e.items,
                            destination: e.destination
                        }).then((function(e) {
                            return o(e.data.data)
                        }))["catch"]((function(e) {
                            return n(e)
                        }))
                    }))
                },
                unzipItem: function(e) {
                    var a = this;
                    return new Promise((function(o, n) {
                        v.a.post(a.getUrl() + "/filemanager/unzipitem", {
                            item: e.item,
                            destination: e.destination
                        }).then((function(e) {
                            return o(e.data.data)
                        }))["catch"]((function(e) {
                            return n(e)
                        }))
                    }))
                },
                removeItems: function(e) {
                    var a = this;
                    return new Promise((function(o, n) {
                        v.a.post(a.getUrl() + "/filemanager/deleteitems", {
                            items: e.items
                        }).then((function(e) {
                            return o(e.data.data)
                        }))["catch"]((function(e) {
                            return n(e)
                        }))
                    }))
                },
                createNew: function(e) {
                    var a = this;
                    return new Promise((function(o, n) {
                        v.a.post(a.getUrl() + "/filemanager/createnew", {
                            type: e.type,
                            name: e.name,
                            destination: e.destination
                        }).then((function(e) {
                            return o(e.data.data)
                        }))["catch"]((function(e) {
                            return n(e)
                        }))
                    }))
                },
                downloadItem: function(e) {
                    var a = this;
                    return new Promise((function(o, n) {
                        v.a.get(a.getUrl() + "/filemanager/download&path=" + encodeURIComponent(y["Base64"].encode(e.path)), {
                            transformResponse: [function(e) {
                                return e
                            }]
                        }).then((function(e) {
                            return o(e.data)
                        }))["catch"]((function(e) {
                            return n(e)
                        }))
                    }))
                },
                saveContent: function(e) {
                    var a = this;
                    return new Promise((function(o, n) {
                        v.a.post(a.getUrl() + "/filemanager/savecontent", {
                            name: e.name,
                            content: e.content
                        }).then((function(e) {
                            return o(e.data)
                        }))["catch"]((function(e) {
                            return n(e)
                        }))
                    }))
                },
                getPath: function(e) {
                    var a = this;
                    return new Promise((function(o, n) {
                        v.a.post(a.getUrl() + "/filemanager/getpath", {
                            item: e.item
                        }).then((function(e) {
                            return o(e.data)
                        }))["catch"]((function(e) {
                            return n(e)
                        }))
                    }))
                }
            },
            k = b,
            z = o("2ef0"),
            P = o.n(z),
            U = {
                name: "TreeNode",
                props: {
                    node: {
                        type: Object,
                        required: !0
                    }
                },
                data: function() {
                    return {
                        active: !1,
                        button_type: "is-primary"
                    }
                },
                computed: {
                    icon: function() {
                        return {
                            fas: !0,
                            "mdi-24px": !0,
                            "fa-plus": !this.active,
                            "fa-minus": this.active
                        }
                    }
                },
                mounted: function() {
                    "/" == this.node.path && (this.$store.commit("resetTree"), this.toggleButton(this.node))
                },
                methods: {
                    toggleButton: function(e) {
                        var a = this;
                        this.active ? (this.active = !1, this.$store.commit("updateTreeNode", {
                            children: [],
                            path: e.path
                        })) : (this.active = !0, this.button_type = "is-primary is-loading", k.getDir({
                            dir: e.path
                        }).then((function(o) {
                            a.$store.commit("updateTreeNode", {
                                children: P.a.filter(o.files, ["type", "dir"]),
                                path: e.path
                            }), a.$forceUpdate(), a.button_type = "is-primary"
                        }))["catch"]((function(e) {
                            return a.handleError(e)
                        })))
                    }
                }
            },
            C = U,
            S = (o("4aca"), Object(r["a"])(C, g, h, !1, null, "45d0a157", null)),
            N = S.exports,
            j = {
                name: "Tree",
                components: {
                    TreeNode: N
                }
            },
            A = j,
            D = (o("b069"), Object(r["a"])(A, m, f, !1, null, null, null)),
            F = D.exports,
            L = function() {
                var e = this,
                    a = e.$createElement,
                    o = e._self._c || a;
                return o("div", [o("div", {
                    staticClass: "modal-card"
                }, [o("header", {
                    staticClass: "modal-card-head"
                }, [o("p", {
                    staticClass: "modal-card-title"
                }, [e._v(" " + e._s(e.currentItem.name) + " ")])]), o("section", {
                    staticClass: "modal-card-body preview"
                }, [
                    [o("prism-editor", {
                        attrs: {
                            language: "md",
                            "line-numbers": e.lineNumbers
                        },
                        model: {
                            value: e.content,
                            callback: function(a) {
                                e.content = a
                            },
                            expression: "content"
                        }
                    })]
                ], 2), o("footer", {
                    staticClass: "modal-card-foot"
                }, [o("button", {
                    staticClass: "button",
                    attrs: {
                        type: "button"
                    },
                    on: {
                        click: function(a) {
                            return e.saveFile()
                        }
                    }
                }, [e._v(" " + e._s(e.lang("Save")) + " ")]), o("button", {
                    staticClass: "button",
                    attrs: {
                        type: "button"
                    },
                    on: {
                        click: function(a) {
                            return e.$parent.close()
                        }
                    }
                }, [e._v(" " + e._s(e.lang("Close")) + " ")])])])])
            },
            _ = [],
            T = (o("c197"), o("a878"), o("fdfb"), o("431a")),
            R = o.n(T),
            E = {
                name: "Editor",
                components: {
                    PrismEditor: R.a
                },
                props: ["item"],
                data: function() {
                    return {
                        content: "",
                        currentItem: "",
                        lineNumbers: !0
                    }
                },
                mounted: function() {
                    var e = this;
                    this.currentItem = this.item, k.downloadItem({
                        path: this.item.path
                    }).then((function(a) {
                        e.content = a
                    }))["catch"]((function(a) {
                        return e.handleError(a)
                    }))
                },
                methods: {
                    saveFile: function() {
                        var e = this;
                        k.saveContent({
                            name: this.item.name,
                            content: this.content
                        }).then((function() {
                            e.$toast.open({
                                message: e.lang("Updated"),
                                type: "is-success"
                            }), e.$parent.close()
                        }))["catch"]((function(a) {
                            return e.handleError(a)
                        }))
                    }
                }
            },
            B = E,
            $ = (o("2636"), Object(r["a"])(B, L, _, !1, null, "3c7d1a4c", null)),
            x = $.exports,
            I = function() {
                var e = this,
                    a = e.$createElement,
                    o = e._self._c || a;
                return o("div", [o("div", {
                    staticClass: "modal-card"
                }, [o("div", {
                    staticClass: "modal-card-body preview"
                }, [o("strong", [e._v(e._s(e.currentItem.name))]), o("div", {
                    staticClass: "columns is-mobile"
                }, [o("div", {
                    staticClass: "column mainbox"
                }, [o("img", {
                    staticClass: "mainimg",
                    attrs: {
                        src: e.imageSrc(e.currentItem.path)
                    }
                })]), e.images.length > 1 ? o("div", {
                    staticClass: "column is-one-fifth sidebox"
                }, [o("ul", e._l(e.images, (function(a, n) {
                    return o("li", {
                        key: n
                    }, [o("img", {
                        directives: [{
                            name: "lazy",
                            rawName: "v-lazy",
                            value: e.imageSrc(a.path),
                            expression: "imageSrc(image.path)"
                        }],
                        on: {
                            click: function(o) {
                                e.currentItem = a
                            }
                        }
                    })])
                })), 0)]) : e._e()])])])])
            },
            q = [],
            O = {
                name: "Gallery",
                props: ["item"],
                data: function() {
                    return {
                        content: "",
                        currentItem: "",
                        lineNumbers: !0
                    }
                },
                computed: {
                    images: function() {
                        var e = this;
                        return P.a.filter(this.$store.state.cwd.content, (function(a) {
                            return e.isImage(a.name)
                        }))
                    }
                },
                mounted: function() {
                    this.currentItem = this.item
                },
                methods: {
                    imageSrc: function(e) {
                        return this.getDownloadLink(e)
                    }
                }
            },
            H = O,
            V = (o("14a0"), Object(r["a"])(H, I, q, !1, null, "45cb0efd", null)),
            Z = V.exports,
            M = function() {
                var e = this,
                    a = e.$createElement,
                    o = e._self._c || a;
                return o("div", {
                    staticClass: "modal-card"
                }, [o("header", {
                    staticClass: "modal-card-head"
                }, [o("p", {
                    staticClass: "modal-card-title"
                }, [e._v(" " + e._s(e.lang("Search")) + " ")]), o("b-loading", {
                    attrs: {
                        "is-full-page": !1,
                        active: e.searching
                    },
                    on: {
                        "update:active": function(a) {
                            e.searching = a
                        }
                    }
                })], 1), o("section", {
                    staticClass: "modal-card-body"
                }, [o("b-input", {
                    ref: "input",
                    attrs: {
                        id: "search_files",
                        placeholder: e.lang("Name")
                    },
                    on: {
                        input: e.searchFiles
                    },
                    model: {
                        value: e.term,
                        callback: function(a) {
                            e.term = a
                        },
                        expression: "term"
                    }
                }), o("br"), o("ul", {
                    ref: "results"
                }, e._l(e.results, (function(a, n) {
                    return o("li", {
                        key: n
                    }, [o("a", {
                        on: {
                            click: function(o) {
                                return e.select(a)
                            }
                        }
                    }, [e._v(e._s(a.file.path))])])
                })), 0)], 1), o("footer", {
                    staticClass: "modal-card-foot"
                }, [o("button", {
                    staticClass: "button",
                    attrs: {
                        type: "button"
                    },
                    on: {
                        click: function(a) {
                            return e.$parent.close()
                        }
                    }
                }, [e._v(" " + e._s(e.lang("Close")) + " ")])])])
            },
            W = [],
            G = (o("c975"), {
                name: "Search",
                data: function() {
                    return {
                        active: !1,
                        searching: !1,
                        pending_getdirs: 0,
                        term: "",
                        results: []
                    }
                },
                mounted: function() {
                    this.active = !0, this.searching = !1, this.pending_getdirs = 0, this.$refs.input.focus(), this.$store.state.config.search_simultaneous || (this.$store.state.config.search_simultaneous = 5)
                },
                beforeDestroy: function() {
                    this.active = !1, this.searching = !1
                },
                methods: {
                    select: function(e) {
                        this.$emit("selected", e), this.$parent.close()
                    },
                    searchFiles: P.a.debounce((function(e) {
                        this.results = [], e.length > 0 && (this.searching = !0, this.getDirLimited("/"))
                    }), 1e3),
                    getDirLimited: function(e) {
                        var a = this,
                            o = setInterval((function() {
                                a.active && a.pending_getdirs < a.$store.state.config.search_simultaneous && (a.pending_getdirs++, clearInterval(o), a.getDir(e))
                            }), 200)
                    },
                    getDir: function(e) {
                        var a = this;
                        this.searching = !0, k.getDir({
                            dir: e
                        }).then((function(o) {
                            a.searching = !1, a.pending_getdirs--, P.a.forEach(o.files, (function(o) {
                                o.name.toLowerCase().indexOf(a.term.toLowerCase()) > -1 && a.results.push({
                                    file: o,
                                    dir: e
                                })
                            })), P.a.forEach(P.a.filter(o.files, ["type", "dir"]), (function(e) {
                                a.getDirLimited(e.path)
                            }))
                        }))["catch"]((function(e) {
                            return a.handleError(e)
                        }))
                    }
                }
            }),
            K = G,
            Y = Object(r["a"])(K, M, W, !1, null, null, null),
            J = Y.exports,
            Q = function() {
                var e = this,
                    a = e.$createElement,
                    o = e._self._c || a;
                return o("div", [o("b-select", {
                    attrs: {
                        value: e.perpage,
                        size: "is-small"
                    },
                    on: {
                        input: function(a) {
                            return e.$emit("selected", a)
                        }
                    }
                }, [o("option", {
                    attrs: {
                        value: ""
                    }
                }, [e._v(" " + e._s(e.lang("No pagination")) + " ")]), o("option", {
                    attrs: {
                        value: "5"
                    }
                }, [e._v(" " + e._s(e.lang("Per page", 5)) + " ")]), o("option", {
                    attrs: {
                        value: "10"
                    }
                }, [e._v(" " + e._s(e.lang("Per page", 10)) + " ")]), o("option", {
                    attrs: {
                        value: "15"
                    }
                }, [e._v(" " + e._s(e.lang("Per page", 15)) + " ")])])], 1)
            },
            X = [],
            ee = {
                name: "Pagination",
                props: ["perpage"]
            },
            ae = ee,
            oe = Object(r["a"])(ae, Q, X, !1, null, null, null),
            ne = oe.exports,
            ie = function() {
                var e = this,
                    a = e.$createElement,
                    o = e._self._c || a;
                return o("div", [e.visible && 0 == e.dropZone ? o("div", {
                    staticClass: "progress-box"
                }, [o("div", {
                    staticClass: "box"
                }, [o("div", [o("div", {
                    staticClass: "is-flex is-justify-between"
                }, [o("div", {
                    staticClass: "is-flex"
                }, [o("a", {
                    on: {
                        click: e.toggleWindow
                    }
                }, [o("b-icon", {
                    attrs: {
                        icon: e.progressVisible ? "angle-down" : "angle-up"
                    }
                })], 1), e.activeUploads ? o("span", [e._v(" " + e._s(e.lang("Uploading files", e.resumable.getSize() > 0 ? Math.round(100 * e.resumable.progress()) : 100, e.formatBytes(e.resumable.getSize()))) + " ")]) : e._e(), e.activeUploads && e.paused ? o("span", [e._v(" (" + e._s(e.lang("Paused")) + ") ")]) : e._e(), e.activeUploads ? e._e() : o("span", [e._v(" " + e._s(e.lang("Done")) + " ")])]), o("div", {
                    staticClass: "is-flex"
                }, [e.activeUploads ? o("a", {
                    on: {
                        click: function(a) {
                            return e.togglePause()
                        }
                    }
                }, [o("b-icon", {
                    attrs: {
                        icon: e.paused ? "play-circle" : "pause-circle"
                    }
                })], 1) : e._e(), o("a", {
                    staticClass: "progress-icon",
                    on: {
                        click: function(a) {
                            return e.closeWindow()
                        }
                    }
                }, [o("b-icon", {
                    attrs: {
                        icon: "times"
                    }
                })], 1)])]), o("hr")]), e.progressVisible ? o("div", {
                    staticClass: "progress-items"
                }, e._l(e.resumable.files.slice().reverse(), (function(a, n) {
                    return o("div", {
                        key: n
                    }, [o("div", [o("div", [e._v(e._s("/" != a.relativePath ? a.relativePath : "") + "/" + e._s(a.fileName))]), o("div", {
                        staticClass: "is-flex is-justify-between"
                    }, [o("progress", {
                        class: [a.file.uploadingError ? "is-danger" : "is-primary", "progress is-large"],
                        attrs: {
                            max: "100"
                        },
                        domProps: {
                            value: a.size > 0 ? 100 * a.progress() : 100
                        }
                    }), !a.isUploading() && a.file.uploadingError ? o("a", {
                        staticClass: "progress-icon",
                        on: {
                            click: function(e) {
                                return a.retry()
                            }
                        }
                    }, [o("b-icon", {
                        attrs: {
                            icon: "redo",
                            type: "is-danger"
                        }
                    })], 1) : o("a", {
                        staticClass: "progress-icon",
                        on: {
                            click: function(e) {
                                return a.cancel()
                            }
                        }
                    }, [o("b-icon", {
                        attrs: {
                            icon: a.isComplete() ? "check" : "times"
                        }
                    })], 1)])])])
                })), 0) : e._e()])]) : e._e()])
            },
            te = [],
            re = (o("a15b"), o("fb6a"), o("f056")),
            se = o.n(re),
            le = function() {
                var e = this,
                    a = e.$createElement,
                    o = e._self._c || a;
                return o("div", {
                    staticClass: "modal-card"
                }, [o("header", {
                    staticClass: "modal-card-head"
                }, [o("p", {
                    staticClass: "modal-card-title"
                }, [e._v(" " + e._s(e.lang("Unzip")) + " ")]), o("b-loading", {
                    attrs: {
                        "is-full-page": !1,
                        active: e.searching
                    },
                    on: {
                        "update:active": function(a) {
                            e.searching = a
                        }
                    }
                })], 1), o("section", {
                    staticClass: "modal-card-body"
                }, [o("p", [e._v(" " + e._s(e.lang("Do you want to unzip the file?")) + " ")]), o("br"), o("label", {
                    attrs: {
                        for: "UploadWithoutUnzip"
                    }
                }, [o("input", {
                    attrs: {
                        type: "radio",
                        id: "UploadWithoutUnzip",
                        name: "unzip",
                        value: "1",
                        checked: ""
                    }
                }), e._v(" " + e._s(e.lang("No")) + " ")]), o("br"), o("label", {
                    attrs: {
                        for: "UnzipHere"
                    }
                }, [o("input", {
                    attrs: {
                        type: "radio",
                        id: "UnzipHere",
                        name: "unzip",
                        value: "2"
                    }
                }), e._v(" " + e._s(e.lang("Unzip here")) + " ")]), o("br"), o("label", {
                    attrs: {
                        for: "UnzipInSubfolder"
                    }
                }, [o("input", {
                    attrs: {
                        type: "radio",
                        id: "UnzipInSubfolder",
                        name: "unzip",
                        value: "3"
                    }
                }), e._v(" " + e._s(e.lang("Unzip in subfolder ...")) + " ")])]), o("footer", {
                    staticClass: "modal-card-foot"
                }, [o("button", {
                    staticClass: "button",
                    attrs: {
                        type: "button"
                    },
                    on: {
                        click: function(a) {
                            return e.unzip()
                        }
                    }
                }, [e._v(" " + e._s(e.lang("Accept")) + " ")]), o("button", {
                    staticClass: "button",
                    attrs: {
                        type: "button"
                    },
                    on: {
                        click: function(a) {
                            return e.$parent.close()
                        }
                    }
                }, [e._v(" " + e._s(e.lang("Cancel")) + " ")])])])
            },
            de = [],
            ue = {
                name: "UnzipModal",
                props: ["files", "dropZone"],
                data: function() {
                    return {
                        active: !1,
                        term: "",
                        results: []
                    }
                },
                mounted: function() {
                    this.active = !0
                },
                beforeDestroy: function() {
                    this.active = !1
                },
                methods: {
                    unzip: function() {
                        for (var e = document.getElementsByTagName("input"), a = 0; a < e.length; a++) "radio" == e[a].type && e[a].checked && (1 == e[a].value && this.$parent.close(), 2 == e[a].value && (this.$emit("unzipHere", !0), this.$parent.close()), 3 == e[a].value && (this.$emit("unzipIn", !0), this.$parent.close()))
                    },
                    unzipHere: function() {
                        this.$emit("unzipHere", !0), this.$parent.close()
                    },
                    unzipIn: function() {
                        this.$emit("unzipIn", !0), this.$parent.close()
                    }
                }
            },
            ce = ue,
            pe = Object(r["a"])(ce, le, de, !1, null, null, null),
            me = pe.exports,
            fe = {
                name: "Upload",
                props: ["files", "dropZone"],
                data: function() {
                    return {
                        resumable: {},
                        visible: !1,
                        paused: !1,
                        progressVisible: !1,
                        progress: 0
                    }
                },
                computed: {
                    activeUploads: function() {
                        return this.resumable.files.length > 0 && this.resumable.progress() < 1
                    }
                },
                watch: {
                    files: function(e) {
                        var a = this;
                        P.a.forEach(e, (function(e) {
                            a.resumable.addFile(e)
                        }))
                    }
                },
                mounted: function() {
                    var e = this;
                    this.resumable = new se.a({
                        target: k.getUrl() + "/filemanager/upload",
                        headers: {
                            "x-csrf-token": v.a.defaults.headers.common["x-csrf-token"]
                        },
                        withCredentials: !0,
                        simultaneousUploads: this.$store.state.config.upload_simultaneous,
                        minFileSize: 0,
                        chunkSize: this.$store.state.config.upload_chunk_size
                    }), this.resumable.support ? (this.resumable.assignDrop(document.getElementById("dropzone")), this.resumable.on("fileAdded", (function(a) {
                        e.visible = !0, e.progressVisible = !0, void 0 === a.relativePath || null === a.relativePath || a.relativePath == a.fileName ? a.relativePath = e.$store.state.cwd.location : a.relativePath = [e.$store.state.cwd.location, a.relativePath].join("/").replace("//", "/").replace(a.fileName, "").replace(/\/$/, ""), e.paused || e.resumable.upload()
                    })), this.resumable.on("fileSuccess", (function(a, o) {
                        a.file.uploadingError = !1;
                        var n = a.fileName.split(".").pop(),
                            i = "/" != a.relativePath ? a.relativePath + "/" + a.fileName : "/" + a.fileName,
                            t = o;
                        if ('"Error storing file"' == t) return console.log(o), e.handleError(t), e.resumable.removeFile(a), void(e.activeUploads || e.closeWindow());
                        "zip" === n && e.$modal.open({
                            parent: e,
                            hasModalCard: !0,
                            component: me,
                            events: {
                                unzipHere: function(o) {
                                    e.isLoading = !0, 1 == o && k.unzipItem({
                                        item: i,
                                        destination: "/" != a.relativePath ? a.relativePath : "/"
                                    }).then((function() {
                                        e.$forceUpdate(), k.getDir({
                                            to: ""
                                        }).then((function(a) {
                                            e.$store.commit("setCwd", {
                                                content: a.files,
                                                location: a.location
                                            })
                                        }))["catch"]((function(a) {
                                            return e.handleError(a)
                                        }))
                                    }))["catch"]((function(a) {
                                        e.isLoading = !1, e.handleError(a)
                                    }))
                                },
                                unzipIn: function(o) {
                                    if (e.isLoading = !0, 1 == o) {
                                        var n = a.relativePath;
                                        "/" == n.charAt(n.length - 1) && (n = n.slice(0, -1));
                                        var t = a.fileName,
                                            r = t.lastIndexOf("."),
                                            s = t.substring(0, r);
                                        e.$dialog.prompt({
                                            title: e.lang("Unzip in subfolder"),
                                            cancelText: e.lang("Cancel"),
                                            confirmText: e.lang("Unzip"),
                                            inputAttrs: {
                                                value: s,
                                                maxlength: 100,
                                                required: !1
                                            },
                                            onConfirm: function(o) {
                                                o = o.replaceAll("/", ""), e.isLoading = !0, "" == o ? k.unzipItem({
                                                    item: i,
                                                    destination: "/" != a.relativePath ? a.relativePath : "/"
                                                }).then((function() {
                                                    e.$forceUpdate(), k.getDir({
                                                        to: ""
                                                    }).then((function(a) {
                                                        e.$store.commit("setCwd", {
                                                            content: a.files,
                                                            location: a.location
                                                        })
                                                    }))["catch"]((function(a) {
                                                        return e.handleError(a)
                                                    }))
                                                }))["catch"]((function(a) {
                                                    e.isLoading = !1, e.handleError(a)
                                                })) : (k.createNew({
                                                    type: "dir",
                                                    name: o,
                                                    destination: e.$store.state.cwd.location
                                                }).then((function() {
                                                    e.isLoading = !1, e.$forceUpdate(), k.unzipItem({
                                                        item: i,
                                                        destination: "/" != a.relativePath ? a.relativePath + "/" + o : "/" + o
                                                    }).then((function() {
                                                        e.$forceUpdate(), k.getDir({
                                                            to: ""
                                                        }).then((function(a) {
                                                            e.$store.commit("setCwd", {
                                                                content: a.files,
                                                                location: a.location
                                                            })
                                                        }))["catch"]((function(a) {
                                                            return e.handleError(a)
                                                        }))
                                                    }))["catch"]((function(a) {
                                                        e.isLoading = !1, e.handleError(a)
                                                    }))
                                                }))["catch"]((function(a) {
                                                    e.isLoading = !1, e.handleError(a)
                                                })), e.checked = [])
                                            }
                                        })
                                    }
                                }
                            }
                        }), 0 == e.$unzipHere && k.unzipItem({
                            item: i,
                            destination: "/" != a.relativePath ? a.relativePath : "/"
                        }).then((function() {
                            e.$forceUpdate(), k.getDir({
                                to: ""
                            }).then((function(a) {
                                e.$store.commit("setCwd", {
                                    content: a.files,
                                    location: a.location
                                })
                            }))["catch"]((function(a) {
                                return e.handleError(a)
                            }))
                        }))["catch"]((function(a) {
                            e.isLoading = !1, e.handleError(a)
                        })), e.$forceUpdate(), k.getDir({
                            to: ""
                        }).then((function(a) {
                            e.$store.commit("setCwd", {
                                content: a.files,
                                location: a.location
                            }), e.activeUploads || e.closeWindow()
                        }))["catch"]((function(a) {
                            return e.handleError(a)
                        }))
                    })), this.resumable.on("fileError", (function(e) {
                        e.file.uploadingError = !0
                    }))) : this.$dialog.alert({
                        type: "is-danger",
                        message: this.lang("Browser not supported.")
                    })
                },
                methods: {
                    unzip: function(e, a) {
                        var o = this;
                        0 == this.unzipHere && k.unzipItem({
                            item: e,
                            destination: "/" != a.relativePath ? a.relativePath : "/"
                        }).then((function() {
                            o.$forceUpdate(), k.getDir({
                                to: ""
                            }).then((function(e) {
                                o.$store.commit("setCwd", {
                                    content: e.files,
                                    location: e.location
                                })
                            }))["catch"]((function(e) {
                                return o.handleError(e)
                            }))
                        }))["catch"]((function(e) {
                            o.isLoading = !1, o.handleError(e)
                        }))
                    },
                    closeWindow: function() {
                        var e = this;
                        this.activeUploads ? this.$dialog.confirm({
                            message: this.lang("Are you sure you want to stop all uploads?"),
                            type: "is-danger",
                            cancelText: this.lang("Cancel"),
                            confirmText: this.lang("Confirm"),
                            onConfirm: function() {
                                e.resumable.cancel(), e.visible = !1
                            }
                        }) : (this.visible = !1, this.resumable.cancel())
                    },
                    toggleWindow: function() {
                        this.progressVisible = !this.progressVisible
                    },
                    togglePause: function() {
                        this.paused ? (this.resumable.upload(), this.paused = !1) : (this.resumable.pause(), this.paused = !0)
                    }
                }
            },
            ge = fe,
            he = (o("635f"), Object(r["a"])(ge, ie, te, !1, null, "0bf7b415", null)),
            we = he.exports,
            ve = o("4eb5"),
            ye = o.n(ve);
        n["default"].use(ye.a);
        var be = {
                name: "Browser",
                components: {
                    Pagination: ne,
                    Upload: we
                },
                props: ["plugin"],
                data: function() {
                    return {
                        dropZone: !1,
                        perPage: "",
                        currentPage: 1,
                        checked: [],
                        isLoading: !1,
                        defaultSort: ["data.name", "asc"],
                        files: [],
                        hasFilteredEntries: !1,
                        showAllEntries: !1
                    }
                },
                computed: {
                    breadcrumbs: function() {
                        var e = "",
                            a = [{
                                name: this.lang("Home"),
                                path: "/"
                            }];
                        return P.a.forEach(P.a.split(this.$store.state.cwd.location, "/"), (function(o) {
                            e += o + "/", a.push({
                                name: o,
                                path: e
                            })
                        })), P.a.filter(a, (function(e) {
                            return e.name
                        }))
                    },
                    content: function() {
                        return this.$store.state.cwd.content
                    },
                    totalCount: function() {
                        return Number(P.a.sumBy(this.$store.state.cwd.content, (function(e) {
                            return "file" == e.type || "dir" == e.type
                        })))
                    }
                },
                watch: {
                    $route: function(e) {
                        var a = this;
                        this.isLoading = !0, this.checked = [], this.currentPage = 1, k.changeDir({
                            to: e.query.cd
                        }).then((function(e) {
                            a.$store.commit("setCwd", {
                                content: a.filterEntries(e.files),
                                location: e.location
                            }), a.isLoading = !1
                        }))["catch"]((function(e) {
                            a.isLoading = !1, a.handleError(e)
                        }))
                    }
                },
                mounted: function() {
                    this.loadFiles()
                },
                methods: {
                    clearFiles: function() {
                        document.querySelectorAll("input[type=file]")[0].value = null
                    },
                    toggleHidden: function() {
                        this.showAllEntries = !this.showAllEntries, this.loadFiles(), this.checked = []
                    },
                    filterEntries: function(e) {
                        var a = this,
                            o = this.$store.state.config.filter_entries;
                        if (this.hasFilteredEntries = !1, !this.showAllEntries && "undefined" !== typeof o && o.length > 0) {
                            var n = [];
                            return P.a.forEach(e, (function(e) {
                                var i = !1;
                                P.a.forEach(o, (function(o) {
                                    if ("undefined" !== typeof o && o.length > 0) {
                                        var n = o,
                                            t = n.endsWith("/") ? "dir" : "file";
                                        n = n.replace(/\/$/, "");
                                        var r = n.startsWith("/"),
                                            s = r ? "/" + e.path : e.name;
                                        n = r ? "/" + n : n, n = n.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".$&");
                                        var l = new RegExp("^" + n + "$", "iu");
                                        if (e.type == t && l.test(s)) return i = !0, a.hasFilteredEntries = !0, !1
                                    }
                                })), i || n.push(e)
                            })), n
                        }
                        return e
                    },
                    loadFiles: function() {
                        var e = this;
                        setTimeout((function() {
                            return k.getDir({
                                to: ""
                            }).then((function(a) {
                                e.$store.commit("setCwd", {
                                    content: e.filterEntries(a.files),
                                    location: a.location
                                })
                            }))["catch"]((function(a) {
                                return e.handleError(a)
                            }))
                        }), 800)
                    },
                    goTo: function(e, a) {
                        this.$router.push({
                            name: "browser",
                            params: {
                                plugin: a
                            },
                            query: {
                                cd: e
                            }
                        })["catch"]((function() {}))
                    },
                    getSelected: function() {
                        return P.a.reduce(this.checked, (function(e, a) {
                            return e.push(a), e
                        }), [])
                    },
                    itemClick: function(e, a) {
                        "dir" == e.type || "back" == e.type ? this.goTo(e.path, a) : this.hasPreview(e.path) ? this.preview(e) : this.download(e)
                    },
                    rightClick: function(e, a) {
                        "back" != e.type && (a.preventDefault(), this.$refs["ref-single-action-button-" + e.path].click())
                    },
                    selectDir: function(e) {
                        var a = this;
                        this.$modal.open({
                            parent: this,
                            hasModalCard: !0,
                            component: F,
                            events: {
                                selected: function(o) {
                                    a.goTo(o.path, e)
                                }
                            }
                        })
                    },
                    copy: function(e, a) {
                        var o = this;
                        this.$modal.open({
                            parent: this,
                            hasModalCard: !0,
                            component: F,
                            events: {
                                selected: function(e) {
                                    o.isLoading = !0, k.copyItems({
                                        destination: e.path,
                                        items: a ? [a] : o.getSelected()
                                    }).then((function() {
                                        o.isLoading = !1, o.loadFiles()
                                    }))["catch"]((function(e) {
                                        o.isLoading = !1, o.handleError(e)
                                    })), o.checked = []
                                }
                            }
                        })
                    },
                    move: function(e, a) {
                        var o = this;
                        this.$modal.open({
                            parent: this,
                            hasModalCard: !0,
                            component: F,
                            events: {
                                selected: function(e) {
                                    o.isLoading = !0, k.moveItems({
                                        destination: e.path,
                                        items: a ? [a] : o.getSelected()
                                    }).then((function() {
                                        o.isLoading = !1, o.loadFiles()
                                    }))["catch"]((function(e) {
                                        o.isLoading = !1, o.handleError(e)
                                    })), o.checked = []
                                }
                            }
                        })
                    },
                    batchDownload: function() {
                        var e = this,
                            a = this.getSelected();
                        this.isLoading = !0, k.batchDownload({
                            items: a
                        }).then((function(a) {
                            e.isLoading = !1, e.$dialog.alert({
                                message: e.lang("Your file is ready"),
                                confirmText: e.lang("Download"),
                                onConfirm: function() {
                                    window.open(n["default"].config.baseURL + "/batchdownload&uniqid=" + a.uniqid, "_blank")
                                }
                            })
                        }))["catch"]((function(a) {
                            e.isLoading = !1, e.handleError(a)
                        }))
                    },
                    download: function(e) {
                        window.open(this.getDownloadLink(e.path), "_blank")
                    },
                    search: function(e) {
                        var a = this;
                        this.$modal.open({
                            parent: this,
                            hasModalCard: !0,
                            component: J,
                            events: {
                                selected: function(o) {
                                    a.goTo(o.dir, e)
                                }
                            }
                        })
                    },
                    preview: function(e) {
                        var a = null;
                        this.isImage(e.path) && (a = Z), this.isText(e.path) && (a = x), this.$modal.open({
                            parent: this,
                            props: {
                                item: e
                            },
                            hasModalCard: !0,
                            component: a
                        })
                    },
                    isArchive: function(e) {
                        return "file" == e.type && "zip" == e.name.split(".").pop()
                    },
                    unzip: function(e, a) {
                        var o = this;
                        this.$modal.open({
                            parent: this,
                            hasModalCard: !0,
                            component: me,
                            events: {
                                unzipHere: function(e) {
                                    o.isLoading = !0, 1 == e && k.unzipItem({
                                        item: a.path,
                                        destination: o.$store.state.cwd.location
                                    }).then((function() {
                                        o.isLoading = !1, o.loadFiles()
                                    }))["catch"]((function(e) {
                                        o.isLoading = !1, o.handleError(e)
                                    }))
                                },
                                unzipIn: function(e) {
                                    if (o.isLoading = !0, 1 == e) {
                                        var n = a.path,
                                            i = n.lastIndexOf("."),
                                            t = n.substring(0, i),
                                            r = t.lastIndexOf("/");
                                        t = t.substring(r + 1), o.$dialog.prompt({
                                            title: o.lang("Unzip in subfolder"),
                                            cancelText: o.lang("Cancel"),
                                            confirmText: o.lang("Unzip"),
                                            inputAttrs: {
                                                value: t,
                                                maxlength: 100,
                                                required: !1
                                            },
                                            onConfirm: function(e) {
                                                e = e.replaceAll("/", ""), o.isLoading = !0, "" == e ? k.unzipItem({
                                                    item: a.path,
                                                    destination: o.$store.state.cwd.location
                                                }).then((function() {
                                                    o.isLoading = !1, o.loadFiles()
                                                }))["catch"]((function(e) {
                                                    o.isLoading = !1, o.handleError(e)
                                                })) : k.createNew({
                                                    type: "dir",
                                                    name: e,
                                                    destination: o.$store.state.cwd.location
                                                }).then((function() {
                                                    o.isLoading = !1, o.loadFiles(), k.unzipItem({
                                                        item: a.path,
                                                        destination: o.$store.state.cwd.location + "/" + e
                                                    }).then((function() {
                                                        o.isLoading = !1, o.loadFiles()
                                                    }))["catch"]((function(e) {
                                                        o.isLoading = !1, o.handleError(e)
                                                    }))
                                                }))["catch"]((function(e) {
                                                    o.isLoading = !1, o.handleError(e)
                                                }))
                                            }
                                        }), o.isLoading = !1, o.loadFiles(), o.checked = []
                                    }
                                }
                            }
                        })
                    },
                    zip: function(e, a) {
                        var o = this;
                        this.$dialog.prompt({
                            message: this.lang("Name"),
                            cancelText: this.lang("Cancel"),
                            confirmText: this.lang("Create"),
                            inputAttrs: {
                                value: this.$store.state.config.default_archive_name,
                                placeholder: this.$store.state.config.default_archive_name,
                                maxlength: 100,
                                required: !1
                            },
                            onConfirm: function(e) {
                                e && (o.isLoading = !0, k.zipItems({
                                    name: e,
                                    items: a ? [a] : o.getSelected(),
                                    destination: o.$store.state.cwd.location
                                }).then((function() {
                                    o.isLoading = !1, o.loadFiles()
                                }))["catch"]((function(e) {
                                    o.isLoading = !1, o.handleError(e)
                                })), o.checked = [])
                            }
                        })
                    },
                    getFilePath: function(e) {
                        k.getPath({
                            item: e
                        }).then((function(e) {
                            var a = document.createElement("textarea");

                            // To review:
                            // See #238 (avoid wrong pahts on the Windows desktop version)
                            let lnk = e.path;
                            lnk = lnk.replace(/\\/g, "/");

                            a.textContent = lnk, a.setAttribute("style", "position:absolute; right:200%;"), document.body.appendChild(a), a.select(), a.setSelectionRange(0, 99999), document.execCommand("copy"), a.remove()
                        }))
                    },
                    getOpenPathPlugin: function(e) {
                        k.getPath({
                            item: e
                        }).then((function(e) {
                            var a = e.path.lastIndexOf("/"),
                                o = e.path.substring(a + 1);
                            window.parent.$(".tox-textfield[role='combobox']")[0].value = e.path, window.parent.$(".tox-textfield[role='combobox']")[0].setAttribute("value", e.path), window.parent.$(".tox-textfield[tabindex='-1']")[2].value = o, window.parent.$(".tox-dialog-wrap")[1].remove()
                        }))
                    },
                    rename: function(e, a) {
                        var o = this;
                        this.$dialog.prompt({
                            message: this.lang("New name"),
                            cancelText: this.lang("Cancel"),
                            confirmText: this.lang("Rename"),
                            inputAttrs: {
                                value: a ? a.name : this.getSelected()[0].name,
                                maxlength: 100,
                                required: !1
                            },
                            onConfirm: function(e) {
                                o.isLoading = !0, k.renameItem({
                                    from: a.name,
                                    to: e,
                                    destination: o.$store.state.cwd.location
                                }).then((function() {
                                    o.isLoading = !1, o.loadFiles()
                                }))["catch"]((function(e) {
                                    o.isLoading = !1, o.handleError(e)
                                })), o.checked = []
                            }
                        })
                    },
                    create: function(e) {
                        var a = this;
                        this.$dialog.prompt({
                            cancelText: this.lang("Cancel"),
                            confirmText: this.lang("Create"),
                            inputAttrs: {
                                placeholder: "dir" == e ? "MyFolder" : "file.txt",
                                maxlength: 100,
                                required: !1
                            },
                            onConfirm: function(o) {
                                a.isLoading = !0, k.createNew({
                                    type: e,
                                    name: o,
                                    destination: a.$store.state.cwd.location
                                }).then((function() {
                                    a.isLoading = !1, a.loadFiles()
                                }))["catch"]((function(e) {
                                    a.isLoading = !1, a.handleCreateError(e)
                                })), a.checked = []
                            }
                        })
                    },
                    remove: function(e, a) {
                        var o = this;
                        this.$dialog.confirm({
                            message: this.lang("Are you sure you want to do this?"),
                            type: "is-danger",
                            cancelText: this.lang("No"),
                            confirmText: this.lang("Yes"),
                            onConfirm: function() {
                                o.isLoading = !0, k.removeItems({
                                    items: a ? [a] : o.getSelected()
                                }).then((function() {
                                    o.isLoading = !1, o.loadFiles()
                                }))["catch"]((function(e) {
                                    o.isLoading = !1, o.handleError(e)
                                })), o.checked = []
                            }
                        })
                    },
                    sortByName: function(e, a, o) {
                        return this.customSort(e, a, !o, "name")
                    },
                    sortBySize: function(e, a, o) {
                        return this.customSort(e, a, !o, "size")
                    },
                    sortByTime: function(e, a, o) {
                        return this.customSort(e, a, !o, "time")
                    },
                    customSort: function(e, a, o, n) {
                        return "back" == e.type ? -1 : "back" == a.type ? 1 : "dir" == e.type && "dir" != a.type ? -1 : "dir" == a.type && "dir" != e.type ? 1 : a.type == e.type ? e[n] === a[n] ? this.customSort(e, a, !1, "name") : P.a.isString(e[n]) ? e[n].localeCompare(a[n]) * (o ? -1 : 1) : (e[n] < a[n] ? -1 : 1) * (o ? -1 : 1) : void 0
                    }
                }
            },
            ke = be,
            ze = (o("9ee9"), Object(r["a"])(ke, c, p, !1, null, "2ab4f320", null)),
            Pe = ze.exports;
        n["default"].use(u["a"]);

        ////////////////////////////////////////////////

        // Add function to recognize translations
        _ = window.parent._;

        ////////////////////////////////////////////////

        var Ue = new u["a"]({
                mode: "hash",
                routes: [{
                    path: "/:plugin?/:odeSessionId?",
                    name: "browser",
                    component: Pe,
                    props: !0
                }]
            }),
            Ce = o("53ca"),
            Se = o("2f62"),
            Ne = (o("b680"), o("acd8"), o("c1df")),
            je = o.n(Ne),
            Ae = {
                "Selected": _("Selected: {0} of {1}"),
                "Uploading files": _("Uploading {0}% of {1}"),
                "File size error": _("{0} is too large, please upload files less than {1}"),
                "Upload failed": _("{0} failed to upload"),
                "Per page": _("{0} Per Page"),
                "Folder": _("Folder"),
                "Not Found": _("Not Found"),
                "Not Allowed": _("Not Allowed"),
                "Unknown error": _("Unknown error"),
                "Add files": _("Add files"),
                "New": _("New"),
                "New name": _("New name"),
                "No pagination": _("No pagination"),
                "Time": _("Time"),
                "Name": _("Name"),
                "Size": _("Size"),
                "Home": _("Home"),
                "Copy": _("Copy"),
                "Move": _("Move"),
                "Rename": _("Rename"),
                "Required": _("Please fill out this field"),
                "Zip": _("Zip"),
                "Batch Download": _("Batch Download"),
                "Unzip": _("Unzip"),
                "Delete": _("Delete"),
                "Download": _("Download"),
                "Copy link": _("Copy link"),
                "Done": _("Done"),
                "File": _("File"),
                "Drop files to upload": _("Drop files to upload"),
                "Close": _("Close"),
                "Select Folder": _("Select Folder"),
                "Files": _("Files"),
                "Cancel": _("Cancel"),
                "Paused": _("Paused"),
                "Confirm": _("Confirm"),
                "Create": _("Create"),
                "Save": _("Save"),
                "Read": _("Read"),
                "Write": _("Write"),
                "Upload": _("Upload"),
                "Homedir": _("Home Folder"),
                "Leave blank for no change": _("Leave blank for no change"),
                "Are you sure you want to do this?": _("Are you sure you want to do this?"),
                "Are you sure you want to allow access to everyone?": _("Are you sure you want to allow access to everyone?"),
                "Are you sure you want to stop all uploads?": _("Are you sure you want to stop all uploads?"),
                "Something went wrong": _("Something went wrong"),
                "Invalid directory": _("Invalid directory"),
                "This field is required": _("This field is required"),
                "Updated": _("Updated"),
                "Deleted": _("Deleted"),
                "Your file is ready": _("Your file is ready"),
                "View": _("View"),
                "Search": _("Search"),
                "Show hidden": _("Show hidden"),
                "Do you want to unzip the file?": _("Do you want to unzip the file?"),
                "Yes": _("Yes"),
                "No": _("No"),
                "Upload without unzip": _("Upload without unzip"),
                "Unzip here": _("Unzip here"),
                "Unzip in subfolder ...": _("Unzip in subfolder ..."),
                "Unzip in subfolder": _("Unzip in subfolder"),
                "Unzip": _("Unzip"),
                "Accept": _("Accept"),
                "Cancel": _("Cancel"),
                "There was a problem creating the archive":_("There was a problem creating the archive"),
                '"Error storing file"':_("File type not allowed or size over limit"),
            },
            De = Ae,
            Fe = {
                Selected: "Seleccionados: {0} de {1}",
                "Uploading files": "Subiendo {0}% de {1}",
                "File size error": "{0} es demasiado grande, por favor suba ficheros menores a {1}",
                "Upload failed": "{0} no se pudo subir",
                "Per page": "{0} por página",
                Folder: "Carpeta",
                "Login failed, please try again": "Inicio de sesión incorrecto, por favor pruebe de nuevo",
                "Already logged in": "Ya había iniciado sesión.",
                "Please enter username and password": "Por favor, escriba nombre de usuario y contraseña.",
                "Not Found": "No encontrado",
                "Not Allowed": "No permitido",
                "Please log in": "Por favor, inicie sesión",
                "Unknown error": "Error desconocido",
                "Add files": "Añadir ficheros",
                New: "Nuevo",
                "New name": "Nuevo nombre",
                Username: "Nombre de usuario",
                Password: "Contraseña",
                Login: "Iniciar sesión",
                Logout: "Salir",
                Profile: "Perfil",
                "No pagination": "Sin paginación",
                Time: "Fecha",
                Name: "Nombre",
                Size: "Tamaño",
                Home: "Carpeta principal",
                Copy: "Copiar",
                Move: "Mover",
                Rename: "Renombrar",
                Required: "Por favor, rellene este campo",
                Zip: "Comprimir",
                "Batch Download": "Descarga por lotes",
                Unzip: "Descomprimir",
                Delete: "Eliminar",
                Download: "Descargar",
                "Copy link": "Copiar enlace",
                Done: "Hecho",
                File: "Archivo",
                "Drop files to upload": "Soltar archivos para subir",
                Close: "Cerrar",
                "Select Folder": "Seleccionar carpeta",
                Users: "Usuarios",
                Files: "Ficheros",
                Role: "Rol",
                Cancel: "Cancelar",
                Paused: "Pausado",
                Confirm: "Confirmar",
                Create: "Crear",
                User: "Usuario",
                Admin: "Administrador",
                Save: "Guardar",
                Read: "Leer",
                Write: "Escribir",
                Upload: "Subir",
                Permissions: "Permisos",
                Homedir: "Carpeta inicial",
                "Leave blank for no change": "Dejar en blanco para no cambiar",
                "Are you sure you want to do this?": "¿Seguro que quiere hacer esto?",
                "Are you sure you want to allow access to everyone?": "¿Seguro que quiere permitir el acceso a todo el mundo?",
                "Are you sure you want to stop all uploads?": "¿Seguro que quiere parar todas las subidas?",
                "Something went wrong": "Algo ha ido mal",
                "Invalid directory": "Carpeta incorrecta",
                "This field is required": "Este campo es obligatorio",
                "Username already taken": "El nombre de usuario ya existe",
                "User not found": "Usuario no encontrado",
                "Old password": "Contraseña anterior",
                "New password": "Nueva contraseña",
                "Wrong password": "Contraseña incorrecta",
                Updated: "Actualizado",
                Deleted: "Eliminado",
                "Your file is ready": "Su fichero está listo",
                View: "View",
                Search: "Search",
                "Download permission": "Descargar",
                Guest: "Guest",
                "Show hidden": "Mostrar oculto",
                "Do you want to unzip the file?": "¿Quieres descomprimir el archivo zip?"
            },
            Le = Fe,
            _e = {
                Selected: "Ausgewählt: {0} von {1}",
                "Uploading files": "Hochladen: {0}% von {1}",
                "File size error": "{0} ist zu groß, bitte nur Dateien hochladen, die kleiner als {1} sind.",
                "Upload failed": "{0} wurde(n) nicht hochgeladen",
                "Per page": "{0} pro Seite",
                Folder: "Ordner",
                "Login failed, please try again": "Anmeldung fehlgeschlagen, bitte nochmal versuchen.",
                "Already logged in": "Bereits angemeldet",
                "Please enter username and password": "Bitte Benutzername und Passwort eingeben.",
                "Not Found": "Nicht gefunden",
                "Not Allowed": "Nicht erlaubt",
                "Please log in": "Bitte anmelden",
                "Unknown error": "Unbekannter Fehler",
                "Add files": "Dateien hinzufügen",
                New: "Neu",
                "New name": "Neuer Name",
                Username: "Benutzername",
                Password: "Passwort",
                Login: "Anmelden",
                Logout: "Abmelden",
                Profile: "Profil",
                "No pagination": "Kein Seitenumbruch",
                Time: "Zeitpunkt",
                Name: "Name",
                Size: "Größe",
                Home: "Home",
                Copy: "Kopieren",
                Move: "Verschieben",
                Rename: "Umbenennen",
                Required: "Bitte dieses Feld ausfüllen",
                Zip: "Zip",
                "Batch Download": "Batch Download",
                Unzip: "Entpacken",
                Delete: "Löschen",
                Download: "Herunterladen",
                "Copy link": "Link kopieren",
                Done: "Fertig",
                File: "Datei",
                "Drop files to upload": "Dateien zum Hochladen hier ablegen",
                Close: "Schließen",
                "Select Folder": "Ordner auswählen",
                Users: "Benutzer",
                Files: "Dateien",
                Role: "Rolle",
                Cancel: "Abbrechen",
                Paused: "Pausiert",
                Confirm: "Bestätigen",
                Create: "Erstellen",
                User: "Benutzer",
                Admin: "Admin",
                Save: "Speichern",
                Read: "Lesen",
                Write: "Schreiben",
                Upload: "Hochladen",
                Permissions: "Berechtigungen",
                Homedir: "Home Ordner",
                "Leave blank for no change": "Leer lassen, um keine Änderung vorzunehmen",
                "Are you sure you want to do this?": "Sind Sie sicher, dass Sie das tun wollen?",
                "Are you sure you want to allow access to everyone?": "Sind Sie sicher, dass Sie jedem den Zugang ermöglichen wollen?",
                "Are you sure you want to stop all uploads?": "Sind Sie sicher, dass Sie alle Uploads stoppen wollen?",
                "Something went wrong": "Etwas ist schief gelaufen",
                "Invalid directory": "Ungültiges Verzeichnis",
                "This field is required": "Dieses Feld ist erforderlich",
                "Username already taken": "Benutzername bereits vergeben",
                "User not found": "Benutzer nicht gefunden",
                "Old password": "Altes Passwort",
                "New password": "Neues Passwort",
                "Wrong password": "Falsches Passwort",
                Updated: "Aktualisiert",
                Deleted: "Gelöscht",
                "Your file is ready": "Ihre Datei ist fertig",
                View: "Ansicht",
                Search: "Suche",
                "Download permission": "Herunterladen",
                Guest: "Gast",
                "Show hidden": "Verborgenes zeigen"
            },
            Te = _e,
            Re = {
                Selected: "Terpilih: {0} of {1}",
                "Uploading files": "Mengunggah {0}% of {1}",
                "File size error": "{0} file terlalu besar, harap unggah file lebih kecil dari {1}",
                "Upload failed": "{0} gagal diunggah",
                "Per page": "{0} Per Halaman",
                Folder: "Berkas",
                "Login failed, please try again": "Gagal masuk, silakan coba lagi",
                "Already logged in": "Telah masuk.",
                "Please enter username and password": "Silahkan masukan nama pengguna dan kata sandi.",
                "Not Found": "Tidak ditemukan",
                "Not Allowed": "Tidak dibolehkan",
                "Please log in": "Silahkan masuk",
                "Unknown error": "Kesalahan tidak dikenal",
                "Add files": "Tambahkan berkas",
                New: "Baru",
                "New name": "Nama baru",
                Username: "Nama pengguna",
                Password: "Kata sandi",
                Login: "Masuk",
                Logout: "Keluar",
                Profile: "Profil",
                "No pagination": "Tidak ada halaman",
                Time: "Waktu",
                Name: "Nama",
                Size: "Ukuran",
                Home: "Rumah",
                Copy: "Salin",
                Move: "Pindah",
                Rename: "Ubah nama",
                Required: "Silakan isi bidang ini",
                Zip: "Zip",
                "Batch Download": "Unduh Batch",
                Unzip: "Unzip",
                Delete: "Hapus",
                Download: "Unduh",
                "Copy link": "Salin tautan",
                Done: "Selesai",
                File: "File",
                "Drop files to upload": "Letakkan file untuk diunggah",
                Close: "Tutup",
                "Select Folder": "Pilih Berkas",
                Users: "Pengguna",
                Files: "Arsip",
                Role: "Peran",
                Cancel: "Batal",
                Paused: "Dijeda",
                Confirm: "Konfirmasi",
                Create: "Buat",
                User: "Pengguna",
                Admin: "Admin",
                Save: "Simpan",
                Read: "Baca",
                Write: "Tulis",
                Upload: "Unggah",
                Permissions: "Izin",
                Homedir: "Beranda direktori",
                "Leave blank for no change": "Biarkan kosong tanpa perubahan",
                "Are you sure you want to do this?": "Anda yakin ingin melakukan ini?",
                "Are you sure you want to allow access to everyone?": "Apakah anda yakin ingin mengizinkan akses ke semua orang?",
                "Are you sure you want to stop all uploads?": "Apakah anda yakin ingin menghentikan semua unggahan?",
                "Something went wrong": "Ada yang salah",
                "Invalid directory": "Direktori salah",
                "This field is required": "Bagian ini diperlukan",
                "Username already taken": "Nama pengguna sudah digunakan",
                "User not found": "Pengguna tidak ditemukan",
                "Old password": "Kata sandi lama",
                "New password": "Kata sandi baru",
                "Wrong password": "Kata sandi salah",
                Updated: "Diperbarui",
                Deleted: "Dihapus",
                "Your file is ready": "File Anda sudah siap",
                View: "Lihat",
                Search: "Cari",
                "Download permission": "Unduh",
                Guest: "Tamu",
                "Show hidden": "Tunjukkan tersembunyi"
            },
            Ee = Re,
            Be = {
                Selected: "Seçilen: {0} - {1}",
                "Uploading files": "Yükleniyor {0}% - {1}",
                "File size error": "{0} çok büyük, lütfen {1} den küçük dosya yükleyin",
                "Upload failed": "{0} yüklenemedi",
                "Per page": "Sayfa başına {0} tane",
                Folder: "Klasör",
                "Login failed, please try again": "Giriş başarısız. Lütfen tekrar deneyin",
                "Already logged in": "Zaten giriş yapılmış.",
                "Please enter username and password": "Lütfen kullanıcı adınızı ve şifrenizi giriniz.",
                "Not Found": "Bulunamadı",
                "Not Allowed": "İzin verilmedi",
                "Please log in": "Lütfen giriş yapın",
                "Unknown error": "Bilinmeyen hata",
                "Add files": "Dosya Ekle",
                New: "Yeni",
                "New name": "Yeni Ad",
                Username: "Kullanıcı Adı",
                Password: "Parola",
                Login: "Giriş",
                Logout: "Çıkış",
                Profile: "Profil",
                "No pagination": "Sayfa Yok",
                Time: "Zaman",
                Name: "Ad",
                Size: "Boyut",
                Home: "Anasayfa",
                Copy: "Kopyala",
                Move: "Taşı",
                Rename: "Yeniden adlandır",
                Required: "Lütfen bu alanı doldurun",
                Zip: "Zip",
                "Batch Download": "Batch İndirme",
                Unzip: "Zipi çıkart",
                Delete: "Sil",
                Download: "İndir",
                "Copy link": "Bağlantıyı Kopyala",
                Done: "Tamam",
                File: "Dosya",
                "Drop files to upload": "Yüklemek için dosyayı sürükle",
                Close: "Kapat",
                "Select Folder": "Klasör Seç",
                Users: "Kullanıcılar",
                Files: "Dosyalar",
                Role: "Rol",
                Cancel: "İptal",
                Paused: "Durduruldu",
                Confirm: "Onayla",
                Create: "Oluştur",
                User: "Kullanıcı",
                Admin: "Admin",
                Save: "Kaydet",
                Read: "Okuma",
                Write: "Yazma",
                Upload: "Yükleme",
                Permissions: "İzimler",
                Homedir: "Ana Klasör",
                "Leave blank for no change": "Değişiklik yapmamak için boş bırakın",
                "Are you sure you want to do this?": "Bunu yapmak istediğinizden emin misiniz?",
                "Are you sure you want to allow access to everyone?": "Herkese erişime izin vermek istediğinizinden emin misiniz?",
                "Are you sure you want to stop all uploads?": "Tüm yüklemeleri durdurmak istediğinizden emin misiniz?",
                "Something went wrong": "Bir şeyler yanlış gitti",
                "Invalid directory": "Geçersiz dizin",
                "This field is required": "Bu alan gereklidir",
                "Username already taken": "Kullanıcı adı önceden alınmış",
                "User not found": "Kullanıcı bulunamadı",
                "Old password": "Eski parola",
                "New password": "Yeni parola",
                "Wrong password": "parola hatalı",
                Updated: "Güncellendi",
                Deleted: "Silindi",
                "Your file is ready": "Dosyanız Hazır",
                View: "View",
                Search: "Search",
                "Download permission": "İndir",
                Guest: "Guest",
                "Show hidden": "Gizlenenleri göster"
            },
            $e = Be,
            xe = {
                Selected: "Pasirinkta: {0} iš {1}",
                "Uploading files": "Įkeliama {0}% iš {1}",
                "File size error": "{0} yra per didelis, prašome įkelti mažesnius failus nei {1}",
                "Upload failed": "{0} nepavyko įkelti",
                "Per page": "{0} puslapyje",
                Folder: "Aplankas",
                "Login failed, please try again": "Nepavyko prisijungti, bandykite dar kartą",
                "Already logged in": "Jau esate prisijungęs.",
                "Please enter username and password": "Prašome įvesti prisijungimo vardą ir slaptažodį.",
                "Not Found": "Nerasta",
                "Not Allowed": "Neleidžiama",
                "Please log in": "Prašome prisijungti",
                "Unknown error": "Nežinoma klaida",
                "Add files": "Įkelti failus",
                New: "Naujas",
                "New name": "Naujas pavadinimas",
                Username: "Prisijungimo vardas",
                Password: "Slaptažodis",
                Login: "Prisijungti",
                Logout: "Atsijungti",
                Profile: "Profilis",
                "No pagination": "Nepuslapiuoti",
                Time: "Laikas",
                Name: "Pavadinimas",
                Size: "Dydis",
                Home: "Pradžia",
                Copy: "Kopijuoti",
                Move: "Perkelti",
                Rename: "Pervadinti",
                Required: "Prašome užpildyti šį lauką",
                Zip: "Zip",
                "Batch Download": "Atsiųsti paketą",
                Unzip: "Išpakuoti",
                Delete: "Pašalinti",
                Download: "Atsiųsti",
                "Copy link": "Kopijuoti nuorodą",
                Done: "Atlikta",
                File: "Failas",
                "Drop files to upload": "Nutempti failus įkėlimui",
                Close: "Užverti",
                "Select Folder": "Pasirinkite aplanką",
                Users: "Vartotojai",
                Files: "Failai",
                Role: "Vaidmuo",
                Cancel: "Atšaukti",
                Paused: "Pristabdytas",
                Confirm: "Patvirtinti",
                Create: "Sukurti",
                User: "Vartotojas",
                Admin: "Admin",
                Save: "Išsaugoti",
                Read: "Nuskaityti",
                Write: "Įrašyti",
                Upload: "Įkelti",
                Permissions: "Leidimai",
                Homedir: "Pradžios aplankas",
                "Leave blank for no change": "Palikite tuščią, jei nenorite nieko keisti",
                "Are you sure you want to do this?": "Ar Jūs įsitikinęs, kad norite tai atlikti?",
                "Are you sure you want to allow access to everyone?": "Ar Jūs įsitikinęs, kad norite atverti prieigą prie failų bet kam?",
                "Are you sure you want to stop all uploads?": "Ar Jūs įsitikinęs, kad norite sustabdyti visus įkėlimus?",
                "Something went wrong": "Kažkas negerai",
                "Invalid directory": "Neteisingas aplankas",
                "This field is required": "Šį lauką privalote užpildyti",
                "Username already taken": "Toks prisijungimo vardas jau egzistuoja",
                "User not found": "Vartotojas nerastas",
                "Old password": "Senas slaptažodis",
                "New password": "Naujas slaptažodis",
                "Wrong password": "Klaidingas slaptažodis",
                Updated: "Atnaujintas",
                Deleted: "Ištrintas",
                "Your file is ready": "Jūsų failas paruoštas",
                View: "View",
                Search: "Search",
                "Download permission": "Atsiųsti",
                Guest: "Guest",
                "Show hidden": "Rodyti paslėptą"
            },
            Ie = xe,
            qe = {
                Selected: "Selecionado: {0} de {1}",
                "Uploading files": "Fazendo o upload {0}% de {1}",
                "File size error": "{0} é muito grande, por favor faça upload de arquivos menores que {1}",
                "Upload failed": "{0} falhou ao fazer o upload",
                "Per page": "{0} Por página",
                Folder: "Diretório",
                "Login failed, please try again": "Login falhou, por favor tente novamente",
                "Already logged in": "Já está logado",
                "Please enter username and password": "Por favor entre com o nome de usuário e a senha",
                "Not Found": "Não encontrado",
                "Not Allowed": "Não autorizado",
                "Please log in": "Por favor faça o login",
                "Unknown error": "Erro desconhecido",
                "Add files": "Adicionar arquivos",
                New: "Novo",
                "New name": "Novo nome",
                Username: "Nome de usuário",
                Password: "Senha",
                Login: "Entrar",
                Logout: "Sair",
                Profile: "Perfil",
                "No pagination": "Sem paginação",
                Time: "Data",
                Name: "Nome",
                Size: "Tamanho",
                Home: "Página inicial",
                Copy: "Copiar",
                Move: "Mover",
                Rename: "Renomear",
                Required: "Por favor preencha este campo",
                Zip: "Comprimir",
                "Batch Download": "Download em lote",
                Unzip: "Descomprimir",
                Delete: "Deletar",
                Download: "Download",
                "Copy link": "Copiar link",
                Done: "Finalizado",
                File: "Arquivo",
                "Drop files to upload": "Arraste arquivos para fazer o upload",
                Close: "Fechar",
                "Select Folder": "Selecionar diretório",
                Users: "Usuários",
                Files: "Arquivos",
                Role: "Perfil",
                Cancel: "Cancelar",
                Paused: "Pausado",
                Confirm: "Confirmar",
                Create: "Criar",
                User: "Usuário",
                Admin: "Administrador",
                Save: "Salvar",
                Read: "Ler",
                Write: "Escrever",
                Upload: "Upload",
                Permissions: "Permissões",
                Homedir: "Página inicial",
                "Leave blank for no change": "Deixe em branco para não fazer nenhuma alteração",
                "Are you sure you want to do this?": "Tem certeza que deseja fazer isto?",
                "Are you sure you want to allow access to everyone?": "Tem certeza que deseja permitir o acesso a todos?",
                "Are you sure you want to stop all uploads?": "Tem certeza que deseja parar todos os uploads?",
                "Something went wrong": "Algo deu errado",
                "Invalid directory": "Diretório inválido",
                "This field is required": "Este campo é obrigatório",
                "Username already taken": "O nome de usuário já existe",
                "User not found": "Usuário não encontrado",
                "Old password": "Senha atual",
                "New password": "Nova senha",
                "Wrong password": "Senha inválida",
                Updated: "Atualizado",
                Deleted: "Excluído",
                "Your file is ready": "Seu arquivo está pronto",
                View: "Visualizar",
                Search: "Procurar",
                "Download permission": "Download",
                Guest: "Convidado",
                "Show hidden": "Mostrar ocultos"
            },
            Oe = qe,
            He = {
                Selected: "Geselecteerd: {0} van {1}",
                "Uploading files": "Geüpload: {0}% van {1}",
                "File size error": "{0} is te groot, maximale grootte is {1}",
                "Upload failed": "{0} upload mislukt",
                "Per page": "{0} per pagina",
                Folder: "Map",
                "Login failed, please try again": "Login mislukt, probeer het nog eens...",
                "Already logged in": "U bent al ingelogd...",
                "Please enter username and password": "Geef gebruikersnaam en wachtwoord",
                "Not Found": "Niet gevonden",
                "Not Allowed": "Niet toegestaan",
                "Please log in": "Log eerst in",
                "Unknown error": "Onbekende fout",
                "Add files": "Bestanden toevoegen",
                New: "Nieuw",
                "New name": "Nieuwe naam",
                Username: "Gebruikersnaam",
                Password: "Wachtwoord",
                Login: "Log in",
                Logout: "Log uit",
                Profile: "Profiel",
                "No pagination": "Geen onderverdeling in pagina's",
                Time: "Tijd",
                Name: "Naam",
                Size: "Grootte",
                Home: "Thuismap",
                Copy: "Kopieer",
                Move: "Verplaats",
                Rename: "Hernoem",
                Required: "Vereist veld",
                Zip: "Zip",
                "Batch Download": "Groepsdownload",
                Unzip: "Uitpakken",
                Delete: "Verwijder",
                Download: "Download",
                "Copy link": "Kopieer link",
                Done: "Klaar",
                File: "Bestand",
                "Drop files to upload": "Sleep bestanden hierheen om ze te uploaden",
                Close: "Sluiten",
                "Select Folder": "Selecteer Map",
                Users: "Gebruikers",
                Files: "Bestanden",
                Role: "Rol",
                Cancel: "Afbreken",
                Paused: "Gepauseerd",
                Confirm: "Bevestig",
                Create: "Nieuw",
                User: "Gebruiker",
                Admin: "Beheerder",
                Save: "Opslaan",
                Read: "Lezen",
                Write: "Schrijven",
                Upload: "Uploaden",
                Permissions: "Permissies",
                Homedir: "Thuismap",
                "Leave blank for no change": "Laat leeg om ongewijzigd te laten",
                "Are you sure you want to do this?": "Weet u het zeker?",
                "Are you sure you want to allow access to everyone?": "Weet u zeker dat u iedereen toegang wil geven?",
                "Are you sure you want to stop all uploads?": "Weet u zeker dat u alle uploads wil stoppen?",
                "Something went wrong": "Er is iets foutgegaan",
                "Invalid directory": "Ongeldige map",
                "This field is required": "This field is required",
                "Username already taken": "Naam is al in gebruik",
                "User not found": "Gebruiker niet gevonden",
                "Old password": "Oud wachtwoord",
                "New password": "Nieuw wachtwoord",
                "Wrong password": "Fout wachtwoord",
                Updated: "Aangepast",
                Deleted: "Verwijderd",
                "Your file is ready": "Uw bestand is verwerkt",
                View: "View",
                Search: "Search",
                "Download permission": "Download",
                Guest: "Guest",
                "Show hidden": "Verborgen weergeven"
            },
            Ve = He,
            Ze = {
                Selected: "已选择: {1} 个文件中的 {0} 个",
                "Uploading files": "已上传 {1} 中的 {0}%",
                "File size error": "{0} 尺寸过大, 您最大只可上传 {1}",
                "Upload failed": "{0} 上传失败",
                "Per page": "每页 {0} 个",
                Folder: "文件夹",
                "Login failed, please try again": "登录失败, 请重试",
                "Already logged in": "已登录。",
                "Please enter username and password": "请输入用户名和密码。",
                "Not Found": "未找到",
                "Not Allowed": "不允许",
                "Please log in": "请登录",
                "Unknown error": "未知错误",
                "Add files": "上传文件",
                New: "新建",
                "New name": "新名称",
                Username: "用户名",
                Password: "密码",
                Login: "登录",
                Logout: "退出",
                Profile: "更改信息",
                "No pagination": "不分页",
                Time: "时间",
                Name: "名称",
                Size: "大小",
                Home: "主页",
                Copy: "复制",
                Move: "移动",
                Rename: "重命名",
                Required: "请填写此字段",
                Zip: "压缩",
                "Batch Download": "批量下载",
                Unzip: "解压缩",
                Delete: "删除",
                Download: "下载",
                "Copy link": "复制链接",
                Done: "完成",
                File: "文件",
                "Drop files to upload": "拖放文件即可上传",
                Close: "关闭",
                "Select Folder": "选择文件夹",
                Users: "用户",
                Files: "文件",
                Role: "角色",
                Cancel: "取消",
                Paused: "暂停",
                Confirm: "确认",
                Create: "创建",
                User: "用户",
                Admin: "管理员",
                Save: "保存",
                Read: "读取",
                Write: "写入",
                Upload: "上传",
                Permissions: "权限",
                Homedir: "根目录",
                "Leave blank for no change": "留空表示不更改",
                "Are you sure you want to do this?": "你确定要干这事?",
                "Are you sure you want to allow access to everyone?": "你确定要让任何人随意访问?",
                "Are you sure you want to stop all uploads?": "你确定要停止所有上传任务?",
                "Something went wrong": "有啥坏了",
                "Invalid directory": "目录无效",
                "This field is required": "必须填写这个字段",
                "Username already taken": "用户名已被注册",
                "User not found": "未找到用户",
                "Old password": "旧密码",
                "New password": "新密码",
                "Wrong password": "密码错误",
                Updated: "已更新",
                Deleted: "已删除",
                "Your file is ready": "您的文件已备妥",
                View: "查看",
                Search: "搜索",
                "Download permission": "下载",
                Guest: "游客",
                "Show hidden": "显示隐藏"
            },
            Me = Ze,
            We = {
                Selected: "Избрани: {0} от {1}",
                "Uploading files": "Качване {0}% от {1}",
                "File size error": "{0} е твърде голям, моля, качете файлове по-малко от {1}",
                "Upload failed": "{0} Грещка при качване",
                "Per page": "{0} На страница",
                Folder: "Папка",
                "Login failed, please try again": "Грешка при вписване, опитайте отново",
                "Already logged in": "Вече сте влезли.",
                "Please enter username and password": "Моля въведете потребителско име и парола.",
                "Not Found": "Не е намерено",
                "Not Allowed": "Не е позволено",
                "Please log in": "Моля впишете се",
                "Unknown error": "Неизвестна грешка",
                "Add files": "Добаве файлове",
                New: "Ново",
                "New name": "Ново име",
                Username: "Потребителско име",
                Password: "Парола",
                Login: "Вписване",
                Logout: "Изход",
                Profile: "Профил",
                "No pagination": "Няма пагинация",
                Time: "Дата",
                Name: "Име",
                Size: "Размер",
                Home: "Начало",
                Copy: "Копиране",
                Move: "Изрежи",
                Rename: "Преименуване",
                Required: "Моля, попълнете това поле",
                Zip: "Архив",
                "Batch Download": "Пакетно изтегляне",
                Unzip: "Разархивирай",
                Delete: "Изтриване",
                Download: "Изтегляне",
                "Copy link": "Копирай линк",
                Done: "Завършено",
                File: "Файл",
                "Drop files to upload": "Пускане на файлове за качване",
                Close: "Затвори",
                "Select Folder": "Избери папка",
                Users: "Потребител",
                Files: "Файлове",
                Role: "Права",
                Cancel: "Отказ",
                Paused: "Пауза",
                Confirm: "Потвърждение",
                Create: "Създай",
                User: "Потребител",
                Admin: "Администратор",
                Save: "Запази",
                Read: "Чете",
                Write: "Записва",
                Upload: "Качи",
                Permissions: "Разрешения",
                Homedir: "Главна директория",
                "Leave blank for no change": "Оставете празно, за да няма промяна",
                "Are you sure you want to do this?": "Сигурни ли сте, че искате да направите това?",
                "Are you sure you want to allow access to everyone?": "Сигурни ли сте, че искате да разрешите достъп на всички?",
                "Are you sure you want to stop all uploads?": "Сигурни ли сте, че искате да спрете всички качвания?",
                "Something went wrong": "Нещо се обърка",
                "Invalid directory": "Невалидна директория",
                "This field is required": "Това поле е задължително",
                "Username already taken": "Потребителско име вече е заето",
                "User not found": "Потребителя не е намерен",
                "Old password": "Стара парола",
                "New password": "Нова парола",
                "Wrong password": "Грешна парола",
                Updated: "Обновено",
                Deleted: "Изтрити",
                "Your file is ready": "Вашия файл е готов",
                View: "Преглед",
                Search: "Търси",
                "Download permission": "Свали",
                Guest: "Гост",
                "Show hidden": "Показване на скрито"
            },
            Ge = We,
            Ke = {
                Selected: "Izabrano: {0} od {1}",
                "Uploading files": "Slanje {0}% od {1}",
                "File size error": "{0} fajl je preveliki, molim pošaljite fajl manji od {1}",
                "Upload failed": "{0} greška kod slanja",
                "Per page": "{0} Po strani",
                Folder: "Folder",
                "Login failed, please try again": "Neuspešna prijava, probajte ponovo",
                "Already logged in": "Već prijavljen.",
                "Please enter username and password": "Unesite korisničko ime i lozinku.",
                "Not Found": "Nije pronađen",
                "Not Allowed": "Nije dozvoljeno",
                "Please log in": "Molim prijavite se",
                "Unknown error": "Nepoznata greška",
                "Add files": "Dodaj fajlove",
                New: "Novi",
                "New name": "Novo ime",
                Username: "Korisničko ime",
                Password: "Lozinka",
                Login: "Prijavi se",
                Logout: "Odjavi se",
                Profile: "Profil",
                "No pagination": "Bez listanja po strani",
                Time: "Vreme",
                Name: "Ime",
                Size: "Veličina",
                Home: "Početna",
                Copy: "Kopiraj",
                Move: "Premesti",
                Rename: "Promeni ime",
                Required: "Ovo polje je obavezno",
                Zip: "Zip",
                "Batch Download": "Grupno preuzimanje",
                Unzip: "Unzip",
                Delete: "Obriši",
                Download: "Preuzmi",
                "Copy link": "Kopiraj link",
                Done: "Gotovo",
                File: "Fajl",
                "Drop files to upload": "Spusti fajlove za slanje",
                Close: "Zatvori",
                "Select Folder": "Izaberi folder",
                Users: "Korisnici",
                Files: "Fajlovi",
                Role: "Prava",
                Cancel: "Otkaži",
                Paused: "Pauzirano",
                Confirm: "Potvrdi",
                Create: "Kreiraj",
                User: "Korisnik",
                Admin: "Administrator",
                Save: "Sačuvaj",
                Read: "Čitanje",
                Write: "Upis",
                Upload: "Slanje",
                Permissions: "Prava pristupa",
                Homedir: "Početni folder",
                "Leave blank for no change": "Ostavi prazno da ne promeniš",
                "Are you sure you want to do this?": "Da li ste sigurni?",
                "Are you sure you want to allow access to everyone?": "Da li ste sigurni da želite da dozvolite pristup svima?",
                "Are you sure you want to stop all uploads?": "Da li ste sigurni da želite da prekinete sva slanja?",
                "Something went wrong": "Dogodila se nepoznata greška",
                "Invalid directory": "Pogrešan folder",
                "This field is required": "Ovo polje je obavezno",
                "Username already taken": "Korisničko ime već postoji",
                "User not found": "Korisnik nije pronađen",
                "Old password": "Stara lozinka",
                "New password": "Nova lozinka",
                "Wrong password": "Pogrešna lozinka",
                Updated: "Izmenjeno",
                Deleted: "Obrisano",
                "Your file is ready": "Vaš fajl je spreman",
                View: "View",
                Search: "Search",
                "Download permission": "Preuzimanje",
                Guest: "Gost",
                "Show hidden": "Prikaži skriveno"
            },
            Ye = Ke,
            Je = {
                Selected: "Selectionné : {0} sur {1}",
                "Uploading files": "Upload {0}% sur {1}",
                "File size error": "{0} est trop volumineux, merci d'uploader des fichiers inférieurs à {1}",
                "Upload failed": "{0} échec(s) d'envoi",
                "Per page": "{0} par page",
                Folder: "Dossier",
                "Login failed, please try again": "Identification échoué, veuillez réessayer...",
                "Already logged in": "Vous êtes déjà connecté.",
                "Please enter username and password": "Saisissez votre nom d'utilisateur et votre mot de passe.",
                "Not Found": "Introuvable",
                "Not Allowed": "Non autorisé",
                "Please log in": "Merci de vous connecter",
                "Unknown error": "Erreur inconnue",
                "Add files": "Ajout de fichier",
                New: "Nouveau",
                "New name": "Nouveau nom",
                Username: "Nom d'utilisateur",
                Password: "Mot de passe",
                Login: "Connexion",
                Logout: "Déconnexion",
                Profile: "Profil",
                "No pagination": "Pas de pagination",
                Time: "Date",
                Name: "Nom",
                Size: "Taille",
                Home: "Accueil",
                Copy: "Copier",
                Move: "Déplacer",
                Rename: "Renommer",
                Required: "Merci de remplir ce champ",
                Zip: "Compresser",
                "Batch Download": "Télécharger par lot",
                Unzip: "Décompresser",
                Delete: "Supprimer",
                Download: "Télécharger",
                "Copy link": "Copier le lien",
                Done: "Fait",
                File: "Fichier",
                "Drop files to upload": "Glisser votre fichier pour l'uploader",
                Close: "Fermer",
                "Select Folder": "Selectionner le dossier",
                Users: "Utilisateur",
                Files: "Fichiers",
                Role: "Rôle",
                Cancel: "Annuler",
                Paused: "En pause",
                Confirm: "Confirmer",
                Create: "Créer",
                User: "Utilisateur",
                Admin: "Administrateur",
                Save: "Enregistrer",
                Read: "Lire",
                Write: "Écrire",
                Upload: "Uploader",
                Permissions: "Permissions",
                Homedir: "Dossier principal",
                "Leave blank for no change": "Laisser vide si pas de modification",
                "Are you sure you want to do this?": "Êtes-vous sûr de vouloir faire ceci ?",
                "Are you sure you want to allow access to everyone?": "Êtes-vous sûr de vouloir autoriser l'accès à tout le monde ?",
                "Are you sure you want to stop all uploads?": "Êtes-vous sûr de vouloir arrêter tous vos envois ?",
                "Something went wrong": "Quelque chose a mal tourné",
                "Invalid directory": "Dossier invalide",
                "This field is required": "Ce champ est obligatoire",
                "Username already taken": "Nom d'utilisateur déjà utilisé",
                "User not found": "Utilisateur introuvable",
                "Old password": "Ancien mot de passe",
                "New password": "Nouveau mot de passe",
                "Wrong password": "Mot de passe incorrect",
                Updated: "Mis à jour",
                Deleted: "Supprimé",
                "Your file is ready": "Votre fichier est prêt",
                View: "View",
                Search: "Search",
                "Download permission": "Télécharger",
                Guest: "Guest",
                "Show hidden": "Afficher masqué"
            },
            Qe = Je,
            Xe = {
                Selected: "Vybrané: {0} z {1}",
                "Uploading files": "Nahrávam {0}% z {1}",
                "File size error": "{0} je príliš veľký, nahrávajte súbory menšie ako {1}",
                "Upload failed": "{0} sa nepodarilo nahrať",
                "Per page": "{0} na stránku",
                Folder: "Adresár",
                "Login failed, please try again": "Prihlásenie neúspešné, skúste to znova",
                "Already logged in": "Už ste prihlásený.",
                "Please enter username and password": "Zadajte prihlasovacie meno a heslo.",
                "Not Found": "Nenájdené",
                "Not Allowed": "Nepovolené",
                "Please log in": "Prihláste sa",
                "Unknown error": "Neznáma chyba",
                "Add files": "Pridať súbory",
                New: "Nový",
                "New name": "Nové meno",
                Username: "Prihlasovacie meno",
                Password: "Heslo",
                Login: "Prihlásiť sa",
                Logout: "Odhlásiť sa",
                Profile: "Profil",
                "No pagination": "Bez stránkovania",
                Time: "Čas",
                Name: "Meno",
                Size: "Veľkosť",
                Home: "Hlavný adresár",
                Copy: "Kopírovať",
                Move: "Presunúť",
                Rename: "Premenovať",
                Required: "Vyplňte toto pole",
                Zip: "Archivovať do zip",
                "Batch Download": "Hromadné sťahovanie",
                Unzip: "Rozbaliť zip archív",
                Delete: "Vymazať",
                Download: "Stiahnuť",
                "Copy link": "Skopírovať odkaz",
                Done: "Hotovo",
                File: "Súbor",
                "Drop files to upload": "Pre nahratie presuňte súbory sem",
                Close: "Zavrieť",
                "Select Folder": "Vyberte adresár",
                Users: "Používatelia",
                Files: "Súbory",
                Role: "Typ účtu",
                Cancel: "Zrušiť",
                Paused: "Pozastavené",
                Confirm: "Potvrdiť",
                Create: "Vytvoriť",
                User: "Používateľ",
                Admin: "Admin",
                Save: "Uložiť",
                Read: "Čítanie",
                Write: "Zapisovanie",
                Upload: "Nahrávanie",
                Permissions: "Oprávnenia",
                Homedir: "Hlavný adresár",
                "Leave blank for no change": "Ak nechcete zmeniť nechajte prázdne",
                "Are you sure you want to do this?": "Naozaj to chcete urobiť?",
                "Are you sure you want to allow access to everyone?": "Naozaj chcete povoliť prístup bez hesla?",
                "Are you sure you want to stop all uploads?": "Naozaj chcete zastaviť všetky nahrávania?",
                "Something went wrong": "Niečo sa pokazilo",
                "Invalid directory": "Neplatný adresár",
                "This field is required": "Toto pole je povinné",
                "Username already taken": "Toto prihlasovacie meno sa už používa",
                "User not found": "Používateľ sa nenašiel",
                "Old password": "Staré heslo",
                "New password": "Nové heslo",
                "Wrong password": "Zlé heslo",
                Updated: "Aktualizované",
                Deleted: "Vymazané",
                "Your file is ready": "Váš súbor je pripravený",
                View: "Zobraziť",
                Search: "Vyhľadávanie",
                "Download permission": "Sťahovanie",
                Guest: "Hosť",
                "Show hidden": "Zobraziť skryté"
            },
            ea = Xe,
            aa = {
                Selected: "Wybrano: {0} z {1}",
                "Uploading files": "Przesyłanie {0}% z {1}",
                "Błąd rozmiaru pliku": "{0} jest za duży, prześlij mniejszy plik {1}",
                "Upload failed": "{0} plików nie udało się przesłać",
                "Per page": "{0} Na stronę",
                Folder: "Folder",
                "Login failed, please try again": "Zły login lub hasło.",
                "Already logged in": "Already logged in.",
                "Please enter username and password": "Wpisz login i hasło.",
                "Not Found": "Nie znaleziono",
                "Not Allowed": "Nie dozwolony",
                "Please log in": "Proszę się zalogować",
                "Unknown error": "Nieznany błąd",
                "Add files": "Dodaj plik",
                New: "Nowy",
                "New name": "Nowa nazwa",
                Username: "Login",
                Password: "Hasło",
                Login: "Zaloguj",
                Logout: "Wyloguj",
                Profile: "Profile",
                "No pagination": "Brak podziału na strony",
                Time: "Czas",
                Name: "Nazwa",
                Size: "Rozmiar",
                Home: "Folder główny",
                Copy: "Kopiuj",
                Move: "Przenieś",
                Rename: "Zmień nazwę",
                Required: "Proszę wypełnić to pole",
                Zip: "Zip",
                "Batch Download": "Pobieranie zbiorcze",
                Unzip: "Rozpakuj",
                Delete: "Usuń",
                Download: "Download",
                "Copy link": "Kopiuj link",
                Done: "Done",
                File: "Plik",
                "Drop files to upload": "Upuść pliki do przesłania",
                Close: "Zamknij",
                "Select Folder": "Wybierz katalog",
                Users: "Użytkownik",
                Files: "Pliki",
                Role: "Role",
                Cancel: "Anuluj",
                Paused: "Pauza",
                Confirm: "Potwierdź",
                Create: "Stwórz",
                User: "Użytkownik",
                Admin: "Admin",
                Save: "Zapisz",
                Read: "Podgląd",
                Write: "Zapisz",
                Upload: "Upload",
                Permissions: "Uprawnienia",
                Homedir: "Folder Główny",
                "Leave blank for no change": "Pozostaw puste, bez zmian",
                "Are you sure you want to do this?": "Jesteś pewny że chcesz to zrobić?",
                "Are you sure you want to allow access to everyone?": "Czy na pewno chcesz zezwolić na dostęp wszystkim?",
                "Are you sure you want to stop all uploads?": "Czy na pewno chcesz zatrzymać wszystkie przesyłane pliki?",
                "Something went wrong": "Coś poszło nie tak",
                "Invalid directory": "Nieprawidłowy katalog",
                "This field is required": "To pole jest wymagane",
                "Username already taken": "Nazwa użytkownika zajęta",
                "User not found": "Użytkownik nie znaleziony",
                "Old password": "Stare hasło",
                "New password": "Nowe hasło",
                "Wrong password": "Nieprawidłowe hasło",
                Updated: "Zaktualizowano",
                Deleted: "Usunięte",
                "Your file is ready": "Twój plik jest gotowy",
                View: "Podgląd",
                Search: "Szukaj",
                "Download permission": "Download",
                Guest: "Gość",
                "Show hidden": "Pokaż ukryte"
            },
            oa = aa,
            na = {
                Selected: "Selezionati: {0} di {1}",
                "Uploading files": "Caricamento {0}% di {1}",
                "File size error": "{0} File troppo grande. Dimensione massima consentita {1}",
                "Upload failed": "{0} Caricamento fallito",
                "Per page": "{0} per pagina",
                Folder: "Cartella",
                "Login failed, please try again": "Username o password non corretti",
                "Already logged in": "Sei già connesso",
                "Please enter username and password": "Inserisci username e password",
                "Not Found": "Nessun risultato",
                "Not Allowed": "Non consentito",
                "Please log in": "Per cortesia autenticati",
                "Unknown error": "Errore sconosciuto",
                "Add files": "Aggiungi files",
                New: "Nuovo",
                "New name": "Nuovo nome",
                Username: "Username",
                Password: "Password",
                Login: "Entra",
                Logout: "Esci",
                Profile: "Cambia password",
                "No pagination": "Uno per pagina",
                Time: "Data",
                Name: "Nome",
                Size: "Dimensione",
                Home: "Cartella principale",
                Copy: "Copia",
                Move: "Sposta",
                Rename: "Rinomina",
                Required: "Campo obbligatorio",
                Zip: "Comprimi",
                "Batch Download": "Scarica batch",
                Unzip: "Estrai",
                Delete: "Elimina",
                Download: "Scarica",
                "Copy link": "Copia collegamento",
                Done: "Completato",
                File: "File",
                "Drop files to upload": "Trascina i files che vuoi caricare",
                Close: "Chiudi",
                "Select Folder": "Seleziona cartella",
                Users: "Utenti",
                Files: "Files",
                Role: "Ruolo",
                Cancel: "Annulla",
                Paused: "Sospeso",
                Confirm: "Conferma",
                Create: "Crea",
                User: "Utente",
                Admin: "Amministratore",
                Save: "Salva",
                Read: "Lettura",
                Write: "Scrittura",
                Upload: "Caricamento",
                Permissions: "Permessi",
                Homedir: "Cartella principale",
                "Leave blank for no change": "Lascia in bianco per non effettuare modifiche",
                "Are you sure you want to do this?": "Sei sicuro di voler eliminare gli elementi selezionati?",
                "Are you sure you want to allow access to everyone?": "Sei sicuro di voler consentire libero accesso a tutti?",
                "Are you sure you want to stop all uploads?": "Vuoi sospendere tutti i caricamenti?",
                "Something went wrong": "Qualcosa é andato storto",
                "Invalid directory": "Cartella non corretta",
                "This field is required": "Questo campo é obbligatorio",
                "Username already taken": "Username giá esistente",
                "User not found": "Utente non trovato",
                "Old password": "Vecchia password",
                "New password": "Nuova password",
                "Wrong password": "Password errata",
                Updated: "Aggiornato",
                Deleted: "Eliminato",
                "Your file is ready": "Il tuo file è disponibile",
                View: "Leggi",
                Search: "Cerca",
                "Download permission": "Scarica",
                Guest: "Guest",
                "Show hidden": "Mostra nascosto"
            },
            ia = na,
            ta = {
                Selected: "선택된 항목: {0}/{1}",
                "Uploading files": "{1} 중 {0}% 업로드 진행",
                "File size error": "{1} 이하의 파일만 업로드가 가능합니다.",
                "Upload failed": "{0} 업로드 실패",
                "Per page": "{0}개씩 보기",
                Folder: "폴더",
                "Login failed, please try again": "로그인 실패, 다시 시도하십시오.",
                "Already logged in": "이미 로그인되었습니다.",
                "Please enter username and password": "사용자 이름과 비밀번호를 입력하십시오.",
                "Not Found": "찾을 수 없음",
                "Not Allowed": "허용되지 않음",
                "Please log in": "로그인하십시오.",
                "Unknown error": "알 수 없는 오류",
                "Add files": "업로드",
                New: "생성",
                "New name": "변경할 이름",
                Username: "사용자 이름",
                Password: "비밀번호",
                Login: "로그인",
                Logout: "로그아웃",
                Profile: "프로필",
                "No pagination": "전체 보기",
                Time: "수정한 날짜",
                Name: "이름",
                Size: "크기",
                Home: "홈",
                Copy: "복사",
                Move: "이동",
                Rename: "이름 변경",
                Required: "이 필드를 작성하십시오.",
                Zip: "압축",
                "Batch Download": "일괄 다운로드",
                Unzip: "압축 해제",
                Delete: "삭제",
                Download: "다운로드",
                "Copy link": "링크 복사",
                Done: "완료",
                File: "파일",
                "Drop files to upload": "업로드할 파일을 끌어서 놓으십시오.",
                Close: "닫기",
                "Select Folder": "폴더 선택",
                Users: "사용자",
                Files: "파일",
                Role: "역할",
                Cancel: "취소",
                Paused: "일시중지됨",
                Confirm: "확인",
                Create: "생성",
                User: "사용자",
                Admin: "관리자",
                Save: "저장",
                Read: "읽기",
                Write: "쓰기",
                Upload: "업로드",
                Permissions: "권한",
                Homedir: "홈 폴더",
                "Leave blank for no change": "변경하지 않으려면 비워 두십시오.",
                "Are you sure you want to do this?": "이 작업을 수행하시겠습니까?",
                "Are you sure you want to allow access to everyone?": "방문자에게 접근을 허용하시겠습니까?",
                "Are you sure you want to stop all uploads?": "모든 업로드를 중지하시겠습니까?",
                "Something went wrong": "오류가 발생했습니다.",
                "Invalid directory": "잘못된 폴더",
                "This field is required": "이 필드는 필수입니다.",
                "Username already taken": "이미 사용 중인 사용자 이름입니다.",
                "User not found": "사용자를 찾을 수 없습니다.",
                "Old password": "현재 비밀번호",
                "New password": "새 비밀번호",
                "Wrong password": "잘못된 비밀번호",
                Updated: "업데이트됨",
                Deleted: "삭제됨",
                "Your file is ready": "파일이 준비되었습니다.",
                View: "보기",
                Search: "검색",
                "Download permission": "다운로드",
                Guest: "방문자",
                "Show hidden": "숨김 표시"
            },
            ra = ta,
            sa = {
                Selected: "Vybrané: {0} z {1}",
                "Uploading files": "Nahrávám {0}% z {1}",
                "File size error": "{0} je příliš velký, nahrávejte soubory menší jak {1}",
                "Upload failed": "{0} se nepodařilo nahrát",
                "Per page": "{0} na stránku",
                Folder: "Adresář",
                "Login failed, please try again": "Přihlášení neúspěšné, zkuste to znova",
                "Already logged in": "Už jste přihlášený.",
                "Please enter username and password": "Zadejte přihlašovací jméno a heslo.",
                "Not Found": "Nenalezeno",
                "Not Allowed": "Nepovolené",
                "Please log in": "Přihlaste se",
                "Unknown error": "Neznámá chyba",
                "Add files": "Nahrát soubory",
                New: "Nový",
                "New name": "Nové jméno",
                Username: "Přihlašovací jméno",
                Password: "Heslo",
                Login: "Přihlásit se",
                Logout: "Odhlásit se",
                Profile: "Profil",
                "No pagination": "Bez stránkování",
                Time: "Čas",
                Name: "Jméno",
                Size: "Velikost",
                Home: "Hlavní adresář",
                Copy: "Kopírovat",
                Move: "Přesunout",
                Rename: "Přejmenovat",
                Required: "Vyplňte toto pole",
                Zip: "Archivovat do zip",
                "Batch Download": "Hromadné stahování",
                Unzip: "Rozbalit zip archív",
                Delete: "Smazat",
                Download: "Stáhnout",
                "Copy link": "Zkopírovat odkaz",
                Done: "Hotovo",
                File: "Soubor",
                "Drop files to upload": "Pro nahrání přesuňte soubory sem",
                Close: "Zavřít",
                "Select Folder": "Vyberte adresář",
                Users: "Uživatelé",
                Files: "Soubory",
                Role: "Typ účtu",
                Cancel: "Zrušit",
                Paused: "Pozastavené",
                Confirm: "Potvrdit",
                Create: "Vytvořit",
                User: "Uživatel",
                Admin: "Admin",
                Save: "Uložit",
                Read: "Čtení",
                Write: "Zapisování",
                Upload: "Nahrávání",
                Permissions: "Oprávnění",
                Homedir: "Hlavní adresář",
                "Leave blank for no change": "Pokud nechcete změnit, nechejte prázdné",
                "Are you sure you want to do this?": "Skutečně to chcete udělat?",
                "Are you sure you want to allow access to everyone?": "Skutečně chcete povolit přístup bez hesla?",
                "Are you sure you want to stop all uploads?": "Skutečně chcete zastavit všechna nahrávání?",
                "Something went wrong": "Něco se pokazilo",
                "Invalid directory": "Neplatný adresář",
                "This field is required": "Toto pole je povinné",
                "Username already taken": "Toto přihlašovací jméno se už používá",
                "User not found": "Uživatel se nenašel",
                "Old password": "Staré heslo",
                "New password": "Nové heslo",
                "Wrong password": "Špatné heslo",
                Updated: "Aktualizované",
                Deleted: "Smazané",
                "Your file is ready": "Váš soubor je připravený",
                View: "Zobrazit",
                Search: "Vyhledávání",
                "Download permission": "Stahování",
                Guest: "Host",
                "Show hidden": "Zobrazit skryté"
            },
            la = sa,
            da = {
                Selected: "Seleccionados: {0} de {1}",
                "Uploading files": "Subindo arquivo {0}% de {1}",
                "File size error": "{0} O arquivo é demasiado grande. Por favor, cargue arquivos de menos de {1}",
                "Upload failed": "{0} Erro ao subir",
                "Per page": "{0} Por páxina",
                Folder: "Cartafol",
                "Login failed, please try again": "Houbo un erro no acceso, proba de novo.",
                "Already logged in": "Xa iniciaches sesión.",
                "Please enter username and password": "Por favor, insire usuario e contrasinal.",
                "Not Found": "Non se atopou",
                "Not Allowed": "Non permitido",
                "Please log in": "Por favor, inicie sesión",
                "Unknown error": "Erro descoñecido",
                "Add files": "Engadir Arquivos",
                New: "Novo",
                "New name": "Novo nome",
                Username: "Usuario",
                Password: "Contrasinal",
                Login: "Iniciar sesión",
                Logout: "Saír",
                Profile: "Perfil",
                "No pagination": "Sen paxinación",
                Time: "Hora",
                Name: "Nome",
                Size: "Tamaño",
                Home: "Inicio",
                Copy: "Copiar",
                Move: "Mover",
                Rename: "Renomear",
                Required: "Por favor, encha este campo",
                Zip: "Arquivo comprimido",
                "Batch Download": "Descarga en lotes",
                Unzip: "Descomprimir",
                Delete: "Eliminar",
                Download: "Baixar",
                "Copy link": "Copiar ligazón",
                Done: "Feito",
                File: "Arquivo",
                "Drop files to upload": "Arrastra e solta os arquivos para carregar",
                Close: "Pechar",
                "Select Folder": "Escoller Cartafol",
                Users: "Usuarios",
                Files: "Arquivos",
                Role: "Privilexio",
                Cancel: "Cancelar",
                Paused: "Pausado",
                Confirm: "Confirmar",
                Create: "Crear",
                User: "Usuario",
                Admin: "Administrador",
                Save: "Gardar",
                Read: "Ler",
                Write: "Escribir",
                Upload: "Carregar",
                Permissions: "Permisos",
                Homedir: "Cartafol de Inicio",
                "Leave blank for no change": "Deixa en branco para non facer cambios",
                "Are you sure you want to do this?": "Estás seguro de que queres facer isto?",
                "Are you sure you want to allow access to everyone?": "Estás seguro de que queres darlle acceso a calquera?",
                "Are you sure you want to stop all uploads?": "Estás seguro de que queres deter todas as cargas?",
                "Something went wrong": "Algo saíu mal",
                "Invalid directory": "Dirección non válida",
                "This field is required": "Este campo é obrigatorio",
                "Username already taken": "O usuario xa existe",
                "User not found": "Non se atopou o usuario",
                "Old password": "Contrasinal antiga",
                "New password": "Nova contrasinal",
                "Wrong password": "Contrasinal errada",
                Updated: "Actualizado",
                Deleted: "Eliminado",
                "Your file is ready": "O teu arquivo está listo",
                View: "Ver",
                "Show hidden": "Amosar oculto"
            },
            ua = da,
            ca = {
                Selected: "Выбрано: {0} из {1}",
                "Uploading files": "Загрузка {0}% of {1}",
                "File size error": "{0} слишком большой, пожалуйста, загрузите файл меньше {1}",
                "Upload failed": "{0} не удалось загрузить",
                "Per page": "{0} На страницу",
                Folder: "Папка",
                "Login failed, please try again": "Вход не выполнен. Пожалуйста попробуйте еще раз",
                "Already logged in": "Уже авторизован.",
                "Please enter username and password": "Пожалуйста, введите имя пользователя и пароль.",
                "Not Found": "Не найдено",
                "Not Allowed": "Не разрешено",
                "Please log in": "Пожалуйста, войдите",
                "Unknown error": "Неизвестная ошибка",
                "Add files": "Добавить файлы",
                New: "Создать",
                "New name": "Новое имя",
                Username: "Имя пользователя",
                Password: "Пароль",
                Login: "Вход",
                Logout: "Выход",
                Profile: "Профиль",
                "No pagination": "Без разбивки на страницы",
                Time: "Время",
                Name: "Имя",
                Size: "Размер",
                Home: "Главная",
                Copy: "Копировать",
                Move: "Переместить",
                Rename: "Переименовать",
                Required: "Пожалуйста, заполните это поле",
                Zip: "Архивировать zip",
                "Batch Download": "Пакетная загрузка",
                Unzip: "Разархивировать zip архив",
                Delete: "Удалить",
                Download: "Скачать",
                "Copy link": "Скопировать ссылку",
                Done: "Готово",
                File: "Файл",
                "Drop files to upload": "Перетащите файлы для загрузки",
                Close: "Закрыть",
                "Select Folder": "Выберите папку",
                Users: "Пользователи",
                Files: "Файлы",
                Role: "Роли",
                Cancel: "Отмена",
                Paused: "Приостановлено",
                Confirm: "Подтвердить",
                Create: "Создать",
                User: "Пользователь",
                Admin: "Админ",
                Save: "Сохранить",
                Read: "Чтение",
                Write: "Запись",
                Upload: "Загрузка",
                Permissions: "Разрешения",
                Homedir: "Домашняя папка",
                "Leave blank for no change": "Оставьте поле пустым, чтобы оставить без изменений",
                "Are you sure you want to do this?": "Вы уверены, что хотите выполнить это действие?",
                "Are you sure you want to allow access to everyone?": "Вы уверены, что хотите предоставить доступ всем?",
                "Are you sure you want to stop all uploads?": "Вы уверены, что хотите остановить все загрузки?",
                "Something went wrong": "Что-то пошло не так",
                "Invalid directory": "Недействительная папка",
                "This field is required": "Это поле обязательное",
                "Username already taken": "Имя пользователя уже занято",
                "User not found": "Пользователь не найден",
                "Old password": "Старый пароль",
                "New password": "Новый пароль",
                "Wrong password": "Неверный пароль",
                Updated: "Обновлено",
                Deleted: "Удалено",
                "Your file is ready": "Ваш файл готов",
                View: "Просмотр",
                Search: "Поиск",
                "Download permission": "Скачивание",
                Guest: "Гость",
                "Show hidden": "Показать скрытое"
            },
            pa = ca,
            ma = {
                Selected: "Kijelölés: {0} Kijelölve {1}",
                "Uploading files": "Feltöltés {0}% Feltöltve {1}",
                "File size error": "{0} Túl nagy fájl {1}",
                "Upload failed": "{0} Sikertelen feltöltés",
                "Per page": "{0} Oldalanként",
                Folder: "Mappa",
                "Login failed, please try again": "Sikertelen belépés, próbálja újra",
                "Already logged in": "Bejelentkezve.",
                "Please enter username and password": "Kérjük, adja meg a felhasználónevét és jelszavát.",
                "Not Found": "Nem található",
                "Not Allowed": "Nem megengedett",
                "Please log in": "Kérjük jelentkezzen be",
                "Unknown error": "Ismeretlen hiba",
                "Add files": "Fájl hozzáadása",
                New: "Új",
                "New name": "Új felhasználó",
                Username: "Felhasználónév",
                Password: "Jelszó",
                Login: "Belépés",
                Logout: "Kilépés",
                Profile: "Profil",
                "No pagination": "Nincs lap",
                Time: "Idő",
                Name: "Név",
                Size: "Méret",
                Home: "Főkönyvtár",
                Copy: "Másol",
                Move: "Áthelyez",
                Rename: "Átnevez",
                Required: "Kérem töltse ki ezt a mezőt",
                Zip: "Becsomagol",
                "Batch Download": "Kötegelt letöltés",
                Unzip: "Kicsomagolás",
                Delete: "Törlés",
                Download: "Letöltés",
                "Copy link": "Link másolása",
                Done: "Kész",
                File: "Fájl",
                "Drop files to upload": "Dobja el a feltöltendő fájlokat",
                Close: "Bezár",
                "Select Folder": "Mappa kijelölése",
                Users: "Felhasználók",
                Files: "Fájlok",
                Role: "Szerep",
                Cancel: "Mégse",
                Paused: "Szünetel",
                Confirm: "Megerősít",
                Create: "Létrehoz",
                User: "Felhasználó",
                Admin: "Adminisztrátor",
                Save: "Mentés",
                Read: "Olvasás",
                Write: "Írás",
                Upload: "Feltöltés",
                Permissions: "Engedélyek",
                Homedir: "Fő mappa",
                "Leave blank for no change": "Hagyja üresen változtatás nélkül",
                "Are you sure you want to do this?": "Biztosan meg akarja változtatni?",
                "Are you sure you want to allow access to everyone?": "Biztos, hogy mindenkinek engedélyezi a hozzáférést?",
                "Are you sure you want to stop all uploads?": "Biztosan leállítja az összes feltöltést?",
                "Something went wrong": "Valami elromlott",
                "Invalid directory": "Érvénytelen mappa",
                "This field is required": "Mező kitöltése kötelező",
                "Username already taken": "A felhasználónév már foglalt",
                "User not found": "Felhasználó nem található",
                "Old password": "Régi jelszó",
                "New password": "Új jelszó",
                "Wrong password": "Rossz jelszó",
                Updated: "Feltöltés",
                Deleted: "Törlés",
                "Your file is ready": "Your file is ready",
                View: "Nézet",
                Search: "Keresés",
                "Download permission": "Letöltés engedélyezés",
                Guest: "Vendég",
                "Show hidden": "Rejtett megjelenítése"
            },
            fa = ma,
            ga = {
                Selected: "Vald: {0} of {1}",
                "Uploading files": "Laddar upp {0}% of {1}",
                "File size error": "{0} är för stor, max filstorlek är {1}",
                "Upload failed": "{0} uppladdning misslyckades",
                "Per page": "{0} Per sida",
                Folder: "Mapp",
                "Login failed, please try again": "Inloggning misslyckades, försök igen.",
                "Already logged in": "Redan inloggad.",
                "Please enter username and password": "Ange användarnamn och lösenord.",
                "Not Found": "Ej funnen",
                "Not Allowed": "Ej tillåten",
                "Please log in": "Var vanlig logga in.",
                "Unknown error": "Okänt fel",
                "Add files": "Lägg till filer",
                New: "Ny",
                "New name": "Nytt namn",
                Username: "Användarnamn",
                Password: "Lösenord",
                Login: "Logga in",
                Logout: "Logga ut",
                Profile: "Profil",
                "No pagination": "Sidhantering",
                Time: "Tid",
                Name: "Namn",
                Size: "Storlek",
                Home: "Hem",
                Copy: "Kopiera",
                Move: "Flytta",
                Rename: "Byt namn",
                Required: "Vänligen fyll i detta fält",
                Zip: "Zip",
                "Batch Download": "Batch nedladdning",
                Unzip: "Unzip",
                Delete: "Borttag",
                Download: "Ladda ned",
                "Copy link": "Kopiera länk",
                Done: "Klar",
                File: "Fil",
                "Drop files to upload": "Släpp filer för uppladdning",
                Close: "Stäng",
                "Select Folder": "Välj mapp",
                Users: "Användare",
                Files: "Filer",
                Role: "Roll",
                Cancel: "Avbryt",
                Paused: "Pausad",
                Confirm: "Godkänn",
                Create: "Skapa",
                User: "Användare",
                Admin: "Admin",
                Save: "Spara",
                Read: "Läs",
                Write: "Skriv",
                Upload: "Ladda upp",
                Permissions: "Behörigheter",
                Homedir: "Hem mapp",
                "Leave blank for no change": "Lämna blankt för ingen ändring",
                "Are you sure you want to do this?": "Är du säker på att du vill göra detta?",
                "Are you sure you want to allow access to everyone?": "Vill du verkligen ge access till alla?",
                "Are you sure you want to stop all uploads?": "Vill du stoppa alla uppladdningar?",
                "Something went wrong": "Något gick fel",
                "Invalid directory": "Ogiltig mapp",
                "This field is required": "Detta fält krävs",
                "Username already taken": "Användarnamnet finns redan",
                "User not found": "Användaren hittas inte",
                "Old password": "Gammalt lösenord",
                "New password": "Nytt lösenord",
                "Wrong password": "fel lösenord",
                Updated: "Uppdaterad",
                Deleted: "Borttagen",
                "Your file is ready": "Din fil är klar",
                View: "Visa",
                Search: "Sök",
                "Download permission": "Ladda ned",
                Guest: "Gäst",
                "Show hidden": "Visa dold"
            },
            ha = ga,
            wa = {
                Selected: "{0}個中{1}個を選択中",
                "Uploading files": "{1}中{0}%をアップロードしています…",
                "File size error": "{0}が大きすぎます。{1}未満のファイルのみアップロードできます。",
                "Upload failed": "{0}のアップロードに失敗しました。",
                "Per page": "{0}個表示",
                Folder: "フォルダ",
                "Login failed, please try again": "ログインに失敗しました。もう1度お試しください。",
                "Already logged in": "既にログインしています。",
                "Please enter username and password": "ユーザー名とパスワードを入力してください。",
                "Not Found": "見つかりません。",
                "Not Allowed": "許可されていません。",
                "Please log in": "ログインしてください",
                "Unknown error": "不明なエラー",
                "Add files": "アップロード",
                New: "新規",
                "New name": "新しい名前",
                Username: "ユーザー名",
                Password: "パスワード",
                Login: "ログイン",
                Logout: "ログアウト",
                Profile: "プロフィール",
                "No pagination": "ページネーションなし",
                Time: "更新日",
                Name: "名前",
                Size: "サイズ",
                Home: "ホーム",
                Copy: "コピー",
                Move: "移動",
                Rename: "名前の変更",
                Required: "このフィールドを記入してください。",
                Zip: "Zip",
                "Batch Download": "バッチダウンロード",
                Unzip: "Zipを解凍",
                Delete: "削除",
                Download: "ダウンロード",
                "Copy link": "リンクをコピー",
                Done: "完了",
                File: "ファイル",
                "Drop files to upload": "アップロードするファイルをドロップしてください。",
                Close: "閉じる",
                "Select Folder": "フォルダを選択",
                Users: "ユーザー",
                Files: "ファイル",
                Role: "ロール",
                Cancel: "キャンセル",
                Paused: "一時停止",
                Confirm: "確認",
                Create: "作成",
                User: "ユーザー",
                Admin: "管理者",
                Save: "保存",
                Read: "読み込み",
                Write: "書き込み",
                Upload: "アップロード",
                Permissions: "権限",
                Homedir: "ホームフォルダ",
                "Leave blank for no change": "変更しない場合は空白のままにしてください",
                "Are you sure you want to do this?": "実行してもよろしいですか？",
                "Are you sure you want to allow access to everyone?": "全員にアクセスを許可してよろしいですか？",
                "Are you sure you want to stop all uploads?": "全てのアップロードを中止してよろしいですか？",
                "Something went wrong": "問題が発生したようです。",
                "Invalid directory": "無効なフォルダ",
                "This field is required": "この項目は必須です。",
                "Username already taken": "ユーザー名が既に使用されています。",
                "User not found": "ユーザーが見つかりません。",
                "Old password": "以前のパスワード",
                "New password": "新しいパスワード",
                "Wrong password": "パスワードが間違っています。",
                Updated: "更新しました。",
                Deleted: "削除しました。",
                "Your file is ready": "ファイルの準備ができました。",
                View: "表示"
            },
            va = wa,
            ya = {
                Selected: "Izabrano: {0} od {1}",
                "Uploading files": "Nalaganje {0}% od {1}",
                "File size error": "{0} datoteka je prevelika, prosimo, naložite datoteko, manjšo od {1}",
                "Upload failed": "{0} napaka med nalaganjem",
                "Per page": "{0} Na stran",
                Folder: "Mapa",
                "Login failed, please try again": "Neuspešna prijava, prosimo, poskusite ponovno",
                "Already logged in": "Ste že prijavljeni.",
                "Please enter username and password": "Vnesite uporabniško ime in geslo.",
                "Not Found": "Ni najdeno",
                "Not Allowed": "Ni dovoljeno",
                "Please log in": "Prosimo, prijavite se",
                "Unknown error": "Neznana napaka",
                "Add files": "Dodaj datoteke",
                New: "Nov",
                "New name": "Novo ime",
                Username: "Uporabniško ime",
                Password: "Geslo",
                Login: "Prijavi se",
                Logout: "Odjavi se",
                Profile: "Profil",
                "No pagination": "Brez listanja po strani",
                Time: "Čas",
                Name: "Ime",
                Size: "Velikost",
                Home: "Začetna stran",
                Copy: "Kopiraj",
                Move: "Premakni",
                Rename: "Preimenuj",
                Required: "To polje je obvezno",
                Zip: "Zip",
                "Batch Download": "Skupinsko nalaganje",
                Unzip: "Unzip",
                Delete: "Izbriši",
                Download: "Prenesi",
                "Copy link": "Kopiraj link",
                Done: "Narejeno",
                File: "Datoteka",
                "Drop files to upload": "Spusti datoteke za nalaganje",
                Close: "Zapri",
                "Select Folder": "Izberi mapo",
                Users: "Uporabniki",
                Files: "Datotele",
                Role: "Pravice",
                Cancel: "Prekliči",
                Paused: "Prekini",
                Confirm: "Potrdi",
                Create: "Ustvari",
                User: "Uporabnik",
                Admin: "Administrator",
                Save: "Shrani",
                Read: "Branje",
                Write: "Pisanje",
                Upload: "Nalaganje",
                Permissions: "Pravice dostopa",
                Homedir: "Začetna",
                "Leave blank for no change": "Pustite prazno, če ne želite spremeniti",
                "Are you sure you want to do this?": "Ste prepričani?",
                "Are you sure you want to allow access to everyone?": "Ste prepričani, da želite dovoliti dostop vsem?",
                "Are you sure you want to stop all uploads?": "Ste prepričani, da želite prekiniti vse prenose?",
                "Something went wrong": "Neznana napaka",
                "Invalid directory": "Napačna mapa",
                "This field is required": "To polje je obvezno",
                "Username already taken": "Uporabniško ime že obstaja",
                "User not found": "Uporabnik ni bil najden",
                "Old password": "Staro geslo",
                "New password": "Novo geslo",
                "Wrong password": "Napačno geslo",
                Updated: "Posodobljeno",
                Deleted: "Zbrisano",
                "Your file is ready": "Datoteka je pripravljena",
                View: "Poglej",
                Search: "Išči",
                "Download permission": "Prenos",
                Guest: "Gost",
                "Show hidden": "Prikaži skrito"
            },
            ba = ya,
            ka = {
                Selected: "נבחרו: {0} מתוך {1}",
                "Uploading files": "העלאה {0}% מתוך {1}",
                "File size error": "{0} הוא קובץ גדול מדי. אנא העלו עד לגודל של {1}",
                "Upload failed": "{0} לא הועלה כמו שצריך. אנא נסו שנית",
                "Per page": "{0} לעמוד",
                Folder: "תיקייה",
                "Login failed, please try again": "הכניסה נכשלה, אנא בידקו שם משתמש וסיסמה",
                "Already logged in": "אתם כבר מחוברים לאתר.",
                "Please enter username and password": "לכניסה למערכת הקלידו שם משתמש וסיסמה.",
                "Not Found": "לא נמצא",
                "Not Allowed": "הפעולה לא מותרת",
                "Please log in": "אנא בצעו כניסה לאתר",
                "Unknown error": "שגיאה",
                "Add files": "הוספת קבצים",
                New: "חדש",
                "New name": "שם חדש",
                Username: "שם משתמש",
                Password: "סיסמה",
                Login: "כניסה למערכת",
                Logout: "התנתקות",
                Profile: "פרופיל",
                "No pagination": "ללא דפדוף בין עמודים",
                Time: "זמן",
                Name: "שם",
                Size: "גודל",
                Home: "ראשי",
                Copy: "העתקה",
                Move: "העברה",
                Rename: "שינוי שם",
                Required: "נא למלא חלק זה",
                Zip: "כיווץ זיפ",
                "Batch Download": "הורדה מרובת קבצים",
                Unzip: "פריסת קובץ זיפ",
                Delete: "מחיקה",
                Download: "הורדה",
                "Copy link": "העתקת קישור",
                Done: "סיום",
                File: "קובץ",
                "Drop files to upload": "גררו קבצים לכאן כדי להעלותם",
                Close: "סגירה",
                "Select Folder": "בחירת תיקייה",
                Users: "משתמשים",
                Files: "קבצים",
                Role: "הרשאות",
                Cancel: "ביטול",
                Paused: "מוקפא",
                Confirm: "אישור",
                Create: "יצירה",
                User: "שם משתמש",
                Admin: "ניהול",
                Save: "שמירה",
                Read: "קריאה",
                Write: "כתיבה",
                Upload: "העלאה",
                Permissions: "הרשאות",
                Homedir: "תיקייה ראשית",
                "Leave blank for no change": "השאירו ריק כדי להותיר ללא שינוי",
                "Are you sure you want to do this?": "האם אתם בטוחים שברצונכם לעשות פעולה זו?",
                "Are you sure you want to allow access to everyone?": "האם אתם בטוחים שתרצו לאפשר גישה לכולם?",
                "Are you sure you want to stop all uploads?": "האם אתם בטוחים שתרצו לעצור את כל ההעלאות?",
                "Something went wrong": "משהו השתבש",
                "Invalid directory": "תיקייה שגויה",
                "This field is required": "חובה למלא חלק זה",
                "Username already taken": "שם המשתמש הזה כבר קיים",
                "User not found": "המשתמש לא נמצא",
                "Old password": "הסיסמה הישנה",
                "New password": "הסיסמה החדשה",
                "Wrong password": "סיסמה שגויה",
                Updated: "עודכן",
                Deleted: "נמחק",
                "Your file is ready": "הקובץ שלכם מוכן!",
                View: "צפייה",
                Search: "חיפוש",
                "Download permission": "הורדה",
                Guest: "אורח/ת",
                "Show hidden": "הצגת קבצים מוסתרים"
            },
            za = ka,
            Pa = {
                Selected: "Marcat: {0} din {1}",
                "Uploading files": "Se încarcă {0}% din {1}",
                "File size error": "{0} este prea mare, încărcați fișiere mai mici decât {1}",
                "Upload failed": "{0} a eșuat să se încarce",
                "Per page": "{0} Per Pagină",
                Folder: "Dosar",
                "Login failed, please try again": "Autentificare eșuată, încercați din nou",
                "Already logged in": "Deja autentificat.",
                "Please enter username and password": "Introduceți numele de utilizator și parola.",
                "Not Found": "Negăsit",
                "Not Allowed": "Nepermis",
                "Please log in": "Autentificați-vă",
                "Unknown error": "Eroare necunoscută",
                "Add files": "Adaugă fișiere",
                New: "Nou",
                "New name": "Nume nou",
                Username: "Nume utilizator",
                Password: "Parola",
                Login: "Autentificare",
                Logout: "Deconectare",
                Profile: "Profil",
                "No pagination": "Fără paginare",
                Time: "Timp",
                Name: "Nume",
                Size: "Dimensiune",
                Home: "Acasă",
                Copy: "Copiere",
                Move: "Mutare",
                Rename: "Redenumire",
                Required: "Completați acest câmp",
                Zip: "Zip",
                "Batch Download": "Descărcare grupată",
                Unzip: "Unzip",
                Delete: "Ștergere",
                Download: "Descărcare",
                "Copy link": "Copiere adresă",
                Done: "Finalizat",
                File: "Fișier",
                "Drop files to upload": "Aruncați aici fișierul pentru încărcare",
                Close: "Închidere",
                "Select Folder": "Alege dosar",
                Users: "Utilizatori",
                Files: "Fișiere",
                Role: "Rol",
                Cancel: "Anulare",
                Paused: "Suspendat",
                Confirm: "Confirmare",
                Create: "Creare",
                User: "Utilizator",
                Admin: "Admin",
                Save: "Salvare",
                Read: "Citire",
                Write: "Scriere",
                Upload: "Încărcare",
                Permissions: "Permisiuni",
                Homedir: "Dosar acasă",
                "Leave blank for no change": "Lăsați liber pentru nici o schimbare",
                "Are you sure you want to do this?": "Sunteți sigur că doriți să faceți asta?",
                "Are you sure you want to allow access to everyone?": "Sunteți sigur că doriți să permiteți accesul tuturor?",
                "Are you sure you want to stop all uploads?": "Sunteți sigur că doriți oprirea tuturor încărcărilor?",
                "Something went wrong": "Ceva a mers greșit",
                "Invalid directory": "Dosar invalid",
                "This field is required": "Acest câmp este obligatoriu",
                "Username already taken": "Nume de utilizator deja luat",
                "User not found": "Utilizator negăsit",
                "Old password": "Parola veche",
                "New password": "Parola nouă",
                "Wrong password": "Parolă greșită",
                Updated: "Modificat",
                Deleted: "Șters",
                "Your file is ready": "Fișierul este pregătit",
                View: "Vizualizare",
                Search: "Căutare",
                "Download permission": "Descărcare",
                Guest: "Oaspete",
                "Show hidden": "Arată ascunse"
            },
            Ua = Pa,
            Ca = {
                methods: {
                    lang: function(e) {
                        for (var a = {
                                en: De,
                                es: Le,
                                german: Te,
                                indonesian: Ee,
                                turkish: $e,
                                lithuanian: Ie,
                                portuguese: Oe,
                                dutch: Ve,
                                chinese: Me,
                                bulgarian: Ge,
                                serbian: Ye,
                                french: Qe,
                                slovak: ea,
                                polish: oa,
                                italian: ia,
                                korean: ra,
                                czech: la,
                                galician: ua,
                                russian: pa,
                                hungarian: fa,
                                swedish: ha,
                                japanese: va,
                                slovenian: ba,
                                hebrew: za,
                                romanian: Ua
                            }, o = "en", n = arguments.length, i = new Array(n > 1 ? n - 1 : 0), t = 1; t < n; t++) i[t - 1] = arguments[t];
                        var r = i;
                        return a[o] && void 0 != a[o][e] ? a[o][e].replace(/{(\d+)}/g, (function(e, a) {
                            return "undefined" != typeof r[a] ? r[a] : e
                        })) : e
                    },
                    formatBytes: function(e) {
                        var a = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : 2;
                        if (0 === e) return "0 Bytes";
                        var o = 1024,
                            n = a < 0 ? 0 : a,
                            i = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"],
                            t = Math.floor(Math.log(e) / Math.log(o));
                        return parseFloat((e / Math.pow(o, t)).toFixed(n)) + " " + i[t]
                    },
                    formatDate: function(e) {
                        return je.a.unix(e).format(Na.state.config.date_format ? Na.state.config.date_format : "YY/MM/DD hh:mm:ss")
                    },
                    handleError: function(e) {
                        "string" != typeof e ? e.response.data ? this.$toast.open({
                            message: this.lang(e.response.data),
                            type: "is-danger",
                            duration: 5e3
                        }) : e && e.response && e.response.data && e.response.data.data ? this.$toast.open({
                            message: this.lang(e.response.data.data),
                            type: "is-danger",
                            duration: 5e3
                        }) : this.$toast.open({
                            message: this.lang("Unknown error"),
                            type: "is-danger",
                            duration: 5e3
                        }) : this.$toast.open({
                            message: this.lang(e),
                            type: "is-danger",
                            duration: 5e3
                        })
                    },
                    handleCreateError: function(e) {
                        "string" != typeof e ? e.response.data || e && e.response && e.response.data && e.response.data.data ? this.$toast.open({
                            message: this.lang("There was a problem creating the archive"),
                            type: "is-danger",
                            duration: 5e3
                        }) : this.$toast.open({
                            message: this.lang("Unknown error"),
                            type: "is-danger",
                            duration: 5e3
                        }) : this.$toast.open({
                            message: this.lang(e),
                            type: "is-danger",
                            duration: 5e3
                        })
                    },
                    getDownloadLink: function(e) {
                        return k.getUrl() + "/filemanager/download&path=" + encodeURIComponent(y["Base64"].encode(e))
                    },
                    hasPreview: function(e) {
                        return this.isText(e) || this.isImage(e)
                    },
                    isText: function(e) {
                        return this.hasExtension(e, Na.state.config.editable)
                    },
                    isImage: function(e) {
                        return this.hasExtension(e, [".jpg", ".jpeg", ".gif", ".png", ".bmp", ".svg", ".tiff", ".tif"])
                    },
                    hasExtension: function(e, a) {
                        return !P.a.isEmpty(a) && new RegExp("(" + a.join("|").replace(/\./g, "\\.") + ")$", "i").test(e)
                    },
                    capitalize: function(e) {
                        return e.charAt(0).toUpperCase() + e.slice(1)
                    }
                }
            },
            Sa = Ca;
        n["default"].use(Se["a"]);
        var Na = new Se["a"].Store({
                state: {
                    initialized: !1,
                    config: [],
                    cwd: {
                        location: "/",
                        content: []
                    },
                    tree: {}
                },
                mutations: {
                    initialize: function(e) {
                        e.initialized = !0, this.commit("resetCwd"), this.commit("resetTree")
                    },
                    resetCwd: function(e) {
                        e.cwd = {
                            location: "/",
                            content: []
                        }
                    },
                    resetTree: function(e) {
                        e.tree = {
                            path: "/",
                            name: Sa.methods.lang("Home"),
                            children: []
                        }
                    },
                    setConfig: function(e, a) {
                        e.config = a
                    },
                    setCwd: function(e, a) {
                        e.cwd.location = a.location, e.cwd.content = [], P.a.forEach(P.a.sortBy(a.content, [function(e) {
                            return P.a.toLower(e.type)
                        }]), (function(a) {
                            e.cwd.content.push(a)
                        }))
                    },
                    updateTreeNode: function(e, a) {
                        var o = function e(o) {
                            for (var n in o)
                                if (o.hasOwnProperty(n)) {
                                    if ("path" === n && o[n] === a.path) return void Object.assign(o, {
                                        path: a.path,
                                        children: a.children
                                    });
                                    "object" === Object(Ce["a"])(o[n]) && e(o[n])
                                }
                        };
                        o(e.tree)
                    }
                },
                actions: {}
            }),
            ja = o("8a03"),
            Aa = o.n(ja),
            Da = o("caf9");
        o("15f5"), o("b2a2");
        if (n["default"].config.devtools = !0, n["default"].config.productionTip = !1, n["default"].config.baseURL = window.location.origin + window.location.pathname + "?r=", v.a.defaults.withCredentials = !0, v.a.defaults.baseURL = n["default"].config.baseURL, v.a.defaults.headers["Content-Type"] = "application/json", window.parent.document.getElementById("filemanageriframe2")) var Fa = window.parent.document.getElementById("filemanageriframe2").src,
            La = Fa.lastIndexOf("/"),
            _a = Fa.substring(0, La),
            Ta = _a.lastIndexOf("/"),
            Ra = _a.substring(Ta + 1);
        else Fa = window.parent.document.getElementById("filemanageriframe").src, La = Fa.lastIndexOf("/"), _a = Fa.substring(0, La), Ta = _a.lastIndexOf("/"), Ra = _a.substring(Ta + 1);
        n["default"].use(Aa.a, {
            defaultIconPack: "fas"
        }), n["default"].use(Da["a"], {
            preLoad: 1.3
        }), n["default"].mixin(Sa), new n["default"]({
            router: Ue,
            store: Na,
            created: function() {
                var e = this;
                k.getConfig().then((function(a) {
                    e.$store.commit("setConfig", a.data.data), e.$store.commit("initialize"), e.$router.push("/" + Ra)["catch"]((function() {}))
                }))["catch"]((function() {
                    e.$notification.open({
                        message: e.lang("Something went wrong"),
                        type: "is-danger",
                        queue: !1,
                        indefinite: !0
                    })
                }))
            },
            render: function(e) {
                return e(d)
            }
        }).$mount("#app")
    },
    "9e35": function(e, a, o) {},
    "9ee9": function(e, a, o) {
        "use strict";
        var n = o("9e35"),
            i = o.n(n);
        i.a
    },
    b069: function(e, a, o) {
        "use strict";
        var n = o("e214"),
            i = o.n(n);
        i.a
    },
    b6df: function(e, a, o) {},
    d045: function(e, a, o) {},
    e214: function(e, a, o) {}
});
//# sourceMappingURL=app.js.map