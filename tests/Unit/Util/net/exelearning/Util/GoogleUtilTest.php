<?php

namespace App\Tests\Unit\Util\net\exelearning\Util;

use App\Util\net\exelearning\Util\GoogleUtil;
use PHPUnit\Framework\TestCase;

class GoogleUtilTest extends TestCase
{
    public function test_Constants()
    {
        $this->assertEquals('https://accounts.google.com/o/oauth2/auth', GoogleUtil::GOOGLE_OAUTH_URL);
        $this->assertEquals('https://www.googleapis.com/auth/drive', GoogleUtil::GOOGLE_DRIVE_OAUTH_SCOPE);
        $this->assertEquals('https://www.googleapis.com/drive/v3/files/', GoogleUtil::GOOGLE_DRIVE_FOLDER_LIST);
        $this->assertEquals('https://www.googleapis.com/upload/drive/v3/files', GoogleUtil::GOOGLE_DRIVE_FILE_UPLOAD_URI);
        $this->assertEquals('https://www.googleapis.com/drive/v3/files/', GoogleUtil::GOOGLE_DRIVE_FILE_META_URI);
        $this->assertEquals('https://oauth2.googleapis.com/token', GoogleUtil::GOOGLE_OAUTH2_TOKEN_URI);
        $this->assertEquals('https://drive.google.com/open', GoogleUtil::GOOGLE_DRIVE_FILE_OPEN_URL);
    }
}
