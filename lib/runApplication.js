var common = require('./common');
var logger = require('./logger');
var launchEmulatorApp = require('./launchEmulatorApp');
var launchSimulator = require('./launchSimulator');
var launchTarget = require('./launchTarget'); 
const projectListView = require('./project-list-view');
const moduleName = 'Run Application';

function handleCommand() {

    var optionTips = 'Please select a target';
    var options = [
        'Run On TV',
        'Run On TV Emulator',
        'Run On TV Simulator'
    ];

    projectListView.showSelectList(options, optionTips).then(function(target) {
        if (!target) {

            var waringMsg = 'Cancelled the "Run Application" without selecting target!';
        	logger.warning(moduleName, waringMsg);
			common.showMsgOnWindow(common.ENUM_WINMSG_LEVEL.WARNING, waringMsg);
			throw waringMsg;
        }
        if (target === 'Run On TV') {

            launchTarget.handleCommand(false);
            return;
        }
        else if (target === 'Run On TV Emulator') {

            launchEmulatorApp.handleCommand(false);
            return;
        }
        else if (target === 'Run On TV Simulator') {

            launchSimulator.handleCommand();
            return;
        }
    });
}
exports.handleCommand = handleCommand;