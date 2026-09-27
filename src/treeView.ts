import * as vscode from 'vscode';
import * as path from 'path';

export class ThreadDumpItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly timestamp: string,
        public readonly parsedData: any
    ) {
        super(label, vscode.TreeItemCollapsibleState.None);
        this.tooltip = `${this.label}`;
        this.description = timestamp;
        this.iconPath = vscode.ThemeIcon.File;
        this.resourceUri = vscode.Uri.file(label);
        
        // When clicked, tell the extension to open this specific dump
        this.command = {
            command: 'threadlens.openDump',
            title: 'Open Thread Dump',
            arguments: [this]
        };
        // Ensure id is unique for tree item tracking
        this.id = `${label}-${Date.now()}`;
    }
}

export class ThreadDumpProvider implements vscode.TreeDataProvider<ThreadDumpItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<ThreadDumpItem | undefined | null | void> = new vscode.EventEmitter<ThreadDumpItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<ThreadDumpItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private dumps: ThreadDumpItem[] = [];

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    addDump(filename: string, data: any, timestamp?: string) {
        const time = timestamp || new Date().toLocaleTimeString();
        this.dumps.push(new ThreadDumpItem(filename, time, data));
        this.refresh();
    }
    
    removeDump(item: ThreadDumpItem) {
        this.dumps = this.dumps.filter(d => d.id !== item.id);
        this.refresh();
    }
    
    getAllDumps() {
        return this.dumps;
    }

    clear() {
        this.dumps = [];
        this.refresh();
    }

    getTreeItem(element: ThreadDumpItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: ThreadDumpItem): Thenable<ThreadDumpItem[]> {
        if (element) {
            return Promise.resolve([]);
        } else {
            return Promise.resolve(this.dumps);
        }
    }
}
