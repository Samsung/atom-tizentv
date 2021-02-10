const fs = require('fs');
const path = require('path');
const xml2js = require('xml2js');
const wits = require('@tizentv/wits');
const common = require('./common');
const projectListView = require('./project-list-view');
const logger = require('./logger');
const extensionRootPath = require('./common').extensionRootPath;
const sep = require('path').sep;
const PageObject = require('./views/pageObject');
const IpAddrInputView = require('./views/ipAddrInputView');

// Module name
const moduleName = 'Wits Launcher';
let hostIpInputPage = null;
let targetIpInputPage = null;

async function handleCommand(option) {
    logger.info(moduleName, 'handleCommand...');
    if (option == 'stop') {
        wits.disconnect();
        logger.info(moduleName, 'wits disconnect');
        return;
    }

    let workspacePath = common.getWorkspacePath();
    if (workspacePath == null || workspacePath == '') {
        logger.error(
            moduleName,
            'webApp/workspacePath is null. Please select your project!'
        );
        common.showMsgOnWindow(
            common.ENUM_WINMSG_LEVEL.WARNING,
            'Please select your project!'
        );
        return;
    }

    PageObject.addFinishListener(() => destroyAllPage());
    await checkTVConnection(option);
}

async function checkTVConnection(option) {
    let host = atom.config.get('atom-tizentv.tizentv.hostAddress');
    let target = atom.config.get('atom-tizentv.tizentv.targetDeviceAddress');
    let select = '';

    if (host == null) {
        logger.warning(moduleName, 'Host PC Address is null');
        showHostIpInputView();
    } else {
        if (target == null) {
            logger.warning(moduleName, 'Target TV Device Address is null');
            showTargetIpInputView();
        } else {
            var optionTips = 'Please confirm the IP of host and target';
            var options = [
                `connection: ${host} (HOST) <--> ${target} (TARGET)`,
                'Change Host IP Address',
                'Change Target IP Address'
            ];

            await projectListView
                .showSelectList(options, optionTips)
                .then(function (select) {
                    if (!select) {
                        let waringMsg =
                            'Cancelled the "Wits start" without selecting target!';
                        logger.warning(moduleName, waringMsg);
                        common.showMsgOnWindow(
                            common.ENUM_WINMSG_LEVEL.WARNING,
                            waringMsg
                        );
                        throw waringMsg;
                    }

                    PageObject.addFinishListener(() => destroyAllPage());
                    if (select === 'Change Host IP Address') {
                        showHostIpInputView();
                    } else if (select === 'Change Target IP Address') {
                        showTargetIpInputView();
                    } else {
                        showDebugSelectView(host, target, option);
                    }
                    return;
                });
        }
    }
}

function getAppScreenWidth(workspacePath) {
    let width = '0';
    let configXml = path.resolve(workspacePath, `config.xml`);
    let orignalXml = fs.readFileSync(configXml, { encoding: 'utf-8' });
    xml2js.parseString(orignalXml, (err, jsonTemp) => {
        if (jsonTemp.widget.feature == undefined) {
            return;
        }
        jsonTemp.widget.feature.forEach(feature => {
            if (
                feature.$.name.startsWith(
                    'http://tizen.org/feature/screen.size'
                )
            ) {
                if (
                    feature.$.name == 'http://tizen.org/feature/screen.size.all'
                ) {
                    width = '1920';
                } else {
                    if (
                        feature.$.name !=
                            'http://tizen.org/feature/screen.size' &&
                        feature.$.name !=
                            'http://tizen.org/feature/screen.size.normal'
                    ) {
                        let curWidth = feature.$.name.split('.').pop().trim();
                        width =
                            parseInt(width) > parseInt(curWidth)
                                ? width
                                : curWidth;
                    }
                }
            }
        });
    });

    return width == '0' ? '1280' : width;
}

function showHostIpInputView() {
    if (hostIpInputPage == null) {
        hostIpInputPage = new PageObject({
            view: new IpAddrInputView({
                type: 'hostIp',
                head: 'Configure Host PC IP Address',
                label: 'Host PC IP:',
                onClickNextBtn: () => saveHostIp(),
                onClickCancelBtn: () => hostIpInputPage.hide()
            })
        });
    }

    hostIpInputPage.show();
}

function showTargetIpInputView() {
    if (targetIpInputPage == null) {
        targetIpInputPage = new PageObject({
            view: new IpAddrInputView({
                type: 'targetIp',
                head: 'Configure Target Device IP Address',
                label: 'Target IP:',
                onClickNextBtn: () => saveTargetIp(),
                onClickCancelBtn: () => targetIpInputPage.hide()
            })
        });
    }

    targetIpInputPage.show();
}

async function showDebugSelectView(host, target, option) {
    let debugMode = false;
    const optionTips = [
        `Please select wits start mode: ${host} (HOST) <--> ${target} (TARGET)`
    ];
    const options = ['Wits Start Mode: Debug', 'Wits Start Mode: Normal'];

    await projectListView
        .showSelectList(options, optionTips)
        .then(async function (select) {
            if (!select) {
                var waringMsg =
                    'Cancelled the "Wits start" without selecting target!';
                logger.warning(moduleName, waringMsg);
                common.showMsgOnWindow(
                    common.ENUM_WINMSG_LEVEL.WARNING,
                    waringMsg
                );
                throw waringMsg;
            }
            if (select === 'Wits Start Mode: Debug') {
                debugMode = true;
            }
            logger.info(moduleName, 'debugMode = ' + debugMode);
            const profileFilePath =
                extensionRootPath + sep + 'resource' + sep + 'profiles.xml';
            const workspacePath = common.getWorkspacePath();
            const appWidth = getAppScreenWidth(workspacePath);
            let config = {
                deviceIp: target,
                hostIp: host,
                width: appWidth,
                profilePath: profileFilePath,
                baseAppPath: workspacePath,
                isDebugMode: debugMode
            };

            await wits.setWitsconfigInfo(config);
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
            return;
        });
}

function saveHostIp() {
    let hostIp = hostIpInputPage.getView().getInfo();
    atom.config.set('atom-tizentv.tizentv.hostAddress', hostIp);
    checkTVConnection();
}

function saveTargetIp() {
    let targetIp = targetIpInputPage.getView().getInfo();
    atom.config.set('atom-tizentv.tizentv.targetDeviceAddress', targetIp);
    checkTVConnection();
}

function destroyAllPage() {
    hostIpInputPage = null;
    targetIpInputPage = null;
}

exports.handleCommand = handleCommand;
