/**
 * Collaborative Editing iDevice - Export/Preview Mode
 *
 * Renders the collaborative text content for preview and export.
 */
/* global $collaborativeediting:true */
var $collaborativeediting = {
	// Configuration
	ideviceClass: 'collaborativeEditingContent',
	mainContentId: 'htmlContent',
	feedbackTitleId: 'feedbackButtonText',
	feedbackContentId: 'feedbackContent',

	/**
	 * Render the view (Engine Order: 1)
	 * @param {Object} data - iDevice data
	 * @param {Object} accessibility - Accessibility settings
	 * @param {string} template - HTML template
	 * @returns {string} - Rendered HTML
	 */
	renderView: function (data, accessibility, template) {
		const htmlContent = this.getHTMLView(data);
		return template.replace('{content}', htmlContent);
	},

	/**
	 * Generate HTML view from data
	 * @param {Object} data - iDevice data
	 * @returns {string} - HTML string
	 */
	getHTMLView: function (data) {
		let html = '';

		// Main content
		const mainContent = data[this.mainContentId] || data.htmlContent || '';
		if (mainContent) {
			html += `<div class="${this.ideviceClass}-main">${mainContent}</div>`;
		}

		// Feedback section (if present)
		const feedbackContent = data[this.feedbackContentId] || data.feedbackContent || '';
		const feedbackTitle = data[this.feedbackTitleId] || data.feedbackButtonText || '';

		if (feedbackContent && feedbackContent.trim()) {
			html += this.createFeedbackHTML(feedbackTitle, feedbackContent);
		}

		// Wrap in container
		return `<div class="${this.ideviceClass}">${html}</div>`;
	},

	/**
	 * Create feedback section HTML
	 * @param {string} title - Button text
	 * @param {string} content - Feedback content
	 * @returns {string} - HTML string
	 */
	createFeedbackHTML: function (title, content) {
		const buttonText = title || _('Show Feedback');
		const hideText = _('Hide Feedback');
		const buttonValue = `${buttonText}|${hideText}`;

		return `
			<div class="iDevice_buttons feedback-button">
				<input type="button" class="feedbackbutton exe-button" value="${buttonValue}" />
			</div>
			<div class="feedback feedback-content" style="display: none;">
				${content}
			</div>
		`;
	},

	/**
	 * Render behaviour (Engine Order: 2)
	 * @param {Object} data - iDevice data
	 * @param {Object} accessibility - Accessibility settings
	 */
	renderBehaviour: function (data, accessibility) {
		// Find feedback buttons and attach handlers
		const $container = $(`.${this.ideviceClass}`);
		if (!$container.length) return;

		const $btn = $container.find('.feedbackbutton');
		const $feedback = $container.find('.feedback-content');

		if ($btn.length && $feedback.length) {
			$btn.on('click', function () {
				const $button = $(this);
				const values = $button.val().split('|');
				const showText = values[0] || _('Show Feedback');
				const hideText = values[1] || showText;

				if ($feedback.is(':visible')) {
					$feedback.fadeOut(300, function () {
						$button.val(`${showText}|${hideText}`);
						$button.text(showText);
					});
				} else {
					$feedback.fadeIn(300, function () {
						$button.val(`${showText}|${hideText}`);
						$button.text(hideText);
					});
				}
			});

			// Set initial button text
			const values = $btn.val().split('|');
			$btn.text(values[0]);
		}

		// Handle LaTeX math if gamification module is available
		if (typeof $exeDevices !== 'undefined' && $exeDevices.iDevice?.gamification?.math) {
			$exeDevices.iDevice.gamification.math.updateLatex($container);
		}
	},

	/**
	 * Initialize (Engine Order: 3)
	 * @param {Object} data - iDevice data
	 * @param {Object} accessibility - Accessibility settings
	 */
	init: function (data, accessibility) {
		// Additional initialization if needed
	},

	/**
	 * Render for old iDevice format (legacy support)
	 * @param {Object} data - iDevice data
	 * @param {jQuery} $node - iDevice node
	 */
	renderHtmlOldIdevice: function (data, $node) {
		const html = this.getHTMLView(data);
		$node.find('.iDevice_content').html(html);
		this.renderBehaviour(data, {});
	},
};
