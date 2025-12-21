/**
 *
 *
 * @author Josh Lobe
 * http://ultimatetinymcepro.com
 */

jQuery(document).ready(function($) {
	
	// Declare global variables
	// The New eXeLearning
	// var editor = top.tinymce.activeEditor;
	var editor = parent.tinymce.activeEditor;
	// / The New eXeLearning
	var lastQuery = null;
	var lastPos = null;
	var marked = [];
	var autocompletion_active = true;
	
	// Instantiate CodeMirror on textarea
	var myCodeMirror = CodeMirror.fromTextArea($("#htmlSource")[0], {
		
		mode: "text/html",
		lineNumbers: true,
		lineWrapping: true,
		styleActiveLine: true,
		styleSelectedText: true,
		highlightSelectionMatches: true,
		indentUnit: 4
	});
	
	// Beautify source HTML and populate CodeMirror textarea
	// The New eXeLearning
	// myCodeMirror.doc.setValue( style_html(editor.getContent({format : 'html'}), 4) );
	myCodeMirror.doc.setValue( editor.getContent({format : 'html'}) );
	// / The New eXeLearning
		
	// Set focus to codemirror window
	myCodeMirror.focus(); 
	
	// Add change event to capture undo;redo events
	myCodeMirror.on('change', function(i, e) {
		
		// Set undo and redo levels
		var undo = myCodeMirror.doc.historySize().undo;
		var redo = myCodeMirror.doc.historySize().redo;
		
		// Toggle class name for action buttons
		if(undo > 1) $("#undo").attr('class', '');
		else $("#undo").attr('class', 'disabled');
		
		if(redo > 0) $("#redo").attr('class', '');
		else $("#redo").attr('class', 'disabled');
	});
	
	// Initialize autocomplete
	myCodeMirror.on('keypress', function(i, e) {
		
		if(autocompletion_active) {
			
			/* Hook into charcode '<' */
			if(String.fromCharCode(e.which == null ? e.keyCode : e.which) == "<") {
				
				// Prevent keypress of '<'
				e.preventDefault();
				
				var cur = myCodeMirror.getCursor(false), token = myCodeMirror.getTokenAt(cur);
				myCodeMirror.replaceRange("<", cur);  // Replace '<' back into range
				
				setTimeout(startComplete, 50);
				return true;
			} 
		}
	});
	
	
	// Cancel button
	$('#codemagic_cancel').click(function() {
		
		editor.windowManager.close();
	});
	// Insert button
	$('#codemagic_insert').click(function() {

		var window_content = myCodeMirror.doc.getValue();  // Get codemirror html
		editor.setContent(window_content);  // Set editor content to codermirror content
		// The New eXeLearning
		editor.undoManager.add();
		// / The New eXeLearning
		editor.windowManager.close();  // Close window
	});
	
	// Codemagic action buttons
	// Undo
	$('#undo').click(function() {
		
		if($(this).attr('class') != 'disabled') {
		
			// Check if undo button is disabled
			var className = $('#undo').attr('class');
			if(className == 'disabled') return;
			
			// Undo step
			myCodeMirror.doc.undo();
		}
	});
	// Redo
	$('#redo').click(function() {
		
		if($(this).attr('class') != 'disabled') {
		
			// Redo step
			myCodeMirror.doc.redo();
		}
	});
	// Search and Replace
	$( "#search_replace" ).click(function() {
		
		if($(this).attr('class') != 'disabled') {
			
			$( "#search_replace" ).toggleClass( 'selected' );
			$( "#search_panel" ).slideToggle( "slow", function() {
				// Animation complete.
			});
		}
	});	
	// Re-format html window code
	$('#re_beautify').click(function() {
		
		if($(this).attr('class') != 'disabled') {
		
			// Re-beautify html in window manager
			var window_html = myCodeMirror.doc.getValue();
			myCodeMirror.doc.setValue( 
		
				style_html(window_html, 4)
			);
		}
	});
	
	// Toggle Line Wrapping
	// The New eXeLearning
	// $("#wraptext").click( function() {
	var wraptext_checkbox = $("#wraptext");
	wraptext_checkbox.click( function() {
	// / The New eXeLearning
		
		if ($(this).is(':checked')){ myCodeMirror.setOption('lineWrapping', true); }
		else { myCodeMirror.setOption('lineWrapping', false); }
	});
	
	// The New eXeLearning
	// Fix https://github.com/exelearning/iteexe/issues/133
	wraptext_checkbox.trigger("click");
	setTimeout(function(){
		wraptext_checkbox.trigger("click");	
	},200);
	// Toggle Full Screen mode
	if (parent && parent.codemagicDialog && typeof(parent.codemagicDialog.fullscreen)=="function") {
		$("#maximizeEditorWrapper").show();
		$("#maximizeEditor").click( function() {
			if ($(this).is(':checked')){ 
				parent.codemagicDialog.fullscreen(true);
				$("#codemagic_insert").css("margin-bottom","20px");
			} else { 
				parent.codemagicDialog.fullscreen(false);
				$("#codemagic_insert").css("margin-bottom","0");
			}
		});       
	}  
	// / The New eXeLearning
	
	// Toggle Auto Completion
	$("#autocompletion").click( function() {
		
		if ($(this).is(':checked')){ autocompletion_active = true; } 
		else { autocompletion_active = false; }
	}); 
	
	// Toggle Code Highlighting
	$("#highlighting").click( function() {
		
		if ($(this).is(':checked')){ activateCodeColoring('htmlSource'); }
		else { deactivateCodeColoring(); }
	});
	
	// Activate code highlighting
	function activateCodeColoring(id) {
		
		// Enable buttons
		$("#search_replace").attr('class', '');
		$("#re_beautify").attr('class', '');
		$("#autocompletion").attr("disabled", false);
		
		// Redraw codemirror textarea
		myCodeMirror = CodeMirror.fromTextArea($("#htmlSource")[0], {
		
			mode: "text/html",
			lineNumbers: true,
			styleActiveLine: true,
			styleSelectedText: true,
			highlightSelectionMatches: true,
			indentUnit: 4
		}); 
		
		// Set focus to window
		myCodeMirror.focus(); 
		
		// Add change event to capture undo;redo events
		myCodeMirror.on('change', function(e) {
			
			// Set undo and redo levels
			var undo = myCodeMirror.doc.historySize().undo;
			var redo = myCodeMirror.doc.historySize().redo;
			
			// Toggle class name for action buttons
			if(undo > 0) $("#undo").attr('class', '');
			else $("#undo").attr('class', 'disabled');
			
			if(redo > 0) $("#redo").attr('class', '');
			else $("#redo").attr('class', 'disabled');
		});
	
		// Initialize autocomplete
		myCodeMirror.on('keypress', function(i, e) {
			
			if(autocompletion_active) {
				
				/* Hook into charcode '<' */
				if(String.fromCharCode(e.which == null ? e.keyCode : e.which) == "<") {
					
					// Prevent keypress of '<'
					e.preventDefault();
					
					var cur = myCodeMirror.getCursor(false), token = myCodeMirror.getTokenAt(cur);
					myCodeMirror.replaceRange("<", cur);  // Replace '<' back into range
					
					setTimeout(startComplete, 50);
					return true;
				} 
			}
		});
		
		// Match linewrap option
		if ($("#wraptext").is(':checked')) { myCodeMirror.setOption('lineWrapping', true); }
		else { myCodeMirror.setOption('lineWrapping', false); }
	}
	
	
	// Deactivate code highlighting
	function deactivateCodeColoring() {
		
		// Clear undo history
		myCodeMirror.doc.clearHistory();
		
		// Disable buttons
		$("#undo").attr('class', 'disabled');
		$("#redo").attr('class', 'disabled');
		$("#search_replace").attr('class', 'disabled');
		$("#re_beautify").attr('class', 'disabled');
		$("#autocompletion").attr("disabled", true);
		
		// Send codemirror back to original textarea
		myCodeMirror.toTextArea();
	}
	
	
	
	
	
	
	/***************************************
	****************************************
	Search and Replace
	*/
	
	
	// Search code button
	$('#search_code').click(function() { searchCode(); });
	// Replace code button
	$('#replace_code').click(function() { replaceCode(); });
	
	// Unmark all highlighted words
	function unmark() { marked.length = 0; }   
	
	// Search code function
	function searchCode() {
		
		unmark();
		
		var text = $("#query").val();
		
		if (!text)  return false;    
		
		if(!myCodeMirror.getSearchCursor(text).findNext()) {
			
			alert('Nothing Found.');
			return false;    
		} 
		
		for (var cursor = myCodeMirror.getSearchCursor(text); cursor.findNext();)
			marked.push(myCodeMirror.markText(cursor.from(), cursor.to(), "searched"));
		
		if (lastQuery != text) lastPos = null;
		
		var cursor = myCodeMirror.getSearchCursor(text, lastPos || myCodeMirror.getCursor());
		
		if (!cursor.findNext()) {
			
			cursor = myCodeMirror.getSearchCursor(text);
			if (!cursor.findNext()) return;
		}
		myCodeMirror.setSelection(cursor.from(), cursor.to());
		lastQuery = text; lastPos = cursor.to();
	}
	
	// Replace code function
	function replaceCode() {
		
		unmark();
		
		var s_text = $("#query").val();
		var replace = $("#replace").val();
		
		if (!s_text) return false;    
		
		if(!myCodeMirror.getSearchCursor(s_text).findNext()) {
			
			alert('Nothing to Replace.');
			return false;    
		}
		
		for (var cursor = myCodeMirror.getSearchCursor(s_text); cursor.findNext();)
			myCodeMirror.replaceRange(replace, cursor.from(), cursor.to());
	} 
	
	
	
	/***************************************
	****************************************
	Autocompletion
	*/
	var tagNames = ("a abbr acronym address applet area b base basefont bdo big blockquote body br button" + 
					" caption center cite code col colgroup dd del dfn dir div dl dt em fieldset font form frame" +
					" frameset h1 h2 h3 h4 h5 h6 head hr html i iframe img input ins isindex kbd label legend li link map" +
					" menu meta noframes noscript object ol optgroup option p param pre q s samp script select small" + 
					" span strike strong style sub sup table tbody td textarea tfoot th thead title tr tt u ul var").split(" ");
				   
	var pairedTags = ("a abbr acronym address applet b bdo big blockquote body button" + 
					  " caption center cite code colgroup del dfn dir div dl em fieldset font form" +
					  " frameset h1 h2 h3 h4 h5 h6 head html i iframe ins kbd label legend li map" +
					  " menu noframes noscript object ol optgroup option p pre q s samp script select small" + 
					  " span strike strong style sub sup table tbody td textarea tfoot th thead title tr tt u ul var").split(" "); 
					
	var unPairedTags = ("area base basefont br col dd dt frame hr img input isindex link meta param").split(" ");
	
	var specialTags = {
		
		"applet" : { tag: 'applet width="" height=""></applet>', cusror: 8 },
		"area" : { tag: 'area alt="" />', cusror: 6 },
		"base" : { tag: 'base href="" />', cusror: 7 },
		"form" : { tag: 'form action=""></form>', cusror: 9 },
		"img" : { tag: 'img src="" alt="" />', cusror: 6 },
		"map" : { tag: 'map name=""></map>', cusror: 7 },
		"meta" : { tag: 'meta content="" />', cusror: 10 },
		"optgroup" : { tag: 'optgroup label=""></optgroup>', cusror: 8 },
		"param" : { tag: 'param name="" />', cusror: 7 },
		"script" : { tag: 'script type=""></script>', cusror: 7 },
		"style" : { tag: 'style type=""></style>', cusror: 7 },
		"textarea" : { tag: 'textarea cols="" rows=""></textarea>', cusror: 7 }
	}
	
	function forEach(arr, f) { for (var i = 0, e = arr.length; i < e; ++i) f(arr[i]); }
	
	Array.prototype.inArray = function(value){
		
		for (var key in this)
			if (this[key] === value) return true;
		return false;
	}

	// Autocompletion Start
	function startComplete() {
		
		var startingTag, unPaired;
		
		// We want a single cursor position.
		if (myCodeMirror.somethingSelected()) return;
		
		// Find the token at the cursor
		var cur = myCodeMirror.getCursor(false), 
			token = myCodeMirror.getTokenAt(cur), 
			tprop = token;
		
		if(token.string.indexOf("<") == 0 && token.string.indexOf("</") != 0) {
			
			token.string = token.string.replace("<", "");
			token.start++;
			startingTag = true; 
		} 
		else if(token.string.indexOf("</") == 0) {
			
			token.string = token.string.replace("</", "");   
			token.start += 2;
			startingTag = false;
		} 
		else {
			
			return;
		}         
		
		// Get the tags
		var completions = getCompletions(token, startingTag);
		if (!completions.length) return;
		
		// Insert tag into codemirror window
		function insert(str) {
			
			if(str == "") return;
			
			// Trim
			str = str.replace(/^\s+|\s+$/g,"");
			
			// Is this an unpaired tag?
			unPaired = unPairedTags.inArray(str) ? true : false;
		
			if(specialTags[str] != null && startingTag) {
				
				var insertTag = specialTags[str].tag;    
				var jumpTo = (token.start + str.length + specialTags[str].cusror);
			} 
			else if(startingTag && unPaired) {
				
				var insertTag = str + " />";    
				var jumpTo = (token.start + str.length + 3); 
			} 
			else if (startingTag) {
				
				var insertTag = str + "></" + str + ">";    
				var jumpTo = (token.start + str.length + 1); 
			} 
			else {
				
				var insertTag = str + ">";    
				var jumpTo = (token.start + str.length + 1);
			}
			
			// Insert tag
			myCodeMirror.replaceRange(insertTag, {line: cur.line, ch: token.start}, {line: cur.line, ch: token.end});
			myCodeMirror.setCursor({line: cur.line, ch: jumpTo});
			
			// Unbind events so additional uses of window don't populate all binded history events
			$('body').off('dblclick', 'option');
			$('body').off('keydown', 'select');
		}
	
	
		// Build the select widget
		var complete = $( "<div class='completions'>" );
		var option_tag = [];
		
		for (var i = 0; i < completions.length; ++i) {
			
			option_tag += "<option>" + completions[i] + "</option>";
		}
		var sel = complete.append('<select id="completions_options">'+option_tag+'</select>');
		
		// Select first option
		$('select option:first-child').attr("selected", "selected");
		
		// Show six options in select box
		complete.children().attr('size', '10');  
		
		// Left position
		var pos = myCodeMirror.cursorCoords();
		complete.css('margin-left', pos.left+'px');
		
		// Top position
		if(pos.top > 0) pos.top = pos.top - 550;
		complete.css('margin-top', pos.top+'px');
		
		
		// Append populated div and select box to body
		$('body').append(complete);
		
		// Apply focus to select box
		$('select').focus();
		
		
		
		// Close autocompletion window
		function close_autocomplete() { complete.remove(); }
		
		// Grab select option (tag) and run insert() function.
		function pick() {

			var html_tag = $('#completions_options').find(":selected").text();
			
			insert(html_tag);
			close_autocomplete();
			
			// Re-focus codemirror window after a brief delay
			setTimeout(function(){ myCodeMirror.focus(); }, 50);
		}
		
		// Bind dblclick to autocomplete option box
		$('body').on('dblclick', 'option', function() { pick(); });
		
		// Bind keydown event to select box
		$('body').on('keydown', 'select', function(e) {
			
			var code = e.keyCode;
		  
			// Enter, space, tab
			if (code == 13 || code == 32 || code == 9) {
				
				e.preventDefault();
				pick();
			}
			// Escape
			else if (code == 27) {
				
				e.preventDefault();
				close_autocomplete();
				myCodeMirror.focus();                                                   
			}
			// Other than arrow up/down
			else if (code != 38 && code != 40 && code != 16 && code != 17 && code != 18 && code != 91 && code != 92) {
				                       
				close_autocomplete();
				myCodeMirror.focus(); 
				
				if(code != 39 && code != 37) {
					
					// Unbind event handlers
					$('body').off('dblclick', 'option');
					$('body').off('keydown', 'select');
					
					setTimeout(startComplete, 50); 
				}
				else { 
				
					e.preventDefault();
				}
			}
		});
	}
	
	function getCompletions(token, startingTag) {
		
		var found = [], start = token.string;
		
		function maybeAdd(str) { if (str.indexOf(start) == 0) found.push(str); }
		
		// Check if this is a starting tag
		if(startingTag) { forEach(tagNames, maybeAdd) } 
		else { forEach(pairedTags, maybeAdd) }
		
		return found;
	}       
	
});