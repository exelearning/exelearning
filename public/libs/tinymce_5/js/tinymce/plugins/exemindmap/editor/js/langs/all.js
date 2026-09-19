/*
 * Translators for the embedded mindmaps application.
 *
 * mindmaps calls _() for short interface labels and _r() for its longer help
 * texts. eXeLearning has one GUI translator, window._, and it applies no HTML
 * escaping -- it only unescapes \" and \/ and strips a leading ~ -- so there is
 * nothing for a separate "raw" variant to do differently here. Both names
 * therefore resolve to the same service.
 *
 * mindmaps itself defines _() and _r() as the identity function when a host has
 * not provided them, so it still runs standalone. Assigning them here, before
 * the bundle is loaded, means that fallback never engages inside eXeLearning.
 */
_ = top._;
_r = top._;
var customStrings = {
	openMap : _("Open map"),
	openMapInstructions : _("Select a json file."),
	saveMap : _("Save map"),
	saveMapInstructions : _("Save the mind map as a json file."),
	save : _("Save"),
	size : _("Size"),
	textStyle : _("Text style"),
	textColor : _("Text color"),
	branchColor : _("Line color"),
	recursive : _("Recursive"),
	"export" : _("Export"),
	footer : _("It works with mindmaps")
}