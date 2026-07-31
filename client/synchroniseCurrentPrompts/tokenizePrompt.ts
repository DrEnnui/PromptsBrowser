export type PromptToken = {
    type: "prompt" | "syntax" | "separator";
    value: string;
}

const EXTENDED_SYNTAX = new Set(["{", "}", "|"]);
const ALWAYS_SEPARATORS = new Set([",", ";", "，", "；"]);
const SENTENCE_SEPARATORS = new Set([".", "!", "?", "。", "！", "？"]);
const HORIZONTAL_WHITESPACE = /[ \f\v]/;
const WORD_CHAR = /[A-Za-z0-9_]/;

function isLineSeparator(char: string) {
    return char === "\r" || char === "\n" || char === "\t";
}

function isSentenceSeparator(value: string, index: number) {
    const char = value.charAt(index);
    if(!SENTENCE_SEPARATORS.has(char)) return false;

    const nextChar = value.charAt(index + 1);
    if(!nextChar) return true;
    if(SENTENCE_SEPARATORS.has(nextChar)) return true;

    return /\s/.test(nextChar);
}

function isPromptSeparator(value: string, index: number) {
    const char = value.charAt(index);
    return ALWAYS_SEPARATORS.has(char) || isLineSeparator(char) || isSentenceSeparator(value, index);
}

function isStandaloneBreak(value: string, index: number) {
    if(value.substring(index, index + 5) !== "BREAK") return false;

    const prevChar = index > 0 ? value.charAt(index - 1) : "";
    const nextChar = value.charAt(index + 5);

    if(prevChar && WORD_CHAR.test(prevChar)) return false;
    if(nextChar && WORD_CHAR.test(nextChar)) return false;

    return true;
}

function pushToken(tokens: PromptToken[], type: PromptToken["type"], value: string) {
    if(!value) return;

    const previous = tokens[tokens.length - 1];
    if(previous && previous.type === type && type === "separator") {
        previous.value += value;
        return;
    }

    tokens.push({type, value});
}

function splitTrailingWhitespace(value: string) {
    const match = value.match(/[ \f\v]+$/);
    if(!match) return {body: value, whitespace: ""};

    return {
        body: value.substring(0, value.length - match[0].length),
        whitespace: match[0],
    }
}

/**
 * Splits an A1111/Forge prompt into visual prompt entries while preserving the
 * separators needed to reconstruct the textarea after a card operation.
 *
 * Recognized visual separators:
 * - comma and semicolon
 * - sentence-ending period, exclamation mark and question mark
 * - line breaks and tabs
 * - the uppercase BREAK keyword (returned as a syntax token)
 *
 * Separators inside (), [], or <> are left untouched so decimal weights,
 * schedules and external-network syntax are not damaged.
 */
export default function tokenizePrompt(value: string, supportExtendedSyntax: boolean = true): PromptToken[] {
    const tokens: PromptToken[] = [];
    let buffer = "";
    let roundDepth = 0;
    let squareDepth = 0;
    let angleDepth = 0;
    let escaped = false;

    const atTopLevel = () => roundDepth === 0 && squareDepth === 0 && angleDepth === 0;

    const flushBuffer = (moveTrailingWhitespace = false) => {
        if(!buffer) return "";

        let promptValue = buffer;
        let trailingWhitespace = "";
        if(moveTrailingWhitespace) {
            const split = splitTrailingWhitespace(buffer);
            promptValue = split.body;
            trailingWhitespace = split.whitespace;
        }

        if(promptValue.trim()) pushToken(tokens, "prompt", promptValue);
        else trailingWhitespace = buffer;

        buffer = "";
        return trailingWhitespace;
    }

    for(let index = 0; index < value.length; index++) {
        const char = value.charAt(index);

        if(escaped) {
            buffer += char;
            escaped = false;
            continue;
        }

        if(char === "\\") {
            buffer += char;
            escaped = true;
            continue;
        }

        if(char === "<") angleDepth++;
        else if(char === ">" && angleDepth > 0) angleDepth--;
        else if(angleDepth === 0) {
            if(char === "[") squareDepth++;
            else if(char === "]" && squareDepth > 0) squareDepth--;
            else if(squareDepth === 0) {
                if(char === "(") roundDepth++;
                else if(char === ")" && roundDepth > 0) roundDepth--;
            }
        }

        if(supportExtendedSyntax && atTopLevel() && EXTENDED_SYNTAX.has(char)) {
            const leadingWhitespace = flushBuffer(true);
            let syntaxValue = leadingWhitespace + char;

            while(index + 1 < value.length && HORIZONTAL_WHITESPACE.test(value.charAt(index + 1))) {
                syntaxValue += value.charAt(++index);
            }

            pushToken(tokens, "syntax", syntaxValue);
            continue;
        }

        if(atTopLevel() && isStandaloneBreak(value, index)) {
            const leadingWhitespace = flushBuffer(true);
            pushToken(tokens, "separator", leadingWhitespace);
            pushToken(tokens, "syntax", "BREAK");
            index += 4;

            let followingWhitespace = "";
            while(index + 1 < value.length && /\s/.test(value.charAt(index + 1))) {
                followingWhitespace += value.charAt(++index);
            }
            pushToken(tokens, "separator", followingWhitespace);
            continue;
        }

        if(atTopLevel() && isPromptSeparator(value, index)) {
            let separator = flushBuffer(true) + char;

            while(index + 1 < value.length) {
                const nextIndex = index + 1;
                const nextChar = value.charAt(nextIndex);

                if(/\s/.test(nextChar)) {
                    separator += nextChar;
                    index++;
                    continue;
                }

                if(isPromptSeparator(value, nextIndex)) {
                    separator += nextChar;
                    index++;
                    continue;
                }

                break;
            }

            pushToken(tokens, "separator", separator);
            continue;
        }

        buffer += char;
    }

    flushBuffer();
    return tokens;
}
