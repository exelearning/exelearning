import { Test, TestingModule } from '@nestjs/testing';
import { HtmlGeneratorHelper } from './html-generator.helper';
import { ParsedOdeStructure, NormalizedPage } from '../../xml/interfaces/ode-xml.interface';
import { Html5ExportOptions } from '../dto/export.dto';

describe('HtmlGeneratorHelper', () => {
    let service: HtmlGeneratorHelper;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [HtmlGeneratorHelper],
        }).compile();

        service = module.get<HtmlGeneratorHelper>(HtmlGeneratorHelper);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    const mockPage: NormalizedPage = {
        id: 'page1',
        title: 'Test Page',
        parent_id: null,
        level: 1,
        position: 0,
        components: [
            {
                id: 'c1',
                type: 'FreeTextIdevice',
                content: '<p>Hello World</p>',
                position: 0,
            },
        ],
    };

    const mockStructure: ParsedOdeStructure = {
        meta: {
            title: 'Test Project',
            language: 'en',
            description: 'A test project',
        },
        pages: [mockPage],
        navigation: { page: [] },
        raw: {} as any,
    };

    const mockOptions: Html5ExportOptions = {
        preview: true,
    };

    describe('generatePageHtml', () => {
        it('should generate valid HTML structure', () => {
            const html = service.generatePageHtml(mockPage, mockStructure, mockOptions);

            expect(html).toContain('<!doctype html>');
            expect(html).toContain('<html lang="en">');
            expect(html).toContain('<title>Test Page | Test Project</title>');
            expect(html).toContain('<h1 id="nodeTitle">Test Page</h1>');
            expect(html).toContain('Hello World');
            expect(html).toContain('exe-preview'); // Should have preview class
        });

        it('should include navigation', () => {
            const html = service.generatePageHtml(mockPage, mockStructure, mockOptions);
            expect(html).toContain('<div id="siteNav">');
            expect(html).toContain('Test Page');
        });
    });

    describe('generateIndexHtml', () => {
        it('should generate index content based on first page', () => {
            const html = service.generateIndexHtml(mockStructure, mockOptions);
            expect(html).toContain('Test Page');
        });
    });

    describe('path normalization (Windows compatibility)', () => {
        it('should normalize backslashes in image src attributes', () => {
            const pageWithBackslashes: NormalizedPage = {
                id: 'page2',
                title: 'Windows Path Test',
                parent_id: null,
                level: 1,
                position: 0,
                components: [
                    {
                        id: 'c2',
                        type: 'FreeTextIdevice',
                        content: '<img src="resources\\idevice123\\image.jpg" alt="test">',
                        position: 0,
                    },
                ],
            };

            const structure: ParsedOdeStructure = {
                ...mockStructure,
                pages: [pageWithBackslashes],
            };

            const html = service.generatePageHtml(pageWithBackslashes, structure, mockOptions);

            // Should convert backslashes to forward slashes
            expect(html).toContain('src="resources/idevice123/image.jpg"');
            expect(html).not.toContain('resources\\idevice123\\image.jpg');
        });

        it('should normalize backslashes in href attributes', () => {
            const pageWithBackslashes: NormalizedPage = {
                id: 'page3',
                title: 'Link Path Test',
                parent_id: null,
                level: 1,
                position: 0,
                components: [
                    {
                        id: 'c3',
                        type: 'FreeTextIdevice',
                        content: '<a href="documents\\file.pdf">Download</a>',
                        position: 0,
                    },
                ],
            };

            const structure: ParsedOdeStructure = {
                ...mockStructure,
                pages: [pageWithBackslashes],
            };

            const html = service.generatePageHtml(pageWithBackslashes, structure, mockOptions);

            expect(html).toContain('href="documents/file.pdf"');
            expect(html).not.toContain('documents\\file.pdf');
        });

        it('should normalize complex Windows paths', () => {
            const pageWithComplexPaths: NormalizedPage = {
                id: 'page4',
                title: 'Complex Paths Test',
                parent_id: null,
                level: 1,
                position: 0,
                components: [
                    {
                        id: 'c4',
                        type: 'FreeTextIdevice',
                        content: `
                            <img src="content\\resources\\20251009090601ROYVYO\\sq01.jpg">
                            <video poster="videos\\thumb\\video.jpg" src="videos\\movie.mp4"></video>
                            <source srcset="images\\small\\pic.jpg 480w, images\\large\\pic.jpg 800w">
                        `,
                        position: 0,
                    },
                ],
            };

            const structure: ParsedOdeStructure = {
                ...mockStructure,
                pages: [pageWithComplexPaths],
            };

            const html = service.generatePageHtml(pageWithComplexPaths, structure, mockOptions);

            // Check all paths are normalized
            expect(html).toContain('src="content/resources/20251009090601ROYVYO/sq01.jpg"');
            expect(html).toContain('poster="videos/thumb/video.jpg"');
            expect(html).toContain('src="videos/movie.mp4"');
            expect(html).toContain('srcset="images/small/pic.jpg 480w, images/large/pic.jpg 800w"');

            // Should not contain any backslashes in paths
            expect(html).not.toContain('content\\resources');
            expect(html).not.toContain('videos\\thumb');
            expect(html).not.toContain('images\\small');
        });

        it('should handle mixed forward and backslashes', () => {
            const pageWithMixedPaths: NormalizedPage = {
                id: 'page5',
                title: 'Mixed Paths Test',
                parent_id: null,
                level: 1,
                position: 0,
                components: [
                    {
                        id: 'c5',
                        type: 'FreeTextIdevice',
                        content: '<img src="resources/idevice\\subfolder\\image.png">',
                        position: 0,
                    },
                ],
            };

            const structure: ParsedOdeStructure = {
                ...mockStructure,
                pages: [pageWithMixedPaths],
            };

            const html = service.generatePageHtml(pageWithMixedPaths, structure, mockOptions);

            // All separators should be forward slashes
            expect(html).toContain('src="resources/idevice/subfolder/image.png"');
            expect(html).not.toContain('\\');
        });

        it('should not affect content without paths', () => {
            const pageWithoutPaths: NormalizedPage = {
                id: 'page6',
                title: 'No Paths Test',
                parent_id: null,
                level: 1,
                position: 0,
                components: [
                    {
                        id: 'c6',
                        type: 'FreeTextIdevice',
                        content: '<p>Simple text content with no paths</p>',
                        position: 0,
                    },
                ],
            };

            const structure: ParsedOdeStructure = {
                ...mockStructure,
                pages: [pageWithoutPaths],
            };

            const html = service.generatePageHtml(pageWithoutPaths, structure, mockOptions);

            expect(html).toContain('Simple text content with no paths');
        });
    });

    describe('iDevice wrappers', () => {
        it('should wrap text iDevices with exe-text class', () => {
            const pageWithTextIdevice: NormalizedPage = {
                id: 'page-text',
                title: 'Text iDevice Test',
                parent_id: null,
                level: 1,
                position: 0,
                components: [
                    {
                        id: 'text-1',
                        type: 'text',
                        content: '<p>This is text content</p>',
                        position: 0,
                    },
                ],
            };

            const structure: ParsedOdeStructure = {
                ...mockStructure,
                pages: [pageWithTextIdevice],
            };

            const html = service.generatePageHtml(pageWithTextIdevice, structure, mockOptions);

            // Should have exe-text wrapper for text iDevices
            expect(html).toContain('class="exe-text"');
            expect(html).toContain('<p>This is text content</p>');
            expect(html).toContain('class="idevice_node text"');
        });

        it('should add proper CSS classes for iDevice types', () => {
            const pageWithCasestudy: NormalizedPage = {
                id: 'page-casestudy',
                title: 'Case Study Test',
                parent_id: null,
                level: 1,
                position: 0,
                components: [
                    {
                        id: 'casestudy-1',
                        type: 'casestudy',
                        content: '<div>Case study content</div>',
                        position: 0,
                    },
                ],
            };

            const structure: ParsedOdeStructure = {
                ...mockStructure,
                pages: [pageWithCasestudy],
            };

            const html = service.generatePageHtml(pageWithCasestudy, structure, mockOptions);

            expect(html).toContain('class="idevice_node casestudy"');
            expect(html).toContain('data-idevice-type="casestudy"');
        });

        it('should add data attributes for JS initialization', () => {
            const html = service.generatePageHtml(mockPage, mockStructure, mockOptions);

            expect(html).toContain('data-idevice-path');
            expect(html).toContain('data-idevice-type');
            expect(html).toContain('data-idevice-component-type="json"');
        });

        it('should group components in blocks', () => {
            const pageWithBlocks: NormalizedPage = {
                id: 'page-blocks',
                title: 'Blocks Test',
                parent_id: null,
                level: 1,
                position: 0,
                components: [
                    {
                        id: 'comp-1',
                        type: 'text',
                        content: '<p>Content 1</p>',
                        blockName: 'My Block',
                        position: 0,
                        order: 0,
                    },
                    {
                        id: 'comp-2',
                        type: 'text',
                        content: '<p>Content 2</p>',
                        blockName: 'My Block',
                        position: 1,
                        order: 1,
                    },
                ],
            };

            const structure: ParsedOdeStructure = {
                ...mockStructure,
                pages: [pageWithBlocks],
            };

            const html = service.generatePageHtml(pageWithBlocks, structure, mockOptions);

            // Should have block structure with header
            expect(html).toContain('<article');
            expect(html).toContain('class="box"');
            expect(html).toContain('<h1 class="box-title">My Block</h1>');
            expect(html).toContain('<div class="box-content">');
        });

        it('should add no-header class for blocks without name', () => {
            const pageWithoutBlockName: NormalizedPage = {
                id: 'page-no-header',
                title: 'No Header Test',
                parent_id: null,
                level: 1,
                position: 0,
                components: [
                    {
                        id: 'comp-noname',
                        type: 'text',
                        content: '<p>Content</p>',
                        position: 0,
                    },
                ],
            };

            const structure: ParsedOdeStructure = {
                ...mockStructure,
                pages: [pageWithoutBlockName],
            };

            const html = service.generatePageHtml(pageWithoutBlockName, structure, mockOptions);

            expect(html).toContain('class="box no-header"');
        });

        it('should add visibility classes when component is hidden', () => {
            const pageWithHiddenComponent: NormalizedPage = {
                id: 'page-hidden',
                title: 'Hidden Test',
                parent_id: null,
                level: 1,
                position: 0,
                components: [
                    {
                        id: 'hidden-comp',
                        type: 'text',
                        content: '<p>Hidden content</p>',
                        position: 0,
                        properties: {
                            visibility: 'false',
                        },
                    },
                ],
            };

            const structure: ParsedOdeStructure = {
                ...mockStructure,
                pages: [pageWithHiddenComponent],
            };

            const html = service.generatePageHtml(pageWithHiddenComponent, structure, mockOptions);

            expect(html).toContain('novisible');
        });

        it('should add teacher-only class when component is teacher only', () => {
            const pageWithTeacherOnly: NormalizedPage = {
                id: 'page-teacher',
                title: 'Teacher Only Test',
                parent_id: null,
                level: 1,
                position: 0,
                components: [
                    {
                        id: 'teacher-comp',
                        type: 'text',
                        content: '<p>Teacher only content</p>',
                        position: 0,
                        properties: {
                            teacherOnly: 'true',
                        },
                    },
                ],
            };

            const structure: ParsedOdeStructure = {
                ...mockStructure,
                pages: [pageWithTeacherOnly],
            };

            const html = service.generatePageHtml(pageWithTeacherOnly, structure, mockOptions);

            expect(html).toContain('teacher-only');
        });

        it('should add JSON data attributes for non-text iDevices with properties', () => {
            const pageWithQuiz: NormalizedPage = {
                id: 'page-quiz',
                title: 'Quiz Test',
                parent_id: null,
                level: 1,
                position: 0,
                components: [
                    {
                        id: 'quiz-1',
                        type: 'trueorfalse',
                        content: '<div>Quiz content</div>',
                        position: 0,
                        properties: {
                            showFeedback: true,
                            randomize: false,
                        },
                    },
                ],
            };

            const structure: ParsedOdeStructure = {
                ...mockStructure,
                pages: [pageWithQuiz],
            };

            const html = service.generatePageHtml(pageWithQuiz, structure, mockOptions);

            expect(html).toContain('data-idevice-json-data');
            expect(html).toContain('data-idevice-template="trueorfalse.html"');
        });

        it('should handle unknown iDevice types gracefully', () => {
            const pageWithUnknownType: NormalizedPage = {
                id: 'page-unknown',
                title: 'Unknown Type Test',
                parent_id: null,
                level: 1,
                position: 0,
                components: [
                    {
                        id: 'unknown-1',
                        type: 'CustomUnknownIdevice',
                        content: '<div>Custom content</div>',
                        position: 0,
                    },
                ],
            };

            const structure: ParsedOdeStructure = {
                ...mockStructure,
                pages: [pageWithUnknownType],
            };

            const html = service.generatePageHtml(pageWithUnknownType, structure, mockOptions);

            // Should derive CSS class from type name
            expect(html).toContain('class="idevice_node customunknown"');
            expect(html).toContain('data-idevice-type="CustomUnknownIdevice"');
        });
    });
});
