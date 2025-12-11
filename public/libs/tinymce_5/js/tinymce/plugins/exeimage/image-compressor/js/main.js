window.addEventListener('DOMContentLoaded', function () {
	var Vue = window.Vue;
	var URL = window.URL || window.webkitURL;
	var XMLHttpRequest = window.XMLHttpRequest;
	var Compressor = window.Compressor;

	new Vue({
		el: '#app',

		data: function () {
			var vm = this;

			return {
				options: {
					strict: true,
					checkOrientation: true,
					// maxWidth: eXeImageCompressor.sizeLimit,
					// maxHeight: eXeImageCompressor.sizeLimit,
					maxWidth: eXeImageCompressor.imgMaxSize,
					maxHeight: eXeImageCompressor.imgMaxSize,
					minWidth: 0,
					minHeight: 0,
					width: undefined,
					height: undefined,
					quality: 0.95,
					mimeType: '',
					convertSize: 5000000,
					success: function (result) {
						var reader = new FileReader();
						reader.readAsDataURL(result);
						reader.onloadend = function () {
							var base64data = reader.result;
							vm.outputURL = base64data;
						}
						// console.log('Output: ', result);

						if (URL) {
							vm.outputURL = URL.createObjectURL(result);
						}

						vm.output = result;
						// See #487 vm.$refs.input.value = '';
					},
					error: function (err) {
						window.alert(err.message);
					},
				},
				inputURL: '',
				outputURL: '',
				input: {},
				output: {},
			};
		},

		filters: {
			prettySize: function (size) {
				var kilobyte = 1024;
				var megabyte = kilobyte * kilobyte;

				if (size > megabyte) {
					return (size / megabyte).toFixed(2) + ' MB';
				} else if (size > kilobyte) {
					return (size / kilobyte).toFixed(2) + ' KB';
				} else if (size >= 0) {
					return size + ' B';
				}

				return 'N/A';
			},
		},

		methods: {
			compress: function (file) {
				if (!file) {
					return;
				}

				// console.log('Input: ', file);

				if (URL) {
					this.inputURL = URL.createObjectURL(file);
				}

				this.input = file;
				new Compressor(file, this.options);
			},

			change: function (e) {
				this.compress(e.target.files ? e.target.files[0] : null);
			},

			dragover: function (e) {
				e.preventDefault();
			},

			drop: function (e) {
				e.preventDefault();
				// eXeLearning
				jQuery("#inputSize").val("");
				jQuery("#inputMaxWidth").val(eXeImageCompressor.maxSize)[0].dispatchEvent(new Event('input'));
				jQuery("#inputMaxHeight").val(eXeImageCompressor.maxSize)[0].dispatchEvent(new Event('input'));
				// / eXeLearning
				this.compress(e.dataTransfer.files ? e.dataTransfer.files[0] : null);
			},
		},

		watch: {
			options: {
				deep: true,
				handler: function () {
					this.compress(this.input);
				},
			},
		},

		mounted: function () {
			if (!XMLHttpRequest) {
				return;
			}

			// eXeLearning
			// var name = "exelearning.png";
			// var url = "images/"+name;
			var originalSrc = top.imgCompressor.originalSrc;

			// Detect URL type for blob/asset handling
			var isBlob = originalSrc.startsWith('blob:');
			var isAsset = originalSrc.startsWith('asset://');
			var isDataUrl = originalSrc.startsWith('data:');

			// Store URL type info for save handler
			top.imgCompressor.isBlob = isBlob;
			top.imgCompressor.isAsset = isAsset;

			var ext = originalSrc.split('.').pop();
			ext = ext.toLowerCase();
			if (ext == "jpg" || ext == "jpeg" || originalSrc.indexOf("data:image/jpeg") == 0) jQuery("#inputQuality,label[for='inputQuality']").show();
			else jQuery("#inputQuality,label[for='inputQuality']").hide();

			var name = originalSrc.split("/").pop().split("_").pop();
			// For blob URLs, extract a reasonable filename
			if (isBlob) {
				name = 'optimized_image.jpg';
			}
			top.imgCompressor.fileToSave = name;

			var vm = this;

			// Handle blob: URLs (from IndexedDB/FileManager)
			if (isBlob) {
				fetch(originalSrc)
					.then(function(response) { return response.blob(); })
					.then(function(blob) {
						var date = new Date();
						blob.lastModified = date.getTime();
						blob.lastModifiedDate = date;
						blob.name = name;
						vm.compress(blob);
						eXeImageCompressor.loadImage(originalSrc);
					})
					.catch(function(err) {
						console.error('Error loading blob image:', err);
						jQuery("label[for='file']").trigger("click");
					});
				return;
			}

			// Handle asset:// URLs (from Yjs AssetManager)
			if (isAsset) {
				var assetManager = top.eXeLearning?.app?.project?._yjsBridge?.assetManager;
				if (assetManager) {
					// Extract assetId from asset://uuid/filename
					var assetId = originalSrc.replace('asset://', '').split('/')[0];
					assetManager.getAsset(assetId).then(function(asset) {
						if (asset && asset.blob) {
							var blob = asset.blob;
							var date = new Date();
							blob.lastModified = date.getTime();
							blob.lastModifiedDate = date;
							blob.name = asset.filename || name;
							top.imgCompressor.fileToSave = asset.filename || name;
							vm.compress(blob);
							// Create blob URL for preview
							var blobUrl = URL.createObjectURL(blob);
							eXeImageCompressor.loadImage(blobUrl);
						} else {
							console.error('Asset not found:', assetId);
							jQuery("label[for='file']").trigger("click");
						}
					}).catch(function(err) {
						console.error('Error loading asset image:', err);
						jQuery("label[for='file']").trigger("click");
					});
				} else {
					console.error('AssetManager not available');
					jQuery("label[for='file']").trigger("click");
				}
				return;
			}

			// Handle data: URLs
			if (isDataUrl) {
				fetch(originalSrc)
					.then(function(response) { return response.blob(); })
					.then(function(blob) {
						var date = new Date();
						blob.lastModified = date.getTime();
						blob.lastModifiedDate = date;
						blob.name = name;
						vm.compress(blob);
					})
					.catch(function(err) {
						console.error('Error loading data URL image:', err);
						jQuery("label[for='file']").trigger("click");
					});
				return;
			}

			// Original behavior for server URLs
			var url = `../../../../../../../${originalSrc}`;
			if (originalSrc.indexOf("resources/") == 0) {
				var parts = originalSrc.split("/");
				parts = parts[1];
				if (parts != "") {
					url = top.window.location + "/" + originalSrc;
					name = parts;
					var backupWarning = $i18n.backupWarning;
					backupWarning = backupWarning.replace("$", '<a href="' + url + '" download="' + name + '">');
					backupWarning = backupWarning.replace("$", '</a>');
					$("#imageEditorBackupMessage").html(backupWarning);
					// Get the image size
					eXeImageCompressor.loadImage(url);
				}
			} else if (originalSrc.indexOf("/previews/") == 0) {
				top.eXe.app.alert($i18n.newImageWarning);
			} else {
				// Open the file picker
				jQuery("label[for='file']").trigger("click");
			}

			var xhr = new XMLHttpRequest();

			xhr.onload = function () {
				var blob = xhr.response;
				var date = new Date();

				blob.lastModified = date.getTime();
				blob.lastModifiedDate = date;
				blob.name = name;
				vm.compress(blob);
			};
			xhr.open('GET', url);
			xhr.responseType = 'blob';
			xhr.send();
		},
	});
});
// eXeLearning
var eXeImageCompressor = {
	type: "file", // base64 or file
	sizeLimit: 1200, // true max size
	maxSize: 1200, // default size
	setMaxSize: function () {
		var v = this.getCookie("eXeImageCompressorMaxSize");
		if (!isNaN(v) && v != "") {
			v = Math.round(v);
			if (v > 0 && v < this.sizeLimit) this.maxSize = v;
		}
	},
	firstImageLoaded: false,
	setCookie: function (cvalue) {
		var d = new Date();
		d.setTime(d.getTime() + (30 * 24 * 60 * 60 * 1000));
		var expires = "expires=" + d.toUTCString();
		document.cookie = "eXeImageCompressorMaxSize=" + cvalue + ";" + expires + ";path=/;SameSite=Lax";
	},
	getCookie: function (cname) {
		var name = cname + "=";
		var decodedCookie = decodeURIComponent(document.cookie);
		var ca = decodedCookie.split(';');
		for (var i = 0; i < ca.length; i++) {
			var c = ca[i];
			while (c.charAt(0) == ' ') c = c.substring(1);
			if (c.indexOf(name) == 0) return c.substring(name.length, c.length);
		}
		return "";
	},
	loadImage: function (url) {
		var img = new Image();
		img.onload = function () {
			var w = this.width;
			var h = this.height;
			if (!isNaN(w) && !isNaN(h)) {
				var v = w;
				if (h > w) v = h;
				// if (v > eXeImageCompressor.sizeLimit) v = eXeImageCompressor.sizeLimit;
				if (v > eXeImageCompressor.imgMaxSize) v = eXeImageCompressor.imgMaxSize;
				if (eXeImageCompressor.firstImageLoaded == false && v >= eXeImageCompressor.maxSize) {
					v = eXeImageCompressor.maxSize;
					jQuery("#inputSize").val(v);
					jQuery("#inputMaxWidth").val(v)[0].dispatchEvent(new Event('input'));
					jQuery("#inputMaxHeight").val(v)[0].dispatchEvent(new Event('input'));
				}
				eXeImageCompressor.firstImageLoaded = true;
			}
		}
		img.src = url;
		var ext = url.split('.').pop();
		ext = ext.toLowerCase();
		if (ext == "jpg" || ext == "jpeg" || url.indexOf("data:image/jpeg") == 0) jQuery("#inputQuality,label[for='inputQuality']").show();
		else jQuery("#inputQuality,label[for='inputQuality']").hide();
	},
	init: function () {
		this.i18n();
		this.setMaxSize();
		this.imgMaxSize = "";
		if(parseInt(parent.document.querySelector("#width-dimension").value) >= parseInt(parent.document.querySelector("#height-dimension").value)){
			this.imgMaxSize = document.querySelector("#inputSize").value = parent.document.querySelector("#width-dimension").value;
		}else{
			this.imgMaxSize = document.querySelector("#inputSize").value = parent.document.querySelector("#height-dimension").value;
		}

		if(this.imgMaxSize > 1200){
			this.imgMaxSize = document.querySelector("#inputSize").value = 1200;
		}

		document.querySelector("#inputSize").max = this.imgMaxSize;
		document.querySelector("#inputSize").title = `1 - ${this.imgMaxSize}px`;

		setTimeout(function () {
			jQuery("#imageEditorOutputImg").on('load', function () {
				eXeImageCompressor.loadImage(this.src);
			});
			jQuery("#imageEditorSaveImg").fadeIn().click(function () {

				// Update the cookie
				var v = jQuery("#inputSize").val();
				// if (!isNaN(v) && v < eXeImageCompressor.sizeLimit) eXeImageCompressor.setCookie(v);
				if (!isNaN(v) && v < eXeImageCompressor.imgMaxSize) eXeImageCompressor.setCookie(v);

				var img = jQuery("#imageEditorOutputImg")
				var src = img.attr("src");

				// Helper function to update dimensions and close dialog
				function updateDimensionsAndClose(newPath, isAssetOrBlob) {
					let newsize = document.querySelector("#inputSize").value;

					// Get dimension inputs with null checks
					let widthInput = parent.document.querySelector("#width-dimension");
					let heightInput = parent.document.querySelector("#height-dimension");

					let originalWidth = widthInput ? widthInput.value : newsize;
					let originalHeight = heightInput ? heightInput.value : newsize;
					let aspectRatio = originalWidth / originalHeight || 1;

					// Calculate new dimensions
					let newWidth, newHeight;
					if (aspectRatio > 1) {
						newWidth = newsize;
						newHeight = (newsize / aspectRatio).toFixed();
					} else if (aspectRatio < 1) {
						newHeight = newsize;
						newWidth = (newsize * aspectRatio).toFixed();
					} else {
						newWidth = newHeight = newsize;
					}

					// For blob/asset images, update TinyMCE editor directly and close
					if (isAssetOrBlob) {
						// Update the image directly in the editor
						var editor = top.tinymce?.activeEditor;
						if (editor) {
							var selectedImg = editor.selection.getNode();
							if (selectedImg && selectedImg.tagName === 'IMG') {
								// Update the image attributes directly
								editor.dom.setAttribs(selectedImg, {
									'src': newPath,
									'width': newWidth,
									'height': newHeight
								});
								editor.undoManager.add();
							}
						}

						// Set flag to skip mySubmit processing (image already updated)
						top.imgCompressor.skipSubmit = true;

						// Close using same mechanism as original (button click)
						let closeButton = parent.document.getElementsByClassName("tox-dialog tox-dialog--width-lg")[0].querySelector("BUTTON");
						closeButton.click();
						return;
					}

					// Original behavior for server-side images: update dialog fields and save
					let inputPath = parent.document.querySelector("div.tox-form__group input");
					inputPath.value = newPath;
					if (widthInput) widthInput.value = newWidth;
					if (heightInput) heightInput.value = newHeight;

					let closeButton = parent.document.getElementsByClassName("tox-dialog tox-dialog--width-lg")[0].querySelector("BUTTON");
					closeButton.click();
				}

				// Check if this is a blob/asset image that should be saved to IndexedDB
				var isBlob = top.imgCompressor.isBlob;
				var isAsset = top.imgCompressor.isAsset;
				var assetManager = top.eXeLearning?.app?.project?._yjsBridge?.assetManager;

				// This will upload the image before inserting it in TinyMCE
				// You'll insert /previews/image_name.png instead of a Base64 image
				if (eXeImageCompressor.type == "file") {
					if (src.indexOf("data:image/") == 0) {
						var ext = src.replace("data:image/", "");
						ext = ext.split(";");
						ext = ext[0];
						if (ext != "") {
							ext = ext.toLowerCase();
							if (ext == "jpeg") ext = "jpg";
							if (ext == 'png' || ext == 'gif' || ext == 'jpg') {

								let base64data = document.getElementById("imageEditorOutputImg").getAttribute("src");

								// If blob/asset image and AssetManager is available, save to IndexedDB
								if ((isBlob || isAsset) && assetManager) {
									// Convert base64 to blob and save to AssetManager
									fetch(base64data)
										.then(function(response) { return response.blob(); })
										.then(function(blob) {
											// Determine mime type
											var mimeType = 'image/' + (ext === 'jpg' ? 'jpeg' : ext);
											// Create File object for AssetManager
											var filename = top.imgCompressor.fileToSave || ('optimized.' + ext);
											var file = new File([blob], filename, { type: mimeType });
											return assetManager.insertImage(file);
										})
										.then(function(newAssetUrl) {
											if (newAssetUrl) {
												// Resolve asset:// URL to blob: URL for TinyMCE
												return assetManager.resolveAssetURL(newAssetUrl).then(function(blobUrl) {
													return { assetUrl: newAssetUrl, blobUrl: blobUrl };
												});
											} else {
												throw new Error("Failed to save image");
											}
										})
										.then(function(result) {
											if (result.blobUrl) {
												// Use blob URL for TinyMCE display, mark as asset/blob to update editor directly
												updateDimensionsAndClose(result.blobUrl, true);
											} else {
												top.eXe.app.alert(_("Error saving optimized image"));
											}
										})
										.catch(function(err) {
											console.error('Error saving optimized image to IndexedDB:', err);
											top.eXe.app.alert(_("Error saving optimized image"));
										});
									return false;
								}

								// Original behavior: upload to server
								top.eXe.app.uploadFile(base64data, top.imgCompressor.fileToSave).then(response => {
									if (response && response.savedPath && response.savedFilename) {
										let fullPath = `${response.savedPath}${response.savedFilename}`;
										updateDimensionsAndClose(fullPath, false);
									} else {
										top.eXe.app.alert(_("Error uploading image"));
									}
								})
								return false;
							}
						}
					}
				}

				// This will return a base64 image
				// previewTinyMCEimageDragDrop will do the rest
				// But it will always be a PNG image...
				var tmp = new Image();
				tmp.onload = function () {
					var width = this.width || "";
					var height = this.height || "";
					try {
						top.imgCompressor.callback(src + "?v=" + Date.now(), width, height);
					} catch (e) { }
				}
				tmp.src = src;
				return false;

			});
			jQuery("#inputSize").change(function () {
				var v = this.value;
				v = v.replace(/\D/g, '');
				// if (v > eXeImageCompressor.sizeLimit) v = v.slice(0, -1);
				if(v > eXeImageCompressor.imgMaxSize) v = eXeImageCompressor.imgMaxSize;
				this.value = v;
				jQuery("#inputMaxWidth").val(v)[0].dispatchEvent(new Event('input'));
				jQuery("#inputMaxHeight").val(v)[0].dispatchEvent(new Event('input'));
			});
		}, 1000);
	},
	i18n: function () {

		document.title = $i18n.imageOptimizer;
		var e = $("#imageEditorUploader p");
		var html = $i18n.uploadInstructions;
		html = html.replace("$", '<label for="file">');
		html = html.replace("$", '<input type="file" id="file" accept="image/*" class="sr-only"></label>');
		e.html(html)
		$("label[for='inputSize']").html($i18n.size + ":");
		$("label[for='inputMaxWidth']").html($i18n.maxWidth + ":");
		$("label[for='inputMaxHeight']").html($i18n.maxHeight + ":");
		$("label[for='inputWidth']").html($i18n.width + ":");
		$("label[for='inputHeight']").html($i18n.height + ":");
		$("label[for='inputQuality']").html($i18n.quality + ":");
		$("#imageEditorLabelName").html($i18n.name + ":");
		$("#imageEditorLabelOriginalSize").html($i18n.originalSize + ":");
		$("#imageEditorLabelResultSize").html($i18n.resultSize + ":");
		$("#imageEditorSaveImg").html($i18n.finish);

	},

	sendNewImagePath: function () {

	}
}
jQuery(function () {
	eXeImageCompressor.init();
});