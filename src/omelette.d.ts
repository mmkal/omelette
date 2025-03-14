import { EventEmitter } from 'events';
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
declare class Omelette extends EventEmitter<any> {
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
    program: string;
    programs: string[];
    fragments: string[];
    shell: string;
    mainProgram: () => void;
    constructor();
    setProgram(programs: string): string[];
    setFragments(...fragments: string[]): void;
    generate(): undefined;
    reply(words?: string[] | Promise<string[]>): void | Promise<void>;
    next(handler: () => void): void;
    tree(objectTree?: omelette.TreeValue): this;
    generateCompletionCode(): string;
    generateCompletionCodeFish(): string;
    generateTestAliases(): string;
    checkInstall(): undefined;
    getActiveShell(): string;
    getDefaultShellInitFile(): string;
    getCompletionBlock(): string;
    setupShellInitFile(initFile?: string): never;
    cleanupShellInitFile(initFile?: string): never;
    init(): void;
    on(action: string, callback: omelette.Callback): this;
    on(action: "complete", callback: omelette.CallbackOnComplete): this;
    onAsync(event: string, handler: omelette.CallbackAsync): number;
}
declare function omelette(template: string): Omelette;
declare function omelette(template: TemplateStringsArray, ...placeholders: omelette.TemplateValue[]): Omelette;
export = omelette;
