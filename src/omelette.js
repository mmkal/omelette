"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
const events_1 = require("events");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const hasProp = {}.hasOwnProperty;
// Calculates the depth of an object.
function depthOf(object) {
    let level = 1;
    for (const key in object) {
        if (!hasProp.call(object, key))
            continue;
        if (typeof object[key] === 'object') {
            const depth = depthOf(object[key]) + 1;
            level = Math.max(depth, level);
        }
    }
    return level;
}
// Removes all occurrences of `needle` from `haystack`
function removeSubstring(haystack, needle) {
    return haystack.replace(new RegExp(needle.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&"), 'g'), '');
}
class Omelette extends events_1.EventEmitter {
    constructor() {
        super();
        this.asyncs = 0;
        this.program = '';
        this.programs = [];
        this.fragments = [];
        this.shell = '';
        this.asyncs = 0;
        this.compgen = process.argv.indexOf("--compgen");
        this.install = process.argv.indexOf("--completion") > -1;
        this.installFish = process.argv.indexOf("--completion-fish") > -1;
        const isZsh = process.argv.indexOf("--compzsh") > -1;
        const isFish = process.argv.indexOf("--compfish") > -1;
        this.isDebug = process.argv.indexOf("--debug") > -1;
        this.fragment = parseInt(process.argv[this.compgen + 1]) - (isZsh ? 1 : 0);
        this.line = process.argv.slice(this.compgen + 3).join(' ');
        this.word = this.line?.trim().split(/\s+/).pop();
        this.HOME = process.env.HOME || '';
        this.SHELL = process.env.SHELL;
        this.platform = process.platform;
        this.mainProgram = function () { };
    }
    setProgram(programs) {
        const programsArray = programs.split('|');
        [this.program] = programsArray;
        return this.programs = programsArray.map(function (program) {
            return program.replace(/[^A-Za-z0-9\.\_\-]/g, ''); // Do not allow except:
            // .. uppercase
            // .. lowercase
            // .. numbers
            // .. dots
            // .. underscores
            // .. dashes
        });
    }
    setFragments(...fragments) {
        this.fragments = fragments;
    }
    generate() {
        const data = {
            before: this.word,
            fragment: this.fragment,
            line: this.line,
            reply: this.reply
        };
        this.emit("complete", this.fragments[this.fragment - 1], data);
        this.emit(this.fragments[this.fragment - 1], data);
        this.emit(`$${this.fragment}`, data);
        if (this.asyncs === 0) {
            return process.exit();
        }
    }
    reply(words = []) {
        const writer = (options) => {
            console.log(typeof options.join === "function" ? options.join(os.EOL) : undefined);
            return process.exit();
        };
        if (words instanceof Promise) {
            return words.then(writer);
        }
        else {
            return writer(words);
        }
    }
    next(handler) {
        if (typeof handler === 'function') {
            this.mainProgram = handler;
        }
    }
    tree(objectTree = {}) {
        const depth = depthOf(objectTree);
        for (let level = 1; level <= depth; level++) {
            this.on(`$${level}`, function ({ fragment, reply, line }) {
                let lastIndex;
                if (!(/\s+/.test(line.slice(-1)))) {
                    lastIndex = -1;
                }
                const accessor = (t) => line.split(/\s+/).slice(1, lastIndex).filter(Boolean).reduce((a, v) => a[v], t);
                const replies = fragment === 1 ? Object.keys(objectTree) : accessor(objectTree);
                return reply((function (replies) {
                    if (replies instanceof Function) {
                        return replies();
                    }
                    if (replies instanceof Array) {
                        return replies;
                    }
                    if (replies instanceof Object) {
                        return Object.keys(replies);
                    }
                    return [];
                })(replies));
            });
        }
        return this;
    }
    generateCompletionCode() {
        const completions = this.programs.map((program) => {
            const completion = `_${program}_completion`;
            return `### ${program} completion - begin. generated by omelette.js ###\nif type compdef &>/dev/null; then\n  ${completion}() {\n    compadd -- \`${this.program} --compzsh --compgen "\${CURRENT}" "\${words[CURRENT-1]}" "\${BUFFER}"\`\n  }\n  compdef ${completion} ${program}\nelif type complete &>/dev/null; then\n  ${completion}() {\n    local cur prev nb_colon\n    _get_comp_words_by_ref -n : cur prev\n    nb_colon=$(grep -o ":" <<< "$COMP_LINE" | wc -l)\n\n    COMPREPLY=( $(compgen -W '$(${this.program} --compbash --compgen "$((COMP_CWORD - (nb_colon * 2)))" "$prev" "\${COMP_LINE}")' -- "$cur") )\n\n    __ltrim_colon_completions "$cur"\n  }\n  complete -F ${completion} ${program}\nelif type compctl &>/dev/null; then\n  ${completion} () {\n    local cword line point si\n    read -Ac words\n    read -cn cword\n    read -l line\n    si="$IFS"\n    if ! IFS=$'\n' reply=($(${program} --compzsh --compgen "\${cword}" "\${words[cword-1]}" "\${line}")); then\n      local ret=$?\n      IFS="$si"\n      return $ret\n    fi\n    IFS="$si"\n  }\n  compctl -K ${completion} ${program}\nfi\n### ${program} completion - end ###`;
        });
        if (this.isDebug) {
            // Adding aliases for testing purposes
            completions.push(this.generateTestAliases());
        }
        return completions.join(os.EOL);
    }
    generateCompletionCodeFish() {
        const completions = this.programs.map((program) => {
            const completion = `_${program}_completion`;
            return `### ${program} completion - begin. generated by omelette.js ###\nfunction ${completion}\n  ${this.program} --compfish --compgen (count (commandline -poc)) (commandline -pt) (commandline -pb)\nend\ncomplete -f -c ${program} -a '(${completion})'\n### ${program} completion - end ###`;
        });
        if (this.isDebug) {
            // Adding aliases for testing purposes
            completions.push(this.generateTestAliases());
        }
        return completions.join(os.EOL);
    }
    generateTestAliases() {
        const fullPath = path.join(process.cwd(), this.program);
        const debugAliases = this.programs.map(function (program) {
            return `  alias ${program}=${fullPath}`;
        }).join(os.EOL);
        const debugUnaliases = this.programs.map(function (program) {
            return `  unalias ${program}`;
        }).join(os.EOL);
        return `### test method ###\nomelette-debug-${this.program}() {\n${debugAliases}\n}\nomelette-nodebug-${this.program}() {\n${debugUnaliases}\n}\n### tests ###`;
    }
    checkInstall() {
        if (this.install) {
            console.log(this.generateCompletionCode());
            return process.exit();
        }
        if (this.installFish) {
            console.log(this.generateCompletionCodeFish());
            return process.exit();
        }
    }
    getActiveShell() {
        if (!this.SHELL) {
            throw new Error('Shell could not be detected');
        }
        if (this.SHELL.match(/bash/)) {
            return 'bash';
        }
        else if (this.SHELL.match(/zsh/)) {
            return 'zsh';
        }
        else if (this.SHELL.match(/fish/)) {
            return 'fish';
        }
        else {
            throw new Error(`Unsupported shell: ${this.SHELL}`);
        }
    }
    getDefaultShellInitFile() {
        const fileAt = (root) => {
            return (file) => path.join(root, file);
        };
        const fileAtHome = fileAt(this.HOME);
        switch (this.shell = this.getActiveShell()) {
            case 'bash':
                return fileAtHome((this.platform === 'darwin' ? '.bash_profile' : '.bashrc'));
            case 'zsh':
                return fileAtHome('.zshrc');
            case 'fish':
                return fileAtHome('.config/fish/config.fish');
        }
        return '';
    }
    getCompletionBlock() {
        let command;
        switch (this.shell) {
            case 'bash':
                const completionPath = path.join(this.HOME, `.${this.program}`, 'completion.sh');
                command = `source ${completionPath}`;
                break;
            case 'zsh':
                command = `. <(${this.program} --completion)`;
                break;
            case 'fish':
                command = `${this.program} --completion-fish | source`;
                break;
        }
        if (command) {
            return `\n# begin ${this.program} completion\n${command}\n# end ${this.program} completion\n`;
        }
        return '';
    }
    setupShellInitFile(initFile = this.getDefaultShellInitFile()) {
        // @shell might be undefined if an `initFile` was passed
        if (this.shell == null) {
            this.shell = this.getActiveShell();
        }
        // Special treatment for bash to handle extra folder
        if (this.shell === 'bash') {
            const programFolder = path.join(this.HOME, `.${this.program}`);
            const completionPath = path.join(programFolder, 'completion.sh');
            if (!fs.existsSync(programFolder)) {
                fs.mkdirSync(programFolder);
            }
            fs.writeFileSync(completionPath, this.generateCompletionCode());
        }
        // For every shell, write completion block to the init file
        fs.appendFileSync(initFile, this.getCompletionBlock());
        return process.exit();
    }
    cleanupShellInitFile(initFile = this.getDefaultShellInitFile()) {
        // @shell might be undefined if an `initFile` was passed
        if (this.shell == null) {
            this.shell = this.getActiveShell();
        }
        // For every shell, rewrite the init file
        if (fs.existsSync(initFile)) {
            const cleanedInitFile = removeSubstring(fs.readFileSync(initFile, 'utf8'), this.getCompletionBlock());
            fs.writeFileSync(initFile, cleanedInitFile);
        }
        // Special treatment for bash to handle extra folder
        if (this.shell === 'bash') {
            const programFolder = path.join(this.HOME, `.${this.program}`);
            const completionPath = path.join(programFolder, 'completion.sh');
            if (fs.existsSync(completionPath)) {
                fs.unlinkSync(completionPath);
            }
            if ((fs.existsSync(programFolder)) && (fs.readdirSync(programFolder)).length === 0) {
                fs.rmdirSync(programFolder);
            }
        }
        return process.exit();
    }
    init() {
        if (this.compgen > -1) {
            return this.generate();
        }
        else {
            return this.mainProgram();
        }
    }
    on(action, callback) {
        // ideally we wouldn't need to do this pointless override, but it improves type inference
        return super.on(action, callback);
    }
    onAsync(event, handler) {
        super.on(event, handler);
        return this.asyncs += 1;
    }
}
function omelette(template, ...args) {
    let program;
    let fragments;
    let callbacks;
    if (template instanceof Array && args.length > 0) {
        [program, callbacks] = [template[0].trim(), args];
        fragments = callbacks.map((callback, index) => `arg${index}`);
    }
    else {
        [program, ...fragments] = template.split(/\s+/);
        callbacks = [];
    }
    fragments = fragments.map((fragment) => fragment.replace(/^\<+|\>+$/g, ''));
    const _omelette = new Omelette();
    _omelette.setProgram(program);
    // Use type assertion to satisfy the compiler
    _omelette.setFragments.apply(_omelette, fragments);
    _omelette.checkInstall();
    for (let index = 0; index < callbacks.length; index++) {
        const callback = callbacks[index];
        const fragment = `arg${index}`;
        ((callback) => {
            return _omelette.on(fragment, function (data) {
                const result = callback instanceof Array ? callback : callback(data);
                return this.reply(result || []);
            });
        })(callback);
    }
    return _omelette;
}
module.exports = omelette;
