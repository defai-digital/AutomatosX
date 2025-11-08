/**
 * HtmlParserService.test.ts
 * Tests for HTML parser
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { HtmlParserService } from '../HtmlParserService.js';
import { readFileSync } from 'fs';
import { join } from 'path';
describe('HtmlParserService', () => {
    let parser;
    beforeEach(() => {
        parser = new HtmlParserService();
    });
    describe('metadata', () => {
        it('should have correct language identifier', () => {
            expect(parser.language).toBe('html');
        });
        it('should support HTML file extensions', () => {
            expect(parser.extensions).toContain('.html');
            expect(parser.extensions).toContain('.htm');
            expect(parser.extensions).toContain('.xhtml');
        });
    });
    describe('parsing', () => {
        it('should parse empty HTML', () => {
            const code = '';
            const result = parser.parse(code);
            expect(result.symbols).toEqual([]);
            expect(result.parseTime).toBeGreaterThanOrEqual(0);
        });
        it('should parse basic HTML elements', () => {
            const code = `
<!DOCTYPE html>
<html>
  <body>
    <div id="app"></div>
  </body>
</html>
      `;
            const result = parser.parse(code);
            expect(result.symbols.length).toBeGreaterThan(0);
            const divElement = result.symbols.find(s => s.name === 'div#app');
            expect(divElement).toBeDefined();
            expect(divElement?.kind).toBe('class');
        });
        it('should extract elements with id attributes', () => {
            const code = `
<div id="main-container">
  <h1 id="page-title">Title</h1>
  <button id="submit-btn">Submit</button>
</div>
      `;
            const result = parser.parse(code);
            const mainContainer = result.symbols.find(s => s.name === 'div#main-container');
            expect(mainContainer).toBeDefined();
            const pageTitle = result.symbols.find(s => s.name === 'h1#page-title');
            expect(pageTitle).toBeDefined();
            const submitBtn = result.symbols.find(s => s.name === 'button#submit-btn');
            expect(submitBtn).toBeDefined();
        });
        it('should extract elements with class attributes', () => {
            const code = `
<div class="container">
  <header class="main-header">
    <nav class="navbar">
      <ul class="nav-list"></ul>
    </nav>
  </header>
</div>
      `;
            const result = parser.parse(code);
            const container = result.symbols.find(s => s.name === 'div.container');
            expect(container).toBeDefined();
            const header = result.symbols.find(s => s.name === 'header.main-header');
            expect(header).toBeDefined();
            const navbar = result.symbols.find(s => s.name === 'nav.navbar');
            expect(navbar).toBeDefined();
        });
        it('should extract script elements with src attribute', () => {
            const code = `
<!DOCTYPE html>
<html>
  <head>
    <script src="app.js"></script>
    <script src="https://cdn.example.com/lib.js"></script>
  </head>
</html>
      `;
            const result = parser.parse(code);
            const appScript = result.symbols.find(s => s.name.includes('app.js'));
            expect(appScript).toBeDefined();
            expect(appScript?.kind).toBe('function');
            const cdnScript = result.symbols.find(s => s.name.includes('lib.js'));
            expect(cdnScript).toBeDefined();
        });
        it('should extract inline script elements', () => {
            const code = `
<!DOCTYPE html>
<html>
  <body>
    <script>
      console.log('Hello World');
    </script>
  </body>
</html>
      `;
            const result = parser.parse(code);
            const inlineScript = result.symbols.find(s => s.name.includes('inline'));
            expect(inlineScript).toBeDefined();
            expect(inlineScript?.kind).toBe('function');
        });
        it('should extract style elements', () => {
            const code = `
<!DOCTYPE html>
<html>
  <head>
    <link rel="stylesheet" href="styles.css">
    <style>
      body { margin: 0; }
    </style>
  </head>
</html>
      `;
            const result = parser.parse(code);
            // Note: link elements might not be extracted as style_element
            // Inline style should be found
            const inlineStyle = result.symbols.find(s => s.name.includes('inline') && s.kind === 'variable');
            expect(inlineStyle).toBeDefined();
        });
        it('should parse semantic HTML5 elements', () => {
            const code = `
<main id="content">
  <article class="blog-post">
    <header><h1>Title</h1></header>
    <section><p>Content</p></section>
    <footer><p>Footer</p></footer>
  </article>
</main>
      `;
            const result = parser.parse(code);
            const main = result.symbols.find(s => s.name === 'main#content');
            expect(main).toBeDefined();
            const article = result.symbols.find(s => s.name === 'article.blog-post');
            expect(article).toBeDefined();
        });
        it('should parse form elements', () => {
            const code = `
<form id="contact-form" class="form-container">
  <input type="text" id="name" class="form-input">
  <input type="email" id="email" class="form-input">
  <textarea id="message" class="form-textarea"></textarea>
  <button id="submit" class="btn-primary">Submit</button>
</form>
      `;
            const result = parser.parse(code);
            const form = result.symbols.find(s => s.name === 'form#contact-form');
            expect(form).toBeDefined();
            const nameInput = result.symbols.find(s => s.name === 'input#name');
            expect(nameInput).toBeDefined();
            const submitBtn = result.symbols.find(s => s.name === 'button#submit');
            expect(submitBtn).toBeDefined();
        });
        it('should parse nested elements correctly', () => {
            const code = `
<div id="outer">
  <div id="middle">
    <div id="inner">
      <span id="deepest">Content</span>
    </div>
  </div>
</div>
      `;
            const result = parser.parse(code);
            expect(result.symbols.length).toBeGreaterThanOrEqual(4);
            const outer = result.symbols.find(s => s.name === 'div#outer');
            const middle = result.symbols.find(s => s.name === 'div#middle');
            const inner = result.symbols.find(s => s.name === 'div#inner');
            const deepest = result.symbols.find(s => s.name === 'span#deepest');
            expect(outer).toBeDefined();
            expect(middle).toBeDefined();
            expect(inner).toBeDefined();
            expect(deepest).toBeDefined();
        });
        it('should extract media elements', () => {
            const code = `
<div>
  <img id="logo" src="logo.png" alt="Logo" class="logo-img">
  <video id="player" class="video-player">
    <source src="video.mp4" type="video/mp4">
  </video>
  <audio id="sound" class="audio-player">
    <source src="audio.mp3" type="audio/mpeg">
  </audio>
</div>
      `;
            const result = parser.parse(code);
            const img = result.symbols.find(s => s.name === 'img#logo');
            expect(img).toBeDefined();
            const video = result.symbols.find(s => s.name === 'video#player');
            expect(video).toBeDefined();
            const audio = result.symbols.find(s => s.name === 'audio#sound');
            expect(audio).toBeDefined();
        });
        it('should handle position information correctly', () => {
            const code = `
<div id="test">
  <p>Content</p>
</div>
      `;
            const result = parser.parse(code);
            const div = result.symbols.find(s => s.name === 'div#test');
            expect(div).toBeDefined();
            expect(div.line).toBeGreaterThan(0);
            expect(div.column).toBeGreaterThanOrEqual(0);
            expect(div.endLine).toBeGreaterThan(div.line);
        });
        it('should parse elements without id or class', () => {
            const code = `
<div>
  <header>
    <h1>Title</h1>
  </header>
</div>
      `;
            const result = parser.parse(code);
            // Elements without id/class should use tag name only
            const div = result.symbols.find(s => s.name === 'div');
            expect(div).toBeDefined();
            const header = result.symbols.find(s => s.name === 'header');
            expect(header).toBeDefined();
        });
    });
    describe('fixtures', () => {
        it('should parse sample-html-basic.html', () => {
            const fixturePath = join(__dirname, 'fixtures', 'html', 'sample-html-basic.html');
            const code = readFileSync(fixturePath, 'utf-8');
            const result = parser.parse(code);
            expect(result.symbols.length).toBeGreaterThan(10);
            // Check for key elements
            const header = result.symbols.find(s => s.name === 'header#main-header');
            expect(header).toBeDefined();
            const mainContent = result.symbols.find(s => s.name === 'main#main-content');
            expect(mainContent).toBeDefined();
            const footer = result.symbols.find(s => s.name === 'footer#main-footer');
            expect(footer).toBeDefined();
            // Scripts
            const externalScript = result.symbols.find(s => s.name.includes('app.js'));
            expect(externalScript).toBeDefined();
        });
        it('should parse sample-html-advanced.html', () => {
            const fixturePath = join(__dirname, 'fixtures', 'html', 'sample-html-advanced.html');
            const code = readFileSync(fixturePath, 'utf-8');
            const result = parser.parse(code);
            expect(result.symbols.length).toBeGreaterThan(30);
            // Check for semantic elements
            const app = result.symbols.find(s => s.name === 'div#app');
            expect(app).toBeDefined();
            const main = result.symbols.find(s => s.name === 'main#main');
            expect(main).toBeDefined();
            // Check for forms
            const form = result.symbols.find(s => s.name === 'form#advanced-form');
            expect(form).toBeDefined();
            // Check for media
            const modalDialog = result.symbols.find(s => s.name === 'dialog#modal');
            expect(modalDialog).toBeDefined();
        });
    });
    describe('error handling', () => {
        it('should handle syntax errors gracefully', () => {
            const code = `
<div>
  <p>Unclosed paragraph
  <span>Unclosed span
</div>
      `;
            const result = parser.parse(code);
            // Tree-sitter is error-tolerant, should still extract some symbols
            expect(result.symbols).toBeDefined();
            expect(Array.isArray(result.symbols)).toBe(true);
        });
        it('should handle mixed valid and invalid HTML', () => {
            const code = `
<div id="valid">
  <p>Valid content</p>
</div>
<invalid-unclosed>
<div id="another-valid">
  <span>More content</span>
</div>
      `;
            const result = parser.parse(code);
            expect(result.symbols).toBeDefined();
            const validDiv = result.symbols.find(s => s.name === 'div#valid');
            expect(validDiv).toBeDefined();
        });
    });
    describe('performance', () => {
        it('should parse large HTML files efficiently', () => {
            // Generate a large HTML document
            const elements = Array.from({ length: 100 }, (_, i) => `
        <div id="element-${i}" class="item">
          <h2>Title ${i}</h2>
          <p>Content for element ${i}</p>
        </div>
      `).join('\n');
            const code = `
<!DOCTYPE html>
<html>
  <body>
    ${elements}
  </body>
</html>
      `;
            const startTime = performance.now();
            const result = parser.parse(code);
            const endTime = performance.now();
            const parseTime = endTime - startTime;
            expect(result.symbols.length).toBeGreaterThan(100);
            expect(parseTime).toBeLessThan(500); // Should parse in < 500ms
        });
    });
});
//# sourceMappingURL=HtmlParserService.test.js.map