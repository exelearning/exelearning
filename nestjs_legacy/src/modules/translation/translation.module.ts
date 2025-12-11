import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TranslationService } from './services/translation.service';
import { XlfParserService } from './services/xlf-parser.service';
import { CommonI18nService } from './services/common-i18n.service';
import { LocaleService } from './services/locale.service';
import { TranslationController } from './controllers/translation.controller';
import { UserPreferencesModule } from '../user-preferences/user-preferences.module';

@Global()
@Module({
    imports: [ConfigModule, UserPreferencesModule],
    providers: [XlfParserService, TranslationService, CommonI18nService, LocaleService],
    controllers: [TranslationController],
    exports: [TranslationService, CommonI18nService, LocaleService],
})
export class TranslationModule {}
