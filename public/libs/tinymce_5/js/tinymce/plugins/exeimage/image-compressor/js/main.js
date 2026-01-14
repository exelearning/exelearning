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
				var file = e.target.files ? e.target.files[0] : null;
				if (file) {
					// Reset firstImageLoaded so loadImage() can update the field
					eXeImageCompressor.firstImageLoaded = false;
					jQuery("#inputSize").val("");
					jQuery("#inputMaxWidth").val(eXeImageCompressor.maxSize)[0].dispatchEvent(new Event('input'));
					jQuery("#inputMaxHeight").val(eXeImageCompressor.maxSize)[0].dispatchEvent(new Event('input'));
					var fileUrl = URL.createObjectURL(file);
					eXeImageCompressor.loadImage(fileUrl);
				}
				this.compress(file);
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
				// Reset firstImageLoaded so loadImage() can update the field
				eXeImageCompressor.firstImageLoaded = false;
				// / eXeLearning
				var file = e.dataTransfer.files ? e.dataTransfer.files[0] : null;
				if (file) {
					var fileUrl = URL.createObjectURL(file);
					eXeImageCompressor.loadImage(fileUrl);
				}
				this.compress(file);
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
			var assetManager = top.eXeLearning?.app?.project?._yjsBridge?.assetManager;

			// Detect URL type for blob/asset handling
			var isBlob = originalSrc.startsWith('blob:');
			var isAsset = originalSrc.startsWith('asset://');
			var isDataUrl = originalSrc.startsWith('data:');

			// Store URL type info for save handler
			top.imgCompressor.isBlob = isBlob;
			top.imgCompressor.isAsset = isAsset;
			top.imgCompressor.assetId = null;

			if (isAsset) {
				if (assetManager && typeof assetManager.extractAssetId === 'function') {
					top.imgCompressor.assetId = assetManager.extractAssetId(originalSrc);
				} else {
					var rawAssetId = originalSrc.replace('asset://', '').split('/')[0];
					var dotIndex = rawAssetId.indexOf('.');
					if (dotIndex > 0) rawAssetId = rawAssetId.substring(0, dotIndex);
					top.imgCompressor.assetId = rawAssetId;
				}
			}

			if (!top.imgCompressor.assetId && isBlob && assetManager && assetManager.reverseBlobCache) {
				var cachedAssetId = assetManager.reverseBlobCache.get(originalSrc);
				if (cachedAssetId) {
					top.imgCompressor.assetId = cachedAssetId;
				}
			}

			if (!top.imgCompressor.assetId) {
				var selectedImg = top.tinymce?.activeEditor?.selection?.getNode?.();
				var dataAssetId = selectedImg && selectedImg.getAttribute ? selectedImg.getAttribute('data-asset-id') : null;
				if (dataAssetId) {
					top.imgCompressor.assetId = dataAssetId;
				}
			}

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
				if (assetManager) {
					// Extract assetId from asset://uuid/filename
					var assetId = top.imgCompressor.assetId || originalSrc.replace('asset://', '').split('/')[0];
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
						eXeImageCompressor.loadImage(originalSrc);
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
	closeOptimizer: function () {
		// Close only the image optimizer dialog, leaving "Insert/Edit Image" dialog open
		// Find TinyMCE from available window contexts
		var tinymceRef = null;
		var contexts = [top, parent];

		for (var i = 0; i < contexts.length; i++) {
			try {
				if (contexts[i]?.tinymce?.activeEditor) {
					tinymceRef = contexts[i].tinymce;
					break;
				}
			} catch (e) {
				// Cross-origin access blocked
			}
		}

		// Close only one dialog (the topmost one, which is the optimizer)
		var wm = tinymceRef?.activeEditor?.windowManager;
		if (wm) {
			wm.close();
		}
	},
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
				// Limit to sizeLimit (absolute maximum)
				if (v > eXeImageCompressor.sizeLimit) v = eXeImageCompressor.sizeLimit;
				if (eXeImageCompressor.firstImageLoaded == false) {
					// If image is larger than maxSize, use maxSize as default
					if (v >= eXeImageCompressor.maxSize) {
						v = eXeImageCompressor.maxSize;
					}
					// Always update the field on first load
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

			// Set imgMaxSize to sizeLimit (will be used by Compressor.js options)
			// The actual inputSize value will be set by loadImage() based on the real image dimensions
			this.imgMaxSize = this.sizeLimit;

			// Set the max attribute to sizeLimit (absolute maximum allowed)
			document.querySelector("#inputSize").max = this.sizeLimit;
			document.querySelector("#inputSize").title = `1 - ${this.sizeLimit}px`;

			// Update Vue's options.maxWidth and options.maxHeight (they were undefined when Vue was created)
			jQuery("#inputMaxWidth").val(this.sizeLimit)[0].dispatchEvent(new Event('input'));
			jQuery("#inputMaxHeight").val(this.sizeLimit)[0].dispatchEvent(new Event('input'));

			// Don't set inputSize here - let loadImage() set it based on actual image dimensions

		setTimeout(function () {
			// Note: We don't register a 'load' event on #imageEditorOutputImg here
			// because loadImage() is called from mounted() with the ORIGINAL image URL.
			// The compressed image may have different dimensions due to Compressor.js options.
			jQuery("#imageEditorSaveImg").fadeIn().click(function () {

				// Update the cookie
				var v = jQuery("#inputSize").val();
				if (!isNaN(v) && v < eXeImageCompressor.sizeLimit) eXeImageCompressor.setCookie(v);

				var img = jQuery("#imageEditorOutputImg");
				var src = img.attr("src");

				// Set image data using TinyMCE dialog API and close optimizer
				function setSourceAndClose(base64Src, imgWidth, imgHeight) {
					// Use the TinyMCE dialog API stored in top.imgCompressor
					var api = top.imgCompressor?.api;
					if (api) {
						// Update Source field
						api.setData({ src: { value: base64Src } });
						// Update Width and Height fields
						api.setData({
							dimensions: {
								width: String(imgWidth),
								height: String(imgHeight)
							}
						});
					}
					// Close the image optimizer dialog
					eXeImageCompressor.closeOptimizer();
				}

				// Get the dimensions of the optimized image
				var imgElement = img[0];
				var imgWidth = imgElement.naturalWidth || imgElement.width;
				var imgHeight = imgElement.naturalHeight || imgElement.height;

				// The optimized image is already in base64 format (data:image/...)
				if (src && src.indexOf("data:image/") === 0) {
					setSourceAndClose(src, imgWidth, imgHeight);
				} else if (src && src.indexOf("blob:") === 0) {
					// Convert blob URL to base64
					fetch(src)
						.then(function(response) { return response.blob(); })
						.then(function(blob) {
							var reader = new FileReader();
							reader.onloadend = function() {
								setSourceAndClose(reader.result, imgWidth, imgHeight);
							};
							reader.readAsDataURL(blob);
						})
						.catch(function(err) {
							console.error('Error converting blob to base64:', err);
							eXeImageCompressor.closeOptimizer();
						});
				} else {
					// Fallback: just close
					eXeImageCompressor.closeOptimizer();
				}

				return false;
			});
			jQuery("#inputSize").on('input', function () {
				var v = this.value;
				v = v.replace(/\D/g, '');
				// Limit to sizeLimit (absolute maximum)
				if (v !== '' && parseInt(v, 10) > eXeImageCompressor.sizeLimit) {
					v = eXeImageCompressor.sizeLimit;
				}
				this.value = v;
				if (v !== '') {
					jQuery("#inputMaxWidth").val(v)[0].dispatchEvent(new Event('input'));
					jQuery("#inputMaxHeight").val(v)[0].dispatchEvent(new Event('input'));
				}
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
