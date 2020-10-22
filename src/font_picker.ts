import * as vscode from 'vscode';
import * as child_process from 'child_process';
import * as fs from 'fs'
import * as path from 'path'
import { assert } from 'console';
import { getFreshOutputChannel } from './output_channel'

const FIELD_IDENTIFIER = "identifier";
const FIELD_FAMILYNAME = "familyname";
const FIELD_FONTNAME   = "fontname";
const FIELD_FILENAME   = "filename";
const FIELD_SUBFONT    = "subfont";
const FIELD_INSTANCES  = "instances";

const FONT_PICKER_HTML = 'font_picker.html';

const mtxrun_font_fields = [
	FIELD_IDENTIFIER,
	FIELD_FAMILYNAME,
	FIELD_FONTNAME,
	FIELD_FILENAME,
	FIELD_SUBFONT,
	FIELD_INSTANCES,
];

// FIXME: when executing `mtxrun` for the first time, the format is a bit noisy

// `fc-query` format fields: https://github.com/behdad/fontconfig/blob/master/fontconfig/fontconfig.h
// `fc-query /usr/share/fonts/TTF/simsun.ttc /usr/share/fonts/TTF/pala.ttf -f '%{fullname} X %{capability}: %{charset}\n'`

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

/**
 * @return json
 *  [{'identifier': 'simsumextbregular', 'familyname': 'simsunextb', ...}, ...]
 */
function getFontJson() {
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
    
    let result = [];

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
        
        result.push(field_values);
		// outputChannel.appendLine(`${field_values.identifier}, ${field_values.familyname}, ${field_values.fontname}, ${field_values.filename}`);
    }
    
    return result;
}

function cmdPickFont(context: vscode.ExtensionContext) {
	// FIXME: handle ownership
	let panel = vscode.window.createWebviewPanel(
		'lmtxFontPicker',
		'LMTX Font Picker',
        vscode.ViewColumn.Beside,
        {
            enableScripts: true,
        }
	);

	const fontPickerHtmlPath = path.join(context.extensionPath, 'src', FONT_PICKER_HTML);
	const outputChannel = getFreshOutputChannel();
	outputChannel.appendLine(fontPickerHtmlPath);

    panel.webview.html = fs.readFileSync(fontPickerHtmlPath).toString();
    panel.webview.postMessage(getFontJson());
}

export {
    cmdPickFont,
}