#!/usr/bin/env node

/**
 * Add common missing globals that D&D 5e system expects
 */

export function addMissingGlobals(foundry) {
    // UI notifications
    if (!globalThis.ui) {
        globalThis.ui = {
            notifications: {
                info: (msg) => console.log(`[INFO] ${msg}`),
                warn: (msg) => console.warn(`[WARN] ${msg}`),
                error: (msg) => console.error(`[ERROR] ${msg}`)
            }
        };
    }
    
    // Canvas (rendering context)
    if (!globalThis.canvas) {
        globalThis.canvas = {
            ready: true,
            scene: null,
            dimensions: { width: 1000, height: 1000, sceneWidth: 1000, sceneHeight: 1000 },
            grid: { size: 100 }
        };
    }
    
    // Hooks system
    if (!globalThis.Hooks) {
        globalThis.Hooks = {
            _hooks: {},
            on: function(event, fn) {
                if (!this._hooks[event]) this._hooks[event] = [];
                this._hooks[event].push(fn);
            },
            once: function(event, fn) {
                this.on(event, fn);
            },
            call: function(event, ...args) {
                if (this._hooks[event]) {
                    for (const fn of this._hooks[event]) {
                        fn(...args);
                    }
                }
                return true;
            },
            callAll: function(event, ...args) {
                this.call(event, ...args);
            }
        };
    }
    
    // Chat Message
    if (!globalThis.ChatMessage) {
        globalThis.ChatMessage = class ChatMessage {
            static create(data) {
                return Promise.resolve(new ChatMessage(data));
            }
            
            constructor(data) {
                this.data = data;
            }
        };
    }
    
    // Text Editor
    if (!globalThis.TextEditor) {
        globalThis.TextEditor = {
            enrichHTML: (html, options = {}) => html,
            decodeHTML: (html) => html,
            previewHTML: (html) => html,
            truncateHTML: (html) => html
        };
    }
    
    // Template rendering
    if (!globalThis.renderTemplate) {
        globalThis.renderTemplate = async (path, data) => {
            return `<div>Template: ${path}</div>`;
        };
    }
    
    // Localization
    if (!globalThis.game.i18n) {
        globalThis.game.i18n = {
            localize: (key) => key,
            format: (key, data) => key,
            has: (key) => true
        };
    }
    
    // Settings
    if (!globalThis.game.settings) {
        globalThis.game.settings = {
            get: (namespace, key) => {
                if (namespace === 'dnd5e' && key === 'rulesVersion') return 'modern';
                return null;
            },
            set: () => Promise.resolve(),
            register: () => {}
        };
    }
    
    // Keyboard manager
    if (!globalThis.game.keyboard) {
        globalThis.game.keyboard = {
            isModifierActive: () => false,
            isDown: () => false
        };
    }
    
    // User management
    if (!globalThis.game.user) {
        globalThis.game.user = {
            id: "SYSTEM_USER_ID_16CH",
            name: "System",
            isGM: true,
            can: () => true
        };
    }
    
    // Permissions
    if (!globalThis.game.permissions) {
        globalThis.game.permissions = {
            TOKEN_CREATE: true,
            TOKEN_UPDATE: true,
            TOKEN_DELETE: true
        };
    }
    
    // Utils
    if (!globalThis.fromUuid) {
        globalThis.fromUuid = async (uuid) => null;
    }
    
    if (!globalThis.fromUuidSync) {
        globalThis.fromUuidSync = (uuid) => null;
    }
    
    // Drag and Drop
    if (!globalThis.DragDrop) {
        globalThis.DragDrop = class DragDrop {
            constructor(options) {
                this.options = options;
            }
            bind(element) { return this; }
        };
    }
    
    // Search Filter
    if (!globalThis.SearchFilter) {
        globalThis.SearchFilter = class SearchFilter {
            constructor(options) {
                this.options = options;
            }
            bind(element) { return this; }
        };
    }
    
    // Tabs
    if (!globalThis.Tabs) {
        globalThis.Tabs = class Tabs {
            constructor(options) {
                this.options = options;
            }
            bind(element) { return this; }
            activate(tabName) { return this; }
        };
    }
    
    // Application classes
    if (!globalThis.Application) {
        globalThis.Application = globalThis.FormApplication;
    }
    
    // Create ActorSheet and ItemSheet - check parent availability
    if (!globalThis.ActorSheet) {
        const ParentClass = globalThis.DocumentSheet || globalThis.FormApplication || class {};
        globalThis.ActorSheet = class ActorSheet extends ParentClass {
            get actor() { return this.object; }
        };
    }
    
    if (!globalThis.ItemSheet) {
        const ParentClass = globalThis.DocumentSheet || globalThis.FormApplication || class {};
        globalThis.ItemSheet = class ItemSheet extends ParentClass {
            get item() { return this.object; }
        };
    }
    
    // Document Sheet Config
    if (!globalThis.DocumentSheetConfig) {
        globalThis.DocumentSheetConfig = class DocumentSheetConfig extends (globalThis.FormApplication || class {}) {
            static get defaultOptions() {
                return {
                    classes: ["sheet-config"],
                    template: "templates/sheets/sheet-config.html",
                    width: 400,
                    height: "auto"
                };
            }
        };
    }
    
    // Handlebars helpers
    if (!globalThis.Handlebars) {
        globalThis.Handlebars = {
            registerHelper: () => {},
            compile: () => () => '<div></div>',
            helpers: {}
        };
    }
    
    console.log('Added missing global dependencies for D&D 5e system');
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    addMissingGlobals();
}