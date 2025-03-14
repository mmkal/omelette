import { EventEmitter } from 'events';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

const hasProp = {}.hasOwnProperty;

// Calculates the depth of an object.
function depthOf(object: Record<string, any>): number {
  let level = 1;
  for (const key in object) {
    if (!hasProp.call(object, key)) continue;
    if (typeof object[key] === 'object') {
      const depth = depthOf(object[key]) + 1;
      level = Math.max(depth, level);
    }
  }
  return level;
}

// Removes all occurrences of `needle` from `haystack`
function removeSubstring(haystack: string, needle: string): string {
  return haystack.replace(new RegExp(needle.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&"), 'g'), '');
}

declare namespace omelette {
  type Omelette = typeof omelette;

  type Instance = InstanceType<typeof Omelette>;

  type ReplyFn<T> = (value: T) => void;

  interface CallbackValue {
      before: string;
      fragment: number;
      line: string;
      reply: ReplyFn<Choices>;
  }

  interface CallbackAsyncValue {
      before: string;
      fragment: number;
      line: string;
      reply: ReplyFn<Promise<Choices>>;
  }

  type Callback = (obj: CallbackValue) => void;
  type CallbackOnComplete = (fragment: string, obj: CallbackValue) => void;

  type CallbackAsync = (obj: CallbackAsyncValue) => Promise<void>;

  type Choices = string[];

  type TemplatePrimativeValue = string | Choices;

  type TemplateValue = TemplatePrimativeValue | Callback;

  type TreeCallback<V> = () => V;

  interface TreeValue {
      [key: string]: TreeValue | Choices | TreeCallback<Choices>;
  }
}


class Omelette extends EventEmitter<any> {
  asyncs: number;
  compgen: number;
  install: boolean;
  installFish: boolean;
  isDebug: boolean;
  fragment: number;
  line: string;
  word: string | undefined;
  HOME: string;
  SHELL: string | undefined;
  platform: string;
  program!: string;
  programs!: string[];
  fragments!: string[];
  shell!: string;
  mainProgram: () => void;

  constructor() {
    super();
    
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
    this.mainProgram = function() {};
  }

  setProgram(programs: string): string[] {
    const programsArray = programs.split('|');
    [this.program] = programsArray;
    return this.programs = programsArray.map(function(program) {
      return program.replace(/[^A-Za-z0-9\.\_\-]/g, ''); // Do not allow except:
      // .. uppercase
      // .. lowercase
      // .. numbers
      // .. dots
      // .. underscores
      // .. dashes
    });
  }

  setFragments(...fragments: string[]) {
    this.fragments = fragments;
  }

  generate() {
    const data: omelette.CallbackValue = {
      before: this.word!,
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

  reply(words: string[] | Promise<string[]> = []) {
    const writer = (options: string[]): void => {
      console.log(typeof options.join === "function" ? options.join(os.EOL) : undefined);
      return process.exit();
    };
    
    if (words instanceof Promise) {
      return words.then(writer);
    } else {
      return writer(words);
    }
  }

  next(handler: () => void) {
    if (typeof handler === 'function') {
      return this.mainProgram = handler;
    }
  }

  tree(objectTree: omelette.TreeValue = {}) {
    const depth = depthOf(objectTree);
    
    for (let level = 1; level <= depth; level++) {
      this.on(`$${level}`, function({ fragment, reply, line }: omelette.CallbackValue) {
        let lastIndex: number | undefined;
        
        if (!(/\s+/.test(line.slice(-1)))) {
          lastIndex = -1;
        }
        
        const accessor = (t: any) => line.split(/\s+/).slice(1, lastIndex).filter(Boolean).reduce((a, v) => a[v], t);
        const replies = fragment === 1 ? Object.keys(objectTree) : accessor(objectTree);
        
        return reply((function(replies: any) {
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

  generateCompletionCode(): string {
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

  generateCompletionCodeFish(): string {
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

  generateTestAliases(): string {
    const fullPath = path.join(process.cwd(), this.program);
    const debugAliases = this.programs.map(function(program) {
      return `  alias ${program}=${fullPath}`;
    }).join(os.EOL);
    
    const debugUnaliases = this.programs.map(function(program) {
      return `  unalias ${program}`;
    }).join(os.EOL);
    
    return `### test method ###\nomelette-debug-${this.program}() {\n${debugAliases}\n}\nomelette-nodebug-${this.program}() {\n${debugUnaliases}\n}\n### tests ###`;
  }

  checkInstall() {
    if (this.install) {
      console.log(this.generateCompletionCode());
      process.exit();
    }
    
    if (this.installFish) {
      console.log(this.generateCompletionCodeFish());
      process.exit();
    }
  }

  getActiveShell(): string {
    if (!this.SHELL) {
      throw new Error('Shell could not be detected');
    }
    
    if (this.SHELL.match(/bash/)) {
      return 'bash';
    } else if (this.SHELL.match(/zsh/)) {
      return 'zsh';
    } else if (this.SHELL.match(/fish/)) {
      return 'fish';
    } else {
      throw new Error(`Unsupported shell: ${this.SHELL}`);
    }
  }

  getDefaultShellInitFile(): string {
    const fileAt = (root: string) => {
      return (file: string) => path.join(root, file);
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
    let command: string | undefined;
    
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
  }

  setupShellInitFile(initFile: string = this.getDefaultShellInitFile()) {
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
    fs.appendFileSync(initFile, this.getCompletionBlock()!);
    
    return process.exit();
  }

  cleanupShellInitFile(initFile: string = this.getDefaultShellInitFile()) {
    // @shell might be undefined if an `initFile` was passed
    if (this.shell == null) {
      this.shell = this.getActiveShell();
    }
    
    // For every shell, rewrite the init file
    if (fs.existsSync(initFile)) {
      const cleanedInitFile = removeSubstring(fs.readFileSync(initFile, 'utf8'), this.getCompletionBlock()!);
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
    } else {
      return this.mainProgram();
    }
  }

  on(action: string, callback: omelette.Callback): this;
  on(action: "complete", callback: omelette.CallbackOnComplete): this;
  on(action: any, callback: any): this {
    // ideally we wouldn't need to do this pointless override, but it improves type inference
    return super.on(action, callback);
  }

  onAsync(event: string, handler: omelette.CallbackAsync) {
    super.on(event, handler);
    return this.asyncs += 1;
  }
}

function omelette(template: string): Omelette;
function omelette(template: TemplateStringsArray, ...placeholders: omelette.TemplateValue[]): Omelette;
function omelette(template: string | TemplateStringsArray, ...args: omelette.TemplateValue[]): Omelette {
  let program: string;
  let fragments: string[];
  let callbacks: omelette.TemplateValue[];
  
  if (template instanceof Array && args.length > 0) {
    [program, callbacks] = [template[0].trim(), args];
    fragments = callbacks.map((callback, index) => `arg${index}`);
  } else {
    [program, ...fragments] = (template as string).split(/\s+/);
    callbacks = [];
  }
  
  fragments = fragments.map((fragment) => fragment.replace(/^\<+|\>+$/g, ''));
  
  const _omelette = new Omelette();
  _omelette.setProgram(program);
  _omelette.setFragments(...fragments);
  _omelette.checkInstall();
  
  for (let index = 0; index < callbacks.length; index++) {
    const callback = callbacks[index];
    const fragment = `arg${index}`;
    
    (function (callback) {
      return _omelette.on(fragment, function(this: Omelette, ...args) {
        return this.reply((callback instanceof Array ? callback : (callback as omelette.Callback)(...args))!);
      });
    })(callback);
  }
  
  return _omelette;
}

// Export directly as a function 
export = omelette;
