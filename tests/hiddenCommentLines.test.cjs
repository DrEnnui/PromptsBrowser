const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function loadSource(relativePath, mocks = {}) {
    const filename = path.resolve(__dirname, '..', relativePath);
    const source = fs.readFileSync(filename, 'utf8');
    const compiled = ts.transpileModule(source, {
        fileName: filename,
        compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020},
    });
    const exports = {};
    const moduleObject = {exports};
    const context = {
        module: moduleObject,
        exports,
        require: (specifier) => {
            if(Object.prototype.hasOwnProperty.call(mocks, specifier)) return mocks[specifier];
            return {};
        },
        Event: class Event {},
        KeyboardEvent: class KeyboardEvent {},
    };
    vm.runInNewContext(compiled.outputText, context, {filename});
    return moduleObject.exports;
}

const {maskCommentLines} = loadSource('client/synchroniseCurrentPrompts/syncCurrentPrompts.ts');

test('hash-prefixed whole lines are masked, but inline hashes are not', () => {
    const input = 'bird # inline detail\n# note (broken:2.4), BREAK\ncat';
    const result = maskCommentLines(input);
    assert.equal(result.comments.size, 1);
    assert.ok(result.value.includes('bird # inline detail'));
    assert.ok(result.value.endsWith('\ncat'));
    const [marker, original] = [...result.comments.entries()][0];
    assert.equal(original, '# note (broken:2.4), BREAK');
    assert.equal(result.value.replace(marker, original), input);
});

test('comments preserve indentation, empty marker and CRLF line endings', () => {
    const input = '#\r\n  ## section, (syntax)\r\nactive';
    const result = maskCommentLines(input);
    assert.equal(result.comments.size, 2);
    for(const [marker, original] of result.comments) {
        result.value = result.value.replace(marker, original);
    }
    assert.equal(result.value, input);
});

test('a real prompt that resembles a placeholder cannot collide with a comment', () => {
    const input = 'PBECOMMENTLINETOKEN2\n# comment\nprompt';
    const result = maskCommentLines(input);
    const [marker, original] = [...result.comments.entries()][0];
    assert.notEqual(marker, 'PBECOMMENTLINETOKEN2');
    assert.equal(result.value.replace(marker, original), input);
});

function createSerializer() {
    const textarea = {value: '', dispatchEvent: () => {}};
    const mockStore = {default: {getState: () => ({currentContainer: 'txt2img'})}};
    const mockDOM = {default: {containers: {txt2img: {textArea: textarea}}}};
    const syncList = loadSource('client/synchroniseCurrentPrompts/syncListToTextareaBranch.ts', {
        'client/const': {DEFAULT_PROMPT_WEIGHT: 1},
    });
    const serialize = loadSource('client/synchroniseCurrentPrompts/synchroniseListToTextarea.ts', {
        'client/DOMCache': mockDOM,
        'client/store': mockStore,
        './syncListToTextareaBranch': syncList,
    }).default;
    return (prompts) => {
        serialize(prompts);
        return textarea.value;
    };
}

test('hidden comment line is serialized verbatim and remains at a line boundary', () => {
    const serialize = createSerializer();
    const comment = {
        id: '  # [author note] (not:1.3), BREAK',
        isComment: true,
        isSyntax: true,
        separatorAfter: '\n',
    };
    const a = {id: 'bird', separatorAfter: '\n'};
    const b = {id: 'cat'};
    assert.equal(serialize([a, comment, b]), 'bird\n  # [author note] (not:1.3), BREAK\ncat');
    assert.equal(serialize([a, b, comment]), 'bird\ncat\n  # [author note] (not:1.3), BREAK\n');
    assert.equal(serialize([comment, b]), '  # [author note] (not:1.3), BREAK\ncat');
});
