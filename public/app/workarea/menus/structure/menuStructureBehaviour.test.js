/**
 * Tests for MenuStructureBehaviour class
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock translation function
global._ = vi.fn((str) => str);

// Mock window.AppLogger
global.window = global.window || {};
window.AppLogger = {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
};

// Mock eXeLearning global
global.eXeLearning = {
    app: {
        project: {
            checkOpenIdevice: vi.fn(() => false),
        },
        modals: {
            alert: { show: vi.fn() },
        },
    },
};

import MenuStructureBehaviour from './menuStructureBehaviour.js';

describe('MenuStructureBehaviour', () => {
    let behaviour;
    let mockStructureEngine;

    beforeEach(() => {
        vi.clearAllMocks();

        document.body.innerHTML = `
            <div id="main">
                <div id="menu_nav">
                    <div id="nav_list">
                        <div class="nav-element toggle-on" nav-id="node-1" is-parent="true">
                            <span class="exe-icon">keyboard_arrow_down</span>
                            <div class="nav-element-text">
                                <button class="node-menu-button" data-menunavid="node-1"></button>
                                <button class="node-add-button" data-parentnavid="node-1"></button>
                            </div>
                        </div>
                        <div class="nav-element" nav-id="root" is-parent="true">
                            <span class="exe-icon">keyboard_arrow_down</span>
                            <div class="nav-element-text">
                                <button class="node-add-button" data-parentnavid="root"></button>
                            </div>
                        </div>
                    </div>
                    <button class="button_nav_action action_add"></button>
                    <button class="button_nav_action action_properties"></button>
                    <button class="button_nav_action action_delete"></button>
                    <button class="button_nav_action action_clone"></button>
                </div>
            </div>
        `;

        const nodeMap = {
            'node-1': { open: true, showModalProperties: vi.fn() },
            root: { open: true, showModalProperties: vi.fn() },
        };

        mockStructureEngine = {
            getNode: vi.fn((id) => nodeMap[id]),
        };

        behaviour = new MenuStructureBehaviour(mockStructureEngine);
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    describe('addNavTestIds', () => {
        it('adds data-testid and data-node-id attributes to nav elements', () => {
            behaviour.addNavTestIds();

            const navElements = document.querySelectorAll('.nav-element[nav-id]');
            expect(navElements.length).toBe(2);

            const firstNode = navElements[0];
            expect(firstNode.getAttribute('data-testid')).toBe('nav-node');
            expect(firstNode.getAttribute('data-node-id')).toBe('node-1');

            const textBtn = firstNode.querySelector('.nav-element-text');
            expect(textBtn.getAttribute('data-testid')).toBe('nav-node-text');
            expect(textBtn.getAttribute('data-node-id')).toBe('node-1');

            const menuBtn = firstNode.querySelector('.node-menu-button');
            expect(menuBtn.getAttribute('data-testid')).toBe('nav-node-menu');
            expect(menuBtn.getAttribute('data-node-id')).toBe('node-1');

            const toggle = firstNode.querySelector('.exe-icon');
            expect(toggle.getAttribute('data-testid')).toBe('nav-node-toggle');
            expect(toggle.getAttribute('data-node-id')).toBe('node-1');
        });
    });

    describe('addEventNavElementOnAddIconClick', () => {
        it('calls showModalNewNode with null for root and id for non-root', () => {
            const spy = vi.spyOn(behaviour, 'showModalNewNode').mockImplementation(() => {});

            behaviour.addEventNavElementOnAddIconClick();

            const rootAddButton = document.querySelector(
                '.nav-element[nav-id="root"] .node-add-button'
            );
            const nodeAddButton = document.querySelector(
                '.nav-element[nav-id="node-1"] .node-add-button'
            );

            rootAddButton.click();
            nodeAddButton.click();

            expect(spy).toHaveBeenCalledWith(null);
            expect(spy).toHaveBeenCalledWith('node-1');
        });
    });

    describe('addEventNavElementIconOnclick', () => {
        it('toggles classes, icon text, and node state on click', () => {
            behaviour.addEventNavElementIconOnclick();

            const navElement = document.querySelector('.nav-element[nav-id="node-1"]');
            const icon = navElement.querySelector('.exe-icon');

            icon.click();
            expect(navElement.classList.contains('toggle-off')).toBe(true);
            expect(navElement.classList.contains('toggle-on')).toBe(false);
            expect(icon.innerHTML).toBe('keyboard_arrow_right');
            expect(mockStructureEngine.getNode('node-1').open).toBe(false);
            expect(navElement.getAttribute('data-expanded')).toBe('false');
            expect(navElement.getAttribute('aria-expanded')).toBe('false');

            icon.click();
            expect(navElement.classList.contains('toggle-on')).toBe(true);
            expect(navElement.classList.contains('toggle-off')).toBe(false);
            expect(icon.innerHTML).toBe('keyboard_arrow_down');
            expect(mockStructureEngine.getNode('node-1').open).toBe(true);
            expect(navElement.getAttribute('data-expanded')).toBe('true');
            expect(navElement.getAttribute('aria-expanded')).toBe('true');
        });
    });

    describe('addEventNavElementOnMenuIconClic', () => {
        it('opens properties modal for the selected node', () => {
            const mutationSpy = vi
                .spyOn(behaviour, 'mutationForModalProperties')
                .mockImplementation(() => {});

            behaviour.addEventNavElementOnMenuIconClic();

            const menuButton = document.querySelector('.node-menu-button');
            menuButton.click();

            const node = mockStructureEngine.getNode('node-1');
            expect(node.showModalProperties).toHaveBeenCalled();
            expect(mutationSpy).toHaveBeenCalled();
        });
    });

    describe('addEventNavElementOnDbclick', () => {
        it('sets dbclickNode when a nav element is double-clicked', () => {
            behaviour.addEventNavElementOnDbclick();

            const label = document.querySelector(
                '.nav-element[nav-id="node-1"] > .nav-element-text'
            );
            label.dispatchEvent(
                new MouseEvent('dblclick', { bubbles: true, cancelable: true })
            );

            expect(behaviour.dbclickNode).toBe(true);
        });
    });
});
