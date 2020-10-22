// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as child_process from 'child_process';
import * as fs from 'fs'
import * as path from 'path'
import { assert } from 'console';
import { findSourceMap } from 'module';
import { resolveCliPathFromVSCodeExecutablePath } from 'vscode-test';
// import { ExtensionContext, StatusBarAlignment, window, StatusBarItem, Selection, workspace, TextEditor, commands, ProgressLocation } from 'vscode';

import { myOutputChannel, getFreshOutputChannel } from './output_channel'
import { cmdPickFont } from './font_picker'

function cmdPrintSupportedVimFileType(context: vscode.ExtensionContext) {
	const work = () => {
		// vim/nvim can only print buffer content and options to stdout in ex mode by default
		// to print anything else, verbose mode (-V1) is necessary
		// The random string is to identify (the line before) the result among the noises.
		const randomString = Math.random().toString();	
		const result = child_process.spawnSync('nvim', [
			'-V1',
			'-es',
			`+echo "${randomString}"`,
			'+echo getcompletion("", "filetype")',
			'+set sw',
			'+q',
		]);

		const showError = () => {vscode.window.showErrorMessage("failed to obtain supported file types");};
		if (result.status !== 0) {
			return showError();
		}

		const lines = result.stderr.toString().split(/\r?\n/);
		const randomStringIdx = lines.indexOf(randomString);
		if (randomStringIdx<0 || randomStringIdx>=lines.length-1) {
			return showError();
		}

		const resultWithDoubleQuotes = lines[randomStringIdx+1].replace(/'/g, '"');
		const resultArray = JSON.parse(resultWithDoubleQuotes) as Array<string>
		const outputChannel = getFreshOutputChannel();
		for (let x of resultArray) {
			outputChannel.appendLine(x);
		}
	}

	const progress = vscode.window.withProgress({
		location: vscode.ProgressLocation.Window,
		title: "fetching supported file types",
		cancellable: false
	}, (progress, token) => {
		return new Promise(resolve => {
			setTimeout(() => {
				work();
				resolve();
			}, 0);
		});
	});
}

function cmdCompile(context: vscode.ExtensionContext) {
	const outputChannel = getFreshOutputChannel();

	const editor = vscode.window.activeTextEditor;
	if (editor === undefined) {
		outputChannel.appendLine('No open file');
		return;
	}
	if (editor.document.languageId !== 'lmtx') {
		outputChannel.appendLine('Not LMTX');
		return;
	}

	const workspaceFolders = vscode.workspace.workspaceFolders;
	if (workspaceFolders === undefined) {
		outputChannel.appendLine('Workspace must be opened for compilation');
		return;
	}

	const currentFilePath = editor.document.fileName;
	const currentWorkspaceFolderPath = workspaceFolders[0].uri.path;
	outputChannel.appendLine(currentWorkspaceFolderPath);
	const cmd = child_process.spawn('context', ['--nonstopmode', currentFilePath], {'cwd': currentWorkspaceFolderPath});
	outputChannel.show();
	outputChannel.append('wtfx');
	cmd.stdout.on('data', (data) => {
		outputChannel.append(data.toString());
	});
	cmd.on('close', (code) => {
		outputChannel.appendLine(`\nFinished. Exit code: ${code}`);
	});
}

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "context-lmtx" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	context.subscriptions.push(vscode.commands.registerCommand('context-lmtx.helloWorld', () => {
		// The code you place here will be executed every time your command is executed

		// Display a message box to the user
		vscode.window.showInformationMessage('Hello World from ConTeXt LMTX!');
	}));

	context.subscriptions.push(vscode.commands.registerCommand('context-lmtx.pickfonts', () => cmdPickFont(context)));
	context.subscriptions.push(vscode.commands.registerCommand("context-lmtx.compile", () => cmdCompile(context)));
	context.subscriptions.push(vscode.commands.registerCommand("context-lmtx.print-vim-filetypes", () => cmdPrintSupportedVimFileType(context)));
}

// this method is called when your extension is deactivated
export function deactivate() {
	if (myOutputChannel !== undefined) {
		myOutputChannel.dispose();
	}
}
