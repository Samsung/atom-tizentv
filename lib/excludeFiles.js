var excludeFiles = (function () {
    // Imports
    const path = require('path');
    const logger = require('./logger');
    const common = require('./common');
    const moduleName = 'Exclude Files';

    return {
        handleCommand: function () {
            logger.info(
                moduleName,
                '==============================handleCommand start!'
            );
            let selectedFiles = common.getSelectedItemPath();
            let workspacePath = common.getWorkspacePath();

            if (null == selectedFiles || '' == selectedFiles) {
                let msg =
                    'No item is selected, please select your excluded file!';
                console.info(msg);
                common.showMsgOnWindow(common.ENUM_WINMSG_LEVEL.WARNING, msg);
                return;
            }

            if (selectedFiles == workspacePath) {
                let msg = selectedFiles + ' is project root path!';
                console.info(msg);
                common.showMsgOnWindow(common.ENUM_WINMSG_LEVEL.WARNING, msg);
                return;
            }

            let excludeFiles = atom.config.get(
                'atom-tizentv.tizentv.excludeFiles'
            );
            logger.info(moduleName, 'excludeFiles: ' + excludeFiles);

            if (null == excludeFiles || '' == excludeFiles) {
                excludeFiles = selectedFiles;
            } else {
                let exFileArr = excludeFiles.split(',');
                for (i = 0; i < exFileArr.length; i++) {
                    if (
                        exFileArr[i] == selectedFiles ||
                        exFileArr[i] == path.dirname(selectedFiles)
                    ) {
                        let msg = selectedFiles + ' is excluded!';
                        console.info(msg);
                        common.showMsgOnWindow(
                            common.ENUM_WINMSG_LEVEL.WARNING,
                            msg
                        );
                        return;
                    }
                }

                excludeFiles = excludeFiles + ',' + selectedFiles;
            }

            atom.config.set('atom-tizentv.tizentv.excludeFiles', excludeFiles);
            common.showMsgOnWindow(
                common.ENUM_WINMSG_LEVEL.INFO,
                selectedFiles + ' is excluded successful!'
            );
        }
    };
})();
module.exports = excludeFiles;
