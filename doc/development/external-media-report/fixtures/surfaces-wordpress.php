<?php
/**
 * Build the WordPress SURFACES the report walks, on top of an already-imported package.
 *
 * The same package reaches a reader through more than one path, and they are not the same
 * code: the Gutenberg block renders through `render_block()`, the shortcode through its
 * own handler with its own attribute defaults, and the admin editor through the block's
 * edit component. A regression can live in exactly one of them.
 *
 * Reads the attachment created by import-wordpress.php; run that first.
 */

$attachment = (int) ( $args[0] ?? 0 );
if ( ! $attachment ) {
	// Fall back to the most recent .elpx attachment, so the usual case needs no argument.
	$found = get_posts(
		array(
			'post_type'      => 'attachment',
			'post_mime_type' => 'application/zip',
			'posts_per_page' => 1,
			'orderby'        => 'ID',
			'order'          => 'DESC',
			'fields'         => 'ids',
		)
	);
	$attachment = $found ? (int) $found[0] : 0;
}
if ( ! $attachment || ! get_post_meta( $attachment, '_exelearning_extracted', true ) ) {
	WP_CLI::error( 'no extracted .elpx attachment found — run import-wordpress.php first' );
}

$hash        = get_post_meta( $attachment, '_exelearning_extracted', true );
$has_preview = '1' === get_post_meta( $attachment, '_exelearning_has_preview', true );

/** Upsert a post by slug, so re-running this does not litter the site with copies. */
function exe_report_upsert( $slug, $title, $content ) {
	$existing = get_page_by_path( $slug, OBJECT, 'post' );
	$id       = wp_insert_post(
		array(
			'ID'           => $existing ? $existing->ID : 0,
			'post_title'   => $title,
			'post_name'    => $slug,
			'post_content' => $content,
			'post_status'  => 'publish',
			'post_type'    => 'post',
		)
	);
	if ( is_wp_error( $id ) ) {
		WP_CLI::error( $id->get_error_message() );
	}
	return (int) $id;
}

// --- Surface 1: the block, full-width -----------------------------------------------
// `align: full` is the width control Gutenberg exposes; at the default width the content
// frame is narrow enough that the package's theme collapses its navigation, which is a
// different rendering path and hides the very links a walk needs.
$block = sprintf(
	'<!-- wp:exelearning/elp-upload %s /-->',
	wp_json_encode(
		array(
			'attachmentId' => $attachment,
			'url'          => wp_get_attachment_url( $attachment ),
			'previewUrl'   => rest_url( 'exelearning/v1/content/' . $hash . '/index.html' ),
			'title'        => 'evil',
			'hasPreview'   => $has_preview,
			'height'       => 900,
			'align'        => 'full',
		)
	)
);
$block_post = exe_report_upsert( 'evil-elpx', 'evil.elpx (block, full width)', $block );

// --- Surface 2: the shortcode -------------------------------------------------------
$shortcode_post = exe_report_upsert(
	'evil-elpx-shortcode',
	'evil.elpx (shortcode)',
	sprintf( '[exelearning id="%d" width="100%%" height="900"]', $attachment )
);

WP_CLI::success(
	wp_json_encode(
		array(
			'attachment' => $attachment,
			'block'      => get_permalink( $block_post ),
			'shortcode'  => get_permalink( $shortcode_post ),
			'admin'      => admin_url( 'post.php?post=' . $block_post . '&action=edit' ),
		)
	)
);
