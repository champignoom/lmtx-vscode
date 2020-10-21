import * as vscode from 'vscode';

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

export {
	myOutputChannel,
    getFreshOutputChannel,
}