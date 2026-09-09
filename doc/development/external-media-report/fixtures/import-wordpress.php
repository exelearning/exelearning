<?php
/**
 * Import evil.elpx into WordPress through the PLUGIN'S OWN upload path.
 *
 * `wp media import` is not enough: it goes through wp_handle_sideload(), while the
 * plugin hooks wp_handle_upload(), so the package is stored but never extracted and the
 * block has no preview to point at. Calling process_elp_upload() directly reproduces
 * exactly what a browser upload does, including the non-deterministic hash the preview
 * URL is derived from — which is why the block cannot be hand-written.
 */

$source = '/tmp/evil.elpx';
if ( ! file_exists( $source ) ) {
	WP_CLI::error( "missing $source" );
}

$upload_dir = wp_upload_dir();
$dest       = trailingslashit( $upload_dir['path'] ) . 'evil.elpx';
if ( file_exists( $dest ) ) {
	wp_delete_file( $dest );
}
copy( $source, $dest );

$handler = new ExeLearning_Elp_Upload_Handler();
$upload  = $handler->process_elp_upload(
	array(
		'file' => $dest,
		'url'  => trailingslashit( $upload_dir['url'] ) . 'evil.elpx',
		'type' => 'application/zip',
	)
);

if ( isset( $upload['error'] ) ) {
	WP_CLI::error( 'extraction refused: ' . $upload['error'] );
}

$attachment_id = wp_insert_attachment(
	array(
		'post_mime_type' => 'application/zip',
		'post_title'     => 'evil.elpx (adversarial probe)',
		'post_status'    => 'inherit',
	),
	$dest
);
if ( is_wp_error( $attachment_id ) ) {
	WP_CLI::error( $attachment_id->get_error_message() );
}

// The plugin normally saves metadata off the add_attachment action; call it directly so
// this works regardless of hook registration order under WP-CLI.
$handler->save_elp_metadata( $attachment_id );

$hash        = get_post_meta( $attachment_id, '_exelearning_extracted', true );
$has_preview = get_post_meta( $attachment_id, '_exelearning_has_preview', true );
if ( ! $hash ) {
	WP_CLI::error( 'no extracted directory was recorded' );
}

$preview_url = rest_url( 'exelearning/v1/content/' . $hash . '/index.html' );
$block       = sprintf(
	'<!-- wp:exelearning/elp-upload %s /-->',
	wp_json_encode(
		array(
			'attachmentId' => (int) $attachment_id,
			'url'          => wp_get_attachment_url( $attachment_id ),
			'previewUrl'   => $preview_url,
			'title'        => 'evil',
			'hasPreview'   => '1' === $has_preview,
			'height'       => 700,
		)
	)
);

$existing = get_page_by_path( 'evil-elpx', OBJECT, 'post' );
$post_id  = wp_insert_post(
	array(
		'ID'           => $existing ? $existing->ID : 0,
		'post_title'   => 'evil.elpx',
		'post_name'    => 'evil-elpx',
		'post_content' => $block,
		'post_status'  => 'publish',
		'post_type'    => 'post',
	)
);
if ( is_wp_error( $post_id ) ) {
	WP_CLI::error( $post_id->get_error_message() );
}

WP_CLI::success(
	wp_json_encode(
		array(
			'attachment' => (int) $attachment_id,
			'hash'       => $hash,
			'hasPreview' => $has_preview,
			'post'       => (int) $post_id,
			'url'        => get_permalink( $post_id ),
		)
	)
);
