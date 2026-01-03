/**
 * Tests for Request Payload Types
 *
 * These are type-only definitions, so we just verify they compile correctly
 * and can be used for type checking.
 */

import { describe, it, expect } from 'bun:test';
import type {
    UploadChunkRequest,
    FileUploadRequest,
    AssetUploadRequest,
    LoginRequest,
    JwtPayload,
    FileGatorDirRequest,
    FileGatorCreateRequest,
    ExportOptionsRequest,
    ConvertRequest,
    IdeviceFileUploadRequest,
    ProjectOpenRequest,
    ProjectSaveRequest,
    UserPreferencesRequest,
    AddCollaboratorRequest,
    TransferOwnershipRequest,
    UpdateVisibilityRequest,
} from './request-payloads';

describe('Request Payload Types', () => {
    describe('UploadChunkRequest', () => {
        it('should accept valid upload chunk data', () => {
            const request: UploadChunkRequest = {
                resumableIdentifier: 'abc123',
                resumableChunkNumber: '1',
                resumableTotalChunks: '5',
                resumableFilename: 'test.elp',
                file: Buffer.from('test'),
            };
            expect(request.resumableIdentifier).toBe('abc123');
        });
    });

    describe('FileUploadRequest', () => {
        it('should accept file with optional filename', () => {
            const request: FileUploadRequest = {
                file: Buffer.from('test'),
                filename: 'test.png',
            };
            expect(request.filename).toBe('test.png');
        });
    });

    describe('AssetUploadRequest', () => {
        it('should accept asset with metadata', () => {
            const request: AssetUploadRequest = {
                file: Buffer.from('test'),
                componentId: 'comp-1',
                clientId: 'client-1',
            };
            expect(request.componentId).toBe('comp-1');
        });
    });

    describe('LoginRequest', () => {
        it('should accept Symfony style login', () => {
            const request: LoginRequest = {
                _username: 'user@test.com',
                _password: 'secret',
            };
            expect(request._username).toBe('user@test.com');
        });

        it('should accept REST style login', () => {
            const request: LoginRequest = {
                email: 'user@test.com',
                password: 'secret',
            };
            expect(request.email).toBe('user@test.com');
        });
    });

    describe('JwtPayload', () => {
        it('should have required fields', () => {
            const payload: JwtPayload = {
                sub: 1,
                email: 'user@test.com',
                roles: ['ROLE_USER'],
                isGuest: false,
                exp: Date.now() + 3600000,
                iat: Date.now(),
            };
            expect(payload.sub).toBe(1);
            expect(payload.roles).toContain('ROLE_USER');
        });
    });

    describe('FileGatorDirRequest', () => {
        it('should accept directory path', () => {
            const request: FileGatorDirRequest = {
                dir: '/path/to/dir',
            };
            expect(request.dir).toBe('/path/to/dir');
        });
    });

    describe('FileGatorCreateRequest', () => {
        it('should accept file creation params', () => {
            const request: FileGatorCreateRequest = {
                type: 'file',
                name: 'newfile.txt',
                path: '/some/path',
            };
            expect(request.type).toBe('file');
        });

        it('should accept dir creation params', () => {
            const request: FileGatorCreateRequest = {
                type: 'dir',
                name: 'newfolder',
            };
            expect(request.type).toBe('dir');
        });
    });

    describe('ExportOptionsRequest', () => {
        it('should accept export options', () => {
            const request: ExportOptionsRequest = {
                format: 'scorm12',
                theme: 'base',
                singlePage: false,
            };
            expect(request.format).toBe('scorm12');
        });
    });

    describe('ConvertRequest', () => {
        it('should accept convert params', () => {
            const request: ConvertRequest = {
                file: Buffer.from('test'),
                format: 'html5',
            };
            expect(request.format).toBe('html5');
        });
    });

    describe('IdeviceFileUploadRequest', () => {
        it('should accept idevice file upload', () => {
            const request: IdeviceFileUploadRequest = {
                odeIdeviceId: 'idevice-1',
                filename: 'image.png',
                file: Buffer.from('test'),
            };
            expect(request.odeIdeviceId).toBe('idevice-1');
        });

        it('should accept base64 upload', () => {
            const request: IdeviceFileUploadRequest = {
                odeIdeviceId: 'idevice-1',
                filename: 'image.png',
                base64String: 'data:image/png;base64,abc123',
            };
            expect(request.base64String).toBeDefined();
        });
    });

    describe('ProjectOpenRequest', () => {
        it('should accept project open params', () => {
            const request: ProjectOpenRequest = {
                odeFilePath: '/tmp/test.elp',
                odeFileName: 'test.elp',
            };
            expect(request.odeFileName).toBe('test.elp');
        });
    });

    describe('ProjectSaveRequest', () => {
        it('should accept project save params', () => {
            const request: ProjectSaveRequest = {
                sessionId: 'session-123',
                title: 'My Project',
            };
            expect(request.sessionId).toBe('session-123');
        });
    });

    describe('UserPreferencesRequest', () => {
        it('should accept various preference types', () => {
            const request: UserPreferencesRequest = {
                theme: 'dark',
                fontSize: 14,
                showTips: true,
            };
            expect(request.theme).toBe('dark');
            expect(request.fontSize).toBe(14);
            expect(request.showTips).toBe(true);
        });
    });

    describe('AddCollaboratorRequest', () => {
        it('should accept email', () => {
            const request: AddCollaboratorRequest = {
                email: 'collaborator@test.com',
            };
            expect(request.email).toBe('collaborator@test.com');
        });
    });

    describe('TransferOwnershipRequest', () => {
        it('should accept new owner id', () => {
            const request: TransferOwnershipRequest = {
                newOwnerId: 42,
            };
            expect(request.newOwnerId).toBe(42);
        });
    });

    describe('UpdateVisibilityRequest', () => {
        it('should accept public visibility', () => {
            const request: UpdateVisibilityRequest = {
                visibility: 'public',
            };
            expect(request.visibility).toBe('public');
        });

        it('should accept private visibility', () => {
            const request: UpdateVisibilityRequest = {
                visibility: 'private',
            };
            expect(request.visibility).toBe('private');
        });
    });
});
