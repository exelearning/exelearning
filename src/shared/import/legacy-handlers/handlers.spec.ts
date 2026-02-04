/**
 * Individual Handler Unit Tests
 *
 * Tests for each legacy iDevice handler's canHandle, getTargetType, getBlockProperties,
 * extractHtmlView, extractFeedback, and extractProperties methods.
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { DOMParser } from '@xmldom/xmldom';

// Import all handlers
import { DefaultHandler } from './DefaultHandler';
import { FreeTextHandler } from './FreeTextHandler';
import { MultichoiceHandler } from './MultichoiceHandler';
import { TrueFalseHandler } from './TrueFalseHandler';
import { FillHandler } from './FillHandler';
import { DropdownHandler } from './DropdownHandler';
import { ScormTestHandler } from './ScormTestHandler';
import { CaseStudyHandler } from './CaseStudyHandler';
import { GalleryHandler } from './GalleryHandler';
import { ExternalUrlHandler } from './ExternalUrlHandler';
import { FileAttachHandler } from './FileAttachHandler';
import { ImageMagnifierHandler } from './ImageMagnifierHandler';
import { GeogebraHandler } from './GeogebraHandler';
import { InteractiveVideoHandler } from './InteractiveVideoHandler';
import { GameHandler } from './GameHandler';
import { FpdSolvedExerciseHandler } from './FpdSolvedExerciseHandler';
import { WikipediaHandler } from './WikipediaHandler';
import { RssHandler } from './RssHandler';
import { NotaHandler } from './NotaHandler';

/**
 * Helper to create DOM element from XML string
 */
function createDomElement(xml: string): Element {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, 'text/xml');
    return doc.documentElement;
}

describe('DefaultHandler', () => {
    let handler: DefaultHandler;

    beforeEach(() => {
        handler = new DefaultHandler();
    });

    describe('canHandle', () => {
        it('should handle any class name', () => {
            expect(handler.canHandle('AnyClass')).toBe(true);
        });

        it('should handle empty string', () => {
            expect(handler.canHandle('')).toBe(true);
        });
    });

    describe('getTargetType', () => {
        it('should return text', () => {
            expect(handler.getTargetType()).toBe('text');
        });
    });

    describe('extractHtmlView', () => {
        it('should return empty string for null dict', () => {
            expect(handler.extractHtmlView(null as unknown as Element)).toBe('');
        });

        it('should extract from fields list (Strategy 1)', () => {
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="fields"/>
                    <list>
                        <instance class="TextAreaField">
                            <dictionary>
                                <string role="key" value="content"/>
                                <unicode value="Fields content"/>
                            </dictionary>
                        </instance>
                    </list>
                </dictionary>
            `);
            expect(handler.extractHtmlView(dict)).toBe('Fields content');
        });

        it('should extract from direct content fields (Strategy 2)', () => {
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="content"/>
                    <unicode value="Direct content"/>
                </dictionary>
            `);
            expect(handler.extractHtmlView(dict)).toBe('Direct content');
        });

        it('should try multiple content field names', () => {
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="story"/>
                    <unicode value="Story content"/>
                </dictionary>
            `);
            expect(handler.extractHtmlView(dict)).toBe('Story content');
        });

        it('should fallback to any TextField (Strategy 3)', () => {
            const dict = createDomElement(`
                <dictionary>
                    <instance class="TextAreaField">
                        <dictionary>
                            <string role="key" value="content"/>
                            <unicode value="Fallback content"/>
                        </dictionary>
                    </instance>
                </dictionary>
            `);
            expect(handler.extractHtmlView(dict)).toBe('Fallback content');
        });
    });

    describe('extractFeedback', () => {
        it('should return empty for null dict', () => {
            const result = handler.extractFeedback(null as unknown as Element);
            expect(result.content).toBe('');
            expect(result.buttonCaption).toBe('');
        });

        it('should extract from answerTextArea (ReflectionIdevice style)', () => {
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="answerTextArea"/>
                    <instance class="TextAreaField">
                        <dictionary>
                            <string role="key" value="content"/>
                            <unicode value="Answer feedback"/>
                        </dictionary>
                    </instance>
                </dictionary>
            `);
            const result = handler.extractFeedback(dict, { language: 'en' });
            expect(result.content).toBe('Answer feedback');
            expect(result.buttonCaption).toBe('Show Feedback');
        });

        it('should return empty when no answerTextArea', () => {
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="other"/>
                    <unicode value="value"/>
                </dictionary>
            `);
            const result = handler.extractFeedback(dict);
            expect(result.content).toBe('');
        });
    });
});

describe('FreeTextHandler', () => {
    let handler: FreeTextHandler;

    beforeEach(() => {
        handler = new FreeTextHandler();
    });

    describe('canHandle', () => {
        it('should handle FreeTextIdevice', () => {
            expect(handler.canHandle('exe.engine.freetextidevice.FreeTextIdevice')).toBe(true);
        });

        it('should handle FreeTextfpdIdevice', () => {
            expect(handler.canHandle('FreeTextfpdIdevice')).toBe(true);
        });

        it('should handle ReflectionIdevice', () => {
            expect(handler.canHandle('ReflectionIdevice')).toBe(true);
        });

        it('should handle ReflectionfpdIdevice', () => {
            expect(handler.canHandle('ReflectionfpdIdevice')).toBe(true);
        });

        it('should handle GenericIdevice', () => {
            expect(handler.canHandle('GenericIdevice')).toBe(true);
        });

        it('should not handle MultichoiceIdevice', () => {
            expect(handler.canHandle('MultichoiceIdevice')).toBe(false);
        });

        it('should not handle ObjectivesIdevice (handled by DefaultHandler)', () => {
            // ObjectivesIdevice is not in FreeTextHandler's canHandle list
            expect(handler.canHandle('ObjectivesIdevice')).toBe(false);
        });
    });

    describe('getTargetType', () => {
        it('should return text', () => {
            expect(handler.getTargetType()).toBe('text');
        });
    });

    describe('extractHtmlView', () => {
        it('should return empty for null dict', () => {
            expect(handler.extractHtmlView(null as unknown as Element)).toBe('');
        });

        it('should extract from activityTextArea', () => {
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="activityTextArea"/>
                    <instance class="TextAreaField">
                        <dictionary>
                            <string role="key" value="content"/>
                            <unicode value="Activity content"/>
                        </dictionary>
                    </instance>
                </dictionary>
            `);
            expect(handler.extractHtmlView(dict)).toBe('Activity content');
        });

        it('should fallback to content key', () => {
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="content"/>
                    <instance class="TextAreaField">
                        <dictionary>
                            <string role="key" value="content"/>
                            <unicode value="Content key value"/>
                        </dictionary>
                    </instance>
                </dictionary>
            `);
            expect(handler.extractHtmlView(dict)).toBe('Content key value');
        });

        it('should fallback to fields list', () => {
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="fields"/>
                    <list>
                        <instance class="TextAreaField">
                            <dictionary>
                                <string role="key" value="content"/>
                                <unicode value="Fields content"/>
                            </dictionary>
                        </instance>
                    </list>
                </dictionary>
            `);
            expect(handler.extractHtmlView(dict)).toBe('Fields content');
        });

        it('should fallback to any TextAreaField', () => {
            const dict = createDomElement(`
                <dictionary>
                    <instance class="TextAreaField">
                        <dictionary>
                            <string role="key" value="content"/>
                            <unicode value="Any field"/>
                        </dictionary>
                    </instance>
                </dictionary>
            `);
            expect(handler.extractHtmlView(dict)).toBe('Any field');
        });

        it('should wrap content with feedback in exe-text-activity', () => {
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="activityTextArea"/>
                    <instance class="TextAreaField">
                        <dictionary>
                            <string role="key" value="content"/>
                            <unicode value="Main content"/>
                        </dictionary>
                    </instance>
                    <string role="key" value="answerTextArea"/>
                    <instance class="TextAreaField">
                        <dictionary>
                            <string role="key" value="content"/>
                            <unicode value="Feedback content"/>
                        </dictionary>
                    </instance>
                </dictionary>
            `);
            const result = handler.extractHtmlView(dict, { language: 'en' });
            expect(result).toContain('exe-text-activity');
            expect(result).toContain('Main content');
            expect(result).toContain('feedbacktooglebutton');
            expect(result).toContain('Feedback content');
        });

        it('should NOT add duplicate feedback when content already has feedbacktooglebutton', () => {
            const contentWithFeedback = `<p>Main content</p>
                <div class="iDevice_buttons feedback-button js-required">
                    <input type="button" class="feedbacktooglebutton" value="Existing Feedback" />
                </div>
                <div class="feedback js-feedback js-hidden">Existing feedback content</div>`;
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="activityTextArea"/>
                    <instance class="TextAreaField">
                        <dictionary>
                            <string role="key" value="content"/>
                            <unicode value="${contentWithFeedback.replace(/"/g, '&quot;')}"/>
                        </dictionary>
                    </instance>
                    <string role="key" value="answerTextArea"/>
                    <instance class="TextAreaField">
                        <dictionary>
                            <string role="key" value="content"/>
                            <unicode value="XML Feedback that should be ignored"/>
                        </dictionary>
                    </instance>
                </dictionary>
            `);
            const result = handler.extractHtmlView(dict, { language: 'en' });
            // Should contain existing feedback, not duplicate
            expect(result).toContain('Existing Feedback');
            expect(result).toContain('Existing feedback content');
            // Should NOT contain the XML feedback
            expect(result).not.toContain('XML Feedback that should be ignored');
            // Should only have ONE feedback button
            const feedbackButtonCount = (result.match(/feedbacktooglebutton/g) || []).length;
            expect(feedbackButtonCount).toBe(1);
        });

        it('should NOT add duplicate feedback when content has feedbackbutton class', () => {
            const contentWithFeedback = `<p>Content</p>
                <div class="iDevice_buttons feedback-button js-required">
                    <input type="button" class="feedbackbutton" value="Info" />
                </div>
                <div class="feedback js-feedback js-hidden">Info content</div>`;
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="activityTextArea"/>
                    <instance class="TextAreaField">
                        <dictionary>
                            <string role="key" value="content"/>
                            <unicode value="${contentWithFeedback.replace(/"/g, '&quot;')}"/>
                        </dictionary>
                    </instance>
                    <string role="key" value="answerTextArea"/>
                    <instance class="TextAreaField">
                        <dictionary>
                            <string role="key" value="content"/>
                            <unicode value="Should be ignored"/>
                        </dictionary>
                    </instance>
                </dictionary>
            `);
            const result = handler.extractHtmlView(dict, { language: 'en' });
            expect(result).toContain('Info content');
            expect(result).not.toContain('Should be ignored');
        });

        it('should wrap content with existing feedback in exe-text-activity if not already wrapped', () => {
            const contentWithFeedback = `<p>Content</p>
                <div class="iDevice_buttons feedback-button js-required">
                    <input type="button" class="feedbacktooglebutton" value="Show" />
                </div>
                <div class="feedback js-feedback js-hidden">Feedback</div>`;
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="activityTextArea"/>
                    <instance class="TextAreaField">
                        <dictionary>
                            <string role="key" value="content"/>
                            <unicode value="${contentWithFeedback.replace(/"/g, '&quot;')}"/>
                        </dictionary>
                    </instance>
                </dictionary>
            `);
            const result = handler.extractHtmlView(dict, { language: 'en' });
            expect(result).toContain('exe-text-activity');
            expect(result).toContain('Feedback');
        });
    });

    describe('extractFeedback', () => {
        it('should return empty for null dict', () => {
            const result = handler.extractFeedback(null as unknown as Element);
            expect(result.content).toBe('');
            expect(result.buttonCaption).toBe('');
        });

        it('should extract from answerTextArea', () => {
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="answerTextArea"/>
                    <instance class="TextAreaField">
                        <dictionary>
                            <string role="key" value="content"/>
                            <unicode value="Answer feedback"/>
                            <string role="key" value="buttonCaption"/>
                            <string value="Show Answer"/>
                        </dictionary>
                    </instance>
                </dictionary>
            `);
            const result = handler.extractFeedback(dict, { language: 'en' });
            expect(result.content).toBe('Answer feedback');
            expect(result.buttonCaption).toBe('Show Answer');
        });

        it('should extract from feedbackTextArea', () => {
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="feedbackTextArea"/>
                    <instance class="TextAreaField">
                        <dictionary>
                            <string role="key" value="content"/>
                            <unicode value="Feedback text"/>
                        </dictionary>
                    </instance>
                </dictionary>
            `);
            const result = handler.extractFeedback(dict, { language: 'en' });
            expect(result.content).toBe('Feedback text');
            expect(result.buttonCaption).toBe('Show Feedback');
        });

        it('should extract from FeedbackField in fields list', () => {
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="fields"/>
                    <list>
                        <instance class="FeedbackField">
                            <dictionary>
                                <string role="key" value="feedback"/>
                                <string value="FeedbackField content"/>
                                <string role="key" value="_buttonCaption"/>
                                <string value="Custom Button"/>
                            </dictionary>
                        </instance>
                    </list>
                </dictionary>
            `);
            const result = handler.extractFeedback(dict);
            expect(result.content).toBe('FeedbackField content');
            expect(result.buttonCaption).toBe('Custom Button');
        });

        it('should use localized default caption for Spanish', () => {
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="answerTextArea"/>
                    <instance class="TextAreaField">
                        <dictionary>
                            <string role="key" value="content"/>
                            <unicode value="Feedback"/>
                        </dictionary>
                    </instance>
                </dictionary>
            `);
            const result = handler.extractFeedback(dict, { language: 'es' });
            expect(result.buttonCaption).toBe('Mostrar retroalimentación');
        });

        it('should return empty when content HTML already has feedback embedded', () => {
            const contentWithFeedback = `<p>Main content</p>
                <div class="iDevice_buttons feedback-button js-required">
                    <input type="button" class="feedbacktooglebutton" value="Existing Feedback" />
                </div>
                <div class="feedback js-feedback js-hidden">Existing feedback content</div>`;
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="activityTextArea"/>
                    <instance class="TextAreaField">
                        <dictionary>
                            <string role="key" value="content"/>
                            <unicode value="${contentWithFeedback.replace(/"/g, '&quot;')}"/>
                        </dictionary>
                    </instance>
                    <string role="key" value="answerTextArea"/>
                    <instance class="TextAreaField">
                        <dictionary>
                            <string role="key" value="content"/>
                            <unicode value="XML Feedback that should be ignored"/>
                        </dictionary>
                    </instance>
                </dictionary>
            `);
            const result = handler.extractFeedback(dict, { language: 'en' });
            // Should return empty because content already has feedback
            expect(result.content).toBe('');
            expect(result.buttonCaption).toBe('');
        });
    });

    describe('extractProperties', () => {
        it('should return empty when no feedback', () => {
            const dict = createDomElement(`<dictionary/>`);
            expect(handler.extractProperties(dict)).toEqual({});
        });

        it('should extract feedback properties', () => {
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="answerTextArea"/>
                    <instance class="TextAreaField">
                        <dictionary>
                            <string role="key" value="content"/>
                            <unicode value="Feedback text"/>
                            <string role="key" value="buttonCaption"/>
                            <string value="Show"/>
                        </dictionary>
                    </instance>
                </dictionary>
            `);
            const props = handler.extractProperties(dict);
            expect(props.textFeedbackTextarea).toBe('Feedback text');
            expect(props.textFeedbackInput).toBe('Show');
        });

        it('should return empty when content HTML already has feedback embedded', () => {
            const contentWithFeedback = `<p>Content</p>
                <div class="iDevice_buttons feedback-button js-required">
                    <input type="button" class="feedbackbutton" value="Info" />
                </div>
                <div class="feedback js-feedback js-hidden">Info content</div>`;
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="activityTextArea"/>
                    <instance class="TextAreaField">
                        <dictionary>
                            <string role="key" value="content"/>
                            <unicode value="${contentWithFeedback.replace(/"/g, '&quot;')}"/>
                        </dictionary>
                    </instance>
                    <string role="key" value="answerTextArea"/>
                    <instance class="TextAreaField">
                        <dictionary>
                            <string role="key" value="content"/>
                            <unicode value="Should be ignored"/>
                            <string role="key" value="buttonCaption"/>
                            <string value="Show"/>
                        </dictionary>
                    </instance>
                </dictionary>
            `);
            const props = handler.extractProperties(dict);
            // Should return empty because content already has feedback
            expect(props).toEqual({});
        });
    });
});

describe('MultichoiceHandler', () => {
    let handler: MultichoiceHandler;

    beforeEach(() => {
        handler = new MultichoiceHandler();
    });

    describe('canHandle', () => {
        it('should handle MultichoiceIdevice', () => {
            expect(handler.canHandle('MultichoiceIdevice')).toBe(true);
        });

        it('should handle MultiSelectIdevice', () => {
            expect(handler.canHandle('MultiSelectIdevice')).toBe(true);
        });

        it('should not handle TrueFalseIdevice', () => {
            expect(handler.canHandle('TrueFalseIdevice')).toBe(false);
        });
    });

    describe('getTargetType', () => {
        it('should return form', () => {
            expect(handler.getTargetType()).toBe('form');
        });
    });

    describe('extractHtmlView', () => {
        it('should return empty for null dict', () => {
            expect(handler.extractHtmlView(null as unknown as Element)).toBe('');
        });

        it('should extract instructionsForLearners', () => {
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="instructionsForLearners"/>
                    <instance class="TextAreaField">
                        <dictionary>
                            <string role="key" value="content"/>
                            <unicode value="Select the correct answer"/>
                        </dictionary>
                    </instance>
                </dictionary>
            `);
            expect(handler.extractHtmlView(dict)).toBe('Select the correct answer');
        });

        it('should return empty when no instructions', () => {
            const dict = createDomElement(`<dictionary/>`);
            expect(handler.extractHtmlView(dict)).toBe('');
        });
    });

    describe('extractFeedback', () => {
        it('should return empty for null dict', () => {
            const result = handler.extractFeedback(null as unknown as Element);
            expect(result.content).toBe('');
            expect(result.buttonCaption).toBe('');
        });

        it('should extract from feedback field', () => {
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="feedback"/>
                    <instance class="TextAreaField">
                        <dictionary>
                            <string role="key" value="content"/>
                            <unicode value="Good job!"/>
                        </dictionary>
                    </instance>
                </dictionary>
            `);
            const result = handler.extractFeedback(dict);
            expect(result.content).toBe('Good job!');
        });

        it('should return empty when no feedback field', () => {
            const dict = createDomElement(`<dictionary/>`);
            const result = handler.extractFeedback(dict);
            expect(result.content).toBe('');
        });
    });

    describe('extractProperties', () => {
        it('should return empty when no questions', () => {
            const dict = createDomElement(`<dictionary/>`);
            expect(handler.extractProperties(dict)).toEqual({});
        });

        it('should extract questionsData from questions list', () => {
            handler.canHandle('MultichoiceIdevice'); // Set single selection type
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="questions"/>
                    <list>
                        <instance class="QuizQuestionField">
                            <dictionary>
                                <string role="key" value="questionTextArea"/>
                                <instance class="TextAreaField">
                                    <dictionary>
                                        <string role="key" value="content"/>
                                        <unicode value="What is 2+2?"/>
                                    </dictionary>
                                </instance>
                                <string role="key" value="options"/>
                                <list>
                                    <instance class="QuizOptionField">
                                        <dictionary>
                                            <string role="key" value="answerTextArea"/>
                                            <instance class="TextAreaField">
                                                <dictionary>
                                                    <string role="key" value="content"/>
                                                    <unicode value="3"/>
                                                </dictionary>
                                            </instance>
                                            <string role="key" value="isCorrect"/>
                                            <bool value="0"/>
                                        </dictionary>
                                    </instance>
                                    <instance class="QuizOptionField">
                                        <dictionary>
                                            <string role="key" value="answerTextArea"/>
                                            <instance class="TextAreaField">
                                                <dictionary>
                                                    <string role="key" value="content"/>
                                                    <unicode value="4"/>
                                                </dictionary>
                                            </instance>
                                            <string role="key" value="isCorrect"/>
                                            <bool value="1"/>
                                        </dictionary>
                                    </instance>
                                </list>
                            </dictionary>
                        </instance>
                    </list>
                </dictionary>
            `);
            const props = handler.extractProperties(dict);
            expect(props.questionsData).toBeDefined();
            const questions = props.questionsData as { baseText: string; answers: unknown[]; selectionType: string }[];
            expect(questions.length).toBe(1);
            expect(questions[0].baseText).toBe('What is 2+2?');
            expect(questions[0].answers.length).toBe(2);
            expect(questions[0].selectionType).toBe('single');
        });

        it('should set multiple selection type for MultiSelectIdevice', () => {
            handler.canHandle('MultiSelectIdevice'); // Set multiple selection type
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="questions"/>
                    <list>
                        <instance class="QuizQuestionField">
                            <dictionary>
                                <string role="key" value="questionTextArea"/>
                                <instance class="TextAreaField">
                                    <dictionary>
                                        <string role="key" value="content"/>
                                        <unicode value="Select all"/>
                                    </dictionary>
                                </instance>
                                <string role="key" value="options"/>
                                <list/>
                            </dictionary>
                        </instance>
                    </list>
                </dictionary>
            `);
            const props = handler.extractProperties(dict);
            const questions = props.questionsData as { selectionType: string }[];
            expect(questions[0].selectionType).toBe('multiple');
        });

        it('should extract hint from hintTextArea', () => {
            handler.canHandle('MultichoiceIdevice');
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="questions"/>
                    <list>
                        <instance class="QuizQuestionField">
                            <dictionary>
                                <string role="key" value="questionTextArea"/>
                                <instance class="TextAreaField">
                                    <dictionary>
                                        <string role="key" value="content"/>
                                        <unicode value="Question"/>
                                    </dictionary>
                                </instance>
                                <string role="key" value="hintTextArea"/>
                                <instance class="TextAreaField">
                                    <dictionary>
                                        <string role="key" value="content"/>
                                        <unicode value="This is a hint"/>
                                    </dictionary>
                                </instance>
                                <string role="key" value="options"/>
                                <list/>
                            </dictionary>
                        </instance>
                    </list>
                </dictionary>
            `);
            const props = handler.extractProperties(dict);
            const questions = props.questionsData as { hint?: string }[];
            expect(questions[0].hint).toBe('This is a hint');
        });

        it('should include per-option feedback', () => {
            handler.canHandle('MultichoiceIdevice');
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="questions"/>
                    <list>
                        <instance class="QuizQuestionField">
                            <dictionary>
                                <string role="key" value="questionTextArea"/>
                                <instance class="TextAreaField">
                                    <dictionary>
                                        <string role="key" value="content"/>
                                        <unicode value="Q"/>
                                    </dictionary>
                                </instance>
                                <string role="key" value="options"/>
                                <list>
                                    <instance class="QuizOptionField">
                                        <dictionary>
                                            <string role="key" value="answerTextArea"/>
                                            <instance class="TextAreaField">
                                                <dictionary>
                                                    <string role="key" value="content"/>
                                                    <unicode value="A"/>
                                                </dictionary>
                                            </instance>
                                            <string role="key" value="isCorrect"/>
                                            <bool value="1"/>
                                            <string role="key" value="feedbackTextArea"/>
                                            <instance class="TextAreaField">
                                                <dictionary>
                                                    <string role="key" value="content"/>
                                                    <unicode value="Correct!"/>
                                                </dictionary>
                                            </instance>
                                        </dictionary>
                                    </instance>
                                </list>
                            </dictionary>
                        </instance>
                    </list>
                </dictionary>
            `);
            const props = handler.extractProperties(dict);
            const questions = props.questionsData as { answers: [boolean, string, string?][] }[];
            expect(questions[0].answers[0]).toEqual([true, 'A', 'Correct!']);
        });

        it('should include eXeFormInstructions when present', () => {
            handler.canHandle('MultichoiceIdevice');
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="instructionsForLearners"/>
                    <instance class="TextAreaField">
                        <dictionary>
                            <string role="key" value="content"/>
                            <unicode value="Instructions here"/>
                        </dictionary>
                    </instance>
                    <string role="key" value="questions"/>
                    <list>
                        <instance class="QuizQuestionField">
                            <dictionary>
                                <string role="key" value="questionTextArea"/>
                                <instance class="TextAreaField">
                                    <dictionary>
                                        <string role="key" value="content"/>
                                        <unicode value="Q"/>
                                    </dictionary>
                                </instance>
                                <string role="key" value="options"/>
                                <list/>
                            </dictionary>
                        </instance>
                    </list>
                </dictionary>
            `);
            const props = handler.extractProperties(dict);
            expect(props.eXeFormInstructions).toBe('Instructions here');
        });
    });
});

describe('TrueFalseHandler', () => {
    let handler: TrueFalseHandler;

    beforeEach(() => {
        handler = new TrueFalseHandler();
    });

    describe('canHandle', () => {
        it('should handle TrueFalseIdevice', () => {
            expect(handler.canHandle('TrueFalseIdevice')).toBe(true);
        });

        it('should handle VerdaderoFalsoFPDIdevice', () => {
            expect(handler.canHandle('VerdaderoFalsoFPDIdevice')).toBe(true);
        });

        it('should not handle MultichoiceIdevice', () => {
            expect(handler.canHandle('MultichoiceIdevice')).toBe(false);
        });
    });

    describe('getTargetType', () => {
        it('should return trueorfalse', () => {
            expect(handler.getTargetType()).toBe('trueorfalse');
        });
    });

    describe('extractHtmlView', () => {
        it('should return empty for null dict', () => {
            expect(handler.extractHtmlView(null as unknown as Element)).toBe('');
        });

        it('should extract from instructionsForLearners', () => {
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="instructionsForLearners"/>
                    <instance class="TextAreaField">
                        <dictionary>
                            <string role="key" value="content"/>
                            <unicode value="Mark each statement as true or false"/>
                        </dictionary>
                    </instance>
                </dictionary>
            `);
            expect(handler.extractHtmlView(dict)).toBe('Mark each statement as true or false');
        });

        it('should fallback to direct TextAreaField', () => {
            const dict = createDomElement(`
                <dictionary>
                    <instance class="TextAreaField">
                        <dictionary>
                            <string role="key" value="content"/>
                            <unicode value="Direct instructions"/>
                        </dictionary>
                    </instance>
                </dictionary>
            `);
            expect(handler.extractHtmlView(dict)).toBe('Direct instructions');
        });

        it('should return empty when no instructions', () => {
            const dict = createDomElement(`<dictionary/>`);
            expect(handler.extractHtmlView(dict)).toBe('');
        });
    });

    describe('extractFeedback', () => {
        it('should return empty (feedback is per-question)', () => {
            const dict = createDomElement(`<dictionary/>`);
            const result = handler.extractFeedback(dict);
            expect(result.content).toBe('');
            expect(result.buttonCaption).toBe('');
        });
    });

    describe('extractProperties', () => {
        it('should return empty when no questions', () => {
            const dict = createDomElement(`<dictionary/>`);
            expect(handler.extractProperties(dict)).toEqual({});
        });

        it('should extract questionsGame from TrueFalseQuestion list', () => {
            const dict = createDomElement(`
                <dictionary>
                    <list>
                        <instance class="TrueFalseQuestion">
                            <dictionary>
                                <string role="key" value="questionTextArea"/>
                                <instance class="TextAreaField">
                                    <dictionary>
                                        <string role="key" value="content"/>
                                        <unicode value="The earth is flat"/>
                                    </dictionary>
                                </instance>
                                <string role="key" value="isCorrect"/>
                                <bool value="0"/>
                            </dictionary>
                        </instance>
                    </list>
                </dictionary>
            `);
            const props = handler.extractProperties(dict);
            expect(props.typeGame).toBe('TrueOrFalse');
            expect(props.questionsGame).toBeDefined();
            const questions = props.questionsGame as { question: string; solution: number }[];
            expect(questions.length).toBe(1);
            expect(questions[0].question).toBe('The earth is flat');
            expect(questions[0].solution).toBe(0); // false = 0
        });

        it('should extract from questions key', () => {
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="questions"/>
                    <list>
                        <instance class="TrueFalseQuestion">
                            <dictionary>
                                <string role="key" value="questionTextArea"/>
                                <instance class="TextAreaField">
                                    <dictionary>
                                        <string role="key" value="content"/>
                                        <unicode value="Water boils at 100C"/>
                                    </dictionary>
                                </instance>
                                <string role="key" value="isCorrect"/>
                                <bool value="1"/>
                            </dictionary>
                        </instance>
                    </list>
                </dictionary>
            `);
            const props = handler.extractProperties(dict);
            const questions = props.questionsGame as { question: string; solution: number }[];
            expect(questions[0].question).toBe('Water boils at 100C');
            expect(questions[0].solution).toBe(1); // true = 1
        });

        it('should extract hint as suggestion', () => {
            const dict = createDomElement(`
                <dictionary>
                    <list>
                        <instance class="TrueFalseQuestion">
                            <dictionary>
                                <string role="key" value="questionTextArea"/>
                                <instance class="TextAreaField">
                                    <dictionary>
                                        <string role="key" value="content"/>
                                        <unicode value="Question"/>
                                    </dictionary>
                                </instance>
                                <string role="key" value="isCorrect"/>
                                <bool value="1"/>
                                <string role="key" value="hintTextArea"/>
                                <instance class="TextAreaField">
                                    <dictionary>
                                        <string role="key" value="content"/>
                                        <unicode value="Think about it"/>
                                    </dictionary>
                                </instance>
                            </dictionary>
                        </instance>
                    </list>
                </dictionary>
            `);
            const props = handler.extractProperties(dict);
            const questions = props.questionsGame as { suggestion: string }[];
            expect(questions[0].suggestion).toBe('Think about it');
        });

        it('should extract per-question feedback', () => {
            const dict = createDomElement(`
                <dictionary>
                    <list>
                        <instance class="TrueFalseQuestion">
                            <dictionary>
                                <string role="key" value="questionTextArea"/>
                                <instance class="TextAreaField">
                                    <dictionary>
                                        <string role="key" value="content"/>
                                        <unicode value="Question"/>
                                    </dictionary>
                                </instance>
                                <string role="key" value="isCorrect"/>
                                <bool value="1"/>
                                <string role="key" value="feedbackTextArea"/>
                                <instance class="TextAreaField">
                                    <dictionary>
                                        <string role="key" value="content"/>
                                        <unicode value="Correct!"/>
                                    </dictionary>
                                </instance>
                            </dictionary>
                        </instance>
                    </list>
                </dictionary>
            `);
            const props = handler.extractProperties(dict);
            const questions = props.questionsGame as { feedback: string }[];
            expect(questions[0].feedback).toBe('Correct!');
        });

        it('should include default messages', () => {
            const dict = createDomElement(`
                <dictionary>
                    <list>
                        <instance class="TrueFalseQuestion">
                            <dictionary>
                                <string role="key" value="questionTextArea"/>
                                <instance class="TextAreaField">
                                    <dictionary>
                                        <string role="key" value="content"/>
                                        <unicode value="Q"/>
                                    </dictionary>
                                </instance>
                                <string role="key" value="isCorrect"/>
                                <bool value="1"/>
                            </dictionary>
                        </instance>
                    </list>
                </dictionary>
            `);
            const props = handler.extractProperties(dict);
            expect(props.msgs).toBeDefined();
            const msgs = props.msgs as { msgTrue: string; msgFalse: string };
            expect(msgs.msgTrue).toBe('True');
            expect(msgs.msgFalse).toBe('False');
        });

        it('should include eXeGameInstructions when present', () => {
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="instructionsForLearners"/>
                    <instance class="TextAreaField">
                        <dictionary>
                            <string role="key" value="content"/>
                            <unicode value="Game instructions"/>
                        </dictionary>
                    </instance>
                    <list>
                        <instance class="TrueFalseQuestion">
                            <dictionary>
                                <string role="key" value="questionTextArea"/>
                                <instance class="TextAreaField">
                                    <dictionary>
                                        <string role="key" value="content"/>
                                        <unicode value="Q"/>
                                    </dictionary>
                                </instance>
                                <string role="key" value="isCorrect"/>
                                <bool value="1"/>
                            </dictionary>
                        </instance>
                    </list>
                </dictionary>
            `);
            const props = handler.extractProperties(dict);
            expect(props.eXeGameInstructions).toBe('Game instructions');
        });
    });
});

describe('FillHandler', () => {
    let handler: FillHandler;

    beforeEach(() => {
        handler = new FillHandler();
    });

    describe('canHandle', () => {
        it('should handle ClozeIdevice', () => {
            expect(handler.canHandle('ClozeIdevice')).toBe(true);
        });

        it('should handle ClozeActivityIdevice', () => {
            expect(handler.canHandle('ClozeActivityIdevice')).toBe(true);
        });

        it('should handle ClozeLanguageIdevice', () => {
            expect(handler.canHandle('ClozeLanguageIdevice')).toBe(true);
        });

        it('should handle ClozeLangIdevice', () => {
            expect(handler.canHandle('ClozeLangIdevice')).toBe(true);
        });

        it('should handle ClozelangfpdIdevice', () => {
            expect(handler.canHandle('ClozelangfpdIdevice')).toBe(true);
        });

        it('should not handle TrueFalseIdevice', () => {
            expect(handler.canHandle('TrueFalseIdevice')).toBe(false);
        });
    });

    describe('getTargetType', () => {
        it('should return form', () => {
            expect(handler.getTargetType()).toBe('form');
        });
    });

    describe('extractHtmlView', () => {
        it('should return empty for null dict', () => {
            expect(handler.extractHtmlView(null as unknown as Element)).toBe('');
        });

        it('should extract instructionsForLearners', () => {
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="instructionsForLearners"/>
                    <instance class="TextAreaField">
                        <dictionary>
                            <string role="key" value="content"/>
                            <unicode value="Fill in the blanks"/>
                        </dictionary>
                    </instance>
                </dictionary>
            `);
            expect(handler.extractHtmlView(dict)).toBe('Fill in the blanks');
        });

        it('should return empty when no instructions', () => {
            const dict = createDomElement(`<dictionary/>`);
            expect(handler.extractHtmlView(dict)).toBe('');
        });
    });

    describe('extractFeedback', () => {
        it('should return empty for null dict', () => {
            const result = handler.extractFeedback(null as unknown as Element);
            expect(result.content).toBe('');
        });

        it('should extract from feedback field', () => {
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="feedback"/>
                    <instance class="TextAreaField">
                        <dictionary>
                            <string role="key" value="content"/>
                            <unicode value="Good job!"/>
                        </dictionary>
                    </instance>
                </dictionary>
            `);
            const result = handler.extractFeedback(dict);
            expect(result.content).toBe('Good job!');
        });

        it('should extract from feedbackTextArea', () => {
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="feedbackTextArea"/>
                    <instance class="TextAreaField">
                        <dictionary>
                            <string role="key" value="content"/>
                            <unicode value="Alt feedback"/>
                        </dictionary>
                    </instance>
                </dictionary>
            `);
            const result = handler.extractFeedback(dict);
            expect(result.content).toBe('Alt feedback');
        });
    });

    describe('extractProperties', () => {
        it('should return empty object when no content', () => {
            const dict = createDomElement(`<dictionary/>`);
            // Properties will have settings even without content
            const props = handler.extractProperties(dict);
            expect(props.questionsData).toBeUndefined();
        });

        it('should extract questionsData from _content ClozeField', () => {
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="_content"/>
                    <instance class="ClozeField">
                        <dictionary>
                            <string role="key" value="_encodedContent"/>
                            <string value="The &lt;u&gt;cat&lt;/u&gt; sat on the &lt;u&gt;mat&lt;/u&gt;"/>
                        </dictionary>
                    </instance>
                </dictionary>
            `);
            const props = handler.extractProperties(dict);
            expect(props.questionsData).toBeDefined();
            const questions = props.questionsData as { activityType: string; baseText: string; answers: string[] }[];
            expect(questions.length).toBe(1);
            expect(questions[0].activityType).toBe('fill');
            expect(questions[0].baseText).toContain('<u>cat</u>');
            expect(questions[0].answers).toContain('cat');
            expect(questions[0].answers).toContain('mat');
        });

        it('should extract from _cloze key', () => {
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="_cloze"/>
                    <instance class="ClozeField">
                        <dictionary>
                            <string role="key" value="_clozeText"/>
                            <string value="Hello &lt;u&gt;world&lt;/u&gt;"/>
                        </dictionary>
                    </instance>
                </dictionary>
            `);
            const props = handler.extractProperties(dict);
            const questions = props.questionsData as { answers: string[] }[];
            expect(questions[0].answers).toContain('world');
        });

        it('should extract from ClozeField by class', () => {
            const dict = createDomElement(`
                <dictionary>
                    <instance class="exe.engine.field.ClozeField">
                        <dictionary>
                            <string role="key" value="_encodedContent"/>
                            <string value="Test &lt;u&gt;answer&lt;/u&gt;"/>
                        </dictionary>
                    </instance>
                </dictionary>
            `);
            const props = handler.extractProperties(dict);
            const questions = props.questionsData as { answers: string[] }[];
            expect(questions[0].answers).toContain('answer');
        });

        it('should extract from clozeTextArea', () => {
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="clozeTextArea"/>
                    <instance class="TextAreaField">
                        <dictionary>
                            <string role="key" value="content"/>
                            <unicode value="Fill &lt;u&gt;blank&lt;/u&gt;"/>
                        </dictionary>
                    </instance>
                </dictionary>
            `);
            const props = handler.extractProperties(dict);
            const questions = props.questionsData as { answers: string[] }[];
            expect(questions[0].answers).toContain('blank');
        });

        it('should include eXeFormInstructions', () => {
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="instructionsForLearners"/>
                    <instance class="TextAreaField">
                        <dictionary>
                            <string role="key" value="content"/>
                            <unicode value="Instructions here"/>
                        </dictionary>
                    </instance>
                    <string role="key" value="_content"/>
                    <instance class="ClozeField">
                        <dictionary>
                            <string role="key" value="_encodedContent"/>
                            <string value="&lt;u&gt;test&lt;/u&gt;"/>
                        </dictionary>
                    </instance>
                </dictionary>
            `);
            const props = handler.extractProperties(dict);
            expect(props.eXeFormInstructions).toBe('Instructions here');
        });

        it('should include eXeIdeviceTextAfter from feedback', () => {
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="feedback"/>
                    <instance class="TextAreaField">
                        <dictionary>
                            <string role="key" value="content"/>
                            <unicode value="Completed!"/>
                        </dictionary>
                    </instance>
                </dictionary>
            `);
            const props = handler.extractProperties(dict);
            expect(props.eXeIdeviceTextAfter).toBe('Completed!');
        });

        it('should normalize variant cloze formats', () => {
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="_content"/>
                    <instance class="ClozeField">
                        <dictionary>
                            <string role="key" value="_encodedContent"/>
                            <string value="&lt;u class=&quot;exe-cloze-word&quot;&gt;styled&lt;/u&gt; text"/>
                        </dictionary>
                    </instance>
                </dictionary>
            `);
            const props = handler.extractProperties(dict);
            const questions = props.questionsData as { baseText: string; answers: string[] }[];
            expect(questions[0].answers).toContain('styled');
        });
    });
});

describe('DropdownHandler', () => {
    let handler: DropdownHandler;

    beforeEach(() => {
        handler = new DropdownHandler();
    });

    describe('canHandle', () => {
        it('should handle ListaIdevice', () => {
            expect(handler.canHandle('ListaIdevice')).toBe(true);
        });

        it('should not handle ClozeIdevice', () => {
            expect(handler.canHandle('ClozeIdevice')).toBe(false);
        });
    });

    describe('getTargetType', () => {
        it('should return form', () => {
            expect(handler.getTargetType()).toBe('form');
        });
    });

    describe('extractHtmlView', () => {
        it('should return empty for null dict', () => {
            expect(handler.extractHtmlView(null as unknown as Element)).toBe('');
        });

        it('should extract instructionsForLearners', () => {
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="instructionsForLearners"/>
                    <instance class="TextAreaField">
                        <dictionary>
                            <string role="key" value="content"/>
                            <unicode value="Select the correct option"/>
                        </dictionary>
                    </instance>
                </dictionary>
            `);
            expect(handler.extractHtmlView(dict)).toBe('Select the correct option');
        });

        it('should return empty when no instructions', () => {
            const dict = createDomElement(`<dictionary/>`);
            expect(handler.extractHtmlView(dict)).toBe('');
        });
    });

    describe('extractFeedback', () => {
        it('should return empty for null dict', () => {
            const result = handler.extractFeedback(null as unknown as Element);
            expect(result.content).toBe('');
            expect(result.buttonCaption).toBe('');
        });

        it('should extract from feedback field', () => {
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="feedback"/>
                    <instance class="TextAreaField">
                        <dictionary>
                            <string role="key" value="content"/>
                            <unicode value="Feedback content"/>
                            <string role="key" value="buttonCaption"/>
                            <string value="Check"/>
                        </dictionary>
                    </instance>
                </dictionary>
            `);
            const result = handler.extractFeedback(dict);
            expect(result.content).toBe('Feedback content');
            expect(result.buttonCaption).toBe('Check');
        });

        it('should extract from feedbackTextArea', () => {
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="feedbackTextArea"/>
                    <instance class="TextAreaField">
                        <dictionary>
                            <string role="key" value="content"/>
                            <unicode value="Alt feedback"/>
                        </dictionary>
                    </instance>
                </dictionary>
            `);
            const result = handler.extractFeedback(dict, { language: 'en' });
            expect(result.content).toBe('Alt feedback');
            expect(result.buttonCaption).toBe('Show Feedback');
        });
    });

    describe('extractProperties', () => {
        it('should return empty when no questions or feedback', () => {
            const dict = createDomElement(`<dictionary/>`);
            expect(handler.extractProperties(dict)).toEqual({});
        });

        it('should extract questionsData from _content ListaField', () => {
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="_content"/>
                    <instance class="ListaField">
                        <dictionary>
                            <string role="key" value="_encodedContent"/>
                            <string value="Select the &lt;u&gt;correct&lt;/u&gt; answer"/>
                            <string role="key" value="otras"/>
                            <string value="wrong1|wrong2"/>
                        </dictionary>
                    </instance>
                </dictionary>
            `);
            const props = handler.extractProperties(dict);
            expect(props.questionsData).toBeDefined();
            const questions = props.questionsData as {
                activityType: string;
                baseText: string;
                wrongAnswersValue: string;
            }[];
            expect(questions.length).toBe(1);
            expect(questions[0].activityType).toBe('dropdown');
            expect(questions[0].baseText).toContain('<u>correct</u>');
            expect(questions[0].wrongAnswersValue).toBe('wrong1|wrong2');
        });

        it('should extract from list of ListaField instances', () => {
            const dict = createDomElement(`
                <dictionary>
                    <list>
                        <instance class="ListaField">
                            <dictionary>
                                <string role="key" value="content_w_resourcePaths"/>
                                <string value="Fill the &lt;u&gt;blank&lt;/u&gt;"/>
                            </dictionary>
                        </instance>
                    </list>
                </dictionary>
            `);
            const props = handler.extractProperties(dict);
            const questions = props.questionsData as { baseText: string }[];
            expect(questions.length).toBe(1);
            expect(questions[0].baseText).toContain('<u>blank</u>');
        });

        it('should include eXeFormInstructions', () => {
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="instructionsForLearners"/>
                    <instance class="TextAreaField">
                        <dictionary>
                            <string role="key" value="content"/>
                            <unicode value="Instructions"/>
                        </dictionary>
                    </instance>
                    <string role="key" value="_content"/>
                    <instance class="ListaField">
                        <dictionary>
                            <string role="key" value="_encodedContent"/>
                            <string value="&lt;u&gt;test&lt;/u&gt;"/>
                        </dictionary>
                    </instance>
                </dictionary>
            `);
            const props = handler.extractProperties(dict);
            expect(props.eXeFormInstructions).toBe('Instructions');
        });

        it('should include eXeIdeviceTextAfter from feedback', () => {
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="feedback"/>
                    <instance class="TextAreaField">
                        <dictionary>
                            <string role="key" value="content"/>
                            <unicode value="Well done!"/>
                        </dictionary>
                    </instance>
                </dictionary>
            `);
            const props = handler.extractProperties(dict);
            expect(props.eXeIdeviceTextAfter).toBe('Well done!');
        });
    });
});

describe('ScormTestHandler', () => {
    let handler: ScormTestHandler;

    beforeEach(() => {
        handler = new ScormTestHandler();
    });

    describe('canHandle', () => {
        it('should handle ScormTestIdevice', () => {
            expect(handler.canHandle('ScormTestIdevice')).toBe(true);
        });

        it('should handle QuizTestIdevice', () => {
            expect(handler.canHandle('QuizTestIdevice')).toBe(true);
        });

        it('should not handle MultichoiceIdevice', () => {
            expect(handler.canHandle('MultichoiceIdevice')).toBe(false);
        });
    });

    describe('getTargetType', () => {
        it('should return form', () => {
            expect(handler.getTargetType()).toBe('form');
        });
    });

    describe('extractHtmlView', () => {
        it('should return empty (no instructions for ScormTest)', () => {
            const dict = createDomElement(`<dictionary/>`);
            expect(handler.extractHtmlView(dict)).toBe('');
        });
    });

    describe('extractFeedback', () => {
        it('should return empty (no iDevice-level feedback)', () => {
            const dict = createDomElement(`<dictionary/>`);
            const result = handler.extractFeedback(dict);
            expect(result.content).toBe('');
            expect(result.buttonCaption).toBe('');
        });
    });

    describe('extractProperties', () => {
        it('should return empty for null dict', () => {
            expect(handler.extractProperties(null as unknown as Element)).toEqual({});
        });

        it('should return empty when no questions', () => {
            const dict = createDomElement(`<dictionary/>`);
            expect(handler.extractProperties(dict)).toEqual({});
        });

        it('should extract questionsData from TestQuestion list', () => {
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="questions"/>
                    <list>
                        <instance class="TestQuestion">
                            <dictionary>
                                <string role="key" value="questionTextArea"/>
                                <instance class="TextAreaField">
                                    <dictionary>
                                        <string role="key" value="content"/>
                                        <unicode value="What is the capital of France?"/>
                                    </dictionary>
                                </instance>
                                <string role="key" value="options"/>
                                <list>
                                    <instance class="AnswerOption">
                                        <dictionary>
                                            <string role="key" value="answerTextArea"/>
                                            <instance class="TextAreaField">
                                                <dictionary>
                                                    <string role="key" value="content"/>
                                                    <unicode value="Paris"/>
                                                </dictionary>
                                            </instance>
                                            <string role="key" value="isCorrect"/>
                                            <bool value="1"/>
                                        </dictionary>
                                    </instance>
                                    <instance class="AnswerOption">
                                        <dictionary>
                                            <string role="key" value="answerTextArea"/>
                                            <instance class="TextAreaField">
                                                <dictionary>
                                                    <string role="key" value="content"/>
                                                    <unicode value="London"/>
                                                </dictionary>
                                            </instance>
                                            <string role="key" value="isCorrect"/>
                                            <bool value="0"/>
                                        </dictionary>
                                    </instance>
                                </list>
                            </dictionary>
                        </instance>
                    </list>
                </dictionary>
            `);
            const props = handler.extractProperties(dict);
            expect(props.questionsData).toBeDefined();
            const questions = props.questionsData as {
                activityType: string;
                selectionType: string;
                baseText: string;
                answers: [boolean, string][];
            }[];
            expect(questions.length).toBe(1);
            expect(questions[0].activityType).toBe('selection');
            expect(questions[0].selectionType).toBe('single');
            expect(questions[0].baseText).toBe('What is the capital of France?');
            expect(questions[0].answers.length).toBe(2);
            expect(questions[0].answers[0]).toEqual([true, 'Paris']);
            expect(questions[0].answers[1]).toEqual([false, 'London']);
        });

        it('should detect multiple selection type', () => {
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="questions"/>
                    <list>
                        <instance class="TestQuestion">
                            <dictionary>
                                <string role="key" value="questionTextArea"/>
                                <instance class="TextAreaField">
                                    <dictionary>
                                        <string role="key" value="content"/>
                                        <unicode value="Select all colors"/>
                                    </dictionary>
                                </instance>
                                <string role="key" value="options"/>
                                <list>
                                    <instance class="AnswerOption">
                                        <dictionary>
                                            <string role="key" value="answerTextArea"/>
                                            <instance class="TextAreaField">
                                                <dictionary>
                                                    <string role="key" value="content"/>
                                                    <unicode value="Red"/>
                                                </dictionary>
                                            </instance>
                                            <string role="key" value="isCorrect"/>
                                            <bool value="1"/>
                                        </dictionary>
                                    </instance>
                                    <instance class="AnswerOption">
                                        <dictionary>
                                            <string role="key" value="answerTextArea"/>
                                            <instance class="TextAreaField">
                                                <dictionary>
                                                    <string role="key" value="content"/>
                                                    <unicode value="Blue"/>
                                                </dictionary>
                                            </instance>
                                            <string role="key" value="isCorrect"/>
                                            <bool value="1"/>
                                        </dictionary>
                                    </instance>
                                </list>
                            </dictionary>
                        </instance>
                    </list>
                </dictionary>
            `);
            const props = handler.extractProperties(dict);
            const questions = props.questionsData as { selectionType: string }[];
            expect(questions[0].selectionType).toBe('multiple');
        });

        it('should extract passRate as dropdownPassRate', () => {
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="passRate"/>
                    <string value="70"/>
                    <string role="key" value="questions"/>
                    <list>
                        <instance class="TestQuestion">
                            <dictionary>
                                <string role="key" value="questionTextArea"/>
                                <instance class="TextAreaField">
                                    <dictionary>
                                        <string role="key" value="content"/>
                                        <unicode value="Q"/>
                                    </dictionary>
                                </instance>
                                <string role="key" value="options"/>
                                <list/>
                            </dictionary>
                        </instance>
                    </list>
                </dictionary>
            `);
            const props = handler.extractProperties(dict);
            expect(props.dropdownPassRate).toBe('70');
        });

        it('should include userTranslations', () => {
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="questions"/>
                    <list>
                        <instance class="TestQuestion">
                            <dictionary>
                                <string role="key" value="questionTextArea"/>
                                <instance class="TextAreaField">
                                    <dictionary>
                                        <string role="key" value="content"/>
                                        <unicode value="Q"/>
                                    </dictionary>
                                </instance>
                                <string role="key" value="options"/>
                                <list/>
                            </dictionary>
                        </instance>
                    </list>
                </dictionary>
            `);
            const props = handler.extractProperties(dict);
            expect(props.userTranslations).toBeDefined();
            const translations = props.userTranslations as Record<string, string>;
            expect(translations.langSingleSelectionHelp).toBeDefined();
        });
    });
});

describe('CaseStudyHandler', () => {
    let handler: CaseStudyHandler;

    beforeEach(() => {
        handler = new CaseStudyHandler();
    });

    describe('canHandle', () => {
        it('should handle CaseStudyIdevice', () => {
            expect(handler.canHandle('CaseStudyIdevice')).toBe(true);
        });

        it('should handle CasestudyIdevice (case insensitive)', () => {
            expect(handler.canHandle('casestudyidevice')).toBe(true);
        });

        it('should handle EjercicioresueltofpdIdevice', () => {
            expect(handler.canHandle('EjercicioresueltofpdIdevice')).toBe(true);
        });

        it('should not handle FreeTextIdevice', () => {
            expect(handler.canHandle('FreeTextIdevice')).toBe(false);
        });
    });

    describe('getTargetType', () => {
        it('should return casestudy', () => {
            expect(handler.getTargetType()).toBe('casestudy');
        });
    });

    describe('extractHtmlView', () => {
        it('should return empty (all content in jsonProperties)', () => {
            const dict = createDomElement(`<dictionary/>`);
            expect(handler.extractHtmlView(dict)).toBe('');
        });
    });

    describe('extractFeedback', () => {
        it('should return empty (activities have individual feedback)', () => {
            const dict = createDomElement(`<dictionary/>`);
            const result = handler.extractFeedback(dict);
            expect(result.content).toBe('');
            expect(result.buttonCaption).toBe('');
        });
    });

    describe('extractProperties', () => {
        it('should return default structure for null dict', () => {
            const props = handler.extractProperties(null as unknown as Element);
            expect(props.history).toBe('');
            expect(props.activities).toEqual([]);
        });

        it('should extract history from storyTextArea', () => {
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="storyTextArea"/>
                    <instance class="TextAreaField">
                        <dictionary>
                            <string role="key" value="content"/>
                            <unicode value="Case study introduction"/>
                        </dictionary>
                    </instance>
                </dictionary>
            `);
            const props = handler.extractProperties(dict);
            expect(props.history).toBe('Case study introduction');
        });

        it('should fallback to story key', () => {
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="story"/>
                    <instance class="TextAreaField">
                        <dictionary>
                            <string role="key" value="content"/>
                            <unicode value="Story content"/>
                        </dictionary>
                    </instance>
                </dictionary>
            `);
            const props = handler.extractProperties(dict);
            expect(props.history).toBe('Story content');
        });

        it('should extract activities from questions list', () => {
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="questions"/>
                    <list>
                        <instance class="Question">
                            <dictionary>
                                <string role="key" value="questionTextArea"/>
                                <instance class="TextAreaField">
                                    <dictionary>
                                        <string role="key" value="content"/>
                                        <unicode value="Activity 1"/>
                                    </dictionary>
                                </instance>
                                <string role="key" value="feedbackTextArea"/>
                                <instance class="TextAreaField">
                                    <dictionary>
                                        <string role="key" value="content"/>
                                        <unicode value="Feedback 1"/>
                                        <string role="key" value="buttonCaption"/>
                                        <string value="Show"/>
                                    </dictionary>
                                </instance>
                            </dictionary>
                        </instance>
                    </list>
                </dictionary>
            `);
            const props = handler.extractProperties(dict);
            const activities = props.activities as { activity: string; feedback: string; buttonCaption: string }[];
            expect(activities.length).toBe(1);
            expect(activities[0].activity).toBe('Activity 1');
            expect(activities[0].feedback).toBe('Feedback 1');
            expect(activities[0].buttonCaption).toBe('Show');
        });

        it('should use default button caption for language', () => {
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="questions"/>
                    <list>
                        <instance class="Question">
                            <dictionary>
                                <string role="key" value="questionTextArea"/>
                                <instance class="TextAreaField">
                                    <dictionary>
                                        <string role="key" value="content"/>
                                        <unicode value="Activity"/>
                                    </dictionary>
                                </instance>
                            </dictionary>
                        </instance>
                    </list>
                </dictionary>
            `);
            const props = handler.extractProperties(dict, undefined, { language: 'es' });
            const activities = props.activities as { buttonCaption: string }[];
            expect(activities[0].buttonCaption).toBe('Mostrar retroalimentación');
        });

        it('should extract from activityTextArea key', () => {
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="questions"/>
                    <list>
                        <instance class="CasestudyActivityField">
                            <dictionary>
                                <string role="key" value="activityTextArea"/>
                                <instance class="TextAreaField">
                                    <dictionary>
                                        <string role="key" value="content"/>
                                        <unicode value="Activity content"/>
                                    </dictionary>
                                </instance>
                            </dictionary>
                        </instance>
                    </list>
                </dictionary>
            `);
            const props = handler.extractProperties(dict);
            const activities = props.activities as { activity: string }[];
            expect(activities[0].activity).toBe('Activity content');
        });

        it('should extract from Feedback2Field', () => {
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="questions"/>
                    <list>
                        <instance class="Question">
                            <dictionary>
                                <string role="key" value="questionTextArea"/>
                                <instance class="TextAreaField">
                                    <dictionary>
                                        <string role="key" value="content"/>
                                        <unicode value="Q"/>
                                    </dictionary>
                                </instance>
                                <instance class="Feedback2Field">
                                    <dictionary>
                                        <string role="key" value="content"/>
                                        <unicode value="Feedback2 content"/>
                                        <string role="key" value="buttonCaption"/>
                                        <string value="See"/>
                                    </dictionary>
                                </instance>
                            </dictionary>
                        </instance>
                    </list>
                </dictionary>
            `);
            const props = handler.extractProperties(dict);
            const activities = props.activities as { feedback: string; buttonCaption: string }[];
            expect(activities[0].feedback).toBe('Feedback2 content');
            expect(activities[0].buttonCaption).toBe('See');
        });

        it('should find activities from _activities key', () => {
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="_activities"/>
                    <list>
                        <instance class="Question">
                            <dictionary>
                                <string role="key" value="questionTextArea"/>
                                <instance class="TextAreaField">
                                    <dictionary>
                                        <string role="key" value="content"/>
                                        <unicode value="Alt activity"/>
                                    </dictionary>
                                </instance>
                            </dictionary>
                        </instance>
                    </list>
                </dictionary>
            `);
            const props = handler.extractProperties(dict);
            const activities = props.activities as { activity: string }[];
            expect(activities.length).toBe(1);
            expect(activities[0].activity).toBe('Alt activity');
        });
    });
});

describe('GalleryHandler', () => {
    let handler: GalleryHandler;

    beforeEach(() => {
        handler = new GalleryHandler();
    });

    describe('canHandle', () => {
        it('should handle ImageGalleryIdevice', () => {
            expect(handler.canHandle('ImageGalleryIdevice')).toBe(true);
        });

        it('should handle GalleryIdevice', () => {
            expect(handler.canHandle('GalleryIdevice')).toBe(true);
        });

        it('should not handle ImageMagnifierIdevice', () => {
            expect(handler.canHandle('ImageMagnifierIdevice')).toBe(false);
        });
    });

    describe('getTargetType', () => {
        it('should return image-gallery', () => {
            expect(handler.getTargetType()).toBe('image-gallery');
        });
    });

    describe('extractHtmlView', () => {
        it('should return empty for null dict', () => {
            expect(handler.extractHtmlView(null as unknown as Element)).toBe('');
        });

        it('should extract descriptionTextArea', () => {
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="descriptionTextArea"/>
                    <instance class="TextAreaField">
                        <dictionary>
                            <string role="key" value="content"/>
                            <unicode value="Gallery description"/>
                        </dictionary>
                    </instance>
                </dictionary>
            `);
            expect(handler.extractHtmlView(dict)).toBe('Gallery description');
        });

        it('should return empty when no description', () => {
            const dict = createDomElement(`<dictionary/>`);
            expect(handler.extractHtmlView(dict)).toBe('');
        });
    });

    describe('extractFeedback', () => {
        it('should return empty feedback', () => {
            const dict = createDomElement(`<dictionary/>`);
            const result = handler.extractFeedback(dict);
            expect(result.content).toBe('');
            expect(result.buttonCaption).toBe('');
        });
    });

    describe('extractProperties', () => {
        it('should return empty when no images', () => {
            const dict = createDomElement(`<dictionary/>`);
            expect(handler.extractProperties(dict)).toEqual({});
        });

        it('should extract images from GalleryImages wrapper', () => {
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="images"/>
                    <instance class="GalleryImages">
                        <dictionary>
                            <string role="key" value=".listitems"/>
                            <list>
                                <instance class="GalleryImage">
                                    <dictionary>
                                        <string role="key" value="_imageResource"/>
                                        <instance class="Resource">
                                            <dictionary>
                                                <string role="key" value="_storageName"/>
                                                <string value="image1.jpg"/>
                                            </dictionary>
                                        </instance>
                                        <string role="key" value="_caption"/>
                                        <instance class="TextField">
                                            <dictionary>
                                                <string role="key" value="content"/>
                                                <unicode value="Image 1"/>
                                            </dictionary>
                                        </instance>
                                    </dictionary>
                                </instance>
                            </list>
                        </dictionary>
                    </instance>
                </dictionary>
            `);
            const props = handler.extractProperties(dict);
            expect(props.img_0).toBeDefined();
            expect((props.img_0 as { img: string }).img).toBe('resources/image1.jpg');
            expect((props.img_0 as { title: string }).title).toBe('Image 1');
        });

        it('should extract images from direct GalleryImage list', () => {
            const dict = createDomElement(`
                <dictionary>
                    <list>
                        <instance class="GalleryImage">
                            <dictionary>
                                <string role="key" value="imageResource"/>
                                <instance class="Resource">
                                    <dictionary>
                                        <string role="key" value="_storageName"/>
                                        <string value="photo.png"/>
                                    </dictionary>
                                </instance>
                                <string role="key" value="caption"/>
                                <string value="Photo caption"/>
                            </dictionary>
                        </instance>
                    </list>
                </dictionary>
            `);
            const props = handler.extractProperties(dict);
            expect(props.img_0).toBeDefined();
            expect((props.img_0 as { img: string }).img).toBe('resources/photo.png');
            expect((props.img_0 as { title: string }).title).toBe('Photo caption');
        });

        it('should extract thumbnail if present', () => {
            const dict = createDomElement(`
                <dictionary>
                    <list>
                        <instance class="GalleryImage">
                            <dictionary>
                                <string role="key" value="_imageResource"/>
                                <instance class="Resource">
                                    <dictionary>
                                        <string role="key" value="_storageName"/>
                                        <string value="image.jpg"/>
                                    </dictionary>
                                </instance>
                                <string role="key" value="_thumbnailResource"/>
                                <instance class="Resource">
                                    <dictionary>
                                        <string role="key" value="_storageName"/>
                                        <string value="thumb.jpg"/>
                                    </dictionary>
                                </instance>
                            </dictionary>
                        </instance>
                    </list>
                </dictionary>
            `);
            const props = handler.extractProperties(dict);
            expect((props.img_0 as { thumbnail: string }).thumbnail).toBe('resources/thumb.jpg');
        });

        it('should handle multiple images with indexed keys', () => {
            const dict = createDomElement(`
                <dictionary>
                    <list>
                        <instance class="GalleryImage">
                            <dictionary>
                                <string role="key" value="_imageResource"/>
                                <instance class="Resource">
                                    <dictionary>
                                        <string role="key" value="_storageName"/>
                                        <string value="img1.jpg"/>
                                    </dictionary>
                                </instance>
                            </dictionary>
                        </instance>
                        <instance class="GalleryImage">
                            <dictionary>
                                <string role="key" value="_imageResource"/>
                                <instance class="Resource">
                                    <dictionary>
                                        <string role="key" value="_storageName"/>
                                        <string value="img2.jpg"/>
                                    </dictionary>
                                </instance>
                            </dictionary>
                        </instance>
                    </list>
                </dictionary>
            `);
            const props = handler.extractProperties(dict);
            expect(props.img_0).toBeDefined();
            expect(props.img_1).toBeDefined();
            expect((props.img_0 as { img: string }).img).toBe('resources/img1.jpg');
            expect((props.img_1 as { img: string }).img).toBe('resources/img2.jpg');
        });
    });
});

describe('ExternalUrlHandler', () => {
    let handler: ExternalUrlHandler;

    beforeEach(() => {
        handler = new ExternalUrlHandler();
    });

    describe('canHandle', () => {
        it('should handle ExternalUrlIdevice', () => {
            expect(handler.canHandle('ExternalUrlIdevice')).toBe(true);
        });

        it('should not handle FreeTextIdevice', () => {
            expect(handler.canHandle('FreeTextIdevice')).toBe(false);
        });
    });

    describe('getTargetType', () => {
        it('should return external-website', () => {
            expect(handler.getTargetType()).toBe('external-website');
        });
    });

    describe('extractHtmlView', () => {
        it('should return empty for null dict', () => {
            expect(handler.extractHtmlView(null as unknown as Element)).toBe('');
        });

        it('should return empty when no URL', () => {
            const dict = createDomElement(`<dictionary/>`);
            expect(handler.extractHtmlView(dict)).toBe('');
        });

        it('should generate iframe with URL from string value', () => {
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="url"/>
                    <string value="https://example.com"/>
                </dictionary>
            `);
            const result = handler.extractHtmlView(dict);
            expect(result).toContain('iframe');
            expect(result).toContain('https://example.com');
            expect(result).toContain('size="2"'); // default medium
        });

        it('should use height to determine size (small)', () => {
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="url"/>
                    <string value="https://example.com"/>
                    <string role="key" value="height"/>
                    <string value="150"/>
                </dictionary>
            `);
            const result = handler.extractHtmlView(dict);
            expect(result).toContain('size="1"');
            expect(result).toContain('height="150"');
        });

        it('should use height to determine size (large)', () => {
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="url"/>
                    <string value="https://example.com"/>
                    <string role="key" value="height"/>
                    <string value="400"/>
                </dictionary>
            `);
            const result = handler.extractHtmlView(dict);
            expect(result).toContain('size="3"');
        });

        it('should use height to determine size (super-size)', () => {
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="url"/>
                    <string value="https://example.com"/>
                    <string role="key" value="height"/>
                    <string value="600"/>
                </dictionary>
            `);
            const result = handler.extractHtmlView(dict);
            expect(result).toContain('size="4"');
        });

        it('should extract URL from _url field', () => {
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="_url"/>
                    <string value="https://test.com"/>
                </dictionary>
            `);
            const result = handler.extractHtmlView(dict);
            expect(result).toContain('https://test.com');
        });

        it('should extract URL from TextField instance', () => {
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="urlField"/>
                    <instance class="TextField">
                        <dictionary>
                            <string role="key" value="content"/>
                            <string value="https://field.com"/>
                        </dictionary>
                    </instance>
                </dictionary>
            `);
            const result = handler.extractHtmlView(dict);
            expect(result).toContain('https://field.com');
        });
    });

    describe('extractFeedback', () => {
        it('should return empty feedback', () => {
            const dict = createDomElement(`<dictionary/>`);
            const result = handler.extractFeedback(dict);
            expect(result.content).toBe('');
            expect(result.buttonCaption).toBe('');
        });
    });

    describe('extractProperties', () => {
        it('should return empty for null dict', () => {
            expect(handler.extractProperties(null as unknown as Element)).toEqual({});
        });

        it('should extract URL property', () => {
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="url"/>
                    <string value="https://example.com"/>
                </dictionary>
            `);
            const props = handler.extractProperties(dict);
            expect(props.url).toBe('https://example.com');
        });

        it('should extract height property', () => {
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="url"/>
                    <string value="https://example.com"/>
                    <string role="key" value="height"/>
                    <string value="500"/>
                </dictionary>
            `);
            const props = handler.extractProperties(dict);
            expect(props.height).toBe('500');
        });

        it('should extract _height property', () => {
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="url"/>
                    <string value="https://example.com"/>
                    <string role="key" value="_height"/>
                    <string value="400"/>
                </dictionary>
            `);
            const props = handler.extractProperties(dict);
            expect(props.height).toBe('400');
        });
    });
});

describe('FileAttachHandler', () => {
    let handler: FileAttachHandler;

    beforeEach(() => {
        handler = new FileAttachHandler();
    });

    describe('canHandle', () => {
        it('should handle FileAttachIdevice', () => {
            expect(handler.canHandle('FileAttachIdevice')).toBe(true);
        });

        it('should handle FileAttachIdeviceInc', () => {
            expect(handler.canHandle('FileAttachIdeviceInc')).toBe(true);
        });

        it('should handle AttachmentIdevice', () => {
            expect(handler.canHandle('AttachmentIdevice')).toBe(true);
        });

        it('should not handle FreeTextIdevice', () => {
            expect(handler.canHandle('FreeTextIdevice')).toBe(false);
        });
    });

    describe('getTargetType', () => {
        it('should return text', () => {
            expect(handler.getTargetType()).toBe('text');
        });
    });

    describe('extractHtmlView', () => {
        it('should return empty for null dict', () => {
            expect(handler.extractHtmlView(null as unknown as Element)).toBe('');
        });

        it('should extract introHTML content', () => {
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="introHTML"/>
                    <instance class="TextAreaField">
                        <dictionary>
                            <string role="key" value="content_w_resourcePaths"/>
                            <unicode value="These are the instructions"/>
                        </dictionary>
                    </instance>
                </dictionary>
            `);
            expect(handler.extractHtmlView(dict)).toContain('These are the instructions');
        });

        it('should generate file links from fileAttachmentFields', () => {
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="fileAttachmentFields"/>
                    <list>
                        <instance class="FileField">
                            <dictionary>
                                <string role="key" value="fileResource"/>
                                <instance class="Resource">
                                    <dictionary>
                                        <string role="key" value="_storageName"/>
                                        <string value="document.pdf"/>
                                    </dictionary>
                                </instance>
                                <string role="key" value="fileDescription"/>
                                <instance class="TextField">
                                    <dictionary>
                                        <string role="key" value="content"/>
                                        <string value="Important Document"/>
                                    </dictionary>
                                </instance>
                            </dictionary>
                        </instance>
                    </list>
                </dictionary>
            `);
            const result = handler.extractHtmlView(dict);
            expect(result).toContain('resources/document.pdf');
            expect(result).toContain('Important Document');
            expect(result).toContain('target="_blank"');
            expect(result).toContain('download="document.pdf"');
        });

        it('should combine intro and file links', () => {
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="introHTML"/>
                    <instance class="TextAreaField">
                        <dictionary>
                            <string role="key" value="content"/>
                            <unicode value="Intro text"/>
                        </dictionary>
                    </instance>
                    <string role="key" value="fileAttachmentFields"/>
                    <list>
                        <instance class="FileField">
                            <dictionary>
                                <string role="key" value="fileResource"/>
                                <instance class="Resource">
                                    <dictionary>
                                        <string role="key" value="_storageName"/>
                                        <string value="file.txt"/>
                                    </dictionary>
                                </instance>
                            </dictionary>
                        </instance>
                    </list>
                </dictionary>
            `);
            const result = handler.extractHtmlView(dict);
            expect(result).toContain('Intro text');
            expect(result).toContain('file.txt');
        });

        it('should use filename as link text when no description', () => {
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="fileAttachmentFields"/>
                    <list>
                        <instance class="FileField">
                            <dictionary>
                                <string role="key" value="fileResource"/>
                                <instance class="Resource">
                                    <dictionary>
                                        <string role="key" value="_storageName"/>
                                        <string value="data.csv"/>
                                    </dictionary>
                                </instance>
                            </dictionary>
                        </instance>
                    </list>
                </dictionary>
            `);
            const result = handler.extractHtmlView(dict);
            expect(result).toContain('>data.csv</a>');
        });

        it('should find files from direct FileField list', () => {
            const dict = createDomElement(`
                <dictionary>
                    <list>
                        <instance class="FileField">
                            <dictionary>
                                <string role="key" value="_storageName"/>
                                <string value="direct.zip"/>
                            </dictionary>
                        </instance>
                    </list>
                </dictionary>
            `);
            const result = handler.extractHtmlView(dict);
            expect(result).toContain('resources/direct.zip');
        });

        it('should extract single file resource', () => {
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="fileResource"/>
                    <instance class="Resource">
                        <dictionary>
                            <string role="key" value="_storageName"/>
                            <string value="single.doc"/>
                        </dictionary>
                    </instance>
                </dictionary>
            `);
            const result = handler.extractHtmlView(dict);
            expect(result).toContain('resources/single.doc');
        });
    });

    describe('extractFeedback', () => {
        it('should return empty feedback', () => {
            const dict = createDomElement(`<dictionary/>`);
            const result = handler.extractFeedback(dict);
            expect(result.content).toBe('');
            expect(result.buttonCaption).toBe('');
        });
    });

    describe('extractProperties', () => {
        it('should return empty when no content', () => {
            const dict = createDomElement(`<dictionary/>`);
            expect(handler.extractProperties(dict)).toEqual({});
        });

        it('should set textTextarea property', () => {
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="introHTML"/>
                    <instance class="TextAreaField">
                        <dictionary>
                            <string role="key" value="content"/>
                            <unicode value="Content"/>
                        </dictionary>
                    </instance>
                </dictionary>
            `);
            const props = handler.extractProperties(dict);
            expect(props.textTextarea).toBe('Content');
        });
    });
});

describe('ImageMagnifierHandler', () => {
    let handler: ImageMagnifierHandler;

    beforeEach(() => {
        handler = new ImageMagnifierHandler();
    });

    describe('canHandle', () => {
        it('should handle ImageMagnifierIdevice', () => {
            expect(handler.canHandle('ImageMagnifierIdevice')).toBe(true);
        });

        it('should not handle ImageGalleryIdevice', () => {
            expect(handler.canHandle('ImageGalleryIdevice')).toBe(false);
        });
    });

    describe('getTargetType', () => {
        it('should return magnifier', () => {
            expect(handler.getTargetType()).toBe('magnifier');
        });
    });

    describe('extractHtmlView', () => {
        it('should return empty for null dict', () => {
            expect(handler.extractHtmlView(null as unknown as Element)).toBe('');
        });

        it('should extract from captionTextArea', () => {
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="captionTextArea"/>
                    <instance class="TextAreaField">
                        <dictionary>
                            <string role="key" value="content"/>
                            <unicode value="Image caption"/>
                        </dictionary>
                    </instance>
                </dictionary>
            `);
            expect(handler.extractHtmlView(dict)).toBe('Image caption');
        });

        it('should extract from descriptionTextArea', () => {
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="descriptionTextArea"/>
                    <instance class="TextAreaField">
                        <dictionary>
                            <string role="key" value="content"/>
                            <unicode value="Description"/>
                        </dictionary>
                    </instance>
                </dictionary>
            `);
            expect(handler.extractHtmlView(dict)).toBe('Description');
        });

        it('should extract from direct caption string', () => {
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="caption"/>
                    <string value="Simple caption"/>
                </dictionary>
            `);
            expect(handler.extractHtmlView(dict)).toBe('<p>Simple caption</p>');
        });

        it('should return empty when no caption', () => {
            const dict = createDomElement(`<dictionary/>`);
            expect(handler.extractHtmlView(dict)).toBe('');
        });
    });

    describe('extractFeedback', () => {
        it('should return empty feedback', () => {
            const dict = createDomElement(`<dictionary/>`);
            const result = handler.extractFeedback(dict);
            expect(result.content).toBe('');
            expect(result.buttonCaption).toBe('');
        });
    });

    describe('extractProperties', () => {
        it('should return defaults for null dict', () => {
            const props = handler.extractProperties(null as unknown as Element);
            expect(props.isDefaultImage).toBe('1');
            expect(props.glassSize).toBe('2');
            expect(props.initialZSize).toBe('100');
        });

        it('should extract textTextarea from text field', () => {
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="text"/>
                    <instance class="TextAreaField">
                        <dictionary>
                            <string role="key" value="content"/>
                            <unicode value="Instructions"/>
                        </dictionary>
                    </instance>
                </dictionary>
            `);
            const props = handler.extractProperties(dict);
            expect(props.textTextarea).toBe('Instructions');
        });

        it('should extract align from float field', () => {
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="float"/>
                    <string value="right"/>
                </dictionary>
            `);
            const props = handler.extractProperties(dict);
            expect(props.align).toBe('right');
        });

        it('should extract from MagnifierField instance', () => {
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="imageMagnifier"/>
                    <instance class="MagnifierField">
                        <dictionary>
                            <string role="key" value="glassSize"/>
                            <string value="4"/>
                            <string role="key" value="initialZSize"/>
                            <string value="150"/>
                            <string role="key" value="maxZSize"/>
                            <string value="200"/>
                            <string role="key" value="width"/>
                            <string value="400"/>
                            <string role="key" value="height"/>
                            <string value="300"/>
                        </dictionary>
                    </instance>
                </dictionary>
            `);
            const props = handler.extractProperties(dict);
            expect(props.glassSize).toBe('4');
            expect(props.initialZSize).toBe('150');
            expect(props.maxZSize).toBe('200');
            expect(props.width).toBe('400');
            expect(props.height).toBe('300');
        });

        it('should extract imageResource from MagnifierField', () => {
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="imageMagnifier"/>
                    <instance class="MagnifierField">
                        <dictionary>
                            <string role="key" value="imageResource"/>
                            <instance class="Resource">
                                <dictionary>
                                    <string role="key" value="_storageName"/>
                                    <string value="magnify.jpg"/>
                                </dictionary>
                            </instance>
                        </dictionary>
                    </instance>
                </dictionary>
            `);
            const props = handler.extractProperties(dict);
            expect(props.imageResource).toBe('resources/magnify.jpg');
            expect(props.isDefaultImage).toBe('0'); // Custom image
        });

        it('should extract from MagnifierField by class', () => {
            const dict = createDomElement(`
                <dictionary>
                    <instance class="exe.engine.field.MagnifierField">
                        <dictionary>
                            <string role="key" value="glassSize"/>
                            <string value="3"/>
                        </dictionary>
                    </instance>
                </dictionary>
            `);
            const props = handler.extractProperties(dict);
            expect(props.glassSize).toBe('3');
        });

        it('should extract direct image resource', () => {
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="_imageResource"/>
                    <instance class="Resource">
                        <dictionary>
                            <string role="key" value="_storageName"/>
                            <string value="direct.png"/>
                        </dictionary>
                    </instance>
                </dictionary>
            `);
            const props = handler.extractProperties(dict);
            expect(props.imageResource).toBe('resources/direct.png');
            expect(props.isDefaultImage).toBe('0');
        });
    });
});

describe('GeogebraHandler', () => {
    let handler: GeogebraHandler;

    beforeEach(() => {
        handler = new GeogebraHandler();
    });

    describe('canHandle', () => {
        it('should handle GeogebraIdevice', () => {
            expect(handler.canHandle('GeogebraIdevice')).toBe(true);
        });

        it('should handle JsIdevice with geogebra-activity type', () => {
            expect(handler.canHandle('JsIdevice', 'geogebra-activity')).toBe(true);
        });

        it('should not handle FreeTextIdevice', () => {
            expect(handler.canHandle('FreeTextIdevice')).toBe(false);
        });

        it('should not handle JsIdevice with other type', () => {
            expect(handler.canHandle('JsIdevice', 'other-type')).toBe(false);
        });
    });

    describe('getTargetType', () => {
        it('should return geogebra-activity', () => {
            expect(handler.getTargetType()).toBe('geogebra-activity');
        });
    });

    describe('extractHtmlView', () => {
        it('should return empty for null dict', () => {
            expect(handler.extractHtmlView(null as unknown as Element)).toBe('');
        });

        it('should extract from fields list', () => {
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="fields"/>
                    <list>
                        <instance class="TextAreaField">
                            <dictionary>
                                <string role="key" value="content"/>
                                <unicode value="GeoGebra applet HTML"/>
                            </dictionary>
                        </instance>
                    </list>
                </dictionary>
            `);
            expect(handler.extractHtmlView(dict)).toBe('GeoGebra applet HTML');
        });

        it('should fallback to direct TextAreaField', () => {
            const dict = createDomElement(`
                <dictionary>
                    <instance class="TextAreaField">
                        <dictionary>
                            <string role="key" value="content"/>
                            <unicode value="Direct GeoGebra content"/>
                        </dictionary>
                    </instance>
                </dictionary>
            `);
            expect(handler.extractHtmlView(dict)).toBe('Direct GeoGebra content');
        });

        it('should return empty when no content', () => {
            const dict = createDomElement(`<dictionary/>`);
            expect(handler.extractHtmlView(dict)).toBe('');
        });
    });

    describe('extractFeedback', () => {
        it('should return empty feedback', () => {
            const dict = createDomElement(`<dictionary/>`);
            const result = handler.extractFeedback(dict);
            expect(result.content).toBe('');
            expect(result.buttonCaption).toBe('');
        });
    });

    describe('extractProperties', () => {
        it('should return empty object', () => {
            const dict = createDomElement(`<dictionary/>`);
            expect(handler.extractProperties(dict)).toEqual({});
        });
    });
});

describe('InteractiveVideoHandler', () => {
    let handler: InteractiveVideoHandler;

    beforeEach(() => {
        handler = new InteractiveVideoHandler();
    });

    describe('canHandle', () => {
        it('should handle JsIdevice with interactive-video type', () => {
            expect(handler.canHandle('JsIdevice', 'interactive-video')).toBe(true);
        });

        it('should handle class name containing interactive-video', () => {
            expect(handler.canHandle('interactive-video-idevice')).toBe(true);
        });

        it('should not handle JsIdevice with flipcards type', () => {
            expect(handler.canHandle('JsIdevice', 'flipcards')).toBe(false);
        });

        it('should not handle empty className without ideviceType', () => {
            expect(handler.canHandle('JsIdevice')).toBe(false);
        });
    });

    describe('getTargetType', () => {
        it('should return interactive-video', () => {
            expect(handler.getTargetType()).toBe('interactive-video');
        });
    });

    describe('extractHtmlView', () => {
        it('should return empty for null dict', () => {
            expect(handler.extractHtmlView(null as unknown as Element)).toBe('');
        });

        it('should return raw HTML when no exe-interactive-video class', () => {
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="fields"/>
                    <list>
                        <instance class="TextAreaField">
                            <dictionary>
                                <string role="key" value="content"/>
                                <unicode value="Plain content"/>
                            </dictionary>
                        </instance>
                    </list>
                </dictionary>
            `);
            expect(handler.extractHtmlView(dict)).toBe('Plain content');
        });

        it('should transform var InteractiveVideo script to JSON format', () => {
            const legacyScript = `<div class="exe-interactive-video"><script>var InteractiveVideo = {"slides":[],"title":"Test"}</script></div>`;
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="fields"/>
                    <list>
                        <instance class="TextAreaField">
                            <dictionary>
                                <string role="key" value="content"/>
                                <unicode value="${legacyScript.replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}"/>
                            </dictionary>
                        </instance>
                    </list>
                </dictionary>
            `);
            const result = handler.extractHtmlView(dict);
            expect(result).toContain('exe-interactive-video-contents');
            expect(result).toContain('application/json');
        });

        it('should return empty when no fields', () => {
            const dict = createDomElement(`<dictionary/>`);
            expect(handler.extractHtmlView(dict)).toBe('');
        });
    });

    describe('extractFeedback', () => {
        it('should return empty feedback', () => {
            const dict = createDomElement(`<dictionary/>`);
            const result = handler.extractFeedback(dict);
            expect(result.content).toBe('');
            expect(result.buttonCaption).toBe('');
        });
    });

    describe('extractProperties', () => {
        it('should return empty for null dict', () => {
            expect(handler.extractProperties(null as unknown as Element)).toEqual({});
        });

        it('should return empty when no valid HTML', () => {
            const dict = createDomElement(`<dictionary/>`);
            expect(handler.extractProperties(dict)).toEqual({});
        });

        it('should extract properties from transformed JSON script', () => {
            const config = { slides: [{ id: 1 }], title: 'My Video', description: 'Desc' };
            const legacyScript = `<div class="exe-interactive-video"><script>var InteractiveVideo = ${JSON.stringify(config)}</script></div>`;
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="fields"/>
                    <list>
                        <instance class="TextAreaField">
                            <dictionary>
                                <string role="key" value="content"/>
                                <unicode value="${legacyScript.replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}"/>
                            </dictionary>
                        </instance>
                    </list>
                </dictionary>
            `);
            const props = handler.extractProperties(dict, 'test-id');
            expect(props.title).toBe('My Video');
            expect(props.description).toBe('Desc');
            expect(props.slides).toEqual([{ id: 1 }]);
        });

        it('should include default values for missing properties', () => {
            const config = { slides: [] };
            const legacyScript = `<div class="exe-interactive-video"><script>var InteractiveVideo = ${JSON.stringify(config)}</script></div>`;
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="fields"/>
                    <list>
                        <instance class="TextAreaField">
                            <dictionary>
                                <string role="key" value="content"/>
                                <unicode value="${legacyScript.replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}"/>
                            </dictionary>
                        </instance>
                    </list>
                </dictionary>
            `);
            const props = handler.extractProperties(dict);
            expect(props.coverType).toBe('text');
            expect(props.evaluation).toBe(false);
        });

        it('should fallback to extractLegacyProperties when transform fails', () => {
            // Legacy format with no proper script tags - transform fails but legacy regex should work
            const legacyHtml = `&lt;div class=&quot;exe-interactive-video&quot;&gt;var InteractiveVideo = {&quot;slides&quot;:[],&quot;title&quot;:&quot;Legacy&quot;};//&lt;/div&gt;`;
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="fields"/>
                    <list>
                        <instance class="TextAreaField">
                            <dictionary>
                                <string role="key" value="content"/>
                                <unicode value="${legacyHtml}"/>
                            </dictionary>
                        </instance>
                    </list>
                </dictionary>
            `);
            const props = handler.extractProperties(dict);
            expect(props.title).toBe('Legacy');
            expect(props.slides).toEqual([]);
        });

        it('should return empty when extractLegacyProperties fails to parse', () => {
            // Completely invalid content - no var InteractiveVideo pattern
            const invalidHtml = `&lt;div class=&quot;exe-interactive-video&quot;&gt;just some random content&lt;/div&gt;`;
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="fields"/>
                    <list>
                        <instance class="TextAreaField">
                            <dictionary>
                                <string role="key" value="content"/>
                                <unicode value="${invalidHtml}"/>
                            </dictionary>
                        </instance>
                    </list>
                </dictionary>
            `);
            const props = handler.extractProperties(dict);
            expect(props).toEqual({});
        });

        it('should return empty when extractLegacyProperties has invalid JSON', () => {
            // Has var InteractiveVideo but invalid JSON
            const invalidJson = `&lt;div class=&quot;exe-interactive-video&quot;&gt;var InteractiveVideo = {invalid json here};//&lt;/div&gt;`;
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="fields"/>
                    <list>
                        <instance class="TextAreaField">
                            <dictionary>
                                <string role="key" value="content"/>
                                <unicode value="${invalidJson}"/>
                            </dictionary>
                        </instance>
                    </list>
                </dictionary>
            `);
            const props = handler.extractProperties(dict);
            expect(props).toEqual({});
        });
    });

    describe('transformInteractiveVideoScript edge cases', () => {
        it('should return decoded HTML when no var InteractiveVideo pattern found', () => {
            // Has exe-interactive-video class but no var InteractiveVideo
            const htmlNoVar = `&lt;div class=&quot;exe-interactive-video&quot;&gt;&lt;script&gt;var OtherVariable = {}&lt;/script&gt;&lt;/div&gt;`;
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="fields"/>
                    <list>
                        <instance class="TextAreaField">
                            <dictionary>
                                <string role="key" value="content"/>
                                <unicode value="${htmlNoVar}"/>
                            </dictionary>
                        </instance>
                    </list>
                </dictionary>
            `);
            const result = handler.extractHtmlView(dict);
            expect(result).toContain('exe-interactive-video');
            expect(result).toContain('OtherVariable');
            expect(result).not.toContain('exe-interactive-video-contents');
        });

        it('should return decoded HTML when JSON is unbalanced (missing closing brace)', () => {
            // Has var InteractiveVideo but unbalanced braces
            const unbalanced = `&lt;div class=&quot;exe-interactive-video&quot;&gt;&lt;script&gt;var InteractiveVideo = {&quot;slides&quot;:[]&lt;/script&gt;&lt;/div&gt;`;
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="fields"/>
                    <list>
                        <instance class="TextAreaField">
                            <dictionary>
                                <string role="key" value="content"/>
                                <unicode value="${unbalanced}"/>
                            </dictionary>
                        </instance>
                    </list>
                </dictionary>
            `);
            const result = handler.extractHtmlView(dict);
            expect(result).toContain('exe-interactive-video');
            expect(result).not.toContain('exe-interactive-video-contents');
        });

        it('should handle JSON with trailing commas', () => {
            // JSON with trailing comma before closing brace
            const withTrailingComma = `&lt;div class=&quot;exe-interactive-video&quot;&gt;&lt;script&gt;var InteractiveVideo = {&quot;slides&quot;:[],&quot;title&quot;:&quot;Test&quot;,}&lt;/script&gt;&lt;/div&gt;`;
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="fields"/>
                    <list>
                        <instance class="TextAreaField">
                            <dictionary>
                                <string role="key" value="content"/>
                                <unicode value="${withTrailingComma}"/>
                            </dictionary>
                        </instance>
                    </list>
                </dictionary>
            `);
            const result = handler.extractHtmlView(dict);
            expect(result).toContain('exe-interactive-video-contents');
            expect(result).toContain('application/json');
        });

        it('should handle JSON parse failure and attempt fix with fixJsonQuotes', () => {
            // JSON with unescaped quotes that needs fixing - this triggers the catch block
            // We use a malformed string that will fail first parse but might be fixable
            const badQuotes = `&lt;div class=&quot;exe-interactive-video&quot;&gt;&lt;script&gt;var InteractiveVideo = {&quot;title&quot;:&quot;Test with &quot;quotes&quot; inside&quot;}&lt;/script&gt;&lt;/div&gt;`;
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="fields"/>
                    <list>
                        <instance class="TextAreaField">
                            <dictionary>
                                <string role="key" value="content"/>
                                <unicode value="${badQuotes}"/>
                            </dictionary>
                        </instance>
                    </list>
                </dictionary>
            `);
            // This should not throw, even if parsing fails
            const result = handler.extractHtmlView(dict);
            expect(result).toContain('exe-interactive-video');
        });

        it('should return decoded HTML when script tags are not properly formed', () => {
            // Has var InteractiveVideo and valid JSON, but malformed script tags
            const noScriptEnd = `&lt;div class=&quot;exe-interactive-video&quot;&gt;&lt;script&gt;var InteractiveVideo = {&quot;slides&quot;:[]}&lt;/div&gt;`;
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="fields"/>
                    <list>
                        <instance class="TextAreaField">
                            <dictionary>
                                <string role="key" value="content"/>
                                <unicode value="${noScriptEnd}"/>
                            </dictionary>
                        </instance>
                    </list>
                </dictionary>
            `);
            const result = handler.extractHtmlView(dict);
            // Without </script>, it should return decoded but not transformed
            expect(result).toContain('exe-interactive-video');
        });

        it('should handle numeric HTML entities for newlines', () => {
            // Content with &#10; (newline) entities
            const withNewlines = `&lt;div class=&quot;exe-interactive-video&quot;&gt;&lt;script&gt;&#10;var InteractiveVideo = {&quot;slides&quot;:[]}&#10;&lt;/script&gt;&lt;/div&gt;`;
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="fields"/>
                    <list>
                        <instance class="TextAreaField">
                            <dictionary>
                                <string role="key" value="content"/>
                                <unicode value="${withNewlines}"/>
                            </dictionary>
                        </instance>
                    </list>
                </dictionary>
            `);
            const result = handler.extractHtmlView(dict);
            expect(result).toContain('exe-interactive-video-contents');
        });

        it('should handle JavaScript comments in JSON', () => {
            // JSON with JavaScript single-line comments (regex requires whitespace or start of line before //)
            const withComments = `&lt;div class=&quot;exe-interactive-video&quot;&gt;&lt;script&gt;var InteractiveVideo = { // comment&#10;&quot;slides&quot;:[] // another&#10;}&lt;/script&gt;&lt;/div&gt;`;
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="fields"/>
                    <list>
                        <instance class="TextAreaField">
                            <dictionary>
                                <string role="key" value="content"/>
                                <unicode value="${withComments}"/>
                            </dictionary>
                        </instance>
                    </list>
                </dictionary>
            `);
            const result = handler.extractHtmlView(dict);
            expect(result).toContain('exe-interactive-video-contents');
        });
    });

    describe('extractFieldsHtml edge cases', () => {
        it('should handle multiple TextAreaFields and join them', () => {
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="fields"/>
                    <list>
                        <instance class="TextAreaField">
                            <dictionary>
                                <string role="key" value="content"/>
                                <unicode value="First content"/>
                            </dictionary>
                        </instance>
                        <instance class="TextAreaField">
                            <dictionary>
                                <string role="key" value="content"/>
                                <unicode value="Second content"/>
                            </dictionary>
                        </instance>
                    </list>
                </dictionary>
            `);
            const result = handler.extractHtmlView(dict);
            expect(result).toContain('First content');
            expect(result).toContain('Second content');
        });

        it('should skip non-TextAreaField instances', () => {
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="fields"/>
                    <list>
                        <instance class="OtherFieldType">
                            <dictionary>
                                <string role="key" value="content"/>
                                <unicode value="Should be skipped"/>
                            </dictionary>
                        </instance>
                        <instance class="TextAreaField">
                            <dictionary>
                                <string role="key" value="content"/>
                                <unicode value="Valid content"/>
                            </dictionary>
                        </instance>
                    </list>
                </dictionary>
            `);
            const result = handler.extractHtmlView(dict);
            expect(result).not.toContain('Should be skipped');
            expect(result).toContain('Valid content');
        });

        it('should handle TextField class as well', () => {
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="fields"/>
                    <list>
                        <instance class="TextField">
                            <dictionary>
                                <string role="key" value="content"/>
                                <unicode value="TextField content"/>
                            </dictionary>
                        </instance>
                    </list>
                </dictionary>
            `);
            const result = handler.extractHtmlView(dict);
            expect(result).toContain('TextField content');
        });
    });
});

describe('GameHandler', () => {
    let handler: GameHandler;

    beforeEach(() => {
        handler = new GameHandler();
    });

    describe('canHandle', () => {
        it('should handle JsIdevice with flipcards type', () => {
            expect(handler.canHandle('JsIdevice', 'flipcards-activity')).toBe(true);
        });

        it('should handle JsIdevice with selecciona type', () => {
            expect(handler.canHandle('JsIdevice', 'selecciona-activity')).toBe(true);
        });

        it('should handle JsIdevice with trivial type', () => {
            expect(handler.canHandle('JsIdevice', 'trivial-activity')).toBe(true);
        });

        it('should handle JsIdevice with crossword type', () => {
            expect(handler.canHandle('JsIdevice', 'crossword-activity')).toBe(true);
        });

        it('should handle class name containing flipcards', () => {
            expect(handler.canHandle('FlipcardsIdevice')).toBe(true);
        });

        it('should not handle JsIdevice with interactive-video type', () => {
            expect(handler.canHandle('JsIdevice', 'interactive-video')).toBe(false);
        });

        it('should handle Spanish game types', () => {
            expect(handler.canHandle('JsIdevice', 'sopa-activity')).toBe(true);
            expect(handler.canHandle('JsIdevice', 'crucigrama-activity')).toBe(true);
            expect(handler.canHandle('JsIdevice', 'rosco-activity')).toBe(true);
        });

        it('should handle additional game types', () => {
            expect(handler.canHandle('JsIdevice', 'relate-activity')).toBe(true);
            expect(handler.canHandle('JsIdevice', 'identify-activity')).toBe(true);
            expect(handler.canHandle('JsIdevice', 'discover-activity')).toBe(true);
            expect(handler.canHandle('JsIdevice', 'classify-activity')).toBe(true);
        });
    });

    describe('getTargetType', () => {
        it('should return flipcards for flipcards type', () => {
            handler.canHandle('JsIdevice', 'flipcards-activity');
            expect(handler.getTargetType()).toBe('flipcards');
        });

        it('should map selecciona to quick-questions-multiple-choice', () => {
            handler.canHandle('JsIdevice', 'selecciona-activity');
            expect(handler.getTargetType()).toBe('quick-questions-multiple-choice');
        });

        it('should map sopa to word-search', () => {
            handler.canHandle('JsIdevice', 'sopa-activity');
            expect(handler.getTargetType()).toBe('word-search');
        });

        it('should map crucigrama to crossword', () => {
            handler.canHandle('JsIdevice', 'crucigrama-activity');
            expect(handler.getTargetType()).toBe('crossword');
        });

        it('should map rosco to az-quiz-game', () => {
            handler.canHandle('JsIdevice', 'rosco-activity');
            expect(handler.getTargetType()).toBe('az-quiz-game');
        });

        it('should return text as fallback when no type detected', () => {
            const newHandler = new GameHandler();
            expect(newHandler.getTargetType()).toBe('text');
        });

        it('should map identify to identify', () => {
            handler.canHandle('JsIdevice', 'identify-activity');
            expect(handler.getTargetType()).toBe('identify');
        });

        it('should map candado to padlock', () => {
            handler.canHandle('JsIdevice', 'candado-activity');
            expect(handler.getTargetType()).toBe('padlock');
        });
    });

    describe('extractHtmlView', () => {
        it('should return empty for null dict', () => {
            expect(handler.extractHtmlView(null as unknown as Element)).toBe('');
        });

        it('should extract from fields list', () => {
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="fields"/>
                    <list>
                        <instance class="TextAreaField">
                            <dictionary>
                                <string role="key" value="content"/>
                                <unicode value="&lt;div class=&quot;flipcards-DataGame&quot;&gt;{&quot;typeGame&quot;:&quot;FlipCards&quot;}&lt;/div&gt;"/>
                            </dictionary>
                        </instance>
                    </list>
                </dictionary>
            `);
            const result = handler.extractHtmlView(dict);
            expect(result).toContain('flipcards-DataGame');
        });

        it('should return empty when no fields', () => {
            const dict = createDomElement(`<dictionary/>`);
            expect(handler.extractHtmlView(dict)).toBe('');
        });
    });

    describe('extractFeedback', () => {
        it('should return empty feedback', () => {
            const dict = createDomElement(`<dictionary/>`);
            const result = handler.extractFeedback(dict);
            expect(result.content).toBe('');
            expect(result.buttonCaption).toBe('');
        });
    });

    describe('extractProperties', () => {
        it('should return empty when no game data', () => {
            const dict = createDomElement(`<dictionary/>`);
            expect(handler.extractProperties(dict)).toEqual({});
        });

        it('should extract plain JSON from flipcards DataGame', () => {
            // JSON must be HTML-entity encoded: {"typeGame":"FlipCards","cards":[]}
            const encodedJson = '{&quot;typeGame&quot;:&quot;FlipCards&quot;,&quot;cards&quot;:[]}';
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="fields"/>
                    <list>
                        <instance class="TextAreaField">
                            <dictionary>
                                <string role="key" value="content"/>
                                <unicode value="&lt;div class=&quot;flipcards-DataGame&quot;&gt;${encodedJson}&lt;/div&gt;"/>
                            </dictionary>
                        </instance>
                    </list>
                </dictionary>
            `);
            const props = handler.extractProperties(dict);
            expect(props.typeGame).toBe('FlipCards');
            expect(props.cards).toEqual([]);
        });

        it('should detect game type and set _detectedType', () => {
            // JSON must be HTML-entity encoded: {"typeGame":"Crossword","words":[]}
            const encodedJson = '{&quot;typeGame&quot;:&quot;Crossword&quot;,&quot;words&quot;:[]}';
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="fields"/>
                    <list>
                        <instance class="TextAreaField">
                            <dictionary>
                                <string role="key" value="content"/>
                                <unicode value="&lt;div class=&quot;crossword-DataGame&quot;&gt;${encodedJson}&lt;/div&gt;"/>
                            </dictionary>
                        </instance>
                    </list>
                </dictionary>
            `);
            handler.extractProperties(dict);
            expect(handler.getTargetType()).toBe('crossword');
        });

        it('should handle HTML-encoded content in DataGame div', () => {
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="fields"/>
                    <list>
                        <instance class="TextAreaField">
                            <dictionary>
                                <string role="key" value="content"/>
                                <unicode value="&lt;div class=&quot;flipcards-DataGame&quot;&gt;{&quot;typeGame&quot;:&quot;FlipCards&quot;}&lt;/div&gt;"/>
                            </dictionary>
                        </instance>
                    </list>
                </dictionary>
            `);
            const props = handler.extractProperties(dict);
            expect(props.typeGame).toBe('FlipCards');
        });
    });
});

describe('FpdSolvedExerciseHandler', () => {
    let handler: FpdSolvedExerciseHandler;

    beforeEach(() => {
        handler = new FpdSolvedExerciseHandler();
    });

    describe('canHandle', () => {
        it('should handle SolvedExerciseIdevice', () => {
            expect(handler.canHandle('SolvedExerciseIdevice')).toBe(true);
        });

        it('should handle EjercicioResueltoFpdIdevice', () => {
            expect(handler.canHandle('EjercicioResueltoFpdIdevice')).toBe(true);
        });

        it('should handle ejercicioresueltofpdidevice (lowercase)', () => {
            expect(handler.canHandle('exe.engine.ejercicioresueltofpdidevice.SolvedExercise')).toBe(true);
        });

        it('should not handle FreeTextIdevice', () => {
            expect(handler.canHandle('FreeTextIdevice')).toBe(false);
        });
    });

    describe('getTargetType', () => {
        it('should return text', () => {
            expect(handler.getTargetType()).toBe('text');
        });
    });

    describe('extractHtmlView', () => {
        it('should return empty for null dict', () => {
            expect(handler.extractHtmlView(null as unknown as Element)).toBe('');
        });

        it('should extract story text from storyTextArea', () => {
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="storyTextArea"/>
                    <instance class="TextAreaField">
                        <dictionary>
                            <string role="key" value="content"/>
                            <unicode value="Story intro content"/>
                        </dictionary>
                    </instance>
                </dictionary>
            `);
            const result = handler.extractHtmlView(dict);
            expect(result).toBe('Story intro content');
        });

        it('should extract questions with feedback', () => {
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="questions"/>
                    <list>
                        <instance class="Question">
                            <dictionary>
                                <string role="key" value="questionTextArea"/>
                                <instance class="TextAreaField">
                                    <dictionary>
                                        <string role="key" value="content"/>
                                        <unicode value="Question text"/>
                                    </dictionary>
                                </instance>
                                <string role="key" value="feedbackTextArea"/>
                                <instance class="TextAreaField">
                                    <dictionary>
                                        <string role="key" value="content"/>
                                        <unicode value="Feedback text"/>
                                    </dictionary>
                                </instance>
                            </dictionary>
                        </instance>
                    </list>
                </dictionary>
            `);
            const result = handler.extractHtmlView(dict);
            expect(result).toContain('Question text');
            expect(result).toContain('feedbacktooglebutton');
            expect(result).toContain('Feedback text');
            expect(result).toContain('js-feedback');
        });

        it('should use custom button caption if available', () => {
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="questions"/>
                    <list>
                        <instance class="Question">
                            <dictionary>
                                <string role="key" value="feedbackTextArea"/>
                                <instance class="TextAreaField">
                                    <dictionary>
                                        <string role="key" value="buttonCaption"/>
                                        <string value="Custom Caption"/>
                                        <string role="key" value="content"/>
                                        <unicode value="Feedback"/>
                                    </dictionary>
                                </instance>
                            </dictionary>
                        </instance>
                    </list>
                </dictionary>
            `);
            const result = handler.extractHtmlView(dict);
            expect(result).toContain('Custom Caption');
        });

        it('should combine story and questions', () => {
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="storyTextArea"/>
                    <instance class="TextAreaField">
                        <dictionary>
                            <string role="key" value="content"/>
                            <unicode value="Story"/>
                        </dictionary>
                    </instance>
                    <string role="key" value="questions"/>
                    <list>
                        <instance class="Question">
                            <dictionary>
                                <string role="key" value="questionTextArea"/>
                                <instance class="TextAreaField">
                                    <dictionary>
                                        <string role="key" value="content"/>
                                        <unicode value="Q1"/>
                                    </dictionary>
                                </instance>
                            </dictionary>
                        </instance>
                    </list>
                </dictionary>
            `);
            const result = handler.extractHtmlView(dict);
            expect(result).toContain('Story');
            expect(result).toContain('Q1');
        });
    });

    describe('extractFeedback', () => {
        it('should return empty (feedback is inline)', () => {
            const dict = createDomElement(`<dictionary/>`);
            const result = handler.extractFeedback(dict);
            expect(result.content).toBe('');
            expect(result.buttonCaption).toBe('');
        });
    });

    describe('extractProperties', () => {
        it('should return empty object', () => {
            const dict = createDomElement(`<dictionary/>`);
            expect(handler.extractProperties(dict)).toEqual({});
        });
    });
});

describe('WikipediaHandler', () => {
    let handler: WikipediaHandler;

    beforeEach(() => {
        handler = new WikipediaHandler();
    });

    describe('canHandle', () => {
        it('should handle WikipediaIdevice', () => {
            expect(handler.canHandle('WikipediaIdevice')).toBe(true);
        });

        it('should not handle FreeTextIdevice', () => {
            expect(handler.canHandle('FreeTextIdevice')).toBe(false);
        });
    });

    describe('getTargetType', () => {
        it('should return text', () => {
            expect(handler.getTargetType()).toBe('text');
        });
    });

    describe('extractHtmlView', () => {
        it('should return empty for null dict', () => {
            expect(handler.extractHtmlView(null as unknown as Element)).toBe('');
        });

        it('should extract from direct TextAreaField and wrap in div', () => {
            const dict = createDomElement(`
                <dictionary>
                    <instance class="TextAreaField">
                        <dictionary>
                            <string role="key" value="content"/>
                            <unicode value="Wikipedia content"/>
                        </dictionary>
                    </instance>
                </dictionary>
            `);
            const result = handler.extractHtmlView(dict);
            expect(result).toBe('<div class="exe-wikipedia-content">Wikipedia content</div>');
        });

        it('should clean empty paragraphs', () => {
            const dict = createDomElement(`
                <dictionary>
                    <instance class="TextAreaField">
                        <dictionary>
                            <string role="key" value="content"/>
                            <unicode value="Content&lt;p&gt;&lt;/p&gt;More"/>
                        </dictionary>
                    </instance>
                </dictionary>
            `);
            const result = handler.extractHtmlView(dict);
            // Empty paragraphs are cleaned by the handler
            expect(result).toBe('<div class="exe-wikipedia-content">ContentMore</div>');
        });

        it('should extract from fields list', () => {
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="fields"/>
                    <list>
                        <instance class="TextAreaField">
                            <dictionary>
                                <string role="key" value="content"/>
                                <unicode value="Fields content"/>
                            </dictionary>
                        </instance>
                    </list>
                </dictionary>
            `);
            const result = handler.extractHtmlView(dict);
            expect(result).toBe('<div class="exe-wikipedia-content">Fields content</div>');
        });

        it('should return empty when no content', () => {
            const dict = createDomElement(`<dictionary/>`);
            expect(handler.extractHtmlView(dict)).toBe('');
        });
    });

    describe('extractFeedback', () => {
        it('should return empty feedback', () => {
            const dict = createDomElement(`<dictionary/>`);
            const result = handler.extractFeedback(dict);
            expect(result.content).toBe('');
            expect(result.buttonCaption).toBe('');
        });
    });

    describe('extractProperties', () => {
        it('should return empty object', () => {
            const dict = createDomElement(`<dictionary/>`);
            expect(handler.extractProperties(dict)).toEqual({});
        });
    });
});

describe('RssHandler', () => {
    let handler: RssHandler;

    beforeEach(() => {
        handler = new RssHandler();
    });

    describe('canHandle', () => {
        it('should handle RssIdevice', () => {
            expect(handler.canHandle('RssIdevice')).toBe(true);
        });

        it('should not handle FreeTextIdevice', () => {
            expect(handler.canHandle('FreeTextIdevice')).toBe(false);
        });
    });

    describe('getTargetType', () => {
        it('should return text', () => {
            expect(handler.getTargetType()).toBe('text');
        });
    });

    describe('extractHtmlView', () => {
        it('should return empty for null dict', () => {
            expect(handler.extractHtmlView(null as unknown as Element)).toBe('');
        });

        it('should extract from direct TextAreaField', () => {
            const dict = createDomElement(`
                <dictionary>
                    <instance class="TextAreaField">
                        <dictionary>
                            <string role="key" value="content"/>
                            <unicode value="RSS content"/>
                        </dictionary>
                    </instance>
                </dictionary>
            `);
            expect(handler.extractHtmlView(dict)).toBe('RSS content');
        });

        it('should extract from fields list', () => {
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="fields"/>
                    <list>
                        <instance class="TextAreaField">
                            <dictionary>
                                <string role="key" value="content"/>
                                <unicode value="Fields RSS content"/>
                            </dictionary>
                        </instance>
                    </list>
                </dictionary>
            `);
            expect(handler.extractHtmlView(dict)).toBe('Fields RSS content');
        });

        it('should return empty when no content', () => {
            const dict = createDomElement(`<dictionary/>`);
            expect(handler.extractHtmlView(dict)).toBe('');
        });
    });

    describe('extractFeedback', () => {
        it('should return empty feedback', () => {
            const dict = createDomElement(`<dictionary/>`);
            const result = handler.extractFeedback(dict);
            expect(result.content).toBe('');
            expect(result.buttonCaption).toBe('');
        });
    });

    describe('extractProperties', () => {
        it('should return empty object', () => {
            const dict = createDomElement(`<dictionary/>`);
            expect(handler.extractProperties(dict)).toEqual({});
        });
    });
});

describe('NotaHandler', () => {
    let handler: NotaHandler;

    beforeEach(() => {
        handler = new NotaHandler();
    });

    describe('canHandle', () => {
        it('should handle NotaIdevice', () => {
            expect(handler.canHandle('NotaIdevice')).toBe(true);
        });

        it('should handle NotaInformacionIdevice', () => {
            expect(handler.canHandle('NotaInformacionIdevice')).toBe(true);
        });

        it('should not handle FreeTextIdevice', () => {
            expect(handler.canHandle('FreeTextIdevice')).toBe(false);
        });
    });

    describe('getTargetType', () => {
        it('should return text', () => {
            expect(handler.getTargetType()).toBe('text');
        });
    });

    describe('getBlockProperties', () => {
        it('should return visibility false', () => {
            const props = handler.getBlockProperties();
            expect(props.visibility).toBe('false');
        });
    });

    describe('extractHtmlView', () => {
        it('should return empty for null dict', () => {
            expect(handler.extractHtmlView(null as unknown as Element)).toBe('');
        });

        it('should extract from commentTextArea', () => {
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="commentTextArea"/>
                    <instance class="TextAreaField">
                        <dictionary>
                            <string role="key" value="content"/>
                            <unicode value="Comment content"/>
                        </dictionary>
                    </instance>
                </dictionary>
            `);
            expect(handler.extractHtmlView(dict)).toBe('Comment content');
        });

        it('should fallback to content key', () => {
            const dict = createDomElement(`
                <dictionary>
                    <string role="key" value="content"/>
                    <instance class="TextAreaField">
                        <dictionary>
                            <string role="key" value="content"/>
                            <unicode value="Content key"/>
                        </dictionary>
                    </instance>
                </dictionary>
            `);
            expect(handler.extractHtmlView(dict)).toBe('Content key');
        });

        it('should fallback to any TextAreaField', () => {
            const dict = createDomElement(`
                <dictionary>
                    <instance class="TextAreaField">
                        <dictionary>
                            <string role="key" value="content"/>
                            <unicode value="Any field"/>
                        </dictionary>
                    </instance>
                </dictionary>
            `);
            expect(handler.extractHtmlView(dict)).toBe('Any field');
        });

        it('should return empty when no content found', () => {
            const dict = createDomElement(`<dictionary/>`);
            expect(handler.extractHtmlView(dict)).toBe('');
        });
    });

    describe('extractFeedback', () => {
        it('should return empty feedback', () => {
            const dict = createDomElement(`<dictionary/>`);
            const result = handler.extractFeedback(dict);
            expect(result.content).toBe('');
            expect(result.buttonCaption).toBe('');
        });
    });

    describe('extractProperties', () => {
        it('should return empty object', () => {
            const dict = createDomElement(`<dictionary/>`);
            expect(handler.extractProperties(dict)).toEqual({});
        });
    });
});

describe('isIdeviceHandler type guard', () => {
    it('should be exported from IdeviceHandler', async () => {
        const { isIdeviceHandler } = await import('./IdeviceHandler');
        expect(typeof isIdeviceHandler).toBe('function');
    });

    it('should return true for handler instances', async () => {
        const { isIdeviceHandler } = await import('./IdeviceHandler');
        const handler = new FreeTextHandler();
        expect(isIdeviceHandler(handler)).toBe(true);
    });

    it('should return false for non-handler objects', async () => {
        const { isIdeviceHandler } = await import('./IdeviceHandler');
        expect(isIdeviceHandler({})).toBe(false);
        expect(isIdeviceHandler(null)).toBe(false);
        expect(isIdeviceHandler('string')).toBe(false);
    });
});
