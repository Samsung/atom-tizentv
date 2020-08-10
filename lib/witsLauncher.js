const fs = require('fs');
const path = require('path');
const xml2js = require('xml2js');
const wits = require('@tizentv/wits');
const common = require('./common');
const projectListView = require('./project-list-view');
const logger = require('./logger');
//const TVWebApp = require('@tizentv/webide-common-tizentv').TVWebApp;
const extensionRootPath = require('./common').extensionRootPath;
const sep = require('path').sep;

// Module name
const moduleName = 'Wits Launcher';

async function handleCommand(option) {
    logger.info(moduleName, 'handleCommand...');
    if (option == 'stop') {
        wits.disconnect();
        logger.info(moduleName, 'wits disconnect');
        return;
    }

    let workspacePath = common.getWorkspacePath();
    if (workspacePath == null || workspacePath == '') {
        logger.error(moduleName, 'webApp/workspacePath is null. Please select your project!');
        common.showMsgOnWindow(common.ENUM_WINMSG_LEVEL.WARNING, 'Please select your project!');
        return;
    }

    //let webApp = TVWebApp.openProject(workspacePath);
    //if (webApp == null) {
    //    logger.error(moduleName, 'webApp/workspacePath is null. Please select your project!');
    //    common.showMsgOnWindow(common.ENUM_WINMSG_LEVEL.WARNING, 'Please select your project!');
    //    return;
    //}
    //let appWidth = webApp.getAppScreenWidth();
    let appWidth = getAppScreenWidth(workspacePath);

    let debugMode = false;
    let connection = await checkTVConnection(debugMode);
    if (connection == undefined) {
        logger.error(moduleName, 'connection is undefined. Please check the host and TV IP');
        common.showMsgOnWindow(common.ENUM_WINMSG_LEVEL.WARNING, 'Please check the host and TV IP!');
        return;
    }

    const profileFilePath = extensionRootPath + sep + 'resource' + sep + 'profiles.xml';
    let proxyServer = atom.config.get('atom-tizentv.tizentv.proxyServer');
    let config = {
         deviceIp: connection.target,
         hostIp: connection.host,
         width: appWidth,
         profilePath: profileFilePath,
         baseAppPath: workspacePath,
         isDebugMode: connection.debugMode,
         proxyServer: proxyServer
    }

    await wits.setWitsconfigInfo(config);

    let platform = process.platform;
    if (platform != 'win32') {
        let sdbTool = `${__dirname}/../node_modules/@tizentv/wits/tools/sdb/${platform == 'linux'?'linux':'mac'}/sdb`;
        let secretTool = platform == 'linux' ? `${__dirname}/../node_modules/@tizentv/wits/tools/certificate-encryptor/secret-tool` : null;
        if (platform == 'linux') {
            try {
                fs.accessSync(sdbTool, fs.constants.S_IXUSR);
            } catch(err) {
                fs.chmodSync(sdbTool, fs.constants.S_IXUSR)
            }
            try {
                fs.accessSync(secretTool, fs.constants.S_IXUSR);
            } catch(err) {
                fs.chmodSync(secretTool, fs.constants.S_IXUSR)
            }
        } 
        if (platform == 'darwin') {
            try {
                fs.accessSync(sdbTool, '0777');
            } catch(err) {
                fs.chmodSync(sdbTool, '0777');
            }
        }
    }

    switch (option) {
        case 'start':
            console.log(`launch wits -start`);
            await wits.start();
            break;
        case 'watch':
            console.log(`launch wits -watch`);
            await wits.watch();
            break;
    }
}


async function checkTVConnection(debugMode) {
    let host = atom.config.get('atom-tizentv.tizentv.hostAddress');
    let target = atom.config.get('atom-tizentv.tizentv.targetDeviceAddress');
    let select = '';

    if (host == null) {
    logger.warning(moduleName, 'Host PC Address is null');
        return;
    }

    if (target == null) {
        logger.warning(moduleName, 'Target TV Device Address is null');
        return;
    }

    var optionTips = [`Please select wits start mode: ${host} (HOST) <--> ${target} (TARGET)`];
    var options = [
        'Wits Start Mode: Debug',
        'Wits Start Mode: Normal'
    ];

    await projectListView.showSelectList(options, optionTips).then(function(select) {
    if (!select) {
            var waringMsg = 'Cancelled the "Wits start" without selecting target!';
            logger.warning(moduleName, waringMsg);
            common.showMsgOnWindow(common.ENUM_WINMSG_LEVEL.WARNING, waringMsg);
            throw waringMsg;
        }
        if (select === 'Wits Start Mode: Debug') {
            debugMode = true;
        }
        logger.info(moduleName, 'debugMode = ' + debugMode);
        return;
    });

    return Promise.resolve({host, target, debugMode});
}


function getAppScreenWidth(workspacePath) {
    let width = '0';
    let configXml = path.resolve(workspacePath, `config.xml`);
    let orignalXml = fs.readFileSync(configXml, {encoding: 'utf-8'});
    xml2js.parseString(orignalXml, (err, jsonTemp) => {
        if (jsonTemp.widget.feature == undefined) {
            return;
        }
        jsonTemp.widget.feature.forEach(feature => {
            if (feature.$.name.startsWith('http://tizen.org/feature/screen.size')) {
                if (feature.$.name == 'http://tizen.org/feature/screen.size.all') {
                    width = '1920';
                } else {
                    if (feature.$.name != 'http://tizen.org/feature/screen.size' && feature.$.name != 'http://tizen.org/feature/screen.size.normal') {
                        let curWidth = feature.$.name.split('.').pop().trim();
                        width = parseInt(width) > parseInt(curWidth) ? width : curWidth;
                    }
                }
            }
        })
    });

    return width == '0' ? '1280' : width;
}

exports.handleCommand = handleCommand;