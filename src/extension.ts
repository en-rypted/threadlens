import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as https from 'https';
import AdmZip = require('adm-zip');
import { parseThreadDump } from './parser';
import { detectDeadlocks } from './deadlockDetector';
import { ThreadDumpProvider, ThreadDumpItem } from './treeView';

export function activate(context: vscode.ExtensionContext) {
    console.log('Congratulations, your extension "threadlens" is now active!');

    // Register Sidebar TreeView
    const threadDumpProvider = new ThreadDumpProvider();
    vscode.window.registerTreeDataProvider('threadlens.filesView', threadDumpProvider);

    // Command: Analyze Active File (Old workflow)
    let analyzeCmd = vscode.commands.registerCommand('threadlens.analyze', () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('Please open a thread dump file to analyze.');
            return;
        }
        const text = editor.document.getText();
        const filename = path.basename(editor.document.fileName);
        processAndOpenDump(context, filename, text, threadDumpProvider);
    });

    // Command: Load Files / ZIP (New workflow)
    let loadFilesCmd = vscode.commands.registerCommand('threadlens.loadFiles', async () => {
        const uris = await vscode.window.showOpenDialog({
            canSelectMany: true,
            filters: {
                'Thread Dumps': ['tdump', 'txt', 'log'],
                'Archives': ['zip'],
                'All Files': ['*']
            },
            openLabel: 'Load Dumps'
        });

        if (!uris || uris.length === 0) return;

        vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Loading Thread Dumps...",
            cancellable: false
        }, async (progress) => {
            for (const uri of uris) {
                const ext = path.extname(uri.fsPath).toLowerCase();
                
                if (ext === '.zip') {
                    try {
                        const zip = new AdmZip(uri.fsPath);
                        const zipEntries = zip.getEntries();
                        let loadedCount = 0;
                        
                        for (const zipEntry of zipEntries) {
                            if (!zipEntry.isDirectory && (zipEntry.name.endsWith('.tdump') || zipEntry.name.endsWith('.txt') || zipEntry.name.endsWith('.log'))) {
                                const text = zipEntry.getData().toString('utf8');
                                await addDumpToProvider(zipEntry.name, text, threadDumpProvider);
                                loadedCount++;
                            }
                        }
                        vscode.window.showInformationMessage(`Extracted ${loadedCount} thread dumps from ${path.basename(uri.fsPath)}`);
                    } catch (e: any) {
                        vscode.window.showErrorMessage(`Failed to extract ZIP ${path.basename(uri.fsPath)}: ${e.message}`);
                    }
                } else {
                    const document = await vscode.workspace.openTextDocument(uri);
                    const text = document.getText();
                    await addDumpToProvider(path.basename(uri.fsPath), text, threadDumpProvider);
                }
            }
            
            // Automatically open the sidebar view
            vscode.commands.executeCommand('workbench.view.extension.threadlens-explorer');
        });
    });

    // Command: Open Dump from Sidebar
    let openDumpCmd = vscode.commands.registerCommand('threadlens.openDump', (item: ThreadDumpItem) => {
        openWebviewDashboard(context, item.label, item.parsedData, threadDumpProvider);
    });

    // Command: Remove Dump from Sidebar
    let removeDumpCmd = vscode.commands.registerCommand('threadlens.removeDump', (item: ThreadDumpItem) => {
        threadDumpProvider.removeDump(item);
    });

    context.subscriptions.push(analyzeCmd, loadFilesCmd, openDumpCmd, removeDumpCmd);
}

async function addDumpToProvider(filename: string, text: string, provider: ThreadDumpProvider) {
    try {
        const threads = parseThreadDump(text);
        const deadlocks = detectDeadlocks(threads);
        const timestampMatch = text.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/m);
        const timestamp = timestampMatch ? timestampMatch[0] : undefined;
        provider.addDump(filename, { threads, deadlocks }, timestamp);
    } catch (e: any) {
        vscode.window.showErrorMessage(`Failed to parse ${filename}: ${e.message}`);
    }
}

function processAndOpenDump(context: vscode.ExtensionContext, filename: string, text: string, provider: ThreadDumpProvider) {
    try {
        const threads = parseThreadDump(text);
        const deadlocks = detectDeadlocks(threads);
        
        if (deadlocks.length > 0) {
            vscode.window.showWarningMessage(`Parsed ${threads.length} threads. WARNING: Found ${deadlocks.length} deadlocks!`);
        } else {
            vscode.window.showInformationMessage(`Parsed ${threads.length} threads. No deadlocks found.`);
        }
        
        const timestampMatch = text.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/m);
        const timestamp = timestampMatch ? timestampMatch[0] : undefined;
        provider.addDump(filename, { threads, deadlocks }, timestamp);
        openWebviewDashboard(context, filename, { threads, deadlocks }, provider);
        
    } catch (error: any) {
        vscode.window.showErrorMessage('Error parsing thread dump: ' + error.message);
    }
}

function openWebviewDashboard(context: vscode.ExtensionContext, filename: string, data: { threads: any[], deadlocks: any[] }, provider: ThreadDumpProvider) {
    const panel = vscode.window.createWebviewPanel(
        'threadDumpAnalysis',
        `Analysis: ${filename}`,
        vscode.ViewColumn.Beside,
        { enableScripts: true }
    );
    
    const timeline = provider.getAllDumps().map(d => {
        let runnable = 0, blocked = 0, waiting = 0;
        (d.parsedData.threads || []).forEach((t: any) => {
            const s = (t.state || '').toUpperCase();
            if (s === 'RUNNABLE') runnable++;
            else if (s === 'BLOCKED') blocked++;
            else if (s.includes('WAITING') || s.includes('PARK')) waiting++;
        });
        return {
            name: d.label.replace('.tdump', '').replace('.txt', '').substring(0, 15),
            Runnable: runnable,
            Blocked: blocked,
            Waiting: waiting
        };
    });
    
    const webviewPath = path.join(context.extensionPath, 'out', 'webview');
    const scriptUri = panel.webview.asWebviewUri(vscode.Uri.file(path.join(webviewPath, 'assets', 'index.js')));
    const styleUri = panel.webview.asWebviewUri(vscode.Uri.file(path.join(webviewPath, 'assets', 'index.css')));
    
    panel.webview.html = `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link rel="stylesheet" type="text/css" href="${styleUri}">
        <title>ThreadLens Analysis</title>
    </head>
    <body>
        <div id="root"></div>
        <script>
            window.initialData = {
                filename: "${filename}",
                threads: ${JSON.stringify(data.threads).replace(/</g, '\\u003c')},
                deadlocks: ${JSON.stringify(data.deadlocks).replace(/</g, '\\u003c')},
                timeline: ${JSON.stringify(timeline).replace(/</g, '\\u003c')}
            };
        </script>
        <script type="module" src="${scriptUri}"></script>
    </body>
    </html>`;
    
    panel.webview.onDidReceiveMessage(
        message => {
            switch (message.command) {
                case 'runAiAnalysis':
                    handleAiAnalysis(filename, data);
                    return;
            }
        },
        undefined,
        context.subscriptions
    );
}

export function deactivate() {}

async function handleAiAnalysis(filename: string, data: any) {
    const prompt = buildAiPrompt(filename, data);

    try {
        let selectedModel;
        
        // VS Code LM API is available in newer versions
        if (vscode.lm && vscode.lm.selectChatModels) {
            const allModels = await vscode.lm.selectChatModels({});
            selectedModel = allModels[0];
        }

        if (selectedModel) {
            vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "🤖 AI is analyzing...",
                cancellable: false
            }, async (progress) => {
                try {
                    const messages = [
                        vscode.LanguageModelChatMessage.User(prompt)
                    ];
                    const chatResponse = await selectedModel.sendRequest(messages, {}, new vscode.CancellationTokenSource().token);
                    
                    let responseText = '';
                    for await (const fragment of chatResponse.text) {
                        responseText += fragment;
                    }
                    showAiResultPanel(filename, responseText);
                } catch (err: any) {
                    vscode.window.showErrorMessage('AI Analysis failed: ' + err.message);
                }
            });
            return;
        }
    } catch (e) {
        // Fallback gracefully
    }

    const config = vscode.workspace.getConfiguration('threadlens');
    const apiKey = config.get<string>('openaiApiKey');

    if (!apiKey || apiKey.trim() === '') {
        const action = await vscode.window.showErrorMessage(
            'No AI agent found! Please either install an AI extension (like Copilot, Antigravity) OR configure an OpenAI API key in settings.',
            'Open Settings'
        );
        if (action === 'Open Settings') {
            vscode.commands.executeCommand('workbench.action.openSettings', 'threadlens.openaiApiKey');
        }
        return;
    }

    vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "🤖 Contacting OpenAI...",
        cancellable: false
    }, async (progress) => {
        try {
            const result = await callOpenAiApi(apiKey, prompt);
            showAiResultPanel(filename, result);
        } catch (err: any) {
            vscode.window.showErrorMessage('OpenAI API request failed: ' + err.message);
        }
    });
}

function buildAiPrompt(filename: string, data: any): string {
    const totalThreads = data.threads.length;
    let deadlockStr = '';
    if (data.deadlocks.length > 0) {
        deadlockStr = `We detected ${data.deadlocks.length} deadlocks! Cycle details: ${JSON.stringify(data.deadlocks.map((d:any) => d.cycle.map((t:any) => t.name)))}. `;
    }

    const pools = new Map<string, number>();
    data.threads.forEach((t:any) => {
        const name = t.name || 'Unknown';
        const group = name.replace(/[-_]?\d+$/, '');
        pools.set(group, (pools.get(group) || 0) + 1);
    });
    
    const topPools = Array.from(pools.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(p => `${p[0]}: ${p[1]} threads`);

    return `You are an expert Java performance engineer. Analyze this thread dump summary for the file "${filename}".
Total threads: ${totalThreads}.
${deadlockStr}
Top Thread Pools:
${topPools.join('\n')}

Based on this structural data, what could be the root cause of the application's state, and how can we fix it? Keep it concise and professional.`;
}

function callOpenAiApi(apiKey: string, prompt: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: prompt }]
        });

        const options = {
            hostname: 'api.openai.com',
            port: 443,
            path: '/v1/chat/completions',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => { body += chunk; });
            res.on('end', () => {
                if (res.statusCode === 200) {
                    try {
                        const json = JSON.parse(body);
                        resolve(json.choices[0].message.content);
                    } catch (e) {
                        reject(new Error("Failed to parse OpenAI response"));
                    }
                } else {
                    reject(new Error(`OpenAI returned ${res.statusCode}: ${body}`));
                }
            });
        });

        req.on('error', (e) => reject(e));
        req.write(postData);
        req.end();
    });
}

function showAiResultPanel(filename: string, result: string) {
    const panel = vscode.window.createWebviewPanel(
        'aiAnalysis',
        `AI: ${filename}`,
        vscode.ViewColumn.Beside,
        {}
    );
    panel.webview.html = `<!DOCTYPE html>
    <html>
    <body style="font-family: var(--vscode-font-family); color: var(--vscode-editor-foreground); background-color: var(--vscode-editor-background); padding: 20px; line-height: 1.6; white-space: pre-wrap;">
        <h2>🤖 AI Analysis: ${filename}</h2>
        <div>${result.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
    </body>
    </html>`;
}
