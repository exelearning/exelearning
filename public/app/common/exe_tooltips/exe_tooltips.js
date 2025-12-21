$exe.tooltips = {
	className : "exe-tooltip",
	init : function(path){
		this.path = path;
		this.viewport = $(window);
		var as = $("A."+$exe.tooltips.className);
		if (as.length>0) {
			this.links = as;
			this.loadCSS();
            this.loadJS();
		}
		if (window.location.protocol.indexOf("http")==0) this.isAJAXAllowed = true;
		if (document.body.className.indexOf("exe-single-page")!=-1) this.isAJAXAllowed = false; // To review
	},
	loadCSS : function() {
		// We can't use this in Safari $exe.loadScript("jquery.qtip.min.css","$exe.tooltips.loadJS()"); because the callback function won't work with CSS files in that browser, so we just call this.loadJS(); (see line 7)
		$exe.loadScript(this.path+"jquery.qtip.min.css");
	},
	loadJS : function(file) {
		$exe.loadScript(this.path+"jquery.qtip.min.js","$exe.tooltips.loadImageLoader()");
	},
	loadImageLoader : function(){
		$exe.loadScript(this.path+"imagesloaded.pkg.min.js","$exe.tooltips.run()");
	},
	hasCloseButton : function(e){
		return false;
	},
	autoClose : function(){
		return true;
	},
	getTooltipTitle : function(t) {
		if (!t) return "";
		var v = "";
		var t = t.split(" | ");
		if (t.length==2) v = t[0];
		return v;
	},
	getTooltipText : function(t){
		var v = t;
		var t = t.split(" | ");
		if (t.length==2) v = t[1];
		return v;
	},
	getFriendlyURL : function(t) {
		t = t.replace(/[^\w\s]/gi, '');
		t = t.replace( /\ /g, "-" );
		t = t.toLowerCase();
		return t;
	},
	getPageName : function(href) {
		var h = href;
		$("A","#siteNav").each(function(){
			if ($(this).attr("href")==href.split("#")[0]) h = $(this).text();
		});
		return h;
	},
	enableAJAXTooltip : function(c,a){
		$(a).qtip({
			position : {
				viewport : $exe.tooltips.viewport
			},				
			content: {
				title : $exe.tooltips.getTooltipTitle(a.title),
				text: function(event, api) {
					if (typeof(eXeLearning)!='undefined') return _("Go to Tools - Preview to see the tooltip content");
					var ref = api.elements.target.attr('href');
					$.ajax({
						url: ref
					}).then(
						function(content) {
							var cont = $(".FreeTextIdevice .iDevice_content",content).eq(0).html();
							api.set('content.text', cont);
						},
						function() {
							//api.hide();
							var cont = $exe.tooltips.getPageName(ref);
							api.set('content.text', cont);
						}
					);
					return '&hellip;';
				},
				button : c.indexOf("with-button")==-1 ? false : true
			},
			hide : c.indexOf("with-button")==-1 ? {} : { event : false },
			style : {
				tip : {
					corner : c.indexOf("with-button")==-1 ? true : false 
				},
				classes : $exe.tooltips.getClasses(c)
			}
		});	
	},
	enableGlossaryTooltip : function(c,a){
		$(a).qtip({
			position : {
				viewport : $exe.tooltips.viewport
			},				
			content: {
				title : $exe.tooltips.getTooltipTitle(a.title),
				text: function(event, api) {
					var ref = api.elements.target.attr('href');
					$exe.tooltips.currentWord = api.elements.target.text().toLowerCase();
					$.ajax({
						url: ref
					}).then(
						function(content) {
							var cont = $(".FreeTextIdevice .iDevice_content",content).eq(0);
							
							// Local file
							var p = window.location.protocol;
							if (p.indexOf("http")!=0) {
								var gW = $("#exe-glossary-terms");
								if (gW.length==0) {
									// Remove xmlns="http://www.w3.org/1999/xhtml"
									var html = cont.html().replace( /\ xmlns="http:\/\/www.w3.org\/1999\/xhtml"/g, "" );
									var w = $('<div id="exe-glossary-terms" style="display:none"></div>').html(html);
									$("BODY").append(w);
								}
								cont = $("#exe-glossary-terms");
							}
							
							var words = $("DT",cont);
							words.each(function(){
								var term = $(this).text().toLowerCase();
								// Remove ":"...
								if (term.slice(-1)==":") term = term.slice(0,-1);
								if(term==$exe.tooltips.currentWord) {
									$(this).text($exe.tooltips.currentWord);
									var dd = $(this).next("dd");
									if (dd.length==1) {
										dd = dd.html();
										if (dd!="") cont = dd;
									}
								}
							});
							if (typeof(cont)=="object") cont = cont.html();
							api.set('content.text', cont);
						},
						function() {
							//api.hide();
							var cont = $exe.tooltips.getPageName(ref);
							api.set('content.text', cont);					
						}							
					);
					if (typeof(eXeLearning)!='undefined') return _("Go to Tools - Preview to see the tooltip content");
					return '&hellip;';
				},
				button : c.indexOf("with-button")==-1 ? false : true
			},
			hide : c.indexOf("with-button")==-1 ? {} : { event : false },
			style : {
				tip : {
					corner : c.indexOf("with-button")==-1 ? true : false 
				},
				classes : $exe.tooltips.getClasses(c)
			}					
		});
	},
	getClasses : function(c) {
		var k = ""
		
		if (c.indexOf(" light-tt")!=-1) k = "light";
		else if (c.indexOf(" dark-tt")!=-1) k = "dark";
		else if (c.indexOf(" red-tt")!=-1) k = "red";
		else if (c.indexOf(" blue-tt")!=-1) k = "blue";
		else if (c.indexOf(" green-tt")!=-1) k = "green";	
	
		if (k!="") k = "qtip-"+k;
		
		if (c.indexOf("rounded-tt")!=-1) k += " qtip-rounded";
		if (c.indexOf("shadowed-tt")!=-1) k += " qtip-shadow";
		if (c.indexOf("definition-tt")!=-1) k += " qtip-definition";	
		
		return k;
	},
	run : function() {
		this.links.each(function(){
			var a = this;
			var c = this.className.replace($exe.tooltips.className+" ","");
			if (c.indexOf("plain")==0) {
			
				$(this).qtip({
					position : {
						viewport : $exe.tooltips.viewport
					},
					content : {
						title : $exe.tooltips.getTooltipTitle(this.title),
						text : $exe.tooltips.getTooltipText(this.title),
						button : c.indexOf("with-button")==-1 ? false : true
					},
					hide : c.indexOf("with-button")==-1 ? {} : { event : false },
					style : {
						tip : {
							corner : c.indexOf("with-button")==-1 ? true : false 
						},
						classes : $exe.tooltips.getClasses(c)
					}					
				});
				
			} else if (c.indexOf("definition")==0) {
				
				var id = this.id.replace("link","t");
				$(this).qtip({
					position : {
						viewport : $exe.tooltips.viewport
					},				
					content : {
						title : $exe.tooltips.getTooltipTitle(this.title),
						text : $("#"+id),
						button : c.indexOf("with-button")==-1 ? false : true
					},
					hide : c.indexOf("with-button")==-1 ? {} : { event : false },
					style : {
						tip : {
							corner : c.indexOf("with-button")==-1 ? true : false 
						},
						classes : $exe.tooltips.getClasses(c)
					}
				});
				
			} else if (c.indexOf("ajax")==0) {
				
				if (typeof($exe.tooltips.isAJAXAllowed)=="undefined") {
					
					$.ajax({
						dataType: "text",
						cache: true,
						url: "exe_tooltips.js"				
					}).done(function(){
						$exe.tooltips.isAJAXAllowed = true;
						$exe.tooltips.enableAJAXTooltip(c,a);
					}).fail(function(){
						$exe.tooltips.isAJAXAllowed = false;
					});
										
				} else {
					if ($exe.tooltips.isAJAXAllowed) {
						$exe.tooltips.enableAJAXTooltip(c,a);
					}
				}
				
			} else if (c.indexOf("glossary")==0) {
				
				var e = $(this);
				var href = e.attr('href');
				if (href.indexOf("#")==-1) {
					var t = $exe.tooltips.getFriendlyURL(e.text());
					e.attr('href',href+"#"+t)
				}

				if (typeof($exe.tooltips.isAJAXAllowed)=="undefined") {
					
					$.ajax({
						dataType: "text",
						cache: true,
						url: "exe_tooltips.js"				
					}).done(function(){
						$exe.tooltips.isAJAXAllowed = true;
						$exe.tooltips.enableGlossaryTooltip(c,a);
					}).fail(function(){
						$exe.tooltips.isAJAXAllowed = false;
					});
										
				} else {
					if ($exe.tooltips.isAJAXAllowed) {
						$exe.tooltips.enableGlossaryTooltip(c,a);
					}
				}				

			}
		});
	}
}

// Export for Node.js/CommonJS (tests)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = $exe.tooltips;
}