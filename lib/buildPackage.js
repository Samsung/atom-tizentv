var buildPackage = (function () {
    // Imports
    var fs = require('fs');
    var path = require('path');
    var logger = require('./logger');
    var common = require('./common');
    var TVWebApp = require('@tizentv/webide-common-tizentv').TVWebApp;

    // tizentv extension's path
    var extensionPath = __dirname + path.sep + '..';
    var outputPath = '/../';
    var profilePath =
        extensionPath + '/resource/profiles.xml'.split('/').join(path.sep);

    // Module name
    var moduleName = 'Build Package';
    var workspacePath = '';

    var expconfname = 'buildExceptionPath.conf';
    var explist = '';

    var checkExpFile = function (workspacePath, appName) {
        explist = '';
        var expfile = workspacePath + path.sep + expconfname;
        if (fs.existsSync(expfile)) {
            explist = fs.readFileSync(expfile, 'utf8');
        }
    };

    return {
        // Do 'Build Package' command
        // Also invoked by launch App functions
        handleCommand: async function () {
            logger.info(
                moduleName,
                '==============================Build Package start!'
            );

            //var workspacePath = common.getWorkspacePath();
            if (
                common.getFuncMode() != common.ENUM_COMMAND_MODE.DEBUGGER &&
                common.getFuncMode() !=
                    common.ENUM_COMMAND_MODE.DEBUGGER_TIZEN3_0_EMULATOR
            ) {
                logger.debug(
                    moduleName,
                    'If is debug mode ,set workspace to current work dir'
                );
                workspacePath = common.getWorkspacePath();
            }

            // Check if there's workspace
            if (typeof workspacePath == 'undefined') {
                var noWorkspace =
                    'No project in workspace, please check and select your project!';
                logger.error(moduleName, noWorkspace);
                common.showMsgOnWindow(
                    common.ENUM_WINMSG_LEVEL.ERROR,
                    noWorkspace
                );
                return;
            }

            // Get App's name
            var pathArray = workspacePath.split(path.sep);
            var appName = pathArray[pathArray.length - 1];

            logger.info(moduleName, "The app's path is: " + workspacePath);
            logger.info(moduleName, "The app's name is: " + appName);

            if (appName == '') {
                var warning_path =
                    'The input workspace is a invalid, please check if it is a root!';
                logger.warning(moduleName, warning_path);
                common.showMsgOnWindow(
                    common.ENUM_WINMSG_LEVEL.WARNING,
                    warning_path
                );
                return;
            }

            //check if there is exception file
            checkExpFile(workspacePath, appName);
            try {
                if (workspacePath) {
                    let newApp = new TVWebApp(appName, workspacePath);
                    newApp.init();
                    await newApp.buildWidget(
                        profilePath,
                        atom.config.get('atom-tizentv.tizentv.excludeFiles')
                    );

                    var buildSuccessMsg = 'Build the package Successfully!';
                    common.showMsgOnWindow(
                        common.ENUM_WINMSG_LEVEL.INFO,
                        buildSuccessMsg
                    );
                    logger.info(moduleName, buildSuccessMsg);
                } else {
                    // Show error to users
                    var errorMsg = 'Failed to build package!';
                    logger.error(moduleName, errorMsg);
                    common.showMsgOnWindow(
                        common.ENUM_WINMSG_LEVEL.WARNING,
                        errorMsg
                    );
                }
            } catch (ex) {
                var errorMsg = 'Build failed: ' + ex;
                common.showMsgOnWindow(
                    common.ENUM_WINMSG_LEVEL.WARNING,
                    errorMsg
                );
            }
        },

        // Handle 'Debug on TV 3.0' command
        prepareBuildForDebug: function (dirpath) {
            logger.info(
                moduleName,
                '==============================Build package for debug!'
            );
            workspacePath = dirpath;
            buildPackage.handleCommand();
        }
    };
})();
module.exports = buildPackage;
