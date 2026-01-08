var LexicalPlayground = (() => {
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __esm = (fn3, res) => function __init() {
    return fn3 && (res = (0, fn3[__getOwnPropNames(fn3)[0]])(fn3 = 0)), res;
  };
  var __commonJS = (cb, mod39) => function __require() {
    return mod39 || (0, cb[__getOwnPropNames(cb)[0]])((mod39 = { exports: {} }).exports, mod39), mod39.exports;
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
  var __toESM = (mod39, isNodeMode, target) => (target = mod39 != null ? __create(__getProtoOf(mod39)) : {}, __copyProps(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    isNodeMode || !mod39 || !mod39.__esModule ? __defProp(target, "default", { value: mod39, enumerable: true }) : target,
    mod39
  ));
  var __toCommonJS = (mod39) => __copyProps(__defProp({}, "__esModule", { value: true }), mod39);

  // react-global:react
  var require_react = __commonJS({
    "react-global:react"(exports, module) {
      var React4 = window.React;
      if (!React4) {
        console.error("[LexicalPlayground] React not found. Ensure react.min.js is loaded first.");
      }
      module.exports = React4;
    }
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
  function t2(t9, ...e5) {
    const n11 = new URL("https://lexical.dev/docs/error"), r9 = new URLSearchParams();
    r9.append("code", t9);
    for (const t10 of e5) r9.append("v", t10);
    throw n11.search = r9.toString(), Error(`Minified Lexical error #${t9}; visit ${n11.toString()} for the full message or use the non-minified dev environment for full errors and additional helpful warnings.`);
  }
  function e2(t9, ...e5) {
    const n11 = new URL("https://lexical.dev/docs/error"), r9 = new URLSearchParams();
    r9.append("code", t9);
    for (const t10 of e5) r9.append("v", t10);
    n11.search = r9.toString(), console.warn(`Minified Lexical warning #${t9}; visit ${n11.toString()} for the full message or use the non-minified dev environment for full errors and additional helpful warnings.`);
  }
  function h(...t9) {
    const e5 = [];
    for (const n11 of t9) if (n11 && "string" == typeof n11) for (const [t10] of n11.matchAll(/\S+/g)) e5.push(t10);
    return e5;
  }
  function Y(t9, e5, n11, r9, i13, o8) {
    let s7 = t9.getFirstChild();
    for (; null !== s7; ) {
      const t10 = s7.__key;
      s7.__parent === e5 && (Mi(s7) && Y(s7, t10, n11, r9, i13, o8), n11.has(t10) || o8.delete(t10), i13.push(t10)), s7 = s7.getNextSibling();
    }
  }
  function G(t9) {
    H = t9.timeStamp;
  }
  function X(t9, e5, n11) {
    const r9 = "BR" === t9.nodeName, i13 = e5.__lexicalLineBreak;
    return i13 && (t9 === i13 || r9 && t9.previousSibling === i13) || r9 && void 0 !== Mo(t9, n11);
  }
  function Q(t9, e5, n11) {
    const r9 = Ns(_s(n11));
    let i13 = null, o8 = null;
    null !== r9 && r9.anchorNode === t9 && (i13 = r9.anchorOffset, o8 = r9.focusOffset);
    const s7 = t9.nodeValue;
    null !== s7 && jo(e5, s7, i13, o8, false);
  }
  function Z(t9, e5, n11) {
    if (br(t9)) {
      const e6 = t9.anchor.getNode();
      if (e6.is(n11) && t9.format !== e6.getFormat()) return false;
    }
    return mo(e5) && n11.isAttached();
  }
  function tt(t9, e5, n11, r9) {
    for (let i13 = t9; i13 && !js(i13); i13 = cs(i13)) {
      const t10 = Mo(i13, e5);
      if (void 0 !== t10) {
        const e6 = Eo(t10, n11);
        if (e6) return Di(e6) || !Os(i13) ? void 0 : [i13, e6];
      } else if (i13 === r9) return [r9, Lo(n11)];
    }
  }
  function et(t9, e5, n11) {
    q = true;
    const r9 = performance.now() - H > 100;
    try {
      bi(t9, () => {
        const i13 = $r() || (function(t10) {
          return t10.getEditorState().read(() => {
            const t11 = $r();
            return null !== t11 ? t11.clone() : null;
          });
        })(t9), s7 = /* @__PURE__ */ new Map(), l8 = t9.getRootElement(), c10 = t9._editorState, a10 = t9._blockCursorElement;
        let u10 = false, f8 = "";
        for (let n12 = 0; n12 < e5.length; n12++) {
          const d9 = e5[n12], h3 = d9.type, g5 = d9.target, _5 = tt(g5, t9, c10, l8);
          if (!_5) continue;
          const [p7, y6] = _5;
          if ("characterData" === h3) r9 && pr(y6) && mo(g5) && Z(i13, g5, y6) && Q(g5, y6, t9);
          else if ("childList" === h3) {
            u10 = true;
            const e6 = d9.addedNodes;
            for (let n14 = 0; n14 < e6.length; n14++) {
              const r11 = e6[n14], i14 = Oo(r11), s8 = r11.parentNode;
              if (null != s8 && r11 !== a10 && null === i14 && !X(r11, s8, t9)) {
                if (o2) {
                  const t10 = (Os(r11) ? r11.innerText : null) || r11.nodeValue;
                  t10 && (f8 += t10);
                }
                s8.removeChild(r11);
              }
            }
            const n13 = d9.removedNodes, r10 = n13.length;
            if (r10 > 0) {
              let e7 = 0;
              for (let i14 = 0; i14 < r10; i14++) {
                const r11 = n13[i14];
                (X(r11, g5, t9) || a10 === r11) && (g5.appendChild(r11), e7++);
              }
              r10 !== e7 && s7.set(p7, y6);
            }
          }
        }
        if (s7.size > 0) for (const [e6, n12] of s7) n12.reconcileObservedMutation(e6, t9);
        const d8 = n11.takeRecords();
        if (d8.length > 0) {
          for (let e6 = 0; e6 < d8.length; e6++) {
            const n12 = d8[e6], r10 = n12.addedNodes, i14 = n12.target;
            for (let e7 = 0; e7 < r10.length; e7++) {
              const n13 = r10[e7], o8 = n13.parentNode;
              null == o8 || "BR" !== n13.nodeName || X(n13, i14, t9) || o8.removeChild(n13);
            }
          }
          n11.takeRecords();
        }
        null !== i13 && (u10 && Io(i13), o2 && is(t9) && i13.insertRawText(f8));
      });
    } finally {
      q = false;
    }
  }
  function nt(t9) {
    const e5 = t9._observer;
    if (null !== e5) {
      et(t9, e5.takeRecords(), e5);
    }
  }
  function rt(t9) {
    !(function(t10) {
      0 === H && _s(t10).addEventListener("textInput", G, true);
    })(t9), t9._observer = new MutationObserver((e5, n11) => {
      et(t9, e5, n11);
    });
  }
  function ot(t9, e5) {
    return new it(t9, e5);
  }
  function st(t9, e5, n11 = "latest") {
    const r9 = ("latest" === n11 ? t9.getLatest() : t9).__state;
    return r9 ? r9.getValue(e5) : e5.defaultValue;
  }
  function lt(t9, e5, n11) {
    const r9 = st(t9, n11, "direct"), i13 = st(e5, n11, "direct");
    return n11.isEqual(r9, i13) ? null : [r9, i13];
  }
  function ct(t9, e5, n11) {
    let r9;
    if (ui(), "function" == typeof n11) {
      const i14 = t9.getLatest(), o8 = st(i14, e5);
      if (r9 = n11(o8), e5.isEqual(o8, r9)) return i14;
    } else r9 = n11;
    const i13 = t9.getWritable();
    return ft(i13).updateFromKnown(e5, r9), i13;
  }
  function at(t9) {
    const e5 = /* @__PURE__ */ new Map(), n11 = /* @__PURE__ */ new Set();
    for (let r9 = "function" == typeof t9 ? t9 : t9.replace; r9.prototype && void 0 !== r9.prototype.getType; r9 = Object.getPrototypeOf(r9)) {
      const { ownNodeConfig: t10 } = Us(r9);
      if (t10 && t10.stateConfigs) for (const r10 of t10.stateConfigs) {
        let t11;
        "stateConfig" in r10 ? (t11 = r10.stateConfig, r10.flat && n11.add(t11.key)) : t11 = r10, e5.set(t11.key, t11);
      }
    }
    return { flatKeys: n11, sharedConfigMap: e5 };
  }
  function ft(t9) {
    const e5 = t9.getWritable(), n11 = e5.__state ? e5.__state.getWritable(e5) : new ut(e5, dt(e5));
    return e5.__state = n11, n11;
  }
  function dt(t9) {
    return t9.__state ? t9.__state.sharedNodeState : oo(Ls(), t9.getType()).sharedNodeState;
  }
  function ht(t9) {
    if (t9) for (const e5 in t9) return t9;
  }
  function gt(t9) {
    return t9;
  }
  function _t(t9, e5, n11) {
    for (const [r9, i13] of e5.knownState) {
      if (t9.has(r9.key)) continue;
      t9.add(r9.key);
      const e6 = n11 ? n11.getValue(r9) : r9.defaultValue;
      if (e6 !== i13 && !r9.isEqual(e6, i13)) return true;
    }
    return false;
  }
  function pt(t9, e5, n11) {
    const { unknownState: r9 } = e5, i13 = n11 ? n11.unknownState : void 0;
    if (r9) for (const [e6, n12] of Object.entries(r9)) {
      if (t9.has(e6)) continue;
      t9.add(e6);
      if (n12 !== (i13 ? i13[e6] : void 0)) return true;
    }
    return false;
  }
  function yt(t9, e5) {
    const n11 = t9.__state;
    return n11 && n11.node === t9 ? n11.getWritable(e5) : n11;
  }
  function mt(t9, e5) {
    const n11 = t9.__mode, r9 = t9.__format, i13 = t9.__style, o8 = e5.__mode, s7 = e5.__format, l8 = e5.__style, c10 = t9.__state, a10 = e5.__state;
    return (null === n11 || n11 === o8) && (null === r9 || r9 === s7) && (null === i13 || i13 === l8) && (null === t9.__state || c10 === a10 || (function(t10, e6) {
      if (t10 === e6) return true;
      if (t10 && e6 && t10.size !== e6.size) return false;
      const n12 = /* @__PURE__ */ new Set();
      return !(t10 && _t(n12, t10, e6) || e6 && _t(n12, e6, t10) || t10 && pt(n12, t10, e6) || e6 && pt(n12, e6, t10));
    })(c10, a10));
  }
  function xt(t9, e5) {
    const n11 = t9.mergeWithSibling(e5), r9 = hi()._normalizedNodes;
    return r9.add(t9.__key), r9.add(e5.__key), n11;
  }
  function Ct(t9) {
    let e5, n11, r9 = t9;
    if ("" !== r9.__text || !r9.isSimpleText() || r9.isUnmergeable()) {
      for (; null !== (e5 = r9.getPreviousSibling()) && pr(e5) && e5.isSimpleText() && !e5.isUnmergeable(); ) {
        if ("" !== e5.__text) {
          if (mt(e5, r9)) {
            r9 = xt(e5, r9);
            break;
          }
          break;
        }
        e5.remove();
      }
      for (; null !== (n11 = r9.getNextSibling()) && pr(n11) && n11.isSimpleText() && !n11.isUnmergeable(); ) {
        if ("" !== n11.__text) {
          if (mt(r9, n11)) {
            r9 = xt(r9, n11);
            break;
          }
          break;
        }
        n11.remove();
      }
    } else r9.remove();
  }
  function St(t9) {
    return vt(t9.anchor), vt(t9.focus), t9;
  }
  function vt(t9) {
    for (; "element" === t9.type; ) {
      const e5 = t9.getNode(), n11 = t9.offset;
      let r9, i13;
      if (n11 === e5.getChildrenSize() ? (r9 = e5.getChildAtIndex(n11 - 1), i13 = true) : (r9 = e5.getChildAtIndex(n11), i13 = false), pr(r9)) {
        t9.set(r9.__key, i13 ? r9.getTextContentSize() : 0, "text", true);
        break;
      }
      if (!Mi(r9)) break;
      t9.set(r9.__key, i13 ? r9.getChildrenSize() : 0, "element", true);
    }
  }
  function Rt(t9, e5) {
    const n11 = Ot.get(t9);
    if (null !== e5) {
      const n12 = ne(t9);
      n12.parentNode === e5 && e5.removeChild(n12);
    }
    if (Mt.has(t9) || Tt._keyToDOMMap.delete(t9), Mi(n11)) {
      const t10 = Xt(n11, Ot);
      Bt(t10, 0, t10.length - 1, null);
    }
    void 0 !== n11 && ts(Pt, Nt, bt, n11, "destroyed");
  }
  function Bt(t9, e5, n11, r9) {
    let i13 = e5;
    for (; i13 <= n11; ++i13) {
      const e6 = t9[i13];
      void 0 !== e6 && Rt(e6, r9);
    }
  }
  function Wt(t9, e5) {
    t9.setProperty("text-align", e5);
  }
  function jt(t9, e5) {
    const n11 = kt.theme.indent;
    if ("string" == typeof n11) {
      const r10 = t9.classList.contains(n11);
      e5 > 0 && !r10 ? t9.classList.add(n11) : e5 < 1 && r10 && t9.classList.remove(n11);
    }
    const r9 = getComputedStyle(t9).getPropertyValue("--lexical-indent-base-value") || Jt;
    t9.style.setProperty("padding-inline-start", 0 === e5 ? "" : `calc(${e5} * ${r9})`);
  }
  function $t(t9, e5) {
    const n11 = t9.style;
    0 === e5 ? Wt(n11, "") : 1 === e5 ? Wt(n11, "left") : 2 === e5 ? Wt(n11, "center") : 3 === e5 ? Wt(n11, "right") : 4 === e5 ? Wt(n11, "justify") : 5 === e5 ? Wt(n11, "start") : 6 === e5 && Wt(n11, "end");
  }
  function Ut(t9, e5) {
    const n11 = (function(t10) {
      const e6 = t10.__dir;
      if (null !== e6) return e6;
      if (Li(t10)) return null;
      const n12 = t10.getParentOrThrow();
      return Li(n12) && null === n12.__dir ? "auto" : null;
    })(e5);
    null !== n11 ? t9.dir = n11 : t9.removeAttribute("dir");
  }
  function Vt(e5, n11) {
    const r9 = Mt.get(e5);
    void 0 === r9 && t2(60);
    const i13 = r9.createDOM(kt, Tt);
    if ((function(t9, e6, n12) {
      const r10 = n12._keyToDOMMap;
      (function(t10, e7, n13) {
        const r11 = `__lexicalKey_${e7._key}`;
        t10[r11] = n13;
      })(e6, n12, t9), r10.set(t9, e6);
    })(e5, i13, Tt), pr(r9) ? i13.setAttribute("data-lexical-text", "true") : Di(r9) && i13.setAttribute("data-lexical-decorator", "true"), Mi(r9)) {
      const t9 = r9.__indent, e6 = r9.__size;
      if (Ut(i13, r9), 0 !== t9 && jt(i13, t9), 0 !== e6) {
        const t10 = e6 - 1;
        Yt(Xt(r9, Mt), r9, 0, t10, r9.getDOMSlot(i13));
      }
      const n12 = r9.__format;
      0 !== n12 && $t(i13, n12), r9.isInline() || Ht(null, r9, i13), ss(r9) && (Dt += D, It += D);
    } else {
      const t9 = r9.getTextContent();
      if (Di(r9)) {
        const t10 = r9.decorate(Tt, kt);
        null !== t10 && Zt(e5, t10), i13.contentEditable = "false";
      }
      Dt += t9, It += t9;
    }
    return null !== n11 && n11.insertChild(i13), ts(Pt, Nt, bt, r9, "created"), i13;
  }
  function Yt(t9, e5, n11, r9, i13) {
    const o8 = Dt;
    Dt = "";
    let s7 = n11;
    for (; s7 <= r9; ++s7) {
      Vt(t9[s7], i13);
      const e6 = Mt.get(t9[s7]);
      null !== e6 && pr(e6) && null === Ft && (Ft = e6.getFormat(), Lt = e6.getStyle());
    }
    ss(e5) && (Dt += D);
    i13.element.__lexicalTextContent = Dt, Dt = o8 + Dt;
  }
  function qt(t9, e5) {
    if (t9) {
      const n11 = t9.__last;
      if (n11) {
        const t10 = e5.get(n11);
        if (t10) return Qn(t10) ? "line-break" : Di(t10) && t10.isInline() ? "decorator" : null;
      }
      return "empty";
    }
    return null;
  }
  function Ht(t9, e5, n11) {
    const r9 = qt(t9, Ot), i13 = qt(e5, Mt);
    r9 !== i13 && e5.getDOMSlot(n11).setManagedLineBreak(i13);
  }
  function Gt(e5, n11, r9) {
    var i13;
    Ft = null, Lt = null, (function(e6, n12, r10) {
      const i14 = Dt, o8 = e6.__size, s7 = n12.__size;
      Dt = "";
      const l8 = r10.element;
      if (1 === o8 && 1 === s7) {
        const t9 = e6.__first, r11 = n12.__first;
        if (t9 === r11) Qt(t9, l8);
        else {
          const e7 = ne(t9), n13 = Vt(r11, null);
          try {
            l8.replaceChild(n13, e7);
          } catch (i16) {
            if ("object" == typeof i16 && null != i16) {
              const o9 = `${i16.toString()} Parent: ${l8.tagName}, new child: {tag: ${n13.tagName} key: ${r11}}, old child: {tag: ${e7.tagName}, key: ${t9}}.`;
              throw new Error(o9);
            }
            throw i16;
          }
          Rt(t9, null);
        }
        const i15 = Mt.get(r11);
        pr(i15) && null === Ft && (Ft = i15.getFormat(), Lt = i15.getStyle());
      } else {
        const i15 = Xt(e6, Ot), c10 = Xt(n12, Mt);
        if (i15.length !== o8 && t2(227), c10.length !== s7 && t2(228), 0 === o8) 0 !== s7 && Yt(c10, n12, 0, s7 - 1, r10);
        else if (0 === s7) {
          if (0 !== o8) {
            const t9 = null == r10.after && null == r10.before && null == r10.element.__lexicalLineBreak;
            Bt(i15, 0, o8 - 1, t9 ? null : l8), t9 && (l8.textContent = "");
          }
        } else !(function(t9, e7, n13, r11, i16, o9) {
          const s8 = r11 - 1, l9 = i16 - 1;
          let c11, a10, u10 = o9.getFirstChild(), f8 = 0, d8 = 0;
          for (; f8 <= s8 && d8 <= l9; ) {
            const t10 = e7[f8], r12 = n13[d8];
            if (t10 === r12) u10 = te(Qt(r12, o9.element)), f8++, d8++;
            else {
              void 0 === c11 && (c11 = new Set(e7)), void 0 === a10 && (a10 = new Set(n13));
              const i18 = a10.has(t10), s9 = c11.has(r12);
              if (i18) if (s9) {
                const t11 = ls(Tt, r12);
                t11 === u10 ? u10 = te(Qt(r12, o9.element)) : (o9.withBefore(u10).insertChild(t11), Qt(r12, o9.element)), f8++, d8++;
              } else Vt(r12, o9.withBefore(u10)), d8++;
              else u10 = te(ne(t10)), Rt(t10, o9.element), f8++;
            }
            const i17 = Mt.get(r12);
            null !== i17 && pr(i17) && null === Ft && (Ft = i17.getFormat(), Lt = i17.getStyle());
          }
          const h3 = f8 > s8, g5 = d8 > l9;
          if (h3 && !g5) {
            const e8 = n13[l9 + 1], r12 = void 0 === e8 ? null : Tt.getElementByKey(e8);
            Yt(n13, t9, d8, l9, o9.withBefore(r12));
          } else g5 && !h3 && Bt(e7, f8, s8, o9.element);
        })(n12, i15, c10, o8, s7, r10);
      }
      ss(n12) && (Dt += D);
      l8.__lexicalTextContent = Dt, Dt = i14 + Dt;
    })(e5, n11, n11.getDOMSlot(r9)), i13 = n11, null == Ft || Ft === i13.__textFormat || zt || i13.setTextFormat(Ft), (function(t9) {
      null == Lt || Lt === t9.__textStyle || zt || t9.setTextStyle(Lt);
    })(n11);
  }
  function Xt(e5, n11) {
    const r9 = [];
    let i13 = e5.__first;
    for (; null !== i13; ) {
      const e6 = n11.get(i13);
      void 0 === e6 && t2(101), r9.push(i13), i13 = e6.__next;
    }
    return r9;
  }
  function Qt(e5, n11) {
    const r9 = Ot.get(e5);
    let i13 = Mt.get(e5);
    void 0 !== r9 && void 0 !== i13 || t2(61);
    const o8 = Kt || Et.has(e5) || wt.has(e5), s7 = ls(Tt, e5);
    if (r9 === i13 && !o8) {
      if (Mi(r9)) {
        const t9 = s7.__lexicalTextContent;
        void 0 !== t9 && (Dt += t9, It += t9);
      } else {
        const t9 = r9.getTextContent();
        It += t9, Dt += t9;
      }
      return s7;
    }
    if (r9 !== i13 && o8 && ts(Pt, Nt, bt, i13, "updated"), i13.updateDOM(r9, s7, kt)) {
      const r10 = Vt(e5, null);
      return null === n11 && t2(62), n11.replaceChild(r10, s7), Rt(e5, null), r10;
    }
    if (Mi(r9) && Mi(i13)) {
      const t9 = i13.__indent;
      (Kt || t9 !== r9.__indent) && jt(s7, t9);
      const e6 = i13.__format;
      if ((Kt || e6 !== r9.__format) && $t(s7, e6), o8 && (Gt(r9, i13, s7), Li(i13) || i13.isInline() || Ht(r9, i13, s7)), ss(i13) && (Dt += D, It += D), (Kt || i13.__dir !== r9.__dir) && (Ut(s7, i13), Li(i13) && !Kt)) {
        for (const t10 of i13.getChildren()) if (Mi(t10)) {
          Ut(ls(Tt, t10.getKey()), t10);
        }
      }
    } else {
      const t9 = i13.getTextContent();
      if (Di(i13)) {
        const t10 = i13.decorate(Tt, kt);
        null !== t10 && Zt(e5, t10);
      }
      Dt += t9, It += t9;
    }
    if (!zt && Li(i13) && i13.__cachedText !== It) {
      const t9 = i13.getWritable();
      t9.__cachedText = It, i13 = t9;
    }
    return s7;
  }
  function Zt(t9, e5) {
    let n11 = Tt._pendingDecorators;
    const r9 = Tt._decorators;
    if (null === n11) {
      if (r9[t9] === e5) return;
      n11 = Po(Tt);
    }
    n11[t9] = e5;
  }
  function te(t9) {
    let e5 = t9.nextSibling;
    return null !== e5 && e5 === Tt._blockCursorElement && (e5 = e5.nextSibling), e5;
  }
  function ee(t9, e5, n11, r9, i13, o8) {
    Dt = "", It = "", Kt = 2 === r9, Tt = n11, kt = n11._config, Nt = n11._nodes, bt = Tt._listeners.mutation, wt = i13, Et = o8, Ot = t9._nodeMap, Mt = e5._nodeMap, zt = e5._readOnly, At = new Map(n11._keyToDOMMap);
    const s7 = /* @__PURE__ */ new Map();
    return Pt = s7, Qt("root", null), Tt = void 0, Nt = void 0, wt = void 0, Et = void 0, Ot = void 0, Mt = void 0, kt = void 0, At = void 0, Pt = void 0, s7;
  }
  function ne(e5) {
    const n11 = At.get(e5);
    return void 0 === n11 && t2(75, e5), n11;
  }
  function re(t9) {
    return { type: t9 };
  }
  function pn(t9, e5, n11, r9, i13) {
    const o8 = t9.anchor, l8 = t9.focus, c10 = o8.getNode(), a10 = hi(), u10 = Ns(_s(a10)), f8 = null !== u10 ? u10.anchorNode : null, d8 = o8.key, h3 = a10.getElementByKey(d8), g5 = n11.length;
    return d8 !== l8.key || !pr(c10) || (!i13 && (!s || rn < r9 + 50) || c10.isDirty() && g5 < 2 || zo(n11)) && o8.offset !== l8.offset && !c10.isComposing() || yo(c10) || c10.isDirty() && g5 > 1 || (i13 || !s) && null !== h3 && !c10.isComposing() && f8 !== Co(h3) || null !== u10 && null !== e5 && (!e5.collapsed || e5.startContainer !== u10.anchorNode || e5.startOffset !== u10.anchorOffset) || c10.getFormat() !== t9.format || c10.getStyle() !== t9.style || (function(t10, e6) {
      if (e6.isSegmented()) return true;
      if (!t10.isCollapsed()) return false;
      const n12 = t10.anchor.offset, r10 = e6.getParentOrThrow(), i14 = po(e6);
      return 0 === n12 ? !e6.canInsertTextBefore() || !r10.canInsertTextBefore() && !e6.isComposing() || i14 || (function(t11) {
        const e7 = t11.getPreviousSibling();
        return (pr(e7) || Mi(e7) && e7.isInline()) && !e7.canInsertTextAfter();
      })(e6) : n12 === e6.getTextContentSize() && (!e6.canInsertTextAfter() || !r10.canInsertTextAfter() && !e6.isComposing() || i14);
    })(t9, c10);
  }
  function yn(t9, e5) {
    return mo(t9) && null !== t9.nodeValue && 0 !== e5 && e5 !== t9.nodeValue.length;
  }
  function mn(e5, n11, r9) {
    const { anchorNode: i13, anchorOffset: o8, focusNode: s7, focusOffset: l8 } = e5;
    cn && (cn = false, yn(i13, o8) && yn(s7, l8) && !gn) || bi(n11, () => {
      if (!r9) return void Io(null);
      if (!uo(n11, i13, s7)) return;
      let c10 = $r();
      if (gn && br(c10) && c10.isCollapsed()) {
        const t9 = c10.anchor, e6 = gn.anchor;
        (t9.key === e6.key && t9.offset === e6.offset + 1 || 1 === t9.offset && e6.getNode().is(t9.getNode().getPreviousSibling())) && (c10 = gn.clone(), Io(c10));
      }
      if (gn = null, br(c10)) {
        const r10 = c10.anchor, i14 = r10.getNode();
        if (c10.isCollapsed()) {
          "Range" === e5.type && e5.anchorNode === e5.focusNode && (c10.dirty = true);
          const o9 = _s(n11).event, s8 = o9 ? o9.timeStamp : performance.now(), [l9, a10, u10, f8, d8] = _n, h3 = Fo(), g5 = false === n11.isComposing() && "" === h3.getTextContent();
          if (s8 < d8 + 200 && r10.offset === u10 && r10.key === f8) xn(c10, l9, a10);
          else if ("text" === r10.type) pr(i14) || t2(141), Cn(c10, i14);
          else if ("element" === r10.type && !g5) {
            Mi(i14) || t2(259);
            const e6 = r10.getNode();
            e6.isEmpty() ? (function(t9, e7) {
              const n12 = e7.getTextFormat(), r11 = e7.getTextStyle();
              xn(t9, n12, r11);
            })(c10, e6) : xn(c10, 0, "");
          }
        } else {
          const t9 = r10.key, e6 = c10.focus.key, n12 = c10.getNodes(), i15 = n12.length, s8 = c10.isBackward(), a10 = s8 ? l8 : o8, u10 = s8 ? o8 : l8, f8 = s8 ? e6 : t9, d8 = s8 ? t9 : e6;
          let h3 = 2047, g5 = false;
          for (let t10 = 0; t10 < i15; t10++) {
            const e7 = n12[t10], r11 = e7.getTextContentSize();
            if (pr(e7) && 0 !== r11 && !(0 === t10 && e7.__key === f8 && a10 === r11 || t10 === i15 - 1 && e7.__key === d8 && 0 === u10) && (g5 = true, h3 &= e7.getFormat(), 0 === h3)) break;
          }
          c10.format = g5 ? h3 : 0;
        }
      }
      os(n11, ie, void 0);
    });
  }
  function xn(t9, e5, n11) {
    t9.format === e5 && t9.style === n11 || (t9.format = e5, t9.style = n11, t9.dirty = true);
  }
  function Cn(t9, e5) {
    xn(t9, e5.getFormat(), e5.getStyle());
  }
  function Sn(t9) {
    if (!t9.getTargetRanges) return null;
    const e5 = t9.getTargetRanges();
    return 0 === e5.length ? null : e5[0];
  }
  function vn(e5) {
    const n11 = e5.inputType, r9 = Sn(e5), i13 = hi(), o8 = $r();
    if ("deleteContentBackward" === n11) {
      if (null === o8) {
        const t9 = Ur();
        if (!br(t9)) return true;
        Io(t9.clone());
      }
      if (br(o8)) {
        const n12 = o8.anchor.key === o8.focus.key;
        if (s7 = e5.timeStamp, "MediaLast" === nn && s7 < en + 30 && i13.isComposing() && n12) {
          if (bo(null), en = 0, setTimeout(() => {
            bi(i13, () => {
              bo(null);
            });
          }, 30), br(o8)) {
            const e6 = o8.anchor.getNode();
            e6.markDirty(), pr(e6) || t2(142), Cn(o8, e6);
          }
        } else {
          bo(null), e5.preventDefault();
          const t9 = o8.anchor.getNode(), r10 = t9.getTextContent(), s8 = t9.canInsertTextAfter(), l9 = 0 === o8.anchor.offset && o8.focus.offset === r10.length;
          let c10 = f && n12 && !l9 && s8;
          if (c10 && o8.isCollapsed() && (c10 = !Di(rs(o8.anchor, true))), !c10) {
            os(i13, fe, true);
            const t10 = $r();
            f && br(t10) && t10.isCollapsed() && (gn = t10, setTimeout(() => gn = null));
          }
        }
        return true;
      }
    }
    var s7;
    if (!br(o8)) return true;
    const l8 = e5.data;
    null !== on && Jo(false, i13, on), o8.dirty && null === on || !o8.isCollapsed() || Li(o8.anchor.getNode()) || null === r9 || o8.applyDOMRange(r9), on = null;
    const a10 = o8.anchor, u10 = o8.focus, d8 = a10.getNode(), h3 = u10.getNode();
    if ("insertText" === n11 || "insertTranspose" === n11) {
      if ("\n" === l8) e5.preventDefault(), os(i13, de, false);
      else if (l8 === D) e5.preventDefault(), os(i13, he, void 0);
      else if (null == l8 && e5.dataTransfer) {
        const t9 = e5.dataTransfer.getData("text/plain");
        e5.preventDefault(), o8.insertRawText(t9);
      } else null != l8 && pn(o8, r9, l8, e5.timeStamp, true) ? (e5.preventDefault(), os(i13, ge, l8)) : on = l8;
      return rn = e5.timeStamp, true;
    }
    switch (e5.preventDefault(), n11) {
      case "insertFromYank":
      case "insertFromDrop":
      case "insertReplacementText":
        os(i13, ge, e5);
        break;
      case "insertFromComposition":
        bo(null), os(i13, ge, e5);
        break;
      case "insertLineBreak":
        bo(null), os(i13, de, false);
        break;
      case "insertParagraph":
        bo(null), un && !c ? (un = false, os(i13, de, false)) : os(i13, he, void 0);
        break;
      case "insertFromPaste":
      case "insertFromPasteAsQuotation":
        os(i13, _e, e5);
        break;
      case "deleteByComposition":
        (function(t9, e6) {
          return t9 !== e6 || Mi(t9) || Mi(e6) || !po(t9) || !po(e6);
        })(d8, h3) && os(i13, pe, e5);
        break;
      case "deleteByDrag":
      case "deleteByCut":
        os(i13, pe, e5);
        break;
      case "deleteContent":
        os(i13, fe, false);
        break;
      case "deleteWordBackward":
        os(i13, ye, true);
        break;
      case "deleteWordForward":
        os(i13, ye, false);
        break;
      case "deleteHardLineBackward":
      case "deleteSoftLineBackward":
        os(i13, me, true);
        break;
      case "deleteContentForward":
      case "deleteHardLineForward":
      case "deleteSoftLineForward":
        os(i13, me, false);
        break;
      case "formatStrikeThrough":
        os(i13, xe, "strikethrough");
        break;
      case "formatBold":
        os(i13, xe, "bold");
        break;
      case "formatItalic":
        os(i13, xe, "italic");
        break;
      case "formatUnderline":
        os(i13, xe, "underline");
        break;
      case "historyUndo":
        os(i13, Ce, void 0);
        break;
      case "historyRedo":
        os(i13, Se, void 0);
    }
    return true;
  }
  function kn(t9) {
    if (Os(t9.target) && co(t9.target)) return true;
    const e5 = hi(), n11 = $r(), r9 = t9.data, i13 = Sn(t9);
    if (null != r9 && br(n11) && pn(n11, i13, r9, t9.timeStamp, false)) {
      fn && (bn(e5, r9), fn = false);
      const i14 = n11.anchor.getNode(), a10 = Ns(_s(e5));
      if (null === a10) return true;
      const u10 = n11.isBackward(), f8 = u10 ? n11.anchor.offset : n11.focus.offset, h3 = u10 ? n11.focus.offset : n11.anchor.offset;
      s && !n11.isCollapsed() && pr(i14) && null !== a10.anchorNode && i14.getTextContent().slice(0, f8) + r9 + i14.getTextContent().slice(f8 + h3) === Wo(a10.anchorNode) || os(e5, ge, r9);
      const g5 = r9.length;
      o2 && g5 > 1 && "insertCompositionText" === t9.inputType && !e5.isComposing() && (n11.anchor.offset -= g5), l || c || d || !e5.isComposing() || (en = 0, bo(null));
    } else {
      Jo(false, e5, null !== r9 ? r9 : void 0), fn && (bn(e5, r9 || void 0), fn = false);
    }
    return (function() {
      ui();
      const t10 = hi();
      nt(t10);
    })(), true;
  }
  function Tn(t9) {
    const e5 = hi(), n11 = $r();
    if (br(n11) && !e5.isComposing()) {
      const r9 = n11.anchor, i13 = n11.anchor.getNode();
      bo(r9.key), (t9.timeStamp < en + 30 || "element" === r9.type || !n11.isCollapsed() || i13.getFormat() !== n11.format || pr(i13) && i13.getStyle() !== n11.style) && os(e5, ge, F);
    }
    return true;
  }
  function Nn(t9) {
    return bn(hi(), t9.data), true;
  }
  function bn(t9, e5) {
    const n11 = t9._compositionKey;
    if (bo(null), null !== n11 && null != e5) {
      if ("" === e5) {
        const e6 = Eo(n11), r9 = Co(t9.getElementByKey(n11));
        return void (null !== r9 && null !== r9.nodeValue && pr(e6) && jo(e6, r9.nodeValue, null, null, true));
      }
      if ("\n" === e5[e5.length - 1]) {
        const e6 = $r();
        if (br(e6)) {
          const n12 = e6.focus;
          return e6.anchor.set(n12.key, n12.offset, n12.type), void os(t9, Oe, null);
        }
      }
    }
    Jo(true, t9, e5);
  }
  function wn(t9) {
    const e5 = hi();
    if (null == t9.key) return true;
    if (dn && Go(t9)) return bi(e5, () => {
      bn(e5, hn);
    }), dn = false, hn = "", true;
    if ((function(t10) {
      return Yo(t10, "ArrowRight", { shiftKey: "any" });
    })(t9)) os(e5, ke, t9);
    else if ((function(t10) {
      return Yo(t10, "ArrowRight", qo);
    })(t9)) os(e5, Te, t9);
    else if ((function(t10) {
      return Yo(t10, "ArrowLeft", { shiftKey: "any" });
    })(t9)) os(e5, Ne, t9);
    else if ((function(t10) {
      return Yo(t10, "ArrowLeft", qo);
    })(t9)) os(e5, be, t9);
    else if ((function(t10) {
      return Yo(t10, "ArrowUp", { altKey: "any", shiftKey: "any" });
    })(t9)) os(e5, we, t9);
    else if ((function(t10) {
      return Yo(t10, "ArrowDown", { altKey: "any", shiftKey: "any" });
    })(t9)) os(e5, Ee, t9);
    else if ((function(t10) {
      return Yo(t10, "Enter", { altKey: "any", ctrlKey: "any", metaKey: "any", shiftKey: true });
    })(t9)) un = true, os(e5, Oe, t9);
    else if ((function(t10) {
      return " " === t10.key;
    })(t9)) os(e5, Me, t9);
    else if ((function(t10) {
      return i && Yo(t10, "o", { ctrlKey: true });
    })(t9)) t9.preventDefault(), un = true, os(e5, de, true);
    else if ((function(t10) {
      return Yo(t10, "Enter", { altKey: "any", ctrlKey: "any", metaKey: "any" });
    })(t9)) un = false, os(e5, Oe, t9);
    else if ((function(t10) {
      return Yo(t10, "Backspace", { shiftKey: "any" }) || i && Yo(t10, "h", { ctrlKey: true });
    })(t9)) Go(t9) ? os(e5, Ae, t9) : (t9.preventDefault(), os(e5, fe, true));
    else if ((function(t10) {
      return "Escape" === t10.key;
    })(t9)) os(e5, Pe, t9);
    else if ((function(t10) {
      return Yo(t10, "Delete", {}) || i && Yo(t10, "d", { ctrlKey: true });
    })(t9)) !(function(t10) {
      return "Delete" === t10.key;
    })(t9) ? (t9.preventDefault(), os(e5, fe, false)) : os(e5, De, t9);
    else if ((function(t10) {
      return Yo(t10, "Backspace", Ho);
    })(t9)) t9.preventDefault(), os(e5, ye, true);
    else if ((function(t10) {
      return Yo(t10, "Delete", Ho);
    })(t9)) t9.preventDefault(), os(e5, ye, false);
    else if ((function(t10) {
      return i && Yo(t10, "Backspace", { metaKey: true });
    })(t9)) t9.preventDefault(), os(e5, me, true);
    else if ((function(t10) {
      return i && (Yo(t10, "Delete", { metaKey: true }) || Yo(t10, "k", { ctrlKey: true }));
    })(t9)) t9.preventDefault(), os(e5, me, false);
    else if ((function(t10) {
      return Yo(t10, "b", qo);
    })(t9)) t9.preventDefault(), os(e5, xe, "bold");
    else if ((function(t10) {
      return Yo(t10, "u", qo);
    })(t9)) t9.preventDefault(), os(e5, xe, "underline");
    else if ((function(t10) {
      return Yo(t10, "i", qo);
    })(t9)) t9.preventDefault(), os(e5, xe, "italic");
    else if ((function(t10) {
      return Yo(t10, "Tab", { shiftKey: "any" });
    })(t9)) os(e5, Fe, t9);
    else if ((function(t10) {
      return Yo(t10, "z", qo);
    })(t9)) t9.preventDefault(), os(e5, Ce, void 0);
    else if ((function(t10) {
      if (i) return Yo(t10, "z", { metaKey: true, shiftKey: true });
      return Yo(t10, "y", { ctrlKey: true }) || Yo(t10, "z", { ctrlKey: true, shiftKey: true });
    })(t9)) t9.preventDefault(), os(e5, Se, void 0);
    else {
      const n11 = e5._editorState._selection;
      null === n11 || br(n11) ? Xo(t9) && (t9.preventDefault(), os(e5, Ue, t9)) : !(function(t10) {
        return Yo(t10, "c", qo);
      })(t9) ? !(function(t10) {
        return Yo(t10, "x", qo);
      })(t9) ? Xo(t9) && (t9.preventDefault(), os(e5, Ue, t9)) : (t9.preventDefault(), os(e5, $e, t9)) : (t9.preventDefault(), os(e5, je, t9));
    }
    return (function(t10) {
      return t10.ctrlKey || t10.shiftKey || t10.altKey || t10.metaKey;
    })(t9) && e5.dispatchCommand(Qe, t9), true;
  }
  function En(t9) {
    let e5 = t9.__lexicalEventHandles;
    return void 0 === e5 && (e5 = [], t9.__lexicalEventHandles = e5), e5;
  }
  function Mn(t9) {
    const e5 = bs(t9.target);
    if (null === e5) return;
    const n11 = ho(e5.anchorNode);
    if (null === n11) return;
    an && (an = false, bi(n11, () => {
      const r10 = Ur(), i14 = e5.anchorNode;
      if (Os(i14) || mo(i14)) {
        Io(jr(r10, e5, n11, t9));
      }
    }));
    const r9 = Ro(n11), i13 = r9[r9.length - 1], o8 = i13._key, s7 = On.get(o8), l8 = s7 || i13;
    l8 !== n11 && mn(e5, l8, false), mn(e5, n11, true), n11 !== i13 ? On.set(o8, n11) : s7 && On.delete(o8);
  }
  function An(t9) {
    t9._lexicalHandled = true;
  }
  function Pn(t9) {
    return true === t9._lexicalHandled;
  }
  function Fn(e5) {
    const n11 = sn.get(e5);
    if (void 0 === n11) return void Dn();
    const r9 = ln.get(n11);
    if (void 0 === r9) return void Dn();
    const i13 = r9 - 1;
    i13 >= 0 || t2(164), sn.delete(e5), ln.set(n11, i13), 0 === i13 && n11.removeEventListener("selectionchange", Mn);
    const o8 = go(e5);
    fo(o8) ? (!(function(t9) {
      if (null !== t9._parentEditor) {
        const e6 = Ro(t9), n12 = e6[e6.length - 1]._key;
        On.get(n12) === t9 && On.delete(n12);
      } else On.delete(t9._key);
    })(o8), e5.__lexicalEditor = null) : o8 && t2(198);
    const s7 = En(e5);
    for (let t9 = 0; t9 < s7.length; t9++) s7[t9]();
    e5.__lexicalEventHandles = [];
  }
  function Ln(t9, e5, n11) {
    ui();
    const r9 = t9.__key, i13 = t9.getParent();
    if (null === i13) return;
    const o8 = (function(t10) {
      const e6 = $r();
      if (!br(e6) || !Mi(t10)) return e6;
      const { anchor: n12, focus: r10 } = e6, i14 = n12.getNode(), o9 = r10.getNode();
      hs(i14, t10) && n12.set(t10.__key, 0, "element");
      hs(o9, t10) && r10.set(t10.__key, 0, "element");
      return e6;
    })(t9);
    let s7 = false;
    if (br(o8) && e5) {
      const e6 = o8.anchor, n12 = o8.focus;
      e6.key === r9 && (qr(e6, t9, i13, t9.getPreviousSibling(), t9.getNextSibling()), s7 = true), n12.key === r9 && (qr(n12, t9, i13, t9.getPreviousSibling(), t9.getNextSibling()), s7 = true);
    } else Er(o8) && e5 && t9.isSelected() && t9.selectPrevious();
    if (br(o8) && e5 && !s7) {
      const e6 = t9.getIndexWithinParent();
      To(t9), Vr(o8, i13, e6, -1);
    } else To(t9);
    n11 || ms(i13) || i13.canBeEmpty() || !i13.isEmpty() || Ln(i13, e5), e5 && o8 && Li(i13) && i13.isEmpty() && i13.selectEnd();
  }
  function In(t9) {
    return t9;
  }
  function zn(t9) {
    return t9[Kn] || false;
  }
  function Gn(t9) {
    return { node: Xn() };
  }
  function Xn() {
    return Cs(new Hn());
  }
  function Qn(t9) {
    return t9 instanceof Hn;
  }
  function Zn(t9) {
    return mo(t9) && /^( |\t|\r?\n)+$/.test(t9.textContent || "");
  }
  function tr(t9, e5) {
    return 16 & e5 ? "code" : e5 & T ? "mark" : 32 & e5 ? "sub" : 64 & e5 ? "sup" : null;
  }
  function er(t9, e5) {
    return 1 & e5 ? "strong" : 2 & e5 ? "em" : "span";
  }
  function nr(t9, e5, n11, r9, i13) {
    const o8 = r9.classList;
    let s7 = Zo(i13, "base");
    void 0 !== s7 && o8.add(...s7), s7 = Zo(i13, "underlineStrikethrough");
    let l8 = false;
    const c10 = 8 & e5 && 4 & e5;
    void 0 !== s7 && (8 & n11 && 4 & n11 ? (l8 = true, c10 || o8.add(...s7)) : c10 && o8.remove(...s7));
    for (const t10 in R) {
      const r10 = R[t10];
      if (s7 = Zo(i13, t10), void 0 !== s7) if (n11 & r10) {
        if (l8 && ("underline" === t10 || "strikethrough" === t10)) {
          e5 & r10 && o8.remove(...s7);
          continue;
        }
        (0 === (e5 & r10) || c10 && "underline" === t10 || "strikethrough" === t10) && o8.add(...s7);
      } else e5 & r10 && o8.remove(...s7);
    }
  }
  function rr(t9, e5, n11) {
    const r9 = e5.firstChild, i13 = n11.isComposing(), s7 = t9 + (i13 ? P : "");
    if (null == r9) e5.textContent = s7;
    else {
      const t10 = r9.nodeValue;
      if (t10 !== s7) if (i13 || o2) {
        const [e6, n12, i14] = (function(t11, e7) {
          const n13 = t11.length, r10 = e7.length;
          let i15 = 0, o8 = 0;
          for (; i15 < n13 && i15 < r10 && t11[i15] === e7[i15]; ) i15++;
          for (; o8 + i15 < n13 && o8 + i15 < r10 && t11[n13 - o8 - 1] === e7[r10 - o8 - 1]; ) o8++;
          return [i15, n13 - i15 - o8, e7.slice(i15, r10 - o8)];
        })(t10, s7);
        0 !== n12 && r9.deleteData(e6, n12), r9.insertData(e6, i14);
      } else r9.nodeValue = s7;
    }
  }
  function ir(t9, e5, n11, r9, i13, o8) {
    rr(i13, t9, e5);
    const s7 = o8.theme.text;
    void 0 !== s7 && nr(0, 0, r9, t9, s7);
  }
  function or(t9, e5) {
    const n11 = document.createElement(e5);
    return n11.appendChild(t9), n11;
  }
  function lr(t9) {
    return { forChild: yr(t9.style), node: null };
  }
  function cr(t9) {
    const e5 = t9, n11 = "normal" === e5.style.fontWeight;
    return { forChild: yr(e5.style, n11 ? void 0 : "bold"), node: null };
  }
  function ur(t9) {
    if (!Os(t9)) return false;
    if ("PRE" === t9.nodeName) return true;
    const e5 = t9.style.whiteSpace;
    return "string" == typeof e5 && e5.startsWith("pre");
  }
  function fr(e5) {
    const n11 = e5;
    null === e5.parentElement && t2(129);
    let r9 = n11.textContent || "";
    if (null !== (function(t9) {
      let e6, n12 = t9.parentNode;
      const r10 = [t9];
      for (; null !== n12 && void 0 === (e6 = ar.get(n12)) && !ur(n12); ) r10.push(n12), n12 = n12.parentNode;
      const i13 = void 0 === e6 ? n12 : e6;
      for (let t10 = 0; t10 < r10.length; t10++) ar.set(r10[t10], i13);
      return i13;
    })(n11)) {
      const t9 = r9.split(/(\r?\n|\t)/), e6 = [], n12 = t9.length;
      for (let r10 = 0; r10 < n12; r10++) {
        const n13 = t9[r10];
        "\n" === n13 || "\r\n" === n13 ? e6.push(Xn()) : "	" === n13 ? e6.push(xr()) : "" !== n13 && e6.push(_r(n13));
      }
      return { node: e6 };
    }
    if (r9 = r9.replace(/\r/g, "").replace(/[ \t\n]+/g, " "), "" === r9) return { node: null };
    if (" " === r9[0]) {
      let t9 = n11, e6 = true;
      for (; null !== t9 && null !== (t9 = dr(t9, false)); ) {
        const n12 = t9.textContent || "";
        if (n12.length > 0) {
          /[ \t\n]$/.test(n12) && (r9 = r9.slice(1)), e6 = false;
          break;
        }
      }
      e6 && (r9 = r9.slice(1));
    }
    if (" " === r9[r9.length - 1]) {
      let t9 = n11, e6 = true;
      for (; null !== t9 && null !== (t9 = dr(t9, true)); ) {
        if ((t9.textContent || "").replace(/^( |\t|\r?\n)+/, "").length > 0) {
          e6 = false;
          break;
        }
      }
      e6 && (r9 = r9.slice(0, r9.length - 1));
    }
    return "" === r9 ? { node: null } : { node: _r(r9) };
  }
  function dr(t9, e5) {
    let n11 = t9;
    for (; ; ) {
      let t10;
      for (; null === (t10 = e5 ? n11.nextSibling : n11.previousSibling); ) {
        const t11 = n11.parentElement;
        if (null === t11) return null;
        n11 = t11;
      }
      if (n11 = t10, Os(n11)) {
        const t11 = n11.style.display;
        if ("" === t11 && !Ps(n11) || "" !== t11 && !t11.startsWith("inline")) return null;
      }
      let r9 = n11;
      for (; null !== (r9 = e5 ? n11.firstChild : n11.lastChild); ) n11 = r9;
      if (mo(n11)) return n11;
      if ("BR" === n11.nodeName) return null;
    }
  }
  function gr(t9) {
    const e5 = hr[t9.nodeName.toLowerCase()];
    return void 0 === e5 ? { node: null } : { forChild: yr(t9.style, e5), node: null };
  }
  function _r(t9 = "") {
    return Cs(new sr(t9));
  }
  function pr(t9) {
    return t9 instanceof sr;
  }
  function yr(t9, e5) {
    const n11 = t9.fontWeight, r9 = t9.textDecoration.split(" "), i13 = "700" === n11 || "bold" === n11, o8 = r9.includes("line-through"), s7 = "italic" === t9.fontStyle, l8 = r9.includes("underline"), c10 = t9.verticalAlign;
    return (t10) => pr(t10) ? (i13 && !t10.hasFormat("bold") && t10.toggleFormat("bold"), o8 && !t10.hasFormat("strikethrough") && t10.toggleFormat("strikethrough"), s7 && !t10.hasFormat("italic") && t10.toggleFormat("italic"), l8 && !t10.hasFormat("underline") && t10.toggleFormat("underline"), "sub" !== c10 || t10.hasFormat("subscript") || t10.toggleFormat("subscript"), "super" !== c10 || t10.hasFormat("superscript") || t10.toggleFormat("superscript"), e5 && !t10.hasFormat(e5) && t10.toggleFormat(e5), t10) : t10;
  }
  function xr() {
    return Cs(new mr());
  }
  function Cr(t9) {
    return t9 instanceof mr;
  }
  function vr(t9, e5, n11) {
    return new Sr(t9, e5, n11);
  }
  function kr(t9, e5) {
    let n11 = e5.__key, r9 = t9.offset, i13 = "element";
    if (pr(e5)) {
      i13 = "text";
      const t10 = e5.getTextContentSize();
      r9 > t10 && (r9 = t10);
    } else if (!Mi(e5)) {
      const t10 = e5.getNextSibling();
      if (pr(t10)) n11 = t10.__key, r9 = 0, i13 = "text";
      else {
        const t11 = e5.getParent();
        t11 && (n11 = t11.__key, r9 = e5.getIndexWithinParent() + 1);
      }
    }
    t9.set(n11, r9, i13);
  }
  function Tr(t9, e5) {
    if (Mi(e5)) {
      const n11 = e5.getLastDescendant();
      Mi(n11) || pr(n11) ? kr(t9, n11) : kr(t9, e5);
    } else kr(t9, e5);
  }
  function br(t9) {
    return t9 instanceof wr;
  }
  function Er(t9) {
    return t9 instanceof Nr;
  }
  function Or(t9) {
    const e5 = t9.offset;
    if ("text" === t9.type) return e5;
    const n11 = t9.getNode();
    return e5 === n11.getChildrenSize() ? n11.getTextContent().length : 0;
  }
  function Mr(t9) {
    const e5 = t9.getStartEndPoints();
    if (null === e5) return [0, 0];
    const [n11, r9] = e5;
    return "element" === n11.type && "element" === r9.type && n11.key === r9.key && n11.offset === r9.offset ? [0, 0] : [Or(n11), Or(r9)];
  }
  function Ar(t9, e5) {
    for (let n11 = e5; n11; n11 = n11.getParent()) {
      if (Mi(n11)) {
        if (n11.collapseAtStart(t9)) return true;
        if (ms(n11)) break;
      }
      if (n11.getPreviousSibling()) break;
    }
    return false;
  }
  function Dr(t9, e5, n11) {
    const r9 = t9, i13 = r9.getTextContent().split(/(?=\s)/g), o8 = i13.length;
    let s7 = 0, l8 = 0;
    for (let t10 = 0; t10 < o8; t10++) {
      const r10 = t10 === o8 - 1;
      if (l8 = s7, s7 += i13[t10].length, e5 && s7 === n11 || s7 > n11 || r10) {
        i13.splice(t10, 1), r10 && (l8 = void 0);
        break;
      }
    }
    const c10 = i13.join("").trim();
    "" === c10 ? r9.remove() : (r9.setTextContent(c10), r9.select(l8, l8));
  }
  function Fr(e5, n11, r9, i13) {
    let o8, s7 = n11;
    if (Os(e5)) {
      let l8 = false;
      const c10 = e5.childNodes, a10 = c10.length, u10 = i13._blockCursorElement;
      s7 === a10 && (l8 = true, s7 = a10 - 1);
      let f8 = c10[s7], d8 = false;
      if (f8 === u10) f8 = c10[s7 + 1], d8 = true;
      else if (null !== u10) {
        const t9 = u10.parentNode;
        if (e5 === t9) {
          n11 > Array.prototype.indexOf.call(t9.children, u10) && s7--;
        }
      }
      if (o8 = Ko(f8), pr(o8)) s7 = fl(o8, l8 ? "next" : "previous");
      else {
        let c11 = Ko(e5);
        if (null === c11) return null;
        if (Mi(c11)) {
          const a11 = i13.getElementByKey(c11.getKey());
          null === a11 && t2(214);
          const u11 = c11.getDOMSlot(a11);
          [c11, s7] = u11.resolveChildIndex(c11, a11, e5, n11), Mi(c11) || t2(215), l8 && s7 >= c11.getChildrenSize() && (s7 = Math.max(0, c11.getChildrenSize() - 1));
          let f9 = c11.getChildAtIndex(s7);
          if (Mi(f9) && (function(t9, e6, n12) {
            const r10 = t9.getParent();
            return null === n12 || null === r10 || !r10.canBeEmpty() || r10 !== n12.getNode();
          })(f9, 0, r9)) {
            const t9 = l8 ? f9.getLastDescendant() : f9.getFirstDescendant();
            null === t9 ? c11 = f9 : (f9 = t9, c11 = Mi(f9) ? f9 : f9.getParentOrThrow()), s7 = 0;
          }
          pr(f9) ? (o8 = f9, c11 = null, s7 = fl(f9, l8 ? "next" : "previous")) : f9 !== c11 && l8 && !d8 && (Mi(c11) || t2(216), s7 = Math.min(c11.getChildrenSize(), s7 + 1));
        } else {
          const t9 = c11.getIndexWithinParent();
          s7 = 0 === n11 && Di(c11) && Ko(e5) === c11 ? t9 : t9 + 1, c11 = c11.getParentOrThrow();
        }
        if (Mi(c11)) return vr(c11.__key, s7, "element");
      }
    } else o8 = Ko(e5);
    return pr(o8) ? vr(o8.__key, fl(o8, s7, "clamp"), "text") : null;
  }
  function Lr(t9, e5, n11) {
    const r9 = t9.offset, i13 = t9.getNode();
    if (0 === r9) {
      const r10 = i13.getPreviousSibling(), o8 = i13.getParent();
      if (e5) {
        if ((n11 || !e5) && null === r10 && Mi(o8) && o8.isInline()) {
          const e6 = o8.getPreviousSibling();
          pr(e6) && t9.set(e6.__key, e6.getTextContent().length, "text");
        }
      } else Mi(r10) && !n11 && r10.isInline() ? t9.set(r10.__key, r10.getChildrenSize(), "element") : pr(r10) && t9.set(r10.__key, r10.getTextContent().length, "text");
    } else if (r9 === i13.getTextContent().length) {
      const r10 = i13.getNextSibling(), o8 = i13.getParent();
      if (e5 && Mi(r10) && r10.isInline()) t9.set(r10.__key, 0, "element");
      else if ((n11 || e5) && null === r10 && Mi(o8) && o8.isInline() && !o8.canInsertTextAfter()) {
        const e6 = o8.getNextSibling();
        pr(e6) && t9.set(e6.__key, 0, "text");
      }
    }
  }
  function Ir(t9, e5, n11) {
    if ("text" === t9.type && "text" === e5.type) {
      const r9 = t9.isBefore(e5), i13 = t9.is(e5);
      Lr(t9, r9, i13), Lr(e5, !r9, i13), i13 && e5.set(t9.key, t9.offset, t9.type);
      const o8 = hi();
      if (o8.isComposing() && o8._compositionKey !== t9.key && br(n11)) {
        const r10 = n11.anchor, i14 = n11.focus;
        t9.set(r10.key, r10.offset, r10.type, true), e5.set(i14.key, i14.offset, i14.type, true);
      }
    }
  }
  function Kr(t9, e5, n11, r9, i13, o8) {
    if (null === t9 || null === n11 || !uo(i13, t9, n11)) return null;
    const s7 = Fr(t9, e5, br(o8) ? o8.anchor : null, i13);
    if (null === s7) return null;
    const l8 = Fr(n11, r9, br(o8) ? o8.focus : null, i13);
    if (null === l8) return null;
    if ("element" === s7.type && "element" === l8.type) {
      const e6 = Ko(t9), r10 = Ko(n11);
      if (Di(e6) && Di(r10)) return null;
    }
    return Ir(s7, l8, o8), [s7, l8];
  }
  function zr(t9) {
    return Mi(t9) && !t9.isInline();
  }
  function Rr(t9, e5, n11, r9, i13, o8) {
    const s7 = di(), l8 = new wr(vr(t9, e5, i13), vr(n11, r9, o8), 0, "");
    return l8.dirty = true, s7._selection = l8, l8;
  }
  function Br() {
    const t9 = vr("root", 0, "element"), e5 = vr("root", 0, "element");
    return new wr(t9, e5, 0, "");
  }
  function Wr() {
    return new Nr(/* @__PURE__ */ new Set());
  }
  function Jr(t9, e5) {
    return jr(null, t9, e5, null);
  }
  function jr(t9, e5, n11, r9) {
    const i13 = n11._window;
    if (null === i13) return null;
    const o8 = r9 || i13.event, s7 = o8 ? o8.type : void 0, l8 = "selectionchange" === s7, c10 = !q && (l8 || "beforeinput" === s7 || "compositionstart" === s7 || "compositionend" === s7 || "click" === s7 && o8 && 3 === o8.detail || "drop" === s7 || void 0 === s7);
    let a10, u10, f8, d8;
    if (br(t9) && !c10) return t9.clone();
    if (null === e5) return null;
    if (a10 = e5.anchorNode, u10 = e5.focusNode, f8 = e5.anchorOffset, d8 = e5.focusOffset, (l8 || void 0 === s7) && br(t9) && !uo(n11, a10, u10)) return t9.clone();
    const h3 = Kr(a10, f8, u10, d8, n11, t9);
    if (null === h3) return null;
    const [g5, _5] = h3;
    return new wr(g5, _5, br(t9) ? t9.format : 0, br(t9) ? t9.style : "");
  }
  function $r() {
    return di()._selection;
  }
  function Ur() {
    return hi()._editorState._selection;
  }
  function Vr(t9, e5, n11, r9 = 1) {
    const i13 = t9.anchor, o8 = t9.focus, s7 = i13.getNode(), l8 = o8.getNode();
    if (!e5.is(s7) && !e5.is(l8)) return;
    const c10 = e5.__key;
    if (t9.isCollapsed()) {
      const e6 = i13.offset;
      if (n11 <= e6 && r9 > 0 || n11 < e6 && r9 < 0) {
        const n12 = Math.max(0, e6 + r9);
        i13.set(c10, n12, "element"), o8.set(c10, n12, "element"), Yr(t9);
      }
    } else {
      const s8 = t9.isBackward(), l9 = s8 ? o8 : i13, a10 = l9.getNode(), u10 = s8 ? i13 : o8, f8 = u10.getNode();
      if (e5.is(a10)) {
        const t10 = l9.offset;
        (n11 <= t10 && r9 > 0 || n11 < t10 && r9 < 0) && l9.set(c10, Math.max(0, t10 + r9), "element");
      }
      if (e5.is(f8)) {
        const t10 = u10.offset;
        (n11 <= t10 && r9 > 0 || n11 < t10 && r9 < 0) && u10.set(c10, Math.max(0, t10 + r9), "element");
      }
    }
    Yr(t9);
  }
  function Yr(t9) {
    const e5 = t9.anchor, n11 = e5.offset, r9 = t9.focus, i13 = r9.offset, o8 = e5.getNode(), s7 = r9.getNode();
    if (t9.isCollapsed()) {
      if (!Mi(o8)) return;
      const t10 = o8.getChildrenSize(), i14 = n11 >= t10, s8 = i14 ? o8.getChildAtIndex(t10 - 1) : o8.getChildAtIndex(n11);
      if (pr(s8)) {
        let t11 = 0;
        i14 && (t11 = s8.getTextContentSize()), e5.set(s8.__key, t11, "text"), r9.set(s8.__key, t11, "text");
      }
      return;
    }
    if (Mi(o8)) {
      const t10 = o8.getChildrenSize(), r10 = n11 >= t10, i14 = r10 ? o8.getChildAtIndex(t10 - 1) : o8.getChildAtIndex(n11);
      if (pr(i14)) {
        let t11 = 0;
        r10 && (t11 = i14.getTextContentSize()), e5.set(i14.__key, t11, "text");
      }
    }
    if (Mi(s7)) {
      const t10 = s7.getChildrenSize(), e6 = i13 >= t10, n12 = e6 ? s7.getChildAtIndex(t10 - 1) : s7.getChildAtIndex(i13);
      if (pr(n12)) {
        let t11 = 0;
        e6 && (t11 = n12.getTextContentSize()), r9.set(n12.__key, t11, "text");
      }
    }
  }
  function qr(t9, e5, n11, r9, i13) {
    let o8 = null, s7 = 0, l8 = null;
    null !== r9 ? (o8 = r9.__key, pr(r9) ? (s7 = r9.getTextContentSize(), l8 = "text") : Mi(r9) && (s7 = r9.getChildrenSize(), l8 = "element")) : null !== i13 && (o8 = i13.__key, pr(i13) ? l8 = "text" : Mi(i13) && (l8 = "element")), null !== o8 && null !== l8 ? t9.set(o8, s7, l8) : (s7 = e5.getIndexWithinParent(), -1 === s7 && (s7 = n11.getChildrenSize()), t9.set(n11.__key, s7, "element"));
  }
  function Hr(t9, e5, n11, r9, i13) {
    "text" === t9.type ? t9.set(n11, t9.offset + (e5 ? 0 : i13), "text") : t9.offset > r9.getIndexWithinParent() && t9.set(t9.key, t9.offset - 1, "element");
  }
  function Gr(t9, e5, n11, r9, i13) {
    try {
      t9.setBaseAndExtent(e5, n11, r9, i13);
    } catch (t10) {
    }
  }
  function Xr(t9, e5, n11, r9, i13, o8, s7) {
    const l8 = r9.anchorNode, c10 = r9.focusNode, a10 = r9.anchorOffset, u10 = r9.focusOffset, f8 = document.activeElement;
    if (i13.has($n) && f8 !== o8 || null !== f8 && ao(f8)) return;
    if (!br(e5)) return void (null !== t9 && uo(n11, l8, c10) && r9.removeAllRanges());
    const d8 = e5.anchor, h3 = e5.focus, g5 = d8.key, _5 = h3.key, p7 = ls(n11, g5), y6 = ls(n11, _5), m9 = d8.offset, x7 = h3.offset, C5 = e5.format, S3 = e5.style, v6 = e5.isCollapsed();
    let k4 = p7, T4 = y6, N4 = false;
    if ("text" === d8.type) {
      k4 = Co(p7);
      const t10 = d8.getNode();
      N4 = t10.getFormat() !== C5 || t10.getStyle() !== S3;
    } else br(t9) && "text" === t9.anchor.type && (N4 = true);
    var b7, w6, E8, O6, M6;
    if (("text" === h3.type && (T4 = Co(y6)), null !== k4 && null !== T4) && (v6 && (null === t9 || N4 || br(t9) && (t9.format !== C5 || t9.style !== S3)) && (b7 = C5, w6 = S3, E8 = m9, O6 = g5, M6 = performance.now(), _n = [b7, w6, E8, O6, M6]), a10 !== m9 || u10 !== x7 || l8 !== k4 || c10 !== T4 || "Range" === r9.type && v6 || (null !== f8 && o8.contains(f8) || i13.has(qn) || o8.focus({ preventScroll: true }), "element" === d8.type))) {
      if (Gr(r9, k4, m9, T4, x7), !i13.has(Vn) && e5.isCollapsed() && null !== o8 && o8 === document.activeElement) {
        const t10 = br(e5) && "element" === e5.anchor.type ? k4.childNodes[m9] || null : r9.rangeCount > 0 ? r9.getRangeAt(0) : null;
        if (null !== t10) {
          let e6;
          if (t10 instanceof Text) {
            const n12 = document.createRange();
            n12.selectNode(t10), e6 = n12.getBoundingClientRect();
          } else e6 = t10.getBoundingClientRect();
          !(function(t11, e7, n12) {
            const r10 = as(n12), i14 = gs(r10);
            if (null === r10 || null === i14) return;
            let { top: o9, bottom: s8 } = e7, l9 = 0, c11 = 0, a11 = n12;
            for (; null !== a11; ) {
              const e8 = a11 === r10.body;
              if (e8) l9 = 0, c11 = _s(t11).innerHeight;
              else {
                const t12 = a11.getBoundingClientRect();
                l9 = t12.top, c11 = t12.bottom;
              }
              let n13 = 0;
              if (o9 < l9 ? n13 = -(l9 - o9) : s8 > c11 && (n13 = s8 - c11), 0 !== n13) if (e8) i14.scrollBy(0, n13);
              else {
                const t12 = a11.scrollTop;
                a11.scrollTop += n13;
                const e9 = a11.scrollTop - t12;
                o9 -= e9, s8 -= e9;
              }
              if (e8) break;
              a11 = cs(a11);
            }
          })(n11, e6, o8);
        }
      }
      cn = true;
    }
  }
  function Qr(t9) {
    let e5 = $r() || Ur();
    null === e5 && (e5 = Fo().selectEnd()), e5.insertNodes(t9);
  }
  function Zr() {
    const t9 = $r();
    return null === t9 ? "" : t9.getTextContent();
  }
  function ti(e5) {
    let n11 = e5;
    e5.isCollapsed() || n11.removeText();
    const r9 = $r();
    br(r9) && (n11 = r9), br(n11) || t2(161);
    const i13 = n11.anchor;
    let o8 = i13.getNode(), s7 = i13.offset;
    for (; !Fs(o8); ) {
      const t9 = o8;
      if ([o8, s7] = ei(o8, s7), t9.is(o8)) break;
    }
    return s7;
  }
  function ei(t9, e5) {
    const n11 = t9.getParent();
    if (!n11) {
      const t10 = $i();
      return Fo().append(t10), t10.select(), [Fo(), 0];
    }
    if (pr(t9)) {
      const r10 = t9.splitText(e5);
      if (0 === r10.length) return [n11, t9.getIndexWithinParent()];
      const i13 = 0 === e5 ? 0 : 1;
      return [n11, r10[0].getIndexWithinParent() + i13];
    }
    if (!Mi(t9) || 0 === e5) return [n11, t9.getIndexWithinParent()];
    const r9 = t9.getChildAtIndex(e5);
    if (r9) {
      const n12 = new wr(vr(t9.__key, e5, "element"), vr(t9.__key, e5, "element"), 0, ""), i13 = t9.insertNewAfter(n12);
      i13 && i13.append(r9, ...r9.getNextSiblings());
    }
    return [n11, t9.getIndexWithinParent() + 1];
  }
  function ni(t9, e5, n11, r9, i13 = "decorators-and-blocks") {
    if ("move" === e5 && "character" === r9 && !t9.isCollapsed()) {
      const [e6, r10] = n11 === t9.isBackward() ? [t9.focus, t9.anchor] : [t9.anchor, t9.focus];
      return r10.set(e6.key, e6.offset, e6.type), true;
    }
    const o8 = El(t9.focus, n11 ? "previous" : "next"), s7 = "lineboundary" === r9, l8 = "move" === e5;
    let c10 = o8, a10 = "decorators-and-blocks" === i13;
    if (!zl(c10)) {
      for (const t10 of c10) {
        a10 = false;
        const { origin: e6 } = t10;
        if (!Di(e6) || e6.isIsolated() || (c10 = t10, !s7 || !e6.isInline())) break;
      }
      if (a10) for (const t10 of xl(o8).iterNodeCarets("extend" === e5 ? "shadowRoot" : "root")) {
        if (ol(t10)) t10.origin.isInline() || (c10 = t10);
        else {
          if (Mi(t10.origin)) continue;
          Di(t10.origin) && !t10.origin.isInline() && (c10 = t10);
        }
        break;
      }
    }
    if (c10 === o8) return false;
    if (l8 && !s7 && Di(c10.origin) && c10.origin.isKeyboardSelectable()) {
      const t10 = Wr();
      return t10.add(c10.origin.getKey()), Io(t10), true;
    }
    return c10 = Kl(c10), l8 && Ol(t9.anchor, c10), Ol(t9.focus, c10), a10 || !s7;
  }
  function ai() {
    return oi || null !== ri && ri._readOnly;
  }
  function ui() {
    oi && t2(13);
  }
  function fi() {
    li > 99 && t2(14);
  }
  function di() {
    return null === ri && t2(195, gi()), ri;
  }
  function hi() {
    return null === ii && t2(196, gi()), ii;
  }
  function gi() {
    let t9 = 0;
    const e5 = /* @__PURE__ */ new Set(), n11 = to.version;
    if ("undefined" != typeof window) for (const r10 of document.querySelectorAll("[contenteditable]")) {
      const i13 = go(r10);
      if (fo(i13)) t9++;
      else if (i13) {
        let t10 = String(i13.constructor.version || "<0.17.1");
        t10 === n11 && (t10 += " (separately built, likely a bundler configuration issue)"), e5.add(t10);
      }
    }
    let r9 = ` Detected on the page: ${t9} compatible editor(s) with version ${n11}`;
    return e5.size && (r9 += ` and incompatible editors with versions ${Array.from(e5).join(", ")}`), r9;
  }
  function _i() {
    return ii;
  }
  function pi(t9, e5, n11) {
    const r9 = e5.__type, i13 = oo(t9, r9);
    let o8 = n11.get(r9);
    void 0 === o8 && (o8 = Array.from(i13.transforms), n11.set(r9, o8));
    const s7 = o8.length;
    for (let t10 = 0; t10 < s7 && (o8[t10](e5), e5.isAttached()); t10++) ;
  }
  function yi(t9, e5) {
    return void 0 !== t9 && t9.__key !== e5 && t9.isAttached();
  }
  function mi(t9, e5) {
    if (!e5) return;
    const n11 = t9._updateTags;
    let r9 = e5;
    Array.isArray(e5) || (r9 = [e5]);
    for (const t10 of r9) n11.add(t10);
  }
  function xi(t9) {
    return Ci(t9, hi()._nodes);
  }
  function Ci(e5, n11) {
    const r9 = e5.type, i13 = n11.get(r9);
    void 0 === i13 && t2(17, r9);
    const o8 = i13.klass;
    e5.type !== o8.getType() && t2(18, o8.name);
    const s7 = o8.importJSON(e5), l8 = e5.children;
    if (Mi(s7) && Array.isArray(l8)) for (let t9 = 0; t9 < l8.length; t9++) {
      const e6 = Ci(l8[t9], n11);
      s7.append(e6);
    }
    return s7;
  }
  function Si(t9, e5, n11) {
    const r9 = ri, i13 = oi, o8 = ii;
    ri = e5, oi = true, ii = t9;
    try {
      return n11();
    } finally {
      ri = r9, oi = i13, ii = o8;
    }
  }
  function vi(t9, e5) {
    const n11 = t9._pendingEditorState, r9 = t9._rootElement, i13 = t9._headless || null === r9;
    if (null === n11) return;
    const o8 = t9._editorState, s7 = o8._selection, l8 = n11._selection, c10 = 0 !== t9._dirtyType, a10 = ri, u10 = oi, f8 = ii, d8 = t9._updating, g5 = t9._observer;
    let _5 = null;
    if (t9._pendingEditorState = null, t9._editorState = n11, !i13 && c10 && null !== g5) {
      ii = t9, ri = n11, oi = false, t9._updating = true;
      try {
        const e6 = t9._dirtyType, r10 = t9._dirtyElements, i14 = t9._dirtyLeaves;
        g5.disconnect(), _5 = ee(o8, n11, t9, e6, r10, i14);
      } catch (e6) {
        if (e6 instanceof Error && t9._onError(e6), si) throw e6;
        return Xi(t9, null, r9, n11), rt(t9), t9._dirtyType = 2, si = true, vi(t9, o8), void (si = false);
      } finally {
        g5.observe(r9, ci), t9._updating = d8, ri = a10, oi = u10, ii = f8;
      }
    }
    n11._readOnly || (n11._readOnly = true);
    const p7 = t9._dirtyLeaves, y6 = t9._dirtyElements, m9 = t9._normalizedNodes, x7 = t9._updateTags, C5 = t9._deferred;
    c10 && (t9._dirtyType = 0, t9._cloneNotNeeded.clear(), t9._dirtyLeaves = /* @__PURE__ */ new Set(), t9._dirtyElements = /* @__PURE__ */ new Map(), t9._normalizedNodes = /* @__PURE__ */ new Set(), t9._updateTags = /* @__PURE__ */ new Set()), (function(t10, e6) {
      const n12 = t10._decorators;
      let r10 = t10._pendingDecorators || n12;
      const i14 = e6._nodeMap;
      let o9;
      for (o9 in r10) i14.has(o9) || (r10 === n12 && (r10 = Po(t10)), delete r10[o9]);
    })(t9, n11);
    const S3 = i13 ? null : Ns(_s(t9));
    if (t9._editable && null !== S3 && (c10 || null === l8 || l8.dirty || !l8.is(s7)) && null !== r9 && !x7.has(Yn)) {
      ii = t9, ri = n11;
      try {
        if (null !== g5 && g5.disconnect(), c10 || null === l8 || l8.dirty) {
          const e6 = t9._blockCursorElement;
          null !== e6 && Ts(e6, t9, r9), Xr(s7, l8, t9, S3, x7, r9);
        }
        !(function(t10, e6, n12) {
          let r10 = t10._blockCursorElement;
          if (br(n12) && n12.isCollapsed() && "element" === n12.anchor.type && e6.contains(document.activeElement)) {
            const i14 = n12.anchor, o9 = i14.getNode(), s8 = i14.offset;
            let l9 = false, c11 = null;
            if (s8 === o9.getChildrenSize()) {
              ks(o9.getChildAtIndex(s8 - 1)) && (l9 = true);
            } else {
              const e7 = o9.getChildAtIndex(s8);
              if (null !== e7 && ks(e7)) {
                const n13 = e7.getPreviousSibling();
                (null === n13 || ks(n13)) && (l9 = true, c11 = t10.getElementByKey(e7.__key));
              }
            }
            if (l9) {
              const n13 = t10.getElementByKey(o9.__key);
              return null === r10 && (t10._blockCursorElement = r10 = (function(t11) {
                const e7 = t11.theme, n14 = document.createElement("div");
                n14.contentEditable = "false", n14.setAttribute("data-lexical-cursor", "true");
                let r11 = e7.blockCursor;
                if (void 0 !== r11) {
                  if ("string" == typeof r11) {
                    const t12 = h(r11);
                    r11 = e7.blockCursor = t12;
                  }
                  void 0 !== r11 && n14.classList.add(...r11);
                }
                return n14;
              })(t10._config)), e6.style.caretColor = "transparent", void (null === c11 ? n13.appendChild(r10) : n13.insertBefore(r10, c11));
            }
          }
          null !== r10 && Ts(r10, t10, e6);
        })(t9, r9, l8);
      } finally {
        null !== g5 && g5.observe(r9, ci), ii = f8, ri = a10;
      }
    }
    null !== _5 && (function(t10, e6, n12, r10, i14) {
      const o9 = Array.from(t10._listeners.mutation), s8 = o9.length;
      for (let t11 = 0; t11 < s8; t11++) {
        const [s9, l9] = o9[t11];
        for (const t12 of l9) {
          const o10 = e6.get(t12);
          void 0 !== o10 && s9(o10, { dirtyLeaves: r10, prevEditorState: i14, updateTags: n12 });
        }
      }
    })(t9, _5, x7, p7, o8), br(l8) || null === l8 || null !== s7 && s7.is(l8) || t9.dispatchCommand(ie, void 0);
    const v6 = t9._pendingDecorators;
    null !== v6 && (t9._decorators = v6, t9._pendingDecorators = null, ki("decorator", t9, true, v6)), (function(t10, e6, n12) {
      const r10 = Do(e6), i14 = Do(n12);
      r10 !== i14 && ki("textcontent", t10, true, i14);
    })(t9, e5 || o8, n11), ki("update", t9, true, { dirtyElements: y6, dirtyLeaves: p7, editorState: n11, mutatedNodes: _5, normalizedNodes: m9, prevEditorState: e5 || o8, tags: x7 }), (function(t10, e6) {
      if (t10._deferred = [], 0 !== e6.length) {
        const n12 = t10._updating;
        t10._updating = true;
        try {
          for (let t11 = 0; t11 < e6.length; t11++) e6[t11]();
        } finally {
          t10._updating = n12;
        }
      }
    })(t9, C5), (function(t10) {
      const e6 = t10._updates;
      if (0 !== e6.length) {
        const n12 = e6.shift();
        if (n12) {
          const [e7, r10] = n12;
          Ni(t10, e7, r10);
        }
      }
    })(t9);
  }
  function ki(t9, e5, n11, ...r9) {
    const i13 = e5._updating;
    e5._updating = n11;
    try {
      const n12 = Array.from(e5._listeners[t9]);
      for (let t10 = 0; t10 < n12.length; t10++) n12[t10].apply(null, r9);
    } finally {
      e5._updating = i13;
    }
  }
  function Ti(e5, n11) {
    const r9 = e5._updates;
    let i13 = n11 || false;
    for (; 0 !== r9.length; ) {
      const n12 = r9.shift();
      if (n12) {
        const [r10, o8] = n12, s7 = e5._pendingEditorState;
        let l8;
        void 0 !== o8 && (l8 = o8.onUpdate, o8.skipTransforms && (i13 = true), o8.discrete && (null === s7 && t2(191), s7._flushSync = true), l8 && e5._deferred.push(l8), mi(e5, o8.tag)), null == s7 ? Ni(e5, r10, o8) : r10();
      }
    }
    return i13;
  }
  function Ni(e5, n11, r9) {
    const i13 = e5._updateTags;
    let o8, s7 = false, l8 = false;
    void 0 !== r9 && (o8 = r9.onUpdate, mi(e5, r9.tag), s7 = r9.skipTransforms || false, l8 = r9.discrete || false), o8 && e5._deferred.push(o8);
    const c10 = e5._editorState;
    let a10 = e5._pendingEditorState, u10 = false;
    (null === a10 || a10._readOnly) && (a10 = e5._pendingEditorState = Ii(a10 || c10), u10 = true), a10._flushSync = l8;
    const f8 = ri, d8 = oi, h3 = ii, g5 = e5._updating;
    ri = a10, oi = false, e5._updating = true, ii = e5;
    const _5 = e5._headless || null === e5.getRootElement();
    no(null);
    try {
      u10 && (_5 ? null !== c10._selection && (a10._selection = c10._selection.clone()) : a10._selection = (function(t9, e6) {
        const n12 = t9.getEditorState()._selection, r10 = Ns(_s(t9));
        return br(n12) || null == n12 ? jr(n12, r10, t9, e6) : n12.clone();
      })(e5, r9 && r9.event || null));
      const i14 = e5._compositionKey;
      n11(), s7 = Ti(e5, s7), (function(t9, e6) {
        const n12 = e6.getEditorState()._selection, r10 = t9._selection;
        if (br(r10)) {
          const t10 = r10.anchor, e7 = r10.focus;
          let i15;
          if ("text" === t10.type && (i15 = t10.getNode(), i15.selectionTransform(n12, r10)), "text" === e7.type) {
            const t11 = e7.getNode();
            i15 !== t11 && t11.selectionTransform(n12, r10);
          }
        }
      })(a10, e5), 0 !== e5._dirtyType && (s7 ? (function(t9, e6) {
        const n12 = e6._dirtyLeaves, r10 = t9._nodeMap;
        for (const t10 of n12) {
          const e7 = r10.get(t10);
          pr(e7) && e7.isAttached() && e7.isSimpleText() && !e7.isUnmergeable() && Ct(e7);
        }
      })(a10, e5) : (function(t9, e6) {
        const n12 = e6._dirtyLeaves, r10 = e6._dirtyElements, i15 = t9._nodeMap, o10 = wo(), s8 = /* @__PURE__ */ new Map();
        let l9 = n12, c11 = l9.size, a11 = r10, u11 = a11.size;
        for (; c11 > 0 || u11 > 0; ) {
          if (c11 > 0) {
            e6._dirtyLeaves = /* @__PURE__ */ new Set();
            for (const t10 of l9) {
              const r11 = i15.get(t10);
              pr(r11) && r11.isAttached() && r11.isSimpleText() && !r11.isUnmergeable() && Ct(r11), void 0 !== r11 && yi(r11, o10) && pi(e6, r11, s8), n12.add(t10);
            }
            if (l9 = e6._dirtyLeaves, c11 = l9.size, c11 > 0) {
              li++;
              continue;
            }
          }
          e6._dirtyLeaves = /* @__PURE__ */ new Set(), e6._dirtyElements = /* @__PURE__ */ new Map(), a11.delete("root") && a11.set("root", true);
          for (const t10 of a11) {
            const n13 = t10[0], l10 = t10[1];
            if (r10.set(n13, l10), !l10) continue;
            const c12 = i15.get(n13);
            void 0 !== c12 && yi(c12, o10) && pi(e6, c12, s8);
          }
          l9 = e6._dirtyLeaves, c11 = l9.size, a11 = e6._dirtyElements, u11 = a11.size, li++;
        }
        e6._dirtyLeaves = n12, e6._dirtyElements = r10;
      })(a10, e5), Ti(e5), (function(t9, e6, n12, r10) {
        const i15 = t9._nodeMap, o10 = e6._nodeMap, s8 = [];
        for (const [t10] of r10) {
          const e7 = o10.get(t10);
          void 0 !== e7 && (e7.isAttached() || (Mi(e7) && Y(e7, t10, i15, o10, s8, r10), i15.has(t10) || r10.delete(t10), s8.push(t10)));
        }
        for (const t10 of s8) o10.delete(t10);
        for (const t10 of n12) {
          const e7 = o10.get(t10);
          void 0 === e7 || e7.isAttached() || (i15.has(t10) || n12.delete(t10), o10.delete(t10));
        }
      })(c10, a10, e5._dirtyLeaves, e5._dirtyElements));
      i14 !== e5._compositionKey && (a10._flushSync = true);
      const o9 = a10._selection;
      if (br(o9)) {
        const e6 = a10._nodeMap, n12 = o9.anchor.key, r10 = o9.focus.key;
        void 0 !== e6.get(n12) && void 0 !== e6.get(r10) || t2(19);
      } else Er(o9) && 0 === o9._nodes.size && (a10._selection = null);
    } catch (t9) {
      return t9 instanceof Error && e5._onError(t9), e5._pendingEditorState = c10, e5._dirtyType = 2, e5._cloneNotNeeded.clear(), e5._dirtyLeaves = /* @__PURE__ */ new Set(), e5._dirtyElements.clear(), void vi(e5);
    } finally {
      ri = f8, oi = d8, ii = h3, e5._updating = g5, li = 0;
    }
    const p7 = 0 !== e5._dirtyType || e5._deferred.length > 0 || (function(t9, e6) {
      const n12 = e6.getEditorState()._selection, r10 = t9._selection;
      if (null !== r10) {
        if (r10.dirty || !r10.is(n12)) return true;
      } else if (null !== n12) return true;
      return false;
    })(a10, e5);
    p7 ? a10._flushSync ? (a10._flushSync = false, vi(e5)) : u10 && lo(() => {
      vi(e5);
    }) : (a10._flushSync = false, u10 && (i13.clear(), e5._deferred = [], e5._pendingEditorState = null));
  }
  function bi(t9, e5, n11) {
    ii === t9 && void 0 === n11 ? e5() : Ni(t9, e5, n11);
  }
  function Ei(e5, n11) {
    const r9 = [];
    let i13 = n11;
    for (; i13 !== e5 && null !== i13; i13 = i13.parentNode) {
      let t9 = 0;
      for (let e6 = i13.previousSibling; null !== e6; e6 = e6.previousSibling) t9++;
      r9.push(t9);
    }
    return i13 !== e5 && t2(225), r9.reverse();
  }
  function Mi(t9) {
    return t9 instanceof Oi;
  }
  function Ai(t9, e5, n11) {
    let r9 = t9.getNode();
    for (; r9; ) {
      const t10 = r9.__key;
      if (e5.has(t10) && !n11.has(t10)) return true;
      r9 = r9.getParent();
    }
    return false;
  }
  function Di(t9) {
    return t9 instanceof Pi;
  }
  function Li(t9) {
    return t9 instanceof Fi;
  }
  function Ii(t9) {
    return new Bi(new Map(t9._nodeMap));
  }
  function Ki() {
    return new Bi(/* @__PURE__ */ new Map([["root", new Fi()]]));
  }
  function zi(e5) {
    const n11 = e5.exportJSON(), r9 = e5.constructor;
    if (n11.type !== r9.getType() && t2(130, r9.name), Mi(e5)) {
      const i13 = n11.children;
      Array.isArray(i13) || t2(59, r9.name);
      const o8 = e5.getChildren();
      for (let t9 = 0; t9 < o8.length; t9++) {
        const e6 = zi(o8[t9]);
        i13.push(e6);
      }
    }
    return n11;
  }
  function Ri(t9) {
    return t9 instanceof Bi;
  }
  function ji(t9) {
    const e5 = $i();
    return t9.style && (e5.setFormat(t9.style.textAlign), Ws(t9, e5)), { node: e5 };
  }
  function $i() {
    return Cs(new Ji());
  }
  function Ui(t9) {
    return t9 instanceof Ji;
  }
  function Xi(t9, e5, n11, r9) {
    const i13 = t9._keyToDOMMap;
    i13.clear(), t9._editorState = Ki(), t9._pendingEditorState = r9, t9._compositionKey = null, t9._dirtyType = 0, t9._cloneNotNeeded.clear(), t9._dirtyLeaves = /* @__PURE__ */ new Set(), t9._dirtyElements.clear(), t9._normalizedNodes = /* @__PURE__ */ new Set(), t9._updateTags = /* @__PURE__ */ new Set(), t9._updates = [], t9._blockCursorElement = null;
    const o8 = t9._observer;
    null !== o8 && (o8.disconnect(), t9._observer = null), null !== e5 && (e5.textContent = ""), null !== n11 && (n11.textContent = "", i13.set("root", n11));
  }
  function Qi(t9) {
    const e5 = /* @__PURE__ */ new Set(), n11 = /* @__PURE__ */ new Set();
    let r9 = t9;
    for (; r9; ) {
      const { ownNodeConfig: t10 } = Us(r9), i13 = r9.transform;
      if (!n11.has(i13)) {
        n11.add(i13);
        const t11 = r9.transform();
        t11 && e5.add(t11);
      }
      if (t10) {
        const n12 = t10.$transform;
        n12 && e5.add(n12), r9 = t10.extends;
      } else {
        const t11 = Object.getPrototypeOf(r9);
        r9 = t11.prototype instanceof Rn && t11 !== Rn ? t11 : void 0;
      }
    }
    return e5;
  }
  function Zi(t9) {
    const e5 = t9 || {}, n11 = _i(), r9 = e5.theme || {}, i13 = void 0 === t9 ? n11 : e5.parentEditor || null, o8 = e5.disableEvents || false, s7 = Ki(), l8 = e5.namespace || (null !== i13 ? i13._config.namespace : Bo()), c10 = e5.editorState, a10 = [Fi, sr, Hn, mr, Ji, Wi, ...e5.nodes || []], { onError: u10, html: f8 } = e5, d8 = void 0 === e5.editable || e5.editable;
    let h3;
    if (void 0 === t9 && null !== n11) h3 = n11._nodes;
    else {
      h3 = /* @__PURE__ */ new Map();
      for (let t10 = 0; t10 < a10.length; t10++) {
        let e6 = a10[t10], n12 = null, r10 = null;
        if ("function" != typeof e6) {
          const t11 = e6;
          e6 = t11.replace, n12 = t11.with, r10 = t11.withKlass || null;
        }
        Us(e6);
        const i14 = e6.getType(), o9 = Qi(e6);
        h3.set(i14, { exportDOM: f8 && f8.export ? f8.export.get(e6) : void 0, klass: e6, replace: n12, replaceWithKlass: r10, sharedNodeState: at(a10[t10]), transforms: o9 });
      }
    }
    const g5 = new to(s7, i13, h3, { disableEvents: o8, namespace: l8, theme: r9 }, u10 || console.error, (function(t10, e6) {
      const n12 = /* @__PURE__ */ new Map(), r10 = /* @__PURE__ */ new Set(), i14 = (t11) => {
        Object.keys(t11).forEach((e7) => {
          let r11 = n12.get(e7);
          void 0 === r11 && (r11 = [], n12.set(e7, r11)), r11.push(t11[e7]);
        });
      };
      return t10.forEach((t11) => {
        const e7 = t11.klass.importDOM;
        if (null == e7 || r10.has(e7)) return;
        r10.add(e7);
        const n13 = e7.call(t11.klass);
        null !== n13 && i14(n13);
      }), e6 && i14(e6), n12;
    })(h3, f8 ? f8.import : void 0), d8, t9);
    return void 0 !== c10 && (g5._pendingEditorState = c10, g5._dirtyType = 2), (function(t10) {
      t10.registerCommand(le, vn, Vi), t10.registerCommand(ce, kn, Vi), t10.registerCommand(ae, Tn, Vi), t10.registerCommand(ue, Nn, Vi), t10.registerCommand(ve, wn, Vi);
    })(g5), g5;
  }
  function no(t9) {
    eo = t9;
  }
  function io() {
    ro = 1;
  }
  function oo(e5, n11) {
    const r9 = so(e5, n11);
    return void 0 === r9 && t2(30, n11), r9;
  }
  function so(t9, e5) {
    return t9._nodes.get(e5);
  }
  function co(t9) {
    return Di(Ao(t9));
  }
  function ao(t9) {
    const e5 = document.activeElement;
    if (!Os(e5)) return false;
    const n11 = e5.nodeName;
    return Di(Ao(t9)) && ("INPUT" === n11 || "TEXTAREA" === n11 || "true" === e5.contentEditable && null == go(e5));
  }
  function uo(t9, e5, n11) {
    const r9 = t9.getRootElement();
    try {
      return null !== r9 && r9.contains(e5) && r9.contains(n11) && null !== e5 && !ao(e5) && ho(e5) === t9;
    } catch (t10) {
      return false;
    }
  }
  function fo(t9) {
    return t9 instanceof to;
  }
  function ho(t9) {
    let e5 = t9;
    for (; null != e5; ) {
      const t10 = go(e5);
      if (fo(t10)) return t10;
      e5 = cs(e5);
    }
    return null;
  }
  function go(t9) {
    return t9 ? t9.__lexicalEditor : null;
  }
  function _o(t9) {
    return K.test(t9) ? "rtl" : z.test(t9) ? "ltr" : null;
  }
  function po(t9) {
    return Cr(t9) || t9.isToken();
  }
  function yo(t9) {
    return po(t9) || t9.isSegmented();
  }
  function mo(t9) {
    return Ms(t9) && 3 === t9.nodeType;
  }
  function xo(t9) {
    return Ms(t9) && 9 === t9.nodeType;
  }
  function Co(t9) {
    let e5 = t9;
    for (; null != e5; ) {
      if (mo(e5)) return e5;
      e5 = e5.firstChild;
    }
    return null;
  }
  function So(t9, e5, n11) {
    const r9 = R[e5];
    if (null !== n11 && (t9 & r9) === (n11 & r9)) return t9;
    let i13 = t9 ^ r9;
    return "subscript" === e5 ? i13 &= ~R.superscript : "superscript" === e5 ? i13 &= ~R.subscript : "lowercase" === e5 ? (i13 &= ~R.uppercase, i13 &= ~R.capitalize) : "uppercase" === e5 ? (i13 &= ~R.lowercase, i13 &= ~R.capitalize) : "capitalize" === e5 && (i13 &= ~R.lowercase, i13 &= ~R.uppercase), i13;
  }
  function vo(t9) {
    return pr(t9) || Qn(t9) || Di(t9);
  }
  function ko(t9, e5) {
    const n11 = (function() {
      const t10 = eo;
      return eo = null, t10;
    })();
    if (null != (e5 = e5 || n11 && n11.__key)) return void (t9.__key = e5);
    ui(), fi();
    const r9 = hi(), i13 = di(), o8 = "" + ro++;
    i13._nodeMap.set(o8, t9), Mi(t9) ? r9._dirtyElements.set(o8, true) : r9._dirtyLeaves.add(o8), r9._cloneNotNeeded.add(o8), r9._dirtyType = 1, t9.__key = o8;
  }
  function To(t9) {
    const e5 = t9.getParent();
    if (null !== e5) {
      const n11 = t9.getWritable(), r9 = e5.getWritable(), i13 = t9.getPreviousSibling(), o8 = t9.getNextSibling(), s7 = null !== o8 ? o8.__key : null, l8 = null !== i13 ? i13.__key : null, c10 = null !== i13 ? i13.getWritable() : null, a10 = null !== o8 ? o8.getWritable() : null;
      null === i13 && (r9.__first = s7), null === o8 && (r9.__last = l8), null !== c10 && (c10.__next = s7), null !== a10 && (a10.__prev = l8), n11.__prev = null, n11.__next = null, n11.__parent = null, r9.__size--;
    }
  }
  function No(e5) {
    fi(), zn(e5) && t2(323, e5.__key, e5.__type);
    const n11 = e5.getLatest(), r9 = n11.__parent, i13 = di(), o8 = hi(), s7 = i13._nodeMap, l8 = o8._dirtyElements;
    null !== r9 && (function(t9, e6, n12) {
      let r10 = t9;
      for (; null !== r10; ) {
        if (n12.has(r10)) return;
        const t10 = e6.get(r10);
        if (void 0 === t10) break;
        n12.set(r10, false), r10 = t10.__parent;
      }
    })(r9, s7, l8);
    const c10 = n11.__key;
    o8._dirtyType = 1, Mi(e5) ? l8.set(c10, true) : o8._dirtyLeaves.add(c10);
  }
  function bo(t9) {
    ui();
    const e5 = hi(), n11 = e5._compositionKey;
    if (t9 !== n11) {
      if (e5._compositionKey = t9, null !== n11) {
        const t10 = Eo(n11);
        null !== t10 && t10.getWritable();
      }
      if (null !== t9) {
        const e6 = Eo(t9);
        null !== e6 && e6.getWritable();
      }
    }
  }
  function wo() {
    if (ai()) return null;
    return hi()._compositionKey;
  }
  function Eo(t9, e5) {
    const n11 = (e5 || di())._nodeMap.get(t9);
    return void 0 === n11 ? null : n11;
  }
  function Oo(t9, e5) {
    const n11 = Mo(t9, hi());
    return void 0 !== n11 ? Eo(n11, e5) : null;
  }
  function Mo(t9, e5) {
    return t9[`__lexicalKey_${e5._key}`];
  }
  function Ao(t9, e5) {
    let n11 = t9;
    for (; null != n11; ) {
      const t10 = Oo(n11, e5);
      if (null !== t10) return t10;
      n11 = cs(n11);
    }
    return null;
  }
  function Po(t9) {
    const e5 = t9._decorators, n11 = Object.assign({}, e5);
    return t9._pendingDecorators = n11, n11;
  }
  function Do(t9) {
    return t9.read(() => Fo().getTextContent());
  }
  function Fo() {
    return Lo(di());
  }
  function Lo(t9) {
    return t9._nodeMap.get("root");
  }
  function Io(t9) {
    ui();
    const e5 = di();
    null !== t9 && (t9.dirty = true, t9.setCachedNodes(null)), e5._selection = t9;
  }
  function Ko(t9) {
    const e5 = hi(), n11 = (function(t10, e6) {
      let n12 = t10;
      for (; null != n12; ) {
        const t11 = Mo(n12, e6);
        if (void 0 !== t11) return t11;
        n12 = cs(n12);
      }
      return null;
    })(t9, e5);
    if (null === n11) {
      return t9 === e5.getRootElement() ? Eo("root") : null;
    }
    return Eo(n11);
  }
  function zo(t9) {
    return /[\uD800-\uDBFF][\uDC00-\uDFFF]/g.test(t9);
  }
  function Ro(t9) {
    const e5 = [];
    let n11 = t9;
    for (; null !== n11; ) e5.push(n11), n11 = n11._parentEditor;
    return e5;
  }
  function Bo() {
    return Math.random().toString(36).replace(/[^a-z]+/g, "").substring(0, 5);
  }
  function Wo(t9) {
    return mo(t9) ? t9.nodeValue : null;
  }
  function Jo(t9, e5, n11) {
    const r9 = Ns(_s(e5));
    if (null === r9) return;
    const i13 = r9.anchorNode;
    let { anchorOffset: o8, focusOffset: s7 } = r9;
    if (null !== i13) {
      let e6 = Wo(i13);
      const r10 = Ao(i13);
      if (null !== e6 && pr(r10)) {
        if (e6 === P && n11) {
          const t10 = n11.length;
          e6 = n11, o8 = t10, s7 = t10;
        }
        null !== e6 && jo(r10, e6, o8, s7, t9);
      }
    }
  }
  function jo(t9, e5, n11, r9, i13) {
    let o8 = t9;
    if (o8.isAttached() && (i13 || !o8.isDirty())) {
      const s7 = o8.isComposing();
      let a10 = e5;
      (s7 || i13) && e5[e5.length - 1] === P && (a10 = e5.slice(0, -1));
      const u10 = o8.getTextContent();
      if (i13 || a10 !== u10) {
        if ("" === a10) {
          if (bo(null), l || c || d) o8.remove();
          else {
            const t10 = hi();
            setTimeout(() => {
              t10.update(() => {
                o8.isAttached() && o8.remove();
              });
            }, 20);
          }
          return;
        }
        const e6 = o8.getParent(), i14 = Ur(), u11 = o8.getTextContentSize(), f8 = wo(), h3 = o8.getKey();
        if (o8.isToken() || null !== f8 && h3 === f8 && !s7 || br(i14) && (null !== e6 && !e6.canInsertTextBefore() && 0 === i14.anchor.offset || i14.anchor.key === t9.__key && 0 === i14.anchor.offset && !o8.canInsertTextBefore() && !s7 || i14.focus.key === t9.__key && i14.focus.offset === u11 && !o8.canInsertTextAfter() && !s7)) return void o8.markDirty();
        const g5 = $r();
        if (!br(g5) || null === n11 || null === r9) return void $o(o8, a10, g5);
        if (g5.setTextNodeRange(o8, n11, o8, r9), o8.isSegmented()) {
          const t10 = _r(o8.getTextContent());
          o8.replace(t10), o8 = t10;
        }
        $o(o8, a10, g5);
      }
    }
  }
  function $o(t9, e5, n11) {
    if (t9.setTextContent(e5), br(n11)) {
      const e6 = t9.getKey();
      for (const r9 of ["anchor", "focus"]) {
        const i13 = n11[r9];
        "text" === i13.type && i13.key === e6 && (i13.offset = fl(t9, i13.offset, "clamp"));
      }
    }
  }
  function Uo(t9, e5, n11) {
    const r9 = e5[n11] || false;
    return "any" === r9 || r9 === t9[n11];
  }
  function Vo(t9, e5) {
    return Uo(t9, e5, "altKey") && Uo(t9, e5, "ctrlKey") && Uo(t9, e5, "shiftKey") && Uo(t9, e5, "metaKey");
  }
  function Yo(t9, e5, n11) {
    return Vo(t9, n11) && t9.key.toLowerCase() === e5.toLowerCase();
  }
  function Go(t9) {
    return "Backspace" === t9.key;
  }
  function Xo(t9) {
    return Yo(t9, "a", qo);
  }
  function Qo(t9) {
    const e5 = Fo();
    if (br(t9)) {
      const e6 = t9.anchor, n11 = t9.focus, r9 = e6.getNode().getTopLevelElementOrThrow().getParentOrThrow();
      return e6.set(r9.getKey(), 0, "element"), n11.set(r9.getKey(), r9.getChildrenSize(), "element"), St(t9), t9;
    }
    {
      const t10 = e5.select(0, e5.getChildrenSize());
      return Io(St(t10)), t10;
    }
  }
  function Zo(t9, e5) {
    void 0 === t9.__lexicalClassNameCache && (t9.__lexicalClassNameCache = {});
    const n11 = t9.__lexicalClassNameCache, r9 = n11[e5];
    if (void 0 !== r9) return r9;
    const i13 = t9[e5];
    if ("string" == typeof i13) {
      const t10 = h(i13);
      return n11[e5] = t10, t10;
    }
    return i13;
  }
  function ts(e5, n11, r9, i13, o8) {
    if (0 === r9.size) return;
    const s7 = i13.__type, l8 = i13.__key, c10 = n11.get(s7);
    void 0 === c10 && t2(33, s7);
    const a10 = c10.klass;
    let u10 = e5.get(a10);
    void 0 === u10 && (u10 = /* @__PURE__ */ new Map(), e5.set(a10, u10));
    const f8 = u10.get(l8), d8 = "destroyed" === f8 && "created" === o8;
    (void 0 === f8 || d8) && u10.set(l8, d8 ? "updated" : o8);
  }
  function es(t9) {
    const e5 = t9.getType(), n11 = di();
    if (n11._readOnly) {
      const t10 = zs(n11).get(e5);
      return t10 ? Array.from(t10.values()) : [];
    }
    const r9 = n11._nodeMap, i13 = [];
    for (const [, n12] of r9) n12 instanceof t9 && n12.__type === e5 && n12.isAttached() && i13.push(n12);
    return i13;
  }
  function ns(t9, e5, n11) {
    const r9 = t9.getParent();
    let i13 = n11, o8 = t9;
    return null !== r9 && (e5 && 0 === n11 ? (i13 = o8.getIndexWithinParent(), o8 = r9) : e5 || n11 !== o8.getChildrenSize() || (i13 = o8.getIndexWithinParent() + 1, o8 = r9)), o8.getChildAtIndex(e5 ? i13 - 1 : i13);
  }
  function rs(t9, e5) {
    const n11 = t9.offset;
    if ("element" === t9.type) {
      return ns(t9.getNode(), e5, n11);
    }
    {
      const r9 = t9.getNode();
      if (e5 && 0 === n11 || !e5 && n11 === r9.getTextContentSize()) {
        const t10 = e5 ? r9.getPreviousSibling() : r9.getNextSibling();
        return null === t10 ? ns(r9.getParentOrThrow(), e5, r9.getIndexWithinParent() + (e5 ? 0 : 1)) : t10;
      }
    }
    return null;
  }
  function is(t9) {
    const e5 = _s(t9).event, n11 = e5 && e5.inputType;
    return "insertFromPaste" === n11 || "insertFromPasteAsQuotation" === n11;
  }
  function os(t9, e5, n11) {
    return (function(t10, e6, n12) {
      const r9 = Ro(t10);
      for (let i13 = 4; i13 >= 0; i13--) for (let o8 = 0; o8 < r9.length; o8++) {
        const s7 = r9[o8], l8 = s7._commands.get(e6);
        if (void 0 !== l8) {
          const e7 = l8[i13];
          if (void 0 !== e7) {
            const r10 = Array.from(e7), i14 = r10.length;
            let o9 = false;
            if (bi(s7, () => {
              for (let e8 = 0; e8 < i14; e8++) if (r10[e8](n12, t10)) return void (o9 = true);
            }), o9) return o9;
          }
        }
      }
      return false;
    })(t9, e5, n11);
  }
  function ss(t9) {
    return !Li(t9) && !t9.isLastChild() && !t9.isInline();
  }
  function ls(e5, n11) {
    const r9 = e5._keyToDOMMap.get(n11);
    return void 0 === r9 && t2(75, n11), r9;
  }
  function cs(t9) {
    const e5 = t9.assignedSlot || t9.parentElement;
    return As(e5) ? e5.host : e5;
  }
  function as(t9) {
    return xo(t9) ? t9 : Os(t9) ? t9.ownerDocument : null;
  }
  function us(t9) {
    return hi()._updateTags.has(t9);
  }
  function fs(t9) {
    ui();
    hi()._updateTags.add(t9);
  }
  function ds(t9) {
    ui();
    hi()._deferred.push(t9);
  }
  function hs(t9, e5) {
    let n11 = t9.getParent();
    for (; null !== n11; ) {
      if (n11.is(e5)) return true;
      n11 = n11.getParent();
    }
    return false;
  }
  function gs(t9) {
    const e5 = as(t9);
    return e5 ? e5.defaultView : null;
  }
  function _s(e5) {
    const n11 = e5._window;
    return null === n11 && t2(78), n11;
  }
  function ps(t9) {
    return Mi(t9) && t9.isInline() || Di(t9) && t9.isInline();
  }
  function ys(t9) {
    let e5 = t9.getParentOrThrow();
    for (; null !== e5; ) {
      if (ms(e5)) return e5;
      e5 = e5.getParentOrThrow();
    }
    return e5;
  }
  function ms(t9) {
    return Li(t9) || Mi(t9) && t9.isShadowRoot();
  }
  function xs(t9) {
    const e5 = t9.constructor.clone(t9);
    return ko(e5, null), e5.afterCloneFrom(t9), e5;
  }
  function Cs(e5) {
    const n11 = hi(), r9 = e5.getType(), i13 = so(n11, r9);
    void 0 === i13 && t2(200, e5.constructor.name, r9);
    const { replace: o8, replaceWithKlass: s7 } = i13;
    if (null !== o8) {
      const n12 = o8(e5), i14 = n12.constructor;
      return null !== s7 ? n12 instanceof s7 || t2(201, s7.name, s7.getType(), i14.name, i14.getType(), e5.constructor.name, r9) : n12 instanceof e5.constructor && i14 !== e5.constructor || t2(202, i14.name, i14.getType(), e5.constructor.name, r9), n12.__key === e5.__key && t2(203, e5.constructor.name, r9, i14.name, i14.getType()), n12;
    }
    return e5;
  }
  function Ss(e5, n11) {
    !Li(e5.getParent()) || Mi(n11) || Di(n11) || t2(99);
  }
  function vs(e5) {
    const n11 = Eo(e5);
    return null === n11 && t2(63, e5), n11;
  }
  function ks(t9) {
    return (Di(t9) || Mi(t9) && !t9.canBeEmpty()) && !t9.isInline();
  }
  function Ts(t9, e5, n11) {
    n11.style.removeProperty("caret-color"), e5._blockCursorElement = null;
    const r9 = t9.parentElement;
    null !== r9 && r9.removeChild(t9);
  }
  function Ns(t9) {
    return n2 ? (t9 || window).getSelection() : null;
  }
  function bs(t9) {
    const e5 = gs(t9);
    return e5 ? e5.getSelection() : null;
  }
  function ws(e5, n11) {
    let r9 = e5.getChildAtIndex(n11);
    null == r9 && (r9 = e5), ms(e5) && t2(102);
    const i13 = (e6) => {
      const n12 = e6.getParentOrThrow(), o9 = ms(n12), s8 = e6 !== r9 || o9 ? xs(e6) : e6;
      if (o9) return Mi(e6) && Mi(s8) || t2(133), e6.insertAfter(s8), [e6, s8, s8];
      {
        const [t9, r10, o10] = i13(n12), l8 = e6.getNextSiblings();
        return o10.append(s8, ...l8), [t9, r10, s8];
      }
    }, [o8, s7] = i13(r9);
    return [o8, s7];
  }
  function Es(t9) {
    return Os(t9) && "A" === t9.tagName;
  }
  function Os(t9) {
    return Ms(t9) && 1 === t9.nodeType;
  }
  function Ms(t9) {
    return "object" == typeof t9 && null !== t9 && "nodeType" in t9 && "number" == typeof t9.nodeType;
  }
  function As(t9) {
    return Ms(t9) && 11 === t9.nodeType;
  }
  function Ps(t9) {
    const e5 = new RegExp(/^(a|abbr|acronym|b|cite|code|del|em|i|ins|kbd|label|mark|output|q|ruby|s|samp|span|strong|sub|sup|time|u|tt|var|#text)$/, "i");
    return null !== t9.nodeName.match(e5);
  }
  function Ds(t9) {
    const e5 = new RegExp(/^(address|article|aside|blockquote|canvas|dd|div|dl|dt|fieldset|figcaption|figure|footer|form|h1|h2|h3|h4|h5|h6|header|hr|li|main|nav|noscript|ol|p|pre|section|table|td|tfoot|ul|video)$/, "i");
    return null !== t9.nodeName.match(e5);
  }
  function Fs(t9) {
    if (Di(t9) && !t9.isInline()) return true;
    if (!Mi(t9) || ms(t9)) return false;
    const e5 = t9.getFirstChild(), n11 = null === e5 || Qn(e5) || pr(e5) || e5.isInline();
    return !t9.isInline() && false !== t9.canBeEmpty() && n11;
  }
  function Ls() {
    return hi();
  }
  function zs(e5) {
    if (!e5._readOnly && e5.isEmpty()) return Ks;
    e5._readOnly || t2(192);
    let n11 = Is.get(e5);
    return n11 || (n11 = (function(t9) {
      const e6 = /* @__PURE__ */ new Map();
      for (const [n12, r9] of t9._nodeMap) {
        const t10 = r9.__type;
        let i13 = e6.get(t10);
        i13 || (i13 = /* @__PURE__ */ new Map(), e6.set(t10, i13)), i13.set(n12, r9);
      }
      return e6;
    })(e5), Is.set(e5, n11)), n11;
  }
  function Rs(t9) {
    const e5 = t9.constructor.clone(t9);
    return e5.afterCloneFrom(t9), e5;
  }
  function Bs(t9) {
    return (e5 = Rs(t9))[Kn] = true, e5;
    var e5;
  }
  function Ws(t9, e5) {
    const n11 = parseInt(t9.style.paddingInlineStart, 10) || 0, r9 = Math.round(n11 / 40);
    e5.setIndent(r9);
  }
  function Js(t9) {
    t9.__lexicalUnmanaged = true;
  }
  function js(t9) {
    return true === t9.__lexicalUnmanaged;
  }
  function $s(t9, e5) {
    return (function(t10, e6) {
      return Object.prototype.hasOwnProperty.call(t10, e6);
    })(t9, e5) && t9[e5] !== Rn[e5];
  }
  function Us(e5) {
    const n11 = V in e5.prototype ? e5.prototype[V]() : void 0, r9 = (function(e6) {
      if (!(e6 === Rn || e6.prototype instanceof Rn)) {
        let n12 = "<unknown>", r10 = "<unknown>";
        try {
          n12 = e6.getType();
        } catch (t9) {
        }
        try {
          to.version && (r10 = JSON.parse(to.version));
        } catch (t9) {
        }
        t2(290, e6.name, n12, r10);
      }
      return e6 === Pi || e6 === Oi || e6 === Rn;
    })(e5), i13 = !r9 && $s(e5, "getType") ? e5.getType() : void 0;
    let o8, s7 = i13;
    if (n11) if (i13) o8 = n11[i13];
    else for (const [t9, e6] of Object.entries(n11)) s7 = t9, o8 = e6;
    if (!r9 && s7 && ($s(e5, "getType") || (e5.getType = () => s7), $s(e5, "clone") || (e5.clone = (t9) => (no(t9), new e5())), $s(e5, "importJSON") || (e5.importJSON = o8 && o8.$importJSON || ((t9) => new e5().updateFromJSON(t9))), !$s(e5, "importDOM") && o8)) {
      const { importDOM: t9 } = o8;
      t9 && (e5.importDOM = () => t9);
    }
    return { ownNodeConfig: o8, ownNodeType: s7 };
  }
  function Vs(t9) {
    const e5 = Ls();
    ui();
    return new (e5.resolveRegisteredNodeAfterReplacements(e5.getRegisteredNode(t9))).klass();
  }
  function Qs(t9) {
    return qs[t9];
  }
  function Zs(t9, e5 = "root") {
    return Xs[e5](t9) ? null : t9;
  }
  function nl(t9) {
    return t9 instanceof el;
  }
  function rl(t9) {
    return t9 instanceof Hs;
  }
  function il(t9) {
    return t9 instanceof tl;
  }
  function ol(t9) {
    return t9 instanceof Gs;
  }
  function al(t9, e5) {
    return t9 ? new ll[e5](t9) : null;
  }
  function ul(t9, e5, n11) {
    return t9 ? new sl[e5](t9, fl(t9, n11)) : null;
  }
  function fl(t9, n11, r9 = "error") {
    const i13 = t9.getTextContentSize();
    let o8 = "next" === n11 ? i13 : "previous" === n11 ? 0 : n11;
    return (o8 < 0 || o8 > i13) && ("clamp" !== r9 && e2(284, String(n11), String(i13), t9.getKey()), o8 = o8 < 0 ? 0 : i13), o8;
  }
  function dl(t9, e5) {
    return new yl(t9, e5);
  }
  function hl(t9, e5) {
    return Mi(t9) ? new cl[e5](t9) : null;
  }
  function gl(t9) {
    return t9 && t9.getChildCaret() || t9;
  }
  function _l(t9) {
    return t9 && gl(t9.getAdjacentCaret());
  }
  function ml(t9) {
    return t9 instanceof yl;
  }
  function xl(t9) {
    return Sl(t9, al(Fo(), t9.direction));
  }
  function Cl(t9) {
    return Sl(t9, t9);
  }
  function Sl(e5, n11) {
    return e5.direction !== n11.direction && t2(265), new pl(e5, n11, e5.direction);
  }
  function vl(t9) {
    const { initial: e5, hasNext: n11, step: r9, map: i13 } = t9;
    let o8 = e5;
    return { [Symbol.iterator]() {
      return this;
    }, next() {
      if (!n11(o8)) return { done: true, value: void 0 };
      const t10 = { done: false, value: i13(o8) };
      return o8 = r9(o8), t10;
    } };
  }
  function kl(e5, n11) {
    const r9 = wl(e5.origin, n11.origin);
    switch (null === r9 && t2(275, e5.origin.getKey(), n11.origin.getKey()), r9.type) {
      case "same": {
        const t9 = "text" === e5.type, r10 = "text" === n11.type;
        return t9 && r10 ? (function(t10, e6) {
          return Math.sign(t10 - e6);
        })(e5.offset, n11.offset) : e5.type === n11.type ? 0 : t9 ? -1 : r10 ? 1 : "child" === e5.type ? -1 : 1;
      }
      case "ancestor":
        return "child" === e5.type ? -1 : 1;
      case "descendant":
        return "child" === n11.type ? 1 : -1;
      case "branch":
        return Tl(r9);
    }
  }
  function Tl(t9) {
    const { a: e5, b: n11 } = t9, r9 = e5.__key, i13 = n11.__key;
    let o8 = e5, s7 = n11;
    for (; o8 && s7; o8 = o8.getNextSibling(), s7 = s7.getNextSibling()) {
      if (o8.__key === i13) return -1;
      if (s7.__key === r9) return 1;
    }
    return null === o8 ? 1 : -1;
  }
  function Nl(t9, e5) {
    return e5.is(t9);
  }
  function bl(t9) {
    return Mi(t9) ? [t9.getLatest(), null] : [t9.getParent(), t9.getLatest()];
  }
  function wl(e5, n11) {
    if (e5.is(n11)) return { commonAncestor: e5, type: "same" };
    const r9 = /* @__PURE__ */ new Map();
    for (let [t9, n12] = bl(e5); t9; n12 = t9, t9 = t9.getParent()) r9.set(t9, n12);
    for (let [i13, o8] = bl(n11); i13; o8 = i13, i13 = i13.getParent()) {
      const s7 = r9.get(i13);
      if (void 0 !== s7) return null === s7 ? (Nl(e5, i13) || t2(276), { commonAncestor: i13, type: "ancestor" }) : null === o8 ? (Nl(n11, i13) || t2(277), { commonAncestor: i13, type: "descendant" }) : ((Mi(s7) || Nl(e5, s7)) && (Mi(o8) || Nl(n11, o8)) && i13.is(s7.getParent()) && i13.is(o8.getParent()) || t2(278), { a: s7, b: o8, commonAncestor: i13, type: "branch" });
    }
    return null;
  }
  function El(e5, n11) {
    const { type: r9, key: i13, offset: o8 } = e5, s7 = vs(e5.key);
    return "text" === r9 ? (pr(s7) || t2(266, s7.getType(), i13), ul(s7, n11, o8)) : (Mi(s7) || t2(267, s7.getType(), i13), Wl(s7, e5.offset, n11));
  }
  function Ol(e5, n11) {
    const { origin: r9, direction: i13 } = n11, o8 = "next" === i13;
    nl(n11) ? e5.set(r9.getKey(), n11.offset, "text") : il(n11) ? pr(r9) ? e5.set(r9.getKey(), fl(r9, i13), "text") : e5.set(r9.getParentOrThrow().getKey(), r9.getIndexWithinParent() + (o8 ? 1 : 0), "element") : (ol(n11) && Mi(r9) || t2(268), e5.set(r9.getKey(), o8 ? 0 : r9.getChildrenSize(), "element"));
  }
  function Ml(t9) {
    const e5 = $r(), n11 = br(e5) ? e5 : Br();
    return Al(n11, t9), Io(n11), n11;
  }
  function Al(t9, e5) {
    Ol(t9.anchor, e5.anchor), Ol(t9.focus, e5.focus);
  }
  function Pl(t9) {
    const { anchor: e5, focus: n11 } = t9, r9 = El(e5, "next"), i13 = El(n11, "next"), o8 = kl(r9, i13) <= 0 ? "next" : "previous";
    return Sl(Rl(r9, o8), Rl(i13, o8));
  }
  function Dl(t9) {
    const { direction: e5, origin: n11 } = t9, r9 = al(n11, Qs(e5)).getNodeAtCaret();
    return r9 ? al(r9, e5) : hl(n11.getParentOrThrow(), e5);
  }
  function Fl(t9, e5 = "root") {
    const n11 = [t9];
    for (let r9 = ol(t9) ? t9.getParentCaret(e5) : t9.getSiblingCaret(); null !== r9; r9 = r9.getParentCaret(e5)) n11.push(Dl(r9));
    return n11;
  }
  function Ll(t9) {
    return !!t9 && t9.origin.isAttached();
  }
  function Il(e5, n11 = "removeEmptySlices") {
    if (e5.isCollapsed()) return e5;
    const r9 = "root", i13 = "next";
    let o8 = n11;
    const s7 = Bl(e5, i13), l8 = Fl(s7.anchor, r9), c10 = Fl(s7.focus.getFlipped(), r9), a10 = /* @__PURE__ */ new Set(), u10 = [];
    for (const t9 of s7.iterNodeCarets(r9)) if (ol(t9)) a10.add(t9.origin.getKey());
    else if (il(t9)) {
      const { origin: e6 } = t9;
      Mi(e6) && !a10.has(e6.getKey()) || u10.push(e6);
    }
    for (const t9 of u10) t9.remove();
    for (const t9 of s7.getTextSlices()) {
      if (!t9) continue;
      const { origin: e6 } = t9.caret, n12 = e6.getTextContentSize(), r10 = Dl(al(e6, i13)), s8 = e6.getMode();
      if (Math.abs(t9.distance) === n12 && "removeEmptySlices" === o8 || "token" === s8 && 0 !== t9.distance) r10.remove();
      else if (0 !== t9.distance) {
        o8 = "removeEmptySlices";
        let e7 = t9.removeTextSlice();
        const n13 = t9.caret.origin;
        if ("segmented" === s8) {
          const t10 = e7.origin, n14 = _r(t10.getTextContent()).setStyle(t10.getStyle()).setFormat(t10.getFormat());
          r10.replaceOrInsert(n14), e7 = ul(n14, i13, e7.offset);
        }
        n13.is(l8[0].origin) && (l8[0] = e7), n13.is(c10[0].origin) && (c10[0] = e7.getFlipped());
      }
    }
    let f8, d8;
    for (const t9 of l8) if (Ll(t9)) {
      f8 = Kl(t9);
      break;
    }
    for (const t9 of c10) if (Ll(t9)) {
      d8 = Kl(t9);
      break;
    }
    const h3 = (function(t9, e6, n12) {
      if (!t9 || !e6) return null;
      const r10 = t9.getParentAtCaret(), i14 = e6.getParentAtCaret();
      if (!r10 || !i14) return null;
      const o9 = r10.getParents().reverse();
      o9.push(r10);
      const s8 = i14.getParents().reverse();
      s8.push(i14);
      const l9 = Math.min(o9.length, s8.length);
      let c11;
      for (c11 = 0; c11 < l9 && o9[c11] === s8[c11]; c11++) ;
      const a11 = (t10, e7) => {
        let n13;
        for (let r11 = c11; r11 < t10.length; r11++) {
          const i15 = t10[r11];
          if (ms(i15)) return;
          !n13 && e7(i15) && (n13 = i15);
        }
        return n13;
      }, u11 = a11(o9, Fs), f9 = u11 && a11(s8, (t10) => n12.has(t10.getKey()) && Fs(t10));
      return u11 && f9 ? [u11, f9] : null;
    })(f8, d8, a10);
    if (h3) {
      const [t9, e6] = h3;
      hl(t9, "previous").splice(0, e6.getChildren()), e6.remove();
    }
    const g5 = [f8, d8, ...l8, ...c10].find(Ll);
    if (g5) {
      return Cl(Rl(Kl(g5), e5.direction));
    }
    t2(269, JSON.stringify(l8.map((t9) => t9.origin.__key)));
  }
  function Kl(t9) {
    const e5 = (function(t10) {
      let e6 = t10;
      for (; ol(e6); ) {
        const t11 = _l(e6);
        if (!ol(t11)) break;
        e6 = t11;
      }
      return e6;
    })(t9.getLatest()), { direction: n11 } = e5;
    if (pr(e5.origin)) return nl(e5) ? e5 : ul(e5.origin, n11, n11);
    const r9 = e5.getAdjacentCaret();
    return il(r9) && pr(r9.origin) ? ul(r9.origin, n11, Qs(n11)) : e5;
  }
  function zl(t9) {
    return nl(t9) && t9.offset !== fl(t9.origin, t9.direction);
  }
  function Rl(t9, e5) {
    return t9.direction === e5 ? t9 : t9.getFlipped();
  }
  function Bl(t9, e5) {
    return t9.direction === e5 ? t9 : Sl(Rl(t9.focus, e5), Rl(t9.anchor, e5));
  }
  function Wl(t9, e5, n11) {
    let r9 = hl(t9, "next");
    for (let t10 = 0; t10 < e5; t10++) {
      const t11 = r9.getAdjacentCaret();
      if (null === t11) break;
      r9 = t11;
    }
    return Rl(r9, n11);
  }
  function Jl(t9, e5 = "root") {
    let n11 = 0, r9 = t9, i13 = _l(r9);
    for (; null === i13; ) {
      if (n11--, i13 = r9.getParentCaret(e5), !i13) return null;
      r9 = i13, i13 = _l(r9);
    }
    return i13 && [i13, n11];
  }
  function jl(e5) {
    const { origin: n11, offset: r9, direction: i13 } = e5;
    if (r9 === fl(n11, i13)) return e5.getSiblingCaret();
    if (r9 === fl(n11, Qs(i13))) return Dl(e5.getSiblingCaret());
    const [o8] = n11.splitText(r9);
    return pr(o8) || t2(281), Rl(al(o8, "next"), i13);
  }
  function $l(t9, e5) {
    return true;
  }
  function Ul(t9, { $copyElementNode: e5 = xs, $splitTextPointCaretNext: n11 = jl, rootMode: r9 = "shadowRoot", $shouldSplit: i13 = $l } = {}) {
    if (nl(t9)) return n11(t9);
    const o8 = t9.getParentCaret(r9);
    if (o8) {
      const { origin: n12 } = o8;
      if (ol(t9) && (!n12.canBeEmpty() || !i13(n12, "first"))) return Dl(o8);
      const r10 = (function(t10) {
        const e6 = [];
        for (let n13 = t10.getAdjacentCaret(); n13; n13 = n13.getAdjacentCaret()) e6.push(n13.origin);
        return e6;
      })(t9);
      (r10.length > 0 || n12.canBeEmpty() && i13(n12, "last")) && o8.insert(e5(n12).splice(0, 0, r10));
    }
    return o8;
  }
  function Vl(t9) {
    return t9;
  }
  function Yl(...t9) {
    return t9;
  }
  function ql(t9, e5) {
    return [t9, e5];
  }
  function Hl(t9) {
    return t9;
  }
  function Gl(t9, e5) {
    if (!e5 || t9 === e5) return t9;
    for (const n11 in e5) if (t9[n11] !== e5[n11]) return { ...t9, ...e5 };
    return t9;
  }
  var n2, r2, i, o2, s, l, c, a, u, f, d, g, _, p, y, m, x, C, S, v, k, T, N, b, w, E, O, M, A, P, D, F, L, I, K, z, R, B, W, J, j, $, U, V, q, H, it, ut, kt, Tt, Nt, bt, wt, Et, Ot, Mt, At, Pt, Dt, Ft, Lt, It, Kt, zt, Jt, ie, oe, se, le, ce, ae, ue, fe, de, he, ge, _e, pe, ye, me, xe, Ce, Se, ve, ke, Te, Ne, be, we, Ee, Oe, Me, Ae, Pe, De, Fe, Le, Ie, Ke, ze, Re, Be, We, Je, je, $e, Ue, Ve, Ye, qe, He, Ge, Xe, Qe, Ze, tn, en, nn, rn, on, sn, ln, cn, an, un, fn, dn, hn, gn, _n, On, Dn, Kn, Rn, Bn, Wn, Jn, jn, $n, Un, Vn, Yn, qn, Hn, sr, ar, hr, mr, Sr, Nr, wr, Pr, ri, ii, oi, si, li, ci, wi, Oi, Pi, Fi, Bi, Wi, Ji, Vi, Yi, qi, Hi, Gi, to, eo, ro, lo, qo, Ho, Is, Ks, Ys, qs, Hs, Gs, Xs, tl, el, sl, ll, cl, pl, yl;
  var init_Lexical_prod = __esm({
    "node_modules/lexical/Lexical.prod.mjs"() {
      n2 = "undefined" != typeof window && void 0 !== window.document && void 0 !== window.document.createElement;
      r2 = n2 && "documentMode" in document ? document.documentMode : null;
      i = n2 && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
      o2 = n2 && /^(?!.*Seamonkey)(?=.*Firefox).*/i.test(navigator.userAgent);
      s = !(!n2 || !("InputEvent" in window) || r2) && "getTargetRanges" in new window.InputEvent("input");
      l = n2 && /Version\/[\d.]+.*Safari/.test(navigator.userAgent);
      c = n2 && /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
      a = n2 && /Android/.test(navigator.userAgent);
      u = n2 && /^(?=.*Chrome).*/i.test(navigator.userAgent);
      f = n2 && a && u;
      d = n2 && /AppleWebKit\/[\d.]+/.test(navigator.userAgent) && i && !u;
      g = 0;
      _ = 1;
      p = 2;
      y = 1;
      m = 2;
      x = 4;
      C = 8;
      S = 16;
      v = 32;
      k = 64;
      T = 128;
      N = 2047;
      b = 1;
      w = 2;
      E = 3;
      O = 4;
      M = 5;
      A = 6;
      P = l || c || d ? "\xA0" : "\u200B";
      D = "\n\n";
      F = o2 ? "\xA0" : P;
      L = "\u0591-\u07FF\uFB1D-\uFDFD\uFE70-\uFEFC";
      I = "A-Za-z\xC0-\xD6\xD8-\xF6\xF8-\u02B8\u0300-\u0590\u0800-\u1FFF\u200E\u2C00-\uFB1C\uFE00-\uFE6F\uFEFD-\uFFFF";
      K = new RegExp("^[^" + I + "]*[" + L + "]");
      z = new RegExp("^[^" + L + "]*[" + I + "]");
      R = { bold: 1, capitalize: 1024, code: 16, highlight: T, italic: 2, lowercase: 256, strikethrough: 4, subscript: 32, superscript: 64, underline: 8, uppercase: 512 };
      B = { directionless: 1, unmergeable: 2 };
      W = { center: 2, end: 6, justify: 4, left: 1, right: 3, start: 5 };
      J = { [w]: "center", [A]: "end", [O]: "justify", [b]: "left", [E]: "right", [M]: "start" };
      j = { normal: 0, segmented: 2, token: 1 };
      $ = { [g]: "normal", [p]: "segmented", [_]: "token" };
      U = "$";
      V = "$config";
      q = false;
      H = 0;
      it = class {
        key;
        parse;
        unparse;
        isEqual;
        defaultValue;
        constructor(t9, e5) {
          this.key = t9, this.parse = e5.parse.bind(e5), this.unparse = (e5.unparse || gt).bind(e5), this.isEqual = (e5.isEqual || Object.is).bind(e5), this.defaultValue = this.parse(void 0);
        }
      };
      ut = class _ut {
        node;
        knownState;
        unknownState;
        sharedNodeState;
        size;
        constructor(t9, e5, n11 = void 0, r9 = /* @__PURE__ */ new Map(), i13 = void 0) {
          this.node = t9, this.sharedNodeState = e5, this.unknownState = n11, this.knownState = r9;
          const { sharedConfigMap: o8 } = this.sharedNodeState, s7 = void 0 !== i13 ? i13 : (function(t10, e6, n12) {
            let r10 = n12.size;
            if (e6) for (const i14 in e6) {
              const e7 = t10.get(i14);
              e7 && n12.has(e7) || r10++;
            }
            return r10;
          })(o8, n11, r9);
          this.size = s7;
        }
        getValue(t9) {
          const e5 = this.knownState.get(t9);
          if (void 0 !== e5) return e5;
          this.sharedNodeState.sharedConfigMap.set(t9.key, t9);
          let n11 = t9.defaultValue;
          if (this.unknownState && t9.key in this.unknownState) {
            const e6 = this.unknownState[t9.key];
            void 0 !== e6 && (n11 = t9.parse(e6)), this.updateFromKnown(t9, n11);
          }
          return n11;
        }
        getInternalState() {
          return [this.unknownState, this.knownState];
        }
        toJSON() {
          const t9 = { ...this.unknownState }, e5 = {};
          for (const [e6, n11] of this.knownState) e6.isEqual(n11, e6.defaultValue) ? delete t9[e6.key] : t9[e6.key] = e6.unparse(n11);
          for (const n11 of this.sharedNodeState.flatKeys) n11 in t9 && (e5[n11] = t9[n11], delete t9[n11]);
          return ht(t9) && (e5.$ = t9), e5;
        }
        getWritable(t9) {
          if (this.node === t9) return this;
          const { sharedNodeState: e5, unknownState: n11 } = this, r9 = new Map(this.knownState);
          return new _ut(t9, e5, (function(t10, e6, n12) {
            let r10;
            if (n12) for (const [i13, o8] of Object.entries(n12)) {
              const n13 = t10.get(i13);
              n13 ? e6.has(n13) || e6.set(n13, n13.parse(o8)) : (r10 = r10 || {}, r10[i13] = o8);
            }
            return r10;
          })(e5.sharedConfigMap, r9, n11), r9, this.size);
        }
        updateFromKnown(t9, e5) {
          const n11 = t9.key;
          this.sharedNodeState.sharedConfigMap.set(n11, t9);
          const { knownState: r9, unknownState: i13 } = this;
          r9.has(t9) || i13 && n11 in i13 || (i13 && (delete i13[n11], this.unknownState = ht(i13)), this.size++), r9.set(t9, e5);
        }
        updateFromUnknown(t9, e5) {
          const n11 = this.sharedNodeState.sharedConfigMap.get(t9);
          n11 ? this.updateFromKnown(n11, n11.parse(e5)) : (this.unknownState = this.unknownState || {}, t9 in this.unknownState || this.size++, this.unknownState[t9] = e5);
        }
        updateFromJSON(t9) {
          const { knownState: e5 } = this;
          for (const t10 of e5.keys()) e5.set(t10, t10.defaultValue);
          if (this.size = e5.size, this.unknownState = void 0, t9) for (const [e6, n11] of Object.entries(t9)) this.updateFromUnknown(e6, n11);
        }
      };
      Dt = "";
      Ft = null;
      Lt = null;
      It = "";
      Kt = false;
      zt = false;
      Jt = "40px";
      ie = re("SELECTION_CHANGE_COMMAND");
      oe = re("SELECTION_INSERT_CLIPBOARD_NODES_COMMAND");
      se = re("CLICK_COMMAND");
      le = re("BEFORE_INPUT_COMMAND");
      ce = re("INPUT_COMMAND");
      ae = re("COMPOSITION_START_COMMAND");
      ue = re("COMPOSITION_END_COMMAND");
      fe = re("DELETE_CHARACTER_COMMAND");
      de = re("INSERT_LINE_BREAK_COMMAND");
      he = re("INSERT_PARAGRAPH_COMMAND");
      ge = re("CONTROLLED_TEXT_INSERTION_COMMAND");
      _e = re("PASTE_COMMAND");
      pe = re("REMOVE_TEXT_COMMAND");
      ye = re("DELETE_WORD_COMMAND");
      me = re("DELETE_LINE_COMMAND");
      xe = re("FORMAT_TEXT_COMMAND");
      Ce = re("UNDO_COMMAND");
      Se = re("REDO_COMMAND");
      ve = re("KEYDOWN_COMMAND");
      ke = re("KEY_ARROW_RIGHT_COMMAND");
      Te = re("MOVE_TO_END");
      Ne = re("KEY_ARROW_LEFT_COMMAND");
      be = re("MOVE_TO_START");
      we = re("KEY_ARROW_UP_COMMAND");
      Ee = re("KEY_ARROW_DOWN_COMMAND");
      Oe = re("KEY_ENTER_COMMAND");
      Me = re("KEY_SPACE_COMMAND");
      Ae = re("KEY_BACKSPACE_COMMAND");
      Pe = re("KEY_ESCAPE_COMMAND");
      De = re("KEY_DELETE_COMMAND");
      Fe = re("KEY_TAB_COMMAND");
      Le = re("INSERT_TAB_COMMAND");
      Ie = re("INDENT_CONTENT_COMMAND");
      Ke = re("OUTDENT_CONTENT_COMMAND");
      ze = re("DROP_COMMAND");
      Re = re("FORMAT_ELEMENT_COMMAND");
      Be = re("DRAGSTART_COMMAND");
      We = re("DRAGOVER_COMMAND");
      Je = re("DRAGEND_COMMAND");
      je = re("COPY_COMMAND");
      $e = re("CUT_COMMAND");
      Ue = re("SELECT_ALL_COMMAND");
      Ve = re("CLEAR_EDITOR_COMMAND");
      Ye = re("CLEAR_HISTORY_COMMAND");
      qe = re("CAN_REDO_COMMAND");
      He = re("CAN_UNDO_COMMAND");
      Ge = re("FOCUS_COMMAND");
      Xe = re("BLUR_COMMAND");
      Qe = re("KEY_MODIFIER_COMMAND");
      Ze = Object.freeze({});
      tn = [["keydown", function(t9, e5) {
        if (en = t9.timeStamp, nn = t9.key, e5.isComposing()) return;
        os(e5, ve, t9);
      }], ["pointerdown", function(t9, e5) {
        const n11 = t9.target, r9 = t9.pointerType;
        Ms(n11) && "touch" !== r9 && "pen" !== r9 && 0 === t9.button && bi(e5, () => {
          co(n11) || (an = true);
        });
      }], ["compositionstart", function(t9, e5) {
        os(e5, ae, t9);
      }], ["compositionend", function(t9, e5) {
        o2 ? fn = true : c || !l && !d ? os(e5, ue, t9) : (dn = true, hn = t9.data);
      }], ["input", function(t9, e5) {
        t9.stopPropagation(), bi(e5, () => {
          e5.dispatchCommand(ce, t9);
        }, { event: t9 }), on = null;
      }], ["click", function(t9, e5) {
        bi(e5, () => {
          const n11 = $r(), r9 = Ns(_s(e5)), i13 = Ur();
          if (r9) {
            if (br(n11)) {
              const e6 = n11.anchor, o8 = e6.getNode();
              if ("element" === e6.type && 0 === e6.offset && n11.isCollapsed() && !Li(o8) && 1 === Fo().getChildrenSize() && o8.getTopLevelElementOrThrow().isEmpty() && null !== i13 && n11.is(i13)) r9.removeAllRanges(), n11.dirty = true;
              else if (3 === t9.detail && !n11.isCollapsed()) {
                if (o8 !== n11.focus.getNode()) {
                  const t10 = Ys(o8, (t11) => Mi(t11) && !t11.isInline());
                  Mi(t10) && t10.select(0);
                }
              }
            } else if ("touch" === t9.pointerType || "pen" === t9.pointerType) {
              const n12 = r9.anchorNode;
              if (Os(n12) || mo(n12)) {
                Io(jr(i13, r9, e5, t9));
              }
            }
          }
          os(e5, se, t9);
        });
      }], ["cut", Ze], ["copy", Ze], ["dragstart", Ze], ["dragover", Ze], ["dragend", Ze], ["paste", Ze], ["focus", Ze], ["blur", Ze], ["drop", Ze]];
      s && tn.push(["beforeinput", (t9, e5) => (function(t10, e6) {
        const n11 = t10.inputType;
        if ("deleteCompositionText" === n11 || o2 && is(e6)) return;
        if ("insertCompositionText" === n11) return;
        os(e6, le, t10);
      })(t9, e5)]);
      en = 0;
      nn = null;
      rn = 0;
      on = null;
      sn = /* @__PURE__ */ new WeakMap();
      ln = /* @__PURE__ */ new WeakMap();
      cn = false;
      an = false;
      un = false;
      fn = false;
      dn = false;
      hn = "";
      gn = null;
      _n = [0, "", 0, "root", 0];
      On = /* @__PURE__ */ new Map();
      Dn = () => {
      };
      Kn = /* @__PURE__ */ Symbol.for("ephemeral");
      Rn = class {
        __type;
        __key;
        __parent;
        __prev;
        __next;
        __state;
        static getType() {
          const { ownNodeType: e5 } = Us(this);
          return void 0 === e5 && t2(64, this.name), e5;
        }
        static clone(e5) {
          t2(65, this.name);
        }
        $config() {
          return {};
        }
        config(t9, e5) {
          const n11 = e5.extends || Object.getPrototypeOf(this.constructor);
          return Object.assign(e5, { extends: n11, type: t9 }), { [t9]: e5 };
        }
        afterCloneFrom(t9) {
          this.__key === t9.__key ? (this.__parent = t9.__parent, this.__next = t9.__next, this.__prev = t9.__prev, this.__state = t9.__state) : t9.__state && (this.__state = t9.__state.getWritable(this));
        }
        static importDOM;
        constructor(t9) {
          this.__type = this.constructor.getType(), this.__parent = null, this.__prev = null, this.__next = null, Object.defineProperty(this, "__state", { configurable: true, enumerable: false, value: void 0, writable: true }), ko(this, t9);
        }
        getType() {
          return this.__type;
        }
        isInline() {
          t2(137, this.constructor.name);
        }
        isAttached() {
          let t9 = this.__key;
          for (; null !== t9; ) {
            if ("root" === t9) return true;
            const e5 = Eo(t9);
            if (null === e5) break;
            t9 = e5.__parent;
          }
          return false;
        }
        isSelected(t9) {
          const e5 = t9 || $r();
          if (null == e5) return false;
          const n11 = e5.getNodes().some((t10) => t10.__key === this.__key);
          if (pr(this)) return n11;
          if (br(e5) && "element" === e5.anchor.type && "element" === e5.focus.type) {
            if (e5.isCollapsed()) return false;
            const t10 = this.getParent();
            if (Di(this) && this.isInline() && t10) {
              const n12 = e5.isBackward() ? e5.focus : e5.anchor;
              if (t10.is(n12.getNode()) && n12.offset === t10.getChildrenSize() && this.is(t10.getLastChild())) return false;
            }
          }
          return n11;
        }
        getKey() {
          return this.__key;
        }
        getIndexWithinParent() {
          const t9 = this.getParent();
          if (null === t9) return -1;
          let e5 = t9.getFirstChild(), n11 = 0;
          for (; null !== e5; ) {
            if (this.is(e5)) return n11;
            n11++, e5 = e5.getNextSibling();
          }
          return -1;
        }
        getParent() {
          const t9 = this.getLatest().__parent;
          return null === t9 ? null : Eo(t9);
        }
        getParentOrThrow() {
          const e5 = this.getParent();
          return null === e5 && t2(66, this.__key), e5;
        }
        getTopLevelElement() {
          let e5 = this;
          for (; null !== e5; ) {
            const n11 = e5.getParent();
            if (ms(n11)) return Mi(e5) || e5 === this && Di(e5) || t2(194), e5;
            e5 = n11;
          }
          return null;
        }
        getTopLevelElementOrThrow() {
          const e5 = this.getTopLevelElement();
          return null === e5 && t2(67, this.__key), e5;
        }
        getParents() {
          const t9 = [];
          let e5 = this.getParent();
          for (; null !== e5; ) t9.push(e5), e5 = e5.getParent();
          return t9;
        }
        getParentKeys() {
          const t9 = [];
          let e5 = this.getParent();
          for (; null !== e5; ) t9.push(e5.__key), e5 = e5.getParent();
          return t9;
        }
        getPreviousSibling() {
          const t9 = this.getLatest().__prev;
          return null === t9 ? null : Eo(t9);
        }
        getPreviousSiblings() {
          const t9 = [], e5 = this.getParent();
          if (null === e5) return t9;
          let n11 = e5.getFirstChild();
          for (; null !== n11 && !n11.is(this); ) t9.push(n11), n11 = n11.getNextSibling();
          return t9;
        }
        getNextSibling() {
          const t9 = this.getLatest().__next;
          return null === t9 ? null : Eo(t9);
        }
        getNextSiblings() {
          const t9 = [];
          let e5 = this.getNextSibling();
          for (; null !== e5; ) t9.push(e5), e5 = e5.getNextSibling();
          return t9;
        }
        getCommonAncestor(t9) {
          const e5 = Mi(this) ? this : this.getParent(), n11 = Mi(t9) ? t9 : t9.getParent(), r9 = e5 && n11 ? wl(e5, n11) : null;
          return r9 ? r9.commonAncestor : null;
        }
        is(t9) {
          return null != t9 && this.__key === t9.__key;
        }
        isBefore(e5) {
          const n11 = wl(this, e5);
          return null !== n11 && ("descendant" === n11.type || ("branch" === n11.type ? -1 === Tl(n11) : ("same" !== n11.type && "ancestor" !== n11.type && t2(279), false)));
        }
        isParentOf(t9) {
          const e5 = wl(this, t9);
          return null !== e5 && "ancestor" === e5.type;
        }
        getNodesBetween(e5) {
          const n11 = this.isBefore(e5), r9 = [], i13 = /* @__PURE__ */ new Set();
          let o8 = this;
          for (; null !== o8; ) {
            const s7 = o8.__key;
            if (i13.has(s7) || (i13.add(s7), r9.push(o8)), o8 === e5) break;
            const l8 = Mi(o8) ? n11 ? o8.getFirstChild() : o8.getLastChild() : null;
            if (null !== l8) {
              o8 = l8;
              continue;
            }
            const c10 = n11 ? o8.getNextSibling() : o8.getPreviousSibling();
            if (null !== c10) {
              o8 = c10;
              continue;
            }
            const a10 = o8.getParentOrThrow();
            if (i13.has(a10.__key) || r9.push(a10), a10 === e5) break;
            let u10 = null, f8 = a10;
            do {
              if (null === f8 && t2(68), u10 = n11 ? f8.getNextSibling() : f8.getPreviousSibling(), f8 = f8.getParent(), null === f8) break;
              null !== u10 || i13.has(f8.__key) || r9.push(f8);
            } while (null === u10);
            o8 = u10;
          }
          return n11 || r9.reverse(), r9;
        }
        isDirty() {
          const t9 = hi()._dirtyLeaves;
          return null !== t9 && t9.has(this.__key);
        }
        getLatest() {
          if (zn(this)) return this;
          const e5 = Eo(this.__key);
          return null === e5 && t2(113), e5;
        }
        getWritable() {
          if (zn(this)) return this;
          ui();
          const t9 = di(), e5 = hi(), n11 = t9._nodeMap, r9 = this.__key, i13 = this.getLatest(), o8 = e5._cloneNotNeeded, s7 = $r();
          if (null !== s7 && s7.setCachedNodes(null), o8.has(r9)) return No(i13), i13;
          const l8 = Rs(i13);
          return o8.add(r9), No(l8), n11.set(r9, l8), l8;
        }
        getTextContent() {
          return "";
        }
        getTextContentSize() {
          return this.getTextContent().length;
        }
        createDOM(e5, n11) {
          t2(70);
        }
        updateDOM(e5, n11, r9) {
          t2(71);
        }
        exportDOM(t9) {
          return { element: this.createDOM(t9._config, t9) };
        }
        exportJSON() {
          const t9 = this.__state ? this.__state.toJSON() : void 0;
          return { type: this.__type, version: 1, ...t9 };
        }
        static importJSON(e5) {
          t2(18, this.name);
        }
        updateFromJSON(t9) {
          return (function(t10, e5) {
            const n11 = t10.getWritable(), r9 = e5.$;
            let i13 = r9;
            for (const t11 of dt(n11).flatKeys) t11 in e5 && (void 0 !== i13 && i13 !== r9 || (i13 = { ...r9 }), i13[t11] = e5[t11]);
            return (n11.__state || i13) && ft(t10).updateFromJSON(i13), n11;
          })(this, t9);
        }
        static transform() {
          return null;
        }
        remove(t9) {
          Ln(this, true, t9);
        }
        replace(e5, n11) {
          ui();
          let r9 = $r();
          null !== r9 && (r9 = r9.clone()), Ss(this, e5);
          const i13 = this.getLatest(), o8 = this.__key, s7 = e5.__key, l8 = e5.getWritable(), c10 = this.getParentOrThrow().getWritable(), a10 = c10.__size;
          To(l8);
          const u10 = i13.getPreviousSibling(), f8 = i13.getNextSibling(), d8 = i13.__prev, h3 = i13.__next, g5 = i13.__parent;
          if (Ln(i13, false, true), null === u10) c10.__first = s7;
          else {
            u10.getWritable().__next = s7;
          }
          if (l8.__prev = d8, null === f8) c10.__last = s7;
          else {
            f8.getWritable().__prev = s7;
          }
          if (l8.__next = h3, l8.__parent = g5, c10.__size = a10, n11 && (Mi(this) && Mi(l8) || t2(139), this.getChildren().forEach((t9) => {
            l8.append(t9);
          })), br(r9)) {
            Io(r9);
            const t9 = r9.anchor, e6 = r9.focus;
            t9.key === o8 && Tr(t9, l8), e6.key === o8 && Tr(e6, l8);
          }
          return wo() === o8 && bo(s7), l8;
        }
        insertAfter(t9, e5 = true) {
          ui(), Ss(this, t9);
          const n11 = this.getWritable(), r9 = t9.getWritable(), i13 = r9.getParent(), o8 = $r();
          let s7 = false, l8 = false;
          if (null !== i13) {
            const e6 = t9.getIndexWithinParent();
            if (To(r9), br(o8)) {
              const t10 = i13.__key, n12 = o8.anchor, r10 = o8.focus;
              s7 = "element" === n12.type && n12.key === t10 && n12.offset === e6 + 1, l8 = "element" === r10.type && r10.key === t10 && r10.offset === e6 + 1;
            }
          }
          const c10 = this.getNextSibling(), a10 = this.getParentOrThrow().getWritable(), u10 = r9.__key, f8 = n11.__next;
          if (null === c10) a10.__last = u10;
          else {
            c10.getWritable().__prev = u10;
          }
          if (a10.__size++, n11.__next = u10, r9.__next = f8, r9.__prev = n11.__key, r9.__parent = n11.__parent, e5 && br(o8)) {
            const t10 = this.getIndexWithinParent();
            Vr(o8, a10, t10 + 1);
            const e6 = a10.__key;
            s7 && o8.anchor.set(e6, t10 + 2, "element"), l8 && o8.focus.set(e6, t10 + 2, "element");
          }
          return t9;
        }
        insertBefore(t9, e5 = true) {
          ui(), Ss(this, t9);
          const n11 = this.getWritable(), r9 = t9.getWritable(), i13 = r9.__key;
          To(r9);
          const o8 = this.getPreviousSibling(), s7 = this.getParentOrThrow().getWritable(), l8 = n11.__prev, c10 = this.getIndexWithinParent();
          if (null === o8) s7.__first = i13;
          else {
            o8.getWritable().__next = i13;
          }
          s7.__size++, n11.__prev = i13, r9.__prev = l8, r9.__next = n11.__key, r9.__parent = n11.__parent;
          const a10 = $r();
          if (e5 && br(a10)) {
            Vr(a10, this.getParentOrThrow(), c10);
          }
          return t9;
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
        selectPrevious(t9, e5) {
          ui();
          const n11 = this.getPreviousSibling(), r9 = this.getParentOrThrow();
          if (null === n11) return r9.select(0, 0);
          if (Mi(n11)) return n11.select();
          if (!pr(n11)) {
            const t10 = n11.getIndexWithinParent() + 1;
            return r9.select(t10, t10);
          }
          return n11.select(t9, e5);
        }
        selectNext(t9, e5) {
          ui();
          const n11 = this.getNextSibling(), r9 = this.getParentOrThrow();
          if (null === n11) return r9.select();
          if (Mi(n11)) return n11.select(0, 0);
          if (!pr(n11)) {
            const t10 = n11.getIndexWithinParent();
            return r9.select(t10, t10);
          }
          return n11.select(t9, e5);
        }
        markDirty() {
          this.getWritable();
        }
        reconcileObservedMutation(t9, e5) {
          this.markDirty();
        }
      };
      Bn = "historic";
      Wn = "history-push";
      Jn = "history-merge";
      jn = "paste";
      $n = "collaboration";
      Un = "skip-collab";
      Vn = "skip-scroll-into-view";
      Yn = "skip-dom-selection";
      qn = "skip-selection-focus";
      Hn = class _Hn extends Rn {
        static getType() {
          return "linebreak";
        }
        static clone(t9) {
          return new _Hn(t9.__key);
        }
        constructor(t9) {
          super(t9);
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
          return { br: (t9) => (function(t10) {
            const e5 = t10.parentElement;
            if (null !== e5 && Ds(e5)) {
              const n11 = e5.firstChild;
              if (n11 === t10 || n11.nextSibling === t10 && Zn(n11)) {
                const n12 = e5.lastChild;
                if (n12 === t10 || n12.previousSibling === t10 && Zn(n12)) return true;
              }
            }
            return false;
          })(t9) || (function(t10) {
            const e5 = t10.parentElement;
            if (null !== e5 && Ds(e5)) {
              const n11 = e5.firstChild;
              if (n11 === t10 || n11.nextSibling === t10 && Zn(n11)) return false;
              const r9 = e5.lastChild;
              if (r9 === t10 || r9.previousSibling === t10 && Zn(r9)) return true;
            }
            return false;
          })(t9) ? null : { conversion: Gn, priority: 0 } };
        }
        static importJSON(t9) {
          return Xn().updateFromJSON(t9);
        }
      };
      sr = class _sr extends Rn {
        __text;
        __format;
        __style;
        __mode;
        __detail;
        static getType() {
          return "text";
        }
        static clone(t9) {
          return new _sr(t9.__text, t9.__key);
        }
        afterCloneFrom(t9) {
          super.afterCloneFrom(t9), this.__text = t9.__text, this.__format = t9.__format, this.__style = t9.__style, this.__mode = t9.__mode, this.__detail = t9.__detail;
        }
        constructor(t9 = "", e5) {
          super(e5), this.__text = t9, this.__format = 0, this.__style = "", this.__mode = 0, this.__detail = 0;
        }
        getFormat() {
          return this.getLatest().__format;
        }
        getDetail() {
          return this.getLatest().__detail;
        }
        getMode() {
          const t9 = this.getLatest();
          return $[t9.__mode];
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
        hasFormat(t9) {
          const e5 = R[t9];
          return 0 !== (this.getFormat() & e5);
        }
        isSimpleText() {
          return "text" === this.__type && 0 === this.__mode;
        }
        getTextContent() {
          return this.getLatest().__text;
        }
        getFormatFlags(t9, e5) {
          return So(this.getLatest().__format, t9, e5);
        }
        canHaveFormat() {
          return true;
        }
        isInline() {
          return true;
        }
        createDOM(t9, e5) {
          const n11 = this.__format, r9 = tr(0, n11), i13 = er(0, n11), o8 = null === r9 ? i13 : r9, s7 = document.createElement(o8);
          let l8 = s7;
          this.hasFormat("code") && s7.setAttribute("spellcheck", "false"), null !== r9 && (l8 = document.createElement(i13), s7.appendChild(l8));
          ir(l8, this, 0, n11, this.__text, t9);
          const c10 = this.__style;
          return "" !== c10 && (s7.style.cssText = c10), s7;
        }
        updateDOM(e5, n11, r9) {
          const i13 = this.__text, o8 = e5.__format, s7 = this.__format, l8 = tr(0, o8), c10 = tr(0, s7), a10 = er(0, o8), u10 = er(0, s7);
          if ((null === l8 ? a10 : l8) !== (null === c10 ? u10 : c10)) return true;
          if (l8 === c10 && a10 !== u10) {
            const e6 = n11.firstChild;
            null == e6 && t2(48);
            const o9 = document.createElement(u10);
            return ir(o9, this, 0, s7, i13, r9), n11.replaceChild(o9, e6), false;
          }
          let f8 = n11;
          null !== c10 && null !== l8 && (f8 = n11.firstChild, null == f8 && t2(49)), rr(i13, f8, this);
          const d8 = r9.theme.text;
          void 0 !== d8 && o8 !== s7 && nr(0, o8, s7, f8, d8);
          const h3 = e5.__style, g5 = this.__style;
          return h3 !== g5 && (n11.style.cssText = g5), false;
        }
        static importDOM() {
          return { "#text": () => ({ conversion: fr, priority: 0 }), b: () => ({ conversion: cr, priority: 0 }), code: () => ({ conversion: gr, priority: 0 }), em: () => ({ conversion: gr, priority: 0 }), i: () => ({ conversion: gr, priority: 0 }), mark: () => ({ conversion: gr, priority: 0 }), s: () => ({ conversion: gr, priority: 0 }), span: () => ({ conversion: lr, priority: 0 }), strong: () => ({ conversion: gr, priority: 0 }), sub: () => ({ conversion: gr, priority: 0 }), sup: () => ({ conversion: gr, priority: 0 }), u: () => ({ conversion: gr, priority: 0 }) };
        }
        static importJSON(t9) {
          return _r().updateFromJSON(t9);
        }
        updateFromJSON(t9) {
          return super.updateFromJSON(t9).setTextContent(t9.text).setFormat(t9.format).setDetail(t9.detail).setMode(t9.mode).setStyle(t9.style);
        }
        exportDOM(e5) {
          let { element: n11 } = super.exportDOM(e5);
          return Os(n11) || t2(132), n11.style.whiteSpace = "pre-wrap", this.hasFormat("lowercase") ? n11.style.textTransform = "lowercase" : this.hasFormat("uppercase") ? n11.style.textTransform = "uppercase" : this.hasFormat("capitalize") && (n11.style.textTransform = "capitalize"), this.hasFormat("bold") && (n11 = or(n11, "b")), this.hasFormat("italic") && (n11 = or(n11, "i")), this.hasFormat("strikethrough") && (n11 = or(n11, "s")), this.hasFormat("underline") && (n11 = or(n11, "u")), { element: n11 };
        }
        exportJSON() {
          return { detail: this.getDetail(), format: this.getFormat(), mode: this.getMode(), style: this.getStyle(), text: this.getTextContent(), ...super.exportJSON() };
        }
        selectionTransform(t9, e5) {
        }
        setFormat(t9) {
          const e5 = this.getWritable();
          return e5.__format = "string" == typeof t9 ? R[t9] : t9, e5;
        }
        setDetail(t9) {
          const e5 = this.getWritable();
          return e5.__detail = "string" == typeof t9 ? B[t9] : t9, e5;
        }
        setStyle(t9) {
          const e5 = this.getWritable();
          return e5.__style = t9, e5;
        }
        toggleFormat(t9) {
          const e5 = So(this.getFormat(), t9, null);
          return this.setFormat(e5);
        }
        toggleDirectionless() {
          const t9 = this.getWritable();
          return t9.__detail ^= 1, t9;
        }
        toggleUnmergeable() {
          const t9 = this.getWritable();
          return t9.__detail ^= 2, t9;
        }
        setMode(t9) {
          const e5 = j[t9];
          if (this.__mode === e5) return this;
          const n11 = this.getWritable();
          return n11.__mode = e5, n11;
        }
        setTextContent(t9) {
          if (this.__text === t9) return this;
          const e5 = this.getWritable();
          return e5.__text = t9, e5;
        }
        select(t9, e5) {
          ui();
          let n11 = t9, r9 = e5;
          const i13 = $r(), o8 = this.getTextContent(), s7 = this.__key;
          if ("string" == typeof o8) {
            const t10 = o8.length;
            void 0 === n11 && (n11 = t10), void 0 === r9 && (r9 = t10);
          } else n11 = 0, r9 = 0;
          if (!br(i13)) return Rr(s7, n11, s7, r9, "text", "text");
          {
            const t10 = wo();
            t10 !== i13.anchor.key && t10 !== i13.focus.key || bo(s7), i13.setTextNodeRange(this, n11, this, r9);
          }
          return i13;
        }
        selectStart() {
          return this.select(0, 0);
        }
        selectEnd() {
          const t9 = this.getTextContentSize();
          return this.select(t9, t9);
        }
        spliceText(t9, e5, n11, r9) {
          const i13 = this.getWritable(), o8 = i13.__text, s7 = n11.length;
          let l8 = t9;
          l8 < 0 && (l8 = s7 + l8, l8 < 0 && (l8 = 0));
          const c10 = $r();
          if (r9 && br(c10)) {
            const e6 = t9 + s7;
            c10.setTextNodeRange(i13, e6, i13, e6);
          }
          const a10 = o8.slice(0, l8) + n11 + o8.slice(l8 + e5);
          return i13.__text = a10, i13;
        }
        canInsertTextBefore() {
          return true;
        }
        canInsertTextAfter() {
          return true;
        }
        splitText(...t9) {
          ui();
          const e5 = this.getLatest(), n11 = e5.getTextContent();
          if ("" === n11) return [];
          const r9 = e5.__key, i13 = wo(), o8 = n11.length;
          t9.sort((t10, e6) => t10 - e6), t9.push(o8);
          const s7 = [], l8 = t9.length;
          for (let e6 = 0, r10 = 0; e6 < o8 && r10 <= l8; r10++) {
            const i14 = t9[r10];
            i14 > e6 && (s7.push(n11.slice(e6, i14)), e6 = i14);
          }
          const c10 = s7.length;
          if (1 === c10) return [e5];
          const a10 = s7[0], u10 = e5.getParent();
          let f8;
          const d8 = e5.getFormat(), h3 = e5.getStyle(), g5 = e5.__detail;
          let _5 = false, p7 = null, y6 = null;
          const m9 = $r();
          if (br(m9)) {
            const [t10, e6] = m9.isBackward() ? [m9.focus, m9.anchor] : [m9.anchor, m9.focus];
            "text" === t10.type && t10.key === r9 && (p7 = t10), "text" === e6.type && e6.key === r9 && (y6 = e6);
          }
          e5.isSegmented() ? (f8 = _r(a10), f8.__format = d8, f8.__style = h3, f8.__detail = g5, f8.__state = yt(e5, f8), _5 = true) : f8 = e5.setTextContent(a10);
          const x7 = [f8];
          for (let t10 = 1; t10 < c10; t10++) {
            const n12 = _r(s7[t10]);
            n12.__format = d8, n12.__style = h3, n12.__detail = g5, n12.__state = yt(e5, n12);
            const o9 = n12.__key;
            i13 === r9 && bo(o9), x7.push(n12);
          }
          const C5 = p7 ? p7.offset : null, S3 = y6 ? y6.offset : null;
          let v6 = 0;
          for (const t10 of x7) {
            if (!p7 && !y6) break;
            const e6 = v6 + t10.getTextContentSize();
            if (null !== p7 && null !== C5 && C5 <= e6 && C5 >= v6 && (p7.set(t10.getKey(), C5 - v6, "text"), C5 < e6 && (p7 = null)), null !== y6 && null !== S3 && S3 <= e6 && S3 >= v6) {
              y6.set(t10.getKey(), S3 - v6, "text");
              break;
            }
            v6 = e6;
          }
          if (null !== u10) {
            !(function(t11) {
              const e7 = t11.getPreviousSibling(), n12 = t11.getNextSibling();
              null !== e7 && No(e7);
              null !== n12 && No(n12);
            })(this);
            const t10 = u10.getWritable(), e6 = this.getIndexWithinParent();
            _5 ? (t10.splice(e6, 0, x7), this.remove()) : t10.splice(e6, 1, x7), br(m9) && Vr(m9, u10, e6, c10 - 1);
          }
          return x7;
        }
        mergeWithSibling(e5) {
          const n11 = e5 === this.getPreviousSibling();
          n11 || e5 === this.getNextSibling() || t2(50);
          const r9 = this.__key, i13 = e5.__key, o8 = this.__text, s7 = o8.length;
          wo() === i13 && bo(r9);
          const l8 = $r();
          if (br(l8)) {
            const t9 = l8.anchor, o9 = l8.focus;
            null !== t9 && t9.key === i13 && Hr(t9, n11, r9, e5, s7), null !== o9 && o9.key === i13 && Hr(o9, n11, r9, e5, s7);
          }
          const c10 = e5.__text, a10 = n11 ? c10 + o8 : o8 + c10;
          this.setTextContent(a10);
          const u10 = this.getWritable();
          return e5.remove(), u10;
        }
        isTextEntity() {
          return false;
        }
      };
      ar = /* @__PURE__ */ new WeakMap();
      hr = { code: "code", em: "italic", i: "italic", mark: "highlight", s: "strikethrough", strong: "bold", sub: "subscript", sup: "superscript", u: "underline" };
      mr = class _mr extends sr {
        static getType() {
          return "tab";
        }
        static clone(t9) {
          return new _mr(t9.__key);
        }
        constructor(t9) {
          super("	", t9), this.__detail = 2;
        }
        static importDOM() {
          return null;
        }
        createDOM(t9) {
          const e5 = super.createDOM(t9), n11 = Zo(t9.theme, "tab");
          if (void 0 !== n11) {
            e5.classList.add(...n11);
          }
          return e5;
        }
        static importJSON(t9) {
          return xr().updateFromJSON(t9);
        }
        setTextContent(t9) {
          return "	" !== t9 && "" !== t9 && e2(126), super.setTextContent("	");
        }
        spliceText(e5, n11, r9, i13) {
          return "" === r9 && 0 === n11 || "	" === r9 && 1 === n11 || t2(286), this;
        }
        setDetail(e5) {
          return 2 !== e5 && t2(127), this;
        }
        setMode(e5) {
          return "normal" !== e5 && t2(128), this;
        }
        canInsertTextBefore() {
          return false;
        }
        canInsertTextAfter() {
          return false;
        }
      };
      Sr = class {
        key;
        offset;
        type;
        _selection;
        constructor(t9, e5, n11) {
          this._selection = null, this.key = t9, this.offset = e5, this.type = n11;
        }
        is(t9) {
          return this.key === t9.key && this.offset === t9.offset && this.type === t9.type;
        }
        isBefore(t9) {
          if (this.key === t9.key) return this.offset < t9.offset;
          return kl(Kl(El(this, "next")), Kl(El(t9, "next"))) < 0;
        }
        getNode() {
          const e5 = Eo(this.key);
          return null === e5 && t2(20), e5;
        }
        set(t9, e5, n11, r9) {
          const i13 = this._selection, o8 = this.key;
          r9 && this.key === t9 && this.offset === e5 && this.type === n11 || (this.key = t9, this.offset = e5, this.type = n11, ai() || (wo() === o8 && bo(t9), null !== i13 && (i13.setCachedNodes(null), i13.dirty = true)));
        }
      };
      Nr = class _Nr {
        _nodes;
        _cachedNodes;
        dirty;
        constructor(t9) {
          this._cachedNodes = null, this._nodes = t9, this.dirty = false;
        }
        getCachedNodes() {
          return this._cachedNodes;
        }
        setCachedNodes(t9) {
          this._cachedNodes = t9;
        }
        is(t9) {
          if (!Er(t9)) return false;
          const e5 = this._nodes, n11 = t9._nodes;
          return e5.size === n11.size && Array.from(e5).every((t10) => n11.has(t10));
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
        add(t9) {
          this.dirty = true, this._nodes.add(t9), this._cachedNodes = null;
        }
        delete(t9) {
          this.dirty = true, this._nodes.delete(t9), this._cachedNodes = null;
        }
        clear() {
          this.dirty = true, this._nodes.clear(), this._cachedNodes = null;
        }
        has(t9) {
          return this._nodes.has(t9);
        }
        clone() {
          return new _Nr(new Set(this._nodes));
        }
        extract() {
          return this.getNodes();
        }
        insertRawText(t9) {
        }
        insertText() {
        }
        insertNodes(t9) {
          const e5 = this.getNodes(), n11 = e5.length, r9 = e5[n11 - 1];
          let i13;
          if (pr(r9)) i13 = r9.select();
          else {
            const t10 = r9.getIndexWithinParent() + 1;
            i13 = r9.getParentOrThrow().select(t10, t10);
          }
          i13.insertNodes(t9);
          for (let t10 = 0; t10 < n11; t10++) e5[t10].remove();
        }
        getNodes() {
          const t9 = this._cachedNodes;
          if (null !== t9) return t9;
          const e5 = this._nodes, n11 = [];
          for (const t10 of e5) {
            const e6 = Eo(t10);
            null !== e6 && n11.push(e6);
          }
          return ai() || (this._cachedNodes = n11), n11;
        }
        getTextContent() {
          const t9 = this.getNodes();
          let e5 = "";
          for (let n11 = 0; n11 < t9.length; n11++) e5 += t9[n11].getTextContent();
          return e5;
        }
        deleteNodes() {
          const t9 = this.getNodes();
          if (($r() || Ur()) === this && t9[0]) {
            const e5 = al(t9[0], "next");
            Ml(Sl(e5, e5));
          }
          for (const e5 of t9) e5.remove();
        }
      };
      wr = class _wr {
        format;
        style;
        anchor;
        focus;
        _cachedNodes;
        dirty;
        constructor(t9, e5, n11, r9) {
          this.anchor = t9, this.focus = e5, t9._selection = this, e5._selection = this, this._cachedNodes = null, this.format = n11, this.style = r9, this.dirty = false;
        }
        getCachedNodes() {
          return this._cachedNodes;
        }
        setCachedNodes(t9) {
          this._cachedNodes = t9;
        }
        is(t9) {
          return !!br(t9) && (this.anchor.is(t9.anchor) && this.focus.is(t9.focus) && this.format === t9.format && this.style === t9.style);
        }
        isCollapsed() {
          return this.anchor.is(this.focus);
        }
        getNodes() {
          const t9 = this._cachedNodes;
          if (null !== t9) return t9;
          const e5 = (function(t10) {
            const e6 = [], [n11, r9] = t10.getTextSlices();
            n11 && e6.push(n11.caret.origin);
            const i13 = /* @__PURE__ */ new Set(), o8 = /* @__PURE__ */ new Set();
            for (const n12 of t10) if (ol(n12)) {
              const { origin: t11 } = n12;
              0 === e6.length ? i13.add(t11) : (o8.add(t11), e6.push(t11));
            } else {
              const { origin: t11 } = n12;
              Mi(t11) && o8.has(t11) || e6.push(t11);
            }
            r9 && e6.push(r9.caret.origin);
            if (il(t10.focus) && Mi(t10.focus.origin) && null === t10.focus.getNodeAtCaret()) for (let n12 = hl(t10.focus.origin, "previous"); ol(n12) && i13.has(n12.origin) && !n12.origin.isEmpty() && n12.origin.is(e6[e6.length - 1]); n12 = _l(n12)) i13.delete(n12.origin), e6.pop();
            for (; e6.length > 1; ) {
              const t11 = e6[e6.length - 1];
              if (!Mi(t11) || o8.has(t11) || t11.isEmpty() || i13.has(t11)) break;
              e6.pop();
            }
            if (0 === e6.length && t10.isCollapsed()) {
              const n12 = Kl(t10.anchor), r10 = Kl(t10.anchor.getFlipped()), i14 = (t11) => nl(t11) ? t11.origin : t11.getNodeAtCaret(), o9 = i14(n12) || i14(r10) || (t10.anchor.getNodeAtCaret() ? n12.origin : r10.origin);
              e6.push(o9);
            }
            return e6;
          })(Bl(Pl(this), "next"));
          return ai() || (this._cachedNodes = e5), e5;
        }
        setTextNodeRange(t9, e5, n11, r9) {
          this.anchor.set(t9.__key, e5, "text"), this.focus.set(n11.__key, r9, "text");
        }
        getTextContent() {
          const t9 = this.getNodes();
          if (0 === t9.length) return "";
          const e5 = t9[0], n11 = t9[t9.length - 1], r9 = this.anchor, i13 = this.focus, o8 = r9.isBefore(i13), [s7, l8] = Mr(this);
          let c10 = "", a10 = true;
          for (let u10 = 0; u10 < t9.length; u10++) {
            const f8 = t9[u10];
            if (Mi(f8) && !f8.isInline()) a10 || (c10 += "\n"), a10 = !f8.isEmpty();
            else if (a10 = false, pr(f8)) {
              let t10 = f8.getTextContent();
              f8 === e5 ? f8 === n11 ? "element" === r9.type && "element" === i13.type && i13.offset !== r9.offset || (t10 = s7 < l8 ? t10.slice(s7, l8) : t10.slice(l8, s7)) : t10 = o8 ? t10.slice(s7) : t10.slice(l8) : f8 === n11 && (t10 = o8 ? t10.slice(0, l8) : t10.slice(0, s7)), c10 += t10;
            } else !Di(f8) && !Qn(f8) || f8 === n11 && this.isCollapsed() || (c10 += f8.getTextContent());
          }
          return c10;
        }
        applyDOMRange(t9) {
          const e5 = hi(), n11 = e5.getEditorState()._selection, r9 = Kr(t9.startContainer, t9.startOffset, t9.endContainer, t9.endOffset, e5, n11);
          if (null === r9) return;
          const [i13, o8] = r9;
          this.anchor.set(i13.key, i13.offset, i13.type, true), this.focus.set(o8.key, o8.offset, o8.type, true), St(this);
        }
        clone() {
          const t9 = this.anchor, e5 = this.focus;
          return new _wr(vr(t9.key, t9.offset, t9.type), vr(e5.key, e5.offset, e5.type), this.format, this.style);
        }
        toggleFormat(t9) {
          this.format = So(this.format, t9, null), this.dirty = true;
        }
        setFormat(t9) {
          this.format = t9, this.dirty = true;
        }
        setStyle(t9) {
          this.style = t9, this.dirty = true;
        }
        hasFormat(t9) {
          const e5 = R[t9];
          return 0 !== (this.format & e5);
        }
        insertRawText(t9) {
          const e5 = t9.split(/(\r?\n|\t)/), n11 = [], r9 = e5.length;
          for (let t10 = 0; t10 < r9; t10++) {
            const r10 = e5[t10];
            "\n" === r10 || "\r\n" === r10 ? n11.push(Xn()) : "	" === r10 ? n11.push(xr()) : n11.push(_r(r10));
          }
          this.insertNodes(n11);
        }
        insertText(e5) {
          const n11 = this.anchor, r9 = this.focus, i13 = this.format, o8 = this.style;
          let s7 = n11, l8 = r9;
          !this.isCollapsed() && r9.isBefore(n11) && (s7 = r9, l8 = n11), "element" === s7.type && (function(t9, e6, n12, r10) {
            const i14 = t9.getNode(), o9 = i14.getChildAtIndex(t9.offset), s8 = _r();
            if (s8.setFormat(n12), s8.setStyle(r10), Ui(o9)) o9.splice(0, 0, [s8]);
            else {
              const t10 = Li(i14) ? $i().append(s8) : s8;
              null === o9 ? i14.append(t10) : o9.insertBefore(t10);
            }
            t9.is(e6) && e6.set(s8.__key, 0, "text"), t9.set(s8.__key, 0, "text");
          })(s7, l8, i13, o8), "element" === l8.type && Ol(l8, Kl(El(l8, "next")));
          const c10 = s7.offset;
          let a10 = l8.offset;
          const u10 = this.getNodes(), f8 = u10.length;
          let d8 = u10[0];
          pr(d8) || t2(26);
          const h3 = d8.getTextContent().length, g5 = d8.getParentOrThrow();
          let _5 = u10[f8 - 1];
          if (1 === f8 && "element" === l8.type && (a10 = h3, l8.set(s7.key, a10, "text")), this.isCollapsed() && c10 === h3 && (yo(d8) || !d8.canInsertTextAfter() || !g5.canInsertTextAfter() && null === d8.getNextSibling())) {
            let t9 = d8.getNextSibling();
            if (pr(t9) && t9.canInsertTextBefore() && !yo(t9) || (t9 = _r(), t9.setFormat(i13), t9.setStyle(o8), g5.canInsertTextAfter() ? d8.insertAfter(t9) : g5.insertAfter(t9)), t9.select(0, 0), d8 = t9, "" !== e5) return void this.insertText(e5);
          } else if (this.isCollapsed() && 0 === c10 && (yo(d8) || !d8.canInsertTextBefore() || !g5.canInsertTextBefore() && null === d8.getPreviousSibling())) {
            let t9 = d8.getPreviousSibling();
            if (pr(t9) && !yo(t9) || (t9 = _r(), t9.setFormat(i13), g5.canInsertTextBefore() ? d8.insertBefore(t9) : g5.insertBefore(t9)), t9.select(), d8 = t9, "" !== e5) return void this.insertText(e5);
          } else if (d8.isSegmented() && c10 !== h3) {
            const t9 = _r(d8.getTextContent());
            t9.setFormat(i13), d8.replace(t9), d8 = t9;
          } else if (!this.isCollapsed() && "" !== e5) {
            const t9 = _5.getParent();
            if (!g5.canInsertTextBefore() || !g5.canInsertTextAfter() || Mi(t9) && (!t9.canInsertTextBefore() || !t9.canInsertTextAfter())) return this.insertText(""), Ir(this.anchor, this.focus, null), void this.insertText(e5);
          }
          if (1 === f8) {
            if (po(d8)) {
              const t10 = _r(e5);
              return t10.select(), void d8.replace(t10);
            }
            const t9 = d8.getFormat(), n12 = d8.getStyle();
            if (c10 !== a10 || t9 === i13 && n12 === o8) {
              if (Cr(d8)) {
                const t10 = _r(e5);
                return t10.setFormat(i13), t10.setStyle(o8), t10.select(), void d8.replace(t10);
              }
            } else {
              if ("" !== d8.getTextContent()) {
                const t10 = _r(e5);
                if (t10.setFormat(i13), t10.setStyle(o8), t10.select(), 0 === c10) d8.insertBefore(t10, false);
                else {
                  const [e6] = d8.splitText(c10);
                  e6.insertAfter(t10, false);
                }
                return void (t10.isComposing() && "text" === this.anchor.type && (this.anchor.offset -= e5.length));
              }
              d8.setFormat(i13), d8.setStyle(o8);
            }
            const r10 = a10 - c10;
            d8 = d8.spliceText(c10, r10, e5, true), "" === d8.getTextContent() ? d8.remove() : "text" === this.anchor.type && (d8.isComposing() ? this.anchor.offset -= e5.length : (this.format = t9, this.style = n12));
          } else {
            const t9 = /* @__PURE__ */ new Set([...d8.getParentKeys(), ..._5.getParentKeys()]), n12 = Mi(d8) ? d8 : d8.getParentOrThrow();
            let r10 = Mi(_5) ? _5 : _5.getParentOrThrow(), i14 = _5;
            if (!n12.is(r10) && r10.isInline()) do {
              i14 = r10, r10 = r10.getParentOrThrow();
            } while (r10.isInline());
            if ("text" === l8.type && (0 !== a10 || "" === _5.getTextContent()) || "element" === l8.type && _5.getIndexWithinParent() < a10) if (pr(_5) && !po(_5) && a10 !== _5.getTextContentSize()) {
              if (_5.isSegmented()) {
                const t10 = _r(_5.getTextContent());
                _5.replace(t10), _5 = t10;
              }
              Li(l8.getNode()) || "text" !== l8.type || (_5 = _5.spliceText(0, a10, "")), t9.add(_5.__key);
            } else {
              const t10 = _5.getParentOrThrow();
              t10.canBeEmpty() || 1 !== t10.getChildrenSize() ? _5.remove() : t10.remove();
            }
            else t9.add(_5.__key);
            const o9 = r10.getChildren(), s8 = new Set(u10), g6 = n12.is(r10), p7 = n12.isInline() && null === d8.getNextSibling() ? n12 : d8;
            for (let t10 = o9.length - 1; t10 >= 0; t10--) {
              const e6 = o9[t10];
              if (e6.is(d8) || Mi(e6) && e6.isParentOf(d8)) break;
              e6.isAttached() && (!s8.has(e6) || e6.is(i14) ? g6 || p7.insertAfter(e6, false) : e6.remove());
            }
            if (!g6) {
              let e6 = r10, n13 = null;
              for (; null !== e6; ) {
                const r11 = e6.getChildren(), i15 = r11.length;
                (0 === i15 || r11[i15 - 1].is(n13)) && (t9.delete(e6.__key), n13 = e6), e6 = e6.getParent();
              }
            }
            if (po(d8)) if (c10 === h3) d8.select();
            else {
              const t10 = _r(e5);
              t10.select(), d8.replace(t10);
            }
            else d8 = d8.spliceText(c10, h3 - c10, e5, true), "" === d8.getTextContent() ? d8.remove() : d8.isComposing() && "text" === this.anchor.type && (this.anchor.offset -= e5.length);
            for (let e6 = 1; e6 < f8; e6++) {
              const n13 = u10[e6], r11 = n13.__key;
              t9.has(r11) || n13.remove();
            }
          }
        }
        removeText() {
          const t9 = $r() === this;
          Al(this, Il(Pl(this))), t9 && $r() !== this && Io(this);
        }
        formatText(t9, e5 = null) {
          if (this.isCollapsed()) return this.toggleFormat(t9), void bo(null);
          const n11 = this.getNodes(), r9 = [];
          for (const t10 of n11) pr(t10) && r9.push(t10);
          const i13 = (e6) => {
            n11.forEach((n12) => {
              if (Mi(n12)) {
                const r10 = n12.getFormatFlags(t9, e6);
                n12.setTextFormat(r10);
              }
            });
          }, o8 = r9.length;
          if (0 === o8) return this.toggleFormat(t9), bo(null), void i13(e5);
          const s7 = this.anchor, l8 = this.focus, c10 = this.isBackward(), a10 = c10 ? l8 : s7, u10 = c10 ? s7 : l8;
          let f8 = 0, d8 = r9[0], h3 = "element" === a10.type ? 0 : a10.offset;
          if ("text" === a10.type && h3 === d8.getTextContentSize() && (f8 = 1, d8 = r9[1], h3 = 0), null == d8) return;
          const g5 = d8.getFormatFlags(t9, e5);
          i13(g5);
          const _5 = o8 - 1;
          let p7 = r9[_5];
          const y6 = "text" === u10.type ? u10.offset : p7.getTextContentSize();
          if (d8.is(p7)) {
            if (h3 === y6) return;
            if (yo(d8) || 0 === h3 && y6 === d8.getTextContentSize()) d8.setFormat(g5);
            else {
              const t10 = d8.splitText(h3, y6), e6 = 0 === h3 ? t10[0] : t10[1];
              e6.setFormat(g5), "text" === a10.type && a10.set(e6.__key, 0, "text"), "text" === u10.type && u10.set(e6.__key, y6 - h3, "text");
            }
            return void (this.format = g5);
          }
          0 === h3 || yo(d8) || ([, d8] = d8.splitText(h3), h3 = 0), d8.setFormat(g5);
          const m9 = p7.getFormatFlags(t9, g5);
          y6 > 0 && (y6 === p7.getTextContentSize() || yo(p7) || ([p7] = p7.splitText(y6)), p7.setFormat(m9));
          for (let e6 = f8 + 1; e6 < _5; e6++) {
            const n12 = r9[e6], i14 = n12.getFormatFlags(t9, m9);
            n12.setFormat(i14);
          }
          "text" === a10.type && a10.set(d8.__key, h3, "text"), "text" === u10.type && u10.set(p7.__key, y6, "text"), this.format = g5 | m9;
        }
        insertNodes(e5) {
          if (0 === e5.length) return;
          if (this.isCollapsed() || this.removeText(), "root" === this.anchor.key) {
            this.insertParagraph();
            const n12 = $r();
            return br(n12) || t2(134), n12.insertNodes(e5);
          }
          const n11 = (this.isBackward() ? this.focus : this.anchor).getNode(), r9 = Ys(n11, Fs), i13 = e5[e5.length - 1];
          if (Mi(r9) && "__language" in r9) {
            if ("__language" in e5[0]) this.insertText(e5[0].getTextContent());
            else {
              const t9 = ti(this);
              r9.splice(t9, 0, e5), i13.selectEnd();
            }
            return;
          }
          if (!e5.some((t9) => (Mi(t9) || Di(t9)) && !t9.isInline())) {
            Mi(r9) || t2(211, n11.constructor.name, n11.getType());
            const o9 = ti(this);
            return r9.splice(o9, 0, e5), void i13.selectEnd();
          }
          const o8 = (function(t9) {
            const e6 = $i();
            let n12 = null;
            for (let r10 = 0; r10 < t9.length; r10++) {
              const i14 = t9[r10], o9 = Qn(i14);
              if (o9 || Di(i14) && i14.isInline() || Mi(i14) && i14.isInline() || pr(i14) || i14.isParentRequired()) {
                if (null === n12 && (n12 = i14.createParentElementNode(), e6.append(n12), o9)) continue;
                null !== n12 && n12.append(i14);
              } else e6.append(i14), n12 = null;
            }
            return e6;
          })(e5), s7 = o8.getLastDescendant(), l8 = o8.getChildren(), c10 = !Mi(r9) || !r9.isEmpty() ? this.insertParagraph() : null, a10 = l8[l8.length - 1];
          let u10 = l8[0];
          var f8;
          Mi(f8 = u10) && Fs(f8) && !f8.isEmpty() && Mi(r9) && (!r9.isEmpty() || r9.canMergeWhenEmpty()) && (Mi(r9) || t2(211, n11.constructor.name, n11.getType()), r9.append(...u10.getChildren()), u10 = l8[1]), u10 && (null === r9 && t2(212, n11.constructor.name, n11.getType()), (function(e6, n12) {
            const r10 = n12.getParentOrThrow().getLastChild();
            let i14 = n12;
            const o9 = [n12];
            for (; i14 !== r10; ) i14.getNextSibling() || t2(140), i14 = i14.getNextSibling(), o9.push(i14);
            let s8 = e6;
            for (const t9 of o9) s8 = s8.insertAfter(t9);
          })(r9, u10));
          const d8 = Ys(s7, Fs);
          c10 && Mi(d8) && (c10.canMergeWhenEmpty() || Fs(a10)) && (d8.append(...c10.getChildren()), c10.remove()), Mi(r9) && r9.isEmpty() && r9.remove(), s7.selectEnd();
          const h3 = Mi(r9) ? r9.getLastChild() : null;
          Qn(h3) && d8 !== r9 && h3.remove();
        }
        insertParagraph() {
          if ("root" === this.anchor.key) {
            const t9 = $i();
            return Fo().splice(this.anchor.offset, 0, [t9]), t9.select(), t9;
          }
          const e5 = ti(this), n11 = Ys(this.anchor.getNode(), Fs);
          Mi(n11) || t2(213);
          const r9 = n11.getChildAtIndex(e5), i13 = r9 ? [r9, ...r9.getNextSiblings()] : [], o8 = n11.insertNewAfter(this, false);
          return o8 ? (o8.append(...i13), o8.selectStart(), o8) : null;
        }
        insertLineBreak(t9) {
          const e5 = Xn();
          if (this.insertNodes([e5]), t9) {
            const t10 = e5.getParentOrThrow(), n11 = e5.getIndexWithinParent();
            t10.select(n11, n11);
          }
        }
        extract() {
          const t9 = [...this.getNodes()], e5 = t9.length;
          let n11 = t9[0], r9 = t9[e5 - 1];
          const [i13, o8] = Mr(this), s7 = this.isBackward(), [l8, c10] = s7 ? [this.focus, this.anchor] : [this.anchor, this.focus], [a10, u10] = s7 ? [o8, i13] : [i13, o8];
          if (0 === e5) return [];
          if (1 === e5) {
            if (pr(n11) && !this.isCollapsed()) {
              const t10 = n11.splitText(a10, u10), e6 = 0 === a10 ? t10[0] : t10[1];
              return e6 ? (l8.set(e6.getKey(), 0, "text"), c10.set(e6.getKey(), e6.getTextContentSize(), "text"), [e6]) : [];
            }
            return [n11];
          }
          if (pr(n11) && (a10 === n11.getTextContentSize() ? t9.shift() : 0 !== a10 && ([, n11] = n11.splitText(a10), t9[0] = n11, l8.set(n11.getKey(), 0, "text"))), pr(r9)) {
            const e6 = r9.getTextContent().length;
            0 === u10 ? t9.pop() : u10 !== e6 && ([r9] = r9.splitText(u10), t9[t9.length - 1] = r9, c10.set(r9.getKey(), r9.getTextContentSize(), "text"));
          }
          return t9;
        }
        modify(t9, e5, n11) {
          if (ni(this, t9, e5, n11)) return;
          const r9 = "move" === t9, i13 = hi(), o8 = Ns(_s(i13));
          if (!o8) return;
          const s7 = i13._blockCursorElement, l8 = i13._rootElement, c10 = this.focus.getNode();
          if (null === l8 || null === s7 || !Mi(c10) || c10.isInline() || c10.canBeEmpty() || Ts(s7, i13, l8), this.dirty) {
            let t10 = ls(i13, this.anchor.key), e6 = ls(i13, this.focus.key);
            "text" === this.anchor.type && (t10 = Co(t10)), "text" === this.focus.type && (e6 = Co(e6)), t10 && e6 && Gr(o8, t10, this.anchor.offset, e6, this.focus.offset);
          }
          if ((function(t10, e6, n12, r10) {
            t10.modify(e6, n12, r10);
          })(o8, t9, e5 ? "backward" : "forward", n11), o8.rangeCount > 0) {
            const t10 = o8.getRangeAt(0), n12 = this.anchor.getNode(), i14 = Li(n12) ? n12 : ys(n12);
            if (this.applyDOMRange(t10), this.dirty = true, !r9) {
              const n13 = this.getNodes(), r10 = [];
              let s8 = false;
              for (let t11 = 0; t11 < n13.length; t11++) {
                const e6 = n13[t11];
                hs(e6, i14) ? r10.push(e6) : s8 = true;
              }
              if (s8 && r10.length > 0) if (e5) {
                const t11 = r10[0];
                Mi(t11) ? t11.selectStart() : t11.getParentOrThrow().selectStart();
              } else {
                const t11 = r10[r10.length - 1];
                Mi(t11) ? t11.selectEnd() : t11.getParentOrThrow().selectEnd();
              }
              o8.anchorNode === t10.startContainer && o8.anchorOffset === t10.startOffset || (function(t11) {
                const e6 = t11.focus, n14 = t11.anchor, r11 = n14.key, i15 = n14.offset, o9 = n14.type;
                n14.set(e6.key, e6.offset, e6.type, true), e6.set(r11, i15, o9, true);
              })(this);
            }
          }
          "lineboundary" === n11 && ni(this, t9, e5, n11, "decorators");
        }
        forwardDeletion(t9, e5, n11) {
          if (!n11 && ("element" === t9.type && Mi(e5) && t9.offset === e5.getChildrenSize() || "text" === t9.type && t9.offset === e5.getTextContentSize())) {
            const t10 = e5.getParent(), n12 = e5.getNextSibling() || (null === t10 ? null : t10.getNextSibling());
            if (Mi(n12) && n12.isShadowRoot()) return true;
          }
          return false;
        }
        deleteCharacter(t9) {
          const e5 = this.isCollapsed();
          if (this.isCollapsed()) {
            const e6 = this.anchor;
            let n11 = e6.getNode();
            if (this.forwardDeletion(e6, n11, t9)) return;
            const r9 = xl(El(e6, t9 ? "previous" : "next"));
            if (r9.getTextSlices().every((t10) => null === t10 || 0 === t10.distance)) {
              let t10 = { type: "initial" };
              for (const e7 of r9.iterNodeCarets("shadowRoot")) if (ol(e7)) if (e7.origin.isInline()) ;
              else {
                if (e7.origin.isShadowRoot()) {
                  if ("merge-block" === t10.type) break;
                  if (Mi(r9.anchor.origin) && r9.anchor.origin.isEmpty()) {
                    const t11 = Kl(e7);
                    Al(this, Sl(t11, t11)), r9.anchor.origin.remove();
                  }
                  return;
                }
                "merge-next-block" !== t10.type && "merge-block" !== t10.type || (t10 = { block: t10.block, caret: e7, type: "merge-block" });
              }
              else {
                if ("merge-block" === t10.type) break;
                if (il(e7)) {
                  if (Mi(e7.origin)) {
                    if (e7.origin.isInline()) {
                      if (!e7.origin.isParentOf(r9.anchor.origin)) break;
                    } else t10 = { block: e7.origin, type: "merge-next-block" };
                    continue;
                  }
                  if (Di(e7.origin)) {
                    if (e7.origin.isIsolated()) ;
                    else if ("merge-next-block" === t10.type && (e7.origin.isKeyboardSelectable() || !e7.origin.isInline()) && Mi(r9.anchor.origin) && r9.anchor.origin.isEmpty()) {
                      r9.anchor.origin.remove();
                      const t11 = Wr();
                      t11.add(e7.origin.getKey()), Io(t11);
                    } else e7.origin.remove();
                    return;
                  }
                  break;
                }
              }
              if ("merge-block" === t10.type) {
                const { caret: e7, block: n12 } = t10;
                return Al(this, Sl(!e7.origin.isEmpty() && n12.isEmpty() ? Dl(al(n12, e7.direction)) : r9.anchor, e7)), this.removeText();
              }
            }
            const i13 = this.focus;
            if (this.modify("extend", t9, "character"), this.isCollapsed()) {
              if (t9 && 0 === e6.offset && Ar(this, e6.getNode())) return;
            } else {
              const r10 = "text" === i13.type ? i13.getNode() : null;
              if (n11 = "text" === e6.type ? e6.getNode() : null, null !== r10 && r10.isSegmented()) {
                const e7 = i13.offset, o8 = r10.getTextContentSize();
                if (r10.is(n11) || t9 && e7 !== o8 || !t9 && 0 !== e7) return void Dr(r10, t9, e7);
              } else if (null !== n11 && n11.isSegmented()) {
                const i14 = e6.offset, o8 = n11.getTextContentSize();
                if (n11.is(r10) || t9 && 0 !== i14 || !t9 && i14 !== o8) return void Dr(n11, t9, i14);
              }
              !(function(t10, e7) {
                const n12 = t10.anchor, r11 = t10.focus, i14 = n12.getNode(), o8 = r11.getNode();
                if (i14 === o8 && "text" === n12.type && "text" === r11.type) {
                  const t11 = n12.offset, o9 = r11.offset, s7 = t11 < o9, l8 = s7 ? t11 : o9, c10 = s7 ? o9 : t11, a10 = c10 - 1;
                  if (l8 !== a10) {
                    (function(t12) {
                      return !(zo(t12) || Pr(t12));
                    })(i14.getTextContent().slice(l8, c10)) && (e7 ? r11.set(r11.key, a10, r11.type) : n12.set(n12.key, a10, n12.type));
                  }
                }
              })(this, t9);
            }
          }
          if (this.removeText(), t9 && !e5 && this.isCollapsed() && "element" === this.anchor.type && 0 === this.anchor.offset) {
            const t10 = this.anchor.getNode();
            t10.isEmpty() && Li(t10.getParent()) && null === t10.getPreviousSibling() && Ar(this, t10);
          }
        }
        deleteLine(t9) {
          this.isCollapsed() && this.modify("extend", t9, "lineboundary"), this.isCollapsed() ? this.deleteCharacter(t9) : this.removeText();
        }
        deleteWord(t9) {
          if (this.isCollapsed()) {
            const e5 = this.anchor, n11 = e5.getNode();
            if (this.forwardDeletion(e5, n11, t9)) return;
            this.modify("extend", t9, "word");
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
      Pr = (() => {
        try {
          const t9 = new RegExp("\\p{Emoji}", "u"), e5 = t9.test.bind(t9);
          if (e5("\u2764\uFE0F") && e5("#\uFE0F\u20E3") && e5("\u{1F44D}")) return e5;
        } catch (t9) {
        }
        return () => false;
      })();
      ri = null;
      ii = null;
      oi = false;
      si = false;
      li = 0;
      ci = { characterData: true, childList: true, subtree: true };
      wi = class _wi {
        element;
        before;
        after;
        constructor(t9, e5, n11) {
          this.element = t9, this.before = e5 || null, this.after = n11 || null;
        }
        withBefore(t9) {
          return new _wi(this.element, t9, this.after);
        }
        withAfter(t9) {
          return new _wi(this.element, this.before, t9);
        }
        withElement(t9) {
          return this.element === t9 ? this : new _wi(t9, this.before, this.after);
        }
        insertChild(e5) {
          const n11 = this.before || this.getManagedLineBreak();
          return null !== n11 && n11.parentElement !== this.element && t2(222), this.element.insertBefore(e5, n11), this;
        }
        removeChild(e5) {
          return e5.parentElement !== this.element && t2(223), this.element.removeChild(e5), this;
        }
        replaceChild(e5, n11) {
          return n11.parentElement !== this.element && t2(224), this.element.replaceChild(e5, n11), this;
        }
        getFirstChild() {
          const t9 = this.after ? this.after.nextSibling : this.element.firstChild;
          return t9 === this.before || t9 === this.getManagedLineBreak() ? null : t9;
        }
        getManagedLineBreak() {
          return this.element.__lexicalLineBreak || null;
        }
        setManagedLineBreak(t9) {
          if (null === t9) this.removeManagedLineBreak();
          else {
            const e5 = "decorator" === t9 && (d || c || l);
            this.insertManagedLineBreak(e5);
          }
        }
        removeManagedLineBreak() {
          const t9 = this.getManagedLineBreak();
          if (t9) {
            const e5 = this.element, n11 = "IMG" === t9.nodeName ? t9.nextSibling : null;
            n11 && e5.removeChild(n11), e5.removeChild(t9), e5.__lexicalLineBreak = void 0;
          }
        }
        insertManagedLineBreak(t9) {
          const e5 = this.getManagedLineBreak();
          if (e5) {
            if (t9 === ("IMG" === e5.nodeName)) return;
            this.removeManagedLineBreak();
          }
          const n11 = this.element, r9 = this.before, i13 = document.createElement("br");
          if (n11.insertBefore(i13, r9), t9) {
            const t10 = document.createElement("img");
            t10.setAttribute("data-lexical-linebreak", "true"), t10.style.cssText = "display: inline !important; border: 0px !important; margin: 0px !important;", t10.alt = "", n11.insertBefore(t10, i13), n11.__lexicalLineBreak = t10;
          } else n11.__lexicalLineBreak = i13;
        }
        getFirstChildOffset() {
          let t9 = 0;
          for (let e5 = this.after; null !== e5; e5 = e5.previousSibling) t9++;
          return t9;
        }
        resolveChildIndex(t9, e5, n11, r9) {
          if (n11 === this.element) {
            const e6 = this.getFirstChildOffset();
            return [t9, Math.min(e6 + t9.getChildrenSize(), Math.max(e6, r9))];
          }
          const i13 = Ei(e5, n11);
          i13.push(r9);
          const o8 = Ei(e5, this.element);
          let s7 = t9.getIndexWithinParent();
          for (let t10 = 0; t10 < o8.length; t10++) {
            const e6 = i13[t10], n12 = o8[t10];
            if (void 0 === e6 || e6 < n12) break;
            if (e6 > n12) {
              s7 += 1;
              break;
            }
          }
          return [t9.getParentOrThrow(), s7];
        }
      };
      Oi = class extends Rn {
        __first;
        __last;
        __size;
        __format;
        __style;
        __indent;
        __dir;
        __textFormat;
        __textStyle;
        constructor(t9) {
          super(t9), this.__first = null, this.__last = null, this.__size = 0, this.__format = 0, this.__style = "", this.__indent = 0, this.__dir = null, this.__textFormat = 0, this.__textStyle = "";
        }
        afterCloneFrom(t9) {
          super.afterCloneFrom(t9), this.__key === t9.__key && (this.__first = t9.__first, this.__last = t9.__last, this.__size = t9.__size), this.__indent = t9.__indent, this.__format = t9.__format, this.__style = t9.__style, this.__dir = t9.__dir, this.__textFormat = t9.__textFormat, this.__textStyle = t9.__textStyle;
        }
        getFormat() {
          return this.getLatest().__format;
        }
        getFormatType() {
          const t9 = this.getFormat();
          return J[t9] || "";
        }
        getStyle() {
          return this.getLatest().__style;
        }
        getIndent() {
          return this.getLatest().__indent;
        }
        getChildren() {
          const t9 = [];
          let e5 = this.getFirstChild();
          for (; null !== e5; ) t9.push(e5), e5 = e5.getNextSibling();
          return t9;
        }
        getChildrenKeys() {
          const t9 = [];
          let e5 = this.getFirstChild();
          for (; null !== e5; ) t9.push(e5.__key), e5 = e5.getNextSibling();
          return t9;
        }
        getChildrenSize() {
          return this.getLatest().__size;
        }
        isEmpty() {
          return 0 === this.getChildrenSize();
        }
        isDirty() {
          const t9 = hi()._dirtyElements;
          return null !== t9 && t9.has(this.__key);
        }
        isLastChild() {
          const t9 = this.getLatest(), e5 = this.getParentOrThrow().getLastChild();
          return null !== e5 && e5.is(t9);
        }
        getAllTextNodes() {
          const t9 = [];
          let e5 = this.getFirstChild();
          for (; null !== e5; ) {
            if (pr(e5) && t9.push(e5), Mi(e5)) {
              const n11 = e5.getAllTextNodes();
              t9.push(...n11);
            }
            e5 = e5.getNextSibling();
          }
          return t9;
        }
        getFirstDescendant() {
          let t9 = this.getFirstChild();
          for (; Mi(t9); ) {
            const e5 = t9.getFirstChild();
            if (null === e5) break;
            t9 = e5;
          }
          return t9;
        }
        getLastDescendant() {
          let t9 = this.getLastChild();
          for (; Mi(t9); ) {
            const e5 = t9.getLastChild();
            if (null === e5) break;
            t9 = e5;
          }
          return t9;
        }
        getDescendantByIndex(t9) {
          const e5 = this.getChildren(), n11 = e5.length;
          if (t9 >= n11) {
            const t10 = e5[n11 - 1];
            return Mi(t10) && t10.getLastDescendant() || t10 || null;
          }
          const r9 = e5[t9];
          return Mi(r9) && r9.getFirstDescendant() || r9 || null;
        }
        getFirstChild() {
          const t9 = this.getLatest().__first;
          return null === t9 ? null : Eo(t9);
        }
        getFirstChildOrThrow() {
          const e5 = this.getFirstChild();
          return null === e5 && t2(45, this.__key), e5;
        }
        getLastChild() {
          const t9 = this.getLatest().__last;
          return null === t9 ? null : Eo(t9);
        }
        getLastChildOrThrow() {
          const e5 = this.getLastChild();
          return null === e5 && t2(96, this.__key), e5;
        }
        getChildAtIndex(t9) {
          const e5 = this.getChildrenSize();
          let n11, r9;
          if (t9 < e5 / 2) {
            for (n11 = this.getFirstChild(), r9 = 0; null !== n11 && r9 <= t9; ) {
              if (r9 === t9) return n11;
              n11 = n11.getNextSibling(), r9++;
            }
            return null;
          }
          for (n11 = this.getLastChild(), r9 = e5 - 1; null !== n11 && r9 >= t9; ) {
            if (r9 === t9) return n11;
            n11 = n11.getPreviousSibling(), r9--;
          }
          return null;
        }
        getTextContent() {
          let t9 = "";
          const e5 = this.getChildren(), n11 = e5.length;
          for (let r9 = 0; r9 < n11; r9++) {
            const i13 = e5[r9];
            t9 += i13.getTextContent(), Mi(i13) && r9 !== n11 - 1 && !i13.isInline() && (t9 += D);
          }
          return t9;
        }
        getTextContentSize() {
          let t9 = 0;
          const e5 = this.getChildren(), n11 = e5.length;
          for (let r9 = 0; r9 < n11; r9++) {
            const i13 = e5[r9];
            t9 += i13.getTextContentSize(), Mi(i13) && r9 !== n11 - 1 && !i13.isInline() && (t9 += 2);
          }
          return t9;
        }
        getDirection() {
          return this.getLatest().__dir;
        }
        getTextFormat() {
          return this.getLatest().__textFormat;
        }
        hasFormat(t9) {
          if ("" !== t9) {
            const e5 = W[t9];
            return 0 !== (this.getFormat() & e5);
          }
          return false;
        }
        hasTextFormat(t9) {
          const e5 = R[t9];
          return 0 !== (this.getTextFormat() & e5);
        }
        getFormatFlags(t9, e5) {
          return So(this.getLatest().__textFormat, t9, e5);
        }
        getTextStyle() {
          return this.getLatest().__textStyle;
        }
        select(t9, e5) {
          ui();
          const n11 = $r();
          let r9 = t9, i13 = e5;
          const o8 = this.getChildrenSize();
          if (!this.canBeEmpty()) {
            if (0 === t9 && 0 === e5) {
              const t10 = this.getFirstChild();
              if (pr(t10) || Mi(t10)) return t10.select(0, 0);
            } else if (!(void 0 !== t9 && t9 !== o8 || void 0 !== e5 && e5 !== o8)) {
              const t10 = this.getLastChild();
              if (pr(t10) || Mi(t10)) return t10.select();
            }
          }
          void 0 === r9 && (r9 = o8), void 0 === i13 && (i13 = o8);
          const s7 = this.__key;
          return br(n11) ? (n11.anchor.set(s7, r9, "element"), n11.focus.set(s7, i13, "element"), n11.dirty = true, n11) : Rr(s7, r9, s7, i13, "element", "element");
        }
        selectStart() {
          const t9 = this.getFirstDescendant();
          return t9 ? t9.selectStart() : this.select();
        }
        selectEnd() {
          const t9 = this.getLastDescendant();
          return t9 ? t9.selectEnd() : this.select();
        }
        clear() {
          const t9 = this.getWritable();
          return this.getChildren().forEach((t10) => t10.remove()), t9;
        }
        append(...t9) {
          return this.splice(this.getChildrenSize(), 0, t9);
        }
        setDirection(t9) {
          const e5 = this.getWritable();
          return e5.__dir = t9, e5;
        }
        setFormat(t9) {
          return this.getWritable().__format = "" !== t9 ? W[t9] : 0, this;
        }
        setStyle(t9) {
          return this.getWritable().__style = t9 || "", this;
        }
        setTextFormat(t9) {
          const e5 = this.getWritable();
          return e5.__textFormat = t9, e5;
        }
        setTextStyle(t9) {
          const e5 = this.getWritable();
          return e5.__textStyle = t9, e5;
        }
        setIndent(t9) {
          return this.getWritable().__indent = t9, this;
        }
        splice(e5, n11, r9) {
          zn(this) && t2(324, this.__key, this.__type);
          const i13 = this.getChildrenSize(), o8 = this.getWritable();
          e5 + n11 <= i13 || t2(226, String(e5), String(n11), String(i13));
          const s7 = o8.__key, l8 = [], c10 = [], a10 = this.getChildAtIndex(e5 + n11);
          let u10 = null, f8 = i13 - n11 + r9.length;
          if (0 !== e5) if (e5 === i13) u10 = this.getLastChild();
          else {
            const t9 = this.getChildAtIndex(e5);
            null !== t9 && (u10 = t9.getPreviousSibling());
          }
          if (n11 > 0) {
            let e6 = null === u10 ? this.getFirstChild() : u10.getNextSibling();
            for (let r10 = 0; r10 < n11; r10++) {
              null === e6 && t2(100);
              const n12 = e6.getNextSibling(), r11 = e6.__key;
              To(e6.getWritable()), c10.push(r11), e6 = n12;
            }
          }
          let d8 = u10;
          for (const e6 of r9) {
            null !== d8 && e6.is(d8) && (u10 = d8 = d8.getPreviousSibling());
            const n12 = e6.getWritable();
            n12.__parent === s7 && f8--, To(n12);
            const r10 = e6.__key;
            if (null === d8) o8.__first = r10, n12.__prev = null;
            else {
              const t9 = d8.getWritable();
              t9.__next = r10, n12.__prev = t9.__key;
            }
            e6.__key === s7 && t2(76), n12.__parent = s7, l8.push(r10), d8 = e6;
          }
          if (e5 + n11 === i13) {
            if (null !== d8) {
              d8.getWritable().__next = null, o8.__last = d8.__key;
            }
          } else if (null !== a10) {
            const t9 = a10.getWritable();
            if (null !== d8) {
              const e6 = d8.getWritable();
              t9.__prev = d8.__key, e6.__next = a10.__key;
            } else t9.__prev = null;
          }
          if (o8.__size = f8, c10.length) {
            const t9 = $r();
            if (br(t9)) {
              const e6 = new Set(c10), n12 = new Set(l8), { anchor: r10, focus: i14 } = t9;
              Ai(r10, e6, n12) && qr(r10, r10.getNode(), this, u10, a10), Ai(i14, e6, n12) && qr(i14, i14.getNode(), this, u10, a10), 0 !== f8 || this.canBeEmpty() || ms(this) || this.remove();
            }
          }
          return o8;
        }
        getDOMSlot(t9) {
          return new wi(t9);
        }
        exportDOM(t9) {
          const { element: e5 } = super.exportDOM(t9);
          if (Os(e5)) {
            const t10 = this.getIndent();
            t10 > 0 && (e5.style.paddingInlineStart = 40 * t10 + "px");
            const n11 = this.getDirection();
            n11 && (e5.dir = n11);
          }
          return { element: e5 };
        }
        exportJSON() {
          const t9 = { children: [], direction: this.getDirection(), format: this.getFormatType(), indent: this.getIndent(), ...super.exportJSON() }, e5 = this.getTextFormat(), n11 = this.getTextStyle();
          return 0 === e5 && "" === n11 || ms(this) || this.getChildren().some(pr) || (0 !== e5 && (t9.textFormat = e5), "" !== n11 && (t9.textStyle = n11)), t9;
        }
        updateFromJSON(t9) {
          return super.updateFromJSON(t9).setFormat(t9.format).setIndent(t9.indent).setDirection(t9.direction).setTextFormat(t9.textFormat || 0).setTextStyle(t9.textStyle || "");
        }
        insertNewAfter(t9, e5) {
          return null;
        }
        canIndent() {
          return true;
        }
        collapseAtStart(t9) {
          return false;
        }
        excludeFromCopy(t9) {
          return false;
        }
        canReplaceWith(t9) {
          return true;
        }
        canInsertAfter(t9) {
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
        canMergeWith(t9) {
          return false;
        }
        extractWithChild(t9, e5, n11) {
          return false;
        }
        canMergeWhenEmpty() {
          return false;
        }
        reconcileObservedMutation(t9, e5) {
          const n11 = this.getDOMSlot(t9);
          let r9 = n11.getFirstChild();
          for (let t10 = this.getFirstChild(); t10; t10 = t10.getNextSibling()) {
            const i13 = e5.getElementByKey(t10.getKey());
            null !== i13 && (null == r9 ? (n11.insertChild(i13), r9 = i13) : r9 !== i13 && n11.replaceChild(i13, r9), r9 = r9.nextSibling);
          }
        }
      };
      Pi = class extends Rn {
        decorate(t9, e5) {
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
      Fi = class _Fi extends Oi {
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
          t2(51);
        }
        getTextContent() {
          const t9 = this.__cachedText;
          return !ai() && 0 !== hi()._dirtyType || null === t9 ? super.getTextContent() : t9;
        }
        remove() {
          t2(52);
        }
        replace(e5) {
          t2(53);
        }
        insertBefore(e5) {
          t2(54);
        }
        insertAfter(e5) {
          t2(55);
        }
        updateDOM(t9, e5) {
          return false;
        }
        splice(e5, n11, r9) {
          for (const e6 of r9) Mi(e6) || Di(e6) || t2(282);
          return super.splice(e5, n11, r9);
        }
        static importJSON(t9) {
          return Fo().updateFromJSON(t9);
        }
        collapseAtStart() {
          return true;
        }
      };
      Bi = class _Bi {
        _nodeMap;
        _selection;
        _flushSync;
        _readOnly;
        constructor(t9, e5) {
          this._nodeMap = t9, this._selection = e5 || null, this._flushSync = false, this._readOnly = false;
        }
        isEmpty() {
          return 1 === this._nodeMap.size && null === this._selection;
        }
        read(t9, e5) {
          return Si(e5 && e5.editor || null, this, t9);
        }
        clone(t9) {
          const e5 = new _Bi(this._nodeMap, void 0 === t9 ? this._selection : t9);
          return e5._readOnly = true, e5;
        }
        toJSON() {
          return Si(null, this, () => ({ root: zi(Fo()) }));
        }
      };
      Wi = class extends Oi {
        static getType() {
          return "artificial";
        }
        createDOM(t9) {
          return document.createElement("div");
        }
      };
      Ji = class _Ji extends Oi {
        static getType() {
          return "paragraph";
        }
        static clone(t9) {
          return new _Ji(t9.__key);
        }
        createDOM(t9) {
          const e5 = document.createElement("p"), n11 = Zo(t9.theme, "paragraph");
          if (void 0 !== n11) {
            e5.classList.add(...n11);
          }
          return e5;
        }
        updateDOM(t9, e5, n11) {
          return false;
        }
        static importDOM() {
          return { p: (t9) => ({ conversion: ji, priority: 0 }) };
        }
        exportDOM(t9) {
          const { element: e5 } = super.exportDOM(t9);
          if (Os(e5)) {
            this.isEmpty() && e5.append(document.createElement("br"));
            const t10 = this.getFormatType();
            t10 && (e5.style.textAlign = t10);
          }
          return { element: e5 };
        }
        static importJSON(t9) {
          return $i().updateFromJSON(t9);
        }
        exportJSON() {
          const t9 = super.exportJSON();
          if (void 0 === t9.textFormat || void 0 === t9.textStyle) {
            const e5 = this.getChildren().find(pr);
            e5 ? (t9.textFormat = e5.getFormat(), t9.textStyle = e5.getStyle()) : (t9.textFormat = this.getTextFormat(), t9.textStyle = this.getTextStyle());
          }
          return t9;
        }
        insertNewAfter(t9, e5) {
          const n11 = $i();
          n11.setTextFormat(t9.format), n11.setTextStyle(t9.style);
          const r9 = this.getDirection();
          return n11.setDirection(r9), n11.setFormat(this.getFormatType()), n11.setStyle(this.getStyle()), this.insertAfter(n11, e5), n11;
        }
        collapseAtStart() {
          const t9 = this.getChildren();
          if (0 === t9.length || pr(t9[0]) && "" === t9[0].getTextContent().trim()) {
            if (null !== this.getNextSibling()) return this.selectNext(), this.remove(), true;
            if (null !== this.getPreviousSibling()) return this.selectPrevious(), this.remove(), true;
          }
          return false;
        }
      };
      Vi = 0;
      Yi = 1;
      qi = 2;
      Hi = 3;
      Gi = 4;
      to = class {
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
        constructor(t9, e5, n11, r9, i13, o8, s7, l8) {
          this._createEditorArgs = l8, this._parentEditor = e5, this._rootElement = null, this._editorState = t9, this._pendingEditorState = null, this._compositionKey = null, this._deferred = [], this._keyToDOMMap = /* @__PURE__ */ new Map(), this._updates = [], this._updating = false, this._listeners = { decorator: /* @__PURE__ */ new Set(), editable: /* @__PURE__ */ new Set(), mutation: /* @__PURE__ */ new Map(), root: /* @__PURE__ */ new Set(), textcontent: /* @__PURE__ */ new Set(), update: /* @__PURE__ */ new Set() }, this._commands = /* @__PURE__ */ new Map(), this._config = r9, this._nodes = n11, this._decorators = {}, this._pendingDecorators = null, this._dirtyType = 0, this._cloneNotNeeded = /* @__PURE__ */ new Set(), this._dirtyLeaves = /* @__PURE__ */ new Set(), this._dirtyElements = /* @__PURE__ */ new Map(), this._normalizedNodes = /* @__PURE__ */ new Set(), this._updateTags = /* @__PURE__ */ new Set(), this._observer = null, this._key = Bo(), this._onError = i13, this._htmlConversions = o8, this._editable = s7, this._headless = null !== e5 && e5._headless, this._window = null, this._blockCursorElement = null;
        }
        isComposing() {
          return null != this._compositionKey;
        }
        registerUpdateListener(t9) {
          const e5 = this._listeners.update;
          return e5.add(t9), () => {
            e5.delete(t9);
          };
        }
        registerEditableListener(t9) {
          const e5 = this._listeners.editable;
          return e5.add(t9), () => {
            e5.delete(t9);
          };
        }
        registerDecoratorListener(t9) {
          const e5 = this._listeners.decorator;
          return e5.add(t9), () => {
            e5.delete(t9);
          };
        }
        registerTextContentListener(t9) {
          const e5 = this._listeners.textcontent;
          return e5.add(t9), () => {
            e5.delete(t9);
          };
        }
        registerRootListener(t9) {
          const e5 = this._listeners.root;
          return t9(this._rootElement, null), e5.add(t9), () => {
            t9(null, this._rootElement), e5.delete(t9);
          };
        }
        registerCommand(e5, n11, r9) {
          void 0 === r9 && t2(35);
          const i13 = this._commands;
          i13.has(e5) || i13.set(e5, [/* @__PURE__ */ new Set(), /* @__PURE__ */ new Set(), /* @__PURE__ */ new Set(), /* @__PURE__ */ new Set(), /* @__PURE__ */ new Set()]);
          const o8 = i13.get(e5);
          void 0 === o8 && t2(36, String(e5));
          const s7 = o8[r9];
          return s7.add(n11), () => {
            s7.delete(n11), o8.every((t9) => 0 === t9.size) && i13.delete(e5);
          };
        }
        registerMutationListener(t9, e5, n11) {
          const r9 = this.resolveRegisteredNodeAfterReplacements(this.getRegisteredNode(t9)).klass, i13 = this._listeners.mutation;
          let o8 = i13.get(e5);
          void 0 === o8 && (o8 = /* @__PURE__ */ new Set(), i13.set(e5, o8)), o8.add(r9);
          const s7 = n11 && n11.skipInitialization;
          return void 0 !== s7 && s7 || this.initializeMutationListener(e5, r9), () => {
            o8.delete(r9), 0 === o8.size && i13.delete(e5);
          };
        }
        getRegisteredNode(e5) {
          const n11 = this._nodes.get(e5.getType());
          return void 0 === n11 && t2(37, e5.name), n11;
        }
        resolveRegisteredNodeAfterReplacements(t9) {
          for (; t9.replaceWithKlass; ) t9 = this.getRegisteredNode(t9.replaceWithKlass);
          return t9;
        }
        initializeMutationListener(t9, e5) {
          const n11 = this._editorState, r9 = zs(n11).get(e5.getType());
          if (!r9) return;
          const i13 = /* @__PURE__ */ new Map();
          for (const t10 of r9.keys()) i13.set(t10, "created");
          i13.size > 0 && t9(i13, { dirtyLeaves: /* @__PURE__ */ new Set(), prevEditorState: n11, updateTags: /* @__PURE__ */ new Set(["registerMutationListener"]) });
        }
        registerNodeTransformToKlass(t9, e5) {
          const n11 = this.getRegisteredNode(t9);
          return n11.transforms.add(e5), n11;
        }
        registerNodeTransform(t9, e5) {
          const n11 = this.registerNodeTransformToKlass(t9, e5), r9 = [n11], i13 = n11.replaceWithKlass;
          if (null != i13) {
            const t10 = this.registerNodeTransformToKlass(i13, e5);
            r9.push(t10);
          }
          return (function(t10, e6) {
            const n12 = zs(t10.getEditorState()), r10 = [];
            for (const t11 of e6) {
              const e7 = n12.get(t11);
              e7 && r10.push(e7);
            }
            if (0 === r10.length) return;
            t10.update(() => {
              for (const t11 of r10) for (const e7 of t11.keys()) {
                const t12 = Eo(e7);
                t12 && t12.markDirty();
              }
            }, null === t10._pendingEditorState ? { tag: Jn } : void 0);
          })(this, r9.map((t10) => t10.klass.getType())), () => {
            r9.forEach((t10) => t10.transforms.delete(e5));
          };
        }
        hasNode(t9) {
          return this._nodes.has(t9.getType());
        }
        hasNodes(t9) {
          return t9.every(this.hasNode.bind(this));
        }
        dispatchCommand(t9, e5) {
          return os(this, t9, e5);
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
        setRootElement(t9) {
          const e5 = this._rootElement;
          if (t9 !== e5) {
            const n11 = Zo(this._config.theme, "root"), r9 = this._pendingEditorState || this._editorState;
            if (this._rootElement = t9, Xi(this, e5, t9, r9), null !== e5 && (this._config.disableEvents || Fn(e5), null != n11 && e5.classList.remove(...n11)), null !== t9) {
              const e6 = gs(t9), r10 = t9.style;
              r10.userSelect = "text", r10.whiteSpace = "pre-wrap", r10.wordBreak = "break-word", t9.setAttribute("data-lexical-editor", "true"), this._window = e6, this._dirtyType = 2, rt(this), this._updateTags.add(Jn), vi(this), this._config.disableEvents || (function(t10, e7) {
                const n12 = t10.ownerDocument;
                sn.set(t10, n12);
                const r11 = ln.get(n12) ?? 0;
                r11 < 1 && n12.addEventListener("selectionchange", Mn), ln.set(n12, r11 + 1), t10.__lexicalEditor = e7;
                const i13 = En(t10);
                for (let n13 = 0; n13 < tn.length; n13++) {
                  const [r12, o8] = tn[n13], s7 = "function" == typeof o8 ? (t11) => {
                    Pn(t11) || (An(t11), (e7.isEditable() || "click" === r12) && o8(t11, e7));
                  } : (t11) => {
                    if (Pn(t11)) return;
                    An(t11);
                    const n14 = e7.isEditable();
                    switch (r12) {
                      case "cut":
                        return n14 && os(e7, $e, t11);
                      case "copy":
                        return os(e7, je, t11);
                      case "paste":
                        return n14 && os(e7, _e, t11);
                      case "dragstart":
                        return n14 && os(e7, Be, t11);
                      case "dragover":
                        return n14 && os(e7, We, t11);
                      case "dragend":
                        return n14 && os(e7, Je, t11);
                      case "focus":
                        return n14 && os(e7, Ge, t11);
                      case "blur":
                        return n14 && os(e7, Xe, t11);
                      case "drop":
                        return n14 && os(e7, ze, t11);
                    }
                  };
                  t10.addEventListener(r12, s7), i13.push(() => {
                    t10.removeEventListener(r12, s7);
                  });
                }
              })(t9, this), null != n11 && t9.classList.add(...n11);
            } else this._window = null, this._updateTags.add(Jn), vi(this);
            ki("root", this, false, t9, e5);
          }
        }
        getElementByKey(t9) {
          return this._keyToDOMMap.get(t9) || null;
        }
        getEditorState() {
          return this._editorState;
        }
        setEditorState(e5, n11) {
          e5.isEmpty() && t2(38);
          let r9 = e5;
          r9._readOnly && (r9 = Ii(e5), r9._selection = e5._selection ? e5._selection.clone() : null), nt(this);
          const i13 = this._pendingEditorState, o8 = this._updateTags, s7 = void 0 !== n11 ? n11.tag : null;
          null === i13 || i13.isEmpty() || (null != s7 && o8.add(s7), vi(this)), this._pendingEditorState = r9, this._dirtyType = 2, this._dirtyElements.set("root", false), this._compositionKey = null, null != s7 && o8.add(s7), this._updating || vi(this);
        }
        parseEditorState(t9, e5) {
          return (function(t10, e6, n11) {
            const r9 = Ki(), i13 = ri, o8 = oi, s7 = ii, l8 = e6._dirtyElements, c10 = e6._dirtyLeaves, a10 = e6._cloneNotNeeded, u10 = e6._dirtyType;
            e6._dirtyElements = /* @__PURE__ */ new Map(), e6._dirtyLeaves = /* @__PURE__ */ new Set(), e6._cloneNotNeeded = /* @__PURE__ */ new Set(), e6._dirtyType = 0, ri = r9, oi = false, ii = e6, no(null);
            try {
              const i14 = e6._nodes;
              Ci(t10.root, i14), n11 && n11(), r9._readOnly = true;
            } catch (t11) {
              t11 instanceof Error && e6._onError(t11);
            } finally {
              e6._dirtyElements = l8, e6._dirtyLeaves = c10, e6._cloneNotNeeded = a10, e6._dirtyType = u10, ri = i13, oi = o8, ii = s7;
            }
            return r9;
          })("string" == typeof t9 ? JSON.parse(t9) : t9, this, e5);
        }
        read(t9) {
          return vi(this), this.getEditorState().read(t9, { editor: this });
        }
        update(t9, e5) {
          !(function(t10, e6, n11) {
            t10._updating ? t10._updates.push([e6, n11]) : Ni(t10, e6, n11);
          })(this, t9, e5);
        }
        focus(t9, e5 = {}) {
          const n11 = this._rootElement;
          null !== n11 && (n11.setAttribute("autocapitalize", "off"), bi(this, () => {
            const r9 = $r(), i13 = Fo();
            null !== r9 ? r9.dirty || Io(r9.clone()) : 0 !== i13.getChildrenSize() && ("rootStart" === e5.defaultSelection ? i13.selectStart() : i13.selectEnd()), fs("focus"), ds(() => {
              n11.removeAttribute("autocapitalize"), t9 && t9();
            });
          }), null === this._pendingEditorState && n11.removeAttribute("autocapitalize"));
        }
        blur() {
          const t9 = this._rootElement;
          null !== t9 && t9.blur();
          const e5 = Ns(this._window);
          null !== e5 && e5.removeAllRanges();
        }
        isEditable() {
          return this._editable;
        }
        setEditable(t9) {
          this._editable !== t9 && (this._editable = t9, ki("editable", this, true, t9));
        }
        toJSON() {
          return { editorState: this._editorState.toJSON() };
        }
      };
      to.version = "0.39.0+prod.esm";
      eo = null;
      ro = 1;
      lo = "function" == typeof queueMicrotask ? queueMicrotask : (t9) => {
        Promise.resolve().then(t9);
      };
      qo = { ctrlKey: !i, metaKey: i };
      Ho = { altKey: i, ctrlKey: !i };
      Is = /* @__PURE__ */ new WeakMap();
      Ks = /* @__PURE__ */ new Map();
      Ys = (t9, e5) => {
        let n11 = t9;
        for (; null != n11 && !Li(n11); ) {
          if (e5(n11)) return n11;
          n11 = n11.getParent();
        }
        return null;
      };
      qs = { next: "previous", previous: "next" };
      Hs = class {
        origin;
        constructor(t9) {
          this.origin = t9;
        }
        [Symbol.iterator]() {
          return vl({ hasNext: il, initial: this.getAdjacentCaret(), map: (t9) => t9, step: (t9) => t9.getAdjacentCaret() });
        }
        getAdjacentCaret() {
          return al(this.getNodeAtCaret(), this.direction);
        }
        getSiblingCaret() {
          return al(this.origin, this.direction);
        }
        remove() {
          const t9 = this.getNodeAtCaret();
          return t9 && t9.remove(), this;
        }
        replaceOrInsert(t9, e5) {
          const n11 = this.getNodeAtCaret();
          return t9.is(this.origin) || t9.is(n11) || (null === n11 ? this.insert(t9) : n11.replace(t9, e5)), this;
        }
        splice(e5, n11, r9 = "next") {
          const i13 = r9 === this.direction ? n11 : Array.from(n11).reverse();
          let o8 = this;
          const s7 = this.getParentAtCaret(), l8 = /* @__PURE__ */ new Map();
          for (let t9 = o8.getAdjacentCaret(); null !== t9 && l8.size < e5; t9 = t9.getAdjacentCaret()) {
            const e6 = t9.origin.getWritable();
            l8.set(e6.getKey(), e6);
          }
          for (const e6 of i13) {
            if (l8.size > 0) {
              const n12 = o8.getNodeAtCaret();
              if (n12) if (l8.delete(n12.getKey()), l8.delete(e6.getKey()), n12.is(e6) || o8.origin.is(e6)) ;
              else {
                const t9 = e6.getParent();
                t9 && t9.is(s7) && e6.remove(), n12.replace(e6);
              }
              else null === n12 && t2(263, Array.from(l8).join(" "));
            } else o8.insert(e6);
            o8 = al(e6, this.direction);
          }
          for (const t9 of l8.values()) t9.remove();
          return this;
        }
      };
      Gs = class _Gs extends Hs {
        type = "child";
        getLatest() {
          const t9 = this.origin.getLatest();
          return t9 === this.origin ? this : hl(t9, this.direction);
        }
        getParentCaret(t9 = "root") {
          return al(Zs(this.getParentAtCaret(), t9), this.direction);
        }
        getFlipped() {
          const t9 = Qs(this.direction);
          return al(this.getNodeAtCaret(), t9) || hl(this.origin, t9);
        }
        getParentAtCaret() {
          return this.origin;
        }
        getChildCaret() {
          return this;
        }
        isSameNodeCaret(t9) {
          return t9 instanceof _Gs && this.direction === t9.direction && this.origin.is(t9.origin);
        }
        isSamePointCaret(t9) {
          return this.isSameNodeCaret(t9);
        }
      };
      Xs = { root: Li, shadowRoot: ms };
      tl = class _tl extends Hs {
        type = "sibling";
        getLatest() {
          const t9 = this.origin.getLatest();
          return t9 === this.origin ? this : al(t9, this.direction);
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
        getParentCaret(t9 = "root") {
          return al(Zs(this.getParentAtCaret(), t9), this.direction);
        }
        getFlipped() {
          const t9 = Qs(this.direction);
          return al(this.getNodeAtCaret(), t9) || hl(this.origin.getParentOrThrow(), t9);
        }
        isSamePointCaret(t9) {
          return t9 instanceof _tl && this.direction === t9.direction && this.origin.is(t9.origin);
        }
        isSameNodeCaret(t9) {
          return (t9 instanceof _tl || t9 instanceof el) && this.direction === t9.direction && this.origin.is(t9.origin);
        }
      };
      el = class _el extends Hs {
        type = "text";
        offset;
        constructor(t9, e5) {
          super(t9), this.offset = e5;
        }
        getLatest() {
          const t9 = this.origin.getLatest();
          return t9 === this.origin ? this : ul(t9, this.direction, this.offset);
        }
        getParentAtCaret() {
          return this.origin.getParent();
        }
        getChildCaret() {
          return null;
        }
        getParentCaret(t9 = "root") {
          return al(Zs(this.getParentAtCaret(), t9), this.direction);
        }
        getFlipped() {
          return ul(this.origin, Qs(this.direction), this.offset);
        }
        isSamePointCaret(t9) {
          return t9 instanceof _el && this.direction === t9.direction && this.origin.is(t9.origin) && this.offset === t9.offset;
        }
        isSameNodeCaret(t9) {
          return (t9 instanceof tl || t9 instanceof _el) && this.direction === t9.direction && this.origin.is(t9.origin);
        }
        getSiblingCaret() {
          return al(this.origin, this.direction);
        }
      };
      sl = { next: class extends el {
        direction = "next";
        getNodeAtCaret() {
          return this.origin.getNextSibling();
        }
        insert(t9) {
          return this.origin.insertAfter(t9), this;
        }
      }, previous: class extends el {
        direction = "previous";
        getNodeAtCaret() {
          return this.origin.getPreviousSibling();
        }
        insert(t9) {
          return this.origin.insertBefore(t9), this;
        }
      } };
      ll = { next: class extends tl {
        direction = "next";
        getNodeAtCaret() {
          return this.origin.getNextSibling();
        }
        insert(t9) {
          return this.origin.insertAfter(t9), this;
        }
      }, previous: class extends tl {
        direction = "previous";
        getNodeAtCaret() {
          return this.origin.getPreviousSibling();
        }
        insert(t9) {
          return this.origin.insertBefore(t9), this;
        }
      } };
      cl = { next: class extends Gs {
        direction = "next";
        getNodeAtCaret() {
          return this.origin.getFirstChild();
        }
        insert(t9) {
          return this.origin.splice(0, 0, [t9]), this;
        }
      }, previous: class extends Gs {
        direction = "previous";
        getNodeAtCaret() {
          return this.origin.getLastChild();
        }
        insert(t9) {
          return this.origin.splice(this.origin.getChildrenSize(), 0, [t9]), this;
        }
      } };
      pl = class _pl {
        type = "node-caret-range";
        direction;
        anchor;
        focus;
        constructor(t9, e5, n11) {
          this.anchor = t9, this.focus = e5, this.direction = n11;
        }
        getLatest() {
          const t9 = this.anchor.getLatest(), e5 = this.focus.getLatest();
          return t9 === this.anchor && e5 === this.focus ? this : new _pl(t9, e5, this.direction);
        }
        isCollapsed() {
          return this.anchor.isSamePointCaret(this.focus);
        }
        getTextSlices() {
          const t9 = (t10) => {
            const e6 = this[t10].getLatest();
            return nl(e6) ? (function(t11, e7) {
              const { direction: n12, origin: r9 } = t11, i13 = fl(r9, "focus" === e7 ? Qs(n12) : n12);
              return dl(t11, i13 - t11.offset);
            })(e6, t10) : null;
          }, e5 = t9("anchor"), n11 = t9("focus");
          if (e5 && n11) {
            const { caret: t10 } = e5, { caret: r9 } = n11;
            if (t10.isSameNodeCaret(r9)) return [dl(t10, r9.offset - t10.offset), null];
          }
          return [e5, n11];
        }
        iterNodeCarets(t9 = "root") {
          const e5 = nl(this.anchor) ? this.anchor.getSiblingCaret() : this.anchor.getLatest(), n11 = this.focus.getLatest(), r9 = nl(n11), i13 = (e6) => e6.isSameNodeCaret(n11) ? null : _l(e6) || e6.getParentCaret(t9);
          return vl({ hasNext: (t10) => null !== t10 && !(r9 && n11.isSameNodeCaret(t10)), initial: e5.isSameNodeCaret(n11) ? null : i13(e5), map: (t10) => t10, step: i13 });
        }
        [Symbol.iterator]() {
          return this.iterNodeCarets("root");
        }
      };
      yl = class {
        type = "slice";
        caret;
        distance;
        constructor(t9, e5) {
          this.caret = t9, this.distance = e5;
        }
        getSliceIndices() {
          const { distance: t9, caret: { offset: e5 } } = this, n11 = e5 + t9;
          return n11 < e5 ? [n11, e5] : [e5, n11];
        }
        getTextContent() {
          const [t9, e5] = this.getSliceIndices();
          return this.caret.origin.getTextContent().slice(t9, e5);
        }
        getTextContentSize() {
          return Math.abs(this.distance);
        }
        removeTextSlice() {
          const { caret: { origin: t9, direction: e5 } } = this, [n11, r9] = this.getSliceIndices(), i13 = t9.getTextContent();
          return ul(t9.setTextContent(i13.slice(0, n11) + i13.slice(r9)), e5, n11);
        }
      };
    }
  });

  // node_modules/lexical/Lexical.mjs
  var mod2, $addUpdateTag, $applyNodeReplacement, $caretFromPoint, $caretRangeFromSelection, $cloneWithProperties, $cloneWithPropertiesEphemeral, $comparePointCaretNext, $copyNode, $create, $createLineBreakNode, $createNodeSelection, $createParagraphNode, $createPoint, $createRangeSelection, $createRangeSelectionFromDom, $createTabNode, $createTextNode, $extendCaretToRange, $findMatchingParent, $getAdjacentChildCaret, $getAdjacentNode, $getAdjacentSiblingOrParentSiblingCaret, $getCaretInDirection, $getCaretRange, $getCaretRangeInDirection, $getCharacterOffsets, $getChildCaret, $getChildCaretAtIndex, $getChildCaretOrSelf, $getCollapsedCaretRange, $getCommonAncestor, $getCommonAncestorResultBranchOrder, $getEditor, $getNearestNodeFromDOMNode, $getNearestRootOrShadowRoot, $getNodeByKey, $getNodeByKeyOrThrow, $getNodeFromDOMNode, $getPreviousSelection, $getRoot, $getSelection, $getSiblingCaret, $getState, $getStateChange, $getTextContent, $getTextNodeOffset, $getTextPointCaret, $getTextPointCaretSlice, $getWritableNodeState, $hasAncestor, $hasUpdateTag, $insertNodes, $isBlockElementNode, $isChildCaret, $isDecoratorNode, $isEditorState, $isElementNode, $isExtendableTextPointCaret, $isInlineElementOrDecoratorNode, $isLeafNode, $isLineBreakNode, $isNodeCaret, $isNodeSelection, $isParagraphNode, $isRangeSelection, $isRootNode, $isRootOrShadowRoot, $isSiblingCaret, $isTabNode, $isTextNode, $isTextPointCaret, $isTextPointCaretSlice, $isTokenOrSegmented, $isTokenOrTab, $nodesOfType, $normalizeCaret, $normalizeSelection__EXPERIMENTAL, $onUpdate, $parseSerializedNode, $removeTextFromCaretRange, $rewindSiblingCaret, $selectAll, $setCompositionKey, $setPointFromCaret, $setSelection, $setSelectionFromCaretRange, $setState, $splitAtPointCaretNext, $splitNode, $updateRangeSelectionFromCaretRange, ArtificialNode__DO_NOT_USE, BEFORE_INPUT_COMMAND, BLUR_COMMAND, CAN_REDO_COMMAND, CAN_UNDO_COMMAND, CLEAR_EDITOR_COMMAND, CLEAR_HISTORY_COMMAND, CLICK_COMMAND, COLLABORATION_TAG, COMMAND_PRIORITY_CRITICAL, COMMAND_PRIORITY_EDITOR, COMMAND_PRIORITY_HIGH, COMMAND_PRIORITY_LOW, COMMAND_PRIORITY_NORMAL, COMPOSITION_END_COMMAND, COMPOSITION_START_COMMAND, CONTROLLED_TEXT_INSERTION_COMMAND, COPY_COMMAND, CUT_COMMAND, DELETE_CHARACTER_COMMAND, DELETE_LINE_COMMAND, DELETE_WORD_COMMAND, DRAGEND_COMMAND, DRAGOVER_COMMAND, DRAGSTART_COMMAND, DROP_COMMAND, DecoratorNode, ElementNode, FOCUS_COMMAND, FORMAT_ELEMENT_COMMAND, FORMAT_TEXT_COMMAND, HISTORIC_TAG, HISTORY_MERGE_TAG, HISTORY_PUSH_TAG, INDENT_CONTENT_COMMAND, INPUT_COMMAND, INSERT_LINE_BREAK_COMMAND, INSERT_PARAGRAPH_COMMAND, INSERT_TAB_COMMAND, INTERNAL_$isBlock, IS_ALL_FORMATTING, IS_BOLD, IS_CODE, IS_HIGHLIGHT, IS_ITALIC, IS_STRIKETHROUGH, IS_SUBSCRIPT, IS_SUPERSCRIPT, IS_UNDERLINE, KEY_ARROW_DOWN_COMMAND, KEY_ARROW_LEFT_COMMAND, KEY_ARROW_RIGHT_COMMAND, KEY_ARROW_UP_COMMAND, KEY_BACKSPACE_COMMAND, KEY_DELETE_COMMAND, KEY_DOWN_COMMAND, KEY_ENTER_COMMAND, KEY_ESCAPE_COMMAND, KEY_MODIFIER_COMMAND, KEY_SPACE_COMMAND, KEY_TAB_COMMAND, LineBreakNode, MOVE_TO_END, MOVE_TO_START, NODE_STATE_KEY, OUTDENT_CONTENT_COMMAND, PASTE_COMMAND, PASTE_TAG, ParagraphNode, REDO_COMMAND, REMOVE_TEXT_COMMAND, RootNode, SELECTION_CHANGE_COMMAND, SELECTION_INSERT_CLIPBOARD_NODES_COMMAND, SELECT_ALL_COMMAND, SKIP_COLLAB_TAG, SKIP_DOM_SELECTION_TAG, SKIP_SCROLL_INTO_VIEW_TAG, SKIP_SELECTION_FOCUS_TAG, TEXT_TYPE_TO_FORMAT, TabNode, TextNode, UNDO_COMMAND, buildImportMap, configExtension, createCommand, createEditor, createSharedNodeState, createState, declarePeerDependency, defineExtension, flipDirection, getDOMOwnerDocument, getDOMSelection, getDOMSelectionFromTarget, getDOMTextNode, getEditorPropertyFromDOMNode, getNearestEditorFromDOMNode, getRegisteredNode, getRegisteredNodeOrThrow, getStaticNodeConfig, getTextDirection, getTransformSetFromKlass, isBlockDomNode, isCurrentlyReadOnlyMode, isDOMDocumentNode, isDOMNode, isDOMTextNode, isDOMUnmanaged, isDocumentFragment, isExactShortcutMatch, isHTMLAnchorElement, isHTMLElement, isInlineDomNode, isLexicalEditor, isModifierMatch, isSelectionCapturedInDecoratorInput, isSelectionWithinEditor, makeStepwiseIterator, removeFromParent, resetRandomKey, safeCast, setDOMUnmanaged, setNodeIndentFromDOM, shallowMergeConfig;
  var init_Lexical = __esm({
    "node_modules/lexical/Lexical.mjs"() {
      init_Lexical_prod();
      mod2 = false ? Lexical_dev_exports : Lexical_prod_exports;
      $addUpdateTag = mod2.$addUpdateTag;
      $applyNodeReplacement = mod2.$applyNodeReplacement;
      $caretFromPoint = mod2.$caretFromPoint;
      $caretRangeFromSelection = mod2.$caretRangeFromSelection;
      $cloneWithProperties = mod2.$cloneWithProperties;
      $cloneWithPropertiesEphemeral = mod2.$cloneWithPropertiesEphemeral;
      $comparePointCaretNext = mod2.$comparePointCaretNext;
      $copyNode = mod2.$copyNode;
      $create = mod2.$create;
      $createLineBreakNode = mod2.$createLineBreakNode;
      $createNodeSelection = mod2.$createNodeSelection;
      $createParagraphNode = mod2.$createParagraphNode;
      $createPoint = mod2.$createPoint;
      $createRangeSelection = mod2.$createRangeSelection;
      $createRangeSelectionFromDom = mod2.$createRangeSelectionFromDom;
      $createTabNode = mod2.$createTabNode;
      $createTextNode = mod2.$createTextNode;
      $extendCaretToRange = mod2.$extendCaretToRange;
      $findMatchingParent = mod2.$findMatchingParent;
      $getAdjacentChildCaret = mod2.$getAdjacentChildCaret;
      $getAdjacentNode = mod2.$getAdjacentNode;
      $getAdjacentSiblingOrParentSiblingCaret = mod2.$getAdjacentSiblingOrParentSiblingCaret;
      $getCaretInDirection = mod2.$getCaretInDirection;
      $getCaretRange = mod2.$getCaretRange;
      $getCaretRangeInDirection = mod2.$getCaretRangeInDirection;
      $getCharacterOffsets = mod2.$getCharacterOffsets;
      $getChildCaret = mod2.$getChildCaret;
      $getChildCaretAtIndex = mod2.$getChildCaretAtIndex;
      $getChildCaretOrSelf = mod2.$getChildCaretOrSelf;
      $getCollapsedCaretRange = mod2.$getCollapsedCaretRange;
      $getCommonAncestor = mod2.$getCommonAncestor;
      $getCommonAncestorResultBranchOrder = mod2.$getCommonAncestorResultBranchOrder;
      $getEditor = mod2.$getEditor;
      $getNearestNodeFromDOMNode = mod2.$getNearestNodeFromDOMNode;
      $getNearestRootOrShadowRoot = mod2.$getNearestRootOrShadowRoot;
      $getNodeByKey = mod2.$getNodeByKey;
      $getNodeByKeyOrThrow = mod2.$getNodeByKeyOrThrow;
      $getNodeFromDOMNode = mod2.$getNodeFromDOMNode;
      $getPreviousSelection = mod2.$getPreviousSelection;
      $getRoot = mod2.$getRoot;
      $getSelection = mod2.$getSelection;
      $getSiblingCaret = mod2.$getSiblingCaret;
      $getState = mod2.$getState;
      $getStateChange = mod2.$getStateChange;
      $getTextContent = mod2.$getTextContent;
      $getTextNodeOffset = mod2.$getTextNodeOffset;
      $getTextPointCaret = mod2.$getTextPointCaret;
      $getTextPointCaretSlice = mod2.$getTextPointCaretSlice;
      $getWritableNodeState = mod2.$getWritableNodeState;
      $hasAncestor = mod2.$hasAncestor;
      $hasUpdateTag = mod2.$hasUpdateTag;
      $insertNodes = mod2.$insertNodes;
      $isBlockElementNode = mod2.$isBlockElementNode;
      $isChildCaret = mod2.$isChildCaret;
      $isDecoratorNode = mod2.$isDecoratorNode;
      $isEditorState = mod2.$isEditorState;
      $isElementNode = mod2.$isElementNode;
      $isExtendableTextPointCaret = mod2.$isExtendableTextPointCaret;
      $isInlineElementOrDecoratorNode = mod2.$isInlineElementOrDecoratorNode;
      $isLeafNode = mod2.$isLeafNode;
      $isLineBreakNode = mod2.$isLineBreakNode;
      $isNodeCaret = mod2.$isNodeCaret;
      $isNodeSelection = mod2.$isNodeSelection;
      $isParagraphNode = mod2.$isParagraphNode;
      $isRangeSelection = mod2.$isRangeSelection;
      $isRootNode = mod2.$isRootNode;
      $isRootOrShadowRoot = mod2.$isRootOrShadowRoot;
      $isSiblingCaret = mod2.$isSiblingCaret;
      $isTabNode = mod2.$isTabNode;
      $isTextNode = mod2.$isTextNode;
      $isTextPointCaret = mod2.$isTextPointCaret;
      $isTextPointCaretSlice = mod2.$isTextPointCaretSlice;
      $isTokenOrSegmented = mod2.$isTokenOrSegmented;
      $isTokenOrTab = mod2.$isTokenOrTab;
      $nodesOfType = mod2.$nodesOfType;
      $normalizeCaret = mod2.$normalizeCaret;
      $normalizeSelection__EXPERIMENTAL = mod2.$normalizeSelection__EXPERIMENTAL;
      $onUpdate = mod2.$onUpdate;
      $parseSerializedNode = mod2.$parseSerializedNode;
      $removeTextFromCaretRange = mod2.$removeTextFromCaretRange;
      $rewindSiblingCaret = mod2.$rewindSiblingCaret;
      $selectAll = mod2.$selectAll;
      $setCompositionKey = mod2.$setCompositionKey;
      $setPointFromCaret = mod2.$setPointFromCaret;
      $setSelection = mod2.$setSelection;
      $setSelectionFromCaretRange = mod2.$setSelectionFromCaretRange;
      $setState = mod2.$setState;
      $splitAtPointCaretNext = mod2.$splitAtPointCaretNext;
      $splitNode = mod2.$splitNode;
      $updateRangeSelectionFromCaretRange = mod2.$updateRangeSelectionFromCaretRange;
      ArtificialNode__DO_NOT_USE = mod2.ArtificialNode__DO_NOT_USE;
      BEFORE_INPUT_COMMAND = mod2.BEFORE_INPUT_COMMAND;
      BLUR_COMMAND = mod2.BLUR_COMMAND;
      CAN_REDO_COMMAND = mod2.CAN_REDO_COMMAND;
      CAN_UNDO_COMMAND = mod2.CAN_UNDO_COMMAND;
      CLEAR_EDITOR_COMMAND = mod2.CLEAR_EDITOR_COMMAND;
      CLEAR_HISTORY_COMMAND = mod2.CLEAR_HISTORY_COMMAND;
      CLICK_COMMAND = mod2.CLICK_COMMAND;
      COLLABORATION_TAG = mod2.COLLABORATION_TAG;
      COMMAND_PRIORITY_CRITICAL = mod2.COMMAND_PRIORITY_CRITICAL;
      COMMAND_PRIORITY_EDITOR = mod2.COMMAND_PRIORITY_EDITOR;
      COMMAND_PRIORITY_HIGH = mod2.COMMAND_PRIORITY_HIGH;
      COMMAND_PRIORITY_LOW = mod2.COMMAND_PRIORITY_LOW;
      COMMAND_PRIORITY_NORMAL = mod2.COMMAND_PRIORITY_NORMAL;
      COMPOSITION_END_COMMAND = mod2.COMPOSITION_END_COMMAND;
      COMPOSITION_START_COMMAND = mod2.COMPOSITION_START_COMMAND;
      CONTROLLED_TEXT_INSERTION_COMMAND = mod2.CONTROLLED_TEXT_INSERTION_COMMAND;
      COPY_COMMAND = mod2.COPY_COMMAND;
      CUT_COMMAND = mod2.CUT_COMMAND;
      DELETE_CHARACTER_COMMAND = mod2.DELETE_CHARACTER_COMMAND;
      DELETE_LINE_COMMAND = mod2.DELETE_LINE_COMMAND;
      DELETE_WORD_COMMAND = mod2.DELETE_WORD_COMMAND;
      DRAGEND_COMMAND = mod2.DRAGEND_COMMAND;
      DRAGOVER_COMMAND = mod2.DRAGOVER_COMMAND;
      DRAGSTART_COMMAND = mod2.DRAGSTART_COMMAND;
      DROP_COMMAND = mod2.DROP_COMMAND;
      DecoratorNode = mod2.DecoratorNode;
      ElementNode = mod2.ElementNode;
      FOCUS_COMMAND = mod2.FOCUS_COMMAND;
      FORMAT_ELEMENT_COMMAND = mod2.FORMAT_ELEMENT_COMMAND;
      FORMAT_TEXT_COMMAND = mod2.FORMAT_TEXT_COMMAND;
      HISTORIC_TAG = mod2.HISTORIC_TAG;
      HISTORY_MERGE_TAG = mod2.HISTORY_MERGE_TAG;
      HISTORY_PUSH_TAG = mod2.HISTORY_PUSH_TAG;
      INDENT_CONTENT_COMMAND = mod2.INDENT_CONTENT_COMMAND;
      INPUT_COMMAND = mod2.INPUT_COMMAND;
      INSERT_LINE_BREAK_COMMAND = mod2.INSERT_LINE_BREAK_COMMAND;
      INSERT_PARAGRAPH_COMMAND = mod2.INSERT_PARAGRAPH_COMMAND;
      INSERT_TAB_COMMAND = mod2.INSERT_TAB_COMMAND;
      INTERNAL_$isBlock = mod2.INTERNAL_$isBlock;
      IS_ALL_FORMATTING = mod2.IS_ALL_FORMATTING;
      IS_BOLD = mod2.IS_BOLD;
      IS_CODE = mod2.IS_CODE;
      IS_HIGHLIGHT = mod2.IS_HIGHLIGHT;
      IS_ITALIC = mod2.IS_ITALIC;
      IS_STRIKETHROUGH = mod2.IS_STRIKETHROUGH;
      IS_SUBSCRIPT = mod2.IS_SUBSCRIPT;
      IS_SUPERSCRIPT = mod2.IS_SUPERSCRIPT;
      IS_UNDERLINE = mod2.IS_UNDERLINE;
      KEY_ARROW_DOWN_COMMAND = mod2.KEY_ARROW_DOWN_COMMAND;
      KEY_ARROW_LEFT_COMMAND = mod2.KEY_ARROW_LEFT_COMMAND;
      KEY_ARROW_RIGHT_COMMAND = mod2.KEY_ARROW_RIGHT_COMMAND;
      KEY_ARROW_UP_COMMAND = mod2.KEY_ARROW_UP_COMMAND;
      KEY_BACKSPACE_COMMAND = mod2.KEY_BACKSPACE_COMMAND;
      KEY_DELETE_COMMAND = mod2.KEY_DELETE_COMMAND;
      KEY_DOWN_COMMAND = mod2.KEY_DOWN_COMMAND;
      KEY_ENTER_COMMAND = mod2.KEY_ENTER_COMMAND;
      KEY_ESCAPE_COMMAND = mod2.KEY_ESCAPE_COMMAND;
      KEY_MODIFIER_COMMAND = mod2.KEY_MODIFIER_COMMAND;
      KEY_SPACE_COMMAND = mod2.KEY_SPACE_COMMAND;
      KEY_TAB_COMMAND = mod2.KEY_TAB_COMMAND;
      LineBreakNode = mod2.LineBreakNode;
      MOVE_TO_END = mod2.MOVE_TO_END;
      MOVE_TO_START = mod2.MOVE_TO_START;
      NODE_STATE_KEY = mod2.NODE_STATE_KEY;
      OUTDENT_CONTENT_COMMAND = mod2.OUTDENT_CONTENT_COMMAND;
      PASTE_COMMAND = mod2.PASTE_COMMAND;
      PASTE_TAG = mod2.PASTE_TAG;
      ParagraphNode = mod2.ParagraphNode;
      REDO_COMMAND = mod2.REDO_COMMAND;
      REMOVE_TEXT_COMMAND = mod2.REMOVE_TEXT_COMMAND;
      RootNode = mod2.RootNode;
      SELECTION_CHANGE_COMMAND = mod2.SELECTION_CHANGE_COMMAND;
      SELECTION_INSERT_CLIPBOARD_NODES_COMMAND = mod2.SELECTION_INSERT_CLIPBOARD_NODES_COMMAND;
      SELECT_ALL_COMMAND = mod2.SELECT_ALL_COMMAND;
      SKIP_COLLAB_TAG = mod2.SKIP_COLLAB_TAG;
      SKIP_DOM_SELECTION_TAG = mod2.SKIP_DOM_SELECTION_TAG;
      SKIP_SCROLL_INTO_VIEW_TAG = mod2.SKIP_SCROLL_INTO_VIEW_TAG;
      SKIP_SELECTION_FOCUS_TAG = mod2.SKIP_SELECTION_FOCUS_TAG;
      TEXT_TYPE_TO_FORMAT = mod2.TEXT_TYPE_TO_FORMAT;
      TabNode = mod2.TabNode;
      TextNode = mod2.TextNode;
      UNDO_COMMAND = mod2.UNDO_COMMAND;
      buildImportMap = mod2.buildImportMap;
      configExtension = mod2.configExtension;
      createCommand = mod2.createCommand;
      createEditor = mod2.createEditor;
      createSharedNodeState = mod2.createSharedNodeState;
      createState = mod2.createState;
      declarePeerDependency = mod2.declarePeerDependency;
      defineExtension = mod2.defineExtension;
      flipDirection = mod2.flipDirection;
      getDOMOwnerDocument = mod2.getDOMOwnerDocument;
      getDOMSelection = mod2.getDOMSelection;
      getDOMSelectionFromTarget = mod2.getDOMSelectionFromTarget;
      getDOMTextNode = mod2.getDOMTextNode;
      getEditorPropertyFromDOMNode = mod2.getEditorPropertyFromDOMNode;
      getNearestEditorFromDOMNode = mod2.getNearestEditorFromDOMNode;
      getRegisteredNode = mod2.getRegisteredNode;
      getRegisteredNodeOrThrow = mod2.getRegisteredNodeOrThrow;
      getStaticNodeConfig = mod2.getStaticNodeConfig;
      getTextDirection = mod2.getTextDirection;
      getTransformSetFromKlass = mod2.getTransformSetFromKlass;
      isBlockDomNode = mod2.isBlockDomNode;
      isCurrentlyReadOnlyMode = mod2.isCurrentlyReadOnlyMode;
      isDOMDocumentNode = mod2.isDOMDocumentNode;
      isDOMNode = mod2.isDOMNode;
      isDOMTextNode = mod2.isDOMTextNode;
      isDOMUnmanaged = mod2.isDOMUnmanaged;
      isDocumentFragment = mod2.isDocumentFragment;
      isExactShortcutMatch = mod2.isExactShortcutMatch;
      isHTMLAnchorElement = mod2.isHTMLAnchorElement;
      isHTMLElement = mod2.isHTMLElement;
      isInlineDomNode = mod2.isInlineDomNode;
      isLexicalEditor = mod2.isLexicalEditor;
      isModifierMatch = mod2.isModifierMatch;
      isSelectionCapturedInDecoratorInput = mod2.isSelectionCapturedInDecoratorInput;
      isSelectionWithinEditor = mod2.isSelectionWithinEditor;
      makeStepwiseIterator = mod2.makeStepwiseIterator;
      removeFromParent = mod2.removeFromParent;
      resetRandomKey = mod2.resetRandomKey;
      safeCast = mod2.safeCast;
      setDOMUnmanaged = mod2.setDOMUnmanaged;
      setNodeIndentFromDOM = mod2.setNodeIndentFromDOM;
      shallowMergeConfig = mod2.shallowMergeConfig;
    }
  });

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
  function K2(e5, ...t9) {
    const n11 = new URL("https://lexical.dev/docs/error"), o8 = new URLSearchParams();
    o8.append("code", e5);
    for (const e6 of t9) o8.append("v", e6);
    throw n11.search = o8.toString(), Error(`Minified Lexical error #${e5}; visit ${n11.toString()} for the full message or use the non-minified dev environment for full errors and additional helpful warnings.`);
  }
  function P2(e5) {
    let t9 = e5;
    for (; null != t9; ) {
      if (t9.nodeType === Node.TEXT_NODE) return t9;
      t9 = t9.firstChild;
    }
    return null;
  }
  function k2(e5) {
    const t9 = e5.parentNode;
    if (null == t9) throw new Error("Should never happen");
    return [t9, Array.from(t9.childNodes).indexOf(e5)];
  }
  function I2(t9, n11, o8, l8, r9) {
    const s7 = n11.getKey(), i13 = l8.getKey(), c10 = document.createRange();
    let f8 = t9.getElementByKey(s7), u10 = t9.getElementByKey(i13), g5 = o8, a10 = r9;
    if ($isTextNode(n11) && (f8 = P2(f8)), $isTextNode(l8) && (u10 = P2(u10)), void 0 === n11 || void 0 === l8 || null === f8 || null === u10) return null;
    "BR" === f8.nodeName && ([f8, g5] = k2(f8)), "BR" === u10.nodeName && ([u10, a10] = k2(u10));
    const d8 = f8.firstChild;
    f8 === u10 && null != d8 && "BR" === d8.nodeName && 0 === g5 && 0 === a10 && (a10 = 1);
    try {
      c10.setStart(f8, g5), c10.setEnd(u10, a10);
    } catch (e5) {
      return null;
    }
    return !c10.collapsed || g5 === a10 && s7 === i13 || (c10.setStart(u10, a10), c10.setEnd(f8, g5)), c10;
  }
  function B2(e5, t9) {
    const n11 = e5.getRootElement();
    if (null === n11) return [];
    const o8 = n11.getBoundingClientRect(), l8 = getComputedStyle(n11), r9 = parseFloat(l8.paddingLeft) + parseFloat(l8.paddingRight), s7 = Array.from(t9.getClientRects());
    let i13, c10 = s7.length;
    s7.sort((e6, t10) => {
      const n12 = e6.top - t10.top;
      return Math.abs(n12) <= 3 ? e6.left - t10.left : n12;
    });
    for (let e6 = 0; e6 < c10; e6++) {
      const t10 = s7[e6], n12 = i13 && i13.top <= t10.top && i13.top + i13.height > t10.top && i13.left + i13.width > t10.left, l9 = t10.width + r9 === o8.width;
      n12 || l9 ? (s7.splice(e6--, 1), c10--) : i13 = t10;
    }
    return s7;
  }
  function F2(e5) {
    const t9 = {};
    if (!e5) return t9;
    const n11 = e5.split(";");
    for (const e6 of n11) if ("" !== e6) {
      const [n12, o8] = e6.split(/:([^]+)/);
      n12 && o8 && (t9[n12.trim()] = o8.trim());
    }
    return t9;
  }
  function b2(e5) {
    let t9 = E2.get(e5);
    return void 0 === t9 && (t9 = F2(e5), E2.set(e5, t9)), t9;
  }
  function R2(e5) {
    let t9 = "";
    for (const n11 in e5) n11 && (t9 += `${n11}: ${e5[n11]};`);
    return t9;
  }
  function z2(e5) {
    const n11 = $getEditor().getElementByKey(e5.getKey());
    if (null === n11) return null;
    const o8 = n11.ownerDocument.defaultView;
    return null === o8 ? null : o8.getComputedStyle(n11);
  }
  function O2(e5) {
    return z2($isRootNode(e5) ? e5 : e5.getParentOrThrow());
  }
  function A2(e5) {
    const t9 = O2(e5);
    return null !== t9 && "rtl" === t9.direction;
  }
  function M2(e5, t9, n11 = "self") {
    const o8 = e5.getStartEndPoints();
    if (t9.isSelected(e5) && !$isTokenOrSegmented(t9) && null !== o8) {
      const [l8, r9] = o8, s7 = e5.isBackward(), i13 = l8.getNode(), c10 = r9.getNode(), f8 = t9.is(i13), u10 = t9.is(c10);
      if (f8 || u10) {
        const [o9, l9] = $getCharacterOffsets(e5), r10 = i13.is(c10), f9 = t9.is(s7 ? c10 : i13), u11 = t9.is(s7 ? i13 : c10);
        let d8, p7 = 0;
        if (r10) p7 = o9 > l9 ? l9 : o9, d8 = o9 > l9 ? o9 : l9;
        else if (f9) {
          p7 = s7 ? l9 : o9, d8 = void 0;
        } else if (u11) {
          p7 = 0, d8 = s7 ? o9 : l9;
        }
        const h3 = t9.__text.slice(p7, d8);
        h3 !== t9.__text && ("clone" === n11 && (t9 = $cloneWithPropertiesEphemeral(t9)), t9.__text = h3);
      }
    }
    return t9;
  }
  function _2(e5) {
    if ("text" === e5.type) return e5.offset === e5.getNode().getTextContentSize();
    const t9 = e5.getNode();
    return $isElementNode(t9) || K2(177), e5.offset === t9.getChildrenSize();
  }
  function L2(t9, c10, f8) {
    let u10 = c10.getNode(), g5 = f8;
    if ($isElementNode(u10)) {
      const e5 = u10.getDescendantByIndex(c10.offset);
      null !== e5 && (u10 = e5);
    }
    for (; g5 > 0 && null !== u10; ) {
      if ($isElementNode(u10)) {
        const e5 = u10.getLastDescendant();
        null !== e5 && (u10 = e5);
      }
      let f9 = u10.getPreviousSibling(), a10 = 0;
      if (null === f9) {
        let e5 = u10.getParentOrThrow(), t10 = e5.getPreviousSibling();
        for (; null === t10; ) {
          if (e5 = e5.getParent(), null === e5) {
            f9 = null;
            break;
          }
          t10 = e5.getPreviousSibling();
        }
        null !== e5 && (a10 = e5.isInline() ? 0 : 2, f9 = t10);
      }
      let d8 = u10.getTextContent();
      "" === d8 && $isElementNode(u10) && !u10.isInline() && (d8 = "\n\n");
      const p7 = d8.length;
      if (!$isTextNode(u10) || g5 >= p7) {
        const e5 = u10.getParent();
        u10.remove(), null == e5 || 0 !== e5.getChildrenSize() || $isRootNode(e5) || e5.remove(), g5 -= p7 + a10, u10 = f9;
      } else {
        const n11 = u10.getKey(), o8 = t9.getEditorState().read(() => {
          const t10 = $getNodeByKey(n11);
          return $isTextNode(t10) && t10.isSimpleText() ? t10.getTextContent() : null;
        }), f10 = p7 - g5, a11 = d8.slice(0, f10);
        if (null !== o8 && o8 !== d8) {
          const e5 = $getPreviousSelection();
          let t10 = u10;
          if (u10.isSimpleText()) u10.setTextContent(o8);
          else {
            const e6 = $createTextNode(o8);
            u10.replace(e6), t10 = e6;
          }
          if ($isRangeSelection(e5) && e5.isCollapsed()) {
            const n12 = e5.anchor.offset;
            t10.select(n12, n12);
          }
        } else if (u10.isSimpleText()) {
          const e5 = c10.key === n11;
          let t10 = c10.offset;
          t10 < g5 && (t10 = p7);
          const o9 = e5 ? t10 - g5 : 0, l8 = e5 ? t10 : f10;
          if (e5 && 0 === o9) {
            const [e6] = u10.splitText(o9, l8);
            e6.remove();
          } else {
            const [, e6] = u10.splitText(o9, l8);
            e6.remove();
          }
        } else {
          const e5 = $createTextNode(a11);
          u10.replace(e5);
        }
        g5 = 0;
      }
    }
  }
  function $2(e5) {
    const t9 = e5.getStyle(), n11 = F2(t9);
    E2.set(t9, n11);
  }
  function D2(t9, n11) {
    ($isRangeSelection(t9) ? t9.isCollapsed() : $isTextNode(t9) || $isElementNode(t9)) || K2(280);
    const l8 = b2($isRangeSelection(t9) ? t9.style : $isTextNode(t9) ? t9.getStyle() : t9.getTextStyle()), r9 = Object.entries(n11).reduce((e5, [n12, o8]) => ("function" == typeof o8 ? e5[n12] = o8(l8[n12], t9) : null === o8 ? delete e5[n12] : e5[n12] = o8, e5), { ...l8 }), s7 = R2(r9);
    $isRangeSelection(t9) || $isTextNode(t9) ? t9.setStyle(s7) : t9.setTextStyle(s7), E2.set(s7, r9);
  }
  function U2(e5, t9) {
    if ($isRangeSelection(e5) && e5.isCollapsed()) {
      D2(e5, t9);
      const n12 = e5.anchor.getNode();
      $isElementNode(n12) && n12.isEmpty() && D2(n12, t9);
    }
    j2((e6) => {
      D2(e6, t9);
    });
    const n11 = e5.getNodes();
    if (n11.length > 0) {
      const e6 = /* @__PURE__ */ new Set();
      for (const l8 of n11) {
        if (!$isElementNode(l8) || !l8.canBeEmpty() || 0 !== l8.getChildrenSize()) continue;
        const n12 = l8.getKey();
        e6.has(n12) || (e6.add(n12), D2(l8, t9));
      }
    }
  }
  function j2(t9) {
    const n11 = $getSelection();
    if (!n11) return;
    const o8 = /* @__PURE__ */ new Map(), l8 = (e5) => o8.get(e5.getKey()) || [0, e5.getTextContentSize()];
    if ($isRangeSelection(n11)) for (const e5 of $caretRangeFromSelection(n11).getTextSlices()) e5 && o8.set(e5.caret.origin.getKey(), e5.getSliceIndices());
    const r9 = n11.getNodes();
    for (const n12 of r9) {
      if (!$isTextNode(n12) || !n12.canHaveFormat()) continue;
      const [o9, r10] = l8(n12);
      if (r10 !== o9) if ($isTokenOrSegmented(n12) || 0 === o9 && r10 === n12.getTextContentSize()) t9(n12);
      else {
        t9(n12.splitText(o9, r10)[0 === o9 ? 0 : 1]);
      }
    }
    $isRangeSelection(n11) && "text" === n11.anchor.type && "text" === n11.focus.type && n11.anchor.key === n11.focus.key && H2(n11);
  }
  function H2(e5) {
    if (e5.isBackward()) {
      const { anchor: t9, focus: n11 } = e5, { key: o8, offset: l8, type: r9 } = t9;
      t9.set(n11.key, n11.offset, n11.type), n11.set(o8, l8, r9);
    }
  }
  function V2(e5, t9) {
    const n11 = e5.getFormatType(), o8 = e5.getIndent();
    n11 !== t9.getFormatType() && t9.setFormat(n11), o8 !== t9.getIndent() && t9.setIndent(o8);
  }
  function W2(e5, t9, n11 = V2) {
    if (null === e5) return;
    const l8 = e5.getStartEndPoints(), r9 = /* @__PURE__ */ new Map();
    let s7 = null;
    if (l8) {
      const [e6, t10] = l8;
      s7 = $createRangeSelection(), s7.anchor.set(e6.key, e6.offset, e6.type), s7.focus.set(t10.key, t10.offset, t10.type);
      const n12 = $findMatchingParent(e6.getNode(), INTERNAL_$isBlock), i13 = $findMatchingParent(t10.getNode(), INTERNAL_$isBlock);
      $isElementNode(n12) && r9.set(n12.getKey(), n12), $isElementNode(i13) && r9.set(i13.getKey(), i13);
    }
    for (const t10 of e5.getNodes()) if ($isElementNode(t10) && INTERNAL_$isBlock(t10)) r9.set(t10.getKey(), t10);
    else if (null === l8) {
      const e6 = $findMatchingParent(t10, INTERNAL_$isBlock);
      $isElementNode(e6) && r9.set(e6.getKey(), e6);
    }
    for (const [e6, o8] of r9) {
      const l9 = t9();
      n11(o8, l9), o8.replace(l9, true), s7 && (e6 === s7.anchor.key && s7.anchor.set(l9.getKey(), s7.anchor.offset, s7.anchor.type), e6 === s7.focus.key && s7.focus.set(l9.getKey(), s7.focus.offset, s7.focus.type));
    }
    s7 && e5.is($getSelection()) && $setSelection(s7);
  }
  function X2(e5) {
    return e5.getNode().isAttached();
  }
  function q2(e5) {
    let t9 = e5;
    for (; null !== t9 && !$isRootOrShadowRoot(t9); ) {
      const e6 = t9.getLatest(), n11 = t9.getParent();
      0 === e6.getChildrenSize() && t9.remove(true), t9 = n11;
    }
  }
  function G2(e5, t9, n11 = null) {
    const o8 = e5.getStartEndPoints(), l8 = o8 ? o8[0] : null, r9 = e5.getNodes(), s7 = r9.length;
    if (null !== l8 && (0 === s7 || 1 === s7 && "element" === l8.type && 0 === l8.getNode().getChildrenSize())) {
      const e6 = "text" === l8.type ? l8.getNode().getParentOrThrow() : l8.getNode(), o9 = e6.getChildren();
      let r10 = t9();
      return r10.setFormat(e6.getFormatType()), r10.setIndent(e6.getIndent()), o9.forEach((e7) => r10.append(e7)), n11 && (r10 = n11.append(r10)), void e6.replace(r10);
    }
    let i13 = null, c10 = [];
    for (let o9 = 0; o9 < s7; o9++) {
      const l9 = r9[o9];
      $isRootOrShadowRoot(l9) ? (J2(e5, c10, c10.length, t9, n11), c10 = [], i13 = l9) : null === i13 || null !== i13 && $hasAncestor(l9, i13) ? c10.push(l9) : (J2(e5, c10, c10.length, t9, n11), c10 = [l9]);
    }
    J2(e5, c10, c10.length, t9, n11);
  }
  function J2(e5, t9, n11, l8, s7 = null) {
    if (0 === t9.length) return;
    const c10 = t9[0], f8 = /* @__PURE__ */ new Map(), u10 = [];
    let g5 = $isElementNode(c10) ? c10 : c10.getParentOrThrow();
    g5.isInline() && (g5 = g5.getParentOrThrow());
    let a10 = false;
    for (; null !== g5; ) {
      const e6 = g5.getPreviousSibling();
      if (null !== e6) {
        g5 = e6, a10 = true;
        break;
      }
      if (g5 = g5.getParentOrThrow(), $isRootOrShadowRoot(g5)) break;
    }
    const d8 = /* @__PURE__ */ new Set();
    for (let e6 = 0; e6 < n11; e6++) {
      const n12 = t9[e6];
      $isElementNode(n12) && 0 === n12.getChildrenSize() && d8.add(n12.getKey());
    }
    const p7 = /* @__PURE__ */ new Set();
    for (let e6 = 0; e6 < n11; e6++) {
      const n12 = t9[e6];
      let r9 = n12.getParent();
      if (null !== r9 && r9.isInline() && (r9 = r9.getParent()), null !== r9 && $isLeafNode(n12) && !p7.has(n12.getKey())) {
        const e7 = r9.getKey();
        if (void 0 === f8.get(e7)) {
          const t10 = l8();
          t10.setFormat(r9.getFormatType()), t10.setIndent(r9.getIndent()), u10.push(t10), f8.set(e7, t10), r9.getChildren().forEach((e8) => {
            t10.append(e8), p7.add(e8.getKey()), $isElementNode(e8) && e8.getChildrenKeys().forEach((e9) => p7.add(e9));
          }), q2(r9);
        }
      } else if (d8.has(n12.getKey())) {
        $isElementNode(n12) || K2(179);
        const e7 = l8();
        e7.setFormat(n12.getFormatType()), e7.setIndent(n12.getIndent()), u10.push(e7), n12.remove(true);
      }
    }
    if (null !== s7) for (let e6 = 0; e6 < u10.length; e6++) {
      const t10 = u10[e6];
      s7.append(t10);
    }
    let h3 = null;
    if ($isRootOrShadowRoot(g5)) if (a10) if (null !== s7) g5.insertAfter(s7);
    else for (let e6 = u10.length - 1; e6 >= 0; e6--) {
      const t10 = u10[e6];
      g5.insertAfter(t10);
    }
    else {
      const e6 = g5.getFirstChild();
      if ($isElementNode(e6) && (g5 = e6), null === e6) if (s7) g5.append(s7);
      else for (let e7 = 0; e7 < u10.length; e7++) {
        const t10 = u10[e7];
        g5.append(t10), h3 = t10;
      }
      else if (null !== s7) e6.insertBefore(s7);
      else for (let t10 = 0; t10 < u10.length; t10++) {
        const n12 = u10[t10];
        e6.insertBefore(n12), h3 = n12;
      }
    }
    else if (s7) g5.insertAfter(s7);
    else for (let e6 = u10.length - 1; e6 >= 0; e6--) {
      const t10 = u10[e6];
      g5.insertAfter(t10), h3 = t10;
    }
    const m9 = $getPreviousSelection();
    $isRangeSelection(m9) && X2(m9.anchor) && X2(m9.focus) ? $setSelection(m9.clone()) : null !== h3 ? h3.selectEnd() : e5.dirty = true;
  }
  function Q2(e5) {
    const t9 = Y2(e5);
    return null !== t9 && "vertical-rl" === t9.writingMode;
  }
  function Y2(e5) {
    const t9 = e5.anchor.getNode();
    return $isElementNode(t9) ? z2(t9) : O2(t9);
  }
  function Z2(e5, t9) {
    let n11 = Q2(e5) ? !t9 : t9;
    te2(e5) && (n11 = !n11);
    const l8 = $caretFromPoint(e5.focus, n11 ? "previous" : "next");
    if ($isExtendableTextPointCaret(l8)) return false;
    for (const e6 of $extendCaretToRange(l8)) {
      if ($isChildCaret(e6)) return !e6.origin.isInline();
      if (!$isElementNode(e6.origin)) {
        if ($isDecoratorNode(e6.origin)) return true;
        break;
      }
    }
    return false;
  }
  function ee2(e5, t9, n11, o8) {
    e5.modify(t9 ? "extend" : "move", n11, o8);
  }
  function te2(e5) {
    const t9 = Y2(e5);
    return null !== t9 && "rtl" === t9.direction;
  }
  function ne2(e5, t9, n11) {
    const o8 = te2(e5);
    let l8;
    l8 = Q2(e5) || o8 ? !n11 : n11, ee2(e5, t9, l8, "character");
  }
  function oe2(e5, t9, n11) {
    const o8 = b2(e5.getStyle());
    return null !== o8 && o8[t9] || n11;
  }
  function le2(t9, n11, o8 = "") {
    let l8 = null;
    const r9 = t9.getNodes(), s7 = t9.anchor, c10 = t9.focus, f8 = t9.isBackward(), u10 = f8 ? c10.offset : s7.offset, g5 = f8 ? c10.getNode() : s7.getNode();
    if ($isRangeSelection(t9) && t9.isCollapsed() && "" !== t9.style) {
      const e5 = b2(t9.style);
      if (null !== e5 && n11 in e5) return e5[n11];
    }
    for (let t10 = 0; t10 < r9.length; t10++) {
      const s8 = r9[t10];
      if ((0 === t10 || 0 !== u10 || !s8.is(g5)) && $isTextNode(s8)) {
        const e5 = oe2(s8, n11, o8);
        if (null === l8) l8 = e5;
        else if (l8 !== e5) {
          l8 = "";
          break;
        }
      }
    }
    return null === l8 ? o8 : l8;
  }
  var E2, re2;
  var init_LexicalSelection_prod = __esm({
    "node_modules/@lexical/selection/LexicalSelection.prod.mjs"() {
      init_Lexical();
      init_Lexical();
      E2 = /* @__PURE__ */ new Map();
      re2 = L2;
    }
  });

  // node_modules/@lexical/selection/LexicalSelection.mjs
  var mod5, $addNodeStyle, $cloneWithProperties2, $copyBlockFormatIndent, $ensureForwardRangeSelection, $forEachSelectedTextNode, $getComputedStyleForElement, $getComputedStyleForParent, $getSelectionStyleValueForProperty, $isAtNodeEnd, $isParentElementRTL, $isParentRTL, $moveCaretSelection, $moveCharacter, $patchStyleText, $selectAll2, $setBlocksType, $shouldOverrideDefaultCharacterSelection, $sliceSelectedTextNodeContent, $trimTextContentFromAnchor, $wrapNodes, createDOMRange, createRectsFromDOMRange, getCSSFromStyleObject, getStyleObjectFromCSS, trimTextContentFromAnchor;
  var init_LexicalSelection = __esm({
    "node_modules/@lexical/selection/LexicalSelection.mjs"() {
      init_LexicalSelection_prod();
      mod5 = false ? LexicalSelection_dev_exports : LexicalSelection_prod_exports;
      $addNodeStyle = mod5.$addNodeStyle;
      $cloneWithProperties2 = mod5.$cloneWithProperties;
      $copyBlockFormatIndent = mod5.$copyBlockFormatIndent;
      $ensureForwardRangeSelection = mod5.$ensureForwardRangeSelection;
      $forEachSelectedTextNode = mod5.$forEachSelectedTextNode;
      $getComputedStyleForElement = mod5.$getComputedStyleForElement;
      $getComputedStyleForParent = mod5.$getComputedStyleForParent;
      $getSelectionStyleValueForProperty = mod5.$getSelectionStyleValueForProperty;
      $isAtNodeEnd = mod5.$isAtNodeEnd;
      $isParentElementRTL = mod5.$isParentElementRTL;
      $isParentRTL = mod5.$isParentRTL;
      $moveCaretSelection = mod5.$moveCaretSelection;
      $moveCharacter = mod5.$moveCharacter;
      $patchStyleText = mod5.$patchStyleText;
      $selectAll2 = mod5.$selectAll;
      $setBlocksType = mod5.$setBlocksType;
      $shouldOverrideDefaultCharacterSelection = mod5.$shouldOverrideDefaultCharacterSelection;
      $sliceSelectedTextNodeContent = mod5.$sliceSelectedTextNodeContent;
      $trimTextContentFromAnchor = mod5.$trimTextContentFromAnchor;
      $wrapNodes = mod5.$wrapNodes;
      createDOMRange = mod5.createDOMRange;
      createRectsFromDOMRange = mod5.createRectsFromDOMRange;
      getCSSFromStyleObject = mod5.getCSSFromStyleObject;
      getStyleObjectFromCSS = mod5.getStyleObjectFromCSS;
      trimTextContentFromAnchor = mod5.trimTextContentFromAnchor;
    }
  });

  // react-dom-global:react-dom
  var require_react_dom = __commonJS({
    "react-dom-global:react-dom"(exports, module) {
      var ReactDOM2 = window.ReactDOM;
      if (!ReactDOM2) {
        console.error("[LexicalPlayground] ReactDOM not found. Ensure react-dom.min.js is loaded first.");
      }
      module.exports = ReactDOM2;
    }
  });

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
            type: function(o8) {
              return Object.prototype.toString.call(o8).slice(8, -1);
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
            clone: function deepClone(o8, visited) {
              visited = visited || {};
              var clone;
              var id;
              switch (_5.util.type(o8)) {
                case "Object":
                  id = _5.util.objId(o8);
                  if (visited[id]) {
                    return visited[id];
                  }
                  clone = /** @type {Record<string, any>} */
                  {};
                  visited[id] = clone;
                  for (var key in o8) {
                    if (o8.hasOwnProperty(key)) {
                      clone[key] = deepClone(o8[key], visited);
                    }
                  }
                  return (
                    /** @type {any} */
                    clone
                  );
                case "Array":
                  id = _5.util.objId(o8);
                  if (visited[id]) {
                    return visited[id];
                  }
                  clone = [];
                  visited[id] = clone;
                  /** @type {Array} */
                  /** @type {any} */
                  o8.forEach(function(v6, i13) {
                    clone[i13] = deepClone(v6, visited);
                  });
                  return (
                    /** @type {any} */
                    clone
                  );
                default:
                  return o8;
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
                var m9 = lang.exec(element.className);
                if (m9) {
                  return m9[1].toLowerCase();
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
                  for (var i13 in scripts) {
                    if (scripts[i13].src == src) {
                      return scripts[i13];
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
            DFS: function DFS(o8, callback, type, visited) {
              visited = visited || {};
              var objId = _5.util.objId;
              for (var i13 in o8) {
                if (o8.hasOwnProperty(i13)) {
                  callback.call(o8, i13, o8[i13], type || i13);
                  var property = o8[i13];
                  var propertyType = _5.util.type(property);
                  if (propertyType === "Object" && !visited[objId(property)]) {
                    visited[objId(property)] = true;
                    DFS(property, callback, null, visited);
                  } else if (propertyType === "Array" && !visited[objId(property)]) {
                    visited[objId(property)] = true;
                    DFS(property, callback, i13, visited);
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
            for (var i13 = 0, element; element = env.elements[i13++]; ) {
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
              for (var i13 = 0, callback; callback = callbacks[i13++]; ) {
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
        Token.stringify = function stringify(o8, language) {
          if (typeof o8 == "string") {
            return o8;
          }
          if (Array.isArray(o8)) {
            var s7 = "";
            o8.forEach(function(e5) {
              s7 += stringify(e5, language);
            });
            return s7;
          }
          var env = {
            type: o8.type,
            content: stringify(o8.content, language),
            tag: "span",
            classes: ["token", o8.type],
            attributes: {},
            language
          };
          var aliases = o8.alias;
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
                  var p7 = pos;
                  p7 += currentNode.value.length;
                  while (from >= p7) {
                    currentNode = currentNode.next;
                    p7 += currentNode.value.length;
                  }
                  p7 -= currentNode.value.length;
                  pos = p7;
                  if (currentNode.value instanceof Token) {
                    continue;
                  }
                  for (var k4 = currentNode; k4 !== tokenList.tail && (p7 < to2 || typeof k4.value === "string"); k4 = k4.next) {
                    removeCount++;
                    p7 += k4.value.length;
                  }
                  removeCount--;
                  str = text.slice(pos, p7);
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
          for (var i13 = 0; i13 < count && next !== list.tail; i13++) {
            next = next.next;
          }
          node.next = next;
          next.prev = node;
          list.length -= i13;
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
          var m9 = /^\s*(\d+)\s*(?:(,)\s*(?:(\d+)\s*)?)?$/.exec(range || "");
          if (m9) {
            var start = Number(m9[1]);
            var comma = m9[2];
            var end = m9[3];
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
            for (var i13 = 0, element; element = elements[i13++]; ) {
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

  // yjs-global:yjs
  var Y9, Doc, Map2, Array2, Text2, XmlFragment, XmlElement, XmlText, UndoManager, createAbsolutePositionFromRelativePosition, createRelativePositionFromTypeIndex, encodeStateAsUpdate, applyUpdate, Snapshot, snapshot, isDeleted, isParentOf, equalSnapshots, AbstractType, RelativePosition, Item, ContentType, Transaction, AbstractStruct, GC, typeListToArraySnapshot, XmlHook, ContentString, ContentFormat, emptySnapshot, PermanentUserData, iterateDeletedStructs, compareRelativePositions, YMapEvent, YTextEvent, YXmlEvent;
  var init_yjs = __esm({
    "yjs-global:yjs"() {
      Y9 = window.Y;
      if (!Y9) {
        console.error("[LexicalPlayground] Yjs not found. Ensure yjs.min.js is loaded first.");
      }
      Doc = Y9?.Doc;
      Map2 = Y9?.Map;
      Array2 = Y9?.Array;
      Text2 = Y9?.Text;
      XmlFragment = Y9?.XmlFragment;
      XmlElement = Y9?.XmlElement;
      XmlText = Y9?.XmlText;
      UndoManager = Y9?.UndoManager;
      createAbsolutePositionFromRelativePosition = Y9?.createAbsolutePositionFromRelativePosition;
      createRelativePositionFromTypeIndex = Y9?.createRelativePositionFromTypeIndex;
      encodeStateAsUpdate = Y9?.encodeStateAsUpdate;
      applyUpdate = Y9?.applyUpdate;
      Snapshot = Y9?.Snapshot;
      snapshot = Y9?.snapshot;
      isDeleted = Y9?.isDeleted;
      isParentOf = Y9?.isParentOf;
      equalSnapshots = Y9?.equalSnapshots;
      AbstractType = Y9?.AbstractType;
      RelativePosition = Y9?.RelativePosition;
      Item = Y9?.Item;
      ContentType = Y9?.ContentType;
      Transaction = Y9?.Transaction;
      AbstractStruct = Y9?.AbstractStruct;
      GC = Y9?.GC;
      typeListToArraySnapshot = Y9?.typeListToArraySnapshot;
      XmlHook = Y9?.XmlHook;
      ContentString = Y9?.ContentString;
      ContentFormat = Y9?.ContentFormat;
      emptySnapshot = Y9?.emptySnapshot;
      PermanentUserData = Y9?.PermanentUserData;
      iterateDeletedStructs = Y9?.iterateDeletedStructs;
      compareRelativePositions = Y9?.compareRelativePositions;
      YMapEvent = Y9?.YMapEvent;
      YTextEvent = Y9?.YTextEvent;
      YXmlEvent = Y9?.YXmlEvent;
    }
  });

  // node_modules/@lexical/offset/LexicalOffset.prod.mjs
  var LexicalOffset_prod_exports = {};
  __export(LexicalOffset_prod_exports, {
    $createChildrenArray: () => a9,
    $createOffsetView: () => p6,
    OffsetView: () => l7,
    createChildrenArray: () => d7
  });
  function s6(t9, ...e5) {
    const n11 = new URL("https://lexical.dev/docs/error"), o8 = new URLSearchParams();
    o8.append("code", t9);
    for (const t10 of e5) o8.append("v", t10);
    throw n11.search = o8.toString(), Error(`Minified Lexical error #${t9}; visit ${n11.toString()} for the full message or use the non-minified dev environment for full errors and additional helpful warnings.`);
  }
  function r8(t9, e5, n11, o8, s7) {
    const l8 = n11._offsetMap, r9 = o8._offsetMap, f8 = /* @__PURE__ */ new Set();
    let c10 = t9, u10 = e5;
    for (; null !== u10; ) {
      const t10 = u10.key, e6 = l8.get(t10), n12 = u10.end - u10.start;
      if (f8.add(t10), void 0 === e6) c10 += n12;
      else {
        const t11 = e6.end - e6.start;
        t11 !== n12 && (c10 += n12 - t11);
      }
      const o9 = u10.prev;
      if (null !== o9) {
        u10 = o9;
        continue;
      }
      let s8 = u10.parent;
      for (; null !== s8; ) {
        let t11 = s8.prev;
        if (null !== t11) {
          const e7 = t11.key, n13 = l8.get(e7), o10 = t11.end - t11.start;
          if (f8.add(e7), void 0 === n13) c10 += o10;
          else {
            const t12 = n13.end - n13.start;
            t12 !== o10 && (c10 += o10 - t12);
          }
          t11 = t11.prev;
        }
        s8 = s8.parent;
      }
      break;
    }
    const a10 = n11._firstNode;
    if (null !== a10) {
      u10 = i12(a10, t9, s7);
      let e6 = false;
      for (; null !== u10; ) {
        if (!f8.has(u10.key)) {
          e6 = true;
          break;
        }
        u10 = u10.parent;
      }
      if (!e6) for (; null !== u10; ) {
        const t10 = u10.key;
        if (!f8.has(t10)) {
          const e7 = r9.get(t10), n12 = u10.end - u10.start;
          if (void 0 === e7) c10 -= n12;
          else {
            const t11 = e7.end - e7.start;
            n12 !== t11 && (c10 += t11 - n12);
          }
        }
        u10 = u10.prev;
      }
    }
    return c10;
  }
  function i12(t9, e5, n11) {
    let o8 = t9;
    for (; null !== o8; ) {
      if (e5 < o8.end + ("element" !== o8.type || 0 === n11 ? 1 : 0)) {
        const t11 = o8.child;
        if (null !== t11) {
          o8 = t11;
          continue;
        }
        return o8;
      }
      const t10 = o8.next;
      if (null === t10) break;
      o8 = t10;
    }
    return null;
  }
  function f7(t9, e5, n11, o8, s7, l8) {
    return { child: t9, end: o8, key: s7, next: null, parent: l8, prev: null, start: n11, type: e5 };
  }
  function c9(t9, n11, l8, r9, i13, c10) {
    const d8 = r9.get(n11);
    void 0 === d8 && s6(3);
    const p7 = t9.offset;
    if ($isElementNode(d8)) {
      const e5 = a9(d8, r9), o8 = 0 === e5.length, s7 = o8 ? null : u9(t9, e5, null, r9, i13, c10);
      t9.prevIsBlock && !o8 || (t9.prevIsBlock = true, t9.offset += c10);
      const g6 = f7(s7, "element", p7, p7, n11, l8);
      null !== s7 && (s7.parent = g6);
      const h4 = t9.offset;
      return g6.end = h4, i13.set(n11, g6), g6;
    }
    t9.prevIsBlock = false;
    const g5 = $isTextNode(d8), h3 = g5 ? d8.__text.length : 1, _5 = f7(null, g5 ? "text" : "inline", p7, t9.offset += h3, n11, l8);
    return i13.set(n11, _5), _5;
  }
  function u9(t9, e5, n11, o8, s7, l8) {
    let r9 = null, i13 = null;
    const f8 = e5.length;
    for (let u10 = 0; u10 < f8; u10++) {
      const f9 = c9(t9, e5[u10], n11, o8, s7, l8);
      null === i13 ? r9 = f9 : (f9.prev = i13, i13.next = f9), i13 = f9;
    }
    return r9;
  }
  function a9(e5, n11) {
    const o8 = [];
    let l8 = e5.__first;
    for (; null !== l8; ) {
      const e6 = null === n11 ? $getNodeByKey(l8) : n11.get(l8);
      null == e6 && s6(174), o8.push(l8), l8 = e6.__next;
    }
    return o8;
  }
  function p6(t9, e5 = 1, n11) {
    const o8 = (n11 || t9._pendingEditorState || t9._editorState)._nodeMap, s7 = o8.get("root"), r9 = /* @__PURE__ */ new Map(), i13 = u9({ offset: 0, prevIsBlock: false }, a9(s7, o8), null, o8, r9, e5);
    return new l7(r9, i13, e5);
  }
  var l7, d7;
  var init_LexicalOffset_prod = __esm({
    "node_modules/@lexical/offset/LexicalOffset.prod.mjs"() {
      init_Lexical();
      l7 = class {
        _offsetMap;
        _firstNode;
        _blockOffsetSize;
        constructor(t9, e5, n11 = 1) {
          this._offsetMap = t9, this._firstNode = e5, this._blockOffsetSize = n11;
        }
        createSelectionFromOffsets(o8, s7, l8) {
          const f8 = this._firstNode;
          if (null === f8) return null;
          let c10 = o8, u10 = s7, a10 = i12(f8, c10, this._blockOffsetSize), d8 = i12(f8, u10, this._blockOffsetSize);
          if (void 0 !== l8 && (c10 = r8(c10, a10, l8, this, this._blockOffsetSize), a10 = i12(f8, c10, this._blockOffsetSize), u10 = r8(u10, d8, l8, this, this._blockOffsetSize), d8 = i12(f8, u10, this._blockOffsetSize)), null === a10 || null === d8) return null;
          let p7 = a10.key, g5 = d8.key;
          const h3 = $getNodeByKey(p7), _5 = $getNodeByKey(g5);
          if (null === h3 || null === _5) return null;
          let k4 = 0, v6 = 0, y6 = "element", x7 = "element";
          if ("text" === a10.type) {
            k4 = c10 - a10.start, y6 = "text";
            const t9 = h3.getNextSibling();
            c10 !== u10 && k4 === h3.getTextContentSize() && $isTextNode(t9) && (k4 = 0, p7 = t9.__key);
          } else "inline" === a10.type && (p7 = h3.getParentOrThrow().getKey(), k4 = u10 > a10.start ? a10.end : a10.start);
          "text" === d8.type ? (v6 = u10 - d8.start, x7 = "text") : "inline" === d8.type && (g5 = _5.getParentOrThrow().getKey(), v6 = u10 > d8.start ? d8.end : d8.start);
          const S3 = $createRangeSelection();
          return null === S3 ? null : (S3.anchor.set(p7, k4, y6), S3.focus.set(g5, v6, x7), S3);
        }
        getOffsetsFromSelection(t9) {
          const e5 = t9.anchor, n11 = t9.focus, o8 = this._offsetMap, s7 = e5.offset, l8 = n11.offset;
          let r9 = -1, i13 = -1;
          if ("text" === e5.type) {
            const t10 = o8.get(e5.key);
            void 0 !== t10 && (r9 = t10.start + s7);
          } else {
            const t10 = e5.getNode().getDescendantByIndex(s7);
            if (null !== t10) {
              const e6 = o8.get(t10.getKey());
              if (void 0 !== e6) {
                r9 = t10.getIndexWithinParent() !== s7 ? e6.end : e6.start;
              }
            }
          }
          if ("text" === n11.type) {
            const t10 = o8.get(n11.key);
            void 0 !== t10 && (i13 = t10.start + n11.offset);
          } else {
            const t10 = n11.getNode().getDescendantByIndex(l8);
            if (null !== t10) {
              const e6 = o8.get(t10.getKey());
              if (void 0 !== e6) {
                i13 = t10.getIndexWithinParent() !== l8 ? e6.end : e6.start;
              }
            }
          }
          return [r9, i13];
        }
      };
      d7 = a9;
    }
  });

  // node_modules/@lexical/offset/LexicalOffset.mjs
  var mod37, $createChildrenArray, $createOffsetView, OffsetView, createChildrenArray;
  var init_LexicalOffset = __esm({
    "node_modules/@lexical/offset/LexicalOffset.mjs"() {
      init_LexicalOffset_prod();
      mod37 = false ? LexicalOffset_dev_exports : LexicalOffset_prod_exports;
      $createChildrenArray = mod37.$createChildrenArray;
      $createOffsetView = mod37.$createOffsetView;
      OffsetView = mod37.OffsetView;
      createChildrenArray = mod37.createChildrenArray;
    }
  });

  // node_modules/@lexical/yjs/LexicalYjs.prod.mjs
  var LexicalYjs_prod_exports = {};
  __export(LexicalYjs_prod_exports, {
    $getYChangeState: () => Ze3,
    CLEAR_DIFF_VERSIONS_COMMAND__EXPERIMENTAL: () => Et8,
    CONNECTED_COMMAND: () => Ot8,
    DIFF_VERSIONS_COMMAND__EXPERIMENTAL: () => Mt7,
    TOGGLE_CONNECT_COMMAND: () => Kt6,
    createBinding: () => le3,
    createBindingV2__EXPERIMENTAL: () => ce2,
    createUndoManager: () => Pt9,
    getAnchorAndFocusCollabNodesForUserState: () => ft8,
    initLocalState: () => Ft8,
    renderSnapshot__EXPERIMENTAL: () => et9,
    setLocalStateFocus: () => At9,
    syncCursorPositions: () => yt9,
    syncLexicalUpdateToYjs: () => St9,
    syncLexicalUpdateToYjsV2__EXPERIMENTAL: () => Ct9,
    syncYjsChangesToLexical: () => Tt9,
    syncYjsChangesToLexicalV2__EXPERIMENTAL: () => vt9,
    syncYjsStateToLexicalV2__EXPERIMENTAL: () => wt8
  });
  function V9(e5, ...t9) {
    const n11 = new URL("https://lexical.dev/docs/error"), o8 = new URLSearchParams();
    o8.append("code", e5);
    for (const e6 of t9) o8.append("v", e6);
    throw n11.search = o8.toString(), Error(`Minified Lexical error #${e5}; visit ${n11.toString()} for the full message or use the non-minified dev environment for full errors and additional helpful warnings.`);
  }
  function H9(e5, t9, n11) {
    const o8 = e5.length, s7 = t9.length;
    let i13 = 0, r9 = 0;
    for (; i13 < o8 && i13 < s7 && e5[i13] === t9[i13] && i13 < n11; ) i13++;
    for (; r9 + i13 < o8 && r9 + i13 < s7 && e5[o8 - r9 - 1] === t9[s7 - r9 - 1]; ) r9++;
    for (; r9 + i13 < o8 && r9 + i13 < s7 && e5[i13] === t9[i13]; ) i13++;
    return { index: i13, insert: t9.slice(i13, s7 - r9), remove: o8 - i13 - r9 };
  }
  function X9(e5, t9, n11) {
    const o8 = new Q9(e5, t9, n11);
    return e5._collabNode = o8, o8;
  }
  function ee4(e5, t9) {
    const n11 = new Z9(e5, t9);
    return e5._collabNode = n11, n11;
  }
  function ne3(e5, t9, n11, o8) {
    const s7 = new te4(e5, t9, n11, o8);
    return e5._collabNode = s7, s7;
  }
  function se2(e5, t9, n11) {
    const o8 = new oe3(e5, t9, n11);
    return e5._collabNode = o8, o8;
  }
  function re3(e5, t9, n11, o8, s7) {
    null == n11 && V9(81);
    const i13 = { clientID: n11.clientID, cursors: /* @__PURE__ */ new Map(), cursorsContainer: null, doc: n11, docMap: o8, editor: e5, excludedProperties: s7 || /* @__PURE__ */ new Map(), id: t9, nodeProperties: /* @__PURE__ */ new Map() };
    return (function(e6) {
      const { editor: t10, nodeProperties: n12 } = e6;
      t10.update(() => {
        t10._nodes.forEach((t11) => {
          const o9 = new t11.klass(), s8 = {};
          for (const [t12, n13] of Object.entries(o9)) pe2(t12, o9, e6) || (s8[t12] = n13);
          n12.set(o9.__type, Object.freeze(s8));
        });
      });
    })(i13), i13;
  }
  function le3(e5, t9, n11, o8, s7, i13) {
    null == o8 && V9(81);
    const r9 = se2(o8.get("root", XmlText), null, "root");
    return r9._key = "root", { ...re3(e5, n11, o8, s7, i13), collabNodeMap: /* @__PURE__ */ new Map(), root: r9 };
  }
  function ce2(e5, t9, n11, o8, s7 = {}) {
    null == n11 && V9(81);
    const { excludedProperties: i13, rootName: r9 = "root-v2" } = s7;
    return { ...re3(e5, t9, n11, o8, i13), mapping: new ie2(), root: n11.get(r9, XmlElement) };
  }
  function ae2(e5) {
    return Object.hasOwn(e5, "collabNodeMap");
  }
  function pe2(e5, t9, n11) {
    if (fe2.has(e5) || "function" == typeof t9[e5]) return true;
    if ($isTextNode(t9)) {
      if (he2.has(e5)) return true;
    } else if ($isElementNode(t9) && (de2.has(e5) || $isRootNode(t9) && ue2.has(e5))) return true;
    const s7 = t9.constructor, i13 = n11.excludedProperties.get(s7);
    return null != i13 && i13.has(e5);
  }
  function ge2(e5, t9) {
    const n11 = e5.__type, { nodeProperties: o8 } = t9, s7 = o8.get(n11);
    return void 0 === s7 && V9(330, n11), s7;
  }
  function _e2(t9, s7, i13) {
    const l8 = s7.__type;
    let c10;
    if ($isElementNode(s7)) {
      c10 = se2(new XmlText(), i13, l8), c10.syncPropertiesFromLexical(t9, s7, null), c10.syncChildrenFromLexical(t9, s7, null, null, null);
    } else if ($isTextNode(s7)) {
      c10 = ne3(new Map2(), s7.__text, i13, l8), c10.syncPropertiesAndTextFromLexical(t9, s7, null);
    } else if ($isLineBreakNode(s7)) {
      const e5 = new Map2();
      e5.set("__type", "linebreak"), c10 = ee4(e5, i13);
    } else if ($isDecoratorNode(s7)) {
      c10 = X9(new XmlElement(), i13, l8), c10.syncPropertiesFromLexical(t9, s7, null);
    } else V9(86);
    return c10._key = s7.__key, c10;
  }
  function ye2(e5) {
    const t9 = be2(e5, "__type");
    return "string" != typeof t9 && void 0 !== t9 && V9(87), t9;
  }
  function me2(e5, t9, n11) {
    const o8 = t9._collabNode;
    if (void 0 === o8) {
      const o9 = e5.editor._nodes, s7 = ye2(t9);
      "string" != typeof s7 && V9(87);
      void 0 === o9.get(s7) && V9(88, s7);
      const i13 = t9.parent, r9 = void 0 === n11 && null !== i13 ? me2(e5, i13) : n11 || null;
      if (r9 instanceof oe3 || V9(89), t9 instanceof XmlText) return se2(t9, r9, s7);
      if (t9 instanceof Map2) return "linebreak" === s7 ? ee4(t9, r9) : ne3(t9, "", r9, s7);
      if (t9 instanceof XmlElement) return X9(t9, r9, s7);
    }
    return o8;
  }
  function xe3(e5, t9, n11) {
    const o8 = t9.getType(), s7 = e5.editor._nodes.get(o8);
    void 0 === s7 && V9(88, o8);
    const i13 = new s7.klass();
    if (i13.__parent = n11, t9._key = i13.__key, t9 instanceof oe3) {
      const n12 = t9._xmlText;
      t9.syncPropertiesFromYjs(e5, null), t9.applyChildrenYjsDelta(e5, n12.toDelta()), t9.syncChildrenFromYjs(e5);
    } else t9 instanceof te4 ? t9.syncPropertiesAndTextFromYjs(e5, null) : t9 instanceof Q9 && t9.syncPropertiesFromYjs(e5, null);
    return e5.collabNodeMap.set(i13.__key, t9), i13;
  }
  function Te3(e5, t9, n11, o8) {
    const s7 = null === o8 ? t9 instanceof Map2 ? Array.from(t9.keys()) : t9 instanceof XmlText || t9 instanceof XmlElement ? Object.keys(t9.getAttributes()) : Object.keys(t9) : Array.from(o8);
    let i13;
    for (let o9 = 0; o9 < s7.length; o9++) {
      const r9 = s7[o9];
      if (pe2(r9, n11, e5)) {
        "__state" === r9 && ae2(e5) && (i13 || (i13 = n11.getWritable()), Se2(t9, i13));
        continue;
      }
      const l8 = n11[r9];
      let c10 = be2(t9, r9);
      if (l8 !== c10) {
        if (c10 instanceof Doc) {
          const t10 = e5.docMap;
          l8 instanceof Doc && t10.delete(l8.guid);
          const n12 = createEditor(), o10 = c10.guid;
          n12._key = o10, t10.set(o10, c10), c10 = n12;
        }
        void 0 === i13 && (i13 = n11.getWritable()), i13[r9] = c10;
      }
    }
  }
  function be2(e5, t9) {
    return e5 instanceof Map2 ? e5.get(t9) : e5 instanceof XmlText || e5 instanceof XmlElement ? e5.getAttribute(t9) : e5[t9];
  }
  function ke3(e5, t9, n11) {
    e5 instanceof Map2 ? e5.set(t9, n11) : e5.setAttribute(t9, n11);
  }
  function Se2(e5, t9) {
    const n11 = be2(e5, "__state");
    n11 instanceof Map2 && $getWritableNodeState(t9).updateFromJSON(n11.toJSON());
  }
  function Ne2(e5, t9, n11, o8) {
    const s7 = Object.keys(ge2(o8, e5)), i13 = e5.editor.constructor;
    !(function(e6, t10, n12, o9) {
      const s8 = o9.__state, i14 = be2(t10, "__state");
      if (!s8) return;
      const [r9, l8] = s8.getInternalState(), c10 = n12 && n12.__state, a10 = i14 instanceof Map2 ? i14 : new Map2();
      if (c10 === s8) return;
      const [f8, d8] = c10 && a10.doc ? c10.getInternalState() : [void 0, /* @__PURE__ */ new Map()];
      if (r9) for (const [e7, t11] of Object.entries(r9)) f8 && t11 !== f8[e7] && a10.set(e7, t11);
      for (const [e7, t11] of l8) d8.get(e7) !== t11 && a10.set(e7.key, e7.unparse(t11));
      i14 || ke3(t10, "__state", a10);
    })(0, t9, n11, o8);
    for (let r9 = 0; r9 < s7.length; r9++) {
      const l8 = s7[r9], c10 = null === n11 ? void 0 : n11[l8];
      let a10 = o8[l8];
      if (c10 !== a10) {
        if (a10 instanceof i13) {
          const t10 = e5.docMap;
          let n12;
          if (c10 instanceof i13) {
            const e6 = c10._key;
            n12 = t10.get(e6), t10.delete(e6);
          }
          const s8 = n12 || new Doc(), r10 = s8.guid;
          a10._key = r10, t10.set(r10, s8), a10 = s8, e5.editor.update(() => {
            o8.markDirty();
          });
        }
        ke3(t9, l8, a10);
      }
    }
  }
  function ve3(e5, t9, n11, o8) {
    return e5.slice(0, t9) + o8 + e5.slice(t9 + n11);
  }
  function we2(e5, t9, n11) {
    let o8 = 0, s7 = 0;
    const i13 = e5._children, r9 = i13.length;
    for (; s7 < r9; s7++) {
      const e6 = i13[s7], l8 = o8;
      o8 += e6.getSize();
      if ((n11 ? o8 >= t9 : o8 > t9) && e6 instanceof te4) {
        let n12 = t9 - l8 - 1;
        n12 < 0 && (n12 = 0);
        return { length: o8 - t9, node: e6, nodeIndex: s7, offset: n12 };
      }
      if (o8 > t9) return { length: 0, node: e6, nodeIndex: s7, offset: l8 };
      if (s7 === r9 - 1) return { length: 0, node: null, nodeIndex: s7 + 1, offset: l8 + 1 };
    }
    return { length: 0, node: null, nodeIndex: 0, offset: 0 };
  }
  function Ce2(e5) {
    const t9 = e5.anchor, n11 = e5.focus;
    let s7 = false;
    try {
      const e6 = t9.getNode(), i13 = n11.getNode();
      (!e6.isAttached() || !i13.isAttached() || $isTextNode(e6) && t9.offset > e6.getTextContentSize() || $isTextNode(i13) && n11.offset > i13.getTextContentSize()) && (s7 = true);
    } catch (e6) {
      s7 = true;
    }
    return s7;
  }
  function Oe3(e5, t9) {
    e5.doc.transact(t9, e5);
  }
  function Ke3(e5, n11) {
    const o8 = n11._nodeMap.get(e5);
    if (!o8) return void $getRoot().selectStart();
    const s7 = o8.__prev;
    let i13 = null;
    s7 && (i13 = $getNodeByKey(s7)), null === i13 && null !== o8.__parent && (i13 = $getNodeByKey(o8.__parent)), null !== i13 ? null !== i13 && i13.isAttached() ? i13.selectEnd() : Ke3(i13.__key, n11) : $getRoot().selectStart();
  }
  function Ze3(e5) {
    return $getState(e5, Xe3);
  }
  function tt9(e5, t9) {
    const n11 = t9.collabNodeMap.get(e5.key);
    if (void 0 === n11) return null;
    let s7 = e5.offset, i13 = n11.getSharedType();
    if (n11 instanceof te4) {
      i13 = n11._parent._xmlText;
      const e6 = n11.getOffset();
      if (-1 === e6) return null;
      s7 = e6 + 1 + s7;
    } else if (n11 instanceof oe3 && "element" === e5.type) {
      const t10 = e5.getNode();
      $isElementNode(t10) || V9(184);
      let n12 = 0, i14 = 0, l8 = t10.getFirstChild();
      for (; null !== l8 && i14++ < s7; ) $isTextNode(l8) ? n12 += l8.getTextContentSize() + 1 : n12++, l8 = l8.getNextSibling();
      s7 = n12;
    }
    return createRelativePositionFromTypeIndex(i13, s7);
  }
  function nt9(e5, t9) {
    const { mapping: n11 } = t9, { offset: s7 } = e5, i13 = e5.getNode(), l8 = n11.getSharedType(i13);
    if (void 0 === l8) return null;
    if ("text" === e5.type) {
      $isTextNode(i13) || V9(326);
      let e6 = i13.getPreviousSibling(), t10 = s7;
      for (; $isTextNode(e6); ) t10 += e6.getTextContentSize(), e6 = e6.getPreviousSibling();
      return createRelativePositionFromTypeIndex(l8, t10);
    }
    if ("element" === e5.type) {
      $isElementNode(i13) || V9(184);
      let e6 = 0, t10 = i13.getFirstChild();
      for (; null !== t10 && e6 < s7; ) {
        if ($isTextNode(t10)) {
          let e7 = t10.getNextSibling();
          for (; $isTextNode(e7); ) e7 = e7.getNextSibling();
        }
        e6++, t10 = t10.getNextSibling();
      }
      return createRelativePositionFromTypeIndex(l8, e6);
    }
    return null;
  }
  function ot9(e5, t9) {
    return createAbsolutePositionFromRelativePosition(e5, t9.doc);
  }
  function st9(e5, t9) {
    if (null == e5) {
      if (null != t9) return true;
    } else if (null == t9 || !compareRelativePositions(e5, t9)) return true;
    return false;
  }
  function it9(e5, t9) {
    return { color: t9, name: e5, selection: null };
  }
  function rt9(e5, t9) {
    const n11 = e5.cursorsContainer;
    if (null !== n11) {
      const e6 = t9.selections, o8 = e6.length;
      for (let t10 = 0; t10 < o8; t10++) n11.removeChild(e6[t10]);
    }
  }
  function lt9(e5, t9) {
    const n11 = t9.selection;
    null !== n11 && rt9(e5, n11);
  }
  function ct8(e5, t9, n11, o8, s7) {
    const i13 = e5.color, r9 = document.createElement("span");
    r9.style.cssText = `position:absolute;top:0;bottom:0;right:-1px;width:1px;background-color:${i13};z-index:10;`;
    const l8 = document.createElement("span");
    return l8.textContent = e5.name, l8.style.cssText = `position:absolute;left:-2px;top:-16px;background-color:${i13};color:#fff;line-height:12px;font-size:12px;padding:2px;font-family:Arial;font-weight:bold;white-space:nowrap;`, r9.appendChild(l8), { anchor: { key: t9, offset: n11 }, caret: r9, color: i13, focus: { key: o8, offset: s7 }, name: l8, selections: [] };
  }
  function at8(e5, t9, o8, s7) {
    const i13 = e5.editor, r9 = i13.getRootElement(), l8 = e5.cursorsContainer;
    if (null === l8 || null === r9) return;
    const c10 = l8.offsetParent;
    if (null === c10) return;
    const a10 = c10.getBoundingClientRect(), f8 = t9.selection;
    if (null === o8) return null === f8 ? void 0 : (t9.selection = null, void rt9(e5, f8));
    t9.selection = o8;
    const d8 = o8.caret, u10 = o8.color, h3 = o8.selections, p7 = o8.anchor, g5 = o8.focus, _5 = p7.key, y6 = g5.key, m9 = s7.get(_5), x7 = s7.get(y6);
    if (null == m9 || null == x7) return;
    let T4;
    if (m9 === x7 && $isLineBreakNode(m9)) {
      T4 = [i13.getElementByKey(_5).getBoundingClientRect()];
    } else {
      const e6 = createDOMRange(i13, m9, p7.offset, x7, g5.offset);
      if (null === e6) return;
      T4 = createRectsFromDOMRange(i13, e6);
    }
    const b7 = h3.length, k4 = T4.length;
    for (let e6 = 0; e6 < k4; e6++) {
      const t10 = T4[e6];
      let n11 = h3[e6];
      if (void 0 === n11) {
        n11 = document.createElement("span"), h3[e6] = n11;
        const t11 = document.createElement("span");
        n11.appendChild(t11), l8.appendChild(n11);
      }
      const o9 = `position:absolute;top:${t10.top - a10.top}px;left:${t10.left - a10.left}px;height:${t10.height}px;width:${t10.width}px;pointer-events:none;z-index:5;`;
      n11.style.cssText = o9, n11.firstChild.style.cssText = `${o9}left:0;top:0;background-color:${u10};opacity:0.3;`, e6 === k4 - 1 && d8.parentNode !== n11 && n11.appendChild(d8);
    }
    for (let e6 = b7 - 1; e6 >= k4; e6--) {
      const t10 = h3[e6];
      l8.removeChild(t10), h3.pop();
    }
  }
  function ft8(e5, t9) {
    const { anchorPos: n11, focusPos: o8 } = t9;
    let s7 = null, i13 = 0, r9 = null, l8 = 0;
    if (null !== n11 && null !== o8) {
      const t10 = ot9(n11, e5), c10 = ot9(o8, e5);
      null !== t10 && null !== c10 && ([s7, i13] = pt9(t10.type, t10.index), [r9, l8] = pt9(c10.type, c10.index));
    }
    return { anchorCollabNode: s7, anchorOffset: i13, focusCollabNode: r9, focusOffset: l8 };
  }
  function dt8(e5, t9) {
    const { anchorPos: n11, focusPos: s7 } = t9, i13 = n11 ? ot9(n11, e5) : null, r9 = s7 ? ot9(s7, e5) : null;
    if (null === i13 || null === r9) return { anchorKey: null, anchorOffset: 0, focusKey: null, focusOffset: 0 };
    if (ae2(e5)) {
      const [e6, t10] = pt9(i13.type, i13.index), [n12, o8] = pt9(r9.type, r9.index);
      return { anchorKey: null !== e6 ? e6.getKey() : null, anchorOffset: t10, focusKey: null !== n12 ? n12.getKey() : null, focusOffset: o8 };
    }
    let [l8, c10] = gt9(e5.mapping, i13), [a10, f8] = gt9(e5.mapping, r9);
    if (a10 && l8 && (a10 !== l8 || f8 !== c10)) {
      const e6 = a10.isBefore(l8), t10 = e6 ? a10 : l8, n12 = e6 ? f8 : c10;
      $isTextNode(t10) && $isTextNode(t10.getNextSibling()) && n12 === t10.getTextContentSize() && (e6 ? (a10 = t10.getNextSibling(), f8 = 0) : (l8 = t10.getNextSibling(), c10 = 0));
    }
    return { anchorKey: null !== l8 ? l8.getKey() : null, anchorOffset: c10, focusKey: null !== a10 ? a10.getKey() : null, focusOffset: f8 };
  }
  function ut8(e5, t9) {
    const n11 = t9.awareness.getLocalState();
    if (null === n11) return;
    const { anchorKey: o8, anchorOffset: r9, focusKey: l8, focusOffset: c10 } = dt8(e5, n11);
    if (null !== o8 && null !== l8) {
      const e6 = $getSelection();
      if (!$isRangeSelection(e6)) return;
      ht9(e6.anchor, o8, r9), ht9(e6.focus, l8, c10);
    }
  }
  function ht9(e5, n11, s7) {
    if (e5.key !== n11 || e5.offset !== s7) {
      let i13 = $getNodeByKey(n11);
      if (null !== i13 && !$isElementNode(i13) && !$isTextNode(i13)) {
        const e6 = i13.getParentOrThrow();
        n11 = e6.getKey(), s7 = i13.getIndexWithinParent(), i13 = e6;
      }
      e5.set(n11, s7, $isElementNode(i13) ? "element" : "text");
    }
  }
  function pt9(e5, t9) {
    const n11 = e5._collabNode;
    if (void 0 === n11) return [null, 0];
    if (n11 instanceof oe3) {
      const { node: e6, offset: o8 } = we2(n11, t9, true);
      return null === e6 ? [n11, 0] : [e6, o8];
    }
    return [null, 0];
  }
  function gt9(e5, t9) {
    const n11 = t9.type, s7 = t9.index;
    if (n11 instanceof XmlElement) {
      const t10 = e5.get(n11);
      if (void 0 === t10) return [null, 0];
      if (!$isElementNode(t10)) return [t10, s7];
      let i13 = s7, l8 = 0;
      const c10 = t10.getChildren();
      for (; i13 > 0 && l8 < c10.length; ) {
        const e6 = c10[l8];
        if (i13 -= 1, l8 += 1, $isTextNode(e6)) for (; l8 < c10.length && $isTextNode(c10[l8]); ) l8 += 1;
      }
      return [t10, l8];
    }
    {
      const t10 = e5.get(n11);
      if (void 0 === t10) return [null, 0];
      let o8 = 0, i13 = s7;
      for (; i13 > t10[o8].getTextContentSize() && o8 + 1 < t10.length; ) i13 -= t10[o8].getTextContentSize(), o8++;
      const r9 = t10[o8];
      return [r9, Math.min(i13, r9.getTextContentSize())];
    }
  }
  function _t9(e5, t9) {
    return t9.awareness.getStates();
  }
  function yt9(e5, t9, n11) {
    const { getAwarenessStates: o8 = _t9 } = n11 ?? {}, s7 = Array.from(o8(e5, t9)), i13 = e5.clientID, r9 = e5.cursors, l8 = e5.editor, c10 = l8._editorState._nodeMap, a10 = /* @__PURE__ */ new Set();
    for (let t10 = 0; t10 < s7.length; t10++) {
      const n12 = s7[t10], [o9, f9] = n12;
      if (0 !== o9 && o9 !== i13) {
        a10.add(o9);
        const { name: t11, color: n13, focusing: s8 } = f9;
        let i14 = null, d8 = r9.get(o9);
        if (void 0 === d8 && (d8 = it9(t11, n13), r9.set(o9, d8)), s8) {
          const { anchorKey: t12, anchorOffset: n14, focusKey: o10, focusOffset: s9 } = l8.read(() => dt8(e5, f9));
          if (null !== t12 && null !== o10) if (i14 = d8.selection, null === i14) i14 = ct8(d8, t12, n14, o10, s9);
          else {
            const e6 = i14.anchor, r10 = i14.focus;
            e6.key = t12, e6.offset = n14, r10.key = o10, r10.offset = s9;
          }
        }
        at8(e5, d8, i14, c10);
      }
    }
    const f8 = Array.from(r9.keys());
    for (let t10 = 0; t10 < f8.length; t10++) {
      const n12 = f8[t10];
      if (!a10.has(n12)) {
        const t11 = r9.get(n12);
        void 0 !== t11 && (lt9(e5, t11), r9.delete(n12));
      }
    }
  }
  function mt8(e5, t9, n11, o8) {
    const s7 = t9.awareness, r9 = s7.getLocalState();
    if (null === r9) return;
    const { anchorPos: l8, focusPos: c10, name: a10, color: f8, focusing: d8, awarenessData: u10 } = r9;
    let h3 = null, p7 = null;
    (null !== o8 && (null === l8 || o8.is(n11)) || null !== n11) && ($isRangeSelection(o8) && (ae2(e5) ? (h3 = tt9(o8.anchor, e5), p7 = tt9(o8.focus, e5)) : (h3 = nt9(o8.anchor, e5), p7 = nt9(o8.focus, e5))), (st9(l8, h3) || st9(c10, p7)) && s7.setLocalState({ ...r9, anchorPos: h3, awarenessData: u10, color: f8, focusPos: p7, focusing: d8, name: a10 }));
  }
  function xt9(e5, t9) {
    if (t9 instanceof YMapEvent && (function(e6, t10) {
      const { target: n12 } = t10;
      if (!n12._item || "__state" !== n12._item.parentSub || void 0 !== ye2(n12) || !(n12.parent instanceof XmlText || n12.parent instanceof XmlElement || n12.parent instanceof Map2)) return false;
      const o9 = me2(e6, n12.parent).getNode();
      if (o9) {
        const e7 = $getWritableNodeState(o9.getWritable());
        for (const o10 of t10.keysChanged) e7.updateFromUnknown(o10, n12.get(o10));
      }
      return true;
    })(e5, t9)) return;
    const { target: n11 } = t9, o8 = me2(e5, n11);
    if (o8 instanceof oe3 && t9 instanceof YTextEvent) {
      const { keysChanged: n12, childListChanged: s7, delta: i13 } = t9;
      n12.size > 0 && o8.syncPropertiesFromYjs(e5, n12), s7 && (o8.applyChildrenYjsDelta(e5, i13), o8.syncChildrenFromYjs(e5));
    } else if (o8 instanceof te4 && t9 instanceof YMapEvent) {
      const { keysChanged: n12 } = t9;
      n12.size > 0 && o8.syncPropertiesAndTextFromYjs(e5, n12);
    } else if (o8 instanceof Q9 && t9 instanceof YXmlEvent) {
      const { attributesChanged: n12 } = t9;
      n12.size > 0 && o8.syncPropertiesFromYjs(e5, n12);
    } else V9(82);
  }
  function Tt9(e5, t9, n11, o8, s7 = yt9) {
    const i13 = e5.editor, r9 = i13._editorState;
    n11.forEach((e6) => e6.delta), i13.update(() => {
      for (let t10 = 0; t10 < n11.length; t10++) {
        const o9 = n11[t10];
        xt9(e5, o9);
      }
      bt9(r9, e5, t9), o8 || $addUpdateTag(SKIP_SCROLL_INTO_VIEW_TAG);
    }, { onUpdate: () => {
      s7(e5, t9), i13.update(() => kt9());
    }, skipTransforms: true, tag: o8 ? HISTORIC_TAG : COLLABORATION_TAG });
  }
  function bt9(e5, t9, n11) {
    const o8 = $getSelection();
    if ($isRangeSelection(o8)) if (Ce2(o8)) {
      const r9 = e5._selection;
      if ($isRangeSelection(r9) && (ut8(t9, n11), Ce2(o8))) {
        Ke3(o8.anchor.key, e5);
      }
      mt8(t9, n11, r9, $getSelection());
    } else ut8(t9, n11);
  }
  function kt9() {
    0 === $getRoot().getChildrenSize() && $getRoot().append($createParagraphNode());
  }
  function St9(e5, n11, i13, r9, l8, c10, a10, f8) {
    Oe3(e5, () => {
      r9.read(() => {
        if (f8.has(COLLABORATION_TAG) || f8.has(HISTORIC_TAG)) return void (a10.size > 0 && (function(e6, n12) {
          const s7 = Array.from(n12), i14 = e6.collabNodeMap, r11 = [], l9 = [];
          for (let e7 = 0; e7 < s7.length; e7++) {
            const n13 = s7[e7], c11 = $getNodeByKey(n13), a11 = i14.get(n13);
            if (a11 instanceof te4) if ($isTextNode(c11)) r11.push([a11, c11.__text]);
            else {
              const e8 = a11.getOffset();
              if (-1 === e8) continue;
              const t9 = a11._parent;
              a11._normalized = true, t9._xmlText.delete(e8, 1), l9.push(a11);
            }
          }
          for (let e7 = 0; e7 < l9.length; e7++) {
            const t9 = l9[e7], n13 = t9.getKey();
            i14.delete(n13);
            const o8 = t9._parent._children, s8 = o8.indexOf(t9);
            o8.splice(s8, 1);
          }
          for (let e7 = 0; e7 < r11.length; e7++) {
            const [t9, n13] = r11[e7];
            t9._text = n13;
          }
        })(e5, a10));
        if (l8.has("root")) {
          const t9 = i13._nodeMap, n12 = $getRoot(), o8 = e5.root;
          o8.syncPropertiesFromLexical(e5, n12, t9), o8.syncChildrenFromLexical(e5, n12, t9, l8, c10);
        }
        const r10 = $getSelection(), d8 = i13._selection;
        mt8(e5, n11, d8, r10);
      });
    });
  }
  function Nt9(e5, t9) {
    const { target: n11 } = t9;
    if (n11 instanceof XmlElement && t9 instanceof YXmlEvent) Ee3(n11, e5, t9.attributesChanged, t9.childListChanged);
    else if (n11 instanceof XmlText && t9 instanceof YTextEvent) {
      const t10 = n11.parent;
      t10 instanceof XmlElement ? Ee3(t10, e5, /* @__PURE__ */ new Set(), true) : V9(327);
    } else V9(328);
  }
  function vt9(e5, t9, n11, o8, s7) {
    const i13 = e5.editor, r9 = i13._editorState;
    iterateDeletedStructs(o8, o8.deleteSet, (t10) => {
      if (t10.constructor === Item) {
        const n12 = t10.content.type;
        n12 && e5.mapping.delete(n12);
      }
    }), n11.forEach((e6) => e6.delta), i13.update(() => {
      for (let t10 = 0; t10 < n11.length; t10++) {
        const o9 = n11[t10];
        Nt9(e5, o9);
      }
      bt9(r9, e5, t9), s7 || $addUpdateTag(SKIP_SCROLL_INTO_VIEW_TAG);
    }, { discrete: true, onUpdate: () => {
      yt9(e5, t9), i13.update(() => kt9());
    }, skipTransforms: true, tag: s7 ? HISTORIC_TAG : COLLABORATION_TAG });
  }
  function wt8(e5, t9) {
    e5.mapping.clear();
    const n11 = e5.editor;
    n11.update(() => {
      $getRoot().clear(), Ee3(e5.root, e5, null, true), $addUpdateTag(COLLABORATION_TAG);
    }, { discrete: true, onUpdate: () => {
      yt9(e5, t9), n11.update(() => kt9());
    }, skipTransforms: true, tag: COLLABORATION_TAG });
  }
  function Ct9(e5, t9, n11, o8, i13, r9, l8) {
    (l8.has(COLLABORATION_TAG) || l8.has(HISTORIC_TAG)) && 0 === r9.size || (r9.forEach((t10) => {
      e5.mapping.deleteNode(t10);
    }), Oe3(e5, () => {
      o8.read(() => {
        i13.has("root") && He3(e5.doc, e5.root, $getRoot(), e5, new Set(i13.keys()));
        const o9 = $getSelection(), r10 = n11._selection;
        mt8(e5, t9, r10, o9);
      });
    }));
  }
  function Pt9(e5, t9) {
    return new UndoManager(t9, { trackedOrigins: /* @__PURE__ */ new Set([e5, null]) });
  }
  function Ft8(e5, t9, n11, o8, s7) {
    e5.awareness.setLocalState({ anchorPos: null, awarenessData: s7, color: n11, focusPos: null, focusing: o8, name: t9 });
  }
  function At9(e5, t9, n11, o8, s7) {
    const { awareness: i13 } = e5;
    let r9 = i13.getLocalState();
    null === r9 && (r9 = { anchorPos: null, awarenessData: s7, color: n11, focusPos: null, focusing: o8, name: t9 }), r9.focusing = o8, i13.setLocalState(r9);
  }
  var Q9, Z9, te4, oe3, ie2, fe2, de2, ue2, he2, Me3, Ee3, Pe3, Fe3, Ae3, je3, ze3, Le3, De3, Ye3, Ie3, $e3, We3, Ue3, Re3, Be3, qe3, Je3, Ge3, Ve3, He3, Qe3, Xe3, et9, Ot8, Kt6, Mt7, Et8;
  var init_LexicalYjs_prod = __esm({
    "node_modules/@lexical/yjs/LexicalYjs.prod.mjs"() {
      init_Lexical();
      init_yjs();
      init_LexicalOffset();
      init_LexicalSelection();
      Q9 = class {
        _xmlElem;
        _key;
        _parent;
        _type;
        constructor(e5, t9, n11) {
          this._key = "", this._xmlElem = e5, this._parent = t9, this._type = n11;
        }
        getPrevNode(t9) {
          if (null === t9) return null;
          const n11 = t9.get(this._key);
          return $isDecoratorNode(n11) ? n11 : null;
        }
        getNode() {
          const n11 = $getNodeByKey(this._key);
          return $isDecoratorNode(n11) ? n11 : null;
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
        syncPropertiesFromLexical(e5, t9, n11) {
          const o8 = this.getPrevNode(n11);
          Ne2(e5, this._xmlElem, o8, t9);
        }
        syncPropertiesFromYjs(e5, t9) {
          const n11 = this.getNode();
          null === n11 && V9(83);
          Te3(e5, this._xmlElem, n11, t9);
        }
        destroy(e5) {
          const t9 = e5.collabNodeMap;
          t9.get(this._key) === this && t9.delete(this._key);
        }
      };
      Z9 = class {
        _map;
        _key;
        _parent;
        _type;
        constructor(e5, t9) {
          this._key = "", this._map = e5, this._parent = t9, this._type = "linebreak";
        }
        getNode() {
          const e5 = $getNodeByKey(this._key);
          return $isLineBreakNode(e5) ? e5 : null;
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
        destroy(e5) {
          const t9 = e5.collabNodeMap;
          t9.get(this._key) === this && t9.delete(this._key);
        }
      };
      te4 = class {
        _map;
        _key;
        _parent;
        _text;
        _type;
        _normalized;
        constructor(e5, t9, n11, o8) {
          this._key = "", this._map = e5, this._parent = n11, this._text = t9, this._type = o8, this._normalized = false;
        }
        getPrevNode(e5) {
          if (null === e5) return null;
          const t9 = e5.get(this._key);
          return $isTextNode(t9) ? t9 : null;
        }
        getNode() {
          const e5 = $getNodeByKey(this._key);
          return $isTextNode(e5) ? e5 : null;
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
        spliceText(e5, t9, n11) {
          const o8 = this._parent._xmlText, s7 = this.getOffset() + 1 + e5;
          0 !== t9 && o8.delete(s7, t9), "" !== n11 && o8.insert(s7, n11);
        }
        syncPropertiesAndTextFromLexical(e5, t9, n11) {
          const o8 = this.getPrevNode(n11), r9 = t9.__text;
          if (Ne2(e5, this._map, o8, t9), null !== o8) {
            const e6 = o8.__text;
            if (e6 !== r9) {
              !(function(e7, t10, n12, o9) {
                const r10 = $getSelection();
                let l8 = o9.length;
                if ($isRangeSelection(r10) && r10.isCollapsed()) {
                  const e8 = r10.anchor;
                  e8.key === t10 && (l8 = e8.offset);
                }
                const c10 = H9(n12, o9, l8);
                e7.spliceText(c10.index, c10.remove, c10.insert);
              })(this, t9.__key, e6, r9), this._text = r9;
            }
          }
        }
        syncPropertiesAndTextFromYjs(e5, t9) {
          const n11 = this.getNode();
          null === n11 && V9(84), Te3(e5, this._map, n11, t9);
          const o8 = this._text;
          n11.__text !== o8 && n11.setTextContent(o8);
        }
        destroy(e5) {
          const t9 = e5.collabNodeMap;
          t9.get(this._key) === this && t9.delete(this._key);
        }
      };
      oe3 = class _oe {
        _key;
        _children;
        _xmlText;
        _type;
        _parent;
        constructor(e5, t9, n11) {
          this._key = "", this._children = [], this._xmlText = e5, this._type = n11, this._parent = t9;
        }
        getPrevNode(e5) {
          if (null === e5) return null;
          const t9 = e5.get(this._key);
          return $isElementNode(t9) ? t9 : null;
        }
        getNode() {
          const e5 = $getNodeByKey(this._key);
          return $isElementNode(e5) ? e5 : null;
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
          const e5 = this._parent;
          return null === e5 && V9(90), e5.getChildOffset(this);
        }
        syncPropertiesFromYjs(e5, t9) {
          const n11 = this.getNode();
          null === n11 && V9(91), Te3(e5, this._xmlText, n11, t9);
        }
        applyChildrenYjsDelta(e5, t9) {
          const n11 = this._children;
          let o8 = 0, s7 = null;
          for (let i13 = 0; i13 < t9.length; i13++) {
            const r9 = t9[i13], l8 = r9.insert, c10 = r9.delete;
            if (null != r9.retain) o8 += r9.retain;
            else if ("number" == typeof c10) {
              let e6 = c10;
              for (; e6 > 0; ) {
                const { node: t10, nodeIndex: s8, offset: i14, length: r10 } = we2(this, o8, false);
                if (t10 instanceof _oe || t10 instanceof Z9 || t10 instanceof Q9) n11.splice(s8, 1), e6 -= 1;
                else {
                  if (!(t10 instanceof te4)) break;
                  {
                    const o9 = Math.min(e6, r10), l9 = 0 !== s8 ? n11[s8 - 1] : null, c11 = t10.getSize();
                    if (0 === i14 && r10 === c11) {
                      n11.splice(s8, 1);
                      const e7 = ve3(t10._text, i14, o9 - 1, "");
                      e7.length > 0 && (l9 instanceof te4 ? l9._text += e7 : this._xmlText.delete(i14, e7.length));
                    } else t10._text = ve3(t10._text, i14, o9, "");
                    e6 -= o9;
                  }
                }
              }
            } else {
              if (null == l8) throw new Error("Unexpected delta format");
              if ("string" == typeof l8) {
                const { node: e6, offset: t10 } = we2(this, o8, true);
                e6 instanceof te4 ? e6._text = ve3(e6._text, t10, 0, l8) : this._xmlText.delete(t10, l8.length), o8 += l8.length;
              } else {
                const t10 = l8, { node: i14, nodeIndex: r10, length: c11 } = we2(this, o8, false), a10 = me2(e5, t10, this);
                if (i14 instanceof te4 && c11 > 0 && c11 < i14._text.length) {
                  const e6 = i14._text, t11 = e6.length - c11;
                  i14._text = ve3(e6, t11, c11, ""), n11.splice(r10 + 1, 0, a10), s7 = ve3(e6, 0, t11, "");
                } else n11.splice(r10, 0, a10);
                null !== s7 && a10 instanceof te4 && (a10._text = s7 + a10._text, s7 = null), o8 += 1;
              }
            }
          }
        }
        syncChildrenFromYjs(e5) {
          const t9 = this.getNode();
          null === t9 && V9(92);
          const n11 = t9.__key, s7 = $createChildrenArray(t9, null), i13 = s7.length, r9 = this._children, a10 = r9.length, f8 = e5.collabNodeMap, d8 = /* @__PURE__ */ new Set();
          let u10, h3, p7 = 0, g5 = null;
          a10 !== i13 && (h3 = t9.getWritable());
          for (let i14 = 0; i14 < a10; i14++) {
            const _5 = s7[p7], y6 = r9[i14], m9 = y6.getNode(), x7 = y6._key;
            if (null !== m9 && _5 === x7) {
              const t10 = $isTextNode(m9);
              if (d8.add(_5), t10) if (y6._key = _5, y6 instanceof _oe) {
                const t11 = y6._xmlText;
                y6.syncPropertiesFromYjs(e5, null), y6.applyChildrenYjsDelta(e5, t11.toDelta()), y6.syncChildrenFromYjs(e5);
              } else y6 instanceof te4 ? y6.syncPropertiesAndTextFromYjs(e5, null) : y6 instanceof Q9 ? y6.syncPropertiesFromYjs(e5, null) : y6 instanceof Z9 || V9(93);
              g5 = m9, p7++;
            } else {
              if (void 0 === u10) {
                u10 = /* @__PURE__ */ new Set();
                for (let e6 = 0; e6 < a10; e6++) {
                  const t10 = r9[e6]._key;
                  "" !== t10 && u10.add(t10);
                }
              }
              if (null !== m9 && void 0 !== _5 && !u10.has(_5)) {
                const e6 = $getNodeByKeyOrThrow(_5);
                removeFromParent(e6), i14--, p7++;
                continue;
              }
              h3 = t9.getWritable();
              const o8 = xe3(e5, y6, n11), s8 = o8.__key;
              if (f8.set(s8, y6), null === g5) {
                const e6 = h3.getFirstChild();
                if (h3.__first = s8, null !== e6) {
                  const t10 = e6.getWritable();
                  t10.__prev = s8, o8.__next = t10.__key;
                }
              } else {
                const e6 = g5.getWritable(), t10 = g5.getNextSibling();
                if (e6.__next = s8, o8.__prev = g5.__key, null !== t10) {
                  const e7 = t10.getWritable();
                  e7.__prev = s8, o8.__next = e7.__key;
                }
              }
              i14 === a10 - 1 && (h3.__last = s8), h3.__size++, g5 = o8;
            }
          }
          for (let t10 = 0; t10 < i13; t10++) {
            const n12 = s7[t10];
            if (!d8.has(n12)) {
              const t11 = $getNodeByKeyOrThrow(n12), o8 = e5.collabNodeMap.get(n12);
              void 0 !== o8 && o8.destroy(e5), removeFromParent(t11);
            }
          }
        }
        syncPropertiesFromLexical(e5, t9, n11) {
          Ne2(e5, this._xmlText, this.getPrevNode(n11), t9);
        }
        _syncChildFromLexical(t9, n11, s7, i13, c10, a10) {
          const f8 = this._children[n11], d8 = $getNodeByKeyOrThrow(s7);
          f8 instanceof _oe && $isElementNode(d8) ? (f8.syncPropertiesFromLexical(t9, d8, i13), f8.syncChildrenFromLexical(t9, d8, i13, c10, a10)) : f8 instanceof te4 && $isTextNode(d8) ? f8.syncPropertiesAndTextFromLexical(t9, d8, i13) : f8 instanceof Q9 && $isDecoratorNode(d8) && f8.syncPropertiesFromLexical(t9, d8, i13);
        }
        syncChildrenFromLexical(e5, t9, n11, o8, s7) {
          const i13 = this.getPrevNode(n11), r9 = null === i13 ? [] : $createChildrenArray(i13, n11), c10 = $createChildrenArray(t9, null), a10 = r9.length - 1, f8 = c10.length - 1, d8 = e5.collabNodeMap;
          let u10, h3, p7 = 0, g5 = 0;
          for (; p7 <= a10 && g5 <= f8; ) {
            const t10 = r9[p7], i14 = c10[g5];
            if (t10 === i14) this._syncChildFromLexical(e5, g5, i14, n11, o8, s7), p7++, g5++;
            else {
              void 0 === u10 && (u10 = new Set(r9)), void 0 === h3 && (h3 = new Set(c10));
              const n12 = h3.has(t10), o9 = u10.has(i14);
              if (n12) {
                const t11 = _e2(e5, $getNodeByKeyOrThrow(i14), this);
                d8.set(i14, t11), o9 ? (this.splice(e5, g5, 1, t11), p7++, g5++) : (this.splice(e5, g5, 0, t11), g5++);
              } else this.splice(e5, g5, 1), p7++;
            }
          }
          const _5 = p7 > a10, y6 = g5 > f8;
          if (_5 && !y6) for (; g5 <= f8; ++g5) {
            const t10 = c10[g5], n12 = _e2(e5, $getNodeByKeyOrThrow(t10), this);
            this.append(n12), d8.set(t10, n12);
          }
          else if (y6 && !_5) for (let t10 = this._children.length - 1; t10 >= g5; t10--) this.splice(e5, t10, 1);
        }
        append(e5) {
          const t9 = this._xmlText, n11 = this._children, o8 = n11[n11.length - 1], s7 = void 0 !== o8 ? o8.getOffset() + o8.getSize() : 0;
          if (e5 instanceof _oe) t9.insertEmbed(s7, e5._xmlText);
          else if (e5 instanceof te4) {
            const n12 = e5._map;
            null === n12.parent && t9.insertEmbed(s7, n12), t9.insert(s7 + 1, e5._text);
          } else e5 instanceof Z9 ? t9.insertEmbed(s7, e5._map) : e5 instanceof Q9 && t9.insertEmbed(s7, e5._xmlElem);
          this._children.push(e5);
        }
        splice(e5, t9, n11, o8) {
          const s7 = this._children, i13 = s7[t9];
          if (void 0 === i13) return void 0 === o8 && V9(94), void this.append(o8);
          const r9 = i13.getOffset();
          -1 === r9 && V9(95);
          const l8 = this._xmlText;
          if (0 !== n11 && l8.delete(r9, i13.getSize()), o8 instanceof _oe) l8.insertEmbed(r9, o8._xmlText);
          else if (o8 instanceof te4) {
            const e6 = o8._map;
            null === e6.parent && l8.insertEmbed(r9, e6), l8.insert(r9 + 1, o8._text);
          } else o8 instanceof Z9 ? l8.insertEmbed(r9, o8._map) : o8 instanceof Q9 && l8.insertEmbed(r9, o8._xmlElem);
          if (0 !== n11) {
            const o9 = s7.slice(t9, t9 + n11);
            for (let t10 = 0; t10 < o9.length; t10++) o9[t10].destroy(e5);
          }
          void 0 !== o8 ? s7.splice(t9, n11, o8) : s7.splice(t9, n11);
        }
        getChildOffset(e5) {
          let t9 = 0;
          const n11 = this._children;
          for (let o8 = 0; o8 < n11.length; o8++) {
            const s7 = n11[o8];
            if (s7 === e5) return t9;
            t9 += s7.getSize();
          }
          return -1;
        }
        destroy(e5) {
          const t9 = e5.collabNodeMap, n11 = this._children;
          for (let t10 = 0; t10 < n11.length; t10++) n11[t10].destroy(e5);
          t9.get(this._key) === this && t9.delete(this._key);
        }
      };
      ie2 = class {
        _nodeMap = /* @__PURE__ */ new Map();
        _sharedTypeToNodeKeys = /* @__PURE__ */ new Map();
        _nodeKeyToSharedType = /* @__PURE__ */ new Map();
        set(e5, t9) {
          const n11 = t9 instanceof Array;
          this.delete(e5);
          const s7 = n11 ? t9 : [t9];
          for (const e6 of s7) {
            const t10 = e6.getKey();
            if (this._nodeKeyToSharedType.has(t10)) {
              const e7 = this._nodeKeyToSharedType.get(t10), n12 = this._sharedTypeToNodeKeys.get(e7).indexOf(t10);
              -1 !== n12 && this._sharedTypeToNodeKeys.get(e7).splice(n12, 1), this._nodeKeyToSharedType.delete(t10), this._nodeMap.delete(t10);
            }
          }
          if (e5 instanceof XmlText) {
            if (n11 || V9(331), 0 === t9.length) return;
            this._sharedTypeToNodeKeys.set(e5, t9.map((e6) => e6.getKey()));
            for (const n12 of t9) this._nodeMap.set(n12.getKey(), n12), this._nodeKeyToSharedType.set(n12.getKey(), e5);
          } else n11 && V9(332), $isTextNode(t9) && V9(333), this._sharedTypeToNodeKeys.set(e5, [t9.getKey()]), this._nodeMap.set(t9.getKey(), t9), this._nodeKeyToSharedType.set(t9.getKey(), e5);
        }
        get(e5) {
          const t9 = this._sharedTypeToNodeKeys.get(e5);
          if (void 0 !== t9) {
            if (e5 instanceof XmlText) {
              const e6 = Array.from(t9.map((e7) => this._nodeMap.get(e7)));
              return e6.length > 0 ? e6 : void 0;
            }
            return this._nodeMap.get(t9[0]);
          }
        }
        getSharedType(e5) {
          return this._nodeKeyToSharedType.get(e5.getKey());
        }
        delete(e5) {
          const t9 = this._sharedTypeToNodeKeys.get(e5);
          if (void 0 !== t9) {
            for (const e6 of t9) this._nodeMap.delete(e6), this._nodeKeyToSharedType.delete(e6);
            this._sharedTypeToNodeKeys.delete(e5);
          }
        }
        deleteNode(e5) {
          const t9 = this._nodeKeyToSharedType.get(e5);
          t9 && this.delete(t9), this._nodeMap.delete(e5);
        }
        has(e5) {
          return this._sharedTypeToNodeKeys.has(e5);
        }
        clear() {
          this._nodeMap.clear(), this._sharedTypeToNodeKeys.clear(), this._nodeKeyToSharedType.clear();
        }
      };
      fe2 = /* @__PURE__ */ new Set(["__key", "__parent", "__next", "__prev", "__state"]);
      de2 = /* @__PURE__ */ new Set(["__first", "__last", "__size"]);
      ue2 = /* @__PURE__ */ new Set(["__cachedText"]);
      he2 = /* @__PURE__ */ new Set(["__text"]);
      Me3 = (e5) => "UNDEFINED" === e5.nodeName;
      Ee3 = (e5, t9, n11, o8, s7, i13, r9) => {
        let l8 = t9.mapping.get(e5);
        if (l8 && n11 && 0 === n11.size && !o8) return l8;
        const c10 = Me3(e5) ? RootNode.getType() : e5.nodeName, a10 = t9.editor._nodes.get(c10);
        if (void 0 === a10) throw new Error(`$createOrUpdateNodeFromYElement: Node ${c10} is not registered`);
        if (l8 || (l8 = new a10.klass(), n11 = null, o8 = true), o8 && l8 instanceof ElementNode) {
          const n12 = [], o9 = (e6) => {
            if (e6 instanceof XmlElement) {
              const o10 = Ee3(e6, t9, /* @__PURE__ */ new Set(), false, s7, i13, r9);
              null !== o10 && n12.push(o10);
            } else if (e6 instanceof XmlText) {
              const o10 = Ae3(e6, t9, s7, i13, r9);
              null !== o10 && o10.forEach((e7) => {
                null !== e7 && n12.push(e7);
              });
            } else V9(329);
          };
          void 0 === s7 || void 0 === i13 ? e5.toArray().forEach(o9) : typeListToArraySnapshot(e5, new Snapshot(i13.ds, s7.sv)).filter((e6) => !e6._item.deleted || Fe3(e6._item, s7) || Fe3(e6._item, i13)).forEach(o9), Pe3(l8, n12);
        }
        const f8 = e5.getAttributes(s7);
        Me3(e5) || void 0 === s7 || (Fe3(e5._item, s7) ? Fe3(e5._item, i13) || (f8[Je3("ychange")] = r9 ? r9("added", e5._item.id) : { type: "added" }) : f8[Je3("ychange")] = r9 ? r9("removed", e5._item.id) : { type: "removed" });
        const u10 = { ...ge2(l8, t9) }, g5 = {};
        for (const e6 in f8) e6.startsWith(qe3) ? g5[Ge3(e6)] = f8[e6] : u10[e6] = f8[e6];
        if (Te3(t9, u10, l8, n11), n11) {
          const e6 = Object.keys(g5).filter((e7) => n11.has(Je3(e7)));
          if (e6.length > 0) {
            const t10 = $getWritableNodeState(l8);
            for (const n12 of e6) t10.updateFromUnknown(n12, g5[n12]);
          }
        } else $getWritableNodeState(l8).updateFromJSON(g5);
        const _5 = l8.getLatest();
        return t9.mapping.set(e5, _5), _5;
      };
      Pe3 = (e5, t9) => {
        const n11 = e5.getChildren(), o8 = new Set(n11.map((e6) => e6.getKey())), s7 = new Set(t9.map((e6) => e6.getKey())), i13 = n11.length - 1, r9 = t9.length - 1;
        let l8 = 0, c10 = 0;
        for (; l8 <= i13 && c10 <= r9; ) {
          const i14 = n11[l8].getKey(), r10 = t9[c10].getKey();
          if (i14 === r10) {
            l8++, c10++;
            continue;
          }
          const a11 = s7.has(i14), f9 = o8.has(r10);
          if (!a11) {
            if (0 === c10 && 1 === e5.getChildrenSize()) return void e5.splice(c10, 1, t9.slice(c10));
            e5.splice(c10, 1, []), l8++;
            continue;
          }
          const d8 = t9[c10];
          f9 ? (e5.splice(c10, 1, [d8]), l8++, c10++) : (e5.splice(c10, 0, [d8]), c10++);
        }
        const a10 = l8 > i13, f8 = c10 > r9;
        a10 && !f8 ? e5.append(...t9.slice(c10)) : f8 && !a10 && e5.splice(t9.length, e5.getChildrenSize() - t9.length, []);
      };
      Fe3 = (e5, t9) => void 0 === t9 ? !e5.deleted : t9.sv.has(e5.id.client) && t9.sv.get(e5.id.client) > e5.id.clock && !isDeleted(t9.ds, e5.id);
      Ae3 = (e5, t9, n11, s7, i13) => {
        const r9 = Re3(e5, n11, s7, i13);
        let l8 = t9.mapping.get(e5) ?? [];
        const c10 = r9.map((e6) => e6.attributes.t ?? TextNode.getType());
        if (!(l8.length === c10.length && l8.every((e6, t10) => e6.getType() === c10[t10]))) {
          const e6 = t9.editor._nodes;
          l8 = c10.map((t10) => {
            const n12 = e6.get(t10);
            if (void 0 === n12) throw new Error(`$createTextNodesFromYText: Node ${t10} is not registered`);
            const s8 = new n12.klass();
            if (!$isTextNode(s8)) throw new Error(`$createTextNodesFromYText: Node ${t10} is not a TextNode`);
            return s8;
          });
        }
        for (let e6 = 0; e6 < r9.length; e6++) {
          const n12 = l8[e6], o8 = r9[e6], { attributes: s8, insert: i14 } = o8;
          n12.__text !== i14 && n12.setTextContent(i14);
          const c11 = { ...ge2(n12, t9), ...s8.p }, a11 = Object.fromEntries(Object.entries(s8).filter(([e7]) => e7.startsWith(qe3)).map(([e7, t10]) => [Ge3(e7), t10]));
          Te3(t9, c11, n12, null), $getWritableNodeState(n12).updateFromJSON(a11);
        }
        const a10 = l8.map((e6) => e6.getLatest());
        return t9.mapping.set(e5, a10), a10;
      };
      je3 = (e5, t9) => e5 instanceof Array ? ((e6, t10) => {
        const n11 = new XmlText();
        return Ue3(n11, e6, t10), n11;
      })(e5, t9) : ((e6, t10) => {
        const n11 = new XmlElement(e6.getType()), o8 = { ...Be3(e6, t10), ...Ve3(e6) };
        for (const e7 in o8) {
          const t11 = o8[e7];
          null !== t11 && n11.setAttribute(e7, t11);
        }
        return e6 instanceof ElementNode ? (n11.insert(0, De3(e6).map((e7) => je3(e7, t10))), t10.mapping.set(n11, e6), n11) : n11;
      })(e5, t9);
      ze3 = (e5) => "object" == typeof e5 && null != e5;
      Le3 = (e5, t9) => {
        const n11 = Object.keys(e5).filter((t10) => null !== e5[t10]);
        if (null == t9) return 0 === n11.length;
        let o8 = n11.length === Object.keys(t9).filter((e6) => null !== t9[e6]).length;
        for (let s7 = 0; s7 < n11.length && o8; s7++) {
          const i13 = n11[s7], r9 = e5[i13], l8 = t9[i13];
          o8 = "ychange" === i13 || r9 === l8 || ze3(r9) && ze3(l8) && Le3(r9, l8);
        }
        return o8;
      };
      De3 = (e5) => {
        if (!(e5 instanceof ElementNode)) return [];
        const t9 = e5.getChildren(), n11 = [];
        for (let e6 = 0; e6 < t9.length; e6++) {
          const s7 = t9[e6];
          if ($isTextNode(s7)) {
            const s8 = [];
            for (let n12 = t9[e6]; e6 < t9.length && $isTextNode(n12); n12 = t9[++e6]) s8.push(n12);
            e6--, n11.push(s8);
          } else n11.push(s7);
        }
        return n11;
      };
      Ye3 = (e5, t9, n11) => {
        const o8 = Re3(e5);
        return o8.length === t9.length && o8.every((e6, o9) => {
          const s7 = t9[o9], i13 = e6.attributes.t ?? TextNode.getType(), r9 = e6.attributes.p ?? {}, l8 = Object.fromEntries(Object.entries(e6.attributes).filter(([e7]) => e7.startsWith(qe3)));
          return e6.insert === s7.getTextContent() && i13 === s7.getType() && Le3(r9, Be3(s7, n11)) && Le3(l8, Ve3(s7));
        });
      };
      Ie3 = (e5, t9, n11) => {
        if (e5 instanceof XmlElement && !(t9 instanceof Array) && Qe3(e5, t9)) {
          const o8 = De3(t9);
          return e5._length === o8.length && Le3(e5.getAttributes(), { ...Be3(t9, n11), ...Ve3(t9) }) && e5.toArray().every((e6, t10) => Ie3(e6, o8[t10], n11));
        }
        return e5 instanceof XmlText && t9 instanceof Array && Ye3(e5, t9, n11);
      };
      $e3 = (e5, t9) => e5 === t9 || e5 instanceof Array && t9 instanceof Array && e5.length === t9.length && e5.every((e6, n11) => t9[n11] === e6);
      We3 = (e5, t9, n11) => {
        const o8 = e5.toArray(), s7 = De3(t9), i13 = s7.length, r9 = o8.length, l8 = Math.min(r9, i13);
        let c10 = 0, a10 = 0, f8 = false;
        for (; c10 < l8; c10++) {
          const e6 = o8[c10], t10 = s7[c10];
          if (e6 instanceof XmlHook) break;
          if ($e3(n11.mapping.get(e6), t10)) f8 = true;
          else if (!Ie3(e6, t10, n11)) break;
        }
        for (; c10 + a10 < l8; a10++) {
          const e6 = o8[r9 - a10 - 1], t10 = s7[i13 - a10 - 1];
          if (e6 instanceof XmlHook) break;
          if ($e3(n11.mapping.get(e6), t10)) f8 = true;
          else if (!Ie3(e6, t10, n11)) break;
        }
        return { equalityFactor: c10 + a10, foundMappedChild: f8 };
      };
      Ue3 = (e5, t9, n11) => {
        n11.mapping.set(e5, t9);
        const { nAttrs: o8, str: r9 } = ((e6) => {
          let t10 = "", n12 = e6._start;
          const o9 = {};
          for (; null !== n12; ) n12.deleted || (n12.countable && n12.content instanceof ContentString ? t10 += n12.content.str : n12.content instanceof ContentFormat && (o9[n12.content.key] = null)), n12 = n12.right;
          return { nAttrs: o9, str: t10 };
        })(e5), l8 = t9.map((e6, t10) => {
          const s7 = e6.getType();
          let i13 = Be3(e6, n11);
          return 0 === Object.keys(i13).length && (i13 = null), { attributes: Object.assign({}, o8, { ...s7 !== TextNode.getType() && { t: s7 }, p: i13, ...Ve3(e6), ...t10 > 0 && { i: t10 } }), insert: e6.getTextContent(), nodeKey: e6.getKey() };
        }), c10 = l8.map((e6) => e6.insert).join(""), a10 = $getSelection();
        let f8;
        if ($isRangeSelection(a10) && a10.isCollapsed()) {
          f8 = 0;
          for (const e6 of l8) {
            if (e6.nodeKey === a10.anchor.key) {
              f8 += a10.anchor.offset;
              break;
            }
            f8 += e6.insert.length;
          }
        } else f8 = c10.length;
        const { insert: d8, remove: u10, index: h3 } = H9(r9, c10, f8);
        e5.delete(h3, u10), e5.insert(h3, d8), e5.applyDelta(l8.map((e6) => ({ attributes: e6.attributes, retain: e6.insert.length })));
      };
      Re3 = (e5, t9, n11, o8) => e5.toDelta(t9, n11, o8).map((e6) => {
        const t10 = e6.attributes ?? {};
        return "ychange" in t10 && (t10[Je3("ychange")] = t10.ychange, delete t10.ychange), { ...e6, attributes: t10 };
      });
      Be3 = (e5, t9) => {
        const n11 = ge2(e5, t9), o8 = {};
        return Object.entries(n11).forEach(([t10, n12]) => {
          const s7 = e5[t10];
          s7 !== n12 && (o8[t10] = s7);
        }), o8;
      };
      qe3 = "s_";
      Je3 = (e5) => `s_${e5}`;
      Ge3 = (e5) => {
        if (!e5.startsWith(qe3)) throw new Error(`Invalid state key: ${e5}`);
        return e5.slice(qe3.length);
      };
      Ve3 = (e5) => {
        const t9 = e5.__state;
        if (!t9) return {};
        const [n11 = {}, o8] = t9.getInternalState(), s7 = {};
        for (const [e6, t10] of Object.entries(n11)) s7[Je3(e6)] = t10;
        for (const [e6, t10] of o8) s7[Je3(e6.key)] = e6.unparse(t10);
        return s7;
      };
      He3 = (e5, t9, n11, o8, s7) => {
        if (t9 instanceof XmlElement && t9.nodeName !== n11.getType() && (!Me3(t9) || n11.getType() !== RootNode.getType())) throw new Error("node name mismatch!");
        if (o8.mapping.set(t9, n11), t9 instanceof XmlElement) {
          const e6 = t9.getAttributes(), s8 = { ...Be3(n11, o8), ...Ve3(n11) };
          for (const n12 in s8) if (null != s8[n12]) {
            e6[n12] === s8[n12] || ze3(e6[n12]) && ze3(s8[n12]) && Le3(e6[n12], s8[n12]) || "ychange" === n12 || t9.setAttribute(n12, s8[n12]);
          } else t9.removeAttribute(n12);
          for (const n12 in e6) void 0 === s8[n12] && t9.removeAttribute(n12);
        }
        const i13 = De3(n11), r9 = i13.length, l8 = t9.toArray(), c10 = l8.length, a10 = Math.min(r9, c10);
        let f8 = 0, d8 = 0;
        for (; f8 < a10; f8++) {
          const t10 = l8[f8], n12 = i13[f8];
          if (t10 instanceof XmlHook) break;
          if ($e3(o8.mapping.get(t10), n12)) n12 instanceof ElementNode && s7.has(n12.getKey()) && He3(e5, t10, n12, o8, s7);
          else {
            if (!Ie3(t10, n12, o8)) break;
            o8.mapping.set(t10, n12);
          }
        }
        for (; d8 + f8 < a10; d8++) {
          const t10 = l8[c10 - d8 - 1], n12 = i13[r9 - d8 - 1];
          if (t10 instanceof XmlHook) break;
          if ($e3(o8.mapping.get(t10), n12)) n12 instanceof ElementNode && s7.has(n12.getKey()) && He3(e5, t10, n12, o8, s7);
          else {
            if (!Ie3(t10, n12, o8)) break;
            o8.mapping.set(t10, n12);
          }
        }
        for (; c10 - f8 - d8 > 0 && r9 - f8 - d8 > 0; ) {
          const n12 = l8[f8], a11 = i13[f8], u11 = l8[c10 - d8 - 1], h3 = i13[r9 - d8 - 1];
          if (n12 instanceof XmlText && a11 instanceof Array) Ye3(n12, a11, o8) || Ue3(n12, a11, o8), f8 += 1;
          else {
            let i14 = n12 instanceof XmlElement && Qe3(n12, a11), r10 = u11 instanceof XmlElement && Qe3(u11, h3);
            if (i14 && r10) {
              const e6 = We3(n12, a11, o8), t10 = We3(u11, h3, o8);
              e6.foundMappedChild && !t10.foundMappedChild ? r10 = false : !e6.foundMappedChild && t10.foundMappedChild || e6.equalityFactor < t10.equalityFactor ? i14 = false : r10 = false;
            }
            i14 ? (He3(e5, n12, a11, o8, s7), f8 += 1) : r10 ? (He3(e5, u11, h3, o8, s7), d8 += 1) : (o8.mapping.delete(t9.get(f8)), t9.delete(f8, 1), t9.insert(f8, [je3(a11, o8)]), f8 += 1);
          }
        }
        const u10 = c10 - f8 - d8;
        if (1 === c10 && 0 === r9 && l8[0] instanceof XmlText ? (o8.mapping.delete(l8[0]), l8[0].delete(0, l8[0].length)) : u10 > 0 && (t9.slice(f8, f8 + u10).forEach((e6) => o8.mapping.delete(e6)), t9.delete(f8, u10)), f8 + d8 < r9) {
          const e6 = [];
          for (let t10 = f8; t10 < r9 - d8; t10++) e6.push(je3(i13[t10], o8));
          t9.insert(f8, e6);
        }
      };
      Qe3 = (e5, t9) => !(t9 instanceof Array) && e5.nodeName === t9.getType();
      Xe3 = createState("ychange", { isEqual: (e5, t9) => e5 === t9, parse: (e5) => e5 ?? null });
      et9 = (e5, t9 = snapshot(e5.doc), n11 = emptySnapshot) => {
        const { doc: o8 } = e5;
        o8.gc && V9(325), o8.transact((s7) => {
          const i13 = new PermanentUserData(o8);
          i13 && i13.dss.forEach((e6) => {
            iterateDeletedStructs(s7, e6, (e7) => {
            });
          });
          const r9 = (e6, t10) => ({ id: t10, type: e6, user: ("added" === e6 ? i13.getUserByClientId(t10.client) : i13.getUserByDeletedId(t10)) ?? null });
          e5.mapping.clear(), e5.editor.update(() => {
            $getRoot().clear(), Ee3(e5.root, e5, null, true, t9, n11, r9);
          });
        }, e5);
      };
      Ot8 = createCommand("CONNECTED_COMMAND");
      Kt6 = createCommand("TOGGLE_CONNECT_COMMAND");
      Mt7 = createCommand("DIFF_VERSIONS_COMMAND");
      Et8 = createCommand("CLEAR_DIFF_VERSIONS_COMMAND");
    }
  });

  // node_modules/@lexical/yjs/LexicalYjs.mjs
  var LexicalYjs_exports = {};
  __export(LexicalYjs_exports, {
    $getYChangeState: () => $getYChangeState,
    CLEAR_DIFF_VERSIONS_COMMAND__EXPERIMENTAL: () => CLEAR_DIFF_VERSIONS_COMMAND__EXPERIMENTAL,
    CONNECTED_COMMAND: () => CONNECTED_COMMAND,
    DIFF_VERSIONS_COMMAND__EXPERIMENTAL: () => DIFF_VERSIONS_COMMAND__EXPERIMENTAL,
    TOGGLE_CONNECT_COMMAND: () => TOGGLE_CONNECT_COMMAND,
    createBinding: () => createBinding,
    createBindingV2__EXPERIMENTAL: () => createBindingV2__EXPERIMENTAL,
    createUndoManager: () => createUndoManager,
    getAnchorAndFocusCollabNodesForUserState: () => getAnchorAndFocusCollabNodesForUserState,
    initLocalState: () => initLocalState,
    renderSnapshot__EXPERIMENTAL: () => renderSnapshot__EXPERIMENTAL,
    setLocalStateFocus: () => setLocalStateFocus,
    syncCursorPositions: () => syncCursorPositions,
    syncLexicalUpdateToYjs: () => syncLexicalUpdateToYjs,
    syncLexicalUpdateToYjsV2__EXPERIMENTAL: () => syncLexicalUpdateToYjsV2__EXPERIMENTAL,
    syncYjsChangesToLexical: () => syncYjsChangesToLexical,
    syncYjsChangesToLexicalV2__EXPERIMENTAL: () => syncYjsChangesToLexicalV2__EXPERIMENTAL,
    syncYjsStateToLexicalV2__EXPERIMENTAL: () => syncYjsStateToLexicalV2__EXPERIMENTAL
  });
  var mod38, $getYChangeState, CLEAR_DIFF_VERSIONS_COMMAND__EXPERIMENTAL, CONNECTED_COMMAND, DIFF_VERSIONS_COMMAND__EXPERIMENTAL, TOGGLE_CONNECT_COMMAND, createBinding, createBindingV2__EXPERIMENTAL, createUndoManager, getAnchorAndFocusCollabNodesForUserState, initLocalState, renderSnapshot__EXPERIMENTAL, setLocalStateFocus, syncCursorPositions, syncLexicalUpdateToYjs, syncLexicalUpdateToYjsV2__EXPERIMENTAL, syncYjsChangesToLexical, syncYjsChangesToLexicalV2__EXPERIMENTAL, syncYjsStateToLexicalV2__EXPERIMENTAL;
  var init_LexicalYjs = __esm({
    "node_modules/@lexical/yjs/LexicalYjs.mjs"() {
      init_LexicalYjs_prod();
      mod38 = false ? LexicalYjs_dev_exports : LexicalYjs_prod_exports;
      $getYChangeState = mod38.$getYChangeState;
      CLEAR_DIFF_VERSIONS_COMMAND__EXPERIMENTAL = mod38.CLEAR_DIFF_VERSIONS_COMMAND__EXPERIMENTAL;
      CONNECTED_COMMAND = mod38.CONNECTED_COMMAND;
      DIFF_VERSIONS_COMMAND__EXPERIMENTAL = mod38.DIFF_VERSIONS_COMMAND__EXPERIMENTAL;
      TOGGLE_CONNECT_COMMAND = mod38.TOGGLE_CONNECT_COMMAND;
      createBinding = mod38.createBinding;
      createBindingV2__EXPERIMENTAL = mod38.createBindingV2__EXPERIMENTAL;
      createUndoManager = mod38.createUndoManager;
      getAnchorAndFocusCollabNodesForUserState = mod38.getAnchorAndFocusCollabNodesForUserState;
      initLocalState = mod38.initLocalState;
      renderSnapshot__EXPERIMENTAL = mod38.renderSnapshot__EXPERIMENTAL;
      setLocalStateFocus = mod38.setLocalStateFocus;
      syncCursorPositions = mod38.syncCursorPositions;
      syncLexicalUpdateToYjs = mod38.syncLexicalUpdateToYjs;
      syncLexicalUpdateToYjsV2__EXPERIMENTAL = mod38.syncLexicalUpdateToYjsV2__EXPERIMENTAL;
      syncYjsChangesToLexical = mod38.syncYjsChangesToLexical;
      syncYjsChangesToLexicalV2__EXPERIMENTAL = mod38.syncYjsChangesToLexicalV2__EXPERIMENTAL;
      syncYjsStateToLexicalV2__EXPERIMENTAL = mod38.syncYjsStateToLexicalV2__EXPERIMENTAL;
    }
  });

  // src/shared/lexical-playground/index.tsx
  var index_exports = {};
  __export(index_exports, {
    getMountedEditors: () => getMountedEditors,
    isMounted: () => isMounted,
    mount: () => mount,
    unmount: () => unmount
  });

  // react-dom-client-global:react-dom/client
  var ReactDOM = window.ReactDOM;
  var createRoot = ReactDOM?.createRoot;
  var hydrateRoot = ReactDOM?.hydrateRoot;

  // src/shared/lexical-playground/PlaygroundEditor.tsx
  var import_react33 = __toESM(require_react());

  // node_modules/@lexical/react/LexicalComposerContext.prod.mjs
  var LexicalComposerContext_prod_exports = {};
  __export(LexicalComposerContext_prod_exports, {
    LexicalComposerContext: () => r,
    createLexicalComposerContext: () => t,
    useLexicalComposerContext: () => o
  });
  var import_react = __toESM(require_react(), 1);
  var r = (0, import_react.createContext)(null);
  function t(n11, e5) {
    let r9 = null;
    return null != n11 && (r9 = n11[1]), { getTheme: function() {
      return null != e5 ? e5 : null != r9 ? r9.getTheme() : null;
    } };
  }
  function o() {
    const n11 = (0, import_react.useContext)(r);
    return null == n11 && (function(n12, ...e5) {
      const r9 = new URL("https://lexical.dev/docs/error"), t9 = new URLSearchParams();
      t9.append("code", n12);
      for (const n13 of e5) t9.append("v", n13);
      throw r9.search = t9.toString(), Error(`Minified Lexical error #${n12}; visit ${r9.toString()} for the full message or use the non-minified dev environment for full errors and additional helpful warnings.`);
    })(8), n11;
  }

  // node_modules/@lexical/react/LexicalComposerContext.mjs
  var mod = false ? LexicalComposerContext_dev_exports : LexicalComposerContext_prod_exports;
  var LexicalComposerContext = mod.LexicalComposerContext;
  var createLexicalComposerContext = mod.createLexicalComposerContext;
  var useLexicalComposerContext = mod.useLexicalComposerContext;

  // react-jsx-global:react/jsx-runtime
  var React = window.React;
  var jsx = React?.createElement;
  var jsxs = React?.createElement;
  var Fragment = React?.Fragment;

  // node_modules/@lexical/react/LexicalComposer.prod.mjs
  var LexicalComposer_prod_exports = {};
  __export(LexicalComposer_prod_exports, {
    LexicalComposer: () => f2
  });
  init_Lexical();
  var import_react2 = __toESM(require_react(), 1);
  var m2 = "undefined" != typeof window && void 0 !== window.document && void 0 !== window.document.createElement;
  var u2 = m2 ? import_react2.useLayoutEffect : import_react2.useEffect;
  var p2 = { tag: HISTORY_MERGE_TAG };
  function f2({ initialConfig: a10, children: c10 }) {
    const l8 = (0, import_react2.useMemo)(() => {
      const { theme: t9, namespace: c11, nodes: l9, onError: d8, editorState: s7, html: u10 } = a10, f8 = createLexicalComposerContext(null, t9), E8 = createEditor({ editable: a10.editable, html: u10, namespace: c11, nodes: l9, onError: (e5) => d8(e5, E8), theme: t9 });
      return (function(e5, t10) {
        if (null === t10) return;
        if (void 0 === t10) e5.update(() => {
          const t11 = $getRoot();
          if (t11.isEmpty()) {
            const o8 = $createParagraphNode();
            t11.append(o8);
            const n11 = m2 ? document.activeElement : null;
            (null !== $getSelection() || null !== n11 && n11 === e5.getRootElement()) && o8.select();
          }
        }, p2);
        else if (null !== t10) switch (typeof t10) {
          case "string": {
            const o8 = e5.parseEditorState(t10);
            e5.setEditorState(o8, p2);
            break;
          }
          case "object":
            e5.setEditorState(t10, p2);
            break;
          case "function":
            e5.update(() => {
              $getRoot().isEmpty() && t10(e5);
            }, p2);
        }
      })(E8, s7), [E8, f8];
    }, []);
    return u2(() => {
      const e5 = a10.editable, [t9] = l8;
      t9.setEditable(void 0 === e5 || e5);
    }, []), jsx(LexicalComposerContext.Provider, { value: l8, children: c10 });
  }

  // node_modules/@lexical/react/LexicalComposer.mjs
  var mod3 = false ? LexicalComposer_dev_exports : LexicalComposer_prod_exports;
  var LexicalComposer = mod3.LexicalComposer;

  // node_modules/@lexical/react/useLexicalEditable.prod.mjs
  var useLexicalEditable_prod_exports = {};
  __export(useLexicalEditable_prod_exports, {
    useLexicalEditable: () => a2
  });
  var import_react3 = __toESM(require_react(), 1);
  var c3 = "undefined" != typeof window && void 0 !== window.document && void 0 !== window.document.createElement ? import_react3.useLayoutEffect : import_react3.useEffect;
  function u3(e5) {
    return { initialValueFn: () => e5.isEditable(), subscribe: (n11) => e5.registerEditableListener(n11) };
  }
  function a2() {
    return (function(n11) {
      const [t9] = useLexicalComposerContext(), u10 = (0, import_react3.useMemo)(() => n11(t9), [t9, n11]), [a10, l8] = (0, import_react3.useState)(() => u10.initialValueFn()), d8 = (0, import_react3.useRef)(a10);
      return c3(() => {
        const { initialValueFn: e5, subscribe: n12 } = u10, t10 = e5();
        return d8.current !== t10 && (d8.current = t10, l8(t10)), n12((e6) => {
          d8.current = e6, l8(e6);
        });
      }, [u10, n11]), a10;
    })(u3);
  }

  // node_modules/@lexical/react/useLexicalEditable.mjs
  var mod4 = false ? useLexicalEditable_dev_exports : useLexicalEditable_prod_exports;
  var useLexicalEditable = mod4.useLexicalEditable;

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
  init_Lexical();
  init_Lexical();
  init_LexicalSelection();
  function R3(t9, ...e5) {
    const n11 = new URL("https://lexical.dev/docs/error"), o8 = new URLSearchParams();
    o8.append("code", t9);
    for (const t10 of e5) o8.append("v", t10);
    throw n11.search = o8.toString(), Error(`Minified Lexical error #${t9}; visit ${n11.toString()} for the full message or use the non-minified dev environment for full errors and additional helpful warnings.`);
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
  function F3(...t9) {
    const e5 = [];
    for (const n11 of t9) if (n11 && "string" == typeof n11) for (const [t10] of n11.matchAll(/\S+/g)) e5.push(t10);
    return e5;
  }
  function U3(...t9) {
    return () => {
      for (let e5 = t9.length - 1; e5 >= 0; e5--) t9[e5]();
      t9.length = 0;
    };
  }
  function z3(t9) {
    return `${t9}px`;
  }
  var V3 = { attributes: true, characterData: true, childList: true, subtree: true };
  function W3(e5, n11, o8) {
    let r9 = null, i13 = null, l8 = null, u10 = [];
    const s7 = document.createElement("div");
    function c10() {
      null === r9 && R3(182), null === i13 && R3(183);
      const { left: t9, top: l9 } = i13.getBoundingClientRect(), c11 = createRectsFromDOMRange(e5, n11);
      var a11, f9;
      s7.isConnected || (f9 = s7, (a11 = i13).insertBefore(f9, a11.firstChild));
      let d8 = false;
      for (let e6 = 0; e6 < c11.length; e6++) {
        const n12 = c11[e6], o9 = u10[e6] || document.createElement("div"), r10 = o9.style;
        "absolute" !== r10.position && (r10.position = "absolute", d8 = true);
        const i14 = z3(n12.left - t9);
        r10.left !== i14 && (r10.left = i14, d8 = true);
        const a12 = z3(n12.top - l9);
        r10.top !== a12 && (o9.style.top = a12, d8 = true);
        const f10 = z3(n12.width);
        r10.width !== f10 && (o9.style.width = f10, d8 = true);
        const g5 = z3(n12.height);
        r10.height !== g5 && (o9.style.height = g5, d8 = true), o9.parentNode !== s7 && (s7.append(o9), d8 = true), u10[e6] = o9;
      }
      for (; u10.length > c11.length; ) u10.pop();
      d8 && o8(u10);
    }
    function a10() {
      i13 = null, r9 = null, null !== l8 && l8.disconnect(), l8 = null, s7.remove();
      for (const t9 of u10) t9.remove();
      u10 = [];
    }
    s7.style.position = "relative";
    const f8 = e5.registerRootListener(function n12() {
      const o9 = e5.getRootElement();
      if (null === o9) return a10();
      const u11 = o9.parentElement;
      if (!isHTMLElement(u11)) return a10();
      a10(), r9 = o9, i13 = u11, l8 = new MutationObserver((t9) => {
        const o10 = e5.getRootElement(), l9 = o10 && o10.parentElement;
        if (o10 !== r9 || l9 !== i13) return n12();
        for (const e6 of t9) if (!s7.contains(e6.target)) return c10();
      }), l8.observe(u11, V3), c10();
    });
    return () => {
      f8(), a10();
    };
  }
  function G3(t9, e5, n11) {
    if ("text" !== t9.type && $isElementNode(e5)) {
      const o8 = e5.getDOMSlot(n11);
      return [o8.element, o8.getFirstChildOffset() + t9.offset];
    }
    return [getDOMTextNode(n11) || n11, t9.offset];
  }
  function q3(t9, o8) {
    let r9 = null, i13 = null, l8 = null, u10 = null, s7 = null, c10 = null, a10 = () => {
    };
    function f8(f9) {
      f9.read(() => {
        const f10 = $getSelection();
        if (!$isRangeSelection(f10)) return r9 = null, l8 = null, u10 = null, c10 = null, a10(), void (a10 = () => {
        });
        const [d8, g5] = (function(t10) {
          const e5 = t10.getStartEndPoints();
          return t10.isBackward() ? [e5[1], e5[0]] : e5;
        })(f10), p7 = d8.getNode(), m9 = p7.getKey(), h3 = d8.offset, v6 = g5.getNode(), y6 = v6.getKey(), w6 = g5.offset, x7 = t9.getElementByKey(m9), E8 = t9.getElementByKey(y6), S3 = null === r9 || x7 !== i13 || h3 !== l8 || m9 !== r9.getKey(), A5 = null === u10 || E8 !== s7 || w6 !== c10 || y6 !== u10.getKey();
        if ((S3 || A5) && null !== x7 && null !== E8) {
          const e5 = (function(t10, e6, n11, o9, r10, i14, l9) {
            const u11 = (t10._window ? t10._window.document : document).createRange();
            return u11.setStart(...G3(e6, n11, o9)), u11.setEnd(...G3(r10, i14, l9)), u11;
          })(t9, d8, p7, x7, g5, v6, E8);
          a10(), a10 = W3(t9, e5, (t10) => {
            if (void 0 === o8) for (const e6 of t10) {
              const t11 = e6.style;
              "Highlight" !== t11.background && (t11.background = "Highlight"), "HighlightText" !== t11.color && (t11.color = "HighlightText"), t11.marginTop !== z3(-1.5) && (t11.marginTop = z3(-1.5)), t11.paddingTop !== z3(4) && (t11.paddingTop = z3(4)), t11.paddingBottom !== z3(0) && (t11.paddingBottom = z3(0));
            }
            else o8(t10);
          });
        }
        r9 = p7, i13 = x7, l8 = h3, u10 = v6, s7 = E8, c10 = w6;
      });
    }
    return f8(t9.getEditorState()), U3(t9.registerUpdateListener(({ editorState: t10 }) => f8(t10)), () => {
      a10();
    });
  }
  function J3(t9) {
    let e5 = null;
    const n11 = () => {
      const n12 = getSelection(), o8 = n12 && n12.anchorNode, r9 = t9.getRootElement();
      null !== o8 && null !== r9 && r9.contains(o8) ? null !== e5 && (e5(), e5 = null) : null === e5 && (e5 = q3(t9));
    };
    return document.addEventListener("selectionchange", n11), () => {
      null !== e5 && e5(), document.removeEventListener("selectionchange", n11);
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
  function lt2(t9, ...e5) {
    const n11 = F3(...e5);
    n11.length > 0 && t9.classList.add(...n11);
  }
  function ut2(t9, ...e5) {
    const n11 = F3(...e5);
    n11.length > 0 && t9.classList.remove(...n11);
  }
  function st2(t9, e5) {
    for (const n11 of e5) if (t9.type.startsWith(n11)) return true;
    return false;
  }
  function ct2(t9, e5) {
    const n11 = t9[Symbol.iterator]();
    return new Promise((t10, o8) => {
      const r9 = [], i13 = () => {
        const { done: l8, value: u10 } = n11.next();
        if (l8) return t10(r9);
        const s7 = new FileReader();
        s7.addEventListener("error", o8), s7.addEventListener("load", () => {
          const t11 = s7.result;
          "string" == typeof t11 && r9.push({ file: u10, result: t11 }), i13();
        }), st2(u10, e5) ? s7.readAsDataURL(u10) : i13();
      };
      i13();
    });
  }
  function at2(t9, e5) {
    return Array.from(gt2(t9, e5));
  }
  function ft2(t9) {
    return t9 ? t9.getAdjacentCaret() : null;
  }
  function dt2(t9, e5) {
    return Array.from(wt2(t9, e5));
  }
  function gt2(t9, e5) {
    return mt2("next", t9, e5);
  }
  function pt2(t9, e5) {
    const n11 = $getAdjacentSiblingOrParentSiblingCaret($getSiblingCaret(t9, e5));
    return n11 && n11[0];
  }
  function mt2(t9, e5, n11) {
    const r9 = $getRoot(), s7 = e5 || r9, c10 = $isElementNode(s7) ? $getChildCaret(s7, t9) : $getSiblingCaret(s7, t9), a10 = vt2(s7), f8 = n11 ? $getAdjacentChildCaret($getChildCaretOrSelf($getSiblingCaret(n11, t9))) || pt2(n11, t9) : pt2(s7, t9);
    let d8 = a10;
    return makeStepwiseIterator({ hasNext: (t10) => null !== t10, initial: c10, map: (t10) => ({ depth: d8, node: t10.origin }), step: (t10) => {
      if (t10.isSameNodeCaret(f8)) return null;
      $isChildCaret(t10) && d8++;
      const e6 = $getAdjacentSiblingOrParentSiblingCaret(t10);
      return !e6 || e6[0].isSameNodeCaret(f8) ? null : (d8 += e6[1], e6[0]);
    } });
  }
  function ht2(t9) {
    const e5 = $getAdjacentSiblingOrParentSiblingCaret($getSiblingCaret(t9, "next"));
    return e5 && [e5[0].origin, e5[1]];
  }
  function vt2(t9) {
    let e5 = -1;
    for (let n11 = t9; null !== n11; n11 = n11.getParent()) e5++;
    return e5;
  }
  function yt2(t9) {
    const e5 = $getChildCaretOrSelf($getSiblingCaret(t9, "previous")), n11 = $getAdjacentSiblingOrParentSiblingCaret(e5, "root");
    return n11 && n11[0].origin;
  }
  function wt2(t9, e5) {
    return mt2("previous", t9, e5);
  }
  function xt2(t9, e5) {
    let n11 = t9;
    for (; null != n11; ) {
      if (n11 instanceof e5) return n11;
      n11 = n11.getParent();
    }
    return null;
  }
  function Et2(t9) {
    const e5 = $findMatchingParent(t9, (t10) => $isElementNode(t10) && !t10.isInline());
    return $isElementNode(e5) || R3(4, t9.__key), e5;
  }
  function St2(t9, e5, n11, o8) {
    const r9 = (t10) => t10 instanceof e5;
    return t9.registerNodeTransform(e5, (t10) => {
      const e6 = ((t11) => {
        const e7 = t11.getChildren();
        for (let t12 = 0; t12 < e7.length; t12++) {
          const n13 = e7[t12];
          if (r9(n13)) return null;
        }
        let n12 = t11, o9 = t11;
        for (; null !== n12; ) if (o9 = n12, n12 = n12.getParent(), r9(n12)) return { child: o9, parent: n12 };
        return null;
      })(t10);
      if (null !== e6) {
        const { child: r10, parent: i13 } = e6;
        if (r10.is(t10)) {
          o8(i13, t10);
          const e7 = r10.getNextSiblings(), l8 = e7.length;
          if (i13.insertAfter(r10), 0 !== l8) {
            const t11 = n11(i13);
            r10.insertAfter(t11);
            for (let n12 = 0; n12 < l8; n12++) t11.append(e7[n12]);
          }
          i13.canBeEmpty() || 0 !== i13.getChildrenSize() || i13.remove();
        }
      }
    });
  }
  function At2(t9, e5) {
    const n11 = /* @__PURE__ */ new Map(), o8 = t9._pendingEditorState;
    for (const [t10, o9] of e5._nodeMap) n11.set(t10, $cloneWithProperties(o9));
    o8 && (o8._nodeMap = n11), t9._dirtyType = 2;
    const r9 = e5._selection;
    $setSelection(null === r9 ? null : r9.clone());
  }
  function Ct2(t9) {
    const o8 = $getSelection() || $getPreviousSelection();
    let r9;
    if ($isRangeSelection(o8)) r9 = $caretFromPoint(o8.focus, "next");
    else {
      if (null != o8) {
        const t10 = o8.getNodes(), e5 = t10[t10.length - 1];
        e5 && (r9 = $getSiblingCaret(e5, "next"));
      }
      r9 = r9 || $getChildCaret($getRoot(), "previous").getFlipped().insert($createParagraphNode());
    }
    const i13 = bt2(t9, r9), u10 = $getAdjacentChildCaret(i13), s7 = $isChildCaret(u10) ? $normalizeCaret(u10) : i13;
    return $setSelectionFromCaretRange($getCollapsedCaretRange(s7)), t9.getLatest();
  }
  function bt2(t9, e5, n11) {
    let o8 = $getCaretInDirection(e5, "next");
    for (let t10 = o8; t10; t10 = $splitAtPointCaretNext(t10, n11)) o8 = t10;
    return $isTextPointCaret(o8) && R3(283), o8.insert(t9.isInline() ? $createParagraphNode().append(t9) : t9), $getCaretInDirection($getSiblingCaret(t9.getLatest(), "next"), e5.direction);
  }
  function Lt2(t9, e5) {
    const n11 = e5();
    return t9.replace(n11), n11.append(t9), n11;
  }
  function Pt2(t9, e5) {
    return null !== t9 && Object.getPrototypeOf(t9).constructor.name === e5.name;
  }
  function Nt2(t9, e5) {
    const n11 = [];
    for (let o8 = 0; o8 < t9.length; o8++) {
      const r9 = e5(t9[o8]);
      null !== r9 && n11.push(r9);
    }
    return n11;
  }
  function Mt2(t9, e5) {
    $getChildCaret(t9, "next").insert(e5);
  }
  var Rt2 = !(ot2 || !X3) && void 0;
  function Tt2(t9) {
    let e5 = 1;
    if ((function() {
      if (void 0 === Rt2) {
        const t10 = document.createElement("div");
        t10.style.cssText = "position: absolute; opacity: 0; width: 100px; left: -1000px;", document.body.appendChild(t10);
        const e6 = t10.getBoundingClientRect();
        t10.style.setProperty("zoom", "2"), Rt2 = t10.getBoundingClientRect().width === e6.width, document.body.removeChild(t10);
      }
      return Rt2;
    })()) for (; t9; ) e5 *= Number(window.getComputedStyle(t9).getPropertyValue("zoom")), t9 = t9.parentElement;
    return e5;
  }
  function Bt2(t9) {
    return null !== t9._parentEditor;
  }
  function _t2(t9, e5) {
    return kt2(t9, e5, null);
  }
  function kt2(t9, e5, n11) {
    let r9 = false;
    for (const i13 of Ot2(t9)) e5(i13) ? null !== n11 && n11(i13) : (r9 = true, $isElementNode(i13) && kt2(i13, e5, n11 || ((t10) => i13.insertAfter(t10))), i13.remove());
    return r9;
  }
  function $t2(t9, e5) {
    const n11 = [], r9 = Array.from(t9).reverse();
    for (let t10 = r9.pop(); void 0 !== t10; t10 = r9.pop()) if (e5(t10)) n11.push(t10);
    else if ($isElementNode(t10)) for (const e6 of Ot2(t10)) r9.push(e6);
    return n11;
  }
  function Kt2(t9) {
    return Ht2($getChildCaret(t9, "next"));
  }
  function Ot2(t9) {
    return Ht2($getChildCaret(t9, "previous"));
  }
  function Ht2(t9) {
    return makeStepwiseIterator({ hasNext: $isSiblingCaret, initial: t9.getAdjacentCaret(), map: (t10) => t10.origin.getLatest(), step: (t10) => t10.getAdjacentCaret() });
  }
  function jt2(t9) {
    $rewindSiblingCaret($getSiblingCaret(t9, "next")).splice(1, t9.getChildren());
  }
  function Dt2(t9) {
    const e5 = (e6) => $getState(e6, t9), n11 = (e6, n12) => $setState(e6, t9, n12);
    return { $get: e5, $set: n11, accessors: [e5, n11], makeGetterMethod: () => function() {
      return e5(this);
    }, makeSetterMethod: () => function(t10) {
      return n11(this, t10);
    }, stateConfig: t9 };
  }

  // node_modules/@lexical/utils/LexicalUtils.mjs
  var mod6 = false ? LexicalUtils_dev_exports : LexicalUtils_prod_exports;
  var $descendantsMatching = mod6.$descendantsMatching;
  var $dfs = mod6.$dfs;
  var $dfsIterator = mod6.$dfsIterator;
  var $filter = mod6.$filter;
  var $findMatchingParent2 = mod6.$findMatchingParent;
  var $firstToLastIterator = mod6.$firstToLastIterator;
  var $getAdjacentCaret = mod6.$getAdjacentCaret;
  var $getAdjacentSiblingOrParentSiblingCaret2 = mod6.$getAdjacentSiblingOrParentSiblingCaret;
  var $getDepth = mod6.$getDepth;
  var $getNearestBlockElementAncestorOrThrow = mod6.$getNearestBlockElementAncestorOrThrow;
  var $getNearestNodeOfType = mod6.$getNearestNodeOfType;
  var $getNextRightPreorderNode = mod6.$getNextRightPreorderNode;
  var $getNextSiblingOrParentSibling = mod6.$getNextSiblingOrParentSibling;
  var $insertFirst = mod6.$insertFirst;
  var $insertNodeToNearestRoot = mod6.$insertNodeToNearestRoot;
  var $insertNodeToNearestRootAtCaret = mod6.$insertNodeToNearestRootAtCaret;
  var $isEditorIsNestedEditor = mod6.$isEditorIsNestedEditor;
  var $lastToFirstIterator = mod6.$lastToFirstIterator;
  var $restoreEditorState = mod6.$restoreEditorState;
  var $reverseDfs = mod6.$reverseDfs;
  var $reverseDfsIterator = mod6.$reverseDfsIterator;
  var $splitNode2 = mod6.$splitNode;
  var $unwrapAndFilterDescendants = mod6.$unwrapAndFilterDescendants;
  var $unwrapNode = mod6.$unwrapNode;
  var $wrapNodeInElement = mod6.$wrapNodeInElement;
  var CAN_USE_BEFORE_INPUT = mod6.CAN_USE_BEFORE_INPUT;
  var CAN_USE_DOM = mod6.CAN_USE_DOM;
  var IS_ANDROID = mod6.IS_ANDROID;
  var IS_ANDROID_CHROME = mod6.IS_ANDROID_CHROME;
  var IS_APPLE = mod6.IS_APPLE;
  var IS_APPLE_WEBKIT = mod6.IS_APPLE_WEBKIT;
  var IS_CHROME = mod6.IS_CHROME;
  var IS_FIREFOX = mod6.IS_FIREFOX;
  var IS_IOS = mod6.IS_IOS;
  var IS_SAFARI = mod6.IS_SAFARI;
  var addClassNamesToElement = mod6.addClassNamesToElement;
  var calculateZoomLevel = mod6.calculateZoomLevel;
  var isBlockDomNode2 = mod6.isBlockDomNode;
  var isHTMLAnchorElement2 = mod6.isHTMLAnchorElement;
  var isHTMLElement2 = mod6.isHTMLElement;
  var isInlineDomNode2 = mod6.isInlineDomNode;
  var isMimeType = mod6.isMimeType;
  var makeStateWrapper = mod6.makeStateWrapper;
  var markSelection = mod6.markSelection;
  var mediaFileReader = mod6.mediaFileReader;
  var mergeRegister = mod6.mergeRegister;
  var objectKlassEquals = mod6.objectKlassEquals;
  var positionNodeOnRange = mod6.positionNodeOnRange;
  var registerNestedElementResolver = mod6.registerNestedElementResolver;
  var removeClassNamesFromElement = mod6.removeClassNamesFromElement;
  var selectionAlwaysOnDisplay = mod6.selectionAlwaysOnDisplay;

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
    batch: () => F4,
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
  init_Lexical();
  init_Lexical();
  var T3 = /* @__PURE__ */ Symbol.for("preact-signals");
  function B4() {
    if (Z4 > 1) return void Z4--;
    let t9, e5 = false;
    for (; void 0 !== V4; ) {
      let n11 = V4;
      for (V4 = void 0, J4++; void 0 !== n11; ) {
        const i13 = n11.o;
        if (n11.o = void 0, n11.f &= -3, !(8 & n11.f) && Y4(n11)) try {
          n11.c();
        } catch (n12) {
          e5 || (t9 = n12, e5 = true);
        }
        n11 = i13;
      }
    }
    if (J4 = 0, Z4--, e5) throw t9;
  }
  function F4(t9) {
    if (Z4 > 0) return t9();
    Z4++;
    try {
      return t9();
    } finally {
      B4();
    }
  }
  var G4;
  var V4;
  function W4(t9) {
    const e5 = G4;
    G4 = void 0;
    try {
      return t9();
    } finally {
      G4 = e5;
    }
  }
  var Z4 = 0;
  var J4 = 0;
  var H4 = 0;
  function q4(t9) {
    if (void 0 === G4) return;
    let e5 = t9.n;
    return void 0 === e5 || e5.t !== G4 ? (e5 = { i: 0, S: t9, p: G4.s, n: void 0, t: G4, e: void 0, x: void 0, r: e5 }, void 0 !== G4.s && (G4.s.n = e5), G4.s = e5, t9.n = e5, 32 & G4.f && t9.S(e5), e5) : -1 === e5.i ? (e5.i = 0, void 0 !== e5.n && (e5.n.p = e5.p, void 0 !== e5.p && (e5.p.n = e5.n), e5.p = G4.s, e5.n = void 0, G4.s.n = e5, G4.s = e5), e5) : void 0;
  }
  function Q4(t9, e5) {
    this.v = t9, this.i = 0, this.n = void 0, this.t = void 0, this.W = null == e5 ? void 0 : e5.watched, this.Z = null == e5 ? void 0 : e5.unwatched, this.name = null == e5 ? void 0 : e5.name;
  }
  function X4(t9, e5) {
    return new Q4(t9, e5);
  }
  function Y4(t9) {
    for (let e5 = t9.s; void 0 !== e5; e5 = e5.n) if (e5.S.i !== e5.i || !e5.S.h() || e5.S.i !== e5.i) return true;
    return false;
  }
  function tt3(t9) {
    for (let e5 = t9.s; void 0 !== e5; e5 = e5.n) {
      const n11 = e5.S.n;
      if (void 0 !== n11 && (e5.r = n11), e5.S.n = e5, e5.i = -1, void 0 === e5.n) {
        t9.s = e5;
        break;
      }
    }
  }
  function et3(t9) {
    let e5, n11 = t9.s;
    for (; void 0 !== n11; ) {
      const t10 = n11.p;
      -1 === n11.i ? (n11.S.U(n11), void 0 !== t10 && (t10.n = n11.n), void 0 !== n11.n && (n11.n.p = t10)) : e5 = n11, n11.S.n = n11.r, void 0 !== n11.r && (n11.r = void 0), n11 = t10;
    }
    t9.s = e5;
  }
  function nt3(t9, e5) {
    Q4.call(this, void 0), this.x = t9, this.s = void 0, this.g = H4 - 1, this.f = 4, this.W = null == e5 ? void 0 : e5.watched, this.Z = null == e5 ? void 0 : e5.unwatched, this.name = null == e5 ? void 0 : e5.name;
  }
  function it3(t9, e5) {
    return new nt3(t9, e5);
  }
  function ot3(t9) {
    const e5 = t9.u;
    if (t9.u = void 0, "function" == typeof e5) {
      Z4++;
      const n11 = G4;
      G4 = void 0;
      try {
        e5();
      } catch (e6) {
        throw t9.f &= -2, t9.f |= 8, st3(t9), e6;
      } finally {
        G4 = n11, B4();
      }
    }
  }
  function st3(t9) {
    for (let e5 = t9.s; void 0 !== e5; e5 = e5.n) e5.S.U(e5);
    t9.x = void 0, t9.s = void 0, ot3(t9);
  }
  function rt3(t9) {
    if (G4 !== this) throw new Error("Out-of-order effect");
    et3(this), G4 = t9, this.f &= -2, 8 & this.f && st3(this), B4();
  }
  function ct3(t9, e5) {
    this.x = t9, this.u = void 0, this.s = void 0, this.o = void 0, this.f = 32, this.name = null == e5 ? void 0 : e5.name;
  }
  function dt3(t9, e5) {
    const n11 = new ct3(t9, e5);
    try {
      n11.c();
    } catch (t10) {
      throw n11.d(), t10;
    }
    const i13 = n11.d.bind(n11);
    return i13[Symbol.dispose] = i13, i13;
  }
  function at3(t9, e5 = {}) {
    const n11 = {};
    for (const i13 in t9) {
      const o8 = e5[i13], s7 = X4(void 0 === o8 ? t9[i13] : o8);
      n11[i13] = s7;
    }
    return n11;
  }
  Q4.prototype.brand = T3, Q4.prototype.h = function() {
    return true;
  }, Q4.prototype.S = function(t9) {
    const e5 = this.t;
    e5 !== t9 && void 0 === t9.e && (t9.x = e5, this.t = t9, void 0 !== e5 ? e5.e = t9 : W4(() => {
      var t10;
      null == (t10 = this.W) || t10.call(this);
    }));
  }, Q4.prototype.U = function(t9) {
    if (void 0 !== this.t) {
      const e5 = t9.e, n11 = t9.x;
      void 0 !== e5 && (e5.x = n11, t9.e = void 0), void 0 !== n11 && (n11.e = e5, t9.x = void 0), t9 === this.t && (this.t = n11, void 0 === n11 && W4(() => {
        var t10;
        null == (t10 = this.Z) || t10.call(this);
      }));
    }
  }, Q4.prototype.subscribe = function(t9) {
    return dt3(() => {
      const e5 = this.value, n11 = G4;
      G4 = void 0;
      try {
        t9(e5);
      } finally {
        G4 = n11;
      }
    }, { name: "sub" });
  }, Q4.prototype.valueOf = function() {
    return this.value;
  }, Q4.prototype.toString = function() {
    return this.value + "";
  }, Q4.prototype.toJSON = function() {
    return this.value;
  }, Q4.prototype.peek = function() {
    const t9 = G4;
    G4 = void 0;
    try {
      return this.value;
    } finally {
      G4 = t9;
    }
  }, Object.defineProperty(Q4.prototype, "value", { get() {
    const t9 = q4(this);
    return void 0 !== t9 && (t9.i = this.i), this.v;
  }, set(t9) {
    if (t9 !== this.v) {
      if (J4 > 100) throw new Error("Cycle detected");
      this.v = t9, this.i++, H4++, Z4++;
      try {
        for (let t10 = this.t; void 0 !== t10; t10 = t10.x) t10.t.N();
      } finally {
        B4();
      }
    }
  } }), nt3.prototype = new Q4(), nt3.prototype.h = function() {
    if (this.f &= -3, 1 & this.f) return false;
    if (32 == (36 & this.f)) return true;
    if (this.f &= -5, this.g === H4) return true;
    if (this.g = H4, this.f |= 1, this.i > 0 && !Y4(this)) return this.f &= -2, true;
    const t9 = G4;
    try {
      tt3(this), G4 = this;
      const t10 = this.x();
      (16 & this.f || this.v !== t10 || 0 === this.i) && (this.v = t10, this.f &= -17, this.i++);
    } catch (t10) {
      this.v = t10, this.f |= 16, this.i++;
    }
    return G4 = t9, et3(this), this.f &= -2, true;
  }, nt3.prototype.S = function(t9) {
    if (void 0 === this.t) {
      this.f |= 36;
      for (let t10 = this.s; void 0 !== t10; t10 = t10.n) t10.S.S(t10);
    }
    Q4.prototype.S.call(this, t9);
  }, nt3.prototype.U = function(t9) {
    if (void 0 !== this.t && (Q4.prototype.U.call(this, t9), void 0 === this.t)) {
      this.f &= -33;
      for (let t10 = this.s; void 0 !== t10; t10 = t10.n) t10.S.U(t10);
    }
  }, nt3.prototype.N = function() {
    if (!(2 & this.f)) {
      this.f |= 6;
      for (let t9 = this.t; void 0 !== t9; t9 = t9.x) t9.t.N();
    }
  }, Object.defineProperty(nt3.prototype, "value", { get() {
    if (1 & this.f) throw new Error("Cycle detected");
    const t9 = q4(this);
    if (this.h(), void 0 !== t9 && (t9.i = this.i), 16 & this.f) throw this.v;
    return this.v;
  } }), ct3.prototype.c = function() {
    const t9 = this.S();
    try {
      if (8 & this.f) return;
      if (void 0 === this.x) return;
      const t10 = this.x();
      "function" == typeof t10 && (this.u = t10);
    } finally {
      t9();
    }
  }, ct3.prototype.S = function() {
    if (1 & this.f) throw new Error("Cycle detected");
    this.f |= 1, this.f &= -9, ot3(this), tt3(this), Z4++;
    const t9 = G4;
    return G4 = this, rt3.bind(this, t9);
  }, ct3.prototype.N = function() {
    2 & this.f || (this.f |= 2, this.o = V4, V4 = this);
  }, ct3.prototype.d = function() {
    this.f |= 8, 1 & this.f || st3(this);
  }, ct3.prototype.dispose = function() {
    this.d();
  };
  var ut3 = defineExtension({ build: (t9, e5, n11) => at3(e5), config: safeCast({ defaultSelection: "rootEnd", disabled: false }), name: "@lexical/extension/AutoFocus", register(t9, e5, n11) {
    const i13 = n11.getOutput();
    return dt3(() => i13.disabled.value ? void 0 : t9.registerRootListener((e6) => {
      t9.focus(() => {
        const t10 = document.activeElement;
        null === e6 || null !== t10 && e6.contains(t10) || e6.focus({ preventScroll: true });
      }, { defaultSelection: i13.defaultSelection.peek() });
    }));
  } });
  function ft3() {
    const t9 = $getRoot(), e5 = $getSelection(), n11 = $createParagraphNode();
    t9.clear(), t9.append(n11), null !== e5 && n11.select(), $isRangeSelection(e5) && (e5.format = 0);
  }
  function ht3(t9, e5 = ft3) {
    return t9.registerCommand(CLEAR_EDITOR_COMMAND, (n11) => (t9.update(e5), true), COMMAND_PRIORITY_EDITOR);
  }
  var lt3 = defineExtension({ build: (t9, e5, n11) => at3(e5), config: safeCast({ $onClear: ft3 }), name: "@lexical/extension/ClearEditor", register(t9, e5, n11) {
    const { $onClear: i13 } = n11.getOutput();
    return dt3(() => ht3(t9, i13.value));
  } });
  function gt3(t9) {
    const e5 = /* @__PURE__ */ new Set(), n11 = /* @__PURE__ */ new Set();
    for (const i13 of pt3(t9)) {
      const t10 = "function" == typeof i13 ? i13 : i13.replace;
      e5.add(t10.getType()), n11.add(t10);
    }
    return { nodes: n11, types: e5 };
  }
  function pt3(t9) {
    return ("function" == typeof t9.nodes ? t9.nodes() : t9.nodes) || [];
  }
  function mt3(t9, e5) {
    let n11;
    return X4(t9(), { unwatched() {
      n11 && (n11(), n11 = void 0);
    }, watched() {
      this.value = t9(), n11 = e5(this);
    } });
  }
  var vt3 = defineExtension({ build: (t9) => mt3(() => t9.getEditorState(), (e5) => t9.registerUpdateListener((t10) => {
    e5.value = t10.editorState;
  })), name: "@lexical/extension/EditorState" });
  function xt3(t9, ...e5) {
    const n11 = new URL("https://lexical.dev/docs/error"), i13 = new URLSearchParams();
    i13.append("code", t9);
    for (const t10 of e5) i13.append("v", t10);
    throw n11.search = i13.toString(), Error(`Minified Lexical error #${t9}; visit ${n11.toString()} for the full message or use the non-minified dev environment for full errors and additional helpful warnings.`);
  }
  function yt3(t9, e5) {
    if (t9 && e5 && !Array.isArray(e5) && "object" == typeof t9 && "object" == typeof e5) {
      const n11 = t9, i13 = e5;
      for (const t10 in i13) n11[t10] = yt3(n11[t10], i13[t10]);
      return t9;
    }
    return e5;
  }
  var St3 = 0;
  var Et3 = 1;
  var bt3 = 2;
  var wt3 = 3;
  var Nt3 = 4;
  var Ot3 = 5;
  var Rt3 = 6;
  var Mt3 = 7;
  function Ct3(t9) {
    return t9.id === St3;
  }
  function Dt3(t9) {
    return t9.id === bt3;
  }
  function _t3(t9) {
    return (function(t10) {
      return t10.id === Et3;
    })(t9) || xt3(305, String(t9.id), String(Et3)), Object.assign(t9, { id: bt3 });
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
    constructor(t9, e5) {
      this.builder = t9, this.extension = e5, this.configs = /* @__PURE__ */ new Set(), this.state = { id: St3 };
    }
    mergeConfigs() {
      let t9 = this.extension.config || {};
      const e5 = this.extension.mergeConfig ? this.extension.mergeConfig.bind(this.extension) : shallowMergeConfig;
      for (const n11 of this.configs) t9 = e5(t9, n11);
      return t9;
    }
    init(t9) {
      const e5 = this.state;
      Dt3(e5) || xt3(306, String(e5.id));
      const n11 = { getDependency: this.getInitDependency.bind(this), getDirectDependentNames: this.getDirectDependentNames.bind(this), getPeer: this.getInitPeer.bind(this), getPeerNameSet: this.getPeerNameSet.bind(this) }, i13 = { ...n11, getDependency: this.getDependency.bind(this), getInitResult: this.getInitResult.bind(this), getPeer: this.getPeer.bind(this) }, o8 = (function(t10, e6, n12) {
        return Object.assign(t10, { config: e6, id: wt3, registerState: n12 });
      })(e5, this.mergeConfigs(), n11);
      let s7;
      this.state = o8, this.extension.init && (s7 = this.extension.init(t9, o8.config, n11)), this.state = (function(t10, e6, n12) {
        return Object.assign(t10, { id: Nt3, initResult: e6, registerState: n12 });
      })(o8, s7, i13);
    }
    build(t9) {
      const e5 = this.state;
      let n11;
      e5.id !== Nt3 && xt3(307, String(e5.id), String(Ot3)), this.extension.build && (n11 = this.extension.build(t9, e5.config, e5.registerState));
      const i13 = { ...e5.registerState, getOutput: () => n11, getSignal: this.getSignal.bind(this) };
      this.state = (function(t10, e6, n12) {
        return Object.assign(t10, { id: Ot3, output: e6, registerState: n12 });
      })(e5, n11, i13);
    }
    register(t9, e5) {
      this._signal = e5;
      const n11 = this.state;
      n11.id !== Ot3 && xt3(308, String(n11.id), String(Ot3));
      const i13 = this.extension.register && this.extension.register(t9, n11.config, n11.registerState);
      return this.state = (function(t10) {
        return Object.assign(t10, { id: Rt3 });
      })(n11), () => {
        const t10 = this.state;
        t10.id !== Mt3 && xt3(309, String(n11.id), String(Mt3)), this.state = (function(t11) {
          return Object.assign(t11, { id: Ot3 });
        })(t10), i13 && i13();
      };
    }
    afterRegistration(t9) {
      const e5 = this.state;
      let n11;
      return e5.id !== Rt3 && xt3(310, String(e5.id), String(Rt3)), this.extension.afterRegistration && (n11 = this.extension.afterRegistration(t9, e5.config, e5.registerState)), this.state = (function(t10) {
        return Object.assign(t10, { id: Mt3 });
      })(e5), n11;
    }
    getSignal() {
      return void 0 === this._signal && xt3(311), this._signal;
    }
    getInitResult() {
      void 0 === this.extension.init && xt3(312, this.extension.name);
      const t9 = this.state;
      return (function(t10) {
        return t10.id >= Nt3;
      })(t9) || xt3(313, String(t9.id), String(Nt3)), t9.initResult;
    }
    getInitPeer(t9) {
      const e5 = this.builder.extensionNameMap.get(t9);
      return e5 ? e5.getExtensionInitDependency() : void 0;
    }
    getExtensionInitDependency() {
      const t9 = this.state;
      return (function(t10) {
        return t10.id >= wt3;
      })(t9) || xt3(314, String(t9.id), String(wt3)), { config: t9.config };
    }
    getPeer(t9) {
      const e5 = this.builder.extensionNameMap.get(t9);
      return e5 ? e5.getExtensionDependency() : void 0;
    }
    getInitDependency(t9) {
      const e5 = this.builder.getExtensionRep(t9);
      return void 0 === e5 && xt3(315, this.extension.name, t9.name), e5.getExtensionInitDependency();
    }
    getDependency(t9) {
      const e5 = this.builder.getExtensionRep(t9);
      return void 0 === e5 && xt3(315, this.extension.name, t9.name), e5.getExtensionDependency();
    }
    getState() {
      const t9 = this.state;
      return (function(t10) {
        return t10.id >= Mt3;
      })(t9) || xt3(316, String(t9.id), String(Mt3)), t9;
    }
    getDirectDependentNames() {
      return this.builder.incomingEdges.get(this.extension.name) || It2;
    }
    getPeerNameSet() {
      let t9 = this._peerNameSet;
      return t9 || (t9 = new Set((this.extension.peerDependencies || []).map(([t10]) => t10)), this._peerNameSet = t9), t9;
    }
    getExtensionDependency() {
      if (!this._dependency) {
        const t9 = this.state;
        (function(t10) {
          return t10.id >= Ot3;
        })(t9) || xt3(317, this.extension.name), this._dependency = { config: t9.config, init: t9.initResult, output: t9.output };
      }
      return this._dependency;
    }
  };
  var At3 = { tag: HISTORY_MERGE_TAG };
  function Pt3() {
    const t9 = $getRoot();
    t9.isEmpty() && t9.append($createParagraphNode());
  }
  var Kt3 = defineExtension({ config: safeCast({ setOptions: At3, updateOptions: At3 }), init: ({ $initialEditorState: t9 = Pt3 }) => ({ $initialEditorState: t9, initialized: false }), afterRegistration(t9, { updateOptions: e5, setOptions: n11 }, i13) {
    const o8 = i13.getInitResult();
    if (!o8.initialized) {
      o8.initialized = true;
      const { $initialEditorState: i14 } = o8;
      if ($isEditorState(i14)) t9.setEditorState(i14, n11);
      else if ("function" == typeof i14) t9.update(() => {
        i14(t9);
      }, e5);
      else if (i14 && ("string" == typeof i14 || "object" == typeof i14)) {
        const e6 = t9.parseEditorState(i14);
        t9.setEditorState(e6, n11);
      }
    }
    return () => {
    };
  }, name: "@lexical/extension/InitialState", nodes: [RootNode, TextNode, LineBreakNode, TabNode, ParagraphNode] });
  var kt3 = /* @__PURE__ */ Symbol.for("@lexical/extension/LexicalBuilder");
  function $t3(...t9) {
    return Bt3.fromExtensions(t9).buildEditor();
  }
  function zt2() {
  }
  function Ut2(t9) {
    throw t9;
  }
  function Lt3(t9) {
    return Array.isArray(t9) ? t9 : [t9];
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
    constructor(t9) {
      this.outgoingConfigEdges = /* @__PURE__ */ new Map(), this.incomingEdges = /* @__PURE__ */ new Map(), this.extensionNameMap = /* @__PURE__ */ new Map(), this.conflicts = /* @__PURE__ */ new Map(), this.PACKAGE_VERSION = Tt3, this.roots = t9;
      for (const e5 of t9) this.addExtension(e5);
    }
    static fromExtensions(t9) {
      const e5 = [Lt3(Kt3)];
      for (const n11 of t9) e5.push(Lt3(n11));
      return new _Bt(e5);
    }
    static maybeFromEditor(t9) {
      const e5 = t9[kt3];
      return e5 && (e5.PACKAGE_VERSION !== Tt3 && xt3(292, e5.PACKAGE_VERSION, Tt3), e5 instanceof _Bt || xt3(293)), e5;
    }
    static fromEditor(t9) {
      const e5 = _Bt.maybeFromEditor(t9);
      return void 0 === e5 && xt3(294), e5;
    }
    constructEditor() {
      const { $initialEditorState: t9, onError: e5, ...n11 } = this.buildCreateEditorArgs(), i13 = Object.assign(createEditor({ ...n11, ...e5 ? { onError: (t10) => {
        e5(t10, i13);
      } } : {} }), { [kt3]: this });
      for (const t10 of this.sortedExtensionReps()) t10.build(i13);
      return i13;
    }
    buildEditor() {
      let t9 = zt2;
      function e5() {
        try {
          t9();
        } finally {
          t9 = zt2;
        }
      }
      const n11 = Object.assign(this.constructEditor(), { dispose: e5, [Symbol.dispose]: e5 });
      return t9 = mergeRegister(this.registerEditor(n11), () => n11.setRootElement(null)), n11;
    }
    hasExtensionByName(t9) {
      return this.extensionNameMap.has(t9);
    }
    getExtensionRep(t9) {
      const e5 = this.extensionNameMap.get(t9.name);
      if (e5) return e5.extension !== t9 && xt3(295, t9.name), e5;
    }
    addEdge(t9, e5, n11) {
      const i13 = this.outgoingConfigEdges.get(t9);
      i13 ? i13.set(e5, n11) : this.outgoingConfigEdges.set(t9, /* @__PURE__ */ new Map([[e5, n11]]));
      const o8 = this.incomingEdges.get(e5);
      o8 ? o8.add(t9) : this.incomingEdges.set(e5, /* @__PURE__ */ new Set([t9]));
    }
    addExtension(t9) {
      void 0 !== this._sortedExtensionReps && xt3(296);
      const e5 = Lt3(t9), [n11] = e5;
      "string" != typeof n11.name && xt3(297, typeof n11.name);
      let i13 = this.extensionNameMap.get(n11.name);
      if (void 0 !== i13 && i13.extension !== n11 && xt3(298, n11.name), !i13) {
        i13 = new jt3(this, n11), this.extensionNameMap.set(n11.name, i13);
        const t10 = this.conflicts.get(n11.name);
        "string" == typeof t10 && xt3(299, n11.name, t10);
        for (const t11 of n11.conflictsWith || []) this.extensionNameMap.has(t11) && xt3(299, n11.name, t11), this.conflicts.set(t11, n11.name);
        for (const t11 of n11.dependencies || []) {
          const e6 = Lt3(t11);
          this.addEdge(n11.name, e6[0].name, e6.slice(1)), this.addExtension(e6);
        }
        for (const [t11, e6] of n11.peerDependencies || []) this.addEdge(n11.name, t11, e6 ? [e6] : []);
      }
    }
    sortedExtensionReps() {
      if (this._sortedExtensionReps) return this._sortedExtensionReps;
      const t9 = [], e5 = (n11, i13) => {
        let o8 = n11.state;
        if (Dt3(o8)) return;
        const s7 = n11.extension.name;
        var r9;
        Ct3(o8) || xt3(300, s7, i13 || "[unknown]"), Ct3(r9 = o8) || xt3(304, String(r9.id), String(St3)), o8 = Object.assign(r9, { id: Et3 }), n11.state = o8;
        const c10 = this.outgoingConfigEdges.get(s7);
        if (c10) for (const t10 of c10.keys()) {
          const n12 = this.extensionNameMap.get(t10);
          n12 && e5(n12, s7);
        }
        o8 = _t3(o8), n11.state = o8, t9.push(n11);
      };
      for (const t10 of this.extensionNameMap.values()) Ct3(t10.state) && e5(t10);
      for (const e6 of t9) for (const [t10, n11] of this.outgoingConfigEdges.get(e6.extension.name) || []) if (n11.length > 0) {
        const e7 = this.extensionNameMap.get(t10);
        if (e7) for (const t11 of n11) e7.configs.add(t11);
      }
      for (const [t10, ...e6] of this.roots) if (e6.length > 0) {
        const n11 = this.extensionNameMap.get(t10.name);
        void 0 === n11 && xt3(301, t10.name);
        for (const t11 of e6) n11.configs.add(t11);
      }
      return this._sortedExtensionReps = t9, this._sortedExtensionReps;
    }
    registerEditor(t9) {
      const e5 = this.sortedExtensionReps(), n11 = new AbortController(), i13 = [() => n11.abort()], o8 = n11.signal;
      for (const n12 of e5) {
        const e6 = n12.register(t9, o8);
        e6 && i13.push(e6);
      }
      for (const n12 of e5) {
        const e6 = n12.afterRegistration(t9);
        e6 && i13.push(e6);
      }
      return mergeRegister(...i13);
    }
    buildCreateEditorArgs() {
      const t9 = {}, e5 = /* @__PURE__ */ new Set(), n11 = /* @__PURE__ */ new Map(), i13 = /* @__PURE__ */ new Map(), o8 = {}, s7 = {}, r9 = this.sortedExtensionReps();
      for (const c11 of r9) {
        const { extension: r10 } = c11;
        if (void 0 !== r10.onError && (t9.onError = r10.onError), void 0 !== r10.disableEvents && (t9.disableEvents = r10.disableEvents), void 0 !== r10.parentEditor && (t9.parentEditor = r10.parentEditor), void 0 !== r10.editable && (t9.editable = r10.editable), void 0 !== r10.namespace && (t9.namespace = r10.namespace), void 0 !== r10.$initialEditorState && (t9.$initialEditorState = r10.$initialEditorState), r10.nodes) for (const t10 of pt3(r10)) {
          if ("function" != typeof t10) {
            const e6 = n11.get(t10.replace);
            e6 && xt3(302, r10.name, t10.replace.name, e6.extension.name), n11.set(t10.replace, c11);
          }
          e5.add(t10);
        }
        if (r10.html) {
          if (r10.html.export) for (const [t10, e6] of r10.html.export.entries()) i13.set(t10, e6);
          r10.html.import && Object.assign(o8, r10.html.import);
        }
        r10.theme && yt3(s7, r10.theme);
      }
      Object.keys(s7).length > 0 && (t9.theme = s7), e5.size && (t9.nodes = [...e5]);
      const c10 = Object.keys(o8).length > 0, d8 = i13.size > 0;
      (c10 || d8) && (t9.html = {}, c10 && (t9.html.import = o8), d8 && (t9.html.export = i13));
      for (const e6 of r9) e6.init(t9);
      return t9.onError || (t9.onError = Ut2), t9;
    }
  };
  function Ft2(t9, e5) {
    const n11 = Bt3.fromEditor(t9).getExtensionRep(e5);
    return void 0 === n11 && xt3(303, e5.name), n11.getExtensionDependency();
  }
  function Gt2(t9, e5) {
    const n11 = Bt3.fromEditor(t9).extensionNameMap.get(e5);
    return n11 ? n11.getExtensionDependency() : void 0;
  }
  function Vt2(t9, e5) {
    const n11 = Gt2(t9, e5);
    return void 0 === n11 && xt3(291, e5), n11;
  }
  var Wt2 = /* @__PURE__ */ new Set();
  var Zt2 = defineExtension({ build(t9, e5, n11) {
    const i13 = n11.getDependency(vt3).output, o8 = X4({ watchedNodeKeys: /* @__PURE__ */ new Map() }), r9 = mt3(() => {
    }, () => dt3(() => {
      const t10 = r9.peek(), { watchedNodeKeys: e6 } = o8.value;
      let n12, c10 = false;
      i13.value.read(() => {
        if ($getSelection()) for (const [i14, o9] of e6.entries()) {
          if (0 === o9.size) {
            e6.delete(i14);
            continue;
          }
          const s7 = $getNodeByKey(i14), r10 = s7 && s7.isSelected() || false;
          c10 = c10 || r10 !== (!!t10 && t10.has(i14)), r10 && (n12 = n12 || /* @__PURE__ */ new Set(), n12.add(i14));
        }
      }), !c10 && n12 && t10 && n12.size === t10.size || (r9.value = n12);
    }));
    return { watchNodeKey: function(t10) {
      const e6 = it3(() => (r9.value || Wt2).has(t10)), { watchedNodeKeys: n12 } = o8.peek();
      let i14 = n12.get(t10);
      const s7 = void 0 !== i14;
      return i14 = i14 || /* @__PURE__ */ new Set(), i14.add(e6), s7 || (n12.set(t10, i14), o8.value = { watchedNodeKeys: n12 }), e6;
    } };
  }, dependencies: [vt3], name: "@lexical/extension/NodeSelection" });
  var Jt2 = createCommand("INSERT_HORIZONTAL_RULE_COMMAND");
  var Ht3 = class _Ht extends DecoratorNode {
    static getType() {
      return "horizontalrule";
    }
    static clone(t9) {
      return new _Ht(t9.__key);
    }
    static importJSON(t9) {
      return Qt2().updateFromJSON(t9);
    }
    static importDOM() {
      return { hr: () => ({ conversion: qt2, priority: 0 }) };
    }
    exportDOM() {
      return { element: document.createElement("hr") };
    }
    createDOM(t9) {
      const e5 = document.createElement("hr");
      return addClassNamesToElement(e5, t9.theme.hr), e5;
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
  function Xt2(t9) {
    return t9 instanceof Ht3;
  }
  var Yt2 = defineExtension({ dependencies: [vt3, Zt2], name: "@lexical/extension/HorizontalRule", nodes: () => [Ht3], register(t9, e5, n11) {
    const { watchNodeKey: i13 } = n11.getDependency(Zt2).output, o8 = X4({ nodeSelections: /* @__PURE__ */ new Map() }), r9 = t9._config.theme.hrSelected ?? "selected";
    return mergeRegister(t9.registerCommand(CLICK_COMMAND, (t10) => {
      if (isDOMNode(t10.target)) {
        const e6 = $getNodeFromDOMNode(t10.target);
        if (Xt2(e6)) return (function(t11, e7 = false) {
          const n12 = $getSelection(), i14 = t11.isSelected(), o9 = t11.getKey();
          let r10;
          e7 && $isNodeSelection(n12) ? r10 = n12 : (r10 = $createNodeSelection(), $setSelection(r10)), i14 ? r10.delete(o9) : r10.add(o9);
        })(e6, t10.shiftKey), true;
      }
      return false;
    }, COMMAND_PRIORITY_LOW), t9.registerMutationListener(Ht3, (e6, n12) => {
      F4(() => {
        let n13 = false;
        const { nodeSelections: s7 } = o8.peek();
        for (const [o9, r10] of e6.entries()) if ("destroyed" === r10) s7.delete(o9), n13 = true;
        else {
          const e7 = s7.get(o9), r11 = t9.getElementByKey(o9);
          e7 ? e7.domNode.value = r11 : (n13 = true, s7.set(o9, { domNode: X4(r11), selectedSignal: i13(o9) }));
        }
        n13 && (o8.value = { nodeSelections: s7 });
      });
    }), dt3(() => {
      const t10 = [];
      for (const { domNode: e6, selectedSignal: n12 } of o8.value.nodeSelections.values()) t10.push(dt3(() => {
        const t11 = e6.value;
        if (t11) {
          n12.value ? addClassNamesToElement(t11, r9) : removeClassNamesFromElement(t11, r9);
        }
      }));
      return mergeRegister(...t10);
    }));
  } });
  function te3(t9, e5) {
    return mergeRegister(t9.registerCommand(KEY_TAB_COMMAND, (e6) => {
      const n11 = $getSelection();
      if (!$isRangeSelection(n11)) return false;
      e6.preventDefault();
      const i13 = (function(t10) {
        const e7 = t10.getNodes();
        if ($filter(e7, (t11) => $isBlockElementNode(t11) && t11.canIndent() ? t11 : null).length > 0) return true;
        const n12 = t10.anchor, i14 = t10.focus, o8 = i14.isBefore(n12) ? i14 : n12, s7 = o8.getNode(), r9 = $getNearestBlockElementAncestorOrThrow(s7);
        if (r9.canIndent()) {
          const t11 = r9.getKey();
          let e8 = $createRangeSelection();
          if (e8.anchor.set(t11, 0, "element"), e8.focus.set(t11, 0, "element"), e8 = $normalizeSelection__EXPERIMENTAL(e8), e8.anchor.is(o8)) return true;
        }
        return false;
      })(n11) ? e6.shiftKey ? OUTDENT_CONTENT_COMMAND : INDENT_CONTENT_COMMAND : INSERT_TAB_COMMAND;
      return t9.dispatchCommand(i13, void 0);
    }, COMMAND_PRIORITY_EDITOR), t9.registerCommand(INDENT_CONTENT_COMMAND, () => {
      const t10 = "number" == typeof e5 ? e5 : e5 ? e5.peek() : null;
      if (null == t10) return false;
      const n11 = $getSelection();
      if (!$isRangeSelection(n11)) return false;
      const i13 = n11.getNodes().map((t11) => $getNearestBlockElementAncestorOrThrow(t11).getIndent());
      return Math.max(...i13) + 1 >= t10;
    }, COMMAND_PRIORITY_CRITICAL));
  }
  var ee3 = defineExtension({ build: (t9, e5, n11) => at3(e5), config: safeCast({ disabled: false, maxIndent: null }), name: "@lexical/extension/TabIndentation", register(t9, e5, n11) {
    const { disabled: i13, maxIndent: o8 } = n11.getOutput();
    return dt3(() => {
      if (!i13.value) return te3(t9, o8);
    });
  } });

  // node_modules/@lexical/extension/LexicalExtension.mjs
  var mod7 = false ? LexicalExtension_dev_exports : LexicalExtension_prod_exports;
  var $createHorizontalRuleNode = mod7.$createHorizontalRuleNode;
  var $isHorizontalRuleNode = mod7.$isHorizontalRuleNode;
  var AutoFocusExtension = mod7.AutoFocusExtension;
  var ClearEditorExtension = mod7.ClearEditorExtension;
  var EditorStateExtension = mod7.EditorStateExtension;
  var HorizontalRuleExtension = mod7.HorizontalRuleExtension;
  var HorizontalRuleNode = mod7.HorizontalRuleNode;
  var INSERT_HORIZONTAL_RULE_COMMAND = mod7.INSERT_HORIZONTAL_RULE_COMMAND;
  var InitialStateExtension = mod7.InitialStateExtension;
  var LexicalBuilder = mod7.LexicalBuilder;
  var NodeSelectionExtension = mod7.NodeSelectionExtension;
  var TabIndentationExtension = mod7.TabIndentationExtension;
  var batch = mod7.batch;
  var buildEditorFromExtensions = mod7.buildEditorFromExtensions;
  var computed = mod7.computed;
  var configExtension2 = mod7.configExtension;
  var declarePeerDependency2 = mod7.declarePeerDependency;
  var defineExtension2 = mod7.defineExtension;
  var effect = mod7.effect;
  var getExtensionDependencyFromEditor = mod7.getExtensionDependencyFromEditor;
  var getKnownTypesAndNodes = mod7.getKnownTypesAndNodes;
  var getPeerDependencyFromEditor = mod7.getPeerDependencyFromEditor;
  var getPeerDependencyFromEditorOrThrow = mod7.getPeerDependencyFromEditorOrThrow;
  var namedSignals = mod7.namedSignals;
  var registerClearEditor = mod7.registerClearEditor;
  var registerTabIndentation = mod7.registerTabIndentation;
  var safeCast2 = mod7.safeCast;
  var shallowMergeConfig2 = mod7.shallowMergeConfig;
  var signal = mod7.signal;
  var untracked = mod7.untracked;
  var watchedSignal = mod7.watchedSignal;

  // node_modules/@lexical/react/LexicalReactProviderExtension.prod.mjs
  var LexicalReactProviderExtension_prod_exports = {};
  __export(LexicalReactProviderExtension_prod_exports, {
    ReactProviderExtension: () => r4
  });
  init_Lexical();
  var r4 = defineExtension({ name: "@lexical/react/ReactProvider" });

  // node_modules/@lexical/react/LexicalReactProviderExtension.mjs
  var mod8 = false ? LexicalReactProviderExtension_dev_exports : LexicalReactProviderExtension_prod_exports;
  var ReactProviderExtension = mod8.ReactProviderExtension;

  // node_modules/@lexical/text/LexicalText.prod.mjs
  var LexicalText_prod_exports = {};
  __export(LexicalText_prod_exports, {
    $canShowPlaceholder: () => c4,
    $canShowPlaceholderCurry: () => g2,
    $findTextIntersectionFromCharacters: () => a3,
    $isRootTextContentEmpty: () => f3,
    $isRootTextContentEmptyCurry: () => u4,
    $rootTextContent: () => s2,
    registerLexicalTextEntity: () => x2
  });
  init_Lexical();
  function s2() {
    return $getRoot().getTextContent();
  }
  function f3(t9, e5 = true) {
    if (t9) return false;
    let n11 = s2();
    return e5 && (n11 = n11.trim()), "" === n11;
  }
  function u4(t9, e5) {
    return () => f3(t9, e5);
  }
  function c4(o8) {
    if (!f3(o8, false)) return false;
    const l8 = $getRoot().getChildren(), s7 = l8.length;
    if (s7 > 1) return false;
    for (let t9 = 0; t9 < s7; t9++) {
      const o9 = l8[t9];
      if ($isDecoratorNode(o9)) return false;
      if ($isElementNode(o9)) {
        if (!$isParagraphNode(o9)) return false;
        if (0 !== o9.__indent) return false;
        const e5 = o9.getChildren(), n11 = e5.length;
        for (let r9 = 0; r9 < n11; r9++) {
          const n12 = e5[t9];
          if (!$isTextNode(n12)) return false;
        }
      }
    }
    return true;
  }
  function g2(t9) {
    return () => c4(t9);
  }
  function a3(t9, e5) {
    let r9 = t9.getFirstChild(), o8 = 0;
    t: for (; null !== r9; ) {
      if ($isElementNode(r9)) {
        const t11 = r9.getFirstChild();
        if (null !== t11) {
          r9 = t11;
          continue;
        }
      } else if ($isTextNode(r9)) {
        const t11 = r9.getTextContentSize();
        if (o8 + t11 > e5) return { node: r9, offset: e5 - o8 };
        o8 += t11;
      }
      const t10 = r9.getNextSibling();
      if (null !== t10) {
        r9 = t10;
        continue;
      }
      let l8 = r9.getParent();
      for (; null !== l8; ) {
        const t11 = l8.getNextSibling();
        if (null !== t11) {
          r9 = t11;
          continue t;
        }
        l8 = l8.getParent();
      }
      break;
    }
    return null;
  }
  function d3(t9, ...e5) {
    const n11 = new URL("https://lexical.dev/docs/error"), r9 = new URLSearchParams();
    r9.append("code", t9);
    for (const t10 of e5) r9.append("v", t10);
    throw n11.search = r9.toString(), Error(`Minified Lexical error #${t9}; visit ${n11.toString()} for the full message or use the non-minified dev environment for full errors and additional helpful warnings.`);
  }
  function x2(t9, e5, n11, r9) {
    const s7 = (t10) => t10 instanceof n11, f8 = (t10) => {
      const e6 = $createTextNode(t10.getTextContent());
      e6.setFormat(t10.getFormat()), t10.replace(e6);
    };
    return [t9.registerNodeTransform(TextNode, (t10) => {
      if (!t10.isSimpleText()) return;
      let n12, o8 = t10.getPreviousSibling(), l8 = t10.getTextContent(), u10 = t10;
      if ($isTextNode(o8)) {
        const n13 = o8.getTextContent(), r10 = e5(n13 + l8);
        if (s7(o8)) {
          if (null === r10 || 0 !== ((t11) => t11.getLatest().__mode)(o8)) return void f8(o8);
          {
            const e6 = r10.end - n13.length;
            if (e6 > 0) {
              const r11 = n13 + l8.slice(0, e6);
              if (o8.select(), o8.setTextContent(r11), e6 === l8.length) t10.remove();
              else {
                const n14 = l8.slice(e6);
                t10.setTextContent(n14);
              }
              return;
            }
          }
        } else if (null === r10 || r10.start < n13.length) return;
      }
      let c10 = 0;
      for (; ; ) {
        n12 = e5(l8);
        let t11, g5 = null === n12 ? "" : l8.slice(n12.end);
        if (l8 = g5, "" === g5) {
          const t12 = u10.getNextSibling();
          if ($isTextNode(t12)) {
            g5 = u10.getTextContent() + t12.getTextContent();
            const n13 = e5(g5);
            if (null === n13) return void (s7(t12) ? f8(t12) : t12.markDirty());
            if (0 !== n13.start) return;
          }
        }
        if (null === n12) return;
        if (0 === n12.start && $isTextNode(o8) && o8.isTextEntity()) {
          c10 += n12.end;
          continue;
        }
        0 === n12.start ? [t11, u10] = u10.splitText(n12.end) : [, t11, u10] = u10.splitText(n12.start + c10, n12.end + c10), void 0 === t11 && d3(165, "nodeToReplace");
        const a10 = r9(t11);
        if (a10.setFormat(t11.getFormat()), t11.replace(a10), null == u10) return;
        c10 = 0, o8 = a10;
      }
    }), t9.registerNodeTransform(n11, (t10) => {
      const n12 = t10.getTextContent(), r10 = e5(n12);
      if (null === r10 || 0 !== r10.start) return void f8(t10);
      if (n12.length > r10.end) return void t10.splitText(r10.end);
      const o8 = t10.getPreviousSibling();
      $isTextNode(o8) && o8.isTextEntity() && (f8(o8), f8(t10));
      const l8 = t10.getNextSibling();
      $isTextNode(l8) && l8.isTextEntity() && (f8(l8), s7(t10) && f8(t10));
    })];
  }

  // node_modules/@lexical/text/LexicalText.mjs
  var mod9 = false ? LexicalText_dev_exports : LexicalText_prod_exports;
  var $canShowPlaceholder = mod9.$canShowPlaceholder;
  var $canShowPlaceholderCurry = mod9.$canShowPlaceholderCurry;
  var $findTextIntersectionFromCharacters = mod9.$findTextIntersectionFromCharacters;
  var $isRootTextContentEmpty = mod9.$isRootTextContentEmpty;
  var $isRootTextContentEmptyCurry = mod9.$isRootTextContentEmptyCurry;
  var $rootTextContent = mod9.$rootTextContent;
  var registerLexicalTextEntity = mod9.registerLexicalTextEntity;

  // node_modules/@lexical/dragon/LexicalDragon.prod.mjs
  var LexicalDragon_prod_exports = {};
  __export(LexicalDragon_prod_exports, {
    DragonExtension: () => d4,
    registerDragonSupport: () => s3
  });
  init_Lexical();
  function s3(e5) {
    const t9 = window.location.origin, n11 = (n12) => {
      if (n12.origin !== t9) return;
      const o8 = e5.getRootElement();
      if (document.activeElement !== o8) return;
      const s7 = n12.data;
      if ("string" == typeof s7) {
        let t10;
        try {
          t10 = JSON.parse(s7);
        } catch (e6) {
          return;
        }
        if (t10 && "nuanria_messaging" === t10.protocol && "request" === t10.type) {
          const o9 = t10.payload;
          if (o9 && "makeChanges" === o9.functionId) {
            const t11 = o9.args;
            if (t11) {
              const [o10, s8, d8, c10, g5] = t11;
              e5.update(() => {
                const e6 = $getSelection();
                if ($isRangeSelection(e6)) {
                  const t12 = e6.anchor;
                  let i13 = t12.getNode(), a10 = 0, l8 = 0;
                  if ($isTextNode(i13) && o10 >= 0 && s8 >= 0 && (a10 = o10, l8 = o10 + s8, e6.setTextNodeRange(i13, a10, i13, l8)), a10 === l8 && "" === d8 || (e6.insertRawText(d8), i13 = t12.getNode()), $isTextNode(i13)) {
                    a10 = c10, l8 = c10 + g5;
                    const t13 = i13.getTextContentSize();
                    a10 = a10 > t13 ? t13 : a10, l8 = l8 > t13 ? t13 : l8, e6.setTextNodeRange(i13, a10, i13, l8);
                  }
                  n12.stopImmediatePropagation();
                }
              });
            }
          }
        }
      }
    };
    return window.addEventListener("message", n11, true), () => {
      window.removeEventListener("message", n11, true);
    };
  }
  var d4 = defineExtension({ build: (e5, n11, o8) => namedSignals(n11), config: safeCast({ disabled: "undefined" == typeof window }), name: "@lexical/dragon", register: (t9, n11, o8) => effect(() => o8.getOutput().disabled.value ? void 0 : s3(t9)) });

  // node_modules/@lexical/dragon/LexicalDragon.mjs
  var mod10 = false ? LexicalDragon_dev_exports : LexicalDragon_prod_exports;
  var DragonExtension = mod10.DragonExtension;
  var registerDragonSupport = mod10.registerDragonSupport;

  // node_modules/@lexical/html/LexicalHtml.prod.mjs
  var LexicalHtml_prod_exports = {};
  __export(LexicalHtml_prod_exports, {
    $generateHtmlFromNodes: () => g3,
    $generateNodesFromDOM: () => m3
  });
  init_LexicalSelection();
  init_Lexical();
  function m3(e5, n11) {
    const t9 = isDOMDocumentNode(n11) ? n11.body.childNodes : n11.childNodes;
    let l8 = [];
    const r9 = [];
    for (const n12 of t9) if (!w2.has(n12.nodeName)) {
      const t10 = y2(n12, e5, r9, false);
      null !== t10 && (l8 = l8.concat(t10));
    }
    return (function(e6) {
      for (const n12 of e6) n12.getNextSibling() instanceof ArtificialNode__DO_NOT_USE && n12.insertAfter($createLineBreakNode());
      for (const n12 of e6) {
        const e7 = n12.getChildren();
        for (const t10 of e7) n12.insertBefore(t10);
        n12.remove();
      }
    })(r9), l8;
  }
  function g3(e5, n11) {
    if ("undefined" == typeof document || "undefined" == typeof window && void 0 === global.window) throw new Error("To use $generateHtmlFromNodes in headless mode please initialize a headless browser implementation such as JSDom before calling this function.");
    const t9 = document.createElement("div"), o8 = $getRoot().getChildren();
    for (let l8 = 0; l8 < o8.length; l8++) {
      x3(e5, o8[l8], t9, n11);
    }
    return t9.innerHTML;
  }
  function x3(t9, o8, l8, u10 = null) {
    let f8 = null === u10 || o8.isSelected(u10);
    const a10 = $isElementNode(o8) && o8.excludeFromCopy("html");
    let d8 = o8;
    null !== u10 && $isTextNode(o8) && (d8 = $sliceSelectedTextNodeContent(u10, o8, "clone"));
    const p7 = $isElementNode(d8) ? d8.getChildren() : [], h3 = getRegisteredNode(t9, d8.getType());
    let m9;
    m9 = h3 && void 0 !== h3.exportDOM ? h3.exportDOM(t9, d8) : d8.exportDOM(t9);
    const { element: g5, after: w6 } = m9;
    if (!g5) return false;
    const y6 = document.createDocumentFragment();
    for (let e5 = 0; e5 < p7.length; e5++) {
      const n11 = p7[e5], l9 = x3(t9, n11, y6, u10);
      !f8 && $isElementNode(o8) && l9 && o8.extractWithChild(n11, u10, "html") && (f8 = true);
    }
    if (f8 && !a10) {
      if ((isHTMLElement2(g5) || isDocumentFragment(g5)) && g5.append(y6), l8.append(g5), w6) {
        const e5 = w6.call(d8, g5);
        e5 && (isDocumentFragment(g5) ? g5.replaceChildren(e5) : g5.replaceWith(e5));
      }
    } else l8.append(y6);
    return f8;
  }
  var w2 = /* @__PURE__ */ new Set(["STYLE", "SCRIPT"]);
  function y2(e5, n11, o8, l8, i13 = /* @__PURE__ */ new Map(), s7) {
    let c10 = [];
    if (w2.has(e5.nodeName)) return c10;
    let m9 = null;
    const g5 = (function(e6, n12) {
      const { nodeName: t9 } = e6, o9 = n12._htmlConversions.get(t9.toLowerCase());
      let l9 = null;
      if (void 0 !== o9) for (const n13 of o9) {
        const t10 = n13(e6);
        null !== t10 && (null === l9 || (l9.priority || 0) <= (t10.priority || 0)) && (l9 = t10);
      }
      return null !== l9 ? l9.conversion : null;
    })(e5, n11), x7 = g5 ? g5(e5) : null;
    let b7 = null;
    if (null !== x7) {
      b7 = x7.after;
      const n12 = x7.node;
      if (m9 = Array.isArray(n12) ? n12[n12.length - 1] : n12, null !== m9) {
        for (const [, e6] of i13) if (m9 = e6(m9, s7), !m9) break;
        m9 && c10.push(...Array.isArray(n12) ? n12 : [m9]);
      }
      null != x7.forChild && i13.set(e5.nodeName, x7.forChild);
    }
    const S3 = e5.childNodes;
    let v6 = [];
    const N4 = (null == m9 || !$isRootOrShadowRoot(m9)) && (null != m9 && $isBlockElementNode(m9) || l8);
    for (let e6 = 0; e6 < S3.length; e6++) v6.push(...y2(S3[e6], n11, o8, N4, new Map(i13), m9));
    return null != b7 && (v6 = b7(v6)), isBlockDomNode2(e5) && (v6 = C2(e5, v6, N4 ? () => {
      const e6 = new ArtificialNode__DO_NOT_USE();
      return o8.push(e6), e6;
    } : $createParagraphNode)), null == m9 ? v6.length > 0 ? c10 = c10.concat(v6) : isBlockDomNode2(e5) && (function(e6) {
      if (null == e6.nextSibling || null == e6.previousSibling) return false;
      return isInlineDomNode(e6.nextSibling) && isInlineDomNode(e6.previousSibling);
    })(e5) && (c10 = c10.concat($createLineBreakNode())) : $isElementNode(m9) && m9.append(...v6), c10;
  }
  function C2(e5, n11, t9) {
    const o8 = e5.style.textAlign, l8 = [];
    let r9 = [];
    for (let e6 = 0; e6 < n11.length; e6++) {
      const i13 = n11[e6];
      if ($isBlockElementNode(i13)) o8 && !i13.getFormat() && i13.setFormat(o8), l8.push(i13);
      else if (r9.push(i13), e6 === n11.length - 1 || e6 < n11.length - 1 && $isBlockElementNode(n11[e6 + 1])) {
        const e7 = t9();
        e7.setFormat(o8), e7.append(...r9), l8.push(e7), r9 = [];
      }
    }
    return l8;
  }

  // node_modules/@lexical/html/LexicalHtml.mjs
  var mod11 = false ? LexicalHtml_dev_exports : LexicalHtml_prod_exports;
  var $generateHtmlFromNodes = mod11.$generateHtmlFromNodes;
  var $generateNodesFromDOM = mod11.$generateNodesFromDOM;

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
    copyToClipboard: () => F5,
    setLexicalClipboardDataTransfer: () => J5
  });
  init_LexicalSelection();
  init_Lexical();
  function v2(t9, ...e5) {
    const n11 = new URL("https://lexical.dev/docs/error"), o8 = new URLSearchParams();
    o8.append("code", t9);
    for (const t10 of e5) o8.append("v", t10);
    throw n11.search = o8.toString(), Error(`Minified Lexical error #${t9}; visit ${n11.toString()} for the full message or use the non-minified dev environment for full errors and additional helpful warnings.`);
  }
  function D4(e5, n11 = $getSelection()) {
    return null == n11 && v2(166), $isRangeSelection(n11) && n11.isCollapsed() || 0 === n11.getNodes().length ? "" : $generateHtmlFromNodes(e5, n11);
  }
  function S2(t9, e5 = $getSelection()) {
    return null == e5 && v2(166), $isRangeSelection(e5) && e5.isCollapsed() || 0 === e5.getNodes().length ? null : JSON.stringify(E3(t9, e5));
  }
  function N2(t9, e5) {
    const n11 = t9.getData("text/plain") || t9.getData("text/uri-list");
    null != n11 && e5.insertRawText(n11);
  }
  function R4(t9, n11, o8) {
    const r9 = t9.getData("application/x-lexical-editor");
    if (r9) try {
      const t10 = JSON.parse(r9);
      if (t10.namespace === o8._config.namespace && Array.isArray(t10.nodes)) {
        return A3(o8, L3(t10.nodes), n11);
      }
    } catch (t10) {
      console.error(t10);
    }
    const c10 = t9.getData("text/html"), a10 = t9.getData("text/plain");
    if (c10 && a10 !== c10) try {
      const t10 = new DOMParser().parseFromString((function(t11) {
        if (window.trustedTypes && window.trustedTypes.createPolicy) {
          return window.trustedTypes.createPolicy("lexical", { createHTML: (t12) => t12 }).createHTML(t11);
        }
        return t11;
      })(c10), "text/html");
      return A3(o8, $generateNodesFromDOM(o8, t10), n11);
    } catch (t10) {
      console.error(t10);
    }
    const u10 = a10 || t9.getData("text/uri-list");
    if (null != u10) if ($isRangeSelection(n11)) {
      const t10 = u10.split(/(\r?\n|\t)/);
      "" === t10[t10.length - 1] && t10.pop();
      for (let e5 = 0; e5 < t10.length; e5++) {
        const n12 = $getSelection();
        if ($isRangeSelection(n12)) {
          const o9 = t10[e5];
          "\n" === o9 || "\r\n" === o9 ? n12.insertParagraph() : "	" === o9 ? n12.insertNodes([$createTabNode()]) : n12.insertText(o9);
        }
      }
    } else n11.insertRawText(u10);
  }
  function A3(t9, e5, n11) {
    t9.dispatchCommand(SELECTION_INSERT_CLIPBOARD_NODES_COMMAND, { nodes: e5, selection: n11 }) || (n11.insertNodes(e5), (function(t10) {
      if ($isRangeSelection(t10) && t10.isCollapsed()) {
        const e6 = t10.anchor;
        let n12 = null;
        const o8 = $caretFromPoint(e6, "previous");
        if (o8) if ($isTextPointCaret(o8)) n12 = o8.origin;
        else {
          const t11 = $getCaretRange(o8, $getChildCaret($getRoot(), "next").getFlipped());
          for (const e7 of t11) {
            if ($isTextNode(e7.origin)) {
              n12 = e7.origin;
              break;
            }
            if ($isElementNode(e7.origin) && !e7.origin.isInline()) break;
          }
        }
        if (n12 && $isTextNode(n12)) {
          const e7 = n12.getFormat(), o9 = n12.getStyle();
          t10.format === e7 && t10.style === o9 || (t10.format = e7, t10.style = o9, t10.dirty = true);
        }
      }
    })(n11));
  }
  function P3(t9, e5, n11, r9 = []) {
    let i13 = null === e5 || n11.isSelected(e5);
    const l8 = $isElementNode(n11) && n11.excludeFromCopy("html");
    let s7 = n11;
    null !== e5 && $isTextNode(s7) && (s7 = $sliceSelectedTextNodeContent(e5, s7, "clone"));
    const c10 = $isElementNode(s7) ? s7.getChildren() : [], a10 = (function(t10) {
      const e6 = t10.exportJSON(), n12 = t10.constructor;
      if (e6.type !== n12.getType() && v2(58, n12.name), $isElementNode(t10)) {
        const t11 = e6.children;
        Array.isArray(t11) || v2(59, n12.name);
      }
      return e6;
    })(s7);
    $isTextNode(s7) && 0 === s7.getTextContentSize() && (i13 = false);
    for (let o8 = 0; o8 < c10.length; o8++) {
      const r10 = c10[o8], l9 = P3(t9, e5, r10, a10.children);
      !i13 && $isElementNode(n11) && l9 && n11.extractWithChild(r10, e5, "clone") && (i13 = true);
    }
    if (i13 && !l8) r9.push(a10);
    else if (Array.isArray(a10.children)) for (let t10 = 0; t10 < a10.children.length; t10++) {
      const e6 = a10.children[t10];
      r9.push(e6);
    }
    return i13;
  }
  function E3(t9, e5) {
    const n11 = [], o8 = $getRoot().getChildren();
    for (let r9 = 0; r9 < o8.length; r9++) {
      P3(t9, e5, o8[r9], n11);
    }
    return { namespace: t9._config.namespace, nodes: n11 };
  }
  function L3(t9) {
    const e5 = [];
    for (let o8 = 0; o8 < t9.length; o8++) {
      const r9 = t9[o8], i13 = $parseSerializedNode(r9);
      $isTextNode(i13) && $addNodeStyle(i13), e5.push(i13);
    }
    return e5;
  }
  var b3 = null;
  async function F5(t9, e5, n11) {
    if (null !== b3) return false;
    if (null !== e5) return new Promise((o9, r9) => {
      t9.update(() => {
        o9(M3(t9, e5, n11));
      });
    });
    const o8 = t9.getRootElement(), i13 = t9._window || window, l8 = i13.document, s7 = getDOMSelection(i13);
    if (null === o8 || null === s7) return false;
    const c10 = l8.createElement("span");
    c10.style.cssText = "position: fixed; top: -1000px;", c10.append(l8.createTextNode("#")), o8.append(c10);
    const a10 = new Range();
    return a10.setStart(c10, 0), a10.setEnd(c10, 1), s7.removeAllRanges(), s7.addRange(a10), new Promise((e6, o9) => {
      const s8 = t9.registerCommand(COPY_COMMAND, (o10) => (objectKlassEquals(o10, ClipboardEvent) && (s8(), null !== b3 && (i13.clearTimeout(b3), b3 = null), e6(M3(t9, o10, n11))), true), COMMAND_PRIORITY_CRITICAL);
      b3 = i13.setTimeout(() => {
        s8(), b3 = null, e6(false);
      }, 50), l8.execCommand("copy"), c10.remove();
    });
  }
  function M3(t9, e5, n11) {
    if (void 0 === n11) {
      const e6 = getDOMSelection(t9._window), o9 = $getSelection();
      if (!o9 || o9.isCollapsed()) return false;
      if (!e6) return false;
      const r9 = e6.anchorNode, l8 = e6.focusNode;
      if (null !== r9 && null !== l8 && !isSelectionWithinEditor(t9, r9, l8)) return false;
      n11 = _4(o9);
    }
    e5.preventDefault();
    const o8 = e5.clipboardData;
    return null !== o8 && (J5(o8, n11), true);
  }
  var O4 = [["text/html", D4], ["application/x-lexical-editor", S2]];
  function _4(t9 = $getSelection()) {
    const e5 = { "text/plain": t9 ? t9.getTextContent() : "" };
    if (t9) {
      const n11 = $getEditor();
      for (const [o8, r9] of O4) {
        const i13 = r9(n11, t9);
        null !== i13 && (e5[o8] = i13);
      }
    }
    return e5;
  }
  function J5(t9, e5) {
    for (const [n11] of O4) void 0 === e5[n11] && t9.setData(n11, "");
    for (const n11 in e5) {
      const o8 = e5[n11];
      void 0 !== o8 && t9.setData(n11, o8);
    }
  }

  // node_modules/@lexical/clipboard/LexicalClipboard.mjs
  var mod12 = false ? LexicalClipboard_dev_exports : LexicalClipboard_prod_exports;
  var $generateJSONFromSelectedNodes = mod12.$generateJSONFromSelectedNodes;
  var $generateNodesFromSerializedNodes = mod12.$generateNodesFromSerializedNodes;
  var $getClipboardDataFromSelection = mod12.$getClipboardDataFromSelection;
  var $getHtmlContent = mod12.$getHtmlContent;
  var $getLexicalContent = mod12.$getLexicalContent;
  var $insertDataTransferForPlainText = mod12.$insertDataTransferForPlainText;
  var $insertDataTransferForRichText = mod12.$insertDataTransferForRichText;
  var $insertGeneratedNodes = mod12.$insertGeneratedNodes;
  var copyToClipboard = mod12.copyToClipboard;
  var setLexicalClipboardDataTransfer = mod12.setLexicalClipboardDataTransfer;

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
  init_LexicalSelection();
  init_Lexical();
  function gt4(t9, e5) {
    if (void 0 !== document.caretRangeFromPoint) {
      const n11 = document.caretRangeFromPoint(t9, e5);
      return null === n11 ? null : { node: n11.startContainer, offset: n11.startOffset };
    }
    if ("undefined" !== document.caretPositionFromPoint) {
      const n11 = document.caretPositionFromPoint(t9, e5);
      return null === n11 ? null : { node: n11.offsetNode, offset: n11.offset };
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
    static clone(t9) {
      return new _Et(t9.__key);
    }
    createDOM(t9) {
      const e5 = document.createElement("blockquote");
      return addClassNamesToElement(e5, t9.theme.quote), e5;
    }
    updateDOM(t9, e5) {
      return false;
    }
    static importDOM() {
      return { blockquote: (t9) => ({ conversion: Ft3, priority: 0 }) };
    }
    exportDOM(t9) {
      const { element: e5 } = super.exportDOM(t9);
      if (isHTMLElement2(e5)) {
        this.isEmpty() && e5.append(document.createElement("br"));
        const t10 = this.getFormatType();
        t10 && (e5.style.textAlign = t10);
        const n11 = this.getDirection();
        n11 && (e5.dir = n11);
      }
      return { element: e5 };
    }
    static importJSON(t9) {
      return _t4().updateFromJSON(t9);
    }
    insertNewAfter(t9, e5) {
      const n11 = $createParagraphNode(), r9 = this.getDirection();
      return n11.setDirection(r9), this.insertAfter(n11, e5), n11;
    }
    collapseAtStart() {
      const t9 = $createParagraphNode();
      return this.getChildren().forEach((e5) => t9.append(e5)), this.replace(t9), true;
    }
    canMergeWhenEmpty() {
      return true;
    }
  };
  function _t4() {
    return $applyNodeReplacement(new Et4());
  }
  function Ot4(t9) {
    return t9 instanceof Et4;
  }
  var Pt4 = class _Pt extends ElementNode {
    __tag;
    static getType() {
      return "heading";
    }
    static clone(t9) {
      return new _Pt(t9.__tag, t9.__key);
    }
    constructor(t9, e5) {
      super(e5), this.__tag = t9;
    }
    getTag() {
      return this.__tag;
    }
    setTag(t9) {
      const e5 = this.getWritable();
      return this.__tag = t9, e5;
    }
    createDOM(t9) {
      const e5 = this.__tag, n11 = document.createElement(e5), r9 = t9.theme.heading;
      if (void 0 !== r9) {
        const t10 = r9[e5];
        addClassNamesToElement(n11, t10);
      }
      return n11;
    }
    updateDOM(t9, e5, n11) {
      return t9.__tag !== this.__tag;
    }
    static importDOM() {
      return { h1: (t9) => ({ conversion: At4, priority: 0 }), h2: (t9) => ({ conversion: At4, priority: 0 }), h3: (t9) => ({ conversion: At4, priority: 0 }), h4: (t9) => ({ conversion: At4, priority: 0 }), h5: (t9) => ({ conversion: At4, priority: 0 }), h6: (t9) => ({ conversion: At4, priority: 0 }), p: (t9) => {
        const e5 = t9.firstChild;
        return null !== e5 && Tt4(e5) ? { conversion: () => ({ node: null }), priority: 3 } : null;
      }, span: (t9) => Tt4(t9) ? { conversion: (t10) => ({ node: St4("h1") }), priority: 3 } : null };
    }
    exportDOM(t9) {
      const { element: e5 } = super.exportDOM(t9);
      if (isHTMLElement2(e5)) {
        this.isEmpty() && e5.append(document.createElement("br"));
        const t10 = this.getFormatType();
        t10 && (e5.style.textAlign = t10);
        const n11 = this.getDirection();
        n11 && (e5.dir = n11);
      }
      return { element: e5 };
    }
    static importJSON(t9) {
      return St4(t9.tag).updateFromJSON(t9);
    }
    updateFromJSON(t9) {
      return super.updateFromJSON(t9).setTag(t9.tag);
    }
    exportJSON() {
      return { ...super.exportJSON(), tag: this.getTag() };
    }
    insertNewAfter(t9, e5 = true) {
      const n11 = t9 ? t9.anchor.offset : 0, r9 = this.getLastDescendant(), o8 = !r9 || t9 && t9.anchor.key === r9.getKey() && n11 === r9.getTextContentSize() || !t9 ? $createParagraphNode() : St4(this.getTag()), i13 = this.getDirection();
      if (o8.setDirection(i13), this.insertAfter(o8, e5), 0 === n11 && !this.isEmpty() && t9) {
        const t10 = $createParagraphNode();
        t10.select(), this.replace(t10, true);
      }
      return o8;
    }
    collapseAtStart() {
      const t9 = this.isEmpty() ? $createParagraphNode() : St4(this.getTag());
      return this.getChildren().forEach((e5) => t9.append(e5)), this.replace(t9), true;
    }
    extractWithChild() {
      return true;
    }
  };
  function Tt4(t9) {
    return "span" === t9.nodeName.toLowerCase() && "26pt" === t9.style.fontSize;
  }
  function At4(t9) {
    const e5 = t9.nodeName.toLowerCase();
    let n11 = null;
    return "h1" !== e5 && "h2" !== e5 && "h3" !== e5 && "h4" !== e5 && "h5" !== e5 && "h6" !== e5 || (n11 = St4(e5), null !== t9.style && (setNodeIndentFromDOM(t9, n11), n11.setFormat(t9.style.textAlign))), { node: n11 };
  }
  function Ft3(t9) {
    const e5 = _t4();
    return null !== t9.style && (e5.setFormat(t9.style.textAlign), setNodeIndentFromDOM(t9, e5)), { node: e5 };
  }
  function St4(t9 = "h1") {
    return $applyNodeReplacement(new Pt4(t9));
  }
  function It3(t9) {
    return t9 instanceof Pt4;
  }
  function Mt4(t9) {
    let e5 = null;
    if (objectKlassEquals(t9, DragEvent) ? e5 = t9.dataTransfer : objectKlassEquals(t9, ClipboardEvent) && (e5 = t9.clipboardData), null === e5) return [false, [], false];
    const n11 = e5.types, r9 = n11.includes("Files"), o8 = n11.includes("text/html") || n11.includes("text/plain");
    return [r9, Array.from(e5.files), o8];
  }
  function bt4(t9) {
    const e5 = $getSelection();
    if (!$isRangeSelection(e5)) return false;
    const n11 = /* @__PURE__ */ new Set(), r9 = e5.getNodes();
    for (let e6 = 0; e6 < r9.length; e6++) {
      const o8 = r9[e6], i13 = o8.getKey();
      if (n11.has(i13)) continue;
      const s7 = $findMatchingParent2(o8, (t10) => $isElementNode(t10) && !t10.isInline());
      if (null === s7) continue;
      const c10 = s7.getKey();
      s7.canIndent() && !n11.has(c10) && (n11.add(c10), t9(s7));
    }
    return n11.size > 0;
  }
  function Kt4(t9) {
    const e5 = $getNearestNodeFromDOMNode(t9);
    return $isDecoratorNode(e5);
  }
  function kt4(t9) {
    for (const e5 of ["lowercase", "uppercase", "capitalize"]) t9.hasFormat(e5) && t9.toggleFormat(e5);
  }
  function Jt3(n11) {
    return mergeRegister(n11.registerCommand(CLICK_COMMAND, (t9) => {
      const e5 = $getSelection();
      return !!$isNodeSelection(e5) && (e5.clear(), true);
    }, COMMAND_PRIORITY_EDITOR), n11.registerCommand(DELETE_CHARACTER_COMMAND, (t9) => {
      const e5 = $getSelection();
      return $isRangeSelection(e5) ? (e5.deleteCharacter(t9), true) : !!$isNodeSelection(e5) && (e5.deleteNodes(), true);
    }, COMMAND_PRIORITY_EDITOR), n11.registerCommand(DELETE_WORD_COMMAND, (t9) => {
      const e5 = $getSelection();
      return !!$isRangeSelection(e5) && (e5.deleteWord(t9), true);
    }, COMMAND_PRIORITY_EDITOR), n11.registerCommand(DELETE_LINE_COMMAND, (t9) => {
      const e5 = $getSelection();
      return !!$isRangeSelection(e5) && (e5.deleteLine(t9), true);
    }, COMMAND_PRIORITY_EDITOR), n11.registerCommand(CONTROLLED_TEXT_INSERTION_COMMAND, (e5) => {
      const r9 = $getSelection();
      if ("string" == typeof e5) null !== r9 && r9.insertText(e5);
      else {
        if (null === r9) return false;
        const o8 = e5.dataTransfer;
        if (null != o8) $insertDataTransferForRichText(o8, r9, n11);
        else if ($isRangeSelection(r9)) {
          const t9 = e5.data;
          return t9 && r9.insertText(t9), true;
        }
      }
      return true;
    }, COMMAND_PRIORITY_EDITOR), n11.registerCommand(REMOVE_TEXT_COMMAND, () => {
      const t9 = $getSelection();
      return !!$isRangeSelection(t9) && (t9.removeText(), true);
    }, COMMAND_PRIORITY_EDITOR), n11.registerCommand(FORMAT_TEXT_COMMAND, (t9) => {
      const e5 = $getSelection();
      return !!$isRangeSelection(e5) && (e5.formatText(t9), true);
    }, COMMAND_PRIORITY_EDITOR), n11.registerCommand(FORMAT_ELEMENT_COMMAND, (t9) => {
      const e5 = $getSelection();
      if (!$isRangeSelection(e5) && !$isNodeSelection(e5)) return false;
      const n12 = e5.getNodes();
      for (const e6 of n12) {
        const n13 = $findMatchingParent2(e6, (t10) => $isElementNode(t10) && !t10.isInline());
        null !== n13 && n13.setFormat(t9);
      }
      return true;
    }, COMMAND_PRIORITY_EDITOR), n11.registerCommand(INSERT_LINE_BREAK_COMMAND, (t9) => {
      const e5 = $getSelection();
      return !!$isRangeSelection(e5) && (e5.insertLineBreak(t9), true);
    }, COMMAND_PRIORITY_EDITOR), n11.registerCommand(INSERT_PARAGRAPH_COMMAND, () => {
      const t9 = $getSelection();
      return !!$isRangeSelection(t9) && (t9.insertParagraph(), true);
    }, COMMAND_PRIORITY_EDITOR), n11.registerCommand(INSERT_TAB_COMMAND, () => ($insertNodes([$createTabNode()]), true), COMMAND_PRIORITY_EDITOR), n11.registerCommand(INDENT_CONTENT_COMMAND, () => bt4((t9) => {
      const e5 = t9.getIndent();
      t9.setIndent(e5 + 1);
    }), COMMAND_PRIORITY_EDITOR), n11.registerCommand(OUTDENT_CONTENT_COMMAND, () => bt4((t9) => {
      const e5 = t9.getIndent();
      e5 > 0 && t9.setIndent(Math.max(0, e5 - 1));
    }), COMMAND_PRIORITY_EDITOR), n11.registerCommand(KEY_ARROW_UP_COMMAND, (t9) => {
      const e5 = $getSelection();
      if ($isNodeSelection(e5)) {
        const n12 = e5.getNodes();
        if (n12.length > 0) return t9.preventDefault(), n12[0].selectPrevious(), true;
      } else if ($isRangeSelection(e5)) {
        const n12 = $getAdjacentNode(e5.focus, true);
        if (!t9.shiftKey && $isDecoratorNode(n12) && !n12.isIsolated() && !n12.isInline()) return n12.selectPrevious(), t9.preventDefault(), true;
      }
      return false;
    }, COMMAND_PRIORITY_EDITOR), n11.registerCommand(KEY_ARROW_DOWN_COMMAND, (t9) => {
      const e5 = $getSelection();
      if ($isNodeSelection(e5)) {
        const n12 = e5.getNodes();
        if (n12.length > 0) return t9.preventDefault(), n12[0].selectNext(0, 0), true;
      } else if ($isRangeSelection(e5)) {
        if ((function(t10) {
          const e6 = t10.focus;
          return "root" === e6.key && e6.offset === $getRoot().getChildrenSize();
        })(e5)) return t9.preventDefault(), true;
        const n12 = $getAdjacentNode(e5.focus, false);
        if (!t9.shiftKey && $isDecoratorNode(n12) && !n12.isIsolated() && !n12.isInline()) return n12.selectNext(), t9.preventDefault(), true;
      }
      return false;
    }, COMMAND_PRIORITY_EDITOR), n11.registerCommand(KEY_ARROW_LEFT_COMMAND, (t9) => {
      const e5 = $getSelection();
      if ($isNodeSelection(e5)) {
        const n12 = e5.getNodes();
        if (n12.length > 0) return t9.preventDefault(), $isParentRTL(n12[0]) ? n12[0].selectNext(0, 0) : n12[0].selectPrevious(), true;
      }
      if (!$isRangeSelection(e5)) return false;
      if ($shouldOverrideDefaultCharacterSelection(e5, true)) {
        const n12 = t9.shiftKey;
        return t9.preventDefault(), $moveCharacter(e5, n12, true), true;
      }
      return false;
    }, COMMAND_PRIORITY_EDITOR), n11.registerCommand(KEY_ARROW_RIGHT_COMMAND, (t9) => {
      const e5 = $getSelection();
      if ($isNodeSelection(e5)) {
        const n13 = e5.getNodes();
        if (n13.length > 0) return t9.preventDefault(), $isParentRTL(n13[0]) ? n13[0].selectPrevious() : n13[0].selectNext(0, 0), true;
      }
      if (!$isRangeSelection(e5)) return false;
      const n12 = t9.shiftKey;
      return !!$shouldOverrideDefaultCharacterSelection(e5, false) && (t9.preventDefault(), $moveCharacter(e5, n12, false), true);
    }, COMMAND_PRIORITY_EDITOR), n11.registerCommand(KEY_BACKSPACE_COMMAND, (t9) => {
      if (Kt4(t9.target)) return false;
      const e5 = $getSelection();
      if ($isRangeSelection(e5)) {
        if ((function(t10) {
          if (!t10.isCollapsed()) return false;
          const { anchor: e6 } = t10;
          if (0 !== e6.offset) return false;
          const n12 = e6.getNode();
          if ($isRootNode(n12)) return false;
          const r9 = $getNearestBlockElementAncestorOrThrow(n12);
          return r9.getIndent() > 0 && (r9.is(n12) || n12.is(r9.getFirstDescendant()));
        })(e5)) return t9.preventDefault(), n11.dispatchCommand(OUTDENT_CONTENT_COMMAND, void 0);
        if (xt4 && "ko-KR" === navigator.language) return false;
      } else if (!$isNodeSelection(e5)) return false;
      return t9.preventDefault(), n11.dispatchCommand(DELETE_CHARACTER_COMMAND, true);
    }, COMMAND_PRIORITY_EDITOR), n11.registerCommand(KEY_DELETE_COMMAND, (t9) => {
      if (Kt4(t9.target)) return false;
      const e5 = $getSelection();
      return !(!$isRangeSelection(e5) && !$isNodeSelection(e5)) && (t9.preventDefault(), n11.dispatchCommand(DELETE_CHARACTER_COMMAND, false));
    }, COMMAND_PRIORITY_EDITOR), n11.registerCommand(KEY_ENTER_COMMAND, (t9) => {
      const e5 = $getSelection();
      if (!$isRangeSelection(e5)) return false;
      if (kt4(e5), null !== t9) {
        if ((xt4 || yt4 || Nt4) && Ct4) return false;
        if (t9.preventDefault(), t9.shiftKey) return n11.dispatchCommand(INSERT_LINE_BREAK_COMMAND, false);
      }
      return n11.dispatchCommand(INSERT_PARAGRAPH_COMMAND, void 0);
    }, COMMAND_PRIORITY_EDITOR), n11.registerCommand(KEY_ESCAPE_COMMAND, () => {
      const t9 = $getSelection();
      return !!$isRangeSelection(t9) && (n11.blur(), true);
    }, COMMAND_PRIORITY_EDITOR), n11.registerCommand(DROP_COMMAND, (t9) => {
      const [, e5] = Mt4(t9);
      if (e5.length > 0) {
        const r10 = gt4(t9.clientX, t9.clientY);
        if (null !== r10) {
          const { offset: t10, node: o8 } = r10, i13 = $getNearestNodeFromDOMNode(o8);
          if (null !== i13) {
            const e6 = $createRangeSelection();
            if ($isTextNode(i13)) e6.anchor.set(i13.getKey(), t10, "text"), e6.focus.set(i13.getKey(), t10, "text");
            else {
              const t11 = i13.getParentOrThrow().getKey(), n13 = i13.getIndexWithinParent() + 1;
              e6.anchor.set(t11, n13, "element"), e6.focus.set(t11, n13, "element");
            }
            const n12 = $normalizeSelection__EXPERIMENTAL(e6);
            $setSelection(n12);
          }
          n11.dispatchCommand(wt4, e5);
        }
        return t9.preventDefault(), true;
      }
      const r9 = $getSelection();
      return !!$isRangeSelection(r9);
    }, COMMAND_PRIORITY_EDITOR), n11.registerCommand(DRAGSTART_COMMAND, (t9) => {
      const [e5] = Mt4(t9), n12 = $getSelection();
      return !(e5 && !$isRangeSelection(n12));
    }, COMMAND_PRIORITY_EDITOR), n11.registerCommand(DRAGOVER_COMMAND, (t9) => {
      const [e5] = Mt4(t9), n12 = $getSelection();
      if (e5 && !$isRangeSelection(n12)) return false;
      const r9 = gt4(t9.clientX, t9.clientY);
      if (null !== r9) {
        const e6 = $getNearestNodeFromDOMNode(r9.node);
        $isDecoratorNode(e6) && t9.preventDefault();
      }
      return true;
    }, COMMAND_PRIORITY_EDITOR), n11.registerCommand(SELECT_ALL_COMMAND, () => ($selectAll(), true), COMMAND_PRIORITY_EDITOR), n11.registerCommand(COPY_COMMAND, (t9) => (copyToClipboard(n11, objectKlassEquals(t9, ClipboardEvent) ? t9 : null), true), COMMAND_PRIORITY_EDITOR), n11.registerCommand(CUT_COMMAND, (t9) => ((async function(t10, n12) {
      await copyToClipboard(n12, objectKlassEquals(t10, ClipboardEvent) ? t10 : null), n12.update(() => {
        const t11 = $getSelection();
        $isRangeSelection(t11) ? t11.removeText() : $isNodeSelection(t11) && t11.getNodes().forEach((t12) => t12.remove());
      });
    })(t9, n11), true), COMMAND_PRIORITY_EDITOR), n11.registerCommand(PASTE_COMMAND, (e5) => {
      const [, r9, o8] = Mt4(e5);
      if (r9.length > 0 && !o8) return n11.dispatchCommand(wt4, r9), true;
      if (isDOMNode(e5.target) && isSelectionCapturedInDecoratorInput(e5.target)) return false;
      return null !== $getSelection() && ((function(e6, n12) {
        e6.preventDefault(), n12.update(() => {
          const r10 = $getSelection(), o9 = objectKlassEquals(e6, InputEvent) || objectKlassEquals(e6, KeyboardEvent) ? null : e6.clipboardData;
          null != o9 && null !== r10 && $insertDataTransferForRichText(o9, r10, n12);
        }, { tag: PASTE_TAG });
      })(e5, n11), true);
    }, COMMAND_PRIORITY_EDITOR), n11.registerCommand(KEY_SPACE_COMMAND, (t9) => {
      const e5 = $getSelection();
      return $isRangeSelection(e5) && kt4(e5), false;
    }, COMMAND_PRIORITY_EDITOR), n11.registerCommand(KEY_TAB_COMMAND, (t9) => {
      const e5 = $getSelection();
      return $isRangeSelection(e5) && kt4(e5), false;
    }, COMMAND_PRIORITY_EDITOR));
  }
  var Wt3 = defineExtension({ conflictsWith: ["@lexical/plain-text"], dependencies: [DragonExtension], name: "@lexical/rich-text", nodes: () => [Pt4, Et4], register: Jt3 });

  // node_modules/@lexical/rich-text/LexicalRichText.mjs
  var mod13 = false ? LexicalRichText_dev_exports : LexicalRichText_prod_exports;
  var $createHeadingNode = mod13.$createHeadingNode;
  var $createQuoteNode = mod13.$createQuoteNode;
  var $isHeadingNode = mod13.$isHeadingNode;
  var $isQuoteNode = mod13.$isQuoteNode;
  var DRAG_DROP_PASTE = mod13.DRAG_DROP_PASTE;
  var HeadingNode = mod13.HeadingNode;
  var QuoteNode = mod13.QuoteNode;
  var RichTextExtension = mod13.RichTextExtension;
  var eventFiles = mod13.eventFiles;
  var registerRichText = mod13.registerRichText;

  // node_modules/@lexical/react/LexicalRichTextPlugin.prod.mjs
  var LexicalRichTextPlugin_prod_exports = {};
  __export(LexicalRichTextPlugin_prod_exports, {
    RichTextPlugin: () => L4
  });
  var import_react4 = __toESM(require_react(), 1);
  var import_react_dom = __toESM(require_react_dom(), 1);
  function g4(r9, ...e5) {
    const t9 = new URL("https://lexical.dev/docs/error"), o8 = new URLSearchParams();
    o8.append("code", r9);
    for (const r10 of e5) o8.append("v", r10);
    throw t9.search = o8.toString(), Error(`Minified Lexical error #${r9}; visit ${t9.toString()} for the full message or use the non-minified dev environment for full errors and additional helpful warnings.`);
  }
  var y3 = "undefined" != typeof window && void 0 !== window.document && void 0 !== window.document.createElement ? import_react4.useLayoutEffect : import_react4.useEffect;
  function w3({ editor: r9, ErrorBoundary: e5 }) {
    return (function(r10, e6) {
      const [t9, o8] = (0, import_react4.useState)(() => r10.getDecorators());
      return y3(() => r10.registerDecoratorListener((r11) => {
        (0, import_react_dom.flushSync)(() => {
          o8(r11);
        });
      }), [r10]), (0, import_react4.useEffect)(() => {
        o8(r10.getDecorators());
      }, [r10]), (0, import_react4.useMemo)(() => {
        const o9 = [], n11 = Object.keys(t9);
        for (let i13 = 0; i13 < n11.length; i13++) {
          const c10 = n11[i13], a10 = jsx(e6, { onError: (e7) => r10._onError(e7), children: jsx(import_react4.Suspense, { fallback: null, children: t9[c10] }) }), s7 = r10.getElementByKey(c10);
          null !== s7 && o9.push((0, import_react_dom.createPortal)(a10, s7, c10));
        }
        return o9;
      }, [e6, t9, r10]);
    })(r9, e5);
  }
  function v3({ editor: r9, ErrorBoundary: e5 }) {
    return (function(r10) {
      const e6 = LexicalBuilder.maybeFromEditor(r10);
      if (e6 && e6.hasExtensionByName(ReactProviderExtension.name)) {
        for (const r11 of ["@lexical/plain-text", "@lexical/rich-text"]) e6.hasExtensionByName(r11) && g4(320, r11);
        return true;
      }
      return false;
    })(r9) ? null : jsx(w3, { editor: r9, ErrorBoundary: e5 });
  }
  function B5(r9) {
    return r9.getEditorState().read($canShowPlaceholderCurry(r9.isComposing()));
  }
  function L4({ contentEditable: e5, placeholder: t9 = null, ErrorBoundary: o8 }) {
    const [n11] = useLexicalComposerContext();
    return (function(r9) {
      y3(() => mergeRegister(registerRichText(r9), registerDragonSupport(r9)), [r9]);
    })(n11), jsxs(Fragment, { children: [e5, jsx(b4, { content: t9 }), jsx(v3, { editor: n11, ErrorBoundary: o8 })] });
  }
  function b4({ content: t9 }) {
    const [o8] = useLexicalComposerContext(), n11 = (function(r9) {
      const [e5, t10] = (0, import_react4.useState)(() => B5(r9));
      return y3(() => {
        function e6() {
          const e7 = B5(r9);
          t10(e7);
        }
        return e6(), mergeRegister(r9.registerUpdateListener(() => {
          e6();
        }), r9.registerEditableListener(() => {
          e6();
        }));
      }, [r9]), e5;
    })(o8), i13 = useLexicalEditable();
    return n11 ? "function" == typeof t9 ? t9(i13) : t9 : null;
  }

  // node_modules/@lexical/react/LexicalRichTextPlugin.mjs
  var mod14 = false ? LexicalRichTextPlugin_dev_exports : LexicalRichTextPlugin_prod_exports;
  var RichTextPlugin = mod14.RichTextPlugin;

  // node_modules/@lexical/react/LexicalContentEditable.prod.mjs
  var LexicalContentEditable_prod_exports = {};
  __export(LexicalContentEditable_prod_exports, {
    ContentEditable: () => x4,
    ContentEditableElement: () => b5
  });
  var import_react5 = __toESM(require_react(), 1);
  var m4 = "undefined" != typeof window && void 0 !== window.document && void 0 !== window.document.createElement ? import_react5.useLayoutEffect : import_react5.useEffect;
  function f4({ editor: e5, ariaActiveDescendant: t9, ariaAutoComplete: i13, ariaControls: a10, ariaDescribedBy: d8, ariaErrorMessage: c10, ariaExpanded: s7, ariaInvalid: u10, ariaLabel: f8, ariaLabelledBy: b7, ariaMultiline: p7, ariaOwns: x7, ariaRequired: E8, autoCapitalize: v6, className: w6, id: y6, role: C5 = "textbox", spellCheck: g5 = true, style: L5, tabIndex: h3, "data-testid": D7, ...I6 }, R7) {
    const [k4, q9] = (0, import_react5.useState)(e5.isEditable()), z7 = (0, import_react5.useCallback)((t10) => {
      t10 && t10.ownerDocument && t10.ownerDocument.defaultView ? e5.setRootElement(t10) : e5.setRootElement(null);
    }, [e5]), A5 = (0, import_react5.useMemo)(() => /* @__PURE__ */ (function(...e6) {
      return (t10) => {
        for (const i14 of e6) "function" == typeof i14 ? i14(t10) : null != i14 && (i14.current = t10);
      };
    })(R7, z7), [z7, R7]);
    return m4(() => (q9(e5.isEditable()), e5.registerEditableListener((e6) => {
      q9(e6);
    })), [e5]), jsx("div", { "aria-activedescendant": k4 ? t9 : void 0, "aria-autocomplete": k4 ? i13 : "none", "aria-controls": k4 ? a10 : void 0, "aria-describedby": d8, ...null != c10 ? { "aria-errormessage": c10 } : {}, "aria-expanded": k4 && "combobox" === C5 ? !!s7 : void 0, ...null != u10 ? { "aria-invalid": u10 } : {}, "aria-label": f8, "aria-labelledby": b7, "aria-multiline": p7, "aria-owns": k4 ? x7 : void 0, "aria-readonly": !k4 || void 0, "aria-required": E8, autoCapitalize: v6, className: w6, contentEditable: k4, "data-testid": D7, id: y6, ref: A5, role: C5, spellCheck: g5, style: L5, tabIndex: h3, ...I6 });
  }
  var b5 = (0, import_react5.forwardRef)(f4);
  function p3(e5) {
    return e5.getEditorState().read($canShowPlaceholderCurry(e5.isComposing()));
  }
  var x4 = (0, import_react5.forwardRef)(E4);
  function E4(t9, i13) {
    const { placeholder: a10, ...r9 } = t9, [n11] = useLexicalComposerContext();
    return jsxs(Fragment, { children: [jsx(b5, { editor: n11, ...r9, ref: i13 }), null != a10 && jsx(v4, { editor: n11, content: a10 })] });
  }
  function v4({ content: e5, editor: i13 }) {
    const a10 = (function(e6) {
      const [t9, i14] = (0, import_react5.useState)(() => p3(e6));
      return m4(() => {
        function t10() {
          const t11 = p3(e6);
          i14(t11);
        }
        return t10(), mergeRegister(e6.registerUpdateListener(() => {
          t10();
        }), e6.registerEditableListener(() => {
          t10();
        }));
      }, [e6]), t9;
    })(i13), [n11, o8] = (0, import_react5.useState)(i13.isEditable());
    if ((0, import_react5.useLayoutEffect)(() => (o8(i13.isEditable()), i13.registerEditableListener((e6) => {
      o8(e6);
    })), [i13]), !a10) return null;
    let d8 = null;
    return "function" == typeof e5 ? d8 = e5(n11) : null !== e5 && (d8 = e5), null === d8 ? null : jsx("div", { "aria-hidden": true, children: d8 });
  }

  // node_modules/@lexical/react/LexicalContentEditable.mjs
  var mod15 = false ? LexicalContentEditable_dev_exports : LexicalContentEditable_prod_exports;
  var ContentEditable = mod15.ContentEditable;
  var ContentEditableElement = mod15.ContentEditableElement;

  // node_modules/@lexical/history/LexicalHistory.prod.mjs
  var LexicalHistory_prod_exports = {};
  __export(LexicalHistory_prod_exports, {
    HistoryExtension: () => E5,
    SharedHistoryExtension: () => H5,
    createEmptyHistoryState: () => w4,
    registerHistory: () => b6
  });
  init_Lexical();
  function x5(t9, e5, n11, r9, o8) {
    if (null === t9 || 0 === n11.size && 0 === r9.size && !o8) return 0;
    const i13 = e5._selection, a10 = t9._selection;
    if (o8) return 1;
    if (!($isRangeSelection(i13) && $isRangeSelection(a10) && a10.isCollapsed() && i13.isCollapsed())) return 0;
    const s7 = (function(t10, e6, n12) {
      const r10 = t10._nodeMap, o9 = [];
      for (const t11 of e6) {
        const e7 = r10.get(t11);
        void 0 !== e7 && o9.push(e7);
      }
      for (const [t11, e7] of n12) {
        if (!e7) continue;
        const n13 = r10.get(t11);
        void 0 === n13 || $isRootNode(n13) || o9.push(n13);
      }
      return o9;
    })(e5, n11, r9);
    if (0 === s7.length) return 0;
    if (s7.length > 1) {
      const n12 = e5._nodeMap, r10 = n12.get(i13.anchor.key), o9 = n12.get(a10.anchor.key);
      return r10 && o9 && !t9._nodeMap.has(r10.__key) && $isTextNode(r10) && 1 === r10.__text.length && 1 === i13.anchor.offset ? 2 : 0;
    }
    const c10 = s7[0], d8 = t9._nodeMap.get(c10.__key);
    if (!$isTextNode(d8) || !$isTextNode(c10) || d8.__mode !== c10.__mode) return 0;
    const u10 = d8.__text, l8 = c10.__text;
    if (u10 === l8) return 0;
    const f8 = i13.anchor, p7 = a10.anchor;
    if (f8.key !== p7.key || "text" !== f8.type) return 0;
    const h3 = f8.offset, m9 = p7.offset, y6 = l8.length - u10.length;
    return 1 === y6 && m9 === h3 - 1 ? 2 : -1 === y6 && m9 === h3 + 1 ? 3 : -1 === y6 && m9 === h3 ? 4 : 0;
  }
  function C3(t9, e5) {
    let n11 = Date.now(), r9 = 0;
    return (o8, i13, a10, s7, c10, d8) => {
      const u10 = Date.now();
      if (d8.has(HISTORIC_TAG)) return r9 = 0, n11 = u10, 2;
      const l8 = x5(o8, i13, s7, c10, t9.isComposing()), f8 = (() => {
        const f9 = null === a10 || a10.editor === t9, p7 = d8.has(HISTORY_PUSH_TAG);
        if (!p7 && f9 && d8.has(HISTORY_MERGE_TAG)) return 0;
        if (null === o8) return 1;
        const h3 = i13._selection;
        if (!(s7.size > 0 || c10.size > 0)) return null !== h3 ? 0 : 2;
        const m9 = "number" == typeof e5 ? e5 : e5.peek();
        if (false === p7 && 0 !== l8 && l8 === r9 && u10 < n11 + m9 && f9) return 0;
        if (1 === s7.size) {
          if ((function(t10, e6, n12) {
            const r10 = e6._nodeMap.get(t10), o9 = n12._nodeMap.get(t10), i14 = e6._selection, a11 = n12._selection;
            return !($isRangeSelection(i14) && $isRangeSelection(a11) && "element" === i14.anchor.type && "element" === i14.focus.type && "text" === a11.anchor.type && "text" === a11.focus.type || !$isTextNode(r10) || !$isTextNode(o9) || r10.__parent !== o9.__parent) && JSON.stringify(e6.read(() => r10.exportJSON())) === JSON.stringify(n12.read(() => o9.exportJSON()));
          })(Array.from(s7)[0], o8, i13)) return 0;
        }
        return 1;
      })();
      return n11 = u10, r9 = l8, f8;
    };
  }
  function v5(t9) {
    t9.undoStack = [], t9.redoStack = [], t9.current = null;
  }
  function b6(t9, e5, n11) {
    const r9 = C3(t9, n11), i13 = mergeRegister(t9.registerCommand(UNDO_COMMAND, () => ((function(t10, e6) {
      const n12 = e6.redoStack, r10 = e6.undoStack;
      if (0 !== r10.length) {
        const o8 = e6.current, i14 = r10.pop();
        null !== o8 && (n12.push(o8), t10.dispatchCommand(CAN_REDO_COMMAND, true)), 0 === r10.length && t10.dispatchCommand(CAN_UNDO_COMMAND, false), e6.current = i14 || null, i14 && i14.editor.setEditorState(i14.editorState, { tag: HISTORIC_TAG });
      }
    })(t9, e5), true), COMMAND_PRIORITY_EDITOR), t9.registerCommand(REDO_COMMAND, () => ((function(t10, e6) {
      const n12 = e6.redoStack, r10 = e6.undoStack;
      if (0 !== n12.length) {
        const o8 = e6.current;
        null !== o8 && (r10.push(o8), t10.dispatchCommand(CAN_UNDO_COMMAND, true));
        const i14 = n12.pop();
        0 === n12.length && t10.dispatchCommand(CAN_REDO_COMMAND, false), e6.current = i14 || null, i14 && i14.editor.setEditorState(i14.editorState, { tag: HISTORIC_TAG });
      }
    })(t9, e5), true), COMMAND_PRIORITY_EDITOR), t9.registerCommand(CLEAR_EDITOR_COMMAND, () => (v5(e5), false), COMMAND_PRIORITY_EDITOR), t9.registerCommand(CLEAR_HISTORY_COMMAND, () => (v5(e5), t9.dispatchCommand(CAN_REDO_COMMAND, false), t9.dispatchCommand(CAN_UNDO_COMMAND, false), true), COMMAND_PRIORITY_EDITOR), t9.registerUpdateListener(({ editorState: n12, prevEditorState: o8, dirtyLeaves: i14, dirtyElements: a10, tags: s7 }) => {
      const c10 = e5.current, d8 = e5.redoStack, u10 = e5.undoStack, l8 = null === c10 ? null : c10.editorState;
      if (null !== c10 && n12 === l8) return;
      const f8 = r9(o8, n12, c10, i14, a10, s7);
      if (1 === f8) 0 !== d8.length && (e5.redoStack = [], t9.dispatchCommand(CAN_REDO_COMMAND, false)), null !== c10 && (u10.push({ ...c10 }), t9.dispatchCommand(CAN_UNDO_COMMAND, true));
      else if (2 === f8) return;
      e5.current = { editor: t9, editorState: n12 };
    }));
    return i13;
  }
  function w4() {
    return { current: null, redoStack: [], undoStack: [] };
  }
  var E5 = defineExtension({ build: (e5, { delay: n11, createInitialHistoryState: r9, disabled: o8 }) => namedSignals({ delay: n11, disabled: o8, historyState: r9(e5) }), config: safeCast({ createInitialHistoryState: w4, delay: 300, disabled: "undefined" == typeof window }), name: "@lexical/history/History", register: (t9, n11, r9) => {
    const o8 = r9.getOutput();
    return effect(() => o8.disabled.value ? void 0 : b6(t9, o8.historyState.value, o8.delay));
  } });
  var H5 = defineExtension({ dependencies: [configExtension(E5, { createInitialHistoryState: () => {
    throw new Error("SharedHistory did not inherit parent history");
  }, disabled: true })], name: "@lexical/history/SharedHistory", register(t9, o8, i13) {
    const { output: a10 } = i13.getDependency(E5), s7 = (function(t10) {
      return t10 ? getPeerDependencyFromEditor(t10, E5.name) : null;
    })(t9._parentEditor);
    if (!s7) return () => {
    };
    const c10 = s7.output;
    return effect(() => batch(() => {
      a10.delay.value = c10.delay.value, a10.historyState.value = c10.historyState.value, a10.disabled.value = c10.disabled.value;
    }));
  } });

  // node_modules/@lexical/history/LexicalHistory.mjs
  var mod16 = false ? LexicalHistory_dev_exports : LexicalHistory_prod_exports;
  var HistoryExtension = mod16.HistoryExtension;
  var SharedHistoryExtension = mod16.SharedHistoryExtension;
  var createEmptyHistoryState = mod16.createEmptyHistoryState;
  var registerHistory = mod16.registerHistory;

  // node_modules/@lexical/react/LexicalHistoryPlugin.prod.mjs
  var LexicalHistoryPlugin_prod_exports = {};
  __export(LexicalHistoryPlugin_prod_exports, {
    HistoryPlugin: () => a6,
    createEmptyHistoryState: () => createEmptyHistoryState
  });
  var import_react6 = __toESM(require_react(), 1);
  function a6({ delay: a10, externalHistoryState: c10 }) {
    const [l8] = useLexicalComposerContext();
    return (function(t9, a11, c11 = 1e3) {
      const l9 = (0, import_react6.useMemo)(() => a11 || createEmptyHistoryState(), [a11]);
      (0, import_react6.useEffect)(() => registerHistory(t9, l9, c11), [c11, t9, l9]);
    })(l8, c10, a10), null;
  }

  // node_modules/@lexical/react/LexicalHistoryPlugin.mjs
  var mod17 = false ? LexicalHistoryPlugin_dev_exports : LexicalHistoryPlugin_prod_exports;
  var HistoryPlugin = mod17.HistoryPlugin;
  var createEmptyHistoryState2 = mod17.createEmptyHistoryState;

  // node_modules/@lexical/react/LexicalAutoFocusPlugin.prod.mjs
  var LexicalAutoFocusPlugin_prod_exports = {};
  __export(LexicalAutoFocusPlugin_prod_exports, {
    AutoFocusPlugin: () => o5
  });
  var import_react7 = __toESM(require_react(), 1);
  function o5({ defaultSelection: o8 }) {
    const [l8] = useLexicalComposerContext();
    return (0, import_react7.useEffect)(() => {
      l8.focus(() => {
        const e5 = document.activeElement, t9 = l8.getRootElement();
        null === t9 || null !== e5 && t9.contains(e5) || t9.focus({ preventScroll: true });
      }, { defaultSelection: o8 });
    }, [o8, l8]), null;
  }

  // node_modules/@lexical/react/LexicalAutoFocusPlugin.mjs
  var mod18 = false ? LexicalAutoFocusPlugin_dev_exports : LexicalAutoFocusPlugin_prod_exports;
  var AutoFocusPlugin = mod18.AutoFocusPlugin;

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
  init_Lexical();
  init_LexicalSelection();
  function K4(t9, ...e5) {
    const n11 = new URL("https://lexical.dev/docs/error"), r9 = new URLSearchParams();
    r9.append("code", t9);
    for (const t10 of e5) r9.append("v", t10);
    throw n11.search = r9.toString(), Error(`Minified Lexical error #${t9}; visit ${n11.toString()} for the full message or use the non-minified dev environment for full errors and additional helpful warnings.`);
  }
  function W5(t9) {
    let e5 = 1, n11 = t9.getParent();
    for (; null != n11; ) {
      if (ot4(n11)) {
        const t10 = n11.getParent();
        if (dt4(t10)) {
          e5++, n11 = t10.getParent();
          continue;
        }
        K4(40);
      }
      return e5;
    }
    return e5;
  }
  function J6(t9) {
    let e5 = t9.getParent();
    dt4(e5) || K4(40);
    let n11 = e5;
    for (; null !== n11; ) n11 = n11.getParent(), dt4(n11) && (e5 = n11);
    return e5;
  }
  function U4(t9) {
    let e5 = [];
    const n11 = t9.getChildren().filter(ot4);
    for (let t10 = 0; t10 < n11.length; t10++) {
      const r9 = n11[t10], i13 = r9.getFirstChild();
      dt4(i13) ? e5 = e5.concat(U4(i13)) : e5.push(r9);
    }
    return e5;
  }
  function $4(t9) {
    return ot4(t9) && dt4(t9.getFirstChild());
  }
  function V5(t9) {
    return st4().append(t9);
  }
  function z4(t9, e5) {
    return ot4(t9) && (0 === e5.length || 1 === e5.length && t9.is(e5[0]) && 0 === t9.getChildrenSize());
  }
  function j4(t9) {
    const e5 = $getSelection();
    if (null !== e5) {
      let n11 = e5.getNodes();
      if ($isRangeSelection(e5)) {
        const r10 = e5.getStartEndPoints();
        null === r10 && K4(143);
        const [i13] = r10, s7 = i13.getNode(), o8 = s7.getParent();
        if ($isRootOrShadowRoot(s7)) {
          const t10 = s7.getFirstChild();
          if (t10) n11 = t10.selectStart().getNodes();
          else {
            const t11 = $createParagraphNode();
            s7.append(t11), n11 = t11.select().getNodes();
          }
        } else if (z4(s7, n11)) {
          const e6 = ht5(t9);
          if ($isRootOrShadowRoot(o8)) {
            s7.replace(e6);
            const t10 = st4();
            $isElementNode(s7) && (t10.setFormat(s7.getFormatType()), t10.setIndent(s7.getIndent())), e6.append(t10);
          } else if (ot4(s7)) {
            const t10 = s7.getParentOrThrow();
            q5(e6, t10.getChildren()), t10.replace(e6);
          }
          return;
        }
      }
      const r9 = /* @__PURE__ */ new Set();
      for (let e6 = 0; e6 < n11.length; e6++) {
        const i13 = n11[e6];
        if ($isElementNode(i13) && i13.isEmpty() && !ot4(i13) && !r9.has(i13.getKey())) {
          H6(i13, t9);
          continue;
        }
        let s7 = $isLeafNode(i13) ? i13.getParent() : ot4(i13) && i13.isEmpty() ? i13 : null;
        for (; null != s7; ) {
          const e7 = s7.getKey();
          if (dt4(s7)) {
            if (!r9.has(e7)) {
              const n12 = ht5(t9);
              q5(n12, s7.getChildren()), s7.replace(n12), r9.add(e7);
            }
            break;
          }
          {
            const n12 = s7.getParent();
            if ($isRootOrShadowRoot(n12) && !r9.has(e7)) {
              r9.add(e7), H6(s7, t9);
              break;
            }
            s7 = n12;
          }
        }
      }
    }
  }
  function q5(t9, e5) {
    t9.splice(t9.getChildrenSize(), 0, e5);
  }
  function H6(t9, e5) {
    if (dt4(t9)) return t9;
    const n11 = t9.getPreviousSibling(), r9 = t9.getNextSibling(), i13 = st4();
    let s7;
    if (q5(i13, t9.getChildren()), dt4(n11) && e5 === n11.getListType()) n11.append(i13), dt4(r9) && e5 === r9.getListType() && (q5(n11, r9.getChildren()), r9.remove()), s7 = n11;
    else if (dt4(r9) && e5 === r9.getListType()) r9.getFirstChildOrThrow().insertBefore(i13), s7 = r9;
    else {
      const n12 = ht5(e5);
      n12.append(i13), t9.replace(n12), s7 = n12;
    }
    return i13.setFormat(t9.getFormatType()), i13.setIndent(t9.getIndent()), t9.remove(), s7;
  }
  function X5(t9, e5) {
    const n11 = t9.getLastChild(), r9 = e5.getFirstChild();
    n11 && r9 && $4(n11) && $4(r9) && (X5(n11.getFirstChild(), r9.getFirstChild()), r9.remove());
    const i13 = e5.getChildren();
    i13.length > 0 && t9.append(...i13), e5.remove();
  }
  function G5() {
    const t9 = $getSelection();
    if ($isRangeSelection(t9)) {
      const e5 = /* @__PURE__ */ new Set(), r9 = t9.getNodes(), i13 = t9.anchor.getNode();
      if (z4(i13, r9)) e5.add(J6(i13));
      else for (let t10 = 0; t10 < r9.length; t10++) {
        const i14 = r9[t10];
        if ($isLeafNode(i14)) {
          const t11 = $getNearestNodeOfType(i14, nt4);
          null != t11 && e5.add(J6(t11));
        }
      }
      for (const n11 of e5) {
        let e6 = n11;
        const r10 = U4(n11);
        for (const n12 of r10) {
          const r11 = $createParagraphNode().setTextStyle(t9.style).setTextFormat(t9.format);
          q5(r11, n12.getChildren()), e6.insertAfter(r11), e6 = r11, n12.__key === t9.anchor.key && $setPointFromCaret(t9.anchor, $normalizeCaret($getChildCaret(r11, "next"))), n12.__key === t9.focus.key && $setPointFromCaret(t9.focus, $normalizeCaret($getChildCaret(r11, "next"))), n12.remove();
        }
        n11.remove();
      }
    }
  }
  function Q5(t9) {
    const e5 = "check" !== t9.getListType();
    let n11 = t9.getStart();
    for (const r9 of t9.getChildren()) ot4(r9) && (r9.getValue() !== n11 && r9.setValue(n11), e5 && null != r9.getLatest().__checked && r9.setChecked(void 0), dt4(r9.getFirstChild()) || n11++);
  }
  function Y5(t9) {
    const e5 = /* @__PURE__ */ new Set();
    if ($4(t9) || e5.has(t9.getKey())) return;
    const n11 = t9.getParent(), r9 = t9.getNextSibling(), i13 = t9.getPreviousSibling();
    if ($4(r9) && $4(i13)) {
      const n12 = i13.getFirstChild();
      if (dt4(n12)) {
        n12.append(t9);
        const i14 = r9.getFirstChild();
        if (dt4(i14)) {
          q5(n12, i14.getChildren()), r9.remove(), e5.add(r9.getKey());
        }
      }
    } else if ($4(r9)) {
      const e6 = r9.getFirstChild();
      if (dt4(e6)) {
        const n12 = e6.getFirstChild();
        null !== n12 && n12.insertBefore(t9);
      }
    } else if ($4(i13)) {
      const e6 = i13.getFirstChild();
      dt4(e6) && e6.append(t9);
    } else if (dt4(n11)) {
      const e6 = st4().setTextFormat(t9.getTextFormat()).setTextStyle(t9.getTextStyle()), s7 = ht5(n11.getListType()).setTextFormat(n11.getTextFormat()).setTextStyle(n11.getTextStyle());
      e6.append(s7), s7.append(t9), i13 ? i13.insertAfter(e6) : r9 ? r9.insertBefore(e6) : n11.append(e6);
    }
  }
  function Z5(t9) {
    if ($4(t9)) return;
    const e5 = t9.getParent(), n11 = e5 ? e5.getParent() : void 0;
    if (dt4(n11 ? n11.getParent() : void 0) && ot4(n11) && dt4(e5)) {
      const r9 = e5 ? e5.getFirstChild() : void 0, i13 = e5 ? e5.getLastChild() : void 0;
      if (t9.is(r9)) n11.insertBefore(t9), e5.isEmpty() && n11.remove();
      else if (t9.is(i13)) n11.insertAfter(t9), e5.isEmpty() && n11.remove();
      else {
        const r10 = e5.getListType(), i14 = st4(), s7 = ht5(r10);
        i14.append(s7), t9.getPreviousSiblings().forEach((t10) => s7.append(t10));
        const o8 = st4(), l8 = ht5(r10);
        o8.append(l8), q5(l8, t9.getNextSiblings()), n11.insertBefore(i14), n11.insertAfter(o8), n11.replace(t9);
      }
    }
  }
  function tt4() {
    const t9 = $getSelection();
    if (!$isRangeSelection(t9) || !t9.isCollapsed()) return false;
    const e5 = t9.anchor.getNode();
    if (!ot4(e5) || 0 !== e5.getChildrenSize()) return false;
    const n11 = J6(e5), r9 = e5.getParent();
    dt4(r9) || K4(40);
    const i13 = r9.getParent();
    let s7;
    if ($isRootOrShadowRoot(i13)) s7 = $createParagraphNode(), n11.insertAfter(s7);
    else {
      if (!ot4(i13)) return false;
      s7 = st4(), i13.insertAfter(s7);
    }
    s7.setTextStyle(t9.style).setTextFormat(t9.format).select();
    const o8 = e5.getNextSiblings();
    if (o8.length > 0) {
      const t10 = ht5(r9.getListType());
      if (ot4(s7)) {
        const e6 = st4();
        e6.append(t10), s7.insertAfter(e6);
      } else s7.insertAfter(t10);
      t10.append(...o8);
    }
    return (function(t10) {
      let e6 = t10;
      for (; null == e6.getNextSibling() && null == e6.getPreviousSibling(); ) {
        const t11 = e6.getParent();
        if (null == t11 || !ot4(t11) && !dt4(t11)) break;
        e6 = t11;
      }
      e6.remove();
    })(e5), true;
  }
  function et4(...t9) {
    const e5 = [];
    for (const n11 of t9) if (n11 && "string" == typeof n11) for (const [t10] of n11.matchAll(/\S+/g)) e5.push(t10);
    return e5;
  }
  var nt4 = class extends ElementNode {
    __value;
    __checked;
    $config() {
      return this.config("listitem", { $transform: (t9) => {
        if (null == t9.__checked) return;
        const e5 = t9.getParent();
        dt4(e5) && "check" !== e5.getListType() && null != t9.getChecked() && t9.setChecked(void 0);
      }, extends: ElementNode, importDOM: buildImportMap({ li: () => ({ conversion: rt4, priority: 0 }) }) });
    }
    constructor(t9 = 1, e5 = void 0, n11) {
      super(n11), this.__value = void 0 === t9 ? 1 : t9, this.__checked = e5;
    }
    afterCloneFrom(t9) {
      super.afterCloneFrom(t9), this.__value = t9.__value, this.__checked = t9.__checked;
    }
    createDOM(t9) {
      const e5 = document.createElement("li");
      return this.updateListItemDOM(null, e5, t9), e5;
    }
    updateListItemDOM(t9, e5, n11) {
      !(function(t10, e6, n12) {
        const r9 = e6.getParent();
        !dt4(r9) || "check" !== r9.getListType() || dt4(e6.getFirstChild()) ? (t10.removeAttribute("role"), t10.removeAttribute("tabIndex"), t10.removeAttribute("aria-checked")) : (t10.setAttribute("role", "checkbox"), t10.setAttribute("tabIndex", "-1"), n12 && e6.__checked === n12.__checked || t10.setAttribute("aria-checked", e6.getChecked() ? "true" : "false"));
      })(e5, this, t9), e5.value = this.__value, (function(t10, e6, n12) {
        const s8 = [], o9 = [], l8 = e6.list, c10 = l8 ? l8.listitem : void 0;
        let a10;
        l8 && l8.nested && (a10 = l8.nested.listitem);
        void 0 !== c10 && s8.push(...et4(c10));
        if (l8) {
          const t11 = n12.getParent(), e7 = dt4(t11) && "check" === t11.getListType(), r9 = n12.getChecked();
          e7 && !r9 || o9.push(l8.listitemUnchecked), e7 && r9 || o9.push(l8.listitemChecked), e7 && s8.push(r9 ? l8.listitemChecked : l8.listitemUnchecked);
        }
        if (void 0 !== a10) {
          const t11 = et4(a10);
          n12.getChildren().some((t12) => dt4(t12)) ? s8.push(...t11) : o9.push(...t11);
        }
        o9.length > 0 && removeClassNamesFromElement(t10, ...o9);
        s8.length > 0 && addClassNamesToElement(t10, ...s8);
      })(e5, n11.theme, this);
      const s7 = t9 ? t9.__style : "", o8 = this.__style;
      s7 !== o8 && ("" === o8 ? e5.removeAttribute("style") : e5.style.cssText = o8), (function(t10, e6, n12) {
        const r9 = getStyleObjectFromCSS(e6.__textStyle);
        for (const e7 in r9) t10.style.setProperty(`--listitem-marker-${e7}`, r9[e7]);
        if (n12) for (const e7 in getStyleObjectFromCSS(n12.__textStyle)) e7 in r9 || t10.style.removeProperty(`--listitem-marker-${e7}`);
      })(e5, this, t9);
    }
    updateDOM(t9, e5, n11) {
      const r9 = e5;
      return this.updateListItemDOM(t9, r9, n11), false;
    }
    updateFromJSON(t9) {
      return super.updateFromJSON(t9).setValue(t9.value).setChecked(t9.checked);
    }
    exportDOM(t9) {
      const e5 = this.createDOM(t9._config), n11 = this.getFormatType();
      n11 && (e5.style.textAlign = n11);
      const r9 = this.getDirection();
      return r9 && (e5.dir = r9), { element: e5 };
    }
    exportJSON() {
      return { ...super.exportJSON(), checked: this.getChecked(), value: this.getValue() };
    }
    append(...t9) {
      for (let e5 = 0; e5 < t9.length; e5++) {
        const n11 = t9[e5];
        if ($isElementNode(n11) && this.canMergeWith(n11)) {
          const t10 = n11.getChildren();
          this.append(...t10), n11.remove();
        } else super.append(n11);
      }
      return this;
    }
    replace(t9, e5) {
      if (ot4(t9)) return super.replace(t9);
      this.setIndent(0);
      const n11 = this.getParentOrThrow();
      if (!dt4(n11)) return t9;
      if (n11.__first === this.getKey()) n11.insertBefore(t9);
      else if (n11.__last === this.getKey()) n11.insertAfter(t9);
      else {
        const e6 = ht5(n11.getListType());
        let r9 = this.getNextSibling();
        for (; r9; ) {
          const t10 = r9;
          r9 = r9.getNextSibling(), e6.append(t10);
        }
        n11.insertAfter(t9), t9.insertAfter(e6);
      }
      return e5 && ($isElementNode(t9) || K4(139), this.getChildren().forEach((e6) => {
        t9.append(e6);
      })), this.remove(), 0 === n11.getChildrenSize() && n11.remove(), t9;
    }
    insertAfter(t9, e5 = true) {
      const n11 = this.getParentOrThrow();
      if (dt4(n11) || K4(39), ot4(t9)) return super.insertAfter(t9, e5);
      const r9 = this.getNextSiblings();
      if (n11.insertAfter(t9, e5), 0 !== r9.length) {
        const i13 = ht5(n11.getListType());
        r9.forEach((t10) => i13.append(t10)), t9.insertAfter(i13, e5);
      }
      return t9;
    }
    remove(t9) {
      const e5 = this.getPreviousSibling(), n11 = this.getNextSibling();
      super.remove(t9), e5 && n11 && $4(e5) && $4(n11) && (X5(e5.getFirstChild(), n11.getFirstChild()), n11.remove());
    }
    insertNewAfter(t9, e5 = true) {
      const n11 = st4().updateFromJSON(this.exportJSON()).setChecked(!this.getChecked() && void 0);
      return this.insertAfter(n11, e5), n11;
    }
    collapseAtStart(t9) {
      const e5 = $createParagraphNode();
      this.getChildren().forEach((t10) => e5.append(t10));
      const n11 = this.getParentOrThrow(), r9 = n11.getParentOrThrow(), i13 = ot4(r9);
      if (1 === n11.getChildrenSize()) if (i13) n11.remove(), r9.select();
      else {
        n11.insertBefore(e5), n11.remove();
        const r10 = t9.anchor, i14 = t9.focus, s7 = e5.getKey();
        "element" === r10.type && r10.getNode().is(this) && r10.set(s7, r10.offset, "element"), "element" === i14.type && i14.getNode().is(this) && i14.set(s7, i14.offset, "element");
      }
      else n11.insertBefore(e5), this.remove();
      return true;
    }
    getValue() {
      return this.getLatest().__value;
    }
    setValue(t9) {
      const e5 = this.getWritable();
      return e5.__value = t9, e5;
    }
    getChecked() {
      const t9 = this.getLatest();
      let e5;
      const n11 = this.getParent();
      return dt4(n11) && (e5 = n11.getListType()), "check" === e5 ? Boolean(t9.__checked) : void 0;
    }
    setChecked(t9) {
      const e5 = this.getWritable();
      return e5.__checked = t9, e5;
    }
    toggleChecked() {
      const t9 = this.getWritable();
      return t9.setChecked(!t9.__checked);
    }
    getIndent() {
      const t9 = this.getParent();
      if (null === t9 || !this.isAttached()) return this.getLatest().__indent;
      let e5 = t9.getParentOrThrow(), n11 = 0;
      for (; ot4(e5); ) e5 = e5.getParentOrThrow().getParentOrThrow(), n11++;
      return n11;
    }
    setIndent(t9) {
      "number" != typeof t9 && K4(117), (t9 = Math.floor(t9)) >= 0 || K4(199);
      let e5 = this.getIndent();
      for (; e5 !== t9; ) e5 < t9 ? (Y5(this), e5++) : (Z5(this), e5--);
      return this;
    }
    canInsertAfter(t9) {
      return ot4(t9);
    }
    canReplaceWith(t9) {
      return ot4(t9);
    }
    canMergeWith(t9) {
      return ot4(t9) || $isParagraphNode(t9);
    }
    extractWithChild(t9, e5) {
      if (!$isRangeSelection(e5)) return false;
      const n11 = e5.anchor.getNode(), r9 = e5.focus.getNode();
      return this.isParentOf(n11) && this.isParentOf(r9) && this.getTextContent().length === e5.getTextContent().length;
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
  function rt4(t9) {
    if (t9.classList.contains("task-list-item")) {
      for (const e6 of t9.children) if ("INPUT" === e6.tagName) return it4(e6);
    }
    if (t9.classList.contains("joplin-checkbox")) {
      for (const e6 of t9.children) if (e6.classList.contains("checkbox-wrapper") && e6.children.length > 0 && "INPUT" === e6.children[0].tagName) return it4(e6.children[0]);
    }
    const e5 = t9.getAttribute("aria-checked");
    return { node: st4("true" === e5 || "false" !== e5 && void 0) };
  }
  function it4(t9) {
    if (!("checkbox" === t9.getAttribute("type"))) return { node: null };
    return { node: st4(t9.hasAttribute("checked")) };
  }
  function st4(t9) {
    return $applyNodeReplacement(new nt4(void 0, t9));
  }
  function ot4(t9) {
    return t9 instanceof nt4;
  }
  var lt4 = class extends ElementNode {
    __tag;
    __start;
    __listType;
    $config() {
      return this.config("list", { $transform: (t9) => {
        !(function(t10) {
          const e5 = t10.getNextSibling();
          dt4(e5) && t10.getListType() === e5.getListType() && X5(t10, e5);
        })(t9), Q5(t9);
      }, extends: ElementNode, importDOM: buildImportMap({ ol: () => ({ conversion: gt5, priority: 0 }), ul: () => ({ conversion: gt5, priority: 0 }) }) });
    }
    constructor(t9 = "number", e5 = 1, n11) {
      super(n11);
      const r9 = ut4[t9] || t9;
      this.__listType = r9, this.__tag = "number" === r9 ? "ol" : "ul", this.__start = e5;
    }
    afterCloneFrom(t9) {
      super.afterCloneFrom(t9), this.__listType = t9.__listType, this.__tag = t9.__tag, this.__start = t9.__start;
    }
    getTag() {
      return this.getLatest().__tag;
    }
    setListType(t9) {
      const e5 = this.getWritable();
      return e5.__listType = t9, e5.__tag = "number" === t9 ? "ol" : "ul", e5;
    }
    getListType() {
      return this.getLatest().__listType;
    }
    getStart() {
      return this.getLatest().__start;
    }
    setStart(t9) {
      const e5 = this.getWritable();
      return e5.__start = t9, e5;
    }
    createDOM(t9, e5) {
      const n11 = this.__tag, r9 = document.createElement(n11);
      return 1 !== this.__start && r9.setAttribute("start", String(this.__start)), r9.__lexicalListType = this.__listType, ct4(r9, t9.theme, this), r9;
    }
    updateDOM(t9, e5, n11) {
      return t9.__tag !== this.__tag || t9.__listType !== this.__listType || (ct4(e5, n11.theme, this), false);
    }
    updateFromJSON(t9) {
      return super.updateFromJSON(t9).setListType(t9.listType).setStart(t9.start);
    }
    exportDOM(t9) {
      const e5 = this.createDOM(t9._config, t9);
      return isHTMLElement2(e5) && (1 !== this.__start && e5.setAttribute("start", String(this.__start)), "check" === this.__listType && e5.setAttribute("__lexicalListType", "check")), { element: e5 };
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
    splice(t9, e5, n11) {
      let r9 = n11;
      for (let t10 = 0; t10 < n11.length; t10++) {
        const e6 = n11[t10];
        ot4(e6) || (r9 === n11 && (r9 = [...n11]), r9[t10] = st4().append(!$isElementNode(e6) || dt4(e6) || e6.isInline() ? e6 : $createTextNode(e6.getTextContent())));
      }
      return super.splice(t9, e5, r9);
    }
    extractWithChild(t9) {
      return ot4(t9);
    }
  };
  function ct4(t9, e5, n11) {
    const s7 = [], o8 = [], l8 = e5.list;
    if (void 0 !== l8) {
      const t10 = l8[`${n11.__tag}Depth`] || [], e6 = W5(n11) - 1, r9 = e6 % t10.length, i13 = t10[r9], c10 = l8[n11.__tag];
      let a10;
      const g5 = l8.nested, u10 = l8.checklist;
      if (void 0 !== g5 && g5.list && (a10 = g5.list), void 0 !== c10 && s7.push(c10), void 0 !== u10 && "check" === n11.__listType && s7.push(u10), void 0 !== i13) {
        s7.push(...et4(i13));
        for (let e7 = 0; e7 < t10.length; e7++) e7 !== r9 && o8.push(n11.__tag + e7);
      }
      if (void 0 !== a10) {
        const t11 = et4(a10);
        e6 > 1 ? s7.push(...t11) : o8.push(...t11);
      }
    }
    o8.length > 0 && removeClassNamesFromElement(t9, ...o8), s7.length > 0 && addClassNamesToElement(t9, ...s7);
  }
  function at4(t9) {
    const e5 = [];
    for (let n11 = 0; n11 < t9.length; n11++) {
      const r9 = t9[n11];
      if (ot4(r9)) {
        e5.push(r9);
        const t10 = r9.getChildren();
        t10.length > 1 && t10.forEach((t11) => {
          dt4(t11) && e5.push(V5(t11));
        });
      } else e5.push(V5(r9));
    }
    return e5;
  }
  function gt5(t9) {
    const e5 = t9.nodeName.toLowerCase();
    let n11 = null;
    if ("ol" === e5) {
      n11 = ht5("number", t9.start);
    } else "ul" === e5 && (n11 = (function(t10) {
      if ("check" === t10.getAttribute("__lexicallisttype") || t10.classList.contains("contains-task-list") || "1" === t10.getAttribute("data-is-checklist")) return true;
      for (const e6 of t10.childNodes) if (isHTMLElement2(e6) && e6.hasAttribute("aria-checked")) return true;
      return false;
    })(t9) ? ht5("check") : ht5("bullet"));
    return { after: at4, node: n11 };
  }
  var ut4 = { ol: "number", ul: "bullet" };
  function ht5(t9 = "number", e5 = 1) {
    return $applyNodeReplacement(new lt4(t9, e5));
  }
  function dt4(t9) {
    return t9 instanceof lt4;
  }
  var ft4 = createCommand("INSERT_CHECK_LIST_COMMAND");
  function pt5(t9) {
    return mergeRegister(t9.registerCommand(ft4, () => (j4("check"), true), COMMAND_PRIORITY_LOW), t9.registerCommand(KEY_ARROW_DOWN_COMMAND, (e5) => Tt5(e5, t9, false), COMMAND_PRIORITY_LOW), t9.registerCommand(KEY_ARROW_UP_COMMAND, (e5) => Tt5(e5, t9, true), COMMAND_PRIORITY_LOW), t9.registerCommand(KEY_ESCAPE_COMMAND, () => {
      if (null != Ct5()) {
        const e5 = t9.getRootElement();
        return null != e5 && e5.focus(), true;
      }
      return false;
    }, COMMAND_PRIORITY_LOW), t9.registerCommand(KEY_SPACE_COMMAND, (e5) => {
      const n11 = Ct5();
      return !(null == n11 || !t9.isEditable()) && (t9.update(() => {
        const t10 = $getNearestNodeFromDOMNode(n11);
        ot4(t10) && (e5.preventDefault(), t10.toggleChecked());
      }), true);
    }, COMMAND_PRIORITY_LOW), t9.registerCommand(KEY_ARROW_LEFT_COMMAND, (e5) => t9.getEditorState().read(() => {
      const n11 = $getSelection();
      if ($isRangeSelection(n11) && n11.isCollapsed()) {
        const { anchor: r9 } = n11, i13 = "element" === r9.type;
        if (i13 || 0 === r9.offset) {
          const n12 = r9.getNode(), s7 = $findMatchingParent2(n12, (t10) => $isElementNode(t10) && !t10.isInline());
          if (ot4(s7)) {
            const r10 = s7.getParent();
            if (dt4(r10) && "check" === r10.getListType() && (i13 || s7.getFirstDescendant() === n12)) {
              const n13 = t9.getElementByKey(s7.__key);
              if (null != n13 && document.activeElement !== n13) return n13.focus(), e5.preventDefault(), true;
            }
          }
        }
      }
      return false;
    }), COMMAND_PRIORITY_LOW), t9.registerRootListener((t10, e5) => {
      null !== t10 && (t10.addEventListener("click", _t5), t10.addEventListener("pointerdown", yt5)), null !== e5 && (e5.removeEventListener("click", _t5), e5.removeEventListener("pointerdown", yt5));
    }));
  }
  function mt4(t9, e5) {
    const n11 = t9.target;
    if (!isHTMLElement2(n11)) return;
    const r9 = n11.firstChild;
    if (isHTMLElement2(r9) && ("UL" === r9.tagName || "OL" === r9.tagName)) return;
    const i13 = n11.parentNode;
    if (!i13 || "check" !== i13.__lexicalListType) return;
    const o8 = n11.getBoundingClientRect(), l8 = calculateZoomLevel(n11), a10 = t9.clientX / l8, g5 = window.getComputedStyle ? window.getComputedStyle(n11, "::before") : { width: "0px" }, u10 = parseFloat(g5.width), h3 = "touch" === t9.pointerType ? 32 : 0;
    ("rtl" === n11.dir ? a10 < o8.right + h3 && a10 > o8.right - u10 - h3 : a10 > o8.left - h3 && a10 < o8.left + u10 + h3) && e5();
  }
  function _t5(t9) {
    mt4(t9, () => {
      if (isHTMLElement2(t9.target)) {
        const e5 = t9.target, n11 = getNearestEditorFromDOMNode(e5);
        null != n11 && n11.isEditable() && n11.update(() => {
          const t10 = $getNearestNodeFromDOMNode(e5);
          ot4(t10) && (e5.focus(), t10.toggleChecked());
        });
      }
    });
  }
  function yt5(t9) {
    mt4(t9, () => {
      t9.preventDefault();
    });
  }
  function Ct5() {
    const t9 = document.activeElement;
    return isHTMLElement2(t9) && "LI" === t9.tagName && null != t9.parentNode && "check" === t9.parentNode.__lexicalListType ? t9 : null;
  }
  function Tt5(t9, e5, n11) {
    const r9 = Ct5();
    return null != r9 && e5.update(() => {
      const i13 = $getNearestNodeFromDOMNode(r9);
      if (!ot4(i13)) return;
      const s7 = (function(t10, e6) {
        let n12 = e6 ? t10.getPreviousSibling() : t10.getNextSibling(), r10 = t10;
        for (; null == n12 && ot4(r10); ) r10 = r10.getParentOrThrow().getParent(), null != r10 && (n12 = e6 ? r10.getPreviousSibling() : r10.getNextSibling());
        for (; ot4(n12); ) {
          const t11 = e6 ? n12.getLastChild() : n12.getFirstChild();
          if (!dt4(t11)) return n12;
          n12 = e6 ? t11.getLastChild() : t11.getFirstChild();
        }
        return null;
      })(i13, n11);
      if (null != s7) {
        s7.selectStart();
        const n12 = e5.getElementByKey(s7.__key);
        null != n12 && (t9.preventDefault(), setTimeout(() => {
          n12.focus();
        }, 0));
      }
    }), false;
  }
  var vt5 = createCommand("UPDATE_LIST_START_COMMAND");
  var St5 = createCommand("INSERT_UNORDERED_LIST_COMMAND");
  var xt5 = createCommand("INSERT_ORDERED_LIST_COMMAND");
  var kt5 = createCommand("REMOVE_LIST_COMMAND");
  function bt5(t9) {
    return mergeRegister(t9.registerCommand(xt5, () => (j4("number"), true), COMMAND_PRIORITY_LOW), t9.registerCommand(vt5, (t10) => {
      const { listNodeKey: e5, newStart: n11 } = t10, r9 = $getNodeByKey(e5);
      return !!dt4(r9) && ("number" === r9.getListType() && (r9.setStart(n11), Q5(r9)), true);
    }, COMMAND_PRIORITY_LOW), t9.registerCommand(St5, () => (j4("bullet"), true), COMMAND_PRIORITY_LOW), t9.registerCommand(kt5, () => (G5(), true), COMMAND_PRIORITY_LOW), t9.registerCommand(INSERT_PARAGRAPH_COMMAND, () => tt4(), COMMAND_PRIORITY_LOW), t9.registerNodeTransform(nt4, (t10) => {
      const e5 = t10.getFirstChild();
      if (e5) {
        if ($isTextNode(e5)) {
          const n11 = e5.getStyle(), r9 = e5.getFormat();
          t10.getTextStyle() !== n11 && t10.setTextStyle(n11), t10.getTextFormat() !== r9 && t10.setTextFormat(r9);
        }
      } else {
        const e6 = $getSelection();
        $isRangeSelection(e6) && (e6.style !== t10.getTextStyle() || e6.format !== t10.getTextFormat()) && e6.isCollapsed() && t10.is(e6.anchor.getNode()) && t10.setTextStyle(e6.style).setTextFormat(e6.format);
      }
    }), t9.registerNodeTransform(TextNode, (t10) => {
      const e5 = t10.getParent();
      if (ot4(e5) && t10.is(e5.getFirstChild())) {
        const n11 = t10.getStyle(), r9 = t10.getFormat();
        n11 === e5.getTextStyle() && r9 === e5.getTextFormat() || e5.setTextStyle(n11).setTextFormat(r9);
      }
    }));
  }
  function Lt4(t9) {
    const e5 = (t10) => {
      const e6 = t10.getParent();
      if (dt4(t10.getFirstChild()) || !dt4(e6)) return;
      const n11 = $findMatchingParent2(t10, (t11) => ot4(t11) && dt4(t11.getParent()) && ot4(t11.getPreviousSibling()));
      if (null === n11 && t10.getIndent() > 0) t10.setIndent(0);
      else if (ot4(n11)) {
        const r9 = n11.getPreviousSibling();
        if (ot4(r9)) {
          const n12 = (function(t11) {
            let e7 = t11, n13 = e7.getFirstChild();
            for (; dt4(n13); ) {
              const t12 = n13.getLastChild();
              if (!ot4(t12)) break;
              e7 = t12, n13 = e7.getFirstChild();
            }
            return e7;
          })(r9), i13 = n12.getParent();
          if (dt4(i13)) {
            const n13 = W5(i13);
            n13 + 1 < W5(e6) && t10.setIndent(n13);
          }
        }
      }
    };
    return t9.registerNodeTransform(lt4, (t10) => {
      const n11 = [t10];
      for (; n11.length > 0; ) {
        const t11 = n11.shift();
        if (dt4(t11)) {
          for (const r9 of t11.getChildren()) if (ot4(r9)) {
            e5(r9);
            const t12 = r9.getFirstChild();
            dt4(t12) && n11.push(t12);
          }
        }
      }
    });
  }
  function Nt5(t9, e5) {
    t9.update(() => j4(e5));
  }
  function Ft4(t9) {
    t9.update(() => G5());
  }
  var Pt5 = defineExtension({ build: (t9, n11, r9) => namedSignals(n11), config: safeCast({ hasStrictIndent: false }), name: "@lexical/list/List", nodes: () => [lt4, nt4], register(e5, n11, r9) {
    const i13 = r9.getOutput();
    return mergeRegister(bt5(e5), effect(() => i13.hasStrictIndent.value ? Lt4(e5) : void 0));
  } });
  var At5 = defineExtension({ dependencies: [Pt5], name: "@lexical/list/CheckList", register: pt5 });

  // node_modules/@lexical/list/LexicalList.mjs
  var mod19 = false ? LexicalList_dev_exports : LexicalList_prod_exports;
  var $createListItemNode = mod19.$createListItemNode;
  var $createListNode = mod19.$createListNode;
  var $getListDepth = mod19.$getListDepth;
  var $handleListInsertParagraph = mod19.$handleListInsertParagraph;
  var $insertList = mod19.$insertList;
  var $isListItemNode = mod19.$isListItemNode;
  var $isListNode = mod19.$isListNode;
  var $removeList = mod19.$removeList;
  var CheckListExtension = mod19.CheckListExtension;
  var INSERT_CHECK_LIST_COMMAND = mod19.INSERT_CHECK_LIST_COMMAND;
  var INSERT_ORDERED_LIST_COMMAND = mod19.INSERT_ORDERED_LIST_COMMAND;
  var INSERT_UNORDERED_LIST_COMMAND = mod19.INSERT_UNORDERED_LIST_COMMAND;
  var ListExtension = mod19.ListExtension;
  var ListItemNode = mod19.ListItemNode;
  var ListNode = mod19.ListNode;
  var REMOVE_LIST_COMMAND = mod19.REMOVE_LIST_COMMAND;
  var UPDATE_LIST_START_COMMAND = mod19.UPDATE_LIST_START_COMMAND;
  var insertList = mod19.insertList;
  var registerCheckList = mod19.registerCheckList;
  var registerList = mod19.registerList;
  var registerListStrictIndentTransform = mod19.registerListStrictIndentTransform;
  var removeList = mod19.removeList;

  // node_modules/@lexical/react/LexicalListPlugin.prod.mjs
  var LexicalListPlugin_prod_exports = {};
  __export(LexicalListPlugin_prod_exports, {
    ListPlugin: () => s5
  });
  var import_react8 = __toESM(require_react(), 1);
  function s5({ hasStrictIndent: s7 = false }) {
    const [c10] = useLexicalComposerContext();
    return (0, import_react8.useEffect)(() => {
      if (!c10.hasNodes([ListNode, ListItemNode])) throw new Error("ListPlugin: ListNode and/or ListItemNode not registered on editor");
    }, [c10]), (0, import_react8.useEffect)(() => {
      if (s7) return registerListStrictIndentTransform(c10);
    }, [c10, s7]), (function(r9) {
      (0, import_react8.useEffect)(() => registerList(r9), [r9]);
    })(c10), null;
  }

  // node_modules/@lexical/react/LexicalListPlugin.mjs
  var mod20 = false ? LexicalListPlugin_dev_exports : LexicalListPlugin_prod_exports;
  var ListPlugin = mod20.ListPlugin;

  // node_modules/@lexical/react/LexicalCheckListPlugin.prod.mjs
  var LexicalCheckListPlugin_prod_exports = {};
  __export(LexicalCheckListPlugin_prod_exports, {
    CheckListPlugin: () => e4
  });
  var import_react9 = __toESM(require_react(), 1);
  function e4() {
    const [e5] = useLexicalComposerContext();
    return (0, import_react9.useEffect)(() => registerCheckList(e5), [e5]), null;
  }

  // node_modules/@lexical/react/LexicalCheckListPlugin.mjs
  var mod21 = false ? LexicalCheckListPlugin_dev_exports : LexicalCheckListPlugin_prod_exports;
  var CheckListPlugin = mod21.CheckListPlugin;

  // node_modules/@lexical/link/LexicalLink.prod.mjs
  var LexicalLink_prod_exports = {};
  __export(LexicalLink_prod_exports, {
    $createAutoLinkNode: () => I4,
    $createLinkNode: () => D5,
    $isAutoLinkNode: () => E6,
    $isLinkNode: () => w5,
    $toggleLink: () => J7,
    AutoLinkExtension: () => st5,
    AutoLinkNode: () => A4,
    ClickableLinkExtension: () => $5,
    LinkExtension: () => B6,
    LinkNode: () => y4,
    TOGGLE_LINK_COMMAND: () => P4,
    createLinkMatcherWithRegExp: () => H7,
    formatUrl: () => W6,
    registerAutoLink: () => lt5,
    registerClickableLink: () => z5,
    registerLink: () => F6,
    toggleLink: () => ot5
  });
  init_Lexical();
  var R5 = /* @__PURE__ */ new Set(["http:", "https:", "mailto:", "sms:", "tel:"]);
  var y4 = class _y extends ElementNode {
    __url;
    __target;
    __rel;
    __title;
    static getType() {
      return "link";
    }
    static clone(t9) {
      return new _y(t9.__url, { rel: t9.__rel, target: t9.__target, title: t9.__title }, t9.__key);
    }
    constructor(t9 = "", e5 = {}, n11) {
      super(n11);
      const { target: r9 = null, rel: i13 = null, title: l8 = null } = e5;
      this.__url = t9, this.__target = r9, this.__rel = i13, this.__title = l8;
    }
    createDOM(e5) {
      const n11 = document.createElement("a");
      return this.updateLinkDOM(null, n11, e5), addClassNamesToElement(n11, e5.theme.link), n11;
    }
    updateLinkDOM(t9, n11, r9) {
      if (isHTMLAnchorElement2(n11)) {
        t9 && t9.__url === this.__url || (n11.href = this.sanitizeUrl(this.__url));
        for (const e5 of ["target", "rel", "title"]) {
          const r10 = `__${e5}`, i13 = this[r10];
          t9 && t9[r10] === i13 || (i13 ? n11[e5] = i13 : n11.removeAttribute(e5));
        }
      }
    }
    updateDOM(t9, e5, n11) {
      return this.updateLinkDOM(t9, e5, n11), false;
    }
    static importDOM() {
      return { a: (t9) => ({ conversion: N3, priority: 1 }) };
    }
    static importJSON(t9) {
      return D5().updateFromJSON(t9);
    }
    updateFromJSON(t9) {
      return super.updateFromJSON(t9).setURL(t9.url).setRel(t9.rel || null).setTarget(t9.target || null).setTitle(t9.title || null);
    }
    sanitizeUrl(t9) {
      t9 = W6(t9);
      try {
        const e5 = new URL(W6(t9));
        if (!R5.has(e5.protocol)) return "about:blank";
      } catch (e5) {
        return t9;
      }
      return t9;
    }
    exportJSON() {
      return { ...super.exportJSON(), rel: this.getRel(), target: this.getTarget(), title: this.getTitle(), url: this.getURL() };
    }
    getURL() {
      return this.getLatest().__url;
    }
    setURL(t9) {
      const e5 = this.getWritable();
      return e5.__url = t9, e5;
    }
    getTarget() {
      return this.getLatest().__target;
    }
    setTarget(t9) {
      const e5 = this.getWritable();
      return e5.__target = t9, e5;
    }
    getRel() {
      return this.getLatest().__rel;
    }
    setRel(t9) {
      const e5 = this.getWritable();
      return e5.__rel = t9, e5;
    }
    getTitle() {
      return this.getLatest().__title;
    }
    setTitle(t9) {
      const e5 = this.getWritable();
      return e5.__title = t9, e5;
    }
    insertNewAfter(t9, e5 = true) {
      const n11 = D5(this.__url, { rel: this.__rel, target: this.__target, title: this.__title });
      return this.insertAfter(n11, e5), n11;
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
    extractWithChild(t9, e5, n11) {
      if (!$isRangeSelection(e5)) return false;
      const r9 = e5.anchor.getNode(), i13 = e5.focus.getNode();
      return this.isParentOf(r9) && this.isParentOf(i13) && e5.getTextContent().length > 0;
    }
    isEmailURI() {
      return this.__url.startsWith("mailto:");
    }
    isWebSiteURI() {
      return this.__url.startsWith("https://") || this.__url.startsWith("http://");
    }
  };
  function N3(t9) {
    let n11 = null;
    if (isHTMLAnchorElement2(t9)) {
      const e5 = t9.textContent;
      (null !== e5 && "" !== e5 || t9.children.length > 0) && (n11 = D5(t9.getAttribute("href") || "", { rel: t9.getAttribute("rel"), target: t9.getAttribute("target"), title: t9.getAttribute("title") }));
    }
    return { node: n11 };
  }
  function D5(t9 = "", e5) {
    return $applyNodeReplacement(new y4(t9, e5));
  }
  function w5(t9) {
    return t9 instanceof y4;
  }
  var A4 = class _A extends y4 {
    __isUnlinked;
    constructor(t9 = "", e5 = {}, n11) {
      super(t9, e5, n11), this.__isUnlinked = void 0 !== e5.isUnlinked && null !== e5.isUnlinked && e5.isUnlinked;
    }
    static getType() {
      return "autolink";
    }
    static clone(t9) {
      return new _A(t9.__url, { isUnlinked: t9.__isUnlinked, rel: t9.__rel, target: t9.__target, title: t9.__title }, t9.__key);
    }
    getIsUnlinked() {
      return this.__isUnlinked;
    }
    setIsUnlinked(t9) {
      const e5 = this.getWritable();
      return e5.__isUnlinked = t9, e5;
    }
    createDOM(t9) {
      return this.__isUnlinked ? document.createElement("span") : super.createDOM(t9);
    }
    updateDOM(t9, e5, n11) {
      return super.updateDOM(t9, e5, n11) || t9.__isUnlinked !== this.__isUnlinked;
    }
    static importJSON(t9) {
      return I4().updateFromJSON(t9);
    }
    updateFromJSON(t9) {
      return super.updateFromJSON(t9).setIsUnlinked(t9.isUnlinked || false);
    }
    static importDOM() {
      return null;
    }
    exportJSON() {
      return { ...super.exportJSON(), isUnlinked: this.__isUnlinked };
    }
    insertNewAfter(t9, e5 = true) {
      const n11 = this.getParentOrThrow().insertNewAfter(t9, e5);
      if ($isElementNode(n11)) {
        const t10 = I4(this.__url, { isUnlinked: this.__isUnlinked, rel: this.__rel, target: this.__target, title: this.__title });
        return n11.append(t10), t10;
      }
      return null;
    }
  };
  function I4(t9 = "", e5) {
    return $applyNodeReplacement(new A4(t9, e5));
  }
  function E6(t9) {
    return t9 instanceof A4;
  }
  var P4 = createCommand("TOGGLE_LINK_COMMAND");
  function M4(t9, e5) {
    if ("element" === t9.type) {
      const n11 = t9.getNode();
      $isElementNode(n11) || (function(t10, ...e6) {
        const n12 = new URL("https://lexical.dev/docs/error"), r9 = new URLSearchParams();
        r9.append("code", t10);
        for (const t11 of e6) r9.append("v", t11);
        throw n12.search = r9.toString(), Error(`Minified Lexical error #${t10}; visit ${n12.toString()} for the full message or use the non-minified dev environment for full errors and additional helpful warnings.`);
      })(252);
      return n11.getChildren()[t9.offset + e5] || null;
    }
    return null;
  }
  function J7(t9, e5 = {}) {
    let r9;
    if (t9 && "object" == typeof t9) {
      const { url: n11, ...i14 } = t9;
      r9 = n11, e5 = { ...i14, ...e5 };
    } else r9 = t9;
    const { target: i13, title: l8 } = e5, s7 = void 0 === e5.rel ? "noreferrer" : e5.rel, u10 = $getSelection();
    if (null === u10 || !$isRangeSelection(u10) && !$isNodeSelection(u10)) return;
    if ($isNodeSelection(u10)) {
      const t10 = u10.getNodes();
      if (0 === t10.length) return;
      return void t10.forEach((t11) => {
        if (null === r9) {
          const e6 = $findMatchingParent2(t11, (t12) => !E6(t12) && w5(t12));
          e6 && (e6.insertBefore(t11), 0 === e6.getChildren().length && e6.remove());
        } else {
          const e6 = $findMatchingParent2(t11, (t12) => !E6(t12) && w5(t12));
          if (e6) e6.setURL(r9), void 0 !== i13 && e6.setTarget(i13), void 0 !== s7 && e6.setRel(s7);
          else {
            const e7 = D5(r9, { rel: s7, target: i13 });
            t11.insertBefore(e7), e7.append(t11);
          }
        }
      });
    }
    const h3 = u10.extract();
    if (null === r9) {
      const t10 = /* @__PURE__ */ new Set();
      return void h3.forEach((e6) => {
        const n11 = e6.getParent();
        if (w5(n11) && !E6(n11)) {
          const e7 = n11.getKey();
          if (t10.has(e7)) return;
          !(function(t11, e8) {
            const n12 = new Set(e8.filter((e9) => t11.isParentOf(e9)).map((t12) => t12.getKey())), r10 = t11.getChildren(), i14 = r10.filter((t12) => n12.has(t12.getKey()));
            if (i14.length === r10.length) return r10.forEach((e9) => t11.insertBefore(e9)), void t11.remove();
            const l9 = r10.findIndex((t12) => n12.has(t12.getKey())), s8 = r10.findLastIndex((t12) => n12.has(t12.getKey())), o8 = 0 === l9, u11 = s8 === r10.length - 1;
            if (o8) i14.forEach((e9) => t11.insertBefore(e9));
            else if (u11) for (let e9 = i14.length - 1; e9 >= 0; e9--) t11.insertAfter(i14[e9]);
            else {
              for (let e10 = i14.length - 1; e10 >= 0; e10--) t11.insertAfter(i14[e10]);
              const e9 = r10.slice(s8 + 1);
              if (e9.length > 0) {
                const n13 = D5(t11.getURL(), { rel: t11.getRel(), target: t11.getTarget(), title: t11.getTitle() });
                i14[i14.length - 1].insertAfter(n13), e9.forEach((t12) => n13.append(t12));
              }
            }
          })(n11, h3), t10.add(e7);
        }
      });
    }
    const p7 = /* @__PURE__ */ new Set(), _5 = (t10) => {
      p7.has(t10.getKey()) || (p7.add(t10.getKey()), t10.setURL(r9), void 0 !== i13 && t10.setTarget(i13), void 0 !== s7 && t10.setRel(s7), void 0 !== l8 && t10.setTitle(l8));
    };
    if (1 === h3.length) {
      const t10 = h3[0], e6 = $findMatchingParent2(t10, w5);
      if (null !== e6) return _5(e6);
    }
    !(function(t10) {
      const e6 = $getSelection();
      if (!$isRangeSelection(e6)) return t10();
      const n11 = $normalizeSelection__EXPERIMENTAL(e6), r10 = n11.isBackward(), i14 = M4(n11.anchor, r10 ? -1 : 0), l9 = M4(n11.focus, r10 ? 0 : -1), s8 = t10();
      if (i14 || l9) {
        const t11 = $getSelection();
        if ($isRangeSelection(t11)) {
          const e7 = t11.clone();
          if (i14) {
            const t12 = i14.getParent();
            t12 && e7.anchor.set(t12.getKey(), i14.getIndexWithinParent() + (r10 ? 1 : 0), "element");
          }
          if (l9) {
            const t12 = l9.getParent();
            t12 && e7.focus.set(t12.getKey(), l9.getIndexWithinParent() + (r10 ? 0 : 1), "element");
          }
          $setSelection($normalizeSelection__EXPERIMENTAL(e7));
        }
      }
    })(() => {
      let t10 = null;
      for (const e6 of h3) {
        if (!e6.isAttached()) continue;
        const o8 = $findMatchingParent2(e6, w5);
        if (o8) {
          _5(o8);
          continue;
        }
        if ($isElementNode(e6)) {
          if (!e6.isInline()) continue;
          if (w5(e6)) {
            if (!(E6(e6) || null !== t10 && t10.getParentOrThrow().isParentOf(e6))) {
              _5(e6), t10 = e6;
              continue;
            }
            for (const t11 of e6.getChildren()) e6.insertBefore(t11);
            e6.remove();
            continue;
          }
        }
        const u11 = e6.getPreviousSibling();
        w5(u11) && u11.is(t10) ? u11.append(e6) : (t10 = D5(r9, { rel: s7, target: i13, title: l8 }), e6.insertAfter(t10), t10.append(e6));
      }
    });
  }
  var K5 = /^\+?[0-9\s()-]{5,}$/;
  function W6(t9) {
    return t9.match(/^[a-z][a-z0-9+.-]*:/i) || t9.match(/^[/#.]/) ? t9 : t9.includes("@") ? `mailto:${t9}` : K5.test(t9) ? `tel:${t9}` : `https://${t9}`;
  }
  function F6(t9, e5) {
    return mergeRegister(effect(() => t9.registerCommand(P4, (t10) => {
      const n11 = e5.validateUrl.peek(), r9 = e5.attributes.peek();
      if (null === t10) return J7(null), true;
      if ("string" == typeof t10) return !(void 0 !== n11 && !n11(t10)) && (J7(t10, r9), true);
      {
        const { url: e6, target: n12, rel: i13, title: l8 } = t10;
        return J7(e6, { ...r9, rel: i13, target: n12, title: l8 }), true;
      }
    }, COMMAND_PRIORITY_LOW)), effect(() => {
      const n11 = e5.validateUrl.value;
      if (!n11) return;
      const r9 = e5.attributes.value;
      return t9.registerCommand(PASTE_COMMAND, (e6) => {
        const l8 = $getSelection();
        if (!$isRangeSelection(l8) || l8.isCollapsed() || !objectKlassEquals(e6, ClipboardEvent)) return false;
        if (null === e6.clipboardData) return false;
        const s7 = e6.clipboardData.getData("text");
        return !!n11(s7) && (!l8.getNodes().some((t10) => $isElementNode(t10)) && (t9.dispatchCommand(P4, { ...r9, url: s7 }), e6.preventDefault(), true));
      }, COMMAND_PRIORITY_LOW);
    }));
  }
  var B6 = defineExtension({ build: (t9, e5, n11) => namedSignals(e5), config: { attributes: void 0, validateUrl: void 0 }, mergeConfig(t9, e5) {
    const n11 = shallowMergeConfig(t9, e5);
    return t9.attributes && (n11.attributes = shallowMergeConfig(t9.attributes, n11.attributes)), n11;
  }, name: "@lexical/link/Link", nodes: () => [y4], register: (t9, e5, n11) => F6(t9, n11.getOutput()) });
  function z5(t9, r9, i13 = {}) {
    const l8 = (i14) => {
      const l9 = i14.target;
      if (!isDOMNode(l9)) return;
      const s8 = getNearestEditorFromDOMNode(l9);
      if (null === s8) return;
      let u10 = null, g5 = null;
      if (s8.update(() => {
        const t10 = $getNearestNodeFromDOMNode(l9);
        if (null !== t10) {
          const i15 = $findMatchingParent2(t10, $isElementNode);
          if (!r9.disabled.peek()) if (w5(i15)) u10 = i15.sanitizeUrl(i15.getURL()), g5 = i15.getTarget();
          else {
            const t11 = (function(t12, e5) {
              let n11 = t12;
              for (; null != n11; ) {
                if (e5(n11)) return n11;
                n11 = n11.parentNode;
              }
              return null;
            })(l9, isHTMLAnchorElement2);
            null !== t11 && (u10 = t11.href, g5 = t11.target);
          }
        }
      }), null === u10 || "" === u10) return;
      const f8 = t9.getEditorState().read($getSelection);
      if ($isRangeSelection(f8) && !f8.isCollapsed()) return void i14.preventDefault();
      const d8 = "auxclick" === i14.type && 1 === i14.button;
      window.open(u10, r9.newTab.peek() || d8 || i14.metaKey || i14.ctrlKey || "_blank" === g5 ? "_blank" : "_self"), i14.preventDefault();
    }, s7 = (t10) => {
      1 === t10.button && l8(t10);
    };
    return t9.registerRootListener((t10, e5) => {
      null !== e5 && (e5.removeEventListener("click", l8), e5.removeEventListener("mouseup", s7)), null !== t10 && (t10.addEventListener("click", l8, i13), t10.addEventListener("mouseup", s7, i13));
    });
  }
  var $5 = defineExtension({ build: (t9, e5, n11) => namedSignals(e5), config: safeCast({ disabled: false, newTab: false }), dependencies: [B6], name: "@lexical/link/ClickableLink", register: (t9, e5, n11) => z5(t9, n11.getOutput()) });
  function H7(t9, e5 = (t10) => t10) {
    return (n11) => {
      const r9 = t9.exec(n11);
      return null === r9 ? null : { index: r9.index, length: r9[0].length, text: r9[0], url: e5(r9[0]) };
    };
  }
  function j5(t9, e5) {
    for (let n11 = 0; n11 < e5.length; n11++) {
      const r9 = e5[n11](t9);
      if (r9) return r9;
    }
    return null;
  }
  var G6 = /[.,;\s]/;
  function Z6(t9) {
    return G6.test(t9);
  }
  function q6(t9) {
    return Z6(t9[t9.length - 1]);
  }
  function Q6(t9) {
    return Z6(t9[0]);
  }
  function V6(t9) {
    let e5 = t9.getPreviousSibling();
    return $isElementNode(e5) && (e5 = e5.getLastDescendant()), null === e5 || $isLineBreakNode(e5) || $isTextNode(e5) && q6(e5.getTextContent());
  }
  function X6(t9) {
    let e5 = t9.getNextSibling();
    return $isElementNode(e5) && (e5 = e5.getFirstDescendant()), null === e5 || $isLineBreakNode(e5) || $isTextNode(e5) && Q6(e5.getTextContent());
  }
  function Y6(t9, e5, n11, r9) {
    if (!(t9 > 0 ? Z6(n11[t9 - 1]) : V6(r9[0]))) return false;
    return e5 < n11.length ? Z6(n11[e5]) : X6(r9[r9.length - 1]);
  }
  function tt5(t9, e5, n11) {
    const r9 = [], i13 = [], l8 = [];
    let s7 = 0, o8 = 0;
    const u10 = [...t9];
    for (; u10.length > 0; ) {
      const t10 = u10[0], a10 = t10.getTextContent().length, c10 = o8;
      o8 + a10 <= e5 ? (r9.push(t10), s7 += a10) : c10 >= n11 ? l8.push(t10) : i13.push(t10), o8 += a10, u10.shift();
    }
    return [s7, r9, i13, l8];
  }
  function et5(t9, e5, n11, r9) {
    const i13 = I4(r9.url, r9.attributes);
    if (1 === t9.length) {
      let l8, s7 = t9[0];
      0 === e5 ? [l8, s7] = s7.splitText(n11) : [, l8, s7] = s7.splitText(e5, n11);
      const o8 = $createTextNode(r9.text);
      return o8.setFormat(l8.getFormat()), o8.setDetail(l8.getDetail()), o8.setStyle(l8.getStyle()), i13.append(o8), l8.replace(i13), s7;
    }
    if (t9.length > 1) {
      const r10 = t9[0];
      let l8, s7 = r10.getTextContent().length;
      0 === e5 ? l8 = r10 : [, l8] = r10.splitText(e5);
      const u10 = [];
      let a10;
      for (let e6 = 1; e6 < t9.length; e6++) {
        const r11 = t9[e6], i14 = r11.getTextContent().length, l9 = s7;
        if (l9 < n11) if (s7 + i14 <= n11) u10.push(r11);
        else {
          const [t10, e7] = r11.splitText(n11 - l9);
          u10.push(t10), a10 = e7;
        }
        s7 += i14;
      }
      const f8 = $getSelection(), d8 = f8 ? f8.getNodes().find($isTextNode) : void 0, h3 = $createTextNode(l8.getTextContent());
      return h3.setFormat(l8.getFormat()), h3.setDetail(l8.getDetail()), h3.setStyle(l8.getStyle()), i13.append(h3, ...u10), d8 && d8 === l8 && ($isRangeSelection(f8) ? h3.select(f8.anchor.offset, f8.focus.offset) : $isNodeSelection(f8) && h3.select(0, h3.getTextContent().length)), l8.replace(i13), a10;
    }
  }
  function nt5(t9, e5, n11) {
    const r9 = t9.getChildren(), i13 = r9.length;
    for (let e6 = 0; e6 < i13; e6++) {
      const i14 = r9[e6];
      if (!$isTextNode(i14) || !i14.isSimpleText()) return rt5(t9), void n11(null, t9.getURL());
    }
    const l8 = t9.getTextContent(), s7 = j5(l8, e5);
    if (null === s7 || s7.text !== l8) return rt5(t9), void n11(null, t9.getURL());
    if (!V6(t9) || !X6(t9)) return rt5(t9), void n11(null, t9.getURL());
    const o8 = t9.getURL();
    if (o8 !== s7.url && (t9.setURL(s7.url), n11(s7.url, o8)), s7.attributes) {
      const e6 = t9.getRel();
      e6 !== s7.attributes.rel && (t9.setRel(s7.attributes.rel || null), n11(s7.attributes.rel || null, e6));
      const r10 = t9.getTarget();
      r10 !== s7.attributes.target && (t9.setTarget(s7.attributes.target || null), n11(s7.attributes.target || null, r10));
    }
  }
  function rt5(t9) {
    const e5 = t9.getChildren();
    for (let n11 = e5.length - 1; n11 >= 0; n11--) t9.insertAfter(e5[n11]);
    return t9.remove(), e5.map((t10) => t10.getLatest());
  }
  var it5 = { changeHandlers: [], matchers: [] };
  function lt5(t9, e5 = it5) {
    const { matchers: n11, changeHandlers: i13 } = e5, l8 = (t10, e6) => {
      for (const n12 of i13) n12(t10, e6);
    };
    return mergeRegister(t9.registerNodeTransform(TextNode, (t10) => {
      const e6 = t10.getParentOrThrow(), r9 = t10.getPreviousSibling();
      if (E6(e6) && !e6.getIsUnlinked()) nt5(e6, n11, l8);
      else if (!w5(e6)) {
        if (t10.isSimpleText() && (Q6(t10.getTextContent()) || !E6(r9))) {
          const e7 = (function(t11) {
            const e8 = [t11];
            let n12 = t11.getNextSibling();
            for (; null !== n12 && $isTextNode(n12) && n12.isSimpleText() && (e8.push(n12), !/[\s]/.test(n12.getTextContent())); ) n12 = n12.getNextSibling();
            return e8;
          })(t10);
          !(function(t11, e8, n12) {
            let r10 = [...t11];
            const i14 = r10.map((t12) => t12.getTextContent()).join("");
            let l9, s7 = i14, o8 = 0;
            for (; (l9 = j5(s7, e8)) && null !== l9; ) {
              const t12 = l9.index, e9 = t12 + l9.length;
              if (Y6(o8 + t12, o8 + e9, i14, r10)) {
                const [i15, , s8, u10] = tt5(r10, o8 + t12, o8 + e9), a10 = et5(s8, o8 + t12 - i15, o8 + e9 - i15, l9);
                r10 = a10 ? [a10, ...u10] : u10, n12(l9.url, null), o8 = 0;
              } else o8 += e9;
              s7 = s7.substring(e9);
            }
          })(e7, n11, l8);
        }
        !(function(t11, e7, n12) {
          const r10 = t11.getPreviousSibling(), i14 = t11.getNextSibling(), l9 = t11.getTextContent();
          var s7;
          !E6(r10) || r10.getIsUnlinked() || Q6(l9) && (s7 = l9, !(r10.isEmailURI() ? /^\.[a-zA-Z]{2,}/.test(s7) : /^\.[a-zA-Z0-9]{1,}/.test(s7))) || (r10.append(t11), nt5(r10, e7, n12), n12(null, r10.getURL())), !E6(i14) || i14.getIsUnlinked() || q6(l9) || (rt5(i14), nt5(i14, e7, n12), n12(null, i14.getURL()));
        })(t10, n11, l8);
      }
    }), t9.registerCommand(P4, (t10) => {
      const e6 = $getSelection();
      if (null !== t10 || !$isRangeSelection(e6)) return false;
      return e6.extract().forEach((t11) => {
        const e7 = t11.getParent();
        E6(e7) && (e7.setIsUnlinked(!e7.getIsUnlinked()), e7.markDirty());
      }), false;
    }, COMMAND_PRIORITY_LOW));
  }
  var st5 = defineExtension({ config: it5, dependencies: [B6], mergeConfig(t9, e5) {
    const n11 = shallowMergeConfig(t9, e5);
    for (const r9 of ["matchers", "changeHandlers"]) {
      const i13 = e5[r9];
      Array.isArray(i13) && (n11[r9] = [...t9[r9], ...i13]);
    }
    return n11;
  }, name: "@lexical/link/AutoLink", register: lt5 });
  var ot5 = J7;

  // node_modules/@lexical/link/LexicalLink.mjs
  var mod22 = false ? LexicalLink_dev_exports : LexicalLink_prod_exports;
  var $createAutoLinkNode = mod22.$createAutoLinkNode;
  var $createLinkNode = mod22.$createLinkNode;
  var $isAutoLinkNode = mod22.$isAutoLinkNode;
  var $isLinkNode = mod22.$isLinkNode;
  var $toggleLink = mod22.$toggleLink;
  var AutoLinkExtension = mod22.AutoLinkExtension;
  var AutoLinkNode = mod22.AutoLinkNode;
  var ClickableLinkExtension = mod22.ClickableLinkExtension;
  var LinkExtension = mod22.LinkExtension;
  var LinkNode = mod22.LinkNode;
  var TOGGLE_LINK_COMMAND = mod22.TOGGLE_LINK_COMMAND;
  var createLinkMatcherWithRegExp = mod22.createLinkMatcherWithRegExp;
  var formatUrl = mod22.formatUrl;
  var registerAutoLink = mod22.registerAutoLink;
  var registerClickableLink = mod22.registerClickableLink;
  var registerLink = mod22.registerLink;
  var toggleLink = mod22.toggleLink;

  // node_modules/@lexical/react/LexicalLinkPlugin.prod.mjs
  var LexicalLinkPlugin_prod_exports = {};
  __export(LexicalLinkPlugin_prod_exports, {
    LinkPlugin: () => l4
  });
  var import_react10 = __toESM(require_react(), 1);
  function l4({ validateUrl: l8, attributes: n11 }) {
    const [a10] = useLexicalComposerContext();
    return (0, import_react10.useEffect)(() => {
      if (!a10.hasNodes([LinkNode])) throw new Error("LinkPlugin: LinkNode not registered on editor");
    }), (0, import_react10.useEffect)(() => registerLink(a10, namedSignals({ attributes: n11, validateUrl: l8 })), [a10, l8, n11]), null;
  }

  // node_modules/@lexical/react/LexicalLinkPlugin.mjs
  var mod23 = false ? LexicalLinkPlugin_dev_exports : LexicalLinkPlugin_prod_exports;
  var LinkPlugin = mod23.LinkPlugin;

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
    $deleteTableColumn: () => ot6,
    $deleteTableColumnAtSelection: () => st6,
    $deleteTableColumn__EXPERIMENTAL: () => it6,
    $deleteTableRowAtSelection: () => rt6,
    $deleteTableRow__EXPERIMENTAL: () => lt6,
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
    $insertTableColumnAtSelection: () => et6,
    $insertTableColumn__EXPERIMENTAL: () => tt6,
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
  init_Lexical();
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
    static clone(e5) {
      return new _Te(e5.__headerState, e5.__colSpan, e5.__width, e5.__key);
    }
    afterCloneFrom(e5) {
      super.afterCloneFrom(e5), this.__rowSpan = e5.__rowSpan, this.__backgroundColor = e5.__backgroundColor, this.__verticalAlign = e5.__verticalAlign;
    }
    static importDOM() {
      return { td: (e5) => ({ conversion: Fe2, priority: 0 }), th: (e5) => ({ conversion: Fe2, priority: 0 }) };
    }
    static importJSON(e5) {
      return Oe2().updateFromJSON(e5);
    }
    updateFromJSON(e5) {
      return super.updateFromJSON(e5).setHeaderStyles(e5.headerState).setColSpan(e5.colSpan || 1).setRowSpan(e5.rowSpan || 1).setWidth(e5.width || void 0).setBackgroundColor(e5.backgroundColor || null).setVerticalAlign(e5.verticalAlign || void 0);
    }
    constructor(e5 = xe2.NO_STATUS, t9 = 1, n11, o8) {
      super(o8), this.__colSpan = t9, this.__rowSpan = 1, this.__headerState = e5, this.__width = n11, this.__backgroundColor = null, this.__verticalAlign = void 0;
    }
    createDOM(t9) {
      const n11 = document.createElement(this.getTag());
      return this.__width && (n11.style.width = `${this.__width}px`), this.__colSpan > 1 && (n11.colSpan = this.__colSpan), this.__rowSpan > 1 && (n11.rowSpan = this.__rowSpan), null !== this.__backgroundColor && (n11.style.backgroundColor = this.__backgroundColor), Re2(this.__verticalAlign) && (n11.style.verticalAlign = this.__verticalAlign), addClassNamesToElement(n11, t9.theme.tableCell, this.hasHeader() && t9.theme.tableCellHeader), n11;
    }
    exportDOM(e5) {
      const t9 = super.exportDOM(e5);
      if (isHTMLElement(t9.element)) {
        const e6 = t9.element;
        e6.setAttribute("data-temporary-table-cell-lexical-key", this.getKey()), e6.style.border = "1px solid black", this.__colSpan > 1 && (e6.colSpan = this.__colSpan), this.__rowSpan > 1 && (e6.rowSpan = this.__rowSpan), e6.style.width = `${this.getWidth() || 75}px`, e6.style.verticalAlign = this.getVerticalAlign() || "top", e6.style.textAlign = "start", null === this.__backgroundColor && this.hasHeader() && (e6.style.backgroundColor = "#f2f3f5");
      }
      return t9;
    }
    exportJSON() {
      return { ...super.exportJSON(), ...Re2(this.__verticalAlign) && { verticalAlign: this.__verticalAlign }, backgroundColor: this.getBackgroundColor(), colSpan: this.__colSpan, headerState: this.__headerState, rowSpan: this.__rowSpan, width: this.getWidth() };
    }
    getColSpan() {
      return this.getLatest().__colSpan;
    }
    setColSpan(e5) {
      const t9 = this.getWritable();
      return t9.__colSpan = e5, t9;
    }
    getRowSpan() {
      return this.getLatest().__rowSpan;
    }
    setRowSpan(e5) {
      const t9 = this.getWritable();
      return t9.__rowSpan = e5, t9;
    }
    getTag() {
      return this.hasHeader() ? "th" : "td";
    }
    setHeaderStyles(e5, t9 = xe2.BOTH) {
      const n11 = this.getWritable();
      return n11.__headerState = e5 & t9 | n11.__headerState & ~t9, n11;
    }
    getHeaderStyles() {
      return this.getLatest().__headerState;
    }
    setWidth(e5) {
      const t9 = this.getWritable();
      return t9.__width = e5, t9;
    }
    getWidth() {
      return this.getLatest().__width;
    }
    getBackgroundColor() {
      return this.getLatest().__backgroundColor;
    }
    setBackgroundColor(e5) {
      const t9 = this.getWritable();
      return t9.__backgroundColor = e5, t9;
    }
    getVerticalAlign() {
      return this.getLatest().__verticalAlign;
    }
    setVerticalAlign(e5) {
      const t9 = this.getWritable();
      return t9.__verticalAlign = e5 || void 0, t9;
    }
    toggleHeaderStyle(e5) {
      const t9 = this.getWritable();
      return (t9.__headerState & e5) === e5 ? t9.__headerState -= e5 : t9.__headerState += e5, t9;
    }
    hasHeaderState(e5) {
      return (this.getHeaderStyles() & e5) === e5;
    }
    hasHeader() {
      return this.getLatest().__headerState !== xe2.NO_STATUS;
    }
    updateDOM(e5) {
      return e5.__headerState !== this.__headerState || e5.__width !== this.__width || e5.__colSpan !== this.__colSpan || e5.__rowSpan !== this.__rowSpan || e5.__backgroundColor !== this.__backgroundColor || e5.__verticalAlign !== this.__verticalAlign;
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
  function Re2(e5) {
    return "middle" === e5 || "bottom" === e5;
  }
  function Fe2(e5) {
    const t9 = e5, n11 = e5.nodeName.toLowerCase();
    let o8;
    ve2.test(t9.style.width) && (o8 = parseFloat(t9.style.width));
    const r9 = Oe2("th" === n11 ? xe2.ROW : xe2.NO_STATUS, t9.colSpan, o8);
    r9.__rowSpan = t9.rowSpan;
    const l8 = t9.style.backgroundColor;
    "" !== l8 && (r9.__backgroundColor = l8);
    const s7 = t9.style.verticalAlign;
    Re2(s7) && (r9.__verticalAlign = s7);
    const i13 = t9.style, c10 = (i13 && i13.textDecoration || "").split(" "), a10 = "700" === i13.fontWeight || "bold" === i13.fontWeight, u10 = c10.includes("line-through"), h3 = "italic" === i13.fontStyle, p7 = c10.includes("underline");
    return { after: (e6) => {
      const t10 = [];
      let n12 = null;
      const o9 = () => {
        if (n12) {
          const e7 = n12.getFirstChild();
          $isLineBreakNode(e7) && 1 === n12.getChildrenSize() && e7.remove();
        }
      };
      for (const r10 of e6) $isInlineElementOrDecoratorNode(r10) || $isTextNode(r10) || $isLineBreakNode(r10) ? ($isTextNode(r10) && (a10 && r10.toggleFormat("bold"), u10 && r10.toggleFormat("strikethrough"), h3 && r10.toggleFormat("italic"), p7 && r10.toggleFormat("underline")), n12 ? n12.append(r10) : (n12 = $createParagraphNode().append(r10), t10.push(n12))) : (t10.push(r10), o9(), n12 = null);
      return o9(), 0 === t10.length && t10.push($createParagraphNode()), t10;
    }, node: r9 };
  }
  function Oe2(e5 = xe2.NO_STATUS, t9 = 1, n11) {
    return $applyNodeReplacement(new Te2(e5, t9, n11));
  }
  function Ae2(e5) {
    return e5 instanceof Te2;
  }
  var Ke2 = createCommand("INSERT_TABLE_COMMAND");
  function ke2(e5, ...t9) {
    const n11 = new URL("https://lexical.dev/docs/error"), o8 = new URLSearchParams();
    o8.append("code", e5);
    for (const e6 of t9) o8.append("v", e6);
    throw n11.search = o8.toString(), Error(`Minified Lexical error #${e5}; visit ${n11.toString()} for the full message or use the non-minified dev environment for full errors and additional helpful warnings.`);
  }
  var Ee2 = class _Ee extends ElementNode {
    __height;
    static getType() {
      return "tablerow";
    }
    static clone(e5) {
      return new _Ee(e5.__height, e5.__key);
    }
    static importDOM() {
      return { tr: (e5) => ({ conversion: Me2, priority: 0 }) };
    }
    static importJSON(e5) {
      return $e2().updateFromJSON(e5);
    }
    updateFromJSON(e5) {
      return super.updateFromJSON(e5).setHeight(e5.height);
    }
    constructor(e5, t9) {
      super(t9), this.__height = e5;
    }
    exportJSON() {
      const e5 = this.getHeight();
      return { ...super.exportJSON(), ...void 0 === e5 ? void 0 : { height: e5 } };
    }
    createDOM(t9) {
      const n11 = document.createElement("tr");
      return this.__height && (n11.style.height = `${this.__height}px`), addClassNamesToElement(n11, t9.theme.tableRow), n11;
    }
    extractWithChild(e5, t9, n11) {
      return "html" === n11;
    }
    isShadowRoot() {
      return true;
    }
    setHeight(e5) {
      const t9 = this.getWritable();
      return t9.__height = e5, t9;
    }
    getHeight() {
      return this.getLatest().__height;
    }
    updateDOM(e5) {
      return e5.__height !== this.__height;
    }
    canBeEmpty() {
      return false;
    }
    canIndent() {
      return false;
    }
  };
  function Me2(e5) {
    const n11 = e5;
    let o8;
    return ve2.test(n11.style.height) && (o8 = parseFloat(n11.style.height)), { after: (e6) => $descendantsMatching(e6, Ae2), node: $e2(o8) };
  }
  function $e2(e5) {
    return $applyNodeReplacement(new Ee2(e5));
  }
  function We2(e5) {
    return e5 instanceof Ee2;
  }
  var ze2 = "undefined" != typeof window && void 0 !== window.document && void 0 !== window.document.createElement;
  var He2 = ze2 && "documentMode" in document ? document.documentMode : null;
  var Le2 = ze2 && /^(?!.*Seamonkey)(?=.*Firefox).*/i.test(navigator.userAgent);
  function Be2(e5, t9, n11 = true) {
    const o8 = mn2();
    for (let r9 = 0; r9 < e5; r9++) {
      const e6 = $e2();
      for (let o9 = 0; o9 < t9; o9++) {
        let t10 = xe2.NO_STATUS;
        "object" == typeof n11 ? (0 === r9 && n11.rows && (t10 |= xe2.ROW), 0 === o9 && n11.columns && (t10 |= xe2.COLUMN)) : n11 && (0 === r9 && (t10 |= xe2.ROW), 0 === o9 && (t10 |= xe2.COLUMN));
        const l8 = Oe2(t10), s7 = $createParagraphNode();
        s7.append($createTextNode()), l8.append(s7), e6.append(l8);
      }
      o8.append(e6);
    }
    return o8;
  }
  function Pe2(e5) {
    const t9 = $findMatchingParent2(e5, (e6) => Ae2(e6));
    return Ae2(t9) ? t9 : null;
  }
  function De2(e5) {
    const t9 = $findMatchingParent2(e5, (e6) => We2(e6));
    if (We2(t9)) return t9;
    throw new Error("Expected table cell to be inside of table row.");
  }
  function Ie2(e5) {
    const t9 = $findMatchingParent2(e5, (e6) => pn2(e6));
    if (pn2(t9)) return t9;
    throw new Error("Expected table cell to be inside of table.");
  }
  function Ue2(e5) {
    const t9 = De2(e5);
    return Ie2(t9).getChildren().findIndex((e6) => e6.is(t9));
  }
  function Je2(e5) {
    return De2(e5).getChildren().findIndex((t9) => t9.is(e5));
  }
  function Ye2(e5, t9) {
    const n11 = Ie2(e5), { x: o8, y: r9 } = n11.getCordsFromCellNode(e5, t9);
    return { above: n11.getCellNodeFromCords(o8, r9 - 1, t9), below: n11.getCellNodeFromCords(o8, r9 + 1, t9), left: n11.getCellNodeFromCords(o8 - 1, r9, t9), right: n11.getCellNodeFromCords(o8 + 1, r9, t9) };
  }
  function Xe2(e5, t9) {
    const n11 = e5.getChildren();
    if (t9 >= n11.length || t9 < 0) throw new Error("Expected table cell to be inside of table row.");
    return n11[t9].remove(), e5;
  }
  function qe2(e5, t9, n11 = true, o8, r9) {
    const l8 = e5.getChildren();
    if (t9 >= l8.length || t9 < 0) throw new Error("Table row target index out of range");
    const s7 = l8[t9];
    if (!We2(s7)) throw new Error("Row before insertion index does not exist.");
    for (let e6 = 0; e6 < o8; e6++) {
      const e7 = s7.getChildren(), t10 = e7.length, o9 = $e2();
      for (let n12 = 0; n12 < t10; n12++) {
        const t11 = e7[n12];
        Ae2(t11) || ke2(12);
        const { above: l9, below: s8 } = Ye2(t11, r9);
        let i13 = xe2.NO_STATUS;
        const c10 = l9 && l9.getWidth() || s8 && s8.getWidth() || void 0;
        (l9 && l9.hasHeaderState(xe2.COLUMN) || s8 && s8.hasHeaderState(xe2.COLUMN)) && (i13 |= xe2.COLUMN);
        const a10 = Oe2(i13, 1, c10);
        a10.append($createParagraphNode()), o9.append(a10);
      }
      n11 ? s7.insertAfter(o9) : s7.insertBefore(o9);
    }
    return e5;
  }
  ze2 && "InputEvent" in window && !He2 && new window.InputEvent("input");
  var je2 = (e5, t9) => e5 === xe2.BOTH || e5 === t9 ? t9 : xe2.NO_STATUS;
  function Ve2(e5 = true) {
    const t9 = $getSelection();
    $isRangeSelection(t9) || bt6(t9) || ke2(188);
    const n11 = t9.anchor.getNode(), o8 = t9.focus.getNode(), [r9] = pt6(n11), [l8, , s7] = pt6(o8), [, i13, c10] = gt6(s7, l8, r9), { startRow: a10 } = c10, { startRow: u10 } = i13;
    return e5 ? Qe2(a10 + r9.__rowSpan > u10 + l8.__rowSpan ? r9 : l8, true) : Qe2(u10 < a10 ? l8 : r9, false);
  }
  var Ge2 = Ve2;
  function Qe2(e5, t9 = true) {
    const [, , n11] = pt6(e5), [o8, r9] = gt6(n11, e5, e5), l8 = o8[0].length, { startRow: s7 } = r9;
    let i13 = null;
    if (t9) {
      const t10 = s7 + e5.__rowSpan - 1, r10 = o8[t10], c10 = $e2();
      for (let e6 = 0; e6 < l8; e6++) {
        const { cell: n12, startRow: o9 } = r10[e6];
        if (o9 + n12.__rowSpan - 1 <= t10) {
          const t11 = r10[e6].cell.__headerState, n13 = je2(t11, xe2.COLUMN);
          c10.append(Oe2(n13).append($createParagraphNode()));
        } else n12.setRowSpan(n12.__rowSpan + 1);
      }
      const a10 = n11.getChildAtIndex(t10);
      We2(a10) || ke2(256), a10.insertAfter(c10), i13 = c10;
    } else {
      const e6 = s7, t10 = o8[e6], r10 = $e2();
      for (let n12 = 0; n12 < l8; n12++) {
        const { cell: o9, startRow: l9 } = t10[n12];
        if (l9 === e6) {
          const e7 = t10[n12].cell.__headerState, o10 = je2(e7, xe2.COLUMN);
          r10.append(Oe2(o10).append($createParagraphNode()));
        } else o9.setRowSpan(o9.__rowSpan + 1);
      }
      const c10 = n11.getChildAtIndex(e6);
      We2(c10) || ke2(257), c10.insertBefore(r10), i13 = r10;
    }
    return i13;
  }
  function Ze2(e5, t9, n11 = true, o8, r9) {
    const l8 = e5.getChildren(), s7 = [];
    for (let e6 = 0; e6 < l8.length; e6++) {
      const n12 = l8[e6];
      if (We2(n12)) for (let e7 = 0; e7 < o8; e7++) {
        const e8 = n12.getChildren();
        if (t9 >= e8.length || t9 < 0) throw new Error("Table column target index out of range");
        const o9 = e8[t9];
        Ae2(o9) || ke2(12);
        const { left: l9, right: i13 } = Ye2(o9, r9);
        let c10 = xe2.NO_STATUS;
        (l9 && l9.hasHeaderState(xe2.ROW) || i13 && i13.hasHeaderState(xe2.ROW)) && (c10 |= xe2.ROW);
        const a10 = Oe2(c10);
        a10.append($createParagraphNode()), s7.push({ newTableCell: a10, targetCell: o9 });
      }
    }
    return s7.forEach(({ newTableCell: e6, targetCell: t10 }) => {
      n11 ? t10.insertAfter(e6) : t10.insertBefore(e6);
    }), e5;
  }
  function et6(e5 = true) {
    const t9 = $getSelection();
    $isRangeSelection(t9) || bt6(t9) || ke2(188);
    const n11 = t9.anchor.getNode(), o8 = t9.focus.getNode(), [r9] = pt6(n11), [l8, , s7] = pt6(o8), [, i13, c10] = gt6(s7, l8, r9), { startColumn: a10 } = c10, { startColumn: u10 } = i13;
    return e5 ? nt6(a10 + r9.__colSpan > u10 + l8.__colSpan ? r9 : l8, true) : nt6(u10 < a10 ? l8 : r9, false);
  }
  var tt6 = et6;
  function nt6(e5, t9 = true, n11 = true) {
    const [, , o8] = pt6(e5), [r9, l8] = gt6(o8, e5, e5), s7 = r9.length, { startColumn: i13 } = l8, c10 = t9 ? i13 + e5.__colSpan - 1 : i13 - 1, a10 = o8.getFirstChild();
    We2(a10) || ke2(120);
    let u10 = null;
    function h3(e6 = xe2.NO_STATUS) {
      const t10 = Oe2(e6).append($createParagraphNode());
      return null === u10 && (u10 = t10), t10;
    }
    let d8 = a10;
    e: for (let e6 = 0; e6 < s7; e6++) {
      if (0 !== e6) {
        const e7 = d8.getNextSibling();
        We2(e7) || ke2(121), d8 = e7;
      }
      const t10 = r9[e6], n12 = t10[c10 < 0 ? 0 : c10].cell.__headerState, o9 = je2(n12, xe2.ROW);
      if (c10 < 0) {
        at5(d8, h3(o9));
        continue;
      }
      const { cell: l9, startColumn: s8, startRow: i14 } = t10[c10];
      if (s8 + l9.__colSpan - 1 <= c10) {
        let n13 = l9, r10 = i14, s9 = c10;
        for (; r10 !== e6 && n13.__rowSpan > 1; ) {
          if (s9 -= l9.__colSpan, !(s9 >= 0)) {
            d8.append(h3(o9));
            continue e;
          }
          {
            const { cell: e7, startRow: o10 } = t10[s9];
            n13 = e7, r10 = o10;
          }
        }
        n13.insertAfter(h3(o9));
      } else l9.setColSpan(l9.__colSpan + 1);
    }
    null !== u10 && n11 && ct5(u10);
    const f8 = o8.getColWidths();
    if (f8) {
      const e6 = [...f8], t10 = c10 < 0 ? 0 : c10, n12 = e6[t10];
      e6.splice(t10, 0, n12), o8.setColWidths(e6);
    }
    return u10;
  }
  function ot6(e5, t9) {
    const n11 = e5.getChildren();
    for (let e6 = 0; e6 < n11.length; e6++) {
      const o8 = n11[e6];
      if (We2(o8)) {
        const e7 = o8.getChildren();
        if (t9 >= e7.length || t9 < 0) throw new Error("Table column target index out of range");
        e7[t9].remove();
      }
    }
    return e5;
  }
  function rt6() {
    const e5 = $getSelection();
    $isRangeSelection(e5) || bt6(e5) || ke2(188);
    const [t9, n11] = e5.isBackward() ? [e5.focus.getNode(), e5.anchor.getNode()] : [e5.anchor.getNode(), e5.focus.getNode()], [o8, , r9] = pt6(t9), [l8] = pt6(n11), [s7, i13, c10] = gt6(r9, o8, l8), { startRow: a10 } = i13, { startRow: u10 } = c10, h3 = u10 + l8.__rowSpan - 1;
    if (s7.length === h3 - a10 + 1) return void r9.remove();
    const d8 = s7[0].length, f8 = s7[h3 + 1], g5 = r9.getChildAtIndex(h3 + 1);
    for (let e6 = h3; e6 >= a10; e6--) {
      for (let t11 = d8 - 1; t11 >= 0; t11--) {
        const { cell: n12, startRow: o9, startColumn: r10 } = s7[e6][t11];
        if (r10 === t11) {
          if (o9 < a10 || o9 + n12.__rowSpan - 1 > h3) {
            const e7 = Math.max(o9, a10), t12 = Math.min(n12.__rowSpan + o9 - 1, h3), r11 = e7 <= t12 ? t12 - e7 + 1 : 0;
            n12.setRowSpan(n12.__rowSpan - r11);
          }
          if (o9 >= a10 && o9 + n12.__rowSpan - 1 > h3 && e6 === h3) {
            null === g5 && ke2(122);
            let o10 = null;
            for (let n13 = 0; n13 < t11; n13++) {
              const t12 = f8[n13], r11 = t12.cell;
              t12.startRow === e6 + 1 && (o10 = r11), r11.__colSpan > 1 && (n13 += r11.__colSpan - 1);
            }
            null === o10 ? at5(g5, n12) : o10.insertAfter(n12);
          }
        }
      }
      const t10 = r9.getChildAtIndex(e6);
      We2(t10) || ke2(206, String(e6)), t10.remove();
    }
    if (void 0 !== f8) {
      const { cell: e6 } = f8[0];
      ct5(e6);
    } else {
      const e6 = s7[a10 - 1], { cell: t10 } = e6[0];
      ct5(t10);
    }
  }
  var lt6 = rt6;
  function st6() {
    const e5 = $getSelection();
    $isRangeSelection(e5) || bt6(e5) || ke2(188);
    const t9 = e5.anchor.getNode(), n11 = e5.focus.getNode(), [o8, , r9] = pt6(t9), [l8] = pt6(n11), [s7, i13, c10] = gt6(r9, o8, l8), { startColumn: a10 } = i13, { startRow: u10, startColumn: h3 } = c10, d8 = Math.min(a10, h3), f8 = Math.max(a10 + o8.__colSpan - 1, h3 + l8.__colSpan - 1), g5 = f8 - d8 + 1;
    if (s7[0].length === f8 - d8 + 1) return r9.selectPrevious(), void r9.remove();
    const m9 = s7.length;
    for (let e6 = 0; e6 < m9; e6++) for (let t10 = d8; t10 <= f8; t10++) {
      const { cell: n12, startColumn: o9 } = s7[e6][t10];
      if (o9 < d8) {
        if (t10 === d8) {
          const e7 = d8 - o9;
          n12.setColSpan(n12.__colSpan - Math.min(g5, n12.__colSpan - e7));
        }
      } else if (o9 + n12.__colSpan - 1 > f8) {
        if (t10 === f8) {
          const e7 = f8 - o9 + 1;
          n12.setColSpan(n12.__colSpan - e7);
        }
      } else n12.remove();
    }
    const p7 = s7[u10], C5 = a10 > h3 ? p7[a10 + o8.__colSpan] : p7[h3 + l8.__colSpan];
    if (void 0 !== C5) {
      const { cell: e6 } = C5;
      ct5(e6);
    } else {
      const e6 = h3 < a10 ? p7[h3 - 1] : p7[a10 - 1], { cell: t10 } = e6;
      ct5(t10);
    }
    const _5 = r9.getColWidths();
    if (_5) {
      const e6 = [..._5];
      e6.splice(d8, g5), r9.setColWidths(e6);
    }
  }
  var it6 = st6;
  function ct5(e5) {
    const t9 = e5.getFirstDescendant();
    null == t9 ? e5.selectStart() : t9.getParentOrThrow().selectStart();
  }
  function at5(e5, t9) {
    const n11 = e5.getFirstChild();
    null !== n11 ? n11.insertBefore(t9) : e5.append(t9);
  }
  function ut5(e5) {
    if (0 === e5.length) return null;
    const t9 = Ie2(e5[0]), [n11] = mt5(t9, null, null);
    let o8 = 1 / 0, r9 = -1 / 0, l8 = 1 / 0, s7 = -1 / 0;
    const i13 = /* @__PURE__ */ new Set();
    for (const t10 of n11) for (const n12 of t10) {
      if (!n12 || !n12.cell) continue;
      const t11 = n12.cell.getKey();
      if (!i13.has(t11) && e5.some((e6) => e6.is(n12.cell))) {
        i13.add(t11);
        const e6 = n12.startRow, c11 = n12.startColumn, a11 = n12.cell.__rowSpan || 1, u11 = n12.cell.__colSpan || 1;
        o8 = Math.min(o8, e6), r9 = Math.max(r9, e6 + a11 - 1), l8 = Math.min(l8, c11), s7 = Math.max(s7, c11 + u11 - 1);
      }
    }
    if (o8 === 1 / 0 || l8 === 1 / 0) return null;
    const c10 = r9 - o8 + 1, a10 = s7 - l8 + 1, u10 = n11[o8][l8];
    if (!u10.cell) return null;
    const h3 = u10.cell;
    h3.setColSpan(a10), h3.setRowSpan(c10);
    const d8 = /* @__PURE__ */ new Set([h3.getKey()]);
    for (let e6 = o8; e6 <= r9; e6++) for (let t10 = l8; t10 <= s7; t10++) {
      const o9 = n11[e6][t10];
      if (!o9.cell) continue;
      const r10 = o9.cell, l9 = r10.getKey();
      if (!d8.has(l9)) {
        d8.add(l9);
        ht6(r10) || h3.append(...r10.getChildren()), r10.remove();
      }
    }
    return 0 === h3.getChildrenSize() && h3.append($createParagraphNode()), h3;
  }
  function ht6(e5) {
    if (1 !== e5.getChildrenSize()) return false;
    const t9 = e5.getFirstChildOrThrow();
    return !(!$isParagraphNode(t9) || !t9.isEmpty());
  }
  function dt5() {
    const e5 = $getSelection();
    $isRangeSelection(e5) || bt6(e5) || ke2(188);
    const t9 = e5.anchor.getNode(), o8 = $findMatchingParent2(t9, Ae2);
    return Ae2(o8) || ke2(148), ft5(o8);
  }
  function ft5(e5) {
    const [t9, n11, o8] = pt6(e5), r9 = t9.__colSpan, l8 = t9.__rowSpan;
    if (1 === r9 && 1 === l8) return;
    const [s7, i13] = gt6(o8, t9, t9), { startColumn: c10, startRow: a10 } = i13, u10 = t9.__headerState & xe2.COLUMN, h3 = Array.from({ length: r9 }, (e6, t10) => {
      let n12 = u10;
      for (let e7 = 0; 0 !== n12 && e7 < s7.length; e7++) n12 &= s7[e7][t10 + c10].cell.__headerState;
      return n12;
    }), d8 = t9.__headerState & xe2.ROW, f8 = Array.from({ length: l8 }, (e6, t10) => {
      let n12 = d8;
      for (let e7 = 0; 0 !== n12 && e7 < s7[0].length; e7++) n12 &= s7[t10 + a10][e7].cell.__headerState;
      return n12;
    });
    if (r9 > 1) {
      for (let e6 = 1; e6 < r9; e6++) t9.insertAfter(Oe2(h3[e6] | f8[0]).append($createParagraphNode()));
      t9.setColSpan(1);
    }
    if (l8 > 1) {
      let e6;
      for (let t10 = 1; t10 < l8; t10++) {
        const o9 = a10 + t10, l9 = s7[o9];
        e6 = (e6 || n11).getNextSibling(), We2(e6) || ke2(125);
        let i14 = null;
        for (let e7 = 0; e7 < c10; e7++) {
          const t11 = l9[e7], n12 = t11.cell;
          t11.startRow === o9 && (i14 = n12), n12.__colSpan > 1 && (e7 += n12.__colSpan - 1);
        }
        if (null === i14) for (let n12 = r9 - 1; n12 >= 0; n12--) at5(e6, Oe2(h3[n12] | f8[t10]).append($createParagraphNode()));
        else for (let e7 = r9 - 1; e7 >= 0; e7--) i14.insertAfter(Oe2(h3[e7] | f8[t10]).append($createParagraphNode()));
      }
      t9.setRowSpan(1);
    }
  }
  function gt6(e5, t9, n11) {
    const [o8, r9, l8] = mt5(e5, t9, n11);
    return null === r9 && ke2(207), null === l8 && ke2(208), [o8, r9, l8];
  }
  function mt5(e5, t9, n11) {
    const o8 = [];
    let r9 = null, l8 = null;
    function s7(e6) {
      let t10 = o8[e6];
      return void 0 === t10 && (o8[e6] = t10 = []), t10;
    }
    const i13 = e5.getChildren();
    for (let e6 = 0; e6 < i13.length; e6++) {
      const o9 = i13[e6];
      We2(o9) || ke2(209);
      const c10 = s7(e6);
      for (let a10 = o9.getFirstChild(), u10 = 0; null != a10; a10 = a10.getNextSibling()) {
        for (Ae2(a10) || ke2(147); void 0 !== c10[u10]; ) u10++;
        const o10 = { cell: a10, startColumn: u10, startRow: e6 }, { __rowSpan: h3, __colSpan: d8 } = a10;
        for (let t10 = 0; t10 < h3 && !(e6 + t10 >= i13.length); t10++) {
          const n12 = s7(e6 + t10);
          for (let e7 = 0; e7 < d8; e7++) n12[u10 + e7] = o10;
        }
        null !== t9 && null === r9 && t9.is(a10) && (r9 = o10), null !== n11 && null === l8 && n11.is(a10) && (l8 = o10);
      }
    }
    return [o8, r9, l8];
  }
  function pt6(e5) {
    let t9;
    if (e5 instanceof Te2) t9 = e5;
    else if ("__type" in e5) {
      const o9 = $findMatchingParent2(e5, Ae2);
      Ae2(o9) || ke2(148), t9 = o9;
    } else {
      const o9 = $findMatchingParent2(e5.getNode(), Ae2);
      Ae2(o9) || ke2(148), t9 = o9;
    }
    const o8 = t9.getParent();
    We2(o8) || ke2(149);
    const r9 = o8.getParent();
    return pn2(r9) || ke2(210), [t9, o8, r9];
  }
  function Ct6(e5, t9, n11) {
    let o8, r9 = Math.min(t9.startColumn, n11.startColumn), l8 = Math.min(t9.startRow, n11.startRow), s7 = Math.max(t9.startColumn + t9.cell.__colSpan - 1, n11.startColumn + n11.cell.__colSpan - 1), i13 = Math.max(t9.startRow + t9.cell.__rowSpan - 1, n11.startRow + n11.cell.__rowSpan - 1);
    do {
      o8 = false;
      for (let t10 = 0; t10 < e5.length; t10++) for (let n12 = 0; n12 < e5[0].length; n12++) {
        const c10 = e5[t10][n12];
        if (!c10) continue;
        const a10 = c10.startColumn + c10.cell.__colSpan - 1, u10 = c10.startRow + c10.cell.__rowSpan - 1, h3 = c10.startColumn <= s7 && a10 >= r9, d8 = c10.startRow <= i13 && u10 >= l8;
        if (h3 && d8) {
          const e6 = Math.min(r9, c10.startColumn), t11 = Math.max(s7, a10), n13 = Math.min(l8, c10.startRow), h4 = Math.max(i13, u10);
          e6 === r9 && t11 === s7 && n13 === l8 && h4 === i13 || (r9 = e6, s7 = t11, l8 = n13, i13 = h4, o8 = true);
        }
      }
    } while (o8);
    return { maxColumn: s7, maxRow: i13, minColumn: r9, minRow: l8 };
  }
  function _t6(e5) {
    const [t9, , n11] = pt6(e5), o8 = n11.getChildren(), r9 = o8.length, l8 = o8[0].getChildren().length, s7 = new Array(r9);
    for (let e6 = 0; e6 < r9; e6++) s7[e6] = new Array(l8);
    for (let e6 = 0; e6 < r9; e6++) {
      const n12 = o8[e6].getChildren();
      let r10 = 0;
      for (let o9 = 0; o9 < n12.length; o9++) {
        for (; s7[e6][r10]; ) r10++;
        const l9 = n12[o9], i13 = l9.__rowSpan || 1, c10 = l9.__colSpan || 1;
        for (let t10 = 0; t10 < i13; t10++) for (let n13 = 0; n13 < c10; n13++) s7[e6 + t10][r10 + n13] = l9;
        if (t9 === l9) return { colSpan: c10, columnIndex: r10, rowIndex: e6, rowSpan: i13 };
        r10 += c10;
      }
    }
    return null;
  }
  function St6(e5) {
    const [[t9, o8, r9, l8], [s7, i13, c10, a10]] = ["anchor", "focus"].map((t10) => {
      const o9 = e5[t10].getNode(), r10 = $findMatchingParent2(o9, Ae2);
      Ae2(r10) || ke2(238, t10, o9.getKey(), o9.getType());
      const l9 = r10.getParent();
      We2(l9) || ke2(239, t10);
      const s8 = l9.getParent();
      return pn2(s8) || ke2(240, t10), [o9, r10, l9, s8];
    });
    return l8.is(a10) || ke2(241), { anchorCell: o8, anchorNode: t9, anchorRow: r9, anchorTable: l8, focusCell: i13, focusNode: s7, focusRow: c10, focusTable: a10 };
  }
  var wt5 = class _wt {
    tableKey;
    anchor;
    focus;
    _cachedNodes;
    dirty;
    constructor(e5, t9, n11) {
      this.anchor = t9, this.focus = n11, t9._selection = this, n11._selection = this, this._cachedNodes = null, this.dirty = false, this.tableKey = e5;
    }
    getStartEndPoints() {
      return [this.anchor, this.focus];
    }
    isValid() {
      if ("root" === this.tableKey || "root" === this.anchor.key || "element" !== this.anchor.type || "root" === this.focus.key || "element" !== this.focus.type) return false;
      const e5 = $getNodeByKey(this.tableKey), t9 = $getNodeByKey(this.anchor.key), n11 = $getNodeByKey(this.focus.key);
      return null !== e5 && null !== t9 && null !== n11;
    }
    isBackward() {
      return this.focus.isBefore(this.anchor);
    }
    getCachedNodes() {
      return this._cachedNodes;
    }
    setCachedNodes(e5) {
      this._cachedNodes = e5;
    }
    is(e5) {
      return bt6(e5) && this.tableKey === e5.tableKey && this.anchor.is(e5.anchor) && this.focus.is(e5.focus);
    }
    set(e5, t9, n11) {
      this.dirty = this.dirty || e5 !== this.tableKey || t9 !== this.anchor.key || n11 !== this.focus.key, this.tableKey = e5, this.anchor.key = t9, this.focus.key = n11, this._cachedNodes = null;
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
    insertRawText(e5) {
    }
    insertText() {
    }
    hasFormat(e5) {
      let t9 = 0;
      this.getNodes().filter(Ae2).forEach((e6) => {
        const n12 = e6.getFirstChild();
        $isParagraphNode(n12) && (t9 |= n12.getTextFormat());
      });
      const n11 = TEXT_TYPE_TO_FORMAT[e5];
      return 0 !== (t9 & n11);
    }
    insertNodes(e5) {
      const t9 = this.focus.getNode();
      $isElementNode(t9) || ke2(151);
      $normalizeSelection__EXPERIMENTAL(t9.select(0, t9.getChildrenSize())).insertNodes(e5);
    }
    getShape() {
      const { anchorCell: e5, focusCell: t9 } = St6(this), n11 = _t6(e5);
      null === n11 && ke2(153);
      const o8 = _t6(t9);
      null === o8 && ke2(155);
      const r9 = Math.min(n11.columnIndex, o8.columnIndex), l8 = Math.max(n11.columnIndex + n11.colSpan - 1, o8.columnIndex + o8.colSpan - 1), s7 = Math.min(n11.rowIndex, o8.rowIndex), i13 = Math.max(n11.rowIndex + n11.rowSpan - 1, o8.rowIndex + o8.rowSpan - 1);
      return { fromX: Math.min(r9, l8), fromY: Math.min(s7, i13), toX: Math.max(r9, l8), toY: Math.max(s7, i13) };
    }
    getNodes() {
      if (!this.isValid()) return [];
      const e5 = this._cachedNodes;
      if (null !== e5) return e5;
      const { anchorTable: t9, anchorCell: n11, focusCell: o8 } = St6(this), r9 = o8.getParents()[1];
      if (r9 !== t9) {
        if (t9.isParentOf(o8)) {
          const e6 = r9.getParent();
          null == e6 && ke2(159), this.set(this.tableKey, o8.getKey(), e6.getKey());
        } else {
          const e6 = t9.getParent();
          null == e6 && ke2(158), this.set(this.tableKey, e6.getKey(), o8.getKey());
        }
        return this.getNodes();
      }
      const [l8, s7, i13] = gt6(t9, n11, o8), { minColumn: c10, maxColumn: a10, minRow: u10, maxRow: h3 } = Ct6(l8, s7, i13), d8 = /* @__PURE__ */ new Map([[t9.getKey(), t9]]);
      let f8 = null;
      for (let e6 = u10; e6 <= h3; e6++) for (let t10 = c10; t10 <= a10; t10++) {
        const { cell: n12 } = l8[e6][t10], o9 = n12.getParent();
        We2(o9) || ke2(160), o9 !== f8 && (d8.set(o9.getKey(), o9), f8 = o9), d8.has(n12.getKey()) || vt6(n12, (e7) => {
          d8.set(e7.getKey(), e7);
        });
      }
      const g5 = Array.from(d8.values());
      return isCurrentlyReadOnlyMode() || (this._cachedNodes = g5), g5;
    }
    getTextContent() {
      const e5 = this.getNodes().filter((e6) => Ae2(e6));
      let t9 = "";
      for (let n11 = 0; n11 < e5.length; n11++) {
        const o8 = e5[n11], r9 = o8.__parent, l8 = (e5[n11 + 1] || {}).__parent;
        t9 += o8.getTextContent() + (l8 !== r9 ? "\n" : "	");
      }
      return t9;
    }
  };
  function bt6(e5) {
    return e5 instanceof wt5;
  }
  function yt6() {
    const e5 = $createPoint("root", 0, "element"), t9 = $createPoint("root", 0, "element");
    return new wt5("root", e5, t9);
  }
  function Nt6(e5, t9, n11) {
    e5.getKey(), t9.getKey(), n11.getKey();
    const o8 = $getSelection(), r9 = bt6(o8) ? o8.clone() : yt6();
    return r9.set(e5.getKey(), t9.getKey(), n11.getKey()), r9;
  }
  function vt6(e5, t9) {
    const n11 = [[e5]];
    for (let e6 = n11.at(-1); void 0 !== e6 && n11.length > 0; e6 = n11.at(-1)) {
      const o8 = e6.pop();
      void 0 === o8 ? n11.pop() : false !== t9(o8) && $isElementNode(o8) && n11.push(o8.getChildren());
    }
  }
  function xt6(e5, t9 = $getEditor()) {
    const n11 = $getNodeByKey(e5);
    pn2(n11) || ke2(231, e5);
    const o8 = Ot5(n11, t9.getElementByKey(e5));
    return null === o8 && ke2(232, e5), { tableElement: o8, tableNode: n11 };
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
    constructor(e5, t9) {
      this.isHighlightingCells = false, this.anchorX = -1, this.anchorY = -1, this.focusX = -1, this.focusY = -1, this.listenersToRemove = /* @__PURE__ */ new Set(), this.tableNodeKey = t9, this.editor = e5, this.table = { columns: 0, domRows: [], rows: 0 }, this.tableSelection = null, this.anchorCellNodeKey = null, this.focusCellNodeKey = null, this.anchorCell = null, this.focusCell = null, this.hasHijackedSelectionStyles = false, this.isSelecting = false, this.pointerType = null, this.shouldCheckSelection = false, this.abortController = new AbortController(), this.listenerOptions = { signal: this.abortController.signal }, this.nextFocus = null, this.trackTable();
    }
    getTable() {
      return this.table;
    }
    removeListeners() {
      this.abortController.abort("removeListeners"), Array.from(this.listenersToRemove).forEach((e5) => e5()), this.listenersToRemove.clear();
    }
    $lookup() {
      return xt6(this.tableNodeKey, this.editor);
    }
    trackTable() {
      const e5 = new MutationObserver((e6) => {
        this.editor.getEditorState().read(() => {
          let t9 = false;
          for (let n12 = 0; n12 < e6.length; n12++) {
            const o9 = e6[n12].target.nodeName;
            if ("TABLE" === o9 || "TBODY" === o9 || "THEAD" === o9 || "TR" === o9) {
              t9 = true;
              break;
            }
          }
          if (!t9) return;
          const { tableNode: n11, tableElement: o8 } = this.$lookup();
          this.table = Lt5(n11, o8);
        }, { editor: this.editor });
      });
      this.editor.getEditorState().read(() => {
        const { tableNode: t9, tableElement: n11 } = this.$lookup();
        this.table = Lt5(t9, n11), e5.observe(n11, { attributes: true, childList: true, subtree: true });
      }, { editor: this.editor });
    }
    $clearHighlight() {
      const e5 = this.editor;
      this.isHighlightingCells = false, this.anchorX = -1, this.anchorY = -1, this.focusX = -1, this.focusY = -1, this.tableSelection = null, this.anchorCellNodeKey = null, this.focusCellNodeKey = null, this.anchorCell = null, this.focusCell = null, this.hasHijackedSelectionStyles = false, this.$enableHighlightStyle();
      const { tableNode: t9, tableElement: n11 } = this.$lookup();
      Bt4(e5, Lt5(t9, n11), null), null !== $getSelection() && ($setSelection(null), e5.dispatchCommand(SELECTION_CHANGE_COMMAND, void 0));
    }
    $enableHighlightStyle() {
      const e5 = this.editor, { tableElement: t9 } = this.$lookup();
      removeClassNamesFromElement(t9, e5._config.theme.tableSelection), t9.classList.remove("disable-selection"), this.hasHijackedSelectionStyles = false;
    }
    $disableHighlightStyle() {
      const { tableElement: t9 } = this.$lookup();
      addClassNamesToElement(t9, this.editor._config.theme.tableSelection), this.hasHijackedSelectionStyles = true;
    }
    $updateTableTableSelection(e5) {
      if (null !== e5) {
        e5.tableKey !== this.tableNodeKey && ke2(233, e5.tableKey, this.tableNodeKey);
        const t9 = this.editor;
        this.tableSelection = e5, this.isHighlightingCells = true, this.$disableHighlightStyle(), this.updateDOMSelection(), Bt4(t9, this.table, this.tableSelection);
      } else this.$clearHighlight();
    }
    setShouldCheckSelection() {
      this.shouldCheckSelection = true;
    }
    getAndClearShouldCheckSelection() {
      return !!this.shouldCheckSelection && (this.shouldCheckSelection = false, true);
    }
    setNextFocus(e5) {
      this.nextFocus = e5;
    }
    getAndClearNextFocus() {
      const { nextFocus: e5 } = this;
      return null !== e5 && (this.nextFocus = null), e5;
    }
    updateDOMSelection() {
      if (null !== this.anchorCell && null !== this.focusCell) {
        const e5 = getDOMSelection(this.editor._window);
        e5 && e5.rangeCount > 0 && e5.removeAllRanges();
      }
    }
    $setFocusCellForSelection(e5, t9 = false) {
      const n11 = this.editor, { tableNode: o8 } = this.$lookup(), r9 = e5.x, l8 = e5.y;
      if (this.focusCell = e5, this.isHighlightingCells || this.anchorX === r9 && this.anchorY === l8 && !t9) {
        if (r9 === this.focusX && l8 === this.focusY) return false;
      } else this.isHighlightingCells = true, this.$disableHighlightStyle();
      if (this.focusX = r9, this.focusY = l8, this.isHighlightingCells) {
        const t10 = sn2(o8, e5.elem);
        if (null != this.tableSelection && null != this.anchorCellNodeKey && null !== t10) return this.focusCellNodeKey = t10.getKey(), this.tableSelection = Nt6(o8, this.$getAnchorTableCellOrThrow(), t10), $setSelection(this.tableSelection), n11.dispatchCommand(SELECTION_CHANGE_COMMAND, void 0), Bt4(n11, this.table, this.tableSelection), true;
      }
      return false;
    }
    $getAnchorTableCell() {
      return this.anchorCellNodeKey ? $getNodeByKey(this.anchorCellNodeKey) : null;
    }
    $getAnchorTableCellOrThrow() {
      const e5 = this.$getAnchorTableCell();
      return null === e5 && ke2(234), e5;
    }
    $getFocusTableCell() {
      return this.focusCellNodeKey ? $getNodeByKey(this.focusCellNodeKey) : null;
    }
    $getFocusTableCellOrThrow() {
      const e5 = this.$getFocusTableCell();
      return null === e5 && ke2(235), e5;
    }
    $setAnchorCellForSelection(e5) {
      this.isHighlightingCells = false, this.anchorCell = e5, this.anchorX = e5.x, this.anchorY = e5.y;
      const { tableNode: t9 } = this.$lookup(), n11 = sn2(t9, e5.elem);
      if (null !== n11) {
        const e6 = n11.getKey();
        this.tableSelection = null != this.tableSelection ? this.tableSelection.clone() : yt6(), this.anchorCellNodeKey = e6;
      }
    }
    $formatCells(e5) {
      const t9 = $getSelection();
      bt6(t9) || ke2(236);
      const n11 = $createRangeSelection(), o8 = n11.anchor, r9 = n11.focus, l8 = t9.getNodes().filter(Ae2);
      l8.length > 0 || ke2(237);
      const s7 = l8[0].getFirstChild(), i13 = $isParagraphNode(s7) ? s7.getFormatFlags(e5, null) : null;
      l8.forEach((t10) => {
        o8.set(t10.getKey(), 0, "element"), r9.set(t10.getKey(), t10.getChildrenSize(), "element"), n11.formatText(e5, i13);
      }), $setSelection(t9), this.editor.dispatchCommand(SELECTION_CHANGE_COMMAND, void 0);
    }
    $clearText() {
      const { editor: e5 } = this, t9 = $getNodeByKey(this.tableNodeKey);
      if (!pn2(t9)) throw new Error("Expected TableNode.");
      const n11 = $getSelection();
      bt6(n11) || ke2(253);
      const o8 = n11.getNodes().filter(Ae2), r9 = t9.getFirstChild(), l8 = t9.getLastChild();
      if (o8.length > 0 && null !== r9 && null !== l8 && We2(r9) && We2(l8) && o8[0] === r9.getFirstChild() && o8[o8.length - 1] === l8.getLastChild()) {
        t9.selectPrevious();
        const n12 = t9.getParent();
        return t9.remove(), void ($isRootNode(n12) && n12.isEmpty() && e5.dispatchCommand(INSERT_PARAGRAPH_COMMAND, void 0));
      }
      o8.forEach((e6) => {
        if ($isElementNode(e6)) {
          const t10 = $createParagraphNode(), n12 = $createTextNode();
          t10.append(n12), e6.append(t10), e6.getChildren().forEach((e7) => {
            e7 !== t10 && e7.remove();
          });
        }
      }), Bt4(e5, this.table, null), $setSelection(null), e5.dispatchCommand(SELECTION_CHANGE_COMMAND, void 0);
    }
  };
  var Rt4 = "__lexicalTableSelection";
  function Ft5(e5) {
    return isHTMLElement(e5) && "TABLE" === e5.nodeName;
  }
  function Ot5(e5, t9) {
    if (!t9) return t9;
    const n11 = Ft5(t9) ? t9 : e5.getDOMSlot(t9).element;
    return "TABLE" !== n11.nodeName && ke2(245, t9.nodeName), n11;
  }
  function At6(e5) {
    return e5._window;
  }
  function Kt5(e5, t9) {
    for (let n11 = t9, o8 = null; null !== n11; n11 = n11.getParent()) {
      if (e5.is(n11)) return o8;
      Ae2(n11) && (o8 = n11);
    }
    return null;
  }
  var kt6 = [[KEY_ARROW_DOWN_COMMAND, "down"], [KEY_ARROW_UP_COMMAND, "up"], [KEY_ARROW_LEFT_COMMAND, "backward"], [KEY_ARROW_RIGHT_COMMAND, "forward"]];
  var Et5 = [DELETE_WORD_COMMAND, DELETE_LINE_COMMAND, DELETE_CHARACTER_COMMAND];
  var Mt5 = [KEY_BACKSPACE_COMMAND, KEY_DELETE_COMMAND];
  function $t4(e5, t9, o8, l8) {
    const s7 = o8.getRootElement(), i13 = At6(o8);
    null !== s7 && null !== i13 || ke2(246);
    const c10 = new Tt6(o8, e5.getKey()), a10 = Ot5(e5, t9);
    !(function(e6, t10) {
      null !== Wt4(e6) && ke2(205);
      e6[Rt4] = t10;
    })(a10, c10), c10.listenersToRemove.add(() => (function(e6, t10) {
      Wt4(e6) === t10 && delete e6[Rt4];
    })(a10, c10));
    const u10 = (t10) => {
      if (c10.pointerType = t10.pointerType, 0 !== t10.button || !isDOMNode(t10.target) || !i13) return;
      const n11 = zt3(t10.target);
      null !== n11 && o8.update(() => {
        const o9 = $getPreviousSelection();
        if (Le2 && t10.shiftKey && qt3(o9, e5) && ($isRangeSelection(o9) || bt6(o9))) {
          const r9 = o9.anchor.getNode(), l9 = Kt5(e5, o9.anchor.getNode());
          if (l9) c10.$setAnchorCellForSelection(ln2(c10, l9)), c10.$setFocusCellForSelection(n11), nn2(t10);
          else {
            (e5.isBefore(r9) ? e5.selectStart() : e5.selectEnd()).anchor.set(o9.anchor.key, o9.anchor.offset, o9.anchor.type);
          }
        } else "touch" !== t10.pointerType && c10.$setAnchorCellForSelection(n11);
      }), (() => {
        if (c10.isSelecting) return;
        const e6 = () => {
          c10.isSelecting = false, i13.removeEventListener("pointerup", e6), i13.removeEventListener("pointermove", t11);
        }, t11 = (n12) => {
          if (1 & ~n12.buttons && c10.isSelecting) return c10.isSelecting = false, i13.removeEventListener("pointerup", e6), void i13.removeEventListener("pointermove", t11);
          if (!isDOMNode(n12.target)) return;
          let r9 = null;
          const l9 = !(Le2 || a10.contains(n12.target));
          if (l9) r9 = Ht4(a10, n12.target);
          else for (const e7 of document.elementsFromPoint(n12.clientX, n12.clientY)) if (r9 = Ht4(a10, e7), r9) break;
          !r9 || null !== c10.focusCell && r9.elem === c10.focusCell.elem || (c10.setNextFocus({ focusCell: r9, override: l9 }), o8.dispatchCommand(SELECTION_CHANGE_COMMAND, void 0));
        };
        c10.isSelecting = true, i13.addEventListener("pointerup", e6, c10.listenerOptions), i13.addEventListener("pointermove", t11, c10.listenerOptions);
      })();
    };
    a10.addEventListener("pointerdown", u10, c10.listenerOptions), c10.listenersToRemove.add(() => {
      a10.removeEventListener("pointerdown", u10);
    });
    const h3 = (e6) => {
      if (e6.detail >= 3 && isDOMNode(e6.target)) {
        null !== zt3(e6.target) && e6.preventDefault();
      }
    };
    a10.addEventListener("mousedown", h3, c10.listenerOptions), c10.listenersToRemove.add(() => {
      a10.removeEventListener("mousedown", h3);
    });
    const d8 = (e6) => {
      const t10 = e6.target;
      0 === e6.button && isDOMNode(t10) && o8.update(() => {
        const e7 = $getSelection();
        bt6(e7) && e7.tableKey === c10.tableNodeKey && s7.contains(t10) && c10.$clearHighlight();
      });
    };
    i13.addEventListener("pointerdown", d8, c10.listenerOptions), c10.listenersToRemove.add(() => {
      i13.removeEventListener("pointerdown", d8);
    });
    for (const [t10, n11] of kt6) c10.listenersToRemove.add(o8.registerCommand(t10, (t11) => tn2(o8, t11, n11, e5, c10), COMMAND_PRIORITY_HIGH));
    c10.listenersToRemove.add(o8.registerCommand(KEY_ESCAPE_COMMAND, (t10) => {
      const n11 = $getSelection();
      if (bt6(n11)) {
        const o9 = Kt5(e5, n11.focus.getNode());
        if (null !== o9) return nn2(t10), o9.selectEnd(), true;
      }
      return false;
    }, COMMAND_PRIORITY_HIGH));
    const g5 = (t10) => () => {
      const o9 = $getSelection();
      if (!qt3(o9, e5)) return false;
      if (bt6(o9)) return c10.$clearText(), true;
      if ($isRangeSelection(o9)) {
        if (!Ae2(Kt5(e5, o9.anchor.getNode()))) return false;
        const r9 = o9.anchor.getNode(), l9 = o9.focus.getNode(), s8 = e5.isParentOf(r9), i14 = e5.isParentOf(l9);
        if (s8 && !i14 || i14 && !s8) return c10.$clearText(), true;
        const a11 = $findMatchingParent2(o9.anchor.getNode(), (e6) => $isElementNode(e6)), u11 = a11 && $findMatchingParent2(a11, (e6) => $isElementNode(e6) && Ae2(e6.getParent()));
        if (!$isElementNode(u11) || !$isElementNode(a11)) return false;
        if (t10 === DELETE_LINE_COMMAND && null === u11.getPreviousSibling()) return true;
      }
      return false;
    };
    for (const e6 of Et5) c10.listenersToRemove.add(o8.registerCommand(e6, g5(e6), COMMAND_PRIORITY_HIGH));
    const p7 = (t10) => {
      const n11 = $getSelection();
      if (!bt6(n11) && !$isRangeSelection(n11)) return false;
      const o9 = e5.isParentOf(n11.anchor.getNode());
      if (o9 !== e5.isParentOf(n11.focus.getNode())) {
        const t11 = o9 ? "anchor" : "focus", r9 = o9 ? "focus" : "anchor", { key: l9, offset: s8, type: i14 } = n11[r9];
        return e5[n11[t11].isBefore(n11[r9]) ? "selectPrevious" : "selectNext"]()[r9].set(l9, s8, i14), false;
      }
      return !!qt3(n11, e5) && (!!bt6(n11) && (t10 && (t10.preventDefault(), t10.stopPropagation()), c10.$clearText(), true));
    };
    for (const e6 of Mt5) c10.listenersToRemove.add(o8.registerCommand(e6, p7, COMMAND_PRIORITY_HIGH));
    return c10.listenersToRemove.add(o8.registerCommand(CUT_COMMAND, (e6) => {
      const t10 = $getSelection();
      if (t10) {
        if (!bt6(t10) && !$isRangeSelection(t10)) return false;
        copyToClipboard(o8, objectKlassEquals(e6, ClipboardEvent) ? e6 : null, $getClipboardDataFromSelection(t10));
        const n11 = p7(e6);
        return $isRangeSelection(t10) ? (t10.removeText(), true) : n11;
      }
      return false;
    }, COMMAND_PRIORITY_HIGH)), c10.listenersToRemove.add(o8.registerCommand(FORMAT_TEXT_COMMAND, (t10) => {
      const o9 = $getSelection();
      if (!qt3(o9, e5)) return false;
      if (bt6(o9)) return c10.$formatCells(t10), true;
      if ($isRangeSelection(o9)) {
        const e6 = $findMatchingParent2(o9.anchor.getNode(), (e7) => Ae2(e7));
        if (!Ae2(e6)) return false;
      }
      return false;
    }, COMMAND_PRIORITY_HIGH)), c10.listenersToRemove.add(o8.registerCommand(FORMAT_ELEMENT_COMMAND, (t10) => {
      const n11 = $getSelection();
      if (!bt6(n11) || !qt3(n11, e5)) return false;
      const o9 = n11.anchor.getNode(), r9 = n11.focus.getNode();
      if (!Ae2(o9) || !Ae2(r9)) return false;
      if ((function(e6, t11) {
        if (bt6(e6)) {
          const n12 = e6.anchor.getNode(), o10 = e6.focus.getNode();
          if (t11 && n12 && o10) {
            const [e7] = gt6(t11, n12, o10);
            return n12.getKey() === e7[0][0].cell.getKey() && o10.getKey() === e7[e7.length - 1].at(-1).cell.getKey();
          }
        }
        return false;
      })(n11, e5)) return e5.setFormat(t10), true;
      const [l9, s8, i14] = gt6(e5, o9, r9), c11 = Math.max(s8.startRow + s8.cell.__rowSpan - 1, i14.startRow + i14.cell.__rowSpan - 1), a11 = Math.max(s8.startColumn + s8.cell.__colSpan - 1, i14.startColumn + i14.cell.__colSpan - 1), u11 = Math.min(s8.startRow, i14.startRow), h4 = Math.min(s8.startColumn, i14.startColumn), d9 = /* @__PURE__ */ new Set();
      for (let e6 = u11; e6 <= c11; e6++) for (let n12 = h4; n12 <= a11; n12++) {
        const o10 = l9[e6][n12].cell;
        if (d9.has(o10)) continue;
        d9.add(o10), o10.setFormat(t10);
        const r10 = o10.getChildren();
        for (let e7 = 0; e7 < r10.length; e7++) {
          const n13 = r10[e7];
          $isElementNode(n13) && !n13.isInline() && n13.setFormat(t10);
        }
      }
      return true;
    }, COMMAND_PRIORITY_HIGH)), c10.listenersToRemove.add(o8.registerCommand(CONTROLLED_TEXT_INSERTION_COMMAND, (t10) => {
      const r9 = $getSelection();
      if (!qt3(r9, e5)) return false;
      if (bt6(r9)) return c10.$clearHighlight(), false;
      if ($isRangeSelection(r9)) {
        const l9 = $findMatchingParent2(r9.anchor.getNode(), (e6) => Ae2(e6));
        if (!Ae2(l9)) return false;
        if ("string" == typeof t10) {
          const n11 = rn2(o8, r9, e5);
          if (n11) return on2(n11, e5, [$createTextNode(t10)]), true;
        }
      }
      return false;
    }, COMMAND_PRIORITY_HIGH)), l8 && c10.listenersToRemove.add(o8.registerCommand(KEY_TAB_COMMAND, (t10) => {
      const o9 = $getSelection();
      if (!$isRangeSelection(o9) || !o9.isCollapsed() || !qt3(o9, e5)) return false;
      const r9 = Qt3(o9.anchor.getNode());
      return !(null === r9 || !e5.is(Zt3(r9))) && (nn2(t10), (function(e6, t11) {
        const o10 = "next" === t11 ? "getNextSibling" : "getPreviousSibling", r10 = "next" === t11 ? "getFirstChild" : "getLastChild", l9 = e6[o10]();
        if ($isElementNode(l9)) return l9.selectEnd();
        const s8 = $findMatchingParent2(e6, We2);
        null === s8 && ke2(247);
        for (let e7 = s8[o10](); We2(e7); e7 = e7[o10]()) {
          const t12 = e7[r10]();
          if ($isElementNode(t12)) return t12.selectEnd();
        }
        const i14 = $findMatchingParent2(s8, pn2);
        null === i14 && ke2(248);
        "next" === t11 ? i14.selectNext() : i14.selectPrevious();
      })(r9, t10.shiftKey ? "previous" : "next"), true);
    }, COMMAND_PRIORITY_HIGH)), c10.listenersToRemove.add(o8.registerCommand(FOCUS_COMMAND, (t10) => e5.isSelected(), COMMAND_PRIORITY_HIGH)), c10.listenersToRemove.add(o8.registerCommand(SELECTION_INSERT_CLIPBOARD_NODES_COMMAND, (e6, t10) => {
      if (o8 !== t10) return false;
      const { nodes: r9, selection: l9 } = e6, s8 = l9.getStartEndPoints(), i14 = bt6(l9), c11 = $isRangeSelection(l9) && null !== $findMatchingParent2(l9.anchor.getNode(), (e7) => Ae2(e7)) && null !== $findMatchingParent2(l9.focus.getNode(), (e7) => Ae2(e7)) || i14;
      if (1 !== r9.length || !pn2(r9[0]) || !c11 || null === s8) return false;
      const [a11, u11] = s8, [h4, d9, g6] = pt6(a11), p8 = $findMatchingParent2(u11.getNode(), (e7) => Ae2(e7));
      if (!(Ae2(h4) && Ae2(p8) && We2(d9) && pn2(g6))) return false;
      const C5 = r9[0], [_5, S3, b7] = gt6(g6, h4, p8), [y6] = mt5(C5, null, null), N4 = _5.length, v6 = N4 > 0 ? _5[0].length : 0;
      let x7 = S3.startRow, T4 = S3.startColumn, R7 = y6.length, F7 = R7 > 0 ? y6[0].length : 0;
      if (i14) {
        const e7 = Ct6(_5, S3, b7), t11 = e7.maxRow - e7.minRow + 1, n11 = e7.maxColumn - e7.minColumn + 1;
        x7 = e7.minRow, T4 = e7.minColumn, R7 = Math.min(R7, t11), F7 = Math.min(F7, n11);
      }
      let O6 = false;
      const A5 = Math.min(N4, x7 + R7) - 1, K8 = Math.min(v6, T4 + F7) - 1, k4 = /* @__PURE__ */ new Set();
      for (let e7 = x7; e7 <= A5; e7++) for (let t11 = T4; t11 <= K8; t11++) {
        const n11 = _5[e7][t11];
        k4.has(n11.cell.getKey()) || (1 === n11.cell.__rowSpan && 1 === n11.cell.__colSpan || (ft5(n11.cell), k4.add(n11.cell.getKey()), O6 = true));
      }
      let [E8] = mt5(g6.getWritable(), null, null);
      const M6 = R7 - N4 + x7;
      for (let e7 = 0; e7 < M6; e7++) {
        Qe2(E8[N4 - 1][0].cell);
      }
      const $7 = F7 - v6 + T4;
      for (let e7 = 0; e7 < $7; e7++) {
        nt6(E8[0][v6 - 1].cell, true, false);
      }
      [E8] = mt5(g6.getWritable(), null, null);
      for (let e7 = x7; e7 < x7 + R7; e7++) for (let t11 = T4; t11 < T4 + F7; t11++) {
        const n11 = e7 - x7, o9 = t11 - T4, r10 = y6[n11][o9];
        if (r10.startRow !== n11 || r10.startColumn !== o9) continue;
        const l10 = r10.cell;
        if (1 !== l10.__rowSpan || 1 !== l10.__colSpan) {
          const n12 = [], o10 = Math.min(e7 + l10.__rowSpan, x7 + R7) - 1, r11 = Math.min(t11 + l10.__colSpan, T4 + F7) - 1;
          for (let l11 = e7; l11 <= o10; l11++) for (let e8 = t11; e8 <= r11; e8++) {
            const t12 = E8[l11][e8];
            n12.push(t12.cell);
          }
          ut5(n12), O6 = true;
        }
        const { cell: s9 } = E8[e7][t11], i15 = s9.getChildren();
        l10.getChildren().forEach((e8) => {
          if ($isTextNode(e8)) {
            $createParagraphNode().append(e8), s9.append(e8);
          } else s9.append(e8);
        }), i15.forEach((e8) => e8.remove());
      }
      if (i14 && O6) {
        const [e7] = mt5(g6.getWritable(), null, null);
        e7[S3.startRow][S3.startColumn].cell.selectEnd();
      }
      return true;
    }, COMMAND_PRIORITY_HIGH)), c10.listenersToRemove.add(o8.registerCommand(SELECTION_CHANGE_COMMAND, () => {
      const t10 = $getSelection(), r9 = $getPreviousSelection(), l9 = c10.getAndClearNextFocus();
      if (null !== l9) {
        const { focusCell: n11 } = l9;
        if (bt6(t10) && t10.tableKey === c10.tableNodeKey) return (n11.x !== c10.focusX || n11.y !== c10.focusY) && (c10.$setFocusCellForSelection(n11), true);
        if (n11 !== c10.anchorCell && qt3(t10, e5)) return c10.$setFocusCellForSelection(n11), true;
      }
      if (c10.getAndClearShouldCheckSelection() && $isRangeSelection(r9) && $isRangeSelection(t10) && t10.isCollapsed()) {
        const o9 = t10.anchor.getNode(), r10 = e5.getFirstChild(), l10 = Qt3(o9);
        if (null !== l10 && We2(r10)) {
          const t11 = r10.getFirstChild();
          if (Ae2(t11) && e5.is($findMatchingParent2(l10, (n11) => n11.is(e5) || n11.is(t11)))) return t11.selectStart(), true;
        }
      }
      if ($isRangeSelection(t10)) {
        const { anchor: n11, focus: l10 } = t10, s8 = n11.getNode(), i14 = l10.getNode(), a11 = Qt3(s8), u11 = Qt3(i14), h4 = !(!a11 || !e5.is(Zt3(a11))), d9 = !(!u11 || !e5.is(Zt3(u11))), f8 = h4 !== d9, g6 = h4 && d9, m9 = t10.isBackward();
        if (f8) {
          const n12 = t10.clone();
          if (d9) {
            const [t11] = gt6(e5, u11, u11), o9 = t11[0][0].cell, r10 = t11[t11.length - 1].at(-1).cell;
            n12.focus.set(m9 ? o9.getKey() : r10.getKey(), m9 ? 0 : r10.getChildrenSize(), "element");
          } else if (h4) {
            const [t11] = gt6(e5, a11, a11), o9 = t11[0][0].cell, r10 = t11[t11.length - 1].at(-1).cell;
            n12.anchor.set(m9 ? r10.getKey() : o9.getKey(), m9 ? r10.getChildrenSize() : 0, "element");
          }
          $setSelection(n12), Dt5(o8, c10);
        } else if (g6 && (a11.is(u11) || (c10.$setAnchorCellForSelection(ln2(c10, a11)), c10.$setFocusCellForSelection(ln2(c10, u11), true)), "touch" === c10.pointerType && c10.isSelecting && t10.isCollapsed() && $isRangeSelection(r9) && r9.isCollapsed())) {
          const e6 = Qt3(r9.anchor.getNode());
          e6 && !e6.is(u11) && (c10.$setAnchorCellForSelection(ln2(c10, e6)), c10.$setFocusCellForSelection(ln2(c10, u11), true), c10.pointerType = null);
        }
      } else if (t10 && bt6(t10) && t10.is(r9) && t10.tableKey === e5.getKey()) {
        const n11 = getDOMSelection(i13);
        if (n11 && n11.anchorNode && n11.focusNode) {
          const r10 = $getNearestNodeFromDOMNode(n11.focusNode), l10 = r10 && !e5.isParentOf(r10), s8 = $getNearestNodeFromDOMNode(n11.anchorNode), i14 = s8 && e5.isParentOf(s8);
          if (l10 && i14 && n11.rangeCount > 0) {
            const r11 = $createRangeSelectionFromDom(n11, o8);
            r11 && (r11.anchor.set(e5.getKey(), t10.isBackward() ? e5.getChildrenSize() : 0, "element"), n11.removeAllRanges(), $setSelection(r11));
          }
        }
      }
      return t10 && !t10.is(r9) && (bt6(t10) || bt6(r9)) && c10.tableSelection && !c10.tableSelection.is(r9) ? (bt6(t10) && t10.tableKey === c10.tableNodeKey ? c10.$updateTableTableSelection(t10) : !bt6(t10) && bt6(r9) && r9.tableKey === c10.tableNodeKey && c10.$updateTableTableSelection(null), false) : (c10.hasHijackedSelectionStyles && !e5.isSelected() ? (function(e6, t11) {
        t11.$enableHighlightStyle(), Pt6(t11.table, (t12) => {
          const n11 = t12.elem;
          t12.highlighted = false, Gt3(e6, t12), n11.getAttribute("style") || n11.removeAttribute("style");
        });
      })(o8, c10) : !c10.hasHijackedSelectionStyles && e5.isSelected() && Dt5(o8, c10), false);
    }, COMMAND_PRIORITY_HIGH)), c10.listenersToRemove.add(o8.registerCommand(INSERT_PARAGRAPH_COMMAND, () => {
      const t10 = $getSelection();
      if (!$isRangeSelection(t10) || !t10.isCollapsed() || !qt3(t10, e5)) return false;
      const n11 = rn2(o8, t10, e5);
      return !!n11 && (on2(n11, e5), true);
    }, COMMAND_PRIORITY_HIGH)), c10;
  }
  function Wt4(e5) {
    return e5[Rt4] || null;
  }
  function zt3(e5) {
    let t9 = e5;
    for (; null != t9; ) {
      const e6 = t9.nodeName;
      if ("TD" === e6 || "TH" === e6) {
        const e7 = t9._cell;
        return void 0 === e7 ? null : e7;
      }
      t9 = t9.parentNode;
    }
    return null;
  }
  function Ht4(e5, t9) {
    if (!e5.contains(t9)) return null;
    let n11 = null;
    for (let o8 = t9; null != o8; o8 = o8.parentNode) {
      if (o8 === e5) return n11;
      const t10 = o8.nodeName;
      "TD" !== t10 && "TH" !== t10 || (n11 = o8._cell || null);
    }
    return null;
  }
  function Lt5(e5, t9) {
    const n11 = [], o8 = { columns: 0, domRows: n11, rows: 0 };
    let r9 = Ot5(e5, t9).querySelector("tr"), l8 = 0, s7 = 0;
    for (n11.length = 0; null != r9; ) {
      const e6 = r9.nodeName;
      if ("TD" === e6 || "TH" === e6) {
        const e7 = { elem: r9, hasBackgroundColor: "" !== r9.style.backgroundColor, highlighted: false, x: l8, y: s7 };
        r9._cell = e7;
        let t11 = n11[s7];
        void 0 === t11 && (t11 = n11[s7] = []), t11[l8] = e7;
      } else {
        const e7 = r9.firstChild;
        if (null != e7) {
          r9 = e7;
          continue;
        }
      }
      const t10 = r9.nextSibling;
      if (null != t10) {
        l8++, r9 = t10;
        continue;
      }
      const o9 = r9.parentNode;
      if (null != o9) {
        const e7 = o9.nextSibling;
        if (null == e7) break;
        s7++, l8 = 0, r9 = e7;
      }
    }
    return o8.columns = l8 + 1, o8.rows = s7 + 1, o8;
  }
  function Bt4(e5, t9, n11) {
    const o8 = new Set(n11 ? n11.getNodes() : []);
    Pt6(t9, (t10, n12) => {
      const r9 = t10.elem;
      o8.has(n12) ? (t10.highlighted = true, Vt3(e5, t10)) : (t10.highlighted = false, Gt3(e5, t10), r9.getAttribute("style") || r9.removeAttribute("style"));
    });
  }
  function Pt6(e5, t9) {
    const { domRows: n11 } = e5;
    for (let e6 = 0; e6 < n11.length; e6++) {
      const o8 = n11[e6];
      if (o8) for (let n12 = 0; n12 < o8.length; n12++) {
        const r9 = o8[n12];
        if (!r9) continue;
        const l8 = $getNearestNodeFromDOMNode(r9.elem);
        null !== l8 && t9(r9, l8, { x: n12, y: e6 });
      }
    }
  }
  function Dt5(e5, t9) {
    t9.$disableHighlightStyle(), Pt6(t9.table, (t10) => {
      t10.highlighted = true, Vt3(e5, t10);
    });
  }
  var It4 = (e5, t9, n11, o8, r9) => {
    const l8 = "forward" === r9;
    switch (r9) {
      case "backward":
      case "forward":
        return n11 !== (l8 ? e5.table.columns - 1 : 0) ? jt4(t9.getCellNodeFromCordsOrThrow(n11 + (l8 ? 1 : -1), o8, e5.table), l8) : o8 !== (l8 ? e5.table.rows - 1 : 0) ? jt4(t9.getCellNodeFromCordsOrThrow(l8 ? 0 : e5.table.columns - 1, o8 + (l8 ? 1 : -1), e5.table), l8) : l8 ? t9.selectNext() : t9.selectPrevious(), true;
      case "up":
        return 0 !== o8 ? jt4(t9.getCellNodeFromCordsOrThrow(n11, o8 - 1, e5.table), false) : t9.selectPrevious(), true;
      case "down":
        return o8 !== e5.table.rows - 1 ? jt4(t9.getCellNodeFromCordsOrThrow(n11, o8 + 1, e5.table), true) : t9.selectNext(), true;
      default:
        return false;
    }
  };
  function Ut3(e5, t9) {
    let n11, o8;
    if (t9.startColumn === e5.minColumn) n11 = "minColumn";
    else {
      if (t9.startColumn + t9.cell.__colSpan - 1 !== e5.maxColumn) return null;
      n11 = "maxColumn";
    }
    if (t9.startRow === e5.minRow) o8 = "minRow";
    else {
      if (t9.startRow + t9.cell.__rowSpan - 1 !== e5.maxRow) return null;
      o8 = "maxRow";
    }
    return [n11, o8];
  }
  function Jt4([e5, t9]) {
    return ["minColumn" === e5 ? "maxColumn" : "minColumn", "minRow" === t9 ? "maxRow" : "minRow"];
  }
  function Yt3(e5, t9, [n11, o8]) {
    const r9 = t9[o8], l8 = e5[r9];
    void 0 === l8 && ke2(250, o8, String(r9));
    const s7 = t9[n11], i13 = l8[s7];
    return void 0 === i13 && ke2(250, n11, String(s7)), i13;
  }
  function Xt3(e5, t9, n11, o8, r9) {
    const l8 = Ct6(t9, n11, o8), s7 = (function(e6, t10) {
      const { minColumn: n12, maxColumn: o9, minRow: r10, maxRow: l9 } = t10;
      let s8 = 1, i14 = 1, c11 = 1, a11 = 1;
      const u11 = e6[r10], h4 = e6[l9];
      for (let e7 = n12; e7 <= o9; e7++) s8 = Math.max(s8, u11[e7].cell.__rowSpan), a11 = Math.max(a11, h4[e7].cell.__rowSpan);
      for (let t11 = r10; t11 <= l9; t11++) i14 = Math.max(i14, e6[t11][n12].cell.__colSpan), c11 = Math.max(c11, e6[t11][o9].cell.__colSpan);
      return { bottomSpan: a11, leftSpan: i14, rightSpan: c11, topSpan: s8 };
    })(t9, l8), { topSpan: i13, leftSpan: c10, bottomSpan: a10, rightSpan: u10 } = s7, h3 = (function(e6, t10) {
      const n12 = Ut3(e6, t10);
      return null === n12 && ke2(249, t10.cell.getKey()), n12;
    })(l8, n11), [d8, f8] = Jt4(h3);
    let g5 = l8[d8], m9 = l8[f8];
    "forward" === r9 ? g5 += "maxColumn" === d8 ? 1 : c10 : "backward" === r9 ? g5 -= "minColumn" === d8 ? 1 : u10 : "down" === r9 ? m9 += "maxRow" === f8 ? 1 : i13 : "up" === r9 && (m9 -= "minRow" === f8 ? 1 : a10);
    const p7 = t9[m9];
    if (void 0 === p7) return false;
    const C5 = p7[g5];
    if (void 0 === C5) return false;
    const [_5, S3] = (function(e6, t10, n12) {
      const o9 = Ct6(e6, t10, n12), r10 = Ut3(o9, t10);
      if (r10) return [Yt3(e6, o9, r10), Yt3(e6, o9, Jt4(r10))];
      const l9 = Ut3(o9, n12);
      if (l9) return [Yt3(e6, o9, Jt4(l9)), Yt3(e6, o9, l9)];
      const s8 = ["minColumn", "minRow"];
      return [Yt3(e6, o9, s8), Yt3(e6, o9, Jt4(s8))];
    })(t9, n11, C5), w6 = ln2(e5, _5.cell), b7 = ln2(e5, S3.cell);
    return e5.$setAnchorCellForSelection(w6), e5.$setFocusCellForSelection(b7, true), true;
  }
  function qt3(e5, t9) {
    if ($isRangeSelection(e5) || bt6(e5)) {
      const n11 = t9.isParentOf(e5.anchor.getNode()), o8 = t9.isParentOf(e5.focus.getNode());
      return n11 && o8;
    }
    return false;
  }
  function jt4(e5, t9) {
    t9 ? e5.selectStart() : e5.selectEnd();
  }
  function Vt3(t9, n11) {
    const o8 = n11.elem, r9 = t9._config.theme;
    Ae2($getNearestNodeFromDOMNode(o8)) || ke2(131), addClassNamesToElement(o8, r9.tableCellSelected);
  }
  function Gt3(e5, t9) {
    const n11 = t9.elem;
    Ae2($getNearestNodeFromDOMNode(n11)) || ke2(131);
    const r9 = e5._config.theme;
    removeClassNamesFromElement(n11, r9.tableCellSelected);
  }
  function Qt3(e5) {
    const t9 = $findMatchingParent2(e5, Ae2);
    return Ae2(t9) ? t9 : null;
  }
  function Zt3(e5) {
    const t9 = $findMatchingParent2(e5, pn2);
    return pn2(t9) ? t9 : null;
  }
  function en2(e5, t9, o8, r9, l8, s7, i13) {
    const c10 = $caretFromPoint(o8.focus, l8 ? "previous" : "next");
    if ($isExtendableTextPointCaret(c10)) return false;
    let a10 = c10;
    for (const e6 of $extendCaretToRange(c10).iterNodeCarets("shadowRoot")) {
      if (!$isSiblingCaret(e6) || !$isElementNode(e6.origin)) return false;
      a10 = e6;
    }
    const u10 = a10.getParentAtCaret();
    if (!Ae2(u10)) return false;
    const h3 = u10, d8 = (function(e6) {
      for (const t10 of $extendCaretToRange(e6).iterNodeCarets("root")) {
        const { origin: n11 } = t10;
        if (Ae2(n11)) {
          if ($isChildCaret(t10)) return $getChildCaret(n11, e6.direction);
        } else if (!We2(n11)) break;
      }
      return null;
    })($getSiblingCaret(h3, a10.direction)), f8 = $findMatchingParent2(h3, pn2);
    if (!f8 || !f8.is(s7)) return false;
    const g5 = e5.getElementByKey(h3.getKey()), m9 = zt3(g5);
    if (!g5 || !m9) return false;
    const p7 = fn2(e5, f8);
    if (i13.table = p7, d8) if ("extend" === r9) {
      const t10 = zt3(e5.getElementByKey(d8.origin.getKey()));
      if (!t10) return false;
      i13.$setAnchorCellForSelection(m9), i13.$setFocusCellForSelection(t10, true);
    } else {
      const e6 = $normalizeCaret(d8);
      $setPointFromCaret(o8.anchor, e6), $setPointFromCaret(o8.focus, e6);
    }
    else if ("extend" === r9) i13.$setAnchorCellForSelection(m9), i13.$setFocusCellForSelection(m9, true);
    else {
      const e6 = (function(e7) {
        const t10 = $getAdjacentChildCaret(e7);
        return $isChildCaret(t10) ? $normalizeCaret(t10) : e7;
      })($getSiblingCaret(f8, c10.direction));
      $setPointFromCaret(o8.anchor, e6), $setPointFromCaret(o8.focus, e6);
    }
    return nn2(t9), true;
  }
  function tn2(e5, t9, o8, r9, l8) {
    if (("up" === o8 || "down" === o8) && (function(e6) {
      const t10 = e6.getRootElement();
      if (!t10) return false;
      return t10.hasAttribute("aria-controls") && "typeahead-menu" === t10.getAttribute("aria-controls");
    })(e5)) return false;
    const s7 = $getSelection();
    if (!qt3(s7, r9)) {
      if ($isRangeSelection(s7)) {
        if ("backward" === o8) {
          if (s7.focus.offset > 0) return false;
          const e6 = (function(e7) {
            for (let t10 = e7, n12 = e7; null !== n12; t10 = n12, n12 = n12.getParent()) if ($isElementNode(n12)) {
              if (n12 !== t10 && n12.getFirstChild() !== t10) return null;
              if (!n12.isInline()) return n12;
            }
            return null;
          })(s7.focus.getNode());
          if (!e6) return false;
          const n11 = e6.getPreviousSibling();
          return !!pn2(n11) && (nn2(t9), t9.shiftKey ? s7.focus.set(n11.getParentOrThrow().getKey(), n11.getIndexWithinParent(), "element") : n11.selectEnd(), true);
        }
        if (t9.shiftKey && ("up" === o8 || "down" === o8)) {
          const e6 = s7.focus.getNode();
          if (!s7.isCollapsed() && ("up" === o8 && !s7.isBackward() || "down" === o8 && s7.isBackward())) {
            let l9 = $findMatchingParent2(e6, (e7) => pn2(e7));
            if (Ae2(l9) && (l9 = $findMatchingParent2(l9, pn2)), l9 !== r9) return false;
            if (!l9) return false;
            const i13 = "down" === o8 ? l9.getNextSibling() : l9.getPreviousSibling();
            if (!i13) return false;
            let c10 = 0;
            "up" === o8 && $isElementNode(i13) && (c10 = i13.getChildrenSize());
            let a10 = i13;
            if ("up" === o8 && $isElementNode(i13)) {
              const e7 = i13.getLastChild();
              a10 = e7 || i13, c10 = $isTextNode(a10) ? a10.getTextContentSize() : 0;
            }
            const u10 = s7.clone();
            return u10.focus.set(a10.getKey(), c10, $isTextNode(a10) ? "text" : "element"), $setSelection(u10), nn2(t9), true;
          }
          if ($isRootOrShadowRoot(e6)) {
            const e7 = "up" === o8 ? s7.getNodes()[s7.getNodes().length - 1] : s7.getNodes()[0];
            if (e7) {
              if (null !== Kt5(r9, e7)) {
                const e8 = r9.getFirstDescendant(), t10 = r9.getLastDescendant();
                if (!e8 || !t10) return false;
                const [n11] = pt6(e8), [o9] = pt6(t10), s8 = r9.getCordsFromCellNode(n11, l8.table), i13 = r9.getCordsFromCellNode(o9, l8.table), c10 = r9.getDOMCellFromCordsOrThrow(s8.x, s8.y, l8.table), a10 = r9.getDOMCellFromCordsOrThrow(i13.x, i13.y, l8.table);
                return l8.$setAnchorCellForSelection(c10), l8.$setFocusCellForSelection(a10, true), true;
              }
            }
            return false;
          }
          {
            let r10 = $findMatchingParent2(e6, (e7) => $isElementNode(e7) && !e7.isInline());
            if (Ae2(r10) && (r10 = $findMatchingParent2(r10, pn2)), !r10) return false;
            const i13 = "down" === o8 ? r10.getNextSibling() : r10.getPreviousSibling();
            if (pn2(i13) && l8.tableNodeKey === i13.getKey()) {
              const e7 = i13.getFirstDescendant(), n11 = i13.getLastDescendant();
              if (!e7 || !n11) return false;
              const [r11] = pt6(e7), [l9] = pt6(n11), c10 = s7.clone();
              return c10.focus.set(("up" === o8 ? r11 : l9).getKey(), "up" === o8 ? 0 : l9.getChildrenSize(), "element"), nn2(t9), $setSelection(c10), true;
            }
          }
        }
      }
      return "down" === o8 && un2(e5) && l8.setShouldCheckSelection(), false;
    }
    if ($isRangeSelection(s7)) {
      if ("backward" === o8 || "forward" === o8) {
        return en2(e5, t9, s7, t9.shiftKey ? "extend" : "move", "backward" === o8, r9, l8);
      }
      if (s7.isCollapsed()) {
        const { anchor: i13, focus: c10 } = s7, a10 = $findMatchingParent2(i13.getNode(), Ae2), u10 = $findMatchingParent2(c10.getNode(), Ae2);
        if (!Ae2(a10) || !a10.is(u10)) return false;
        const h3 = Zt3(a10);
        if (h3 !== r9 && null != h3) {
          const n11 = Ot5(h3, e5.getElementByKey(h3.getKey()));
          if (null != n11) return l8.table = Lt5(h3, n11), tn2(e5, t9, o8, h3, l8);
        }
        const d8 = e5.getElementByKey(a10.__key), f8 = e5.getElementByKey(i13.key);
        if (null == f8 || null == d8) return false;
        let g5;
        if ("element" === i13.type) g5 = f8.getBoundingClientRect();
        else {
          const t10 = getDOMSelection(At6(e5));
          if (null === t10 || 0 === t10.rangeCount) return false;
          g5 = t10.getRangeAt(0).getBoundingClientRect();
        }
        const m9 = "up" === o8 ? a10.getFirstChild() : a10.getLastChild();
        if (null == m9) return false;
        const p7 = e5.getElementByKey(m9.__key);
        if (null == p7) return false;
        const C5 = p7.getBoundingClientRect();
        if ("up" === o8 ? C5.top > g5.top - g5.height : g5.bottom + g5.height > C5.bottom) {
          nn2(t9);
          const e6 = r9.getCordsFromCellNode(a10, l8.table);
          if (!t9.shiftKey) return It4(l8, r9, e6.x, e6.y, o8);
          {
            const t10 = r9.getDOMCellFromCordsOrThrow(e6.x, e6.y, l8.table);
            l8.$setAnchorCellForSelection(t10), l8.$setFocusCellForSelection(t10, true);
          }
          return true;
        }
      }
    } else if (bt6(s7)) {
      const { anchor: i13, focus: c10 } = s7, a10 = $findMatchingParent2(i13.getNode(), Ae2), u10 = $findMatchingParent2(c10.getNode(), Ae2), [h3] = s7.getNodes();
      pn2(h3) || ke2(251);
      const d8 = Ot5(h3, e5.getElementByKey(h3.getKey()));
      if (!Ae2(a10) || !Ae2(u10) || !pn2(h3) || null == d8) return false;
      l8.$updateTableTableSelection(s7);
      const f8 = Lt5(h3, d8), g5 = r9.getCordsFromCellNode(a10, f8), m9 = r9.getDOMCellFromCordsOrThrow(g5.x, g5.y, f8);
      if (l8.$setAnchorCellForSelection(m9), nn2(t9), t9.shiftKey) {
        const [e6, t10, n11] = gt6(r9, a10, u10);
        return Xt3(l8, e6, t10, n11, o8);
      }
      return u10.selectEnd(), true;
    }
    return false;
  }
  function nn2(e5) {
    e5.preventDefault(), e5.stopImmediatePropagation(), e5.stopPropagation();
  }
  function on2(e5, t9, n11) {
    const o8 = $createParagraphNode();
    "first" === e5 ? t9.insertBefore(o8) : t9.insertAfter(o8), o8.append(...n11 || []), o8.selectEnd();
  }
  function rn2(e5, t9, o8) {
    const r9 = o8.getParent();
    if (!r9) return;
    const l8 = getDOMSelection(At6(e5));
    if (!l8) return;
    const s7 = l8.anchorNode, i13 = e5.getElementByKey(r9.getKey()), c10 = Ot5(o8, e5.getElementByKey(o8.getKey()));
    if (!s7 || !i13 || !c10 || !i13.contains(s7) || c10.contains(s7)) return;
    const a10 = $findMatchingParent2(t9.anchor.getNode(), (e6) => Ae2(e6));
    if (!a10) return;
    const u10 = $findMatchingParent2(a10, (e6) => pn2(e6));
    if (!pn2(u10) || !u10.is(o8)) return;
    const [h3, d8] = gt6(o8, a10, a10), f8 = h3[0][0], g5 = h3[h3.length - 1][h3[0].length - 1], { startRow: m9, startColumn: p7 } = d8, C5 = m9 === f8.startRow && p7 === f8.startColumn, _5 = m9 === g5.startRow && p7 === g5.startColumn;
    return C5 ? "first" : _5 ? "last" : void 0;
  }
  function ln2(e5, t9) {
    const { tableNode: n11 } = e5.$lookup(), o8 = n11.getCordsFromCellNode(t9, e5.table);
    return n11.getDOMCellFromCordsOrThrow(o8.x, o8.y, e5.table);
  }
  function sn2(e5, t9, n11) {
    return Kt5(e5, $getNearestNodeFromDOMNode(t9, n11));
  }
  function cn2(t9, n11, r9) {
    if (!n11.theme.tableAlignment) return;
    const l8 = [], s7 = [];
    for (const e5 of ["center", "right"]) {
      const t10 = n11.theme.tableAlignment[e5];
      t10 && (e5 === r9 ? s7 : l8).push(t10);
    }
    removeClassNamesFromElement(t9, ...l8), addClassNamesToElement(t9, ...s7);
  }
  var an2 = /* @__PURE__ */ new WeakSet();
  function un2(e5 = $getEditor()) {
    return an2.has(e5);
  }
  function hn2(e5, t9) {
    t9 ? an2.add(e5) : an2.delete(e5);
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
    setColWidths(e5) {
      const t9 = this.getWritable();
      return t9.__colWidths = e5, t9;
    }
    static clone(e5) {
      return new _dn(e5.__key);
    }
    afterCloneFrom(e5) {
      super.afterCloneFrom(e5), this.__colWidths = e5.__colWidths, this.__rowStriping = e5.__rowStriping, this.__frozenColumnCount = e5.__frozenColumnCount, this.__frozenRowCount = e5.__frozenRowCount;
    }
    static importDOM() {
      return { table: (e5) => ({ conversion: gn2, priority: 1 }) };
    }
    static importJSON(e5) {
      return mn2().updateFromJSON(e5);
    }
    updateFromJSON(e5) {
      return super.updateFromJSON(e5).setRowStriping(e5.rowStriping || false).setFrozenColumns(e5.frozenColumnCount || 0).setFrozenRows(e5.frozenRowCount || 0).setColWidths(e5.colWidths);
    }
    constructor(e5) {
      super(e5), this.__rowStriping = false, this.__frozenColumnCount = 0, this.__frozenRowCount = 0, this.__colWidths = void 0;
    }
    exportJSON() {
      return { ...super.exportJSON(), colWidths: this.getColWidths(), frozenColumnCount: this.__frozenColumnCount ? this.__frozenColumnCount : void 0, frozenRowCount: this.__frozenRowCount ? this.__frozenRowCount : void 0, rowStriping: this.__rowStriping ? this.__rowStriping : void 0 };
    }
    extractWithChild(e5, t9, n11) {
      return "html" === n11;
    }
    getDOMSlot(e5) {
      const t9 = Ft5(e5) ? e5 : e5.querySelector("table");
      return Ft5(t9) || ke2(229), super.getDOMSlot(e5).withElement(t9).withAfter(t9.querySelector("colgroup"));
    }
    createDOM(t9, n11) {
      const o8 = document.createElement("table");
      this.__style && (o8.style.cssText = this.__style);
      const r9 = document.createElement("colgroup");
      if (o8.appendChild(r9), setDOMUnmanaged(r9), addClassNamesToElement(o8, t9.theme.table), this.updateTableElement(null, o8, t9), un2(n11)) {
        const n12 = document.createElement("div"), r10 = t9.theme.tableScrollableWrapper;
        return r10 ? addClassNamesToElement(n12, r10) : n12.style.cssText = "overflow-x: auto;", n12.appendChild(o8), this.updateTableWrapper(null, n12, o8, t9), n12;
      }
      return o8;
    }
    updateTableWrapper(t9, n11, r9, l8) {
      this.__frozenColumnCount !== (t9 ? t9.__frozenColumnCount : 0) && (function(t10, n12, r10, l9) {
        l9 > 0 ? (addClassNamesToElement(t10, r10.theme.tableFrozenColumn), n12.setAttribute("data-lexical-frozen-column", "true")) : (removeClassNamesFromElement(t10, r10.theme.tableFrozenColumn), n12.removeAttribute("data-lexical-frozen-column"));
      })(n11, r9, l8, this.__frozenColumnCount), this.__frozenRowCount !== (t9 ? t9.__frozenRowCount : 0) && (function(t10, n12, r10, l9) {
        l9 > 0 ? (addClassNamesToElement(t10, r10.theme.tableFrozenRow), n12.setAttribute("data-lexical-frozen-row", "true")) : (removeClassNamesFromElement(t10, r10.theme.tableFrozenRow), n12.removeAttribute("data-lexical-frozen-row"));
      })(n11, r9, l8, this.__frozenRowCount);
    }
    updateTableElement(t9, n11, r9) {
      this.__style !== (t9 ? t9.__style : "") && (n11.style.cssText = this.__style), this.__rowStriping !== (!!t9 && t9.__rowStriping) && (function(t10, n12, r10) {
        r10 ? (addClassNamesToElement(t10, n12.theme.tableRowStriping), t10.setAttribute("data-lexical-row-striping", "true")) : (removeClassNamesFromElement(t10, n12.theme.tableRowStriping), t10.removeAttribute("data-lexical-row-striping"));
      })(n11, r9, this.__rowStriping), (function(e5, t10, n12, o8) {
        const r10 = e5.querySelector("colgroup");
        if (!r10) return;
        const l8 = [];
        for (let e6 = 0; e6 < n12; e6++) {
          const t11 = document.createElement("col"), n13 = o8 && o8[e6];
          n13 && (t11.style.width = `${n13}px`), l8.push(t11);
        }
        r10.replaceChildren(...l8);
      })(n11, 0, this.getColumnCount(), this.getColWidths()), cn2(n11, r9, this.getFormatType());
    }
    updateDOM(e5, t9, n11) {
      const o8 = this.getDOMSlot(t9).element;
      return t9 === o8 === un2() || (isHTMLElement2(r9 = t9) && "DIV" === r9.nodeName && this.updateTableWrapper(e5, t9, o8, n11), this.updateTableElement(e5, o8, n11), false);
      var r9;
    }
    exportDOM(e5) {
      const t9 = super.exportDOM(e5), { element: n11 } = t9;
      return { after: (n12) => {
        if (t9.after && (n12 = t9.after(n12)), !Ft5(n12) && isHTMLElement2(n12) && (n12 = n12.querySelector("table")), !Ft5(n12)) return null;
        cn2(n12, e5._config, this.getFormatType());
        const [o8] = mt5(this, null, null), r9 = /* @__PURE__ */ new Map();
        for (const e6 of o8) for (const t10 of e6) {
          const e7 = t10.cell.getKey();
          r9.has(e7) || r9.set(e7, { colSpan: t10.cell.getColSpan(), startColumn: t10.startColumn });
        }
        const s7 = /* @__PURE__ */ new Set();
        for (const e6 of n12.querySelectorAll(":scope > tr > [data-temporary-table-cell-lexical-key]")) {
          const t10 = e6.getAttribute("data-temporary-table-cell-lexical-key");
          if (t10) {
            const n13 = r9.get(t10);
            if (e6.removeAttribute("data-temporary-table-cell-lexical-key"), n13) {
              r9.delete(t10);
              for (let e7 = 0; e7 < n13.colSpan; e7++) s7.add(e7 + n13.startColumn);
            }
          }
        }
        const i13 = n12.querySelector(":scope > colgroup");
        if (i13) {
          const e6 = Array.from(n12.querySelectorAll(":scope > colgroup > col")).filter((e7, t10) => s7.has(t10));
          i13.replaceChildren(...e6);
        }
        const c10 = n12.querySelectorAll(":scope > tr");
        if (c10.length > 0) {
          const e6 = document.createElement("tbody");
          for (const t10 of c10) e6.appendChild(t10);
          n12.append(e6);
        }
        return n12;
      }, element: !Ft5(n11) && isHTMLElement2(n11) ? n11.querySelector("table") : n11 };
    }
    canBeEmpty() {
      return false;
    }
    isShadowRoot() {
      return true;
    }
    getCordsFromCellNode(e5, t9) {
      const { rows: n11, domRows: o8 } = t9;
      for (let t10 = 0; t10 < n11; t10++) {
        const n12 = o8[t10];
        if (null != n12) for (let o9 = 0; o9 < n12.length; o9++) {
          const r9 = n12[o9];
          if (null == r9) continue;
          const { elem: l8 } = r9, s7 = sn2(this, l8);
          if (null !== s7 && e5.is(s7)) return { x: o9, y: t10 };
        }
      }
      throw new Error("Cell not found in table.");
    }
    getDOMCellFromCords(e5, t9, n11) {
      const { domRows: o8 } = n11, r9 = o8[t9];
      if (null == r9) return null;
      const l8 = r9[e5 < r9.length ? e5 : r9.length - 1];
      return null == l8 ? null : l8;
    }
    getDOMCellFromCordsOrThrow(e5, t9, n11) {
      const o8 = this.getDOMCellFromCords(e5, t9, n11);
      if (!o8) throw new Error("Cell not found at cords.");
      return o8;
    }
    getCellNodeFromCords(e5, t9, n11) {
      const o8 = this.getDOMCellFromCords(e5, t9, n11);
      if (null == o8) return null;
      const r9 = $getNearestNodeFromDOMNode(o8.elem);
      return Ae2(r9) ? r9 : null;
    }
    getCellNodeFromCordsOrThrow(e5, t9, n11) {
      const o8 = this.getCellNodeFromCords(e5, t9, n11);
      if (!o8) throw new Error("Node at cords not TableCellNode.");
      return o8;
    }
    getRowStriping() {
      return Boolean(this.getLatest().__rowStriping);
    }
    setRowStriping(e5) {
      const t9 = this.getWritable();
      return t9.__rowStriping = e5, t9;
    }
    setFrozenColumns(e5) {
      const t9 = this.getWritable();
      return t9.__frozenColumnCount = e5, t9;
    }
    getFrozenColumns() {
      return this.getLatest().__frozenColumnCount;
    }
    setFrozenRows(e5) {
      const t9 = this.getWritable();
      return t9.__frozenRowCount = e5, t9;
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
      const e5 = this.getFirstChild();
      if (!e5) return 0;
      let t9 = 0;
      return e5.getChildren().forEach((e6) => {
        Ae2(e6) && (t9 += e6.getColSpan());
      }), t9;
    }
  };
  function fn2(e5, t9) {
    const n11 = e5.getElementByKey(t9.getKey());
    return null === n11 && ke2(230), Lt5(t9, n11);
  }
  function gn2(e5) {
    const n11 = mn2();
    e5.hasAttribute("data-lexical-row-striping") && n11.setRowStriping(true), e5.hasAttribute("data-lexical-frozen-column") && n11.setFrozenColumns(1), e5.hasAttribute("data-lexical-frozen-row") && n11.setFrozenRows(1);
    const o8 = e5.querySelector(":scope > colgroup");
    if (o8) {
      let e6 = [];
      for (const t9 of o8.querySelectorAll(":scope > col")) {
        let n12 = t9.style.width || "";
        if (!ve2.test(n12) && (n12 = t9.getAttribute("width") || "", !/^\d+$/.test(n12))) {
          e6 = void 0;
          break;
        }
        e6.push(parseFloat(n12));
      }
      e6 && n11.setColWidths(e6);
    }
    return { after: (e6) => $descendantsMatching(e6, We2), node: n11 };
  }
  function mn2() {
    return $applyNodeReplacement(new dn2());
  }
  function pn2(e5) {
    return e5 instanceof dn2;
  }
  function Cn2(e5) {
    We2(e5.getParent()) ? e5.isEmpty() && e5.append($createParagraphNode()) : e5.remove();
  }
  function _n2(e5) {
    pn2(e5.getParent()) ? $unwrapAndFilterDescendants(e5, Ae2) : e5.remove();
  }
  function Sn2(e5) {
    $unwrapAndFilterDescendants(e5, We2);
    const [t9] = mt5(e5, null, null), n11 = t9.reduce((e6, t10) => Math.max(e6, t10.length), 0), o8 = e5.getChildren();
    for (let e6 = 0; e6 < t9.length; ++e6) {
      const r10 = o8[e6];
      if (!r10) continue;
      We2(r10) || ke2(254, r10.constructor.name, r10.getType());
      const l9 = t9[e6].reduce((e7, t10) => t10 ? 1 + e7 : e7, 0);
      if (l9 !== n11) for (let e7 = l9; e7 < n11; ++e7) {
        const e8 = Oe2();
        e8.append($createParagraphNode()), r10.append(e8);
      }
    }
    const r9 = e5.getColWidths(), l8 = e5.getColumnCount();
    if (r9 && r9.length !== l8) {
      let t10;
      if (l8 < r9.length) t10 = r9.slice(0, l8);
      else if (r9.length > 0) {
        const e6 = r9[r9.length - 1];
        t10 = [...r9, ...Array(l8 - r9.length).fill(e6)];
      }
      e5.setColWidths(t10);
    }
  }
  function wn2(e5) {
    if (e5.detail < 3 || !isDOMNode(e5.target)) return false;
    const t9 = $getNearestNodeFromDOMNode(e5.target);
    if (null === t9) return false;
    const o8 = $findMatchingParent2(t9, (e6) => $isElementNode(e6) && !e6.isInline());
    if (null === o8) return false;
    return !!Ae2(o8.getParent()) && (o8.select(0), true);
  }
  function bn2(e5) {
    return e5.registerNodeTransform(Te2, (e6) => {
      if (e6.getColSpan() > 1 || e6.getRowSpan() > 1) {
        const [, , t9] = pt6(e6), [n11] = gt6(t9, e6, e6), o8 = n11.length, r9 = n11[0].length;
        let l8 = t9.getFirstChild();
        We2(l8) || ke2(175);
        const i13 = [];
        for (let e7 = 0; e7 < o8; e7++) {
          0 !== e7 && (l8 = l8.getNextSibling(), We2(l8) || ke2(175));
          let t10 = null;
          for (let o9 = 0; o9 < r9; o9++) {
            const r10 = n11[e7][o9], c10 = r10.cell;
            if (r10.startRow === e7 && r10.startColumn === o9) t10 = c10, i13.push(c10);
            else if (c10.getColSpan() > 1 || c10.getRowSpan() > 1) {
              Ae2(c10) || ke2(176);
              const e8 = Oe2(c10.__headerState);
              null !== t10 ? t10.insertAfter(e8) : $insertFirst(l8, e8);
            }
          }
        }
        for (const e7 of i13) e7.setColSpan(1), e7.setRowSpan(1);
      }
    });
  }
  function yn2(e5, t9 = true) {
    const n11 = /* @__PURE__ */ new Map(), o8 = (o9, r10, l8) => {
      const s7 = Ot5(o9, l8), i13 = $t4(o9, s7, e5, t9);
      n11.set(r10, [i13, s7]);
    }, r9 = e5.registerMutationListener(dn2, (t10) => {
      e5.getEditorState().read(() => {
        for (const [e6, r10] of t10) {
          const t11 = n11.get(e6);
          if ("created" === r10 || "updated" === r10) {
            const { tableNode: r11, tableElement: l8 } = xt6(e6);
            void 0 === t11 ? o8(r11, e6, l8) : l8 !== t11[1] && (t11[0].removeListeners(), n11.delete(e6), o8(r11, e6, l8));
          } else "destroyed" === r10 && void 0 !== t11 && (t11[0].removeListeners(), n11.delete(e6));
        }
      }, { editor: e5 });
    }, { skipInitialization: false });
    return () => {
      r9();
      for (const [, [e6]] of n11) e6.removeListeners();
    };
  }
  function Nn2(e5, t9) {
    e5.hasNodes([dn2]) || ke2(255);
    const { hasNestedTables: n11 = signal(false) } = t9 ?? {};
    return mergeRegister(e5.registerCommand(Ke2, (e6) => (function({ rows: e7, columns: t10, includeHeaders: n12 }, o8) {
      const r9 = $getSelection() || $getPreviousSelection();
      if (!r9 || !$isRangeSelection(r9)) return false;
      if (!o8 && Zt3(r9.anchor.getNode())) return false;
      const l8 = Be2(Number(e7), Number(t10), n12);
      $insertNodeToNearestRoot(l8);
      const s7 = l8.getFirstDescendant();
      return $isTextNode(s7) && s7.select(), true;
    })(e6, n11.peek()), COMMAND_PRIORITY_EDITOR), e5.registerCommand(SELECTION_INSERT_CLIPBOARD_NODES_COMMAND, ({ nodes: t10, selection: o8 }, r9) => {
      if (n11.peek() || e5 !== r9 || !$isRangeSelection(o8)) return false;
      return null !== Zt3(o8.anchor.getNode()) && t10.some(pn2);
    }, COMMAND_PRIORITY_EDITOR), e5.registerCommand(CLICK_COMMAND, wn2, COMMAND_PRIORITY_EDITOR), e5.registerNodeTransform(dn2, Sn2), e5.registerNodeTransform(Ee2, _n2), e5.registerNodeTransform(Te2, Cn2));
  }
  var vn2 = defineExtension({ build: (e5, t9, n11) => namedSignals(t9), config: safeCast({ hasCellBackgroundColor: true, hasCellMerge: true, hasHorizontalScroll: true, hasNestedTables: false, hasTabHandler: true }), name: "@lexical/table/Table", nodes: () => [dn2, Ee2, Te2], register(e5, t9, n11) {
    const o8 = n11.getOutput(), { hasNestedTables: r9 } = o8;
    return mergeRegister(effect(() => {
      const t10 = o8.hasHorizontalScroll.value;
      un2(e5) !== t10 && (hn2(e5, t10), e5.registerNodeTransform(dn2, () => {
      })());
    }), Nn2(e5, { hasNestedTables: r9 }), effect(() => yn2(e5, o8.hasTabHandler.value)), effect(() => o8.hasCellMerge.value ? void 0 : bn2(e5)), effect(() => o8.hasCellBackgroundColor.value ? void 0 : e5.registerNodeTransform(Te2, (e6) => {
      null !== e6.getBackgroundColor() && e6.setBackgroundColor(null);
    })));
  } });

  // node_modules/@lexical/table/LexicalTable.mjs
  var mod24 = false ? LexicalTable_dev_exports : LexicalTable_prod_exports;
  var $computeTableMap = mod24.$computeTableMap;
  var $computeTableMapSkipCellCheck = mod24.$computeTableMapSkipCellCheck;
  var $createTableCellNode = mod24.$createTableCellNode;
  var $createTableNode = mod24.$createTableNode;
  var $createTableNodeWithDimensions = mod24.$createTableNodeWithDimensions;
  var $createTableRowNode = mod24.$createTableRowNode;
  var $createTableSelection = mod24.$createTableSelection;
  var $createTableSelectionFrom = mod24.$createTableSelectionFrom;
  var $deleteTableColumn = mod24.$deleteTableColumn;
  var $deleteTableColumnAtSelection = mod24.$deleteTableColumnAtSelection;
  var $deleteTableColumn__EXPERIMENTAL = mod24.$deleteTableColumn__EXPERIMENTAL;
  var $deleteTableRowAtSelection = mod24.$deleteTableRowAtSelection;
  var $deleteTableRow__EXPERIMENTAL = mod24.$deleteTableRow__EXPERIMENTAL;
  var $findCellNode = mod24.$findCellNode;
  var $findTableNode = mod24.$findTableNode;
  var $getElementForTableNode = mod24.$getElementForTableNode;
  var $getNodeTriplet = mod24.$getNodeTriplet;
  var $getTableAndElementByKey = mod24.$getTableAndElementByKey;
  var $getTableCellNodeFromLexicalNode = mod24.$getTableCellNodeFromLexicalNode;
  var $getTableCellNodeRect = mod24.$getTableCellNodeRect;
  var $getTableColumnIndexFromTableCellNode = mod24.$getTableColumnIndexFromTableCellNode;
  var $getTableNodeFromLexicalNodeOrThrow = mod24.$getTableNodeFromLexicalNodeOrThrow;
  var $getTableRowIndexFromTableCellNode = mod24.$getTableRowIndexFromTableCellNode;
  var $getTableRowNodeFromTableCellNodeOrThrow = mod24.$getTableRowNodeFromTableCellNodeOrThrow;
  var $insertTableColumn = mod24.$insertTableColumn;
  var $insertTableColumnAtSelection = mod24.$insertTableColumnAtSelection;
  var $insertTableColumn__EXPERIMENTAL = mod24.$insertTableColumn__EXPERIMENTAL;
  var $insertTableRow = mod24.$insertTableRow;
  var $insertTableRowAtSelection = mod24.$insertTableRowAtSelection;
  var $insertTableRow__EXPERIMENTAL = mod24.$insertTableRow__EXPERIMENTAL;
  var $isScrollableTablesActive = mod24.$isScrollableTablesActive;
  var $isTableCellNode = mod24.$isTableCellNode;
  var $isTableNode = mod24.$isTableNode;
  var $isTableRowNode = mod24.$isTableRowNode;
  var $isTableSelection = mod24.$isTableSelection;
  var $mergeCells = mod24.$mergeCells;
  var $removeTableRowAtIndex = mod24.$removeTableRowAtIndex;
  var $unmergeCell = mod24.$unmergeCell;
  var INSERT_TABLE_COMMAND = mod24.INSERT_TABLE_COMMAND;
  var TableCellHeaderStates = mod24.TableCellHeaderStates;
  var TableCellNode = mod24.TableCellNode;
  var TableExtension = mod24.TableExtension;
  var TableNode = mod24.TableNode;
  var TableObserver = mod24.TableObserver;
  var TableRowNode = mod24.TableRowNode;
  var applyTableHandlers = mod24.applyTableHandlers;
  var getDOMCellFromTarget = mod24.getDOMCellFromTarget;
  var getTableElement = mod24.getTableElement;
  var getTableObserverFromTableElement = mod24.getTableObserverFromTableElement;
  var registerTableCellUnmergeTransform = mod24.registerTableCellUnmergeTransform;
  var registerTablePlugin = mod24.registerTablePlugin;
  var registerTableSelectionObserver = mod24.registerTableSelectionObserver;
  var setScrollableTablesActive = mod24.setScrollableTablesActive;

  // node_modules/@lexical/react/LexicalTablePlugin.prod.mjs
  var LexicalTablePlugin_prod_exports = {};
  __export(LexicalTablePlugin_prod_exports, {
    TablePlugin: () => u6
  });
  var import_react11 = __toESM(require_react(), 1);
  function u6({ hasCellMerge: u10 = true, hasCellBackgroundColor: f8 = true, hasTabHandler: d8 = true, hasHorizontalScroll: g5 = false, hasNestedTables: p7 = false }) {
    const [x7] = useLexicalComposerContext();
    (0, import_react11.useEffect)(() => {
      $isScrollableTablesActive(x7) !== g5 && (setScrollableTablesActive(x7, g5), x7.registerNodeTransform(TableNode, () => {
      })());
    }, [x7, g5]);
    const C5 = (0, import_react11.useMemo)(() => signal(false), []);
    return C5.peek() !== p7 && (C5.value = p7), (0, import_react11.useEffect)(() => registerTablePlugin(x7, { hasNestedTables: C5 }), [x7, C5]), (0, import_react11.useEffect)(() => registerTableSelectionObserver(x7, d8), [x7, d8]), (0, import_react11.useEffect)(() => {
      if (!u10) return registerTableCellUnmergeTransform(x7);
    }, [x7, u10]), (0, import_react11.useEffect)(() => {
      if (!f8) return x7.registerNodeTransform(TableCellNode, (e5) => {
        null !== e5.getBackgroundColor() && e5.setBackgroundColor(null);
      });
    }, [x7, f8, u10]), null;
  }

  // node_modules/@lexical/react/LexicalTablePlugin.mjs
  var mod25 = false ? LexicalTablePlugin_dev_exports : LexicalTablePlugin_prod_exports;
  var TablePlugin = mod25.TablePlugin;

  // node_modules/@lexical/react/useLexicalNodeSelection.prod.mjs
  var useLexicalNodeSelection_prod_exports = {};
  __export(useLexicalNodeSelection_prod_exports, {
    useLexicalNodeSelection: () => u7
  });
  init_Lexical();
  var import_react12 = __toESM(require_react(), 1);
  function d5(e5, t9) {
    return e5.getEditorState().read(() => {
      const e6 = $getNodeByKey(t9);
      return null !== e6 && e6.isSelected();
    });
  }
  function u7(c10) {
    const [u10] = useLexicalComposerContext(), [p7, s7] = (0, import_react12.useState)(() => d5(u10, c10));
    (0, import_react12.useEffect)(() => {
      let e5 = true;
      const t9 = u10.registerUpdateListener(() => {
        e5 && s7(d5(u10, c10));
      });
      return () => {
        e5 = false, t9();
      };
    }, [u10, c10]);
    return [p7, (0, import_react12.useCallback)((e5) => {
      u10.update(() => {
        let a10 = $getSelection();
        $isNodeSelection(a10) || (a10 = $createNodeSelection(), $setSelection(a10)), $isNodeSelection(a10) && (e5 ? a10.add(c10) : a10.delete(c10));
      });
    }, [u10, c10]), (0, import_react12.useCallback)(() => {
      u10.update(() => {
        const e5 = $getSelection();
        $isNodeSelection(e5) && e5.clear();
      });
    }, [u10])];
  }

  // node_modules/@lexical/react/useLexicalNodeSelection.mjs
  var mod26 = false ? useLexicalNodeSelection_dev_exports : useLexicalNodeSelection_prod_exports;
  var useLexicalNodeSelection = mod26.useLexicalNodeSelection;

  // node_modules/@lexical/react/LexicalHorizontalRuleNode.prod.mjs
  var LexicalHorizontalRuleNode_prod_exports = {};
  __export(LexicalHorizontalRuleNode_prod_exports, {
    $createHorizontalRuleNode: () => f5,
    $isHorizontalRuleNode: () => $isHorizontalRuleNode,
    HorizontalRuleNode: () => p4,
    INSERT_HORIZONTAL_RULE_COMMAND: () => INSERT_HORIZONTAL_RULE_COMMAND
  });
  init_Lexical();
  var import_react13 = __toESM(require_react(), 1);
  function u8({ nodeKey: e5 }) {
    const [l8] = useLexicalComposerContext(), [s7, u10, p7] = useLexicalNodeSelection(e5);
    return (0, import_react13.useEffect)(() => mergeRegister(l8.registerCommand(CLICK_COMMAND, (t9) => {
      const r9 = l8.getElementByKey(e5);
      return t9.target === r9 && (t9.shiftKey || p7(), u10(!s7), true);
    }, COMMAND_PRIORITY_LOW)), [p7, l8, s7, e5, u10]), (0, import_react13.useEffect)(() => {
      const t9 = l8.getElementByKey(e5), r9 = l8._config.theme.hrSelected ?? "selected";
      null !== t9 && (s7 ? addClassNamesToElement(t9, r9) : removeClassNamesFromElement(t9, r9));
    }, [l8, s7, e5]), null;
  }
  var p4 = class _p extends HorizontalRuleNode {
    static getType() {
      return "horizontalrule";
    }
    static clone(e5) {
      return new _p(e5.__key);
    }
    static importJSON(e5) {
      return f5().updateFromJSON(e5);
    }
    static importDOM() {
      return { hr: () => ({ conversion: x6, priority: 0 }) };
    }
    decorate() {
      return jsx(u8, { nodeKey: this.__key });
    }
  };
  function x6() {
    return { node: f5() };
  }
  function f5() {
    return $applyNodeReplacement(new p4());
  }

  // node_modules/@lexical/react/LexicalHorizontalRuleNode.mjs
  var mod27 = false ? LexicalHorizontalRuleNode_dev_exports : LexicalHorizontalRuleNode_prod_exports;
  var $createHorizontalRuleNode2 = mod27.$createHorizontalRuleNode;
  var $isHorizontalRuleNode2 = mod27.$isHorizontalRuleNode;
  var HorizontalRuleNode2 = mod27.HorizontalRuleNode;
  var INSERT_HORIZONTAL_RULE_COMMAND2 = mod27.INSERT_HORIZONTAL_RULE_COMMAND;

  // node_modules/@lexical/react/LexicalHorizontalRulePlugin.prod.mjs
  var LexicalHorizontalRulePlugin_prod_exports = {};
  __export(LexicalHorizontalRulePlugin_prod_exports, {
    HorizontalRulePlugin: () => n7
  });
  init_Lexical();
  var import_react14 = __toESM(require_react(), 1);
  function n7() {
    const [n11] = useLexicalComposerContext();
    return (0, import_react14.useEffect)(() => n11.registerCommand(INSERT_HORIZONTAL_RULE_COMMAND2, (o8) => {
      const r9 = $getSelection();
      if (!$isRangeSelection(r9)) return false;
      if (null !== r9.focus.getNode()) {
        const o9 = $createHorizontalRuleNode2();
        $insertNodeToNearestRoot(o9);
      }
      return true;
    }, COMMAND_PRIORITY_EDITOR), [n11]), null;
  }

  // node_modules/@lexical/react/LexicalHorizontalRulePlugin.mjs
  var mod28 = false ? LexicalHorizontalRulePlugin_dev_exports : LexicalHorizontalRulePlugin_prod_exports;
  var HorizontalRulePlugin = mod28.HorizontalRulePlugin;

  // node_modules/@lexical/react/LexicalTabIndentationPlugin.prod.mjs
  var LexicalTabIndentationPlugin_prod_exports = {};
  __export(LexicalTabIndentationPlugin_prod_exports, {
    TabIndentationPlugin: () => r6,
    registerTabIndentation: () => registerTabIndentation
  });
  var import_react15 = __toESM(require_react(), 1);
  function r6({ maxIndent: r9 }) {
    const [n11] = useLexicalComposerContext();
    return (0, import_react15.useEffect)(() => registerTabIndentation(n11, r9), [n11, r9]), null;
  }

  // node_modules/@lexical/react/LexicalTabIndentationPlugin.mjs
  var mod29 = false ? LexicalTabIndentationPlugin_dev_exports : LexicalTabIndentationPlugin_prod_exports;
  var TabIndentationPlugin = mod29.TabIndentationPlugin;
  var registerTabIndentation2 = mod29.registerTabIndentation;

  // node_modules/@lexical/code/LexicalCode.dev.mjs
  init_Lexical();
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
        for (var i13 = 0, l8 = tokens.length; i13 < l8; i13++) {
          var token = tokens[i13];
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
      for (var i13 = 0, l8 = env.classes.length; i13 < l8; i13++) {
        var cls = env.classes[i13];
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
      text = text.replace(/&(\w{1,8}|#x?[\da-f]{1,8});/gi, function(m9, code) {
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
          return m9;
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
    for (var i13 = 0; i13 < 2; i13++) {
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
      const style2 = this.getStyle();
      if (style2) {
        element.setAttribute("style", style2);
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
      const style2 = this.__style;
      const prevStyle = prevNode.__style;
      if (style2) {
        if (style2 !== prevStyle) {
          dom.setAttribute("style", style2);
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
      const style2 = this.getStyle();
      if (style2) {
        element.setAttribute("style", style2);
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
        const x7 = anchor.offset === 0 ? 0 : 1;
        const index = split.getIndexWithinParent() + x7;
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
  init_Lexical();
  var import_prismjs2 = __toESM(require_prism(), 1);
  function I5(t9, ...e5) {
    const n11 = new URL("https://lexical.dev/docs/error"), r9 = new URLSearchParams();
    r9.append("code", t9);
    for (const t10 of e5) r9.append("v", t10);
    throw n11.search = r9.toString(), Error(`Minified Lexical error #${t9}; visit ${n11.toString()} for the full message or use the non-minified dev environment for full errors and additional helpful warnings.`);
  }
  var M5 = "javascript";
  var J8 = () => M5;
  function R6(e5, n11) {
    for (const r9 of e5.childNodes) {
      if (isHTMLElement2(r9) && r9.tagName === n11) return true;
      R6(r9, n11);
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
    static clone(t9) {
      return new _q(t9.__language, t9.__key);
    }
    constructor(t9, e5) {
      super(e5), this.__language = t9 || void 0, this.__isSyntaxHighlightSupported = false, this.__theme = void 0;
    }
    afterCloneFrom(t9) {
      super.afterCloneFrom(t9), this.__language = t9.__language, this.__theme = t9.__theme, this.__isSyntaxHighlightSupported = t9.__isSyntaxHighlightSupported;
    }
    createDOM(t9) {
      const n11 = document.createElement("code");
      addClassNamesToElement(n11, t9.theme.code), n11.setAttribute("spellcheck", "false");
      const r9 = this.getLanguage();
      r9 && (n11.setAttribute(K6, r9), this.getIsSyntaxHighlightSupported() && n11.setAttribute($6, r9));
      const i13 = this.getTheme();
      i13 && n11.setAttribute(W7, i13);
      const o8 = this.getStyle();
      return o8 && n11.setAttribute("style", o8), n11;
    }
    updateDOM(t9, e5, n11) {
      const r9 = this.__language, i13 = t9.__language;
      r9 ? r9 !== i13 && e5.setAttribute(K6, r9) : i13 && e5.removeAttribute(K6);
      const o8 = this.__isSyntaxHighlightSupported;
      t9.__isSyntaxHighlightSupported && i13 ? o8 && r9 ? r9 !== i13 && e5.setAttribute($6, r9) : e5.removeAttribute($6) : o8 && r9 && e5.setAttribute($6, r9);
      const s7 = this.__theme, l8 = t9.__theme;
      s7 ? s7 !== l8 && e5.setAttribute(W7, s7) : l8 && e5.removeAttribute(W7);
      const u10 = this.__style, c10 = t9.__style;
      return u10 ? u10 !== c10 && e5.setAttribute("style", u10) : c10 && e5.removeAttribute("style"), false;
    }
    exportDOM(t9) {
      const n11 = document.createElement("pre");
      addClassNamesToElement(n11, t9._config.theme.code), n11.setAttribute("spellcheck", "false");
      const r9 = this.getLanguage();
      r9 && (n11.setAttribute(K6, r9), this.getIsSyntaxHighlightSupported() && n11.setAttribute($6, r9));
      const i13 = this.getTheme();
      i13 && n11.setAttribute(W7, i13);
      const o8 = this.getStyle();
      return o8 && n11.setAttribute("style", o8), { element: n11 };
    }
    static importDOM() {
      return { code: (t9) => null != t9.textContent && (/\r?\n/.test(t9.textContent) || R6(t9, "BR")) ? { conversion: Q7, priority: 1 } : null, div: () => ({ conversion: G7, priority: 1 }), pre: () => ({ conversion: Q7, priority: 0 }), table: (t9) => tt7(t9) ? { conversion: V7, priority: 3 } : null, td: (t9) => {
        const e5 = t9, n11 = e5.closest("table");
        return e5.classList.contains("js-file-line") || n11 && tt7(n11) ? { conversion: Y7, priority: 3 } : null;
      }, tr: (t9) => {
        const e5 = t9.closest("table");
        return e5 && tt7(e5) ? { conversion: Y7, priority: 3 } : null;
      } };
    }
    static importJSON(t9) {
      return U5().updateFromJSON(t9);
    }
    updateFromJSON(t9) {
      return super.updateFromJSON(t9).setLanguage(t9.language).setTheme(t9.theme);
    }
    exportJSON() {
      return { ...super.exportJSON(), language: this.getLanguage(), theme: this.getTheme() };
    }
    insertNewAfter(t9, e5 = true) {
      const n11 = this.getChildren(), r9 = n11.length;
      if (r9 >= 2 && "\n" === n11[r9 - 1].getTextContent() && "\n" === n11[r9 - 2].getTextContent() && t9.isCollapsed() && t9.anchor.key === this.__key && t9.anchor.offset === r9) {
        n11[r9 - 1].remove(), n11[r9 - 2].remove();
        const t10 = $createParagraphNode();
        return this.insertAfter(t10, e5), t10;
      }
      const { anchor: i13, focus: o8 } = t9, a10 = (i13.isBefore(o8) ? i13 : o8).getNode();
      if ($isTextNode(a10)) {
        let t10 = st7(a10);
        const e6 = [];
        for (; ; ) if ($isTabNode(t10)) e6.push($createTabNode()), t10 = t10.getNextSibling();
        else {
          if (!it7(t10)) break;
          {
            let n13 = 0;
            const r11 = t10.getTextContent(), i14 = t10.getTextContentSize();
            for (; n13 < i14 && " " === r11[n13]; ) n13++;
            if (0 !== n13 && e6.push(rt7(" ".repeat(n13))), n13 !== i14) break;
            t10 = t10.getNextSibling();
          }
        }
        const n12 = a10.splitText(i13.offset)[0], r10 = 0 === i13.offset ? 0 : 1, o9 = n12.getIndexWithinParent() + r10, s7 = a10.getParentOrThrow(), l8 = [$createLineBreakNode(), ...e6];
        s7.splice(o9, 0, l8);
        const f8 = e6[e6.length - 1];
        f8 ? f8.select() : 0 === i13.offset ? n12.selectPrevious() : n12.getNextSibling().selectNext(0, 0);
      }
      if (X7(a10)) {
        const { offset: e6 } = t9.anchor;
        a10.splice(e6, 0, [$createLineBreakNode()]), a10.select(e6 + 1, e6 + 1);
      }
      return null;
    }
    canIndent() {
      return false;
    }
    collapseAtStart() {
      const t9 = $createParagraphNode();
      return this.getChildren().forEach((e5) => t9.append(e5)), this.replace(t9), true;
    }
    setLanguage(t9) {
      const e5 = this.getWritable();
      return e5.__language = t9 || void 0, e5;
    }
    getLanguage() {
      return this.getLatest().__language;
    }
    setIsSyntaxHighlightSupported(t9) {
      const e5 = this.getWritable();
      return e5.__isSyntaxHighlightSupported = t9, e5;
    }
    getIsSyntaxHighlightSupported() {
      return this.getLatest().__isSyntaxHighlightSupported;
    }
    setTheme(t9) {
      const e5 = this.getWritable();
      return e5.__theme = t9 || void 0, e5;
    }
    getTheme() {
      return this.getLatest().__theme;
    }
  };
  function U5(t9, e5) {
    return $create(q7).setLanguage(t9).setTheme(e5);
  }
  function X7(t9) {
    return t9 instanceof q7;
  }
  function Q7(t9) {
    return { node: U5(t9.getAttribute(K6)) };
  }
  function G7(t9) {
    const e5 = t9, n11 = Z7(e5);
    return n11 || (function(t10) {
      let e6 = t10.parentElement;
      for (; null !== e6; ) {
        if (Z7(e6)) return true;
        e6 = e6.parentElement;
      }
      return false;
    })(e5) ? { node: n11 ? U5() : null } : { node: null };
  }
  function V7() {
    return { node: U5() };
  }
  function Y7() {
    return { node: null };
  }
  function Z7(t9) {
    return null !== t9.style.fontFamily.match("monospace");
  }
  function tt7(t9) {
    return t9.classList.contains("js-file-line-container");
  }
  var et7 = class _et extends TextNode {
    __highlightType;
    constructor(t9 = "", e5, n11) {
      super(t9, n11), this.__highlightType = e5;
    }
    static getType() {
      return "code-highlight";
    }
    static clone(t9) {
      return new _et(t9.__text, t9.__highlightType || void 0, t9.__key);
    }
    getHighlightType() {
      return this.getLatest().__highlightType;
    }
    setHighlightType(t9) {
      const e5 = this.getWritable();
      return e5.__highlightType = t9 || void 0, e5;
    }
    canHaveFormat() {
      return false;
    }
    createDOM(t9) {
      const n11 = super.createDOM(t9), r9 = nt7(t9.theme, this.__highlightType);
      return addClassNamesToElement(n11, r9), n11;
    }
    updateDOM(t9, r9, i13) {
      const o8 = super.updateDOM(t9, r9, i13), s7 = nt7(i13.theme, t9.__highlightType), l8 = nt7(i13.theme, this.__highlightType);
      return s7 !== l8 && (s7 && removeClassNamesFromElement(r9, s7), l8 && addClassNamesToElement(r9, l8)), o8;
    }
    static importJSON(t9) {
      return rt7().updateFromJSON(t9);
    }
    updateFromJSON(t9) {
      return super.updateFromJSON(t9).setHighlightType(t9.highlightType);
    }
    exportJSON() {
      return { ...super.exportJSON(), highlightType: this.getHighlightType() };
    }
    setFormat(t9) {
      return this;
    }
    isParentRequired() {
      return true;
    }
    createParentElementNode() {
      return U5();
    }
  };
  function nt7(t9, e5) {
    return e5 && t9 && t9.codeHighlight && t9.codeHighlight[e5];
  }
  function rt7(t9 = "", e5) {
    return $applyNodeReplacement(new et7(t9, e5));
  }
  function it7(t9) {
    return t9 instanceof et7;
  }
  function ot7(t9, e5) {
    let n11 = t9;
    for (let i13 = $getSiblingCaret(t9, e5); i13 && (it7(i13.origin) || $isTabNode(i13.origin)); i13 = $getAdjacentCaret(i13)) n11 = i13.origin;
    return n11;
  }
  function st7(t9) {
    return ot7(t9, "previous");
  }
  function lt7(t9) {
    return ot7(t9, "next");
  }
  function ut6(t9) {
    const e5 = st7(t9), n11 = lt7(t9);
    let r9 = e5;
    for (; null !== r9; ) {
      if (it7(r9)) {
        const t10 = getTextDirection(r9.getTextContent());
        if (null !== t10) return t10;
      }
      if (r9 === n11) break;
      r9 = r9.getNextSibling();
    }
    const i13 = e5.getParent();
    if ($isElementNode(i13)) {
      const t10 = i13.getDirection();
      if ("ltr" === t10 || "rtl" === t10) return t10;
    }
    return null;
  }
  function ct6(t9, e5) {
    let n11 = null, r9 = null, i13 = t9, o8 = e5, s7 = t9.getTextContent();
    for (; ; ) {
      if (0 === o8) {
        if (i13 = i13.getPreviousSibling(), null === i13) break;
        if (it7(i13) || $isTabNode(i13) || $isLineBreakNode(i13) || I5(167), $isLineBreakNode(i13)) {
          n11 = { node: i13, offset: 1 };
          break;
        }
        o8 = Math.max(0, i13.getTextContentSize() - 1), s7 = i13.getTextContent();
      } else o8--;
      const t10 = s7[o8];
      it7(i13) && " " !== t10 && (r9 = { node: i13, offset: o8 });
    }
    if (null !== r9) return r9;
    let l8 = null;
    if (e5 < t9.getTextContentSize()) it7(t9) && (l8 = t9.getTextContent()[e5]);
    else {
      const e6 = t9.getNextSibling();
      it7(e6) && (l8 = e6.getTextContent()[0]);
    }
    if (null !== l8 && " " !== l8) return n11;
    {
      const r10 = (function(t10, e6) {
        let n12 = t10, r11 = e6, i14 = t10.getTextContent(), o9 = t10.getTextContentSize();
        for (; ; ) {
          if (!it7(n12) || r11 === o9) {
            if (n12 = n12.getNextSibling(), null === n12 || $isLineBreakNode(n12)) return null;
            it7(n12) && (r11 = 0, i14 = n12.getTextContent(), o9 = n12.getTextContentSize());
          }
          if (it7(n12)) {
            if (" " !== i14[r11]) return { node: n12, offset: r11 };
            r11++;
          }
        }
      })(t9, e5);
      return null !== r10 ? r10 : n11;
    }
  }
  function gt7(t9) {
    const e5 = lt7(t9);
    return $isLineBreakNode(e5) && I5(168), e5;
  }
  var at6 = defineExtension({ name: "@lexical/code", nodes: () => [q7, et7] });
  !(function(t9) {
    t9.languages.diff = { coord: [/^(?:\*{3}|-{3}|\+{3}).*$/m, /^@@.*@@$/m, /^\d.*$/m] };
    var e5 = { "deleted-sign": "-", "deleted-arrow": "<", "inserted-sign": "+", "inserted-arrow": ">", unchanged: " ", diff: "!" };
    Object.keys(e5).forEach(function(n11) {
      var r9 = e5[n11], i13 = [];
      /^\w+$/.test(n11) || i13.push(/\w+/.exec(n11)[0]), "diff" === n11 && i13.push("bold"), t9.languages.diff[n11] = { pattern: RegExp("^(?:[" + r9 + "].*(?:\r\n?|\n|(?![\\s\\S])))+", "m"), alias: i13, inside: { line: { pattern: /(.)(?=[\s\S]).*(?:\r\n?|\n)?/, lookbehind: true }, prefix: { pattern: /[\s\S]/, alias: /\w+/.exec(n11)[0] } } };
    }), Object.defineProperty(t9.languages.diff, "PREFIXES", { value: e5 });
  })(Prism);
  var ft6 = globalThis.Prism || window.Prism;
  var pt7 = { c: "C", clike: "C-like", cpp: "C++", css: "CSS", html: "HTML", java: "Java", js: "JavaScript", markdown: "Markdown", objc: "Objective-C", plain: "Plain Text", powershell: "PowerShell", py: "Python", rust: "Rust", sql: "SQL", swift: "Swift", typescript: "TypeScript", xml: "XML" };
  var ht7 = { cpp: "cpp", java: "java", javascript: "js", md: "markdown", plaintext: "plain", python: "py", text: "plain", ts: "typescript" };
  function dt6(t9) {
    return ht7[t9] || t9;
  }
  function mt6(t9) {
    const e5 = dt6(t9);
    return pt7[e5] || e5;
  }
  var yt7 = () => Object.keys(ft6.languages).filter((t9) => "function" != typeof ft6.languages[t9]).sort();
  function xt7() {
    const t9 = [];
    for (const [e5, n11] of Object.entries(pt7)) t9.push([e5, n11]);
    return t9;
  }
  function _t7() {
    return [];
  }
  function St7(t9) {
    return "string" == typeof t9 ? t9 : Array.isArray(t9) ? t9.map(St7).join("") : St7(t9.content);
  }
  function vt7(t9, e5) {
    const n11 = /^diff-([\w-]+)/i.exec(e5), r9 = t9.getTextContent();
    let i13 = ft6.tokenize(r9, ft6.languages[n11 ? "diff" : e5]);
    return n11 && (i13 = (function(t10, e6) {
      const n12 = e6, r10 = ft6.languages[n12], i14 = { tokens: t10 }, o8 = ft6.languages.diff.PREFIXES;
      for (const t11 of i14.tokens) {
        if ("string" == typeof t11 || !(t11.type in o8) || !Array.isArray(t11.content)) continue;
        const e7 = t11.type;
        let n13 = 0;
        const i15 = () => (n13++, new ft6.Token("prefix", o8[e7], e7.replace(/^(\w+).*/, "$1"))), s7 = t11.content.filter((t12) => "string" == typeof t12 || "prefix" !== t12.type), l8 = t11.content.length - s7.length, u10 = ft6.tokenize(St7(s7), r10);
        u10.unshift(i15());
        const c10 = /\r\n|\n/g, g5 = (t12) => {
          const e8 = [];
          c10.lastIndex = 0;
          let r11, o9 = 0;
          for (; n13 < l8 && (r11 = c10.exec(t12)); ) {
            const n14 = r11.index + r11[0].length;
            e8.push(t12.slice(o9, n14)), o9 = n14, e8.push(i15());
          }
          if (0 !== e8.length) return o9 < t12.length && e8.push(t12.slice(o9)), e8;
        }, a10 = (t12) => {
          for (let e8 = 0; e8 < t12.length && n13 < l8; e8++) {
            const n14 = t12[e8];
            if ("string" == typeof n14) {
              const r11 = g5(n14);
              r11 && (t12.splice(e8, 1, ...r11), e8 += r11.length - 1);
            } else if ("string" == typeof n14.content) {
              const t13 = g5(n14.content);
              t13 && (n14.content = t13);
            } else Array.isArray(n14.content) ? a10(n14.content) : a10([n14.content]);
          }
        };
        a10(u10), n13 < l8 && u10.push(i15()), t11.content = u10;
      }
      return i14.tokens;
    })(i13, n11[1])), Tt7(i13);
  }
  function Tt7(t9, e5) {
    const n11 = [];
    for (const r9 of t9) if ("string" == typeof r9) {
      const t10 = r9.split(/(\n|\t)/), i13 = t10.length;
      for (let r10 = 0; r10 < i13; r10++) {
        const i14 = t10[r10];
        "\n" === i14 || "\r\n" === i14 ? n11.push($createLineBreakNode()) : "	" === i14 ? n11.push($createTabNode()) : i14.length > 0 && n11.push(rt7(i14, e5));
      }
    } else {
      const { content: t10, alias: e6 } = r9;
      "string" == typeof t10 ? n11.push(...Tt7([t10], "prefix" === r9.type && "string" == typeof e6 ? e6 : r9.type)) : Array.isArray(t10) && n11.push(...Tt7(t10, "unchanged" === r9.type ? void 0 : r9.type));
    }
    return n11;
  }
  var bt7 = { $tokenize(t9, e5) {
    return vt7(t9, e5 || this.defaultLanguage);
  }, defaultLanguage: M5, tokenize(t9, e5) {
    return ft6.tokenize(t9, ft6.languages[e5 || ""] || ft6.languages[this.defaultLanguage]);
  } };
  function Ct7(t9, e5, n11) {
    const r9 = t9.getParent();
    X7(r9) ? wt6(r9, e5, n11) : it7(t9) && t9.replace($createTextNode(t9.__text));
  }
  function Nt7(t9, e5) {
    const n11 = e5.getElementByKey(t9.getKey());
    if (null === n11) return;
    const r9 = t9.getChildren(), i13 = r9.length;
    if (i13 === n11.__cachedChildrenLength) return;
    n11.__cachedChildrenLength = i13;
    let o8 = "1", s7 = 1;
    for (let t10 = 0; t10 < i13; t10++) $isLineBreakNode(r9[t10]) && (o8 += "\n" + ++s7);
    n11.setAttribute("data-gutter", o8);
  }
  var jt5 = /* @__PURE__ */ new Set();
  function wt6(t9, e5, n11) {
    const r9 = t9.getKey(), i13 = e5.getKey() + "/" + r9;
    void 0 === t9.getLanguage() && t9.setLanguage(n11.defaultLanguage);
    const o8 = t9.getLanguage() || n11.defaultLanguage;
    if (!(function(t10) {
      const e6 = (function(t11) {
        const e7 = /^diff-([\w-]+)/i.exec(t11);
        return e7 ? e7[1] : null;
      })(t10), n12 = e6 || t10;
      try {
        return !!n12 && ft6.languages.hasOwnProperty(n12);
      } catch (t11) {
        return false;
      }
    })(o8)) return t9.getIsSyntaxHighlightSupported() && t9.setIsSyntaxHighlightSupported(false), void (async function() {
    })();
    t9.getIsSyntaxHighlightSupported() || t9.setIsSyntaxHighlightSupported(true), jt5.has(i13) || (jt5.add(i13), e5.update(() => {
      !(function(t10, e6) {
        const n12 = $getNodeByKey(t10);
        if (!X7(n12) || !n12.isAttached()) return;
        const r10 = $getSelection();
        if (!$isRangeSelection(r10)) return void e6();
        const i14 = r10.anchor, o9 = i14.offset, s7 = "element" === i14.type && $isLineBreakNode(n12.getChildAtIndex(i14.offset - 1));
        let u10 = 0;
        if (!s7) {
          const t11 = i14.getNode();
          u10 = o9 + t11.getPreviousSiblings().reduce((t12, e7) => t12 + e7.getTextContentSize(), 0);
        }
        if (!e6()) return;
        if (s7) return void i14.getNode().select(o9, o9);
        n12.getChildren().some((t11) => {
          const e7 = $isTextNode(t11);
          if (e7 || $isLineBreakNode(t11)) {
            const n13 = t11.getTextContentSize();
            if (e7 && n13 >= u10) return t11.select(u10, u10), true;
            u10 -= n13;
          }
          return false;
        });
      })(r9, () => {
        const e6 = $getNodeByKey(r9);
        if (!X7(e6) || !e6.isAttached()) return false;
        const i14 = e6.getLanguage() || n11.defaultLanguage, o9 = n11.$tokenize(e6, i14), s7 = (function(t10, e7) {
          let n12 = 0;
          for (; n12 < t10.length && kt7(t10[n12], e7[n12]); ) n12++;
          const r10 = t10.length, i15 = e7.length, o10 = Math.min(r10, i15) - n12;
          let s8 = 0;
          for (; s8 < o10; ) if (s8++, !kt7(t10[r10 - s8], e7[i15 - s8])) {
            s8--;
            break;
          }
          const l9 = n12, u11 = r10 - s8, c11 = e7.slice(n12, i15 - s8);
          return { from: l9, nodesForReplacement: c11, to: u11 };
        })(e6.getChildren(), o9), { from: l8, to: u10, nodesForReplacement: c10 } = s7;
        return !(l8 === u10 && !c10.length) && (t9.splice(l8, u10 - l8, c10), true);
      });
    }, { onUpdate: () => {
      jt5.delete(i13);
    }, skipTransforms: true }));
  }
  function kt7(t9, e5) {
    return it7(t9) && it7(e5) && t9.__text === e5.__text && t9.__highlightType === e5.__highlightType || $isTabNode(t9) && $isTabNode(e5) || $isLineBreakNode(t9) && $isLineBreakNode(e5);
  }
  function At7(t9) {
    if (!$isRangeSelection(t9)) return false;
    const e5 = t9.anchor.getNode(), n11 = X7(e5) ? e5 : e5.getParent(), r9 = t9.focus.getNode(), i13 = X7(r9) ? r9 : r9.getParent();
    return X7(n11) && n11.is(i13);
  }
  function Pt7(t9) {
    const e5 = t9.getNodes(), n11 = [];
    if (1 === e5.length && X7(e5[0])) return n11;
    let r9 = [];
    for (let t10 = 0; t10 < e5.length; t10++) {
      const i13 = e5[t10];
      it7(i13) || $isTabNode(i13) || $isLineBreakNode(i13) || I5(169), $isLineBreakNode(i13) ? r9.length > 0 && (n11.push(r9), r9 = []) : r9.push(i13);
    }
    if (r9.length > 0) {
      const e6 = t9.isBackward() ? t9.anchor : t9.focus, i13 = $createPoint(r9[0].getKey(), 0, "text");
      e6.is(i13) || n11.push(r9);
    }
    return n11;
  }
  function Lt6(t9) {
    const e5 = $getSelection();
    if (!$isRangeSelection(e5) || !At7(e5)) return false;
    const n11 = Pt7(e5), r9 = n11.length;
    if (0 === r9 && e5.isCollapsed()) return t9 === INDENT_CONTENT_COMMAND && e5.insertNodes([$createTabNode()]), true;
    if (0 === r9 && t9 === INDENT_CONTENT_COMMAND && "\n" === e5.getTextContent()) {
      const t10 = $createTabNode(), n12 = $createLineBreakNode(), r10 = e5.isBackward() ? "previous" : "next";
      return e5.insertNodes([t10, n12]), $setSelectionFromCaretRange($getCaretRangeInDirection($getCaretRange($getTextPointCaret(t10, "next", 0), $normalizeCaret($getSiblingCaret(n12, "next"))), r10)), true;
    }
    for (let i13 = 0; i13 < r9; i13++) {
      const r10 = n11[i13];
      if (r10.length > 0) {
        let n12 = r10[0];
        if (0 === i13 && (n12 = st7(n12)), t9 === INDENT_CONTENT_COMMAND) {
          const t10 = $createTabNode();
          if (n12.insertBefore(t10), 0 === i13) {
            const r11 = e5.isBackward() ? "focus" : "anchor", i14 = $createPoint(n12.getKey(), 0, "text");
            e5[r11].is(i14) && e5[r11].set(t10.getKey(), 0, "text");
          }
        } else $isTabNode(n12) && n12.remove();
      }
    }
    return true;
  }
  function Ot6(t9, e5) {
    const n11 = $getSelection();
    if (!$isRangeSelection(n11)) return false;
    const { anchor: r9, focus: i13 } = n11, o8 = r9.offset, s7 = i13.offset, l8 = r9.getNode(), c10 = i13.getNode(), g5 = t9 === KEY_ARROW_UP_COMMAND;
    if (!At7(n11) || !it7(l8) && !$isTabNode(l8) || !it7(c10) && !$isTabNode(c10)) return false;
    if (!e5.altKey) {
      if (n11.isCollapsed()) {
        const t10 = l8.getParentOrThrow();
        if (g5 && 0 === o8 && null === l8.getPreviousSibling()) {
          if (null === t10.getPreviousSibling()) return t10.selectPrevious(), e5.preventDefault(), true;
        } else if (!g5 && o8 === l8.getTextContentSize() && null === l8.getNextSibling()) {
          if (null === t10.getNextSibling()) return t10.selectNext(), e5.preventDefault(), true;
        }
      }
      return false;
    }
    let a10, f8;
    if (l8.isBefore(c10) ? (a10 = st7(l8), f8 = lt7(c10)) : (a10 = st7(c10), f8 = lt7(l8)), null == a10 || null == f8) return false;
    const p7 = a10.getNodesBetween(f8);
    for (let t10 = 0; t10 < p7.length; t10++) {
      const e6 = p7[t10];
      if (!it7(e6) && !$isTabNode(e6) && !$isLineBreakNode(e6)) return false;
    }
    e5.preventDefault(), e5.stopPropagation();
    const h3 = g5 ? a10.getPreviousSibling() : f8.getNextSibling();
    if (!$isLineBreakNode(h3)) return true;
    const d8 = g5 ? h3.getPreviousSibling() : h3.getNextSibling();
    if (null == d8) return true;
    const m9 = it7(d8) || $isTabNode(d8) || $isLineBreakNode(d8) ? g5 ? st7(d8) : lt7(d8) : null;
    let x7 = null != m9 ? m9 : d8;
    return h3.remove(), p7.forEach((t10) => t10.remove()), t9 === KEY_ARROW_UP_COMMAND ? (p7.forEach((t10) => x7.insertBefore(t10)), x7.insertBefore(h3)) : (x7.insertAfter(h3), x7 = h3, p7.forEach((t10) => {
      x7.insertAfter(t10), x7 = t10;
    })), n11.setTextNodeRange(l8, o8, c10, s7), true;
  }
  function Ht5(t9, e5) {
    const n11 = $getSelection();
    if (!$isRangeSelection(n11)) return false;
    const { anchor: r9, focus: i13 } = n11, o8 = r9.getNode(), s7 = i13.getNode(), l8 = t9 === MOVE_TO_START;
    if (!At7(n11) || !it7(o8) && !$isTabNode(o8) || !it7(s7) && !$isTabNode(s7)) return false;
    const c10 = s7;
    if ("rtl" === ut6(c10) ? !l8 : l8) {
      const t10 = ct6(c10, i13.offset);
      if (null !== t10) {
        const { node: e6, offset: r10 } = t10;
        $isLineBreakNode(e6) ? e6.selectNext(0, 0) : n11.setTextNodeRange(e6, r10, e6, r10);
      } else c10.getParentOrThrow().selectStart();
    } else {
      gt7(c10).select();
    }
    return e5.preventDefault(), e5.stopPropagation(), true;
  }
  function Et6(t9, e5) {
    if (!t9.hasNodes([q7, et7])) throw new Error("CodeHighlightPlugin: CodeNode or CodeHighlightNode not registered on editor");
    null == e5 && (e5 = bt7);
    const n11 = [];
    return true !== t9._headless && n11.push(t9.registerMutationListener(q7, (e6) => {
      t9.getEditorState().read(() => {
        for (const [n12, r9] of e6) if ("destroyed" !== r9) {
          const e7 = $getNodeByKey(n12);
          null !== e7 && Nt7(e7, t9);
        }
      });
    }, { skipInitialization: false })), n11.push(t9.registerNodeTransform(q7, (n12) => wt6(n12, t9, e5)), t9.registerNodeTransform(TextNode, (n12) => Ct7(n12, t9, e5)), t9.registerNodeTransform(et7, (n12) => Ct7(n12, t9, e5)), t9.registerCommand(KEY_TAB_COMMAND, (e6) => {
      const n12 = (function(t10) {
        const e7 = $getSelection();
        if (!$isRangeSelection(e7) || !At7(e7)) return null;
        const n13 = t10 ? OUTDENT_CONTENT_COMMAND : INDENT_CONTENT_COMMAND, r9 = t10 ? OUTDENT_CONTENT_COMMAND : INSERT_TAB_COMMAND, i13 = e7.anchor, o8 = e7.focus;
        if (i13.is(o8)) return r9;
        const s7 = Pt7(e7);
        if (1 !== s7.length) return n13;
        const l8 = s7[0];
        let u10, c10;
        0 === l8.length && I5(285), e7.isBackward() ? (u10 = o8, c10 = i13) : (u10 = i13, c10 = o8);
        const g5 = st7(l8[0]), a10 = lt7(l8[0]), f8 = $createPoint(g5.getKey(), 0, "text"), p7 = $createPoint(a10.getKey(), a10.getTextContentSize(), "text");
        return u10.isBefore(f8) || p7.isBefore(c10) ? n13 : f8.isBefore(u10) || c10.isBefore(p7) ? r9 : n13;
      })(e6.shiftKey);
      return null !== n12 && (e6.preventDefault(), t9.dispatchCommand(n12, void 0), true);
    }, COMMAND_PRIORITY_LOW), t9.registerCommand(INSERT_TAB_COMMAND, () => !!At7($getSelection()) && ($insertNodes([$createTabNode()]), true), COMMAND_PRIORITY_LOW), t9.registerCommand(INDENT_CONTENT_COMMAND, (t10) => Lt6(INDENT_CONTENT_COMMAND), COMMAND_PRIORITY_LOW), t9.registerCommand(OUTDENT_CONTENT_COMMAND, (t10) => Lt6(OUTDENT_CONTENT_COMMAND), COMMAND_PRIORITY_LOW), t9.registerCommand(KEY_ARROW_UP_COMMAND, (t10) => {
      const e6 = $getSelection();
      if (!$isRangeSelection(e6)) return false;
      const { anchor: n12 } = e6, r9 = n12.getNode();
      return !!At7(e6) && (e6.isCollapsed() && 0 === n12.offset && null === r9.getPreviousSibling() && X7(r9.getParentOrThrow()) ? (t10.preventDefault(), true) : Ot6(KEY_ARROW_UP_COMMAND, t10));
    }, COMMAND_PRIORITY_LOW), t9.registerCommand(KEY_ARROW_DOWN_COMMAND, (t10) => {
      const e6 = $getSelection();
      if (!$isRangeSelection(e6)) return false;
      const { anchor: n12 } = e6, r9 = n12.getNode();
      return !!At7(e6) && (e6.isCollapsed() && n12.offset === r9.getTextContentSize() && null === r9.getNextSibling() && X7(r9.getParentOrThrow()) ? (t10.preventDefault(), true) : Ot6(KEY_ARROW_DOWN_COMMAND, t10));
    }, COMMAND_PRIORITY_LOW), t9.registerCommand(MOVE_TO_START, (t10) => Ht5(MOVE_TO_START, t10), COMMAND_PRIORITY_LOW), t9.registerCommand(MOVE_TO_END, (t10) => Ht5(MOVE_TO_END, t10), COMMAND_PRIORITY_LOW)), mergeRegister(...n11);
  }
  var zt4 = st7;
  var Bt5 = lt7;
  var Dt6 = gt7;
  var Ft6 = ct6;

  // node_modules/@lexical/code/LexicalCode.mjs
  var mod30 = false ? LexicalCode_dev_exports : LexicalCode_prod_exports;
  var $createCodeHighlightNode2 = mod30.$createCodeHighlightNode;
  var $createCodeNode2 = mod30.$createCodeNode;
  var $getCodeLineDirection = mod30.$getCodeLineDirection;
  var $getEndOfCodeInLine = mod30.$getEndOfCodeInLine;
  var $getFirstCodeNodeOfLine2 = mod30.$getFirstCodeNodeOfLine;
  var $getLastCodeNodeOfLine = mod30.$getLastCodeNodeOfLine;
  var $getStartOfCodeInLine = mod30.$getStartOfCodeInLine;
  var $isCodeHighlightNode2 = mod30.$isCodeHighlightNode;
  var $isCodeNode2 = mod30.$isCodeNode;
  var CODE_LANGUAGE_FRIENDLY_NAME_MAP = mod30.CODE_LANGUAGE_FRIENDLY_NAME_MAP;
  var CODE_LANGUAGE_MAP = mod30.CODE_LANGUAGE_MAP;
  var CodeExtension2 = mod30.CodeExtension;
  var CodeHighlightNode2 = mod30.CodeHighlightNode;
  var CodeNode2 = mod30.CodeNode;
  var DEFAULT_CODE_LANGUAGE = mod30.DEFAULT_CODE_LANGUAGE;
  var PrismTokenizer = mod30.PrismTokenizer;
  var getCodeLanguageOptions = mod30.getCodeLanguageOptions;
  var getCodeLanguages = mod30.getCodeLanguages;
  var getCodeThemeOptions = mod30.getCodeThemeOptions;
  var getDefaultCodeLanguage = mod30.getDefaultCodeLanguage;
  var getEndOfCodeInLine = mod30.getEndOfCodeInLine;
  var getFirstCodeNodeOfLine = mod30.getFirstCodeNodeOfLine;
  var getLanguageFriendlyName = mod30.getLanguageFriendlyName;
  var getLastCodeNodeOfLine = mod30.getLastCodeNodeOfLine;
  var getStartOfCodeInLine = mod30.getStartOfCodeInLine;
  var normalizeCodeLang = mod30.normalizeCodeLang;
  var normalizeCodeLanguage = mod30.normalizeCodeLanguage;
  var registerCodeHighlighting = mod30.registerCodeHighlighting;

  // node_modules/@lexical/markdown/LexicalMarkdown.prod.mjs
  var LexicalMarkdown_prod_exports = {};
  __export(LexicalMarkdown_prod_exports, {
    $convertFromMarkdownString: () => Ot7,
    $convertToMarkdownString: () => qt4,
    BOLD_ITALIC_STAR: () => It5,
    BOLD_ITALIC_UNDERSCORE: () => wt7,
    BOLD_STAR: () => Nt8,
    BOLD_UNDERSCORE: () => kt8,
    CHECK_LIST: () => vt8,
    CODE: () => yt8,
    ELEMENT_TRANSFORMERS: () => Bt6,
    HEADING: () => Et7,
    HIGHLIGHT: () => Ft7,
    INLINE_CODE: () => bt8,
    ITALIC_STAR: () => Lt7,
    ITALIC_UNDERSCORE: () => _t8,
    LINK: () => Pt8,
    MULTILINE_ELEMENT_TRANSFORMERS: () => Mt6,
    ORDERED_LIST: () => St8,
    QUOTE: () => Ct8,
    STRIKETHROUGH: () => Rt5,
    TEXT_FORMAT_TRANSFORMERS: () => jt6,
    TEXT_MATCH_TRANSFORMERS: () => At8,
    TRANSFORMERS: () => zt5,
    UNORDERED_LIST: () => $t5,
    registerMarkdownShortcuts: () => Dt7
  });
  init_Lexical();
  function z6(t9, e5) {
    const n11 = {};
    for (const o8 of t9) {
      const t10 = e5(o8);
      t10 && (n11[t10] ? n11[t10].push(o8) : n11[t10] = [o8]);
    }
    return n11;
  }
  function U6(t9) {
    const e5 = z6(t9, (t10) => t10.type);
    return { element: e5.element || [], multilineElement: e5["multiline-element"] || [], textFormat: e5["text-format"] || [], textMatch: e5["text-match"] || [] };
  }
  var W8 = /[!-/:-@[-`{-~\s]/;
  var D6 = /^\s{0,3}$/;
  function O5(n11) {
    if (!$isParagraphNode(n11)) return false;
    const o8 = n11.getFirstChild();
    return null == o8 || 1 === n11.getChildrenSize() && $isTextNode(o8) && D6.test(o8.getTextContent());
  }
  function q8(t9, e5, n11, i13) {
    for (const o8 of e5) {
      if (!o8.export) continue;
      const e6 = o8.export(t9, (t10) => G8(t10, n11, i13));
      if (null != e6) return e6;
    }
    return $isElementNode(t9) ? G8(t9, n11, i13) : $isDecoratorNode(t9) ? t9.getTextContent() : null;
  }
  function G8(t9, n11, s7, l8, c10) {
    const f8 = [], a10 = t9.getChildren();
    l8 || (l8 = []), c10 || (c10 = []);
    t: for (const t10 of a10) {
      for (const e5 of s7) {
        if (!e5.export) continue;
        const o8 = e5.export(t10, (t11) => G8(t11, n11, s7, l8, [...c10, ...l8]), (t11, e6) => H8(t11, e6, n11, l8, c10));
        if (null != o8) {
          f8.push(o8);
          continue t;
        }
      }
      $isLineBreakNode(t10) ? f8.push("\n") : $isTextNode(t10) ? f8.push(H8(t10, t10.getTextContent(), n11, l8, c10)) : $isElementNode(t10) ? f8.push(G8(t10, n11, s7, l8, c10)) : $isDecoratorNode(t10) && f8.push(t10.getTextContent());
    }
    return f8.join("");
  }
  function H8(t9, e5, n11, o8, r9) {
    let i13 = 0 === t9.getFormat() ? e5 : (function(t10) {
      return t10.replace(/^\s+|\s+$/g, (t11) => [...t11].map((t12) => "&#" + t12.codePointAt(0) + ";").join(""));
    })(e5);
    t9.hasFormat("code") || (i13 = i13.replace(/([*_`~\\])/g, "\\$1"));
    let s7 = "", l8 = "", c10 = "";
    const f8 = J9(t9, true), a10 = J9(t9, false), u10 = /* @__PURE__ */ new Set();
    for (const e6 of n11) {
      const n12 = e6.format[0], r10 = e6.tag;
      K7(t9, n12) && !u10.has(n12) && (u10.add(n12), K7(f8, n12) && o8.find((t10) => t10.tag === r10) || (o8.push({ format: n12, tag: r10 }), s7 += r10));
    }
    for (let e6 = 0; e6 < o8.length; e6++) {
      const n12 = K7(t9, o8[e6].format), i14 = K7(a10, o8[e6].format);
      if (n12 && i14) continue;
      const s8 = [...o8];
      for (; s8.length > e6; ) {
        const t10 = s8.pop();
        r9 && t10 && r9.find((e7) => e7.tag === t10.tag) || (t10 && "string" == typeof t10.tag && (n12 ? i14 || (c10 += t10.tag) : l8 += t10.tag), o8.pop());
      }
      break;
    }
    return i13 = s7 + i13 + c10, l8 + i13;
  }
  function J9(t9, n11) {
    let r9 = n11 ? t9.getPreviousSibling() : t9.getNextSibling();
    if (!r9) {
      const e5 = t9.getParentOrThrow();
      e5.isInline() && (r9 = n11 ? e5.getPreviousSibling() : e5.getNextSibling());
    }
    for (; r9; ) {
      if ($isElementNode(r9)) {
        if (!r9.isInline()) break;
        const t10 = n11 ? r9.getLastDescendant() : r9.getFirstDescendant();
        if ($isTextNode(t10)) return t10;
        r9 = n11 ? r9.getPreviousSibling() : r9.getNextSibling();
      }
      if ($isTextNode(r9)) return r9;
      if (!$isElementNode(r9)) return null;
    }
    return null;
  }
  function K7(t9, n11) {
    return $isTextNode(t9) && t9.hasFormat(n11);
  }
  function Q8(t9, e5) {
    const n11 = (function(t10, e6) {
      const n12 = t10.match(e6.openTagsRegExp);
      if (null == n12) return null;
      for (const o9 of n12) {
        const n13 = o9.replace(/^\s/, ""), r9 = e6.fullMatchRegExpByTag[n13];
        if (null == r9) continue;
        const i13 = t10.match(r9), s7 = e6.transformersByTag[n13];
        if (null != i13 && null != s7) {
          if (false !== s7.intraword) return i13;
          const { index: e7 = 0 } = i13, n14 = t10[e7 - 1], o10 = t10[e7 + i13[0].length];
          if ((!n14 || W8.test(n14)) && (!o10 || W8.test(o10))) return i13;
        }
      }
      return null;
    })(t9.getTextContent(), e5);
    if (!n11) return null;
    const o8 = n11.index || 0;
    return { endIndex: o8 + n11[0].length, match: n11, startIndex: o8, transformer: e5.transformersByTag[n11[1]] };
  }
  function V8(t9) {
    return $isTextNode(t9) && !t9.hasFormat("code");
  }
  function X8(t9, e5, n11) {
    let o8 = Q8(t9, e5), r9 = (function(t10, e6) {
      const n12 = t10;
      let o9, r10, i14, s7;
      for (const t11 of e6) {
        if (!t11.replace || !t11.importRegExp) continue;
        const e7 = n12.getTextContent().match(t11.importRegExp);
        if (!e7) continue;
        const l8 = e7.index || 0, c10 = t11.getEndIndex ? t11.getEndIndex(n12, e7) : l8 + e7[0].length;
        false !== c10 && (void 0 === o9 || void 0 === r10 || l8 < o9 && (c10 > r10 || c10 <= o9)) && (o9 = l8, r10 = c10, i14 = t11, s7 = e7);
      }
      return void 0 === o9 || void 0 === r10 || void 0 === i14 || void 0 === s7 ? null : { endIndex: r10, match: s7, startIndex: o9, transformer: i14 };
    })(t9, n11);
    if (o8 && r9 && (o8.startIndex <= r9.startIndex && o8.endIndex >= r9.endIndex || r9.startIndex > o8.endIndex ? r9 = null : o8 = null), o8) {
      const r10 = (function(t10, e6, n12, o9, r11) {
        const i14 = t10.getTextContent();
        let s7, l8, c10;
        if (r11[0] === i14 ? s7 = t10 : 0 === e6 ? [s7, l8] = t10.splitText(n12) : [c10, s7, l8] = t10.splitText(e6, n12), s7.setTextContent(r11[2]), o9) for (const t11 of o9.format) s7.hasFormat(t11) || s7.toggleFormat(t11);
        return { nodeAfter: l8, nodeBefore: c10, transformedNode: s7 };
      })(t9, o8.startIndex, o8.endIndex, o8.transformer, o8.match);
      V8(r10.nodeAfter) && X8(r10.nodeAfter, e5, n11), V8(r10.nodeBefore) && X8(r10.nodeBefore, e5, n11), V8(r10.transformedNode) && X8(r10.transformedNode, e5, n11);
    } else if (r9) {
      const o9 = (function(t10, e6, n12, o10, r10) {
        let i14, s7, l8;
        return 0 === e6 ? [i14, s7] = t10.splitText(n12) : [l8, i14, s7] = t10.splitText(e6, n12), o10.replace ? { nodeAfter: s7, nodeBefore: l8, transformedNode: o10.replace(i14, r10) || void 0 } : null;
      })(t9, r9.startIndex, r9.endIndex, r9.transformer, r9.match);
      if (!o9) return;
      V8(o9.nodeAfter) && X8(o9.nodeAfter, e5, n11), V8(o9.nodeBefore) && X8(o9.nodeBefore, e5, n11), V8(o9.transformedNode) && X8(o9.transformedNode, e5, n11);
    }
    const i13 = t9.getTextContent().replace(/\\([*_`~\\])/g, "$1").replace(/&#(\d+);/g, (t10, e6) => String.fromCodePoint(e6));
    t9.setTextContent(i13);
  }
  function Y8(t9, e5 = false) {
    const o8 = U6(t9), r9 = (function(t10) {
      const e6 = {}, n11 = {}, o9 = [], r10 = "(?<![\\\\])";
      for (const r11 of t10) {
        const { tag: t11 } = r11;
        e6[t11] = r11;
        const i13 = t11.replace(/(\*|\^|\+)/g, "\\$1");
        o9.push(i13), 1 === t11.length ? n11[t11] = "`" === t11 ? new RegExp("(?<![\\\\`])(`)((?:\\\\`|[^`])+?)(`)(?!`)") : new RegExp(`(?<![\\\\${i13}])(${i13})((\\\\${i13})?.*?[^${i13}\\s](\\\\${i13})?)((?<!\\\\)|(?<=\\\\\\\\))(${i13})(?![\\\\${i13}])`) : n11[t11] = new RegExp(`(?<!\\\\)(${i13})((\\\\${i13})?.*?[^\\s](\\\\${i13})?)((?<!\\\\)|(?<=\\\\\\\\))(${i13})(?!\\\\)`);
      }
      return { fullMatchRegExpByTag: n11, openTagsRegExp: new RegExp(`${r10}(${o9.join("|")})`, "g"), transformersByTag: e6 };
    })(o8.textFormat);
    return (t10, i13) => {
      const l8 = t10.split("\n"), c10 = l8.length, f8 = i13 || $getRoot();
      f8.clear();
      for (let t11 = 0; t11 < c10; t11++) {
        const n11 = l8[t11], [i14, s7] = Z8(l8, t11, o8.multilineElement, f8);
        i14 ? t11 = s7 : tt8(n11, f8, o8.element, r9, o8.textMatch, e5);
      }
      const a10 = f8.getChildren();
      for (const t11 of a10) !e5 && O5(t11) && f8.getChildrenSize() > 1 && t11.remove();
      null !== $getSelection() && f8.selectStart();
    };
  }
  function Z8(t9, e5, n11, o8) {
    for (const r9 of n11) {
      const { handleImportAfterStartMatch: n12, regExpEnd: i13, regExpStart: s7, replace: l8 } = r9, c10 = t9[e5].match(s7);
      if (!c10) continue;
      if (n12) {
        const i14 = n12({ lines: t9, rootNode: o8, startLineIndex: e5, startMatch: c10, transformer: r9 });
        if (null === i14) continue;
        if (i14) return i14;
      }
      const f8 = "object" == typeof i13 && "regExp" in i13 ? i13.regExp : i13, a10 = i13 && "object" == typeof i13 && "optional" in i13 ? i13.optional : !i13;
      let u10 = e5;
      const g5 = t9.length;
      for (; u10 < g5; ) {
        const n13 = f8 ? t9[u10].match(f8) : null;
        if (!n13 && (!a10 || a10 && u10 < g5 - 1)) {
          u10++;
          continue;
        }
        if (n13 && e5 === u10 && n13.index === c10.index) {
          u10++;
          continue;
        }
        const r10 = [];
        if (n13 && e5 === u10) r10.push(t9[e5].slice(c10[0].length, -n13[0].length));
        else for (let o9 = e5; o9 <= u10; o9++) if (o9 === e5) {
          const e6 = t9[o9].slice(c10[0].length);
          r10.push(e6);
        } else if (o9 === u10 && n13) {
          const e6 = t9[o9].slice(0, -n13[0].length);
          r10.push(e6);
        } else r10.push(t9[o9]);
        if (false !== l8(o8, null, c10, n13, r10, true)) return [true, u10];
        break;
      }
    }
    return [false, e5];
  }
  function tt8(e5, n11, o8, r9, i13, s7) {
    const a10 = $createTextNode(e5), u10 = $createParagraphNode();
    u10.append(a10), n11.append(u10);
    for (const { regExp: t9, replace: n12 } of o8) {
      const o9 = e5.match(t9);
      if (o9 && (a10.setTextContent(e5.slice(o9[0].length)), false !== n12(u10, [a10], o9, true))) break;
    }
    if (X8(a10, r9, i13), u10.isAttached() && e5.length > 0) {
      const e6 = u10.getPreviousSibling();
      if (!s7 && ($isParagraphNode(e6) || $isQuoteNode(e6) || $isListNode(e6))) {
        let t9 = e6;
        if ($isListNode(e6)) {
          const n12 = e6.getLastDescendant();
          t9 = null == n12 ? null : $findMatchingParent2(n12, $isListItemNode);
        }
        null != t9 && t9.getTextContentSize() > 0 && (t9.splice(t9.getChildrenSize(), 0, [$createLineBreakNode(), ...u10.getChildren()]), u10.remove());
      }
    }
  }
  function et8(t9, ...e5) {
    const n11 = new URL("https://lexical.dev/docs/error"), o8 = new URLSearchParams();
    o8.append("code", t9);
    for (const t10 of e5) o8.append("v", t10);
    throw n11.search = o8.toString(), Error(`Minified Lexical error #${t9}; visit ${n11.toString()} for the full message or use the non-minified dev environment for full errors and additional helpful warnings.`);
  }
  var nt8 = /^(\s*)(\d{1,})\.\s/;
  var ot8 = /^(\s*)[-*+]\s/;
  var rt8 = /^(\s*)(?:[-*+]\s)?\s?(\[(\s|x)?\])\s/i;
  var it8 = /^(#{1,6})\s/;
  var st8 = /^>\s/;
  var lt8 = /^[ \t]*```([\w-]+)?/;
  var ct7 = /[ \t]*```$/;
  var ft7 = /^[ \t]*```[^`]+(?:(?:`{1,2}|`{4,})[^`]+)*```(?:[^`]|$)/;
  var at7 = /^(?:\|)(.+)(?:\|)\s?$/;
  var ut7 = /^(\| ?:?-*:? ?)+\|\s?$/;
  var gt8 = /^<[a-z_][\w-]*(?:\s[^<>]*)?\/?>/i;
  var pt8 = /^<\/[a-z_][\w-]*\s*>/i;
  var dt7 = (t9) => new RegExp(`(?:${t9.source})$`, t9.flags);
  var mt7 = createState("mdListMarker", { parse: (t9) => "string" == typeof t9 && /^[-*+]$/.test(t9) ? t9 : "-" });
  var ht8 = (t9) => (e5, n11, o8, r9) => {
    const i13 = t9(o8);
    i13.append(...n11), e5.replace(i13), r9 || i13.select(0, 0);
  };
  var xt8 = (t9) => (e5, n11, o8, r9) => {
    const i13 = e5.getPreviousSibling(), s7 = e5.getNextSibling(), l8 = $createListItemNode("check" === t9 ? "x" === o8[3] : void 0), c10 = o8[0].trim()[0], f8 = "bullet" !== t9 && "check" !== t9 || c10 !== mt7.parse(c10) ? void 0 : c10;
    if ($isListNode(s7) && s7.getListType() === t9) {
      f8 && $setState(s7, mt7, f8);
      const t10 = s7.getFirstChild();
      null !== t10 ? t10.insertBefore(l8) : s7.append(l8), e5.remove();
    } else if ($isListNode(i13) && i13.getListType() === t9) f8 && $setState(i13, mt7, f8), i13.append(l8), e5.remove();
    else {
      const n12 = $createListNode(t9, "number" === t9 ? Number(o8[2]) : void 0);
      f8 && $setState(n12, mt7, f8), n12.append(l8), e5.replace(n12);
    }
    l8.append(...n11), r9 || l8.select(0, 0);
    const a10 = (function(t10) {
      const e6 = t10.match(/\t/g), n12 = t10.match(/ /g);
      let o9 = 0;
      return e6 && (o9 += e6.length), n12 && (o9 += Math.floor(n12.length / 4)), o9;
    })(o8[1]);
    a10 && l8.setIndent(a10);
  };
  var Tt8 = (t9, e5, n11) => {
    const o8 = [], r9 = t9.getChildren();
    let i13 = 0;
    for (const s7 of r9) if ($isListItemNode(s7)) {
      if (1 === s7.getChildrenSize()) {
        const t10 = s7.getFirstChild();
        if ($isListNode(t10)) {
          o8.push(Tt8(t10, e5, n11 + 1));
          continue;
        }
      }
      const r10 = " ".repeat(4 * n11), l8 = t9.getListType(), c10 = $getState(t9, mt7), f8 = "number" === l8 ? `${t9.getStart() + i13}. ` : "check" === l8 ? `${c10} [${s7.getChecked() ? "x" : " "}] ` : c10 + " ";
      o8.push(r10 + f8 + e5(s7)), i13++;
    }
    return o8.join("\n");
  };
  var Et7 = { dependencies: [HeadingNode], export: (t9, e5) => {
    if (!$isHeadingNode(t9)) return null;
    const n11 = Number(t9.getTag().slice(1));
    return "#".repeat(n11) + " " + e5(t9);
  }, regExp: it8, replace: ht8((t9) => {
    const e5 = "h" + t9[1].length;
    return $createHeadingNode(e5);
  }), type: "element" };
  var Ct8 = { dependencies: [QuoteNode], export: (t9, e5) => {
    if (!$isQuoteNode(t9)) return null;
    const n11 = e5(t9).split("\n"), o8 = [];
    for (const t10 of n11) o8.push("> " + t10);
    return o8.join("\n");
  }, regExp: st8, replace: (t9, e5, n11, o8) => {
    if (o8) {
      const n12 = t9.getPreviousSibling();
      if ($isQuoteNode(n12)) return n12.splice(n12.getChildrenSize(), 0, [$createLineBreakNode(), ...e5]), void t9.remove();
    }
    const r9 = $createQuoteNode();
    r9.append(...e5), t9.replace(r9), o8 || r9.select(0, 0);
  }, type: "element" };
  var yt8 = { dependencies: [CodeNode2], export: (t9) => {
    if (!$isCodeNode2(t9)) return null;
    const e5 = t9.getTextContent();
    return "```" + (t9.getLanguage() || "") + (e5 ? "\n" + e5 : "") + "\n```";
  }, regExpEnd: { optional: true, regExp: ct7 }, regExpStart: lt8, replace: (t9, e5, n11, o8, r9, i13) => {
    let s7, c10;
    if (!e5 && r9) {
      if (1 === r9.length) o8 ? (s7 = $createCodeNode2(), c10 = n11[1] + r9[0]) : (s7 = $createCodeNode2(n11[1]), c10 = r9[0].startsWith(" ") ? r9[0].slice(1) : r9[0]);
      else {
        if (s7 = $createCodeNode2(n11[1]), 0 === r9[0].trim().length) for (; r9.length > 0 && !r9[0].length; ) r9.shift();
        else r9[0] = r9[0].startsWith(" ") ? r9[0].slice(1) : r9[0];
        for (; r9.length > 0 && !r9[r9.length - 1].length; ) r9.pop();
        c10 = r9.join("\n");
      }
      const e6 = $createTextNode(c10);
      s7.append(e6), t9.append(s7);
    } else e5 && ht8((t10) => $createCodeNode2(t10 ? t10[1] : void 0))(t9, e5, n11, i13);
  }, type: "multiline-element" };
  var $t5 = { dependencies: [ListNode, ListItemNode], export: (t9, e5) => $isListNode(t9) ? Tt8(t9, e5, 0) : null, regExp: ot8, replace: xt8("bullet"), type: "element" };
  var vt8 = { dependencies: [ListNode, ListItemNode], export: (t9, e5) => $isListNode(t9) ? Tt8(t9, e5, 0) : null, regExp: rt8, replace: xt8("check"), type: "element" };
  var St8 = { dependencies: [ListNode, ListItemNode], export: (t9, e5) => $isListNode(t9) ? Tt8(t9, e5, 0) : null, regExp: nt8, replace: xt8("number"), type: "element" };
  var bt8 = { format: ["code"], tag: "`", type: "text-format" };
  var Ft7 = { format: ["highlight"], tag: "==", type: "text-format" };
  var It5 = { format: ["bold", "italic"], tag: "***", type: "text-format" };
  var wt7 = { format: ["bold", "italic"], intraword: false, tag: "___", type: "text-format" };
  var Nt8 = { format: ["bold"], tag: "**", type: "text-format" };
  var kt8 = { format: ["bold"], intraword: false, tag: "__", type: "text-format" };
  var Rt5 = { format: ["strikethrough"], tag: "~~", type: "text-format" };
  var Lt7 = { format: ["italic"], tag: "*", type: "text-format" };
  var _t8 = { format: ["italic"], intraword: false, tag: "_", type: "text-format" };
  var Pt8 = { dependencies: [LinkNode], export: (t9, e5, n11) => {
    if (!$isLinkNode(t9) || $isAutoLinkNode(t9)) return null;
    const o8 = t9.getTitle(), r9 = e5(t9);
    return o8 ? `[${r9}](${t9.getURL()} "${o8}")` : `[${r9}](${t9.getURL()})`;
  }, importRegExp: /(?:\[(.+?)\])(?:\((?:([^()\s]+)(?:\s"((?:[^"]*\\")*[^"]*)"\s*)?)\))/, regExp: /(?:\[(.+?)\])(?:\((?:([^()\s]+)(?:\s"((?:[^"]*\\")*[^"]*)"\s*)?)\))$/, replace: (t9, e5) => {
    const [, n11, o8, r9] = e5, i13 = $createLinkNode(o8, { title: r9 }), s7 = n11.split("[").length - 1, c10 = n11.split("]").length - 1;
    let f8 = n11, a10 = "";
    if (s7 < c10) return;
    if (s7 > c10) {
      const t10 = n11.split("[");
      a10 = "[" + t10[0], f8 = t10.slice(1).join("[");
    }
    const u10 = $createTextNode(f8);
    return u10.setFormat(t9.getFormat()), i13.append(u10), t9.replace(i13), a10 && i13.insertBefore($createTextNode(a10)), u10;
  }, trigger: ")", type: "text-match" };
  var Bt6 = [Et7, Ct8, $t5, St8];
  var Mt6 = [yt8];
  var jt6 = [bt8, It5, wt7, Nt8, kt8, Ft7, Lt7, _t8, Rt5];
  var At8 = [Pt8];
  var zt5 = [...Bt6, ...Mt6, ...jt6, ...At8];
  function Ut4(t9, e5, n11) {
    const o8 = n11.length;
    for (let r9 = e5; r9 >= o8; r9--) {
      const e6 = r9 - o8;
      if (Wt5(t9, e6, n11, 0, o8) && " " !== t9[e6 + o8]) return e6;
    }
    return -1;
  }
  function Wt5(t9, e5, n11, o8, r9) {
    for (let i13 = 0; i13 < r9; i13++) if (t9[e5 + i13] !== n11[o8 + i13]) return false;
    return true;
  }
  function Dt7(t9, n11 = zt5) {
    const o8 = U6(n11), r9 = z6(o8.textFormat, ({ tag: t10 }) => t10[t10.length - 1]), l8 = z6(o8.textMatch, ({ trigger: t10 }) => t10);
    for (const e5 of n11) {
      const n12 = e5.type;
      if ("element" === n12 || "text-match" === n12 || "multiline-element" === n12) {
        const n13 = e5.dependencies;
        for (const e6 of n13) t9.hasNode(e6) || et8(173, e6.getType());
      }
    }
    const c10 = (t10, n12, c11) => {
      (function(t11, e5, n13, o9) {
        const r10 = t11.getParent();
        if (!$isRootOrShadowRoot(r10) || t11.getFirstChild() !== e5) return false;
        const i13 = e5.getTextContent();
        if (" " !== i13[n13 - 1]) return false;
        for (const { regExp: r11, replace: s7 } of o9) {
          const o10 = i13.match(r11);
          if (o10 && o10[0].length === (o10[0].endsWith(" ") ? n13 : n13 - 1)) {
            const r12 = e5.getNextSiblings(), [i14, l9] = e5.splitText(n13);
            if (false !== s7(t11, l9 ? [l9, ...r12] : r12, o10, false)) return i14.remove(), true;
          }
        }
        return false;
      })(t10, n12, c11, o8.element) || (function(t11, e5, n13, o9) {
        const r10 = t11.getParent();
        if (!$isRootOrShadowRoot(r10) || t11.getFirstChild() !== e5) return false;
        const i13 = e5.getTextContent();
        if (" " !== i13[n13 - 1]) return false;
        for (const { regExpStart: r11, replace: s7, regExpEnd: l9 } of o9) {
          if (l9 && !("optional" in l9) || l9 && "optional" in l9 && !l9.optional) continue;
          const o10 = i13.match(r11);
          if (o10 && o10[0].length === (o10[0].endsWith(" ") ? n13 : n13 - 1)) {
            const r12 = e5.getNextSiblings(), [i14, l10] = e5.splitText(n13);
            if (false !== s7(t11, l10 ? [l10, ...r12] : r12, o10, null, null, false)) return i14.remove(), true;
          }
        }
        return false;
      })(t10, n12, c11, o8.multilineElement) || (function(t11, e5, n13) {
        let o9 = t11.getTextContent();
        const r10 = n13[o9[e5 - 1]];
        if (null == r10) return false;
        e5 < o9.length && (o9 = o9.slice(0, e5));
        for (const e6 of r10) {
          if (!e6.replace || !e6.regExp) continue;
          const n14 = o9.match(e6.regExp);
          if (null === n14) continue;
          const r11 = n14.index || 0, i13 = r11 + n14[0].length;
          let s7;
          return 0 === r11 ? [s7] = t11.splitText(i13) : [, s7] = t11.splitText(r11, i13), s7.selectNext(0, 0), e6.replace(s7, n14), true;
        }
        return false;
      })(n12, c11, l8) || (function(t11, n13, o9) {
        const r10 = t11.getTextContent(), l9 = n13 - 1, c12 = r10[l9], f8 = o9[c12];
        if (!f8) return false;
        for (const n14 of f8) {
          const { tag: o10 } = n14, f9 = o10.length, a10 = l9 - f9 + 1;
          if (f9 > 1 && !Wt5(r10, a10, o10, 0, f9)) continue;
          if (" " === r10[a10 - 1]) continue;
          const u10 = r10[l9 + 1];
          if (false === n14.intraword && u10 && !W8.test(u10)) continue;
          const g5 = t11;
          let p7 = g5, d8 = Ut4(r10, a10, o10), h3 = p7;
          for (; d8 < 0 && (h3 = h3.getPreviousSibling()) && !$isLineBreakNode(h3); ) if ($isTextNode(h3)) {
            if (h3.hasFormat("code")) continue;
            const t12 = h3.getTextContent();
            p7 = h3, d8 = Ut4(t12, t12.length, o10);
          }
          if (d8 < 0) continue;
          if (p7 === g5 && d8 + f9 === a10) continue;
          const E8 = p7.getTextContent();
          if (d8 > 0 && E8[d8 - 1] === c12) continue;
          const C5 = E8[d8 - 1];
          if (false === n14.intraword && C5 && !W8.test(C5)) continue;
          const y6 = g5.getTextContent(), $7 = y6.slice(0, a10) + y6.slice(l9 + 1);
          g5.setTextContent($7);
          const v6 = p7 === g5 ? $7 : E8;
          p7.setTextContent(v6.slice(0, d8) + v6.slice(d8 + f9));
          const S3 = $getSelection(), b7 = $createRangeSelection();
          $setSelection(b7);
          const F7 = l9 - f9 * (p7 === g5 ? 2 : 1) + 1;
          b7.anchor.set(p7.__key, d8, "text"), b7.focus.set(g5.__key, F7, "text");
          for (const t12 of n14.format) b7.hasFormat(t12) || b7.formatText(t12);
          b7.anchor.set(b7.focus.key, b7.focus.offset, b7.focus.type);
          for (const t12 of n14.format) b7.hasFormat(t12) && b7.toggleFormat(t12);
          return $isRangeSelection(S3) && (b7.format = S3.format), true;
        }
      })(n12, c11, r9);
    };
    return t9.registerUpdateListener(({ tags: n12, dirtyLeaves: o9, editorState: r10, prevEditorState: i13 }) => {
      if (n12.has(COLLABORATION_TAG) || n12.has(HISTORIC_TAG)) return;
      if (t9.isComposing()) return;
      const l9 = r10.read($getSelection), f8 = i13.read($getSelection);
      if (!$isRangeSelection(f8) || !$isRangeSelection(l9) || !l9.isCollapsed() || l9.is(f8)) return;
      const a10 = l9.anchor.key, u10 = l9.anchor.offset, g5 = r10._nodeMap.get(a10);
      !$isTextNode(g5) || !o9.has(a10) || 1 !== u10 && u10 > f8.anchor.offset + 1 || t9.update(() => {
        if (!V8(g5)) return;
        const t10 = g5.getParent();
        null === t10 || $isCodeNode2(t10) || c10(t10, g5, l9.anchor.offset);
      });
    });
  }
  function Ot7(t9, e5 = zt5, n11, o8 = false, r9 = false) {
    const i13 = o8 ? t9 : (function(t10, e6 = false) {
      const n12 = t10.split("\n");
      let o9 = false;
      const r10 = [];
      for (let t11 = 0; t11 < n12.length; t11++) {
        const i14 = n12[t11].trimEnd(), s7 = r10[r10.length - 1];
        ft7.test(i14) ? r10.push(i14) : lt8.test(i14) || ct7.test(i14) ? (o9 = !o9, r10.push(i14)) : o9 || "" === i14 || "" === s7 || !s7 || it8.test(s7) || it8.test(i14) || st8.test(i14) || nt8.test(i14) || ot8.test(i14) || rt8.test(i14) || at7.test(i14) || ut7.test(i14) || !e6 || gt8.test(i14) || pt8.test(i14) || dt7(pt8).test(s7) || dt7(gt8).test(s7) || ct7.test(s7) ? r10.push(i14) : r10[r10.length - 1] = s7 + " " + i14.trimStart();
      }
      return r10.join("\n");
    })(t9, r9);
    return Y8(e5, o8)(i13, n11);
  }
  function qt4(t9 = zt5, e5, o8 = false) {
    const r9 = (function(t10, e6 = false) {
      const o9 = U6(t10), r10 = [...o9.multilineElement, ...o9.element], i13 = !e6, s7 = o9.textFormat.filter((t11) => 1 === t11.format.length).sort((t11, e7) => Number(t11.format.includes("code")) - Number(e7.format.includes("code")));
      return (t11) => {
        const e7 = [], l8 = (t11 || $getRoot()).getChildren();
        for (let t12 = 0; t12 < l8.length; t12++) {
          const n11 = l8[t12], c10 = q8(n11, r10, s7, o9.textMatch);
          null != c10 && e7.push(i13 && t12 > 0 && !O5(n11) && !O5(l8[t12 - 1]) ? "\n".concat(c10) : c10);
        }
        return e7.join("\n");
      };
    })(t9, o8);
    return r9(e5);
  }

  // node_modules/@lexical/markdown/LexicalMarkdown.mjs
  var mod31 = false ? LexicalMarkdown_dev_exports : LexicalMarkdown_prod_exports;
  var $convertFromMarkdownString = mod31.$convertFromMarkdownString;
  var $convertToMarkdownString = mod31.$convertToMarkdownString;
  var BOLD_ITALIC_STAR = mod31.BOLD_ITALIC_STAR;
  var BOLD_ITALIC_UNDERSCORE = mod31.BOLD_ITALIC_UNDERSCORE;
  var BOLD_STAR = mod31.BOLD_STAR;
  var BOLD_UNDERSCORE = mod31.BOLD_UNDERSCORE;
  var CHECK_LIST = mod31.CHECK_LIST;
  var CODE = mod31.CODE;
  var ELEMENT_TRANSFORMERS = mod31.ELEMENT_TRANSFORMERS;
  var HEADING = mod31.HEADING;
  var HIGHLIGHT = mod31.HIGHLIGHT;
  var INLINE_CODE = mod31.INLINE_CODE;
  var ITALIC_STAR = mod31.ITALIC_STAR;
  var ITALIC_UNDERSCORE = mod31.ITALIC_UNDERSCORE;
  var LINK = mod31.LINK;
  var MULTILINE_ELEMENT_TRANSFORMERS = mod31.MULTILINE_ELEMENT_TRANSFORMERS;
  var ORDERED_LIST = mod31.ORDERED_LIST;
  var QUOTE = mod31.QUOTE;
  var STRIKETHROUGH = mod31.STRIKETHROUGH;
  var TEXT_FORMAT_TRANSFORMERS = mod31.TEXT_FORMAT_TRANSFORMERS;
  var TEXT_MATCH_TRANSFORMERS = mod31.TEXT_MATCH_TRANSFORMERS;
  var TRANSFORMERS = mod31.TRANSFORMERS;
  var UNORDERED_LIST = mod31.UNORDERED_LIST;
  var registerMarkdownShortcuts = mod31.registerMarkdownShortcuts;

  // node_modules/@lexical/react/LexicalMarkdownShortcutPlugin.prod.mjs
  var LexicalMarkdownShortcutPlugin_prod_exports = {};
  __export(LexicalMarkdownShortcutPlugin_prod_exports, {
    DEFAULT_TRANSFORMERS: () => i8,
    MarkdownShortcutPlugin: () => a8
  });
  var import_react16 = __toESM(require_react(), 1);
  var i8 = [{ dependencies: [HorizontalRuleNode2], export: (e5) => $isHorizontalRuleNode2(e5) ? "***" : null, regExp: /^(---|\*\*\*|___)\s?$/, replace: (e5, r9, t9, o8) => {
    const n11 = $createHorizontalRuleNode2();
    o8 || null != e5.getNextSibling() ? e5.replace(n11) : e5.insertBefore(n11), n11.selectNext();
  }, type: "element" }, ...TRANSFORMERS];
  function a8({ transformers: e5 = i8 }) {
    const [o8] = useLexicalComposerContext();
    return (0, import_react16.useEffect)(() => registerMarkdownShortcuts(o8, e5), [o8, e5]), null;
  }

  // node_modules/@lexical/react/LexicalMarkdownShortcutPlugin.mjs
  var mod32 = false ? LexicalMarkdownShortcutPlugin_dev_exports : LexicalMarkdownShortcutPlugin_prod_exports;
  var DEFAULT_TRANSFORMERS = mod32.DEFAULT_TRANSFORMERS;
  var MarkdownShortcutPlugin = mod32.MarkdownShortcutPlugin;

  // node_modules/@lexical/react/LexicalOnChangePlugin.prod.mjs
  var LexicalOnChangePlugin_prod_exports = {};
  __export(LexicalOnChangePlugin_prod_exports, {
    OnChangePlugin: () => n8
  });
  init_Lexical();
  var import_react17 = __toESM(require_react(), 1);
  var r7 = "undefined" != typeof window && void 0 !== window.document && void 0 !== window.document.createElement ? import_react17.useLayoutEffect : import_react17.useEffect;
  function n8({ ignoreHistoryMergeTagChange: o8 = true, ignoreSelectionChange: i13 = false, onChange: n11 }) {
    const [a10] = useLexicalComposerContext();
    return r7(() => {
      if (n11) return a10.registerUpdateListener(({ editorState: e5, dirtyElements: r9, dirtyLeaves: d8, prevEditorState: s7, tags: c10 }) => {
        i13 && 0 === r9.size && 0 === d8.size || o8 && c10.has(HISTORY_MERGE_TAG) || s7.isEmpty() || n11(e5, a10, c10);
      });
    }, [a10, o8, i13, n11]), null;
  }

  // node_modules/@lexical/react/LexicalOnChangePlugin.mjs
  var mod33 = false ? LexicalOnChangePlugin_dev_exports : LexicalOnChangePlugin_prod_exports;
  var OnChangePlugin = mod33.OnChangePlugin;

  // node_modules/react-error-boundary/dist/react-error-boundary.js
  var import_react18 = __toESM(require_react(), 1);
  var h2 = (0, import_react18.createContext)(null);
  var c8 = {
    didCatch: false,
    error: null
  };
  var m8 = class extends import_react18.Component {
    constructor(t9) {
      super(t9), this.resetErrorBoundary = this.resetErrorBoundary.bind(this), this.state = c8;
    }
    static getDerivedStateFromError(t9) {
      return { didCatch: true, error: t9 };
    }
    resetErrorBoundary(...t9) {
      const { error: e5 } = this.state;
      e5 !== null && (this.props.onReset?.({
        args: t9,
        reason: "imperative-api"
      }), this.setState(c8));
    }
    componentDidCatch(t9, e5) {
      this.props.onError?.(t9, e5);
    }
    componentDidUpdate(t9, e5) {
      const { didCatch: o8 } = this.state, { resetKeys: n11 } = this.props;
      o8 && e5.error !== null && C4(t9.resetKeys, n11) && (this.props.onReset?.({
        next: n11,
        prev: t9.resetKeys,
        reason: "keys"
      }), this.setState(c8));
    }
    render() {
      const { children: t9, fallbackRender: e5, FallbackComponent: o8, fallback: n11 } = this.props, { didCatch: s7, error: a10 } = this.state;
      let i13 = t9;
      if (s7) {
        const u10 = {
          error: a10,
          resetErrorBoundary: this.resetErrorBoundary
        };
        if (typeof e5 == "function")
          i13 = e5(u10);
        else if (o8)
          i13 = (0, import_react18.createElement)(o8, u10);
        else if (n11 !== void 0)
          i13 = n11;
        else
          throw a10;
      }
      return (0, import_react18.createElement)(
        h2.Provider,
        {
          value: {
            didCatch: s7,
            error: a10,
            resetErrorBoundary: this.resetErrorBoundary
          }
        },
        i13
      );
    }
  };
  function C4(r9 = [], t9 = []) {
    return r9.length !== t9.length || r9.some((e5, o8) => !Object.is(e5, t9[o8]));
  }

  // node_modules/@lexical/react/LexicalErrorBoundary.prod.mjs
  var LexicalErrorBoundary_prod_exports = {};
  __export(LexicalErrorBoundary_prod_exports, {
    LexicalErrorBoundary: () => n9
  });
  function n9({ children: n11, onError: e5 }) {
    return jsx(m8, { fallback: jsx("div", { style: { border: "1px solid #f00", color: "#f00", padding: "8px" }, children: "An error was thrown." }), onError: e5, children: n11 });
  }

  // node_modules/@lexical/react/LexicalErrorBoundary.mjs
  var mod34 = false ? LexicalErrorBoundary_dev_exports : LexicalErrorBoundary_prod_exports;
  var LexicalErrorBoundary = mod34.LexicalErrorBoundary;

  // src/shared/lexical-playground/PlaygroundEditor.tsx
  init_Lexical();

  // src/shared/lexical-playground/themes/PlaygroundTheme.ts
  var PlaygroundTheme = {
    paragraph: "PlaygroundEditorTheme__paragraph",
    heading: {
      h1: "PlaygroundEditorTheme__h1",
      h2: "PlaygroundEditorTheme__h2",
      h3: "PlaygroundEditorTheme__h3",
      h4: "PlaygroundEditorTheme__h4",
      h5: "PlaygroundEditorTheme__h5",
      h6: "PlaygroundEditorTheme__h6"
    },
    list: {
      ul: "PlaygroundEditorTheme__ul",
      ol: "PlaygroundEditorTheme__ol",
      listitem: "PlaygroundEditorTheme__listItem",
      nested: {
        listitem: "PlaygroundEditorTheme__nestedListItem"
      },
      listitemChecked: "PlaygroundEditorTheme__listItemChecked",
      listitemUnchecked: "PlaygroundEditorTheme__listItemUnchecked"
    },
    quote: "PlaygroundEditorTheme__quote",
    code: "PlaygroundEditorTheme__code",
    codeHighlight: {
      atrule: "PlaygroundEditorTheme__tokenAttr",
      attr: "PlaygroundEditorTheme__tokenAttr",
      boolean: "PlaygroundEditorTheme__tokenProperty",
      builtin: "PlaygroundEditorTheme__tokenSelector",
      cdata: "PlaygroundEditorTheme__tokenComment",
      char: "PlaygroundEditorTheme__tokenSelector",
      class: "PlaygroundEditorTheme__tokenFunction",
      "class-name": "PlaygroundEditorTheme__tokenFunction",
      comment: "PlaygroundEditorTheme__tokenComment",
      constant: "PlaygroundEditorTheme__tokenProperty",
      deleted: "PlaygroundEditorTheme__tokenProperty",
      doctype: "PlaygroundEditorTheme__tokenComment",
      entity: "PlaygroundEditorTheme__tokenOperator",
      function: "PlaygroundEditorTheme__tokenFunction",
      important: "PlaygroundEditorTheme__tokenVariable",
      inserted: "PlaygroundEditorTheme__tokenSelector",
      keyword: "PlaygroundEditorTheme__tokenAttr",
      namespace: "PlaygroundEditorTheme__tokenVariable",
      number: "PlaygroundEditorTheme__tokenProperty",
      operator: "PlaygroundEditorTheme__tokenOperator",
      prolog: "PlaygroundEditorTheme__tokenComment",
      property: "PlaygroundEditorTheme__tokenProperty",
      punctuation: "PlaygroundEditorTheme__tokenPunctuation",
      regex: "PlaygroundEditorTheme__tokenVariable",
      selector: "PlaygroundEditorTheme__tokenSelector",
      string: "PlaygroundEditorTheme__tokenSelector",
      symbol: "PlaygroundEditorTheme__tokenProperty",
      tag: "PlaygroundEditorTheme__tokenProperty",
      url: "PlaygroundEditorTheme__tokenOperator",
      variable: "PlaygroundEditorTheme__tokenVariable"
    },
    table: "PlaygroundEditorTheme__table",
    tableCell: "PlaygroundEditorTheme__tableCell",
    tableCellHeader: "PlaygroundEditorTheme__tableCellHeader",
    tableRow: "PlaygroundEditorTheme__tableRow",
    link: "PlaygroundEditorTheme__link",
    text: {
      bold: "PlaygroundEditorTheme__textBold",
      italic: "PlaygroundEditorTheme__textItalic",
      underline: "PlaygroundEditorTheme__textUnderline",
      strikethrough: "PlaygroundEditorTheme__textStrikethrough",
      subscript: "PlaygroundEditorTheme__textSubscript",
      superscript: "PlaygroundEditorTheme__textSuperscript",
      code: "PlaygroundEditorTheme__textCode",
      highlight: "PlaygroundEditorTheme__textHighlight"
    },
    image: "PlaygroundEditorTheme__image",
    horizontalRule: "PlaygroundEditorTheme__hr",
    characterLimit: "PlaygroundEditorTheme__characterLimit"
  };
  var PlaygroundTheme_default = PlaygroundTheme;

  // src/shared/lexical-playground/themes/PlaygroundTheme.css
  var style = document.createElement("style");
  style.textContent = '/**\n * Lexical Playground Theme Styles\n */\n\n/* Editor Container */\n.lexical-playground-container {\n    position: relative;\n    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, sans-serif;\n    line-height: 1.6;\n    color: #1a1a1a;\n    background: #fff;\n    border: 1px solid #e0e0e0;\n    border-radius: 8px;\n    overflow: hidden;\n}\n\n.lexical-playground-editor {\n    min-height: 150px;\n    max-height: 600px;\n    padding: 16px;\n    outline: none;\n    caret-color: #4a90d9;\n    overflow-y: auto;\n}\n\n/* Editor wrapper with resize capability */\n.lexical-playground-editor-wrapper {\n    position: relative;\n    padding-left: 44px;\n    min-height: 150px;\n    resize: vertical;\n    overflow: auto;\n}\n\n.lexical-playground-editor:focus {\n    outline: none;\n}\n\n/* Placeholder */\n.lexical-playground-placeholder {\n    position: absolute;\n    top: 16px;\n    left: 16px;\n    color: #999;\n    pointer-events: none;\n    user-select: none;\n    font-size: 15px;\n    overflow: hidden;\n    text-overflow: ellipsis;\n}\n\n/* Paragraph */\n.PlaygroundEditorTheme__paragraph {\n    margin: 0 0 8px 0;\n    position: relative;\n}\n\n/* Headings */\n.PlaygroundEditorTheme__h1 {\n    font-size: 28px;\n    font-weight: 700;\n    margin: 20px 0 12px 0;\n    line-height: 1.3;\n    color: #1a1a1a;\n}\n\n.PlaygroundEditorTheme__h2 {\n    font-size: 24px;\n    font-weight: 600;\n    margin: 18px 0 10px 0;\n    line-height: 1.35;\n    color: #1a1a1a;\n}\n\n.PlaygroundEditorTheme__h3 {\n    font-size: 20px;\n    font-weight: 600;\n    margin: 16px 0 8px 0;\n    line-height: 1.4;\n    color: #1a1a1a;\n}\n\n.PlaygroundEditorTheme__h4 {\n    font-size: 18px;\n    font-weight: 600;\n    margin: 14px 0 6px 0;\n    line-height: 1.4;\n    color: #333;\n}\n\n.PlaygroundEditorTheme__h5 {\n    font-size: 16px;\n    font-weight: 600;\n    margin: 12px 0 4px 0;\n    line-height: 1.5;\n    color: #333;\n}\n\n.PlaygroundEditorTheme__h6 {\n    font-size: 14px;\n    font-weight: 600;\n    margin: 10px 0 4px 0;\n    line-height: 1.5;\n    color: #555;\n    text-transform: uppercase;\n    letter-spacing: 0.5px;\n}\n\n/* Lists */\n.PlaygroundEditorTheme__ul,\n.PlaygroundEditorTheme__ol {\n    margin: 8px 0;\n    padding-left: 24px;\n}\n\n.PlaygroundEditorTheme__listItem {\n    margin: 4px 0;\n}\n\n.PlaygroundEditorTheme__nestedListItem {\n    list-style-type: none;\n}\n\n/* Checklist */\n.PlaygroundEditorTheme__listItemChecked,\n.PlaygroundEditorTheme__listItemUnchecked {\n    position: relative;\n    list-style-type: none;\n    margin-left: -24px;\n    padding-left: 24px;\n}\n\n.PlaygroundEditorTheme__listItemChecked::before,\n.PlaygroundEditorTheme__listItemUnchecked::before {\n    content: "";\n    position: absolute;\n    left: 0;\n    top: 4px;\n    width: 16px;\n    height: 16px;\n    border: 2px solid #999;\n    border-radius: 3px;\n    cursor: pointer;\n}\n\n.PlaygroundEditorTheme__listItemChecked::before {\n    background: #4a90d9;\n    border-color: #4a90d9;\n}\n\n.PlaygroundEditorTheme__listItemChecked::after {\n    content: "";\n    position: absolute;\n    left: 5px;\n    top: 7px;\n    width: 6px;\n    height: 10px;\n    border: solid #fff;\n    border-width: 0 2px 2px 0;\n    transform: rotate(45deg);\n}\n\n.PlaygroundEditorTheme__listItemChecked {\n    text-decoration: line-through;\n    color: #888;\n}\n\n/* Quote */\n.PlaygroundEditorTheme__quote {\n    margin: 16px 0;\n    padding: 12px 20px;\n    border-left: 4px solid #4a90d9;\n    background: #f8f9fa;\n    color: #555;\n    font-style: italic;\n}\n\n/* Code */\n.PlaygroundEditorTheme__code {\n    display: block;\n    margin: 12px 0;\n    padding: 12px 16px;\n    background: #282c34;\n    color: #abb2bf;\n    font-family: "Fira Code", "Consolas", "Monaco", monospace;\n    font-size: 14px;\n    line-height: 1.5;\n    border-radius: 6px;\n    overflow-x: auto;\n    tab-size: 2;\n}\n\n/* Code highlighting tokens */\n.PlaygroundEditorTheme__tokenComment {\n    color: #5c6370;\n    font-style: italic;\n}\n.PlaygroundEditorTheme__tokenPunctuation {\n    color: #abb2bf;\n}\n.PlaygroundEditorTheme__tokenProperty {\n    color: #d19a66;\n}\n.PlaygroundEditorTheme__tokenSelector {\n    color: #98c379;\n}\n.PlaygroundEditorTheme__tokenOperator {\n    color: #56b6c2;\n}\n.PlaygroundEditorTheme__tokenAttr {\n    color: #c678dd;\n}\n.PlaygroundEditorTheme__tokenVariable {\n    color: #e06c75;\n}\n.PlaygroundEditorTheme__tokenFunction {\n    color: #61afef;\n}\n\n/* Table */\n.PlaygroundEditorTheme__table {\n    width: 100%;\n    border-collapse: collapse;\n    margin: 16px 0;\n    table-layout: fixed;\n}\n\n.PlaygroundEditorTheme__tableRow {\n    border-bottom: 1px solid #e0e0e0;\n}\n\n.PlaygroundEditorTheme__tableCell {\n    padding: 10px 12px;\n    border: 1px solid #e0e0e0;\n    vertical-align: top;\n    text-align: left;\n}\n\n.PlaygroundEditorTheme__tableCellHeader {\n    padding: 10px 12px;\n    border: 1px solid #e0e0e0;\n    background: #f5f5f5;\n    font-weight: 600;\n    text-align: left;\n}\n\n/* Link */\n.PlaygroundEditorTheme__link {\n    color: #4a90d9;\n    text-decoration: none;\n    cursor: pointer;\n}\n\n.PlaygroundEditorTheme__link:hover {\n    text-decoration: underline;\n}\n\n/* Text Formatting */\n.PlaygroundEditorTheme__textBold {\n    font-weight: 700;\n}\n\n.PlaygroundEditorTheme__textItalic {\n    font-style: italic;\n}\n\n.PlaygroundEditorTheme__textUnderline {\n    text-decoration: underline;\n}\n\n.PlaygroundEditorTheme__textStrikethrough {\n    text-decoration: line-through;\n}\n\n.PlaygroundEditorTheme__textSubscript {\n    font-size: 0.8em;\n    vertical-align: sub;\n}\n\n.PlaygroundEditorTheme__textSuperscript {\n    font-size: 0.8em;\n    vertical-align: super;\n}\n\n.PlaygroundEditorTheme__textCode {\n    font-family: "Fira Code", "Consolas", monospace;\n    font-size: 0.9em;\n    background: #f0f0f0;\n    padding: 2px 6px;\n    border-radius: 3px;\n    color: #c7254e;\n}\n\n.PlaygroundEditorTheme__textHighlight {\n    background: #fff3cd;\n    padding: 1px 2px;\n}\n\n/* Image */\n.PlaygroundEditorTheme__image {\n    max-width: 100%;\n    height: auto;\n    cursor: default;\n}\n\n/* Horizontal Rule */\n.PlaygroundEditorTheme__hr {\n    border: none;\n    border-top: 2px solid #e0e0e0;\n    margin: 20px 0;\n    padding: 2px 2px;\n    cursor: pointer;\n}\n\n.PlaygroundEditorTheme__hr.selected {\n    outline: 2px solid #4a90d9;\n}\n\n/* Character Limit Warning */\n.PlaygroundEditorTheme__characterLimit {\n    display: inline;\n    background: #ffcccc;\n}\n\n/* Toolbar Styles */\n.lexical-playground-toolbar {\n    display: flex;\n    flex-wrap: wrap;\n    align-items: center;\n    gap: 4px;\n    padding: 8px 12px;\n    background: #f8f9fa;\n    border-bottom: 1px solid #e0e0e0;\n}\n\n.lexical-playground-toolbar-divider {\n    width: 1px;\n    height: 24px;\n    background: #d0d0d0;\n    margin: 0 6px;\n}\n\n.lexical-playground-toolbar-btn {\n    display: inline-flex;\n    align-items: center;\n    justify-content: center;\n    width: 32px;\n    height: 32px;\n    padding: 0;\n    border: none;\n    border-radius: 6px;\n    background: transparent;\n    color: #555;\n    cursor: pointer;\n    transition: all 0.15s ease;\n}\n\n.lexical-playground-toolbar-btn:hover {\n    background: #e8e8e8;\n    color: #1a1a1a;\n}\n\n.lexical-playground-toolbar-btn.active {\n    background: #4a90d9;\n    color: #fff;\n}\n\n.lexical-playground-toolbar-btn:disabled {\n    opacity: 0.4;\n    cursor: not-allowed;\n}\n\n.lexical-playground-toolbar-btn svg {\n    width: 18px;\n    height: 18px;\n}\n\n/* Dropdown Button */\n.lexical-playground-toolbar-dropdown {\n    display: inline-flex;\n    align-items: center;\n    gap: 4px;\n    padding: 4px 10px;\n    border: 1px solid #d0d0d0;\n    border-radius: 6px;\n    background: #fff;\n    color: #333;\n    font-size: 13px;\n    cursor: pointer;\n    min-width: 100px;\n}\n\n.lexical-playground-toolbar-dropdown:hover {\n    background: #f5f5f5;\n}\n\n.lexical-playground-toolbar-dropdown-chevron {\n    margin-left: auto;\n    font-size: 10px;\n}\n\n/* Dropdown Menu */\n.lexical-playground-dropdown-menu {\n    position: absolute;\n    top: 100%;\n    left: 0;\n    z-index: 1000;\n    min-width: 180px;\n    max-height: 300px;\n    overflow-y: auto;\n    background: #fff;\n    border: 1px solid #e0e0e0;\n    border-radius: 8px;\n    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);\n    padding: 6px;\n}\n\n.lexical-playground-dropdown-item {\n    display: flex;\n    align-items: center;\n    gap: 10px;\n    padding: 8px 12px;\n    border-radius: 4px;\n    cursor: pointer;\n    font-size: 14px;\n    color: #333;\n}\n\n.lexical-playground-dropdown-item:hover {\n    background: #f5f5f5;\n}\n\n.lexical-playground-dropdown-item.active {\n    background: #e8f0fe;\n    color: #1a73e8;\n}\n\n.lexical-playground-dropdown-item-icon {\n    width: 20px;\n    height: 20px;\n    display: flex;\n    align-items: center;\n    justify-content: center;\n    color: #666;\n}\n\n/* Insert Menu (Component Picker) */\n.lexical-playground-insert-menu {\n    position: absolute;\n    z-index: 1000;\n    min-width: 250px;\n    max-height: 320px;\n    overflow-y: auto;\n    background: #fff;\n    border: 1px solid #e0e0e0;\n    border-radius: 8px;\n    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);\n    padding: 8px;\n}\n\n.lexical-playground-insert-menu-item {\n    display: flex;\n    align-items: center;\n    gap: 12px;\n    padding: 10px 12px;\n    border-radius: 6px;\n    cursor: pointer;\n    transition: background 0.1s ease;\n}\n\n.lexical-playground-insert-menu-item:hover,\n.lexical-playground-insert-menu-item.selected {\n    background: #f0f4ff;\n}\n\n.lexical-playground-insert-menu-item-icon {\n    width: 32px;\n    height: 32px;\n    display: flex;\n    align-items: center;\n    justify-content: center;\n    background: #f5f5f5;\n    border-radius: 6px;\n    color: #555;\n}\n\n.lexical-playground-insert-menu-item-label {\n    font-size: 14px;\n    font-weight: 500;\n    color: #333;\n}\n\n.lexical-playground-insert-menu-item-description {\n    font-size: 12px;\n    color: #888;\n}\n\n/* Floating Toolbar */\n.lexical-playground-floating-toolbar {\n    position: absolute;\n    z-index: 1000;\n    display: flex;\n    align-items: center;\n    gap: 2px;\n    padding: 6px 8px;\n    background: #1a1a1a;\n    border-radius: 8px;\n    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);\n}\n\n.lexical-playground-floating-toolbar-btn {\n    display: inline-flex;\n    align-items: center;\n    justify-content: center;\n    width: 28px;\n    height: 28px;\n    padding: 0;\n    border: none;\n    border-radius: 4px;\n    background: transparent;\n    color: #fff;\n    cursor: pointer;\n    transition: background 0.1s ease;\n}\n\n.lexical-playground-floating-toolbar-btn:hover {\n    background: rgba(255, 255, 255, 0.15);\n}\n\n.lexical-playground-floating-toolbar-btn.active {\n    background: #4a90d9;\n}\n\n.lexical-playground-floating-toolbar-divider {\n    width: 1px;\n    height: 20px;\n    background: rgba(255, 255, 255, 0.2);\n    margin: 0 4px;\n}\n\n/* Link Editor Popup */\n.lexical-playground-link-editor {\n    position: absolute;\n    z-index: 1000;\n    display: flex;\n    align-items: center;\n    gap: 8px;\n    padding: 8px 12px;\n    background: #fff;\n    border: 1px solid #e0e0e0;\n    border-radius: 8px;\n    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);\n}\n\n.lexical-playground-link-editor input {\n    flex: 1;\n    min-width: 200px;\n    padding: 6px 10px;\n    border: 1px solid #d0d0d0;\n    border-radius: 4px;\n    font-size: 14px;\n}\n\n.lexical-playground-link-editor input:focus {\n    outline: none;\n    border-color: #4a90d9;\n}\n\n/* Color Picker */\n.lexical-playground-color-picker {\n    position: absolute;\n    z-index: 1000;\n    padding: 12px;\n    background: #fff;\n    border: 1px solid #e0e0e0;\n    border-radius: 8px;\n    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);\n}\n\n.lexical-playground-color-picker-grid {\n    display: grid;\n    grid-template-columns: repeat(10, 24px);\n    gap: 4px;\n}\n\n.lexical-playground-color-swatch {\n    width: 24px;\n    height: 24px;\n    border-radius: 4px;\n    cursor: pointer;\n    border: 1px solid transparent;\n    transition: transform 0.1s ease;\n}\n\n.lexical-playground-color-swatch:hover {\n    transform: scale(1.15);\n    border-color: #333;\n}\n\n/* Collapsible Blocks */\n.PlaygroundEditorTheme__collapsible-container {\n    margin: 12px 0;\n    border: 1px solid #e0e0e0;\n    border-radius: 6px;\n    overflow: hidden;\n}\n\n.PlaygroundEditorTheme__collapsible-title {\n    display: flex;\n    align-items: center;\n    gap: 8px;\n    padding: 10px 14px;\n    background: #f8f9fa;\n    cursor: pointer;\n    font-weight: 500;\n}\n\n.PlaygroundEditorTheme__collapsible-title:hover {\n    background: #f0f0f0;\n}\n\n.PlaygroundEditorTheme__collapsible-content {\n    padding: 12px 14px;\n}\n\n.PlaygroundEditorTheme__collapsible-content.collapsed {\n    display: none;\n}\n\n/* Equation / KaTeX */\n.PlaygroundEditorTheme__equation {\n    display: inline-block;\n    padding: 2px 4px;\n    cursor: pointer;\n}\n\n.PlaygroundEditorTheme__equation:hover {\n    background: #f0f4ff;\n    border-radius: 4px;\n}\n\n.PlaygroundEditorTheme__equation.focused {\n    outline: 2px solid #4a90d9;\n    border-radius: 4px;\n}\n\n/* Mention */\n.PlaygroundEditorTheme__mention {\n    background: #e8f0fe;\n    color: #1a73e8;\n    padding: 2px 6px;\n    border-radius: 4px;\n    cursor: pointer;\n}\n\n/* Draggable Block Handle */\n.lexical-playground-draggable-block-menu {\n    position: absolute;\n    display: flex;\n    flex-direction: row;\n    align-items: center;\n    gap: 2px;\n    padding: 2px;\n    border-radius: 4px;\n    background: transparent;\n    z-index: 10;\n}\n\n.lexical-playground-draggable-block-menu:hover {\n    background: rgba(0, 0, 0, 0.04);\n}\n\n.lexical-playground-draggable-block-add,\n.lexical-playground-draggable-block-handle {\n    display: flex;\n    align-items: center;\n    justify-content: center;\n    width: 18px;\n    height: 18px;\n    padding: 0;\n    border: none;\n    background: transparent;\n    cursor: pointer;\n    border-radius: 4px;\n    color: #888;\n    transition: all 0.15s ease;\n}\n\n.lexical-playground-draggable-block-add:hover,\n.lexical-playground-draggable-block-handle:hover {\n    background: rgba(0, 0, 0, 0.08);\n    color: #333;\n}\n\n.lexical-playground-draggable-block-handle {\n    cursor: grab;\n}\n\n.lexical-playground-draggable-block-handle:active {\n    cursor: grabbing;\n}\n\n.lexical-playground-draggable-block-menu svg {\n    width: 14px;\n    height: 14px;\n}\n\n/* Image container and selection */\n.lexical-playground-image-container {\n    position: relative;\n    display: inline-block;\n    max-width: 100%;\n    cursor: pointer;\n}\n\n.lexical-playground-image-container.selected {\n    outline: 2px solid #4a90d9;\n    outline-offset: 2px;\n}\n\n.PlaygroundEditorTheme__image {\n    display: block;\n    max-width: 100%;\n    height: auto;\n}\n\n.PlaygroundEditorTheme__image.focused {\n    outline: 2px solid #4a90d9;\n}\n\n/* Image resize handles */\n.image-resizer {\n    position: absolute;\n    width: 10px;\n    height: 10px;\n    background: #4a90d9;\n    border: 2px solid #fff;\n    border-radius: 50%;\n    z-index: 10;\n    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);\n}\n\n.image-resizer-nw {\n    top: -5px;\n    left: -5px;\n    cursor: nwse-resize;\n}\n\n.image-resizer-ne {\n    top: -5px;\n    right: -5px;\n    cursor: nesw-resize;\n}\n\n.image-resizer-sw {\n    bottom: -5px;\n    left: -5px;\n    cursor: nesw-resize;\n}\n\n.image-resizer-se {\n    bottom: -5px;\n    right: -5px;\n    cursor: nwse-resize;\n}\n\n.lexical-playground-image-resizer {\n    position: absolute;\n    width: 8px;\n    height: 8px;\n    background: #4a90d9;\n    border: 2px solid #fff;\n    border-radius: 50%;\n}\n\n/* Embed container (YouTube, Twitter, etc.) */\n.PlaygroundEditorTheme__embed {\n    margin: 16px 0;\n    max-width: 100%;\n}\n\n.PlaygroundEditorTheme__embed iframe {\n    width: 100%;\n    border: none;\n    border-radius: 8px;\n}\n\n/* Dark mode support */\n@media (prefers-color-scheme: dark) {\n    .lexical-playground-container {\n        color: #e0e0e0;\n        background: #1a1a1a;\n        border-color: #333;\n    }\n\n    .lexical-playground-placeholder {\n        color: #666;\n    }\n\n    .lexical-playground-toolbar {\n        background: #252525;\n        border-color: #333;\n    }\n\n    .lexical-playground-toolbar-btn {\n        color: #ccc;\n    }\n\n    .lexical-playground-toolbar-btn:hover {\n        background: #333;\n        color: #fff;\n    }\n\n    .PlaygroundEditorTheme__h1,\n    .PlaygroundEditorTheme__h2,\n    .PlaygroundEditorTheme__h3 {\n        color: #e0e0e0;\n    }\n\n    .PlaygroundEditorTheme__quote {\n        background: #252525;\n        border-color: #4a90d9;\n        color: #aaa;\n    }\n\n    .PlaygroundEditorTheme__table,\n    .PlaygroundEditorTheme__tableCell,\n    .PlaygroundEditorTheme__tableCellHeader {\n        border-color: #444;\n    }\n\n    .PlaygroundEditorTheme__tableCellHeader {\n        background: #2a2a2a;\n    }\n\n    .PlaygroundEditorTheme__textCode {\n        background: #2a2a2a;\n        color: #e06c75;\n    }\n\n    .PlaygroundEditorTheme__hr {\n        border-color: #444;\n    }\n}\n';
  document.head.appendChild(style);

  // src/shared/lexical-playground/plugins/ToolbarPlugin/index.tsx
  var import_react22 = __toESM(require_react());
  init_Lexical();
  init_LexicalSelection();

  // src/shared/lexical-playground/plugins/ToolbarPlugin/InsertDropdown.tsx
  var import_react20 = __toESM(require_react());
  init_Lexical();
  init_LexicalSelection();

  // src/shared/lexical-playground/ui/Icons.tsx
  var BoldIcon = () => /* @__PURE__ */ jsxs(
    "svg",
    {
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      children: [
        /* @__PURE__ */ jsx("path", { d: "M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z" }),
        /* @__PURE__ */ jsx("path", { d: "M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z" })
      ]
    }
  );
  var ItalicIcon = () => /* @__PURE__ */ jsxs(
    "svg",
    {
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      children: [
        /* @__PURE__ */ jsx("line", { x1: "19", y1: "4", x2: "10", y2: "4" }),
        /* @__PURE__ */ jsx("line", { x1: "14", y1: "20", x2: "5", y2: "20" }),
        /* @__PURE__ */ jsx("line", { x1: "15", y1: "4", x2: "9", y2: "20" })
      ]
    }
  );
  var UnderlineIcon = () => /* @__PURE__ */ jsxs(
    "svg",
    {
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      children: [
        /* @__PURE__ */ jsx("path", { d: "M6 4v6a6 6 0 0 0 12 0V4" }),
        /* @__PURE__ */ jsx("line", { x1: "4", y1: "20", x2: "20", y2: "20" })
      ]
    }
  );
  var StrikethroughIcon = () => /* @__PURE__ */ jsxs(
    "svg",
    {
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      children: [
        /* @__PURE__ */ jsx("path", { d: "M16 4H9a3 3 0 0 0-3 3v0a3 3 0 0 0 3 3h6" }),
        /* @__PURE__ */ jsx("path", { d: "M8 20h7a3 3 0 0 0 3-3v0a3 3 0 0 0-3-3h-6" }),
        /* @__PURE__ */ jsx("line", { x1: "4", y1: "12", x2: "20", y2: "12" })
      ]
    }
  );
  var CodeIcon = () => /* @__PURE__ */ jsxs(
    "svg",
    {
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      children: [
        /* @__PURE__ */ jsx("polyline", { points: "16 18 22 12 16 6" }),
        /* @__PURE__ */ jsx("polyline", { points: "8 6 2 12 8 18" })
      ]
    }
  );
  var SubscriptIcon = () => /* @__PURE__ */ jsxs(
    "svg",
    {
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      children: [
        /* @__PURE__ */ jsx("path", { d: "M4 5l8 8" }),
        /* @__PURE__ */ jsx("path", { d: "M12 5l-8 8" }),
        /* @__PURE__ */ jsx("path", { d: "M20 19h-4c0-1.5 4-2 4-4 0-1.1-.9-2-2-2s-2 .9-2 2" })
      ]
    }
  );
  var SuperscriptIcon = () => /* @__PURE__ */ jsxs(
    "svg",
    {
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      children: [
        /* @__PURE__ */ jsx("path", { d: "M4 19l8-8" }),
        /* @__PURE__ */ jsx("path", { d: "M12 19l-8-8" }),
        /* @__PURE__ */ jsx("path", { d: "M20 9h-4c0-1.5 4-2 4-4 0-1.1-.9-2-2-2s-2 .9-2 2" })
      ]
    }
  );
  var LinkIcon = () => /* @__PURE__ */ jsxs(
    "svg",
    {
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      children: [
        /* @__PURE__ */ jsx("path", { d: "M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" }),
        /* @__PURE__ */ jsx("path", { d: "M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" })
      ]
    }
  );
  var AlignLeftIcon = () => /* @__PURE__ */ jsxs(
    "svg",
    {
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      children: [
        /* @__PURE__ */ jsx("line", { x1: "17", y1: "10", x2: "3", y2: "10" }),
        /* @__PURE__ */ jsx("line", { x1: "21", y1: "6", x2: "3", y2: "6" }),
        /* @__PURE__ */ jsx("line", { x1: "21", y1: "14", x2: "3", y2: "14" }),
        /* @__PURE__ */ jsx("line", { x1: "17", y1: "18", x2: "3", y2: "18" })
      ]
    }
  );
  var AlignCenterIcon = () => /* @__PURE__ */ jsxs(
    "svg",
    {
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      children: [
        /* @__PURE__ */ jsx("line", { x1: "18", y1: "10", x2: "6", y2: "10" }),
        /* @__PURE__ */ jsx("line", { x1: "21", y1: "6", x2: "3", y2: "6" }),
        /* @__PURE__ */ jsx("line", { x1: "21", y1: "14", x2: "3", y2: "14" }),
        /* @__PURE__ */ jsx("line", { x1: "18", y1: "18", x2: "6", y2: "18" })
      ]
    }
  );
  var AlignRightIcon = () => /* @__PURE__ */ jsxs(
    "svg",
    {
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      children: [
        /* @__PURE__ */ jsx("line", { x1: "21", y1: "10", x2: "7", y2: "10" }),
        /* @__PURE__ */ jsx("line", { x1: "21", y1: "6", x2: "3", y2: "6" }),
        /* @__PURE__ */ jsx("line", { x1: "21", y1: "14", x2: "3", y2: "14" }),
        /* @__PURE__ */ jsx("line", { x1: "21", y1: "18", x2: "7", y2: "18" })
      ]
    }
  );
  var AlignJustifyIcon = () => /* @__PURE__ */ jsxs(
    "svg",
    {
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      children: [
        /* @__PURE__ */ jsx("line", { x1: "21", y1: "10", x2: "3", y2: "10" }),
        /* @__PURE__ */ jsx("line", { x1: "21", y1: "6", x2: "3", y2: "6" }),
        /* @__PURE__ */ jsx("line", { x1: "21", y1: "14", x2: "3", y2: "14" }),
        /* @__PURE__ */ jsx("line", { x1: "21", y1: "18", x2: "3", y2: "18" })
      ]
    }
  );
  var UndoIcon = () => /* @__PURE__ */ jsxs(
    "svg",
    {
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      children: [
        /* @__PURE__ */ jsx("path", { d: "M3 7v6h6" }),
        /* @__PURE__ */ jsx("path", { d: "M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" })
      ]
    }
  );
  var RedoIcon = () => /* @__PURE__ */ jsxs(
    "svg",
    {
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      children: [
        /* @__PURE__ */ jsx("path", { d: "M21 7v6h-6" }),
        /* @__PURE__ */ jsx("path", { d: "M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7" })
      ]
    }
  );
  var TextColorIcon = ({ color = "#000000" }) => /* @__PURE__ */ jsxs(
    "svg",
    {
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      children: [
        /* @__PURE__ */ jsx("path", { d: "M4 20h16", stroke: color, strokeWidth: "4" }),
        /* @__PURE__ */ jsx("path", { d: "M9.5 4h5L17 16H7l2.5-12z" })
      ]
    }
  );
  var BgColorIcon = ({ color = "#ffffff" }) => /* @__PURE__ */ jsxs("svg", { viewBox: "0 0 24 24", fill: "none", children: [
    /* @__PURE__ */ jsx("rect", { x: "3", y: "3", width: "18", height: "18", rx: "2", fill: color, stroke: "currentColor", strokeWidth: "2" }),
    /* @__PURE__ */ jsx("path", { d: "M8 12h8M12 8v8", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round" })
  ] });
  var ParagraphIcon = () => /* @__PURE__ */ jsxs(
    "svg",
    {
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      children: [
        /* @__PURE__ */ jsx("path", { d: "M13 4v16" }),
        /* @__PURE__ */ jsx("path", { d: "M17 4v16" }),
        /* @__PURE__ */ jsx("path", { d: "M19 4H9.5a4.5 4.5 0 0 0 0 9H13" })
      ]
    }
  );
  var Heading1Icon = () => /* @__PURE__ */ jsxs(
    "svg",
    {
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      children: [
        /* @__PURE__ */ jsx("path", { d: "M4 12h8" }),
        /* @__PURE__ */ jsx("path", { d: "M4 18V6" }),
        /* @__PURE__ */ jsx("path", { d: "M12 18V6" }),
        /* @__PURE__ */ jsx("path", { d: "M17 12l3-2v8" })
      ]
    }
  );
  var Heading2Icon = () => /* @__PURE__ */ jsxs(
    "svg",
    {
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      children: [
        /* @__PURE__ */ jsx("path", { d: "M4 12h8" }),
        /* @__PURE__ */ jsx("path", { d: "M4 18V6" }),
        /* @__PURE__ */ jsx("path", { d: "M12 18V6" }),
        /* @__PURE__ */ jsx("path", { d: "M21 18h-4c0-4 4-3 4-6 0-1.5-2-2.5-4-1" })
      ]
    }
  );
  var Heading3Icon = () => /* @__PURE__ */ jsxs(
    "svg",
    {
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      children: [
        /* @__PURE__ */ jsx("path", { d: "M4 12h8" }),
        /* @__PURE__ */ jsx("path", { d: "M4 18V6" }),
        /* @__PURE__ */ jsx("path", { d: "M12 18V6" }),
        /* @__PURE__ */ jsx("path", { d: "M17.5 10.5c1.7-1 3.5 0 3.5 1.5a2 2 0 0 1-2 2" }),
        /* @__PURE__ */ jsx("path", { d: "M17 17.5c2 1.5 4 .3 4-1.5a2 2 0 0 0-2-2" })
      ]
    }
  );
  var Heading4Icon = () => /* @__PURE__ */ jsxs(
    "svg",
    {
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      children: [
        /* @__PURE__ */ jsx("path", { d: "M4 12h8" }),
        /* @__PURE__ */ jsx("path", { d: "M4 18V6" }),
        /* @__PURE__ */ jsx("path", { d: "M12 18V6" }),
        /* @__PURE__ */ jsx("path", { d: "M15 10v4h4" }),
        /* @__PURE__ */ jsx("path", { d: "M19 10v8" })
      ]
    }
  );
  var Heading5Icon = () => /* @__PURE__ */ jsxs(
    "svg",
    {
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      children: [
        /* @__PURE__ */ jsx("path", { d: "M4 12h8" }),
        /* @__PURE__ */ jsx("path", { d: "M4 18V6" }),
        /* @__PURE__ */ jsx("path", { d: "M12 18V6" }),
        /* @__PURE__ */ jsx("path", { d: "M17 18h2c.5 0 2 0 2-2s-1.5-2-2-2h-2v-4h4" })
      ]
    }
  );
  var Heading6Icon = () => /* @__PURE__ */ jsxs(
    "svg",
    {
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      children: [
        /* @__PURE__ */ jsx("path", { d: "M4 12h8" }),
        /* @__PURE__ */ jsx("path", { d: "M4 18V6" }),
        /* @__PURE__ */ jsx("path", { d: "M12 18V6" }),
        /* @__PURE__ */ jsx("circle", { cx: "19", cy: "16", r: "2" }),
        /* @__PURE__ */ jsx("path", { d: "M20 10c-2 2-3 3.5-3 6" })
      ]
    }
  );
  var QuoteIcon = () => /* @__PURE__ */ jsx("svg", { viewBox: "0 0 24 24", fill: "currentColor", children: /* @__PURE__ */ jsx("path", { d: "M6 17h3l2-4V7H5v6h3l-2 4zm8 0h3l2-4V7h-6v6h3l-2 4z" }) });
  var CodeBlockIcon = () => /* @__PURE__ */ jsxs(
    "svg",
    {
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      children: [
        /* @__PURE__ */ jsx("rect", { x: "3", y: "3", width: "18", height: "18", rx: "2" }),
        /* @__PURE__ */ jsx("polyline", { points: "9 8 5 12 9 16" }),
        /* @__PURE__ */ jsx("polyline", { points: "15 8 19 12 15 16" })
      ]
    }
  );
  var BulletListIcon = () => /* @__PURE__ */ jsxs(
    "svg",
    {
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      children: [
        /* @__PURE__ */ jsx("line", { x1: "8", y1: "6", x2: "21", y2: "6" }),
        /* @__PURE__ */ jsx("line", { x1: "8", y1: "12", x2: "21", y2: "12" }),
        /* @__PURE__ */ jsx("line", { x1: "8", y1: "18", x2: "21", y2: "18" }),
        /* @__PURE__ */ jsx("circle", { cx: "4", cy: "6", r: "1", fill: "currentColor" }),
        /* @__PURE__ */ jsx("circle", { cx: "4", cy: "12", r: "1", fill: "currentColor" }),
        /* @__PURE__ */ jsx("circle", { cx: "4", cy: "18", r: "1", fill: "currentColor" })
      ]
    }
  );
  var NumberedListIcon = () => /* @__PURE__ */ jsxs(
    "svg",
    {
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      children: [
        /* @__PURE__ */ jsx("line", { x1: "10", y1: "6", x2: "21", y2: "6" }),
        /* @__PURE__ */ jsx("line", { x1: "10", y1: "12", x2: "21", y2: "12" }),
        /* @__PURE__ */ jsx("line", { x1: "10", y1: "18", x2: "21", y2: "18" }),
        /* @__PURE__ */ jsx("text", { x: "3", y: "8", fontSize: "6", fill: "currentColor", stroke: "none", children: "1" }),
        /* @__PURE__ */ jsx("text", { x: "3", y: "14", fontSize: "6", fill: "currentColor", stroke: "none", children: "2" }),
        /* @__PURE__ */ jsx("text", { x: "3", y: "20", fontSize: "6", fill: "currentColor", stroke: "none", children: "3" })
      ]
    }
  );
  var CheckListIcon = () => /* @__PURE__ */ jsxs(
    "svg",
    {
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      children: [
        /* @__PURE__ */ jsx("path", { d: "M3 6h4v4H3z" }),
        /* @__PURE__ */ jsx("path", { d: "M5 7l1 1 2-2" }),
        /* @__PURE__ */ jsx("line", { x1: "10", y1: "8", x2: "21", y2: "8" }),
        /* @__PURE__ */ jsx("rect", { x: "3", y: "14", width: "4", height: "4" }),
        /* @__PURE__ */ jsx("line", { x1: "10", y1: "16", x2: "21", y2: "16" })
      ]
    }
  );
  var PlusIcon = () => /* @__PURE__ */ jsxs(
    "svg",
    {
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      children: [
        /* @__PURE__ */ jsx("line", { x1: "12", y1: "5", x2: "12", y2: "19" }),
        /* @__PURE__ */ jsx("line", { x1: "5", y1: "12", x2: "19", y2: "12" })
      ]
    }
  );
  var HorizontalRuleIcon = () => /* @__PURE__ */ jsx(
    "svg",
    {
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      children: /* @__PURE__ */ jsx("line", { x1: "3", y1: "12", x2: "21", y2: "12" })
    }
  );
  var TableIcon = () => /* @__PURE__ */ jsxs(
    "svg",
    {
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      children: [
        /* @__PURE__ */ jsx("rect", { x: "3", y: "3", width: "18", height: "18", rx: "2" }),
        /* @__PURE__ */ jsx("line", { x1: "3", y1: "9", x2: "21", y2: "9" }),
        /* @__PURE__ */ jsx("line", { x1: "3", y1: "15", x2: "21", y2: "15" }),
        /* @__PURE__ */ jsx("line", { x1: "9", y1: "3", x2: "9", y2: "21" }),
        /* @__PURE__ */ jsx("line", { x1: "15", y1: "3", x2: "15", y2: "21" })
      ]
    }
  );
  var ImageIcon = () => /* @__PURE__ */ jsxs(
    "svg",
    {
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      children: [
        /* @__PURE__ */ jsx("rect", { x: "3", y: "3", width: "18", height: "18", rx: "2" }),
        /* @__PURE__ */ jsx("circle", { cx: "8.5", cy: "8.5", r: "1.5" }),
        /* @__PURE__ */ jsx("polyline", { points: "21 15 16 10 5 21" })
      ]
    }
  );
  var VideoIcon = () => /* @__PURE__ */ jsxs(
    "svg",
    {
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      children: [
        /* @__PURE__ */ jsx("rect", { x: "2", y: "4", width: "20", height: "16", rx: "2" }),
        /* @__PURE__ */ jsx("polygon", { points: "10 9 15 12 10 15", fill: "currentColor" })
      ]
    }
  );
  var CollapsibleIcon = () => /* @__PURE__ */ jsx(
    "svg",
    {
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      children: /* @__PURE__ */ jsx("polyline", { points: "6 9 12 15 18 9" })
    }
  );
  var ChevronDownIcon = () => /* @__PURE__ */ jsx(
    "svg",
    {
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      style: { width: "12px", height: "12px" },
      children: /* @__PURE__ */ jsx("polyline", { points: "6 9 12 15 18 9" })
    }
  );
  var DragHandleIcon = () => /* @__PURE__ */ jsxs("svg", { viewBox: "0 0 24 24", fill: "currentColor", children: [
    /* @__PURE__ */ jsx("circle", { cx: "9", cy: "6", r: "1.5" }),
    /* @__PURE__ */ jsx("circle", { cx: "15", cy: "6", r: "1.5" }),
    /* @__PURE__ */ jsx("circle", { cx: "9", cy: "12", r: "1.5" }),
    /* @__PURE__ */ jsx("circle", { cx: "15", cy: "12", r: "1.5" }),
    /* @__PURE__ */ jsx("circle", { cx: "9", cy: "18", r: "1.5" }),
    /* @__PURE__ */ jsx("circle", { cx: "15", cy: "18", r: "1.5" })
  ] });
  var CheckIcon = () => /* @__PURE__ */ jsx(
    "svg",
    {
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      children: /* @__PURE__ */ jsx("polyline", { points: "20 6 9 17 4 12" })
    }
  );
  var EditIcon = () => /* @__PURE__ */ jsxs(
    "svg",
    {
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      children: [
        /* @__PURE__ */ jsx("path", { d: "M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" }),
        /* @__PURE__ */ jsx("path", { d: "M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" })
      ]
    }
  );
  var TrashIcon = () => /* @__PURE__ */ jsxs(
    "svg",
    {
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      children: [
        /* @__PURE__ */ jsx("polyline", { points: "3 6 5 6 21 6" }),
        /* @__PURE__ */ jsx("path", { d: "M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" })
      ]
    }
  );
  var ExternalLinkIcon = () => /* @__PURE__ */ jsxs(
    "svg",
    {
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      children: [
        /* @__PURE__ */ jsx("path", { d: "M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" }),
        /* @__PURE__ */ jsx("polyline", { points: "15 3 21 3 21 9" }),
        /* @__PURE__ */ jsx("line", { x1: "10", y1: "14", x2: "21", y2: "3" })
      ]
    }
  );
  var ClearFormattingIcon = () => /* @__PURE__ */ jsxs(
    "svg",
    {
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      children: [
        /* @__PURE__ */ jsx("path", { d: "M4 7V4h16v3" }),
        /* @__PURE__ */ jsx("path", { d: "M10 4v16" }),
        /* @__PURE__ */ jsx("path", { d: "M12 20h-4" }),
        /* @__PURE__ */ jsx("path", { d: "M5 19L19 5" })
      ]
    }
  );
  var FontSizeIncreaseIcon = () => /* @__PURE__ */ jsxs(
    "svg",
    {
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      children: [
        /* @__PURE__ */ jsx("line", { x1: "12", y1: "5", x2: "12", y2: "19" }),
        /* @__PURE__ */ jsx("line", { x1: "5", y1: "12", x2: "19", y2: "12" })
      ]
    }
  );
  var FontSizeDecreaseIcon = () => /* @__PURE__ */ jsx(
    "svg",
    {
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      children: /* @__PURE__ */ jsx("line", { x1: "5", y1: "12", x2: "19", y2: "12" })
    }
  );

  // src/shared/lexical-playground/plugins/CollapsiblePlugin.tsx
  var import_react19 = __toESM(require_react());
  init_Lexical();

  // src/shared/lexical-playground/nodes/CollapsibleNode.tsx
  init_Lexical();
  var CollapsibleContainerNode = class _CollapsibleContainerNode extends ElementNode {
    static getType() {
      return "collapsible-container";
    }
    static clone(node) {
      return new _CollapsibleContainerNode(node.__open, node.__key);
    }
    constructor(open = true, key) {
      super(key);
      this.__open = open;
    }
    createDOM(config) {
      const dom = document.createElement("details");
      dom.classList.add("PlaygroundEditorTheme__collapsible-container");
      dom.open = this.__open;
      return dom;
    }
    updateDOM(prevNode, dom) {
      if (prevNode.__open !== this.__open) {
        dom.open = this.__open;
      }
      return false;
    }
    static importDOM() {
      return {
        details: () => ({
          conversion: () => {
            return {
              node: $createCollapsibleContainerNode(true)
            };
          },
          priority: 1
        })
      };
    }
    static importJSON(serializedNode) {
      return $createCollapsibleContainerNode(serializedNode.open);
    }
    exportDOM() {
      const element = document.createElement("details");
      element.classList.add("PlaygroundEditorTheme__collapsible-container");
      element.open = this.__open;
      return { element };
    }
    exportJSON() {
      return {
        ...super.exportJSON(),
        type: "collapsible-container",
        open: this.__open,
        version: 1
      };
    }
    setOpen(open) {
      const writable = this.getWritable();
      writable.__open = open;
    }
    getOpen() {
      return this.__open;
    }
    toggleOpen() {
      this.setOpen(!this.getOpen());
    }
  };
  function $createCollapsibleContainerNode(open = true) {
    return new CollapsibleContainerNode(open);
  }
  var CollapsibleTitleNode = class _CollapsibleTitleNode extends ElementNode {
    static getType() {
      return "collapsible-title";
    }
    static clone(node) {
      return new _CollapsibleTitleNode(node.__key);
    }
    createDOM(config) {
      const dom = document.createElement("summary");
      dom.classList.add("PlaygroundEditorTheme__collapsible-title");
      return dom;
    }
    updateDOM() {
      return false;
    }
    static importDOM() {
      return {
        summary: () => ({
          conversion: () => {
            return { node: $createCollapsibleTitleNode() };
          },
          priority: 1
        })
      };
    }
    static importJSON() {
      return $createCollapsibleTitleNode();
    }
    exportDOM() {
      const element = document.createElement("summary");
      element.classList.add("PlaygroundEditorTheme__collapsible-title");
      return { element };
    }
    exportJSON() {
      return {
        ...super.exportJSON(),
        type: "collapsible-title",
        version: 1
      };
    }
    collapseAtStart() {
      return true;
    }
    insertNewAfter() {
      return null;
    }
  };
  function $createCollapsibleTitleNode() {
    return new CollapsibleTitleNode();
  }
  var CollapsibleContentNode = class _CollapsibleContentNode extends ElementNode {
    static getType() {
      return "collapsible-content";
    }
    static clone(node) {
      return new _CollapsibleContentNode(node.__key);
    }
    createDOM(config) {
      const dom = document.createElement("div");
      dom.classList.add("PlaygroundEditorTheme__collapsible-content");
      return dom;
    }
    updateDOM() {
      return false;
    }
    static importDOM() {
      return {};
    }
    static importJSON() {
      return $createCollapsibleContentNode();
    }
    exportDOM() {
      const element = document.createElement("div");
      element.classList.add("PlaygroundEditorTheme__collapsible-content");
      return { element };
    }
    exportJSON() {
      return {
        ...super.exportJSON(),
        type: "collapsible-content",
        version: 1
      };
    }
  };
  function $createCollapsibleContentNode() {
    return new CollapsibleContentNode();
  }

  // src/shared/lexical-playground/plugins/CollapsiblePlugin.tsx
  var INSERT_COLLAPSIBLE_COMMAND = createCommand("INSERT_COLLAPSIBLE_COMMAND");
  function CollapsiblePlugin() {
    const [editor] = useLexicalComposerContext();
    (0, import_react19.useEffect)(() => {
      return editor.registerCommand(
        INSERT_COLLAPSIBLE_COMMAND,
        () => {
          editor.update(() => {
            const container = $createCollapsibleContainerNode(true);
            const title = $createCollapsibleTitleNode();
            const content = $createCollapsibleContentNode();
            const paragraph = $createParagraphNode();
            title.append($createTextNode("Click to expand"));
            paragraph.append($createTextNode("Content goes here..."));
            content.append(paragraph);
            container.append(title, content);
            $insertNodes([container]);
          });
          return true;
        },
        COMMAND_PRIORITY_EDITOR
      );
    }, [editor]);
    return null;
  }

  // src/shared/lexical-playground/plugins/ToolbarPlugin/InsertDropdown.tsx
  function InsertDropdown({ editor, onMediaLibraryOpen }) {
    const [isOpen, setIsOpen] = (0, import_react20.useState)(false);
    const dropdownRef = (0, import_react20.useRef)(null);
    (0, import_react20.useEffect)(() => {
      const handleClickOutside = (e5) => {
        if (dropdownRef.current && !dropdownRef.current.contains(e5.target)) {
          setIsOpen(false);
        }
      };
      if (isOpen) {
        document.addEventListener("mousedown", handleClickOutside);
      }
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }, [isOpen]);
    const insertHorizontalRule = (0, import_react20.useCallback)(() => {
      editor.dispatchCommand(INSERT_HORIZONTAL_RULE_COMMAND2, void 0);
      setIsOpen(false);
    }, [editor]);
    const insertTable = (0, import_react20.useCallback)(() => {
      editor.dispatchCommand(INSERT_TABLE_COMMAND, { columns: "3", rows: "3", includeHeaders: true });
      setIsOpen(false);
    }, [editor]);
    const insertImage = (0, import_react20.useCallback)(() => {
      if (onMediaLibraryOpen) {
        onMediaLibraryOpen("image");
      }
      setIsOpen(false);
    }, [onMediaLibraryOpen]);
    const insertVideo = (0, import_react20.useCallback)(() => {
      if (onMediaLibraryOpen) {
        onMediaLibraryOpen("video");
      }
      setIsOpen(false);
    }, [onMediaLibraryOpen]);
    const insertCollapsible = (0, import_react20.useCallback)(() => {
      editor.dispatchCommand(INSERT_COLLAPSIBLE_COMMAND, void 0);
      setIsOpen(false);
    }, [editor]);
    const insertQuote = (0, import_react20.useCallback)(() => {
      editor.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          $setBlocksType(selection, () => $createQuoteNode());
        }
      });
      setIsOpen(false);
    }, [editor]);
    const insertCodeBlock = (0, import_react20.useCallback)(() => {
      editor.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          $setBlocksType(selection, () => $createCodeNode2());
        }
      });
      setIsOpen(false);
    }, [editor]);
    const insertBulletList = (0, import_react20.useCallback)(() => {
      editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, void 0);
      setIsOpen(false);
    }, [editor]);
    const insertNumberedList = (0, import_react20.useCallback)(() => {
      editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, void 0);
      setIsOpen(false);
    }, [editor]);
    const insertCheckList = (0, import_react20.useCallback)(() => {
      editor.dispatchCommand(INSERT_CHECK_LIST_COMMAND, void 0);
      setIsOpen(false);
    }, [editor]);
    const items = [
      {
        key: "horizontal-rule",
        label: "Horizontal Rule",
        icon: /* @__PURE__ */ jsx(HorizontalRuleIcon, {}),
        description: "Add a divider line",
        onClick: insertHorizontalRule
      },
      {
        key: "table",
        label: "Table",
        icon: /* @__PURE__ */ jsx(TableIcon, {}),
        description: "Insert a table",
        onClick: insertTable
      },
      {
        key: "image",
        label: "Image",
        icon: /* @__PURE__ */ jsx(ImageIcon, {}),
        description: "Insert an image",
        onClick: insertImage
      },
      {
        key: "video",
        label: "Video",
        icon: /* @__PURE__ */ jsx(VideoIcon, {}),
        description: "Insert a video",
        onClick: insertVideo
      },
      {
        key: "collapsible",
        label: "Collapsible",
        icon: /* @__PURE__ */ jsx(CollapsibleIcon, {}),
        description: "Add a collapsible section",
        onClick: insertCollapsible
      },
      {
        key: "quote",
        label: "Quote",
        icon: /* @__PURE__ */ jsx(QuoteIcon, {}),
        description: "Add a block quote",
        onClick: insertQuote
      },
      {
        key: "code-block",
        label: "Code Block",
        icon: /* @__PURE__ */ jsx(CodeBlockIcon, {}),
        description: "Add a code block",
        onClick: insertCodeBlock
      },
      {
        key: "bullet-list",
        label: "Bullet List",
        icon: /* @__PURE__ */ jsx(BulletListIcon, {}),
        description: "Create a bullet list",
        onClick: insertBulletList
      },
      {
        key: "numbered-list",
        label: "Numbered List",
        icon: /* @__PURE__ */ jsx(NumberedListIcon, {}),
        description: "Create a numbered list",
        onClick: insertNumberedList
      },
      {
        key: "check-list",
        label: "Check List",
        icon: /* @__PURE__ */ jsx(CheckListIcon, {}),
        description: "Create a checklist",
        onClick: insertCheckList
      }
    ];
    return /* @__PURE__ */ jsxs("div", { className: "lexical-playground-insert-dropdown", ref: dropdownRef, style: { position: "relative" }, children: [
      /* @__PURE__ */ jsx(
        "button",
        {
          type: "button",
          className: `lexical-playground-toolbar-btn ${isOpen ? "active" : ""}`,
          onClick: () => setIsOpen(!isOpen),
          title: "Insert",
          "aria-label": "Insert",
          "aria-expanded": isOpen,
          children: /* @__PURE__ */ jsx(PlusIcon, {})
        }
      ),
      isOpen && /* @__PURE__ */ jsx("div", { className: "lexical-playground-insert-menu", children: items.map((item) => /* @__PURE__ */ jsxs(
        "button",
        {
          type: "button",
          className: "lexical-playground-insert-menu-item",
          onClick: item.onClick,
          children: [
            /* @__PURE__ */ jsx("span", { className: "lexical-playground-insert-menu-item-icon", children: item.icon }),
            /* @__PURE__ */ jsxs("span", { className: "lexical-playground-insert-menu-item-text", children: [
              /* @__PURE__ */ jsx("span", { className: "lexical-playground-insert-menu-item-label", children: item.label }),
              item.description && /* @__PURE__ */ jsx("span", { className: "lexical-playground-insert-menu-item-description", children: item.description })
            ] })
          ]
        },
        item.key
      )) })
    ] });
  }

  // src/shared/lexical-playground/plugins/ToolbarPlugin/BlockTypeDropdown.tsx
  var import_react21 = __toESM(require_react());
  init_Lexical();
  init_LexicalSelection();
  var BLOCK_TYPE_OPTIONS = [
    { value: "paragraph", label: "Paragraph", icon: /* @__PURE__ */ jsx(ParagraphIcon, {}) },
    { value: "h1", label: "Heading 1", icon: /* @__PURE__ */ jsx(Heading1Icon, {}) },
    { value: "h2", label: "Heading 2", icon: /* @__PURE__ */ jsx(Heading2Icon, {}) },
    { value: "h3", label: "Heading 3", icon: /* @__PURE__ */ jsx(Heading3Icon, {}) },
    { value: "h4", label: "Heading 4", icon: /* @__PURE__ */ jsx(Heading4Icon, {}) },
    { value: "h5", label: "Heading 5", icon: /* @__PURE__ */ jsx(Heading5Icon, {}) },
    { value: "h6", label: "Heading 6", icon: /* @__PURE__ */ jsx(Heading6Icon, {}) },
    { value: "bullet", label: "Bullet List", icon: /* @__PURE__ */ jsx(BulletListIcon, {}) },
    { value: "number", label: "Numbered List", icon: /* @__PURE__ */ jsx(NumberedListIcon, {}) },
    { value: "check", label: "Check List", icon: /* @__PURE__ */ jsx(CheckListIcon, {}) },
    { value: "quote", label: "Quote", icon: /* @__PURE__ */ jsx(QuoteIcon, {}) },
    { value: "code", label: "Code Block", icon: /* @__PURE__ */ jsx(CodeBlockIcon, {}) }
  ];
  function BlockTypeDropdown({ editor, blockType, blockTypeLabel }) {
    const [isOpen, setIsOpen] = (0, import_react21.useState)(false);
    const dropdownRef = (0, import_react21.useRef)(null);
    (0, import_react21.useEffect)(() => {
      const handleClickOutside = (e5) => {
        if (dropdownRef.current && !dropdownRef.current.contains(e5.target)) {
          setIsOpen(false);
        }
      };
      if (isOpen) {
        document.addEventListener("mousedown", handleClickOutside);
      }
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }, [isOpen]);
    const formatBlock = (0, import_react21.useCallback)(
      (type) => {
        if (type === blockType) {
          setIsOpen(false);
          return;
        }
        if (type === "bullet") {
          editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, void 0);
        } else if (type === "number") {
          editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, void 0);
        } else if (type === "check") {
          editor.dispatchCommand(INSERT_CHECK_LIST_COMMAND, void 0);
        } else {
          if (["bullet", "number", "check"].includes(blockType)) {
            editor.dispatchCommand(REMOVE_LIST_COMMAND, void 0);
          }
          editor.update(() => {
            const selection = $getSelection();
            if ($isRangeSelection(selection)) {
              if (type === "paragraph") {
                $setBlocksType(selection, () => $createParagraphNode());
              } else if (type.startsWith("h")) {
                const tag = type;
                $setBlocksType(selection, () => $createHeadingNode(tag));
              } else if (type === "quote") {
                $setBlocksType(selection, () => $createQuoteNode());
              } else if (type === "code") {
                $setBlocksType(selection, () => $createCodeNode2());
              }
            }
          });
        }
        setIsOpen(false);
      },
      [editor, blockType]
    );
    const currentOption = BLOCK_TYPE_OPTIONS.find((opt) => opt.value === blockType);
    return /* @__PURE__ */ jsxs("div", { className: "lexical-playground-block-type-dropdown", ref: dropdownRef, style: { position: "relative" }, children: [
      /* @__PURE__ */ jsxs(
        "button",
        {
          type: "button",
          className: "lexical-playground-toolbar-dropdown",
          onClick: () => setIsOpen(!isOpen),
          "aria-expanded": isOpen,
          "aria-haspopup": "listbox",
          children: [
            /* @__PURE__ */ jsx("span", { className: "lexical-playground-toolbar-dropdown-icon", children: currentOption?.icon }),
            /* @__PURE__ */ jsx("span", { className: "lexical-playground-toolbar-dropdown-label", children: blockTypeLabel }),
            /* @__PURE__ */ jsx("span", { className: "lexical-playground-toolbar-dropdown-chevron", children: /* @__PURE__ */ jsx(ChevronDownIcon, {}) })
          ]
        }
      ),
      isOpen && /* @__PURE__ */ jsx("div", { className: "lexical-playground-dropdown-menu", role: "listbox", children: BLOCK_TYPE_OPTIONS.map((option) => /* @__PURE__ */ jsxs(
        "button",
        {
          type: "button",
          role: "option",
          className: `lexical-playground-dropdown-item ${blockType === option.value ? "active" : ""}`,
          onClick: () => formatBlock(option.value),
          "aria-selected": blockType === option.value,
          children: [
            /* @__PURE__ */ jsx("span", { className: "lexical-playground-dropdown-item-icon", children: option.icon }),
            /* @__PURE__ */ jsx("span", { className: "lexical-playground-dropdown-item-label", children: option.label })
          ]
        },
        option.value
      )) })
    ] });
  }

  // src/shared/lexical-playground/ui/ColorPicker.tsx
  var COLOR_PALETTE = [
    "#000000",
    "#434343",
    "#666666",
    "#999999",
    "#b7b7b7",
    "#cccccc",
    "#d9d9d9",
    "#efefef",
    "#f3f3f3",
    "#ffffff",
    "#980000",
    "#ff0000",
    "#ff9900",
    "#ffff00",
    "#00ff00",
    "#00ffff",
    "#4a86e8",
    "#0000ff",
    "#9900ff",
    "#ff00ff",
    "#e6b8af",
    "#f4cccc",
    "#fce5cd",
    "#fff2cc",
    "#d9ead3",
    "#d0e0e3",
    "#c9daf8",
    "#cfe2f3",
    "#d9d2e9",
    "#ead1dc",
    "#dd7e6b",
    "#ea9999",
    "#f9cb9c",
    "#ffe599",
    "#b6d7a8",
    "#a2c4c9",
    "#a4c2f4",
    "#9fc5e8",
    "#b4a7d6",
    "#d5a6bd",
    "#cc4125",
    "#e06666",
    "#f6b26b",
    "#ffd966",
    "#93c47d",
    "#76a5af",
    "#6d9eeb",
    "#6fa8dc",
    "#8e7cc3",
    "#c27ba0",
    "#a61c00",
    "#cc0000",
    "#e69138",
    "#f1c232",
    "#6aa84f",
    "#45818e",
    "#3c78d8",
    "#3d85c6",
    "#674ea7",
    "#a64d79",
    "#85200c",
    "#990000",
    "#b45f06",
    "#bf9000",
    "#38761d",
    "#134f5c",
    "#1155cc",
    "#0b5394",
    "#351c75",
    "#741b47",
    "#5b0f00",
    "#660000",
    "#783f04",
    "#7f6000",
    "#274e13",
    "#0c343d",
    "#1c4587",
    "#073763",
    "#20124d",
    "#4c1130"
  ];
  function ColorPicker({ color, onChange }) {
    return /* @__PURE__ */ jsxs("div", { className: "lexical-playground-color-picker", children: [
      /* @__PURE__ */ jsx("div", { className: "lexical-playground-color-picker-grid", children: COLOR_PALETTE.map((c10) => /* @__PURE__ */ jsx(
        "button",
        {
          type: "button",
          className: `lexical-playground-color-swatch ${color === c10 ? "selected" : ""}`,
          style: { backgroundColor: c10 },
          onClick: () => onChange(c10),
          "aria-label": `Color ${c10}`
        },
        c10
      )) }),
      /* @__PURE__ */ jsxs("div", { className: "lexical-playground-color-picker-custom", children: [
        /* @__PURE__ */ jsx("input", { type: "color", value: color, onChange: (e5) => onChange(e5.target.value), "aria-label": "Custom color" }),
        /* @__PURE__ */ jsx("span", { children: "Custom" })
      ] })
    ] });
  }

  // src/shared/lexical-playground/ui/ToolbarComponents.tsx
  function ToolbarButton({
    onClick,
    active = false,
    disabled = false,
    title,
    icon,
    className = ""
  }) {
    return /* @__PURE__ */ jsx(
      "button",
      {
        type: "button",
        className: `lexical-playground-toolbar-btn ${active ? "active" : ""} ${className}`,
        onClick,
        disabled,
        title,
        "aria-label": title,
        "aria-pressed": active,
        children: icon
      }
    );
  }
  function ToolbarDivider() {
    return /* @__PURE__ */ jsx("div", { className: "divider lexical-playground-toolbar-divider" });
  }

  // src/shared/lexical-playground/plugins/ToolbarPlugin/index.tsx
  var BLOCK_TYPE_TO_LABEL = {
    paragraph: "Normal",
    h1: "Heading 1",
    h2: "Heading 2",
    h3: "Heading 3",
    h4: "Heading 4",
    h5: "Heading 5",
    h6: "Heading 6",
    quote: "Quote",
    bullet: "Bulleted List",
    number: "Numbered List",
    check: "Check List",
    code: "Code Block"
  };
  var FONT_FAMILY_OPTIONS = [
    ["Arial", "Arial"],
    ["Courier New", "Courier New"],
    ["Georgia", "Georgia"],
    ["Times New Roman", "Times New Roman"],
    ["Trebuchet MS", "Trebuchet MS"],
    ["Verdana", "Verdana"]
  ];
  var FONT_SIZE_OPTIONS = [
    "10px",
    "11px",
    "12px",
    "13px",
    "14px",
    "15px",
    "16px",
    "17px",
    "18px",
    "19px",
    "20px",
    "24px",
    "30px",
    "36px",
    "48px",
    "60px",
    "72px",
    "96px"
  ];
  var DEFAULT_FONT_SIZE = "15px";
  function useDropdownClose(dropdownRef, isOpen, setIsOpen) {
    (0, import_react22.useEffect)(() => {
      const handleClickOutside = (e5) => {
        if (dropdownRef.current && !dropdownRef.current.contains(e5.target)) {
          setIsOpen(false);
        }
      };
      if (isOpen) {
        document.addEventListener("mousedown", handleClickOutside);
      }
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }, [isOpen, setIsOpen, dropdownRef]);
  }
  function ToolbarPlugin({ onMediaLibraryOpen, setIsLinkEditMode }) {
    const [editor] = useLexicalComposerContext();
    const [blockType, setBlockType] = (0, import_react22.useState)("paragraph");
    const [elementFormat, setElementFormat] = (0, import_react22.useState)("left");
    const [isBold, setIsBold] = (0, import_react22.useState)(false);
    const [isItalic, setIsItalic] = (0, import_react22.useState)(false);
    const [isUnderline, setIsUnderline] = (0, import_react22.useState)(false);
    const [isStrikethrough, setIsStrikethrough] = (0, import_react22.useState)(false);
    const [isSubscript, setIsSubscript] = (0, import_react22.useState)(false);
    const [isSuperscript, setIsSuperscript] = (0, import_react22.useState)(false);
    const [isCode, setIsCode] = (0, import_react22.useState)(false);
    const [isLink, setIsLink] = (0, import_react22.useState)(false);
    const [canUndo, setCanUndo] = (0, import_react22.useState)(false);
    const [canRedo, setCanRedo] = (0, import_react22.useState)(false);
    const [fontFamily, setFontFamily] = (0, import_react22.useState)("Arial");
    const [fontSize, setFontSize] = (0, import_react22.useState)(DEFAULT_FONT_SIZE);
    const [fontColor, setFontColor] = (0, import_react22.useState)("#000000");
    const [bgColor, setBgColor] = (0, import_react22.useState)("#ffffff");
    const [showFontFamilyDropdown, setShowFontFamilyDropdown] = (0, import_react22.useState)(false);
    const [showFontSizeDropdown, setShowFontSizeDropdown] = (0, import_react22.useState)(false);
    const [showColorPicker, setShowColorPicker] = (0, import_react22.useState)(null);
    const [showMoreTextDropdown, setShowMoreTextDropdown] = (0, import_react22.useState)(false);
    const [showAlignDropdown, setShowAlignDropdown] = (0, import_react22.useState)(false);
    const fontFamilyRef = (0, import_react22.useRef)(null);
    const fontSizeRef = (0, import_react22.useRef)(null);
    const colorPickerRef = (0, import_react22.useRef)(null);
    const moreTextRef = (0, import_react22.useRef)(null);
    const alignRef = (0, import_react22.useRef)(null);
    useDropdownClose(fontFamilyRef, showFontFamilyDropdown, setShowFontFamilyDropdown);
    useDropdownClose(fontSizeRef, showFontSizeDropdown, setShowFontSizeDropdown);
    useDropdownClose(moreTextRef, showMoreTextDropdown, setShowMoreTextDropdown);
    useDropdownClose(alignRef, showAlignDropdown, setShowAlignDropdown);
    (0, import_react22.useEffect)(() => {
      const handleClickOutside = (e5) => {
        if (colorPickerRef.current && !colorPickerRef.current.contains(e5.target)) {
          setShowColorPicker(null);
        }
      };
      if (showColorPicker) {
        document.addEventListener("mousedown", handleClickOutside);
      }
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }, [showColorPicker]);
    const updateToolbar = (0, import_react22.useCallback)(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        setIsBold(selection.hasFormat("bold"));
        setIsItalic(selection.hasFormat("italic"));
        setIsUnderline(selection.hasFormat("underline"));
        setIsStrikethrough(selection.hasFormat("strikethrough"));
        setIsSubscript(selection.hasFormat("subscript"));
        setIsSuperscript(selection.hasFormat("superscript"));
        setIsCode(selection.hasFormat("code"));
        const node = selection.anchor.getNode();
        const parent = node.getParent();
        setIsLink($isLinkNode(parent) || $isLinkNode(node));
        const family = $getSelectionStyleValueForProperty(selection, "font-family", "Arial");
        setFontFamily(family);
        const size = $getSelectionStyleValueForProperty(selection, "font-size", DEFAULT_FONT_SIZE);
        setFontSize(size);
        const color = $getSelectionStyleValueForProperty(selection, "color", "#000000");
        setFontColor(color);
        const bg = $getSelectionStyleValueForProperty(selection, "background-color", "#ffffff");
        setBgColor(bg);
        const anchorNode = selection.anchor.getNode();
        let element = anchorNode.getKey() === "root" ? anchorNode : $findMatchingParent2(anchorNode, (e5) => {
          const parent2 = e5.getParent();
          return parent2 !== null && $isRootOrShadowRoot(parent2);
        });
        if (element === null) {
          element = anchorNode.getTopLevelElementOrThrow();
        }
        const elementDOM = editor.getElementByKey(element.getKey());
        if (elementDOM !== null) {
          if ($isListNode(element)) {
            const parentList = $findMatchingParent2(anchorNode, (node2) => $isListNode(node2));
            const type = parentList ? parentList.getListType() : element.getListType();
            if (type === "bullet") setBlockType("bullet");
            else if (type === "number") setBlockType("number");
            else if (type === "check") setBlockType("check");
          } else {
            const type = element.getType();
            if ($isHeadingNode(element)) {
              const tag = element.getTag();
              setBlockType(tag);
            } else if ($isCodeNode2(element)) {
              setBlockType("code");
            } else if (type === "quote") {
              setBlockType("quote");
            } else {
              setBlockType("paragraph");
            }
          }
        }
        const formatType = element.getFormatType?.() || "left";
        setElementFormat(formatType);
      }
    }, [editor]);
    (0, import_react22.useEffect)(() => {
      return mergeRegister(
        editor.registerCommand(
          SELECTION_CHANGE_COMMAND,
          () => {
            updateToolbar();
            return false;
          },
          COMMAND_PRIORITY_CRITICAL
        ),
        editor.registerUpdateListener(({ editorState }) => {
          editorState.read(() => {
            updateToolbar();
          });
        }),
        editor.registerCommand(
          CAN_UNDO_COMMAND,
          (payload) => {
            setCanUndo(payload);
            return false;
          },
          COMMAND_PRIORITY_CRITICAL
        ),
        editor.registerCommand(
          CAN_REDO_COMMAND,
          (payload) => {
            setCanRedo(payload);
            return false;
          },
          COMMAND_PRIORITY_CRITICAL
        )
      );
    }, [editor, updateToolbar]);
    const formatBold = () => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "bold");
    const formatItalic = () => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "italic");
    const formatUnderline = () => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "underline");
    const formatStrikethrough = () => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "strikethrough");
    const formatSubscript = () => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "subscript");
    const formatSuperscript = () => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "superscript");
    const formatCode = () => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "code");
    const formatAlignment = (0, import_react22.useCallback)(
      (alignment) => {
        editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, alignment);
        setShowAlignDropdown(false);
      },
      [editor]
    );
    const undo = () => editor.dispatchCommand(UNDO_COMMAND, void 0);
    const redo = () => editor.dispatchCommand(REDO_COMMAND, void 0);
    const insertLink = (0, import_react22.useCallback)(() => {
      if (!isLink) {
        setIsLinkEditMode(true);
        editor.dispatchCommand(TOGGLE_LINK_COMMAND, "https://");
      } else {
        editor.dispatchCommand(TOGGLE_LINK_COMMAND, null);
      }
    }, [editor, isLink, setIsLinkEditMode]);
    const applyFontFamily = (0, import_react22.useCallback)(
      (family) => {
        editor.update(() => {
          const selection = $getSelection();
          if ($isRangeSelection(selection)) {
            $patchStyleText(selection, { "font-family": family });
          }
        });
        setFontFamily(family);
        setShowFontFamilyDropdown(false);
      },
      [editor]
    );
    const applyFontSize = (0, import_react22.useCallback)(
      (size) => {
        editor.update(() => {
          const selection = $getSelection();
          if ($isRangeSelection(selection)) {
            $patchStyleText(selection, { "font-size": size });
          }
        });
        setFontSize(size);
        setShowFontSizeDropdown(false);
      },
      [editor]
    );
    const incrementFontSize = (0, import_react22.useCallback)(() => {
      const currentIndex = FONT_SIZE_OPTIONS.indexOf(fontSize);
      if (currentIndex < FONT_SIZE_OPTIONS.length - 1) {
        applyFontSize(FONT_SIZE_OPTIONS[currentIndex + 1]);
      }
    }, [fontSize, applyFontSize]);
    const decrementFontSize = (0, import_react22.useCallback)(() => {
      const currentIndex = FONT_SIZE_OPTIONS.indexOf(fontSize);
      if (currentIndex > 0) {
        applyFontSize(FONT_SIZE_OPTIONS[currentIndex - 1]);
      }
    }, [fontSize, applyFontSize]);
    const applyFontColor = (0, import_react22.useCallback)(
      (color) => {
        editor.update(() => {
          const selection = $getSelection();
          if ($isRangeSelection(selection)) {
            $patchStyleText(selection, { color });
          }
        });
        setFontColor(color);
        setShowColorPicker(null);
      },
      [editor]
    );
    const applyBgColor = (0, import_react22.useCallback)(
      (color) => {
        editor.update(() => {
          const selection = $getSelection();
          if ($isRangeSelection(selection)) {
            $patchStyleText(selection, { "background-color": color });
          }
        });
        setBgColor(color);
        setShowColorPicker(null);
      },
      [editor]
    );
    const clearFormatting = (0, import_react22.useCallback)(() => {
      editor.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          selection.getNodes().forEach((node) => {
            if (node.getType() === "text") {
              node.setFormat(0);
              node.setStyle("");
            }
          });
        }
      });
      setShowMoreTextDropdown(false);
    }, [editor]);
    const getAlignmentIcon = () => {
      switch (elementFormat) {
        case "center":
          return /* @__PURE__ */ jsx(AlignCenterIcon, {});
        case "right":
          return /* @__PURE__ */ jsx(AlignRightIcon, {});
        case "justify":
          return /* @__PURE__ */ jsx(AlignJustifyIcon, {});
        default:
          return /* @__PURE__ */ jsx(AlignLeftIcon, {});
      }
    };
    return /* @__PURE__ */ jsxs("div", { className: "toolbar", children: [
      /* @__PURE__ */ jsx(ToolbarButton, { onClick: undo, disabled: !canUndo, title: "Undo (Ctrl+Z)", icon: /* @__PURE__ */ jsx(UndoIcon, {}) }),
      /* @__PURE__ */ jsx(ToolbarButton, { onClick: redo, disabled: !canRedo, title: "Redo (Ctrl+Y)", icon: /* @__PURE__ */ jsx(RedoIcon, {}) }),
      /* @__PURE__ */ jsx(ToolbarDivider, {}),
      /* @__PURE__ */ jsx(BlockTypeDropdown, { editor, blockType, blockTypeLabel: BLOCK_TYPE_TO_LABEL[blockType] }),
      /* @__PURE__ */ jsx(ToolbarDivider, {}),
      /* @__PURE__ */ jsxs("div", { className: "toolbar-item dropdown", ref: fontFamilyRef, children: [
        /* @__PURE__ */ jsxs(
          "button",
          {
            type: "button",
            className: "toolbar-item font-family-dropdown",
            onClick: () => setShowFontFamilyDropdown(!showFontFamilyDropdown),
            title: "Font Family",
            "aria-label": "Font Family",
            "aria-haspopup": "listbox",
            "aria-expanded": showFontFamilyDropdown,
            children: [
              /* @__PURE__ */ jsx("span", { className: "text", style: { fontFamily }, children: fontFamily }),
              /* @__PURE__ */ jsx(ChevronDownIcon, {})
            ]
          }
        ),
        showFontFamilyDropdown && /* @__PURE__ */ jsx("div", { className: "dropdown-menu", role: "listbox", children: FONT_FAMILY_OPTIONS.map(([label, value]) => /* @__PURE__ */ jsx(
          "button",
          {
            type: "button",
            role: "option",
            className: `dropdown-item ${fontFamily === value ? "active" : ""}`,
            onClick: () => applyFontFamily(value),
            style: { fontFamily: value },
            "aria-selected": fontFamily === value,
            children: label
          },
          value
        )) })
      ] }),
      /* @__PURE__ */ jsx(ToolbarDivider, {}),
      /* @__PURE__ */ jsx(
        ToolbarButton,
        {
          onClick: decrementFontSize,
          disabled: FONT_SIZE_OPTIONS.indexOf(fontSize) <= 0,
          title: "Decrease Font Size",
          icon: /* @__PURE__ */ jsx(FontSizeDecreaseIcon, {})
        }
      ),
      /* @__PURE__ */ jsxs("div", { className: "toolbar-item dropdown", ref: fontSizeRef, children: [
        /* @__PURE__ */ jsx(
          "button",
          {
            type: "button",
            className: "toolbar-item font-size-dropdown",
            onClick: () => setShowFontSizeDropdown(!showFontSizeDropdown),
            title: "Font Size",
            "aria-label": "Font Size",
            "aria-haspopup": "listbox",
            "aria-expanded": showFontSizeDropdown,
            children: /* @__PURE__ */ jsx("span", { className: "text", children: fontSize.replace("px", "") })
          }
        ),
        showFontSizeDropdown && /* @__PURE__ */ jsx("div", { className: "dropdown-menu font-size-menu", role: "listbox", children: FONT_SIZE_OPTIONS.map((size) => /* @__PURE__ */ jsx(
          "button",
          {
            type: "button",
            role: "option",
            className: `dropdown-item ${fontSize === size ? "active" : ""}`,
            onClick: () => applyFontSize(size),
            "aria-selected": fontSize === size,
            children: size.replace("px", "")
          },
          size
        )) })
      ] }),
      /* @__PURE__ */ jsx(
        ToolbarButton,
        {
          onClick: incrementFontSize,
          disabled: FONT_SIZE_OPTIONS.indexOf(fontSize) >= FONT_SIZE_OPTIONS.length - 1,
          title: "Increase Font Size",
          icon: /* @__PURE__ */ jsx(FontSizeIncreaseIcon, {})
        }
      ),
      /* @__PURE__ */ jsx(ToolbarDivider, {}),
      /* @__PURE__ */ jsx(ToolbarButton, { onClick: formatBold, active: isBold, title: "Bold (Ctrl+B)", icon: /* @__PURE__ */ jsx(BoldIcon, {}) }),
      /* @__PURE__ */ jsx(ToolbarButton, { onClick: formatItalic, active: isItalic, title: "Italic (Ctrl+I)", icon: /* @__PURE__ */ jsx(ItalicIcon, {}) }),
      /* @__PURE__ */ jsx(ToolbarButton, { onClick: formatUnderline, active: isUnderline, title: "Underline (Ctrl+U)", icon: /* @__PURE__ */ jsx(UnderlineIcon, {}) }),
      /* @__PURE__ */ jsx(ToolbarButton, { onClick: formatCode, active: isCode, title: "Insert Code", icon: /* @__PURE__ */ jsx(CodeIcon, {}) }),
      /* @__PURE__ */ jsx(ToolbarButton, { onClick: insertLink, active: isLink, title: "Insert Link", icon: /* @__PURE__ */ jsx(LinkIcon, {}) }),
      /* @__PURE__ */ jsx(ToolbarDivider, {}),
      /* @__PURE__ */ jsxs("div", { className: "toolbar-item dropdown", ref: colorPickerRef, children: [
        /* @__PURE__ */ jsx(
          ToolbarButton,
          {
            onClick: () => setShowColorPicker(showColorPicker === "font" ? null : "font"),
            title: "Text Color",
            icon: /* @__PURE__ */ jsx(TextColorIcon, { color: fontColor })
          }
        ),
        showColorPicker === "font" && /* @__PURE__ */ jsx(ColorPicker, { color: fontColor, onChange: applyFontColor })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "toolbar-item dropdown", children: [
        /* @__PURE__ */ jsx(
          ToolbarButton,
          {
            onClick: () => setShowColorPicker(showColorPicker === "bg" ? null : "bg"),
            title: "Background Color",
            icon: /* @__PURE__ */ jsx(BgColorIcon, { color: bgColor })
          }
        ),
        showColorPicker === "bg" && /* @__PURE__ */ jsx(ColorPicker, { color: bgColor, onChange: applyBgColor })
      ] }),
      /* @__PURE__ */ jsx(ToolbarDivider, {}),
      /* @__PURE__ */ jsxs("div", { className: "toolbar-item dropdown", ref: moreTextRef, children: [
        /* @__PURE__ */ jsxs(
          "button",
          {
            type: "button",
            className: `toolbar-item spaced ${showMoreTextDropdown ? "active" : ""}`,
            onClick: () => setShowMoreTextDropdown(!showMoreTextDropdown),
            title: "More Text Styles",
            "aria-label": "More Text Styles",
            "aria-haspopup": "listbox",
            "aria-expanded": showMoreTextDropdown,
            children: [
              /* @__PURE__ */ jsx("i", { className: "format more-text" }),
              /* @__PURE__ */ jsx("span", { className: "text", children: "Aa" }),
              /* @__PURE__ */ jsx(ChevronDownIcon, {})
            ]
          }
        ),
        showMoreTextDropdown && /* @__PURE__ */ jsxs("div", { className: "dropdown-menu", role: "listbox", children: [
          /* @__PURE__ */ jsxs(
            "button",
            {
              type: "button",
              className: `dropdown-item ${isStrikethrough ? "active" : ""}`,
              onClick: () => {
                formatStrikethrough();
                setShowMoreTextDropdown(false);
              },
              children: [
                /* @__PURE__ */ jsx(StrikethroughIcon, {}),
                /* @__PURE__ */ jsx("span", { className: "text", children: "Strikethrough" })
              ]
            }
          ),
          /* @__PURE__ */ jsxs(
            "button",
            {
              type: "button",
              className: `dropdown-item ${isSubscript ? "active" : ""}`,
              onClick: () => {
                formatSubscript();
                setShowMoreTextDropdown(false);
              },
              children: [
                /* @__PURE__ */ jsx(SubscriptIcon, {}),
                /* @__PURE__ */ jsx("span", { className: "text", children: "Subscript" })
              ]
            }
          ),
          /* @__PURE__ */ jsxs(
            "button",
            {
              type: "button",
              className: `dropdown-item ${isSuperscript ? "active" : ""}`,
              onClick: () => {
                formatSuperscript();
                setShowMoreTextDropdown(false);
              },
              children: [
                /* @__PURE__ */ jsx(SuperscriptIcon, {}),
                /* @__PURE__ */ jsx("span", { className: "text", children: "Superscript" })
              ]
            }
          ),
          /* @__PURE__ */ jsxs("button", { type: "button", className: "dropdown-item", onClick: clearFormatting, children: [
            /* @__PURE__ */ jsx(ClearFormattingIcon, {}),
            /* @__PURE__ */ jsx("span", { className: "text", children: "Clear Formatting" })
          ] })
        ] })
      ] }),
      /* @__PURE__ */ jsx(ToolbarDivider, {}),
      /* @__PURE__ */ jsx(InsertDropdown, { editor, onMediaLibraryOpen }),
      /* @__PURE__ */ jsx(ToolbarDivider, {}),
      /* @__PURE__ */ jsxs("div", { className: "toolbar-item dropdown", ref: alignRef, children: [
        /* @__PURE__ */ jsxs(
          "button",
          {
            type: "button",
            className: `toolbar-item spaced ${showAlignDropdown ? "active" : ""}`,
            onClick: () => setShowAlignDropdown(!showAlignDropdown),
            title: "Text Alignment",
            "aria-label": "Text Alignment",
            "aria-haspopup": "listbox",
            "aria-expanded": showAlignDropdown,
            children: [
              getAlignmentIcon(),
              /* @__PURE__ */ jsx(ChevronDownIcon, {})
            ]
          }
        ),
        showAlignDropdown && /* @__PURE__ */ jsxs("div", { className: "dropdown-menu", role: "listbox", children: [
          /* @__PURE__ */ jsxs(
            "button",
            {
              type: "button",
              className: `dropdown-item ${elementFormat === "left" ? "active" : ""}`,
              onClick: () => formatAlignment("left"),
              children: [
                /* @__PURE__ */ jsx(AlignLeftIcon, {}),
                /* @__PURE__ */ jsx("span", { className: "text", children: "Left Align" })
              ]
            }
          ),
          /* @__PURE__ */ jsxs(
            "button",
            {
              type: "button",
              className: `dropdown-item ${elementFormat === "center" ? "active" : ""}`,
              onClick: () => formatAlignment("center"),
              children: [
                /* @__PURE__ */ jsx(AlignCenterIcon, {}),
                /* @__PURE__ */ jsx("span", { className: "text", children: "Center Align" })
              ]
            }
          ),
          /* @__PURE__ */ jsxs(
            "button",
            {
              type: "button",
              className: `dropdown-item ${elementFormat === "right" ? "active" : ""}`,
              onClick: () => formatAlignment("right"),
              children: [
                /* @__PURE__ */ jsx(AlignRightIcon, {}),
                /* @__PURE__ */ jsx("span", { className: "text", children: "Right Align" })
              ]
            }
          ),
          /* @__PURE__ */ jsxs(
            "button",
            {
              type: "button",
              className: `dropdown-item ${elementFormat === "justify" ? "active" : ""}`,
              onClick: () => formatAlignment("justify"),
              children: [
                /* @__PURE__ */ jsx(AlignJustifyIcon, {}),
                /* @__PURE__ */ jsx("span", { className: "text", children: "Justify" })
              ]
            }
          )
        ] })
      ] })
    ] });
  }

  // src/shared/lexical-playground/plugins/FloatingTextFormatPlugin.tsx
  var import_react23 = __toESM(require_react());
  init_Lexical();
  var import_react_dom2 = __toESM(require_react_dom());
  function FloatingToolbar({ anchorElem }) {
    const [editor] = useLexicalComposerContext();
    const toolbarRef = (0, import_react23.useRef)(null);
    const [isVisible, setIsVisible] = (0, import_react23.useState)(false);
    const [isBold, setIsBold] = (0, import_react23.useState)(false);
    const [isItalic, setIsItalic] = (0, import_react23.useState)(false);
    const [isUnderline, setIsUnderline] = (0, import_react23.useState)(false);
    const [isStrikethrough, setIsStrikethrough] = (0, import_react23.useState)(false);
    const [isCode, setIsCode] = (0, import_react23.useState)(false);
    const [isLink, setIsLink] = (0, import_react23.useState)(false);
    const [position, setPosition] = (0, import_react23.useState)({ top: 0, left: 0 });
    const updateToolbar = (0, import_react23.useCallback)(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection) || selection.isCollapsed()) {
        setIsVisible(false);
        return;
      }
      setIsBold(selection.hasFormat("bold"));
      setIsItalic(selection.hasFormat("italic"));
      setIsUnderline(selection.hasFormat("underline"));
      setIsStrikethrough(selection.hasFormat("strikethrough"));
      setIsCode(selection.hasFormat("code"));
      const node = selection.anchor.getNode();
      const parent = node.getParent();
      setIsLink($isLinkNode(parent) || $isLinkNode(node));
      const nativeSelection = window.getSelection();
      if (nativeSelection && nativeSelection.rangeCount > 0) {
        const range = nativeSelection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        const anchorRect = anchorElem.getBoundingClientRect();
        setPosition({
          top: rect.top - anchorRect.top - 45,
          left: rect.left - anchorRect.left + rect.width / 2 - 100
        });
        setIsVisible(true);
      }
    }, [anchorElem]);
    (0, import_react23.useEffect)(() => {
      return mergeRegister(
        editor.registerCommand(
          SELECTION_CHANGE_COMMAND,
          () => {
            updateToolbar();
            return false;
          },
          COMMAND_PRIORITY_LOW
        ),
        editor.registerUpdateListener(({ editorState }) => {
          editorState.read(() => {
            updateToolbar();
          });
        })
      );
    }, [editor, updateToolbar]);
    (0, import_react23.useEffect)(() => {
      const handleMouseDown = (e5) => {
        if (toolbarRef.current && !toolbarRef.current.contains(e5.target)) {
        }
      };
      document.addEventListener("mousedown", handleMouseDown);
      return () => document.removeEventListener("mousedown", handleMouseDown);
    }, []);
    if (!isVisible) return null;
    return (0, import_react_dom2.createPortal)(
      /* @__PURE__ */ jsxs(
        "div",
        {
          ref: toolbarRef,
          className: "lexical-playground-floating-toolbar",
          style: {
            position: "absolute",
            top: `${position.top}px`,
            left: `${position.left}px`
          },
          children: [
            /* @__PURE__ */ jsx(
              "button",
              {
                type: "button",
                className: `lexical-playground-floating-toolbar-btn ${isBold ? "active" : ""}`,
                onClick: () => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "bold"),
                "aria-label": "Bold",
                children: /* @__PURE__ */ jsx(BoldIcon, {})
              }
            ),
            /* @__PURE__ */ jsx(
              "button",
              {
                type: "button",
                className: `lexical-playground-floating-toolbar-btn ${isItalic ? "active" : ""}`,
                onClick: () => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "italic"),
                "aria-label": "Italic",
                children: /* @__PURE__ */ jsx(ItalicIcon, {})
              }
            ),
            /* @__PURE__ */ jsx(
              "button",
              {
                type: "button",
                className: `lexical-playground-floating-toolbar-btn ${isUnderline ? "active" : ""}`,
                onClick: () => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "underline"),
                "aria-label": "Underline",
                children: /* @__PURE__ */ jsx(UnderlineIcon, {})
              }
            ),
            /* @__PURE__ */ jsx(
              "button",
              {
                type: "button",
                className: `lexical-playground-floating-toolbar-btn ${isStrikethrough ? "active" : ""}`,
                onClick: () => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "strikethrough"),
                "aria-label": "Strikethrough",
                children: /* @__PURE__ */ jsx(StrikethroughIcon, {})
              }
            ),
            /* @__PURE__ */ jsx("div", { className: "lexical-playground-floating-toolbar-divider" }),
            /* @__PURE__ */ jsx(
              "button",
              {
                type: "button",
                className: `lexical-playground-floating-toolbar-btn ${isCode ? "active" : ""}`,
                onClick: () => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "code"),
                "aria-label": "Code",
                children: /* @__PURE__ */ jsx(CodeIcon, {})
              }
            ),
            /* @__PURE__ */ jsx(
              "button",
              {
                type: "button",
                className: `lexical-playground-floating-toolbar-btn ${isLink ? "active" : ""}`,
                onClick: () => {
                  if (isLink) {
                    editor.dispatchCommand(TOGGLE_LINK_COMMAND, null);
                  } else {
                    editor.dispatchCommand(TOGGLE_LINK_COMMAND, "https://");
                  }
                },
                "aria-label": "Link",
                children: /* @__PURE__ */ jsx(LinkIcon, {})
              }
            )
          ]
        }
      ),
      anchorElem
    );
  }
  function FloatingTextFormatPlugin({ anchorElem }) {
    if (!anchorElem) return null;
    return /* @__PURE__ */ jsx(FloatingToolbar, { anchorElem });
  }

  // src/shared/lexical-playground/plugins/FloatingLinkEditorPlugin.tsx
  var import_react24 = __toESM(require_react());
  init_Lexical();
  var import_react_dom3 = __toESM(require_react_dom());
  function FloatingLinkEditor({
    anchorElem,
    isLinkEditMode,
    setIsLinkEditMode
  }) {
    const [editor] = useLexicalComposerContext();
    const inputRef = (0, import_react24.useRef)(null);
    const [linkUrl, setLinkUrl] = (0, import_react24.useState)("");
    const [editedLinkUrl, setEditedLinkUrl] = (0, import_react24.useState)("");
    const [isLink, setIsLink] = (0, import_react24.useState)(false);
    const [position, setPosition] = (0, import_react24.useState)({ top: 0, left: 0 });
    const [isAutoLink, setIsAutoLink] = (0, import_react24.useState)(false);
    const updateLinkEditor = (0, import_react24.useCallback)(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) {
        setIsLink(false);
        return;
      }
      const node = selection.anchor.getNode();
      const linkParent = $findMatchingParent2(node, $isLinkNode);
      const autoLinkParent = $findMatchingParent2(node, $isAutoLinkNode);
      if (linkParent) {
        setIsLink(true);
        setLinkUrl(linkParent.getURL());
        setIsAutoLink(!!autoLinkParent);
      } else if ($isLinkNode(node)) {
        setIsLink(true);
        setLinkUrl(node.getURL());
        setIsAutoLink($isAutoLinkNode(node));
      } else {
        setIsLink(false);
        setLinkUrl("");
        setIsAutoLink(false);
      }
      const nativeSelection = window.getSelection();
      if (nativeSelection && nativeSelection.rangeCount > 0) {
        const range = nativeSelection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        const anchorRect = anchorElem.getBoundingClientRect();
        setPosition({
          top: rect.bottom - anchorRect.top + 8,
          left: rect.left - anchorRect.left
        });
      }
    }, [anchorElem]);
    (0, import_react24.useEffect)(() => {
      return mergeRegister(
        editor.registerCommand(
          SELECTION_CHANGE_COMMAND,
          () => {
            updateLinkEditor();
            return false;
          },
          COMMAND_PRIORITY_LOW
        ),
        editor.registerCommand(
          KEY_ESCAPE_COMMAND,
          () => {
            if (isLinkEditMode) {
              setIsLinkEditMode(false);
              return true;
            }
            return false;
          },
          COMMAND_PRIORITY_HIGH
        )
      );
    }, [editor, updateLinkEditor, isLinkEditMode, setIsLinkEditMode]);
    (0, import_react24.useEffect)(() => {
      if (isLinkEditMode && inputRef.current) {
        setEditedLinkUrl(linkUrl);
        inputRef.current.focus();
      }
    }, [isLinkEditMode, linkUrl]);
    const handleSave = (0, import_react24.useCallback)(() => {
      if (editedLinkUrl.trim()) {
        editor.dispatchCommand(TOGGLE_LINK_COMMAND, editedLinkUrl);
      }
      setIsLinkEditMode(false);
    }, [editor, editedLinkUrl, setIsLinkEditMode]);
    const handleRemove = (0, import_react24.useCallback)(() => {
      editor.dispatchCommand(TOGGLE_LINK_COMMAND, null);
      setIsLinkEditMode(false);
    }, [editor, setIsLinkEditMode]);
    if (!isLink && !isLinkEditMode) return null;
    return (0, import_react_dom3.createPortal)(
      /* @__PURE__ */ jsx(
        "div",
        {
          className: "lexical-playground-link-editor",
          style: {
            position: "absolute",
            top: `${position.top}px`,
            left: `${position.left}px`
          },
          children: isLinkEditMode ? /* @__PURE__ */ jsxs(Fragment, { children: [
            /* @__PURE__ */ jsx(
              "input",
              {
                ref: inputRef,
                type: "url",
                value: editedLinkUrl,
                onChange: (e5) => setEditedLinkUrl(e5.target.value),
                onKeyDown: (e5) => {
                  if (e5.key === "Enter") {
                    e5.preventDefault();
                    handleSave();
                  } else if (e5.key === "Escape") {
                    e5.preventDefault();
                    setIsLinkEditMode(false);
                  }
                },
                placeholder: "https://"
              }
            ),
            /* @__PURE__ */ jsx(
              "button",
              {
                type: "button",
                className: "lexical-playground-toolbar-btn",
                onClick: handleSave,
                "aria-label": "Save",
                children: /* @__PURE__ */ jsx(CheckIcon, {})
              }
            )
          ] }) : /* @__PURE__ */ jsxs(Fragment, { children: [
            /* @__PURE__ */ jsxs(
              "a",
              {
                href: linkUrl,
                target: "_blank",
                rel: "noopener noreferrer",
                className: "lexical-playground-link-editor-url",
                children: [
                  linkUrl,
                  /* @__PURE__ */ jsx(ExternalLinkIcon, {})
                ]
              }
            ),
            !isAutoLink && /* @__PURE__ */ jsxs(Fragment, { children: [
              /* @__PURE__ */ jsx(
                "button",
                {
                  type: "button",
                  className: "lexical-playground-toolbar-btn",
                  onClick: () => setIsLinkEditMode(true),
                  "aria-label": "Edit",
                  children: /* @__PURE__ */ jsx(EditIcon, {})
                }
              ),
              /* @__PURE__ */ jsx(
                "button",
                {
                  type: "button",
                  className: "lexical-playground-toolbar-btn",
                  onClick: handleRemove,
                  "aria-label": "Remove",
                  children: /* @__PURE__ */ jsx(TrashIcon, {})
                }
              )
            ] })
          ] })
        }
      ),
      anchorElem
    );
  }
  function FloatingLinkEditorPlugin({
    anchorElem,
    isLinkEditMode,
    setIsLinkEditMode
  }) {
    if (!anchorElem) return null;
    return /* @__PURE__ */ jsx(
      FloatingLinkEditor,
      {
        anchorElem,
        isLinkEditMode,
        setIsLinkEditMode
      }
    );
  }

  // src/shared/lexical-playground/plugins/DraggableBlockPlugin.tsx
  var import_react25 = __toESM(require_react());
  init_Lexical();
  var DRAG_DATA_FORMAT = "application/x-lexical-drag-block";
  function DraggableBlockPlugin({ anchorElem }) {
    const [editor] = useLexicalComposerContext();
    const [isVisible, setIsVisible] = (0, import_react25.useState)(false);
    const [position, setPosition] = (0, import_react25.useState)({ top: 0, left: 0 });
    const menuRef = (0, import_react25.useRef)(null);
    const targetNodeKey = (0, import_react25.useRef)(null);
    const isDragging = (0, import_react25.useRef)(false);
    const setTargetLine = (0, import_react25.useCallback)(
      (targetBlockElem) => {
        if (!anchorElem) return;
        if (targetBlockElem === null) {
          setIsVisible(false);
          return;
        }
        const rect = targetBlockElem.getBoundingClientRect();
        const anchorRect = anchorElem.getBoundingClientRect();
        const top = rect.top - anchorRect.top;
        const left = -40;
        setPosition({ top, left });
        setIsVisible(true);
      },
      [anchorElem]
    );
    (0, import_react25.useEffect)(() => {
      if (!anchorElem) return;
      const handleMouseMove = (e5) => {
        if (isDragging.current) return;
        const target = e5.target;
        if (menuRef.current?.contains(target)) return;
        const blockElement = target.closest(
          '[data-lexical-decorator="true"], p, h1, h2, h3, h4, h5, h6, li, blockquote, pre, table, .lexical-playground-image-container'
        );
        if (blockElement && anchorElem.contains(blockElement)) {
          setTargetLine(blockElement);
          editor.getEditorState().read(() => {
            const node = $getNearestNodeFromDOMNode(blockElement);
            if (node) {
              targetNodeKey.current = node.getKey();
            }
          });
        } else if (!menuRef.current?.contains(target)) {
          setTargetLine(null);
        }
      };
      const handleMouseLeave = (e5) => {
        if (isDragging.current) return;
        const relatedTarget = e5.relatedTarget;
        if (!menuRef.current?.contains(relatedTarget)) {
          setTargetLine(null);
        }
      };
      anchorElem.addEventListener("mousemove", handleMouseMove);
      anchorElem.addEventListener("mouseleave", handleMouseLeave);
      return () => {
        anchorElem.removeEventListener("mousemove", handleMouseMove);
        anchorElem.removeEventListener("mouseleave", handleMouseLeave);
      };
    }, [anchorElem, editor, setTargetLine]);
    const handleAddClick = (0, import_react25.useCallback)(() => {
      editor.update(() => {
        if (targetNodeKey.current) {
          const node = $getNodeByKey(targetNodeKey.current);
          if (node) {
            const newParagraph = $createParagraphNode();
            node.insertAfter(newParagraph);
            newParagraph.select();
          }
        } else {
          const root = $getRoot();
          const newParagraph = $createParagraphNode();
          root.append(newParagraph);
          newParagraph.select();
        }
      });
    }, [editor]);
    const handleDragStart = (0, import_react25.useCallback)((e5) => {
      if (!targetNodeKey.current) return;
      isDragging.current = true;
      e5.dataTransfer.setData(DRAG_DATA_FORMAT, targetNodeKey.current);
      e5.dataTransfer.effectAllowed = "move";
      setIsVisible(false);
    }, []);
    const handleDragEnd = (0, import_react25.useCallback)(() => {
      isDragging.current = false;
    }, []);
    if (!anchorElem) return null;
    return /* @__PURE__ */ jsxs(
      "div",
      {
        ref: menuRef,
        className: "lexical-playground-draggable-block-menu",
        style: {
          position: "absolute",
          top: `${position.top}px`,
          left: `${position.left}px`,
          opacity: isVisible ? 1 : 0,
          pointerEvents: isVisible ? "auto" : "none",
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          gap: "2px",
          transition: "opacity 0.1s"
        },
        children: [
          /* @__PURE__ */ jsx(
            "button",
            {
              type: "button",
              className: "lexical-playground-draggable-block-add",
              onClick: handleAddClick,
              title: "Add block",
              "aria-label": "Add block",
              children: /* @__PURE__ */ jsx(PlusIcon, {})
            }
          ),
          /* @__PURE__ */ jsx(
            "div",
            {
              className: "lexical-playground-draggable-block-handle",
              draggable: true,
              onDragStart: handleDragStart,
              onDragEnd: handleDragEnd,
              title: "Drag to move",
              "aria-label": "Drag to move block",
              children: /* @__PURE__ */ jsx(DragHandleIcon, {})
            }
          )
        ]
      }
    );
  }

  // src/shared/lexical-playground/plugins/CodeHighlightPlugin.tsx
  var import_react26 = __toESM(require_react());
  function CodeHighlightPlugin() {
    const [editor] = useLexicalComposerContext();
    (0, import_react26.useEffect)(() => {
      return registerCodeHighlighting(editor);
    }, [editor]);
    return null;
  }

  // node_modules/@lexical/react/LexicalAutoLinkPlugin.prod.mjs
  var LexicalAutoLinkPlugin_prod_exports = {};
  __export(LexicalAutoLinkPlugin_prod_exports, {
    AutoLinkPlugin: () => i10,
    createLinkMatcherWithRegExp: () => createLinkMatcherWithRegExp
  });
  var import_react27 = __toESM(require_react(), 1);
  function t7(o8, t9, i13) {
    (0, import_react27.useEffect)(() => {
      o8.hasNodes([AutoLinkNode]) || (function(e5, ...r9) {
        const o9 = new URL("https://lexical.dev/docs/error"), n11 = new URLSearchParams();
        n11.append("code", e5);
        for (const e6 of r9) n11.append("v", e6);
        throw o9.search = n11.toString(), Error(`Minified Lexical error #${e5}; visit ${o9.toString()} for the full message or use the non-minified dev environment for full errors and additional helpful warnings.`);
      })(77);
    }), (0, import_react27.useEffect)(() => registerAutoLink(o8, { changeHandlers: i13 ? [i13] : [], matchers: t9 }), [o8, t9, i13]);
  }
  function i10({ matchers: e5, onChange: r9 }) {
    const [n11] = useLexicalComposerContext();
    return t7(n11, e5, r9), null;
  }

  // node_modules/@lexical/react/LexicalAutoLinkPlugin.mjs
  var mod35 = false ? LexicalAutoLinkPlugin_dev_exports : LexicalAutoLinkPlugin_prod_exports;
  var AutoLinkPlugin = mod35.AutoLinkPlugin;
  var createLinkMatcherWithRegExp2 = mod35.createLinkMatcherWithRegExp;

  // src/shared/lexical-playground/plugins/AutoLinkPlugin.tsx
  var URL_REGEX = /((https?:\/\/(www\.)?)|(www\.))[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)/;
  var EMAIL_REGEX = /(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))/;
  var MATCHERS = [
    (text) => {
      const match = URL_REGEX.exec(text);
      if (match === null) return null;
      const fullMatch = match[0];
      return {
        index: match.index,
        length: fullMatch.length,
        text: fullMatch,
        url: fullMatch.startsWith("http") ? fullMatch : `https://${fullMatch}`,
        attributes: { rel: "noopener", target: "_blank" }
      };
    },
    (text) => {
      const match = EMAIL_REGEX.exec(text);
      if (match === null) return null;
      return {
        index: match.index,
        length: match[0].length,
        text: match[0],
        url: `mailto:${match[0]}`
      };
    }
  ];
  function AutoLinkPlugin2() {
    return /* @__PURE__ */ jsx(AutoLinkPlugin, { matchers: MATCHERS });
  }

  // node_modules/@lexical/react/LexicalClickableLinkPlugin.prod.mjs
  var LexicalClickableLinkPlugin_prod_exports = {};
  __export(LexicalClickableLinkPlugin_prod_exports, {
    ClickableLinkPlugin: () => t8
  });
  var import_react28 = __toESM(require_react(), 1);
  function t8({ newTab: t9 = true, disabled: l8 = false }) {
    const [n11] = useLexicalComposerContext();
    return (0, import_react28.useEffect)(() => registerClickableLink(n11, namedSignals({ disabled: l8, newTab: t9 })), [n11, t9, l8]), null;
  }

  // node_modules/@lexical/react/LexicalClickableLinkPlugin.mjs
  var mod36 = false ? LexicalClickableLinkPlugin_dev_exports : LexicalClickableLinkPlugin_prod_exports;
  var ClickableLinkPlugin = mod36.ClickableLinkPlugin;

  // src/shared/lexical-playground/plugins/ClickableLinkPlugin.tsx
  function ClickableLinkPlugin2() {
    return /* @__PURE__ */ jsx(ClickableLinkPlugin, {});
  }

  // src/shared/lexical-playground/plugins/ImagesPlugin.tsx
  var import_react30 = __toESM(require_react());
  init_Lexical();

  // src/shared/lexical-playground/nodes/ImageNode.tsx
  init_Lexical();
  var import_react29 = __toESM(require_react());
  function ImageComponent({
    src,
    altText,
    width,
    height,
    nodeKey
  }) {
    const [editor] = useLexicalComposerContext();
    const imageRef = (0, import_react29.useRef)(null);
    const [isSelected, setSelected, clearSelection] = useLexicalNodeSelection(nodeKey);
    const [isResizing, setIsResizing] = (0, import_react29.useState)(false);
    const [currentWidth, setCurrentWidth] = (0, import_react29.useState)(width);
    const [currentHeight, setCurrentHeight] = (0, import_react29.useState)(height);
    const handleClick = (0, import_react29.useCallback)(
      (event) => {
        event.preventDefault();
        if (!editor.isEditable()) return;
        clearSelection();
        setSelected(true);
      },
      [clearSelection, editor, setSelected]
    );
    const handleResize = (0, import_react29.useCallback)((newWidth, newHeight) => {
      setCurrentWidth(newWidth);
      setCurrentHeight(newHeight);
    }, []);
    const handleResizeEnd = (0, import_react29.useCallback)(() => {
      if (currentWidth !== void 0 && currentHeight !== void 0) {
        editor.update(() => {
          const node = $getNodeByKey(nodeKey);
          if ($isImageNode(node)) {
            node.setWidthAndHeight(currentWidth, currentHeight);
          }
        });
      }
      setIsResizing(false);
    }, [currentWidth, currentHeight, editor, nodeKey]);
    (0, import_react29.useEffect)(() => {
      return mergeRegister(
        editor.registerCommand(
          KEY_DELETE_COMMAND,
          () => {
            if (isSelected) {
              editor.update(() => {
                const node = $getNodeByKey(nodeKey);
                if (node) {
                  node.remove();
                }
              });
              return true;
            }
            return false;
          },
          COMMAND_PRIORITY_LOW
        ),
        editor.registerCommand(
          KEY_BACKSPACE_COMMAND,
          () => {
            if (isSelected) {
              editor.update(() => {
                const node = $getNodeByKey(nodeKey);
                if (node) {
                  node.remove();
                }
              });
              return true;
            }
            return false;
          },
          COMMAND_PRIORITY_LOW
        )
      );
    }, [editor, isSelected, nodeKey]);
    const handlePointerDown = (0, import_react29.useCallback)(
      (event, direction) => {
        event.preventDefault();
        event.stopPropagation();
        setIsResizing(true);
        const image = imageRef.current;
        if (!image) return;
        const startX = event.clientX;
        const startY = event.clientY;
        const startWidth = currentWidth || image.naturalWidth;
        const startHeight = currentHeight || image.naturalHeight;
        const ratio = startWidth / startHeight;
        const handlePointerMove = (moveEvent) => {
          const diffX = moveEvent.clientX - startX;
          const diffY = moveEvent.clientY - startY;
          let newWidth = startWidth;
          let newHeight = startHeight;
          if (direction.includes("e")) {
            newWidth = Math.max(50, startWidth + diffX);
          }
          if (direction.includes("w")) {
            newWidth = Math.max(50, startWidth - diffX);
          }
          if (direction.includes("s")) {
            newHeight = Math.max(50, startHeight + diffY);
          }
          if (direction.includes("n")) {
            newHeight = Math.max(50, startHeight - diffY);
          }
          if (direction.length === 2) {
            newHeight = newWidth / ratio;
          }
          handleResize(Math.round(newWidth), Math.round(newHeight));
        };
        const handlePointerUp = () => {
          document.removeEventListener("pointermove", handlePointerMove);
          document.removeEventListener("pointerup", handlePointerUp);
          handleResizeEnd();
        };
        document.addEventListener("pointermove", handlePointerMove);
        document.addEventListener("pointerup", handlePointerUp);
      },
      [currentWidth, currentHeight, handleResize, handleResizeEnd]
    );
    const displayWidth = currentWidth || width;
    const displayHeight = currentHeight || height;
    return /* @__PURE__ */ jsxs("div", { className: `lexical-playground-image-container ${isSelected ? "selected" : ""}`, onClick: handleClick, children: [
      /* @__PURE__ */ jsx(
        "img",
        {
          ref: imageRef,
          src,
          alt: altText,
          style: {
            width: displayWidth ? `${displayWidth}px` : "auto",
            height: displayHeight ? `${displayHeight}px` : "auto",
            maxWidth: "100%"
          },
          className: "PlaygroundEditorTheme__image",
          draggable: "false"
        }
      ),
      isSelected && editor.isEditable() && /* @__PURE__ */ jsxs(Fragment, { children: [
        /* @__PURE__ */ jsx("div", { className: "image-resizer image-resizer-nw", onPointerDown: (e5) => handlePointerDown(e5, "nw") }),
        /* @__PURE__ */ jsx("div", { className: "image-resizer image-resizer-ne", onPointerDown: (e5) => handlePointerDown(e5, "ne") }),
        /* @__PURE__ */ jsx("div", { className: "image-resizer image-resizer-sw", onPointerDown: (e5) => handlePointerDown(e5, "sw") }),
        /* @__PURE__ */ jsx("div", { className: "image-resizer image-resizer-se", onPointerDown: (e5) => handlePointerDown(e5, "se") })
      ] })
    ] });
  }
  function convertImageElement(domNode) {
    const img = domNode;
    if (img.src) {
      const node = $createImageNode({
        src: img.src,
        altText: img.alt || "",
        width: img.width || void 0,
        height: img.height || void 0,
        dataAssetId: img.dataset.assetId,
        dataAssetSrc: img.dataset.assetSrc
      });
      return { node };
    }
    return null;
  }
  var ImageNode = class _ImageNode extends DecoratorNode {
    static getType() {
      return "image";
    }
    static clone(node) {
      return new _ImageNode(
        node.__src,
        node.__altText,
        node.__width,
        node.__height,
        node.__dataAssetId,
        node.__dataAssetSrc,
        node.__key
      );
    }
    static importJSON(serializedNode) {
      return $createImageNode({
        src: serializedNode.src,
        altText: serializedNode.altText,
        width: serializedNode.width,
        height: serializedNode.height,
        dataAssetId: serializedNode.dataAssetId,
        dataAssetSrc: serializedNode.dataAssetSrc
      });
    }
    static importDOM() {
      return {
        img: () => ({
          conversion: convertImageElement,
          priority: 0
        })
      };
    }
    constructor(src, altText, width, height, dataAssetId, dataAssetSrc, key) {
      super(key);
      this.__src = src;
      this.__altText = altText;
      this.__width = width;
      this.__height = height;
      this.__dataAssetId = dataAssetId;
      this.__dataAssetSrc = dataAssetSrc;
    }
    exportDOM() {
      const element = document.createElement("img");
      element.setAttribute("src", this.__src);
      element.setAttribute("alt", this.__altText);
      if (this.__width) {
        element.setAttribute("width", String(this.__width));
      }
      if (this.__height) {
        element.setAttribute("height", String(this.__height));
      }
      if (this.__dataAssetId) {
        element.setAttribute("data-asset-id", this.__dataAssetId);
      }
      if (this.__dataAssetSrc) {
        element.setAttribute("data-asset-src", this.__dataAssetSrc);
      }
      return { element };
    }
    exportJSON() {
      return {
        type: "image",
        version: 1,
        src: this.__src,
        altText: this.__altText,
        width: this.__width,
        height: this.__height,
        dataAssetId: this.__dataAssetId,
        dataAssetSrc: this.__dataAssetSrc
      };
    }
    getSrc() {
      return this.__src;
    }
    getAltText() {
      return this.__altText;
    }
    setWidthAndHeight(width, height) {
      const writable = this.getWritable();
      writable.__width = width;
      writable.__height = height;
    }
    createDOM(config) {
      const span = document.createElement("span");
      const theme = config.theme;
      const className = theme.image;
      if (className) {
        span.className = className;
      }
      return span;
    }
    updateDOM() {
      return false;
    }
    decorate() {
      return /* @__PURE__ */ jsx(import_react29.Suspense, { fallback: null, children: /* @__PURE__ */ jsx(
        ImageComponent,
        {
          src: this.__src,
          altText: this.__altText,
          width: this.__width,
          height: this.__height,
          nodeKey: this.__key
        }
      ) });
    }
  };
  function $createImageNode(payload) {
    return new ImageNode(
      payload.src,
      payload.altText || "",
      payload.width,
      payload.height,
      payload.dataAssetId,
      payload.dataAssetSrc,
      payload.key
    );
  }
  function $isImageNode(node) {
    return node instanceof ImageNode;
  }

  // src/shared/lexical-playground/plugins/ImagesPlugin.tsx
  var INSERT_IMAGE_COMMAND = createCommand("INSERT_IMAGE_COMMAND");
  function ImagesPlugin() {
    const [editor] = useLexicalComposerContext();
    (0, import_react30.useEffect)(() => {
      return editor.registerCommand(
        INSERT_IMAGE_COMMAND,
        (payload) => {
          const imageNode = $createImageNode(payload);
          $insertNodes([imageNode]);
          return true;
        },
        COMMAND_PRIORITY_EDITOR
      );
    }, [editor]);
    return null;
  }

  // src/shared/lexical-playground/plugins/MediaLibraryPlugin.tsx
  var import_react31 = __toESM(require_react());
  init_Lexical();
  var OPEN_MEDIA_LIBRARY_COMMAND = createCommand("OPEN_MEDIA_LIBRARY_COMMAND");
  function MediaLibraryPlugin({ onMediaLibraryOpen }) {
    const [editor] = useLexicalComposerContext();
    (0, import_react31.useEffect)(() => {
      if (!onMediaLibraryOpen) return;
      return editor.registerCommand(
        OPEN_MEDIA_LIBRARY_COMMAND,
        (type) => {
          onMediaLibraryOpen(type);
          return true;
        },
        COMMAND_PRIORITY_EDITOR
      );
    }, [editor, onMediaLibraryOpen]);
    return null;
  }

  // src/shared/lexical-playground/plugins/ExeCollaborationPlugin.tsx
  var import_react32 = __toESM(require_react());
  function ExeCollaborationPlugin({ yjsConfig }) {
    const [editor] = useLexicalComposerContext();
    const bindingRef = (0, import_react32.useRef)(null);
    const docRef = (0, import_react32.useRef)(null);
    const [isConnected, setIsConnected] = (0, import_react32.useState)(false);
    (0, import_react32.useEffect)(() => {
      if (!yjsConfig) {
        return;
      }
      const { provider, docId, userId, userName, userColor } = yjsConfig;
      const Y10 = window.Y;
      if (!Y10) {
        console.warn("[ExeCollaborationPlugin] Yjs (window.Y) not available");
        return;
      }
      const providerAny = provider;
      let doc;
      if (providerAny.doc) {
        doc = providerAny.doc;
      } else {
        console.warn("[ExeCollaborationPlugin] Provider does not have a doc property");
        return;
      }
      docRef.current = doc;
      const sharedType = doc.get(docId, Y10.XmlText);
      if (providerAny.awareness) {
        providerAny.awareness.setLocalStateField("user", {
          name: userName,
          color: userColor || "#4a90d9"
        });
      }
      Promise.resolve().then(() => (init_LexicalYjs(), LexicalYjs_exports)).then(({ createBinding: createBinding2, syncLexicalUpdateToYjs: syncLexicalUpdateToYjs2, syncYjsChangesToLexical: syncYjsChangesToLexical2 }) => {
        try {
          const binding = createBinding2(
            editor,
            providerAny,
            docId,
            doc,
            /* @__PURE__ */ new Map()
            // cursorsContainer - empty for now
          );
          bindingRef.current = binding;
          setIsConnected(true);
          console.log("[ExeCollaborationPlugin] Yjs binding created for:", docId);
        } catch (error) {
          console.error("[ExeCollaborationPlugin] Failed to create binding:", error);
        }
      }).catch((error) => {
        console.error("[ExeCollaborationPlugin] Failed to import @lexical/yjs:", error);
      });
      return () => {
        if (bindingRef.current) {
          try {
            bindingRef.current = null;
          } catch (e5) {
            console.error("[ExeCollaborationPlugin] Cleanup error:", e5);
          }
        }
        setIsConnected(false);
      };
    }, [editor, yjsConfig]);
    if (!yjsConfig) {
      return null;
    }
    return null;
  }

  // src/shared/lexical-playground/PlaygroundEditor.tsx
  init_Lexical();
  function onError(error) {
    console.error("[LexicalPlayground] Error:", error);
  }
  function Placeholder({ text }) {
    return /* @__PURE__ */ jsx("div", { className: "lexical-playground-placeholder", children: text });
  }
  var EditorInner = (0, import_react33.forwardRef)(function EditorInner2(props, ref) {
    const [editor] = useLexicalComposerContext();
    const [yjsConfig, setYjsConfig] = (0, import_react33.useState)(null);
    const [isLinkEditMode, setIsLinkEditMode] = (0, import_react33.useState)(false);
    const floatingAnchorRef = (0, import_react33.useRef)(null);
    (0, import_react33.useImperativeHandle)(
      ref,
      () => ({
        getEditor: () => editor,
        getHTML: () => {
          let html = "";
          editor.getEditorState().read(() => {
            html = $generateHtmlFromNodes(editor, null);
          });
          return html;
        },
        setHTML: (html) => {
          editor.update(() => {
            const parser = new DOMParser();
            const dom = parser.parseFromString(html, "text/html");
            const nodes = $generateNodesFromDOM(editor, dom);
            const root = $getRoot();
            root.clear();
            root.append(...nodes);
          });
        },
        getJSON: () => editor.getEditorState().toJSON(),
        setJSON: (json) => {
          const editorState = editor.parseEditorState(json);
          editor.setEditorState(editorState);
        },
        isEmpty: () => {
          let empty = true;
          editor.getEditorState().read(() => {
            const root = $getRoot();
            empty = root.getTextContent().trim() === "";
          });
          return empty;
        },
        focus: () => editor.focus(),
        blur: () => editor.blur(),
        setEditable: (editable) => editor.setEditable(editable),
        setYjsBinding: (config) => {
          setYjsConfig(config);
        },
        insertImage: (options) => {
          editor.dispatchCommand(INSERT_IMAGE_COMMAND, {
            src: options.src,
            altText: options.altText || "",
            width: options.width,
            height: options.height,
            dataAssetId: options.dataAssetId,
            dataAssetSrc: options.dataAssetSrc
          });
        },
        insertVideo: (options) => {
          editor.update(() => {
            const parser = new DOMParser();
            const videoHtml = `<video src="${options.src}" controls data-asset-id="${options.dataAssetId || ""}" data-asset-src="${options.dataAssetSrc || ""}" style="max-width: 100%;"></video>`;
            const dom = parser.parseFromString(videoHtml, "text/html");
            const nodes = $generateNodesFromDOM(editor, dom);
            $insertNodes(nodes);
          });
        },
        insertAudio: (options) => {
          editor.update(() => {
            const parser = new DOMParser();
            const audioHtml = `<audio src="${options.src}" controls data-asset-id="${options.dataAssetId || ""}" data-asset-src="${options.dataAssetSrc || ""}"></audio>`;
            const dom = parser.parseFromString(audioHtml, "text/html");
            const nodes = $generateNodesFromDOM(editor, dom);
            $insertNodes(nodes);
          });
        },
        destroy: () => {
        }
      }),
      [editor]
    );
    (0, import_react33.useEffect)(() => {
      if (props.onHandleReady && ref && typeof ref === "object" && ref.current) {
        props.onHandleReady(ref.current);
      }
    }, [props.onHandleReady, ref]);
    const handleChange = (0, import_react33.useCallback)(
      (editorState) => {
        if (props.onUpdate) {
          editorState.read(() => {
            const html = $generateHtmlFromNodes(editor, null);
            props.onUpdate(html);
          });
        }
      },
      [editor, props.onUpdate]
    );
    (0, import_react33.useEffect)(() => {
      if (props.initialHTML) {
        editor.update(() => {
          const parser = new DOMParser();
          const dom = parser.parseFromString(props.initialHTML, "text/html");
          const nodes = $generateNodesFromDOM(editor, dom);
          const root = $getRoot();
          root.clear();
          if (nodes.length > 0) {
            root.append(...nodes);
          } else {
            root.append($createParagraphNode());
          }
        });
      }
    }, [editor, props.initialHTML]);
    (0, import_react33.useEffect)(() => {
      editor.setEditable(props.editable !== false);
    }, [editor, props.editable]);
    return /* @__PURE__ */ jsxs("div", { className: "lexical-playground-container", children: [
      /* @__PURE__ */ jsx(ToolbarPlugin, { onMediaLibraryOpen: props.onMediaLibraryOpen, setIsLinkEditMode }),
      /* @__PURE__ */ jsxs("div", { className: "lexical-playground-editor-wrapper", ref: floatingAnchorRef, children: [
        /* @__PURE__ */ jsx(
          RichTextPlugin,
          {
            contentEditable: /* @__PURE__ */ jsx(ContentEditable, { className: "lexical-playground-editor" }),
            placeholder: /* @__PURE__ */ jsx(Placeholder, { text: props.placeholder || "Start typing..." }),
            ErrorBoundary: LexicalErrorBoundary
          }
        ),
        /* @__PURE__ */ jsx(HistoryPlugin, {}),
        /* @__PURE__ */ jsx(AutoFocusPlugin, {}),
        /* @__PURE__ */ jsx(ListPlugin, {}),
        /* @__PURE__ */ jsx(CheckListPlugin, {}),
        /* @__PURE__ */ jsx(LinkPlugin, {}),
        /* @__PURE__ */ jsx(TablePlugin, { hasCellMerge: true, hasCellBackgroundColor: true }),
        /* @__PURE__ */ jsx(HorizontalRulePlugin, {}),
        /* @__PURE__ */ jsx(TabIndentationPlugin, {}),
        /* @__PURE__ */ jsx(MarkdownShortcutPlugin, { transformers: TRANSFORMERS }),
        /* @__PURE__ */ jsx(OnChangePlugin, { onChange: handleChange, ignoreSelectionChange: true }),
        /* @__PURE__ */ jsx(CodeHighlightPlugin, {}),
        /* @__PURE__ */ jsx(AutoLinkPlugin2, {}),
        /* @__PURE__ */ jsx(ClickableLinkPlugin2, {}),
        /* @__PURE__ */ jsx(ImagesPlugin, {}),
        /* @__PURE__ */ jsx(CollapsiblePlugin, {}),
        /* @__PURE__ */ jsx(MediaLibraryPlugin, { onMediaLibraryOpen: props.onMediaLibraryOpen }),
        /* @__PURE__ */ jsx(ExeCollaborationPlugin, { yjsConfig }),
        /* @__PURE__ */ jsx(DraggableBlockPlugin, { anchorElem: floatingAnchorRef.current }),
        /* @__PURE__ */ jsx(FloatingTextFormatPlugin, { anchorElem: floatingAnchorRef.current }),
        /* @__PURE__ */ jsx(
          FloatingLinkEditorPlugin,
          {
            anchorElem: floatingAnchorRef.current,
            isLinkEditMode,
            setIsLinkEditMode
          }
        )
      ] })
    ] });
  });
  var PlaygroundEditor = (0, import_react33.forwardRef)(
    function PlaygroundEditor2(props, ref) {
      const innerRef = (0, import_react33.useRef)(null);
      (0, import_react33.useImperativeHandle)(
        ref,
        () => ({
          getEditor: () => innerRef.current?.getEditor() ?? null,
          getHTML: () => innerRef.current?.getHTML() ?? "",
          setHTML: (html) => innerRef.current?.setHTML(html),
          getJSON: () => innerRef.current?.getJSON() ?? null,
          setJSON: (json) => innerRef.current?.setJSON(json),
          isEmpty: () => innerRef.current?.isEmpty() ?? true,
          focus: () => innerRef.current?.focus(),
          blur: () => innerRef.current?.blur(),
          setEditable: (editable) => innerRef.current?.setEditable(editable),
          setYjsBinding: (config) => innerRef.current?.setYjsBinding(config),
          insertImage: (options) => innerRef.current?.insertImage(options),
          insertVideo: (options) => innerRef.current?.insertVideo(options),
          insertAudio: (options) => innerRef.current?.insertAudio(options),
          destroy: () => innerRef.current?.destroy()
        }),
        []
      );
      const initialConfig = {
        namespace: props.editorId || "PlaygroundEditor",
        theme: PlaygroundTheme_default,
        onError,
        nodes: [
          HeadingNode,
          QuoteNode,
          ListNode,
          ListItemNode,
          LinkNode,
          AutoLinkNode,
          CodeNode2,
          CodeHighlightNode2,
          TableNode,
          TableRowNode,
          TableCellNode,
          HorizontalRuleNode2,
          ImageNode,
          CollapsibleContainerNode,
          CollapsibleTitleNode,
          CollapsibleContentNode
        ]
      };
      return /* @__PURE__ */ jsx(LexicalComposer, { initialConfig, children: /* @__PURE__ */ jsx(EditorInner, { ...props, ref: innerRef }) });
    }
  );

  // src/shared/lexical-playground/index.tsx
  var mountedEditors = /* @__PURE__ */ new Map();
  function mount(container, options = {}) {
    const containerEl = typeof container === "string" ? document.querySelector(container) : container;
    if (!containerEl) {
      throw new Error(`[LexicalPlayground] Container element not found: ${container}`);
    }
    const editorId = options.editorId || `lexical-playground-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    if (mountedEditors.has(editorId)) {
      console.warn(`[LexicalPlayground] Editor ${editorId} already mounted. Use unmount() first.`);
      const existing = mountedEditors.get(editorId);
      if (existing?.handle) {
        return existing.handle;
      }
    }
    let editorHandle = null;
    const handleProxy = {
      getEditor: () => editorHandle?.getEditor() ?? null,
      getHTML: () => editorHandle?.getHTML() ?? "",
      setHTML: (html) => editorHandle?.setHTML(html),
      getJSON: () => editorHandle?.getJSON() ?? null,
      setJSON: (json) => editorHandle?.setJSON(json),
      isEmpty: () => editorHandle?.isEmpty() ?? true,
      focus: () => editorHandle?.focus(),
      blur: () => editorHandle?.blur(),
      setEditable: (editable) => editorHandle?.setEditable(editable),
      setYjsBinding: (config) => editorHandle?.setYjsBinding(config),
      insertImage: (opts) => editorHandle?.insertImage(opts),
      insertVideo: (opts) => editorHandle?.insertVideo(opts),
      insertAudio: (opts) => editorHandle?.insertAudio(opts),
      destroy: () => {
        unmount(editorId);
      }
    };
    const root = createRoot(containerEl);
    mountedEditors.set(editorId, {
      root,
      handle: null,
      container: containerEl
    });
    root.render(
      /* @__PURE__ */ jsx(
        PlaygroundEditor,
        {
          ...options,
          editorId,
          onHandleReady: (handle) => {
            editorHandle = handle;
            const entry = mountedEditors.get(editorId);
            if (entry) {
              entry.handle = handle;
            }
          }
        }
      )
    );
    return handleProxy;
  }
  function unmount(editorId) {
    let id;
    if (typeof editorId === "string") {
      id = editorId;
    } else {
      for (const [key, value] of mountedEditors.entries()) {
        if (value.container === editorId) {
          id = key;
          break;
        }
      }
    }
    if (!id) {
      console.warn("[LexicalPlayground] Editor not found for unmount");
      return;
    }
    const entry = mountedEditors.get(id);
    if (entry) {
      try {
        entry.root.unmount();
      } catch (e5) {
        console.error("[LexicalPlayground] Error unmounting:", e5);
      }
      mountedEditors.delete(id);
    }
  }
  function getMountedEditors() {
    return Array.from(mountedEditors.keys());
  }
  function isMounted(editorId) {
    return mountedEditors.has(editorId);
  }
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
