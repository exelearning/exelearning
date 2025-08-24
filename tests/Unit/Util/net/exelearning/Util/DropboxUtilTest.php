<?php

namespace App\Tests\Unit\Util\net\exelearning\Util;

use App\Util\net\exelearning\Util\DropboxUtil;
use PHPUnit\Framework\TestCase;

class DropboxUtilTest extends TestCase
{
    public function test_Constants()
    {
        $this->assertEquals('https://api.dropboxapi.com/2/files/list_folder', DropboxUtil::DROPBOX_API_FOLDER_LIST);
        $this->assertEquals('https://content.dropboxapi.com/2/files/upload', DropboxUtil::DROPBOX_API_UPLOAD);
        $this->assertEquals('https://api.dropboxapi.com/oauth2/token', DropboxUtil::DROPBOX_API_OAUTH2_TOKEN_URI);
        $this->assertEquals('https://www.dropbox.com/oauth2/authorize', DropboxUtil::DROPBOX_API_OAUTH2_URL);
        $this->assertEquals('https://api.dropboxapi.com/2/files/get_metadata', DropboxUtil::DROPBOX_API_GET_METADATA);
    }
}
