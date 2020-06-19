// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as child_process from 'child_process';
import { assert } from 'console';
import { findSourceMap } from 'module';
import { resolveCliPathFromVSCodeExecutablePath } from 'vscode-test';

const FIELD_IDENTIFIER = "identifier";
const FIELD_FAMILYNAME = "familyname";
const FIELD_FONTNAME   = "fontname";
const FIELD_FILENAME   = "filename";
const FIELD_SUBFONT    = "subfont";
const FIELD_INSTANCES  = "instances";

const mtxrun_font_fields = [
	FIELD_IDENTIFIER,
	FIELD_FAMILYNAME,
	FIELD_FONTNAME,
	FIELD_FILENAME,
	FIELD_SUBFONT,
	FIELD_INSTANCES,
];

/**
 * @param thead The header of the output of mtxrun for fonts.
 * Should be in the form `identifier   familyname  fontname  filename subfont   instances`
 * @returns the starting indices of the fields in the string.
 */
function get_field_indices(thead: string): Array<number> | undefined {
	const result = [] as Array<number>;
	for (const field of thead.matchAll(/\w+/g)) {
		// return undefined if more fields than expected or wrong header is met
		if (result.length === mtxrun_font_fields.length
			|| mtxrun_font_fields[result.length] !== field[0]) return;
		result.push(field.index as number);
	}

	// ensure that the lengths match
	if (result.length != mtxrun_font_fields.length) return;
	// just to reduce surprises: no leading spaces in the header
	if (result[0] != 0) return;

	return result;
}

/**
 * 
 * @param row
 *   e.g. `dejavumathnormal   dejavumath dejavumathregular  dejavu-math.otf`
 *   The row must contain at least the first four fields
 * @param indices
 *   the result of a [[get_field_indices]] call
 * @returns
 *   the values of each field against {@param indices}
 */
function get_font_fields(row: String, indices: Array<number>): Record<string,string> | undefined {
	assert(mtxrun_font_fields.length === indices.length);

	const result = {} as Record<string, string>;
	for (let i=0; i<mtxrun_font_fields.length; ++i) {
		const value = row.substring(indices[i], indices[i+1] || row.length);
		// Except for the last two field "subfont" and "instances",
		// the field must exist and cannot start with blank character.
		// As a result, the field is not empty.
		if (i<4 && (value.length===0 || value[0].trim().length===0)) {
			return;
		}

		result[mtxrun_font_fields[i]] = value.trim();
	}

	return result;
}

let myOutputChannel: vscode.OutputChannel | undefined = undefined;

function getFreshOutputChannel(): vscode.OutputChannel {
	if (myOutputChannel === undefined) {
		myOutputChannel = vscode.window.createOutputChannel("lmtx");
	} else {
		myOutputChannel.clear();
	}

	myOutputChannel.show(true);
	return myOutputChannel;
}

function cmdPickFont() {
	// mtxrun --script fonts --list --all
	// traverse ${ConTeXT_Path}/tex/texmf/fonts, create map

	const outputChannel = getFreshOutputChannel();
	const result_buffer = child_process.execFileSync('mtxrun', ['--script', 'fonts', '--list', '--all']);
	// outputChannel.appendLine('<<<');
	// outputChannel.appendLine(result_buffer);
	// outputChannel.appendLine('>>>');
	const result_lines = result_buffer.toString().split('\n');

	// The result should be of the form:
	//   identifier   familyname  fontname  filename subfont   instances
	//   (empty line)
	//   dejavumathnormal   dejavumath dejavumathregular  dejavu-math.otf
	//   ....

	if (result_lines.length === 0) {
		outputChannel.appendLine('result is empty')
		return;
	}

	const thead_indices = get_field_indices(result_lines[0]);
	if (thead_indices === undefined) {
		outputChannel.appendLine('unexpected header:');
		outputChannel.appendLine(result_lines[0]);
		outputChannel.appendLine('expected:');
		outputChannel.appendLine(mtxrun_font_fields.join(" "));
		return;
	}

	for (let i=2; i<result_lines.length; ++i) {
		if (result_lines[i].length === 0) {
			continue;
		}

		const field_values = get_font_fields(result_lines[i], thead_indices);
		if (field_values === undefined) {
			outputChannel.appendLine(`line ${i} in bad form:`);
			outputChannel.appendLine(result_lines[i]);
			outputChannel.appendLine('header:');
			outputChannel.appendLine(result_lines[0]);
			return;
		}
		outputChannel.appendLine(`${field_values.identifier}, ${field_values.familyname}, ${field_values.fontname}, ${field_values.filename}`);
	}
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

	context.subscriptions.push(vscode.commands.registerCommand('context-lmtx.pickfonts', cmdPickFont));
}

// this method is called when your extension is deactivated
export function deactivate() {
	if (myOutputChannel !== undefined) {
		myOutputChannel.dispose();
	}
}
